import type { Metadata } from "next";
import Link from "next/link";
import { emailAddressFromConfig } from "@/lib/email-address";
import SupportForm from "./SupportForm";

export const metadata: Metadata = {
  title: "Support | WorkCraft AI",
  description: "Find answers to common WorkCraft AI questions or send a message to our support team.",
};

const questions = [
  {
    question: "How do I create an estimate?",
    answer: <>Sign in and choose <Link href="/estimate/new" className="font-semibold text-orange-800 underline underline-offset-2">New estimate</Link>. Add the customer and job details, review the line items and totals, then save. You can find saved estimates on your dashboard.</>,
  },
  {
    question: "How many estimates can I create on the free plan?",
    answer: "Free accounts can save up to 10 new estimates per UTC calendar day. The counter resets at 00:00 UTC. Editing an estimate, saving a browser-only draft, or a failed save does not use a slot. Existing estimates remain available.",
  },
  {
    question: "Can my customer review a proposal without an account?",
    answer: "Yes. Share the proposal link from the estimate. Your customer can review the proposal and respond through its customer-facing page without signing in to WorkCraft AI.",
  },
  {
    question: "Where can I find jobs, invoices, and reports?",
    answer: "Use Schedule & jobs to manage jobs and open an invoice from a job. Reports and your estimates are available from the app navigation.",
  },
  {
    question: "I can’t sign in. What should I do?",
    answer: <>Use the <Link href="/forgot-password" className="font-semibold text-orange-800 underline underline-offset-2">password reset page</Link> to request a reset email. If you no longer have access to your account email or the reset email does not arrive, send us a message below.</>,
  },
  {
    question: "How do I manage my plan or billing?",
    answer: "Sign in and open your account menu to view your profile and plan options. If a charge or subscription change doesn’t look right, choose Billing in the contact form and include the email address on your WorkCraft AI account. Never send full payment card details.",
  },
  {
    question: "Does WorkCraft AI send estimates or customer emails?",
    answer: "You can send estimate and proposal emails from the app where the feature is available. If a message does not arrive, check the recipient address and spam folder, then contact us with the estimate number and the approximate time you sent it.",
  },
  {
    question: "What should I include in a support request?",
    answer: "Tell us the email on your account, what you were trying to do, what happened, and any on-screen error. Please leave out passwords, payment card details, and sensitive customer information.",
  },
];

export default function SupportPage() {
  const supportEmail = emailAddressFromConfig(process.env.NEXT_PUBLIC_SUPPORT_EMAIL) || "support@workcraftai.com";

  return (
    <div className="min-h-full bg-[linear-gradient(180deg,#f1eee5_0%,#fffdf8_420px)]">
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-12 sm:px-6 sm:pt-16 lg:px-8">
        <Link href="https://workcraftai.com/" className="text-sm font-semibold text-slate-600 transition hover:text-orange-800">← WorkCraft AI home</Link>
        <div className="mt-10 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-800">We’re here to help</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">WorkCraft AI Support</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">Start with the answers below. If you still need a hand, send our team a message and we’ll follow up by email.</p>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
          <section aria-labelledby="faq-heading">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Quick answers</p>
                <h2 id="faq-heading" className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Frequently asked questions</h2>
              </div>
              <span className="hidden rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm sm:inline">WorkCraft AI</span>
            </div>
            <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {questions.map(({ question, answer }) => (
                <details key={question} className="group px-5 py-4 sm:px-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-sm font-bold text-slate-900 marker:hidden [&::-webkit-details-marker]:hidden">
                    {question}
                    <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-lg leading-none text-slate-600 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 pr-8 text-sm leading-6 text-slate-600">{answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section id="contact-support" aria-labelledby="contact-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-800">Still need help?</p>
            <h2 id="contact-heading" className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Send us a message</h2>
            <p className="mt-2 mb-6 text-sm leading-6 text-slate-600">Share a few details and our support team will reply to the email address you provide.</p>
            <SupportForm />
            <p className="mt-6 border-t border-slate-100 pt-5 text-sm text-slate-600">Prefer email? <a href={`mailto:${supportEmail}`} className="font-semibold text-orange-800 underline underline-offset-2">{supportEmail}</a></p>
          </section>
        </div>
      </section>
    </div>
  );
}
