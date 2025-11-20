import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for AES
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM auth tag
const KEY_LENGTH = 32; // 32 bytes for AES-256

/**
 * Encrypts text using AES-256-GCM encryption
 * @param text The plaintext to encrypt
 * @param key The encryption key (32 bytes for AES-256)
 * @returns Encrypted string in format: iv:authTag:encrypted
 */
export function encrypt(text: string, key: Buffer): string {
  if (!text) {
    return '';
  }

  if (key.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH} bytes`);
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts text that was encrypted with the encrypt function
 * @param encryptedData The encrypted string in format: iv:authTag:encrypted
 * @param key The encryption key (32 bytes for AES-256)
 * @returns The decrypted plaintext
 */
export function decrypt(encryptedData: string, key: Buffer): string {
  if (!encryptedData) {
    return '';
  }

  if (key.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH} bytes`);
  }

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generates a random encryption key
 * @returns A 32-byte encryption key
 */
export function generateKey(): Buffer {
  return randomBytes(KEY_LENGTH);
}
