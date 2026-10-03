import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HEALTH_TIMEOUT_MS = 3_000;

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let supabaseAuth: "ok" | "error" = "error";

  if (supabaseUrl && supabaseKey) {
    try {
      const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/health`, {
        headers: { apikey: supabaseKey },
        cache: "no-store",
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      if (response.ok) supabaseAuth = "ok";
    } catch {
      // Keep the public health response free of provider URLs, credentials, and error details.
    }
  }

  const healthy = supabaseAuth === "ok";
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks: { app: "ok", supabaseAuth },
      checkedAt: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
