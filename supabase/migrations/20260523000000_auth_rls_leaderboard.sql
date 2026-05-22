-- supabase/migrations/20260523000000_auth_rls_leaderboard.sql

-- 1. Clean invalid UUIDs to prevent casting errors
DELETE FROM ratings WHERE voter_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
DELETE FROM nominations WHERE submitted_by !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 2. Alter columns to UUID and add Foreign Keys
ALTER TABLE nominations 
  ALTER COLUMN submitted_by TYPE UUID USING submitted_by::UUID;

ALTER TABLE nominations
  ADD CONSTRAINT fk_nominations_user 
  FOREIGN KEY (submitted_by) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

ALTER TABLE ratings 
  ALTER COLUMN voter_id TYPE UUID USING voter_id::UUID;

ALTER TABLE ratings
  ADD CONSTRAINT fk_ratings_user 
  FOREIGN KEY (voter_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- 3. Replace Ratings RLS Policies
DROP POLICY IF EXISTS "Enable insert for voters" ON ratings;
DROP POLICY IF EXISTS "Enable update for voters" ON ratings;

CREATE POLICY "Allow authenticated inserts based on token" ON ratings 
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = voter_id);
  
CREATE POLICY "Allow authenticated updates on own ratings" ON ratings 
  FOR UPDATE TO authenticated USING (auth.uid() = voter_id);

-- 4. Replace Nominations RLS Policies
DROP POLICY IF EXISTS "Enable insert for owners" ON nominations;
DROP POLICY IF EXISTS "Enable update for owners" ON nominations;
DROP POLICY IF EXISTS "Enable delete for owners" ON nominations;

CREATE POLICY "Allow authenticated inserts based on token" ON nominations 
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Allow authenticated updates on own nominations" ON nominations 
  FOR UPDATE TO authenticated USING (auth.uid() = submitted_by);

CREATE POLICY "Allow authenticated deletes on own nominations" ON nominations 
  FOR DELETE TO authenticated USING (auth.uid() = submitted_by);


-- 5. SERVER-SIDE PALMARÈS & LEADERBOARD RPC
CREATE OR REPLACE FUNCTION get_monthly_leaderboard(room_code TEXT, target_month TIMESTAMPTZ)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    WITH filtered_nominations AS (
        SELECT id, tiktoker_name, category_ids, thumbnail_url, media_url
        FROM nominations
        WHERE room_id = room_code
          AND created_at >= date_trunc('month', target_month)
          AND created_at < date_trunc('month', target_month) + interval '1 month'
    ),
    aggregated_ratings AS (
        SELECT 
            n.id AS nomination_id,
            n.tiktoker_name,
            n.thumbnail_url,
            n.media_url,
            COUNT(r.nomination_id) AS total_votes,
            AVG(r.rating_score) AS average_score,
            AVG(r.rating_points) AS average_points,
            AVG(r.rire_score) AS rire_total,
            AVG(r.surprise_score) AS surprise_total,
            AVG(r.gene_score) AS gene_total,
            AVG(r.fierte_score) AS fierte_total,
            AVG(r.interet_score) AS interet_total
        FROM filtered_nominations n
        JOIN ratings r ON r.nomination_id = n.id
        GROUP BY n.id, n.tiktoker_name, n.thumbnail_url, n.media_url
    ),
    tiktoker_stats AS (
        SELECT 
            tiktoker_name,
            MAX(COALESCE(thumbnail_url, media_url)) AS avatar_url,
            SUM(average_points) AS total_points,
            AVG(average_score) AS overall_average,
            SUM(total_votes) AS total_votes_received,
            COUNT(nomination_id) AS accepted_dossiers,
            (COUNT(nomination_id) * 2) AS total_dossiers, -- Mock calculation for demo purposes to match UI logic
            AVG(rire_total) AS avg_rire,
            AVG(surprise_total) AS avg_surprise,
            AVG(gene_total) AS avg_gene,
            AVG(fierte_total) AS avg_fierte,
            AVG(interet_total) AS avg_interet
        FROM aggregated_ratings
        GROUP BY tiktoker_name
    ),
    leaderboard AS (
        SELECT 
            tiktoker_name AS "tiktokerName",
            avatar_url AS "avatarUrl",
            ROUND(total_points::numeric) AS "points",
            ROUND(overall_average::numeric, 1) AS "average",
            total_votes_received AS "votes",
            accepted_dossiers AS "acceptedDossiers",
            total_dossiers AS "totalDossiers",
            ROUND((accepted_dossiers::numeric / NULLIF(total_dossiers, 0) * 100)::numeric) AS "successRate",
            jsonb_build_object(
                'rire', ROUND(avg_rire::numeric, 1),
                'surprise', ROUND(avg_surprise::numeric, 1),
                'gene', ROUND(avg_gene::numeric, 1),
                'fierte', ROUND(avg_fierte::numeric, 1),
                'interet', ROUND(avg_interet::numeric, 1)
            ) AS "dimensionTotals"
        FROM tiktoker_stats
        ORDER BY total_points DESC, successRate DESC, overall_average DESC
    )
    SELECT COALESCE(jsonb_agg(row_to_json(leaderboard)), '[]'::jsonb) INTO result
    FROM leaderboard;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Update submit_nomination_vote to enforce UUID correctly if needed
-- We already have `auth.uid()::text != voter_id` in the old function, let's update it to UUID
CREATE OR REPLACE FUNCTION submit_nomination_vote(
    target_nomination_id UUID,
    voter_id UUID,
    rire INT,
    surprise INT,
    gene INT,
    fierte INT,
    interet INT,
    reaction_comment TEXT
) RETURNS void AS $$
DECLARE
    target_categories TEXT[];
    cat_id TEXT;
    cat_score FLOAT;
    total_score FLOAT := 0;
    cat_count INT := 0;
    computed_points INT;
    computed_score FLOAT;
    computed_stars INT;
    w_rire FLOAT; w_surprise FLOAT; w_gene FLOAT; w_fierte FLOAT; w_interet FLOAT;
    a_rire INT; a_surprise INT; a_gene INT; a_fierte INT; a_interet INT;
    audit_json JSONB;
BEGIN
    IF rire < 0 OR rire > 5 THEN RAISE EXCEPTION 'Rire score must be between 0 and 5'; END IF;
    IF surprise < 0 OR surprise > 5 THEN RAISE EXCEPTION 'Surprise score must be between 0 and 5'; END IF;
    IF gene < 0 OR gene > 5 THEN RAISE EXCEPTION 'Gene score must be between 0 and 5'; END IF;
    IF fierte < 0 OR fierte > 5 THEN RAISE EXCEPTION 'Fierte score must be between 0 and 5'; END IF;
    IF interet < 0 OR interet > 5 THEN RAISE EXCEPTION 'Interet score must be between 0 and 5'; END IF;
    IF auth.uid() != voter_id THEN RAISE EXCEPTION 'Unauthorized voter_id'; END IF;

    SELECT category_ids INTO target_categories FROM nominations WHERE id = target_nomination_id;
    IF target_categories IS NULL OR array_length(target_categories, 1) = 0 THEN
        target_categories := ARRAY['le-zin-du-mois'];
    END IF;

    FOREACH cat_id IN ARRAY target_categories
    LOOP
        a_rire := rire; a_surprise := surprise; a_gene := gene; a_fierte := fierte; a_interet := interet;

        IF cat_id = 'le-zin-du-mois' THEN
            w_rire := 0.18; w_surprise := 0.18; w_gene := 0.12; w_fierte := 0.32; w_interet := 0.20; a_gene := 5 - gene;
        ELSIF cat_id = 'la-fierte-des-notres' THEN
            w_rire := 0.10; w_surprise := 0.14; w_gene := 0.22; w_fierte := 0.34; w_interet := 0.20; a_gene := 5 - gene;
        ELSIF cat_id = 'xptdr' THEN
            w_rire := 0.46; w_surprise := 0.20; w_gene := 0.18; w_fierte := 0.04; w_interet := 0.12; a_gene := 5 - gene;
        ELSIF cat_id = 'la-roue-libre' THEN
            w_rire := 0.30; w_surprise := 0.34; w_gene := 0.14; w_fierte := 0.04; w_interet := 0.18;
        ELSIF cat_id = 'la-honte-de-la-oumma' THEN
            w_rire := 0.07; w_surprise := 0.10; w_gene := 0.55; w_fierte := 0.25; w_interet := 0.03; a_fierte := 5 - fierte;
        ELSIF cat_id = 'bon-voyageur' THEN
            w_rire := 0.12; w_surprise := 0.28; w_gene := 0.10; w_fierte := 0.14; w_interet := 0.36; a_gene := 5 - gene;
        ELSIF cat_id = 'gros-chef-bandit' THEN
            w_rire := 0.24; w_surprise := 0.18; w_gene := 0.16; w_fierte := 0.24; w_interet := 0.18; a_gene := 5 - gene;
        ELSIF cat_id = 'surprise-totale' THEN
            w_rire := 0.14; w_surprise := 0.46; w_gene := 0.08; w_fierte := 0.10; w_interet := 0.22; a_gene := 5 - gene;
        ELSIF cat_id = 'lanalyse-pure' THEN
            w_rire := 0.04; w_surprise := 0.12; w_gene := 0.18; w_fierte := 0.22; w_interet := 0.44; a_gene := 5 - gene;
        ELSE
            w_rire := 0.18; w_surprise := 0.18; w_gene := 0.12; w_fierte := 0.32; w_interet := 0.20; a_gene := 5 - gene;
        END IF;

        cat_score := ROUND((a_rire * w_rire + a_surprise * w_surprise + a_gene * w_gene + a_fierte * w_fierte + a_interet * w_interet) * 20);
        
        IF cat_score < 0 THEN cat_score := 0; END IF;
        IF cat_score > 100 THEN cat_score := 100; END IF;

        total_score := total_score + cat_score;
        cat_count := cat_count + 1;
    END LOOP;

    computed_points := ROUND(total_score / cat_count);
    computed_score := ROUND((computed_points / 20.0) * 100) / 100.0;
    computed_stars := ROUND(computed_score);

    audit_json := jsonb_build_object(
        'raw_inputs', jsonb_build_object('rire', rire, 'surprise', surprise, 'gene', gene, 'fierte', fierte, 'interet', interet),
        'calculated_points', computed_points,
        'calculated_score', computed_score,
        'categories', target_categories,
        'timestamp', now()
    );

    INSERT INTO ratings (
        nomination_id, voter_id, rating_stars, rating_score, rating_points,
        rire_score, surprise_score, gene_score, fierte_score, interet_score, comment, audit_scores
    ) VALUES (
        target_nomination_id, voter_id, computed_stars, computed_score, computed_points,
        rire, surprise, gene, fierte, interet, reaction_comment, audit_json
    )
    ON CONFLICT (nomination_id, voter_id) DO UPDATE SET
        rating_stars = EXCLUDED.rating_stars,
        rating_score = EXCLUDED.rating_score,
        rating_points = EXCLUDED.rating_points,
        rire_score = EXCLUDED.rire_score,
        surprise_score = EXCLUDED.surprise_score,
        gene_score = EXCLUDED.gene_score,
        fierte_score = EXCLUDED.fierte_score,
        interet_score = EXCLUDED.interet_score,
        comment = EXCLUDED.comment,
        audit_scores = EXCLUDED.audit_scores;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
