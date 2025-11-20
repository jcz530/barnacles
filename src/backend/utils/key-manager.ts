import { safeStorage } from 'electron';
import { settingsService } from '../services/settings-service';
import { randomBytes } from 'crypto';

const ENCRYPTION_KEY_SETTING = 'encryptionKey';
let cachedKey: Buffer | null = null;

/**
 * Get or generate the encryption key
 * Uses Electron's safeStorage to securely encrypt and store the key
 * Caches the key in memory for performance
 */
export async function getEncryptionKey(): Promise<Buffer> {
  // Return cached key if available
  if (cachedKey) {
    return cachedKey;
  }

  try {
    // Wait for safeStorage to be available (it's not available immediately on Linux)
    let attempts = 0;
    while (!safeStorage.isEncryptionAvailable() && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('SafeStorage is not available');
    }

    // Try to get existing key from settings
    const existingKey = await settingsService.getValue<string>(ENCRYPTION_KEY_SETTING);

    if (existingKey) {
      // Decrypt the stored key using safeStorage
      const encryptedBuffer = Buffer.from(existingKey, 'base64');
      const decryptedKey = safeStorage.decryptString(encryptedBuffer);
      cachedKey = Buffer.from(decryptedKey, 'hex');
      return cachedKey;
    }

    // Generate a new key if none exists
    const newKey = randomBytes(32); // 32 bytes for AES-256

    // Encrypt the key using safeStorage before storing
    const encryptedKey = safeStorage.encryptString(newKey.toString('hex'));
    const encryptedKeyBase64 = encryptedKey.toString('base64');

    // Store the encrypted key in settings
    await settingsService.setSetting(ENCRYPTION_KEY_SETTING, encryptedKeyBase64);

    cachedKey = newKey;
    return newKey;
  } catch (error) {
    console.error('Failed to get/generate encryption key:', error);
    throw error;
  }
}
