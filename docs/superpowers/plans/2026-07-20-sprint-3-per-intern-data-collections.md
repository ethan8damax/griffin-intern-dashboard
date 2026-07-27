# Sprint 3.1a — Per-Intern Data Collections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Goals, Journal, Priorities, Projects, and Profile a home in the new
per-engagement Firestore model (`users/{uid}/...`), each with Server Actions matching
the access-control table in the design doc and a bare-bones placeholder page on
`/intern` (self-service) and `/lead/interns/[uid]` (lead management) — no styling, no
top-nav integration.

**Architecture:** Five new subcollections under `users/{uid}`, following the exact
pattern Sprint 2 established for `users/{uid}/timeline`: typed docs in
`src/lib/auth/types.ts`, Server Actions using `requireRole()` + an ownership check,
Firestore rules as a defense-in-depth backstop (real access control lives in the
Server Actions), and unstyled placeholder pages. The lead-side ownership check
(`assertOwnedIntern`) that Sprint 2 wrote inline gets extracted into a shared,
unit-tested helper (`src/lib/auth/ownership.ts`) since this plan needs it in five more
places — Sprint 2's `timeline-actions.ts` is refactored to use it too, so there's one
copy instead of six. A second shared helper, `resolveLinkedGoal`
(`src/lib/goals.ts`), resolves `PriorityDoc.linkedGoalId` against the intern's own
goals — the team-goals branch of that lookup is wired up as a no-op now and becomes
real in Sprint 3.1b (engagement-scoped collections), which is out of scope here per
the parent design doc.

**Tech Stack:** Next.js 16 App Router (Server Actions, Server Components, dynamic
route segments), Firebase Admin SDK (`getAdminDb()`), Vitest, React 19.

**Out of scope (deferred to Sprint 3.1b, a separate plan):** `engagements/{id}/goals`
(team goals), `engagements/{id}/priorities` (team priorities),
`engagements/{id}/reflections`, `engagements/{id}/reviews`. The
`PriorityDoc.linkedGoalId` team-goal resolution branch will start finding real data
once that plan ships; until then it only resolves individual goals.

See design doc: `docs/superpowers/specs/2026-07-17-sprint-3-data-migration-design.md`

---

## File Structure

New shared files:
- `src/lib/auth/ownership.ts` + `ownership.test.ts` — `isOwnedIntern` (pure predicate,
  tested) and `assertOwnedIntern` (fetch + throw wrapper, reused by every lead-side
  actions file below and by Sprint 2's `timeline-actions.ts`)
- `src/lib/goals.ts` + `goals.test.ts` — `resolveLinkedGoal` dual-lookup (pure
  decision logic over injected fetchers, tested)

Modified:
- `src/lib/auth/types.ts` — add `GoalDoc`, `JournalEntryDoc`, `PriorityDoc`,
  `ProjectDoc`, `ProfileDoc`
- `firestore.rules` — add `users/{uid}/{goals,journal,priorities,projects,profile}`
  matches
- `src/app/lead/interns/[uid]/timeline-actions.ts` — use the shared
  `assertOwnedIntern` instead of its local copy
- `src/app/lead/interns/[uid]/page.tsx` — add links to the five new per-intern pages
- `src/app/intern/page.tsx` — add links to the five new intern-facing pages

New per-collection files:
- `src/app/lead/interns/[uid]/goals-actions.ts`, `.../goals/page.tsx`
- `src/app/intern/goals-actions.ts`, `src/app/intern/goals/page.tsx`
- `src/app/intern/journal-actions.ts`, `src/app/intern/journal/page.tsx`
- `src/app/lead/interns/[uid]/journal/page.tsx` (read-only, no actions file — lead
  has no write access to journal per the access table)
- `src/app/intern/priorities-actions.ts`, `src/app/intern/priorities/page.tsx`
- `src/app/lead/interns/[uid]/priorities-actions.ts`, `.../priorities/page.tsx`
- `src/app/intern/projects-actions.ts`, `src/app/intern/projects/page.tsx`
- `src/app/lead/interns/[uid]/projects-actions.ts`, `.../projects/page.tsx`
- `src/app/intern/profile-actions.ts`, `src/app/intern/profile/page.tsx`
- `src/app/lead/interns/[uid]/profile-actions.ts`, `.../profile/page.tsx`

**Structural note on Profile:** the design doc calls out `users/{uid}/profile` as "a
single doc, not a collection" — but Firestore paths must alternate collection/document
segments, so a document can't sit directly under another document. This plan stores it
as `users/{uid}/profile/data`: a `profile` subcollection holding exactly one document
with the fixed id `"data"`. This is the same structural resolution Firestore forces on
any single-doc-per-parent case; it isn't a scope decision, just how the literal path in
the design doc has to be realized.

---

## Task 1: Shared ownership helper (extract from Sprint 2, TDD)

**Files:**
- Create: `src/lib/auth/ownership.ts`
- Create: `src/lib/auth/ownership.test.ts`
- Modify: `src/app/lead/interns/[uid]/timeline-actions.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/auth/ownership.test.ts
import { describe, expect, it } from "vitest";
import { isOwnedIntern } from "./ownership";
import type { UserDoc } from "./types";

function makeUser(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    email: "intern@example.com",
    name: "Test Intern",
    role: "intern",
    engagementId: "eng-1",
    createdAt: 0,
    status: "active",
    ...overrides,
  };
}

describe("isOwnedIntern", () => {
  it("returns true for an intern in the lead's own engagement", () => {
    expect(isOwnedIntern(makeUser(), "eng-1")).toBe(true);
  });

  it("returns false for a user in a different engagement", () => {
    expect(isOwnedIntern(makeUser({ engagementId: "eng-2" }), "eng-1")).toBe(false);
  });

  it("returns false for a non-intern role, even in the same engagement", () => {
    expect(isOwnedIntern(makeUser({ role: "engagementLead" }), "eng-1")).toBe(false);
  });

  it("returns false when the lead has no engagement assigned", () => {
    expect(isOwnedIntern(makeUser(), "")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `Cannot find module './ownership'`, since the file doesn't exist yet

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/auth/ownership.ts
import { getAdminDb } from "@/lib/firebase-admin";
import type { UserDoc } from "./types";

export function isOwnedIntern(
  targetUser: UserDoc,
  leadEngagementId: string
): boolean {
  return (
    targetUser.role === "intern" &&
    leadEngagementId !== "" &&
    targetUser.engagementId === leadEngagementId
  );
}

export async function assertOwnedIntern(
  uid: string,
  leadEngagementId: string,
  notFoundMessage: string
): Promise<UserDoc> {
  const userSnapshot = await getAdminDb().collection("users").doc(uid).get();
  if (!userSnapshot.exists) {
    throw new Error(notFoundMessage);
  }
  const targetUser = userSnapshot.data() as UserDoc;
  if (!isOwnedIntern(targetUser, leadEngagementId)) {
    // Same message as the "doesn't exist" case above — don't let a lead
    // distinguish "wrong engagement" from "no such record" for a uid they
    // already hold, matching the collapsed-message convention in
    // src/app/lead/actions.ts.
    throw new Error(notFoundMessage);
  }
  return targetUser;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test`
Expected: PASS — 4 new tests in `ownership.test.ts`, all existing tests still pass

- [ ] **Step 5: Refactor Sprint 2's `timeline-actions.ts` to use the shared helper**

In `src/app/lead/interns/[uid]/timeline-actions.ts`, delete the local
`assertOwnedIntern` function entirely (it duplicates what Step 3 just added) and
replace the import block + calls:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { assertOwnedIntern } from "@/lib/auth/ownership";
import type { MilestoneDoc } from "@/lib/auth/types";

function parseDateInput(dateInput: string): number | null {
  if (!dateInput) return null;
  const parsed = new Date(dateInput).getTime();
  if (Number.isNaN(parsed)) {
    throw new Error("Invalid date.");
  }
  return parsed;
}
```

Every call site in that file currently reads
`await assertOwnedIntern(uid, lead.engagementId ?? "");` (two arguments) — update each
to pass the message too, matching the new shared signature:
`await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");`. There
are three call sites: `addMilestone`, `updateMilestone`, `deleteMilestone`.

- [ ] **Step 6: Verify the app still builds and existing tests pass**

Run: `npm run test && npm run build`
Expected: all pass, no errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/ownership.ts src/lib/auth/ownership.test.ts src/app/lead/interns/\[uid\]/timeline-actions.ts
git commit -m "Extract shared assertOwnedIntern helper, reuse in timeline actions"
```

---

## Task 2: Add the five new Firestore types

**Files:**
- Modify: `src/lib/auth/types.ts`

- [ ] **Step 1: Add all five interfaces after `MilestoneDoc`**

```ts
export interface GoalDoc {
  objective: string;
  status: "green" | "yellow" | "red" | "gray";
  targetDate: string; // "YYYY-MM-DD"
  progress: number; // 0-100, manually set — no formula, same as today
  krs: { id: string; text: string }[];
  createdAt: number;
}

export interface JournalEntryDoc {
  date: string; // "YYYY-MM-DD"
  type: "win" | "blocker" | "checkin" | "note";
  text: string;
  createdAt: number;
}

export interface PriorityDoc {
  text: string;
  weekOf: string; // "YYYY-MM-DD", Monday of the week
  status: "Done" | "In Progress" | "Not Started" | "Blocked";
  linkedGoalId: string | null;
  createdAt: number;
}

export interface ProjectDoc {
  name: string;
  assignedBy: string;
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

export interface ProfileDoc {
  role: string;
  manager: string;
  department: string;
  startDate: string;
  bio: string;
  capacity: number; // 0-100, "Current Capacity" — lead-set, no formula
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/types.ts
git commit -m "Add GoalDoc, JournalEntryDoc, PriorityDoc, ProjectDoc, ProfileDoc types"
```

---

## Task 3: `resolveLinkedGoal` helper (TDD)

**Files:**
- Create: `src/lib/goals.ts`
- Create: `src/lib/goals.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/goals.test.ts
import { describe, expect, it } from "vitest";
import { resolveLinkedGoal } from "./goals";

describe("resolveLinkedGoal", () => {
  it("returns null when linkedGoalId is null", async () => {
    const result = await resolveLinkedGoal(
      null,
      async () => ({ objective: "unused" }),
      async () => ({ objective: "unused" })
    );
    expect(result).toBeNull();
  });

  it("resolves an individual goal when the individual fetcher finds one", async () => {
    const result = await resolveLinkedGoal(
      "goal-1",
      async () => ({ objective: "Ship the migration" }),
      async () => null
    );
    expect(result).toEqual({ objective: "Ship the migration", scope: "individual" });
  });

  it("falls back to the team fetcher when no individual goal is found", async () => {
    const result = await resolveLinkedGoal(
      "goal-2",
      async () => null,
      async () => ({ objective: "Team-wide onboarding" })
    );
    expect(result).toEqual({ objective: "Team-wide onboarding", scope: "team" });
  });

  it("returns null when neither fetcher finds the goal", async () => {
    const result = await resolveLinkedGoal(
      "goal-missing",
      async () => null,
      async () => null
    );
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `Cannot find module './goals'`, since the file doesn't exist yet

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/goals.ts
export interface ResolvedGoal {
  objective: string;
  scope: "individual" | "team";
}

export async function resolveLinkedGoal(
  linkedGoalId: string | null,
  fetchIndividualGoal: (id: string) => Promise<{ objective: string } | null>,
  fetchTeamGoal: (id: string) => Promise<{ objective: string } | null>
): Promise<ResolvedGoal | null> {
  if (!linkedGoalId) return null;

  const individual = await fetchIndividualGoal(linkedGoalId);
  if (individual) {
    return { objective: individual.objective, scope: "individual" };
  }

  const team = await fetchTeamGoal(linkedGoalId);
  if (team) {
    return { objective: team.objective, scope: "team" };
  }

  return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test`
Expected: PASS — 4 new tests in `goals.test.ts`, all existing tests still pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/goals.ts src/lib/goals.test.ts
git commit -m "Add resolveLinkedGoal dual-lookup helper"
```

---

## Task 4: Firestore rules for the five new subcollections

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add nested matches inside the existing `users/{uid}` block**

In `firestore.rules`, change:

```
      match /timeline/{milestoneId} {
        allow read: if request.auth != null &&
          (request.auth.uid == uid || isActiveCompanyAdmin() || isActiveEngagementLead());
        allow write: if isActiveCompanyAdmin() || isActiveEngagementLead();
      }
    }
```

to:

```
      match /timeline/{milestoneId} {
        allow read: if request.auth != null &&
          (request.auth.uid == uid || isActiveCompanyAdmin() || isActiveEngagementLead());
        allow write: if isActiveCompanyAdmin() || isActiveEngagementLead();
      }

      match /goals/{goalId} {
        allow read: if request.auth != null &&
          (request.auth.uid == uid || isActiveCompanyAdmin() || isActiveEngagementLead());
        allow write: if isActiveCompanyAdmin() || isActiveEngagementLead() ||
          (request.auth != null && request.auth.uid == uid);
      }

      match /journal/{entryId} {
        allow read: if request.auth != null &&
          (request.auth.uid == uid || isActiveCompanyAdmin() || isActiveEngagementLead());
        allow write: if request.auth != null && request.auth.uid == uid;
      }

      match /priorities/{priorityId} {
        allow read: if request.auth != null &&
          (request.auth.uid == uid || isActiveCompanyAdmin() || isActiveEngagementLead());
        allow write: if isActiveCompanyAdmin() || isActiveEngagementLead() ||
          (request.auth != null && request.auth.uid == uid);
      }

      match /projects/{projectId} {
        allow read: if request.auth != null &&
          (request.auth.uid == uid || isActiveCompanyAdmin() || isActiveEngagementLead());
        allow write: if isActiveCompanyAdmin() || isActiveEngagementLead() ||
          (request.auth != null && request.auth.uid == uid);
      }

      match /profile/{docId} {
        allow read: if request.auth != null &&
          (request.auth.uid == uid || isActiveCompanyAdmin() || isActiveEngagementLead());
        allow write: if isActiveCompanyAdmin() || isActiveEngagementLead() ||
          (request.auth != null && request.auth.uid == uid);
      }
    }
```

Like every other rule in this file, these are coarse read/write booleans, not
field-level restrictions (e.g. "intern can only touch `status`/`progress` on
`goals`, not `objective`") — that narrower enforcement lives in the Server Actions in
Tasks 5-9, matching how Sprint 2's `timeline` rules don't field-restrict lead writes
either. This is defense-in-depth only; real reads/writes go through the Admin SDK via
Server Actions, bypassing rules entirely.

- [x] **Step 2: Deploy the updated rules**

Try: `firebase deploy --only firestore:rules`
Expected: `✔ Deploy complete!`

If the Firebase CLI isn't set up locally, note that in your report and paste the rules
into Firebase Console → Firestore Database → Rules instead — this doesn't block the
rest of the plan, since nothing in this app writes to these collections from the
client side.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "Add Firestore rules for goals, journal, priorities, projects, profile subcollections"
```

---

## Task 5: Goals — Server Actions + pages

**Files:**
- Create: `src/app/lead/interns/[uid]/goals-actions.ts`
- Create: `src/app/lead/interns/[uid]/goals/page.tsx`
- Create: `src/app/intern/goals-actions.ts`
- Create: `src/app/intern/goals/page.tsx`
- Modify: `src/app/lead/interns/[uid]/page.tsx`
- Modify: `src/app/intern/page.tsx`

- [ ] **Step 1: Write the lead Server Actions (full CRUD)**

```ts
// src/app/lead/interns/[uid]/goals-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { assertOwnedIntern } from "@/lib/auth/ownership";
import type { GoalDoc } from "@/lib/auth/types";

const VALID_STATUSES = ["green", "yellow", "red", "gray"];

function parseKrs(raw: string): { id: string; text: string }[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, index) => ({ id: String(index), text }));
}

function parseProgress(raw: string): number {
  const progress = Number(raw);
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
    throw new Error("Progress must be a number between 0 and 100.");
  }
  return progress;
}

export async function addGoal(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim();
  const targetDate = String(formData.get("targetDate") ?? "").trim();
  const krs = parseKrs(String(formData.get("krs") ?? ""));
  if (!uid || !objective) {
    throw new Error("Missing intern id or objective.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  const goal: GoalDoc = {
    objective,
    status: "gray",
    targetDate,
    progress: 0,
    krs,
    createdAt: Date.now(),
  };
  await getAdminDb().collection("users").doc(uid).collection("goals").add(goal);
  revalidatePath(`/lead/interns/${uid}/goals`);
}

export async function updateGoal(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const goalId = String(formData.get("goalId") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const targetDate = String(formData.get("targetDate") ?? "").trim();
  const progress = parseProgress(String(formData.get("progress") ?? "0"));
  const krs = parseKrs(String(formData.get("krs") ?? ""));
  if (!uid || !goalId || !objective) {
    throw new Error("Missing intern id, goal id, or objective.");
  }
  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Invalid status.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("goals")
    .doc(goalId)
    .update({ objective, status, targetDate, progress, krs });
  revalidatePath(`/lead/interns/${uid}/goals`);
}

export async function deleteGoal(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const goalId = String(formData.get("goalId") ?? "").trim();
  if (!uid || !goalId) {
    throw new Error("Missing intern id or goal id.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  await getAdminDb().collection("users").doc(uid).collection("goals").doc(goalId).delete();
  revalidatePath(`/lead/interns/${uid}/goals`);
}
```

- [ ] **Step 2: Write the intern Server Action (status + progress only)**

```ts
// src/app/intern/goals-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";

const VALID_STATUSES = ["green", "yellow", "red", "gray"];

export async function updateGoalStatus(formData: FormData): Promise<void> {
  const user = await requireRole("intern");
  const goalId = String(formData.get("goalId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const progress = Number(formData.get("progress") ?? 0);
  if (!goalId) {
    throw new Error("Missing goal id.");
  }
  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Invalid status.");
  }
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
    throw new Error("Progress must be a number between 0 and 100.");
  }

  await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("goals")
    .doc(goalId)
    .update({ status, progress });
  revalidatePath("/intern/goals");
}
```

- [ ] **Step 3: Write the lead page**

```tsx
// src/app/lead/interns/[uid]/goals/page.tsx
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { isOwnedIntern } from "@/lib/auth/ownership";
import { addGoal, updateGoal, deleteGoal } from "../goals-actions";
import type { GoalDoc, UserDoc } from "@/lib/auth/types";

export default async function InternGoalsPage({
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
  if (!isOwnedIntern(targetUser, lead.engagementId ?? "")) {
    notFound();
  }

  const goalsSnapshot = await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("goals")
    .get();
  const goals = goalsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as GoalDoc),
  }));

  return (
    <main>
      <p>
        <a href={`/lead/interns/${uid}`}>← Back to {targetUser.name}&apos;s timeline</a>
      </p>
      <h1>{targetUser.name}&apos;s goals</h1>
      <ul>
        {goals.map((goal) => (
          <li key={goal.id}>
            <form action={updateGoal}>
              <input type="hidden" name="uid" value={uid} />
              <input type="hidden" name="goalId" value={goal.id} />
              <label>
                Objective
                <input name="objective" defaultValue={goal.objective} required />
              </label>
              <label>
                Status
                <select name="status" defaultValue={goal.status}>
                  <option value="gray">Gray</option>
                  <option value="green">Green</option>
                  <option value="yellow">Yellow</option>
                  <option value="red">Red</option>
                </select>
              </label>
              <label>
                Target date
                <input name="targetDate" defaultValue={goal.targetDate} />
              </label>
              <label>
                Progress
                <input
                  type="number"
                  name="progress"
                  min={0}
                  max={100}
                  defaultValue={goal.progress}
                />
              </label>
              <label>
                Key results (one per line)
                <textarea
                  name="krs"
                  defaultValue={goal.krs.map((kr) => kr.text).join("\n")}
                />
              </label>
              <button type="submit">Save</button>
            </form>
            <form action={deleteGoal}>
              <input type="hidden" name="uid" value={uid} />
              <input type="hidden" name="goalId" value={goal.id} />
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>

      <h2>Add a goal</h2>
      <form action={addGoal}>
        <input type="hidden" name="uid" value={uid} />
        <label>
          Objective
          <input name="objective" required />
        </label>
        <label>
          Target date
          <input name="targetDate" />
        </label>
        <label>
          Key results (one per line)
          <textarea name="krs" />
        </label>
        <button type="submit">Add</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Write the intern page**

```tsx
// src/app/intern/goals/page.tsx
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { updateGoalStatus } from "../goals-actions";
import type { GoalDoc } from "@/lib/auth/types";

export default async function InternGoalsPage() {
  const user = await requireRole("intern");

  const goalsSnapshot = await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("goals")
    .get();
  const goals = goalsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as GoalDoc),
  }));

  return (
    <main>
      <p>
        <a href="/intern">← Back</a>
      </p>
      <h1>Your goals</h1>
      <ul>
        {goals.map((goal) => (
          <li key={goal.id}>
            <p>{goal.objective}</p>
            <p>Target: {goal.targetDate || "TBD"}</p>
            <ul>
              {goal.krs.map((kr) => (
                <li key={kr.id}>{kr.text}</li>
              ))}
            </ul>
            <form action={updateGoalStatus}>
              <input type="hidden" name="goalId" value={goal.id} />
              <label>
                Status
                <select name="status" defaultValue={goal.status}>
                  <option value="gray">Gray</option>
                  <option value="green">Green</option>
                  <option value="yellow">Yellow</option>
                  <option value="red">Red</option>
                </select>
              </label>
              <label>
                Progress
                <input
                  type="number"
                  name="progress"
                  min={0}
                  max={100}
                  defaultValue={goal.progress}
                />
              </label>
              <button type="submit">Save</button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 5: Link the new pages from the existing bare pages**

In `src/app/lead/interns/[uid]/page.tsx`, add a link under the back-link paragraph:

```tsx
      <p>
        <a href="/lead">← Back to roster</a>
      </p>
      <p>
        <a href={`/lead/interns/${uid}/goals`}>Goals</a>
      </p>
```

In `src/app/intern/page.tsx`, add a link before the timeline heading:

```tsx
      <p>
        <a href="/intern/goals">Goals</a>
      </p>

      <h2>Your timeline</h2>
```

- [ ] **Step 6: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds, `/lead/interns/[uid]/goals` and `/intern/goals` listed as
routes

- [ ] **Step 7: Commit**

```bash
git add src/app/lead/interns/\[uid\]/goals-actions.ts src/app/lead/interns/\[uid\]/goals/page.tsx src/app/intern/goals-actions.ts src/app/intern/goals/page.tsx src/app/lead/interns/\[uid\]/page.tsx src/app/intern/page.tsx
git commit -m "Add per-intern goals: Server Actions and placeholder pages"
```

---

## Task 6: Journal — Server Actions + pages

**Files:**
- Create: `src/app/intern/journal-actions.ts`
- Create: `src/app/intern/journal/page.tsx`
- Create: `src/app/lead/interns/[uid]/journal/page.tsx`
- Modify: `src/app/lead/interns/[uid]/page.tsx`
- Modify: `src/app/intern/page.tsx`

- [ ] **Step 1: Write the intern Server Actions (full CRUD of own journal)**

```ts
// src/app/intern/journal-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import type { JournalEntryDoc } from "@/lib/auth/types";

const VALID_TYPES = ["win", "blocker", "checkin", "note"];

export async function addJournalEntry(formData: FormData): Promise<void> {
  const user = await requireRole("intern");
  const date = String(formData.get("date") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  if (!date || !text) {
    throw new Error("Missing date or entry text.");
  }
  if (!VALID_TYPES.includes(type)) {
    throw new Error("Invalid entry type.");
  }

  const entry: JournalEntryDoc = { date, type: type as JournalEntryDoc["type"], text, createdAt: Date.now() };
  await getAdminDb().collection("users").doc(user.uid).collection("journal").add(entry);
  revalidatePath("/intern/journal");
}

export async function deleteJournalEntry(formData: FormData): Promise<void> {
  const user = await requireRole("intern");
  const entryId = String(formData.get("entryId") ?? "").trim();
  if (!entryId) {
    throw new Error("Missing entry id.");
  }

  await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("journal")
    .doc(entryId)
    .delete();
  revalidatePath("/intern/journal");
}
```

- [ ] **Step 2: Write the intern page**

```tsx
// src/app/intern/journal/page.tsx
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { addJournalEntry, deleteJournalEntry } from "../journal-actions";
import type { JournalEntryDoc } from "@/lib/auth/types";

export default async function InternJournalPage() {
  const user = await requireRole("intern");

  const entriesSnapshot = await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("journal")
    .get();
  const entries = entriesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as JournalEntryDoc),
  }));

  return (
    <main>
      <p>
        <a href="/intern">← Back</a>
      </p>
      <h1>Your journal</h1>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>
            {entry.date} [{entry.type}] {entry.text}
            <form action={deleteJournalEntry}>
              <input type="hidden" name="entryId" value={entry.id} />
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>

      <h2>Add an entry</h2>
      <form action={addJournalEntry}>
        <label>
          Date
          <input type="date" name="date" required />
        </label>
        <label>
          Type
          <select name="type" defaultValue="note">
            <option value="win">Win</option>
            <option value="blocker">Blocker</option>
            <option value="checkin">Check-in</option>
            <option value="note">Note</option>
          </select>
        </label>
        <label>
          Text
          <textarea name="text" required />
        </label>
        <button type="submit">Add</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Write the lead read-only page**

```tsx
// src/app/lead/interns/[uid]/journal/page.tsx
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { isOwnedIntern } from "@/lib/auth/ownership";
import type { JournalEntryDoc, UserDoc } from "@/lib/auth/types";

export default async function InternJournalPage({
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
  if (!isOwnedIntern(targetUser, lead.engagementId ?? "")) {
    notFound();
  }

  const entriesSnapshot = await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("journal")
    .get();
  const entries = entriesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as JournalEntryDoc),
  }));

  return (
    <main>
      <p>
        <a href={`/lead/interns/${uid}`}>← Back to {targetUser.name}&apos;s timeline</a>
      </p>
      <h1>{targetUser.name}&apos;s journal</h1>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>
            {entry.date} [{entry.type}] {entry.text}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 4: Link the new pages**

In `src/app/lead/interns/[uid]/page.tsx`, add next to the Goals link:

```tsx
      <p>
        <a href={`/lead/interns/${uid}/journal`}>Journal</a>
      </p>
```

In `src/app/intern/page.tsx`, add next to the Goals link:

```tsx
      <p>
        <a href="/intern/journal">Journal</a>
      </p>
```

- [ ] **Step 5: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/app/intern/journal-actions.ts src/app/intern/journal/page.tsx src/app/lead/interns/\[uid\]/journal/page.tsx src/app/lead/interns/\[uid\]/page.tsx src/app/intern/page.tsx
git commit -m "Add per-intern journal: Server Actions and placeholder pages"
```

---

## Task 7: Priorities — Server Actions (intern + lead) + pages

**Files:**
- Create: `src/app/intern/priorities-actions.ts`
- Create: `src/app/intern/priorities/page.tsx`
- Create: `src/app/lead/interns/[uid]/priorities-actions.ts`
- Create: `src/app/lead/interns/[uid]/priorities/page.tsx`
- Modify: `src/app/lead/interns/[uid]/page.tsx`
- Modify: `src/app/intern/page.tsx`

- [ ] **Step 1: Write the intern Server Actions**

```ts
// src/app/intern/priorities-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import type { PriorityDoc } from "@/lib/auth/types";

const VALID_STATUSES = ["Done", "In Progress", "Not Started", "Blocked"];

export async function addPriority(formData: FormData): Promise<void> {
  const user = await requireRole("intern");
  const text = String(formData.get("text") ?? "").trim();
  const weekOf = String(formData.get("weekOf") ?? "").trim();
  const linkedGoalId = String(formData.get("linkedGoalId") ?? "").trim() || null;
  if (!text || !weekOf) {
    throw new Error("Missing text or week.");
  }

  const priority: PriorityDoc = {
    text,
    weekOf,
    status: "Not Started",
    linkedGoalId,
    createdAt: Date.now(),
  };
  await getAdminDb().collection("users").doc(user.uid).collection("priorities").add(priority);
  revalidatePath("/intern/priorities");
}

export async function updatePriority(formData: FormData): Promise<void> {
  const user = await requireRole("intern");
  const priorityId = String(formData.get("priorityId") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const linkedGoalId = String(formData.get("linkedGoalId") ?? "").trim() || null;
  if (!priorityId || !text) {
    throw new Error("Missing priority id or text.");
  }
  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Invalid status.");
  }

  await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("priorities")
    .doc(priorityId)
    .update({ text, status, linkedGoalId });
  revalidatePath("/intern/priorities");
}

export async function deletePriority(formData: FormData): Promise<void> {
  const user = await requireRole("intern");
  const priorityId = String(formData.get("priorityId") ?? "").trim();
  if (!priorityId) {
    throw new Error("Missing priority id.");
  }

  await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("priorities")
    .doc(priorityId)
    .delete();
  revalidatePath("/intern/priorities");
}
```

- [ ] **Step 2: Write the lead Server Actions**

```ts
// src/app/lead/interns/[uid]/priorities-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { assertOwnedIntern } from "@/lib/auth/ownership";
import type { PriorityDoc } from "@/lib/auth/types";

const VALID_STATUSES = ["Done", "In Progress", "Not Started", "Blocked"];

export async function addPriority(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  const weekOf = String(formData.get("weekOf") ?? "").trim();
  const linkedGoalId = String(formData.get("linkedGoalId") ?? "").trim() || null;
  if (!uid || !text || !weekOf) {
    throw new Error("Missing intern id, text, or week.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  const priority: PriorityDoc = {
    text,
    weekOf,
    status: "Not Started",
    linkedGoalId,
    createdAt: Date.now(),
  };
  await getAdminDb().collection("users").doc(uid).collection("priorities").add(priority);
  revalidatePath(`/lead/interns/${uid}/priorities`);
}

export async function updatePriority(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const priorityId = String(formData.get("priorityId") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const linkedGoalId = String(formData.get("linkedGoalId") ?? "").trim() || null;
  if (!uid || !priorityId || !text) {
    throw new Error("Missing intern id, priority id, or text.");
  }
  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Invalid status.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("priorities")
    .doc(priorityId)
    .update({ text, status, linkedGoalId });
  revalidatePath(`/lead/interns/${uid}/priorities`);
}

export async function deletePriority(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const priorityId = String(formData.get("priorityId") ?? "").trim();
  if (!uid || !priorityId) {
    throw new Error("Missing intern id or priority id.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("priorities")
    .doc(priorityId)
    .delete();
  revalidatePath(`/lead/interns/${uid}/priorities`);
}
```

- [ ] **Step 3: Write the intern page (resolves `linkedGoalId` via `resolveLinkedGoal`)**

```tsx
// src/app/intern/priorities/page.tsx
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { resolveLinkedGoal } from "@/lib/goals";
import { addPriority, updatePriority, deletePriority } from "../priorities-actions";
import type { GoalDoc, PriorityDoc } from "@/lib/auth/types";

export default async function InternPrioritiesPage() {
  const user = await requireRole("intern");
  const db = getAdminDb();

  const prioritiesSnapshot = await db
    .collection("users")
    .doc(user.uid)
    .collection("priorities")
    .get();
  const priorities = prioritiesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as PriorityDoc),
  }));

  const resolvedGoals = await Promise.all(
    priorities.map((priority) =>
      resolveLinkedGoal(
        priority.linkedGoalId,
        async (id) => {
          const snapshot = await db.collection("users").doc(user.uid).collection("goals").doc(id).get();
          return snapshot.exists ? (snapshot.data() as GoalDoc) : null;
        },
        async () => null // team goals arrive in Sprint 3.1b
      )
    )
  );

  return (
    <main>
      <p>
        <a href="/intern">← Back</a>
      </p>
      <h1>Your priorities</h1>
      <ul>
        {priorities.map((priority, index) => (
          <li key={priority.id}>
            <form action={updatePriority}>
              <input type="hidden" name="priorityId" value={priority.id} />
              <label>
                Text
                <input name="text" defaultValue={priority.text} required />
              </label>
              <label>
                Status
                <select name="status" defaultValue={priority.status}>
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Done">Done</option>
                  <option value="Blocked">Blocked</option>
                </select>
              </label>
              <label>
                Linked goal id
                <input name="linkedGoalId" defaultValue={priority.linkedGoalId ?? ""} />
              </label>
              <button type="submit">Save</button>
            </form>
            {resolvedGoals[index] && (
              <p>
                Linked to {resolvedGoals[index]!.scope} goal: {resolvedGoals[index]!.objective}
              </p>
            )}
            <form action={deletePriority}>
              <input type="hidden" name="priorityId" value={priority.id} />
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>

      <h2>Add a priority</h2>
      <form action={addPriority}>
        <label>
          Text
          <input name="text" required />
        </label>
        <label>
          Week of
          <input type="date" name="weekOf" required />
        </label>
        <label>
          Linked goal id
          <input name="linkedGoalId" />
        </label>
        <button type="submit">Add</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Write the lead page**

```tsx
// src/app/lead/interns/[uid]/priorities/page.tsx
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { isOwnedIntern } from "@/lib/auth/ownership";
import { addPriority, updatePriority, deletePriority } from "../priorities-actions";
import type { PriorityDoc, UserDoc } from "@/lib/auth/types";

export default async function InternPrioritiesPage({
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
  if (!isOwnedIntern(targetUser, lead.engagementId ?? "")) {
    notFound();
  }

  const prioritiesSnapshot = await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("priorities")
    .get();
  const priorities = prioritiesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as PriorityDoc),
  }));

  return (
    <main>
      <p>
        <a href={`/lead/interns/${uid}`}>← Back to {targetUser.name}&apos;s timeline</a>
      </p>
      <h1>{targetUser.name}&apos;s priorities</h1>
      <ul>
        {priorities.map((priority) => (
          <li key={priority.id}>
            <form action={updatePriority}>
              <input type="hidden" name="uid" value={uid} />
              <input type="hidden" name="priorityId" value={priority.id} />
              <label>
                Text
                <input name="text" defaultValue={priority.text} required />
              </label>
              <label>
                Status
                <select name="status" defaultValue={priority.status}>
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Done">Done</option>
                  <option value="Blocked">Blocked</option>
                </select>
              </label>
              <label>
                Linked goal id
                <input name="linkedGoalId" defaultValue={priority.linkedGoalId ?? ""} />
              </label>
              <button type="submit">Save</button>
            </form>
            <form action={deletePriority}>
              <input type="hidden" name="uid" value={uid} />
              <input type="hidden" name="priorityId" value={priority.id} />
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>

      <h2>Add a priority</h2>
      <form action={addPriority}>
        <input type="hidden" name="uid" value={uid} />
        <label>
          Text
          <input name="text" required />
        </label>
        <label>
          Week of
          <input type="date" name="weekOf" required />
        </label>
        <label>
          Linked goal id
          <input name="linkedGoalId" />
        </label>
        <button type="submit">Add</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Link the new pages**

In `src/app/lead/interns/[uid]/page.tsx`, add next to the Journal link:

```tsx
      <p>
        <a href={`/lead/interns/${uid}/priorities`}>Priorities</a>
      </p>
```

In `src/app/intern/page.tsx`, add next to the Journal link:

```tsx
      <p>
        <a href="/intern/priorities">Priorities</a>
      </p>
```

- [ ] **Step 6: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/app/intern/priorities-actions.ts src/app/intern/priorities/page.tsx src/app/lead/interns/\[uid\]/priorities-actions.ts src/app/lead/interns/\[uid\]/priorities/page.tsx src/app/lead/interns/\[uid\]/page.tsx src/app/intern/page.tsx
git commit -m "Add per-intern priorities: Server Actions and placeholder pages"
```

---

## Task 8: Projects — Server Actions (intern + lead) + pages

**Files:**
- Create: `src/app/intern/projects-actions.ts`
- Create: `src/app/intern/projects/page.tsx`
- Create: `src/app/lead/interns/[uid]/projects-actions.ts`
- Create: `src/app/lead/interns/[uid]/projects/page.tsx`
- Modify: `src/app/lead/interns/[uid]/page.tsx`
- Modify: `src/app/intern/page.tsx`

- [ ] **Step 1: Write the intern Server Action (status only)**

```ts
// src/app/intern/projects-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";

const VALID_STATUSES = ["Not Started", "In Progress", "Complete", "Blocked"];

export async function updateProjectStatus(formData: FormData): Promise<void> {
  const user = await requireRole("intern");
  const projectId = String(formData.get("projectId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!projectId) {
    throw new Error("Missing project id.");
  }
  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Invalid status.");
  }

  await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("projects")
    .doc(projectId)
    .update({ status });
  revalidatePath("/intern/projects");
}
```

- [ ] **Step 2: Write the lead Server Actions (full CRUD)**

```ts
// src/app/lead/interns/[uid]/projects-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { assertOwnedIntern } from "@/lib/auth/ownership";
import type { ProjectDoc } from "@/lib/auth/types";

const VALID_STATUSES = ["Not Started", "In Progress", "Complete", "Blocked"];
const VALID_PRIORITIES = ["Low", "Medium", "High"];

function readProjectFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    assignedBy: String(formData.get("assignedBy") ?? "").trim(),
    dueDate: String(formData.get("dueDate") ?? "").trim(),
    githubRepo: String(formData.get("githubRepo") ?? "").trim(),
    jiraTicket: String(formData.get("jiraTicket") ?? "").trim(),
    projectLink: String(formData.get("projectLink") ?? "").trim(),
    deliverables: String(formData.get("deliverables") ?? "").trim(),
    estimatedTime: String(formData.get("estimatedTime") ?? "").trim(),
    priority: String(formData.get("priority") ?? "Medium").trim(),
  };
}

export async function addProject(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const fields = readProjectFields(formData);
  if (!uid || !fields.name) {
    throw new Error("Missing intern id or project name.");
  }
  if (!VALID_PRIORITIES.includes(fields.priority)) {
    throw new Error("Invalid priority.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  const project: ProjectDoc = {
    ...fields,
    priority: fields.priority as ProjectDoc["priority"],
    status: "Not Started",
    createdAt: Date.now(),
  };
  await getAdminDb().collection("users").doc(uid).collection("projects").add(project);
  revalidatePath(`/lead/interns/${uid}/projects`);
}

export async function updateProject(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const fields = readProjectFields(formData);
  if (!uid || !projectId || !fields.name) {
    throw new Error("Missing intern id, project id, or name.");
  }
  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Invalid status.");
  }
  if (!VALID_PRIORITIES.includes(fields.priority)) {
    throw new Error("Invalid priority.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("projects")
    .doc(projectId)
    .update({ ...fields, priority: fields.priority as ProjectDoc["priority"], status: status as ProjectDoc["status"] });
  revalidatePath(`/lead/interns/${uid}/projects`);
}

export async function deleteProject(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!uid || !projectId) {
    throw new Error("Missing intern id or project id.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  await getAdminDb().collection("users").doc(uid).collection("projects").doc(projectId).delete();
  revalidatePath(`/lead/interns/${uid}/projects`);
}
```

- [ ] **Step 3: Write the intern page**

```tsx
// src/app/intern/projects/page.tsx
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { updateProjectStatus } from "../projects-actions";
import type { ProjectDoc } from "@/lib/auth/types";

export default async function InternProjectsPage() {
  const user = await requireRole("intern");

  const projectsSnapshot = await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("projects")
    .get();
  const projects = projectsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as ProjectDoc),
  }));

  return (
    <main>
      <p>
        <a href="/intern">← Back</a>
      </p>
      <h1>Your projects</h1>
      <ul>
        {projects.map((project) => (
          <li key={project.id}>
            <p>
              {project.name} — assigned by {project.assignedBy || "unknown"}, due{" "}
              {project.dueDate || "TBD"}, priority {project.priority}
            </p>
            <form action={updateProjectStatus}>
              <input type="hidden" name="projectId" value={project.id} />
              <label>
                Status
                <select name="status" defaultValue={project.status}>
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Complete">Complete</option>
                  <option value="Blocked">Blocked</option>
                </select>
              </label>
              <button type="submit">Save</button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 4: Write the lead page**

```tsx
// src/app/lead/interns/[uid]/projects/page.tsx
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { isOwnedIntern } from "@/lib/auth/ownership";
import { addProject, updateProject, deleteProject } from "../projects-actions";
import type { ProjectDoc, UserDoc } from "@/lib/auth/types";

export default async function InternProjectsPage({
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
  if (!isOwnedIntern(targetUser, lead.engagementId ?? "")) {
    notFound();
  }

  const projectsSnapshot = await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("projects")
    .get();
  const projects = projectsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as ProjectDoc),
  }));

  return (
    <main>
      <p>
        <a href={`/lead/interns/${uid}`}>← Back to {targetUser.name}&apos;s timeline</a>
      </p>
      <h1>{targetUser.name}&apos;s projects</h1>
      <ul>
        {projects.map((project) => (
          <li key={project.id}>
            <form action={updateProject}>
              <input type="hidden" name="uid" value={uid} />
              <input type="hidden" name="projectId" value={project.id} />
              <label>
                Name
                <input name="name" defaultValue={project.name} required />
              </label>
              <label>
                Assigned by
                <input name="assignedBy" defaultValue={project.assignedBy} />
              </label>
              <label>
                Status
                <select name="status" defaultValue={project.status}>
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Complete">Complete</option>
                  <option value="Blocked">Blocked</option>
                </select>
              </label>
              <label>
                Due date
                <input name="dueDate" defaultValue={project.dueDate} />
              </label>
              <label>
                GitHub repo
                <input name="githubRepo" defaultValue={project.githubRepo} />
              </label>
              <label>
                Jira ticket
                <input name="jiraTicket" defaultValue={project.jiraTicket} />
              </label>
              <label>
                Project link
                <input name="projectLink" defaultValue={project.projectLink} />
              </label>
              <label>
                Deliverables
                <textarea name="deliverables" defaultValue={project.deliverables} />
              </label>
              <label>
                Estimated time
                <input name="estimatedTime" defaultValue={project.estimatedTime} />
              </label>
              <label>
                Priority
                <select name="priority" defaultValue={project.priority}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </label>
              <button type="submit">Save</button>
            </form>
            <form action={deleteProject}>
              <input type="hidden" name="uid" value={uid} />
              <input type="hidden" name="projectId" value={project.id} />
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>

      <h2>Add a project</h2>
      <form action={addProject}>
        <input type="hidden" name="uid" value={uid} />
        <label>
          Name
          <input name="name" required />
        </label>
        <label>
          Assigned by
          <input name="assignedBy" />
        </label>
        <label>
          Due date
          <input name="dueDate" />
        </label>
        <label>
          GitHub repo
          <input name="githubRepo" />
        </label>
        <label>
          Jira ticket
          <input name="jiraTicket" />
        </label>
        <label>
          Project link
          <input name="projectLink" />
        </label>
        <label>
          Deliverables
          <textarea name="deliverables" />
        </label>
        <label>
          Estimated time
          <input name="estimatedTime" />
        </label>
        <label>
          Priority
          <select name="priority" defaultValue="Medium">
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </label>
        <button type="submit">Add</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Link the new pages**

In `src/app/lead/interns/[uid]/page.tsx`, add next to the Priorities link:

```tsx
      <p>
        <a href={`/lead/interns/${uid}/projects`}>Projects</a>
      </p>
```

In `src/app/intern/page.tsx`, add next to the Priorities link:

```tsx
      <p>
        <a href="/intern/projects">Projects</a>
      </p>
```

- [ ] **Step 6: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/app/intern/projects-actions.ts src/app/intern/projects/page.tsx src/app/lead/interns/\[uid\]/projects-actions.ts src/app/lead/interns/\[uid\]/projects/page.tsx src/app/lead/interns/\[uid\]/page.tsx src/app/intern/page.tsx
git commit -m "Add per-intern projects: Server Actions and placeholder pages"
```

---

## Task 9: Profile — Server Actions (intern + lead) + pages

**Files:**
- Create: `src/app/intern/profile-actions.ts`
- Create: `src/app/intern/profile/page.tsx`
- Create: `src/app/lead/interns/[uid]/profile-actions.ts`
- Create: `src/app/lead/interns/[uid]/profile/page.tsx`
- Modify: `src/app/lead/interns/[uid]/page.tsx`
- Modify: `src/app/intern/page.tsx`

Stored at `users/{uid}/profile/data` (see the File Structure section's structural
note). Both actions below use `.set(..., { merge: true })` rather than `.update()` so
the first save creates the doc — nothing seeds a `ProfileDoc` at account creation,
unlike `MilestoneDoc` in Sprint 2, since the design doc doesn't call for that.

- [ ] **Step 1: Write the intern Server Action (bio only)**

```ts
// src/app/intern/profile-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";

export async function updateOwnBio(formData: FormData): Promise<void> {
  const user = await requireRole("intern");
  const bio = String(formData.get("bio") ?? "").trim();

  await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("profile")
    .doc("data")
    .set({ bio }, { merge: true });
  revalidatePath("/intern/profile");
}
```

- [ ] **Step 2: Write the lead Server Action (full profile, incl. capacity)**

```ts
// src/app/lead/interns/[uid]/profile-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { assertOwnedIntern } from "@/lib/auth/ownership";
import type { ProfileDoc } from "@/lib/auth/types";

export async function updateProfile(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const manager = String(formData.get("manager") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const capacity = Number(formData.get("capacity") ?? 0);
  if (!uid) {
    throw new Error("Missing intern id.");
  }
  if (!Number.isFinite(capacity) || capacity < 0 || capacity > 100) {
    throw new Error("Capacity must be a number between 0 and 100.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  const profile: ProfileDoc = { role, manager, department, startDate, bio, capacity };
  await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("profile")
    .doc("data")
    .set(profile, { merge: true });
  revalidatePath(`/lead/interns/${uid}/profile`);
}
```

- [ ] **Step 3: Write the intern page**

```tsx
// src/app/intern/profile/page.tsx
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { updateOwnBio } from "../profile-actions";
import type { ProfileDoc } from "@/lib/auth/types";

export default async function InternProfilePage() {
  const user = await requireRole("intern");

  const profileSnapshot = await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("profile")
    .doc("data")
    .get();
  const profile = profileSnapshot.exists ? (profileSnapshot.data() as ProfileDoc) : null;

  return (
    <main>
      <p>
        <a href="/intern">← Back</a>
      </p>
      <h1>Your profile</h1>
      <p>Role: {profile?.role || "—"}</p>
      <p>Manager: {profile?.manager || "—"}</p>
      <p>Department: {profile?.department || "—"}</p>
      <p>Start date: {profile?.startDate || "—"}</p>
      <p>Current capacity: {profile?.capacity ?? 0}%</p>

      <form action={updateOwnBio}>
        <label>
          Bio
          <textarea name="bio" defaultValue={profile?.bio ?? ""} />
        </label>
        <button type="submit">Save</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Write the lead page**

```tsx
// src/app/lead/interns/[uid]/profile/page.tsx
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { isOwnedIntern } from "@/lib/auth/ownership";
import { updateProfile } from "../profile-actions";
import type { ProfileDoc, UserDoc } from "@/lib/auth/types";

export default async function InternProfilePage({
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
  if (!isOwnedIntern(targetUser, lead.engagementId ?? "")) {
    notFound();
  }

  const profileSnapshot = await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("profile")
    .doc("data")
    .get();
  const profile = profileSnapshot.exists ? (profileSnapshot.data() as ProfileDoc) : null;

  return (
    <main>
      <p>
        <a href={`/lead/interns/${uid}`}>← Back to {targetUser.name}&apos;s timeline</a>
      </p>
      <h1>{targetUser.name}&apos;s profile</h1>
      <form action={updateProfile}>
        <input type="hidden" name="uid" value={uid} />
        <label>
          Role
          <input name="role" defaultValue={profile?.role ?? ""} />
        </label>
        <label>
          Manager
          <input name="manager" defaultValue={profile?.manager ?? ""} />
        </label>
        <label>
          Department
          <input name="department" defaultValue={profile?.department ?? ""} />
        </label>
        <label>
          Start date
          <input name="startDate" defaultValue={profile?.startDate ?? ""} />
        </label>
        <label>
          Bio
          <textarea name="bio" defaultValue={profile?.bio ?? ""} />
        </label>
        <label>
          Current capacity
          <input
            type="number"
            name="capacity"
            min={0}
            max={100}
            defaultValue={profile?.capacity ?? 0}
          />
        </label>
        <button type="submit">Save</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Link the new pages**

In `src/app/lead/interns/[uid]/page.tsx`, add next to the Projects link:

```tsx
      <p>
        <a href={`/lead/interns/${uid}/profile`}>Profile</a>
      </p>
```

In `src/app/intern/page.tsx`, add next to the Projects link:

```tsx
      <p>
        <a href="/intern/profile">Profile</a>
      </p>
```

- [ ] **Step 6: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/app/intern/profile-actions.ts src/app/intern/profile/page.tsx src/app/lead/interns/\[uid\]/profile-actions.ts src/app/lead/interns/\[uid\]/profile/page.tsx src/app/lead/interns/\[uid\]/page.tsx src/app/intern/page.tsx
git commit -m "Add per-intern profile: Server Actions and placeholder pages"
```

---

## Task 10: Full verification pass

**Files:** none (verification only)

- [x] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: PASS — includes the 4 new `ownership.test.ts` tests and 4 new
`goals.test.ts` tests, all prior tests (reconcile, roster, timeline-seed) still
passing

- [x] **Step 2: Run the linter and typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors

- [x] **Step 3: Run a production build**

Run: `npm run build`
Expected: build succeeds; `/intern/{goals,journal,priorities,projects,profile}` and
`/lead/interns/[uid]/{goals,journal,priorities,projects,profile}` all listed as
dynamic routes

- [x] **Step 4: Manual smoke test (requires a real engagement with a signed-in lead)**

Performed via browser automation on 2026-07-27 against griffin-17f70 with a throwaway
"QA Smoke Test Engagement" (qa-lead-test@example.com / qa-intern-test@example.com).
All 13 sub-steps passed — including the cross-engagement 404 check (companyAdmin's
uid rejected at `/lead/interns/{uid}/goals`), the field-level intern/lead
restrictions on Goals/Projects/Profile, and the `linkedGoalId` resolution (valid id
resolved, nonsense id degraded gracefully with no crash).

Using an account already onboarded as an `engagementLead`, with at least one active
intern:

1. As the lead, from `/lead`, click through to that intern's timeline, then click
   each of the five new links (Goals, Journal, Priorities, Projects, Profile) —
   confirm each loads with an empty list/form (no errors).
2. On the lead's Goals page, add a goal, confirm it appears with status "Gray" and
   0% progress. Edit it: change status to "Green", set progress to 50, add two key
   results — confirm the changes persist on reload. Delete it — confirm it's gone.
3. On the lead's Journal page — confirm it's read-only (no add/delete controls).
4. On the lead's Priorities page, add a priority for a week, leave "Linked goal id"
   blank — confirm it saves with status "Not Started". Edit its status to "Blocked" —
   confirm it persists.
5. On the lead's Projects page, add a project with a name, due date, and priority
   "High" — confirm it appears. Edit its status to "In Progress" — confirm it
   persists. Delete it.
6. On the lead's Profile page, fill in role/manager/department/start date/bio/capacity
   and save — confirm all six fields persist on reload (this is the first save, so it
   creates the `profile/data` doc rather than updating one).
7. Sign in as that intern, land on `/intern` — confirm the five new links appear.
8. On the intern's Goals page — add a goal from the lead side first if empty, then
   from the intern's page confirm you can change status/progress but there's no
   objective/target-date/KR edit control (intern is status/progress-only per the
   access table).
9. On the intern's Journal page, add an entry, confirm it appears, delete it, confirm
   it's gone.
10. On the intern's Priorities page, add a priority with a "Linked goal id" set to a
    real goal id from Step 8 — confirm the page shows "Linked to individual goal:
    &lt;objective&gt;" beneath it. Try a nonsense id — confirm no crash, just no
    "Linked to" line.
11. On the intern's Projects page — confirm you can only change status, not name/due
    date/etc.
12. On the intern's Profile page — confirm role/manager/department/start
    date/capacity are visible but read-only, and only the bio textarea is editable.
    Change the bio, save, confirm it persists without touching the lead-set fields.
13. As the lead, try navigating directly to
    `/lead/interns/{uid}/goals` for a `uid` belonging to a *different* engagement (or
    a non-intern user) — confirm it 404s.

- [ ] **Step 5: Final commit if any fixups were needed during manual testing**

```bash
git add -A
git commit -m "Fix issues found during Sprint 3.1a manual verification"
```

(Skip this step if no fixes were needed.)

---

## Self-Review Notes

- **Spec coverage:** `GoalDoc`, `JournalEntryDoc`, `PriorityDoc`, `ProjectDoc`,
  `ProfileDoc` ✓ (Task 2), access-control table's intern-vs-lead field restrictions ✓
  (Tasks 5-9, e.g. intern goals action only touches status/progress, intern projects
  action only touches status, intern profile action only touches bio), Firestore
  rules ✓ (Task 4), `linkedGoalId` dual-lookup with a unit test ✓ (Task 3, wired into
  Task 7's intern priorities page), placeholder pages with no styling/nav entry ✓
  (all of Tasks 5-9), Profile folded into this sub-project per the design doc's scope
  call ✓ (Task 9). Team-scoped collections (engagements/{id}/...) are explicitly out
  of scope here — Sprint 3.1b.
- **DRY:** the ownership check Sprint 2 wrote inline is now shared across six call
  sites (five new + `timeline-actions.ts`) instead of being copy-pasted a sixth time ✓
  (Task 1).
- **Type consistency checked:** field names in each `*Doc` type (Task 2) match
  exactly what each Server Action reads/writes (Tasks 5-9) and what each page renders
  — e.g. `GoalDoc.krs` is `{id, text}[]` everywhere it appears (action parsing, page
  rendering), `ProjectDoc.priority` uses the same three-value union in the type, the
  lead action's validation list, and both `<select>` elements. `resolveLinkedGoal`'s
  fetcher signature (Task 3) matches how Task 7's intern page calls it (an async
  function returning `{objective: string} | null`).
