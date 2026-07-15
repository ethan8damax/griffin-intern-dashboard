# Sprint 0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Firebase Auth (email/magic-link), the new multi-engagement Firestore
data model, and role-based access control, alongside today's dashboard which stays
untouched.

**Architecture:** Firebase Admin SDK on the server (new `firebase-admin` dependency)
handles invite-link generation, session-cookie issuance/verification, and all
Firestore reads/writes for the new `users`/`engagements`/`invites` collections. A
single Server Action (`completeSignIn`) reconciles every sign-in — first-time or
returning — against an invite, an admin allowlist, or an existing user doc, so there
is exactly one code path that can grant a role. Three new role-gated routes
(`/admin`, `/lead`, `/intern`) each call a `requireRole()` DAL helper that redirects
unauthenticated or wrong-role visitors to `/login`. No `proxy.ts` — enforcement lives
in the DAL, per the design doc.

**Tech Stack:** Next.js 16 App Router (Server Actions, Server Components), Firebase
Auth + Firestore (client SDK `firebase` already installed; adding `firebase-admin`
for the server), Vitest for unit tests (new — this is the first testable logic in the
app), TypeScript.

See design doc: `docs/superpowers/specs/2026-07-15-sprint-0-foundation-design.md`

---

## File Structure

New files:
- `src/lib/auth/types.ts` — shared `UserRole`, `UserDoc`, `EngagementDoc`, `InviteDoc` types
- `src/lib/auth/reconcile.ts` + `reconcile.test.ts` — pure sign-in resolution logic (the one unit-tested piece — no Firebase dependency, so no mocking needed)
- `src/lib/firebase-admin.ts` — Admin SDK singleton (`adminAuth`, `adminDb`)
- `src/lib/auth/session.ts` — session cookie create/read/clear
- `src/lib/auth/dal.ts` — `getCurrentUser()`, `requireRole()`
- `src/lib/auth/actions.ts` — `completeSignIn`, `signOutAction` Server Actions
- `src/app/login/page.tsx` — magic-link sign-in (send + complete)
- `src/app/admin/page.tsx`, `src/app/admin/actions.ts`, `src/app/admin/invite-lead-form.tsx`
- `src/app/lead/page.tsx` — placeholder
- `src/app/intern/page.tsx` — placeholder
- `vitest.config.ts`

Modified files:
- `src/lib/firebase.ts` — export `auth` alongside `db`
- `firestore.rules` — add rules for the three new collections
- `package.json` — add `firebase-admin`, `server-only`, `vitest`; add `test` script
- `CLAUDE.md` — document new env vars, the `test` command, and update the "Auth: none" shortcut note
- `.env.local` — add new server-side env vars (gitignored, not committed)

---

## Task 1: Install dependencies and configure Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install packages**

Run: `npm install firebase-admin server-only && npm install -D vitest`

- [ ] **Step 2: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 3: Create the Vitest config**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: Verify the test runner works with no tests yet**

Run: `npm run test`
Expected: `No test files found` (exit code may be non-zero — that's fine, Task 2 adds the first test)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "Add firebase-admin, server-only, and vitest dependencies"
```

---

## Task 2: Shared auth types

**Files:**
- Create: `src/lib/auth/types.ts`

- [ ] **Step 1: Write the types**

```ts
// src/lib/auth/types.ts
export type UserRole = "companyAdmin" | "engagementLead" | "intern";

export interface UserDoc {
  email: string;
  name: string;
  role: UserRole;
  engagementId?: string;
  createdAt: number;
}

export interface EngagementDoc {
  name: string;
  client: string;
  leadUserId: string;
  status: "active" | "archived";
  createdAt: number;
}

export interface InviteDoc {
  email: string;
  name: string;
  role: UserRole;
  engagementId?: string;
  createdAt: number;
  usedAt: number | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth/types.ts
git commit -m "Add shared auth/data-model types"
```

---

## Task 3: Sign-in reconciliation logic (TDD)

This is the one piece of security-critical logic worth unit testing directly: given
an email and whatever's already in Firestore, decide whether this sign-in is a
returning user, a first-time invite redemption, a first-time admin-allowlist match,
or denied. It's written as a pure function (no Firestore calls inside it) so it's
testable with plain objects — no emulator, no mocking.

**Files:**
- Create: `src/lib/auth/reconcile.test.ts`
- Create: `src/lib/auth/reconcile.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/auth/reconcile.test.ts
import { describe, expect, it } from "vitest";
import { resolveSignIn } from "./reconcile";

describe("resolveSignIn", () => {
  it("returns the existing user when a users/{uid} doc already exists", () => {
    const existingUser = {
      email: "grace@example.com",
      name: "Grace",
      role: "engagementLead" as const,
      createdAt: 1,
    };

    const result = resolveSignIn({
      email: "grace@example.com",
      existingUser,
      matchingInvite: null,
      allowedAdminEmails: [],
    });

    expect(result).toEqual({ kind: "existing", user: existingUser });
  });

  it("creates a user from a matching invite on first sign-in", () => {
    const result = resolveSignIn({
      email: "intern@example.com",
      existingUser: null,
      matchingInvite: {
        id: "invite-1",
        email: "intern@example.com",
        name: "New Intern",
        role: "intern",
        engagementId: "eng-1",
        createdAt: 1,
        usedAt: null,
      },
      allowedAdminEmails: [],
    });

    expect(result.kind).toBe("createFromInvite");
    if (result.kind !== "createFromInvite") throw new Error("unreachable");
    expect(result.user.role).toBe("intern");
    expect(result.user.engagementId).toBe("eng-1");
    expect(result.inviteId).toBe("invite-1");
  });

  it("creates a companyAdmin user for an allowlisted email with no invite", () => {
    const result = resolveSignIn({
      email: "ethan@example.com",
      existingUser: null,
      matchingInvite: null,
      allowedAdminEmails: ["ethan@example.com"],
    });

    expect(result.kind).toBe("createFromAdminAllowlist");
    if (result.kind !== "createFromAdminAllowlist") throw new Error("unreachable");
    expect(result.user.role).toBe("companyAdmin");
    expect(result.user.email).toBe("ethan@example.com");
  });

  it("denies sign-in when there is no existing user, invite, or allowlist match", () => {
    const result = resolveSignIn({
      email: "stranger@example.com",
      existingUser: null,
      matchingInvite: null,
      allowedAdminEmails: [],
    });

    expect(result).toEqual({ kind: "denied" });
  });

  it("prefers the existing user doc even if the email also matches an invite", () => {
    const existingUser = {
      email: "already@example.com",
      name: "Already Signed In Before",
      role: "intern" as const,
      createdAt: 1,
    };

    const result = resolveSignIn({
      email: "already@example.com",
      existingUser,
      matchingInvite: {
        id: "invite-2",
        email: "already@example.com",
        name: "Stale Invite",
        role: "engagementLead",
        createdAt: 1,
        usedAt: null,
      },
      allowedAdminEmails: [],
    });

    expect(result).toEqual({ kind: "existing", user: existingUser });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `Cannot find module './reconcile'` (or similar), since `reconcile.ts` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/auth/reconcile.ts
import type { InviteDoc, UserDoc, UserRole } from "./types";

export interface ReconcileInput {
  email: string;
  existingUser: UserDoc | null;
  matchingInvite: (InviteDoc & { id: string }) | null;
  allowedAdminEmails: string[];
}

export type ReconcileResult =
  | { kind: "existing"; user: UserDoc }
  | { kind: "createFromInvite"; user: UserDoc; inviteId: string }
  | { kind: "createFromAdminAllowlist"; user: UserDoc }
  | { kind: "denied" };

export function resolveSignIn(input: ReconcileInput): ReconcileResult {
  const { email, existingUser, matchingInvite, allowedAdminEmails } = input;

  if (existingUser) {
    return { kind: "existing", user: existingUser };
  }

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

  if (allowedAdminEmails.includes(email)) {
    const user: UserDoc = {
      email,
      name: email,
      role: "companyAdmin" as UserRole,
      createdAt: Date.now(),
    };
    return { kind: "createFromAdminAllowlist", user };
  }

  return { kind: "denied" };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test`
Expected: PASS — 5 tests passing in `src/lib/auth/reconcile.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/reconcile.ts src/lib/auth/reconcile.test.ts
git commit -m "Add sign-in reconciliation logic with unit tests"
```

---

## Task 4: Firebase Admin SDK setup

**Files:**
- Create: `src/lib/firebase-admin.ts`
- Modify: `src/lib/firebase.ts`
- Modify: `.env.local` (not committed — gitignored)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Export `auth` from the client Firebase module**

Modify `src/lib/firebase.ts`:

```ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
```

- [ ] **Step 2: Create the Admin SDK singleton**

```ts
// src/lib/firebase-admin.ts
import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length) return existing[0];

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const adminApp = getAdminApp();
export const adminAuth = getAuth(adminApp);

const firestoreInstance = getFirestore(adminApp);
firestoreInstance.settings({ ignoreUndefinedProperties: true });
export const adminDb = firestoreInstance;
```

**Note (added after Task 7 review):** `ignoreUndefinedProperties: true` is required
because `UserDoc.engagementId` is optional — when an invite has no engagement (e.g.
an admin-created invite with no `engagementId`), `resolveSignIn` sets that key to
`undefined`, and the Admin SDK's Firestore client throws on `undefined` field values
by default.

**Note (added after Task 11 — supersedes the eager-init code above):** eager
top-level initialization turned out to break more than a bad cold start — it made
`npm run build` itself fail whenever `FIREBASE_ADMIN_*` env vars are unset, because
Next.js's build-time route-data collection executes route module code even for fully
dynamic routes. `/admin` (Task 11) was the first page to import the Admin SDK
directly and surfaced this. Fixed by converting `adminAuth`/`adminDb` from eager
top-level exports into lazy accessor functions, each backed by a module-level cached
singleton that only initializes on first call:

```ts
import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length) return existing[0];

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

let cachedAuth: Auth | undefined;
export function getAdminAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(getAdminApp());
  }
  return cachedAuth;
}

let cachedDb: Firestore | undefined;
export function getAdminDb(): Firestore {
  if (!cachedDb) {
    cachedDb = getFirestore(getAdminApp());
    cachedDb.settings({ ignoreUndefinedProperties: true });
  }
  return cachedDb;
}
```

Every task below that reads `adminAuth.X`/`adminDb.X` as a plain import should be
read as `getAdminAuth().X`/`getAdminDb().X` (or a local `const` assigned from calling
those functions once at the top of a function, for call sites used many times) —
`src/lib/auth/session.ts`, `src/lib/auth/dal.ts`, `src/lib/auth/actions.ts`,
`src/app/admin/actions.ts`, and `src/app/admin/page.tsx` (and, going forward,
`src/app/lead/page.tsx` in Task 12) all use the lazy function form.

- [ ] **Step 3: Add new env var placeholders to `.env.local`**

Append to `.env.local` (this file is gitignored — do not commit it):

```
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
ALLOWED_ADMIN_EMAILS=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Fill in `FIREBASE_ADMIN_*` from a Firebase Console → Project Settings → Service
Accounts → "Generate new private key" JSON file (`project_id`, `client_email`,
`private_key`). Fill `ALLOWED_ADMIN_EMAILS` with a comma-separated list of the
bootstrap admin emails (lowercase).

- [ ] **Step 4: Document the new env vars in CLAUDE.md**

In `CLAUDE.md`, under `## Deployment`, change:

```
The `NEXT_PUBLIC_FIREBASE_*` env vars (see `.env.local`, gitignored) must also be set in the Vercel project settings — they aren't committed, so a fresh deploy has none of them until they're added there.
```

to:

```
The `NEXT_PUBLIC_FIREBASE_*` env vars, plus the server-only `FIREBASE_ADMIN_PROJECT_ID` / `FIREBASE_ADMIN_CLIENT_EMAIL` / `FIREBASE_ADMIN_PRIVATE_KEY` (a Firebase service-account key, used by `src/lib/firebase-admin.ts` for invite links and session cookies), `ALLOWED_ADMIN_EMAILS` (comma-separated bootstrap admins), and `NEXT_PUBLIC_APP_URL` (see `.env.local`, gitignored) must also be set in the Vercel project settings — they aren't committed, so a fresh deploy has none of them until they're added there.
```

- [ ] **Step 5: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds (the Admin SDK singleton isn't imported by any page yet, so this just confirms no syntax/type errors)

- [ ] **Step 6: Commit**

```bash
git add src/lib/firebase.ts src/lib/firebase-admin.ts CLAUDE.md
git commit -m "Add Firebase Admin SDK setup and document new env vars"
```

---

## Task 5: Session cookie helpers

**Files:**
- Create: `src/lib/auth/session.ts`

- [ ] **Step 1: Write the implementation**

```ts
// src/lib/auth/session.ts
import "server-only";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";

const SESSION_COOKIE_NAME = "session";
const SESSION_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createSession(idToken: string): Promise<void> {
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_EXPIRES_IN_MS,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_EXPIRES_IN_MS / 1000,
  });
}

export async function getSessionUid(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/session.ts
git commit -m "Add session cookie create/read/clear helpers"
```

---

## Task 6: Data Access Layer — `getCurrentUser` / `requireRole`

**Files:**
- Create: `src/lib/auth/dal.ts`

- [ ] **Step 1: Write the implementation**

```ts
// src/lib/auth/dal.ts
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUid } from "@/lib/auth/session";
import type { UserDoc, UserRole } from "@/lib/auth/types";

export const getCurrentUser = cache(
  async (): Promise<(UserDoc & { uid: string }) | null> => {
    const uid = await getSessionUid();
    if (!uid) return null;

    const snapshot = await adminDb.collection("users").doc(uid).get();
    if (!snapshot.exists) return null;

    return { uid, ...(snapshot.data() as UserDoc) };
  }
);

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

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/dal.ts
git commit -m "Add auth DAL: getCurrentUser and requireRole"
```

---

## Task 7: Sign-in completion and sign-out Server Actions

**Files:**
- Create: `src/lib/auth/actions.ts`

- [ ] **Step 1: Write the implementation**

```ts
// src/lib/auth/actions.ts
"use server";

import { redirect } from "next/navigation";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { createSession, clearSession } from "@/lib/auth/session";
import { resolveSignIn } from "@/lib/auth/reconcile";
import type { InviteDoc, UserDoc, UserRole } from "@/lib/auth/types";

function allowedAdminEmails(): string[] {
  return (process.env.ALLOWED_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function roleHomePath(role: UserRole): string {
  if (role === "companyAdmin") return "/admin";
  if (role === "engagementLead") return "/lead";
  return "/intern";
}

export async function completeSignIn(idToken: string): Promise<void> {
  const decodedToken = await adminAuth.verifyIdToken(idToken);
  const uid = decodedToken.uid;
  const email = decodedToken.email;
  if (!email) {
    throw new Error("Sign-in did not return an email address.");
  }

  const normalizedEmail = email.toLowerCase();
  const userRef = adminDb.collection("users").doc(uid);
  const userSnapshot = await userRef.get();
  const existingUser = userSnapshot.exists
    ? (userSnapshot.data() as UserDoc)
    : null;

  const inviteQuery = await adminDb
    .collection("invites")
    .where("email", "==", normalizedEmail)
    .where("usedAt", "==", null)
    .limit(1)
    .get();
  const matchingInvite = inviteQuery.empty
    ? null
    : {
        id: inviteQuery.docs[0].id,
        ...(inviteQuery.docs[0].data() as InviteDoc),
      };

  const result = resolveSignIn({
    email: normalizedEmail,
    existingUser,
    matchingInvite,
    allowedAdminEmails: allowedAdminEmails(),
  });

  if (result.kind === "denied") {
    throw new Error("No account found for this email. Contact your admin.");
  }

  if (result.kind === "createFromInvite") {
    await userRef.set(result.user);
    await adminDb
      .collection("invites")
      .doc(result.inviteId)
      .update({ usedAt: Date.now() });

    if (result.user.role === "engagementLead" && result.user.engagementId) {
      await adminDb
        .collection("engagements")
        .doc(result.user.engagementId)
        .update({ leadUserId: uid });
    }
  } else if (result.kind === "createFromAdminAllowlist") {
    await userRef.set(result.user);
  }

  await createSession(idToken);
  redirect(roleHomePath(result.user.role));
}

export async function signOutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}
```

**Note (added after review):** `completeSignIn` takes only `idToken` and derives
`uid`/`email` from `adminAuth.verifyIdToken(idToken)` — it must NOT take `uid`/`email`
as separate trusted parameters. Server Actions are reachable as direct POST
endpoints, not gated by the client UI that calls them; a version that trusted
caller-supplied `uid`/`email` would let anyone who completes sign-in for their own
address invoke this action with a *different*, allowlisted-admin email string and get
back a `companyAdmin` user doc bound to their own (valid) session — a full auth
bypass. Deriving both fields from the verified token closes that off.

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/actions.ts
git commit -m "Add completeSignIn and signOutAction server actions"
```

---

## Task 8: `/login` page

**Files:**
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: Write the implementation**

```tsx
// src/app/login/page.tsx
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { unstable_rethrow } from "next/navigation";
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { completeSignIn } from "@/lib/auth/actions";

const EMAIL_STORAGE_KEY = "griffin-signin-email";

type Status = "idle" | "sent" | "completing" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    let storedEmail = window.localStorage.getItem(EMAIL_STORAGE_KEY);
    if (!storedEmail) {
      storedEmail = window.prompt("Confirm your email to finish signing in");
    }
    if (!storedEmail) return;

    async function completeLinkSignIn(emailForLink: string) {
      setStatus("completing");
      try {
        const credential = await signInWithEmailLink(
          auth,
          emailForLink,
          window.location.href
        );
        window.localStorage.removeItem(EMAIL_STORAGE_KEY);
        const idToken = await credential.user.getIdToken();
        await completeSignIn(idToken);
      } catch (error) {
        // completeSignIn() ends with redirect(), which Next.js signals by
        // rejecting this promise with a special "NEXT_REDIRECT" error meant
        // for its own RedirectBoundary — rethrow it unchanged so navigation
        // still happens, instead of treating a successful sign-in as a
        // visible error.
        unstable_rethrow(error);
        setStatus("error");
        setErrorMessage((error as Error).message);
      }
    }

    completeLinkSignIn(storedEmail);
  }, []);

  async function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    try {
      await sendSignInLinkToEmail(auth, email, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true,
      });
      window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
      setStatus("sent");
    } catch (error) {
      setStatus("error");
      setErrorMessage((error as Error).message);
    }
  }

  if (status === "completing") {
    return <p>Signing you in…</p>;
  }

  if (status === "sent") {
    return <p>Check your email for a sign-in link.</p>;
  }

  return (
    <main>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(inputEvent) => setEmail(inputEvent.target.value)}
        />
        <button type="submit">Send sign-in link</button>
        {status === "error" && <p role="alert">{errorMessage}</p>}
      </form>
    </main>
  );
}
```

**Note (added after review):** the original draft of this page wrapped
`completeSignIn(idToken)` in a `.then/.catch` that treated ANY rejection as a login
failure. But `completeSignIn` ends with `redirect(...)`, and Next.js signals a Server
Action redirect to the client by *rejecting* the action's promise with a
`NEXT_REDIRECT`-tagged error (meant for Next's own `RedirectBoundary`, confirmed in
`node_modules/next/dist/client/components/router-reducer/reducers/server-action-reducer.js`
around the `redirectLocation !== undefined` branch) — so the original code caught
that on every *successful* sign-in and rendered it as a visible error. The fix wraps
the flow in `try/catch` and calls `unstable_rethrow(error)` (from `next/navigation`)
first, which re-throws redirect/not-found errors unchanged and does nothing for any
other error — only genuine failures (bad link, `completeSignIn` throwing "No account
found...", etc.) reach `setStatus("error")`. `handleSubmit` also gained a `try/catch`
for the same class of gap: an unhandled `sendSignInLinkToEmail` rejection previously
failed the form silently with no user-visible feedback.

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "Add /login page with magic-link send and completion"
```

---

## Task 9: Firestore security rules for the new collections

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Update the rules file**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /dashboard/{docId} {
      allow read, write: if true;
    }

    // All reads/writes to the collections below normally happen server-side via
    // the Firebase Admin SDK, which bypasses these rules entirely. The rules here
    // are a defense-in-depth backstop against a client ever calling Firestore
    // directly with a signed-in user's credentials.

    match /users/{uid} {
      allow read: if request.auth != null &&
        (request.auth.uid == uid ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "companyAdmin");
      allow write: if false;
    }

    match /engagements/{engagementId} {
      allow read: if request.auth != null &&
        (resource.data.leadUserId == request.auth.uid ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "companyAdmin");
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "companyAdmin";
    }

    match /invites/{inviteId} {
      allow read, write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "companyAdmin";
    }
  }
}
```

- [ ] **Step 2: Deploy the updated rules**

Run: `firebase deploy --only firestore:rules`
Expected: `✔ Deploy complete!`

(Requires the Firebase CLI to be logged in and the project linked — if it isn't set
up locally, paste the rules into Firebase Console → Firestore Database → Rules
instead, and note that in the PR description.)

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "Add Firestore security rules for users/engagements/invites"
```

**Note (added after Task 7 review):** the invite lookup in `completeSignIn`
(`.where("email", "==", ...).where("usedAt", "==", null)`) is a compound query that
requires a Firestore composite index. On a fresh Firestore project, the first real
invite redemption will throw `FAILED_PRECONDITION` with a console link to create the
index — that's expected, not a bug. Create the index via that link (or manually:
Firestore Console → Indexes → Composite → collection `invites`, fields `email`
Ascending + `usedAt` Ascending) before relying on the invite flow. Task 14's manual
smoke test is where this will surface if it hasn't been created yet.

---

## Task 10: Admin Server Actions — create engagement, create invite

**Files:**
- Create: `src/app/admin/actions.ts`

- [ ] **Step 1: Write the implementation**

```ts
// src/app/admin/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import type { EngagementDoc, InviteDoc } from "@/lib/auth/types";

export async function createEngagement(formData: FormData): Promise<void> {
  await requireRole("companyAdmin");

  const name = String(formData.get("name") ?? "").trim();
  const client = String(formData.get("client") ?? "").trim();
  if (!name || !client) {
    throw new Error("Engagement name and client are required.");
  }

  const engagement: EngagementDoc = {
    name,
    client,
    leadUserId: "",
    status: "active",
    createdAt: Date.now(),
  };
  await adminDb.collection("engagements").add(engagement);
  revalidatePath("/admin");
}

export async function createInvite(
  formData: FormData
): Promise<{ link: string }> {
  await requireRole("companyAdmin");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const engagementId = String(formData.get("engagementId") ?? "").trim();
  if (!email || !name || !engagementId) {
    throw new Error("Name, email, and engagement are required.");
  }

  const engagementSnapshot = await adminDb
    .collection("engagements")
    .doc(engagementId)
    .get();
  if (!engagementSnapshot.exists) {
    throw new Error("That engagement no longer exists.");
  }

  const invite: InviteDoc = {
    email,
    name,
    role: "engagementLead",
    engagementId,
    createdAt: Date.now(),
    usedAt: null,
  };
  await adminDb.collection("invites").add(invite);

  const link = await adminAuth.generateSignInWithEmailLink(email, {
    url: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
    handleCodeInApp: true,
  });

  revalidatePath("/admin");
  return { link };
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/actions.ts
git commit -m "Add admin server actions: createEngagement, createInvite"
```

---

## Task 11: `/admin` page

**Files:**
- Create: `src/app/admin/invite-lead-form.tsx`
- Create: `src/app/admin/page.tsx`

- [ ] **Step 1: Write the invite form (client component — needs to display the returned link)**

```tsx
// src/app/admin/invite-lead-form.tsx
"use client";

import { useState, type FormEvent } from "react";
import { createInvite } from "./actions";

interface EngagementOption {
  id: string;
  name: string;
}

export function InviteLeadForm({
  engagements,
}: {
  engagements: EngagementOption[];
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [engagementId, setEngagementId] = useState(engagements[0]?.id ?? "");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    setError("");
    setLink(null);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("email", email);
    formData.set("engagementId", engagementId);

    try {
      const result = await createInvite(formData);
      setLink(result.link);
      setName("");
      setEmail("");
    } catch (submitError) {
      setError((submitError as Error).message);
    }
  }

  if (engagements.length === 0) {
    return <p>Create an engagement first before inviting a lead.</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="lead-name">Name</label>
      <input
        id="lead-name"
        value={name}
        onChange={(inputEvent) => setName(inputEvent.target.value)}
        required
      />

      <label htmlFor="lead-email">Email</label>
      <input
        id="lead-email"
        type="email"
        value={email}
        onChange={(inputEvent) => setEmail(inputEvent.target.value)}
        required
      />

      <label htmlFor="lead-engagement">Engagement</label>
      <select
        id="lead-engagement"
        value={engagementId}
        onChange={(inputEvent) => setEngagementId(inputEvent.target.value)}
        required
      >
        {engagements.map((engagement) => (
          <option key={engagement.id} value={engagement.id}>
            {engagement.name}
          </option>
        ))}
      </select>

      <button type="submit">Create invite</button>
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

- [ ] **Step 2: Write the page (server component)**

```tsx
// src/app/admin/page.tsx
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { signOutAction } from "@/lib/auth/actions";
import { createEngagement } from "./actions";
import { InviteLeadForm } from "./invite-lead-form";
import type { EngagementDoc } from "@/lib/auth/types";

export default async function AdminPage() {
  const user = await requireRole("companyAdmin");

  const engagementsSnapshot = await adminDb.collection("engagements").get();
  const engagements = engagementsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as EngagementDoc),
  }));

  return (
    <main>
      <p>Signed in as {user.email} (Company Admin)</p>
      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>

      <h1>Engagements</h1>
      <ul>
        {engagements.map((engagement) => (
          <li key={engagement.id}>
            {engagement.name} ({engagement.client}) —{" "}
            {engagement.leadUserId ? "lead assigned" : "no lead yet"}
          </li>
        ))}
      </ul>

      <h2>Create engagement</h2>
      <form action={createEngagement}>
        <label htmlFor="name">Name</label>
        <input id="name" name="name" required />

        <label htmlFor="client">Client</label>
        <input id="client" name="client" required />

        <button type="submit">Create</button>
      </form>

      <h2>Invite an engagement lead</h2>
      <InviteLeadForm
        engagements={engagements.map(({ id, name }) => ({ id, name }))}
      />
    </main>
  );
}
```

- [ ] **Step 3: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx src/app/admin/invite-lead-form.tsx
git commit -m "Add /admin page: engagement list, create engagement, invite lead"
```

---

## Task 12: `/lead` and `/intern` placeholder pages

**Files:**
- Create: `src/app/lead/page.tsx`
- Create: `src/app/intern/page.tsx`

- [ ] **Step 1: Write the lead placeholder**

```tsx
// src/app/lead/page.tsx
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { signOutAction } from "@/lib/auth/actions";
import type { EngagementDoc } from "@/lib/auth/types";

export default async function LeadPage() {
  const user = await requireRole("engagementLead");

  let engagementName = "your engagement";
  if (user.engagementId) {
    const engagementSnapshot = await adminDb
      .collection("engagements")
      .doc(user.engagementId)
      .get();
    if (engagementSnapshot.exists) {
      engagementName = (engagementSnapshot.data() as EngagementDoc).name;
    }
  }

  return (
    <main>
      <p>Signed in as {user.email} (Engagement Lead)</p>
      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>

      <h1>{engagementName}</h1>
      <p>Intern management is coming in Sprint 1.</p>
    </main>
  );
}
```

- [ ] **Step 2: Write the intern placeholder**

```tsx
// src/app/intern/page.tsx
import { requireRole } from "@/lib/auth/dal";
import { signOutAction } from "@/lib/auth/actions";

export default async function InternPage() {
  const user = await requireRole("intern");

  return (
    <main>
      <p>Signed in as {user.email} (Intern)</p>
      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>

      <p>You&apos;re signed in as an intern. Nothing here yet.</p>
    </main>
  );
}
```

- [ ] **Step 3: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/lead/page.tsx src/app/intern/page.tsx
git commit -m "Add /lead and /intern placeholder pages"
```

---

## Task 13: Update CLAUDE.md's "Auth: none" shortcut note

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Known shortcuts section**

In `CLAUDE.md`, change the `**Auth**:` bullet under `## Known shortcuts / upgrade path`
from:

```
- **Auth**: none. Firestore security rules (`firestore.rules`) allow public read/write on the `dashboard` collection, matching the no-login review-link flow. Upgrade path: Firebase Auth (email/magic-link) for Grace/Ethan, rules scoped to signed-in users, once the dashboard needs to stop being fully public-by-URL.
```

to:

```
- **Auth**: split by route. Today's dashboard (`/`, the `dashboard/main` blob) is still fully public, no login — unchanged. `/admin`, `/lead`, and `/intern` (Sprint 0, new) sit behind real Firebase Auth (email/magic-link), with roles (`companyAdmin` | `engagementLead` | `intern`) stored in `users/{uid}` and enforced server-side via `requireRole()` (`src/lib/auth/dal.ts`) on every protected page. Accounts aren't self-service signup — an admin/lead pre-creates an `invites/{id}` doc (name/email/role) and hands the person a one-time sign-in link generated via the Firebase Admin SDK; after that, return sign-ins are self-serve via `/login`. The two bootstrap admins are listed in the `ALLOWED_ADMIN_EMAILS` env var. Sprint 3 is what migrates the old public dashboard's data model onto this new per-engagement structure — until then the two systems coexist untouched.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Update CLAUDE.md auth shortcut note for Sprint 0 auth"
```

---

## Task 14: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: PASS — all 5 tests in `reconcile.test.ts` passing

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 3: Run a production build**

Run: `npm run build`
Expected: build succeeds, all routes (`/`, `/login`, `/admin`, `/lead`, `/intern`) listed in the output

- [ ] **Step 4: Manual smoke test (requires real Firebase project + `.env.local` filled in)**

Run: `npm run dev`, then in a browser:
1. Visit `/admin` while signed out → redirected to `/login`.
2. On `/login`, enter one of the `ALLOWED_ADMIN_EMAILS` addresses → check email → click
   the link → land on `/admin` signed in as Company Admin.
3. Create an engagement, then create an invite for a lead email you control → copy
   the invite link → open it in a private/incognito window.
4. Confirm the invite link signs the lead in directly and lands on `/lead`, showing
   the engagement name.
5. Sign out from `/lead` → go to `/login` → sign in again with the same lead email →
   confirm it goes straight back to `/lead` (return sign-in path, no new invite
   needed).
6. Confirm `/` (today's dashboard) still loads with no login prompt at all.

- [ ] **Step 5: Final commit if any fixups were needed during manual testing**

```bash
git add -A
git commit -m "Fix issues found during Sprint 0 manual verification"
```

(Skip this step if no fixes were needed.)

---

## Self-Review Notes

- **Spec coverage:** data model ✓ (Task 2), bootstrap allowlist ✓ (Task 7), invite
  flow ✓ (Tasks 10–11), return sign-in ✓ (Task 8), reconciliation single-path
  guarantee ✓ (Task 7 routes both invite and allowlist through `resolveSignIn`),
  routes/pages ✓ (Tasks 8, 11, 12), no `proxy.ts` ✓ (enforcement is `requireRole()`
  only, Task 6), Firebase session cookie not custom JWT ✓ (Task 5), Firestore rules
  ✓ (Task 9), old dashboard untouched ✓ (no task modifies `src/components/` or
  `src/app/page.tsx`), Sprint 1 handoff note ✓ (Task 12's `/lead` placeholder text
  + this plan's file structure section).
- **Type consistency checked:** `UserRole`/`UserDoc`/`EngagementDoc`/`InviteDoc`
  (Task 2) are the only types used across `reconcile.ts`, `dal.ts`, `actions.ts`,
  and both admin/lead/intern pages — no redefinitions.
- **Deliberately deferred, not forgotten:** automated Firestore rules testing (e.g.
  via the Firebase emulator + `@firebase/rules-unit-testing`) is out of scope for
  this plan — the rules are a defense-in-depth backstop since all real reads/writes
  go through the Admin SDK (Task 9's comment documents this). Add emulator-based
  rule tests later if client-side Firestore access to these collections is ever
  introduced.
