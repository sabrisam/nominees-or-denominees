import { motion } from "framer-motion";
import { BrutalCard } from "../ui/BrutalCard";
import { MediaFrame } from "./MediaFrame";
import { OwnershipBadge } from "./OwnershipBadge";
import {
  getCategoryMeta,
  averageRating,
  averageImpact,
  categorySummary,
} from "@/lib/scoring";
import type { Nomination } from "@/types";

const TAP_REBOUND = { scale: 0.965, rotate: -0.35 };
const TAP_TRANSITION = {
  type: "spring",
  stiffness: 900,
  damping: 32,
  mass: 0.42,
} as const;

export function NominationCard({
  nomination,
  index = 0,
  owned = false,
  onEdit,
  onRemove,
  onVote,
  onCardClick,
  busy = false,
}: {
  nomination: Nomination;
  index?: number;
  owned?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
  onVote?: () => void;
  onCardClick?: (n: Nomination) => void;
  busy?: boolean;
}) {
  const category = getCategoryMeta(nomination.category_id);
  const Icon = category.icon;
  const rating = averageRating(nomination.ratings, nomination.category_ids);
  const impact = averageImpact(nomination);
  const categories = categorySummary(nomination.category_ids);
  const isElite = impact >= 85;

  return (
    <motion.div
      layout
      style={{ willChange: "transform" }}
      whileHover={{ scale: 1.012 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="w-full cursor-pointer"
      onClick={() => onCardClick?.(nomination)}
    >
      <BrutalCard
        layout
        tone={isElite ? "yellow" : "black"}
        className="overflow-hidden border-champagne/20 bg-monolith"
      >
        <div className="relative aspect-[16/10] w-full border-b border-champagne/20 bg-void">
          <MediaFrame
            nomination={nomination}
            height="h-full w-full"
            controls={false}
          />

          <div className="absolute left-2 top-2 z-10 flex gap-1">
            <OwnershipBadge owned={owned} />
            {isElite && (
              <span className="inline-flex rounded-[8px] bg-champagne px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] text-black">
                ÉLITE 👑
              </span>
            )}
          </div>

          <span
            className={`absolute bottom-2 right-2 z-10 inline-flex rounded-[8px] border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] leading-none ${
              nomination.status === "pending"
                ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
            }`}
          >
            {nomination.status === "pending" ? "À VOTER" : "NOMINÉ"}
          </span>
        </div>

        <div className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="tabloid-headline text-lg text-white leading-none tracking-tight font-serif italic normal-case">
                @{nomination.tiktoker_name}
              </p>
              <p className="mt-1 line-clamp-2 font-serif text-[10.5px] leading-tight text-zinc-400">
                &ldquo;{nomination.comment || "Pas de contexte renseigné"}
                &rdquo;
              </p>
            </div>
            {nomination.status === "pending" && !owned && onVote && (
              <motion.button
                whileTap={TAP_REBOUND}
                transition={TAP_TRANSITION}
                onClick={(e) => {
                  e.stopPropagation();
                  onVote();
                }}
                className="brutal-action bg-champagne px-2.5 py-1 text-[9px] text-black font-black uppercase tracking-tight shrink-0 self-start font-sans"
                type="button"
              >
                JUGER
              </motion.button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-champagne/10 pt-2 text-[8px] font-black uppercase tracking-wider text-champagne">
            <span className="flex items-center gap-1 font-serif">
              <Icon className="h-3 w-3 text-champagne" />
              {categories}
            </span>
            <div className="flex items-center gap-1.5 font-serif text-zinc-500">
              <span className="font-serif">
                {nomination.ratings.length} NOTES
              </span>
              <span>·</span>
              <span className="text-champagneSoft font-serif">
                {impact || "-"} INDICE
              </span>
              <span>·</span>
              <span className="text-white font-serif">
                {rating ? `${rating.toFixed(1)}★` : "-"}
              </span>
            </div>
          </div>

          {owned && (
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <motion.button
                whileTap={TAP_REBOUND}
                transition={TAP_TRANSITION}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.();
                }}
                className="owner-action bg-white/5 border border-white/10 hover:border-white/20 text-white py-1 font-sans"
                type="button"
              >
                Modifier
              </motion.button>
              <motion.button
                whileTap={TAP_REBOUND}
                transition={TAP_TRANSITION}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove?.();
                }}
                disabled={busy}
                className="owner-action bg-red-950/20 border border-red-500/20 text-red-400 hover:bg-red-950/40 disabled:opacity-50 py-1 font-sans"
                type="button"
              >
                Retirer
              </motion.button>
            </div>
          )}
        </div>
      </BrutalCard>
    </motion.div>
  );
}
