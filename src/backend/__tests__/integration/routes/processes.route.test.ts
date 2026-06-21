import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIntegrationTestContext } from '@test/contexts';
import { get } from '@test/helpers/api-client';
import { processManagerService } from '@backend/services/process-manager-service';

vi.mock('@backend/services/process-manager-service', () => ({
  processManagerService: {
    getProcess: vi.fn(),
    getProcessOutputById: vi.fn(),
  },
}));

describe('Processes API Integration Tests', () => {
  const context = createIntegrationTestContext();

  beforeEach(async () => {
    await context.setup(async () => {
      const { Hono } = await import('hono');
      const { errorHandler } = await import('@backend/middleware/error-handler');
      const processesRoute = (await import('@backend/routes/processes')).default;
      const app = new Hono();
      app.onError(errorHandler);
      app.route('/api/processes', processesRoute);
      return app;
    });
  });

  afterEach(async () => {
    await context.teardown();
    vi.restoreAllMocks();
  });

  describe('GET /api/processes/:id/output', () => {
    it('should return full output when no lines param is given', async () => {
      const { app } = context.get();
      vi.mocked(processManagerService.getProcess).mockReturnValue({
        processId: 'p1',
        status: 'running',
      } as never);
      vi.mocked(processManagerService.getProcessOutputById).mockReturnValue([
        'line1\n',
        'line2\n',
        'line3\n',
      ]);

      const response = await get(app, '/api/processes/p1/output');

      expect(response.status).toBe(200);
      const data = (response.data as any).data;
      expect(data.lines).toEqual(['line1\n', 'line2\n', 'line3\n']);
      expect(data.output).toBe('line1\nline2\nline3\n');
    });

    it('should tail output to the requested number of lines', async () => {
      const { app } = context.get();
      vi.mocked(processManagerService.getProcess).mockReturnValue({
        processId: 'p1',
        status: 'running',
      } as never);
      vi.mocked(processManagerService.getProcessOutputById).mockReturnValue([
        'line1\n',
        'line2\n',
        'line3\n',
      ]);

      const response = await get(app, '/api/processes/p1/output?lines=2');

      expect(response.status).toBe(200);
      const data = (response.data as any).data;
      expect(data.lines).toEqual(['line2\n', 'line3\n']);
      expect(data.output).toBe('line2\nline3\n');
    });

    it('should return 404 for non-existent process', async () => {
      const { app } = context.get();
      vi.mocked(processManagerService.getProcess).mockReturnValue(undefined as never);

      const response = await get(app, '/api/processes/missing/output');

      expect(response.status).toBe(404);
    });
  });
});
