import { beforeEach, describe, expect, it, vi } from 'vitest';
// Now import the module we're testing
import { getLocalIpInfo } from '@shared/utilities/ip-info';

// Use vi.hoisted to create mocks that can be referenced in vi.mock factory
const { mockHostname, mockNetworkInterfaces } = vi.hoisted(() => ({
  mockHostname: vi.fn(),
  mockNetworkInterfaces: vi.fn(),
}));

vi.mock('os', () => ({
  default: {
    hostname: mockHostname,
    networkInterfaces: mockNetworkInterfaces,
  },
  hostname: mockHostname,
  networkInterfaces: mockNetworkInterfaces,
}));

describe('IP Info Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLocalIpInfo', () => {
    it('should return local IP information', () => {
      mockHostname.mockReturnValue('test-machine.local');
      mockNetworkInterfaces.mockReturnValue({
        lo0: [
          {
            address: '127.0.0.1',
            netmask: '255.0.0.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: true,
            cidr: '127.0.0.1/8',
          },
        ],
        en0: [
          {
            address: '192.168.1.100',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: 'ac:de:48:00:11:22',
            internal: false,
            cidr: '192.168.1.100/24',
          },
          {
            address: 'fe80::aede:48ff:fe00:1122',
            netmask: 'ffff:ffff:ffff:ffff::',
            family: 'IPv6',
            mac: 'ac:de:48:00:11:22',
            internal: false,
            scopeid: 4,
            cidr: 'fe80::aede:48ff:fe00:1122/64',
          },
        ],
      });

      const result = getLocalIpInfo();

      expect(result.hostname).toBe('test-machine.local');
      expect(result.localIpv4).toEqual(['192.168.1.100']);
      expect(result.localIpv6).toEqual(['fe80::aede:48ff:fe00:1122']);
      expect(result.interfaces).toHaveLength(3);
    });

    it('should filter out internal addresses from main lists', () => {
      mockHostname.mockReturnValue('test-machine');
      mockNetworkInterfaces.mockReturnValue({
        lo0: [
          {
            address: '127.0.0.1',
            netmask: '255.0.0.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: true,
            cidr: '127.0.0.1/8',
          },
        ],
        en0: [
          {
            address: '192.168.1.5',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: 'ac:de:48:00:11:22',
            internal: false,
            cidr: '192.168.1.5/24',
          },
        ],
      });

      const result = getLocalIpInfo();

      // Loopback should not be in localIpv4 list
      expect(result.localIpv4).not.toContain('127.0.0.1');
      expect(result.localIpv4).toContain('192.168.1.5');

      // But loopback should still be in interfaces list
      expect(result.interfaces).toHaveLength(2);
      expect(result.interfaces.some(iface => iface.address === '127.0.0.1')).toBe(true);
    });

    it('should handle empty network interfaces', () => {
      mockHostname.mockReturnValue('test-machine');
      mockNetworkInterfaces.mockReturnValue({});

      const result = getLocalIpInfo();

      expect(result.hostname).toBe('test-machine');
      expect(result.localIpv4).toEqual([]);
      expect(result.localIpv6).toEqual([]);
      expect(result.interfaces).toEqual([]);
    });

    it('should handle interfaces with undefined addresses', () => {
      mockHostname.mockReturnValue('test-machine');
      mockNetworkInterfaces.mockReturnValue({
        en0: undefined,
        en1: [
          {
            address: '192.168.1.10',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: 'ac:de:48:00:11:22',
            internal: false,
            cidr: '192.168.1.10/24',
          },
        ],
      });

      const result = getLocalIpInfo();

      expect(result.interfaces).toHaveLength(1);
      expect(result.localIpv4).toEqual(['192.168.1.10']);
    });

    it('should correctly categorize IPv4 and IPv6 addresses', () => {
      mockHostname.mockReturnValue('test-machine');
      mockNetworkInterfaces.mockReturnValue({
        en0: [
          {
            address: '192.168.1.5',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: 'ac:de:48:00:11:22',
            internal: false,
            cidr: '192.168.1.5/24',
          },
          {
            address: 'fe80::1',
            netmask: 'ffff:ffff:ffff:ffff::',
            family: 'IPv6',
            mac: 'ac:de:48:00:11:22',
            internal: false,
            scopeid: 4,
            cidr: 'fe80::1/64',
          },
        ],
      });

      const result = getLocalIpInfo();

      expect(result.localIpv4).toEqual(['192.168.1.5']);
      expect(result.localIpv6).toEqual(['fe80::1']);

      // Check interface family types
      const ipv4Interface = result.interfaces.find(i => i.family === 'IPv4');
      const ipv6Interface = result.interfaces.find(i => i.family === 'IPv6');

      expect(ipv4Interface).toBeDefined();
      expect(ipv6Interface).toBeDefined();
      expect(ipv4Interface?.address).toBe('192.168.1.5');
      expect(ipv6Interface?.address).toBe('fe80::1');
    });
  });
});
