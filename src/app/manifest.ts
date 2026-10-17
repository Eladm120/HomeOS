import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HomeOS",
    short_name: "HomeOS",
    description: "מערכת ההפעלה של הבית",
    lang: "he",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f5f2",
    theme_color: "#f3f5f2",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "רשימת קניות", url: "/shopping" },
      { name: "עוזר HomeOS", url: "/assistant" },
      { name: "מלאי", url: "/inventory" },
    ],
  };
}
