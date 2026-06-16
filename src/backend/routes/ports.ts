import { Hono } from 'hono';
import { exec } from 'child_process';
import { promisify } from 'util';
import { isMac, isLinux, isWindows } from '../../shared/utils/platform';
import type { PortEntry } from '../../shared/types/api';

const execAsync = promisify(exec);

const ports = new Hono();

async function getPortsUnix(): Promise<PortEntry[]> {
  const { stdout } = await execAsync('lsof -iTCP -sTCP:LISTEN -P -n');
  const lines = stdout.trim().split('\n').slice(1); // skip header
  const results: PortEntry[] = [];

  for (const line of lines) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 9) continue;
    const processName = cols[0];
    const pid = parseInt(cols[1], 10);
    // NAME column is at index 8, format: *:PORT or 127.0.0.1:PORT
    const nameCol = cols[8];
    const portMatch = nameCol.match(/:(\d+)$/);
    if (!portMatch || isNaN(pid)) continue;
    const port = parseInt(portMatch[1], 10);
    results.push({ pid, port, protocol: 'TCP', processName, state: 'LISTEN' });
  }

  return results;
}

async function getPortsWindows(): Promise<PortEntry[]> {
  // Build PID -> name map from wmic
  const pidToName = new Map<number, string>();
  try {
    const { stdout: wmicOut } = await execAsync('wmic process get ProcessId,Name /format:csv');
    for (const line of wmicOut.trim().split('\n').slice(1)) {
      const parts = line.trim().split(',');
      if (parts.length < 3) continue;
      const name = parts[1]?.trim();
      const pid = parseInt(parts[2]?.trim(), 10);
      if (name && !isNaN(pid)) pidToName.set(pid, name);
    }
  } catch {
    // wmic not available — continue without process names
  }

  const { stdout } = await execAsync('netstat -ano -p TCP');
  const results: PortEntry[] = [];

  for (const line of stdout.trim().split('\n')) {
    if (!line.includes('LISTENING')) continue;
    const cols = line.trim().split(/\s+/);
    if (cols.length < 5) continue;
    const localAddr = cols[1];
    const portMatch = localAddr.match(/:(\d+)$/);
    const pid = parseInt(cols[4], 10);
    if (!portMatch || isNaN(pid)) continue;
    const port = parseInt(portMatch[1], 10);
    const processName = pidToName.get(pid) || 'Unknown';
    results.push({ pid, port, protocol: 'TCP', processName, state: 'LISTEN' });
  }

  return results;
}

/**
 * GET /api/ports
 * List all TCP ports in LISTEN state on the local machine
 */
ports.get('/', async c => {
  try {
    let data: PortEntry[] = [];

    if (isMac || isLinux) {
      data = await getPortsUnix();
    } else if (isWindows) {
      data = await getPortsWindows();
    }

    return c.json({ data });
  } catch {
    // lsof/netstat unavailable or permission issue — return empty list gracefully
    return c.json({ data: [] });
  }
});

/**
 * DELETE /api/ports/:pid
 * Kill the process with the given PID
 */
ports.delete('/:pid', async c => {
  const pidParam = c.req.param('pid');
  const pid = parseInt(pidParam, 10);

  if (isNaN(pid) || String(pid) !== pidParam) {
    return c.json({ error: 'Invalid PID' }, 400);
  }

  try {
    process.kill(pid, 'SIGTERM');
    return c.json({ message: 'Process killed' });
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ESRCH') {
      return c.json({ error: 'Process not found' }, 404);
    }
    return c.json({ error: 'Failed to kill process' }, 500);
  }
});

export default ports;
