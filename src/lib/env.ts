export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export function isSupabaseConfigured(): boolean {
  return (
    publicEnv.supabaseUrl.startsWith("https://") &&
    !publicEnv.supabaseUrl.includes("YOUR-PROJECT-REF") &&
    publicEnv.supabaseAnonKey.length > 20
  );
}

export const MEDIA_BUCKET = "household-media";
