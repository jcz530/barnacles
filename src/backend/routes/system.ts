import { Hono } from 'hono';
import os from 'os';
import { promises as fs } from 'fs';
import path from 'path';

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
 * GET /api/system/directories/search
 * Search for directories under user's home folder that match a query
 * Query params:
 * - query: string to match directory names against
 * - maxDepth: optional max depth to search (default 3)
 */
system.get('/directories/search', async c => {
  try {
    const query = c.req.query('query')?.toLowerCase() || '';
    const maxDepth = parseInt(c.req.query('maxDepth') || '3', 10);

    if (!query || query.length < 1) {
      return c.json({ data: [] });
    }

    const homeDir = os.homedir();
    const matchedDirectories: string[] = [];
    const MAX_RESULTS = 20;

    // Handle tilde expansion and determine search path
    let searchPath = homeDir;
    let searchQuery = rawQuery.toLowerCase();

    if (rawQuery.startsWith('~')) {
      // Expand tilde to home directory
      const expandedPath = expandTilde(rawQuery);
      const resolvedPath = path.resolve(expandedPath);

      // Check if the path is a complete directory path
      let foundValidDirectory = false;
      try {
        const stat = await fs.stat(resolvedPath);
        if (stat.isDirectory()) {
          // If it's a valid directory, search within it
          searchPath = resolvedPath;
          searchQuery = ''; // Empty query to list all subdirectories
          foundValidDirectory = true;
        }
      } catch {
        // Path doesn't exist or is not a directory, treat as partial path
      }

      // If we haven't found a valid directory, try using parent directory
      if (!foundValidDirectory) {
        const dirname = path.dirname(resolvedPath);
        const basename = path.basename(resolvedPath);
        try {
          const dirStat = await fs.stat(dirname);
          if (dirStat.isDirectory()) {
            searchPath = dirname;
            searchQuery = basename.toLowerCase();
          }
        } catch {
          // Parent directory doesn't exist, fall back to searching from home
          searchPath = homeDir;
          searchQuery = rawQuery.toLowerCase();
        }
      }
    }

    // Recursive function to search directories
    async function searchDir(dir: string, currentDepth: number): Promise<void> {
      if (currentDepth > maxDepth || matchedDirectories.length >= MAX_RESULTS) {
        return;
      }

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (matchedDirectories.length >= MAX_RESULTS) {
            return;
          }

          if (!entry.isDirectory()) {
            continue;
          }

          // Skip hidden directories and common system directories
          const name = entry.name;
          if (
            name.startsWith('.') ||
            name === 'node_modules' ||
            name === 'vendor' ||
            name === 'Library' ||
            name === 'System' ||
            name === 'Applications' ||
            name === 'Volumes'
          ) {
            continue;
          }

          const fullPath = path.join(dir, name);

          // Check if directory name matches query
          if (name.toLowerCase().includes(query)) {
            // Convert absolute path to use ~ for home directory
            const displayPath = fullPath.replace(homeDir, '~');
            matchedDirectories.push(displayPath);
          }

          // Recursively search subdirectories
          if (currentDepth < maxDepth) {
            try {
              await searchDir(fullPath, currentDepth + 1);
            } catch (err) {
              // Skip directories we don't have permission to read
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
        return;
      }
    }

    // Start search from home directory
    await searchDir(homeDir, 0);

    return c.json({
      data: matchedDirectories.sort(),
    });
  } catch (error) {
    console.error('Error searching directories:', error);
    return c.json(
      {
        error: 'Failed to search directories',
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

    // Build new content preserving comments (but skip our custom marker)
    const commentLines: string[] = [];
    const customMarker = '# Custom local domains managed by Barnacles';

    for (const line of lines) {
      const trimmed = line.trim();
      // Keep comments and empty lines, but skip our custom marker to avoid duplicates
      if ((!trimmed || trimmed.startsWith('#')) && trimmed !== customMarker) {
        commentLines.push(line);
      }
    }

    // Build new hosts content
    let newContent = commentLines.join('\n');
    if (newContent && !newContent.endsWith('\n')) {
      newContent += '\n';
    }

    // Add custom hosts section marker
    newContent += `\n${customMarker}\n`;

    // Write each host entry on its own line
    for (const host of hosts) {
      newContent += `${host.ip}\t${host.hostname}\n`;
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
        await execAsync(`osascript -e '${script}'`);
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
