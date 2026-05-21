"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import confetti from "canvas-confetti";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { AnimatePresence, motion, type PanInfo, useReducedMotion } from "framer-motion";
import {
  BadgeCheck,
  Camera,
  Check,
  Clock3,
  Crown,
  Flame,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Star,
  Trophy,
  UploadCloud,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

type Tab = "direct" | "vote" | "studio" | "palmares" | "winners";
type NominationStatus = "pending" | "accepted" | "rejected";
type VerdictChoice = "propel" | "ban";
type ToastTone = "success" | "error" | "info";
type CategoryMood = "positive" | "critical" | "fun" | "surprise";
type MediaKind = "video" | "image";

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
  comment: string;
  created_at: string;
};

type Nomination = {
  id: string;
  room_id: string;
  category_id: string;
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

type SpacesUploadResult = {
  key: string;
  publicUrl: string;
  uploadUrl: string;
};

type UploadReference = {
  key: string;
  publicUrl: string;
  provider: "spaces" | "supabase";
};

type ScoreBoard = {
  tiktokerName: string;
  category?: CategoryMeta;
  points: number;
  votes: number;
  average: number;
  nominations: number;
};

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
};

const LEGACY_SESSION_ID_KEY = "nod_session_id";
const USER_DEVICE_ID_KEY = "nod_user_device_id";
const PSEUDO_KEY = "nod_pseudo";
const ROOM_CODE_KEY = "nod_room_code";
const DEFAULT_ROOM_CODE = "NOD-CLUB";
const MIN_PUBLIC_RATINGS = 2;
const STAR_VALUES = [1, 2, 3, 4, 5] as const;
const DIRECT_TITLE = "DIRECT";
const VOTE_TITLE = "VOTING";
const STUDIO_TITLE = "STUDIO";
const PALMARES_TITLE = "PALMARÈS";
const WINNERS_TITLE = "WINNERS";
const SUPABASE_STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "nod-media";
const SUPABASE_STORAGE_NOTICE = "Stockage de secours Supabase activé.";
const STORAGE_UNAVAILABLE_NOTICE = "Stockage indisponible : vérifie Supabase Storage ou Spaces.";
const LEGACY_FLOWER_VIDEO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const FALLBACK_IMAGE_URL =
  "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1080'%20height='1440'%20viewBox='0%200%201080%201440'%3E%3Crect%20width='1080'%20height='1440'%20fill='%23000000'/%3E%3Crect%20x='64'%20y='64'%20width='952'%20height='1312'%20fill='%23f2efe3'%20stroke='%23000000'%20stroke-width='24'/%3E%3Crect%20x='112'%20y='112'%20width='856'%20height='240'%20fill='%23e11d48'/%3E%3Ctext%20x='540'%20y='248'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='118'%20fill='%23ffffff'%3ENOD%3C/text%3E%3Ctext%20x='540'%20y='690'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='104'%20fill='%23000000'%3EDOSSIER%3C/text%3E%3Ctext%20x='540'%20y='810'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='104'%20fill='%23000000'%3EEN%20DIRECT%3C/text%3E%3Crect%20x='248'%20y='936'%20width='584'%20height='132'%20fill='%23b5f42b'%20stroke='%23000000'%20stroke-width='18'/%3E%3Ctext%20x='540'%20y='1028'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='64'%20fill='%23000000'%3EA%20VOTER%3C/text%3E%3C/svg%3E";
const TAP_REBOUND = { scale: 0.94, rotate: -0.7 };
const TAP_TRANSITION = { type: "spring", stiffness: 760, damping: 20, mass: 0.6 } as const;

const CATEGORIES: CategoryMeta[] = [
  { id: "le_zin_du_mois", label: "Le Zin du mois", mood: "positive", icon: Crown },
  { id: "fierte_des_notres", label: "La Fierté des Nôtres", mood: "positive", icon: BadgeCheck },
  { id: "xptdr", label: "Xptdr", mood: "fun", icon: Sparkles },
  { id: "honte_absolue", label: "Honte Absolue", mood: "critical", icon: ShieldAlert }
];

const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((category) => [category.id, category])) as Record<string, CategoryMeta>;
const FEATURED_CATEGORY_IDS = ["le_zin_du_mois", "fierte_des_notres", "xptdr", "honte_absolue"] as const;

const TAB_ITEMS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "direct", label: "Direct", icon: Sparkles },
  { id: "vote", label: "Voting", icon: Zap },
  { id: "studio", label: "Studio", icon: Plus },
  { id: "palmares", label: "Palmarès", icon: Trophy },
  { id: "winners", label: "Winners", icon: Crown }
];

const TAB_ORDER: Tab[] = TAB_ITEMS.map((item) => item.id);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeStatus(value: unknown): NominationStatus {
  if (value === "accepted" || value === "rejected" || value === "pending") return value;
  return "pending";
}

function clampRating(value: number) {
  return Math.min(5, Math.max(1, Math.round(value)));
}

function haptic(pattern: number | number[]) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // iOS Safari ignore souvent cette API; les ressorts visuels gardent le retour tactile.
  }
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
  return CATEGORY_BY_ID[value] ?? { id: "custom", label: value || "Sans catégorie", mood: "fun", icon: Camera };
}

function statusFromRatings(ratings: Rating[]) {
  if (ratings.length < MIN_PUBLIC_RATINGS) return "pending" as const;
  return averageRating(ratings) >= 3 ? ("accepted" as const) : ("rejected" as const);
}

function statusLabel(status: NominationStatus) {
  if (status === "accepted") return "PROPULSÉ";
  if (status === "rejected") return "BANNI";
  return "À VOTER";
}

function statusClass(status: NominationStatus) {
  if (status === "accepted") return "border-[#d4af37]/60 bg-[#d4af37]/15 text-[#f0d889]";
  if (status === "rejected") return "border-red-400/30 bg-red-950/40 text-red-100";
  return "border-[#d4af37]/50 bg-white/5 text-[#f0d889]";
}

function averageRating(ratings: Rating[]) {
  if (ratings.length === 0) return 0;
  return ratings.reduce((sum, rating) => sum + rating.rating_stars, 0) / ratings.length;
}

function totalPoints(ratings: Rating[]) {
  return ratings.reduce((sum, rating) => sum + rating.rating_stars, 0);
}

function countdownToNextCeremony() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const diffMs = Math.max(0, next.getTime() - now.getTime());
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
  return {
    id: toText(row.id, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    nomination_id: toText(row.nomination_id),
    voter_id: toText(row.voter_id),
    rating_stars: clampRating(toNumber(row.rating_stars, 1)),
    comment: toText(row.comment),
    created_at: toText(row.created_at, new Date().toISOString())
  };
}

function parseNomination(row: Record<string, unknown>): Nomination {
  const ratings = Array.isArray(row.ratings) ? row.ratings.filter(isRecord).map(parseRating) : [];
  const rawMediaKind = toText(row.media_kind, "image");
  const computedStatus = statusFromRatings(ratings);

  return {
    id: toText(row.id, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    room_id: toText(row.room_id),
    category_id: toText(row.category_id, CATEGORIES[0].id),
    tiktoker_name: sanitizeTiktokerName(toText(row.tiktoker_name, "TikToker mystère")) || "TikToker mystère",
    media_url: toText(row.media_url, FALLBACK_IMAGE_URL),
    video_storage_path: toText(row.video_storage_path) || null,
    thumbnail_url: toText(row.thumbnail_url) || null,
    thumbnail_storage_path: toText(row.thumbnail_storage_path) || null,
    media_kind: rawMediaKind === "video" ? "video" : "image",
    comment: toText(row.comment),
    submitted_by: toText(row.submitted_by, "session-inconnue"),
    status: normalizeStatus(row.status) === computedStatus ? computedStatus : normalizeStatus(row.status),
    created_at: toText(row.created_at, new Date().toISOString()),
    ratings
  };
}

function waitForMediaEvent(target: HTMLMediaElement, eventName: string, timeoutMs = 15000) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Lecture média impossible."));
    }, timeoutMs);

    const onEvent = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("Fichier média illisible."));
    };

    const cleanup = () => {
      window.clearTimeout(timer);
      target.removeEventListener(eventName, onEvent);
      target.removeEventListener("error", onError);
    };

    target.addEventListener(eventName, onEvent, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Aperçu impossible."));
      },
      mimeType,
      quality
    );
  });
}

function scaledSize(width: number, height: number, maxLongEdge: number, maxShortEdge: number) {
  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);
  const scale = Math.min(1, maxLongEdge / longEdge, maxShortEdge / shortEdge);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

async function compressImageToWebp(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const size = scaledSize(bitmap.width, bitmap.height, 1440, 1080);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Aperçu impossible sur ce téléphone.");

    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await canvasToBlob(canvas, "image/webp", 0.84);
    const name = `${file.name.replace(/\.[^.]+$/, "") || "capture"}.webp`;
    return new File([blob], name, { type: "image/webp" });
  } finally {
    bitmap.close();
  }
}

async function extractVideoThumbnail(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");

  try {
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;
    video.load();

    await waitForMediaEvent(video, "loadedmetadata");

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const seekTo = duration > 0.2 ? 0.1 : 0;
    if (seekTo > 0) {
      video.currentTime = seekTo;
      await waitForMediaEvent(video, "seeked");
    } else if (!video.videoWidth) {
      await waitForMediaEvent(video, "loadeddata");
    }

    const size = scaledSize(video.videoWidth || 720, video.videoHeight || 1280, 1440, 1080);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Aperçu impossible sur ce téléphone.");

    context.drawImage(video, 0, 0, size.width, size.height);
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.86);
    const name = `${file.name.replace(/\.[^.]+$/, "") || "miniature"}.jpg`;
    return new File([blob], name, { type: "image/jpeg" });
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

function sanitizeStorageFileName(value: string) {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 90);

  return cleaned || "media";
}

function mediaMonthKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function storageKey(file: File, folder: "videos" | "miniatures") {
  return `${folder}/${mediaMonthKey()}/${crypto.randomUUID()}-${sanitizeStorageFileName(file.name)}`;
}

function isLegacyDemoMedia(url: string) {
  return url.includes(LEGACY_FLOWER_VIDEO_URL);
}

async function uploadFileToSpaces(file: File, folder: "videos" | "miniatures") {
  try {
    const signResponse = await fetch("/api/spaces/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        folder
      })
    });

    const payload = (await signResponse.json()) as Partial<SpacesUploadResult> & { error?: string };
    if (!signResponse.ok || !payload.uploadUrl || !payload.publicUrl || !payload.key) {
      throw new Error(STORAGE_UNAVAILABLE_NOTICE);
    }

    const uploadResponse = await fetch(payload.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file
    });

    if (!uploadResponse.ok) throw new Error(STORAGE_UNAVAILABLE_NOTICE);

    return {
      key: payload.key,
      publicUrl: payload.publicUrl
    };
  } catch {
    throw new Error(STORAGE_UNAVAILABLE_NOTICE);
  }
}

async function uploadFileToSupabaseStorage(supabase: SupabaseClient, file: File, folder: "videos" | "miniatures") {
  const key = storageKey(file, folder);
  const { error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(key, file, {
    cacheControl: "31536000",
    contentType: file.type || "application/octet-stream",
    upsert: false
  });

  if (error) throw error;

  const {
    data: { publicUrl }
  } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(key);

  if (!publicUrl) throw new Error(STORAGE_UNAVAILABLE_NOTICE);

  return {
    key,
    publicUrl
  };
}

async function uploadFileOrFallback(supabase: SupabaseClient, file: File, folder: "videos" | "miniatures"): Promise<UploadReference> {
  try {
    const uploaded = await uploadFileToSpaces(file, folder);
    return { ...uploaded, provider: "spaces" };
  } catch {
    try {
      const uploaded = await uploadFileToSupabaseStorage(supabase, file, folder);
      return { ...uploaded, provider: "supabase" };
    } catch {
      throw new Error(STORAGE_UNAVAILABLE_NOTICE);
    }
  }
}

function verdictLabel(choice: VerdictChoice) {
  return choice === "propel" ? "PROPULSER" : "BANNIR";
}

function voteBurst(choice: VerdictChoice) {
  const colors = choice === "propel" ? ["#b5f42b", "#e11d48", "#000000", "#f2efe3"] : ["#e11d48", "#000000", "#b5f42b"];

  void confetti({
    particleCount: choice === "propel" ? 120 : 72,
    spread: choice === "propel" ? 92 : 58,
    startVelocity: choice === "propel" ? 48 : 34,
    scalar: choice === "propel" ? 1.05 : 0.9,
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
  const monthlyAccepted = nominations.filter((nomination) => nomination.status === "accepted" && isCurrentMonth(nomination.created_at) && (!categoryId || nomination.category_id === categoryId));
  const byTarget = new Map<string, ScoreBoard>();

  for (const nomination of monthlyAccepted) {
    const category = getCategoryMeta(nomination.category_id);
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
      existing.points += rating.rating_stars;
      existing.votes += 1;
    }
    existing.average = existing.votes > 0 ? existing.points / existing.votes : 0;
    byTarget.set(nomination.tiktoker_name, existing);
  }

  return Array.from(byTarget.values()).sort((a, b) => b.points - a.points || b.average - a.average || a.tiktokerName.localeCompare(b.tiktokerName));
}

function bestSubmission(nominations: Nomination[]) {
  return nominations
    .filter((nomination) => nomination.status === "accepted" && isCurrentMonth(nomination.created_at))
    .sort((a, b) => totalPoints(b.ratings) - totalPoints(a.ratings) || averageRating(b.ratings) - averageRating(a.ratings))[0];
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
      categoryCounts: Object.fromEntries(FEATURED_CATEGORY_IDS.map((id) => [id, 0])) as Record<string, number>
    };

    current.totalDossiers += 1;
    if (nomination.status === "accepted") current.acceptedDossiers += 1;
    if (FEATURED_CATEGORY_IDS.includes(nomination.category_id as (typeof FEATURED_CATEGORY_IDS)[number])) {
      current.categoryCounts[nomination.category_id] = (current.categoryCounts[nomination.category_id] ?? 0) + 1;
    }

    for (const rating of nomination.ratings) {
      current.points += rating.rating_stars;
      current.votes += 1;
    }

    current.average = current.votes > 0 ? current.points / current.votes : 0;
    current.successRate = current.totalDossiers > 0 ? Math.round((current.acceptedDossiers / current.totalDossiers) * 100) : 0;
    rows.set(nomination.tiktoker_name, current);
  }

  return Array.from(rows.values()).sort((a, b) => b.points - a.points || b.successRate - a.successRate || b.average - a.average || a.tiktokerName.localeCompare(b.tiktokerName));
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

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] leading-none ${toneClass} ${className}`}>{children}</span>;
}

function SectionTitle({ children, tone = "black" }: { children: ReactNode; tone?: "black" | "red" | "yellow" }) {
  const toneClass = tone === "red" ? "border-red-400/30 text-red-100" : tone === "yellow" ? "border-[#d4af37]/60 text-[#f0d889]" : "border-white/10 text-white";
  return (
    <div className={`rounded-2xl border bg-white/[0.035] px-3 py-2 ${toneClass}`}>
      <h2 className="tabloid-headline text-[clamp(1.55rem,8.4vw,2.9rem)] leading-[0.92]">{children}</h2>
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

function StarInput({
  value,
  onChange,
  readonly = false,
  size = "md"
}: {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const [hover, setHover] = useState(0);
  const iconSizeClass = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-5 w-5";

  return (
    <div className="grid grid-cols-5 gap-2">
      {STAR_VALUES.map((star) => {
        const active = star <= (hover || value);
        return (
          <motion.button
            key={star}
            type="button"
            disabled={readonly}
            whileTap={TAP_REBOUND}
            transition={TAP_TRANSITION}
            onMouseEnter={() => !readonly && setHover(star)}
            onMouseLeave={() => !readonly && setHover(0)}
            onClick={() => {
              haptic(10);
              onChange?.(star);
            }}
            className={`flex aspect-square items-center justify-center rounded-2xl border transition disabled:cursor-default ${
              active ? "border-[#d4af37]/80 bg-[#d4af37]/20 text-[#f0d889]" : "border-white/10 bg-white/[0.04] text-zinc-600"
            }`}
            aria-label={`${star} étoiles`}
          >
            <Star className={`${iconSizeClass} ${active ? "fill-black" : ""}`} strokeWidth={2} />
          </motion.button>
        );
      })}
    </div>
  );
}

function MediaFrame({
  nomination,
  height = "h-72",
  controls = true
}: {
  nomination: Nomination;
  height?: string;
  controls?: boolean;
}) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const [engaged, setEngaged] = useState(false);

  useEffect(() => {
    setMediaFailed(false);
    setEngaged(false);
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
      <video
        src={nomination.media_url}
        poster={nomination.thumbnail_url ?? undefined}
        controls={controls || engaged}
        loop
        muted
        playsInline
        preload="metadata"
        {...({ "webkit-playsinline": "true" } as Record<string, string>)}
        onClick={() => {
          haptic(15);
          setEngaged(true);
        }}
        onTouchStart={() => setEngaged(true)}
        onError={() => setMediaFailed(true)}
        className={`${height} prestige-media block w-full bg-black object-cover`}
      />
    );
  }

  return <img src={nomination.media_url || nomination.thumbnail_url || FALLBACK_IMAGE_URL} alt="" onError={() => setMediaFailed(true)} className={`${height} prestige-media block w-full bg-black object-cover`} />;
}

function OwnershipBadge({ owned, className = "" }: { owned: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] leading-none ${owned ? "border-[#d4af37]/70 bg-[#d4af37]/15 text-[#f0d889]" : "border-white/10 bg-white/10 text-white"} ${className}`}>
      {owned ? (
        <>
          PAR VOUS <Pencil className="h-3 w-3" strokeWidth={3} />
        </>
      ) : (
        <>
          PAR AUTRE <Lock className="h-3 w-3" strokeWidth={3} />
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
  const rating = averageRating(nomination.ratings);

  return (
    <BrutalCard tone={index % 3 === 0 ? "yellow" : "paper"} className="overflow-hidden">
      <div className="media-cut relative aspect-[9/16] border-b border-[#d4af37]/20">
        <MediaFrame nomination={nomination} height="h-full" controls={false} />
        <OwnershipBadge owned={owned} className="absolute left-2 top-2" />
        <Sticker tone={nomination.status === "rejected" ? "red" : "yellow"} className="absolute bottom-2 right-2">
          {statusLabel(nomination.status)}
        </Sticker>
      </div>
      <div className="min-w-0 p-3">
        <p className="tabloid-headline text-[clamp(1.35rem,6.5vw,2rem)] leading-[0.95] text-white">{nomination.tiktoker_name}</p>
        <p className="mt-1 line-clamp-2 text-xs font-medium leading-snug text-zinc-300">&quot;{nomination.comment || "Dossier à juger"}&quot;</p>
        <p className="mt-2 flex min-w-0 items-center gap-1 truncate text-[10px] font-bold uppercase tracking-[0.1em] leading-none text-[#d4af37]">
          <Icon className="h-3 w-3 shrink-0" /> {category.label} / {nomination.ratings.length} notes / {rating ? rating.toFixed(1) : "-"} sur 5
        </p>
        {owned && (
          <div className="mt-1.5 grid grid-cols-2 gap-1">
            <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={onEdit} className="owner-action bg-white/10 text-white" type="button">
              Modifier
            </motion.button>
            <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={onRemove} disabled={busy} className="owner-action bg-red-950/50 text-red-100 disabled:opacity-60" type="button">
              Retirer
            </motion.button>
          </div>
        )}
      </div>
    </BrutalCard>
  );
}

function PalmaresList({ rows }: { rows: PalmaresRow[] }) {
  if (rows.length === 0) {
    return (
      <BrutalCard className="p-5 text-center">
        <Trophy className="mx-auto mb-3 h-9 w-9 text-[#d4af37]" />
        <p className="tabloid-headline text-3xl leading-none">Aucun classement.</p>
      </BrutalCard>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <motion.article
          key={row.tiktokerName}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.055, type: "spring", stiffness: 220, damping: 24 }}
          className="brutal-card p-3"
        >
          <div className="grid grid-cols-[2rem_3.3rem_1fr_auto] items-center gap-3">
            <p className="tabloid-headline text-2xl text-[#d4af37]">{index + 1}</p>
            <div className="relative h-14 w-14 overflow-hidden rounded-full border border-[#d4af37]/50 bg-[#d4af37]/10">
              {row.avatarUrl ? <img src={row.avatarUrl} alt="" className="h-full w-full object-cover" /> : null}
              {!row.avatarUrl && <span className="flex h-full w-full items-center justify-center text-sm font-black text-[#f0d889]">{initialsFor(row.tiktokerName)}</span>}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold text-white">@{row.tiktokerName}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                {row.acceptedDossiers}/{row.totalDossiers} dossiers validés
              </p>
            </div>
            <span className="gold-pill">{row.points} pts</span>
          </div>

          <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="stat-bar">
              <motion.div className="stat-bar-fill" initial={{ width: 0 }} animate={{ width: `${row.successRate}%` }} transition={{ delay: index * 0.06 + 0.12, duration: 0.55 }} />
            </div>
            <p className="text-sm font-extrabold text-[#f0d889]">{row.successRate}%</p>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {FEATURED_CATEGORY_IDS.map((categoryId) => {
              const category = getCategoryMeta(categoryId);
              return (
                <div key={categoryId} className="rounded-xl border border-white/10 bg-white/[0.035] px-2 py-2 text-center">
                  <p className="truncate text-[9px] font-bold uppercase tracking-[0.11em] text-zinc-500">{category.label}</p>
                  <p className="mt-1 text-lg font-black text-white">{row.categoryCounts[categoryId] ?? 0}</p>
                </div>
              );
            })}
          </div>
        </motion.article>
      ))}
    </div>
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
  const [comment, setComment] = useState("");
  const [initialRating, setInitialRating] = useState(4);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [editingNominationId, setEditingNominationId] = useState<string | null>(null);
  const [mutationBusyId, setMutationBusyId] = useState<string | null>(null);

  const [ratingDraftById, setRatingDraftById] = useState<Record<string, number>>({});
  const [reviewDraftById, setReviewDraftById] = useState<Record<string, string>>({});
  const [voteBusyId, setVoteBusyId] = useState<string | null>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const showToast = useCallback((tone: ToastTone, message: string) => {
    if (tone === "error") haptic(100);
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    setToast({ tone, message });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 2800);
  }, []);

  const switchTab = useCallback((nextTab: Tab) => {
    haptic(15);
    setTab(nextTab);
  }, []);

  useEffect(() => {
    setSupabase(getSupabaseBrowserClient());
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    try {
      const storedId = localStorage.getItem(USER_DEVICE_ID_KEY) || localStorage.getItem(LEGACY_SESSION_ID_KEY);
      const nextId = storedId || makeSessionId();
      const storedPseudo = sanitizePseudo(localStorage.getItem(PSEUDO_KEY) || "");
      const nextPseudo = storedPseudo || `Joueur ${nextId.slice(0, 4).toUpperCase()}`;
      localStorage.setItem(USER_DEVICE_ID_KEY, nextId);
      localStorage.setItem(LEGACY_SESSION_ID_KEY, nextId);
      localStorage.setItem(PSEUDO_KEY, nextPseudo);
      localStorage.setItem(ROOM_CODE_KEY, DEFAULT_ROOM_CODE);
      setParticipant({ id: nextId, pseudo: nextPseudo });
    } finally {
      setBootingSession(false);
    }
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
        const { data, error } = await supabase
          .from("nominations")
          .select("id,room_id,category_id,tiktoker_name,media_url,video_storage_path,thumbnail_url,thumbnail_storage_path,media_kind,comment,submitted_by,status,created_at,ratings(id,nomination_id,voter_id,rating_stars,comment,created_at)")
          .eq("room_id", activeRoomId)
          .order("created_at", { ascending: false });

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
      .on("postgres_changes", { event: "*", schema: "public", table: "ratings" }, () => {
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

  const accepted = useMemo(() => nominations.filter((nomination) => nomination.status === "accepted"), [nominations]);
  const rejected = useMemo(() => nominations.filter((nomination) => nomination.status === "rejected"), [nominations]);
  const feedItems = useMemo(() => nominations.slice(0, 8), [nominations]);
  const monthlyNominations = useMemo(() => nominations.filter((nomination) => isCurrentMonth(nomination.created_at)), [nominations]);
  const ultimateWinner = useMemo(() => buildScoreBoard(nominations)[0] ?? null, [nominations]);
  const paparazziOr = useMemo(() => bestSubmission(nominations), [nominations]);
  const palmaresRows = useMemo(() => buildPalmaresRows(nominations), [nominations]);
  const categoryWinners = useMemo(() => {
    return CATEGORIES.map((category) => {
      const winner = buildScoreBoard(nominations, category.id)[0];
      return winner ? { category, winner } : null;
    }).filter(Boolean) as Array<{ category: CategoryMeta; winner: ScoreBoard }>;
  }, [nominations]);

  const editingNomination = useMemo(() => nominations.find((nomination) => nomination.id === editingNominationId) ?? null, [nominations, editingNominationId]);
  const isEditingStudio = Boolean(editingNomination);
  const cleanTiktokerName = sanitizeTiktokerName(tiktokerName);
  const uploadReady = isEditingStudio
    ? comment.trim().length >= 3 && cleanTiktokerName.length >= 2
    : Boolean(preparedFile && thumbnailFile && comment.trim().length >= 3 && cleanTiktokerName.length >= 2 && !isPreparingMedia);
  const ownsNomination = useCallback((nomination: Nomination) => Boolean(participant && nomination.submitted_by === participant.id), [participant]);

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
    clearPreparedMedia();
    setTiktokerName("");
    setComment("");
    setInitialRating(4);
    setCatId(CATEGORIES[0].id);
  }, [clearPreparedMedia]);

  const startEditNomination = useCallback(
    (nomination: Nomination) => {
      if (!ownsNomination(nomination)) {
        showToast("info", "Dossier verrouillé.");
        return;
      }

      haptic(15);
      clearPreparedMedia();
      setEditingNominationId(nomination.id);
      setTiktokerName(nomination.tiktoker_name);
      setComment(nomination.comment);
      setCatId(nomination.category_id);
      setStudioNotice("MODE MODIF : auteur seulement.");
      switchTab("studio");
    },
    [clearPreparedMedia, ownsNomination, showToast, switchTab]
  );

  const cancelEditNomination = useCallback(() => {
    haptic(15);
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
      showToast("success", "Rec prêt.");
    } catch (err) {
      clearPreparedMedia();
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

    haptic([15, 30, 10]);
    setMutationBusyId(editingNomination.id);

    try {
      const { error } = await supabase.rpc("update_own_nomination", {
        target_nomination_id: editingNomination.id,
        editor_id: participant.id,
        next_comment: cleanedComment,
        next_category_id: catId,
        next_tiktoker_name: cleanTiktokerName
      });

      if (error) throw error;

      showToast("success", "Dossier modifié.");
      setEditingNominationId(null);
      setStudioNotice(null);
      resetStudioDraft();
      switchTab("direct");
      await channelRef.current?.send({ type: "broadcast", event: "nomination", payload: { id: editingNomination.id } });
      void fetchNominations(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Modification refusée.";
      showToast("error", message);
    } finally {
      setMutationBusyId(null);
    }
  };

  const removeNomination = async (nomination: Nomination) => {
    if (!participant || !supabase || !ownsNomination(nomination) || mutationBusyId) return;
    const confirmed = window.confirm("Retirer ce dossier du club ?");
    if (!confirmed) return;

    haptic([25, 60]);
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
      const message = err instanceof Error ? err.message : "Retrait refusé.";
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

    haptic(15);
    setUploadLoading(true);
    setMediaProgress(0.15);
    setStudioNotice(null);

    try {
      const activeRoomId = roomId ?? (await ensureRoom());
      if (!activeRoomId) throw new Error("Salon introuvable.");

      const thumbnailUpload = await uploadFileOrFallback(supabase, thumbnailFile, "miniatures");
      setMediaProgress(mediaKind === "video" ? 0.45 : 0.82);

      const mediaUpload = mediaKind === "video" ? await uploadFileOrFallback(supabase, preparedFile, "videos") : thumbnailUpload;
      setMediaProgress(0.82);

      const { data: insertedNomination, error: insertError } = await supabase
        .from("nominations")
        .insert({
          room_id: activeRoomId,
          category_id: catId,
          tiktoker_name: cleanTiktokerName,
          media_url: mediaUpload.publicUrl,
          video_storage_path: mediaKind === "video" ? mediaUpload.key : null,
          thumbnail_url: thumbnailUpload.publicUrl,
          thumbnail_storage_path: thumbnailUpload.key,
          media_kind: mediaKind,
          comment: cleanedComment,
          submitted_by: participant.id,
          status: "pending"
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      const nominationId = toText(insertedNomination?.id);
      if (!nominationId) throw new Error("Dossier non créé.");

      const { error: ratingError } = await supabase.rpc("submit_nomination_vote", {
        target_nomination_id: nominationId,
        voter_id: participant.id,
        stars: clampRating(initialRating),
        reaction_comment: cleanedComment
      });

      if (ratingError) throw ratingError;

      setMediaProgress(1);
      haptic([15, 30, 10]);
      setStudioNotice(thumbnailUpload.provider === "supabase" || mediaUpload.provider === "supabase" ? SUPABASE_STORAGE_NOTICE : null);
      showToast("success", "Dossier lancé dans le club.");
      resetStudioDraft();
      switchTab("direct");
      await channelRef.current?.send({ type: "broadcast", event: "nomination", payload: { id: nominationId } });
      void fetchNominations(true, activeRoomId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec de l'envoi.";
      showToast("error", message);
    } finally {
      setUploadLoading(false);
    }
  };

  const applyRating = async (id: string, choice: VerdictChoice) => {
    if (!participant || !supabase || voteBusyId) return;

    const nomination = nominations.find((item) => item.id === id);
    if (!nomination) return;

    const cleanedReview = (reviewDraftById[id] ?? "").trim();
    if (cleanedReview.length < 2) {
      showToast("error", "Ajoute ta réaction.");
      return;
    }

    const draft = clampRating(ratingDraftById[id] ?? 4);
    const stars = choice === "propel" ? Math.max(3, draft) : Math.min(2, draft);

    haptic([15, 30, 10]);
    setVoteBusyId(id);
    setShakeId(id);
    window.setTimeout(() => setShakeId(null), 520);

    try {
      const { error } = await supabase.rpc("submit_nomination_vote", {
        target_nomination_id: id,
        voter_id: participant.id,
        stars,
        reaction_comment: cleanedReview
      });

      if (error) throw error;

      setRatingDraftById((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setReviewDraftById((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      voteBurst(choice);
      showToast("success", `${verdictLabel(choice)} enregistré.`);
      await channelRef.current?.send({ type: "broadcast", event: "rating", payload: { id } });
      void fetchNominations(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Note refusée.";
      showToast("error", message);
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
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-black" />
          <p className="text-xl font-black uppercase leading-none">Chargement du jeu...</p>
        </BrutalCard>
      </div>
    );
  }

  return (
    <div className="tabloid-app flex min-h-screen flex-col justify-between bg-[#050505] pb-[calc(env(safe-area-inset-bottom)+70px)]">
      <PaperBackdrop />

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} className="fixed left-1/2 z-[100] w-[92%] max-w-sm -translate-x-1/2" style={{ top: "calc(env(safe-area-inset-top) + 10px)" }}>
            <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold uppercase tracking-[0.08em] shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl ${toast.tone === "success" ? "border-[#d4af37]/60 bg-[#d4af37]/20 text-[#f0d889]" : toast.tone === "error" ? "border-red-400/40 bg-red-950/80 text-red-100" : "border-white/10 bg-black/80 text-white"}`}>
              {toast.tone === "success" ? <Check className="h-4 w-4" /> : toast.tone === "error" ? <ShieldAlert className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              <span>{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 mx-auto min-h-0 w-full max-w-[30rem] flex-1 overflow-y-auto overscroll-contain px-2 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 6px)" }}>
        <header className="sticky top-0 z-30 mb-3 grid grid-cols-[1fr_auto] gap-2 bg-[#050505]/85 py-2 backdrop-blur-xl">
          <div className="ticker">
            <span className="ticker-track">
              CÉRÉMONIE LE 1ER DU MOIS / DANS {ceremonyCountdown.days}J {ceremonyCountdown.hours}H {ceremonyCountdown.mins}M / TOURNOI DU MOIS / {monthlyNominations.length} DOSSIERS EN JEU / CÉRÉMONIE LE 1ER DU MOIS / DANS {ceremonyCountdown.days}J {ceremonyCountdown.hours}H {ceremonyCountdown.mins}M
            </span>
          </div>
          <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={() => void fetchNominations()} disabled={syncing || !supabase} className="brutal-icon-button disabled:opacity-50" aria-label="Rafraîchir le direct">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          </motion.button>
        </header>

        <section className="mb-3 grid grid-cols-3 gap-2">
          <BrutalCard tone="yellow" className="p-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] leading-none text-[#d4af37]">Academy</p>
            <p className="tabloid-headline text-[clamp(2rem,11vw,3rem)] leading-none">{pendingForMe.length}</p>
          </BrutalCard>
          <BrutalCard tone="red" className="p-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] leading-none text-[#d4af37]">Validés</p>
            <p className="tabloid-headline text-[clamp(2rem,11vw,3rem)] leading-none">{accepted.length}</p>
          </BrutalCard>
          <BrutalCard tone="black" className="p-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] leading-none text-zinc-500">Bannis</p>
            <p className="tabloid-headline text-[clamp(2rem,11vw,3rem)] leading-none">{rejected.length}</p>
          </BrutalCard>
        </section>

        <AnimatePresence mode="wait">
          {tab === "direct" && (
            <motion.section key="direct" {...pageTransition} {...revealContainer} drag={reduceMotion ? false : "x"} dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => handleSectionDrag(info)} transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }} className="space-y-2">
              <motion.div {...revealItem}>
                <BrutalCard className="relative overflow-hidden p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-[#d4af37]">Red Carpet</p>
                  <h1 className="tabloid-headline text-[clamp(2.85rem,14vw,5rem)] leading-[0.92] text-[#f5f1e8]">
                    NOMINEES
                    <span className="mx-2 inline-block rounded-full border border-[#d4af37]/70 bg-[#d4af37]/15 px-3 py-1 text-[clamp(1.15rem,5.5vw,1.9rem)] font-bold leading-none text-[#f0d889]">or</span>
                    <span className="block text-[#d4af37]">DENOMINEES</span>
                  </h1>
                  <div className="paper-tear -mt-[4px]" />
                  <div className="rounded-2xl border border-[#d4af37]/30 bg-black/40 px-3 py-2 text-white">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">Le club des recs du mois</p>
                  </div>
                </BrutalCard>
              </motion.div>

              <motion.div {...revealItem} className="space-y-2">
                <SectionTitle>{DIRECT_TITLE}</SectionTitle>
                {feedItems.length === 0 ? (
                  <BrutalCard className="p-4 text-center">
                    <Camera className="mx-auto mb-3 h-9 w-9" />
                    <p className="text-2xl font-black uppercase leading-none">Aucun rec.</p>
                  </BrutalCard>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {feedItems.map((nomination, index) => (
                      <NominationTile key={nomination.id} nomination={nomination} index={index} owned={ownsNomination(nomination)} onEdit={() => startEditNomination(nomination)} onRemove={() => void removeNomination(nomination)} busy={mutationBusyId === nomination.id} />
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.section>
          )}

          {tab === "vote" && (
            <motion.section key="vote" {...pageTransition} drag={reduceMotion ? false : "x"} dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => handleSectionDrag(info)} transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }} className="space-y-2">
              <SectionTitle tone="yellow">{VOTE_TITLE}</SectionTitle>
              {pendingForMe.length === 0 ? (
                <BrutalCard tone="yellow" className="p-4 text-center">
                  <Check className="mx-auto mb-3 h-9 w-9" />
                  <p className="text-3xl font-black uppercase leading-none">File vide.</p>
                </BrutalCard>
              ) : (
                pendingForMe.map((nomination) => {
                  const category = getCategoryMeta(nomination.category_id);
                  const Icon = category.icon;
                  const draftRating = clampRating(ratingDraftById[nomination.id] ?? 4);

                  return (
                    <motion.article key={nomination.id} animate={shakeId === nomination.id ? { x: [0, -8, 8, -5, 5, 0], scale: [1, 0.99, 1.01, 1] } : { x: 0, scale: 1 }} transition={{ duration: 0.42 }} className="brutal-card overflow-hidden">
                      <div className="relative border-b border-[#d4af37]/20 bg-black">
                        <MediaFrame nomination={nomination} height="aspect-[9/16] max-h-[58svh]" />
                        <Sticker tone="yellow" className="absolute left-2 top-2 -rotate-2">
                          À voter
                        </Sticker>
                        <OwnershipBadge owned={ownsNomination(nomination)} className="absolute right-2 top-2 rotate-2" />
                        <div className="absolute bottom-3 left-3 right-3 rounded-2xl border border-[#d4af37]/35 bg-black/75 p-3 backdrop-blur-md">
                          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d4af37]">
                            <Icon className="h-3.5 w-3.5" /> {category.label}
                          </p>
                          <p className="tabloid-headline text-[clamp(1.8rem,9.5vw,3rem)] leading-[0.92] text-white">{nomination.tiktoker_name}</p>
                        </div>
                      </div>
                      <div className="space-y-2 p-2">
                        <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm font-medium leading-snug text-zinc-200">&quot;{nomination.comment}&quot;</p>
                        <StarInput value={draftRating} onChange={(value) => setRatingDraftById((prev) => ({ ...prev, [nomination.id]: value }))} size="lg" />
                        <textarea value={reviewDraftById[nomination.id] ?? ""} onChange={(event) => setReviewDraftById((prev) => ({ ...prev, [nomination.id]: event.target.value }))} placeholder="Ta réaction sur ce dossier ?" rows={2} maxLength={180} className="brutal-input w-full resize-none p-2 text-base font-black uppercase" />
                        <div className="grid grid-cols-2 gap-2">
                          <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={() => void applyRating(nomination.id, "propel")} disabled={voteBusyId === nomination.id} className="brutal-action bg-[#d4af37] text-black disabled:opacity-50">
                            Propulser
                          </motion.button>
                          <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={() => void applyRating(nomination.id, "ban")} disabled={voteBusyId === nomination.id} className="brutal-action bg-red-950/70 text-red-100 disabled:opacity-50">
                            Bannir
                          </motion.button>
                        </div>
                      </div>
                    </motion.article>
                  );
                })
              )}
            </motion.section>
          )}

          {tab === "studio" && (
            <motion.section key="studio" {...pageTransition} drag={reduceMotion ? false : "x"} dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => handleSectionDrag(info)} transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }} className="space-y-2">
              <BrutalCard tone="black" className="p-2">
                <h2 className="tabloid-headline text-[clamp(2rem,10.5vw,3.45rem)] leading-[0.84] text-white">{isEditingStudio ? "MODIFIER LE DOSSIER" : STUDIO_TITLE}</h2>
              </BrutalCard>

              <BrutalCard className="p-1.5">
                {editingNomination ? (
                  <div className="relative overflow-hidden rounded-2xl border border-[#d4af37]/25 bg-black">
                    <MediaFrame nomination={editingNomination} height="aspect-[9/16] max-h-[58svh]" />
                    <OwnershipBadge owned className="absolute left-2 top-2 -rotate-2" />
                  </div>
                ) : (
                  <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={() => fileInputRef.current?.click()} disabled={isPreparingMedia || uploadLoading} className="relative flex aspect-[9/16] max-h-[58svh] w-full items-center justify-center overflow-hidden rounded-2xl border border-[#d4af37]/25 bg-black text-left transition disabled:opacity-70">
                    {previewUrl ? (
                      mediaKind === "video" ? (
                        <video src={previewUrl} poster={thumbnailPreviewUrl ?? undefined} className="absolute inset-0 h-full w-full object-cover" controls loop playsInline muted preload="metadata" />
                      ) : (
                        <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      )
                    ) : (
                      <span className="flex flex-col items-center px-6 text-center text-white">
                        {isPreparingMedia ? <Loader2 className="mb-3 h-9 w-9 animate-spin text-[#d4af37]" /> : <UploadCloud className="mb-3 h-9 w-9 text-[#d4af37]" />}
                        <span className="tabloid-headline text-3xl leading-none">{isPreparingMedia ? "Chargement du studio..." : "Déposer le rec"}</span>
                        <span className="mt-2 text-sm font-bold uppercase tracking-[0.14em] text-[#d4af37]">Vidéo ou capture libre</span>
                      </span>
                    )}
                    <input ref={fileInputRef} type="file" accept="video/*,image/*" onChange={(event) => void prepareMedia(event.target.files?.[0] ?? null)} className="hidden" />
                  </motion.button>
                )}
              </BrutalCard>

              {studioNotice && (
                <BrutalCard tone="yellow" className="p-2">
                  <p className="tabloid-headline text-[clamp(1.25rem,6.5vw,2rem)] leading-[0.85]">{studioNotice}</p>
                </BrutalCard>
              )}

              {(isPreparingMedia || uploadLoading) && (
                <BrutalCard tone="yellow" className="p-2">
                  <p className="tabloid-headline text-[clamp(1.6rem,8vw,2.45rem)] leading-[0.85]">{uploadLoading ? "CHARGEMENT DU DOSSIER..." : "PRÉPARATION DU REC..."}</p>
                  <div className="stat-bar mt-3">
                    <motion.div className="stat-bar-fill" animate={{ width: `${Math.round(mediaProgress * 100)}%` }} />
                  </div>
                </BrutalCard>
              )}

              <input value={tiktokerName} onChange={(event) => setTiktokerName(event.target.value)} placeholder="TikToker visé" maxLength={48} className="brutal-input w-full px-3 py-3 text-lg font-black uppercase" />

              <select value={catId} onChange={(event) => setCatId(event.target.value)} className="brutal-input w-full appearance-none px-3 py-3 text-lg font-black uppercase">
                {CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>

              <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Pourquoi ce dossier mérite le club ?" rows={3} maxLength={240} className="brutal-input w-full resize-none p-3 text-lg font-black uppercase" />

              {!isEditingStudio && (
                <BrutalCard tone="yellow" className="p-2">
                  <StarInput value={initialRating} onChange={setInitialRating} size="lg" />
                  <p className="mt-3 border-t border-[#d4af37]/20 pt-3 text-center text-sm font-bold uppercase tracking-[0.14em] text-[#d4af37]">Note initiale : {initialRating} / 5</p>
                </BrutalCard>
              )}

              {isEditingStudio ? (
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={() => void saveEditedNomination()} disabled={mutationBusyId === editingNominationId || !uploadReady} className="brutal-submit flex w-full items-center justify-center gap-2 disabled:opacity-50">
                    {mutationBusyId === editingNominationId ? <Loader2 className="h-6 w-6 animate-spin" /> : "Sauvegarder"}
                  </motion.button>
                  <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={cancelEditNomination} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-bold uppercase tracking-[0.12em] text-white" type="button">
                    Annuler
                  </motion.button>
                </div>
              ) : (
                <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={() => void uploadNomination()} disabled={uploadLoading || !uploadReady} className="brutal-submit flex w-full items-center justify-center gap-2 disabled:opacity-50">
                  {uploadLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Lancer le dossier"}
                </motion.button>
              )}
            </motion.section>
          )}

          {tab === "palmares" && (
            <motion.section key="palmares" {...pageTransition} drag={reduceMotion ? false : "x"} dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => handleSectionDrag(info)} transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }} className="space-y-3">
              <BrutalCard tone="black" className="p-4 text-white">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-[#d4af37]">Leaderboard</p>
                <h2 className="tabloid-headline text-[clamp(2.55rem,12vw,4.4rem)] leading-[0.92]">{PALMARES_TITLE}</h2>
              </BrutalCard>
              <PalmaresList rows={palmaresRows} />
            </motion.section>
          )}

          {tab === "winners" && (
            <motion.section key="winners" {...pageTransition} drag={reduceMotion ? false : "x"} dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => handleSectionDrag(info)} transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }} className="space-y-3">
              <BrutalCard tone="black" className="p-4 text-white">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-[#d4af37]">Hall of Fame</p>
                <h2 className="tabloid-headline text-[clamp(2.55rem,12vw,4.4rem)] leading-[0.92]">{WINNERS_TITLE}</h2>
              </BrutalCard>

              {ultimateWinner && (
                <BrutalCard tone="yellow" className="p-4">
                  <Sticker tone="yellow">TikToker du mois</Sticker>
                  <p className="tabloid-headline mt-3 text-[clamp(2.2rem,12vw,4rem)] leading-[0.92] text-white">{ultimateWinner.tiktokerName}</p>
                  <span className="gold-pill mt-3">{ultimateWinner.points} points</span>
                </BrutalCard>
              )}

              {paparazziOr && (
                <BrutalCard className="p-4">
                  <Sticker tone="paper">Paparazzi d&apos;Or</Sticker>
                  <p className="tabloid-headline mt-3 text-[clamp(1.7rem,9vw,2.8rem)] leading-[0.95] text-white">{paparazziOr.tiktoker_name}</p>
                  <span className="gold-pill mt-3">{totalPoints(paparazziOr.ratings)} points sur un dossier</span>
                </BrutalCard>
              )}

              {categoryWinners.length === 0 ? (
                <BrutalCard className="p-5 text-center">
                  <Trophy className="mx-auto mb-3 h-10 w-10 text-[#d4af37]" />
                  <p className="tabloid-headline text-3xl leading-none">Aucun winner.</p>
                </BrutalCard>
              ) : (
                categoryWinners.map(({ category, winner }, index) => {
                  const Icon = category.icon;
                  return (
                    <BrutalCard key={category.id} tone={index % 2 === 0 ? "paper" : "yellow"} className="p-4">
                      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d4af37]">
                        <Icon className="h-3.5 w-3.5" /> {category.label}
                      </p>
                      <p className="tabloid-headline mt-2 text-[clamp(1.75rem,9vw,2.8rem)] leading-[0.95] text-white">{winner.tiktokerName}</p>
                      <span className="gold-pill mt-3">{winner.points} points / {winner.votes} notes</span>
                    </BrutalCard>
                  );
                })
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {tab !== "studio" && (
        <motion.button initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={() => switchTab("studio")} className="brutal-fab fixed right-5 z-40 flex h-16 w-16 items-center justify-center" style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }} aria-label="Lancer un dossier">
          <Plus className="h-8 w-8" />
        </motion.button>
      )}

      <nav className="bottom-tabloid fixed bottom-0 left-0 right-0 z-40 px-2 pt-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}>
        <div className="mx-auto grid w-full max-w-[30rem] grid-cols-5 gap-1">
          {TAB_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            const badge = item.id === "vote" ? pendingForMe.length : 0;

            return (
              <motion.button key={item.id} whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={() => switchTab(item.id)} className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 transition ${active ? "border-[#d4af37]/70 bg-[#d4af37]/18 text-[#f0d889]" : "border-white/10 bg-white/[0.045] text-zinc-400"}`}>
                <Icon className="relative z-10 h-5 w-5" strokeWidth={1.5} />
                <span className="relative z-10 text-[9px] font-black uppercase">{item.label}</span>
                {badge > 0 && (
                  <span className="absolute right-0 top-0 z-20 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full border border-[#d4af37]/80 bg-[#d4af37] px-1 text-[9px] font-black text-black">
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
