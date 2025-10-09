import { Hono } from 'hono';
import os from 'os';

const system = new Hono();

/**
 * GET /api/system/hosts
 * Get all host entries from the system hosts file
 */
system.get('/hosts', async c => {
  try {
    const fs = await import('fs/promises');

    // Determine hosts file path based on OS
    const hostsPath =
      os.platform() === 'win32' ? 'C:\\Windows\\System32\\drivers\\etc\\hosts' : '/etc/hosts';

    // Read the hosts file
    const hostsContent = await fs.readFile(hostsPath, 'utf-8');

    // Parse hosts file - extract hostname and IP pairs
    const hosts: Array<{ ip: string; hostname: string }> = [];
    const lines = hostsContent.split('\n');

    for (const line of lines) {
      // Skip empty lines and comments
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Parse line: IP hostname [aliases...]
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const ip = parts[0];
        // Get all hostnames (skip IP)
        for (let i = 1; i < parts.length; i++) {
          const hostname = parts[i];
          // Skip inline comments
          if (hostname.startsWith('#')) break;

          hosts.push({
            ip,
            hostname,
          });
        }
      }
    }

    return c.json({
      data: hosts,
    });
  } catch (error) {
    console.error('Error reading hosts file:', error);
    return c.json(
      {
        error: 'Failed to read hosts file',
      },
      500
    );
  }
});

export default system;
