# Curator Lab (labs/curator) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Style Lab #4 — "Curator", a post-ironic enterprise SaaS console at `/labs/curator` where the museum itself is the managed asset, with real JWT auth, seven modules, and engineering-brief annotations.

**Architecture:** A server component at `app/labs/curator/page.tsx` verifies an HTTP-only JWT cookie and renders either a login screen or the client app shell. All content flows one-way from `data/*` + `lib/labs-manifest.ts` through `adapters.ts` into seven lazily-loaded modules. A single Zustand+Immer+persist store holds UI state; analytics are simulated behind an `AnalyticsSource` interface.

**Tech Stack:** Next.js 15 App Router (RSC + route handler), TypeScript, Tailwind 4 (arbitrary values over scoped CSS vars), Zustand 5 + Immer, `jose` (JWT), `zod`, `@dnd-kit/core` + `@dnd-kit/sortable`, hand-rolled SVG charts, Vitest 4 (jsdom, `__tests__/labs/curator/`), Playwright.

**Spec:** `docs/superpowers/specs/2026-07-10-curator-lab-design.md` — read it before starting any task.

## Global Constraints

- Every task's requirements implicitly include this section.
- **Worktree:** all work happens in this worktree on branch `worktree-labs-curator`. Never touch the main checkout.
- **Design tokens (exact):** `--c-navy: #0C2340`, `--c-blue: #1F5EDC`, `--c-canvas: #F6F8FB`, `--c-surface: #FFFFFF`, `--c-border: #E2E8F0`, `--c-text: #111C2E`, `--c-text-soft: #5A6B82`, `--c-ok: #0E7A4B`, `--c-warn: #B45309`, `--c-bad: #C0334D`, `--c-hover: #FAFBFD` (row/item hover tint). No drop shadows anywhere; 1px `--c-border` hairlines carry structure. Cards: 6px radius — every card/popover surface, no exceptions. Light theme only.
- **Type:** UI = Inter (already global via `lib/fonts.ts`), 13px body / 12px table cells / 11px uppercase tracked labels / 18px module titles, max weight 600. Data (KPI numerals, IDs, timestamps, EB headers) = IBM Plex Mono (`@fontsource/ibm-plex-mono`), tabular.
- **Motion:** 150ms ease-out transitions; charts draw in once 600ms; skeleton shimmer ~400ms; all skipped under `prefers-reduced-motion`. Default cursor everywhere.
- **Copy voice:** dead-straight corporate. Exactly ONE gag in the whole lab (the NPS survey, Task 15). Never claim Lead/Technical Lead titles — roles come verbatim from `data/experience.ts`.
- **Esc ordering:** any overlay registers `keydown` on `window` with `capture: true` and calls `preventDefault()` while open, so GalleryChrome (bubble listener with `defaultPrevented` guard) only exits to `/labs` when nothing is open. Test Esc by dispatching on `document.body`, never `window`.
- **Immutability:** Zustand+Immer drafts may be mutated inside `set()` only (Immer semantics); everywhere else create new objects. No `console.log`. No hardcoded secrets — JWT secret from `process.env.CURATOR_SESSION_SECRET` with the documented demo fallback constant (spec §Authentication authorizes this).
- **Tests:** colocate under `__tests__/labs/curator/*.test.{ts,tsx}` (vitest `unit` project, jsdom, globals on). Session/JWT tests use `// @vitest-environment node` pragma. Run a single file with `pnpm vitest --project unit __tests__/labs/curator/<file>.test.ts --run`.
- **Dev server:** never use port 3000 (other worktrees fight over it). Use `pnpm dev -p 3017`; e2e via `E2E_PORT=3017 pnpm test:e2e`.
- **Commits:** conventional commits (`feat(labs/curator): …`, `test(labs/curator): …`), no attribution footer. Commit after every green task.
- **Files stay small:** one responsibility per file, ~200 lines typical, 800 hard max.

## File Structure

```
app/labs/curator/page.tsx                    # RSC: metadata, cookie verify → login | app
app/api/labs/curator/session/route.ts        # POST sign-in / DELETE sign-out
components/labs/curator/
  curator.module.css                         # .root: token vars, font import, shimmer keyframes
  fonts.ts                                   # @fontsource/ibm-plex-mono imports
  server/session.ts                          # SESSION_COOKIE, signSession, verifySession
  store.ts                                   # Zustand: module, toasts, settings, pipeline, NPS
  adapters.ts                                # data/* + manifest → RoomRow/PersonnelRow/DealCard/…
  analytics-source.ts                        # AnalyticsSource + SimulatedAnalyticsSource
  annotations.ts                             # EngineeringBrief[] (EB-001…)
  curator-root.tsx                           # client entry: session ? AppShell : LoginScreen
  login-screen.tsx
  app-shell.tsx                              # sidebar + topbar + lazy module switcher + URL sync
  crawlable-cv.tsx                           # server-rendered CV + briefs for crawlers
  nps-survey.tsx
  use-esc-capture.ts
  modules/{overview,rooms,personnel,pipeline,tickets,engineering,settings}.tsx
  ui/kpi-card.tsx  ui/badge.tsx  ui/skeleton.tsx  ui/spec-chip.tsx
  ui/toggle.tsx    ui/toast.tsx  ui/table-core.ts ui/data-table.tsx
  ui/charts/line-chart.tsx  ui/charts/bar-chart.tsx  ui/charts/chart-math.ts
__tests__/labs/curator/*.test.{ts,tsx}
e2e/labs-curator.spec.ts
scripts/posters/curator-poster.html + capture-curator.mjs
public/labs/curator/poster.jpg
lib/labs-manifest.ts                         # modify: add curator entry (Task 18 only)
```

---

### Task 1: Dependencies, tokens, fonts, static app shell

**Files:**
- Modify: `package.json` (via pnpm add)
- Create: `components/labs/curator/fonts.ts`
- Create: `components/labs/curator/curator.module.css`
- Create: `components/labs/curator/curator-root.tsx` (temporary stub wiring, finalized Task 6)
- Create: `components/labs/curator/app-shell.tsx` (static shell; module switching added Task 8)
- Create: `app/labs/curator/page.tsx` (no auth yet; auth gate added Task 6)

**Interfaces:**
- Produces: `styles.root` CSS-module class defining all `--c-*` vars + `--font-data`; `<AppShell>` client component rendering sidebar (nav list, user footer) + topbar (wordmark, `v4.2.1` tag) + `<main>` slot; `NAV_ITEMS: { id: CuratorModule; label: string }[]` exported from `app-shell.tsx` with the module ids `'overview' | 'rooms' | 'personnel' | 'pipeline' | 'tickets' | 'engineering' | 'settings'` (type `CuratorModule` defined here temporarily, moves to `store.ts` in Task 7 — re-export from app-shell stays).

- [ ] **Step 1: Install dependencies**

```bash
pnpm add jose zod @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @fontsource/ibm-plex-mono
```

Expected: lockfile updates, no peer warnings that break install.

- [ ] **Step 2: Create fonts + tokens**

`components/labs/curator/fonts.ts`:

```ts
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
```

`components/labs/curator/curator.module.css`:

```css
.root {
  --c-navy: #0c2340;
  --c-blue: #1f5edc;
  --c-canvas: #f6f8fb;
  --c-surface: #ffffff;
  --c-border: #e2e8f0;
  --c-text: #111c2e;
  --c-text-soft: #5a6b82;
  --c-ok: #0e7a4b;
  --c-warn: #b45309;
  --c-bad: #c0334d;
  --font-ui: 'Inter Variable', Inter, ui-sans-serif, system-ui, sans-serif;
  --font-data: 'IBM Plex Mono', ui-monospace, monospace;
  font-family: var(--font-ui);
  color: var(--c-text);
  background: var(--c-canvas);
  font-size: 13px;
  line-height: 1.45;
}

.root :focus-visible {
  outline: 2px solid var(--c-blue);
  outline-offset: 1px;
  border-radius: 4px;
}

@keyframes shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

.skeleton {
  background: linear-gradient(90deg, #eef1f6 25%, #f7f9fc 50%, #eef1f6 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s linear infinite;
  border-radius: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}
```

- [ ] **Step 3: Static AppShell**

`components/labs/curator/app-shell.tsx` — client component. Layout: fixed full-viewport grid, 232px navy sidebar + content column (56px topbar + scrollable main). All colors via Tailwind arbitrary values over the vars.

```tsx
'use client'

import type { ReactNode } from 'react'

export type CuratorModule =
  | 'overview' | 'rooms' | 'personnel' | 'pipeline'
  | 'tickets' | 'engineering' | 'settings'

export const NAV_ITEMS: { id: CuratorModule; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'personnel', label: 'Personnel' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'settings', label: 'Settings' },
]

export function AppShell({ children }: { children?: ReactNode }) {
  return (
    <div className="grid h-full grid-cols-[232px_1fr]">
      <aside className="flex flex-col bg-[var(--c-navy)] text-white/85">
        <nav className="mt-4 flex-1 px-2" aria-label="Modules">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="block w-full rounded-[6px] px-3 py-2 text-left text-[13px] text-white/75 transition-colors duration-150 hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-white/10 px-4 py-3">
          <p className="text-[13px] font-medium text-white">Aram Yeghiazaryan</p>
          <p className="text-[11px] text-white/50">Workspace Owner</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--c-border)] bg-[var(--c-surface)] px-6">
          <span aria-hidden className="h-4 w-4 rounded-[3px] bg-[var(--c-blue)]" />
          <span className="text-[14px] font-semibold tracking-tight">Curator</span>
          <span className="font-[family-name:var(--font-data)] text-[10px] text-[var(--c-text-soft)]">v4.2.1</span>
          <span aria-hidden className="h-4 w-px bg-[var(--c-border)]" />
          <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">
            Portfolio Operations Platform
          </span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Root + page**

`components/labs/curator/curator-root.tsx`:

```tsx
'use client'

import './fonts'
import styles from './curator.module.css'
import { AppShell } from './app-shell'

export function CuratorRoot() {
  return (
    <div className={`${styles.root} fixed inset-0 overflow-hidden`}>
      <AppShell />
    </div>
  )
}
```

`app/labs/curator/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { GalleryChrome } from '@/components/labs/gallery-chrome'
import { CuratorRoot } from '@/components/labs/curator/curator-root'

export const metadata: Metadata = {
  title: 'Curator — Style Lab | Aram Yeghiazaryan',
  description:
    'Style Lab experiment #4: the portfolio as enterprise SaaS — a navy-and-white operations console where the museum itself is the managed asset.',
  openGraph: {
    title: 'Curator — Style Lab',
    description:
      'The portfolio as enterprise SaaS. Every ritual played straight; the pagination paginates six rows.',
    images: ['/labs/curator/poster.jpg'],
  },
}

export default function CuratorLabPage() {
  return (
    <GalleryChrome>
      <CuratorRoot />
    </GalleryChrome>
  )
}
```

- [ ] **Step 5: Verify it renders**

Run: `pnpm dev -p 3017`, open `http://localhost:3017/labs/curator`.
Expected: navy sidebar with 7 nav items + user footer, white topbar with wordmark/version, canvas-colored main area. No console errors. Then `pnpm lint` — clean.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml components/labs/curator app/labs/curator
git commit -m "feat(labs/curator): deps, design tokens, static app shell"
```

---

### Task 2: UI primitives — Badge, KpiCard, Skeleton

**Files:**
- Create: `components/labs/curator/ui/badge.tsx`
- Create: `components/labs/curator/ui/kpi-card.tsx`
- Create: `components/labs/curator/ui/skeleton.tsx`
- Test: `__tests__/labs/curator/ui-primitives.test.tsx`

**Interfaces:**
- Consumes: `styles.skeleton` class from `curator.module.css` (Task 1).
- Produces: `<Badge tone="ok" | "warn" | "bad" | "neutral">{label}</Badge>`; `<KpiCard label={string} value={string} delta?={number} caption?={string} />` (delta renders `▲ x.x%` in ok green when ≥ 0, `▼` in bad red when < 0; caption is small text-soft, e.g. "Sample data"); `<Skeleton className?>` shimmer block.

- [ ] **Step 1: Write failing tests**

`__tests__/labs/curator/ui-primitives.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/labs/curator/ui/badge'
import { KpiCard } from '@/components/labs/curator/ui/kpi-card'

describe('Badge', () => {
  it('renders label with tone class', () => {
    render(<Badge tone="ok">Live</Badge>)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })
})

describe('KpiCard', () => {
  it('renders label, value, positive delta and caption', () => {
    render(<KpiCard label="Weekly Visitors" value="1,283" delta={12.4} caption="Sample data" />)
    expect(screen.getByText('Weekly Visitors')).toBeInTheDocument()
    expect(screen.getByText('1,283')).toBeInTheDocument()
    expect(screen.getByText('▲ 12.4%')).toBeInTheDocument()
    expect(screen.getByText('Sample data')).toBeInTheDocument()
  })
  it('renders negative delta with ▼', () => {
    render(<KpiCard label="X" value="9" delta={-3.2} />)
    expect(screen.getByText('▼ 3.2%')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests, verify FAIL** (`Cannot find module .../ui/badge`)

Run: `pnpm vitest --project unit __tests__/labs/curator/ui-primitives.test.tsx --run`

- [ ] **Step 3: Implement**

`ui/badge.tsx`:

```tsx
import type { ReactNode } from 'react'

const TONES = {
  ok: 'bg-[#e6f4ec] text-[var(--c-ok)]',
  warn: 'bg-[#fdf0e3] text-[var(--c-warn)]',
  bad: 'bg-[#fae8ec] text-[var(--c-bad)]',
  neutral: 'bg-[#eef1f6] text-[var(--c-text-soft)]',
} as const

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>
      {children}
    </span>
  )
}
```

`ui/kpi-card.tsx`:

```tsx
export function KpiCard({
  label, value, delta, caption,
}: { label: string; value: string; delta?: number; caption?: string }) {
  return (
    <div className="rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-[family-name:var(--font-data)] text-[28px] font-semibold leading-none tabular-nums">
          {value}
        </span>
        {delta !== undefined && (
          <span
            className={`text-[12px] font-medium ${delta >= 0 ? 'text-[var(--c-ok)]' : 'text-[var(--c-bad)]'}`}
          >
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      {caption && <p className="mt-1 text-[11px] text-[var(--c-text-soft)]">{caption}</p>}
    </div>
  )
}
```

`ui/skeleton.tsx`:

```tsx
import styles from '../curator.module.css'

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`${styles.skeleton} ${className}`} />
}
```

- [ ] **Step 4: Run tests, verify PASS.** Same command as Step 2.

- [ ] **Step 5: Commit**

```bash
git add components/labs/curator/ui __tests__/labs/curator/ui-primitives.test.tsx
git commit -m "feat(labs/curator): badge, kpi-card, skeleton primitives"
```

---

### Task 3: Adapters + simulated analytics (pure logic, TDD)

**Files:**
- Create: `components/labs/curator/adapters.ts`
- Create: `components/labs/curator/analytics-source.ts`
- Test: `__tests__/labs/curator/adapters.test.ts`
- Test: `__tests__/labs/curator/analytics-source.test.ts`

**Interfaces:**
- Consumes: `data/experience.ts` (`experiences: Experience[]`), `data/skills.ts` (`skills`), `lib/labs-manifest.ts` (`labs`, `LabEntry`).
- Produces (exact — later tasks import these names):

```ts
// adapters.ts
export type RoomRow = { slug: string; title: string; status: 'live' | 'attic'; date: string; thesis: string; href: string }
export type PersonnelRow = {
  id: string; company: string; role: string; location: string; period: string
  startDate: string; endDate: string | null; tenureMonths: number
  description: string; highlights: string[]; technologies: string[]
}
export type PipelineColumn = 'sourced' | 'in-review' | 'offer' | 'closed-won'
export type DealCard = { id: string; company: string; role: string; period: string; tenureMonths: number; defaultColumn: PipelineColumn }
export type ActivityEvent = { id: string; date: string; label: string; kind: 'shipped' | 'retired' }
export const OPEN_DEAL_ID = 'your-company'
export function tenureMonths(startDate: string, endDate: string | null, now?: Date): number
export function getRoomRows(): RoomRow[]
export function getPersonnelRows(now?: Date): PersonnelRow[]
export function getDealCards(now?: Date): DealCard[]   // past roles → 'closed-won', + open card → 'sourced'
export function getActivity(): ActivityEvent[]          // manifest → shipped/retired events, newest first
export function getRealKpis(now?: Date): { rooms: number; attic: number; yearsInProduction: number }

// analytics-source.ts
export type TrafficPoint = { date: string; visitors: number }   // date = 'YYYY-MM-DD'
export interface AnalyticsSource {
  getTraffic(days: number): TrafficPoint[]
  getVisitorKpi(): { weekly: number; deltaPct: number }
}
export function mulberry32(seed: number): () => number
export class SimulatedAnalyticsSource implements AnalyticsSource {
  constructor(endDate?: Date)  // defaults to new Date(); tests pass a fixed date
}
export const analytics: AnalyticsSource
```

- [ ] **Step 1: Write failing tests**

`__tests__/labs/curator/adapters.test.ts`:

```ts
import {
  tenureMonths, getRoomRows, getPersonnelRows, getDealCards, getActivity, getRealKpis, OPEN_DEAL_ID,
} from '@/components/labs/curator/adapters'
import { labs } from '@/lib/labs-manifest'
import { experiences } from '@/data/experience'

const NOW = new Date('2026-07-10')

describe('tenureMonths', () => {
  it('computes closed ranges', () => {
    expect(tenureMonths('2022-02', '2023-06')).toBe(16)
  })
  it('uses now for open ranges', () => {
    expect(tenureMonths('2023-05', null, NOW)).toBe(38)
  })
})

describe('adapters', () => {
  it('maps every manifest lab to a room row with resolved href', () => {
    const rows = getRoomRows()
    expect(rows).toHaveLength(labs.length)
    expect(rows.find((r) => r.slug === 'main')?.href).toBe('/')
    expect(rows.find((r) => r.slug === 'xp')?.href).toBe('/labs/xp')
  })
  it('maps every experience to a personnel row', () => {
    const rows = getPersonnelRows(NOW)
    expect(rows).toHaveLength(experiences.length)
    expect(rows[0].tenureMonths).toBeGreaterThan(0)
  })
  it('builds deals: all past roles closed-won plus one open card in sourced', () => {
    const deals = getDealCards(NOW)
    expect(deals).toHaveLength(experiences.length + 1)
    const open = deals.find((d) => d.id === OPEN_DEAL_ID)
    expect(open?.defaultColumn).toBe('sourced')
    expect(deals.filter((d) => d.defaultColumn === 'closed-won')).toHaveLength(experiences.length)
  })
  it('derives activity from manifest, newest first', () => {
    const events = getActivity()
    expect(events.length).toBeGreaterThanOrEqual(labs.length)
    const dates = events.map((e) => e.date)
    expect([...dates].sort().reverse()).toEqual(dates)
  })
  it('real KPIs count manifest and compute years', () => {
    const k = getRealKpis(NOW)
    expect(k.rooms).toBe(labs.length)
    expect(k.attic).toBe(labs.filter((l) => l.status === 'attic').length)
    expect(k.yearsInProduction).toBe(10) // 2016-01 → 2026-07
  })
})
```

`__tests__/labs/curator/analytics-source.test.ts`:

```ts
import { SimulatedAnalyticsSource, mulberry32 } from '@/components/labs/curator/analytics-source'

const END = new Date('2026-07-10T12:00:00Z')

describe('mulberry32', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42); const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})

describe('SimulatedAnalyticsSource', () => {
  it('returns one point per day, dated, deterministic', () => {
    const s1 = new SimulatedAnalyticsSource(END).getTraffic(90)
    const s2 = new SimulatedAnalyticsSource(END).getTraffic(90)
    expect(s1).toHaveLength(90)
    expect(s1[89].date).toBe('2026-07-10')
    expect(s1).toEqual(s2)
    expect(s1.every((p) => p.visitors > 0)).toBe(true)
  })
  it('spikes on lab ship dates', () => {
    const series = new SimulatedAnalyticsSource(END).getTraffic(90)
    const byDate = Object.fromEntries(series.map((p) => [p.date, p.visitors]))
    // xp shipped 2026-07-09 (a Thursday); compare to the plain Monday before
    expect(byDate['2026-07-09']).toBeGreaterThan(byDate['2026-07-06'] * 1.5)
  })
  it('computes weekly KPI with delta', () => {
    const kpi = new SimulatedAnalyticsSource(END).getVisitorKpi()
    expect(kpi.weekly).toBeGreaterThan(0)
    expect(Number.isFinite(kpi.deltaPct)).toBe(true)
  })
})
```

- [ ] **Step 2: Run both, verify FAIL** (modules not found).

Run: `pnpm vitest --project unit __tests__/labs/curator/adapters.test.ts __tests__/labs/curator/analytics-source.test.ts --run`

- [ ] **Step 3: Implement `adapters.ts`**

Declare the types/consts exactly as in the Interfaces block, then:

```ts
import { experiences } from '@/data/experience'
import { labs, type LabEntry } from '@/lib/labs-manifest'

export function tenureMonths(startDate: string, endDate: string | null, now = new Date()): number {
  const [sy, sm] = startDate.split('-').map(Number)
  const end = endDate ? endDate.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1]
  return (end[0] - sy) * 12 + (end[1] - sm)
}

const roomHref = (l: LabEntry) => l.href ?? `/labs/${l.slug}`

export function getRoomRows(): RoomRow[] {
  return labs.map((l) => ({
    slug: l.slug, title: l.title, status: l.status === 'attic' ? 'attic' : 'live',
    date: l.date, thesis: l.thesis, href: roomHref(l),
  }))
}

export function getPersonnelRows(now = new Date()): PersonnelRow[] {
  return experiences.map((e) => ({
    id: e.id, company: e.company, role: e.role, location: e.location, period: e.period,
    startDate: e.startDate, endDate: e.endDate,
    tenureMonths: tenureMonths(e.startDate, e.endDate, now),
    description: e.description, highlights: e.highlights, technologies: e.technologies,
  }))
}

export function getDealCards(now = new Date()): DealCard[] {
  const won: DealCard[] = experiences.map((e) => ({
    id: e.id, company: e.company, role: e.role, period: e.period,
    tenureMonths: tenureMonths(e.startDate, e.endDate, now), defaultColumn: 'closed-won',
  }))
  return [
    { id: OPEN_DEAL_ID, company: 'Your Company', role: 'Senior Frontend Engineer', period: 'Open', tenureMonths: 0, defaultColumn: 'sourced' },
    ...won,
  ]
}

export function getActivity(): ActivityEvent[] {
  return labs
    .flatMap((l): ActivityEvent[] => {
      const shipped: ActivityEvent = { id: `${l.slug}-shipped`, date: l.date, label: `Room "${l.title}" shipped`, kind: 'shipped' }
      return l.status === 'attic'
        ? [shipped, { id: `${l.slug}-retired`, date: l.date, label: `Room "${l.title}" retired to attic`, kind: 'retired' }]
        : [shipped]
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function getRealKpis(now = new Date()) {
  const first = experiences[experiences.length - 1].startDate
  return {
    rooms: labs.length,
    attic: labs.filter((l) => l.status === 'attic').length,
    yearsInProduction: Math.floor(tenureMonths(first, null, now) / 12),
  }
}
```

- [ ] **Step 4: Implement `analytics-source.ts`**

```ts
import { labs } from '@/lib/labs-manifest'

export type TrafficPoint = { date: string; visitors: number }
export interface AnalyticsSource {
  getTraffic(days: number): TrafficPoint[]
  getVisitorKpi(): { weekly: number; deltaPct: number }
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

export class SimulatedAnalyticsSource implements AnalyticsSource {
  private end: Date
  constructor(endDate?: Date) {
    this.end = endDate ?? new Date()
  }

  getTraffic(days: number): TrafficPoint[] {
    const shipDates = new Set(labs.map((l) => l.date))
    const points: TrafficPoint[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(this.end)
      d.setUTCDate(d.getUTCDate() - i)
      const date = iso(d)
      // Seed noise from the DATE, not the loop index, so a given calendar
      // day has the same value in any window length.
      const daySeed = Number(date.replaceAll('-', ''))
      const rand = mulberry32(daySeed)
      const dow = d.getUTCDay()
      const weekend = dow === 0 || dow === 6 ? 0.62 : 1
      const noise = 0.82 + rand() * 0.36
      const spike = shipDates.has(date) ? 2.6 + rand() * 0.8 : 1
      points.push({ date, visitors: Math.round(140 * weekend * noise * spike) })
    }
    return points
  }

  getVisitorKpi() {
    const t = this.getTraffic(14)
    const sum = (ps: TrafficPoint[]) => ps.reduce((n, p) => n + p.visitors, 0)
    const thisWeek = sum(t.slice(7))
    const lastWeek = sum(t.slice(0, 7))
    return { weekly: thisWeek, deltaPct: lastWeek === 0 ? 0 : ((thisWeek - lastWeek) / lastWeek) * 100 }
  }
}

export const analytics: AnalyticsSource = new SimulatedAnalyticsSource()
```

- [ ] **Step 5: Run both test files, verify PASS.**

- [ ] **Step 6: Commit**

```bash
git add components/labs/curator/adapters.ts components/labs/curator/analytics-source.ts __tests__/labs/curator
git commit -m "feat(labs/curator): data adapters and seeded analytics source"
```

---

### Task 4: SVG charts + Overview module — GATE 0 DELIVERABLE

**Files:**
- Create: `components/labs/curator/ui/charts/chart-math.ts`
- Create: `components/labs/curator/ui/charts/line-chart.tsx`
- Create: `components/labs/curator/ui/charts/bar-chart.tsx`
- Create: `components/labs/curator/modules/overview.tsx`
- Modify: `components/labs/curator/app-shell.tsx` (render `<OverviewModule/>` as fallback child for now)
- Test: `__tests__/labs/curator/chart-math.test.ts`

**Interfaces:**
- Consumes: `analytics`, `getRealKpis`, `getActivity` (Task 3); `KpiCard`, `Badge` (Task 2); `skills` from `@/data/skills`.
- Produces:

```ts
// chart-math.ts
export type XY = { x: number; y: number }
export function scalePoints(values: number[], width: number, height: number, pad?: number): XY[]
export function linePath(points: XY[]): string        // 'M x y L x y …'
export function areaPath(points: XY[], height: number): string
// line-chart.tsx
export function LineChart(props: { data: TrafficPoint[]; annotations?: { date: string; label: string }[]; title: string; caption?: string }): JSX.Element
// bar-chart.tsx
export function BarChart(props: { data: { label: string; value: number }[]; title: string; unit?: string }): JSX.Element
// modules/overview.tsx
export default function OverviewModule(): JSX.Element
```

- [ ] **Step 1: Failing tests for chart math**

`__tests__/labs/curator/chart-math.test.ts`:

```ts
import { scalePoints, linePath, areaPath } from '@/components/labs/curator/ui/charts/chart-math'

describe('chart math', () => {
  it('scales values into the padded viewport, max at top', () => {
    const pts = scalePoints([0, 10], 100, 50, 4)
    expect(pts).toHaveLength(2)
    expect(pts[0].x).toBe(4)
    expect(pts[1].x).toBe(96)
    expect(pts[1].y).toBeLessThan(pts[0].y) // higher value → smaller y
  })
  it('builds an SVG path', () => {
    expect(linePath([{ x: 0, y: 1 }, { x: 2, y: 3 }])).toBe('M 0 1 L 2 3')
  })
  it('closes the area to the bottom', () => {
    const p = areaPath([{ x: 0, y: 1 }, { x: 2, y: 3 }], 50)
    expect(p.endsWith('L 2 50 L 0 50 Z')).toBe(true)
  })
  it('handles a flat series without NaN', () => {
    const pts = scalePoints([5, 5, 5], 100, 50, 4)
    expect(pts.every((p) => Number.isFinite(p.y))).toBe(true)
  })
})
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement `chart-math.ts`**

```ts
export type XY = { x: number; y: number }

export function scalePoints(values: number[], width: number, height: number, pad = 4): XY[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  const step = values.length > 1 ? innerW / (values.length - 1) : 0
  return values.map((v, i) => ({
    x: pad + i * step,
    y: pad + innerH - ((v - min) / span) * innerH,
  }))
}

export const linePath = (pts: XY[]): string =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

export function areaPath(pts: XY[], height: number): string {
  if (pts.length === 0) return ''
  const last = pts[pts.length - 1]
  return `${linePath(pts)} L ${last.x} ${height} L ${pts[0].x} ${height} Z`
}
```

- [ ] **Step 4: Run, verify PASS.**

- [ ] **Step 5: Implement `LineChart`**

Client component. ViewBox `0 0 640 180` with `preserveAspectRatio="none"` in a `w-full` wrapper. Blue line (`var(--c-blue)`, strokeWidth 1.5) over an area fill (same color, opacity 0.08). Annotation dates render as dashed vertical `var(--c-border)` lines. Draw-in: `pathLength={1}` + `strokeDashoffset` 1→0 transition (600ms ease-out), skipped when `prefers-reduced-motion`. Card chrome matches KpiCard (6px radius, hairline border, white bg, 11px tracked title). First/last dates + optional caption in mono 10px under the plot.

```tsx
'use client'

import { useEffect, useState } from 'react'
import type { TrafficPoint } from '../../analytics-source'
import { scalePoints, linePath, areaPath } from './chart-math'

const W = 640
const H = 180

export function LineChart({ data, annotations = [], title, caption }: {
  data: TrafficPoint[]; annotations?: { date: string; label: string }[]; title: string; caption?: string
}) {
  const pts = scalePoints(data.map((p) => p.visitors), W, H, 8)
  const xByDate = new Map(data.map((p, i) => [p.date, pts[i]?.x ?? 0]))
  // one line per date — several labs can ship the same day
  const uniqueAnnotations = [...new Map(annotations.map((a) => [a.date, a])).values()]
  const [anim, setAnim] = useState<'pending' | 'draw' | 'off'>('pending')

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAnim('off')
      return
    }
    const id = requestAnimationFrame(() => setAnim('draw'))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <figure className="rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
      <figcaption className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">
        {title}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-[180px] w-full" preserveAspectRatio="none" role="img" aria-label={title}>
        <path d={areaPath(pts, H)} fill="var(--c-blue)" opacity={0.08} />
        {uniqueAnnotations.map((a) => {
          const x = xByDate.get(a.date)
          if (x === undefined) return null
          return <line key={a.date} x1={x} x2={x} y1={0} y2={H} stroke="var(--c-border)" strokeDasharray="3 3" />
        })}
        <path
          d={linePath(pts)}
          fill="none" stroke="var(--c-blue)" strokeWidth={1.5}
          pathLength={1} strokeDasharray={1} strokeDashoffset={anim === 'pending' ? 1 : 0}
          style={{ transition: anim === 'draw' ? 'stroke-dashoffset 600ms ease-out' : 'none' }}
        />
      </svg>
      <div className="mt-1 flex justify-between font-[family-name:var(--font-data)] text-[10px] text-[var(--c-text-soft)]">
        <span>{data[0]?.date}</span>
        {caption && <span>{caption}</span>}
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </figure>
  )
}
```

- [ ] **Step 6: Implement `BarChart`**

Same card chrome. Rows: `label | track | mono value`. Track: `#eef1f6` full-width, `var(--c-navy)` fill scaled to `value / max`, 8px tall, 150ms width transition.

```tsx
export function BarChart({ data, title, unit = '' }: {
  data: { label: string; value: number }[]; title: string; unit?: string
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">{title}</p>
      <ul className="mt-3 space-y-2.5">
        {data.map((d) => (
          <li key={d.label} className="grid grid-cols-[110px_1fr_44px] items-center gap-3">
            <span className="truncate text-[12px]">{d.label}</span>
            <span className="h-2 rounded-full bg-[#eef1f6]">
              <span
                className="block h-2 rounded-full bg-[var(--c-navy)] transition-[width] duration-150"
                style={{ width: `${(d.value / max) * 100}%` }}
              />
            </span>
            <span className="text-right font-[family-name:var(--font-data)] text-[11px] tabular-nums text-[var(--c-text-soft)]">
              {d.value}{unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 7: Assemble `modules/overview.tsx`** (client, **default export** — dynamic import target)

```tsx
'use client'

import { labs } from '@/lib/labs-manifest'
import { skills } from '@/data/skills'
import { analytics } from '../analytics-source'
import { getActivity, getRealKpis } from '../adapters'
import { KpiCard } from '../ui/kpi-card'
import { Badge } from '../ui/badge'
import { LineChart } from '../ui/charts/line-chart'
import { BarChart } from '../ui/charts/bar-chart'

const nf = new Intl.NumberFormat('en-US')

export default function OverviewModule() {
  const kpis = getRealKpis()
  const visitors = analytics.getVisitorKpi()
  const traffic = analytics.getTraffic(90)
  const topSkills = [...skills].sort((a, b) => b.years - a.years).slice(0, 8)
  const activity = getActivity()

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[18px] font-semibold">Overview</h1>
        <p className="text-[12px] text-[var(--c-text-soft)]">Portfolio performance and asset status</p>
      </header>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Museum Rooms" value={nf.format(kpis.rooms)} />
        <KpiCard label="Attic Exhibits" value={nf.format(kpis.attic)} />
        <KpiCard label="Years in Production" value={nf.format(kpis.yearsInProduction)} />
        <KpiCard label="Weekly Visitors" value={nf.format(visitors.weekly)} delta={visitors.deltaPct} caption="Sample data" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <LineChart
          data={traffic}
          annotations={labs.map((l) => ({ date: l.date, label: l.title }))}
          title="Visitor Traffic — 90 days"
          caption="Sample data"
        />
        <div className="space-y-4">
          <BarChart title="Capability Utilization" unit=" yr" data={topSkills.map((s) => ({ label: s.name, value: s.years }))} />
          <div className="rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">Recent Activity</p>
            <ul className="mt-3 space-y-2">
              {activity.map((e) => (
                <li key={e.id} className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-data)] text-[11px] text-[var(--c-text-soft)]">{e.date}</span>
                  <span className="min-w-0 truncate text-[12px]">{e.label}</span>
                  <span className="ml-auto"><Badge tone={e.kind === 'shipped' ? 'ok' : 'neutral'}>{e.kind}</Badge></span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Wire into shell temporarily, verify in browser**

In `app-shell.tsx`: `{children ?? <OverviewModule />}` (import it directly for now — lazy switching lands in Task 8). Run `pnpm dev -p 3017`, open `/labs/curator`. Expected: KPI row, drawn line chart with dashed ship-date annotations, capability bars, activity feed. `pnpm lint` clean. Full unit run green: `pnpm vitest --project unit --run`.

- [ ] **Step 9: Commit**

```bash
git add components/labs/curator __tests__/labs/curator/chart-math.test.ts
git commit -m "feat(labs/curator): svg charts and overview module"
```

- [ ] **Step 10: GATE 0 — STOP. User approval required.**

The orchestrator (not a subagent) screenshots `/labs/curator` in Chrome at desktop (~1440px) and narrow (~390px) widths, shows the user, and waits for explicit approval of the look (silhouette, navy, type, chart quality) BEFORE any task past this line. Rework shell/overview until approved.

---

### Task 5: Session utilities + route handler (TDD)

**Files:**
- Create: `components/labs/curator/server/session.ts`
- Create: `app/api/labs/curator/session/route.ts`
- Test: `__tests__/labs/curator/session.test.ts`

**Interfaces:**
- Produces (exact):

```ts
// server/session.ts — server-only, no 'use client'
export const SESSION_COOKIE = 'curator_session'
export const SESSION_MAX_AGE = 60 * 60 * 24            // 24h, seconds
export type CuratorSession = { email: string }
export async function signSession(email: string): Promise<string>
export async function verifySession(token: string | undefined): Promise<CuratorSession | null>
// route.ts
export async function POST(req: Request): Promise<Response>   // 200 {ok:true} + Set-Cookie | 400 {ok:false,error}
export async function DELETE(): Promise<Response>             // 200 {ok:true} + cookie cleared
```

- Consumed by: Task 6 (`page.tsx` calls `verifySession`; login screen POSTs to `/api/labs/curator/session`).

- [ ] **Step 1: Write failing tests**

`__tests__/labs/curator/session.test.ts` (node env — jose needs real WebCrypto):

```ts
// @vitest-environment node
import { signSession, verifySession } from '@/components/labs/curator/server/session'

describe('curator session', () => {
  it('round-trips a signed session', async () => {
    const token = await signSession('recruiter@example.com')
    const session = await verifySession(token)
    expect(session).toEqual({ email: 'recruiter@example.com' })
  })
  it('rejects undefined, garbage, and tampered tokens', async () => {
    expect(await verifySession(undefined)).toBeNull()
    expect(await verifySession('not-a-jwt')).toBeNull()
    const token = await signSession('a@b.co')
    expect(await verifySession(token.slice(0, -2) + 'xx')).toBeNull()
  })
})
```

- [ ] **Step 2: Run, verify FAIL.**

Run: `pnpm vitest --project unit __tests__/labs/curator/session.test.ts --run`

- [ ] **Step 3: Implement `server/session.ts`**

```ts
import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE = 'curator_session'
export const SESSION_MAX_AGE = 60 * 60 * 24

export type CuratorSession = { email: string }

// Demo deployment: the cookie gates no sensitive data — any credentials are
// accepted upstream. The fallback constant is deliberate and documented in
// EB-001; set CURATOR_SESSION_SECRET to override.
const secret = () =>
  new TextEncoder().encode(process.env.CURATOR_SESSION_SECRET ?? 'curator-demo-secret-protects-nothing')

export async function signSession(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('operator')
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret())
}

export async function verifySession(token: string | undefined): Promise<CuratorSession | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] })
    return typeof payload.email === 'string' ? { email: payload.email } : null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run, verify PASS.**

- [ ] **Step 5: Implement the route handler**

`app/api/labs/curator/session/route.ts`:

```ts
import { cookies } from 'next/headers'
import { z } from 'zod'
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from '@/components/labs/curator/server/session'

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: Request): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body.' }, { status: 400 })
  }
  const parsed = credentials.safeParse(body)
  if (!parsed.success) {
    return Response.json({ ok: false, error: 'Enter a valid email and password.' }, { status: 400 })
  }
  const token = await signSession(parsed.data.email)
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
  return Response.json({ ok: true })
}

export async function DELETE(): Promise<Response> {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
  return Response.json({ ok: true })
}
```

- [ ] **Step 6: Smoke the endpoint**

With `pnpm dev -p 3017` running:

```bash
curl -s -X POST http://localhost:3017/api/labs/curator/session -H "content-type: application/json" -d '{"email":"a@b.co","password":"x"}' -i | grep -i -E "set-cookie|200"
curl -s -X POST http://localhost:3017/api/labs/curator/session -H "content-type: application/json" -d '{"email":"nope","password":""}' -o /dev/null -w "%{http_code}\n"
```

Expected: first shows `Set-Cookie: curator_session=…; Path=/; …HttpOnly` and 200; second prints `400`.

- [ ] **Step 7: Commit**

```bash
git add components/labs/curator/server app/api/labs/curator __tests__/labs/curator/session.test.ts
git commit -m "feat(labs/curator): jwt session utilities and session route"
```

---

### Task 6: Login screen + RSC auth gate + sign-out

**Files:**
- Create: `components/labs/curator/login-screen.tsx`
- Create: `components/labs/curator/use-esc-capture.ts`
- Modify: `components/labs/curator/curator-root.tsx` (accept `session` prop, branch)
- Modify: `app/labs/curator/page.tsx` (verify cookie, pass session)
- Modify: `components/labs/curator/app-shell.tsx` (user footer becomes a menu with Sign out)
- Test: `__tests__/labs/curator/login-screen.test.tsx`

**Interfaces:**
- Consumes: `verifySession`, `SESSION_COOKIE` (Task 5).
- Produces: `<LoginScreen />`; `CuratorRoot({ session }: { session: { email: string } | null })`; `AppShell({ email, children })`; `useEscCapture(active: boolean, onClose: () => void): void` — window keydown, `capture: true`; when `active` and key is Escape: `preventDefault()` + `onClose()`.

- [ ] **Step 1: Write failing tests**

`__tests__/labs/curator/login-screen.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginScreen } from '@/components/labs/curator/login-screen'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

describe('LoginScreen', () => {
  beforeEach(() => {
    refresh.mockClear()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('pre-fills demo credentials', () => {
    render(<LoginScreen />)
    expect(screen.getByLabelText(/work email/i)).toHaveValue('operator@curator.app')
    expect(screen.getByLabelText(/password/i)).not.toHaveValue('')
  })

  it('shows a zod error for an invalid email without calling the API', async () => {
    render(<LoginScreen />)
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('POSTs credentials and refreshes on success', async () => {
    render(<LoginScreen />)
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(fetch).toHaveBeenCalledWith('/api/labs/curator/session', expect.objectContaining({ method: 'POST' }))
  })

  it('signs in via SSO button too', async () => {
    render(<LoginScreen />)
    fireEvent.click(screen.getByRole('button', { name: /continue with sso/i }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement `use-esc-capture.ts`** (needed for the user menu here, reused by every later overlay)

```ts
import { useEffect } from 'react'

/** Close an overlay on Escape BEFORE GalleryChrome's bubble listener navigates.
 *  Capture-phase + preventDefault; GalleryChrome checks e.defaultPrevented. */
export function useEscCapture(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [active, onClose])
}
```

- [ ] **Step 4: Implement `LoginScreen`**

Client component. Centered card (`max-w-[360px]`, card chrome) on canvas; wordmark row; inputs with visible `<label>`s "Work email" / "Password" (`htmlFor` wired); values pre-filled `operator@curator.app` / `demo-access`; local zod schema (same shape as route's) validated on submit — errors render as 11px `--c-bad` text under the field; primary button `Sign in` (navy→blue bg `--c-blue`, white text, disabled+`Signing in…` while pending); hairline divider with centered 11px "or"; secondary button `Continue with SSO` (white, hairline border) that submits the same pre-filled credentials; chip row: neutral Badge `Demo environment — credentials pre-filled`; footer links row (11px text-soft): `Forgot password?` → `title="Contact your workspace administrator."` non-navigating button, `Privacy`, `Terms`, `Status`. On success: `router.refresh()`. On 4xx/5xx or network error: form-level error line "Sign-in failed. Try again." (catch + set state — no console.log).

Both buttons funnel through one `submit(email, password)` helper: zod parse → `fetch('/api/labs/curator/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })` → `router.refresh()`.

- [ ] **Step 5: Wire the auth gate**

`app/labs/curator/page.tsx` becomes:

```tsx
import { cookies } from 'next/headers'
import { GalleryChrome } from '@/components/labs/gallery-chrome'
import { CuratorRoot } from '@/components/labs/curator/curator-root'
import { SESSION_COOKIE, verifySession } from '@/components/labs/curator/server/session'
// (metadata export unchanged from Task 1)

export default async function CuratorLabPage() {
  const jar = await cookies()
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value)
  return (
    <GalleryChrome>
      <CuratorRoot session={session} />
    </GalleryChrome>
  )
}
```

`curator-root.tsx`:

```tsx
'use client'

import './fonts'
import styles from './curator.module.css'
import { AppShell } from './app-shell'
import { LoginScreen } from './login-screen'

export function CuratorRoot({ session }: { session: { email: string } | null }) {
  return (
    <div className={`${styles.root} fixed inset-0 overflow-hidden`}>
      {session ? <AppShell email={session.email} /> : <LoginScreen />}
    </div>
  )
}
```

`app-shell.tsx` user footer: button (avatar initials circle + name + role) toggling an anchored menu card upward — items: mono email line (from `email` prop), hairline divider, `Sign out` button → `fetch('/api/labs/curator/session', { method: 'DELETE' })` then `router.refresh()`. Menu closes via `useEscCapture(open, close)` and on outside click (document `pointerdown` listener while open).

- [ ] **Step 6: Run tests, verify PASS** (login-screen file + full unit run).

- [ ] **Step 7: Verify the full loop in the browser**

`pnpm dev -p 3017` → `/labs/curator` shows login (cookie absent) → Sign in → dashboard renders → DevTools: `curator_session` cookie is HttpOnly → Sign out returns to login. Esc on the login screen still exits to `/labs` (no overlay open). `pnpm lint` clean.

- [ ] **Step 8: Commit**

```bash
git add components/labs/curator app/labs/curator __tests__/labs/curator/login-screen.test.tsx
git commit -m "feat(labs/curator): login screen, rsc auth gate, sign-out menu"
```

---

### Task 7: Zustand store (TDD)

**Files:**
- Create: `components/labs/curator/store.ts`
- Modify: `components/labs/curator/app-shell.tsx` (move `CuratorModule` type + `NAV_ITEMS` source of truth into store.ts; app-shell re-exports nothing — it imports from store)
- Test: `__tests__/labs/curator/store.test.ts`

**Interfaces:**
- Consumes: `getDealCards`, `OPEN_DEAL_ID`, `PipelineColumn` (Task 3).
- Produces (exact):

```ts
export type CuratorModule = 'overview' | 'rooms' | 'personnel' | 'pipeline' | 'tickets' | 'engineering' | 'settings'
export const MODULE_IDS: CuratorModule[]
export type Density = 'comfortable' | 'compact'
export type Toast = { id: number; title: string; description?: string }
export type PipelineState = Record<PipelineColumn, string[]>   // ordered card ids per column
export const PIPELINE_COLUMNS: { id: PipelineColumn; label: string }[]  // Sourced, In Review, Offer, Closed Won
export function defaultPipeline(): PipelineState

type CuratorState = {
  module: CuratorModule
  moduleVisits: number                 // total switches, drives NPS trigger
  toasts: Toast[]
  density: Density
  sidebarOpen: boolean                 // mobile drawer
  notifications: { productUpdates: boolean; weeklyDigest: boolean; incidentAlerts: boolean }
  pipeline: PipelineState
  npsDone: boolean
  setModule(m: CuratorModule): void
  pushToast(t: Omit<Toast, 'id'>): void
  dismissToast(id: number): void
  setDensity(d: Density): void
  setSidebarOpen(open: boolean): void
  setNotification(key: keyof CuratorState['notifications'], value: boolean): void
  movePipelineCard(cardId: string, to: PipelineColumn, toIndex: number): void
  markNpsDone(): void
}
export const useCuratorStore: UseBoundStore<…>   // create<CuratorState>()(devtools(persist(immer(…), { name: 'labs-curator', partialize })))
```

- Persist `partialize`: only `{ density, notifications, pipeline, npsDone }`. `module`, `toasts`, `sidebarOpen`, `moduleVisits` are session-only.
- `movePipelineCard`: remove `cardId` from whichever column contains it, then insert at `toIndex` in `to` (clamped to array bounds). Mutating the Immer draft inside `set()` is correct here.
- `pushToast`: `id` from an incrementing module-level counter; keep at most 3 toasts (drop oldest).
- `setModule` increments `moduleVisits` only when the module actually changes.

- [ ] **Step 1: Write failing tests**

`__tests__/labs/curator/store.test.ts`:

```ts
import { useCuratorStore } from '@/components/labs/curator/store'
import { OPEN_DEAL_ID } from '@/components/labs/curator/adapters'

const initial = useCuratorStore.getState()
beforeEach(() => {
  useCuratorStore.setState(initial, true)
  window.localStorage.clear()
})

describe('curator store', () => {
  it('starts on overview with the default pipeline', () => {
    const s = useCuratorStore.getState()
    expect(s.module).toBe('overview')
    expect(s.pipeline.sourced).toContain(OPEN_DEAL_ID)
    expect(s.pipeline['closed-won'].length).toBeGreaterThan(0)
  })

  it('counts module visits only on actual change', () => {
    const s = useCuratorStore.getState
    s().setModule('rooms')
    s().setModule('rooms')
    s().setModule('pipeline')
    expect(s().moduleVisits).toBe(2)
  })

  it('moves a pipeline card between columns at an index', () => {
    const s = useCuratorStore.getState
    s().movePipelineCard(OPEN_DEAL_ID, 'offer', 0)
    expect(s().pipeline.sourced).not.toContain(OPEN_DEAL_ID)
    expect(s().pipeline.offer[0]).toBe(OPEN_DEAL_ID)
  })

  it('clamps the insertion index', () => {
    const s = useCuratorStore.getState
    s().movePipelineCard(OPEN_DEAL_ID, 'closed-won', 999)
    const col = s().pipeline['closed-won']
    expect(col[col.length - 1]).toBe(OPEN_DEAL_ID)
  })

  it('caps toasts at 3, dropping the oldest', () => {
    const s = useCuratorStore.getState
    for (let i = 0; i < 4; i++) s().pushToast({ title: `t${i}` })
    expect(s().toasts).toHaveLength(3)
    expect(s().toasts[0].title).toBe('t1')
  })

  it('dismisses a toast by id', () => {
    const s = useCuratorStore.getState
    s().pushToast({ title: 'bye' })
    const id = s().toasts[0].id
    s().dismissToast(id)
    expect(s().toasts).toHaveLength(0)
  })

  it('persists only the intended slice', () => {
    const s = useCuratorStore.getState
    s().setDensity('compact')
    s().setModule('tickets')
    const raw = window.localStorage.getItem('labs-curator')
    expect(raw).toBeTruthy()
    const persisted = JSON.parse(raw as string).state
    expect(persisted.density).toBe('compact')
    expect(persisted.module).toBeUndefined()
    expect(persisted.toasts).toBeUndefined()
  })

  it('marks NPS done', () => {
    useCuratorStore.getState().markNpsDone()
    expect(useCuratorStore.getState().npsDone).toBe(true)
  })
})
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement `store.ts`**

```ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { getDealCards, type PipelineColumn } from './adapters'

export type CuratorModule =
  | 'overview' | 'rooms' | 'personnel' | 'pipeline' | 'tickets' | 'engineering' | 'settings'
export const MODULE_IDS: CuratorModule[] = [
  'overview', 'rooms', 'personnel', 'pipeline', 'tickets', 'engineering', 'settings',
]
export type Density = 'comfortable' | 'compact'
export type Toast = { id: number; title: string; description?: string }
export type PipelineState = Record<PipelineColumn, string[]>

export const PIPELINE_COLUMNS: { id: PipelineColumn; label: string }[] = [
  { id: 'sourced', label: 'Sourced' },
  { id: 'in-review', label: 'In Review' },
  { id: 'offer', label: 'Offer' },
  { id: 'closed-won', label: 'Closed Won' },
]

export function defaultPipeline(): PipelineState {
  const deals = getDealCards()
  const state: PipelineState = { sourced: [], 'in-review': [], offer: [], 'closed-won': [] }
  for (const deal of deals) state[deal.defaultColumn].push(deal.id)
  return state
}

let toastSeq = 0

type CuratorState = {
  // …exactly the shape from the Interfaces block…
}

export const useCuratorStore = create<CuratorState>()(
  devtools(
    persist(
      immer((set) => ({
        module: 'overview' as CuratorModule,
        moduleVisits: 0,
        toasts: [] as Toast[],
        density: 'comfortable' as Density,
        sidebarOpen: false,
        notifications: { productUpdates: true, weeklyDigest: true, incidentAlerts: false },
        pipeline: defaultPipeline(),
        npsDone: false,

        setModule: (m) => set((s) => {
          if (s.module !== m) { s.module = m; s.moduleVisits += 1 }
        }),
        pushToast: (t) => set((s) => {
          s.toasts.push({ ...t, id: ++toastSeq })
          if (s.toasts.length > 3) s.toasts.shift()
        }),
        dismissToast: (id) => set((s) => {
          s.toasts = s.toasts.filter((t) => t.id !== id)
        }),
        setDensity: (d) => set((s) => { s.density = d }),
        setSidebarOpen: (open) => set((s) => { s.sidebarOpen = open }),
        setNotification: (key, value) => set((s) => { s.notifications[key] = value }),
        movePipelineCard: (cardId, to, toIndex) => set((s) => {
          for (const col of Object.keys(s.pipeline) as PipelineColumn[]) {
            const i = s.pipeline[col].indexOf(cardId)
            if (i !== -1) s.pipeline[col].splice(i, 1)
          }
          const target = s.pipeline[to]
          target.splice(Math.min(Math.max(toIndex, 0), target.length), 0, cardId)
        }),
        markNpsDone: () => set((s) => { s.npsDone = true }),
      })),
      {
        name: 'labs-curator',
        partialize: (s) => ({
          density: s.density, notifications: s.notifications, pipeline: s.pipeline, npsDone: s.npsDone,
        }),
      }
    )
  )
)
```

Move `CuratorModule` here; update `app-shell.tsx` to import `{ type CuratorModule, MODULE_IDS }` from `./store` and derive `NAV_ITEMS` labels locally (`Overview`, `Rooms`, `Personnel`, `Pipeline`, `Tickets`, `Engineering`, `Settings`).

- [ ] **Step 4: Run, verify PASS** (store file + full unit run — Task 2/3/4 suites must stay green).

- [ ] **Step 5: Commit**

```bash
git add components/labs/curator/store.ts components/labs/curator/app-shell.tsx __tests__/labs/curator/store.test.ts
git commit -m "feat(labs/curator): zustand store with persisted settings and pipeline"
```

---

### Task 8: Module switching — lazy loading, URL sync, skeletons, toasts

**Files:**
- Create: `components/labs/curator/module-host.tsx`
- Create: `components/labs/curator/ui/toast.tsx`
- Create: `components/labs/curator/ui/skeleton-module.tsx`
- Create: `components/labs/curator/modules/placeholder.tsx` (temporary bodies for rooms/personnel/pipeline/tickets/engineering/settings — each replaced by Tasks 9–14)
- Modify: `components/labs/curator/app-shell.tsx` (nav drives store; renders `<ModuleHost/>` + `<ToastViewport/>`)
- Test: `__tests__/labs/curator/module-host.test.tsx`

**Interfaces:**
- Consumes: store (Task 7), `Skeleton` (Task 2).
- Produces: `<ModuleHost />` — renders the active module via `next/dynamic`; `<ToastViewport />` — fixed bottom-right stack rendering `toasts` with dismiss buttons; `SkeletonModule` — header bar + 3 card blocks built from `Skeleton`. Placeholder default-exports: `PlaceholderModule` bound per id (title + "Module under construction." body) — file `modules/placeholder.tsx` exports `makePlaceholder(title: string)`.
- URL contract: active module syncs to `?m=<id>` via `window.history.replaceState`; on first mount, a valid `?m` overrides the store default.

- [ ] **Step 1: Write failing tests**

`__tests__/labs/curator/module-host.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { ModuleHost } from '@/components/labs/curator/module-host'
import { useCuratorStore } from '@/components/labs/curator/store'

const initial = useCuratorStore.getState()
beforeEach(() => {
  window.history.replaceState(null, '', '/labs/curator')
  useCuratorStore.setState(initial, true)
})

describe('ModuleHost', () => {
  it('renders the overview module by default', async () => {
    render(<ModuleHost />)
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument()
  })

  it('switches modules from the store and syncs the URL', async () => {
    render(<ModuleHost />)
    useCuratorStore.getState().setModule('pipeline')
    await waitFor(() => expect(window.location.search).toBe('?m=pipeline'))
  })

  it('adopts a valid ?m= on mount', async () => {
    window.history.replaceState(null, '', '/labs/curator?m=settings')
    render(<ModuleHost />)
    await waitFor(() => expect(useCuratorStore.getState().module).toBe('settings'))
  })

  it('ignores an invalid ?m=', async () => {
    window.history.replaceState(null, '', '/labs/curator?m=finance')
    render(<ModuleHost />)
    await waitFor(() => expect(useCuratorStore.getState().module).toBe('overview'))
  })
})
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement**

`ui/skeleton-module.tsx`: `SkeletonModule` = `<div className="space-y-4">` with a 24px-wide title Skeleton, a 4-col grid of 72px Skeleton cards, one 220px Skeleton block.

`modules/placeholder.tsx`:

```tsx
export function makePlaceholder(title: string) {
  return function PlaceholderModule() {
    return (
      <div>
        <h1 className="text-[18px] font-semibold">{title}</h1>
        <p className="mt-1 text-[12px] text-[var(--c-text-soft)]">Module under construction.</p>
      </div>
    )
  }
}
```

Temporary module files (`modules/rooms.tsx` etc., six of them): `export default makePlaceholder('Rooms')` — each later task replaces its file wholesale.

`module-host.tsx`:

```tsx
'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'
import { MODULE_IDS, useCuratorStore, type CuratorModule } from './store'
import { SkeletonModule } from './ui/skeleton-module'

const loading = () => <SkeletonModule />
const MODULES: Record<CuratorModule, ReturnType<typeof dynamic>> = {
  overview: dynamic(() => import('./modules/overview'), { loading }),
  rooms: dynamic(() => import('./modules/rooms'), { loading }),
  personnel: dynamic(() => import('./modules/personnel'), { loading }),
  pipeline: dynamic(() => import('./modules/pipeline'), { loading }),
  tickets: dynamic(() => import('./modules/tickets'), { loading }),
  engineering: dynamic(() => import('./modules/engineering'), { loading }),
  settings: dynamic(() => import('./modules/settings'), { loading }),
}

const isModule = (v: string | null): v is CuratorModule =>
  v !== null && (MODULE_IDS as string[]).includes(v)

export function ModuleHost() {
  // named activeModule: `module` trips @next/next/no-assign-module-variable
  const activeModule = useCuratorStore((s) => s.module)
  const setModule = useCuratorStore((s) => s.setModule)

  // Single effect: adopt a valid ?m= on the first pass (skipping the write so the
  // pre-adoption module never clobbers the URL), then mirror every change back.
  const adopted = useRef(false)
  useEffect(() => {
    if (!adopted.current) {
      adopted.current = true
      const m = new URLSearchParams(window.location.search).get('m')
      if (isModule(m) && m !== activeModule) {
        setModule(m)
        return
      }
    }
    const url = activeModule === 'overview' ? window.location.pathname : `?m=${activeModule}`
    window.history.replaceState(null, '', url)
  }, [activeModule, setModule])

  const Active = MODULES[activeModule]
  return (
    <div key={activeModule} className={styles.moduleEnter}>
      <Active />
    </div>
  )
}
```

Add to `curator.module.css` (global keyframes work from a module when referenced via arbitrary animation name — define them un-scoped with `:global`):

```css
:global(@keyframes curator-enter) {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}
```

If Tailwind's arbitrary `animate-[…]` + `:global` keyframes fight, fall back to a plain module class `.moduleEnter` with the animation and `@media (prefers-reduced-motion: reduce) { .moduleEnter { animation: none } }` — reduced-motion must disable the slide either way.

`ui/toast.tsx` — `ToastViewport`: `role="status"` fixed bottom-right `z-50` column of card-chrome toasts (title 13px medium, optional description 12px soft, × dismiss button calling `dismissToast(id)`); each toast auto-dismisses after 5s via `setTimeout` in an effect keyed on `toast.id`; slide-in 150ms.

`app-shell.tsx`: nav buttons call `setModule(item.id)`. The active styling (inverted pill: `bg-white font-medium text-[var(--c-navy)]`, icons, `aria-current="page"`) ALREADY EXISTS from the Gate 0 pass — preserve it exactly and only replace the hardcoded `const activeModule: CuratorModule = 'overview'` with the store's `module` value. Main renders `<ModuleHost />` (drop the Task 4 fallback and the direct OverviewModule import — overview now loads through the host). Mount `<ToastViewport />` once, next to `<main>`. Topbar right side gains the document-title effect: `useEffect` setting `document.title = \`${label} · Curator\`` on module change.

- [ ] **Step 4: Run tests, verify PASS** (new file + full unit run).

- [ ] **Step 5: Browser check**

Dev server: click through all 7 nav items — six placeholders + overview, skeleton flashes on first load of each, URL shows `?m=…`, deep-link `/labs/curator?m=personnel` lands on Personnel, browser tab title follows. `pnpm lint` clean.

- [ ] **Step 6: Commit**

```bash
git add components/labs/curator __tests__/labs/curator/module-host.test.tsx
git commit -m "feat(labs/curator): lazy module host, url sync, toast viewport"
```

---

### Task 9: Rooms module

**Files:**
- Replace: `components/labs/curator/modules/rooms.tsx`
- Test: `__tests__/labs/curator/rooms.test.tsx`

**Interfaces:**
- Consumes: `getRoomRows` (Task 3), `Badge` (Task 2), `SpecChip` does NOT exist yet — do not reference it (Task 13 adds chips to all modules).
- Produces: default export `RoomsModule`.

- [ ] **Step 1: Write failing tests**

`__tests__/labs/curator/rooms.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import RoomsModule from '@/components/labs/curator/modules/rooms'
import { labs } from '@/lib/labs-manifest'

describe('RoomsModule', () => {
  it('renders one row per manifest lab — the single-source-of-truth guarantee', () => {
    render(<RoomsModule />)
    for (const lab of labs) {
      expect(screen.getByText(lab.title)).toBeInTheDocument()
    }
    expect(screen.getAllByRole('row')).toHaveLength(labs.length + 1) // + header
  })
  it('links every room to its resolved href', () => {
    render(<RoomsModule />)
    const links = screen.getAllByRole('link', { name: /open/i })
    expect(links).toHaveLength(labs.length)
    expect(links.map((l) => l.getAttribute('href'))).toContain('/')
  })
  it('summarizes counts in header chips', () => {
    render(<RoomsModule />)
    expect(screen.getByText(`${labs.length} total`)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, verify FAIL** (placeholder renders instead).

- [ ] **Step 3: Implement**

Replace `modules/rooms.tsx` wholesale. Client component, default export. Header: `h1` "Rooms" + subtitle "Exhibition inventory — sourced live from the labs manifest" + neutral Badges `${total} total`, `${live} live`, `${attic} attic`. Body: a semantic `<table>` in card chrome (`w-full`, `overflow-x-auto` wrapper):

- Columns: Room (title 13px medium + slug in mono 11px soft), Status (`Badge tone={status === 'live' ? 'ok' : 'neutral'}` labeled `live`/`attic`), Shipped (mono 12px date), Thesis (12px soft, `max-w-[420px] truncate`, `title={thesis}`), Actions (`<a href={href}>Open</a>` — plain anchor styled as 12px `--c-blue` link; internal next/link not required for a full-page lab jump).
- Header cells: 11px uppercase tracked soft, `text-left`, `border-b border-[var(--c-border)]`.
- Body rows: `border-b border-[var(--c-border)]` hairlines, `hover:bg-[var(--c-hover)]` transition, row height driven by density: `useCuratorStore((s) => s.density)` → `py-3` comfortable / `py-1.5` compact on cells.

```tsx
'use client'

import { getRoomRows } from '../adapters'
import { Badge } from '../ui/badge'
import { useCuratorStore } from '../store'

export default function RoomsModule() {
  const rows = getRoomRows()
  const density = useCuratorStore((s) => s.density)
  const pad = density === 'compact' ? 'py-1.5' : 'py-3'
  const live = rows.filter((r) => r.status === 'live').length

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="text-[18px] font-semibold">Rooms</h1>
          <p className="text-[12px] text-[var(--c-text-soft)]">
            Exhibition inventory — sourced live from the labs manifest
          </p>
        </div>
        <Badge>{rows.length} total</Badge>
        <Badge tone="ok">{live} live</Badge>
        <Badge>{rows.length - live} attic</Badge>
      </header>
      <div className="overflow-x-auto rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)]">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--c-border)]">
              {['Room', 'Status', 'Shipped', 'Thesis', ''].map((h, i) => (
                <th key={i} className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug} className="border-b border-[var(--c-border)] transition-colors duration-150 last:border-0 hover:bg-[var(--c-hover)]">
                <td className={`px-4 ${pad}`}>
                  <p className="text-[13px] font-medium">{r.title}</p>
                  <p className="font-[family-name:var(--font-data)] text-[11px] text-[var(--c-text-soft)]">{r.slug}</p>
                </td>
                <td className={`px-4 ${pad}`}><Badge tone={r.status === 'live' ? 'ok' : 'neutral'}>{r.status}</Badge></td>
                <td className={`px-4 ${pad} font-[family-name:var(--font-data)] text-[12px] tabular-nums`}>{r.date}</td>
                <td className={`px-4 ${pad} max-w-[420px] truncate text-[12px] text-[var(--c-text-soft)]`} title={r.thesis}>{r.thesis}</td>
                <td className={`px-4 ${pad} text-right`}>
                  <a href={r.href} className="text-[12px] font-medium text-[var(--c-blue)] hover:underline">Open</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests, verify PASS.** Browser check the module.

- [ ] **Step 5: Commit**

```bash
git add components/labs/curator/modules/rooms.tsx __tests__/labs/curator/rooms.test.tsx
git commit -m "feat(labs/curator): rooms module fed from labs manifest"
```

---

### Task 10: Table core (TDD) + Personnel module + CSV export

**Files:**
- Create: `components/labs/curator/ui/table-core.ts`
- Replace: `components/labs/curator/modules/personnel.tsx`
- Test: `__tests__/labs/curator/table-core.test.ts`
- Test: `__tests__/labs/curator/personnel.test.tsx`

**Interfaces:**
- Consumes: `getPersonnelRows`, `PersonnelRow` (Task 3); store density; `Badge`.
- Produces (exact):

```ts
// table-core.ts — pure, no React
export type SortDir = 'asc' | 'desc'
export function sortRows<T>(rows: T[], key: keyof T, dir: SortDir): T[]          // new array; string/number aware; null sorts last
export function filterRows<T>(rows: T[], query: string, keys: (keyof T)[]): T[]  // case-insensitive substring on stringified keys
export function paginate<T>(rows: T[], page: number, pageSize: number): { rows: T[]; page: number; pageCount: number }
// page clamped to [0, pageCount-1]; pageCount ≥ 1
export function toCsv<T extends object>(rows: T[], columns: { key: keyof T; header: string }[]): string
// header row + one line per row; quote fields containing , " or newline by doubling quotes
```

- [ ] **Step 1: Write failing tests for table-core**

`__tests__/labs/curator/table-core.test.ts`:

```ts
import { sortRows, filterRows, paginate, toCsv } from '@/components/labs/curator/ui/table-core'

type Row = { name: string; years: number; end: string | null }
const rows: Row[] = [
  { name: 'beta', years: 3, end: '2023-06' },
  { name: 'Alpha', years: 8, end: null },
  { name: 'gamma', years: 5, end: '2021-10' },
]

describe('sortRows', () => {
  it('sorts strings case-insensitively, returns a new array', () => {
    const out = sortRows(rows, 'name', 'asc')
    expect(out.map((r) => r.name)).toEqual(['Alpha', 'beta', 'gamma'])
    expect(out).not.toBe(rows)
    expect(rows[0].name).toBe('beta') // input untouched
  })
  it('sorts numbers desc', () => {
    expect(sortRows(rows, 'years', 'desc').map((r) => r.years)).toEqual([8, 5, 3])
  })
  it('sorts nulls last regardless of direction', () => {
    expect(sortRows(rows, 'end', 'asc').at(-1)?.end).toBeNull()
    expect(sortRows(rows, 'end', 'desc').at(-1)?.end).toBeNull()
  })
})

describe('filterRows', () => {
  it('matches case-insensitive substrings across keys', () => {
    expect(filterRows(rows, 'ALPH', ['name'])).toHaveLength(1)
    expect(filterRows(rows, '2021', ['name', 'end'])).toHaveLength(1)
    expect(filterRows(rows, '', ['name'])).toHaveLength(3)
  })
})

describe('paginate', () => {
  it('slices pages and reports pageCount', () => {
    const p0 = paginate(rows, 0, 2)
    expect(p0.rows).toHaveLength(2)
    expect(p0.pageCount).toBe(2)
    expect(paginate(rows, 1, 2).rows).toHaveLength(1)
  })
  it('clamps out-of-range pages', () => {
    expect(paginate(rows, 99, 2).page).toBe(1)
    expect(paginate([], 0, 2).pageCount).toBe(1)
  })
})

describe('toCsv', () => {
  it('serializes with quoting', () => {
    const csv = toCsv(
      [{ a: 'plain', b: 'has, comma' }, { a: 'has "quote"', b: 'line\nbreak' }],
      [{ key: 'a', header: 'A' }, { key: 'b', header: 'B' }]
    )
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('A,B')
    expect(lines[1]).toBe('plain,"has, comma"')
    expect(lines[2]).toBe('"has ""quote""","line\nbreak"') // the \n stays inside the quoted field
  })
})
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement `table-core.ts`**

```ts
export type SortDir = 'asc' | 'desc'

export function sortRows<T>(rows: T[], key: keyof T, dir: SortDir): T[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const av = a[key]; const bv = b[key]
    if (av === null || av === undefined) return 1
    if (bv === null || bv === undefined) return -1
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign
    return String(av).localeCompare(String(bv), 'en', { sensitivity: 'base' }) * sign
  })
}

export function filterRows<T>(rows: T[], query: string, keys: (keyof T)[]): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((r) => keys.some((k) => String(r[k] ?? '').toLowerCase().includes(q)))
}

export function paginate<T>(rows: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const clamped = Math.min(Math.max(page, 0), pageCount - 1)
  return { rows: rows.slice(clamped * pageSize, (clamped + 1) * pageSize), page: clamped, pageCount }
}

const quote = (v: unknown): string => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export function toCsv<T extends object>(rows: T[], columns: { key: keyof T; header: string }[]): string {
  const head = columns.map((c) => quote(c.header)).join(',')
  const body = rows.map((r) => columns.map((c) => quote(r[c.key])).join(','))
  return [head, ...body].join('\r\n')
}
```

- [ ] **Step 4: Run, verify PASS.**

- [ ] **Step 5: Failing tests for Personnel**

`__tests__/labs/curator/personnel.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import PersonnelModule from '@/components/labs/curator/modules/personnel'
import { experiences } from '@/data/experience'

describe('PersonnelModule', () => {
  it('paginates six records at page size 3', () => {
    render(<PersonnelModule />)
    expect(screen.getByText(`Page 1 of ${Math.ceil(experiences.length / 3)}`)).toBeInTheDocument()
    expect(screen.getAllByTestId('personnel-row')).toHaveLength(3)
  })
  it('navigates pages', () => {
    render(<PersonnelModule />)
    fireEvent.click(screen.getByRole('button', { name: /next page/i }))
    expect(screen.getByText(/Page 2 of/)).toBeInTheDocument()
  })
  it('filters records and resets to page 1', () => {
    render(<PersonnelModule />)
    fireEvent.change(screen.getByPlaceholderText(/filter records/i), { target: { value: 'accenture' } })
    expect(screen.getAllByTestId('personnel-row')).toHaveLength(1)
    expect(screen.getByText('Accenture')).toBeInTheDocument()
  })
  it('sorts by company when header clicked', () => {
    render(<PersonnelModule />)
    fireEvent.click(screen.getByRole('button', { name: /sort by company/i }))
    const first = screen.getAllByTestId('personnel-row')[0]
    expect(first).toHaveTextContent('360dialog')
  })
  it('expands a row to show highlights', () => {
    render(<PersonnelModule />)
    fireEvent.click(screen.getAllByRole('button', { name: /expand record/i })[0])
    expect(screen.getByText(experiences[0].highlights[0])).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run, verify FAIL. Then implement `modules/personnel.tsx`**

Client, default export. Local state: `{ sortKey: 'startDate' as keyof PersonnelRow, sortDir: 'desc' as SortDir, query: '', page: 0, expandedId: null as string | null }` (single `useState` object, updated immutably). Derivation order: `filterRows(getPersonnelRows(), query, ['company','role','location','technologies' as never]) → sortRows → paginate(…, page, 3)` — memoize with `useMemo`. Note: `technologies` is an array — `filterRows` stringifies, which matches spec behavior. Query changes reset `page` to 0.

Layout:
- Header: `h1` "Personnel" + subtitle "Workforce records — 1 active resource" + right-aligned controls: filter `<input placeholder="Filter records…">` (card-chrome input, 240px), `Export CSV` secondary button.
- Table columns: Company (sortable), Role, Location, Start (sortable, mono), Tenure (sortable numeric, mono `${tenureMonths} mo`), Status (`Badge tone={endDate === null ? 'ok' : 'neutral'}` → `active`/`archived`), expand chevron button (`aria-label="Expand record"`).
- Sortable headers are `<button aria-label={\`Sort by ${label}\`}>` with ▲/▼ affix when active; click toggles direction, sets key.
- Expanded row (`expandedId`): a full-width `<tr>` under the record — description 12px, highlights as bullet list, technologies as neutral Badges. Row has `data-testid="personnel-row"` on record rows only (not the expansion row).
- Footer bar: mono 11px `Page {page+1} of {pageCount}` + `Previous page` / `Next page` buttons (hairline, disabled at bounds).
- `Export CSV`: `toCsv(allFilteredSortedRows, [{key:'company',header:'Company'},{key:'role',header:'Role'},{key:'location',header:'Location'},{key:'period',header:'Period'},{key:'tenureMonths',header:'Tenure (months)'},{key:'description',header:'Description'}])` → `new Blob([csv], { type: 'text/csv' })` → temp `<a download="personnel-records.csv">` click → `URL.revokeObjectURL`.
- Density from store as in Task 9.

- [ ] **Step 7: Run all Task-10 tests, verify PASS. Browser check: sort, filter, paginate, expand, export downloads a well-formed CSV.**

- [ ] **Step 8: Commit**

```bash
git add components/labs/curator/ui/table-core.ts components/labs/curator/modules/personnel.tsx __tests__/labs/curator
git commit -m "feat(labs/curator): table core and personnel module with csv export"
```

---

### Task 11: Pipeline kanban (dnd-kit)

**Files:**
- Replace: `components/labs/curator/modules/pipeline.tsx`
- Create: `components/labs/curator/ui/deal-card.tsx`
- Test: `__tests__/labs/curator/pipeline.test.tsx`

**Interfaces:**
- Consumes: store (`pipeline`, `movePipelineCard`, `PIPELINE_COLUMNS`), `getDealCards`, `OPEN_DEAL_ID` (Task 3), `Badge`.
- Produces: default export `PipelineModule`; `DealCardView({ deal, dragging }: { deal: DealCard; dragging?: boolean })`.

- [ ] **Step 1: Write failing tests**

DnD interaction itself is e2e territory (Task 19); unit tests cover rendering from store state + the store move (already covered in Task 7) + column wiring:

`__tests__/labs/curator/pipeline.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import PipelineModule from '@/components/labs/curator/modules/pipeline'
import { useCuratorStore } from '@/components/labs/curator/store'
import { OPEN_DEAL_ID } from '@/components/labs/curator/adapters'
import { experiences } from '@/data/experience'

const initial = useCuratorStore.getState()
beforeEach(() => useCuratorStore.setState(initial, true))

describe('PipelineModule', () => {
  it('renders four columns with counts', () => {
    render(<PipelineModule />)
    const closedWon = screen.getByTestId('column-closed-won')
    expect(within(closedWon).getAllByTestId('deal-card')).toHaveLength(experiences.length)
    expect(within(screen.getByTestId('column-sourced')).getByText('Your Company')).toBeInTheDocument()
  })
  it('reflects store moves', () => {
    useCuratorStore.getState().movePipelineCard(OPEN_DEAL_ID, 'offer', 0)
    render(<PipelineModule />)
    expect(within(screen.getByTestId('column-offer')).getByText('Your Company')).toBeInTheDocument()
  })
  it('renders tenure as the deal value on won cards', () => {
    render(<PipelineModule />)
    const closedWon = screen.getByTestId('column-closed-won')
    expect(within(closedWon).getAllByText(/\d+ mo/).length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run, verify FAIL. Then implement.**

`ui/deal-card.tsx` — presentation only:

```tsx
import type { DealCard } from '../adapters'
import { Badge } from './badge'

export function DealCardView({ deal, dragging = false }: { deal: DealCard; dragging?: boolean }) {
  return (
    <div
      data-testid="deal-card"
      className={`rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] p-3 transition-opacity duration-150 ${dragging ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] font-medium">{deal.company}</p>
        {deal.id === 'your-company'
          ? <Badge tone="warn">open</Badge>
          : <Badge tone="ok">won</Badge>}
      </div>
      <p className="mt-0.5 truncate text-[12px] text-[var(--c-text-soft)]">{deal.role}</p>
      <div className="mt-2 flex items-center justify-between font-[family-name:var(--font-data)] text-[11px] text-[var(--c-text-soft)]">
        <span>{deal.period}</span>
        {deal.tenureMonths > 0 && <span className="tabular-nums">{deal.tenureMonths} mo</span>}
      </div>
    </div>
  )
}
```

`modules/pipeline.tsx` — dnd-kit wiring:

- `deals = useMemo(() => new Map(getDealCards().map((d) => [d.id, d])), [])`; `pipeline` + `movePipelineCard` from store.
- `DndContext` with `sensors={useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))}`.
- One `SortableContext` per column (`items: pipeline[col.id]`, `strategy: verticalListSortingStrategy`); each card is a `useSortable({ id })` wrapper around `DealCardView` (`transform`/`transition` via `@dnd-kit/utilities` `CSS.Transform.toString`, `{...attributes} {...listeners}`); each column registers `useDroppable({ id: \`col-${col.id}\` })` on its card-list container so drops on empty columns resolve.
- `onDragEnd({ active, over })`: if no `over`, return. Resolve target column: `over.id` startsWith `col-` → that column at index = column length; otherwise find the column containing `String(over.id)` and use its index there. Call `movePipelineCard(String(active.id), targetColumn, targetIndex)`.
- `DragOverlay` renders `DealCardView dragging` for the active id (null-safe).
- Column shell: `data-testid={\`column-${col.id}\`}`, header = 11px tracked label + mono count, body = `space-y-2 min-h-[80px]`. Grid `lg:grid-cols-4`, below `lg`: `grid-flow-col auto-cols-[260px] overflow-x-auto` horizontal scroll.
- Header: `h1` "Pipeline" + subtitle "Opportunity management — win rate 100%" (that is a real number computed as `won/(won+0 lost)`, not a gag).

- [ ] **Step 3: Run tests, verify PASS. Browser check: drag the open deal Sourced → Offer with mouse; reload — placement persists (store persist); keyboard: tab to card, space to lift, arrows to move, space to drop.**

- [ ] **Step 4: Commit**

```bash
git add components/labs/curator/modules/pipeline.tsx components/labs/curator/ui/deal-card.tsx __tests__/labs/curator/pipeline.test.tsx
git commit -m "feat(labs/curator): drag-and-drop pipeline kanban"
```

---

### Task 12: Tickets — multi-step form (zod per step, TDD)

**Files:**
- Create: `components/labs/curator/ticket-schema.ts`
- Replace: `components/labs/curator/modules/tickets.tsx`
- Test: `__tests__/labs/curator/ticket-schema.test.ts`
- Test: `__tests__/labs/curator/tickets.test.tsx`

**Interfaces:**
- Consumes: store `pushToast`; `siteConfig.email` from `@/lib/constants`.
- Produces (exact):

```ts
// ticket-schema.ts
import { z } from 'zod'
export const requesterSchema = z.object({
  name: z.string().min(2, 'Enter your full name.'),
  email: z.string().email('Enter a valid email address.'),
})
export const detailsSchema = z.object({
  category: z.enum(['job-opportunity', 'freelance', 'speaking', 'other']),
  priority: z.enum(['low', 'normal', 'high']),
  message: z.string().min(20, 'Describe the request in at least 20 characters.'),
})
export const ticketSchema = requesterSchema.merge(detailsSchema)
export type TicketDraft = z.infer<typeof ticketSchema>
export const CATEGORY_LABELS: Record<TicketDraft['category'], string>
export function ticketId(seed: number): string          // 'AY-' + 4-digit zero-padded (1000 + seed % 9000)
export function ticketMailto(draft: TicketDraft, to: string): string  // mailto with subject/body encoded
```

- [ ] **Step 1: Write failing schema tests**

`__tests__/labs/curator/ticket-schema.test.ts`:

```ts
import { requesterSchema, detailsSchema, ticketId, ticketMailto } from '@/components/labs/curator/ticket-schema'

describe('ticket schemas', () => {
  it('accepts a valid requester', () => {
    expect(requesterSchema.safeParse({ name: 'Jane Doe', email: 'j@d.co' }).success).toBe(true)
  })
  it('rejects short names and bad emails with messages', () => {
    const r = requesterSchema.safeParse({ name: 'J', email: 'nope' })
    expect(r.success).toBe(false)
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message)
      expect(msgs).toContain('Enter your full name.')
      expect(msgs).toContain('Enter a valid email address.')
    }
  })
  it('enforces the message floor', () => {
    expect(detailsSchema.safeParse({ category: 'other', priority: 'low', message: 'too short' }).success).toBe(false)
  })
})

describe('ticket helpers', () => {
  it('formats ids', () => {
    expect(ticketId(0)).toMatch(/^AY-\d{4}$/)
    expect(ticketId(1)).not.toBe(ticketId(2))
  })
  it('builds a mailto with encoded subject and body', () => {
    const url = ticketMailto(
      { name: 'Jane', email: 'j@d.co', category: 'job-opportunity', priority: 'high', message: 'A serious inquiry about a role.' },
      'me@example.com'
    )
    expect(url.startsWith('mailto:me@example.com?subject=')).toBe(true)
    expect(url).toContain(encodeURIComponent('Job opportunity'))
    expect(url).toContain(encodeURIComponent('A serious inquiry'))
  })
})
```

- [ ] **Step 2: Run, verify FAIL. Implement `ticket-schema.ts`** (schemas as above, plus):

```ts
export const CATEGORY_LABELS: Record<TicketDraft['category'], string> = {
  'job-opportunity': 'Job opportunity',
  freelance: 'Freelance',
  speaking: 'Speaking',
  other: 'Other',
}

export function ticketId(seed: number): string {
  return `AY-${String(1000 + ((seed * 2654435761) % 9000 + 9000) % 9000).padStart(4, '0')}`
}

export function ticketMailto(draft: TicketDraft, to: string): string {
  const subject = `[${CATEGORY_LABELS[draft.category]}] Inquiry from ${draft.name}`
  const body = `Priority: ${draft.priority}\nFrom: ${draft.name} <${draft.email}>\n\n${draft.message}`
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
```

- [ ] **Step 3: Run, verify PASS.**

- [ ] **Step 4: Failing tests for the module**

`__tests__/labs/curator/tickets.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import TicketsModule from '@/components/labs/curator/modules/tickets'
import { useCuratorStore } from '@/components/labs/curator/store'

const initial = useCuratorStore.getState()
beforeEach(() => useCuratorStore.setState(initial, true))

const fillStep1 = () => {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Recruiter' } })
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@corp.com' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
}

describe('TicketsModule', () => {
  it('blocks step 1 on invalid input', () => {
    render(<TicketsModule />)
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText('Enter your full name.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/message/i)).not.toBeInTheDocument()
  })
  it('advances through details to review with entered data', () => {
    render(<TicketsModule />)
    fillStep1()
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'We would like to discuss a senior frontend role.' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/review/i)).toBeInTheDocument()
    expect(screen.getByText('Jane Recruiter')).toBeInTheDocument()
  })
  it('submits: toast raised and form resets', () => {
    render(<TicketsModule />)
    fillStep1()
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'We would like to discuss a senior frontend role.' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit ticket/i }))
    expect(useCuratorStore.getState().toasts[0].title).toMatch(/^Ticket AY-\d{4} created$/)
    expect(screen.getByLabelText(/full name/i)).toHaveValue('')
  })
  it('supports going back without losing data', () => {
    render(<TicketsModule />)
    fillStep1()
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Jane Recruiter')
  })
})
```

- [ ] **Step 5: Run, verify FAIL. Implement `modules/tickets.tsx`**

Client, default export. State: `step: 0 | 1 | 2`, `draft: Partial<TicketDraft>` (spread-updated), `errors: Record<string, string>`. Step gating: `requesterSchema.safeParse` on step 0 → `detailsSchema.safeParse` on step 1 — on failure, map `issues` to `errors[field]` (first message per field) rendered 11px `--c-bad` under inputs; on success merge into draft, clear errors, advance.

- Progress indicator: three steps ("Requester", "Details", "Review") as small circles + labels; completed = navy fill, current = blue ring, upcoming = hairline.
- Step 0: labeled inputs Full name / Email.
- Step 1: Category `<select>` (CATEGORY_LABELS), Priority radio row (low/normal/high — hairline pills, checked = navy), Message `<textarea rows={5}>` with label.
- Step 2 (Review): definition list of all values (labels 11px tracked soft, values 13px; message pre-wrap) + buttons `Back` and `Submit ticket` (primary).
- Submit: `const id = ticketId(Date.now())` → `pushToast({ title: \`Ticket ${id} created\`, description: 'Expected response time: 1 business day.' })` → `window.open(ticketMailto(fullDraft, siteConfig.email), '_self')`? No — `window.location.href = ticketMailto(…)` triggers the mail client; in jsdom this is a no-op assignment (safe for tests). Then reset `step: 0, draft: {}, errors: {}`.
- `Back` buttons on steps 1–2 return one step, keeping draft.
- Header: `h1` "Tickets" + subtitle "Support requests route directly to the operator."
- Card width: `max-w-[560px]`.

- [ ] **Step 6: Run, verify PASS. Browser check the full flow; the mail client opens prefilled.**

- [ ] **Step 7: Commit**

```bash
git add components/labs/curator/ticket-schema.ts components/labs/curator/modules/tickets.tsx __tests__/labs/curator
git commit -m "feat(labs/curator): multi-step ticket form with zod validation"
```

---

### Task 13: Engineering briefs — annotations, SPEC chips, Engineering module

**Files:**
- Create: `components/labs/curator/annotations.ts`
- Create: `components/labs/curator/ui/spec-chip.tsx`
- Replace: `components/labs/curator/modules/engineering.tsx`
- Modify: modules overview/rooms/personnel/pipeline/tickets + `login-screen.tsx` + `app-shell.tsx` (mount chips)
- Test: `__tests__/labs/curator/annotations.test.tsx`

**Interfaces:**
- Consumes: `useEscCapture` (Task 6).
- Produces (exact):

```ts
// annotations.ts
export type EngineeringBrief = {
  id: string          // 'EB-001'…
  area: 'Platform' | 'State' | 'Data' | 'Interaction' | 'Forms' | 'Performance'
  title: string
  stack: string       // comma-separated tech
  pattern: string     // 1-2 sentences, what the mechanism is
  rationale: string   // 1-2 sentences, why
}
export const briefs: EngineeringBrief[]
export function getBrief(id: string): EngineeringBrief   // throws on unknown id (fail loud in dev/test)
// spec-chip.tsx
export function SpecChip({ briefId }: { briefId: string }): JSX.Element
```

- [ ] **Step 1: Author the briefs** (content task — write all nine, corporate-doc voice, technically accurate):

| id | area | title | anchors |
|---|---|---|---|
| EB-001 | Platform | Session Management | HS256 JWT via `jose`; HTTP-only SameSite=Lax cookie; RSC verification; demo issuance policy stated openly |
| EB-002 | State | Client State Architecture | Zustand + Immer + persist; partialized slice; single store, module-scoped selectors |
| EB-003 | Data | Single Source of Truth | rooms/personnel/pipeline derive from `data/*` + labs manifest through one adapter layer |
| EB-004 | Data | Analytics Abstraction | `AnalyticsSource` interface; seeded deterministic simulation; GA implementation slots in behind the same contract |
| EB-005 | Interaction | Drag-and-Drop | dnd-kit sensors (pointer distance 4px, touch delay 150ms, keyboard); per-column sortable contexts; store-persisted placement |
| EB-006 | Forms | Validation Strategy | per-step zod schemas shared shape with the API route; inline field errors; no validation library beyond zod |
| EB-007 | Data | Table Logic | pure sort/filter/paginate functions, unit-tested independent of React |
| EB-008 | Performance | Module Code-Splitting | each module behind `next/dynamic` with skeleton fallback; charts hand-rolled SVG, zero chart-library bytes |
| EB-009 | Platform | Design Tokens | CSS custom properties scoped to the lab root; hairline-not-shadow structure; Inter/IBM Plex Mono split |

Example entry (write the rest in the same voice):

```ts
{
  id: 'EB-001',
  area: 'Platform',
  title: 'Session Management',
  stack: 'jose, Next.js route handlers, React Server Components',
  pattern:
    'Stateless sessions are issued as HS256-signed JSON Web Tokens and delivered in an HTTP-only, SameSite=Lax cookie. The token is verified server-side in the RSC layer on every request.',
  rationale:
    'Client JavaScript never touches the credential, eliminating token exfiltration via XSS. Demo deployment note: all credentials are accepted by design — the integrity of the token, not its issuance, is the exhibit.',
},
```

- [ ] **Step 2: Write failing tests**

`__tests__/labs/curator/annotations.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { briefs, getBrief } from '@/components/labs/curator/annotations'
import { SpecChip } from '@/components/labs/curator/ui/spec-chip'

describe('annotations', () => {
  it('has at least nine briefs with unique sequential ids', () => {
    expect(briefs.length).toBeGreaterThanOrEqual(9)
    expect(new Set(briefs.map((b) => b.id)).size).toBe(briefs.length)
    expect(briefs[0].id).toBe('EB-001')
  })
  it('getBrief throws on unknown id', () => {
    expect(() => getBrief('EB-999')).toThrow()
  })
})

describe('SpecChip', () => {
  it('opens the brief popover and closes on Escape without bubbling to GalleryChrome', () => {
    render(<SpecChip briefId="EB-001" />)
    fireEvent.click(screen.getByRole('button', { name: /spec/i }))
    expect(screen.getByText(/ENGINEERING BRIEF · EB-001/)).toBeInTheDocument()
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.body.dispatchEvent(escape)
    expect(escape.defaultPrevented).toBe(true)
    expect(screen.queryByText(/ENGINEERING BRIEF/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run, verify FAIL. Implement.**

`ui/spec-chip.tsx`: chip = `<button aria-label={\`Spec ${briefId}\`}>` styled 10px mono uppercase, hairline border, `text-[var(--c-text-soft)]`, hover `border-[var(--c-blue)] text-[var(--c-blue)]`; label text `SPEC`. Open state renders an absolutely-positioned popover card (`w-[340px]`, right-aligned to the chip, `z-40`): mono header `ENGINEERING BRIEF · {id}` 11px + title 13px semibold, then three field rows — label (`STACK` / `PATTERN` / `RATIONALE`, 10px mono tracked soft) over 12px body text. Close on: `useEscCapture(open, close)`, outside `pointerdown`, or chip re-click. Wrapper `relative inline-flex`.

`modules/engineering.tsx`: default export. Header `h1` "Engineering" + subtitle "Implementation handbook — how this console is built". Group `briefs` by `area`; each group: 11px tracked area label, then a card per brief (same field layout as the popover, wider). Footer line, 11px soft mono: "Handbook generated from annotations.ts — the same source that powers every SPEC chip."

Mount chips (pass `briefId`, place in the widget header row, right-aligned):
- overview: EB-004 on the LineChart card (add an optional `action?: ReactNode` slot to LineChart's figcaption row), EB-008 next to the page title
- rooms: EB-003 in the header
- personnel: EB-007 in the header
- pipeline: EB-005 in the header
- tickets: EB-006 in the header
- login-screen: EB-001 under the card (only pre-auth surface)
- app-shell topbar: EB-002 + EB-009 right-aligned

- [ ] **Step 4: Run tests, verify PASS** (new file + full unit run — module tests from Tasks 9–12 must still pass with chips mounted).

- [ ] **Step 5: Commit**

```bash
git add components/labs/curator __tests__/labs/curator/annotations.test.tsx
git commit -m "feat(labs/curator): engineering briefs, spec chips, handbook module"
```

---

### Task 14: Settings module

**Files:**
- Create: `components/labs/curator/ui/toggle.tsx`
- Replace: `components/labs/curator/modules/settings.tsx`
- Test: `__tests__/labs/curator/settings.test.tsx`

**Interfaces:**
- Consumes: store (`density`, `setDensity`, `notifications`, `setNotification`), `siteConfig` from `@/lib/constants`.
- Produces: `Toggle({ checked, onChange, label, description? })` — a `role="switch"` button (`aria-checked`), 36×20 track (`--c-blue` when on, `#cfd7e3` off), 16px knob translating 150ms; label 13px + optional description 12px soft, clicking anywhere in the row toggles.

- [ ] **Step 1: Write failing tests**

`__tests__/labs/curator/settings.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import SettingsModule from '@/components/labs/curator/modules/settings'
import { useCuratorStore } from '@/components/labs/curator/store'

const initial = useCuratorStore.getState()
beforeEach(() => useCuratorStore.setState(initial, true))

describe('SettingsModule', () => {
  it('switches density through the store', () => {
    render(<SettingsModule />)
    fireEvent.click(screen.getByRole('radio', { name: /compact/i }))
    expect(useCuratorStore.getState().density).toBe('compact')
  })
  it('flips notification switches', () => {
    render(<SettingsModule />)
    const sw = screen.getByRole('switch', { name: /incident alerts/i })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(sw)
    expect(useCuratorStore.getState().notifications.incidentAlerts).toBe(true)
  })
  it('renders read-only profile fields', () => {
    render(<SettingsModule />)
    expect(screen.getByDisplayValue('Aram Yeghiazaryan')).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run, verify FAIL. Implement.**

`modules/settings.tsx`: default export, `max-w-[640px] space-y-4`. Three cards:

1. **Profile** — disabled labeled inputs: Display name (`siteConfig.name`), Title (`siteConfig.title`), Location (`siteConfig.location`), Contact (`siteConfig.email`); caption 11px soft: "Profile fields are managed by your identity provider."
2. **Appearance** — Density as a `radiogroup`: two `role="radio"` pill buttons Comfortable/Compact (checked = navy fill white text) wired to `setDensity`; caption: "Density applies to all data tables."
3. **Notifications** — three `Toggle`s: Product updates ("Release notes for new rooms and modules."), Weekly digest ("A summary of portfolio activity, every Monday."), Incident alerts ("Immediate notification when anything breaks in production.") wired to `setNotification`.

Header: `h1` "Settings" + subtitle "Workspace preferences". Persistence already covered by the store test (Task 7); the browser check confirms density survives reload and visibly changes Personnel/Rooms row height.

- [ ] **Step 3: Run, verify PASS. Browser check. Commit**

```bash
git add components/labs/curator/ui/toggle.tsx components/labs/curator/modules/settings.tsx __tests__/labs/curator/settings.test.tsx
git commit -m "feat(labs/curator): settings module with persisted preferences"
```

---

### Task 15: The NPS gag (once, ever)

**Files:**
- Create: `components/labs/curator/nps-survey.tsx`
- Modify: `components/labs/curator/app-shell.tsx` (mount `<NpsSurvey />`)
- Test: `__tests__/labs/curator/nps.test.tsx`

**Interfaces:**
- Consumes: store (`moduleVisits`, `npsDone`, `markNpsDone`, `pushToast`), `useEscCapture`.
- Produces: `<NpsSurvey />` — self-contained trigger + modal.

**Trigger contract:** show when `!npsDone && (moduleVisits >= 3 || 90s elapsed since mount)`. Timer via one `setTimeout(90_000)` armed on mount when `!npsDone`, cleared on unmount. Once shown, any resolution (score click, "Remind me later", Esc, backdrop click) calls `markNpsDone()` — persisted, so it never fires again on this browser. Score click ALSO raises `pushToast({ title: 'Thanks for your feedback' })`. "Remind me later" never reminds.

- [ ] **Step 1: Write failing tests**

`__tests__/labs/curator/nps.test.tsx`:

```tsx
import { render, screen, fireEvent, act } from '@testing-library/react'
import { NpsSurvey } from '@/components/labs/curator/nps-survey'
import { useCuratorStore } from '@/components/labs/curator/store'

const initial = useCuratorStore.getState()
beforeEach(() => {
  vi.useFakeTimers()
  useCuratorStore.setState(initial, true)
})
afterEach(() => vi.useRealTimers())

const question = /how likely are you to recommend this cv/i

describe('NpsSurvey', () => {
  it('appears after the third module switch', () => {
    render(<NpsSurvey />)
    expect(screen.queryByText(question)).not.toBeInTheDocument()
    act(() => {
      const s = useCuratorStore.getState()
      s.setModule('rooms'); s.setModule('pipeline'); s.setModule('tickets')
    })
    expect(screen.getByText(question)).toBeInTheDocument()
  })

  it('appears after 90 seconds', () => {
    render(<NpsSurvey />)
    act(() => vi.advanceTimersByTime(90_000))
    expect(screen.getByText(question)).toBeInTheDocument()
  })

  it('thanks on a score and never returns', () => {
    render(<NpsSurvey />)
    act(() => vi.advanceTimersByTime(90_000))
    fireEvent.click(screen.getByRole('button', { name: '10' }))
    expect(screen.queryByText(question)).not.toBeInTheDocument()
    expect(useCuratorStore.getState().npsDone).toBe(true)
    expect(useCuratorStore.getState().toasts[0].title).toBe('Thanks for your feedback')
  })

  it('"Remind me later" also retires it permanently', () => {
    render(<NpsSurvey />)
    act(() => vi.advanceTimersByTime(90_000))
    fireEvent.click(screen.getByRole('button', { name: /remind me later/i }))
    expect(useCuratorStore.getState().npsDone).toBe(true)
    expect(useCuratorStore.getState().toasts).toHaveLength(0)
  })

  it('never arms when already done', () => {
    useCuratorStore.getState().markNpsDone()
    render(<NpsSurvey />)
    act(() => vi.advanceTimersByTime(120_000))
    expect(screen.queryByText(question)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, verify FAIL. Implement `nps-survey.tsx`**

Client component. Local `open` state; two effects: (a) timer — arm `setTimeout(() => setOpen(true), 90_000)` when `!npsDone`, clear on unmount/`npsDone`; (b) `moduleVisits` selector — `useEffect` sets open when `visits >= 3 && !npsDone`. Guard rendering with `!npsDone`.

Modal: fixed inset backdrop `bg-[rgba(12,35,64,0.4)]` `z-50`, centered card `max-w-[420px]`: 13px semibold "How likely are you to recommend this CV to a colleague or recruiter?", 12px soft "Your feedback helps us improve the candidate experience.", 0–10 as a row of 11 square hairline buttons (28px, hover navy fill white text, mono numerals), footer row: anchors "Not likely at all" / "Extremely likely" in 10px soft + `Remind me later` text button. Resolution paths per the trigger contract. `role="dialog" aria-modal="true"` + `useEscCapture(open, resolveDismiss)`. No exit animation (framer-motion exit + fake timers is a known trap — plain conditional render).

Mount `<NpsSurvey />` once in `app-shell.tsx` beside `<ToastViewport />`.

- [ ] **Step 3: Run, verify PASS** (file + full unit run). Browser check: fresh profile (clear localStorage) → survey at 90s or 3rd module click; answer; reload — never again.

- [ ] **Step 4: Commit**

```bash
git add components/labs/curator/nps-survey.tsx components/labs/curator/app-shell.tsx __tests__/labs/curator/nps.test.tsx
git commit -m "feat(labs/curator): the one gag — single-fire nps survey"
```

---

### Task 16: Crawlable CV block

**Files:**
- Create: `components/labs/curator/crawlable-cv.tsx`
- Modify: `app/labs/curator/page.tsx` (render it outside the auth branch)
- Test: `__tests__/labs/curator/crawlable-cv.test.tsx`

**Interfaces:**
- Consumes: `experiences`, `projects`, `skills` from `@/data`; `siteConfig`, `socialLinks` from `@/lib/constants`; `briefs` (Task 13).
- Produces: `<CuratorCrawlableCv />` — same self-removing pattern as `components/labs/xp/crawlable-cv.tsx`: `'use client'`, renders full server-HTML content inside `<section aria-label="curriculum vitae" className="sr-only">`, returns `null` once hydrated. Content: name/title/description, experience list (role, company, period, description), projects, skills, contact links — PLUS an "Engineering notes" section listing each brief's `title`, `pattern` and `rationale` (the handbook is crawlable even though the app is behind the demo login).

- [ ] **Step 1: Write failing test**

`__tests__/labs/curator/crawlable-cv.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { CuratorCrawlableCv } from '@/components/labs/curator/crawlable-cv'
import { experiences } from '@/data/experience'
import { briefs } from '@/components/labs/curator/annotations'

describe('CuratorCrawlableCv', () => {
  it('server-renders the full cv and engineering notes', () => {
    const html = renderToStaticMarkup(<CuratorCrawlableCv />)
    expect(html).toContain('Aram Yeghiazaryan')
    for (const e of experiences) expect(html).toContain(e.company)
    for (const b of briefs) expect(html).toContain(b.title)
  })
})
```

- [ ] **Step 2: Run, verify FAIL. Implement, mirroring the XP pattern** (hydration effect + `sr-only`). In `page.tsx`, render `<CuratorCrawlableCv />` as a sibling of `<CuratorRoot />` inside `GalleryChrome` — present for crawlers whether or not a session exists.

- [ ] **Step 3: Run, verify PASS. Also verify logged-out `curl -s http://localhost:3017/labs/curator | grep -c "xDataGroup"` ≥ 1.**

- [ ] **Step 4: Commit**

```bash
git add components/labs/curator/crawlable-cv.tsx app/labs/curator/page.tsx __tests__/labs/curator/crawlable-cv.test.tsx
git commit -m "feat(labs/curator): crawlable cv with engineering notes"
```

---

### Task 17: Responsive / touch pass

**Files:**
- Modify: `components/labs/curator/app-shell.tsx` (drawer sidebar below `lg`)
- Modify: `components/labs/curator/modules/personnel.tsx`, `modules/rooms.tsx` (already `overflow-x-auto`; verify + card-stack tweaks)
- Modify: `components/labs/curator/login-screen.tsx` (padding/viewport fit)
- Test: extend `__tests__/labs/curator/module-host.test.tsx` (drawer state assertions via store)

**Requirements:**
- Below `lg` (1024px): sidebar hidden (`hidden lg:flex`); topbar gains a hamburger button (`aria-label="Open navigation"`) → `setSidebarOpen(true)`; drawer = fixed left panel (same navy content) + backdrop; closes on nav selection, backdrop `pointerdown`, and `useEscCapture(sidebarOpen, close)`.
- All tap targets ≥ 40px on touch; add `touch-action: manipulation` on nav buttons, kanban cards, NPS score buttons (the XP lesson).
- Kanban: horizontal scroll (Task 11 already specifies `auto-cols-[260px]`); verify TouchSensor press-delay drag works.
- Tables: horizontal scroll is the enterprise-honest behavior — keep `overflow-x-auto`, but hide the Thesis column below `md` (`hidden md:table-cell`) and Location/Start below `md` in Personnel.
- Login card: `mx-4` and `max-h` safe on 640×360.

**Steps:** (1) failing test — after `setSidebarOpen(true)`, drawer nav is in the document and selecting a module closes it (assert store `sidebarOpen === false`); (2) implement; (3) run unit suite; (4) browser check at 390px width (login → dashboard → drawer → kanban drag by touch emulation); (5) commit `feat(labs/curator): responsive drawer and touch affordances`.

---

### Task 18: Poster, manifest entry, museum hang

**Files:**
- Create: `scripts/posters/curator-poster.html`
- Create: `scripts/posters/capture-curator.mjs`
- Create: `public/labs/curator/poster.jpg` (generated)
- Modify: `lib/labs-manifest.ts` (add entry)

**Steps:**

- [ ] **Step 1: Poster art.** `curator-poster.html`: a 900×1200 (3:4) static composition of the dashboard — navy sidebar strip, white content, KPI cards, a drawn line chart (inline SVG path), kanban column hints — rendered big and readable as a thumbnail; typography per tokens (system Inter fallback is fine in the poster). Follow the structure of `scripts/posters/xp-poster.html`.
- [ ] **Step 2: Capture.** `capture-curator.mjs` mirrors `capture-xp.mjs`: playwright chromium loads the html, screenshots 900×1200, writes JPEG quality ~80 to `public/labs/curator/poster.jpg`. Run it; verify the file is ≤ 200 KB (re-encode at lower quality if not).
- [ ] **Step 3: Manifest entry** — append to `labs` in `lib/labs-manifest.ts`:

```ts
{
  slug: 'curator',
  title: 'Curator',
  date: '2026-07-10',
  thesis:
    'The portfolio as enterprise SaaS — a navy-and-white operations console where the museum itself is the managed asset. Every ritual played straight; the pagination paginates six rows.',
  status: 'live',
},
```

- [ ] **Step 4: Verify the hang.** Dev server → `/labs` museum: the new painting hangs with the poster (no empty wall — that means the poster path is wrong); `/labs?view=list` lists Curator; existing manifest-driven tests still green (`__tests__/components/labs/labs-list.test.tsx`); Rooms module now shows 6 rows — the single-source-of-truth payoff, confirm `rooms.test.tsx` still passes (it derives from the manifest, so it must).
- [ ] **Step 5: Commit** `feat(labs/curator): poster, manifest entry, museum hang`.

---

### Task 19: E2E suite

**Files:**
- Create: `e2e/labs-curator.spec.ts`

**Conventions:** follow `e2e/labs-xp.spec.ts` style. Login helper used by most tests:

```ts
import { test, expect, type Page } from '@playwright/test'

const signIn = async (page: Page) => {
  await page.goto('/labs/curator')
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
}
```

**Scenarios (one `test` each):**
1. **Login gate:** logged-out `/labs/curator` shows the login card; signing in with the pre-filled demo credentials lands on Overview; the `curator_session` cookie is HttpOnly (`(await page.context().cookies()).find(c => c.name === 'curator_session')?.httpOnly === true`).
2. **Module nav + URL:** click Personnel → URL contains `?m=personnel`; reload keeps Personnel; deep-link `?m=engineering` renders the handbook.
3. **Personnel table:** paginate to page 2 and back; filter `accenture` → 1 row.
4. **Pipeline drag:** `signIn` → Pipeline; drag the "Your Company" card to the Offer column with `page.dragAndDrop('[data-testid="column-sourced"] [data-testid="deal-card"]', '[data-testid="column-offer"]')` (fallback: manual `mouse.down/move/up` around `boundingBox()` centers if dragAndDrop misses dnd-kit's 4px threshold); reload → card still in Offer (persisted).
5. **Ticket flow:** fill step 1 → details (message ≥ 20 chars) → review → submit → toast `Ticket AY-` visible.
6. **NPS once:** switch modules 3× → survey visible → click score 9 → "Thanks for your feedback" toast; reload, switch 3× again → survey does NOT reappear.
7. **Esc ordering:** open a SPEC popover → press Escape → popover closes AND URL still on `/labs/curator`; press Escape again with nothing open → lands on `/labs`. Settle the URL assertion with `await expect(page).toHaveURL(/\/labs$/, { timeout: 10_000 })` (dev-server compile latency false-green lesson).
8. **Crawlable:** `page.request.get('/labs/curator')` body contains `xDataGroup` and `Session Management` when logged out.

Keep localStorage/cookies isolated per test (Playwright default contexts do this).

- [ ] **Run:** `E2E_PORT=3017 pnpm test:e2e -- --project=chromium e2e/labs-curator.spec.ts` — all green. Then the full matrix for this spec: add `--project=mobile-chrome` run; fix what surfaces (touch drawer, drag threshold).
- [ ] **Commit** `test(labs/curator): e2e coverage for login, modules, dnd, nps, esc`.

---

### Task 20: Final verification & polish gate

**Steps:**

- [ ] **Step 1: Full suites.** `pnpm lint` clean; `pnpm vitest --project unit --run` all green; `pnpm test:coverage` — curator files ≥ 80% lines (add targeted tests if any module fell short); `E2E_PORT=3017 pnpm test:e2e -- --project=chromium` green (known pre-existing failure on main: `navigation.spec.ts` hero test — not ours, do not fix here).
- [ ] **Step 2: Production build.** `pnpm build` succeeds; confirm the curator route chunk stays lean — `@dnd-kit` must appear only in the pipeline module chunk (dynamic import boundary), and no three.js in the curator route.
- [ ] **Step 3: Chrome playtest (orchestrator).** Full pass at desktop + 390px: login → every module → drag → ticket → NPS → settings density → sign out → Esc to museum → museum painting opens the lab. Screenshot set for the user.
- [ ] **Step 4: Console audit.** No `console.log` in any `components/labs/curator/**` or test file (Stop-hook will check too).
- [ ] **Step 5: Commit any polish as** `fix(labs/curator): …` **— then hand to the finishing-a-development-branch flow (PR to main).**

---

## Plan Self-Review Notes (author-time)

- Spec coverage walked: concept/tone (Tasks 1, 15), brand system (1, 2), auth (5, 6), all 7 modules (4, 9–14), briefs+chips (13), analytics interface + GA seam (3), NPS (15), Esc ordering (6, 13, 15, 19), touch (11, 17), reduced motion (1, 4, 8), crawlability (16), series requirements (1 metadata, 18 poster+manifest, GalleryChrome from Task 1), testing (throughout + 19, 20), Gate 0 (4).
- Type/name consistency: `CuratorModule`/`MODULE_IDS` live in `store.ts` from Task 7 (Task 1 hosts them temporarily in app-shell — Task 7 explicitly moves them); `PipelineColumn` originates in `adapters.ts` (Task 3) and is imported by the store; `TrafficPoint` originates in `analytics-source.ts` and is imported by `LineChart`.
- Deliberate scope cuts (YAGNI): no theme switcher, no react-hook-form (hand state + zod is the exhibit), no chart/table libraries, no real analytics wiring, no i18n.
