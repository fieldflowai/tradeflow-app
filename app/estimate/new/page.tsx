"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateLocalEstimate } from "@/lib/localEstimator";
import { applyPriceBookRates } from "@/lib/priceBookPricing.mjs";

interface LineItemInput {
  description: string;
  quantity: number;
  unit_price: number;
}

interface PriceBookItem {
  id: string;
  name: string;
  description: string;
  trade: string;
  unit: string;
  unit_price: number;
}

interface EstimatePackage {
  name: "Good" | "Better" | "Best";
  description: string;
  total: number;
}

interface LocalEstimateDraft {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  jobAddress: string;
  trade: string;
  requireDeposit: boolean;
  depositPercentage: number;
  promptText: string;
  lineItems: LineItemInput[];
  packageOptions: EstimatePackage[];
  savedAt: string;
}

export default function CreateEstimatePage() {
  const router = useRouter();

  // Tier Toggle State (Free Local vs Paid AI)
  const [isProSubscriber, setIsProSubscriber] = useState(false);

  // Form State
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [jobAddress, setJobAddress] = useState("");
  const [trade, setTrade] = useState("Plumbing");
  const [requireDeposit, setRequireDeposit] = useState(false);
  const [depositPercentage, setDepositPercentage] = useState(20);

  // AI / Smart Generator Prompt State
  const [promptText, setPromptText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [draftStorageMessage, setDraftStorageMessage] = useState("");

  // Line Items
  const [lineItems, setLineItems] = useState<LineItemInput[]>([
    { description: "Standard Labor / Initial Assessment", quantity: 1, unit_price: 150 },
  ]);
  const [priceBookItems, setPriceBookItems] = useState<PriceBookItem[]>([]);
  const [showPriceBook, setShowPriceBook] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateMessage, setTemplateMessage] = useState("");
  const [packageOptions, setPackageOptions] = useState<EstimatePackage[]>([]);

  const [saving, setSaving] = useState(false);

  const saveDraftOnDevice = () => {
    const draft: LocalEstimateDraft = {
      clientName, clientEmail, clientPhone, jobAddress, trade, requireDeposit,
      depositPercentage, promptText, lineItems, packageOptions, savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem("tradeflow-unsent-estimate-v1", JSON.stringify(draft));
      setDraftStorageMessage("Draft saved in this browser on this device. It includes customer contact details.");
    } catch {
      setDraftStorageMessage("This browser could not save the draft. Check available device storage.");
    }
  };

  const restoreDraftFromDevice = () => {
    try {
      const saved = localStorage.getItem("tradeflow-unsent-estimate-v1");
      if (!saved) {
        setDraftStorageMessage("No saved draft found in this browser.");
        return;
      }
      const draft = JSON.parse(saved) as Partial<LocalEstimateDraft>;
      if (!Array.isArray(draft.lineItems) || !draft.lineItems.every((item) =>
        item && typeof item.description === "string" && Number.isFinite(Number(item.quantity)) && Number.isFinite(Number(item.unit_price)))) {
        throw new Error("Saved draft data is invalid.");
      }
      setClientName(draft.clientName ?? ""); setClientEmail(draft.clientEmail ?? "");
      setClientPhone(draft.clientPhone ?? ""); setJobAddress(draft.jobAddress ?? "");
      if (draft.trade) setTrade(draft.trade);
      setRequireDeposit(isProSubscriber && draft.requireDeposit === true);
      setDepositPercentage(Number(draft.depositPercentage) || 20);
      setPromptText(draft.promptText ?? "");
      setLineItems(draft.lineItems);
      setPackageOptions(isProSubscriber && Array.isArray(draft.packageOptions) ? draft.packageOptions : []);
      setDraftStorageMessage(`Draft restored${draft.savedAt ? ` (saved ${new Date(draft.savedAt).toLocaleString()})` : ""}.`);
    } catch {
      setDraftStorageMessage("Could not restore this saved draft. Save a new draft to replace it.");
    }
  };

  const deleteDraftFromDevice = () => {
    localStorage.removeItem("tradeflow-unsent-estimate-v1");
    setDraftStorageMessage("Saved device draft removed.");
  };

  useEffect(() => {
    const savedTemplate = sessionStorage.getItem("tradeflow-estimate-template");
    if (savedTemplate) {
      try {
        const template = JSON.parse(savedTemplate);
        if (Array.isArray(template.line_items) && template.line_items.length) setLineItems(template.line_items);
        if (Array.isArray(template.package_options)) setPackageOptions(template.package_options);
        if (template.trade) setTrade(template.trade);
        if (typeof template.require_deposit === "boolean") setRequireDeposit(template.require_deposit);
        if (template.deposit_percentage) setDepositPercentage(Number(template.deposit_percentage));
        sessionStorage.removeItem("tradeflow-estimate-template");
      } catch {
        sessionStorage.removeItem("tradeflow-estimate-template");
      }
    }
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: plan } = await supabase.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle();
        const activePro = ["active", "trialing"].includes(plan?.status ?? "");
        setIsProSubscriber(activePro);
        if (!activePro) { setRequireDeposit(false); setPackageOptions([]); }
      } else {
        setRequireDeposit(false); setPackageOptions([]);
      }
      const { data } = await supabase.from("price_book_items").select("id, name, description, trade, unit, unit_price").order("name");
      setPriceBookItems((data ?? []) as PriceBookItem[]);
    })();
  }, []);

  // Handle Smart Line-Item Generation (Local vs Paid API)
  const handleGenerateItems = async () => {
    if (!promptText.trim()) return;
    setIsGenerating(true);

    try {
      let draftedItems: LineItemInput[];
      if (isProSubscriber) {
        // PRO TIER: Call Gemini AI Server Route
        const res = await fetch("/api/generate-estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: promptText, trade }),
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        if (!Array.isArray(data.line_items) || data.line_items.length === 0) throw new Error("No usable line items were returned.");
        draftedItems = data.line_items;
      } else {
        // FREE TIER: Execute Zero-Cost Local Catalog Engine
        // Simulate a minor 400ms delay for a smooth UI transition
        await new Promise((resolve) => setTimeout(resolve, 400));
        draftedItems = generateLocalEstimate(`${trade} ${promptText}`);
      }
      const priced = applyPriceBookRates(draftedItems, priceBookItems, trade, isProSubscriber);
      setLineItems(priced.lines);
      setDraftMessage(isProSubscriber
        ? `${priced.matchedCount} line(s) matched your Price Book. Unmatched lines are $0 until you set your own rate.`
        : `${priced.matchedCount} line(s) matched your Price Book. Other local prices are starter references; review them before sending.`);
      setPromptText("");
    } catch (err: any) {
      alert("Error generating estimate: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, unit_price: 0 }]);
  };

  const addPriceBookItem = (item: PriceBookItem) => {
    setLineItems((current) => [...current, {
      description: item.description ? `${item.name} — ${item.description}` : item.name,
      quantity: 1,
      unit_price: Number(item.unit_price),
    }]);
    setShowPriceBook(false);
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setTemplateMessage("Sign in to save templates."); return; }
    const { error } = await supabase.from("estimate_templates").insert({
      user_id: user.id,
      name: templateName.trim(),
      trade,
      line_items: lineItems,
      package_options: packageOptions,
      require_deposit: requireDeposit,
      deposit_percentage: depositPercentage,
    });
    setTemplateMessage(error ? error.message : "Template saved to your price book.");
    if (!error) setTemplateName("");
  };

  const handleRemoveItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof LineItemInput,
    value: string | number
  ) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const subtotal = lineItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    0
  );

  const depositAmount = requireDeposit ? subtotal * (depositPercentage / 100) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !clientEmail) {
      alert("Please fill in client name and email.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        throw new Error("Please sign in before creating an estimate.");
      }
      // 1. Insert Estimate Record
      const { data: est, error: estError } = await supabase
        .from("estimates")
        .insert([
            {
              client_name: clientName,
              client_email: clientEmail,
              client_phone: clientPhone,
              job_address: jobAddress,
              trade,
              package_options: packageOptions,
              user_id: user.id,
            require_deposit: requireDeposit,
            deposit_percentage: depositPercentage,
            status: "pending",
          },
        ])
        .select()
        .single();

      if (estError) throw estError;

      // 2. Insert Line Items
      const formattedItems = lineItems.map((item) => ({
        estimate_id: est.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));

      const { error: itemsError } = await supabase
        .from("line_items")
        .insert(formattedItems);

      if (itemsError) throw itemsError;

      // 3. Redirect to Client Share Portal
      router.push(`/estimate/${est.id}`);
    } catch (err: any) {
      alert("Error creating estimate: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Subscription plan status */}
        <div className="bg-slate-900 text-white p-3.5 rounded-xl flex items-center justify-between text-xs shadow-sm">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-200">Mode:</span>
            <span className={isProSubscriber ? "text-purple-400 font-bold" : "text-blue-400 font-bold"}>
              {isProSubscriber ? "✦ Pro Plan (Full Generative AI)" : "🌱 Free Plan (Smart Local Assistant)"}
            </span>
          </div>
          {isProSubscriber ? <span className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 font-semibold text-green-300">Pro active</span> : <Link href="/profile" className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 font-medium text-slate-200 transition-colors hover:bg-slate-700">Upgrade to Pro</Link>}
        </div>

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">TradeFlow / Estimates</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">Create an estimate</h1>
              <p className="mt-1 text-sm text-slate-500">Build a clear, editable quote for your next job.</p>
            </div>
            <span className="hidden sm:inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">Draft · Unsaved</span>
          </div>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-sm font-semibold text-slate-800">Unfinished estimate</h2><p className="mt-1 text-xs text-slate-600">Save or restore a draft in this browser on this device.</p></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={saveDraftOnDevice} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Save on this device</button>
                <button type="button" onClick={restoreDraftFromDevice} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Restore saved draft</button>
                <button type="button" onClick={deleteDraftFromDevice} className="px-2 py-2 text-xs font-semibold text-red-700 underline">Clear saved draft</button>
              </div>
            </div>
            {draftStorageMessage && <p role="status" className="mt-3 text-xs text-slate-600">{draftStorageMessage}</p>}
          </section>

          {/* Client Details Section */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Client Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Trade</label>
                <select
                  value={trade}
                  onChange={(e) => setTrade(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {['Plumbing', 'Electrical', 'Roofing', 'HVAC', 'Painting', 'Carpentry', 'General contracting', 'Other'].map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Client Name *
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Client Email *
                </label>
                <input
                  type="email"
                  required
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Client Phone
                </label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Job Address
                </label>
                <input
                  type="text"
                  value={jobAddress}
                  onChange={(e) => setJobAddress(e.target.value)}
                  placeholder="123 Main St, City, State"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Smart Draft Generator UI */}
          <div className={`p-4 rounded-xl border space-y-3 ${
            isProSubscriber 
              ? "bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200" 
              : "bg-gradient-to-r from-blue-50 to-slate-50 border-blue-200"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-base">{isProSubscriber ? "✦" : "✳"}</span>
                <h3 className="text-sm font-bold text-slate-900">
                  {isProSubscriber ? "Generative AI Assistant (Pro)" : "Smart Local Estimator (Free)"}
                </h3>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                {isProSubscriber ? "Cloud AI" : "Zero Cost"}
              </span>
            </div>

            <p className="text-xs text-slate-600">
              {isProSubscriber
                ? "Describe the work and measurements. Gemini drafts the scope and quantities, then matching prices come from your Price Book; unmatched prices stay at $0 for you to fill in."
                : "Describe the job and include measurements where you can. Trade-specific local rules draft common tasks and quantities; every line stays editable."}
            </p>
            {!isProSubscriber && (
              <p className="text-[11px] text-slate-500">Local prices are starter reference rates, not live local quotes. Confirm measurements, materials, labor, and your own rates before sending.</p>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="e.g. Replaced 3 double-pane glass windows, sealant, and 3 hours labor"
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleGenerateItems}
                disabled={isGenerating || !promptText.trim()}
                className={`text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                  isProSubscriber ? "bg-purple-600 hover:bg-purple-500" : "bg-blue-600 hover:bg-blue-500"
                }`}
              >
                {isGenerating ? "Drafting..." : "Draft Line Items"}
              </button>
            </div>
            {draftMessage && <p role="status" className="rounded-md border border-blue-200 bg-white/80 px-3 py-2 text-xs text-slate-700">{draftMessage}</p>}
          </div>

          {/* Scope of Work Table */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Scope & Line Items
              </h2>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => setShowPriceBook((open) => !open)} className="text-xs font-semibold text-blue-700 hover:text-blue-600">{showPriceBook ? "Close price book" : "+ Add from price book"}</button>
                <button type="button" onClick={handleAddItem} className="text-xs font-semibold text-blue-600 hover:text-blue-500">+ Add Custom Line</button>
              </div>
            </div>

            {showPriceBook && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="mb-3 text-xs text-slate-600">Add one of your saved rates to this estimate.</p>{priceBookItems.length ? <div className="flex flex-wrap gap-2">{priceBookItems.map((item) => <button key={item.id} type="button" onClick={() => addPriceBookItem(item)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-xs hover:border-blue-400"><span className="font-semibold">{item.name}</span><span className="ml-2 text-slate-500">${Number(item.unit_price).toFixed(2)} / {item.unit}</span></button>)}</div> : <p className="text-xs text-slate-500">Your price book is empty. <a href="/pricebook" className="font-semibold text-blue-700 underline">Add your rates</a></p>}</div>}

            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div key={index} className="flex gap-2 items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                  <input
                    type="text"
                    placeholder="Item or service description"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, "description", e.target.value)}
                    className="flex-1 bg-white border border-slate-200 rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, "quantity", parseFloat(e.target.value) || 0)}
                    className="w-16 bg-white border border-slate-200 rounded-md p-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Rate"
                    value={item.unit_price}
                    onChange={(e) => handleItemChange(index, "unit_price", parseFloat(e.target.value) || 0)}
                    className="w-24 bg-white border border-slate-200 rounded-md p-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="w-20 text-right text-xs font-semibold text-slate-700">
                    ${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
                  </div>
                  {lineItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="text-slate-400 hover:text-red-500 text-xs px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="min-w-48 flex-1 text-xs font-medium text-slate-700">Save this scope as a reusable template<input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="e.g. Standard drain clearing" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
            <button type="button" disabled={!templateName.trim()} onClick={() => void saveTemplate()} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Save template</button>
            {templateMessage && <p role="status" className="w-full text-xs text-slate-600">{templateMessage}</p>}
          </div>

          {/* Deposit & Financial Options */}
          <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-200/60">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 text-sm font-medium text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireDeposit}
                  onChange={(e) => setRequireDeposit(e.target.checked)}
                  disabled={!isProSubscriber}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Require Down-Payment / Deposit {isProSubscriber ? "" : "(Pro)"}</span>
              </label>

              {requireDeposit && (
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={depositPercentage}
                    onChange={(e) => setDepositPercentage(Number(e.target.value))}
                    className="w-16 bg-white border border-slate-300 rounded-md p-1 text-center text-sm"
                  />
                  <span className="text-xs font-semibold text-slate-600">%</span>
                </div>
              )}
            </div>
            {!isProSubscriber && <p className="text-xs text-slate-500">Collect deposits through Stripe with Pro. <Link href="/profile" className="font-semibold text-blue-700 underline">View Pro</Link></p>}

            <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-sm">
              <span className="text-slate-600">Subtotal:</span>
              <span className="font-bold text-slate-900">${subtotal.toFixed(2)}</span>
            </div>

            {requireDeposit && (
              <div className="flex justify-between items-center text-sm font-semibold text-green-700">
                <span>Required Deposit ({depositPercentage}%):</span>
                <span>${depositAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-sm font-semibold text-slate-900">Good / Better / Best options</h2><p className="mt-1 text-xs text-slate-500">Offer customers a choice of service levels on the proposal.</p></div>
              {isProSubscriber ? <button type="button" onClick={() => setPackageOptions(packageOptions.length ? [] : ["Good", "Better", "Best"].map((name) => ({ name: name as EstimatePackage["name"], description: "", total: subtotal })))} className="text-xs font-semibold text-blue-700 underline">{packageOptions.length ? "Remove options" : "Add three options"}</button> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">Pro</span>}
            </div>
            {!isProSubscriber && <p className="mt-3 text-xs text-slate-500">Upgrade to Pro to add customer-selectable package options.</p>}
            {packageOptions.length > 0 && <div className="mt-4 grid gap-3 md:grid-cols-3">{packageOptions.map((option, index) => <div key={option.name} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-700">{option.name}</p><input aria-label={`${option.name} option description`} value={option.description} onChange={(event) => setPackageOptions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} placeholder="Describe what's included" className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs" /><label className="block text-[11px] font-medium text-slate-600">Package total<input aria-label={`${option.name} total`} type="number" min="0" step="0.01" value={option.total} onChange={(event) => setPackageOptions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, total: Number(event.target.value) || 0 } : item))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-semibold" /></label></div>)}</div>}
          </section>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm disabled:opacity-50 text-sm"
          >
            {saving ? "Generating Share Link..." : "Save & Generate Client Proposal Link"}
          </button>
        </form>
      </div>
    </div>
  );
}
