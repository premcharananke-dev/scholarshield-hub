// Student-facing Scholarship Discovery: browse, filter, check eligibility, save, and open details.
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, CalendarDays, Check, ExternalLink, FileText, HelpCircle, Search, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { isVisibleTo, matchScholarship, effectiveGender, type Match } from "@/lib/eligibility";
import type { MatchProfile, Scholarship } from "@/lib/types";
import { Button, Card, Chip, Disclaimer, EmptyState, PageTitle, VerdictBadge, prettyDate } from "./ui-kit";

const FILTERS = ["All", "Government", "Private", "Merit-Based", "Need-Based", "Category-Based", "Women-Specific", "Saved"] as const;

export function deadlineLabel(s: Scholarship) {
  if (s.closing_date) return isClosed(s) ? `Closed ${prettyDate(s.closing_date)}` : `Closes ${prettyDate(s.closing_date)}`;
  return "Deadline not verified";
}
export function isClosed(s: Scholarship) {
  return !!s.closing_date && s.closing_date < new Date().toISOString().slice(0, 10);
}
function summary(s: Scholarship) {
  const parts: string[] = [];
  if (s.eligible_gender === "Female") parts.push("Women students");
  if (s.study_levels.length) parts.push(s.study_levels.join("/"));
  if (s.max_income != null) parts.push(`Income ≤ ₹${(s.max_income / 100000).toLocaleString("en-IN")} lakh`);
  if (s.min_percentage != null) parts.push(`${s.min_percentage}%+ marks`);
  if (s.eligible_categories.length) parts.push(s.eligible_categories.join("/"));
  return parts.join(" · ") || "See conditions";
}

export function MatchPanel({ match }: { match: Match }) {
  return <div className="space-y-2">{match.checks.map((c) => <div key={c.label} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg bg-muted/60 p-3">
    <span className={`mt-0.5 grid h-6 w-6 place-items-center rounded-full ${c.status === "pass" ? "bg-success-soft text-success" : c.status === "fail" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"}`}>{c.status === "pass" ? <Check size={14} /> : c.status === "fail" ? <X size={14} /> : <HelpCircle size={14} />}</span>
    <div className="min-w-0"><p className="text-sm font-bold">{c.label}</p><p className="text-xs text-muted-foreground">{c.reason}</p></div>
    <p className="text-right text-xs font-bold">{c.value}</p></div>)}
    {match.checks.length === 0 && <p className="text-sm text-muted-foreground">No profile-based conditions are recorded for this scholarship.</p>}
    {match.manualChecks.length > 0 && <div className="rounded-lg border border-dashed p-3"><p className="text-xs font-extrabold uppercase text-muted-foreground">Also confirm yourself</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{match.manualChecks.map((m) => <li key={m}>{m}</li>)}</ul></div>}
  </div>;
}

type CardProps = { s: Scholarship; profile: MatchProfile; saved: boolean; onSave: () => void; onOpen: () => void; highlight?: boolean };
export function ScholarshipCard({ s, profile, saved, onSave, onOpen, highlight = false }: CardProps) {
  const [showCheck, setShowCheck] = useState(false);
  const match = useMemo(() => matchScholarship(s, profile), [s, profile]);
  return <Card className={`flex flex-col p-5 ${highlight ? "border-secondary/40" : ""}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><div className="flex flex-wrap gap-1.5"><span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-extrabold text-accent-foreground">{s.provider_type.toUpperCase()}</span>{s.tags.map((t) => <span key={t} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${t === "Women-Specific" ? "bg-info-soft text-info" : "bg-muted text-muted-foreground"}`}>{t}</span>)}</div>
        <h3 className="mt-3 font-extrabold leading-snug">{s.name}</h3><p className="mt-1 text-xs text-muted-foreground">{s.provider}</p></div>
      <button onClick={onSave} aria-label={saved ? "Remove from saved" : "Save for later"} className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${saved ? "bg-accent text-primary" : "text-muted-foreground hover:text-primary"}`}>{saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}</button>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-[11px] font-bold uppercase text-muted-foreground">Amount</p><p className="font-extrabold">{s.amount}</p></div><div><p className="text-[11px] font-bold uppercase text-muted-foreground">Deadline</p><p className={`font-extrabold ${isClosed(s) ? "text-danger" : ""}`}>{deadlineLabel(s)}</p></div></div>
    <p className="mt-3 text-xs text-muted-foreground">{summary(s)}</p>
    <div className="mt-3 flex items-center gap-2"><span className="text-xs font-bold text-muted-foreground">Your result:</span><VerdictBadge verdict={match.verdict} /></div>
    {showCheck && <div className="mt-4"><MatchPanel match={match} /></div>}
    <div className="mt-auto grid grid-cols-2 gap-2 pt-4"><Button variant="outline" onClick={() => setShowCheck(!showCheck)}>{showCheck ? "Hide Check" : "Check Eligibility"}</Button><Button onClick={onOpen}>View Details<ArrowRight size={16} /></Button></div>
  </Card>;
}

type ListProps = { scholarships: Scholarship[]; profile: MatchProfile; saved: string[]; onSave: (id: string) => void; onOpen: (id: string) => void };

export function WomenSection({ scholarships, profile, saved, onSave, onOpen, compact = false }: ListProps & { compact?: boolean }) {
  const list = scholarships.filter((s) => s.is_active && s.eligible_gender === "Female");
  if (!list.length) return null;
  return <section className="rounded-lg border border-secondary/30 bg-info-soft/60 p-4 sm:p-6" aria-labelledby="women-title">
    <div className="mb-4 flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground"><Sparkles size={20} /></span><div><h2 id="women-title" className="text-lg font-extrabold tracking-wide">WOMEN EMPOWERMENT SCHOLARSHIPS</h2><p className="mt-1 text-sm text-muted-foreground">Scholarships created to support girls and women in higher education. Each one has its own course, income and marks conditions.</p></div></div>
    <div className="grid gap-4 md:grid-cols-2">{(compact ? list.slice(0, 2) : list).map((s) => <ScholarshipCard key={s.id} s={s} profile={profile} saved={saved.includes(s.id)} onSave={() => onSave(s.id)} onOpen={() => onOpen(s.id)} highlight />)}</div>
  </section>;
}

export function ScholarshipsPage(props: ListProps) {
  const { scholarships, profile, saved, onSave, onOpen } = props;
  const [q, setQ] = useState(""); const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const gender = effectiveGender(profile);
  const visible = scholarships.filter((s) => s.is_active && isVisibleTo(s, profile));
  const filtered = visible.filter((s) => {
    if (q && !s.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "All") return true; if (filter === "Saved") return saved.includes(s.id);
    if (filter === "Government" || filter === "Private") return s.provider_type === filter;
    return s.tags.includes(filter);
  });
  const filters = FILTERS.filter((f) => !(f === "Women-Specific" && gender === "Male"));
  return <div className="animate-rise">
    <PageTitle title="Scholarships" subtitle="Discover scholarships and see how your profile matches each one." />
    {gender === "Female" && filter === "All" && !q && <div className="mb-6"><WomenSection {...props} /></div>}
    <Card className="mb-4 p-4"><label className="relative block"><Search className="absolute left-3 top-3 text-muted-foreground" size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by scholarship name" aria-label="Search scholarships" className="h-11 w-full rounded-lg border bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></label></Card>
    <div className="mb-5 flex gap-2 overflow-x-auto pb-2">{filters.map((f) => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</Chip>)}</div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((s) => <ScholarshipCard key={s.id} s={s} profile={profile} saved={saved.includes(s.id)} onSave={() => onSave(s.id)} onOpen={() => onOpen(s.id)} />)}</div>
    {filtered.length === 0 && <EmptyState title="No scholarships found" text={filter === "Saved" ? "Save scholarships to find them here." : "Try another search or filter."} />}
    <Disclaimer />
  </div>;
}

type DetailsProps = { s: Scholarship; profile: MatchProfile; saved: boolean; onSave: () => void; onApply: () => void; back: () => void; alreadyApplied: boolean };
export function ScholarshipDetails({ s, profile, saved, onSave, onApply, back, alreadyApplied }: DetailsProps) {
  const match = matchScholarship(s, profile); const closed = isClosed(s);
  const unverified = (f: string) => s.unverified_fields.includes(f);
  return <div className="animate-rise">
    <button onClick={back} className="mb-5 flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary"><ArrowLeft size={17} />Back to scholarships</button>
    <Card className="overflow-hidden"><div className={`border-b p-5 sm:p-6 ${s.eligible_gender === "Female" ? "bg-info-soft/70" : "bg-accent/50"}`}>
      <p className="text-xs font-extrabold text-primary">{s.id} · {s.provider_type.toUpperCase()}{s.academic_year ? ` · ${s.academic_year}` : ""}</p>
      <h1 className="mt-2 text-2xl font-extrabold">{s.name}</h1><p className="mt-1 text-sm text-muted-foreground">{s.provider}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">{s.tags.map((t) => <span key={t} className="rounded-full bg-card px-2.5 py-1 text-[10px] font-bold">{t}</span>)}</div></div>
      <div className="grid gap-5 p-5 sm:grid-cols-3 sm:p-6">
        <div><p className="text-xs font-bold uppercase text-muted-foreground">Amount</p><p className="mt-1 font-extrabold">{s.amount}</p>{unverified("amount") && <Unverified />}</div>
        <div><p className="text-xs font-bold uppercase text-muted-foreground">Opens</p><p className="mt-1 font-extrabold">{s.opening_date ? prettyDate(s.opening_date) : "Not verified"}</p>{unverified("opening_date") && <Unverified />}</div>
        <div><p className="text-xs font-bold uppercase text-muted-foreground">Closes</p><p className={`mt-1 font-extrabold ${closed ? "text-danger" : ""}`}>{s.closing_date ? prettyDate(s.closing_date) : "Not verified"}</p>{unverified("closing_date") && <Unverified />}</div>
      </div>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6"><p className="text-sm leading-6">{s.description}</p>{s.benefits && <p className="mt-2 text-sm leading-6 text-muted-foreground"><b className="text-foreground">Benefits:</b> {s.benefits}</p>}</div>
    </Card>
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="p-5"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-extrabold">Your Eligibility Check</h2><VerdictBadge verdict={match.verdict} /></div><MatchPanel match={match} />
        <p className="mt-3 text-xs text-muted-foreground">Based on your saved profile. An eligible result is not an approval or a payment.</p></Card>
      <div className="space-y-5">
        <Card className="p-5"><h2 className="flex items-center gap-2 font-extrabold"><FileText size={18} className="text-primary" />Required Documents</h2><ul className="mt-3 space-y-2 text-sm">{s.documents.map((d) => <li key={d} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-primary" />{d}</li>)}</ul>{!s.documents.length && <p className="mt-3 text-sm text-muted-foreground">Not listed — check the official site.</p>}</Card>
        <Card className="space-y-3 p-5">
          <Button className="w-full" onClick={onApply} disabled={closed || !s.is_active || alreadyApplied}>{alreadyApplied ? "Already applied" : "Apply & Track in ScholarShield"}<ArrowRight size={16} /></Button>
          {s.application_url && <a href={s.application_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-secondary px-4 text-sm font-bold text-secondary-foreground hover:opacity-90">Official Application Website<ExternalLink size={16} /></a>}
          <Button variant="outline" className="w-full" onClick={onSave}>{saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}{saved ? "Saved" : "Save for Later"}</Button>
          {s.source_url && <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary">Official source<ExternalLink size={12} /></a>}
        </Card>
      </div>
    </div>
    {s.verification_note && <div className="mt-5 flex gap-3 rounded-lg border bg-muted/70 p-4"><CalendarDays className="mt-0.5 shrink-0 text-info" size={18} /><p className="text-xs leading-5 text-muted-foreground"><b>Verification note:</b> {s.verification_note}</p></div>}
  </div>;
}
function Unverified() { return <span className="mt-1 inline-block rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-extrabold text-warning">UNVERIFIED</span>; }
