import Image from "next/image";
import Link from "next/link";
import { LocalizedTree } from "@/app/components/LanguageProvider";

interface LogoProps {
  className?: string;
  showText?: boolean;
  href?: string;
}

export default function Logo({
  className = "h-10 w-10",
  showText = true,
  href = "/",
}: LogoProps) {
  return (
    <Link href={href} aria-label="WorkCraft AI home" className="group inline-flex items-center gap-3">
      <Image
        src="/brand/workcraft-ai-mark.svg"
        alt=""
        width={128}
        height={128}
        className={`shrink-0 rounded-xl ${className}`}
        priority
      />
      {showText && (
        <span className="flex flex-col leading-none">
          <span className="text-[18px] font-extrabold tracking-[-0.055em] text-white transition-colors group-hover:text-orange-200">
            WorkCraft <span className="text-orange-400">AI</span>
          </span>
          <LocalizedTree>
            <span className="mt-1 text-[8px] font-semibold tracking-[0.01em] text-slate-300">For the people who get the work done.</span>
            <span className="mt-0.5 text-[8px] font-semibold tracking-[0.01em] text-slate-300">Keep good work moving.</span>
          </LocalizedTree>
        </span>
      )}
    </Link>
  );
}
