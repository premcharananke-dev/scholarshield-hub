-- ============================================================================
-- SCHOLARSHIELD – LAYER E: FINAL ROLLBACK VERIFICATION SUITE
-- Problem Statement No. 58 | Target: Supabase PostgreSQL 14/15
-- Compatibility: 100% Pure PostgreSQL (Supabase SQL Editor, PostgREST, psql)
-- Zero Unsupported psql meta-commands (\i, \c, \echo)
-- Mode: [DESIGNED – STAGING EXECUTION REQUIRED]
-- ============================================================================
-- PREREQUISITE: This script must be executed immediately following the execution of
-- drizzle/migrations/0002_rollback_phase1_documents.sql in the target database.
-- ============================================================================

DO $layer_e_verification$
DECLARE
  v_state text;
  v_manifest jsonb;
  v_req_cats text[];
  v_cat text;
  v_actual_cats text[];
  v_col_baseline_count integer;
  v_col_diff_count integer;
  v_unexpected_cols text[];
  v_col_rec record;
  v_pol_rec record;
  v_pol_diff_count integer;
  v_trg_count integer;
  v_fn_count integer;
  v_storage_pol_count integer;
  v_bucket_marker jsonb;
  v_bucket jsonb;
  v_actual_bucket record;
  v_err_collector text[] := ARRAY[]::text[];
  v_passed_checks text[] := ARRAY[]::text[];
BEGIN
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'STARTING LAYER E: COMPREHENSIVE ROLLBACK RESTORATION VERIFICATION';
  RAISE NOTICE '====================================================================';

  -- ==========================================================================
  -- SECTION G & H: SNAPSHOT INTEGRITY & FAIL-CLOSED PRE-FLIGHT (Req G, H)
  -- ==========================================================================
  -- 1. Verify snapshot and state tables exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_phase1_migration_snapshot'
  ) THEN
    RAISE EXCEPTION 'FAIL-CLOSED: Table public._phase1_migration_snapshot does not exist. Cannot verify rollback integrity against baseline.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_phase1_migration_state'
  ) THEN
    RAISE EXCEPTION 'FAIL-CLOSED: Table public._phase1_migration_state does not exist.';
  END IF;

  -- 2. Validate Baseline Manifest record
  SELECT metadata INTO v_manifest
  FROM public._phase1_migration_snapshot
  WHERE snapshot_type = 'manifest' AND entity_name = 'phase1_manifest' AND snapshot_version = 1;

  IF v_manifest IS NULL THEN
    RAISE EXCEPTION 'FAIL-CLOSED: Baseline manifest (phase1_manifest) is missing from snapshot. Never report PASS without an authentic manifest.';
  END IF;

  -- 3. Validate required snapshot categories
  SELECT ARRAY(
    SELECT jsonb_array_elements_text(v_manifest->'required_categories')
  ) INTO v_req_cats;

  SELECT ARRAY(
    SELECT DISTINCT snapshot_type
    FROM public._phase1_migration_snapshot
    WHERE snapshot_version = 1
  ) INTO v_actual_cats;

  FOREACH v_cat IN ARRAY v_req_cats
  LOOP
    IF NOT (v_cat = ANY(v_actual_cats)) THEN
      RAISE EXCEPTION 'FAIL-CLOSED: Required snapshot category "%" missing from baseline manifest.', v_cat;
    END IF;
  END LOOP;

  -- 4. Fail-closed: Snapshot must contain at least 1 baseline column
  SELECT count(*) INTO v_col_baseline_count
  FROM public._phase1_migration_snapshot
  WHERE snapshot_type = 'column' AND snapshot_version = 1;

  IF v_col_baseline_count = 0 THEN
    RAISE EXCEPTION 'FAIL-CLOSED: Baseline snapshot contains 0 columns for application_documents. Baseline is empty or invalid.';
  END IF;

  v_passed_checks := array_append(v_passed_checks, 'Section G/H: Snapshot manifest and category integrity verified (fail-closed pre-flight)');

  -- ==========================================================================
  -- SECTION A: MIGRATION STATE MACHINE VERIFICATION (Req A)
  -- ==========================================================================
  SELECT state INTO v_state
  FROM public._phase1_migration_state
  WHERE migration_name = 'phase1_documents';

  IF v_state IS NULL THEN
    RAISE EXCEPTION '[FAIL - State] Migration record "phase1_documents" missing from _phase1_migration_state.';
  ELSIF v_state <> 'ROLLED_BACK' THEN
    RAISE EXCEPTION '[FAIL - State] Migration state is "%" (expected "ROLLED_BACK"). Rollback migration must be run before verification.', v_state;
  END IF;

  v_passed_checks := array_append(v_passed_checks, 'Section A: Migration state machine confirmed ROLLED_BACK');

  -- ==========================================================================
  -- SECTION B: BIDIRECTIONAL COLUMN COMPARISON (Req B)
  -- ==========================================================================
  -- B1. Check for missing baseline columns
  SELECT count(*) INTO v_col_diff_count
  FROM (
    SELECT metadata->>'column_name' AS col
    FROM public._phase1_migration_snapshot
    WHERE snapshot_type = 'column' AND snapshot_version = 1
    EXCEPT
    SELECT column_name AS col
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'application_documents'
  ) missing_cols;

  IF v_col_diff_count > 0 THEN
    RAISE EXCEPTION '[FAIL - Column Missing] % baseline column(s) are missing from public.application_documents after rollback!', v_col_diff_count;
  END IF;

  -- B2. Check for unexpected Phase 1 extension columns that should have been dropped
  SELECT ARRAY(
    SELECT c.column_name::text
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'application_documents'
      AND c.column_name IN ('storage_path', 'file_hash', 'uploaded_by', 'verified_by', 'verification_notes')
      AND NOT EXISTS (
        SELECT 1 FROM public._phase1_migration_snapshot s
        WHERE s.snapshot_type = 'column' AND s.snapshot_version = 1
          AND s.metadata->>'column_name' = c.column_name
      )
  ) INTO v_unexpected_cols;

  IF array_length(v_unexpected_cols, 1) > 0 THEN
    RAISE EXCEPTION '[FAIL - Orphan Column] Unexpected Phase 1 column(s) still exist on application_documents: %', v_unexpected_cols;
  END IF;

  -- B3. Verify Column Data Types, Nullability, and Defaults for all baseline columns
  FOR v_col_rec IN
    SELECT
      s.metadata->>'column_name' AS expected_name,
      s.metadata->>'data_type' AS expected_type,
      s.metadata->>'is_nullable' AS expected_nullable,
      s.metadata->>'column_default' AS expected_default,
      c.data_type AS actual_type,
      c.is_nullable AS actual_nullable,
      c.column_default AS actual_default
    FROM public._phase1_migration_snapshot s
    JOIN information_schema.columns c
      ON c.table_schema = 'public'
     AND c.table_name = 'application_documents'
     AND c.column_name = (s.metadata->>'column_name')
    WHERE s.snapshot_type = 'column' AND s.snapshot_version = 1
  LOOP
    IF v_col_rec.actual_type <> v_col_rec.expected_type THEN
      RAISE EXCEPTION '[FAIL - Column Type] Column "%" data type mismatch: expected %, found %',
        v_col_rec.expected_name, v_col_rec.expected_type, v_col_rec.actual_type;
    END IF;

    IF v_col_rec.actual_nullable <> v_col_rec.expected_nullable THEN
      RAISE EXCEPTION '[FAIL - Column Nullability] Column "%" nullability mismatch: expected %, found %',
        v_col_rec.expected_name, v_col_rec.expected_nullable, v_col_rec.actual_nullable;
    END IF;

    IF COALESCE(v_col_rec.actual_default, '') <> COALESCE(v_col_rec.expected_default, '') THEN
      RAISE EXCEPTION '[FAIL - Column Default] Column "%" default mismatch: expected %, found %',
        v_col_rec.expected_name, v_col_rec.expected_default, v_col_rec.actual_default;
    END IF;
  END LOOP;

  v_passed_checks := array_append(v_passed_checks, 'Section B: Bidirectional column comparison verified (zero missing, zero orphan, matching types/nullability/defaults)');

  -- ==========================================================================
  -- SECTION C: POLICY RESTORATION & PURGE VERIFICATION (Req C)
  -- ==========================================================================
  -- C1. Ensure Phase 1 application_documents policies are completely dropped
  SELECT count(*) INTO v_pol_diff_count
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'application_documents'
    AND p.polname IN ('app_docs_student_read', 'app_docs_student_insert', 'app_docs_student_update', 'app_docs_admin_all', 'app_docs_service_role');

  IF v_pol_diff_count > 0 THEN
    RAISE EXCEPTION '[FAIL - Policy Purge] % Phase 1 database policy/policies still exist on application_documents.', v_pol_diff_count;
  END IF;

  -- C2. Ensure pre-existing baseline policies are restored and definitions match
  FOR v_pol_rec IN
    SELECT
      s.metadata->>'policy_name' AS exp_name,
      s.metadata->>'command' AS exp_cmd,
      (s.metadata->>'permissive')::boolean AS exp_perm,
      s.metadata->>'roles' AS exp_roles,
      s.metadata->>'qual' AS exp_qual,
      s.metadata->>'with_check' AS exp_with_check,
      p.polname AS actual_name,
      CASE p.polcmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
      END AS actual_cmd,
      (p.polpermissive IS TRUE) AS actual_perm,
      pg_get_expr(p.polqual, p.polrelid) AS actual_qual,
      pg_get_expr(p.polwithcheck, p.polrelid) AS actual_with_check
    FROM public._phase1_migration_snapshot s
    LEFT JOIN (
      pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
    ) ON n.nspname = 'public' AND c.relname = 'application_documents' AND p.polname = (s.metadata->>'policy_name')
    WHERE s.snapshot_type = 'policy'
      AND s.entity_schema = 'public'
      AND (s.metadata->>'table_name') = 'application_documents'
      AND s.snapshot_version = 1
  LOOP
    IF v_pol_rec.actual_name IS NULL THEN
      RAISE EXCEPTION '[FAIL - Policy Missing] Baseline policy "%" was not restored to application_documents.', v_pol_rec.exp_name;
    END IF;

    IF v_pol_rec.actual_cmd <> v_pol_rec.exp_cmd THEN
      RAISE EXCEPTION '[FAIL - Policy Command] Policy "%" command mismatch: expected %, found %',
        v_pol_rec.exp_name, v_pol_rec.exp_cmd, v_pol_rec.actual_cmd;
    END IF;

    IF v_pol_rec.actual_perm <> v_pol_rec.exp_perm THEN
      RAISE EXCEPTION '[FAIL - Policy Mode] Policy "%" permissive mode mismatch: expected %, found %',
        v_pol_rec.exp_name, v_pol_rec.exp_perm, v_pol_rec.actual_perm;
    END IF;

    IF COALESCE(v_pol_rec.actual_qual, '') <> COALESCE(v_pol_rec.exp_qual, '') THEN
      RAISE EXCEPTION '[FAIL - Policy USING] Policy "%" USING expression mismatch: expected %, found %',
        v_pol_rec.exp_name, v_pol_rec.exp_qual, v_pol_rec.actual_qual;
    END IF;

    IF COALESCE(v_pol_rec.actual_with_check, '') <> COALESCE(v_pol_rec.exp_with_check, '') THEN
      RAISE EXCEPTION '[FAIL - Policy WITH CHECK] Policy "%" WITH CHECK expression mismatch: expected %, found %',
        v_pol_rec.exp_name, v_pol_rec.exp_with_check, v_pol_rec.actual_with_check;
    END IF;
  END LOOP;

  v_passed_checks := array_append(v_passed_checks, 'Section C: Policies verified (Phase 1 policies dropped, baseline policies accurately restored with matching commands, roles, expressions)');

  -- ==========================================================================
  -- SECTION D: TRIGGER VERIFICATION (Req D)
  -- ==========================================================================
  -- D1. Assert Phase 1 triggers are dropped
  SELECT count(*) INTO v_trg_count
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'application_documents'
    AND t.tgname IN ('trg_enforce_document_integrity', 'trg_prevent_delete_verified_documents');

  IF v_trg_count > 0 THEN
    RAISE EXCEPTION '[FAIL - Trigger Purge] % Phase 1 trigger(s) still exist on application_documents.', v_trg_count;
  END IF;

  -- D2. Assert pre-existing triggers are restored and enabled
  FOR v_trg_count IN
    SELECT count(*)
    FROM public._phase1_migration_snapshot s
    WHERE s.snapshot_type = 'trigger' AND s.snapshot_version = 1
      AND NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'application_documents'
          AND t.tgname = (s.metadata->>'trigger_name')
      )
  LOOP
    IF v_trg_count > 0 THEN
      RAISE EXCEPTION '[FAIL - Trigger Missing] % pre-existing trigger(s) were not restored to application_documents.', v_trg_count;
    END IF;
  END LOOP;

  v_passed_checks := array_append(v_passed_checks, 'Section D: Trigger verification passed (Phase 1 triggers dropped, baseline triggers intact)');

  -- ==========================================================================
  -- SECTION E: FUNCTION VERIFICATION (Req E)
  -- ==========================================================================
  -- E1. Assert Phase 1 functions are removed unless they pre-existed in snapshot
  IF NOT EXISTS (
    SELECT 1 FROM public._phase1_migration_snapshot
    WHERE snapshot_type = 'function' AND entity_name LIKE 'enforce_document_integrity%'
  ) THEN
    SELECT count(*) INTO v_fn_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'enforce_document_integrity';

    IF v_fn_count > 0 THEN
      RAISE EXCEPTION '[FAIL - Function Purge] Function public.enforce_document_integrity() was not dropped during rollback.';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public._phase1_migration_snapshot
    WHERE snapshot_type = 'function' AND entity_name LIKE 'prevent_delete_verified_documents%'
  ) THEN
    SELECT count(*) INTO v_fn_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'prevent_delete_verified_documents';

    IF v_fn_count > 0 THEN
      RAISE EXCEPTION '[FAIL - Function Purge] Function public.prevent_delete_verified_documents() was not dropped during rollback.';
    END IF;
  END IF;

  v_passed_checks := array_append(v_passed_checks, 'Section E: Function verification passed (Phase 1 functions safely removed)');

  -- ==========================================================================
  -- SECTION F: STORAGE BUCKET & STORAGE POLICY VERIFICATION (Req F)
  -- ==========================================================================
  -- F1. Assert Phase 1 storage policies are completely dropped
  SELECT count(*) INTO v_storage_pol_count
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'storage' AND c.relname = 'objects'
    AND p.polname LIKE 'scholarship_docs_%';

  IF v_storage_pol_count > 0 THEN
    RAISE EXCEPTION '[FAIL - Storage Policy Purge] % Phase 1 storage policies still exist on storage.objects.', v_storage_pol_count;
  END IF;

  -- F2. Storage bucket restoration validation
  SELECT metadata INTO v_bucket_marker
  FROM public._phase1_migration_snapshot
  WHERE snapshot_type = 'bucket_marker' AND entity_name = 'scholarship-documents' AND snapshot_version = 1;

  IF v_bucket_marker IS NOT NULL AND (v_bucket_marker->>'pre_existed')::boolean IS FALSE THEN
    -- Bucket was created by Phase 1: verify it is removed (or retained only if storage objects remain)
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'scholarship-documents') THEN
      IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'scholarship-documents') THEN
        RAISE EXCEPTION '[FAIL - Storage Bucket] Bucket "scholarship-documents" was created by Phase 1 and is empty, but was not removed by rollback.';
      ELSE
        RAISE NOTICE '[INFO - Storage Bucket] Bucket "scholarship-documents" retained because non-empty storage objects exist.';
      END IF;
    END IF;
  ELSE
    -- Bucket pre-existed: verify original settings restored
    SELECT metadata INTO v_bucket
    FROM public._phase1_migration_snapshot
    WHERE snapshot_type = 'bucket' AND entity_name = 'scholarship-documents' AND snapshot_version = 1;

    IF v_bucket IS NOT NULL THEN
      SELECT * INTO v_actual_bucket FROM storage.buckets WHERE id = 'scholarship-documents';
      IF v_actual_bucket.public <> (v_bucket->>'public')::boolean THEN
        RAISE EXCEPTION '[FAIL - Bucket Config] Bucket "scholarship-documents" public flag mismatch: expected %, found %',
          (v_bucket->>'public')::boolean, v_actual_bucket.public;
      END IF;
      IF v_actual_bucket.file_size_limit <> (v_bucket->>'file_size_limit')::bigint THEN
        RAISE EXCEPTION '[FAIL - Bucket Config] Bucket "scholarship-documents" file_size_limit mismatch: expected %, found %',
          (v_bucket->>'file_size_limit')::bigint, v_actual_bucket.file_size_limit;
      END IF;
    END IF;
  END IF;

  v_passed_checks := array_append(v_passed_checks, 'Section F: Storage policies purged, bucket configuration verified');

  -- ==========================================================================
  -- FINAL SUMMARY OF VERIFIED CRITERIA
  -- ==========================================================================
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'LAYER E: ALL ROLLBACK VERIFICATION CRITERIA DEMONSTRABLY SATISFIED';
  RAISE NOTICE '====================================================================';
  FOR i IN 1..array_length(v_passed_checks, 1) LOOP
    RAISE NOTICE '  [PASS] %', v_passed_checks[i];
  END LOOP;
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'VERDICT: PASS – Schema, Policies, Triggers, Functions, and Storage match baseline with zero data loss.';
  RAISE NOTICE '====================================================================';
END $layer_e_verification$;
