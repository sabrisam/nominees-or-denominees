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
      ...theme,
      boxShadow: theme.shadows,
    },
  },
  plugins: [],
};

export default config;
