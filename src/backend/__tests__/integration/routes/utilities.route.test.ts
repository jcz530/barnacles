import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIntegrationTestContext } from '@test/contexts';
import { get } from '@test/helpers/api-client';
import utilities from '@backend/routes/utilities';
import * as ipInfoModule from '@shared/utilities/ip-info';

describe('Utilities API Integration Tests', () => {
  const context = createIntegrationTestContext();

  beforeEach(async () => {
    await context.setup(async () => {
      const { Hono } = await import('hono');
      const { errorHandler } = await import('@backend/middleware/error-handler');
      const app = new Hono();
      app.onError(errorHandler);
      app.route('/api/utilities', utilities);
      return app;
    });
  });

  afterEach(async () => {
    await context.teardown();
    vi.restoreAllMocks();
  });

  describe('GET /api/utilities', () => {
    it('should return empty array for utilities list', async () => {
      const { app } = context.get();
      const response = await get(app, '/api/utilities');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      expect((response.data as any).data).toEqual([]);
    });
  });

  describe('GET /api/utilities/ip-info', () => {
    it('should return IP information successfully', async () => {
      const { app } = context.get();

      // Mock getCompleteIpInfo to return test data
      const mockIpInfo = {
        publicIp: '203.0.113.1',
        hostname: 'test-machine.local',
        localIpv4: ['192.168.1.100'],
        localIpv6: ['fe80::1'],
        interfaces: [
          {
            name: 'lo0',
            address: '127.0.0.1',
            family: 'IPv4' as const,
            internal: true,
          },
          {
            name: 'en0',
            address: '192.168.1.100',
            family: 'IPv4' as const,
            internal: false,
          },
        ],
      };

      vi.spyOn(ipInfoModule, 'getCompleteIpInfo').mockResolvedValue(mockIpInfo);

      const response = await get(app, '/api/utilities/ip-info');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');

      const data = (response.data as any).data;
      expect(data.publicIp).toBe('203.0.113.1');
      expect(data.hostname).toBe('test-machine.local');
      expect(data.localIpv4).toEqual(['192.168.1.100']);
      expect(data.localIpv6).toEqual(['fe80::1']);
      expect(data.interfaces).toHaveLength(2);
    });

    it('should handle missing public IP gracefully', async () => {
      const { app } = context.get();

      // Mock IP info without public IP
      const mockIpInfo = {
        publicIp: undefined,
        hostname: 'test-machine.local',
        localIpv4: ['192.168.1.100'],
        localIpv6: [],
        interfaces: [
          {
            name: 'en0',
            address: '192.168.1.100',
            family: 'IPv4' as const,
            internal: false,
          },
        ],
      };

      vi.spyOn(ipInfoModule, 'getCompleteIpInfo').mockResolvedValue(mockIpInfo);

      const response = await get(app, '/api/utilities/ip-info');

      expect(response.status).toBe(200);
      const data = (response.data as any).data;
      expect(data.publicIp).toBeUndefined();
      expect(data.hostname).toBe('test-machine.local');
    });

    it('should return 500 when IP info retrieval fails', async () => {
      const { app } = context.get();

      // Mock getCompleteIpInfo to throw error
      vi.spyOn(ipInfoModule, 'getCompleteIpInfo').mockRejectedValue(new Error('Network error'));

      const response = await get(app, '/api/utilities/ip-info');

      expect(response.status).toBe(500);
      expect(response.data).toHaveProperty('error');
      expect((response.data as any).error).toBe('Failed to fetch IP information');
    });

    it('should return empty arrays when no network interfaces exist', async () => {
      const { app } = context.get();

      const mockIpInfo = {
        publicIp: '203.0.113.1',
        hostname: 'test-machine',
        localIpv4: [],
        localIpv6: [],
        interfaces: [],
      };

      vi.spyOn(ipInfoModule, 'getCompleteIpInfo').mockResolvedValue(mockIpInfo);

      const response = await get(app, '/api/utilities/ip-info');

      expect(response.status).toBe(200);
      const data = (response.data as any).data;
      expect(data.localIpv4).toEqual([]);
      expect(data.localIpv6).toEqual([]);
      expect(data.interfaces).toEqual([]);
    });

    it('should include both IPv4 and IPv6 addresses', async () => {
      const { app } = context.get();

      const mockIpInfo = {
        publicIp: '203.0.113.1',
        hostname: 'test-machine.local',
        localIpv4: ['192.168.1.5', '10.0.0.5'],
        localIpv6: ['fe80::1', '2001:db8::1'],
        interfaces: [
          {
            name: 'en0',
            address: '192.168.1.5',
            family: 'IPv4' as const,
            internal: false,
          },
          {
            name: 'en0',
            address: 'fe80::1',
            family: 'IPv6' as const,
            internal: false,
          },
        ],
      };

      vi.spyOn(ipInfoModule, 'getCompleteIpInfo').mockResolvedValue(mockIpInfo);

      const response = await get(app, '/api/utilities/ip-info');

      expect(response.status).toBe(200);
      const data = (response.data as any).data;
      expect(data.localIpv4).toHaveLength(2);
      expect(data.localIpv6).toHaveLength(2);
    });
  });

  describe('POST /api/utilities/:utilityId/execute', () => {
    it('should return 501 Not Implemented', async () => {
      const { app } = context.get();

      const response = await app.request('/api/utilities/test-utility/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      });

      expect(response.status).toBe(501);
      const data = await response.json();
      expect(data.message).toBe('Not implemented yet');
    });
  });
});
