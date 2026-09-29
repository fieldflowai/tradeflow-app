import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Customer payments are temporarily unavailable while TradeFlow connects contractor Stripe accounts." },
    { status: 503 }
  );
}
