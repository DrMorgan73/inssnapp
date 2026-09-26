import { NextResponse } from "next/server";
import { logoutResponse } from "../../../../lib/auth-helpers";

export async function POST() {
  return logoutResponse();
}
