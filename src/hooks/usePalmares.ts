import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// Define structures matching your Supabase schemas
export interface Tiktoker {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  follower_count: number;
  bio: string;
  category: string;
  created_at: string;
}

export interface Nomination {
  id: string;
  tiktoker_id: string;
  nomination_category: string;
  initiated_by: string;
  status: "active" | "pending" | "completed" | "withdrawn";
  reason: string;
  votes_count: number;
  created_at: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Custom Hook to fetch profiles for Palmarès (Section 4)
 * Solves empty/winners-only page bug by retrieving ANY user with at least one active nomination
 * Logic: SELECT DISTINCT t.* FROM tiktokers t JOIN nominations n ON t.id = n.tiktoker_id WHERE n.status = 'active'
 */
export function usePalmares() {
  const [profiles, setProfiles] = useState<Tiktoker[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPalmares = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // We perform an inner join by requesting nominations!inner(*)
      // This automatically yields a strict INNER JOIN on SQL layer
      // PostgREST rolls nested structures into distinct parent objects naturally,
      // avoiding duplicate Tiktoker records in your React array
      const { data, error: supabaseError } = await supabase
        .from("tiktokers")
        .select(
          `
          *,
          nominations!inner(
            id,
            status
          )
        `,
        )
        .eq("nominations.status", "active");

      if (supabaseError) {
        throw supabaseError;
      }

      // Safeguard & typecast, stripping child fields to get standard profiles list
      const typedData = data as (Tiktoker & { nominations: any[] })[];
      const uniqueProfiles = typedData.map(
        ({ nominations, ...tiktoker }) => tiktoker,
      );

      setProfiles(uniqueProfiles);
    } catch (err: any) {
      console.error("Palmares fetch query error:", err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPalmares();
  }, [fetchPalmares]);

  return { profiles, loading, error, refetch: fetchPalmares };
}
