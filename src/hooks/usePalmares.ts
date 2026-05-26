import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { PalmaresRow, StarDistribution } from "@/types";

export function usePalmares(supabaseClientOverride?: any, roomCodeOverride?: string) {
  const [palmaresRows, setPalmaresRows] = useState<PalmaresRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPalmaresData = useCallback(async () => {
    setIsLoading(true);
    try {
      const activeClient = supabaseClientOverride || supabase;
      if (!activeClient) {
        setIsLoading(false);
        return;
      }

      // Query leverages Supabase to fetch all nominations with their nested ratings, grouping them dynamically on the client side for maximum reliability
      const { data, error } = await activeClient
        .from("nominations")
        .select(`
          id,
          status,
          category_ids,
          tiktoker_name,
          thumbnail_url,
          media_url,
          ratings (
            id,
            rating_points,
            rating_score,
            rire_score,
            surprise_score,
            gene_score,
            fierte_score,
            interet_score
          )
        `);

      if (error) {
        console.error("[NOD usePalmares] error:", error);
        setPalmaresRows([]);
        return;
      }

      // Group nominations by tiktoker_name (case-insensitive)
      const groups: Record<string, {
        tiktokerName: string;
        avatarUrl: string;
        nominations: any[];
      }> = {};

      (data || []).forEach((n: any) => {
        const nameKey = (n.tiktoker_name || "").trim().toLowerCase();
        if (!nameKey) return;

        if (!groups[nameKey]) {
          groups[nameKey] = {
            tiktokerName: n.tiktoker_name,
            avatarUrl: n.thumbnail_url || n.media_url || "",
            nominations: [],
          };
        }
        groups[nameKey].nominations.push(n);
      });

      // Transform fetched data into typed PalmaresRow[] state matrices
      const rows: PalmaresRow[] = Object.values(groups).map((group: any) => {
        const linkedNominations = group.nominations || [];
        const totalDossiers = linkedNominations.length;
        const acceptedDossiers = linkedNominations.filter((n: any) => n.status !== "pending").length;
        const successRate = totalDossiers > 0 ? (acceptedDossiers / totalDossiers) * 100 : 0;
        
        let points = 0;
        let votes = 0;
        const starDistribution: StarDistribution = [0, 0, 0, 0, 0];
        const categoryCounts: Record<string, number> = {};
        const dimensionTotals = { rire: 0, surprise: 0, gene: 0, fierte: 0, interet: 0 };

        linkedNominations.forEach((n: any) => {
          // Track category nominations count
          if (n.category_ids && Array.isArray(n.category_ids)) {
            n.category_ids.forEach((catId: string) => {
              categoryCounts[catId] = (categoryCounts[catId] ?? 0) + 1;
            });
          }

          const ratingsList = n.ratings || [];
          ratingsList.forEach((r: any) => {
            points += r.rating_points || 0;
            votes += 1;
            const stars = Math.round(r.rating_score || 0);
            if (stars >= 1 && stars <= 5) {
              starDistribution[stars - 1] += 1;
            }
            dimensionTotals.rire += r.rire_score || 0;
            dimensionTotals.surprise += r.surprise_score || 0;
            dimensionTotals.gene += r.gene_score || 0;
            dimensionTotals.fierte += r.fierte_score || 0;
            dimensionTotals.interet += r.interet_score || 0;
          });
        });

        const average = votes > 0 ? points / votes / 20 : 0;

        return {
          tiktokerName: group.tiktokerName,
          avatarUrl: group.avatarUrl || "",
          points,
          votes,
          average,
          totalDossiers,
          acceptedDossiers,
          successRate,
          categoryCounts,
          starDistribution,
          dimensionTotals,
        };
      });

      // Sort profiles: highest points first
      const sorted = rows.sort((a, b) => b.points - a.points || b.successRate - a.successRate);
      setPalmaresRows(sorted);
    } catch (err) {
      console.error("[NOD usePalmares] exception:", err);
      setPalmaresRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [supabaseClientOverride]);

  useEffect(() => {
    void fetchPalmaresData();

    const activeClient = supabaseClientOverride || supabase;
    if (!activeClient) return;

    // Realtime channel to listen to nominations and ratings updates and trigger automatic synchronization
    const channel = activeClient
      .channel("palmares_realtime_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nominations" },
        () => {
          void fetchPalmaresData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ratings" },
        () => {
          void fetchPalmaresData();
        }
      )
      .subscribe();

    return () => {
      void channel.unsubscribe();
      void activeClient.removeChannel(channel);
    };
  }, [fetchPalmaresData, supabaseClientOverride]);

  return { palmaresRows, isLoading, fetchPalmaresData };
}
