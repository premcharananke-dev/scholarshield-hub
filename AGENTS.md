<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to Lovable. Avoid rewriting published git history.
<!-- LOVABLE:END -->

- Data lives in Lovable Cloud; all UI reads/writes go through `src/lib/data.ts` with row-level security deciding access.
- Keep all scholarship eligibility logic in `src/lib/eligibility.ts` so rules stay explainable in one place.
- Eligibility rules are structured columns on `scholarships` (no separate rules table) to avoid duplicate data.
- Status history and disbursement-order rules are enforced by database triggers, not the client, so they cannot be bypassed.
- Demo accounts are created on first demo sign-in by `ensureDemoAccounts` (fixed emails only); auto-confirm is on and leaked-password checks are off so the documented demo password works.
- Demo sign-in authenticates existing Lovable Cloud users directly; it never provisions accounts or assigns roles from a public sign-in request, preventing unauthenticated privilege escalation.
