import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { BrutalCard } from "@/components/ui/BrutalCard";
import { MicroDimensionBars } from "@/components/ui/MicroDimensionBars";
import type { PalmaresRow } from "@/types";

const TAP_REBOUND = { scale: 0.965, rotate: -0.35 };
const TAP_TRANSITION = { type: "spring", stiffness: 900, damping: 32, mass: 0.42 } as const;

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function PalmaresList({ rows, onOpenStudio }: { rows: PalmaresRow[]; onOpenStudio?: () => void }) {
  if (rows.length === 0) {
    return (
      <BrutalCard className="p-3 text-center">
        <Trophy className="mx-auto mb-2 h-8 w-8 text-[#d4af37]" />
        <p className="tabloid-headline text-2xl leading-none">Aucun classement.</p>
        <p className="mx-auto mt-1 max-w-[15rem] text-[10px] font-semibold uppercase tracking-tighter text-zinc-500">Le palmarès commence dès le premier dossier noté.</p>
        {onOpenStudio ? (
          <motion.button type="button" whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={onOpenStudio} className="brutal-action mt-3 bg-[#d4af37] px-4 text-black">
            Inviter les Zins à voter
          </motion.button>
        ) : null}
      </BrutalCard>
    );
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-white/10 bg-black/25">
      {rows.map((row, index) => (
        <motion.article
          key={row.tiktokerName}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.035, type: "spring", stiffness: 240, damping: 26 }}
          className="border-b border-white/10 px-2 py-1.5 last:border-b-0"
        >
          <div className="grid grid-cols-[1.15rem_2.25rem_minmax(0,1fr)_auto] items-center gap-2">
            <p className="rank-number text-[1.45rem] leading-none text-[#d4af37]">{index + 1}</p>
            <div className="relative h-9 w-9 overflow-hidden rounded-full border border-[#d4af37]/45 bg-[#d4af37]/10">
              {row.avatarUrl ? <img src={row.avatarUrl} alt="" className="h-full w-full object-cover" /> : null}
              {!row.avatarUrl && <span className="flex h-full w-full items-center justify-center text-[10px] font-black text-[#f0d889]">{initialsFor(row.tiktokerName)}</span>}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-black leading-none tracking-tighter text-white">@{row.tiktokerName}</p>
              <p className="mt-0.5 truncate text-[9px] font-semibold uppercase leading-none tracking-tighter text-zinc-500">
                {row.acceptedDossiers}/{row.totalDossiers} nominés · {row.votes} notes · {row.average ? row.average.toFixed(1) : "-"}★
              </p>
            </div>
            <span className="gold-pill shrink-0">{row.points} pts</span>
          </div>

          <div className="mt-1 grid grid-cols-[minmax(0,1fr)_7.25rem_2.25rem] items-end gap-2 pl-[3.4rem]">
            <div className="stat-bar">
              <motion.div className="stat-bar-fill" initial={{ width: 0 }} animate={{ width: `${row.successRate}%` }} transition={{ delay: index * 0.035 + 0.1, duration: 0.45 }} />
            </div>
            <MicroDimensionBars scores={row.dimensionTotals} />
            <p className="text-right text-[10px] font-black leading-none tracking-tighter text-[#f0d889]">{row.successRate}%</p>
          </div>
        </motion.article>
      ))}
    </div>
  );
}
