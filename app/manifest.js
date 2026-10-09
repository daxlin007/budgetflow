export default function manifest() {
  return {
    name: "Beldav — Household Budget Tracker",
    short_name: "Beldav",
    description: "Chat your spending. It gets categorized automatically.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0C0E13",
    theme_color: "#0C0E13",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
