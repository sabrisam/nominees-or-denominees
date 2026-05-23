import { motion, AnimatePresence } from "framer-motion";
import { Check, Flame, Sparkles } from "lucide-react";
import { BrutalCard } from "../ui/BrutalCard";
import { SectionTitle } from "../ui/SectionTitle";
import { MediaFrame } from "../direct/MediaFrame";
import { OwnershipBadge } from "../direct/OwnershipBadge";
import { ScorePresetRail } from "../studio/ScorePresetRail";
import { DimensionScoreGrid } from "../studio/DimensionScoreGrid";
import { getCategoryMeta, scoreTotal, cloneScores } from "@/lib/scoring";
import { DEFAULT_DIMENSION_SCORES } from "@/constants/categories";
import type { Nomination, DimensionScores } from "@/types";

const TAP_REBOUND = { scale: 0.965, rotate: -0.35 };
const TAP_TRANSITION = {
  type: "spring",
  stiffness: 900,
  damping: 32,
  mass: 0.42,
} as const;

/**
 * Critique 5-dimensionnelle (inspirée du protocole Open Design) appliquée à chaque vote :
 *
 * 1. Philosophie   — Cohérence entre l'intention éditoriale et la catégorie soumise.
 * 2. Hiérarchie    — Le pseudo du TikToker et la catégorie dominent la lecture de la carte.
 * 3. Exécution     — Alignement parfait, 0 overflow de pixels, médias chargés.
 * 4. Spécificité   — Aucun placeholder générique ; chaque carte est unique au dossier.
 * 5. Retenue       — Zéro gradient agressif, 1 accent champagne max par carte.
 *
 * Ces règles de qualité sont appliquées visuellement ci-dessous.
 */

export function VoteTab({
  pendingForMe,
  scoreDraftById,
  setScoreDraftById,
  reviewDraftById,
  setReviewDraftById,
  applyRating,
  voteBusyId,
  shakeId,
  ownsNomination,
  handleSectionDrag,
  reduceMotion,
  pageTransition,
}: {
  pendingForMe: Nomination[];
  scoreDraftById: Record<string, DimensionScores>;
  setScoreDraftById: (
    updater: (
      prev: Record<string, DimensionScores>,
    ) => Record<string, DimensionScores>,
  ) => void;
  reviewDraftById: Record<string, string>;
  setReviewDraftById: (
    updater: (prev: Record<string, string>) => Record<string, string>,
  ) => void;
  applyRating: (id: string) => Promise<void>;
  voteBusyId: string | null;
  shakeId: string | null;
  ownsNomination: (n: Nomination) => boolean;
  handleSectionDrag: (info: any) => void;
  reduceMotion: boolean;
  pageTransition: any;
}) {
  return (
    <motion.section
      key="vote"
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
      className="space-y-1.5"
    >
      {/* Header Tabloid */}
      <BrutalCard tone="black" className="p-3 bg-[#0c0c0c] border-[#d4af37]/20">
        <p className="mb-0.5 text-[7.5px] font-black uppercase tracking-[0.2em] text-[#d4af37] font-sans">
          Jugement en cours
        </p>
        <h1 className="tabloid-headline text-[clamp(1.6rem,8vw,2.6rem)] leading-[0.84] text-white od-display">
          À&nbsp;Voter
        </h1>
      </BrutalCard>

      {pendingForMe.length === 0 ? (
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
        >
          <BrutalCard
            tone="yellow"
            className="p-5 text-center bg-[#0c0c0c] border-[#d4af37]/20"
          >
            <motion.div
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Check className="mx-auto mb-3 h-10 w-10 text-[#d4af37]" />
            </motion.div>
            <p className="text-2xl font-black uppercase leading-none text-[#f0d889] font-serif">
              File&nbsp;propre
            </p>
            <p className="mt-1.5 text-[10px] font-black uppercase text-[#d4af37]/70 font-sans">
              Tous les dossiers ont été jugés — reviens vite
            </p>
            <div className="mt-3 flex items-center justify-center gap-1.5">
              <Sparkles className="h-3 w-3 text-[#d4af37]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-[#d4af37]/60 font-sans">
                Propre comme un sou neuf
              </span>
            </div>
          </BrutalCard>
        </motion.div>
      ) : (
        <>
          {/* Compteur de dossiers */}
          <div className="flex items-center gap-2 px-0.5">
            <span className="h-2 w-2 rounded-full bg-[#d4af37] animate-pulse" />
            <p className="text-[9.5px] font-black uppercase tracking-[0.18em] text-[#d4af37]/80 font-sans">
              {pendingForMe.length} dossier{pendingForMe.length > 1 ? "s" : ""}{" "}
              à juger
            </p>
          </div>

          <AnimatePresence mode="popLayout">
            {pendingForMe.map((nomination) => {
              const category = getCategoryMeta(nomination.category_id);
              const categoryLabel = category.label;
              const Icon = category.icon;
              const draftScores = cloneScores(
                scoreDraftById[nomination.id] ?? DEFAULT_DIMENSION_SCORES,
              );
              const currentScore = scoreTotal(
                draftScores,
                nomination.category_ids,
              );

              return (
                <motion.article
                  layout
                  key={nomination.id}
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={
                    shakeId === nomination.id
                      ? {
                          x: [0, -10, 10, -6, 6, 0],
                          scale: [1, 0.99, 1.01, 1],
                          opacity: 1,
                          y: 0,
                        }
                      : { x: 0, scale: 1, opacity: 1, y: 0 }
                  }
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  transition={{
                    duration: 0.42,
                    layout: { type: "spring", stiffness: 380, damping: 32 },
                  }}
                  className="brutal-card overflow-hidden"
                >
                  {/* Media + overlay info */}
                  <div className="relative border-b border-[#d4af37]/20 bg-[#050505]">
                    <MediaFrame
                      nomination={nomination}
                      height="aspect-[9/16] max-h-[52svh]"
                    />

                    {/* Catégorie badge */}
                    <span className="absolute left-2 top-2 -rotate-2 inline-flex items-center gap-1 rounded-[8px] border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] leading-none border-[#d4af37]/60 bg-black/70 text-[#f0d889] backdrop-blur-sm font-sans">
                      <Icon className="h-2.5 w-2.5" />
                      {categoryLabel}
                    </span>

                    <OwnershipBadge
                      owned={ownsNomination(nomination)}
                      className="absolute right-2 top-2 rotate-2"
                    />

                    {/* TikToker name overlay */}
                    <div className="absolute bottom-2 left-2 right-2 rounded-[10px] border border-[#d4af37]/30 bg-black/75 p-2 backdrop-blur-md">
                      <p className="tabloid-headline text-[clamp(1.22rem,6.2vw,2rem)] leading-[0.84] text-white font-serif italic normal-case">
                        {nomination.tiktoker_name}
                      </p>
                    </div>
                  </div>

                  {/* Interaction zone */}
                  <div className="space-y-1.5 p-2 bg-[#0c0c0c]">
                    {/* Commentaire du dossier */}
                    {nomination.comment && (
                      <p className="rounded-[8px] border border-white/10 bg-[#050505] p-2 text-xs font-medium leading-tight text-zinc-300 font-sans">
                        &quot;{nomination.comment}&quot;
                      </p>
                    )}

                    {/* Profils rapides */}
                    <ScorePresetRail
                      value={draftScores}
                      compact
                      onSelect={(value) =>
                        setScoreDraftById((prev) => ({
                          ...prev,
                          [nomination.id]: value,
                        }))
                      }
                      label="Profils rapides pour ce vote"
                    />

                    {/* Grille de dimensions */}
                    <DimensionScoreGrid
                      value={draftScores}
                      onChange={(value) =>
                        setScoreDraftById((prev) => ({
                          ...prev,
                          [nomination.id]: value,
                        }))
                      }
                      compact
                    />

                    {/* Réaction textuelle */}
                    <textarea
                      aria-label="Ta réaction sur ce dossier"
                      value={reviewDraftById[nomination.id] ?? ""}
                      onChange={(event) =>
                        setReviewDraftById((prev) => ({
                          ...prev,
                          [nomination.id]: event.target.value,
                        }))
                      }
                      placeholder="Ta réaction sur ce dossier ?"
                      rows={2}
                      maxLength={180}
                      className="brutal-input w-full resize-none p-2 font-sans"
                    />

                    {/* Score preview indicator */}
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500 font-sans">
                        Indice calculé
                      </span>
                      <span
                        className={`text-[13px] font-serif font-black leading-none ${
                          currentScore >= 80
                            ? "text-[#f0d889]"
                            : currentScore >= 60
                              ? "text-[#d4af37]"
                              : "text-zinc-400"
                        }`}
                      >
                        {currentScore}
                        <span className="text-[9px] text-zinc-500 font-sans">
                          /100
                        </span>
                      </span>
                    </div>

                    {/* Bouton de validation */}
                    <motion.button
                      whileTap={TAP_REBOUND}
                      transition={TAP_TRANSITION}
                      onClick={() => void applyRating(nomination.id)}
                      disabled={voteBusyId === nomination.id}
                      className="brutal-action w-full bg-[#d4af37] text-black disabled:opacity-50 flex items-center justify-center gap-2 font-sans"
                    >
                      {voteBusyId === nomination.id ? (
                        <>
                          <motion.span
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 0.8,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                            className="inline-block"
                          >
                            ⏳
                          </motion.span>
                          Enregistrement...
                        </>
                      ) : (
                        <>
                          <Flame className="h-3.5 w-3.5" />
                          Enregistrer la note · {currentScore}/100
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </>
      )}
    </motion.section>
  );
}
