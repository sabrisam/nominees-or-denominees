import { motion } from "framer-motion";
import { BrutalCard } from "@/components/ui/BrutalCard";
import { Sticker } from "@/components/ui/Sticker";
import { getCategoryMeta, averageImpact } from "@/lib/scoring";
import type { Nomination, ScoreBoard } from "@/types";

const TAP_REBOUND = { scale: 0.965, rotate: -0.35 };
const TAP_TRANSITION = {
  type: "spring",
  stiffness: 900,
  damping: 32,
  mass: 0.42,
} as const;

export function CeremonyBulletin({
  pendingCount,
  nextPending,
  leader,
  bestDossier,
  currentUserId,
  onOpenVote,
  onOpenStudio,
  onOpenPalmares,
}: {
  pendingCount: number;
  nextPending?: Nomination;
  leader: ScoreBoard | null;
  bestDossier?: Nomination;
  currentUserId?: string;
  onOpenVote: () => void;
  onOpenStudio: () => void;
  onOpenPalmares: () => void;
}) {
  const hasPending = Boolean(nextPending);
  const spotlight = bestDossier
    ? `${bestDossier.tiktoker_name} · ${averageImpact(bestDossier)} indice`
    : null;

  if (hasPending && nextPending) {
    const category = getCategoryMeta(nextPending.category_id);
    const isMine = currentUserId && nextPending.submitted_by === currentUserId;

    return (
      <BrutalCard tone={isMine ? "paper" : "yellow"} className="mb-2 p-2">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="min-w-0">
            <Sticker tone={isMine ? "paper" : "yellow"}>
              {isMine
                ? "Votre dossier"
                : pendingCount > 1
                  ? `${pendingCount} dossiers à juger`
                  : "Dossier à juger"}
            </Sticker>
            <p className="tabloid-headline mt-1 text-[clamp(1.05rem,5.5vw,1.8rem)] leading-[0.84] text-white">
              {nextPending.tiktoker_name}
            </p>
            <p className="mt-0.5 truncate text-[9px] font-black uppercase tracking-tighter text-[#d4af37]">
              {category.label} ·{" "}
              {isMine ? "en attente de vote" : "ta note peut le nominer"}
            </p>
          </div>
          {isMine ? (
            <div className="brutal-action bg-zinc-800/80 px-3 text-zinc-400">
              Attente
            </div>
          ) : (
            <motion.button
              type="button"
              whileTap={TAP_REBOUND}
              transition={TAP_TRANSITION}
              onClick={onOpenVote}
              className="brutal-action bg-[#d4af37] px-3 text-black"
            >
              Juger
            </motion.button>
          )}
        </div>
      </BrutalCard>
    );
  }

  if (leader) {
    return (
      <BrutalCard className="mb-2 p-2">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="min-w-0">
            <Sticker tone="paper">Favori du mois</Sticker>
            <p className="tabloid-headline mt-1 text-[clamp(1.05rem,5.5vw,1.8rem)] leading-[0.84] text-white">
              {leader.tiktokerName}
            </p>
            <p className="mt-0.5 truncate text-[9px] font-black uppercase tracking-tighter text-[#d4af37]">
              {leader.points} points de saison
              {spotlight ? ` · ${spotlight}` : ""}
            </p>
          </div>
          <motion.button
            type="button"
            whileTap={TAP_REBOUND}
            transition={TAP_TRANSITION}
            onClick={onOpenPalmares}
            className="brutal-action bg-white/10 px-3 text-white"
          >
            Classement
          </motion.button>
        </div>
      </BrutalCard>
    );
  }

  return (
    <BrutalCard className="mb-2 p-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="min-w-0">
          <Sticker tone="paper">Saison ouverte</Sticker>
          <p className="tabloid-headline mt-1 text-[clamp(1.05rem,5.5vw,1.8rem)] leading-[0.84] text-white">
            Premier SCREEN attendu
          </p>
          <p className="mt-0.5 truncate text-[9px] font-black uppercase tracking-tighter text-[#d4af37]">
            Le trophée commence au premier dossier
          </p>
        </div>
        <motion.button
          type="button"
          whileTap={TAP_REBOUND}
          transition={TAP_TRANSITION}
          onClick={onOpenStudio}
          className="brutal-action bg-[#d4af37] px-3 text-black"
        >
          Studio
        </motion.button>
      </div>
    </BrutalCard>
  );
}
