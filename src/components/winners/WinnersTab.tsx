import { motion } from "framer-motion";
import { BrutalCard } from "@/components/ui/BrutalCard";
import { Sticker } from "@/components/ui/Sticker";
import { CategoryRaceBoard } from "@/components/trophies/CategoryRaceBoard";
import { totalPoints } from "@/lib/scoring";
import type { ScoreBoard, Nomination, CategoryRace } from "@/types";

export interface WinnersTabProps {
  ultimateWinner: ScoreBoard | null;
  paparazziOr: Nomination | null;
  categoryRaces: CategoryRace[];
  reduceMotion: boolean;
  handleSectionDrag: (info: any) => void;
  pageTransition: any;
}

export function WinnersTab({
  ultimateWinner,
  paparazziOr,
  categoryRaces,
  reduceMotion,
  handleSectionDrag,
  pageTransition
}: WinnersTabProps) {
  return (
    <motion.section
      key="winners"
      {...pageTransition}
      drag={reduceMotion ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => handleSectionDrag(info)}
      transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }}
      className="space-y-2"
    >
      <BrutalCard tone="black" className="p-3 text-white">
        <p className="mb-1 text-[8px] font-black uppercase tracking-[0.2em] text-[#d4af37]">Cérémonie</p>
        <h2 className="tabloid-headline text-[clamp(1.55rem,7.8vw,2.7rem)] leading-[0.84]">TROPHÉES</h2>
      </BrutalCard>

      {ultimateWinner && (
        <BrutalCard tone="yellow" className="p-3">
          <Sticker tone="yellow">TikToker du mois</Sticker>
          <p className="tabloid-headline mt-1.5 text-[clamp(1.35rem,6.8vw,2.25rem)] leading-[0.84] text-white">
            {ultimateWinner.tiktokerName}
          </p>
          <span className="gold-pill mt-2">{ultimateWinner.points} points</span>
        </BrutalCard>
      )}

      {paparazziOr && (
        <BrutalCard className="p-3">
          <Sticker tone="paper">Paparazzi d&apos;Or</Sticker>
          <p className="tabloid-headline mt-1.5 text-[clamp(1.18rem,6.1vw,1.95rem)] leading-[0.84] text-white">
            {paparazziOr.tiktoker_name}
          </p>
          <span className="gold-pill mt-2">{totalPoints(paparazziOr.ratings)} points sur un dossier</span>
        </BrutalCard>
      )}

      <BrutalCard tone="black" className="p-2.5">
        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#d4af37]">Course aux trophées</p>
        <h3 className="tabloid-headline mt-0.5 text-[clamp(1.16rem,6vw,1.95rem)] leading-[0.84] text-white">
          Toutes les catégories
        </h3>
      </BrutalCard>

      <CategoryRaceBoard races={categoryRaces} />
    </motion.section>
  );
}
