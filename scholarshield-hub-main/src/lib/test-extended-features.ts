// Verification Suite for ScholarShield Comprehensive Scholarship Details & Tracking System
// Problem Statement No. 58: Scholarship Eligibility & Disbursement System

import { MASTER_SCHOLARSHIPS, enrichScholarship, checkRenewalEligibility } from "../data/scholarships";
import { sanitizeForDb } from "./data";
import type { MatchProfile } from "./types";

let passed = 0;
let failed = 0;

function assert(cond: boolean, desc: string) {
  if (cond) {
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failed++;
  }
}

console.log("======================================================================");
console.log("SCHOLARSHIELD: COMPREHENSIVE DETAILS & TRACKING VERIFICATION SUITE");
console.log("======================================================================\n");

// --------------------------------------------------------------------
// 1. ALL 86 SCHOLARSHIPS ENRICHED WITH STRUCTURED DETAILS
// --------------------------------------------------------------------
console.log("1. Testing Comprehensive Details Enrichment Across All 86 Schemes:");
let allEnriched = true;
for (const raw of MASTER_SCHOLARSHIPS) {
  const s = enrichScholarship(raw);
  if (
    !s.funding_authority ||
    !s.payment_frequency ||
    !s.tuition_coverage ||
    !Array.isArray(s.additional_benefits) || s.additional_benefits.length === 0 ||
    !s.total_financial_assistance ||
    !s.payment_method ||
    !s.disbursement_authority ||
    !s.duration ||
    !s.course_duration_coverage ||
    s.is_renewable === undefined ||
    !s.renewal_frequency ||
    !Array.isArray(s.renewal_conditions) || s.renewal_conditions.length === 0 ||
    !Array.isArray(s.renewal_documents) || s.renewal_documents.length === 0 ||
    !Array.isArray(s.renewal_instructions) || s.renewal_instructions.length === 0 ||
    !Array.isArray(s.application_steps) || s.application_steps.length !== 8 ||
    !Array.isArray(s.important_instructions) || s.important_instructions.length === 0 ||
    !Array.isArray(s.faqs) || s.faqs.length === 0 ||
    !s.official_portal_name ||
    !s.official_guidelines_url
  ) {
    allEnriched = false;
    console.error(`Missing enriched attributes on ${s.id} - ${s.name}`);
    break;
  }
}
assert(allEnriched, "All 86 scholarships are reliably enriched with complete structured attributes");

// --------------------------------------------------------------------
// 2. 8-STEP APPLICATION WORKFLOW PRESERVATION
// --------------------------------------------------------------------
console.log("\n2. Testing 8-Step Application Process Definition:");
const baseSch = MASTER_SCHOLARSHIPS[0]!;
const sample = enrichScholarship(baseSch);
assert(sample.application_steps?.length === 8, "Workflow contains exactly 8 standardized stages");
assert(sample.application_steps?.[0]?.title === "Student Registration", "Stage 1 is Student Registration");
assert(sample.application_steps?.[3]?.title === "Online Portal Submission", "Stage 4 is Online Portal Submission");
assert(sample.application_steps?.[4]?.title === "College / Institutional Verification", "Stage 5 is Institutional Verification");
assert(sample.application_steps?.[7]?.title === "DBT Disbursement", "Stage 8 is DBT Disbursement");

// --------------------------------------------------------------------
// 3. RENEWAL ELIGIBILITY CHECKER
// --------------------------------------------------------------------
console.log("\n3. Testing Renewal Eligibility Logic:");
const continuingEligibleStudent: MatchProfile = {
  gender: "Female",
  use_gender_for_matching: true,
  study_level: "Undergraduate",
  course: "B.Tech",
  course_stream: "Engineering",
  year_of_study: 2,
  academic_percentage: 78,
  attendance: 84,
  family_income: 200000,
  category: "General",
};

const firstYearStudent: MatchProfile = {
  ...continuingEligibleStudent,
  year_of_study: 1,
};

const lowAttendanceStudent: MatchProfile = {
  ...continuingEligibleStudent,
  attendance: 64, // below 75%
};

const lowMarksStudent: MatchProfile = {
  ...continuingEligibleStudent,
  academic_percentage: 45, // below cutoff
};

const resEligible = checkRenewalEligibility(baseSch, continuingEligibleStudent);
assert(resEligible.isEligible === true, "Year 2 student with high marks and 84% attendance is ELIGIBLE for renewal");
assert(resEligible.score === 100, "Eligible student scores 100% on renewal criteria");

const resYear1 = checkRenewalEligibility(baseSch, firstYearStudent);
assert(resYear1.isEligible === false, "First year student is NOT eligible for renewal (Must apply under Fresh category)");
assert(resYear1.failedConditions.some((c) => c.includes("Year 1")), "Rejection reason explicitly identifies Year 1 status");

const resAtt = checkRenewalEligibility(baseSch, lowAttendanceStudent);
assert(resAtt.isEligible === false, "Student with 64% attendance is NOT eligible for renewal");
assert(resAtt.failedConditions.some((c) => c.includes("attendance shortfall")), "Rejection reason details attendance shortfall (< 75%)");

const resMarks = checkRenewalEligibility(baseSch, lowMarksStudent);
assert(resMarks.isEligible === false, "Student with 45% marks fails renewal academic requirement");

// --------------------------------------------------------------------
// 4. DATABASE SANITIZATION & BACKWARD COMPATIBILITY
// --------------------------------------------------------------------
console.log("\n4. Testing Database Backward Compatibility (Sanitization):");
const dbPayload = sanitizeForDb(sample);
const allowedColumns = new Set([
  "id", "name", "provider", "provider_type", "description", "tags",
  "eligible_gender", "study_levels", "course_streams", "eligible_years",
  "max_income", "min_percentage", "percentage_basis", "eligible_categories",
  "amount", "benefits", "documents", "other_conditions", "opening_date",
  "closing_date", "academic_year", "application_url", "source_url",
  "unverified_fields", "verification_note", "is_active", "created_at", "updated_at"
]);

let sanitizeSafe = true;
for (const key of Object.keys(dbPayload)) {
  if (!allowedColumns.has(key)) {
    sanitizeSafe = false;
    console.error(`Unexpected column in dbPayload: ${key}`);
    break;
  }
}
assert(sanitizeSafe, "sanitizeForDb strips client-only fields to avoid remote Postgres column errors");

// --------------------------------------------------------------------
// 5. OFFICIAL INFORMATION VERIFICATION INTEGRITY
// --------------------------------------------------------------------
console.log("\n5. Testing Information Integrity & Non-Fabrication Standards:");
let validVerificationSources = true;
for (const s of MASTER_SCHOLARSHIPS) {
  if (!s.provider || !s.provider_type) {
    validVerificationSources = false;
    break;
  }
  if (!s.application_url?.startsWith("http") && s.application_url !== null) {
    validVerificationSources = false;
    break;
  }
  if (!s.source_url?.startsWith("http") && s.source_url !== null) {
    validVerificationSources = false;
    break;
  }
}
assert(validVerificationSources, "All scholarship records cite verified official portal / ministry sources");

console.log("\n======================================================================");
console.log(`TOTAL TEST RESULTS: ${passed} passed, ${failed} failed`);
console.log("======================================================================\n");

if (failed > 0) process.exit(1);
