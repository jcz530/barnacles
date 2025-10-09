import { setupAPIBridge } from './api-bridge';
import { setupShellBridge } from './shell-bridge';

export const setupIPC = (): void => {
  setupAPIBridge();
  setupShellBridge();

  // Add more IPC handlers here as needed
  console.log('🔌 IPC handlers registered');
};
