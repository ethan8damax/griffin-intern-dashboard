# Supabase Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `localStorage` persistence in the Intern Dashboard with a shared Supabase Postgres table, so no dashboard data lives only in the browser.

**Architecture:** One new Supabase project, one table (`dashboard_state`) holding the whole `AppState` as a single JSONB row. The React component fetches that row on load and upserts it (debounced) on every change, replacing the two `localStorage` `useEffect`s currently in `intern-dashboard.tsx`. No auth, no realtime — refetch-on-load only, per the approved design spec at `docs/superpowers/specs/2026-07-13-supabase-backend-design.md`.

**Tech Stack:** Supabase (Postgres + `@supabase/supabase-js`), Next.js 16 / React 19 (existing).

**Note on verification:** This project has no test runner configured (no Jest/Vitest — only ESLint). Rather than bootstrapping a test framework for one feature, verification steps here use the Supabase MCP tools (`execute_sql`, `list_tables`) to check the database layer, and manual dev-server + browser checks for the UI layer, matching this repo's existing testing posture (see `CLAUDE.md`).

---

### Task 1: Provision the Supabase project and schema

**Files:** none (infra only, via Supabase MCP tools)

- [ ] **Step 1: Get the cost estimate**

Call `mcp__plugin_supabase_supabase__get_cost` with `type: "project"` and `organization_id: "upgknyvjvvswxuojrziq"` (the org that owns the user's existing Mammon/LifeOS/ATS projects). Read the returned amount back to the user in chat before continuing.

- [ ] **Step 2: Confirm the cost**

Call `mcp__plugin_supabase_supabase__confirm_cost` with `type: "project"`, the `recurrence` and `amount` from Step 1's response. Save the returned confirmation id.

- [ ] **Step 3: Create the project**

Call `mcp__plugin_supabase_supabase__create_project` with:
- `name: "griffin-intern-dashboard"`
- `region: "us-east-1"` (matches the existing LifeOS/ATS projects)
- `organization_id: "upgknyvjvvswxuojrziq"`
- `confirm_cost_id`: the id from Step 2

Save the returned project id — every later step needs it as `project_id`.

- [ ] **Step 4: Wait for the project to become active**

Call `mcp__plugin_supabase_supabase__get_project` with the new project id. If `status` is not `ACTIVE_HEALTHY`, wait ~10s and check again. Repeat until active (new projects typically take 1-2 minutes).

- [ ] **Step 5: Create the table and RLS policy**

Call `mcp__plugin_supabase_supabase__apply_migration` with `project_id` from Step 3, `name: "create_dashboard_state"`, and this `query`:

```sql
create table public.dashboard_state (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.dashboard_state enable row level security;

create policy "anon can read dashboard state"
  on public.dashboard_state
  for select
  to anon
  using (true);

create policy "anon can insert dashboard state"
  on public.dashboard_state
  for insert
  to anon
  with check (true);

create policy "anon can update dashboard state"
  on public.dashboard_state
  for update
  to anon
  using (true)
  with check (true);
```

- [ ] **Step 6: Verify the table exists**

Call `mcp__plugin_supabase_supabase__list_tables` with `project_id`, `schemas: ["public"]`, `verbose: true`. Confirm `dashboard_state` appears with columns `id`, `state`, `updated_at` and RLS enabled.

- [ ] **Step 7: Get the project URL and publishable key**

Call `mcp__plugin_supabase_supabase__get_project_url` with `project_id`. Then call `mcp__plugin_supabase_supabase__get_publishable_keys` with `project_id`, and pick the key where `disabled` is falsy (prefer the legacy `anon` JWT key if both are present, since `@supabase/supabase-js` v2's `createClient` expects that form). Keep both the URL and the key — Task 2 needs them.

---

### Task 2: Add the Supabase client

**Files:**
- Modify: `package.json`
- Create: `.env.local`
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Install the dependency**

Run: `npm install @supabase/supabase-js`
Expected: `package.json` gains a `"@supabase/supabase-js"` entry under `dependencies`.

- [ ] **Step 2: Write the env file**

Create `.env.local` (already covered by the repo's `.env*` gitignore rule) with the values from Task 1 Step 7:

```
NEXT_PUBLIC_SUPABASE_URL=<url from get_project_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key from get_publishable_keys>
```

- [ ] **Step 3: Write the client**

Create `src/lib/supabase.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run build`
Expected: build succeeds (this file isn't imported anywhere yet, so this just checks for syntax/type errors in isolation — full wiring is verified in Task 4).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/supabase.ts
git commit -m "Add Supabase client dependency"
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
export const DASHBOARD_ROW_ID = "main";
```

- [ ] **Step 2: Verify no other references remain**

Run: `grep -rn "STORAGE_KEY" src/`
Expected: no output (the only usage is in `intern-dashboard.tsx`, replaced in Task 4).

- [ ] **Step 3: Commit**

This is a one-line change that will break the build until Task 4 updates its only caller — commit it together with Task 4 instead of alone. Skip committing here; proceed directly to Task 4.

---

### Task 4: Wire the dashboard component to Supabase

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
  DASHBOARD_ROW_ID,
} from "@/lib/dashboard-data";
import { supabase } from "@/lib/supabase";
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from("dashboard_state")
        .select("state")
        .eq("id", DASHBOARD_ROW_ID)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        // Do NOT setLoaded(true) here: the save effect only runs once
        // loaded, and this component's state still holds the initialState()
        // seed data. Enabling saves now would upsert that seed over whatever
        // real row already exists in Supabase. Leaving loaded=false keeps
        // the user on read-only seed data until a page reload retries.
        console.error("Failed to load dashboard state", error);
        setSaveStatus("error");
        return;
      }
      if (data) {
        setState(data.state as AppState);
      } else {
        const seed = initialState();
        const { error: insertError } = await supabase
          .from("dashboard_state")
          .insert({ id: DASHBOARD_ROW_ID, state: seed });
        if (insertError) console.error("Failed to seed dashboard state", insertError);
        setState(seed);
      }
      setLoaded(true);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveStatus("saving");
    const timeout = setTimeout(async () => {
      const { error } = await supabase
        .from("dashboard_state")
        .upsert({ id: DASHBOARD_ROW_ID, state, updated_at: new Date().toISOString() });
      setSaveStatus(error ? "error" : "saved");
      if (error) console.error("Failed to save dashboard state", error);
    }, 500);
    return () => clearTimeout(timeout);
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
- Reload the page — the edit persists (proves it round-tripped through Supabase, not localStorage).

Then, in the Supabase dashboard or via `mcp__plugin_supabase_supabase__execute_sql` with `query: "select state from dashboard_state where id = 'main';"`, confirm the `state` JSON contains the edited value.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dashboard-data.ts src/components/intern-dashboard.tsx
git commit -m "Replace localStorage persistence with Supabase"
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
- Supabase (Postgres) backend. All state lives in one `useState<AppState>` in `src/components/intern-dashboard.tsx`, fetched on load and upserted (debounced ~500ms) to a single `dashboard_state` row via `src/lib/supabase.ts`. No auth — see the "Known shortcuts" section below.
```

- [ ] **Step 2: Update the Known shortcuts section**

Replace:

```markdown
- **Persistence**: localStorage only — single browser, single device, no real multi-user sharing. Upgrade path: Supabase (Postgres + row-level auth), swap the two `localStorage` `useEffect`s in `intern-dashboard.tsx` for reads/writes against a `dashboard_state` table.
```

with:

```markdown
- **Persistence**: one shared `dashboard_state` row (single JSONB blob, `id = 'main'`) in Supabase — no per-user rows, no history/versioning. Fine for the current 2-4 known users; if usage grows, normalize into real tables once querying individual fields (not just the whole blob) actually matters.
- **Auth**: none. RLS on `dashboard_state` grants the `anon` key full read/write, matching the no-login review-link flow. Upgrade path: Supabase Auth (email/magic-link) for Grace/Ethan, scoped RLS per row, once the dashboard needs to stop being fully public-by-URL.
- **Sync**: refetch-on-page-load only, no realtime subscription. Two tabs open at once means last-write-wins with no merge. Upgrade path: a Supabase Realtime subscription on `dashboard_state` if concurrent editing becomes common.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Document Supabase persistence in CLAUDE.md"
```

---

### Task 6: End-to-end verification

**Files:** none

- [ ] **Step 1: Verify the review-link flow still works**

With `npm run dev` running, open `http://localhost:3000?review=demo5678` (the seeded pending review). Confirm:
- The bare review form renders (no header/nav).
- Submitting a score/text response and clicking "Submit review" shows the "Thanks — your response was recorded" state.
- Reload the same URL — the submitted state persists (fetched from Supabase, not localStorage).

- [ ] **Step 2: Verify a second browser session sees the same data**

Open the app in a second browser (or a private/incognito window) at `http://localhost:3000`. Confirm it shows the same edited state from Task 4/Step 5 and Step 1 above — proving the data is now actually shared, not per-browser.

- [ ] **Step 3: Run the linter**

Run: `npm run lint`
Expected: no errors.
