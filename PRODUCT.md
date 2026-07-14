# Product

## Register

product

## Users

Grace Soegiarto and Ethan Maxey, analyst interns on the Griffin Global / Doeren Mayhew engagement, plus their engagement lead and occasional client contacts who submit performance reviews. Used at a desk, in short sessions between deliverables — filling in a metric after finishing work, jotting a journal entry, or requesting/answering a review. A small, known audience (roughly 2-4 regular users), not a multi-tenant product.

## Product Purpose

A self-serve KPI and engagement-tracking dashboard for the internship: a live scorecard against defined targets, a work/deliverable log, a journal of wins and blockers, OKRs for the cycle, a lightweight 360-style review flow (shareable link, no login), and a reference tab defining what each metric means. Success looks like an accurate, up-to-date record the interns keep current with almost no friction, that produces a clean PDF summary for leadership at period end.

## Brand Personality

Clean and corporate-professional: precise, understated, no playfulness. It should read as a trustworthy internal business tool for a consulting engagement — closer to a well-run internal ops dashboard than a marketing site or a consumer app.

## Anti-references

- Generic consumer SaaS: gradient heroes, bouncy marketing-site energy, hero-metric templates.
- Cluttered enterprise BI dashboards: dense, competing colors, redundant borders/cards, legacy-Tableau energy.
- Playful/consumer app: cartoonish illustration, mascot-rounded UI, bright primary colors.

## Design Principles

- Data density with calm hierarchy — every tab is a working table/form, not a marketing surface; hierarchy comes from spacing and type weight, not decoration.
- Edit-in-place over modals — inline `contentEditable` and inline selects keep the record-keeping frictionless, matching how interns actually fill this in between tasks.
- One accent, used sparingly — the ink/navy brand color marks primary actions and the active state; status colors (green/yellow/red/gray) are the only other color signal, and they always mean the same thing everywhere.
- Print/export is a first-class surface — the PDF export is what leadership actually sees, so period and full-summary exports must stay legible and unstyled-by-comparison-standards, not an afterthought.

## Accessibility & Inclusion

Standard WCAG AA: sufficient text/background contrast (4.5:1 body, 3:1 large text), keyboard-reachable controls, and `prefers-reduced-motion` support for any animation added. No additional known user needs beyond the small internal team.
