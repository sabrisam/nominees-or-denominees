import { motion, AnimatePresence } from "framer-motion";
import { Camera } from "lucide-react";
import { BrutalCard } from "@/components/ui/BrutalCard";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { NominationTile } from "@/components/direct/NominationTile";
import { haptic, HAPTICS, TAP_REBOUND, TAP_TRANSITION } from "@/lib/haptic";
import type { Nomination, DirectFilter } from "@/types";

const DIRECT_FILTERS: Array<{ id: DirectFilter; label: string }> = [
  { id: "all", label: "Tout" },
  { id: "pending", label: "À voter" },
  { id: "qualified", label: "Nominés" },
  { id: "elite", label: "Favoris" },
  { id: "mine", label: "Moi" }
];

export interface DirectTabProps {
  directFilter: DirectFilter;
  setDirectFilter: (filter: DirectFilter) => void;
  directFilterCounts: Record<DirectFilter, number>;
  feedItems: Nomination[];
  ownsNomination: (nomination: Nomination) => boolean;
  startEditNomination: (nomination: Nomination) => void;
  removeNomination: (nomination: Nomination) => Promise<void>;
  mutationBusyId: string | null;
  reduceMotion: boolean;
  handleSectionDrag: (info: any) => void;
  pageTransition: any;
  revealContainer: any;
  revealItem: any;
}

export function DirectTab({
  directFilter,
  setDirectFilter,
  directFilterCounts,
  feedItems,
  ownsNomination,
  startEditNomination,
  removeNomination,
  mutationBusyId,
  reduceMotion,
  handleSectionDrag,
  pageTransition,
  revealContainer,
  revealItem
}: DirectTabProps) {
  return (
    <motion.section
      key="direct"
      {...pageTransition}
      {...revealContainer}
      drag={reduceMotion ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => handleSectionDrag(info)}
      transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }}
      className="space-y-1.5"
    >
      <motion.div {...revealItem}>
        <BrutalCard className="relative overflow-hidden p-2.5">
          <p className="mb-1 text-[7px] font-black uppercase tracking-[0.18em] text-[#d4af37]">Club live</p>
          <h1 className="tabloid-headline text-[clamp(1.78rem,8.9vw,3rem)] leading-[0.84] text-[#f5f1e8]">
            NOMINEES
            <span className="mx-1.5 inline-block rounded-[8px] border border-[#d4af37]/70 bg-[#d4af37]/15 px-1.5 py-0.5 text-[clamp(0.72rem,3.55vw,1.1rem)] font-black uppercase leading-none text-[#f0d889]">or</span>
            <span className="block text-[#d4af37]">DENOMINEES</span>
          </h1>
          <div className="paper-tear -mt-[4px]" />
          <div className="rounded-[10px] border border-[#d4af37]/30 bg-black/40 px-2 py-1 text-white">
            <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400">Le club des recs du mois</p>
          </div>
        </BrutalCard>
      </motion.div>

      <motion.div {...revealItem} className="space-y-1.5">
        <div className="grid grid-cols-5 gap-1" aria-label="Filtres du direct" role="group">
          {DIRECT_FILTERS.map((filter) => {
            const active = directFilter === filter.id;
            return (
              <motion.button
                key={filter.id}
                type="button"
                whileTap={TAP_REBOUND}
                transition={TAP_TRANSITION}
                aria-pressed={active}
                onClick={() => {
                  haptic(HAPTICS.option);
                  setDirectFilter(filter.id);
                }}
                className={`rounded-[9px] border px-1 py-1 text-center transition ${active ? "border-[#d4af37]/70 bg-[#d4af37]/18 text-[#f0d889]" : "border-white/10 bg-white/[0.035] text-zinc-500"}`}
              >
                <span className="block truncate text-[7px] font-black uppercase leading-none tracking-tighter">{filter.label}</span>
                <span className="mt-0.5 block text-[10px] font-black leading-none tracking-tighter">{directFilterCounts[filter.id]}</span>
              </motion.button>
            );
          })}
        </div>
        <SectionTitle>DIRECT</SectionTitle>
        {feedItems.length === 0 ? (
          <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
            <BrutalCard className="p-4 text-center">
              <Camera className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
              <p className="text-xl font-black uppercase leading-none text-zinc-500">Aucun rec.</p>
              <p className="mt-1 text-[9px] font-black uppercase text-zinc-600">Le club est vide</p>
            </BrutalCard>
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-2 gap-1.5">
            <AnimatePresence mode="popLayout">
              {feedItems.map((nomination, index) => (
                <NominationTile
                  key={nomination.id}
                  nomination={nomination}
                  index={index}
                  owned={ownsNomination(nomination)}
                  onEdit={() => startEditNomination(nomination)}
                  onRemove={() => void removeNomination(nomination)}
                  busy={mutationBusyId === nomination.id}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </motion.div>
    </motion.section>
  );
}
