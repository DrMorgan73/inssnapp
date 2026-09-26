import type { Role } from "@inssnapp/engine";
import type { SessionUser } from "./session";

/**
 * Role-based authorization guards.
 *
 * Management and inssnapp_admin are privileged for oversight operations;
 * resident/prospect/broker are scoped to their own workflow participation.
 */

export function isPrivileged(role: Role): boolean {
  return role === "management" || role === "inssnapp_admin";
}

export function canViewControlCenter(role: Role): boolean {
  return isPrivileged(role);
}

export function canViewOrgData(role: Role): boolean {
  return isPrivileged(role);
}

/** Extracts the bearer/cookie session from a Fetch API request. */
export function getSessionToken(req: Request): string | null {
  const cookie = req.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === "inssnapp_session" && v.length) return decodeURIComponent(v.join("="));
  }
  return null;
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function requireRole(
  user: SessionUser | null,
  ...allowed: Role[]
): asserts user is SessionUser {
  if (!user) throw new ForbiddenError("Not authenticated");
  if (!allowed.includes(user.role)) {
    throw new ForbiddenError(`Role '${user.role}' is not permitted`);
  }
}
