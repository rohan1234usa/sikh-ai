import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0F172A", // Deep Nihang Blue
          light: "#1E293B",
        },
        kesri: {
          DEFAULT: "#FF9933", // Spiritual Saffron
          hover: "#E68A00",
        },
        gold: {
          DEFAULT: "#F59E0B", // Accent Gold
        },
        offwhite: "#F8FAFC",
      },
    },
  },
  plugins: [],
};
export default config;