import type { Role } from "@inssnapp/engine";

/** Authenticated identity carried by a session. */
export interface SessionUser {
  userId: string;
  organizationId: string;
  email: string;
  fullName: string;
  role: Role;
}

const encoder = new TextEncoder();

/** URL-safe base64 of raw bytes. */
function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function secretKey(): string {
  return process.env.INSSNAPP_AUTH_SECRET || "inssnapp-dev-secret-change-in-production";
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return b64url(new Uint8Array(sig));
}

/** Signs a session token. Format: base64url(payload).signature */
export async function signSession(user: SessionUser): Promise<string> {
  const payload = b64url(encoder.encode(JSON.stringify(user)));
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

/** Verifies a session token and returns the identity, or null if invalid. */
export async function verifySession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(payload);
  if (sig !== expected) return null;
  try {
    return JSON.parse(new TextDecoder().decode(fromB64url(payload))) as SessionUser;
  } catch {
    return null;
  }
}

/** Cookie value for a logged-in session. */
export const SESSION_COOKIE = "inssnapp_session";

export function sessionCookie(token: string, maxAgeSeconds = 60 * 60 * 24 * 7): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
