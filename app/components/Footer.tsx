import Link from "next/link";
import Logo from "@/app/components/Logo";

export default function Footer() {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  return (
    <footer className="print:hidden border-t border-slate-800 bg-slate-950 text-xs text-slate-400">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-4 py-6 sm:flex-row md:px-8">
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Logo className="h-8 w-8" />
          <span>TradeFlow · Clear estimates. Stronger businesses.</span>
        </div>
        <nav aria-label="Footer" className="flex items-center gap-6">
          <Link href="/privacy" className="transition-colors hover:text-white">Privacy</Link>
          <Link href="/terms" className="transition-colors hover:text-white">Terms</Link>
          {supportEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail) && <a href={`mailto:${supportEmail}`} className="transition-colors hover:text-white">Support</a>}
        </nav>
      </div>
    </footer>
  );
}
