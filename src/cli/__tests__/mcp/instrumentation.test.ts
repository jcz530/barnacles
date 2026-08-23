import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { instrumentServer } from '@cli/mcp/instrumentation.js';
import { EventReporter, sanitizeArgs } from '@cli/mcp/event-reporter.js';
import { getBackendUrl } from '@cli/utils/app-manager.js';

vi.mock('@cli/utils/app-manager.js', () => ({
  getBackendUrl: vi.fn(),
}));

/** Minimal stand-in for a RegisteredTool — only `handler` matters here. */
function fakeTool(handler: unknown): RegisteredTool {
  return { handler, enabled: true } as unknown as RegisteredTool;
}

function fakeReporter() {
  return { record: vi.fn(), setClient: vi.fn() } as unknown as EventReporter & {
    record: ReturnType<typeof vi.fn>;
  };
}

describe('instrumentServer', () => {
  it('records a successful call with its duration', async () => {
    const reporter = fakeReporter();
    const tool = fakeTool(async () => ({ content: [{ type: 'text', text: 'ok' }] }));

    instrumentServer({ list_ports: tool }, reporter);
    const result = await (tool.handler as (...a: unknown[]) => Promise<unknown>)({});

    expect(result).toEqual({ content: [{ type: 'text', text: 'ok' }] });
    expect(reporter.record).toHaveBeenCalledTimes(1);
    expect(reporter.record.mock.calls[0][0]).toMatchObject({
      name: 'list_ports',
      status: 'success',
    });
    expect(reporter.record.mock.calls[0][0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records isError results as errors', async () => {
    // The tools catch their own failures and return isError rather than throwing,
    // so a try/catch-only wrapper would log every failure as a success.
    const reporter = fakeReporter();
    const tool = fakeTool(async () => ({
      isError: true,
      content: [{ type: 'text', text: 'lsof unavailable' }],
    }));

    instrumentServer({ list_ports: tool }, reporter);
    await (tool.handler as (...a: unknown[]) => Promise<unknown>)({});

    expect(reporter.record.mock.calls[0][0]).toMatchObject({
      name: 'list_ports',
      status: 'error',
      errorMessage: 'lsof unavailable',
    });
  });

  it('records a thrown error and rethrows it', async () => {
    const reporter = fakeReporter();
    const tool = fakeTool(async () => {
      throw new Error('boom');
    });

    instrumentServer({ list_ports: tool }, reporter);

    await expect((tool.handler as (...a: unknown[]) => Promise<unknown>)({})).rejects.toThrow(
      'boom'
    );
    expect(reporter.record.mock.calls[0][0]).toMatchObject({
      status: 'error',
      errorMessage: 'boom',
    });
  });

  it('never breaks the tool call when the reporter throws', async () => {
    const reporter = {
      record: vi.fn(() => {
        throw new Error('reporter exploded');
      }),
    } as unknown as EventReporter;
    const tool = fakeTool(async () => ({ content: [{ type: 'text', text: 'ok' }] }));

    instrumentServer({ list_ports: tool }, reporter);

    // The wrapper must not let a telemetry failure surface to the caller.
    await expect((tool.handler as (...a: unknown[]) => Promise<unknown>)({})).resolves.toEqual({
      content: [{ type: 'text', text: 'ok' }],
    });
  });

  it('passes through call arguments untouched', async () => {
    const reporter = fakeReporter();
    const inner = vi.fn(async () => ({ content: [] }));
    const tool = fakeTool(inner);

    instrumentServer({ get_project_by_path: tool }, reporter);
    const extra = { signal: 'ctx' };
    await (tool.handler as (...a: unknown[]) => Promise<unknown>)({ path: '/tmp' }, extra);

    expect(inner).toHaveBeenCalledWith({ path: '/tmp' }, extra);
    expect(reporter.record.mock.calls[0][0].args).toEqual({ path: '/tmp' });
  });

  it('skips non-function handlers', () => {
    const reporter = fakeReporter();
    const taskHandler = { createTask: () => undefined };
    const tool = fakeTool(taskHandler);

    instrumentServer({ some_task: tool }, reporter);

    expect(tool.handler).toBe(taskHandler);
  });

  it('instruments every tool it is given', async () => {
    const reporter = fakeReporter();
    const tools = {
      a: fakeTool(async () => ({ content: [] })),
      b: fakeTool(async () => ({ content: [] })),
    };

    instrumentServer(tools, reporter);
    await (tools.a.handler as (...a: unknown[]) => Promise<unknown>)({});
    await (tools.b.handler as (...a: unknown[]) => Promise<unknown>)({});

    expect(reporter.record.mock.calls.map(call => call[0].name)).toEqual(['a', 'b']);
  });
});

describe('sanitizeArgs', () => {
  it('redacts sensitive keys', () => {
    const result = sanitizeArgs({
      username: 'joe',
      password: 'hunter2',
      apiKey: 'sk-123',
      authToken: 'abc',
    });

    expect(result).toEqual({
      username: 'joe',
      password: '[redacted]',
      apiKey: '[redacted]',
      authToken: '[redacted]',
    });
  });

  it('redacts sensitive keys inside nested objects', () => {
    const result = sanitizeArgs({ account: { name: 'prod', secret: 'shh' } });

    expect(result).toEqual({ account: { name: 'prod', secret: '[redacted]' } });
  });

  it('caps long strings', () => {
    const result = sanitizeArgs({ path: 'x'.repeat(1000) }) as { path: string };

    expect(result.path.length).toBeLessThanOrEqual(513);
    expect(result.path.endsWith('…')).toBe(true);
  });

  it('drops oversized payloads whole rather than truncating JSON', () => {
    const result = sanitizeArgs({
      items: Array.from({ length: 200 }, (_, i) => `value-${i}-${'y'.repeat(60)}`),
    });

    expect(result).toEqual({ argsOmitted: true, argsTruncated: true });
  });

  it('returns undefined for non-object args', () => {
    expect(sanitizeArgs(undefined)).toBeUndefined();
    expect(sanitizeArgs('string')).toBeUndefined();
    expect(sanitizeArgs([1, 2])).toBeUndefined();
  });

  it('redacts the wider set of credential-shaped keys', () => {
    expect(
      sanitizeArgs({ pwd: 'x', sessionId: 'y', cookie: 'z', jwt: 'w', bearerToken: 'v' })
    ).toEqual({
      pwd: '[redacted]',
      sessionId: '[redacted]',
      cookie: '[redacted]',
      jwt: '[redacted]',
      bearerToken: '[redacted]',
    });
  });

  it('survives a self-referential payload', () => {
    const cyclic: Record<string, unknown> = { name: 'x' };
    cyclic.self = cyclic;

    expect(() => sanitizeArgs(cyclic)).not.toThrow();
    expect(sanitizeArgs(cyclic)).toEqual({ name: 'x', self: '[circular]' });
  });

  it('preserves ordinary values', () => {
    expect(sanitizeArgs({ pid: 123, force: true, name: 'web' })).toEqual({
      pid: 123,
      force: true,
      name: 'web',
    });
  });
});

describe('EventReporter', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(getBackendUrl).mockReset();
    vi.mocked(getBackendUrl).mockResolvedValue('http://localhost:51000');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not flush immediately on a single event', () => {
    const reporter = new EventReporter();
    reporter.record({ name: 'list_ports', status: 'success', durationMs: 1 });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('flushes after the debounce elapses', async () => {
    const reporter = new EventReporter();
    reporter.record({ name: 'list_ports', status: 'success', durationMs: 1 });

    await vi.advanceTimersByTimeAsync(2000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({ source: 'mcp', category: 'tool_call' });
  });

  it('flushes immediately once the batch threshold is reached', async () => {
    const reporter = new EventReporter();
    for (let i = 0; i < 20; i++) {
      reporter.record({ name: 'list_ports', status: 'success', durationMs: 1 });
    }

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events).toHaveLength(20);
  });

  it('never calls fetch or launches the app when the backend is down', async () => {
    vi.mocked(getBackendUrl).mockResolvedValue(null);
    const reporter = new EventReporter();

    reporter.record({ name: 'convert_color', status: 'success', durationMs: 1 });
    await vi.advanceTimersByTimeAsync(2000);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('attaches client identity to recorded events', async () => {
    const reporter = new EventReporter();
    reporter.setClient('claude-code', '2.0.0');
    reporter.record({ name: 'list_ports', status: 'success', durationMs: 1 });

    await vi.advanceTimersByTimeAsync(2000);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events[0]).toMatchObject({
      clientName: 'claude-code',
      clientVersion: '2.0.0',
    });
  });

  it('swallows transport failures', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const reporter = new EventReporter();

    reporter.record({ name: 'list_ports', status: 'success', durationMs: 1 });

    await expect(vi.advanceTimersByTimeAsync(2000)).resolves.not.toThrow();
  });

  it('records sanitized args as metadata', async () => {
    const reporter = new EventReporter();
    reporter.record({
      name: 'list_project_accounts',
      status: 'success',
      durationMs: 1,
      args: { projectId: 'abc', password: 'hunter2' },
    });

    await vi.advanceTimersByTimeAsync(2000);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events[0].metadata).toEqual({
      args: { projectId: 'abc', password: '[redacted]' },
    });
  });

  it('caps the buffer so a runaway agent cannot exhaust memory', async () => {
    // Hold the flush open so everything recorded piles up in the buffer.
    let release: (value: unknown) => void = () => {};
    fetchMock.mockImplementation(() => new Promise(resolve => (release = resolve)));

    const reporter = new EventReporter();
    for (let i = 0; i < 500; i++) {
      reporter.record({ name: `call-${i}`, status: 'success', durationMs: 1 });
    }

    // Assert the bound itself, not merely that nothing threw. The first 20
    // events flush immediately; the remaining 480 pile up behind the stuck
    // request and must be capped rather than grow without limit.
    const buffered = (reporter as unknown as { buffer: unknown[] }).buffer;
    expect(buffered.length).toBeLessThanOrEqual(200);

    // The cap trims from the front, so the newest events are the ones kept.
    const names = (buffered as { name: string }[]).map(event => event.name);
    expect(names).toContain('call-499');
    expect(names).not.toContain('call-20');

    release({ ok: true, status: 200 });
    await vi.advanceTimersByTimeAsync(5000);
  });

  it('still sends events recorded during a flush that outlasts the debounce', async () => {
    // The debounce timer fires while a flush is in flight, hits the `inFlight`
    // early return, and consumes the timer — these events must not be stranded.
    let release: (value: unknown) => void = () => {};
    fetchMock
      .mockImplementationOnce(() => new Promise(resolve => (release = resolve)))
      .mockResolvedValue({ ok: true, status: 200 });

    const reporter = new EventReporter();
    reporter.record({ name: 'first', status: 'success', durationMs: 1 });
    await vi.advanceTimersByTimeAsync(2000);

    reporter.record({ name: 'second', status: 'success', durationMs: 1 });
    await vi.advanceTimersByTimeAsync(2000);

    release({ ok: true, status: 200 });
    await vi.advanceTimersByTimeAsync(10000);

    const sent = fetchMock.mock.calls.flatMap(call =>
      (JSON.parse(call[1].body).events as { name: string }[]).map(event => event.name)
    );
    expect(sent).toContain('second');
  });
});

describe('instrumentation through a real McpServer', () => {
  it('takes effect on tools registered via registerTools', async () => {
    // Guards the SDK assumption that `RegisteredTool.handler` is read at call
    // time — if a future SDK stops honoring reassignment, this fails loudly
    // instead of silently logging nothing.
    const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
    const { registerTools } = await import('@cli/mcp/tools/index.js');
    const { apiClient } = await import('@cli/utils/api-client.js');

    vi.spyOn(apiClient, 'get').mockResolvedValue([]);

    const reporter = fakeReporter();
    const server = new McpServer({ name: 'test', version: '1.0.0' });
    const tools = registerTools(server);

    instrumentServer(tools, reporter);

    await (tools.list_ports.handler as (...a: unknown[]) => Promise<unknown>)({}, {});

    expect(reporter.record).toHaveBeenCalledTimes(1);
    expect(reporter.record.mock.calls[0][0]).toMatchObject({
      name: 'list_ports',
      status: 'success',
    });
  });
});
