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

      // Query leverages Supabase relational joins to fetch profiles and their linked nominations with ratings
      const { data, error } = await activeClient
        .from("tiktokers")
        .select(`
          id,
          name,
          avatar_url,
          nominations (
            id,
            status,
            category_ids,
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
          )
        `);

      if (error) {
        if (/relation ".*" does not exist/i.test(error.message)) {
          console.warn("[NOD usePalmares] tiktokers table not found, fallback to empty leaderboard");
        } else {
          console.error("[NOD usePalmares] error:", error);
        }
        setPalmaresRows([]);
        return;
      }

      // Transform fetched data into typed PalmaresRow[] state matrices
      const rows: PalmaresRow[] = (data || []).map((t: any) => {
        const linkedNominations = t.nominations || [];
        const totalDossiers = linkedNominations.length;
        const acceptedDossiers = linkedNominations.filter((n: any) => n.status !== "pending").length;
        const successRate = totalDossiers > 0 ? (acceptedDossiers / totalDossiers) * 100 : 0;
        
        let points = 0;
        let votes = 0;
        const starDistribution: StarDistribution = [0, 0, 0, 0, 0];
        const categoryCounts: Record<string, number> = {};
        const dimensionTotals = { rire: 0, surprise: 0, gene: 0, fierte: 0, interet: 0 };

        linkedNominations.forEach((n: any) => {
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
          tiktokerName: t.name,
          avatarUrl: t.avatar_url || "",
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
  }, [fetchPalmaresData]);

  return { palmaresRows, isLoading, fetchPalmaresData };
}
