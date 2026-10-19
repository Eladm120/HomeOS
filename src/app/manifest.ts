import type { MetadataRoute } from "next";

/** Web Share Target (supported on Android): share a post from Instagram/TikTok straight into a new recipe. */
type ShareTarget = { share_target: { action: string; method: "GET"; params: { title: string; text: string; url: string } } };

export default function manifest(): MetadataRoute.Manifest & ShareTarget {
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
    background_color: "#121010",
    theme_color: "#121010",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: { action: "/recipes/new", method: "GET", params: { title: "title", text: "text", url: "url" } },
    shortcuts: [
      { name: "רשימת קניות", url: "/shopping" },
      { name: "מלאי", url: "/inventory" },
    ],
  };
}
