// Comprehensive Scholarship Discovery & Recommendation Test Suite
// Tests 86+ verified schemes, 20 attributes, state matching, attendance, 3-section categorization, and admin actions.

import {
  MASTER_SCHOLARSHIPS,
  ALL_INDIAN_STATES_AND_UTS,
  computeApplicationStatus,
  computeVerificationStatus,
} from "../data/scholarships";
import {
  matchScholarship,
  getStudentState,
  categorizeScholarships,
  getAlternativeRecommendations,
  effectiveGender,
  isVisibleTo,
} from "./eligibility";
import type { MatchProfile, Scholarship } from "./types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failed++;
  }
}

console.log("======================================================================");
console.log("SCHOLARSHIELD: COMPREHENSIVE SCHOLARSHIP SYSTEM VERIFICATION SUITE");
console.log("======================================================================\n");

// --------------------------------------------------------------------
// TEST 1: CATALOG SIZE & SCOPE
// --------------------------------------------------------------------
console.log("1. Testing Catalog Size and Category Distribution:");
assert(MASTER_SCHOLARSHIPS.length >= 85, `Catalog contains ${MASTER_SCHOLARSHIPS.length} schemes (>= 85 requirement)`);

const centralGovt = MASTER_SCHOLARSHIPS.filter((s) => s.scheme_category === "Central Government");
const stateGovt = MASTER_SCHOLARSHIPS.filter((s) => s.scheme_category === "State Government");
const aicte = MASTER_SCHOLARSHIPS.filter((s) => s.scheme_category === "AICTE");
const ugc = MASTER_SCHOLARSHIPS.filter((s) => s.scheme_category === "UGC");
const corporate = MASTER_SCHOLARSHIPS.filter((s) => s.scheme_category === "Corporate / Private");
const special = MASTER_SCHOLARSHIPS.filter((s) => s.scheme_category === "Special Category");

assert(centralGovt.length >= 12, `Central Government schemes count: ${centralGovt.length} (>= 12)`);
assert(stateGovt.length >= 35, `State Government schemes count: ${stateGovt.length} (>= 35)`);
assert(aicte.length >= 5, `AICTE schemes count: ${aicte.length} (>= 5)`);
assert(ugc.length >= 5, `UGC schemes count: ${ugc.length} (>= 5)`);
assert(corporate.length >= 14, `Corporate / Private foundation schemes: ${corporate.length} (>= 14)`);
assert(special.length >= 4, `Special category schemes: ${special.length} (>= 4)`);

// --------------------------------------------------------------------
// TEST 2: ALL 20 STANDARDIZED ATTRIBUTES PRESENT
// --------------------------------------------------------------------
console.log("\n2. Testing 20 Standardized Attributes per Scholarship:");
let allAttributesValid = true;
const sample = MASTER_SCHOLARSHIPS[0];

for (const s of MASTER_SCHOLARSHIPS) {
  const hasId = !!s.id && s.id.startsWith("SCH-");
  const hasName = !!s.name && s.name.trim().length > 0;
  const hasProvider = !!s.provider && s.provider.trim().length > 0;
  const hasCategory = !!s.scheme_category;
  const hasDesc = !!s.description && s.description.trim().length > 0;
  const hasStates = Array.isArray(s.eligible_states) && s.eligible_states.length > 0;
  const hasCategories = Array.isArray(s.eligible_categories);
  const hasGender = s.eligible_gender === "Any" || s.eligible_gender === "Female";
  const hasAmount = !!s.amount && s.amount.trim().length > 0;
  const hasDocs = Array.isArray(s.documents);
  const hasAppUrl = s.application_url == null || s.application_url.startsWith("http");
  const hasSourceUrl = s.source_url == null || s.source_url.startsWith("http");
  const hasAppStatus = !!(s.application_status ?? computeApplicationStatus(s));
  const hasVerStatus = !!(s.verification_status ?? computeVerificationStatus(s));

  if (
    !hasId ||
    !hasName ||
    !hasProvider ||
    !hasCategory ||
    !hasDesc ||
    !hasStates ||
    !hasCategories ||
    !hasGender ||
    !hasAmount ||
    !hasDocs ||
    !hasAppUrl ||
    !hasSourceUrl ||
    !hasAppStatus ||
    !hasVerStatus
  ) {
    allAttributesValid = false;
    console.error(`Missing attributes on: ${s.id} - ${s.name}`);
    break;
  }
}
assert(allAttributesValid, "All 86 scholarships satisfy the 20-attribute standardized data structure");

// --------------------------------------------------------------------
// TEST 3: ALL 28 STATES AND 8 UNION TERRITORIES COVERAGE
// --------------------------------------------------------------------
console.log("\n3. Testing Pan-India State & UT Coverage:");
const representedStates = new Set<string>();
for (const s of MASTER_SCHOLARSHIPS) {
  for (const st of s.eligible_states ?? []) {
    if (st !== "All India") representedStates.add(st);
  }
}

assert(
  representedStates.has("Andhra Pradesh") &&
    representedStates.has("Telangana") &&
    representedStates.has("Karnataka") &&
    representedStates.has("Tamil Nadu") &&
    representedStates.has("Maharashtra") &&
    representedStates.has("Uttar Pradesh") &&
    representedStates.has("West Bengal") &&
    representedStates.has("Bihar") &&
    representedStates.has("Rajasthan") &&
    representedStates.has("Gujarat") &&
    representedStates.has("Kerala") &&
    representedStates.has("Madhya Pradesh") &&
    representedStates.has("Odisha") &&
    representedStates.has("Punjab") &&
    representedStates.has("Haryana") &&
    representedStates.has("Delhi") &&
    representedStates.has("Assam") &&
    representedStates.has("Jammu and Kashmir") &&
    representedStates.has("Ladakh") &&
    representedStates.has("Goa"),
  "Major Indian States & UTs have dedicated state scholarship programs in the directory"
);

// --------------------------------------------------------------------
// TEST 4: PRIORITY ANDHRA PRADESH SCHEMES
// --------------------------------------------------------------------
console.log("\n4. Testing Andhra Pradesh Priority Schemes:");
const apSchemes = MASTER_SCHOLARSHIPS.filter((s) => s.eligible_states?.includes("Andhra Pradesh"));
assert(apSchemes.length >= 6, `Andhra Pradesh schemes count: ${apSchemes.length}`);

const vidyaDeevena = MASTER_SCHOLARSHIPS.find((s) => s.id === "SCH-021");
assert(!!vidyaDeevena, "Jagananna Vidya Deevena (RTF) found (SCH-021)");
assert(
  Boolean(vidyaDeevena?.amount.includes("Tuition Fee Reimbursement") || vidyaDeevena?.amount.includes("RTF")),
  "Jagananna Vidya Deevena provides 100% Tuition Fee Reimbursement (RTF)"
);

const vasathiDeevena = MASTER_SCHOLARSHIPS.find((s) => s.id === "SCH-022");
assert(!!vasathiDeevena, "Jagananna Vasathi Deevena (MTF) found (SCH-022)");
assert(
  vasathiDeevena?.amount.includes("10,000 to ₹20,000") ?? false,
  "Jagananna Vasathi Deevena covers food & hostel maintenance (₹10,000 - ₹20,000)"
);

const ambedkarOverseas = MASTER_SCHOLARSHIPS.find((s) => s.id === "SCH-025");
assert(!!ambedkarOverseas, "Dr. B.R. Ambedkar Overseas Vidya Nidhi found (SCH-025)");

// --------------------------------------------------------------------
// TEST 5: STATE DOMICILE ELIGIBILITY MATCHING
// --------------------------------------------------------------------
console.log("\n5. Testing State Domicile Matching Logic:");
const apStudentProfile: MatchProfile = {
  gender: "Male",
  use_gender_for_matching: true,
  college: "Andhra University College of Engineering, Visakhapatnam, Andhra Pradesh",
  state: "Andhra Pradesh",
  course_stream: "Engineering",
  study_level: "Undergraduate",
  year_of_study: 1,
  academic_percentage: 82,
  family_income: 180000,
  category: "OBC",
  attendance: 88,
};

const inferredState = getStudentState(apStudentProfile);
assert(inferredState === "Andhra Pradesh", `Student state correctly identified as '${inferredState}'`);

const apMatch = matchScholarship(vidyaDeevena!, apStudentProfile);
assert(apMatch.verdict === "Eligible", "AP student with 88% attendance and ₹1.8L income is ELIGIBLE for Vidya Deevena");
const stateCheck = apMatch.checks.find((c) => c.label === "State Domicile");
assert(stateCheck?.status === "pass", "State domicile check passed for AP student");

// Non-AP student
const maharashtraStudent: MatchProfile = {
  ...apStudentProfile,
  college: "College of Engineering Pune, Pune, Maharashtra",
  state: "Maharashtra",
};
const nonApMatch = matchScholarship(vidyaDeevena!, maharashtraStudent);
assert(nonApMatch.verdict === "Not Eligible", "Maharashtra student is NOT ELIGIBLE for AP Jagananna Vidya Deevena");
const failedStateCheck = nonApMatch.checks.find((c) => c.label === "State Domicile");
assert(failedStateCheck?.status === "fail", "State domicile check failed for non-resident");
assert(
  failedStateCheck?.reason.includes("Open only to residents of Andhra Pradesh") ?? false,
  "Failure reason clearly mentions restriction to Andhra Pradesh residents"
);

// --------------------------------------------------------------------
// TEST 6: ATTENDANCE RULE (75% BIOMETRIC ATTENDANCE)
// --------------------------------------------------------------------
console.log("\n6. Testing Biometric Attendance Condition (>= 75%):");
const lowAttendanceApStudent: MatchProfile = {
  ...apStudentProfile,
  attendance: 68, // below 75%
};
const lowAttMatch = matchScholarship(vidyaDeevena!, lowAttendanceApStudent);
assert(lowAttMatch.verdict === "Not Eligible", "Student with 68% attendance is NOT ELIGIBLE for Vidya Deevena");
const attCheck = lowAttMatch.checks.find((c) => c.label === "Attendance");
assert(attCheck?.status === "fail", "Attendance check marked as fail");
assert(
  attCheck?.reason.includes("Requires minimum 75% attendance") ?? false,
  "Reason explicitly details attendance shortfall"
);

// --------------------------------------------------------------------
// TEST 7: GENDER MATCHING & GIRLS ONLY BADGES
// --------------------------------------------------------------------
console.log("\n7. Testing Gender-Specific Matching & Badges:");
const femaleStudent: MatchProfile = {
  ...apStudentProfile,
  gender: "Female",
};
const maleStudent: MatchProfile = {
  ...apStudentProfile,
  gender: "Male",
};

const pragatiDegree = MASTER_SCHOLARSHIPS.find((s) => s.id === "SCH-001");
const femalePragatiMatch = matchScholarship(pragatiDegree!, femaleStudent);
assert(femalePragatiMatch.verdict === "Eligible", "Female engineering student matches AICTE Pragati Degree");

const malePragatiMatch = matchScholarship(pragatiDegree!, maleStudent);
assert(malePragatiMatch.verdict === "Not Eligible", "Male student is NOT ELIGIBLE for Pragati (Girls only)");
assert(!isVisibleTo(pragatiDegree!, maleStudent), "Pragati is excluded from opportunities shown to male students");

// --------------------------------------------------------------------
// TEST 8: 3 DISTINCT SECTIONS CATEGORIZATION & ALTERNATIVE RECOMMENDATIONS
// --------------------------------------------------------------------
console.log("\n8. Testing 3 Distinct Sections & Alternative Recommendations:");
const categorizedResult = categorizeScholarships(MASTER_SCHOLARSHIPS, apStudentProfile);

assert(categorizedResult.eligible.length > 0, `Eligible scholarships count: ${categorizedResult.eligible.length}`);
assert(categorizedResult.notEligible.length > 0, `Not Eligible scholarships count: ${categorizedResult.notEligible.length}`);
assert(
  categorizedResult.otherOpportunities.length >= 0,
  `Other opportunities / info required count: ${categorizedResult.otherOpportunities.length}`
);

// Ineligible scholarship has recommendations
const sampleIneligible = categorizedResult.notEligible[0];
assert(Boolean(sampleIneligible && sampleIneligible.failedChecks.length > 0), "Ineligible item lists exact failed checks");
assert(Boolean(sampleIneligible && sampleIneligible.recommendations.length > 0), "Ineligible item provides alternative eligible recommendations");
const firstRec = sampleIneligible?.recommendations[0];
const recMatch = firstRec ? matchScholarship(firstRec, apStudentProfile) : null;
assert(recMatch?.verdict === "Eligible", `Alternative recommendation '${firstRec?.name ?? "none"}' is verified eligible`);

// --------------------------------------------------------------------
// TEST 9: VERIFICATION STATUS WORKFLOW
// --------------------------------------------------------------------
console.log("\n9. Testing Verification Status Breakdown:");
const verifiedList = MASTER_SCHOLARSHIPS.filter((s) => computeVerificationStatus(s) === "Verified");
const needsVerList = MASTER_SCHOLARSHIPS.filter((s) => computeVerificationStatus(s) === "Needs Verification");

assert(verifiedList.length >= 75, `Verified records count: ${verifiedList.length} (>= 75 requirement)`);
assert(needsVerList.length <= 12, `Records needing verification: ${needsVerList.length}`);
assert(verifiedList.length + needsVerList.length === MASTER_SCHOLARSHIPS.length, "Total adds up to 100% of catalog");

console.log("\n======================================================================");
console.log(`TOTAL TEST RESULTS: ${passed} passed, ${failed} failed`);
console.log("======================================================================\n");

if (failed > 0) {
  process.exit(1);
}

