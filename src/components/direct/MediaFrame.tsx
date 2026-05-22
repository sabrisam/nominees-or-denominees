import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LEGACY_FLOWER_VIDEO_URL, FALLBACK_IMAGE_URL } from "@/constants/categories";
import type { Nomination } from "@/types";

const HAPTICS = { media: 18 } as const;

function haptic(pattern: number | readonly number[]) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern as VibratePattern);
  } catch {
    // iOS Safari ignore souvent cette API
  }
}

function isLegacyDemoMedia(url: string) {
  return url === LEGACY_FLOWER_VIDEO_URL;
}

export function MediaFrame({
  nomination,
  height = "h-72",
  controls = false
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

  if (isLegacyDemoMedia(nomination.media_url)) {
    return (
      <div className={`${height} relative flex w-full items-center justify-center bg-black`}>
        {nomination.thumbnail_url ? <img src={nomination.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" /> : null}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 mx-3 rounded-full border border-[#d4af37]/60 bg-black/70 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.12em] leading-none text-[#f0d889]">
          Média de démo à renvoyer depuis le Studio
        </motion.div>
      </div>
    );
  }

  if (mediaFailed) {
    return (
      <div className={`${height} relative flex w-full items-center justify-center bg-black`}>
        {nomination.thumbnail_url ? <img src={nomination.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" /> : null}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 mx-3 flex flex-col items-center gap-1.5 rounded border border-red-500/40 bg-black/80 px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.06em] text-red-400">
          <span>Erreur de chargement du média</span>
          <span className="text-[9px] font-medium normal-case tracking-normal text-zinc-400">Vérifie ta connexion réseau ou les clés S3.</span>
        </motion.div>
      </div>
    );
  }

  if (nomination.media_kind === "video") {
    return (
      <div className={`${height} relative w-full overflow-hidden bg-black`}>
        <AnimatePresence>
          {resolving && (
            <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="media-shimmer absolute inset-0 z-10 flex items-center justify-center bg-black" aria-hidden="true">
              <Loader2 className="h-5 w-5 animate-spin text-[#d4af37]" />
            </motion.div>
          )}
        </AnimatePresence>
        <motion.video
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: resolving ? 0 : 1, scale: resolving ? 1.05 : 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          src={nomination.media_url}
          poster={nomination.thumbnail_url ?? undefined}
          autoPlay
          controls={controls}
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
        {!controls && !engaged ? <span className="pointer-events-none absolute bottom-2 left-2 z-20 rounded-full border border-[#d4af37]/40 bg-black/60 px-2 py-1 text-[8px] font-black uppercase tracking-tighter text-[#f0d889]">Rec</span> : null}
      </div>
    );
  }

  return (
    <div className={`${height} relative w-full overflow-hidden bg-black`}>
      <AnimatePresence>
        {resolving && (
          <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="media-shimmer absolute inset-0 z-10 flex items-center justify-center bg-black" aria-hidden="true">
            <Loader2 className="h-5 w-5 animate-spin text-[#d4af37]" />
          </motion.div>
        )}
      </AnimatePresence>
      <motion.img
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: resolving ? 0 : 1, scale: resolving ? 1.05 : 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
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
