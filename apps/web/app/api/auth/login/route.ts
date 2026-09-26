import { NextRequest, NextResponse } from "next/server";
import { signSession, SESSION_COOKIE } from "@inssnapp/auth";
import { verifyPassword } from "../../../../lib/password";
import { store } from "../../../../lib/store";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, password } = body as { email?: string; password?: string };
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const user = store.users.byEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  // MFA gate for privileged roles (foundation — full MFA in TASK-002).
  if (user.mfaEnabled) {
    return NextResponse.json({ error: "MFA required.", mfaRequired: true }, { status: 403 });
  }

  const session = await signSession({
    userId: user.id,
    organizationId: user.organizationId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  });
  const token = store.sessions.create(user.id, user.organizationId);

  const res = NextResponse.json({
    user: {
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
  });
  res.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`,
  );
  return res;
}
