import { motion } from "framer-motion";
import { Loader2, UploadCloud } from "lucide-react";
import { BrutalCard } from "@/components/ui/BrutalCard";
import { MediaFrame } from "@/components/direct/MediaFrame";
import { OwnershipBadge } from "@/components/direct/OwnershipBadge";
import { ScorePresetRail } from "@/components/studio/ScorePresetRail";
import { DimensionScoreGrid } from "@/components/studio/DimensionScoreGrid";
import { CATEGORIES } from "@/constants/categories";
import { haptic, HAPTICS, TAP_REBOUND, TAP_TRANSITION } from "@/lib/haptic";
import { scoreTotal } from "@/lib/scoring";
import type { Nomination, DimensionScores, MediaKind } from "@/types";

export interface StudioTabProps {
  isEditingStudio: boolean;
  editingNomination: Nomination | null;
  isPreparingMedia: boolean;
  uploadLoading: boolean;
  previewUrl: string | null;
  mediaKind: MediaKind | null;
  thumbnailPreviewUrl: string | null;
  prepareMedia: (file: File | null) => Promise<void>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  mediaProgress: number;
  tiktokerName: string;
  setTiktokerName: React.Dispatch<React.SetStateAction<string>>;
  cleanCategoryIds: string[];
  toggleCategory: (categoryId: string) => void;
  comment: string;
  setComment: React.Dispatch<React.SetStateAction<string>>;
  initialScores: DimensionScores;
  setInitialScores: React.Dispatch<React.SetStateAction<DimensionScores>>;
  saveEditedNomination: () => Promise<void>;
  cancelEditNomination: () => void;
  uploadNomination: () => Promise<void>;
  uploadReady: boolean;
  editingNominationId: string | null;
  mutationBusyId: string | null;
  reduceMotion: boolean;
  handleSectionDrag: (info: any) => void;
  pageTransition: any;
}

export function StudioTab({
  isEditingStudio,
  editingNomination,
  isPreparingMedia,
  uploadLoading,
  previewUrl,
  mediaKind,
  thumbnailPreviewUrl,
  prepareMedia,
  fileInputRef,
  mediaProgress,
  tiktokerName,
  setTiktokerName,
  cleanCategoryIds,
  toggleCategory,
  comment,
  setComment,
  initialScores,
  setInitialScores,
  saveEditedNomination,
  cancelEditNomination,
  uploadNomination,
  uploadReady,
  editingNominationId,
  mutationBusyId,
  reduceMotion,
  handleSectionDrag,
  pageTransition
}: StudioTabProps) {
  return (
    <motion.section
      key="studio"
      {...pageTransition}
      drag={reduceMotion ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => handleSectionDrag(info)}
      transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }}
      className="space-y-1.5"
    >
      <BrutalCard tone="black" className="p-2">
        <h2 className="tabloid-headline text-[clamp(1.28rem,6.8vw,2.2rem)] leading-[0.82] text-white">
          {isEditingStudio ? "MODIFIER LE DOSSIER" : "STUDIO"}
        </h2>
      </BrutalCard>

      <BrutalCard className="p-1.5">
        {editingNomination ? (
          <div className="relative overflow-hidden rounded-[10px] border border-[#d4af37]/25 bg-black">
            <MediaFrame nomination={editingNomination} height="aspect-[9/16] max-h-[52svh]" />
            <OwnershipBadge owned className="absolute left-2 top-2 -rotate-2" />
          </div>
        ) : (
          <motion.button
            whileTap={TAP_REBOUND}
            transition={TAP_TRANSITION}
            onClick={() => {
              haptic(HAPTICS.media);
              fileInputRef.current?.click();
            }}
            disabled={isPreparingMedia || uploadLoading}
            className="relative flex aspect-[9/16] max-h-[52svh] w-full items-center justify-center overflow-hidden rounded-[10px] border border-[#d4af37]/25 bg-black text-left transition disabled:opacity-70"
            aria-label="Choisir une vidéo ou une capture"
          >
            {previewUrl ? (
              mediaKind === "video" ? (
                <video
                  src={previewUrl}
                  poster={thumbnailPreviewUrl ?? undefined}
                  className="absolute inset-0 h-full w-full object-cover"
                  controls
                  loop
                  playsInline
                  muted
                  preload="metadata"
                  {...({ "webkit-playsinline": "true" } as Record<string, string>)}
                />
              ) : (
                <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )
            ) : (
              <span className="flex flex-col items-center px-6 text-center text-white">
                {isPreparingMedia ? (
                  <Loader2 className="mb-3 h-9 w-9 animate-spin text-[#d4af37]" />
                ) : (
                  <UploadCloud className="mb-3 h-9 w-9 text-[#d4af37]" />
                )}
                <span className="tabloid-headline text-xl leading-none">
                  {isPreparingMedia ? "Chargement du studio..." : "Déposer le rec"}
                </span>
                <span className="mt-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#d4af37]">
                  Vidéo ou capture libre
                </span>
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,image/*,.heic,.heif"
              onChange={(event) => void prepareMedia(event.target.files?.[0] ?? null)}
              className="hidden"
              aria-label="Fichier média du dossier"
            />
          </motion.button>
        )}
      </BrutalCard>

      {(isPreparingMedia || uploadLoading) && (
        <BrutalCard tone="yellow" className="p-2">
          <p className="tabloid-headline text-[clamp(1.05rem,5.6vw,1.65rem)] leading-[0.82]">
            {uploadLoading ? "CHARGEMENT DU DOSSIER..." : "PRÉPARATION DU REC..."}
          </p>
          <div className="stat-bar mt-2">
            <motion.div className="stat-bar-fill" animate={{ width: `${Math.round(mediaProgress * 100)}%` }} />
          </div>
        </BrutalCard>
      )}

      <label className="sr-only" htmlFor="tiktoker-name">
        TikToker visé
      </label>
      <input
        id="tiktoker-name"
        aria-label="TikToker visé"
        value={tiktokerName}
        onFocus={() => haptic(HAPTICS.tap)}
        onChange={(event) => setTiktokerName(event.target.value)}
        placeholder="TikToker visé"
        maxLength={48}
        className="brutal-input w-full px-2.5 py-2 text-xs font-black uppercase"
      />

      <div className="grid grid-cols-3 gap-1">
        {CATEGORIES.map((category) => {
          const Icon = category.icon;
          const active = cleanCategoryIds.includes(category.id);
          return (
            <motion.button
              key={category.id}
              type="button"
              whileTap={TAP_REBOUND}
              transition={TAP_TRANSITION}
              onClick={() => toggleCategory(category.id)}
              aria-pressed={active}
              className={`min-h-10 rounded-[10px] border px-1.5 py-1 text-left ${active ? "border-[#d4af37]/75 bg-[#d4af37]/18 text-[#f0d889]" : "border-white/10 bg-white/[0.035] text-zinc-500"}`}
            >
              <Icon className="mb-1 h-3 w-3" />
              <span className="line-clamp-2 text-[8px] font-black uppercase leading-none tracking-tighter">
                {category.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      <label className="sr-only" htmlFor="dossier-comment">
        Contexte du dossier
      </label>
      <textarea
        id="dossier-comment"
        aria-label="Contexte du dossier"
        value={comment}
        onFocus={() => haptic(HAPTICS.tap)}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Pourquoi ce dossier mérite le club ?"
        rows={3}
        maxLength={240}
        className="brutal-input w-full resize-none p-2.5 text-xs font-black uppercase"
      />

      {!isEditingStudio && (
        <BrutalCard tone="yellow" className="p-2">
          <ScorePresetRail value={initialScores} onSelect={setInitialScores} label="Profils rapides du score initial" />
          <DimensionScoreGrid value={initialScores} onChange={setInitialScores} />
          <p className="mt-2 border-t border-[#d4af37]/20 pt-2 text-center text-[10px] font-black uppercase tracking-[0.12em] text-[#d4af37]">
            Indice initial : {scoreTotal(initialScores, cleanCategoryIds)} / 100
          </p>
        </BrutalCard>
      )}

      {isEditingStudio ? (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <motion.button
            whileTap={TAP_REBOUND}
            transition={TAP_TRANSITION}
            onClick={() => void saveEditedNomination()}
            disabled={mutationBusyId === editingNominationId || !uploadReady}
            className="brutal-submit flex w-full items-center justify-center gap-2 disabled:opacity-50"
          >
            {mutationBusyId === editingNominationId ? <Loader2 className="h-6 w-6 animate-spin" /> : "Sauvegarder"}
          </motion.button>
          <motion.button
            whileTap={TAP_REBOUND}
            transition={TAP_TRANSITION}
            onClick={cancelEditNomination}
            className="rounded-[10px] border border-white/10 bg-white/[0.06] px-3 text-xs font-black uppercase tracking-[0.1em] text-white pointer-events-auto"
            type="button"
          >
            Annuler
          </motion.button>
        </div>
      ) : (
        <motion.button
          whileTap={TAP_REBOUND}
          transition={TAP_TRANSITION}
          onClick={() => void uploadNomination()}
          disabled={uploadLoading || !uploadReady}
          className="brutal-submit flex w-full items-center justify-center gap-2 disabled:opacity-50"
        >
          {uploadLoading ? (
            <span className="flex items-center gap-2 animate-pulse">
              <Loader2 className="h-6 w-6 animate-spin" /> TRANSMISSION EN COURS...
            </span>
          ) : (
            "Lancer le dossier"
          )}
        </motion.button>
      )}
    </motion.section>
  );
}
