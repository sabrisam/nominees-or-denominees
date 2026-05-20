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
  Image as ImageIcon,
  Loader2,
  Medal,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Star,
  Trophy,
  UploadCloud,
  Video,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Tab = "feed" | "vote" | "studio" | "trophies" | "archive";
type NominationStatus = "pending" | "accepted" | "rejected";
type VerdictChoice = "propel" | "ban";
type ToastTone = "success" | "error" | "info";
type CategoryMood = "positive" | "critical" | "fun";
type MediaKind = "video" | "image";

type ToastState = { tone: ToastTone; message: string } | null;

type Participant = {
  id: string;
  pseudo: string;
};

type VoteValue = {
  rating: number;
  choice: VerdictChoice;
  pseudo: string;
  voted_at: string;
};

type Votes = Record<string, VoteValue | undefined>;

type Nomination = {
  id: string;
  room_id: string;
  image_url: string;
  image_storage_path: string | null;
  video_url: string | null;
  video_storage_path: string | null;
  category_id: string;
  comment: string;
  submitted_by: string;
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

type SpacesUploadResult = {
  key: string;
  publicUrl: string;
  uploadUrl: string;
};

const SESSION_ID_KEY = "nod_session_id";
const PSEUDO_KEY = "nod_pseudo";
const ROOM_CODE_KEY = "nod_room_code";
const DEFAULT_ROOM_CODE = "NOD-CLUB";
const MIN_VERDICT_VOTES = 2;
const MAX_DIRECT_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;
const STAR_VALUES = [1, 2, 3, 4, 5] as const;

const CATEGORIES: CategoryMeta[] = [
  { id: "moment_marquant", label: "Moment marquant", mood: "positive", icon: Sparkles },
  { id: "pepite_cachee", label: "Pépite cachée", mood: "positive", icon: Crown },
  { id: "style_remarquable", label: "Style remarquable", mood: "positive", icon: Trophy },
  { id: "replique_culte", label: "Réplique culte", mood: "positive", icon: BadgeCheck },
  { id: "elan_creatif", label: "Élan créatif", mood: "positive", icon: Zap },
  { id: "malaise_public", label: "Malaise public", mood: "critical", icon: ShieldAlert },
  { id: "signal_alerte", label: "Signal d'alerte", mood: "critical", icon: ShieldAlert },
  { id: "derapage_leger", label: "Dérapage léger", mood: "critical", icon: Flame },
  { id: "choix_discutable", label: "Choix discutable", mood: "critical", icon: Archive },
  { id: "silence_genant", label: "Silence gênant", mood: "critical", icon: Clock3 },
  { id: "fou_rire", label: "Fou rire du mois", mood: "fun", icon: Sparkles },
  { id: "scene_improbable", label: "Scène improbable", mood: "fun", icon: Video },
  { id: "roue_libre", label: "Roue libre", mood: "fun", icon: Flame },
  { id: "performance_surprise", label: "Performance surprise", mood: "fun", icon: Trophy },
  { id: "voyage_express", label: "Voyage express", mood: "fun", icon: Camera }
];

const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((category) => [category.id, category])) as Record<string, CategoryMeta>;

const TAB_ITEMS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "feed", label: "Flux", icon: Sparkles },
  { id: "vote", label: "Vote", icon: Zap },
  { id: "studio", label: "Uploader", icon: Plus },
  { id: "trophies", label: "Trophées", icon: Crown },
  { id: "archive", label: "Archive", icon: ImageIcon }
];

const TAB_ORDER: Tab[] = TAB_ITEMS.map((item) => item.id);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function haptic(pattern: number | number[]) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  navigator.vibrate(pattern);
}

function makeSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
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

function normalizeStatus(value: unknown): NominationStatus | null {
  if (value === "pending" || value === "accepted" || value === "rejected") return value;
  if (value === "resolved") return "accepted";
  return null;
}

function normalizeChoice(value: unknown): VerdictChoice | null {
  if (value === "propel" || value === "nominee") return "propel";
  if (value === "ban" || value === "ejected") return "ban";
  return null;
}

function parseVotes(value: unknown): Votes {
  if (!isRecord(value)) return {};

  return Object.entries(value).reduce<Votes>((acc, [sessionId, rawVote]) => {
    if (!isRecord(rawVote)) return acc;

    const rating = toIntOrNull(rawVote.rating);
    const choice = normalizeChoice(rawVote.choice);
    if (rating === null || !choice) return acc;

    acc[sessionId] = {
      rating: clampRating(rating),
      choice,
      pseudo: sanitizePseudo(toText(rawVote.pseudo, "Invité")) || "Invité",
      voted_at: toText(rawVote.voted_at, new Date().toISOString())
    };

    return acc;
  }, {});
}

function getVoteList(votes: Votes) {
  return Object.values(votes).filter((vote): vote is VoteValue => Boolean(vote));
}

function voteCount(votes: Votes) {
  return getVoteList(votes).length;
}

function averageFromVotes(votes: Votes) {
  const ratings = getVoteList(votes).map((vote) => vote.rating);
  if (ratings.length === 0) return null;
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

function computeStatus(votes: Votes): NominationStatus {
  const average = averageFromVotes(votes);
  if (average === null || voteCount(votes) < MIN_VERDICT_VOTES) return "pending";
  return average >= 3 ? "accepted" : "rejected";
}

function averageRating(nomination: Nomination) {
  return averageFromVotes(nomination.votes);
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
  return CATEGORY_BY_ID[value] ?? { id: "custom", label: value || "Sans catégorie", mood: "fun", icon: Archive };
}

function statusLabel(status: NominationStatus) {
  if (status === "accepted") return "PROPULSER";
  if (status === "rejected") return "BANNIR";
  return "A VOTER";
}

function statusClass(status: NominationStatus) {
  if (status === "accepted") return "border-black bg-yellow-300 text-black";
  if (status === "rejected") return "border-black bg-red-600 text-white";
  return "border-black bg-black text-white";
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} Go`;
}

function parseNomination(row: Record<string, unknown>): Nomination {
  const votes = parseVotes(row.votes);
  return {
    id: toText(row.id, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    room_id: toText(row.room_id),
    image_url: toText(row.image_url),
    image_storage_path: toText(row.image_storage_path) || null,
    video_url: toText(row.video_url) || null,
    video_storage_path: toText(row.video_storage_path) || null,
    category_id: toText(row.category_id, toText(row.category, "moment_marquant")),
    comment: toText(row.comment),
    submitted_by: toText(row.submitted_by, "session-inconnue"),
    status: normalizeStatus(row.status) ?? computeStatus(votes),
    votes,
    created_at: toText(row.created_at, new Date().toISOString())
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
        else reject(new Error("Export canvas impossible."));
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
    if (!context) throw new Error("Canvas indisponible.");

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
    throw new Error(payload.error || "Signature Spaces impossible.");
  }

  const uploadResponse = await fetch(payload.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file
  });

  if (!uploadResponse.ok) {
    throw new Error("Envoi DigitalOcean Spaces refusé.");
  }

  return {
    key: payload.key,
    publicUrl: payload.publicUrl
  };
}

function verdictLabel(choice: VerdictChoice) {
  return choice === "propel" ? "PROPULSER" : "BANNIR";
}

function voteBurst(choice: VerdictChoice) {
  const colors = choice === "propel" ? ["#facc15", "#dc2626", "#000000", "#f0f0f0"] : ["#dc2626", "#000000", "#facc15"];

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
      ? "border-black bg-yellow-300 text-black"
      : tone === "black"
        ? "border-black bg-black text-white"
        : tone === "paper"
          ? "border-black bg-[#f0f0f0] text-black"
          : "border-black bg-red-600 text-white";

  return <span className={`inline-flex border-4 px-2 py-1 text-[10px] font-black uppercase leading-none ${toneClass} ${className}`}>{children}</span>;
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
          <button
            key={star}
            type="button"
            disabled={readonly}
            onMouseEnter={() => !readonly && setHover(star)}
            onMouseLeave={() => !readonly && setHover(0)}
            onClick={() => onChange?.(star)}
            className={`flex aspect-square items-center justify-center border-4 border-black transition active:translate-x-0.5 active:translate-y-0.5 disabled:cursor-default ${
              active ? "bg-yellow-300 text-black" : "bg-[#f0f0f0] text-zinc-500"
            }`}
            aria-label={`${star} étoiles`}
          >
            <Star className={`${iconSizeClass} ${active ? "fill-black" : ""}`} strokeWidth={2} />
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
        className={`${height} block w-full bg-black object-cover`}
      />
    );
  }

  return <img src={nomination.image_url} alt="" className={`${height} block w-full bg-black object-cover`} />;
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
  const [mediaProgress, setMediaProgress] = useState(0);
  const [mediaNote, setMediaNote] = useState("");
  const [isPreparingMedia, setIsPreparingMedia] = useState(false);
  const [catId, setCatId] = useState(CATEGORIES[0].id);
  const [comment, setComment] = useState("");
  const [initialRating, setInitialRating] = useState(4);
  const [uploadLoading, setUploadLoading] = useState(false);

  const [ratingDraftById, setRatingDraftById] = useState<Record<string, number>>({});
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
    haptic(20);
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
      const storedId = localStorage.getItem(SESSION_ID_KEY);
      const nextId = storedId || makeSessionId();
      const storedPseudo = sanitizePseudo(localStorage.getItem(PSEUDO_KEY) || "");
      const nextPseudo = storedPseudo || `Joueur ${nextId.slice(0, 4).toUpperCase()}`;
      localStorage.setItem(SESSION_ID_KEY, nextId);
      localStorage.setItem(PSEUDO_KEY, nextPseudo);
      localStorage.setItem(ROOM_CODE_KEY, DEFAULT_ROOM_CODE);
      setRoomCode(DEFAULT_ROOM_CODE);
      setParticipant({ id: nextId, pseudo: nextPseudo });
    } finally {
      setBootingSession(false);
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
    setMediaProgress(0);
    setMediaNote("");
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
          const message = err instanceof Error ? err.message : "Synchronisation impossible.";
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
    if (!participant || !supabase) return;

    let cancelled = false;

    void (async () => {
      try {
        const activeRoomId = await ensureRoom();
        if (!cancelled && activeRoomId) {
          await fetchNominations(false, activeRoomId);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Flux inaccessible.";
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
      .channel(`nod_salon_${roomId}`, { config: { broadcast: { self: false } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "nominations", filter: `room_id=eq.${roomId}` }, () => {
        void fetchNominations(true);
      })
      .on("broadcast", { event: "vote" }, () => {
        void fetchNominations(true);
      })
      .on("broadcast", { event: "dossier" }, () => {
        void fetchNominations(true);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      window.clearInterval(poll);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [fetchNominations, participant, roomId, supabase]);

  const pendingForMe = useMemo(() => {
    if (!participant) return [];
    return nominations.filter((nomination) => nomination.status === "pending" && !nomination.votes[participant.id]);
  }, [nominations, participant]);

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
  const uploadReady = Boolean(preparedFile && thumbnailFile && comment.trim().length >= 3 && !isPreparingMedia);

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
    setMediaNote("");
    clearPreparedMedia();
    setSourceFileName(nextFile.name);

    try {
      if (nextFile.type.startsWith("image/")) {
        const compressed = await compressImageToWebp(nextFile);
        setPreparedFile(compressed);
        setThumbnailFile(compressed);
        setMediaKind("image");
        setUrl(setPreviewUrlState, null, compressed);
        setUrl(setThumbnailPreviewUrlState, null, compressed);
        setMediaProgress(1);
        setMediaNote(`Image WebP: ${formatBytes(nextFile.size)} -> ${formatBytes(compressed.size)}`);
        showToast("success", "Image optimisée.");
        return;
      }

      const thumbnail = await extractVideoThumbnail(nextFile);
      setPreparedFile(nextFile);
      setThumbnailFile(thumbnail);
      setMediaKind("video");
      setUrl(setPreviewUrlState, null, nextFile);
      setUrl(setThumbnailPreviewUrlState, null, thumbnail);
      setMediaProgress(1);
      setMediaNote(`Vidéo originale conservée: ${formatBytes(nextFile.size)}. Miniature JPEG: ${formatBytes(thumbnail.size)}.`);
      showToast("success", "Miniature générée, vidéo conservée.");
    } catch (err) {
      clearPreparedMedia();
      const message = err instanceof Error ? err.message : "Média impossible à préparer.";
      showToast("error", message);
    } finally {
      setIsPreparingMedia(false);
    }
  };

  const uploadNomination = async () => {
    if (!participant || !supabase) {
      showToast("error", "Configure Supabase avant l'envoi.");
      return;
    }

    const cleanedComment = comment.trim();
    if (!preparedFile || !thumbnailFile || !mediaKind || cleanedComment.length < 3) {
      showToast("error", "Ajoute un média et une note valide.");
      return;
    }

    haptic(20);
    setUploadLoading(true);
    setMediaProgress(0.15);

    try {
      const activeRoomId = roomId ?? (await ensureRoom());
      if (!activeRoomId) throw new Error("Flux introuvable.");

      setMediaNote("Envoi de la miniature vers DigitalOcean Spaces...");
      const imageUpload = await uploadFileToSpaces(thumbnailFile, "miniatures");
      setMediaProgress(mediaKind === "video" ? 0.45 : 0.82);

      let videoUpload: { key: string; publicUrl: string } | null = null;
      if (mediaKind === "video") {
        setMediaNote("Envoi de la vidéo originale vers DigitalOcean Spaces...");
        videoUpload = await uploadFileToSpaces(preparedFile, "videos");
        setMediaProgress(0.82);
      }

      const starterVote: VoteValue = {
        rating: clampRating(initialRating),
        choice: initialRating >= 3 ? "propel" : "ban",
        pseudo: participant.pseudo,
        voted_at: new Date().toISOString()
      };
      const votes: Votes = { [participant.id]: starterVote };

      const { error: insertError } = await supabase.from("nominations").insert({
        room_id: activeRoomId,
        image_url: imageUpload.publicUrl,
        image_storage_path: imageUpload.key,
        video_url: videoUpload?.publicUrl ?? null,
        video_storage_path: videoUpload?.key ?? null,
        category_id: catId,
        comment: cleanedComment,
        submitted_by: participant.id,
        votes,
        status: computeStatus(votes)
      });

      if (insertError) throw insertError;

      setMediaProgress(1);
      haptic(initialRating >= 3 ? [15, 30, 15] : [20, 50]);
      showToast("success", "Dossier envoyé dans le flux.");
      clearPreparedMedia();
      setComment("");
      setInitialRating(4);
      setCatId(CATEGORIES[0].id);
      switchTab("vote");
      await channelRef.current?.send({ type: "broadcast", event: "dossier", payload: { roomId: activeRoomId } });
      void fetchNominations(true, activeRoomId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec de l'envoi.";
      showToast("error", message);
    } finally {
      setUploadLoading(false);
    }
  };

  const applyVote = async (id: string, choice: VerdictChoice) => {
    if (!participant || !supabase || voteBusyId) return;

    const nomination = nominations.find((item) => item.id === id);
    if (!nomination) return;

    const draft = clampRating(ratingDraftById[id] ?? 4);
    const finalRating = choice === "propel" ? Math.max(3, draft) : Math.min(2, draft);
    const votePayload: VoteValue = {
      rating: finalRating,
      choice,
      pseudo: participant.pseudo,
      voted_at: new Date().toISOString()
    };
    const nextVotes: Votes = {
      ...nomination.votes,
      [participant.id]: votePayload
    };
    const nextStatus = computeStatus(nextVotes);

    haptic(choice === "propel" ? [15, 30, 15] : [20, 50]);
    setVoteBusyId(id);
    setShakeId(id);
    window.setTimeout(() => setShakeId(null), 520);

    try {
      const { error: rpcError } = await supabase.rpc("submit_nomination_vote", {
        target_nomination_id: id,
        voter_id: participant.id,
        vote_payload: votePayload
      });

      if (rpcError) {
        const { error: fallbackError } = await supabase.from("nominations").update({ votes: nextVotes, status: nextStatus }).eq("id", id);
        if (fallbackError) throw fallbackError;
      }

      setRatingDraftById((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      voteBurst(choice);
      showToast("success", nextStatus === "accepted" ? "Verdict collectif: PROPULSER." : nextStatus === "rejected" ? "Verdict collectif: BANNIR." : "Vote enregistré.");
      await channelRef.current?.send({ type: "broadcast", event: "vote", payload: { id, status: nextStatus } });
      void fetchNominations(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible de voter.";
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
    <div className="tabloid-app" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 94px)" }}>
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
                toast.tone === "success" ? "bg-yellow-300 text-black" : toast.tone === "error" ? "bg-red-600 text-white" : "bg-black text-white"
              }`}
            >
              {toast.tone === "success" ? <Check className="h-4 w-4" /> : toast.tone === "error" ? <ShieldAlert className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              <span>{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main
        className="relative z-10 mx-auto h-[calc(100svh-6.25rem)] w-full max-w-[30rem] overflow-y-auto overscroll-contain px-4 pb-7"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}
      >
        <header className="sticky top-0 z-30 mb-4 bg-[#f0f0f0] py-3">
          <div className="border-b-4 border-black pb-2">
            <div className="flex items-center justify-between">
              <div className="min-w-0 text-left">
                <p className="text-[10px] font-black uppercase text-red-600">Jeu en direct</p>
                <p className="truncate text-[clamp(1.65rem,8vw,2.65rem)] font-black uppercase leading-none">Flux collectif</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => void fetchNominations()} disabled={syncing || !supabase} className="brutal-icon-button disabled:opacity-50" aria-label="Synchroniser">
                  <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
            <div className="ticker mt-3 border-4 border-black bg-black text-white">
              <span className="ticker-track">
                PROCHAINE CÉRÉMONIE {countdown.days}J {countdown.hours}H {countdown.mins}M / SYNCHRO {lastSyncLabel} / VOTES EN ATTENTE {pendingForMe.length} / ARCHIVE PERMANENTE / JEU EN DIRECT
              </span>
            </div>
          </div>
        </header>

        <section className="mb-4 grid grid-cols-3 gap-2">
          <BrutalCard tone="yellow" className="p-2">
            <p className="text-[10px] font-black uppercase">A voter</p>
            <p className="text-[clamp(2rem,11vw,3rem)] font-black leading-none">{pendingForMe.length}</p>
          </BrutalCard>
          <BrutalCard tone="red" className="p-2">
            <p className="text-[10px] font-black uppercase">Propulsés</p>
            <p className="text-[clamp(2rem,11vw,3rem)] font-black leading-none">{accepted.length}</p>
          </BrutalCard>
          <BrutalCard tone="black" className="p-2">
            <p className="text-[10px] font-black uppercase">Actés</p>
            <p className="text-[clamp(2rem,11vw,3rem)] font-black leading-none">{progressDone}%</p>
          </BrutalCard>
        </section>

        <AnimatePresence mode="wait">
          {tab === "feed" && (
            <motion.section
              key="feed"
              {...pageTransition}
              {...revealContainer}
              drag={reduceMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => handleSectionDrag(info)}
              transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }}
              className="space-y-4"
            >
              <motion.div {...revealItem}>
                <BrutalCard tone="red" className="relative overflow-hidden p-4">
                  <Sticker tone="yellow" className="-rotate-2">
                    Exclusif
                  </Sticker>
                  <h2 className="tabloid-headline mt-3 text-[clamp(3.2rem,17vw,5.5rem)] leading-[0.76] text-white">
                    Cérémonie
                    <span className="block text-yellow-300">TikTok</span>
                    <span className="block text-black">du mois</span>
                  </h2>
                  <p className="mt-4 border-t-4 border-black pt-3 text-[clamp(1.1rem,5vw,1.5rem)] font-black uppercase leading-none text-white">
                    Uploader. Voter. Propulser. L&apos;archive reste permanente.
                  </p>
                </BrutalCard>
              </motion.div>

              <motion.div {...revealItem}>
                <BrutalCard className="overflow-hidden">
                  <div className="relative border-b-4 border-black bg-black">
                    {heroWinner ? <MediaFrame nomination={heroWinner} height="h-[min(58svh,28rem)]" controls={false} /> : <div className="flex h-[min(58svh,28rem)] items-center justify-center bg-black text-white"><Camera className="h-12 w-12" /></div>}
                    <Sticker tone="yellow" className="absolute left-3 top-3 rotate-2">
                      À la une
                    </Sticker>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-3 p-3">
                    <div>
                      <p className="text-[10px] font-black uppercase text-red-600">Flux public</p>
                      <p className="line-clamp-2 text-[clamp(1.35rem,7vw,2rem)] font-black uppercase leading-none">{heroWinner ? heroWinner.comment : "Aucun dossier publié"}</p>
                    </div>
                    <button onClick={() => switchTab("studio")} className="brutal-icon-button bg-yellow-300" aria-label="Uploader un dossier">
                      <UploadCloud className="h-5 w-5" />
                    </button>
                  </div>
                </BrutalCard>
              </motion.div>

              <motion.div {...revealItem} className="space-y-3">
                {feedItems.length === 0 ? (
                  <BrutalCard className="p-8 text-center">
                    <Camera className="mx-auto mb-3 h-9 w-9" />
                    <p className="text-2xl font-black uppercase leading-none">Aucune capture.</p>
                    <p className="mt-2 text-sm font-bold uppercase">Le premier envoi ouvre la cérémonie.</p>
                  </BrutalCard>
                ) : (
                  feedItems.map((nomination, index) => {
                    const category = getCategoryMeta(nomination.category_id);
                    const Icon = category.icon;
                    const rating = averageRating(nomination);
                    return (
                      <BrutalCard key={nomination.id} tone={index % 3 === 0 ? "yellow" : "paper"} className="overflow-hidden">
                        <div className="grid grid-cols-[6rem_1fr] border-b-4 border-black">
                          <div className="media-cut h-24 border-r-4 border-black">
                            <MediaFrame nomination={nomination} height="h-24" controls={false} />
                          </div>
                          <div className="min-w-0 p-2">
                            <span className={`inline-flex border-4 px-2 py-1 text-[10px] font-black uppercase ${statusClass(nomination.status)}`}>{statusLabel(nomination.status)}</span>
                            <p className="mt-2 truncate text-lg font-black uppercase leading-none">&quot;{nomination.comment}&quot;</p>
                            <p className="mt-2 flex items-center gap-1 text-[11px] font-black uppercase">
                              <Icon className="h-3.5 w-3.5 text-red-600" /> {category.label} / {voteCount(nomination.votes)} votes / {rating ? rating.toFixed(1) : "-"} sur 5
                            </p>
                          </div>
                        </div>
                      </BrutalCard>
                    );
                  })
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
              className="space-y-4"
            >
              <BrutalCard tone="black" className="p-4">
                <Sticker tone="red" className="-rotate-2">
                  Verdict express
                </Sticker>
                <h2 className="tabloid-headline mt-3 text-[clamp(3rem,16vw,5rem)] leading-[0.78] text-white">Duel express</h2>
                <p className="mt-3 text-[clamp(1.1rem,5vw,1.45rem)] font-black uppercase leading-none text-yellow-300">Une note, un vote, un verdict collectif.</p>
              </BrutalCard>

              {loadingList ? (
                <BrutalCard className="p-8 text-center">
                  <Loader2 className="mx-auto h-7 w-7 animate-spin" />
                </BrutalCard>
              ) : pendingForMe.length === 0 ? (
                <BrutalCard tone="yellow" className="p-8 text-center">
                  <BadgeCheck className="mx-auto mb-3 h-10 w-10" />
                  <p className="text-3xl font-black uppercase leading-none">File d&apos;attente vide.</p>
                  <p className="mt-2 text-sm font-bold uppercase">Aucun dossier à voter pour toi.</p>
                </BrutalCard>
              ) : (
                pendingForMe.map((nomination) => {
                  const category = getCategoryMeta(nomination.category_id);
                  const Icon = category.icon;
                  const draftRating = clampRating(ratingDraftById[nomination.id] ?? 4);

                  return (
                    <motion.article
                      key={nomination.id}
                      animate={
                        shakeId === nomination.id
                          ? { x: [0, -12, 12, -9, 9, 0], rotate: [0, -1.2, 1.2, -0.8, 0.8, 0] }
                          : { x: 0, rotate: 0 }
                      }
                      transition={{ duration: 0.42 }}
                      className="brutal-card overflow-hidden"
                    >
                      <div className="relative border-b-4 border-black bg-black">
                        <MediaFrame nomination={nomination} height="h-[min(62svh,30rem)]" />
                        <Sticker tone="red" className="absolute left-3 top-3 -rotate-2">
                          Preuve vidéo
                        </Sticker>
                        <div className="absolute bottom-3 left-3 right-3 border-4 border-black bg-[#f0f0f0] p-2">
                          <p className="flex items-center gap-1 text-[10px] font-black uppercase text-red-600">
                            <Icon className="h-3.5 w-3.5" /> {category.label}
                          </p>
                          <p className="text-xl font-black uppercase leading-none">&quot;{nomination.comment}&quot;</p>
                        </div>
                      </div>
                      <div className="space-y-3 p-3">
                        <StarInput value={draftRating} onChange={(value) => setRatingDraftById((prev) => ({ ...prev, [nomination.id]: value }))} size="lg" />
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => void applyVote(nomination.id, "propel")} disabled={voteBusyId === nomination.id} className="brutal-action bg-yellow-300 text-black disabled:opacity-50">
                            Propulser
                          </button>
                          <button onClick={() => void applyVote(nomination.id, "ban")} disabled={voteBusyId === nomination.id} className="brutal-action bg-red-600 text-white disabled:opacity-50">
                            Bannir
                          </button>
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
              className="space-y-4"
            >
              <BrutalCard tone="red" className="p-4">
                <Sticker tone="yellow" className="-rotate-2">
                  Uploader un dossier
                </Sticker>
                <h2 className="tabloid-headline mt-3 text-[clamp(3rem,16vw,5rem)] leading-[0.78] text-white">Studio dossier</h2>
                <p className="mt-3 text-[clamp(1.1rem,5vw,1.45rem)] font-black uppercase leading-none text-white">Vidéo originale, photo ou capture. Seule la miniature passe par canvas.</p>
              </BrutalCard>

              <BrutalCard className="p-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPreparingMedia || uploadLoading}
                  className="relative flex min-h-[min(48svh,22rem)] w-full items-center justify-center overflow-hidden border-4 border-black bg-black text-left transition active:translate-x-1 active:translate-y-1 disabled:opacity-70"
                >
                  {previewUrl ? (
                    mediaKind === "video" ? (
                      <video src={previewUrl} poster={thumbnailPreviewUrl ?? undefined} className="absolute inset-0 h-full w-full object-cover" controls playsInline muted preload="metadata" />
                    ) : (
                      <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    )
                  ) : (
                    <span className="flex flex-col items-center px-6 text-center text-white">
                      {isPreparingMedia ? <Loader2 className="mb-3 h-9 w-9 animate-spin text-yellow-300" /> : <UploadCloud className="mb-3 h-9 w-9 text-yellow-300" />}
                      <span className="text-3xl font-black uppercase leading-none">{isPreparingMedia ? "Chargement du studio..." : "Choisir un média"}</span>
                      <span className="mt-2 text-sm font-black uppercase text-yellow-300">Vidéo, photo, capture d&apos;écran</span>
                    </span>
                  )}
                  <input ref={fileInputRef} type="file" accept="video/*,image/*" onChange={(event) => void prepareMedia(event.target.files?.[0] ?? null)} className="hidden" />
                </button>
              </BrutalCard>

              {(isPreparingMedia || mediaNote || uploadLoading) && (
                <BrutalCard tone="yellow" className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black uppercase">{sourceFileName || "Média"}</p>
                      <p className="mt-1 truncate text-xs font-black uppercase">{mediaNote || "Préparation du média..."}</p>
                    </div>
                    <p className="text-4xl font-black leading-none">{Math.round(mediaProgress * 100)}%</p>
                  </div>
                  <div className="mt-3 h-5 border-4 border-black bg-[#f0f0f0]">
                    <motion.div className="h-full bg-red-600" animate={{ width: `${Math.round(mediaProgress * 100)}%` }} />
                  </div>
                </BrutalCard>
              )}

              <select value={catId} onChange={(event) => setCatId(event.target.value)} className="brutal-input w-full appearance-none px-4 py-4 text-lg font-black uppercase">
                {CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>

              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Pourquoi ce dossier mérite un verdict ?"
                rows={3}
                maxLength={240}
                className="brutal-input w-full resize-none p-4 text-lg font-black uppercase"
              />

              <BrutalCard tone="yellow" className="p-3">
                <StarInput value={initialRating} onChange={setInitialRating} size="lg" />
                <p className="mt-3 border-t-4 border-black pt-2 text-center text-sm font-black uppercase">Vote initial: {verdictLabel(initialRating >= 3 ? "propel" : "ban")}</p>
              </BrutalCard>

              <button onClick={() => void uploadNomination()} disabled={uploadLoading || !uploadReady} className="brutal-submit flex w-full items-center justify-center gap-2 disabled:opacity-50">
                {uploadLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Uploader le dossier"}
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
              transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }}
              className="space-y-4"
            >
              <BrutalCard tone="black" className="p-4 text-white">
                <Medal className="mb-3 h-10 w-10 text-yellow-300" />
                <h2 className="tabloid-headline text-[clamp(3rem,16vw,5rem)] leading-[0.78]">Trophées du mois</h2>
                <p className="mt-3 text-[clamp(1.1rem,5vw,1.45rem)] font-black uppercase leading-none text-yellow-300">Le premier jour du mois révèle le palmarès.</p>
              </BrutalCard>

              {categoryWinners.length === 0 ? (
                <BrutalCard tone="yellow" className="p-8 text-center">
                  <Trophy className="mx-auto mb-3 h-10 w-10" />
                  <p className="text-3xl font-black uppercase leading-none">Aucun propulsé.</p>
                  <p className="mt-2 text-sm font-black uppercase">Une moyenne collective de 3/5 ouvre le palmarès.</p>
                </BrutalCard>
              ) : (
                categoryWinners.map(({ category, winner }, index) => {
                  const Icon = category.icon;
                  return (
                    <BrutalCard key={winner.id} tone={index % 2 === 0 ? "yellow" : "paper"} className="overflow-hidden">
                      <div className="grid grid-cols-[7rem_1fr]">
                        <div className="media-cut h-28 border-r-4 border-black">
                          <MediaFrame nomination={winner} height="h-28" controls={false} />
                        </div>
                        <div className="min-w-0 p-3">
                          <p className="flex items-center gap-1 text-[10px] font-black uppercase text-red-600">
                            <Icon className="h-3.5 w-3.5" /> {category.label}
                          </p>
                          <p className="mt-2 truncate text-2xl font-black uppercase leading-none">&quot;{winner.comment}&quot;</p>
                          <p className="mt-2 inline-flex border-4 border-black bg-red-600 px-2 py-1 text-xs font-black uppercase text-white">{averageRating(winner)?.toFixed(1)} / 5</p>
                        </div>
                      </div>
                    </BrutalCard>
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
              transition={{ duration: reduceMotion ? 0.01 : 0.26, type: "spring", stiffness: 230, damping: 25 }}
              className="space-y-3"
            >
              <BrutalCard tone="red" className="p-4">
                <h2 className="tabloid-headline text-[clamp(3rem,16vw,5rem)] leading-[0.78] text-white">Archives</h2>
                <p className="mt-3 text-[clamp(1.1rem,5vw,1.45rem)] font-black uppercase leading-none text-white">Vidéos, miniatures et verdicts restent permanents.</p>
              </BrutalCard>

              {archive.length === 0 ? (
                <BrutalCard className="p-8 text-center">
                  <ImageIcon className="mx-auto mb-3 h-9 w-9" />
                  <p className="text-3xl font-black uppercase leading-none">Archive vide.</p>
                </BrutalCard>
              ) : (
                archive.map((nomination) => {
                  const rating = averageRating(nomination);
                  return (
                    <BrutalCard key={nomination.id} tone={nomination.status === "accepted" ? "yellow" : "paper"} className="overflow-hidden">
                      <div className="grid grid-cols-[5.5rem_1fr]">
                        <div className="media-cut h-24 border-r-4 border-black">
                          <MediaFrame nomination={nomination} height="h-24" controls={false} />
                        </div>
                        <div className="min-w-0 p-2">
                          <span className={`inline-flex border-4 px-2 py-1 text-[10px] font-black uppercase ${statusClass(nomination.status)}`}>{statusLabel(nomination.status)}</span>
                          <p className="mt-2 truncate text-lg font-black uppercase leading-none">&quot;{nomination.comment}&quot;</p>
                          <p className="mt-1 text-xs font-black uppercase">{rating ? rating.toFixed(1) : "-"} / 5 / {voteCount(nomination.votes)} votes</p>
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
          onClick={() => switchTab("studio")}
          className="brutal-fab fixed right-5 z-40 flex h-16 w-16 items-center justify-center"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}
          aria-label="Uploader un dossier"
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
              <button key={item.id} onClick={() => switchTab(item.id)} className={`relative flex flex-col items-center justify-center gap-1 border-4 border-black px-1 py-2 transition active:translate-x-0.5 active:translate-y-0.5 ${active ? "bg-red-600 text-white" : "bg-[#f0f0f0] text-black"}`}>
                <Icon className="relative z-10 h-5 w-5" strokeWidth={1.5} />
                <span className="relative z-10 text-[9px] font-black uppercase">{item.label}</span>
                {badge > 0 && (
                  <span className="absolute right-0 top-0 z-20 inline-flex h-5 min-w-[20px] items-center justify-center border-b-4 border-l-4 border-black bg-yellow-300 px-1 text-[9px] font-black text-black">
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
