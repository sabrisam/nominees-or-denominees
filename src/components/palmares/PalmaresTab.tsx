import { motion } from "framer-motion";
import { BrutalCard } from "@/components/ui/BrutalCard";
import { PalmaresList } from "@/components/trophies/PalmaresList";
import type { PalmaresRow, Tab } from "@/types";

export interface PalmaresTabProps {
  palmaresRows: PalmaresRow[];
  switchTab: (nextTab: Tab) => void;
  reduceMotion: boolean;
  handleSectionDrag: (info: any) => void;
  pageTransition: any;
}

export function PalmaresTab({
  palmaresRows,
  switchTab,
  reduceMotion,
  handleSectionDrag,
  pageTransition
}: PalmaresTabProps) {
  return (
    <motion.section
      key="palmares"
      {...pageTransition}
      drag={reduceMotion ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => handleSectionDrag(info)}
      transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }}
      className="space-y-2"
    >
      <BrutalCard tone="black" className="p-3 text-white">
        <p className="mb-1 text-[8px] font-black uppercase tracking-[0.2em] text-[#d4af37]">Classement</p>
        <h2 className="tabloid-headline text-[clamp(1.55rem,7.8vw,2.7rem)] leading-[0.84]">PALMARÈS</h2>
      </BrutalCard>
      <PalmaresList rows={palmaresRows} onOpenStudio={() => switchTab("studio")} />
    </motion.section>
  );
}
