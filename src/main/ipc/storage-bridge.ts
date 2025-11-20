import { ipcMain } from 'electron';
import { getEncryptionKey } from '../../backend/utils/key-manager';

export const setupStorageBridge = (): void => {
  // Handler for getting the encryption key
  ipcMain.handle('storage:get-encryption-key', async () => {
    try {
      const key = await getEncryptionKey();
      return { success: true, key: key.toString('hex') };
    } catch (error) {
      console.error('Failed to get encryption key:', error);
      return { success: false, error: String(error) };
    }
  });
};
