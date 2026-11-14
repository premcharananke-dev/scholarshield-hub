// ============================================================================
// SCHOLARSHIELD STORAGE COMPENSATION & ORPHAN RECONCILIATION
// File: src/lib/storage-compensation.ts
// Reconciled: C-16, C-25, C-43 (Multi-Tier Architecture & Active Document Protection)
// ============================================================================

import { SupabaseClient } from "@supabase/supabase-js";

export interface PendingOrphan {
  path: string;
  applicationId: string;
  documentId: string;
  failedAt: number;
  retryCount: number;
}

const STORAGE_BUCKET = "scholarship-documents";
const ORPHAN_QUEUE_KEY = "scholarshield_pending_orphans";

/**
 * Generate collision-resistant storage path strictly following:
 * <application_id>/<doc_type>_<timestamp>_<uuid>.<ext>
 */
export function generateStoragePath(applicationId: string, documentType: string, filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  const safeDoc = documentType.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const uniqueToken = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  return `${applicationId}/${safeDoc}_${uniqueToken}${ext}`;
}

/**
 * Tier 1 & Tier 2: Upload document binary with synchronous compensation rollback
 * and durable client-side offline queue fallback.
 */
export async function uploadWithCompensation(
  supabase: SupabaseClient,
  applicationId: string,
  documentId: string,
  documentType: string,
  file: File
) {
  const storagePath = generateStoragePath(applicationId, documentType, file.name);

  // 1. Upload binary to Supabase Storage
  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadErr) {
    throw new Error(`Storage upload failed: ${uploadErr.message}`);
  }

  // 2. Synchronize metadata to PostgreSQL database
  const user = (await supabase.auth.getUser()).data.user;
  const { data: docData, error: dbErr } = await supabase
    .from("application_documents")
    .update({
      storage_path: storagePath,
      provided: true,
      file_size: file.size,
      file_type: file.type,
      uploaded_by: user?.id || null,
    })
    .eq("id", documentId)
    .select()
    .single();

  // 3. Compensation Rollback if DB update fails (C-16, C-25)
  if (dbErr) {
    const { error: removeErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath]);

    if (removeErr) {
      // Tier 2: Persist to client offline queue for network interruption or crash
      enqueuePendingOrphan({
        path: storagePath,
        applicationId,
        documentId,
        failedAt: Date.now(),
        retryCount: 0,
      });
      throw new Error(
        `Database save failed (${dbErr.message}) and immediate storage rollback failed. Queued locally for background reconciliation.`
      );
    }

    throw new Error(`Database save failed: ${dbErr.message}. Storage upload successfully reverted.`);
  }

  return docData;
}

/**
 * Enqueue a failed orphan file into local storage with deduplication.
 */
export function enqueuePendingOrphan(item: PendingOrphan): void {
  try {
    const raw = localStorage.getItem(ORPHAN_QUEUE_KEY);
    const queue: PendingOrphan[] = raw ? JSON.parse(raw) : [];

    // Deduplicate by path
    if (!queue.some((q) => q.path === item.path)) {
      queue.push(item);
      localStorage.setItem(ORPHAN_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch (err) {
    console.error("Failed to persist orphan file to localStorage:", err);
  }
}

/**
 * Idempotent client-side worker to process pending orphan deletions.
 * C-43: Checks if file was later successfully referenced before attempting deletion!
 */
export async function reconcilePendingOrphans(supabase: SupabaseClient): Promise<{
  reconciled: string[];
  preserved: string[];
  failed: string[];
}> {
  const raw = localStorage.getItem(ORPHAN_QUEUE_KEY);
  if (!raw) return { reconciled: [], preserved: [], failed: [] };

  const queue: PendingOrphan[] = JSON.parse(raw);
  const remaining: PendingOrphan[] = [];
  const reconciled: string[] = [];
  const preserved: string[] = [];
  const failed: string[] = [];

  for (const item of queue) {
    try {
      // Safety Check: Is this path now referenced by a valid document record?
      const { data: existingDoc } = await supabase
        .from("application_documents")
        .select("id, verified")
        .eq("storage_path", item.path)
        .maybeSingle();

      if (existingDoc) {
        // File is now linked to an active document; DO NOT DELETE!
        preserved.push(item.path);
        continue; // Discard from orphan queue safely
      }

      // Attempt Storage API deletion
      const { error: removeErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([item.path]);

      if (removeErr) {
        item.retryCount += 1;
        remaining.push(item);
        failed.push(item.path);
      } else {
        reconciled.push(item.path);
      }
    } catch {
      item.retryCount += 1;
      remaining.push(item);
      failed.push(item.path);
    }
  }

  localStorage.setItem(ORPHAN_QUEUE_KEY, JSON.stringify(remaining));
  return { reconciled, preserved, failed };
}

/* ============================================================================
 * ARCHITECTURAL SPECIFICATION FOR TIER 3 & TIER 4 (C-43 SEPARATION)
 * ============================================================================
 * 
 * 1. Tier 3: Database Reconciliation Queue (Prepared DDL)
 * --------------------------------------------------------
 * CREATE TABLE public.storage_orphan_reconciliation_queue (
 *   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   storage_path text NOT NULL UNIQUE,
 *   application_id text NOT NULL,
 *   created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 *   reconciled boolean NOT NULL DEFAULT false,
 *   reconciled_at timestamptz
 * );
 * 
 * 2. Tier 4: Serverless Edge Function Sweep (Phase 2 Infrastructure Required)
 * --------------------------------------------------------------------------
 * A scheduled cron job executes every 24 hours:
 * - Lists objects in storage bucket 'scholarship-documents'.
 * - Compares each object created > 24 hours ago against public.application_documents(storage_path).
 * - Calls storage.remove() on unreferenced paths.
 * ============================================================================
 */
