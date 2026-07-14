@AGENTS.md

# Griffin Intern Dashboard

Intern Analyst KPI & Metrics Dashboard for Grace Soegiarto + Ethan Maxey (Griffin Global / Doeren Mayhew engagement). Ported from a Claude Design prototype (`Intern Dashboard.dc.html` — see original design source in `~/Downloads/Intern Dashboard Web App/` if it still exists) into a real Next.js app.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4 (Tailwind is only used for the build pipeline/reset — the dashboard itself is styled with inline `style` objects using `oklch()` colors, matching the original design 1:1).
- Firebase (Firestore) backend. All state lives in one `useState<AppState>` in `src/components/intern-dashboard.tsx`, fetched on load and overwritten (debounced ~500ms) into a single `dashboard/main` document via `src/lib/firebase.ts`. No auth — see the "Known shortcuts" section below.

## Structure

- `src/lib/dashboard-data.ts` — all types, seed/demo data, and constants (status colors, nav tabs, etc).
- `src/components/intern-dashboard.tsx` — the entire app: header/nav, and one component per tab (Scorecard, Journal, Goals & OKRs, Reviews, Reference). Also owns PDF export (opens a print window) and the standalone review-link flow (`?review=<token>` query param renders a bare review form, no header/nav).
- `src/app/page.tsx` — wraps the dashboard in `<Suspense>` (required for `useSearchParams`).

## Known shortcuts / upgrade path

- **Persistence**: one shared `dashboard/main` document (single JSON blob) in Firestore — no per-user documents, no history/versioning. Fine for the current 2-4 known users; if usage grows, split into real collections once querying individual fields (not just the whole blob) actually matters.
- **Auth**: none. Firestore security rules (`firestore.rules`) allow public read/write on the `dashboard` collection, matching the no-login review-link flow. Upgrade path: Firebase Auth (email/magic-link) for Grace/Ethan, rules scoped to signed-in users, once the dashboard needs to stop being fully public-by-URL.
- **Sync**: refetch-on-page-load only, no realtime listener (`onSnapshot`). Two tabs open at once means last-write-wins with no merge. Upgrade path: an `onSnapshot` subscription on `dashboard/main` if concurrent editing becomes common.
- **Reviews**: "sending" a review link just copies a URL (`?review=<token>`) to the clipboard — no email/notification is sent.
- **Jira sync tab**: fully mocked sample data, not a real integration. Marked in the Reference tab UI itself.

## Commands

- `npm run dev` — start dev server (Turbopack)
- `npm run build` — production build
- `npm run lint` — ESLint

## Deployment

Deployed on Vercel, connected to the `main` branch of the GitHub repo for auto-deploy on push. The `NEXT_PUBLIC_FIREBASE_*` env vars (see `.env.local`, gitignored) must also be set in the Vercel project settings — they aren't committed, so a fresh deploy has none of them until they're added there.
