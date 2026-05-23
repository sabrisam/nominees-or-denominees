export const theme = {
  colors: {
    void: "#050505",
    monolith: "#0c0c0c",
    cream: "#f5f1e8",
    champagne: "#d4af37",
    champagneSoft: "#f0d889",
    muted: "#9a9387",
    danger: "#a93535",
    success: "#22c55e",
    bronze: "#8a6f24",
    electricGreen: "#39FF14",
    silver: "#c0c0c0",
    yellow: "#facc15",
    sky: "#38bdf8",
    rose: "#f43f5e",
    violet: "#a78bfa",
    orange: "#ea580c",
    cyan: "#06b6d4",
    teal: "#14b8a6",
    white: "#ffffff",
    black: "#000000",
  },
  shadows: {
    brutal: "8px 8px 0px 0px rgba(0, 0, 0, 1)",
    champagneGlow: "0 0 12px rgba(212, 175, 55, 0.25)",
    toast: "0 14px 36px rgba(0, 0, 0, 0.45)",
    electricGlow: "0 0 20px rgba(57, 255, 20, 0.3)",
    fab: "0 14px 34px rgba(212, 175, 55, 0.22)",
  },
  gradients: {
    gold: "linear-gradient(135deg, #d4af37, #f0d889 52%, #9c7425)",
    goldSoft: "linear-gradient(135deg, #d4af37, #f0d889)",
  },
} as const;

export type Theme = typeof theme;
