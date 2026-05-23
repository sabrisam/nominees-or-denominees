"use client";

/* eslint-disable @next/next/no-img-element */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import confetti from "canvas-confetti";
import {
  getSupabaseBrowserClient,
  ensureAnonymousSession,
} from "@/lib/supabase";
import {
  STORAGE_UNAVAILABLE_NOTICE,
  compressImageToWebp,
  extractVideoThumbnail,
  isImageMedia,
  isStorageUnavailableMessage,
  isVideoMedia,
  uploadMediaFile,
} from "@/lib/storage";
import { Ticker } from "@/components/ui/Ticker";
import { BrutalCard } from "@/components/ui/BrutalCard";
import { CeremonyBulletin } from "@/components/direct/CeremonyBulletin";
import { DirectTab } from "@/components/direct/DirectTab";
import { VoteTab } from "@/components/vote/VoteTab";
import { StudioTab } from "@/components/studio/StudioTab";
import { PalmaresTab } from "@/components/palmares/PalmaresTab";
import { WinnersTab } from "@/components/winners/WinnersTab";
import {
  AnimatePresence,
  motion,
  type PanInfo,
  useReducedMotion,
} from "framer-motion";
import { usePalmares } from "@/hooks/usePalmares";
import {
  buildScoreBoard,
  bestSubmission,
  buildCategoryRaces,
  buildRankingMemoryGrid,
} from "@/lib/ranking";
import {
  BadgeCheck,
  Brain,
  Camera,
  Check,
  Clock3,
  Crown,
  Flame,
  Globe2,
  Loader2,
  Lock,
  Pencil,
  Plus,
  ShieldAlert,
  Sparkles,
  Trophy,
  UploadCloud,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

type Tab = "direct" | "vote" | "studio" | "palmares" | "winners";
type NominationStatus = "pending" | "accepted" | "rejected";
type ToastTone = "success" | "error" | "info";
type CategoryMood = "positive" | "critical" | "fun" | "surprise";
type MediaKind = "video" | "image";
type RatingDimensionKey = "rire" | "surprise" | "gene" | "fierte" | "interet";
type DimensionScores = Record<RatingDimensionKey, number>;
type DirectFilter = "all" | "mine" | "pending" | "qualified" | "elite";

type ToastState = { tone: ToastTone; message: string } | null;

type Participant = {
  id: string;
  pseudo: string;
};

type Rating = {
  id: string;
  nomination_id: string;
  voter_id: string;
  rating_stars: number;
  rating_score: number;
  rating_points: number;
  scores: DimensionScores;
  comment: string;
  created_at: string;
};

type PendingRatingPayload = {
  nominationId: string;
  voterId: string;
  scores: DimensionScores;
  comment: string;
  createdAt: string;
};

type Nomination = {
  id: string;
  room_id: string;
  category_id: string;
  category_ids: string[];
  tiktoker_name: string;
  media_url: string;
  video_storage_path: string | null;
  thumbnail_url: string | null;
  thumbnail_storage_path: string | null;
  media_kind: MediaKind;
  comment: string;
  submitted_by: string;
  status: NominationStatus;
  created_at: string;
  ratings: Rating[];
};

type CategoryMeta = {
  id: string;
  label: string;
  mood: CategoryMood;
  icon: LucideIcon;
};

type ScoreBoard = {
  tiktokerName: string;
  category?: CategoryMeta;
  points: number;
  votes: number;
  average: number;
  nominations: number;
};

type StarDistribution = [number, number, number, number, number];

type PalmaresRow = {
  tiktokerName: string;
  avatarUrl: string;
  points: number;
  votes: number;
  average: number;
  totalDossiers: number;
  acceptedDossiers: number;
  successRate: number;
  categoryCounts: Record<string, number>;
  starDistribution: StarDistribution;
  dimensionTotals: DimensionScores;
};

type CategoryRaceRow = {
  tiktokerName: string;
  avatarUrl: string;
  points: number;
  votes: number;
  average: number;
  totalDossiers: number;
  acceptedDossiers: number;
  pendingDossiers: number;
  rejectedDossiers: number;
  successRate: number;
  starDistribution: StarDistribution;
  dimensionTotals: DimensionScores;
};

type CategoryRace = {
  category: CategoryMeta;
  totalDossiers: number;
  rows: CategoryRaceRow[];
};

const LEGACY_SESSION_ID_KEY = "nod_session_id";
const USER_DEVICE_ID_KEY = "nod_user_device_id";
const PSEUDO_KEY = "nod_pseudo";
const ROOM_CODE_KEY = "nod_room_code";
const PENDING_RATINGS_KEY = "nod_pending_ratings";
const DEFAULT_ROOM_CODE = "NOD-CLUB";
const MIN_PUBLIC_RATINGS = 2;
const DIRECT_TITLE = "DIRECT";
const VOTE_TITLE = "À VOTER";
const STUDIO_TITLE = "STUDIO";
const PALMARES_TITLE = "PALMARÈS";
const WINNERS_TITLE = "TROPHÉES";
const LEGACY_FLOWER_VIDEO_URL =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const FALLBACK_IMAGE_URL =
  "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1080'%20height='1440'%20viewBox='0%200%201080%201440'%3E%3Crect%20width='1080'%20height='1440'%20fill='%23000000'/%3E%3Crect%20x='64'%20y='64'%20width='952'%20height='1312'%20fill='%23f2efe3'%20stroke='%23000000'%20stroke-width='24'/%3E%3Crect%20x='112'%20y='112'%20width='856'%20height='240'%20fill='%23e11d48'/%3E%3Ctext%20x='540'%20y='248'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='118'%20fill='%23ffffff'%3ENOD%3C/text%3E%3Ctext%20x='540'%20y='690'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='104'%20fill='%23000000'%3EDOSSIER%3C/text%3E%3Ctext%20x='540'%20y='810'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='104'%20fill='%23000000'%3EEN%20DIRECT%3C/text%3E%3Crect%20x='248'%20y='936'%20width='584'%20height='132'%20fill='%23b5f42b'%20stroke='%23000000'%20stroke-width='18'/%3E%3Ctext%20x='540'%20y='1028'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='64'%20fill='%23000000'%3EA%20VOTER%3C/text%3E%3C/svg%3E";
const TAP_REBOUND = { scale: 0.965, rotate: -0.35 };
const TAP_TRANSITION = {
  type: "spring",
  stiffness: 900,
  damping: 32,
  mass: 0.42,
} as const;
const HAPTICS = {
  tap: 10,
  option: 14,
  nav: 16,
  media: 18,
  success: [15, 30, 10],
  remove: [25, 60],
  error: 100,
} as const;

const CATEGORIES: CategoryMeta[] = [
  {
    id: "le-zin-du-mois",
    label: "Le Zin du Mois",
    mood: "positive",
    icon: Crown,
  },
  {
    id: "la-fierte-des-notres",
    label: "La Fierté des Nôtres",
    mood: "positive",
    icon: BadgeCheck,
  },
  { id: "xptdr", label: "Xptdr", mood: "fun", icon: Sparkles },
  { id: "la-roue-libre", label: "La Roue Libre", mood: "fun", icon: Flame },
  {
    id: "la-honte-de-la-oumma",
    label: "La Honte de la Oumma",
    mood: "critical",
    icon: ShieldAlert,
  },
  { id: "bon-voyageur", label: "Bon Voyageur", mood: "surprise", icon: Globe2 },
  { id: "gros-chef-bandit", label: "Gros Chef Bandit", mood: "fun", icon: Zap },
  {
    id: "surprise-totale",
    label: "Surprise Totale",
    mood: "surprise",
    icon: Camera,
  },
  {
    id: "lanalyse-pure",
    label: "L’Analyse Pure",
    mood: "positive",
    icon: Brain,
  },
];

const CATEGORY_BY_ID = Object.fromEntries(
  CATEGORIES.map((category) => [category.id, category]),
) as Record<string, CategoryMeta>;
const CATEGORY_ID_ALIASES: Record<string, string> = {
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
  viral: "surprise-totale",
};
const FEATURED_CATEGORY_IDS = [
  "le-zin-du-mois",
  "la-fierte-des-notres",
  "xptdr",
  "la-roue-libre",
  "la-honte-de-la-oumma",
  "bon-voyageur",
  "gros-chef-bandit",
  "surprise-totale",
  "lanalyse-pure",
] as const;
const RATING_DIMENSIONS: Array<{
  key: RatingDimensionKey;
  label: string;
  shortLabel: string;
  emoji: string;
  color: string;
}> = [
  {
    key: "rire",
    label: "Rire",
    shortLabel: "RIR",
    emoji: "😂",
    color: "#facc15",
  },
  {
    key: "surprise",
    label: "Surprise",
    shortLabel: "SUR",
    emoji: "🤯",
    color: "#38bdf8",
  },
  {
    key: "gene",
    label: "Gêne",
    shortLabel: "GÊN",
    emoji: "🤦",
    color: "#f43f5e",
  },
  {
    key: "fierte",
    label: "Fierté",
    shortLabel: "FIE",
    emoji: "✊",
    color: "#d4af37",
  },
  {
    key: "interet",
    label: "Intérêt",
    shortLabel: "INT",
    emoji: "🤔",
    color: "#a78bfa",
  },
];
const DEFAULT_DIMENSION_SCORES: DimensionScores = {
  rire: 3,
  surprise: 3,
  gene: 1,
  fierte: 2,
  interet: 3,
};
const CATEGORY_SCORING: Record<
  string,
  {
    weights: DimensionScores;
    lowIsStrong?: Partial<Record<RatingDimensionKey, boolean>>;
  }
> = {
  "le-zin-du-mois": {
    weights: {
      rire: 0.18,
      surprise: 0.18,
      gene: 0.12,
      fierte: 0.32,
      interet: 0.2,
    },
    lowIsStrong: { gene: true },
  },
  "la-fierte-des-notres": {
    weights: {
      rire: 0.1,
      surprise: 0.14,
      gene: 0.22,
      fierte: 0.34,
      interet: 0.2,
    },
    lowIsStrong: { gene: true },
  },
  xptdr: {
    weights: {
      rire: 0.46,
      surprise: 0.2,
      gene: 0.18,
      fierte: 0.04,
      interet: 0.12,
    },
    lowIsStrong: { gene: true },
  },
  "la-roue-libre": {
    weights: {
      rire: 0.3,
      surprise: 0.34,
      gene: 0.14,
      fierte: 0.04,
      interet: 0.18,
    },
  },
  "la-honte-de-la-oumma": {
    weights: {
      rire: 0.07,
      surprise: 0.1,
      gene: 0.55,
      fierte: 0.25,
      interet: 0.03,
    },
    lowIsStrong: { fierte: true },
  },
  "bon-voyageur": {
    weights: {
      rire: 0.12,
      surprise: 0.28,
      gene: 0.1,
      fierte: 0.14,
      interet: 0.36,
    },
    lowIsStrong: { gene: true },
  },
  "gros-chef-bandit": {
    weights: {
      rire: 0.24,
      surprise: 0.18,
      gene: 0.16,
      fierte: 0.24,
      interet: 0.18,
    },
    lowIsStrong: { gene: true },
  },
  "surprise-totale": {
    weights: {
      rire: 0.14,
      surprise: 0.46,
      gene: 0.08,
      fierte: 0.1,
      interet: 0.22,
    },
    lowIsStrong: { gene: true },
  },
  "lanalyse-pure": {
    weights: {
      rire: 0.04,
      surprise: 0.12,
      gene: 0.18,
      fierte: 0.22,
      interet: 0.44,
    },
    lowIsStrong: { gene: true },
  },
};
const SCORE_PRESETS: Array<{
  id: string;
  label: string;
  hint: string;
  scores: DimensionScores;
}> = [
  {
    id: "xptdr",
    label: "XPTDR",
    hint: "rire fort",
    scores: { rire: 5, surprise: 3, gene: 1, fierte: 1, interet: 3 },
  },
  {
    id: "malaise",
    label: "Malaise",
    hint: "gêne max",
    scores: { rire: 1, surprise: 2, gene: 5, fierte: 0, interet: 2 },
  },
  {
    id: "masterclass",
    label: "Masterclass",
    hint: "niveau haut",
    scores: { rire: 2, surprise: 4, gene: 0, fierte: 5, interet: 4 },
  },
  {
    id: "choc",
    label: "Choc",
    hint: "surprise",
    scores: { rire: 2, surprise: 5, gene: 2, fierte: 2, interet: 5 },
  },
  {
    id: "la-roue-libre",
    label: "Roue libre",
    hint: "chaos",
    scores: { rire: 4, surprise: 4, gene: 3, fierte: 1, interet: 3 },
  },
];
const TAB_ITEMS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "direct", label: "Direct", icon: Sparkles },
  { id: "vote", label: "À voter", icon: Zap },
  { id: "studio", label: "Studio", icon: Plus },
  { id: "palmares", label: "Palmarès", icon: Trophy },
  { id: "winners", label: "Trophées", icon: Crown },
];

const TAB_ORDER: Tab[] = TAB_ITEMS.map((item) => item.id);
const pageVariants = {
  enter: (dir: "forward" | "backward") => ({
    x: dir === "forward" ? "100%" : "-100%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (dir: "forward" | "backward") => ({
    x: dir === "forward" ? "-100%" : "100%",
    opacity: 0,
  }),
};
const DIRECT_FILTERS: Array<{ id: DirectFilter; label: string }> = [
  { id: "all", label: "Tout" },
  { id: "pending", label: "À voter" },
  { id: "qualified", label: "Nominés" },
  { id: "elite", label: "Favoris" },
  { id: "mine", label: "Moi" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampDimension(value: number) {
  return Math.min(5, Math.max(0, Math.round(value)));
}

function clampRating(value: number) {
  return clampDimension(value);
}

function cloneScores(
  scores: DimensionScores = DEFAULT_DIMENSION_SCORES,
): DimensionScores {
  return {
    rire: clampDimension(scores.rire),
    surprise: clampDimension(scores.surprise),
    gene: clampDimension(scores.gene),
    fierte: clampDimension(scores.fierte),
    interet: clampDimension(scores.interet),
  };
}

function normalizedCategoryId(categoryId: string) {
  const resolved = CATEGORY_ID_ALIASES[categoryId] ?? categoryId;
  return CATEGORY_BY_ID[resolved] ? resolved : CATEGORIES[0].id;
}

function scoreForCategory(scores: DimensionScores, categoryId: string) {
  const profile =
    CATEGORY_SCORING[normalizedCategoryId(categoryId)] ??
    CATEGORY_SCORING[CATEGORIES[0].id];
  const weighted = RATING_DIMENSIONS.reduce((sum, dimension) => {
    const rawValue = clampDimension(scores[dimension.key]);
    const adjustedValue = profile.lowIsStrong?.[dimension.key]
      ? 5 - rawValue
      : rawValue;
    return sum + adjustedValue * profile.weights[dimension.key];
  }, 0);

  return Math.min(100, Math.max(0, Math.round(weighted * 20)));
}

function scoreTotal(
  scores: DimensionScores,
  categoryIds: string[] = [CATEGORIES[0].id],
) {
  const ids = normalizeCategoryIds(categoryIds, CATEGORIES[0].id);
  const total = ids.reduce(
    (sum, categoryId) => sum + scoreForCategory(scores, categoryId),
    0,
  );
  return Math.round(total / ids.length);
}

function scoreAverage(scores: DimensionScores, categoryIds?: string[]) {
  return Math.round((scoreTotal(scores, categoryIds) / 20) * 100) / 100;
}

function ratingImpactPoints(rating: Rating, categoryIds?: string[]) {
  return scoreTotal(rating.scores, categoryIds);
}

function ratingImpactScore(rating: Rating, categoryIds?: string[]) {
  return Math.round((ratingImpactPoints(rating, categoryIds) / 20) * 100) / 100;
}

function addScores(target: DimensionScores, source: DimensionScores) {
  for (const dimension of RATING_DIMENSIONS) {
    target[dimension.key] += clampDimension(source[dimension.key]);
  }
}

function createStarDistribution(): StarDistribution {
  return [0, 0, 0, 0, 0];
}

function addToStarDistribution(distribution: StarDistribution, value: number) {
  const rounded = Math.max(1, clampRating(value));
  distribution[rounded - 1] += 1;
}

function haptic(pattern: number | readonly number[]) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nod-haptic", { detail: { pattern } }),
    );
  }
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern as VibratePattern);
  } catch {
    // iOS Safari ignore souvent cette API; les ressorts visuels gardent le retour tactile.
  }
}

function sameScores(a: DimensionScores, b: DimensionScores) {
  return RATING_DIMENSIONS.every(
    (dimension) =>
      clampDimension(a[dimension.key]) === clampDimension(b[dimension.key]),
  );
}

function categorySummary(ids: string[]) {
  const labels = normalizeCategoryIds(ids, CATEGORIES[0].id).map(
    (id) => getCategoryMeta(id).label,
  );
  if (labels.length <= 2) return labels.join(" + ");
  return `${labels.slice(0, 2).join(" + ")} +${labels.length - 2}`;
}

function makeSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function sanitizePseudo(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\sÀ-ÖØ-öø-ÿ_.-]/g, "")
    .slice(0, 24);
}

function sanitizeRoomCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 24);
}

function sanitizeTiktokerName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\sÀ-ÖØ-öø-ÿ'@.-]/g, "")
    .slice(0, 48);
}

function getCategoryMeta(value: string) {
  const resolved = CATEGORY_ID_ALIASES[value] ?? value;
  return (
    CATEGORY_BY_ID[resolved] ?? {
      id: "custom",
      label: value || "Sans catégorie",
      mood: "fun",
      icon: Camera,
    }
  );
}

function normalizeCategoryIds(value: unknown, fallback: string) {
  const rawIds = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
  const validIds = rawIds
    .map((id) => CATEGORY_ID_ALIASES[id] ?? id)
    .filter((id) => CATEGORY_BY_ID[id]);
  const resolvedFallback = CATEGORY_ID_ALIASES[fallback] ?? fallback;
  const fallbackId = CATEGORY_BY_ID[resolvedFallback]
    ? resolvedFallback
    : CATEGORIES[0].id;
  return Array.from(new Set(validIds.length > 0 ? validIds : [fallbackId]));
}

function primaryCategoryId(ids: string[]) {
  return (
    ids
      .map((id) => CATEGORY_ID_ALIASES[id] ?? id)
      .find((id) => CATEGORY_BY_ID[id]) ?? CATEGORIES[0].id
  );
}

function statusFromRatings(ratings: Rating[]) {
  if (ratings.length < MIN_PUBLIC_RATINGS) return "pending" as const;
  return "accepted" as const;
}

function statusLabel(status: NominationStatus) {
  if (status === "accepted") return "NOMINÉ";
  if (status === "rejected") return "ARCHIVÉ";
  return "À VOTER";
}

function statusClass(status: NominationStatus) {
  if (status === "accepted")
    return "border-[#d4af37]/60 bg-[#d4af37]/15 text-[#f0d889]";
  if (status === "rejected")
    return "border-red-400/30 bg-red-950/40 text-red-100";
  return "border-[#d4af37]/50 bg-white/5 text-[#f0d889]";
}

function averageRating(ratings: Rating[], categoryIds?: string[]) {
  if (ratings.length === 0) return 0;
  return (
    ratings.reduce(
      (sum, rating) => sum + ratingImpactScore(rating, categoryIds),
      0,
    ) / ratings.length
  );
}

function totalPoints(ratings: Rating[], categoryIds?: string[]) {
  return ratings.reduce(
    (sum, rating) => sum + ratingImpactPoints(rating, categoryIds),
    0,
  );
}

function averageImpact(
  nomination: Nomination,
  categoryIds = nomination.category_ids,
) {
  if (nomination.ratings.length === 0) return 0;
  return Math.round(
    totalPoints(nomination.ratings, categoryIds) / nomination.ratings.length,
  );
}

function countdownToNextCeremony() {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  const diffMs = Math.max(0, next.getTime() - Date.now());
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return { days, hours, mins };
}

function isCurrentMonth(dateValue: string) {
  const date = new Date(dateValue);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function parseRating(row: Record<string, unknown>): Rating {
  const legacyRating = clampRating(toNumber(row.rating_stars, 0));
  const scores = cloneScores({
    rire: clampDimension(toNumber(row.rire_score, legacyRating)),
    surprise: clampDimension(toNumber(row.surprise_score, legacyRating)),
    gene: clampDimension(toNumber(row.gene_score, legacyRating)),
    fierte: clampDimension(toNumber(row.fierte_score, legacyRating)),
    interet: clampDimension(toNumber(row.interet_score, legacyRating)),
  });
  const computedScore = scoreAverage(scores);
  const computedPoints = scoreTotal(scores);

  return {
    id: toText(
      row.id,
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ),
    nomination_id: toText(row.nomination_id),
    voter_id: toText(row.voter_id),
    rating_stars: clampRating(
      toNumber(row.rating_stars, Math.round(computedScore)),
    ),
    rating_score: Math.min(
      5,
      Math.max(0, toNumber(row.rating_score, computedScore)),
    ),
    rating_points: Math.min(
      100,
      Math.max(0, toNumber(row.rating_points, computedPoints)),
    ),
    scores,
    comment: toText(row.comment),
    created_at: toText(row.created_at, new Date().toISOString()),
  };
}

function makeRatingFromDraft(
  nominationId: string,
  voterId: string,
  scores: DimensionScores,
  comment: string,
  categoryIds?: string[],
): Rating {
  const safeScores = cloneScores(scores);
  const points = scoreTotal(safeScores, categoryIds);
  const ratingScore = Math.round((points / 20) * 100) / 100;

  return {
    id: `${nominationId}-${voterId}`,
    nomination_id: nominationId,
    voter_id: voterId,
    rating_stars: clampRating(Math.round(ratingScore)),
    rating_score: ratingScore,
    rating_points: points,
    scores: safeScores,
    comment,
    created_at: new Date().toISOString(),
  };
}

function readPendingRatings(): PendingRatingPayload[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(
      localStorage.getItem(PENDING_RATINGS_KEY) || "[]",
    ) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PendingRatingPayload =>
        isRecord(item) &&
        typeof item.nominationId === "string" &&
        typeof item.voterId === "string" &&
        isRecord(item.scores),
    );
  } catch {
    return [];
  }
}

function writePendingRatings(items: PendingRatingPayload[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PENDING_RATINGS_KEY, JSON.stringify(items.slice(-80)));
}

function queuePendingRating(payload: PendingRatingPayload) {
  const rest = readPendingRatings().filter(
    (item) =>
      !(
        item.nominationId === payload.nominationId &&
        item.voterId === payload.voterId
      ),
  );
  writePendingRatings([...rest, payload]);
}

function parseNomination(row: Record<string, unknown>): Nomination {
  const ratings = Array.isArray(row.ratings)
    ? row.ratings.filter(isRecord).map(parseRating)
    : [];
  const rawMediaKind = toText(row.media_kind, "image");
  const fallbackCategory = toText(row.category_id, CATEGORIES[0].id);
  const categoryIds = normalizeCategoryIds(row.category_ids, fallbackCategory);
  const computedStatus = statusFromRatings(ratings);

  return {
    id: toText(
      row.id,
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ),
    room_id: toText(row.room_id),
    category_id: primaryCategoryId(categoryIds),
    category_ids: categoryIds,
    tiktoker_name:
      sanitizeTiktokerName(toText(row.tiktoker_name, "TikToker mystère")) ||
      "TikToker mystère",
    media_url: toText(row.media_url, FALLBACK_IMAGE_URL),
    video_storage_path: toText(row.video_storage_path) || null,
    thumbnail_url: toText(row.thumbnail_url) || null,
    thumbnail_storage_path: toText(row.thumbnail_storage_path) || null,
    media_kind: rawMediaKind === "video" ? "video" : "image",
    comment: toText(row.comment),
    submitted_by: toText(row.submitted_by, "session-inconnue"),
    status: computedStatus,
    created_at: toText(row.created_at, new Date().toISOString()),
    ratings,
  };
}

function isLegacyDemoMedia(url: string) {
  return url === LEGACY_FLOWER_VIDEO_URL;
}

function studioBurst() {
  const colors = ["#d4af37", "#c0c0c0", "#39FF14"];
  void confetti({
    particleCount: 140,
    spread: 100,
    startVelocity: 50,
    scalar: 1.2,
    ticks: 180,
    colors,
    origin: { y: 0.6 },
    disableForReducedMotion: true,
  });
}

function voteBurst(points: number) {
  const elite = points >= 80;
  const colors = elite
    ? ["#d4af37", "#f0d889", "#ffffff", "#050505"]
    : ["#d4af37", "#8a6f24", "#f5f1e8"];

  void confetti({
    particleCount: elite ? 118 : 72,
    spread: elite ? 90 : 62,
    startVelocity: elite ? 46 : 34,
    scalar: elite ? 1 : 0.82,
    ticks: 150,
    colors,
    origin: { y: 0.72 },
    disableForReducedMotion: true,
  });
}

function setUrl(
  urlSetter: (value: string | null) => void,
  currentUrl: string | null,
  nextFile: File | null,
) {
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  urlSetter(nextFile ? URL.createObjectURL(nextFile) : null);
}

function PaperBackdrop() {
  return (
    <div className="paper-backdrop" aria-hidden="true">
      <span className="paper-mark paper-mark-one" />
      <span className="paper-mark paper-mark-two" />
      <span className="paper-mark paper-mark-three" />
    </div>
  );
}

export default function Home() {
  const reduceMotion = !!useReducedMotion();
  const [supabase, setSupabase] =
    useState<ReturnType<typeof getSupabaseBrowserClient>>(null);
  const [bootingSession, setBootingSession] = useState(true);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState(DEFAULT_ROOM_CODE);

  const [tab, setTab] = useState<Tab>("direct");
  const [dir, setDir] = useState<"forward" | "backward">("forward");
  const [directFilter, setDirectFilter] = useState<DirectFilter>("all");
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [syncing, setSyncing] = useState(false);

  const [toast, setToast] = useState<ToastState>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const [ceremonyCountdown, setCeremonyCountdown] = useState(
    countdownToNextCeremony,
  );

  const [showStudioOverlay, setShowStudioOverlay] = useState(false);
  const [preparedFile, setPreparedFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [mediaKind, setMediaKind] = useState<MediaKind | null>(null);
  const [previewUrl, setPreviewUrlState] = useState<string | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrlState] = useState<
    string | null
  >(null);
  const [mediaProgress, setMediaProgress] = useState(0);
  const [isPreparingMedia, setIsPreparingMedia] = useState(false);
  const [tiktokerName, setTiktokerName] = useState("");
  const [catId, setCatId] = useState(CATEGORIES[0].id);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([
    CATEGORIES[0].id,
  ]);
  const [comment, setComment] = useState("");
  const [initialScores, setInitialScores] = useState<DimensionScores>(
    cloneScores(DEFAULT_DIMENSION_SCORES),
  );
  const [uploadLoading, setUploadLoading] = useState(false);
  const [editingNominationId, setEditingNominationId] = useState<string | null>(
    null,
  );
  const [mutationBusyId, setMutationBusyId] = useState<string | null>(null);

  const [scoreDraftById, setScoreDraftById] = useState<
    Record<string, DimensionScores>
  >({});
  const [reviewDraftById, setReviewDraftById] = useState<
    Record<string, string>
  >({});
  const [voteBusyId, setVoteBusyId] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [globalShake, setGlobalShake] = useState<number>(0);

  useEffect(() => {
    const onHaptic = () => setGlobalShake(Date.now());
    window.addEventListener("nod-haptic", onHaptic as any);
    return () => window.removeEventListener("nod-haptic", onHaptic as any);
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || !globalShake) return;

    shell.classList.remove("tabloid-haptic-pulse");
    void shell.offsetWidth;
    shell.classList.add("tabloid-haptic-pulse");

    const timer = window.setTimeout(
      () => shell.classList.remove("tabloid-haptic-pulse"),
      160,
    );
    return () => window.clearTimeout(timer);
  }, [globalShake]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);

  const showToast = useCallback((tone: ToastTone, message: string) => {
    if (tone === "error") haptic(HAPTICS.error);
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    setToast({ tone, message });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 2800);
  }, []);

  const switchTab = useCallback((nextTab: Tab) => {
    haptic(HAPTICS.nav);
    setTab((prevTab) => {
      const prevIndex = TAB_ORDER.indexOf(prevTab);
      const nextIndex = TAB_ORDER.indexOf(nextTab);
      if (nextIndex !== prevIndex) {
        setDir(nextIndex > prevIndex ? "forward" : "backward");
      }
      return nextTab;
    });
  }, []);

  // supabase client is initialized inside initParticipant

  useEffect(() => {
    const initParticipant = async () => {
      try {
        const client = getSupabaseBrowserClient();
        setSupabase(client);
        if (!client) {
          console.error("[NOD] Supabase non configuré — vérifie .env.local");
          return;
        }

        const user = await ensureAnonymousSession(client);
        if (user) {
          const storedPseudo = sanitizePseudo(
            localStorage.getItem(PSEUDO_KEY) || "",
          );
          const nextPseudo =
            storedPseudo || `Joueur ${user.id.slice(0, 4).toUpperCase()}`;

          if (storedPseudo !== nextPseudo)
            localStorage.setItem(PSEUDO_KEY, nextPseudo);

          setParticipant({ id: user.id, pseudo: nextPseudo });
        } else {
          const { error } = await client.auth.signInAnonymously();
          if (error) {
            setBootError(error.message || "Échec authentification anonyme.");
          } else {
            // Wait for next effect run or reload
            window.location.reload();
          }
        }
      } catch (err) {
        console.error(err);
        setBootError(err instanceof Error ? err.message : String(err));
      } finally {
        setBootingSession(false);
      }
    };
    initParticipant();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCeremonyCountdown(countdownToNextCeremony());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
    };
  }, [thumbnailPreviewUrl]);

  const clearPreparedMedia = useCallback(() => {
    setPreparedFile(null);
    setThumbnailFile(null);
    setMediaKind(null);
    setMediaProgress(0);
    setUrl(setPreviewUrlState, previewUrl, null);
    setUrl(setThumbnailPreviewUrlState, thumbnailPreviewUrl, null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [previewUrl, thumbnailPreviewUrl]);

  const ensureRoom = useCallback(async () => {
    if (!supabase) return null;
    const cleanCode = sanitizeRoomCode(roomCode) || DEFAULT_ROOM_CODE;
    localStorage.setItem(ROOM_CODE_KEY, cleanCode);
    setRoomCode(cleanCode);

    const { data, error } = await supabase
      .from("rooms")
      .upsert({ code: cleanCode }, { onConflict: "code" })
      .select("id")
      .single();
    if (error) throw error;

    const nextRoomId = toText(data?.id);
    if (nextRoomId) setRoomId(nextRoomId);
    return nextRoomId || null;
  }, [roomCode, supabase]);

  const fetchNominations = useCallback(
    async (silent = false, forcedRoomId?: string | null) => {
      const activeRoomId = forcedRoomId ?? roomId;
      if (!supabase || !activeRoomId) return;

      setSyncing(true);

      try {
        // Attempt 1: full query with all optional columns + nested ratings
        const nominationsResult = await supabase
          .from("nominations")
          .select(
            "id,room_id,category_id,category_ids,tiktoker_name,media_url,video_storage_path,thumbnail_url,thumbnail_storage_path,media_kind,comment,submitted_by,status,created_at,ratings(id,nomination_id,voter_id,rating_stars,rating_score,rating_points,rire_score,surprise_score,gene_score,fierte_score,interet_score,comment,created_at)",
          )
          .eq("room_id", activeRoomId)
          .order("created_at", { ascending: false });

        let data = nominationsResult.data as Record<string, unknown>[] | null;
        let error = nominationsResult.error;

        // Attempt 2: if ANY error (empty body {}, unknown column, broken relation) — use safe query without optional columns
        if (error) {
          console.warn("[NOD Fetch] Attempt 1 failed, trying safe query.", {
            code: error.code,
            msg: error.message,
          });
          const safe = await supabase
            .from("nominations")
            .select(
              "id,room_id,category_id,tiktoker_name,media_url,video_storage_path,thumbnail_url,thumbnail_storage_path,media_kind,comment,submitted_by,status,created_at,ratings(id,nomination_id,voter_id,rating_stars,comment,created_at)",
            )
            .eq("room_id", activeRoomId)
            .order("created_at", { ascending: false });
          data = safe.data as Record<string, unknown>[] | null;
          error = safe.error;
        }

        // Attempt 3: absolute bare minimum — no nested ratings
        if (error) {
          console.warn("[NOD Fetch] Attempt 2 failed, trying bare minimum.", {
            code: error.code,
            msg: error.message,
          });
          const bare = await supabase
            .from("nominations")
            .select(
              "id,room_id,category_id,tiktoker_name,media_url,thumbnail_url,media_kind,comment,submitted_by,status,created_at",
            )
            .eq("room_id", activeRoomId)
            .order("created_at", { ascending: false });
          data = bare.data as Record<string, unknown>[] | null;
          error = bare.error;
        }

        if (error) {
          console.error("[NOD Fetch] All attempts failed:", {
            code: error.code,
            message: error.message,
            details: (error as any).details,
          });
          throw error;
        }

        const rawRows = (data ?? []) as Record<string, unknown>[];
        const rows = rawRows.map(parseNomination);

        if (
          participant &&
          rawRows.length > 0 &&
          !Object.prototype.hasOwnProperty.call(rawRows[0], "ratings")
        ) {
          const ratingResponse = await supabase
            .from("ratings")
            .select(
              "id,nomination_id,voter_id,rating_stars,rating_score,rating_points,rire_score,surprise_score,gene_score,fierte_score,interet_score,comment,created_at",
            )
            .eq("voter_id", participant.id)
            .in(
              "nomination_id",
              rows.map((nomination) => nomination.id),
            );

          const currentUserRatings = (ratingResponse.data ?? []) as
            | Record<string, unknown>[]
            | null;
          const ratingMap = new Map<string, Rating>();
          currentUserRatings?.forEach((ratingRow) => {
            const parsedRating = parseRating(ratingRow);
            ratingMap.set(parsedRating.nomination_id, parsedRating);
          });

          const enrichedRows = rows.map((nomination) => ({
            ...nomination,
            ratings:
              nomination.ratings.length > 0
                ? nomination.ratings
                : ratingMap.has(nomination.id)
                ? [ratingMap.get(nomination.id)!]
                : [],
          }));

          setNominations(enrichedRows);
        } else {
          setNominations(rows);
        }
      } catch (err: any) {
        if (!silent) {
          const message =
            err?.message ||
            (typeof err === "string" ? err : "Le direct refuse de répondre.");
          showToast("error", message);
        }
      } finally {
        setSyncing(false);
      }
    },
    [participant, roomId, showToast, supabase],
  );

  useEffect(() => {
    if (!participant || !supabase) return;
    let cancelled = false;

    void (async () => {
      try {
        const activeRoomId = await ensureRoom();
        if (!cancelled && activeRoomId)
          await fetchNominations(false, activeRoomId);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Salon introuvable.";
        showToast("error", message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ensureRoom, fetchNominations, participant, showToast, supabase]);

  useEffect(() => {
    if (!participant || !supabase || !roomId) return;

    const poll = window.setInterval(() => {
      void fetchNominations(true);
    }, 20000);

    const channel = supabase
      .channel(`nod_room_${roomId}`, { config: { broadcast: { self: false } } })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "nominations",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const submittedBy = toText(
              (payload.new as Record<string, unknown>).submitted_by,
            );
            if (submittedBy !== participant.id)
              showToast("info", "Nouveau dossier à juger.");
          }
          void fetchNominations(true);
        },
      )
      .on("broadcast", { event: "nomination" }, () => {
        void fetchNominations(true);
      })
      .on("broadcast", { event: "rating" }, () => {
        void fetchNominations(true);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      window.clearInterval(poll);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [fetchNominations, participant, roomId, showToast, supabase]);

  const pendingForMe = useMemo(() => {
    if (!participant) return [];
    return nominations.filter(
      (nomination) =>
        nomination.status === "pending" &&
        nomination.submitted_by !== participant.id &&
        !nomination.ratings.some(
          (rating) => rating.voter_id === participant.id,
        ),
    );
  }, [nominations, participant]);

  const rankingGrid = useMemo(
    () => buildRankingMemoryGrid(nominations),
    [nominations],
  );
  const activeMemberCount = rankingGrid.size;

  const qualified = useMemo(
    () => nominations.filter((nomination) => nomination.status !== "pending"),
    [nominations],
  );
  const eliteDossiers = useMemo(
    () => qualified.filter((nomination) => averageImpact(nomination) >= 80),
    [qualified],
  );
  const feedItems = useMemo(() => {
    return nominations
      .filter((nomination) => {
        if (directFilter === "mine")
          return Boolean(
            participant && nomination.submitted_by === participant.id,
          );
        if (directFilter === "all") return true;
        if (directFilter === "pending") return nomination.status === "pending";
        if (directFilter === "qualified")
          return nomination.status !== "pending";
        if (directFilter === "elite")
          return (
            nomination.status !== "pending" && averageImpact(nomination) >= 80
          );
        return true;
      })
      .slice(0, 30);
  }, [directFilter, nominations, participant]);
  const directFilterCounts = useMemo<Record<DirectFilter, number>>(
    () => ({
      all: nominations.length,
      pending: pendingForMe.length,
      qualified: qualified.length,
      elite: eliteDossiers.length,
      mine: participant
        ? nominations.filter(
            (nomination) => nomination.submitted_by === participant.id,
          ).length
        : 0,
    }),
    [
      eliteDossiers.length,
      nominations,
      participant,
      pendingForMe.length,
      qualified.length,
    ],
  );
  const monthlyNominations = useMemo(
    () =>
      nominations.filter((nomination) => isCurrentMonth(nomination.created_at)),
    [nominations],
  );
  const ultimateWinner = useMemo(
    () => buildScoreBoard(nominations)[0] ?? null,
    [nominations],
  );
  const paparazziOr = useMemo(() => bestSubmission(nominations), [nominations]);
  const nextPendingForMe = pendingForMe[0];
  const { palmaresRows, isLoading: isLoadingPalmares } = usePalmares(
    supabase,
    roomCode,
  );
  const categoryRaces = useMemo(
    () => buildCategoryRaces(nominations),
    [nominations],
  );

  const editingNomination = useMemo(
    () =>
      nominations.find((nomination) => nomination.id === editingNominationId) ??
      null,
    [nominations, editingNominationId],
  );
  const isEditingStudio = Boolean(editingNomination);
  const cleanTiktokerName = sanitizeTiktokerName(tiktokerName);
  const cleanCategoryIds = useMemo(
    () => normalizeCategoryIds(selectedCategoryIds, catId),
    [catId, selectedCategoryIds],
  );
  const uploadReady = isEditingStudio
    ? comment.trim().length >= 3 &&
      cleanTiktokerName.length >= 2 &&
      cleanCategoryIds.length === 1
    : Boolean(
        preparedFile &&
        thumbnailFile &&
        comment.trim().length >= 3 &&
        cleanTiktokerName.length >= 2 &&
        cleanCategoryIds.length === 1 &&
        !isPreparingMedia,
      );
  const ownsNomination = useCallback(
    (nomination: Nomination) =>
      Boolean(participant && nomination.submitted_by === participant.id),
    [participant],
  );

  const patchRatingLocally = useCallback(
    (nominationId: string, rating: Rating) => {
      setNominations((current) =>
        current.map((nomination) => {
          if (nomination.id !== nominationId) return nomination;
          const nextRatings = [
            ...nomination.ratings.filter(
              (item) => item.voter_id !== rating.voter_id,
            ),
            rating,
          ].sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          );
          return {
            ...nomination,
            ratings: nextRatings,
            status: statusFromRatings(nextRatings),
          };
        }),
      );
    },
    [],
  );

  const submitRatingSafely = useCallback(
    async (nomination: Nomination, scores: DimensionScores, review: string) => {
      if (!participant || !supabase) return false;

      const safeScores = cloneScores(scores);
      const safeReview = review.trim();
      const averageScore = scoreAverage(safeScores, nomination.category_ids);
      const impactPoints = scoreTotal(safeScores, nomination.category_ids);

      const rpcPayload = {
        target_nomination_id: nomination.id,
        voter_id: participant.id,
        rire: safeScores.rire,
        surprise: safeScores.surprise,
        gene: safeScores.gene,
        fierte: safeScores.fierte,
        interet: safeScores.interet,
        reaction_comment: safeReview,
      };

      const rpcResult = await supabase.rpc(
        "submit_nomination_vote",
        rpcPayload,
      );
      if (!rpcResult.error) return true;

      const legacyResult = await supabase.rpc("submit_nomination_vote", {
        target_nomination_id: nomination.id,
        voter_id: participant.id,
        stars: Math.max(0, Math.round(averageScore)),
        reaction_comment: safeReview,
      });
      if (!legacyResult.error) return true;

      const upsertResult = await supabase.from("ratings").upsert(
        {
          nomination_id: nomination.id,
          voter_id: participant.id,
          rating_stars: Math.max(0, Math.round(averageScore)),
          rating_score: averageScore,
          rating_points: impactPoints,
          rire_score: safeScores.rire,
          surprise_score: safeScores.surprise,
          gene_score: safeScores.gene,
          fierte_score: safeScores.fierte,
          interet_score: safeScores.interet,
          comment: safeReview,
        },
        { onConflict: "nomination_id,voter_id" },
      );

      return !upsertResult.error;
    },
    [participant, supabase],
  );

  useEffect(() => {
    if (!participant || !supabase || nominations.length === 0) return;

    let cancelled = false;

    const flush = async () => {
      const pending = readPendingRatings();
      const mine = pending.filter((item) => item.voterId === participant.id);
      if (mine.length === 0) return;

      const stillPending: PendingRatingPayload[] = [];

      for (const payload of mine) {
        const nomination = nominations.find(
          (item) => item.id === payload.nominationId,
        );
        if (!nomination) continue;

        try {
          const ok = await submitRatingSafely(
            nomination,
            cloneScores(payload.scores),
            payload.comment,
          );
          if (!ok) stillPending.push(payload);
        } catch {
          stillPending.push(payload);
        }
      }

      if (cancelled) return;

      const others = pending.filter((item) => item.voterId !== participant.id);
      writePendingRatings([...others, ...stillPending]);
      if (stillPending.length < mine.length) void fetchNominations(true);
    };

    void flush();
    const timer = window.setInterval(() => {
      void flush();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    fetchNominations,
    nominations,
    participant,
    submitRatingSafely,
    supabase,
  ]);

  const revealContainer = reduceMotion
    ? {}
    : {
        initial: "hidden",
        animate: "show",
        variants: {
          hidden: {},
          show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
        },
      };

  const revealItem = reduceMotion
    ? {}
    : {
        variants: {
          hidden: { opacity: 0, y: 18, rotate: -1.5 },
          show: {
            opacity: 1,
            y: 0,
            rotate: 0,
            transition: { type: "spring", stiffness: 210, damping: 23 },
          },
        },
      };

  const pageTransition = reduceMotion
    ? {
        initial: { opacity: 1, x: 0 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 1, x: 0 },
      }
    : {
        custom: dir,
        variants: pageVariants,
        initial: "enter",
        animate: "center",
        exit: "exit",
        transition: { type: "spring", stiffness: 380, damping: 38 },
      };

  const handleSectionDrag = useCallback(
    (info: PanInfo) => {
      if (Math.abs(info.offset.x) < 90) return;
      const currentIndex = TAB_ORDER.indexOf(tab);
      const nextIndex = info.offset.x < 0 ? currentIndex + 1 : currentIndex - 1;
      const nextTab = TAB_ORDER[nextIndex];
      if (nextTab) switchTab(nextTab);
    },
    [switchTab, tab],
  );

  const resetStudioDraft = useCallback(() => {
    clearPreparedMedia();
    setTiktokerName("");
    setComment("");
    setInitialScores(cloneScores(DEFAULT_DIMENSION_SCORES));
    setSelectedCategoryIds([CATEGORIES[0].id]);
    setCatId(CATEGORIES[0].id);
  }, [clearPreparedMedia]);

  const toggleCategory = useCallback((categoryId: string) => {
    haptic(HAPTICS.option);
    setSelectedCategoryIds([categoryId]);
    setCatId(categoryId);
  }, []);

  const startEditNomination = useCallback(
    (nomination: Nomination) => {
      if (!ownsNomination(nomination)) {
        showToast("info", "Dossier verrouillé.");
        return;
      }

      haptic(HAPTICS.nav);
      clearPreparedMedia();
      setEditingNominationId(nomination.id);
      setTiktokerName(nomination.tiktoker_name);
      setComment(nomination.comment);
      setSelectedCategoryIds(nomination.category_ids);
      setCatId(primaryCategoryId(nomination.category_ids));
      showToast("info", "Mode modif : auteur seulement.");
      switchTab("studio");
    },
    [clearPreparedMedia, ownsNomination, showToast, switchTab],
  );

  const cancelEditNomination = useCallback(() => {
    haptic(HAPTICS.tap);
    setEditingNominationId(null);
    resetStudioDraft();
  }, [resetStudioDraft]);

  const prepareMedia = async (nextFile: File | null) => {
    if (!nextFile) return;
    if (!isImageMedia(nextFile) && !isVideoMedia(nextFile)) {
      showToast("error", "Choisis une vidéo, une photo ou une capture.");
      return;
    }

    setIsPreparingMedia(true);
    setMediaProgress(0);
    clearPreparedMedia();

    try {
      if (isImageMedia(nextFile)) {
        const compressed = await compressImageToWebp(nextFile);
        setPreparedFile(compressed);
        setThumbnailFile(compressed);
        setMediaKind("image");
        setUrl(setPreviewUrlState, null, compressed);
        setUrl(setThumbnailPreviewUrlState, null, compressed);
        setMediaProgress(1);
        haptic(HAPTICS.success);
        showToast("success", "Capture prête.");
        return;
      }

      const thumbnail = await extractVideoThumbnail(nextFile);
      setPreparedFile(nextFile);
      setThumbnailFile(thumbnail);
      setMediaKind("video");
      setUrl(setPreviewUrlState, null, nextFile);
      setUrl(setThumbnailPreviewUrlState, null, thumbnail);
      setMediaProgress(1);
      haptic(HAPTICS.success);
      showToast("success", "Rec prêt.");
    } catch (err) {
      clearPreparedMedia();
      const message =
        err instanceof Error ? err.message : "Média impossible à préparer.";
      showToast("error", message);
    } finally {
      setIsPreparingMedia(false);
    }
  };

  const saveEditedNomination = async () => {
    if (
      !participant ||
      !supabase ||
      !editingNomination ||
      !ownsNomination(editingNomination) ||
      mutationBusyId
    )
      return;

    const cleanedComment = comment.trim();
    if (cleanedComment.length < 3 || cleanTiktokerName.length < 2) {
      showToast("error", "Ajoute le TikToker et le contexte.");
      return;
    }

    haptic(HAPTICS.success);
    setMutationBusyId(editingNomination.id);

    try {
      let { error } = await supabase.rpc("update_own_nomination", {
        target_nomination_id: editingNomination.id,
        editor_id: participant.id,
        next_comment: cleanedComment,
        next_category_id: primaryCategoryId(cleanCategoryIds),
        next_tiktoker_name: cleanTiktokerName,
        next_category_ids: cleanCategoryIds,
      });

      if (
        error &&
        /function .*update_own_nomination|Could not find/i.test(error.message)
      ) {
        const legacy = await supabase.rpc("update_own_nomination", {
          target_nomination_id: editingNomination.id,
          editor_id: participant.id,
          next_comment: cleanedComment,
          next_category_id: primaryCategoryId(cleanCategoryIds),
          next_tiktoker_name: cleanTiktokerName,
        });
        error = legacy.error;
      }

      if (error) throw error;

      showToast("success", "Dossier modifié.");
      setEditingNominationId(null);
      resetStudioDraft();
      switchTab("direct");
      await channelRef.current?.send({
        type: "broadcast",
        event: "nomination",
        payload: { id: editingNomination.id },
      });
      void fetchNominations(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Modification impossible.";
      showToast("error", message);
    } finally {
      setMutationBusyId(null);
    }
  };

  const removeNomination = async (nomination: Nomination) => {
    if (
      !participant ||
      !supabase ||
      !ownsNomination(nomination) ||
      mutationBusyId
    )
      return;
    const confirmed = window.confirm("Retirer ce dossier du club ?");
    if (!confirmed) return;

    haptic(HAPTICS.remove);
    setMutationBusyId(nomination.id);

    try {
      const { error } = await supabase.rpc("delete_own_nomination", {
        target_nomination_id: nomination.id,
        editor_id: participant.id,
      });

      if (error) throw error;

      if (editingNominationId === nomination.id) {
        setEditingNominationId(null);
        resetStudioDraft();
      }

      showToast("info", "Dossier retiré.");
      await channelRef.current?.send({
        type: "broadcast",
        event: "nomination",
        payload: { id: nomination.id },
      });
      void fetchNominations(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Retrait impossible.";
      showToast("error", message);
    } finally {
      setMutationBusyId(null);
    }
  };

  const uploadNomination = async () => {
    if (editingNomination) {
      await saveEditedNomination();
      return;
    }

    if (!participant || !supabase) {
      showToast("error", "Le studio n'est pas encore branché.");
      return;
    }

    const cleanedComment = comment.trim();
    if (
      !preparedFile ||
      !thumbnailFile ||
      !mediaKind ||
      cleanedComment.length < 3 ||
      cleanTiktokerName.length < 2
    ) {
      showToast("error", "Ajoute le TikToker, le média et le contexte.");
      return;
    }

    haptic(HAPTICS.media);
    setUploadLoading(true);
    setMediaProgress(0.15);

    try {
      const activeRoomId = roomId ?? (await ensureRoom());
      if (!activeRoomId) throw new Error("Salon introuvable.");

      const thumbnailUpload = await uploadMediaFile(
        supabase,
        thumbnailFile,
        "miniatures",
      );
      setMediaProgress(mediaKind === "video" ? 0.45 : 0.82);

      const mediaUpload =
        mediaKind === "video"
          ? await uploadMediaFile(supabase, preparedFile, "videos")
          : thumbnailUpload;
      setMediaProgress(0.82);

      // Always use the live Supabase auth UID (not cached participant.id which may be stale)
      const {
        data: { session: liveSession },
      } = await supabase.auth.getSession();
      let liveUid = liveSession?.user?.id ?? participant.id;

      // Prevent PostgreSQL "operator does not exist: uuid = text" if liveUid is not a valid UUID format
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          liveUid,
        );
      if (!isUuid) {
        liveUid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            participant.id,
          )
            ? participant.id
            : "00000000-0000-0000-0000-000000000000"; // Safe empty UUID fallback
      }

      console.info(
        "[NOD Insert] liveUid=",
        liveUid,
        "participant.id=",
        participant.id,
      );

      const nominationInsert = {
        room_id: activeRoomId,
        category_id: primaryCategoryId(cleanCategoryIds),
        category_ids: cleanCategoryIds,
        tiktoker_name: cleanTiktokerName,
        media_url: mediaUpload.publicUrl,
        video_storage_path: mediaKind === "video" ? mediaUpload.key : null,
        thumbnail_url: thumbnailUpload.publicUrl,
        thumbnail_storage_path: thumbnailUpload.key,
        media_kind: mediaKind,
        comment: cleanedComment,
        submitted_by: liveUid,
        status: "pending",
      };

      let { data: insertedNomination, error: insertError } = await supabase
        .from("nominations")
        .insert(nominationInsert)
        .select("id")
        .single();

      if (insertError) {
        console.error("[NOD Insert] Attempt 1 error:", {
          code: insertError.code,
          msg: insertError.message,
          details: (insertError as any).details,
          hint: (insertError as any).hint,
        });
      }

      // Fallback: if category_ids column doesn't exist OR any 4xx error on insert
      if (insertError) {
        const legacyInsert: Partial<typeof nominationInsert> = {
          ...nominationInsert,
        };
        delete legacyInsert.category_ids;
        console.info("[NOD Insert] Retrying without category_ids...");
        const legacy = await supabase
          .from("nominations")
          .insert(legacyInsert)
          .select("id")
          .single();
        if (legacy.error) {
          console.error("[NOD Insert] Attempt 2 error:", {
            code: legacy.error.code,
            msg: legacy.error.message,
            details: (legacy.error as any).details,
            hint: (legacy.error as any).hint,
          });
        }
        insertedNomination = legacy.data;
        insertError = legacy.error;
      }

      if (insertError) throw insertError;
      const nominationId = toText(insertedNomination?.id);
      if (!nominationId) throw new Error("Dossier non créé.");

      const initialNomination: Nomination = {
        id: nominationId,
        room_id: activeRoomId,
        category_id: primaryCategoryId(cleanCategoryIds),
        category_ids: cleanCategoryIds,
        tiktoker_name: cleanTiktokerName,
        media_url: mediaUpload.publicUrl,
        video_storage_path: mediaKind === "video" ? mediaUpload.key : null,
        thumbnail_url: thumbnailUpload.publicUrl,
        thumbnail_storage_path: thumbnailUpload.key,
        media_kind: mediaKind,
        comment: cleanedComment,
        submitted_by: participant.id,
        status: "pending",
        created_at: new Date().toISOString(),
        ratings: [],
      };
      const initialRatingSaved = await submitRatingSafely(
        initialNomination,
        initialScores,
        cleanedComment,
      );

      if (!initialRatingSaved) {
        queuePendingRating({
          nominationId,
          voterId: participant.id,
          scores: initialScores,
          comment: cleanedComment,
          createdAt: new Date().toISOString(),
        });
      }

      setMediaProgress(1);
      setShowStudioOverlay(true);
      studioBurst();
      haptic([30, 40, 30, 40]);
      resetStudioDraft();
      await channelRef.current?.send({
        type: "broadcast",
        event: "nomination",
        payload: { id: nominationId },
      });
      void fetchNominations(true, activeRoomId);
      window.setTimeout(() => {
        setShowStudioOverlay(false);
        switchTab("direct");
      }, 2500);
    } catch (err: any) {
      const message =
        err?.message || (typeof err === "string" ? err : "Échec de l'envoi.");
      showToast(
        "error",
        isStorageUnavailableMessage(message)
          ? STORAGE_UNAVAILABLE_NOTICE
          : message,
      );
    } finally {
      setUploadLoading(false);
      setMediaProgress(0);
    }
  };

  const applyRating = async (id: string) => {
    if (!participant || !supabase || voteBusyId) return;

    const nomination = nominations.find((item) => item.id === id);
    if (!nomination) return;

    const cleanedReview = (reviewDraftById[id] ?? "").trim();
    const draftScores = cloneScores(
      scoreDraftById[id] ?? DEFAULT_DIMENSION_SCORES,
    );
    const impactPoints = scoreTotal(draftScores, nomination.category_ids);
    const localRating = makeRatingFromDraft(
      id,
      participant.id,
      draftScores,
      cleanedReview,
      nomination.category_ids,
    );

    haptic(impactPoints >= 80 ? HAPTICS.success : HAPTICS.option);
    setVoteBusyId(id);
    setShakeId(id);
    window.setTimeout(() => setShakeId(null), 520);
    patchRatingLocally(id, localRating);

    try {
      const remoteSaved = await submitRatingSafely(
        nomination,
        draftScores,
        cleanedReview,
      );
      if (!remoteSaved) {
        queuePendingRating({
          nominationId: id,
          voterId: participant.id,
          scores: draftScores,
          comment: cleanedReview,
          createdAt: localRating.created_at,
        });
      }
      setScoreDraftById((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setReviewDraftById((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      voteBurst(impactPoints);
      showToast(
        "success",
        remoteSaved
          ? `Note enregistrée · ${impactPoints}/100.`
          : `Note gardée · ${impactPoints}/100.`,
      );
      if (remoteSaved) {
        await channelRef.current?.send({
          type: "broadcast",
          event: "rating",
          payload: { id },
        });
        void fetchNominations(true);
      }
    } catch {
      queuePendingRating({
        nominationId: id,
        voterId: participant.id,
        scores: draftScores,
        comment: cleanedReview,
        createdAt: localRating.created_at,
      });
      voteBurst(impactPoints);
      showToast("success", `Note gardée · ${impactPoints}/100.`);
    } finally {
      setVoteBusyId(null);
    }
  };

  if (bootingSession) {
    return (
      <div ref={shellRef} className="tabloid-app items-center justify-center">
        <PaperBackdrop />
        <div className="flex flex-col items-center gap-2">
          <BrutalCard
            tone="yellow"
            className="flex h-20 w-20 items-center justify-center"
          >
            <Loader2 className="h-8 w-8 animate-spin text-black" />
          </BrutalCard>
          <p className="text-[10px] font-sans uppercase tracking-[0.15em] text-[#d4af37]/40">
            NOD v4.0
          </p>
        </div>
      </div>
    );
  }

  if (!participant) {
    return (
      <div ref={shellRef} className="tabloid-app items-center justify-center">
        <PaperBackdrop />
        <BrutalCard tone="yellow" className="p-5 text-center">
          {bootError ? (
            <>
              <p className="mb-2 text-xl font-black uppercase leading-none text-red-600">
                Erreur Fatale
              </p>
              <p className="font-mono text-sm">{bootError}</p>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-black" />
              <p className="text-xl font-black uppercase leading-none">
                Chargement du jeu...
              </p>
              <p className="mt-2 text-[10px] font-sans uppercase tracking-[0.15em] text-[#d4af37]/40">
                NOD v4.0
              </p>
            </>
          )}
        </BrutalCard>
      </div>
    );
  }

  return (
    <div
      ref={shellRef}
      className={`tabloid-app ${uploadLoading || mutationBusyId ? "pointer-events-none" : ""}`}
    >
      <PaperBackdrop />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -18, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="toast-stack"
          >
            <div
              role="status"
              aria-live="polite"
              className={`flex items-center gap-2 rounded-[10px] border px-3 py-2 text-[11px] font-black uppercase tracking-[0.04em] shadow-[0_14px_36px_rgba(0,0,0,0.45)] backdrop-blur-xl ${toast.tone === "success" ? "border-[#d4af37]/60 bg-[#d4af37]/20 text-[#f0d889]" : toast.tone === "error" ? "border-red-400/40 bg-red-950/80 text-red-100" : "border-white/10 bg-black/80 text-white"}`}
            >
              {toast.tone === "success" ? (
                <Check className="h-4 w-4" />
              ) : toast.tone === "error" ? (
                <ShieldAlert className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span>{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showStudioOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-6 text-center select-none"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{
                scale: 1,
                y: 0,
                transition: { type: "spring", stiffness: 300, damping: 20 },
              }}
              exit={{ scale: 0.9, y: -20 }}
              className="max-w-md space-y-4"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#39FF14] bg-[#39FF14]/10 text-[#39FF14] shadow-[0_0_20px_rgba(57,255,20,0.3)]">
                <Check className="h-8 w-8 stroke-[3]" />
              </div>

              <h2 className="tabloid-headline text-3xl md:text-4xl leading-none text-white tracking-tight">
                DOSSIER SOUMIS
              </h2>

              <div className="inline-block rounded-none border-2 border-[#d4af37] bg-[#d4af37]/15 px-3 py-1.5 text-xs font-black uppercase tracking-[0.15em] text-[#f0d889] transform -rotate-1">
                EN ROUTE POUR LA CÉRÉMONIE DE SAISON 1
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="tabloid-main">
        <div className="tabloid-scroll mx-auto w-full max-w-[30rem] px-2">
          <header className="sticky top-0 z-30 mb-2 overflow-hidden bg-[#050505]/85 py-1.5 backdrop-blur-xl">
            <Ticker>
              CÉRÉMONIE DE LA SAISON 1 LE 1ER DU MOIS / DANS{" "}
              {ceremonyCountdown.days}J {ceremonyCountdown.hours}H{" "}
              {ceremonyCountdown.mins}M / TOURNOI DU MOIS /{" "}
              {monthlyNominations.length} DOSSIERS EN JEU /
            </Ticker>
          </header>

          <AnimatePresence mode="wait" custom={dir}>
            {tab === "direct" && (
              <DirectTab
                feedItems={feedItems}
                directFilter={directFilter}
                setDirectFilter={setDirectFilter}
                directFilterCounts={directFilterCounts}
                ownsNomination={ownsNomination}
                startEditNomination={startEditNomination}
                removeNomination={removeNomination}
                mutationBusyId={mutationBusyId}
                handleSectionDrag={handleSectionDrag}
                reduceMotion={reduceMotion}
                revealContainer={revealContainer}
                revealItem={revealItem}
                pageTransition={pageTransition}
                pendingForMe={pendingForMe}
                allNominations={nominations}
                ceremonyCountdown={ceremonyCountdown}
                palmaresRows={palmaresRows}
                activeMemberCount={activeMemberCount}
                switchTab={switchTab}
              />
            )}

            {tab === "vote" && (
              <VoteTab
                pendingForMe={pendingForMe}
                scoreDraftById={scoreDraftById}
                setScoreDraftById={setScoreDraftById}
                reviewDraftById={reviewDraftById}
                setReviewDraftById={setReviewDraftById}
                applyRating={applyRating}
                voteBusyId={voteBusyId}
                shakeId={shakeId}
                ownsNomination={ownsNomination}
                handleSectionDrag={handleSectionDrag}
                reduceMotion={reduceMotion}
                pageTransition={pageTransition}
              />
            )}

            {tab === "studio" && (
              <StudioTab
                editingNomination={editingNomination}
                fileInputRef={fileInputRef}
                prepareMedia={prepareMedia}
                previewUrl={previewUrl}
                thumbnailPreviewUrl={thumbnailPreviewUrl}
                mediaKind={mediaKind}
                isPreparingMedia={isPreparingMedia}
                uploadLoading={uploadLoading}
                mediaProgress={mediaProgress}
                tiktokerName={tiktokerName}
                setTiktokerName={setTiktokerName}
                cleanCategoryIds={cleanCategoryIds}
                toggleCategory={toggleCategory}
                comment={comment}
                setComment={setComment}
                initialScores={initialScores}
                setInitialScores={setInitialScores}
                uploadNomination={uploadNomination}
                cancelEditNomination={cancelEditNomination}
                uploadReady={uploadReady}
                mutationBusyId={mutationBusyId}
                handleSectionDrag={handleSectionDrag}
                reduceMotion={reduceMotion}
                pageTransition={pageTransition}
              />
            )}

            {tab === "palmares" && (
              <PalmaresTab
                palmaresRows={palmaresRows}
                switchTab={switchTab}
                handleSectionDrag={handleSectionDrag}
                reduceMotion={reduceMotion}
                pageTransition={pageTransition}
              />
            )}

            {tab === "winners" && (
              <WinnersTab
                ultimateWinner={ultimateWinner}
                paparazziOr={paparazziOr}
                categoryRaces={categoryRaces}
                handleSectionDrag={handleSectionDrag}
                reduceMotion={reduceMotion}
                pageTransition={pageTransition}
              />
            )}
          </AnimatePresence>
        </div>
      </main>

      <nav
        aria-label="Navigation principale"
        className="bottom-tabloid px-2 pt-1.5 pointer-events-auto"
      >
        <div className="mx-auto grid w-full max-w-[30rem] grid-cols-5 gap-1">
          {TAB_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            const badge = item.id === "vote" ? pendingForMe.length : 0;

            return (
              <motion.button
                key={item.id}
                type="button"
                whileTap={TAP_REBOUND}
                transition={TAP_TRANSITION}
                onClick={() => switchTab(item.id)}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center justify-center gap-0.5 rounded-[10px] border px-1 py-1.5 transition ${active ? "border-[#d4af37]/70 text-[#f0d889]" : "border-transparent bg-transparent hover:bg-white/5 text-zinc-400"}`}
              >
                {active && (
                  <motion.div
                    layoutId="navIndicator"
                    className="absolute inset-0 rounded-[10px] bg-[#d4af37]/18 shadow-[inset_0_0_10px_rgba(212,175,55,0.1)]"
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
                <Icon className="relative z-10 h-4 w-4" strokeWidth={1.5} />
                <span className="relative z-10 text-[7.5px] font-black uppercase tracking-tighter">
                  {item.label}
                </span>
                {badge > 0 && (
                  <span className="absolute right-0 top-0 z-20 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full border border-[#d4af37]/80 bg-[#d4af37] px-1 text-[8px] font-black text-black">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
