# ScholarShield Phase 1: Security Limitations & Verification Boundaries

**Project:** ScholarShield – Scholarship Eligibility & Disbursement System  
**Target:** Supabase PostgreSQL 14/15 + Supabase Private Storage (`scholarship-documents`)  
**Scope:** Phase 1 Document Storage Provisioning, Integrity Triggers, and RLS Hardening  
**Reconciled Defects:** C-26, C-37, C-44

---

## 1. Executive Statement of Architectural Scope

Phase 1 establishes **structural metadata referential integrity, path-based access control, Row-Level Security (RLS) isolation, and tamper-resistant state transitions** between Supabase PostgREST tables and the Supabase Storage catalog (`storage.objects`).

Phase 1 **does not** perform deep binary content inspection, malware analysis, or hardware-enforced Write-Once-Read-Many (WORM) storage.

---

## 2. What Phase 1 Enforces & Guarantees

1. **Referential & Anti-Phantom Integrity:**
   - A document cannot be marked `provided = true` in PostgreSQL unless a matching physical object entry exists in `storage.objects` with `bucket_id = 'scholarship-documents'` and matching path.
2. **Path Containment & Student Isolation:**
   - Storage paths must strictly follow `<application_id>/<filename>`.
   - Non-admin authenticated students can only upload to, read from, or update files within the folder corresponding to their owned application ID (`(storage.foldername(name))[1] IN (SELECT id FROM applications WHERE user_id = auth.uid())`).
3. **Application Lifecycle Lock:**
   - Students cannot upload or modify documents if their application is in a terminal or immutable status (`REJECTED`, `APPROVED`, `DISBURSED`, `DISBURSEMENT PENDING`).
4. **Verified Document Tamper Lock:**
   - Once a document is verified (`verified = true`), neither students nor administrators can modify its `storage_path`, `file_hash`, `file_size`, `file_type`, or `application_id`.
   - Setting `storage_path = NULL` on a verified document is strictly rejected (C-28).
   - In Supabase Storage, verified objects cannot be overwritten (`UPDATE`) or deleted (`DELETE`) via RLS policies until verification is explicitly revoked in PostgreSQL.
5. **Two-Phase Administrative Revocation:**
   - Verification revocation (`verified := false`) and file replacement are strictly separated operations. Swapping a verified file in a single update statement is impossible (C-10).
6. **Backward-Compatible Initial Submissions:**
   - Applications submitted without uploaded files insert checklist records with `storage_path = NULL`. The trigger clamps `provided := false` and `verified := false`, allowing application submissions to succeed without breaking existing workflows (C-9).
7. **Storage Boundary Header Enforcement:**
   - The Supabase Storage API and database triggers reject files exceeding 5 MB (5,242,880 bytes) or reporting MIME types outside `application/pdf`, `image/jpeg`, and `image/png`.

---

## 3. What Phase 1 Does NOT Guarantee (Operational Limitations)

### 3.1 Metadata vs. Deep Binary Validation (C-26, C-37, C-44)
- **No Magic Byte / File Signature Inspection:** Database triggers and the Storage API validate MIME types and file sizes based on the HTTP `Content-Type` header and multipart stream lengths reported by the client and Storage service. They do not parse magic byte headers (e.g. `%PDF-`, `\xFF\xD8\xFF`). A client could upload an executable with a `.pdf` extension and `application/pdf` header.
- **No Antivirus or Malware Scanning:** No virus definition scans, sandbox detonation, or macro analysis are executed in Phase 1.
- **No Guarantee of Physical Blob Availability (C-44):** A matching record in `storage.objects` proves that the Storage metadata catalog recorded the file upload. It does not ping the underlying physical S3/MinIO/disk blob to prove the physical bytes remain uncorrupted or reachable.

### 3.2 Privileged Backend Overrides
- **Service-Role Superuser Authority:** While RLS policies prevent students and administrators from deleting verified files, backend operations executed using the unconstrained `service_role` secret key or direct PostgreSQL superuser (`postgres`) connections bypass RLS at the engine level.
- **Hardware-Enforced WORM Immutability:** True immutability against database superusers requires cloud-level Object Lock (e.g., AWS S3 Compliance Mode WORM storage), which is outside the scope of Phase 1.

---

## 4. Mandatory Phase 2 Architecture Requirements

To achieve end-to-end enterprise document security, the following capabilities must be implemented in Phase 2:

1. **Asynchronous Edge Function Antivirus Pipeline:**
   - A Supabase Edge Function triggered by Storage webhooks (`storage.objects.v1.create`) that executes ClamAV / VirusTotal scanning before an administrator reviews the document.
2. **Server-Side Magic Byte Validation:**
   - Server-side binary inspection verifying that uploaded bytes strictly match PDF, JPEG, or PNG magic numbers before granting verified status.
3. **Scheduled Automated Orphan Cleanup Cron Job:**
   - A nightly serverless cron job that scans `storage.objects` for files older than 24 hours lacking a corresponding foreign key reference in `public.application_documents(storage_path)` and purges them via the Supabase Storage API (`.remove()`).
