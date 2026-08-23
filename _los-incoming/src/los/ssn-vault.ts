/**
 * AES-256-GCM SSN vault.
 *
 * Key: 32 raw bytes, OR a base64 / base64url string that decodes to 32 bytes.
 * Encoding: `iv.tag.ciphertext` where each part is lowercase hex.
 *   - iv: 12 bytes (24 hex chars)
 *   - tag: 16 bytes (32 hex chars)
 *   - ciphertext: remaining hex
 *
 * Env: MORTGAGE_PII_KEY. Never log plaintext SSN. GET / public views expose last-4 only.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export type SsnKey = string | Buffer | Uint8Array;

export function normalizePiiKey(keyBase64Or32bytes: SsnKey): Buffer {
  if (typeof keyBase64Or32bytes !== "string") {
    const buf = Buffer.from(keyBase64Or32bytes);
    if (buf.length !== KEY_LENGTH) {
      throw new Error("MORTGAGE_PII_KEY must be 32 bytes");
    }
    return buf;
  }
  // 32-char string is treated as raw UTF-8 key material.
  if (keyBase64Or32bytes.length === KEY_LENGTH && !/[+/_=-]/.test(keyBase64Or32bytes)) {
    return Buffer.from(keyBase64Or32bytes, "utf8");
  }
  const normalized = keyBase64Or32bytes.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const buf = Buffer.from(padded, "base64");
  if (buf.length !== KEY_LENGTH) {
    throw new Error("MORTGAGE_PII_KEY must be 32 bytes or base64 of 32 bytes");
  }
  return buf;
}

function digitsOnly(ssn: string): string {
  return ssn.replace(/\D/g, "");
}

export function last4(ssn: string): string {
  const digits = digitsOnly(ssn);
  if (digits.length < 4) throw new Error("SSN must have at least 4 digits");
  return digits.slice(-4);
}

export function encryptSsn(ssn: string, keyBase64Or32bytes: SsnKey): string {
  const digits = digitsOnly(ssn);
  if (digits.length !== 9) throw new Error("SSN must be 9 digits");
  const key = normalizePiiKey(keyBase64Or32bytes);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(digits, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  if (tag.length !== TAG_LENGTH) throw new Error("unexpected GCM tag length");
  return `${iv.toString("hex")}.${tag.toString("hex")}.${ciphertext.toString("hex")}`;
}

export function decryptSsn(payload: string, keyBase64Or32bytes: SsnKey): string {
  const parts = payload.split(".");
  if (parts.length !== 3) throw new Error("invalid SSN ciphertext encoding");
  const [ivHex, tagHex, dataHex] = parts;
  const key = normalizePiiKey(keyBase64Or32bytes);
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  if (iv.length !== IV_LENGTH) throw new Error("invalid SSN iv length");
  if (tag.length !== TAG_LENGTH) throw new Error("invalid SSN tag length");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export type PublicBorrower<T> = Omit<T, "ssn" | "ssnCiphertext"> & {
  ssnLast4: string | null;
};

/**
 * Strip write-only SSN fields. Never returns full SSN or ciphertext.
 */
export function toPublic<T extends Record<string, unknown>>(
  borrower: T,
  decryptedSsn?: string | null,
): PublicBorrower<T> {
  const { ssn: _ssn, ssnCiphertext: _cipher, ...rest } = borrower as T & {
    ssn?: unknown;
    ssnCiphertext?: unknown;
    ssnLast4?: unknown;
  };
  void _cipher;
  let ssnLast4: string | null = null;
  if (typeof decryptedSsn === "string" && decryptedSsn) {
    ssnLast4 = last4(decryptedSsn);
  } else if (typeof _ssn === "string" && _ssn) {
    ssnLast4 = last4(_ssn);
  } else if (typeof rest.ssnLast4 === "string") {
    ssnLast4 = rest.ssnLast4;
  }
  const publicView = { ...rest, ssnLast4 } as PublicBorrower<T>;
  if ("ssn" in (publicView as object)) delete (publicView as { ssn?: unknown }).ssn;
  if ("ssnCiphertext" in (publicView as object)) {
    delete (publicView as { ssnCiphertext?: unknown }).ssnCiphertext;
  }
  return publicView;
}

export const toPublicBorrower = toPublic;
