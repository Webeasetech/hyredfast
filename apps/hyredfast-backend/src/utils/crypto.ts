/**
 * Encryption for stored email credentials (SMTP and IMAP passwords).
 *
 * AES-256-GCM, key from CREDENTIAL_ENC_KEY (32 bytes, base64).
 * Stored form: `v1.<iv>.<authTag>.<ciphertext>`, all base64.
 *
 * The frontend has a byte-identical copy at apps/hyredfast-frontend/lib/crypto.js
 * because it writes the rows this worker reads. Change one, change both.
 */

import crypto from "node:crypto";

const PREFIX = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

function getKey(): Buffer {
  const raw = process.env.CREDENTIAL_ENC_KEY;

  if (!raw) {
    throw new Error(
      "CREDENTIAL_ENC_KEY is not set. Generate one with: openssl rand -base64 32",
    );
  }

  const key = Buffer.from(raw, "base64");

  if (key.length !== KEY_BYTES) {
    throw new Error(
      `CREDENTIAL_ENC_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}`,
    );
  }

  return key;
}

/**
 * True when the value is already in the stored ciphertext form.
 */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(`${PREFIX}.`);
}

export function encryptSecret(plain: string): string;
export function encryptSecret(plain: null | undefined): null;
export function encryptSecret(plain: string | null | undefined): string | null;
export function encryptSecret(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === "") return null;
  if (isEncrypted(plain)) return plain;

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);

  return [
    PREFIX,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

/**
 * Reverses `encryptSecret`.
 *
 * A value without the `v1.` prefix is returned untouched: rows written before
 * this landed are still plaintext, and sending must keep working until the
 * backfill script has run. Once every row is encrypted this branch is dead,
 * but leaving it in costs nothing and makes the rollout order-independent.
 */
export function decryptSecret(stored: string): string;
export function decryptSecret(stored: null | undefined): null;
export function decryptSecret(stored: string | null | undefined): string | null;
export function decryptSecret(
  stored: string | null | undefined,
): string | null {
  if (stored === null || stored === undefined || stored === "") return null;
  if (!isEncrypted(stored)) return stored;

  const [, iv, authTag, ciphertext] = stored.split(".");

  if (!iv || !authTag || !ciphertext) {
    throw new Error("Malformed encrypted credential");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
