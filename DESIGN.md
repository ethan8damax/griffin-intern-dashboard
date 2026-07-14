---
name: Griffin Intern Dashboard
description: A warm, maroon-branded scorecard system aligned to the Doeren Mayhew engagement's own visual identity.
colors:
  maroon: "oklch(0.32 0.13 20)"
  maroon-deep: "oklch(0.22 0.11 20)"
  maroon-tint: "oklch(0.93 0.045 20)"
  cream: "oklch(0.97 0.014 75)"
  surface: "#ffffff"
  border: "oklch(0.9 0.012 60)"
  border-soft: "oklch(0.94 0.008 55)"
  text-primary: "oklch(0.22 0.02 40)"
  text-secondary: "oklch(0.35 0.02 40)"
  text-muted: "oklch(0.55 0.015 50)"
  status-green: "oklch(0.6 0.14 150)"
  status-green-bg: "oklch(0.94 0.06 150)"
  status-yellow: "oklch(0.75 0.15 85)"
  status-yellow-bg: "oklch(0.95 0.06 85)"
  status-red: "oklch(0.58 0.19 25)"
  status-red-bg: "oklch(0.94 0.06 25)"
  status-gray: "oklch(0.6 0.012 50)"
  status-gray-bg: "oklch(0.94 0.008 55)"
  alert-amber: "oklch(0.4 0.13 40)"
  alert-amber-border: "oklch(0.82 0.08 40)"
  alert-amber-bg: "oklch(0.97 0.03 40)"
  info-border: "oklch(0.85 0.05 85)"
  info-bg: "oklch(0.96 0.015 85)"
typography:
  display:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.04em"
  labelMono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "11.5px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "7px"
  lg: "9px"
  xl: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.maroon}"
    textColor: "#ffffff"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "oklch(0.4 0.15 20)"
    textColor: "#ffffff"
  nav-tab-active:
    textColor: "{colors.maroon}"
    typography: "{typography.body}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "20px 22px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
  badge-status-green:
    backgroundColor: "{colors.status-green-bg}"
    textColor: "{colors.status-green}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  avatar-chip:
    backgroundColor: "{colors.maroon}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    size: "26px"
---

# Design System: Griffin Intern Dashboard

## 1. Overview

**Creative North Star: "The Analyst's Ledger, in the Firm's Own Ink"**

This is still a working ledger, not a marketing surface — but it now speaks in the actual visual language of the engagement it serves: Doeren Mayhew's warm cream and maroon, a serif masthead, and a pill-badge status vocabulary borrowed directly from the firm's own client/staff/partner portals. Where the previous iteration used a cool, neutral navy to stay generic, this one commits to a real institutional identity because the interns work *inside* that identity every day — the dashboard should feel like it belongs to the same firm as the systems around it, not like a separate, unbranded tool.

The system still explicitly rejects the vocabulary of a generic SaaS marketing site (gradient heroes, hero-metric templates, bouncy motion) and of legacy enterprise BI (dense competing colors, redundant nested borders, cards stacked on cards). What changed is the palette and a handful of surface treatments, not the underlying discipline: one accent color still carries every primary action, the four-state status vocabulary is still the only other meaningful color, and density still wins over decoration everywhere except the masthead.

**Key Characteristics:**
- One accent color (maroon) carries all primary actions and active states — now matched to the firm's actual brand red instead of a neutral navy.
- A warm cream page background (not pure white, not cool gray) with true-white cards — the contrast between the two, not shadow, is what separates surfaces.
- Exactly one serif moment: the masthead wordmark. Everything else — numbers, labels, body copy — stays in Inter, per the stat-tile convention that hero figures are never set in a display face.
- Fully-rounded pill badges for every status/tag (scorecard status, journal tags, review status, Jira status) — replacing the previous 6–7px "soft-rounded" badges, matching the firm's own portal screens.
- Trend sparklines on the four scorecard stat cards, rendered only once a metric has ≥2 periods of real data — no fabricated trend lines on day-one data.
- Every clickable element now has a real hover state (color shift, background tint) — closing the biggest gap named in the last design review.

## 2. Colors

A warm neutral ramp (cream → white → ink) carries structure and text; maroon is the one committed accent; the four status colors remain the only other color signal.

### Primary
- **Maroon** (`oklch(0.32 0.13 20)`): the single brand accent, now matched to Doeren Mayhew's own red. Header logo mark, primary buttons, active nav tab (text + underline), active period pill, avatar chips, the selected score-picker tile. Used sparingly outside those roles.
- **Maroon Deep** (`oklch(0.22 0.11 20)`): a half-step darker, used only for the second avatar chip so two overlapping initials read as distinct people.
- **Maroon Tint** (`oklch(0.93 0.045 20)`): a light wash of the brand color, used for the Jira icon tile and the Jira-mapping "from" chip — a quiet brand touch on secondary surfaces that aren't primary actions.

### Neutral
- **Cream** (`oklch(0.97 0.014 75)`): the page background — warm, not cool; not pure white. This is the single biggest visible change from the previous navy-neutral system.
- **Surface** (`#ffffff`): every card, table, input, and select sits on true white — one step lighter than Cream, which is what actually creates the card/page separation since there is almost no shadow in this system.
- **Border** (`oklch(0.9 0.012 60)`) / **Border Soft** (`oklch(0.94 0.008 55)`): hairline dividers, warmed to match the new neutral family (previously a cool blue-gray).
- **Text Primary** (`oklch(0.22 0.02 40)`) → **Text Secondary** (`oklch(0.35 0.02 40)`) → **Text Muted** (`oklch(0.55 0.015 50)`): the warm-neutral text ramp used for hierarchy within body copy.

### Status (unchanged in meaning, rewarmed in hue)
- **Green** `oklch(0.6 0.14 150)` / bg `oklch(0.94 0.06 150)` — On Track.
- **Yellow** `oklch(0.75 0.15 85)` / bg `oklch(0.95 0.06 85)` — At Risk.
- **Red** `oklch(0.58 0.19 25)` / bg `oklch(0.94 0.06 25)` — Off Track. (Deliberately close in hue to Maroon — differentiated by context and lightness, never appearing in the same component.)
- **Gray** `oklch(0.6 0.012 50)` / bg `oklch(0.94 0.008 55)` — Not Yet Measured, now warm-neutral instead of cool-neutral, matching the rest of the ramp.
- **Alert Amber** / **Info**: unchanged from the prior system — the risk banner and the "this is mocked data" disclosure.

### Named Rules
**The One Accent Rule.** Maroon is the only saturated-enough-to-notice color outside the status system. If a new element needs emphasis, reach for maroon or for weight/size — never a second accent hue.
**The Status Means One Thing Rule.** Green/yellow/red/gray always mean On Track / At Risk / Off Track / Not Yet Measured, in that exact color, everywhere they appear. Never reuse these four hues for anything else.
**The One Serif Rule.** Source Serif 4 appears in exactly one place: the header masthead. Every number, label, and body string — including the big stat-card values — stays in Inter. A hero figure set in a display face reads as decoration, not data.

## 3. Typography

**Display Font:** Source Serif 4 (with Georgia, serif fallback) — masthead only.
**Body Font:** Inter (with system-ui, -apple-system, sans-serif fallback).
**Label/Mono Font:** JetBrains Mono (with monospace fallback).

**Character:** A single elegant serif marks the one "this is the firm's tool" moment in the header; everything functional — every number, table cell, and label — stays in the same dense, highly legible Inter used before. The pairing is deliberately restrained: one serif word, then back to sans for the rest of the page.

### Hierarchy
- **Display** (600, 18px, Source Serif 4): the header wordmark only. Never used for anything else — not section titles, not the standalone-review headline (which uses the same serif at 21px for the one other "this is a real, considered request" moment a reviewer sees).
- **Headline** (800, 22px, Inter): the four scorecard stat-card values and the review-summary average score.
- **Title** (700, 15px, Inter): card/section titles.
- **Body** (400–700, 13px, Inter): table cells, form values, journal entries, review questions.
- **Label** (600, 11px, Inter, uppercase, 0.04em): table column headers and form field labels.
- **Label Mono** (500, 11.5px, JetBrains Mono): dates, Jira keys, "last synced."

## 4. Elevation

Still almost flat. Cream vs. white is what separates the page from its cards; a single faint shadow (`0 1px 2px oklch(0.2 0.02 40 / 0.05)`) marks only the four scorecard stat cards as the one "glanceable tile" moment. No new elevation was added in this pass — the earlier design review's "no hover feedback" gap was closed with color/background transitions instead of shadow, which stays truer to the flat system than adding a hover-lift would have.

### Shadow Vocabulary
- **Tile** (`box-shadow: 0 1px 2px oklch(0.2 0.02 40 / 0.05)`): the only shadow in the system — the four scorecard stat cards.

## 5. Components

### Buttons
- **Shape:** 7–9px radius (`{rounded.md}`–`{rounded.lg}`).
- **Primary:** maroon background, white text, 700 weight, `10px 18px` padding. Hover darkens to `oklch(0.4 0.15 20)`. Used for Generate review link, Add entry, Submit review, Export.
- **Ghost / Link-style:** maroon text on transparent background, hover gains a warm neutral background tint (`oklch(0.95 0.025 55)`) — this is new; the previous system had no visible hover feedback on these at all.
- **Dashed Add:** unchanged shape, border color rewarmed to `oklch(0.72 0.04 20)`.

### Badges / Status Pills
- **Style:** fully rounded (`{rounded.pill}`, 999px) — changed from the previous 6–7px "soft-rounded" badge, matching the firm's own portal pill badges. Background = the status's `-bg` token, text = the status's solid token, `3px 10px` padding, 700 weight label typography.
- **Variants:** scorecard status select, work-item status select, journal entry type select, review status (Submitted/Pending), Jira issue status, Jira-mapping "from" chip — every one of these is now a true pill, where before only some were.

### Cards / Containers
- **Corner Style:** `{rounded.xl}` (12px) for full cards; buttons and pills use their own smaller/pill radii.
- **Background:** white surface on Cream page background.
- **Shadow Strategy:** none, except the stat-card Tile shadow.
- **Border:** 1px, `{colors.border}`.

### Inputs / Fields
- **Style:** 1px `oklch(0.88 0.012 55)` border, white background, `{rounded.md}`, `8px 10px` padding — same construction as before, rewarmed.
- **Editable table cells:** unchanged behavior — plain `contentEditable`, feedback only on hover/focus, focus ring now maroon-tinted (`oklch(0.45 0.13 20)`) instead of the previous blue.
- **Focus-visible:** every interactive text/link/tab element now transitions color/background on hover via a shared `.ghi-*` class set in `globals.css`, closing the "no hover state anywhere" gap flagged in the prior design review. Full keyboard/ARIA accessibility (real `<button>`s, `tabIndex`, screen-reader labeling) is still an open item — tracked separately, not solved by this visual pass.

### Navigation
- **Style:** the dark navy header strip is gone. The header is now a white bar with a maroon square logo mark, a serif wordmark, plain-text nav tabs (active = maroon text + 2px maroon underline, inactive = muted gray, hover = maroon), a two-person avatar chip (overlapping "GS"/"EM" initials — an honest representation of the app's shared, no-login model, not a fake single-user login state), and the primary Export button.
- **States:** active/inactive/hover, all visibly distinct now (previously only active/inactive).

### Trend Sparkline (signature component)
A 64×24px inline SVG line on each scorecard stat card: a muted tint of the metric's status color for the line, a solid dot in the full status color at the latest point. Rendered **only when a metric has ≥2 numeric data points across periods** — with the current single-period seed data, cards show no sparkline, which is correct behavior, not a bug; the chart appears automatically once a second monthly period exists.

### Score Picker
Unchanged from the prior system: ten 30×30px number tiles (1–10), unselected = white with light border, selected = solid maroon fill with white numerals. Identical in the inline review form and the standalone (no-login) review-link page.

## 6. Do's and Don'ts

### Do:
- **Do** keep the maroon accent to primary actions and "current selection" states only — per the One Accent Rule.
- **Do** keep the four status colors meaning exactly one thing each, everywhere they appear.
- **Do** keep Source Serif 4 to the header masthead (and the standalone review headline) only — per the One Serif Rule. Never use it for a stat value, a table cell, or a button label.
- **Do** render trend sparklines only from real historical data (≥2 periods) — never fabricate a trend line from a single point.
- **Do** give every clickable element a real hover state (color or background shift) — this was the single biggest gap in the previous pass.

### Don't:
- **Don't** introduce gradient heroes, hero-metric templates, or bouncy marketing-site motion.
- **Don't** stack multiple accent/status colors on one surface competing for attention, or nest cards inside cards.
- **Don't** add cartoonish illustration, mascot-rounded corners, or bright primary colors outside the status system.
- **Don't** use `border-left`/`border-right` as a colored accent stripe on cards or list rows.
- **Don't** set a second serif moment anywhere outside the masthead — one is a brand signature, two is inconsistency.
- **Don't** treat the new pill-badge shape as license to add more badges than the status/tag vocabulary already calls for — a pill on everything is as loud as a stripe on everything.
