// ============================================================================
// LAYER C: ADMINISTRATIVE VERIFICATION & AUDIT OPERATIONS
// Mode: [DESIGNED – NOT EXECUTED]
// File: tests/admin-api.test.ts
// Reconciled: C-18, C-41 (Admin Verified-Document Download & Supported Auth)
// ============================================================================

import { describe, it, expect, beforeAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

describe("Layer C: Administrative Verification & Download Operations", () => {
  let adminClient: SupabaseClient;

  beforeAll(() => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key";
    const adminJwt = process.env.ADMIN_JWT;

    if (!adminJwt) {
      throw new Error("Missing required test environment variable: ADMIN_JWT must be set.");
    }

    // C-41 FIX: Initialize admin client using anon key and admin Authorization header
    adminClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${adminJwt}` } },
    });
  });

  it("[TC-17] Admin can read and download verified documents (C-18 Verified Read Access)", async () => {
    const { data: blob, error } = await adminClient.storage
      .from("scholarship-documents")
      .download("SS-2026-901/income.pdf");

    expect(error).toBeNull();
    expect(blob).not.toBeNull();
    expect(blob?.size).toBeGreaterThan(0);
  });

  it("[TC-18] Admin cannot delete verified physical object from Storage without revoking verification in DB first", async () => {
    const { data, error } = await adminClient.storage
      .from("scholarship-documents")
      .remove(["SS-2026-901/income.pdf"]);

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/row-level security|permission denied/i);
  });

  it("[TC-19] Admin can successfully revoke verification in DB and then delete or replace the file", async () => {
    // Step 1: Revoke verification in PostgreSQL (isolated statement without changing storage_path)
    const { error: revokeErr } = await adminClient
      .from("application_documents")
      .update({ verified: false, verification_notes: "Re-upload requested by admin" })
      .eq("storage_path", "SS-2026-901/income.pdf");

    expect(revokeErr).toBeNull();

    // Step 2: Now that verified = false, storage object deletion is permitted
    const { data: removeData, error: removeErr } = await adminClient.storage
      .from("scholarship-documents")
      .remove(["SS-2026-901/income.pdf"]);

    expect(removeErr).toBeNull();
  });
});
