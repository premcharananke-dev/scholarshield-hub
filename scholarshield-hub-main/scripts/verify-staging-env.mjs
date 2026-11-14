// ==============================================================================
// SCHOLARSHIELD STAGING ENVIRONMENT GUARD
// File: scripts/verify-staging-env.mjs
// Mode: Fail-closed production protection & staging validation
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const STAGING_ENV_PATH = path.join(PROJECT_ROOT, '.env.staging');

const PROD_PROJECT_ID = 'kiwigepbwqauzmenbxea';
const PROD_URL_SUBSTRINGS = [
  'c--c431c416-5951-4abc-87f2-2cd699b9a756-prod.lovable.cloud',
  'kiwigepbwqauzmenbxea.supabase.co',
];

export function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Staging environment file not found at: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

export function verifyStagingEnvironment(env, { requireRealCredentials = false } = {}) {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
  const projectId = env.VITE_SUPABASE_PROJECT_ID || env.SUPABASE_PROJECT_ID || '';

  // 1. HARD BLOCK ON PRODUCTION CREDENTIALS
  for (const prodSub of PROD_URL_SUBSTRINGS) {
    if (url.includes(prodSub)) {
      console.error('====================================================================');
      console.error('FATAL ERROR: PRODUCTION URL DETECTED IN STAGING RUNTIME!');
      console.error(`Target URL: ${url}`);
      console.error('Aborting immediately to protect production database and storage.');
      console.error('====================================================================');
      process.exit(1);
    }
  }

  if (projectId === PROD_PROJECT_ID) {
    console.error('====================================================================');
    console.error('FATAL ERROR: PRODUCTION PROJECT ID DETECTED IN STAGING RUNTIME!');
    console.error(`Project ID: ${projectId}`);
    console.error('Aborting immediately to protect production database and storage.');
    console.error('====================================================================');
    process.exit(1);
  }

  // 2. CHECK FOR UNCONFIGURED PLACEHOLDERS (when executing live tests)
  if (requireRealCredentials) {
    const placeholders = [];
    for (const [key, val] of Object.entries(env)) {
      if (typeof val === 'string' && val.includes('<staging-')) {
        placeholders.push(key);
      }
    }
    if (placeholders.length > 0) {
      console.error('====================================================================');
      console.error('BLOCKED: STAGING CREDENTIALS NOT YET CONFIGURED IN .env.staging');
      console.error(`The following variables still contain placeholder templates:`);
      placeholders.forEach((k) => console.error(`  - ${k}`));
      console.error('\nPlease replace the placeholders in .env.staging with your actual');
      console.error('ScholarShield-Staging Supabase project credentials before running live tests.');
      console.error('====================================================================');
      process.exit(1);
    }
  }

  return {
    valid: true,
    url,
    projectId,
  };
}

export function loadAndVerifyStagingEnv(options = {}) {
  const env = parseEnvFile(STAGING_ENV_PATH);
  // Merge into process.env for Node modules that expect process.env
  for (const [k, v] of Object.entries(env)) {
    process.env[k] = v;
  }
  verifyStagingEnvironment(env, options);
  return env;
}

// Standalone execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  try {
    const env = parseEnvFile(STAGING_ENV_PATH);
    const result = verifyStagingEnvironment(env, { requireRealCredentials: false });
    console.log('--------------------------------------------------------------------');
    console.log('ScholarShield Staging Guard: PASS');
    console.log(`Configuration File: ${STAGING_ENV_PATH}`);
    console.log(`Configured Staging URL: ${result.url}`);
    console.log(`Configured Project ID:  ${result.projectId}`);
    console.log('Production URL Blacklist: ENFORCED (Production URLs strictly blocked)');
    console.log('Production ID Blacklist:  ENFORCED (kiwigepbwqauzmenbxea blocked)');
    console.log('--------------------------------------------------------------------');
  } catch (err) {
    console.error(`Staging Guard Check Failed: ${err.message}`);
    process.exit(1);
  }
}
