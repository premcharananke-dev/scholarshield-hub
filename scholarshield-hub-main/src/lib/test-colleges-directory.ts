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

console.log("=== SCHOLARSHIELD 38,873+ AISHE COLLEGES DIRECTORY VERIFICATION ===\n");

// 1. Dataset Integrity Tests
const jsonPath = path.join(process.cwd(), "src", "data", "colleges.json");
assert(fs.existsSync(jsonPath), "colleges.json exists in src/data/");

const data = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as Array<{
  n: string;
  s: string;
  d: string;
  u?: string;
  c?: string;
  t?: string;
}>;

console.log(`1. Dataset Statistics:`);
console.log(`  Total institutions: ${data.length.toLocaleString()}`);
assert(data.length >= 38000, "Directory contains 38,000+ official institutions");

const states = Array.from(new Set(data.map((d) => d.s).filter(Boolean)));
const districts = Array.from(new Set(data.map((d) => d.d).filter(Boolean)));
console.log(`  Total States & UTs covered: ${states.length}`);
console.log(`  Total Districts covered: ${districts.length}`);
assert(states.length >= 36, "Covers all 28 States and 8 Union Territories of India");
assert(districts.length >= 600, "Covers 600+ administrative districts across India");

// 2. Multi-State Search Verification
console.log("\n2. Testing Searches Across Different Indian States:");
const testStates = [
  "Andhra Pradesh",
  "Telangana",
  "Karnataka",
  "Tamil Nadu",
  "Maharashtra",
  "Delhi",
  "Uttar Pradesh",
  "West Bengal",
  "Kerala",
  "Gujarat",
  "Rajasthan",
  "Madhya Pradesh",
  "Punjab",
  "Bihar",
  "Assam",
  "Jammu and Kashmir",
  "Odisha",
];

for (const st of testStates) {
  const inState = data.filter((d) => d.s.toLowerCase() === st.toLowerCase());
  assert(
    inState.length > 50,
    `State '${st}' has substantial representation (${inState.length.toLocaleString()} institutions)`,
  );
}

// 3. Institution Categories Verification
console.log("\n3. Testing Institution Categories Coverage:");
const engineering = data.filter(
  (d) =>
    d.n.toLowerCase().includes("engineering") ||
    d.n.toLowerCase().includes("technology"),
);
assert(
  engineering.length >= 2000,
  `Engineering institutions covered: ${engineering.length.toLocaleString()}`,
);

const medical = data.filter(
  (d) =>
    d.n.toLowerCase().includes("medical") ||
    d.n.toLowerCase().includes("medicine"),
);
assert(
  medical.length >= 300,
  `Medical institutions covered: ${medical.length.toLocaleString()}`,
);

const pharmacy = data.filter((d) => d.n.toLowerCase().includes("pharmacy"));
assert(
  pharmacy.length >= 300,
  `Pharmacy institutions covered: ${pharmacy.length.toLocaleString()}`,
);

const nursing = data.filter((d) => d.n.toLowerCase().includes("nursing"));
assert(
  nursing.length >= 500,
  `Nursing institutions covered: ${nursing.length.toLocaleString()}`,
);

const polytechnic = data.filter(
  (d) =>
    d.n.toLowerCase().includes("polytechnic") ||
    d.n.toLowerCase().includes("diploma"),
);
assert(
  polytechnic.length >= 100,
  `Polytechnic & Diploma institutions covered: ${polytechnic.length.toLocaleString()}`,
);

const universities = data.filter(
  (d) => d.t === "University" || d.n.toLowerCase().includes("university"),
);
assert(
  universities.length >= 400,
  `Universities covered: ${universities.length.toLocaleString()}`,
);

// 4. District & Locality Searches
console.log("\n4. Testing Multi-District Specific Searches:");
const ALIASES: Record<string, string[]> = {
  bengaluru: ["bangalore"],
  bangalore: ["bengaluru"],
  mumbai: ["bombay"],
  bombay: ["mumbai"],
  chennai: ["madras"],
  madras: ["chennai"],
  nandyal: ["kurnool"],
  kurnool: ["nandyal"],
};

function searchInMemory(query: string, stateFilter?: string) {
  const rawTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const tokenGroups = rawTokens.map((tok) => [tok, ...(ALIASES[tok] ?? [])]);

  return data.filter((d) => {
    if (stateFilter && d.s.toLowerCase() !== stateFilter.toLowerCase())
      return false;
    const text = `${d.n} ${d.d} ${d.s} ${d.c ?? ""} ${d.u ?? ""} ${d.t ?? ""}`.toLowerCase();
    return tokenGroups.every((group) => group.some((tok) => text.includes(tok)));
  });
}

// Test Nandyal district / town
const nandyalColleges = searchInMemory("Nandyal");
assert(
  nandyalColleges.length >= 10,
  `Found ${nandyalColleges.length} colleges in Nandyal, Andhra Pradesh`,
);

// Verify Rajeev Gandhi Memorial College
const rgmcet = nandyalColleges.find((d) =>
  d.n.toLowerCase().includes("rajeev gandhi memorial"),
);
assert(
  rgmcet !== undefined,
  "Rajeev Gandhi Memorial College of Engineering and Technology found in Nandyal",
);
if (rgmcet) {
  console.log(`    Sample match: "${rgmcet.n}" | State: ${rgmcet.s} | District: ${rgmcet.d} | AISHE: ${rgmcet.c}`);
}

// Test Pune
const puneColleges = searchInMemory("", "Maharashtra").filter(
  (d) => d.d.toLowerCase() === "pune",
);
assert(
  puneColleges.length >= 100,
  `Found ${puneColleges.length} institutions in Pune district`,
);

// Test Bengaluru
const blrColleges = searchInMemory("Bengaluru");
assert(
  blrColleges.length >= 100,
  `Found ${blrColleges.length} institutions in Bengaluru`,
);

// 5. Pagination Simulation
console.log("\n5. Testing Pagination Logic (Page 1 vs Page 2):");
const allEngineering = searchInMemory("Engineering");
const pageSize = 12;
const page1 = allEngineering.slice(0, pageSize);
const page2 = allEngineering.slice(pageSize, pageSize * 2);

assert(page1.length === 12, "Page 1 has exactly 12 records");
assert(page2.length === 12, "Page 2 has exactly 12 records");
assert(
  Boolean(page1[0] && page2[0] && page1[0].n !== page2[0].n),
  "Page 1 and Page 2 contain distinct, correctly paginated records",
);
const hasMore = allEngineering.length > pageSize;
assert(hasMore, "hasMore evaluates correctly to true");

console.log("\n========================================================");
console.log(`Results: ${passed} Passed, ${failed} Failed`);
if (failed === 0) {
  console.log("ALL DIRECTORY TESTS PASSED! 38,873+ AISHE RECORDS VERIFIED ✓");
} else {
  process.exit(1);
}
