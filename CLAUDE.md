@AGENTS.md

# Griffin Intern Dashboard

Intern Analyst KPI & Metrics Dashboard for Grace Soegiarto + Ethan Maxey (Griffin Global / Doeren Mayhew engagement). Ported from a Claude Design prototype (`Intern Dashboard.dc.html` — see original design source in `~/Downloads/Intern Dashboard Web App/` if it still exists) into a real Next.js app.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4 (Tailwind is only used for the build pipeline/reset — the dashboard itself is styled with inline `style` objects using `oklch()` colors, matching the original design 1:1).
- No backend yet. All state lives in one `useState<AppState>` in `src/components/intern-dashboard.tsx` and is persisted to `localStorage` (`griffin-intern-dashboard-v1`). This is a deliberate shortcut — see `ponytail:` comments in that file.

## Structure

- `src/lib/dashboard-data.ts` — all types, seed/demo data, and constants (status colors, nav tabs, etc).
- `src/components/intern-dashboard.tsx` — the entire app: header/nav, and one component per tab (Scorecard, Journal, Goals & OKRs, Reviews, Reference). Also owns PDF export (opens a print window) and the standalone review-link flow (`?review=<token>` query param renders a bare review form, no header/nav).
- `src/app/page.tsx` — wraps the dashboard in `<Suspense>` (required for `useSearchParams`).

## Known shortcuts / upgrade path

- **Persistence**: localStorage only — single browser, single device, no real multi-user sharing. Upgrade path: Supabase (Postgres + row-level auth), swap the two `localStorage` `useEffect`s in `intern-dashboard.tsx` for reads/writes against a `dashboard_state` table.
- **Reviews**: "sending" a review link just copies a URL (`?review=<token>`) to the clipboard — no email/notification is sent.
- **Jira sync tab**: fully mocked sample data, not a real integration. Marked in the Reference tab UI itself.

## Commands

- `npm run dev` — start dev server (Turbopack)
- `npm run build` — production build
- `npm run lint` — ESLint

## Deployment

Deployed on Vercel, connected to the `main` branch of the GitHub repo for auto-deploy on push.
