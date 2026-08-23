import type { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { EventReporter } from './event-reporter.js';

/**
 * Wrap every registered tool's handler so calls are recorded.
 *
 * Done here rather than in the 20 individual tool files so new tools are
 * instrumented automatically and the tool tests — which call the registration
 * functions directly on a bare McpServer — stay untouched.
 *
 * Reassigning `handler` is safe: the SDK reads `tool.handler` at call time and
 * mutates the same property itself in `RegisteredTool.update()`.
 */

type ToolResult = { isError?: boolean } | undefined;
type ToolHandler = (...args: unknown[]) => unknown;

export function instrumentServer(
  tools: Record<string, RegisteredTool>,
  reporter: EventReporter
): void {
  for (const [name, tool] of Object.entries(tools)) {
    const original = tool.handler as unknown;

    // Task-based handlers are objects, not functions — leave those alone.
    if (typeof original !== 'function') continue;

    const originalHandler = original as ToolHandler;

    const wrapped = async (...callArgs: unknown[]) => {
      const startedAt = Date.now();
      const args = typeof callArgs[0] === 'object' ? callArgs[0] : undefined;

      try {
        const result = (await originalHandler(...callArgs)) as ToolResult;

        // These tools report failure by returning `isError`, not by throwing,
        // so a try/catch alone would record every failure as a success.
        safeRecord(reporter, {
          name,
          status: result?.isError ? 'error' : 'success',
          durationMs: Date.now() - startedAt,
          args,
          errorMessage: result?.isError ? extractErrorText(result) : undefined,
        });

        return result;
      } catch (error) {
        safeRecord(reporter, {
          name,
          status: 'error',
          durationMs: Date.now() - startedAt,
          args,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });

        throw error;
      }
    };

    tool.handler = wrapped as typeof tool.handler;
  }
}

/**
 * Record an event without ever letting a telemetry failure reach the caller.
 *
 * `EventReporter.record` already guards itself, but the wrapper must not depend
 * on that — a broken or stubbed reporter must never turn a working tool call
 * into a failed one.
 */
function safeRecord(reporter: EventReporter, call: Parameters<EventReporter['record']>[0]): void {
  try {
    reporter.record(call);
  } catch {
    // Intentionally silent: stdout is the MCP transport and this is telemetry.
  }
}

/** Pull the human-readable message out of an error-shaped tool result. */
function extractErrorText(result: ToolResult): string | undefined {
  const content = (result as { content?: unknown })?.content;
  if (!Array.isArray(content)) return undefined;

  const first = content[0] as { type?: string; text?: string } | undefined;
  return first?.type === 'text' ? first.text : undefined;
}
