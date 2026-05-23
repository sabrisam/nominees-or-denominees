import type { ReactNode } from "react";

export function SectionTitle({ children, tone = "black" }: { children: ReactNode; tone?: "black" | "red" | "yellow" }) {
  const toneClass = tone === "red" ? "border-red-400/30 text-red-100" : tone === "yellow" ? "border-champagne/60 text-champagneSoft" : "border-white/10 text-white";
  return (
    <div className={`rounded-[10px] border bg-white/[0.035] px-2.5 py-1.5 ${toneClass}`}>
      <h2 className="tabloid-headline text-[clamp(1.1rem,5.7vw,1.95rem)] leading-[0.84]">{children}</h2>
    </div>
  );
}
