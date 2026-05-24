import Image from "next/image";
import { motion } from "framer-motion";
import { UploadCloud, Loader2 } from "lucide-react";
import { BrutalCard } from "../ui/BrutalCard";
import { MediaFrame } from "../direct/MediaFrame";
import { OwnershipBadge } from "../direct/OwnershipBadge";
import { ScorePresetRail } from "../studio/ScorePresetRail";
import { DimensionScoreGrid } from "../studio/DimensionScoreGrid";
import { CATEGORIES } from "@/constants/categories";
import { scoreTotal, primaryCategoryId } from "@/lib/scoring";
import type { Nomination, MediaKind, DimensionScores } from "@/types";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MEDIA_WHITELIST = ["image/", "video/"];
const AI_PROMPT_TEMPLATE =
  "Génère une vanne urbaine de club, ciblée sur le SCREEN soumis. Le ton doit rester local, espiègle et ancré dans le banter communautaire, sans rien de générique ni hors sujet. Donne une phrase courte, piquante, strictement adaptée au contexte du contenu et à la culture du club.";

const TAP_REBOUND = { scale: 0.965, rotate: -0.35 };
const TAP_TRANSITION = {
  type: "spring",
  stiffness: 900,
  damping: 32,
  mass: 0.42,
} as const;

export function StudioTab({
  editingNomination,
  fileInputRef,
  prepareMedia,
  previewUrl,
  thumbnailPreviewUrl,
  mediaKind,
  isPreparingMedia,
  uploadLoading,
  isUploading = false,
  mediaProgress,
  tiktokerName,
  setTiktokerName,
  cleanCategoryIds,
  toggleCategory,
  comment,
  setComment,
  initialScores,
  setInitialScores,
  uploadNomination,
  cancelEditNomination,
  uploadReady,
  mutationBusyId,
  handleSectionDrag,
  reduceMotion,
  pageTransition,
}: {
  editingNomination: Nomination | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  prepareMedia: (file: File | null) => Promise<void>;
  previewUrl: string | null;
  thumbnailPreviewUrl: string | null;
  mediaKind: MediaKind | null;
  isPreparingMedia: boolean;
  uploadLoading: boolean;
  isUploading?: boolean;
  mediaProgress: number;
  tiktokerName: string;
  setTiktokerName: (val: string) => void;
  cleanCategoryIds: string[];
  toggleCategory: (id: string) => void;
  comment: string;
  setComment: (val: string) => void;
  initialScores: DimensionScores;
  setInitialScores: (scores: DimensionScores) => void;
  uploadNomination: () => Promise<void>;
  cancelEditNomination: () => void;
  uploadReady: boolean;
  mutationBusyId: string | null;
  handleSectionDrag: (info: any) => void;
  reduceMotion: boolean;
  pageTransition: any;
}) {
  const isEditingStudio = Boolean(editingNomination);

  const handleSelectedFile = async (file: File | null) => {
    if (!file) {
      await prepareMedia(null);
      return;
    }

    const isAllowedType = MEDIA_WHITELIST.some((prefix) =>
      file.type.startsWith(prefix),
    );

    if (!isAllowedType || file.size > MAX_UPLOAD_BYTES) {
      const message = !isAllowedType
        ? "Seuls les fichiers image et vidéo sont autorisés."
        : "Taille maximale atteinte : 25 Mo.";
      window.alert(message);
      await prepareMedia(null);
      return;
    }

    await prepareMedia(file);
  };

  const handleAIPunchline = () => {
    const prompt = `${AI_PROMPT_TEMPLATE} \n
      SCREEN: ${tiktokerName || "inconnu"} / Catégorie: ${
        cleanCategoryIds.length > 0
          ? cleanCategoryIds.map((id) => id.toUpperCase()).join(", ")
          : "aucune"
      }`;
    console.info("AI PUNCHLINE PROMPT", prompt);
    window.alert("Prompt IA prêt dans la console du navigateur.");
  };

  return (
    <motion.section
      key="studio"
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
      <BrutalCard tone="black" className="p-2 border-champagne/20 bg-monolith">
        <h2 className="tabloid-headline text-[clamp(1.28rem,6.8vw,2.2rem)] leading-[0.82] text-white font-serif italic normal-case">
          {isEditingStudio ? "Modifier le dossier" : "Studio"}
        </h2>
      </BrutalCard>

      <BrutalCard className="p-1.5 border-champagne/20 bg-monolith">
        {editingNomination ? (
          <div className="relative overflow-hidden rounded-[10px] border border-champagne/20 bg-void">
            <MediaFrame
              nomination={editingNomination}
              height="aspect-[9/16] max-h-[52svh]"
            />
            <OwnershipBadge owned className="absolute left-2 top-2 -rotate-2" />
          </div>
        ) : (
          <motion.button
            whileTap={TAP_REBOUND}
            transition={TAP_TRANSITION}
            onClick={() => {
              fileInputRef.current?.click();
            }}
            disabled={isPreparingMedia || uploadLoading}
            className="relative flex aspect-[9/16] max-h-[52svh] w-full items-center justify-center overflow-hidden rounded-[10px] border border-champagne/20 bg-void text-left transition disabled:opacity-70"
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
                  {...({ "webkit-playsinline": "true" } as Record<
                    string,
                    string
                  >)}
                />
              ) : (
                <Image
                  src={previewUrl}
                  alt=""
                  fill
                  unoptimized
                  sizes="100vw"
                  className="object-cover"
                />
              )
            ) : (
              <span className="flex flex-col items-center px-6 text-center text-white">
                {isPreparingMedia ? (
                  <Loader2 className="mb-3 h-9 w-9 animate-spin text-champagne" />
                ) : (
                  <UploadCloud className="mb-3 h-9 w-9 text-champagne" />
                )}
                <span className="tabloid-headline text-[clamp(1.15rem,5.6vw,1.85rem)] leading-none font-serif">
                  {isPreparingMedia
                    ? "Chargement du studio"
                    : "Déposer le SCREEN"}
                </span>
                <span className="mt-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-champagne font-sans">
                  Vidéo ou capture libre
                </span>
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,image/*,.heic,.heif"
              data-max-size="26214400"
              data-allowed-types="image/*,video/*"
              onChange={(event) =>
                void handleSelectedFile(event.target.files?.[0] ?? null)
              }
              className="hidden font-sans"
              aria-label="Fichier média du dossier"
            />
          </motion.button>
        )}
      </BrutalCard>

      {(isPreparingMedia || uploadLoading) && (
        <BrutalCard
          tone="yellow"
          className="p-2 border-champagne/20 bg-monolith"
        >
          <p className="tabloid-headline text-[clamp(1.05rem,5.6vw,1.65rem)] leading-[0.82] font-serif">
            {uploadLoading
              ? "CHARGEMENT DU DOSSIER..."
              : "PRÉPARATION DU SCREEN..."}
          </p>
          <div className="stat-bar mt-2">
            <motion.div
              className="stat-bar-fill"
              animate={{ width: `${Math.round(mediaProgress * 100)}%` }}
            />
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
        onChange={(event) => setTiktokerName(event.target.value)}
        placeholder="TikToker visé"
        maxLength={48}
        className="brutal-input w-full px-2.5 py-2 text-base font-serif italic normal-case"
      />

      <div className="grid grid-cols-3 gap-1">
        {CATEGORIES.map((category) => {
          const label = category.label;
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
              aria-label={label}
              className={`min-h-10 rounded-[10px] border px-1.5 py-1 text-left font-sans ${active ? "border-champagne/75 bg-champagne/18 text-champagneSoft" : "border-white/10 bg-monolith text-zinc-500"}`}
            >
              <Icon className="mb-1 h-3 w-3" />
              <span className="line-clamp-2 text-[8px] font-black uppercase leading-none tracking-tighter font-sans">
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>

      <label className="sr-only" htmlFor="dossier-comment">
        Contexte du SCREEN
      </label>
      <textarea
        id="dossier-comment"
        aria-label="Contexte du SCREEN"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Pourquoi ce SCREEN mérite le club ?"
        rows={3}
        maxLength={240}
        className="brutal-input w-full resize-none p-2.5 text-base font-serif"
      />

      <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.1em] text-champagne/80">
        <span>Besoin d{`"'"`}un punchline IA ?</span>
        <button
          type="button"
          className="rounded-[10px] border border-champagne/30 bg-champagne/10 px-3 py-1 text-champagneSoft transition hover:bg-champagne/15"
          onClick={handleAIPunchline}
        >
          IA PUNCHLINE
        </button>
      </div>

      {!isEditingStudio && (
        <BrutalCard
          tone="yellow"
          className="p-2 border-champagne/20 bg-monolith"
        >
          <ScorePresetRail
            value={initialScores}
            onSelect={setInitialScores}
            label="Profils rapides du score initial"
          />
          <DimensionScoreGrid
            value={initialScores}
            onChange={setInitialScores}
          />
          <p className="mt-2 border-t border-champagne/20 pt-2 text-center text-[10.5px] font-black uppercase tracking-[0.12em] text-champagne font-serif">
            Indice initial : {scoreTotal(initialScores, cleanCategoryIds)} / 100
          </p>
        </BrutalCard>
      )}

      {isEditingStudio ? (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <motion.button
            whileTap={TAP_REBOUND}
            transition={TAP_TRANSITION}
            onClick={() => void uploadNomination()}
            disabled={mutationBusyId === editingNomination?.id || !uploadReady || isUploading}
            className="brutal-submit flex w-full items-center justify-center gap-2 disabled:opacity-50"
          >
            {mutationBusyId === editingNomination?.id || isUploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              "Sauvegarder"
            )}
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
          disabled={uploadLoading || !uploadReady || isUploading}
          className="brutal-submit flex w-full items-center justify-center gap-2 disabled:opacity-50"
        >
          {uploadLoading || isUploading ? (
            <span className="flex items-center gap-2 animate-pulse">
              <Loader2 className="h-6 w-6 animate-spin" /> TRANSMISSION EN
              COURS...
            </span>
          ) : (
            "ENVOYER LE SCREEN"
          )}
        </motion.button>
      )}
    </motion.section>
  );
}
