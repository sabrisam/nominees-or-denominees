import { Pencil, Lock } from "lucide-react";

export function OwnershipBadge({ owned, className = "" }: { owned: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-[10px] border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] leading-none ${owned ? "border-[#d4af37]/70 bg-[#d4af37]/15 text-[#f0d889]" : "border-white/10 bg-white/10 text-white"} ${className}`}>
      {owned ? (
        <>
          PAR VOUS <Pencil className="h-2.5 w-2.5" strokeWidth={3} />
        </>
      ) : (
        <>
          PAR AUTRE <Lock className="h-2.5 w-2.5" strokeWidth={3} />
        </>
      )}
    </span>
  );
}
