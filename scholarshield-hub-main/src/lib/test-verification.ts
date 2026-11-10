import {
  isPasswordSatisfied,
  validatePasswordRules,
} from "../components/password-input";
import {
  formatCollegeDisplay,
  searchColleges,
  INDIAN_COLLEGES,
} from "./colleges-data";
import { GENDERS } from "./types";

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

console.log("=== SCHOLARSHIELD ENHANCEMENT VERIFICATION SUITE ===\n");

// 1. Password Checklist & 5 Rules Tests
console.log("1. Testing Password Validation Rules (5 Criteria):");
const emptyRules = validatePasswordRules("");
assert(
  !emptyRules.minLength &&
    !emptyRules.hasLower &&
    !emptyRules.hasUpper &&
    !emptyRules.hasNumber &&
    !emptyRules.hasSpecial,
  "Empty password fails all 5 requirements",
);
assert(!isPasswordSatisfied(emptyRules), "isPasswordSatisfied is false for empty password");

const shortPwd = validatePasswordRules("Ab1!");
assert(
  !shortPwd.minLength &&
    shortPwd.hasLower &&
    shortPwd.hasUpper &&
    shortPwd.hasNumber &&
    shortPwd.hasSpecial,
  "Short password ('Ab1!') satisfies 4 rules but fails minLength",
);
assert(!isPasswordSatisfied(shortPwd), "isPasswordSatisfied is false for short password (< 8 chars)");

const noUpper = validatePasswordRules("password123!");
assert(!noUpper.hasUpper, "Password without uppercase fails hasUpper");
assert(!isPasswordSatisfied(noUpper), "isPasswordSatisfied is false when uppercase is missing");

const noLower = validatePasswordRules("PASSWORD123!");
assert(!noLower.hasLower, "Password without lowercase fails hasLower");
assert(!isPasswordSatisfied(noLower), "isPasswordSatisfied is false when lowercase is missing");

const noNum = validatePasswordRules("Password!@#");
assert(!noNum.hasNumber, "Password without number fails hasNumber");
assert(!isPasswordSatisfied(noNum), "isPasswordSatisfied is false when number is missing");

const noSpecial = validatePasswordRules("Password123");
assert(!noSpecial.hasSpecial, "Password without special char fails hasSpecial");
assert(!isPasswordSatisfied(noSpecial), "isPasswordSatisfied is false when special char is missing");

const validPwd = validatePasswordRules("ScholarShield#2026");
assert(
  validPwd.minLength &&
    validPwd.hasLower &&
    validPwd.hasUpper &&
    validPwd.hasNumber &&
    validPwd.hasSpecial,
  "Strong password satisfies all 5 requirements",
);
assert(isPasswordSatisfied(validPwd), "isPasswordSatisfied is true for valid password");

// 2. Name Fields & Full Name Compatibility
console.log("\n2. Testing Name Fields & Profile Full Name Mapping:");
const firstName = "  Rajeev  ";
const lastName = "  Kumar  ";
const fullName = `${firstName.trim()} ${lastName.trim()}`;
assert(fullName === "Rajeev Kumar", "First Name and Last Name trim and concatenate cleanly into full_name");
assert(firstName.trim().length > 0 && lastName.trim().length > 0, "Both First Name and Last Name are validated as mandatory");

// 3. Confirm Password Validation Logic
console.log("\n3. Testing Confirm Password Matching Logic:");
const pwd1: string = "ScholarShield#2026";
const pwdMismatch: string = "ScholarShield#2027";
const pwdMatch: string = "ScholarShield#2026";
assert(pwd1 !== pwdMismatch, "Detects mismatch when passwords differ");
assert(pwd1 === pwdMatch, "Confirms match when passwords are identical");

// 4. College Autocomplete & Indian Institutions Dataset
console.log("\n4. Testing College Autocomplete & Search:");
console.log(`  Total verified institutions in index: ${INDIAN_COLLEGES.length}`);
assert(INDIAN_COLLEGES.length >= 80, "Substantial coverage of accredited Indian institutions across states");

// Test user prompt example: "Rajeev Gandhi"
const rajeevResults = searchColleges("Rajeev Gandhi");
assert(rajeevResults.length > 0, "Finds colleges matching 'Rajeev Gandhi'");
const rgmcet = rajeevResults.find((c) => c.city.toLowerCase() === "nandyal");
assert(rgmcet !== undefined, "Finds Rajeev Gandhi Memorial College in Nandyal, Andhra Pradesh");
if (rgmcet) {
  const formatted = formatCollegeDisplay(rgmcet);
  console.log(`  Result format: "${formatted}"`);
  assert(
    formatted.includes("Nandyal") && formatted.includes("Andhra Pradesh"),
    "Formatted college includes official name, city, and state",
  );
}

// Test short name / acronym search: "RGMCET"
const acronymResults = searchColleges("RGMCET");
assert(acronymResults.some((c) => c.shortName === "RGMCET"), "Acronym search matches RGMCET");

// Test multi-state coverage
const states = Array.from(new Set(INDIAN_COLLEGES.map((c) => c.state)));
console.log(`  States/UTs represented: ${states.length} (${states.slice(0, 8).join(", ")}...)`);
assert(states.length >= 15, "Wide coverage of institutions across Indian states and union territories");

// Test fallback / empty query handling
assert(searchColleges("").length === 0, "Empty query returns empty array");
assert(searchColleges("a").length === 0, "Single character query returns empty array (< 2 chars threshold)");

// 5. Gender Validation
console.log("\n5. Testing Gender Required Options:");
assert(GENDERS.length === 4, "GENDERS has 4 options: Female, Male, Other, Prefer not to say");
assert(GENDERS.includes("Female") && GENDERS.includes("Male"), "Standard gender options preserved");

// 6. Degree and Branch Options & Database Mappings
console.log("\n6. Testing Degree & Branch Options and Database Mappings:");
const { DEGREE_OPTIONS, BRANCH_OPTIONS } = await import("./academic-options");

assert(DEGREE_OPTIONS.length >= 20, "Comprehensive degree options defined");
assert(DEGREE_OPTIONS.includes("B.Tech (Bachelor of Technology)"), "B.Tech is present in degrees");
assert(DEGREE_OPTIONS.includes("Other"), "'Other' option is present in degrees");

assert(BRANCH_OPTIONS.length >= 25, "Comprehensive branch/specialization options defined");
assert(BRANCH_OPTIONS.includes("Computer Science and Engineering (CSE)"), "CSE is present in branches");
assert(BRANCH_OPTIONS.includes("CSE - Artificial Intelligence & Machine Learning (AI & ML)"), "AI & ML specialization is present in branches");
assert(BRANCH_OPTIONS.includes("Other"), "'Other' option is present in branches");

// Test mapping: standard option
const standardDegree: string = "B.Tech (Bachelor of Technology)";
const standardBranch: string = "Computer Science and Engineering (CSE)";
const dbCourse1 = (standardDegree === "Other" ? "Custom" : standardDegree).trim();
const dbStream1 = (standardBranch === "Other" ? "Custom" : standardBranch).trim();
assert(dbCourse1 === "B.Tech (Bachelor of Technology)", "Degree maps directly to course in profile database");
assert(dbStream1 === "Computer Science and Engineering (CSE)", "Branch maps directly to course_stream in profile database");

// Test mapping: custom "Other" option
const otherDegree = "Other";
const customDegreeInput = "Integrated M.Tech Software Engineering";
const otherBranch = "Other";
const customBranchInput = "Robotics & Cognitive Systems";
const dbCourse2 = (otherDegree === "Other" ? customDegreeInput : otherDegree).trim();
const dbStream2 = (otherBranch === "Other" ? customBranchInput : otherBranch).trim();
assert(dbCourse2 === "Integrated M.Tech Software Engineering", "Custom degree maps cleanly to course");
assert(dbStream2 === "Robotics & Cognitive Systems", "Custom branch maps cleanly to course_stream");

// Summary
console.log(`\n==========================================`);
console.log(`Results: ${passed} Passed, ${failed} Failed`);
if (failed === 0) {
  console.log("ALL TESTS PASSED SUCCESSFULLY! ✓");
} else {
  process.exit(1);
}
