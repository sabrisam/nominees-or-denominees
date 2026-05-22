import { motion } from "framer-motion";
import { RATING_DIMENSIONS } from "@/constants/categories";
import { clampDimension } from "@/lib/scoring";
import type { DimensionScores, RatingDimensionKey } from "@/types";

const TAP_REBOUND = { scale: 0.965, rotate: -0.35 };
const TAP_TRANSITION = { type: "spring", stiffness: 900, damping: 32, mass: 0.42 } as const;
const HAPTICS = { tap: 10 } as const;

function haptic(pattern: number | readonly number[]) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern as VibratePattern);
  } catch {
    // iOS Safari ignore souvent cette API
  }
}

export function DimensionScoreGrid({
  value,
  onChange,
  compact = false
}: {
  value: DimensionScores;
  onChange: (next: DimensionScores) => void;
  compact?: boolean;
}) {
  const setDimension = (key: RatingDimensionKey, score: number) => {
    haptic(HAPTICS.tap);
    onChange({ ...value, [key]: clampDimension(score) });
  };

  return (
    <div className={compact ? "space-y-0.5" : "space-y-1"} role="group" aria-label="Méta-jugement émotionnel">
      {RATING_DIMENSIONS.map((dimension) => {
        const activeScore = clampDimension(value[dimension.key]);

        return (
          <div key={dimension.key} className="grid grid-cols-[3.9rem_1fr] items-center gap-1 py-0.5">
            <p className="truncate text-[8px] font-black uppercase leading-none tracking-tighter text-zinc-300">
              <span className="mr-1">{dimension.emoji}</span>
              {dimension.label}
            </p>
            <div className="grid grid-cols-6 gap-0.5">
              {[0, 1, 2, 3, 4, 5].map((score) => (
                <motion.button
                  key={`${dimension.key}-${score}`}
                  type="button"
                  whileTap={TAP_REBOUND}
                  transition={TAP_TRANSITION}
                  onClick={() => setDimension(dimension.key, score)}
                  aria-pressed={activeScore === score}
                  className={`h-4 rounded-[7px] border text-[8px] font-black leading-none transition ${activeScore === score ? "border-[#d4af37]/80 bg-[#d4af37]/20 text-[#f0d889]" : "border-white/10 bg-white/[0.035] text-zinc-500"}`}
                  aria-label={`${dimension.label} ${score} sur 5`}
                >
                  {score}
                </motion.button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
