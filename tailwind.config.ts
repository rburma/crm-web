import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef3ff",
          100: "#dbe6ff",
          200: "#bccfff",
          500: "#2f6bff",
          600: "#1f56e6",
          700: "#1a46bf",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.10)",
      },
    },
  },
  plugins: [],
};

export default config;
