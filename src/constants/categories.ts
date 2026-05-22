import {
  BadgeCheck,
  Brain,
  Camera,
  Crown,
  Flame,
  Globe2,
  ShieldAlert,
  Sparkles,
  Zap
} from "lucide-react";
import type { CategoryMeta, RatingDimensionKey, DimensionScores } from "@/types";

export const CATEGORIES: CategoryMeta[] = [
  { id: "le-zin-du-mois", label: "Le Zin du Mois", mood: "positive", icon: Crown },
  { id: "la-fierte-des-notres", label: "La Fierté des Nôtres", mood: "positive", icon: BadgeCheck },
  { id: "xptdr", label: "Xptdr", mood: "fun", icon: Sparkles },
  { id: "la-roue-libre", label: "La Roue Libre", mood: "fun", icon: Flame },
  { id: "la-honte-de-la-oumma", label: "La Honte de la Oumma", mood: "critical", icon: ShieldAlert },
  { id: "bon-voyageur", label: "Bon Voyageur", mood: "surprise", icon: Globe2 },
  { id: "gros-chef-bandit", label: "Gros Chef Bandit", mood: "fun", icon: Zap },
  { id: "surprise-totale", label: "Surprise Totale", mood: "surprise", icon: Camera },
  { id: "lanalyse-pure", label: "L’Analyse Pure", mood: "positive", icon: Brain }
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((category) => [category.id, category])) as Record<string, CategoryMeta>;

export const CATEGORY_ID_ALIASES: Record<string, string> = {
  le_zin_du_mois: "le-zin-du-mois",
  fierte_des_notres: "la-fierte-des-notres",
  roue_libre: "la-roue-libre",
  honte_de_la_oumma: "la-honte-de-la-oumma",
  bon_voyageur: "bon-voyageur",
  gros_chef_bandit: "gros-chef-bandit",
  surprise_totale: "surprise-totale",
  analyse_pure: "lanalyse-pure",
  "analyse-pure": "lanalyse-pure",
  "l-analyse-pure": "lanalyse-pure",
  honte_absolue: "la-honte-de-la-oumma",
  fierte: "la-fierte-des-notres",
  pepite_cachee: "le-zin-du-mois",
  roue: "la-roue-libre",
  viral: "surprise-totale"
};

export const FEATURED_CATEGORY_IDS = [
  "le-zin-du-mois",
  "la-fierte-des-notres",
  "xptdr",
  "la-roue-libre",
  "la-honte-de-la-oumma",
  "bon-voyageur",
  "gros-chef-bandit",
  "surprise-totale",
  "lanalyse-pure"
] as const;

export const RATING_DIMENSIONS: Array<{ key: RatingDimensionKey; label: string; shortLabel: string; emoji: string; color: string }> = [
  { key: "rire", label: "Rire", shortLabel: "RIR", emoji: "😂", color: "#facc15" },
  { key: "surprise", label: "Surprise", shortLabel: "SUR", emoji: "🤯", color: "#38bdf8" },
  { key: "gene", label: "Gêne", shortLabel: "GÊN", emoji: "🤦", color: "#f43f5e" },
  { key: "fierte", label: "Fierté", shortLabel: "FIE", emoji: "✊", color: "#d4af37" },
  { key: "interet", label: "Intérêt", shortLabel: "INT", emoji: "🤔", color: "#a78bfa" }
];

export const DEFAULT_DIMENSION_SCORES: DimensionScores = { rire: 3, surprise: 3, gene: 1, fierte: 2, interet: 3 };

export const CATEGORY_SCORING: Record<string, { weights: DimensionScores; lowIsStrong?: Partial<Record<RatingDimensionKey, boolean>> }> = {
  "le-zin-du-mois": { weights: { rire: 0.18, surprise: 0.18, gene: 0.12, fierte: 0.32, interet: 0.2 }, lowIsStrong: { gene: true } },
  "la-fierte-des-notres": { weights: { rire: 0.1, surprise: 0.14, gene: 0.22, fierte: 0.34, interet: 0.2 }, lowIsStrong: { gene: true } },
  xptdr: { weights: { rire: 0.46, surprise: 0.2, gene: 0.18, fierte: 0.04, interet: 0.12 }, lowIsStrong: { gene: true } },
  "la-roue-libre": { weights: { rire: 0.3, surprise: 0.34, gene: 0.14, fierte: 0.04, interet: 0.18 } },
  "la-honte-de-la-oumma": { weights: { rire: 0.07, surprise: 0.1, gene: 0.55, fierte: 0.25, interet: 0.03 }, lowIsStrong: { fierte: true } },
  "bon-voyageur": { weights: { rire: 0.12, surprise: 0.28, gene: 0.1, fierte: 0.14, interet: 0.36 }, lowIsStrong: { gene: true } },
  "gros-chef-bandit": { weights: { rire: 0.24, surprise: 0.18, gene: 0.16, fierte: 0.24, interet: 0.18 }, lowIsStrong: { gene: true } },
  "surprise-totale": { weights: { rire: 0.14, surprise: 0.46, gene: 0.08, fierte: 0.1, interet: 0.22 }, lowIsStrong: { gene: true } },
  "lanalyse-pure": { weights: { rire: 0.04, surprise: 0.12, gene: 0.18, fierte: 0.22, interet: 0.44 }, lowIsStrong: { gene: true } }
};

export const SCORE_PRESETS: Array<{ id: string; label: string; hint: string; scores: DimensionScores }> = [
  { id: "xptdr", label: "XPTDR", hint: "rire fort", scores: { rire: 5, surprise: 3, gene: 1, fierte: 1, interet: 3 } },
  { id: "malaise", label: "Malaise", hint: "gêne max", scores: { rire: 1, surprise: 2, gene: 5, fierte: 0, interet: 2 } },
  { id: "masterclass", label: "Masterclass", hint: "niveau haut", scores: { rire: 2, surprise: 4, gene: 0, fierte: 5, interet: 4 } },
  { id: "choc", label: "Choc", hint: "surprise", scores: { rire: 2, surprise: 5, gene: 2, fierte: 2, interet: 5 } },
  { id: "la-roue-libre", label: "Roue libre", hint: "chaos", scores: { rire: 4, surprise: 4, gene: 3, fierte: 1, interet: 3 } }
];

export const MIN_PUBLIC_RATINGS = 2;
export const LEGACY_FLOWER_VIDEO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
export const FALLBACK_IMAGE_URL =
  "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1080'%20height='1440'%20viewBox='0%200%201080%201440'%3E%3Crect%20width='1080'%20height='1440'%20fill='%23000000'/%3E%3Crect%20x='64'%20y='64'%20width='952'%20height='1312'%20fill='%23f2efe3'%20stroke='%23000000'%20stroke-width='24'/%3E%3Crect%20x='112'%20y='112'%20width='856'%20height='240'%20fill='%23e11d48'/%3E%3Ctext%20x='540'%20y='248'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='118'%20fill='%23ffffff'%3ENOD%3C/text%3E%3Ctext%20x='540'%20y='690'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='104'%20fill='%23000000'%3EDOSSIER%3C/text%3E%3Ctext%20x='540'%20y='810'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='104'%20fill='%23000000'%3EEN%20DIRECT%3C/text%3E%3Crect%20x='248'%20y='936'%20width='584'%20height='132'%20fill='%23b5f42b'%20stroke='%23000000'%20stroke-width='18'/%3E%3Ctext%20x='540'%20y='1028'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='64'%20fill='%23000000'%3EA%20VOTER%3C/text%3E%3C/svg%3E";
