import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const rubik = Rubik({ subsets: ["hebrew", "latin"], variable: "--font-rubik", display: "swap" });

export const metadata: Metadata = {
  title: { default: "HomeOS", template: "%s · HomeOS" },
  description: "מערכת ההפעלה של הבית — קניות, מלאי, משימות ועוד, במקום אחד משותף.",
  applicationName: "HomeOS",
  appleWebApp: { capable: true, title: "HomeOS", statusBarStyle: "default" },
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
    { media: "(prefers-color-scheme: light)", color: "#f8f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#161311" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body className={`${rubik.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
