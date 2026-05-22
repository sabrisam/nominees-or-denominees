/**
 * iOS standalone PWA: 100dvh under-reports height by ~safe-area-inset-top on cold start.
 * Override --app-height to 100vh when launched from the home screen.
 * @see https://github.com/rcarmo/piclaw/blob/main/docs/PWA.md
 */

export function isStandalonePwa() {
  if (typeof window === "undefined") return false;

  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return navigatorWithStandalone.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

export function installStandaloneViewportFix() {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  if (isStandalonePwa()) {
    root.style.setProperty("--app-height", "100vh");
    root.style.setProperty("--app-width", "100vw");
    return;
  }

  root.style.removeProperty("--app-height");
  root.style.removeProperty("--app-width");
}

export function bindStandaloneViewportFix() {
  if (typeof window === "undefined") return () => undefined;

  installStandaloneViewportFix();

  const refresh = () => installStandaloneViewportFix();
  window.addEventListener("resize", refresh, { passive: true });
  window.visualViewport?.addEventListener("resize", refresh);

  return () => {
    window.removeEventListener("resize", refresh);
    window.visualViewport?.removeEventListener("resize", refresh);
  };
}
