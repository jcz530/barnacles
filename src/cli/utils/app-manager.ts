import { exec } from 'child_process';
import { promisify } from 'util';
import { setTimeout as setTimeoutPromise } from 'timers/promises';
import { APP_CONFIG } from '../../shared/constants/index.js';

const execAsync = promisify(exec);

// Try ports from 51000-51010 (same range the backend uses)
const POSSIBLE_PORTS = Array.from({ length: 11 }, (_, i) => APP_CONFIG.API_PORT_PREFERRED + i);

/**
 * Check if the backend is running on a specific URL
 */
async function checkBackendUrl(url: string): Promise<boolean> {
  try {
    // Use race between fetch and timeout
    const fetchPromise = fetch(`${url}/api/health`);
    const timeoutPromise = setTimeoutPromise(1000).then(() => {
      throw new Error('Timeout');
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Find which port the backend is running on
 */
async function findBackendPort(): Promise<number | null> {
  // Check ports in parallel for speed
  const checks = POSSIBLE_PORTS.map(async port => {
    const url = `http://localhost:${port}`;
    const isRunning = await checkBackendUrl(url);
    return isRunning ? port : null;
  });

  const results = await Promise.all(checks);
  return results.find(port => port !== null) ?? null;
}

/**
 * Check if the Barnacles backend API is running
 */
export async function isBackendRunning(): Promise<boolean> {
  const port = await findBackendPort();
  return port !== null;
}

/**
 * Get the backend API URL, checking if it's available
 */
export async function getBackendUrl(): Promise<string | null> {
  const port = await findBackendPort();
  return port ? `http://localhost:${port}` : null;
}

/**
 * Launch the Barnacles Electron app
 */
export async function launchBarnacles(): Promise<void> {
  try {
    // Use 'open' command on macOS to launch the app in the background
    if (process.platform === 'darwin') {
      await execAsync('open -a Barnacles');
    } else if (process.platform === 'win32') {
      await execAsync('start barnacles');
    } else {
      // Linux
      await execAsync('barnacles &');
    }
  } catch (error) {
    throw new Error(
      `Failed to launch Barnacles app: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Wait for the backend API to become available
 */
export async function waitForBackend(timeoutMs: number = 10000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await isBackendRunning()) {
      return true;
    }
    // Wait 500ms before checking again
    await setTimeoutPromise(500);
  }

  return false;
}

/**
 * Ensure the Barnacles backend is running, launching it if necessary
 * Returns the backend URL if successful, null if failed
 */
export async function ensureBackendRunning(): Promise<string | null> {
  // Check if already running
  const existingUrl = await getBackendUrl();
  if (existingUrl) {
    return existingUrl;
  }

  // Not running, try to launch it
  try {
    await launchBarnacles();

    // Wait for backend to start (up to 10 seconds)
    const isReady = await waitForBackend(10000);

    if (isReady) {
      return await getBackendUrl();
    }

    return null;
  } catch (error) {
    console.error('Failed to start Barnacles:', error);
    return null;
  }
}
