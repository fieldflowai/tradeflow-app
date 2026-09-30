import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to use cloud estimate drafting." }, { status: 401 });
  const { data: subscription } = await supabase.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle();
  if (!subscription || !["active", "trialing"].includes(subscription.status)) return NextResponse.json({ error: "Cloud estimate drafting is a Pro feature." }, { status: 403 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Cloud drafting is not configured. Set GEMINI_API_KEY on the server." }, { status: 503 });

  const body = await request.json();
  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 6000) : "";
  const trade = typeof body.trade === "string" ? body.trade.slice(0, 80) : "General contracting";
  if (!prompt) return NextResponse.json({ error: "Describe the job to draft an estimate." }, { status: 400 });

  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `Draft scope and quantities only for a ${trade} job. Job description: ${prompt}\n\nReturn JSON only with a line_items array. Each item must contain description (string), quantity (number), and unit_price (number). Always set unit_price to 0; TradeFlow will apply the contractor's saved Price Book rates where a clear match exists. Break work into distinct tasks and list labor/material work separately when clear. Do not invent measurements. If a quantity cannot be responsibly inferred, use 1 and say what needs confirmation in the description. Use concise descriptions that name the actual fixture, material, or task so it can be matched to a saved service.` }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 2048 },
    }),
  });
  const generated = await response.json();
  if (!response.ok) return NextResponse.json({ error: generated.error?.message || "Cloud AI request failed." }, { status: 502 });
  const text = generated.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("");
  let parsed: { line_items?: unknown[] };
  try { parsed = JSON.parse(text || "{}"); }
  catch { return NextResponse.json({ error: "The AI response could not be read. Try a more specific job description." }, { status: 502 }); }
  const line_items = Array.isArray(parsed.line_items) ? parsed.line_items.slice(0, 40).flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const description = typeof candidate.description === "string" ? candidate.description.trim().slice(0, 240) : "";
    const quantity = Number(candidate.quantity);
    if (!description || !Number.isFinite(quantity) || quantity <= 0) return [];
    return [{ description, quantity, unit_price: 0 }];
  }) : [];
  if (!line_items.length) return NextResponse.json({ error: "The AI returned no usable line items. Add scope details and try again." }, { status: 502 });
  return NextResponse.json({ line_items });
}
