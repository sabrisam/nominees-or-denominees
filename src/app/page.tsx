"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { AnimatePresence, motion, type PanInfo, useReducedMotion } from "framer-motion";
import {
  Archive,
  Check,
  Clock,
  Flame,
  Image as ImageIcon,
  Layers,
  Loader2,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Scale,
  Send,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Upload,
  UserCircle,
  Video,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Role = "player_1" | "player_2";
type Tab = "home" | "verdict" | "arena" | "gallery" | "ceremony";
type NominationStatus = "pending" | "accepted" | "rejected" | "arena";
type VerdictChoice = "nominee" | "ejected";
type ToastTone = "success" | "error" | "info";
type CategoryMood = "positive" | "critical" | "fun";

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
  arguments: unknown[];
  created_at: string;
};

type TrialRound = {
  id: string;
  nomination_id: string;
  round_number: number;
  player_role: Role;
  body: string;
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
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 16;
const STAR_VALUES = [1, 2, 3, 4, 5] as const;

const ROLE_LABEL: Record<Role, string> = {
  player_1: "Joueur 1",
  player_2: "Joueur 2"
};

const CATEGORIES: CategoryMeta[] = [
  { id: "moment_marquant", label: "Moment marquant", mood: "positive", icon: Sparkles },
  { id: "pepite_cachee", label: "Pepite cachee", mood: "positive", icon: Sparkles },
  { id: "style_remarquable", label: "Style remarquable", mood: "positive", icon: Trophy },
  { id: "replique_culte", label: "Replique culte", mood: "positive", icon: MessageSquare },
  { id: "elan_creatif", label: "Elan creatif", mood: "positive", icon: Sparkles },
  { id: "malaise_public", label: "Malaise public", mood: "critical", icon: ShieldAlert },
  { id: "signal_alerte", label: "Signal d'alerte", mood: "critical", icon: ShieldAlert },
  { id: "derapage_leger", label: "Derapage leger", mood: "critical", icon: Scale },
  { id: "choix_discutable", label: "Choix discutable", mood: "critical", icon: Scale },
  { id: "silence_genant", label: "Silence genant", mood: "critical", icon: Clock },
  { id: "fou_rire", label: "Fou rire du mois", mood: "fun", icon: Sparkles },
  { id: "scene_improbable", label: "Scene improbable", mood: "fun", icon: Video },
  { id: "roue_libre", label: "Roue libre", mood: "fun", icon: Flame },
  { id: "performance_surprise", label: "Performance surprise", mood: "fun", icon: Trophy },
  { id: "voyage_express", label: "Voyage express", mood: "fun", icon: Archive }
];

const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<string, CategoryMeta>;

const TAB_ITEMS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "home", label: "Accueil", icon: Clock },
  { id: "verdict", label: "Verdict", icon: Layers },
  { id: "arena", label: "Arene", icon: Flame },
  { id: "gallery", label: "Galerie", icon: ImageIcon },
  { id: "ceremony", label: "Palmares", icon: Trophy }
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
  if (value === "pending" || value === "accepted" || value === "rejected" || value === "arena") {
    return value;
  }
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
  if (p1.choice !== p2.choice) return "arena";
  return p1.choice === "nominee" ? "accepted" : "rejected";
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

function moodBadgeClass(mood: CategoryMood) {
  if (mood === "positive") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300";
  if (mood === "critical") return "border-red-400/30 bg-red-500/10 text-red-300";
  return "border-amber-400/30 bg-amber-500/10 text-amber-200";
}

function verdictLabel(choice: VerdictChoice) {
  return choice === "nominee" ? "Nomine" : "Ejecte";
}

function statusLabel(status: NominationStatus) {
  if (status === "accepted") return "Accepte";
  if (status === "rejected") return "Ejecte";
  if (status === "arena") return "Arene";
  return "En attente";
}

function parseNomination(row: Record<string, unknown>): Nomination {
  const votes = parseVotes(row.votes);
  const status = normalizeStatus(row.status) ?? computeStatus(votes);
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
    status,
    votes,
    arguments: Array.isArray(row.arguments) ? row.arguments : [],
    created_at: toText(row.created_at, new Date().toISOString())
  };
}

function parseTrialRound(row: Record<string, unknown>): TrialRound | null {
  const role = normalizeRole(toText(row.player_role));
  const round = toIntOrNull(row.round_number);
  if (!role || round === null) return null;

  return {
    id: toText(row.id),
    nomination_id: toText(row.nomination_id),
    round_number: round,
    player_role: role,
    body: toText(row.body),
    created_at: toText(row.created_at, new Date().toISOString())
  };
}

function monthKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function makeStoragePath(file: File, role: Role, kind: "video" | "thumbnail") {
  const parts = file.name.split(".");
  const rawExtension = parts.length > 1 ? parts.pop()?.toLowerCase() : "";
  const extension = kind === "thumbnail" ? "jpg" : rawExtension && /^[a-z0-9]+$/.test(rawExtension) ? rawExtension : "mp4";
  const base = role === "player_1" ? "p1" : "p2";
  const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const folder = kind === "video" ? "videos" : "thumbnails";
  return `${folder}/${monthKey()}/${base}_${nonce}.${extension}`;
}

function waitForMediaEvent(target: HTMLMediaElement, eventName: string, timeoutMs = 10000) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Lecture video impossible."));
    }, timeoutMs);

    const onEvent = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("Fichier video illisible."));
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
      throw new Error(`Video trop longue: ${Math.round(duration)}s. Limite: 15s.`);
    }

    const seekTo = duration > 1 ? Math.min(0.6, duration / 2) : 0;
    if (seekTo > 0) {
      video.currentTime = seekTo;
      await waitForMediaEvent(video, "seeked");
    } else if (!video.videoWidth) {
      await waitForMediaEvent(video, "loadeddata");
    }

    const width = video.videoWidth || 720;
    const height = video.videoHeight || 1280;
    const scale = Math.min(1, 720 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas indisponible.");
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error("Miniature impossible."));
        },
        "image/jpeg",
        0.78
      );
    });

    const baseName = file.name.replace(/\.[^.]+$/, "") || "miniature";
    const thumbnail = new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
    return { thumbnail, duration };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

function getNextRoundForRole(rounds: TrialRound[], role: Role) {
  for (let round = 1; round <= 3; round += 1) {
    const alreadyPlayed = rounds.some((item) => item.round_number === round && item.player_role === role);
    if (!alreadyPlayed) return round;
  }
  return null;
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
            <Star className={`${iconSizeClass} transition-colors ${active ? "fill-amber-500 text-amber-500 drop-shadow-[0_0_10px_rgba(217,119,6,0.35)]" : "text-zinc-700"}`} />
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

export default function Home() {
  const reduceMotion = useReducedMotion();
  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseBrowserClient>>(null);
  const [bootingRole, setBootingRole] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState(DEFAULT_ROOM_CODE);
  const [p1Name, setP1Name] = useState("Joueur 1");
  const [p2Name, setP2Name] = useState("Joueur 2");
  const [editingName, setEditingName] = useState<"p1" | "p2" | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  const [tab, setTab] = useState<Tab>("home");
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [trialRoundsByNomination, setTrialRoundsByNomination] = useState<Record<string, TrialRound[]>>({});
  const [loadingList, setLoadingList] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const [toast, setToast] = useState<ToastState>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const [countdown, setCountdown] = useState(countdownToNextMonth);

  const [showAddModal, setShowAddModal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [catId, setCatId] = useState(CATEGORIES[0].id);
  const [comment, setComment] = useState("");
  const [initialRating, setInitialRating] = useState(3);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [processingMedia, setProcessingMedia] = useState(false);

  const [ratingDraftById, setRatingDraftById] = useState<Record<string, number>>({});
  const [argumentDraftById, setArgumentDraftById] = useState<Record<string, string>>({});
  const [voteBusyId, setVoteBusyId] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [argumentBusyId, setArgumentBusyId] = useState<string | null>(null);

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
          .select(
            "id,room_id,image_url,image_storage_path,video_url,video_storage_path,category_id,comment,submitted_by,status,votes,arguments,created_at"
          )
          .eq("room_id", activeRoomId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const rows = ((data ?? []) as Record<string, unknown>[]).map(parseNomination);
        setNominations(rows);

        const arenaIds = rows.filter((item) => item.status === "arena").map((item) => item.id);
        if (arenaIds.length > 0) {
          const { data: roundsData, error: roundsError } = await supabase
            .from("trial_rounds")
            .select("id,nomination_id,round_number,player_role,body,created_at")
            .in("nomination_id", arenaIds)
            .order("round_number", { ascending: true })
            .order("created_at", { ascending: true });

          if (roundsError) throw roundsError;

          const grouped = ((roundsData ?? []) as Record<string, unknown>[])
            .map(parseTrialRound)
            .filter((round): round is TrialRound => Boolean(round))
            .reduce<Record<string, TrialRound[]>>((acc, round) => {
              acc[round.nomination_id] = [...(acc[round.nomination_id] ?? []), round];
              return acc;
            }, {});

          setTrialRoundsByNomination(grouped);
        } else {
          setTrialRoundsByNomination({});
        }

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
      .on("postgres_changes", { event: "*", schema: "public", table: "trial_rounds" }, () => {
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

  const arena = useMemo(() => nominations.filter((nomination) => nomination.status === "arena"), [nominations]);

  const archive = useMemo(() => {
    const data = nominations.filter((nomination) => nomination.status === "accepted" || nomination.status === "rejected");
    return data.sort((a, b) => (averageRating(b) ?? 0) - (averageRating(a) ?? 0));
  }, [nominations]);

  const accepted = useMemo(() => archive.filter((nomination) => nomination.status === "accepted"), [archive]);

  const categoryWinners = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const inCategory = accepted.filter((nomination) => nomination.category_id === cat.id);
      if (inCategory.length === 0) return null;
      const winner = [...inCategory].sort((a, b) => (averageRating(b) ?? 0) - (averageRating(a) ?? 0))[0];
      return { category: cat, winner };
    }).filter(Boolean) as Array<{ category: CategoryMeta; winner: Nomination }>;
  }, [accepted]);

  const lastSyncLabel = lastSyncAt ? lastSyncAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--";
  const progressTotal = pendingForMe.length + arena.length + archive.length;
  const progressDone = progressTotal === 0 ? 0 : Math.round((archive.length / progressTotal) * 100);

  const pageTransition = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } };

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

  const clearSelectedMedia = useCallback(() => {
    setFile(null);
    setThumbnailFile(null);
    setPreviewUrl(null);
    setThumbnailPreviewUrl(null);
    setVideoDuration(null);
  }, []);

  const closeAddModal = useCallback(() => {
    setShowAddModal(false);
    setComment("");
    setInitialRating(3);
    setCatId(CATEGORIES[0].id);
    clearSelectedMedia();
  }, [clearSelectedMedia]);

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
    setTab("home");
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

  const onFileChange = async (nextFile: File | null) => {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("video/")) {
      showToast("error", "Choisis une video.");
      return;
    }
    if (nextFile.size > MAX_VIDEO_SIZE_BYTES) {
      showToast("error", "Video trop lourde. Limite: 50 Mo.");
      return;
    }

    setProcessingMedia(true);
    clearSelectedMedia();

    try {
      const { thumbnail, duration } = await extractVideoThumbnail(nextFile);
      setFile(nextFile);
      setThumbnailFile(thumbnail);
      setVideoDuration(duration);
      setPreviewUrl(URL.createObjectURL(nextFile));
      setThumbnailPreviewUrl(URL.createObjectURL(thumbnail));
      showToast("success", "Miniature generee.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Video impossible a preparer.";
      showToast("error", message);
    } finally {
      setProcessingMedia(false);
    }
  };

  const uploadNomination = async () => {
    if (!role || !supabase) {
      showToast("error", "Configure Supabase avant l'envoi.");
      return;
    }

    const cleanedComment = comment.trim();
    if (!file || !thumbnailFile || cleanedComment.length < 3) {
      showToast("error", "Ajoute une video et un motif valide.");
      return;
    }

    setUploadLoading(true);
    const uploadedPaths: string[] = [];

    try {
      const activeRoomId = roomId ?? (await ensureRoom());
      if (!activeRoomId) throw new Error("Salon introuvable.");

      const videoPath = makeStoragePath(file, role, "video");
      const imagePath = makeStoragePath(thumbnailFile, role, "thumbnail");

      const { error: videoUploadError } = await supabase.storage.from(BUCKET_NAME).upload(videoPath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "video/mp4"
      });

      if (videoUploadError) throw videoUploadError;
      uploadedPaths.push(videoPath);

      const { error: imageUploadError } = await supabase.storage.from(BUCKET_NAME).upload(imagePath, thumbnailFile, {
        cacheControl: "31536000",
        upsert: false,
        contentType: "image/jpeg"
      });

      if (imageUploadError) throw imageUploadError;
      uploadedPaths.push(imagePath);

      const {
        data: { publicUrl: videoUrl }
      } = supabase.storage.from(BUCKET_NAME).getPublicUrl(videoPath);

      const {
        data: { publicUrl: imageUrl }
      } = supabase.storage.from(BUCKET_NAME).getPublicUrl(imagePath);

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
        arguments: [],
        status: computeStatus(votes)
      });

      if (insertError) throw insertError;

      showToast("success", "Dossier envoye.");
      closeAddModal();
      setTab("verdict");
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

    const draft = clampRating(ratingDraftById[id] ?? 3);
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

      showToast("success", nextStatus === "arena" ? "Direction l'Arene." : "Verdict enregistre.");
      void fetchNominations(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible de voter.";
      showToast("error", message);
    } finally {
      setVoteBusyId(null);
    }
  };

  const submitTrialArgument = async (nominationId: string) => {
    if (!role || !supabase || argumentBusyId) return;

    const rounds = trialRoundsByNomination[nominationId] ?? [];
    const nextRound = getNextRoundForRole(rounds, role);
    const body = (argumentDraftById[nominationId] ?? "").trim().slice(0, 180);

    if (!nextRound) {
      showToast("info", "Tes trois rounds sont deja poses.");
      return;
    }
    if (body.length < 3) {
      showToast("error", "Argument trop court.");
      return;
    }

    setArgumentBusyId(nominationId);

    try {
      const { error } = await supabase.from("trial_rounds").insert({
        nomination_id: nominationId,
        round_number: nextRound,
        player_role: role,
        body
      });

      if (error) throw error;

      setArgumentDraftById((prev) => ({ ...prev, [nominationId]: "" }));
      showToast("success", `Round ${nextRound} ajoute.`);
      void fetchNominations(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Argument impossible a publier.";
      showToast("error", message);
    } finally {
      setArgumentBusyId(null);
    }
  };

  const deleteNomination = async (id: string) => {
    if (!supabase || deleteBusyId) return;

    const nomination = nominations.find((item) => item.id === id);
    const confirmed = window.confirm("Supprimer ce dossier ?");
    if (!confirmed) return;

    setDeleteBusyId(id);

    try {
      const storagePaths = [nomination?.video_storage_path, nomination?.image_storage_path].filter((path): path is string => Boolean(path));
      if (storagePaths.length > 0) {
        await supabase.storage.from(BUCKET_NAME).remove(storagePaths);
      }

      const { error } = await supabase.from("nominations").delete().eq("id", id);
      if (error) throw error;

      showToast("info", "Dossier supprime.");
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
        <div className="nod-panel flex h-16 w-16 items-center justify-center rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="nod-app text-white">
        <motion.div
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.3 }}
          className="nod-viewport flex min-h-screen flex-col justify-center"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          <div className="mb-7">
            <div className="mb-5 inline-flex h-12 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-600 text-xs font-black text-black">N</span>
              <span className="nod-eyebrow">NOD</span>
            </div>
            <h1 className="nod-title max-w-[12ch] text-5xl">Nominees or Denominees</h1>
            <p className="nod-copy mt-4 text-sm leading-6">Journal culturel partage en duo, pense comme une app iOS native.</p>
          </div>

          <label className="mb-4 block rounded-lg">
            <span className="nod-eyebrow mb-2 block text-zinc-500">Code salon</span>
            <input
              value={roomCode}
              onChange={(event) => setRoomCode(sanitizeRoomCode(event.target.value))}
              maxLength={24}
              className="nod-input w-full rounded-lg px-4 py-3 text-sm font-black uppercase tracking-[0.14em]"
            />
          </label>

          {!supabase && (
            <div className="mb-4 rounded-lg border border-amber-700/50 bg-amber-950/20 p-3 text-xs leading-5 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              Variables Supabase manquantes. L&apos;interface charge, mais la sync attend la configuration.
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => selectRole("player_1")}
              className="nod-panel flex w-full items-center justify-between rounded-lg p-5 text-left transition duration-150 active:scale-[0.99]"
            >
              <span>
                <span className="block text-lg font-black text-white">{p1Name}</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Joueur 1</span>
              </span>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-amber-700/35 bg-amber-600/10">
                <UserCircle className="h-6 w-6 text-amber-500" />
              </span>
            </button>
            <button
              onClick={() => selectRole("player_2")}
              className="nod-panel flex w-full items-center justify-between rounded-lg p-5 text-left transition duration-150 active:scale-[0.99]"
            >
              <span>
                <span className="block text-lg font-black text-white">{p2Name}</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Joueur 2</span>
              </span>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035]">
                <UserCircle className="h-6 w-6 text-zinc-300" />
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="nod-app text-zinc-100" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)" }}>
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
          <div className="nod-panel flex items-center justify-between rounded-lg px-3 py-3">
          <div className="flex items-center justify-between">
            <button onClick={openNameEditor} className="min-w-0 text-left">
              <p className="nod-eyebrow">Session active</p>
              <p className="truncate text-base font-black text-white">
                {myDisplayName} <Pencil className="mb-0.5 ml-1 inline h-3.5 w-3.5 text-zinc-500" />
              </p>
            </button>
          </div>
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
          </div>
        </header>

        <div className="mb-5 grid grid-cols-3 gap-2">
          <div className="nod-metric rounded-lg p-3">
            <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">Fin du mois</p>
            <p className="text-sm font-black text-white">
              {countdown.days}j {countdown.hours}h {countdown.mins}m
            </p>
          </div>
          <div className="nod-metric rounded-lg p-3">
            <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">A juger</p>
            <p className="text-xl font-black text-amber-500">{pendingForMe.length}</p>
          </div>
          <div className="nod-metric rounded-lg p-3">
            <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">Arene</p>
            <p className="text-xl font-black text-red-300">{arena.length}</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {tab === "home" && (
            <motion.section
              key="home"
              {...pageTransition}
              drag={reduceMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => handleSectionDrag(info)}
              transition={{ duration: reduceMotion ? 0.01 : 0.24 }}
              className="space-y-4"
            >
              <div className="nod-panel-strong overflow-hidden rounded-lg p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="nod-eyebrow">Salon {roomCode}</p>
                    <h2 className="nod-title mt-3 text-3xl text-white">Tableau de bord</h2>
                  </div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-amber-700/35 bg-amber-600/10 text-amber-500">
                    <Sparkles className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.055]">
                  <motion.div
                    className="h-full rounded-full bg-amber-600 shadow-[0_0_18px_rgba(217,119,6,0.45)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressDone}%` }}
                    transition={{ duration: reduceMotion ? 0.01 : 0.5, ease: "easeOut" }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  <span>{archive.length} archives</span>
                  <span>Sync {lastSyncLabel}</span>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="nod-btn-primary flex w-full items-center justify-center gap-2 rounded-lg py-4 text-sm font-black uppercase tracking-[0.18em] transition active:scale-[0.99]"
              >
                <Plus className="h-4 w-4" /> Proposer
              </button>
            </motion.section>
          )}

          {tab === "verdict" && (
            <motion.section
              key="verdict"
              {...pageTransition}
              drag={reduceMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => handleSectionDrag(info)}
              transition={{ duration: reduceMotion ? 0.01 : 0.24 }}
              className="space-y-4"
            >
              {loadingList ? (
                <div className="nod-panel rounded-lg p-8 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-amber-600" />
                </div>
              ) : pendingForMe.length === 0 ? (
                <div className="nod-panel rounded-lg p-8 text-center">
                  <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-500/10">
                    <Check className="h-6 w-6 text-emerald-300" />
                  </span>
                  <p className="font-semibold text-zinc-200">Aucun dossier a juger.</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">Tout est synchronise pour cette session.</p>
                </div>
              ) : (
                pendingForMe.map((nomination) => {
                  const categoryMeta = getCategoryMeta(nomination.category_id);
                  const CategoryIcon = categoryMeta.icon;
                  const draftRating = clampRating(ratingDraftById[nomination.id] ?? 3);

                  return (
                    <article key={nomination.id} className="nod-panel overflow-hidden rounded-lg">
                      <div className="nod-media relative">
                        <MediaFrame nomination={nomination} />
                        <div className={`absolute left-3 top-3 flex items-center gap-2 rounded-md border px-3 py-1 text-xs font-black backdrop-blur ${moodBadgeClass(categoryMeta.mood)}`}>
                          <CategoryIcon className="h-3.5 w-3.5 text-amber-500" />
                          {categoryMeta.label}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4">
                          <p className="text-sm font-semibold text-white">&quot;{nomination.comment}&quot;</p>
                        </div>
                      </div>
                      <div className="space-y-3 p-4">
                        <StarInput value={draftRating} onChange={(value) => setRatingDraftById((prev) => ({ ...prev, [nomination.id]: value }))} size="lg" />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => void applyVote(nomination.id, "nominee")}
                            disabled={voteBusyId === nomination.id}
                            className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 py-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition active:scale-[0.99] disabled:opacity-60"
                          >
                            Nomine
                          </button>
                          <button
                            onClick={() => void applyVote(nomination.id, "ejected")}
                            disabled={voteBusyId === nomination.id}
                            className="rounded-lg border border-red-400/20 bg-red-500/10 py-3 text-xs font-black uppercase tracking-[0.14em] text-red-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition active:scale-[0.99] disabled:opacity-60"
                          >
                            Ejecte
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </motion.section>
          )}

          {tab === "arena" && (
            <motion.section
              key="arena"
              {...pageTransition}
              drag={reduceMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => handleSectionDrag(info)}
              transition={{ duration: reduceMotion ? 0.01 : 0.24 }}
              className="space-y-4"
            >
              {arena.length === 0 ? (
                <div className="nod-panel rounded-lg p-8 text-center">
                  <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035]">
                    <Scale className="h-6 w-6 text-zinc-500" />
                  </span>
                  <p className="font-semibold text-zinc-200">Aucun debat en cours.</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">Les accords et rejets passent directement en galerie.</p>
                </div>
              ) : (
                arena.map((nomination) => {
                  const rounds = trialRoundsByNomination[nomination.id] ?? [];
                  const nextRound = role ? getNextRoundForRole(rounds, role) : null;

                  return (
                    <article key={nomination.id} className="nod-panel overflow-hidden rounded-lg border-red-400/25">
                      <div className="nod-media">
                        <MediaFrame nomination={nomination} height="h-56" />
                      </div>
                      <div className="space-y-4 p-4">
                        <p className="text-sm font-semibold text-zinc-100">&quot;{nomination.comment}&quot;</p>
                        <div className="space-y-2">
                          {[1, 2, 3].map((round) => {
                            const roundItems = rounds.filter((item) => item.round_number === round);
                            return (
                              <div key={round} className="rounded-lg border border-white/[0.07] bg-black/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-red-300">Round {round}</p>
                                {roundItems.length === 0 ? (
                                  <p className="text-xs text-zinc-600">En attente.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {roundItems.map((item) => (
                                      <div key={item.id} className="text-xs leading-5 text-zinc-300">
                                        <span className="font-black text-zinc-100">{item.player_role === "player_1" ? p1Name : p2Name}: </span>
                                        {item.body}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {nextRound ? (
                          <div className="flex gap-2">
                            <input
                              value={argumentDraftById[nomination.id] ?? ""}
                              onChange={(event) => setArgumentDraftById((prev) => ({ ...prev, [nomination.id]: event.target.value }))}
                              maxLength={180}
                              placeholder={`Round ${nextRound}`}
                              className="nod-input min-w-0 flex-1 rounded-lg px-3 py-3 text-sm"
                            />
                            <button
                              onClick={() => void submitTrialArgument(nomination.id)}
                              disabled={argumentBusyId === nomination.id}
                              className="nod-btn-primary min-h-0 rounded-lg px-4 text-black disabled:opacity-60"
                              aria-label="Envoyer"
                            >
                              {argumentBusyId === nomination.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </button>
                          </div>
                        ) : null}
                        <button
                          onClick={() => void deleteNomination(nomination.id)}
                          disabled={deleteBusyId === nomination.id}
                          className="w-full rounded-lg border border-red-400/20 bg-red-500/10 py-3 text-xs font-black uppercase tracking-[0.14em] text-red-300 transition active:scale-[0.99] disabled:opacity-60"
                        >
                          Supprimer
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </motion.section>
          )}

          {tab === "gallery" && (
            <motion.section
              key="gallery"
              {...pageTransition}
              drag={reduceMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => handleSectionDrag(info)}
              transition={{ duration: reduceMotion ? 0.01 : 0.24 }}
              className="space-y-3"
            >
              {archive.length === 0 ? (
                <div className="nod-panel rounded-lg p-8 text-center">
                  <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035]">
                    <ImageIcon className="h-6 w-6 text-zinc-500" />
                  </span>
                  <p className="font-semibold text-zinc-200">La galerie est vide.</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">Les dossiers juges seront conserves en miniature.</p>
                </div>
              ) : (
                archive.map((nomination) => {
                  const rating = averageRating(nomination);
                  return (
                    <article key={nomination.id} className="nod-panel flex gap-3 rounded-lg p-2">
                      <div className="nod-media h-20 w-20 shrink-0 rounded-md">
                        <MediaFrame nomination={nomination} height="h-20" controls={false} />
                      </div>
                      <div className="min-w-0 flex-1 py-1">
                        <span
                          className={`mb-2 inline-flex rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                            nomination.status === "accepted"
                              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                              : "border-red-400/30 bg-red-500/10 text-red-300"
                          }`}
                        >
                          {statusLabel(nomination.status)}
                        </span>
                        <p className="truncate text-xs font-semibold text-zinc-100">&quot;{nomination.comment}&quot;</p>
                        <p className="mt-1 text-[11px] text-zinc-500">{rating ? rating.toFixed(1) : "-"} / 5</p>
                      </div>
                      <button onClick={() => void deleteNomination(nomination.id)} className="rounded-md p-2 text-zinc-500 transition hover:text-zinc-300 active:scale-95" aria-label="Supprimer">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </article>
                  );
                })
              )}
            </motion.section>
          )}

          {tab === "ceremony" && (
            <motion.section
              key="ceremony"
              {...pageTransition}
              drag={reduceMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => handleSectionDrag(info)}
              transition={{ duration: reduceMotion ? 0.01 : 0.24 }}
              className="space-y-4"
            >
              <div className="nod-panel-strong rounded-lg p-5 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-amber-700/35 bg-amber-600/10">
                  <Trophy className="h-6 w-6 text-amber-500" />
                </span>
                <h2 className="mt-3 text-xl font-black text-white">Palmares du mois</h2>
              </div>
              {categoryWinners.length === 0 ? (
                <div className="nod-panel rounded-lg p-8 text-center">
                  <p className="font-semibold text-zinc-200">Aucun gagnant pour le moment.</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">La ceremonie se remplit avec les dossiers acceptes.</p>
                </div>
              ) : (
                categoryWinners.map(({ category, winner }) => {
                  const CategoryIcon = category.icon;
                  return (
                    <article key={winner.id} className="nod-panel flex gap-3 rounded-lg border-amber-700/30 p-3">
                      <div className="nod-media h-20 w-20 shrink-0 rounded-md">
                        <MediaFrame nomination={winner} height="h-20" controls={false} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-500">
                          <CategoryIcon className="h-3.5 w-3.5" /> {category.label}
                        </p>
                        <p className="mt-2 truncate text-sm font-semibold text-white">&quot;{winner.comment}&quot;</p>
                        <p className="mt-1 text-[11px] text-zinc-500">{averageRating(winner)?.toFixed(1)} / 5</p>
                      </div>
                    </article>
                  );
                })
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {tab !== "home" && (
        <motion.button
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          onClick={() => setShowAddModal(true)}
          className="nod-btn-primary fixed right-5 z-40 flex h-14 w-14 items-center justify-center rounded-lg active:scale-95"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}
          aria-label="Ajouter"
        >
          <Plus className="h-6 w-6" />
        </motion.button>
      )}

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 30 }}
            className="nod-sheet fixed inset-0 z-50 overflow-y-auto px-4"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 14px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
          >
            <div className="mx-auto w-full max-w-md">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-xl font-black text-white">Nouveau dossier</h3>
                <button onClick={closeAddModal} className="nod-btn-quiet rounded-lg p-2.5 text-zinc-300" aria-label="Fermer">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-5">
                <label className="nod-panel relative flex h-64 cursor-pointer items-center justify-center overflow-hidden rounded-lg active:scale-[0.995]">
                  {previewUrl ? (
                    <video src={previewUrl} poster={thumbnailPreviewUrl ?? undefined} className="absolute inset-0 h-full w-full object-cover" controls playsInline muted preload="metadata" />
                  ) : (
                    <div className="text-center">
                      {processingMedia ? <Loader2 className="mx-auto mb-2 h-7 w-7 animate-spin text-amber-600" /> : <Upload className="mx-auto mb-2 h-7 w-7 text-zinc-500" />}
                      <p className="text-sm font-semibold text-zinc-300">{processingMedia ? "Preparation..." : "Ajouter une video"}</p>
                    </div>
                  )}
                  <input type="file" accept="video/*" onChange={(event) => void onFileChange(event.target.files?.[0] ?? null)} className="hidden" />
                </label>

                {thumbnailPreviewUrl && (
                  <div className="nod-panel flex items-center gap-3 rounded-lg p-3">
                    <img src={thumbnailPreviewUrl} alt="" className="h-14 w-14 rounded-md object-cover shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" />
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400">Miniature</p>
                      <p className="text-xs text-zinc-500">{videoDuration ? `${videoDuration.toFixed(1)}s` : "Pret"}</p>
                    </div>
                  </div>
                )}

                <select
                  value={catId}
                  onChange={(event) => setCatId(event.target.value)}
                  className="nod-input w-full rounded-lg p-4 text-sm font-semibold"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>

                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Pourquoi ce dossier ?"
                  rows={3}
                  maxLength={240}
                  className="nod-input w-full resize-none rounded-lg p-4 text-sm"
                />

                <div className="nod-panel rounded-lg p-3">
                  <StarInput value={initialRating} onChange={setInitialRating} size="lg" />
                  <p className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                    Vote initial: {verdictLabel(initialRating >= 3 ? "nominee" : "ejected")}
                  </p>
                </div>

                <button
                  onClick={() => void uploadNomination()}
                  disabled={uploadLoading || processingMedia || !file || !thumbnailFile || comment.trim().length < 3}
                  className="nod-btn-primary flex w-full items-center justify-center gap-2 rounded-lg py-4 text-sm font-black uppercase tracking-[0.16em] disabled:opacity-50"
                >
                  {uploadLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Soumettre"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingName && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-5 backdrop-blur-md">
            <div className="nod-panel-strong w-full max-w-sm rounded-lg p-5">
              <h3 className="mb-3 text-lg font-black text-white">Changer de pseudo</h3>
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="nod-bottom-nav fixed bottom-0 left-0 right-0 z-40 px-2 pt-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}>
        <div className="mx-auto grid w-full max-w-md grid-cols-5 gap-1">
          {TAB_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            const badge = item.id === "verdict" ? pendingForMe.length : item.id === "arena" ? arena.length : 0;

            return (
              <button key={item.id} onClick={() => setTab(item.id)} className="relative flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-2.5 transition active:scale-95">
                {active && <motion.span layoutId="activeTab" className="absolute inset-0 rounded-lg border border-white/10 bg-white/[0.055]" transition={{ type: "spring", stiffness: 360, damping: 28 }} />}
                <Icon className={`relative z-10 h-5 w-5 ${active ? "text-amber-500" : "text-zinc-500"}`} />
                <span className={`relative z-10 text-[9px] font-black uppercase tracking-[0.08em] ${active ? "text-amber-500" : "text-zinc-500"}`}>{item.label}</span>
                {badge > 0 && (
                  <span className={`absolute right-1.5 top-1.5 z-20 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-black ${item.id === "arena" ? "bg-red-500 text-white" : "bg-amber-600 text-black"}`}>
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
