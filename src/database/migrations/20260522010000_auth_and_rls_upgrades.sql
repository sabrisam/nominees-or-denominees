-- src/database/migrations/20260522010000_auth_and_rls_upgrades.sql

BEGIN;

-- 1. Schema Alterations: Migrate text to UUID & link to auth.users ON DELETE CASCADE
ALTER TABLE public.nominations
  ALTER COLUMN submitted_by TYPE UUID USING submitted_by::uuid;

ALTER TABLE public.nominations
  ADD CONSTRAINT fk_nominations_user 
  FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.ratings
  ALTER COLUMN voter_id TYPE UUID USING voter_id::uuid;

ALTER TABLE public.ratings
  ADD CONSTRAINT fk_ratings_user 
  FOREIGN KEY (voter_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- 2. Row-Level Security (RLS) Policies
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Rooms: Read-only for authenticated
DROP POLICY IF EXISTS select_rooms ON public.rooms;
CREATE POLICY select_rooms ON public.rooms FOR SELECT TO authenticated USING (true);

-- Nominations: Read for all authenticated, Insert/Update matching UID
DROP POLICY IF EXISTS select_nominations ON public.nominations;
CREATE POLICY select_nominations ON public.nominations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS insert_nominations ON public.nominations;
CREATE POLICY insert_nominations ON public.nominations FOR INSERT TO authenticated WITH CHECK (auth.uid() = submitted_by);

DROP POLICY IF EXISTS update_nominations ON public.nominations;
CREATE POLICY update_nominations ON public.nominations FOR UPDATE TO authenticated USING (auth.uid() = submitted_by) WITH CHECK (auth.uid() = submitted_by);

DROP POLICY IF EXISTS delete_nominations ON public.nominations;
CREATE POLICY delete_nominations ON public.nominations FOR DELETE TO authenticated USING (auth.uid() = submitted_by);

-- Ratings: Read for all authenticated, Insert/Update matching UID
DROP POLICY IF EXISTS select_ratings ON public.ratings;
CREATE POLICY select_ratings ON public.ratings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS insert_ratings ON public.ratings;
CREATE POLICY insert_ratings ON public.ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = voter_id);

DROP POLICY IF EXISTS update_ratings ON public.ratings;
CREATE POLICY update_ratings ON public.ratings FOR UPDATE TO authenticated USING (auth.uid() = voter_id) WITH CHECK (auth.uid() = voter_id);

DROP POLICY IF EXISTS delete_ratings ON public.ratings;
CREATE POLICY delete_ratings ON public.ratings FOR DELETE TO authenticated USING (auth.uid() = voter_id);


-- 3. Server-Side Palmarès Engine via PostgreSQL RPC
-- Drops the old version to replace with new strictly-typed return type if necessary.
DROP FUNCTION IF EXISTS get_monthly_leaderboard(text, timestamptz);

CREATE OR REPLACE FUNCTION get_monthly_leaderboard(room_code_input TEXT, target_month_input TIMESTAMPTZ)
RETURNS JSON AS $$
DECLARE
  result_json JSON;
BEGIN
  WITH monthly_ratings AS (
    SELECT 
      n.id AS nomination_id,
      n.tiktoker_name,
      n.category_id,
      r.rating_score,
      r.rating_points
    FROM public.nominations n
    LEFT JOIN public.ratings r ON r.nomination_id = n.id
    WHERE n.room_code = room_code_input
      AND n.status = 'accepted'
      AND date_trunc('month', n.created_at) = date_trunc('month', target_month_input)
  ),
  tiktoker_stats AS (
    SELECT
      tiktoker_name,
      SUM(COALESCE(rating_points, 0)) AS points,
      COUNT(rating_score) AS vote_count,
      AVG(COALESCE(rating_score, 0)) AS average,
      -- Success rate: nominations for this tiktoker with at least 2 votes
      (
        SELECT COUNT(*)::FLOAT / NULLIF((SELECT COUNT(DISTINCT id) FROM public.nominations WHERE tiktoker_name = m.tiktoker_name AND room_code = room_code_input AND date_trunc('month', created_at) = date_trunc('month', target_month_input)), 0) * 100
        FROM (
          SELECT nomination_id FROM monthly_ratings WHERE tiktoker_name = m.tiktoker_name GROUP BY nomination_id HAVING COUNT(rating_score) >= 2
        ) sub
      ) AS success_rate
    FROM monthly_ratings m
    GROUP BY tiktoker_name
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'tiktoker_name', tiktoker_name,
      'points', points,
      'vote_count', vote_count,
      'average', ROUND(average::numeric, 2),
      'success_rate', COALESCE(ROUND(success_rate::numeric, 1), 0)
    ) ORDER BY points DESC, success_rate DESC, average DESC, tiktoker_name ASC
  ), '[]'::json) INTO result_json
  FROM tiktoker_stats
  WHERE points > 0;

  RETURN result_json;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
