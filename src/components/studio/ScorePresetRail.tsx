import { motion } from "framer-motion";
import { SCORE_PRESETS } from "@/constants/categories";
import { cloneScores, sameScores } from "@/lib/scoring";
import type { DimensionScores } from "@/types";

const TAP_REBOUND = { scale: 0.965, rotate: -0.35 };
const TAP_TRANSITION = { type: "spring", stiffness: 900, damping: 32, mass: 0.42 } as const;
const HAPTICS = { option: 14 } as const;

function haptic(pattern: number | readonly number[]) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern as VibratePattern);
  } catch {
    // iOS Safari ignore souvent cette API
  }
}

export function ScorePresetRail({
  value,
  onSelect,
  compact = false,
  label = "Profils rapides"
}: {
  value: DimensionScores;
  onSelect: (next: DimensionScores) => void;
  compact?: boolean;
  label?: string;
}) {
  return (
    <div className="score-preset-rail flex gap-1 overflow-x-auto pb-0.5" role="group" aria-label={label}>
      {SCORE_PRESETS.map((preset) => {
        const active = sameScores(value, preset.scores);
        return (
          <motion.button
            key={preset.id}
            type="button"
            whileTap={TAP_REBOUND}
            transition={TAP_TRANSITION}
            aria-pressed={active}
            onClick={() => {
              haptic(HAPTICS.option);
              onSelect(cloneScores(preset.scores));
            }}
            className={`shrink-0 rounded-[9px] border px-2 py-1 text-left transition ${active ? "border-[#d4af37]/80 bg-[#d4af37]/18 text-[#f0d889]" : "border-white/10 bg-white/[0.035] text-zinc-400"}`}
          >
            <span className={`${compact ? "text-[8px]" : "text-[9px]"} block font-black uppercase leading-none tracking-tighter`}>{preset.label}</span>
            <span className="mt-0.5 block text-[7px] font-bold uppercase leading-none tracking-tighter opacity-70">{preset.hint}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
