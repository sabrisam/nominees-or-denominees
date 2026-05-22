import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const isBrowser = typeof window !== "undefined";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error(
      "[NOD] Supabase client manquant — variables d'env non lues en production.",
      { url: url ? `${url.slice(0, 30)}…` : "MANQUANT", anonKey: anonKey ? "présente" : "MANQUANTE" }
    );
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
  if (sessionError) {
    console.error("[NOD] getSession error:", sessionError);
  }
  if (session?.user) {
    return session.user;
  }
  
  const { data: { user }, error: signInError } = await client.auth.signInAnonymously();
  if (signInError) {
    console.error("[NOD] signInAnonymously error:", signInError);
    return null;
  }
  
  return user;
}

export async function exportAccountRecoveryCode(client: SupabaseClient): Promise<string | null> {
  const { data: { session } } = await client.auth.getSession();
  return session?.refresh_token ?? null;
}
