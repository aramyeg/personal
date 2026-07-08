# Powder Lines (Snowpark Lab) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fully playable 2D snowboarding game at `/labs/snowpark` where every obstacle is a skill from `data/skills.ts`, drawn as pure geometry in a restrained arctic palette, ending in an expedition-log recap.

**Architecture:** Pure, unit-tested simulation modules (course compiler, slope curve, trick scoring, rider state machine) feed an untested-by-unit canvas-2D renderer driven by a fixed-timestep rAF loop. A client shell composes canvas + DOM HUD + recap behind a `prefers-reduced-motion` gate; the server page provides metadata and GalleryChrome. Zero new dependencies.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, canvas 2D, Vitest (unit project, jsdom), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-07-08-labs-snowpark-design.md` — governs on any conflict.

## Suggested model routing (orchestrator)

| Tasks | Model |
|---|---|
| 1, 2, 3 (pure modules with complete code below) | cheap/fast (sonnet) |
| 4 (rider state machine), 5 (input+loop), 6 (renderer), 7 (shell) | capable (opus) |
| 8 (GalleryChrome guard), 9 (manifest+poster), 10 (e2e+gates) | cheap/fast (sonnet) |

## Global Constraints

- Palette, exactly and only: ice `#eef3f6`; glacial blues `#b8d4e2`, `#6e9cb4`, `#2e5468`; polar ink `#122630`; single amber accent `#d9a441`. All colors come from `components/labs/snowpark/palette.ts` — no other hex anywhere in the lab.
- Amber is reserved for: the sun disc, the score, collected-skill moments. Nothing else is colored.
- Banned: gradients as decoration, glows/shadowBlur, lavender/peach/mint pastels, particle confetti, emoji in game copy, hype microcopy ("EPIC!", "🔥"). Copy is factual and dry, lowercase where shown below.
- Exact copy strings (verbatim, defined once and imported): bail line `washed out — press R to retry the section`; collect card format `360 Nose Grab — TypeScript · 6 yrs · expert`; recap buttons `run it back` and `← gallery`; reduced-motion button `start the run anyway`.
- Content comes only from `data/skills.ts` (`skills`, `skillCategories`); `fun` category excluded. No invented skills, no inflated titles.
- Zero new dependencies — do not touch `package.json`.
- Landing tolerance is ±35° of slope tangent (spec value).
- Snow particles: sparse drifting dots, hard count cap (≤ 60).
- The lab owns the full viewport; site theme does not apply inside it.
- REQUIRED HARDENING: the game's Esc handler pauses and calls `e.preventDefault()`; `components/labs/gallery-chrome.tsx` gains `if (e.defaultPrevented) return`, with a unit test (Task 8).
- Immutability: all sim step functions return new objects, never mutate inputs (project rule; also enables trivial testing).
- No `console.log` in committed code.
- Commit prefix: `feat(snowpark): …` (tests may use `test(snowpark): …`).
- New-lab conventions: manifest entry in `lib/labs-manifest.ts`, poster `public/labs/snowpark/poster.jpg` (portrait 768×1024, ≤ 200 KB, generator committed to `scripts/posters/`), page wrapped in `GalleryChrome`, own OG metadata.

## File structure

```
components/labs/snowpark/
  palette.ts        — arctic tokens (Task 1)
  course.ts         — pure: skills → stretches + obstacles (Task 1)
  slope.ts          — pure: master curve, gradient, angle, advance (Task 2)
  tricks.ts         — pure: trick names, scoring, combo, collect line (Task 3)
  rider.ts          — pure: state machine step snow/air/grind/bail/finish (Task 4)
  input.ts          — keyboard + touch → intent flags (Task 5)
  use-game-loop.ts  — fixed-timestep rAF loop, pause/visibility (Task 5)
  renderer.ts       — canvas draw: parallax, terrain ribbon, obstacles, rider, trail, snow (Task 6)
  snowpark-game.tsx — client shell: canvas + HUD + pause + recap + reduced-motion gate (Task 7)
  game-loader.tsx   — 'use client' dynamic(ssr:false) wrapper (Task 7)
app/labs/snowpark/page.tsx — server page: metadata/OG + GalleryChrome + loader (Task 7)
components/labs/gallery-chrome.tsx — defaultPrevented guard (Task 8)
lib/labs-manifest.ts — new entry (Task 9)
scripts/posters/snowpark-poster.html + capture-snowpark.mjs — poster generator (Task 9)
public/labs/snowpark/poster.jpg — poster (Task 9)
e2e/labs-snowpark.spec.ts — smoke (Task 10)
__tests__/labs/snowpark/{course,slope,tricks,rider}.test.ts
__tests__/labs/gallery-chrome.test.tsx
```

World coordinate convention (used by every module): **x increases in the direction of travel, y increases downward** (canvas convention). A descending slope therefore has positive gradient. Angles in radians internally; degrees only in trick rotation and the ±35° tolerance.

---

### Task 1: Palette and course compiler

**Files:**
- Create: `components/labs/snowpark/palette.ts`
- Create: `components/labs/snowpark/course.ts`
- Test: `__tests__/labs/snowpark/course.test.ts`

**Interfaces:**
- Consumes: `Skill`, `SkillCategory` from `@/types`; `skills`, `skillCategories` from `@/data/skills`.
- Produces: `palette` const; `ObstacleType`, `CourseObstacle`, `Stretch`, `Course` types; `compileCourse(source?: Skill[]): Course`; constants `START_X`, `OBSTACLE_SPACING`, `STRETCH_GAP`, `OBSTACLE_LENGTH`.

- [ ] **Step 1: Write palette.ts** (no test needed — constant object)

```ts
/** Arctic palette for the Powder Lines lab — the single source of color. */
export const palette = {
  /** background ice field */
  ice: '#eef3f6',
  /** glacial blues — far / mid / near terrain lines */
  bluePale: '#b8d4e2',
  blueMid: '#6e9cb4',
  blueDeep: '#2e5468',
  /** polar ink — rider, obstacle strokes, all type */
  ink: '#122630',
  /** the one accent — sun disc, score, collected-skill moments */
  amber: '#d9a441',
} as const
```

- [ ] **Step 2: Write the failing course tests**

`__tests__/labs/snowpark/course.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Skill } from '@/types'
import { skills } from '@/data/skills'
import {
  compileCourse,
  OBSTACLE_LENGTH,
  OBSTACLE_SPACING,
  START_X,
} from '@/components/labs/snowpark/course'

describe('compileCourse', () => {
  const course = compileCourse()

  it('creates exactly one obstacle per skill (fun excluded)', () => {
    expect(course.obstacles).toHaveLength(skills.length)
  })

  it('assigns kickers to expert skills and rail/box alternation to the rest', () => {
    for (const o of course.obstacles) {
      if (o.skill.level === 'expert') expect(o.type).toBe('kicker')
      else expect(['rail', 'box']).toContain(o.type)
    }
    const nonExpert = course.obstacles.filter((o) => o.skill.level !== 'expert')
    nonExpert.forEach((o, i) => {
      expect(o.type).toBe(i % 2 === 0 ? 'rail' : 'box')
    })
  })

  it('groups by category into named stretches in skillCategories order', () => {
    expect(course.stretches.map((s) => s.name)).toEqual([
      'frontend face',
      'mobile ridge',
      'state park',
      'styling bowl',
      'backend flats',
      'tooling run-out',
    ])
    for (const stretch of course.stretches) {
      const inside = course.obstacles.filter((o) => o.stretchName === stretch.name)
      expect(inside.length).toBeGreaterThan(0)
      for (const o of inside) expect(o.skill.category).toBe(stretch.category)
    }
  })

  it('places obstacles at strictly increasing x with the finish beyond the last', () => {
    const xs = course.obstacles.map((o) => o.x)
    expect(xs[0]).toBe(START_X)
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1])
    const last = course.obstacles[course.obstacles.length - 1]
    expect(course.finishX).toBeGreaterThan(last.x + last.length)
  })

  it('adding a skill to the source adds an obstacle', () => {
    const extra: Skill = { name: 'Vitest', years: 2, category: 'tools', level: 'advanced' }
    const bigger = compileCourse([...skills, extra])
    expect(bigger.obstacles).toHaveLength(skills.length + 1)
    expect(bigger.obstacles.some((o) => o.skill.name === 'Vitest')).toBe(true)
  })

  it('uses the fixed lengths per obstacle type', () => {
    for (const o of course.obstacles) expect(o.length).toBe(OBSTACLE_LENGTH[o.type])
    expect(OBSTACLE_SPACING).toBeGreaterThan(Math.max(...Object.values(OBSTACLE_LENGTH)))
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest --project unit __tests__/labs/snowpark/course.test.ts --run`
Expected: FAIL — cannot resolve `@/components/labs/snowpark/course`.

- [ ] **Step 4: Implement course.ts**

```ts
import type { Skill, SkillCategory } from '@/types'
import { skillCategories, skills } from '@/data/skills'

export type ObstacleType = 'kicker' | 'rail' | 'box'

export type CourseObstacle = {
  skill: Skill
  type: ObstacleType
  /** world x where the obstacle begins */
  x: number
  /** world length along x */
  length: number
  stretchName: string
}

export type Stretch = {
  name: string
  category: SkillCategory
  startX: number
  endX: number
}

export type Course = {
  obstacles: CourseObstacle[]
  stretches: Stretch[]
  /** x of the finish banner */
  finishX: number
}

export const START_X = 800
export const OBSTACLE_SPACING = 1000
export const STRETCH_GAP = 600
export const OBSTACLE_LENGTH: Record<ObstacleType, number> = {
  kicker: 120,
  rail: 220,
  box: 180,
}

const STRETCH_NAMES: Record<Exclude<SkillCategory, 'fun'>, string> = {
  frontend: 'frontend face',
  mobile: 'mobile ridge',
  state: 'state park',
  styling: 'styling bowl',
  backend: 'backend flats',
  tools: 'tooling run-out',
}

/** One obstacle per skill: experts get kickers; the rest alternate rail/box. */
export function compileCourse(source: Skill[] = skills): Course {
  const obstacles: CourseObstacle[] = []
  const stretches: Stretch[] = []
  let cursor = START_X
  let nonExpertCount = 0

  for (const { id } of skillCategories) {
    if (id === 'fun') continue
    const group = source.filter((s) => s.category === id)
    if (group.length === 0) continue
    const name = STRETCH_NAMES[id]
    const startX = cursor

    for (const skill of group) {
      const type: ObstacleType =
        skill.level === 'expert' ? 'kicker' : nonExpertCount % 2 === 0 ? 'rail' : 'box'
      if (skill.level !== 'expert') nonExpertCount += 1
      obstacles.push({ skill, type, x: cursor, length: OBSTACLE_LENGTH[type], stretchName: name })
      cursor += OBSTACLE_SPACING
    }

    stretches.push({ name, category: id, startX, endX: cursor })
    cursor += STRETCH_GAP
  }

  return { obstacles, stretches, finishX: cursor + 600 }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest --project unit __tests__/labs/snowpark/course.test.ts --run`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add components/labs/snowpark/palette.ts components/labs/snowpark/course.ts __tests__/labs/snowpark/course.test.ts
git commit -m "feat(snowpark): arctic palette and skills-to-course compiler"
```

Sanity note for the implementer: with the real 23 skills this yields ~23×1000 + 5×600 + 800 + 600 ≈ 27,400 world units — ≈ 90 s at the rider's ~300 u/s cruise, per spec.

---

### Task 2: Slope curve

**Files:**
- Create: `components/labs/snowpark/slope.ts`
- Test: `__tests__/labs/snowpark/slope.test.ts`

**Interfaces:**
- Consumes: nothing (pure math).
- Produces: `slopeY(x: number): number`, `slopeGradient(x: number): number`, `slopeAngle(x: number): number` (radians), `advanceAlongSlope(x: number, ds: number): number`.

- [ ] **Step 1: Write the failing tests**

`__tests__/labs/snowpark/slope.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  advanceAlongSlope,
  slopeAngle,
  slopeGradient,
  slopeY,
} from '@/components/labs/snowpark/slope'

describe('slope', () => {
  it('is deterministic', () => {
    expect(slopeY(1234)).toBe(slopeY(1234))
  })

  it('descends overall (y grows downward with x)', () => {
    expect(slopeY(10_000)).toBeGreaterThan(slopeY(0))
  })

  it('gradient matches the numeric derivative of slopeY', () => {
    const h = 0.001
    for (const x of [0, 137, 999, 5_000, 20_000]) {
      const numeric = (slopeY(x + h) - slopeY(x - h)) / (2 * h)
      expect(slopeGradient(x)).toBeCloseTo(numeric, 3)
    }
  })

  it('angle is atan of the gradient, always within (-90deg, 90deg)', () => {
    for (const x of [0, 512, 3_000, 15_000]) {
      expect(slopeAngle(x)).toBeCloseTo(Math.atan(slopeGradient(x)), 10)
      expect(Math.abs(slopeAngle(x))).toBeLessThan(Math.PI / 2)
    }
  })

  it('advanceAlongSlope always moves forward for positive ds', () => {
    for (const x of [0, 800, 9_999]) {
      expect(advanceAlongSlope(x, 5)).toBeGreaterThan(x)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest --project unit __tests__/labs/snowpark/slope.test.ts --run`
Expected: FAIL — cannot resolve `@/components/labs/snowpark/slope`.

- [ ] **Step 3: Implement slope.ts**

```ts
/**
 * The mountain master curve. World coords: x increases in the direction of
 * travel, y increases DOWNWARD (canvas convention) — a descending slope has
 * positive gradient. One base grade plus two long sine waves gives rolling
 * terrain without ever tipping past vertical.
 */
const BASE_GRADE = 0.32
const WAVE_A = { amp: 60, wavelength: 210 }
const WAVE_B = { amp: 30, wavelength: 97, phase: 1.7 }

export function slopeY(x: number): number {
  return (
    BASE_GRADE * x +
    WAVE_A.amp * Math.sin(x / WAVE_A.wavelength) +
    WAVE_B.amp * Math.sin(x / WAVE_B.wavelength + WAVE_B.phase)
  )
}

export function slopeGradient(x: number): number {
  return (
    BASE_GRADE +
    (WAVE_A.amp / WAVE_A.wavelength) * Math.cos(x / WAVE_A.wavelength) +
    (WAVE_B.amp / WAVE_B.wavelength) * Math.cos(x / WAVE_B.wavelength + WAVE_B.phase)
  )
}

/** Tangent angle in radians; positive tilts downhill (screen-down). */
export function slopeAngle(x: number): number {
  return Math.atan(slopeGradient(x))
}

/** Advance a distance ds along the curve from x; returns the new x. */
export function advanceAlongSlope(x: number, ds: number): number {
  return x + ds * Math.cos(slopeAngle(x))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest --project unit __tests__/labs/snowpark/slope.test.ts --run`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add components/labs/snowpark/slope.ts __tests__/labs/snowpark/slope.test.ts
git commit -m "feat(snowpark): mountain master curve with gradient and arc advance"
```

---

### Task 3: Tricks — naming, scoring, combo

**Files:**
- Create: `components/labs/snowpark/tricks.ts`
- Test: `__tests__/labs/snowpark/tricks.test.ts`

**Interfaces:**
- Consumes: `Skill` from `@/types`.
- Produces: `TrickInput` type; `trickName(t: TrickInput): string`; `trickScore(t: TrickInput, years: number, combo: number): number`; `nextCombo(combo: number, clean: boolean): number`; `collectLine(name: string, skill: Skill): string`; constants `BASE_TRICK`, `PER_180`, `GRAB_BONUS`, `GRIND_PER_UNIT`, `COMBO_STEP`.

- [ ] **Step 1: Write the failing tests**

`__tests__/labs/snowpark/tricks.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Skill } from '@/types'
import {
  BASE_TRICK,
  COMBO_STEP,
  GRAB_BONUS,
  GRIND_PER_UNIT,
  PER_180,
  collectLine,
  nextCombo,
  trickName,
  trickScore,
} from '@/components/labs/snowpark/tricks'

describe('trickName', () => {
  it('composes rotation and grab', () => {
    expect(trickName({ rotationDeg: 360, grab: true, grindLength: 0 })).toBe('360 Nose Grab')
    expect(trickName({ rotationDeg: 180, grab: false, grindLength: 0 })).toBe('180')
    expect(trickName({ rotationDeg: 0, grab: true, grindLength: 0 })).toBe('Nose Grab')
  })

  it('names a plain clean jump an Ollie', () => {
    expect(trickName({ rotationDeg: 0, grab: false, grindLength: 0 })).toBe('Ollie')
  })

  it('appends grind', () => {
    expect(trickName({ rotationDeg: 0, grab: false, grindLength: 80 })).toBe('Grind')
    expect(trickName({ rotationDeg: 360, grab: true, grindLength: 80 })).toBe(
      '360 Nose Grab + Grind'
    )
  })
})

describe('trickScore', () => {
  it('is base + rotation + grab + grind, times years, times combo multiplier', () => {
    const t = { rotationDeg: 360, grab: true, grindLength: 50 }
    const raw = BASE_TRICK + 2 * PER_180 + GRAB_BONUS + 50 * GRIND_PER_UNIT
    expect(trickScore(t, 6, 0)).toBe(Math.round(raw * 6))
    expect(trickScore(t, 6, 3)).toBe(Math.round(raw * 6 * (1 + 3 * COMBO_STEP)))
  })

  it('scales with real years', () => {
    const t = { rotationDeg: 180, grab: false, grindLength: 0 }
    expect(trickScore(t, 8, 0)).toBe(4 * trickScore(t, 2, 0))
  })
})

describe('nextCombo', () => {
  it('increments on clean landings and resets on bails', () => {
    expect(nextCombo(0, true)).toBe(1)
    expect(nextCombo(4, true)).toBe(5)
    expect(nextCombo(4, false)).toBe(0)
  })
})

describe('collectLine', () => {
  it('matches the spec trick-card format exactly', () => {
    const ts: Skill = { name: 'TypeScript', years: 6, category: 'frontend', level: 'expert' }
    expect(collectLine('360 Nose Grab', ts)).toBe('360 Nose Grab — TypeScript · 6 yrs · expert')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest --project unit __tests__/labs/snowpark/tricks.test.ts --run`
Expected: FAIL — cannot resolve `@/components/labs/snowpark/tricks`.

- [ ] **Step 3: Implement tricks.ts**

```ts
import type { Skill } from '@/types'

export type TrickInput = {
  /** total rotation in degrees — multiples of 180 */
  rotationDeg: number
  grab: boolean
  /** world units grinded; 0 when none */
  grindLength: number
}

export const BASE_TRICK = 100
export const PER_180 = 150
export const GRAB_BONUS = 120
export const GRIND_PER_UNIT = 2
export const COMBO_STEP = 0.1

export function trickName(t: TrickInput): string {
  const parts: string[] = []
  if (t.rotationDeg > 0) parts.push(String(t.rotationDeg))
  if (t.grab) parts.push('Nose Grab')
  if (t.grindLength > 0) parts.push(parts.length > 0 ? '+ Grind' : 'Grind')
  return parts.length > 0 ? parts.join(' ') : 'Ollie'
}

export function trickScore(t: TrickInput, years: number, combo: number): number {
  const raw =
    BASE_TRICK +
    (t.rotationDeg / 180) * PER_180 +
    (t.grab ? GRAB_BONUS : 0) +
    t.grindLength * GRIND_PER_UNIT
  return Math.round(raw * years * (1 + COMBO_STEP * combo))
}

export function nextCombo(combo: number, clean: boolean): number {
  return clean ? combo + 1 : 0
}

/** Spec trick-card format: `360 Nose Grab — TypeScript · 6 yrs · expert` */
export function collectLine(name: string, skill: Skill): string {
  return `${name} — ${skill.name} · ${skill.years} yrs · ${skill.level}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest --project unit __tests__/labs/snowpark/tricks.test.ts --run`
Expected: PASS (8 tests).

Note: the `scales with real years` test passes exactly because 180 with no grab/grind is `BASE_TRICK + PER_180 = 250`, and `round(250 * 8) === 4 * round(250 * 2)`.

- [ ] **Step 5: Commit**

```bash
git add components/labs/snowpark/tricks.ts __tests__/labs/snowpark/tricks.test.ts
git commit -m "feat(snowpark): trick naming, years-multiplied scoring, combo chain"
```

---

### Task 4: Rider state machine

**Files:**
- Create: `components/labs/snowpark/rider.ts`
- Test: `__tests__/labs/snowpark/rider.test.ts`

**Interfaces:**
- Consumes: `Course`, `CourseObstacle`, `compileCourse` from `./course`; `advanceAlongSlope`, `slopeAngle`, `slopeGradient`, `slopeY` from `./slope`; `collectLine`, `nextCombo`, `trickName`, `trickScore` from `./tricks`; `Skill` from `@/types`.
- Produces (Tasks 5–7 rely on these exact names): `RiderMode`, `RiderInput`, `RiderState`, `CollectEvent` types; `createRider(course: Course): RiderState`; `stepRider(state: RiderState, input: RiderInput, dt: number, course: Course): RiderState`; `obstacleSurfaceY(o: CourseObstacle, x: number): number`; `BAIL_LINE` const; physics constants below.

This is the core of the game and the highest-judgment module. The types, constants, and behavioral contract below are binding; the internal decomposition (helper functions per mode) is the implementer's choice. **Every path must return a new state object — never mutate the input** (project rule).

- [ ] **Step 1: Write the types and constants**

```ts
import type { Course, CourseObstacle } from './course'

export type RiderMode = 'snow' | 'air' | 'grind' | 'bail' | 'finish'

export type RiderInput = {
  jumpHeld: boolean
  /** true only on the frame the key went down */
  jumpPressed: boolean
  spinLeftPressed: boolean
  spinRightPressed: boolean
  grabHeld: boolean
  retryPressed: boolean
}

export type CollectEvent = {
  obstacleIndex: number
  /** spec format: `360 Nose Grab — TypeScript · 6 yrs · expert` */
  line: string
  points: number
}

export type RiderState = {
  mode: RiderMode
  x: number
  y: number
  /** velocity while airborne (u/s); meaningless on snow */
  vx: number
  vy: number
  /** along-slope speed while on snow or grinding (u/s) */
  speed: number
  /** jump charge 0..1, accumulates while jumpHeld on snow */
  charge: number
  /** rotation progressed so far this air (deg) */
  rotationDeg: number
  /** rotation queued by spin presses this air (deg, multiple of 180) */
  targetRotationDeg: number
  /** grab currently held (drawn by renderer) */
  grabbing: boolean
  /** grab was held at any point this air (counts for the trick) */
  grabHappened: boolean
  /** board orientation at takeoff (deg) — landing compares board vs slope */
  launchAngleDeg: number
  /** obstacle this air/grind is attributed to, or null */
  attributedObstacle: number | null
  grindLength: number
  bailTimer: number
  /** index of the first obstacle not yet passed */
  nextObstacle: number
  collected: boolean[]
  combo: number
  score: number
  bestTrick: { name: string; points: number } | null
  /** set on a clean scored landing; shell shows it then clears it */
  lastEvent: CollectEvent | null
  /** shell shows BAIL_LINE while true; cleared on respawn */
  bailed: boolean
  time: number
}

export const GRAVITY = 1500
export const ACCEL = 520
export const DRAG = 60
export const MIN_SPEED = 150
export const MAX_SPEED = 430
export const CRUISE_SPEED = 300
export const START_SPEED = 200
export const BASE_POP = 330
export const CHARGE_POP = 300
export const MAX_CHARGE_S = 0.5
export const KICKER_BOOST = 1.45
export const SPIN_RATE = 360
export const LANDING_TOLERANCE_DEG = 35
export const ROTATION_SETTLE_DEG = 20
export const GRIND_SNAP_DIST = 18
export const SURFACE_RAISE = 42
export const BAIL_TIME = 1.2
export const RESPAWN_LEAD = 2 * CRUISE_SPEED
export const GRIND_EXIT_POP = 180

export const BAIL_LINE = 'washed out — press R to retry the section'
```

- [ ] **Step 2: Write the failing tests**

`__tests__/labs/snowpark/rider.test.ts` — these encode the behavioral contract; write them before the step function:

```ts
import { describe, expect, it } from 'vitest'
import { compileCourse } from '@/components/labs/snowpark/course'
import { slopeY } from '@/components/labs/snowpark/slope'
import {
  BAIL_TIME,
  CRUISE_SPEED,
  MAX_SPEED,
  MIN_SPEED,
  RESPAWN_LEAD,
  createRider,
  obstacleSurfaceY,
  stepRider,
  type RiderInput,
  type RiderState,
} from '@/components/labs/snowpark/rider'

const course = compileCourse()

const idle: RiderInput = {
  jumpHeld: false,
  jumpPressed: false,
  spinLeftPressed: false,
  spinRightPressed: false,
  grabHeld: false,
  retryPressed: false,
}

function run(state: RiderState, input: RiderInput, seconds: number): RiderState {
  const dt = 1 / 120
  let s = state
  for (let t = 0; t < seconds; t += dt) s = stepRider(s, input, dt, course)
  return s
}

describe('createRider', () => {
  it('starts on snow at x=0 glued to the slope with one collected slot per obstacle', () => {
    const s = createRider(course)
    expect(s.mode).toBe('snow')
    expect(s.x).toBe(0)
    expect(s.y).toBeCloseTo(slopeY(0), 6)
    expect(s.collected).toHaveLength(course.obstacles.length)
    expect(s.collected.every((c) => c === false)).toBe(true)
    expect(s.score).toBe(0)
  })
})

describe('snow mode', () => {
  it('never mutates the input state', () => {
    const s = createRider(course)
    const frozen = Object.freeze({ ...s, collected: Object.freeze([...s.collected]) })
    expect(() => stepRider(frozen as RiderState, idle, 1 / 60, course)).not.toThrow()
  })

  it('moves forward and stays glued to the slope', () => {
    const s = run(createRider(course), idle, 2)
    expect(s.x).toBeGreaterThan(0)
    expect(s.y).toBeCloseTo(slopeY(s.x), 4)
    expect(s.mode).toBe('snow')
  })

  it('keeps speed within [MIN_SPEED, MAX_SPEED]', () => {
    const s = run(createRider(course), idle, 10)
    expect(s.speed).toBeGreaterThanOrEqual(MIN_SPEED)
    expect(s.speed).toBeLessThanOrEqual(MAX_SPEED)
  })

  it('charges while jump is held and launches into air on release', () => {
    const held = run(createRider(course), { ...idle, jumpHeld: true }, 0.4)
    expect(held.mode).toBe('snow')
    expect(held.charge).toBeGreaterThan(0.5)
    const released = stepRider(held, idle, 1 / 60, course)
    expect(released.mode).toBe('air')
    expect(released.vy).toBeLessThan(0) // up is negative y
  })
})

describe('air mode', () => {
  function airborne(): RiderState {
    const held = run(createRider(course), { ...idle, jumpHeld: true }, 0.5)
    return stepRider(held, idle, 1 / 60, course)
  }

  it('queues 180-degree increments per spin press and rotates toward them', () => {
    let s = airborne()
    s = stepRider(s, { ...idle, spinRightPressed: true }, 1 / 60, course)
    expect(s.targetRotationDeg).toBe(180)
    s = stepRider(s, { ...idle, spinRightPressed: true }, 1 / 60, course)
    expect(s.targetRotationDeg).toBe(360)
    expect(s.rotationDeg).toBeGreaterThan(0)
    expect(s.rotationDeg).toBeLessThan(360)
  })

  it('records a grab held mid-air for the whole trick', () => {
    let s = airborne()
    s = stepRider(s, { ...idle, grabHeld: true }, 1 / 60, course)
    expect(s.grabbing).toBe(true)
    s = stepRider(s, idle, 1 / 60, course)
    expect(s.grabbing).toBe(false)
    expect(s.grabHappened).toBe(true)
  })

  it('lands clean from a straight small ollie and keeps riding', () => {
    let s = airborne()
    s = run(s, idle, 3)
    expect(s.mode).toBe('snow')
    expect(s.bailed).toBe(false)
    expect(s.combo).toBeGreaterThanOrEqual(1)
  })

  it('bails when rotation is not settled at landing', () => {
    let s = airborne()
    // queue a rotation the short airtime cannot complete
    for (let i = 0; i < 4; i++) {
      s = stepRider(s, { ...idle, spinRightPressed: true }, 1 / 60, course)
    }
    s = run(s, idle, 2.5)
    // it either bailed and is mid-timer, or already respawned on snow with combo reset
    expect(s.combo).toBe(0)
  })
})

describe('bail and respawn', () => {
  it('respawns on snow roughly RESPAWN_LEAD before the next obstacle, keeping score and collected', () => {
    const s0 = createRider(course)
    const bailed: RiderState = {
      ...s0,
      mode: 'bail',
      bailTimer: BAIL_TIME,
      bailed: true,
      score: 500,
      nextObstacle: 3,
      x: course.obstacles[3].x - 700,
    }
    const s = run(bailed, idle, BAIL_TIME + 0.1)
    expect(s.mode).toBe('snow')
    expect(s.bailed).toBe(false)
    expect(s.score).toBe(500)
    expect(s.x).toBeCloseTo(Math.max(0, course.obstacles[3].x - RESPAWN_LEAD), 0)
    expect(s.y).toBeCloseTo(slopeY(s.x), 4)
  })

  it('R retries the section instantly from any live mode', () => {
    const s0 = { ...createRider(course), x: 400, nextObstacle: 1 }
    const s = stepRider(s0, { ...idle, retryPressed: true }, 1 / 60, course)
    expect(s.mode).toBe('snow')
    expect(s.x).toBeCloseTo(Math.max(0, course.obstacles[1].x - RESPAWN_LEAD), 0)
  })
})

describe('grind', () => {
  it('snaps onto a rail surface when falling onto it and accumulates grind length', () => {
    const rail = course.obstacles.find((o) => o.type === 'rail')!
    const idx = course.obstacles.indexOf(rail)
    const s0: RiderState = {
      ...createRider(course),
      mode: 'air',
      x: rail.x + 5,
      y: obstacleSurfaceY(rail, rail.x + 5) - 10,
      vx: CRUISE_SPEED,
      vy: 40,
      nextObstacle: idx,
    }
    const s = stepRider(s0, idle, 1 / 60, course)
    expect(s.mode).toBe('grind')
    expect(s.attributedObstacle).toBe(idx)
    const later = run(s, idle, 0.3)
    expect(later.grindLength).toBeGreaterThan(0)
  })

  it('running off the end of the rail returns to air, then a flat landing collects the skill', () => {
    const rail = course.obstacles.find((o) => o.type === 'rail')!
    const idx = course.obstacles.indexOf(rail)
    const s0: RiderState = {
      ...createRider(course),
      mode: 'air',
      x: rail.x + 5,
      y: obstacleSurfaceY(rail, rail.x + 5) - 10,
      vx: CRUISE_SPEED,
      vy: 40,
      nextObstacle: idx,
    }
    const s = run(s0, idle, 4)
    expect(s.collected[idx]).toBe(true)
    expect(s.score).toBeGreaterThan(0)
    expect(s.lastEvent?.line).toContain(rail.skill.name)
  })
})

describe('finish', () => {
  it('enters finish mode past finishX and stops advancing', () => {
    const nearEnd: RiderState = { ...createRider(course), x: course.finishX - 50 }
    const s = run(nearEnd, idle, 2)
    expect(s.mode).toBe('finish')
    const after = stepRider(s, idle, 1 / 60, course)
    expect(after.x).toBe(s.x)
  })
})

describe('obstacleSurfaceY', () => {
  it('sits SURFACE_RAISE above the snow at both ends of the obstacle', () => {
    const rail = course.obstacles.find((o) => o.type === 'rail')!
    expect(obstacleSurfaceY(rail, rail.x)).toBeCloseTo(slopeY(rail.x) - 42, 6)
    expect(obstacleSurfaceY(rail, rail.x + rail.length)).toBeCloseTo(
      slopeY(rail.x + rail.length) - 42,
      6
    )
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest --project unit __tests__/labs/snowpark/rider.test.ts --run`
Expected: FAIL — cannot resolve `@/components/labs/snowpark/rider`.

- [ ] **Step 4: Implement the state machine to the following contract**

`createRider(course)`: mode `'snow'`, `x: 0`, `y: slopeY(0)`, `speed: START_SPEED`, `collected: course.obstacles.map(() => false)`, everything else zero/null/false.

`obstacleSurfaceY(o, x)`: linear interpolation between `slopeY(o.x) - SURFACE_RAISE` and `slopeY(o.x + o.length) - SURFACE_RAISE` by `t = (x - o.x) / o.length`.

`stepRider(s, input, dt, course)` — top level:
1. `mode === 'finish'` → return `s` unchanged.
2. `input.retryPressed` (any live mode) → respawn (below).
3. Otherwise dispatch on mode. Every branch advances `time` by `dt`.

**snow:**
- `speed = clamp(speed + (slopeGradient(x) * ACCEL - DRAG) * dt, MIN_SPEED, MAX_SPEED)`
- `x = advanceAlongSlope(x, speed * dt)`; `y = slopeY(x)`
- `jumpHeld` → `charge = min(charge + dt / MAX_CHARGE_S, 1)`; not held with `charge > 0` → **launch**:
  - `pop = BASE_POP + charge * CHARGE_POP`
  - if `x` is inside a kicker's `[o.x, o.x + o.length]`: `pop *= KICKER_BOOST` and `attributedObstacle = that index`; else `attributedObstacle = null`
  - `vx = cos(slopeAngle(x)) * speed`; `vy = sin(slopeAngle(x)) * speed - pop`
  - `launchAngleDeg = slopeAngle(x) * 180 / PI` (the board leaves aligned with the snow)
  - mode `'air'`; reset `rotationDeg`, `targetRotationDeg`, `grabbing`, `grabHappened`, `grindLength`; `charge = 0`
- passed-obstacle bookkeeping: while `nextObstacle < obstacles.length` and `x > obstacles[nextObstacle].x + obstacles[nextObstacle].length`, increment `nextObstacle` (uncollected ones simply stay `false` — they appear as missed in the recap)
- `x >= course.finishX` → mode `'finish'`
- clear `lastEvent` after it has been up ~2 s (track via `lastEvent` set time or let the shell clear it — implementer's choice; document which)

**air:**
- `vy += GRAVITY * dt`; `x += vx * dt`; `y += vy * dt`
- `spinLeftPressed || spinRightPressed` → `targetRotationDeg += 180` (magnitude only; direction is a renderer concern)
- `rotationDeg = min(targetRotationDeg, rotationDeg + SPIN_RATE * dt)`
- `grabbing = grabHeld`; `grabHeld` → `grabHappened = true`
- **grind snap:** for each rail/box `o` with `o.x <= x <= o.x + o.length`, if `vy >= 0` and `|y - obstacleSurfaceY(o, x)| < GRIND_SNAP_DIST` → mode `'grind'`, `y = surface`, `speed = max(vx, MIN_SPEED)`, `attributedObstacle = index of o`
- **landing:** if `y >= slopeY(x)`:
  - The spec's "within ±35° of slope tangent" is the BOARD's orientation, not the fall direction (a straight ollie falls steeply and must still land clean). Board angle in air = `launchAngleDeg + rotationDeg`; since settled rotation is a multiple of 180°, compare mod 180: `diff = ((launchAngleDeg + rotationDeg - slopeAngleDeg(x) + 90) mod 180) - 90` with a positive-mod (add 180 before `%` if negative). Clean iff `|diff| <= LANDING_TOLERANCE_DEG` AND `targetRotationDeg - rotationDeg < ROTATION_SETTLE_DEG`.
  - clean → mode `'snow'`, `y = slopeY(x)`, `speed = clamp(hypot(vx, vy) * cos(atan2(vy, vx) - slopeAngle(x)), MIN_SPEED, MAX_SPEED)` (velocity projected onto the slope), `combo = nextCombo(combo, true)`; if `attributedObstacle !== null` and not yet collected: compute `name = trickName(...)`, `points = trickScore({ rotationDeg: targetRotationDeg, grab: grabHappened, grindLength }, skill.years, previous combo)`, set `collected[i] = true` (new array), `score += points`, `lastEvent = { obstacleIndex, line: collectLine(name, skill), points }`, update `bestTrick` if `points` higher
  - not clean → mode `'bail'`, `bailTimer = BAIL_TIME`, `bailed = true`, `combo = nextCombo(combo, false)`

**grind:**
- `x += speed * dt`; `y = obstacleSurfaceY(o, x)`; `grindLength += speed * dt`
- `jumpPressed` → back to air with `vx = speed`, `vy = -GRIND_EXIT_POP` (rotation/grab state carries over — the trick is still live)
- `x > o.x + o.length` → back to air with `vx = speed`, `vy = 0` (falling off the end; the subsequent landing evaluates and scores the whole trick including `grindLength`)
- both exits set `launchAngleDeg` to the obstacle surface's angle in degrees: `atan2(obstacleSurfaceY(o, o.x + o.length) - obstacleSurfaceY(o, o.x), o.length) * 180 / PI` — the board leaves aligned with the rail, so the later board-vs-slope landing check stays fair

**bail:**
- `bailTimer -= dt`; at `<= 0` → respawn. (Renderer draws the tumble from `bailed` + `bailTimer`.)

**respawn (shared by bail timeout and R):**
- target = `course.obstacles[min(nextObstacle, obstacles.length - 1)]`
- `x = max(0, target.x - RESPAWN_LEAD)`; `y = slopeY(x)`; mode `'snow'`; `speed = START_SPEED`; `bailed = false`; zero the air/trick fields; **keep** `score`, `collected`, `combo` (already 0 after a bail), `time`.

- [ ] **Step 5: Run the tests until green**

Run: `pnpm vitest --project unit __tests__/labs/snowpark/rider.test.ts --run`
Expected: PASS (14 tests). If a physics-tuning test is off (e.g. the small-ollie landing), adjust the implementation, not the contract constants, unless the constant is genuinely unreachable — then flag it in your report.

- [ ] **Step 6: Run the whole unit suite**

Run: `pnpm test:unit --run`
Expected: all existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add components/labs/snowpark/rider.ts __tests__/labs/snowpark/rider.test.ts
git commit -m "feat(snowpark): kinematic rider state machine (snow/air/grind/bail/finish)"
```

---

### Task 5: Input and game loop

**Files:**
- Create: `components/labs/snowpark/input.ts`
- Create: `components/labs/snowpark/use-game-loop.ts`

**Interfaces:**
- Consumes: `RiderInput` from `./rider`.
- Produces: `createInput(): InputController` where `InputController = { attach(target: HTMLElement | Window): () => void; sample(): RiderInput; consumeEscape(): boolean }`; `useGameLoop(opts: { step: (dt: number) => void; render: () => void; paused: boolean }): void`.

No unit tests for these two files (browser-event and rAF glue; covered by e2e smoke in Task 10). Keep them free of game rules — they only translate events and time.

- [ ] **Step 1: Implement input.ts**

Behavioral contract:

- Keyboard mapping: Space → jump; ArrowLeft/ArrowRight → spin presses; ArrowUp → grab (held); KeyR → retry press. Use `e.code`. Call `e.preventDefault()` on Space and the arrows so the page never scrolls.
- **Esc handling (REQUIRED HARDENING, spec):** the `keydown` listener for `Escape` does NOT go into `RiderInput`. Instead the controller records it and `consumeEscape()` returns true once per press. The SHELL (Task 7) decides: if playing → pause AND the input listener has already called `e.preventDefault()` for Escape **only while playing**. Implement via a `setPlaying(playing: boolean)` method on the controller: when `playing` is true, Escape keydown → `e.preventDefault()` + record; when false (paused/recap), Escape is ignored entirely so it bubbles to GalleryChrome, which navigates to /labs. Add `setPlaying` to the `InputController` type.
- Edge detection: `jumpPressed`, `spinLeftPressed`, `spinRightPressed`, `retryPressed` are true in exactly one `sample()` after the keydown (clear them when sampled). `jumpHeld`/`grabHeld` track key state.
- Touch mapping (attach to the canvas element): single tap = jump press+release (a short synthetic hold: set `jumpHeld` true on touchstart, false on touchend — a long touch charges, matching desktop); horizontal swipe > 30 px while a second sample shows airborne is not knowable here, so simply: any horizontal swipe ≥ 30 px → spin press in that direction (the rider ignores spins on snow anyway); a second finger down → `grabHeld` true until that finger lifts.
- `attach()` returns a cleanup function removing every listener (React effect friendly).
- Factory + closure state, no classes required; no React imports.

Skeleton the implementer fills in (signatures binding):

```ts
import type { RiderInput } from './rider'

export type InputController = {
  attach: (target: HTMLElement) => () => void
  sample: () => RiderInput
  consumeEscape: () => boolean
  setPlaying: (playing: boolean) => void
}

export function createInput(): InputController {
  // closure state: held flags, pending edge flags, pendingEscape, playing
  // keydown/keyup on window; touchstart/touchmove/touchend on the target
}
```

- [ ] **Step 2: Implement use-game-loop.ts**

Behavioral contract:

- Fixed timestep: accumulate elapsed time, call `step(FIXED_DT)` with `FIXED_DT = 1 / 120` while the accumulator holds a full step (cap the accumulator at 0.25 s so a long frame never spirals), then `render()` once per animation frame.
- `paused: true` → the rAF loop keeps running `render()` (so the pause overlay backdrop stays drawn) but never calls `step`, and the accumulator resets on unpause (no catch-up jump).
- `document.visibilitychange` to hidden → the hook calls `opts.onHidden?.()` so the shell can flip to paused (spec: tab hidden → auto-pause). Add `onHidden?: () => void` to the options type.
- Clean teardown: cancel the rAF and remove the visibility listener on unmount.
- Use `performance.now()`; never `Date.now()`.

```ts
import { useEffect, useRef } from 'react'

export const FIXED_DT = 1 / 120

export function useGameLoop(opts: {
  step: (dt: number) => void
  render: () => void
  paused: boolean
  onHidden?: () => void
}): void {
  // rAF loop with accumulator; latest opts via a ref so the effect
  // attaches once and never restarts the loop mid-game
}
```

- [ ] **Step 3: Verify it compiles and lint passes**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/labs/snowpark/input.ts components/labs/snowpark/use-game-loop.ts
git commit -m "feat(snowpark): input controller with Esc hardening and fixed-timestep loop"
```

---

### Task 6: Renderer

**Files:**
- Create: `components/labs/snowpark/renderer.ts`

**Interfaces:**
- Consumes: `palette` from `./palette`; `Course`, `CourseObstacle` from `./course`; `slopeY`, `slopeAngle` from `./slope`; `RiderState`, `obstacleSurfaceY`, `SURFACE_RAISE`, `BAIL_TIME` from `./rider`.
- Produces: `createRenderer(canvas: HTMLCanvasElement): Renderer` where `Renderer = { draw(state: RiderState, course: Course): void; resize(): void }`.

No unit tests (visual module; verified by eye + e2e canvas-mount). All colors from `palette` — the reviewer will grep for stray hex literals. No `shadowBlur`, no `createLinearGradient` used decoratively (a single flat sky is `palette.ice` fill, period).

- [ ] **Step 1: Implement the renderer to this contract**

Camera: rider fixed at ~35% viewport width, ~45% height; world-to-screen is a translate by `(riderScreenX - s.x, riderScreenY - s.y)`. Handle devicePixelRatio in `resize()` (cap DPR at 2).

Draw order per frame (all strokes round-capped):

1. **Sky:** flat `palette.ice` fill.
2. **Sun:** flat `palette.amber` disc, upper-right area, fixed screen position with a tiny parallax drift (moves at 2% of camera x). No rays, no glow.
3. **Far contour layers:** two or three polylines sampled from `slopeY(x * k) * 0.4 + offset` with parallax factors ~0.15 and 0.35, stroked in `palette.bluePale` (1.5 px) and `palette.blueMid` (2 px). These are the "long flowing wave lines" of the spec.
4. **Terrain ribbon:** the master curve — sample `slopeY` every ~24 px of screen x across the viewport; stroke the snow line in `palette.blueDeep` at 3 px, then 3–4 echo lines offset +14/+30/+48 px below in `blueMid`/`bluePale` at decreasing widths. Fill below the top line with `palette.ice` slightly darkened? NO — banned; leave unfilled, the parallel offsets carry the depth.
5. **Obstacles** (only those within the viewport, from `course.obstacles`):
   - kicker: clean wedge — triangle outline from `(o.x, slopeY(o.x))` rising to a lip at `(o.x + o.length, slopeY(o.x + o.length) - 34)`, stroked `palette.ink` 2.5 px.
   - rail: a straight `palette.ink` 3 px line from `(o.x, obstacleSurfaceY(o, o.x))` to end, on two thin vertical posts down to the snow.
   - box: rounded rectangle (radius 6) from surface height down to the snow, `palette.ink` 2.5 px outline, no fill.
   - label: skill name in 11 px ui-monospace `palette.ink`, lowercase, centered above the obstacle; collected obstacles get a small `palette.amber` filled circle (4 px radius) beside the label — the only amber in the world besides the sun.
6. **Trail:** the rider's last ~40 positions (renderer keeps its own ring buffer, pushed each `draw`) as a fading polyline in `palette.bluePale`, width tapering 3→0. Cleared on respawn (detect x jumping backward).
7. **Rider:** built from primitives so the bail tumble can decompose it — a board (18 px `palette.ink` line rotated to `slopeAngle` on snow / to `rotationDeg` in air), a leaning capsule body (two strokes), a dot head. Grabbing → body compresses toward the board. In `bail` mode: draw the three primitives separately, spinning apart, driven by `bailTimer / BAIL_TIME` (deterministic from state — no `Math.random()` per frame; seed any scatter from `Math.floor(s.time * 1000)`).
8. **Finish banner:** at `course.finishX`, two ink posts + a straight banner line, the word `finish` in the same mono label style.
9. **Snow dots:** ≤ 60 dots in `palette.bluePale`, positions derived deterministically from `(i, s.time)` with a hash — drifting slowly down-left; a mood, not a particle system (spec). No allocation per frame.

Sampling of state is read-only; the ring buffer for the trail is the renderer's only internal state.

- [ ] **Step 2: Verify compile + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 3: Grep for banned styling**

Run: `grep -nE "shadowBlur|createRadialGradient|#[0-9a-fA-F]{3,8}" components/labs/snowpark/renderer.ts`
Expected: no matches (all color via `palette`).

- [ ] **Step 4: Commit**

```bash
git add components/labs/snowpark/renderer.ts
git commit -m "feat(snowpark): geometry renderer - terrain ribbon, obstacles, rider, trail"
```

---

### Task 7: Game shell, HUD, recap, page

**Files:**
- Create: `components/labs/snowpark/snowpark-game.tsx`
- Create: `components/labs/snowpark/game-loader.tsx`
- Create: `app/labs/snowpark/page.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–6 (`compileCourse`, `createRider`, `stepRider`, `BAIL_LINE`, `createInput`, `useGameLoop`, `createRenderer`, `palette`); `GalleryChrome` from `@/components/labs/gallery-chrome`; `skills`, `skillCategories` from `@/data/skills`.
- Produces: default-exported page; `SnowparkGame` client component.

- [ ] **Step 1: Implement snowpark-game.tsx ('use client')**

Contract:

- `const course = compileCourse()` at module scope (spec: compiled at module load).
- **Reduced-motion gate:** on mount check `matchMedia('(prefers-reduced-motion: reduce)')`. If reduced, do NOT auto-run: render the static skill sheet — the recap layout listing ALL skills from `data/skills.ts` grouped by `skillCategories` with years/level (no collected/missed split), plus a button with the exact copy `start the run anyway` that mounts the game. Initial state must be hydration-safe: render `null` until the media query has been read (same pattern as the museum's view gate).
- **Phases:** `'playing' | 'paused' | 'finished'` React state; game auto-starts in `'playing'` (no start screen). Rider state lives in a `useRef` holding the current immutable `RiderState`; the loop's `step` calls `stepRider` and writes the new object into the ref. A lightweight HUD snapshot (`score`, `combo`, `stretchName`, `lastEvent`, `bailed`, `mode`) is mirrored into React state only when one of those values changes.
- **Loop wiring:** `useGameLoop({ step, render, paused: phase !== 'playing', onHidden: () => setPhase('paused') })` — tab hidden auto-pauses (spec). `render` calls `renderer.draw(riderRef.current, course)`.
- **Input wiring:** `createInput()` in a ref; `attach(canvas)` in an effect; `input.setPlaying(phase === 'playing')` kept in sync. In `step`: if `input.consumeEscape()` and phase is `'playing'` → `setPhase('paused')`. A shell-level `keydown` listener handles `KeyP` toggling playing/paused. When the rider reaches `mode === 'finish'` → `setPhase('finished')`.
- **HUD (DOM overlay, not canvas; nothing else on it):**
  - top-right: score in `palette.amber` mono with `data-testid="hud-score"`; combo below it as `x3` only when ≥ 2.
  - top-left: current stretch name (the stretch whose `startX <= x < endX`, else empty), lowercase mono ink.
  - bottom-center: last trick line — `lastEvent.line` — visible ~2 s then fades (CSS transition; clear the mirrored state on a 2 s timeout).
  - collect moment: the same lastEvent renders as a small ink-bordered card sliding up with the line plus `+{points}` in amber. One at a time — a new event replaces the old.
  - bail: show `BAIL_LINE` (imported — never retyped) bottom-center while `bailed`.
  - quiet corner hint (bottom-right, small mono, ink at 60%): `space jump · ←/→ spin · ↑ grab · R retry · P pause`. Not a modal.
  - pause glyph (spec touch scheme: "tap the pause glyph for the menu"): a small `⏸`-style two-bar icon drawn as two ink rectangles (no emoji), top-right below the score, `aria-label="pause"`, tap/click → `setPhase('paused')`.
- **Pause overlay:** dim with flat `rgba(18,38,48,0.55)` (ink at alpha — allowed, it is not a gradient); the word `paused`, buttons `resume` and `restart run`, and the literal note `Esc again → gallery` (spec: the pause menu says so).
- **Recap (phase 'finished'):** expedition-log card on the ice background — heading `expedition log`; run time (from `state.time`, mm:ss), total score (amber), best trick (`bestTrick.name — bestTrick.points`); then skills in two columns: collected (amber tick `●`) and missed (ink circle `○`), grouped by category with `{years} yrs · {level}`. Buttons: `run it back` (fresh `createRider`, phase 'playing') and `← gallery` (Next `Link` to `/labs`). All copy lowercase, dry.
- Canvas fills the viewport (`fixed inset-0`); page background `palette.ice`; every color from `palette` (inline styles or CSS vars — Tailwind arbitrary values would hardcode hex, so prefer `style={{ color: palette.amber }}`).

- [ ] **Step 2: Implement game-loader.tsx**

```tsx
'use client'

import dynamic from 'next/dynamic'

/** The game bundle loads client-side only; the museum/list pay nothing for it. */
export const SnowparkGameLoader = dynamic(
  () => import('./snowpark-game').then((m) => m.SnowparkGame),
  { ssr: false }
)
```

- [ ] **Step 3: Implement app/labs/snowpark/page.tsx**

```tsx
import type { Metadata } from 'next'
import { GalleryChrome } from '@/components/labs/gallery-chrome'
import { SnowparkGameLoader } from '@/components/labs/snowpark/game-loader'

export const metadata: Metadata = {
  title: 'Powder Lines — Style Lab | Aram Yeghiazaryan',
  description:
    'Style Lab experiment #2: the CV as a snowboard run — every kicker, rail and box is a real skill; land the trick to collect it.',
  openGraph: {
    title: 'Powder Lines — Style Lab',
    description:
      'A playable snowboard descent drawn as pure geometry. Every obstacle is a real skill — land the trick to collect it.',
    images: ['/labs/snowpark/poster.jpg'],
  },
}

export default function SnowparkLabPage() {
  return (
    <GalleryChrome>
      <main className="fixed inset-0 overflow-hidden">
        <SnowparkGameLoader />
      </main>
    </GalleryChrome>
  )
}
```

- [ ] **Step 4: Manual smoke in dev**

Run: `pnpm dev`, open `http://localhost:3000/labs/snowpark`. Verify: game auto-runs; Space/arrow tricks work; a bail shows the exact bail line; Esc pauses (URL unchanged), Esc again navigates to /labs; P resumes; finishing shows the recap. Take a screenshot for the review package.

- [ ] **Step 5: Compile, lint, unit suite**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test:unit --run`
Expected: clean, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/labs/snowpark/snowpark-game.tsx components/labs/snowpark/game-loader.tsx app/labs/snowpark/page.tsx
git commit -m "feat(snowpark): game shell with HUD, pause, expedition-log recap"
```

---

### Task 8: GalleryChrome defaultPrevented guard (REQUIRED HARDENING)

**Files:**
- Modify: `components/labs/gallery-chrome.tsx:14-17`
- Test: `__tests__/labs/gallery-chrome.test.tsx`

**Interfaces:**
- Consumes: nothing new. Produces: unchanged public API; new behavior — a prevented Escape no longer navigates.

- [ ] **Step 1: Write the failing test**

`__tests__/labs/gallery-chrome.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { GalleryChrome } from '@/components/labs/gallery-chrome'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

function pressEscape(prevented: boolean) {
  const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
  if (prevented) {
    const preventer = (e: Event) => e.preventDefault()
    window.addEventListener('keydown', preventer, { capture: true, once: true })
  }
  window.dispatchEvent(event)
}

describe('GalleryChrome Escape handling', () => {
  beforeEach(() => push.mockClear())

  it('navigates to /labs on a plain Escape', () => {
    render(<GalleryChrome>lab</GalleryChrome>)
    pressEscape(false)
    expect(push).toHaveBeenCalledWith('/labs')
  })

  it('does nothing when another handler already prevented the Escape', () => {
    render(<GalleryChrome>lab</GalleryChrome>)
    pressEscape(true)
    expect(push).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify the second case fails**

Run: `pnpm vitest --project unit __tests__/labs/gallery-chrome.test.tsx --run`
Expected: first test PASS, second FAIL (push called despite preventDefault).

- [ ] **Step 3: Add the guard**

In `components/labs/gallery-chrome.tsx`, change the handler to:

```ts
const onKey = (e: KeyboardEvent) => {
  if (e.defaultPrevented) return
  if (e.key === 'Escape') router.push('/labs')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest --project unit __tests__/labs/gallery-chrome.test.tsx --run`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/labs/gallery-chrome.tsx __tests__/labs/gallery-chrome.test.tsx
git commit -m "feat(snowpark): GalleryChrome ignores Escape presses a lab already handled"
```

---

### Task 9: Manifest entry and poster

**Files:**
- Modify: `lib/labs-manifest.ts` (append to `labs` array)
- Create: `scripts/posters/snowpark-poster.html`
- Create: `scripts/posters/capture-snowpark.mjs`
- Create: `public/labs/snowpark/poster.jpg`

**Interfaces:**
- Consumes: `LabEntry` shape from `lib/labs-manifest.ts`. Produces: the museum hangs the new painting automatically from this entry + poster.

- [ ] **Step 1: Append the manifest entry**

```ts
{
  slug: 'snowpark',
  title: 'Powder Lines',
  date: '2026-07-08',
  thesis:
    'A playable snowboard descent drawn as pure geometry — every kicker, rail and box is a real skill; land the trick to collect it.',
  status: 'live',
},
```

- [ ] **Step 2: Write the poster generator**

`scripts/posters/snowpark-poster.html` — a self-contained 768×1024 page in the lab's own language (follow the structure of the existing `scripts/posters/main-poster.html`): flat `#eef3f6` ice field; a flat `#d9a441` sun disc upper right; 4–6 long parallel terrain polylines in `#b8d4e2`/`#6e9cb4`/`#2e5468` (SVG or canvas, straight geometry, no gradients/glows); a minimal `#122630` ink rider silhouette mid-air above one line; one small kicker wedge; wordmark `Powder Lines` in a bold condensed sans with a thin amber rule and the caption `STYLE LAB — № 2` in mono. Only the six palette hexes appear in the file.

- [ ] **Step 3: Write the capture script and generate the poster**

`scripts/posters/capture-snowpark.mjs`:

```js
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const dir = path.dirname(fileURLToPath(import.meta.url))
const html = path.join(dir, 'snowpark-poster.html')
const out = path.join(dir, '..', '..', 'public', 'labs', 'snowpark', 'poster.jpg')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 768, height: 1024 } })
await page.goto('file://' + html.replace(/\\/g, '/'))
await page.screenshot({ path: out, type: 'jpeg', quality: 80 })
await browser.close()
```

Run: `node scripts/posters/capture-snowpark.mjs`
Then verify the size budget: `ls -la public/labs/snowpark/poster.jpg` — must be ≤ 200 KB (lower the quality to 70 if not; flat-color art compresses far below this).

- [ ] **Step 4: Verify the painting hangs**

Run: `pnpm dev`, open `http://localhost:3000/labs?view=list` — `Powder Lines` appears with the poster thumbnail and links to `/labs/snowpark`. Open `http://localhost:3000/labs` (3D view) — a third painting hangs with the poster texture (missing poster = silently empty wall, so eyeball it).

- [ ] **Step 5: Run the unit suite (manifest is imported by museum tests)**

Run: `pnpm test:unit --run`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add lib/labs-manifest.ts scripts/posters/snowpark-poster.html scripts/posters/capture-snowpark.mjs public/labs/snowpark/poster.jpg
git commit -m "feat(snowpark): manifest entry and geometry poster for the museum"
```

---

### Task 10: E2E smoke and full gates

**Files:**
- Create: `e2e/labs-snowpark.spec.ts`

**Interfaces:**
- Consumes: `data-testid="hud-score"` from Task 7; exact copy `paused` and `start the run anyway` from Task 7.

- [ ] **Step 1: Write the e2e spec**

```ts
import { expect, test } from '@playwright/test'

test.describe('snowpark lab', () => {
  test('game canvas mounts and the HUD appears', async ({ page }) => {
    await page.goto('/labs/snowpark')
    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.getByTestId('hud-score')).toBeVisible()
  })

  test('first Esc pauses in place, second Esc returns to the gallery', async ({ page }) => {
    await page.goto('/labs/snowpark')
    await expect(page.getByTestId('hud-score')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByText('paused', { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/labs\/snowpark/)
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/labs(\?.*)?$/)
  })

  test('reduced motion renders the static skill sheet, not the running game', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/labs/snowpark')
    await expect(page.getByRole('button', { name: 'start the run anyway' })).toBeVisible()
    await expect(page.getByText('React', { exact: true })).toBeVisible()
  })
})
```

- [ ] **Step 2: Run the new spec across all projects**

Run: `pnpm test:e2e -- labs-snowpark.spec.ts`
Expected: pass on all 5 browser projects (touch projects still mount the canvas; `keyboard.press` works under emulation). If a mobile project cannot deliver Escape, mirror the museum spec's pattern of skipping that case on `isMobile` — skip, don't delete.

- [ ] **Step 3: Run every gate**

```bash
pnpm lint && pnpm exec tsc --noEmit && pnpm test:unit --run && pnpm build && pnpm test:e2e
```
Expected: all green (existing museum e2e included).

- [ ] **Step 4: Commit**

```bash
git add e2e/labs-snowpark.spec.ts
git commit -m "test(snowpark): e2e smoke - canvas, Esc pause-then-exit, reduced motion"
```

---

## Final verification (whole branch)

- `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test:unit --run`, `pnpm build`, `pnpm test:e2e` — all green.
- Grep the lab for banned styling: `grep -rnE "shadowBlur|Gradient\(|#[0-9a-fA-F]{6}" components/labs/snowpark/ app/labs/snowpark/` — hex hits allowed only in `palette.ts`; no gradient/glow hits.
- Grep for hype copy/emoji: `grep -rnE "EPIC|!{2,}|[\x{1F300}-\x{1FAFF}]" components/labs/snowpark/` — no hits.
- Manual pass (human): trick feel (charge, spin, grab, grind), bail/respawn placement, ~90 s run length, recap accuracy vs skills actually collected, touch controls on a phone.
- Whole-branch code review, then superpowers:finishing-a-development-branch (user's pattern: PR → Vercel preview → user tests → merge on their word).
