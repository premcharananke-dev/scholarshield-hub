-- ============================================================================
-- SCHOLARSHIELD – PHASE 1 SNAPSHOT-DRIVEN ROLLBACK
-- Restores Original Baseline Schema, Functions, Policies, and Storage Bucket
-- Problem Statement No. 58 | Target: Supabase PostgreSQL 14/15
-- Reconciled Defects: C-1 through C-46
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- STEP 1: VALIDATE DETERMINISTIC BASELINE MANIFEST INTEGRITY (C-5, C-20, C-31)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_manifest jsonb;
  v_req_cats text[];
  v_cat text;
  v_actual_cats text[];
BEGIN
  -- 1a. Verify state machine
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_phase1_migration_state'
  ) THEN
    RAISE EXCEPTION 'Rollback aborted: State table public._phase1_migration_state does not exist. Cannot safely restore previous state.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public._phase1_migration_state
    WHERE migration_name = 'phase1_documents' AND state = 'APPLIED'
  ) THEN
    RAISE EXCEPTION 'Rollback aborted: Phase 1 migration is not recorded in APPLIED state in public._phase1_migration_state.';
  END IF;

  -- 1b. Verify snapshot table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_phase1_migration_snapshot'
  ) THEN
    RAISE EXCEPTION 'Rollback aborted: Snapshot table public._phase1_migration_snapshot does not exist.';
  END IF;

  -- 1c. Verify manifest completeness (C-31)
  SELECT metadata INTO v_manifest
  FROM public._phase1_migration_snapshot
  WHERE snapshot_type = 'manifest' AND entity_name = 'phase1_manifest' AND snapshot_version = 1;

  IF v_manifest IS NULL THEN
    RAISE EXCEPTION 'Rollback aborted: Baseline manifest (phase1_manifest) missing from snapshot table. Baseline integrity cannot be established.';
  END IF;

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
      RAISE EXCEPTION 'Rollback aborted: Manifest integrity failure. Required snapshot category "%" is missing from baseline.', v_cat;
    END IF;
  END LOOP;

  RAISE NOTICE 'Rollback Pre-Check: Manifest validated. Beginning exact baseline restoration.';
END $$;

-- ----------------------------------------------------------------------------
-- STEP 2: DROP PHASE 1 TRIGGERS AND FUNCTIONS (C-5, C-6, C-20)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_enforce_document_integrity ON public.application_documents;
DROP TRIGGER IF EXISTS trg_prevent_delete_verified_documents ON public.application_documents;

DROP FUNCTION IF EXISTS public.enforce_document_integrity();
DROP FUNCTION IF EXISTS public.prevent_delete_verified_documents();

-- 2a. Restore pre-existing functions if they were snapshotted (C-20)
DO $$
DECLARE
  v_fn record;
BEGIN
  FOR v_fn IN
    SELECT metadata
    FROM public._phase1_migration_snapshot
    WHERE snapshot_type = 'function' AND snapshot_version = 1
  LOOP
    IF (v_fn.metadata->>'function_def') IS NOT NULL THEN
      EXECUTE (v_fn.metadata->>'function_def');
      EXECUTE 'ALTER FUNCTION public.' || quote_ident(v_fn.metadata->>'function_name') || ' OWNER TO ' || quote_ident(v_fn.metadata->>'owner') || ';';
      RAISE NOTICE 'Restored pre-existing function: %', v_fn.metadata->>'function_name';
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 3: DROP PHASE 1 STORAGE POLICIES (C-18)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "scholarship_docs_student_select" ON storage.objects;
DROP POLICY IF EXISTS "scholarship_docs_student_insert" ON storage.objects;
DROP POLICY IF EXISTS "scholarship_docs_student_update" ON storage.objects;
DROP POLICY IF EXISTS "scholarship_docs_student_delete" ON storage.objects;
DROP POLICY IF EXISTS "scholarship_docs_admin_select" ON storage.objects;
DROP POLICY IF EXISTS "scholarship_docs_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "scholarship_docs_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "scholarship_docs_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "scholarship_docs_admin_all" ON storage.objects;
DROP POLICY IF EXISTS "scholarship_docs_service_role" ON storage.objects;

-- ----------------------------------------------------------------------------
-- STEP 4: DROP PHASE 1 APPLICATION_DOCUMENTS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "app_docs_student_read" ON public.application_documents;
DROP POLICY IF EXISTS "app_docs_student_insert" ON public.application_documents;
DROP POLICY IF EXISTS "app_docs_student_update" ON public.application_documents;
DROP POLICY IF EXISTS "app_docs_admin_all" ON public.application_documents;
DROP POLICY IF EXISTS "app_docs_service_role" ON public.application_documents;

-- ----------------------------------------------------------------------------
-- STEP 5: RESTORE ORIGINAL BASELINE POLICIES FROM SNAPSHOT (C-3, C-5, C-20, C-23)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_rec record;
  v_sql text;
  v_roles text;
  v_role text;
  v_table_ident text;
BEGIN
  FOR v_rec IN
    SELECT metadata
    FROM public._phase1_migration_snapshot
    WHERE snapshot_type = 'policy' AND snapshot_version = 1
  LOOP
    v_table_ident := quote_ident(v_rec.metadata->>'table_schema') || '.' || quote_ident(v_rec.metadata->>'table_name');

    -- Reconstruct role list with single quoting and unquoted public keyword
    v_roles := '';
    FOR v_role IN SELECT jsonb_array_elements_text(v_rec.metadata->'roles')
    LOOP
      IF length(v_roles) > 0 THEN
        v_roles := v_roles || ', ';
      END IF;

      IF v_role = 'public' THEN
        v_roles := v_roles || 'public';
      ELSE
        v_roles := v_roles || quote_ident(v_role);
      END IF;
    END LOOP;

    -- Build command-specific DDL syntax
    v_sql := 'CREATE POLICY ' || quote_ident(v_rec.metadata->>'policy_name')
          || ' ON ' || v_table_ident
          || CASE WHEN (v_rec.metadata->>'permissive')::boolean THEN ' AS PERMISSIVE' ELSE ' AS RESTRICTIVE' END
          || ' FOR ' || (v_rec.metadata->>'command')
          || ' TO ' || v_roles;

    IF (v_rec.metadata->>'command') IN ('SELECT', 'DELETE') THEN
      IF (v_rec.metadata->>'qual') IS NOT NULL THEN
        v_sql := v_sql || ' USING (' || (v_rec.metadata->>'qual') || ')';
      END IF;
    ELSIF (v_rec.metadata->>'command') = 'INSERT' THEN
      IF (v_rec.metadata->>'with_check') IS NOT NULL THEN
        v_sql := v_sql || ' WITH CHECK (' || (v_rec.metadata->>'with_check') || ')';
      END IF;
    ELSIF (v_rec.metadata->>'command') IN ('UPDATE', 'ALL') THEN
      IF (v_rec.metadata->>'qual') IS NOT NULL THEN
        v_sql := v_sql || ' USING (' || (v_rec.metadata->>'qual') || ')';
      END IF;
      IF (v_rec.metadata->>'with_check') IS NOT NULL THEN
        v_sql := v_sql || ' WITH CHECK (' || (v_rec.metadata->>'with_check') || ')';
      END IF;
    END IF;

    v_sql := v_sql || ';';
    RAISE NOTICE 'Restoring original baseline policy: %', v_sql;
    EXECUTE v_sql;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 6: RESTORE OR REMOVE STORAGE BUCKET (C-5, C-13)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_bucket jsonb;
  v_marker jsonb;
BEGIN
  SELECT metadata INTO v_marker
  FROM public._phase1_migration_snapshot
  WHERE snapshot_type = 'bucket_marker' AND entity_name = 'scholarship-documents' AND snapshot_version = 1;

  IF v_marker IS NOT NULL AND (v_marker->>'pre_existed')::boolean IS FALSE THEN
    -- Bucket was created by Phase 1: remove if empty
    IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'scholarship-documents') THEN
      DELETE FROM storage.buckets WHERE id = 'scholarship-documents';
      RAISE NOTICE 'Removed newly created bucket scholarship-documents.';
    ELSE
      RAISE WARNING 'Bucket scholarship-documents was created by Phase 1 but contains storage objects. Bucket retained.';
    END IF;
  ELSE
    -- Bucket pre-existed: restore original configuration
    SELECT metadata INTO v_bucket
    FROM public._phase1_migration_snapshot
    WHERE snapshot_type = 'bucket' AND entity_name = 'scholarship-documents' AND snapshot_version = 1;

    IF v_bucket IS NOT NULL THEN
      UPDATE storage.buckets
      SET
        public = (v_bucket->>'public')::boolean,
        file_size_limit = (v_bucket->>'file_size_limit')::bigint,
        allowed_mime_types = (
          SELECT array_agg(elem)
          FROM jsonb_array_elements_text(v_bucket->'allowed_mime_types') AS elem
        ),
        avif_autodetection = (v_bucket->>'avif_autodetection')::boolean
      WHERE id = 'scholarship-documents';
      RAISE NOTICE 'Restored pre-existing bucket scholarship-documents configuration.';
    END IF;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 7: RESTORE TABLE RLS AND FORCE RLS SETTINGS (C-20)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_rls jsonb;
BEGIN
  SELECT metadata INTO v_rls
  FROM public._phase1_migration_snapshot
  WHERE snapshot_type = 'table_rls' AND entity_name = 'application_documents' AND snapshot_version = 1;

  IF v_rls IS NOT NULL THEN
    IF NOT (v_rls->>'rowsecurity')::boolean THEN
      ALTER TABLE public.application_documents DISABLE ROW LEVEL SECURITY;
    ELSE
      ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;
    END IF;

    IF NOT (v_rls->>'forcerowsecurity')::boolean THEN
      ALTER TABLE public.application_documents NO FORCE ROW LEVEL SECURITY;
    ELSE
      ALTER TABLE public.application_documents FORCE ROW LEVEL SECURITY;
    END IF;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 8: SAFE COLUMN AND INDEX ROLLBACK (C-29, C-30)
-- Drops ONLY columns genuinely introduced by Phase 1; preserves pre-existing columns!
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_application_documents_storage_path;
DROP INDEX IF EXISTS public.idx_application_documents_app_id;

DO $$
DECLARE
  v_pre_existing_cols text[];
  v_col text;
  v_phase1_cols text[] := ARRAY['storage_path', 'file_hash', 'uploaded_by', 'verified_by', 'verification_notes'];
BEGIN
  SELECT ARRAY(
    SELECT metadata->>'column_name'
    FROM public._phase1_migration_snapshot
    WHERE snapshot_type = 'column' AND snapshot_version = 1
  ) INTO v_pre_existing_cols;

  FOREACH v_col IN ARRAY v_phase1_cols
  LOOP
    IF NOT (v_col = ANY(v_pre_existing_cols)) THEN
      EXECUTE 'ALTER TABLE public.application_documents DROP COLUMN IF EXISTS ' || quote_ident(v_col) || ';';
      RAISE NOTICE 'Dropped Phase 1 extension column: %', v_col;
    ELSE
      RAISE NOTICE 'Preserved pre-existing column: % (did not originate in Phase 1)', v_col;
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 9: UPDATE STATE MACHINE & RETAIN SNAPSHOT FOR VERIFICATION (C-33, C-42)
-- Snapshot is retained so tests/rollback-verification.sql can verify exact baseline match.
-- ----------------------------------------------------------------------------
UPDATE public._phase1_migration_state
SET state = 'ROLLED_BACK', completed_at = clock_timestamp()
WHERE migration_name = 'phase1_documents';

COMMIT;
