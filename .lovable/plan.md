# ScholarShield implementation plan

## Product scope
Build a responsive scholarship eligibility and disbursement application with two roles: student and administrator. Keep every screen focused on applying, evaluating, reviewing, tracking, approving, rejecting, and disbursing scholarships.

## Student experience
- Build a centered sign-in/sign-up screen with email/password, demo student/admin access, and stored student profiles.
- Create mobile bottom navigation and a desktop sidebar for Home, Apply, Applications, and Profile.
- Add a validated application form with personal, academic, financial, category, scholarship, and confirmation fields.
- Evaluate the four prototype eligibility rules individually after submission and show a dedicated result page.
- Add application lists, status details, and a dated progress timeline that reflects administrative changes.
- Show the student's reusable profile and actual applications, with secure sign-out.

## Administrator experience
- Create a separate admin dashboard with live counts calculated from stored applications.
- Add application search and filters for status, category, and scholarship type.
- Build a complete review screen with student, academic, financial, scholarship, eligibility, and duplicate-check information.
- Add confirmed actions for request review, approve, reject, and mark disbursed, enforcing approval before disbursement.

## Data and security
- Use Lovable Cloud for accounts, profiles, roles, applications, eligibility results, duplicate fingerprints, and status history.
- Keep roles in a dedicated protected table and validate role access on the server.
- Add row-level access rules so students see only their own data while admins can review all applications.
- Normalize Student ID, email, scholarship type, and academic year before generating a SHA-256 duplicate fingerprint.
- Include no more than three clearly marked demo applications and keep dashboard totals derived from data.

## Visual direction
- Use the supplied visual brief: light surfaces, teal primary actions, blue accents, navy text, soft shadows, rounded cards, line icons, pill badges, and spacious mobile-first layouts.
- Ensure forms, cards, timelines, filters, and navigation adapt cleanly from 360px phones through desktop.
- Use restrained transitions and accessible focus, contrast, touch targets, validation, and confirmation states.

## Pages
- Public: sign in/sign up, About, password reset.
- Student: Home, Apply, Eligibility Result, Applications, Application Details/Tracking, Profile.
- Admin: Dashboard, Applications, Application Review, Profile.
- Give every public/content page distinct page metadata.

## Verification and documentation
- Test sign-up, both demo logins, submission validation, eligibility outcomes, duplicate detection, status tracking, admin search/filter/actions, disbursement rules, persistence, and responsive layouts.
- Replace the repository README with complete setup, workflow, rules, demo credentials, structure, future enhancements, and academic disclaimer documentation.
- Keep the repository ready for manual GitHub upload; no credentials or private secrets will be committed.
