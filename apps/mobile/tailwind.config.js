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
        // Genki design system palette (mirrors src/theme/genki.ts).
        genki: {
          g9: "#0F2A1D",
          g8: "#1A3D2B",
          g7: "#1F5236",
          g5: "#2E7D52",
          g3: "#7BBF9A",
          gt: "#E4F0EA",
          gtt: "#F0F7F3",
          bg: "#F1F5F2",
          text: "#0D1F14",
          muted: "#5C6D63",
          faint: "#8FA495",
          border: "rgba(13,31,20,0.07)",
        },
        // Document-type tag colors.
        tag: {
          lab: "#EDF5FB",
          labText: "#185FA5",
          rx: "#FEF3CD",
          rxText: "#7A5010",
          scan: "#E4F0EA",
          scanText: "#1A3D2B",
          bill: "#FAF3E0",
          billText: "#8B6914",
          disc: "#F3EDFB",
          discText: "#534AB7",
        },
      },
      borderRadius: {
        rs: "10px",
        rm: "14px",
        rl: "18px",
        rxl: "24px",
      },
      fontFamily: {
        // Platform serif: New York/Georgia on iOS & web, Noto Serif on Android.
        serif: ["Georgia", "serif"],
      },
    },
  },
  plugins: [],
}
