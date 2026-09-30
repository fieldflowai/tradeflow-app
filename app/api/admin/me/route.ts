import { NextResponse } from "next/server";
import { requireTradeFlowAdmin } from "@/lib/admin-support";

export async function GET() {
  const access = await requireTradeFlowAdmin("support", false);
  if ("response" in access) return access.response;
  return NextResponse.json({ role: access.role, mfa_required: access.mfaRequired });
}
