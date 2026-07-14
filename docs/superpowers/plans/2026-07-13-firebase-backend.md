# Firebase Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `localStorage` persistence in the Intern Dashboard with a shared Firestore document, so no dashboard data lives only in the browser.

**Architecture:** One Firebase project (`griffin-17f70`, already provisioned), one Firestore document (`dashboard/main`) holding the whole `AppState`. The React component fetches that document on load and overwrites it (debounced) on every change, replacing the two `localStorage` `useEffect`s currently in `intern-dashboard.tsx`. No auth, no realtime — refetch-on-load only, per the approved design spec at `docs/superpowers/specs/2026-07-13-firebase-backend-design.md`.

**Tech Stack:** Firebase (Firestore + the modular `firebase` JS SDK), Next.js 16 / React 19 (existing).

**Note on verification:** This project has no test runner configured (no Jest/Vitest — only ESLint). Verification here uses the `firebase` CLI (`firestore:...` commands) to check the database layer, and manual dev-server + browser checks for the UI layer, matching this repo's existing testing posture (see `CLAUDE.md`).

**Already done (provisioning, completed inline before this doc was finalized):**
- Created Firebase project `griffin-17f70` (Spark/free plan) — done by the user via `firebase projects:create`.
- Enabled the Cloud Firestore API on that project (manual step in Google Cloud console — no CLI/API path available).
- Created the default Firestore database in location `nam5`: `firebase firestore:databases:create '(default)' --project griffin-17f70 --location nam5`.
- Registered a Web app: `firebase apps:create WEB "Griffin Intern Dashboard" --project griffin-17f70` → App ID `1:183217463426:web:3c5f423ae115f04615149b`.
- Pulled its config via `firebase apps:sdkconfig WEB <app-id> --project griffin-17f70` (apiKey, authDomain, etc. — used in Task 2, Step 2 below).

---

### Task 1: Wire up the Firebase CLI project config and security rules

**Files:**
- Create: `.firebaserc`
- Create: `firebase.json`
- Create: `firestore.rules`

- [ ] **Step 1: Write `.firebaserc`**

```json
{
  "projects": {
    "default": "griffin-17f70"
  }
}
```

- [ ] **Step 2: Write `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /dashboard/{docId} {
      allow read, write: if true;
    }
  }
}
```

This intentionally allows public read/write on the `dashboard` collection only — matching the "no login" decision in the design spec. Every other path in the database is denied by default (Firestore rules are deny-by-default outside matched paths).

- [ ] **Step 3: Write `firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

- [ ] **Step 4: Deploy the rules**

Run: `npx --yes firebase-tools deploy --only firestore:rules --project griffin-17f70`
Expected: `✔ Deploy complete!` with no errors.

- [ ] **Step 5: Commit**

```bash
git add .firebaserc firebase.json firestore.rules
git commit -m "Add Firebase project config and Firestore security rules"
```

---

### Task 2: Add the Firebase client

**Files:**
- Modify: `package.json`
- Create: `.env.local`
- Create: `src/lib/firebase.ts`

- [ ] **Step 1: Install the dependency**

Run: `npm install firebase`
Expected: `package.json` gains a `"firebase"` entry under `dependencies`.

- [ ] **Step 2: Write the env file**

Create `.env.local` (already covered by the repo's `.env*` gitignore rule):

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyA55h77UXyMMIFz619NnB127xOruPs6EoU
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=griffin-17f70.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=griffin-17f70
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=griffin-17f70.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=183217463426
NEXT_PUBLIC_FIREBASE_APP_ID=1:183217463426:web:3c5f423ae115f04615149b
```

- [ ] **Step 3: Write the client**

Create `src/lib/firebase.ts`:

```ts
import { initializeApp, getApps, getApp } from "firebase/app";
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
```

`getApps().length ? getApp() : initializeApp(...)` avoids Next.js's hot-reload re-invoking `initializeApp` on an already-initialized app, which otherwise throws in dev.

- [ ] **Step 4: Verify it compiles**

Run: `npm run build`
Expected: build succeeds (this file isn't imported anywhere yet, so this just checks for syntax/type errors in isolation — full wiring is verified in Task 4).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/firebase.ts
git commit -m "Add Firebase client dependency"
```

(`.env.local` is gitignored and intentionally not committed.)

---

### Task 3: Replace the localStorage key constant

**Files:**
- Modify: `src/lib/dashboard-data.ts:300`

- [ ] **Step 1: Replace the constant**

In `src/lib/dashboard-data.ts`, replace the last line:

```ts
export const STORAGE_KEY = "griffin-intern-dashboard-v1";
```

with:

```ts
export const DASHBOARD_DOC_ID = "main";
```

- [ ] **Step 2: Verify no other references remain**

Run: `grep -rn "STORAGE_KEY" src/`
Expected: no output (the only usage is in `intern-dashboard.tsx`, replaced in Task 4).

- [ ] **Step 3: Commit**

This is a one-line change that will break the build until Task 4 updates its only caller — commit it together with Task 4 instead of alone. Skip committing here; proceed directly to Task 4.

---

### Task 4: Wire the dashboard component to Firestore

**Files:**
- Modify: `src/components/intern-dashboard.tsx:1-22` (imports)
- Modify: `src/components/intern-dashboard.tsx:115-137` (state + load/save effects)
- Modify: `src/components/intern-dashboard.tsx:259-262` (header, add save-status indicator)

- [ ] **Step 1: Update imports**

Replace:

```ts
import {
  type AppState,
  type Period,
  type Status,
  type QuestionType,
  type JournalType,
  type WorkStatus,
  type JiraStatus,
  type Review,
  MONTH_NAMES,
  STATUS_META,
  JOURNAL_TAG_META,
  JIRA_ISSUE_STATUS_META,
  NAV_TABS,
  freshDraftQuestions,
  initialState,
  STORAGE_KEY,
} from "@/lib/dashboard-data";
```

with:

```ts
import {
  type AppState,
  type Period,
  type Status,
  type QuestionType,
  type JournalType,
  type WorkStatus,
  type JiraStatus,
  type Review,
  MONTH_NAMES,
  STATUS_META,
  JOURNAL_TAG_META,
  JIRA_ISSUE_STATUS_META,
  NAV_TABS,
  freshDraftQuestions,
  initialState,
  DASHBOARD_DOC_ID,
} from "@/lib/dashboard-data";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
```

- [ ] **Step 2: Replace the state/load/save effects**

Replace:

```ts
  const [state, setState] = useState<AppState>(() => initialState());
  const [loaded, setLoaded] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw) as AppState);
    } catch {
      // ponytail: corrupt/missing local storage just falls back to seed data
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ponytail: storage full/unavailable — edits still work in-memory for the session
    }
  }, [state, loaded]);
```

with:

```ts
  const [state, setState] = useState<AppState>(() => initialState());
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const searchParams = useSearchParams();

  const dashboardDocRef = doc(db, "dashboard", DASHBOARD_DOC_ID);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const snap = await getDoc(dashboardDocRef);
        if (cancelled) return;
        if (snap.exists()) {
          setState(snap.data() as AppState);
        } else {
          const seed = initialState();
          await setDoc(dashboardDocRef, seed);
          setState(seed);
        }
        setLoaded(true);
      } catch (err) {
        if (cancelled) return;
        // Do NOT setLoaded(true) here: the save effect only runs once
        // loaded, and this component's state still holds the initialState()
        // seed data. Enabling saves now would overwrite whatever real
        // document already exists in Firestore. Leaving loaded=false keeps
        // the user on read-only seed data until a page reload retries.
        console.error("Failed to load dashboard state", err);
        setSaveStatus("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveStatus("saving");
    const timeout = setTimeout(async () => {
      try {
        await setDoc(dashboardDocRef, state);
        setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to save dashboard state", err);
        setSaveStatus("error");
      }
    }, 500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, loaded]);
```

- [ ] **Step 3: Add the save-status indicator to the header**

Replace:

```tsx
          <div onClick={exportFullPdf} style={{ padding: "8px 14px", border: "1px solid oklch(0.4 0.03 258)", borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: "white", cursor: "pointer", whiteSpace: "nowrap" }}>
            Export full internship PDF
          </div>
```

with:

```tsx
          <div style={{ fontSize: 11.5, color: saveStatus === "error" ? "oklch(0.75 0.16 25)" : "oklch(0.78 0.02 258)", whiteSpace: "nowrap" }}>
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved"}
            {saveStatus === "error" && "Save failed — check connection"}
          </div>
          <div onClick={exportFullPdf} style={{ padding: "8px 14px", border: "1px solid oklch(0.4 0.03 258)", borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: "white", cursor: "pointer", whiteSpace: "nowrap" }}>
            Export full internship PDF
          </div>
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds, no TypeScript errors, no references to `STORAGE_KEY` remain.

- [ ] **Step 5: Verify in the browser**

Run: `npm run dev`, open `http://localhost:3000`. Confirm:
- The seed data loads (Scorecard tab shows the existing rows).
- The header briefly shows "Saving…" then "Saved" after editing a field (e.g. type in a scorecard Notes cell and blur it).
- Reload the page — the edit persists (proves it round-tripped through Firestore, not localStorage).

Then confirm via `npx --yes firebase-tools firestore:documents:get 'dashboard/main' --project griffin-17f70` (or the Firestore console at the URL printed when the database was created) that the document contains the edited value.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dashboard-data.ts src/components/intern-dashboard.tsx
git commit -m "Replace localStorage persistence with Firestore"
```

---

### Task 5: Update project docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Stack section**

Replace:

```markdown
- No backend yet. All state lives in one `useState<AppState>` in `src/components/intern-dashboard.tsx` and is persisted to `localStorage` (`griffin-intern-dashboard-v1`). This is a deliberate shortcut — see `ponytail:` comments in that file.
```

with:

```markdown
- Firebase (Firestore) backend. All state lives in one `useState<AppState>` in `src/components/intern-dashboard.tsx`, fetched on load and overwritten (debounced ~500ms) into a single `dashboard/main` document via `src/lib/firebase.ts`. No auth — see the "Known shortcuts" section below.
```

- [ ] **Step 2: Update the Known shortcuts section**

Replace:

```markdown
- **Persistence**: localStorage only — single browser, single device, no real multi-user sharing. Upgrade path: Supabase (Postgres + row-level auth), swap the two `localStorage` `useEffect`s in `intern-dashboard.tsx` for reads/writes against a `dashboard_state` table.
```

with:

```markdown
- **Persistence**: one shared `dashboard/main` document (single JSON blob) in Firestore — no per-user documents, no history/versioning. Fine for the current 2-4 known users; if usage grows, split into real collections once querying individual fields (not just the whole blob) actually matters.
- **Auth**: none. Firestore security rules (`firestore.rules`) allow public read/write on the `dashboard` collection, matching the no-login review-link flow. Upgrade path: Firebase Auth (email/magic-link) for Grace/Ethan, rules scoped to signed-in users, once the dashboard needs to stop being fully public-by-URL.
- **Sync**: refetch-on-page-load only, no realtime listener (`onSnapshot`). Two tabs open at once means last-write-wins with no merge. Upgrade path: an `onSnapshot` subscription on `dashboard/main` if concurrent editing becomes common.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Document Firebase persistence in CLAUDE.md"
```

---

### Task 6: End-to-end verification

**Files:** none

- [ ] **Step 1: Verify the review-link flow still works**

With `npm run dev` running, open `http://localhost:3000?review=demo5678` (the seeded pending review). Confirm:
- The bare review form renders (no header/nav).
- Submitting a score/text response and clicking "Submit review" shows the "Thanks — your response was recorded" state.
- Reload the same URL — the submitted state persists (fetched from Firestore, not localStorage).

- [ ] **Step 2: Verify a second browser session sees the same data**

Open the app in a second browser (or a private/incognito window) at `http://localhost:3000`. Confirm it shows the same edited state from Task 4/Step 5 and Step 1 above — proving the data is now actually shared, not per-browser.

- [ ] **Step 3: Run the linter**

Run: `npm run lint`
Expected: no errors.
