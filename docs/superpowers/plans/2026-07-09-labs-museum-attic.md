# Museum Attic (Failed Experiments Wing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire Powder Lines into a walkable attic above the /labs museum — an enclosed stairwell behind the end wall climbs to a gabled room where the game hangs, still playable, beside an honest retrospective plaque and dust-sheet set dressing.

**Architecture:** The manifest gains an `'attic'` status + `retrospective` field; the hall hangs only non-attic labs. `layout.ts` grows from one clamp box to three connected regions (hall → stair corridor → attic) with a continuous `floorY` ramp and axis-separated collision. New `AtticRoom` and `AtticDressing` components render the room; the existing `Painting` component hangs the exhibit unchanged, so click-to-enter keeps working.

**Tech Stack:** Next.js 15, React 19, react-three-fiber + three (already bundled), Vitest (unit project, jsdom), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-07-09-labs-museum-attic-design.md`

## Global Constraints

- Zero new dependencies.
- Copy law (verbatim, lowercase, dry): the doorway sign reads `attic`; the list-view and plaque section heading reads `failed experiments`; the retrospective text is EXACTLY:
  `Three passes, three verdicts. v1: flat polylines and a stick figure — "a cheap copy of Happy Wheels." v2: Alto-style rebuild — day cycle, parallax, jointed rider — but the ramps were painted on and one button did everything. v3: real ramp physics, flips, spins, grabs — better bones, same cheap read. Retired here, still playable, as evidence.`
- No emoji, no hype copy anywhere.
- Lighting budget: the attic adds exactly 2 point lights (1 ridge bulb + the exhibit Painting's own picture light). Hall lights untouched.
- No `Math.random` in render/geometry code — use the existing `mulberry32` seeded generator from `components/labs/museum/textures.ts` for any variance.
- The snowpark lab page, poster, and route are untouched. `GalleryChrome`/Esc behavior is untouched.
- Set dressing is inert: no focus targets, no interactivity, and nothing may occlude the straight line from the attic walk area (eye height) to the exhibit painting's center.
- All existing museum behavior (pointer lock, joystick, focus probe, list-view escape hatch) keeps working.

## File Structure

- `lib/labs-manifest.ts` — status union widens, `retrospective` field, `hallLabs`/`atticLabs` helpers. (Task 1)
- `components/labs/labs-list.tsx` — list view splits into live + `failed experiments` sections. (Task 1)
- `components/labs/museum/layout.ts` — region constants, `floorY`, `clampToRegions`, `atticPlacements`, `atticDepth`. (Task 2)
- `components/labs/museum/player-controls.tsx` — camera y from `floorY`, axis-separated clamp, dev probe. (Task 3)
- `components/labs/museum/hall.tsx` — end-wall doorway + `attic` sign. (Task 3)
- `components/labs/museum/museum-gallery.tsx` — hangs `hallLabs`, renders attic pieces. (Tasks 3–5)
- `components/labs/museum/textures.ts` — `makePlankTexture`, `makeAtticPlaqueTexture`. (Task 4)
- `components/labs/museum/attic-room.tsx` — room shell, beams, ridge light, plaque, exhibit paintings. (Task 4)
- `components/labs/museum/attic-dressing.tsx` — partial drape, covered frames, covered statues. (Task 5)
- Tests: `__tests__/labs/manifest.test.ts`, `__tests__/labs/museum/layout.test.ts`, `e2e/labs-attic.spec.ts`.

---

### Task 1: Manifest attic status + list-view failed experiments section

**Files:**
- Modify: `lib/labs-manifest.ts`
- Modify: `components/labs/labs-list.tsx`
- Test: `__tests__/labs/manifest.test.ts` (create)
- Test: `e2e/labs-attic.spec.ts` (create)

**Interfaces:**
- Produces: `LabEntry.status: 'live' | 'wip' | 'attic'`; `LabEntry.retrospective?: string`; `export const hallLabs: LabEntry[]` (non-attic, manifest order); `export const atticLabs: LabEntry[]` (attic only). Tasks 2–4 consume `hallLabs`/`atticLabs`.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/labs/manifest.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { labs, hallLabs, atticLabs } from '@/lib/labs-manifest'

describe('labs manifest attic split', () => {
  it('splits the manifest into hall and attic without losing entries', () => {
    expect(hallLabs.length + atticLabs.length).toBe(labs.length)
    expect(hallLabs.some((l) => l.status === 'attic')).toBe(false)
    expect(atticLabs.every((l) => l.status === 'attic')).toBe(true)
  })

  it('retires snowpark to the attic with a retrospective', () => {
    const snowpark = atticLabs.find((l) => l.slug === 'snowpark')
    expect(snowpark).toBeDefined()
    expect(snowpark!.retrospective).toContain('Three passes, three verdicts.')
    expect(snowpark!.retrospective).toContain('still playable, as evidence')
  })

  it('every attic entry carries a retrospective', () => {
    expect(atticLabs.every((l) => !!l.retrospective)).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest --project unit __tests__/labs/manifest.test.ts --run`
Expected: FAIL — `hallLabs` is not exported.

- [ ] **Step 3: Implement the manifest changes**

In `lib/labs-manifest.ts`, widen the type and add the field:

```ts
export type LabEntry = {
  slug: string
  title: string
  /** ISO date the experiment shipped */
  date: string
  /** One-line statement of what the experiment explores */
  thesis: string
  status: 'live' | 'wip' | 'attic'
  /** Route the artwork opens; defaults to /labs/<slug> */
  href?: string
  /** The honest saga shown on the attic plaque and in the list view.
   * Required in practice for status 'attic'. */
  retrospective?: string
}
```

Change the snowpark entry (keep slug/title/date/thesis exactly as they are) to:

```ts
  {
    slug: 'snowpark',
    title: 'Powder Lines',
    date: '2026-07-08',
    thesis:
      'A playable snowboard descent drawn as pure geometry — every kicker, rail and box is a real skill; land the trick to collect it.',
    status: 'attic',
    retrospective:
      'Three passes, three verdicts. v1: flat polylines and a stick figure — "a cheap copy of Happy Wheels." v2: Alto-style rebuild — day cycle, parallax, jointed rider — but the ramps were painted on and one button did everything. v3: real ramp physics, flips, spins, grabs — better bones, same cheap read. Retired here, still playable, as evidence.',
  },
```

Append the helpers at the bottom of the file:

```ts
/** What hangs in the main hall — everything not retired to the attic. */
export const hallLabs: LabEntry[] = labs.filter((l) => l.status !== 'attic')

/** The failed experiments upstairs. */
export const atticLabs: LabEntry[] = labs.filter((l) => l.status === 'attic')
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest --project unit __tests__/labs/manifest.test.ts --run`
Expected: 3 PASS.

- [ ] **Step 5: Split the list view**

In `components/labs/labs-list.tsx`: import `atticLabs, hallLabs` instead of `labs`; extract the existing card JSX into a local component so both sections reuse it. Replace the whole file body below the header paragraph with:

```tsx
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { atticLabs, hallLabs, type LabEntry } from '@/lib/labs-manifest'

function LabCard({ lab, showRetrospective }: { lab: LabEntry; showRetrospective?: boolean }) {
  return (
    <Link
      href={lab.href ?? `/labs/${lab.slug}`}
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
        {showRetrospective && lab.retrospective && (
          <p className="text-sm text-muted-foreground/80 italic mt-3 max-w-lg border-l-2 border-border pl-3">
            {lab.retrospective}
          </p>
        )}
      </div>
      <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
    </Link>
  )
}

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
        {hallLabs.map((lab) => (
          <LabCard key={lab.slug} lab={lab} />
        ))}
      </div>

      {atticLabs.length > 0 && (
        <section className="mt-16">
          <h2 className="font-mono text-sm lowercase tracking-widest text-muted-foreground mb-2">
            failed experiments
          </h2>
          <p className="text-sm text-muted-foreground/80 mb-6 max-w-xl">
            Retired iterations, kept playable. The verdicts are part of the work.
          </p>
          <div className="space-y-4">
            {atticLabs.map((lab) => (
              <LabCard key={lab.slug} lab={lab} showRetrospective />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

(The keep-the-header instruction above is satisfied because this IS the whole file — note the original top-of-file content is included verbatim.)

- [ ] **Step 6: E2E for the list view**

Create `e2e/labs-attic.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test.describe('labs attic', () => {
  test('list view shows the failed experiments section with the retrospective', async ({ page }) => {
    await page.goto('/labs?view=list')
    await expect(page.getByRole('heading', { name: 'failed experiments' })).toBeVisible()
    await expect(page.getByText('Three passes, three verdicts.', { exact: false })).toBeVisible()
  })

  test('the retired lab still routes to its playable page', async ({ page }) => {
    await page.goto('/labs?view=list')
    await page.getByRole('link', { name: /Powder Lines/ }).click()
    await expect(page).toHaveURL(/\/labs\/snowpark/)
  })
})
```

- [ ] **Step 7: Verify**

Run: `pnpm vitest --project unit __tests__/labs --run` (all pass), `npx tsc --noEmit`, `pnpm lint`, then `npx playwright test e2e/labs-attic.spec.ts --project=chromium`.
Expected: all green. (Playwright starts its own dev server; do NOT run `pnpm build` while a dev server is running.)

- [ ] **Step 8: Commit**

```bash
git add lib/labs-manifest.ts components/labs/labs-list.tsx __tests__/labs/manifest.test.ts e2e/labs-attic.spec.ts
git commit -m "feat(labs): attic status + failed experiments list section"
```

---

### Task 2: Layout regions — floorY, clampToRegions, attic placements

**Files:**
- Modify: `components/labs/museum/layout.ts`
- Test: `__tests__/labs/museum/layout.test.ts` (create)

**Interfaces:**
- Consumes: `LabEntry` type (Task 1 shape).
- Produces (exact, later tasks depend on these):
  - `export const STAIR = { doorX: 2.5, doorWidth: 1.4, doorHeight: 2.6, run: 4, rise: 2.8, walkHalf: 0.5 }`
  - `export const ATTIC = { halfWidth: 3.5, depth: 6, wallHeight: 1.6, ridgeHeight: 3.4, floorMargin: 0.5, hangOffset: 0.12 }`
  - `export function atticDepth(hallLen: number): number` — absolute far z of walkable space: `hallLen + STAIR.run + ATTIC.depth`.
  - `export function floorY(z: number, hallLen: number): number` — 0 in hall, linear ramp over the stair run, `STAIR.rise` in the attic. Continuous.
  - `export function clampToRegions(prev: { x: number; z: number }, next: { x: number; z: number }, hallLen: number): { x: number; z: number }` — axis-separated region collision (replaces `clampToHall` in movement; keep `clampToHall` exported, other code may reference it).
  - `export function atticPlacements(atticLabs: LabEntry[], hallLen: number): PaintingPlacement[]` — exhibits on the far gable wall, spread across x.
  - `export function atticPlaquePlacement(hallLen: number): { position: [number, number, number]; rotationY: number }`.

**Region geometry (binding):** hall walkable: `x ∈ [−(HALL.width/2 − HALL.margin), +…]`, `z ∈ [−(hallLen − HALL.margin), −HALL.margin]`. Stair corridor walkable: `x ∈ [STAIR.doorX − STAIR.walkHalf, STAIR.doorX + STAIR.walkHalf]`, `z ∈ [−(hallLen + STAIR.run), −(hallLen − HALL.margin))`. Attic walkable: `x ∈ [−(ATTIC.halfWidth − ATTIC.floorMargin), +…]`, `z ∈ [−(atticDepth(hallLen) − ATTIC.floorMargin), −(hallLen + STAIR.run))`.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/labs/museum/layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  ATTIC,
  STAIR,
  HALL,
  atticDepth,
  atticPlacements,
  atticPlaquePlacement,
  clampToRegions,
  floorY,
  hallLength,
} from '@/components/labs/museum/layout'
import type { LabEntry } from '@/lib/labs-manifest'

const L = hallLength(2) // hall with two paintings

describe('floorY', () => {
  it('is 0 through the hall and at the door plane', () => {
    expect(floorY(-1, L)).toBe(0)
    expect(floorY(-L, L)).toBe(0)
  })
  it('ramps linearly to the attic floor over the stair run', () => {
    expect(floorY(-(L + STAIR.run / 2), L)).toBeCloseTo(STAIR.rise / 2, 6)
    expect(floorY(-(L + STAIR.run), L)).toBeCloseTo(STAIR.rise, 6)
  })
  it('holds the attic floor beyond the stair top', () => {
    expect(floorY(-(L + STAIR.run + 2), L)).toBe(STAIR.rise)
  })
  it('is continuous at both seams', () => {
    const eps = 1e-4
    expect(floorY(-L + eps, L)).toBeCloseTo(floorY(-L - eps, L), 3)
    const top = -(L + STAIR.run)
    expect(floorY(top + eps, L)).toBeCloseTo(floorY(top - eps, L), 3)
  })
})

describe('clampToRegions', () => {
  const wallZ = -(L - HALL.margin)
  it('blocks the end wall away from the door', () => {
    const r = clampToRegions({ x: 0, z: wallZ + 0.05 }, { x: 0, z: wallZ - 0.2 }, L)
    expect(r.z).toBeGreaterThanOrEqual(wallZ)
    expect(r.x).toBe(0) // no sideways teleport
  })
  it('lets the player through the doorway span', () => {
    const r = clampToRegions({ x: STAIR.doorX, z: wallZ + 0.05 }, { x: STAIR.doorX, z: wallZ - 0.2 }, L)
    expect(r.z).toBeLessThan(wallZ)
  })
  it('holds corridor side walls on the stairs', () => {
    const midStair = -(L + STAIR.run / 2)
    const r = clampToRegions(
      { x: STAIR.doorX, z: midStair },
      { x: STAIR.doorX + 2, z: midStair },
      L
    )
    expect(r.x).toBeLessThanOrEqual(STAIR.doorX + STAIR.walkHalf)
  })
  it('opens into the full attic width past the stair top', () => {
    const atticMid = -(L + STAIR.run + 2)
    const r = clampToRegions({ x: STAIR.doorX, z: atticMid }, { x: -2.5, z: atticMid }, L)
    expect(r.x).toBeCloseTo(-2.5, 6)
  })
  it('stops at the attic far wall', () => {
    const deep = -(atticDepth(L) + 1)
    const r = clampToRegions({ x: 0, z: -(L + STAIR.run + 2) }, { x: 0, z: deep }, L)
    expect(r.z).toBeGreaterThanOrEqual(-(atticDepth(L) - ATTIC.floorMargin))
  })
  it('cannot jump from hall into attic width while standing in the corridor band', () => {
    const midStair = -(L + STAIR.run / 2)
    const r = clampToRegions({ x: STAIR.doorX, z: midStair }, { x: 0, z: midStair }, L)
    expect(r.x).toBeGreaterThanOrEqual(STAIR.doorX - STAIR.walkHalf)
  })
})

describe('attic placements', () => {
  const entry = (slug: string): LabEntry => ({
    slug,
    title: slug,
    date: '2026-07-09',
    thesis: 't',
    status: 'attic',
    retrospective: 'r',
  })
  it('hangs exhibits on the far gable wall facing the room', () => {
    const [p] = atticPlacements([entry('snowpark')], L)
    expect(p.rotationY).toBe(0)
    expect(p.position[2]).toBeCloseTo(-(atticDepth(L) - ATTIC.hangOffset), 6)
    expect(p.position[1]).toBeGreaterThan(STAIR.rise) // hangs above the attic floor
  })
  it('spreads multiple exhibits across x', () => {
    const ps = atticPlacements([entry('a'), entry('b')], L)
    expect(ps[0].position[0]).not.toBe(ps[1].position[0])
  })
  it('places the plaque beside the first exhibit on the same wall', () => {
    const plaque = atticPlaquePlacement(L)
    expect(plaque.rotationY).toBe(0)
    expect(plaque.position[2]).toBeCloseTo(-(atticDepth(L) - ATTIC.hangOffset), 6)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest --project unit __tests__/labs/museum/layout.test.ts --run`
Expected: FAIL — `ATTIC` etc. not exported.

- [ ] **Step 3: Implement in `components/labs/museum/layout.ts`**

Append after the existing exports (keep everything already there — `clampToHall` stays):

```ts
/** Stairwell through the end wall: doorway placement and the climb. */
export const STAIR = {
  doorX: 2.5,
  doorWidth: 1.4,
  doorHeight: 2.6,
  /** how far the corridor runs past the end wall (z units) */
  run: 4,
  /** attic floor height */
  rise: 2.8,
  /** half of the walkable corridor width */
  walkHalf: 0.5,
}

/** The gabled room above the end zone. */
export const ATTIC = {
  halfWidth: 3.5,
  depth: 6,
  /** side wall height above the attic floor */
  wallHeight: 1.6,
  /** ridge height above the attic floor */
  ridgeHeight: 3.4,
  floorMargin: 0.5,
  /** how far exhibits sit off the far gable wall */
  hangOffset: 0.12,
}

/** Absolute far end of walkable space (positive number; walls at z = -atticDepth). */
export function atticDepth(hallLen: number): number {
  return hallLen + STAIR.run + ATTIC.depth
}

/** Floor height under the player: hall 0, linear stair ramp, attic STAIR.rise. */
export function floorY(z: number, hallLen: number): number {
  const into = -z - hallLen // how far past the end wall plane
  if (into <= 0) return 0
  if (into >= STAIR.run) return STAIR.rise
  return (into / STAIR.run) * STAIR.rise
}

type Rect = { minX: number; maxX: number; minZ: number; maxZ: number }

function regions(hallLen: number): Rect[] {
  const maxX = HALL.width / 2 - HALL.margin
  return [
    // hall
    { minX: -maxX, maxX, minZ: -(hallLen - HALL.margin), maxZ: -HALL.margin },
    // stair corridor (overlaps the hall edge so the door plane is crossable)
    {
      minX: STAIR.doorX - STAIR.walkHalf,
      maxX: STAIR.doorX + STAIR.walkHalf,
      minZ: -(hallLen + STAIR.run),
      maxZ: -(hallLen - HALL.margin),
    },
    // attic (starts exactly where the corridor ends)
    {
      minX: -(ATTIC.halfWidth - ATTIC.floorMargin),
      maxX: ATTIC.halfWidth - ATTIC.floorMargin,
      minZ: -(atticDepth(hallLen) - ATTIC.floorMargin),
      maxZ: -(hallLen + STAIR.run),
    },
  ]
}

function inAnyRegion(x: number, z: number, rects: Rect[]): boolean {
  return rects.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ)
}

/**
 * Axis-separated region collision. Frame steps are small (<= ~0.15 u), so
 * trying x and z independently against the region union gives clean wall
 * sliding with no teleporting: a blocked axis simply keeps its previous value.
 */
export function clampToRegions(
  prev: { x: number; z: number },
  next: { x: number; z: number },
  hallLen: number
): { x: number; z: number } {
  const rects = regions(hallLen)
  const x = inAnyRegion(next.x, prev.z, rects) ? next.x : prev.x
  const z = inAnyRegion(x, next.z, rects) ? next.z : prev.z
  return { x, z }
}

/** Exhibits hang on the far gable wall, facing back toward the stairs. */
export function atticPlacements(atticEntries: LabEntry[], hallLen: number): PaintingPlacement[] {
  const wallZ = -(atticDepth(hallLen) - ATTIC.hangOffset)
  const hangY = STAIR.rise + 1.5
  return atticEntries.map((lab, i) => ({
    slug: lab.slug,
    title: lab.title,
    date: lab.date,
    thesis: lab.thesis,
    position: [-1.2 + i * 2.6, hangY, wallZ],
    rotationY: 0,
  }))
}

/** The failed-experiments plaque, right of the first exhibit on the same wall. */
export function atticPlaquePlacement(hallLen: number): {
  position: [number, number, number]
  rotationY: number
} {
  return {
    position: [1.6, STAIR.rise + 1.5, -(atticDepth(hallLen) - ATTIC.hangOffset)],
    rotationY: 0,
  }
}
```

Note: `prev.z` may sit exactly on a region seam; the corridor rect's `maxZ` equals the hall rect's `minZ` and the attic rect's `maxZ` equals the corridor rect's `minZ`, so seam positions belong to both rects and the union test never has a gap. Do not change those boundary values independently.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest --project unit __tests__/labs/museum/layout.test.ts --run`
Expected: all PASS.

- [ ] **Step 5: Full unit + tsc + lint, then commit**

```bash
git add components/labs/museum/layout.ts __tests__/labs/museum/layout.test.ts
git commit -m "feat(museum): attic layout regions - floor ramp, axis-separated collision, exhibit placements"
```

---

### Task 3: Walkable elevation + hall doorway + filtered hall

**Files:**
- Modify: `components/labs/museum/player-controls.tsx`
- Modify: `components/labs/museum/hall.tsx`
- Modify: `components/labs/museum/museum-gallery.tsx`

**Interfaces:**
- Consumes: `floorY(z, hallLen)`, `clampToRegions(prev, next, hallLen)` (Task 2); `hallLabs`, `atticLabs` (Task 1).
- Produces: `PlayerControls` walks all three regions at correct height and exposes a dev-only probe `window.__museum = { pos(): [x, y, z]; place(x: number, z: number, yawRad: number): void }`; the hall end wall has a doorway at `STAIR.doorX` with an `attic` sign; `museum-gallery` hangs only `hallLabs` and sizes the hall by `hallLabs.length`. Tasks 4–5 mount their components inside the same `<Canvas>`.

- [ ] **Step 1: PlayerControls — elevation + region clamp + probe**

In `components/labs/museum/player-controls.tsx`:

Replace the import line `import { PLAYER, clampToHall } from './layout'` with:

```ts
import { PLAYER, clampToRegions, floorY } from './layout'
```

Replace the final position block inside `useFrame` (the lines computing `nx`, `nz`, `clamped`, and `camera.position.set`) with:

```ts
    const step = PLAYER.speed * Math.min(delta, 0.05)
    const nx = camera.position.x + (dir.x * ny2 + right.x * nx2) * step
    const nz = camera.position.z + (dir.z * ny2 + right.z * nx2) * step
    const clamped = clampToRegions(
      { x: camera.position.x, z: camera.position.z },
      { x: nx, z: nz },
      length
    )
    camera.position.set(clamped.x, floorY(clamped.z, length) + PLAYER.eyeHeight, clamped.z)
```

Add the dev probe inside the component's `useEffect` (after the listener registrations, before the cleanup return), plus cleanup:

```ts
    // Dev-only probe for orchestrator gate walkthroughs (mirrors snowpark's __powder).
    if (process.env.NODE_ENV !== 'production') {
      ;(window as unknown as Record<string, unknown>).__museum = {
        pos: () => camera.position.toArray(),
        place: (x: number, z: number, yawRad: number) => {
          yaw.current = yawRad
          camera.position.set(x, 0, z) // y is recomputed by the next frame's floorY
        },
      }
    }
```

and in the effect cleanup:

```ts
      if (process.env.NODE_ENV !== 'production') {
        delete (window as unknown as Record<string, unknown>).__museum
      }
```

(The `useEffect` deps gain `camera`: change `}, [gl])` to `}, [gl, camera])`.)

Note the movement early-return `if (mx === 0 && my === 0) return` runs BEFORE the position set — after a `place()` call the camera y is stale until the player moves. Fix: move the `camera.rotation.set(...)` line as-is, then change the early return to still re-seat height:

```ts
    if (mx === 0 && my === 0) {
      camera.position.y = floorY(camera.position.z, length) + PLAYER.eyeHeight
      return
    }
```

- [ ] **Step 2: Hall end wall gains the doorway + sign**

In `components/labs/museum/hall.tsx`: import `STAIR` from `./layout` and `makePlacardTexture` is already imported by other files — here import it too:

```ts
import { HALL, STAIR } from './layout'
import { makeParquetTexture, makeWallTexture, makePlacardTexture } from './textures'
```

Replace the single end-wall line `<Wall width={HALL.width} position={[0, 0, -length]} rotationY={0} fabric={fabric} />` with a doorway assembly (left segment, right segment, lintel, sign). Widths: left segment spans from `−HALL.width/2` to `doorLeft`; right segment from `doorRight` to `+HALL.width/2`, where `doorLeft = STAIR.doorX − STAIR.doorWidth / 2 = 1.8`, `doorRight = 3.2`:

```tsx
      {/* End wall with the attic doorway cut beside the draped frame */}
      <EndWall length={length} fabric={fabric} />
```

and add the component above `Hall`:

```tsx
/** End wall split around the attic doorway, with a lintel and a small sign. */
function EndWall({ length, fabric }: { length: number; fabric: THREE.Texture }) {
  const doorLeft = STAIR.doorX - STAIR.doorWidth / 2
  const doorRight = STAIR.doorX + STAIR.doorWidth / 2
  const leftW = doorLeft - -(HALL.width / 2)
  const rightW = HALL.width / 2 - doorRight
  const sign = useMemo(() => makePlacardTexture('attic', '', ''), [])
  return (
    <group position={[0, 0, -length]}>
      <Wall
        width={leftW}
        position={[-(HALL.width / 2) + leftW / 2 - 0, 0, 0]}
        rotationY={0}
        fabric={fabric}
      />
      <Wall width={rightW} position={[doorRight + rightW / 2, 0, 0]} rotationY={0} fabric={fabric} />
      {/* Lintel above the door opening */}
      <mesh position={[STAIR.doorX, STAIR.doorHeight + (HALL.height - STAIR.doorHeight) / 2, 0]}>
        <planeGeometry args={[STAIR.doorWidth, HALL.height - STAIR.doorHeight]} />
        <meshStandardMaterial map={fabric} roughness={0.9} />
      </mesh>
      {/* Door jambs: dark reveal so the opening reads as depth, not a hole */}
      <mesh position={[STAIR.doorX, STAIR.doorHeight / 2, -0.06]}>
        <planeGeometry args={[STAIR.doorWidth, STAIR.doorHeight]} />
        <meshBasicMaterial color="#181410" />
      </mesh>
      {/* Small lowercase sign above the lintel */}
      <mesh position={[STAIR.doorX, STAIR.doorHeight + 0.35, 0.02]}>
        <planeGeometry args={[0.6, 0.3]} />
        <meshStandardMaterial map={sign} roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  )
}
```

IMPORTANT: `Wall` internally positions its mesh relative to its own origin at the wall centerline. The existing `Wall` component renders a plane of `width` centered at its `position` — the two segment `position` values above are the segment centers in the end-wall group's local x. The dark reveal plane at z −0.06 sits just behind the wall plane so it is visible THROUGH the opening but does not z-fight the corridor Task 4 builds (the corridor interior starts at z −0.1 relative to the wall). Keep those z offsets.

Note the `Wall` component also draws a baseboard and crown across its full width — with the wall split, baseboard/crown stop at the door on both sides, which is correct.

- [ ] **Step 3: museum-gallery hangs only hallLabs**

In `components/labs/museum/museum-gallery.tsx`:

- Change the manifest import to `import { hallLabs, atticLabs, labs } from '@/lib/labs-manifest'`.
- `const length = useMemo(() => hallLength(hallLabs.length), [])`
- `const placements = useMemo(() => paintingPlacements(hallLabs), [])`
- The two `labs.find(...)` lookups (focused lab + enterFocused) keep using `labs` — attic exhibits must still resolve by slug when focused (Task 4 registers them into the same `targets` map).
- `<DrapedFrame labCount={hallLabs.length} />`

- [ ] **Step 4: Verify + commit**

Run: `pnpm vitest --project unit __tests__/labs --run`, `npx tsc --noEmit`, `pnpm lint`. Then `pnpm dev`, open `http://localhost:3000/labs`, walk to the end wall: the doorway shows a dark opening with an `attic` sign; walking in climbs (into a not-yet-built void — Task 4 adds the room; this is expected and noted in the commit).

```bash
git add components/labs/museum/player-controls.tsx components/labs/museum/hall.tsx components/labs/museum/museum-gallery.tsx
git commit -m "feat(museum): walkable attic stairwell - elevation, doorway, hall hangs live labs only"
```

---

### Task 4: The attic room — shell, textures, light, exhibit, plaque

**Files:**
- Modify: `components/labs/museum/textures.ts` (add `makePlankTexture`, `makeAtticPlaqueTexture`)
- Create: `components/labs/museum/attic-room.tsx`
- Modify: `components/labs/museum/museum-gallery.tsx` (mount it)

**Interfaces:**
- Consumes: `ATTIC`, `STAIR`, `atticDepth`, `atticPlacements`, `atticPlaquePlacement` (Task 2); `atticLabs` (Task 1); `Painting`, `PaintingBoundary` (existing); `register` callback from museum-gallery.
- Produces: `export function AtticRoom({ hallLen, register, focused }: { hallLen: number; register: (slug: string, obj: THREE.Object3D | null) => void; focused: string | null })` — renders the room + stair shaft interior + exhibits; `export function makePlankTexture(): THREE.CanvasTexture`; `export function makeAtticPlaqueTexture(title: string, body: string): THREE.CanvasTexture`.

- [ ] **Step 1: Textures**

Append to `components/labs/museum/textures.ts`:

```ts
/** Rough grey-brown attic floorboards. */
export function makePlankTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512)
  const rnd = mulberry32(29)
  g.fillStyle = '#6b5844'
  g.fillRect(0, 0, 512, 512)
  const plankW = 64
  for (let col = 0; col < 512 / plankW; col++) {
    const tone = 0.75 + rnd() * 0.4
    g.fillStyle = `rgb(${Math.round(112 * tone)}, ${Math.round(92 * tone)}, ${Math.round(70 * tone)})`
    g.fillRect(col * plankW + 1, 0, plankW - 2, 512)
    // sparse grain scratches
    for (let i = 0; i < 14; i++) {
      const y = rnd() * 512
      g.fillStyle = 'rgba(0,0,0,0.08)'
      g.fillRect(col * plankW + 4 + rnd() * (plankW - 8), y, 2, 8 + rnd() * 30)
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Aged paper plaque for the attic — more body room than the brass placard. */
export function makeAtticPlaqueTexture(title: string, body: string): THREE.CanvasTexture {
  const [c, g] = canvas(512)
  g.fillStyle = '#d8cdb4'
  g.fillRect(0, 0, 512, 512)
  g.strokeStyle = 'rgba(60,45,20,0.5)'
  g.lineWidth = 5
  g.strokeRect(12, 12, 488, 488)
  g.fillStyle = '#3a2d16'
  g.textAlign = 'center'
  g.font = '700 34px Georgia, serif'
  g.fillText(title, 256, 70)
  g.font = '21px Georgia, serif'
  const words = body.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).length > 42 && line) {
      lines.push(line)
      line = w
    } else {
      line = line ? line + ' ' + w : w
    }
  }
  if (line) lines.push(line)
  lines.slice(0, 13).forEach((l, i) => g.fillText(l, 256, 122 + i * 29))
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
```

- [ ] **Step 2: The room component**

Create `components/labs/museum/attic-room.tsx`:

```tsx
'use client'

import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import { atticLabs } from '@/lib/labs-manifest'
import {
  ATTIC,
  STAIR,
  atticDepth,
  atticPlacements,
  atticPlaquePlacement,
} from './layout'
import { Painting, PaintingBoundary } from './painting'
import { makeAtticPlaqueTexture, makePlankTexture } from './textures'

const BEAM = '#3d2f21'
const ROOF = '#2e241a'
const WALLTONE = '#8a7a63'

/**
 * The failed-experiments wing: a gabled room above the end zone plus the
 * stair shaft that reaches it. Exhibits use the same Painting component as
 * the hall, so focus and click-to-enter work unchanged.
 */
export function AtticRoom({
  hallLen,
  register,
  focused,
}: {
  hallLen: number
  register: (slug: string, obj: THREE.Object3D | null) => void
  focused: string | null
}) {
  const far = atticDepth(hallLen)
  const roomZ = -(hallLen + STAIR.run + ATTIC.depth / 2) // room center
  const floorYAbs = STAIR.rise

  const planks = useMemo(() => {
    const t = makePlankTexture()
    t.repeat.set(ATTIC.halfWidth, ATTIC.depth / 3.5)
    return t
  }, [])

  const plaque = useMemo(() => {
    const first = atticLabs[0]
    return makeAtticPlaqueTexture('failed experiments', first?.retrospective ?? '')
  }, [])

  const placements = useMemo(() => atticPlacements(atticLabs, hallLen), [hallLen])
  const plaquePos = useMemo(() => atticPlaquePlacement(hallLen), [hallLen])

  // Roof planes: from side wall tops to the ridge. Width of each slope:
  const slopeW = Math.hypot(ATTIC.halfWidth, ATTIC.ridgeHeight - ATTIC.wallHeight)
  const slopeAngle = Math.atan2(ATTIC.ridgeHeight - ATTIC.wallHeight, ATTIC.halfWidth)

  return (
    <group>
      {/* Stair shaft: two side walls, a ceiling, and the ramp floor */}
      <StairShaft hallLen={hallLen} />

      {/* Attic floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, floorYAbs, roomZ]}>
        <planeGeometry args={[ATTIC.halfWidth * 2, ATTIC.depth]} />
        <meshStandardMaterial map={planks} roughness={0.85} />
      </mesh>

      {/* Side knee walls */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * ATTIC.halfWidth, floorYAbs + ATTIC.wallHeight / 2, roomZ]}
          rotation-y={s > 0 ? -Math.PI / 2 : Math.PI / 2}
        >
          <planeGeometry args={[ATTIC.depth, ATTIC.wallHeight]} />
          <meshStandardMaterial color={WALLTONE} roughness={0.95} />
        </mesh>
      ))}

      {/* Roof slopes up to the ridge */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[
            (s * ATTIC.halfWidth) / 2,
            floorYAbs + ATTIC.wallHeight + (ATTIC.ridgeHeight - ATTIC.wallHeight) / 2,
            roomZ,
          ]}
          rotation-z={s * (Math.PI / 2 - slopeAngle) * -1}
          rotation-y={s > 0 ? -Math.PI / 2 : Math.PI / 2}
          rotation-order="YZX"
        >
          <planeGeometry args={[ATTIC.depth, slopeW]} />
          <meshStandardMaterial color={ROOF} roughness={1} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Gable walls: entry (with the stair opening) and the far exhibit wall */}
      <GableWall z={-(hallLen + STAIR.run)} floorYAbs={floorYAbs} withOpening />
      <GableWall z={-far} floorYAbs={floorYAbs} />

      {/* Roof beams */}
      {[0.16, 0.42, 0.68].map((t) => (
        <mesh
          key={t}
          position={[0, floorYAbs + ATTIC.ridgeHeight - 0.35, -(hallLen + STAIR.run + t * ATTIC.depth)]}
        >
          <boxGeometry args={[ATTIC.halfWidth * 2 - 0.6, 0.18, 0.18]} />
          <meshStandardMaterial color={BEAM} roughness={0.9} />
        </mesh>
      ))}

      {/* One dim warm bulb at the ridge */}
      <pointLight
        position={[0, floorYAbs + ATTIC.ridgeHeight - 0.5, roomZ]}
        intensity={9}
        distance={11}
        decay={1.8}
        color="#ffd9a0"
      />

      {/* Exhibits — same Painting, same focus/enter contract as the hall */}
      <Suspense fallback={null}>
        {placements.map((p) => (
          <PaintingBoundary key={p.slug}>
            <Painting placement={p} focused={focused === p.slug} register={register} />
          </PaintingBoundary>
        ))}
      </Suspense>

      {/* The saga plaque */}
      <mesh position={plaquePos.position} rotation-y={plaquePos.rotationY}>
        <planeGeometry args={[1.15, 1.15]} />
        <meshStandardMaterial map={plaque} roughness={0.9} />
      </mesh>
    </group>
  )
}

/** Corridor interior: ramp floor, flanking walls, low ceiling. */
function StairShaft({ hallLen }: { hallLen: number }) {
  const midZ = -(hallLen + STAIR.run / 2)
  const rampLen = Math.hypot(STAIR.run, STAIR.rise)
  const rampAngle = Math.atan2(STAIR.rise, STAIR.run)
  const w = STAIR.doorWidth + 0.4
  return (
    <group>
      {/* Ramp floor (reads as stairs from the walk feel; treads are visual noise at this scale) */}
      <mesh
        position={[STAIR.doorX, STAIR.rise / 2, midZ]}
        rotation-x={-Math.PI / 2 + rampAngle}
      >
        <planeGeometry args={[w, rampLen]} />
        <meshStandardMaterial color="#5c4b38" roughness={0.9} />
      </mesh>
      {/* Side walls */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[STAIR.doorX + (s * w) / 2, STAIR.rise / 2 + 1.1, midZ]}
          rotation-y={s > 0 ? -Math.PI / 2 : Math.PI / 2}
        >
          <planeGeometry args={[STAIR.run, STAIR.rise + 3.4]} />
          <meshStandardMaterial color="#4a3c2d" roughness={0.95} />
        </mesh>
      ))}
      {/* Shaft ceiling */}
      <mesh position={[STAIR.doorX, STAIR.rise + 2.7, midZ]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[w, STAIR.run]} />
        <meshStandardMaterial color="#33291d" roughness={1} />
      </mesh>
    </group>
  )
}

/** A gable end: rectangle up to wall height plus the triangle to the ridge.
 * All materials are DoubleSide, so both gables are placed in world
 * coordinates with no rotation — no mirrored math to get wrong. */
function GableWall({
  z,
  floorYAbs,
  withOpening,
}: {
  z: number
  floorYAbs: number
  withOpening?: boolean
}) {
  const tri = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-ATTIC.halfWidth, 0)
    shape.lineTo(ATTIC.halfWidth, 0)
    shape.lineTo(0, ATTIC.ridgeHeight - ATTIC.wallHeight)
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [])
  // The stair shaft interior is doorWidth + 0.4 wide; the opening matches it
  // and runs to the right knee wall (a sliver segment there would be
  // degenerate). Left segment: from -halfWidth to the opening's left edge.
  const openLeft = STAIR.doorX - (STAIR.doorWidth + 0.4) / 2 // = 1.6
  const leftW = openLeft + ATTIC.halfWidth // = 5.1
  return (
    <group position={[0, 0, z]}>
      {withOpening ? (
        <mesh position={[openLeft - leftW / 2, floorYAbs + ATTIC.wallHeight / 2, 0]}>
          <planeGeometry args={[leftW, ATTIC.wallHeight]} />
          <meshStandardMaterial color={WALLTONE} roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      ) : (
        <mesh position={[0, floorYAbs + ATTIC.wallHeight / 2, 0]}>
          <planeGeometry args={[ATTIC.halfWidth * 2, ATTIC.wallHeight]} />
          <meshStandardMaterial color={WALLTONE} roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      )}
      <mesh geometry={tri} position={[0, floorYAbs + ATTIC.wallHeight, 0]}>
        <meshStandardMaterial color={WALLTONE} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 3: Mount in museum-gallery**

In `components/labs/museum/museum-gallery.tsx` add the import and render inside `<Canvas>` after `<DrapedFrame …/>`:

```tsx
import { AtticRoom } from './attic-room'
...
        <AtticRoom hallLen={length} register={register} focused={focused} />
```

- [ ] **Step 4: Verify + commit**

Run: `pnpm vitest --project unit __tests__/labs --run`, `npx tsc --noEmit`, `pnpm lint`. Then walk it in `pnpm dev`: climb the stairs, the room reads (floor, gables, beams, warm bulb), Powder Lines hangs on the far wall with its focus ring and `Click to enter — Powder Lines` hint, the plaque shows the full retrospective, clicking enters `/labs/snowpark`, Esc returns.

```bash
git add components/labs/museum/textures.ts components/labs/museum/attic-room.tsx components/labs/museum/museum-gallery.tsx
git commit -m "feat(museum): the attic room - gabled shell, stair shaft, exhibit wall, saga plaque"
```

---

### Task 5: Set dressing — careless drapes, covered frames, covered statues

**Files:**
- Create: `components/labs/museum/attic-dressing.tsx`
- Modify: `components/labs/museum/attic-room.tsx` (mount dressing)

**Interfaces:**
- Consumes: `ATTIC`, `STAIR`, `atticDepth` (Task 2); `mulberry32` is NOT exported from textures.ts — the dressing component defines its own local copy (5 lines) rather than widening the textures API.
- Produces: `export function AtticDressing({ hallLen }: { hallLen: number })` and `export function CornerDrape({ placement }: { placement: PaintingPlacement })`.

**Placement constraints (binding):**
- The `CornerDrape` covers ONLY the top-left region of the exhibit frame: in painting-local coordinates its cloth spans x ∈ [−1.35, −0.1], y ∈ [0.15, 1.65], z = +0.14 (in front of the poster, behind nothing). The painting center (0, 0) and the whole right half stay unobstructed — the FocusProbe ray to the center must hit the poster, not cloth.
- Covered frames lean against the SIDE knee walls (never the far exhibit wall), fully off the walk line: |x| ≥ ATTIC.halfWidth − 0.75.
- Statues stand in the far corners away from the exhibit's sight line: e.g. (−2.6, z_far − 1.2) and (2.7, z_entry + 1.4).
- Dust-sheet material everywhere: color `#b9b3a6`, roughness 0.95, DoubleSide. (The ceremonial wine-red drape stays unique to the hall's DrapedFrame.)

- [ ] **Step 1: The dressing component**

Create `components/labs/museum/attic-dressing.tsx`:

```tsx
'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { ATTIC, STAIR, atticDepth, type PaintingPlacement } from './layout'

const SHEET = '#b9b3a6'

/** Deterministic pseudo-random (local copy; textures.ts keeps its own). */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A cloth plane with seeded sine folds — the shared dust-sheet look. */
function clothGeometry(w: number, h: number, seed: number, sag = 0.06): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(w, h, 18, 24)
  const rnd = mulberry32(seed)
  const phase = rnd() * Math.PI * 2
  const freq = 3 + rnd() * 3
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const folds = Math.sin((x / w) * Math.PI * freq + phase) * sag
    const belly = Math.cos((y / h) * Math.PI) * sag * 0.8
    pos.setZ(i, folds + belly)
  }
  geo.computeVertexNormals()
  return geo
}

function sheetMaterialProps() {
  return { color: SHEET, roughness: 0.95, side: THREE.DoubleSide } as const
}

/** Cloth thrown carelessly over one top corner of an exhibit — pulled aside,
 * as if someone recently looked. Covers only the top-left; the painting
 * center and right half stay clear for the focus raycast. */
export function CornerDrape({ placement }: { placement: PaintingPlacement }) {
  const cloth = useMemo(() => clothGeometry(1.25, 1.5, 41, 0.08), [])
  return (
    <group position={placement.position} rotation-y={placement.rotationY}>
      <mesh geometry={cloth} position={[-0.72, 0.9, 0.14]} rotation-z={-0.18}>
        <meshStandardMaterial {...sheetMaterialProps()} />
      </mesh>
    </group>
  )
}

/** A frame leaning against a knee wall, fully under a dust sheet. */
function CoveredFrame({
  x,
  z,
  lean,
  seed,
  w = 1.3,
  h = 1.7,
}: {
  x: number
  z: number
  lean: number
  seed: number
  w?: number
  h?: number
}) {
  const cloth = useMemo(() => clothGeometry(w + 0.35, h + 0.4, seed, 0.07), [w, h, seed])
  const side = x > 0 ? -1 : 1 // lean toward the room center
  return (
    <group position={[x, STAIR.rise, z]} rotation-z={side * lean} rotation-y={side > 0 ? 0.35 : -0.35}>
      {/* The hidden frame gives the sheet its silhouette */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, 0.09]} />
        <meshStandardMaterial color="#54452f" roughness={0.8} />
      </mesh>
      <mesh geometry={cloth} position={[0, h / 2 + 0.05, 0.09]}>
        <meshStandardMaterial {...sheetMaterialProps()} />
      </mesh>
      <mesh geometry={cloth} position={[0, h / 2 + 0.05, -0.09]} rotation-y={Math.PI}>
        <meshStandardMaterial {...sheetMaterialProps()} />
      </mesh>
    </group>
  )
}

/** A sheeted statue: lathe silhouette under cloth — base, shoulders, head. */
function CoveredStatue({ x, z, height, seed }: { x: number; z: number; height: number; seed: number }) {
  const geo = useMemo(() => {
    const rnd = mulberry32(seed)
    const pts: THREE.Vector2[] = []
    const steps = 14
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      // base 0.42 -> waist 0.3 -> shoulder bump 0.26 -> head 0.13, with cloth wobble
      const base = 0.42 * (1 - t) + 0.13 * t
      const shoulder = Math.exp(-Math.pow((t - 0.72) * 5, 2)) * 0.07
      const wobble = Math.sin(t * Math.PI * 6 + rnd() * 6) * 0.015
      pts.push(new THREE.Vector2(Math.max(0.02, base + shoulder + wobble), t * height))
    }
    return new THREE.LatheGeometry(pts, 20)
  }, [height, seed])
  return (
    <mesh geometry={geo} position={[x, STAIR.rise, z]}>
      <meshStandardMaterial {...sheetMaterialProps()} />
    </mesh>
  )
}

/** All inert attic props. No focus targets, nothing on the exhibit sight line. */
export function AtticDressing({ hallLen }: { hallLen: number }) {
  const far = atticDepth(hallLen)
  const entryZ = -(hallLen + STAIR.run)
  return (
    <group>
      <CoveredFrame x={-(ATTIC.halfWidth - 0.55)} z={entryZ - 1.6} lean={0.16} seed={7} />
      <CoveredFrame x={-(ATTIC.halfWidth - 0.7)} z={entryZ - 2.1} lean={0.22} seed={11} w={1.0} h={1.4} />
      <CoveredFrame x={ATTIC.halfWidth - 0.6} z={entryZ - 3.4} lean={0.14} seed={19} />
      <CoveredStatue x={-2.6} z={-(far - 1.2)} height={1.7} seed={23} />
      <CoveredStatue x={2.7} z={entryZ - 1.4} height={1.1} seed={31} />
    </group>
  )
}
```

- [ ] **Step 2: Mount in attic-room.tsx**

In `components/labs/museum/attic-room.tsx`: import `{ AtticDressing, CornerDrape }` from `./attic-dressing`, then inside `AtticRoom`'s returned group add after the plaque mesh:

```tsx
      <AtticDressing hallLen={hallLen} />
      {placements[0] && <CornerDrape placement={placements[0]} />}
```

- [ ] **Step 3: Verify + commit**

Run: `pnpm vitest --project unit __tests__/labs --run`, `npx tsc --noEmit`, `pnpm lint`. In `pnpm dev`: sheets read as dusty canvas (grey-beige, not the hall's wine red), the exhibit's corner drape covers roughly a quarter of the poster top-left, aiming the crosshair at the poster center still focuses and `Click to enter` works, leaning frames hug the knee walls, statues stand clear of the walk line.

```bash
git add components/labs/museum/attic-dressing.tsx components/labs/museum/attic-room.tsx
git commit -m "feat(museum): attic set dressing - corner drape, sheeted frames, covered statues"
```

---

### GATE H (ORCHESTRATOR): the attic answers the retirement

- [ ] Walkthrough (dev probe `window.__museum.place`): hall reads unchanged with two paintings; the end-wall doorway reads as a lit opening with the lowercase `attic` sign; the stairs climb smoothly (no camera pop at either seam); the room reads attic — low warm light, beams, planks, dust sheets; Powder Lines hangs with the corner drape and focuses/enters; the plaque carries the full retrospective; Esc from the game returns to /labs.
- [ ] Collision honesty: cannot clip through the end wall beside the door, the corridor sides, or the attic walls; cannot fall off into the void.
- [ ] List view shows `failed experiments` with the retrospective; hall (3D) no longer hangs Powder Lines.
- [ ] Full gates: `pnpm vitest --project unit --run`, `npx tsc --noEmit`, `pnpm lint`, `pnpm build` (dev server stopped first), `npx playwright test e2e/labs-attic.spec.ts e2e/labs-snowpark.spec.ts`.
- [ ] Ledger verdict; push `feat/labs-attic`; open PR with the retirement story; hand to user for preview.
