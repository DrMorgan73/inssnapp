import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "../../../lib/auth-helpers";
import { db } from "../../../lib/db";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const units = await db.units.byOrg(user.organizationId);
  return NextResponse.json({ units });
}
