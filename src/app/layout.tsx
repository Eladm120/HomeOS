import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// Apple devices render SF / SF Hebrew via the system stack; Heebo is the fallback elsewhere.
const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo", display: "swap" });

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
    { media: "(prefers-color-scheme: light)", color: "#f3f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#101413" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body className={`${heebo.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
