import type { ReactNode } from "react";

export function Sticker({
  children,
  tone = "red",
  className = ""
}: {
  children: ReactNode;
  tone?: "red" | "yellow" | "black" | "paper";
  className?: string;
}) {
  const toneClass =
    tone === "yellow"
      ? "border-[#d4af37]/60 bg-[#d4af37]/15 text-[#f0d889]"
      : tone === "black"
        ? "border-white/10 bg-black/70 text-white"
        : tone === "paper"
          ? "border-white/10 bg-white/5 text-white"
          : "border-red-400/30 bg-red-950/40 text-red-100";

  return <span className={`inline-flex rounded-[10px] border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] leading-none ${toneClass} ${className}`}>{children}</span>;
}
