import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        signal: {
          ok: "hsl(152 60% 48%)",
          warn: "hsl(38 92% 56%)",
          alert: "hsl(0 72% 56%)",
          info: "hsl(212 80% 60%)",
        },
        quicknode: {
          green: "#6CFF75",
          "green-deep": "hsl(124 80% 50%)",
          ink: "#2B2B2B",
        },
        tremor: {
          brand: {
            faint: "hsl(212 80% 12%)",
            muted: "hsl(212 80% 24%)",
            subtle: "hsl(212 80% 38%)",
            DEFAULT: "hsl(212 80% 60%)",
            emphasis: "hsl(212 80% 70%)",
            inverted: "hsl(0 0% 100%)",
          },
          background: {
            muted: "hsl(220 14% 6%)",
            subtle: "hsl(220 14% 10%)",
            DEFAULT: "hsl(220 14% 8%)",
            emphasis: "hsl(220 14% 16%)",
          },
          border: { DEFAULT: "hsl(220 14% 18%)" },
          ring: { DEFAULT: "hsl(212 80% 60%)" },
          content: {
            subtle: "hsl(220 9% 50%)",
            DEFAULT: "hsl(220 9% 70%)",
            emphasis: "hsl(220 9% 90%)",
            strong: "hsl(220 9% 98%)",
            inverted: "hsl(220 14% 8%)",
          },
        },
      },
      keyframes: {
        "ring-pulse": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(1.4)", opacity: "0" },
        },
        "mesh-drift": {
          "0%, 100%": { transform: "translate3d(0,0,0)" },
          "50%": { transform: "translate3d(2%, -1%, 0)" },
        },
      },
      animation: {
        "ring-pulse": "ring-pulse 700ms ease-out forwards",
        "mesh-drift": "mesh-drift 24s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
};

export default config;
