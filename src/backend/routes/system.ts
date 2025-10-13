import { Hono } from 'hono';
import os from 'os';

const system = new Hono();

// Helper to get hosts file path
function getHostsPath(): string {
  return os.platform() === 'win32' ? 'C:\\Windows\\System32\\drivers\\etc\\hosts' : '/etc/hosts';
}

/**
 * GET /api/system/hosts/path
 * Get the path to the system hosts file
 */
system.get('/hosts/path', async c => {
  return c.json({
    data: {
      path: getHostsPath(),
    },
  });
});

/**
 * GET /api/system/hosts
 * Get all host entries from the system hosts file
 */
system.get('/hosts', async c => {
  try {
    const fs = await import('fs/promises');

    // Determine hosts file path based on OS
    const hostsPath = getHostsPath();

    // Read the hosts file
    const hostsContent = await fs.readFile(hostsPath, 'utf-8');

    // Parse hosts file - extract hostname and IP pairs
    const hosts: Array<{ ip: string; hostname: string; id: string }> = [];
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
            id: `${ip}-${hostname}`,
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

/**
 * POST /api/system/hosts
 * Update the system hosts file with new entries
 */
system.post('/hosts', async c => {
  try {
    const fs = await import('fs/promises');
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const body = await c.req.json();
    const hosts: Array<{ ip: string; hostname: string }> = body.hosts;

    if (!Array.isArray(hosts)) {
      return c.json(
        {
          error: 'Invalid request body: hosts must be an array',
        },
        400
      );
    }

    // Validate hosts entries
    for (const host of hosts) {
      if (!host.ip || !host.hostname) {
        return c.json(
          {
            error: 'Invalid host entry: ip and hostname are required',
          },
          400
        );
      }

      // Basic IP validation (IPv4 and IPv6)
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

      if (!ipv4Regex.test(host.ip) && !ipv6Regex.test(host.ip)) {
        return c.json(
          {
            error: `Invalid IP address: ${host.ip}`,
          },
          400
        );
      }

      // Basic hostname validation
      if (!/^[a-zA-Z0-9]([a-zA-Z0-9-_.]*[a-zA-Z0-9])?$/.test(host.hostname)) {
        return c.json(
          {
            error: `Invalid hostname: ${host.hostname}`,
          },
          400
        );
      }
    }

    const hostsPath = getHostsPath();

    // Read existing hosts file to preserve comments and system entries
    const existingContent = await fs.readFile(hostsPath, 'utf-8');
    const lines = existingContent.split('\n');

    // Build new content preserving comments
    const commentLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Keep comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        commentLines.push(line);
      }
    }

    // Build new hosts content
    let newContent = commentLines.join('\n');
    if (newContent && !newContent.endsWith('\n')) {
      newContent += '\n';
    }

    // Add custom hosts section marker
    newContent += '\n# Custom local domains managed by Barnacles\n';

    // Group hosts by IP
    const hostsByIp = new Map<string, string[]>();
    for (const host of hosts) {
      if (!hostsByIp.has(host.ip)) {
        hostsByIp.set(host.ip, []);
      }
      hostsByIp.get(host.ip)?.push(host.hostname);
    }

    // Write grouped entries
    for (const [ip, hostnames] of hostsByIp) {
      newContent += `${ip}\t${hostnames.join(' ')}\n`;
    }

    // Write to a temporary file first (in /tmp which we have access to)
    const tmpPath = `/tmp/hosts-${Date.now()}.tmp`;
    await fs.writeFile(tmpPath, newContent, 'utf-8');

    // Use sudo to move the temp file to the hosts file location
    // This requires the user to have sudo privileges
    if (os.platform() === 'win32') {
      // On Windows, use copy command (may require admin privileges)
      await fs.copyFile(tmpPath, hostsPath);
      await fs.unlink(tmpPath);
    } else {
      // On Unix-like systems, use osascript to prompt for admin password
      try {
        // Use osascript on macOS to get GUI password prompt
        // Escape single quotes in paths and use proper shell escaping
        const escapedTmpPath = tmpPath.replace(/'/g, "'\\''");
        const escapedHostsPath = hostsPath.replace(/'/g, "'\\''");
        const script = `do shell script "mv '${escapedTmpPath}' '${escapedHostsPath}'" with administrator privileges`;

        //Executing osascript command to update hosts file...
        const result = await execAsync(`osascript -e '${script}'`);
      } catch (error) {
        console.error('Failed to update hosts file with osascript:', error);
        // If osascript fails (not macOS or user cancelled), clean up temp file
        try {
          await fs.unlink(tmpPath);
        } catch (unlinkError) {
          // Ignore cleanup errors
        }
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(
          `Failed to update hosts file. ${errorMsg}. Administrator privileges are required.`
        );
      }
    }

    return c.json({
      message: 'Hosts file updated successfully',
      data: hosts,
    });
  } catch (error) {
    return c.json(
      {
        error:
          'Failed to update hosts file. This operation requires administrator/sudo privileges.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default system;
