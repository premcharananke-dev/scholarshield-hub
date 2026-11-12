// Scholarship eligibility matching. All rule logic lives here so it is easy to explain and change.
// Results are an indication only — the scholarship provider makes the final decision.
import type { Scholarship, MatchProfile } from "./types";
import { STREAMS } from "./types";
import { ALL_INDIAN_STATES_AND_UTS } from "@/data/scholarships";

type CanonicalStream = (typeof STREAMS)[number];

const CANONICAL_STREAM_LOOKUP = new Map<string, CanonicalStream>(
  STREAMS.map((s) => [s.toLowerCase(), s])
);

const DEGREE_STREAM_MAP: Record<string, CanonicalStream[]> = {
  "b.tech (bachelor of technology)": ["Engineering"],
  "b.e. (bachelor of engineering)": ["Engineering"],
  "m.tech (master of technology)": ["Engineering"],
  "m.e. (master of engineering)": ["Engineering"],
  "diploma in engineering / polytechnic": ["Engineering"],
  "b.sc (bachelor of science)": ["Science"],
  "m.sc (master of science)": ["Science"],
  "b.com (bachelor of commerce)": ["Commerce"],
  "m.com (master of commerce)": ["Commerce"],
  "b.a. (bachelor of arts)": ["Arts"],
  "m.a. (master of arts)": ["Arts"],
  "bba (bachelor of business administration)": ["Management"],
  "mba (master of business administration)": ["Management"],
  "bca (bachelor of computer applications)": ["Computer Applications"],
  "mca (master of computer applications)": ["Computer Applications"],
  "b.arch (bachelor of architecture)": ["Architecture"],
  "b.pharm (bachelor of pharmacy)": ["Pharmacy"],
  "m.pharm (master of pharmacy)": ["Pharmacy"],
  "mbbs (bachelor of medicine & surgery)": ["Medical"],
  "bds (bachelor of dental surgery)": ["Medical"],
  "b.des (bachelor of design)": ["Design"],
  "llb (bachelor of laws)": ["Law"],
  "llm (master of laws)": ["Law"],
};

const BRANCH_STREAM_MAP: Record<string, CanonicalStream[]> = {
  "computer science and engineering (cse)": ["Engineering"],
  "cse - artificial intelligence & machine learning (ai & ml)": ["Engineering"],
  "cse - data science": ["Engineering"],
  "cse - cyber security": ["Engineering"],
  "cse - internet of things (iot)": ["Engineering"],
  "information technology (it)": ["Engineering"],
  "electronics and communication engineering (ece)": ["Engineering"],
  "electrical and electronics engineering (eee)": ["Engineering"],
  "mechanical engineering (me)": ["Engineering"],
  "civil engineering (ce)": ["Engineering"],
  "chemical engineering": ["Engineering"],
  "aerospace / aeronautical engineering": ["Engineering"],
  "automobile engineering": ["Engineering"],
  "biomedical engineering": ["Engineering"],
  "biotechnology engineering": ["Engineering"],
  "robotics and automation engineering": ["Engineering"],
  "industrial & production engineering": ["Engineering"],
  "agriculture engineering": ["Engineering"],
  "mining engineering": ["Engineering"],
  "metallurgical and materials engineering": ["Engineering"],
  "marine engineering": ["Engineering"],
  "physics / chemistry / mathematics (pure sciences)": ["Science"],
  "biological sciences / life sciences": ["Science"],
  "computer applications / it": ["Computer Applications"],
  "commerce, accounting & finance": ["Commerce"],
  "business administration & management": ["Management"],
  "economics & analytics": ["Commerce", "Arts"],
  "arts, humanities & social sciences": ["Arts"],
  "english / languages & literature": ["Arts"],
  "medicine & clinical sciences": ["Medical"],
  "dental sciences": ["Medical"],
  "pharmacy & pharmaceutical sciences": ["Pharmacy"],
  "nursing": ["Nursing"],
  "law & legal studies": ["Law"],
  "architecture & planning": ["Architecture"],
  "design (fashion / product / graphic)": ["Design"],
};

const TEXT_STREAM_RULES: Array<{ stream: CanonicalStream; pattern: RegExp }> = [
  {
    stream: "Engineering",
    pattern:
      /\b(b\.?\s*tech|m\.?\s*tech|b\.?\s*e\.?|m\.?\s*e\.?|polytechnic|engineering|cse|ece|eee|mechatronics|aerospace|aeronautical|robotics)\b/i,
  },
  {
    stream: "Computer Applications",
    pattern: /\b(bca|mca|pgdca|computer\s+applications?|b\.?\s*sc\.?\s*(it|cs))\b/i,
  },
  {
    stream: "Pharmacy",
    pattern: /\b(b\.?\s*pharm|m\.?\s*pharm|d\.?\s*pharm|pharm\.?\s*d|pharmac\w*)\b/i,
  },
  {
    stream: "Nursing",
    pattern: /\b(nursing|gnm|anm)\b/i,
  },
  {
    stream: "Architecture",
    pattern: /\b(b\.?\s*arch|m\.?\s*arch|architect\w*)\b/i,
  },
  {
    stream: "Design",
    pattern: /\b(b\.?\s*des|m\.?\s*des|fashion\s+design|product\s+design|graphic\s+design|industrial\s+design|design)\b/i,
  },
  {
    stream: "Law",
    pattern: /\b(ll\.?\s*b|ll\.?\s*m|legal\s+studies|law)\b/i,
  },
  {
    stream: "Medical",
    pattern: /\b(mbbs|bds|bams|bhms|bums|bpt|(?<!bio)medical|medicine|dental|clinical\s+sciences?)\b/i,
  },
  {
    stream: "Management",
    pattern: /\b(bba|mba|pgdm|bbm|bms|business\s+administration|management)\b/i,
  },
  {
    stream: "Commerce",
    pattern: /\b(b\.?\s*com|m\.?\s*com|commerce|accounting|accountancy|chartered\s+account\w*|finance)\b/i,
  },
  {
    stream: "Science",
    pattern:
      /\b(b\.?\s*sc|m\.?\s*sc|pure\s+sciences?|life\s+sciences?|biological\s+sciences?|physics|chemistry|mathematics|microbiology|botany|zoology)\b/i,
  },
  {
    stream: "Arts",
    pattern:
      /(?:^|\b)(?:b\.?\s*a\.?(?=\s*\(|\s|$)|m\.?\s*a\.?(?=\s*\(|\s|$)|arts|humanities|social\s+sciences?|literature|journalism|sociology|psychology|history|political\s+science)\b/i,
  },
];

function resolveSingleAcademicValue(
  raw: string | null | undefined,
  exactMap: Record<string, CanonicalStream[]>
): CanonicalStream[] {
  const trimmed = raw?.trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();
  if (lower === "other") return [];

  const canonical = CANONICAL_STREAM_LOOKUP.get(lower);
  if (canonical && canonical !== "Other") return [canonical];

  const exact = exactMap[lower];
  if (exact) return [...exact];

  const isEngineeringExplicit = TEXT_STREAM_RULES[0]!.pattern.test(lower);
  const matched: CanonicalStream[] = [];
  for (const rule of TEXT_STREAM_RULES) {
    // Prevent "B.Tech in Data Science" / "Biomedical Engineering" from leaking into unrelated faculties.
    if (isEngineeringExplicit && (rule.stream === "Science" || rule.stream === "Medical")) {
      continue;
    }
    if (rule.pattern.test(lower)) {
      matched.push(rule.stream);
    }
  }
  return matched;
}

/**
 * Normalizes a student's Degree (`course`) and Branch (`courseStream`) into canonical `STREAMS`
 * values used on scholarship criteria, ensuring B.Tech/CSE maps cleanly to Engineering while
 * preventing unrelated degrees (e.g. B.Com vs Engineering) from false matches.
 */
export function normalizeCourseStreams(
  course?: string | null,
  courseStream?: string | null
): CanonicalStream[] {
  const degreeStreams = resolveSingleAcademicValue(course, DEGREE_STREAM_MAP);
  const branchStreams = resolveSingleAcademicValue(courseStream, BRANCH_STREAM_MAP);

  const combined = new Set<CanonicalStream>();
  for (const d of degreeStreams) combined.add(d);

  // For multi-faculty branches like "Economics & Analytics" paired with a specific degree (B.Com vs B.A.),
  // intersect with the degree faculty so B.Com isn't treated as Arts.
  const narrowedBranchStreams =
    branchStreams.length > 1 && degreeStreams.length > 0
      ? branchStreams.filter((b) => degreeStreams.includes(b))
      : branchStreams;
  const effectiveBranch = narrowedBranchStreams.length ? narrowedBranchStreams : branchStreams;
  for (const b of effectiveBranch) combined.add(b);

  if (combined.size === 0 && ((course && course.trim()) || (courseStream && courseStream.trim()))) {
    combined.add("Other");
  }
  return Array.from(combined);
}

export type CheckStatus = "pass" | "fail" | "missing";
export type Check = { label: string; value: string; status: CheckStatus; reason: string };
export type Verdict = "Eligible" | "Not Eligible" | "Additional Information Required";
export type Match = { verdict: Verdict; checks: Check[]; manualChecks: string[] };

export const formatMoney = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

/** Gender is only used when the student allows it for matching. */
export function effectiveGender(p: MatchProfile) {
  return p.use_gender_for_matching && p.gender && p.gender !== "Prefer not to say" ? p.gender : null;
}

/** Extract or infer student's state domicile from profile.state or profile.college */
export function getStudentState(p: MatchProfile): string | null {
  if (p.state && p.state.trim()) return p.state.trim();
  if (!p.college) return null;

  // Colleges are formatted as "College Name, District, State"
  const parts = p.college.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      const match = ALL_INDIAN_STATES_AND_UTS.find(
        (st) => st.toLowerCase() === lastPart.toLowerCase()
      );
      if (match && match !== "All India") return match;
    }
  }

  // Scan college string for any Indian state name
  const lowerCollege = p.college.toLowerCase();
  for (const st of ALL_INDIAN_STATES_AND_UTS) {
    if (st !== "All India" && lowerCollege.includes(st.toLowerCase())) {
      return st;
    }
  }

  return null;
}

/** Compare one student profile against one scholarship's structured criteria. */
export function matchScholarship(s: Scholarship, p: MatchProfile): Match {
  const checks: Check[] = [];
  const missing = (label: string, what: string) =>
    checks.push({ label, value: "Not provided", status: "missing", reason: `Add your ${what} to check this condition` });

  // 1. Gender check
  if (s.eligible_gender === "Female") {
    const g = effectiveGender(p);
    if (!g) missing("Gender", "gender (or allow it for matching)");
    else
      checks.push({
        label: "Gender",
        value: g,
        status: g === "Female" ? "pass" : "fail",
        reason: g === "Female" ? "This scholarship is for women students" : "This scholarship is only for women students",
      });
  }

  // 2. State eligibility check
  if (s.eligible_states && s.eligible_states.length > 0 && !s.eligible_states.includes("All India")) {
    const studentState = getStudentState(p);
    if (!studentState) {
      missing("State Domicile", "college or state of residence");
    } else {
      const stateMatch = s.eligible_states.some((st) => st.toLowerCase() === studentState.toLowerCase());
      checks.push({
        label: "State Domicile",
        value: studentState,
        status: stateMatch ? "pass" : "fail",
        reason: stateMatch
          ? `Open to students from ${s.eligible_states.join(", ")}`
          : `Open only to residents of ${s.eligible_states.join(", ")} (Your state: ${studentState})`,
      });
    }
  }

  // 3. Study level check
  if (s.study_levels.length) {
    if (!p.study_level) missing("Study level", "study level");
    else {
      const ok = s.study_levels.includes(p.study_level);
      checks.push({
        label: "Study level",
        value: p.study_level,
        status: ok ? "pass" : "fail",
        reason: ok ? `Open to ${s.study_levels.join(", ")}` : `Only for ${s.study_levels.join(", ")}`,
      });
    }
  }

  // 4. Course stream check (normalizes degree + branch into canonical streams)
  if (s.course_streams.length) {
    const rawBranch = p.course_stream?.trim() ?? "";
    const rawDegree = p.course?.trim() ?? "";
    if (!rawBranch && !rawDegree) {
      missing("Course stream", "degree or course stream");
    } else {
      const studentStreams = normalizeCourseStreams(rawDegree, rawBranch);
      const allowedStreams = new Set(
        s.course_streams.flatMap((cs) => normalizeCourseStreams(null, cs))
      );
      const matchedStream = studentStreams.find((st) => allowedStreams.has(st));
      const ok = Boolean(matchedStream);
      const displayValue =
        (rawBranch && rawBranch.toLowerCase() !== "other" ? rawBranch : "") ||
        (rawDegree && rawDegree.toLowerCase() !== "other" ? rawDegree : "") ||
        rawBranch ||
        rawDegree;
      const isExact = s.course_streams.some(
        (cs) => cs.toLowerCase() === displayValue.toLowerCase()
      );
      checks.push({
        label: "Course",
        value: displayValue,
        status: ok ? "pass" : "fail",
        reason: ok
          ? isExact || matchedStream === displayValue
            ? "Your course stream is covered"
            : `Matched as ${matchedStream} (eligible: ${s.course_streams.join(", ")})`
          : `Only for ${s.course_streams.join(", ")}`,
      });
    }
  }

  // 5. Eligible year of study check
  if (s.eligible_years.length) {
    if (!p.year_of_study) missing("Year of study", "year of study");
    else {
      const ok = s.eligible_years.includes(p.year_of_study);
      checks.push({
        label: "Year of study",
        value: `Year ${p.year_of_study}`,
        status: ok ? "pass" : "fail",
        reason: ok ? "Your current year is accepted" : `Only for year ${s.eligible_years.join(" or ")} students`,
      });
    }
  }

  // 6. Family income check
  if (s.max_income != null) {
    if (p.family_income == null) missing("Family income", "annual family income");
    else {
      const ok = p.family_income <= s.max_income;
      checks.push({
        label: "Family income",
        value: formatMoney(p.family_income),
        status: ok ? "pass" : "fail",
        reason: ok
          ? `Within the ${formatMoney(s.max_income)} limit`
          : `Income ${formatMoney(p.family_income)} exceeds the ${formatMoney(s.max_income)} ceiling`,
      });
    }
  }

  // 7. Academic percentage check
  if (s.min_percentage != null) {
    if (p.academic_percentage == null) missing("Academic marks", "academic percentage");
    else {
      const ok = p.academic_percentage >= s.min_percentage;
      checks.push({
        label: "Academic marks",
        value: `${p.academic_percentage}%`,
        status: ok ? "pass" : "fail",
        reason: `${ok ? "Meets" : "Below"} the ${s.min_percentage}% minimum requirement${
          s.percentage_basis ? ` (${s.percentage_basis})` : ""
        }`,
      });
    }
  }

  // 8. Social Category check
  if (s.eligible_categories.length) {
    if (!p.category) missing("Category", "caste / social category");
    else {
      const ok =
        s.eligible_categories.includes(p.category) ||
        (s.eligible_categories.includes("OBC") && (p.category === "OBC" || p.category === "BC" || p.category === "EBC")) ||
        (s.eligible_categories.includes("EWS") && p.category === "EWS");
      checks.push({
        label: "Category",
        value: p.category,
        status: ok ? "pass" : "fail",
        reason: ok ? `Your category (${p.category}) is covered` : `Only for ${s.eligible_categories.join(", ")} students`,
      });
    }
  }

  // 9. Attendance check (e.g. AP Jagananna Vidya Deevena & Vasathi Deevena require >= 75% biometric attendance)
  const requiresAttendance =
    s.id === "SCH-021" ||
    s.id === "SCH-022" ||
    s.other_conditions.some((c) => c.toLowerCase().includes("75%") && c.toLowerCase().includes("attendance"));

  if (requiresAttendance) {
    if (p.attendance == null) {
      missing("Attendance", "current attendance percentage");
    } else {
      const ok = p.attendance >= 75;
      checks.push({
        label: "Attendance",
        value: `${p.attendance}%`,
        status: ok ? "pass" : "fail",
        reason: ok
          ? `Meets the minimum 75% attendance rule (${p.attendance}%)`
          : `Requires minimum 75% attendance (Your attendance: ${p.attendance}%)`,
      });
    }
  }

  const verdict: Verdict = checks.some((c) => c.status === "fail")
    ? "Not Eligible"
    : checks.some((c) => c.status === "missing")
    ? "Additional Information Required"
    : "Eligible";

  return { verdict, checks, manualChecks: s.other_conditions };
}

/** Women-only scholarships are not shown as opportunities to students who said they are male. */
export function isVisibleTo(s: Scholarship, p: MatchProfile) {
  return !(s.eligible_gender === "Female" && effectiveGender(p) === "Male");
}

/** Find alternative scholarships the student IS eligible for */
export function getAlternativeRecommendations(
  scholarships: Scholarship[],
  profile: MatchProfile,
  currentScholarshipId?: string,
  limit = 3
): Scholarship[] {
  const eligibleAlternatives = scholarships.filter((s) => {
    if (!s.is_active || s.id === currentScholarshipId) return false;
    if (!isVisibleTo(s, profile)) return false;
    const m = matchScholarship(s, profile);
    return m.verdict === "Eligible";
  });

  // Sort by closing date (urgency first) and amount
  eligibleAlternatives.sort((a, b) => {
    if (a.closing_date && b.closing_date) {
      return a.closing_date.localeCompare(b.closing_date);
    }
    return (b.amount || "").localeCompare(a.amount || "");
  });

  return eligibleAlternatives.slice(0, limit);
}

export type CategorizedScholarships = {
  eligible: Scholarship[];
  notEligible: Array<{
    scholarship: Scholarship;
    match: Match;
    failedChecks: Check[];
    recommendations: Scholarship[];
  }>;
  otherOpportunities: Array<{
    scholarship: Scholarship;
    match: Match;
    missingChecks: Check[];
  }>;
};

/** Categorize all scholarships into 3 distinct sections */
export function categorizeScholarships(
  scholarships: Scholarship[],
  profile: MatchProfile
): CategorizedScholarships {
  const visible = scholarships.filter((s) => s.is_active && isVisibleTo(s, profile));

  const eligible: Scholarship[] = [];
  const notEligible: CategorizedScholarships["notEligible"] = [];
  const otherOpportunities: CategorizedScholarships["otherOpportunities"] = [];

  for (const s of visible) {
    const match = matchScholarship(s, profile);
    if (match.verdict === "Eligible") {
      eligible.push(s);
    } else if (match.verdict === "Not Eligible") {
      const failedChecks = match.checks.filter((c) => c.status === "fail");
      const recommendations = getAlternativeRecommendations(scholarships, profile, s.id, 2);
      notEligible.push({ scholarship: s, match, failedChecks, recommendations });
    } else {
      const missingChecks = match.checks.filter((c) => c.status === "missing");
      otherOpportunities.push({ scholarship: s, match, missingChecks });
    }
  }

  return { eligible, notEligible, otherOpportunities };
}

export async function sha256(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
