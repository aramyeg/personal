import type { Course, CourseObstacle } from './course'
import { advanceAlongSlope, slopeAngle, slopeGradient, slopeY } from './slope'
import { collectLine, nextCombo, trickName, trickScore } from './tricks'

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

const DEG = 180 / Math.PI

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Positive-modulo — result is always in [0, n). */
function mod(a: number, n: number): number {
  return ((a % n) + n) % n
}

export function createRider(course: Course): RiderState {
  return {
    mode: 'snow',
    x: 0,
    y: slopeY(0),
    vx: 0,
    vy: 0,
    speed: START_SPEED,
    charge: 0,
    rotationDeg: 0,
    targetRotationDeg: 0,
    grabbing: false,
    grabHappened: false,
    launchAngleDeg: 0,
    attributedObstacle: null,
    grindLength: 0,
    bailTimer: 0,
    nextObstacle: 0,
    collected: course.obstacles.map(() => false),
    combo: 0,
    score: 0,
    bestTrick: null,
    lastEvent: null,
    bailed: false,
    time: 0,
  }
}

/** Linear interp between the obstacle's raised entry and exit heights. */
export function obstacleSurfaceY(o: CourseObstacle, x: number): number {
  const t = (x - o.x) / o.length
  const y0 = slopeY(o.x) - SURFACE_RAISE
  const y1 = slopeY(o.x + o.length) - SURFACE_RAISE
  return y0 + (y1 - y0) * t
}

export function stepRider(
  state: RiderState,
  input: RiderInput,
  dt: number,
  course: Course
): RiderState {
  if (state.mode === 'finish') return state
  if (input.retryPressed) return respawn(state, course)
  switch (state.mode) {
    case 'snow':
      return stepSnow(state, input, dt, course)
    case 'air':
      return stepAir(state, input, dt, course)
    case 'grind':
      return stepGrind(state, input, dt, course)
    case 'bail':
      return stepBail(state, dt, course)
    default:
      return state
  }
}

/** Reset the air/trick fields to their neutral values. */
function clearAir(): Pick<
  RiderState,
  | 'rotationDeg'
  | 'targetRotationDeg'
  | 'grabbing'
  | 'grabHappened'
  | 'grindLength'
  | 'charge'
> {
  return {
    rotationDeg: 0,
    targetRotationDeg: 0,
    grabbing: false,
    grabHappened: false,
    grindLength: 0,
    charge: 0,
  }
}

/** Advance the `nextObstacle` cursor past everything the rider has cleared. */
function advanceObstacleCursor(x: number, nextObstacle: number, course: Course): number {
  let next = nextObstacle
  const os = course.obstacles
  while (next < os.length && x > os[next].x + os[next].length) next += 1
  return next
}

function stepSnow(
  state: RiderState,
  input: RiderInput,
  dt: number,
  course: Course
): RiderState {
  const time = state.time + dt
  const speed = clamp(
    state.speed + (slopeGradient(state.x) * ACCEL - DRAG) * dt,
    MIN_SPEED,
    MAX_SPEED
  )
  const x = advanceAlongSlope(state.x, speed * dt)
  const y = slopeY(x)
  const nextObstacle = advanceObstacleCursor(x, state.nextObstacle, course)

  if (!input.jumpHeld && state.charge > 0) {
    return launch(state, { time, speed, x, y, nextObstacle }, course)
  }

  const charge = input.jumpHeld
    ? Math.min(state.charge + dt / MAX_CHARGE_S, 1)
    : state.charge
  const mode: RiderMode = x >= course.finishX ? 'finish' : 'snow'
  return { ...state, time, speed, x, y, nextObstacle, charge, mode }
}

type SnowMotion = { time: number; speed: number; x: number; y: number; nextObstacle: number }

/** Leave the snow: pop upward, aligned with the slope, boosted on a kicker. */
function launch(state: RiderState, m: SnowMotion, course: Course): RiderState {
  let pop = BASE_POP + state.charge * CHARGE_POP
  let attributedObstacle: number | null = null
  const ki = course.obstacles.findIndex(
    (o) => o.type === 'kicker' && m.x >= o.x && m.x <= o.x + o.length
  )
  if (ki !== -1) {
    pop *= KICKER_BOOST
    attributedObstacle = ki
  }
  const ang = slopeAngle(m.x)
  return {
    ...state,
    ...clearAir(),
    time: m.time,
    speed: m.speed,
    x: m.x,
    y: m.y,
    nextObstacle: m.nextObstacle,
    mode: 'air',
    vx: Math.cos(ang) * m.speed,
    vy: Math.sin(ang) * m.speed - pop,
    launchAngleDeg: ang * DEG,
    attributedObstacle,
  }
}

function stepAir(
  state: RiderState,
  input: RiderInput,
  dt: number,
  course: Course
): RiderState {
  const time = state.time + dt
  const vy = state.vy + GRAVITY * dt
  const x = state.x + state.vx * dt
  const y = state.y + vy * dt
  const targetRotationDeg =
    input.spinLeftPressed || input.spinRightPressed
      ? state.targetRotationDeg + 180
      : state.targetRotationDeg
  const rotationDeg = Math.min(targetRotationDeg, state.rotationDeg + SPIN_RATE * dt)
  const grabbing = input.grabHeld
  const grabHappened = state.grabHappened || input.grabHeld

  const moved: RiderState = {
    ...state,
    time,
    vy,
    x,
    y,
    targetRotationDeg,
    rotationDeg,
    grabbing,
    grabHappened,
  }

  const snap = trySnapToRail(moved, course)
  if (snap) return snap
  if (y >= slopeY(x)) return landOrBail(moved, course)
  return moved
}

/** If dropping onto a rail/box surface within reach, lock into a grind. */
function trySnapToRail(s: RiderState, course: Course): RiderState | null {
  if (s.vy < 0) return null
  const os = course.obstacles
  for (let i = 0; i < os.length; i++) {
    const o = os[i]
    if (o.type !== 'rail' && o.type !== 'box') continue
    if (s.x < o.x || s.x > o.x + o.length) continue
    if (Math.abs(s.y - obstacleSurfaceY(o, s.x)) < GRIND_SNAP_DIST) {
      return {
        ...s,
        mode: 'grind',
        y: obstacleSurfaceY(o, s.x),
        speed: Math.max(s.vx, MIN_SPEED),
        attributedObstacle: i,
      }
    }
  }
  return null
}

/** Board-vs-slope landing check: clean rides on, dirty bails. */
function landOrBail(s: RiderState, course: Course): RiderState {
  const slopeAngleDeg = slopeAngle(s.x) * DEG
  const diff = mod(s.launchAngleDeg + s.rotationDeg - slopeAngleDeg + 90, 180) - 90
  const settled = s.targetRotationDeg - s.rotationDeg < ROTATION_SETTLE_DEG
  const clean = Math.abs(diff) <= LANDING_TOLERANCE_DEG && settled
  if (!clean) {
    return {
      ...s,
      mode: 'bail',
      bailTimer: BAIL_TIME,
      bailed: true,
      combo: nextCombo(s.combo, false),
    }
  }
  return landClean(s, course)
}

function landClean(s: RiderState, course: Course): RiderState {
  const ang = slopeAngle(s.x)
  const speed = clamp(
    Math.hypot(s.vx, s.vy) * Math.cos(Math.atan2(s.vy, s.vx) - ang),
    MIN_SPEED,
    MAX_SPEED
  )
  const previousCombo = s.combo
  const landed: RiderState = {
    ...s,
    mode: 'snow',
    y: slopeY(s.x),
    speed,
    combo: nextCombo(s.combo, true),
  }
  const i = s.attributedObstacle
  if (i === null || s.collected[i]) return landed
  return scoreTrick(landed, s, i, previousCombo, course)
}

/** Award points for the trick attributed to obstacle `i` and mark it collected. */
function scoreTrick(
  landed: RiderState,
  s: RiderState,
  i: number,
  previousCombo: number,
  course: Course
): RiderState {
  const skill = course.obstacles[i].skill
  const trick = {
    rotationDeg: s.targetRotationDeg,
    grab: s.grabHappened,
    grindLength: s.grindLength,
  }
  const name = trickName(trick)
  const points = trickScore(trick, skill.years, previousCombo)
  const collected = s.collected.map((c, idx) => (idx === i ? true : c))
  const bestTrick =
    !s.bestTrick || points > s.bestTrick.points ? { name, points } : s.bestTrick
  return {
    ...landed,
    collected,
    score: s.score + points,
    lastEvent: { obstacleIndex: i, line: collectLine(name, skill), points },
    bestTrick,
  }
}

function stepGrind(
  state: RiderState,
  input: RiderInput,
  dt: number,
  course: Course
): RiderState {
  const time = state.time + dt
  const o = course.obstacles[state.attributedObstacle ?? 0]
  const x = state.x + state.speed * dt
  const grindLength = state.grindLength + state.speed * dt
  const base: RiderState = { ...state, time, x, grindLength, y: obstacleSurfaceY(o, x) }

  if (input.jumpPressed) return exitGrind(base, o, -GRIND_EXIT_POP)
  if (x > o.x + o.length) return exitGrind(base, o, 0)
  return base
}

/** Pop or roll off the rail back into the air, aligned with the rail surface. */
function exitGrind(s: RiderState, o: CourseObstacle, vy: number): RiderState {
  const surfaceAngleDeg =
    Math.atan2(obstacleSurfaceY(o, o.x + o.length) - obstacleSurfaceY(o, o.x), o.length) * DEG
  return {
    ...s,
    mode: 'air',
    vx: s.speed,
    vy,
    launchAngleDeg: surfaceAngleDeg,
  }
}

function stepBail(state: RiderState, dt: number, course: Course): RiderState {
  const time = state.time + dt
  const bailTimer = state.bailTimer - dt
  if (bailTimer <= 0) return respawn({ ...state, time }, course)
  return { ...state, time, bailTimer }
}

/** Drop the rider back on the snow a lead-in before the next obstacle. */
function respawn(state: RiderState, course: Course): RiderState {
  const target = course.obstacles[Math.min(state.nextObstacle, course.obstacles.length - 1)]
  const x = Math.max(0, target.x - RESPAWN_LEAD)
  return {
    ...state,
    ...clearAir(),
    mode: 'snow',
    x,
    y: slopeY(x),
    vx: 0,
    vy: 0,
    speed: START_SPEED,
    launchAngleDeg: 0,
    attributedObstacle: null,
    bailTimer: 0,
    bailed: false,
  }
}
