// Data service: every database read/write the UI performs goes through here.
// Row-level security in the database decides what each signed-in user may see or change.
import { supabase } from "@/integrations/supabase/client";
import type { Application, Profile, Role, Scholarship, Status } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as any;

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function getRole(userId: string): Promise<Role> {
  const rows = check(await db.from("user_roles").select("role").eq("user_id", userId)) as { role: Role }[];
  return rows.some((r) => r.role === "admin") ? "admin" : "student";
}
export async function getProfile(userId: string): Promise<Profile | null> {
  return check(await db.from("profiles").select("*").eq("id", userId).maybeSingle()) as Profile | null;
}
export async function saveProfile(p: Partial<Profile> & { id: string }) {
  check(await db.from("profiles").upsert(p, { onConflict: "id" }));
}

export async function listScholarships(): Promise<Scholarship[]> {
  const rows = check(await db.from("scholarships").select("*").order("id")) as Scholarship[];
  return rows.map((s) => ({ ...s, max_income: s.max_income == null ? null : Number(s.max_income), min_percentage: s.min_percentage == null ? null : Number(s.min_percentage) }));
}
export async function saveScholarship(s: Scholarship, isNew: boolean) {
  if (isNew) check(await db.from("scholarships").insert(s));
  else { const { id, ...rest } = s; check(await db.from("scholarships").update(rest).eq("id", id)); }
}
export async function deleteScholarship(id: string) { check(await db.from("scholarships").delete().eq("id", id)); }
export async function setScholarshipActive(id: string, active: boolean) { check(await db.from("scholarships").update({ is_active: active }).eq("id", id)); }

export async function listSaved(userId: string): Promise<string[]> {
  return (check(await db.from("saved_scholarships").select("scholarship_id").eq("user_id", userId)) as { scholarship_id: string }[]).map((r) => r.scholarship_id);
}
export async function toggleSaved(userId: string, scholarshipId: string, saved: boolean) {
  if (saved) check(await db.from("saved_scholarships").delete().eq("user_id", userId).eq("scholarship_id", scholarshipId));
  else check(await db.from("saved_scholarships").insert({ user_id: userId, scholarship_id: scholarshipId }));
}

const APP_SELECT = "*, application_history(id,status,note,created_at), disbursements(id,amount,status,payment_reference,payment_date), application_documents(id,document_name,provided,verified)";
export async function listApplications(): Promise<Application[]> {
  const rows = check(await db.from("applications").select(APP_SELECT).order("submitted_at", { ascending: false }).order("id", { ascending: false })) as Application[];
  return rows.map((a) => ({
    ...a, academic_percentage: Number(a.academic_percentage), attendance: Number(a.attendance), family_income: Number(a.family_income),
    application_history: [...(a.application_history ?? [])].sort((x, y) => x.created_at.localeCompare(y.created_at)),
  }));
}
export async function submitApplication(app: Record<string, unknown>, documents: { name: string; provided: boolean }[]): Promise<string> {
  const row = check(await db.from("applications").insert(app).select("id").single()) as { id: string };
  if (documents.length) check(await db.from("application_documents").insert(documents.map((d) => ({ application_id: row.id, document_name: d.name, provided: d.provided }))));
  return row.id;
}
export async function setStatus(id: string, status: Status, note: string) {
  check(await db.from("applications").update({ status, status_note: note }).eq("id", id));
}
export async function startDisbursement(applicationId: string, amount: number, adminId: string) {
  check(await db.from("disbursements").insert({ application_id: applicationId, amount, recorded_by: adminId }));
}
export async function recordPayment(disbursementId: string, reference: string, date: string) {
  check(await db.from("disbursements").update({ status: "COMPLETED", payment_reference: reference, payment_date: date }).eq("id", disbursementId));
}
export async function verifyDocument(id: string, verified: boolean) { check(await db.from("application_documents").update({ verified }).eq("id", id)); }
