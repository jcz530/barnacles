import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, generateKey } from '@backend/utils/encryption';

describe('Encryption Utility', () => {
  describe('generateKey', () => {
    it('should generate a 32-byte key', () => {
      const key = generateKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should generate unique keys', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      expect(key1.toString('hex')).not.toBe(key2.toString('hex'));
    });
  });

  describe('encrypt', () => {
    it('should encrypt a simple string', () => {
      const key = generateKey();
      const plaintext = 'my secret password';
      const encrypted = encrypt(plaintext, key);

      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(plaintext);
      // Encrypted format should be: iv:authTag:encrypted
      expect(encrypted.split(':')).toHaveLength(3);
    });

    it('should return empty string for empty input', () => {
      const key = generateKey();
      const encrypted = encrypt('', key);
      expect(encrypted).toBe('');
    });

    it('should produce different ciphertext for same plaintext (due to IV)', () => {
      const key = generateKey();
      const plaintext = 'same password';
      const encrypted1 = encrypt(plaintext, key);
      const encrypted2 = encrypt(plaintext, key);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw error for invalid key length', () => {
      const invalidKey = Buffer.from('tooshort');
      expect(() => encrypt('test', invalidKey)).toThrow('Encryption key must be 32 bytes');
    });

    it('should encrypt special characters and unicode', () => {
      const key = generateKey();
      const plaintext = 'pâ$$w0rd! 🔐 émojis';
      const encrypted = encrypt(plaintext, key);

      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(plaintext);
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted string back to original', () => {
      const key = generateKey();
      const plaintext = 'my secret password';
      const encrypted = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should return empty string for empty input', () => {
      const key = generateKey();
      const decrypted = decrypt('', key);
      expect(decrypted).toBe('');
    });

    it('should decrypt special characters and unicode correctly', () => {
      const key = generateKey();
      const plaintext = 'pâ$$w0rd! 🔐 émojis';
      const encrypted = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error when decrypting with wrong key', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      const plaintext = 'secret';
      const encrypted = encrypt(plaintext, key1);

      expect(() => decrypt(encrypted, key2)).toThrow();
    });

    it('should throw error for invalid encrypted data format', () => {
      const key = generateKey();
      const invalidEncrypted = 'not:valid:encrypted:data';

      expect(() => decrypt(invalidEncrypted, key)).toThrow('Invalid encrypted data format');
    });

    it('should throw error for malformed encrypted data', () => {
      const key = generateKey();
      const invalidEncrypted = 'invalid:data';

      expect(() => decrypt(invalidEncrypted, key)).toThrow('Invalid encrypted data format');
    });

    it('should throw error for corrupted ciphertext', () => {
      const key = generateKey();
      const plaintext = 'secret';
      const encrypted = encrypt(plaintext, key);
      // Corrupt the ciphertext part
      const [iv, authTag] = encrypted.split(':');
      const corruptedEncrypted = `${iv}:${authTag}:corrupted`;

      expect(() => decrypt(corruptedEncrypted, key)).toThrow();
    });

    it('should throw error for invalid key length', () => {
      const invalidKey = Buffer.from('tooshort');
      const validKey = generateKey();
      const encrypted = encrypt('test', validKey);

      expect(() => decrypt(encrypted, invalidKey)).toThrow('Encryption key must be 32 bytes');
    });
  });

  describe('encrypt/decrypt round trip', () => {
    it('should handle long strings', () => {
      const key = generateKey();
      const plaintext = 'a'.repeat(10000);
      const encrypted = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle newlines and special whitespace', () => {
      const key = generateKey();
      const plaintext = 'line1\nline2\r\nline3\ttab';
      const encrypted = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle JSON strings', () => {
      const key = generateKey();
      const plaintext = JSON.stringify({ user: 'admin', pass: 'secret123' });
      const encrypted = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key);

      expect(decrypted).toBe(plaintext);
      expect(JSON.parse(decrypted)).toEqual({ user: 'admin', pass: 'secret123' });
    });
  });
});
