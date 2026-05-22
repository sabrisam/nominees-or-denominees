-- supabase/migrations/20260522000000_refactor_security.sql

-- 1. Enable RLS on all tables
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- 2. Add audit_scores to ratings
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS audit_scores JSONB;

-- 3. Rooms Policies
DROP POLICY IF EXISTS "Enable read access for all users" ON rooms;
CREATE POLICY "Enable read access for all users" ON rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON rooms;
CREATE POLICY "Enable insert for authenticated users" ON rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON rooms;
CREATE POLICY "Enable update for authenticated users" ON rooms FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 4. Nominations Policies
DROP POLICY IF EXISTS "Enable read access for all users" ON nominations;
CREATE POLICY "Enable read access for all users" ON nominations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for owners" ON nominations;
CREATE POLICY "Enable insert for owners" ON nominations FOR INSERT WITH CHECK (auth.uid()::text = submitted_by);

DROP POLICY IF EXISTS "Enable update for owners" ON nominations;
CREATE POLICY "Enable update for owners" ON nominations FOR UPDATE USING (auth.uid()::text = submitted_by);

DROP POLICY IF EXISTS "Enable delete for owners" ON nominations;
CREATE POLICY "Enable delete for owners" ON nominations FOR DELETE USING (auth.uid()::text = submitted_by);

-- 5. Ratings Policies
DROP POLICY IF EXISTS "Enable read access for all users" ON ratings;
CREATE POLICY "Enable read access for all users" ON ratings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for voters" ON ratings;
CREATE POLICY "Enable insert for voters" ON ratings FOR INSERT WITH CHECK (auth.uid()::text = voter_id);

DROP POLICY IF EXISTS "Enable update for voters" ON ratings;
CREATE POLICY "Enable update for voters" ON ratings FOR UPDATE USING (auth.uid()::text = voter_id);

DROP POLICY IF EXISTS "Enable delete for voters" ON ratings;
CREATE POLICY "Enable delete for voters" ON ratings FOR DELETE USING (auth.uid()::text = voter_id);

-- 6. RPC Function for Voting with Server-Side Math
CREATE OR REPLACE FUNCTION submit_nomination_vote(
    target_nomination_id UUID,
    voter_id TEXT,
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
    
    -- Weights variables
    w_rire FLOAT;
    w_surprise FLOAT;
    w_gene FLOAT;
    w_fierte FLOAT;
    w_interet FLOAT;
    
    -- Adjusted scores
    a_rire INT;
    a_surprise INT;
    a_gene INT;
    a_fierte INT;
    a_interet INT;
    
    audit_json JSONB;
BEGIN
    -- Strict assertions
    IF rire < 0 OR rire > 5 THEN RAISE EXCEPTION 'Rire score must be between 0 and 5'; END IF;
    IF surprise < 0 OR surprise > 5 THEN RAISE EXCEPTION 'Surprise score must be between 0 and 5'; END IF;
    IF gene < 0 OR gene > 5 THEN RAISE EXCEPTION 'Gene score must be between 0 and 5'; END IF;
    IF fierte < 0 OR fierte > 5 THEN RAISE EXCEPTION 'Fierte score must be between 0 and 5'; END IF;
    IF interet < 0 OR interet > 5 THEN RAISE EXCEPTION 'Interet score must be between 0 and 5'; END IF;
    IF auth.uid()::text != voter_id THEN RAISE EXCEPTION 'Unauthorized voter_id'; END IF;

    -- Fetch categories of the nomination
    SELECT category_ids INTO target_categories FROM nominations WHERE id = target_nomination_id;
    
    IF target_categories IS NULL OR array_length(target_categories, 1) = 0 THEN
        target_categories := ARRAY['le-zin-du-mois'];
    END IF;

    -- Calculate score for each category
    FOREACH cat_id IN ARRAY target_categories
    LOOP
        -- Default: no inversion
        a_rire := rire;
        a_surprise := surprise;
        a_gene := gene;
        a_fierte := fierte;
        a_interet := interet;

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
            -- Fallback 'le-zin-du-mois'
            w_rire := 0.18; w_surprise := 0.18; w_gene := 0.12; w_fierte := 0.32; w_interet := 0.20; a_gene := 5 - gene;
        END IF;

        cat_score := ROUND((a_rire * w_rire + a_surprise * w_surprise + a_gene * w_gene + a_fierte * w_fierte + a_interet * w_interet) * 20);
        
        -- Clamp between 0 and 100
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
