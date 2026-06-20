import { Hono } from 'hono';
import { exec } from 'child_process';
import { promisify } from 'util';
import { isMac, isLinux, isWindows } from '../../shared/utils/platform';
import type { PortEntry } from '../../shared/types/api';
import { getByFileName } from '../services/port-screenshot-cache-service';
import { projectPackageService } from '../services/project/project-package-service';

const execAsync = promisify(exec);

const ports = new Hono();

// Strips a leading `cross-env` wrapper and/or `VAR=value` env assignments so the
// remaining command can be compared against a process's resolved argv (which won't
// include the env-setting wrapper, only the program it ultimately invokes).
function stripLeadingEnvAssignments(command: string): string {
  let result = command.trim();
  if (result.startsWith('cross-env ')) {
    result = result.slice('cross-env '.length).trim();
  }
  return result.replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)+/, '').trim();
}

async function attachScriptNames(entries: PortEntry[]): Promise<void> {
  const uniqueCwds = [...new Set(entries.map(e => e.cwd).filter((c): c is string => !!c))];
  if (uniqueCwds.length === 0) return;

  const scriptsByCwd = new Map<string, Record<string, string>>();
  await Promise.all(
    uniqueCwds.map(async cwd => {
      scriptsByCwd.set(cwd, await projectPackageService.getPackageScripts(cwd));
    })
  );

  for (const entry of entries) {
    if (!entry.cwd || !entry.command) continue;
    const scripts = scriptsByCwd.get(entry.cwd);
    if (!scripts) continue;

    const command = stripLeadingEnvAssignments(entry.command);
    let bestMatch: { name: string; length: number } | undefined;
    for (const [name, scriptCommand] of Object.entries(scripts)) {
      const normalizedScript = stripLeadingEnvAssignments(scriptCommand);
      if (!normalizedScript || !command.includes(normalizedScript)) continue;
      if (!bestMatch || normalizedScript.length > bestMatch.length) {
        bestMatch = { name, length: normalizedScript.length };
      }
    }
    if (bestMatch) entry.scriptName = bestMatch.name;
  }
}

async function getCwdMap(pids: number[]): Promise<Map<number, string>> {
  const cwdMap = new Map<number, string>();
  if (pids.length === 0) return cwdMap;

  try {
    const pidList = pids.join(',');
    const { stdout } = await execAsync(`lsof -p "${pidList}" -a -d cwd -F pcn`);
    // Output is line-per-field: p<pid>, c<cmd>, fcwd, n<path>
    let currentPid = -1;
    for (const line of stdout.trim().split('\n')) {
      if (line.startsWith('p')) {
        currentPid = parseInt(line.slice(1), 10);
      } else if (line.startsWith('n') && currentPid !== -1) {
        cwdMap.set(currentPid, line.slice(1));
        currentPid = -1;
      }
    }
  } catch {
    // cwd lookup is best-effort
  }

  return cwdMap;
}

async function getProcessInfoMap(
  pids: number[]
): Promise<Map<number, { startedAt?: string; command?: string }>> {
  const infoMap = new Map<number, { startedAt?: string; command?: string }>();
  if (pids.length === 0) return infoMap;

  try {
    const pidList = pids.join(',');
    const { stdout } = await execAsync(`ps -p "${pidList}" -o pid=,lstart=,command=`);
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue;
      const match = line.match(/^\s*(\d+)\s+(\w+\s+\w+\s+\d+\s+\d+:\d+:\d+\s+\d+)\s+(.*)$/);
      if (!match) continue;
      const [, pidStr, lstart, command] = match;
      const pid = parseInt(pidStr, 10);
      const startedAt = new Date(lstart).toISOString();
      infoMap.set(pid, { startedAt, command: command.trim() });
    }
  } catch {
    // ps lookup is best-effort
  }

  return infoMap;
}

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

  // Fetch cwds and process info (start time, command) for all unique PIDs
  const uniquePids = [...new Set(results.map(r => r.pid))];
  const [cwdMap, processInfoMap] = await Promise.all([
    getCwdMap(uniquePids),
    getProcessInfoMap(uniquePids),
  ]);
  for (const entry of results) {
    const cwd = cwdMap.get(entry.pid);
    if (cwd) entry.cwd = cwd;
    const info = processInfoMap.get(entry.pid);
    if (info?.startedAt) entry.startedAt = info.startedAt;
    if (info?.command) entry.command = info.command;
  }

  // lsof can emit multiple rows for the same pid+port (e.g. IPv4 and IPv6 sockets)
  const seen = new Set<string>();
  return results.filter(entry => {
    const key = `${entry.pid}:${entry.port}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getPortsWindows(): Promise<PortEntry[]> {
  // Build PID -> { name, startedAt, command } map from wmic
  const pidToName = new Map<number, string>();
  const pidToInfo = new Map<number, { startedAt?: string; command?: string }>();
  try {
    const { stdout: wmicOut } = await execAsync(
      'wmic process get ProcessId,Name,CreationDate,CommandLine /format:csv'
    );
    for (const line of wmicOut.trim().split('\n').slice(1)) {
      const parts = line.trim().split(',');
      if (parts.length < 5) continue;
      const commandLine = parts[1]?.trim();
      const creationDate = parts[2]?.trim();
      const name = parts[3]?.trim();
      const pid = parseInt(parts[4]?.trim(), 10);
      if (name && !isNaN(pid)) pidToName.set(pid, name);
      // wmic CreationDate format: yyyymmddHHMMSS.ffffff+UUU
      const dateMatch = creationDate?.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
      const startedAt = dateMatch
        ? new Date(
            `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${dateMatch[4]}:${dateMatch[5]}:${dateMatch[6]}`
          ).toISOString()
        : undefined;
      if (!isNaN(pid) && (startedAt || commandLine)) {
        pidToInfo.set(pid, { startedAt, command: commandLine || undefined });
      }
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
    const info = pidToInfo.get(pid);
    results.push({
      pid,
      port,
      protocol: 'TCP',
      processName,
      state: 'LISTEN',
      startedAt: info?.startedAt,
      command: info?.command,
    });
  }

  const seen = new Set<string>();
  return results.filter(entry => {
    const key = `${entry.pid}:${entry.port}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

    await attachScriptNames(data);

    return c.json({ data });
  } catch {
    // lsof/netstat unavailable or permission issue — return empty list gracefully
    return c.json({ data: [] });
  }
});

/**
 * GET /api/ports/screenshot/:fileName
 * Serve a cached screenshot thumbnail by its cache file name
 */
ports.get('/screenshot/:fileName', async c => {
  const fileName = c.req.param('fileName');

  if (!/^[a-f0-9]+\.jpg$/.test(fileName)) {
    return c.json({ error: 'Invalid file name' }, 400);
  }

  const data = await getByFileName(fileName);
  if (!data) {
    return c.json({ error: 'Screenshot not found' }, 404);
  }

  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
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
