// ==============================================================================
// SCHOLARSHIELD STAGING SQL RUNNER
// File: scripts/run-sql-suite.mjs
// Mode: Executes Layer A (Transactional Unit) and Layer E (Rollback Verification)
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAndVerifyStagingEnv } from './verify-staging-env.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const targetSqlFile = process.argv[2];
if (!targetSqlFile) {
  console.error('Usage: node scripts/run-sql-suite.mjs <path-to-sql-file>');
  console.error('Example: node scripts/run-sql-suite.mjs tests/transactional-unit.sql');
  process.exit(1);
}

const fullSqlPath = path.resolve(rootDir, targetSqlFile);
if (!fs.existsSync(fullSqlPath)) {
  console.error(`Error: SQL file not found at: ${fullSqlPath}`);
  process.exit(1);
}

// 1. Enforce Staging Environment Guard
console.log('====================================================================');
console.log(`SCHOLARSHIELD STAGING SQL EXECUTION: ${targetSqlFile}`);
console.log('====================================================================');

const env = loadAndVerifyStagingEnv({ requireRealCredentials: true });

const dbUrl = env.STAGING_DATABASE_URL;
if (!dbUrl || dbUrl.includes('<staging-')) {
  console.error('====================================================================');
  console.error('BLOCKED: STAGING_DATABASE_URL is not configured in .env.staging');
  console.error('To run SQL scripts directly via Node, supply the connection string:');
  console.error('STAGING_DATABASE_URL="postgresql://postgres.<project-ref>:<pwd>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require"');
  console.error('\nAlternatively, open the Supabase Dashboard for ScholarShield-Staging:');
  console.error(`1. Open SQL Editor`);
  console.error(`2. Paste contents of ${targetSqlFile}`);
  console.error(`3. Click RUN`);
  console.error('====================================================================');
  process.exit(1);
}

// Dynamic import of postgres driver from node_modules
const postgres = (await import('postgres')).default;

const sql = postgres(dbUrl, {
  ssl: 'require',
  max: 1,
  onnotice: (notice) => {
    console.log(`[PG NOTICE] ${notice.message}`);
  },
});

try {
  console.log(`Connecting to staging database...`);
  const sqlContent = fs.readFileSync(fullSqlPath, 'utf-8');
  console.log(`Executing ${path.basename(targetSqlFile)} (${sqlContent.length} bytes)...`);

  const results = await sql.unsafe(sqlContent);
  console.log('Execution completed successfully.');

  if (Array.isArray(results) && results.length > 0) {
    console.log('\n--- Query Output ---');
    console.table(results);
  }
} catch (err) {
  console.error(`Execution failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
