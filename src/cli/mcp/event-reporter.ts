import { getBackendUrl } from '../utils/app-manager.js';
import { API_ROUTES } from '../../shared/constants/index.js';
import type { EventInput, EventStatus } from '../../shared/types/api.js';

/**
 * Buffers MCP tool-call events and flushes them to the Barnacles backend.
 *
 * Three rules govern everything here:
 *
 * 1. **Never write to stdout.** This process speaks JSON-RPC over stdio; a stray
 *    `console.log` corrupts the transport and breaks every tool call. Diagnostics
 *    go to stderr, and only when BARNACLES_MCP_DEBUG is set.
 * 2. **Never launch the app.** `apiClient` would call `ensureBackendRunning()`,
 *    which spawns Electron and waits up to 10s. Telemetry uses `getBackendUrl()`,
 *    which returns null when nothing is listening.
 * 3. **Never break a tool call.** Recording is a synchronous push, flushing is
 *    fire-and-forget, and every failure path is swallowed.
 */

const FLUSH_THRESHOLD = 20;
const FLUSH_DEBOUNCE_MS = 2000;
const MAX_BUFFER = 200;
const MAX_ARGS_BYTES = 2048;
const MAX_STRING_CHARS = 512;
const MAX_ERROR_CHARS = 500;
const POST_TIMEOUT_MS = 2000;
const BACKEND_LOOKUP_COOLDOWN_MS = 60_000;

/** Keys whose values must never be recorded. */
const SENSITIVE_KEY_PATTERN =
  /pass|pwd|secret|token|key|credential|auth|session|cookie|bearer|jwt|signature/i;

function debug(message: string, error?: unknown): void {
  if (!process.env.BARNACLES_MCP_DEBUG) return;
  // stderr only — stdout is the MCP transport.
  console.error(`[barnacles-mcp] ${message}`, error ?? '');
}

/**
 * Redact sensitive values and cap long strings.
 *
 * Returns the sanitized object, or a marker when the payload is too large to
 * store. An oversized object is dropped whole rather than truncated: cutting a
 * serialized JSON string mid-value produces something unparseable.
 */
export function sanitizeArgs(args: unknown): Record<string, unknown> | undefined {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) return undefined;

  // Guards against a self-referential payload recursing until the stack blows.
  const seen = new WeakSet<object>();

  const sanitize = (value: unknown, key?: string): unknown => {
    if (key && SENSITIVE_KEY_PATTERN.test(key)) return '[redacted]';

    if (typeof value === 'string') {
      return value.length > MAX_STRING_CHARS ? `${value.slice(0, MAX_STRING_CHARS)}…` : value;
    }

    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[circular]';
      seen.add(value);

      if (Array.isArray(value)) return value.map(item => sanitize(item));

      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitize(v, k)])
      );
    }

    return value;
  };

  const sanitized = sanitize(args) as Record<string, unknown>;

  try {
    const json = JSON.stringify(sanitized);
    if (json === undefined) return undefined;
    if (Buffer.byteLength(json, 'utf8') > MAX_ARGS_BYTES) {
      return { argsOmitted: true, argsTruncated: true };
    }
    return sanitized;
  } catch {
    return { argsOmitted: true, argsTruncated: true };
  }
}

export interface ToolCallRecord {
  name: string;
  status: EventStatus;
  durationMs: number;
  args?: unknown;
  errorMessage?: string;
}

export class EventReporter {
  private buffer: EventInput[] = [];
  private timer: NodeJS.Timeout | null = null;
  private inFlight: Promise<void> | null = null;
  private clientName: string | undefined;
  private clientVersion: string | undefined;
  private workingDir: string | undefined;
  private terminal: string | undefined;
  private cachedBaseUrl: string | null = null;
  private backendUnavailableUntil = 0;

  /** Attach the connected client's identity to subsequent events. */
  setClient(name?: string, version?: string): void {
    this.clientName = name;
    this.clientVersion = version;
  }

  /**
   * Attach where this server was launched from to subsequent events.
   *
   * Captured once at startup, not per call: an MCP stdio server is long-lived
   * and its working directory is fixed at spawn, so every event from one agent
   * session shares these values. Both are best-effort — a GUI-launched client
   * has no terminal, and its cwd is wherever the app happened to start.
   *
   * Unlike args, these bypass `sanitizeArgs`, so the path is capped here.
   */
  setEnvironment(workingDir?: string | null, terminal?: string | null): void {
    this.workingDir = workingDir ? workingDir.slice(0, MAX_STRING_CHARS) : undefined;
    this.terminal = terminal ? terminal.slice(0, MAX_STRING_CHARS) : undefined;
  }

  /**
   * Queue a tool call. Synchronous by design — never awaited in the tool path.
   */
  record(call: ToolCallRecord): void {
    try {
      const metadata = sanitizeArgs(call.args);

      this.buffer.push({
        source: 'mcp',
        category: 'tool_call',
        name: call.name,
        status: call.status,
        durationMs: call.durationMs,
        errorMessage: call.errorMessage?.slice(0, MAX_ERROR_CHARS),
        clientName: this.clientName,
        clientVersion: this.clientVersion,
        workingDir: this.workingDir,
        terminal: this.terminal,
        metadata: metadata ? { args: metadata } : undefined,
        occurredAt: new Date().toISOString(),
      });

      if (this.buffer.length > MAX_BUFFER) {
        this.buffer.splice(0, this.buffer.length - MAX_BUFFER);
      }

      if (this.buffer.length >= FLUSH_THRESHOLD) {
        void this.flush();
      } else {
        this.scheduleFlush();
      }
    } catch (error) {
      // Telemetry must never break a tool call.
      debug('failed to record event', error);
    }
  }

  private scheduleFlush(): void {
    if (this.timer) return;

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, FLUSH_DEBOUNCE_MS);

    // Never hold the process open just to flush telemetry.
    this.timer.unref?.();
  }

  /**
   * Resolve the backend URL without ever launching the app.
   */
  private async resolveBaseUrl(): Promise<string | null> {
    if (this.cachedBaseUrl) return this.cachedBaseUrl;

    if (Date.now() < this.backendUnavailableUntil) return null;

    const url = await getBackendUrl();

    if (!url) {
      // Back off — probing fans out across the whole port range.
      this.backendUnavailableUntil = Date.now() + BACKEND_LOOKUP_COOLDOWN_MS;
      return null;
    }

    this.cachedBaseUrl = url;
    return url;
  }

  /**
   * Send buffered events. Never throws; a failed batch is dropped rather than retried.
   */
  async flush(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    if (this.buffer.length === 0) return;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const batch = this.buffer.splice(0, this.buffer.length);

    this.inFlight = (async () => {
      try {
        const baseUrl = await this.resolveBaseUrl();
        if (!baseUrl) {
          debug(`backend unavailable, dropping ${batch.length} events`);
          return;
        }

        const response = await fetch(`${baseUrl}${API_ROUTES.EVENTS}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: batch }),
          signal: AbortSignal.timeout(POST_TIMEOUT_MS),
        });

        if (!response.ok) {
          debug(`event ingest returned ${response.status}`);
          // The app may have restarted on a different port.
          this.cachedBaseUrl = null;
        }
      } catch (error) {
        debug('failed to flush events', error);
        this.cachedBaseUrl = null;
      } finally {
        this.inFlight = null;
        // Events recorded during this flight hit the `inFlight` early-return in
        // flush(), which also consumed their debounce timer. Without this they
        // would sit in the buffer until the next tool call — or be lost if the
        // session ends first.
        if (this.buffer.length > 0) this.scheduleFlush();
      }
    })();

    return this.inFlight;
  }

  /**
   * Best-effort flush on shutdown.
   *
   * MCP stdio servers are frequently killed abruptly, and an async fetch started
   * from a signal handler usually will not finish. The real protection against
   * loss is the short debounce, not this.
   */
  registerExitHandlers(): void {
    const onExit = () => {
      void this.flush();
    };

    process.once('beforeExit', onExit);
    process.once('SIGINT', onExit);
    process.once('SIGTERM', onExit);
  }
}

export const eventReporter = new EventReporter();
