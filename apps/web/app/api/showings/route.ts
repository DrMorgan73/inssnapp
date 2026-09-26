import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "../../../lib/auth-helpers";
import { db } from "../../../lib/db";
import { isPrivileged } from "@inssnapp/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const showings = await db.showings.list(user.organizationId);
  return NextResponse.json({ showings });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  if (!isPrivileged(user.role)) return forbidden();

  const body = await req.json().catch(() => ({}));
  const { unitId, residentUserId, brokerRequired } = body as {
    unitId?: string;
    residentUserId?: string;
    brokerRequired?: boolean;
  };
  if (!unitId || !residentUserId) {
    return NextResponse.json({ error: "unitId and residentUserId are required." }, { status: 400 });
  }

  const unit = await db.units.byId(unitId);
  if (!unit || unit.organizationId !== user.organizationId) {
    return NextResponse.json({ error: "Unit not found in your organization." }, { status: 404 });
  }
  if (!unit.eligible) {
    return NextResponse.json({ error: "Unit is not eligible for participation." }, { status: 400 });
  }

  const showing = await db.showings.create(unitId, residentUserId, user.organizationId, brokerRequired ?? false);
  return NextResponse.json({ showing }, { status: 201 });
}
