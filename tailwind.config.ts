import type { Config } from "tailwindcss";
import { theme } from "./src/lib/tokens";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: theme.colors.void,
        monolith: theme.colors.monolith,
        cream: theme.colors.cream,
        champagne: theme.colors.champagne,
        champagneSoft: theme.colors.champagneSoft,
        muted: theme.colors.muted,
        danger: theme.colors.danger,
        success: theme.colors.success,
        bronze: theme.colors.bronze,
        electricGreen: theme.colors.electricGreen,
        silver: theme.colors.silver,
        yellow: theme.colors.yellow,
        sky: theme.colors.sky,
        rose: theme.colors.rose,
        violet: theme.colors.violet,
        orange: theme.colors.orange,
        cyan: theme.colors.cyan,
        teal: theme.colors.teal,
      },
      boxShadow: {
        amber: "0 20px 60px rgba(217, 119, 6, 0.25)",
        brutal: theme.shadows.brutal,
        champagne: theme.shadows.champagneGlow,
        electricGlow: theme.shadows.electricGlow,
        fab: theme.shadows.fab,
      },
      fontFamily: {
        sans: ["var(--font-body)"],
        serif: ["var(--font-serif)"],
        display: ["var(--font-display)"],
      },
    },
  },
  plugins: [],
};

export default config;
