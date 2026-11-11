// Idempotent scholarship catalog synchronization script for Supabase `public.scholarships`.
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-scholarships.mjs
//   or ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/seed-scholarships.mjs
// Never overwrites or deletes existing database scholarship rows or student data.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const rootDir = path.resolve(import.meta.dirname, "..");
const require = createRequire(path.join(rootDir, "package.json"));
const { createClient } = require("@supabase/supabase-js");
const { buildSync } = require("esbuild");

function loadDotEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function loadMasterCatalog() {
  const built = buildSync({
    entryPoints: [path.join(rootDir, "src/data/scholarships.ts")],
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
    alias: { "@": path.join(rootDir, "src") },
  });
  const mod = { exports: {} };
  const fn = new Function("exports", "require", "module", built.outputFiles[0].text);
  fn(mod.exports, require, mod);
  return mod.exports.MASTER_SCHOLARSHIPS;
}

function toDbPayload(s) {
  return {
    id: String(s.id).trim(),
    name: String(s.name).trim(),
    provider: String(s.provider).trim(),
    provider_type: s.provider_type,
    description: s.description,
    tags: s.tags ?? [],
    eligible_gender: s.eligible_gender,
    study_levels: s.study_levels ?? [],
    course_streams: s.course_streams ?? [],
    eligible_years: s.eligible_years ?? [],
    max_income: s.max_income ?? null,
    min_percentage: s.min_percentage ?? null,
    percentage_basis: s.percentage_basis || null,
    eligible_categories: s.eligible_categories ?? [],
    amount: s.amount || "Unverified",
    benefits: s.benefits || null,
    documents: s.documents ?? [],
    other_conditions: s.other_conditions ?? [],
    opening_date: s.opening_date || null,
    closing_date: s.closing_date || null,
    academic_year: s.academic_year || null,
    application_url: s.application_url || null,
    source_url: s.source_url || null,
    unverified_fields: s.unverified_fields ?? [],
    verification_note: s.verification_note || null,
    is_active: s.is_active,
  };
}

function normalizeTitle(v) {
  return String(v).trim().toLowerCase().replace(/\s+/g, " ");
}

async function main() {
  const dotEnv = loadDotEnv(path.join(rootDir, ".env"));
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || dotEnv.SUPABASE_URL || dotEnv.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || dotEnv.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    dotEnv.SUPABASE_PUBLISHABLE_KEY ||
    dotEnv.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error("Missing SUPABASE_URL / VITE_SUPABASE_URL.");
  const apiKey = serviceKey || publishableKey;
  if (!apiKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY.");

  const isOpaque = apiKey.startsWith("sb_publishable_") || apiKey.startsWith("sb_secret_");
  const supabase = createClient(url, apiKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: isOpaque
      ? {
          fetch: (input, init) => {
            const headers = new Headers(input instanceof Request ? input.headers : undefined);
            if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
            if (headers.get("Authorization") === `Bearer ${apiKey}`) headers.delete("Authorization");
            headers.set("apikey", apiKey);
            return fetch(input, { ...init, headers });
          },
        }
      : undefined,
  });

  if (!serviceKey) {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error(
        "Provide SUPABASE_SERVICE_ROLE_KEY or ADMIN_EMAIL + ADMIN_PASSWORD to satisfy scholarships admin RLS."
      );
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`Admin sign-in failed: ${error.message}`);
  }

  const catalog = loadMasterCatalog();
  const { data: existing, error: fetchErr } = await supabase.from("scholarships").select("id, name");
  if (fetchErr) throw new Error(`Failed reading existing scholarships: ${fetchErr.message}`);

  const existingIds = new Set((existing ?? []).map((r) => r.id));
  const existingTitles = new Set((existing ?? []).map((r) => normalizeTitle(r.name)));
  const missing = catalog.filter(
    (s) => !existingIds.has(s.id) && !existingTitles.has(normalizeTitle(s.name))
  );

  console.log(`Existing DB scholarships: ${existing?.length ?? 0}`);
  console.log(`Missing catalog scholarships to insert: ${missing.length}`);

  const chunkSize = 25;
  for (let i = 0; i < missing.length; i += chunkSize) {
    const batch = missing.slice(i, i + chunkSize).map(toDbPayload);
    const { error } = await supabase.from("scholarships").upsert(batch, {
      onConflict: "id",
      ignoreDuplicates: true,
    });
    if (error) throw new Error(`Batch insert failed: ${error.message}`);
  }

  console.log(`Seed completed safely (${missing.length} inserted, ${existing?.length ?? 0} preserved).`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
