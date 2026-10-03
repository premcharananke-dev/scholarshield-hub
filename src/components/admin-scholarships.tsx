// Admin scholarship management: list, add, edit, deactivate and delete scholarships.
import { ArrowLeft, Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { deleteScholarship, saveScholarship, setScholarshipActive } from "@/lib/data";
import { CATEGORIES, STREAMS, STUDY_LEVELS, TAGS, type Scholarship } from "@/lib/types";
import { Button, Card, Chip, EmptyState, Field, FormSection, PageTitle, SelectField } from "./ui-kit";
import { deadlineLabel, isClosed } from "./scholarships";

const blank = (id: string): Scholarship => ({ id, name: "", provider: "", provider_type: "Government", description: "", tags: [], eligible_gender: "Any", study_levels: [], course_streams: [], eligible_years: [], max_income: null, min_percentage: null, percentage_basis: null, eligible_categories: [], amount: "", benefits: null, documents: [], other_conditions: [], opening_date: null, closing_date: null, academic_year: "2026-27", application_url: null, source_url: null, unverified_fields: [], verification_note: null, is_active: true });

export function AdminScholarships({ scholarships, reload }: { scholarships: Scholarship[]; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState<{ s: Scholarship; isNew: boolean } | null>(null);
  const [q, setQ] = useState("");
  if (editing) return <ScholarshipEditor initial={editing.s} isNew={editing.isNew} existingIds={scholarships.map((s) => s.id)} back={() => setEditing(null)} saved={async () => { await reload(); setEditing(null); }} />;
  const nextId = `SCH-${String(Math.max(0, ...scholarships.map((s) => Number(s.id.split("-")[1]) || 0)) + 1).padStart(3, "0")}`;
  const list = scholarships.filter((s) => !q || `${s.name} ${s.id} ${s.provider}`.toLowerCase().includes(q.toLowerCase()));
  async function toggle(s: Scholarship) {
    if (!confirm(`${s.is_active ? "Deactivate" : "Activate"} "${s.name}"? ${s.is_active ? "Students will no longer see it." : "Students will see it again."}`)) return;
    try { await setScholarshipActive(s.id, !s.is_active); toast.success(s.is_active ? "Scholarship deactivated" : "Scholarship activated"); await reload(); } catch (e) { toast.error((e as Error).message); }
  }
  async function remove(s: Scholarship) {
    if (!confirm(`Permanently delete "${s.name}"? Existing applications keep their record but lose the link. Deactivating is usually safer.`)) return;
    try { await deleteScholarship(s.id); toast.success("Scholarship deleted"); await reload(); } catch (e) { toast.error((e as Error).message); }
  }
  return <div className="animate-rise">
    <PageTitle title="Manage Scholarships" subtitle="Changes here appear in the student portal immediately." action={<Button onClick={() => setEditing({ s: blank(nextId), isNew: true })}><Plus size={17} />Add Scholarship</Button>} />
    <Card className="mb-4 p-4"><label className="relative block"><Search className="absolute left-3 top-3 text-muted-foreground" size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID or provider" aria-label="Search scholarships" className="h-11 w-full rounded-lg border bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></label></Card>
    <div className="space-y-3">{list.map((s) => <Card key={s.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="text-sm">{s.id}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${s.is_active ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}`}>{s.is_active ? "ACTIVE" : "INACTIVE"}</span>{isClosed(s) && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-extrabold text-danger">EXPIRED</span>}{s.eligible_gender === "Female" && <span className="rounded-full bg-info-soft px-2 py-0.5 text-[10px] font-extrabold text-info">WOMEN</span>}</div>
        <p className="mt-1 truncate font-extrabold">{s.name}</p><p className="text-xs text-muted-foreground">{s.provider} · {deadlineLabel(s)}</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setEditing({ s, isNew: false })} ariaLabel={`Edit ${s.name}`}><Pencil size={16} />Edit</Button><Button variant="outline" onClick={() => toggle(s)} ariaLabel={`${s.is_active ? "Deactivate" : "Activate"} ${s.name}`}><Power size={16} />{s.is_active ? "Deactivate" : "Activate"}</Button><Button variant="ghost" onClick={() => remove(s)} ariaLabel={`Delete ${s.name}`}><Trash2 size={16} /></Button></div>
    </Card>)}{list.length === 0 && <EmptyState title="No scholarships" />}</div>
  </div>;
}

const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);
const toggleIn = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

function ScholarshipEditor({ initial, isNew, existingIds, back, saved }: { initial: Scholarship; isNew: boolean; existingIds: string[]; back: () => void; saved: () => Promise<void> }) {
  const [s, setS] = useState(initial);
  const [text, setText] = useState({ documents: initial.documents.join("\n"), other: initial.other_conditions.join("\n"), income: initial.max_income?.toString() ?? "", pct: initial.min_percentage?.toString() ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  const set = <K extends keyof Scholarship>(k: K, v: Scholarship[K]) => setS({ ...s, [k]: v });
  const MultiChips = <T extends string | number>({ label, options, value, onChange }: { label: string; options: readonly T[]; value: T[]; onChange: (v: T[]) => void }) =>
    <div><p className="text-sm font-bold">{label} <span className="font-medium text-muted-foreground">(none selected = any)</span></p><div className="mt-2 flex flex-wrap gap-2">{options.map((o) => <Chip key={String(o)} active={value.includes(o)} onClick={() => onChange(toggleIn(value, o))}>{String(o)}</Chip>)}</div></div>;

  async function submit(e: FormEvent) {
    e.preventDefault(); const err: Record<string, string> = {};
    if (!/^SCH-\d{3,}$/.test(s.id)) err["id"] = "Use the format SCH-010";
    else if (isNew && existingIds.includes(s.id)) err["id"] = "This ID already exists";
    if (!s.name.trim()) err["name"] = "Name is required"; if (!s.provider.trim()) err["provider"] = "Provider is required";
    if (!s.amount.trim()) err["amount"] = "Enter the amount, or 'Unverified'";
    for (const k of ["application_url", "source_url"] as const) if (s[k] && !/^https:\/\/\S+$/.test(s[k] ?? "")) err[k] = "Must start with https://";
    if (text.income && (isNaN(+text.income) || +text.income < 0)) err["income"] = "Enter a valid amount";
    if (text.pct && (isNaN(+text.pct) || +text.pct < 0 || +text.pct > 100)) err["pct"] = "Enter 0–100";
    if (s.opening_date && s.closing_date && s.closing_date < s.opening_date) err["closing"] = "Closing date must be after opening date";
    setErrors(err); if (Object.keys(err).length) return toast.error("Please fix the highlighted fields");
    setBusy(true);
    try {
      const unverified = s.unverified_fields.filter((f) => !((f === "opening_date" && s.opening_date) || (f === "closing_date" && s.closing_date)));
      await saveScholarship({ ...s, name: s.name.trim(), provider: s.provider.trim(), documents: lines(text.documents), other_conditions: lines(text.other), max_income: text.income ? +text.income : null, min_percentage: text.pct ? +text.pct : null, unverified_fields: unverified, application_url: s.application_url || null, source_url: s.source_url || null }, isNew);
      toast.success(isNew ? "Scholarship added" : "Scholarship updated"); await saved();
    } catch (e2) { toast.error((e2 as Error).message); } finally { setBusy(false); }
  }
  return <div className="animate-rise"><button onClick={back} className="mb-5 flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary"><ArrowLeft size={17} />Back to scholarships</button>
    <PageTitle title={isNew ? "Add Scholarship" : `Edit ${s.id}`} subtitle="Only enter details confirmed on the official website. Mark anything else as unverified." />
    <form onSubmit={submit} className="space-y-5">
      <FormSection title="Basic Details" icon={<Pencil size={18} />}><div className="grid gap-4 sm:grid-cols-2">
        <Field label="Scholarship ID" value={s.id} onChange={(v) => isNew && set("id", v.toUpperCase())} error={errors["id"]} />
        <Field label="Scholarship Name" value={s.name} onChange={(v) => set("name", v)} error={errors["name"]} />
        <Field label="Provider / Organisation" value={s.provider} onChange={(v) => set("provider", v)} error={errors["provider"]} />
        <SelectField label="Provider Type" value={s.provider_type} onChange={(v) => set("provider_type", v as Scholarship["provider_type"])} options={["Government", "Private"]} />
        <div className="sm:col-span-2"><label className="block text-sm font-bold">Description<textarea value={s.description} onChange={(e) => set("description", e.target.value)} rows={3} className="mt-2 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></label></div>
        <Field label="Amount" value={s.amount} onChange={(v) => set("amount", v)} error={errors["amount"]} placeholder="e.g. ₹50,000 per year" />
        <Field label="Benefits" value={s.benefits ?? ""} onChange={(v) => set("benefits", v || null)} required={false} />
        <div className="sm:col-span-2"><MultiChips label="Scholarship Categories" options={TAGS} value={s.tags} onChange={(v) => set("tags", v)} /></div>
      </div></FormSection>
      <FormSection title="Eligibility Conditions" icon={<Search size={18} />}><div className="grid gap-5">
        <SelectField label="Eligible Gender" value={s.eligible_gender} onChange={(v) => set("eligible_gender", v as Scholarship["eligible_gender"])} options={["Any", "Female"]} />
        <MultiChips label="Study Levels" options={STUDY_LEVELS} value={s.study_levels} onChange={(v) => set("study_levels", v)} />
        <MultiChips label="Course Streams" options={STREAMS} value={s.course_streams} onChange={(v) => set("course_streams", v)} />
        <MultiChips label="Year of Study" options={[1, 2, 3, 4, 5]} value={s.eligible_years} onChange={(v) => set("eligible_years", v)} />
        <MultiChips label="Eligible Categories" options={CATEGORIES} value={s.eligible_categories} onChange={(v) => set("eligible_categories", v)} />
        <div className="grid gap-4 sm:grid-cols-3"><Field label="Max Family Income (₹)" type="number" value={text.income} onChange={(v) => setText({ ...text, income: v })} required={false} error={errors["income"]} /><Field label="Min Academic %" type="number" value={text.pct} onChange={(v) => setText({ ...text, pct: v })} required={false} error={errors["pct"]} /><Field label="Marks Basis" value={s.percentage_basis ?? ""} onChange={(v) => set("percentage_basis", v || null)} required={false} placeholder="e.g. Class 12" /></div>
        <label className="block text-sm font-bold">Other conditions (one per line)<textarea value={text.other} onChange={(e) => setText({ ...text, other: e.target.value })} rows={3} className="mt-2 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></label>
        <label className="block text-sm font-bold">Required documents (one per line)<textarea value={text.documents} onChange={(e) => setText({ ...text, documents: e.target.value })} rows={4} className="mt-2 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></label>
      </div></FormSection>
      <FormSection title="Dates, Links & Verification" icon={<Power size={18} />}><div className="grid gap-4 sm:grid-cols-2">
        <Field label="Opening Date" type="date" value={s.opening_date ?? ""} onChange={(v) => set("opening_date", v || null)} required={false} />
        <Field label="Closing Date" type="date" value={s.closing_date ?? ""} onChange={(v) => set("closing_date", v || null)} required={false} error={errors["closing"]} />
        <Field label="Academic Year" value={s.academic_year ?? ""} onChange={(v) => set("academic_year", v || null)} required={false} />
        <SelectField label="Status" value={s.is_active ? "Active" : "Inactive"} onChange={(v) => set("is_active", v === "Active")} options={["Active", "Inactive"]} />
        <Field label="Official Application URL" value={s.application_url ?? ""} onChange={(v) => set("application_url", v)} required={false} error={errors["application_url"]} />
        <Field label="Official Source URL" value={s.source_url ?? ""} onChange={(v) => set("source_url", v)} required={false} error={errors["source_url"]} />
        <div className="sm:col-span-2"><MultiChips label="Mark as unverified" options={["amount", "opening_date", "closing_date", "eligibility"]} value={s.unverified_fields} onChange={(v) => set("unverified_fields", v)} /></div>
        <div className="sm:col-span-2"><Field label="Verification Note" value={s.verification_note ?? ""} onChange={(v) => set("verification_note", v || null)} required={false} /></div>
      </div></FormSection>
      <div className="flex gap-3"><Button type="submit" disabled={busy}>{busy ? "Saving…" : isNew ? "Add Scholarship" : "Save Changes"}</Button><Button variant="outline" onClick={back}>Cancel</Button></div>
    </form></div>;
}
