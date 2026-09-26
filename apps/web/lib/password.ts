/**
 * Password hashing (demo-grade).
 *
 * Production (TASK-002) MUST use argon2id or bcrypt via a vetted library and
 * a secrets-managed pepper. This foundation keeps auth runnable without
 * native dependencies while preserving the same verify() contract.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(salt + password).digest("hex");
  return `s1:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "s1" || !salt || !hash) return false;
  const candidate = createHash("sha256").update(salt + password).digest("hex");
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
