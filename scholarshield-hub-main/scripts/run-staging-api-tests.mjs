// ==============================================================================
// SCHOLARSHIELD STAGING API TEST RUNNER
// File: scripts/run-staging-api-tests.mjs
// Mode: Executes Layers B, C, D with fail-closed staging isolation
// ==============================================================================

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { loadAndVerifyStagingEnv } from './verify-staging-env.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const require = createRequire(path.join(rootDir, 'package.json'));
const { buildSync } = require('esbuild');

// 1. Enforce Staging Environment Guard
console.log('====================================================================');
console.log('SCHOLARSHIELD STAGING API TEST HARNESS');
console.log('====================================================================');

const env = loadAndVerifyStagingEnv({ requireRealCredentials: true });

// 2. Built-in Vitest Shim for standalone execution without global vitest
const vitestShim = `
let currentSuite = "";
let beforeAllHooks = [];
let tests = [];

export function describe(name, fn) {
  currentSuite = name;
  beforeAllHooks = [];
  tests = [];
  fn();
}

export function beforeAll(fn) {
  beforeAllHooks.push(fn);
}

export function it(name, fn) {
  tests.push({ name, fn });
}

export function expect(actual) {
  const matchers = {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(\`Expected \${JSON.stringify(actual)} to be \${JSON.stringify(expected)}\`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(\`Expected \${JSON.stringify(actual)} to be null\`);
      }
    },
    toBeGreaterThan(num) {
      if (!(actual > num)) {
        throw new Error(\`Expected \${actual} to be greater than \${num}\`);
      }
    },
    toMatch(regex) {
      if (!regex.test(String(actual))) {
        throw new Error(\`Expected "\${actual}" to match \${regex}\`);
      }
    },
    toContain(item) {
      if (Array.isArray(actual)) {
        if (!actual.includes(item)) {
          throw new Error(\`Expected array to contain \${JSON.stringify(item)}\`);
        }
      } else if (typeof actual === "string") {
        if (!actual.includes(item)) {
          throw new Error(\`Expected string to contain "\${item}"\`);
        }
      } else {
        throw new Error(\`toContain used on unsupported type: \${typeof actual}\`);
      }
    },
  };

  const notMatchers = {
    toBeNull() {
      if (actual === null) {
        throw new Error(\`Expected value not to be null\`);
      }
    },
    toBe(expected) {
      if (actual === expected) {
        throw new Error(\`Expected \${JSON.stringify(actual)} not to be \${JSON.stringify(expected)}\`);
      }
    },
  };

  return {
    ...matchers,
    not: notMatchers,
  };
}

export async function runSuite() {
  console.log(\`\\n>>> SUITE: \${currentSuite}\`);
  for (const hook of beforeAllHooks) {
    await hook();
  }
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(\`  âœ“ [PASS] \${t.name}\`);
      passed++;
    } catch (err) {
      console.error(\`  âœ— [FAIL] \${t.name}\`);
      console.error(\`    Error: \${err.message}\`);
      failed++;
    }
  }
  return { suite: currentSuite, passed, failed, total: tests.length };
}
`;

const shimPath = path.join(rootDir, 'scratch', 'vitest-shim.mjs');
fs.writeFileSync(shimPath, vitestShim, 'utf-8');

// Determine which tests to execute
const targetArg = process.argv[2];
const allTestFiles = [
  'tests/student-api.test.ts',
  'tests/admin-api.test.ts',
  'tests/storage-http.test.ts',
];

const filesToRun = targetArg ? [targetArg] : allTestFiles;

let globalPassed = 0;
let globalFailed = 0;

for (const tf of filesToRun) {
  const fullPath = path.resolve(rootDir, tf);
  if (!fs.existsSync(fullPath)) {
    console.error(`Test file not found: ${tf}`);
    continue;
  }
  const basename = path.basename(tf, '.ts');
  const bundleOut = path.join(rootDir, 'scratch', `staging-test-${basename}.mjs`);

  console.log(`\nBundling and Executing: ${tf}`);

  try {
    buildSync({
      entryPoints: [fullPath],
      bundle: true,
      outfile: bundleOut,
      format: 'esm',
      platform: 'node',
      banner: {
        js: `import { describe, it, expect, beforeAll, runSuite } from ${JSON.stringify(shimPath)};`,
      },
      footer: {
        js: `\nconst _summary = await runSuite();\nif (_summary.failed > 0) process.exitCode = 1;\n`,
      },
      plugins: [
        {
          name: 'vitest-resolver',
          setup(build) {
            build.onResolve({ filter: /^vitest$/ }, () => ({
              path: shimPath,
            }));
          },
        },
      ],
    });

    const runner = await import(`file://${bundleOut}?t=${Date.now()}`);
  } catch (err) {
    console.error(`Execution error in ${tf}:`, err.message);
    globalFailed++;
  } finally {
    if (fs.existsSync(bundleOut)) {
      try { fs.unlinkSync(bundleOut); } catch {}
    }
  }
}

if (fs.existsSync(shimPath)) {
  try { fs.unlinkSync(shimPath); } catch {}
}

console.log('\n====================================================================');
console.log('STAGING API TEST EXECUTION COMPLETE');
console.log('====================================================================');
