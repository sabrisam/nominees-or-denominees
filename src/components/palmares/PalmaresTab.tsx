import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  HelpCircle,
  TrendingUp,
  Award,
  Activity,
  Heart,
  CheckCircle,
} from "lucide-react";
import { BrutalCard } from "../ui/BrutalCard";
import { getCategoryMeta } from "@/lib/scoring";
import type { PalmaresRow, Tab } from "@/types";
import { useState, useMemo } from "react";
import { RATING_DIMENSIONS } from "@/constants/categories";

const TAP_REBOUND = { scale: 0.965, rotate: -0.35 };
const TAP_TRANSITION = {
  type: "spring",
  stiffness: 900,
  damping: 32,
  mass: 0.42,
} as const;

// Helper to compute SVG Radar polygon path
function getRadarPath(row: PalmaresRow, maxRadius = 70, center = 100) {
  const points = RATING_DIMENSIONS.map((dim, i) => {
    // Normalise dimension total average score
    const avgScore =
      row.votes > 0 ? row.dimensionTotals[dim.key] / row.votes : 0;
    const radius = (Math.min(5, Math.max(0, avgScore)) / 5) * maxRadius;
    const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2; // Start from top
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    return `${x},${y}`;
  });
  return points.join(" ");
}

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
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  const selectedRow = useMemo(() => {
    return palmaresRows[selectedIdx] ?? palmaresRows[0] ?? null;
  }, [palmaresRows, selectedIdx]);

  // Compute category share totals for the selected TikToker
  const categoryShare = useMemo(() => {
    if (!selectedRow) return [];
    const counts = selectedRow.categoryCounts;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([id, count]) => ({
        id,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [selectedRow]);

  // Find max points to scale bar chart
  const maxPoints = useMemo(() => {
    return Math.max(...palmaresRows.map((r) => r.points), 1);
  }, [palmaresRows]);

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
        <BrutalCard tone="black" className="p-3 text-white border-champagne/30">
          <p className="mb-1 text-[8px] font-black uppercase tracking-[0.2em] text-champagne">
            Classement
          </p>
          <h2 className="tabloid-headline text-[clamp(1.55rem,7.8vw,2.7rem)] leading-[0.84]">
            PALMARÈS
          </h2>
        </BrutalCard>
        <BrutalCard className="p-6 text-center border-white/5 bg-black/50">
          <Trophy className="mx-auto mb-2 h-8 w-8 text-champagne" />
          <p className="tabloid-headline text-2xl leading-none text-white">
            AUCUN PROFIL ÉVALUÉ POUR L'INSTANT
          </p>
          <p className="mx-auto mt-1 max-w-[15rem] text-[10px] font-semibold uppercase tracking-tighter text-zinc-500">
            Le palmarès se mettra à jour après le premier SCREEN noté.
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
      transition={{
        duration: reduceMotion ? 0.01 : 0.26,
        type: "spring",
        stiffness: 230,
        damping: 25,
      }}
      className="space-y-3 pb-8"
    >
      {/* Title */}
      <BrutalCard
        tone="black"
        className="p-3 text-white border-champagne/20 bg-monolith"
      >
        <p className="mb-1 text-[8px] font-black uppercase tracking-[0.2em] text-champagne font-sans">
          Stats central
        </p>
        <h2 className="tabloid-headline text-[clamp(1.55rem,7.8vw,2.7rem)] leading-[0.84] font-serif italic normal-case">
          Palmarès
        </h2>
      </BrutalCard>

      {/* TIKTOKERS HORIZONTAL SELECTOR RAIL */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none snap-x pointer-events-auto">
        {palmaresRows.slice(0, 8).map((row, index) => {
          const active = selectedIdx === index;
          return (
            <motion.button
              key={`sel-${row.tiktokerName}`}
              whileTap={TAP_REBOUND}
              transition={TAP_TRANSITION}
              onClick={() => setSelectedIdx(index)}
              className={`snap-center flex shrink-0 items-center gap-2 rounded-[10px] border px-3 py-1.5 transition font-sans ${
                active
                  ? "border-champagne bg-champagne/15 text-champagneSoft"
                  : "border-white/10 bg-monolith text-zinc-400 hover:border-white/20"
              }`}
            >
              <div className="h-5 w-5 rounded-full border border-champagne/40 bg-void overflow-hidden shrink-0">
                {row.avatarUrl ? (
                  <img
                    src={row.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[7px] font-black text-champagneSoft font-sans">
                    {row.tiktokerName.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-black uppercase tracking-tight font-sans">
                @{row.tiktokerName}
              </span>
              <span className="text-[9px] font-mono opacity-80 font-sans">
                #{index + 1}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* SELECTED CELEBRITY PROFILE DETAIL */}
      <AnimatePresence mode="wait">
        {selectedRow && (
          <motion.div
            key={selectedRow.tiktokerName}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="space-y-3"
          >
            {/* Main profile card */}
            <BrutalCard
              tone="black"
              className="p-4 bg-monolith border-champagne/20"
            >
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 overflow-hidden rounded-full border-2 border-champagne bg-void shrink-0">
                  {selectedRow.avatarUrl ? (
                    <img
                      src={selectedRow.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-black text-champagneSoft font-sans">
                      {selectedRow.tiktokerName.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-black uppercase tracking-tight text-white leading-none font-serif italic normal-case">
                    @{selectedRow.tiktokerName}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 font-sans">
                    <span className="gold-pill text-[9px] font-black px-2 py-0.5 font-sans">
                      {selectedRow.points} POINTS
                    </span>
                    <span className="text-[10px] text-zinc-500 uppercase font-black font-sans">
                      INDICE MOYEN : {Math.round(selectedRow.average * 20)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Consolidates Statistics Tiles */}
              <div className="grid grid-cols-4 gap-1.5 mt-4">
                <div className="rounded-[8px] border border-white/5 bg-void/30 p-2 text-center">
                  <TrendingUp className="mx-auto mb-1 h-3.5 w-3.5 text-champagne" />
                  <span className="block text-[14px] font-serif font-black leading-none text-white">
                    {selectedRow.totalDossiers}
                  </span>
                  <span className="mt-0.5 block text-[6.5px] font-black uppercase tracking-tighter text-zinc-500 font-sans">
                    DOSSIERS
                  </span>
                </div>
                <div className="rounded-[8px] border border-white/5 bg-void/30 p-2 text-center">
                  <CheckCircle className="mx-auto mb-1 h-3.5 w-3.5 text-emerald-400" />
                  <span className="block text-[14px] font-serif font-black leading-none text-white">
                    {selectedRow.acceptedDossiers}
                  </span>
                  <span className="mt-0.5 block text-[6.5px] font-black uppercase tracking-tighter text-zinc-500 font-sans">
                    NOMINÉS
                  </span>
                </div>
                <div className="rounded-[8px] border border-white/5 bg-void/30 p-2 text-center">
                  <Activity className="mx-auto mb-1 h-3.5 w-3.5 text-[#a78bfa]" />
                  <span className="block text-[14px] font-serif font-black leading-none text-white">
                    {selectedRow.votes}
                  </span>
                  <span className="mt-0.5 block text-[6.5px] font-black uppercase tracking-tighter text-zinc-500 font-sans">
                    VOTES RECUS
                  </span>
                </div>
                <div className="rounded-[8px] border border-white/5 bg-void/30 p-2 text-center">
                  <Award className="mx-auto mb-1 h-3.5 w-3.5 text-yellow-500" />
                  <span className="block text-[14px] font-serif font-black leading-none text-white">
                    {selectedRow.average ? selectedRow.average.toFixed(1) : "-"}
                  </span>
                  <span className="mt-0.5 block text-[6.5px] font-black uppercase tracking-tighter text-zinc-500 font-sans">
                    NOTE MOY.
                  </span>
                </div>
              </div>
            </BrutalCard>

            {/* VISUAL DATA VISUALIZATIONS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* SVG RADAR CHART (EMOTIONAL FOOTPRINT) */}
              <BrutalCard
                tone="black"
                className="p-3 bg-monolith border-champagne/20 flex flex-col items-center"
              >
                <h3 className="text-[8.5px] font-black uppercase tracking-[0.16em] text-champagne w-full text-left mb-3 font-sans">
                  🎯 EMPREINTE ÉMOTIONNELLE
                </h3>

                <div className="relative w-48 h-48 select-none">
                  <svg viewBox="0 0 200 200" className="w-full h-full">
                    {/* Concentric grids representing ratings 1-5 */}
                    {[14, 28, 42, 56, 70].map((radius, rIndex) => {
                      const points = RATING_DIMENSIONS.map((_, i) => {
                        const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                        const x = 100 + radius * Math.cos(angle);
                        const y = 100 + radius * Math.sin(angle);
                        return `${x},${y}`;
                      }).join(" ");
                      return (
                        <polygon
                          key={`grid-${radius}`}
                          points={points}
                          fill="none"
                          stroke="#d4af37"
                          strokeWidth="0.5"
                          strokeOpacity={rIndex === 4 ? 0.3 : 0.12}
                          strokeDasharray={rIndex < 4 ? "2,2" : undefined}
                        />
                      );
                    })}

                    {/* Axes lines */}
                    {RATING_DIMENSIONS.map((_, i) => {
                      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                      const x = 100 + 70 * Math.cos(angle);
                      const y = 100 + 70 * Math.sin(angle);
                      return (
                        <line
                          key={`axis-${i}`}
                          x1="100"
                          y1="100"
                          x2={x}
                          y2={y}
                          stroke="#d4af37"
                          strokeWidth="0.5"
                          strokeOpacity="0.2"
                        />
                      );
                    })}

                    {/* Radar Value Polygon */}
                    <polygon
                      points={getRadarPath(selectedRow)}
                      fill="rgba(212, 175, 55, 0.14)"
                      stroke="#d4af37"
                      strokeWidth="1.5"
                      className="transition-all duration-500 ease-out"
                    />

                    {/* Vertices indicator points */}
                    {RATING_DIMENSIONS.map((dim, i) => {
                      const avgScore =
                        selectedRow.votes > 0
                          ? selectedRow.dimensionTotals[dim.key] /
                            selectedRow.votes
                          : 0;
                      const radius =
                        (Math.min(5, Math.max(0, avgScore)) / 5) * 70;
                      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                      const x = 100 + radius * Math.cos(angle);
                      const y = 100 + radius * Math.sin(angle);
                      return (
                        <circle
                          key={`dot-${dim.key}`}
                          cx={x}
                          cy={y}
                          r="3.5"
                          fill="#d4af37"
                          stroke="#050505"
                          strokeWidth="1"
                          className="transition-all duration-500 ease-out"
                        />
                      );
                    })}
                  </svg>

                  {/* Labels absolutely positioned around radar chart */}
                  {RATING_DIMENSIONS.map((dim, i) => {
                    const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                    // Push labels slightly outside the 70 max radius
                    const x = 100 + 88 * Math.cos(angle);
                    const y = 100 + 82 * Math.sin(angle);
                    const avgScore =
                      selectedRow.votes > 0
                        ? selectedRow.dimensionTotals[dim.key] /
                          selectedRow.votes
                        : 0;

                    return (
                      <div
                        key={`lbl-${dim.key}`}
                        style={{
                          position: "absolute",
                          left: `${x}%`,
                          top: `${y}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                        className="text-center font-black select-none pointer-events-none"
                      >
                        <span className="block text-[9px] text-white leading-none font-sans">
                          {dim.emoji} {dim.label}
                        </span>
                        <span className="block text-[8px] font-serif text-champagne leading-none mt-0.5">
                          {avgScore.toFixed(1)}/5
                        </span>
                      </div>
                    );
                  })}
                </div>
              </BrutalCard>

              {/* CATEGORIES SHARE (HORIZONTAL STACKED BAR / PIE LIST) */}
              <BrutalCard
                tone="black"
                className="p-3 bg-monolith border-champagne/20 flex flex-col justify-between"
              >
                <div className="space-y-3 w-full">
                  <h3 className="text-[8.5px] font-black uppercase tracking-[0.16em] text-champagne w-full text-left font-sans">
                    📊 RÉPARTITION DES CATÉGORIES
                  </h3>

                  {categoryShare.length === 0 ? (
                    <p className="text-[10px] font-black uppercase tracking-tight text-zinc-500 py-6 text-center font-sans">
                      Aucune catégorie enregistrée.
                    </p>
                  ) : (
                    <div className="space-y-2 pt-1 w-full">
                      {/* Visual stacked bar */}
                      <div className="flex h-3 w-full overflow-hidden rounded-[4px] border border-white/10 bg-void">
                        {categoryShare.map((cat, i) => {
                          const colors = [
                            "bg-champagne",
                            "bg-[#a78bfa]",
                            "bg-[#38bdf8]",
                            "bg-[#facc15]",
                            "bg-[#f43f5e]",
                            "bg-[#22c55e]",
                            "bg-[#ea580c]",
                            "bg-[#06b6d4]",
                            "bg-[#14b8a6]",
                          ];
                          const col = colors[i % colors.length];
                          return (
                            <div
                              key={`stack-${cat.id}`}
                              style={{ width: `${cat.percentage}%` }}
                              className={`${col} h-full`}
                              title={`${getCategoryMeta(cat.id).label}: ${cat.percentage}%`}
                            />
                          );
                        })}
                      </div>

                      {/* Breakdown List */}
                      <div className="space-y-1.5 mt-3">
                        {categoryShare.map((cat, i) => {
                          const meta = getCategoryMeta(cat.id);
                          const colors = [
                            "border-champagne text-champagne",
                            "border-[#a78bfa] text-[#a78bfa]",
                            "border-[#38bdf8] text-[#38bdf8]",
                            "border-[#facc15] text-[#facc15]",
                            "border-[#f43f5e] text-[#f43f5e]",
                            "border-[#22c55e] text-[#22c55e]",
                            "border-[#ea580c] text-[#ea580c]",
                            "border-[#06b6d4] text-[#06b6d4]",
                            "border-[#14b8a6] text-[#14b8a6]",
                          ];
                          const borderCol = colors[i % colors.length];
                          return (
                            <div
                              key={`list-${cat.id}`}
                              className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-tight"
                            >
                              <span className="flex items-center gap-1.5 truncate text-zinc-300 font-sans">
                                <span
                                  className={`inline-block h-2 w-2 rounded-full border ${borderCol.split(" ")[0]}`}
                                />
                                {meta.label}
                              </span>
                              <span className="font-serif text-white text-right">
                                {cat.count} ({cat.percentage}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </BrutalCard>
            </div>

            {/* VERTICAL COMPARISON BAR CHART (TOP TIKTOKERS BY POINTS) */}
            <BrutalCard
              tone="black"
              className="p-3 bg-monolith border-champagne/20"
            >
              <h3 className="text-[8.5px] font-black uppercase tracking-[0.16em] text-champagne mb-4 font-sans">
                📈 CLASSEMENT DES ZINS (CUMUL DE POINTS)
              </h3>

              <div className="flex items-end justify-between gap-3 h-28 px-2 pt-2 border-b border-white/10 select-none">
                {palmaresRows.slice(0, 5).map((row, index) => {
                  const heightPct = Math.round((row.points / maxPoints) * 100);
                  const active = selectedIdx === index;

                  return (
                    <div
                      key={`bar-${row.tiktokerName}`}
                      className="flex flex-col items-center flex-1 min-w-0 snap-center pointer-events-auto cursor-pointer"
                      onClick={() => setSelectedIdx(index)}
                    >
                      {/* Tooltip points */}
                      <span className="block text-[8px] font-serif font-black text-champagne leading-none mb-1">
                        {row.points}
                      </span>

                      {/* Bar */}
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPct}%` }}
                        transition={{
                          type: "spring",
                          stiffness: 180,
                          damping: 20,
                          delay: index * 0.05,
                        }}
                        className={`w-full max-w-[1.75rem] rounded-t-[4px] border-t border-l border-r transition ${
                          active
                            ? "border-champagne bg-champagne/35 shadow-[0_0_12px_rgba(212,175,55,0.25)]"
                            : "border-white/10 bg-white/5 hover:border-white/30"
                        }`}
                      />

                      {/* Label */}
                      <span
                        className={`block truncate text-[7.5px] font-black uppercase tracking-tight text-center w-full mt-1.5 ${active ? "text-champagneSoft" : "text-zinc-500"} font-sans`}
                      >
                        @{row.tiktokerName.slice(0, 6)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </BrutalCard>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
