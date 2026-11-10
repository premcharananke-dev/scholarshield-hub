import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: readonly string[];
  placeholder?: string;
  searchPlaceholder?: string;
  error?: string | undefined;
  required?: boolean;
  customValue?: string;
  onCustomChange?: (val: string) => void;
  customPlaceholder?: string;
  customError?: string | undefined;
}

export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  searchPlaceholder = "Type to search...",
  error,
  required = true,
  customValue = "",
  onCustomChange,
  customPlaceholder = "Please specify...",
  customError,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search term
  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(searchTerm.trim().toLowerCase()),
  );

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-focus search input when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  function handleSelect(option: string) {
    onChange(option);
    setIsOpen(false);
    setSearchTerm("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    if (onCustomChange) onCustomChange("");
    setSearchTerm("");
  }

  const isOtherSelected = value === "Other";

  return (
    <div ref={containerRef} className="relative block">
      <label className="block text-sm font-bold text-foreground">
        {label}
        {!required && (
          <span className="ml-1 font-medium text-muted-foreground">
            (optional)
          </span>
        )}
      </label>

      {/* Main trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`mt-2 flex h-11 w-full items-center justify-between rounded-lg border bg-background px-3.5 text-left text-sm font-medium outline-none transition focus:ring-2 focus:ring-ring ${
          error ? "border-danger focus:ring-danger/30" : "border-border"
        }`}
      >
        <span className={`truncate ${value ? "text-foreground" : "text-muted-foreground"}`}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {value && (
            <span
              onClick={handleClear}
              className="rounded p-0.5 hover:bg-muted hover:text-foreground"
              title="Clear selection"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown
            size={16}
            className={`transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 max-h-64 w-full overflow-hidden rounded-xl border border-border bg-card shadow-xl animate-in fade-in-50 zoom-in-95">
          {/* Search bar inside dropdown */}
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-2.5 text-xs font-medium outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = value === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs font-medium transition ${
                      isSelected
                        ? "bg-accent text-accent-foreground font-semibold"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <span className="truncate">{option}</span>
                    {isSelected && <Check size={14} className="shrink-0 text-primary" />}
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-muted-foreground">
                No matching options found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom text input if "Other" is selected */}
      {isOtherSelected && onCustomChange && (
        <div className="mt-2 animate-in fade-in slide-in-from-top-1">
          <input
            type="text"
            required
            value={customValue}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder={customPlaceholder}
            className={`h-10 w-full rounded-lg border bg-background px-3 text-xs font-medium outline-none transition focus:ring-2 focus:ring-ring ${
              customError ? "border-danger focus:ring-danger/30" : "border-border"
            }`}
          />
          {customError && (
            <span className="mt-1 block text-xs font-semibold text-danger">
              {customError}
            </span>
          )}
        </div>
      )}

      {error && !isOtherSelected && (
        <span className="mt-1.5 block text-xs font-semibold text-danger">
          {error}
        </span>
      )}
    </div>
  );
}

