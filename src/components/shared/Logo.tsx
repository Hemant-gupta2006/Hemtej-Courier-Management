"use client";

import Link from "next/link";

interface LogoProps {
  href?: string;
  subtitle?: string;
  className?: string;
}

export function Logo({ href = "/", subtitle, className = "" }: LogoProps) {
  return (
    <Link href={href} className={`flex items-center gap-3 group ${className}`}>
      <div className="relative">
        <img
          src="/icon.png"
          alt="HemTej Co Logo"
          className="w-8 h-8 md:w-9 md:h-9 object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col">
        <span className="font-bold text-base md:text-lg tracking-tight text-slate-900 dark:text-white leading-tight">
          HemTej Co
        </span>
        {subtitle && (
          <span className="text-[10px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
            {subtitle}
          </span>
        )}
      </div>
    </Link>
  );
}
