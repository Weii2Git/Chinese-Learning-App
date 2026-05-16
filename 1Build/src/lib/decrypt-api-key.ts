import { createDecipheriv, scryptSync } from "crypto";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

interface EncryptedPayload {
  algorithm: string;
  salt: string;
  iv: string;
  authTag: string;
  encrypted: string;
}

/**
 * Decrypt the Gemini API key from .env.encrypted using the password
 * from the GEMINI_KEY_PASSWORD environment variable.
 *
 * Returns null if the encrypted file doesn't exist or password is not set.
 * Throws if decryption fails (wrong password).
 */
export function decryptApiKey(): string | null {
  const encryptedPath = resolve(process.cwd(), ".env.encrypted");

  if (!existsSync(encryptedPath)) {
    return null;
  }

  const password = process.env.GEMINI_KEY_PASSWORD;
  if (!password) {
    return null;
  }

  const payload: EncryptedPayload = JSON.parse(
    readFileSync(encryptedPath, "utf-8")
  );

  const salt = Buffer.from(payload.salt, "hex");
  const iv = Buffer.from(payload.iv, "hex");
  const authTag = Buffer.from(payload.authTag, "hex");
  const derivedKey = scryptSync(password, salt, 32);

  const decipher = createDecipheriv("aes-256-gcm", derivedKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(payload.encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
