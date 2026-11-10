import { useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";

export interface PasswordValidationRules {
  minLength: boolean;
  hasLower: boolean;
  hasUpper: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export function validatePasswordRules(pwd: string): PasswordValidationRules {
  return {
    minLength: pwd.length >= 8,
    hasLower: /[a-z]/.test(pwd),
    hasUpper: /[A-Z]/.test(pwd),
    hasNumber: /[0-9]/.test(pwd),
    hasSpecial: /[^A-Za-z0-9]/.test(pwd),
  };
}

export function isPasswordSatisfied(rules: PasswordValidationRules): boolean {
  return (
    rules.minLength &&
    rules.hasLower &&
    rules.hasUpper &&
    rules.hasNumber &&
    rules.hasSpecial
  );
}

interface PasswordInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  error?: string | undefined;
  required?: boolean;
  autoComplete?: string;
  showChecklist?: boolean;
}

export function PasswordInput({
  label,
  value,
  onChange,
  placeholder = "Enter password",
  error,
  required = true,
  autoComplete = "new-password",
  showChecklist = false,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const rules = validatePasswordRules(value);

  const checklistItems = [
    { label: "At least 8 characters", met: rules.minLength },
    { label: "At least one small letter", met: rules.hasLower },
    { label: "At least one capital letter", met: rules.hasUpper },
    { label: "At least one number", met: rules.hasNumber },
    { label: "At least one special character", met: rules.hasSpecial },
  ];

  return (
    <div className="block">
      <label className="block text-sm font-bold text-foreground">
        {label}
        {!required && (
          <span className="ml-1 font-medium text-muted-foreground">
            (optional)
          </span>
        )}
      </label>

      <div className="relative mt-2">
        <input
          required={required}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`h-11 w-full rounded-lg border bg-background pl-3.5 pr-11 text-sm font-medium outline-none transition focus:ring-2 focus:ring-ring ${
            error ? "border-danger focus:ring-danger/30" : "border-border"
          }`}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          tabIndex={-1}
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted-foreground transition hover:text-foreground focus:outline-none"
        >
          {showPassword ? (
            <EyeOff size={18} className="text-muted-foreground" />
          ) : (
            <Eye size={18} className="text-muted-foreground" />
          )}
        </button>
      </div>

      {error && (
        <span className="mt-1.5 block text-xs font-semibold text-danger">
          {error}
        </span>
      )}

      {showChecklist && (
        <div className="mt-3.5 space-y-2 select-none" aria-live="polite">
          {checklistItems.map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-2.5 text-xs font-medium transition-colors duration-150 ${
                item.met
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground/80"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm transition-all duration-150 ${
                  item.met
                    ? "text-success text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground/40"
                }`}
              >
                {item.met ? (
                  <Check size={16} strokeWidth={2.8} />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                )}
              </span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

