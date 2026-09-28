import Link from "next/link";

interface LogoProps {
  className?: string;
  showText?: boolean;
  href?: string;
}

export default function Logo({
  className = "h-10 w-10",
  showText = true,
  href = "/dashboard",
}: LogoProps) {
  return (
    <Link href={href} aria-label="TradeFlow home" className="group inline-flex items-center gap-3">
      <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-600 shadow-sm ring-1 ring-black/10 ${className}`}>
        <svg viewBox="0 0 40 40" role="img" aria-label="TradeFlow mark" className="h-full w-full">
          <path d="M11 6.5h12l7 7v20H11z" fill="none" stroke="#fff8ec" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M23 6.8v7h6.8" fill="none" stroke="#fff8ec" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M16 20h9M16 24.5h9" fill="none" stroke="#fff8ec" strokeWidth="2.1" strokeLinecap="round" />
          <path d="m18 29 2.4 2.4 5.1-5.3" fill="none" stroke="#fff8ec" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {showText && (
        <span className="flex flex-col leading-none">
          <span className="text-[18px] font-extrabold tracking-[-0.055em] text-white group-hover:text-orange-200 transition-colors">
            Trade<span className="text-orange-400">Flow</span>
          </span>
          <span className="mt-1 text-[8px] font-semibold uppercase tracking-[0.09em] text-slate-400">Clear estimates. Stronger businesses.</span>
        </span>
      )}
    </Link>
  );
}
