import { useState, useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PalmaresRow } from "@/types";

export function usePalmares(supabase: SupabaseClient | null, roomCode: string) {
  const [palmaresRows, setPalmaresRows] = useState<PalmaresRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !roomCode) {
      setIsLoading(false);
      return;
    }

    async function fetchLeaderboard() {
      setIsLoading(true);
      try {
        const targetMonth = new Date().toISOString();
        const { data, error } = await supabase.rpc("get_monthly_leaderboard", {
          room_code: roomCode,
          target_month: targetMonth
        });

        if (error) {
          console.error("Failed to fetch leaderboard:", error);
          setPalmaresRows([]);
        } else {
          setPalmaresRows(data || []);
        }
      } catch (err) {
        console.error("Leaderboard RPC exception:", err);
        setPalmaresRows([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLeaderboard();

    // Optionally set up a realtime listener on ratings or nominations to refetch
    // For now, it fetches on mount or roomCode change.
  }, [supabase, roomCode]);

  return { palmaresRows, isLoading };
}
