/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        bf: {
          bg: "#0C0E13",
          card: "rgba(255,255,255,0.03)",
          border: "rgba(255,255,255,0.07)",
          text: "#E8E6E1",
          dim: "rgba(255,255,255,0.38)",
          accent: "#7CC5A8",
          accent2: "#E8927C",
          surface: "#14161D",
          warn: "#C5B87C",
        },
      },
      fontFamily: {
        sans: ["Outfit", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
