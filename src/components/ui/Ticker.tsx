import type { ReactNode } from "react";

export function Ticker({ children }: { children: ReactNode }) {
  return (
    <div className="ticker relative flex overflow-hidden whitespace-nowrap w-full">
      <div className="ticker-track" style={{ display: "flex", width: "fit-content" }}>
        <span className="inline-block whitespace-nowrap px-2">
          {children}
        </span>
        <span className="inline-block whitespace-nowrap px-2" aria-hidden="true">
          {children}
        </span>
      </div>
    </div>
  );
}
