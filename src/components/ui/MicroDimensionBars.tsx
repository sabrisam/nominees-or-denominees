import { RATING_DIMENSIONS } from "@/constants/categories";
import { clampDimension } from "@/lib/scoring";
import type { DimensionScores } from "@/types";

export function MicroDimensionBars({ scores }: { scores: DimensionScores }) {
  const max = Math.max(1, ...RATING_DIMENSIONS.map((dimension) => scores[dimension.key]));

  return (
    <div className="grid grid-cols-5 gap-1" aria-label="Télémétrie émotionnelle">
      {RATING_DIMENSIONS.map((dimension) => {
        const value = clampDimension(scores[dimension.key]);
        const width = Math.max(6, Math.round((value / max) * 100));

        return (
          <div key={dimension.key} className="min-w-0" title={`${dimension.label}: ${value}`}>
            <div className="h-[3px] overflow-hidden rounded-full bg-white/10">
              <span className="block h-full rounded-full" style={{ width: `${width}%`, backgroundColor: dimension.color }} />
            </div>
            <p className="mt-0.5 truncate text-[7px] font-black uppercase leading-none tracking-tighter text-zinc-500">{dimension.shortLabel}</p>
          </div>
        );
      })}
    </div>
  );
}
