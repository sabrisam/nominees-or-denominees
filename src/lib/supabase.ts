import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const isBrowser = typeof window !== "undefined";

const secureCookieAdapter = {
  getItem: async (key: string) => {
    if (!isBrowser) return null;
    try {
      const res = await fetch(`/api/auth/session?key=${encodeURIComponent(key)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.value;
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    if (!isBrowser) return;
    try {
      await fetch(`/api/auth/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", key, value })
      });
    } catch (err) {
      console.error("Failed to set session", err);
    }
  },
  removeItem: async (key: string) => {
    if (!isBrowser) return;
    try {
      await fetch(`/api/auth/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", key })
      });
    } catch (err) {
      console.error("Failed to remove session", err);
    }
  }
};

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
        storage: secureCookieAdapter,
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

export function exportAccountRecoveryCode(client: SupabaseClient): Promise<string | null> {
  return new Promise(async (resolve) => {
    const { data: { session } } = await client.auth.getSession();
    if (session?.access_token) {
      // Return the token as a string for recovery. In a real app this might be an encrypted backup.
      resolve(session.access_token);
    } else {
      resolve(null);
    }
  });
}
