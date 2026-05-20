"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import confetti from "canvas-confetti";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { AnimatePresence, motion, type PanInfo, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  Archive,
  BadgeCheck,
  Camera,
  Check,
  Clock3,
  Crown,
  Flame,
  Image as ImageIcon,
  Loader2,
  LogOut,
  Medal,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  UploadCloud,
  UserCircle,
  Video,
  X,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Role = "player_1" | "player_2";
type Tab = "feed" | "vote" | "studio" | "trophies" | "archive";
type NominationStatus = "pending" | "accepted" | "rejected";
type VerdictChoice = "nominee" | "ejected";
type ToastTone = "success" | "error" | "info";
type CategoryMood = "positive" | "critical" | "fun";
type MediaKind = "video" | "image";

type ToastState = { tone: ToastTone; message: string } | null;

type VoteValue = {
  rating: number;
  choice: VerdictChoice;
  voted_at: string;
};

type Votes = Partial<Record<Role, VoteValue>>;

type Nomination = {
  id: string;
  room_id: string;
  image_url: string;
  image_storage_path: string | null;
  video_url: string | null;
  video_storage_path: string | null;
  category_id: string;
  comment: string;
  submitted_by: Role;
  status: NominationStatus;
  votes: Votes;
  created_at: string;
};

type CategoryMeta = {
  id: string;
  label: string;
  mood: CategoryMood;
  icon: LucideIcon;
};

const ROLE_KEY = "nod_role";
const P1_NAME_KEY = "nod_p1name";
const P2_NAME_KEY = "nod_p2name";
const ROOM_CODE_KEY = "nod_room_code";
const DEFAULT_ROOM_CODE = "NOD-DUO";
const BUCKET_NAME = "nod-media";
const MAX_SOURCE_FILE_BYTES = 420 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 48 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 240;
const VIDEO_FPS = 24;
const VIDEO_BITRATE = 900_000;
const AUDIO_BITRATE = 64_000;
const STAR_VALUES = [1, 2, 3, 4, 5] as const;

const ROLE_LABEL: Record<Role, string> = {
  player_1: "Joueur 1",
  player_2: "Joueur 2"
};

const CATEGORIES: CategoryMeta[] = [
  { id: "moment_marquant", label: "Moment marquant", mood: "positive", icon: Sparkles },
  { id: "pepite_cachee", label: "Pepite cachee", mood: "positive", icon: Crown },
  { id: "style_remarquable", label: "Style remarquable", mood: "positive", icon: Trophy },
  { id: "replique_culte", label: "Replique culte", mood: "positive", icon: BadgeCheck },
  { id: "elan_creatif", label: "Elan creatif", mood: "positive", icon: Zap },
  { id: "malaise_public", label: "Malaise public", mood: "critical", icon: ShieldAlert },
  { id: "signal_alerte", label: "Signal d'alerte", mood: "critical", icon: ShieldAlert },
  { id: "derapage_leger", label: "Derapage leger", mood: "critical", icon: Flame },
  { id: "choix_discutable", label: "Choix discutable", mood: "critical", icon: Archive },
  { id: "silence_genant", label: "Silence genant", mood: "critical", icon: Clock3 },
  { id: "fou_rire", label: "Fou rire du mois", mood: "fun", icon: Sparkles },
  { id: "scene_improbable", label: "Scene improbable", mood: "fun", icon: Video },
  { id: "roue_libre", label: "Roue libre", mood: "fun", icon: Flame },
  { id: "performance_surprise", label: "Performance surprise", mood: "fun", icon: Trophy },
  { id: "voyage_express", label: "Voyage express", mood: "fun", icon: Camera }
];

const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((category) => [category.id, category])) as Record<string, CategoryMeta>;

const TAB_ITEMS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "feed", label: "Live", icon: Sparkles },
  { id: "vote", label: "Duel", icon: Zap },
  { id: "studio", label: "Studio", icon: Plus },
  { id: "trophies", label: "Trophees", icon: Crown },
  { id: "archive", label: "Archive", icon: ImageIcon }
];

const TAB_ORDER: Tab[] = TAB_ITEMS.map((item) => item.id);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRole(value: string | null): Role | null {
  if (value === "player_1" || value === "Joueur 1") return "player_1";
  if (value === "player_2" || value === "Joueur 2") return "player_2";
  return null;
}

function normalizeStatus(value: unknown): NominationStatus | null {
  if (value === "pending" || value === "accepted" || value === "rejected") return value;
  if (value === "arena") return "rejected";
  if (value === "resolved") return "accepted";
  return null;
}

function toText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toIntOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampRating(value: number) {
  return Math.min(5, Math.max(1, Math.round(value)));
}

function sanitizeRoomCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 24);
}

function parseVotes(value: unknown): Votes {
  if (!isRecord(value)) return {};

  return (["player_1", "player_2"] as const).reduce<Votes>((acc, role) => {
    const rawVote = value[role];
    if (!isRecord(rawVote)) return acc;

    const rating = toIntOrNull(rawVote.rating);
    const choice = rawVote.choice;
    if (rating === null || (choice !== "nominee" && choice !== "ejected")) return acc;

    acc[role] = {
      rating: clampRating(rating),
      choice,
      voted_at: toText(rawVote.voted_at, new Date().toISOString())
    };

    return acc;
  }, {});
}

function computeStatus(votes: Votes): NominationStatus {
  const p1 = votes.player_1;
  const p2 = votes.player_2;

  if (!p1 || !p2) return "pending";
  return p1.choice === "nominee" && p2.choice === "nominee" ? "accepted" : "rejected";
}

function averageRating(nomination: Nomination) {
  const ratings = Object.values(nomination.votes)
    .map((vote) => vote?.rating)
    .filter((rating): rating is number => typeof rating === "number");

  if (ratings.length === 0) return null;
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

function countdownToNextMonth() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const diffMs = Math.max(0, next.getTime() - now.getTime());
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return { days, hours, mins };
}

function getCategoryMeta(value: string): CategoryMeta {
  return CATEGORY_BY_ID[value] ?? { id: "custom", label: value || "Sans categorie", mood: "fun", icon: Archive };
}

function statusLabel(status: NominationStatus) {
  if (status === "accepted") return "Sacre";
  if (status === "rejected") return "Ejecte";
  return "A voter";
}

function statusClass(status: NominationStatus) {
  if (status === "accepted") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300";
  if (status === "rejected") return "border-red-400/30 bg-red-500/10 text-red-300";
  return "border-amber-400/30 bg-amber-500/10 text-amber-200";
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function parseNomination(row: Record<string, unknown>): Nomination {
  const votes = parseVotes(row.votes);
  const submittedBy = normalizeRole(toText(row.submitted_by)) ?? "player_1";

  return {
    id: toText(row.id, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    room_id: toText(row.room_id),
    image_url: toText(row.image_url),
    image_storage_path: toText(row.image_storage_path) || null,
    video_url: toText(row.video_url) || null,
    video_storage_path: toText(row.video_storage_path) || null,
    category_id: toText(row.category_id, toText(row.category, "moment_marquant")),
    comment: toText(row.comment),
    submitted_by: submittedBy,
    status: normalizeStatus(row.status) ?? computeStatus(votes),
    votes,
    created_at: toText(row.created_at, new Date().toISOString())
  };
}

function monthKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function extensionForMime(mimeType: string, fallback: string) {
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.includes("webm")) return "webm";
  return fallback;
}

function makeStoragePath(file: File, role: Role, folder: "videos" | "thumbnails") {
  const extension = extensionForMime(file.type, folder === "videos" ? "mp4" : "jpg");
  const base = role === "player_1" ? "p1" : "p2";
  const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${folder}/${monthKey()}/${base}_${nonce}.${extension}`;
}

function waitForMediaEvent(target: HTMLMediaElement, eventName: string, timeoutMs = 15000) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Lecture media impossible."));
    }, timeoutMs);

    const onEvent = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("Fichier media illisible."));
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
        else reject(new Error("Compression canvas impossible."));
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
    if (!context) throw new Error("Canvas indisponible.");

    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await canvasToBlob(canvas, "image/webp", 0.82);
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
    if (duration > MAX_VIDEO_SECONDS) {
      throw new Error(`Video trop longue: ${Math.round(duration)}s. Limite: 4 min.`);
    }

    const seekTo = duration > 1 ? Math.min(0.75, duration / 2) : 0;
    if (seekTo > 0) {
      video.currentTime = seekTo;
      await waitForMediaEvent(video, "seeked");
    } else if (!video.videoWidth) {
      await waitForMediaEvent(video, "loadeddata");
    }

    const size = scaledSize(video.videoWidth || 720, video.videoHeight || 1280, 1280, 720);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas indisponible.");

    context.drawImage(video, 0, 0, size.width, size.height);
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.84);
    const name = `${file.name.replace(/\.[^.]+$/, "") || "miniature"}.jpg`;
    return { thumbnail: new File([blob], name, { type: "image/jpeg" }), duration };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

function preferredVideoMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? null;
}

async function compressVideoToMobile(
  file: File,
  onProgress: (progress: number) => void
) {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("Compression video non supportee par ce navigateur.");
  }

  const mimeType = preferredVideoMimeType();
  if (!mimeType) {
    throw new Error("Aucun codec video compatible pour la compression.");
  }

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  let rafId = 0;

  try {
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;
    video.style.position = "fixed";
    video.style.pointerEvents = "none";
    video.style.opacity = "0";
    video.style.width = "1px";
    video.style.height = "1px";
    video.style.left = "-10px";
    video.style.top = "-10px";
    document.body.appendChild(video);
    video.load();

    await waitForMediaEvent(video, "loadedmetadata");

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration > MAX_VIDEO_SECONDS) {
      throw new Error(`Video trop longue: ${Math.round(duration)}s. Limite: 4 min.`);
    }

    const size = scaledSize(video.videoWidth || 720, video.videoHeight || 1280, 1280, 720);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas indisponible.");

    const stream = canvas.captureStream(VIDEO_FPS);
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: VIDEO_BITRATE,
      audioBitsPerSecond: AUDIO_BITRATE
    });
    const chunks: Blob[] = [];
    const stopped = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error("Compression video interrompue."));
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const finished = new Promise<void>((resolve) => {
      const draw = () => {
        context.drawImage(video, 0, 0, size.width, size.height);
        onProgress(duration > 0 ? Math.min(0.98, video.currentTime / duration) : 0.5);
        if (video.ended || video.currentTime >= duration) {
          resolve();
          return;
        }
        rafId = window.requestAnimationFrame(draw);
      };
      draw();
    });

    recorder.start(1000);
    await video.play();
    await finished;
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());

    const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
    if (blob.size === 0) throw new Error("Compression video vide.");

    const extension = extensionForMime(blob.type, "webm");
    const name = `${file.name.replace(/\.[^.]+$/, "") || "video"}-mobile.${extension}`;
    onProgress(1);
    return new File([blob], name, { type: blob.type });
  } finally {
    if (rafId) window.cancelAnimationFrame(rafId);
    video.pause();
    video.remove();
    URL.revokeObjectURL(objectUrl);
  }
}

function verdictLabel(choice: VerdictChoice) {
  return choice === "nominee" ? "Nomine" : "Ejecte";
}

function voteBurst(choice: VerdictChoice) {
  const colors = choice === "nominee" ? ["#d97706", "#fbbf24", "#22c55e", "#38bdf8"] : ["#ef4444", "#f97316", "#71717a"];
  const scalar = choice === "nominee" ? 1.15 : 0.85;

  void confetti({
    particleCount: choice === "nominee" ? 95 : 46,
    spread: choice === "nominee" ? 78 : 44,
    startVelocity: choice === "nominee" ? 42 : 28,
    scalar,
    colors,
    origin: { y: 0.72 },
    disableForReducedMotion: true
  });
}

function setUrl(urlSetter: (value: string | null) => void, currentUrl: string | null, nextFile: File | null) {
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  urlSetter(nextFile ? URL.createObjectURL(nextFile) : null);
}

function BentoCard({
  children,
  className = "",
  glow = "blue"
}: {
  children: ReactNode;
  className?: string;
  glow?: "blue" | "amber" | "green" | "pink";
}) {
  const glowMap = {
    blue: ["rgba(14,165,233,0.38)", "rgba(217,119,6,0.16)", "rgba(34,197,94,0.16)"],
    amber: ["rgba(217,119,6,0.42)", "rgba(250,204,21,0.22)", "rgba(14,165,233,0.12)"],
    green: ["rgba(34,197,94,0.32)", "rgba(14,165,233,0.18)", "rgba(217,119,6,0.14)"],
    pink: ["rgba(236,72,153,0.28)", "rgba(14,165,233,0.18)", "rgba(217,119,6,0.18)"]
  } satisfies Record<string, string[]>;
  const [a, b, c] = glowMap[glow];

  return (
    <motion.div
      whileTap={{ scale: 0.992 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className={`nod-bento rounded-lg ${className}`}
      style={{ "--glow-a": a, "--glow-b": b, "--glow-c": c } as CSSProperties}
    >
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
    <div className="flex items-center justify-between gap-1">
      {STAR_VALUES.map((star) => {
        const active = star <= (hover || value);
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onMouseEnter={() => !readonly && setHover(star)}
            onMouseLeave={() => !readonly && setHover(0)}
            onClick={() => onChange?.(star)}
            className="rounded-md p-1.5 transition duration-150 active:scale-90 disabled:cursor-default"
            aria-label={`${star} etoiles`}
          >
            <Star className={`${iconSizeClass} transition-colors ${active ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_10px_rgba(217,119,6,0.42)]" : "text-zinc-700"}`} />
          </button>
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
  if (nomination.video_url) {
    return (
      <video
        src={nomination.video_url}
        poster={nomination.image_url}
        controls={controls}
        playsInline
        preload="metadata"
        className={`${height} block w-full object-cover`}
      />
    );
  }

  return <img src={nomination.image_url} alt="" className={`${height} block w-full object-cover`} />;
}

function ParticleField() {
  return (
    <div className="nod-particles" aria-hidden="true">
      {Array.from({ length: 22 }).map((_, index) => (
        <span
          key={index}
          className="nod-particle"
          style={{
            left: `${(index * 37) % 100}%`,
            top: `${(index * 19) % 100}%`,
            animationDelay: `${(index % 7) * 0.55}s`,
            animationDuration: `${6 + (index % 5)}s`
          }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const blueGlowY = useTransform(scrollY, [0, 900], [0, -70]);
  const amberGlowY = useTransform(scrollY, [0, 900], [0, 55]);
  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseBrowserClient>>(null);
  const [bootingRole, setBootingRole] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState(DEFAULT_ROOM_CODE);
  const [p1Name, setP1Name] = useState("Joueur 1");
  const [p2Name, setP2Name] = useState("Joueur 2");
  const [editingName, setEditingName] = useState<"p1" | "p2" | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  const [tab, setTab] = useState<Tab>("feed");
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const [toast, setToast] = useState<ToastState>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const [countdown, setCountdown] = useState(countdownToNextMonth);

  const [sourceFileName, setSourceFileName] = useState("");
  const [preparedFile, setPreparedFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [mediaKind, setMediaKind] = useState<MediaKind | null>(null);
  const [previewUrl, setPreviewUrlState] = useState<string | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrlState] = useState<string | null>(null);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [compressionNote, setCompressionNote] = useState("");
  const [isPreparingMedia, setIsPreparingMedia] = useState(false);
  const [catId, setCatId] = useState(CATEGORIES[0].id);
  const [comment, setComment] = useState("");
  const [initialRating, setInitialRating] = useState(4);
  const [uploadLoading, setUploadLoading] = useState(false);

  const [ratingDraftById, setRatingDraftById] = useState<Record<string, number>>({});
  const [voteBusyId, setVoteBusyId] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const myDisplayName = role === "player_1" ? p1Name : p2Name;
  const otherDisplayName = role === "player_1" ? p2Name : p1Name;

  const showToast = useCallback((tone: ToastTone, message: string) => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    setToast({ tone, message });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 2800);
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
      setRole(normalizeRole(localStorage.getItem(ROLE_KEY)));
      setP1Name(localStorage.getItem(P1_NAME_KEY) || "Joueur 1");
      setP2Name(localStorage.getItem(P2_NAME_KEY) || "Joueur 2");
      setRoomCode(sanitizeRoomCode(localStorage.getItem(ROOM_CODE_KEY) || DEFAULT_ROOM_CODE) || DEFAULT_ROOM_CODE);
    } finally {
      setBootingRole(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown(countdownToNextMonth());
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
    setSourceFileName("");
    setCompressionProgress(0);
    setCompressionNote("");
    setUrl(setPreviewUrlState, previewUrl, null);
    setUrl(setThumbnailPreviewUrlState, thumbnailPreviewUrl, null);
  }, [previewUrl, thumbnailPreviewUrl]);

  const ensureRoom = useCallback(async () => {
    if (!supabase) return null;

    const cleanCode = sanitizeRoomCode(roomCode) || DEFAULT_ROOM_CODE;
    localStorage.setItem(ROOM_CODE_KEY, cleanCode);
    setRoomCode(cleanCode);

    const { data, error } = await supabase
      .from("rooms")
      .upsert(
        {
          code: cleanCode,
          player1_label: p1Name,
          player2_label: p2Name
        },
        { onConflict: "code" }
      )
      .select("id,player1_label,player2_label")
      .single();

    if (error) throw error;

    const nextRoomId = toText(data?.id);
    if (nextRoomId) setRoomId(nextRoomId);
    if (typeof data?.player1_label === "string") setP1Name(data.player1_label);
    if (typeof data?.player2_label === "string") setP2Name(data.player2_label);

    return nextRoomId || null;
  }, [p1Name, p2Name, roomCode, supabase]);

  const fetchNominations = useCallback(
    async (silent = false, forcedRoomId?: string | null) => {
      const activeRoomId = forcedRoomId ?? roomId;
      if (!supabase || !activeRoomId) return;

      if (!silent) setLoadingList(true);
      setSyncing(true);

      try {
        const { data, error } = await supabase
          .from("nominations")
          .select("id,room_id,image_url,image_storage_path,video_url,video_storage_path,category_id,comment,submitted_by,status,votes,created_at")
          .eq("room_id", activeRoomId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const rows = ((data ?? []) as Record<string, unknown>[]).map(parseNomination);
        setNominations(rows);
        setLastSyncAt(new Date());
      } catch (err) {
        if (!silent) {
          const message = err instanceof Error ? err.message : "Sync impossible.";
          showToast("error", message);
        }
      } finally {
        setSyncing(false);
        if (!silent) setLoadingList(false);
      }
    },
    [roomId, showToast, supabase]
  );

  useEffect(() => {
    if (!role || !supabase) return;

    let cancelled = false;

    void (async () => {
      try {
        const activeRoomId = await ensureRoom();
        if (!cancelled && activeRoomId) {
          await fetchNominations(false, activeRoomId);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Salon inaccessible.";
        showToast("error", message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ensureRoom, fetchNominations, role, showToast, supabase]);

  useEffect(() => {
    if (!role || !supabase || !roomId) return;

    const poll = window.setInterval(() => {
      void fetchNominations(true);
    }, 20000);

    const channel = supabase
      .channel(`nod_realtime_${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "nominations" }, () => {
        void fetchNominations(true);
      })
      .subscribe();

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [fetchNominations, role, roomId, supabase]);

  const pendingForMe = useMemo(() => {
    if (!role) return [];
    return nominations.filter((nomination) => nomination.status === "pending" && !nomination.votes[role]);
  }, [nominations, role]);

  const archive = useMemo(() => {
    const data = nominations.filter((nomination) => nomination.status === "accepted" || nomination.status === "rejected");
    return data.sort((a, b) => (averageRating(b) ?? 0) - (averageRating(a) ?? 0));
  }, [nominations]);

  const accepted = useMemo(() => archive.filter((nomination) => nomination.status === "accepted"), [archive]);
  const feedItems = useMemo(() => nominations.slice(0, 8), [nominations]);

  const categoryWinners = useMemo(() => {
    return CATEGORIES.map((category) => {
      const inCategory = accepted.filter((nomination) => nomination.category_id === category.id);
      if (inCategory.length === 0) return null;
      const winner = [...inCategory].sort((a, b) => (averageRating(b) ?? 0) - (averageRating(a) ?? 0))[0];
      return { category, winner };
    }).filter(Boolean) as Array<{ category: CategoryMeta; winner: Nomination }>;
  }, [accepted]);

  const heroWinner = categoryWinners[0]?.winner ?? accepted[0] ?? nominations[0] ?? null;
  const lastSyncLabel = lastSyncAt ? lastSyncAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--";
  const progressTotal = pendingForMe.length + archive.length;
  const progressDone = progressTotal === 0 ? 0 : Math.round((archive.length / progressTotal) * 100);
  const uploadReady = Boolean(preparedFile && comment.trim().length >= 3 && !isPreparingMedia);

  const pageTransition = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : { initial: { opacity: 0, y: 14, scale: 0.992 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: -10, scale: 0.992 } };

  const handleSectionDrag = useCallback(
    (info: PanInfo) => {
      if (Math.abs(info.offset.x) < 90) return;
      const currentIndex = TAB_ORDER.indexOf(tab);
      const nextIndex = info.offset.x < 0 ? currentIndex + 1 : currentIndex - 1;
      const nextTab = TAB_ORDER[nextIndex];
      if (nextTab) setTab(nextTab);
    },
    [tab]
  );

  const selectRole = (selected: Role) => {
    const cleanCode = sanitizeRoomCode(roomCode) || DEFAULT_ROOM_CODE;
    localStorage.setItem(ROOM_CODE_KEY, cleanCode);
    localStorage.setItem(ROLE_KEY, selected);
    setRoomCode(cleanCode);
    setRole(selected);
    showToast("success", `${ROLE_LABEL[selected]} actif sur cet appareil.`);
  };

  const logout = () => {
    localStorage.removeItem(ROLE_KEY);
    setRole(null);
    setRoomId(null);
    setTab("feed");
  };

  const openNameEditor = () => {
    if (!role) return;
    setEditingName(role === "player_1" ? "p1" : "p2");
    setNameDraft(myDisplayName);
  };

  const saveName = async () => {
    const cleaned = nameDraft.trim().slice(0, 20);
    if (!cleaned || !editingName) return;

    const patch = editingName === "p1" ? { player1_label: cleaned } : { player2_label: cleaned };

    if (editingName === "p1") {
      localStorage.setItem(P1_NAME_KEY, cleaned);
      setP1Name(cleaned);
    } else {
      localStorage.setItem(P2_NAME_KEY, cleaned);
      setP2Name(cleaned);
    }

    setEditingName(null);
    showToast("success", "Pseudo mis a jour.");

    if (supabase && roomId) {
      await supabase.from("rooms").update(patch).eq("id", roomId);
    }
  };

  const prepareMedia = async (nextFile: File | null) => {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("video/") && !nextFile.type.startsWith("image/")) {
      showToast("error", "Choisis une video ou une capture.");
      return;
    }
    if (nextFile.size > MAX_SOURCE_FILE_BYTES) {
      showToast("error", "Fichier source trop lourd.");
      return;
    }

    setIsPreparingMedia(true);
    setCompressionProgress(0);
    setCompressionNote("");
    clearPreparedMedia();
    setSourceFileName(nextFile.name);

    try {
      if (nextFile.type.startsWith("image/")) {
        const compressed = await compressImageToWebp(nextFile);
        if (compressed.size > MAX_UPLOAD_BYTES) throw new Error("Capture encore trop lourde apres compression.");
        setPreparedFile(compressed);
        setThumbnailFile(compressed);
        setMediaKind("image");
        setUrl(setPreviewUrlState, null, compressed);
        setUrl(setThumbnailPreviewUrlState, null, compressed);
        setCompressionProgress(1);
        setCompressionNote(`Capture WebP: ${formatBytes(nextFile.size)} -> ${formatBytes(compressed.size)}`);
        showToast("success", "Capture optimisee.");
        return;
      }

      const { thumbnail } = await extractVideoThumbnail(nextFile);
      setThumbnailFile(thumbnail);
      setUrl(setThumbnailPreviewUrlState, null, thumbnail);

      const compressed = await compressVideoToMobile(nextFile, setCompressionProgress);
      if (compressed.size > MAX_UPLOAD_BYTES) {
        throw new Error(`Video optimisee encore trop lourde (${formatBytes(compressed.size)}).`);
      }

      setPreparedFile(compressed);
      setMediaKind("video");
      setUrl(setPreviewUrlState, null, compressed);
      setCompressionNote(`Video mobile: ${formatBytes(nextFile.size)} -> ${formatBytes(compressed.size)}`);
      showToast("success", "Video compressee.");
    } catch (err) {
      clearPreparedMedia();
      const message = err instanceof Error ? err.message : "Media impossible a preparer.";
      showToast("error", message);
    } finally {
      setIsPreparingMedia(false);
    }
  };

  const uploadNomination = async () => {
    if (!role || !supabase) {
      showToast("error", "Configure Supabase avant l'envoi.");
      return;
    }

    const cleanedComment = comment.trim();
    if (!preparedFile || !thumbnailFile || !mediaKind || cleanedComment.length < 3) {
      showToast("error", "Ajoute un media et une note valide.");
      return;
    }

    setUploadLoading(true);
    const uploadedPaths: string[] = [];

    try {
      const activeRoomId = roomId ?? (await ensureRoom());
      if (!activeRoomId) throw new Error("Salon introuvable.");

      let imagePath: string;
      let imageUrl: string;
      let videoPath: string | null = null;
      let videoUrl: string | null = null;

      if (mediaKind === "video") {
        videoPath = makeStoragePath(preparedFile, role, "videos");
        const { error: videoUploadError } = await supabase.storage.from(BUCKET_NAME).upload(videoPath, preparedFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: preparedFile.type || "video/webm"
        });
        if (videoUploadError) throw videoUploadError;
        uploadedPaths.push(videoPath);

        imagePath = makeStoragePath(thumbnailFile, role, "thumbnails");
        const { error: thumbnailUploadError } = await supabase.storage.from(BUCKET_NAME).upload(imagePath, thumbnailFile, {
          cacheControl: "31536000",
          upsert: false,
          contentType: thumbnailFile.type || "image/jpeg"
        });
        if (thumbnailUploadError) throw thumbnailUploadError;
        uploadedPaths.push(imagePath);

        const {
          data: { publicUrl }
        } = supabase.storage.from(BUCKET_NAME).getPublicUrl(videoPath);
        videoUrl = publicUrl;
      } else {
        imagePath = makeStoragePath(preparedFile, role, "thumbnails");
        const { error: imageUploadError } = await supabase.storage.from(BUCKET_NAME).upload(imagePath, preparedFile, {
          cacheControl: "31536000",
          upsert: false,
          contentType: preparedFile.type || "image/webp"
        });
        if (imageUploadError) throw imageUploadError;
        uploadedPaths.push(imagePath);
      }

      const {
        data: { publicUrl: resolvedImageUrl }
      } = supabase.storage.from(BUCKET_NAME).getPublicUrl(imagePath);
      imageUrl = resolvedImageUrl;

      const starterVote: VoteValue = {
        rating: clampRating(initialRating),
        choice: initialRating >= 3 ? "nominee" : "ejected",
        voted_at: new Date().toISOString()
      };
      const votes: Votes = { [role]: starterVote };

      const { error: insertError } = await supabase.from("nominations").insert({
        room_id: activeRoomId,
        image_url: imageUrl,
        image_storage_path: imagePath,
        video_url: videoUrl,
        video_storage_path: videoPath,
        category_id: catId,
        comment: cleanedComment,
        submitted_by: role,
        votes,
        status: computeStatus(votes)
      });

      if (insertError) throw insertError;

      showToast("success", "Profil envoye au duel.");
      clearPreparedMedia();
      setComment("");
      setInitialRating(4);
      setCatId(CATEGORIES[0].id);
      setTab("vote");
      void fetchNominations(true, activeRoomId);
    } catch (err) {
      if (uploadedPaths.length > 0 && supabase) {
        await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths);
      }
      const message = err instanceof Error ? err.message : "Echec de l'envoi.";
      showToast("error", message);
    } finally {
      setUploadLoading(false);
    }
  };

  const applyVote = async (id: string, choice: VerdictChoice) => {
    if (!role || !supabase || voteBusyId) return;

    const nomination = nominations.find((item) => item.id === id);
    if (!nomination) return;

    const draft = clampRating(ratingDraftById[id] ?? 4);
    const finalRating = choice === "nominee" ? Math.max(3, draft) : Math.min(2, draft);
    const nextVotes: Votes = {
      ...nomination.votes,
      [role]: {
        rating: finalRating,
        choice,
        voted_at: new Date().toISOString()
      }
    };
    const nextStatus = computeStatus(nextVotes);

    setVoteBusyId(id);

    try {
      const { error } = await supabase.from("nominations").update({ votes: nextVotes, status: nextStatus }).eq("id", id);
      if (error) throw error;

      setRatingDraftById((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      voteBurst(choice);
      showToast("success", nextStatus === "accepted" ? "Profil sacre." : "Profil ejecte.");
      void fetchNominations(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible de voter.";
      showToast("error", message);
    } finally {
      setVoteBusyId(null);
    }
  };

  const deleteNomination = async (id: string) => {
    if (!supabase || deleteBusyId) return;

    const nomination = nominations.find((item) => item.id === id);
    const confirmed = window.confirm("Supprimer ce profil ?");
    if (!confirmed) return;

    setDeleteBusyId(id);

    try {
      const storagePaths = [nomination?.video_storage_path, nomination?.image_storage_path].filter((path): path is string => Boolean(path));
      if (storagePaths.length > 0) {
        await supabase.storage.from(BUCKET_NAME).remove(storagePaths);
      }

      const { error } = await supabase.from("nominations").delete().eq("id", id);
      if (error) throw error;

      showToast("info", "Profil supprime.");
      void fetchNominations(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Suppression impossible.";
      showToast("error", message);
    } finally {
      setDeleteBusyId(null);
    }
  };

  if (bootingRole) {
    return (
      <div className="nod-app flex items-center justify-center text-zinc-300">
        <ParticleField />
        <BentoCard className="flex h-16 w-16 items-center justify-center" glow="amber">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
        </BentoCard>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="nod-app text-white">
        <ParticleField />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none fixed -right-32 top-16 z-0 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl"
          style={{ y: blueGlowY }}
        />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none fixed -left-28 bottom-20 z-0 h-80 w-80 rounded-full bg-amber-600/20 blur-3xl"
          style={{ y: amberGlowY }}
        />
        <motion.div
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.38, type: "spring", stiffness: 180, damping: 24 }}
          className="nod-viewport flex min-h-screen flex-col justify-center"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          <div className="mb-6">
            <div className="nod-chip mb-5 inline-flex h-12 items-center gap-2 rounded-lg px-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500 text-xs font-black text-black">N</span>
              <span className="nod-eyebrow">Cérémonie TikTok</span>
            </div>
            <h1 className="nod-title max-w-[12ch] text-5xl">Nominees or Denominees</h1>
            <p className="nod-copy mt-4 text-sm leading-6">Un duel prive pour sacrer ou ejecter les profils les plus memorables du mois.</p>
          </div>

          <BentoCard className="mb-4 p-4" glow="blue">
            <label className="block">
              <span className="nod-eyebrow mb-2 block text-zinc-500">Code salon</span>
              <input
                value={roomCode}
                onChange={(event) => setRoomCode(sanitizeRoomCode(event.target.value))}
                maxLength={24}
                className="nod-input w-full rounded-lg px-4 py-3 text-sm font-black uppercase tracking-[0.14em]"
              />
            </label>
          </BentoCard>

          {!supabase && (
            <div className="mb-4 rounded-lg border border-amber-700/50 bg-amber-950/20 p-3 text-xs leading-5 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              Variables Supabase manquantes. L&apos;interface charge, mais la sync attend la configuration.
            </div>
          )}

          <div className="space-y-3">
            {(["player_1", "player_2"] as const).map((item, index) => (
              <button key={item} onClick={() => selectRole(item)} className="w-full text-left">
                <BentoCard className="flex items-center justify-between p-5" glow={index === 0 ? "amber" : "green"}>
                  <span>
                    <span className="block text-lg font-black text-white">{item === "player_1" ? p1Name : p2Name}</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">{ROLE_LABEL[item]}</span>
                  </span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.055]">
                    <UserCircle className="h-6 w-6 text-zinc-200" />
                  </span>
                </BentoCard>
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="nod-app text-zinc-100" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)" }}>
      <ParticleField />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed -right-36 top-14 z-0 h-80 w-80 rounded-full bg-sky-500/18 blur-3xl"
        style={{ y: blueGlowY }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed -left-40 top-1/2 z-0 h-96 w-96 rounded-full bg-amber-600/16 blur-3xl"
        style={{ y: amberGlowY }}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed left-1/2 z-[100] w-[92%] max-w-sm -translate-x-1/2"
            style={{ top: "calc(env(safe-area-inset-top) + 10px)" }}
          >
            <div
              className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl ${
                toast.tone === "success"
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                  : toast.tone === "error"
                    ? "border-red-400/30 bg-red-500/10 text-red-300"
                    : "border-zinc-700 bg-zinc-950/90 text-zinc-100"
              }`}
            >
              {toast.tone === "success" ? <Check className="h-4 w-4" /> : toast.tone === "error" ? <ShieldAlert className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              <span>{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="nod-viewport" style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}>
        <header className="sticky top-0 z-30 mb-4 py-3">
          <BentoCard className="flex items-center justify-between px-3 py-3" glow="blue">
            <button onClick={openNameEditor} className="min-w-0 text-left">
              <p className="nod-eyebrow">Session active</p>
              <p className="truncate text-base font-black text-white">
                {myDisplayName} <Pencil className="mb-0.5 ml-1 inline h-3.5 w-3.5 text-zinc-500" />
              </p>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void fetchNominations()}
                disabled={syncing || !supabase}
                className="nod-btn-quiet rounded-lg p-2.5 transition active:scale-95 disabled:opacity-60"
                aria-label="Synchroniser"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              </button>
              <button onClick={logout} className="nod-btn-quiet rounded-lg p-2.5 transition active:scale-95" aria-label="Quitter">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </BentoCard>
        </header>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <BentoCard className="p-3" glow="amber">
            <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">Cérémonie</p>
            <p className="text-sm font-black text-white">
              {countdown.days}j {countdown.hours}h {countdown.mins}m
            </p>
          </BentoCard>
          <BentoCard className="p-3" glow="blue">
            <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">A voter</p>
            <p className="text-xl font-black text-sky-300">{pendingForMe.length}</p>
          </BentoCard>
          <BentoCard className="p-3" glow="green">
            <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">Sacres</p>
            <p className="text-xl font-black text-emerald-300">{accepted.length}</p>
          </BentoCard>
        </div>

        <AnimatePresence mode="wait">
          {tab === "feed" && (
            <motion.section
              key="feed"
              {...pageTransition}
              drag={reduceMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => handleSectionDrag(info)}
              transition={{ duration: reduceMotion ? 0.01 : 0.28, type: "spring", stiffness: 230, damping: 26 }}
              className="space-y-4"
            >
              <BentoCard className="overflow-hidden" glow="amber">
                <div className="relative">
                  {heroWinner ? (
                    <div className="nod-media-shell">
                      <MediaFrame nomination={heroWinner} height="h-[22rem]" controls={false} />
                    </div>
                  ) : (
                    <div className="flex h-[22rem] items-center justify-center">
                      <Sparkles className="h-10 w-10 text-zinc-700" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 z-10 p-5">
                    <p className="nod-eyebrow">Flux premium</p>
                    <h2 className="nod-title mt-2 text-4xl text-white">Cérémonie TikTok</h2>
                    <p className="mt-3 text-sm leading-6 text-zinc-300">Upload, duel express, classement mensuel. Aucun debat, juste du verdict.</p>
                  </div>
                </div>
              </BentoCard>

              <div className="grid grid-cols-2 gap-3">
                <BentoCard className="p-4" glow="blue">
                  <p className="nod-eyebrow">Progression</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div
                      className="h-full rounded-full bg-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.45)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressDone}%` }}
                      transition={{ duration: reduceMotion ? 0.01 : 0.55, ease: "easeOut" }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">Sync {lastSyncLabel}</p>
                </BentoCard>
                <button onClick={() => setTab("studio")} className="text-left">
                  <BentoCard className="flex h-full flex-col justify-between p-4" glow="green">
                    <UploadCloud className="h-6 w-6 text-emerald-300" />
                    <div>
                      <p className="text-lg font-black text-white">Studio</p>
                      <p className="text-xs text-zinc-500">Video 4 min ou capture</p>
                    </div>
                  </BentoCard>
                </button>
              </div>

              <div className="space-y-3">
                {feedItems.length === 0 ? (
                  <BentoCard className="p-8 text-center" glow="blue">
                    <Camera className="mx-auto mb-3 h-8 w-8 text-zinc-500" />
                    <p className="font-semibold text-zinc-200">Aucun profil pour le moment.</p>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">Le premier upload lance la cérémonie.</p>
                  </BentoCard>
                ) : (
                  feedItems.map((nomination) => {
                    const category = getCategoryMeta(nomination.category_id);
                    const Icon = category.icon;
                    return (
                      <BentoCard key={nomination.id} className="overflow-hidden" glow={nomination.status === "accepted" ? "green" : nomination.status === "pending" ? "blue" : "pink"}>
                        <div className="flex gap-3 p-2">
                          <div className="nod-media-shell h-24 w-24 shrink-0 rounded-md">
                            <MediaFrame nomination={nomination} height="h-24" controls={false} />
                          </div>
                          <div className="min-w-0 flex-1 py-1 pr-2">
                            <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusClass(nomination.status)}`}>
                              {statusLabel(nomination.status)}
                            </span>
                            <p className="mt-2 truncate text-sm font-semibold text-white">&quot;{nomination.comment}&quot;</p>
                            <p className="mt-2 flex items-center gap-1 text-[11px] text-zinc-500">
                              <Icon className="h-3.5 w-3.5 text-amber-400" /> {category.label}
                            </p>
                          </div>
                        </div>
                      </BentoCard>
                    );
                  })
                )}
              </div>
            </motion.section>
          )}

          {tab === "vote" && (
            <motion.section
              key="vote"
              {...pageTransition}
              drag={reduceMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => handleSectionDrag(info)}
              transition={{ duration: reduceMotion ? 0.01 : 0.28, type: "spring", stiffness: 230, damping: 26 }}
              className="space-y-4"
            >
              {loadingList ? (
                <BentoCard className="p-8 text-center" glow="blue">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-amber-500" />
                </BentoCard>
              ) : pendingForMe.length === 0 ? (
                <BentoCard className="p-8 text-center" glow="green">
                  <BadgeCheck className="mx-auto mb-3 h-9 w-9 text-emerald-300" />
                  <p className="font-semibold text-zinc-200">Aucun duel en attente.</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">Demande a {otherDisplayName} d&apos;envoyer un profil.</p>
                </BentoCard>
              ) : (
                pendingForMe.map((nomination) => {
                  const category = getCategoryMeta(nomination.category_id);
                  const Icon = category.icon;
                  const draftRating = clampRating(ratingDraftById[nomination.id] ?? 4);

                  return (
                    <BentoCard key={nomination.id} className="overflow-hidden" glow="amber">
                      <div className="relative">
                        <div className="nod-media-shell">
                          <MediaFrame nomination={nomination} height="h-[25rem]" />
                        </div>
                        <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-md border border-white/10 bg-black/55 px-3 py-1 text-xs font-black text-white backdrop-blur-xl">
                          <Icon className="h-3.5 w-3.5 text-amber-400" />
                          {category.label}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 z-10 p-4">
                          <p className="text-sm font-semibold text-white">&quot;{nomination.comment}&quot;</p>
                        </div>
                      </div>
                      <div className="space-y-4 p-4">
                        <StarInput value={draftRating} onChange={(value) => setRatingDraftById((prev) => ({ ...prev, [nomination.id]: value }))} size="lg" />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => void applyVote(nomination.id, "nominee")}
                            disabled={voteBusyId === nomination.id}
                            className="rounded-lg border border-emerald-400/25 bg-emerald-500/12 py-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition active:scale-[0.99] disabled:opacity-60"
                          >
                            Nominer
                          </button>
                          <button
                            onClick={() => void applyVote(nomination.id, "ejected")}
                            disabled={voteBusyId === nomination.id}
                            className="rounded-lg border border-red-400/25 bg-red-500/12 py-3 text-xs font-black uppercase tracking-[0.14em] text-red-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition active:scale-[0.99] disabled:opacity-60"
                          >
                            Ejecter
                          </button>
                        </div>
                      </div>
                    </BentoCard>
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
              transition={{ duration: reduceMotion ? 0.01 : 0.28, type: "spring", stiffness: 230, damping: 26 }}
              className="space-y-4"
            >
              <BentoCard className="p-5" glow="blue">
                <p className="nod-eyebrow">Studio upload</p>
                <h2 className="nod-title mt-2 text-3xl text-white">Capture le moment.</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">Video jusqu&apos;a 4 min, capture TikTok Live ou photo. Compression locale avant Supabase.</p>
              </BentoCard>

              <BentoCard className="p-3" glow={mediaKind === "video" ? "amber" : "green"}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPreparingMedia || uploadLoading}
                  className="relative flex min-h-[18rem] w-full items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/35 text-left transition active:scale-[0.995] disabled:opacity-70"
                >
                  {previewUrl ? (
                    mediaKind === "video" ? (
                      <video src={previewUrl} poster={thumbnailPreviewUrl ?? undefined} className="absolute inset-0 h-full w-full object-cover" controls playsInline muted preload="metadata" />
                    ) : (
                      <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    )
                  ) : (
                    <span className="flex flex-col items-center px-6 text-center">
                      {isPreparingMedia ? <Loader2 className="mb-3 h-8 w-8 animate-spin text-amber-500" /> : <UploadCloud className="mb-3 h-8 w-8 text-zinc-500" />}
                      <span className="text-sm font-black uppercase tracking-[0.16em] text-zinc-300">{isPreparingMedia ? "Compression..." : "Choisir un media"}</span>
                      <span className="mt-2 text-xs leading-5 text-zinc-500">Video, photo ou capture d&apos;ecran</span>
                    </span>
                  )}
                  <input ref={fileInputRef} type="file" accept="video/*,image/*" onChange={(event) => void prepareMedia(event.target.files?.[0] ?? null)} className="hidden" />
                </button>
              </BentoCard>

              {(isPreparingMedia || compressionNote) && (
                <BentoCard className="p-4" glow="amber">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400">{sourceFileName || "Media"}</p>
                      <p className="mt-1 truncate text-xs text-zinc-500">{compressionNote || "Compression mobile 720p en cours..."}</p>
                    </div>
                    <p className="text-sm font-black text-amber-300">{Math.round(compressionProgress * 100)}%</p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div className="h-full rounded-full bg-amber-500" animate={{ width: `${Math.round(compressionProgress * 100)}%` }} />
                  </div>
                </BentoCard>
              )}

              <select value={catId} onChange={(event) => setCatId(event.target.value)} className="nod-input w-full rounded-lg p-4 text-sm font-semibold">
                {CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>

              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Pourquoi ce profil merite un verdict ?"
                rows={3}
                maxLength={240}
                className="nod-input w-full resize-none rounded-lg p-4 text-sm"
              />

              <BentoCard className="p-3" glow="green">
                <StarInput value={initialRating} onChange={setInitialRating} size="lg" />
                <p className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                  Vote initial: {verdictLabel(initialRating >= 3 ? "nominee" : "ejected")}
                </p>
              </BentoCard>

              <button
                onClick={() => void uploadNomination()}
                disabled={uploadLoading || !uploadReady}
                className="nod-btn-primary flex w-full items-center justify-center gap-2 rounded-lg py-4 text-sm font-black uppercase tracking-[0.16em] disabled:opacity-50"
              >
                {uploadLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Envoyer au duel"}
              </button>
            </motion.section>
          )}

          {tab === "trophies" && (
            <motion.section
              key="trophies"
              {...pageTransition}
              drag={reduceMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => handleSectionDrag(info)}
              transition={{ duration: reduceMotion ? 0.01 : 0.28, type: "spring", stiffness: 230, damping: 26 }}
              className="space-y-4"
            >
              <BentoCard className="p-5 text-center" glow="amber">
                <Medal className="mx-auto h-9 w-9 text-amber-400" />
                <h2 className="nod-title mt-3 text-3xl text-white">Trophees du mois</h2>
                <p className="mt-3 text-sm text-zinc-500">Revelation automatique le 1er.</p>
              </BentoCard>
              {categoryWinners.length === 0 ? (
                <BentoCard className="p-8 text-center" glow="blue">
                  <Trophy className="mx-auto mb-3 h-8 w-8 text-zinc-500" />
                  <p className="font-semibold text-zinc-200">Aucun profil sacre.</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">Deux votes Nomine ouvrent le palmares.</p>
                </BentoCard>
              ) : (
                categoryWinners.map(({ category, winner }, index) => {
                  const Icon = category.icon;
                  return (
                    <BentoCard key={winner.id} className="flex gap-3 p-3" glow={index % 2 === 0 ? "amber" : "green"}>
                      <div className="nod-media-shell h-24 w-24 shrink-0 rounded-md">
                        <MediaFrame nomination={winner} height="h-24" controls={false} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-400">
                          <Icon className="h-3.5 w-3.5" /> {category.label}
                        </p>
                        <p className="mt-2 truncate text-sm font-semibold text-white">&quot;{winner.comment}&quot;</p>
                        <p className="mt-2 text-xs text-zinc-500">{averageRating(winner)?.toFixed(1)} / 5</p>
                      </div>
                    </BentoCard>
                  );
                })
              )}
            </motion.section>
          )}

          {tab === "archive" && (
            <motion.section
              key="archive"
              {...pageTransition}
              drag={reduceMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => handleSectionDrag(info)}
              transition={{ duration: reduceMotion ? 0.01 : 0.28, type: "spring", stiffness: 230, damping: 26 }}
              className="space-y-3"
            >
              {archive.length === 0 ? (
                <BentoCard className="p-8 text-center" glow="blue">
                  <ImageIcon className="mx-auto mb-3 h-8 w-8 text-zinc-500" />
                  <p className="font-semibold text-zinc-200">Archive vide.</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">Les videos seront purgees, les miniatures restent.</p>
                </BentoCard>
              ) : (
                archive.map((nomination) => {
                  const rating = averageRating(nomination);
                  return (
                    <BentoCard key={nomination.id} className="flex gap-3 p-2" glow={nomination.status === "accepted" ? "green" : "pink"}>
                      <div className="nod-media-shell h-20 w-20 shrink-0 rounded-md">
                        <MediaFrame nomination={nomination} height="h-20" controls={false} />
                      </div>
                      <div className="min-w-0 flex-1 py-1">
                        <span className={`mb-2 inline-flex rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusClass(nomination.status)}`}>
                          {statusLabel(nomination.status)}
                        </span>
                        <p className="truncate text-xs font-semibold text-zinc-100">&quot;{nomination.comment}&quot;</p>
                        <p className="mt-1 text-[11px] text-zinc-500">{rating ? rating.toFixed(1) : "-"} / 5</p>
                      </div>
                      <button onClick={() => void deleteNomination(nomination.id)} className="rounded-md p-2 text-zinc-500 transition hover:text-zinc-300 active:scale-95" aria-label="Supprimer">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </BentoCard>
                  );
                })
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {tab !== "studio" && (
        <motion.button
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          onClick={() => setTab("studio")}
          className="nod-btn-primary fixed right-5 z-40 flex h-14 w-14 items-center justify-center rounded-lg active:scale-95"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}
          aria-label="Ajouter"
        >
          <Plus className="h-6 w-6" />
        </motion.button>
      )}

      <AnimatePresence>
        {editingName && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-5 backdrop-blur-md">
            <BentoCard className="w-full max-w-sm p-5" glow="amber">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-black text-white">Changer de pseudo</h3>
                <button onClick={() => setEditingName(null)} className="nod-btn-quiet rounded-lg p-2 text-zinc-300" aria-label="Fermer">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <input
                autoFocus
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                maxLength={20}
                className="nod-input mb-4 w-full rounded-lg px-3 py-3 text-sm font-semibold"
              />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setEditingName(null)} className="nod-btn-quiet rounded-lg py-3 text-sm font-semibold text-zinc-400">
                  Annuler
                </button>
                <button onClick={() => void saveName()} className="nod-btn-primary min-h-0 rounded-lg py-3 text-sm font-black text-black">
                  Valider
                </button>
              </div>
            </BentoCard>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="nod-bottom-nav fixed bottom-0 left-0 right-0 z-40 px-2 pt-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}>
        <div className="mx-auto grid w-full max-w-md grid-cols-5 gap-1">
          {TAB_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            const badge = item.id === "vote" ? pendingForMe.length : 0;

            return (
              <button key={item.id} onClick={() => setTab(item.id)} className="relative flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-2.5 transition active:scale-95">
                {active && <motion.span layoutId="activeTab" className="absolute inset-0 rounded-lg border border-white/10 bg-white/[0.055]" transition={{ type: "spring", stiffness: 360, damping: 28 }} />}
                <Icon className={`relative z-10 h-5 w-5 ${active ? "text-amber-400" : "text-zinc-500"}`} />
                <span className={`relative z-10 text-[9px] font-black uppercase tracking-[0.08em] ${active ? "text-amber-400" : "text-zinc-500"}`}>{item.label}</span>
                {badge > 0 && (
                  <span className="absolute right-1.5 top-1.5 z-20 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-black">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
