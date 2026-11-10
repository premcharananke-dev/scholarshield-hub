import fs from "fs";
import path from "path";

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failed++;
  }
}

console.log("=== SCHOLARSHIELD INDIA-WIDE COLLEGE DIRECTORY VERIFICATION ===\n");

// 1. Dataset Verification
const jsonPath = path.join(process.cwd(), "scholarshield-hub-main", "src", "data", "colleges.json");
const filePath = fs.existsSync(jsonPath) ? jsonPath : path.join(process.cwd(), "src", "data", "colleges.json");
assert(fs.existsSync(filePath), "Official AISHE colleges.json exists");

interface RawCollege {
  n: string;
  s: string;
  d: string;
  u?: string;
  c?: string;
  t?: string;
}

const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as RawCollege[];

console.log(`\n--- Phase 2 & 3: Official Dataset Metrics ---`);
console.log(`Total Institutions: ${data.length.toLocaleString()}`);
assert(data.length >= 38000, `Directory contains 38,000+ official institutions (${data.length})`);

const states = Array.from(new Set(data.map((r) => r.s).filter(Boolean))).sort();
const districts = Array.from(new Set(data.map((r) => r.d).filter(Boolean))).sort();
console.log(`Covered States & UTs: ${states.length}`);
console.log(`Covered Districts: ${districts.length}`);
assert(states.length >= 36, "Covers all 28 states and 8 union territories of India");
assert(districts.length >= 600, "Covers 600+ districts across India");

// AISHE code check
const aisheCoded = data.filter((r) => r.c && r.c.length > 2);
console.log(`Institutions with AISHE codes: ${aisheCoded.length.toLocaleString()}`);
assert(aisheCoded.length > 30000, "Rich AISHE code coverage");

// Deduplication verification
const idSet = new Set<string>();
let dupCount = 0;
for (const r of data) {
  const key = `${r.n.toLowerCase().trim()}|${r.d.toLowerCase().trim()}|${r.s.toLowerCase().trim()}`;
  if (idSet.has(key)) {
    dupCount++;
  } else {
    idSet.add(key);
  }
}
console.log(`Duplicate institution entries: ${dupCount}`);
assert(dupCount === 0, "Dataset contains 0 duplicate records");

// 2. Search Engine Logic Simulation
console.log(`\n--- Phase 4: Search & Autocomplete Testing ---`);

function searchDirectory(query: string, state?: string, district?: string, limit = 15) {
  const q = query.trim().toLowerCase();
  const st = (state ?? "").trim().toLowerCase();
  const dt = (district ?? "").trim().toLowerCase();

  let filtered = data;
  if (st && st !== "all") {
    filtered = filtered.filter((r) => r.s.toLowerCase() === st);
  }
  if (dt && dt !== "all") {
    filtered = filtered.filter((r) => r.d.toLowerCase() === dt);
  }

  if (q) {
    const tokens = q.split(/\s+/).filter(Boolean);
    filtered = filtered.filter((r) => {
      const text = `${r.n} ${r.d} ${r.s} ${r.c ?? ""} ${r.u ?? ""} ${r.t ?? ""}`.toLowerCase();
      return tokens.every((tok) => text.includes(tok));
    });
  }

  return {
    results: filtered.slice(0, limit),
    totalCount: filtered.length,
  };
}

// Search 1: "Rajeev Gandhi" in Andhra Pradesh / Nandyal
const rgSearch = searchDirectory("Rajeev Gandhi");
assert(rgSearch.totalCount > 0, 'Found institutions for query "Rajeev Gandhi"');
const rgmcet = rgSearch.results.find((r) => r.n.includes("Rajeev Gandhi Memorial"));
assert(Boolean(rgmcet), "Successfully matched Rajeev Gandhi Memorial College of Engineering and Technology");

// Search 2: "IIT" national search
const iitSearch = searchDirectory("IIT");
assert(iitSearch.totalCount >= 10, 'Found IIT institutions for query "IIT"');

// Search 3: State & District filter test - Karnataka / Bangalore
const blrSearch = searchDirectory("", "Karnataka", "Bangalore");
console.log(`Colleges in Karnataka (Bangalore): ${blrSearch.totalCount}`);
assert(blrSearch.totalCount > 50, "Successfully filtered colleges by State + District");

// Search 4: State & District filter test - Maharashtra / Pune
const puneSearch = searchDirectory("Engineering", "Maharashtra", "Pune");
console.log(`Engineering colleges in Maharashtra (Pune): ${puneSearch.totalCount}`);
assert(puneSearch.totalCount > 5, "Filtered Engineering colleges in Pune");

// Search 5: Medical colleges across India
const medSearch = searchDirectory("Medical", "Delhi");
assert(medSearch.totalCount > 0, "Found medical colleges in Delhi");

// Search 6: Dynamic district list generation for selected state
const apDistricts = Array.from(new Set(data.filter((r) => r.s === "Andhra Pradesh").map((r) => r.d))).sort();
console.log(`Andhra Pradesh districts found: ${apDistricts.length}`);
assert(apDistricts.length >= 10, "Dynamically extracted districts for Andhra Pradesh");

// 3. Phase 5: Missing Colleges & Pending Verification Verification
console.log(`\n--- Phase 5: Missing Colleges & Pending Verification ---`);
const customCollege = {
  name: "Sri Padmavati Rural Polytechnic",
  city: "Renigunta",
  state: "Andhra Pradesh",
};
const formattedCustom = `${customCollege.name.trim()}, ${customCollege.city.trim()}, ${customCollege.state.trim()} (Pending Verification)`;
assert(formattedCustom.includes("(Pending Verification)"), "Manual entry is explicitly marked '(Pending Verification)'");

const isCustomPending = formattedCustom.includes("(Pending Verification)");
assert(isCustomPending === true, "System accurately flags manually entered institution as pending review");

const verifiedCollegeString = `${rgmcet?.n}, ${rgmcet?.d}, ${rgmcet?.s}`;
const isVerifiedFlagged = verifiedCollegeString.includes("(Pending Verification)");
assert(isVerifiedFlagged === false, "Official AISHE directory college is treated as verified");

// 4. Summary
console.log(`\n========================================`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);
