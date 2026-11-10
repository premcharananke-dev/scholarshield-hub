// Shared app types that mirror the database tables and provide extended attributes.
export type Role = "student" | "admin";
export type Status =
  | "SUBMITTED"
  | "ELIGIBILITY VERIFIED"
  | "NOT ELIGIBLE"
  | "UNDER REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "DISBURSEMENT PENDING"
  | "DISBURSED";

export const CATEGORIES = ["General", "OBC", "SC", "ST", "EWS", "Minority", "PwD"] as const;
export const GENDERS = ["Female", "Male", "Other", "Prefer not to say"] as const;
export const STUDY_LEVELS = ["Diploma", "Undergraduate", "Postgraduate", "Doctorate"] as const;
export const STREAMS = [
  "Engineering",
  "Medical",
  "Science",
  "Commerce",
  "Arts",
  "Law",
  "Pharmacy",
  "Nursing",
  "Design",
  "Architecture",
  "Management",
  "Computer Applications",
  "Other",
] as const;

export const SCHEME_CATEGORIES = [
  "Central Government",
  "State Government",
  "AICTE",
  "UGC",
  "Corporate / Private",
  "Special Category",
] as const;
export type ScholarshipCategory = (typeof SCHEME_CATEGORIES)[number];

export const APPLICATION_STATUSES = ["Open", "Closed", "Upcoming", "Not Announced"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const VERIFICATION_STATUSES = ["Verified", "Needs Verification"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const TAGS = [
  "Merit-Based",
  "Need-Based",
  "Category-Based",
  "Women-Specific",
  "Special Category",
] as const;

export type Profile = {
  id: string;
  full_name: string;
  student_id: string | null;
  email: string;
  phone: string | null;
  college: string | null;
  department: string | null;
  course: string | null;
  course_stream: string | null;
  study_level: string | null;
  year_of_study: number | null;
  gender: string | null;
  use_gender_for_matching: boolean;
  academic_percentage: number | null;
  family_income: number | null;
  category: string | null;
  state?: string | null;
  attendance?: number | null;
};

export type MatchProfile = Pick<
  Profile,
  | "gender"
  | "use_gender_for_matching"
  | "course_stream"
  | "study_level"
  | "year_of_study"
  | "academic_percentage"
  | "family_income"
  | "category"
> & {
  college?: string | null;
  state?: string | null;
  attendance?: number | null;
};

export type Scholarship = {
  id: string;
  name: string;
  provider: string;
  provider_type: "Government" | "Private";
  description: string;
  tags: string[];
  eligible_gender: "Any" | "Female";
  study_levels: string[];
  course_streams: string[];
  eligible_years: number[];
  max_income: number | null;
  min_percentage: number | null;
  percentage_basis: string | null;
  eligible_categories: string[];
  amount: string;
  benefits: string | null;
  documents: string[];
  other_conditions: string[];
  opening_date: string | null;
  closing_date: string | null;
  academic_year: string | null;
  application_url: string | null;
  source_url: string | null;
  unverified_fields: string[];
  verification_note: string | null;
  is_active: boolean;

  // Standardized 20-attribute discovery extensions
  eligible_states?: string[];
  eligible_courses?: string[];
  scheme_category?: ScholarshipCategory;
  application_status?: ApplicationStatus;
  verification_status?: VerificationStatus;
  last_verified_date?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type RuleResult = {
  label: string;
  value: string;
  status: "pass" | "fail" | "missing";
  reason: string;
};

export type History = {
  id: string;
  status: Status;
  note: string;
  created_at: string;
};

export type Disbursement = {
  id: string;
  amount: number;
  status: "PENDING" | "COMPLETED";
  payment_reference: string | null;
  payment_date: string | null;
};

export type Doc = {
  id: string;
  document_name: string;
  provided: boolean;
  verified: boolean;
};

export type Application = {
  id: string;
  user_id: string | null;
  scholarship_id: string | null;
  scholarship_name: string;
  full_name: string;
  student_id: string;
  email: string;
  phone: string;
  college: string;
  course: string;
  course_stream: string | null;
  study_level: string | null;
  department: string | null;
  year_of_study: number | null;
  academic_year: string;
  academic_percentage: number;
  attendance: number;
  family_income: number;
  category: string;
  gender: string | null;
  status: Status;
  eligible: boolean;
  rules: RuleResult[];
  fingerprint: string;
  is_duplicate: boolean;
  is_demo: boolean;
  submitted_at: string;
  application_history?: History[];
  disbursements?: Disbursement[] | Disbursement | null;
  application_documents?: Doc[];
};
