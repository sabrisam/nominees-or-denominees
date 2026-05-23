import type { Config } from "tailwindcss";
import { theme as designTheme } from "./src/lib/tokens";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        void: designTheme.colors.void,
        monolith: designTheme.colors.monolith,
        champagne: designTheme.colors.champagne,
        champagneSoft: designTheme.colors.champagneSoft,
        cream: designTheme.colors.cream,
      },
      boxShadow: {
        amber: "0 20px 60px rgba(217, 119, 6, 0.25)",
        brutal: designTheme.shadows.brutal,
      }
    }
  },
  plugins: []
};

export default config;
