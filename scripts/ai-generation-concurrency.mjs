import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function localSupabaseEnvironment() {
  const output = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8" });
  const values = Object.fromEntries(output.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, "")]] : [];
  }));
  return {
    url: process.env.SUPABASE_URL || values.API_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || values.SERVICE_ROLE_KEY,
  };
}

const { url, serviceKey } = localSupabaseEnvironment();
if (!url || !serviceKey) throw new Error("Start local Supabase first; API_URL and SERVICE_ROLE_KEY are required.");
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: settings, error: settingsError } = await admin.from("tradeflow_app_settings")
  .select("ai_drafting_enabled, ai_daily_generation_limit").eq("singleton", true).single();
if (settingsError) throw new Error(`Could not read AI settings: ${settingsError.message}`);

const email = `ai-quota-race-${randomUUID()}@example.test`;
let userId;
try {
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password: `Test-${randomUUID()}-A1!`, email_confirm: true });
  if (createError || !created.user) throw new Error(`Could not create quota test user: ${createError?.message ?? "unknown error"}`);
  userId = created.user.id;
  const { error: subscriptionError } = await admin.from("subscriptions").insert({ user_id: userId, status: "active" });
  if (subscriptionError) throw new Error(`Could not create Pro subscription fixture: ${subscriptionError.message}`);
  const { error: configureError } = await admin.from("tradeflow_app_settings").update({ ai_drafting_enabled: true, ai_daily_generation_limit: 7 }).eq("singleton", true);
  if (configureError) throw new Error(`Could not configure AI quota test: ${configureError.message}`);

  const reservations = await Promise.all(Array.from({ length: 30 }, () => admin.rpc("reserve_workcraft_ai_generation", {
    p_user_id: userId,
    p_prompt_characters: 120,
    p_model: "gemini-concurrency-test",
  })));
  const allowed = reservations.flatMap(({ data, error }) => {
    if (error) throw new Error(`Concurrent quota reservation failed: ${error.message}`);
    return Array.isArray(data) ? data.filter((row) => row.allowed) : [];
  });
  if (allowed.length !== 7) throw new Error(`Expected exactly 7 reservations to pass; got ${allowed.length}.`);

  const completed = await Promise.all(allowed.map((reservation, index) => admin.rpc("complete_workcraft_ai_generation", {
    p_generation_id: reservation.generation_id,
    p_outcome: index === 0 ? "failed" : "succeeded",
    p_provider_status: index === 0 ? 429 : 200,
    p_generated_items: index === 0 ? null : 2,
  })));
  const completionError = completed.find(({ error }) => error)?.error;
  if (completionError) throw new Error(`Could not finalize test usage: ${completionError.message}`);

  const { data: usage, error: usageError } = await admin.from("tradeflow_ai_daily_usage")
    .select("attempts_started, succeeded, failed").eq("user_id", userId).single();
  if (usageError || usage?.attempts_started !== 7 || usage.succeeded !== 6 || usage.failed !== 1) {
    throw new Error(`Expected 7 total attempts (6 succeeded, 1 failed); got ${JSON.stringify(usage)}: ${usageError?.message ?? ""}`);
  }
  console.log("AI quota concurrency test passed: 30 simultaneous reservations admitted exactly 7 attempts; all outcomes were recorded.");
} finally {
  await admin.from("tradeflow_app_settings").update(settings).eq("singleton", true);
  if (userId) await admin.auth.admin.deleteUser(userId);
}
