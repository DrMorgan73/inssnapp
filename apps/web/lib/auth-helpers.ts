import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE, clearSessionCookie, type SessionUser } from "@inssnapp/auth";
import { db } from "./db";

/** Resolves the authenticated user from the request session cookie. */
export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;
  const user = await db.users.byId(session.userId);
  if (!user) return null;
  return {
    userId: user.id,
    organizationId: user.organizationId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function logoutResponse() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearSessionCookie());
  return res;
}
