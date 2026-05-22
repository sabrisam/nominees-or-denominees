import { motion } from "framer-motion";
import { BrutalCard } from "@/components/ui/BrutalCard";
import { Sticker } from "@/components/ui/Sticker";
import { MediaFrame } from "./MediaFrame";
import { OwnershipBadge } from "./OwnershipBadge";
import { getCategoryMeta, averageRating, averageImpact, categorySummary, statusLabel } from "@/lib/scoring";
import type { Nomination } from "@/types";

const TAP_REBOUND = { scale: 0.965, rotate: -0.35 };
const TAP_TRANSITION = { type: "spring", stiffness: 900, damping: 32, mass: 0.42 } as const;

export function NominationTile({
  nomination,
  index = 0,
  owned = false,
  onEdit,
  onRemove,
  busy = false
}: {
  nomination: Nomination;
  index?: number;
  owned?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
  busy?: boolean;
}) {
  const category = getCategoryMeta(nomination.category_id);
  const Icon = category.icon;
  const rating = averageRating(nomination.ratings, nomination.category_ids);
  const impact = averageImpact(nomination);
  const categories = categorySummary(nomination.category_ids);

  return (
    <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
      <BrutalCard tone={index % 3 === 0 ? "yellow" : "paper"} className="overflow-hidden">
        <div className="media-cut relative aspect-[4/3] border-b border-[#d4af37]/20">
          <MediaFrame nomination={nomination} height="h-full" controls={false} />
          <OwnershipBadge owned={owned} className="absolute left-2 top-2" />
          <Sticker tone={nomination.status === "pending" ? "yellow" : "paper"} className="absolute bottom-2 right-2">
            {statusLabel(nomination.status)}
          </Sticker>
        </div>
        <div className="min-w-0 p-2">
          <p className="tabloid-headline text-[clamp(0.96rem,4.8vw,1.32rem)] leading-[0.86] text-white">{nomination.tiktoker_name}</p>
          <p className="mt-0.5 line-clamp-2 text-[9px] font-medium leading-tight text-zinc-300">&quot;{nomination.comment || (owned ? "En attente" : "Dossier à juger")}&quot;</p>
          <p className="mt-1 flex min-w-0 items-center gap-1 truncate text-[7px] font-black uppercase tracking-[0.05em] leading-none text-[#d4af37]">
            <Icon className="h-2.5 w-2.5 shrink-0" /> {categories} / {nomination.ratings.length} notes / {impact || "-"} indice / {rating ? rating.toFixed(1) : "-"}★
          </p>
          {owned && (
            <div className="mt-1 grid grid-cols-2 gap-1">
              <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={onEdit} className="owner-action bg-white/10 text-white" type="button" aria-label={`Modifier le dossier ${nomination.tiktoker_name}`}>
                Modifier
              </motion.button>
              <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={onRemove} disabled={busy} className="owner-action bg-red-950/50 text-red-100 disabled:opacity-60" type="button" aria-label={`Retirer le dossier ${nomination.tiktoker_name}`}>
                Retirer
              </motion.button>
            </div>
          )}
        </div>
      </BrutalCard>
    </motion.div>
  );
}
