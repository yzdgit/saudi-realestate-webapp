import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient: ReturnType<typeof createClient> | null = null;

function assertSupabaseEnv(): { url: string; anonKey: string } {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return { url: supabaseUrl, anonKey: supabaseAnonKey };
}

export function getSupabaseBrowserClient() {
  if (typeof window === "undefined") {
    throw new Error("Supabase browser client can only be used in the browser runtime");
  }

  if (!browserClient) {
    const env = assertSupabaseEnv();
    browserClient = createClient(env.url, env.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          apikey: env.anonKey,
          Authorization: `Bearer ${env.anonKey}`
        }
      }
    });
  }

  return browserClient;
}

export function resetSupabaseBrowserClient() {
  browserClient = null;
}
