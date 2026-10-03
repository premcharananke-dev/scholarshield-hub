// Scholarship eligibility matching. All rule logic lives here so it is easy to explain and change.
// Results are an indication only — the scholarship provider makes the final decision.
import type { Scholarship, MatchProfile } from "./types";

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

/** Compare one student profile against one scholarship's structured criteria. */
export function matchScholarship(s: Scholarship, p: MatchProfile): Match {
  const checks: Check[] = [];
  const missing = (label: string, what: string) => checks.push({ label, value: "Not provided", status: "missing", reason: `Add your ${what} to check this condition` });

  if (s.eligible_gender === "Female") {
    const g = effectiveGender(p);
    if (!g) missing("Gender", "gender (or allow it for matching)");
    else checks.push({ label: "Gender", value: g, status: g === "Female" ? "pass" : "fail", reason: g === "Female" ? "This scholarship is for women students" : "This scholarship is only for women students" });
  }
  if (s.study_levels.length) {
    if (!p.study_level) missing("Study level", "study level");
    else { const ok = s.study_levels.includes(p.study_level); checks.push({ label: "Study level", value: p.study_level, status: ok ? "pass" : "fail", reason: ok ? `Open to ${s.study_levels.join(", ")}` : `Only for ${s.study_levels.join(", ")}` }); }
  }
  if (s.course_streams.length) {
    if (!p.course_stream) missing("Course stream", "course stream");
    else { const ok = s.course_streams.includes(p.course_stream); checks.push({ label: "Course", value: p.course_stream, status: ok ? "pass" : "fail", reason: ok ? "Your course stream is covered" : `Only for ${s.course_streams.join(", ")}` }); }
  }
  if (s.eligible_years.length) {
    if (!p.year_of_study) missing("Year of study", "year of study");
    else { const ok = s.eligible_years.includes(p.year_of_study); checks.push({ label: "Year of study", value: `Year ${p.year_of_study}`, status: ok ? "pass" : "fail", reason: ok ? "Your current year is accepted" : `Only for year ${s.eligible_years.join(" or ")} students` }); }
  }
  if (s.max_income != null) {
    if (p.family_income == null) missing("Family income", "annual family income");
    else { const ok = p.family_income <= s.max_income; checks.push({ label: "Family income", value: formatMoney(p.family_income), status: ok ? "pass" : "fail", reason: ok ? `Within the ${formatMoney(s.max_income)} limit` : `Above the ${formatMoney(s.max_income)} limit` }); }
  }
  if (s.min_percentage != null) {
    if (p.academic_percentage == null) missing("Academic marks", "academic percentage");
    else { const ok = p.academic_percentage >= s.min_percentage; checks.push({ label: "Academic marks", value: `${p.academic_percentage}%`, status: ok ? "pass" : "fail", reason: `${ok ? "Meets" : "Below"} the ${s.min_percentage}% minimum${s.percentage_basis ? ` (${s.percentage_basis})` : ""}` }); }
  }
  if (s.eligible_categories.length) {
    if (!p.category) missing("Category", "category");
    else { const ok = s.eligible_categories.includes(p.category); checks.push({ label: "Category", value: p.category, status: ok ? "pass" : "fail", reason: ok ? "Your category is covered" : `Only for ${s.eligible_categories.join(", ")} students` }); }
  }

  const verdict: Verdict = checks.some((c) => c.status === "fail") ? "Not Eligible"
    : checks.some((c) => c.status === "missing") ? "Additional Information Required" : "Eligible";
  return { verdict, checks, manualChecks: s.other_conditions };
}

/** Women-only scholarships are not shown as opportunities to students who said they are male. */
export function isVisibleTo(s: Scholarship, p: MatchProfile) {
  return !(s.eligible_gender === "Female" && effectiveGender(p) === "Male");
}

export async function sha256(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
