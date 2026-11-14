// Student-facing Scholarship Discovery & Recommendation System
// Problem Statement No. 58: Scholarship Eligibility & Disbursement System (ScholarShield)
// Comprehensive India-wide directory across Central Govt, State Govt, AICTE, UGC, Corporate, and Special Categories.

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  ExternalLink,
  FileText,
  Filter,
  HelpCircle,
  Info,
  Lock,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  isVisibleTo,
  matchScholarship,
  normalizeCourseStreams,
  effectiveGender,
  getStudentState,
  categorizeScholarships,
  getAlternativeRecommendations,
  type Match,
} from "@/lib/eligibility";
import type { MatchProfile, Scholarship, ScholarshipCategory, STREAMS } from "@/lib/types";
import {
  ALL_INDIAN_STATES_AND_UTS,
  computeApplicationStatus,
  computeVerificationStatus,
  enrichScholarship,
  checkRenewalEligibility,
} from "@/data/scholarships";
import { Button, Card, Chip, Disclaimer, EmptyState, PageTitle, VerdictBadge, prettyDate } from "./ui-kit";

export function deadlineLabel(s: Scholarship) {
  if (s.closing_date) {
    const today = new Date().toISOString().slice(0, 10);
    return s.closing_date < today
      ? `Closed ${prettyDate(s.closing_date)}`
      : `Closes ${prettyDate(s.closing_date)}`;
  }
  return "Deadline not announced";
}

export function isClosed(s: Scholarship) {
  const status = s.application_status ?? computeApplicationStatus(s);
  return status === "Closed";
}

function summary(s: Scholarship) {
  const parts: string[] = [];
  if (s.eligible_gender === "Female") parts.push("Girls Only");
  if (s.eligible_states && s.eligible_states.length > 0 && !s.eligible_states.includes("All India")) {
    parts.push(`State: ${s.eligible_states.join(", ")}`);
  }
  if (s.study_levels.length) parts.push(s.study_levels.join("/"));
  if (s.max_income != null) parts.push(`Income ≤ ₹${(s.max_income / 100000).toLocaleString("en-IN")} lakh`);
  if (s.min_percentage != null) parts.push(`${s.min_percentage}%+ marks`);
  if (s.eligible_categories.length) parts.push(s.eligible_categories.join("/"));
  return parts.join(" · ") || "See conditions";
}

export function MatchPanel({ match }: { match: Match }) {
  return (
    <div className="space-y-2">
      {match.checks.map((c) => (
        <div
          key={c.label}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg bg-muted/60 p-3"
        >
          <span
            className={`mt-0.5 grid h-6 w-6 place-items-center rounded-full ${
              c.status === "pass"
                ? "bg-success-soft text-success"
                : c.status === "fail"
                ? "bg-danger-soft text-danger"
                : "bg-warning-soft text-warning"
            }`}
          >
            {c.status === "pass" ? <Check size={14} /> : c.status === "fail" ? <X size={14} /> : <HelpCircle size={14} />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold">{c.label}</p>
            <p className="text-xs text-muted-foreground">{c.reason}</p>
          </div>
          <p className="text-right text-xs font-bold">{c.value}</p>
        </div>
      ))}
      {match.checks.length === 0 && (
        <p className="text-sm text-muted-foreground">No profile-based conditions are recorded for this scholarship.</p>
      )}
      {match.manualChecks.length > 0 && (
        <div className="rounded-lg border border-dashed p-3">
          <p className="text-xs font-extrabold uppercase text-muted-foreground">Also confirm yourself</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {match.manualChecks.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type CardProps = {
  s: Scholarship;
  profile: MatchProfile;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
  onApply?: (() => void) | undefined;
  alreadyApplied?: boolean | undefined;
  highlight?: boolean | undefined;
};

export function ScholarshipCard({
  s,
  profile,
  saved,
  onSave,
  onOpen,
  onApply,
  alreadyApplied = false,
  highlight = false,
}: CardProps) {
  const [showCheck, setShowCheck] = useState(false);
  const match = useMemo(() => matchScholarship(s, profile), [s, profile]);
  const status = s.application_status ?? computeApplicationStatus(s);
  const verification = s.verification_status ?? computeVerificationStatus(s);

  return (
    <Card className={`flex flex-col p-5 ${highlight ? "border-pink-500/30 dark:border-pink-500/20" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-extrabold text-accent-foreground">
              {s.provider_type.toUpperCase()}
            </span>
            {s.scheme_category && (
              <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[10px] font-extrabold">
                {s.scheme_category}
              </span>
            )}
            {s.eligible_gender === "Female" && (
              <span className="rounded-full bg-pink-100 dark:bg-pink-950/70 px-2.5 py-1 text-[10px] font-extrabold text-pink-700 dark:text-pink-300 border border-pink-300 dark:border-pink-800 tracking-wide uppercase">
                GIRLS ONLY
              </span>
            )}
            {s.eligible_states && s.eligible_states.length > 0 && !s.eligible_states.includes("All India") && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold">
                <MapPin size={10} />
                {s.eligible_states.join(", ")}
              </span>
            )}
            {status === "Open" ? (
              <span className="rounded-full bg-success-soft text-success px-2 py-0.5 text-[10px] font-extrabold">
                OPEN
              </span>
            ) : status === "Upcoming" ? (
              <span className="rounded-full bg-info-soft text-info px-2 py-0.5 text-[10px] font-extrabold">
                UPCOMING
              </span>
            ) : (
              <span className="rounded-full bg-danger-soft text-danger px-2 py-0.5 text-[10px] font-extrabold">
                CLOSED
              </span>
            )}
          </div>
          <h3 className="mt-3 font-extrabold leading-snug line-clamp-2">{s.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground truncate">{s.provider}</p>
        </div>
        <button
          onClick={onSave}
          aria-label={saved ? "Remove from saved" : "Save for later"}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${
            saved ? "bg-accent text-primary" : "text-muted-foreground hover:text-primary"
          }`}
        >
          {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[11px] font-bold uppercase text-muted-foreground">Amount</p>
          <p className="font-extrabold text-foreground">{s.amount}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase text-muted-foreground">Deadline</p>
          <p className={`font-extrabold ${isClosed(s) ? "text-danger" : ""}`}>{deadlineLabel(s)}</p>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground line-clamp-2">{summary(s)}</p>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">Your result:</span>
          <VerdictBadge verdict={match.verdict} />
        </div>
        {verification === "Verified" ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck size={12} />
            Verified
          </span>
        ) : (
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
            Needs Verification
          </span>
        )}
      </div>

      {showCheck && (
        <div className="mt-4">
          <MatchPanel match={match} />
        </div>
      )}

      <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
        <Button variant="outline" onClick={() => setShowCheck(!showCheck)}>
          {showCheck ? "Hide Check" : "Check Eligibility"}
        </Button>
        {onApply && s.in_database !== false && !isClosed(s) && s.is_active && !alreadyApplied ? (
          <Button onClick={onApply} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
            Apply Now
            <ArrowRight size={16} />
          </Button>
        ) : (
          <Button onClick={onOpen}>
            {alreadyApplied ? "Already Applied" : "View Details"}
            <ArrowRight size={16} />
          </Button>
        )}
      </div>
    </Card>
  );
}

type ListProps = {
  scholarships: Scholarship[];
  profile: MatchProfile;
  saved: string[];
  onSave: (id: string) => void;
  onOpen: (id: string) => void;
  onApply?: ((id: string) => void) | undefined;
  appliedIds?: string[] | undefined;
};

export function WomenSection({
  scholarships,
  profile,
  saved,
  onSave,
  onOpen,
  onApply,
  appliedIds = [],
  compact = false,
}: ListProps & { compact?: boolean }) {
  const list = scholarships.filter((s) => s.is_active && s.eligible_gender === "Female");
  if (!list.length) return null;
  return (
    <section
      className="rounded-xl border border-pink-500/30 bg-gradient-to-r from-pink-500/10 via-info-soft/40 to-card p-4 sm:p-6 shadow-sm"
      aria-labelledby="women-title"
    >
      <div className="mb-4 flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-pink-600 text-white shadow-xs">
          <Sparkles size={22} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="women-title" className="text-lg font-extrabold tracking-wide text-foreground">
              WOMEN EMPOWERMENT SCHOLARSHIPS
            </h2>
            <span className="rounded-full bg-pink-100 dark:bg-pink-950/70 px-2.5 py-0.5 text-[10px] font-extrabold text-pink-700 dark:text-pink-300 border border-pink-300 dark:border-pink-800 uppercase tracking-wide">
              GIRLS ONLY
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Scholarships created to support girls and women in higher education across India.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(compact ? list.slice(0, 2) : list).map((s) => (
          <ScholarshipCard
            key={s.id}
            s={s}
            profile={profile}
            saved={saved.includes(s.id)}
            onSave={() => onSave(s.id)}
            onOpen={() => onOpen(s.id)}
            onApply={onApply ? () => onApply(s.id) : undefined}
            alreadyApplied={appliedIds.includes(s.id)}
            highlight
          />
        ))}
      </div>
    </section>
  );
}

export function ScholarshipsPage(props: ListProps) {
  const { scholarships, profile, saved, onSave, onOpen, onApply, appliedIds } = props;

  // Search & Navigation Tabs
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "eligible" | "not_eligible" | "needs_info">("all");

  // Multi-dimensional Filter States
  const [sectorFilter, setSectorFilter] = useState<string>("All");
  const [stateFilter, setStateFilter] = useState<string>("All");
  const [streamFilter, setStreamFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [savedOnly, setSavedOnly] = useState(false);

  const gender = effectiveGender(profile);
  const studentState = getStudentState(profile);

  // Categorize for 3 distinct sections
  const categorized = useMemo(() => categorizeScholarships(scholarships, profile), [scholarships, profile]);

  // Master filter pipeline
  const filteredScholarships = useMemo(() => {
    return scholarships.filter((s) => {
      if (!s.is_active) return false;
      if (!isVisibleTo(s, profile)) return false;

      // Text search in name, provider, description
      if (q) {
        const query = q.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(query);
        const matchesProvider = s.provider.toLowerCase().includes(query);
        const matchesDesc = s.description.toLowerCase().includes(query);
        const matchesId = s.id.toLowerCase().includes(query);
        if (!matchesName && !matchesProvider && !matchesDesc && !matchesId) return false;
      }

      // Tab matching
      const match = matchScholarship(s, profile);
      if (activeTab === "eligible" && match.verdict !== "Eligible") return false;
      if (activeTab === "not_eligible" && match.verdict !== "Not Eligible") return false;
      if (activeTab === "needs_info" && match.verdict !== "Additional Information Required") return false;

      // Sector / Provider Type filter
      if (sectorFilter !== "All") {
        if (sectorFilter === "Government" || sectorFilter === "Private") {
          if (s.provider_type !== sectorFilter) return false;
        } else if (s.scheme_category !== sectorFilter) {
          return false;
        }
      }

      // State filter
      if (stateFilter !== "All") {
        if (stateFilter === "All India") {
          if (s.eligible_states && s.eligible_states.length > 0 && !s.eligible_states.includes("All India")) return false;
        } else {
          const eligibleStates = s.eligible_states ?? ["All India"];
          const includesState = eligibleStates.includes("All India") || eligibleStates.includes(stateFilter);
          if (!includesState) return false;
        }
      }

      // Stream filter
      if (streamFilter !== "All") {
        if (
          s.course_streams.length > 0 &&
          !s.course_streams.some((cs) =>
            normalizeCourseStreams(null, cs).includes(streamFilter as (typeof STREAMS)[number])
          )
        ) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== "All") {
        if (s.eligible_categories.length > 0 && !s.eligible_categories.includes(categoryFilter)) return false;
      }

      // Status filter
      if (statusFilter !== "All") {
        const currentStatus = s.application_status ?? computeApplicationStatus(s);
        if (currentStatus !== statusFilter) return false;
      }

      // Saved only
      if (savedOnly && !saved.includes(s.id)) return false;

      return true;
    });
  }, [
    scholarships,
    profile,
    q,
    activeTab,
    sectorFilter,
    stateFilter,
    streamFilter,
    categoryFilter,
    statusFilter,
    savedOnly,
    saved,
  ]);

  const sectors: (ScholarshipCategory | "All" | "Government" | "Private")[] = [
    "All",
    "Central Government",
    "State Government",
    "AICTE",
    "UGC",
    "Corporate / Private",
    "Special Category",
  ];

  return (
    <div className="animate-rise space-y-6">
      <PageTitle
        title="Scholarship Discovery"
        subtitle={`Discover 86+ verified schemes across India with real-time automatic profile matching.`}
      />

      {/* Women Section Banner if female and no search query */}
      {gender === "Female" && activeTab === "all" && !q && sectorFilter === "All" && (
        <WomenSection {...props} />
      )}

      {/* Primary 3-Section Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-3">
        <button
          onClick={() => setActiveTab("all")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-extrabold transition-colors ${
            activeTab === "all"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          All Scholarships
          <span className="rounded-full bg-background/20 px-2 py-0.5 text-xs font-bold">
            {scholarships.filter((s) => s.is_active && isVisibleTo(s, profile)).length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("eligible")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-extrabold transition-colors ${
            activeTab === "eligible"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
          }`}
        >
          <CheckCircle2 size={16} />
          Eligible for You
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
            {categorized.eligible.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("not_eligible")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-extrabold transition-colors ${
            activeTab === "not_eligible"
              ? "bg-rose-600 text-white shadow-xs"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100"
          }`}
        >
          <XCircle size={16} />
          Not Eligible
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
            {categorized.notEligible.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("needs_info")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-extrabold transition-colors ${
            activeTab === "needs_info"
              ? "bg-amber-600 text-white shadow-xs"
              : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100"
          }`}
        >
          <HelpCircle size={16} />
          Needs Information
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
            {categorized.otherOpportunities.length}
          </span>
        </button>
      </div>

      {/* Search & Multi-Filter Control Box */}
      <Card className="p-4 space-y-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 text-muted-foreground" size={18} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by scholarship name, provider, or keyword..."
              aria-label="Search scholarships"
              className="h-11 w-full rounded-lg border bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <Button
            variant={savedOnly ? "primary" : "outline"}
            onClick={() => setSavedOnly(!savedOnly)}
            className="shrink-0 h-11"
          >
            {savedOnly ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            {savedOnly ? "Showing Saved" : `Saved (${saved.length})`}
          </Button>
        </div>

        {/* Multi-Dimensional Filter Dropdowns */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 text-xs">
          {/* Sector Filter */}
          <div>
            <label className="block font-bold text-muted-foreground mb-1">Sector / Provider</label>
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2.5 font-medium outline-none focus:ring-2 focus:ring-ring"
            >
              {sectors.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>

          {/* State Filter */}
          <div>
            <label className="block font-bold text-muted-foreground mb-1">
              State / Domicile {studentState ? `(${studentState})` : ""}
            </label>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2.5 font-medium outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="All">All States & UTs</option>
              <option value="All India">All-India Only</option>
              <option value="Andhra Pradesh">★ Andhra Pradesh (Priority)</option>
              <option value="Telangana">Telangana</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Tamil Nadu">Tamil Nadu</option>
              <option value="Maharashtra">Maharashtra</option>
              <option value="Uttar Pradesh">Uttar Pradesh</option>
              <option value="West Bengal">West Bengal</option>
              {ALL_INDIAN_STATES_AND_UTS.filter(
                (st) =>
                  st !== "All India" &&
                  !["Andhra Pradesh", "Telangana", "Karnataka", "Tamil Nadu", "Maharashtra", "Uttar Pradesh", "West Bengal"].includes(st)
              ).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Stream Filter */}
          <div>
            <label className="block font-bold text-muted-foreground mb-1">Course Stream</label>
            <select
              value={streamFilter}
              onChange={(e) => setStreamFilter(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2.5 font-medium outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="All">All Streams</option>
              <option value="Engineering">Engineering & Technology</option>
              <option value="Medical">Medical & Dental</option>
              <option value="Science">Science</option>
              <option value="Commerce">Commerce & Accounting</option>
              <option value="Arts">Arts & Humanities</option>
              <option value="Pharmacy">Pharmacy</option>
              <option value="Law">Law</option>
              <option value="Management">Management / MBA</option>
              <option value="Nursing">Nursing</option>
            </select>
          </div>

          {/* Social Category Filter */}
          <div>
            <label className="block font-bold text-muted-foreground mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2.5 font-medium outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="All">All Categories</option>
              <option value="General">General</option>
              <option value="OBC">OBC</option>
              <option value="SC">SC</option>
              <option value="ST">ST</option>
              <option value="EWS">EWS</option>
              <option value="Minority">Minority</option>
              <option value="PwD">Persons with Disability (PwD)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block font-bold text-muted-foreground mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2.5 font-medium outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="All">All Statuses</option>
              <option value="Open">Currently Open</option>
              <option value="Upcoming">Upcoming</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>

        {/* Quick Reset Filters */}
        {(sectorFilter !== "All" || stateFilter !== "All" || streamFilter !== "All" || categoryFilter !== "All" || statusFilter !== "All" || q || savedOnly) && (
          <div className="flex items-center justify-between pt-2 border-t text-xs">
            <span className="text-muted-foreground font-medium">
              Showing {filteredScholarships.length} scholarships matching filters
            </span>
            <button
              onClick={() => {
                setSectorFilter("All");
                setStateFilter("All");
                setStreamFilter("All");
                setCategoryFilter("All");
                setStatusFilter("All");
                setQ("");
                setSavedOnly(false);
              }}
              className="text-primary font-bold hover:underline"
            >
              Reset all filters
            </button>
          </div>
        )}
      </Card>

      {/* Tab Specific Content: "Not Eligible" with Alternative Recommendations */}
      {activeTab === "not_eligible" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20 p-4 text-xs text-rose-800 dark:text-rose-200">
            <p className="font-bold">Why these scholarships are not eligible for your profile:</p>
            <p className="mt-1 text-muted-foreground">
              Each card below clearly highlights the specific criteria not met (e.g. state domicile, income ceiling, or course stream) and recommends alternative scholarships you qualify for!
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {categorized.notEligible
              .filter((item) => filteredScholarships.some((s) => s.id === item.scholarship.id))
              .map(({ scholarship: s, failedChecks, recommendations }) => (
                <Card key={s.id} className="p-5 flex flex-col justify-between border-rose-200 dark:border-rose-950">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 px-2 py-0.5 text-[10px] font-extrabold uppercase">
                          Not Eligible
                        </span>
                        <h3 className="mt-2 font-extrabold text-base leading-snug">{s.name}</h3>
                        <p className="text-xs text-muted-foreground">{s.provider}</p>
                      </div>
                      <span className="font-extrabold text-sm">{s.amount}</span>
                    </div>

                    {/* Unmet conditions callout */}
                    <div className="mt-3 rounded-lg bg-rose-100/70 dark:bg-rose-950/40 p-3 space-y-1.5">
                      <p className="text-[11px] font-extrabold uppercase text-rose-800 dark:text-rose-300">
                        Unmet Criteria:
                      </p>
                      {failedChecks.map((fc) => (
                        <div key={fc.label} className="flex items-start gap-1.5 text-xs text-rose-700 dark:text-rose-300">
                          <X size={14} className="mt-0.5 shrink-0" />
                          <span>
                            <b>{fc.label}:</b> {fc.reason}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Alternative Recommendations */}
                    {recommendations.length > 0 && (
                      <div className="mt-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-3">
                        <p className="text-[11px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                          <Sparkles size={12} />
                          Recommended Alternatives You Qualify For:
                        </p>
                        <div className="mt-2 space-y-1.5">
                          {recommendations.map((alt) => (
                            <button
                              key={alt.id}
                              onClick={() => onOpen(alt.id)}
                              className="w-full text-left flex items-center justify-between text-xs font-bold text-emerald-900 dark:text-emerald-200 hover:underline"
                            >
                              <span className="truncate mr-2">• {alt.name}</span>
                              <span className="shrink-0 text-emerald-600 dark:text-emerald-400">{alt.amount}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t flex justify-end">
                    <Button variant="outline" onClick={() => onOpen(s.id)}>
                      View Scheme Guidelines
                      <ArrowRight size={14} />
                    </Button>
                  </div>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* Grid of Scholarships for All / Eligible / Needs Info */}
      {activeTab !== "not_eligible" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredScholarships.map((s) => (
            <ScholarshipCard
              key={s.id}
              s={s}
              profile={profile}
              saved={saved.includes(s.id)}
              onSave={() => onSave(s.id)}
              onOpen={() => onOpen(s.id)}
              onApply={onApply ? () => onApply(s.id) : undefined}
              alreadyApplied={appliedIds?.includes(s.id)}
            />
          ))}
        </div>
      )}

      {filteredScholarships.length === 0 && (
        <EmptyState
          title="No scholarships found"
          text={
            savedOnly
              ? "You haven't saved any scholarships matching these filters."
              : "Try adjusting your search keywords, sector, or state filters."
          }
        />
      )}

      <Disclaimer />
    </div>
  );
}

type DetailsProps = {
  s: Scholarship;
  profile: MatchProfile;
  saved: boolean;
  onSave: () => void;
  onApply: () => void;
  back: () => void;
  alreadyApplied: boolean;
  scholarships?: Scholarship[];
  onSelectAlternative?: (id: string) => void;
  onRecordExternal?: (refNumber: string) => void;
};

export function ScholarshipDetails({
  s,
  profile,
  saved,
  onSave,
  onApply,
  back,
  alreadyApplied,
  scholarships,
  onSelectAlternative,
  onRecordExternal,
}: DetailsProps) {
  const details = useMemo(() => enrichScholarship(s), [s]);
  const match = useMemo(() => matchScholarship(details, profile), [details, profile]);
  const renewal = useMemo(() => checkRenewalEligibility(details, profile), [details, profile]);
  const closed = isClosed(details);
  const status = details.application_status ?? computeApplicationStatus(details);
  const verification = details.verification_status ?? computeVerificationStatus(details);
  const alternatives = useMemo(
    () => getAlternativeRecommendations(scholarships ?? [], profile, details.id, 3),
    [scholarships, profile, details.id]
  );

  const [activeTab, setActiveTab] = useState<"overview" | "eligibility" | "documents" | "guidelines" | "renewal">("overview");
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [externalRefInput, setExternalRefInput] = useState("");
  const [recordSuccessMsg, setRecordSuccessMsg] = useState<string | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const handleRecordExternal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!externalRefInput.trim()) return;
    if (onRecordExternal) {
      onRecordExternal(externalRefInput.trim());
    }
    setRecordSuccessMsg(`External Application ID "${externalRefInput.trim()}" successfully registered for timeline tracking.`);
    setTimeout(() => {
      setShowRecordModal(false);
      setRecordSuccessMsg(null);
    }, 2000);
  };

  return (
    <div className="animate-rise space-y-6">
      <button
        onClick={back}
        className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer"
      >
        <ArrowLeft size={17} />
        Back to scholarships
      </button>

      {/* Header Banner */}
      <Card className="overflow-hidden shadow-sm">
        <div
          className={`border-b p-5 sm:p-6 ${
            details.eligible_gender === "Female"
              ? "bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-card"
              : "bg-accent/40"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-primary">
            <span>{details.id}</span>
            <span>·</span>
            <span>{details.provider_type.toUpperCase()}</span>
            {details.scheme_category && (
              <>
                <span>·</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary border border-primary/20">
                  {details.scheme_category}
                </span>
              </>
            )}
            {details.academic_year && (
              <>
                <span>·</span>
                <span>AY {details.academic_year}</span>
              </>
            )}
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
              {verification}
            </span>
          </div>

          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {details.name}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span><b>Provider:</b> {details.provider}</span>
            <span>•</span>
            <span><b>Funding Authority:</b> {details.funding_authority || "Contact official provider"}</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 items-center">
            {details.eligible_gender === "Female" && (
              <span className="rounded-full bg-pink-100 dark:bg-pink-950/70 px-2.5 py-1 text-[11px] font-extrabold text-pink-700 dark:text-pink-300 border border-pink-300 dark:border-pink-800 tracking-wide uppercase">
                GIRLS ONLY
              </span>
            )}
            {details.eligible_states && details.eligible_states.length > 0 && (
              <span className="rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 px-2.5 py-1 text-[11px] font-bold flex items-center gap-1">
                <MapPin size={12} />
                {details.eligible_states.join(", ")}
              </span>
            )}
            <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 text-[11px] font-bold">
              {details.tuition_coverage || "Financial Assistance"}
            </span>
            {details.tags.map((t) => (
              <span key={t} className="rounded-full bg-card px-2.5 py-1 text-[11px] font-bold border text-muted-foreground">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* 5-Column Quick Highlights Metric Bar */}
        <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-5 sm:p-6 border-b bg-card text-card-foreground">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Scholarship Amount</p>
            <p className="mt-1 font-extrabold text-base text-foreground">{details.amount || "Not specified"}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Payment Frequency</p>
            <p className="mt-1 font-extrabold text-base text-foreground">{details.payment_frequency || "Annual"}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Tuition Fee Coverage</p>
            <p className="mt-1 font-extrabold text-sm text-foreground">{details.tuition_coverage || "Partial Tuition"}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Application Status</p>
            <p className="mt-1">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold inline-block ${
                  status === "Open"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                    : status === "Upcoming"
                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                    : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                }`}
              >
                {status.toUpperCase()}
              </span>
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Application Deadline</p>
            <p className={`mt-1 font-extrabold text-sm ${closed ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>
              {details.closing_date ? prettyDate(details.closing_date) : "Not specified"}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b overflow-x-auto px-4 bg-muted/20">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-3 text-sm font-extrabold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "overview"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Overview & Financial Benefits
          </button>
          <button
            onClick={() => setActiveTab("eligibility")}
            className={`px-4 py-3 text-sm font-extrabold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "eligibility"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Eligibility Requirements
            <span
              className={`h-2 w-2 rounded-full ${
                match.verdict === "Eligible"
                  ? "bg-emerald-500"
                  : match.verdict === "Not Eligible"
                  ? "bg-rose-500"
                  : "bg-amber-500"
              }`}
            />
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`px-4 py-3 text-sm font-extrabold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "documents"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Required Documents
            <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground font-bold">
              {details.documents.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("guidelines")}
            className={`px-4 py-3 text-sm font-extrabold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "guidelines"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Application Guidelines & Timeline
          </button>
          <button
            onClick={() => setActiveTab("renewal")}
            className={`px-4 py-3 text-sm font-extrabold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "renewal"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Renewal Management
            {details.is_renewable && (
              <span className="rounded-full bg-emerald-500/10 text-emerald-600 px-1.5 py-0.2 text-[10px] font-bold border border-emerald-500/20">
                Annual
              </span>
            )}
          </button>
        </div>
      </Card>

      {/* Main Content Layout: Tab Body (Left) + Actions & Verification (Right) */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* TAB 1: OVERVIEW & FINANCIAL BENEFITS */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Financial Details Card */}
            <Card className="p-5 sm:p-6 space-y-5">
              <div className="flex items-center gap-2 border-b pb-3">
                <DollarSign className="text-primary" size={20} />
                <h2 className="text-lg font-extrabold text-foreground">Scholarship Amount & Financial Benefits</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/30 p-3.5">
                  <p className="text-xs font-bold text-muted-foreground">Exact Scholarship Grant</p>
                  <p className="mt-1 text-base font-extrabold text-foreground">{details.amount || "Not specified"}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3.5">
                  <p className="text-xs font-bold text-muted-foreground">Payment Frequency</p>
                  <p className="mt-1 text-base font-extrabold text-foreground">{details.payment_frequency || "Annual"}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3.5">
                  <p className="text-xs font-bold text-muted-foreground">Tuition Fee Coverage</p>
                  <p className="mt-1 text-base font-extrabold text-foreground">{details.tuition_coverage || "Partial Tuition Fee"}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3.5">
                  <p className="text-xs font-bold text-muted-foreground">Total Estimated Assistance</p>
                  <p className="mt-1 text-base font-extrabold text-foreground">{details.total_financial_assistance || "Contact official provider"}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3.5">
                  <p className="text-xs font-bold text-muted-foreground">Disbursement Method</p>
                  <p className="mt-1 text-sm font-extrabold text-foreground">{details.payment_method || "Direct Benefit Transfer (DBT)"}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3.5">
                  <p className="text-xs font-bold text-muted-foreground">Disbursing Authority</p>
                  <p className="mt-1 text-sm font-extrabold text-foreground">{details.disbursement_authority || "Contact official provider"}</p>
                </div>
              </div>

              {/* Additional Financial Benefits */}
              {details.additional_benefits && details.additional_benefits.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    Included Financial Allowances & Subsidies
                  </p>
                  <div className="grid gap-2 sm:grid-cols-1">
                    {details.additional_benefits.map((benefit, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-foreground bg-accent/30 rounded-md p-2.5 border">
                        <Check className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" size={16} />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Duration of Scholarship */}
            <Card className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 border-b pb-3">
                <Clock className="text-primary" size={20} />
                <h2 className="text-lg font-extrabold text-foreground">Duration of Scholarship & Course Coverage</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/30 p-3.5">
                  <p className="text-xs font-bold text-muted-foreground">Assistance Duration</p>
                  <p className="mt-1 text-sm font-extrabold text-foreground">{details.duration || "Entire Regular Course Duration"}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3.5">
                  <p className="text-xs font-bold text-muted-foreground">Course Coverage Scope</p>
                  <p className="mt-1 text-sm font-extrabold text-foreground">{details.course_duration_coverage || "Covers full degree until graduation"}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3.5">
                  <p className="text-xs font-bold text-muted-foreground">Renewal Availability</p>
                  <p className="mt-1 text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                    {details.is_renewable ? `Yes — Renewable ${details.renewal_frequency ?? "Annually"}` : "One-Time Assistance"}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3.5">
                  <p className="text-xs font-bold text-muted-foreground">Target Academic Levels</p>
                  <p className="mt-1 text-sm font-extrabold text-foreground">
                    {details.study_levels.length ? details.study_levels.join(", ") : "All approved degrees"}
                  </p>
                </div>
              </div>
            </Card>

            {/* Scheme Description & Detailed Coverage */}
            <Card className="p-5 sm:p-6 space-y-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Scheme Overview</p>
                <p className="mt-2 text-sm leading-relaxed text-foreground">{details.description}</p>
              </div>
              {details.benefits && (
                <div className="rounded-lg bg-muted/40 p-4 border text-sm leading-relaxed">
                  <b className="text-foreground">Official Benefit Notification:</b> {details.benefits}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 2: ELIGIBILITY REQUIREMENTS */}
        {activeTab === "eligibility" && (
          <div className="space-y-6">
            {/* Official Eligibility Requirements Checklist */}
            <Card className="p-5 sm:p-6 space-y-5">
              <div className="flex items-center gap-2 border-b pb-3">
                <Award className="text-primary" size={20} />
                <h2 className="text-lg font-extrabold text-foreground">Official Eligibility Conditions</h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div className="p-3 rounded-lg border bg-muted/20">
                  <span className="text-xs font-bold text-muted-foreground block">Study Level</span>
                  <span className="font-extrabold text-foreground">{details.study_levels.join(", ") || "All accredited degrees"}</span>
                </div>
                <div className="p-3 rounded-lg border bg-muted/20">
                  <span className="text-xs font-bold text-muted-foreground block">Eligible Streams</span>
                  <span className="font-extrabold text-foreground">{details.course_streams.join(", ") || "All academic streams"}</span>
                </div>
                <div className="p-3 rounded-lg border bg-muted/20">
                  <span className="text-xs font-bold text-muted-foreground block">Minimum Percentage / CGPA</span>
                  <span className="font-extrabold text-foreground">{details.min_percentage ? `${details.min_percentage}% marks` : "No minimum cutoff specified"}</span>
                </div>
                <div className="p-3 rounded-lg border bg-muted/20">
                  <span className="text-xs font-bold text-muted-foreground block">Family Income Limit</span>
                  <span className="font-extrabold text-foreground">{details.max_income ? `Up to ₹${details.max_income.toLocaleString("en-IN")}/year` : "No income ceiling specified"}</span>
                </div>
                <div className="p-3 rounded-lg border bg-muted/20">
                  <span className="text-xs font-bold text-muted-foreground block">Eligible Categories</span>
                  <span className="font-extrabold text-foreground">{details.eligible_categories.join(", ") || "Open to all categories"}</span>
                </div>
                <div className="p-3 rounded-lg border bg-muted/20">
                  <span className="text-xs font-bold text-muted-foreground block">Gender Eligibility</span>
                  <span className="font-extrabold text-foreground">{details.eligible_gender === "Female" ? "Girls / Female students only" : "All Genders"}</span>
                </div>
                <div className="p-3 rounded-lg border bg-muted/20 sm:col-span-2">
                  <span className="text-xs font-bold text-muted-foreground block">Domicile / Eligible States</span>
                  <span className="font-extrabold text-foreground">{details.eligible_states?.join(", ") || "All India"}</span>
                </div>
              </div>

              {details.other_conditions && details.other_conditions.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Other Specific Conditions</p>
                  <ul className="space-y-1.5 text-xs text-foreground">
                    {details.other_conditions.map((cond, idx) => (
                      <li key={idx} className="flex items-start gap-2 bg-muted/30 p-2 rounded border">
                        <span className="text-primary font-bold">•</span>
                        <span>{cond}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>

            {/* Real-time Student Profile Evaluation */}
            <Card className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 border-b pb-3">
                <div>
                  <h2 className="font-extrabold text-lg text-foreground">Your Real-Time Profile Evaluation</h2>
                  <p className="text-xs text-muted-foreground">
                    Directly computed against your profile attributes.
                  </p>
                </div>
                <VerdictBadge verdict={match.verdict} />
              </div>

              <MatchPanel match={match} />

              {/* Ineligible Explanation & Alternative Recommendations */}
              {match.verdict === "Not Eligible" && (
                <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-extrabold text-sm">
                    <XCircle size={18} />
                    <span>Eligibility Criteria Not Met</span>
                  </div>
                  <p className="text-xs text-rose-900/80 dark:text-rose-200/80 leading-relaxed">
                    You do not currently satisfy the mandatory criteria for {details.name}. Please inspect the failed conditions above.
                  </p>

                  {alternatives.length > 0 && (
                    <div className="pt-2 border-t border-rose-500/20 space-y-2">
                      <p className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                        <Sparkles size={14} className="text-primary" />
                        Recommended Alternative Scholarships You Qualify For:
                      </p>
                      <div className="grid gap-2">
                        {alternatives.map((alt) => (
                          <div
                            key={alt.id}
                            className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-xs hover:border-primary transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-extrabold text-foreground truncate">{alt.name}</p>
                              <p className="text-[11px] text-muted-foreground">{alt.provider} · <b className="text-emerald-600 dark:text-emerald-400">{alt.amount}</b></p>
                            </div>
                            <Button
                              variant="outline"
                              onClick={() => onSelectAlternative?.(alt.id)}
                              className="shrink-0 text-xs font-bold px-2.5 py-1 h-8"
                            >
                              View Scheme
                              <ArrowRight size={13} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 3: REQUIRED DOCUMENTS */}
        {activeTab === "documents" && (
          <div className="space-y-6">
            <Card className="p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="text-primary" size={20} />
                  <h2 className="text-lg font-extrabold text-foreground">Required Document Checklist</h2>
                </div>
                <span className="text-xs font-bold text-muted-foreground">
                  {details.documents.length} Mandatory Document{details.documents.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Warning Banner */}
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" size={17} />
                <div className="leading-relaxed">
                  <b className="font-extrabold">Mandatory Document Verification:</b> Incomplete, expired, or illegible document submissions will result in immediate rejection during institutional nodal scrutiny. Keep original certificates ready for physical verification.
                </div>
              </div>

              <div className="space-y-3">
                {details.documents.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-3 p-3.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-extrabold text-xs">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-foreground">{doc}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Format: PDF, JPG, or PNG (Max 5MB) · Issued by competent government / academic authority
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold">
                      Mandatory
                    </span>
                  </div>
                ))}
              </div>

              {/* Document Format & Size Specifications */}
              <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  Document Specifications & Upload Rules
                </h3>
                <div className="grid gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded-lg bg-card p-3 border">
                    <b className="block text-foreground mb-1">Supported Formats</b>
                    <span className="text-muted-foreground">.PDF, .JPG, .JPEG, .PNG</span>
                  </div>
                  <div className="rounded-lg bg-card p-3 border">
                    <b className="block text-foreground mb-1">Maximum File Size</b>
                    <span className="text-muted-foreground">Strictly ≤ 5 MB per file</span>
                  </div>
                  <div className="rounded-lg bg-card p-3 border">
                    <b className="block text-foreground mb-1">Resolution & Legibility</b>
                    <span className="text-muted-foreground">Minimum 200 DPI, full color scan</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 4: APPLICATION GUIDELINES & TIMELINE */}
        {activeTab === "guidelines" && (
          <div className="space-y-6">
            {/* 8-Step Application Process */}
            <Card className="p-5 sm:p-6 space-y-5">
              <div className="flex items-center gap-2 border-b pb-3">
                <FileText className="text-primary" size={20} />
                <h2 className="text-lg font-extrabold text-foreground">Step-by-Step Application Workflow (8 Stages)</h2>
              </div>

              <div className="space-y-4">
                {(details.application_steps ?? []).map((st) => (
                  <div key={st.step} className="flex items-start gap-3.5 p-3.5 rounded-lg border bg-muted/20">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-extrabold text-sm shadow-xs">
                      {st.step}
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-foreground">{st.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{st.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Application Timeline Card */}
            <Card className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 border-b pb-3">
                <CalendarDays className="text-primary" size={20} />
                <h2 className="text-lg font-extrabold text-foreground">Application & Verification Timeline</h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="p-3 rounded-lg border bg-muted/20">
                  <span className="font-bold text-muted-foreground block">Application Portal Opening</span>
                  <span className="mt-1 font-extrabold text-sm text-foreground block">
                    {details.opening_date ? prettyDate(details.opening_date) : "Not announced"}
                  </span>
                </div>
                <div className="p-3 rounded-lg border bg-muted/20">
                  <span className="font-bold text-muted-foreground block">Student Submission Deadline</span>
                  <span className={`mt-1 font-extrabold text-sm block ${closed ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>
                    {details.closing_date ? prettyDate(details.closing_date) : "Not announced"}
                  </span>
                </div>
                <div className="p-3 rounded-lg border bg-muted/20">
                  <span className="font-bold text-muted-foreground block">Institutional Verification Cutoff</span>
                  <span className="mt-1 font-extrabold text-sm text-foreground block">
                    {details.institute_verification_deadline || "Within 15 days of student last date"}
                  </span>
                </div>
                <div className="p-3 rounded-lg border bg-muted/20">
                  <span className="font-bold text-muted-foreground block">Expected DBT Disbursement</span>
                  <span className="mt-1 font-extrabold text-sm text-emerald-600 dark:text-emerald-400 block">
                    {details.expected_disbursement_date || "Within 60-90 days after scrutiny"}
                  </span>
                </div>
              </div>
            </Card>

            {/* Important Instructions (Dos and Don'ts) */}
            <Card className="p-5 sm:p-6 space-y-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
                Important Instructions & Compliance Rules
              </h3>
              <ul className="space-y-2 text-xs text-foreground">
                {(details.important_instructions ?? []).map((ins, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 bg-accent/20 p-2.5 rounded-lg border">
                    <CheckCircle size={15} className="text-primary mt-0.5 shrink-0" />
                    <span className="leading-relaxed">{ins}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* FAQs Accordion */}
            {details.faqs && details.faqs.length > 0 && (
              <Card className="p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2 border-b pb-3">
                  <HelpCircle className="text-primary" size={20} />
                  <h2 className="text-lg font-extrabold text-foreground">Frequently Asked Questions (FAQs)</h2>
                </div>
                <div className="space-y-2.5">
                  {details.faqs.map((faq, idx) => (
                    <div key={idx} className="rounded-lg border bg-card overflow-hidden">
                      <button
                        onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                        className="w-full flex items-center justify-between p-3.5 text-left text-xs font-extrabold text-foreground hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <span>{faq.question}</span>
                        {openFaqIndex === idx ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {openFaqIndex === idx && (
                        <div className="p-3.5 pt-0 text-xs text-muted-foreground leading-relaxed border-t bg-muted/10">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* TAB 5: RENEWAL MANAGEMENT */}
        {activeTab === "renewal" && (
          <div className="space-y-6">
            {/* Renewal Evaluation Card */}
            <Card className="p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="text-primary" size={20} />
                  <h2 className="text-lg font-extrabold text-foreground">Renewal Eligibility & Management</h2>
                </div>
                <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 text-xs font-bold">
                  {details.is_renewable ? "Renewable Scheme" : "One-Time"}
                </span>
              </div>

              {/* Real-time Renewal Status */}
              <div
                className={`rounded-xl border p-4 ${
                  renewal.isEligible
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm">
                    Renewal Eligibility Status: {renewal.isEligible ? "ELIGIBLE FOR RENEWAL" : "RENEWAL ATTENTION REQUIRED"}
                  </span>
                  <span className="font-extrabold text-xs rounded-full px-2 py-0.5 border bg-card text-foreground">
                    Match: {renewal.score}%
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs">
                  {renewal.passedConditions.map((cond, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                      <Check size={14} className="shrink-0" />
                      <span>{cond}</span>
                    </div>
                  ))}
                  {renewal.failedConditions.map((cond, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-rose-800 dark:text-rose-300">
                      <X size={14} className="shrink-0" />
                      <span>{cond}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Academic Requirements for Continuation */}
              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="p-3 rounded-lg border bg-muted/20">
                  <span className="font-bold text-muted-foreground block">Minimum Academic Performance</span>
                  <span className="mt-1 font-extrabold text-sm text-foreground block">
                    ≥ {details.min_percentage ?? 60}% marks / {details.min_renewal_cgpa ?? 6.0} CGPA
                  </span>
                </div>
                <div className="p-3 rounded-lg border bg-muted/20">
                  <span className="font-bold text-muted-foreground block">Biometric Attendance Threshold</span>
                  <span className="mt-1 font-extrabold text-sm text-foreground block">
                    ≥ {details.min_renewal_attendance ?? 75}% Attendance Required
                  </span>
                </div>
                <div className="p-3 rounded-lg border bg-muted/20">
                  <span className="font-bold text-muted-foreground block">Active Backlog Policy</span>
                  <span className="mt-1 font-extrabold text-sm text-foreground block">
                    Zero Active Backlogs (Must be promoted)
                  </span>
                </div>
                <div className="p-3 rounded-lg border bg-muted/20">
                  <span className="font-bold text-muted-foreground block">Renewal Application Window</span>
                  <span className="mt-1 font-extrabold text-sm text-foreground block">
                    {details.renewal_deadline || "Synchronized with fresh cycle"}
                  </span>
                </div>
              </div>

              {/* Renewal Documents */}
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  Documents Required Specifically for Renewal
                </h3>
                <ul className="space-y-1.5 text-xs text-foreground">
                  {(details.renewal_documents ?? []).map((doc, idx) => (
                    <li key={idx} className="flex items-center gap-2 bg-card p-2.5 rounded-lg border">
                      <FileText size={14} className="text-primary shrink-0" />
                      <span>{doc}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Renewal Instructions */}
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  Renewal Application Steps
                </h3>
                <ol className="space-y-1.5 text-xs text-foreground list-decimal list-inside">
                  {(details.renewal_instructions ?? []).map((step, idx) => (
                    <li key={idx} className="bg-muted/20 p-2 rounded-lg border leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </Card>
          </div>
        )}

        {/* RIGHT SIDEBAR: ACTIONS, RECORD EXTERNAL, VERIFICATION */}
        <div className="space-y-5">
          {/* Action Card */}
          <Card className="p-5 space-y-3.5">
            <h2 className="text-sm font-extrabold text-foreground uppercase tracking-wider">
              Application & Tracking
            </h2>

            {/* Primary Action 1: Official Portal Button */}
            {details.application_url && (
              <button
                type="button"
                onClick={() => setShowSecurityModal(true)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground hover:opacity-90 shadow-sm transition-opacity cursor-pointer"
              >
                Apply on Official Portal
                <ExternalLink size={16} />
              </button>
            )}

            {/* Primary Action 2: Record External Portal Application */}
            <button
              type="button"
              onClick={() => setShowRecordModal(true)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border-2 border-primary/40 bg-accent/30 px-4 py-2.5 text-xs font-extrabold text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              <FileText size={15} className="text-primary" />
              Record External Application ID
            </button>

            {/* Primary Action 3: ScholarShield In-Portal Tracking */}
            <Button
              variant="outline"
              className="w-full font-bold text-xs"
              onClick={onApply}
              disabled={closed || !details.is_active || alreadyApplied || details.in_database === false}
            >
              {alreadyApplied
                ? "Already Applied in ScholarShield"
                : details.in_database === false
                ? "Official Portal Submission Only"
                : "Apply & Track via ScholarShield"}
              <ArrowRight size={14} />
            </Button>

            {/* Bookmark / Save */}
            <Button variant="ghost" className="w-full text-xs font-bold" onClick={onSave}>
              {saved ? <BookmarkCheck size={16} className="text-primary" /> : <Bookmark size={16} />}
              {saved ? "Saved in Your Shortlist" : "Save to Shortlist"}
            </Button>

            {/* Official Guidelines PDF Link */}
            {details.official_guidelines_url && (
              <a
                href={details.official_guidelines_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors pt-2 border-t"
              >
                Official Scheme Guidelines & Notification
                <ExternalLink size={12} />
              </a>
            )}
          </Card>

          {/* Official Verification Information Card */}
          <Card className="p-4 space-y-3 bg-muted/40">
            <div className="flex items-center gap-2 text-xs font-extrabold text-foreground">
              <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span>Official Verification Details</span>
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
              <p><b>Official Source:</b> {details.provider}</p>
              <p><b>Portal:</b> {details.official_portal_name || "Official Government / Provider Portal"}</p>
              <p><b>Verification Status:</b> <span className="font-bold text-emerald-600 dark:text-emerald-400">{verification}</span></p>
              <p><b>Last Verified Date:</b> {details.last_verified_date ? prettyDate(details.last_verified_date) : "Current academic cycle"}</p>
              {details.verification_note && (
                <p className="pt-1 text-[11px] italic">{details.verification_note}</p>
              )}
            </div>
          </Card>

          {/* Platform Transparency Notice */}
          <div className="rounded-lg border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <b>ScholarShield Platform Notice:</b> ScholarShield is an independent eligibility evaluation, guidance, and status tracking portal. Official submissions must be lodged on the designated government or corporate portal. ScholarShield never claims to make government submissions without official integration.
          </div>
        </div>
      </div>

      {/* MODAL 1: REDIRECTION SECURITY NOTICE */}
      {showSecurityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-lg p-6 space-y-4 shadow-2xl animate-rise">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-primary font-extrabold text-lg">
                <ShieldAlert size={22} />
                <span>Redirecting to Official Portal</span>
              </div>
              <button
                onClick={() => setShowSecurityModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-lg bg-accent/40 p-3 text-xs leading-relaxed text-foreground space-y-1 border">
              <p className="font-bold">Official Application Portal:</p>
              <p className="text-primary font-mono text-[11px] break-all">{details.application_url}</p>
              <p className="text-muted-foreground pt-1">
                Portal: <b>{details.official_portal_name}</b>
              </p>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
              <p className="flex items-start gap-2">
                <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>You will now navigate to the authenticated government / corporate provider portal to lodge your application.</span>
              </p>
              <p className="flex items-start gap-2">
                <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>After completing your submission, copy your <b>Application Reference / Acknowledgement Number</b>.</span>
              </p>
              <p className="flex items-start gap-2">
                <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>Return to ScholarShield and click <b>"Record External Application ID"</b> to enable real-time lifecycle tracking on your student dashboard.</span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <Button variant="outline" onClick={() => setShowSecurityModal(false)}>
                Cancel
              </Button>
              <a
                href={details.application_url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowSecurityModal(false)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Proceed to Official Portal
                <ExternalLink size={15} />
              </a>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 2: RECORD EXTERNAL PORTAL SUBMISSION */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-lg p-6 space-y-4 shadow-2xl animate-rise">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-primary font-extrabold text-lg">
                <FileText size={22} />
                <span>Track Official Portal Application</span>
              </div>
              <button
                onClick={() => setShowRecordModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Submitted your application on <b>{details.official_portal_name}</b>? Enter your official reference number or acknowledgement ID below to track its verification and disbursement stages inside ScholarShield.
            </p>

            {recordSuccessMsg ? (
              <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 p-3 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                {recordSuccessMsg}
              </div>
            ) : (
              <form onSubmit={handleRecordExternal} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Official Application ID / Acknowledgement Number
                  </label>
                  <input
                    type="text"
                    required
                    value={externalRefInput}
                    onChange={(e) => setExternalRefInput(e.target.value)}
                    placeholder="e.g. NSP2024108842, AP-JVD-98124, MHDBT-77218"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-primary"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Found on your submitted PDF acknowledgement receipt or confirmation SMS.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button variant="outline" type="button" onClick={() => setShowRecordModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="font-bold">
                    Save & Track in ScholarShield
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
