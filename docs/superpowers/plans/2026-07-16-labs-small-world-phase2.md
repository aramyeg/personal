# Small World — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the Gate-0-approved skipping scene to a full six-chapter journey: themed clay prop sets that morph in and out of the planet, a discovery "!" burst, the comic-panel HTML overlay, museum poster + manifest entry, and the expanded e2e suite (Gates 1–2).

**Architecture:** All motion still flows from the pure `journey-timeline.ts` module through the damped `journeyRef`. Prop sets are independent anchored groups parented INSIDE the planet's rotating group, scaled by their `morph[i]` value (grow-from-clay = radial scale from planet center). Panels/burst UI is DOM overlay above the canvas, fed by a lightweight scroll-driven React state hook that reuses the same pure timeline — the canvas never renders text.

**Tech Stack:** Next.js 15 App Router, React 19, react-three-fiber v9 + three ^0.185, next/font (Baloo 2, Bangers, Nunito Sans), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-16-labs-small-world-design.md` (see "Open question" — per-chapter turn stays 60° but ALL angular math must flow through `CHAPTER_SLICE` / `chapterStartRotation(i)` so a later 90–120° growth touches one module).

## Global Constraints

- Work in worktree `labs-small-world`, branch `worktree-labs-small-world`. Never touch the main checkout.
- Commit format `type: description` — NO attribution/Co-Authored-By lines (repo settings disable them).
- Test files explicitly `import { describe, it, expect } from 'vitest'`.
- No `console.log` anywhere (repo hook audits).
- Colors ONLY from `components/labs/small-world/palette.ts` (PALETTE) — no new hex literals in scene code.
- Copy rule: Aram is "Senior Frontend Engineer" at xDataGroup — never "Technical Lead"/"leading".
- Immutability outside animation hot paths. Sanctioned exception: the morph scratch array in `journeyStateAt` (Phase 1 final-review backlog item) and direct three.js object mutation inside `useFrame` (standard r3f practice, already established in Phase 1).
- All scene consumers read ONLY `journeyRef.current` (never compute `journeyStateAt` from a second progress source inside the canvas). DOM overlay is the one sanctioned second consumer of the RAW progress ref (it must not lag behind scroll).
- Unit tests: `pnpm vitest __tests__/labs/small-world --run`. Full suite: `pnpm test:unit`. E2E: PowerShell `$env:CI='1'; $env:E2E_PORT='3117'; pnpm test:e2e e2e/labs-small-world.spec.ts` (CI=1 forces workers=1; unset after).
- `pnpm build` must stay green; `/labs/small-world` route stays three-free at the server layer (three only inside the dynamic ssr:false boundary).
- Visual verification: NEVER via Chrome-MCP tabs (hidden tabs suspend rAF — r3f never boots). Use `node .superpowers/sdd/bench/lookdev-capture.mjs <outdir>` from the worktree root with dev server on :3017.
- Gate 1 (after Task 5): capture deck goes to Aram for the morph-vs-fixed pivot verdict, but execution CONTINUES (the pivot only changes `ChapterSet`'s scale behavior, not the sets themselves).

---

### Task 1: Timeline hardening — slice constants, morph scratch, easeOutBack

**Files:**
- Modify: `components/labs/small-world/journey-timeline.ts`
- Modify: `components/labs/small-world/scene/use-journey.ts`
- Test: `__tests__/labs/small-world/journey-timeline.test.ts` (append)

**Interfaces:**
- Produces: `CHAPTER_SLICE: number`, `chapterStartRotation(i: number): number`, `easeOutBack(t: number): number`, and `journeyStateAt(rawProgress: number, morphOut?: number[]): JourneyState` (morphOut, when provided with length CHAPTER_COUNT, is filled in place and reused as the returned `morph`).
- Consumes: existing exports (ROTATION_TOTAL, CHAPTER_COUNT, smoothstep).

- [ ] **Step 1: Write the failing tests** (append to the existing describe blocks in `__tests__/labs/small-world/journey-timeline.test.ts`)

```ts
import {
  CHAPTER_SLICE,
  chapterStartRotation,
  easeOutBack,
  journeyStateAt,
  ROTATION_TOTAL,
} from '@/components/labs/small-world/journey-timeline'
import { CHAPTER_COUNT } from '@/components/labs/small-world/chapters'

describe('slice constants', () => {
  it('CHAPTER_SLICE covers the full rotation across all chapters', () => {
    expect(CHAPTER_SLICE * CHAPTER_COUNT).toBeCloseTo(ROTATION_TOTAL, 10)
  })

  it('chapterStartRotation is the chapter index times the slice', () => {
    for (let i = 0; i < CHAPTER_COUNT; i++) {
      expect(chapterStartRotation(i)).toBeCloseTo(i * CHAPTER_SLICE, 10)
    }
  })
})

describe('easeOutBack', () => {
  it('is pinned at 0 and 1', () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 10)
    expect(easeOutBack(1)).toBeCloseTo(1, 10)
  })

  it('overshoots past 1 in the back half (the springy pop)', () => {
    expect(easeOutBack(0.8)).toBeGreaterThan(1)
  })

  it('clamps input outside [0,1]', () => {
    expect(easeOutBack(-1)).toBeCloseTo(0, 10)
    expect(easeOutBack(2)).toBeCloseTo(1, 10)
  })
})

describe('morph scratch array', () => {
  it('reuses the provided morphOut array (no per-frame allocation)', () => {
    const scratch = new Array<number>(CHAPTER_COUNT).fill(0)
    const state = journeyStateAt(0.4, scratch)
    expect(state.morph).toBe(scratch)
  })

  it('produces identical morph values with and without the scratch', () => {
    const scratch = new Array<number>(CHAPTER_COUNT).fill(-1)
    for (const p of [0, 0.05, 0.2, 0.5, 0.83, 1]) {
      const fresh = journeyStateAt(p)
      const reused = journeyStateAt(p, scratch)
      expect(reused.morph).toEqual(fresh.morph)
    }
  })

  it('ignores a scratch of the wrong length', () => {
    const bad = [0, 0]
    const state = journeyStateAt(0.4, bad)
    expect(state.morph).not.toBe(bad)
    expect(state.morph).toHaveLength(CHAPTER_COUNT)
  })
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `pnpm vitest __tests__/labs/small-world/journey-timeline.test.ts --run`
Expected: FAIL — `CHAPTER_SLICE`/`chapterStartRotation`/`easeOutBack` not exported.

- [ ] **Step 3: Implement in `journey-timeline.ts`**

Add after `ROTATION_TOTAL`:

```ts
/** Rotation each chapter owns. The spec's parked >360° question changes THIS
 * constant (and chapterStartRotation) only — nothing else may hardcode the slice. */
export const CHAPTER_SLICE = ROTATION_TOTAL / CHAPTER_COUNT

export function chapterStartRotation(chapter: number): number {
  return chapter * CHAPTER_SLICE
}

/** Springy overshoot easing for prop growth (easeOutBack, c = 1.70158). */
export function easeOutBack(t: number): number {
  const x = clamp01(t)
  const c = 1.70158
  const p = x - 1
  return 1 + (c + 1) * p * p * p + c * p * p
}
```

Replace the body of `journeyStateAt` so `slice` uses `CHAPTER_SLICE`, rotation uses `chapterStartRotation(chapter)`, and morph fills a reusable array:

```ts
export function journeyStateAt(rawProgress: number, morphOut?: number[]): JourneyState {
  const progress = clamp01(rawProgress)
  const segLen = 1 / CHAPTER_COUNT
  const chapter = Math.min(CHAPTER_COUNT - 1, Math.floor(progress / segLen))
  const local = (progress - chapter * segLen) / segLen

  const rotation = chapterStartRotation(chapter) + clamp01(local / TRAVEL_END) * CHAPTER_SLICE

  const morph =
    morphOut && morphOut.length === CHAPTER_COUNT ? morphOut : new Array<number>(CHAPTER_COUNT)
  const growT = smoothstep(local / MORPH_WINDOW)
  for (let i = 0; i < CHAPTER_COUNT; i++) {
    if (i === chapter) morph[i] = chapter === 0 ? 1 : growT
    else if (i === chapter - 1) morph[i] = 1 - growT
    else morph[i] = 0
  }

  const burst =
    local >= TRAVEL_END && local < BURST_END
      ? (local - TRAVEL_END) / (BURST_END - TRAVEL_END)
      : null

  const panel: PanelState | null =
    local >= BURST_END && local < PANEL_END
      ? { chapter, t: (local - BURST_END) / (PANEL_END - BURST_END) }
      : null

  return { progress, rotation, chapter, morph, burst, panel }
}
```

In `use-journey.ts`, add a persistent scratch and pass it:

```ts
export function useDampedJourney(progressRef: MutableRefObject<number>): JourneyRef {
  const damped = useRef(progressRef.current)
  const morphScratch = useRef<number[]>([])
  const journeyRef = useRef<JourneyState>(journeyStateAt(progressRef.current))
  if (morphScratch.current.length === 0) {
    morphScratch.current = journeyRef.current.morph
  }

  useFrame((_, delta) => {
    damped.current = THREE.MathUtils.damp(damped.current, progressRef.current, DAMP_LAMBDA, delta)
    journeyRef.current = journeyStateAt(damped.current, morphScratch.current)
  }, -1)

  return journeyRef
}
```

- [ ] **Step 4: Run the full lab unit suite**

Run: `pnpm vitest __tests__/labs/small-world --run`
Expected: PASS (all existing timeline pins must survive — the refactor is behavior-preserving).

- [ ] **Step 5: Commit**

```bash
git add components/labs/small-world/journey-timeline.ts components/labs/small-world/scene/use-journey.ts __tests__/labs/small-world/journey-timeline.test.ts
git commit -m "refactor(labs/small-world): slice constants, morph scratch reuse, easeOutBack"
```

---

### Task 2: Phase-1 review backlog sweep

**Files:**
- Create: `components/labs/small-world/scene/toon-ramp.tsx`
- Modify: `components/labs/small-world/scene/planet.tsx` (remove private `useToonRamp`, consume the shared one)
- Modify: `components/labs/small-world/scene/scene.tsx` (ToonRampProvider + aria-hidden wrapper)
- Modify: `components/labs/small-world/small-world-experience.tsx` (reduced-motion change listener)
- Modify: `components/labs/small-world/chapters.ts` (STAGING `satisfies`)
- Test: `__tests__/labs/small-world/chapters.test.ts` (append coverage assertion if not present)

**Interfaces:**
- Produces: `useToonRamp(): THREE.DataTexture` (owns dispose), `ToonRampProvider({children})`, `useClayRamp(): THREE.DataTexture` (context read; throws outside provider). Task 4's clay kit consumes `useClayRamp`.

- [ ] **Step 1: Write the failing staging-coverage test** (append to `__tests__/labs/small-world/chapters.test.ts`; skip if an equivalent assertion already exists)

```ts
import { experiences } from '@/data/experience'
import { chapters } from '@/components/labs/small-world/chapters'

describe('staging coverage', () => {
  it('every experience has staging (theme + accent)', () => {
    expect(chapters).toHaveLength(experiences.length)
    for (const c of chapters) {
      expect(c.theme, `chapter ${c.id} missing theme`).toBeTruthy()
      expect(c.accent, `chapter ${c.id} missing accent`).toMatch(/^#/)
    }
  })
})
```

- [ ] **Step 2: Run** `pnpm vitest __tests__/labs/small-world/chapters.test.ts --run` — PASS or FAIL depending on existing coverage; either way it now pins the contract.

- [ ] **Step 3: Create `scene/toon-ramp.tsx`**

```tsx
'use client'
import { createContext, useContext, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import * as THREE from 'three'

/**
 * The one shared 3-step clay toon ramp. Created once per canvas via
 * ToonRampProvider and disposed on unmount (Phase 1 review backlog: the
 * DataTexture used to leak on scene teardown).
 */
export function useToonRamp(): THREE.DataTexture {
  const ramp = useMemo(() => {
    const steps = new Uint8Array([140, 200, 255])
    const data = new Uint8Array(steps.length * 4)
    steps.forEach((v, i) => data.set([v, v, v, 255], i * 4))
    const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat)
    tex.needsUpdate = true
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    return tex
  }, [])
  useEffect(() => () => ramp.dispose(), [ramp])
  return ramp
}

const RampContext = createContext<THREE.DataTexture | null>(null)

export function ToonRampProvider({ children }: { children: ReactNode }) {
  const ramp = useToonRamp()
  return <RampContext.Provider value={ramp}>{children}</RampContext.Provider>
}

export function useClayRamp(): THREE.DataTexture {
  const ramp = useContext(RampContext)
  if (!ramp) throw new Error('useClayRamp must be used inside ToonRampProvider')
  return ramp
}
```

- [ ] **Step 4: Consume it**

In `planet.tsx`: delete the private `useToonRamp` function, add `import { useClayRamp } from './toon-ramp'`, and inside `Planet` replace `const ramp = useToonRamp()` with `const ramp = useClayRamp()`.

In `scene.tsx`, wrap the scene contents and aria-hide the canvas (the fallback timeline is the accessible content):

```tsx
export function SmallWorldScene({ progressRef }: SceneProps) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
      <Canvas camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }} gl={{ antialias: true }} dpr={[1, 2]}>
        <ToonRampProvider>
          <SceneContents progressRef={progressRef} />
        </ToonRampProvider>
      </Canvas>
    </div>
  )
}
```

(`import { ToonRampProvider } from './toon-ramp'`.)

- [ ] **Step 5: Reduced-motion change listener** in `small-world-experience.tsx` — replace the first `useEffect`:

```tsx
useEffect(() => {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  const update = () => setActive(!mq.matches && detectWebGL())
  update()
  mq.addEventListener('change', update)
  return () => mq.removeEventListener('change', update)
}, [])
```

- [ ] **Step 6: STAGING satisfies** in `chapters.ts`:

```ts
type ChapterStaging = { theme: string; accent: string }

const STAGING = {
  /* ...existing entries unchanged... */
} satisfies Record<string, ChapterStaging>
```

(Keep the entries verbatim; only the annotation changes from `: Record<...>` to `satisfies`, which preserves literal key checking for the lookup in the map below.)

- [ ] **Step 7: Verify**

Run: `pnpm vitest __tests__/labs/small-world --run` → PASS. Then `pnpm build` → green.

- [ ] **Step 8: Commit**

```bash
git add components/labs/small-world __tests__/labs/small-world/chapters.test.ts
git commit -m "fix(labs/small-world): ramp dispose via provider, reduced-motion listener, aria-hidden canvas, staging satisfies"
```

---

### Task 3: Stage math + PropAnchor — where props stand on the planet

**Files:**
- Create: `components/labs/small-world/scene/stage.ts` (pure math, no React)
- Create: `components/labs/small-world/scene/props/prop-anchor.tsx`
- Modify: `components/labs/small-world/scene/girl-proxy.tsx`, `scene/girl.tsx` (import STANCE_Z from stage.ts)
- Modify: `components/labs/small-world/scene/planet.tsx` (accept children inside the rotating group)
- Test: `__tests__/labs/small-world/stage.test.ts`

**Interfaces:**
- Produces:
  - `STANCE_Z = 0.75` (moves here from girl-proxy; girl-proxy re-exports nothing)
  - `STANCE_ALPHA = Math.asin(STANCE_Z / PLANET_RADIUS)` — the girl's angular offset from the apex
  - `chapterTheta(chapter: number, t: number): number` — planet-LOCAL angle (about x, from +y toward +z) of the surface point that sits under the girl when the journey is `t∈[0,1]` through chapter `chapter`'s travel. Definition: `chapterStartRotation(chapter) + t * CHAPTER_SLICE + STANCE_ALPHA`.
  - `anchorTransform(theta: number, x: number): { position: THREE.Vector3; quaternion: THREE.Quaternion }` — point ON the displaced terrain at local angle `theta`, lateral offset `x` (world units along the planet's x axis), with `quaternion` mapping +Y to the radial up.
  - `<PropAnchor theta={} x={}>{children}</PropAnchor>` — group at that transform; children author with +Y up and ground at y=0.
  - `Planet` accepts `children` rendered INSIDE its rotating group (so props spin with the terrain).
- Consumes: `PLANET_RADIUS`, `terrainBump` from planet.tsx; `chapterStartRotation`, `CHAPTER_SLICE` from journey-timeline.

- [ ] **Step 1: Write the failing tests** — `__tests__/labs/small-world/stage.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  anchorTransform,
  chapterTheta,
  STANCE_ALPHA,
  STANCE_Z,
} from '@/components/labs/small-world/scene/stage'
import { PLANET_RADIUS, surfaceYAt, terrainBump } from '@/components/labs/small-world/scene/planet'
import { chapterStartRotation, CHAPTER_SLICE } from '@/components/labs/small-world/journey-timeline'

describe('stage math', () => {
  it('STANCE_ALPHA is the stance angle from the apex', () => {
    expect(Math.sin(STANCE_ALPHA) * PLANET_RADIUS).toBeCloseTo(STANCE_Z, 10)
  })

  it('chapterTheta spans exactly one slice per chapter, offset by the stance angle', () => {
    expect(chapterTheta(2, 0)).toBeCloseTo(chapterStartRotation(2) + STANCE_ALPHA, 10)
    expect(chapterTheta(2, 1) - chapterTheta(2, 0)).toBeCloseTo(CHAPTER_SLICE, 10)
  })

  it('anchorTransform sits exactly on the displaced terrain', () => {
    for (const [theta, x] of [
      [0.3, 0],
      [1.4, 0.6],
      [4.0, -0.8],
    ] as const) {
      const { position } = anchorTransform(theta, x)
      const pre = position.clone().normalize().multiplyScalar(PLANET_RADIUS)
      const expected = PLANET_RADIUS * (1 + terrainBump(pre.x, pre.y, pre.z))
      expect(position.length()).toBeCloseTo(expected, 6)
    }
  })

  it('the anchor under the girl matches surfaceYAt after the planet rotation', () => {
    for (const rho of [0, 0.7, 2.1, 5.5]) {
      const { position } = anchorTransform(STANCE_ALPHA + rho, 0)
      const world = position.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), -rho)
      expect(world.x).toBeCloseTo(0, 6)
      expect(world.z).toBeCloseTo(STANCE_Z, 1)
      expect(world.y).toBeCloseTo(surfaceYAt(STANCE_Z, rho), 1)
    }
  })

  it('quaternion maps +Y to the radial direction', () => {
    const { position, quaternion } = anchorTransform(2.0, 0.5)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion)
    expect(up.dot(position.clone().normalize())).toBeCloseTo(1, 6)
  })
})
```

- [ ] **Step 2: Run** `pnpm vitest __tests__/labs/small-world/stage.test.ts --run` — FAIL (module missing).

- [ ] **Step 3: Implement `scene/stage.ts`**

```ts
import * as THREE from 'three'
import { CHAPTER_SLICE, chapterStartRotation } from '../journey-timeline'
import { PLANET_RADIUS, terrainBump } from './planet'

/**
 * Where the girl stands, in world z: slightly toward the viewer from the
 * apex, so she faces the camera while incoming terrain rises over the front
 * horizon beneath her. (Moved here from girl-proxy so pure prop math can
 * import it without touching a component file.)
 */
export const STANCE_Z = 0.75

/** The girl's angular offset from the planet apex, about the x axis. */
export const STANCE_ALPHA = Math.asin(STANCE_Z / PLANET_RADIUS)

/**
 * Planet-LOCAL angle (about x, measured from +y toward +z) of the surface
 * point under the girl's feet at fraction t of chapter `chapter`'s travel.
 * Chapter prop sets place everything through this — it is the single
 * function that changes if per-chapter turn ever grows past 60°.
 */
export function chapterTheta(chapter: number, t: number): number {
  return chapterStartRotation(chapter) + t * CHAPTER_SLICE + STANCE_ALPHA
}

const Y_UP = new THREE.Vector3(0, 1, 0)

/**
 * Transform for a prop standing ON the displaced terrain at local angle
 * `theta` with lateral offset `x` world units along the planet's x axis.
 * Children of the returned frame author with +Y up, ground at y=0.
 */
export function anchorTransform(
  theta: number,
  x: number
): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
  const xN = THREE.MathUtils.clamp(x / PLANET_RADIUS, -0.95, 0.95)
  const ring = Math.sqrt(1 - xN * xN)
  const dir = new THREE.Vector3(xN, ring * Math.cos(theta), ring * Math.sin(theta))
  const pre = dir.clone().multiplyScalar(PLANET_RADIUS)
  const bump = terrainBump(pre.x, pre.y, pre.z)
  const position = dir.clone().multiplyScalar(PLANET_RADIUS * (1 + bump))
  const quaternion = new THREE.Quaternion().setFromUnitVectors(Y_UP, dir)
  return { position, quaternion }
}
```

- [ ] **Step 4: Run the stage tests** — PASS.

- [ ] **Step 5: `props/prop-anchor.tsx`**

```tsx
'use client'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { anchorTransform } from '../stage'

/** Plants children on the terrain at local angle theta / lateral x. */
export function PropAnchor({
  theta,
  x = 0,
  children,
}: {
  theta: number
  x?: number
  children: ReactNode
}) {
  const { position, quaternion } = useMemo(() => anchorTransform(theta, x), [theta, x])
  return (
    <group position={position} quaternion={quaternion}>
      {children}
    </group>
  )
}
```

- [ ] **Step 6: Wire STANCE_Z + Planet children**

- `girl-proxy.tsx`: delete its local `STANCE_Z` export; `import { STANCE_Z } from './stage'`.
- `girl.tsx`: update the STANCE_Z import the same way.
- `planet.tsx`: accept children inside the rotating group:

```tsx
export function Planet({ journeyRef, children }: { journeyRef: JourneyRef; children?: ReactNode }) {
  /* ...unchanged refs/ramp/geometry/useFrame... */
  return (
    <group ref={group}>
      <mesh geometry={geometry}>
        <meshToonMaterial vertexColors gradientMap={ramp} />
      </mesh>
      {children}
    </group>
  )
}
```

(Add `import type { ReactNode } from 'react'`.) Grep for any other `STANCE_Z` importers and update them.

- [ ] **Step 7: Verify** — `pnpm vitest __tests__/labs/small-world --run` PASS, `pnpm build` green.

- [ ] **Step 8: Commit**

```bash
git add components/labs/small-world __tests__/labs/small-world/stage.test.ts
git commit -m "feat(labs/small-world): stage math + PropAnchor, planet accepts prop children"
```

---

### Task 4: Clay kit + ChapterSet morph wrapper + BlueNet set

**Files:**
- Create: `components/labs/small-world/scene/props/clay-kit.tsx`
- Create: `components/labs/small-world/scene/props/chapter-set.tsx`
- Create: `components/labs/small-world/scene/props/set-bluenet.tsx`
- Modify: `components/labs/small-world/scene/scene.tsx` (render sets inside Planet)

**Interfaces:**
- Produces: clay primitives (below) and `<ChapterSet index journeyRef>{children}</ChapterSet>` — a group whose scale tracks `easeOutBack(morph[index])` about the PLANET CENTER (radial scale = props sink into / grow out of the clay), `visible=false` when morph ≈ 0.
- Consumes: `useClayRamp` (Task 2), `PropAnchor`/`chapterTheta` (Task 3), `easeOutBack` (Task 1).
- Pivot clause (Gate 1): if Aram calls morphing janky, `ChapterSet` alone changes to `scale=1, visible=true` — sets and anchors survive untouched.

- [ ] **Step 1: `props/clay-kit.tsx`** — shared primitive vocabulary; every mesh MeshToonMaterial + shared ramp:

```tsx
'use client'
import * as React from 'react'
import { PALETTE } from '../../palette'
import { useClayRamp } from '../toon-ramp'

type Xform = {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}

export function ClayTree({ crown = PALETTE.leaf, height = 0.45, ...x }: Xform & { crown?: string; height?: number }) {
  const ramp = useClayRamp()
  return (
    <group {...x}>
      <mesh position={[0, height * 0.25, 0]}>
        <cylinderGeometry args={[0.035, 0.05, height * 0.5, 8]} />
        <meshToonMaterial color={PALETTE.clayPath} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, height * 0.72, 0]}>
        <sphereGeometry args={[height * 0.38, 20, 20]} />
        <meshToonMaterial color={crown} gradientMap={ramp} />
      </mesh>
      <mesh position={[height * 0.18, height * 0.95, 0]}>
        <sphereGeometry args={[height * 0.22, 16, 16]} />
        <meshToonMaterial color={crown} gradientMap={ramp} />
      </mesh>
    </group>
  )
}

export function ClaySprout(x: Xform) {
  const ramp = useClayRamp()
  return (
    <group {...x}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.012, 0.018, 0.1, 6]} />
        <meshToonMaterial color={PALETTE.sprout} gradientMap={ramp} />
      </mesh>
      <mesh position={[-0.035, 0.1, 0]} rotation={[0, 0, 0.6]} scale={[1, 0.45, 0.7]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshToonMaterial color={PALETTE.sprout} gradientMap={ramp} />
      </mesh>
      <mesh position={[0.035, 0.11, 0]} rotation={[0, 0, -0.6]} scale={[1, 0.45, 0.7]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshToonMaterial color={PALETTE.sprout} gradientMap={ramp} />
      </mesh>
    </group>
  )
}

export function ClayBlossom({ color = PALETTE.blossom, ...x }: Xform & { color?: string }) {
  const ramp = useClayRamp()
  return (
    <group {...x}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.008, 0.012, 0.1, 6]} />
        <meshToonMaterial color={PALETTE.leaf} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshToonMaterial color={color} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.155, 0]}>
        <sphereGeometry args={[0.016, 8, 8]} />
        <meshToonMaterial color={PALETTE.honey} gradientMap={ramp} />
      </mesh>
    </group>
  )
}

export function ClayRock({ color = PALETTE.dune, r = 0.09, ...x }: Xform & { color?: string; r?: number }) {
  const ramp = useClayRamp()
  return (
    <mesh {...x} scale={[1, 0.6, 1].map((s) => s * (x.scale ?? 1)) as [number, number, number]}>
      <dodecahedronGeometry args={[r, 0]} />
      <meshToonMaterial color={color} gradientMap={ramp} />
    </mesh>
  )
}

export function ClayHut({ walls = PALETTE.sky, roof = PALETTE.clayPath, ...x }: Xform & { walls?: string; roof?: string }) {
  const ramp = useClayRamp()
  return (
    <group {...x}>
      <mesh position={[0, 0.13, 0]}>
        <boxGeometry args={[0.34, 0.26, 0.3]} />
        <meshToonMaterial color={walls} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.34, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.28, 0.2, 4]} />
        <meshToonMaterial color={roof} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.08, 0.152]}>
        <boxGeometry args={[0.08, 0.16, 0.01]} />
        <meshToonMaterial color={PALETTE.ink} gradientMap={ramp} />
      </mesh>
    </group>
  )
}

export function ClayDisc({ color, r = 0.14, h = 0.035, ...x }: Xform & { color: string; r?: number; h?: number }) {
  const ramp = useClayRamp()
  return (
    <mesh {...x} position={[...(x.position ?? [0, 0, 0])].map((v, i) => (i === 1 ? v + h / 2 : v)) as [number, number, number]}>
      <cylinderGeometry args={[r, r * 1.15, h, 20]} />
      <meshToonMaterial color={color} gradientMap={ramp} />
    </mesh>
  )
}

export function ClayBee(x: Xform) {
  const ramp = useClayRamp()
  return (
    <group {...x}>
      <mesh scale={[1.3, 1, 1]}>
        <sphereGeometry args={[0.055, 14, 14]} />
        <meshToonMaterial color={PALETTE.honey} gradientMap={ramp} />
      </mesh>
      <mesh position={[0.08, 0.01, 0]}>
        <sphereGeometry args={[0.038, 12, 12]} />
        <meshToonMaterial color={PALETTE.ink} gradientMap={ramp} />
      </mesh>
      <mesh position={[-0.02, 0.055, 0]} scale={[1.6, 0.35, 1]}>
        <sphereGeometry args={[0.035, 10, 10]} />
        <meshToonMaterial color={PALETTE.sky} gradientMap={ramp} />
      </mesh>
    </group>
  )
}

export function ClayBird(x: Xform) {
  const ramp = useClayRamp()
  return (
    <group {...x}>
      <mesh scale={[1.5, 1, 1]}>
        <sphereGeometry args={[0.05, 14, 14]} />
        <meshToonMaterial color={PALETTE.sky} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.03, 0]} scale={[2.4, 0.25, 1.4]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <meshToonMaterial color={PALETTE.horizon} gradientMap={ramp} />
      </mesh>
      <mesh position={[0.09, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.015, 0.04, 8]} />
        <meshToonMaterial color={PALETTE.honey} gradientMap={ramp} />
      </mesh>
    </group>
  )
}

export function ClayPalm(x: Xform) {
  const ramp = useClayRamp()
  const fronds = [0, 1.25, 2.5, 3.75, 5]
  return (
    <group {...x}>
      <mesh position={[0.03, 0.24, 0]} rotation={[0, 0, -0.12]}>
        <cylinderGeometry args={[0.03, 0.05, 0.5, 8]} />
        <meshToonMaterial color={PALETTE.clayPath} gradientMap={ramp} />
      </mesh>
      {fronds.map((a) => (
        <mesh
          key={a}
          position={[0.06 + 0.11 * Math.cos(a), 0.5, 0.11 * Math.sin(a)]}
          rotation={[0, -a, 0.5]}
          scale={[1.8, 0.18, 0.55]}
        >
          <sphereGeometry args={[0.11, 10, 10]} />
          <meshToonMaterial color={PALETTE.leaf} gradientMap={ramp} />
        </mesh>
      ))}
    </group>
  )
}

export function ClayBlock({ w = 0.2, h = 0.2, d = 0.2, color, ...x }: Xform & { w?: number; h?: number; d?: number; color: string }) {
  const ramp = useClayRamp()
  return (
    <mesh {...x} position={[...(x.position ?? [0, 0, 0])].map((v, i) => (i === 1 ? v + h / 2 : v)) as [number, number, number]}>
      <boxGeometry args={[w, h, d]} />
      <meshToonMaterial color={color} gradientMap={ramp} />
    </mesh>
  )
}

export function ClayMound({ r = 0.5, color = PALETTE.meadow, squash = 0.55, ...x }: Xform & { r?: number; color?: string; squash?: number }) {
  const ramp = useClayRamp()
  return (
    <mesh {...x} scale={[1, squash, 1].map((s) => s * (x.scale ?? 1)) as [number, number, number]}>
      <sphereGeometry args={[r, 24, 24]} />
      <meshToonMaterial color={color} gradientMap={ramp} />
    </mesh>
  )
}
```

- [ ] **Step 2: `props/chapter-set.tsx`**

```tsx
'use client'
import { useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { easeOutBack } from '../../journey-timeline'
import type { JourneyRef } from '../use-journey'

/**
 * Scales a chapter's props by its morph value ABOUT THE PLANET CENTER —
 * shrinking pulls every anchored prop radially into the clay, growing pops
 * it back out with easeOutBack overshoot. Gate-1 pivot (fixed planet):
 * replace the frame body with `ref.current.scale.setScalar(1)` + always
 * visible; sets and anchors stay untouched.
 */
export function ChapterSet({
  index,
  journeyRef,
  children,
}: {
  index: number
  journeyRef: JourneyRef
  children: ReactNode
}) {
  const ref = useRef<THREE.Group>(null)

  useFrame(() => {
    const g = ref.current
    if (!g) return
    const m = journeyRef.current.morph[index]
    g.visible = m > 0.001
    if (g.visible) g.scale.setScalar(Math.max(easeOutBack(m), 0.0001))
  })

  return <group ref={ref}>{children}</group>
}
```

- [ ] **Step 3: `props/set-bluenet.tsx`** — first shoots of spring: seedlings on the travel arc, the clay hotel + reception bell at the discovery point:

```tsx
'use client'
import { PALETTE } from '../../palette'
import { chapterTheta } from '../stage'
import { PropAnchor } from './prop-anchor'
import { ClayBlossom, ClayHut, ClayRock, ClaySprout, ClayTree } from './clay-kit'
import { useClayRamp } from '../toon-ramp'

const T = (t: number) => chapterTheta(0, t)

function ReceptionBell(props: { position?: [number, number, number] }) {
  const ramp = useClayRamp()
  return (
    <group {...props}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.1, 12]} />
        <meshToonMaterial color={PALETTE.clayPath} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.13, 0]}>
        <sphereGeometry args={[0.05, 14, 14]} />
        <meshToonMaterial color={PALETTE.honey} gradientMap={ramp} />
      </mesh>
    </group>
  )
}

/** Chapter 1 — BlueNet/FreeDOM: career origin, first shoots of spring. */
export function BluenetSet() {
  return (
    <>
      <PropAnchor theta={T(0.1)} x={0.35}><ClaySprout /></PropAnchor>
      <PropAnchor theta={T(0.18)} x={-0.3}><ClaySprout scale={1.3} /></PropAnchor>
      <PropAnchor theta={T(0.28)} x={0.15}><ClayBlossom /></PropAnchor>
      <PropAnchor theta={T(0.34)} x={-0.5}><ClaySprout /></PropAnchor>
      <PropAnchor theta={T(0.42)} x={0.55}><ClayTree crown={PALETTE.sprout} height={0.35} /></PropAnchor>
      <PropAnchor theta={T(0.5)} x={-0.25}><ClayBlossom /></PropAnchor>
      <PropAnchor theta={T(0.6)} x={0.4}><ClayRock r={0.07} /></PropAnchor>
      <PropAnchor theta={T(0.72)} x={-0.45}><ClayHut /></PropAnchor>
      <PropAnchor theta={T(0.8)} x={-0.18}><ReceptionBell /></PropAnchor>
      <PropAnchor theta={T(0.86)} x={0.3}><ClayTree crown={PALETTE.leaf} height={0.42} /></PropAnchor>
      <PropAnchor theta={T(0.92)} x={-0.6}><ClayBlossom /></PropAnchor>
    </>
  )
}
```

- [ ] **Step 4: Wire into the scene** — in `scene.tsx` `SceneContents`, render the set inside Planet:

```tsx
<Planet journeyRef={journeyRef}>
  <ChapterSet index={0} journeyRef={journeyRef}>
    <BluenetSet />
  </ChapterSet>
</Planet>
```

(Imports: `ChapterSet` from `./props/chapter-set`, `BluenetSet` from `./props/set-bluenet`.)

- [ ] **Step 5: Verify** — `pnpm vitest __tests__/labs/small-world --run` PASS, `pnpm build` green, then capture: dev server on :3017 (`$env:PORT`? no — `pnpm dev -p 3017`), `node .superpowers/sdd/bench/lookdev-capture.mjs .superpowers/sdd/bench/out-task4`. Eyeball: seedlings visible on the arc during chapter 1 travel, hut+bell arriving over the front horizon near the stop, props standing radially (not tilted), nothing floating.

- [ ] **Step 6: Commit**

```bash
git add components/labs/small-world
git commit -m "feat(labs/small-world): clay prop kit, morphing ChapterSet, BlueNet chapter set"
```

---

### Task 5: FLYERBEE set + morph proof → Gate 1 deck

**Files:**
- Create: `components/labs/small-world/scene/props/set-flyerbee.tsx`
- Modify: `components/labs/small-world/scene/scene.tsx`

**Interfaces:** consumes Task 3/4 exports; produces `FlyerbeeSet`.

- [ ] **Step 1: `props/set-flyerbee.tsx`** — winding delivery path, beehive, hovering bees:

```tsx
'use client'
import { PALETTE } from '../../palette'
import { chapterTheta } from '../stage'
import { PropAnchor } from './prop-anchor'
import { ClayBee, ClayBlossom, ClayDisc, ClayMound, ClayTree } from './clay-kit'

const T = (t: number) => chapterTheta(1, t)

/** The winding path: clay stepping discs alternating around the girl's line. */
const PATH: Array<[number, number]> = [
  [0.08, 0.1], [0.16, -0.12], [0.24, 0.18], [0.32, -0.2], [0.4, 0.12],
  [0.48, -0.08], [0.56, 0.2], [0.64, -0.16], [0.72, 0.1],
]

function Beehive(props: { position?: [number, number, number] }) {
  return (
    <group {...props}>
      <ClayMound r={0.16} squash={0.5} color={PALETTE.honey} position={[0, 0.06, 0]} />
      <ClayMound r={0.13} squash={0.5} color={PALETTE.dune} position={[0, 0.16, 0]} />
      <ClayMound r={0.09} squash={0.5} color={PALETTE.honey} position={[0, 0.24, 0]} />
    </group>
  )
}

/** Chapter 2 — FLYERBEE: bees over pink flowers along the delivery path. */
export function FlyerbeeSet() {
  return (
    <>
      {PATH.map(([t, x]) => (
        <PropAnchor key={t} theta={T(t)} x={x}>
          <ClayDisc color={PALETTE.clayPath} r={0.09} />
        </PropAnchor>
      ))}
      <PropAnchor theta={T(0.3)} x={0.5}><ClayBlossom /></PropAnchor>
      <PropAnchor theta={T(0.45)} x={-0.55}><ClayBlossom color={PALETTE.blossomDeep} /></PropAnchor>
      <PropAnchor theta={T(0.55)} x={0.6}><ClayBlossom /></PropAnchor>
      <PropAnchor theta={T(0.62)} x={-0.35}><ClayTree crown={PALETTE.blossom} height={0.4} /></PropAnchor>
      <PropAnchor theta={T(0.78)} x={-0.5}><Beehive /></PropAnchor>
      <PropAnchor theta={T(0.74)} x={-0.3}><ClayBee position={[0, 0.35, 0]} /></PropAnchor>
      <PropAnchor theta={T(0.82)} x={-0.15}><ClayBee position={[0, 0.45, 0]} rotation={[0, 2.5, 0]} /></PropAnchor>
      <PropAnchor theta={T(0.88)} x={0.25}><ClayBee position={[0, 0.3, 0]} rotation={[0, 4, 0]} /></PropAnchor>
      <PropAnchor theta={T(0.9)} x={0.45}><ClayBlossom /></PropAnchor>
    </>
  )
}
```

- [ ] **Step 2: Wire** — in `scene.tsx`, add `<ChapterSet index={1} journeyRef={journeyRef}><FlyerbeeSet /></ChapterSet>` beside the bluenet set.

- [ ] **Step 3: Verify + Gate 1 deck** — unit suite + build green, then capture frames spanning the chapter 1→2 boundary. Add these scroll positions to the capture run (progress values): `0.14, 0.167, 0.175, 0.19, 0.21, 0.25, 0.31` — they straddle PANEL_END of chapter 1 and the morph window of chapter 2 (grow while sink). Eyeball: outgoing seedlings/hotel sink INTO the clay as bees/path grow OUT, springy overshoot visible, no prop ever hovers detached mid-morph.

- [ ] **Step 4: Commit + Gate 1**

```bash
git add components/labs/small-world
git commit -m "feat(labs/small-world): FLYERBEE chapter set — morph proof (Gate 1)"
```

The orchestrator sends the Gate-1 deck to Aram (morph-vs-fixed verdict) and CONTINUES to Task 6 — the pivot, if called, changes only `ChapterSet`.

---

### Task 6: Chapter sets 3–6 (360dialog, Accenture, AKNA, xDataGroup)

**Files:**
- Create: `components/labs/small-world/scene/props/set-360dialog.tsx`
- Create: `components/labs/small-world/scene/props/set-accenture.tsx`
- Create: `components/labs/small-world/scene/props/set-akna.tsx`
- Create: `components/labs/small-world/scene/props/set-xdatagroup.tsx`
- Modify: `components/labs/small-world/scene/scene.tsx`

**Interfaces:** consumes Task 3/4 exports; produces one `<XxxSet />` per file.

- [ ] **Step 1: `props/set-360dialog.tsx`** — river delta, message-pebble stepping stones, carrier birds:

```tsx
'use client'
import { PALETTE } from '../../palette'
import { chapterTheta } from '../stage'
import { PropAnchor } from './prop-anchor'
import { ClayBird, ClayDisc, ClayRock } from './clay-kit'

const T = (t: number) => chapterTheta(2, t)

/** The delta: overlapping blue discs spanning the girl's line. */
const RIVER: Array<[number, number, number]> = [
  // [t, x, r]
  [0.38, -0.7, 0.2], [0.42, -0.35, 0.24], [0.46, 0, 0.26], [0.5, 0.35, 0.24],
  [0.54, 0.7, 0.2], [0.48, -0.55, 0.18], [0.52, 0.15, 0.2], [0.44, 0.5, 0.18],
]

export function Dialog360Set() {
  return (
    <>
      {RIVER.map(([t, x, r]) => (
        <PropAnchor key={`${t}-${x}`} theta={T(t)} x={x}>
          <ClayDisc color={PALETTE.river} r={r} h={0.03} />
        </PropAnchor>
      ))}
      <PropAnchor theta={T(0.46)} x={-0.18}><ClayDisc color={PALETTE.riverDeep} r={0.14} h={0.045} /></PropAnchor>
      {/* Message-pebble stepping stones across the girl's line */}
      <PropAnchor theta={T(0.42)} x={0.02}><ClayDisc color={PALETTE.sky} r={0.07} h={0.05} /></PropAnchor>
      <PropAnchor theta={T(0.47)} x={-0.04}><ClayDisc color={PALETTE.sky} r={0.07} h={0.05} /></PropAnchor>
      <PropAnchor theta={T(0.52)} x={0.03}><ClayDisc color={PALETTE.sky} r={0.07} h={0.05} /></PropAnchor>
      {/* Carrier birds overhead */}
      <PropAnchor theta={T(0.6)} x={-0.4}><ClayBird position={[0, 0.55, 0]} rotation={[0, 1.2, 0]} /></PropAnchor>
      <PropAnchor theta={T(0.7)} x={0.2}><ClayBird position={[0, 0.7, 0]} rotation={[0, 2, 0]} /></PropAnchor>
      <PropAnchor theta={T(0.78)} x={-0.1}><ClayBird position={[0, 0.5, 0]} rotation={[0, 0.6, 0]} /></PropAnchor>
      <PropAnchor theta={T(0.25)} x={0.55}><ClayRock /></PropAnchor>
      <PropAnchor theta={T(0.85)} x={-0.55}><ClayRock r={0.11} /></PropAnchor>
    </>
  )
}
```

- [ ] **Step 2: `props/set-accenture.tsx`** — golden dunes, palm, geometric bank facade:

```tsx
'use client'
import { PALETTE } from '../../palette'
import { chapterTheta } from '../stage'
import { PropAnchor } from './prop-anchor'
import { ClayBlock, ClayMound, ClayPalm, ClayRock } from './clay-kit'

const T = (t: number) => chapterTheta(3, t)

function BankFacade(props: { position?: [number, number, number] }) {
  return (
    <group {...props}>
      <ClayBlock w={0.4} h={0.3} d={0.16} color={PALETTE.sky} />
      <ClayBlock w={0.3} h={0.1} d={0.18} color={PALETTE.honey} position={[0, 0.3, 0]} />
      <ClayBlock w={0.06} h={0.2} d={0.02} color={PALETTE.ink} position={[0, 0, 0.08]} />
      <ClayBlock w={0.05} h={0.24} d={0.14} color={PALETTE.dune} position={[-0.24, 0, 0]} />
      <ClayBlock w={0.05} h={0.24} d={0.14} color={PALETTE.dune} position={[0.24, 0, 0]} />
    </group>
  )
}

export function AccentureSet() {
  return (
    <>
      <PropAnchor theta={T(0.3)} x={0.45}><ClayMound r={0.35} color={PALETTE.dune} squash={0.4} /></PropAnchor>
      <PropAnchor theta={T(0.45)} x={-0.5}><ClayMound r={0.45} color={PALETTE.dune} squash={0.35} /></PropAnchor>
      <PropAnchor theta={T(0.6)} x={0.3}><ClayMound r={0.3} color={PALETTE.honey} squash={0.3} /></PropAnchor>
      <PropAnchor theta={T(0.55)} x={0.6}><ClayPalm /></PropAnchor>
      <PropAnchor theta={T(0.78)} x={-0.4}><BankFacade /></PropAnchor>
      <PropAnchor theta={T(0.85)} x={0.35}><ClayRock color={PALETTE.dune} r={0.1} /></PropAnchor>
      <PropAnchor theta={T(0.2)} x={-0.3}><ClayRock color={PALETTE.dune} r={0.07} /></PropAnchor>
    </>
  )
}
```

- [ ] **Step 3: `props/set-akna.tsx`** — market street of stacked component blocks in pink tuff:

```tsx
'use client'
import { PALETTE } from '../../palette'
import { chapterTheta } from '../stage'
import { PropAnchor } from './prop-anchor'
import { ClayBlock, ClayBlossom, ClayDisc } from './clay-kit'

const T = (t: number) => chapterTheta(4, t)

function BlockBuilding({ tiers, ...props }: { tiers: Array<{ w: number; h: number; color: string }>; position?: [number, number, number] }) {
  let y = 0
  return (
    <group {...props}>
      {tiers.map((tier, i) => {
        const el = <ClayBlock key={i} w={tier.w} h={tier.h} d={tier.w} color={tier.color} position={[0, y, 0]} />
        y += tier.h
        return el
      })}
    </group>
  )
}

export function AknaSet() {
  return (
    <>
      {/* Street pads down the middle */}
      <PropAnchor theta={T(0.3)} x={0}><ClayDisc color={PALETTE.clayPath} r={0.1} /></PropAnchor>
      <PropAnchor theta={T(0.45)} x={0.05}><ClayDisc color={PALETTE.clayPath} r={0.1} /></PropAnchor>
      <PropAnchor theta={T(0.6)} x={-0.05}><ClayDisc color={PALETTE.clayPath} r={0.1} /></PropAnchor>
      {/* Stacked buildings flanking the street */}
      <PropAnchor theta={T(0.35)} x={-0.45}>
        <BlockBuilding tiers={[{ w: 0.24, h: 0.18, color: PALETTE.tuff }, { w: 0.2, h: 0.14, color: PALETTE.horizon }, { w: 0.14, h: 0.1, color: PALETTE.blossom }]} />
      </PropAnchor>
      <PropAnchor theta={T(0.48)} x={0.5}>
        <BlockBuilding tiers={[{ w: 0.26, h: 0.22, color: PALETTE.horizon }, { w: 0.18, h: 0.16, color: PALETTE.tuff }]} />
      </PropAnchor>
      <PropAnchor theta={T(0.62)} x={-0.5}>
        <BlockBuilding tiers={[{ w: 0.2, h: 0.16, color: PALETTE.sky }, { w: 0.16, h: 0.12, color: PALETTE.tuff }, { w: 0.1, h: 0.1, color: PALETTE.blossomDeep }]} />
      </PropAnchor>
      <PropAnchor theta={T(0.78)} x={0.4}>
        <BlockBuilding tiers={[{ w: 0.3, h: 0.2, color: PALETTE.tuff }, { w: 0.22, h: 0.14, color: PALETTE.sky }, { w: 0.14, h: 0.12, color: PALETTE.horizon }]} />
      </PropAnchor>
      <PropAnchor theta={T(0.85)} x={-0.25}><ClayBlossom /></PropAnchor>
      <PropAnchor theta={T(0.25)} x={0.3}><ClayBlossom color={PALETTE.blossomDeep} /></PropAnchor>
    </>
  )
}
```

- [ ] **Step 4: `props/set-xdatagroup.tsx`** — blossom summit, vault door in the hillside:

```tsx
'use client'
import { PALETTE } from '../../palette'
import { chapterTheta } from '../stage'
import { PropAnchor } from './prop-anchor'
import { ClayBlossom, ClayMound, ClayTree } from './clay-kit'
import { useClayRamp } from '../toon-ramp'

const T = (t: number) => chapterTheta(5, t)

function VaultDoor(props: { position?: [number, number, number]; rotation?: [number, number, number] }) {
  const ramp = useClayRamp()
  return (
    <group {...props}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.09, 0.025, 12, 24]} />
        <meshToonMaterial color={PALETTE.honey} gradientMap={ramp} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <circleGeometry args={[0.085, 24]} />
        <meshToonMaterial color={PALETTE.ink} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <sphereGeometry args={[0.02, 10, 10]} />
        <meshToonMaterial color={PALETTE.honey} gradientMap={ramp} />
      </mesh>
    </group>
  )
}

/** Chapter 6 — xDataGroup: present day, the tallest hill in full bloom. */
export function XdatagroupSet() {
  return (
    <>
      <PropAnchor theta={T(0.7)} x={0}><ClayMound r={0.55} squash={0.5} /></PropAnchor>
      {/* Vault door lies on the mound's camera-facing slope */}
      <PropAnchor theta={T(0.62)} x={0.12}><VaultDoor position={[0, 0.16, 0]} rotation={[0.5, 0, 0]} /></PropAnchor>
      <PropAnchor theta={T(0.55)} x={-0.4}><ClayTree crown={PALETTE.blossom} height={0.5} /></PropAnchor>
      <PropAnchor theta={T(0.68)} x={0.45}><ClayTree crown={PALETTE.blossomDeep} height={0.55} /></PropAnchor>
      <PropAnchor theta={T(0.8)} x={-0.3}><ClayTree crown={PALETTE.blossom} height={0.6} /></PropAnchor>
      <PropAnchor theta={T(0.86)} x={0.25}><ClayTree crown={PALETTE.blossom} height={0.45} /></PropAnchor>
      <PropAnchor theta={T(0.3)} x={0.35}><ClayBlossom /></PropAnchor>
      <PropAnchor theta={T(0.4)} x={-0.5}><ClayBlossom color={PALETTE.blossomDeep} /></PropAnchor>
      <PropAnchor theta={T(0.9)} x={-0.55}><ClayBlossom /></PropAnchor>
      <PropAnchor theta={T(0.2)} x={-0.15}><ClayBlossom /></PropAnchor>
    </>
  )
}
```

- [ ] **Step 5: Wire all six** in `scene.tsx`:

```tsx
<Planet journeyRef={journeyRef}>
  <ChapterSet index={0} journeyRef={journeyRef}><BluenetSet /></ChapterSet>
  <ChapterSet index={1} journeyRef={journeyRef}><FlyerbeeSet /></ChapterSet>
  <ChapterSet index={2} journeyRef={journeyRef}><Dialog360Set /></ChapterSet>
  <ChapterSet index={3} journeyRef={journeyRef}><AccentureSet /></ChapterSet>
  <ChapterSet index={4} journeyRef={journeyRef}><AknaSet /></ChapterSet>
  <ChapterSet index={5} journeyRef={journeyRef}><XdatagroupSet /></ChapterSet>
</Planet>
```

- [ ] **Step 6: Verify** — unit + build green; capture at chapter-center progress values `0.075, 0.24, 0.4, 0.575, 0.74, 0.9` and eyeball each stage against its spec theme. Watch draw calls: at most two sets visible at once (morph window) — if a capture shows three sets simultaneously visible, the visibility gate is broken.

- [ ] **Step 7: Commit**

```bash
git add components/labs/small-world
git commit -m "feat(labs/small-world): chapter sets 3-6 — river delta, dunes, tuff street, blossom summit"
```

---

### Task 7: Discovery burst — "!" pop + girl celebration

**Files:**
- Create: `components/labs/small-world/scene/discovery-burst.tsx`
- Modify: `components/labs/small-world/scene/girl-proxy.tsx` (celebration bounce during burst)
- Modify: `components/labs/small-world/scene/scene.tsx` (render burst)

**Interfaces:** consumes `journeyRef.current.burst` (0..1 or null), `surfaceYAt`, `STANCE_Z`, `easeOutBack`.

- [ ] **Step 1: `scene/discovery-burst.tsx`**

```tsx
'use client'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../palette'
import { easeOutBack } from '../journey-timeline'
import { surfaceYAt } from './planet'
import { STANCE_Z } from './stage'
import { useClayRamp } from './toon-ramp'
import type { JourneyRef } from './use-journey'

/**
 * The "!" that pops over her head at each discovery stop: easeOutBack pop-in,
 * wobble, fade-out by scale in the last quarter of the burst window.
 */
export function DiscoveryBurst({ journeyRef }: { journeyRef: JourneyRef }) {
  const group = useRef<THREE.Group>(null)
  const ramp = useClayRamp()

  useFrame(() => {
    const g = group.current
    if (!g) return
    const { burst, rotation } = journeyRef.current
    g.visible = burst !== null
    if (burst === null) return
    const pop = easeOutBack(Math.min(1, burst / 0.35))
    const fade = 1 - THREE.MathUtils.smoothstep(burst, 0.75, 1)
    g.scale.setScalar(Math.max(0.4 * pop * fade, 0.0001))
    g.position.y = surfaceYAt(STANCE_Z, rotation) + 1.12 + 0.08 * burst
    g.rotation.z = 0.18 * Math.sin(burst * Math.PI * 4)
  })

  return (
    <group ref={group} position={[0, 0, STANCE_Z]} visible={false}>
      <mesh position={[0, 0.12, -0.02]}>
        <circleGeometry args={[0.28, 24]} />
        <meshToonMaterial color={PALETTE.honey} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <capsuleGeometry args={[0.055, 0.2, 6, 12]} />
        <meshToonMaterial color={PALETTE.blossomDeep} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, -0.06, 0]}>
        <sphereGeometry args={[0.06, 14, 14]} />
        <meshToonMaterial color={PALETTE.blossomDeep} gradientMap={ramp} />
      </mesh>
    </group>
  )
}
```

Note: the badge circle faces +z — with the camera pitched 20° this reads fine at this size; do NOT add per-frame billboarding unless the capture shows visible skew.

- [ ] **Step 2: Celebration bounce in `girl-proxy.tsx`** — inside the existing `useFrame`, after `hop` is computed:

```ts
const { rotation, burst } = journeyRef.current
// ... existing speed/activity/hop math unchanged ...
// Discovery celebration: two excited bounces while the "!" is up — rotation
// is frozen here so travel hop is zero; this is her reaction beat.
const celebrate = burst === null ? 0 : Math.abs(Math.sin(burst * Math.PI * 3)) * (1 - 0.35 * burst)
const lift = Math.max(hop, celebrate * 0.2)
```

Use `lift` (not `hop`) for `group.current.position.y = groundY + lift` and for the shadow's `const liftT = lift / HOP_HEIGHT` (clamp `liftT` to 1: `Math.min(1, lift / HOP_HEIGHT)` — celebrate can exceed HOP_HEIGHT). Extend squash: `const squashCelebrate = 1 + 0.1 * Math.sin(burst === null ? 0 : burst * Math.PI * 6)` multiplied into `squash`.

- [ ] **Step 3: Render** `<DiscoveryBurst journeyRef={journeyRef} />` in `SceneContents` after the girl.

- [ ] **Step 4: Verify** — unit + build green; capture at progress `0.098` (chapter 1 burst window: local 0.55–0.65 of segment 0 → progress 0.092–0.108). Eyeball: "!" popped over her head with honey badge, girl mid-bounce, shadow still attached.

- [ ] **Step 5: Commit**

```bash
git add components/labs/small-world
git commit -m "feat(labs/small-world): discovery burst — '!' pop and celebration bounce"
```

---

### Task 8: Journey UI bridge + speed lines

**Files:**
- Create: `components/labs/small-world/overlay/use-journey-ui.ts`
- Create: `components/labs/small-world/overlay/speed-lines.tsx`
- Modify: `components/labs/small-world/small-world-experience.tsx` (mount overlay layer)
- Test: `__tests__/labs/small-world/use-journey-ui.test.tsx`

**Interfaces:**
- Produces: `useJourneyUi(progressRef): JourneyUi` where `JourneyUi = { chapter: number; burst: boolean; panel: { chapter: number; t: number } | null; ended: boolean }` — `panel.t` quantized to 1/40 steps; `ended` true when progress ≥ 0.985. Also `<SpeedLines active={boolean} />`.
- Consumes: `journeyStateAt` (pure — this is the sanctioned DOM-side consumer of RAW progress; no damping, panels must not lag the scroll).

- [ ] **Step 1: Write the failing hook test** — `__tests__/labs/small-world/use-journey-ui.test.tsx`

```tsx
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useJourneyUi } from '@/components/labs/small-world/overlay/use-journey-ui'

function refOf(value: number) {
  return { current: value }
}

const fireScroll = () => act(() => { window.dispatchEvent(new Event('scroll')) })

describe('useJourneyUi', () => {
  it('starts in chapter 0 with no panel', () => {
    const { result } = renderHook(() => useJourneyUi(refOf(0)))
    expect(result.current).toEqual({ chapter: 0, burst: false, panel: null, ended: false })
  })

  it('reports the burst window', () => {
    const ref = refOf(0)
    const { result } = renderHook(() => useJourneyUi(ref))
    ref.current = 0.1 // chapter 0 local 0.6 — inside [0.55, 0.65)
    fireScroll()
    expect(result.current.burst).toBe(true)
    expect(result.current.panel).toBeNull()
  })

  it('reports the panel window with quantized t', () => {
    const ref = refOf(0)
    const { result } = renderHook(() => useJourneyUi(ref))
    ref.current = 0.8 / 6 // chapter 0 local 0.8 — inside [0.65, 0.95)
    fireScroll()
    expect(result.current.panel).not.toBeNull()
    expect(result.current.panel!.chapter).toBe(0)
    expect(result.current.panel!.t).toBeCloseTo(0.5, 1)
    expect((result.current.panel!.t * 40) % 1).toBeCloseTo(0, 6)
  })

  it('reports the ending', () => {
    const ref = refOf(0)
    const { result } = renderHook(() => useJourneyUi(ref))
    ref.current = 1
    fireScroll()
    expect(result.current.ended).toBe(true)
  })

  it('keeps referential stability when nothing changed', () => {
    const ref = refOf(0.2)
    const { result } = renderHook(() => useJourneyUi(ref))
    const before = result.current
    fireScroll()
    expect(result.current).toBe(before)
  })
})
```

- [ ] **Step 2: Run** — FAIL (module missing).

- [ ] **Step 3: Implement `overlay/use-journey-ui.ts`**

```ts
'use client'
import { useEffect, useState } from 'react'
import type { MutableRefObject } from 'react'
import { journeyStateAt } from '../journey-timeline'

export type JourneyUi = {
  chapter: number
  burst: boolean
  panel: { chapter: number; t: number } | null
  ended: boolean
}

const T_STEPS = 40
const END_AT = 0.985

function uiAt(progress: number): JourneyUi {
  const s = journeyStateAt(progress)
  return {
    chapter: s.chapter,
    burst: s.burst !== null,
    panel: s.panel
      ? { chapter: s.panel.chapter, t: Math.round(s.panel.t * T_STEPS) / T_STEPS }
      : null,
    ended: s.progress >= END_AT,
  }
}

function same(a: JourneyUi, b: JourneyUi): boolean {
  return (
    a.chapter === b.chapter &&
    a.burst === b.burst &&
    a.ended === b.ended &&
    (a.panel === b.panel ||
      (a.panel !== null && b.panel !== null && a.panel.chapter === b.panel.chapter && a.panel.t === b.panel.t))
  )
}

/**
 * DOM-side journey state: derives panel/burst UI from the RAW progress ref on
 * scroll (never the damped canvas value — panels must not lag the finger).
 * Quantizing panel.t caps re-renders at T_STEPS per panel window.
 */
export function useJourneyUi(progressRef: MutableRefObject<number>): JourneyUi {
  const [ui, setUi] = useState<JourneyUi>(() => uiAt(progressRef.current))

  useEffect(() => {
    const compute = () => {
      const next = uiAt(progressRef.current)
      setUi((prev) => (same(prev, next) ? prev : next))
    }
    compute()
    window.addEventListener('scroll', compute, { passive: true })
    return () => window.removeEventListener('scroll', compute)
  }, [progressRef])

  return ui
}
```

- [ ] **Step 4: Run the hook tests** — PASS.

- [ ] **Step 5: `overlay/speed-lines.tsx`** — radial manga speed lines flashing at frame edges during the burst:

```tsx
'use client'

/** Radial manga speed-lines at the frame edges; pure CSS, GPU-cheap. */
export function SpeedLines({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: active ? 1 : 0,
        transition: 'opacity 160ms ease-out',
        background:
          'repeating-conic-gradient(from 0deg at 50% 46%, rgba(43,43,51,0.85) 0deg 1.2deg, transparent 1.2deg 7deg)',
        WebkitMaskImage: 'radial-gradient(ellipse at 50% 46%, transparent 42%, black 78%)',
        maskImage: 'radial-gradient(ellipse at 50% 46%, transparent 42%, black 78%)',
      }}
    />
  )
}
```

- [ ] **Step 6: Mount the overlay layer** in `small-world-experience.tsx` — inside the sticky div, after the scene:

```tsx
<div style={{ position: 'sticky', top: 0, height: '100dvh' }}>
  <SmallWorldScene progressRef={progressRef} />
  <OverlayLayer progressRef={progressRef} />
</div>
```

with, in the same file:

```tsx
function OverlayLayer({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const ui = useJourneyUi(progressRef)
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <SpeedLines active={ui.burst} />
    </div>
  )
}
```

(Task 9 extends OverlayLayer with panels; keep it in this file only if it stays small — Task 9 moves it out.)

- [ ] **Step 7: Verify** — full lab unit suite + build green; capture at progress `0.098` shows the radial lines flashing around the frame edge.

- [ ] **Step 8: Commit**

```bash
git add components/labs/small-world __tests__/labs/small-world/use-journey-ui.test.tsx
git commit -m "feat(labs/small-world): journey UI bridge and burst speed lines"
```

---

### Task 9: Comic panel overlay — chapter panels, end panel, tap-to-advance, fonts

**Files:**
- Create: `components/labs/small-world/overlay/journey-overlay.tsx`
- Create: `components/labs/small-world/overlay/chapter-panels.tsx`
- Create: `components/labs/small-world/overlay/end-panel.tsx`
- Modify: `components/labs/small-world/art-manifest.ts` (`panelArtSrc`)
- Modify: `components/labs/small-world/small-world-experience.tsx` (replace OverlayLayer, add advanceTo)
- Modify: `app/labs/small-world/page.tsx` (next/font)
- Test: `__tests__/labs/small-world/art-manifest.test.ts` (append), `__tests__/labs/small-world/journey-overlay.test.tsx`

**Interfaces:**
- Produces: `panelArtSrc(chapterId: string): string | null` (manifest-gated `/labs/small-world/panels/<id>-1.png`); `<JourneyOverlay progressRef onAdvance />`; CSS vars `--sw-font-display` (Baloo 2), `--sw-font-panel` (Bangers), `--sw-font-body` (Nunito Sans) set on the page wrapper.
- Consumes: `useJourneyUi`, `SpeedLines`, `chapters`, `easeOutBack`, `siteConfig`/`socialLinks` from `@/lib/constants`, `CHAPTER_COUNT`.
- Copy rule: the data panel renders `chapter.role` verbatim from data — never synthesize titles.

- [ ] **Step 1: Failing tests.** Append to `__tests__/labs/small-world/art-manifest.test.ts`:

```ts
import { panelArtSrc } from '@/components/labs/small-world/art-manifest'

describe('panelArtSrc', () => {
  it('returns null while panel art is undelivered', () => {
    expect(panelArtSrc('bluenet')).toBeNull()
  })
})
```

New `__tests__/labs/small-world/journey-overlay.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { JourneyOverlay } from '@/components/labs/small-world/overlay/journey-overlay'
import { chapters } from '@/components/labs/small-world/chapters'

const fireScroll = () => act(() => { window.dispatchEvent(new Event('scroll')) })

describe('JourneyOverlay', () => {
  it('shows nothing during travel', () => {
    render(<JourneyOverlay progressRef={{ current: 0.03 }} onAdvance={() => {}} />)
    expect(screen.queryByTestId('sw-panel-data')).toBeNull()
  })

  it('shows the chapter data panel inside the panel window', () => {
    const ref = { current: 0 }
    render(<JourneyOverlay progressRef={ref} onAdvance={() => {}} />)
    ref.current = 0.8 / 6
    fireScroll()
    const panel = screen.getByTestId('sw-panel-data')
    expect(panel.textContent).toContain(chapters[0].company)
    expect(panel.textContent).toContain(chapters[0].role)
    expect(panel.textContent).toContain(chapters[0].period)
  })

  it('advances to the next chapter on tap', () => {
    const ref = { current: 0.8 / 6 }
    const onAdvance = vi.fn()
    render(<JourneyOverlay progressRef={ref} onAdvance={onAdvance} />)
    screen.getByTestId('sw-panel-tap').click()
    expect(onAdvance).toHaveBeenCalledWith(1 / 6)
  })

  it('shows the to-be-continued end panel at the journey end', () => {
    const ref = { current: 0 }
    render(<JourneyOverlay progressRef={ref} onAdvance={() => {}} />)
    ref.current = 1
    fireScroll()
    expect(screen.getByTestId('sw-panel-end').textContent?.toLowerCase()).toContain('to be continued')
  })
})
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: `panelArtSrc` in `art-manifest.ts`** (append; DELIVERED_ART stays the single gate):

```ts
/** Panel art ships as public/labs/small-world/panels/<chapterId>-1.png,
 * gated by a `panel-<chapterId>` entry in DELIVERED_ART. */
export function panelArtSrc(chapterId: string): string | null {
  return DELIVERED_ART.has(`panel-${chapterId}`)
    ? `/labs/small-world/panels/${chapterId}-1.png`
    : null
}
```

- [ ] **Step 4: `overlay/chapter-panels.tsx`** — the tilted comic composition. Art card (generated art or a procedural placeholder) + typeset data card (real selectable HTML):

```tsx
'use client'
import { panelArtSrc } from '../art-manifest'
import type { Chapter } from '../chapters'
import { easeOutBack } from '../journey-timeline'
import { PALETTE } from '../palette'

const INK_BORDER = `4px solid ${PALETTE.ink}`
const HALFTONE = `radial-gradient(circle, ${PALETTE.ink}18 1px, transparent 1.5px)`

/** One chapter stop's spread: art panel + typeset data panel, comic-tilted. */
export function ChapterPanels({
  chapter,
  index,
  t,
  onAdvance,
}: {
  chapter: Chapter
  index: number
  t: number
  onAdvance: () => void
}) {
  const enter = easeOutBack(Math.min(1, t * 2.2))
  const artSrc = panelArtSrc(chapter.id)
  return (
    <div
      data-testid="sw-panel-tap"
      onClick={onAdvance}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'auto',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'min(3vw, 28px)',
        flexWrap: 'wrap',
        padding: 'min(6vh, 48px) min(4vw, 40px)',
        background: `rgba(43, 43, 51, ${0.35 * Math.min(1, t * 3)})`,
      }}
    >
      <div
        style={{
          width: 'min(38vw, 340px)',
          minWidth: 220,
          aspectRatio: '2 / 3',
          border: INK_BORDER,
          borderRadius: 6,
          boxShadow: `10px 12px 0 ${PALETTE.ink}`,
          background: chapter.accent,
          overflow: 'hidden',
          transform: `translateY(${(1 - enter) * 60}px) rotate(${-3 * enter}deg) scale(${0.85 + 0.15 * enter})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {artSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              backgroundImage: HALFTONE,
              backgroundSize: '9px 9px',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <span style={{ fontFamily: 'var(--sw-font-panel)', fontSize: 'min(18vw, 120px)', color: PALETTE.ink, lineHeight: 1 }}>
              {index + 1}
            </span>
            <span style={{ fontFamily: 'var(--sw-font-body)', fontWeight: 700, color: PALETTE.ink, fontSize: 14 }}>
              {chapter.theme}
            </span>
          </div>
        )}
      </div>

      <article
        data-testid="sw-panel-data"
        style={{
          width: 'min(40vw, 380px)',
          minWidth: 260,
          border: INK_BORDER,
          borderRadius: 6,
          boxShadow: `-8px 12px 0 ${PALETTE.ink}`,
          background: PALETTE.sky,
          backgroundImage: HALFTONE,
          backgroundSize: '9px 9px',
          padding: '20px 22px',
          transform: `translateY(${(1 - enter) * 90}px) rotate(${2 * enter}deg) scale(${0.85 + 0.15 * enter})`,
          color: PALETTE.ink,
          fontFamily: 'var(--sw-font-body)',
        }}
      >
        <p style={{ fontFamily: 'var(--sw-font-panel)', fontSize: 15, letterSpacing: 1, margin: 0, color: PALETTE.blossomDeep }}>
          Chapter {index + 1} · {chapter.period}
        </p>
        <h2 style={{ fontFamily: 'var(--sw-font-display)', fontSize: 30, lineHeight: 1.05, margin: '6px 0 2px' }}>
          {chapter.company}
        </h2>
        <p style={{ fontWeight: 800, margin: '0 0 2px', fontSize: 15 }}>{chapter.role}</p>
        <p style={{ margin: '0 0 10px', fontSize: 12, opacity: 0.75 }}>{chapter.location}</p>
        <p style={{ fontSize: 13.5, lineHeight: 1.45, margin: '0 0 12px' }}>{chapter.description}</p>
        <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 12.5, lineHeight: 1.5 }}>
          {chapter.highlights.slice(0, 3).map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {chapter.technologies.map((tech) => (
            <span
              key={tech}
              style={{
                fontFamily: 'var(--sw-font-panel)',
                fontSize: 12,
                letterSpacing: 0.8,
                padding: '3px 9px',
                borderRadius: 999,
                border: `2px solid ${PALETTE.ink}`,
                background: chapter.accent,
              }}
            >
              {tech}
            </span>
          ))}
        </div>
      </article>
    </div>
  )
}
```

- [ ] **Step 5: `overlay/end-panel.tsx`** — "to be continued…" with contact links (real anchors, selectable):

```tsx
'use client'
import { siteConfig, socialLinks } from '@/lib/constants'
import { PALETTE } from '../palette'

export function EndPanel() {
  return (
    <div
      data-testid="sw-panel-end"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(43, 43, 51, 0.4)',
      }}
    >
      <div
        style={{
          border: `4px solid ${PALETTE.ink}`,
          borderRadius: 6,
          boxShadow: `10px 12px 0 ${PALETTE.ink}`,
          background: PALETTE.horizon,
          padding: '34px 42px',
          textAlign: 'center',
          transform: 'rotate(-2deg)',
          color: PALETTE.ink,
        }}
      >
        <p style={{ fontFamily: 'var(--sw-font-panel)', fontSize: 34, letterSpacing: 2, margin: '0 0 6px' }}>
          To be continued…
        </p>
        <p style={{ fontFamily: 'var(--sw-font-body)', fontSize: 14, margin: '0 0 18px' }}>
          The next chapter is unwritten. Say hi:
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={`mailto:${siteConfig.email}`} style={linkStyle(PALETTE.honey)}>Email</a>
          {socialLinks.map((l) => (
            <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer" style={linkStyle(PALETTE.blossom)}>
              {l.name}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

function linkStyle(bg: string): React.CSSProperties {
  return {
    fontFamily: 'var(--sw-font-display)',
    fontWeight: 700,
    fontSize: 14,
    color: PALETTE.ink,
    textDecoration: 'none',
    padding: '8px 18px',
    borderRadius: 999,
    border: `3px solid ${PALETTE.ink}`,
    background: bg,
  }
}
```

(Add `import type * as React from 'react'` if the CSSProperties reference needs it.)

- [ ] **Step 6: `overlay/journey-overlay.tsx`** — composition root:

```tsx
'use client'
import type { MutableRefObject } from 'react'
import { CHAPTER_COUNT, chapters } from '../chapters'
import { ChapterPanels } from './chapter-panels'
import { EndPanel } from './end-panel'
import { SpeedLines } from './speed-lines'
import { useJourneyUi } from './use-journey-ui'

/** Everything DOM above the canvas: speed lines, chapter panels, ending. */
export function JourneyOverlay({
  progressRef,
  onAdvance,
}: {
  progressRef: MutableRefObject<number>
  onAdvance: (targetProgress: number) => void
}) {
  const ui = useJourneyUi(progressRef)
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <SpeedLines active={ui.burst} />
      {ui.panel && !ui.ended && (
        <ChapterPanels
          chapter={chapters[ui.panel.chapter]}
          index={ui.panel.chapter}
          t={ui.panel.t}
          onAdvance={() => onAdvance((ui.panel!.chapter + 1) / CHAPTER_COUNT)}
        />
      )}
      {ui.ended && <EndPanel />}
    </div>
  )
}
```

(`CHAPTER_COUNT` import comes from `../chapters` — same module the timeline uses.)

- [ ] **Step 7: Wire into `small-world-experience.tsx`** — replace Task 8's inline OverlayLayer:

```tsx
const advanceTo = (p: number) => {
  const el = trackRef.current
  if (!el) return
  const total = el.scrollHeight - window.innerHeight
  const top = el.getBoundingClientRect().top + window.scrollY
  window.scrollTo({ top: top + p * total, behavior: 'smooth' })
}
```

```tsx
<div style={{ position: 'sticky', top: 0, height: '100dvh' }}>
  <SmallWorldScene progressRef={progressRef} />
  <JourneyOverlay progressRef={progressRef} onAdvance={advanceTo} />
</div>
```

(Delete the Task-8 `OverlayLayer` and its SpeedLines import — `JourneyOverlay` owns them now.)

- [ ] **Step 8: Fonts in `app/labs/small-world/page.tsx`**

```tsx
import { Baloo_2, Bangers, Nunito_Sans } from 'next/font/google'

const displayFont = Baloo_2({ subsets: ['latin'], weight: ['600', '700'], variable: '--sw-font-display' })
const panelFont = Bangers({ subsets: ['latin'], weight: '400', variable: '--sw-font-panel' })
const bodyFont = Nunito_Sans({ subsets: ['latin'], variable: '--sw-font-body' })

export default function SmallWorldLabPage() {
  return (
    <GalleryChrome>
      <div className={`${displayFont.variable} ${panelFont.variable} ${bodyFont.variable}`}>
        <FallbackTimeline />
        <SmallWorldLoader />
      </div>
    </GalleryChrome>
  )
}
```

- [ ] **Step 9: Verify** — `pnpm vitest __tests__/labs/small-world --run` PASS; `pnpm build` green; capture at progress `0.8/6 ≈ 0.133` (chapter 1 panel) and `1.0` (end panel). Eyeball: tilted ink-bordered cards, halftone texture, Bangers badges, selectable text, placeholder art card carrying the chapter number + theme.

- [ ] **Step 10: Commit**

```bash
git add components/labs/small-world app/labs/small-world __tests__/labs/small-world
git commit -m "feat(labs/small-world): comic panel overlay, end panel, tap-to-advance, fonts"
```

---

### Task 10: Poster, museum manifest entry, OG image

**Files:**
- Create: `scripts/posters/small-world-poster.html`
- Create: `scripts/posters/capture-small-world.mjs`
- Create: `public/labs/small-world/poster.jpg` (generated)
- Modify: `lib/labs-manifest.ts`
- Modify: `app/labs/small-world/page.tsx` (re-add OG images)

- [ ] **Step 1: `scripts/posters/small-world-poster.html`** — CSS-illustrated portrait poster (768×1024): butter-cream→pink sky, big clay planet arc at the bottom with hill bands, blossom dots, the girl as simple CSS shapes in her NEW outfit (pink open shirt, black tank, pink galife trousers), title lockup:

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Bangers&display=swap" rel="stylesheet" />
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 768px; height: 1024px; overflow: hidden; position: relative;
    background: linear-gradient(180deg, #FFF3D6 0%, #FFF3D6 46%, #FFE3EC 78%, #F7A8C4 100%); }
  .planet { position: absolute; left: 50%; bottom: -620px; transform: translateX(-50%);
    width: 1100px; height: 1100px; border-radius: 50%;
    background: radial-gradient(circle at 50% 18%, #A8DCA0 0%, #7BC47F 42%, #4E9A51 100%);
    box-shadow: 0 -14px 0 #4E9A51 inset; }
  .hill { position: absolute; border-radius: 50%; background: #A8DCA0; }
  .hill.a { width: 300px; height: 120px; left: 60px; bottom: 400px; }
  .hill.b { width: 380px; height: 150px; right: 30px; bottom: 360px; background: #7BC47F; }
  .river { position: absolute; width: 200px; height: 70px; border-radius: 50%;
    background: #6FB7D9; left: 300px; bottom: 330px; box-shadow: 0 6px 0 #4E9EC7 inset; }
  .blossom { position: absolute; width: 26px; height: 26px; border-radius: 50%; background: #F7A8C4;
    box-shadow: 0 4px 0 #E86FA4 inset; }
  .girl { position: absolute; left: 50%; bottom: 470px; transform: translateX(-50%); width: 120px; }
  .girl .head { width: 74px; height: 68px; border-radius: 50%; background: #F3C6A5; margin: 0 auto; position: relative; }
  .girl .hair { position: absolute; top: -12px; left: -8px; width: 90px; height: 52px;
    border-radius: 50% 50% 40% 40%; background: #C9A86A; }
  .girl .shades { position: absolute; top: 24px; left: 8px; width: 58px; height: 18px; border-radius: 10px;
    background: linear-gradient(120deg, #e8e8f2, #9aa0b4 60%, #dfe3ee); border: 3px solid #2B2B33; }
  .girl .torso { width: 60px; height: 54px; margin: -4px auto 0; background: #2B2B33; border-radius: 12px; position: relative; }
  .girl .shirt-l, .girl .shirt-r { position: absolute; top: 0; width: 22px; height: 54px; background: #F7A8C4;
    border: 3px solid #2B2B33; }
  .girl .shirt-l { left: -14px; border-radius: 10px 4px 4px 10px; }
  .girl .shirt-r { right: -14px; border-radius: 4px 10px 10px 4px; }
  .girl .pants { width: 74px; height: 46px; margin: -2px auto 0; background: #E86FA4;
    border-radius: 26px 26px 10px 10px; }
  .girl .shoe-l, .girl .shoe-r { width: 24px; height: 12px; background: #fff; border: 3px solid #2B2B33;
    border-radius: 8px; display: inline-block; margin: -2px 4px 0; }
  .shoes { text-align: center; }
  h1 { position: absolute; top: 84px; width: 100%; text-align: center;
    font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 92px; color: #2B2B33; letter-spacing: 1px; }
  .sub { position: absolute; top: 196px; width: 100%; text-align: center;
    font-family: 'Bangers', cursive; font-size: 30px; color: #E86FA4; letter-spacing: 3px; }
</style>
</head>
<body>
  <h1>Small World</h1>
  <div class="sub">ONE LAP OF IT IS A CAREER</div>
  <div class="planet"></div>
  <div class="hill a"></div>
  <div class="hill b"></div>
  <div class="river"></div>
  <div class="blossom" style="left:130px; bottom:430px"></div>
  <div class="blossom" style="left:210px; bottom:390px; width:20px; height:20px"></div>
  <div class="blossom" style="right:150px; bottom:440px"></div>
  <div class="blossom" style="right:240px; bottom:395px; width:18px; height:18px"></div>
  <div class="girl">
    <div class="head"><div class="hair"></div><div class="shades"></div></div>
    <div class="torso"><div class="shirt-l"></div><div class="shirt-r"></div></div>
    <div class="pants"></div>
    <div class="shoes"><span class="shoe-l"></span><span class="shoe-r"></span></div>
  </div>
</body>
</html>
```

(Skin/hair/chrome tones are poster-art literals like every other poster HTML in `scripts/posters/` — the palette rule binds scene code, not the poster stills.)

- [ ] **Step 2: `scripts/posters/capture-small-world.mjs`** (same pattern as capture-snowpark.mjs):

```js
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const dir = path.dirname(fileURLToPath(import.meta.url))
const html = path.join(dir, 'small-world-poster.html')
const out = path.join(dir, '..', '..', 'public', 'labs', 'small-world', 'poster.jpg')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 768, height: 1024 } })
await page.goto('file://' + html.replace(/\\/g, '/'))
await page.waitForTimeout(600) // webfonts
await page.screenshot({ path: out, type: 'jpeg', quality: 80 })
await browser.close()
```

Run: `node scripts/posters/capture-small-world.mjs` → verify `public/labs/small-world/poster.jpg` exists and is ≤200 KB (`Get-Item public/labs/small-world/poster.jpg | Select-Object Length`). Look at the JPEG before committing.

- [ ] **Step 3: Manifest entry** — append to `labs` in `lib/labs-manifest.ts`:

```ts
{
  slug: 'small-world',
  title: 'Small World',
  date: '2026-07-16',
  thesis:
    'A clay planet small enough to walk in an afternoon — every lap of it is a career. A cartoon girl skips through six chapters as the world resculpts itself under her feet.',
  status: 'wip',
},
```

- [ ] **Step 4: OG image** — in `app/labs/small-world/page.tsx` metadata, replace the poster comment:

```ts
openGraph: {
  title: 'Small World — Style Lab',
  description: 'A clay planet small enough to walk in an afternoon — every lap of it is a career.',
  images: [{ url: '/labs/small-world/poster.jpg', width: 768, height: 1024 }],
},
```

- [ ] **Step 5: Verify** — `pnpm test:unit` PASS (museum/curator suites read the manifest — if any snapshot-ish count assertions fail, update them to include the new wip entry ONLY where the test's intent is "lists all hall labs"); `pnpm build` green.

- [ ] **Step 6: Commit**

```bash
git add scripts/posters public/labs/small-world/poster.jpg lib/labs-manifest.ts app/labs/small-world/page.tsx
git commit -m "feat(labs/small-world): museum poster, manifest entry (wip), OG image"
```

---

### Task 11: E2E expansion — panels at anchors, ending, mobile

**Files:**
- Modify: `e2e/labs-small-world.spec.ts`

The 3D scene only activates with WebGL; Playwright's browser builds vary. Gate the overlay tests on a runtime capability check — a skipped webkit is honest, a red webkit is noise.

- [ ] **Step 1: Append to `e2e/labs-small-world.spec.ts`**

```ts
async function webglAvailable(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => {
    try {
      const c = document.createElement('canvas')
      return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
    } catch {
      return false
    }
  })
}

async function scrollToProgress(page: import('@playwright/test').Page, progress: number) {
  await page.evaluate((p) => {
    const total = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, total * p)
  }, progress)
}

test('comic panel opens at the first discovery stop', async ({ page }) => {
  await page.goto('/labs/small-world')
  test.skip(!(await webglAvailable(page)), 'no WebGL in this browser build')
  await scrollToProgress(page, 0.8 / 6)
  const panel = page.getByTestId('sw-panel-data')
  await expect(panel).toBeVisible({ timeout: 10_000 })
  await expect(panel).toContainText('BlueNet')
  await expect(panel).toContainText('Chapter 1')
})

test('panel dismisses when scrolling on', async ({ page }) => {
  await page.goto('/labs/small-world')
  test.skip(!(await webglAvailable(page)), 'no WebGL in this browser build')
  await scrollToProgress(page, 0.8 / 6)
  await expect(page.getByTestId('sw-panel-data')).toBeVisible({ timeout: 10_000 })
  await scrollToProgress(page, 1.2 / 6)
  await expect(page.getByTestId('sw-panel-data')).toBeHidden()
})

test('the journey ends on to-be-continued with contact links', async ({ page }) => {
  await page.goto('/labs/small-world')
  test.skip(!(await webglAvailable(page)), 'no WebGL in this browser build')
  await scrollToProgress(page, 1)
  const end = page.getByTestId('sw-panel-end')
  await expect(end).toBeVisible({ timeout: 10_000 })
  await expect(end).toContainText(/to be continued/i)
  await expect(end.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', /github\.com/)
})
```

(If the file's existing tests use a shared `test`/`expect` import from `@playwright/test`, reuse it; keep helpers above the test blocks.)

- [ ] **Step 2: Run the lab e2e across all five projects**

PowerShell: `$env:CI='1'; $env:E2E_PORT='3117'; pnpm test:e2e e2e/labs-small-world.spec.ts`
Expected: existing 3 tests + new 3 pass (or skip cleanly where WebGL is absent) on chromium, firefox, webkit, mobile-chrome, mobile-safari. `rm -rf .next` first if the dev server was previously started in another mode.

- [ ] **Step 3: Commit**

```bash
git add e2e/labs-small-world.spec.ts
git commit -m "test(labs/small-world): e2e for panel anchors, dismissal, journey ending"
```

---

### Task 12 (asset-triggered — run ONLY when Aram delivers `girl.glb`)

**Files:**
- Modify: `components/labs/small-world/art-manifest.ts` (add `'girl'` to DELIVERED_ART)
- Modify: `components/labs/small-world/scene/girl.tsx` (bind real clip names, discovery/wave clips)
- Test: `__tests__/labs/small-world/art-manifest.test.ts` (flip the girl gate assertion)

Steps depend on the delivered clip names — the orchestrator writes a fresh task brief when the file lands (record clip names from Aram's delivery note; verify feet-at-origin; tune `CLIP_STRIDE` against capture; play discovery clip during burst window; re-run the whole suite + a capture deck for the character re-gate). This task is intentionally not pre-scripted: every value in it comes from the asset.

---

## After all tasks

1. Final whole-branch review (most capable model) with a review package from the Phase-2 base commit.
2. `pnpm test:unit`, full `pnpm test:e2e`, `pnpm build` — all green.
3. Gate 2: push branch, Vercel preview for Aram's full-journey verdict. Museum entry stays `wip` until his final gate.

## Self-review notes

- Spec coverage: chapter staging (Tasks 4–6), discovery burst + speed lines (7–8), panels HTML overlay + typeset data panel + end panel (9), museum kit (10), e2e including mobile (11), girl integration deferred to asset delivery (12). Fallback path untouched (Phase 1). Fonts picked: Baloo 2 / Bangers / Nunito Sans (spec's candidates; Gate 2 can veto).
- >360° readiness: every angular constant flows through `CHAPTER_SLICE` / `chapterStartRotation` / `chapterTheta` (Tasks 1, 3).
- Type consistency: `JourneyRef` from use-journey; `Chapter` from chapters.ts; `panelArtSrc` gated on `panel-<id>` manifest keys; `anchorTransform` returns THREE.Vector3/Quaternion consumed by PropAnchor only.
- Mouse-parallax from the spec ("gentle mouse/gyro parallax") is deliberately deferred — it fights the fixed camera contract established in Phase 1 and is a one-file polish item for Gate 2 feedback.
