# Curator — Style Lab #4 Design Spec

**Date:** 2026-07-10
**Route:** `/labs/curator`
**Branch:** `worktree-labs-curator` (isolated worktree)
**Status:** Approved design, pending implementation plan

## Concept

A post-ironic enterprise SaaS console. **Curator — Portfolio Operations Platform** is the
internal admin tool of this very website: the museum rooms are rows in a management table
fed live from `lib/labs-manifest.ts`, the CV is the managed data, and Aram is the
logged-in operator. Every enterprise ritual — login, dashboards, data tables, kanban
pipeline, ticket forms, settings — is executed lovingly and played completely straight.

The comedy budget is exactly **one gag**: an NPS survey ("How likely are you to recommend
this CV to a colleague or recruiter?") that fires once per visitor. Everything else is
deadpan. The quality of the execution is the point — the lab doubles as proof that the
author builds enterprise frontends for a living.

A second, serious layer: **engineering briefs**. Spec-sheet annotations throughout the
app document how each part is actually built (JWT auth, state architecture, form
validation, lazy loading). The annotations are where the CV happens for technical
readers.

## Brand & Visual System

### Identity

- Product name: **Curator**, subtitle "Portfolio Operations Platform".
- Topbar: small navy square glyph + "Curator" wordmark + muted `v4.2.1` version tag.
- Document title pattern: `<Module> · Curator`.
- The operator (sidebar footer): avatar, "Aram Yeghiazaryan", "Workspace Owner".
  Role claims obey the no-lead-title rule — professional titles appear only in data
  (Personnel), verbatim from `data/experience.ts`.

### Typography (via `next/font/google`)

| Font | Usage | Scale |
|---|---|---|
| Inter | Entire UI | 13px body · 12px table cells · 11px uppercase tracked (+0.06em) section labels · 18px module titles. Max weight: semibold. |
| IBM Plex Mono | All data | KPI numerals 28px tabular · ticket IDs · timestamps · table numerics · EB brief headers |

### Color Tokens

| Token | Hex | Role |
|---|---|---|
| `ink-navy` | `#0C2340` | Sidebar bg, wordmark, headings |
| `action-blue` | `#1F5EDC` | Primary buttons, links, active nav, focus rings |
| `canvas` | `#F6F8FB` | App background |
| `surface` | `#FFFFFF` | Cards, tables, panels |
| `border` | `#E2E8F0` | 1px hairlines (structure carrier — no drop shadows anywhere) |
| `text` | `#111C2E` | Primary text |
| `text-soft` | `#5A6B82` | Secondary text, captions |
| `ok` | `#0E7A4B` | Success badges, positive deltas |
| `warn` | `#B45309` | Warning badges |
| `bad` | `#C0334D` | Danger badges, negative deltas |

Tokens scoped to the lab (CSS module / scoped CSS variables), full-viewport, escaping
the main site identity per series convention. Cards: 6px radius, 1px border. Dark navy
sidebar against white content. Light theme only.

### Motion Grammar

- 150ms ease-out transitions everywhere; nothing springy.
- Module switch: 8px slide + fade.
- Charts draw in once (600ms), skipped under reduced motion.
- Skeleton shimmer ~400ms on module mount (static under reduced motion).
- Toasts slide from bottom-right.
- **Default cursor, deliberately** — custom cursors would break verisimilitude; craft
  budget goes to hover states, focus rings, tabular alignment.

## Authentication (Real Mechanics, Demo Policy)

- **Login screen:** centered white card on canvas — wordmark, email + password
  (zod-validated, inline errors), primary "Sign in", divider, "Continue with SSO",
  chip: `Demo environment — credentials pre-filled`. "Forgot password?" →
  "Contact your workspace administrator."
- **Session issuance:** `POST /api/labs/curator/session` — zod-validates body, signs an
  HS256 JWT with `jose` (claims: `sub: 'operator'`, entered email, 24h expiry), sets it
  as an **HTTP-only, SameSite=Lax cookie** (Secure in production). Any credentials are
  accepted — the token's integrity, not its issuance, is the exhibit.
- **Verification:** `app/labs/curator/page.tsx` is a server component that reads and
  verifies the cookie per request; invalid/absent → `LoginScreen`, valid → `CuratorApp`.
- **Sign-out:** sidebar user menu → `DELETE` on the session route → cookie cleared →
  refresh.
- **Secret:** `CURATOR_SESSION_SECRET` env var with a documented non-secret dev
  fallback. Acceptable because the token gates no sensitive data — this is stated
  openly in EB-001.

## Module Map

Sidebar order, top to bottom. Each module is one lazily-loaded file
(`next/dynamic`).

| Module | Content | Craft exhibited |
|---|---|---|
| **Overview** | KPI row: Museum Rooms (real), Attic Exhibits (real), Years in Production (real, computed from `experience.ts`), Weekly Visitors (simulated, captioned "Sample data"). 90-day traffic line chart with spike annotations anchored to real lab ship-dates from the manifest. "Capability utilization" bar chart from real `skills.ts` years. Activity feed derived from manifest events (room shipped / retired). | Hand-rolled SVG charts, `AnalyticsSource` interface, skeletons |
| **Rooms** | Management table fed live from `labs-manifest.ts`: title, status badge (live/attic), ship date, thesis excerpt, "Open room" link (respects `href` override). Header chips: total / live / attic counts. Shipping lab #6 grows this table with zero changes here. | Single source of truth |
| **Personnel** | Data table of one: `experience.ts` rows with real column sorting, text filtering, pagination (page size 3 — the controls paginate six rows, played straight), row expansion (highlights + technologies), client-side CSV export. | Table logic |
| **Pipeline** | Kanban CRM: columns Sourced → In Review → Offer → Closed Won. Past roles are Closed-Won deal cards (company, role, period, and a "Value" field showing tenure length in months, e.g. `26 mo`); one open card, "Your Company — Senior Frontend Engineer", starts in Sourced and is draggable toward Offer. Card order and column placement persist. | `@dnd-kit` drag-and-drop, keyboard-accessible |
| **Tickets** | Multi-step contact form: Step 1 requester (name, email), Step 2 details (category select: Job opportunity / Freelance / Speaking / Other; priority radios; message), Step 3 review → submit. Per-step zod schemas, inline errors, progress indicator. Submit: toast "Ticket AY-#### created" + opens a prefilled `mailto:` so the form genuinely delivers. | Form architecture, validation UX |
| **Engineering** | The handbook: all EB briefs rendered as an internal documentation page — mono EB numbers, Stack / Pattern / Rationale fields, grouped by area. | The actual CV, in spec-sheet form |
| **Settings** | Preferences that actually persist: density (comfortable/compact — changes table row height), sidebar default state, notification toggles, profile fields (read-only demo). | Zustand + Immer + persist, visibly working |

### Engineering Briefs (SPEC chips)

- Single typed source: `annotations.ts` — `{ id: 'EB-001', area, title, stack, pattern, rationale }`.
- Surface 1: a small outlined `SPEC` chip in each major widget header → popover styled
  as an internal spec sheet (mono header `ENGINEERING BRIEF · EB-00N`).
- Surface 2: the Engineering module renders all briefs as one document.
- Written in corporate documentation voice, technically accurate. Minimum coverage:
  session management (EB-001), state architecture, form validation, table logic,
  drag-and-drop accessibility, chart rendering, lazy loading / code-splitting,
  analytics source interface, design tokens.

### The One Gag

NPS modal, once per visitor (`localStorage` flag): fires after 90 seconds of activity
or on the third module switch, whichever comes first. "How likely are you to recommend
this CV to a colleague or recruiter?" 0–10 segmented buttons + "Remind me later"
(never reminds). Any interaction → quiet "Thanks for your feedback" toast. Never
appears again.

## Architecture

```
app/labs/curator/page.tsx               # RSC: cookie verify → LoginScreen | CuratorApp
                                        # + server-rendered crawlable CV block (outside
                                        #   the auth gate) + OG metadata
app/api/labs/curator/session/route.ts   # POST sign-in, DELETE sign-out
components/labs/curator/
  login-screen.tsx
  app-shell.tsx                         # sidebar + topbar + module switcher
  store.ts                              # Zustand+Immer+persist ('labs-curator'):
                                        #   activeModule, pipeline placement, settings,
                                        #   NPS flag, toasts
  annotations.ts                        # EB briefs (single source)
  analytics-source.ts                   # AnalyticsSource interface + seeded impl
  adapters.ts                           # data/* + labs-manifest → view models
  modules/{overview,rooms,personnel,pipeline,tickets,engineering,settings}.tsx
  ui/                                   # kpi-card, data-table, badge, spec-chip,
                                        #   toggle, toast, charts/, form primitives
```

- **New dependencies:** `jose`, `@dnd-kit/core`, `@dnd-kit/sortable`. Charts and tables
  are hand-rolled — no chart or table library.
- **Data flow:** one-way — `data/*` + `labs-manifest.ts` → `adapters.ts` → modules.
  Session flows server-side only (cookie → RSC → props).
- **AnalyticsSource:** `interface AnalyticsSource { getTraffic(days): TrafficPoint[];
  getVisitorKpi(): Kpi }`. V1 ships `SimulatedAnalyticsSource`: mulberry32 with a fixed
  seed (identical curves every visit, deterministic tests), weekday/weekend shape,
  growth trend, spikes on manifest ship-dates. A future `GoogleAnalyticsSource` swaps in
  behind the same interface without touching any UI. Simulated widgets carry a
  "Sample data" caption.
- Module state syncs to the URL via `history.replaceState` (`?m=pipeline`) for
  shareable deep links without RSC re-render cost.

## Edge Cases

- **Esc ordering:** any open overlay (NPS, spec popover, mobile drawer, user menu)
  registers `keydown` on `window` with `capture: true` and calls `preventDefault` —
  Esc closes overlays first; GalleryChrome exit to the museum only fires when nothing
  is open. (Established XP/snowpark lesson; test by dispatching on `document.body`.)
- **Touch / narrow viewports:** sidebar becomes a drawer; tables stack to cards;
  kanban columns scroll horizontally; dnd-kit pointer sensor with press-delay so
  scrolling doesn't start drags.
- **Reduced motion:** static skeletons, no chart draw-in, no module slide.
- **Crawlability:** server-rendered CV + briefs summary block rendered regardless of
  auth state (crawlers never log in).
- **Dev-server ports:** concurrent worktrees fight over port 3000 — this lab's dev and
  e2e runs use a dedicated port via `-p` / `E2E_PORT`.

## Series Requirements

- Manifest entry: `{ slug: 'curator', title: 'Curator', date: '2026-07-10', status: 'live' }`
  with thesis: "The portfolio as enterprise SaaS — a navy-and-white operations console
  where the museum itself is the managed asset. Every ritual played straight; the
  pagination paginates six rows."
- Poster: `public/labs/curator/poster.jpg`, portrait ~3:4, ≤200 KB; generator committed
  to `scripts/posters/` (navy sidebar + white dashboard composition).
- Page wrapped in `<GalleryChrome>` (back button + Esc → /labs).
- Per-lab OG metadata for LinkedIn unfurls.
- All copy respects the no-lead-title rule.

## Testing (80% coverage target)

- **Unit:** store actions (module switch, pipeline move, settings persist, NPS
  once-only); table sort/filter/paginate; CSV serialization; analytics determinism
  (same seed → same series); zod schemas (login, ticket steps); JWT sign/verify
  round-trip; adapters.
- **E2E (Playwright, `E2E_PORT`):** login → dashboard; module navigation + URL sync;
  drag pipeline card between columns; personnel pagination + sort; ticket form
  multi-step happy path + validation errors; NPS fires once and never again;
  Esc closes overlay first, then exits to museum; crawlable block present when
  logged out.

## Build Order

1. **Gate 0 (look-dev):** tokens, fonts, app shell + Overview with real KPI cards and
   one chart — screenshot in Chrome → **user approval required before anything else.**
2. Auth: login screen, session route, RSC gate.
3. Modules in pairs, tests alongside: Rooms + Personnel → Pipeline + Tickets →
   Engineering + Settings.
4. NPS gag, polish pass, poster + manifest entry, e2e suite, museum hang.
