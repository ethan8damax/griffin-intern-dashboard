# Supabase backend for the Intern Dashboard

## Problem

All dashboard state currently lives in one `useState<AppState>` in
`src/components/intern-dashboard.tsx`, persisted only to the browser's
`localStorage` (`griffin-intern-dashboard-v1`). This means:

- No data survives a browser change, device change, or cleared storage.
- Grace and Ethan each see their own separate copy — there is no actual
  sharing today, despite this being a two-person tool.

Goal: move persistence to Supabase so no dashboard data lives only in the
frontend, while keeping the app exactly as frictionless as it is today (no
login, no new UI chrome beyond a small save-status indicator).

## Decisions

Resolved with the user before writing this spec:

- **No auth.** Stays a no-login internal tool, same exposure model as
  today's shareable review link — anyone with the URL can read/write.
- **Single JSON blob**, not normalized tables. Mirrors the existing
  `AppState` shape, so the tab components' read/update functions don't
  change.
- **Refetch-on-load only**, no realtime sync. Two tabs open at once is a
  rare case for a 2-person tool; last write wins, no merge logic.
- **New Supabase project**, dedicated to this app (existing projects —
  Mammon, LifeOS, ATS — are unrelated).

## Data model

One table, one row:

```sql
create table public.dashboard_state (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
```

The single row uses `id = 'main'`. It's seeded with the current
`initialState()` seed data on first run (insert-if-missing).

## Security

RLS is enabled (never disabled), with an explicit permissive policy on
`dashboard_state` allowing the `anon` role to `select`, `insert`, and
`update`. This is real public read/write access, matching the "no login"
decision — it is not an oversight, and is scoped to this one table only.
No `delete` policy — nothing in the app deletes the whole state row.

## Client wiring

- New dependency: `@supabase/supabase-js`.
- New `src/lib/supabase.ts`: exports a singleton browser client built from
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- In `src/components/intern-dashboard.tsx`, replace the two `localStorage`
  `useEffect`s:
  - **Load** (on mount): fetch the `main` row. If it doesn't exist, insert
    the seed state and use that. `setState(...)`, then `setLoaded(true)`.
  - **Save** (on `[state, loaded]` change): debounce ~500ms, then `upsert`
    the row with the latest `state`. Debouncing avoids a network write on
    every keystroke/tab click — most fields already only commit on blur or
    `onChange` of a `<select>`, so this just protects rapid-fire sequences
    (e.g. typing in the plain `<input>` journal/draft fields).
- `STORAGE_KEY` / `localStorage` usage is removed entirely — no dual-write,
  no migration-from-localStorage step (there's no real data in it worth
  preserving beyond the seed demo data).

## Save status + error handling

A small text indicator in the header: `Saving…` / `Saved` / `Save failed —
check connection`. On failure, the in-memory state is untouched and the
next edit retries the save. No offline queue, no retry/backoff — just
enough visibility that a real network failure doesn't silently eat an
edit, which matters more now than it did with localStorage (which had no
network to fail on).

## Out of scope / unchanged

- No auth, no realtime, no state history/versioning, no normalized tables.
- Jira sync tab stays fully mocked, as documented in the Reference tab UI.
- The standalone review flow (`?review=<token>`) is unchanged in behavior —
  it reads/writes the same shared row, same as every other tab.

## Provisioning

A new Supabase project will be created in the same org as the user's
existing projects. Cost/plan will be confirmed with the user via the
Supabase MCP `confirm_cost` flow at execution time, before creation.

## Files touched

- `src/lib/supabase.ts` — new, Supabase client.
- `src/lib/dashboard-data.ts` — drop `STORAGE_KEY`, add the fixed row id
  constant (e.g. `DASHBOARD_ROW_ID = "main"`).
- `src/components/intern-dashboard.tsx` — replace localStorage load/save
  effects with Supabase fetch/upsert + save-status state.
- `package.json` — add `@supabase/supabase-js`.
- `.env.local` (gitignored) — `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `CLAUDE.md` — update "Known shortcuts / upgrade path" section to reflect
  that persistence is now Supabase, and note the new shortcuts (single
  blob, no auth, no realtime) with their upgrade paths.
- New Supabase migration (via MCP `apply_migration`) creating
  `dashboard_state` + its RLS policies.
