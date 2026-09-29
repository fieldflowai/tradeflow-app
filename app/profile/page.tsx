"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [planStatus, setPlanStatus] = useState("free");
  const [upgrading, setUpgrading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setEmail(user.email ?? "");
        setFullName(user.user_metadata?.full_name ?? "");
        setBusinessName(user.user_metadata?.business_name ?? "");
        setPhone(user.user_metadata?.phone ?? "");
        const { data: plan } = await supabase.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle();
        if (plan) setPlanStatus(plan.status);
      }
      setLoading(false);
    }

    loadProfile();
  }, [supabase]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: fullName,
        business_name: businessName,
        phone: phone,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Profile and preferences updated successfully!");
    }
    setSaving(false);
  };

  const handleUpgrade = async () => {
    setUpgrading(true); setError(null);
    try {
      const response = await fetch("/api/pro/checkout", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || "Unable to start checkout.");
      window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout.");
      setUpgrading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="h-8 w-48 bg-slate-200 animate-pulse rounded mb-4" />
        <div className="h-64 bg-slate-100 animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Profile & Preferences</h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage your account details and default estimate preferences.
        </p>
      </div>

      <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your plan</p><h2 className="mt-1 text-lg font-bold capitalize text-slate-900">{planStatus === "active" || planStatus === "trialing" ? "TradeFlow Pro" : "TradeFlow Free"}</h2><p className="mt-1 text-xs text-slate-600">{planStatus === "active" || planStatus === "trialing" ? "Pro tools are enabled on this account." : "Create estimates, manage your price book, schedule jobs, and view reports."}</p></div>
        {planStatus === "active" || planStatus === "trialing" ? <span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-bold text-green-800">{planStatus}</span> : <button type="button" disabled={upgrading} onClick={() => void handleUpgrade()} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{upgrading ? "Opening checkout…" : "Upgrade to Pro"}</button>}
      </section>

      <form
        onSubmit={handleSaveProfile}
        className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4"
      >
        {message && (
          <div className="text-xs text-green-700 bg-green-50 p-3 rounded-lg border border-green-200">
            {message}
          </div>
        )}
        {error && (
          <div className="text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Email Address (Read-only)
          </label>
          <input
            type="email"
            disabled
            value={email}
            className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-500 cursor-not-allowed"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
              suppressHydrationWarning
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Business / Company Name
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Apex Contracting LLC"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
              suppressHydrationWarning
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 000-0000"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
              suppressHydrationWarning
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
          >
            {saving ? "Saving Changes..." : "Save Preferences"}
          </button>
        </div>
      </form>
    </div>
  );
}
