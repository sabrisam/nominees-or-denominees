import Image from "next/image";
import { motion } from "framer-motion";
import { BrutalCard } from "@/components/ui/BrutalCard";
import { MicroDimensionBars } from "@/components/ui/MicroDimensionBars";
import { FALLBACK_IMAGE_URL } from "@/constants/categories";
import type { CategoryRace } from "@/types";

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function CategoryRaceBoard({ races }: { races: CategoryRace[] }) {
  return (
    <div className="space-y-2">
      {races.map(({ category, rows, totalDossiers }) => {
        const Icon = category.icon;
        const leader = rows[0];

        return (
          <BrutalCard key={category.id} className="p-0">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-2 py-1.5">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[9px] font-black uppercase leading-none tracking-tighter text-champagne">
                  <Icon className="h-3 w-3 shrink-0" /> {category.label}
                </p>
                <p className="mt-0.5 truncate text-[10px] font-semibold uppercase leading-none tracking-tighter text-zinc-500">{leader ? `Leader · ${leader.tiktokerName}` : "En attente"}</p>
              </div>
              <span className="gold-pill shrink-0">{totalDossiers} dossiers</span>
            </div>

            <div className="divide-y divide-white/10">
              {rows.length === 0 ? (
                <div className="px-2 py-2 text-center text-xs font-semibold text-zinc-500">Aucun nommé pour l&apos;instant</div>
              ) : (
                rows.map((row, index) => (
                  <motion.div
                    key={`${category.id}-${row.tiktokerName}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.028, type: "spring", stiffness: 240, damping: 26 }}
                    className="px-2 py-1.5"
                  >
                    <div className="grid grid-cols-[1rem_2rem_minmax(0,1fr)_auto] items-center gap-2">
                      <p className="rank-number text-[1.1rem] leading-none text-champagne">{index + 1}</p>
                      <div className="relative h-8 w-8 overflow-hidden rounded-full border border-champagne/45 bg-champagne/10">
                        {row.avatarUrl ? (
                          <Image
                            src={row.avatarUrl}
                            alt=""
                            fill
                            unoptimized
                            sizes="32px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[9px] font-black text-champagneSoft">{initialsFor(row.tiktokerName)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black leading-none tracking-tighter text-white">@{row.tiktokerName}</p>
                        <p className="mt-0.5 truncate text-[9px] font-semibold uppercase leading-none tracking-tighter text-zinc-500">
                          {row.acceptedDossiers}/{row.totalDossiers} nominés · {row.votes} notes · {row.average ? row.average.toFixed(1) : "-"}★
                        </p>
                      </div>
                      <span className="gold-pill shrink-0">{row.points} pts</span>
                    </div>

                    <div className="mt-1 grid grid-cols-[minmax(0,1fr)_7rem_2.25rem] items-end gap-2 pl-[3rem]">
                      <div className="stat-bar">
                        <motion.div className="stat-bar-fill" initial={{ width: 0 }} animate={{ width: `${row.successRate}%` }} transition={{ delay: index * 0.03 + 0.08, duration: 0.42 }} />
                      </div>
                      <MicroDimensionBars scores={row.dimensionTotals} />
                      <p className="text-right text-[10px] font-black leading-none tracking-tighter text-champagneSoft">{row.successRate}%</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </BrutalCard>
        );
      })}
    </div>
  );
}
