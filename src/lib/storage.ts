import type { SupabaseClient } from "@supabase/supabase-js";
import type { UploadReference } from "@/types";

export const STORAGE_UNAVAILABLE_NOTICE = "Stockage indisponible : échec du transfert serveur.";

const SUPABASE_STORAGE_BUCKET = "nod-media";

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

/** iOS Photo Library often yields empty MIME — normalize before upload/decode. */
export function resolveIosMediaType(file: File): string {
  const declared = file.type.trim().toLowerCase();
  if (declared) return declared;

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const byExt: Record<string, string> = {
    heic: "image/heic",
    heif: "image/heif",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
    mov: "video/quicktime",
    m4v: "video/mp4"
  };

  return byExt[ext] ?? "application/octet-stream";
}

export function asTypedFile(file: File): File {
  const type = resolveIosMediaType(file);
  if (file.type === type) return file;
  return new File([file], file.name, { type, lastModified: file.lastModified });
}

export function isImageMedia(file: File) {
  return resolveIosMediaType(file).startsWith("image/");
}

export function isVideoMedia(file: File) {
  return resolveIosMediaType(file).startsWith("video/");
}

export function waitForMediaEvent(target: HTMLMediaElement, eventName: string, timeoutMs = 15000) {
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

export function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number) {
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

export function scaledSize(width: number, height: number, maxLongEdge: number, maxShortEdge: number) {
  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);
  const scale = Math.min(1, maxLongEdge / longEdge, maxShortEdge / shortEdge);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

export async function compressImageToWebp(file: File) {
  const typed = asTypedFile(file);
  const bitmap = await createImageBitmap(typed);
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

export async function extractVideoThumbnail(file: File) {
  const typed = asTypedFile(file);
  const objectUrl = URL.createObjectURL(typed);
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

/** Direct browser SDK upload to nod-media — no server routes. */
export async function uploadMediaFile(
  supabase: SupabaseClient,
  file: File,
  folder: "videos" | "miniatures",
  signal?: AbortSignal
): Promise<UploadReference> {
  if (signal?.aborted) throw new DOMException("Upload annulé.", "AbortError");

  const typed = asTypedFile(file);
  const storagePath = storageKey(typed, folder);
  const contentType = typed.type || resolveIosMediaType(typed);

  const { data, error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(storagePath, typed, {
    cacheControl: "3600",
    upsert: true,
    contentType
  });

  if (signal?.aborted) throw new DOMException("Upload annulé.", "AbortError");

  if (error || !data?.path) {
    console.error("[Supabase Storage Error]:", error);
    throw new Error(STORAGE_UNAVAILABLE_NOTICE);
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(data.path);

  if (!publicUrl) throw new Error(STORAGE_UNAVAILABLE_NOTICE);

  return {
    key: data.path,
    publicUrl,
    provider: "supabase"
  };
}

export function isStorageUnavailableMessage(message: string) {
  return message.toLowerCase().includes("stockage indisponible");
}
