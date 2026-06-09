/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "../../packages/ui/src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Forest-green primary (light theme). Anchored on #14532d.
        primary: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#15803d",
          700: "#166534",
          800: "#14532d",
          900: "#14532d",
          DEFAULT: "#14532d",
        },
        // Semantic biomarker range colors (green = in range).
        range: {
          in: "#15803d",
          high: "#b45309",
          low: "#b45309",
        },
      },
      fontFamily: {
        // Platform serif: New York/Georgia on iOS & web, Noto Serif on Android.
        serif: ["Georgia", "serif"],
      },
    },
  },
  plugins: [],
}
