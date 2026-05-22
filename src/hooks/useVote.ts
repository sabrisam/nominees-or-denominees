import { useCallback, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { cloneScores, scoreAverage, scoreTotal, statusFromRatings } from "@/lib/scoring";
import type { Nomination, DimensionScores, Rating, PendingRatingPayload } from "@/types";

const PENDING_RATINGS_KEY = "nod_pending_ratings";

function readPendingRatings(): PendingRatingPayload[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(PENDING_RATINGS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writePendingRatings(ratings: PendingRatingPayload[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PENDING_RATINGS_KEY, JSON.stringify(ratings));
}

export function useVote({
  nominations,
  setNominations,
  participantId,
  fetchNominations
}: {
  nominations: Nomination[];
  setNominations: React.Dispatch<React.SetStateAction<Nomination[]>>;
  participantId: string | null;
  fetchNominations: (silent?: boolean) => Promise<void>;
}) {

  const patchRatingLocally = useCallback((nominationId: string, rating: Rating) => {
    setNominations((current) =>
      current.map((nomination) => {
        if (nomination.id !== nominationId) return nomination;
        const nextRatings = [...nomination.ratings.filter((item) => item.voter_id !== rating.voter_id), rating].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return { ...nomination, ratings: nextRatings, status: statusFromRatings(nextRatings) };
      })
    );
  }, [setNominations]);

  const submitRatingSafely = useCallback(
    async (nomination: Nomination, scores: DimensionScores, review: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!participantId || !supabase) return false;

      const safeScores = cloneScores(scores);
      const safeReview = review.trim();
      const averageScore = scoreAverage(safeScores, nomination.category_ids);
      const impactPoints = scoreTotal(safeScores, nomination.category_ids);

      const rpcPayload = {
        target_nomination_id: nomination.id,
        voter_id: participantId,
        rire: safeScores.rire,
        surprise: safeScores.surprise,
        gene: safeScores.gene,
        fierte: safeScores.fierte,
        interet: safeScores.interet,
        reaction_comment: safeReview
      };

      const rpcResult = await supabase.rpc("submit_nomination_vote", rpcPayload);
      if (!rpcResult.error) return true;

      const legacyResult = await supabase.rpc("submit_nomination_vote", {
        target_nomination_id: nomination.id,
        voter_id: participantId,
        stars: Math.max(0, Math.round(averageScore)),
        reaction_comment: safeReview
      });
      if (!legacyResult.error) return true;

      const upsertResult = await supabase.from("ratings").upsert(
        {
          nomination_id: nomination.id,
          voter_id: participantId,
          rating_stars: Math.max(0, Math.round(averageScore)),
          rating_score: averageScore,
          rating_points: impactPoints,
          rire_score: safeScores.rire,
          surprise_score: safeScores.surprise,
          gene_score: safeScores.gene,
          fierte_score: safeScores.fierte,
          interet_score: safeScores.interet,
          comment: safeReview
        },
        { onConflict: "nomination_id,voter_id" }
      );

      return !upsertResult.error;
    },
    [participantId]
  );

  useEffect(() => {
    if (!participantId || nominations.length === 0) return;

    let cancelled = false;

    const flush = async () => {
      const pending = readPendingRatings();
      const mine = pending.filter((item) => item.voterId === participantId);
      if (mine.length === 0) return;

      const stillPending: PendingRatingPayload[] = [];

      for (const payload of mine) {
        const nomination = nominations.find((item) => item.id === payload.nominationId);
        if (!nomination) continue;

        try {
          const ok = await submitRatingSafely(nomination, cloneScores(payload.scores), payload.comment);
          if (!ok) stillPending.push(payload);
        } catch {
          stillPending.push(payload);
        }
      }

      if (cancelled) return;

      const others = pending.filter((item) => item.voterId !== participantId);
      writePendingRatings([...others, ...stillPending]);
      if (stillPending.length < mine.length) void fetchNominations(true);
    };

    void flush();
    const timer = window.setInterval(() => {
      void flush();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [fetchNominations, nominations, participantId, submitRatingSafely]);

  return {
    patchRatingLocally,
    submitRatingSafely,
    readPendingRatings,
    writePendingRatings
  };
}
