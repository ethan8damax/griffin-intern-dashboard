# Sprint 2 Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every intern a horizontal timeline of milestones — 3 auto-seeded at
account creation plus lead-added custom ones — visible read-only on `/intern` and
manageable (add/edit/delete) from a new per-intern page under `/lead`.

**Architecture:** A new `users/{uid}/timeline/{milestoneId}` Firestore subcollection
holds `MilestoneDoc`s. Seeding is a pure function (`standardMilestones`, unit-tested
like Sprint 1's `buildRosterRows`) called from `completeSignIn`'s existing
`createFromInvite` branch — the one place a `UserDoc` actually gets written — right
after the user doc itself is created. A new `/lead/interns/[uid]` page reuses Sprint
1's ownership-check pattern (same engagement + `role === "intern"`) before showing or
mutating another person's timeline. One shared `Timeline` client component renders on
both `/intern` (read-only) and the new lead page (editable), passing Server Actions
down as props for the add/edit/delete forms.

**Tech Stack:** Next.js 16 App Router (Server Actions, Server Components, dynamic route
segments), Firebase Admin SDK (`getAdminDb()`, already built), Vitest, React 19 client
components.

See design doc: `docs/superpowers/specs/2026-07-16-sprint-2-timeline-design.md`

---

## File Structure

Modified files:
- `src/lib/auth/types.ts` — add `MilestoneDoc`
- `src/lib/auth/actions.ts` — seed the 3 standard milestones in `completeSignIn`
- `firestore.rules` — add a `users/{uid}/timeline/{milestoneId}` match
- `src/app/lead/page.tsx` — add a "Timeline" link to each active roster row
- `src/app/intern/page.tsx` — add a read-only `Timeline` section

New files:
- `src/lib/auth/timeline-seed.ts` + `timeline-seed.test.ts` — pure seeding logic (tested)
- `src/app/lead/interns/[uid]/timeline-actions.ts` — `addMilestone`, `updateMilestone`,
  `deleteMilestone` Server Actions
- `src/app/lead/interns/[uid]/page.tsx` — per-intern timeline management page
- `src/components/timeline.tsx` — shared `Timeline` client component

---

## Task 1: `MilestoneDoc` type + `standardMilestones` seeding logic (TDD)

**Files:**
- Modify: `src/lib/auth/types.ts`
- Create: `src/lib/auth/timeline-seed.ts`
- Create: `src/lib/auth/timeline-seed.test.ts`

- [ ] **Step 1: Add `MilestoneDoc` to `types.ts`**

In `src/lib/auth/types.ts`, add this interface (after `InviteDoc`):

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

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/auth/timeline-seed.test.ts
import { describe, expect, it } from "vitest";
import { standardMilestones } from "./timeline-seed";

describe("standardMilestones", () => {
  it("seeds kickoff dated today, mid-point and final review as TBD", () => {
    const milestones = standardMilestones(1000);

    expect(milestones).toEqual([
      { title: "Kickoff", date: 1000, status: "upcoming", kind: "standard", createdAt: 1000 },
      { title: "Mid-point check-in", date: null, status: "upcoming", kind: "standard", createdAt: 1000 },
      { title: "Final review", date: null, status: "upcoming", kind: "standard", createdAt: 1000 },
    ]);
  });

  it("always seeds exactly 3 milestones, all standard kind and upcoming status", () => {
    const milestones = standardMilestones(2000);

    expect(milestones).toHaveLength(3);
    for (const milestone of milestones) {
      expect(milestone.kind).toBe("standard");
      expect(milestone.status).toBe("upcoming");
    }
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `Cannot find module './timeline-seed'`, since the file doesn't exist yet

- [ ] **Step 4: Write the implementation**

```ts
// src/lib/auth/timeline-seed.ts
import type { MilestoneDoc } from "./types";

export function standardMilestones(createdAt: number): MilestoneDoc[] {
  return [
    { title: "Kickoff", date: createdAt, status: "upcoming", kind: "standard", createdAt },
    { title: "Mid-point check-in", date: null, status: "upcoming", kind: "standard", createdAt },
    { title: "Final review", date: null, status: "upcoming", kind: "standard", createdAt },
  ];
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test`
Expected: PASS — 2 new tests in `timeline-seed.test.ts`, all existing tests still pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/types.ts src/lib/auth/timeline-seed.ts src/lib/auth/timeline-seed.test.ts
git commit -m "Add MilestoneDoc type and standard-milestone seeding logic"
```

---

## Task 2: Seed the 3 standard milestones on intern account creation

**Files:**
- Modify: `src/lib/auth/actions.ts`

- [ ] **Step 1: Import `standardMilestones`**

In `src/lib/auth/actions.ts`, add to the existing imports:

```ts
import { standardMilestones } from "@/lib/auth/timeline-seed";
```

- [ ] **Step 2: Batch-write the seeded milestones when the new user is an intern**

In `completeSignIn`, the `result.kind === "createFromInvite"` branch currently ends with:

```ts
    if (result.user.role === "engagementLead" && result.user.engagementId) {
      await adminDb
        .collection("engagements")
        .doc(result.user.engagementId)
        .update({ leadUserId: uid });
    }
  } else if (result.kind === "createFromAdminAllowlist") {
```

Change it to:

```ts
    if (result.user.role === "engagementLead" && result.user.engagementId) {
      await adminDb
        .collection("engagements")
        .doc(result.user.engagementId)
        .update({ leadUserId: uid });
    }

    if (result.user.role === "intern") {
      const batch = adminDb.batch();
      for (const milestone of standardMilestones(result.user.createdAt)) {
        batch.set(userRef.collection("timeline").doc(), milestone);
      }
      await batch.commit();
    }
  } else if (result.kind === "createFromAdminAllowlist") {
```

- [ ] **Step 3: Run the full test suite, lint, typecheck, and build**

Run: `npm run test && npm run lint && npx tsc --noEmit && npm run build`
Expected: all pass, no errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/actions.ts
git commit -m "Seed standard timeline milestones when an intern account is created"
```

---

## Task 3: Firestore rules — `users/{uid}/timeline`

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add a nested `timeline` match inside the existing `users/{uid}` block**

In `firestore.rules`, change:

```
    match /users/{uid} {
      allow read: if request.auth != null &&
        (request.auth.uid == uid || isActiveCompanyAdmin());
      allow write: if false;
    }
```

to:

```
    match /users/{uid} {
      allow read: if request.auth != null &&
        (request.auth.uid == uid || isActiveCompanyAdmin());
      allow write: if false;

      match /timeline/{milestoneId} {
        allow read: if request.auth != null &&
          (request.auth.uid == uid || isActiveCompanyAdmin() || isActiveEngagementLead());
        allow write: if isActiveCompanyAdmin() || isActiveEngagementLead();
      }
    }
```

An intern can read their own timeline but never write it directly (matches this
sprint's read-only-for-interns decision); an active lead or admin can read and write any
intern's timeline. This is defense-in-depth only, same as every other rule in this file
— real reads/writes go through the Admin SDK via the Server Actions in Tasks 2 and 4,
which bypass rules entirely.

- [ ] **Step 2: Deploy the updated rules**

Try: `firebase deploy --only firestore:rules`
Expected: `✔ Deploy complete!`

If the Firebase CLI isn't set up locally, note that in your report and paste the rules
into Firebase Console → Firestore Database → Rules instead — this doesn't block the
rest of the plan, since nothing in this app writes to `timeline` from the client side.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "Add Firestore rules for the users/{uid}/timeline subcollection"
```

---

## Task 4: Lead timeline Server Actions — add, update, delete

**Files:**
- Create: `src/app/lead/interns/[uid]/timeline-actions.ts`

- [ ] **Step 1: Write the implementation**

```ts
// src/app/lead/interns/[uid]/timeline-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import type { MilestoneDoc, UserDoc } from "@/lib/auth/types";

async function assertOwnedIntern(
  uid: string,
  leadEngagementId: string
): Promise<void> {
  const userSnapshot = await getAdminDb().collection("users").doc(uid).get();
  if (!userSnapshot.exists) {
    throw new Error("Intern not found.");
  }
  const targetUser = userSnapshot.data() as UserDoc;
  if (targetUser.role !== "intern" || targetUser.engagementId !== leadEngagementId) {
    // Same message as the "doesn't exist" case above — don't let a lead
    // distinguish "wrong engagement" from "no such record" for a uid they
    // already hold, matching the collapsed-message convention in
    // src/app/lead/actions.ts.
    throw new Error("Intern not found.");
  }
}

function parseDateInput(dateInput: string): number | null {
  if (!dateInput) return null;
  const parsed = new Date(dateInput).getTime();
  if (Number.isNaN(parsed)) {
    throw new Error("Invalid date.");
  }
  return parsed;
}

export async function addMilestone(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const date = parseDateInput(String(formData.get("date") ?? "").trim());
  if (!uid || !title) {
    throw new Error("Missing intern id or title.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "");

  const milestone: MilestoneDoc = {
    title,
    date,
    status: "upcoming",
    kind: "custom",
    createdAt: Date.now(),
    notes: notes || undefined,
  };
  await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("timeline")
    .add(milestone);
  revalidatePath(`/lead/interns/${uid}`);
}

export async function updateMilestone(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const milestoneId = String(formData.get("milestoneId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const date = parseDateInput(String(formData.get("date") ?? "").trim());
  if (!uid || !milestoneId || !title) {
    throw new Error("Missing intern id, milestone id, or title.");
  }
  if (status !== "upcoming" && status !== "complete") {
    throw new Error("Invalid status.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "");

  await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("timeline")
    .doc(milestoneId)
    .update({ title, date, status, notes: notes || undefined });
  revalidatePath(`/lead/interns/${uid}`);
}

export async function deleteMilestone(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const milestoneId = String(formData.get("milestoneId") ?? "").trim();
  if (!uid || !milestoneId) {
    throw new Error("Missing intern id or milestone id.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "");

  await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("timeline")
    .doc(milestoneId)
    .delete();
  revalidatePath(`/lead/interns/${uid}`);
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/lead/interns/[uid]/timeline-actions.ts
git commit -m "Add lead timeline server actions: add, update, delete milestone"
```

---

## Task 5: `Timeline` shared component

**Files:**
- Create: `src/components/timeline.tsx`

- [ ] **Step 1: Write the implementation**

```tsx
// src/components/timeline.tsx
"use client";

import { useState } from "react";

export interface TimelineMilestone {
  id: string;
  title: string;
  date: number | null;
  status: "upcoming" | "complete";
  kind: "standard" | "custom";
  notes?: string;
}

interface TimelineProps {
  uid: string;
  milestones: TimelineMilestone[];
  editable: boolean;
  onAdd?: (formData: FormData) => void | Promise<void>;
  onUpdate?: (formData: FormData) => void | Promise<void>;
  onDelete?: (formData: FormData) => void | Promise<void>;
}

function formatDate(date: number | null): string {
  return date === null ? "TBD" : new Date(date).toLocaleDateString();
}

function dateInputValue(date: number | null): string {
  return date === null ? "" : new Date(date).toISOString().slice(0, 10);
}

function dotColor(milestone: TimelineMilestone): string {
  return milestone.kind === "standard" ? "#4a7" : "#c93";
}

export function Timeline({
  uid,
  milestones,
  editable,
  onAdd = async () => {},
  onUpdate = async () => {},
  onDelete = async () => {},
}: TimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const sorted = [...milestones].sort(
    (a, b) => (a.date ?? Infinity) - (b.date ?? Infinity)
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", overflowX: "auto", paddingBottom: 8 }}>
        {sorted.map((milestone, index) => {
          const above = index % 2 === 0;
          const isExpanded = expandedId === milestone.id;
          const color = dotColor(milestone);

          return (
            <div
              key={milestone.id}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 160, flexShrink: 0 }}
            >
              <div style={{ height: 32, display: "flex", alignItems: "flex-end", fontSize: 12, textAlign: "center" }}>
                {above ? milestone.title : ""}
              </div>
              <div style={{ height: 20, width: 1, background: above ? "#888" : "transparent" }} />
              <div style={{ width: "100%", height: 2, background: "#888", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : milestone.id)}
                  aria-label={`${milestone.title}, ${milestone.status}`}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    border: `2px solid ${color}`,
                    background: milestone.status === "complete" ? color : "transparent",
                    cursor: "pointer",
                    padding: 0,
                  }}
                />
              </div>
              <div style={{ height: 20, width: 1, background: above ? "transparent" : "#888" }} />
              <div style={{ height: 32, display: "flex", alignItems: "flex-start", fontSize: 12, textAlign: "center" }}>
                {above ? "" : milestone.title}
              </div>

              {isExpanded && (
                <div style={{ border: "1px solid #888", borderRadius: 8, padding: 12, marginTop: 8, width: 200, textAlign: "left" }}>
                  {editable ? (
                    <form action={onUpdate}>
                      <input type="hidden" name="uid" value={uid} />
                      <input type="hidden" name="milestoneId" value={milestone.id} />
                      <label>
                        Title
                        <input name="title" defaultValue={milestone.title} required />
                      </label>
                      <label>
                        Date
                        <input type="date" name="date" defaultValue={dateInputValue(milestone.date)} />
                      </label>
                      <label>
                        Status
                        <select name="status" defaultValue={milestone.status}>
                          <option value="upcoming">Upcoming</option>
                          <option value="complete">Complete</option>
                        </select>
                      </label>
                      <label>
                        Notes
                        <textarea name="notes" defaultValue={milestone.notes ?? ""} />
                      </label>
                      <button type="submit">Save</button>
                    </form>
                  ) : (
                    <>
                      <p>
                        {formatDate(milestone.date)} —{" "}
                        {milestone.status === "complete" ? "Complete" : "Upcoming"}
                      </p>
                      {milestone.notes && <p>{milestone.notes}</p>}
                    </>
                  )}
                  {editable && (
                    <form action={onDelete}>
                      <input type="hidden" name="uid" value={uid} />
                      <input type="hidden" name="milestoneId" value={milestone.id} />
                      <button type="submit">Delete</button>
                    </form>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editable && (
        <div style={{ marginTop: 16 }}>
          {adding ? (
            <form
              action={async (formData: FormData) => {
                await onAdd(formData);
                setAdding(false);
              }}
            >
              <input type="hidden" name="uid" value={uid} />
              <label>
                Title
                <input name="title" required />
              </label>
              <label>
                Date
                <input type="date" name="date" />
              </label>
              <label>
                Notes
                <textarea name="notes" />
              </label>
              <button type="submit">Add</button>
              <button type="button" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setAdding(true)}>
              + Add milestone
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/timeline.tsx
git commit -m "Add shared Timeline component"
```

---

## Task 6: `/lead/interns/[uid]` page

**Files:**
- Create: `src/app/lead/interns/[uid]/page.tsx`

- [ ] **Step 1: Write the implementation**

```tsx
// src/app/lead/interns/[uid]/page.tsx
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { addMilestone, updateMilestone, deleteMilestone } from "./timeline-actions";
import { Timeline } from "@/components/timeline";
import type { MilestoneDoc, UserDoc } from "@/lib/auth/types";

export default async function InternTimelinePage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const lead = await requireRole("engagementLead");

  const userSnapshot = await getAdminDb().collection("users").doc(uid).get();
  if (!userSnapshot.exists) {
    notFound();
  }
  const targetUser = userSnapshot.data() as UserDoc;
  if (targetUser.role !== "intern" || targetUser.engagementId !== lead.engagementId) {
    // Same "not found" outcome as a missing doc — don't let a lead distinguish
    // "wrong engagement" from "no such record" for a uid they already hold.
    notFound();
  }

  const timelineSnapshot = await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("timeline")
    .get();
  const milestones = timelineSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as MilestoneDoc),
  }));

  return (
    <main>
      <p>
        <a href="/lead">← Back to roster</a>
      </p>
      <h1>{targetUser.name}&apos;s timeline</h1>
      <Timeline
        uid={uid}
        milestones={milestones}
        editable
        onAdd={addMilestone}
        onUpdate={updateMilestone}
        onDelete={deleteMilestone}
      />
    </main>
  );
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds, `/lead/interns/[uid]` listed as a dynamic route

- [ ] **Step 3: Commit**

```bash
git add src/app/lead/interns/[uid]/page.tsx
git commit -m "Add per-intern timeline management page under /lead"
```

---

## Task 7: Link to the timeline from the `/lead` roster

**Files:**
- Modify: `src/app/lead/page.tsx`

- [ ] **Step 1: Add a "Timeline" link to each active roster row**

In `src/app/lead/page.tsx`, change:

```tsx
            {row.state === "active" && (
              <form action={removeIntern}>
                <input type="hidden" name="uid" value={row.uid} />
                <button type="submit">Remove</button>
              </form>
            )}
```

to:

```tsx
            {row.state === "active" && (
              <>
                <a href={`/lead/interns/${row.uid}`}>Timeline</a>
                <form action={removeIntern}>
                  <input type="hidden" name="uid" value={row.uid} />
                  <button type="submit">Remove</button>
                </form>
              </>
            )}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/lead/page.tsx
git commit -m "Link each active roster row to its intern's timeline page"
```

---

## Task 8: Read-only timeline on `/intern`

**Files:**
- Modify: `src/app/intern/page.tsx`

- [ ] **Step 1: Replace the placeholder page**

Replace the full contents of `src/app/intern/page.tsx` with:

```tsx
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { signOutAction } from "@/lib/auth/actions";
import { Timeline } from "@/components/timeline";
import type { MilestoneDoc } from "@/lib/auth/types";

export default async function InternPage() {
  const user = await requireRole("intern");

  const timelineSnapshot = await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("timeline")
    .get();
  const milestones = timelineSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as MilestoneDoc),
  }));

  return (
    <main>
      <p>Signed in as {user.email} (Intern)</p>
      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>

      <h2>Your timeline</h2>
      <Timeline uid={user.uid} milestones={milestones} editable={false} />
    </main>
  );
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/intern/page.tsx
git commit -m "Show a read-only timeline on the intern page"
```

---

## Task 9: Full verification pass

**Files:** none (verification only)

**Note:** the timeline reads in Tasks 6 and 8 are plain unfiltered
`.collection("timeline").get()` calls (no `where`/compound query), so unlike Sprint 1's
roster queries, no Firestore composite index should be needed here.

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: PASS — includes the 2 new tests from Task 1, all prior tests (reconcile,
roster) still passing

- [ ] **Step 2: Run the linter and typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run a production build**

Run: `npm run build`
Expected: build succeeds, `/lead/interns/[uid]` listed as a dynamic route alongside
`/lead`, `/intern`, `/admin`

- [ ] **Step 4: Manual smoke test (requires a real engagement with a signed-in lead)**

Using an account already onboarded as an `engagementLead`:

1. Invite a new intern and open the invite link in a private/incognito window to sign
   in as them for the first time — confirm this creates the account (Sprint 1 flow).
2. Sign in as the intern, land on `/intern` — confirm a timeline renders with 3
   milestones: **Kickoff** (dated today, upcoming), **Mid-point check-in** (TBD,
   upcoming), **Final review** (TBD, upcoming). Click a dot — confirm it expands
   in-place showing date/status/notes, with no edit controls.
3. Back as the lead on `/lead`, click **Timeline** on that intern's roster row — confirm
   it lands on `/lead/interns/{uid}` showing the same 3 milestones, this time with edit
   controls when a dot is expanded (title/date/status/notes fields + Save + Delete).
4. Edit the **Mid-point check-in** milestone: set a real date, leave status
   "Upcoming", save — confirm the page shows the updated date instead of "TBD".
5. Click **+ Add milestone**, add a custom one (e.g. "Client demo"), give it a date and
   notes — confirm it appears on the line in its sorted position by date, in the
   custom-kind color, distinct from the 3 standard milestones.
6. Mark the custom milestone's status "Complete" via its edit form — confirm its dot
   renders filled instead of hollow.
7. Delete the custom milestone — confirm it disappears from the line.
8. Refresh `/intern` as the signed-in intern — confirm the mid-point date change and any
   remaining milestones are visible there too (read-only).
9. As the lead, try navigating directly to a `/lead/interns/{uid}` URL for a `uid`
   belonging to a *different* engagement (or a non-intern user) — confirm it 404s
   rather than showing that person's timeline.

- [ ] **Step 5: Final commit if any fixups were needed during manual testing**

```bash
git add -A
git commit -m "Fix issues found during Sprint 2 manual verification"
```

(Skip this step if no fixes were needed.)

---

## Self-Review Notes

- **Spec coverage:** `MilestoneDoc` + subcollection ✓ (Task 1), seeding at account
  creation with kickoff dated / mid-point+final TBD ✓ (Task 1–2), Firestore rules ✓
  (Task 3), lead-only add/update/delete with same-engagement + role ownership checks ✓
  (Task 4), alternating-offshoot horizontal line with inline-card expand-on-click,
  editable prop ✓ (Task 5), `/lead/interns/[uid]` page reusing the collapsed
  not-found/wrong-engagement message convention ✓ (Task 6), roster link ✓ (Task 7),
  read-only `/intern` section ✓ (Task 8). No `linkedEntity` field, no auto-pull from
  goals/tasks, no admin-facing view ✓ (none of these appear anywhere in the plan,
  matching the design doc's explicit scope trims).
- **Type consistency checked:** `MilestoneDoc` (Task 1) fields are read/written
  identically in `actions.ts` (Task 2), `timeline-actions.ts` (Task 4),
  `timeline.tsx`'s `TimelineMilestone` (Task 5, a superset adding `id`), and both page
  components (Tasks 6, 8). `assertOwnedIntern` (Task 4) and the inline ownership check
  in Task 6's page component use the same two conditions (`role !== "intern"`,
  `engagementId` mismatch) in the same order, mirroring Sprint 1's
  `assertSameEngagement` + role-check pattern. `Timeline`'s prop names (`onAdd`,
  `onUpdate`, `onDelete`, `editable`, `uid`, `milestones`) are used identically at both
  call sites (Tasks 6 and 8).
