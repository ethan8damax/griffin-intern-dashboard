# Firebase backend for the Intern Dashboard

## Problem

All dashboard state currently lives in one `useState<AppState>` in
`src/components/intern-dashboard.tsx`, persisted only to the browser's
`localStorage` (`griffin-intern-dashboard-v1`). This means:

- No data survives a browser change, device change, or cleared storage.
- Grace and Ethan each see their own separate copy — there is no actual
  sharing today, despite this being a two-person tool.

Goal: move persistence to Firebase (Firestore) so no dashboard data lives
only in the frontend, while keeping the app exactly as frictionless as it
is today (no login, no new UI chrome beyond a small save-status
indicator).

## Decisions

Resolved with the user before writing this spec (originally scoped against
Supabase; provider changed to Firebase afterward — the underlying
decisions are unchanged):

- **No auth.** Stays a no-login internal tool, same exposure model as
  today's shareable review link — anyone with the URL can read/write.
- **Single JSON blob**, not normalized collections. Mirrors the existing
  `AppState` shape, so the tab components' read/update functions don't
  change.
- **Refetch-on-load only**, no realtime sync (no `onSnapshot` listener).
  Two tabs open at once is a rare case for a 2-person tool; last write
  wins, no merge logic.
- **Firebase over Supabase**: switched mid-implementation because the
  user's Supabase org had hit its free-project limit (2 active free
  projects already in use) and creating a new org wasn't scriptable via
  the available tooling. Firebase's free (Spark) tier has no such
  organization-level cap.

## Data model

Firestore is a document store, not relational — a single JSON blob maps
directly onto a single document, even more directly than the Postgres
JSONB-column version of this spec did.

- Collection: `dashboard`
- Document ID: `main` (the one and only document this app ever reads/writes)
- Document body: the entire `AppState` object, stored as-is (Firestore
  documents natively support nested objects/arrays; the 1 MiB per-document
  limit is far above what this app's data will ever reach).

No schema/migration step is needed — Firestore collections and documents
are created implicitly on first write.

## Security

Firestore Security Rules (not Postgres RLS) gate access. Matching the "no
auth" decision, rules allow public read/write to the `dashboard`
collection only:

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

This is real public read/write access, matching the "no login" decision —
it is not an oversight, and is scoped to this one collection only.

## Client wiring

- New dependency: `firebase` (the modular v9+ JS SDK — `firebase/app` +
  `firebase/firestore`).
- New `src/lib/firebase.ts`: initializes the Firebase app from
  `NEXT_PUBLIC_FIREBASE_*` env vars and exports a singleton Firestore
  `db` instance.
- In `src/components/intern-dashboard.tsx`, replace the two `localStorage`
  `useEffect`s:
  - **Load** (on mount): `getDoc(doc(db, "dashboard", DASHBOARD_DOC_ID))`.
    If it doesn't exist, `setDoc` the seed state. `setState(...)`, then
    `setLoaded(true)`.
  - **Save** (on `[state, loaded]` change): debounce ~500ms, then
    `setDoc(doc(db, "dashboard", DASHBOARD_DOC_ID), state)` — a full
    overwrite of the document, matching the "single blob" model (no
    partial `updateDoc` merging needed since the client always holds
    the complete state).
- `STORAGE_KEY` / `localStorage` usage is removed entirely — no dual-write,
  no migration-from-localStorage step (there's no real data in it worth
  preserving beyond the seed demo data).

## Save status + error handling

A small text indicator in the header: `Saving…` / `Saved` / `Save failed —
check connection`. On failure, the in-memory state is untouched and the
next edit retries the save. On a failed *load*, saves stay disabled
(rather than risk overwriting a real document with fresh seed data) until
a page reload succeeds. No offline queue, no retry/backoff beyond that.

## Out of scope / unchanged

- No auth, no realtime listeners, no state history/versioning, no
  normalized collections.
- Jira sync tab stays fully mocked, as documented in the Reference tab UI.
- The standalone review flow (`?review=<token>`) is unchanged in behavior —
  it reads/writes the same shared document, same as every other tab.

## Provisioning

A new Firebase project (Spark/free plan) is created via the `firebase`
CLI, which requires an interactive `firebase login` the user runs
themselves (no MCP integration or non-interactive auth path is available
for Firebase, unlike Supabase). Firestore is enabled in Native mode.

## Files touched

- `src/lib/firebase.ts` — new, Firebase app + Firestore client.
- `src/lib/dashboard-data.ts` — drop `STORAGE_KEY`, add
  `DASHBOARD_DOC_ID = "main"`.
- `src/components/intern-dashboard.tsx` — replace localStorage load/save
  effects with Firestore fetch/set + save-status state.
- `package.json` — add `firebase`.
- `.env.local` (gitignored) — `NEXT_PUBLIC_FIREBASE_API_KEY`,
  `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
  `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`,
  `NEXT_PUBLIC_FIREBASE_APP_ID`.
- `firestore.rules` — new, the security rules above.
- `firebase.json` / `.firebaserc` — new, CLI project config pointing at
  the new Firebase project, needed to `firebase deploy --only
  firestore:rules`.
- `CLAUDE.md` — update "Known shortcuts / upgrade path" section to reflect
  that persistence is now Firestore, and note the new shortcuts (single
  document, no auth, no realtime) with their upgrade paths.
