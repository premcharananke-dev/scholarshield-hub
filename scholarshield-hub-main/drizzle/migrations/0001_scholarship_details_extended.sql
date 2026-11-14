-- ScholarShield: Incremental Extended Scholarship & Application Tracking Schema
-- Problem Statement No. 58: Scholarship Eligibility & Disbursement System
-- Safe, backward-compatible migrations with IF NOT EXISTS checks.

-- 1. Extend public.scholarships with comprehensive details and renewal columns
ALTER TABLE public.scholarships
  ADD COLUMN IF NOT EXISTS funding_authority text,
  ADD COLUMN IF NOT EXISTS payment_frequency text DEFAULT 'Annual',
  ADD COLUMN IF NOT EXISTS tuition_coverage text DEFAULT 'Partial Tuition Fee',
  ADD COLUMN IF NOT EXISTS additional_benefits text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS total_financial_assistance text,
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'Direct Benefit Transfer (DBT)',
  ADD COLUMN IF NOT EXISTS disbursement_authority text,
  ADD COLUMN IF NOT EXISTS duration text,
  ADD COLUMN IF NOT EXISTS course_duration_coverage text,
  ADD COLUMN IF NOT EXISTS is_renewable boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS renewal_frequency text DEFAULT 'Annual',
  ADD COLUMN IF NOT EXISTS renewal_conditions text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS renewal_documents text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS renewal_instructions text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS renewal_deadline text,
  ADD COLUMN IF NOT EXISTS min_renewal_cgpa numeric,
  ADD COLUMN IF NOT EXISTS min_renewal_attendance numeric DEFAULT 75,
  ADD COLUMN IF NOT EXISTS application_steps jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS important_instructions text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS faqs jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS official_portal_name text,
  ADD COLUMN IF NOT EXISTS official_guidelines_url text,
  ADD COLUMN IF NOT EXISTS institute_verification_deadline text,
  ADD COLUMN IF NOT EXISTS expected_disbursement_date text;

-- 2. Extend public.applications with submission mode and external portal tracking
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS application_mode text DEFAULT 'INTERNAL',
  ADD COLUMN IF NOT EXISTS external_reference_number text,
  ADD COLUMN IF NOT EXISTS external_portal_name text,
  ADD COLUMN IF NOT EXISTS external_portal_status text,
  ADD COLUMN IF NOT EXISTS institutional_verification_status text DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS authority_verification_status text DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS uploaded_documents jsonb DEFAULT '[]';

-- 3. Extend public.application_documents with file metadata
ALTER TABLE public.application_documents
  ADD COLUMN IF NOT EXISTS file_size integer,
  ADD COLUMN IF NOT EXISTS file_type text,
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS rejection_reason text;
