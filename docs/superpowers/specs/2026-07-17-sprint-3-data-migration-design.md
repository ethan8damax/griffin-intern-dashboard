# Sprint 3, Sub-project 1 — Per-Intern Data Model Migration

Part of [Sprint 3](2026-07-14-intern-management-overhaul-design.md#sprint-3--intern-self-service--simplified-ui),
building on [Sprint 0](2026-07-15-sprint-0-foundation-design.md) (auth/roles),
[Sprint 1](2026-07-15-sprint-1-manage-interns-design.md) (roster management), and
[Sprint 2](2026-07-16-sprint-2-timeline-design.md) (the `users/{uid}/timeline`
subcollection pattern this sprint reuses throughout).

Sprint 3 bundles three fairly independent pieces of work: this data-model migration,
a nav/UI redesign, and the Scorecard-to-plain-language-rollup replacement. Each gets
its own spec/plan. This doc covers only the first: giving Goals, Journal, Priorities,
Reflections, Reviews, Projects, and Workload (plus Profile, folded in — see below) a
home in the new per-engagement auth model, with Server Actions and Firestore rules to
match, verified through bare-bones placeholder pages (no styling, no nav integration).
The next sub-project (nav redesign) builds the real UI on top of this schema.

## Non-goals (inherited from the parent roadmap, restated for clarity)

- **No data porting.** Per the parent design doc's explicit non-goal, Grace/Ethan's
  existing `dashboard/main` blob data is not migrated — the new model starts empty.
  This sub-project is building 8 fresh data models against the new schema, not moving
  old records.
- **No real UI.** Placeholder pages only (same bare-bones `<ul>`/`<form>` style as
  `/admin`, `/lead`, `/intern` today) — enough to verify the schema and Server Actions
  work, not a finished feature. The nav-redesign sub-project replaces these.
- **No Scorecard/KPI migration.** That tab and its Reference-tab definitions are
  deleted outright in a later sub-project, not moved.
- **No real Jira sync.** The Reference tab's mocked Jira preview stays exactly as
  mocked; out of scope here.
- **No review request/response flow rebuild.** This sub-project settles where review
  data lives; the actual "send a review link" UX is unchanged from today's pattern
  (copy a link to clipboard, no email) and isn't rebuilt here.

## Scope call: Profile is included

The parent roadmap's Sprint 3 sentence lists "Goals, Journal, Priorities, Reflections,
Reviews, Projects, and Workload" — Profile isn't named. But Profile
(role/bio/manager/department/start-date) joins by intern name today exactly the way
Projects and Workload do (per CLAUDE.md's own description), and leaving it behind on
the old blob while everything else moves would produce a half-migrated, inconsistent
state: an intern's `/intern` page would show their real goals/projects but an
unrelated placeholder for who they are. Profile is folded into this sub-project,
combined with Workload's capacity number into one small per-user doc (see below).

## Data model

Two kinds of storage, matching whether data belongs to one intern or the whole team:

**Per-intern subcollections** (`users/{uid}/...`, same pattern as `timeline`):

```ts
// users/{uid}/goals/{id}
export interface GoalDoc {
  objective: string;
  status: "green" | "yellow" | "red" | "gray";
  targetDate: string; // "YYYY-MM-DD"
  progress: number; // 0-100, manually set — no formula, same as today
  krs: { id: string; text: string }[];
  createdAt: number;
}

// users/{uid}/journal/{id}
export interface JournalEntryDoc {
  date: string; // "YYYY-MM-DD"
  type: "win" | "blocker" | "checkin" | "note";
  text: string;
  createdAt: number;
}

// users/{uid}/priorities/{id}
export interface PriorityDoc {
  text: string;
  weekOf: string; // "YYYY-MM-DD", Monday of the week — flattened, not grouped into
                  // a week document, same simplification Sprint 2 made for milestones
  status: "Done" | "In Progress" | "Not Started" | "Blocked";
  linkedGoalId: string | null; // points at a users/{uid}/goals/{id} or
                               // engagements/{id}/goals/{id} — see below
  createdAt: number;
}

// users/{uid}/projects/{id}
export interface ProjectDoc {
  name: string;
  assignedBy: string; // free text, same as today — not every assigner has an account
  status: "Not Started" | "In Progress" | "Complete" | "Blocked";
  dueDate: string;
  githubRepo: string;
  jiraTicket: string;
  projectLink: string;
  deliverables: string;
  estimatedTime: string;
  priority: "Low" | "Medium" | "High";
  createdAt: number;
}

// users/{uid}/profile (single doc, not a collection)
export interface ProfileDoc {
  role: string;
  manager: string;
  department: string;
  startDate: string;
  bio: string;
  capacity: number; // 0-100, "Current Capacity" — lead-set, still just a slider,
                     // no formula behind it, same as today
}
```

**Engagement-scoped collections** (`engagements/{id}/...`) for anything without a
single owner, or with two different people on either side of it:

```ts
// engagements/{id}/goals/{id} — team objectives, no single assignee
export interface TeamGoalDoc {
  objective: string;
  status: "green" | "yellow" | "red" | "gray";
  targetDate: string;
  progress: number;
  krs: { id: string; text: string }[];
  createdAt: number;
}

// engagements/{id}/priorities/{id} — team priorities
export interface TeamPriorityDoc {
  text: string;
  weekOf: string;
  status: "Done" | "In Progress" | "Not Started" | "Blocked";
  linkedGoalId: string | null;
  createdAt: number;
}

// engagements/{id}/reflections/{id}
export interface ReflectionDoc {
  category: "self" | "peer" | "work";
  authorUid: string | null; // null only for "work" (team) reflections
  subjectUid: string | null; // set for "peer" (who the reflection is about); null
                              // for "self" and "work"
  weekOf: string;
  text: string;
  createdAt: number;
}

// engagements/{id}/reviews/{id}
export interface ReviewDoc {
  token: string; // matches today's ?review=<token> link flow, unchanged
  subjectUserId: string; // must be a real users/{uid} intern
  reviewerName: string; // plain text — a reviewer never needs an account
  reviewerRole: string; // plain text, e.g. "Engagement Lead", "Fellow intern"
  status: "pending" | "submitted";
  requestedDate: string;
  submittedDate?: string;
  questions: {
    id: string;
    text: string;
    type: "score" | "text";
    response: number | string | null;
  }[];
  createdAt: number;
}
```

`PriorityDoc.linkedGoalId` can point at either an individual or a team goal — since
both live under different parent paths, resolving it means checking the intern's own
`goals` subcollection first, then the engagement's `goals` collection. This mirrors
Sprint 2's "collapsed ownership check" pattern in spirit: a small shared lookup
function, not duplicated logic at each call site.

## Access control

Every read/write goes through `requireRole()` first, exactly like every existing
Server Action. Beyond that:

| Collection | Intern (own) | Intern (other) | Lead (own engagement) |
|---|---|---|---|
| `users/{uid}/goals` | read + update `status`/`progress` | no access | read + create/update/delete |
| `engagements/{id}/goals` | read only | read only | read + create/update/delete |
| `users/{uid}/journal` | read + write | no access | read only |
| `users/{uid}/priorities` | read + write | no access | read + write |
| `engagements/{id}/priorities` | read only | read only | read + write |
| `engagements/{id}/reflections` | read + write where `authorUid == self` | read only | read + write (incl. `authorUid: null` "work" category) |
| `engagements/{id}/reviews` | read where `subjectUserId == self` | no access | read + create for any intern in engagement |
| `users/{uid}/projects` | read + update `status` | no access | read + create/update/delete |
| `users/{uid}/profile` | read + write (bio only) | read only | read + write (incl. `capacity`) |

"Lead (own engagement)" always means: the calling lead's `engagementId` matches the
target intern's `engagementId` (or the engagement doc's id, for engagement-scoped
collections) — the same ownership check Sprint 1/2 already established
(`assertSameEngagement`/`assertOwnedIntern`), reused here rather than reinvented per
entity.

The Reviews row above describes the *authenticated* surface only (a signed-in intern
reading their own review results; a signed-in lead creating a request). Submitting a
response stays exactly like today: an unauthenticated reviewer follows the
`?review=<token>` link and posts their answers through that existing token-based
route, unrelated to `requireRole()` entirely — this sub-project changes where the
`ReviewDoc` is stored, not that flow.

Firestore rules for all of the above stay defense-in-depth only, matching every
existing rule in `firestore.rules` — real reads/writes go through the Admin SDK via
Server Actions, which bypass rules entirely.

## Verification approach (no real UI)

For each of the 8 areas: the Firestore types above, a Server Actions file
(create/update/delete as the access table allows), and a placeholder route
(`/intern/<area>` and, where the lead has write access, a lead-facing equivalent)
rendering the raw data in a plain list — no styling, no nav entry, matching Sprint
0-2's approach to unstyled scaffolding pages. Any pure, testable logic (e.g. the
`linkedGoalId` dual-lookup, or a "merge my priorities with the team's" helper) gets a
unit test the same way `standardMilestones`/`buildRosterRows` did. Server Actions
themselves don't get dedicated test files, matching the established convention.

## Known limitations (documented, not solved this sub-project)

- **No cross-engagement uniqueness enforcement**, same documented gap as Sprint 1 —
  out of scope here too.
- **`linkedGoalId` has no referential integrity** — deleting a goal doesn't clean up
  priorities that point at it (same as today's blob, where this was never enforced
  either). A future sprint can add a cleanup step if it becomes a real problem.
- **Placeholder pages have no styling and no nav entry** — deliberate, since the nav
  redesign sub-project decides what these should actually look like and where they
  live in the new simplified UI.
