"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import confetti from "canvas-confetti";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { AnimatePresence, motion, type PanInfo, useReducedMotion } from "framer-motion";
import {
  Archive,
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
  Trash2,
  Trophy,
  UploadCloud,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Tab = "direct" | "vote" | "studio" | "zins" | "bannis";
type DossierStatus = "pending" | "accepted" | "rejected";
type VerdictChoice = "propel" | "ban";
type ToastTone = "success" | "error" | "info";
type CategoryMood = "positive" | "critical" | "fun";
type MediaKind = "video" | "image";

type ToastState = { tone: ToastTone; message: string } | null;

type Participant = {
  id: string;
  pseudo: string;
};

type Tiktokeur = {
  id: string;
  name: string;
  avatar_emoji: string;
};

type Rating = {
  id: string;
  dossier_id: string;
  voter_id: string;
  stars_count: number;
  comment: string;
  voted_at: string;
};

type Dossier = {
  id: string;
  submitted_by: string;
  tiktokeur_id: string;
  category_id: string;
  media_url: string;
  media_storage_path: string | null;
  thumbnail_url: string | null;
  thumbnail_storage_path: string | null;
  media_kind: MediaKind;
  comment: string;
  created_at: string;
  tiktokeur: Tiktokeur;
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
  fallback: boolean;
};

type ScoreBoard = {
  target: Tiktokeur;
  category?: CategoryMeta;
  points: number;
  votes: number;
  average: number;
  dossiers: number;
};

const LEGACY_SESSION_ID_KEY = "nod_session_id";
const USER_DEVICE_ID_KEY = "nod_user_device_id";
const PSEUDO_KEY = "nod_pseudo";
const MAX_DIRECT_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;
const MIN_PUBLIC_RATINGS = 2;
const STAR_VALUES = [1, 2, 3, 4, 5] as const;
const DIRECT_TITLE = "DIRECT";
const VOTE_TITLE = "À VOTER";
const STUDIO_TITLE = "STUDIO";
const ZINS_TITLE = "LES ZINS";
const BANNIS_TITLE = "LA HONTE DE LA OUMMA : LES DOSSIERS BANNIS";
const SIMULATION_NOTICE = "MODE SIMULATION : stockage en cours d'activation.";
const FALLBACK_VIDEO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const FALLBACK_IMAGE_URL =
  "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1080'%20height='1440'%20viewBox='0%200%201080%201440'%3E%3Crect%20width='1080'%20height='1440'%20fill='%23000000'/%3E%3Crect%20x='64'%20y='64'%20width='952'%20height='1312'%20fill='%23f2efe3'%20stroke='%23000000'%20stroke-width='24'/%3E%3Crect%20x='112'%20y='112'%20width='856'%20height='240'%20fill='%23e11d48'/%3E%3Ctext%20x='540'%20y='248'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='118'%20fill='%23ffffff'%3ENOD%3C/text%3E%3Ctext%20x='540'%20y='690'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='104'%20fill='%23000000'%3EDOSSIER%3C/text%3E%3Ctext%20x='540'%20y='810'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='104'%20fill='%23000000'%3EEN%20DIRECT%3C/text%3E%3Crect%20x='248'%20y='936'%20width='584'%20height='132'%20fill='%23b5f42b'%20stroke='%23000000'%20stroke-width='18'/%3E%3Ctext%20x='540'%20y='1028'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='64'%20fill='%23000000'%3EA%20VOTER%3C/text%3E%3C/svg%3E";
const TAP_REBOUND = { scale: 0.96, rotate: -0.5 };
const TAP_TRANSITION = { type: "spring", stiffness: 620, damping: 24 } as const;

const CATEGORIES: CategoryMeta[] = [
  { id: "zin_du_mois", label: "Le Zin du mois", mood: "positive", icon: Crown },
  { id: "fierte_des_notres", label: "La fierté des nôtres", mood: "positive", icon: BadgeCheck },
  { id: "honte_oumma", label: "La honte de la Oumma", mood: "critical", icon: ShieldAlert },
  { id: "roue_libre", label: "Roue libre", mood: "fun", icon: Flame },
  { id: "trop_genant", label: "Trop gênant", mood: "critical", icon: ShieldAlert },
  { id: "xptdr", label: "Xptdr", mood: "fun", icon: Sparkles },
  { id: "masterclass", label: "Masterclass", mood: "positive", icon: Trophy },
  { id: "derape_sec", label: "Dérape sec", mood: "critical", icon: Flame },
  { id: "dossier_lourd", label: "Dossier lourd", mood: "critical", icon: Archive },
  { id: "mythomane", label: "Mythomane", mood: "critical", icon: ShieldAlert },
  { id: "frappe_chirurgicale", label: "Frappe chirurgicale", mood: "positive", icon: Zap },
  { id: "silence_assourdissant", label: "Silence assourdissant", mood: "critical", icon: Clock3 },
  { id: "performance_surprise", label: "Performance surprise", mood: "positive", icon: Camera }
];

const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((category) => [category.id, category])) as Record<string, CategoryMeta>;

const TAB_ITEMS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "direct", label: "Direct", icon: Sparkles },
  { id: "vote", label: "À voter", icon: Zap },
  { id: "studio", label: "Studio", icon: Plus },
  { id: "zins", label: "Les Zins", icon: Crown },
  { id: "bannis", label: "Bannis", icon: ShieldAlert }
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

function clampRating(value: number) {
  return Math.min(5, Math.max(1, Math.round(value)));
}

function haptic(pattern: number | number[]) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  navigator.vibrate(pattern);
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

function sanitizeTargetName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\sÀ-ÖØ-öø-ÿ'@.-]/g, "")
    .slice(0, 32);
}

function sanitizeEmoji(value: string) {
  const trimmed = value.trim();
  return trimmed ? Array.from(trimmed).slice(0, 2).join("") : "🎥";
}

function getCategoryMeta(value: string) {
  return CATEGORY_BY_ID[value] ?? { id: "custom", label: value || "Sans catégorie", mood: "fun", icon: Archive };
}

function statusFromRatings(ratings: Rating[]): DossierStatus {
  if (ratings.length < MIN_PUBLIC_RATINGS) return "pending";
  return averageRating(ratings) >= 3 ? "accepted" : "rejected";
}

function statusLabel(status: DossierStatus) {
  if (status === "accepted") return "PROPULSÉ";
  if (status === "rejected") return "BANNI";
  return "À VOTER";
}

function statusClass(status: DossierStatus) {
  if (status === "accepted") return "border-black bg-[#b5f42b] text-black";
  if (status === "rejected") return "border-black bg-[#e11d48] text-white";
  return "border-black bg-[#b5f42b] text-black";
}

function averageRating(ratings: Rating[]) {
  if (ratings.length === 0) return 0;
  return ratings.reduce((sum, rating) => sum + rating.stars_count, 0) / ratings.length;
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

function parseTiktokeur(value: unknown): Tiktokeur {
  const row = Array.isArray(value) ? value[0] : value;
  if (!isRecord(row)) {
    return { id: "inconnu", name: "Profil inconnu", avatar_emoji: "🎥" };
  }

  return {
    id: toText(row.id, "inconnu"),
    name: toText(row.name, "Profil inconnu"),
    avatar_emoji: sanitizeEmoji(toText(row.avatar_emoji, "🎥"))
  };
}

function parseRating(row: Record<string, unknown>): Rating {
  return {
    id: toText(row.id, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    dossier_id: toText(row.dossier_id),
    voter_id: toText(row.voter_id),
    stars_count: clampRating(toNumber(row.stars_count, 1)),
    comment: toText(row.comment),
    voted_at: toText(row.voted_at, new Date().toISOString())
  };
}

function parseDossier(row: Record<string, unknown>): Dossier {
  const ratings = Array.isArray(row.ratings) ? row.ratings.filter(isRecord).map(parseRating) : [];
  const rawMediaKind = toText(row.media_kind, "image");

  return {
    id: toText(row.id, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    submitted_by: toText(row.submitted_by, "session-inconnue"),
    tiktokeur_id: toText(row.tiktokeur_id),
    category_id: toText(row.category_id, CATEGORIES[0].id),
    media_url: toText(row.media_url, FALLBACK_IMAGE_URL),
    media_storage_path: toText(row.media_storage_path) || null,
    thumbnail_url: toText(row.thumbnail_url) || null,
    thumbnail_storage_path: toText(row.thumbnail_storage_path) || null,
    media_kind: rawMediaKind === "video" ? "video" : "image",
    comment: toText(row.comment),
    created_at: toText(row.created_at, new Date().toISOString()),
    tiktokeur: parseTiktokeur(row.tiktokeurs),
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

async function uploadFileToSpaces(file: File, folder: "videos" | "miniatures") {
  try {
    const signResponse = await fetch("/api/spaces/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        folder
      })
    });

    const payload = (await signResponse.json()) as Partial<SpacesUploadResult> & { error?: string };
    if (!signResponse.ok || !payload.uploadUrl || !payload.publicUrl || !payload.key) {
      throw new Error(SIMULATION_NOTICE);
    }

    const uploadResponse = await fetch(payload.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file
    });

    if (!uploadResponse.ok) throw new Error(SIMULATION_NOTICE);

    return {
      key: payload.key,
      publicUrl: payload.publicUrl
    };
  } catch {
    throw new Error(SIMULATION_NOTICE);
  }
}

async function uploadFileOrFallback(file: File, folder: "videos" | "miniatures"): Promise<UploadReference> {
  try {
    const uploaded = await uploadFileToSpaces(file, folder);
    return { ...uploaded, fallback: false };
  } catch {
    return folder === "videos"
      ? { key: "simulation/fallback-video.mp4", publicUrl: FALLBACK_VIDEO_URL, fallback: true }
      : { key: "simulation/fallback-image.svg", publicUrl: FALLBACK_IMAGE_URL, fallback: true };
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

function buildScoreBoard(dossiers: Dossier[], categoryId?: string) {
  const monthly = dossiers.filter((dossier) => isCurrentMonth(dossier.created_at) && (!categoryId || dossier.category_id === categoryId));
  const byTarget = new Map<string, ScoreBoard>();

  for (const dossier of monthly) {
    const category = getCategoryMeta(dossier.category_id);
    const existing = byTarget.get(dossier.tiktokeur.id) ?? {
      target: dossier.tiktokeur,
      category: categoryId ? category : undefined,
      points: 0,
      votes: 0,
      average: 0,
      dossiers: 0
    };

    existing.dossiers += 1;
    for (const rating of dossier.ratings) {
      existing.points += rating.stars_count;
      existing.votes += 1;
    }
    existing.average = existing.votes > 0 ? existing.points / existing.votes : 0;
    byTarget.set(dossier.tiktokeur.id, existing);
  }

  return Array.from(byTarget.values()).sort((a, b) => b.average - a.average || b.points - a.points || b.votes - a.votes);
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
      ? "border-black bg-[#b5f42b] text-black"
      : tone === "black"
        ? "border-black bg-black text-white"
        : tone === "paper"
          ? "border-black bg-[#f2efe3] text-black"
          : "border-black bg-[#e11d48] text-white";

  return <span className={`inline-flex border-4 px-2 py-1 text-[10px] font-black uppercase leading-none ${toneClass} ${className}`}>{children}</span>;
}

function SectionTitle({ children, tone = "black" }: { children: ReactNode; tone?: "black" | "red" | "yellow" }) {
  const toneClass = tone === "red" ? "bg-[#e11d48] text-white" : tone === "yellow" ? "bg-[#b5f42b] text-black" : "bg-black text-white";
  return (
    <div className={`border-4 border-black px-2 py-1.5 ${toneClass}`}>
      <h2 className="tabloid-headline text-[clamp(1.55rem,8.4vw,2.75rem)] leading-[0.82]">{children}</h2>
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
    <motion.div whileTap={{ x: 2, y: 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className={`brutal-card ${toneClass} ${className}`}>
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
            onClick={() => onChange?.(star)}
            className={`flex aspect-square items-center justify-center border-4 border-black transition active:translate-x-0.5 active:translate-y-0.5 disabled:cursor-default ${
              active ? "bg-[#b5f42b] text-black" : "bg-[#f2efe3] text-zinc-500"
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
  dossier,
  height = "h-72",
  controls = true
}: {
  dossier: Dossier;
  height?: string;
  controls?: boolean;
}) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const [engaged, setEngaged] = useState(false);

  useEffect(() => {
    setMediaFailed(false);
    setEngaged(false);
  }, [dossier.media_url, dossier.thumbnail_url]);

  if (mediaFailed) {
    return (
      <div className={`${height} relative flex w-full items-center justify-center bg-black`}>
        {dossier.thumbnail_url ? <img src={dossier.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" /> : null}
        <div className="relative z-10 mx-3 border-4 border-black bg-[#b5f42b] px-2 py-1 text-center text-[11px] font-black uppercase leading-none text-black">
          Connexion au serveur de stockage en cours...
        </div>
      </div>
    );
  }

  if (dossier.media_kind === "video") {
    return (
      <video
        src={dossier.media_url}
        poster={dossier.thumbnail_url ?? undefined}
        controls={controls || engaged}
        loop
        playsInline
        preload="metadata"
        onClick={() => {
          haptic(15);
          setEngaged(true);
        }}
        onTouchStart={() => setEngaged(true)}
        onError={() => setMediaFailed(true)}
        className={`${height} block w-full bg-black object-cover`}
      />
    );
  }

  return <img src={dossier.media_url || dossier.thumbnail_url || FALLBACK_IMAGE_URL} alt="" onError={() => setMediaFailed(true)} className={`${height} block w-full bg-black object-cover`} />;
}

function OwnershipBadge({ owned, className = "" }: { owned: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 border-4 border-black px-2 py-1 text-[10px] font-black uppercase leading-none ${owned ? "bg-[#b5f42b] text-black" : "bg-[#e11d48] text-white"} ${className}`}>
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

function DossierTile({
  dossier,
  index = 0,
  owned = false,
  onEdit,
  onRemove,
  busy = false
}: {
  dossier: Dossier;
  index?: number;
  owned?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
  busy?: boolean;
}) {
  const category = getCategoryMeta(dossier.category_id);
  const Icon = category.icon;
  const rating = averageRating(dossier.ratings);
  const status = statusFromRatings(dossier.ratings);

  return (
    <BrutalCard tone={index % 3 === 0 ? "yellow" : "paper"} className="overflow-hidden">
      <div className="media-cut relative h-[clamp(5.8rem,29vw,7.75rem)] border-b-4 border-black">
        <MediaFrame dossier={dossier} height="h-full" controls={false} />
        <OwnershipBadge owned={owned} className="absolute left-1 top-1 -rotate-2" />
        <Sticker tone={status === "rejected" ? "red" : "yellow"} className="absolute bottom-1 right-1 rotate-2">
          {statusLabel(status)}
        </Sticker>
      </div>
      <div className="min-w-0 p-1.5">
        <p className="text-[clamp(1.3rem,7.4vw,1.9rem)] font-black uppercase leading-[0.82]">
          {dossier.tiktokeur.avatar_emoji} {dossier.tiktokeur.name}
        </p>
        <p className="mt-1 line-clamp-2 text-[0.95rem] font-black uppercase leading-[0.9]">&quot;{dossier.comment || "Dossier à juger"}&quot;</p>
        <p className="mt-1.5 flex min-w-0 items-center gap-1 truncate text-[10px] font-black uppercase leading-none">
          <Icon className="h-3 w-3 shrink-0 text-[#e11d48]" /> {category.label} / {dossier.ratings.length} notes / {rating ? rating.toFixed(1) : "-"} sur 5
        </p>
        {owned && (
          <div className="mt-1.5 grid grid-cols-2 gap-1">
            <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={onEdit} className="owner-action bg-[#0ea5e9] text-white" type="button">
              Modifier
            </motion.button>
            <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={onRemove} disabled={busy} className="owner-action bg-zinc-700 text-white disabled:opacity-60" type="button">
              Retirer
            </motion.button>
          </div>
        )}
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

  const [tab, setTab] = useState<Tab>("direct");
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
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
  const [targetName, setTargetName] = useState("");
  const [targetEmoji, setTargetEmoji] = useState("🎥");
  const [catId, setCatId] = useState(CATEGORIES[0].id);
  const [comment, setComment] = useState("");
  const [initialRating, setInitialRating] = useState(4);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [editingDossierId, setEditingDossierId] = useState<string | null>(null);
  const [mutationBusyId, setMutationBusyId] = useState<string | null>(null);

  const [ratingDraftById, setRatingDraftById] = useState<Record<string, number>>({});
  const [reviewDraftById, setReviewDraftById] = useState<Record<string, string>>({});
  const [voteBusyId, setVoteBusyId] = useState<string | null>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const showToast = useCallback((tone: ToastTone, message: string) => {
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

  const fetchDossiers = useCallback(
    async (silent = false) => {
      if (!supabase) return;

      setSyncing(true);

      try {
        const { data, error } = await supabase
          .from("dossiers")
          .select(
            "id,submitted_by,tiktokeur_id,category_id,media_url,media_storage_path,thumbnail_url,thumbnail_storage_path,media_kind,comment,created_at,tiktokeurs!inner(id,name,avatar_emoji),ratings(id,dossier_id,voter_id,stars_count,comment,voted_at)"
          )
          .order("created_at", { ascending: false });

        if (error) throw error;

        const rows = ((data ?? []) as Record<string, unknown>[]).map(parseDossier);
        setDossiers(rows);
      } catch (err) {
        if (!silent) {
          const message = err instanceof Error ? err.message : "Le direct refuse de répondre.";
          showToast("error", message);
        }
      } finally {
        setSyncing(false);
      }
    },
    [showToast, supabase]
  );

  useEffect(() => {
    if (!participant || !supabase) return;
    void fetchDossiers();
  }, [fetchDossiers, participant, supabase]);

  useEffect(() => {
    if (!participant || !supabase) return;

    const poll = window.setInterval(() => {
      void fetchDossiers(true);
    }, 20000);

    const channel = supabase
      .channel("nod_tournoi_direct", { config: { broadcast: { self: false } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "dossiers" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const submittedBy = toText((payload.new as Record<string, unknown>).submitted_by);
          if (submittedBy !== participant.id) showToast("info", "Nouveau dossier à juger.");
        }
        void fetchDossiers(true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ratings" }, () => {
        void fetchDossiers(true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tiktokeurs" }, () => {
        void fetchDossiers(true);
      })
      .on("broadcast", { event: "dossier" }, () => {
        void fetchDossiers(true);
      })
      .on("broadcast", { event: "rating" }, () => {
        void fetchDossiers(true);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      window.clearInterval(poll);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [fetchDossiers, participant, showToast, supabase]);

  const pendingForMe = useMemo(() => {
    if (!participant) return [];
    return dossiers.filter((dossier) => !dossier.ratings.some((rating) => rating.voter_id === participant.id));
  }, [dossiers, participant]);

  const accepted = useMemo(() => dossiers.filter((dossier) => statusFromRatings(dossier.ratings) === "accepted"), [dossiers]);
  const rejected = useMemo(() => dossiers.filter((dossier) => statusFromRatings(dossier.ratings) === "rejected"), [dossiers]);
  const feedItems = useMemo(() => dossiers.slice(0, 8), [dossiers]);
  const monthlyDossiers = useMemo(() => dossiers.filter((dossier) => isCurrentMonth(dossier.created_at)), [dossiers]);
  const ultimateWinner = useMemo(() => buildScoreBoard(dossiers)[0] ?? null, [dossiers]);
  const categoryWinners = useMemo(() => {
    return CATEGORIES.map((category) => {
      const winner = buildScoreBoard(dossiers, category.id)[0];
      return winner ? { category, winner } : null;
    }).filter(Boolean) as Array<{ category: CategoryMeta; winner: ScoreBoard }>;
  }, [dossiers]);

  const editingDossier = useMemo(() => dossiers.find((dossier) => dossier.id === editingDossierId) ?? null, [dossiers, editingDossierId]);
  const isEditingStudio = Boolean(editingDossier);
  const cleanTargetName = sanitizeTargetName(targetName);
  const uploadReady = isEditingStudio
    ? comment.trim().length >= 3 && cleanTargetName.length >= 2
    : Boolean(preparedFile && thumbnailFile && comment.trim().length >= 3 && cleanTargetName.length >= 2 && !isPreparingMedia);
  const ownsDossier = useCallback((dossier: Dossier) => Boolean(participant && dossier.submitted_by === participant.id), [participant]);

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
    setTargetName("");
    setTargetEmoji("🎥");
    setComment("");
    setInitialRating(4);
    setCatId(CATEGORIES[0].id);
  }, [clearPreparedMedia]);

  const startEditDossier = useCallback(
    (dossier: Dossier) => {
      if (!ownsDossier(dossier)) {
        showToast("info", "Dossier verrouillé.");
        return;
      }

      haptic(15);
      clearPreparedMedia();
      setEditingDossierId(dossier.id);
      setTargetName(dossier.tiktokeur.name);
      setTargetEmoji(dossier.tiktokeur.avatar_emoji);
      setComment(dossier.comment);
      setCatId(dossier.category_id);
      setStudioNotice("MODE MODIF : auteur seulement.");
      switchTab("studio");
    },
    [clearPreparedMedia, ownsDossier, showToast, switchTab]
  );

  const cancelEditDossier = useCallback(() => {
    haptic(15);
    setEditingDossierId(null);
    setStudioNotice(null);
    resetStudioDraft();
  }, [resetStudioDraft]);

  const prepareMedia = async (nextFile: File | null) => {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("video/") && !nextFile.type.startsWith("image/")) {
      showToast("error", "Choisis une vidéo, une photo ou une capture.");
      return;
    }
    if (nextFile.size > MAX_DIRECT_UPLOAD_BYTES) {
      showToast("error", "Fichier trop lourd pour un envoi direct.");
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

  const upsertTiktokeur = async () => {
    if (!supabase) throw new Error("Direct indisponible.");
    const name = sanitizeTargetName(targetName);
    if (name.length < 2) throw new Error("Ajoute le profil TikTok visé.");

    const { data, error } = await supabase
      .from("tiktokeurs")
      .upsert({ name, avatar_emoji: sanitizeEmoji(targetEmoji) }, { onConflict: "name" })
      .select("id,name,avatar_emoji")
      .single();

    if (error) throw error;
    return parseTiktokeur(data as Record<string, unknown>);
  };

  const saveEditedDossier = async () => {
    if (!participant || !supabase || !editingDossier || !ownsDossier(editingDossier) || mutationBusyId) return;

    const cleanedComment = comment.trim();
    if (cleanedComment.length < 3) {
      showToast("error", "Ajoute un contexte net.");
      return;
    }

    haptic([20, 30, 20]);
    setMutationBusyId(editingDossier.id);

    try {
      const target = await upsertTiktokeur();
      const { error } = await supabase.rpc("update_own_dossier", {
        target_dossier_id: editingDossier.id,
        editor_id: participant.id,
        next_comment: cleanedComment,
        next_category_id: catId,
        next_tiktokeur_id: target.id
      });

      if (error) throw error;

      showToast("success", "Dossier modifié.");
      setEditingDossierId(null);
      setStudioNotice(null);
      resetStudioDraft();
      switchTab("direct");
      await channelRef.current?.send({ type: "broadcast", event: "dossier", payload: { id: editingDossier.id } });
      void fetchDossiers(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Modification refusée.";
      showToast("error", message);
    } finally {
      setMutationBusyId(null);
    }
  };

  const removeDossier = async (dossier: Dossier) => {
    if (!participant || !supabase || !ownsDossier(dossier) || mutationBusyId) return;
    const confirmed = window.confirm("Retirer ce dossier du club ?");
    if (!confirmed) return;

    haptic([25, 60]);
    setMutationBusyId(dossier.id);

    try {
      const { error } = await supabase.rpc("delete_own_dossier", {
        target_dossier_id: dossier.id,
        editor_id: participant.id
      });

      if (error) throw error;

      if (editingDossierId === dossier.id) {
        setEditingDossierId(null);
        resetStudioDraft();
      }

      showToast("info", "Dossier retiré.");
      await channelRef.current?.send({ type: "broadcast", event: "dossier", payload: { id: dossier.id } });
      void fetchDossiers(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Retrait refusé.";
      showToast("error", message);
    } finally {
      setMutationBusyId(null);
    }
  };

  const uploadDossier = async () => {
    if (editingDossier) {
      await saveEditedDossier();
      return;
    }

    if (!participant || !supabase) {
      showToast("error", "Le studio n'est pas encore branché.");
      return;
    }

    const cleanedComment = comment.trim();
    if (!preparedFile || !thumbnailFile || !mediaKind || cleanedComment.length < 3 || cleanTargetName.length < 2) {
      showToast("error", "Ajoute le profil, le média et le contexte.");
      return;
    }

    haptic(15);
    setUploadLoading(true);
    setMediaProgress(0.15);
    setStudioNotice(null);

    try {
      const target = await upsertTiktokeur();
      const thumbnailUpload = await uploadFileOrFallback(thumbnailFile, "miniatures");
      setMediaProgress(mediaKind === "video" ? 0.45 : 0.82);

      let mediaUpload: UploadReference;
      if (mediaKind === "video") {
        mediaUpload = await uploadFileOrFallback(preparedFile, "videos");
      } else {
        mediaUpload = thumbnailUpload;
      }
      setMediaProgress(0.82);

      const { data: insertedDossier, error: insertError } = await supabase
        .from("dossiers")
        .insert({
          submitted_by: participant.id,
          tiktokeur_id: target.id,
          category_id: catId,
          media_url: mediaUpload.publicUrl,
          media_storage_path: mediaUpload.key,
          thumbnail_url: thumbnailUpload.publicUrl,
          thumbnail_storage_path: thumbnailUpload.key,
          media_kind: mediaKind,
          comment: cleanedComment
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      const dossierId = toText(insertedDossier?.id);
      if (!dossierId) throw new Error("Dossier non créé.");

      const { error: ratingError } = await supabase.rpc("submit_dossier_rating", {
        target_dossier_id: dossierId,
        voter_id: participant.id,
        stars: clampRating(initialRating),
        reaction_comment: cleanedComment
      });

      if (ratingError) throw ratingError;

      setMediaProgress(1);
      haptic(initialRating >= 3 ? [20, 30, 20] : [25, 60]);
      setStudioNotice(thumbnailUpload.fallback || mediaUpload.fallback ? SIMULATION_NOTICE : null);
      showToast("success", "Dossier lancé dans le club.");
      resetStudioDraft();
      switchTab("direct");
      await channelRef.current?.send({ type: "broadcast", event: "dossier", payload: { id: dossierId } });
      void fetchDossiers(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec de l'envoi.";
      showToast("error", message);
    } finally {
      setUploadLoading(false);
    }
  };

  const applyRating = async (id: string, choice: VerdictChoice) => {
    if (!participant || !supabase || voteBusyId) return;

    const dossier = dossiers.find((item) => item.id === id);
    if (!dossier) return;

    const cleanedReview = (reviewDraftById[id] ?? "").trim();
    if (cleanedReview.length < 2) {
      showToast("error", "Ajoute ta réaction.");
      return;
    }

    const draft = clampRating(ratingDraftById[id] ?? 4);
    const stars = choice === "propel" ? Math.max(3, draft) : Math.min(2, draft);

    haptic(choice === "propel" ? [20, 30, 20] : [25, 60]);
    setVoteBusyId(id);
    setShakeId(id);
    window.setTimeout(() => setShakeId(null), 520);

    try {
      const { error } = await supabase.rpc("submit_dossier_rating", {
        target_dossier_id: id,
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
      void fetchDossiers(true);
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
    <div className="tabloid-app flex min-h-screen flex-col justify-between bg-[#1a1a1a] pb-[calc(env(safe-area-inset-bottom)+70px)]">
      <PaperBackdrop />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            className="fixed left-1/2 z-[100] w-[92%] max-w-sm -translate-x-1/2"
            style={{ top: "calc(env(safe-area-inset-top) + 10px)" }}
          >
            <div
              className={`flex items-center gap-2 border-4 border-black px-4 py-3 text-sm font-black uppercase shadow-[5px_5px_0_#000] ${
                toast.tone === "success" ? "bg-[#b5f42b] text-black" : toast.tone === "error" ? "bg-[#e11d48] text-white" : "bg-black text-white"
              }`}
            >
              {toast.tone === "success" ? <Check className="h-4 w-4" /> : toast.tone === "error" ? <ShieldAlert className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              <span>{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main
        className="relative z-10 mx-auto min-h-0 w-full max-w-[30rem] flex-1 overflow-y-auto overscroll-contain px-2 pb-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 6px)" }}
      >
        <header className="sticky top-0 z-30 mb-2 grid grid-cols-[1fr_auto] gap-1 bg-[#1a1a1a] py-1.5">
          <div className="ticker border-4 border-black bg-[#b5f42b] text-black">
            <span className="ticker-track">
              CÉRÉMONIE LE 1ER DU MOIS / DANS {ceremonyCountdown.days}J {ceremonyCountdown.hours}H {ceremonyCountdown.mins}M / TOURNOI DU MOIS / {monthlyDossiers.length} DOSSIERS EN JEU / CÉRÉMONIE LE 1ER DU MOIS / DANS {ceremonyCountdown.days}J {ceremonyCountdown.hours}H {ceremonyCountdown.mins}M
            </span>
          </div>
          <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={() => void fetchDossiers()} disabled={syncing || !supabase} className="brutal-icon-button disabled:opacity-50" aria-label="Rafraîchir le direct">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          </motion.button>
        </header>

        <section className="mb-2 grid grid-cols-3 gap-1.5">
          <BrutalCard tone="yellow" className="p-1.5">
            <p className="text-[10px] font-black uppercase leading-none">À voter</p>
            <p className="text-[clamp(2rem,11vw,3rem)] font-black leading-none">{pendingForMe.length}</p>
          </BrutalCard>
          <BrutalCard tone="red" className="p-1.5">
            <p className="text-[10px] font-black uppercase leading-none">Dossiers</p>
            <p className="text-[clamp(2rem,11vw,3rem)] font-black leading-none">{monthlyDossiers.length}</p>
          </BrutalCard>
          <BrutalCard tone="black" className="p-1.5">
            <p className="text-[10px] font-black uppercase leading-none">Bannis</p>
            <p className="text-[clamp(2rem,11vw,3rem)] font-black leading-none">{rejected.length}</p>
          </BrutalCard>
        </section>

        <AnimatePresence mode="wait">
          {tab === "direct" && (
            <motion.section
              key="direct"
              {...pageTransition}
              {...revealContainer}
              drag={reduceMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => handleSectionDrag(info)}
              transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }}
              className="space-y-2"
            >
              <motion.div {...revealItem}>
                <BrutalCard className="relative overflow-hidden p-2">
                  <h1 className="tabloid-headline text-[clamp(2.9rem,15vw,5rem)] leading-[0.78]">
                    NOMINEES
                    <span className="mx-2 inline-block -rotate-3 border-4 border-black bg-[#e11d48] px-2 py-0.5 text-[clamp(1.35rem,6.5vw,2.15rem)] font-black leading-none text-white">OR</span>
                    <span className="block text-[#e11d48]">DENOMINEES</span>
                  </h1>
                  <div className="paper-tear -mt-[4px]" />
                  <div className="-mt-[4px] border-4 border-black bg-black px-2 py-1 text-white">
                    <p className="tabloid-headline text-[clamp(1.35rem,7.6vw,2.35rem)] leading-[0.85]">LE CLUB DES RECS DU MOIS</p>
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
                    {feedItems.map((dossier, index) => (
                      <DossierTile
                        key={dossier.id}
                        dossier={dossier}
                        index={index}
                        owned={ownsDossier(dossier)}
                        onEdit={() => startEditDossier(dossier)}
                        onRemove={() => void removeDossier(dossier)}
                        busy={mutationBusyId === dossier.id}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.section>
          )}

          {tab === "vote" && (
            <motion.section
              key="vote"
              {...pageTransition}
              drag={reduceMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => handleSectionDrag(info)}
              transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }}
              className="space-y-2"
            >
              <SectionTitle tone="yellow">{VOTE_TITLE}</SectionTitle>
              {pendingForMe.length === 0 ? (
                <BrutalCard tone="yellow" className="p-4 text-center">
                  <Check className="mx-auto mb-3 h-9 w-9" />
                  <p className="text-3xl font-black uppercase leading-none">File vide.</p>
                </BrutalCard>
              ) : (
                pendingForMe.map((dossier) => {
                  const category = getCategoryMeta(dossier.category_id);
                  const Icon = category.icon;
                  const draftRating = clampRating(ratingDraftById[dossier.id] ?? 4);

                  return (
                    <motion.article
                      key={dossier.id}
                      animate={shakeId === dossier.id ? { x: [0, -12, 12, -9, 9, 0], rotate: [0, -1.2, 1.2, -0.8, 0.8, 0] } : { x: 0, rotate: 0 }}
                      transition={{ duration: 0.42 }}
                      className="brutal-card overflow-hidden"
                    >
                      <div className="relative border-b-4 border-black bg-black">
                        <MediaFrame dossier={dossier} height="h-[min(43svh,22rem)]" />
                        <Sticker tone="yellow" className="absolute left-2 top-2 -rotate-2">
                          À voter
                        </Sticker>
                        <OwnershipBadge owned={ownsDossier(dossier)} className="absolute right-2 top-2 rotate-2" />
                        <div className="absolute bottom-2 left-2 right-2 border-4 border-black bg-[#f2efe3] p-2">
                          <p className="flex items-center gap-1 text-[10px] font-black uppercase text-[#e11d48]">
                            <Icon className="h-3.5 w-3.5" /> {category.label}
                          </p>
                          <p className="text-[clamp(1.8rem,10vw,3rem)] font-black uppercase leading-[0.84]">
                            {dossier.tiktokeur.avatar_emoji} {dossier.tiktokeur.name}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2 p-2">
                        <p className="border-4 border-black bg-white p-2 text-lg font-black uppercase leading-[0.9]">&quot;{dossier.comment}&quot;</p>
                        <StarInput value={draftRating} onChange={(value) => setRatingDraftById((prev) => ({ ...prev, [dossier.id]: value }))} size="lg" />
                        <textarea
                          value={reviewDraftById[dossier.id] ?? ""}
                          onChange={(event) => setReviewDraftById((prev) => ({ ...prev, [dossier.id]: event.target.value }))}
                          placeholder="Ta réaction sur ce dossier ?"
                          rows={2}
                          maxLength={180}
                          className="brutal-input w-full resize-none p-2 text-base font-black uppercase"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={() => void applyRating(dossier.id, "propel")} disabled={voteBusyId === dossier.id} className="brutal-action bg-[#b5f42b] text-black disabled:opacity-50">
                            Propulser
                          </motion.button>
                          <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={() => void applyRating(dossier.id, "ban")} disabled={voteBusyId === dossier.id} className="brutal-action bg-[#e11d48] text-white disabled:opacity-50">
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
            <motion.section
              key="studio"
              {...pageTransition}
              drag={reduceMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => handleSectionDrag(info)}
              transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }}
              className="space-y-2"
            >
              <BrutalCard tone="black" className="p-2">
                <h2 className="tabloid-headline text-[clamp(2rem,10.5vw,3.45rem)] leading-[0.84] text-white">{isEditingStudio ? "MODIFIER LE DOSSIER" : STUDIO_TITLE}</h2>
              </BrutalCard>

              <BrutalCard className="p-1.5">
                {editingDossier ? (
                  <div className="relative min-h-[min(38svh,18rem)] overflow-hidden border-4 border-black bg-black">
                    <MediaFrame dossier={editingDossier} height="h-[min(38svh,18rem)]" />
                    <OwnershipBadge owned className="absolute left-2 top-2 -rotate-2" />
                  </div>
                ) : (
                  <motion.button
                    whileTap={TAP_REBOUND}
                    transition={TAP_TRANSITION}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isPreparingMedia || uploadLoading}
                    className="relative flex min-h-[min(38svh,18rem)] w-full items-center justify-center overflow-hidden border-4 border-black bg-black text-left transition active:translate-x-1 active:translate-y-1 disabled:opacity-70"
                  >
                    {previewUrl ? (
                      mediaKind === "video" ? (
                        <video src={previewUrl} poster={thumbnailPreviewUrl ?? undefined} className="absolute inset-0 h-full w-full object-cover" controls loop playsInline muted preload="metadata" />
                      ) : (
                        <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      )
                    ) : (
                      <span className="flex flex-col items-center px-6 text-center text-white">
                        {isPreparingMedia ? <Loader2 className="mb-3 h-9 w-9 animate-spin text-[#b5f42b]" /> : <UploadCloud className="mb-3 h-9 w-9 text-[#b5f42b]" />}
                        <span className="text-3xl font-black uppercase leading-none">{isPreparingMedia ? "Chargement du studio..." : "Déposer le rec"}</span>
                        <span className="mt-2 text-sm font-black uppercase text-[#b5f42b]">Vidéo, photo, capture</span>
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
                  <div className="mt-2 h-5 border-4 border-black bg-[#f2efe3]">
                    <motion.div className="h-full bg-[#e11d48]" animate={{ width: `${Math.round(mediaProgress * 100)}%` }} />
                  </div>
                </BrutalCard>
              )}

              <div className="grid grid-cols-[1fr_4.6rem] gap-2">
                <input value={targetName} onChange={(event) => setTargetName(event.target.value)} placeholder="Profil TikTok visé" maxLength={32} className="brutal-input w-full px-3 py-3 text-lg font-black uppercase" />
                <input value={targetEmoji} onChange={(event) => setTargetEmoji(event.target.value)} aria-label="Emoji du profil" maxLength={4} className="brutal-input w-full px-2 py-3 text-center text-lg font-black uppercase" />
              </div>

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
                  <p className="mt-2 border-t-4 border-black pt-2 text-center text-sm font-black uppercase">Note initiale : {initialRating} / 5</p>
                </BrutalCard>
              )}

              {isEditingStudio ? (
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={() => void saveEditedDossier()} disabled={mutationBusyId === editingDossierId || !uploadReady} className="brutal-submit flex w-full items-center justify-center gap-2 bg-[#b5f42b] text-black disabled:opacity-50">
                    {mutationBusyId === editingDossierId ? <Loader2 className="h-6 w-6 animate-spin" /> : "Sauvegarder"}
                  </motion.button>
                  <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={cancelEditDossier} className="border-4 border-black bg-[#f2efe3] px-4 text-lg font-black uppercase text-black shadow-[5px_5px_0_#000]" type="button">
                    Annuler
                  </motion.button>
                </div>
              ) : (
                <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={() => void uploadDossier()} disabled={uploadLoading || !uploadReady} className="brutal-submit flex w-full items-center justify-center gap-2 disabled:opacity-50">
                  {uploadLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Lancer le dossier"}
                </motion.button>
              )}
            </motion.section>
          )}

          {tab === "zins" && (
            <motion.section
              key="zins"
              {...pageTransition}
              drag={reduceMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => handleSectionDrag(info)}
              transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }}
              className="space-y-2"
            >
              <BrutalCard tone="black" className="p-2 text-white">
                <h2 className="tabloid-headline text-[clamp(2.35rem,12vw,4.2rem)] leading-[0.8]">{ZINS_TITLE}</h2>
              </BrutalCard>

              {ultimateWinner && (
                <BrutalCard tone="yellow" className="p-2">
                  <Sticker tone="red" className="-rotate-2">
                    TikTokeur du mois
                  </Sticker>
                  <p className="mt-2 text-[clamp(2.2rem,12vw,4rem)] font-black uppercase leading-[0.8]">
                    {ultimateWinner.target.avatar_emoji} {ultimateWinner.target.name}
                  </p>
                  <p className="mt-2 inline-flex border-4 border-black bg-black px-2 py-1 text-xs font-black uppercase text-white">
                    {ultimateWinner.points} points / {ultimateWinner.average.toFixed(1)} sur 5
                  </p>
                </BrutalCard>
              )}

              {categoryWinners.length === 0 ? (
                <BrutalCard tone="yellow" className="p-4 text-center">
                  <Trophy className="mx-auto mb-3 h-10 w-10" />
                  <p className="text-3xl font-black uppercase leading-none">Aucun zin.</p>
                </BrutalCard>
              ) : (
                categoryWinners.map(({ category, winner }, index) => {
                  const Icon = category.icon;
                  return (
                    <BrutalCard key={category.id} tone={index % 2 === 0 ? "paper" : "yellow"} className="p-2">
                      <p className="flex items-center gap-1 text-[10px] font-black uppercase text-[#e11d48]">
                        <Icon className="h-3.5 w-3.5" /> {category.label}
                      </p>
                      <p className="mt-1 text-[clamp(1.75rem,9vw,2.8rem)] font-black uppercase leading-[0.84]">
                        {winner.target.avatar_emoji} {winner.target.name}
                      </p>
                      <p className="mt-1 inline-flex border-4 border-black bg-[#e11d48] px-2 py-1 text-xs font-black uppercase text-white">
                        {winner.average.toFixed(1)} / 5 / {winner.votes} notes
                      </p>
                    </BrutalCard>
                  );
                })
              )}
            </motion.section>
          )}

          {tab === "bannis" && (
            <motion.section
              key="bannis"
              {...pageTransition}
              drag={reduceMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => handleSectionDrag(info)}
              transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }}
              className="space-y-2"
            >
              <BrutalCard tone="red" className="p-2">
                <h2 className="tabloid-headline text-[clamp(2.35rem,12vw,4.2rem)] leading-[0.8] text-white">{BANNIS_TITLE}</h2>
              </BrutalCard>

              {rejected.length === 0 ? (
                <BrutalCard className="p-4 text-center">
                  <ShieldAlert className="mx-auto mb-3 h-9 w-9" />
                  <p className="text-3xl font-black uppercase leading-none">Aucun banni.</p>
                </BrutalCard>
              ) : (
                rejected.map((dossier) => {
                  const rating = averageRating(dossier.ratings);
                  return (
                    <BrutalCard key={dossier.id} className="overflow-hidden">
                      <div className="grid grid-cols-[5.5rem_1fr]">
                        <div className="media-cut h-24 border-r-4 border-black">
                          <MediaFrame dossier={dossier} height="h-24" controls={false} />
                        </div>
                        <div className="min-w-0 p-2">
                          <OwnershipBadge owned={ownsDossier(dossier)} className="mb-1 -rotate-1" />
                          <span className={`inline-flex border-4 px-2 py-1 text-[10px] font-black uppercase ${statusClass("rejected")}`}>Banni</span>
                          <p className="mt-2 truncate text-lg font-black uppercase leading-none">
                            {dossier.tiktokeur.avatar_emoji} {dossier.tiktokeur.name}
                          </p>
                          <p className="mt-1 text-xs font-black uppercase">{rating ? rating.toFixed(1) : "-"} / 5 / {dossier.ratings.length} notes</p>
                          {ownsDossier(dossier) && (
                            <div className="mt-2 grid max-w-56 grid-cols-2 gap-1">
                              <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={() => startEditDossier(dossier)} className="owner-action bg-[#0ea5e9] text-white" type="button">
                                Modifier
                              </motion.button>
                              <motion.button whileTap={TAP_REBOUND} transition={TAP_TRANSITION} onClick={() => void removeDossier(dossier)} disabled={mutationBusyId === dossier.id} className="owner-action bg-zinc-700 text-white disabled:opacity-60" type="button">
                                Retirer
                              </motion.button>
                            </div>
                          )}
                        </div>
                      </div>
                    </BrutalCard>
                  );
                })
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {tab !== "studio" && (
        <motion.button
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          whileTap={TAP_REBOUND}
          transition={TAP_TRANSITION}
          onClick={() => switchTab("studio")}
          className="brutal-fab fixed right-5 z-40 flex h-16 w-16 items-center justify-center"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}
          aria-label="Lancer un dossier"
        >
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
              <motion.button
                key={item.id}
                whileTap={TAP_REBOUND}
                transition={TAP_TRANSITION}
                onClick={() => switchTab(item.id)}
                className={`relative flex flex-col items-center justify-center gap-1 border-4 border-black px-1 py-2 transition active:translate-x-0.5 active:translate-y-0.5 ${active ? "bg-[#e11d48] text-white" : "bg-[#f2efe3] text-black"}`}
              >
                <Icon className="relative z-10 h-5 w-5" strokeWidth={1.5} />
                <span className="relative z-10 text-[9px] font-black uppercase">{item.label}</span>
                {badge > 0 && (
                  <span className="absolute right-0 top-0 z-20 inline-flex h-5 min-w-[20px] items-center justify-center border-b-4 border-l-4 border-black bg-[#b5f42b] px-1 text-[9px] font-black text-black">
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
