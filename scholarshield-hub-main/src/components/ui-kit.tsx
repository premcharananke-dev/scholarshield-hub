// Small shared UI building blocks (cards, buttons, form fields, badges) used across ScholarShield.
import { FileText, Info, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import type { Status } from "@/lib/types";
import type { Verdict } from "@/lib/eligibility";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border bg-card shadow-card ${className}`}>{children}</section>;
}

type ButtonProps = { children: ReactNode; onClick?: (() => void) | undefined; type?: "button" | "submit"; variant?: "primary" | "secondary" | "outline" | "danger" | "ghost"; className?: string; disabled?: boolean; ariaLabel?: string };
export function Button({ children, onClick, type = "button", variant = "primary", className = "", disabled = false, ariaLabel }: ButtonProps) {
  const styles = { primary: "bg-primary text-primary-foreground hover:opacity-90", secondary: "bg-secondary text-secondary-foreground hover:opacity-90", outline: "border bg-card text-foreground hover:bg-muted", danger: "bg-danger text-primary-foreground hover:opacity-90", ghost: "text-muted-foreground hover:bg-muted" };
  return <button type={type} aria-label={ariaLabel} onClick={onClick} disabled={disabled} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}>{children}</button>;
}

type FieldProps = { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; error?: string | undefined; inputMode?: "numeric" | "decimal"; required?: boolean; hint?: string };
export function Field({ label, value, onChange, type = "text", placeholder, error, inputMode, required = true, hint }: FieldProps) {
  return <label className="block text-sm font-bold">{label}{!required && <span className="ml-1 font-medium text-muted-foreground">(optional)</span>}
    <input required={required} type={type} inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm font-medium outline-none transition focus:ring-2 focus:ring-ring ${error ? "border-danger" : ""}`} />
    {hint && !error && <span className="mt-1 block text-xs font-medium text-muted-foreground">{hint}</span>}
    {error && <span className="mt-1 block text-xs font-medium text-danger">{error}</span>}</label>;
}

type SelectProps = { label?: string; value: string; onChange: (v: string) => void; options: readonly string[]; error?: string | undefined; ariaLabel?: string | undefined; required?: boolean; placeholder?: string };
export function SelectField({ label, value, onChange, options, error, ariaLabel, required, placeholder = "Select an option" }: SelectProps) {
  return <label className="block text-sm font-bold">{label}
    <select aria-label={ariaLabel || label} required={required ?? !!label} value={value} onChange={(e) => onChange(e.target.value)} className={`${label ? "mt-2" : ""} h-11 w-full rounded-lg border bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-ring ${error ? "border-danger" : ""}`}>
      {label && <option value="">{placeholder}</option>}{options.map((o) => <option key={o}>{o}</option>)}
    </select>{error && <span className="mt-1 block text-xs font-medium text-danger">{error}</span>}</label>;
}

export function FormSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <Card className="p-5 sm:p-6"><div className="mb-5 flex items-center gap-3 border-b pb-4 text-primary">{icon}<h2 className="text-sm font-extrabold uppercase">{title}</h2></div>{children}</Card>;
}
export function PageTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{subtitle}</p></div>{action}</div>;
}
export function InfoItem({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-xs font-bold uppercase text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-extrabold">{value}</p></div>;
}
export function DetailGroup({ title, items }: { title: string; items: Array<[string, string]> }) {
  return <div><p className="mb-3 text-xs font-extrabold uppercase text-primary">{title}</p><div className="grid gap-4 sm:grid-cols-2">{items.map(([l, v]) => <InfoItem key={l} label={l} value={v} />)}</div></div>;
}
export function StatusBadge({ status }: { status: Status }) {
  const cls = status === "APPROVED" || status === "ELIGIBILITY VERIFIED" ? "bg-success-soft text-success"
    : status === "REJECTED" || status === "NOT ELIGIBLE" ? "bg-danger-soft text-danger"
    : status === "DISBURSED" ? "bg-info-soft text-info" : "bg-warning-soft text-warning";
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${cls}`}>{status}</span>;
}
export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const cls = verdict === "Eligible" ? "bg-success-soft text-success" : verdict === "Not Eligible" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning";
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${cls}`}>{verdict === "Additional Information Required" ? "Info Required" : verdict}</span>;
}
export function Disclaimer({ text }: { text?: string }) {
  return <div className="mt-6 flex gap-3 rounded-lg border bg-muted/70 p-4"><Info className="mt-0.5 shrink-0 text-info" size={18} /><p className="text-xs leading-5 text-muted-foreground"><b>Academic prototype:</b> {text ?? "Eligibility results are an indication based on the details you provided. The scholarship provider makes the final decision, and an eligible result is not an approval or a payment."}</p></div>;
}
export function EmptyState({ title = "Nothing found", text = "Try changing the current filters." }: { title?: string; text?: string }) {
  return <div className="rounded-lg border border-dashed bg-card p-10 text-center"><FileText className="mx-auto text-muted-foreground" /><p className="mt-3 font-bold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>;
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-2"><span className={`grid place-items-center rounded-lg bg-primary text-primary-foreground ${compact ? "h-9 w-9" : "h-10 w-10"}`}><ShieldCheck size={22} /></span><div><p className={`${compact ? "text-base" : "text-lg"} font-extrabold leading-none`}>SCHOLAR<span className="text-primary">SHIELD</span></p>{!compact && <p className="mt-1 text-[10px] font-bold text-muted-foreground">DISCOVER · APPLY · TRACK</p>}</div></div>;
}
export function prettyDate(value: string | null | undefined) {
  if (!value) return "Pending";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${active ? "bg-primary text-primary-foreground" : "border bg-card text-muted-foreground hover:text-foreground"}`}>{children}</button>;
}
