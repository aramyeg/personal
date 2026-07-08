# Labs Museum Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/labs` into a first-person 3D classical museum where each Style Lab hangs as a framed poster, with a list-view fallback and an Esc/back chrome on every lab.

**Architecture:** react-three-fiber renders a single procedural grand hall (geometry and textures generated in code — no downloaded assets). Painting positions derive from `lib/labs-manifest.ts` via a pure, unit-tested layout function. The 3D bundle is `next/dynamic`-imported client-side only; a pure `resolveLabsView` function decides list vs 3D per device/param. Spec: `docs/superpowers/specs/2026-07-08-labs-museum-gallery-design.md`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, three + @react-three/fiber + @react-three/drei, Tailwind 4, Vitest (unit project, jsdom), Playwright (e2e).

## Global Constraints

- Package manager is **pnpm**. Node 20. Run all commands from the repo root.
- Path alias `@/*` maps to repo root.
- Unit tests live in `__tests__/**/*.test.{ts,tsx}` and run with `pnpm test:unit --run` (jsdom).
- NEVER claim lead/leading titles in any copy — Aram is a Senior Frontend Engineer.
- No `console.log` in committed code.
- Immutability: never mutate props/state objects (three.js object mutation inside R3F `useFrame` is fine — that's the idiom).
- Commit message format: `<type>: <description>` (feat/fix/refactor/docs/test/chore).
- All new copy is factual and quiet — no "stunning", "immersive experience" marketing slop.
- The 3D experience must never load for `?view=list` or reduced-motion users.
- Poster convention: every lab ships `public/labs/<slug>/poster.jpg`, portrait ~3:4, ≤ 200 KB.

**Model routing (orchestrator note):** Tasks 1–5 and 10 are well-bounded — route to **sonnet** workers. Tasks 6–9 are the 3D core — route to **opus** workers. The orchestrator (fable) reviews every task's diff before the next dispatch.

---

### Task 1: `resolveLabsView` — pure view-resolution logic

**Files:**
- Create: `lib/labs-view.ts`
- Test: `__tests__/lib/labs-view.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces: `type LabsView = 'list' | '3d'` and `resolveLabsView(opts: { param: string | null; coarsePointer: boolean; reducedMotion: boolean; webglSupported: boolean; wideViewport: boolean }): LabsView`. Task 6's client switch calls this.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/labs-view.test.ts
import { describe, it, expect } from 'vitest'
import { resolveLabsView } from '@/lib/labs-view'

const desktop = {
  param: null as string | null,
  coarsePointer: false,
  reducedMotion: false,
  webglSupported: true,
  wideViewport: true,
}

describe('resolveLabsView', () => {
  it('defaults to 3d on a capable desktop', () => {
    expect(resolveLabsView(desktop)).toBe('3d')
  })

  it('honors ?view=list everywhere', () => {
    expect(resolveLabsView({ ...desktop, param: 'list' })).toBe('list')
  })

  it('honors ?view=3d when WebGL is supported', () => {
    expect(resolveLabsView({ ...desktop, param: '3d', coarsePointer: true })).toBe('3d')
  })

  it('falls back to list for ?view=3d without WebGL', () => {
    expect(resolveLabsView({ ...desktop, param: '3d', webglSupported: false })).toBe('list')
  })

  it('defaults to list on coarse pointers (touch)', () => {
    expect(resolveLabsView({ ...desktop, coarsePointer: true })).toBe('list')
  })

  it('defaults to list on narrow viewports', () => {
    expect(resolveLabsView({ ...desktop, wideViewport: false })).toBe('list')
  })

  it('defaults to list under prefers-reduced-motion', () => {
    expect(resolveLabsView({ ...desktop, reducedMotion: true })).toBe('list')
  })

  it('defaults to list without WebGL', () => {
    expect(resolveLabsView({ ...desktop, webglSupported: false })).toBe('list')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest __tests__/lib/labs-view.test.ts --project unit --run`
Expected: FAIL — cannot resolve `@/lib/labs-view`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/labs-view.ts
/** Which /labs experience to show. */
export type LabsView = 'list' | '3d'

/**
 * Decide the default /labs experience.
 * Explicit ?view= wins (but 3d still requires WebGL); otherwise 3D is
 * reserved for wide, fine-pointer, motion-ok, WebGL-capable devices.
 */
export function resolveLabsView(opts: {
  param: string | null
  coarsePointer: boolean
  reducedMotion: boolean
  webglSupported: boolean
  wideViewport: boolean
}): LabsView {
  if (opts.param === 'list') return 'list'
  if (opts.param === '3d') return opts.webglSupported ? '3d' : 'list'
  if (!opts.webglSupported) return 'list'
  if (opts.reducedMotion) return 'list'
  if (opts.coarsePointer) return 'list'
  if (!opts.wideViewport) return 'list'
  return '3d'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest __tests__/lib/labs-view.test.ts --project unit --run`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/labs-view.ts __tests__/lib/labs-view.test.ts
git commit -m "feat(labs): pure view-resolution logic for list vs 3d gallery"
```

---

### Task 2: Museum layout math

**Files:**
- Create: `components/labs/museum/layout.ts`
- Test: `__tests__/components/labs/museum/layout.test.ts`

**Interfaces:**
- Consumes: `LabEntry` from `@/lib/labs-manifest`.
- Produces (used by Tasks 6–10):
  - `HALL = { width: 10, height: 6, margin: 0.7 }`
  - `PLAYER = { eyeHeight: 1.6, speed: 3 }`
  - `SPACING = 5`, `FIRST_OFFSET = 6`, `END_ZONE = 7`
  - `hallLength(labCount: number): number`
  - `type PaintingPlacement = { slug: string; title: string; date: string; thesis: string; position: [number, number, number]; rotationY: number }`
  - `paintingPlacements(labs: LabEntry[]): PaintingPlacement[]`
  - `drapedPlacement(labCount: number): { position: [number, number, number]; rotationY: number }`
  - `clampToHall(x: number, z: number, length: number): { x: number; z: number }`

The hall runs along negative Z: the entrance wall is at z = 0, the far wall at z = −length. Paintings alternate left wall (x = −4.9, facing +x) and right wall (x = +4.9, facing −x), hung at center height 2.0.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/components/labs/museum/layout.test.ts
import { describe, it, expect } from 'vitest'
import {
  HALL,
  SPACING,
  FIRST_OFFSET,
  END_ZONE,
  hallLength,
  paintingPlacements,
  drapedPlacement,
  clampToHall,
} from '@/components/labs/museum/layout'
import type { LabEntry } from '@/lib/labs-manifest'

const lab = (slug: string): LabEntry => ({
  slug,
  title: slug.toUpperCase(),
  date: '2026-07-08',
  thesis: `${slug} thesis`,
  status: 'live',
})

describe('hallLength', () => {
  it('grows with lab count and keeps an end zone', () => {
    expect(hallLength(1)).toBe(FIRST_OFFSET + 1 * SPACING + END_ZONE)
    expect(hallLength(4)).toBe(FIRST_OFFSET + 4 * SPACING + END_ZONE)
  })
})

describe('paintingPlacements', () => {
  it('returns one placement per lab, spaced along negative z', () => {
    const p = paintingPlacements([lab('a'), lab('b'), lab('c')])
    expect(p).toHaveLength(3)
    expect(p[0].position[2]).toBe(-FIRST_OFFSET)
    expect(p[1].position[2]).toBe(-(FIRST_OFFSET + SPACING))
    expect(p[2].position[2]).toBe(-(FIRST_OFFSET + 2 * SPACING))
  })

  it('alternates walls: even index left (+x facing), odd index right', () => {
    const p = paintingPlacements([lab('a'), lab('b')])
    expect(p[0].position[0]).toBeLessThan(0)
    expect(p[0].rotationY).toBeCloseTo(Math.PI / 2)
    expect(p[1].position[0]).toBeGreaterThan(0)
    expect(p[1].rotationY).toBeCloseTo(-Math.PI / 2)
  })

  it('hangs paintings at eye-friendly height and carries lab copy', () => {
    const [p] = paintingPlacements([lab('ps1')])
    expect(p.position[1]).toBe(2)
    expect(p.slug).toBe('ps1')
    expect(p.title).toBe('PS1')
    expect(p.thesis).toBe('ps1 thesis')
  })
})

describe('drapedPlacement', () => {
  it('sits on the far wall, centered, facing the entrance', () => {
    const d = drapedPlacement(2)
    expect(d.position[0]).toBe(0)
    expect(d.position[2]).toBeCloseTo(-(hallLength(2) - 0.1))
    expect(d.rotationY).toBe(0)
  })
})

describe('clampToHall', () => {
  const len = hallLength(2)
  it('keeps the player inside side walls', () => {
    expect(clampToHall(99, -3, len).x).toBe(HALL.width / 2 - HALL.margin)
    expect(clampToHall(-99, -3, len).x).toBe(-(HALL.width / 2 - HALL.margin))
  })
  it('keeps the player between entrance and far wall', () => {
    expect(clampToHall(0, 5, len).z).toBe(-HALL.margin)
    expect(clampToHall(0, -999, len).z).toBe(-(len - HALL.margin))
  })
  it('passes through positions already inside', () => {
    expect(clampToHall(1.2, -4.5, len)).toEqual({ x: 1.2, z: -4.5 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest __tests__/components/labs/museum/layout.test.ts --project unit --run`
Expected: FAIL — cannot resolve `@/components/labs/museum/layout`.

- [ ] **Step 3: Write the implementation**

```ts
// components/labs/museum/layout.ts
import type { LabEntry } from '@/lib/labs-manifest'

/** Hall cross-section and player constants shared by every museum piece. */
export const HALL = { width: 10, height: 6, margin: 0.7 }
export const PLAYER = { eyeHeight: 1.6, speed: 3 }

export const SPACING = 5
export const FIRST_OFFSET = 6
export const END_ZONE = 7

/** Wall x for hung paintings, slightly inside the physical wall. */
const WALL_X = HALL.width / 2 - 0.1
const HANG_HEIGHT = 2

export function hallLength(labCount: number): number {
  return FIRST_OFFSET + labCount * SPACING + END_ZONE
}

export type PaintingPlacement = {
  slug: string
  title: string
  date: string
  thesis: string
  position: [number, number, number]
  rotationY: number
}

/** One frame per manifest entry, alternating walls down the hall. */
export function paintingPlacements(labs: LabEntry[]): PaintingPlacement[] {
  return labs.map((lab, i) => {
    const left = i % 2 === 0
    return {
      slug: lab.slug,
      title: lab.title,
      date: lab.date,
      thesis: lab.thesis,
      position: [left ? -WALL_X : WALL_X, HANG_HEIGHT, -(FIRST_OFFSET + i * SPACING)],
      rotationY: left ? Math.PI / 2 : -Math.PI / 2,
    }
  })
}

/** The cloth-draped "opening soon" frame on the far wall. */
export function drapedPlacement(labCount: number): {
  position: [number, number, number]
  rotationY: number
} {
  return { position: [0, HANG_HEIGHT, -(hallLength(labCount) - 0.1)], rotationY: 0 }
}

/** Clamp a walk position to the hall's inner bounds. */
export function clampToHall(x: number, z: number, length: number): { x: number; z: number } {
  const maxX = HALL.width / 2 - HALL.margin
  return {
    x: Math.min(maxX, Math.max(-maxX, x)),
    z: Math.min(-HALL.margin, Math.max(-(length - HALL.margin), z)),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest __tests__/components/labs/museum/layout.test.ts --project unit --run`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/labs/museum/layout.ts __tests__/components/labs/museum/layout.test.ts
git commit -m "feat(labs): manifest-driven museum layout math"
```

---

### Task 3: GalleryChrome — back button + Esc on every lab

**Files:**
- Create: `components/labs/gallery-chrome.tsx`
- Modify: `app/labs/ps1/page.tsx` (wrap page content)
- Test: `__tests__/components/labs/gallery-chrome.test.tsx`

**Interfaces:**
- Consumes: `next/navigation` `useRouter`, `next/link`.
- Produces: `<GalleryChrome>{children}</GalleryChrome>` — renders children plus a fixed "← Gallery" link, and pushes `/labs` on `Escape`. Every current and future lab page wraps its content in this.

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/labs/gallery-chrome.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GalleryChrome } from '@/components/labs/gallery-chrome'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

describe('GalleryChrome', () => {
  beforeEach(() => push.mockClear())

  it('renders its children', () => {
    render(
      <GalleryChrome>
        <p>lab content</p>
      </GalleryChrome>
    )
    expect(screen.getByText('lab content')).toBeInTheDocument()
  })

  it('renders a back-to-gallery link', () => {
    render(<GalleryChrome>x</GalleryChrome>)
    const link = screen.getByRole('link', { name: /gallery/i })
    expect(link).toHaveAttribute('href', '/labs')
  })

  it('navigates to /labs on Escape', () => {
    render(<GalleryChrome>x</GalleryChrome>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(push).toHaveBeenCalledWith('/labs')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest __tests__/components/labs/gallery-chrome.test.tsx --project unit --run`
Expected: FAIL — cannot resolve `@/components/labs/gallery-chrome`.

- [ ] **Step 3: Write the implementation**

```tsx
// components/labs/gallery-chrome.tsx
'use client'

import { useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

/**
 * Shared lab shell: a quiet, style-neutral way back to the gallery.
 * Fixed "← Gallery" button top-left + Esc key → /labs.
 */
export function GalleryChrome({ children }: { children: ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.push('/labs')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  return (
    <>
      <Link
        href="/labs"
        className="fixed top-4 left-4 z-50 rounded-full bg-black/40 px-3 py-1.5 text-xs font-mono uppercase tracking-widest text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
      >
        ← Gallery
      </Link>
      {children}
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest __tests__/components/labs/gallery-chrome.test.tsx --project unit --run`
Expected: 3 passed.

- [ ] **Step 5: Wrap the PS1 lab page**

In `app/labs/ps1/page.tsx`, add the import and wrap the existing `<main>`:

```tsx
import { GalleryChrome } from '@/components/labs/gallery-chrome'
```

```tsx
export default function PS1LabPage() {
  return (
    <GalleryChrome>
      {/* The lab owns its whole visual world — the site theme does not apply here */}
      <main className="min-h-dvh bg-[#07090d] text-[#e8edf4] font-mono">
        <PS1Scene />
        <MemoryCard />
        {/* footer unchanged */}
      </main>
    </GalleryChrome>
  )
}
```

Keep the existing footer exactly as is. Note: the PS1 scene listens for keyboard input for morphs — Escape is not among its bindings, so there is no conflict.

- [ ] **Step 6: Verify all unit tests and lint pass**

Run: `pnpm test:unit --run && pnpm lint`
Expected: all pass, no lint errors.

- [ ] **Step 7: Commit**

```bash
git add components/labs/gallery-chrome.tsx __tests__/components/labs/gallery-chrome.test.tsx app/labs/ps1/page.tsx
git commit -m "feat(labs): shared GalleryChrome back-button and Esc navigation"
```

---

### Task 4: Extract LabsList component

**Files:**
- Create: `components/labs/labs-list.tsx`
- Modify: `app/labs/page.tsx` (render `<LabsList />` instead of inline cards; keep metadata and heading shell for now — Task 6 replaces the shell with the view switch)
- Test: `__tests__/components/labs/labs-list.test.tsx`

**Interfaces:**
- Consumes: `labs` from `@/lib/labs-manifest`.
- Produces: `<LabsList />` — self-contained section: intro copy, back-to-main link, and one card per manifest entry with poster thumbnail at `/labs/<slug>/poster.jpg`. Task 6 renders it as the list view.

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/labs/labs-list.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LabsList } from '@/components/labs/labs-list'
import { labs } from '@/lib/labs-manifest'

describe('LabsList', () => {
  it('renders a link card for every lab in the manifest', () => {
    render(<LabsList />)
    for (const lab of labs) {
      const link = screen.getByRole('link', { name: new RegExp(lab.title) })
      expect(link).toHaveAttribute('href', `/labs/${lab.slug}`)
    }
  })

  it('shows each lab poster thumbnail', () => {
    render(<LabsList />)
    for (const lab of labs) {
      const img = screen.getByAltText(`${lab.title} poster`)
      expect(img).toHaveAttribute('src', expect.stringContaining(`/labs/${lab.slug}/poster.jpg`))
    }
  })

  it('links back to the main site', () => {
    render(<LabsList />)
    expect(screen.getByRole('link', { name: /main site/i })).toHaveAttribute('href', '/')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest __tests__/components/labs/labs-list.test.tsx --project unit --run`
Expected: FAIL — cannot resolve `@/components/labs/labs-list`.

- [ ] **Step 3: Write the implementation**

Move the card markup out of `app/labs/page.tsx` and add a poster thumbnail. Plain `<img>` is deliberate (posters are already small; no next/image layout shift dance inside cards).

```tsx
// components/labs/labs-list.tsx
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { labs } from '@/lib/labs-manifest'

/** The simplified list view of all Style Lab experiments. */
export function LabsList() {
  return (
    <div className="section-container py-16 sm:py-24 max-w-3xl">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-12"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to the main site
      </Link>

      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">Style Lab</h1>
      <div className="h-1 w-12 bg-primary rounded-full mb-6" />

      <p className="text-muted-foreground leading-relaxed max-w-xl mb-12">
        One portfolio, many design systems. Every experiment here re-skins the
        same content — my actual work and experience — in a completely different
        visual identity. Some are full sites, some are single scenes, some are
        games. New entries ship regularly.
      </p>

      <div className="space-y-4">
        {labs.map((lab) => (
          <Link
            key={lab.slug}
            href={`/labs/${lab.slug}`}
            className="group flex items-start gap-5 p-5 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/labs/${lab.slug}/poster.jpg`}
              alt={`${lab.title} poster`}
              width={72}
              height={96}
              loading="lazy"
              className="h-24 w-18 shrink-0 rounded-md object-cover border border-border"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold group-hover:text-primary transition-colors">
                  {lab.title}
                </h2>
                <span className="text-xs text-muted-foreground font-mono">{lab.date}</span>
                {lab.status === 'wip' && (
                  <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground">
                    In progress
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2 max-w-lg">{lab.thesis}</p>
            </div>
            <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
          </Link>
        ))}
      </div>
    </div>
  )
}
```

Then reduce `app/labs/page.tsx` to (metadata unchanged):

```tsx
import type { Metadata } from 'next'
import { LabsList } from '@/components/labs/labs-list'

export const metadata: Metadata = {
  title: 'Style Lab | Aram Yeghiazaryan',
  description:
    'One portfolio, many design systems. Each experiment re-skins the same content in a different visual identity — an exercise in un-slopping AI-assisted design.',
}

export default function LabsPage() {
  return (
    <main className="min-h-screen">
      <LabsList />
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest __tests__/components/labs/labs-list.test.tsx --project unit --run`
Expected: 3 passed. (The poster image 404s in the browser until Task 5 — fine.)

- [ ] **Step 5: Verify full unit suite and lint**

Run: `pnpm test:unit --run && pnpm lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add components/labs/labs-list.tsx __tests__/components/labs/labs-list.test.tsx app/labs/page.tsx
git commit -m "refactor(labs): extract LabsList with poster thumbnails"
```

---

### Task 5: PS1 poster asset

**Files:**
- Create: `scripts/posters/ps1-poster.html`
- Create (generated): `public/labs/ps1/poster.jpg`
- Modify: `lib/labs-manifest.ts` (document the poster convention in the header comment)

**Interfaces:**
- Consumes: nothing.
- Produces: `public/labs/ps1/poster.jpg` (768×1024 JPEG) — used by `LabsList` (Task 4) and `Painting` (Task 9).

- [ ] **Step 1: Create the poster generator page**

A self-contained HTML page that draws the PS1 lab's aesthetic — dithered sphere over a Y2K grid, blue/green/white on near-black — onto a 768×1024 canvas. Committed so posters are reproducible.

```html
<!-- scripts/posters/ps1-poster.html -->
<!doctype html>
<meta charset="utf-8" />
<style>html,body{margin:0;background:#07090d}canvas{display:block}</style>
<canvas id="c" width="768" height="1024"></canvas>
<script>
  const c = document.getElementById('c')
  const g = c.getContext('2d')
  const W = c.width, H = c.height

  // Background
  g.fillStyle = '#07090d'
  g.fillRect(0, 0, W, H)

  // Horizon glow
  const glow = g.createRadialGradient(W / 2, H * 0.62, 40, W / 2, H * 0.62, 420)
  glow.addColorStop(0, 'rgba(85,131,255,0.35)')
  glow.addColorStop(1, 'rgba(85,131,255,0)')
  g.fillStyle = glow
  g.fillRect(0, 0, W, H)

  // Perspective grid floor
  g.strokeStyle = 'rgba(90,104,122,0.9)'
  g.lineWidth = 1
  const horizon = H * 0.62
  for (let i = -14; i <= 14; i++) {
    g.beginPath()
    g.moveTo(W / 2 + i * 26, horizon)
    g.lineTo(W / 2 + i * 130, H)
    g.stroke()
  }
  for (let r = 1; r <= 12; r++) {
    const y = horizon + Math.pow(r / 12, 2.2) * (H - horizon)
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke()
  }

  // Dithered flat-shaded sphere (2x2 ordered bayer)
  const cx = W / 2, cy = H * 0.36, R = 190
  const light = { x: -0.55, y: -0.65, z: 0.52 }
  const bayer = [[0, 2], [3, 1]]
  const px = 4
  for (let y = -R; y < R; y += px) {
    for (let x = -R; x < R; x += px) {
      const d2 = x * x + y * y
      if (d2 > R * R) continue
      const z = Math.sqrt(R * R - d2)
      const n = { x: x / R, y: y / R, z: z / R }
      let lum = Math.max(0, n.x * light.x + n.y * light.y + n.z * light.z)
      lum = Math.pow(lum, 0.9) * 4.6
      const cell = bayer[(y / px & 1) ? 1 : 0][(x / px & 1) ? 1 : 0]
      const on = lum > cell
      g.fillStyle = on
        ? (lum > 3.4 ? '#e8edf4' : lum > 2 ? '#5583ff' : '#2f4f8f')
        : '#0b1020'
      g.fillRect(cx + x, cy + y, px, px)
    }
  }

  // Scanlines
  g.fillStyle = 'rgba(0,0,0,0.22)'
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1)

  // Type
  g.fillStyle = '#e8edf4'
  g.font = '900 92px Arial Black, Arial, sans-serif'
  g.textAlign = 'center'
  g.fillText('PS1 / Y2K', W / 2, H - 130)
  g.fillStyle = '#59d999'
  g.font = '400 26px monospace'
  g.fillText('STYLE LAB — № 1', W / 2, H - 82)
</script>
```

- [ ] **Step 2: Generate the JPEG**

```bash
mkdir -p public/labs/ps1
pnpm exec playwright screenshot --viewport-size=768,1024 "file://$(pwd)/scripts/posters/ps1-poster.html" public/labs/ps1/poster.jpg
```

Expected: `public/labs/ps1/poster.jpg` exists. Check size: must be ≤ 200 KB (`ls -la public/labs/ps1/`). Open it and confirm it reads as a dithered PS1 still-life poster.

- [ ] **Step 3: Document the convention in the manifest header**

In `lib/labs-manifest.ts`, extend the header comment's rules (keep existing text, add):

```ts
 * Every lab also ships a poster at public/labs/<slug>/poster.jpg
 * (portrait ~3:4, <=200 KB) — it hangs in the /labs museum and thumbnails
 * the list view. Generators live in scripts/posters/. Each lab page wraps
 * its content in <GalleryChrome> for the back-to-gallery button and Esc.
```

- [ ] **Step 4: Verify the list view shows it**

Run: `pnpm dev` (background), open `http://localhost:3000/labs`.
Expected: the PS1 card shows the poster thumbnail. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add scripts/posters/ps1-poster.html public/labs/ps1/poster.jpg lib/labs-manifest.ts
git commit -m "feat(labs): reproducible PS1 poster asset and poster convention"
```

---

### Task 6: 3D dependencies, procedural textures, gallery skeleton, view switch

**Files:**
- Modify: `package.json` (via pnpm add)
- Create: `components/labs/museum/textures.ts`
- Create: `components/labs/museum/museum-gallery.tsx`
- Create: `components/labs/labs-view-switch.tsx`
- Modify: `app/labs/page.tsx`

**Interfaces:**
- Consumes: `resolveLabsView` (Task 1), `HALL`, `hallLength`, `PLAYER` (Task 2), `LabsList` (Task 4), `labs` manifest.
- Produces:
  - `textures.ts`: `makeParquetTexture(): THREE.CanvasTexture`, `makeWallTexture(): THREE.CanvasTexture`, `makePlacardTexture(title: string, date: string, thesis: string): THREE.CanvasTexture` — all client-only.
  - `MuseumGallery` (default export, client-only): full-viewport Canvas + overlay UI. Accepts no props; reads the manifest itself.
  - `LabsViewSwitch` (client): decides list vs 3D, renders `<LabsList />` or dynamic `<MuseumGallery />`, and the toggles between them.

- [ ] **Step 1: Install dependencies**

```bash
pnpm add three @react-three/fiber @react-three/drei
pnpm add -D @types/three
```

Expected: installs cleanly against React 19 (R3F v9+). If pnpm reports peer warnings for react 19, they are non-blocking with R3F ≥ 9.

- [ ] **Step 2: Procedural textures module**

```ts
// components/labs/museum/textures.ts
'use client'

import * as THREE from 'three'

/** Deterministic pseudo-random for repeatable textures. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return [c, c.getContext('2d')!]
}

/** Herringbone parquet, warm oak tones. */
export function makeParquetTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512)
  const rnd = mulberry32(7)
  g.fillStyle = '#7a4f2c'
  g.fillRect(0, 0, 512, 512)
  const w = 64, h = 16
  for (let row = -1; row < 512 / h + 1; row++) {
    for (let col = -1; col < 512 / w + 1; col++) {
      const x = col * w + (row % 2 ? w / 2 : 0)
      const y = row * h
      const tone = 0.82 + rnd() * 0.36
      g.fillStyle = `rgb(${Math.round(138 * tone)}, ${Math.round(90 * tone)}, ${Math.round(51 * tone)})`
      g.fillRect(x + 1, y + 1, w - 2, h - 2)
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Wine-red fabric wall with a subtle weave. */
export function makeWallTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256)
  const rnd = mulberry32(13)
  g.fillStyle = '#5a2028'
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * 256, y = rnd() * 256
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,220,220,0.03)' : 'rgba(0,0,0,0.05)'
    g.fillRect(x, y, 2, 1)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Brass museum placard with engraved lab copy. */
export function makePlacardTexture(title: string, date: string, thesis: string): THREE.CanvasTexture {
  const [c, g] = canvas(512)
  c.height = 256
  const grad = g.createLinearGradient(0, 0, 512, 256)
  grad.addColorStop(0, '#b08d3f')
  grad.addColorStop(0.5, '#d6b968')
  grad.addColorStop(1, '#a5813a')
  g.fillStyle = grad
  g.fillRect(0, 0, 512, 256)
  g.strokeStyle = 'rgba(60,40,0,0.55)'
  g.lineWidth = 6
  g.strokeRect(10, 10, 492, 236)
  g.fillStyle = '#2c1f08'
  g.textAlign = 'center'
  g.font = '700 44px Georgia, serif'
  g.fillText(title, 256, 78)
  g.font = 'italic 24px Georgia, serif'
  g.fillText(date, 256, 118)
  g.font = '20px Georgia, serif'
  // naive two-line wrap for the thesis
  const words = thesis.split(' ')
  let line = '', lines: string[] = []
  for (const w of words) {
    if ((line + ' ' + w).length > 44 && line) { lines.push(line); line = w }
    else line = line ? line + ' ' + w : w
    if (lines.length === 2) break
  }
  if (lines.length < 2 && line) lines.push(line)
  lines.slice(0, 2).forEach((l, i) => g.fillText(l, 256, 160 + i * 30))
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
```

- [ ] **Step 3: Gallery skeleton**

Floor + placeholder walls + lights + static camera. (Hall dressing → Task 7, controls → Task 8, paintings → Task 9.)

```tsx
// components/labs/museum/museum-gallery.tsx
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Canvas } from '@react-three/fiber'
import { labs } from '@/lib/labs-manifest'
import { hallLength, PLAYER } from './layout'
import { Hall } from './hall'

/**
 * The /labs museum: a first-person classical gallery.
 * Everything inside <Canvas> is three.js; overlay UI is plain DOM.
 */
export default function MuseumGallery() {
  const length = useMemo(() => hallLength(labs.length), [])
  const [focused, setFocused] = useState<string | null>(null)
  const focusedLab = labs.find((l) => l.slug === focused) ?? null

  return (
    <div className="fixed inset-0 z-40 bg-black">
      {/* The 3D scene is decorative to assistive tech; the list view is the
          accessible alternative. The overlay links/buttons stay reachable. */}
      <Canvas
        aria-hidden="true"
        camera={{ fov: 62, near: 0.1, far: 80, position: [0, PLAYER.eyeHeight, -2] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.35} color="#fff3e0" />
        <Hall length={length} />
      </Canvas>

      {/* Crosshair */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />

      {/* Focused painting hint */}
      {focusedLab && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-white">
          Click to enter — {focusedLab.title}
        </div>
      )}

      {/* Controls hint */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[11px] uppercase tracking-widest text-white/50">
        Click to walk · WASD + mouse · Esc to release
      </div>

      {/* Escape hatch to the list */}
      <Link
        href="/labs?view=list"
        className="absolute top-4 right-4 rounded-full bg-black/50 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-white/80 backdrop-blur-sm hover:bg-black/70 hover:text-white"
      >
        List view
      </Link>
    </div>
  )
}
```

Temporary minimal `Hall` so this compiles before Task 7 — create `components/labs/museum/hall.tsx`:

```tsx
// components/labs/museum/hall.tsx
'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { HALL } from './layout'
import { makeParquetTexture } from './textures'

/** The museum room: floor, walls, ceiling, dressing. */
export function Hall({ length }: { length: number }) {
  const parquet = useMemo(() => {
    const t = makeParquetTexture()
    t.repeat.set(HALL.width / 2.5, length / 2.5)
    return t
  }, [length])

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -length / 2]}>
        <planeGeometry args={[HALL.width, length]} />
        <meshStandardMaterial map={parquet} roughness={0.55} />
      </mesh>
      <mesh position={[0, HALL.height / 2, -length / 2]}>
        <boxGeometry args={[HALL.width, HALL.height, length]} />
        <meshStandardMaterial color="#5a2028" side={THREE.BackSide} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 4: View switch client component**

```tsx
// components/labs/labs-view-switch.tsx
'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { resolveLabsView, type LabsView } from '@/lib/labs-view'
import { LabsList } from '@/components/labs/labs-list'

const MuseumGallery = dynamic(() => import('@/components/labs/museum/museum-gallery'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black font-mono text-xs uppercase tracking-widest text-white/60">
      Entering the gallery…
    </div>
  ),
})

function detectWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}

/** Decides and renders the /labs experience; lets the user override it. */
export function LabsViewSwitch() {
  const params = useSearchParams()
  const [view, setView] = useState<LabsView | null>(null)
  const [webgl, setWebgl] = useState(false)

  useEffect(() => {
    const webglSupported = detectWebGL()
    setWebgl(webglSupported)
    setView(
      resolveLabsView({
        param: params.get('view'),
        coarsePointer: window.matchMedia('(pointer: coarse)').matches,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        webglSupported,
        wideViewport: window.innerWidth >= 1024,
      })
    )
  }, [params])

  // Server render + first client paint: the list (fast, accessible, SEO)
  if (view !== '3d') {
    return (
      <>
        <LabsList />
        {view === 'list' && webgl && (
          <div className="section-container max-w-3xl pb-16">
            <button
              type="button"
              onClick={() => setView('3d')}
              className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium hover:border-primary/50 transition-colors"
            >
              Enter the 3D gallery
            </button>
          </div>
        )}
      </>
    )
  }

  return <MuseumGallery />
}
```

- [ ] **Step 5: Wire into the page**

`useSearchParams` requires a Suspense boundary in App Router:

```tsx
// app/labs/page.tsx
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LabsList } from '@/components/labs/labs-list'
import { LabsViewSwitch } from '@/components/labs/labs-view-switch'

export const metadata: Metadata = {
  title: 'Style Lab | Aram Yeghiazaryan',
  description:
    'One portfolio, many design systems. Each experiment re-skins the same content in a different visual identity — an exercise in un-slopping AI-assisted design.',
}

export default function LabsPage() {
  return (
    <main className="min-h-screen">
      <Suspense fallback={<LabsList />}>
        <LabsViewSwitch />
      </Suspense>
    </main>
  )
}
```

- [ ] **Step 6: Verify**

Run: `pnpm test:unit --run && pnpm lint && pnpm build`
Expected: tests pass, lint clean, build succeeds with `/labs` static.
Then `pnpm dev`, open `http://localhost:3000/labs` on a desktop viewport: a dark wine-red box room with parquet floor renders from a fixed camera. `http://localhost:3000/labs?view=list` shows the list. Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml components/labs/museum/textures.ts components/labs/museum/museum-gallery.tsx components/labs/museum/hall.tsx components/labs/labs-view-switch.tsx app/labs/page.tsx
git commit -m "feat(labs): 3d gallery skeleton with view switching and procedural textures"
```

---

### Task 7: Hall dressing — the classical museum interior

**Files:**
- Modify: `components/labs/museum/hall.tsx` (replace the placeholder box with the real room)

**Interfaces:**
- Consumes: `HALL` (Task 2), `makeParquetTexture`, `makeWallTexture` (Task 6).
- Produces: `<Hall length={number} />` — floor, fabric walls with baseboards and gilt trim, coved ceiling with glowing skylight band, benches, stanchions, and warm light pools along the hall. No other component depends on Hall's internals.

- [ ] **Step 1: Replace hall.tsx with the full room**

```tsx
// components/labs/museum/hall.tsx
'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { HALL } from './layout'
import { makeParquetTexture, makeWallTexture } from './textures'

const GOLD = '#b08d3f'
const MARBLE = '#d8d3c8'
const WOOD = '#4a3120'

/** One wall as fabric panel + marble baseboard + gilt crown strip. */
function Wall({
  width,
  position,
  rotationY,
  fabric,
}: {
  width: number
  position: [number, number, number]
  rotationY: number
  fabric: THREE.Texture
}) {
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, HALL.height / 2, 0]}>
        <planeGeometry args={[width, HALL.height]} />
        <meshStandardMaterial map={fabric} roughness={0.9} />
      </mesh>
      {/* marble baseboard */}
      <mesh position={[0, 0.3, 0.06]}>
        <boxGeometry args={[width, 0.6, 0.12]} />
        <meshStandardMaterial color={MARBLE} roughness={0.35} />
      </mesh>
      {/* gilt crown strip */}
      <mesh position={[0, HALL.height - 0.25, 0.05]}>
        <boxGeometry args={[width, 0.18, 0.1]} />
        <meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.35} />
      </mesh>
    </group>
  )
}

function Bench({ z }: { z: number }) {
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[2, 0.12, 0.6]} />
        <meshStandardMaterial color={WOOD} roughness={0.6} />
      </mesh>
      {[-0.8, 0.8].map((x) => (
        <mesh key={x} position={[x, 0.18, 0]}>
          <boxGeometry args={[0.12, 0.36, 0.5]} />
          <meshStandardMaterial color={WOOD} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

/** Two stanchion posts joined by a sagging velvet rope. */
function Stanchions({ z }: { z: number }) {
  const rope = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-1.1, 0.85, 0),
      new THREE.Vector3(0, 0.55, 0),
      new THREE.Vector3(1.1, 0.85, 0)
    )
    return new THREE.TubeGeometry(curve, 16, 0.035, 6)
  }, [])
  return (
    <group position={[0, 0, z]}>
      {[-1.1, 1.1].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.9, 10]} />
            <meshStandardMaterial color={GOLD} metalness={0.75} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.16, 0.18, 0.05, 12]} />
            <meshStandardMaterial color={GOLD} metalness={0.75} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.92, 0]}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshStandardMaterial color={GOLD} metalness={0.75} roughness={0.3} />
          </mesh>
        </group>
      ))}
      <mesh geometry={rope}>
        <meshStandardMaterial color="#7a1f2b" roughness={0.85} />
      </mesh>
    </group>
  )
}

/** The museum room: floor, walls, coved ceiling with skylight, dressing. */
export function Hall({ length }: { length: number }) {
  const parquet = useMemo(() => {
    const t = makeParquetTexture()
    t.repeat.set(HALL.width / 2.5, length / 2.5)
    return t
  }, [length])
  const fabric = useMemo(() => {
    const t = makeWallTexture()
    t.repeat.set(6, 3)
    return t
  }, [])

  const midZ = -length / 2
  // one warm light pool every ~6m down the center line
  const lightZs = useMemo(() => {
    const zs: number[] = []
    for (let z = -4; z > -length + 3; z -= 6) zs.push(z)
    return zs
  }, [length])

  return (
    <group>
      {/* Floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, midZ]}>
        <planeGeometry args={[HALL.width, length]} />
        <meshStandardMaterial map={parquet} roughness={0.5} />
      </mesh>

      {/* Ceiling: two coved side panels + glowing skylight band */}
      <mesh rotation-x={Math.PI / 2} position={[-HALL.width / 4 - 0.5, HALL.height, midZ]}>
        <planeGeometry args={[HALL.width / 2 - 1, length]} />
        <meshStandardMaterial color="#efe8da" roughness={0.95} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[HALL.width / 4 + 0.5, HALL.height, midZ]}>
        <planeGeometry args={[HALL.width / 2 - 1, length]} />
        <meshStandardMaterial color="#efe8da" roughness={0.95} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, HALL.height + 0.01, midZ]}>
        <planeGeometry args={[2, length]} />
        <meshBasicMaterial color="#fff6e6" />
      </mesh>

      {/* Walls */}
      <Wall width={length} position={[-HALL.width / 2, 0, midZ]} rotationY={Math.PI / 2} fabric={fabric} />
      <Wall width={length} position={[HALL.width / 2, 0, midZ]} rotationY={-Math.PI / 2} fabric={fabric} />
      <Wall width={HALL.width} position={[0, 0, -length]} rotationY={0} fabric={fabric} />
      <Wall width={HALL.width} position={[0, 0, 0]} rotationY={Math.PI} fabric={fabric} />

      {/* Dressing down the center line */}
      <Bench z={-9} />
      {length > 24 && <Bench z={-(length - 10)} />}
      <Stanchions z={-13} />

      {/* Warm skylight pools */}
      {lightZs.map((z) => (
        <pointLight key={z} position={[0, HALL.height - 0.4, z]} intensity={22} distance={13} decay={1.9} color="#ffe7c4" />
      ))}
    </group>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm lint && pnpm exec tsc --noEmit`
Expected: clean.
Then `pnpm dev`, open `/labs`: a warm, wine-red gallery with parquet, glowing skylight band, benches and stanchions. Frame rate smooth. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add components/labs/museum/hall.tsx
git commit -m "feat(labs): classical hall interior - fabric walls, skylight, dressing"
```

---

### Task 8: First-person player controls (desktop + touch)

**Files:**
- Create: `components/labs/museum/player-controls.tsx`
- Create: `components/labs/museum/mobile-joystick.tsx`
- Modify: `components/labs/museum/museum-gallery.tsx`

**Interfaces:**
- Consumes: `PLAYER`, `clampToHall` (Task 2).
- Produces:
  - `<PlayerControls length={number} moveRef={React.RefObject<{x:number;y:number}>} />` — rendered *inside* Canvas. Owns pointer lock, WASD/arrows, touch-drag look, walk clamping.
  - `<MobileJoystick moveRef={...} />` — DOM overlay; writes a normalized move vector into `moveRef`.
  - `museum-gallery.tsx` creates `moveRef`, renders both, shows the joystick only for coarse pointers.

- [ ] **Step 1: Player rig**

```tsx
// components/labs/museum/player-controls.tsx
'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PLAYER, clampToHall } from './layout'

export type MoveVec = { x: number; y: number }

const KEYMAP: Record<string, [keyof MoveVec, number]> = {
  KeyW: ['y', 1], ArrowUp: ['y', 1],
  KeyS: ['y', -1], ArrowDown: ['y', -1],
  KeyA: ['x', -1], ArrowLeft: ['x', -1],
  KeyD: ['x', 1], ArrowRight: ['x', 1],
}

/**
 * First-person rig: pointer-lock mouse look + WASD on desktop,
 * drag-look + joystick vector on touch. Camera stays at eye height,
 * clamped inside the hall.
 */
export function PlayerControls({
  length,
  moveRef,
}: {
  length: number
  moveRef: RefObject<MoveVec>
}) {
  const { camera, gl } = useThree()
  const yaw = useRef(Math.PI) // face down the hall (-z)
  const pitch = useRef(0)
  const keys = useRef<MoveVec>({ x: 0, y: 0 })
  const pressed = useRef(new Set<string>())

  useEffect(() => {
    const el = gl.domElement

    const recomputeKeys = () => {
      const v = { x: 0, y: 0 }
      for (const code of pressed.current) {
        const m = KEYMAP[code]
        if (m) v[m[0]] += m[1]
      }
      keys.current = { x: Math.sign(v.x), y: Math.sign(v.y) }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (KEYMAP[e.code]) { pressed.current.add(e.code); recomputeKeys(); e.preventDefault() }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      pressed.current.delete(e.code); recomputeKeys()
    }

    const onClick = () => {
      if (document.pointerLockElement !== el) el.requestPointerLock()
    }
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return
      yaw.current -= e.movementX * 0.0022
      pitch.current = Math.max(-1.2, Math.min(1.2, pitch.current - e.movementY * 0.0022))
    }

    // Touch look: one-finger drag anywhere on the canvas
    let lastTouch: { x: number; y: number } | null = null
    const onTouchStart = (e: TouchEvent) => {
      lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!lastTouch) return
      const t = e.touches[0]
      yaw.current -= (t.clientX - lastTouch.x) * 0.005
      pitch.current = Math.max(-1.2, Math.min(1.2, pitch.current - (t.clientY - lastTouch.y) * 0.005))
      lastTouch = { x: t.clientX, y: t.clientY }
    }
    const onTouchEnd = () => { lastTouch = null }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    el.addEventListener('click', onClick)
    window.addEventListener('mousemove', onMouseMove)
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      el.removeEventListener('click', onClick)
      window.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [gl])

  useFrame((_, delta) => {
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ')

    const joy = moveRef.current ?? { x: 0, y: 0 }
    const mx = keys.current.x + joy.x
    const my = keys.current.y + joy.y
    if (mx === 0 && my === 0) return

    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    dir.y = 0
    dir.normalize()
    const right = new THREE.Vector3(dir.z, 0, -dir.x).negate()

    const step = PLAYER.speed * Math.min(delta, 0.05)
    const nx = camera.position.x + (dir.x * my + right.x * mx) * step
    const nz = camera.position.z + (dir.z * my + right.z * mx) * step
    const clamped = clampToHall(nx, nz, length)
    camera.position.set(clamped.x, PLAYER.eyeHeight, clamped.z)
  })

  return null
}
```

- [ ] **Step 2: Mobile joystick overlay**

```tsx
// components/labs/museum/mobile-joystick.tsx
'use client'

import { useRef, type RefObject } from 'react'
import type { MoveVec } from './player-controls'

const RADIUS = 48

/** Thumb joystick for touch devices; writes into moveRef, renders a nub. */
export function MobileJoystick({ moveRef }: { moveRef: RefObject<MoveVec> }) {
  const baseRef = useRef<HTMLDivElement>(null)
  const nubRef = useRef<HTMLDivElement>(null)

  const setVec = (clientX: number, clientY: number) => {
    const base = baseRef.current!
    const r = base.getBoundingClientRect()
    let dx = clientX - (r.left + r.width / 2)
    let dy = clientY - (r.top + r.height / 2)
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) { dx *= RADIUS / len; dy *= RADIUS / len }
    nubRef.current!.style.transform = `translate(${dx}px, ${dy}px)`
    moveRef.current = { x: dx / RADIUS, y: -dy / RADIUS }
  }
  const reset = () => {
    nubRef.current!.style.transform = 'translate(0, 0)'
    moveRef.current = { x: 0, y: 0 }
  }

  return (
    <div
      ref={baseRef}
      className="absolute bottom-8 left-8 z-50 h-28 w-28 touch-none rounded-full border border-white/25 bg-white/5"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setVec(e.clientX, e.clientY) }}
      onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) setVec(e.clientX, e.clientY) }}
      onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); reset() }}
      onPointerCancel={reset}
    >
      <div
        ref={nubRef}
        className="absolute left-1/2 top-1/2 -ml-6 -mt-6 h-12 w-12 rounded-full bg-white/30"
      />
    </div>
  )
}
```

- [ ] **Step 3: Wire into MuseumGallery**

In `components/labs/museum/museum-gallery.tsx`:

```tsx
import { useMemo, useRef, useState, useEffect } from 'react'
import { PlayerControls, type MoveVec } from './player-controls'
import { MobileJoystick } from './mobile-joystick'
```

Inside the component add:

```tsx
const moveRef = useRef<MoveVec>({ x: 0, y: 0 })
const [coarse, setCoarse] = useState(false)
useEffect(() => setCoarse(window.matchMedia('(pointer: coarse)').matches), [])
```

Inside `<Canvas>` add `<PlayerControls length={length} moveRef={moveRef} />`; after `</Canvas>` add `{coarse && <MobileJoystick moveRef={moveRef} />}`. Also update the controls hint to be device-aware:

```tsx
<div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[11px] uppercase tracking-widest text-white/50">
  {coarse ? 'Joystick to walk · drag to look · tap art to enter' : 'Click to walk · WASD + mouse · Esc to release'}
</div>
```

- [ ] **Step 4: Verify**

Run: `pnpm lint && pnpm exec tsc --noEmit`
Expected: clean.
Then `pnpm dev`, open `/labs`: click → pointer locks; WASD walks with wall clamping; mouse looks; Esc releases. In devtools device emulation (`/labs?view=3d`), joystick shows and drag-look works. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add components/labs/museum/player-controls.tsx components/labs/museum/mobile-joystick.tsx components/labs/museum/museum-gallery.tsx
git commit -m "feat(labs): first-person controls with pointer lock, WASD, touch joystick"
```

---

### Task 9: Paintings — frames, posters, placards, focus, click-to-enter

**Files:**
- Create: `components/labs/museum/painting.tsx`
- Create: `components/labs/museum/use-painting-focus.ts`
- Modify: `components/labs/museum/museum-gallery.tsx`

**Interfaces:**
- Consumes: `paintingPlacements` (Task 2), `makePlacardTexture` (Task 6), `PaintingPlacement` type.
- Produces:
  - `<Painting placement={PaintingPlacement} register={(slug, obj) => void} />` — gilded frame + poster + placard + picture light.
  - `usePaintingFocus(targets: Map<string, THREE.Object3D>, onChange: (slug: string | null) => void)` — rendered inside Canvas via a `<FocusProbe>` helper it exports; raycasts from camera center every few frames.
  - `museum-gallery.tsx` renders paintings from the manifest, tracks `focused`, and on canvas click navigates to `/labs/<focused>`.

- [ ] **Step 1: Focus hook**

```ts
// components/labs/museum/use-painting-focus.ts
'use client'

import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const FOCUS_RANGE = 6

/**
 * Raycasts from the camera center toward whatever the visitor faces.
 * Calls onChange with the focused painting slug (or null). Runs every
 * 6th frame — focus doesn't need 60hz.
 */
export function FocusProbe({
  targets,
  onChange,
}: {
  targets: React.RefObject<Map<string, THREE.Object3D>>
  onChange: (slug: string | null) => void
}) {
  const { camera } = useThree()
  const raycaster = useRef(new THREE.Raycaster())
  const dir = useRef(new THREE.Vector3())
  const frame = useRef(0)
  const last = useRef<string | null>(null)

  useFrame(() => {
    frame.current = (frame.current + 1) % 6
    if (frame.current !== 0) return
    const map = targets.current
    if (!map || map.size === 0) return

    camera.getWorldDirection(dir.current)
    raycaster.current.set(camera.position, dir.current)
    raycaster.current.far = FOCUS_RANGE

    let found: string | null = null
    let nearest = Infinity
    for (const [slug, obj] of map) {
      const hits = raycaster.current.intersectObject(obj, true)
      if (hits.length > 0 && hits[0].distance < nearest) {
        nearest = hits[0].distance
        found = slug
      }
    }
    if (found !== last.current) {
      last.current = found
      onChange(found)
    }
  })

  return null
}
```

- [ ] **Step 2: Painting component**

```tsx
// components/labs/museum/painting.tsx
'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { makePlacardTexture } from './textures'
import type { PaintingPlacement } from './layout'

const GOLD = '#b08d3f'
// poster is 3:4 portrait
const ART_W = 1.8
const ART_H = 2.4
const FRAME_T = 0.16 // frame bar thickness
const FRAME_D = 0.09 // how far the frame sticks out of the wall

/** A hung lab: gilded frame, poster canvas, brass placard, picture light. */
export function Painting({
  placement,
  focused,
  register,
}: {
  placement: PaintingPlacement
  focused: boolean
  register: (slug: string, obj: THREE.Object3D | null) => void
}) {
  const group = useRef<THREE.Group>(null)
  const poster = useTexture(`/labs/${placement.slug}/poster.jpg`)
  poster.colorSpace = THREE.SRGBColorSpace

  const placard = useMemo(
    () => makePlacardTexture(placement.title, placement.date, placement.thesis),
    [placement.title, placement.date, placement.thesis]
  )

  useEffect(() => {
    register(placement.slug, group.current)
    return () => register(placement.slug, null)
  }, [placement.slug, register])

  const frameColor = focused ? '#d6b968' : GOLD

  return (
    <group ref={group} position={placement.position} rotation-y={placement.rotationY}>
      {/* Poster */}
      <mesh position={[0, 0, FRAME_D / 2]}>
        <planeGeometry args={[ART_W, ART_H]} />
        <meshStandardMaterial map={poster} roughness={0.7} />
      </mesh>

      {/* Frame: four gilded bars */}
      {(
        [
          [0, ART_H / 2 + FRAME_T / 2, ART_W + FRAME_T * 2, FRAME_T],
          [0, -(ART_H / 2 + FRAME_T / 2), ART_W + FRAME_T * 2, FRAME_T],
          [-(ART_W / 2 + FRAME_T / 2), 0, FRAME_T, ART_H],
          [ART_W / 2 + FRAME_T / 2, 0, FRAME_T, ART_H],
        ] as const
      ).map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, FRAME_D / 2]}>
          <boxGeometry args={[w, h, FRAME_D]} />
          <meshStandardMaterial color={frameColor} metalness={0.75} roughness={0.3} />
        </mesh>
      ))}

      {/* Brass placard below */}
      <mesh position={[0, -(ART_H / 2 + FRAME_T + 0.35), 0.03]}>
        <planeGeometry args={[0.9, 0.45]} />
        <meshStandardMaterial map={placard} roughness={0.4} metalness={0.3} />
      </mesh>

      {/* Picture light: warm glow onto the art */}
      <pointLight position={[0, ART_H / 2 + 0.6, 0.8]} intensity={6} distance={4} decay={2} color="#ffdfae" />
    </group>
  )
}
```

- [ ] **Step 3: Wire into MuseumGallery**

In `components/labs/museum/museum-gallery.tsx`:

```tsx
import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Suspense } from 'react'
import * as THREE from 'three'
import { paintingPlacements } from './layout'
import { Painting } from './painting'
import { FocusProbe } from './use-painting-focus'
```

Inside the component:

```tsx
const router = useRouter()
const placements = useMemo(() => paintingPlacements(labs), [])
const targets = useRef(new Map<string, THREE.Object3D>())

const register = useCallback((slug: string, obj: THREE.Object3D | null) => {
  if (obj) targets.current.set(slug, obj)
  else targets.current.delete(slug)
}, [])

const enterFocused = useCallback(() => {
  if (focused) router.push(`/labs/${focused}`)
}, [focused, router])
```

Inside `<Canvas>`:

```tsx
<Suspense fallback={null}>
  {placements.map((p) => (
    <Painting key={p.slug} placement={p} focused={focused === p.slug} register={register} />
  ))}
</Suspense>
<FocusProbe targets={targets} onChange={setFocused} />
```

Add `onClick={enterFocused}` to the `<Canvas>` element — clicking while a painting is focused (crosshair on it, in range) enters the lab. This works both pointer-locked (click fires on the lock element) and on touch (tap after aiming).

- [ ] **Step 4: Verify**

Run: `pnpm lint && pnpm exec tsc --noEmit`
Expected: clean.
Then `pnpm dev`, open `/labs`: the PS1 poster hangs on the left wall in a gilded frame with a readable placard; walking up to it and centering it brightens the frame and shows "Click to enter — PS1 / Y2K"; clicking navigates to `/labs/ps1`; Esc there returns to `/labs`. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add components/labs/museum/painting.tsx components/labs/museum/use-painting-focus.ts components/labs/museum/museum-gallery.tsx
git commit -m "feat(labs): hung paintings with focus highlight and click-to-enter"
```

---

### Task 10: Draped "opening soon" frame

**Files:**
- Create: `components/labs/museum/draped-frame.tsx`
- Modify: `components/labs/museum/museum-gallery.tsx`

**Interfaces:**
- Consumes: `drapedPlacement` (Task 2).
- Produces: `<DrapedFrame labCount={number} />` — far-wall frame under cloth with a spotlight and an "Opening soon" placard. Pure decoration; nothing depends on it.

- [ ] **Step 1: Implementation**

```tsx
// components/labs/museum/draped-frame.tsx
'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { drapedPlacement } from './layout'
import { makePlacardTexture } from './textures'

const GOLD = '#b08d3f'
const W = 2.1
const H = 2.7

/** Cloth-covered frame on the far wall — the museum's own tease. */
export function DrapedFrame({ labCount }: { labCount: number }) {
  const placement = drapedPlacement(labCount)

  // Cloth: a plane with gentle sine folds, computed once
  const cloth = useMemo(() => {
    const geo = new THREE.PlaneGeometry(W + 0.5, H + 0.6, 24, 32)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const sag = Math.sin((x / (W + 0.5)) * Math.PI * 5) * 0.05
      const belly = Math.cos((y / (H + 0.6)) * Math.PI) * 0.06
      pos.setZ(i, 0.12 + sag + belly)
    }
    geo.computeVertexNormals()
    return geo
  }, [])

  const placard = useMemo(() => makePlacardTexture('Opening soon', '', 'The next experiment is being hung.'), [])

  return (
    <group position={placement.position} rotation-y={placement.rotationY}>
      {/* Frame edges peeking out behind the cloth */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[W + 0.3, H + 0.3, 0.08]} />
        <meshStandardMaterial color={GOLD} metalness={0.75} roughness={0.3} />
      </mesh>
      {/* The cloth */}
      <mesh geometry={cloth} position={[0, 0.05, 0.02]}>
        <meshStandardMaterial color="#6d1f2c" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {/* Placard */}
      <mesh position={[0, -(H / 2 + 0.55), 0.05]}>
        <planeGeometry args={[0.9, 0.45]} />
        <meshStandardMaterial map={placard} roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Dedicated warm light bathing the drape (pointLight — spotLight
          targets must live in the scene graph, not worth the ceremony here) */}
      <pointLight position={[0, H / 2 + 1, 1.6]} intensity={18} distance={7} decay={2} color="#ffe7c4" />
    </group>
  )
}
```

- [ ] **Step 2: Wire into MuseumGallery**

In `museum-gallery.tsx`, import and render inside `<Canvas>`:

```tsx
import { DrapedFrame } from './draped-frame'
```

```tsx
<DrapedFrame labCount={labs.length} />
```

- [ ] **Step 3: Verify**

Run: `pnpm lint && pnpm exec tsc --noEmit` — clean.
Then `pnpm dev`, `/labs`: walk to the far end — a spotlit, cloth-draped frame with an "Opening soon" placard. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add components/labs/museum/draped-frame.tsx components/labs/museum/museum-gallery.tsx
git commit -m "feat(labs): draped opening-soon frame at the hall's far end"
```

---

### Task 11: E2E tests + full verification

**Files:**
- Create: `e2e/labs-gallery.spec.ts`
- Test: run everything.

**Interfaces:**
- Consumes: the shipped `/labs` experience.
- Produces: regression coverage for the list view, the 3D mount, and Esc-return.

- [ ] **Step 1: Write the e2e spec**

Check `playwright.config.ts` for the existing project setup first and follow its conventions (baseURL, webServer are already configured — the file exists because `pnpm test:e2e` works today).

```ts
// e2e/labs-gallery.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Style Lab gallery', () => {
  test('list view shows every lab with a working link', async ({ page }) => {
    await page.goto('/labs?view=list')
    const ps1 = page.getByRole('link', { name: /PS1 \/ Y2K/ })
    await expect(ps1).toBeVisible()
    await ps1.click()
    await expect(page).toHaveURL(/\/labs\/ps1/)
  })

  test('desktop /labs mounts the 3D museum canvas', async ({ page, isMobile }) => {
    test.skip(isMobile, '3D is desktop-default only')
    await page.goto('/labs')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('link', { name: /list view/i })).toBeVisible()
  })

  test('Escape inside a lab returns to the gallery', async ({ page }) => {
    await page.goto('/labs/ps1')
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/labs$/, { timeout: 10000 })
  })

  test('lab page has a back-to-gallery button', async ({ page }) => {
    await page.goto('/labs/ps1')
    const back = page.getByRole('link', { name: /gallery/i })
    await expect(back).toBeVisible()
    await back.click()
    await expect(page).toHaveURL(/\/labs/)
  })
})
```

- [ ] **Step 2: Run the e2e suite**

Run: `pnpm test:e2e -- e2e/labs-gallery.spec.ts`
Expected: all pass across configured browsers (WebGL-less CI browsers fall back to the list — the canvas test may skip or need `--project=chromium`; if a headless project lacks WebGL, scope the 3D test with `test.skip(!hasWebGL)` by probing `page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'))` first).

- [ ] **Step 3: Full verification**

```bash
pnpm test:unit --run
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

Expected: everything green; build lists `/labs` and `/labs/ps1` routes. Then a final manual pass in the browser: desktop walk-through, `?view=list`, device-emulation joystick, Esc from PS1 lab.

- [ ] **Step 4: Commit**

```bash
git add e2e/labs-gallery.spec.ts
git commit -m "test(labs): e2e coverage for museum gallery and list view"
```

---

## Done means

- `/labs` on desktop: walkable classical hall, PS1 painting enterable, draped frame at the end, list always one click away.
- `/labs?view=list` and touch devices: the list, with 3D opt-in where supported.
- Every lab page: "← Gallery" + Esc.
- All unit + e2e tests green, lint clean, production build passes.
