import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Sparkles,
  Calendar,
  Trophy,
  Plus,
  HelpCircle,
  CheckCircle,
} from "lucide-react";
import { BrutalCard } from "../ui/BrutalCard";
import { SectionTitle } from "../ui/SectionTitle";
import { NominationCard } from "./NominationCard";
import { getCategoryMeta, averageImpact } from "@/lib/scoring";
import { CATEGORIES } from "@/constants/categories";
import type { Nomination, DirectFilter, Tab, PalmaresRow } from "@/types";
import { useMemo } from "react";

const HAPTICS = {
  option: 14,
};

function haptic(pattern: number) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nod-haptic", { detail: { pattern } }),
    );
  }
}

const TAP_REBOUND = { scale: 0.965, rotate: -0.35 };
const TAP_TRANSITION = {
  type: "spring",
  stiffness: 900,
  damping: 32,
  mass: 0.42,
} as const;

const DIRECT_FILTERS: Array<{ id: DirectFilter; label: string }> = [
  { id: "all", label: "Tout" },
  { id: "pending", label: "À voter" },
  { id: "qualified", label: "Nominés" },
  { id: "elite", label: "Favoris" },
  { id: "mine", label: "Moi" },
];

const CATEGORY_SLOGANS: Record<string, string> = {
  "le-zin-du-mois":
    "ALERTE ZIN : LE ZIN DU MOIS ATTEND TON DOSSIER D'ÉLITE ! BALANCE LE REPLAY SUR-LE-CHAMP.",
  "la-fierte-des-notres":
    "FIERTÉ LOCALE : LE TIKTOKER QUI HONORE LA COMMUNAUTÉ ? BALANCE-LE DIRECT AU STUDIO !",
  xptdr: "RIGOLADE MAX : UN FOUS-RIRE LÉGENDAIRE ? FAIS CROQUER LES ZINS !",
  "la-roue-libre":
    "ROUE LIBRE TOTALE : ENTIÈREMENT DÉCHAINÉ ! AJOUTE LA PÉPITE EN DIRECT DU STUDIO.",
  "la-honte-de-la-oumma":
    "ALERTE MALAISE : LA HONTE N'ATTEND PAS ! PROPOSE LA CATASTROPHE POUR ACTIVER LE MULTIPLICATEUR DE POINTS X1.5 !",
  "bon-voyageur":
    "GRAND VOYAGEUR : LA SURPRISE DE L'ANNÉE ? METS EN LUMIÈRE L'AVENTURIER DU CLUB !",
  "gros-chef-bandit":
    "GROS CHEF BANDIT : LE PAIRO DU NET FAIT DES SIENNES ? TOURNE LE PROJECTEUR SUR LUI !",
  "surprise-totale":
    "CHOC MENTAL : DU JAMAIS VU SUR TIKTOK ? RÉACTION À VOTER D'URGENCE !",
  "lanalyse-pure":
    "L'ANALYSE PURE : UN COMPORTEMENT DÉCRYPTÉ PAR LES EXPERTS ? METS LE CONTEXTE AU STUDIO !",
};

export function DirectTab({
  feedItems,
  directFilter,
  setDirectFilter,
  directFilterCounts,
  ownsNomination,
  startEditNomination,
  removeNomination,
  mutationBusyId,
  handleSectionDrag,
  reduceMotion,
  revealContainer,
  revealItem,
  pageTransition,
  pendingForMe,
  allNominations,
  ceremonyCountdown,
  palmaresRows,
  activeMemberCount,
  switchTab,
}: {
  feedItems: Nomination[];
  directFilter: DirectFilter;
  setDirectFilter: (f: DirectFilter) => void;
  directFilterCounts: Record<DirectFilter, number>;
  ownsNomination: (n: Nomination) => boolean;
  startEditNomination: (n: Nomination) => void;
  removeNomination: (n: Nomination) => Promise<void>;
  mutationBusyId: string | null;
  handleSectionDrag: (info: any) => void;
  reduceMotion: boolean;
  revealContainer: any;
  revealItem: any;
  pageTransition: any;
  pendingForMe: Nomination[];
  allNominations: Nomination[];
  ceremonyCountdown: { days: number; hours: number; mins: number };
  palmaresRows: PalmaresRow[];
  activeMemberCount: number;
  switchTab: (t: Tab) => void;
}) {
  // Submitter stats to identify top Paparazzi
  const topPaparazzi = useMemo(() => {
    const counts: Record<string, number> = {};
    allNominations.forEach((n) => {
      counts[n.submitted_by] = (counts[n.submitted_by] || 0) + 1;
    });
    let maxCount = 0;
    let topUser = "";
    Object.entries(counts).forEach(([uid, val]) => {
      if (val > maxCount) {
        maxCount = val;
        topUser = uid;
      }
    });
    return { count: maxCount, userId: topUser };
  }, [allNominations]);

  // Mixed feed builder for "all" tab
  const mixedFeed = useMemo(() => {
    if (directFilter !== "all") return [];

    // Exclude top 3 pending votes from the main feed to avoid duplicate rendering
    const pendingIds = new Set(pendingForMe.slice(0, 3).map((n) => n.id));
    const mainStream = allNominations
      .filter((n) => !pendingIds.has(n.id))
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

    const result: Array<{
      feedId: string;
      type: "nomination" | "ad" | "countdown" | "paparazzi";
      nomination?: Nomination;
      adCategory?: string;
    }> = [];

    let nominationIndex = 0;
    let categoryAdIndex = 0;

    for (let i = 0; nominationIndex < mainStream.length; i++) {
      if (i > 0 && i % 3 === 0) {
        const check = Math.floor(i / 3);
        if (check % 3 === 1) {
          // Category Promo
          const categoryId = CATEGORIES[categoryAdIndex % CATEGORIES.length].id;
          result.push({
            feedId: `ad-${categoryId}-${i}`,
            type: "ad",
            adCategory: categoryId,
          });
          categoryAdIndex++;
        } else if (check % 3 === 2) {
          // Countdown banner
          result.push({
            feedId: `countdown-${i}`,
            type: "countdown",
          });
        } else {
          // Paparazzi Banner
          result.push({
            feedId: `paparazzi-${i}`,
            type: "paparazzi",
          });
        }
      } else {
        result.push({
          feedId: `nomination-${mainStream[nominationIndex].id}`,
          type: "nomination",
          nomination: mainStream[nominationIndex],
        });
        nominationIndex++;
      }
    }

    return result;
  }, [directFilter, allNominations, pendingForMe]);

  return (
    <motion.section
      key="direct"
      {...pageTransition}
      {...revealContainer}
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
      {/* Brutal Header Cover */}
      <motion.div {...revealItem}>
        <BrutalCard className="relative overflow-hidden p-3.5 bg-[#0c0c0c] border-[#d4af37]/20 shadow-[8px_8px_0px_0px_#000000]">
          <div className="flex items-center justify-between gap-3">
            <p className="mb-1 text-[7.5px] font-black uppercase tracking-[0.2em] text-[#d4af37] font-sans">
              Club live
            </p>
            <span className="rounded-[8px] border border-[#d4af37]/30 bg-[#d4af37]/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-[#f0d889] font-sans">
              {activeMemberCount} MEMBRES
            </span>
          </div>
          <h1 className="tabloid-headline text-[clamp(1.78rem,8.9vw,3rem)] leading-[0.84] text-[#f5f1e8] font-serif italic normal-case">
            Nominees
            <span className="mx-1.5 inline-block rounded-[8px] border border-[#d4af37]/70 bg-[#d4af37]/15 px-1.5 py-0.5 text-[clamp(0.72rem,3.55vw,1.1rem)] font-sans font-black uppercase leading-none text-[#f0d889] not-italic">
              or
            </span>
            <span className="block text-[#d4af37] not-italic uppercase font-serif">
              Denominees
            </span>
          </h1>
          <div className="paper-tear -mt-[4px]" />
          <div className="rounded-[10px] border border-[#d4af37]/20 bg-[#050505]/75 px-2 py-1 text-white mt-1">
            <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400 font-sans">
              LE CLUB DES SCREENS DU MOIS
            </p>
          </div>
        </BrutalCard>
      </motion.div>

      {/* Filter Tabs grid */}
      <motion.div {...revealItem} className="space-y-2">
        <div
          className="grid grid-cols-5 gap-1.5"
          aria-label="Filtres du direct"
          role="group"
        >
          {DIRECT_FILTERS.map((filter) => {
            const active = directFilter === filter.id;
            return (
              <motion.button
                key={filter.id}
                type="button"
                whileTap={TAP_REBOUND}
                transition={TAP_TRANSITION}
                aria-pressed={active}
                onClick={() => setSetFilter(filter.id)}
                className={`rounded-[9px] border px-1 py-1.5 text-center transition font-sans ${
                  active
                    ? "border-[#d4af37]/80 bg-[#d4af37]/15 text-[#f0d889] shadow-[0_0_8px_rgba(212,175,55,0.15)]"
                    : "border-white/10 bg-[#0c0c0c] text-zinc-500 hover:border-white/20"
                }`}
              >
                <span className="block truncate text-[7.5px] font-black uppercase leading-none tracking-tighter font-sans">
                  {filter.label}
                </span>
                <span className="mt-0.5 block text-[11px] font-black leading-none tracking-tighter font-sans">
                  {directFilterCounts[filter.id]}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* URGENT VOTES DRAWER (Only when directFilter === "all" and pendingForMe has items) */}
        {directFilter === "all" && pendingForMe.length > 0 && (
          <div className="space-y-1.5 border-t border-b border-[#d4af37]/10 py-3">
            <div className="flex items-center gap-1.5 px-1">
              <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-500 font-serif">
                🔥 À JUGER D&apos;URGENCE ({pendingForMe.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              {pendingForMe.slice(0, 3).map((nomination) => (
                <NominationCard
                  key={`urgent-${nomination.id}`}
                  nomination={nomination}
                  owned={ownsNomination(nomination)}
                  onEdit={() => startEditNomination(nomination)}
                  onRemove={() => void removeNomination(nomination)}
                  onVote={() => switchTab("vote")}
                  busy={mutationBusyId === nomination.id}
                />
              ))}
            </div>
          </div>
        )}

        <SectionTitle>LE FLUX DU CLUB</SectionTitle>

        {/* FEED SECTION */}
        {directFilter === "all" ? (
          mixedFeed.length === 0 ? (
            <BrutalCard className="p-6 text-center border-[#d4af37]/10 bg-[#0c0c0c]">
              <Camera className="mx-auto mb-2 h-8 w-8 text-zinc-700" />
              <p className="text-xl font-black uppercase leading-none text-zinc-500 font-serif">
                Aucun SCREEN
              </p>
              <p className="mt-1 text-[9px] font-black uppercase text-zinc-600 font-sans">
                Le club est vide
              </p>
            </BrutalCard>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="flex flex-col gap-3">
                {mixedFeed.map((item) => {
                  if (item.type === "nomination" && item.nomination) {
                    return (
                      <motion.div
                        key={item.feedId}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{
                          layout: {
                            type: "spring",
                            stiffness: 380,
                            damping: 32,
                          },
                          duration: 0.22,
                        }}
                      >
                        <NominationCard
                          nomination={item.nomination}
                          owned={ownsNomination(item.nomination)}
                          onEdit={() => startEditNomination(item.nomination!)}
                          onRemove={() =>
                            void removeNomination(item.nomination!)
                          }
                          onVote={() => switchTab("vote")}
                          busy={mutationBusyId === item.nomination.id}
                        />
                      </motion.div>
                    );
                  }

                  if (item.type === "ad" && item.adCategory) {
                    const meta = getCategoryMeta(item.adCategory);
                    const Icon = meta.icon;
                    const slogan =
                      CATEGORY_SLOGANS[item.adCategory] ??
                      CATEGORY_SLOGANS["le-zin-du-mois"];
                    return (
                      <motion.div
                        key={item.feedId}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{
                          layout: {
                            type: "spring",
                            stiffness: 380,
                            damping: 32,
                          },
                          duration: 0.2,
                        }}
                      >
                        <BrutalCard
                          tone="black"
                          className="border-dashed border-[#d4af37]/20 bg-[#0c0c0c] p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30 rounded-[10px]">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="space-y-2">
                              <p className="text-[10.5px] font-black uppercase tracking-wide leading-tight text-[#f0d889] font-serif">
                                {slogan}
                              </p>
                              <motion.button
                                whileTap={TAP_REBOUND}
                                transition={TAP_TRANSITION}
                                onClick={() => switchTab("studio")}
                                className="brutal-action bg-white/5 border border-white/10 text-white text-[8px] font-black tracking-wider uppercase px-2.5 py-1 font-sans"
                              >
                                LANCER LE DOSSIER →
                              </motion.button>
                            </div>
                          </div>
                        </BrutalCard>
                      </motion.div>
                    );
                  }

                  if (item.type === "countdown") {
                    return (
                      <BrutalCard
                        key={item.feedId}
                        tone="yellow"
                        className="p-4 bg-[#d4af37]/10 border-[#d4af37]/20"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#d4af37] text-black rounded-[10px]">
                            <Calendar className="h-5 w-5" />
                          </div>
                          <div className="space-y-1.5">
                            <span className="inline-flex rounded-[6px] bg-[#d4af37] px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider text-black font-sans">
                              CÉRÉMONIE IMMINENTE ⏳
                            </span>
                            <p className="text-[10px] font-black uppercase leading-tight text-white mt-1 font-serif">
                              LA GRANDE FINALE DE SAISON APPROCHE ! DERNIÈRES
                              RECS À METTRE EN VOTE :
                            </p>
                            <p className="text-sm font-black text-[#f0d889] font-serif leading-none">
                              {ceremonyCountdown.days} JOURS{" "}
                              {ceremonyCountdown.hours}H{" "}
                              {ceremonyCountdown.mins}M
                            </p>
                            <motion.button
                              whileTap={TAP_REBOUND}
                              transition={TAP_TRANSITION}
                              onClick={() => switchTab("palmares")}
                              className="brutal-action bg-[#d4af37] text-black text-[8px] font-black tracking-wider uppercase px-2.5 py-1 mt-1 block font-sans"
                            >
                              VOIR LE PALMARÈS
                            </motion.button>
                          </div>
                        </div>
                      </BrutalCard>
                    );
                  }

                  if (item.type === "paparazzi") {
                    return (
                      <BrutalCard
                        key={item.feedId}
                        tone="black"
                        className="bg-[#0c0c0c] border-[#d4af37]/20 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-zinc-800 border border-zinc-700 text-[#d4af37] rounded-[10px]">
                            <Trophy className="h-5 w-5" />
                          </div>
                          <div className="space-y-1.5">
                            <span className="inline-flex rounded-[6px] border border-[#d4af37]/40 bg-[#d4af37]/15 px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider text-[#f0d889] font-sans">
                              ÉLITE PAPARAZZI 📸
                            </span>
                            <p className="text-[10px] font-black uppercase leading-tight text-zinc-300 font-serif">
                              QUI PRENDRA LE CONTRÔLE DE SAISON 1 ?
                            </p>
                            <p className="text-[9.5px] font-bold text-zinc-400 font-serif">
                              {topPaparazzi.count > 0
                                ? `Un paparazzi d'Élite est actuellement en tête avec un cumul de ${topPaparazzi.count} dossiers d'activités lancés !`
                                : "Aucun paparazzi n'a encore lancé de dossier. Ouvre le bal dans le studio !"}
                            </p>
                            <motion.button
                              whileTap={TAP_REBOUND}
                              transition={TAP_TRANSITION}
                              onClick={() => switchTab("studio")}
                              className="brutal-action bg-white/5 border border-white/10 text-white text-[8px] font-black tracking-wider uppercase px-2.5 py-1 block mt-1 font-sans"
                            >
                              DÉPOSER MON REPLAY
                            </motion.button>
                          </div>
                        </div>
                      </BrutalCard>
                    );
                  }

                  return null;
                })}
              </div>
            </AnimatePresence>
          )
        ) : feedItems.length === 0 ? (
          <BrutalCard className="p-6 text-center border-[#d4af37]/20 bg-[#0c0c0c]">
            <Camera className="mx-auto mb-2 h-8 w-8 text-zinc-700" />
            <p className="text-xl font-black uppercase leading-none text-zinc-500 font-serif">
              Aucun rec
            </p>
            <p className="mt-1 text-[9px] font-black uppercase text-zinc-600 font-sans">
              Le flux est vide
            </p>
          </BrutalCard>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="flex flex-col gap-3">
              {feedItems.map((nomination) => (
                <motion.div
                  key={nomination.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{
                    layout: { type: "spring", stiffness: 380, damping: 32 },
                    duration: 0.22,
                  }}
                >
                  <NominationCard
                    nomination={nomination}
                    owned={ownsNomination(nomination)}
                    onEdit={() => startEditNomination(nomination)}
                    onRemove={() => void removeNomination(nomination)}
                    onVote={() => switchTab("vote")}
                    busy={mutationBusyId === nomination.id}
                  />
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </motion.div>
    </motion.section>
  );

  // Helper hook mapper to ensure local state helper triggers setDirectFilter correctly
  function setSetFilter(val: DirectFilter) {
    haptic(HAPTICS.option);
    setDirectFilter(val);
  }
}
