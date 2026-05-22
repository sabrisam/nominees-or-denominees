"use client";

import { useEffect, type ReactNode } from "react";

function isStandalonePwa() {
  if (typeof window === "undefined") return false;

  const navigatorStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia("(display-mode: standalone)").matches || navigatorStandalone === true;
}

function syncAppHeight() {
  const root = document.documentElement;
  root.style.setProperty("--app-height", isStandalonePwa() ? "100vh" : "100dvh");
}

export function PwaRoot({ children }: { children: ReactNode }) {
  useEffect(() => {
    syncAppHeight();

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const onViewportChange = () => syncAppHeight();

    standaloneQuery.addEventListener("change", onViewportChange);
    window.addEventListener("resize", onViewportChange);
    window.visualViewport?.addEventListener("resize", onViewportChange);

    return () => {
      standaloneQuery.removeEventListener("change", onViewportChange);
      window.removeEventListener("resize", onViewportChange);
      window.visualViewport?.removeEventListener("resize", onViewportChange);
    };
  }, []);

  return <div className="pwa-root">{children}</div>;
}
