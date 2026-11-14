// ============================================================================
// LAYER D: REAL SUPABASE STORAGE HTTP BOUNDARY TESTS
// Mode: [DESIGNED – NOT EXECUTED]
// File: tests/storage-http.test.ts
// Reconciled: C-41, C-46 (Robust HTTP Error Handling & Endpoint Authorization)
// ============================================================================

import { describe, it, expect } from "vitest";

describe("Layer D: Real Supabase Storage HTTP Boundary Enforcement", () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
  const studentJwt = process.env.STUDENT_A_JWT || "dummy_jwt";
  const STORAGE_ENDPOINT = `${supabaseUrl}/storage/v1/object/scholarship-documents`;

  it("[TC-20] Storage API rejects oversized upload (> 5MB) with 400 or 413 (C-46)", async () => {
    const oversizedBuffer = new Uint8Array(6 * 1024 * 1024); // 6 MB payload
    const formData = new FormData();
    formData.append("file", new Blob([oversizedBuffer], { type: "application/pdf" }), "oversized.pdf");

    const res = await fetch(`${STORAGE_ENDPOINT}/SS-2026-901/oversized.pdf`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentJwt}` },
      body: formData,
    });

    // C-46: Supabase deployments may return HTTP 413 (Kong/Gateway) or HTTP 400 (Storage service)
    expect([400, 413]).toContain(res.status);

    const json = await res.json().catch(() => ({}));
    if (res.status === 400) {
      expect(JSON.stringify(json)).toMatch(/exceeded the maximum allowed size|payload too large/i);
    }
  });

  it("[TC-21] Storage API rejects disallowed MIME type with 400, 415, or 422 (C-46)", async () => {
    const exeBuffer = new Uint8Array(2048);
    const formData = new FormData();
    formData.append("file", new Blob([exeBuffer], { type: "application/x-msdownload" }), "malicious.exe");

    const res = await fetch(`${STORAGE_ENDPOINT}/SS-2026-901/malicious.exe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentJwt}` },
      body: formData,
    });

    expect(res.ok).toBe(false);
    expect([400, 415, 422]).toContain(res.status);

    const json = await res.json().catch(() => ({}));
    expect(JSON.stringify(json)).toMatch(/mime type not allowed|row-level security|invalid media/i);
  });
});
