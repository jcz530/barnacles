import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Configuration constants
const DIG_TIMEOUT_MS = 3000;
const CURL_REQUEST_TIMEOUT_MS = 5000;
const CURL_PROCESS_TIMEOUT_MS = 6000;

const PUBLIC_IP_SERVICES = [
  'https://api.ipify.org',
  'https://icanhazip.com',
  'https://ifconfig.me/ip',
] as const;

export interface NetworkInterface {
  name: string;
  address: string;
  family: 'IPv4' | 'IPv6';
  internal: boolean;
}

export interface IpInfo {
  publicIp?: string;
  hostname: string;
  localIpv4: string[];
  localIpv6: string[];
  interfaces: NetworkInterface[];
}

/**
 * Gets local IP information from the system
 */
export function getLocalIpInfo(): Omit<IpInfo, 'publicIp'> {
  const hostname = os.hostname();
  const networkInterfaces = os.networkInterfaces();

  const interfaces: NetworkInterface[] = [];
  const localIpv4: string[] = [];
  const localIpv6: string[] = [];

  for (const [name, addresses] of Object.entries(networkInterfaces)) {
    if (!addresses) continue;

    for (const addr of addresses) {
      const iface: NetworkInterface = {
        name,
        address: addr.address,
        family: addr.family as 'IPv4' | 'IPv6',
        internal: addr.internal,
      };

      interfaces.push(iface);

      // Only collect non-internal (external) addresses for the main lists
      if (!addr.internal) {
        if (addr.family === 'IPv4') {
          localIpv4.push(addr.address);
        } else if (addr.family === 'IPv6') {
          localIpv6.push(addr.address);
        }
      }
    }
  }

  return {
    hostname,
    localIpv4,
    localIpv6,
    interfaces,
  };
}

/**
 * Validates if a string is a valid IPv4 address
 */
function isValidIpv4(ip: string): boolean {
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Pattern.test(ip)) return false;

  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

/**
 * Attempt to get public IP using dig command (DNS-based, most reliable)
 * Note: May be blocked by firewalls, VPNs, or corporate networks
 */
async function getPublicIpViaDig(): Promise<string> {
  const { stdout } = await execAsync('dig +short myip.opendns.com @resolver1.opendns.com', {
    timeout: DIG_TIMEOUT_MS,
  });
  return stdout.trim();
}

/**
 * Attempt to get public IP using curl (HTTP-based fallback)
 * This works when DNS port 53 is blocked
 */
async function getPublicIpViaCurl(): Promise<string> {
  for (const service of PUBLIC_IP_SERVICES) {
    try {
      const { stdout } = await execAsync(
        `curl -s --max-time ${CURL_REQUEST_TIMEOUT_MS / 1000} ${service}`,
        { timeout: CURL_PROCESS_TIMEOUT_MS }
      );
      const ip = stdout.trim();
      if (ip && isValidIpv4(ip)) {
        return ip;
      }
    } catch (error) {
      console.warn(`Failed to fetch from ${service}:`, error);
    }
  }

  throw new Error('All public IP services failed');
}

/**
 * Fetches public IP address using local system commands
 * Tries dig first (DNS-based), then falls back to curl (HTTP-based)
 */
export async function getPublicIp(): Promise<string> {
  // Try dig first (uses DNS, more reliable and faster)
  try {
    const ip = await getPublicIpViaDig();
    if (ip && isValidIpv4(ip)) {
      return ip;
    }
  } catch (error) {
    console.warn('dig command failed:', error);
  }

  // Fallback to curl with external APIs
  try {
    const ip = await getPublicIpViaCurl();
    if (ip && isValidIpv4(ip)) {
      return ip;
    }
  } catch (error) {
    console.warn('curl command failed:', error);
  }

  throw new Error('Unable to fetch public IP address using any method');
}

/**
 * Gets complete IP information including public and local IPs
 */
export async function getCompleteIpInfo(): Promise<IpInfo> {
  const localInfo = getLocalIpInfo();

  let publicIp: string | undefined;
  try {
    publicIp = await getPublicIp();
  } catch (error) {
    // Public IP is optional, continue without it
    console.warn('Could not fetch public IP:', error);
  }

  return {
    ...localInfo,
    publicIp,
  };
}
