# Sprint 2 — Timeline

Part of the [intern management software overhaul](2026-07-14-intern-management-overhaul-design.md),
building on [Sprint 0](2026-07-15-sprint-0-foundation-design.md) (Firebase Auth, roles,
the `users`/`engagements`/`invites` Firestore model) and
[Sprint 1](2026-07-15-sprint-1-manage-interns-design.md) (lead invite/remove/reactivate,
`UserDoc.status`). Each intern gets a horizontal timeline of milestones — 3 auto-seeded
plus lead-added custom ones — visible on their own `/intern` page and manageable from a
new per-intern view under `/lead`.

## Scope adjustments from the parent roadmap

The parent design doc's one-line description ("Lead or intern can add custom
milestones... can optionally link to another entity, e.g. a milestone that points at a
review") doesn't quite match what's buildable yet:

- **Lead-only, not lead-or-intern.** Interns see their own timeline read-only. Keeps
  interns as viewers this sprint, consistent with Sprint 1 where leads own
  roster/goal-assignment.
- **No `linkedEntity` field.** Reviews, Goals, and Tasks don't exist in the new
  per-engagement model yet — that migration is Sprint 3's job (see the parent doc's
  Sprint 3 description and CLAUDE.md's "Known shortcuts" section). Adding an optional
  link field now with nothing real to point at would be speculative schema. Sprint 3
  adds it once there's an actual entity to link to.
- **No auto-pull from completed goals/tasks yet.** Same reason — those entities don't
  exist in this model yet. Milestones this sprint are seeded once (at account creation)
  plus whatever the lead adds by hand; Sprint 3 is the natural place to add
  auto-generated timeline entries once Goals/Tasks are real here.

## Data model

New subcollection, `users/{uid}/timeline/{milestoneId}`:

```ts
export interface MilestoneDoc {
  title: string;
  date: number | null; // epoch ms; null = not yet dated ("TBD")
  status: "upcoming" | "complete";
  kind: "standard" | "custom";
  notes?: string;
  createdAt: number;
}
```

`status` is a plain manually-set toggle, not derived from `date` vs. today — matches
the existing convention in this codebase where `Objective.progress` and the per-intern
`workloads` capacity number are already manual fields with no formula behind them (see
CLAUDE.md). Keeping this consistent avoids a hybrid "derived-but-overridable" state
machine nobody asked for.

## Seeding

Three `kind: "standard"` milestones are created in `src/lib/auth/reconcile.ts`'s
`createFromInvite` branch, the same moment the `UserDoc` itself is created (i.e., first
sign-in via an invite link, not when the lead sends the invite — matches "when they're
added" in the roadmap literally, since a person isn't really "added" until they have an
account).

There's no internship start/end date anywhere in the current model (the parent design
doc's `engagements/{id}/interns/{internId}` subcollection with start/end dates was never
built — Sprint 1 kept interns as flat `UserDoc`s). Rather than invent an unconfirmed
default duration:

- **Kickoff** seeds with `date: createdAt` (today) and `status: "upcoming"`.
- **Mid-point check-in** and **Final review** seed with `date: null` ("TBD") and
  `status: "upcoming"` — the lead fills in real dates once they know the internship's
  actual length.

The seeding logic is a pure function, unit-tested the same way Sprint 1 tested
`buildRosterRows`:

```ts
// src/lib/auth/timeline-seed.ts
export function standardMilestones(createdAt: number): Omit<MilestoneDoc, "createdAt">[] {
  return [
    { title: "Kickoff", date: createdAt, status: "upcoming", kind: "standard" },
    { title: "Mid-point check-in", date: null, status: "upcoming", kind: "standard" },
    { title: "Final review", date: null, status: "upcoming", kind: "standard" },
  ];
}
```

## Access control and routes

- **`/intern`** (existing page) grows a read-only `Timeline` section for the signed-in
  user's own `uid`. No add/edit/delete controls.
- **`/lead/interns/[uid]`** (new page): a lead clicks a "Timeline" link added to each
  active roster row on `/lead`. Loads via `requireRole("engagementLead")`, then verifies
  the target `uid`'s `UserDoc` has `role === "intern"` and `engagementId` matching the
  calling lead's own — the exact same ownership check Sprint 1's `removeIntern` already
  uses, applied here to a read instead of a mutation. Shows the timeline with editable
  controls.
- **`src/app/lead/interns/[uid]/timeline-actions.ts`** (new): `addMilestone`,
  `updateMilestone`, `deleteMilestone`. Each calls `requireRole("engagementLead")`, then
  re-verifies the same ownership check before touching `users/{uid}/timeline`, mirroring
  `removeIntern`/`reactivateIntern`'s pattern exactly (never trust a `uid` from
  `formData` alone).

## Firestore rules

Add a `users/{uid}/timeline/{milestoneId}` match: an intern can read their own
timeline but not write it (matches this sprint's read-only-for-interns decision), while
an active lead/admin can both read and write any intern's timeline:

```
match /timeline/{milestoneId} {
  allow read: if request.auth != null &&
    (request.auth.uid == uid || isActiveCompanyAdmin() || isActiveEngagementLead());
  allow write: if request.auth != null &&
    (isActiveCompanyAdmin() || isActiveEngagementLead());
}
```

(nested under the existing `match /users/{uid}` block, reusing the helper functions
Sprint 1 already added.) This is defense-in-depth only, same as every other rule in this
file — real reads/writes go through the Server Actions above via the Admin SDK, which
bypasses rules entirely. Matches the existing rules' role-only granularity (no
per-engagement scoping inside the rule itself — that check lives in the Server Actions).

## UI: `Timeline` component

One client component (`src/components/timeline.tsx`), rendered with an `editable`
prop — `false` on `/intern`, `true` on `/lead/interns/[uid]`:

- **Shape**: a horizontal line with milestones alternating above/below as short
  offshoots, so labels never crowd regardless of how many milestones exist. Standard
  and custom milestones are visually distinguished by dot color; complete milestones
  are filled, upcoming ones hollow.
- **Interaction**: clicking a dot expands an inline card growing from that milestone's
  offshoot, showing title/date/status/notes. When `editable`, the expanded card also
  shows Edit and Delete controls, and a "+ Add milestone" control sits at the end of the
  line.
- This is the first genuinely-styled piece of the new auth-scoped app — Sprint 0/1's
  `/admin`, `/lead`, `/intern` pages are deliberately plain unstyled HTML, since nobody
  had a visual opinion about them yet. This sprint does, so it gets one. Plain inline
  styles plus inline SVG for the line/dots/offshoots — no new dependency (no
  charting/timeline library needed for a dozen dots on a line).

## Known limitations (documented, not solved this sprint)

- **Two of three seeded milestones start undated.** Kickoff gets a real date; mid-point
  and final review are "TBD" until the lead sets them, since there's no internship
  duration field anywhere yet to derive a default from.
- **No auto-pull from Goals/Tasks.** All milestones this sprint are either the 3 seeded
  ones or manually added by the lead — Sprint 3 is expected to add auto-generated
  entries once Goals/Tasks exist in this model.
- **No admin-facing view.** Company Admin doesn't get a timeline view in this sprint,
  matching Sprint 1's same "lead-only, not admin-facing" trim.
