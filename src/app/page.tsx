"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import confetti from "canvas-confetti";
import { getSupabaseBrowserClient, ensureAnonymousSession } from "@/lib/supabase";
import {
  STORAGE_UNAVAILABLE_NOTICE,
  compressImageToWebp,
  extractVideoThumbnail,
  isStorageUnavailableMessage,
  uploadMediaFile
} from "@/lib/storage";
import { Ticker } from "@/components/ui/Ticker";
import { AnimatePresence, motion, type PanInfo, useReducedMotion } from "framer-motion";
import { usePalmares } from "@/hooks/usePalmares";
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
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trophy,
  UploadCloud,
  Zap
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
const LEGACY_FLOWER_VIDEO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const FALLBACK_IMAGE_URL =
  "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1080'%20height='1440'%20viewBox='0%200%201080%201440'%3E%3Crect%20width='1080'%20height='1440'%20fill='%23000000'/%3E%3Crect%20x='64'%20y='64'%20width='952'%20height='1312'%20fill='%23f2efe3'%20stroke='%23000000'%20stroke-width='24'/%3E%3Crect%20x='112'%20y='112'%20width='856'%20height='240'%20fill='%23e11d48'/%3E%3Ctext%20x='540'%20y='248'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='118'%20fill='%23ffffff'%3ENOD%3C/text%3E%3Ctext%20x='540'%20y='690'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='104'%20fill='%23000000'%3EDOSSIER%3C/text%3E%3Ctext%20x='540'%20y='810'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='104'%20fill='%23000000'%3EEN%20DIRECT%3C/text%3E%3Crect%20x='248'%20y='936'%20width='584'%20height='132'%20fill='%23b5f42b'%20stroke='%23000000'%20stroke-width='18'/%3E%3Ctext%20x='540'%20y='1028'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='64'%20fill='%23000000'%3EA%20VOTER%3C/text%3E%3C/svg%3E";
const TAP_REBOUND = { scale: 0.965, rotate: -0.35 };
const TAP_TRANSITION = { type: "spring", stiffness: 900, damping: 32, mass: 0.42 } as const;
const HAPTICS = {
  tap: 10,
  option: 14,
  nav: 16,
  media: 18,
  success: [15, 30, 10],
  remove: [25, 60],
  error: 100
} as const;

const CATEGORIES: CategoryMeta[] = [
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

const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((category) => [category.id, category])) as Record<string, CategoryMeta>;
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
  viral: "surprise-totale"
};
const FEATURED_CATEGORY_IDS = ["le-zin-du-mois", "la-fierte-des-notres", "xptdr", "la-roue-libre", "la-honte-de-la-oumma", "bon-voyageur", "gros-chef-bandit", "surprise-totale", "lanalyse-pure"] as const;
const RATING_DIMENSIONS: Array<{ key: RatingDimensionKey; label: string; shortLabel: string; emoji: string; color: string }> = [
  { key: "rire", label: "Rire", shortLabel: "RIR", emoji: "😂", color: "#facc15" },
  { key: "surprise", label: "Surprise", shortLabel: "SUR", emoji: "🤯", color: "#38bdf8" },
  { key: "gene", label: "Gêne", shortLabel: "GÊN", emoji: "🤦", color: "#f43f5e" },
  { key: "fierte", label: "Fierté", shortLabel: "FIE", emoji: "✊", color: "#d4af37" },
  { key: "interet", label: "Intérêt", shortLabel: "INT", emoji: "🤔", color: "#a78bfa" }
];
const DEFAULT_DIMENSION_SCORES: DimensionScores = { rire: 3, surprise: 3, gene: 1, fierte: 2, interet: 3 };
const CATEGORY_SCORING: Record<string, { weights: DimensionScores; lowIsStrong?: Partial<Record<RatingDimensionKey, boolean>> }> = {
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
const SCORE_PRESETS: Array<{ id: string; label: string; hint: string; scores: DimensionScores }> = [
  { id: "xptdr", label: "XPTDR", hint: "rire fort", scores: { rire: 5, surprise: 3, gene: 1, fierte: 1, interet: 3 } },
  { id: "malaise", label: "Malaise", hint: "gêne max", scores: { rire: 1, surprise: 2, gene: 5, fierte: 0, interet: 2 } },
  { id: "masterclass", label: "Masterclass", hint: "niveau haut", scores: { rire: 2, surprise: 4, gene: 0, fierte: 5, interet: 4 } },
  { id: "choc", label: "Choc", hint: "surprise", scores: { rire: 2, surprise: 5, gene: 2, fierte: 2, interet: 5 } },
  { id: "la-roue-libre", label: "Roue libre", hint: "chaos", scores: { rire: 4, surprise: 4, gene: 3, fierte: 1, interet: 3 } }
];
const TAB_ITEMS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "direct", label: "Direct", icon: Sparkles },
  { id: "vote", label: "À voter", icon: Zap },
  { id: "studio", label: "Studio", icon: Plus },
  { id: "palmares", label: "Palmarès", icon: Trophy },
  { id: "winners", label: "Trophées", icon: Crown }
];

const TAB_ORDER: Tab[] = TAB_ITEMS.map((item) => item.id);
const DIRECT_FILTERS: Array<{ id: DirectFilter; label: string }> = [
  { id: "all", label: "Tout" },
  { id: "pending", label: "À voter" },
  { id: "qualified", label: "Nominés" },
  { id: "elite", label: "Favoris" },
  { id: "mine", label: "Moi" }
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

function cloneScores(scores: DimensionScores = DEFAULT_DIMENSION_SCORES): DimensionScores {
  return {
    rire: clampDimension(scores.rire),
    surprise: clampDimension(scores.surprise),
    gene: clampDimension(scores.gene),
    fierte: clampDimension(scores.fierte),
    interet: clampDimension(scores.interet)
  };
}

function normalizedCategoryId(categoryId: string) {
  const resolved = CATEGORY_ID_ALIASES[categoryId] ?? categoryId;
  return CATEGORY_BY_ID[resolved] ? resolved : CATEGORIES[0].id;
}

function scoreForCategory(scores: DimensionScores, categoryId: string) {
  const profile = CATEGORY_SCORING[normalizedCategoryId(categoryId)] ?? CATEGORY_SCORING[CATEGORIES[0].id];
  const weighted = RATING_DIMENSIONS.reduce((sum, dimension) => {
    const rawValue = clampDimension(scores[dimension.key]);
    const adjustedValue = profile.lowIsStrong?.[dimension.key] ? 5 - rawValue : rawValue;
    return sum + adjustedValue * profile.weights[dimension.key];
  }, 0);

  return Math.min(100, Math.max(0, Math.round(weighted * 20)));
}

function scoreTotal(scores: DimensionScores, categoryIds: string[] = [CATEGORIES[0].id]) {
  const ids = normalizeCategoryIds(categoryIds, CATEGORIES[0].id);
  const total = ids.reduce((sum, categoryId) => sum + scoreForCategory(scores, categoryId), 0);
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
    window.dispatchEvent(new CustomEvent("nod-haptic", { detail: { pattern } }));
  }
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern as VibratePattern);
  } catch {
    // iOS Safari ignore souvent cette API; les ressorts visuels gardent le retour tactile.
  }
}

function sameScores(a: DimensionScores, b: DimensionScores) {
  return RATING_DIMENSIONS.every((dimension) => clampDimension(a[dimension.key]) === clampDimension(b[dimension.key]));
}

function categorySummary(ids: string[]) {
  const labels = normalizeCategoryIds(ids, CATEGORIES[0].id).map((id) => getCategoryMeta(id).label);
  if (labels.length <= 2) return labels.join(" + ");
  return `${labels.slice(0, 2).join(" + ")} +${labels.length - 2}`;
}

function makeSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
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
  return CATEGORY_BY_ID[resolved] ?? { id: "custom", label: value || "Sans catégorie", mood: "fun", icon: Camera };
}

function normalizeCategoryIds(value: unknown, fallback: string) {
  const rawIds = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const validIds = rawIds.map((id) => CATEGORY_ID_ALIASES[id] ?? id).filter((id) => CATEGORY_BY_ID[id]);
  const resolvedFallback = CATEGORY_ID_ALIASES[fallback] ?? fallback;
  const fallbackId = CATEGORY_BY_ID[resolvedFallback] ? resolvedFallback : CATEGORIES[0].id;
  return Array.from(new Set(validIds.length > 0 ? validIds : [fallbackId]));
}

function primaryCategoryId(ids: string[]) {
  return ids.map((id) => CATEGORY_ID_ALIASES[id] ?? id).find((id) => CATEGORY_BY_ID[id]) ?? CATEGORIES[0].id;
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
  if (status === "accepted") return "border-[#d4af37]/60 bg-[#d4af37]/15 text-[#f0d889]";
  if (status === "rejected") return "border-red-400/30 bg-red-950/40 text-red-100";
  return "border-[#d4af37]/50 bg-white/5 text-[#f0d889]";
}

function averageRating(ratings: Rating[], categoryIds?: string[]) {
  if (ratings.length === 0) return 0;
  return ratings.reduce((sum, rating) => sum + ratingImpactScore(rating, categoryIds), 0) / ratings.length;
}

function totalPoints(ratings: Rating[], categoryIds?: string[]) {
  return ratings.reduce((sum, rating) => sum + ratingImpactPoints(rating, categoryIds), 0);
}

function averageImpact(nomination: Nomination, categoryIds = nomination.category_ids) {
  if (nomination.ratings.length === 0) return 0;
  return Math.round(totalPoints(nomination.ratings, categoryIds) / nomination.ratings.length);
}

function countdownToNextCeremony() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const diffMs = Math.max(0, next.getTime() - Date.now());
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return { days, hours, mins };
}

function isCurrentMonth(dateValue: string) {
  const date = new Date(dateValue);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function parseRating(row: Record<string, unknown>): Rating {
  const legacyRating = clampRating(toNumber(row.rating_stars, 0));
  const scores = cloneScores({
    rire: clampDimension(toNumber(row.rire_score, legacyRating)),
    surprise: clampDimension(toNumber(row.surprise_score, legacyRating)),
    gene: clampDimension(toNumber(row.gene_score, legacyRating)),
    fierte: clampDimension(toNumber(row.fierte_score, legacyRating)),
    interet: clampDimension(toNumber(row.interet_score, legacyRating))
  });
  const computedScore = scoreAverage(scores);
  const computedPoints = scoreTotal(scores);

  return {
    id: toText(row.id, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    nomination_id: toText(row.nomination_id),
    voter_id: toText(row.voter_id),
    rating_stars: clampRating(toNumber(row.rating_stars, Math.round(computedScore))),
    rating_score: Math.min(5, Math.max(0, toNumber(row.rating_score, computedScore))),
    rating_points: Math.min(100, Math.max(0, toNumber(row.rating_points, computedPoints))),
    scores,
    comment: toText(row.comment),
    created_at: toText(row.created_at, new Date().toISOString())
  };
}

function makeRatingFromDraft(nominationId: string, voterId: string, scores: DimensionScores, comment: string, categoryIds?: string[]): Rating {
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
    created_at: new Date().toISOString()
  };
}

function readPendingRatings(): PendingRatingPayload[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_RATINGS_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PendingRatingPayload => isRecord(item) && typeof item.nominationId === "string" && typeof item.voterId === "string" && isRecord(item.scores));
  } catch {
    return [];
  }
}

function writePendingRatings(items: PendingRatingPayload[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PENDING_RATINGS_KEY, JSON.stringify(items.slice(-80)));
}

function queuePendingRating(payload: PendingRatingPayload) {
  const rest = readPendingRatings().filter((item) => !(item.nominationId === payload.nominationId && item.voterId === payload.voterId));
  writePendingRatings([...rest, payload]);
}

function parseNomination(row: Record<string, unknown>): Nomination {
  const ratings = Array.isArray(row.ratings) ? row.ratings.filter(isRecord).map(parseRating) : [];
  const rawMediaKind = toText(row.media_kind, "image");
  const fallbackCategory = toText(row.category_id, CATEGORIES[0].id);
  const categoryIds = normalizeCategoryIds(row.category_ids, fallbackCategory);
  const computedStatus = statusFromRatings(ratings);

  return {
    id: toText(row.id, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    room_id: toText(row.room_id),
    category_id: primaryCategoryId(categoryIds),
    category_ids: categoryIds,
    tiktoker_name: sanitizeTiktokerName(toText(row.tiktoker_name, "TikToker mystère")) || "TikToker mystère",
    media_url: toText(row.media_url, FALLBACK_IMAGE_URL),
    video_storage_path: toText(row.video_storage_path) || null,
    thumbnail_url: toText(row.thumbnail_url) || null,
    thumbnail_storage_path: toText(row.thumbnail_storage_path) || null,
    media_kind: rawMediaKind === "video" ? "video" : "image",
    comment: toText(row.comment),
    submitted_by: toText(row.submitted_by, "session-inconnue"),
    status: computedStatus,
    created_at: toText(row.created_at, new Date().toISOString()),
    ratings
  };
}

function isLegacyDemoMedia(url: string) {
  return url === LEGACY_FLOWER_VIDEO_URL;
}

function voteBurst(points: number) {
  const elite = points >= 80;
  const colors = elite ? ["#d4af37", "#f0d889", "#ffffff", "#050505"] : ["#d4af37", "#8a6f24", "#f5f1e8"];

  void confetti({
    particleCount: elite ? 118 : 72,
    spread: elite ? 90 : 62,
    startVelocity: elite ? 46 : 34,
    scalar: elite ? 1 : 0.82,
    ticks: 150,
    colors,
    origin: { y: 0.72 },
    disableForReducedMotion: true
  });
}

function setUrl(urlSetter: (value: string | null) => void, currentUrl: string | null, nextFile: File | null) {
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  urlSetter(nextFile ? URL.createObjectURL(nextFile) : null);
}

function buildScoreBoard(nominations: Nomination[], categoryId?: string) {
  const monthlyQualified = nominations.filter((nomination) => nomination.status !== "pending" && isCurrentMonth(nomination.created_at) && (!categoryId || nomination.category_ids.includes(categoryId)));
  const byTarget = new Map<string, ScoreBoard>();

  for (const nomination of monthlyQualified) {
    const category = getCategoryMeta(categoryId ?? nomination.category_id);
    const existing = byTarget.get(nomination.tiktoker_name) ?? {
      tiktokerName: nomination.tiktoker_name,
      category: categoryId ? category : undefined,
      points: 0,
      votes: 0,
      average: 0,
      nominations: 0
    };

    existing.nominations += 1;
    for (const rating of nomination.ratings) {
      existing.points += ratingImpactPoints(rating, categoryId ? [categoryId] : nomination.category_ids);
      existing.votes += 1;
    }
    existing.average = existing.votes > 0 ? existing.points / existing.votes / 20 : 0;
    byTarget.set(nomination.tiktoker_name, existing);
  }

  return Array.from(byTarget.values()).sort((a, b) => b.points - a.points || b.average - a.average || a.tiktokerName.localeCompare(b.tiktokerName));
}

function bestSubmission(nominations: Nomination[]) {
  return nominations
    .filter((nomination) => nomination.status !== "pending" && isCurrentMonth(nomination.created_at))
    .sort((a, b) => totalPoints(b.ratings, b.category_ids) - totalPoints(a.ratings, a.category_ids) || averageRating(b.ratings, b.category_ids) - averageRating(a.ratings, a.category_ids))[0];
}

function buildPalmaresRows(nominations: Nomination[]) {
  const rows = new Map<string, PalmaresRow>();
  const monthly = nominations.filter((nomination) => isCurrentMonth(nomination.created_at));

  for (const nomination of monthly) {
    const current = rows.get(nomination.tiktoker_name) ?? {
      tiktokerName: nomination.tiktoker_name,
      avatarUrl: nomination.thumbnail_url || nomination.media_url || FALLBACK_IMAGE_URL,
      points: 0,
      votes: 0,
      average: 0,
      totalDossiers: 0,
      acceptedDossiers: 0,
      successRate: 0,
      categoryCounts: Object.fromEntries(FEATURED_CATEGORY_IDS.map((id) => [id, 0])) as Record<string, number>,
      starDistribution: createStarDistribution(),
      dimensionTotals: cloneScores({ rire: 0, surprise: 0, gene: 0, fierte: 0, interet: 0 })
    };

    current.totalDossiers += 1;
    if (nomination.status !== "pending") current.acceptedDossiers += 1;
    for (const categoryId of nomination.category_ids) {
      if (FEATURED_CATEGORY_IDS.includes(categoryId as (typeof FEATURED_CATEGORY_IDS)[number])) {
        current.categoryCounts[categoryId] = (current.categoryCounts[categoryId] ?? 0) + 1;
      }
    }

    for (const rating of nomination.ratings) {
      current.points += ratingImpactPoints(rating, nomination.category_ids);
      current.votes += 1;
      addToStarDistribution(current.starDistribution, ratingImpactScore(rating, nomination.category_ids));
      addScores(current.dimensionTotals, rating.scores);
    }

    current.average = current.votes > 0 ? current.points / current.votes / 20 : 0;
    current.successRate = current.totalDossiers > 0 ? Math.round((current.acceptedDossiers / current.totalDossiers) * 100) : 0;
    rows.set(nomination.tiktoker_name, current);
  }

  return Array.from(rows.values()).sort((a, b) => b.points - a.points || b.successRate - a.successRate || b.average - a.average || a.tiktokerName.localeCompare(b.tiktokerName));
}

function buildCategoryRaces(nominations: Nomination[]): CategoryRace[] {
  const monthly = nominations.filter((nomination) => isCurrentMonth(nomination.created_at));

  return CATEGORIES.map((category) => {
    const inCategory = monthly.filter((nomination) => nomination.category_ids.includes(category.id));
    const rows = new Map<string, CategoryRaceRow>();

    for (const nomination of inCategory) {
      const current = rows.get(nomination.tiktoker_name) ?? {
        tiktokerName: nomination.tiktoker_name,
        avatarUrl: nomination.thumbnail_url || nomination.media_url || FALLBACK_IMAGE_URL,
        points: 0,
        votes: 0,
        average: 0,
        totalDossiers: 0,
        acceptedDossiers: 0,
        pendingDossiers: 0,
        rejectedDossiers: 0,
        successRate: 0,
        starDistribution: createStarDistribution(),
        dimensionTotals: cloneScores({ rire: 0, surprise: 0, gene: 0, fierte: 0, interet: 0 })
      };

      current.totalDossiers += 1;
      if (nomination.status !== "pending") current.acceptedDossiers += 1;
      if (nomination.status === "pending") current.pendingDossiers += 1;
      if (nomination.status === "rejected") current.rejectedDossiers += 1;

      for (const rating of nomination.ratings) {
        current.points += ratingImpactPoints(rating, [category.id]);
        current.votes += 1;
        addToStarDistribution(current.starDistribution, ratingImpactScore(rating, [category.id]));
        addScores(current.dimensionTotals, rating.scores);
      }

      current.average = current.votes > 0 ? current.points / current.votes / 20 : 0;
      current.successRate = current.totalDossiers > 0 ? Math.round((current.acceptedDossiers / current.totalDossiers) * 100) : 0;
      rows.set(nomination.tiktoker_name, current);
    }

    return {
      category,
      totalDossiers: inCategory.length,
      rows: Array.from(rows.values()).sort((a, b) => b.points - a.points || b.successRate - a.successRate || b.average - a.average || a.tiktokerName.localeCompare(b.tiktokerName))
    };
  });
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function Sticker({
  children,
  tone = "red",
  className = ""
}: {
  children: ReactNode;
  tone?: "red" | "yellow" | "black" | "paper";
  className?: string;
}) {
  const toneClass =
    tone === "yellow"
      ? "border-[#d4af37]/60 bg-[#d4af37]/15 text-[#f0d889]"
      : tone === "black"
        ? "border-white/10 bg-black/70 text-white"
        : tone === "paper"
          ? "border-white/10 bg-white/5 text-white"
          : "border-red-400/30 bg-red-950/40 text-red-100";

  return <span className={`inline-flex rounded-[10px] border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] leading-none ${toneClass} ${className}`}>{children}</span>;
}

function SectionTitle({ children, tone = "black" }: { children: ReactNode; tone?: "black" | "red" | "yellow" }) {
  const toneClass = tone === "red" ? "border-red-400/30 text-red-100" : tone === "yellow" ? "border-[#d4af37]/60 text-[#f0d889]" : "border-white/10 text-white";
  return (
    <div className={`rounded-[10px] border bg-white/[0.035] px-2.5 py-1.5 ${toneClass}`}>
      <h2 className="tabloid-headline text-[clamp(1.1rem,5.7vw,1.95rem)] leading-[0.84]">{children}</h2>
    </div>
  );
}

function MicroDimensionBars({ scores }: { scores: DimensionScores }) {
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

function BrutalCard({
  children,
  className = "",
  tone = "paper"
}: {
  children: ReactNode;
  className?: string;
  tone?: "paper" | "red" | "yellow" | "black";
}) {
  const toneClass = tone === "red" ? "brutal-card-red" : tone === "yellow" ? "brutal-card-yellow" : tone === "black" ? "brutal-card-black" : "";

  return (
    <motion.div whileTap={{ scale: 0.985 }} transition={{ type: "spring", stiffness: 520, damping: 24 }} className={`brutal-card ${toneClass} ${className}`}>
      {children}
    </motion.div>
  );
}

function ScorePresetRail({
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

function DimensionScoreGrid({
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

function MediaFrame({
  nomination,
  height = "h-72"
}: {
  nomination: Nomination;
  height?: string;
  controls?: boolean;
}) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    setMediaFailed(false);
    setEngaged(false);
    setResolving(true);
  }, [nomination.media_url, nomination.thumbnail_url]);

  if (mediaFailed || isLegacyDemoMedia(nomination.media_url)) {
    return (
      <div className={`${height} relative flex w-full items-center justify-center bg-black`}>
        {nomination.thumbnail_url ? <img src={nomination.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" /> : null}
        <div className="relative z-10 mx-3 rounded-full border border-[#d4af37]/60 bg-black/70 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.12em] leading-none text-[#f0d889]">
          Rec à renvoyer depuis le Studio
        </div>
      </div>
    );
  }

  if (nomination.media_kind === "video") {
    return (
      <div className={`${height} relative w-full overflow-hidden bg-black`}>
        {resolving && (
          <div className="media-shimmer absolute inset-0 z-10 flex items-center justify-center" aria-hidden="true">
            <Loader2 className="h-5 w-5 animate-spin text-[#d4af37]" />
          </div>
        )}
        <video
          src={nomination.media_url}
          poster={nomination.thumbnail_url ?? undefined}
          autoPlay
          controls={false}
          loop
          muted
          playsInline
          preload="metadata"
          {...({ "webkit-playsinline": "true" } as Record<string, string>)}
          onLoadedMetadata={() => setResolving(false)}
          onCanPlay={() => setResolving(false)}
          onClick={(event) => {
            haptic(HAPTICS.media);
            setEngaged(true);
            void event.currentTarget.play().catch(() => undefined);
          }}
          onTouchStart={() => setEngaged(true)}
          onError={() => {
            setResolving(false);
            setMediaFailed(true);
          }}
          className="prestige-media block h-full w-full bg-black object-cover"
        />
        {engaged ? null : <span className="pointer-events-none absolute bottom-2 left-2 z-20 rounded-full border border-[#d4af37]/40 bg-black/60 px-2 py-1 text-[8px] font-black uppercase tracking-tighter text-[#f0d889]">Rec</span>}
      </div>
    );
  }

  return (
    <div className={`${height} relative w-full overflow-hidden bg-black`}>
      {resolving && (
        <div className="media-shimmer absolute inset-0 z-10 flex items-center justify-center" aria-hidden="true">
          <Loader2 className="h-5 w-5 animate-spin text-[#d4af37]" />
        </div>
      )}
      <img
        src={nomination.media_url || nomination.thumbnail_url || FALLBACK_IMAGE_URL}
        alt=""
        onLoad={() => setResolving(false)}
        onError={() => {
          setResolving(false);
          setMediaFailed(true);
        }}
        className="prestige-media block h-full w-full bg-black object-cover"
      />
    </div>
  );
}

function OwnershipBadge({ owned, className = "" }: { owned: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-[10px] border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] leading-none ${owned ? "border-[#d4af37]/70 bg-[#d4af37]/15 text-[#f0d889]" : "border-white/10 bg-white/10 text-white"} ${className}`}>
      {owned ? (
        <>
          PAR VOUS <Pencil className="h-2.5 w-2.5" strokeWidth={3} />
        </>
      ) : (
        <>
          PAR AUTRE <Lock className="h-2.5 w-2.5" strokeWidth={3} />
        </>
      )}
    </span>
  );
}

function NominationTile({
  nomination,
  index = 0,
  owned = false,
  onEdit,
  onRemove,
  busy = false
}: {
  nomination: Nomination;
  index?: number;
  owned?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
  busy?: boolean;
}) {
  const category = getCategoryMeta(nomination.category_id);
  const Icon = category.icon;
  const rating = averageRating(nomination.ratings, nomination.category_ids);
  const impact = averageImpact(nomination);
  const categories = categorySummary(nomination.category_ids);

  return (
    <BrutalCard tone={index % 3 === 0 ? "yellow" : "paper"} className="overflow-hidden">
      <div className="media-cut relative aspect-[4/3] border-b border-[#d4af37]/20">
        <MediaFrame nomination={nomination} height="h-full" controls={false} />
        <OwnershipBadge owned={owned} className="absolute left-2 top-2" />
        <Sticker tone={nomination.status === "pending" ? "yellow" : "paper"} className="absolute bottom-2 right-2">
          {statusLabel(nomination.status)}
        </Sticker>
      </div>
      <div className="min-w-0 p-2">
        <p className="tabloid-headline text-[clamp(0.96rem,4.8vw,1.32rem)] leading-[0.86] text-white">{nomination.tiktoker_name}</p>
        <p className="mt-0.5 line-clamp-2 text-[9px] font-medium leading-tight text-zinc-300">&quot;{nomination.comment || "Dossier à juger"}&quot;</p>
        <p className="mt-1 flex min-w-0 items-center gap-1 truncate text-[7px] font-black uppercase tracking-[0.05em] leading-none text-[#d4af37]">
          <Icon className="h-2.5 w-2.5 shrink-0" /> {categories} / {nomination.ratings.length} notes / {impact || "-"} indice / {rating ? rating.toFixed(1) : "-"}★
        </p>
        {owned && (
          <div className="mt-1 grid grid-cols-2 gap-1">
            <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={onEdit} className="owner-action bg-white/10 text-white" type="button" aria-label={`Modifier le dossier ${nomination.tiktoker_name}`}>
              Modifier
            </motion.button>
            <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={onRemove} disabled={busy} className="owner-action bg-red-950/50 text-red-100 disabled:opacity-60" type="button" aria-label={`Retirer le dossier ${nomination.tiktoker_name}`}>
              Retirer
            </motion.button>
          </div>
        )}
      </div>
    </BrutalCard>
  );
}

function PalmaresList({ rows, onOpenStudio }: { rows: PalmaresRow[]; onOpenStudio?: () => void }) {
  if (rows.length === 0) {
    return (
      <BrutalCard className="p-3 text-center">
        <Trophy className="mx-auto mb-2 h-8 w-8 text-[#d4af37]" />
        <p className="tabloid-headline text-2xl leading-none">Aucun classement.</p>
        <p className="mx-auto mt-1 max-w-[15rem] text-[10px] font-semibold uppercase tracking-tighter text-zinc-500">Le palmarès commence dès le premier dossier noté.</p>
        {onOpenStudio ? (
          <motion.button type="button" whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={onOpenStudio} className="brutal-action mt-3 bg-[#d4af37] px-4 text-black">
            Inviter les Zins à voter
          </motion.button>
        ) : null}
      </BrutalCard>
    );
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-white/10 bg-black/25">
      {rows.map((row, index) => (
        <motion.article
          key={row.tiktokerName}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.035, type: "spring", stiffness: 240, damping: 26 }}
          className="border-b border-white/10 px-2 py-1.5 last:border-b-0"
        >
          <div className="grid grid-cols-[1.15rem_2.25rem_minmax(0,1fr)_auto] items-center gap-2">
            <p className="rank-number text-[1.45rem] leading-none text-[#d4af37]">{index + 1}</p>
            <div className="relative h-9 w-9 overflow-hidden rounded-full border border-[#d4af37]/45 bg-[#d4af37]/10">
              {row.avatarUrl ? <img src={row.avatarUrl} alt="" className="h-full w-full object-cover" /> : null}
              {!row.avatarUrl && <span className="flex h-full w-full items-center justify-center text-[10px] font-black text-[#f0d889]">{initialsFor(row.tiktokerName)}</span>}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-black leading-none tracking-tighter text-white">@{row.tiktokerName}</p>
              <p className="mt-0.5 truncate text-[9px] font-semibold uppercase leading-none tracking-tighter text-zinc-500">
                {row.acceptedDossiers}/{row.totalDossiers} nominés · {row.votes} notes · {row.average ? row.average.toFixed(1) : "-"}★
              </p>
            </div>
            <span className="gold-pill shrink-0">{row.points} pts</span>
          </div>

          <div className="mt-1 grid grid-cols-[minmax(0,1fr)_7.25rem_2.25rem] items-end gap-2 pl-[3.4rem]">
            <div className="stat-bar">
              <motion.div className="stat-bar-fill" initial={{ width: 0 }} animate={{ width: `${row.successRate}%` }} transition={{ delay: index * 0.035 + 0.1, duration: 0.45 }} />
            </div>
            <MicroDimensionBars scores={row.dimensionTotals} />
            <p className="text-right text-[10px] font-black leading-none tracking-tighter text-[#f0d889]">{row.successRate}%</p>
          </div>
        </motion.article>
      ))}
    </div>
  );
}

function CategoryRaceBoard({ races }: { races: CategoryRace[] }) {
  return (
    <div className="space-y-2">
      {races.map(({ category, rows, totalDossiers }) => {
        const Icon = category.icon;
        const leader = rows[0];

        return (
          <BrutalCard key={category.id} className="p-0">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-2 py-1.5">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[9px] font-black uppercase leading-none tracking-tighter text-[#d4af37]">
                  <Icon className="h-3 w-3 shrink-0" /> {category.label}
                </p>
                <p className="mt-0.5 truncate text-[10px] font-semibold uppercase leading-none tracking-tighter text-zinc-500">{leader ? `Leader · ${leader.tiktokerName}` : "En attente"}</p>
              </div>
              <span className="gold-pill shrink-0">{totalDossiers} dossiers</span>
            </div>

            <div className="divide-y divide-white/10">
              {rows.length === 0 ? (
                <div className="px-2 py-2 text-center text-xs font-semibold text-zinc-500">Aucun nommé pour l&apos;instant.</div>
              ) : (
                rows.map((row, index) => (
                  <motion.div
                    key={`${category.id}-${row.tiktokerName}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.028, type: "spring", stiffness: 240, damping: 26 }}
                    className="px-2 py-1.5"
                  >
                    <div className="grid grid-cols-[1rem_2rem_minmax(0,1fr)_auto] items-center gap-2">
                      <p className="rank-number text-[1.1rem] leading-none text-[#d4af37]">{index + 1}</p>
                      <div className="h-8 w-8 overflow-hidden rounded-full border border-[#d4af37]/45 bg-[#d4af37]/10">
                        {row.avatarUrl ? <img src={row.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-[9px] font-black text-[#f0d889]">{initialsFor(row.tiktokerName)}</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black leading-none tracking-tighter text-white">@{row.tiktokerName}</p>
                        <p className="mt-0.5 truncate text-[9px] font-semibold uppercase leading-none tracking-tighter text-zinc-500">
                          {row.acceptedDossiers}/{row.totalDossiers} nominés · {row.votes} notes · {row.average ? row.average.toFixed(1) : "-"}★
                        </p>
                      </div>
                      <span className="gold-pill shrink-0">{row.points} pts</span>
                    </div>

                    <div className="mt-1 grid grid-cols-[minmax(0,1fr)_7rem_2.25rem] items-end gap-2 pl-[3rem]">
                      <div className="stat-bar">
                        <motion.div className="stat-bar-fill" initial={{ width: 0 }} animate={{ width: `${row.successRate}%` }} transition={{ delay: index * 0.03 + 0.08, duration: 0.42 }} />
                      </div>
                      <MicroDimensionBars scores={row.dimensionTotals} />
                      <p className="text-right text-[10px] font-black leading-none tracking-tighter text-[#f0d889]">{row.successRate}%</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </BrutalCard>
        );
      })}
    </div>
  );
}

function CeremonyBulletin({
  pendingCount,
  nextPending,
  leader,
  bestDossier,
  onOpenVote,
  onOpenStudio,
  onOpenPalmares
}: {
  pendingCount: number;
  nextPending?: Nomination;
  leader: ScoreBoard | null;
  bestDossier?: Nomination;
  onOpenVote: () => void;
  onOpenStudio: () => void;
  onOpenPalmares: () => void;
}) {
  const hasPending = Boolean(nextPending);
  const spotlight = bestDossier ? `${bestDossier.tiktoker_name} · ${averageImpact(bestDossier)} indice` : null;

  if (hasPending && nextPending) {
    const category = getCategoryMeta(nextPending.category_id);
    return (
      <BrutalCard tone="yellow" className="mb-2 p-2">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="min-w-0">
            <Sticker tone="yellow">{pendingCount > 1 ? `${pendingCount} dossiers à juger` : "Dossier à juger"}</Sticker>
            <p className="tabloid-headline mt-1 text-[clamp(1.05rem,5.5vw,1.8rem)] leading-[0.84] text-white">{nextPending.tiktoker_name}</p>
            <p className="mt-0.5 truncate text-[9px] font-black uppercase tracking-tighter text-[#d4af37]">{category.label} · ta note peut le nominer</p>
          </div>
          <motion.button type="button" whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={onOpenVote} className="brutal-action bg-[#d4af37] px-3 text-black">
            Juger
          </motion.button>
        </div>
      </BrutalCard>
    );
  }

  if (leader) {
    return (
      <BrutalCard className="mb-2 p-2">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="min-w-0">
            <Sticker tone="paper">Favori du mois</Sticker>
            <p className="tabloid-headline mt-1 text-[clamp(1.05rem,5.5vw,1.8rem)] leading-[0.84] text-white">{leader.tiktokerName}</p>
            <p className="mt-0.5 truncate text-[9px] font-black uppercase tracking-tighter text-[#d4af37]">{leader.points} points de saison{spotlight ? ` · ${spotlight}` : ""}</p>
          </div>
          <motion.button type="button" whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={onOpenPalmares} className="brutal-action bg-white/10 px-3 text-white">
            Classement
          </motion.button>
        </div>
      </BrutalCard>
    );
  }

  return (
    <BrutalCard className="mb-2 p-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="min-w-0">
          <Sticker tone="paper">Saison ouverte</Sticker>
          <p className="tabloid-headline mt-1 text-[clamp(1.05rem,5.5vw,1.8rem)] leading-[0.84] text-white">Premier rec attendu</p>
          <p className="mt-0.5 truncate text-[9px] font-black uppercase tracking-tighter text-[#d4af37]">Le trophée commence au premier dossier</p>
        </div>
        <motion.button type="button" whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={onOpenStudio} className="brutal-action bg-[#d4af37] px-3 text-black">
          Studio
        </motion.button>
      </div>
    </BrutalCard>
  );
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
  const reduceMotion = useReducedMotion();
  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseBrowserClient>>(null);
  const [bootingSession, setBootingSession] = useState(true);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState(DEFAULT_ROOM_CODE);

  const [tab, setTab] = useState<Tab>("direct");
  const [directFilter, setDirectFilter] = useState<DirectFilter>("all");
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [syncing, setSyncing] = useState(false);

  const [toast, setToast] = useState<ToastState>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const [ceremonyCountdown, setCeremonyCountdown] = useState(countdownToNextCeremony);

  const [preparedFile, setPreparedFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [mediaKind, setMediaKind] = useState<MediaKind | null>(null);
  const [previewUrl, setPreviewUrlState] = useState<string | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrlState] = useState<string | null>(null);
  const [mediaProgress, setMediaProgress] = useState(0);
  const [studioNotice, setStudioNotice] = useState<string | null>(null);
  const [isPreparingMedia, setIsPreparingMedia] = useState(false);
  const [tiktokerName, setTiktokerName] = useState("");
  const [catId, setCatId] = useState(CATEGORIES[0].id);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([CATEGORIES[0].id]);
  const [comment, setComment] = useState("");
  const [initialScores, setInitialScores] = useState<DimensionScores>(cloneScores(DEFAULT_DIMENSION_SCORES));
  const [uploadLoading, setUploadLoading] = useState(false);
  const [editingNominationId, setEditingNominationId] = useState<string | null>(null);
  const [mutationBusyId, setMutationBusyId] = useState<string | null>(null);

  const [scoreDraftById, setScoreDraftById] = useState<Record<string, DimensionScores>>({});
  const [reviewDraftById, setReviewDraftById] = useState<Record<string, string>>({});
  const [voteBusyId, setVoteBusyId] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [globalShake, setGlobalShake] = useState<number>(0);

  useEffect(() => {
    const onHaptic = () => setGlobalShake(Date.now());
    window.addEventListener("nod-haptic", onHaptic as any);
    return () => window.removeEventListener("nod-haptic", onHaptic as any);
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

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
    setTab(nextTab);
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
          const storedPseudo = sanitizePseudo(localStorage.getItem(PSEUDO_KEY) || "");
          const nextPseudo = storedPseudo || `Joueur ${user.id.slice(0, 4).toUpperCase()}`;

          if (storedPseudo !== nextPseudo) localStorage.setItem(PSEUDO_KEY, nextPseudo);

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
    setStudioNotice(null);
    setUrl(setPreviewUrlState, previewUrl, null);
    setUrl(setThumbnailPreviewUrlState, thumbnailPreviewUrl, null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [previewUrl, thumbnailPreviewUrl]);

  const ensureRoom = useCallback(async () => {
    if (!supabase) return null;
    const cleanCode = sanitizeRoomCode(roomCode) || DEFAULT_ROOM_CODE;
    localStorage.setItem(ROOM_CODE_KEY, cleanCode);
    setRoomCode(cleanCode);

    const { data, error } = await supabase.from("rooms").upsert({ code: cleanCode }, { onConflict: "code" }).select("id").single();
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
        const nominationsResult = await supabase
          .from("nominations")
          .select("id,room_id,category_id,category_ids,tiktoker_name,media_url,video_storage_path,thumbnail_url,thumbnail_storage_path,media_kind,comment,submitted_by,status,created_at,ratings(id,nomination_id,voter_id,rating_stars,rating_score,rating_points,rire_score,surprise_score,gene_score,fierte_score,interet_score,comment,created_at)")
          .eq("room_id", activeRoomId)
          .order("created_at", { ascending: false });

        let data = nominationsResult.data as Record<string, unknown>[] | null;
        let error = nominationsResult.error;

        if (error && /category_ids|rating_score|rating_points|rire_score|surprise_score|gene_score|fierte_score|interet_score/i.test(error.message)) {
          const legacy = await supabase
            .from("nominations")
            .select("id,room_id,category_id,tiktoker_name,media_url,video_storage_path,thumbnail_url,thumbnail_storage_path,media_kind,comment,submitted_by,status,created_at,ratings(id,nomination_id,voter_id,rating_stars,comment,created_at)")
            .eq("room_id", activeRoomId)
            .order("created_at", { ascending: false });
          data = legacy.data as Record<string, unknown>[] | null;
          error = legacy.error;
        }

        if (error) throw error;

        const rows = ((data ?? []) as Record<string, unknown>[]).map(parseNomination);
        setNominations(rows);
      } catch (err) {
        if (!silent) {
          const message = err instanceof Error ? err.message : "Le direct refuse de répondre.";
          showToast("error", message);
        }
      } finally {
        setSyncing(false);
      }
    },
    [roomId, showToast, supabase]
  );

  useEffect(() => {
    if (!participant || !supabase) return;
    let cancelled = false;

    void (async () => {
      try {
        const activeRoomId = await ensureRoom();
        if (!cancelled && activeRoomId) await fetchNominations(false, activeRoomId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Salon introuvable.";
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
      .on("postgres_changes", { event: "*", schema: "public", table: "nominations", filter: `room_id=eq.${roomId}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          const submittedBy = toText((payload.new as Record<string, unknown>).submitted_by);
          if (submittedBy !== participant.id) showToast("info", "Nouveau dossier à juger.");
        }
        void fetchNominations(true);
      })
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
    return nominations.filter((nomination) => nomination.status === "pending" && !nomination.ratings.some((rating) => rating.voter_id === participant.id));
  }, [nominations, participant]);

  const qualified = useMemo(() => nominations.filter((nomination) => nomination.status !== "pending"), [nominations]);
  const eliteDossiers = useMemo(() => qualified.filter((nomination) => averageImpact(nomination) >= 80), [qualified]);
  const feedItems = useMemo(() => {
    return nominations
      .filter((nomination) => {
        if (directFilter === "mine") return Boolean(participant && nomination.submitted_by === participant.id);
        if (directFilter === "all") return true;
        if (directFilter === "pending") return nomination.status === "pending";
        if (directFilter === "qualified") return nomination.status !== "pending";
        if (directFilter === "elite") return nomination.status !== "pending" && averageImpact(nomination) >= 80;
        return true;
      })
      .slice(0, 30);
  }, [directFilter, nominations, participant]);
  const directFilterCounts = useMemo<Record<DirectFilter, number>>(
    () => ({
      all: nominations.length,
      pending: nominations.filter((nomination) => nomination.status === "pending").length,
      qualified: qualified.length,
      elite: eliteDossiers.length,
      mine: participant ? nominations.filter((nomination) => nomination.submitted_by === participant.id).length : 0
    }),
    [eliteDossiers.length, nominations, participant, qualified.length]
  );
  const monthlyNominations = useMemo(() => nominations.filter((nomination) => isCurrentMonth(nomination.created_at)), [nominations]);
  const ultimateWinner = useMemo(() => buildScoreBoard(nominations)[0] ?? null, [nominations]);
  const paparazziOr = useMemo(() => bestSubmission(nominations), [nominations]);
  const nextPendingForMe = pendingForMe[0];
  const { palmaresRows, isLoading: isLoadingPalmares } = usePalmares(supabase, roomCode);
  const categoryRaces = useMemo(() => buildCategoryRaces(nominations), [nominations]);

  const editingNomination = useMemo(() => nominations.find((nomination) => nomination.id === editingNominationId) ?? null, [nominations, editingNominationId]);
  const isEditingStudio = Boolean(editingNomination);
  const cleanTiktokerName = sanitizeTiktokerName(tiktokerName);
  const cleanCategoryIds = useMemo(() => normalizeCategoryIds(selectedCategoryIds, catId), [catId, selectedCategoryIds]);
  const uploadReady = isEditingStudio
    ? comment.trim().length >= 3 && cleanTiktokerName.length >= 2 && cleanCategoryIds.length > 0
    : Boolean(preparedFile && thumbnailFile && comment.trim().length >= 3 && cleanTiktokerName.length >= 2 && cleanCategoryIds.length > 0 && !isPreparingMedia);
  const ownsNomination = useCallback((nomination: Nomination) => Boolean(participant && nomination.submitted_by === participant.id), [participant]);

  const patchRatingLocally = useCallback((nominationId: string, rating: Rating) => {
    setNominations((current) =>
      current.map((nomination) => {
        if (nomination.id !== nominationId) return nomination;
        const nextRatings = [...nomination.ratings.filter((item) => item.voter_id !== rating.voter_id), rating].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return { ...nomination, ratings: nextRatings, status: statusFromRatings(nextRatings) };
      })
    );
  }, []);

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
        reaction_comment: safeReview
      };

      const rpcResult = await supabase.rpc("submit_nomination_vote", rpcPayload);
      if (!rpcResult.error) return true;

      const legacyResult = await supabase.rpc("submit_nomination_vote", {
        target_nomination_id: nomination.id,
        voter_id: participant.id,
        stars: Math.max(0, Math.round(averageScore)),
        reaction_comment: safeReview
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
          comment: safeReview
        },
        { onConflict: "nomination_id,voter_id" }
      );

      return !upsertResult.error;
    },
    [participant, supabase]
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
        const nomination = nominations.find((item) => item.id === payload.nominationId);
        if (!nomination) continue;

        try {
          const ok = await submitRatingSafely(nomination, cloneScores(payload.scores), payload.comment);
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
  }, [fetchNominations, nominations, participant, submitRatingSafely, supabase]);

  const revealContainer = reduceMotion
    ? {}
    : {
        initial: "hidden",
        animate: "show",
        variants: {
          hidden: {},
          show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } }
        }
      };

  const revealItem = reduceMotion
    ? {}
    : {
        variants: {
          hidden: { opacity: 0, y: 18, rotate: -1.5 },
          show: { opacity: 1, y: 0, rotate: 0, transition: { type: "spring", stiffness: 210, damping: 23 } }
        }
      };

  const pageTransition = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 } };

  const handleSectionDrag = useCallback(
    (info: PanInfo) => {
      if (Math.abs(info.offset.x) < 90) return;
      const currentIndex = TAB_ORDER.indexOf(tab);
      const nextIndex = info.offset.x < 0 ? currentIndex + 1 : currentIndex - 1;
      const nextTab = TAB_ORDER[nextIndex];
      if (nextTab) switchTab(nextTab);
    },
    [switchTab, tab]
  );

  const resetStudioDraft = useCallback(() => {
    setStudioNotice(null);
    clearPreparedMedia();
    setTiktokerName("");
    setComment("");
    setInitialScores(cloneScores(DEFAULT_DIMENSION_SCORES));
    setSelectedCategoryIds([CATEGORIES[0].id]);
    setCatId(CATEGORIES[0].id);
  }, [clearPreparedMedia]);

  const toggleCategory = useCallback(
    (categoryId: string) => {
      haptic(HAPTICS.option);
      setSelectedCategoryIds((current) => {
        const exists = current.includes(categoryId);
        const next = exists ? current.filter((id) => id !== categoryId) : [...current, categoryId];
        const safeNext = next.length > 0 ? next : [categoryId];
        setCatId(primaryCategoryId(safeNext));
        return safeNext;
      });
    },
    []
  );

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
      setStudioNotice("MODE MODIF : auteur seulement.");
      switchTab("studio");
    },
    [clearPreparedMedia, ownsNomination, showToast, switchTab]
  );

  const cancelEditNomination = useCallback(() => {
    haptic(HAPTICS.tap);
    setEditingNominationId(null);
    setStudioNotice(null);
    resetStudioDraft();
  }, [resetStudioDraft]);

  const prepareMedia = async (nextFile: File | null) => {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("video/") && !nextFile.type.startsWith("image/")) {
      showToast("error", "Choisis une vidéo, une photo ou une capture.");
      return;
    }

    setIsPreparingMedia(true);
    setMediaProgress(0);
    setStudioNotice(null);
    clearPreparedMedia();

    try {
      if (nextFile.type.startsWith("image/")) {
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
      setStudioNotice(null);
      const message = err instanceof Error ? err.message : "Média impossible à préparer.";
      showToast("error", message);
    } finally {
      setIsPreparingMedia(false);
    }
  };

  const saveEditedNomination = async () => {
    if (!participant || !supabase || !editingNomination || !ownsNomination(editingNomination) || mutationBusyId) return;

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
        next_category_ids: cleanCategoryIds
      });

      if (error && /function .*update_own_nomination|Could not find/i.test(error.message)) {
        const legacy = await supabase.rpc("update_own_nomination", {
          target_nomination_id: editingNomination.id,
          editor_id: participant.id,
          next_comment: cleanedComment,
          next_category_id: primaryCategoryId(cleanCategoryIds),
          next_tiktoker_name: cleanTiktokerName
        });
        error = legacy.error;
      }

      if (error) throw error;

      showToast("success", "Dossier modifié.");
      setEditingNominationId(null);
      setStudioNotice(null);
      resetStudioDraft();
      switchTab("direct");
      await channelRef.current?.send({ type: "broadcast", event: "nomination", payload: { id: editingNomination.id } });
      void fetchNominations(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Modification impossible.";
      showToast("error", message);
    } finally {
      setMutationBusyId(null);
    }
  };

  const removeNomination = async (nomination: Nomination) => {
    if (!participant || !supabase || !ownsNomination(nomination) || mutationBusyId) return;
    const confirmed = window.confirm("Retirer ce dossier du club ?");
    if (!confirmed) return;

    haptic(HAPTICS.remove);
    setMutationBusyId(nomination.id);

    try {
      const { error } = await supabase.rpc("delete_own_nomination", {
        target_nomination_id: nomination.id,
        editor_id: participant.id
      });

      if (error) throw error;

      if (editingNominationId === nomination.id) {
        setEditingNominationId(null);
        resetStudioDraft();
      }

      showToast("info", "Dossier retiré.");
      await channelRef.current?.send({ type: "broadcast", event: "nomination", payload: { id: nomination.id } });
      void fetchNominations(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Retrait impossible.";
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
    if (!preparedFile || !thumbnailFile || !mediaKind || cleanedComment.length < 3 || cleanTiktokerName.length < 2) {
      showToast("error", "Ajoute le TikToker, le média et le contexte.");
      return;
    }

    haptic(HAPTICS.media);
    setUploadLoading(true);
    setMediaProgress(0.15);
    setStudioNotice(null);

    try {
      const activeRoomId = roomId ?? (await ensureRoom());
      if (!activeRoomId) throw new Error("Salon introuvable.");

      const thumbnailUpload = await uploadMediaFile(supabase, thumbnailFile, "miniatures");
      setMediaProgress(mediaKind === "video" ? 0.45 : 0.82);

      const mediaUpload = mediaKind === "video" ? await uploadMediaFile(supabase, preparedFile, "videos") : thumbnailUpload;
      setMediaProgress(0.82);

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
        submitted_by: participant.id,
        status: "pending"
      };

      let { data: insertedNomination, error: insertError } = await supabase
        .from("nominations")
        .insert(nominationInsert)
        .select("id")
        .single();

      if (insertError && /category_ids/i.test(insertError.message)) {
        const legacyInsert: Partial<typeof nominationInsert> = { ...nominationInsert };
        delete legacyInsert.category_ids;
        const legacy = await supabase.from("nominations").insert(legacyInsert).select("id").single();
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
        ratings: []
      };
      const initialRatingSaved = await submitRatingSafely(initialNomination, initialScores, cleanedComment);

      if (!initialRatingSaved) {
        queuePendingRating({
          nominationId,
          voterId: participant.id,
          scores: initialScores,
          comment: cleanedComment,
          createdAt: new Date().toISOString()
        });
      }

      setMediaProgress(1);
      haptic(HAPTICS.success);
      setStudioNotice(null);
      showToast("success", "Dossier lancé dans le club.");
      resetStudioDraft();
      switchTab("direct");
      await channelRef.current?.send({ type: "broadcast", event: "nomination", payload: { id: nominationId } });
      void fetchNominations(true, activeRoomId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec de l'envoi.";
      setStudioNotice(null);
      showToast("error", isStorageUnavailableMessage(message) ? STORAGE_UNAVAILABLE_NOTICE : message);
    } finally {
      setStudioNotice(null);
      setUploadLoading(false);
      setMediaProgress(0);
    }
  };

  const applyRating = async (id: string) => {
    if (!participant || !supabase || voteBusyId) return;

    const nomination = nominations.find((item) => item.id === id);
    if (!nomination) return;

    const cleanedReview = (reviewDraftById[id] ?? "").trim();
    const draftScores = cloneScores(scoreDraftById[id] ?? DEFAULT_DIMENSION_SCORES);
    const impactPoints = scoreTotal(draftScores, nomination.category_ids);
    const localRating = makeRatingFromDraft(id, participant.id, draftScores, cleanedReview, nomination.category_ids);

    haptic(impactPoints >= 80 ? HAPTICS.success : HAPTICS.option);
    setVoteBusyId(id);
    setShakeId(id);
    window.setTimeout(() => setShakeId(null), 520);
    patchRatingLocally(id, localRating);

    try {
      const remoteSaved = await submitRatingSafely(nomination, draftScores, cleanedReview);
      if (!remoteSaved) {
        queuePendingRating({
          nominationId: id,
          voterId: participant.id,
          scores: draftScores,
          comment: cleanedReview,
          createdAt: localRating.created_at
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
      showToast("success", remoteSaved ? `Note enregistrée · ${impactPoints}/100.` : `Note gardée · ${impactPoints}/100.`);
      if (remoteSaved) {
        await channelRef.current?.send({ type: "broadcast", event: "rating", payload: { id } });
        void fetchNominations(true);
      }
    } catch {
      queuePendingRating({
        nominationId: id,
        voterId: participant.id,
        scores: draftScores,
        comment: cleanedReview,
        createdAt: localRating.created_at
      });
      voteBurst(impactPoints);
      showToast("success", `Note gardée · ${impactPoints}/100.`);
    } finally {
      setVoteBusyId(null);
    }
  };

  if (bootingSession) {
    return (
      <div className="tabloid-app flex items-center justify-center">
        <PaperBackdrop />
        <BrutalCard tone="yellow" className="flex h-20 w-20 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-black" />
        </BrutalCard>
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="tabloid-app flex items-center justify-center">
        <PaperBackdrop />
        <BrutalCard tone="yellow" className="p-5 text-center">
          {bootError ? (
            <>
              <p className="mb-2 text-xl font-black uppercase leading-none text-red-600">Erreur Fatale</p>
              <p className="font-mono text-sm">{bootError}</p>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-black" />
              <p className="text-xl font-black uppercase leading-none">Chargement du jeu...</p>
            </>
          )}
        </BrutalCard>
      </div>
    );
  }

  return (
    <motion.div animate={globalShake ? { scale: [1, 0.99, 1], filter: ["brightness(1)", "brightness(1.05)", "brightness(1)"] } : { scale: 1 }} transition={{ duration: 0.15 }} className={`tabloid-app bg-[#050505] ${uploadLoading || mutationBusyId ? "pointer-events-none" : ""}`}>
      <PaperBackdrop />

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} className="absolute left-1/2 z-[100] w-[92%] max-w-sm -translate-x-1/2" style={{ top: "calc(env(safe-area-inset-top) + 10px)" }}>
            <div role="status" aria-live="polite" className={`flex items-center gap-2 rounded-[10px] border px-3 py-2 text-[11px] font-black uppercase tracking-[0.04em] shadow-[0_14px_36px_rgba(0,0,0,0.45)] backdrop-blur-xl ${toast.tone === "success" ? "border-[#d4af37]/60 bg-[#d4af37]/20 text-[#f0d889]" : toast.tone === "error" ? "border-red-400/40 bg-red-950/80 text-red-100" : "border-white/10 bg-black/80 text-white"}`}>
              {toast.tone === "success" ? <Check className="h-4 w-4" /> : toast.tone === "error" ? <ShieldAlert className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              <span>{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 mx-auto w-full max-w-[30rem] shrink-0 overflow-hidden px-2">
        <div
          className="tabloid-scroll"
          style={{
            height: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 84px)",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch"
          }}
        >
        <header className="sticky top-0 z-30 mb-2 grid grid-cols-[auto_1fr_auto] gap-1.5 bg-[#050505]/85 py-1.5 backdrop-blur-xl">
          <motion.button
            whileTap={TAP_REBOUND}
            transition={TAP_TRANSITION}
            onClick={() => {
              haptic(HAPTICS.tap);
              setShowAccount(true);
            }}
            className="brutal-icon-button"
            aria-label="Mon compte"
          >
            <Key className="h-4 w-4" />
          </motion.button>
          <Ticker>
            CÉRÉMONIE LE 1ER DU MOIS / DANS {ceremonyCountdown.days}J {ceremonyCountdown.hours}H {ceremonyCountdown.mins}M / TOURNOI DU MOIS / {monthlyNominations.length} DOSSIERS EN JEU / 
          </Ticker>
          <motion.button
            whileTap={TAP_REBOUND}
            transition={TAP_TRANSITION}
            onClick={() => {
              haptic(HAPTICS.tap);
              void fetchNominations();
            }}
            disabled={syncing || !supabase}
            className="brutal-icon-button disabled:opacity-50"
            aria-label="Rafraîchir le direct"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          </motion.button>
        </header>
          <CeremonyBulletin
            pendingCount={pendingForMe.length}
            nextPending={nextPendingForMe}
            leader={ultimateWinner}
            bestDossier={paparazziOr}
            onOpenVote={() => switchTab("vote")}
            onOpenStudio={() => switchTab("studio")}
            onOpenPalmares={() => switchTab("palmares")}
          />

          <AnimatePresence mode="wait">
          {tab === "direct" && (
            <motion.section key="direct" {...pageTransition} {...revealContainer} drag={reduceMotion ? false : "x"} dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => handleSectionDrag(info)} transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }} className="space-y-1.5">
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
                <SectionTitle>{DIRECT_TITLE}</SectionTitle>
                {feedItems.length === 0 ? (
                  <BrutalCard className="p-3 text-center">
                    <Camera className="mx-auto mb-2 h-8 w-8" />
                    <p className="text-xl font-black uppercase leading-none">Aucun rec.</p>
                  </BrutalCard>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {feedItems.map((nomination, index) => (
                      <NominationTile key={nomination.id} nomination={nomination} index={index} owned={ownsNomination(nomination)} onEdit={() => startEditNomination(nomination)} onRemove={() => void removeNomination(nomination)} busy={mutationBusyId === nomination.id} />
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.section>
          )}

          {tab === "vote" && (
            <motion.section key="vote" {...pageTransition} drag={reduceMotion ? false : "x"} dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => handleSectionDrag(info)} transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }} className="space-y-1.5">
              <SectionTitle tone="yellow">{VOTE_TITLE}</SectionTitle>
              {pendingForMe.length === 0 ? (
                <BrutalCard tone="yellow" className="p-3 text-center">
                  <Check className="mx-auto mb-2 h-8 w-8" />
                  <p className="text-2xl font-black uppercase leading-none">File vide.</p>
                </BrutalCard>
              ) : (
                pendingForMe.map((nomination) => {
                  const category = getCategoryMeta(nomination.category_id);
                  const Icon = category.icon;
                  const draftScores = cloneScores(scoreDraftById[nomination.id] ?? DEFAULT_DIMENSION_SCORES);

                  return (
                    <motion.article key={nomination.id} animate={shakeId === nomination.id ? { x: [0, -8, 8, -5, 5, 0], scale: [1, 0.99, 1.01, 1] } : { x: 0, scale: 1 }} transition={{ duration: 0.42 }} className="brutal-card overflow-hidden">
                      <div className="relative border-b border-[#d4af37]/20 bg-black">
                        <MediaFrame nomination={nomination} height="aspect-[9/16] max-h-[52svh]" />
                        <Sticker tone="yellow" className="absolute left-2 top-2 -rotate-2">
                          À voter
                        </Sticker>
                        <OwnershipBadge owned={ownsNomination(nomination)} className="absolute right-2 top-2 rotate-2" />
                        <div className="absolute bottom-2 left-2 right-2 rounded-[10px] border border-[#d4af37]/35 bg-black/75 p-2 backdrop-blur-md">
                          <p className="flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#d4af37]">
                            <Icon className="h-3 w-3" /> {category.label}
                          </p>
                          <p className="tabloid-headline text-[clamp(1.22rem,6.2vw,2rem)] leading-[0.84] text-white">{nomination.tiktoker_name}</p>
                        </div>
                      </div>
                      <div className="space-y-1.5 p-2">
                        <p className="rounded-[10px] border border-white/10 bg-white/[0.04] p-2 text-xs font-medium leading-tight text-zinc-200">&quot;{nomination.comment}&quot;</p>
                        <ScorePresetRail value={draftScores} compact onSelect={(value) => setScoreDraftById((prev) => ({ ...prev, [nomination.id]: value }))} label="Profils rapides pour ce vote" />
                        <DimensionScoreGrid value={draftScores} onChange={(value) => setScoreDraftById((prev) => ({ ...prev, [nomination.id]: value }))} compact />
                        <textarea aria-label="Ta réaction sur ce dossier" value={reviewDraftById[nomination.id] ?? ""} onFocus={() => haptic(HAPTICS.tap)} onChange={(event) => setReviewDraftById((prev) => ({ ...prev, [nomination.id]: event.target.value }))} placeholder="Ta réaction sur ce dossier ?" rows={2} maxLength={180} className="brutal-input w-full resize-none p-2 text-xs font-black uppercase" />
                        <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={() => void applyRating(nomination.id)} disabled={voteBusyId === nomination.id} className="brutal-action w-full bg-[#d4af37] text-black disabled:opacity-50">
                          Enregistrer la note · {scoreTotal(draftScores, nomination.category_ids)}/100
                        </motion.button>
                      </div>
                    </motion.article>
                  );
                })
              )}
            </motion.section>
          )}

          {tab === "studio" && (
            <motion.section key="studio" {...pageTransition} drag={reduceMotion ? false : "x"} dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => handleSectionDrag(info)} transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }} className="space-y-1.5">
              <BrutalCard tone="black" className="p-2">
                <h2 className="tabloid-headline text-[clamp(1.28rem,6.8vw,2.2rem)] leading-[0.82] text-white">{isEditingStudio ? "MODIFIER LE DOSSIER" : STUDIO_TITLE}</h2>
              </BrutalCard>

              <BrutalCard className="p-1.5">
                {editingNomination ? (
                  <div className="relative overflow-hidden rounded-[10px] border border-[#d4af37]/25 bg-black">
                    <MediaFrame nomination={editingNomination} height="aspect-[9/16] max-h-[52svh]" />
                    <OwnershipBadge owned className="absolute left-2 top-2 -rotate-2" />
                  </div>
                ) : (
                  <motion.button
                    whileTap={TAP_REBOUND}
                    transition={TAP_TRANSITION}
                    onClick={() => {
                      haptic(HAPTICS.media);
                      fileInputRef.current?.click();
                    }}
                    disabled={isPreparingMedia || uploadLoading}
                    className="relative flex aspect-[9/16] max-h-[52svh] w-full items-center justify-center overflow-hidden rounded-[10px] border border-[#d4af37]/25 bg-black text-left transition disabled:opacity-70"
                    aria-label="Choisir une vidéo ou une capture"
                  >
                    {previewUrl ? (
                      mediaKind === "video" ? (
                        <video src={previewUrl} poster={thumbnailPreviewUrl ?? undefined} className="absolute inset-0 h-full w-full object-cover" controls loop playsInline muted preload="metadata" {...({ "webkit-playsinline": "true" } as Record<string, string>)} />
                      ) : (
                        <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      )
                    ) : (
                      <span className="flex flex-col items-center px-6 text-center text-white">
                        {isPreparingMedia ? <Loader2 className="mb-3 h-9 w-9 animate-spin text-[#d4af37]" /> : <UploadCloud className="mb-3 h-9 w-9 text-[#d4af37]" />}
                        <span className="tabloid-headline text-xl leading-none">{isPreparingMedia ? "Chargement du studio..." : "Déposer le rec"}</span>
                        <span className="mt-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#d4af37]">Vidéo ou capture libre</span>
                      </span>
                    )}
                    <input ref={fileInputRef} type="file" accept="video/*,image/*" onChange={(event) => void prepareMedia(event.target.files?.[0] ?? null)} className="hidden" aria-label="Fichier média du dossier" />
                  </motion.button>
                )}
              </BrutalCard>

              {studioNotice && (
                <BrutalCard tone="yellow" className="p-2">
                  <p className="tabloid-headline text-[clamp(0.95rem,5vw,1.4rem)] leading-[0.82]">{studioNotice}</p>
                </BrutalCard>
              )}

              {(isPreparingMedia || uploadLoading) && (
                <BrutalCard tone="yellow" className="p-2">
                  <p className="tabloid-headline text-[clamp(1.05rem,5.6vw,1.65rem)] leading-[0.82]">{uploadLoading ? "CHARGEMENT DU DOSSIER..." : "PRÉPARATION DU REC..."}</p>
                  <div className="stat-bar mt-2">
                    <motion.div className="stat-bar-fill" animate={{ width: `${Math.round(mediaProgress * 100)}%` }} />
                  </div>
                </BrutalCard>
              )}

              <label className="sr-only" htmlFor="tiktoker-name">
                TikToker visé
              </label>
              <input id="tiktoker-name" aria-label="TikToker visé" value={tiktokerName} onFocus={() => haptic(HAPTICS.tap)} onChange={(event) => setTiktokerName(event.target.value)} placeholder="TikToker visé" maxLength={48} className="brutal-input w-full px-2.5 py-2 text-xs font-black uppercase" />

              <div className="grid grid-cols-3 gap-1">
                {CATEGORIES.map((category) => {
                  const Icon = category.icon;
                  const active = cleanCategoryIds.includes(category.id);
                  return (
                    <motion.button
                      key={category.id}
                      type="button"
                      whileTap={TAP_REBOUND}
                      transition={TAP_TRANSITION}
                      onClick={() => toggleCategory(category.id)}
                      aria-pressed={active}
                      className={`min-h-10 rounded-[10px] border px-1.5 py-1 text-left ${active ? "border-[#d4af37]/75 bg-[#d4af37]/18 text-[#f0d889]" : "border-white/10 bg-white/[0.035] text-zinc-500"}`}
                    >
                      <Icon className="mb-1 h-3 w-3" />
                      <span className="line-clamp-2 text-[8px] font-black uppercase leading-none tracking-tighter">{category.label}</span>
                    </motion.button>
                  );
                })}
              </div>

              <label className="sr-only" htmlFor="dossier-comment">
                Contexte du dossier
              </label>
              <textarea id="dossier-comment" aria-label="Contexte du dossier" value={comment} onFocus={() => haptic(HAPTICS.tap)} onChange={(event) => setComment(event.target.value)} placeholder="Pourquoi ce dossier mérite le club ?" rows={3} maxLength={240} className="brutal-input w-full resize-none p-2.5 text-xs font-black uppercase" />

              {!isEditingStudio && (
                <BrutalCard tone="yellow" className="p-2">
                  <ScorePresetRail value={initialScores} onSelect={setInitialScores} label="Profils rapides du score initial" />
                  <DimensionScoreGrid value={initialScores} onChange={setInitialScores} />
                  <p className="mt-2 border-t border-[#d4af37]/20 pt-2 text-center text-[10px] font-black uppercase tracking-[0.12em] text-[#d4af37]">Indice initial : {scoreTotal(initialScores, cleanCategoryIds)} / 100</p>
                </BrutalCard>
              )}

              {isEditingStudio ? (
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={() => void saveEditedNomination()} disabled={mutationBusyId === editingNominationId || !uploadReady} className="brutal-submit flex w-full items-center justify-center gap-2 disabled:opacity-50">
                    {mutationBusyId === editingNominationId ? <Loader2 className="h-6 w-6 animate-spin" /> : "Sauvegarder"}
                  </motion.button>
                  <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={cancelEditNomination} className="rounded-[10px] border border-white/10 bg-white/[0.06] px-3 text-xs font-black uppercase tracking-[0.1em] text-white pointer-events-auto" type="button">
                    Annuler
                  </motion.button>
                </div>
              ) : (
                <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={() => void uploadNomination()} disabled={uploadLoading || !uploadReady} className="brutal-submit flex w-full items-center justify-center gap-2 disabled:opacity-50">
                  {uploadLoading ? <span className="flex items-center gap-2 animate-pulse"><Loader2 className="h-6 w-6 animate-spin" /> TRANSMISSION EN COURS...</span> : "Lancer le dossier"}
                </motion.button>
              )}
            </motion.section>
          )}

          {tab === "palmares" && (
            <motion.section key="palmares" {...pageTransition} drag={reduceMotion ? false : "x"} dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => handleSectionDrag(info)} transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }} className="space-y-2">
              <BrutalCard tone="black" className="p-3 text-white">
                <p className="mb-1 text-[8px] font-black uppercase tracking-[0.2em] text-[#d4af37]">Classement</p>
                <h2 className="tabloid-headline text-[clamp(1.55rem,7.8vw,2.7rem)] leading-[0.84]">{PALMARES_TITLE}</h2>
              </BrutalCard>
              <PalmaresList rows={palmaresRows} onOpenStudio={() => switchTab("studio")} />
            </motion.section>
          )}

          {tab === "winners" && (
            <motion.section key="winners" {...pageTransition} drag={reduceMotion ? false : "x"} dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => handleSectionDrag(info)} transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }} className="space-y-2">
              <BrutalCard tone="black" className="p-3 text-white">
                <p className="mb-1 text-[8px] font-black uppercase tracking-[0.2em] text-[#d4af37]">Cérémonie</p>
                <h2 className="tabloid-headline text-[clamp(1.55rem,7.8vw,2.7rem)] leading-[0.84]">{WINNERS_TITLE}</h2>
              </BrutalCard>

              {ultimateWinner && (
                <BrutalCard tone="yellow" className="p-3">
                  <Sticker tone="yellow">TikToker du mois</Sticker>
                  <p className="tabloid-headline mt-1.5 text-[clamp(1.35rem,6.8vw,2.25rem)] leading-[0.84] text-white">{ultimateWinner.tiktokerName}</p>
                  <span className="gold-pill mt-2">{ultimateWinner.points} points</span>
                </BrutalCard>
              )}

              {paparazziOr && (
                <BrutalCard className="p-3">
                  <Sticker tone="paper">Paparazzi d&apos;Or</Sticker>
                  <p className="tabloid-headline mt-1.5 text-[clamp(1.18rem,6.1vw,1.95rem)] leading-[0.84] text-white">{paparazziOr.tiktoker_name}</p>
                  <span className="gold-pill mt-2">{totalPoints(paparazziOr.ratings)} points sur un dossier</span>
                </BrutalCard>
              )}

              <BrutalCard tone="black" className="p-2.5">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#d4af37]">Course aux trophées</p>
                <h3 className="tabloid-headline mt-0.5 text-[clamp(1.16rem,6vw,1.95rem)] leading-[0.84] text-white">Toutes les catégories</h3>
              </BrutalCard>

              <CategoryRaceBoard races={categoryRaces} />
            </motion.section>
          )}

        </AnimatePresence>
        </div>
      </main>

      {tab !== "studio" && (
        <motion.button initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={() => switchTab("studio")} className="brutal-fab absolute right-5 z-40 flex h-12 w-12 items-center justify-center pointer-events-auto" style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }} aria-label="Lancer un dossier">
          <Plus className="h-6 w-6" />
        </motion.button>
      )}

      <nav aria-label="Navigation principale" className="bottom-tabloid px-2 pt-1.5 pointer-events-auto">
        <div className="mx-auto grid w-full max-w-[30rem] grid-cols-5 gap-1">
          {TAB_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            const badge = item.id === "vote" ? pendingForMe.length : 0;

            return (
              <motion.button key={item.id} type="button" whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={() => switchTab(item.id)} aria-current={active ? "page" : undefined} className={`relative flex flex-col items-center justify-center gap-0.5 rounded-[10px] border px-1 py-1.5 transition ${active ? "border-[#d4af37]/70 bg-[#d4af37]/18 text-[#f0d889]" : "border-white/10 bg-white/[0.045] text-zinc-400"}`}>
                <Icon className="relative z-10 h-4 w-4" strokeWidth={1.5} />
                <span className="relative z-10 text-[7.5px] font-black uppercase tracking-tighter">{item.label}</span>
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

      <AnimatePresence>
        {showAccount && (
          <>
            <motion.button
              type="button"
              key="account-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              aria-label="Fermer la sécurité du compte"
              className="absolute inset-0 z-[90] bg-black/60"
              onClick={() => {
                haptic(HAPTICS.tap);
                setShowAccount(false);
              }}
            />
            <motion.div
              key="account-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="account-security-title"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 z-[100] mx-auto w-full max-w-[30rem] px-2"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
            >
              <BrutalCard className="w-full space-y-4 rounded-b-none p-4">
                <div className="flex items-center justify-between">
                  <h3 id="account-security-title" className="tabloid-headline text-2xl text-white">
                    Sécurité du Compte
                  </h3>
                  <motion.button
                    whileTap={TAP_REBOUND}
                    transition={TAP_TRANSITION}
                    onClick={() => {
                      haptic(HAPTICS.tap);
                      setShowAccount(false);
                    }}
                    className="brutal-icon-button"
                    aria-label="Fermer"
                  >
                    <VolumeX className="h-4 w-4" />
                  </motion.button>
                </div>

                <div className="space-y-1.5 rounded-[10px] border border-[#d4af37]/30 bg-[#d4af37]/10 p-3">
                  <p className="text-[10px] font-black uppercase text-[#d4af37]">Ton Code de Récupération</p>
                  <p className="text-xs text-zinc-300">Si tu effaces l&apos;application, utilise ce code pour restaurer tes scores :</p>
                  <textarea
                    readOnly
                    value={recoveryCode}
                    rows={3}
                    className="brutal-input mt-1 w-full p-2 text-[10px] font-mono text-white opacity-80"
                    onClick={(e) => {
                      (e.target as HTMLTextAreaElement).select();
                      void navigator.clipboard.writeText(recoveryCode);
                      showToast("success", "Copié");
                    }}
                  />
                </div>

                <div className="space-y-1.5 border-t border-white/10 pt-4">
                  <p className="text-[10px] font-black uppercase text-white">Restaurer un compte</p>
                  <input
                    type="text"
                    placeholder="Coller le code ici..."
                    value={inputRecovery}
                    onChange={(e) => setInputRecovery(e.target.value)}
                    className="brutal-input w-full p-2 text-xs"
                  />
                  <motion.button
                    whileTap={TAP_REBOUND}
                    transition={TAP_TRANSITION}
                    disabled={!inputRecovery.trim() || uploadLoading}
                    onClick={applyRecoveryToken}
                    className="brutal-action mt-2 w-full bg-white text-black disabled:opacity-50"
                  >
                    Restaurer les données
                  </motion.button>
                </div>
              </BrutalCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
