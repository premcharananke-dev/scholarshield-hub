// Student-facing Scholarship Discovery & Recommendation System
// Problem Statement No. 58: Scholarship Eligibility & Disbursement System (ScholarShield)
// Comprehensive India-wide directory across Central Govt, State Govt, AICTE, UGC, Corporate, and Special Categories.

import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  Filter,
  HelpCircle,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  isVisibleTo,
  matchScholarship,
  effectiveGender,
  getStudentState,
  categorizeScholarships,
  getAlternativeRecommendations,
  type Match,
} from "@/lib/eligibility";
import type { MatchProfile, Scholarship, ScholarshipCategory } from "@/lib/types";
import {
  ALL_INDIAN_STATES_AND_UTS,
  computeApplicationStatus,
  computeVerificationStatus,
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
        {onApply && !isClosed(s) && s.is_active && !alreadyApplied ? (
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
        if (s.course_streams.length > 0 && !s.course_streams.includes(streamFilter)) return false;
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
};

export function ScholarshipDetails({
  s,
  profile,
  saved,
  onSave,
  onApply,
  back,
  alreadyApplied,
}: DetailsProps) {
  const match = matchScholarship(s, profile);
  const closed = isClosed(s);
  const status = s.application_status ?? computeApplicationStatus(s);
  const verification = s.verification_status ?? computeVerificationStatus(s);
  const alternatives = useMemo(() => getAlternativeRecommendations([], profile, s.id, 2), [profile, s.id]);

  return (
    <div className="animate-rise space-y-6">
      <button
        onClick={back}
        className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft size={17} />
        Back to scholarships
      </button>

      {/* Header Banner */}
      <Card className="overflow-hidden shadow-sm">
        <div
          className={`border-b p-5 sm:p-6 ${
            s.eligible_gender === "Female"
              ? "bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-card"
              : "bg-accent/50"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-primary">
            <span>{s.id}</span>
            <span>·</span>
            <span>{s.provider_type.toUpperCase()}</span>
            {s.scheme_category && (
              <>
                <span>·</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary border border-primary/20">
                  {s.scheme_category}
                </span>
              </>
            )}
            {s.academic_year && (
              <>
                <span>·</span>
                <span>{s.academic_year}</span>
              </>
            )}
          </div>

          <h1 className="mt-2 text-2xl font-extrabold text-foreground">{s.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{s.provider}</p>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {s.eligible_gender === "Female" && (
              <span className="rounded-full bg-pink-100 dark:bg-pink-950/70 px-2.5 py-1 text-[10px] font-extrabold text-pink-700 dark:text-pink-300 border border-pink-300 dark:border-pink-800 tracking-wide uppercase">
                GIRLS ONLY
              </span>
            )}
            {s.eligible_states && s.eligible_states.length > 0 && (
              <span className="rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 px-2.5 py-1 text-[10px] font-bold flex items-center gap-1">
                <MapPin size={10} />
                {s.eligible_states.join(", ")}
              </span>
            )}
            {s.tags.map((t) => (
              <span key={t} className="rounded-full bg-card px-2.5 py-1 text-[10px] font-bold border">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* 4-Column Quick Metrics */}
        <div className="grid gap-5 p-5 sm:grid-cols-4 sm:p-6 border-b">
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground">Financial Benefit</p>
            <p className="mt-1 font-extrabold text-base text-foreground">{s.amount}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground">Application Status</p>
            <p className="mt-1 font-extrabold">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                  status === "Open"
                    ? "bg-success-soft text-success"
                    : status === "Upcoming"
                    ? "bg-info-soft text-info"
                    : "bg-danger-soft text-danger"
                }`}
              >
                {status.toUpperCase()}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground">Opening Date</p>
            <p className="mt-1 font-extrabold">{s.opening_date ? prettyDate(s.opening_date) : "Not announced"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground">Closing Date</p>
            <p className={`mt-1 font-extrabold ${closed ? "text-danger" : ""}`}>
              {s.closing_date ? prettyDate(s.closing_date) : "Not announced"}
            </p>
          </div>
        </div>

        {/* Description & Benefits */}
        <div className="p-5 sm:p-6 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground">About this scheme</p>
            <p className="mt-1 text-sm leading-6 text-foreground">{s.description}</p>
          </div>
          {s.benefits && (
            <div className="rounded-lg bg-muted/50 p-4 border text-sm leading-6">
              <b className="text-foreground">Detailed Coverage & Benefits:</b> {s.benefits}
            </div>
          )}
        </div>
      </Card>

      {/* Eligibility & Documents Grid */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Real-time Match Analysis */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 border-b pb-3">
            <div>
              <h2 className="font-extrabold text-lg">Your Real-Time Eligibility Match</h2>
              <p className="text-xs text-muted-foreground">
                Evaluated against your verified student profile data.
              </p>
            </div>
            <VerdictBadge verdict={match.verdict} />
          </div>

          <MatchPanel match={match} />

          <p className="text-xs text-muted-foreground pt-2">
            ScholarShield eligibility verdicts are advisory. The final approval and disbursement decision rests with the official scheme authority.
          </p>
        </Card>

        {/* Required Documents & Official Actions */}
        <div className="space-y-5">
          {/* Document Checklist */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-extrabold text-base">
              <FileText size={18} className="text-primary" />
              Required Document Checklist
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {s.documents.map((d) => (
                <li key={d} className="flex gap-2 text-foreground">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
            {!s.documents.length && (
              <p className="mt-3 text-sm text-muted-foreground">
                Standard documents apply — refer to the official portal notification.
              </p>
            )}
          </Card>

          {/* Action Card */}
          <Card className="space-y-3 p-5">
            <Button
              className="w-full font-bold"
              onClick={onApply}
              disabled={closed || !s.is_active || alreadyApplied}
            >
              {alreadyApplied ? "Already Applied in ScholarShield" : "Apply & Track in ScholarShield"}
              <ArrowRight size={16} />
            </Button>

            {s.application_url && (
              <a
                href={s.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-secondary px-4 text-sm font-bold text-secondary-foreground hover:opacity-90 transition-opacity"
              >
                Official Application Portal
                <ExternalLink size={16} />
              </a>
            )}

            <Button variant="outline" className="w-full" onClick={onSave}>
              {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              {saved ? "Saved for Later" : "Save for Later"}
            </Button>

            {s.source_url && (
              <a
                href={s.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary transition-colors pt-2"
              >
                Official Scheme Guidelines & Circular
                <ExternalLink size={12} />
              </a>
            )}
          </Card>
        </div>
      </div>

      {/* Verification Notice */}
      <div className="flex gap-3 rounded-lg border bg-muted/70 p-4">
        <CalendarDays className="mt-0.5 shrink-0 text-info" size={18} />
        <div className="text-xs leading-5 text-muted-foreground">
          <p>
            <b>Verification Details:</b>{" "}
            {verification === "Verified" ? (
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                Verified against official government / corporate portal guidelines.
              </span>
            ) : (
              <span className="font-bold text-amber-600 dark:text-amber-400">
                Some details (such as dates) await official notification.
              </span>
            )}
          </p>
          {s.verification_note && <p className="mt-1">{s.verification_note}</p>}
          {s.last_verified_date && (
            <p className="mt-1 text-[11px] text-muted-foreground font-semibold">
              Last verified date: {prettyDate(s.last_verified_date)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
