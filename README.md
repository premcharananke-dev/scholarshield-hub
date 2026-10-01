# ScholarShield

## Project Description
ScholarShield is a responsive scholarship eligibility and disbursement system built as an academic prototype. It gives students a clear path from application to payment and gives administrators a focused review workspace.

## Problem Statement
Scholarship processes can be difficult to follow, repetitive applications can be hard to identify, and students often lack a transparent view of review and disbursement progress.

## Proposed Solution
ScholarShield centralizes student applications, runs a transparent first-pass eligibility check, detects potential duplicates, supports administrator decisions, and presents a dated status timeline.

## Features
- Student and administrator sign-in, plus student sign-up
- Stored student profiles and prefilled application details
- Validated scholarship application form
- Rule-by-rule eligibility evaluation
- Browser-safe duplicate fingerprinting
- Application history, details, and tracking
- Administrator search, filters, review, approval, rejection, and disbursement
- Responsive mobile bottom navigation and desktop sidebar
- Persistent prototype data and derived dashboard totals

## Technology Stack
- React 19 and TypeScript
- TanStack Start and TanStack Router
- Tailwind CSS 4
- Lucide icons
- Browser localStorage through a typed data service
- Web Crypto SHA-256

## System Workflow
`Apply → Duplicate Check → Eligibility Evaluation → Admin Review → Approve/Reject → Disburse`

## Eligibility Rules
The prototype checks each condition independently:
1. Annual family income is at most ₹2,50,000
2. Category is SC, ST, or OBC
3. Academic percentage is at least 60%
4. Attendance is at least 75%

## Project Structure
- `src/routes/index.tsx` — complete application experience and workflow
- `src/styles.css` — semantic design tokens and global presentation
- `src/routes/__root.tsx` — application shell and document metadata
- `public/` — static files

## How to Run Locally
```bash
bun install
bun run dev
```
Open the local URL printed by the development server.

## Demo Login Credentials
- Student: `student@scholarshield.com`
- Admin: `admin@scholarshield.com`
- Password for both: `scholar123`

Use the demo role buttons on the sign-in screen to fill these details automatically.

## Future Enhancements
- Connect institutional identity verification
- Integrate document verification
- Add configurable scholarship rule sets
- Integrate an approved banking disbursement service
- Add audit exports for institutions

## Academic Prototype Disclaimer
ScholarShield is an academic prototype. The eligibility thresholds used in this application are demonstration rules and may not represent the requirements of any specific government or institutional scholarship.
