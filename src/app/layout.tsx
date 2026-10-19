import type { Metadata, Viewport } from "next";
import { Heebo, IBM_Plex_Sans_Hebrew } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// Apple devices render SF / SF Hebrew via the system stack; Heebo is the fallback elsewhere.
const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo", display: "swap" });
// Display face where SF isn't available: crisp, editorial Hebrew.
const plex = IBM_Plex_Sans_Hebrew({ subsets: ["hebrew", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex", display: "swap" });

/** Apply the member's accent before first paint (no flash of the default colour). */
const ACCENT_SCRIPT = `try{var a=localStorage.getItem("homeos:accent");if(a&&/^(mauve|gold|peach)$/.test(a))document.documentElement.dataset.accent=a}catch(e){}`;

export const metadata: Metadata = {
  title: { default: "HomeOS", template: "%s · HomeOS" },
  description: "מערכת ההפעלה של הבית — קניות, מלאי, משימות ועוד, במקום אחד משותף.",
  applicationName: "HomeOS",
  appleWebApp: { capable: true, title: "HomeOS", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#121010" },
    { media: "(prefers-color-scheme: dark)", color: "#121010" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ACCENT_SCRIPT }} />
      </head>
      <body className={`${heebo.variable} ${plex.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
