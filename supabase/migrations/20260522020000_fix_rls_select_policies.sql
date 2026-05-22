-- Migration: Fix missing SELECT policies that block all data reads
-- The previous migration enabled RLS without granting SELECT, blocking all data fetch.
-- This migration grants safe read access to authenticated + anon roles.

BEGIN;

-- ─── ROOMS ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "select_rooms" ON public.rooms;
DROP POLICY IF EXISTS select_rooms ON public.rooms;

CREATE POLICY "rooms_select_open"
  ON public.rooms FOR SELECT
  TO anon, authenticated
  USING (true);

-- ─── NOMINATIONS ──────────────────────────────────────────────────────────────
-- Drop any conflicting SELECT policies
DROP POLICY IF EXISTS "select_nominations" ON public.nominations;
DROP POLICY IF EXISTS select_nominations ON public.nominations;

CREATE POLICY "nominations_select_open"
  ON public.nominations FOR SELECT
  TO anon, authenticated
  USING (true);

-- Ensure INSERT/UPDATE/DELETE are still locked to the token owner
DROP POLICY IF EXISTS "insert_nominations" ON public.nominations;
DROP POLICY IF EXISTS "Allow authenticated inserts based on token" ON public.nominations;
CREATE POLICY "nominations_insert_own"
  ON public.nominations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = submitted_by);

DROP POLICY IF EXISTS "update_nominations" ON public.nominations;
DROP POLICY IF EXISTS "Allow authenticated updates on own nominations" ON public.nominations;
CREATE POLICY "nominations_update_own"
  ON public.nominations FOR UPDATE
  TO authenticated
  USING (auth.uid() = submitted_by)
  WITH CHECK (auth.uid() = submitted_by);

DROP POLICY IF EXISTS "delete_nominations" ON public.nominations;
DROP POLICY IF EXISTS "Allow authenticated deletes on own nominations" ON public.nominations;
CREATE POLICY "nominations_delete_own"
  ON public.nominations FOR DELETE
  TO authenticated
  USING (auth.uid() = submitted_by);

-- ─── RATINGS ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "select_ratings" ON public.ratings;
DROP POLICY IF EXISTS select_ratings ON public.ratings;

CREATE POLICY "ratings_select_open"
  ON public.ratings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_ratings" ON public.ratings;
DROP POLICY IF EXISTS "Allow authenticated inserts based on token" ON public.ratings;
CREATE POLICY "ratings_insert_own"
  ON public.ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = voter_id);

DROP POLICY IF EXISTS "update_ratings" ON public.ratings;
DROP POLICY IF EXISTS "Allow authenticated updates on own ratings" ON public.ratings;
CREATE POLICY "ratings_update_own"
  ON public.ratings FOR UPDATE
  TO authenticated
  USING (auth.uid() = voter_id)
  WITH CHECK (auth.uid() = voter_id);

DROP POLICY IF EXISTS "delete_ratings" ON public.ratings;
CREATE POLICY "ratings_delete_own"
  ON public.ratings FOR DELETE
  TO authenticated
  USING (auth.uid() = voter_id);

-- ─── STORAGE BUCKET POLICIES (nod-media) ─────────────────────────────────────
-- Grant public read + authenticated write on the nod-media storage bucket
-- These are applied via Supabase Dashboard Storage → Policies, not via SQL migrations.
-- Reminder: ensure the nod-media bucket has:
--   SELECT policy: (true) for anon, authenticated
--   INSERT policy: (true) for authenticated
-- This cannot be enforced via SQL migration directly for storage.buckets.

COMMIT;
