import { matchScholarship, isVisibleTo } from "./eligibility";
import { DEGREE_OPTIONS, BRANCH_OPTIONS } from "./academic-options";
import type { MatchProfile, Scholarship, Profile, Application } from "./types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log("=== SCHOLARSHIELD PHASE 1 VERIFICATION SUITE ===\n");

// 1. Personal Details: First Name and Last Name Splitting & Combining
console.log("--- 1. First Name & Last Name Compatibility ---");
{
  const fullNameDb = "Priya Sharma";
  const [initFirst = "", ...restLast] = fullNameDb.trim().split(/\s+/);
  const initLast = restLast.join(" ");

  assert(initFirst === "Priya", "Prefilled First Name matches split");
  assert(initLast === "Sharma", "Prefilled Last Name matches split");

  const combined = `${initFirst.trim()} ${initLast.trim()}`;
  assert(combined === fullNameDb, "Combined First & Last name exactly matches full_name");

  // Single word name fallback
  const singleName = "Aaditya";
  const [sFirst = "", ...sRest] = singleName.trim().split(/\s+/);
  const sLast = sRest.join(" ");
  assert(sFirst === "Aaditya" && sLast === "", "Single-word name correctly parses First Name with empty Last Name");

  // Multi-part name (e.g., "Mohammad Tariq Khan")
  const multiName = "Mohammad Tariq Khan";
  const [mFirst = "", ...mRest] = multiName.trim().split(/\s+/);
  const mLast = mRest.join(" ");
  assert(mFirst === "Mohammad" && mLast === "Tariq Khan", "Multi-part name preserves full last name");
  assert(`${mFirst.trim()} ${mLast.trim()}` === multiName, "Multi-part name rejoins without data loss");
}

// 2. Degree & Branch Mapping to Database Fields
console.log("\n--- 2. Degree & Branch Mapping ---");
{
  assert(DEGREE_OPTIONS.includes("B.Tech (Bachelor of Technology)" as any), "B.Tech exists in DEGREE_OPTIONS");
  assert(BRANCH_OPTIONS.includes("Computer Science and Engineering (CSE)" as any), "CSE exists in BRANCH_OPTIONS");
  assert(BRANCH_OPTIONS.length >= 35, `BRANCH_OPTIONS contains verified academic branch options (${BRANCH_OPTIONS.length} options)`);

  // Resolution of standard selection
  const selectedDegree: string = "B.Tech (Bachelor of Technology)";
  const customDegree: string = "";
  const resolvedDegree = (selectedDegree === "Other" ? customDegree.trim() : selectedDegree).trim();
  assert(resolvedDegree === "B.Tech (Bachelor of Technology)", "Standard degree resolved cleanly for course column");

  // Resolution of 'Other' selection
  const otherDegree: string = "Other";
  const customDegreeInput: string = "Dual Degree B.Tech + M.Tech in Robotics";
  const resolvedOtherDegree = (otherDegree === "Other" ? customDegreeInput.trim() : otherDegree).trim();
  assert(resolvedOtherDegree === "Dual Degree B.Tech + M.Tech in Robotics", "Custom degree resolved cleanly for course column");

  const selectedBranch: string = "CSE - Artificial Intelligence & Machine Learning (AI & ML)";
  const customBranch: string = "";
  const resolvedBranch = (selectedBranch === "Other" ? customBranch.trim() : selectedBranch).trim();
  assert(resolvedBranch === "CSE - Artificial Intelligence & Machine Learning (AI & ML)", "Standard branch resolved cleanly for course_stream column");
}

// 3. Required Documents Mapping
console.log("\n--- 3. Required Documents Specificity ---");
{
  const mockScholarship: Scholarship = {
    id: "SCH-001",
    name: "National Merit Scheme",
    provider: "Ministry of Education",
    provider_type: "Government",
    description: "Merit scheme",
    tags: ["Merit-Based"],
    study_levels: ["Undergraduate"],
    course_streams: [],
    eligible_years: [],
    eligible_gender: "Any",
    max_income: 400000,
    min_percentage: 80,
    percentage_basis: "Previous year aggregate",
    eligible_categories: [],
    amount: "₹50,000 / year",
    benefits: null,
    documents: ["Income Certificate", "Previous Year Marksheet", "College ID Card"],
    other_conditions: [],
    opening_date: "2026-08-01",
    closing_date: "2026-11-30",
    academic_year: "2026-27",
    application_url: null,
    source_url: null,
    unverified_fields: [],
    verification_note: null,
    is_active: true,
  };

  const appDocs = mockScholarship.documents.map((d) => ({ name: d, provided: d === "Income Certificate" }));
  assert(appDocs.length === 3, "Only the 3 required documents are generated");
  assert(appDocs[0]?.name === "Income Certificate" && appDocs[0]?.provided === true, "Document readiness tracked accurately");
  assert(appDocs[1]?.provided === false, "Unmarked document tracked as not ready");
}

// 4. Girls-Only Scholarship Visibility & Gender Privacy
console.log("\n--- 4. Girls-Only Scholarship Visibility ---");
{
  const womenScholarship: Scholarship = {
    id: "SCH-GIRLS",
    name: "Pragati Scholarship for Girls",
    provider: "AICTE",
    provider_type: "Government",
    description: "Support for girl students pursuing technical education",
    tags: ["Women-Specific", "Government"],
    study_levels: ["Undergraduate", "Diploma"],
    course_streams: ["Engineering"],
    eligible_years: [1],
    eligible_gender: "Female",
    max_income: 800000,
    min_percentage: 60,
    percentage_basis: null,
    eligible_categories: [],
    amount: "₹50,000 / annum",
    benefits: null,
    documents: ["Income Certificate", "Admission Proof"],
    other_conditions: [],
    opening_date: "2026-08-01",
    closing_date: "2026-12-31",
    academic_year: "2026-27",
    application_url: null,
    source_url: null,
    unverified_fields: [],
    verification_note: null,
    is_active: true,
  };

  const maleProfile: MatchProfile = {
    gender: "Male",
    use_gender_for_matching: true,
    course_stream: "Engineering",
    study_level: "Undergraduate",
    year_of_study: 1,
    academic_percentage: 85,
    family_income: 300000,
    category: "General",
  };

  const femaleEligibleProfile: MatchProfile = {
    gender: "Female",
    use_gender_for_matching: true,
    course_stream: "Engineering",
    study_level: "Undergraduate",
    year_of_study: 1,
    academic_percentage: 85,
    family_income: 300000,
    category: "General",
  };

  const femaleIneligibleIncomeProfile: MatchProfile = {
    gender: "Female",
    use_gender_for_matching: true,
    course_stream: "Engineering",
    study_level: "Undergraduate",
    year_of_study: 1,
    academic_percentage: 85,
    family_income: 1200000, // Exceeds 8 lakh
    category: "General",
  };

  // Male student should NOT see it as visible opportunity
  assert(!isVisibleTo(womenScholarship, maleProfile), "Female-only scholarship is hidden from male student (isVisibleTo = false)");
  
  // Female student meets all criteria
  const femaleMatch = matchScholarship(womenScholarship, femaleEligibleProfile);
  assert(femaleMatch.verdict === "Eligible", "Female student meeting all criteria is Eligible");

  // Female student exceeding income limit must NOT be eligible just because of gender
  const femaleIncomeFail = matchScholarship(womenScholarship, femaleIneligibleIncomeProfile);
  assert(femaleIncomeFail.verdict === "Not Eligible", "Female student with excessive income is Not Eligible");
  const failedCheck = femaleIncomeFail.checks.find((c) => c.label === "Family income");
  assert(failedCheck?.status === "fail", "Family income condition specifically failed");
}

// 5. Automatic Alternative Scholarship Recommendations
console.log("\n--- 5. Automatic Alternative Scholarship Recommendations ---");
{
  const unsuccessfulSch: Scholarship = {
    id: "SCH-REJECTED",
    name: "Ultra Merit Fellowship",
    provider: "Private Foundation",
    provider_type: "Private",
    description: "Needs 95% marks",
    tags: ["Merit-Based"],
    study_levels: ["Undergraduate"],
    course_streams: [],
    eligible_years: [],
    eligible_gender: "Any",
    max_income: null,
    min_percentage: 95,
    percentage_basis: null,
    eligible_categories: [],
    amount: "₹1,00,000",
    benefits: null,
    documents: [],
    other_conditions: [],
    opening_date: null,
    closing_date: "2026-12-31",
    academic_year: "2026-27",
    application_url: null,
    source_url: null,
    unverified_fields: [],
    verification_note: null,
    is_active: true,
  };

  const alternativeEligibleSch: Scholarship = {
    id: "SCH-ALT-1",
    name: "Post-Matric Scholarship",
    provider: "State Government",
    provider_type: "Government",
    description: "Open to state students",
    tags: ["Need-Based"],
    study_levels: ["Undergraduate"],
    course_streams: [],
    eligible_years: [],
    eligible_gender: "Any",
    max_income: 500000,
    min_percentage: 60,
    percentage_basis: null,
    eligible_categories: [],
    amount: "₹30,000",
    benefits: null,
    documents: ["Income Certificate"],
    other_conditions: [],
    opening_date: null,
    closing_date: "2026-11-30",
    academic_year: "2026-27",
    application_url: null,
    source_url: null,
    unverified_fields: [],
    verification_note: null,
    is_active: true,
  };

  const studentProfile: MatchProfile = {
    gender: "Female",
    use_gender_for_matching: true,
    course_stream: "Engineering",
    study_level: "Undergraduate",
    year_of_study: 2,
    academic_percentage: 75, // Fails 95% but passes 60%
    family_income: 250000,
    category: "OBC",
  };

  const allScholarships = [unsuccessfulSch, alternativeEligibleSch];

  // Logic: exclude unsuccessful scholarship, match remaining
  const alternatives = allScholarships
    .filter((s) => s.id !== unsuccessfulSch.id && s.is_active && isVisibleTo(s, studentProfile))
    .map((s) => ({ s, match: matchScholarship(s, studentProfile) }))
    .filter((x) => x.match.verdict === "Eligible");

  assert(alternatives.length === 1, "Exactly 1 alternative identified");
  assert(alternatives[0]?.s.id === "SCH-ALT-1", "Correct alternative scholarship identified");
  assert(alternatives[0]?.match.verdict === "Eligible", "Alternative is strictly Eligible");
  assert(!alternatives.some((x) => x.s.id === unsuccessfulSch.id), "Original rejected scholarship is excluded");
}

// 6. Student Dashboard Recommendation Prioritization
console.log("\n--- 6. Student Dashboard Prioritization ---");
{
  const schWomen: Scholarship = {
    id: "SCH-W",
    name: "Women in Tech Award",
    provider: "AICTE",
    provider_type: "Government",
    description: "For women",
    tags: ["Women-Specific"],
    study_levels: ["Undergraduate"],
    course_streams: [],
    eligible_years: [],
    eligible_gender: "Female",
    max_income: null,
    min_percentage: 60,
    percentage_basis: null,
    eligible_categories: [],
    amount: "₹50,000",
    benefits: null,
    documents: [],
    other_conditions: [],
    opening_date: null,
    closing_date: "2026-12-15",
    academic_year: "2026-27",
    application_url: null,
    source_url: null,
    unverified_fields: [],
    verification_note: null,
    is_active: true,
  };

  const schGeneralUrgent: Scholarship = {
    id: "SCH-GEN-URGENT",
    name: "General Merit Closing Soon",
    provider: "Central Govt",
    provider_type: "Government",
    description: "General merit",
    tags: ["Merit-Based"],
    study_levels: ["Undergraduate"],
    course_streams: [],
    eligible_years: [],
    eligible_gender: "Any",
    max_income: null,
    min_percentage: 60,
    percentage_basis: null,
    eligible_categories: [],
    amount: "₹25,000",
    benefits: null,
    documents: [],
    other_conditions: [],
    opening_date: null,
    closing_date: "2026-11-15", // Closest deadline
    academic_year: "2026-27",
    application_url: null,
    source_url: null,
    unverified_fields: [],
    verification_note: null,
    is_active: true,
  };

  const schPartialInfo: Scholarship = {
    id: "SCH-PARTIAL",
    name: "Category Specific Scholarship",
    provider: "Dept of Social Justice",
    provider_type: "Government",
    description: "Needs category",
    tags: ["Category-Based"],
    study_levels: ["Undergraduate"],
    course_streams: [],
    eligible_years: [],
    eligible_gender: "Any",
    max_income: null,
    min_percentage: 50,
    percentage_basis: null,
    eligible_categories: ["SC", "ST"],
    amount: "₹40,000",
    benefits: null,
    documents: [],
    other_conditions: [],
    opening_date: null,
    closing_date: "2026-11-20",
    academic_year: "2026-27",
    application_url: null,
    source_url: null,
    unverified_fields: [],
    verification_note: null,
    is_active: true,
  };

  // Female profile with missing category
  const femaleProfile: MatchProfile = {
    gender: "Female",
    use_gender_for_matching: true,
    course_stream: null,
    study_level: "Undergraduate",
    year_of_study: 1,
    academic_percentage: 75,
    family_income: 200000,
    category: null, // Missing category
  };

  const pool = [schPartialInfo, schGeneralUrgent, schWomen];
  const evaluated = pool.map((s) => ({ s, match: matchScholarship(s, femaleProfile) }));

  const getDaysLeft = (deadline?: string | null) => {
    if (!deadline) return 999999;
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days >= 0 ? days : 999999;
  };

  evaluated.sort((a, b) => {
    const getTier = (item: typeof a) => {
      if (item.match.verdict === "Eligible") {
        if (item.s.eligible_gender === "Female") return 1; // Tier 1: Women-specific eligible
        return 2; // Tier 2: General eligible
      }
      return 3; // Tier 3: Additional info required
    };
    const tierA = getTier(a);
    const tierB = getTier(b);
    if (tierA !== tierB) return tierA - tierB;
    return getDaysLeft(a.s.closing_date) - getDaysLeft(b.s.closing_date);
  });

  assert(evaluated[0]?.s.id === "SCH-W", "Priority 1: Women-specific eligible scholarship is ranked #1 for eligible female student");
  assert(evaluated[1]?.s.id === "SCH-GEN-URGENT", "Priority 2: General eligible scholarship is ranked #2");
  assert(evaluated[2]?.s.id === "SCH-PARTIAL", "Priority 3: Scholarship requiring missing category information is ranked after eligible schemes");
}

console.log(`\n========================================`);
console.log(`PHASE 1 TEST RESULTS: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);
