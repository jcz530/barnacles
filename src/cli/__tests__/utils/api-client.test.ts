import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApiClient } from '@cli/utils/api-client.js';

vi.mock('@cli/utils/app-manager.js', () => ({
  ensureBackendRunning: vi.fn().mockResolvedValue('http://localhost:51000'),
  getBackendUrl: vi.fn().mockResolvedValue('http://localhost:51000'),
}));

function mockFetchResponse(ok: boolean, status: number, statusText: string, body: unknown) {
  return {
    ok,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient();
    vi.restoreAllMocks();
  });

  it('returns the data field on a successful response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      mockFetchResponse(true, 200, 'OK', { data: { foo: 'bar' } })
    );

    const result = await client.get('/api/things');

    expect(result).toEqual({ foo: 'bar' });
  });

  it('throws the backend error message when the response body has one', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      mockFetchResponse(false, 400, 'Bad Request', {
        error: 'No start processes configured for this project',
      })
    );

    await expect(client.post('/api/projects/1/start')).rejects.toThrow(
      'No start processes configured for this project'
    );
  });

  it('falls back to a generic status message when the body has no error/message field', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(mockFetchResponse(false, 500, 'Server Error', {}));

    await expect(client.get('/api/things')).rejects.toThrow('API error: 500 Server Error');
  });

  it('falls back to a generic status message when the body is not JSON', async () => {
    const response = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: vi.fn().mockRejectedValue(new Error('not json')),
    } as unknown as Response;
    vi.spyOn(global, 'fetch').mockResolvedValue(response);

    await expect(client.delete('/api/things/1')).rejects.toThrow('API error: 404 Not Found');
  });
});
