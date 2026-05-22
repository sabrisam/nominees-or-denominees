import type { LucideIcon } from "lucide-react";

export type Tab = "direct" | "vote" | "studio" | "palmares" | "winners";
export type NominationStatus = "pending" | "accepted" | "rejected";
export type ToastTone = "success" | "error" | "info";
export type CategoryMood = "positive" | "critical" | "fun" | "surprise";
export type MediaKind = "video" | "image";
export type RatingDimensionKey = "rire" | "surprise" | "gene" | "fierte" | "interet";
export type DimensionScores = Record<RatingDimensionKey, number>;
export type DirectFilter = "all" | "mine" | "pending" | "qualified" | "elite";

export type ToastState = { tone: ToastTone; message: string } | null;

export type Participant = {
  id: string;
  pseudo: string;
};

export type Rating = {
  id: string;
  nomination_id: string;
  voter_id: string;
  rating_stars: number;
  rating_score: number;
  rating_points: number;
  scores: DimensionScores;
  comment: string;
  created_at: string;
};

export type PendingRatingPayload = {
  nominationId: string;
  voterId: string;
  scores: DimensionScores;
  comment: string;
  createdAt: string;
};

export type Nomination = {
  id: string;
  room_id: string;
  category_id: string;
  category_ids: string[];
  tiktoker_name: string;
  media_url: string;
  video_storage_path: string | null;
  thumbnail_url: string | null;
  thumbnail_storage_path: string | null;
  media_kind: MediaKind;
  comment: string;
  submitted_by: string;
  status: NominationStatus;
  created_at: string;
  ratings: Rating[];
};

export type CategoryMeta = {
  id: string;
  label: string;
  mood: CategoryMood;
  icon: LucideIcon;
};

export type SpacesUploadResult = {
  key: string;
  publicUrl: string;
  uploadUrl: string;
};

export type UploadReference = {
  key: string;
  publicUrl: string;
  provider: "spaces" | "supabase";
};

export type ScoreBoard = {
  tiktokerName: string;
  category?: CategoryMeta;
  points: number;
  votes: number;
  average: number;
  nominations: number;
};

export type StarDistribution = [number, number, number, number, number];

export type PalmaresRow = {
  tiktokerName: string;
  avatarUrl: string;
  points: number;
  votes: number;
  average: number;
  totalDossiers: number;
  acceptedDossiers: number;
  successRate: number;
  categoryCounts: Record<string, number>;
  starDistribution: StarDistribution;
  dimensionTotals: DimensionScores;
};

export type CategoryRaceRow = {
  tiktokerName: string;
  avatarUrl: string;
  points: number;
  votes: number;
  average: number;
  totalDossiers: number;
  acceptedDossiers: number;
  pendingDossiers: number;
  rejectedDossiers: number;
  successRate: number;
  starDistribution: StarDistribution;
  dimensionTotals: DimensionScores;
};

export type CategoryRace = {
  category: CategoryMeta;
  totalDossiers: number;
  rows: CategoryRaceRow[];
};
