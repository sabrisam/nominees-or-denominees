import type { ReactNode } from "react";

export function Ticker({ children }: { children: ReactNode }) {
  return (
    <div className="ticker relative overflow-hidden whitespace-nowrap w-full">
      <div className="ticker-track">
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
