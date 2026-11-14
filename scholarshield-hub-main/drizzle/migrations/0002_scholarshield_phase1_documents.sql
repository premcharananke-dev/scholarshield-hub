-- ============================================================================
-- SCHOLARSHIELD – PHASE 1 PRODUCTION MIGRATION
-- Document Storage Provisioning, Integrity Triggers, and RLS Hardening
-- Problem Statement No. 58 | Target: Supabase PostgreSQL 14/15 + Supabase Storage
-- Reconciled Defects: C-1 through C-46
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- STEP 1: ADVISORY LOCK & FAIL-CLOSED RERUN STATE GATE (C-27, C-33, C-38, C-39)
-- ----------------------------------------------------------------------------
-- C-39: Acquire transaction-level advisory lock immediately (fails without deadlock)
DO $lock_gate$
DECLARE
  v_locked boolean;
BEGIN
  SELECT pg_try_advisory_xact_lock(hashtext('scholarshield_phase1_documents')) INTO v_locked;
  IF NOT v_locked THEN
    RAISE EXCEPTION 'MIGRATION_LOCKED: Phase 1 migration is currently executing in another session. Aborting concurrent execution.';
  END IF;
END $lock_gate$;

-- Ensure state and snapshot tables exist
CREATE TABLE IF NOT EXISTS public._phase1_migration_state (
  migration_name text PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('IN_PROGRESS', 'APPLIED', 'ROLLED_BACK')),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  applied_by text NOT NULL DEFAULT session_user
);

CREATE TABLE IF NOT EXISTS public._phase1_migration_snapshot (
  snapshot_type text NOT NULL,
  entity_schema text NOT NULL DEFAULT 'public',
  entity_name text NOT NULL,
  snapshot_version integer NOT NULL DEFAULT 1,
  captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  metadata jsonb NOT NULL,
  PRIMARY KEY (snapshot_type, entity_schema, entity_name, snapshot_version)
);

-- C-38: Fail-Closed Rerun State Gate
-- In PostgreSQL, RETURN inside a DO block does not halt subsequent SQL statements.
-- Therefore, an already-applied migration MUST fail-closed with RAISE EXCEPTION to abort
-- the entire transaction immediately, guaranteeing zero downstream DDL executes.
DO $state_gate$
DECLARE
  v_state text;
  v_completed_at timestamptz;
BEGIN
  SELECT state, completed_at INTO v_state, v_completed_at
  FROM public._phase1_migration_state
  WHERE migration_name = 'phase1_documents';

  IF v_state = 'APPLIED' THEN
    RAISE EXCEPTION 'MIGRATION_ALREADY_APPLIED: Phase 1 migration is already applied (completed at %). Aborting transaction before any DDL executes.', v_completed_at
      USING ERRCODE = 'check_violation';
  ELSIF v_state = 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'MIGRATION_INTERRUPTED: Phase 1 migration state is IN_PROGRESS from a previous interrupted run. Manual inspection or rollback required.';
  END IF;

  -- Record in-progress state for current transaction
  INSERT INTO public._phase1_migration_state (migration_name, state, started_at, applied_by)
  VALUES ('phase1_documents', 'IN_PROGRESS', clock_timestamp(), session_user)
  ON CONFLICT (migration_name) DO UPDATE
    SET state = 'IN_PROGRESS', started_at = clock_timestamp(), applied_by = session_user;
END $state_gate$;

-- ----------------------------------------------------------------------------
-- STEP 2: DETERMINISTIC BASELINE MANIFEST & COMPREHENSIVE SNAPSHOT (C-20, C-29, C-31)
-- ----------------------------------------------------------------------------
DO $snapshot_builder$
DECLARE
  v_col_count integer := 0;
  v_idx_count integer := 0;
  v_fn_count integer := 0;
  v_trg_count integer := 0;
  v_pol_count integer := 0;
BEGIN
  -- 2a. Snapshot pre-existing columns on public.application_documents (C-29, C-30)
  INSERT INTO public._phase1_migration_snapshot (snapshot_type, entity_schema, entity_name, snapshot_version, metadata)
  SELECT
    'column',
    table_schema,
    column_name,
    1,
    jsonb_build_object(
      'column_name', column_name,
      'data_type', data_type,
      'is_nullable', is_nullable,
      'column_default', column_default
    )
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'application_documents'
  ON CONFLICT (snapshot_type, entity_schema, entity_name, snapshot_version) DO NOTHING;

  GET DIAGNOSTICS v_col_count = ROW_COUNT;

  -- 2b. Snapshot pre-existing indexes on public.application_documents (C-29)
  INSERT INTO public._phase1_migration_snapshot (snapshot_type, entity_schema, entity_name, snapshot_version, metadata)
  SELECT
    'index',
    schemaname,
    indexname,
    1,
    jsonb_build_object(
      'schemaname', schemaname,
      'tablename', tablename,
      'indexname', indexname,
      'indexdef', indexdef
    )
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'application_documents'
  ON CONFLICT (snapshot_type, entity_schema, entity_name, snapshot_version) DO NOTHING;

  GET DIAGNOSTICS v_idx_count = ROW_COUNT;

  -- 2c. Snapshot pre-existing functions and ownership/ACL (C-20, C-29)
  INSERT INTO public._phase1_migration_snapshot (snapshot_type, entity_schema, entity_name, snapshot_version, metadata)
  SELECT
    'function',
    n.nspname,
    p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
    1,
    jsonb_build_object(
      'schema_name', n.nspname,
      'function_name', p.proname,
      'identity_args', pg_get_function_identity_arguments(p.oid),
      'function_def', pg_get_functiondef(p.oid),
      'owner', rol.rolname,
      'proacl', p.proacl::text
    )
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_roles rol ON rol.oid = p.proowner
  WHERE n.nspname = 'public'
    AND p.proname IN ('enforce_document_integrity', 'prevent_delete_verified_documents')
  ON CONFLICT (snapshot_type, entity_schema, entity_name, snapshot_version) DO NOTHING;

  GET DIAGNOSTICS v_fn_count = ROW_COUNT;

  -- 2d. Snapshot pre-existing triggers on public.application_documents (C-20, C-29)
  INSERT INTO public._phase1_migration_snapshot (snapshot_type, entity_schema, entity_name, snapshot_version, metadata)
  SELECT
    'trigger',
    'public',
    t.tgname,
    1,
    jsonb_build_object(
      'trigger_name', t.tgname,
      'table_name', 'application_documents',
      'tgenabled', t.tgenabled::text
    )
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'application_documents' AND NOT t.tgisinternal
  ON CONFLICT (snapshot_type, entity_schema, entity_name, snapshot_version) DO NOTHING;

  GET DIAGNOSTICS v_trg_count = ROW_COUNT;

  -- 2e. Snapshot table RLS, FORCE RLS, and table ACL (C-20, C-29)
  INSERT INTO public._phase1_migration_snapshot (snapshot_type, entity_schema, entity_name, snapshot_version, metadata)
  SELECT
    'table_rls',
    n.nspname,
    c.relname,
    1,
    jsonb_build_object(
      'rowsecurity', c.relrowsecurity,
      'forcerowsecurity', c.relforcerowsecurity,
      'relacl', c.relacl::text
    )
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'application_documents'
  ON CONFLICT (snapshot_type, entity_schema, entity_name, snapshot_version) DO NOTHING;

  -- 2f. Snapshot pre-existing storage bucket config (or record explicit creation marker: C-13)
  INSERT INTO public._phase1_migration_snapshot (snapshot_type, entity_schema, entity_name, snapshot_version, metadata)
  SELECT
    'bucket',
    'storage',
    id,
    1,
    jsonb_build_object(
      'id', id,
      'name', name,
      'public', public,
      'file_size_limit', file_size_limit,
      'allowed_mime_types', allowed_mime_types,
      'avif_autodetection', avif_autodetection,
      'pre_existed', true
    )
  FROM storage.buckets
  WHERE id = 'scholarship-documents'
  ON CONFLICT (snapshot_type, entity_schema, entity_name, snapshot_version) DO NOTHING;

  INSERT INTO public._phase1_migration_snapshot (snapshot_type, entity_schema, entity_name, snapshot_version, metadata)
  SELECT
    'bucket_marker',
    'storage',
    'scholarship-documents',
    1,
    jsonb_build_object('pre_existed', false)
  WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'scholarship-documents')
  ON CONFLICT (snapshot_type, entity_schema, entity_name, snapshot_version) DO NOTHING;

  -- 2g. Snapshot ALL pre-existing policies on target tables without name filtering (C-23)
  INSERT INTO public._phase1_migration_snapshot (snapshot_type, entity_schema, entity_name, snapshot_version, metadata)
  SELECT
    'policy',
    n.nspname,
    c.relname || ':' || p.polname,
    1,
    jsonb_build_object(
      'table_schema', n.nspname,
      'table_name', c.relname,
      'policy_name', p.polname,
      'command', CASE p.polcmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
      END,
      'permissive', (p.polpermissive IS TRUE),
      'roles', (
        SELECT jsonb_agg(
          CASE
            WHEN r_oid = 0 THEN 'public'
            ELSE rol.rolname
          END
        )
        FROM unnest(p.polroles) AS r_oid
        LEFT JOIN pg_roles rol ON rol.oid = r_oid
      ),
      'qual', pg_get_expr(p.polqual, p.polrelid),
      'with_check', pg_get_expr(p.polwithcheck, p.polrelid)
    )
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE (
      (n.nspname = 'public' AND c.relname = 'application_documents')
      OR (n.nspname = 'storage' AND c.relname = 'objects' AND (
          p.polname ILIKE '%scholarship%' OR
          pg_get_expr(p.polqual, p.polrelid) ILIKE '%scholarship-documents%' OR
          pg_get_expr(p.polwithcheck, p.polrelid) ILIKE '%scholarship-documents%'
      ))
    )
  ON CONFLICT (snapshot_type, entity_schema, entity_name, snapshot_version) DO NOTHING;

  GET DIAGNOSTICS v_pol_count = ROW_COUNT;

  -- 2h. Store Deterministic Baseline Manifest (C-31)
  INSERT INTO public._phase1_migration_snapshot (snapshot_type, entity_schema, entity_name, snapshot_version, metadata)
  VALUES (
    'manifest',
    'public',
    'phase1_manifest',
    1,
    jsonb_build_object(
      'migration_name', 'phase1_documents',
      'snapshot_version', 1,
      'required_categories', jsonb_build_array('manifest', 'table_rls', 'column', 'policy'),
      'captured_counts', jsonb_build_object(
        'columns', v_col_count,
        'indexes', v_idx_count,
        'functions', v_fn_count,
        'triggers', v_trg_count,
        'policies', v_pol_count
      ),
      'sealed_at', clock_timestamp()
    )
  )
  ON CONFLICT (snapshot_type, entity_schema, entity_name, snapshot_version) DO NOTHING;
END $snapshot_builder$;

-- ----------------------------------------------------------------------------
-- STEP 3: FAIL-CLOSED STORAGE POLICY AUDITOR (C-2, C-12, C-19, C-34, C-40)
-- Strict rejection of unmanaged permissive rules without claiming AST parsing
-- ----------------------------------------------------------------------------
DO $auditor$
DECLARE
  v_rec record;
  v_qual text;
  v_check text;
  v_clean_qual text;
  v_clean_check text;
  v_has_public_role boolean;
  v_abort_reason text;
BEGIN
  FOR v_rec IN
    SELECT
      p.polname,
      c.relname,
      p.polroles,
      p.polqual,
      p.polwithcheck,
      CASE p.polcmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
      END AS cmd
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage'
      AND c.relname = 'objects'
      AND p.polpermissive IS TRUE
      AND p.polname NOT IN (
        'scholarship_docs_student_select',
        'scholarship_docs_student_insert',
        'scholarship_docs_student_update',
        'scholarship_docs_student_delete',
        'scholarship_docs_admin_select',
        'scholarship_docs_admin_insert',
        'scholarship_docs_admin_update',
        'scholarship_docs_admin_delete',
        'scholarship_docs_service_role',
        'Allow authenticated uploads to scholarship-documents',
        'Allow authenticated reads to scholarship-documents',
        'Allow authenticated updates to scholarship-documents',
        'Allow authenticated deletes to scholarship-documents',
        'Give users access to own folder scholarship-documents'
      )
  LOOP
    v_has_public_role := (
      0 = ANY(v_rec.polroles) OR
      EXISTS (
        SELECT 1 FROM pg_roles r
        WHERE r.oid = ANY(v_rec.polroles)
          AND r.rolname IN ('anon', 'authenticated', 'public')
      )
    );

    IF v_has_public_role THEN
      v_qual := pg_get_expr(v_rec.polqual, 'storage.objects'::regclass);
      v_check := pg_get_expr(v_rec.polwithcheck, 'storage.objects'::regclass);
      v_clean_qual := lower(COALESCE(v_qual, ''));
      v_clean_check := lower(COALESCE(v_check, ''));
      v_abort_reason := NULL;

      -- Check 1: Missing expressions that imply permissive TRUE (C-19, C-34)
      IF v_qual IS NULL AND v_rec.cmd IN ('SELECT', 'UPDATE', 'DELETE', 'ALL') THEN
        v_abort_reason := 'Missing USING expression grants unconditional global access';
      ELSIF v_check IS NULL AND v_rec.cmd IN ('INSERT', 'ALL') THEN
        v_abort_reason := 'Missing WITH CHECK expression grants unconditional global access';
      -- Check 2: Explicit TRUE or broad OR conditions
      ELSIF v_clean_qual = 'true' OR v_clean_check = 'true' THEN
        v_abort_reason := 'Expression evaluates unconditionally to TRUE';
      ELSIF v_clean_qual LIKE '% or %' OR v_clean_check LIKE '% or %' THEN
        v_abort_reason := 'Contains permissive OR condition that may bypass bucket isolation';
      -- Check 3: References scholarship-documents directly without being managed
      ELSIF v_clean_qual LIKE '%scholarship-documents%' OR v_clean_check LIKE '%scholarship-documents%' THEN
        v_abort_reason := 'Unmanaged policy directly references scholarship-documents';
      -- Check 4: Must enforce strict equality to another bucket
      ELSIF (v_qual IS NOT NULL AND v_clean_qual NOT LIKE '%bucket_id = %')
         OR (v_check IS NOT NULL AND v_clean_check NOT LIKE '%bucket_id = %') THEN
        v_abort_reason := 'Does not enforce strict equality constraint on bucket_id';
      END IF;

      IF v_abort_reason IS NOT NULL THEN
        RAISE EXCEPTION
          'MIGRATION ABORTED (Fail-Closed Policy Audit): Storage policy "%" on storage.objects failed security validation (Reason: %). Command: %, Roles: %, USING: %, WITH CHECK: %. Manual review required before migration can proceed.',
          v_rec.polname, v_abort_reason, v_rec.cmd, v_rec.polroles, v_qual, v_check;
      END IF;
    END IF;
  END LOOP;
END $auditor$;

-- ----------------------------------------------------------------------------
-- STEP 4: STORAGE BUCKET PROVISIONING (Preserving Stricter Settings: C-22)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scholarship-documents',
  'scholarship-documents',
  false,
  5242880, -- 5 MB
  ARRAY['application/pdf'::text, 'image/jpeg'::text, 'image/png'::text]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = LEAST(COALESCE(storage.buckets.file_size_limit, 5242880), 5242880),
  allowed_mime_types = CASE
    WHEN storage.buckets.allowed_mime_types IS NOT NULL
     AND storage.buckets.allowed_mime_types <@ ARRAY['application/pdf','image/jpeg','image/png']::text[]
    THEN storage.buckets.allowed_mime_types
    ELSE ARRAY['application/pdf'::text, 'image/jpeg'::text, 'image/png'::text]
  END;

-- ----------------------------------------------------------------------------
-- STEP 5: SCHEMA EXTENSIONS ON public.application_documents
-- ----------------------------------------------------------------------------
ALTER TABLE public.application_documents
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS file_hash text,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_notes text;

CREATE INDEX IF NOT EXISTS idx_application_documents_storage_path
  ON public.application_documents (storage_path)
  WHERE storage_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_application_documents_app_id
  ON public.application_documents (application_id);

-- ----------------------------------------------------------------------------
-- STEP 6: SECURITY DEFINER INTEGRITY TRIGGER (C-1, C-6, C-9, C-10, C-17, C-28, C-32)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_document_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, storage, auth, pg_temp
AS $$
DECLARE
  v_is_service_role boolean;
  v_is_admin boolean;
  v_app_status text;
  v_folder text;
  v_filename text;
  v_obj_id uuid;
  v_obj_size bigint;
  v_obj_mime text;
BEGIN
  -- C-17 FIX: Caller Identity Resolution via session_user and auth.role()
  -- Inside SECURITY DEFINER, current_user is always postgres.
  -- session_user identifies the actual connection origin (authenticator vs postgres superuser).
  v_is_service_role := (
    auth.role() = 'service_role'
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  );
  v_is_admin := (
    v_is_service_role
    OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'))
  );

  -- ==========================================================================
  -- STAGE 1: TAMPER LOCK & IMMUTABLE STATE ENFORCEMENT (C-10, C-28)
  -- MUST execute BEFORE any early-return branch or storage_path check!
  -- Prevents setting storage_path = NULL on a verified document in a single update.
  -- ==========================================================================
  IF TG_OP = 'UPDATE' AND OLD.verified IS TRUE THEN
    -- Student can NEVER modify, un-verify, or clear a verified document under ANY circumstances!
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Unauthorized: Students cannot modify, delete, or un-verify a verified document (ID: %)', OLD.id;
    END IF;

    -- Admin / service_role can revoke verification (setting verified = false),
    -- BUT storage_path, file_hash, file_size, and application_id CANNOT be changed or set to NULL in the same update!
    IF (OLD.storage_path IS DISTINCT FROM NEW.storage_path)
       OR (OLD.file_hash IS DISTINCT FROM NEW.file_hash)
       OR (OLD.file_size IS DISTINCT FROM NEW.file_size)
       OR (OLD.application_id IS DISTINCT FROM NEW.application_id) THEN
      RAISE EXCEPTION 'Tamper protection: Verified document content and storage path cannot be modified or cleared to NULL. Revocation of verification (setting verified = false) must be performed first as an isolated operation without changing document identity.';
    END IF;

    -- Audit tracking: if admin revokes verification, clear verified_by
    IF NEW.verified IS FALSE THEN
      NEW.verified_by := NULL;
    END IF;
  END IF;

  -- ==========================================================================
  -- STAGE 2: UNBACKED DOCUMENT CHECKLIST ROW (C-9 Frontend Compatibility)
  -- Supports initial application submission where frontend inserts checklist items with storage_path = NULL.
  -- ==========================================================================
  IF NEW.storage_path IS NULL OR trim(NEW.storage_path) = '' THEN
    IF NEW.verified IS TRUE THEN
      RAISE EXCEPTION 'Cannot verify document: no physical storage object has been uploaded (application_id: %)', NEW.application_id;
    END IF;

    NEW.provided := false;
    NEW.verified := false;
    NEW.file_size := NULL;
    NEW.file_hash := NULL;
    NEW.file_type := NULL;
    RETURN NEW;
  END IF;

  -- ==========================================================================
  -- STAGE 3: DOCUMENT WITH STORAGE PATH PROVIDED
  -- ==========================================================================

  -- 3a. Validate storage path format: strictly "<application_id>/<filename>"
  v_folder := split_part(NEW.storage_path, '/', 1);
  v_filename := split_part(NEW.storage_path, '/', 2);

  IF v_folder <> NEW.application_id
     OR length(v_filename) = 0
     OR (length(NEW.storage_path) - length(replace(NEW.storage_path, '/', ''))) <> 1 THEN
    RAISE EXCEPTION 'Invalid storage path "%". Must strictly follow format: <application_id>/<filename>', NEW.storage_path;
  END IF;

  -- 3b. Application Ownership & Status Check (Non-admin interactive students)
  IF NOT v_is_admin THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = NEW.application_id AND a.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Caller does not own application "%"', NEW.application_id;
    END IF;

    SELECT status INTO v_app_status FROM public.applications WHERE id = NEW.application_id;
    IF v_app_status IN ('REJECTED', 'APPROVED', 'DISBURSED', 'DISBURSEMENT PENDING') THEN
      RAISE EXCEPTION 'Modifications prohibited: Application "%" is in immutable status "%"', NEW.application_id, v_app_status;
    END IF;
  END IF;

  -- 3c. Verification Authority Check
  IF NEW.verified IS TRUE AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators or service role may verify documents';
  END IF;

  -- 3d. Universal Physical Storage Object Validation (C-1, C-32)
  -- Enforced universally across students, admins, and service_role.
  SELECT
    id,
    (metadata->>'size')::bigint,
    metadata->>'mimetype'
  INTO v_obj_id, v_obj_size, v_obj_mime
  FROM storage.objects
  WHERE bucket_id = 'scholarship-documents'
    AND name = NEW.storage_path;

  IF v_obj_id IS NULL THEN
    RAISE EXCEPTION 'Integrity failure: Physical object "%" does not exist in bucket "scholarship-documents"', NEW.storage_path;
  END IF;

  IF v_obj_size > 5242880 THEN
    RAISE EXCEPTION 'Physical file size (% bytes) exceeds maximum limit of 5 MB (5242880 bytes)', v_obj_size;
  END IF;

  IF v_obj_mime NOT IN ('application/pdf', 'image/jpeg', 'image/png') THEN
    RAISE EXCEPTION 'Invalid physical MIME type "%". Only application/pdf, image/jpeg, and image/png are allowed', v_obj_mime;
  END IF;

  -- 3e. Synchronize validated metadata
  NEW.provided := true;
  NEW.file_size := v_obj_size;
  NEW.file_type := v_obj_mime;

  IF TG_OP = 'INSERT' AND NEW.uploaded_by IS NULL THEN
    NEW.uploaded_by := auth.uid();
  END IF;

  IF NEW.verified IS TRUE AND (TG_OP = 'INSERT' OR OLD.verified IS NOT TRUE) AND NEW.verified_by IS NULL THEN
    NEW.verified_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_document_integrity() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_document_integrity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_document_integrity() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_enforce_document_integrity ON public.application_documents;
CREATE TRIGGER trg_enforce_document_integrity
  BEFORE INSERT OR UPDATE ON public.application_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_document_integrity();

-- ----------------------------------------------------------------------------
-- STEP 7: VERIFIED DOCUMENT DELETE PREVENTION TRIGGER (C-1, C-7)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_delete_verified_documents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, storage, auth, pg_temp
AS $$
BEGIN
  IF OLD.verified IS TRUE THEN
    RAISE EXCEPTION 'Audit protection: Cannot delete verified document (ID: %, Application: %). Verification must be revoked first.',
      OLD.id, OLD.application_id;
  END IF;
  RETURN OLD;
END;
$$;

ALTER FUNCTION public.prevent_delete_verified_documents() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.prevent_delete_verified_documents() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_delete_verified_documents() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_prevent_delete_verified_documents ON public.application_documents;
CREATE TRIGGER trg_prevent_delete_verified_documents
  BEFORE DELETE ON public.application_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_delete_verified_documents();

-- ----------------------------------------------------------------------------
-- STEP 8: ROW-LEVEL SECURITY HARDENING ON public.application_documents
-- ----------------------------------------------------------------------------
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_documents FORCE ROW LEVEL SECURITY;

-- Drop legacy baseline policies
DROP POLICY IF EXISTS "Docs read own or admin" ON public.application_documents;
DROP POLICY IF EXISTS "Docs insert own" ON public.application_documents;
DROP POLICY IF EXISTS "Docs admin verify" ON public.application_documents;
DROP POLICY IF EXISTS "app_docs_student_read" ON public.application_documents;
DROP POLICY IF EXISTS "app_docs_student_insert" ON public.application_documents;
DROP POLICY IF EXISTS "app_docs_student_update" ON public.application_documents;
DROP POLICY IF EXISTS "app_docs_admin_all" ON public.application_documents;
DROP POLICY IF EXISTS "app_docs_service_role" ON public.application_documents;

-- 8a. Student Read Policy
CREATE POLICY "app_docs_student_read"
  ON public.application_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_documents.application_id
        AND a.user_id = auth.uid()
    )
  );

-- 8b. Student Insert Policy (Active, editable applications only)
CREATE POLICY "app_docs_student_insert"
  ON public.application_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT verified
    AND EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_documents.application_id
        AND a.user_id = auth.uid()
        AND a.status NOT IN ('REJECTED', 'APPROVED', 'DISBURSED', 'DISBURSEMENT PENDING')
    )
  );

-- 8c. Student Update Policy (Cannot verify, cannot modify locked applications)
CREATE POLICY "app_docs_student_update"
  ON public.application_documents
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_documents.application_id
        AND a.user_id = auth.uid()
        AND a.status NOT IN ('REJECTED', 'APPROVED', 'DISBURSED', 'DISBURSEMENT PENDING')
    )
  )
  WITH CHECK (
    NOT verified
    AND EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_documents.application_id
        AND a.user_id = auth.uid()
        AND a.status NOT IN ('REJECTED', 'APPROVED', 'DISBURSED', 'DISBURSEMENT PENDING')
    )
  );

-- 8d. Admin Comprehensive Policy on Database Records
CREATE POLICY "app_docs_admin_all"
  ON public.application_documents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8e. Service Role Comprehensive Policy
CREATE POLICY "app_docs_service_role"
  ON public.application_documents
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- STEP 9: PURGE LEGACY AND OVERLY PERMISSIVE STORAGE POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated uploads to scholarship-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads to scholarship-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to scholarship-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes to scholarship-documents" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder scholarship-documents" ON storage.objects;
DROP POLICY IF EXISTS "scholarship_docs_student_read" ON storage.objects;
DROP POLICY IF EXISTS "scholarship_docs_student_insert" ON storage.objects;
DROP POLICY IF EXISTS "scholarship_docs_student_update" ON storage.objects;
DROP POLICY IF EXISTS "scholarship_docs_student_delete" ON storage.objects;
DROP POLICY IF EXISTS "scholarship_docs_student_select" ON storage.objects;
DROP POLICY IF EXISTS "scholarship_docs_admin_all" ON storage.objects;
DROP POLICY IF EXISTS "scholarship_docs_admin_select" ON storage.objects;
DROP POLICY IF EXISTS "scholarship_docs_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "scholarship_docs_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "scholarship_docs_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "scholarship_docs_service_role" ON storage.objects;

-- ----------------------------------------------------------------------------
-- STEP 10: COMMAND-SPECIFIC HARDENED STORAGE RLS POLICIES (C-7, C-18)
-- ----------------------------------------------------------------------------

-- 10a. Student Read Policy (Can read own files: verified or unverified)
CREATE POLICY "scholarship_docs_student_select"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'scholarship-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT a.id FROM public.applications a
      WHERE a.user_id = auth.uid()
    )
  );

-- 10b. Student Upload Policy
CREATE POLICY "scholarship_docs_student_insert"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'scholarship-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT a.id FROM public.applications a
      WHERE a.user_id = auth.uid()
        AND a.status NOT IN ('REJECTED', 'APPROVED', 'DISBURSED', 'DISBURSEMENT PENDING')
    )
  );

-- 10c. Student Update Policy (Cannot overwrite verified files)
CREATE POLICY "scholarship_docs_student_update"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'scholarship-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT a.id FROM public.applications a
      WHERE a.user_id = auth.uid()
        AND a.status NOT IN ('REJECTED', 'APPROVED', 'DISBURSED', 'DISBURSEMENT PENDING')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.application_documents d
      WHERE d.storage_path = storage.objects.name
        AND d.verified IS TRUE
    )
  );

-- 10d. Student Delete Policy (Cannot delete verified files)
CREATE POLICY "scholarship_docs_student_delete"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'scholarship-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT a.id FROM public.applications a
      WHERE a.user_id = auth.uid()
        AND a.status NOT IN ('REJECTED', 'APPROVED', 'DISBURSED', 'DISBURSEMENT PENDING')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.application_documents d
      WHERE d.storage_path = storage.objects.name
        AND d.verified IS TRUE
    )
  );

-- 10e. Admin SELECT Policy (C-18: Admins can read/download ALL documents, verified or unverified!)
CREATE POLICY "scholarship_docs_admin_select"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'scholarship-documents'
    AND public.has_role(auth.uid(), 'admin')
  );

-- 10f. Admin INSERT Policy
CREATE POLICY "scholarship_docs_admin_insert"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'scholarship-documents'
    AND public.has_role(auth.uid(), 'admin')
  );

-- 10g. Admin UPDATE Policy (Enforces verified file lock; admin must un-verify in DB first)
CREATE POLICY "scholarship_docs_admin_update"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'scholarship-documents'
    AND public.has_role(auth.uid(), 'admin')
    AND NOT EXISTS (
      SELECT 1 FROM public.application_documents d
      WHERE d.storage_path = storage.objects.name
        AND d.verified IS TRUE
    )
  );

-- 10h. Admin DELETE Policy (Enforces verified file lock; admin must un-verify in DB first)
CREATE POLICY "scholarship_docs_admin_delete"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'scholarship-documents'
    AND public.has_role(auth.uid(), 'admin')
    AND NOT EXISTS (
      SELECT 1 FROM public.application_documents d
      WHERE d.storage_path = storage.objects.name
        AND d.verified IS TRUE
    )
  );

-- 10i. Service Role Comprehensive Policy on Storage (Backend Infrastructure)
CREATE POLICY "scholarship_docs_service_role"
  ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'scholarship-documents')
  WITH CHECK (bucket_id = 'scholarship-documents');

-- ----------------------------------------------------------------------------
-- STEP 11: COMMIT ATOMIC STATE (C-33)
-- ----------------------------------------------------------------------------
UPDATE public._phase1_migration_state
SET state = 'APPLIED', completed_at = clock_timestamp()
WHERE migration_name = 'phase1_documents';

COMMIT;
