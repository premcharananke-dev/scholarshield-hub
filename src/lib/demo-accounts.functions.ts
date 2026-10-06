// Ensures the two documented demo accounts exist (student + admin).
// Idempotent and limited to these fixed demo emails only.
import { createServerFn } from "@tanstack/react-start";

const DEMO_PASSWORD = "scholar123";
const DEMO = {
  student: "student@scholarshield.com",
  admin: "admin@scholarshield.com",
} as const;

export const ensureDemoAccounts = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error("Could not prepare demo accounts");

  async function ensure(email: string): Promise<string> {
    const found = list.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found.id;
    const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email, password: DEMO_PASSWORD, email_confirm: true,
    });
    if (createError || !data.user) { console.error("demo account", createError?.message); throw new Error("Could not create demo account"); }
    return data.user.id;
  }

  const studentId = await ensure(DEMO.student);
  const adminId = await ensure(DEMO.admin);

  await supabaseAdmin.from("user_roles").upsert(
    [{ user_id: studentId, role: "student" }, { user_id: adminId, role: "admin" }],
    { onConflict: "user_id,role", ignoreDuplicates: true },
  );
  await supabaseAdmin.from("profiles").upsert(
    {
      id: studentId, full_name: "Aarav Mehta", student_id: "STU-24018", email: DEMO.student,
      college: "City Institute of Technology", department: "Computer Science", course: "B.Tech Computer Science",
      course_stream: "Engineering", study_level: "Undergraduate", year_of_study: 3, gender: "Male",
      academic_percentage: 78, family_income: 180000, category: "OBC",
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  await supabaseAdmin.from("profiles").upsert(
    { id: adminId, full_name: "ScholarShield Administrator", email: DEMO.admin },
    { onConflict: "id", ignoreDuplicates: true },
  );
  // Link the demo student's demo application to the account.
  await supabaseAdmin.from("applications").update({ user_id: studentId }).eq("id", "SS-2026-001").is("user_id", null);
  return { ok: true };
});
