# Museum Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The first-person museum becomes the site's main page at `/` (portfolio demoted to `/classic-claude`), with sprint/jump movement, a red-drape loader doubling as a visitor's guide, a lean-in painting preview card, and an exhibition-catalogue list view with a crawlable masthead.

**Architecture:** Movement math is extracted to a pure `movement.ts` module (unit-tested like `layout.ts`); jump adds a vertical offset ON TOP of the per-frame `floorY + eyeHeight` assignment. The curtain is a DOM overlay owned by `labs-view-switch` fed by a `LoadSignal` component inside the Canvas (drei `useProgress`), so three.js stays in the dynamic chunk. The catalogue is a CSS-module rebuild of `labs-list.tsx` translating the museum's WebGL identity (wine walls, brass placards, gold frames, Georgia serif) into DOM.

**Tech Stack:** Next.js 15 App Router, React 19, react-three-fiber + drei, Vitest + RTL (jsdom), Playwright, CSS Modules.

**Spec:** `docs/superpowers/specs/2026-07-10-museum-overhaul-design.md`

## Global Constraints

- Aram is "Senior Frontend Engineer" — never "lead" or "Technical Lead", in any copy.
- Content only from `data/`, `lib/constants.ts`, `lib/labs-manifest.ts` — no hardcoded personal facts.
- Commit format `<type>: <description>` — NO attribution lines, no Co-Authored-By.
- No `console.log`. No new global CSS — CSS modules only (`curtain.module.css`, `focus-card.module.css`, `catalogue.module.css`).
- Every test file explicitly imports `{ describe, it, expect, vi }` etc. from `vitest` — CI runs bare `pnpm exec tsc --noEmit` and vitest globals only cover runtime (this exact gap failed CI on PR #8).
- Immutability: pure functions return new objects (mutable refs inside r3f frame loops are the established `player-controls.tsx` exception).
- The 3D scene stays `aria-hidden`; the list view remains the accessible/crawler path.
- Poster constraint: portrait 768×1024, ≤200 KB.
- The museum Canvas base FOV is 62 (`museum-gallery.tsx:50`) — movement constants use 62, not the spec's illustrative 60.
- Test placement: updates go in the file that already holds the suite; new museum tests go under `__tests__/labs/museum/`.
- Run the full unit suite (`pnpm test:unit`) once before each commit; expected baseline 211 passing plus whatever the task adds.

---

### Task 1: Rename the main entry to "Classic Claude" (+ poster regen)

**Files:**
- Modify: `lib/labs-manifest.ts:32-39`
- Modify: `scripts/posters/main-poster.html:88-104`
- Create: `scripts/posters/capture-main.mjs`
- Regenerate: `public/labs/main/poster.jpg`
- Test: `__tests__/labs/manifest.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: manifest `main` entry `{ slug: 'main', title: 'Classic Claude', href: '/classic-claude' }` — placard, catalogue card, and routing tasks all read these fields. `/classic-claude` route does not exist until Task 8; the dead link mid-branch is expected.

- [ ] **Step 1: Write the failing test** — append to `__tests__/labs/manifest.test.ts` inside the existing describe block:

```ts
  it('demotes the main site to a hall painting at /classic-claude', () => {
    const main = hallLabs.find((l) => l.slug === 'main')
    expect(main).toBeDefined()
    expect(main!.title).toBe('Classic Claude')
    expect(main!.href).toBe('/classic-claude')
    expect(main!.status).toBe('live')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run __tests__/labs/manifest.test.ts`
Expected: FAIL — `expected 'Terracotta' to be 'Classic Claude'`

- [ ] **Step 3: Update the manifest** — replace the `main` entry (lib/labs-manifest.ts:31-39) with:

```ts
  {
    slug: 'main',
    title: 'Classic Claude',
    date: '2026-07-08',
    thesis:
      'Standard AI with a twist — warm terracotta and cream, pixel avatar, Bricolage Grotesque. The control every experiment is measured against.',
    status: 'live',
    href: '/classic-claude',
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run __tests__/labs/manifest.test.ts __tests__/components/labs/labs-list.test.tsx`
Expected: PASS (labs-list card test reads `lab.href`/`lab.title` from the manifest, so it follows automatically).

- [ ] **Step 5: Update the poster art** — in `scripts/posters/main-poster.html`:
  - Line 90: `g.font = '700 92px Arial, Helvetica, sans-serif'` → `g.font = '700 72px Arial, Helvetica, sans-serif'` ("Classic Claude" is longer than "Terracotta"; 72px keeps it inside 768px).
  - Line 93: `g.fillText('Terracotta', cx, typeTop)` → `g.fillText('Classic Claude', cx, typeTop)`
  - Line 103: `const label = 'STYLE LAB — DEFAULT'` → `const label = 'STANDARD AI — WITH A TWIST'`

- [ ] **Step 6: Create the capture script** — `scripts/posters/capture-main.mjs` (same pattern as `capture-xp.mjs`):

```js
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const dir = path.dirname(fileURLToPath(import.meta.url))
const html = path.join(dir, 'main-poster.html')
const out = path.join(dir, '..', '..', 'public', 'labs', 'main', 'poster.jpg')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 768, height: 1024 } })
await page.goto('file://' + html.replace(/\\/g, '/'))
await page.screenshot({ path: out, type: 'jpeg', quality: 80 })
await browser.close()
```

- [ ] **Step 7: Regenerate and verify the poster**

Run: `node scripts/posters/capture-main.mjs`
Then verify: file exists, is JPEG, under 200 KB (PowerShell: `(Get-Item public/labs/main/poster.jpg).Length` — expect < 204800).

- [ ] **Step 8: Full unit suite, then commit**

Run: `pnpm test:unit` — expected all passing.

```bash
git add lib/labs-manifest.ts scripts/posters/main-poster.html scripts/posters/capture-main.mjs public/labs/main/poster.jpg __tests__/labs/manifest.test.ts
git commit -m "feat: rename main entry to Classic Claude with regenerated poster"
```

---

### Task 2: Pure movement module (sprint + jump math)

**Files:**
- Create: `components/labs/museum/movement.ts`
- Test: `__tests__/labs/museum/movement.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (Task 3 depends on these exact names):
  - `SPRINT_MULT = 1.85`, `JUMP_V0 = 3.2`, `GRAVITY = 9.8`, `FOV_BASE = 62`, `FOV_SPRINT = 68`
  - `type JumpState = { offset: number; velocity: number; airborne: boolean }`
  - `GROUNDED: JumpState`
  - `speedFor(base: number, sprinting: boolean): number`
  - `tryJump(state: JumpState): JumpState` — no-op (returns same reference) while airborne
  - `stepJump(state: JumpState, dt: number): JumpState` — semi-implicit Euler; clamps to `GROUNDED` on landing
  - `fovTarget(sprinting: boolean, moving: boolean): number`

- [ ] **Step 1: Write the failing tests** — `__tests__/labs/museum/movement.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  FOV_BASE,
  FOV_SPRINT,
  GRAVITY,
  GROUNDED,
  JUMP_V0,
  SPRINT_MULT,
  fovTarget,
  speedFor,
  stepJump,
  tryJump,
} from '@/components/labs/museum/movement'

describe('speedFor', () => {
  it('returns the base speed when not sprinting', () => {
    expect(speedFor(3, false)).toBe(3)
  })

  it('scales by SPRINT_MULT when sprinting', () => {
    expect(speedFor(3, true)).toBeCloseTo(3 * SPRINT_MULT)
  })
})

describe('jump', () => {
  it('takes off from the ground with JUMP_V0', () => {
    expect(tryJump(GROUNDED)).toEqual({ offset: 0, velocity: JUMP_V0, airborne: true })
  })

  it('ignores jump input while airborne (no double jump)', () => {
    const midair = stepJump(tryJump(GROUNDED), 0.1)
    expect(tryJump(midair)).toBe(midair)
  })

  it('rises under its initial velocity and decelerates under gravity', () => {
    const s1 = stepJump(tryJump(GROUNDED), 0.05)
    expect(s1.offset).toBeGreaterThan(0)
    expect(s1.velocity).toBeLessThan(JUMP_V0)
    expect(s1.velocity).toBeCloseTo(JUMP_V0 - GRAVITY * 0.05)
  })

  it('comes back down and lands exactly on GROUNDED', () => {
    let s = tryJump(GROUNDED)
    for (let i = 0; i < 200; i++) s = stepJump(s, 0.016)
    expect(s).toEqual(GROUNDED)
    expect(s.offset).toBe(0)
  })

  it('is a no-op on the ground and never mutates inputs', () => {
    expect(stepJump(GROUNDED, 0.016)).toBe(GROUNDED)
    const air = tryJump(GROUNDED)
    stepJump(air, 0.016)
    expect(air).toEqual({ offset: 0, velocity: JUMP_V0, airborne: true })
    expect(GROUNDED).toEqual({ offset: 0, velocity: 0, airborne: false })
  })
})

describe('fovTarget', () => {
  it('widens only while sprint-moving', () => {
    expect(fovTarget(true, true)).toBe(FOV_SPRINT)
    expect(fovTarget(true, false)).toBe(FOV_BASE)
    expect(fovTarget(false, true)).toBe(FOV_BASE)
    expect(fovTarget(false, false)).toBe(FOV_BASE)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run __tests__/labs/museum/movement.test.ts`
Expected: FAIL — cannot resolve `@/components/labs/museum/movement`

- [ ] **Step 3: Implement** — `components/labs/museum/movement.ts`:

```ts
/**
 * Pure movement math for the museum's first-person rig — sprint speed and
 * the Space-bar hop. The hop is a vertical OFFSET added on top of the
 * per-frame `floorY(z) + eyeHeight` camera height (player-controls hard-sets
 * that every frame, so jump state must live outside it and be additive).
 */

export const SPRINT_MULT = 1.85
export const JUMP_V0 = 3.2
export const GRAVITY = 9.8
/** Matches the Canvas camera in museum-gallery.tsx. */
export const FOV_BASE = 62
export const FOV_SPRINT = 68

export type JumpState = {
  /** vertical offset above the floor, in world units */
  offset: number
  /** vertical velocity, units/sec */
  velocity: number
  airborne: boolean
}

export const GROUNDED: JumpState = { offset: 0, velocity: 0, airborne: false }

/** Walk speed for the frame; sprinting scales the base speed. */
export function speedFor(base: number, sprinting: boolean): number {
  return sprinting ? base * SPRINT_MULT : base
}

/** Begin a hop if grounded; airborne input is ignored (no double jump). */
export function tryJump(state: JumpState): JumpState {
  if (state.airborne) return state
  return { offset: 0, velocity: JUMP_V0, airborne: true }
}

/** Advance the hop by dt seconds (semi-implicit Euler); land on GROUNDED. */
export function stepJump(state: JumpState, dt: number): JumpState {
  if (!state.airborne) return state
  const velocity = state.velocity - GRAVITY * dt
  const offset = state.offset + velocity * dt
  if (offset <= 0) return GROUNDED
  return { offset, velocity, airborne: true }
}

/** Camera FOV target: widen only while actually sprint-moving. */
export function fovTarget(sprinting: boolean, moving: boolean): number {
  return sprinting && moving ? FOV_SPRINT : FOV_BASE
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run __tests__/labs/museum/movement.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Full unit suite, then commit**

```bash
git add components/labs/museum/movement.ts __tests__/labs/museum/movement.test.ts
git commit -m "feat: add pure sprint/jump movement math for the museum"
```

---

### Task 3: Wire sprint/jump/FOV into the player rig + hint line

**Files:**
- Modify: `components/labs/museum/player-controls.tsx`
- Modify: `components/labs/museum/museum-gallery.tsx:83` (hint line)

**Interfaces:**
- Consumes: everything Task 2 produces.
- Produces: no new API — behavior only. `PlayerControls` props unchanged.

No new unit test: `player-controls.tsx` is an r3f frame-loop component with no test coverage by repo convention; the math is covered by Task 2. Verification is typecheck + suite + the Gate A playtest.

- [ ] **Step 1: Add imports and refs** — in `player-controls.tsx`, extend the layout import line and add a movement import:

```ts
import { PLAYER, clampToRegions, floorY } from './layout'
import { GROUNDED, fovTarget, speedFor, stepJump, tryJump, type JumpState } from './movement'
```

Inside the component, after `const pressed = useRef(new Set<string>())` add:

```ts
  const sprint = useRef(false)
  const jump = useRef<JumpState>(GROUNDED)
```

- [ ] **Step 2: Extend the key handlers** — replace `onKeyDown`/`onKeyUp` (lines 56-61) with:

```ts
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { sprint.current = true; return }
      if (e.code === 'Space') { jump.current = tryJump(jump.current); e.preventDefault(); return }
      if (KEYMAP[e.code]) { pressed.current.add(e.code); recomputeKeys(); e.preventDefault() }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { sprint.current = false; return }
      pressed.current.delete(e.code); recomputeKeys()
    }
```

- [ ] **Step 3: Rewrite the frame loop** — replace the whole `useFrame` callback (lines 119-150) with:

```ts
  useFrame((_, delta) => {
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ')

    const dt = Math.min(delta, 0.05)
    jump.current = stepJump(jump.current, dt)

    const joy = moveRef.current ?? { x: 0, y: 0 }
    const mx = keys.current.x + joy.x
    const my = keys.current.y + joy.y
    const moving = mx !== 0 || my !== 0

    // Sprint FOV: widen while running, settle back when not.
    const cam = camera as THREE.PerspectiveCamera
    const fov = THREE.MathUtils.lerp(cam.fov, fovTarget(sprint.current, moving), Math.min(1, delta * 8))
    if (Math.abs(fov - cam.fov) > 0.01) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }

    if (!moving) {
      camera.position.y = floorY(camera.position.z, length) + PLAYER.eyeHeight + jump.current.offset
      return
    }

    // Normalize so diagonals and stacked keyboard+joystick don't exceed unit speed.
    const len = Math.hypot(mx, my)
    const nx2 = len > 1 ? mx / len : mx
    const ny2 = len > 1 ? my / len : my

    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    dir.y = 0
    dir.normalize()
    const right = new THREE.Vector3(dir.z, 0, -dir.x).negate()

    const step = speedFor(PLAYER.speed, sprint.current) * dt
    const nx = camera.position.x + (dir.x * ny2 + right.x * nx2) * step
    const nz = camera.position.z + (dir.z * ny2 + right.z * nx2) * step
    const clamped = clampToRegions(
      { x: camera.position.x, z: camera.position.z },
      { x: nx, z: nz },
      length
    )
    camera.position.set(
      clamped.x,
      floorY(clamped.z, length) + PLAYER.eyeHeight + jump.current.offset,
      clamped.z
    )
  })
```

- [ ] **Step 4: Update the hint line** — in `museum-gallery.tsx:83`, change the desktop string:

```tsx
        {coarse ? 'Joystick to walk · drag to look · center art, tap to enter' : 'Click to walk · WASD + mouse · Shift to run · Space to jump · Esc to release'}
```

- [ ] **Step 5: Verify, then commit**

Run: `pnpm exec tsc --noEmit` — expected clean.
Run: `pnpm test:unit` — expected all passing.

```bash
git add components/labs/museum/player-controls.tsx components/labs/museum/museum-gallery.tsx
git commit -m "feat: shift-to-run with FOV kick and space-to-jump in the museum"
```

---

### Task 4: Visitor's guide + red-drape curtain components

**Files:**
- Create: `components/labs/museum/visitor-guide.tsx`
- Create: `components/labs/museum/curtain.tsx`
- Create: `components/labs/museum/curtain.module.css`
- Test: `__tests__/labs/museum/curtain.test.tsx`

**Interfaces:**
- Consumes: nothing (standalone DOM components — NO three.js imports anywhere in this chain; the curtain ships in the main bundle).
- Produces (Tasks 5 and 6 depend on these):
  - `Curtain({ ready, progress }: { ready: boolean; progress: number })` — self-unmounts after opening; renders `data-phase="closed"|"opening"` for tests/e2e.
  - `CURTAIN_MIN_HOLD_MS = 800`, `CURTAIN_MAX_WAIT_MS = 8000`, `CURTAIN_OPEN_MS = 1400`
  - `VisitorGuide()` — the controls card, reused by the "?" overlay in Task 6.

- [ ] **Step 1: Write the failing tests** — `__tests__/labs/museum/curtain.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import {
  Curtain,
  CURTAIN_MAX_WAIT_MS,
  CURTAIN_MIN_HOLD_MS,
  CURTAIN_OPEN_MS,
} from '@/components/labs/museum/curtain'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('Curtain', () => {
  it('shows the visitor guide and live progress while closed', () => {
    render(<Curtain ready={false} progress={42} />)
    expect(screen.getByText(/visitor.s guide/i)).toBeInTheDocument()
    expect(screen.getByText(/42%/)).toBeInTheDocument()
    expect(screen.getByText(/shift/i)).toBeInTheDocument()
    expect(document.querySelector('[data-phase="closed"]')).toBeTruthy()
  })

  it('holds the minimum, then parts and unmounts once ready', () => {
    const { rerender } = render(<Curtain ready={false} progress={0} />)
    rerender(<Curtain ready progress={100} />)
    act(() => vi.advanceTimersByTime(CURTAIN_MIN_HOLD_MS - 1))
    expect(document.querySelector('[data-phase="closed"]')).toBeTruthy()
    act(() => vi.advanceTimersByTime(1))
    expect(document.querySelector('[data-phase="opening"]')).toBeTruthy()
    act(() => vi.advanceTimersByTime(CURTAIN_OPEN_MS))
    expect(document.querySelector('[data-phase]')).toBeNull()
  })

  it('gives up waiting at the failsafe and opens anyway', () => {
    render(<Curtain ready={false} progress={10} />)
    act(() => vi.advanceTimersByTime(CURTAIN_MAX_WAIT_MS))
    expect(document.querySelector('[data-phase="opening"]')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run __tests__/labs/museum/curtain.test.tsx`
Expected: FAIL — cannot resolve `@/components/labs/museum/curtain`

- [ ] **Step 3: Implement the guide** — `components/labs/museum/visitor-guide.tsx`:

```tsx
import styles from './curtain.module.css'

export const CONTROLS: Array<[string, string]> = [
  ['Click', 'step in — locks the cursor'],
  ['W A S D', 'walk the halls'],
  ['Mouse', 'look around'],
  ['Shift', 'run'],
  ['Space', 'jump'],
  ['Click a painting', 'enter the work'],
  ['Esc', 'release the cursor'],
]

/** The printed card of controls, shown on the curtain and behind the ? button. */
export function VisitorGuide() {
  return (
    <div className={styles.guide}>
      <p className={styles.guideEyebrow}>Museum of Experiments</p>
      <h2 className={styles.guideTitle}>Visitor&rsquo;s Guide</h2>
      <dl className={styles.guideList}>
        {CONTROLS.map(([key, what]) => (
          <div key={key} className={styles.guideRow}>
            <dt>{key}</dt>
            <dd>{what}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
```

- [ ] **Step 4: Implement the curtain** — `components/labs/museum/curtain.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './curtain.module.css'
import { VisitorGuide } from './visitor-guide'

export const CURTAIN_MIN_HOLD_MS = 800
export const CURTAIN_MAX_WAIT_MS = 8000
export const CURTAIN_OPEN_MS = 1400

type Phase = 'closed' | 'opening' | 'gone'

/**
 * Red theater drapes over the museum while it loads. Parts once `ready`
 * (a minimum hold so warm caches never flicker, a failsafe so one broken
 * poster can't trap the visitor), then unmounts itself.
 */
export function Curtain({ ready, progress }: { ready: boolean; progress: number }) {
  const [phase, setPhase] = useState<Phase>('closed')
  const mountedAt = useRef<number>(Date.now())

  // Open when ready, but never before the minimum hold.
  useEffect(() => {
    if (phase !== 'closed' || !ready) return
    const wait = Math.max(0, CURTAIN_MIN_HOLD_MS - (Date.now() - mountedAt.current))
    const t = setTimeout(() => setPhase('opening'), wait)
    return () => clearTimeout(t)
  }, [ready, phase])

  // Failsafe: open even if the ready signal never arrives.
  useEffect(() => {
    if (phase !== 'closed') return
    const t = setTimeout(() => setPhase('opening'), CURTAIN_MAX_WAIT_MS)
    return () => clearTimeout(t)
  }, [phase])

  // Unmount after the panels finish parting.
  useEffect(() => {
    if (phase !== 'opening') return
    const t = setTimeout(() => setPhase('gone'), CURTAIN_OPEN_MS)
    return () => clearTimeout(t)
  }, [phase])

  if (phase === 'gone') return null

  return (
    <div
      className={phase === 'opening' ? `${styles.curtain} ${styles.open}` : styles.curtain}
      data-phase={phase}
      aria-hidden="true"
    >
      <div className={`${styles.panel} ${styles.panelLeft}`} />
      <div className={`${styles.panel} ${styles.panelRight}`} />
      <div className={styles.stage}>
        <VisitorGuide />
        <p className={styles.progress}>
          {ready ? 'The gallery is ready' : `Preparing the gallery — ${Math.round(progress)}%`}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Style it** — `components/labs/museum/curtain.module.css`:

```css
/* Red velvet drapes + the visitor's guide card. Palette matches the 3D hall:
   wine fabric walls (#5a2028 family), brass gold (#b08d3f/#d6b968), cream. */

.curtain {
  position: fixed;
  inset: 0;
  z-index: 60;
  overflow: hidden;
  background: #0c0507;
  font-family: Georgia, 'Times New Roman', serif;
}

.panel {
  position: absolute;
  top: -2%;
  bottom: -2%;
  width: 54%;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0) 18%, rgba(0, 0, 0, 0.55)),
    repeating-linear-gradient(
      90deg,
      #7e1f2b 0px,
      #a03040 34px,
      #5c141e 72px,
      #8a2533 110px,
      #6a1824 148px
    );
  box-shadow: inset 0 -18px 40px rgba(0, 0, 0, 0.55);
  transition: transform 1.2s cubic-bezier(0.72, 0.01, 0.3, 1);
}

.panel::after {
  /* gold fringe */
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 14px;
  background: repeating-linear-gradient(90deg, #d6b968 0 3px, #8a6a24 3px 6px);
}

.panelLeft {
  left: 0;
}

.panelRight {
  right: 0;
}

.open .panelLeft {
  transform: translateX(-108%) rotate(-1.5deg);
}

.open .panelRight {
  transform: translateX(108%) rotate(1.5deg);
}

.stage {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  text-align: center;
  transition: opacity 0.45s ease;
}

.open .stage {
  opacity: 0;
}

.guide {
  color: #efe8da;
  max-width: 26rem;
}

.guideEyebrow {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: #d6b968;
  margin-bottom: 0.75rem;
}

.guideTitle {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 1.25rem;
  color: #f5eede;
}

.guideList {
  display: grid;
  gap: 0.4rem;
  text-align: left;
  margin: 0 auto;
  width: fit-content;
}

.guideRow {
  display: grid;
  grid-template-columns: 9.5rem 1fr;
  gap: 1rem;
  align-items: baseline;
}

.guideRow dt {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #d6b968;
}

.guideRow dd {
  margin: 0;
  font-style: italic;
  font-size: 14px;
  color: #cfc5b2;
}

.progress {
  margin-top: 1.5rem;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: rgba(239, 232, 218, 0.55);
}

@media (prefers-reduced-motion: reduce) {
  .panel {
    transition: opacity 0.2s ease;
  }

  .open .panelLeft,
  .open .panelRight {
    transform: none;
    opacity: 0;
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run __tests__/labs/museum/curtain.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 7: Full unit suite, then commit**

```bash
git add components/labs/museum/visitor-guide.tsx components/labs/museum/curtain.tsx components/labs/museum/curtain.module.css __tests__/labs/museum/curtain.test.tsx
git commit -m "feat: red-drape curtain loader with visitor's guide"
```

---

### Task 5: Load signal + curtain wiring

**Files:**
- Create: `components/labs/museum/load-signal.tsx`
- Modify: `components/labs/museum/museum-gallery.tsx` (accept `onLoadChange`, render LoadSignal)
- Modify: `components/labs/labs-view-switch.tsx` (render Curtain, drop the text loading fallback)
- Test: `__tests__/labs/museum/load-signal.test.tsx`

**Interfaces:**
- Consumes: `Curtain` from Task 4.
- Produces:
  - `LoadSignal({ onChange }: { onChange: (progress: number, ready: boolean) => void })` — lives INSIDE the Canvas (inside the dynamic chunk; it imports drei).
  - `MuseumGallery` default export gains optional prop `onLoadChange?: (progress: number, ready: boolean) => void`.

- [ ] **Step 1: Write the failing test** — `__tests__/labs/museum/load-signal.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { LoadSignal } from '@/components/labs/museum/load-signal'

// vi.mock factories are hoisted above module-scope consts — vi.hoisted keeps
// the shared state initialized before the factory can run (plain const = TDZ crash).
const progressState = vi.hoisted(() => ({ active: true, progress: 40 }))
vi.mock('@react-three/drei', () => ({
  useProgress: () => ({ ...progressState }),
}))

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('LoadSignal', () => {
  it('reports progress without ready while the manager is active', () => {
    const onChange = vi.fn()
    render(<LoadSignal onChange={onChange} />)
    expect(onChange).toHaveBeenCalledWith(40, false)
    act(() => vi.advanceTimersByTime(1000))
    expect(onChange).not.toHaveBeenCalledWith(expect.anything(), true)
  })

  it('reports ready 300ms after the manager goes idle', () => {
    const onChange = vi.fn()
    progressState.active = false
    progressState.progress = 100
    render(<LoadSignal onChange={onChange} />)
    expect(onChange).toHaveBeenCalledWith(100, false)
    act(() => vi.advanceTimersByTime(300))
    expect(onChange).toHaveBeenCalledWith(100, true)
  })

  it('treats a warm cache (never active, progress 0) as ready', () => {
    const onChange = vi.fn()
    progressState.active = false
    progressState.progress = 0
    render(<LoadSignal onChange={onChange} />)
    act(() => vi.advanceTimersByTime(300))
    expect(onChange).toHaveBeenCalledWith(0, true)
  })
})
```

Note: `progressState` mutations leak between tests by design — each test sets the fields it needs before render.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run __tests__/labs/museum/load-signal.test.tsx`
Expected: FAIL — cannot resolve `@/components/labs/museum/load-signal`

- [ ] **Step 3: Implement** — `components/labs/museum/load-signal.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { useProgress } from '@react-three/drei'

/**
 * Bridges three's DefaultLoadingManager (which drei's useTexture feeds) to
 * the DOM curtain. `ready` fires after the manager has been idle for 300ms —
 * covering both the normal case (posters finish at 100) and the warm-cache
 * case where no load ever starts (`active` never flips true, progress stays 0).
 */
export function LoadSignal({
  onChange,
}: {
  onChange: (progress: number, ready: boolean) => void
}) {
  const { active, progress } = useProgress()

  useEffect(() => {
    onChange(progress, false)
    if (active) return
    const t = setTimeout(() => onChange(progress, true), 300)
    return () => clearTimeout(t)
  }, [active, progress, onChange])

  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run __tests__/labs/museum/load-signal.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Thread the prop through MuseumGallery** — in `museum-gallery.tsx`:

Add the import:

```tsx
import { LoadSignal } from './load-signal'
```

Change the component signature (line 22):

```tsx
export default function MuseumGallery({
  onLoadChange,
}: {
  onLoadChange?: (progress: number, ready: boolean) => void
}) {
```

Inside `<Canvas>`, after `<PlayerControls ... />` (line 66), add:

```tsx
        {onLoadChange && <LoadSignal onChange={onLoadChange} />}
```

- [ ] **Step 6: Render the curtain from the switch** — in `labs-view-switch.tsx`:

Replace the existing react import (line 3) and add the curtain import:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { Curtain } from '@/components/labs/museum/curtain'
```

(`curtain.tsx` imports only React + its CSS module — no three.js — so this static import keeps the main bundle clean.)

Replace the dynamic-import loading fallback (lines 9-16) — the curtain covers chunk load now:

```tsx
const MuseumGallery = dynamic(() => import('@/components/labs/museum/museum-gallery'), {
  ssr: false,
  loading: () => null, // the Curtain overlay covers the chunk download
})
```

Add load state inside `LabsViewSwitch` (after the `webgl` state):

```tsx
  const [load, setLoad] = useState({ progress: 0, ready: false })
  const onLoadChange = useCallback(
    (progress: number, ready: boolean) => setLoad({ progress, ready }),
    []
  )
```

Replace the final `return <MuseumGallery />` (line 67) with:

```tsx
  return (
    <>
      <MuseumGallery onLoadChange={onLoadChange} />
      <Curtain ready={load.ready} progress={load.progress} />
    </>
  )
```

- [ ] **Step 7: Verify, then commit**

Run: `pnpm exec tsc --noEmit` — clean.
Run: `pnpm test:unit` — all passing.
Optional sanity: `pnpm dev -p 3001`, open `http://localhost:3001/labs` — drapes cover load, part after posters arrive. Stop the server.

```bash
git add components/labs/museum/load-signal.tsx components/labs/museum/museum-gallery.tsx components/labs/labs-view-switch.tsx __tests__/labs/museum/load-signal.test.tsx
git commit -m "feat: wire curtain to real load progress via drei useProgress"
```

---

### Task 6: Lean-in focus card, placard glow, and the ? guide overlay

**Files:**
- Create: `components/labs/museum/focus-card.tsx`
- Create: `components/labs/museum/focus-card.module.css`
- Modify: `components/labs/museum/museum-gallery.tsx` (replace the pill; add ? button + overlay)
- Modify: `components/labs/museum/painting.tsx:83-86` (placard emissive)
- Test: `__tests__/labs/museum/focus-card.test.tsx`

**Interfaces:**
- Consumes: `VisitorGuide` from Task 4; `LabEntry` from the manifest.
- Produces: `FocusCard({ lab }: { lab: LabEntry })`.

- [ ] **Step 1: Write the failing test** — `__tests__/labs/museum/focus-card.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FocusCard } from '@/components/labs/museum/focus-card'
import { atticLabs, hallLabs } from '@/lib/labs-manifest'

describe('FocusCard', () => {
  it('shows title, date, full thesis and the enter action', () => {
    const lab = hallLabs[0]
    render(<FocusCard lab={lab} />)
    expect(screen.getByText(lab.title)).toBeInTheDocument()
    expect(screen.getByText(lab.date)).toBeInTheDocument()
    expect(screen.getByText(lab.thesis)).toBeInTheDocument()
    expect(screen.getByText(/click to enter/i)).toBeInTheDocument()
  })

  it('labels live and attic statuses differently', () => {
    const live = hallLabs.find((l) => l.status === 'live')!
    const { unmount } = render(<FocusCard lab={live} />)
    expect(screen.getByText('on display')).toBeInTheDocument()
    unmount()
    render(<FocusCard lab={atticLabs[0]} />)
    expect(screen.getByText('retired — attic')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run __tests__/labs/museum/focus-card.test.tsx`
Expected: FAIL — cannot resolve `@/components/labs/museum/focus-card`

- [ ] **Step 3: Implement the card** — `components/labs/museum/focus-card.tsx`:

```tsx
import type { LabEntry } from '@/lib/labs-manifest'
import styles from './focus-card.module.css'

const STATUS_LABEL: Record<LabEntry['status'], string> = {
  live: 'on display',
  wip: 'in progress',
  attic: 'retired — attic',
}

/** The lean-in placard: what's inside the focused painting. */
export function FocusCard({ lab }: { lab: LabEntry }) {
  return (
    <div className={styles.card} aria-hidden="true">
      <p className={styles.meta}>
        <span>{lab.date}</span>
        <span className={styles.status}>{STATUS_LABEL[lab.status]}</span>
      </p>
      <h2 className={styles.title}>{lab.title}</h2>
      <p className={styles.thesis}>{lab.thesis}</p>
      <p className={styles.action}>click to enter</p>
    </div>
  )
}
```

And `components/labs/museum/focus-card.module.css`:

```css
/* Lean-in preview card, bottom-center of the museum viewport. */

.card {
  position: absolute;
  bottom: 3.5rem;
  left: 50%;
  transform: translateX(-50%);
  width: min(92vw, 30rem);
  padding: 0.9rem 1.25rem 0.8rem;
  border: 1px solid rgba(214, 185, 104, 0.45);
  border-radius: 0.375rem;
  background: rgba(12, 5, 7, 0.78);
  backdrop-filter: blur(6px);
  color: #efe8da;
  font-family: Georgia, 'Times New Roman', serif;
  text-align: center;
  pointer-events: none;
  animation: rise 180ms ease-out;
}

.meta {
  display: flex;
  justify-content: center;
  gap: 1rem;
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(239, 232, 218, 0.55);
}

.status {
  color: #d6b968;
}

.title {
  margin-top: 0.35rem;
  font-size: 1.35rem;
  font-weight: 700;
  color: #f5eede;
}

.thesis {
  margin-top: 0.35rem;
  font-size: 0.85rem;
  font-style: italic;
  line-height: 1.5;
  color: #cfc5b2;
}

.action {
  margin-top: 0.6rem;
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: #d6b968;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .card {
    animation: none;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run __tests__/labs/museum/focus-card.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Swap the pill and add the ? overlay** — in `museum-gallery.tsx`:

Add imports:

```tsx
import { FocusCard } from './focus-card'
import { VisitorGuide } from './visitor-guide'
```

Add state next to `focused` (after line 27):

```tsx
  const [guideOpen, setGuideOpen] = useState(false)
```

Add the Esc-close effect after the `coarse` effect (line 31) — capture + preventDefault per the project's Esc discipline:

```tsx
  useEffect(() => {
    if (!guideOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setGuideOpen(false)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [guideOpen])
```

Replace the focused-pill block (lines 74-79) with:

```tsx
      {/* Lean-in preview of the focused painting */}
      {focusedLab && <FocusCard lab={focusedLab} />}
```

After the "List view" `</Link>` (line 92), add the ? button and overlay:

```tsx
      <button
        type="button"
        onClick={() => setGuideOpen(true)}
        aria-label="Show controls guide"
        className="absolute top-4 right-28 rounded-full bg-black/50 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-white/80 backdrop-blur-sm hover:bg-black/70 hover:text-white"
      >
        ?
      </button>

      {guideOpen && (
        <div
          className="absolute inset-0 z-10 grid place-items-center bg-black/60"
          onClick={() => setGuideOpen(false)}
        >
          <VisitorGuide />
        </div>
      )}
```

- [ ] **Step 6: Placard glow** — in `painting.tsx:85`, the placard material becomes:

```tsx
        <meshStandardMaterial
          map={placard}
          roughness={0.4}
          metalness={0.3}
          emissive="#8a6a24"
          emissiveIntensity={focused ? 0.55 : 0}
        />
```

- [ ] **Step 7: Verify, then commit**

Run: `pnpm exec tsc --noEmit` — clean.
Run: `pnpm test:unit` — all passing.

```bash
git add components/labs/museum/focus-card.tsx components/labs/museum/focus-card.module.css components/labs/museum/museum-gallery.tsx components/labs/museum/painting.tsx __tests__/labs/museum/focus-card.test.tsx
git commit -m "feat: lean-in focus card, placard glow, and reopenable visitor guide"
```

---

### Task 7: Exhibition-catalogue list view

**Files:**
- Rewrite: `components/labs/labs-list.tsx`
- Create: `components/labs/catalogue.module.css`
- Modify: `components/labs/labs-view-switch.tsx` (pass the enter button through the new `enterAction` slot)
- Test: `__tests__/components/labs/labs-list.test.tsx` (update in place)

**Interfaces:**
- Consumes: manifest fields (incl. the Task 1 rename), `siteConfig`/`socialLinks` from `lib/constants.ts`.
- Produces: `LabsList({ enterAction }: { enterAction?: ReactNode })` — the optional slot renders inside the masthead; `labs-view-switch` passes its "Enter the 3D gallery" button through it. The Suspense fallback keeps calling `<LabsList />` bare.

**Preserved hooks (existing tests + e2e lock these):** a link per manifest entry whose accessible name contains the title; a poster `<img>` per lab with alt `"${lab.title} poster"` and src containing `/labs/${slug}/poster.jpg`; a heading with the exact text `failed experiments`; the snowpark retrospective text visible. The masthead link must NOT contain the words "Classic Claude" (the card for the main entry already matches that regex; use "classic site" instead — case-sensitive `new RegExp(lab.title)` then matches exactly one link).

- [ ] **Step 1: Update the test file first** — replace `__tests__/components/labs/labs-list.test.tsx` entirely:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LabsList } from '@/components/labs/labs-list'
import { labs } from '@/lib/labs-manifest'
import { siteConfig } from '@/lib/constants'

describe('LabsList', () => {
  it('renders a link card for every lab in the manifest', () => {
    render(<LabsList />)
    for (const lab of labs) {
      const link = screen.getByRole('link', { name: new RegExp(lab.title) })
      expect(link).toHaveAttribute('href', lab.href ?? `/labs/${lab.slug}`)
    }
  })

  it('shows each lab poster thumbnail', () => {
    render(<LabsList />)
    for (const lab of labs) {
      const img = screen.getByAltText(`${lab.title} poster`)
      expect(img).toHaveAttribute('src', expect.stringContaining(`/labs/${lab.slug}/poster.jpg`))
    }
  })

  it('renders the crawlable masthead with name, role and classic-site link', () => {
    render(<LabsList />)
    expect(screen.getByRole('heading', { level: 1, name: siteConfig.name })).toBeInTheDocument()
    expect(screen.getByText(siteConfig.title)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /classic site/i })).toHaveAttribute(
      'href',
      '/classic-claude'
    )
  })

  it('shows the failed experiments section with the retrospective', () => {
    render(<LabsList />)
    expect(screen.getByRole('heading', { name: 'failed experiments' })).toBeInTheDocument()
    expect(screen.getByText(/Three passes, three verdicts\./)).toBeInTheDocument()
  })

  it('renders the enterAction slot when provided', () => {
    render(<LabsList enterAction={<button type="button">Enter the 3D gallery</button>} />)
    expect(screen.getByRole('button', { name: /enter the 3d gallery/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `pnpm vitest run __tests__/components/labs/labs-list.test.tsx`
Expected: FAIL — masthead/enterAction tests (old component has no masthead, no slot); the two card tests still pass.

- [ ] **Step 3: Rewrite the component** — `components/labs/labs-list.tsx`:

```tsx
import type { ReactNode } from 'react'
import Link from 'next/link'
import { atticLabs, hallLabs, type LabEntry } from '@/lib/labs-manifest'
import { siteConfig, socialLinks } from '@/lib/constants'
import styles from './catalogue.module.css'

function CatalogueCard({ lab, showRetrospective }: { lab: LabEntry; showRetrospective?: boolean }) {
  return (
    <Link href={lab.href ?? `/labs/${lab.slug}`} className={styles.card}>
      <span className={styles.frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/labs/${lab.slug}/poster.jpg`}
          alt={`${lab.title} poster`}
          width={768}
          height={1024}
          loading="lazy"
        />
      </span>
      <span className={styles.placard}>
        <span className={styles.placardTitle}>{lab.title}</span>
        <span className={styles.placardDate}>{lab.date}</span>
        {lab.status === 'wip' && <span className={styles.placardWip}>in progress</span>}
        <span className={styles.placardThesis}>{lab.thesis}</span>
      </span>
      {showRetrospective && lab.retrospective && (
        <span className={styles.retrospective}>{lab.retrospective}</span>
      )}
    </Link>
  )
}

/** The museum's printed program: the catalogue list view and crawler path. */
export function LabsList({ enterAction }: { enterAction?: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.masthead}>
          <p className={styles.eyebrow}>Museum of Experiments</p>
          <h1 className={styles.name}>{siteConfig.name}</h1>
          <p className={styles.role}>{siteConfig.title}</p>
          <p className={styles.intro}>
            One portfolio, many design systems. Every room re-skins the same
            content — my actual work and experience — in a completely different
            visual identity. The permanent collection grows regularly.
          </p>
          <nav className={styles.mastheadLinks} aria-label="Primary">
            <Link href="/classic-claude">Enter the classic site</Link>
            {socialLinks.map((s) => (
              <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer">
                {s.name}
              </a>
            ))}
          </nav>
          {enterAction && <div className={styles.enterSlot}>{enterAction}</div>}
        </header>

        <div className={styles.grid}>
          {hallLabs.map((lab) => (
            <CatalogueCard key={lab.slug} lab={lab} />
          ))}
        </div>

        {atticLabs.length > 0 && (
          <section className={styles.attic}>
            <h2 className={styles.atticHeading}>failed experiments</h2>
            <p className={styles.atticSub}>
              Retired iterations, kept playable. The verdicts are part of the work.
            </p>
            <div className={styles.grid}>
              {atticLabs.map((lab) => (
                <CatalogueCard key={lab.slug} lab={lab} showRetrospective />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Style it** — `components/labs/catalogue.module.css`:

```css
/* The museum's printed program. Palette translated from the WebGL hall:
   wine fabric #5a2028 (darkened for page use), brass #b08d3f → #d6b968,
   cream #efe8da, aged paper #d8cdb4 with ink #3a2d16 for the attic. */

.page {
  min-height: 100vh;
  background:
    radial-gradient(ellipse 120% 60% at 50% -10%, rgba(214, 185, 104, 0.08), transparent),
    linear-gradient(180deg, #2a1016, #1e0b10 40%, #180a0d);
  color: #efe8da;
  font-family: Georgia, 'Times New Roman', serif;
}

.inner {
  max-width: 68rem;
  margin: 0 auto;
  padding: 4.5rem 1.5rem 6rem;
}

/* --- masthead ------------------------------------------------------------ */

.masthead {
  text-align: center;
  padding-bottom: 2.75rem;
  margin-bottom: 3rem;
  border-bottom: 1px solid rgba(176, 141, 63, 0.4);
}

.eyebrow {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: #d6b968;
}

.name {
  margin-top: 1rem;
  font-size: clamp(2rem, 5vw, 3.25rem);
  font-weight: 700;
  letter-spacing: 0.01em;
  color: #f5eede;
}

.role {
  margin-top: 0.4rem;
  font-style: italic;
  font-size: 1.05rem;
  color: #cfc5b2;
}

.intro {
  margin: 1.25rem auto 0;
  max-width: 34rem;
  font-size: 0.95rem;
  line-height: 1.65;
  color: rgba(239, 232, 218, 0.75);
}

.mastheadLinks {
  margin-top: 1.5rem;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1.75rem;
}

.mastheadLinks a {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #d6b968;
  text-decoration: none;
  border-bottom: 1px solid rgba(214, 185, 104, 0.35);
  padding-bottom: 2px;
  transition: color 150ms ease, border-color 150ms ease;
}

.mastheadLinks a:hover {
  color: #f0d998;
  border-color: #f0d998;
}

.enterSlot {
  margin-top: 1.75rem;
}

.enterSlot button {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #1e0b10;
  background: linear-gradient(180deg, #d6b968, #b08d3f);
  border: 1px solid #8a6a24;
  border-radius: 999px;
  padding: 0.7rem 1.6rem;
  cursor: pointer;
  transition: filter 150ms ease;
}

.enterSlot button:hover {
  filter: brightness(1.1);
}

/* --- catalogue grid ------------------------------------------------------ */

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.5rem 2rem;
}

@media (min-width: 768px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
}

.card {
  display: block;
  text-decoration: none;
  color: inherit;
}

.frame {
  display: block;
  padding: 10px;
  background: linear-gradient(160deg, #b08d3f, #8a6a24 55%, #d6b968);
  border: 1px solid rgba(0, 0, 0, 0.5);
  box-shadow:
    inset 0 0 0 1px rgba(255, 240, 200, 0.35),
    0 14px 30px rgba(0, 0, 0, 0.45);
  transition: transform 200ms ease, box-shadow 200ms ease;
}

.frame img {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid rgba(0, 0, 0, 0.55);
}

.card:hover .frame {
  transform: translateY(-4px);
  box-shadow:
    inset 0 0 0 1px rgba(255, 240, 200, 0.5),
    0 20px 40px rgba(0, 0, 0, 0.55);
}

.placard {
  display: block;
  margin: 1rem auto 0;
  max-width: 26rem;
  padding: 0.8rem 1.1rem 0.9rem;
  text-align: center;
  background: linear-gradient(135deg, #b08d3f, #d6b968 50%, #a5813a);
  border: 1px solid rgba(60, 40, 0, 0.55);
  border-radius: 2px;
  color: #2c1f08;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.placardTitle {
  display: block;
  font-size: 1.2rem;
  font-weight: 700;
}

.placardDate {
  display: block;
  margin-top: 0.15rem;
  font-style: italic;
  font-size: 0.8rem;
}

.placardWip {
  display: inline-block;
  margin-top: 0.3rem;
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  border: 1px solid rgba(60, 40, 0, 0.45);
  border-radius: 999px;
  padding: 0.1rem 0.55rem;
}

.placardThesis {
  display: block;
  margin-top: 0.4rem;
  font-size: 0.82rem;
  line-height: 1.5;
}

/* --- attic --------------------------------------------------------------- */

.attic {
  margin-top: 4.5rem;
  padding-top: 2.5rem;
  border-top: 1px dashed rgba(185, 179, 166, 0.35);
}

.atticHeading {
  font-family: var(--font-mono, monospace);
  font-size: 0.85rem;
  letter-spacing: 0.3em;
  text-transform: lowercase;
  color: #b9b3a6;
}

.atticSub {
  margin: 0.5rem 0 2rem;
  font-style: italic;
  font-size: 0.9rem;
  color: rgba(185, 179, 166, 0.8);
}

.retrospective {
  display: block;
  margin: 0.9rem auto 0;
  max-width: 26rem;
  padding: 0.8rem 1rem;
  background: #d8cdb4;
  border: 1px solid rgba(58, 45, 22, 0.4);
  color: #3a2d16;
  font-style: italic;
  font-size: 0.8rem;
  line-height: 1.55;
  text-align: left;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}
```

- [ ] **Step 5: Pass the enter button through the slot** — in `labs-view-switch.tsx`, replace the whole `view !== '3d'` branch with:

```tsx
  if (view !== '3d') {
    return (
      <LabsList
        enterAction={
          view === 'list' && webgl ? (
            <button type="button" onClick={() => setView('3d')}>
              Enter the 3D gallery
            </button>
          ) : undefined
        }
      />
    )
  }
```

(The button is styled by the catalogue's `.enterSlot button` rules — no Tailwind classes needed on it.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run __tests__/components/labs/labs-list.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 7: Full unit suite + lint, then commit**

Run: `pnpm test:unit` — all passing. `pnpm lint` — clean.

```bash
git add components/labs/labs-list.tsx components/labs/catalogue.module.css components/labs/labs-view-switch.tsx __tests__/components/labs/labs-list.test.tsx
git commit -m "feat: exhibition-catalogue list view with crawlable masthead"
```

---

### GATE A (controller, not a subagent): Look-dev review

The controller runs `pnpm dev -p 3001`, opens Chrome, and captures for user review:
1. `/labs` — curtain closed (guide legible), curtain parting, museum revealed.
2. Sprint + jump feel in the hall (Shift FOV kick, Space hop, ramp landing).
3. A focused painting — FocusCard + placard glow.
4. The ? overlay.
5. `/labs?view=list` — catalogue masthead, framed posters, brass placards, attic section (desktop + narrow viewport).

The `/classic-claude` masthead link 404s at this point — expected until Task 8. **User approval required before Task 8.** Visual tuning feedback is applied directly by the controller (or a fix dispatch) and committed as `fix:`/`feat:` amendments.

---

### Task 8: Routing swap — museum takes `/`, portfolio to `/classic-claude`

**Files:**
- Create: `app/classic-claude/page.tsx`
- Rewrite: `app/page.tsx`
- Delete: `app/labs/page.tsx`
- Modify: `components/sections/hero.tsx:9` (add `id="hero"`)

**Interfaces:**
- Consumes: `LabsList`/`LabsViewSwitch` (unchanged APIs).
- Produces: routes `/` (museum hub) and `/classic-claude` (portfolio). `/labs` now 404s; `/labs/<slug>` pages untouched.

- [ ] **Step 1: Create the portfolio page** — `app/classic-claude/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { Header } from '@/components/layout'
import { Hero } from '@/components/sections/hero'
import { About } from '@/components/sections/about'
import { Skills } from '@/components/sections/skills'
import { ExperienceBento } from '@/components/sections/experience-bento'
import { Projects } from '@/components/sections/projects'
import { StateDemo } from '@/components/sections/state-demo'
import { Contact } from '@/components/sections/contact'
import { Footer } from '@/components/sections/footer'

export const metadata: Metadata = {
  title: 'Classic Claude | Aram Yeghiazaryan',
  description:
    'The original portfolio — standard AI with a twist: warm terracotta and cream, pixel avatar, Bricolage Grotesque. The control every experiment is measured against.',
}

export default function ClassicClaudePage() {
  return (
    <>
      <Header />
      <main id="main-content" role="main">
        <Hero />
        <About />
        <Skills />
        <StateDemo />
        <ExperienceBento />
        <Projects />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 2: Rewrite the home page** — `app/page.tsx` becomes the hub (root-layout metadata is inherited; no page-level metadata export):

```tsx
import { Suspense } from 'react'
import { LabsList } from '@/components/labs/labs-list'
import { LabsViewSwitch } from '@/components/labs/labs-view-switch'

export default function Home() {
  return (
    <main className="min-h-screen">
      <Suspense fallback={<LabsList />}>
        <LabsViewSwitch />
      </Suspense>
    </main>
  )
}
```

- [ ] **Step 3: Delete the old hub**

```bash
git rm app/labs/page.tsx
```

(`app/labs/ps1/`, `app/labs/snowpark/`, `app/labs/xp/` remain — a folder without `page.tsx` just 404s at `/labs`.)

- [ ] **Step 4: Fix the hero anchor** — in `components/sections/hero.tsx:9`:

```tsx
    <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center px-6">
```

(This fixes the long-standing `navigation.spec.ts` "hero visible" failure — the fixture locates `#hero`, which never existed.)

- [ ] **Step 5: Verify, then commit**

Run: `pnpm exec tsc --noEmit` — clean.
Run: `pnpm test:unit` — all passing.
Run: `pnpm build` — compiles; confirm the route list shows `/` and `/classic-claude`, no `/labs` index. (Never run `pnpm build` while a dev server is running — it corrupts the live `.next`.)

```bash
git add app/classic-claude/page.tsx app/page.tsx components/sections/hero.tsx
git commit -m "feat: museum takes the main page, portfolio moves to /classic-claude"
```

---

### Task 9: Reference sweep — every internal link retargets

**Files:**
- Modify: `components/labs/gallery-chrome.tsx:9,17,26`
- Modify: `components/sections/footer.tsx:20`
- Modify: `app/labs/ps1/page.tsx:31-36`
- Modify: `components/labs/xp/start-menu.tsx:34`
- Modify: `components/labs/xp/win-ie.tsx:14,17`
- Modify: `components/labs/snowpark/snowpark-game.tsx:423,456`
- Modify: `components/labs/museum/museum-gallery.tsx:88`
- Test: `__tests__/labs/gallery-chrome.test.tsx`, `__tests__/components/labs/gallery-chrome.test.tsx`, `__tests__/labs/xp/start-menu.test.tsx:29`, `__tests__/labs/xp/esc-ordering.test.tsx:47`, `__tests__/labs/xp/win-content.test.tsx:91`

**Interfaces:**
- Consumes: routes from Task 8.
- Produces: no API changes — link targets only.

- [ ] **Step 1: Update the tests first** (they encode the new contract):

In `__tests__/labs/gallery-chrome.test.tsx`: rename the first test and both expectations —

```ts
  it('navigates to the museum on a plain Escape', () => {
    render(<GalleryChrome>lab</GalleryChrome>)
    pressEscape(false)
    expect(push).toHaveBeenCalledWith('/')
  })
```

In `__tests__/components/labs/gallery-chrome.test.tsx`:

```ts
  it('renders a back-to-gallery link', () => {
    render(<GalleryChrome>x</GalleryChrome>)
    const link = screen.getByRole('link', { name: /gallery/i })
    expect(link).toHaveAttribute('href', '/')
  })

  it('navigates to the museum on Escape', () => {
    render(<GalleryChrome>x</GalleryChrome>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(push).toHaveBeenCalledWith('/')
  })
```

In `__tests__/labs/xp/start-menu.test.tsx:29`: `expect(push).toHaveBeenCalledWith('/')`
In `__tests__/labs/xp/esc-ordering.test.tsx:47`: `expect(push).toHaveBeenCalledWith('/')`
In `__tests__/labs/xp/win-content.test.tsx:91`: `expect(screen.getByTitle('aram.dev')).toHaveAttribute('src', '/classic-claude')`

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run __tests__/labs/gallery-chrome.test.tsx __tests__/components/labs/gallery-chrome.test.tsx __tests__/labs/xp/start-menu.test.tsx __tests__/labs/xp/esc-ordering.test.tsx __tests__/labs/xp/win-content.test.tsx`
Expected: FAIL — components still target `/labs` and `/`.

- [ ] **Step 3: Apply the sweep**

`components/labs/gallery-chrome.tsx` — line 9 comment: `Fixed "← Gallery" button top-left + Esc key → /` ; line 17: `if (e.key === 'Escape') router.push('/')` ; line 26: `href="/"`.

`components/sections/footer.tsx:20`: `{ label: 'Museum', href: '/' },`

`app/labs/ps1/page.tsx:31-36`:

```tsx
            <Link href="/" className="hover:text-[#5583ff] transition-colors">
              ← All experiments
            </Link>
            <Link href="/classic-claude" className="hover:text-[#5583ff] transition-colors">
              Classic Claude
            </Link>
```

`components/labs/xp/start-menu.tsx:34`: `router.push('/')`

`components/labs/xp/win-ie.tsx` — line 14 address text: `https://aram.dev/classic-claude` ; line 17: `<iframe src="/classic-claude" title="aram.dev" style={{ flex: 1, border: 'none', background: '#fff' }} />`

`components/labs/snowpark/snowpark-game.tsx` — both `href="/labs"` (lines 423 and 456) become `href="/"` (labels stay `← gallery`).

`components/labs/museum/museum-gallery.tsx:88`: `href="/?view=list"`

- [ ] **Step 4: Run tests to verify they pass**

Run: same command as Step 2. Expected: PASS.

- [ ] **Step 5: Confirm nothing still targets the dead hub**

Search the repo for the exact string `'/labs'` (quote-delimited, i.e. the bare hub route) across `app/`, `components/`, `lib/`, `__tests__/`, `e2e/` — use the Grep tool or `rg "'/labs'"`.
Expected: zero hits (only `/labs/<slug>` asset paths and lab-page routes remain).

- [ ] **Step 6: Full unit suite, then commit**

Run: `pnpm test:unit` — all passing.

```bash
git add components/labs/gallery-chrome.tsx components/sections/footer.tsx app/labs/ps1/page.tsx components/labs/xp/start-menu.tsx components/labs/xp/win-ie.tsx components/labs/snowpark/snowpark-game.tsx components/labs/museum/museum-gallery.tsx __tests__/labs/gallery-chrome.test.tsx __tests__/components/labs/gallery-chrome.test.tsx __tests__/labs/xp/start-menu.test.tsx __tests__/labs/xp/esc-ordering.test.tsx __tests__/labs/xp/win-content.test.tsx
git commit -m "refactor: retarget every internal link for the museum-at-root swap"
```

---

### Task 10: E2E retargets + museum smoke

**Files:**
- Modify: `e2e/fixtures/portfolio-page.ts:33`
- Modify: `e2e/navigation.spec.ts:37,44`
- Modify: `e2e/labs-gallery.spec.ts`
- Modify: `e2e/labs-attic.spec.ts:5,11`
- Create: `e2e/museum.spec.ts`

**Interfaces:**
- Consumes: routes and UI from Tasks 4-9 (`data-phase` curtain attribute, "Show controls guide" button, hint-line text).
- Produces: nothing downstream.

- [ ] **Step 1: Retarget the portfolio fixture** — `e2e/fixtures/portfolio-page.ts:33`:

```ts
    await this.page.goto('/classic-claude');
```

- [ ] **Step 2: Point the accessibility checks at the deterministic list** — in `e2e/navigation.spec.ts`, both Accessibility tests change `page.goto('/')` to `page.goto('/?view=list')`. (Plain `/` races hydration: on a WebGL desktop the list — and its `h1` — is replaced by the canvas mid-assertion.)

- [ ] **Step 3: Retarget the gallery spec** — `e2e/labs-gallery.spec.ts` becomes:

```ts
import { test, expect } from '@playwright/test'

test.describe('Style Lab gallery', () => {
  test('list view shows every lab with a working link', async ({ page }) => {
    await page.goto('/?view=list')
    const ps1 = page.getByRole('link', { name: /PS1 \/ Y2K/ })
    await expect(ps1).toBeVisible()
    await ps1.click()
    await expect(page).toHaveURL(/\/labs\/ps1/)
  })

  test('desktop / mounts the 3D museum canvas', async ({ page, isMobile }) => {
    test.skip(isMobile, '3D is desktop-default only')
    await page.goto('/')
    const hasWebGL = await page.evaluate(
      () => !!document.createElement('canvas').getContext('webgl2')
    )
    test.skip(!hasWebGL, 'headless browser lacks WebGL2 — falls back to the list view')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('link', { name: /list view/i })).toBeVisible()
  })

  test('Escape inside a lab returns to the museum', async ({ page }) => {
    await page.goto('/labs/ps1')
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 })
  })

  test('lab page has a back-to-gallery button', async ({ page }) => {
    await page.goto('/labs/ps1')
    const back = page.getByRole('link', { name: /gallery/i })
    await expect(back).toBeVisible()
    await back.click()
    await expect(page).toHaveURL(/\/$/)
  })
})
```

- [ ] **Step 4: Retarget the attic spec** — `e2e/labs-attic.spec.ts`: both `page.goto('/labs?view=list')` calls become `page.goto('/?view=list')`.

- [ ] **Step 5: Write the museum smoke** — `e2e/museum.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test.describe('Museum at /', () => {
  test('curtain covers the load, then departs to reveal the hall', async ({ page, isMobile }) => {
    test.skip(isMobile, '3D is desktop-default only')
    await page.goto('/')
    const hasWebGL = await page.evaluate(
      () => !!document.createElement('canvas').getContext('webgl2')
    )
    test.skip(!hasWebGL, 'headless browser lacks WebGL2 — falls back to the list view')
    await expect(page.locator('[data-phase]')).toBeVisible()
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-phase]')).toHaveCount(0, { timeout: 20000 })
    await expect(page.getByText(/shift to run/i)).toBeVisible()
  })

  test('? reopens the visitor guide and Esc closes it', async ({ page, isMobile }) => {
    test.skip(isMobile, '3D is desktop-default only')
    await page.goto('/')
    const hasWebGL = await page.evaluate(
      () => !!document.createElement('canvas').getContext('webgl2')
    )
    test.skip(!hasWebGL, 'headless browser lacks WebGL2 — falls back to the list view')
    await expect(page.locator('[data-phase]')).toHaveCount(0, { timeout: 20000 })
    await page.getByRole('button', { name: /show controls guide/i }).click()
    await expect(page.getByText(/visitor.s guide/i)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByText(/visitor.s guide/i)).toHaveCount(0)
  })

  test('classic claude serves the original portfolio', async ({ page }) => {
    await page.goto('/classic-claude')
    await expect(page).toHaveTitle(/Classic Claude/)
    await expect(page.locator('#hero')).toBeVisible()
  })
})
```

- [ ] **Step 6: Run the affected e2e specs** (dev server auto-starts; use `E2E_PORT` if 3000 is taken by another session — NEVER kill the other session's server):

Run: `$env:E2E_PORT='3100'; pnpm test:e2e e2e/museum.spec.ts e2e/labs-gallery.spec.ts e2e/labs-attic.spec.ts e2e/navigation.spec.ts`
Expected: all passing or environment-skipped (WebGL/mobile skips are fine); NO failures. The previously-failing hero test now passes.

- [ ] **Step 7: Commit**

```bash
git add e2e/fixtures/portfolio-page.ts e2e/navigation.spec.ts e2e/labs-gallery.spec.ts e2e/labs-attic.spec.ts e2e/museum.spec.ts
git commit -m "test: retarget e2e to museum-at-root and add curtain smoke"
```

---

### GATE B (controller): Full verification + playtest

1. `pnpm lint` && `pnpm exec tsc --noEmit` — clean.
2. `pnpm test:unit` — all passing, output pristine.
3. `pnpm build` — clean (no dev server running).
4. Full e2e run (`E2E_PORT` as needed).
5. Chrome playtest at a prod-like dev server: `/` curtain → hall; run/jump through the hall and up the attic stairs; focus card on every painting; enter Classic Claude via its painting; XP lab's IE window shows the classic site; footer "Museum" link returns to `/`; `/labs` 404s.
6. Whole-branch review (fable), then finishing-a-development-branch.
