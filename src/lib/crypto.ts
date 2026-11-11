/**
 * crypto.ts
 * AES-256-GCM envelope encryption for sensitive fields (PAN, CVV, taxId).
 *
 * Format stored in DB:  <iv_hex>:<ciphertext_base64>:<authTag_hex>
 * All operations use the Node.js built-in `crypto` module — no external deps.
 *
 * Key source: process.env.ENCRYPTION_KEY (64 hex chars = 32 bytes = 256 bits)
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;   // 96-bit IV — NIST recommended for GCM
const TAG_BYTES = 16;  // 128-bit authentication tag

// ─────────────────────────────────────────────
// Key management
// ─────────────────────────────────────────────

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-char hex string (32 bytes). " +
      "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(hex, "hex");
}

// ─────────────────────────────────────────────
// Encrypt
// ─────────────────────────────────────────────

/**
 * Encrypts a plaintext string.
 * @returns  "<iv_hex>:<ciphertext_base64>:<authTag_hex>"
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    ciphertext.toString("base64"),
    tag.toString("hex"),
  ].join(":");
}

// ─────────────────────────────────────────────
// Decrypt
// ─────────────────────────────────────────────

/**
 * Decrypts a value produced by `encrypt()`.
 * Throws if the ciphertext has been tampered with (GCM auth tag mismatch).
 */
export function decrypt(envelope: string): string {
  const parts = envelope.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted envelope format.");
  }
  const [ivHex, ciphertextB64, tagHex] = parts;

  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const tag = Buffer.from(tagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

// ─────────────────────────────────────────────
// Helpers for common banking fields
// ─────────────────────────────────────────────

/** Encrypt a PAN and return the envelope + last-four digits for display. */
export function encryptPan(pan: string): { encrypted: string; lastFour: string } {
  if (!/^\d{15,19}$/.test(pan)) {
    throw new Error("PAN must be 15–19 digits.");
  }
  return {
    encrypted: encrypt(pan),
    lastFour: pan.slice(-4),
  };
}

/** Decrypt a PAN from its stored envelope. */
export function decryptPan(envelope: string): string {
  return decrypt(envelope);
}

/** Encrypt a 3–4 digit CVV. */
export function encryptCvv(cvv: string): string {
  if (!/^\d{3,4}$/.test(cvv)) {
    throw new Error("CVV must be 3 or 4 digits.");
  }
  return encrypt(cvv);
}

/** Decrypt a CVV from its stored envelope. */
export function decryptCvv(envelope: string): string {
  return decrypt(envelope);
}
