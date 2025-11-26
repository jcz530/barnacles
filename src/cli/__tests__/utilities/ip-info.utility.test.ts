import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ipInfoCli } from '@cli/utilities/ip-info';
import * as ipInfoModule from '@shared/utilities/ip-info';
import * as prompts from '@clack/prompts';

// Mock clack prompts
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  log: {
    error: vi.fn(),
  },
}));

// Mock branding
vi.mock('@cli/utils/branding', () => ({
  compactLogo: 'BARNACLES',
}));

describe('IP Info CLI Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('metadata', () => {
    it('should have correct id, name, and description', () => {
      expect(ipInfoCli.id).toBe('ip');
      expect(ipInfoCli.name).toBe('IP Address Info');
      expect(ipInfoCli.description).toContain('public IP');
      expect(ipInfoCli.description).toContain('local IPs');
    });

    it('should have handler with execute function', () => {
      expect(ipInfoCli.handler).toBeDefined();
      expect(typeof ipInfoCli.handler.execute).toBe('function');
    });

    it('should have help text and examples', () => {
      expect(ipInfoCli.handler.helpText).toBeDefined();
      expect(ipInfoCli.handler.examples).toBeDefined();
      expect(Array.isArray(ipInfoCli.handler.examples)).toBe(true);
      expect(ipInfoCli.handler.examples?.length).toBeGreaterThan(0);
    });
  });

  describe('execute', () => {
    it('should execute successfully with complete IP info', async () => {
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

      await expect(ipInfoCli.handler.execute()).resolves.toBeUndefined();

      expect(prompts.intro).toHaveBeenCalledWith(expect.stringContaining('IP Address Information'));
      expect(prompts.outro).toHaveBeenCalledWith('Done!');
    });

    it('should handle missing public IP gracefully', async () => {
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

      await expect(ipInfoCli.handler.execute()).resolves.toBeUndefined();

      expect(prompts.outro).toHaveBeenCalledWith('Done!');
    });

    it('should handle errors and display failure message', async () => {
      vi.spyOn(ipInfoModule, 'getCompleteIpInfo').mockRejectedValue(new Error('Network error'));

      await expect(ipInfoCli.handler.execute()).resolves.toBeUndefined();

      expect(prompts.outro).toHaveBeenCalledWith('Failed to retrieve IP information');
    });

    it('should display empty lists when no external IPs exist', async () => {
      const mockIpInfo = {
        publicIp: '203.0.113.1',
        hostname: 'test-machine',
        localIpv4: [],
        localIpv6: [],
        interfaces: [
          {
            name: 'lo0',
            address: '127.0.0.1',
            family: 'IPv4' as const,
            internal: true,
          },
        ],
      };

      vi.spyOn(ipInfoModule, 'getCompleteIpInfo').mockResolvedValue(mockIpInfo);

      await expect(ipInfoCli.handler.execute()).resolves.toBeUndefined();

      expect(prompts.outro).toHaveBeenCalledWith('Done!');
    });

    it('should display both IPv4 and IPv6 addresses', async () => {
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

      await expect(ipInfoCli.handler.execute()).resolves.toBeUndefined();

      expect(prompts.outro).toHaveBeenCalledWith('Done!');
    });

    it('should show network interfaces with internal/external badges', async () => {
      const mockIpInfo = {
        publicIp: '203.0.113.1',
        hostname: 'test-machine.local',
        localIpv4: ['192.168.1.100'],
        localIpv6: [],
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
          {
            name: 'utun0',
            address: '10.8.0.1',
            family: 'IPv4' as const,
            internal: false,
          },
        ],
      };

      vi.spyOn(ipInfoModule, 'getCompleteIpInfo').mockResolvedValue(mockIpInfo);

      await expect(ipInfoCli.handler.execute()).resolves.toBeUndefined();

      expect(prompts.outro).toHaveBeenCalledWith('Done!');
    });
  });
});
