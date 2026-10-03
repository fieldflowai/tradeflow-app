import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Customer payments are temporarily unavailable while WorkCraft AI connects contractor Stripe accounts." },
    { status: 503 }
  );
}
