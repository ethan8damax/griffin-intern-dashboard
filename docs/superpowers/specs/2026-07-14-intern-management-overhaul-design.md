# Intern Management Software — Overhaul Design

## Vision

Turn the current Griffin/Doeren Mayhew-specific, two-person, no-login dashboard into
software the company can leave behind and reuse for any future intern engagement:
multiple concurrent engagements, real accounts with roles, an admin who can add/manage
interns, a shared timeline both admin and intern see, and integrations (Jira, email)
so the data stays current without manual busywork.

Guiding principle for this whole overhaul: **simplify, don't complicate.** The current
app already feels overwhelming to its own co-creator. Every feature below should make
the app easier to open and understand, not add another thing to configure.

## Non-goals

- No migration of Grace/Ethan's existing dashboard data — the new system starts empty.
- No mobile app — stays a responsive web app.
- No SSO/enterprise auth — Firebase Auth email/magic-link only.
- The "Saved" nav item stays disabled/unbuilt; out of scope for this roadmap.
- No changes to the PDF export mechanism beyond what naturally follows from the new
  data model (still opens a print window).

## Architecture

### Data model (Firestore)

Replace the single `dashboard/main` blob with real collections:

- `users/{uid}` — role (`companyAdmin` | `engagementLead` | `intern`), name, email
- `engagements/{engagementId}` — name, client, leadUserId, jiraBoardId, status
- `engagements/{engagementId}/interns/{internId}` — profile, linked userId, start/end dates
- Per-intern subcollections for goals, journal, priorities, reflections, reviews,
  projects, workload, timeline/milestones — same shapes as today's types in
  `dashboard-data.ts` (including the Projects/Workload/goal-progress fields added
  2026-07-15), scoped to one intern within one engagement instead of one global
  document.

### Auth & roles

Firebase Auth, email/magic-link (no passwords, no separate email service needed —
Firebase sends the sign-in email itself).

Three roles:

- **Company Admin** — creates/archives engagements, invites engagement leads, can view
  across all engagements.
- **Engagement Lead** — adds/removes interns within their own engagement, assigns
  goals, sees their team's rollup progress.
- **Intern** — sees and edits only their own data within their own engagement.

A signed-in user's role determines what they see; there is no more "everyone can edit
everyone" shared-URL model.

## Scorecard replacement

The current Scorecard tab (11 hand-typed metrics across 4 categories, with formulas
like `Σ(acceptance date − start date) ÷ deliverables`) and its matching Reference-tab
KPI definitions are **deleted**, not carried forward. They require manual upkeep nobody
will sustain and don't answer "how's this intern doing" any better than a sentence
would.

Replacement: one auto-computed, plain-language status per intern, e.g.

> "On track — 3/4 goals on schedule, all Jira tickets closed on time this period, avg
> review score 4.2/5"

No color-coded grid, no legend to memorize. Built in Sprint 3 from Goals + Reviews data
(both already exist by then); automatically enriched with Jira on-time/throughput data
once Sprint 4 (Jira sync) lands — no rework needed when that happens, the rollup just
gets a richer input.

The Projects tab added 2026-07-15 gives Sprint 3 an earlier real signal than
originally planned: each project already carries a `status` (including `"Blocked"`)
and a `dueDate`, so the rollup can fold in "any blocked projects" / "on-time project
completion" from day one of Sprint 3, without waiting on Jira sync. `Objective.progress`
and the per-intern `workloads` "Current Capacity" number are both manually-set sliders,
not derived — same manual-upkeep tradeoff the old Scorecard had, so don't treat them as
free auto-computed inputs to the rollup; they stay display-only unless a future sprint
adds real derivation.

## Sprint roadmap

Each sprint gets its own detailed implementation plan (via the writing-plans skill)
when it's actually started — this roadmap stays at the "what and why" level so we're
not planning code we won't touch for months.

### Sprint 0 — Foundation
Firebase Auth (email/magic-link), the new Firestore data model above, and role-based
access control. Company Admin can create an engagement and invite a lead. Screens are
bare-bones — this sprint is plumbing, not polish.

### Sprint 1 — Admin: manage interns
Engagement Lead can add/remove interns in their engagement and assign them goals.
Lead/Admin gets a read-only rollup view of every intern's progress in their engagement.

### Sprint 2 — Timeline
Each intern gets a timeline auto-seeded with standard milestones (kickoff, mid-point
check-in, final review) when they're added. Lead or intern can add custom milestones.
Milestones carry a date + status and can optionally link to another entity (e.g. a
milestone that points at a review).

### Sprint 3 — Intern self-service + simplified UI
Rework Goals, Journal, Priorities, Reflections, Reviews, Projects, and Workload to be
scoped to "whichever intern is signed in" instead of hardcoded Grace/Ethan (Projects
and Workload, added 2026-07-15, join by intern name the same way Profile/Goals/etc.
already do — same rename-orphans-data caveat applies, see CLAUDE.md). Collapse today's
10+ flat nav tabs into something simpler — likely one "My Internship" home surfacing
Timeline + current goals + recent activity, with detail views tucked behind it (a
"My Projects" or "My Workload" detail view naturally fits this same simplified shape).
Delete the old Scorecard tab and its Reference-tab KPI definitions; build the
plain-language rollup described above.

### Sprint 4 — Jira two-way sync
Each engagement is linked to one Jira board (set up once, mapped in the dashboard).
Creating a goal or priority (by lead or intern) auto-creates a matching Jira ticket.
Jira ticket status changes sync back via webhook to update the dashboard. Requires a
Jira Cloud API app and a webhook receiver endpoint.

### Sprint 5 — Email / notifications
Real transactional email (e.g. Resend, Vercel-native) for: review requests (replacing
today's copy-link-to-clipboard), milestone due/overdue reminders, admin invites, and a
weekly digest to leads/admins summarizing their team's progress. The digest needs a
scheduled job (Vercel Cron).

## Open questions / risks to revisit per-sprint

- Jira: multiple interns can share one engagement board — exact issue-per-goal vs.
  issue-per-priority mapping needs to be nailed down when Sprint 4 is planned.
- Simplified nav shape (Sprint 3) is described directionally here ("My Internship"
  home) but the concrete layout should get its own brainstorming pass when that sprint
  starts, ideally with the visual companion.
