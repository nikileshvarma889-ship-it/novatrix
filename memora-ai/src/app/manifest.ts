import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MEMORA AI",
    short_name: "MEMORA",
    description: "Your Memory. Your Studies. Your AI.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#080a16",
    theme_color: "#080a16",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Ask MEMORA", url: "/assistant", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My Memories", url: "/memories", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Study Planner", url: "/planner", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
