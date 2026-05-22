import type { SupabaseClient } from "@supabase/supabase-js";
import type { UploadReference } from "@/types";

const STORAGE_UNAVAILABLE_NOTICE = "Stockage indisponible : échec du transfert serveur.";

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

export async function uploadFileOrFallback(supabase: SupabaseClient, file: File, folder: "videos" | "miniatures", signal?: AbortSignal): Promise<UploadReference> {
  const sessionData = await supabase.auth.getSession();
  const token = sessionData.data.session?.access_token || "";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const response = await fetch("/api/media/upload", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`
    },
    body: formData,
    signal
  });

  if (!response.ok) {
    throw new Error(STORAGE_UNAVAILABLE_NOTICE);
  }

  const payload = await response.json();
  if (!payload.ok || !payload.publicUrl || !payload.key) {
    throw new Error(STORAGE_UNAVAILABLE_NOTICE);
  }

  return {
    key: payload.key,
    publicUrl: payload.publicUrl,
    provider: payload.provider || "supabase"
  };
}
