import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortProbeWebSocketService } from '@backend/services/port-probe-websocket-service';
import * as cacheService from '@backend/services/port-screenshot-cache-service';

// probeTarget() is a private method but it holds all of the interesting branching logic
// (HTTP detection, signature computation, cache lookup, negative caching). Accessing it
// directly via a fresh instance avoids needing a real socket round-trip per test case.
type ProbeTargetFn = (target: { port: number; processName: string }) => Promise<{
  type: 'probe-result';
  port: number;
  isHttp: boolean;
  url: string;
  statusCode: number | null;
  signature: string | null;
  cachedScreenshot: { fileName: string; capturedAt: string } | null;
}>;

function getProbeTarget(service: PortProbeWebSocketService): ProbeTargetFn {
  return (service as unknown as { probeTarget: ProbeTargetFn }).probeTarget.bind(service);
}

describe('PortProbeWebSocketService', () => {
  let service: PortProbeWebSocketService;
  let probeTarget: ProbeTargetFn;

  beforeEach(() => {
    service = new PortProbeWebSocketService();
    probeTarget = getProbeTarget(service);
    cacheService.clearNonHttp(6000);
    cacheService.clearNonHttp(6001);
    cacheService.clearNonHttp(6002);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reports isHttp: true with a signature when the port responds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html></html>', {
          status: 200,
          headers: { etag: '"abc123"' },
        })
      )
    );
    vi.spyOn(cacheService, 'getFresh').mockResolvedValue(null);

    const result = await probeTarget({ port: 6000, processName: 'node' });

    expect(result.isHttp).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.signature).not.toBeNull();
    expect(result.cachedScreenshot).toBeNull();
  });

  it('includes the cached screenshot info when the cache service has a fresh hit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 200, headers: { etag: '"abc"' } }))
    );
    const capturedAt = new Date('2026-01-01T00:00:00.000Z');
    vi.spyOn(cacheService, 'getFresh').mockResolvedValue({
      fileName: 'abc123.jpg',
      capturedAt,
      width: 384,
      height: 240,
    });

    const result = await probeTarget({ port: 6001, processName: 'node' });

    expect(result.cachedScreenshot).toEqual({
      fileName: 'abc123.jpg',
      capturedAt: capturedAt.toISOString(),
    });
  });

  it('reports isHttp: false and marks the port as known-non-HTTP when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));

    const result = await probeTarget({ port: 6002, processName: 'redis-server' });

    expect(result.isHttp).toBe(false);
    expect(result.statusCode).toBeNull();
    expect(result.signature).toBeNull();
    expect(result.cachedScreenshot).toBeNull();
    expect(cacheService.isKnownNonHttp(6002)).toBe(true);
  });

  it('short-circuits to isHttp: false without calling fetch when the port is already known-non-HTTP', async () => {
    cacheService.markNonHttp(6002);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await probeTarget({ port: 6002, processName: 'redis-server' });

    expect(result.isHttp).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
