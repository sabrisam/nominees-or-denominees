import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  TrendingUp,
  Award,
  Activity,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { BrutalCard } from "../ui/BrutalCard";
import { getCategoryMeta } from "@/lib/scoring";
import type { PalmaresRow, Tab } from "@/types";
import { useState } from "react";

export function PalmaresTab({
  palmaresRows,
  switchTab,
  handleSectionDrag,
  reduceMotion,
  pageTransition,
}: {
  palmaresRows: PalmaresRow[];
  switchTab: (t: Tab) => void;
  handleSectionDrag: (info: any) => void;
  reduceMotion: boolean;
  pageTransition: any;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  if (palmaresRows.length === 0) {
    return (
      <motion.section
        key="palmares"
        {...pageTransition}
        drag={reduceMotion ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={(_, info) => handleSectionDrag(info)}
        className="space-y-2"
      >
        <BrutalCard tone="black" className="p-3 text-white border-champagne/30 bg-monolith">
          <p className="mb-1 text-[8px] font-black uppercase tracking-[0.2em] text-champagne font-sans">
            Stats central
          </p>
          <h2 className="tabloid-headline text-[clamp(1.55rem,7.8vw,2.7rem)] leading-[0.84] font-serif italic normal-case">
            Palmarès
          </h2>
        </BrutalCard>
        <BrutalCard className="p-6 text-center border-white/5 bg-black/50">
          <Trophy className="mx-auto mb-2 h-8 w-8 text-champagne" />
          <p className="tabloid-headline text-2xl leading-none text-white">
            AUCUN PROFIL ÉVALUÉ POUR L{"'"}INSTANT
          </p>
          <p className="mx-auto mt-1 max-w-[15rem] text-[10px] font-semibold uppercase tracking-tighter text-zinc-500 font-sans">
            Le palmarès se mettra à jour après le premier SCREEN noté
          </p>
        </BrutalCard>
      </motion.section>
    );
  }

  return (
    <motion.section
      key="palmares"
      {...pageTransition}
      drag={reduceMotion ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => handleSectionDrag(info)}
      className="space-y-3 pb-[calc(env(safe-area-inset-bottom)+2.5rem)]"
    >
      {/* Title */}
      <BrutalCard
        tone="black"
        className="p-3 text-white border-[#d4af37]/20 bg-monolith"
      >
        <p className="mb-1 text-[8px] font-black uppercase tracking-[0.2em] text-champagne font-sans">
          Stats central
        </p>
        <h2 className="tabloid-headline text-[clamp(1.55rem,7.8vw,2.7rem)] leading-[0.84] font-serif italic normal-case">
          Palmarès
        </h2>
      </BrutalCard>

      {/* Vertical list of high-density TikToker profile sheets */}
      <div className="space-y-2.5">
        {palmaresRows.map((row, index) => {
          const isExpanded = expandedIdx === index;
          const successRateFormatted = row.successRate.toFixed(0);
          const averageScoreFormatted = (row.average * 20).toFixed(0);

          const nominatedCategories = Object.entries(row.categoryCounts)
            .filter(([_, count]) => count > 0)
            .map(([id, count]) => ({ id, count }))
            .sort((a, b) => b.count - a.count);

          return (
            <BrutalCard
              key={row.tiktokerName}
              tone="black"
              className={`p-3 bg-monolith border-[#d4af37]/20 transition-all ${
                isExpanded ? "border-champagne/55 ring-1 ring-champagne/30" : "hover:border-champagne/40"
              }`}
            >
              {/* Accessible Card Header button for toggling */}
              <button
                type="button"
                onClick={() => setExpandedIdx(isExpanded ? null : index)}
                aria-expanded={isExpanded}
                aria-label={`Profil de ${row.tiktokerName}, rang ${index + 1}`}
                className="w-full flex items-center justify-between select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-[#d4af37]/40 rounded-[8px] p-0.5 text-left"
              >
                <div className="flex items-center gap-3">
                  {/* Rank Badge */}
                  <span className="font-mono text-xs font-black text-champagne/80 tracking-tighter tabular-nums">
                    #{index + 1}
                  </span>
                  
                  {/* Avatar */}
                  <div className="relative h-9 w-9 overflow-hidden rounded-full border border-[#d4af37]/30 bg-void shrink-0">
                    {row.avatarUrl ? (
                      <Image
                        src={row.avatarUrl}
                        alt=""
                        fill
                        unoptimized
                        sizes="36px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[10px] font-black text-champagneSoft font-sans">
                        {row.tiktokerName.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Name & Quick Info */}
                  <div>
                    <h3 className="text-xl xs:text-2xl font-serif font-black italic text-white tracking-tight leading-none">
                      @{row.tiktokerName}
                    </h3>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-sans mt-0.5">
                      {row.totalDossiers} {row.totalDossiers > 1 ? "dossiers soumis" : "dossier soumis"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Points Badge */}
                  <span className="gold-pill text-[9px] font-black px-2 py-0.5 font-sans tracking-tight tabular-nums">
                    {row.points} PTS
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-champagne/70 shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0" aria-hidden="true" />
                  )}
                </div>
              </button>

              {/* Individual Profile Sheet details */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={reduceMotion ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0 }}
                    animate={reduceMotion ? { opacity: 1, height: "auto" } : { opacity: 1, height: "auto" }}
                    exit={reduceMotion ? { opacity: 0, height: 0 } : { opacity: 0, height: 0 }}
                    transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
                    className="overflow-hidden"
                  >
                    {/* High-contrast Metrics Breakdown Container */}
                    <div className="mt-4 p-3.5 bg-monolith border border-[#d4af37]/20 rounded-[12px] shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                      <div className="grid grid-cols-2 xs:grid-cols-4 gap-2.5">
                        {/* Cumulative Points */}
                        <div className="rounded-[8px] border border-white/5 bg-void p-2 text-center">
                          <Award className="mx-auto mb-1 h-4 w-4 text-champagne" aria-hidden="true" />
                          <span className="block text-base font-serif font-black leading-none text-white tabular-nums">
                            {row.points}
                          </span>
                          <span className="mt-1 block text-[7px] font-black uppercase tracking-tighter text-zinc-500 font-sans">
                            POINTS CUMULÉS
                          </span>
                        </div>

                        {/* Average Score */}
                        <div className="rounded-[8px] border border-white/5 bg-void p-2 text-center">
                          <TrendingUp className="mx-auto mb-1 h-4 w-4 text-sky" aria-hidden="true" />
                          <span className="block text-base font-serif font-black leading-none text-white tabular-nums">
                            {averageScoreFormatted}%
                          </span>
                          <span className="mt-1 block text-[7px] font-black uppercase tracking-tighter text-zinc-500 font-sans">
                            INDICE DE NOTE
                          </span>
                        </div>

                        {/* Votes Received */}
                        <div className="rounded-[8px] border border-white/5 bg-void p-2 text-center">
                          <Activity className="mx-auto mb-1 h-4 w-4 text-violet" aria-hidden="true" />
                          <span className="block text-base font-serif font-black leading-none text-white tabular-nums">
                            {row.votes}
                          </span>
                          <span className="mt-1 block text-[7px] font-black uppercase tracking-tighter text-zinc-500 font-sans">
                            VOTES REÇUS
                          </span>
                        </div>

                        {/* Success Rate */}
                        <div className="rounded-[8px] border border-white/5 bg-void p-2 text-center">
                          <CheckCircle className="mx-auto mb-1 h-4 w-4 text-emerald-400" aria-hidden="true" />
                          <span className="block text-base font-serif font-black leading-none text-white tabular-nums">
                            {successRateFormatted}%
                          </span>
                          <span className="mt-1 block text-[7px] font-black uppercase tracking-tighter text-zinc-500 font-sans">
                            TAUX DE SUCCÈS
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Nominated Categories Section */}
                    <div className="mt-3.5 pt-3.5 border-t border-white/5">
                      <h4 className="text-[8px] font-black uppercase tracking-[0.16em] text-champagne mb-2 font-sans">
                        CATÉGORIES NOMINÉES CE MOIS-CI
                      </h4>
                      {nominatedCategories.length === 0 ? (
                        <p className="text-[10px] font-black uppercase tracking-tight text-zinc-500 py-2 font-sans">
                          Aucune catégorie enregistrée
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {nominatedCategories.map(({ id, count }) => {
                            const meta = getCategoryMeta(id);
                            const Icon = meta.icon;
                            
                            // Category mood coloring
                            const colors = {
                              positive: "border-champagne/30 text-champagne bg-champagne/5",
                              fun: "border-violet/30 text-violet bg-violet/5",
                              critical: "border-rose/30 text-rose bg-rose/5",
                              surprise: "border-sky/30 text-sky bg-sky/5",
                            };
                            const themeClass = colors[meta.mood] || "border-white/10 text-white bg-white/5";

                            return (
                              <div
                                key={id}
                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-[6px] border ${themeClass}`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                  <span className="text-[9px] font-black uppercase tracking-tight text-white truncate font-sans">
                                    {meta.label}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono font-black text-champagneSoft tabular-nums">
                                  {count} {count > 1 ? "DOSSIERS" : "DOSSIER"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </BrutalCard>
          );
        })}
      </div>
    </motion.section>
  );
}
