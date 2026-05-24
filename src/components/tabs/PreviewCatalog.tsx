"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Check, 
  Sparkles, 
  Flame, 
  ShieldAlert, 
  X, 
  Info,
  Crown,
  Play
} from "lucide-react";
import { BrutalCard } from "../ui/BrutalCard";
import { DimensionScoreGrid } from "../studio/DimensionScoreGrid";
import { scoreForCategory } from "@/lib/scoring";
import type { DimensionScores } from "@/types";

// Standard tap micro-animations
const TAP_REBOUND = { scale: 0.97, rotate: -0.35 };
const TAP_TRANSITION = {
  type: "spring",
  stiffness: 900,
  damping: 32,
  mass: 0.42,
} as const;

// Types of particles for the elite card
interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

export function PreviewCatalog({ onClose }: { onClose: () => void }) {
  // 1. Live Interactive Grid state
  const [demoScores, setDemoScores] = useState<DimensionScores>({
    rire: 4,
    surprise: 3,
    gene: 1,
    fierte: 5,
    interet: 4,
  });

  const [activeCategoryId, setActiveCategoryId] = useState<string>("le-zin-du-mois");

  // Calculate live score based on selected category and dimension ratings
  const calculatedScore = scoreForCategory(demoScores, activeCategoryId);

  // 2. Elite Particles local generation (client-side only to avoid hydration mismatch)
  const [particles, setParticles] = useState<Particle[]>([]);
  useEffect(() => {
    const generated: Particle[] = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // percentage x-axis
      y: Math.random() * 30 + 70, // starts at bottom 70-100%
      size: Math.random() * 3 + 2, // 2px to 5px size
      duration: Math.random() * 2 + 2, // 2s to 4s speed
      delay: Math.random() * 1.5, // staggered start
    }));
    setParticles(generated);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      transition={{ duration: 0.28, type: "spring", stiffness: 230, damping: 25 }}
      className="space-y-4 pb-12"
    >
      {/* Tabloid Header */}
      <BrutalCard tone="black" className="relative p-4 bg-monolith border-champagne/20 shadow-brutal">
        <button 
          onClick={onClose}
          className="absolute right-3 top-3 brutal-icon-button bg-void/50 border-champagne/30 text-champagne hover:border-champagne/60 p-1 flex items-center justify-center rounded-[8px]"
          aria-label="Fermer le catalogue"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="mb-0.5 text-[7.5px] font-black uppercase tracking-[0.2em] text-champagne font-sans">
          Système visuel v4.4
        </p>
        <h1 className="tabloid-headline text-[clamp(1.4rem,7vw,2.4rem)] leading-[0.84] text-white od-display">
          Open&nbsp;Design&nbsp;Sandbox
        </h1>
        <p className="mt-2 text-[9px] font-black uppercase text-zinc-500 font-sans tracking-wide">
          ESPACE DE SIMULATION DES PROTOCOLES EDITORIAUX BRUTALISTES
        </p>
      </BrutalCard>

      {/* Grid: 5-Axe Slider Score Grid & Live Scoring Math Inversion */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 px-0.5">
          <span className="h-2 w-2 rounded-full bg-champagne animate-pulse" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-champagneSoft font-sans">
            01. GRILLE MATRICIELLE & INVERSION DE POIDS
          </h2>
        </div>

        <BrutalCard tone="black" className="p-3 bg-monolith border-champagne/20 shadow-brutal">
          <div className="mb-3 rounded-[8px] border border-white/5 bg-void p-2">
            <div className="flex items-center gap-1.5">
              <Info className="h-3 w-3 text-champagne" />
              <p className="text-[9px] font-black uppercase tracking-wider text-champagne font-sans">
                Formule OODA v4.4 active
              </p>
            </div>
            <p className="mt-1 text-[10px] text-zinc-400 font-sans leading-normal">
              Dans la catégorie <span className="text-white font-bold">La Honte de la Oumma</span>, la dimension <span className="text-white font-bold">Fierté</span> est inversée mathématiquement : une fierté faible (0) génère un score final fort (5), amplifié par un coefficient spécifique.
            </p>
          </div>

          {/* Category Selector */}
          <div className="mb-3 grid grid-cols-2 gap-1">
            <button
              onClick={() => setActiveCategoryId("le-zin-du-mois")}
              className={`rounded-[8px] border py-1.5 text-center font-sans transition ${
                activeCategoryId === "le-zin-du-mois"
                  ? "border-champagne bg-champagne/10 text-champagneSoft"
                  : "border-white/5 bg-void/50 text-zinc-500 hover:border-white/10"
              }`}
            >
              <span className="block text-[8px] font-black uppercase leading-none tracking-tighter">
                Le Zin du Mois
              </span>
            </button>
            <button
              onClick={() => setActiveCategoryId("la-honte-de-la-oumma")}
              className={`rounded-[8px] border py-1.5 text-center font-sans transition ${
                activeCategoryId === "la-honte-de-la-oumma"
                  ? "border-champagne bg-champagne/10 text-champagneSoft"
                  : "border-white/5 bg-void/50 text-zinc-500 hover:border-white/10"
              }`}
            >
              <span className="block text-[8px] font-black uppercase leading-none tracking-tighter">
                La Honte de la Oumma
              </span>
            </button>
          </div>

          {/* The Slider Grid */}
          <div className="border-t border-b border-white/5 py-2.5 my-2">
            <DimensionScoreGrid 
              value={demoScores} 
              onChange={setDemoScores}
              compact={true}
            />
          </div>

          {/* Interactive Calculator Score Preview */}
          <div className="flex items-center justify-between px-1 pt-1.5">
            <div className="space-y-0.5">
              <p className="text-[7.5px] font-black uppercase tracking-[0.1em] text-zinc-500 font-sans">
                Indice Calculé
              </p>
              <p className="text-[8px] font-black uppercase text-champagne font-sans">
                {activeCategoryId === "la-honte-de-la-oumma" ? "INVERSION DE POIDS ACTIVE" : "COEFFICIENT NEUTRE"}
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-serif font-black tracking-tight text-white leading-none">
                {calculatedScore}
              </span>
              <span className="text-sm font-sans text-zinc-500 font-bold ml-0.5">/100</span>
            </div>
          </div>
        </BrutalCard>
      </div>

      {/* Empty Queue State: "FILE VIDE" */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 px-0.5">
          <span className="h-2 w-2 rounded-full bg-champagne animate-pulse" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-champagneSoft font-sans">
            02. QUEUE VIDE & ZERO-PERIOD POLICY
          </h2>
        </div>

        <BrutalCard tone="yellow" className="p-5 text-center bg-monolith border-champagne/20 shadow-brutal">
          <motion.div
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="inline-block"
          >
            <Check className="mx-auto mb-2 h-10 w-10 text-champagne" />
          </motion.div>
          
          {/* Strict compliance: no period at end of line */}
          <h3 className="text-2xl font-black uppercase tracking-tight text-champagneSoft font-serif leading-none">
            FILE VIDE
          </h3>
          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.15em] text-champagne/60 font-sans">
            TOUS LES DOSSIERS ONT ÉTÉ ENTIÈREMENT JUGÉS PAR TON CONSEIL
          </p>
          <div className="mt-3.5 flex items-center justify-center gap-1.5">
            <Sparkles className="h-3 w-3 text-champagne" />
            <span className="text-[8px] font-black uppercase tracking-widest text-champagne/50 font-sans">
              AUCUN RETARD DE RATING
            </span>
          </div>
        </BrutalCard>
      </div>

      {/* Standard Card Layout Preview */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 px-0.5">
          <span className="h-2 w-2 rounded-full bg-champagne animate-pulse" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-champagneSoft font-sans">
            03. GABARIT DE CARTE STANDARD
          </h2>
        </div>

        <article className="brutal-card overflow-hidden bg-monolith border-champagne/20">
          {/* Card Media simulation */}
          <div className="relative aspect-[16/10] bg-void flex items-center justify-center overflow-hidden border-b border-champagne/20">
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-950 opacity-40" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
              <Play className="h-8 w-8 text-champagne/60 mb-2" strokeWidth={1.5} />
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 font-sans">
                SIMULATION FLUX VIDÉO
              </p>
            </div>
            
            {/* Category badge */}
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-[8px] border border-champagne/60 bg-black/75 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] text-champagneSoft backdrop-blur-sm font-sans">
              <Crown className="h-2.5 w-2.5" />
              Le Zin du Mois
            </span>

            {/* Simulated voter name overlay */}
            <div className="absolute bottom-2 left-2 right-2 rounded-[10px] border border-champagne/20 bg-black/75 p-2 backdrop-blur-md">
              <p className="tabloid-headline text-[1.4rem] leading-[0.84] text-white font-serif italic normal-case">
                @tiktoker_zin
              </p>
            </div>
          </div>

          {/* Interaction area */}
          <div className="p-3 space-y-2">
            <p className="rounded-[8px] border border-white/5 bg-void p-2 text-[11px] leading-tight text-zinc-300 font-sans">
              &quot;Le zin a lâché sa meilleure masterclass en direct du club, c&apos;est trop un chef&quot;
            </p>
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-500 font-sans">
                SOUMIS PAR @MEMBRE_ELITE
              </span>
              <span className="text-[9.5px] font-black uppercase tracking-wider text-champagne font-sans">
                VOTE ENREGISTRÉ
              </span>
            </div>
          </div>
        </article>
      </div>

      {/* Elite Card with active particles */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 px-0.5">
          <span className="h-2 w-2 rounded-full bg-champagne animate-pulse" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-champagneSoft font-sans">
            04. CARTE D&apos;ÉLITE AVEC PARTICULES ACTIVES
          </h2>
        </div>

        <article className="relative brutal-card overflow-hidden bg-monolith border-champagne/30 shadow-[0_0_15px_rgba(212,175,55,0.12)]">
          {/* Active floaty gold particles container */}
          <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
            {particles.map((p) => (
              <motion.div
                key={p.id}
                initial={{ 
                  x: `${p.x}%`, 
                  y: `${p.y}%`, 
                  scale: 0, 
                  opacity: 0 
                }}
                animate={{
                  y: ["100%", "-20%"],
                  scale: [0, 1.2, 0.8, 0],
                  opacity: [0, 0.8, 0.8, 0],
                }}
                transition={{
                  duration: p.duration,
                  repeat: Infinity,
                  delay: p.delay,
                  ease: "easeInOut",
                }}
                className="absolute rounded-full bg-gradient-to-t from-champagne to-yellow-300"
                style={{
                  width: p.size,
                  height: p.size,
                  boxShadow: "0 0 6px rgba(212, 175, 55, 0.6)",
                }}
              />
            ))}
          </div>

          {/* Elite Header Accent */}
          <div className="bg-gradient-to-r from-champagne/20 via-champagne/40 to-champagne/20 border-b border-champagne/30 px-3 py-1 flex items-center justify-between">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white font-sans flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5 text-champagne" />
              STATUS D&apos;ÉLITE QUALIFIÉ
            </span>
            <span className="rounded-none border border-champagne bg-black px-1.5 py-0.5 text-[8px] font-black text-champagne font-sans leading-none">
              96/100
            </span>
          </div>

          {/* Elite Card Body */}
          <div className="p-4 bg-monolith space-y-3 relative">
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1">
                <h3 className="tabloid-headline text-3xl text-white font-serif leading-none uppercase">
                  LE ZIN SUPRÊME
                </h3>
                <p className="text-[9px] font-black uppercase tracking-wider text-champagne font-sans">
                  VAINQUEUR DE LA CÉRÉMONIE SÉLECTIVE
                </p>
              </div>
              <div className="h-10 w-10 rounded-full border border-champagne/40 bg-void flex items-center justify-center">
                <Crown className="h-5 w-5 text-champagne animate-bounce" />
              </div>
            </div>

            <div className="paper-tear" />

            <div className="grid grid-cols-2 gap-2 text-center py-1">
              <div className="rounded-[8px] border border-white/5 bg-void p-1.5">
                <p className="text-[7.5px] font-black uppercase text-zinc-500 font-sans tracking-wide">
                  IMPACT DU DOSSIER
                </p>
                <p className="text-lg font-serif font-black text-champagne leading-none mt-0.5">
                  +144 PTS
                </p>
              </div>
              <div className="rounded-[8px] border border-white/5 bg-void p-1.5">
                <p className="text-[7.5px] font-black uppercase text-zinc-500 font-sans tracking-wide">
                  COEFFICIENT RATIO
                </p>
                <p className="text-lg font-serif font-black text-champagne leading-none mt-0.5">
                  X1.5 GOLD
                </p>
              </div>
            </div>

            {/* Zero-Period compliance button */}
            <motion.button 
              whileTap={TAP_REBOUND}
              transition={TAP_TRANSITION}
              className="brutal-action w-full bg-champagne text-black flex items-center justify-center gap-1.5 font-sans"
            >
              ACCÉDER AUX ARCHIVES DU CHAMPION
            </motion.button>
          </div>
        </article>
      </div>

      {/* Dev return trigger */}
      <motion.button
        whileTap={TAP_REBOUND}
        transition={TAP_TRANSITION}
        onClick={onClose}
        className="brutal-submit w-full mt-4 flex items-center justify-center gap-2 font-sans border-champagne"
      >
        RETOURNER AU CLUB LIVE
      </motion.button>
    </motion.div>
  );
}
