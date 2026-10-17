"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";

/**
 * Re-render server data when another member changes rows in `table`.
 * Debounced so a burst (e.g. bulk import) causes a single refresh.
 */
export function useRealtimeRefresh(table: string, householdId: string) {
  const router = useRouter();
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const channel = supabase
      .channel(`${table}:${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table, filter: `household_id=eq.${householdId}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 350);
      });
    (async () => {
      await supabase.realtime.setAuth();
      if (!cancelled) channel.subscribe();
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [table, householdId, router]);
}
