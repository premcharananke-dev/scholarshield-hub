import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const rootDir = "D:\\prem\\scholarshield-hub-main";
const require = createRequire(path.join(rootDir, "package.json"));
const { buildSync } = require("esbuild");

const testFiles = [
  "src/lib/test-phase1.ts",
  "src/lib/test-verification.ts",
  "src/lib/test-extended-features.ts",
  "src/lib/test-comprehensive-scholarships.ts",
  "src/lib/test-institution-directory.ts",
  "src/lib/test-colleges-directory.ts",
];

console.log("=================================================");
console.log("EXECUTING SCHOLARSHIELD APPLICATION TEST HARNESS");
console.log("=================================================\n");

let allPassed = true;

for (const tf of testFiles) {
  const fullPath = path.join(rootDir, tf);
  const outPath = path.join(rootDir, "scratch", `temp-${path.basename(tf, ".ts")}.mjs`);
  console.log(`\n>>> RUNNING: ${tf}`);
  try {
    buildSync({
      entryPoints: [fullPath],
      bundle: true,
      outfile: outPath,
      format: "esm",
      platform: "node",
      alias: { "@": path.join(rootDir, "src") },
    });
    execSync(`node "${outPath}"`, { stdio: "inherit", cwd: rootDir });
    console.log(`[COMPLETED] ${tf}`);
  } catch (err) {
    allPassed = false;
    console.error(`[FAILED] ${tf}:`, err.message);
  } finally {
    if (fs.existsSync(outPath)) {
      try { fs.unlinkSync(outPath); } catch {}
    }
  }
}

console.log("\n=================================================");
if (allPassed) {
  console.log("ALL APPLICATION REGRESSION TESTS EXECUTED AND PASSED");
} else {
  console.log("SOME APPLICATION TESTS FAILED");
}
console.log("=================================================");
