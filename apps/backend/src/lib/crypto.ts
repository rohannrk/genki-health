import crypto from 'crypto';
import { env } from '../env';

const getKeyBuffer = (): Buffer => {
  // Pad or slice the key to ensure it is exactly 32 bytes for AES-256
  return Buffer.from(env.ENCRYPTION_KEY.padEnd(32).slice(0, 32));
};

/**
 * Encrypts a text using AES-256-GCM.
 * Returns a colon-separated string: hex(iv):hex(tag):hex(ciphertext).
 */
export const encrypt = (text: string): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKeyBuffer(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
};

/**
 * Decrypts a colon-separated ciphertext string (iv:tag:ciphertext) using AES-256-GCM.
 */
export const decrypt = (encryptedText: string): string => {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = Buffer.from(parts[2], 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', getKeyBuffer(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
};
