"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

let browserClient: SupabaseClient | undefined;

/** Browser client (anon key only). All access is constrained by RLS. */
export function getSupabaseBrowser(): SupabaseClient {
  browserClient ??= createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return browserClient;
}
