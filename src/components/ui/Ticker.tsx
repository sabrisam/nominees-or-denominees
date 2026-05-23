import type { ReactNode } from "react";

/**
 * Ticker — Marquee défilant haute performance.
 *
 * Architecture : pur CSS animation sur `transform: translateX`,
 * sans JS main-thread, locked 60 FPS sur iOS Safari.
 * Les enfants sont dupliqués (×4) pour un loop parfaitement
 * continu indépendamment de la longueur du contenu.
 */
export function Ticker({ children }: { children: ReactNode }) {
  return (
    <div
      className="ticker relative flex overflow-hidden whitespace-nowrap w-full"
      aria-live="off"
      aria-label={"Fil d" + "'" + "actualité NOD"}
    >
      <div className="ticker-track" aria-hidden="true">
        <span className="inline-block whitespace-nowrap px-3">{children}</span>
        <span className="inline-block whitespace-nowrap px-3">{children}</span>
        <span className="inline-block whitespace-nowrap px-3">{children}</span>
        <span className="inline-block whitespace-nowrap px-3">{children}</span>
      </div>
    </div>
  );
}
