// Admin scholarship management: comprehensive directory control with 20 attributes, verification workflows, and multi-filters.
import { ArrowLeft, Check, Filter, Pencil, Plus, Power, RotateCw, Search, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { deleteScholarship, saveScholarship, setScholarshipActive, syncMasterScholarshipsToDb } from "@/lib/data";
import {
  CATEGORIES,
  SCHEME_CATEGORIES,
  STREAMS,
  STUDY_LEVELS,
  TAGS,
  type Scholarship,
  type ScholarshipCategory,
} from "@/lib/types";
import { ALL_INDIAN_STATES_AND_UTS, computeVerificationStatus } from "@/data/scholarships";
import { Button, Card, Chip, EmptyState, Field, FormSection, PageTitle, SelectField } from "./ui-kit";
import { deadlineLabel, isClosed } from "./scholarships";

const blank = (id: string): Scholarship => ({
  id,
  name: "",
  provider: "",
  provider_type: "Government",
  scheme_category: "Central Government",
  description: "",
  tags: [],
  eligible_gender: "Any",
  study_levels: [],
  course_streams: [],
  eligible_years: [],
  eligible_states: ["All India"],
  max_income: null,
  min_percentage: null,
  percentage_basis: null,
  eligible_categories: [],
  amount: "",
  benefits: null,
  documents: [],
  other_conditions: [],
  opening_date: null,
  closing_date: null,
  academic_year: "2026-27",
  application_url: null,
  source_url: null,
  unverified_fields: [],
  verification_note: null,
  is_active: true,
});

export function AdminScholarships({
  scholarships,
  reload,
}: {
  scholarships: Scholarship[];
  reload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<{ s: Scholarship; isNew: boolean } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [q, setQ] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>("All");
  const [stateFilter, setStateFilter] = useState<string>("All");
  const [verificationFilter, setVerificationFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  if (editing)
    return (
      <ScholarshipEditor
        initial={editing.s}
        isNew={editing.isNew}
        existingIds={scholarships.map((s) => s.id)}
        back={() => setEditing(null)}
        saved={async () => {
          await reload();
          setEditing(null);
        }}
      />
    );

  const numericIds = scholarships
    .map((s) => Number(s.id.replace("SCH-", "")))
    .filter((n) => !isNaN(n));
  const maxNum = numericIds.length > 0 ? Math.max(...numericIds) : 0;
  const nextId = `SCH-${String(maxNum + 1).padStart(3, "0")}`;

  const filtered = scholarships.filter((s) => {
    // Search query
    if (q) {
      const haystack = `${s.name} ${s.id} ${s.provider} ${s.scheme_category ?? ""}`.toLowerCase();
      if (!haystack.includes(q.toLowerCase())) return false;
    }

    // Sector Filter
    if (sectorFilter !== "All" && s.scheme_category !== sectorFilter) return false;

    // State Filter
    if (stateFilter !== "All") {
      const states = s.eligible_states ?? ["All India"];
      if (stateFilter === "All India" && !states.includes("All India")) return false;
      if (stateFilter !== "All India" && !states.includes("All India") && !states.includes(stateFilter)) return false;
    }

    // Verification Filter
    const vStatus = computeVerificationStatus(s);
    if (verificationFilter === "Verified" && vStatus !== "Verified") return false;
    if (verificationFilter === "Needs Verification" && vStatus !== "Needs Verification") return false;

    // Active Status Filter
    if (statusFilter === "Active" && !s.is_active) return false;
    if (statusFilter === "Inactive" && s.is_active) return false;

    return true;
  });

  async function toggle(s: Scholarship) {
    if (
      !confirm(
        `${s.is_active ? "Deactivate" : "Activate"} "${s.name}"? ${
          s.is_active ? "Students will no longer see it." : "Students will see it again."
        }`
      )
    )
      return;
    try {
      await setScholarshipActive(s.id, !s.is_active);
      toast.success(s.is_active ? "Scholarship deactivated" : "Scholarship activated");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function quickVerify(s: Scholarship) {
    try {
      const updated: Scholarship = {
        ...s,
        unverified_fields: [],
        verification_note: "Verified by ScholarShield administrator",
        verification_status: "Verified",
        last_verified_date: new Date().toISOString().slice(0, 10),
      };
      await saveScholarship(updated, false);
      toast.success(`"${s.name}" verified successfully`);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove(s: Scholarship) {
    if (
      !confirm(
        `Permanently delete "${s.name}"? Existing applications keep their record but lose the link. Deactivating is usually safer.`
      )
    )
      return;
    try {
      await deleteScholarship(s.id);
      toast.success("Scholarship deleted");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const needsVerificationCount = scholarships.filter(
    (s) => computeVerificationStatus(s) === "Needs Verification"
  ).length;
  const unsyncedCount = scholarships.filter((s) => s.in_database === false).length;

  async function syncCatalog() {
    setSyncing(true);
    try {
      const { inserted, totalInDb } = await syncMasterScholarshipsToDb();
      toast.success(
        inserted > 0
          ? `Synced ${inserted} missing scholarships to Supabase (${totalInDb} total in DB).`
          : "All master catalog scholarships are already synced in Supabase."
      );
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="animate-rise space-y-5">
      <PageTitle
        title="Manage Scholarships"
        subtitle={`Total directory: ${scholarships.length} scholarships (${scholarships.length - needsVerificationCount} verified, ${needsVerificationCount} need verification).`}
        action={
          <div className="flex flex-wrap gap-2">
            {unsyncedCount > 0 && (
              <Button variant="outline" disabled={syncing} onClick={syncCatalog}>
                {syncing ? "Syncing…" : `Sync ${unsyncedCount} Missing to DB`}
              </Button>
            )}
            <Button onClick={() => setEditing({ s: blank(nextId), isNew: true })}>
              <Plus size={17} />
              Add Scholarship
            </Button>
          </div>
        }
      />

      {unsyncedCount > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-warning/40 bg-warning-soft/40 p-4">
          <div className="text-xs text-foreground">
            <b>{unsyncedCount} catalog schemes</b> are not yet stored in Supabase{" "}
            <code className="font-mono">public.scholarships</code>. Sync them to enable direct in-portal student applications.
          </div>
          <Button variant="secondary" disabled={syncing} onClick={syncCatalog} className="h-9 px-3 text-xs">
            {syncing ? "Syncing…" : "Sync Catalog to Database"}
          </Button>
        </Card>
      )}

      {/* Admin Multi-Filter Toolbar */}
      <Card className="p-4 space-y-3">
        <label className="relative block">
          <Search className="absolute left-3.5 top-3.5 text-muted-foreground" size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, ID, provider, or ministry..."
            aria-label="Search scholarships"
            className="h-11 w-full rounded-lg border bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 text-xs">
          {/* Sector Filter */}
          <div>
            <label className="block font-bold text-muted-foreground mb-1">Sector / Scheme Category</label>
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2.5 font-medium outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="All">All Sectors</option>
              {SCHEME_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* State Filter */}
          <div>
            <label className="block font-bold text-muted-foreground mb-1">Eligible State Scope</label>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2.5 font-medium outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="All">All States & UTs</option>
              <option value="All India">All-India Only</option>
              <option value="Andhra Pradesh">Andhra Pradesh</option>
              <option value="Telangana">Telangana</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Tamil Nadu">Tamil Nadu</option>
              <option value="Maharashtra">Maharashtra</option>
              {ALL_INDIAN_STATES_AND_UTS.filter(
                (st) =>
                  st !== "All India" &&
                  !["Andhra Pradesh", "Telangana", "Karnataka", "Tamil Nadu", "Maharashtra"].includes(st)
              ).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Verification Status Filter */}
          <div>
            <label className="block font-bold text-muted-foreground mb-1">Verification Status</label>
            <select
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2.5 font-medium outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="All">All ({scholarships.length})</option>
              <option value="Verified">Verified Only ({scholarships.length - needsVerificationCount})</option>
              <option value="Needs Verification">
                Needs Verification ({needsVerificationCount})
              </option>
            </select>
          </div>

          {/* Active Status Filter */}
          <div>
            <label className="block font-bold text-muted-foreground mb-1">Active Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2.5 font-medium outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="All">All</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Scholarships List */}
      <div className="space-y-3">
        {filtered.map((s) => {
          const vStatus = computeVerificationStatus(s);
          return (
            <Card
              key={s.id}
              className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center hover:border-primary/40 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-sm font-extrabold text-foreground">{s.id}</b>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                      s.is_active ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.is_active ? "ACTIVE" : "INACTIVE"}
                  </span>
                  {s.in_database === false && (
                    <span className="rounded-full bg-warning-soft text-warning px-2 py-0.5 text-[10px] font-extrabold">
                      CATALOG ONLY
                    </span>
                  )}
                  {s.scheme_category && (
                    <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[10px] font-bold">
                      {s.scheme_category}
                    </span>
                  )}
                  {s.eligible_states && s.eligible_states.length > 0 && !s.eligible_states.includes("All India") && (
                    <span className="rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold">
                      {s.eligible_states.join(", ")}
                    </span>
                  )}
                  {vStatus === "Verified" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                      <ShieldCheck size={11} />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold">
                      <ShieldAlert size={11} />
                      Needs Verification
                    </span>
                  )}
                  {isClosed(s) && (
                    <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-extrabold text-danger">
                      CLOSED
                    </span>
                  )}
                  {s.eligible_gender === "Female" && (
                    <span className="rounded-full bg-pink-100 text-pink-700 dark:bg-pink-950 px-2 py-0.5 text-[10px] font-extrabold">
                      WOMEN
                    </span>
                  )}
                </div>

                <p className="mt-1 font-extrabold text-foreground truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.provider} · Amount: <b className="text-foreground">{s.amount}</b> · {deadlineLabel(s)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {vStatus === "Needs Verification" && (
                  <Button
                    variant="outline"
                    onClick={() => quickVerify(s)}
                    className="h-9 px-2.5 text-xs text-emerald-700 dark:text-emerald-300 border-emerald-300 hover:bg-emerald-50"
                    ariaLabel={`Quick verify ${s.name}`}
                  >
                    <Check size={14} />
                    Verify
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setEditing({ s, isNew: false })}
                  ariaLabel={`Edit ${s.name}`}
                  className="h-9 px-2.5 text-xs"
                >
                  <Pencil size={14} />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => toggle(s)}
                  ariaLabel={`${s.is_active ? "Deactivate" : "Activate"} ${s.name}`}
                  className="h-9 px-2.5 text-xs"
                >
                  <Power size={14} />
                  {s.is_active ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => remove(s)}
                  ariaLabel={`Delete ${s.name}`}
                  className="h-9 px-2 text-danger hover:bg-danger-soft"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </Card>
          );
        })}

        {filtered.length === 0 && <EmptyState title="No matching scholarships found" text="Try resetting the filters." />}
      </div>
    </div>
  );
}

const lines = (v: string) =>
  v
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
const toggleIn = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

function ScholarshipEditor({
  initial,
  isNew,
  existingIds,
  back,
  saved,
}: {
  initial: Scholarship;
  isNew: boolean;
  existingIds: string[];
  back: () => void;
  saved: () => Promise<void>;
}) {
  const [s, setS] = useState(initial);
  const [text, setText] = useState({
    documents: initial.documents.join("\n"),
    other: initial.other_conditions.join("\n"),
    states: (initial.eligible_states ?? ["All India"]).join(", "),
    income: initial.max_income?.toString() ?? "",
    pct: initial.min_percentage?.toString() ?? "",
    renewalConditions: (initial.renewal_conditions ?? []).join("\n"),
    renewalDocs: (initial.renewal_documents ?? []).join("\n"),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof Scholarship>(k: K, v: Scholarship[K]) => setS({ ...s, [k]: v });

  const MultiChips = <T extends string | number>({
    label,
    options,
    value,
    onChange,
  }: {
    label: string;
    options: readonly T[];
    value: T[];
    onChange: (v: T[]) => void;
  }) => (
    <div>
      <p className="text-sm font-bold">
        {label} <span className="font-medium text-muted-foreground">(none selected = any)</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={String(o)} active={value.includes(o)} onClick={() => onChange(toggleIn(value, o))}>
            {String(o)}
          </Chip>
        ))}
      </div>
    </div>
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};

    if (!/^SCH-\d{3,}$/.test(s.id)) err["id"] = "Use the format SCH-010";
    else if (isNew && existingIds.includes(s.id)) err["id"] = "This ID already exists";

    if (!s.name.trim()) err["name"] = "Name is required";
    if (!s.provider.trim()) err["provider"] = "Provider is required";
    if (!s.amount.trim()) err["amount"] = "Enter the amount, or 'Unverified'";

    for (const k of ["application_url", "source_url"] as const) {
      if (s[k] && !/^https:\/\/\S+$/.test(s[k] ?? "")) err[k] = "Must start with https://";
    }

    if (text.income && (isNaN(+text.income) || +text.income < 0)) err["income"] = "Enter a valid amount";
    if (text.pct && (isNaN(+text.pct) || +text.pct < 0 || +text.pct > 100)) err["pct"] = "Enter 0–100";
    if (s.opening_date && s.closing_date && s.closing_date < s.opening_date)
      err["closing"] = "Closing date must be after opening date";

    setErrors(err);
    if (Object.keys(err).length) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setBusy(true);
    try {
      const parsedStates = text.states
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      const unverified = s.unverified_fields.filter(
        (f) => !((f === "opening_date" && s.opening_date) || (f === "closing_date" && s.closing_date))
      );

      const payload: Scholarship = {
        ...s,
        name: s.name.trim(),
        provider: s.provider.trim(),
        eligible_states: parsedStates.length > 0 ? parsedStates : ["All India"],
        documents: lines(text.documents),
        other_conditions: lines(text.other),
        max_income: text.income ? +text.income : null,
        min_percentage: text.pct ? +text.pct : null,
        unverified_fields: unverified,
        application_url: s.application_url || null,
        source_url: s.source_url || null,
        verification_status: unverified.length === 0 ? "Verified" : "Needs Verification",
        last_verified_date: new Date().toISOString().slice(0, 10),
        funding_authority: s.funding_authority || null,
        payment_frequency: s.payment_frequency || "Annual",
        tuition_coverage: s.tuition_coverage || "Partial Tuition Fee",
        payment_method: s.payment_method || "Direct Benefit Transfer (DBT)",
        disbursement_authority: s.disbursement_authority || null,
        duration: s.duration || null,
        course_duration_coverage: s.course_duration_coverage || null,
        is_renewable: s.is_renewable ?? true,
        renewal_frequency: s.renewal_frequency || "Annual",
        renewal_conditions: lines(text.renewalConditions),
        renewal_documents: lines(text.renewalDocs),
        official_portal_name: s.official_portal_name || null,
        official_guidelines_url: s.official_guidelines_url || null,
        institute_verification_deadline: s.institute_verification_deadline || null,
        expected_disbursement_date: s.expected_disbursement_date || null,
      };

      await saveScholarship(payload, isNew);
      toast.success(isNew ? "Scholarship added" : "Scholarship updated");
      await saved();
    } catch (e2) {
      toast.error((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise space-y-6">
      <button
        onClick={back}
        className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft size={17} />
        Back to scholarships
      </button>

      <PageTitle
        title={isNew ? "Add Scholarship" : `Edit ${s.id}`}
        subtitle="Manage all 20 official attributes. Changes reflect in student discovery and recommendations immediately."
      />

      <form onSubmit={submit} className="space-y-6">
        <FormSection title="Basic Details & Categorization" icon={<Pencil size={18} />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Scholarship ID"
              value={s.id}
              onChange={(v) => isNew && set("id", v.toUpperCase())}
              error={errors["id"]}
            />
            <Field label="Scholarship Name" value={s.name} onChange={(v) => set("name", v)} error={errors["name"]} />
            <Field
              label="Provider / Ministry / Department"
              value={s.provider}
              onChange={(v) => set("provider", v)}
              error={errors["provider"]}
            />
            <SelectField
              label="Provider Type"
              value={s.provider_type}
              onChange={(v) => set("provider_type", v as Scholarship["provider_type"])}
              options={["Government", "Private"]}
            />
            <SelectField
              label="Scheme Category / Sector"
              value={s.scheme_category ?? "Central Government"}
              onChange={(v) => set("scheme_category", v as ScholarshipCategory)}
              options={[...SCHEME_CATEGORIES]}
            />
            <Field
              label="Eligible States (comma separated, or 'All India')"
              value={text.states}
              onChange={(v) => setText({ ...text, states: v })}
              placeholder="e.g. All India or Andhra Pradesh"
            />
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold">
                Detailed Objective & Coverage
                <textarea
                  value={s.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>
            <Field
              label="Scholarship Amount / Value"
              value={s.amount}
              onChange={(v) => set("amount", v)}
              error={errors["amount"]}
              placeholder="e.g. ₹50,000 per year or Full Tuition Fee Reimbursement"
            />
            <Field
              label="Detailed Benefits"
              value={s.benefits ?? ""}
              onChange={(v) => set("benefits", v || null)}
              required={false}
              placeholder="e.g. Tuition fee plus ₹10,000/yr maintenance allowance"
            />
            <Field
              label="Funding Authority"
              value={s.funding_authority ?? ""}
              onChange={(v) => set("funding_authority", v || null)}
              required={false}
              placeholder="e.g. Central Govt / State Higher Education / Corporate CSR"
            />
            <SelectField
              label="Payment Frequency"
              value={s.payment_frequency ?? "Annual"}
              onChange={(v) => set("payment_frequency", v as any)}
              options={["Annual", "Monthly", "Quarterly", "One-Time", "Course-wise"]}
            />
            <SelectField
              label="Tuition Fee Coverage"
              value={s.tuition_coverage ?? "Partial Tuition Fee"}
              onChange={(v) => set("tuition_coverage", v as any)}
              options={[
                "100% Full Tuition Fee",
                "Partial Tuition Fee",
                "Maintenance Allowance Only",
                "Fixed Annual Grant",
              ]}
            />
            <Field
              label="Disbursement Authority"
              value={s.disbursement_authority ?? ""}
              onChange={(v) => set("disbursement_authority", v || null)}
              required={false}
              placeholder="e.g. PFMS / State Treasury / AICTE Finance Bureau"
            />
            <Field
              label="Payment Method"
              value={s.payment_method ?? ""}
              onChange={(v) => set("payment_method", v || null)}
              required={false}
              placeholder="e.g. Direct Benefit Transfer (DBT) via PFMS"
            />
            <Field
              label="Assistance Duration"
              value={s.duration ?? ""}
              onChange={(v) => set("duration", v || null)}
              required={false}
              placeholder="e.g. Up to 4 Academic Years (Full Degree Duration)"
            />
            <div className="sm:col-span-2">
              <Field
                label="Course Coverage Scope"
                value={s.course_duration_coverage ?? ""}
                onChange={(v) => set("course_duration_coverage", v || null)}
                required={false}
                placeholder="e.g. Covers all regular academic semesters until graduation"
              />
            </div>
            <div className="sm:col-span-2">
              <MultiChips label="Tags" options={TAGS} value={s.tags} onChange={(v) => set("tags", v)} />
            </div>
          </div>
        </FormSection>

        <FormSection title="Eligibility Criteria" icon={<Search size={18} />}>
          <div className="grid gap-5">
            <SelectField
              label="Eligible Gender"
              value={s.eligible_gender}
              onChange={(v) => set("eligible_gender", v as Scholarship["eligible_gender"])}
              options={["Any", "Female"]}
            />
            <MultiChips
              label="Study Levels"
              options={STUDY_LEVELS}
              value={s.study_levels}
              onChange={(v) => set("study_levels", v)}
            />
            <MultiChips
              label="Course Streams"
              options={STREAMS}
              value={s.course_streams}
              onChange={(v) => set("course_streams", v)}
            />
            <MultiChips
              label="Year of Study"
              options={[1, 2, 3, 4, 5]}
              value={s.eligible_years}
              onChange={(v) => set("eligible_years", v)}
            />
            <MultiChips
              label="Eligible Categories"
              options={CATEGORIES}
              value={s.eligible_categories}
              onChange={(v) => set("eligible_categories", v)}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Max Family Income (₹)"
                type="number"
                value={text.income}
                onChange={(v) => setText({ ...text, income: v })}
                required={false}
                error={errors["income"]}
              />
              <Field
                label="Min Academic %"
                type="number"
                value={text.pct}
                onChange={(v) => setText({ ...text, pct: v })}
                required={false}
                error={errors["pct"]}
              />
              <Field
                label="Marks Basis"
                value={s.percentage_basis ?? ""}
                onChange={(v) => set("percentage_basis", v || null)}
                required={false}
                placeholder="e.g. Class 12"
              />
            </div>
            <label className="block text-sm font-bold">
              Other conditions (one per line, e.g. Attendance criteria)
              <textarea
                value={text.other}
                onChange={(e) => setText({ ...text, other: e.target.value })}
                rows={3}
                className="mt-2 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block text-sm font-bold">
              Required documents (one per line)
              <textarea
                value={text.documents}
                onChange={(e) => setText({ ...text, documents: e.target.value })}
                rows={4}
                className="mt-2 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
        </FormSection>

        <FormSection title="Dates, Official Links & Verification" icon={<Power size={18} />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Opening Date"
              type="date"
              value={s.opening_date ?? ""}
              onChange={(v) => set("opening_date", v || null)}
              required={false}
            />
            <Field
              label="Closing Date"
              type="date"
              value={s.closing_date ?? ""}
              onChange={(v) => set("closing_date", v || null)}
              required={false}
              error={errors["closing"]}
            />
            <Field
              label="Academic Year"
              value={s.academic_year ?? ""}
              onChange={(v) => set("academic_year", v || null)}
              required={false}
            />
            <SelectField
              label="Status"
              value={s.is_active ? "Active" : "Inactive"}
              onChange={(v) => set("is_active", v === "Active")}
              options={["Active", "Inactive"]}
            />
            <Field
              label="Official Application URL"
              value={s.application_url ?? ""}
              onChange={(v) => set("application_url", v)}
              required={false}
              error={errors["application_url"]}
              placeholder="https://scholarships.gov.in/"
            />
            <Field
              label="Official Source URL"
              value={s.source_url ?? ""}
              onChange={(v) => set("source_url", v)}
              required={false}
              error={errors["source_url"]}
              placeholder="https://..."
            />
            <div className="sm:col-span-2">
              <MultiChips
                label="Mark as unverified"
                options={["amount", "opening_date", "closing_date", "eligibility"]}
                value={s.unverified_fields}
                onChange={(v) => set("unverified_fields", v)}
              />
            </div>
            <div className="sm:col-span-2">
              <Field
                label="Verification Note"
                value={s.verification_note ?? ""}
                onChange={(v) => set("verification_note", v || null)}
                required={false}
                placeholder="Notes on official source verification..."
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Renewal Rules & Administrative Timeline" icon={<RotateCw size={18} />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Is Renewable Scheme?"
              value={s.is_renewable !== false ? "Yes" : "No"}
              onChange={(v) => set("is_renewable", v === "Yes")}
              options={["Yes", "No"]}
            />
            <SelectField
              label="Renewal Frequency"
              value={s.renewal_frequency ?? "Annual"}
              onChange={(v) => set("renewal_frequency", v as any)}
              options={["Annual", "Semester", "Not applicable"]}
            />
            <Field
              label="Official Portal Name"
              value={s.official_portal_name ?? ""}
              onChange={(v) => set("official_portal_name", v || null)}
              required={false}
              placeholder="e.g. National Scholarship Portal (NSP)"
            />
            <Field
              label="Official Guidelines URL"
              value={s.official_guidelines_url ?? ""}
              onChange={(v) => set("official_guidelines_url", v || null)}
              required={false}
              placeholder="https://..."
            />
            <Field
              label="Institutional Verification Deadline"
              value={s.institute_verification_deadline ?? ""}
              onChange={(v) => set("institute_verification_deadline", v || null)}
              required={false}
              placeholder="e.g. 15 Jan 2027"
            />
            <Field
              label="Expected Disbursement Window"
              value={s.expected_disbursement_date ?? ""}
              onChange={(v) => set("expected_disbursement_date", v || null)}
              required={false}
              placeholder="e.g. Within 60-90 days after scrutiny"
            />
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold">
                Renewal Conditions (one per line)
                <textarea
                  value={text.renewalConditions}
                  onChange={(e) => setText({ ...text, renewalConditions: e.target.value })}
                  rows={3}
                  className="mt-2 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. Minimum 60% marks in previous year&#10;Minimum 75% biometric attendance&#10;No active backlogs"
                />
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold">
                Renewal Required Documents (one per line)
                <textarea
                  value={text.renewalDocs}
                  onChange={(e) => setText({ ...text, renewalDocs: e.target.value })}
                  rows={3}
                  className="mt-2 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. Previous Semester Grade Card&#10;Bonafide Certificate&#10;Biometric Attendance Certificate"
                />
              </label>
            </div>
          </div>
        </FormSection>

        <div className="flex gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : isNew ? "Add Scholarship" : "Save Changes"}
          </Button>
          <Button variant="outline" onClick={back}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
