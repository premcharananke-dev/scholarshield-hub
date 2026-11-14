// Data service: every database read/write the UI performs goes through here.
// Row-level security in the database decides what each signed-in user may see or change.
import { supabase } from "@/integrations/supabase/client";
import type { Application, Profile, Role, Scholarship, Status } from "./types";
import {
  MASTER_SCHOLARSHIPS,
  computeApplicationStatus,
  computeVerificationStatus,
  enrichScholarship,
} from "@/data/scholarships";

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
  const res = await db.from("profiles").upsert(p, { onConflict: "id" });
  if (res.error) {
    const msg = res.error.message ?? "Could not save profile.";
    if (msg.includes("profiles_category_check")) {
      throw new Error(
        `Category "${String(p.category ?? "")}" is not enabled in the database constraint yet. Please run the latest database migration or use General/OBC/SC/ST.`
      );
    }
    throw new Error(msg);
  }
}

const DB_SCHOLARSHIP_COLUMNS = [
  "id",
  "name",
  "provider",
  "provider_type",
  "description",
  "tags",
  "eligible_gender",
  "study_levels",
  "course_streams",
  "eligible_years",
  "max_income",
  "min_percentage",
  "percentage_basis",
  "eligible_categories",
  "amount",
  "benefits",
  "documents",
  "other_conditions",
  "opening_date",
  "closing_date",
  "academic_year",
  "application_url",
  "source_url",
  "unverified_fields",
  "verification_note",
  "is_active",
] as const;

function normalizeTitle(v: string) {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeDbScholarshipRow(s: any): Scholarship {
  return {
    ...s,
    max_income: s.max_income == null ? null : Number(s.max_income),
    min_percentage: s.min_percentage == null ? null : Number(s.min_percentage),
    in_database: true,
  };
}

export async function listScholarships(): Promise<Scholarship[]> {
  let dbRows: Scholarship[] = [];
  try {
    const res = await db.from("scholarships").select("*").order("id");
    if (res.error) {
      console.error("[ScholarShield] Failed to load scholarships from Supabase:", res.error.message);
    } else if (res.data) {
      dbRows = res.data.map(normalizeDbScholarshipRow);
    }
  } catch (err) {
    console.error("[ScholarShield] Error fetching scholarships:", err);
  }

  const masterById = new Map<string, Scholarship>();
  const masterByTitle = new Map<string, Scholarship>();
  for (const m of MASTER_SCHOLARSHIPS) {
    masterById.set(m.id, m);
    masterByTitle.set(normalizeTitle(m.name), m);
  }

  const map = new Map<string, Scholarship>();
  const matchedMasterIds = new Set<string>();

  // 1. Database rows are the authoritative source of truth and always keep their real DB primary key ID.
  for (const row of dbRows) {
    const base = masterById.get(row.id) ?? masterByTitle.get(normalizeTitle(row.name));
    if (base) matchedMasterIds.add(base.id);

    const eligibleCourses = base?.eligible_courses ?? row.eligible_courses;
    const merged: Scholarship = enrichScholarship({
      ...base,
      ...row,
      eligible_states: base?.eligible_states ?? row.eligible_states ?? ["All India"],
      ...(eligibleCourses ? { eligible_courses: eligibleCourses } : {}),
      scheme_category:
        base?.scheme_category ??
        row.scheme_category ??
        (row.provider_type === "Government" ? "Central Government" : "Corporate / Private"),
      application_status: computeApplicationStatus(row),
      verification_status: computeVerificationStatus(row),
      last_verified_date: base?.last_verified_date ?? row.updated_at?.slice(0, 10) ?? null,
      in_database: true,
    });
    map.set(row.id, merged);
  }

  // 2. Append catalog-only reference schemes that are not yet synced to Supabase `public.scholarships`,
  // explicitly marking `in_database: false` so UI/submission flows never emit invalid foreign-key writes.
  for (const m of MASTER_SCHOLARSHIPS) {
    if (matchedMasterIds.has(m.id) || map.has(m.id)) continue;
    map.set(m.id, enrichScholarship({
      ...m,
      in_database: false,
      application_status: computeApplicationStatus(m),
      verification_status: computeVerificationStatus(m),
    }));
  }

  return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** Sanitize scholarship object before saving to Supabase to match exact `public.scholarships` columns */
export function sanitizeForDb(s: Scholarship) {
  const clean: Record<string, unknown> = {};
  const raw = s as unknown as Record<string, unknown>;
  for (const col of DB_SCHOLARSHIP_COLUMNS) {
    if (col === "opening_date" || col === "closing_date" || col === "academic_year" || col === "percentage_basis" || col === "benefits" || col === "application_url" || col === "source_url" || col === "verification_note") {
      clean[col] = raw[col] || null;
    } else if (col === "id" || col === "name" || col === "provider") {
      clean[col] = String(raw[col] ?? "").trim();
    } else if (col === "amount") {
      clean[col] = raw[col] || "Unverified";
    } else {
      clean[col] = raw[col];
    }
  }
  return clean;
}

export async function saveScholarship(s: Scholarship, isNew: boolean) {
  const dbPayload = sanitizeForDb(s);
  if (isNew) {
    check(await db.from("scholarships").insert(dbPayload));
    return;
  }

  const existing = check(await db.from("scholarships").select("id").eq("id", s.id).maybeSingle()) as { id: string } | null;
  if (!existing) {
    check(await db.from("scholarships").insert(dbPayload));
    return;
  }

  const { id, ...rest } = dbPayload;
  check(await db.from("scholarships").update(rest).eq("id", id));
}

export async function deleteScholarship(id: string) {
  check(await db.from("scholarships").delete().eq("id", id));
}

export async function setScholarshipActive(id: string, active: boolean) {
  const existing = check(await db.from("scholarships").select("id").eq("id", id).maybeSingle()) as { id: string } | null;
  if (!existing) {
    const master = MASTER_SCHOLARSHIPS.find((m) => m.id === id);
    if (!master) throw new Error(`Scholarship ${id} not found in database.`);
    check(await db.from("scholarships").insert(sanitizeForDb({ ...master, is_active: active })));
    return;
  }
  check(await db.from("scholarships").update({ is_active: active }).eq("id", id));
}

/** Idempotently insert any master catalog scholarships missing from Supabase `public.scholarships` (Admin only). */
export async function syncMasterScholarshipsToDb(): Promise<{ inserted: number; totalInDb: number }> {
  const existingRows = check(await db.from("scholarships").select("id, name")) as Array<{ id: string; name: string }>;
  const existingIds = new Set(existingRows.map((r) => r.id));
  const existingTitles = new Set(existingRows.map((r) => normalizeTitle(r.name)));

  const missing = MASTER_SCHOLARSHIPS.filter(
    (m) => !existingIds.has(m.id) && !existingTitles.has(normalizeTitle(m.name))
  );

  const chunkSize = 25;
  for (let i = 0; i < missing.length; i += chunkSize) {
    const batch = missing.slice(i, i + chunkSize).map((m) => sanitizeForDb(m));
    check(await db.from("scholarships").upsert(batch, { onConflict: "id", ignoreDuplicates: true }));
  }

  return {
    inserted: missing.length,
    totalInDb: existingRows.length + missing.length,
  };
}

export async function listSaved(userId: string): Promise<string[]> {
  try {
    const rows = check(await db.from("saved_scholarships").select("scholarship_id").eq("user_id", userId)) as {
      scholarship_id: string;
    }[];
    return rows.map((r) => r.scholarship_id);
  } catch (err) {
    console.warn("Unable to load saved scholarships:", err);
    return [];
  }
}

export async function toggleSaved(userId: string, scholarshipId: string, saved: boolean) {
  if (saved) {
    check(await db.from("saved_scholarships").delete().eq("user_id", userId).eq("scholarship_id", scholarshipId));
  } else {
    const existing = check(
      await db.from("scholarships").select("id").eq("id", scholarshipId).maybeSingle()
    ) as { id: string } | null;
    if (!existing) {
      throw new Error(
        "This catalog scholarship has not been synced to the database yet and cannot be bookmarked for in-portal tracking."
      );
    }
    check(await db.from("saved_scholarships").insert({ user_id: userId, scholarship_id: existing.id }));
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
  return rows.map((a) => {
    let mode: "INTERNAL" | "OFFICIAL_PORTAL" = "INTERNAL";
    let extRef: string | null = null;
    if (a.status_note && a.status_note.includes("[Official Portal:")) {
      mode = "OFFICIAL_PORTAL";
      const match = a.status_note.match(/\[Official Portal:\s*([^\]]+)\]/);
      if (match && match[1]) extRef = match[1].trim();
    }
    return {
      ...a,
      academic_percentage: Number(a.academic_percentage),
      attendance: Number(a.attendance),
      family_income: Number(a.family_income),
      application_mode: a.application_mode ?? mode,
      external_reference_number: a.external_reference_number ?? extRef,
      submission_method: (a.application_mode ?? mode) === "OFFICIAL_PORTAL" ? "Official Portal" : "Direct Tracking",
      application_history: [...(a.application_history ?? [])].sort((x, y) => x.created_at.localeCompare(y.created_at)),
    };
  });
}

const DB_APPLICATION_COLUMNS = [
  "id",
  "user_id",
  "scholarship_id",
  "scholarship_name",
  "full_name",
  "student_id",
  "email",
  "phone",
  "college",
  "course",
  "course_stream",
  "study_level",
  "department",
  "year_of_study",
  "academic_year",
  "academic_percentage",
  "attendance",
  "family_income",
  "category",
  "gender",
  "status",
  "status_note",
  "eligible",
  "rules",
  "fingerprint",
  "is_duplicate",
  "is_demo",
];

async function resolveDatabaseScholarship(
  scholarshipId: string,
  scholarshipName: string
): Promise<{ id: string; name: string; academic_year: string | null }> {
  const trimmedId = scholarshipId.trim();
  const trimmedName = scholarshipName.trim();

  if (trimmedId) {
    const byId = check(
      await db.from("scholarships").select("id, name, academic_year").eq("id", trimmedId).maybeSingle()
    ) as { id: string; name: string; academic_year: string | null } | null;
    if (byId) return byId;
  }

  if (trimmedName) {
    const allDb = check(await db.from("scholarships").select("id, name, academic_year")) as Array<{
      id: string;
      name: string;
      academic_year: string | null;
    }>;
    const byTitle = allDb.find((row) => normalizeTitle(row.name) === normalizeTitle(trimmedName));
    if (byTitle) return byTitle;
  }

  throw new Error(
    `Selected scholarship "${trimmedName || trimmedId}" does not exist in the Supabase scholarships table yet. Please ask an administrator to sync the scholarship directory or choose a database-enabled scholarship.`
  );
}

export async function submitApplication(
  app: Record<string, unknown>,
  documents: { name: string; provided: boolean }[]
): Promise<string> {
  const dbScholarship = await resolveDatabaseScholarship(
    typeof app["scholarship_id"] === "string" ? app["scholarship_id"] : "",
    typeof app["scholarship_name"] === "string" ? app["scholarship_name"] : ""
  );

  const rawNote = String(app["status_note"] || "");
  const extRef = app["external_reference_number"] ? String(app["external_reference_number"]).trim() : "";
  const isExternal = app["application_mode"] === "OFFICIAL_PORTAL" || !!extRef;
  const statusNote = isExternal && extRef
    ? `[Official Portal: ${extRef}] ${rawNote || "Application submitted on official portal and tracked in ScholarShield"}`
    : rawNote;

  const dbPayload: Record<string, unknown> = {};
  for (const col of DB_APPLICATION_COLUMNS) {
    if (col === "status_note") {
      dbPayload[col] = statusNote;
    } else if (col in app) {
      dbPayload[col] = app[col];
    }
  }
  dbPayload["scholarship_id"] = dbScholarship.id;
  dbPayload["scholarship_name"] = dbScholarship.name;
  dbPayload["is_demo"] = false;

  const insertRes = await db.from("applications").insert(dbPayload).select("id").single();
  if (insertRes.error) {
    const msg = insertRes.error.message ?? "Failed to submit application.";
    if (msg.includes("applications_category_check")) {
      throw new Error(
        `Category "${String(app["category"] ?? "")}" is not yet enabled in the database check constraint. Ask an admin to run the latest migration or choose General/OBC/SC/ST.`
      );
    }
    throw new Error(msg);
  }
  const row = insertRes.data as { id: string };
  if (documents.length) {
    const docsRes = await db.from("application_documents").insert(
      documents.map((d) => ({
        application_id: row.id,
        document_name: d.name,
        provided: d.provided,
        verified: false,
      }))
    );
    if (docsRes.error) {
      throw new Error(
        `Application ${row.id} was created, but its document checklist failed to save: ${docsRes.error.message}`
      );
    }
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
