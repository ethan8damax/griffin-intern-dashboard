# Sprint 0 — Foundation: Auth, Roles, Data Model

Part of the [intern management software overhaul](2026-07-14-intern-management-overhaul-design.md).
This is the first sprint: Firebase Auth (email/magic-link), the new multi-engagement
Firestore data model, and role-based access control. No polish — this sprint is
plumbing that Sprint 1+ builds on.

## Non-goals (for this sprint specifically)

- Today's dashboard (`/`, reading `dashboard/main`) is untouched — stays fully
  functional, unauthenticated, exactly as it is today. Sprint 3 is what rewires it
  onto the new data model.
- No intern-management UI. `/lead` is a placeholder for Sprint 1 to build on (see
  "Handoff to Sprint 1" below).
- No real email delivery — invite links are copy-pasted by the admin, matching
  today's review-link pattern. Sprint 5 replaces this with real transactional email.
- No `proxy.ts` route gating. Optional per Next.js's own docs, and unnecessary
  overhead for 3 routes and a couple of users — see "Session verification" below.

## Data model (Firestore)

New collections, additive alongside the existing `dashboard/{docId}`:

- **`users/{uid}`** — doc ID is the Firebase Auth UID.
  `{ email, name, role: "companyAdmin" | "engagementLead" | "intern", engagementId?, createdAt }`
- **`engagements/{engagementId}`** —
  `{ name, client, leadUserId, status, createdAt }`
- **`invites/{inviteId}`** — a pre-created account before the person has signed in.
  `{ email, name, role, engagementId?, createdAt, usedAt? }`

## Auth & bootstrap flow

**Bootstrapping the first admins:** an `ALLOWED_ADMIN_EMAILS` env var lists Ethan's
and Grace's emails. On first sign-in, if the signed-in email matches and no
`users/{uid}` doc exists yet, a Server Action auto-creates a `companyAdmin` user doc.
No manual Firestore edits, no seed script.

**Inviting someone (admin creates a lead, or — starting Sprint 1 — a lead creates an
intern):** a Server Action writes an `invites` doc, then calls the Firebase Admin
SDK's `generateSignInWithEmailLink()` (generates the link without sending an email)
and returns it to the UI behind a "Copy link" button. The admin/lead pastes it into
Slack, email, whatever — same manual-send pattern as today's review-link flow.

**Return sign-in (day 2, day 30, ...):** `/login` — user types their email, the
Firebase client SDK's `sendSignInLinkToEmail()` fires, and Firebase emails them a
fresh link automatically. No admin involvement needed after the first invite.

**Sign-in reconciliation (single Server Action, used by both the invite click-through
and every return sign-in):**
1. Firebase Auth completes the email-link sign-in, yielding a stable UID for that
   email.
2. If `users/{uid}` already exists, done — this is a return visit.
3. If not, this is the first sign-in: look up `invites` by matching email, or check
   `ALLOWED_ADMIN_EMAILS`. Create `users/{uid}` from whichever matched, and mark the
   invite `usedAt` if applicable. If the invite's role is `engagementLead`, also set
   `engagements/{engagementId}.leadUserId` to the new UID — the engagement doc is
   created with an empty `leadUserId` at invite time, since the lead's UID doesn't
   exist until they've signed in once.
4. If neither matches, deny access with a "no account found — contact your admin"
   message. (The dangling Firebase Auth user is harmless and left as-is.)

Routing everyone through this one Server Action means there's no path to a valid
Firebase session with no resolved role.

## Routes & pages

All new, nothing under today's `/` changes:

- **`/login`** — email input + the click-through handler for magic links (checks
  `isSignInWithEmailLink`, runs the reconciliation Server Action, redirects by role).
- **`/admin`** — Company Admin only. List engagements, create-engagement form, list
  users, invite-lead form (name/email/engagement → invite + copy-link button).
- **`/lead`** — Engagement Lead only. Sprint 0 ships this as a placeholder: "Signed in
  as Engagement Lead for [engagement name]. Intern management coming in Sprint 1."
  Proves the role/routing/data model work end-to-end without building UI Sprint 1
  will immediately replace.
- **`/intern`** — Intern only. Placeholder: "You're signed in as an intern. Nothing
  here yet." Sprint 3 builds this out.

## Session verification

- After client-side Firebase sign-in, a Server Action takes the ID token, verifies it
  with the Admin SDK, and calls `createSessionCookie()` to set an httpOnly, ~7-day
  session cookie. This is Firebase's own primitive — no separate custom JWT/`jose`
  layer on top; that would just be re-signing something Firebase already signs.
- Each protected page (`/admin`, `/lead`, `/intern`) is a Server Component that calls
  a `verifySession()` DAL helper: decodes the cookie via `verifySessionCookie()`,
  loads the `users/{uid}` doc, and redirects to `/login` if there's no valid session
  or the role doesn't match the route. This is the actual enforcement.
- No `proxy.ts`. It only offers an optimistic pre-render redirect and Next.js's own
  docs call it optional; the per-page DAL check is required regardless since proxy
  can't safely query Firestore. Add it later only if the number of protected routes
  grows enough that per-page redirect flash becomes a real annoyance.
- Sign-out: clear the session cookie + call the Firebase client `signOut()`.

## Firestore security rules

Add role-scoped rules for the three new collections, alongside the existing
open `dashboard/{docId}` rule (left untouched — the old dashboard still needs it):

- `users/{uid}`: readable by the user themself and any `companyAdmin`; writable only
  server-side (via Admin SDK, which bypasses rules) — clients never write this
  collection directly.
- `engagements/{engagementId}`: readable by its `leadUserId` and any `companyAdmin`;
  writable only by `companyAdmin`.
- `invites/{inviteId}`: writable only by `companyAdmin` (Sprint 0) — Sprint 1 extends
  this to also allow the relevant `engagementLead`.

## New dependencies / config

- Add `firebase-admin` (server-side only) for `generateSignInWithEmailLink()`,
  `verifyIdToken()`, and session cookie creation/verification.
- New env vars: a Firebase service-account credential (`FIREBASE_ADMIN_*` or JSON) for
  the Admin SDK, and `ALLOWED_ADMIN_EMAILS`. Needed in `.env.local` and Vercel project
  settings, same as the existing `NEXT_PUBLIC_FIREBASE_*` vars.
- Firebase Console: enable the Email Link sign-in provider, add the app's domain(s) to
  Authorized Domains.

## Handoff to Sprint 1

Sprint 1 ("Admin: manage interns") picks up directly at `/lead`: replace its
placeholder with the real "invite/add intern" form (reusing the invite Server Action
and copy-link UI already built here, just scoped to `role: "intern"` and the lead's
own `engagementId`), plus the read-only rollup view of intern progress described in
the parent design doc.

## Workflow note

Each sprint gets its own branch, created off `main` (or the prior sprint's branch, if
still unmerged) when that sprint's brainstorming starts. Branches are not deleted
after merge.
