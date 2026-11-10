import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  GraduationCap,
  Loader2,
  MapPin,
  PlusCircle,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import {
  searchCollegesApi,
  type CollegeDirectoryItem,
  type CollegeSearchResponse,
} from "@/lib/colleges.functions";

interface CollegeAutocompleteProps {
  value: string;
  onChange: (collegeString: string) => void;
  error?: string | undefined;
  required?: boolean;
}

export function CollegeAutocomplete({
  value,
  onChange,
  error,
  required = true,
}: CollegeAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<CollegeDirectoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [statesList, setStatesList] = useState<string[]>([]);
  const [districtsList, setDistrictsList] = useState<string[]>([]);

  // Manual fallback state
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customCollege, setCustomCollege] = useState({
    name: "",
    city: "",
    state: "",
  });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync internal display query if external value changes (e.g., reset)
  useEffect(() => {
    if (value !== query && !isCustomMode) {
      setQuery(value);
    }
  }, [value, isCustomMode]);

  // Click outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch search results from server
  const fetchColleges = useCallback(
    async (
      searchQuery: string,
      pageNum: number,
      stateFilter: string,
      districtFilter: string,
    ) => {
      setLoading(true);
      try {
        const response: CollegeSearchResponse = await searchCollegesApi({
          data: {
            query: searchQuery,
            page: pageNum,
            limit: 15,
            state: stateFilter || undefined,
            district: districtFilter || undefined,
          },
        });
        setResults(response.results);
        setTotalCount(response.totalCount);
        setHasMore(response.hasMore);
        if (response.states && response.states.length > 0 && statesList.length === 0) {
          setStatesList(response.states);
        }
        if (response.districts) {
          setDistrictsList(response.districts);
        }
      } catch (err) {
        console.error("College search error:", err);
      } finally {
        setLoading(false);
      }
    },
    [statesList.length],
  );

  // Trigger search on query / state / district / page change with debouncing
  useEffect(() => {
    if (!isOpen) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      void fetchColleges(query, page, selectedState, selectedDistrict);
    }, 250);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, page, selectedState, selectedDistrict, isOpen, fetchColleges]);

  function handleSelect(item: CollegeDirectoryItem) {
    const formatted = `${item.name}, ${item.district}, ${item.state}`;
    setQuery(formatted);
    onChange(formatted);
    setIsOpen(false);
    setIsCustomMode(false);
  }

  function handleClear() {
    setQuery("");
    onChange("");
    setPage(1);
    setSelectedState("");
    setSelectedDistrict("");
    setIsCustomMode(false);
    setCustomCollege({ name: "", city: "", state: "" });
    if (inputRef.current) inputRef.current.focus();
  }

  function handleApplyCustom() {
    if (
      !customCollege.name.trim() ||
      !customCollege.city.trim() ||
      !customCollege.state.trim()
    ) {
      return;
    }
    // Phase 5: Mark manually entered institutions as pending verification
    const formatted = `${customCollege.name.trim()}, ${customCollege.city.trim()}, ${customCollege.state.trim()} (Pending Verification)`;
    setQuery(formatted);
    onChange(formatted);
    setIsCustomMode(false);
    setIsOpen(false);
  }

  const totalPages = Math.ceil(totalCount / 15) || 1;
  const isPendingVerification = value.includes("(Pending Verification)");
  const isVerifiedCollege = Boolean(value && !isPendingVerification);

  return (
    <div ref={wrapperRef} className="relative block">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-bold text-foreground">
          College / University Name
          {!required && (
            <span className="ml-1 font-medium text-muted-foreground">
              (optional)
            </span>
          )}
        </label>
        {value && !isCustomMode && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs font-semibold text-muted-foreground transition hover:text-danger"
          >
            Change
          </button>
        )}
      </div>

      {!isCustomMode ? (
        <div className="relative mt-2">
          {/* Left search/loading icon */}
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
            {loading ? (
              <Loader2 size={17} className="animate-spin text-primary" />
            ) : (
              <Search size={17} />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            required={required}
            value={query}
            onFocus={() => {
              setIsOpen(true);
              if (results.length === 0) {
                void fetchColleges(query, 1, selectedState, selectedDistrict);
              }
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
              setIsOpen(true);
              if (value && e.target.value !== value) {
                onChange(""); // Reset selection until confirmed
              }
            }}
            placeholder="Search 38,000 colleges across India"
            className={`h-11 w-full rounded-lg border bg-background pl-10 pr-10 text-sm font-medium outline-none transition focus:ring-2 focus:ring-ring ${
              error ? "border-danger focus:ring-danger/30" : "border-border"
            }`}
          />

          {query ? (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
              title="Clear input"
            >
              <X size={16} />
            </button>
          ) : (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">
              <ChevronDown size={16} />
            </div>
          )}

          {/* Autocomplete Dropdown */}
          {isOpen && (
            <div className="absolute z-50 mt-1.5 max-h-[410px] w-full overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-in fade-in-50 zoom-in-95 flex flex-col">
              {/* Header with state & district filters */}
              <div className="border-b border-border bg-muted/40 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <GraduationCap size={15} className="text-primary" />
                    <span>
                      AISHE India Directory{" "}
                      {totalCount > 0 ? (
                        <span className="text-muted-foreground font-normal">
                          ({totalCount.toLocaleString()} institutions)
                        </span>
                      ) : null}
                    </span>
                  </div>

                  {/* Filter Reset if active */}
                  {(selectedState || selectedDistrict) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedState("");
                        setSelectedDistrict("");
                        setPage(1);
                      }}
                      className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw size={10} />
                      Reset filters
                    </button>
                  )}
                </div>

                {/* State & District Filter Row */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {/* State quick filter */}
                  {statesList.length > 0 && (
                    <div className="flex items-center gap-1 flex-1 min-w-[140px]">
                      <Filter size={11} className="text-muted-foreground shrink-0" />
                      <select
                        aria-label="Filter colleges by state"
                        value={selectedState}
                        onChange={(e) => {
                          setSelectedState(e.target.value);
                          setSelectedDistrict("");
                          setPage(1);
                        }}
                        className="h-7 w-full rounded border border-border bg-background px-2 text-[11px] font-semibold text-foreground outline-none focus:ring-1 focus:ring-ring truncate"
                      >
                        <option value="">All States / UTs (37)</option>
                        {statesList.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* District quick filter (active when state selected) */}
                  {selectedState && districtsList.length > 0 && (
                    <div className="flex items-center gap-1 flex-1 min-w-[140px]">
                      <MapPin size={11} className="text-muted-foreground shrink-0" />
                      <select
                        aria-label="Filter colleges by district"
                        value={selectedDistrict}
                        onChange={(e) => {
                          setSelectedDistrict(e.target.value);
                          setPage(1);
                        }}
                        className="h-7 w-full rounded border border-border bg-background px-2 text-[11px] font-semibold text-foreground outline-none focus:ring-1 focus:ring-ring truncate"
                      >
                        <option value="">All Districts ({districtsList.length})</option>
                        {districtsList.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Suggestions List */}
              <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                {loading && results.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
                    <Loader2 size={16} className="animate-spin text-primary" />
                    <span>Searching national college directory...</span>
                  </div>
                ) : results.length > 0 ? (
                  results.map((item) => {
                    const formatted = `${item.name}, ${item.district}, ${item.state}`;
                    const isSelected = value === formatted;
                    return (
                      <button
                        key={`${item.id}-${item.name}`}
                        type="button"
                        onClick={() => handleSelect(item)}
                        className={`group flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition ${
                          isSelected
                            ? "bg-accent text-accent-foreground font-semibold"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <Building2
                          size={15}
                          className="mt-0.5 shrink-0 text-primary"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-foreground group-hover:text-primary">
                              {item.name}
                            </span>
                            {item.aisheCode && (
                              <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-bold text-muted-foreground">
                                {item.aisheCode}
                              </span>
                            )}
                            {item.type && (
                              <span className="rounded bg-accent/60 px-1.5 py-0.2 text-[10px] font-semibold text-accent-foreground">
                                {item.type}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <MapPin size={11} className="shrink-0" />
                            <span>
                              {item.district}, {item.state}
                            </span>
                            {item.university && (
                              <span className="truncate text-muted-foreground/80">
                                · {item.university}
                              </span>
                            )}
                          </p>
                        </div>
                        {isSelected && (
                          <Check
                            size={16}
                            className="mt-0.5 shrink-0 text-primary"
                          />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">
                      No registered institution found for &quot;{query}&quot;
                      {selectedState ? ` in ${selectedState}` : ""}
                      {selectedDistrict ? ` (${selectedDistrict})` : ""}
                    </p>
                    <p className="mt-1 text-[11px]">
                      Check spelling, try searching by town or district, or click &quot;My College Is Not Listed&quot; below.
                    </p>
                  </div>
                )}
              </div>

              {/* Pagination controls if multiple pages */}
              {totalCount > 15 && (
                <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
                  <span>
                    Page {page} of {totalPages} ({totalCount.toLocaleString()}{" "}
                    results)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="flex h-6 w-6 items-center justify-center rounded border border-border bg-card text-foreground transition hover:bg-muted disabled:opacity-40"
                      title="Previous Page"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={!hasMore || loading}
                      onClick={() => setPage((p) => p + 1)}
                      className="flex h-6 w-6 items-center justify-center rounded border border-border bg-card text-foreground transition hover:bg-muted disabled:opacity-40"
                      title="Next Page"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Requirement: "My College Is Not Listed" fallback trigger */}
              <div className="border-t border-border bg-background p-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomMode(true);
                    setIsOpen(false);
                    setCustomCollege({
                      name: query.trim(),
                      city: selectedDistrict || "",
                      state: selectedState || "",
                    });
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent/60 py-2 text-xs font-bold text-accent-foreground transition hover:bg-accent"
                >
                  <PlusCircle size={15} />
                  <span>My College Is Not Listed</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Manual College Fallback Form (Phase 5) */
        <div className="mt-2 space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400">
            <span className="flex items-center gap-1.5">
              <PlusCircle size={15} />
              Manual College Entry (Pending Verification)
            </span>
            <button
              type="button"
              onClick={() => setIsCustomMode(false)}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Back to Search
            </button>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2.5 text-[11px] text-amber-800 dark:text-amber-300">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600" />
            <p>
              Can&apos;t find your institution in the official AISHE directory? Enter its official name and location below. It will be marked as <strong>Pending Verification</strong> and verified by scholarship officers against AISHE / AICTE accreditation records.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground">
              Official College / Institute Name *
            </label>
            <input
              type="text"
              required
              value={customCollege.name}
              onChange={(e) =>
                setCustomCollege({ ...customCollege, name: e.target.value })
              }
              placeholder="e.g. Government Degree College"
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-xs font-medium outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-foreground">
                District / City / Town *
              </label>
              <input
                type="text"
                required
                value={customCollege.city}
                onChange={(e) =>
                  setCustomCollege({ ...customCollege, city: e.target.value })
                }
                placeholder="e.g. Nandyal"
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-xs font-medium outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground">
                State / Union Territory *
              </label>
              <input
                type="text"
                required
                list="states-datalist"
                value={customCollege.state}
                onChange={(e) =>
                  setCustomCollege({ ...customCollege, state: e.target.value })
                }
                placeholder="e.g. Andhra Pradesh"
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-xs font-medium outline-none focus:ring-2 focus:ring-ring"
              />
              <datalist id="states-datalist">
                {statesList.map((st) => (
                  <option key={st} value={st} />
                ))}
              </datalist>
            </div>
          </div>

          <button
            type="button"
            onClick={handleApplyCustom}
            disabled={
              !customCollege.name.trim() ||
              !customCollege.city.trim() ||
              !customCollege.state.trim()
            }
            className="h-9 w-full rounded-md bg-amber-600 text-xs font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirm College Details (Mark Pending Verification)
          </button>
        </div>
      )}

      {/* Verification Status Indicator for Selected College */}
      {value && !isCustomMode && (
        <div className="mt-1.5">
          {isPendingVerification ? (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 border border-amber-500/30">
                <AlertCircle size={11} />
                Pending Verification
              </span>
              <span className="text-[11px] text-muted-foreground">
                Manually entered institution · subject to admin verification
              </span>
            </div>
          ) : isVerifiedCollege ? (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 size={11} />
                Verified Institution
              </span>
              <span className="text-[11px] text-muted-foreground">
                Official AISHE / Ministry of Education directory record
              </span>
            </div>
          ) : null}
        </div>
      )}

      {error && (
        <span className="mt-1.5 block text-xs font-semibold text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
