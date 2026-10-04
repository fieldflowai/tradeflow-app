import { LocalizedTree } from "@/app/components/LanguageProvider";

export default function PrivacyPage() {
  return (
    <LocalizedTree>
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <article className="space-y-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="space-y-2 border-b border-slate-200 pb-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">WorkCraft AI · Legal</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Privacy Policy</h1>
          <p className="text-sm text-slate-600">Last updated: October 2026</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">1. Information We Collect</h2>
          <p className="text-sm leading-7 text-slate-700">
            We collect account and business profile details, customer contact information, estimate line items and prices, job addresses, schedules, notes, and approval details that you enter. If you contact support, we send the name, email address, topic, and message you provide to our email provider so our support team can reply. To limit spam, we use a keyed hash of the request IP address to enforce a daily submission limit. Expired hashes are pruned the next time a support request is processed after 30 days. Supabase provides account authentication and data storage. Payment card details are handled by Stripe Checkout and are not stored by WorkCraft AI.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">2. How We Use Information</h2>
          <p className="text-sm leading-7 text-slate-700">
            We use information to create and manage estimates, price books, schedules, invoices, approvals, and reports. If you use cloud estimate drafting, the job description and selected trade are sent to Google Gemini for processing. Local drafting runs in your browser. If you send an estimate or enable a follow-up, the customer email address and proposal details are sent to our email provider to deliver the message. Support requests are sent to our support inbox through Resend; WorkCraft AI does not store their message contents in its app database.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">3. Estimate Email Tracking</h2>
          <p className="text-sm leading-7 text-slate-700">
            WorkCraft AI records when an estimate email is sent and when its proposal link is first viewed. This supports your estimate activity history and scheduled follow-ups.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">4. Data Deletion</h2>
          <p className="text-sm leading-7 text-slate-700">
            You may request full deletion of your account and associated data at any time through your account settings or by contacting support.
          </p>
        </section>
      </article>
    </div>
    </LocalizedTree>
  );
}
