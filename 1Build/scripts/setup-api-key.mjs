#!/usr/bin/env node

/**
 * Interactive script to encrypt and store your Gemini API key.
 *
 * Usage: node scripts/setup-api-key.mjs
 *
 * The key is encrypted with AES-256-GCM using a password you provide,
 * then stored in .env.encrypted in the project root.
 *
 * At runtime, set the GEMINI_KEY_PASSWORD environment variable
 * and the app will decrypt the key automatically.
 */

import { createCipheriv, randomBytes, scryptSync } from "crypto";
import { writeFileSync } from "fs";
import { createInterface } from "readline";
import { resolve } from "path";

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log("\n🔐 Gemini API Key Setup\n");
  console.log("This will encrypt your API key with a password and store it locally.\n");

  const apiKey = await ask("Enter your Gemini API key: ");
  if (!apiKey.trim()) {
    console.error("❌ API key cannot be empty.");
    process.exit(1);
  }

  const password = await ask("Choose an encryption password: ");
  if (!password.trim()) {
    console.error("❌ Password cannot be empty.");
    process.exit(1);
  }

  const confirmPassword = await ask("Confirm password: ");
  if (password !== confirmPassword) {
    console.error("❌ Passwords do not match.");
    process.exit(1);
  }

  rl.close();

  // Derive a 32-byte key from the password using scrypt
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, 32);

  // Encrypt with AES-256-GCM
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derivedKey, iv);

  let encrypted = cipher.update(apiKey.trim(), "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  // Store as JSON with all components needed for decryption
  const payload = {
    algorithm: "aes-256-gcm",
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    encrypted,
  };

  const outPath = resolve(process.cwd(), ".env.encrypted");
  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");

  console.log("\n✅ API key encrypted and saved to .env.encrypted");
  console.log("\nTo use it, set the password as an environment variable:");
  console.log("  Windows (PowerShell):  $env:GEMINI_KEY_PASSWORD=\"your_password\"");
  console.log("  Windows (CMD):         set GEMINI_KEY_PASSWORD=your_password");
  console.log("  Linux/Mac:             export GEMINI_KEY_PASSWORD=\"your_password\"");
  console.log("\nThen run: npm run dev\n");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
