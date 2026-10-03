"use client";

import Link from "next/link";
import Logo from "@/app/components/Logo";
import { translate, useLanguage } from "@/app/components/LanguageProvider";

export default function Footer() {
  const { language } = useLanguage();
  return (
    <footer className="print:hidden border-t border-slate-800 bg-slate-950 text-xs text-slate-400">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-4 py-6 sm:flex-row md:px-8">
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Logo className="h-8 w-8" />
          <span>{translate(language, "WorkCraft AI · For the people who get the work done. Keep good work moving.")}</span>
          <span className="text-slate-500">{translate(language, "Veteran-owned company")}</span>
        </div>
        <nav aria-label="Footer" className="flex items-center gap-6">
          <Link href="/privacy" className="transition-colors hover:text-white">{translate(language, "Privacy")}</Link>
          <Link href="/terms" className="transition-colors hover:text-white">{translate(language, "Terms")}</Link>
          <Link href="/support" className="transition-colors hover:text-white">{translate(language, "Support")}</Link>
        </nav>
      </div>
    </footer>
  );
}
