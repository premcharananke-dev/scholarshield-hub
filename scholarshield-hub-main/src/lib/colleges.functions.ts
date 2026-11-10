import { createServerFn } from "@tanstack/react-start";

export interface CollegeDirectoryItem {
  id: string;
  name: string;
  state: string;
  district: string;
  university?: string | undefined;
  aisheCode?: string | undefined;
  type?: string | undefined;
  isVerified?: boolean | undefined;
}

export interface CollegeSearchRequest {
  query?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  state?: string | undefined;
  district?: string | undefined;
}

export interface CollegeSearchResponse {
  results: CollegeDirectoryItem[];
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
  states: string[];
  districts: string[];
}

interface RawCollege {
  n: string;
  s: string;
  d: string;
  u?: string;
  c?: string;
  t?: string;
}

// In-memory cache for server-side query execution
let cachedRecords: RawCollege[] | null = null;
let cachedStates: string[] | null = null;

async function getRecords(): Promise<RawCollege[]> {
  if (cachedRecords) return cachedRecords;
  try {
    // Dynamic import to keep this server-side only
    const mod = await import("../data/colleges.json");
    cachedRecords = (mod.default ?? mod) as RawCollege[];
    cachedStates = Array.from(new Set(cachedRecords.map((r) => r.s).filter(Boolean))).sort();
    return cachedRecords;
  } catch (err) {
    console.error("Failed to load colleges dataset:", err);
    return [];
  }
}

const ALIASES: Record<string, string[]> = {
  bengaluru: ["bangalore"],
  bangalore: ["bengaluru"],
  mumbai: ["bombay"],
  bombay: ["mumbai"],
  chennai: ["madras"],
  madras: ["chennai"],
  kolkata: ["calcutta"],
  calcutta: ["kolkata"],
  prayagraj: ["allahabad"],
  allahabad: ["prayagraj"],
  varanasi: ["benaras", "kashi"],
  kashi: ["varanasi"],
  nandyal: ["kurnool"],
  kurnool: ["nandyal"],
};

export const searchCollegesApi = createServerFn({ method: "POST" })
  .validator((params: CollegeSearchRequest) => params)
  .handler(async ({ data: params }): Promise<CollegeSearchResponse> => {
    const records = await getRecords();
    const query = (params.query ?? "").trim().toLowerCase();
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 15));
    const stateFilter = (params.state ?? "").trim().toLowerCase();
    const districtFilter = (params.district ?? "").trim().toLowerCase();

    const states = cachedStates ?? [];

    let districts: string[] = [];
    if (stateFilter && stateFilter !== "all") {
      const stateRecords = records.filter(
        (r) => r.s.toLowerCase() === stateFilter,
      );
      districts = Array.from(
        new Set(stateRecords.map((r) => r.d).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b));
    }

    let filtered = records;

    if (stateFilter && stateFilter !== "all") {
      filtered = filtered.filter((r) => r.s.toLowerCase() === stateFilter);
    }

    if (districtFilter && districtFilter !== "all") {
      filtered = filtered.filter((r) => r.d.toLowerCase() === districtFilter);
    }

    if (query) {
      const rawTokens = query.split(/\s+/).filter(Boolean);
      // Expand tokens with common aliases
      const tokenGroups = rawTokens.map((tok) => {
        const al = ALIASES[tok] ?? [];
        return [tok, ...al];
      });

      filtered = filtered.filter((r) => {
        const text = `${r.n} ${r.d} ${r.s} ${r.c ?? ""} ${r.u ?? ""} ${r.t ?? ""}`.toLowerCase();
        return tokenGroups.every((group) => group.some((tok) => text.includes(tok)));
      });
    }

    const totalCount = filtered.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paged = filtered.slice(startIndex, endIndex);

    const results: CollegeDirectoryItem[] = paged.map((r, idx) => ({
      id: r.c ? `${r.c}` : `COL-${startIndex + idx + 1}`,
      name: r.n,
      state: r.s,
      district: r.d,
      university: r.u,
      aisheCode: r.c,
      type: r.t,
      isVerified: true,
    }));

    return {
      results,
      totalCount,
      page,
      limit,
      hasMore: endIndex < totalCount,
      states,
      districts,
    };
  });
