export const theme = {
  colors: {
    void: "#050505",
    monolith: "#0c0c0c",
    champagne: "#d4af37",
    champagneSoft: "#f0d889",
    cream: "#f5f1e8",
  },
  typography: {
    headers: "font-serif tracking-[-0.05em] leading-[0.85] uppercase",
    labels: "uppercase tracking-[0.15em] text-[10px]",
  },
  shadows: {
    brutal: "0 8px 0 0 #000000",
  },
} as const;

export type Theme = typeof theme;
