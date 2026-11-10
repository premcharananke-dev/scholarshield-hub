const fs = require('fs');
const path = require('path');

async function importAisheDataset() {
  console.log('Fetching official AISHE colleges directory...');
  const url = 'https://raw.githubusercontent.com/tridev1004/Indian-Colleges/master/colleges.json';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Download failed: ' + res.status);
  const raw = await res.json();
  console.log('Raw records fetched:', raw.length);

  const seen = new Set();
  const institutions = [];

  function parseAishe(str) {
    const m = str.match(/\(Id:\s*([A-Z0-9-]+)\)/i);
    return m ? m[1].toUpperCase() : '';
  }

  function cleanName(str) {
    return str.replace(/\(Id:\s*[A-Z0-9-]+\)/gi, '').trim();
  }

  // 1. Process Affiliated & Constituent Colleges
  for (const item of raw) {
    const rawCollege = item.college || '';
    const aisheCode = parseAishe(rawCollege);
    const name = cleanName(rawCollege);
    const university = cleanName(item.university || '');
    const state = (item.state || '').trim();
    const district = (item.district || '').trim();
    const type = item.college_type || 'Affiliated College';

    if (!name) continue;

    const key = name.toLowerCase() + '|' + district.toLowerCase() + '|' + state.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    institutions.push({
      n: name,
      s: state,
      d: district,
      u: university,
      c: aisheCode,
      t: type,
    });
  }

  console.log('Unique colleges processed:', institutions.length);

  // 2. Extract Universities as top-level institutions
  const universityMap = new Map();
  for (const item of raw) {
    const rawUni = item.university || '';
    if (!rawUni) continue;
    const uCode = parseAishe(rawUni);
    const uName = cleanName(rawUni);
    const state = (item.state || '').trim();
    const district = (item.district || '').trim();

    if (!uName) continue;
    const key = uName.toLowerCase() + '|' + state.toLowerCase();
    if (!universityMap.has(key)) {
      universityMap.set(key, {
        n: uName,
        s: state,
        d: district,
        u: 'University / Deemed University',
        c: uCode,
        t: 'University',
      });
    }
  }

  console.log('Unique universities extracted:', universityMap.size);
  for (const uni of universityMap.values()) {
    const key = uni.n.toLowerCase() + '|' + uni.d.toLowerCase() + '|' + uni.s.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      institutions.push(uni);
    }
  }

  // 3. Ensure Rajeev Gandhi Memorial College of Engineering and Technology (Nandyal, AP) is prominently included
  institutions.unshift({
    n: 'Rajeev Gandhi Memorial College of Engineering and Technology (Autonomous)',
    s: 'Andhra Pradesh',
    d: 'Nandyal',
    u: 'JNTUA (Jawaharlal Nehru Technological University Anantapur)',
    c: 'C-26849',
    t: 'Autonomous Engineering College',
  });

  // 4. Also add National Institutes of Importance if not already present
  const premier = [
    { n: 'Indian Institute of Technology (IIT) Delhi', s: 'Delhi', d: 'New Delhi', u: 'Institute of National Importance', c: 'U-0092', t: 'IIT' },
    { n: 'Indian Institute of Technology (IIT) Bombay', s: 'Maharashtra', d: 'Mumbai', u: 'Institute of National Importance', c: 'U-0306', t: 'IIT' },
    { n: 'Indian Institute of Technology (IIT) Madras', s: 'Tamil Nadu', d: 'Chennai', u: 'Institute of National Importance', c: 'U-0456', t: 'IIT' },
    { n: 'Indian Institute of Technology (IIT) Kharagpur', s: 'West Bengal', d: 'Kharagpur', u: 'Institute of National Importance', c: 'U-0573', t: 'IIT' },
    { n: 'Indian Institute of Technology (IIT) Kanpur', s: 'Uttar Pradesh', d: 'Kanpur', u: 'Institute of National Importance', c: 'U-0517', t: 'IIT' },
    { n: 'Indian Institute of Technology (IIT) Roorkee', s: 'Uttarakhand', d: 'Roorkee', u: 'Institute of National Importance', c: 'U-0555', t: 'IIT' },
    { n: 'Indian Institute of Technology (IIT) Guwahati', s: 'Assam', d: 'Guwahati', u: 'Institute of National Importance', c: 'U-0053', t: 'IIT' },
    { n: 'Indian Institute of Technology (IIT) Hyderabad', s: 'Telangana', d: 'Sangareddy', u: 'Institute of National Importance', c: 'U-0017', t: 'IIT' },
    { n: 'National Institute of Technology (NIT) Tiruchirappalli', s: 'Tamil Nadu', d: 'Tiruchirappalli', u: 'Institute of National Importance', c: 'U-0467', t: 'NIT' },
    { n: 'National Institute of Technology (NIT) Warangal', s: 'Telangana', d: 'Warangal', u: 'Institute of National Importance', c: 'U-0025', t: 'NIT' },
    { n: 'National Institute of Technology Karnataka (NITK) Surathkal', s: 'Karnataka', d: 'Mangaluru', u: 'Institute of National Importance', c: 'U-0237', t: 'NIT' },
    { n: 'National Institute of Technology (NIT) Calicut', s: 'Kerala', d: 'Kozhikode', u: 'Institute of National Importance', c: 'U-0259', t: 'NIT' },
    { n: 'All India Institute of Medical Sciences (AIIMS) New Delhi', s: 'Delhi', d: 'New Delhi', u: 'Institute of National Importance', c: 'U-0089', t: 'Medical' },
    { n: 'Post Graduate Institute of Medical Education & Research (PGIMER)', s: 'Chandigarh', d: 'Chandigarh', u: 'Institute of National Importance', c: 'U-0081', t: 'Medical' },
  ];

  for (const p of premier) {
    const key = p.n.toLowerCase() + '|' + p.d.toLowerCase() + '|' + p.s.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      institutions.unshift(p);
    }
  }

  console.log('Final Directory Record Count:', institutions.length);

  // States count
  const allStates = new Set(institutions.map((i) => i.s));
  const allDistricts = new Set(institutions.map((i) => i.d));
  console.log('Unique States & UTs:', allStates.size);
  console.log('Unique Districts:', allDistricts.size);

  const outDir = path.join(__dirname, '..', 'src', 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'colleges.json');
  fs.writeFileSync(outPath, JSON.stringify(institutions));
  const stats = fs.statSync(outPath);
  console.log('Successfully written to:', outPath);
  console.log('File size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
}

importAisheDataset().catch(console.error);
