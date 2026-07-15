# Sprint 1 Manage Interns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an Engagement Lead invite, remove, and reactivate interns in their own
engagement, and see a roster of active/invited/removed interns on `/lead`.

**Architecture:** `UserDoc` gains a `status` field, checked at two points — inside
`completeSignIn` (deny a removed user's sign-in before a session is ever created) and
inside `requireRole` (revoke access on the very next request for anyone already
mid-session when removed). `/lead`'s new Server Actions (`inviteIntern`,
`removeIntern`, `reactivateIntern`, `cancelInvite`) reuse the invite-link pattern
already built in Sprint 0, each re-verifying the target resource belongs to the
calling lead's own engagement before mutating it. Roster-row shaping (deciding
invited/active/removed from raw Firestore data) is a pure function, tested the same
way Sprint 0 tested `resolveSignIn`.

**Tech Stack:** Next.js 16 App Router (Server Actions, Server Components), Firebase
Admin SDK (`getAdminAuth()`/`getAdminDb()`, already built in Sprint 0), Vitest.

See design doc: `docs/superpowers/specs/2026-07-15-sprint-1-manage-interns-design.md`

---

## File Structure

Modified files:
- `src/lib/auth/types.ts` — `UserDoc` gains `status: "active" | "removed"`
- `src/lib/auth/reconcile.ts` + `reconcile.test.ts` — set `status: "active"` on newly created users
- `src/lib/auth/dal.ts` — `requireRole` denies removed users
- `src/lib/auth/actions.ts` — `completeSignIn` denies removed users before creating a session
- `firestore.rules` — `invites` write access extends to `engagementLead`
- `src/app/lead/page.tsx` — replaces the Sprint 0 placeholder with the real roster + invite UI

New files:
- `src/app/lead/roster.ts` + `roster.test.ts` — pure roster-row-shaping logic (tested)
- `src/app/lead/actions.ts` — `inviteIntern`, `removeIntern`, `reactivateIntern`, `cancelInvite`
- `src/app/lead/invite-intern-form.tsx` — client component, mirrors `/admin`'s `InviteLeadForm`

---

## Task 1: Add `status` to `UserDoc`, update reconcile logic and tests

**Files:**
- Modify: `src/lib/auth/types.ts`
- Modify: `src/lib/auth/reconcile.ts`
- Modify: `src/lib/auth/reconcile.test.ts`

- [ ] **Step 1: Add the field to `UserDoc`**

In `src/lib/auth/types.ts`, change:

```ts
export interface UserDoc {
  email: string;
  name: string;
  role: UserRole;
  engagementId?: string;
  createdAt: number;
}
```

to:

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

- [ ] **Step 2: Set `status: "active"` on newly created users in `reconcile.ts`**

In `src/lib/auth/reconcile.ts`, the `createFromInvite` branch changes from:

```ts
  if (matchingInvite) {
    const user: UserDoc = {
      email,
      name: matchingInvite.name,
      role: matchingInvite.role,
      engagementId: matchingInvite.engagementId,
      createdAt: Date.now(),
    };
    return { kind: "createFromInvite", user, inviteId: matchingInvite.id };
  }
```

to:

```ts
  if (matchingInvite) {
    const user: UserDoc = {
      email,
      name: matchingInvite.name,
      role: matchingInvite.role,
      engagementId: matchingInvite.engagementId,
      createdAt: Date.now(),
      status: "active",
    };
    return { kind: "createFromInvite", user, inviteId: matchingInvite.id };
  }
```

And the `createFromAdminAllowlist` branch changes from:

```ts
  if (allowedAdminEmails.includes(email)) {
    const user: UserDoc = {
      email,
      name: email,
      role: "companyAdmin" as UserRole,
      createdAt: Date.now(),
    };
    return { kind: "createFromAdminAllowlist", user };
  }
```

to:

```ts
  if (allowedAdminEmails.includes(email)) {
    const user: UserDoc = {
      email,
      name: email,
      role: "companyAdmin" as UserRole,
      createdAt: Date.now(),
      status: "active",
    };
    return { kind: "createFromAdminAllowlist", user };
  }
```

- [ ] **Step 3: Update test fixtures to include `status`**

In `src/lib/auth/reconcile.test.ts`, every inline `UserDoc`-shaped object literal used as
`existingUser` needs `status: "active"` added (TypeScript will fail to compile
otherwise, since `status` is now required). There are three: the "returns the existing
user" test, the "prefers the existing user" test, and the "denies sign-in" test doesn't
use one. Update the two that do — for example the first one changes from:

```ts
    const existingUser = {
      email: "grace@example.com",
      name: "Grace",
      role: "engagementLead" as const,
      createdAt: 1,
    };
```

to:

```ts
    const existingUser = {
      email: "grace@example.com",
      name: "Grace",
      role: "engagementLead" as const,
      createdAt: 1,
      status: "active" as const,
    };
```

Apply the same `status: "active" as const,` addition to the `existingUser` object in
the "prefers the existing user doc even if the email also matches an invite" test.

- [ ] **Step 4: Run the full test suite and typecheck**

Run: `npm run test && npx tsc --noEmit`
Expected: PASS — all 6 existing tests still pass, no type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/types.ts src/lib/auth/reconcile.ts src/lib/auth/reconcile.test.ts
git commit -m "Add status field to UserDoc for soft-remove support"
```

---

## Task 2: Deny removed users in `requireRole` and `completeSignIn`

**Files:**
- Modify: `src/lib/auth/dal.ts`
- Modify: `src/lib/auth/actions.ts`

- [ ] **Step 1: `requireRole` checks `status`**

In `src/lib/auth/dal.ts`, change:

```ts
export async function requireRole(
  role: UserRole
): Promise<UserDoc & { uid: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== role) {
    redirect("/login");
  }
  return user;
}
```

to:

```ts
export async function requireRole(
  role: UserRole
): Promise<UserDoc & { uid: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== role || user.status === "removed") {
    redirect("/login");
  }
  return user;
}
```

- [ ] **Step 2: `completeSignIn` denies removed users before creating a session**

In `src/lib/auth/actions.ts`, right after the existing `denied` check, add a check for
a removed existing user. Change:

```ts
  if (result.kind === "denied") {
    throw new Error("No account found for this email. Contact your admin.");
  }

  if (result.kind === "createFromInvite") {
```

to:

```ts
  if (result.kind === "denied") {
    throw new Error("No account found for this email. Contact your admin.");
  }

  if (result.kind === "existing" && result.user.status === "removed") {
    throw new Error("No account found for this email. Contact your admin.");
  }

  if (result.kind === "createFromInvite") {
```

- [ ] **Step 3: Run the full test suite, lint, typecheck, and build**

Run: `npm run test && npm run lint && npx tsc --noEmit && npm run build`
Expected: all pass, no errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/dal.ts src/lib/auth/actions.ts
git commit -m "Deny removed users at sign-in and on every protected-route request"
```

---

## Task 3: Firestore rules — allow `engagementLead` to write invites

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Extend the `invites` write rule**

In `firestore.rules`, change:

```
    match /invites/{inviteId} {
      allow read, write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "companyAdmin";
    }
```

to:

```
    match /invites/{inviteId} {
      allow read, write: if request.auth != null &&
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "companyAdmin" ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "engagementLead");
    }
```

(Matches the existing rules' level of granularity — role-only, not per-engagement
scoping inside the rule itself. These rules are defense-in-depth only, per the Sprint 0
design doc: real writes go through the Admin SDK, which bypasses rules regardless. The
actual per-engagement ownership check lives in the Server Actions, Task 5 below.)

- [ ] **Step 2: Deploy the updated rules**

Try: `firebase deploy --only firestore:rules`
Expected: `✔ Deploy complete!`

If the Firebase CLI isn't set up locally, note that in your report and paste the rules
into Firebase Console → Firestore Database → Rules instead — this doesn't block the
rest of the plan, since nothing in this app writes to `invites` from the client side.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "Allow engagementLead to write invites"
```

---

## Task 4: Roster-row logic (TDD)

**Files:**
- Create: `src/app/lead/roster.ts`
- Create: `src/app/lead/roster.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/lead/roster.test.ts
import { describe, expect, it } from "vitest";
import { buildRosterRows } from "./roster";

describe("buildRosterRows", () => {
  it("marks an active intern as active", () => {
    const rows = buildRosterRows(
      [
        {
          uid: "u1",
          email: "intern@example.com",
          name: "Intern One",
          role: "intern",
          engagementId: "eng-1",
          createdAt: 1,
          status: "active",
        },
      ],
      []
    );
    expect(rows).toEqual([
      {
        key: "u1",
        name: "Intern One",
        email: "intern@example.com",
        state: "active",
        uid: "u1",
      },
    ]);
  });

  it("marks a removed intern as removed, not hidden", () => {
    const rows = buildRosterRows(
      [
        {
          uid: "u2",
          email: "removed@example.com",
          name: "Removed Intern",
          role: "intern",
          engagementId: "eng-1",
          createdAt: 1,
          status: "removed",
        },
      ],
      []
    );
    expect(rows).toEqual([
      {
        key: "u2",
        name: "Removed Intern",
        email: "removed@example.com",
        state: "removed",
        uid: "u2",
      },
    ]);
  });

  it("marks a pending invite as invited", () => {
    const rows = buildRosterRows(
      [],
      [
        {
          id: "inv-1",
          email: "pending@example.com",
          name: "Pending Intern",
          role: "intern",
          engagementId: "eng-1",
          createdAt: 1,
          usedAt: null,
        },
      ]
    );
    expect(rows).toEqual([
      {
        key: "inv-1",
        name: "Pending Intern",
        email: "pending@example.com",
        state: "invited",
        inviteId: "inv-1",
      },
    ]);
  });

  it("combines interns and invites into one roster, interns first", () => {
    const rows = buildRosterRows(
      [
        {
          uid: "u1",
          email: "a@example.com",
          name: "A",
          role: "intern",
          engagementId: "eng-1",
          createdAt: 1,
          status: "active",
        },
      ],
      [
        {
          id: "inv-1",
          email: "b@example.com",
          name: "B",
          role: "intern",
          engagementId: "eng-1",
          createdAt: 1,
          usedAt: null,
        },
      ]
    );
    expect(rows.map((r) => r.key)).toEqual(["u1", "inv-1"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `Cannot find module './roster'`, since `roster.ts` doesn't exist yet

- [ ] **Step 3: Write the implementation**

```ts
// src/app/lead/roster.ts
import type { InviteDoc, UserDoc } from "@/lib/auth/types";

export type RosterRowState = "invited" | "active" | "removed";

export interface RosterRow {
  key: string;
  name: string;
  email: string;
  state: RosterRowState;
  uid?: string;
  inviteId?: string;
}

export function buildRosterRows(
  interns: (UserDoc & { uid: string })[],
  invites: (InviteDoc & { id: string })[]
): RosterRow[] {
  const rows: RosterRow[] = [];

  for (const intern of interns) {
    rows.push({
      key: intern.uid,
      name: intern.name,
      email: intern.email,
      state: intern.status === "removed" ? "removed" : "active",
      uid: intern.uid,
    });
  }

  for (const invite of invites) {
    rows.push({
      key: invite.id,
      name: invite.name,
      email: invite.email,
      state: "invited",
      inviteId: invite.id,
    });
  }

  return rows;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test`
Expected: PASS — 4 new tests passing in `src/app/lead/roster.test.ts`, 6 existing tests
in `reconcile.test.ts` still passing (10 total)

- [ ] **Step 5: Commit**

```bash
git add src/app/lead/roster.ts src/app/lead/roster.test.ts
git commit -m "Add roster-row-shaping logic with unit tests"
```

---

## Task 5: Lead Server Actions — invite, remove, reactivate, cancel

**Files:**
- Create: `src/app/lead/actions.ts`

- [ ] **Step 1: Write the implementation**

```ts
// src/app/lead/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import type { InviteDoc, UserDoc } from "@/lib/auth/types";

function assertSameEngagement(
  resourceEngagementId: string | undefined,
  leadEngagementId: string
): void {
  if (resourceEngagementId !== leadEngagementId) {
    throw new Error("You can only manage your own engagement's records.");
  }
}

export async function inviteIntern(
  formData: FormData
): Promise<{ link: string }> {
  const lead = await requireRole("engagementLead");
  const engagementId = lead.engagementId;
  if (!engagementId) {
    throw new Error("You are not assigned to an engagement.");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!email || !name) {
    throw new Error("Name and email are required.");
  }

  const adminDb = getAdminDb();
  const existingInviteQuery = await adminDb
    .collection("invites")
    .where("email", "==", email)
    .where("engagementId", "==", engagementId)
    .where("usedAt", "==", null)
    .limit(1)
    .get();

  if (existingInviteQuery.empty) {
    const invite: InviteDoc = {
      email,
      name,
      role: "intern",
      engagementId,
      createdAt: Date.now(),
      usedAt: null,
    };
    await adminDb.collection("invites").add(invite);
    revalidatePath("/lead");
  }

  const link = await getAdminAuth().generateSignInWithEmailLink(email, {
    url: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
    handleCodeInApp: true,
  });

  return { link };
}

export async function removeIntern(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  if (!uid) {
    throw new Error("Missing intern id.");
  }

  const adminDb = getAdminDb();
  const userRef = adminDb.collection("users").doc(uid);
  const userSnapshot = await userRef.get();
  if (!userSnapshot.exists) {
    throw new Error("Intern not found.");
  }
  const targetUser = userSnapshot.data() as UserDoc;
  assertSameEngagement(targetUser.engagementId, lead.engagementId ?? "");

  await userRef.update({ status: "removed" });
  revalidatePath("/lead");
}

export async function reactivateIntern(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  if (!uid) {
    throw new Error("Missing intern id.");
  }

  const adminDb = getAdminDb();
  const userRef = adminDb.collection("users").doc(uid);
  const userSnapshot = await userRef.get();
  if (!userSnapshot.exists) {
    throw new Error("Intern not found.");
  }
  const targetUser = userSnapshot.data() as UserDoc;
  assertSameEngagement(targetUser.engagementId, lead.engagementId ?? "");

  await userRef.update({ status: "active" });
  revalidatePath("/lead");
}

export async function cancelInvite(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const inviteId = String(formData.get("inviteId") ?? "").trim();
  if (!inviteId) {
    throw new Error("Missing invite id.");
  }

  const adminDb = getAdminDb();
  const inviteRef = adminDb.collection("invites").doc(inviteId);
  const inviteSnapshot = await inviteRef.get();
  if (!inviteSnapshot.exists) {
    throw new Error("Invite not found.");
  }
  const invite = inviteSnapshot.data() as InviteDoc;
  assertSameEngagement(invite.engagementId, lead.engagementId ?? "");

  await inviteRef.delete();
  revalidatePath("/lead");
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/lead/actions.ts
git commit -m "Add lead server actions: invite, remove, reactivate, cancel invite"
```

---

## Task 6: Invite-intern form

**Files:**
- Create: `src/app/lead/invite-intern-form.tsx`

- [ ] **Step 1: Write the implementation**

```tsx
// src/app/lead/invite-intern-form.tsx
"use client";

import { useState, type FormEvent } from "react";
import { inviteIntern } from "./actions";

export function InviteInternForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    setError("");
    setLink(null);
    setSubmitting(true);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("email", email);

    try {
      const result = await inviteIntern(formData);
      setLink(result.link);
      setName("");
      setEmail("");
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="intern-name">Name</label>
      <input
        id="intern-name"
        value={name}
        onChange={(inputEvent) => setName(inputEvent.target.value)}
        required
      />

      <label htmlFor="intern-email">Email</label>
      <input
        id="intern-email"
        type="email"
        value={email}
        onChange={(inputEvent) => setEmail(inputEvent.target.value)}
        required
      />

      <button type="submit" disabled={submitting}>
        Create invite
      </button>
      {error && <p role="alert">{error}</p>}
      {link && (
        <p>
          Invite link: <code>{link}</code>{" "}
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(link)}
          >
            Copy
          </button>
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/lead/invite-intern-form.tsx
git commit -m "Add invite-intern form"
```

---

## Task 7: `/lead` page — replace the Sprint 0 placeholder

**Files:**
- Modify: `src/app/lead/page.tsx`

- [ ] **Step 1: Write the implementation**

Replace the full contents of `src/app/lead/page.tsx` with:

```tsx
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { signOutAction } from "@/lib/auth/actions";
import { removeIntern, reactivateIntern, cancelInvite } from "./actions";
import { InviteInternForm } from "./invite-intern-form";
import { buildRosterRows } from "./roster";
import type { EngagementDoc, InviteDoc, UserDoc } from "@/lib/auth/types";

export default async function LeadPage() {
  const user = await requireRole("engagementLead");

  let engagementName = "your engagement";
  let rosterRows: ReturnType<typeof buildRosterRows> = [];

  if (user.engagementId) {
    const engagementSnapshot = await getAdminDb()
      .collection("engagements")
      .doc(user.engagementId)
      .get();
    if (engagementSnapshot.exists) {
      engagementName = (engagementSnapshot.data() as EngagementDoc).name;
    }

    const internsSnapshot = await getAdminDb()
      .collection("users")
      .where("role", "==", "intern")
      .where("engagementId", "==", user.engagementId)
      .get();
    const interns = internsSnapshot.docs.map((doc) => ({
      uid: doc.id,
      ...(doc.data() as UserDoc),
    }));

    const invitesSnapshot = await getAdminDb()
      .collection("invites")
      .where("role", "==", "intern")
      .where("engagementId", "==", user.engagementId)
      .where("usedAt", "==", null)
      .get();
    const invites = invitesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as InviteDoc),
    }));

    rosterRows = buildRosterRows(interns, invites);
  }

  return (
    <main>
      <p>Signed in as {user.email} (Engagement Lead)</p>
      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>

      <h1>{engagementName}</h1>

      <h2>Interns</h2>
      <ul>
        {rosterRows.map((row) => (
          <li key={row.key}>
            {row.name} ({row.email}) — {row.state}
            {row.state === "active" && (
              <form action={removeIntern}>
                <input type="hidden" name="uid" value={row.uid} />
                <button type="submit">Remove</button>
              </form>
            )}
            {row.state === "removed" && (
              <form action={reactivateIntern}>
                <input type="hidden" name="uid" value={row.uid} />
                <button type="submit">Reactivate</button>
              </form>
            )}
            {row.state === "invited" && (
              <form action={cancelInvite}>
                <input type="hidden" name="inviteId" value={row.inviteId} />
                <button type="submit">Cancel</button>
              </form>
            )}
          </li>
        ))}
      </ul>

      <h2>Invite an intern</h2>
      <InviteInternForm />
    </main>
  );
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/lead/page.tsx
git commit -m "Replace /lead placeholder with real intern roster and management UI"
```

---

## Task 8: Full verification pass

**Files:** none (verification only)

**Note:** the roster page's Firestore query (`users` filtered by `role` + `engagementId`)
and the invites queries (`invites` filtered by `role`/`email` + `engagementId` +
`usedAt`) are compound equality queries that may need Firestore composite indexes on a
fresh project, the same way Sprint 0's invite lookup did. If the manual smoke test
below throws `FAILED_PRECONDITION`, follow the console link in the error to create the
index (or create it manually: Firestore Console → Indexes → Composite).

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: PASS — 10 tests total (6 in `reconcile.test.ts`, 4 in `roster.test.ts`)

- [ ] **Step 2: Run the linter and typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run a production build**

Run: `npm run build`
Expected: build succeeds, `/lead` listed as a dynamic route

- [ ] **Step 4: Manual smoke test (requires a real engagement with a signed-in lead)**

Using an account already onboarded as an `engagementLead` (from Sprint 0's flow, or a
fresh admin-created engagement + invite):
1. Sign in as the lead, land on `/lead` — confirm the engagement name shows and the
   roster starts empty.
2. Invite an intern (name + email) — confirm a copyable link appears, and the roster
   now shows that email as **invited**.
3. Invite the *same* email again — confirm it does NOT create a second pending invite
   (the duplicate-invite guard returns the existing link) — check Firestore Console to
   confirm only one `invites` doc exists for that email.
4. Open the invite link in a private/incognito window — confirm it signs in and lands
   on `/intern`, and back on `/lead` (after a refresh) the roster now shows that
   person as **active**, not invited.
5. Click **Remove** on the active intern — confirm the row now shows **removed** (not
   hidden) and gets a **Reactivate** button. Confirm the removed intern, if they try to
   sign in again, gets denied (redirected to `/login` with no session created).
6. Click **Reactivate** — confirm the row goes back to **active**, and the intern can
   sign in again normally.
7. Invite a second intern, then click **Cancel** on their pending-invite row before
   they redeem it — confirm the row disappears and the invite link no longer works if
   visited.

- [ ] **Step 5: Final commit if any fixups were needed during manual testing**

```bash
git add -A
git commit -m "Fix issues found during Sprint 1 manual verification"
```

(Skip this step if no fixes were needed.)

---

## Self-Review Notes

- **Spec coverage:** `status` field + soft-remove ✓ (Task 1), deny-at-sign-in and
  deny-at-DAL ✓ (Task 2), Firestore rules extension ✓ (Task 3), roster showing
  invited/active/removed with removed staying visible ✓ (Task 4, 7), invite/remove/
  reactivate/cancel actions with per-engagement ownership checks ✓ (Task 5), duplicate-
  invite guard ✓ (Task 5's `inviteIntern`), no goal-assignment/no admin-facing rollup/
  no cross-engagement uniqueness check ✓ (none of these appear anywhere in the plan,
  matching the design doc's explicit scope trims).
- **Type consistency checked:** `RosterRow`/`RosterRowState` (Task 4) are used
  identically in `roster.ts` and `page.tsx` (Task 7) — no redefinition.
  `assertSameEngagement` (Task 5) is used consistently across all three call sites
  (`removeIntern`, `reactivateIntern`, `cancelInvite`) with the same argument order.
  `UserDoc.status` (Task 1) is read the same way (`=== "removed"`) in `dal.ts`,
  `actions.ts` (lib/auth), and `roster.ts`.
