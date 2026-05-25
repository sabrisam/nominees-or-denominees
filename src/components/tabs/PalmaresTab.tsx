import Image from "next/image";
import React, { useState, useMemo } from "react";
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
import type { PalmaresRow, Tab, Nomination } from "@/types";

const PalmaresRowItem = React.memo(({
  row,
  index,
  isExpanded,
  onToggle,
  reduceMotion,
  allNominations,
}: {
  row: PalmaresRow;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  reduceMotion: boolean;
  allNominations: Nomination[];
}) => {
  const successRateFormatted = useMemo(() => row.successRate.toFixed(0), [row.successRate]);
  const averageScoreFormatted = useMemo(() => (row.average * 20).toFixed(0), [row.average]);

  const creatorNominations = useMemo(() => {
    return allNominations.filter(
      (n) => n.tiktoker_name.toLowerCase() === row.tiktokerName.toLowerCase()
    );
  }, [allNominations, row.tiktokerName]);

  const dimensionAverages = useMemo(() => {
    const totals = { rire: 0, surprise: 0, gene: 0, fierte: 0, interet: 0 };
    let count = 0;
    creatorNominations.forEach((n) => {
      n.ratings.forEach((r) => {
        totals.rire += r.scores?.rire ?? r.rire_score ?? 0;
        totals.surprise += r.scores?.surprise ?? r.surprise_score ?? 0;
        totals.gene += r.scores?.gene ?? r.gene_score ?? 0;
        totals.fierte += r.scores?.fierte ?? r.fierte_score ?? 0;
        totals.interet += r.scores?.interet ?? r.interet_score ?? 0;
        count++;
      });
    });
    return {
      rire: count > 0 ? totals.rire / count : 0,
      surprise: count > 0 ? totals.surprise / count : 0,
      gene: count > 0 ? totals.gene / count : 0,
      fierte: count > 0 ? totals.fierte / count : 0,
      interet: count > 0 ? totals.interet / count : 0,
    };
  }, [creatorNominations]);

  const historicalRatings = useMemo(() => {
    const list: Array<{ comment: string; voter: string; stars: number; date: string }> = [];
    creatorNominations.forEach((n) => {
      n.ratings.forEach((r) => {
        if (r.comment?.trim()) {
          list.push({
            comment: r.comment,
            voter: r.voter_id,
            stars: r.rating_stars,
            date: r.created_at,
          });
        }
      });
    });
    return list;
  }, [creatorNominations]);

  const nominatedCategories = useMemo(() => {
    return Object.entries(row.categoryCounts)
      .filter(([_, count]) => count > 0)
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count);
  }, [row.categoryCounts]);

  return (
    <BrutalCard
      tone="black"
      id={`palmares-row-${row.tiktokerName.toLowerCase()}`}
      className={`p-4 bg-monolith transition-all duration-300 ${
        isExpanded
          ? "border-[#d4af37]/60 ring-1 ring-[#d4af37]/30 shadow-[0_0_15px_rgba(212,175,55,0.1)]"
          : "border-white/5 hover:border-[#d4af37]/40"
      }`}
    >
      {/* Row Header - Clickable Trigger */}
      <div
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded}
        className="flex items-center justify-between cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#d4af37]/60 rounded-[4px]"
      >
        <div className="flex items-center gap-4 min-w-0">
          {/* Rank */}
          <span className="font-serif text-lg font-black text-[#d4af37]/70 italic w-6">
            #{index + 1}
          </span>

          {/* Avatar Frame */}
          <div className="relative h-10 w-10 overflow-hidden rounded-full border border-[#d4af37]/40 bg-void shrink-0 shadow-inner">
            {row.avatarUrl ? (
              <Image
                src={row.avatarUrl}
                alt=""
                fill
                sizes="40px"
                className="object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs font-black text-[#d4af37] font-mono tracking-tighter">
                {row.tiktokerName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          {/* Creator Identity */}
          <div className="min-w-0">
            <h3 className="text-xl font-serif font-black tracking-tight text-white capitalize leading-tight truncate">
              {row.tiktokerName}
            </h3>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans mt-0.5 font-bold">
              {row.totalDossiers}{" "}
              {row.totalDossiers > 1
                ? "dossiers soumis"
                : "dossier soumis"}
            </p>
          </div>
        </div>

        {/* Performance Pill & Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="gold-pill text-[10px] font-black px-2.5 py-1 font-sans tracking-tight bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30 rounded-[4px]">
            {row.points} PTS
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-[#d4af37] shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-600 shrink-0" />
          )}
        </div>
      </div>

      {/* Collapsible Micro-Dashboard Sheet */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={
              reduceMotion
                ? { opacity: 1, height: "auto" }
                : { opacity: 0, height: 0 }
            }
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              duration: reduceMotion ? 0.01 : 0.25,
              ease: "easeInOut",
            }}
            className="overflow-hidden"
          >
            {/* High-Contrast Analytical Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-[#d4af37]/20 bg-[#070707]/60 p-2 rounded-[6px]">
              {/* Cumulative Weight */}
              <div className="rounded-[4px] border border-white/5 bg-monolith p-2.5 text-center">
                <Award className="mx-auto mb-1 h-4 w-4 text-[#d4af37]" />
                <span className="block text-lg font-serif font-black leading-none text-white">
                  {row.points}
                </span>
                <span className="mt-1 block text-[7px] font-black uppercase tracking-wider text-zinc-500 font-sans">
                  POINTS CUMULÉS
                </span>
              </div>

              {/* Score Index */}
              <div className="rounded-[4px] border border-white/5 bg-monolith p-2.5 text-center">
                <TrendingUp className="mx-auto mb-1 h-4 w-4 text-sky" />
                <span className="block text-lg font-serif font-black leading-none text-white">
                  {averageScoreFormatted}%
                </span>
                <span className="mt-1 block text-[7px] font-black uppercase tracking-wider text-zinc-500 font-sans">
                  INDICE DE NOTE
                </span>
              </div>

              {/* Total Engagement */}
              <div className="rounded-[4px] border border-white/5 bg-monolith p-2.5 text-center">
                <Activity className="mx-auto mb-1 h-4 w-4 text-violet" />
                <span className="block text-lg font-serif font-black leading-none text-white">
                  {row.votes}
                </span>
                <span className="mt-1 block text-[7px] font-black uppercase tracking-wider text-zinc-500 font-sans">
                  VOTES REÇUS
                </span>
              </div>

              {/* Success Rate */}
              <div className="rounded-[4px] border border-white/5 bg-monolith p-2.5 text-center">
                <CheckCircle className="mx-auto mb-1 h-4 w-4 text-emerald-400" />
                <span className="block text-lg font-serif font-black leading-none text-white">
                  {successRateFormatted}%
                </span>
                <span className="mt-1 block text-[7px] font-black uppercase tracking-wider text-zinc-500 font-sans">
                  TAUX DE SUCCÈS
                </span>
              </div>
            </div>

            {/* Categorized Impact Track */}
            <div className="mt-4 pt-3.5 border-t border-white/5">
              <h4 className="text-[8px] font-black uppercase tracking-[0.16em] text-[#d4af37]/80 mb-2.5 font-sans">
                CATÉGORIES NOMINÉES CE MOIS-CI
              </h4>
              {nominatedCategories.length === 0 ? (
                <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600 py-1 font-sans italic">
                  Aucune catégorie enregistrée
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {nominatedCategories.map(({ id, count }) => {
                    const meta = getCategoryMeta(id);
                    const Icon = meta.icon;

                    const colors = {
                      positive:
                        "border-[#d4af37]/30 text-[#d4af37] bg-[#d4af37]/5",
                      fun: "border-violet/30 text-violet bg-violet/5",
                      critical: "border-rose/30 text-rose bg-rose/5",
                      surprise: "border-sky/30 text-sky bg-sky/5",
                    };
                    const themeClass =
                      colors[meta.mood] ||
                      "border-white/10 text-white bg-white/5";

                    return (
                      <div
                        key={id}
                        className={`flex items-center justify-between px-3 py-2 rounded-[4px] border ${themeClass}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-tight text-white truncate font-sans">
                            {meta.label}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono font-black text-[#d4af37]/80 shrink-0">
                          {count} {count > 1 ? "DOSSIERS" : "DOSSIER"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Dimensions d'Impact Émotionnel (Aggregated Stats) */}
            <div className="mt-4 pt-3.5 border-t border-white/5">
              <h4 className="text-[8px] font-black uppercase tracking-[0.16em] text-[#d4af37]/80 mb-2.5 font-sans">
                MOYENNES ÉMOTIONNELLES ACCUMULÉES
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { key: "rire", label: "Rire", emoji: "😂", val: dimensionAverages.rire, color: "bg-yellow-400" },
                  { key: "surprise", label: "Surprise", emoji: "🤯", val: dimensionAverages.surprise, color: "bg-sky-400" },
                  { key: "gene", label: "Gêne", emoji: "🤦", val: dimensionAverages.gene, color: "bg-rose-400" },
                  { key: "fierte", label: "Fierté", emoji: "✊", val: dimensionAverages.fierte, color: "bg-amber-100" },
                  { key: "interet", label: "Intérêt", emoji: "🤔", val: dimensionAverages.interet, color: "bg-violet-400" },
                ].map((dim) => (
                  <div key={dim.key} className="rounded-[4px] border border-white/5 bg-monolith p-2 text-center">
                    <span className="text-sm block">{dim.emoji}</span>
                    <span className="block text-[10px] font-serif font-black text-white mt-1">
                      {dim.val.toFixed(1)}★
                    </span>
                    <span className="block text-[6.5px] font-sans font-black text-zinc-500 uppercase tracking-tight mt-0.5">
                      {dim.label}
                    </span>
                    <div className="stat-bar mt-1.5 w-full bg-void">
                      <div 
                        className={`stat-bar-fill ${dim.color}`} 
                        style={{ width: `${(dim.val / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Screens de la Saison (Folders tagged in) */}
            <div className="mt-4 pt-3.5 border-t border-white/5">
              <h4 className="text-[8px] font-black uppercase tracking-[0.16em] text-[#d4af37]/80 mb-2.5 font-sans">
                DOSSIERS DE LA SAISON ({creatorNominations.length})
              </h4>
              {creatorNominations.length === 0 ? (
                <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600 py-1 font-sans italic">
                  Aucun dossier enregistré
                </p>
              ) : (
                <div className="space-y-1.5">
                  {creatorNominations.map((n) => {
                    const score = n.ratings.length > 0
                      ? (n.ratings.reduce((acc, curr) => acc + curr.rating_points, 0) / n.ratings.length).toFixed(0)
                      : "0";
                    return (
                      <div key={n.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-[4px] border border-white/5 bg-void">
                        <div className="min-w-0 pr-2">
                          <p className="text-[10px] font-sans font-medium text-white truncate">
                            &ldquo;{n.comment || "Sans contexte"}&rdquo;
                          </p>
                          <p className="text-[7.5px] font-sans font-black text-zinc-500 uppercase tracking-widest mt-0.5">
                            PAR @{n.submitted_by.slice(0, 8).toUpperCase()} · STATUS: {n.status === "pending" ? "À VOTER" : "NOMINÉ"}
                          </p>
                        </div>
                        <span className="gold-pill text-[8.5px] px-2 py-0.5 shrink-0">
                          {score} PTS
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Historical Ratings comments */}
            <div className="mt-4 pt-3.5 border-t border-white/5">
              <h4 className="text-[8px] font-black uppercase tracking-[0.16em] text-[#d4af37]/80 mb-2.5 font-sans">
                COMMENTAIRES DU CONSEIL
              </h4>
              {historicalRatings.length === 0 ? (
                <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600 py-1 font-sans italic">
                  Aucune note avec commentaire enregistrée
                </p>
              ) : (
                <div className="space-y-2">
                  {historicalRatings.map((rating, idx) => (
                    <div key={idx} className="rounded-[4px] border border-white/5 bg-void p-2">
                      <p className="text-[10px] font-serif font-medium text-zinc-300 italic leading-tight">
                        &ldquo;{rating.comment}&rdquo;
                      </p>
                      <div className="flex items-center justify-between mt-1 text-[7.5px] font-sans font-black uppercase tracking-wider text-zinc-500">
                        <span>@{rating.voter.slice(0, 8).toUpperCase()}</span>
                        <span className="text-[#d4af37]">{rating.stars}★</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </BrutalCard>
  );
});

PalmaresRowItem.displayName = "PalmaresRowItem";

export function PalmaresTab({
  palmaresRows,
  allNominations,
  switchTab,
  handleSectionDrag,
  reduceMotion,
  pageTransition,
  initialExpandedTiktoker,
}: {
  palmaresRows: PalmaresRow[];
  allNominations: Nomination[];
  switchTab: (t: Tab) => void;
  handleSectionDrag: (info: any) => void;
  reduceMotion: boolean;
  pageTransition: any;
  initialExpandedTiktoker?: string | null;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  React.useEffect(() => {
    if (initialExpandedTiktoker && palmaresRows.length > 0) {
      const idx = palmaresRows.findIndex(
        (row) => row.tiktokerName.toLowerCase() === initialExpandedTiktoker.toLowerCase()
      );
      if (idx !== -1) {
        setExpandedIdx(idx);
        setTimeout(() => {
          const el = document.getElementById(`palmares-row-${initialExpandedTiktoker.toLowerCase()}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 150);
      }
    }
  }, [initialExpandedTiktoker, palmaresRows]);

  if (palmaresRows.length === 0) {
    return (
      <motion.section
        key="palmares"
        {...pageTransition}
        drag={reduceMotion ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={(_, info) => handleSectionDrag(info)}
        className="space-y-3 px-4"
      >
        <BrutalCard
          tone="black"
          className="p-4 text-white border-[#d4af37]/20 bg-monolith"
        >
          <p className="mb-1 text-[8px] font-black uppercase tracking-[0.2em] text-[#d4af37] font-sans">
            Stats central
          </p>
          <h2 className="tabloid-headline text-[clamp(1.75rem,8vw,3rem)] leading-[0.84] font-serif italic normal-case font-black">
            Palmarès
          </h2>
        </BrutalCard>

        <BrutalCard className="p-8 text-center border-white/5 bg-monolith shadow-brutal">
          <Trophy className="mx-auto mb-3 h-10 w-10 text-[#d4af37]" />
          <p className="tabloid-headline text-2xl leading-none text-white font-serif italic font-bold">
            AUCUN PROFIL ÉVALUÉ POUR L{"'"}INSTANT
          </p>
          <p className="mx-auto mt-2 max-w-[18rem] text-[9px] font-black uppercase tracking-wider text-zinc-500 font-sans">
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
      className="space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom)+80px)]"
    >
      {/* Editorial Header */}
      <BrutalCard
        tone="black"
        className="p-4 text-white border-[#d4af37]/20 bg-monolith shadow-brutal"
      >
        <p className="mb-1 text-[8px] font-black uppercase tracking-[0.2em] text-[#d4af37] font-sans">
          Stats central
        </p>
        <h2 className="tabloid-headline text-[clamp(1.75rem,8vw,3rem)] leading-[0.84] font-serif italic normal-case font-black">
          Palmarès
        </h2>
      </BrutalCard>

      {/* High-Density Row List */}
      <div className="space-y-3">
        {palmaresRows.map((row, index) => (
          <PalmaresRowItem
            key={row.tiktokerName}
            row={row}
            index={index}
            isExpanded={expandedIdx === index}
            onToggle={() => setExpandedIdx(expandedIdx === index ? null : index)}
            reduceMotion={reduceMotion}
            allNominations={allNominations}
          />
        ))}
      </div>
    </motion.section>
  );
}
