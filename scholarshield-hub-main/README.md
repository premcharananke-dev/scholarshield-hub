# ScholarShield

## Project Description
ScholarShield is a responsive Scholarship Discovery, Eligibility Verification, Application Management and Disbursement Tracking platform built as an academic project. Students discover scholarships (including a dedicated **Women Empowerment Scholarships** section), check eligibility against their profile, apply, and track review and payment. Administrators manage the scholarship catalogue, review applications and record disbursements.

## Problem Statement
Students often do not know which scholarships exist or whether they qualify, especially schemes designed for girls' higher education. Application progress and payment status are also hard to follow.

## Proposed Solution
A single portal that matches each student's profile against structured scholarship criteria, explains every result, and connects discovery to an application workflow with a dated, database-backed timeline.

## Features
- Student/admin sign-in, student sign-up with optional private gender field and matching consent
- Scholarship discovery: search, filters (Government, Private, Merit-Based, Need-Based, Category-Based, Women-Specific, Saved), details, documents, dates, official links
- Women Empowerment Scholarships highlighted on a female student's dashboard; women-only schemes are not shown as opportunities to male students
- Recommendation engine with three results: Eligible, Not Eligible, Additional Information Required — with reasons per condition
- Save scholarships for later
- Application form prefilled from the profile, document checklist, SHA-256 duplicate detection
- Statuses: Submitted, Eligibility Verified, Not Eligible, Under Review, Approved, Rejected, Disbursement Pending, Disbursed
- Disbursed only after a payment reference is recorded (enforced in the database)
- Admin: dashboard statistics, application search/filters, review, document verification, scholarship add/edit/deactivate/delete

## Technology Stack
React 19, TypeScript, TanStack Start/Router, Tailwind CSS 4, Lucide icons, Lovable Cloud (PostgreSQL with row-level security, authentication), Web Crypto SHA-256.

## System Workflow
`Discover → View Details → Eligibility Check → Apply → Review → Approve/Reject → Disbursement Pending → Disbursed`

## Database
| Table | Purpose |
| --- | --- |
| `profiles` | Student details used for matching (gender visible only to the student and admins) |
| `user_roles` | Admin/student roles (separate table to prevent privilege escalation) |
| `scholarships` | Catalogue; eligibility rules are stored as structured columns (gender, levels, streams, years, income, marks, categories) |
| `applications` | Submitted applications with stored rule results and fingerprint |
| `application_history` | Dated status timeline, written automatically by database triggers |
| `application_documents` | Per-application document checklist and admin verification |
| `saved_scholarships` | Student bookmarks |
| `disbursements` | Payment records; completing one is the only way an application becomes Disbursed |

## Eligibility Matching
All rules live in `src/lib/eligibility.ts`. Each recorded condition is checked separately; any failed condition gives **Not Eligible**, any missing profile detail gives **Additional Information Required**, otherwise **Eligible**. Conditions that cannot be checked from a profile (e.g. "government school") are listed for the student to confirm. Eligibility is never an approval or a payment.

## Scholarship Data
Nine scholarships were checked against official provider pages (AICTE, Kotak Education Foundation, L'Oréal India, Santoor/Wipro, Ministry of Education NSP, Department of Social Justice, Ministry of Tribal Affairs, Reliance Foundation). Details that could not be confirmed (most 2026-27 deadlines, some amounts) are marked **Unverified** in the app.

## Project Structure
- `src/routes/index.tsx` — app shell, auth, student and admin screens
- `src/components/scholarships.tsx` — discovery, cards, details, women section
- `src/components/admin-scholarships.tsx` — scholarship management
- `src/components/ui-kit.tsx` — shared UI pieces
- `src/lib/eligibility.ts` — matching rules
- `src/lib/data.ts` — data service
- `src/lib/demo-accounts.functions.ts` — creates the demo accounts on first use
- `drizzle/migrations/` — database schema

## How to Run Locally
```bash
bun install
bun run dev
```

## Demo Login Credentials
- Student: `student@scholarshield.com`
- Admin: `admin@scholarshield.com`
- Password: `scholar123`

## Future Enhancements
Document uploads, deadline reminders, state-specific scholarships, institutional identity verification, bank payment integration.

## Disclaimer
ScholarShield is an academic project. Always confirm scholarship details on the official website before applying. Eligibility results are indicative only.
