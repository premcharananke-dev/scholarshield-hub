// ScholarShield — single-page student & admin portal.
// Data lives in Lovable Cloud (see src/lib/data.ts); eligibility logic lives in src/lib/eligibility.ts.
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft, ArrowRight, Award, BadgeCheck, BookOpen, Check, ChevronRight, CircleDollarSign, Clock3, FileCheck2,
  FileText, GraduationCap, HelpCircle, Home, Info, LayoutDashboard, Lock, LogOut, ShieldCheck, UserRound, WalletCards, X, XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ensureDemoAccounts } from "@/lib/demo-accounts.functions";
import * as api from "@/lib/data";
import { formatMoney, isVisibleTo, matchScholarship, sha256 } from "@/lib/eligibility";
import { CATEGORIES, GENDERS, STREAMS, STUDY_LEVELS, type Application, type Disbursement, type MatchProfile, type Profile, type Role, type Scholarship, type Status } from "@/lib/types";
import { Brand, Button, Card, Chip, DetailGroup, Disclaimer, EmptyState, Field, FormSection, InfoItem, PageTitle, SelectField, StatusBadge, VerdictBadge, prettyDate } from "@/components/ui-kit";
import { ScholarshipCard, ScholarshipDetails, ScholarshipsPage, WomenSection, isClosed } from "@/components/scholarships";
import { AdminScholarships } from "@/components/admin-scholarships";
import { PasswordInput, isPasswordSatisfied, validatePasswordRules } from "@/components/password-input";
import { CollegeAutocomplete } from "@/components/college-autocomplete";
import { SearchableSelect } from "@/components/searchable-select";
import { DEGREE_OPTIONS, BRANCH_OPTIONS } from "@/lib/academic-options";

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const load = useCallback(async (u: { id: string; email: string }) => {
    try {
      setLoadError(null);
      const [r, p, a, s] = await Promise.all([api.getRole(u.id), api.getProfile(u.id), api.listApplications(), api.listScholarships()]);
      setRole(r); setProfile(p ?? emptyProfile(u.id, u.email)); setApps(a); setScholarships(s);
      setSaved(r === "student" ? await api.listSaved(u.id) : []);
    } catch (e) {
      const msg = (e as Error).message || "Unable to load portal data.";
      setLoadError(msg);
      toast.error(`Could not load data: ${msg}`);
    }
  }, []);
  const reload = useCallback(async () => { if (user) await load(user); }, [user, load]);

  useEffect(() => {
    const apply = async (session: { user: { id: string; email?: string | undefined } } | null) => {
      if (session) {
        const u = { id: session.user.id, email: session.user.email ?? "" };
        currentUserIdRef.current = u.id;
        setUser(u);
        await load(u);
      } else {
        currentUserIdRef.current = null;
        setUser(null); setProfile(null); setApps([]); setSaved([]); setLoadError(null);
      }
      setReady(true);
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setView("home");
        void apply(null);
      } else if (event === "SIGNED_IN") {
        const incomingId = session?.user?.id ?? null;
        if (incomingId && incomingId !== currentUserIdRef.current) {
          setView("home");
          void apply(session);
        }
      }
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
  if (!user) return about ? <AboutPage back={() => setAbout(false)} /> : <AuthScreen onAbout={() => setAbout(true)} />;
  if (!profile) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <Card className="w-full max-w-md p-6 text-center">
          <h1 className="text-lg font-extrabold">Unable to load your ScholarShield data</h1>
          <p className="mt-2 text-sm text-muted-foreground">{loadError ?? "Connection failed. Please retry."}</p>
          <div className="mt-5 flex justify-center gap-3">
            <Button onClick={() => void reload()}>Retry</Button>
            <Button variant="outline" onClick={() => void logout()}>Sign Out</Button>
          </div>
        </Card>
      </main>
    );
  }

  const selectedApp = apps.find((a) => a.id === appId);
  const selectedSch = scholarships.find((s) => s.id === schId);
  let content: ReactNode;
  if (role === "admin") {
    content = <AdminArea view={view} go={go} apps={apps} scholarships={scholarships} selected={selectedApp} openApp={openApp} logout={logout} reload={reload} adminId={user.id} adminEmail={user.email} />;
  } else {
    const mine = apps.filter((a) => a.user_id === user.id);
    const appliedIds = mine
      .map((a) => a.scholarship_id)
      .filter((id): id is string => Boolean(id));
    const applyToSch = (id: string) => { setSchId(id); go("apply"); };
    const common = { scholarships, profile, saved, onSave: toggleSave, onOpen: openSch, onApply: applyToSch, appliedIds };
    if (view === "scholarships") content = <ScholarshipsPage {...common} />;
    else if (view === "scholarship" && selectedSch) content = <ScholarshipDetails s={selectedSch} profile={profile} scholarships={scholarships} saved={saved.includes(selectedSch.id)} onSave={() => toggleSave(selectedSch.id)} back={() => go("scholarships")} alreadyApplied={mine.some((a) => a.scholarship_id === selectedSch.id)} onApply={() => applyToSch(selectedSch.id)} onSelectAlternative={openSch} />;
    else if (view === "apply") content = <ApplicationForm profile={profile} scholarships={scholarships} initialScholarship={schId} onDone={async (id) => { await reload(); openApp(id, "result"); }} />;
    else if (view === "applications") content = <ApplicationsList apps={mine} openApp={openApp} />;
    else if ((view === "details" || view === "result") && selectedApp) content = <ApplicationDetails app={selectedApp} resultOnly={view === "result"} back={() => go("applications")} profile={profile} scholarships={scholarships} onApply={applyToSch} go={go} />;
    else if (view === "profile") content = <ProfilePage profile={profile} apps={mine} scholarships={scholarships} saved={saved} openApp={openApp} openSch={openSch} logout={logout} onSaved={reload} />;
    else content = <StudentHome apps={mine} go={go} openApp={openApp} {...common} />;
  }
  return <AppShell role={role} profile={profile} view={view} go={go} logout={logout}>{content}</AppShell>;
}

interface SignupFieldErrors {
  firstName?: string;
  lastName?: string;
  studentId?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  college?: string;
  degree?: string;
  customDegree?: string;
  branch?: string;
  customBranch?: string;
  level?: string;
  year?: string;
  gender?: string;
}

/* ---------------- Authentication ---------------- */
function AuthScreen({ onAbout }: { onAbout: () => void }) {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [busy, setBusy] = useState(false);

  const [sign, setSign] = useState({
    firstName: "",
    lastName: "",
    studentId: "",
    email: "",
    password: "",
    confirmPassword: "",
    college: "",
    degree: "",
    customDegree: "",
    branch: "",
    customBranch: "",
    level: "",
    year: "",
    gender: "",
    useGender: true,
  });

  async function demo(which: "student" | "admin") {
    setEmail(`${which}@scholarshield.com`);
    setPassword("scholar123");
    setError("");
  }

  function clearFieldError(field: keyof SignupFieldErrors) {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      if (tab === "signin") {
        if (!email.trim() || !password) {
          setError("Please enter your email and password.");
          return;
        }
        if (DEMO_EMAILS.includes(email.trim().toLowerCase())) {
          await ensureDemoAccounts();
        }
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) {
          setError(
            err.message === "Invalid login credentials"
              ? "Incorrect email or password."
              : err.message,
          );
        }
        return;
      }

      // --- Sign Up Validation ---
      const errs: SignupFieldErrors = {};

      if (!sign.firstName.trim()) {
        errs.firstName = "First name is required.";
      }
      if (!sign.lastName.trim()) {
        errs.lastName = "Last name is required.";
      }
      if (!sign.studentId.trim()) {
        errs.studentId = "Student ID is required.";
      }
      if (!sign.email.trim()) {
        errs.email = "Email address is required.";
      } else if (!/^\S+@\S+\.\S+$/.test(sign.email.trim())) {
        errs.email = "Please enter a valid email address.";
      }

      const pwdRules = validatePasswordRules(sign.password);
      if (!isPasswordSatisfied(pwdRules)) {
        errs.password = "All five password requirements must be satisfied.";
      }

      if (!sign.confirmPassword) {
        errs.confirmPassword = "Confirm password is required.";
      } else if (sign.password !== sign.confirmPassword) {
        errs.confirmPassword = "Passwords do not match.";
      }

      if (!sign.college.trim()) {
        errs.college = "Please select or enter your college / university.";
      }
      if (!sign.degree) {
        errs.degree = "Please select your degree.";
      } else if (sign.degree === "Other" && !sign.customDegree.trim()) {
        errs.customDegree = "Please specify your degree.";
      }

      if (!sign.branch) {
        errs.branch = "Please select your branch.";
      } else if (sign.branch === "Other" && !sign.customBranch.trim()) {
        errs.customBranch = "Please specify your branch.";
      }

      if (!sign.level) {
        errs.level = "Please select a study level.";
      }
      if (!sign.year) {
        errs.year = "Please select your year of study.";
      }
      if (!sign.gender) {
        errs.gender = "Gender is required.";
      }

      setFieldErrors(errs);
      if (Object.keys(errs).length > 0) {
        setError("Please complete all mandatory fields with valid details.");
        return;
      }

      const fullName = `${sign.firstName.trim()} ${sign.lastName.trim()}`;
      const { data, error: err } = await supabase.auth.signUp({
        email: sign.email.trim().toLowerCase(),
        password: sign.password,
        options: { emailRedirectTo: window.location.origin },
      });

      if (err || !data.user) {
        setError(err?.message ?? "Could not create the account.");
        return;
      }
      if (!data.session) {
        setError(
          "Account created. Please check your email to confirm, then sign in.",
        );
        return;
      }

      const resolvedDegree = (
        sign.degree === "Other" ? sign.customDegree.trim() : sign.degree
      ).trim();
      const resolvedBranch = (
        sign.branch === "Other" ? sign.customBranch.trim() : sign.branch
      ).trim();

      await api.saveProfile({
        id: data.user.id,
        full_name: fullName,
        student_id: sign.studentId.trim(),
        email: sign.email.trim().toLowerCase(),
        college: sign.college.trim(),
        course: resolvedDegree, // Degree -> course
        course_stream: resolvedBranch, // Branch -> course_stream
        study_level: sign.level,
        year_of_study: Number(sign.year),
        gender: sign.gender || null,
        use_gender_for_matching: sign.useGender,
      });

      // Reload so the newly created profile is picked up.
      window.location.reload();
    } catch (e2) {
      setError((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:py-12">
      <div
        className={`mx-auto animate-rise transition-all duration-200 ${
          tab === "signup" ? "max-w-xl" : "max-w-md"
        }`}
      >
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-card">
            <ShieldCheck size={36} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            SCHOLAR<span className="text-primary">SHIELD</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Scholarship Discovery, Eligibility & Disbursement System
          </p>
        </div>

        <Card className="p-6 sm:p-8">
          <div className="mb-6 grid grid-cols-2 rounded-lg bg-muted p-1">
            {(["signin", "signup"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTab(t);
                  setError("");
                  setFieldErrors({});
                }}
                className={`rounded-md py-2.5 text-sm font-bold transition-all ${
                  tab === t
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            {tab === "signin" ? (
              <>
                <Field
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="studentID@college.edu.in"
                />
                <PasswordInput
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </>
            ) : (
              <>
                {/* 1. Name Fields: First Name & Last Name (Side by Side) */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="First Name"
                    value={sign.firstName}
                    onChange={(v) => {
                      setSign({ ...sign, firstName: v });
                      clearFieldError("firstName");
                    }}
                    placeholder="Enter first name"
                    error={fieldErrors.firstName}
                  />
                  <Field
                    label="Last Name"
                    value={sign.lastName}
                    onChange={(v) => {
                      setSign({ ...sign, lastName: v });
                      clearFieldError("lastName");
                    }}
                    placeholder="Enter last name"
                    error={fieldErrors.lastName}
                  />
                </div>

                {/* Student ID & Email */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Student ID / Roll No"
                    value={sign.studentId}
                    onChange={(v) => {
                      setSign({ ...sign, studentId: v });
                      clearFieldError("studentId");
                    }}
                    placeholder="XX09XXXXXX"
                    error={fieldErrors.studentId}
                  />
                  <Field
                    label="Email Address"
                    type="email"
                    value={sign.email}
                    onChange={(v) => {
                      setSign({ ...sign, email: v });
                      clearFieldError("email");
                    }}
                    placeholder="studentID@college.edu.in"
                    error={fieldErrors.email}
                  />
                </div>

                {/* 2. Password with 5 Requirements Checklist */}
                <PasswordInput
                  label="Create Password"
                  value={sign.password}
                  onChange={(v) => {
                    setSign({ ...sign, password: v });
                    clearFieldError("password");
                  }}
                  placeholder="Enter password"
                  showChecklist={true}
                  error={fieldErrors.password}
                />

                {/* 3. Confirm Password */}
                <PasswordInput
                  label="Confirm Password"
                  value={sign.confirmPassword}
                  onChange={(v) => {
                    setSign({ ...sign, confirmPassword: v });
                    clearFieldError("confirmPassword");
                  }}
                  placeholder="Confirm password"
                  error={fieldErrors.confirmPassword}
                />

                {/* 4. College Name Smart Autocomplete */}
                <CollegeAutocomplete
                  value={sign.college}
                  onChange={(v) => {
                    setSign({ ...sign, college: v });
                    clearFieldError("college");
                  }}
                  error={fieldErrors.college}
                />

                {/* 5. Degree & Branch (Searchable Dropdowns with 'Other' Custom Input) */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <SearchableSelect
                    label="Degree"
                    value={sign.degree}
                    onChange={(v) => {
                      setSign({ ...sign, degree: v });
                      clearFieldError("degree");
                      clearFieldError("customDegree");
                    }}
                    options={DEGREE_OPTIONS}
                    placeholder="Select degree"
                    searchPlaceholder="Search degrees (e.g. B.Tech, M.Tech, B.Sc...)"
                    customValue={sign.customDegree}
                    onCustomChange={(v) => {
                      setSign({ ...sign, customDegree: v });
                      clearFieldError("customDegree");
                    }}
                    customPlaceholder="Specify custom degree (e.g. Integrated M.Tech)"
                    error={fieldErrors.degree}
                    customError={fieldErrors.customDegree}
                  />

                  <SearchableSelect
                    label="Branch"
                    value={sign.branch}
                    onChange={(v) => {
                      setSign({ ...sign, branch: v });
                      clearFieldError("branch");
                      clearFieldError("customBranch");
                    }}
                    options={BRANCH_OPTIONS}
                    placeholder="Select branch"
                    searchPlaceholder="Search branches (e.g. CSE, AI & ML, ECE...)"
                    customValue={sign.customBranch}
                    onCustomChange={(v) => {
                      setSign({ ...sign, customBranch: v });
                      clearFieldError("customBranch");
                    }}
                    customPlaceholder="Specify custom branch (e.g. Mechatronics)"
                    error={fieldErrors.branch}
                    customError={fieldErrors.customBranch}
                  />
                </div>

                {/* Study Level, Year of Study & Gender (Required) */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <SelectField
                    label="Study Level"
                    value={sign.level}
                    onChange={(v) => {
                      setSign({ ...sign, level: v });
                      clearFieldError("level");
                    }}
                    options={STUDY_LEVELS}
                    error={fieldErrors.level}
                  />
                  <SelectField
                    label="Year of Study"
                    value={sign.year}
                    onChange={(v) => {
                      setSign({ ...sign, year: v });
                      clearFieldError("year");
                    }}
                    options={["1", "2", "3", "4", "5"]}
                    error={fieldErrors.year}
                  />
                  <SelectField
                    label="Gender"
                    required={true}
                    value={sign.gender}
                    onChange={(v) => {
                      setSign({ ...sign, gender: v });
                      clearFieldError("gender");
                    }}
                    options={GENDERS}
                    error={fieldErrors.gender}
                  />
                </div>

                {/* Privacy for Matching */}
                <GenderPrivacy
                  checked={sign.useGender}
                  onChange={(v) => setSign({ ...sign, useGender: v })}
                />
              </>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-xs font-semibold text-danger border border-danger/20 animate-in fade-in"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full text-sm font-bold shadow-sm"
              disabled={busy}
            >
              {busy
                ? "Please wait…"
                : tab === "signin"
                  ? "Sign In"
                  : "Create Student Account"}
              <ArrowRight size={17} />
            </Button>
          </form>

          {/* Demo Access Preserved */}
          {tab === "signin" && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs font-bold text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                DEMO ACCESS
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => demo("student")}>
                  <GraduationCap size={17} />
                  Student
                </Button>
                <Button variant="outline" onClick={() => demo("admin")}>
                  <ShieldCheck size={17} />
                  Admin
                </Button>
              </div>
            </>
          )}
        </Card>

        <button
          onClick={onAbout}
          className="mx-auto mt-5 flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-primary"
        >
          <Info size={16} />
          About ScholarShield
        </button>
      </div>
    </main>
  );
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
  if (!p.course_stream && !p.course) m.push("course / branch"); if (!p.study_level) m.push("study level"); if (!p.year_of_study) m.push("year of study");
  if (p.academic_percentage == null) m.push("academic percentage"); if (p.family_income == null) m.push("family income"); if (!p.category) m.push("category");
  return m;
}
type HomeProps = {
  profile: Profile;
  apps: Application[];
  go: (v: View) => void;
  openApp: (id: string) => void;
  scholarships: Scholarship[];
  saved: string[];
  onSave: (id: string) => void;
  onOpen: (id: string) => void;
  onApply?: ((id: string) => void) | undefined;
  appliedIds?: string[] | undefined;
};

function StudentHome({
  profile,
  apps,
  go,
  openApp,
  scholarships,
  saved,
  onSave,
  onOpen,
  onApply,
  appliedIds = [],
}: HomeProps) {
  const [showAllRecommended, setShowAllRecommended] = useState(false);
  const latest = apps[0];
  const female = profile.use_gender_for_matching && profile.gender === "Female";
  const missing = missingProfileFields(profile);

  // Prioritize:
  // 1. Eligible scholarships (Women-specific for eligible female students first, then general eligible)
  // 2. Scholarships requiring additional information
  // Within each tier: prioritize approaching deadlines
  const recommendedMatches = useMemo(() => {
    const activeOpen = scholarships.filter(
      (s) => s.is_active && !isClosed(s) && isVisibleTo(s, profile)
    );

    const evaluated = activeOpen.map((s) => ({
      scholarship: s,
      match: matchScholarship(s, profile),
    }));

    const candidates = evaluated.filter(
      (item) =>
        item.match.verdict === "Eligible" ||
        item.match.verdict === "Additional Information Required"
    );

    const getDaysLeft = (deadline?: string | null) => {
      if (!deadline) return 999999;
      const days = Math.ceil(
        (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return days >= 0 ? days : 999999;
    };

    candidates.sort((a, b) => {
      const getTier = (item: typeof a) => {
        if (item.match.verdict === "Eligible") {
          if (female && item.scholarship.eligible_gender === "Female") return 1;
          return 2;
        }
        return 3;
      };

      const tierA = getTier(a);
      const tierB = getTier(b);
      if (tierA !== tierB) return tierA - tierB;

      const daysA = getDaysLeft(a.scholarship.closing_date);
      const daysB = getDaysLeft(b.scholarship.closing_date);
      if (daysA !== daysB) return daysA - daysB;

      return a.scholarship.name.localeCompare(b.scholarship.name);
    });

    return candidates;
  }, [scholarships, profile, female]);

  const displayedRecommended = showAllRecommended
    ? recommendedMatches
    : recommendedMatches.slice(0, 6);

  return (
    <div className="animate-rise space-y-6">
      <PageTitle
        title="Scholarship Dashboard"
        subtitle="Your applications and scholarships that match your profile."
      />
      {female && (
        <WomenSection
          scholarships={scholarships}
          profile={profile}
          saved={saved}
          onSave={onSave}
          onOpen={onOpen}
          onApply={onApply}
          appliedIds={appliedIds}
          compact
        />
      )}
      {missing.length > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-warning p-4">
          <div className="flex gap-3">
            <HelpCircle className="mt-0.5 shrink-0 text-warning" size={20} />
            <div>
              <p className="font-extrabold">Complete your profile for accurate matching</p>
              <p className="text-sm text-muted-foreground">Missing: {missing.join(", ")}.</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => go("profile")}>Update Profile</Button>
        </Card>
      )}
      {latest ? (
        <Card className="overflow-hidden">
          <div className="border-b bg-accent/50 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-primary">APPLICATION STATUS</p>
                <h2 className="mt-2 text-xl font-extrabold">{latest.scholarship_name}</h2>
              </div>
              <StatusBadge status={latest.status} />
            </div>
          </div>
          <div className="grid gap-5 p-5 sm:grid-cols-3 sm:p-6">
            <InfoItem label="Application ID" value={latest.id} />
            <InfoItem label="Submitted" value={prettyDate(latest.submitted_at)} />
            <InfoItem label="Eligibility" value={latest.eligible ? "Eligible" : "Not Eligible"} />
          </div>
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            <Button onClick={() => openApp(latest.id)}>View & Track Application<ArrowRight size={17} /></Button>
          </div>
        </Card>
      ) : (
        <Card className="p-6 text-center sm:p-10">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent text-primary">
            <FileCheck2 size={28} />
          </div>
          <h2 className="mt-4 text-xl font-extrabold">Scholarship Application</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Find a scholarship, check your eligibility, then apply and track it here.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={() => go("scholarships")}>Browse Scholarships<ArrowRight size={17} /></Button>
            <Button variant="outline" onClick={() => go("apply")}>Apply Now</Button>
          </div>
        </Card>
      )}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">Recommended for You</h2>
            <p className="text-sm text-muted-foreground">
              Prioritized by eligibility, women's empowerment initiatives, and upcoming deadlines.
            </p>
          </div>
          <Button variant="outline" onClick={() => go("scholarships")}>View All<ArrowRight size={16} /></Button>
        </div>
        {recommendedMatches.length ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {displayedRecommended.map((item) => (
                <ScholarshipCard
                  key={item.scholarship.id}
                  s={item.scholarship}
                  profile={profile}
                  saved={saved.includes(item.scholarship.id)}
                  onSave={() => onSave(item.scholarship.id)}
                  onOpen={() => onOpen(item.scholarship.id)}
                  onApply={onApply ? () => onApply(item.scholarship.id) : undefined}
                  alreadyApplied={appliedIds.includes(item.scholarship.id)}
                />
              ))}
            </div>
            {recommendedMatches.length > 6 && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  onClick={() => setShowAllRecommended(!showAllRecommended)}
                >
                  {showAllRecommended
                    ? "Show Less"
                    : `Show All (${recommendedMatches.length}) Recommendations`}
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            title="No full matches yet"
            text={
              missing.length
                ? "Complete your profile to get recommendations."
                : "Browse all scholarships to see what each one needs."
            }
          />
        )}
      </section>
      <Disclaimer />
    </div>
  );
}

function ApplicationForm({
  profile,
  scholarships,
  initialScholarship,
  onDone,
}: {
  profile: Profile;
  scholarships: Scholarship[];
  initialScholarship?: string | undefined;
  onDone: (id: string) => Promise<void>;
}) {
  const open = scholarships.filter(
    (s) => s.in_database !== false && s.is_active && !isClosed(s) && isVisibleTo(s, profile)
  );
  const unsyncedRequested = initialScholarship
    ? scholarships.find((s) => s.id === initialScholarship && s.in_database === false)
    : undefined;

  // Prefill first name & last name from existing profile.full_name
  const [initFirst, ...restLast] = (profile.full_name || "").trim().split(/\s+/);
  const initLast = restLast.join(" ");

  // Prefill degree & branch
  const initDegree = profile.course
    ? (DEGREE_OPTIONS as readonly string[]).includes(profile.course)
      ? profile.course
      : "Other"
    : "";
  const initCustomDegree =
    profile.course && !(DEGREE_OPTIONS as readonly string[]).includes(profile.course)
      ? profile.course
      : "";

  const initBranch = profile.course_stream
    ? (BRANCH_OPTIONS as readonly string[]).includes(profile.course_stream)
      ? profile.course_stream
      : "Other"
    : "";
  const initCustomBranch =
    profile.course_stream && !(BRANCH_OPTIONS as readonly string[]).includes(profile.course_stream)
      ? profile.course_stream
      : "";

  const [form, setForm] = useState({
    firstName: initFirst || "",
    lastName: initLast || "",
    studentId: profile.student_id ?? "",
    email: profile.email,
    phone: profile.phone ?? "",
    college: profile.college ?? "",
    degree: initDegree,
    customDegree: initCustomDegree,
    branch: initBranch,
    customBranch: initCustomBranch,
    level: profile.study_level ?? "",
    year: profile.year_of_study?.toString() ?? "",
    academicYear: "2026-27",
    academic: profile.academic_percentage?.toString() ?? "",
    attendance: "",
    income: profile.family_income?.toString() ?? "",
    category: profile.category ?? "",
    gender: profile.gender ?? "",
    scholarshipId: open.some((s) => s.id === initialScholarship)
      ? initialScholarship ?? ""
      : "",
    confirm: false,
    saveToProfile: true,
  });

  const [docs, setDocs] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string | boolean) => {
    setForm((prev) => ({ ...prev, [k]: v }));
  };

  const clearFieldError = (key: string) => {
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const sch = open.find((s) => s.id === form.scholarshipId);

  const resolvedDegree = (
    form.degree === "Other" ? form.customDegree.trim() : form.degree
  ).trim();
  const resolvedBranch = (
    form.branch === "Other" ? form.customBranch.trim() : form.branch
  ).trim();

  const matchInput: MatchProfile = {
    gender: form.gender || null,
    use_gender_for_matching: true,
    course: resolvedDegree || null,
    course_stream: resolvedBranch || null,
    college: form.college.trim() || null,
    study_level: form.level || null,
    year_of_study: form.year ? Number(form.year) : null,
    academic_percentage: form.academic === "" ? null : Number(form.academic),
    attendance: form.attendance === "" ? null : Number(form.attendance),
    family_income: form.income === "" ? null : Number(form.income),
    category: form.category || null,
  };
  const preview = sch ? matchScholarship(sch, matchInput) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n: Record<string, string> = {};

    if (!form.firstName.trim()) n["firstName"] = "First name is required";
    if (!form.lastName.trim()) n["lastName"] = "Last name is required";
    if (!form.studentId.trim()) n["studentId"] = "Student ID / Roll No is required";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) n["email"] = "Enter a valid email";
    if (!/^\d{10}$/.test(form.phone)) n["phone"] = "Enter a 10-digit phone number";
    if (!form.college.trim()) n["college"] = "College or university is required";

    if (!form.degree) {
      n["degree"] = "Please select your degree";
    } else if (form.degree === "Other" && !form.customDegree.trim()) {
      n["customDegree"] = "Please specify your degree";
    }

    if (!form.branch) {
      n["branch"] = "Please select your branch";
    } else if (form.branch === "Other" && !form.customBranch.trim()) {
      n["customBranch"] = "Please specify your branch";
    }

    if (!form.level) n["level"] = "Select a study level";
    if (!form.year) n["year"] = "Select a year";
    if (!/^\d{4}-\d{2}$/.test(form.academicYear)) n["academicYear"] = "Use the format 2026-27";
    if (form.academic === "" || +form.academic < 0 || +form.academic > 100)
      n["academic"] = "Enter a value from 0 to 100";
    if (form.attendance === "" || +form.attendance < 0 || +form.attendance > 100)
      n["attendance"] = "Enter a value from 0 to 100";
    if (form.income === "" || +form.income < 0) n["income"] = "Enter a valid annual income";
    if (!form.category) n["category"] = "Select a category";
    if (!sch) n["scholarship"] = "Select a scholarship";
    if (!form.confirm) n["confirm"] = "You must confirm the information";

    setErrors(n);
    if (Object.keys(n).length || !sch || !preview) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setBusy(true);
    try {
      const fp = await sha256(
        [form.studentId, form.email, sch.id, form.academicYear]
          .map((v) => v.trim().toLowerCase())
          .join("|")
      );
      const eligible = preview.verdict === "Eligible";
      const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`;

      const id = await api.submitApplication(
        {
          user_id: profile.id,
          scholarship_id: sch.id,
          scholarship_name: sch.name,
          full_name: fullName,
          student_id: form.studentId.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone,
          college: form.college.trim(),
          course: resolvedDegree, // Degree mapped to course
          course_stream: resolvedBranch, // Branch mapped to course_stream
          study_level: form.level,
          department: profile.department,
          year_of_study: Number(form.year),
          academic_year: form.academicYear,
          academic_percentage: +form.academic,
          attendance: +form.attendance,
          family_income: +form.income,
          category: form.category,
          gender: form.gender || null,
          status: eligible ? "ELIGIBILITY VERIFIED" : "NOT ELIGIBLE",
          eligible,
          rules: preview.checks,
          fingerprint: fp,
        },
        sch.documents.map((d) => ({ name: d, provided: !!docs[d] }))
      );

      if (form.saveToProfile) {
        try {
          await api.saveProfile({
            id: profile.id,
            full_name: fullName,
            student_id: form.studentId.trim(),
            phone: form.phone,
            college: form.college.trim(),
            course: resolvedDegree,
            course_stream: resolvedBranch,
            study_level: form.level,
            year_of_study: Number(form.year),
            academic_percentage: +form.academic,
            family_income: +form.income,
            category: form.category,
            gender: form.gender || null,
            email: profile.email,
            use_gender_for_matching: profile.use_gender_for_matching,
          });
        } catch (profileErr) {
          toast.warning(`Application ${id} submitted, but your profile sync failed: ${(profileErr as Error).message}`);
        }
      }

      toast.success(`Application ${id} submitted`);
      await onDone(id);
    } catch (e2) {
      toast.error((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise">
      <PageTitle
        title="Scholarship Application"
        subtitle="Details from your profile are filled in. Check each section carefully."
      />
      <form onSubmit={submit} className="space-y-5" noValidate>
        <FormSection title="Scholarship" icon={<Award size={19} />}>
          {unsyncedRequested && !sch && (
            <div className="mb-4 rounded-lg border border-warning bg-warning-soft/50 p-3.5 text-xs text-foreground">
              <p className="font-bold">
                {unsyncedRequested.name} ({unsyncedRequested.id}) is a catalog reference scheme not yet synced to the portal database.
              </p>
              <p className="mt-1 text-muted-foreground">
                Select a database-enabled scholarship below for in-portal tracking
                {unsyncedRequested.application_url ? (
                  <>
                    , or{" "}
                    <a
                      href={unsyncedRequested.application_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-primary underline"
                    >
                      apply directly on the official portal
                    </a>
                    .
                  </>
                ) : (
                  "."
                )}
              </p>
            </div>
          )}
          <SelectField
            label="Scholarship"
            value={sch?.id ?? ""}
            onChange={(v) => {
              set("scholarshipId", v);
              clearFieldError("scholarship");
              setDocs({});
            }}
            options={open.map((s) => ({ value: s.id, label: s.name }))}
            error={errors["scholarship"]}
            placeholder="Select a scholarship"
          />
          {sch && (
            <p className="mt-2 text-sm font-bold">
              {sch.name}
              <span className="block text-xs font-medium text-muted-foreground">
                {sch.provider} · {sch.amount}
              </span>
            </p>
          )}
        </FormSection>

        <FormSection title="Personal Details" icon={<UserRound size={19} />}>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="First Name"
                value={form.firstName}
                onChange={(v) => {
                  set("firstName", v);
                  clearFieldError("firstName");
                }}
                placeholder="Enter first name"
                error={errors["firstName"]}
              />
              <Field
                label="Last Name"
                value={form.lastName}
                onChange={(v) => {
                  set("lastName", v);
                  clearFieldError("lastName");
                }}
                placeholder="Enter last name"
                error={errors["lastName"]}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Student ID / Roll No"
                value={form.studentId}
                onChange={(v) => {
                  set("studentId", v);
                  clearFieldError("studentId");
                }}
                placeholder="XX09XXXXXX"
                error={errors["studentId"]}
              />
              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => set("email", v)}
                error={errors["email"]}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Phone Number"
                inputMode="numeric"
                value={form.phone}
                onChange={(v) => set("phone", v.replace(/\D/g, "").slice(0, 10))}
                error={errors["phone"]}
              />
              <SelectField
                label="Gender"
                required={false}
                value={form.gender}
                onChange={(v) => set("gender", v)}
                options={GENDERS}
                placeholder="Not provided"
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Academic Details" icon={<BookOpen size={19} />}>
          <div className="space-y-4">
            <CollegeAutocomplete
              value={form.college}
              onChange={(v) => {
                set("college", v);
                clearFieldError("college");
              }}
              error={errors["college"]}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <SearchableSelect
                label="Degree"
                value={form.degree}
                onChange={(v) => {
                  set("degree", v);
                  clearFieldError("degree");
                  clearFieldError("customDegree");
                }}
                options={DEGREE_OPTIONS}
                placeholder="Select degree"
                searchPlaceholder="Search degrees (e.g. B.Tech, M.Tech, B.Sc...)"
                customValue={form.customDegree}
                onCustomChange={(v) => {
                  set("customDegree", v);
                  clearFieldError("customDegree");
                }}
                customPlaceholder="Specify custom degree (e.g. Integrated M.Tech)"
                error={errors["degree"]}
                customError={errors["customDegree"]}
              />

              <SearchableSelect
                label="Branch"
                value={form.branch}
                onChange={(v) => {
                  set("branch", v);
                  clearFieldError("branch");
                  clearFieldError("customBranch");
                }}
                options={BRANCH_OPTIONS}
                placeholder="Select branch"
                searchPlaceholder="Search branches (e.g. CSE, AI & ML, ECE...)"
                customValue={form.customBranch}
                onCustomChange={(v) => {
                  set("customBranch", v);
                  clearFieldError("customBranch");
                }}
                customPlaceholder="Specify custom branch (e.g. Mechatronics)"
                error={errors["branch"]}
                customError={errors["customBranch"]}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                label="Study Level"
                value={form.level}
                onChange={(v) => {
                  set("level", v);
                  clearFieldError("level");
                }}
                options={STUDY_LEVELS}
                error={errors["level"]}
              />
              <SelectField
                label="Year of Study"
                value={form.year}
                onChange={(v) => {
                  set("year", v);
                  clearFieldError("year");
                }}
                options={["1", "2", "3", "4", "5"]}
                error={errors["year"]}
              />
              <Field
                label="Academic Year"
                value={form.academicYear}
                onChange={(v) => set("academicYear", v)}
                error={errors["academicYear"]}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Academic Percentage"
                type="number"
                value={form.academic}
                onChange={(v) => set("academic", v)}
                error={errors["academic"]}
              />
              <Field
                label="Attendance Percentage"
                type="number"
                value={form.attendance}
                onChange={(v) => set("attendance", v)}
                error={errors["attendance"]}
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Financial & Category" icon={<CircleDollarSign size={19} />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Annual Family Income (₹)"
              type="number"
              value={form.income}
              onChange={(v) => set("income", v)}
              error={errors["income"]}
            />
            <SelectField
              label="Category"
              value={form.category}
              onChange={(v) => set("category", v)}
              options={CATEGORIES}
              error={errors["category"]}
            />
          </div>
        </FormSection>

        {sch && sch.documents.length > 0 && (
          <FormSection title="Required Documents" icon={<FileText size={19} />}>
            <p className="mb-3 text-sm text-muted-foreground">
              Tick the documents you have ready. The administrator verifies them during review.
            </p>
            <div className="space-y-2">
              {sch.documents.map((d) => (
                <label
                  key={d}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm cursor-pointer hover:bg-muted/30 transition"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!!docs[d]}
                      onChange={(e) => setDocs({ ...docs, [d]: e.target.checked })}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="font-medium text-foreground">{d}</span>
                  </div>
                  <span
                    className={`text-xs font-bold shrink-0 ${
                      docs[d] ? "text-success" : "text-muted-foreground"
                    }`}
                  >
                    {docs[d] ? "Ready" : "Mark as ready"}
                  </span>
                </label>
              ))}
            </div>
          </FormSection>
        )}

        {preview && (
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-extrabold">Eligibility Preview</h2>
              <VerdictBadge verdict={preview.verdict} />
            </div>
            <RuleList rules={preview.checks} />
          </Card>
        )}

        <label className="flex items-start gap-3 rounded-lg border bg-card p-4 text-sm">
          <input
            type="checkbox"
            checked={form.saveToProfile}
            onChange={(e) => set("saveToProfile", e.target.checked)}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <span>Save these details to my profile for future matching</span>
        </label>

        <label className="flex items-start gap-3 rounded-lg border bg-card p-4 text-sm">
          <input
            type="checkbox"
            checked={form.confirm}
            onChange={(e) => set("confirm", e.target.checked)}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <span>
            <b>I confirm that the information provided is correct.</b>
            {errors["confirm"] && (
              <span className="mt-1 block text-danger">{errors["confirm"]}</span>
            )}
          </span>
        </label>

        <Button type="submit" className="w-full sm:w-auto" disabled={busy}>
          {busy ? "Submitting…" : "Submit Application"}
          <ArrowRight size={17} />
        </Button>
      </form>
      <Disclaimer />
    </div>
  );
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

function ApplicationDetails({
  app,
  resultOnly = false,
  back,
  adminPanel,
  profile,
  scholarships = [],
  onApply,
  go,
}: {
  app: Application;
  resultOnly?: boolean;
  back: () => void;
  adminPanel?: ReactNode;
  profile?: Profile;
  scholarships?: Scholarship[];
  onApply?: (schId: string) => void;
  go?: (v: View) => void;
}) {
  const disb = getDisb(app);

  // Automatic alternative recommendations for Not Eligible or Rejected applications
  const isUnsuccessful =
    !app.eligible || app.status === "NOT ELIGIBLE" || app.status === "REJECTED";

  const studentProfile: MatchProfile = profile
    ? {
        gender: profile.gender ?? app.gender ?? null,
        use_gender_for_matching: profile.use_gender_for_matching,
        course: profile.course ?? app.course ?? null,
        course_stream: profile.course_stream ?? app.course_stream ?? null,
        college: profile.college ?? app.college ?? null,
        study_level: profile.study_level ?? app.study_level ?? null,
        year_of_study: profile.year_of_study ?? app.year_of_study ?? null,
        academic_percentage:
          profile.academic_percentage ?? app.academic_percentage ?? null,
        attendance: profile.attendance ?? app.attendance ?? null,
        family_income: profile.family_income ?? app.family_income ?? null,
        category: profile.category ?? app.category ?? null,
      }
    : {
        gender: app.gender ?? null,
        use_gender_for_matching: true,
        course: app.course ?? null,
        course_stream: app.course_stream ?? null,
        college: app.college ?? null,
        study_level: app.study_level ?? null,
        year_of_study: app.year_of_study ?? null,
        academic_percentage: app.academic_percentage ?? null,
        attendance: app.attendance ?? null,
        family_income: app.family_income ?? null,
        category: app.category ?? null,
      };

  const candidateAlternatives = scholarships.filter(
    (s) =>
      s.id !== app.scholarship_id &&
      s.is_active &&
      !isClosed(s) &&
      isVisibleTo(s, studentProfile)
  );

  const evaluatedAlternatives = candidateAlternatives.map((s) => ({
    scholarship: s,
    match: matchScholarship(s, studentProfile),
  }));

  const eligibleAlternatives = evaluatedAlternatives.filter(
    (x) => x.match.verdict === "Eligible"
  );
  const additionalInfoAlternatives = evaluatedAlternatives.filter(
    (x) => x.match.verdict === "Additional Information Required"
  );

  return (
    <div className="animate-rise">
      <button
        onClick={back}
        className="mb-5 flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={17} />
        Back
      </button>

      {resultOnly && (
        <p className="mb-2 text-xs font-extrabold uppercase text-primary">
          Eligibility Result
        </p>
      )}

      <Card className="overflow-hidden">
        <div
          className={`p-6 text-center ${
            app.eligible ? "bg-success-soft" : "bg-danger-soft"
          }`}
        >
          <div
            className={`mx-auto grid h-14 w-14 place-items-center rounded-full text-primary-foreground ${
              app.eligible ? "bg-success" : "bg-danger"
            }`}
          >
            {app.eligible ? <BadgeCheck size={30} /> : <XCircle size={30} />}
          </div>
          <h1
            className={`mt-3 text-2xl font-extrabold ${
              app.eligible ? "text-success" : "text-danger"
            }`}
          >
            {app.eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}
          </h1>
          <p className="mt-2 text-sm">
            {app.eligible
              ? "Your details meet every recorded condition. This is not yet an approval."
              : "One or more conditions were not met or information was missing."}
          </p>
          <p className="mt-4 text-sm font-bold">{app.scholarship_name}</p>
          <p className="text-sm">Application ID: {app.id}</p>
        </div>
        <div className="p-4 sm:p-5">
          <RuleList rules={app.rules} />
        </div>
      </Card>

      {app.is_duplicate && (
        <div className="mt-5 rounded-lg border border-warning bg-warning-soft p-4">
          <p className="font-extrabold text-warning">
            Potential Duplicate Application
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            This application matches an existing Student ID, email, scholarship
            and academic year. It remains available for administrator review.
          </p>
        </div>
      )}

      {/* Automatic Alternative Scholarship Recommendations */}
      {isUnsuccessful && !adminPanel && (
        <section className="mt-7 space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 sm:p-6 shadow-xs">
            <div className="flex items-start gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                <Award size={22} />
              </span>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                  Don't Give Up! You Have Other Scholarship Opportunities.
                </h2>
                <p className="mt-1 text-sm text-muted-foreground font-medium">
                  You may be eligible for these scholarships based on your profile.
                </p>
              </div>
            </div>

            {eligibleAlternatives.length > 0 ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {eligibleAlternatives.map(({ scholarship: s, match }) => {
                  const passReasons = match.checks
                    .filter((c) => c.status === "pass")
                    .slice(0, 3);
                  return (
                    <Card
                      key={s.id}
                      className="flex flex-col justify-between p-5 border shadow-sm hover:border-primary/40 transition"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {s.provider_type}
                            </span>
                            <h3 className="font-extrabold text-base leading-snug mt-0.5 text-foreground">
                              {s.name}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {s.provider}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-success-soft text-success px-2.5 py-1 text-[11px] font-extrabold border border-success/20">
                            ELIGIBLE
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs py-2 border-y border-border/60">
                          <div>
                            <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                              Amount
                            </span>
                            <span className="font-extrabold text-foreground text-sm">
                              {s.amount}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                              Deadline
                            </span>
                            <span className="font-semibold text-foreground text-xs flex items-center gap-1 mt-0.5">
                              <Clock3 size={13} className="text-muted-foreground shrink-0" />
                              {s.closing_date
                                ? (isClosed(s)
                                    ? `Closed ${prettyDate(s.closing_date)}`
                                    : `Closes ${prettyDate(s.closing_date)}`)
                                : "Open / Ongoing"}
                            </span>
                          </div>
                        </div>

                        {passReasons.length > 0 && (
                          <div className="mt-3">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-1">
                              Why You Qualify
                            </p>
                            <ul className="space-y-1 text-xs">
                              {passReasons.map((c) => (
                                <li key={c.label} className="flex items-start gap-1.5 text-foreground/90">
                                  <Check size={14} className="text-success shrink-0 mt-0.5" />
                                  <span>
                                    <b className="font-bold">{c.label}:</b> {c.reason}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="mt-3 text-xs text-muted-foreground">
                          <span className="font-bold text-[10px] uppercase block tracking-wider mb-0.5">
                            Required Documents
                          </span>
                          <p className="truncate">
                            {s.documents.length
                              ? s.documents.join(", ")
                              : "Standard academic documents"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t">
                        {s.in_database !== false ? (
                          <Button
                            onClick={() => {
                              if (onApply) onApply(s.id);
                            }}
                            className="w-full font-bold shadow-sm"
                          >
                            Apply Now
                            <ArrowRight size={16} />
                          </Button>
                        ) : s.application_url ? (
                          <a
                            href={s.application_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-bold text-secondary-foreground hover:opacity-90 transition"
                          >
                            Official Portal
                            <ArrowRight size={16} />
                          </a>
                        ) : (
                          <Button disabled variant="outline" className="w-full font-bold">
                            Official Portal Only
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-dashed border-border p-6 text-center bg-card">
                <p className="text-sm font-semibold text-foreground">
                  {additionalInfoAlternatives.length > 0
                    ? "No immediate full matches found, but you have scholarships waiting for complete profile information."
                    : "No alternative eligible scholarships match your current recorded profile right now."}
                </p>
                <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                  {additionalInfoAlternatives.length > 0
                    ? `There are ${additionalInfoAlternatives.length} active scholarships that could match if you update details like marks, income, or category in your profile.`
                    : "Keep your profile up to date or browse the full scholarship directory to explore emerging opportunities."}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  {go && (
                    <Button variant="outline" className="h-9 px-3 text-xs" onClick={() => go("profile")}>
                      Update Profile
                    </Button>
                  )}
                  {go && (
                    <Button variant="secondary" className="h-9 px-3 text-xs" onClick={() => go("scholarships")}>
                      Browse All Scholarships
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {!resultOnly && (
        <>
          <Card className="mt-5 p-5">
            <h2 className="text-base font-extrabold">Application Status</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <InfoItem label="Student Name" value={app.full_name} />
              <InfoItem label="Scholarship" value={app.scholarship_name} />
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Current Status</p>
                <div className="mt-1">
                  <StatusBadge status={app.status} />
                </div>
              </div>
            </div>
            {disb && (
              <div className="mt-5 rounded-lg border p-4">
                <p className="text-xs font-extrabold uppercase text-primary">Disbursement Record</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  <InfoItem label="Amount" value={formatMoney(Number(disb.amount))} />
                  <InfoItem
                    label="Payment"
                    value={disb.status === "COMPLETED" ? "Payment recorded" : "Awaiting payment"}
                  />
                  <InfoItem
                    label="Reference"
                    value={
                      disb.status === "COMPLETED"
                        ? `${disb.payment_reference} · ${prettyDate(disb.payment_date)}`
                        : "Not yet paid"
                    }
                  />
                </div>
              </div>
            )}
            {!!app.application_documents?.length && !adminPanel && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-extrabold uppercase text-primary">Required Documents Checklist</p>
                <div className="space-y-2">
                  {app.application_documents.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 p-3 text-sm"
                    >
                      <span className="font-medium text-foreground">{d.document_name}</span>
                      <span
                        className={`shrink-0 text-[11px] font-extrabold ${
                          d.verified
                            ? "text-success"
                            : d.provided
                            ? "text-info"
                            : "text-muted-foreground"
                        }`}
                      >
                        {d.verified ? "VERIFIED" : d.provided ? "READY" : "NOT READY"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
          <Timeline app={app} />
        </>
      )}
      {adminPanel}
    </div>
  );
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

function ProfilePage({
  profile,
  apps,
  scholarships,
  saved,
  openApp,
  openSch,
  logout,
  onSaved,
}: {
  profile: Profile;
  apps: Application[];
  scholarships: Scholarship[];
  saved: string[];
  openApp: (id: string) => void;
  openSch: (id: string) => void;
  logout: () => void;
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);

  const buildFormFromProfile = useCallback(() => {
    const [pFirst = "", ...pRestLast] = (profile.full_name || "").trim().split(/\s+/);
    const pLast = pRestLast.join(" ");
    const pDegree = profile.course
      ? (DEGREE_OPTIONS as readonly string[]).includes(profile.course)
        ? profile.course
        : "Other"
      : "";
    const pCustomDegree =
      profile.course && !(DEGREE_OPTIONS as readonly string[]).includes(profile.course)
        ? profile.course
        : "";
    const pBranch = profile.course_stream
      ? (BRANCH_OPTIONS as readonly string[]).includes(profile.course_stream)
        ? profile.course_stream
        : "Other"
      : "";
    const pCustomBranch =
      profile.course_stream && !(BRANCH_OPTIONS as readonly string[]).includes(profile.course_stream)
        ? profile.course_stream
        : "";
    return {
      firstName: pFirst,
      lastName: pLast,
      student_id: profile.student_id ?? "",
      phone: profile.phone ?? "",
      college: profile.college ?? "",
      department: profile.department ?? "",
      degree: pDegree,
      customDegree: pCustomDegree,
      branch: pBranch,
      customBranch: pCustomBranch,
      study_level: profile.study_level ?? "",
      year: profile.year_of_study?.toString() ?? "",
      gender: profile.gender ?? "",
      use: profile.use_gender_for_matching,
      pct: profile.academic_percentage?.toString() ?? "",
      income: profile.family_income?.toString() ?? "",
      category: profile.category ?? "",
    };
  }, [profile]);

  const [f, setF] = useState(buildFormFromProfile);

  useEffect(() => {
    if (!editing) {
      setF(buildFormFromProfile());
      setErr("");
    }
  }, [editing, buildFormFromProfile]);

  const [err, setErr] = useState("");
  const set = (k: keyof typeof f, v: string | boolean) => setF({ ...f, [k]: v });

  async function save(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (!f.firstName.trim()) return setErr("First name is required.");
    if (!f.lastName.trim()) return setErr("Last name is required.");
    if (f.pct && (+f.pct < 0 || +f.pct > 100))
      return setErr("Academic percentage must be 0–100.");
    if (f.income && +f.income < 0) return setErr("Income cannot be negative.");
    if (f.phone && !/^\d{10}$/.test(f.phone))
      return setErr("Phone must have 10 digits.");
    if (f.degree === "Other" && !f.customDegree.trim())
      return setErr("Please specify your custom degree.");
    if (f.branch === "Other" && !f.customBranch.trim())
      return setErr("Please specify your custom branch.");

    const fullName = `${f.firstName.trim()} ${f.lastName.trim()}`;
    const resolvedDegree = (
      f.degree === "Other" ? f.customDegree.trim() : f.degree
    ).trim();
    const resolvedBranch = (
      f.branch === "Other" ? f.customBranch.trim() : f.branch
    ).trim();

    try {
      await api.saveProfile({
        id: profile.id,
        email: profile.email,
        full_name: fullName,
        student_id: f.student_id || null,
        phone: f.phone || null,
        college: f.college || null,
        department: f.department || null,
        course: resolvedDegree || null, // Degree -> course
        course_stream: resolvedBranch || null, // Branch -> course_stream
        study_level: f.study_level || null,
        year_of_study: f.year ? Number(f.year) : null,
        gender: f.gender || null,
        use_gender_for_matching: f.use,
        academic_percentage: f.pct === "" ? null : +f.pct,
        family_income: f.income === "" ? null : +f.income,
        category: f.category || null,
      });
      toast.success("Profile updated");
      await onSaved();
      setEditing(false);
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  }

  const savedList = scholarships.filter((s) => saved.includes(s.id));
  const initials = (profile.full_name || profile.email)
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="animate-rise">
      <PageTitle
        title="Student Profile"
        subtitle="Your details are used to match scholarships."
        action={
          !editing && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit Profile
            </Button>
          )
        }
      />
      {editing ? (
        <form onSubmit={save} className="space-y-5">
          <FormSection title="Personal Details" icon={<UserRound size={19} />}>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="First Name"
                  value={f.firstName}
                  onChange={(v) => set("firstName", v)}
                  placeholder="Enter first name"
                />
                <Field
                  label="Last Name"
                  value={f.lastName}
                  onChange={(v) => set("lastName", v)}
                  placeholder="Enter last name"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Student ID / Roll No"
                  value={f.student_id}
                  onChange={(v) => set("student_id", v)}
                  placeholder="XX09XXXXXX"
                  required={false}
                />
                <Field
                  label="Phone"
                  value={f.phone}
                  onChange={(v) => set("phone", v.replace(/\D/g, "").slice(0, 10))}
                  required={false}
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Academic Details" icon={<BookOpen size={19} />}>
            <div className="space-y-4">
              <CollegeAutocomplete
                value={f.college}
                onChange={(v) => set("college", v)}
                required={false}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <SearchableSelect
                  label="Degree"
                  required={false}
                  value={f.degree}
                  onChange={(v) => set("degree", v)}
                  options={DEGREE_OPTIONS}
                  placeholder="Select degree"
                  searchPlaceholder="Search degrees (e.g. B.Tech, M.Tech, B.Sc...)"
                  customValue={f.customDegree}
                  onCustomChange={(v) => set("customDegree", v)}
                  customPlaceholder="Specify custom degree"
                />
                <SearchableSelect
                  label="Branch"
                  required={false}
                  value={f.branch}
                  onChange={(v) => set("branch", v)}
                  options={BRANCH_OPTIONS}
                  placeholder="Select branch"
                  searchPlaceholder="Search branches (e.g. CSE, AI & ML, ECE...)"
                  customValue={f.customBranch}
                  onCustomChange={(v) => set("customBranch", v)}
                  customPlaceholder="Specify custom branch"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField
                  label="Study Level"
                  required={false}
                  value={f.study_level}
                  onChange={(v) => set("study_level", v)}
                  options={STUDY_LEVELS}
                  placeholder="Not provided"
                />
                <SelectField
                  label="Year of Study"
                  required={false}
                  value={f.year}
                  onChange={(v) => set("year", v)}
                  options={["1", "2", "3", "4", "5"]}
                  placeholder="Not provided"
                />
                <Field
                  label="Academic Percentage"
                  type="number"
                  value={f.pct}
                  onChange={(v) => set("pct", v)}
                  required={false}
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Financial, Category & Privacy"
            icon={<Lock size={19} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Annual Family Income (₹)"
                type="number"
                value={f.income}
                onChange={(v) => set("income", v)}
                required={false}
              />
              <SelectField
                label="Category"
                required={false}
                value={f.category}
                onChange={(v) => set("category", v)}
                options={CATEGORIES}
                placeholder="Not provided"
              />
              <SelectField
                label="Gender"
                required={false}
                value={f.gender}
                onChange={(v) => set("gender", v)}
                options={GENDERS}
                placeholder="Not provided"
              />
            </div>
            <div className="mt-4">
              <GenderPrivacy
                checked={f.use}
                onChange={(v) => set("use", v)}
              />
            </div>
          </FormSection>

          {err && (
            <div
              role="alert"
              className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {err}
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit">Save Profile</Button>
            <Button
              variant="outline"
              onClick={() => {
                setF(buildFormFromProfile());
                setErr("");
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Card className="overflow-hidden">
          <div className="bg-accent/60 p-6 text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary text-2xl font-extrabold text-primary-foreground">
              {initials}
            </div>
            <h2 className="mt-3 text-xl font-extrabold">
              {profile.full_name || "Name not set"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {profile.student_id ?? "Student ID not set"}
            </p>
          </div>
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            {(
              [
                ["Degree", profile.course],
                ["Branch", profile.course_stream],
                ["Study Level", profile.study_level],
                ["Year", profile.year_of_study ? `Year ${profile.year_of_study}` : null],
                ["Email", profile.email],
                ["College", profile.college],
                [
                  "Academic Percentage",
                  profile.academic_percentage != null
                    ? `${profile.academic_percentage}%`
                    : null,
                ],
                [
                  "Family Income",
                  profile.family_income != null
                    ? formatMoney(Number(profile.family_income))
                    : null,
                ],
                ["Category", profile.category],
                [
                  "Gender (private)",
                  profile.gender
                    ? `${profile.gender}${
                        profile.use_gender_for_matching
                          ? ""
                          : " · not used for matching"
                      }`
                    : null,
                ],
              ] as const
            ).map(([l, v]) => (
              <InfoItem key={l} label={l} value={v ?? "Not provided"} />
            ))}
          </div>
        </Card>
      )}

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-extrabold">Saved Scholarships</h2>
        {savedList.map((s) => (
          <button
            key={s.id}
            onClick={() => openSch(s.id)}
            className="mb-3 grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-lg border bg-card p-4 text-left"
          >
            <div className="min-w-0">
              <b className="block truncate">{s.name}</b>
              <p className="text-sm text-muted-foreground">{s.amount}</p>
            </div>
            <ChevronRight size={18} className="text-muted-foreground" />
          </button>
        ))}
        {!savedList.length && (
          <p className="text-sm text-muted-foreground">No saved scholarships yet.</p>
        )}
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-extrabold">My Applications</h2>
        {apps.slice(0, 3).map((a) => (
          <button
            key={a.id}
            onClick={() => openApp(a.id)}
            className="mb-3 grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-lg border bg-card p-4 text-left"
          >
            <div className="min-w-0">
              <b>{a.id}</b>
              <p className="truncate text-sm text-muted-foreground">
                {a.scholarship_name}
              </p>
            </div>
            <StatusBadge status={a.status} />
          </button>
        ))}
        {!apps.length && (
          <p className="text-sm text-muted-foreground">No applications yet.</p>
        )}
      </div>

      <Button variant="danger" className="mt-4 w-full sm:w-auto" onClick={logout}>
        <LogOut size={17} />
        Sign Out
      </Button>
    </div>
  );
}

/* ---------------- Admin ---------------- */
type AdminProps = { view: View; go: (v: View) => void; apps: Application[]; scholarships: Scholarship[]; selected?: Application | undefined; openApp: (id: string) => void; logout: () => void; reload: () => Promise<void>; adminId: string; adminEmail: string };
function AdminArea({ view, go, apps, scholarships, selected, openApp, logout, reload, adminId, adminEmail }: AdminProps) {
  if (view === "admin-scholarships") return <AdminScholarships scholarships={scholarships} reload={reload} />;
  if (view === "applications") return <ApplicationsList apps={apps} openApp={openApp} admin />;
  if (view === "profile") return <div><PageTitle title="Admin Profile" subtitle="Scholarship management and review access." /><Card className="max-w-xl p-6"><div className="flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-xl bg-info-soft text-info"><ShieldCheck size={28} /></div><div><h2 className="font-extrabold">ScholarShield Administrator</h2><p className="text-sm text-muted-foreground">{adminEmail || "admin@scholarshield.com"}</p></div></div><Button variant="danger" className="mt-6" onClick={logout}><LogOut size={17} />Sign Out</Button></Card></div>;
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
  const disb = getDisb(app); const [amount, setAmount] = useState(""); const [ref, setRef] = useState(""); const [payDate, setPayDate] = useState(today()); const [decisionNote, setDecisionNote] = useState(""); const [busy, setBusy] = useState(false);
  const locked = app.status === "DISBURSEMENT PENDING" || app.status === "DISBURSED";
  async function run(label: string, fn: () => Promise<void>, extraConfirm = "") {
    if (!confirm(`${extraConfirm}${label} for ${app.id}?`)) return; setBusy(true);
    try { await fn(); toast.success(`${label}: done`); setDecisionNote(""); await reload(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  const status = (s: Status, fallbackNote: string) => {
    const trimmed = decisionNote.trim();
    const note = trimmed || fallbackNote;
    const warnings: string[] = [];
    if (s === "APPROVED" && !app.eligible) warnings.push("WARNING: Automated checks marked this application NOT ELIGIBLE.");
    if (s === "APPROVED" && app.is_duplicate) warnings.push("WARNING: This application is flagged as a POTENTIAL DUPLICATE.");
    const prefix = warnings.length ? `${warnings.join(" ")}\n\n` : "";
    return run(note, () => api.setStatus(app.id, s, note), prefix);
  };
  return <>
    <Card className="mt-5 p-5"><h2 className="text-base font-extrabold">Application Information</h2><div className="mt-5 space-y-6">
      <DetailGroup title="Student Information" items={[["Name", app.full_name], ["Student ID", app.student_id], ["Email", app.email], ["Phone", app.phone], ["Gender (private)", app.gender ?? "Not provided"]]} />
      <DetailGroup title="Academic Information" items={[["College", app.college], ["Course", app.course], ["Stream / Level", `${app.course_stream ?? "—"} / ${app.study_level ?? "—"}`], ["Year", app.year_of_study ? `Year ${app.year_of_study}` : "—"], ["Academic Year", app.academic_year], ["Academic Percentage", `${app.academic_percentage}%`], ["Attendance", `${app.attendance}%`]]} />
      <DetailGroup title="Financial & Scholarship" items={[["Annual Family Income", formatMoney(app.family_income)], ["Category", app.category], ["Scholarship", app.scholarship_name]]} />
      <DetailGroup title="Duplicate Check" items={[["Result", app.is_duplicate ? "Potential Duplicate" : "Clear"]]} />
    </div></Card>
    {!!app.application_documents?.length && <Card className="mt-5 p-5"><h2 className="text-base font-extrabold">Documents</h2><div className="mt-3 space-y-2">{app.application_documents.map((d) => <label key={d.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 p-3 text-sm"><span>{d.document_name} <span className="text-xs text-muted-foreground">({d.provided ? "student has it ready" : "not marked ready"})</span></span><span className="flex shrink-0 items-center gap-2 text-xs font-bold"><input type="checkbox" disabled={busy || locked} checked={d.verified} onChange={async (e) => { setBusy(true); try { await api.verifyDocument(d.id, e.target.checked); await reload(); } catch (er) { toast.error((er as Error).message); } finally { setBusy(false); } }} className="h-4 w-4 accent-primary disabled:cursor-not-allowed disabled:opacity-50" />Verified</span></label>)}</div></Card>}
    <Card className="mt-5 p-5"><h2 className="text-base font-extrabold">Admin Actions</h2>
      {(!app.eligible || app.is_duplicate) && !locked && (
        <div className="mt-3 rounded-lg border border-warning bg-warning-soft/50 px-3 py-2 text-xs font-semibold text-foreground">
          {!app.eligible && <p>Heads up: Automated eligibility rules rated this submission Not Eligible.</p>}
          {app.is_duplicate && <p>Heads up: Duplicate fingerprint detected for this student, scholarship, and academic year.</p>}
        </div>
      )}
      <div className="mt-4 max-w-xl">
        <Field
          label="Decision / Rejection Reason Note"
          value={decisionNote}
          onChange={setDecisionNote}
          required={false}
          disabled={busy || locked}
          placeholder="Optional note or custom rejection reason (recorded in application history)"
        />
      </div>
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
