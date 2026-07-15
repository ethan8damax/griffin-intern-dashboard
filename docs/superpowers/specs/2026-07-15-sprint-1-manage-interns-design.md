# Sprint 1 — Admin: Manage Interns

Part of the [intern management software overhaul](2026-07-14-intern-management-overhaul-design.md),
building on [Sprint 0's foundation](2026-07-15-sprint-0-foundation-design.md) (Firebase
Auth, roles, the `users`/`engagements`/`invites` Firestore model). This sprint lets an
Engagement Lead invite and remove interns in their own engagement, and see a roster.

## Scope adjustments from the parent roadmap

The parent design doc's one-line Sprint 1 description ("add/remove interns and assign
them goals... rollup view of every intern's progress") was written before Sprint 0
existed and doesn't quite match what's actually buildable yet:

- **No goal-assignment.** Goals still only exists in the old single-blob dashboard;
  migrating it to the new per-engagement model is Sprint 3's job. Building a
  throwaway goals feature now, ahead of that migration, isn't worth it.
- **"Rollup" means roster status, not progress.** There's no activity data (goals,
  priorities, etc.) in the new model yet to roll up — Sprint 3 unlocks that. Sprint 1's
  rollup is: who's been invited, who's active, who's been removed.
- **Lead-only, not admin-facing.** Company Admin doesn't get a cross-engagement roster
  view in this sprint — keeps scope tight, matches the "simplify, don't complicate"
  principle. `/admin` is unchanged from Sprint 0.

## Data model

`UserDoc` (`src/lib/auth/types.ts`) gains one field:

```ts
export interface UserDoc {
  email: string;
  name: string;
  role: UserRole;
  engagementId?: string;
  createdAt: number;
  status: "active" | "removed";
}
```

Set to `"active"` at creation in both `completeSignIn` paths (invite redemption and
admin-allowlist bootstrap). "Removed" is soft-delete: the Firestore doc and Firebase
Auth account both stay intact — only the `status` field changes. This keeps an audit
trail and makes removal reversible (see Reactivate, below), rather than permanently
destroying data the moment Sprint 3 might want to attach activity history to it.

## Access control

Two enforcement points, not one:

1. **`completeSignIn`** (`src/lib/auth/actions.ts`): when `resolveSignIn` returns
   `{ kind: "existing", user }`, check `user.status !== "removed"` before creating a
   session. If removed, throw the same "no account found" error the `denied` case
   uses — deny before a session is ever created, rather than creating one and only
   catching it downstream. (`resolveSignIn` itself in `reconcile.ts` stays a pure
   function with no new branching — the status check belongs in the Server Action
   that already owns side effects, not in the pure reconciliation logic.)
2. **`requireRole`** (`src/lib/auth/dal.ts`): also checks `user.status !== "removed"`,
   redirecting to `/login` exactly like a role mismatch does. This is what actually
   revokes access for someone already mid-session when they get removed — the next
   request re-fetches their Firestore doc (via `getCurrentUser`'s per-request cache,
   not a longer-lived cache) and denies them. No need to call the Admin SDK's
   `revokeRefreshTokens` to invalidate their Firebase session cookie itself — gating
   on the Firestore `status` field at the application layer is sufficient and simpler.

## Firestore rules

`invites/{inviteId}` write access extends from `companyAdmin`-only to also allow
`engagementLead` (anticipated in the Sprint 0 rules comment). Still defense-in-depth
only — real writes go through the Admin SDK, which bypasses rules regardless.

## `/lead` page (replaces the Sprint 0 placeholder)

**Roster**: merges two Firestore reads — `users` where `role == "intern"` and
`engagementId` matches the lead's own, and `invites` where `role == "intern"`, same
`engagementId`, `usedAt == null`. Each row is one of three states:

- **Invited** (pending, unredeemed invite) — has a **Cancel** action (deletes the
  invite doc).
- **Active** — has a **Remove** action (sets `status: "removed"`).
- **Removed** — stays visible (not hidden — that's the point of soft-delete) — has a
  **Reactivate** action (sets `status: "active"`).

**Invite intern form**: same shape as `/admin`'s `InviteLeadForm` (name + email →
generates a copy-link invite via the Admin SDK, same as Sprint 0's lead-invite flow),
but simpler — no engagement dropdown, since it's implicitly the lead's own
`engagementId`. Before creating a new invite, checks for an existing unused invite for
that email within the same engagement; if found, returns that invite's link instead of
creating a duplicate.

**New Server Actions**, `src/app/lead/actions.ts`:

- `inviteIntern(formData)` — mirrors `createInvite`, hardcodes `role: "intern"` and
  the calling lead's own `engagementId`, includes the duplicate-invite check above.
- `removeIntern(formData)` — verifies the target user's `engagementId` matches the
  calling lead's own (a lead can't remove someone else's intern) before setting
  `status: "removed"`.
- `reactivateIntern(formData)` — same authorization check, sets `status: "active"`.
- `cancelInvite(formData)` — same authorization check against the invite's
  `engagementId`, deletes the invite doc.

All four call `requireRole("engagementLead")` first, matching every other mutating
Server Action in the app.

## Known limitation (documented, not solved this sprint)

`UserDoc.engagementId` is a single field, not a list — a person belongs to at most one
engagement at a time. If a lead invites someone who already has an active account in a
*different* engagement, `resolveSignIn`'s existing-user branch signs them into their
original engagement, silently ignoring the new invite. At the current scale (a handful
of engagements and interns) this isn't worth a cross-engagement uniqueness check yet,
but it's a real gap a future sprint should address if the org grows.
