import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Inter", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        ink: {
          50: "#f5f6f8",
          100: "#e8eaef",
          200: "#c8ccd6",
          300: "#9ea4b3",
          400: "#6b7184",
          500: "#454a5b",
          600: "#2c3142",
          700: "#1c2030",
          800: "#13162a",
          900: "#0a0c1a",
          950: "#050614",
        },
        accent: {
          DEFAULT: "#6366f1",
          glow: "#818cf8",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "fade-in": "fadeIn 240ms ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
