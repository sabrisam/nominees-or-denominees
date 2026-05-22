import type { SupabaseClient } from "@supabase/supabase-js";
import type { UploadReference } from "@/types";

export const STORAGE_UNAVAILABLE_NOTICE = "Stockage indisponible : échec du transfert serveur.";

const SUPABASE_STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "nod-media";

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

function inferBrowserContentType(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const currentType = file.type.toLowerCase();

  if (extension === "mp4" || currentType.includes("mp4")) return "video/mp4";
  if (extension === "mov" || extension === "qt" || currentType.includes("quicktime")) return "video/quicktime";
  if (extension === "webm" || currentType.includes("webm")) return "video/webm";
  if (extension === "webp" || currentType.includes("webp")) return "image/webp";
  if (extension === "jpg" || extension === "jpeg" || currentType.includes("jpeg")) return "image/jpeg";
  if (extension === "png" || currentType.includes("png")) return "image/png";

  return file.type || "application/octet-stream";
}

function mediaMonthKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function storageKey(file: File, folder: "videos" | "miniatures") {
  return `${folder}/${mediaMonthKey()}/${crypto.randomUUID()}-${sanitizeStorageFileName(file.name)}`;
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

export async function extractVideoThumbnail(file: File) {
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
  const contentType = inferBrowserContentType(file);
  const signResponse = await fetch("/api/spaces/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType,
      folder
    })
  });

  const payload = (await signResponse.json()) as {
    uploadUrl?: string;
    publicUrl?: string;
    key?: string;
    error?: string;
  };

  if (!signResponse.ok || !payload.uploadUrl || !payload.publicUrl || !payload.key) {
    throw new Error(STORAGE_UNAVAILABLE_NOTICE);
  }

  const uploadResponse = await fetch(payload.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file
  });

  if (!uploadResponse.ok) throw new Error(STORAGE_UNAVAILABLE_NOTICE);

  return {
    key: payload.key,
    publicUrl: payload.publicUrl
  };
}

async function uploadFileToSupabaseStorage(supabase: SupabaseClient, file: File, folder: "videos" | "miniatures") {
  const key = storageKey(file, folder);
  const contentType = inferBrowserContentType(file);

  const { error, data } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(key, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || contentType
  });

  if (error || !data?.path) {
    throw new Error(STORAGE_UNAVAILABLE_NOTICE);
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(data.path);

  if (!publicUrl) throw new Error(STORAGE_UNAVAILABLE_NOTICE);

  return {
    key: data.path,
    publicUrl
  };
}

export async function uploadFileOrFallback(
  supabase: SupabaseClient,
  file: File,
  folder: "videos" | "miniatures",
  signal?: AbortSignal
): Promise<UploadReference> {
  try {
    const uploaded = await uploadFileToSpaces(file, folder);
    if (signal?.aborted) throw new DOMException("Upload annulé.", "AbortError");
    return { ...uploaded, provider: "spaces" };
  } catch (spacesError) {
    if (signal?.aborted) throw spacesError;
    try {
      const uploaded = await uploadFileToSupabaseStorage(supabase, file, folder);
      if (signal?.aborted) throw new DOMException("Upload annulé.", "AbortError");
      return { ...uploaded, provider: "supabase" };
    } catch {
      throw new Error(STORAGE_UNAVAILABLE_NOTICE);
    }
  }
}

export function isStorageUnavailableMessage(message: string) {
  return message.toLowerCase().includes("stockage indisponible");
}
