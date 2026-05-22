export const TAP_REBOUND = { scale: 0.965, rotate: -0.35 };
export const TAP_TRANSITION = { type: "spring", stiffness: 900, damping: 32, mass: 0.42 } as const;

export const HAPTICS = {
  tap: 10,
  option: 14,
  nav: 16,
  media: 18,
  success: [15, 30, 10],
  remove: [25, 60],
  error: 100
} as const;

export function haptic(pattern: number | readonly number[]) {
  if (typeof window === "undefined" || !window.navigator.vibrate) return;
  try {
    window.navigator.vibrate(pattern);
  } catch {}
}
