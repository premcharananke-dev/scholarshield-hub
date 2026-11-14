-- ============================================================================
-- LAYER A: POSTGRESQL TRANSACTIONAL TEST SUITE (TC-01 to TC-14)
-- Mode: [DESIGNED – STAGING EXECUTION REQUIRED]
-- File: tests/transactional-unit.sql
-- ============================================================================

BEGIN;

DO $test_runner$
DECLARE
  v_student_a uuid := '11111111-1111-4111-8111-111111111111'::uuid;
  v_student_b uuid := '22222222-2222-4222-8222-222222222222'::uuid;
  v_admin_user uuid := '33333333-3333-4333-8333-333333333333'::uuid;
  v_app_a text := 'SS-2026-901';
  v_app_b text := 'SS-2026-902';
  v_doc_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
  v_obj_id uuid;
  v_caught boolean;
  v_err_msg text;
  v_failed_tests text[] := ARRAY[]::text[];
  v_passed_tests text[] := ARRAY[]::text[];
BEGIN
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'INITIATING SCHOLARSHIELD TRANSACTIONAL TEST HARNESS';
  RAISE NOTICE '==================================================';

  -- 1. Core Fixture Setup
  INSERT INTO auth.users (id, email) VALUES
    (v_student_a, 'student_a@test.com'),
    (v_student_b, 'student_b@test.com'),
    (v_admin_user, 'admin@test.com')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_admin_user, 'admin')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.scholarships (
    id, name, provider, provider_type, description, tags, eligible_gender,
    study_levels, course_streams, eligible_years, max_income, min_percentage,
    eligible_categories, amount
  ) VALUES (
    'SCH-TEST-001', 'Engineering Merit Scholarship', 'State Higher Education Dept',
    'Government', 'State merit support for engineering students', '{"merit","engineering"}',
    'Any', '{"Undergraduate"}', '{"Engineering"}', '{1,2,3,4}', 800000, 60.0,
    '{"General","OBC","SC","ST"}', '₹50,000'
  ) ON CONFLICT DO NOTHING;

  INSERT INTO public.applications (
    id, user_id, scholarship_id, scholarship_name, full_name, student_id,
    email, phone, college, course, academic_year, academic_percentage,
    attendance, family_income, category, status, eligible, fingerprint
  ) VALUES
    (
      v_app_a, v_student_a, 'SCH-TEST-001', 'Engineering Merit Scholarship',
      'Alice Student', 'STU-2026-001', 'student_a@test.com', '9876543210',
      'State Engineering College', 'B.Tech Computer Science', '2025-2026',
      85.5, 90.0, 450000, 'General', 'UNDER REVIEW', true, 'FP-TEST-001'
    ),
    (
      v_app_b, v_student_b, 'SCH-TEST-001', 'Engineering Merit Scholarship',
      'Bob Student', 'STU-2026-002', 'student_b@test.com', '9876543211',
      'State Engineering College', 'B.Tech Information Technology', '2025-2026',
      78.0, 85.0, 520000, 'OBC', 'UNDER REVIEW', true, 'FP-TEST-002'
    )
  ON CONFLICT DO NOTHING;

  -- --------------------------------------------------------------------------
  -- TC-01: Baseline Manifest & State Machine Check (C-31)
  -- --------------------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM public._phase1_migration_state
    WHERE migration_name = 'phase1_documents' AND state = 'APPLIED'
  ) AND EXISTS (
    SELECT 1 FROM public._phase1_migration_snapshot
    WHERE snapshot_type = 'manifest' AND entity_name = 'phase1_manifest' AND snapshot_version = 1
  ) THEN
    v_passed_tests := array_append(v_passed_tests, 'TC-01: Baseline Manifest & State Machine Check');
  ELSE
    v_failed_tests := array_append(v_failed_tests, 'TC-01: Baseline Manifest or State missing');
  END IF;

  -- --------------------------------------------------------------------------
  -- TC-02: Unbacked Checklist Insertion Compatibility (C-9)
  -- --------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.application_documents (id, application_id, document_name, provided, verified, storage_path)
    VALUES (v_doc_id, v_app_a, 'Income Certificate', true, false, NULL);

    IF EXISTS (
      SELECT 1 FROM public.application_documents
      WHERE id = v_doc_id AND provided = false AND verified = false AND storage_path IS NULL
    ) THEN
      v_passed_tests := array_append(v_passed_tests, 'TC-02: Unbacked Checklist Insertion (provided clamped to false)');
    ELSE
      v_failed_tests := array_append(v_failed_tests, 'TC-02: Unbacked Checklist did not clamp provided to false');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed_tests := array_append(v_failed_tests, 'TC-02: Unexpected exception: ' || SQLERRM);
  END;

  -- --------------------------------------------------------------------------
  -- TC-03: Storage Path Folder Mismatch Rejection
  -- --------------------------------------------------------------------------
  v_caught := false;
  BEGIN
    UPDATE public.application_documents
    SET storage_path = v_app_b || '/income.pdf'
    WHERE id = v_doc_id;
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
    v_err_msg := SQLERRM;
  END;

  IF v_caught AND v_err_msg ILIKE '%does not match%' THEN
    v_passed_tests := array_append(v_passed_tests, 'TC-03: Storage Path Folder Mismatch Rejected');
  ELSE
    v_failed_tests := array_append(v_failed_tests, 'TC-03: Storage Path Folder Mismatch allowed unexpectedly');
  END IF;

  -- --------------------------------------------------------------------------
  -- TC-04: Phantom Document Rejection (No physical object in storage.objects: C-1)
  -- --------------------------------------------------------------------------
  v_caught := false;
  BEGIN
    UPDATE public.application_documents
    SET storage_path = v_app_a || '/missing_physical.pdf'
    WHERE id = v_doc_id;
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
    v_err_msg := SQLERRM;
  END;

  IF v_caught AND v_err_msg ILIKE '%does not exist in bucket%' THEN
    v_passed_tests := array_append(v_passed_tests, 'TC-04: Phantom Document Rejected');
  ELSE
    v_failed_tests := array_append(v_failed_tests, 'TC-04: Phantom Document allowed unexpectedly');
  END IF;

  -- Fixture: Valid Physical Storage Object
  INSERT INTO storage.objects (id, bucket_id, name, owner, metadata)
  VALUES (
    gen_random_uuid(), 'scholarship-documents', v_app_a || '/income.pdf',
    v_student_a, jsonb_build_object('size', 1048576, 'mimetype', 'application/pdf')
  ) RETURNING id INTO v_obj_id;

  -- --------------------------------------------------------------------------
  -- TC-05: Valid Physical Object Linking & Metadata Synchronization (C-32)
  -- --------------------------------------------------------------------------
  BEGIN
    UPDATE public.application_documents
    SET storage_path = v_app_a || '/income.pdf'
    WHERE id = v_doc_id;

    IF EXISTS (
      SELECT 1 FROM public.application_documents
      WHERE id = v_doc_id AND provided = true AND file_size = 1048576 AND file_type = 'application/pdf'
    ) THEN
      v_passed_tests := array_append(v_passed_tests, 'TC-05: Valid Physical Object Linked & Metadata Synchronized');
    ELSE
      v_failed_tests := array_append(v_failed_tests, 'TC-05: Metadata synchronization failed');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed_tests := array_append(v_failed_tests, 'TC-05: Unexpected exception: ' || SQLERRM);
  END;

  -- --------------------------------------------------------------------------
  -- TC-06: Student Cross-Application Path Rejection (C-14)
  -- --------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_student_a::text, 'role', 'authenticated')::text, true);

  -- Fixture: Object in Student B's folder
  INSERT INTO storage.objects (id, bucket_id, name, owner, metadata)
  VALUES (
    gen_random_uuid(), 'scholarship-documents', v_app_b || '/b_doc.pdf',
    v_student_b, jsonb_build_object('size', 1048576, 'mimetype', 'application/pdf')
  ) ON CONFLICT DO NOTHING;

  v_caught := false;
  BEGIN
    INSERT INTO public.application_documents (application_id, document_name, provided, verified, storage_path)
    VALUES (v_app_b, 'Cross-App Breach', false, false, v_app_b || '/b_doc.pdf');
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
    v_err_msg := SQLERRM;
  END;

  IF v_caught AND (v_err_msg ILIKE '%Caller does not own application%' OR v_err_msg ILIKE '%row-level security%') THEN
    v_passed_tests := array_append(v_passed_tests, 'TC-06: Student Cross-Application Path Rejection');
  ELSE
    v_failed_tests := array_append(v_failed_tests, 'TC-06: Cross-application insertion allowed unexpectedly');
  END IF;

  -- --------------------------------------------------------------------------
  -- TC-07: Oversized File Rejection (> 5 MB)
  -- --------------------------------------------------------------------------
  INSERT INTO storage.objects (id, bucket_id, name, owner, metadata)
  VALUES (
    gen_random_uuid(), 'scholarship-documents', v_app_a || '/huge.pdf',
    v_student_a, jsonb_build_object('size', 6000000, 'mimetype', 'application/pdf')
  ) ON CONFLICT DO NOTHING;

  v_caught := false;
  BEGIN
    UPDATE public.application_documents
    SET storage_path = v_app_a || '/huge.pdf'
    WHERE id = v_doc_id;
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
    v_err_msg := SQLERRM;
  END;

  IF v_caught AND v_err_msg ILIKE '%exceeds maximum limit of 5 MB%' THEN
    v_passed_tests := array_append(v_passed_tests, 'TC-07: Oversized File (> 5 MB) Rejected');
  ELSE
    v_failed_tests := array_append(v_failed_tests, 'TC-07: Oversized file allowed unexpectedly');
  END IF;

  -- --------------------------------------------------------------------------
  -- TC-08: Student Verification Authority Block (C-17)
  -- --------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_student_a::text, 'role', 'authenticated')::text, true);

  v_caught := false;
  BEGIN
    UPDATE public.application_documents
    SET verified = true
    WHERE id = v_doc_id;
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
    v_err_msg := SQLERRM;
  END;

  IF v_caught AND v_err_msg ILIKE '%Only administrators or service role may verify%' THEN
    v_passed_tests := array_append(v_passed_tests, 'TC-08: Student Verification Blocked (C-17 identity resolved)');
  ELSE
    v_failed_tests := array_append(v_failed_tests, 'TC-08: Student was able to verify document unexpectedly');
  END IF;

  -- --------------------------------------------------------------------------
  -- TC-09: Admin Verification on Valid Document
  -- --------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_user::text, 'role', 'authenticated')::text, true);

  BEGIN
    UPDATE public.application_documents
    SET verified = true, verification_notes = 'Verified against income certificate'
    WHERE id = v_doc_id;

    IF EXISTS (
      SELECT 1 FROM public.application_documents
      WHERE id = v_doc_id AND verified = true AND verified_by = v_admin_user
    ) THEN
      v_passed_tests := array_append(v_passed_tests, 'TC-09: Admin Verification Succeeded');
    ELSE
      v_failed_tests := array_append(v_failed_tests, 'TC-09: Admin verification failed to record verified_by');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed_tests := array_append(v_failed_tests, 'TC-09: Unexpected exception: ' || SQLERRM);
  END;

  -- --------------------------------------------------------------------------
  -- TC-10: Single-Update Tamper Lock & NULL-Path Wipe Block (C-10, C-28)
  -- --------------------------------------------------------------------------
  -- 10a: Student attempts to un-verify or clear path
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_student_a::text, 'role', 'authenticated')::text, true);

  v_caught := false;
  BEGIN
    UPDATE public.application_documents
    SET verified = false, storage_path = NULL
    WHERE id = v_doc_id;
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
    v_err_msg := SQLERRM;
  END;

  IF v_caught AND v_err_msg ILIKE '%Students cannot modify, delete, or un-verify%' THEN
    v_passed_tests := array_append(v_passed_tests, 'TC-10a: Student Single-Update Tamper Blocked');
  ELSE
    v_failed_tests := array_append(v_failed_tests, 'TC-10a: Student un-verified or modified document unexpectedly');
  END IF;

  -- 10b: Admin attempts single-update file swap or NULL path wipe
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_user::text, 'role', 'authenticated')::text, true);

  v_caught := false;
  BEGIN
    UPDATE public.application_documents
    SET verified = false, storage_path = NULL
    WHERE id = v_doc_id;
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
    v_err_msg := SQLERRM;
  END;

  IF v_caught AND v_err_msg ILIKE '%cannot be modified or cleared to NULL%' THEN
    v_passed_tests := array_append(v_passed_tests, 'TC-10b: Admin Single-Update NULL-Path Wipe Blocked (C-28)');
  ELSE
    v_failed_tests := array_append(v_failed_tests, 'TC-10b: Admin single-update NULL wipe permitted unexpectedly');
  END IF;

  -- --------------------------------------------------------------------------
  -- TC-11: Verified Document Deletion Block in Database
  -- --------------------------------------------------------------------------
  v_caught := false;
  BEGIN
    DELETE FROM public.application_documents WHERE id = v_doc_id;
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
    v_err_msg := SQLERRM;
  END;

  IF v_caught AND v_err_msg ILIKE '%Cannot delete verified document%' THEN
    v_passed_tests := array_append(v_passed_tests, 'TC-11: Verified Document Deletion Blocked');
  ELSE
    v_failed_tests := array_append(v_failed_tests, 'TC-11: Verified document deletion permitted unexpectedly');
  END IF;

  -- --------------------------------------------------------------------------
  -- TC-12: Storage Object Deletion Block for Verified Document (RLS Enforcement)
  -- --------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_student_a::text, 'role', 'authenticated')::text, true);

  -- Student attempts to delete physical file while document is verified
  DELETE FROM storage.objects WHERE bucket_id = 'scholarship-documents' AND name = v_app_a || '/income.pdf';

  -- Under RLS, deleting a verified object affects 0 rows (file remains in storage.objects)
  IF EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'scholarship-documents' AND name = v_app_a || '/income.pdf'
  ) THEN
    v_passed_tests := array_append(v_passed_tests, 'TC-12: Verified Physical Storage Object Delete Blocked');
  ELSE
    v_failed_tests := array_append(v_failed_tests, 'TC-12: Verified physical object was deleted unexpectedly');
  END IF;

  -- --------------------------------------------------------------------------
  -- TC-13: Status-Based Document Lock on REJECTED Application
  -- --------------------------------------------------------------------------
  UPDATE public.applications SET status = 'REJECTED' WHERE id = v_app_a;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_student_a::text, 'role', 'authenticated')::text, true);

  v_caught := false;
  BEGIN
    INSERT INTO public.application_documents (application_id, document_name, provided, verified, storage_path)
    VALUES (v_app_a, 'Late Submission', false, false, NULL);
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
    v_err_msg := SQLERRM;
  END;

  IF v_caught AND v_err_msg ILIKE '%immutable status%' THEN
    v_passed_tests := array_append(v_passed_tests, 'TC-13: Document Mutations Blocked on REJECTED Application');
  ELSE
    v_failed_tests := array_append(v_failed_tests, 'TC-13: Document insert allowed on REJECTED application unexpectedly');
  END IF;

  -- --------------------------------------------------------------------------
  -- TC-14: Status-Based Document Lock on APPROVED Application
  -- --------------------------------------------------------------------------
  UPDATE public.applications SET status = 'APPROVED' WHERE id = v_app_a;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_student_a::text, 'role', 'authenticated')::text, true);

  v_caught := false;
  BEGIN
    INSERT INTO public.application_documents (application_id, document_name, provided, verified, storage_path)
    VALUES (v_app_a, 'Post-Approval Upload', false, false, NULL);
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
    v_err_msg := SQLERRM;
  END;

  IF v_caught AND v_err_msg ILIKE '%immutable status%' THEN
    v_passed_tests := array_append(v_passed_tests, 'TC-14: Document Mutations Blocked on APPROVED Application');
  ELSE
    v_failed_tests := array_append(v_failed_tests, 'TC-14: Document insert allowed on APPROVED application unexpectedly');
  END IF;

  -- Summary Output
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'TEST RESULTS SUMMARY:';
  RAISE NOTICE 'PASSED (%): %', array_length(v_passed_tests, 1), v_passed_tests;
  IF array_length(v_failed_tests, 1) > 0 THEN
    RAISE EXCEPTION 'TEST SUITE FAILED (%): %', array_length(v_failed_tests, 1), v_failed_tests;
  ELSE
    RAISE NOTICE 'ALL 14 TRANSACTIONAL TESTS PASSED SUCCESSFULLY WITHIN TRANSACTION.';
  END IF;
  RAISE NOTICE '==================================================';
END $test_runner$;

ROLLBACK; -- Never leave persistent test residue
