import { spawn } from 'child_process';

export async function openCommand(_flags: Record<string, string | boolean>): Promise<void> {
  console.log('Opening Barnacles...');

  if (process.platform === 'darwin') {
    // macOS: 'open -a' will launch if not running, or focus if already running
    spawn('open', ['-a', 'Barnacles'], {
      detached: true,
      stdio: 'ignore',
    }).unref();
  } else if (process.platform === 'win32') {
    // Windows: Try to launch via Start menu or AppData path
    const appName = 'Barnacles';
    spawn('cmd', ['/c', 'start', '', appName], {
      detached: true,
      stdio: 'ignore',
      shell: true,
    }).unref();
  } else {
    // Linux: Try common application launcher commands
    // Try xdg-open first (most universal), fall back to direct executable
    spawn('xdg-open', ['barnacles.desktop'], {
      detached: true,
      stdio: 'ignore',
    }).unref();
  }
}
