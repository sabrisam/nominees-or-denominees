-- supabase/migrations/20260523010000_refactor_scoring.sql

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
    cat_score INT;
    cat_points INT;
    total_score INT := 0;
    total_points INT := 0;
    cat_count INT := 0;
    computed_points INT;
    computed_score FLOAT;
    computed_stars INT;
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
        DECLARE
            legacy_cat TEXT;
        BEGIN
            SELECT category_id INTO legacy_cat FROM nominations WHERE id = target_nomination_id;
            IF legacy_cat IS NOT NULL THEN
                target_categories := ARRAY[legacy_cat];
            ELSE
                target_categories := ARRAY['le-zin-du-mois'];
            END IF;
        END;
    END IF;

    FOREACH cat_id IN ARRAY target_categories
    LOOP
        cat_score := (rire + surprise + gene + fierte + interet) * 4;
        IF cat_score < 0 THEN cat_score := 0; END IF;
        IF cat_score > 100 THEN cat_score := 100; END IF;

        IF cat_id IN ('le-zin-du-mois', 'la-fierte-des-notres', 'xptdr', 'la-roue-libre', 'gros-chef-bandit', 'lanalyse-pure') THEN
            cat_points := ROUND(cat_score * 1.0);
        ELSIF cat_id = 'la-honte-de-la-oumma' THEN
            cat_points := ROUND(cat_score * 1.5);
        ELSIF cat_id IN ('bon-voyageur', 'surprise-totale') THEN
            cat_points := ROUND(cat_score * 1.2);
        ELSE
            cat_points := ROUND(cat_score * 1.0);
        END IF;

        total_score := total_score + cat_score;
        total_points := total_points + cat_points;
        cat_count := cat_count + 1;
    END LOOP;

    computed_points := ROUND(total_points::float / cat_count);
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
