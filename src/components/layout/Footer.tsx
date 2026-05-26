import React from "react";
import { VERSION } from "@/constants/version";

export function Footer() {
  return (
    <footer className="w-full border-t border-white/5 bg-void/50 py-6 mt-8 mb-20 text-center font-sans">
      <div className="flex flex-col items-center justify-center gap-1.5">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
          Nominees or Denominees
        </p>
        <p className="text-[8px] font-mono font-black text-champagneSoft uppercase tracking-widest bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-[4px] inline-block">
          v{VERSION}
        </p>
      </div>
    </footer>
  );
}
