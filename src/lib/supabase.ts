import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const isBrowser = typeof window !== "undefined";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(url, anonKey, {
      auth: {
        storage: isBrowser ? window.localStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });
  }

  return browserClient;
}

export async function ensureAnonymousSession(client: SupabaseClient) {
  const { data: { session }, error: sessionError } = await client.auth.getSession();
  if (session?.user) {
    return session.user;
  }
  
  const { data: { user }, error: signInError } = await client.auth.signInAnonymously();
  if (signInError) {
    console.error("Failed to sign in anonymously:", signInError);
    return null;
  }
  
  return user;
}
