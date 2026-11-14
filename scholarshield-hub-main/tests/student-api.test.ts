// ============================================================================
// LAYER B: AUTHENTICATED STUDENT API TEST SUITE
// Mode: [DESIGNED – NOT EXECUTED]
// File: tests/student-api.test.ts
// Reconciled: C-41 (Supported Supabase JWT Client Initialization)
// ============================================================================

import { describe, it, expect, beforeAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

describe("Layer B: Authenticated Student API Operations", () => {
  let studentA: SupabaseClient;
  let studentB: SupabaseClient;

  beforeAll(() => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key";
    const studentAJwt = process.env.STUDENT_A_JWT;
    const studentBJwt = process.env.STUDENT_B_JWT;

    if (!studentAJwt || !studentBJwt) {
      throw new Error(
        "Missing required test environment variables: STUDENT_A_JWT and STUDENT_B_JWT must be set."
      );
    }

    // C-41 FIX: Initialize Supabase client using anon key and global Authorization header
    studentA = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${studentAJwt}` } },
    });

    studentB = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${studentBJwt}` } },
    });
  });

  it("[TC-15] Student can read own checklist records but receives empty array for Student B (RLS isolation)", async () => {
    const { data: ownDocs, error: ownErr } = await studentA
      .from("application_documents")
      .select("*")
      .eq("application_id", "SS-2026-901");

    expect(ownErr).toBeNull();
    expect(ownDocs?.length).toBeGreaterThan(0);

    const { data: bDocs, error: bErr } = await studentA
      .from("application_documents")
      .select("*")
      .eq("application_id", "SS-2026-902");

    expect(bErr).toBeNull();
    expect(bDocs?.length).toBe(0); // Row-Level Security silently filters unauthorized rows
  });

  it("[TC-16] Student cannot insert document records for another student's application", async () => {
    const { data, error } = await studentA
      .from("application_documents")
      .insert({
        application_id: "SS-2026-902",
        document_name: "Tamper Proof",
        provided: false,
        verified: false,
      })
      .select();

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/row-level security|permission denied/i);
    expect(data).toBeNull();
  });
});
