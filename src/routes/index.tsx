// ScholarShield — single-page student & admin portal.
// Data lives in Lovable Cloud (see src/lib/data.ts); eligibility logic lives in src/lib/eligibility.ts.
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft, ArrowRight, Award, BadgeCheck, BookOpen, Check, ChevronRight, CircleDollarSign, Clock3, FileCheck2,
  FileText, GraduationCap, HelpCircle, Home, Info, LayoutDashboard, Lock, LogOut, ShieldCheck, UserRound, WalletCards, X, XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ensureDemoAccounts } from "@/lib/demo-accounts.functions";
import * as api from "@/lib/data";
import { formatMoney, isVisibleTo, matchScholarship, sha256 } from "@/lib/eligibility";
import { CATEGORIES, GENDERS, STREAMS, STUDY_LEVELS, type Application, type Disbursement, type MatchProfile, type Profile, type Role, type Scholarship, type Status } from "@/lib/types";
import { Brand, Button, Card, Chip, DetailGroup, Disclaimer, EmptyState, Field, FormSection, InfoItem, PageTitle, SelectField, StatusBadge, VerdictBadge, prettyDate } from "@/components/ui-kit";
import { ScholarshipCard, ScholarshipDetails, ScholarshipsPage, WomenSection, isClosed } from "@/components/scholarships";
import { AdminScholarships } from "@/components/admin-scholarships";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "ScholarShield — Scholarship Discovery, Eligibility & Disbursement" },
    { name: "description", content: "Discover verified scholarships, check eligibility against your profile, apply and track review and disbursement." },
    { property: "og:title", content: "ScholarShield — Scholarship Discovery & Tracking" },
    { property: "og:description", content: "Find scholarships including Women Empowerment Scholarships, check eligibility and track your application." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ScholarShield,
});

type View = "home" | "scholarships" | "scholarship" | "apply" | "applications" | "details" | "result" | "profile" | "admin-scholarships";
const DEMO_EMAILS = ["student@scholarshield.com", "admin@scholarshield.com"];
const PENDING: Status[] = ["SUBMITTED", "ELIGIBILITY VERIFIED", "NOT ELIGIBLE", "UNDER REVIEW"];
const today = () => new Date().toISOString().slice(0, 10);
const getDisb = (a: Application): Disbursement | null => (Array.isArray(a.disbursements) ? a.disbursements[0] ?? null : a.disbursements ?? null);
const emptyProfile = (id: string, email: string): Profile => ({ id, full_name: "", student_id: null, email, phone: null, college: null, department: null, course: null, course_stream: null, study_level: null, year_of_study: null, gender: null, use_gender_for_matching: true, academic_percentage: null, family_income: null, category: null });

function ScholarShield() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [role, setRole] = useState<Role>("student");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [view, setView] = useState<View>("home");
  const [appId, setAppId] = useState<string>();
  const [schId, setSchId] = useState<string>();
  const [about, setAbout] = useState(false);

  const load = useCallback(async (u: { id: string; email: string }) => {
    try {
      const [r, p, a, s] = await Promise.all([api.getRole(u.id), api.getProfile(u.id), api.listApplications(), api.listScholarships()]);
      setRole(r); setProfile(p ?? emptyProfile(u.id, u.email)); setApps(a); setScholarships(s);
      setSaved(r === "student" ? await api.listSaved(u.id) : []);
    } catch (e) { toast.error(`Could not load data: ${(e as Error).message}`); }
  }, []);
  const reload = useCallback(async () => { if (user) await load(user); }, [user, load]);

  useEffect(() => {
    const apply = async (session: { user: { id: string; email?: string | undefined } } | null) => {
      if (session) { const u = { id: session.user.id, email: session.user.email ?? "" }; setUser(u); await load(u); }
      else { setUser(null); setProfile(null); setApps([]); }
      setReady(true);
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") { setView("home"); void apply(session); }
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  // Refresh data when navigating so admin changes reach students without a manual reload.
  function go(v: View) { setView(v); window.scrollTo({ top: 0 }); void reload(); }
  function openApp(id: string, v: View = "details") { setAppId(id); setView(v); window.scrollTo({ top: 0 }); }
  function openSch(id: string) { setSchId(id); setView("scholarship"); window.scrollTo({ top: 0 }); }
  async function logout() { await supabase.auth.signOut(); }
  async function toggleSave(id: string) {
    if (!user) return; const isSaved = saved.includes(id);
    try { await api.toggleSaved(user.id, id, isSaved); setSaved(isSaved ? saved.filter((x) => x !== id) : [...saved, id]); toast.success(isSaved ? "Removed from saved" : "Saved for later"); } catch (e) { toast.error((e as Error).message); }
  }

  if (!ready) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading ScholarShield…</div>;
  if (!user || !profile) return about ? <AboutPage back={() => setAbout(false)} /> : <AuthScreen onAbout={() => setAbout(true)} />;

  const selectedApp = apps.find((a) => a.id === appId);
  const selectedSch = scholarships.find((s) => s.id === schId);
  let content: ReactNode;
  if (role === "admin") {
    content = <AdminArea view={view} go={go} apps={apps} scholarships={scholarships} selected={selectedApp} openApp={openApp} logout={logout} reload={reload} adminId={user.id} />;
  } else {
    const mine = apps.filter((a) => a.user_id === user.id);
    const common = { scholarships, profile, saved, onSave: toggleSave, onOpen: openSch };
    if (view === "scholarships") content = <ScholarshipsPage {...common} />;
    else if (view === "scholarship" && selectedSch) content = <ScholarshipDetails s={selectedSch} profile={profile} saved={saved.includes(selectedSch.id)} onSave={() => toggleSave(selectedSch.id)} back={() => go("scholarships")} alreadyApplied={mine.some((a) => a.scholarship_id === selectedSch.id)} onApply={() => { setSchId(selectedSch.id); go("apply"); }} />;
    else if (view === "apply") content = <ApplicationForm profile={profile} scholarships={scholarships} initialScholarship={schId} onDone={async (id) => { await reload(); openApp(id, "result"); }} />;
    else if (view === "applications") content = <ApplicationsList apps={mine} openApp={openApp} />;
    else if ((view === "details" || view === "result") && selectedApp) content = <ApplicationDetails app={selectedApp} resultOnly={view === "result"} back={() => go("applications")} />;
    else if (view === "profile") content = <ProfilePage profile={profile} apps={mine} scholarships={scholarships} saved={saved} openApp={openApp} openSch={openSch} logout={logout} onSaved={reload} />;
    else content = <StudentHome apps={mine} go={go} openApp={openApp} {...common} />;
  }
  return <AppShell role={role} profile={profile} view={view} go={go} logout={logout}>{content}</AppShell>;
}

/* ---------------- Authentication ---------------- */
function AuthScreen({ onAbout }: { onAbout: () => void }) {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [sign, setSign] = useState({ name: "", studentId: "", email: "", password: "", college: "", course: "", stream: "", level: "", year: "", gender: "", useGender: true });

  async function demo(which: "student" | "admin") {
    setEmail(`${which}@scholarshield.com`); setPassword("scholar123");
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      if (tab === "signin") {
        if (DEMO_EMAILS.includes(email.trim().toLowerCase())) await ensureDemoAccounts();
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) setError(err.message === "Invalid login credentials" ? "Incorrect email or password." : err.message);
        return;
      }
      if (!sign.name.trim() || !sign.studentId.trim() || !/^\S+@\S+\.\S+$/.test(sign.email) || !sign.college.trim() || !sign.course.trim() || !sign.stream || !sign.level || !sign.year) { setError("Complete every required field."); return; }
      if (sign.password.length < 8) { setError("Password must contain at least 8 characters."); return; }
      const { data, error: err } = await supabase.auth.signUp({ email: sign.email.trim().toLowerCase(), password: sign.password, options: { emailRedirectTo: window.location.origin } });
      if (err || !data.user) { setError(err?.message ?? "Could not create the account."); return; }
      if (!data.session) { setError("Account created. Please check your email to confirm, then sign in."); return; }
      await api.saveProfile({ id: data.user.id, full_name: sign.name.trim(), student_id: sign.studentId.trim(), email: sign.email.trim().toLowerCase(), college: sign.college.trim(), course: sign.course.trim(), course_stream: sign.stream, study_level: sign.level, year_of_study: Number(sign.year), gender: sign.gender || null, use_gender_for_matching: sign.useGender });
      // Reload so the newly created profile is picked up.
      window.location.reload();
    } catch (e2) { setError((e2 as Error).message); } finally { setBusy(false); }
  }
  return <main className="min-h-screen px-4 py-8 sm:py-12"><div className="mx-auto max-w-md animate-rise">
    <div className="mb-7 text-center"><div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-card"><ShieldCheck size={34} /></div><h1 className="text-3xl font-extrabold">SCHOLAR<span className="text-primary">SHIELD</span></h1><p className="mt-2 text-sm text-muted-foreground">Scholarship Discovery, Eligibility & Disbursement</p></div>
    <Card className="p-5 sm:p-7"><div className="mb-6 grid grid-cols-2 rounded-lg bg-muted p-1">{(["signin", "signup"] as const).map((t) => <button key={t} onClick={() => { setTab(t); setError(""); }} className={`rounded-md py-2.5 text-sm font-bold ${tab === t ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>{t === "signin" ? "Sign In" : "Sign Up"}</button>)}</div>
      <form onSubmit={submit} className="space-y-4">{tab === "signin" ? <><Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@college.edu" /><Field label="Password" type="password" value={password} onChange={setPassword} placeholder="Enter password" /></> : <>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Full Name" value={sign.name} onChange={(v) => setSign({ ...sign, name: v })} /><Field label="Student ID" value={sign.studentId} onChange={(v) => setSign({ ...sign, studentId: v })} /></div>
        <Field label="Email" type="email" value={sign.email} onChange={(v) => setSign({ ...sign, email: v })} /><Field label="Password" type="password" value={sign.password} onChange={(v) => setSign({ ...sign, password: v })} hint="At least 8 characters" />
        <Field label="College" value={sign.college} onChange={(v) => setSign({ ...sign, college: v })} /><Field label="Course" value={sign.course} onChange={(v) => setSign({ ...sign, course: v })} placeholder="e.g. B.Tech Civil Engineering" />
        <div className="grid gap-4 sm:grid-cols-2"><SelectField label="Course Stream" value={sign.stream} onChange={(v) => setSign({ ...sign, stream: v })} options={STREAMS} /><SelectField label="Study Level" value={sign.level} onChange={(v) => setSign({ ...sign, level: v })} options={STUDY_LEVELS} /><SelectField label="Year of Study" value={sign.year} onChange={(v) => setSign({ ...sign, year: v })} options={["1", "2", "3", "4", "5"]} /><SelectField label="Gender (optional)" required={false} value={sign.gender} onChange={(v) => setSign({ ...sign, gender: v })} options={GENDERS} /></div>
        <GenderPrivacy checked={sign.useGender} onChange={(v) => setSign({ ...sign, useGender: v })} />
      </>}
        {error && <div role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : tab === "signin" ? "Sign In" : "Create Student Account"}<ArrowRight size={17} /></Button></form>
      {tab === "signin" && <><div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />DEMO ACCESS<span className="h-px flex-1 bg-border" /></div><div className="grid grid-cols-2 gap-3"><Button variant="outline" onClick={() => demo("student")}><GraduationCap size={17} />Student</Button><Button variant="outline" onClick={() => demo("admin")}><ShieldCheck size={17} />Admin</Button></div></>}
    </Card><button onClick={onAbout} className="mx-auto mt-5 flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"><Info size={16} />About ScholarShield</button></div></main>;
}
function GenderPrivacy({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-start gap-3 rounded-lg border bg-muted/50 p-3 text-xs"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" /><span><b className="flex items-center gap-1 text-sm"><Lock size={13} />Use my gender for scholarship matching</b><span className="mt-1 block text-muted-foreground">Gender is private: only you and scholarship administrators can see it, and it is used only to match gender-specific scholarships.</span></span></label>;
}

/* ---------------- Layout ---------------- */
function AppShell({ role, profile, view, go, logout, children }: { role: Role; profile: Profile; view: View; go: (v: View) => void; logout: () => void; children: ReactNode }) {
  const admin = role === "admin";
  const nav = admin
    ? [{ v: "home" as View, l: "Dashboard", i: LayoutDashboard }, { v: "applications" as View, l: "Applications", i: FileText }, { v: "admin-scholarships" as View, l: "Scholarships", i: Award }, { v: "profile" as View, l: "Profile", i: UserRound }]
    : [{ v: "home" as View, l: "Home", i: Home }, { v: "scholarships" as View, l: "Scholarships", i: Award }, { v: "apply" as View, l: "Apply", i: FileCheck2 }, { v: "applications" as View, l: "Applications", i: FileText }, { v: "profile" as View, l: "Profile", i: UserRound }];
  const active = (v: View) => view === v || (v === "scholarships" && view === "scholarship") || (v === "applications" && (view === "details" || view === "result"));
  return <div className="min-h-screen md:grid md:grid-cols-[248px_minmax(0,1fr)]">
    <aside className="hidden border-r bg-card p-5 md:sticky md:top-0 md:flex md:h-screen md:flex-col"><Brand /><div className="mt-9 space-y-2">{nav.map((n) => <button key={n.v} onClick={() => go(n.v)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold ${active(n.v) ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"} ${n.v === "apply" && !active(n.v) ? "text-primary" : ""}`}><n.i size={19} />{n.l}</button>)}</div><div className="mt-auto"><button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-danger"><LogOut size={18} />Sign Out</button></div></aside>
    <div className="min-w-0"><header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center border-b bg-background/95 px-4 py-3 backdrop-blur md:px-8"><div className="md:hidden"><Brand compact /></div><div className="hidden min-w-0 md:block"><p className="truncate text-sm font-bold">{admin ? "ScholarShield Admin" : profile.full_name || "Student Portal"}</p><p className="text-xs text-muted-foreground">{admin ? "Scholarships, review & disbursement" : profile.student_id}</p></div><span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${admin ? "bg-info-soft text-info" : "bg-accent text-accent-foreground"}`}>{admin ? "ADMIN" : "STUDENT"}</span></header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 md:px-8 md:py-8 md:pb-8">{children}</main></div>
    <nav className={`fixed inset-x-0 bottom-0 z-30 grid ${admin ? "grid-cols-4" : "grid-cols-5"} border-t bg-card px-1 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden`}>{nav.map((n) => <button key={n.v} onClick={() => go(n.v)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-bold ${active(n.v) ? "text-primary" : "text-muted-foreground"} ${n.v === "apply" ? "relative -mt-5" : ""}`}>{n.v === "apply" ? <span className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-card"><n.i size={22} /></span> : <n.i size={20} />}<span>{n.l}</span></button>)}</nav></div>;
}

/* ---------------- Student ---------------- */
function missingProfileFields(p: Profile) {
  const m: string[] = [];
  if (!p.course_stream) m.push("course stream"); if (!p.study_level) m.push("study level"); if (!p.year_of_study) m.push("year of study");
  if (p.academic_percentage == null) m.push("academic percentage"); if (p.family_income == null) m.push("family income"); if (!p.category) m.push("category");
  return m;
}
type HomeProps = { profile: Profile; apps: Application[]; go: (v: View) => void; openApp: (id: string) => void; scholarships: Scholarship[]; saved: string[]; onSave: (id: string) => void; onOpen: (id: string) => void };
function StudentHome({ profile, apps, go, openApp, scholarships, saved, onSave, onOpen }: HomeProps) {
  const latest = apps[0]; const female = profile.use_gender_for_matching && profile.gender === "Female";
  const missing = missingProfileFields(profile);
  const recommended = scholarships.filter((s) => s.is_active && !isClosed(s) && isVisibleTo(s, profile) && matchScholarship(s, profile).verdict === "Eligible").slice(0, 3);
  return <div className="animate-rise space-y-6">
    <PageTitle title="Scholarship Dashboard" subtitle="Your applications and scholarships that match your profile." />
    {female && <WomenSection scholarships={scholarships} profile={profile} saved={saved} onSave={onSave} onOpen={onOpen} compact />}
    {missing.length > 0 && <Card className="flex flex-wrap items-center justify-between gap-3 border-warning p-4"><div className="flex gap-3"><HelpCircle className="mt-0.5 shrink-0 text-warning" size={20} /><div><p className="font-extrabold">Complete your profile for accurate matching</p><p className="text-sm text-muted-foreground">Missing: {missing.join(", ")}.</p></div></div><Button variant="outline" onClick={() => go("profile")}>Update Profile</Button></Card>}
    {latest ? <Card className="overflow-hidden"><div className="border-b bg-accent/50 p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs font-extrabold text-primary">APPLICATION STATUS</p><h2 className="mt-2 text-xl font-extrabold">{latest.scholarship_name}</h2></div><StatusBadge status={latest.status} /></div></div><div className="grid gap-5 p-5 sm:grid-cols-3 sm:p-6"><InfoItem label="Application ID" value={latest.id} /><InfoItem label="Submitted" value={prettyDate(latest.submitted_at)} /><InfoItem label="Eligibility" value={latest.eligible ? "Eligible" : "Not Eligible"} /></div><div className="px-5 pb-5 sm:px-6 sm:pb-6"><Button onClick={() => openApp(latest.id)}>View & Track Application<ArrowRight size={17} /></Button></div></Card>
      : <Card className="p-6 text-center sm:p-10"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent text-primary"><FileCheck2 size={28} /></div><h2 className="mt-4 text-xl font-extrabold">Scholarship Application</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Find a scholarship, check your eligibility, then apply and track it here.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Button onClick={() => go("scholarships")}>Browse Scholarships<ArrowRight size={17} /></Button><Button variant="outline" onClick={() => go("apply")}>Apply Now</Button></div></Card>}
    <section><div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">Recommended for You</h2><p className="text-sm text-muted-foreground">Open scholarships where your profile meets every recorded condition.</p></div><Button variant="outline" onClick={() => go("scholarships")}>View All<ArrowRight size={16} /></Button></div>
      {recommended.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{recommended.map((s) => <ScholarshipCard key={s.id} s={s} profile={profile} saved={saved.includes(s.id)} onSave={() => onSave(s.id)} onOpen={() => onOpen(s.id)} />)}</div>
        : <EmptyState title="No full matches yet" text={missing.length ? "Complete your profile to get recommendations." : "Browse all scholarships to see what each one needs."} />}</section>
    <Disclaimer />
  </div>;
}

function ApplicationForm({ profile, scholarships, initialScholarship, onDone }: { profile: Profile; scholarships: Scholarship[]; initialScholarship?: string | undefined; onDone: (id: string) => Promise<void> }) {
  const open = scholarships.filter((s) => s.is_active && !isClosed(s) && isVisibleTo(s, profile));
  const [form, setForm] = useState({
    name: profile.full_name, studentId: profile.student_id ?? "", email: profile.email, phone: profile.phone ?? "", college: profile.college ?? "", course: profile.course ?? "",
    stream: profile.course_stream ?? "", level: profile.study_level ?? "", year: profile.year_of_study?.toString() ?? "", academicYear: "2026-27",
    academic: profile.academic_percentage?.toString() ?? "", attendance: "", income: profile.family_income?.toString() ?? "", category: profile.category ?? "", gender: profile.gender ?? "",
    scholarshipId: open.some((s) => s.id === initialScholarship) ? initialScholarship ?? "" : "", confirm: false, saveToProfile: true,
  });
  const [docs, setDocs] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string | boolean) => setForm({ ...form, [k]: v });
  const sch = open.find((s) => s.id === form.scholarshipId);
  const matchInput: MatchProfile = { gender: form.gender || null, use_gender_for_matching: true, course_stream: form.stream || null, study_level: form.level || null, year_of_study: form.year ? Number(form.year) : null, academic_percentage: form.academic === "" ? null : Number(form.academic), family_income: form.income === "" ? null : Number(form.income), category: form.category || null };
  const preview = sch ? matchScholarship(sch, matchInput) : null;

  async function submit(e: FormEvent) {
    e.preventDefault(); const n: Record<string, string> = {};
    if (!form.name.trim()) n["name"] = "Full name is required"; if (!form.studentId.trim()) n["studentId"] = "Student ID is required";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) n["email"] = "Enter a valid email"; if (!/^\d{10}$/.test(form.phone)) n["phone"] = "Enter a 10-digit phone number";
    if (!form.college.trim()) n["college"] = "College is required"; if (!form.course.trim()) n["course"] = "Course is required";
    if (!form.stream) n["stream"] = "Select a course stream"; if (!form.level) n["level"] = "Select a study level"; if (!form.year) n["year"] = "Select a year";
    if (!/^\d{4}-\d{2}$/.test(form.academicYear)) n["academicYear"] = "Use the format 2026-27";
    if (form.academic === "" || +form.academic < 0 || +form.academic > 100) n["academic"] = "Enter a value from 0 to 100";
    if (form.attendance === "" || +form.attendance < 0 || +form.attendance > 100) n["attendance"] = "Enter a value from 0 to 100";
    if (form.income === "" || +form.income < 0) n["income"] = "Enter a valid annual income";
    if (!form.category) n["category"] = "Select a category"; if (!sch) n["scholarship"] = "Select a scholarship";
    if (!form.confirm) n["confirm"] = "You must confirm the information";
    setErrors(n); if (Object.keys(n).length || !sch || !preview) { toast.error("Please fix the highlighted fields"); return; }
    setBusy(true);
    try {
      const fp = await sha256([form.studentId, form.email, sch.id, form.academicYear].map((v) => v.trim().toLowerCase()).join("|"));
      const eligible = preview.verdict === "Eligible";
      const id = await api.submitApplication({
        user_id: profile.id, scholarship_id: sch.id, scholarship_name: sch.name, full_name: form.name.trim(), student_id: form.studentId.trim(), email: form.email.trim().toLowerCase(),
        phone: form.phone, college: form.college.trim(), course: form.course.trim(), course_stream: form.stream, study_level: form.level, department: profile.department,
        year_of_study: Number(form.year), academic_year: form.academicYear, academic_percentage: +form.academic, attendance: +form.attendance, family_income: +form.income,
        category: form.category, gender: form.gender || null, status: eligible ? "ELIGIBILITY VERIFIED" : "NOT ELIGIBLE", eligible, rules: preview.checks, fingerprint: fp,
      }, sch.documents.map((d) => ({ name: d, provided: !!docs[d] })));
      if (form.saveToProfile) await api.saveProfile({ id: profile.id, full_name: form.name.trim(), student_id: form.studentId.trim(), phone: form.phone, college: form.college.trim(), course: form.course.trim(), course_stream: form.stream, study_level: form.level, year_of_study: Number(form.year), academic_percentage: +form.academic, family_income: +form.income, category: form.category, gender: form.gender || null, email: profile.email, use_gender_for_matching: profile.use_gender_for_matching });
      toast.success(`Application ${id} submitted`); await onDone(id);
    } catch (e2) { toast.error((e2 as Error).message); } finally { setBusy(false); }
  }
  return <div className="animate-rise"><PageTitle title="Scholarship Application" subtitle="Details from your profile are filled in. Check each section carefully." />
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormSection title="Scholarship" icon={<Award size={19} />}><SelectField label="Scholarship" value={sch?.name ?? ""} onChange={(v) => { set("scholarshipId", open.find((s) => s.name === v)?.id ?? ""); setDocs({}); }} options={open.map((s) => s.name)} error={errors["scholarship"]} placeholder="Select a scholarship" />
        {sch && <p className="mt-2 text-sm font-bold">{sch.name}<span className="block text-xs font-medium text-muted-foreground">{sch.provider} · {sch.amount}</span></p>}</FormSection>
      <FormSection title="Personal Details" icon={<UserRound size={19} />}><div className="grid gap-4 sm:grid-cols-2"><Field label="Full Name" value={form.name} onChange={(v) => set("name", v)} error={errors["name"]} /><Field label="Student ID" value={form.studentId} onChange={(v) => set("studentId", v)} error={errors["studentId"]} /><Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} error={errors["email"]} /><Field label="Phone Number" inputMode="numeric" value={form.phone} onChange={(v) => set("phone", v.replace(/\D/g, "").slice(0, 10))} error={errors["phone"]} /><SelectField label="Gender" required={false} value={form.gender} onChange={(v) => set("gender", v)} options={GENDERS} placeholder="Not provided" /></div></FormSection>
      <FormSection title="Academic Details" icon={<BookOpen size={19} />}><div className="grid gap-4 sm:grid-cols-2"><Field label="College" value={form.college} onChange={(v) => set("college", v)} error={errors["college"]} /><Field label="Course" value={form.course} onChange={(v) => set("course", v)} error={errors["course"]} /><SelectField label="Course Stream" value={form.stream} onChange={(v) => set("stream", v)} options={STREAMS} error={errors["stream"]} /><SelectField label="Study Level" value={form.level} onChange={(v) => set("level", v)} options={STUDY_LEVELS} error={errors["level"]} /><SelectField label="Year of Study" value={form.year} onChange={(v) => set("year", v)} options={["1", "2", "3", "4", "5"]} error={errors["year"]} /><Field label="Academic Year" value={form.academicYear} onChange={(v) => set("academicYear", v)} error={errors["academicYear"]} /><Field label="Academic Percentage" type="number" value={form.academic} onChange={(v) => set("academic", v)} error={errors["academic"]} /><Field label="Attendance Percentage" type="number" value={form.attendance} onChange={(v) => set("attendance", v)} error={errors["attendance"]} /></div></FormSection>
      <FormSection title="Financial & Category" icon={<CircleDollarSign size={19} />}><div className="grid gap-4 sm:grid-cols-2"><Field label="Annual Family Income (₹)" type="number" value={form.income} onChange={(v) => set("income", v)} error={errors["income"]} /><SelectField label="Category" value={form.category} onChange={(v) => set("category", v)} options={CATEGORIES} error={errors["category"]} /></div></FormSection>
      {sch && sch.documents.length > 0 && <FormSection title="Required Documents" icon={<FileText size={19} />}><p className="mb-3 text-sm text-muted-foreground">Tick the documents you have ready. The administrator verifies them during review.</p><div className="space-y-2">{sch.documents.map((d) => <label key={d} className="flex items-center gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={!!docs[d]} onChange={(e) => setDocs({ ...docs, [d]: e.target.checked })} className="h-4 w-4 accent-primary" />{d}</label>)}</div></FormSection>}
      {preview && <Card className="p-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-extrabold">Eligibility Preview</h2><VerdictBadge verdict={preview.verdict} /></div><RuleList rules={preview.checks} /></Card>}
      <label className="flex items-start gap-3 rounded-lg border bg-card p-4 text-sm"><input type="checkbox" checked={form.saveToProfile} onChange={(e) => set("saveToProfile", e.target.checked)} className="mt-1 h-4 w-4 accent-primary" /><span>Save these details to my profile for future matching</span></label>
      <label className="flex items-start gap-3 rounded-lg border bg-card p-4 text-sm"><input type="checkbox" checked={form.confirm} onChange={(e) => set("confirm", e.target.checked)} className="mt-1 h-4 w-4 accent-primary" /><span><b>I confirm that the information provided is correct.</b>{errors["confirm"] && <span className="mt-1 block text-danger">{errors["confirm"]}</span>}</span></label>
      <Button type="submit" className="w-full sm:w-auto" disabled={busy}>{busy ? "Submitting…" : "Submit Application"}<ArrowRight size={17} /></Button></form><Disclaimer /></div>;
}

function RuleList({ rules }: { rules: Application["rules"] }) {
  return <div className="divide-y rounded-lg border">{rules.map((r) => <div key={r.label} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 p-4">
    <span className={`mt-0.5 grid h-7 w-7 place-items-center rounded-full ${r.status === "pass" ? "bg-success-soft text-success" : r.status === "fail" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"}`}>{r.status === "pass" ? <Check size={16} /> : r.status === "fail" ? <X size={16} /> : <HelpCircle size={16} />}</span>
    <div className="min-w-0"><p className="font-bold">{r.label}</p><p className="mt-1 text-xs text-muted-foreground">{r.reason}</p></div>
    <div className="text-right"><p className="text-sm font-bold">{r.value}</p><span className={`text-[11px] font-extrabold ${r.status === "pass" ? "text-success" : r.status === "fail" ? "text-danger" : "text-warning"}`}>{r.status === "pass" ? "PASS" : r.status === "fail" ? "FAIL" : "MISSING"}</span></div></div>)}
    {!rules.length && <p className="p-4 text-sm text-muted-foreground">No profile-based conditions for this scholarship.</p>}</div>;
}

const TABS: Record<string, Status[] | null> = { All: null, Pending: PENDING, Approved: ["APPROVED", "DISBURSEMENT PENDING"], Rejected: ["REJECTED"], Disbursed: ["DISBURSED"] };
const ALL_STATUSES: Status[] = ["SUBMITTED", "ELIGIBILITY VERIFIED", "NOT ELIGIBLE", "UNDER REVIEW", "APPROVED", "REJECTED", "DISBURSEMENT PENDING", "DISBURSED"];
function ApplicationsList({ apps, openApp, admin = false, limit }: { apps: Application[]; openApp: (id: string) => void; admin?: boolean; limit?: number }) {
  const [tab, setTab] = useState("All"); const [status, setStatus] = useState("All"); const [search, setSearch] = useState(""); const [category, setCategory] = useState("All"); const [sch, setSch] = useState("All");
  const schNames = useMemo(() => Array.from(new Set(apps.map((a) => a.scholarship_name))), [apps]);
  const filtered = apps.filter((a) => {
    const t = TABS[tab]; if (!admin && t && !t.includes(a.status)) return false;
    if (admin && status !== "All" && a.status !== status) return false;
    if (search && !`${a.full_name} ${a.id}`.toLowerCase().includes(search.toLowerCase())) return false;
    return (category === "All" || a.category === category) && (sch === "All" || a.scholarship_name === sch);
  }).slice(0, limit);
  return <div className="animate-rise">{!limit && <PageTitle title={admin ? "Scholarship Applications" : "My Applications"} subtitle={admin ? "Search, filter, and review submitted applications." : "Open an application to view its eligibility and progress."} />}
    {admin && !limit && <Card className="mb-5 p-4"><div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_200px_160px_240px]"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Student name or application ID" aria-label="Search applications" className="h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" /><SelectField ariaLabel="Status filter" value={status} onChange={setStatus} options={["All", ...ALL_STATUSES]} /><SelectField ariaLabel="Category filter" value={category} onChange={setCategory} options={["All", ...CATEGORIES]} /><SelectField ariaLabel="Scholarship filter" value={sch} onChange={setSch} options={["All", ...schNames]} /></div></Card>}
    {!admin && <div className="mb-5 flex gap-2 overflow-x-auto pb-2">{Object.keys(TABS).map((t) => <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{t}</Chip>)}</div>}
    <div className="space-y-3">{filtered.map((a) => <button key={a.id} onClick={() => openApp(a.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg border bg-card p-4 text-left shadow-card transition hover:-translate-y-0.5"><div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><p className="truncate font-extrabold">{a.id}</p>{a.is_demo && <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">DEMO</span>}{admin && a.is_duplicate && <span className="shrink-0 rounded-full bg-warning-soft px-2 py-1 text-[10px] font-bold text-warning">POTENTIAL DUPLICATE</span>}</div><p className="mt-1 truncate text-sm font-semibold">{admin ? a.full_name : a.scholarship_name}</p><p className="mt-2 truncate text-xs text-muted-foreground">Submitted: {prettyDate(a.submitted_at)}{admin ? ` · ${a.scholarship_name}` : ""}</p></div><div className="flex items-center gap-2"><StatusBadge status={a.status} /><ChevronRight className="text-muted-foreground" size={18} /></div></button>)}{filtered.length === 0 && <EmptyState title="No applications found" text={apps.length ? "Try changing the current filters." : "Applications you submit will appear here."} />}</div></div>;
}

function ApplicationDetails({ app, resultOnly = false, back, adminPanel }: { app: Application; resultOnly?: boolean; back: () => void; adminPanel?: ReactNode }) {
  const disb = getDisb(app);
  return <div className="animate-rise"><button onClick={back} className="mb-5 flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary"><ArrowLeft size={17} />Back</button>{resultOnly && <p className="mb-2 text-xs font-extrabold uppercase text-primary">Eligibility Result</p>}
    <Card className="overflow-hidden"><div className={`p-6 text-center ${app.eligible ? "bg-success-soft" : "bg-danger-soft"}`}><div className={`mx-auto grid h-14 w-14 place-items-center rounded-full text-primary-foreground ${app.eligible ? "bg-success" : "bg-danger"}`}>{app.eligible ? <BadgeCheck size={30} /> : <XCircle size={30} />}</div><h1 className={`mt-3 text-2xl font-extrabold ${app.eligible ? "text-success" : "text-danger"}`}>{app.eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}</h1><p className="mt-2 text-sm">{app.eligible ? "Your details meet every recorded condition. This is not yet an approval." : "One or more conditions were not met or information was missing."}</p><p className="mt-4 text-sm font-bold">{app.scholarship_name}</p><p className="text-sm">Application ID: {app.id}</p></div><div className="p-4 sm:p-5"><RuleList rules={app.rules} /></div></Card>
    {app.is_duplicate && <div className="mt-5 rounded-lg border border-warning bg-warning-soft p-4"><p className="font-extrabold text-warning">Potential Duplicate Application</p><p className="mt-1 text-sm text-muted-foreground">This application matches an existing Student ID, email, scholarship and academic year. It remains available for administrator review.</p></div>}
    {!resultOnly && <><Card className="mt-5 p-5"><h2 className="text-base font-extrabold">Application Status</h2><div className="mt-4 grid gap-4 sm:grid-cols-3"><InfoItem label="Student Name" value={app.full_name} /><InfoItem label="Scholarship" value={app.scholarship_name} /><div><p className="text-xs font-bold uppercase text-muted-foreground">Current Status</p><div className="mt-1"><StatusBadge status={app.status} /></div></div></div>
      {disb && <div className="mt-5 rounded-lg border p-4"><p className="text-xs font-extrabold uppercase text-primary">Disbursement Record</p><div className="mt-3 grid gap-4 sm:grid-cols-3"><InfoItem label="Amount" value={formatMoney(Number(disb.amount))} /><InfoItem label="Payment" value={disb.status === "COMPLETED" ? "Payment recorded" : "Awaiting payment"} /><InfoItem label="Reference" value={disb.status === "COMPLETED" ? `${disb.payment_reference} · ${prettyDate(disb.payment_date)}` : "Not yet paid"} /></div></div>}
      {!!app.application_documents?.length && !adminPanel && <div className="mt-5"><p className="mb-2 text-xs font-extrabold uppercase text-primary">Documents</p><div className="space-y-2">{app.application_documents.map((d) => <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 p-3 text-sm"><span>{d.document_name}</span><span className={`shrink-0 text-[11px] font-extrabold ${d.verified ? "text-success" : d.provided ? "text-info" : "text-muted-foreground"}`}>{d.verified ? "VERIFIED" : d.provided ? "READY" : "NOT READY"}</span></div>)}</div></div>}
    </Card><Timeline app={app} /></>}{adminPanel}</div>;
}
function Timeline({ app }: { app: Application }) {
  const h = app.application_history ?? [];
  const at = (s: Status[]) => h.find((x) => s.includes(x.status));
  const rejected = at(["REJECTED"]);
  const steps: { label: string; entry: ReturnType<typeof at> }[] = [
    { label: "Application Submitted", entry: at(["SUBMITTED"]) },
    { label: app.eligible ? "Eligibility Verified" : "Eligibility Checked — Not Eligible", entry: at(["ELIGIBILITY VERIFIED", "NOT ELIGIBLE"]) },
    { label: "Under Review", entry: at(["UNDER REVIEW"]) },
    { label: rejected ? "Rejected" : "Approved", entry: rejected ?? at(["APPROVED"]) },
    { label: "Disbursement Pending", entry: at(["DISBURSEMENT PENDING"]) },
    { label: "Disbursed (payment recorded)", entry: at(["DISBURSED"]) },
  ];
  return <Card className="mt-5 p-5"><h2 className="text-base font-extrabold">Track Application</h2><div className="mt-5">{steps.map((s, i) => { const done = !!s.entry; const bad = s.label === "Rejected"; return <div key={s.label} className="grid grid-cols-[28px_1fr] gap-3"><div className="flex flex-col items-center"><span className={`grid h-7 w-7 place-items-center rounded-full ${done ? (bad ? "bg-danger text-primary-foreground" : "bg-success text-primary-foreground") : "border-2 bg-card text-muted-foreground"}`}>{done ? (bad ? <X size={15} /> : <Check size={15} />) : <span className="h-2 w-2 rounded-full bg-border" />}</span>{i < steps.length - 1 && <span className={`h-10 w-0.5 ${steps[i + 1]?.entry ? "bg-success" : "bg-border"}`} />}</div><div><p className={`text-sm font-bold ${done ? "" : "text-muted-foreground"}`}>{s.label}</p><p className="mt-1 text-xs text-muted-foreground">{s.entry ? `${prettyDate(s.entry.created_at)} · ${s.entry.note}` : "Pending"}</p></div></div>; })}</div></Card>;
}

function ProfilePage({ profile, apps, scholarships, saved, openApp, openSch, logout, onSaved }: { profile: Profile; apps: Application[]; scholarships: Scholarship[]; saved: string[]; openApp: (id: string) => void; openSch: (id: string) => void; logout: () => void; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ full_name: profile.full_name, student_id: profile.student_id ?? "", phone: profile.phone ?? "", college: profile.college ?? "", department: profile.department ?? "", course: profile.course ?? "", course_stream: profile.course_stream ?? "", study_level: profile.study_level ?? "", year: profile.year_of_study?.toString() ?? "", gender: profile.gender ?? "", use: profile.use_gender_for_matching, pct: profile.academic_percentage?.toString() ?? "", income: profile.family_income?.toString() ?? "", category: profile.category ?? "" });
  const [err, setErr] = useState(""); const set = (k: keyof typeof f, v: string | boolean) => setF({ ...f, [k]: v });
  async function save(e: FormEvent) {
    e.preventDefault(); setErr("");
    if (!f.full_name.trim()) return setErr("Name is required.");
    if (f.pct && (+f.pct < 0 || +f.pct > 100)) return setErr("Academic percentage must be 0–100.");
    if (f.income && +f.income < 0) return setErr("Income cannot be negative.");
    if (f.phone && !/^\d{10}$/.test(f.phone)) return setErr("Phone must have 10 digits.");
    try {
      await api.saveProfile({ id: profile.id, email: profile.email, full_name: f.full_name.trim(), student_id: f.student_id || null, phone: f.phone || null, college: f.college || null, department: f.department || null, course: f.course || null, course_stream: f.course_stream || null, study_level: f.study_level || null, year_of_study: f.year ? Number(f.year) : null, gender: f.gender || null, use_gender_for_matching: f.use, academic_percentage: f.pct === "" ? null : +f.pct, family_income: f.income === "" ? null : +f.income, category: f.category || null });
      toast.success("Profile updated"); await onSaved(); setEditing(false);
    } catch (e2) { setErr((e2 as Error).message); }
  }
  const savedList = scholarships.filter((s) => saved.includes(s.id));
  const initials = (profile.full_name || profile.email).split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  return <div className="animate-rise"><PageTitle title="Student Profile" subtitle="Your details are used to match scholarships." action={!editing && <Button variant="outline" onClick={() => setEditing(true)}>Edit Profile</Button>} />
    {editing ? <form onSubmit={save} className="space-y-5"><FormSection title="Personal & Academic" icon={<UserRound size={19} />}><div className="grid gap-4 sm:grid-cols-2"><Field label="Full Name" value={f.full_name} onChange={(v) => set("full_name", v)} /><Field label="Student ID" value={f.student_id} onChange={(v) => set("student_id", v)} required={false} /><Field label="Phone" value={f.phone} onChange={(v) => set("phone", v.replace(/\D/g, "").slice(0, 10))} required={false} /><Field label="College" value={f.college} onChange={(v) => set("college", v)} required={false} /><Field label="Department" value={f.department} onChange={(v) => set("department", v)} required={false} /><Field label="Course" value={f.course} onChange={(v) => set("course", v)} required={false} /><SelectField label="Course Stream" required={false} value={f.course_stream} onChange={(v) => set("course_stream", v)} options={STREAMS} placeholder="Not provided" /><SelectField label="Study Level" required={false} value={f.study_level} onChange={(v) => set("study_level", v)} options={STUDY_LEVELS} placeholder="Not provided" /><SelectField label="Year of Study" required={false} value={f.year} onChange={(v) => set("year", v)} options={["1", "2", "3", "4", "5"]} placeholder="Not provided" /><Field label="Academic Percentage" type="number" value={f.pct} onChange={(v) => set("pct", v)} required={false} /></div></FormSection>
      <FormSection title="Financial, Category & Privacy" icon={<Lock size={19} />}><div className="grid gap-4 sm:grid-cols-2"><Field label="Annual Family Income (₹)" type="number" value={f.income} onChange={(v) => set("income", v)} required={false} /><SelectField label="Category" required={false} value={f.category} onChange={(v) => set("category", v)} options={CATEGORIES} placeholder="Not provided" /><SelectField label="Gender" required={false} value={f.gender} onChange={(v) => set("gender", v)} options={GENDERS} placeholder="Not provided" /></div><div className="mt-4"><GenderPrivacy checked={f.use} onChange={(v) => set("use", v)} /></div></FormSection>
      {err && <div role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{err}</div>}<div className="flex gap-3"><Button type="submit">Save Profile</Button><Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button></div></form>
      : <Card className="overflow-hidden"><div className="bg-accent/60 p-6 text-center"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary text-2xl font-extrabold text-primary-foreground">{initials}</div><h2 className="mt-3 text-xl font-extrabold">{profile.full_name || "Name not set"}</h2><p className="text-sm text-muted-foreground">{profile.student_id ?? "Student ID not set"}</p></div><div className="grid gap-5 p-5 sm:grid-cols-2">{([["Department", profile.department], ["Course", profile.course], ["Course Stream", profile.course_stream], ["Study Level", profile.study_level], ["Year", profile.year_of_study ? `Year ${profile.year_of_study}` : null], ["Email", profile.email], ["College", profile.college], ["Academic Percentage", profile.academic_percentage != null ? `${profile.academic_percentage}%` : null], ["Family Income", profile.family_income != null ? formatMoney(Number(profile.family_income)) : null], ["Category", profile.category], ["Gender (private)", profile.gender ? `${profile.gender}${profile.use_gender_for_matching ? "" : " · not used for matching"}` : null]] as const).map(([l, v]) => <InfoItem key={l} label={l} value={v ?? "Not provided"} />)}</div></Card>}
    <div className="mt-6"><h2 className="mb-3 text-lg font-extrabold">Saved Scholarships</h2>{savedList.map((s) => <button key={s.id} onClick={() => openSch(s.id)} className="mb-3 grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-lg border bg-card p-4 text-left"><div className="min-w-0"><b className="block truncate">{s.name}</b><p className="text-sm text-muted-foreground">{s.amount}</p></div><ChevronRight size={18} className="text-muted-foreground" /></button>)}{!savedList.length && <p className="text-sm text-muted-foreground">No saved scholarships yet.</p>}</div>
    <div className="mt-6"><h2 className="mb-3 text-lg font-extrabold">My Applications</h2>{apps.slice(0, 3).map((a) => <button key={a.id} onClick={() => openApp(a.id)} className="mb-3 grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-lg border bg-card p-4 text-left"><div className="min-w-0"><b>{a.id}</b><p className="truncate text-sm text-muted-foreground">{a.scholarship_name}</p></div><StatusBadge status={a.status} /></button>)}{!apps.length && <p className="text-sm text-muted-foreground">No applications yet.</p>}</div>
    <Button variant="danger" className="mt-4 w-full sm:w-auto" onClick={logout}><LogOut size={17} />Sign Out</Button></div>;
}

/* ---------------- Admin ---------------- */
type AdminProps = { view: View; go: (v: View) => void; apps: Application[]; scholarships: Scholarship[]; selected?: Application | undefined; openApp: (id: string) => void; logout: () => void; reload: () => Promise<void>; adminId: string };
function AdminArea({ view, go, apps, scholarships, selected, openApp, logout, reload, adminId }: AdminProps) {
  if (view === "admin-scholarships") return <AdminScholarships scholarships={scholarships} reload={reload} />;
  if (view === "applications") return <ApplicationsList apps={apps} openApp={openApp} admin />;
  if (view === "profile") return <div><PageTitle title="Admin Profile" subtitle="Scholarship management and review access." /><Card className="max-w-xl p-6"><div className="flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-xl bg-info-soft text-info"><ShieldCheck size={28} /></div><div><h2 className="font-extrabold">ScholarShield Administrator</h2><p className="text-sm text-muted-foreground">admin@scholarshield.com</p></div></div><Button variant="danger" className="mt-6" onClick={logout}><LogOut size={17} />Sign Out</Button></Card></div>;
  if (view === "details" && selected) return <ApplicationDetails app={selected} back={() => go("applications")} adminPanel={<AdminReview app={selected} reload={reload} adminId={adminId} />} />;
  const count = (s: Status[]) => apps.filter((a) => s.includes(a.status)).length;
  const stats = [
    { l: "Total Applications", v: apps.length, i: FileText, c: "bg-info-soft text-info" }, { l: "Pending Review", v: count(PENDING), i: Clock3, c: "bg-warning-soft text-warning" },
    { l: "Approved", v: count(["APPROVED"]), i: BadgeCheck, c: "bg-success-soft text-success" }, { l: "Rejected", v: count(["REJECTED"]), i: XCircle, c: "bg-danger-soft text-danger" },
    { l: "Disbursement Pending", v: count(["DISBURSEMENT PENDING"]), i: Clock3, c: "bg-warning-soft text-warning" }, { l: "Disbursed", v: count(["DISBURSED"]), i: WalletCards, c: "bg-accent text-accent-foreground" },
    { l: "Active Scholarships", v: scholarships.filter((s) => s.is_active).length, i: Award, c: "bg-info-soft text-info" },
  ];
  return <div className="animate-rise"><PageTitle title="ScholarShield Admin" subtitle="Manage scholarships, review applications and record disbursements." /><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">{stats.map((s) => <Card key={s.l} className="p-4"><div className={`grid h-9 w-9 place-items-center rounded-lg ${s.c}`}><s.i size={18} /></div><p className="mt-4 text-2xl font-extrabold">{s.v}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{s.l}</p></Card>)}</div>
    <div className="mt-7 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">Recent Applications</h2><p className="text-sm text-muted-foreground">Most recent submissions</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => go("admin-scholarships")}>Manage Scholarships</Button><Button variant="outline" onClick={() => go("applications")}>View All<ArrowRight size={16} /></Button></div></div><div className="mt-4"><ApplicationsList apps={apps} openApp={openApp} admin limit={4} /></div></div>;
}

function AdminReview({ app, reload, adminId }: { app: Application; reload: () => Promise<void>; adminId: string }) {
  const disb = getDisb(app); const [amount, setAmount] = useState(""); const [ref, setRef] = useState(""); const [payDate, setPayDate] = useState(today()); const [busy, setBusy] = useState(false);
  const locked = app.status === "DISBURSEMENT PENDING" || app.status === "DISBURSED";
  async function run(label: string, fn: () => Promise<void>) {
    if (!confirm(`${label} for ${app.id}?`)) return; setBusy(true);
    try { await fn(); toast.success(`${label}: done`); await reload(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  const status = (s: Status, note: string) => run(note, () => api.setStatus(app.id, s, note));
  return <>
    <Card className="mt-5 p-5"><h2 className="text-base font-extrabold">Application Information</h2><div className="mt-5 space-y-6">
      <DetailGroup title="Student Information" items={[["Name", app.full_name], ["Student ID", app.student_id], ["Email", app.email], ["Phone", app.phone], ["Gender (private)", app.gender ?? "Not provided"]]} />
      <DetailGroup title="Academic Information" items={[["College", app.college], ["Course", app.course], ["Stream / Level", `${app.course_stream ?? "—"} / ${app.study_level ?? "—"}`], ["Year", app.year_of_study ? `Year ${app.year_of_study}` : "—"], ["Academic Year", app.academic_year], ["Academic Percentage", `${app.academic_percentage}%`], ["Attendance", `${app.attendance}%`]]} />
      <DetailGroup title="Financial & Scholarship" items={[["Annual Family Income", formatMoney(app.family_income)], ["Category", app.category], ["Scholarship", app.scholarship_name]]} />
      <DetailGroup title="Duplicate Check" items={[["Result", app.is_duplicate ? "Potential Duplicate" : "Clear"]]} />
    </div></Card>
    {!!app.application_documents?.length && <Card className="mt-5 p-5"><h2 className="text-base font-extrabold">Documents</h2><div className="mt-3 space-y-2">{app.application_documents.map((d) => <label key={d.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 p-3 text-sm"><span>{d.document_name} <span className="text-xs text-muted-foreground">({d.provided ? "student has it ready" : "not marked ready"})</span></span><span className="flex shrink-0 items-center gap-2 text-xs font-bold"><input type="checkbox" checked={d.verified} onChange={async (e) => { try { await api.verifyDocument(d.id, e.target.checked); await reload(); } catch (er) { toast.error((er as Error).message); } }} className="h-4 w-4 accent-primary" />Verified</span></label>)}</div></Card>}
    <Card className="mt-5 p-5"><h2 className="text-base font-extrabold">Admin Actions</h2>
      <div className="mt-4 flex flex-wrap gap-3"><Button disabled={busy || locked || app.status === "APPROVED"} onClick={() => status("APPROVED", "Application approved by administrator")}><Check size={17} />Approve</Button><Button variant="danger" disabled={busy || locked || app.status === "REJECTED"} onClick={() => status("REJECTED", "Application rejected by administrator")}><X size={17} />Reject</Button><Button variant="outline" disabled={busy || locked || app.status === "UNDER REVIEW"} onClick={() => status("UNDER REVIEW", "Moved to administrator review")}><Clock3 size={17} />Request Review</Button></div>
      <div className="mt-5 border-t pt-5"><p className="text-xs font-extrabold uppercase text-primary">Disbursement</p>
        {app.status === "APPROVED" && !disb && <div className="mt-3 flex flex-wrap items-end gap-3"><div className="w-48"><Field label="Amount (₹)" type="number" value={amount} onChange={setAmount} /></div><Button variant="secondary" disabled={busy || !(+amount > 0)} onClick={() => run("Start disbursement", () => api.startDisbursement(app.id, +amount, adminId))}><WalletCards size={17} />Start Disbursement</Button></div>}
        {disb && disb.status === "PENDING" && <div className="mt-3 flex flex-wrap items-end gap-3"><div className="w-56"><Field label="Payment Reference" value={ref} onChange={setRef} placeholder="e.g. UTR / transaction no." /></div><div className="w-44"><Field label="Payment Date" type="date" value={payDate} onChange={setPayDate} /></div><Button variant="secondary" disabled={busy || !ref.trim() || !payDate} onClick={() => run("Record payment", () => api.recordPayment(disb.id, ref.trim(), payDate))}><WalletCards size={17} />Record Payment</Button></div>}
        {disb && disb.status === "COMPLETED" && <p className="mt-3 text-sm font-bold text-success">Payment recorded: {formatMoney(Number(disb.amount))} · ref {disb.payment_reference} · {prettyDate(disb.payment_date)}</p>}
        {app.status !== "APPROVED" && !disb && <p className="mt-3 text-xs text-muted-foreground">An application must be approved before disbursement can start. It is marked disbursed only after a payment reference is recorded.</p>}
      </div></Card></>;
}

/* ---------------- About ---------------- */
function AboutPage({ back }: { back: () => void }) {
  return <main className="min-h-screen px-4 py-8"><div className="mx-auto max-w-3xl"><button onClick={back} className="mb-6 flex items-center gap-2 text-sm font-bold text-muted-foreground"><ArrowLeft size={17} />Back to sign in</button><Brand /><div className="mt-8"><PageTitle title="About ScholarShield" subtitle="Scholarship discovery, eligibility, application and disbursement tracking." /><Card className="p-6 sm:p-8"><p className="leading-7 text-muted-foreground">ScholarShield is an academic project that helps students discover scholarships they may not know about — especially opportunities created to support girls' higher education — check their eligibility against each scholarship's conditions, apply, and transparently track review and disbursement.</p><div className="my-8 flex flex-wrap items-center justify-center gap-2">{["Discover", "Check", "Apply", "Review", "Approve", "Disburse"].map((x, i) => <div key={x} className="flex items-center gap-2"><span className="rounded-full bg-accent px-3 py-2 text-xs font-extrabold text-accent-foreground">{x}</span>{i < 5 && <ArrowRight size={15} className="text-muted-foreground" />}</div>)}</div><Disclaimer text="Scholarship details are taken from official provider websites; anything not confirmed is marked unverified. Always confirm on the official website before applying. Eligibility results are indicative and are not approvals or payments." /></Card></div></div></main>;
}
