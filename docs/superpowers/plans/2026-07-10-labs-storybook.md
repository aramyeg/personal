# Style Lab #5 "Storybook" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/labs/storybook` — the portfolio as a WebGL fantasy pop-up book ("A Tale of Six Kingdoms"): burgundy tome on a candlelit desk, animated page turns, paper-cutout pop-up scenes per career chapter, fairy-tale narration with real fact-plaques, plain crawlable fallback.

**Architecture:** Fixed-camera react-three-fiber scene (lazy chunk) renders the book: covers, page blocks, a curl-deformed turning page, and per-spread pop-up layers (textured planes hinged on the page). All text is real HTML overlaid on the resting spread, synced via camera projection. A Zustand turn machine owns discrete state; continuous animation lives in refs inside the r3f loop. Plain view + sr-only crawlable tale cover bots/reduced-motion/no-WebGL.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, @react-three/fiber 9 + three 0.185 (already installed), Zustand+Immer, @fontsource-variable/grenze-gotisch + alegreya + @fontsource/alegreya-sc (new deps), Vitest (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-07-10-labs-storybook-design.md` — colors §3.1, narration copy §4, motion §6, asset manifest §8.5.

## Global Constraints

- Work happens in the `labs-storybook` worktree on branch `worktree-labs-storybook`.
- three.js/r3f must NEVER enter the route's initial JS chunk — everything under `components/labs/storybook/book/` loads via `next/dynamic({ ssr: false })`.
- All copy: chapter narration is copied VERBATIM from spec §4. Chapter VI never says "lead/leading" (no-lead-title-claims).
- All facts (company, role, period, location, highlights) come from `data/experience.ts` at render time — never hardcoded in lab copy. Skills from `data/skills.ts`, contact from `lib/constants.ts`.
- Colors only via CSS variables / exported TS constants defined once (spec §3.1). No ad-hoc hex in components.
- No `console.log`. No state mutation (Immer inside the store only). Files ≤ 400 lines.
- Esc is GalleryChrome's; the lab never handles Escape.
- Every commit message: conventional commits, no attribution footer.
- Run commands from the worktree root: `C:/Users/GBM/Documents/Projects/personal/.claude/worktrees/labs-storybook`.
- Unit tests: `pnpm vitest run __tests__/labs/storybook/<file> --project unit`.

## Spread model (shared vocabulary)

`spread` index 0–9: 0 cover (book closed), 1 title page, 2–7 chapters I–VI (experience ids, oldest→newest: `bluenet`, `flyerbee`, `360dialog`, `accenture`, `akna`, `xdatagroup`), 8 satchel (skills), 9 the end (contact). `SPREAD_COUNT = 10`.

World space: book centered at origin lying on the XZ plane, spine along Z. Page size `PAGE_W = 1.15` (x, spine→edge), `PAGE_H = 1.5` (z). Page local z ∈ [-0.75, +0.75], far (screen-top) edge is -z. Camera fixed at `(0, 2.6, 2.9)`, fov 40, lookAt `(0, 0, 0.15)`.

---

### Task 1: Scaffold — fonts, tokens, route, loader shell

**Files:**
- Modify: `package.json` (via pnpm add)
- Create: `components/labs/storybook/storybook.css`
- Create: `app/labs/storybook/page.tsx`
- Create: `components/labs/storybook/storybook-loader.tsx`

**Interfaces:**
- Produces: route `/labs/storybook`; CSS custom props `--sb-*` (spec §3.1) on `.sb-root`; font families `var(--font-sb-display)` (Grenze Gotisch), `var(--font-sb-body)` (Alegreya), `var(--font-sb-caps)` (Alegreya SC). Later tasks style against these names.

- [ ] **Step 1: Install fonts**

```bash
pnpm add @fontsource-variable/grenze-gotisch @fontsource-variable/alegreya @fontsource/alegreya-sc
```

- [ ] **Step 2: Write `components/labs/storybook/storybook.css`**

```css
/* Storybook lab tokens — spec §3.1. The lab owns its full-viewport world. */
.sb-root {
  --sb-leather: #641e26;
  --sb-leather-shadow: #4a151c;
  --sb-leather-worn: #7b2a33;
  --sb-gold: #c9a227;
  --sb-gold-bright: #e6c65a;
  --sb-gold-deep: #8f6f1a;
  --sb-paper: #e7d5a8;
  --sb-paper-aged: #c9b078;
  --sb-paper-deep: #b89c66;
  --sb-ink: #3b2a1a;
  --sb-desk: #17100b;
  --sb-candle: #ff9f4d;
  --sb-seal: #7a1f2b;

  --font-sb-display: 'Grenze Gotisch Variable', serif;
  --font-sb-body: 'Alegreya Variable', georgia, serif;
  --font-sb-caps: 'Alegreya SC', georgia, serif;

  background: var(--sb-desk);
  color: var(--sb-ink);
  font-family: var(--font-sb-body);
}

.sb-vignette {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse 70% 60% at 50% 42%, transparent 55%, rgba(0, 0, 0, 0.55) 100%);
}

/* Narration typography — used by overlay (Task 12) and plain view (Task 5). */
.sb-narration {
  font-size: clamp(1rem, 1.6vw, 1.1875rem);
  line-height: 1.62;
  max-width: 34em;
}
.sb-narration::first-letter {
  font-family: var(--font-sb-display);
  font-weight: 700;
  font-size: 3.4em;
  float: left;
  line-height: 0.82;
  padding: 0.04em 0.08em 0 0;
  color: var(--sb-gold-deep);
  background: linear-gradient(160deg, var(--sb-gold-bright), var(--sb-gold-deep));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.sb-chapter-kicker {
  font-family: var(--font-sb-caps);
  font-size: 0.8rem;
  letter-spacing: 0.14em;
  text-transform: lowercase;
  font-variant: small-caps;
  color: var(--sb-gold-deep);
}
.sb-chapter-title {
  font-family: var(--font-sb-display);
  font-weight: 600;
  font-size: clamp(1.75rem, 4vw, 2.75rem);
  line-height: 1.05;
  letter-spacing: -0.01em;
}
.sb-plaque {
  border: 1px solid var(--sb-gold);
  outline: 1px solid color-mix(in srgb, var(--sb-gold) 40%, transparent);
  outline-offset: 3px;
  padding: 0.9rem 1.1rem;
  font-family: var(--font-sb-caps);
  font-size: 0.85rem;
  line-height: 1.5;
  background: color-mix(in srgb, var(--sb-paper-aged) 30%, transparent);
}
.sb-plaque strong { font-weight: 700; letter-spacing: 0.06em; }
```

- [ ] **Step 3: Write `components/labs/storybook/storybook-loader.tsx`**

```tsx
'use client'

import './storybook.css'
import '@fontsource-variable/grenze-gotisch'
import '@fontsource-variable/alegreya'
import '@fontsource/alegreya-sc/400.css'
import '@fontsource/alegreya-sc/700.css'

/** Client entry for the lab; Task 10 swaps the placeholder for the book. */
export function StorybookLoader() {
  return (
    <div className="sb-root fixed inset-0 overflow-hidden">
      <div className="grid h-full place-items-center">
        <p className="sb-chapter-title" style={{ color: 'var(--sb-paper)' }}>
          A Tale of Six Kingdoms
        </p>
      </div>
      <div className="sb-vignette" />
    </div>
  )
}
```

- [ ] **Step 4: Write `app/labs/storybook/page.tsx`**

```tsx
import type { Metadata } from 'next'
import { GalleryChrome } from '@/components/labs/gallery-chrome'
import { StorybookLoader } from '@/components/labs/storybook/storybook-loader'

export const metadata: Metadata = {
  title: 'Storybook — Style Lab | Aram Yeghiazaryan',
  description:
    'Style Lab experiment #5: the portfolio as a fantasy pop-up book — six kingdoms, one hero, paper dragons; every page turn a small theatre.',
  openGraph: {
    title: 'Storybook — Style Lab',
    description:
      'A Tale of Six Kingdoms — the portfolio as a fantasy pop-up book. Paper dragons included.',
    images: ['/labs/storybook/poster.jpg'],
  },
}

export default function StorybookLabPage() {
  return (
    <GalleryChrome>
      <main className="fixed inset-0 overflow-hidden">
        <StorybookLoader />
      </main>
    </GalleryChrome>
  )
}
```

- [ ] **Step 5: Verify and commit**

Run: `pnpm build` → route `/labs/storybook` compiles. Then:

```bash
git add package.json pnpm-lock.yaml app/labs/storybook components/labs/storybook
git commit -m "feat(labs/storybook): scaffold route, fonts, tokens"
```

---

### Task 2: Content — chapters, narration, scene configs (TDD)

**Files:**
- Create: `components/labs/storybook/content.ts`
- Test: `__tests__/labs/storybook/content.test.ts`

**Interfaces:**
- Consumes: `experiences` from `@/data` (`Experience` has `id, company, role, location, period, description, highlights, technologies`).
- Produces:

```ts
export type LayerKind = 'backdrop' | 'midground' | 'hero' | 'foreground'
export type SceneLayer = {
  id: string            // asset id, e.g. 'ch4-hero'
  kind: LayerKind
  hingeZ: number        // page-local z of the fold line
  height: number        // standing height in world units
  width: number
  standAngle: number    // degrees from flat; 90 = vertical
  offsetX?: number      // horizontal offset from spread center
}
export type Chapter = {
  spread: number                 // 2..7
  experienceId: string           // key into experiences
  numeral: string                // 'I'..'VI'
  kicker: string                 // 'Chapter the First'
  title: string                  // 'The Inn of a Hundred Keys'
  narration: string              // spec §4 verbatim
  accents: readonly string[]     // chapter palette hexes, spec §3.1
  layers: readonly SceneLayer[]  // backdrop→foreground order
}
export const CHAPTERS: readonly Chapter[]
export const SPREAD_COUNT = 10
export const chapterForSpread(spread: number): Chapter | undefined
export const experienceFor(ch: Chapter): Experience  // throws if id missing
export const BOOK_TITLE = 'A Tale of Six Kingdoms'
export const BOOK_SUBTITLE = 'being the true chronicle of one frontend engineer’s quest'
```

- [ ] **Step 1: Write the failing test `__tests__/labs/storybook/content.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { experiences } from '@/data'
import {
  CHAPTERS,
  SPREAD_COUNT,
  chapterForSpread,
  experienceFor,
} from '@/components/labs/storybook/content'

describe('storybook content', () => {
  it('has exactly one chapter per experience, oldest first', () => {
    expect(CHAPTERS.map((c) => c.experienceId)).toEqual([
      'bluenet',
      'flyerbee',
      '360dialog',
      'accenture',
      'akna',
      'xdatagroup',
    ])
    expect(new Set(experiences.map((e) => e.id))).toEqual(
      new Set(CHAPTERS.map((c) => c.experienceId))
    )
  })

  it('maps chapters to spreads 2..7 and resolves lookups', () => {
    expect(SPREAD_COUNT).toBe(10)
    expect(CHAPTERS.map((c) => c.spread)).toEqual([2, 3, 4, 5, 6, 7])
    expect(chapterForSpread(4)?.title).toMatch(/Ravens/)
    expect(chapterForSpread(0)).toBeUndefined()
    expect(chapterForSpread(8)).toBeUndefined()
  })

  it('resolves real experience facts (never hardcoded)', () => {
    for (const ch of CHAPTERS) {
      const exp = experienceFor(ch)
      expect(exp.id).toBe(ch.experienceId)
      expect(exp.highlights.length).toBeGreaterThan(0)
    }
  })

  it('every chapter has the four pop-up layers in depth order', () => {
    for (const ch of CHAPTERS) {
      expect(ch.layers.map((l) => l.kind)).toEqual([
        'backdrop',
        'midground',
        'hero',
        'foreground',
      ])
      const zs = ch.layers.map((l) => l.hingeZ)
      expect([...zs].sort((a, b) => a - b)).toEqual(zs) // far → near
    }
  })

  it('narration respects the no-lead-claims rule', () => {
    const ch6 = CHAPTERS[5]
    expect(ch6.narration.toLowerCase()).not.toMatch(/\blead(s|ing|er)?\b/)
    expect(ch6.narration).toMatch(/apprentices/)
  })
})
```

- [ ] **Step 2: Run it — must fail** (`content` module missing).

- [ ] **Step 3: Write `components/labs/storybook/content.ts`**

Narration strings VERBATIM from spec §4 (chapters I–VI). Layer geometry defaults per chapter:

```ts
import { experiences } from '@/data'
import type { Experience } from '@/types'

export type LayerKind = 'backdrop' | 'midground' | 'hero' | 'foreground'

export type SceneLayer = {
  id: string
  kind: LayerKind
  hingeZ: number
  height: number
  width: number
  standAngle: number
  offsetX?: number
}

export type Chapter = {
  spread: number
  experienceId: string
  numeral: string
  kicker: string
  title: string
  narration: string
  accents: readonly string[]
  layers: readonly SceneLayer[]
}

export const SPREAD_COUNT = 10
export const BOOK_TITLE = 'A Tale of Six Kingdoms'
export const BOOK_SUBTITLE = 'being the true chronicle of one frontend engineer’s quest'

const layerDefaults = (ch: number): SceneLayer[] => [
  { id: `ch${ch}-backdrop`, kind: 'backdrop', hingeZ: -0.52, height: 1.05, width: 2.0, standAngle: 90 },
  { id: `ch${ch}-midground`, kind: 'midground', hingeZ: -0.18, height: 0.7, width: 1.9, standAngle: 78 },
  { id: `ch${ch}-hero`, kind: 'hero', hingeZ: 0.12, height: 0.62, width: 1.0, standAngle: 85 },
  { id: `ch${ch}-foreground`, kind: 'foreground', hingeZ: 0.48, height: 0.3, width: 2.1, standAngle: 65 },
]

export const CHAPTERS: readonly Chapter[] = [
  {
    spread: 2,
    experienceId: 'bluenet',
    numeral: 'I',
    kicker: 'Chapter the First',
    title: 'The Inn of a Hundred Keys',
    narration:
      'Once upon a time, in a stone-built city beneath a sleeping mountain, a young clerk of the merchant’s guild grew tired of selling things and resolved instead to make them. He apprenticed himself to the code-wrights of BlueNet, and his first great labor was an enchanted ledger for the Inn of a Hundred Keys — a book that knew every guest, every room, and every candle lit therein. And the innkeepers marveled, for nothing was ever lost again.',
    accents: ['#6a8f5f', '#b0603f', '#e8a978'],
    layers: layerDefaults(1),
  },
  {
    spread: 3,
    experienceId: 'flyerbee',
    numeral: 'II',
    kicker: 'Chapter the Second',
    title: 'The Carrier Swarm',
    narration:
      'Word of the apprentice’s craft crossed the mountains to the alpine city of Zürich, where the Guild of the Bee kept a thousand couriers aloft. ‘Build us a looking-glass,’ said the beekeepers, ‘that we may see every wing at once.’ So he built it from nothing at all — his first work made to be carried in a pocket — and from that day no parcel, however small, ever wandered from its path.',
    accents: ['#7d9bb5', '#8a5a3b', '#d9a441'],
    layers: layerDefaults(2),
  },
  {
    spread: 4,
    experienceId: '360dialog',
    numeral: 'III',
    kicker: 'Chapter the Third',
    title: 'The Rookery of Four Billion Ravens',
    narration:
      'In the grey citadel of Berlin stood a rookery of unusual size. Four billion ravens passed through its towers, each bearing a message, and fifty thousand merchant houses trusted them with their words. The hero — for so we may now call him — was set over the great dispatch boards, and he wrought them so well that the sky itself seemed orderly.',
    accents: ['#5a6470', '#2b2d33', '#6f5a7d', '#d98e3f'],
    layers: layerDefaults(3),
  },
  {
    spread: 5,
    experienceId: 'accenture',
    numeral: 'IV',
    kicker: 'Chapter the Fourth',
    title: 'The Vault-Dragon of the Golden Dunes',
    narration:
      'Then came a summons from the golden dunes, where a great bank kept a dragon of renown coiled about its treasure. None doubted the beast’s strength; the trouble was teaching it manners. The hero built passages of glass through which the people could reach their gold — safely, swiftly, and without waking so much as one scale — and he even taught the dragon to lease out carriages.',
    accents: ['#d9a24a', '#d96f4a', '#4f8f85', '#e6c65a'],
    layers: layerDefaults(4),
  },
  {
    spread: 6,
    experienceId: 'akna',
    numeral: 'V',
    kicker: 'Chapter the Fifth',
    title: 'The Bazaar of a Thousand Stalls',
    narration:
      'Homeward then, to the rose-stone city, where a bazaar of a thousand stalls was to be raised. The hero did not build the stalls. He did something cleverer: he carved master patterns from which any stall could be raised in a day, true and identical, by any pair of willing hands. Masons came from far away just to study the stones.',
    accents: ['#c4766a', '#a63d2f', '#e7d5a8'],
    layers: layerDefaults(5),
  },
  {
    spread: 7,
    experienceId: 'xdatagroup',
    numeral: 'VI',
    kicker: 'Chapter the Sixth',
    title: 'The Northern Treasury',
    narration:
      'And so at last the road bent north, to a kingdom of pine and long light, where a new treasury was rising — AMIO by name — with walls of glass, so the people might always see their gold. There the hero works to this day: raising vaults, drawing plans with the founders themselves, and teaching young apprentices the old craft. Whether he lives happily ever after is not yet written — the best chronicles never quite end.',
    accents: ['#2e5244', '#4fd6b8', '#8a6fd6', '#1d2a45'],
    layers: layerDefaults(6),
  },
]

export const chapterForSpread = (spread: number): Chapter | undefined =>
  CHAPTERS.find((c) => c.spread === spread)

export const experienceFor = (ch: Chapter): Experience => {
  const exp = experiences.find((e) => e.id === ch.experienceId)
  if (!exp) throw new Error(`storybook: unknown experience id ${ch.experienceId}`)
  return exp
}
```

- [ ] **Step 4: Run test — PASS.**

- [ ] **Step 5: Commit**

```bash
git add __tests__/labs/storybook/content.test.ts components/labs/storybook/content.ts
git commit -m "feat(labs/storybook): chapter content and scene configs"
```

---

### Task 3: Satchel items — skills mapping (TDD)

**Files:**
- Create: `components/labs/storybook/satchel-items.ts`
- Test: `__tests__/labs/storybook/satchel-items.test.ts`

**Interfaces:**
- Consumes: `skills` from `@/data` (`Skill = { name, years, category, level }`).
- Produces:

```ts
export type SatchelItem = {
  assetId: string       // 'item-sword' … used for art file + placeholder
  itemName: string      // 'The Ever-Sharp Sword'
  skillName: string     // exact match of a data/skills.ts name
  blurb: string         // one fantasy line
}
export const SATCHEL_ITEMS: readonly SatchelItem[]   // 6 featured items
export const satchelSkill(item: SatchelItem): Skill  // throws if missing
```

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest'
import { skills } from '@/data'
import { SATCHEL_ITEMS, satchelSkill } from '@/components/labs/storybook/satchel-items'

describe('satchel items', () => {
  it('features six items, each resolving to a real skill', () => {
    expect(SATCHEL_ITEMS).toHaveLength(6)
    for (const item of SATCHEL_ITEMS) {
      const skill = satchelSkill(item)
      expect(skills).toContainEqual(skill)
      expect(item.blurb.length).toBeGreaterThan(10)
    }
  })
  it('features the flagship skills', () => {
    const names = SATCHEL_ITEMS.map((i) => i.skillName)
    expect(names).toContain('React')
    expect(names).toContain('TypeScript')
    expect(names).toContain('React Native')
  })
})
```

- [ ] **Step 2: Run — fails.**

- [ ] **Step 3: Implement `satchel-items.ts`**

```ts
import { skills } from '@/data'
import type { Skill } from '@/types'

export type SatchelItem = {
  assetId: string
  itemName: string
  skillName: string
  blurb: string
}

export const SATCHEL_ITEMS: readonly SatchelItem[] = [
  { assetId: 'item-sword', itemName: 'The Ever-Sharp Sword', skillName: 'React', blurb: 'Eight years at his side; it has never once dulled.' },
  { assetId: 'item-spellbook', itemName: 'The Book of True Names', skillName: 'TypeScript', blurb: 'Names every thing precisely, and errors flee before it.' },
  { assetId: 'item-scroll', itemName: 'The Router’s Scroll', skillName: 'Next.js', blurb: 'Unrolls a new road wherever the hero means to walk.' },
  { assetId: 'item-potion', itemName: 'The Bear’s Draught', skillName: 'Zustand', blurb: 'A small bottle. It carries the whole kingdom’s state.' },
  { assetId: 'item-compass', itemName: 'The Wayfarer’s Compass', skillName: 'React Native', blurb: 'Points true on any device a traveler may carry.' },
  { assetId: 'item-shield', itemName: 'The Tester’s Shield', skillName: 'Jest', blurb: 'Dents from a thousand regressions; none got through.' },
]

export const satchelSkill = (item: SatchelItem): Skill => {
  const skill = skills.find((s) => s.name === item.skillName)
  if (!skill) throw new Error(`storybook: unknown skill ${item.skillName}`)
  return skill
}
```

- [ ] **Step 4: Run — PASS. Step 5: Commit** `feat(labs/storybook): satchel skill items`

---

### Task 4: View resolution (TDD)

**Files:**
- Create: `components/labs/storybook/resolve-view.ts`
- Test: `__tests__/labs/storybook/resolve-view.test.ts`

**Interfaces:**
- Produces: `export type SbView = 'book' | 'plain'`; `export function resolveSbView(i: { param: string | null; reducedMotion: boolean; webglSupported: boolean }): SbView`

Rules: `?view=plain` → plain; `?view=book` → book (even reduced-motion — explicit override); reduced motion → plain; no WebGL → plain; else book. (Touch devices get the book — unlike the museum.)

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest'
import { resolveSbView } from '@/components/labs/storybook/resolve-view'

const base = { param: null, reducedMotion: false, webglSupported: true }

describe('resolveSbView', () => {
  it('defaults to the book', () => expect(resolveSbView(base)).toBe('book'))
  it('honors explicit params', () => {
    expect(resolveSbView({ ...base, param: 'plain' })).toBe('plain')
    expect(resolveSbView({ ...base, param: 'book', reducedMotion: true })).toBe('book')
  })
  it('falls back to plain on reduced motion or no WebGL', () => {
    expect(resolveSbView({ ...base, reducedMotion: true })).toBe('plain')
    expect(resolveSbView({ ...base, webglSupported: false })).toBe('plain')
  })
})
```

- [ ] **Step 2: Run — fails. Step 3: Implement**

```ts
export type SbView = 'book' | 'plain'

export function resolveSbView(i: {
  param: string | null
  reducedMotion: boolean
  webglSupported: boolean
}): SbView {
  if (i.param === 'plain') return 'plain'
  if (i.param === 'book') return i.webglSupported ? 'book' : 'plain'
  if (i.reducedMotion || !i.webglSupported) return 'plain'
  return 'book'
}
```

- [ ] **Step 4: PASS. Step 5: Commit** `feat(labs/storybook): view resolution`

---

### Task 5: Plain tale + crawlable tale (TDD)

**Files:**
- Create: `components/labs/storybook/plain-tale.tsx`
- Create: `components/labs/storybook/crawlable-tale.tsx`
- Test: `__tests__/labs/storybook/plain-tale.test.tsx`

**Interfaces:**
- Consumes: `CHAPTERS`, `experienceFor`, `BOOK_TITLE`, `BOOK_SUBTITLE` (Task 2); `SATCHEL_ITEMS`, `satchelSkill` (Task 3); `siteConfig`, `socialLinks` from `@/lib/constants`; `skills` from `@/data`.
- Produces: `<TaleArticle />` (pure server-renderable article, reused by both), `<PlainTale />` (styled full-page reading view), `<CrawlableTale />` (`'use client'`, sr-only, removes itself post-hydration — exact pattern of `components/labs/xp/crawlable-cv.tsx`).

- [ ] **Step 1: Failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { experiences } from '@/data'
import { PlainTale } from '@/components/labs/storybook/plain-tale'

describe('PlainTale', () => {
  it('tells every kingdom with real facts', () => {
    render(<PlainTale />)
    for (const exp of experiences) {
      expect(screen.getByText(new RegExp(exp.company.replace(/[/\\]/g, '.')))).toBeInTheDocument()
      expect(screen.getAllByText(new RegExp(exp.period)).length).toBeGreaterThan(0)
    }
    expect(screen.getByText(/Vault-Dragon/)).toBeInTheDocument()
  })
  it('offers contact and the satchel', () => {
    render(<PlainTale />)
    expect(screen.getByRole('link', { name: /send a raven/i })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:')
    )
    expect(screen.getByText(/Ever-Sharp Sword/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — fails. Step 3: Implement**

`TaleArticle` inside `plain-tale.tsx`: `<article>` with book title/subtitle, then per chapter: kicker + numeral + title (`.sb-chapter-title`), narration (`.sb-narration` p), plaque (`.sb-plaque`: `<strong>{exp.company}</strong> · {exp.role} · {exp.location} · {exp.period}` + first three `exp.highlights` as a list). Then satchel section (item name, skill name, `{skill.years} years · {skill.level}`, blurb; plus a small-caps line listing ALL `skills.map(s => s.name).join(', ')`), then The End section with `mailto:${siteConfig.email}` link labelled "Send a raven" and `socialLinks` anchors. `PlainTale` wraps `TaleArticle` in `.sb-root` styled scroll page (max-w-2xl mx-auto, generous padding, `A link back: <Link href="/labs">← Gallery</Link>` is already provided by GalleryChrome — do not duplicate). `CrawlableTale`: copy the `CrawlableCv` hydration-removal pattern verbatim around `<TaleArticle />`.

- [ ] **Step 4: PASS. Step 5: Commit** `feat(labs/storybook): plain and crawlable tale views`

---

### Task 6: Turn-machine store + wheel accumulator (TDD)

**Files:**
- Create: `components/labs/storybook/store.ts`
- Test: `__tests__/labs/storybook/store.test.ts`

**Interfaces:**
- Produces:

```ts
export type TurnDir = 'next' | 'prev'
export type PageRect = { left: number; top: number; width: number; height: number } // viewport px
type SbState = {
  spread: number                  // committed spread
  turning: TurnDir | null
  queued: TurnDir | null
  soundOn: boolean
  pageRect: PageRect | null
  requestTurn: (dir: TurnDir) => void
  completeTurn: () => void
  toggleSound: () => void
  setPageRect: (r: PageRect | null) => void
}
export const useStorybookStore: UseBoundStore<StoreApi<SbState>>
// pure helper for input handling:
export type WheelAcc = { value: number; lastMs: number }
export const WHEEL_THRESHOLD = 160
export function accumulateWheel(acc: WheelAcc, deltaY: number, nowMs: number):
  { acc: WheelAcc; fire: TurnDir | null }
```

Rules: `requestTurn` ignores out-of-bounds (`next` at 9, `prev` at 0); if already turning, stores as `queued` (latest wins); `completeTurn` commits spread, then promotes a bounds-valid `queued` to `turning` (else null). `accumulateWheel`: decay `value *= 0.5^((now-last)/200)` before adding; on |value| ≥ WHEEL_THRESHOLD returns fire (`next` for positive) and resets value to 0.

- [ ] **Step 1: Failing test**

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import {
  WHEEL_THRESHOLD,
  accumulateWheel,
  useStorybookStore,
} from '@/components/labs/storybook/store'

const s = () => useStorybookStore.getState()

describe('turn machine', () => {
  beforeEach(() => useStorybookStore.setState({ spread: 0, turning: null, queued: null }))

  it('turns forward and commits', () => {
    s().requestTurn('next')
    expect(s().turning).toBe('next')
    expect(s().spread).toBe(0)
    s().completeTurn()
    expect(s().spread).toBe(1)
    expect(s().turning).toBeNull()
  })

  it('clamps at both covers', () => {
    s().requestTurn('prev')
    expect(s().turning).toBeNull()
    useStorybookStore.setState({ spread: 9 })
    s().requestTurn('next')
    expect(s().turning).toBeNull()
  })

  it('queues exactly one turn while turning, then chains it', () => {
    useStorybookStore.setState({ spread: 3 })
    s().requestTurn('next')
    s().requestTurn('next')
    s().requestTurn('prev') // latest wins
    expect(s().queued).toBe('prev')
    s().completeTurn()
    expect(s().spread).toBe(4)
    expect(s().turning).toBe('prev')
    expect(s().queued).toBeNull()
  })

  it('drops a queued turn that would go out of bounds', () => {
    useStorybookStore.setState({ spread: 8 })
    s().requestTurn('next')
    s().requestTurn('next')
    s().completeTurn()
    expect(s().spread).toBe(9)
    expect(s().turning).toBeNull()
  })
})

describe('accumulateWheel', () => {
  it('fires next after accumulated scroll and resets', () => {
    let acc = { value: 0, lastMs: 0 }
    let fire = null
    for (const t of [0, 16, 32]) {
      ;({ acc, fire } = accumulateWheel(acc, 80, t))
    }
    expect(fire).toBe('next')
    expect(acc.value).toBe(0)
  })
  it('decays stale momentum', () => {
    let { acc } = accumulateWheel({ value: 0, lastMs: 0 }, WHEEL_THRESHOLD - 1, 0)
    const r = accumulateWheel(acc, 2, 2000) // long pause → decayed
    expect(r.fire).toBeNull()
  })
})
```

- [ ] **Step 2: Run — fails. Step 3: Implement `store.ts`**

```ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { SPREAD_COUNT } from './content'

export type TurnDir = 'next' | 'prev'
export type PageRect = { left: number; top: number; width: number; height: number }

const inBounds = (spread: number, dir: TurnDir) =>
  dir === 'next' ? spread < SPREAD_COUNT - 1 : spread > 0

type SbState = {
  spread: number
  turning: TurnDir | null
  queued: TurnDir | null
  soundOn: boolean
  pageRect: PageRect | null
  requestTurn: (dir: TurnDir) => void
  completeTurn: () => void
  toggleSound: () => void
  setPageRect: (r: PageRect | null) => void
}

export const useStorybookStore = create<SbState>()(
  devtools(
    immer((set) => ({
      spread: 0,
      turning: null,
      queued: null,
      soundOn: false,
      pageRect: null,
      requestTurn: (dir) =>
        set((st) => {
          if (st.turning) {
            st.queued = dir
            return
          }
          if (inBounds(st.spread, dir)) st.turning = dir
        }),
      completeTurn: () =>
        set((st) => {
          if (!st.turning) return
          st.spread += st.turning === 'next' ? 1 : -1
          st.turning = st.queued && inBounds(st.spread, st.queued) ? st.queued : null
          st.queued = null
        }),
      toggleSound: () => set((st) => void (st.soundOn = !st.soundOn)),
      setPageRect: (r) => set((st) => void (st.pageRect = r)),
    })),
    { name: 'storybook-lab' }
  )
)

export type WheelAcc = { value: number; lastMs: number }
export const WHEEL_THRESHOLD = 160

export function accumulateWheel(
  acc: WheelAcc,
  deltaY: number,
  nowMs: number
): { acc: WheelAcc; fire: TurnDir | null } {
  const dt = Math.max(0, nowMs - acc.lastMs)
  const decayed = acc.value * Math.pow(0.5, dt / 200)
  const value = decayed + deltaY
  if (Math.abs(value) >= WHEEL_THRESHOLD) {
    return { acc: { value: 0, lastMs: nowMs }, fire: value > 0 ? 'next' : 'prev' }
  }
  return { acc: { value, lastMs: nowMs }, fire: null }
}
```

- [ ] **Step 4: PASS. Step 5: Commit** `feat(labs/storybook): turn-machine store and wheel accumulator`

---

### Task 7: Page curl geometry (TDD)

**Files:**
- Create: `components/labs/storybook/book/page-geometry.ts`
- Test: `__tests__/labs/storybook/page-geometry.test.ts`

**Interfaces:**
- Produces:

```ts
export const PAGE_W = 1.15
export const PAGE_H = 1.5
export const PAGE_SEGMENTS = 32
export const CURL_MAX = 0.55           // radians of trailing-edge lag
/** Flat page template vertices: x∈[0,PAGE_W] from spine, z∈[-PAGE_H/2,PAGE_H/2], y=0.
 *  Returns [positions, uvs, indices] arrays for a (PAGE_SEGMENTS+1)×2 vertex grid. */
export function buildPageTemplate(): { positions: Float32Array; uvs: Float32Array; indices: Uint16Array }
/** Curl deformation around the spine (z axis). dir 'next': theta 0→π.
 *  alpha(d) = theta - sign * CURL_MAX * sin(π·t) * (d/PAGE_W)^1.3 */
export function curlPositions(
  template: Float32Array,
  out: Float32Array,
  t: number,             // progress 0..1
  dir: 'next' | 'prev',
  ease: (t: number) => number
): void
export const easeTurn: (t: number) => number   // easeInOutCubic
```

Math: for each vertex, `d = template.x`; `theta = dir === 'next' ? π·ease(t) : π·(1−ease(t))`; `sign = dir === 'next' ? 1 : −1`; `alpha = theta − sign·CURL_MAX·sin(π·t)·(d/PAGE_W)^1.3`; `out.x = d·cos(alpha)`, `out.y = d·sin(alpha)` clamped ≥ 0 is NOT applied (the spiral keeps y ≥ −0.02 naturally at edges; a small +0.005 lift is added to avoid z-fighting with static pages), `out.z = template.z`.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest'
import {
  PAGE_SEGMENTS,
  PAGE_W,
  buildPageTemplate,
  curlPositions,
  easeTurn,
} from '@/components/labs/storybook/book/page-geometry'

const edgeX = (pos: Float32Array) => pos[(PAGE_SEGMENTS * 2 + 1) * 3] // a last-column vertex x

describe('page curl', () => {
  const { positions } = buildPageTemplate()
  const out = new Float32Array(positions.length)

  it('t=0 is flat on the right', () => {
    curlPositions(positions, out, 0, 'next', easeTurn)
    expect(edgeX(out)).toBeCloseTo(PAGE_W, 3)
  })
  it('t=1 lands flat on the left', () => {
    curlPositions(positions, out, 1, 'next', easeTurn)
    expect(edgeX(out)).toBeCloseTo(-PAGE_W, 2)
  })
  it('mid-turn lifts the page and lags the free edge', () => {
    curlPositions(positions, out, 0.5, 'next', easeTurn)
    // spine column stays put
    expect(out[0]).toBeCloseTo(0, 5)
    // free edge is above the desk and lags behind theta=π/2 (x > 0 means lag)
    const i = (PAGE_SEGMENTS * 2 + 1) * 3
    expect(out[i + 1]).toBeGreaterThan(0.5)
    expect(out[i]).toBeGreaterThan(0)
  })
  it('prev mirrors next', () => {
    curlPositions(positions, out, 0, 'prev', easeTurn)
    expect(edgeX(out)).toBeCloseTo(-PAGE_W, 3)
  })
})
```

- [ ] **Step 2: Run — fails. Step 3: Implement** exactly per the interface block (two rows of `PAGE_SEGMENTS+1` vertices at z = ±PAGE_H/2; uvs u = d/PAGE_W, v = row; indices two triangles per segment; `curlPositions` loops every vertex — 66 total — applying the alpha formula; add `out.y += 0.005`).

- [ ] **Step 4: PASS. Step 5: Commit** `feat(labs/storybook): page curl geometry`

---

### Task 8: Procedural textures and placeholder art

**Files:**
- Create: `components/labs/storybook/procedural/paper-texture.ts`
- Create: `components/labs/storybook/procedural/placeholder-art.ts`

**Interfaces:**
- Produces (all client-only; guard `typeof document === 'undefined'`):

```ts
// paper-texture.ts
export function makePaperCanvas(w?: number, h?: number): HTMLCanvasElement
  // 512×512 default: --sb-paper base, per-pixel grain noise ±6 lum, aged edge
  // vignette (paper-aged), faint 1px gold frame inset 6%
export function makeLeatherCanvas(): HTMLCanvasElement
  // 512×512: leather base + noise + darker pores + embossed double gold border
export function makeShadowCanvas(): HTMLCanvasElement
  // 128×64 radial gradient black→transparent (contact shadows)
// placeholder-art.ts
export function makePlaceholderLayer(kind: LayerKind, accents: readonly string[], seed: number): HTMLCanvasElement
```

`makePlaceholderLayer` (1024×512, transparent): flat paper-cut silhouettes in `accents[i % accents.length]` — backdrop: 3 overlapping rounded mountain/skyline humps; midground: 4–6 rectangles-with-triangle-roofs (buildings); hero: one centered blob figure (circle head + trapezoid body) on a small mound; foreground: a scalloped fringe strip along the bottom. Deterministic from `seed` (mulberry32 PRNG — inline the 5-line implementation). Every shape gets a 3px lighter outline (`color-mix` not available on canvas — compute by lightening hex manually: parse, +18 per channel, clamp) to read as cut paper.

**Verify:** `pnpm build` + lint pass (these are exercised visually in Task 9/11 playtests; jsdom has no 2D canvas, so no unit tests).

**Commit:** `feat(labs/storybook): procedural paper textures and placeholder art`

---

### Task 9: Book scene — environment, covers, page blocks, static spread

**Files:**
- Create: `components/labs/storybook/book/book-scene.tsx` (Canvas, camera, lights, desk, dust, parallax rig)
- Create: `components/labs/storybook/book/book.tsx` (assembly)
- Create: `components/labs/storybook/book/dust.tsx`
- Modify: `components/labs/storybook/storybook-loader.tsx` (dynamic-import the scene)

**Interfaces:**
- Consumes: store (Task 6), textures (Task 8), `PAGE_W/PAGE_H` (Task 7).
- Produces: `<BookScene />` default export (for `next/dynamic`). `<Book>` renders: desk plane, left/right cover boards, spine, page blocks, two static flat pages, and (from Task 10/11) turning page + popup spreads. Cover board pivot group at the spine so Task 10 can rotate it.

Key numbers (single source: export `const BOOK = {...}` from `book.tsx`):

```ts
export const BOOK = {
  coverW: 1.22, coverH: 1.58, coverT: 0.035,   // board size/thickness
  blockMaxH: 0.11,                              // page block at full thickness
  pageLift: 0.005,
} as const
```

- Desk: 9×6 plane at y=−0.001, `meshStandardMaterial` color `#17100b`, roughness 0.95.
- Lights: `<ambientLight color="#ffe8c8" intensity={0.55} />`; key `<directionalLight position={[2,4,2]} color="#fff1d6" intensity={1.5} />`; candle `<pointLight position={[1.6,1.1,1.4]} color="#ff9f4d" intensity={2.2} distance={6} />` with flicker in `useFrame`: `intensity = 2.2 + 0.25·sin(t·9.3) + 0.15·sin(t·23.7)`.
- Closed state (spread 0): right cover board lies on the page block; left cover open flat is hidden — i.e. the book renders CLOSED (both boards stacked, pages between) until the cover turn. Implement covers as two box meshes with `makeLeatherCanvas()` texture; the FRONT cover sits in a pivot group at the spine, rotation.z = 0 (closed, lying over the block) → π (open). Page blocks: two boxes whose widths are `PAGE_W·0.98`; heights `blockMaxH·(1 − spread/9)` (right) and `blockMaxH·(spread/9)` (left), updated from store spread; edge material `#d8c491`.
- Static pages: two flat planes (template geometry from Task 7, no curl) with `makePaperCanvas()` texture, left one mirrored (scale.x = −1).
- Parallax rig: a group wrapping the whole book, `useFrame` easing `rotation.x/y` toward `(-pointer.y·0.03, pointer.x·0.05)`.
- Dust: 120 points, positions random in a box [-1.5..1.5, 0.2..2.2, -1..1.5]; drift `y += 0.02·dt` wrapping at top; `pointsMaterial` size 0.012, color `#ffdba8`, transparent opacity 0.32, depthWrite false.
- Canvas: `dpr={[1, 2]}`, `gl={{ antialias: true, alpha: false }}`, `camera={{ position: [0, 2.6, 2.9], fov: 40 }}`; inside, `camera.lookAt(0, 0, 0.15)` once. `<color attach="background" args={['#17100b']} />`.
- Loader change: `const BookScene = dynamic(() => import('./book/book-scene'), { ssr: false, loading: … 'Opening the book…' vellum })`. The loader keeps the vignette div on top and renders an HTML "Open the book" CTA button (bottom center, `.sb-chapter-kicker` style, gold border pill) that calls `requestTurn('next')` when `spread === 0` — visible only on spread 0. (Full nav arrives Task 10.)

**Verify (M1 internal gate):** `pnpm dev`, screenshot `/labs/storybook` — closed burgundy book with gold border on dark desk, candle flicker, dust; no console errors; three.js absent from route's first-load JS (`pnpm build` route size sanity: First Load JS for /labs/storybook well under 300 kB).

**Commit:** `feat(labs/storybook): webgl stage — desk, closed tome, candlelight`

---

### Task 10: Turning page, turn driver, input, nav

**Files:**
- Create: `components/labs/storybook/book/turning-page.tsx`
- Create: `components/labs/storybook/book/use-turn-driver.ts`
- Create: `components/labs/storybook/overlay/nav.tsx`
- Create: `components/labs/storybook/use-book-input.ts`
- Modify: `components/labs/storybook/book/book.tsx` (mount turning page; drive cover pivot)
- Modify: `components/labs/storybook/storybook-loader.tsx` (mount `<BookNav />`, input hook)

**Interfaces:**
- Consumes: store, `curlPositions/buildPageTemplate/easeTurn` (Task 7), `BOOK` (Task 9), `chapterForSpread` (Task 2).
- Produces:

```ts
// use-turn-driver.ts — inside r3f only
export const TURN_MS = 1100
export const COVER_MS = 1400
/** Returns a ref whose .current is {t: 0..1, dir, isCover} while turning, null at rest.
 *  Starts when store.turning flips truthy; on t≥1 calls completeTurn() exactly once. */
export function useTurnDriver(): MutableRefObject<TurnFrame | null>
// use-book-input.ts — plain DOM hook used by the loader (outside canvas)
export function useBookInput(enabled: boolean): void
```

- `use-turn-driver`: `useFrame((_, dt) => …)` advances an internal clock while `turning` is set; `isCover = spread === 0 && dir === 'next' || spread === 1 && dir === 'prev'`; duration accordingly; on completion call `useStorybookStore.getState().completeTurn()` and reset clock (a queued turn re-arms next frame automatically because `turning` is still set).
- `turning-page.tsx`: mesh visible only mid-turn; `useLayoutEffect` builds geometry from template; `useFrame` runs `curlPositions(template, posAttr.array, t, dir, easeTurn)` + `posAttr.needsUpdate = true; geom.computeVertexNormals()`. Material: paper canvas texture, `side: THREE.DoubleSide`. Also mount a transient shadow: a plane on the page area whose opacity = `0.25·sin(π·t)` sweeping x = `cos(θ)·PAGE_W/2` (cheap traveling shade).
- Cover drive in `book.tsx`: when `frame?.isCover`, front-cover pivot `rotation.z = −π·easeTurn(t)` (next) / mirrored (prev); page blocks + static pages hidden while `spread === 0 && !turning`… (closed book shows only boards + block).
- `use-book-input`: window listeners (NO capture; never touch Escape):
  - `wheel`: `accumulateWheel` per store helper → `requestTurn(fire)`.
  - `keydown`: ArrowRight/ArrowDown/PageDown/' ' → next (preventDefault on space); ArrowLeft/ArrowUp/PageUp → prev; Home → while `spread>0` nothing fancy: `requestTurn('prev')` (single step; YAGNI on jumps).
  - `pointerdown/pointerup`: swipe if |Δx| > 60 or |Δy| > 60 within 600 ms → next for left/up swipe, prev for right/down.
  - Cleanup on unmount. `enabled` false disables all (plain view).
- `nav.tsx` (`<BookNav />`, HTML): fixed bottom bar — left/right gold arrow buttons (`aria-label="Turn back"` / `"Turn the page"`), disabled at bounds; center folio: `— {spread} —` on chapters shows `{numeral} · {title}` in `.sb-chapter-kicker`; an `aria-live="polite"` sr-only div announcing the spread title ("Cover", "Title page", chapter kicker+title, "The Hero's Satchel", "The End"); corner hotspots: two invisible click zones (18vw × 22vh, bottom corners, `aria-hidden`, `touch-action: manipulation`) calling requestTurn — single tap advances on coarse pointers (XP lesson).

**Verify (M2 internal gate — the turn must feel great with blank pages):** Chrome playtest: cover opens with the heavy turn; wheel, click, swipe, arrows all turn pages; mid-turn input queues exactly one; folio updates; page curl reads as paper (tune `CURL_MAX`, easing, TURN_MS live against the awwwards bar). Screenshot the mid-turn frame.

**Commit:** `feat(labs/storybook): animated page turns with full input grammar`

---

### Task 11: Pop-up spreads — layers, springs, shadows

**Files:**
- Create: `components/labs/storybook/book/popup-spread.tsx`
- Create: `components/labs/storybook/book/use-layer-texture.ts`
- Modify: `components/labs/storybook/book/book.tsx` (mount current±1 popup spreads)

**Interfaces:**
- Consumes: `CHAPTERS/chapterForSpread` (Task 2), placeholder art (Task 8), store, turn driver ref (Task 10).
- Produces: `<PopupSpread chapter={Chapter} active={boolean} />`.

Implementation:

- `use-layer-texture(layer, accents)`: tries `THREE.TextureLoader().load('/labs/storybook/art/' + layer.id + '.webp', ok, undefined, onError)`; on error swaps to `CanvasTexture(makePlaceholderLayer(kind, accents, hash(layer.id)))`. `colorSpace = SRGBColorSpace`. Dispose on unmount.
- Each layer: `<group position={[0, 0, layer.hingeZ]}>` with inner plane of size `width × height`, plane's bottom edge at the group origin (geometry translated up by height/2), group `rotation.x` animated from `−π/2·…` — flat (lying toward +z, rotation.x = π/2 − 0 …). Convention: `rotation.x = π/2` → plane lies flat on the page pointing +z; `rotation.x = π/2 − standAngle·(π/180)·s` where s is stand progress 0→1 (s=1 → standing at standAngle). Layers face the camera (+z normal when standing).
- Spring per layer (manual integrator in `useFrame`): `v += (k·(target−s) − c·v)·dt; s += v·dt` with `k = 90, c = 9` (slight overshoot). Stagger: when spread becomes active AND not turning, layer i's target flips to 1 after `i · 0.085 s` (tracked with a local clock); when leaving (turning starts), all targets → 0 immediately (springs collapse well inside the first 40% of the turn).
- Contact shadow per layer: plane `width×0.18` lying flat just in front of the hinge (`z = hingeZ + 0.05`), `makeShadowCanvas()` texture, `opacity = 0.35·s`, transparent, depthWrite false.
- Non-chapter spreads: title (1) gets two decorative layers (ids `title-border`, `title-hero`, standAngle 85/88, hinge −0.3/+0.2 — add these as a `TITLE_LAYERS` export in content.ts with accents `['#c9a227','#6a8f5f']`); satchel (8) one layer (`satchel-bag`, hinge −0.25, h 0.6); end (9) two (`end-letter` hinge −0.2 h 0.5, `end-raven` hinge −0.45 h 0.55). Add these to content.ts as `EXTRA_SPREAD_LAYERS: Record<number, readonly SceneLayer[]>` and update the content test to assert their presence (spreads 1, 8, 9 each non-empty).
- Only mount spreads with `|i − spread| ≤ 1` (textures evict on unmount).
- Parallax: inside each layer's `useFrame`, add `rotation.x += pointer.y·0.015·depthFactor` where depthFactor = index/3 (already inside the book parallax rig; this is the extra per-layer sway).

**Verify (M3 pre-gate playtest):** placeholders choreograph correctly — fold flat before the page sweeps, spring up staggered on landing with visible overshoot; shadows ground the layers; 60 fps during turns (Chrome dev tools).

**Commit:** `feat(labs/storybook): pop-up layer choreography with placeholder art`

---

### Task 12: Spread overlay — narration, plaques, title/satchel/end pages, portrait layout, cursor

**Files:**
- Create: `components/labs/storybook/overlay/spread-overlay.tsx`
- Create: `components/labs/storybook/book/page-rect-reporter.tsx`
- Create: `components/labs/storybook/overlay/quill-cursor.tsx`
- Modify: `components/labs/storybook/storybook-loader.tsx`
- Modify: `components/labs/storybook/storybook.css` (overlay + portrait styles)

**Interfaces:**
- Consumes: store `pageRect/spread/turning`; content (Task 2), satchel (Task 3), `siteConfig/socialLinks`.
- Produces: `<SpreadOverlay />` (HTML, sibling of the canvas), `<PageRectReporter />` (inside canvas).

- `page-rect-reporter.tsx` (r3f child): on mount + resize, projects the open-spread corners `(-PAGE_W, 0, ±PAGE_H/2)`/`(+PAGE_W, 0, ±PAGE_H/2)` via `v.project(camera)` → viewport px rect → `setPageRect`. Nothing rendered.
- `spread-overlay.tsx`: absolutely positioned to `pageRect`; opacity 0 while `turning` (CSS transition 180 ms) and on spread 0. Content by spread:
  - 1 title: centered `BOOK_TITLE` (`.sb-chapter-title`, larger), `BOOK_SUBTITLE` italic, "written & illustrated in paper · {siteConfig.name}", and the opening line "Once upon a time — which is to say, in the year two thousand and sixteen —" (`.sb-narration` without drop cap: wrap in a class `.sb-no-dropcap` that disables `::first-letter` styling).
  - 2–7 chapters: grid two columns (left: kicker, title, `.sb-narration` narration; right: bottom-anchored `.sb-plaque` with company/role/location/period + 3 highlights). Both columns bottom-aligned to the near half of the spread (`align-self: end; padding-bottom: 6%`) so standing scenery owns the top.
  - 8 satchel: heading "The Hero's Satchel" + intro line "No knight sets out unarmed. Herein, the satchel, unpacked for the curious." + 3×2 grid of items: `<img src={/labs/storybook/art/${assetId}.webp} onError→hide />` above a parchment tag (item name / `skillName · {years} yrs · {level}` in `.sb-chapter-kicker` / blurb). Below, a small-caps single line: "also in the bags: " + remaining `skills` names joined by ' · '.
  - 9 end: closing line from spec §4, wax-seal button (`mailto:` — a burgundy circle with an embossed "A", CSS only, labelled "Send a raven"), plus `socialLinks` as bordered sigil links.
- Portrait (`@media (orientation: portrait), (max-width: 820px)`): loader layout becomes column — canvas wrapper `height: 52dvh`, overlay leaves `pageRect` positioning (CSS class switch) and renders as a static parchment panel (background `--sb-paper`, aged border) filling the rest, scrollable. Canvas camera unchanged (the book fills the top window).
- `quill-cursor.tsx`: fixed 24×24 SVG quill following pointer (raf + transform), `cursor: none` on `.sb-root` only when `(pointer: fine)`; scales 1.15 + gold tint over `[data-sb-hover]` elements (nav arrows, seal, sigils get that attribute). Hidden on coarse pointers.

**Verify (M2.5 playtest):** narration reads beautifully over the spread on desktop (drop cap, measure, plaque); portrait phone layout clean; cursor delightful; overlay fades during turns. Screenshot desktop + mobile viewport.

**Commit:** `feat(labs/storybook): narration overlay, plaques, satchel and end pages`

---

### Task 13: Procedural sound (default off)

**Files:**
- Create: `components/labs/storybook/sound.ts`
- Create: `components/labs/storybook/overlay/sound-toggle.tsx`
- Modify: `components/labs/storybook/book/use-turn-driver.ts` (trigger flip/thump/creak)
- Modify: `components/labs/storybook/storybook-loader.tsx` (mount toggle)

**Interfaces:**

```ts
// sound.ts — WebAudio, zero assets
export const sbSound: {
  unlock(): void            // resume ctx; call from first pointerdown/keydown (XP lesson)
  flip(): void              // 90ms bandpass-swept noise (1200→2600 Hz), gain 0→0.4→0
  thump(): void             // 60ms lowpass(300 Hz) noise, gain 0.25
  creak(): void             // 320ms bandpass(320 Hz) noise with 8 Hz tremolo, gain 0.2
}
```

All no-op unless `useStorybookStore.getState().soundOn`. Lazy-create one `AudioContext` + one shared 1 s noise buffer. `sound-toggle.tsx`: inkwell button top-right (`aria-pressed`), quill-dips-in-ink SVG; registers one-time unlock listeners on mount. Turn driver: `creak()` on cover turns at t=0, `flip()` at t=0.15, `thump()` at t=1 (landing).

**Verify:** toggle on → page turns whoosh softly; toggle off default; no autoplay warnings in console.

**Commit:** `feat(labs/storybook): procedural paper sounds with inkwell toggle`

---

### Task 14: View switching + art pipeline + prompt call sheet

**Files:**
- Modify: `components/labs/storybook/storybook-loader.tsx` (resolve view; plain path)
- Modify: `app/labs/storybook/page.tsx` (Suspense + CrawlableTale)
- Create: `scripts/storybook/prepare-art.mjs`
- Create: `docs/superpowers/research/2026-07-10-storybook-art-prompts.md`
- Modify: `.gitignore` (add `public/labs/storybook/art-src/`)

**Steps:**

- [ ] **Step 1: View switching.** Loader mirrors `labs-view-switch.tsx`: `useSearchParams` + `detectWebGL()` (copy the helper) + `matchMedia('(prefers-reduced-motion: reduce)')` → `resolveSbView` (Task 4). `view === 'plain'` renders `<PlainTale />`; book path renders canvas + overlay + nav. First client paint (view null) renders the vellum loading state. `page.tsx` wraps the loader in `<Suspense>` (useSearchParams requirement) and adds `<CrawlableTale />` after `<main>`.

- [ ] **Step 2: `prepare-art.mjs`** — `pnpm add -D sharp`, then script: reads `public/labs/storybook/art-src/*.png`; for each: `sharp(file).ensureAlpha().raw()` → if ≥ 3 of 4 corner pixels are within tolerance 60 of `#FF00FF`, chroma-key: per pixel, `d = max(|r−255|, g, |b−255|)`; alpha = 0 when d < 40, lerp 40–90, else keep; also de-fringe by desaturating magenta cast on semi-transparent pixels (`r = b = min(r, b)` when g < r·0.6). Then `.trim()` (backdrops excluded — ids ending `-backdrop` keep width), resize to fit 1536, `.webp({ quality: 82 })` → `public/labs/storybook/art/<id>.webp`. Log a table of emitted files/sizes (stdout via `process.stdout.write`).

- [ ] **Step 3: Call sheet** — write the full 38-asset prompt document (structure per spec §8.5): style preamble block (§8.3), hero block (§8.4), transparency fallback line, then per asset: id, size, full paste-ready prompt (preamble + subject + accents + "isolated on transparent background" + magenta fallback), reject-if notes. Batch 1 (6 assets: `cover-crest`, `cover-corner`, `ch4-backdrop`, `ch4-midground`, `ch4-hero`, `ch4-foreground`) at top; Batch 2 grouped by spread (chapters I,II,III,V,VI ×4; `title-border`, `title-hero`; `satchel-bag` + 6 `item-*`; `end-letter`, `end-raven`, `back-crest`). Subjects follow spec §4 scene descriptions; every hero-bearing prompt embeds the locked hero description.

- [ ] **Step 4: Verify** `?view=plain` renders the article; `prepare-art.mjs` runs clean on an empty art-src dir. Commit: `feat(labs/storybook): view switching, art pipeline, prompt call sheet`

**⛔ M3 USER GATE (orchestrator, not subagent):** paste Batch-1 prompts to the user → user generates → drop PNGs in `art-src/` → run `node scripts/storybook/prepare-art.mjs` → playtest cover + Chapter IV with real art → screenshots to user → **approval required before Task 15+ polish continues.** (Tasks 15–16 test/infra work may proceed while waiting.)

---

### Task 15: E2E suite

**Files:**
- Create: `e2e/labs-storybook.spec.ts`

Tests (book-interaction cases `test.skip(browserName !== 'chromium')` — WebGL headless is only reliable there; plain-view cases run on all projects):

```ts
import { expect, test } from '@playwright/test'

test.describe('storybook plain view', () => {
  test('tells all six kingdoms with contact', async ({ page }) => {
    await page.goto('/labs/storybook?view=plain')
    for (const company of ['BlueNet', 'FLYERBEE', '360dialog', 'Accenture', 'AKNA', 'xDataGroup']) {
      await expect(page.getByText(new RegExp(company)).first()).toBeVisible()
    }
    await expect(page.getByRole('link', { name: /send a raven/i })).toHaveAttribute('href', /mailto:/)
  })

  test('reduced motion gets the plain tale automatically', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/labs/storybook')
    await expect(page.getByText(/Vault-Dragon/).first()).toBeVisible()
  })
})

test.describe('storybook book', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'WebGL-dependent')

  test('opens the cover and turns pages by keyboard', async ({ page }) => {
    await page.goto('/labs/storybook')
    await expect(page.getByRole('button', { name: /open the book/i })).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByText(/Once upon a time — which is to say/)).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press('ArrowRight')
    await expect(page.getByText(/Inn of a Hundred Keys/).first()).toBeVisible({ timeout: 10_000 })
  })

  test('escape returns to the gallery', async ({ page }) => {
    await page.goto('/labs/storybook')
    await page.waitForLoadState('networkidle')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500) // settle wait — dev-server nav can lag (snowpark lesson)
    await expect(page).toHaveURL(/\/labs$/)
  })

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await page.goto('/labs/storybook')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })
})
```

Run: `$env:E2E_PORT=3111; pnpm test:e2e -- labs-storybook` → all pass (mobile projects run the plain suite only via the skip).

**Commit:** `test(labs/storybook): e2e coverage for book and plain views`

---

### Task 16: Poster, manifest entry, ship checks

**Files:**
- Create: `scripts/posters/storybook-poster.html` + `scripts/posters/capture-storybook.mjs`
- Create: `public/labs/storybook/poster.jpg` (generated)
- Modify: `lib/labs-manifest.ts`

**Steps:**

- [ ] **Step 1: Poster** — `storybook-poster.html`: 768×1024 standalone HTML page drawing the CLOSED book cover: `--sb-leather` background with vignette, double gold border, Grenze Gotisch + Alegreya from Google Fonts CDN `<link>`, title "A Tale of Six Kingdoms", subtitle, centered crest (embed the real `cover-crest` art as base64 if delivered, else a CSS/SVG dragon-circle monogram), "STYLE LAB Nº 5 · STORYBOOK" small caps footer. `capture-storybook.mjs`: copy `capture-xp.mjs`, swap paths. Run `node scripts/posters/capture-storybook.mjs`; verify poster.jpg ≤ 200 KB.

- [ ] **Step 2: Manifest** — append to `lib/labs-manifest.ts`:

```ts
{
  slug: 'storybook',
  title: 'Storybook',
  date: '2026-07-10',
  thesis:
    'The portfolio as a fantasy pop-up book — six kingdoms, one hero, paper dragons; every page turn a small theatre.',
  status: 'live',
},
```

- [ ] **Step 3: Full verification**

```bash
pnpm lint && pnpm vitest run --project unit && pnpm build
$env:E2E_PORT=3111; pnpm test:e2e -- labs-storybook
```

All green; museum hall shows the new painting (playtest `/labs`).

- [ ] **Step 4: Commit** `feat(labs/storybook): museum poster and manifest entry — lab goes live`

---

## Milestone gates (orchestrator duties, between tasks)

| After | Gate |
|---|---|
| Task 9 | M1: screenshot closed tome + environment — candlelit, burgundy, gold |
| Task 10 | M2: turn FEEL — tune CURL_MAX/TURN_MS/easing live; awwwards bar |
| Task 11 | M2.5: pop-up choreography with placeholders |
| Task 12 | Typography/overlay craft on desktop + portrait |
| Task 14 | **M3 USER GATE: Batch-1 art in cover + Chapter IV — user approves the look** |
| Task 16 | Final Chrome pass, then superpowers:requesting-code-review → PR |

## Self-review notes

- Spec coverage: §3 tokens/fonts→T1; §4 story→T2/T5/T12; §5 architecture→T1/T9–12/T14; §6 motion→T10/T11/T13; §7 responsive/fallback→T4/T5/T12/T14; §8 art pipeline→T14; §9 perf→T9 (lazy chunk, dpr cap, current±1 in T11); §10 tests→T2–7/T15; §11 integration→T1/T16; §12 milestones→gate table.
- Deliberately deferred (YAGNI now, polish later if the gates demand): low-tier device heuristic (spec §9 — placeholders are cheap; revisit if playtest shows jank), corner hover pre-curl (T10 tune step), ribbon mesh.
- Type consistency checked: `SceneLayer`/`Chapter` (T2) consumed by T11/T12; store API (T6) consumed by T10–13; `BOOK` consts (T9) by T10.
