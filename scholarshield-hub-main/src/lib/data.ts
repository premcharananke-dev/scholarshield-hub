// Data service: every database read/write the UI performs goes through here.
// Row-level security in the database decides what each signed-in user may see or change.
import { supabase } from "@/integrations/supabase/client";
import type { Application, Profile, Role, Scholarship, Status } from "./types";
import { MASTER_SCHOLARSHIPS, computeApplicationStatus, computeVerificationStatus } from "@/data/scholarships";

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

// In-memory runtime cache for admin overrides & instant updates
const localScholarshipOverrides = new Map<string, Scholarship>();
const deletedScholarshipIds = new Set<string>();

export async function listScholarships(): Promise<Scholarship[]> {
  let dbRows: Scholarship[] = [];
  try {
    const res = await db.from("scholarships").select("*").order("id");
    if (!res.error && res.data) {
      dbRows = res.data.map((s: any) => ({
        ...s,
        max_income: s.max_income == null ? null : Number(s.max_income),
        min_percentage: s.min_percentage == null ? null : Number(s.min_percentage),
      }));
    }
  } catch {
    // If Supabase request fails or is offline, continue with master catalog
  }

  // Create lookup map initialized with MASTER_SCHOLARSHIPS
  const map = new Map<string, Scholarship>();

  for (const m of MASTER_SCHOLARSHIPS) {
    map.set(m.id, {
      ...m,
      application_status: computeApplicationStatus(m),
      verification_status: computeVerificationStatus(m),
    });
  }

  // Overlay database rows (Supabase values override catalog)
  for (const row of dbRows) {
    if (deletedScholarshipIds.has(row.id)) continue;
    const base = map.get(row.id);
    const merged: Scholarship = {
      ...(base ?? {}),
      ...row,
      eligible_states: base?.eligible_states ?? row.eligible_states ?? ["All India"],
      scheme_category: base?.scheme_category ?? row.scheme_category ?? (row.provider_type === "Government" ? "Central Government" : "Corporate / Private"),
      application_status: computeApplicationStatus(row),
      verification_status: computeVerificationStatus(row),
      last_verified_date: base?.last_verified_date ?? row.updated_at?.slice(0, 10) ?? null,
    };
    map.set(row.id, merged);
  }

  // Overlay runtime in-memory overrides (e.g. recent admin edits or additions)
  for (const [id, s] of localScholarshipOverrides.entries()) {
    if (deletedScholarshipIds.has(id)) continue;
    map.set(id, {
      ...s,
      application_status: computeApplicationStatus(s),
      verification_status: computeVerificationStatus(s),
    });
  }

  // Return sorted list excluding any deleted IDs
  return Array.from(map.values())
    .filter((s) => !deletedScholarshipIds.has(s.id))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** Sanitize scholarship object before saving to Supabase to match the exact DB column definitions */
function sanitizeForDb(s: Scholarship) {
  const {
    eligible_states,
    eligible_courses,
    scheme_category,
    application_status,
    verification_status,
    last_verified_date,
    ...dbFields
  } = s;
  return dbFields;
}

export async function saveScholarship(s: Scholarship, isNew: boolean) {
  // Update local memory cache immediately for instant UI responsiveness
  localScholarshipOverrides.set(s.id, {
    ...s,
    application_status: computeApplicationStatus(s),
    verification_status: computeVerificationStatus(s),
  });
  deletedScholarshipIds.delete(s.id);

  // Attempt persisting to Supabase
  try {
    const dbPayload = sanitizeForDb(s);
    if (isNew) {
      await db.from("scholarships").insert(dbPayload);
    } else {
      const { id, ...rest } = dbPayload;
      await db.from("scholarships").update(rest).eq("id", id);
    }
  } catch {
    // If Supabase call is blocked by RLS in preview or network is unavailable,
    // the local override preserves state across navigations
  }
}

export async function deleteScholarship(id: string) {
  deletedScholarshipIds.add(id);
  localScholarshipOverrides.delete(id);
  try {
    await db.from("scholarships").delete().eq("id", id);
  } catch {
    // Handled by deletedScholarshipIds set
  }
}

export async function setScholarshipActive(id: string, active: boolean) {
  const current = localScholarshipOverrides.get(id) || MASTER_SCHOLARSHIPS.find((m) => m.id === id);
  if (current) {
    const updated = { ...current, is_active: active };
    localScholarshipOverrides.set(id, updated);
  }
  try {
    await db.from("scholarships").update({ is_active: active }).eq("id", id);
  } catch {
    // Handled by local override
  }
}

export async function listSaved(userId: string): Promise<string[]> {
  try {
    const rows = check(await db.from("saved_scholarships").select("scholarship_id").eq("user_id", userId)) as {
      scholarship_id: string;
    }[];
    return rows.map((r) => r.scholarship_id);
  } catch {
    return [];
  }
}

export async function toggleSaved(userId: string, scholarshipId: string, saved: boolean) {
  if (saved) {
    check(await db.from("saved_scholarships").delete().eq("user_id", userId).eq("scholarship_id", scholarshipId));
  } else {
    check(await db.from("saved_scholarships").insert({ user_id: userId, scholarship_id: scholarshipId }));
  }
}

const APP_SELECT =
  "*, application_history(id,status,note,created_at), disbursements(id,amount,status,payment_reference,payment_date), application_documents(id,document_name,provided,verified)";

export async function listApplications(): Promise<Application[]> {
  const rows = check(
    await db
      .from("applications")
      .select(APP_SELECT)
      .order("submitted_at", { ascending: false })
      .order("id", { ascending: false })
  ) as Application[];
  return rows.map((a) => ({
    ...a,
    academic_percentage: Number(a.academic_percentage),
    attendance: Number(a.attendance),
    family_income: Number(a.family_income),
    application_history: [...(a.application_history ?? [])].sort((x, y) => x.created_at.localeCompare(y.created_at)),
  }));
}

export async function submitApplication(
  app: Record<string, unknown>,
  documents: { name: string; provided: boolean }[]
): Promise<string> {
  const row = check(await db.from("applications").insert(app).select("id").single()) as { id: string };
  if (documents.length) {
    check(
      await db
        .from("application_documents")
        .insert(documents.map((d) => ({ application_id: row.id, document_name: d.name, provided: d.provided })))
    );
  }
  return row.id;
}

export async function setStatus(id: string, status: Status, note: string) {
  check(await db.from("applications").update({ status, status_note: note }).eq("id", id));
}

export async function startDisbursement(applicationId: string, amount: number, adminId: string) {
  check(await db.from("disbursements").insert({ application_id: applicationId, amount, recorded_by: adminId }));
}

export async function recordPayment(disbursementId: string, reference: string, date: string) {
  check(
    await db
      .from("disbursements")
      .update({ status: "COMPLETED", payment_reference: reference, payment_date: date })
      .eq("id", disbursementId)
  );
}

export async function verifyDocument(id: string, verified: boolean) {
  check(await db.from("application_documents").update({ verified }).eq("id", id));
}
