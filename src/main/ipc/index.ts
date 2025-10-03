import { setupAPIBridge } from './api-bridge';

export const setupIPC = (): void => {
  setupAPIBridge();

  // Add more IPC handlers here as needed
  console.log('🔌 IPC handlers registered');
};
