import type { ReactNode } from "react";

export function Ticker({ children }: { children: ReactNode }) {
  return (
    <div className="ticker-container flex overflow-hidden whitespace-nowrap rounded-full border border-[rgba(212,175,55,0.24)] bg-[rgba(212,175,55,0.1)] text-[#f0d889]">
      <div className="ticker-track flex animate-ticker-move will-change-transform">
        <span className="inline-block whitespace-nowrap px-2 py-[0.3rem] text-[0.52rem] font-black uppercase tracking-[0.04em]">
          {children}
        </span>
        <span className="inline-block whitespace-nowrap px-2 py-[0.3rem] text-[0.52rem] font-black uppercase tracking-[0.04em]" aria-hidden="true">
          {children}
        </span>
      </div>
    </div>
  );
}
