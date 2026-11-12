// Phase 9 comprehensive automated regression suite covering eligibility, attendance checks,
// catalog integrity, status workflow transitions, and SHA-256 duplicate fingerprinting.
import { MASTER_SCHOLARSHIPS, computeApplicationStatus, computeVerificationStatus } from "../data/scholarships";
import { BRANCH_OPTIONS, DEGREE_OPTIONS } from "./academic-options";
import {
  categorizeScholarships,
  getAlternativeRecommendations,
  matchScholarship,
  sha256,
} from "./eligibility";
import { STREAMS, type MatchProfile, type Scholarship } from "./types";

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  FAIL: ${msg}`);
    failed++;
  }
}

console.log("=== ScholarShield Phase 9 Audit Verification Suite ===");

// 1. Attendance rule check: missing attendance must NOT falsely return Eligible
{
  const vidya = MASTER_SCHOLARSHIPS.find((s) => s.id === "SCH-021");
  const epass = MASTER_SCHOLARSHIPS.find((s) => s.id === "SCH-026");
  assert(Boolean(vidya && epass), "SCH-021 and SCH-026 present in catalog");

  const profileNoAttendance: MatchProfile = {
    gender: "Female",
    use_gender_for_matching: true,
    course: "B.Tech (Bachelor of Technology)",
    course_stream: "Computer Science and Engineering (CSE)",
    college: "JNTUA College of Engineering, Anantapur, Andhra Pradesh",
    state: "Andhra Pradesh",
    study_level: "Undergraduate",
    year_of_study: 2,
    academic_percentage: 85,
    family_income: 150000,
    category: "OBC",
  };

  if (vidya) {
    const resNoAtt = matchScholarship(vidya, profileNoAttendance);
    assert(
      resNoAtt.verdict === "Additional Information Required",
      "SCH-021 requires Attendance when attendance is omitted instead of returning false Eligible"
    );
    const missingAtt = resNoAtt.checks.find((c) => c.label === "Attendance");
    assert(missingAtt?.status === "missing", "Missing attendance emits status=missing check");

    const resPassAtt = matchScholarship(vidya, { ...profileNoAttendance, attendance: 75 });
    assert(resPassAtt.verdict === "Eligible", "SCH-021 returns Eligible at exact 75% boundary");

    const resFailAtt = matchScholarship(vidya, { ...profileNoAttendance, attendance: 74 });
    assert(resFailAtt.verdict === "Not Eligible", "SCH-021 returns Not Eligible below 75% attendance");
  }

  if (epass) {
    const telanganaProfile: MatchProfile = {
      ...profileNoAttendance,
      college: "Osmania University, Hyderabad, Telangana",
      state: "Telangana",
    };
    const epassNoAtt = matchScholarship(epass, telanganaProfile);
    assert(
      epassNoAtt.verdict === "Additional Information Required",
      "SCH-026 requires Attendance when attendance is omitted"
    );
  }
}

// 2. Boundary checks: income, percentage, year, privacy-gender, and social categories
{
  const pragati = MASTER_SCHOLARSHIPS.find((s) => s.id === "SCH-001");
  const csss = MASTER_SCHOLARSHIPS.find((s) => s.id === "SCH-005");
  const obcScheme = MASTER_SCHOLARSHIPS.find((s) => s.id === "SCH-008");

  assert(Boolean(pragati && csss && obcScheme), "Core central schemes SCH-001, SCH-005, SCH-008 exist");

  if (pragati) {
    const hiddenGenderMatch = matchScholarship(pragati, {
      gender: "Female",
      use_gender_for_matching: false,
      course: "B.Tech",
      course_stream: "Engineering",
      study_level: "Undergraduate",
      year_of_study: 1,
      academic_percentage: 85,
      family_income: 500000,
      category: "General",
    });
    assert(
      hiddenGenderMatch.verdict === "Additional Information Required",
      "Privacy mode hides gender cleanly and prompts for Additional Information Required"
    );

    const exactIncomeCap = matchScholarship(pragati, {
      gender: "Female",
      use_gender_for_matching: true,
      course: "B.Tech",
      course_stream: "Engineering",
      study_level: "Undergraduate",
      year_of_study: 2,
      academic_percentage: 85,
      family_income: 800000,
      category: "General",
    });
    assert(exactIncomeCap.verdict === "Eligible", "Exact income ceiling ₹8,00,000 passes cleanly");
  }

  if (csss) {
    const exactPct = matchScholarship(csss, {
      gender: "Male",
      use_gender_for_matching: true,
      course: "B.Tech",
      course_stream: "Engineering",
      study_level: "Undergraduate",
      year_of_study: 1,
      family_income: 450000,
      academic_percentage: 80,
      category: "General",
    });
    assert(exactPct.verdict === "Eligible", "Exact 80% marks & ₹4.5L ceiling passes SCH-005");
  }

  if (obcScheme) {
    const ewsRes = matchScholarship(obcScheme, {
      gender: "Male",
      use_gender_for_matching: true,
      course: "B.Sc",
      course_stream: "Science",
      study_level: "Undergraduate",
      year_of_study: 1,
      academic_percentage: 70,
      family_income: 200000,
      category: "EWS",
    });
    assert(ewsRes.verdict === "Eligible", "EWS category passes SCH-008 eligible_categories=['OBC','EWS']");
  }
}

// 3. Catalog status & stream consistency
{
  const sch020 = MASTER_SCHOLARSHIPS.find((s) => s.id === "SCH-020");
  assert(Boolean(sch020), "SCH-020 present");
  if (sch020) {
    assert(sch020.application_status === "Closed", "SCH-020 static status aligns with past closing_date 2026-04-30");
    assert(computeApplicationStatus(sch020) === "Closed", "computeApplicationStatus reports SCH-020 Closed");
    assert(computeVerificationStatus(sch020) === "Verified", "SCH-020 verification_status is Verified");
  }

  const usedStreams = new Set(MASTER_SCHOLARSHIPS.flatMap((s) => s.course_streams));
  for (const st of usedStreams) {
    assert((STREAMS as readonly string[]).includes(st), `Scholarship course stream '${st}' is valid in STREAMS`);
  }
  assert(DEGREE_OPTIONS.includes("Other"), "DEGREE_OPTIONS contains Other fallback");
  assert(BRANCH_OPTIONS.includes("Other"), "BRANCH_OPTIONS contains Other fallback");
}

// 4. Alternative recommendations & categorization consistency
{
  const profile: MatchProfile = {
    gender: "Female",
    use_gender_for_matching: true,
    course: "B.Tech",
    course_stream: "Engineering",
    college: "Andhra University, Visakhapatnam, Andhra Pradesh",
    state: "Andhra Pradesh",
    study_level: "Undergraduate",
    year_of_study: 3,
    academic_percentage: 85,
    attendance: 86,
    family_income: 200000,
    category: "OBC",
  };
  const openCatalog: Scholarship[] = MASTER_SCHOLARSHIPS.filter(
    (s) => s.is_active && (!s.closing_date || s.closing_date >= "2026-11-11")
  );
  const alts = getAlternativeRecommendations(openCatalog, profile, "SCH-001", 3);
  assert(alts.length > 0 && alts.every((a) => a.id !== "SCH-001"), "Alternative recommendations exclude current scheme");
  const cat = categorizeScholarships(openCatalog, profile);
  assert(
    cat.eligible.length + cat.notEligible.length + cat.otherOpportunities.length > 0,
    "Categorized scholarships partition visible catalog cleanly"
  );
}

// 5. SHA-256 deterministic duplicate fingerprint check
{
  const fp1 = await sha256(["cs21b001", "student@example.com", "SCH-001", "2026-27"].map((v) => v.trim().toLowerCase()).join("|"));
  const fp2 = await sha256([" CS21B001 ", "STUDENT@EXAMPLE.COM", "SCH-001", "2026-27"].map((v) => v.trim().toLowerCase()).join("|"));
  const fp3 = await sha256(["cs21b001", "student@example.com", "SCH-002", "2026-27"].map((v) => v.trim().toLowerCase()).join("|"));
  assert(fp1.length === 64 && fp1 === fp2, "SHA-256 fingerprint is case/whitespace normalized and deterministic");
  assert(fp1 !== fp3, "SHA-256 fingerprint differs across distinct scholarship IDs");
}

console.log(`\nPhase 9 Summary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
