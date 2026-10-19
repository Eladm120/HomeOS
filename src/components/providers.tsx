"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="homeos-theme-v2" disableTransitionOnChange>
      {children}
      <Toaster
        dir="rtl"
        position="top-center"
        richColors
        closeButton
        toastOptions={{ className: "font-sans", style: { borderRadius: "1rem" } }}
      />
      <ServiceWorkerRegistrar />
    </ThemeProvider>
  );
}
