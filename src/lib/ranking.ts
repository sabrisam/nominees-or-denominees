import { FEATURED_CATEGORY_IDS, CATEGORIES, FALLBACK_IMAGE_URL } from "@/constants/categories";
import { 
  getCategoryMeta, 
  ratingImpactPoints, 
  ratingImpactScore, 
  createStarDistribution, 
  addToStarDistribution, 
  addScores, 
  cloneScores, 
  totalPoints, 
  averageRating 
} from "./scoring";
import type { Nomination, ScoreBoard, PalmaresRow, CategoryRace, CategoryRaceRow } from "@/types";

export function isCurrentMonth(dateValue: string) {
  const date = new Date(dateValue);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function buildScoreBoard(nominations: Nomination[], categoryId?: string): ScoreBoard[] {
  const monthlyQualified = nominations.filter(
    (nomination) => nomination.status !== "pending" && isCurrentMonth(nomination.created_at) && (!categoryId || nomination.category_ids.includes(categoryId))
  );
  const byTarget = new Map<string, ScoreBoard>();

  for (const nomination of monthlyQualified) {
    const category = getCategoryMeta(categoryId ?? nomination.category_id);
    const existing = byTarget.get(nomination.tiktoker_name) ?? {
      tiktokerName: nomination.tiktoker_name,
      category: categoryId ? category : undefined,
      points: 0,
      votes: 0,
      average: 0,
      nominations: 0
    };

    existing.nominations += 1;
    for (const rating of nomination.ratings) {
      existing.points += ratingImpactPoints(rating, categoryId ? [categoryId] : nomination.category_ids);
      existing.votes += 1;
    }
    existing.average = existing.votes > 0 ? existing.points / existing.votes / 20 : 0;
    byTarget.set(nomination.tiktoker_name, existing);
  }

  return Array.from(byTarget.values()).sort((a, b) => b.points - a.points || b.average - a.average || a.tiktokerName.localeCompare(b.tiktokerName));
}

export function bestSubmission(nominations: Nomination[]) {
  return nominations
    .filter((nomination) => nomination.status !== "pending" && isCurrentMonth(nomination.created_at))
    .sort((a, b) => totalPoints(b.ratings, b.category_ids) - totalPoints(a.ratings, a.category_ids) || averageRating(b.ratings, b.category_ids) - averageRating(a.ratings, a.category_ids))[0];
}

export function buildPalmaresRows(nominations: Nomination[]): PalmaresRow[] {
  const rows = new Map<string, PalmaresRow>();
  const monthly = nominations.filter((nomination) => isCurrentMonth(nomination.created_at));

  for (const nomination of monthly) {
    const key = nomination.tiktoker_name.trim().toLowerCase();
    const current = rows.get(key) ?? {
      tiktokerName: nomination.tiktoker_name,
      avatarUrl: nomination.thumbnail_url || nomination.media_url || FALLBACK_IMAGE_URL,
      points: 0,
      votes: 0,
      average: 0,
      totalDossiers: 0,
      acceptedDossiers: 0,
      successRate: 0,
      categoryCounts: Object.fromEntries(FEATURED_CATEGORY_IDS.map((id) => [id, 0])) as Record<string, number>,
      starDistribution: createStarDistribution(),
      dimensionTotals: cloneScores({ rire: 0, surprise: 0, gene: 0, fierte: 0, interet: 0 })
    };

    current.totalDossiers += 1;
    if (nomination.status !== "pending") current.acceptedDossiers += 1;
    for (const categoryId of nomination.category_ids) {
      if (FEATURED_CATEGORY_IDS.includes(categoryId as (typeof FEATURED_CATEGORY_IDS)[number])) {
        current.categoryCounts[categoryId] = (current.categoryCounts[categoryId] ?? 0) + 1;
      }
    }

    for (const rating of nomination.ratings) {
      current.points += ratingImpactPoints(rating, nomination.category_ids);
      current.votes += 1;
      addToStarDistribution(current.starDistribution, ratingImpactScore(rating, nomination.category_ids));
      addScores(current.dimensionTotals, rating.scores);
    }

    current.average = current.votes > 0 ? current.points / current.votes / 20 : 0;
    current.successRate = current.totalDossiers > 0 ? Math.round((current.acceptedDossiers / current.totalDossiers) * 100) : 0;
    rows.set(key, current);
  }

  return Array.from(rows.values()).sort((a, b) => b.points - a.points || b.successRate - a.successRate || b.average - a.average || a.tiktokerName.localeCompare(b.tiktokerName));
}

export function buildCategoryRaces(nominations: Nomination[]): CategoryRace[] {
  const monthly = nominations.filter((nomination) => isCurrentMonth(nomination.created_at));

  return CATEGORIES.map((category) => {
    const inCategory = monthly.filter((nomination) => nomination.category_ids.includes(category.id));
    const rows = new Map<string, CategoryRaceRow>();

    for (const nomination of inCategory) {
      const current = rows.get(nomination.tiktoker_name) ?? {
        tiktokerName: nomination.tiktoker_name,
        avatarUrl: nomination.thumbnail_url || nomination.media_url || FALLBACK_IMAGE_URL,
        points: 0,
        votes: 0,
        average: 0,
        totalDossiers: 0,
        acceptedDossiers: 0,
        pendingDossiers: 0,
        rejectedDossiers: 0,
        successRate: 0,
        starDistribution: createStarDistribution(),
        dimensionTotals: cloneScores({ rire: 0, surprise: 0, gene: 0, fierte: 0, interet: 0 })
      };

      current.totalDossiers += 1;
      if (nomination.status !== "pending") current.acceptedDossiers += 1;
      if (nomination.status === "pending") current.pendingDossiers += 1;
      if (nomination.status === "rejected") current.rejectedDossiers += 1;

      for (const rating of nomination.ratings) {
        current.points += ratingImpactPoints(rating, [category.id]);
        current.votes += 1;
        addToStarDistribution(current.starDistribution, ratingImpactScore(rating, [category.id]));
        addScores(current.dimensionTotals, rating.scores);
      }

      current.average = current.votes > 0 ? current.points / current.votes / 20 : 0;
      current.successRate = current.totalDossiers > 0 ? Math.round((current.acceptedDossiers / current.totalDossiers) * 100) : 0;
      rows.set(nomination.tiktoker_name, current);
    }

    return {
      category,
      totalDossiers: inCategory.length,
      rows: Array.from(rows.values()).sort((a, b) => b.points - a.points || b.successRate - a.successRate || b.average - a.average || a.tiktokerName.localeCompare(b.tiktokerName))
    };
  });
}
