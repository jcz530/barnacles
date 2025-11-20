import { setupAPIBridge } from './api-bridge';
import { setupShellBridge } from './shell-bridge';
import { setupUpdaterBridge } from './updater-bridge';
import { setupWindowBridge } from './window-bridge';
import { setupCliBridge } from './cli-bridge';
import { setupFileSystemBridge } from './file-system-bridge';
import { setupClipboardBridge } from './clipboard-bridge';
import { setupStorageBridge } from './storage-bridge';

export const setupIPC = (): void => {
  setupAPIBridge();
  setupShellBridge();
  setupWindowBridge();
  setupUpdaterBridge();
  setupCliBridge();
  setupFileSystemBridge();
  setupClipboardBridge();
  setupStorageBridge();

  // Add more IPC handlers here as needed
  console.log('🔌 IPC handlers registered');
};
