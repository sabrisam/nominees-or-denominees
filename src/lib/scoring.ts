import { 
  CATEGORIES, 
  CATEGORY_BY_ID, 
  CATEGORY_ID_ALIASES, 
  CATEGORY_SCORING, 
  DEFAULT_DIMENSION_SCORES, 
  RATING_DIMENSIONS,
  MIN_PUBLIC_RATINGS
} from "@/constants/categories";
import type { 
  DimensionScores, 
  RatingDimensionKey, 
  Rating, 
  Nomination, 
  NominationStatus,
  StarDistribution
} from "@/types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function clampDimension(value: number) {
  return Math.min(5, Math.max(0, Math.round(value)));
}

export function clampRating(value: number) {
  return clampDimension(value);
}

export function cloneScores(scores: DimensionScores = DEFAULT_DIMENSION_SCORES): DimensionScores {
  return {
    rire: clampDimension(scores.rire),
    surprise: clampDimension(scores.surprise),
    gene: clampDimension(scores.gene),
    fierte: clampDimension(scores.fierte),
    interet: clampDimension(scores.interet)
  };
}

export function normalizedCategoryId(categoryId: string) {
  const resolved = CATEGORY_ID_ALIASES[categoryId] ?? categoryId;
  return CATEGORY_BY_ID[resolved] ? resolved : CATEGORIES[0].id;
}

export function scoreForCategory(scores: DimensionScores, categoryId?: string): number {
  const resolvedId = categoryId ? normalizedCategoryId(categoryId) : null;
  const profile = resolvedId ? CATEGORY_SCORING[resolvedId] : CATEGORY_SCORING[CATEGORIES[0].id];
  const lowIsStrong = profile?.lowIsStrong ?? {};
  const weights = profile?.weights ?? { rire: 0.2, surprise: 0.2, gene: 0.2, fierte: 0.2, interet: 0.2 };

  let sum = 0;
  for (const [dimension, value] of Object.entries(scores)) {
    const rawValue = clampDimension(value);
    const adjustedValue = lowIsStrong[dimension as keyof DimensionScores] ? (5 - rawValue) : rawValue;
    const weight = weights[dimension as keyof DimensionScores] ?? 0.2;
    sum += adjustedValue * weight;
  }

  return Math.min(100, Math.max(0, Math.round(sum * 20)));
}

export function pointsForCategory(scores: DimensionScores, categoryId: string) {
  const rawScore = scoreForCategory(scores, categoryId);
  const resolved = normalizedCategoryId(categoryId);
  if (["le-zin-du-mois", "la-fierte-des-notres", "xptdr", "la-roue-libre", "gros-chef-bandit", "lanalyse-pure"].includes(resolved)) {
    return Math.round(rawScore * 1.0);
  }
  if (resolved === "la-honte-de-la-oumma") {
    return Math.round(rawScore * 1.5);
  }
  if (["bon-voyageur", "surprise-totale"].includes(resolved)) {
    return Math.round(rawScore * 1.2);
  }
  return Math.round(rawScore * 1.0);
}

export function scoreTotal(scores: DimensionScores, categoryIds: string[] = [CATEGORIES[0].id]) {
  const ids = normalizeCategoryIds(categoryIds, CATEGORIES[0].id);
  const total = ids.reduce((sum, categoryId) => sum + scoreForCategory(scores, categoryId), 0);
  return Math.round(total / ids.length);
}

export function scoreAverage(scores: DimensionScores, categoryIds?: string[]) {
  return Math.round((scoreTotal(scores, categoryIds) / 20) * 100) / 100;
}

export function ratingImpactPoints(rating: Rating, categoryIds?: string[]) {
  const ids = categoryIds && categoryIds.length > 0 ? categoryIds : [CATEGORIES[0].id];
  const total = ids.reduce((sum, categoryId) => sum + pointsForCategory(rating.scores, categoryId), 0);
  return Math.round(total / ids.length);
}

export function ratingImpactScore(rating: Rating, categoryIds?: string[]) {
  return Math.round((ratingImpactPoints(rating, categoryIds) / 20) * 100) / 100;
}

export function addScores(target: DimensionScores, source: DimensionScores) {
  for (const dimension of RATING_DIMENSIONS) {
    target[dimension.key] += clampDimension(source[dimension.key]);
  }
}

export function createStarDistribution(): StarDistribution {
  return [0, 0, 0, 0, 0];
}

export function addToStarDistribution(distribution: StarDistribution, value: number) {
  const rounded = Math.max(1, clampRating(value));
  distribution[rounded - 1] += 1;
}

export function sameScores(a: DimensionScores, b: DimensionScores) {
  return RATING_DIMENSIONS.every((dimension) => clampDimension(a[dimension.key]) === clampDimension(b[dimension.key]));
}

export function getCategoryMeta(value: string) {
  const resolved = CATEGORY_ID_ALIASES[value] ?? value;
  // Fallback to a valid mood and icon from CATEGORIES[0] if custom to respect types, 
  // or recreate exactly as original:
  return CATEGORY_BY_ID[resolved] ?? { id: "custom", label: value || "Sans catégorie", mood: "fun" as const, icon: CATEGORIES[7].icon };
}

export function categorySummary(ids: string[]) {
  const labels = normalizeCategoryIds(ids, CATEGORIES[0].id).map((id) => getCategoryMeta(id).label);
  if (labels.length <= 2) return labels.join(" + ");
  return `${labels.slice(0, 2).join(" + ")} +${labels.length - 2}`;
}

export function normalizeCategoryIds(value: unknown, fallback: string) {
  const rawIds = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const validIds = rawIds.map((id) => CATEGORY_ID_ALIASES[id] ?? id).filter((id) => CATEGORY_BY_ID[id]);
  const resolvedFallback = CATEGORY_ID_ALIASES[fallback] ?? fallback;
  const fallbackId = CATEGORY_BY_ID[resolvedFallback] ? resolvedFallback : CATEGORIES[0].id;
  return Array.from(new Set(validIds.length > 0 ? validIds : [fallbackId]));
}

export function primaryCategoryId(ids: string[]) {
  return ids.map((id) => CATEGORY_ID_ALIASES[id] ?? id).find((id) => CATEGORY_BY_ID[id]) ?? CATEGORIES[0].id;
}

export function statusFromRatings(ratings: Rating[]) {
  if (ratings.length < MIN_PUBLIC_RATINGS) return "pending" as const;
  return "accepted" as const;
}

export function statusLabel(status: NominationStatus) {
  if (status === "accepted") return "NOMINÉ";
  if (status === "rejected") return "ARCHIVÉ";
  return "À VOTER";
}

export function averageRating(ratings: Rating[], categoryIds?: string[]) {
  if (ratings.length === 0) return 0;
  return ratings.reduce((sum, rating) => sum + ratingImpactScore(rating, categoryIds), 0) / ratings.length;
}

export function totalPoints(ratings: Rating[], categoryIds?: string[]) {
  return ratings.reduce((sum, rating) => sum + ratingImpactPoints(rating, categoryIds), 0);
}

export function averageImpact(nomination: Nomination, categoryIds = nomination.category_ids) {
  if (nomination.ratings.length === 0) return 0;
  return Math.round(totalPoints(nomination.ratings, categoryIds) / nomination.ratings.length);
}

export function parseRating(row: Record<string, unknown>): Rating {
  const legacyRating = clampRating(toNumber(row.rating_stars, 0));
  const scores = cloneScores({
    rire: clampDimension(toNumber(row.rire_score, legacyRating)),
    surprise: clampDimension(toNumber(row.surprise_score, legacyRating)),
    gene: clampDimension(toNumber(row.gene_score, legacyRating)),
    fierte: clampDimension(toNumber(row.fierte_score, legacyRating)),
    interet: clampDimension(toNumber(row.interet_score, legacyRating))
  });
  const computedScore = scoreAverage(scores);
  const computedPoints = scoreTotal(scores);

  return {
    id: toText(row.id, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    nomination_id: toText(row.nomination_id),
    voter_id: toText(row.voter_id),
    rating_stars: clampRating(toNumber(row.rating_stars, Math.round(computedScore))),
    rating_score: Math.min(5, Math.max(0, toNumber(row.rating_score, computedScore))),
    rating_points: Math.min(100, Math.max(0, toNumber(row.rating_points, computedPoints))),
    scores,
    comment: toText(row.comment),
    created_at: toText(row.created_at, new Date().toISOString())
  };
}

export function makeRatingFromDraft(nominationId: string, voterId: string, scores: DimensionScores, comment: string, categoryIds?: string[]): Rating {
  const safeScores = cloneScores(scores);
  const points = scoreTotal(safeScores, categoryIds);
  const ratingScore = Math.round((points / 20) * 100) / 100;

  return {
    id: `${nominationId}-${voterId}`,
    nomination_id: nominationId,
    voter_id: voterId,
    rating_stars: clampRating(Math.round(ratingScore)),
    rating_score: ratingScore,
    rating_points: points,
    scores: safeScores,
    comment,
    created_at: new Date().toISOString()
  };
}

export function parseNomination(row: Record<string, unknown>): Nomination {
  // Use constant FALLBACK_IMAGE_URL from CATEGORIES or wherever it makes sense, we'll hardcode here to avoid circle dependencies
  const FALLBACK_IMAGE_URL = "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1080'%20height='1440'%20viewBox='0%200%201080%201440'%3E%3Crect%20width='1080'%20height='1440'%20fill='%23000000'/%3E%3Crect%20x='64'%20y='64'%20width='952'%20height='1312'%20fill='%23f2efe3'%20stroke='%23000000'%20stroke-width='24'/%3E%3Crect%20x='112'%20y='112'%20width='856'%20height='240'%20fill='%23e11d48'/%3E%3Ctext%20x='540'%20y='248'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='118'%20fill='%23ffffff'%3ENOD%3C/text%3E%3Ctext%20x='540'%20y='690'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='104'%20fill='%23000000'%3EDOSSIER%3C/text%3E%3Ctext%20x='540'%20y='810'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='104'%20fill='%23000000'%3EEN%20DIRECT%3C/text%3E%3Crect%20x='248'%20y='936'%20width='584'%20height='132'%20fill='%23b5f42b'%20stroke='%23000000'%20stroke-width='18'/%3E%3Ctext%20x='540'%20y='1028'%20text-anchor='middle'%20font-family='Impact,%20sans-serif'%20font-size='64'%20fill='%23000000'%3EA%20VOTER%3C/text%3E%3C/svg%3E";
  const ratings = Array.isArray(row.ratings) ? row.ratings.filter(isRecord).map(parseRating) : [];
  const rawMediaKind = toText(row.media_kind, "image");
  const fallbackCategory = toText(row.category_id, CATEGORIES[0].id);
  const categoryIds = normalizeCategoryIds(row.category_ids, fallbackCategory);
  const computedStatus = statusFromRatings(ratings);

  function sanitizeTiktokerName(value: string) {
    return value
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[^\w\sÀ-ÖØ-öø-ÿ'@.-]/g, "")
      .slice(0, 48);
  }

  return {
    id: toText(row.id, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    room_id: toText(row.room_id),
    category_id: primaryCategoryId(categoryIds),
    category_ids: categoryIds,
    tiktoker_name: sanitizeTiktokerName(toText(row.tiktoker_name, "TikToker mystère")) || "TikToker mystère",
    media_url: toText(row.media_url, FALLBACK_IMAGE_URL),
    video_storage_path: toText(row.video_storage_path) || null,
    thumbnail_url: toText(row.thumbnail_url) || null,
    thumbnail_storage_path: toText(row.thumbnail_storage_path) || null,
    media_kind: rawMediaKind === "video" ? "video" : "image",
    comment: toText(row.comment),
    submitted_by: toText(row.submitted_by, "session-inconnue"),
    status: computedStatus,
    created_at: toText(row.created_at, new Date().toISOString()),
    ratings
  };
}
