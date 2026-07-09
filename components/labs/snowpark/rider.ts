import type { Course, CourseObstacle } from './course'
import { advanceAlongSlope, slopeAngle, slopeCurvature, slopeY } from './slope'
import { collectLine, trickName, trickScore } from './tricks'

export type RiderMode = 'snow' | 'air' | 'grind' | 'bail' | 'finish'

export type RiderInput = {
  jumpHeld: boolean
  /** true only on the frame the key went down */
  jumpPressed: boolean
  grabHeld: boolean
  /** held spin direction: -1 left, +1 right, 0 none (both held cancels) */
  spinDir: -1 | 0 | 1
  retryPressed: boolean
}

export type CollectEvent = {
  obstacleIndex: number
  /** spec format: `360 Nose Grab — TypeScript · 6 yrs · expert` */
  line: string
  points: number
  /** the final rotation stopped just before touchdown (land-it-late bonus) */
  late: boolean
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
  /** jump charge 0..1, accumulates while tucking on snow */
  charge: number
  /** rotation magnitude progressed so far this air (deg; direction is a render concern) */
  rotationDeg: number
  /** jump button held this frame — tuck on snow, held-flip in air */
  tucking: boolean
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
  /** momentum chain — clean landings raise it, scrubs hold, bails reset it */
  chain: number
  score: number
  bestTrick: { name: string; points: number } | null
  /** set on a clean scored landing; shell shows it then clears it */
  lastEvent: CollectEvent | null
  /** shell shows BAIL_LINE while true; cleared on respawn */
  bailed: boolean
  time: number
  /** seconds airborne this flight */
  airtime: number
  /** seconds since a rotation input was last held (feeds the late bonus) */
  rotationIdleS: number
  /** 0..1 landing impulse for squash/shake; decays each step */
  impact: number
  /** coyote grace remaining after a natural detach (s) */
  coyoteT: number
  /** buffered-jump grace remaining (s) */
  bufferT: number
  /** one-step: set on the landing frame, cleared at the next step */
  justLanded: 'clean' | 'scrubbed' | null
  /** one-step: set on the frame the rider leaves the snow */
  justLaunched: boolean
  /** one-step: big-trick landing or bail — the hit-stop hook */
  bigMoment: boolean
}

/**
 * The single tuning surface. Values are binding starting points that the
 * orchestrator tunes at live-play gates (see the redesign plan's GATE protocol).
 *
 * IMPACT_DECAY and LIP_RAISE are additions to the brief's block: IMPACT_DECAY
 * backs the "impact decays in state" requirement; LIP_RAISE is the kicker face
 * height at the lip that makes a ramp real rideable geometry. The fixpass
 * retired the old pop-multiplier KICKER_BOOST — riding the face and launching
 * off the lip IS the boost now. They live here (not inline / not scattered) to
 * keep PHYS the one place gates tune.
 *
 * DETACH_G replaces the brief's DETACH_EPS per the amended plan: the ballistic-
 * gap rule was frame-rate dependent (gap ∝ dt²) and sub-pixel on these rollers,
 * so it never fired. Detach is now the frame-rate-independent curvature rule
 * `slopeCurvature(x) * vx² > DETACH_G`. Every other value is verbatim.
 */
export const PHYS = {
  GRAVITY: 1800,
  /** on-snow: pull = GRAVITY·sin(angle)·(tuck? TUCK_ACCEL:1); drag = DRAG_K·speed²·(tuck? TUCK_DRAG:1) */
  TUCK_ACCEL: 1.8,
  /** quadratic drag coefficient — gives real speed equilibria per grade */
  DRAG_K: 0.0045,
  /** tucking is an aero crouch: it cuts drag as well as adding pull */
  TUCK_DRAG: 0.55,
  MIN_SPEED: 130,
  MAX_SPEED: 560,
  START_SPEED: 220,
  BASE_POP: 340,
  CHARGE_POP: 330,
  MAX_CHARGE_S: 0.5,
  /** kicker face height at the lip: the rider climbs this ramp and launches off
   * it (replaces the draw-only 34 and the retired pop-multiplier KICKER_BOOST) */
  LIP_RAISE: 80,
  /** convex-crest detach threshold: fly off when slopeCurvature(x) * vx² exceeds it (u/s²) */
  DETACH_G: 220,
  COYOTE_S: 0.1,
  BUFFER_S: 0.1,
  /** a hop shorter than this glues back silently — not a trick landing (s) */
  MIN_AIR_S: 0.25,
  /** deg/s while a rotation input is held (backflip via Space, spins via arrows) */
  SPIN_RATE: 420,
  SNAP_DEG: 20,
  LANDING_TOLERANCE_DEG: 35,
  CLEAN_BOOST: 60,
  SCRUB_FACTOR: 0.75,
  /** final rotation must have stopped within this window before touchdown for the late bonus */
  LATE_WINDOW_S: 0.3,
  /** how fast the landing impulse fades (units of impact/s) */
  IMPACT_DECAY: 4,
  GRIND_SNAP_DIST: 18,
  SURFACE_RAISE: 42,
  BAIL_TIME: 1.2,
  RESPAWN_LEAD: 600,
  GRIND_EXIT_POP: 200,
  /** finish-mode deceleration (u/s²) — bleeds a cruise-speed crossing to 0
   * over roughly 1.5s while the rider keeps gliding along the slope, instead
   * of the old hard stop. */
  FINISH_DECEL: 300,
} as const

export const BAIL_LINE = 'washed out — press R to retry the section'

const DEG = 180 / Math.PI

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Positive-modulo — result is always in [0, n). */
function mod(a: number, n: number): number {
  return ((a % n) + n) % n
}

/** Fold an angle (deg) to [-90, 90] — the board-vs-slope comparison range. */
function wrap180(deg: number): number {
  return mod(deg + 90, 180) - 90
}

/** Component of a velocity along the slope tangent. */
function project(vx: number, vy: number, angle: number): number {
  return vx * Math.cos(angle) + vy * Math.sin(angle)
}

/** Linear decay toward zero at `rate` per second. */
function decayTo0(v: number, dt: number, rate: number): number {
  const n = v - rate * dt
  return n < 0 ? 0 : n
}

export function createRider(course: Course): RiderState {
  return {
    mode: 'snow',
    x: 0,
    y: slopeY(0),
    vx: 0,
    vy: 0,
    speed: PHYS.START_SPEED,
    charge: 0,
    rotationDeg: 0,
    tucking: false,
    grabbing: false,
    grabHappened: false,
    launchAngleDeg: 0,
    attributedObstacle: null,
    grindLength: 0,
    bailTimer: 0,
    nextObstacle: 0,
    collected: course.obstacles.map(() => false),
    chain: 0,
    score: 0,
    bestTrick: null,
    lastEvent: null,
    bailed: false,
    time: 0,
    airtime: 0,
    rotationIdleS: 0,
    impact: 0,
    coyoteT: 0,
    bufferT: 0,
    justLanded: null,
    justLaunched: false,
    bigMoment: false,
  }
}

/** Linear interp between the obstacle's raised entry and exit heights. */
export function obstacleSurfaceY(o: CourseObstacle, x: number): number {
  const t = (x - o.x) / o.length
  const y0 = slopeY(o.x) - PHYS.SURFACE_RAISE
  const y1 = slopeY(o.x + o.length) - PHYS.SURFACE_RAISE
  return y0 + (y1 - y0) * t
}

/** The kicker face: a straight ramp from snow level at the entry to LIP_RAISE
 * above snow at the lip. Riding it up bleeds speed (negative sin); cresting the
 * lip at speed throws real air. `x` is clamped to the footprint. */
export function kickerSurfaceY(o: CourseObstacle, x: number): number {
  const t = clamp((x - o.x) / o.length, 0, 1)
  const y0 = slopeY(o.x)
  const y1 = slopeY(o.x + o.length) - PHYS.LIP_RAISE
  return y0 + (y1 - y0) * t
}

/** Tangent angle of the kicker face (rad). Negative points up-slope (screen-up)
 * — the source of the air. Straight ramp, so it's constant along the face. */
export function kickerFaceAngle(o: CourseObstacle): number {
  return Math.atan((slopeY(o.x + o.length) - PHYS.LIP_RAISE - slopeY(o.x)) / o.length)
}

export function stepRider(
  state: RiderState,
  input: RiderInput,
  dt: number,
  course: Course
): RiderState {
  const s = clearOneStepFlags(state)
  if (s.mode === 'finish') return stepFinish(s, dt)
  if (input.retryPressed) return respawn(s, course)
  switch (s.mode) {
    case 'snow':
      return stepSnow(s, input, dt, course)
    case 'air':
      return stepAir(s, input, dt, course)
    case 'grind':
      return stepGrind(s, input, dt, course)
    case 'bail':
      return stepBail(s, dt, course)
    default:
      return s
  }
}

/** One-step flags live for exactly the frame that set them. */
function clearOneStepFlags(s: RiderState): RiderState {
  if (s.justLanded === null && !s.justLaunched && !s.bigMoment) return s
  return { ...s, justLanded: null, justLaunched: false, bigMoment: false }
}

/** Reset the air/trick fields to their neutral values (charge/timers set by callers). */
function clearAir(): Pick<
  RiderState,
  'rotationDeg' | 'grabbing' | 'grabHappened' | 'grindLength' | 'airtime' | 'rotationIdleS'
> {
  return {
    rotationDeg: 0,
    grabbing: false,
    grabHappened: false,
    grindLength: 0,
    airtime: 0,
    rotationIdleS: 0,
  }
}

function decayImpact(impact: number, dt: number): number {
  return decayTo0(impact, dt, PHYS.IMPACT_DECAY)
}

/** Advance the `nextObstacle` cursor past everything the rider has cleared. */
function advanceObstacleCursor(x: number, nextObstacle: number, course: Course): number {
  let next = nextObstacle
  const os = course.obstacles
  while (next < os.length && x > os[next].x + os[next].length) next += 1
  return next
}

type ActiveKicker = { o: CourseObstacle; index: number }

/** The kicker whose footprint contains `x`, or null. Rails and boxes are grind
 * targets, not ride-up surfaces, so only kickers participate here. */
function activeKicker(x: number, course: Course): ActiveKicker | null {
  const os = course.obstacles
  for (let i = 0; i < os.length; i++) {
    const o = os[i]
    if (o.type === 'kicker' && x >= o.x && x <= o.x + o.length) return { o, index: i }
  }
  return null
}

type SnowMotion = {
  time: number
  speed: number
  x: number
  y: number
  nextObstacle: number
  charge: number
  impact: number
}

function stepSnow(
  state: RiderState,
  input: RiderInput,
  dt: number,
  course: Course
): RiderState {
  const time = state.time + dt
  const tucking = input.jumpHeld
  // Active surface: the kicker face when we're inside a kicker footprint, the
  // open slope otherwise. The face is a straight ramp, so its angle drives
  // pull/drag/advance exactly as the slope tangent does everywhere else.
  const active = activeKicker(state.x, course)
  const angle = active ? kickerFaceAngle(active.o) : slopeAngle(state.x)
  const pull = PHYS.GRAVITY * Math.sin(angle) * (tucking ? PHYS.TUCK_ACCEL : 1)
  const drag = PHYS.DRAG_K * state.speed * state.speed * (tucking ? PHYS.TUCK_DRAG : 1)
  const accel = pull - drag
  const speed = clamp(state.speed + accel * dt, PHYS.MIN_SPEED, PHYS.MAX_SPEED)
  const x = state.x + speed * dt * Math.cos(angle)
  const y = active ? kickerSurfaceY(active.o, x) : slopeY(x)
  const nextObstacle = advanceObstacleCursor(x, state.nextObstacle, course)
  const impact = decayImpact(state.impact, dt)

  // Releasing a held charge is a deliberate pop off the snow — aligned with the
  // active surface, banked to the kicker when it pops off the face.
  if (!input.jumpHeld && state.charge > 0) {
    return launch(state, { time, speed, x, y, nextObstacle, charge: 0, impact }, angle, active)
  }

  // Rode past a kicker lip → real air with velocity along the face (upward at
  // speed), no button, the air banked to the kicker.
  if (active && x > active.o.x + active.o.length) {
    return launchOffLip(
      state,
      { time, speed, x, y, nextObstacle, charge: state.charge, impact },
      angle,
      active,
      tucking
    )
  }

  const charge = tucking ? Math.min(state.charge + dt / PHYS.MAX_CHARGE_S, 1) : state.charge

  if (x >= course.finishX) {
    return { ...state, time, speed, x, y, nextObstacle, charge, impact, tucking, mode: 'finish' }
  }

  // Natural detach: a convex crest whose turn needs more than gravity can give.
  // Open slope only — the kicker face is straight (zero curvature); its launch
  // is the lip, handled above.
  if (!active) {
    const detachAngle = slopeAngle(x)
    const vxAir = Math.cos(detachAngle) * speed
    if (slopeCurvature(x) * vxAir * vxAir > PHYS.DETACH_G) {
      return detach(state, { time, speed, x, y, nextObstacle, charge, impact }, detachAngle, tucking)
    }
  }

  return { ...state, time, speed, x, y, nextObstacle, charge, impact, tucking, mode: 'snow' }
}

/** Leave the snow with an upward pop, aligned with the active surface. Off a
 * kicker face the pop stacks with the ramp and the air is banked to the kicker. */
function launch(
  state: RiderState,
  m: SnowMotion,
  angle: number,
  active: ActiveKicker | null
): RiderState {
  const pop = PHYS.BASE_POP + state.charge * PHYS.CHARGE_POP
  return {
    ...state,
    ...clearAir(),
    time: m.time,
    speed: m.speed,
    x: m.x,
    y: m.y,
    nextObstacle: m.nextObstacle,
    impact: m.impact,
    mode: 'air',
    vx: Math.cos(angle) * m.speed,
    vy: Math.sin(angle) * m.speed - pop,
    launchAngleDeg: angle * DEG,
    attributedObstacle: active ? active.index : null,
    charge: 0,
    tucking: false,
    coyoteT: 0,
    bufferT: 0,
    justLaunched: true,
  }
}

/** Ride off a kicker lip into real air: velocity carries along the face (upward
 * at speed), the kicker banks the air, and a coyote window keeps a late pop
 * alive — a natural detach that happens to be earned off a ramp. No button. */
function launchOffLip(
  state: RiderState,
  m: SnowMotion,
  angle: number,
  active: ActiveKicker,
  tucking: boolean
): RiderState {
  return {
    ...state,
    ...clearAir(),
    time: m.time,
    speed: m.speed,
    x: m.x,
    y: m.y,
    nextObstacle: m.nextObstacle,
    impact: m.impact,
    mode: 'air',
    vx: Math.cos(angle) * m.speed,
    vy: Math.sin(angle) * m.speed,
    launchAngleDeg: angle * DEG,
    attributedObstacle: active.index,
    charge: m.charge,
    tucking,
    coyoteT: PHYS.COYOTE_S,
    bufferT: 0,
    justLaunched: true,
  }
}

/** Slide off a crest ballistically (no pop); a coyote window keeps a late jump alive. */
function detach(state: RiderState, m: SnowMotion, angle: number, tucking: boolean): RiderState {
  return {
    ...state,
    ...clearAir(),
    time: m.time,
    speed: m.speed,
    x: m.x,
    y: m.y,
    nextObstacle: m.nextObstacle,
    impact: m.impact,
    mode: 'air',
    vx: Math.cos(angle) * m.speed,
    vy: Math.sin(angle) * m.speed,
    launchAngleDeg: angle * DEG,
    attributedObstacle: null,
    charge: m.charge,
    tucking,
    coyoteT: PHYS.COYOTE_S,
    bufferT: 0,
    justLaunched: true,
  }
}

function stepAir(
  state: RiderState,
  input: RiderInput,
  dt: number,
  course: Course
): RiderState {
  const time = state.time + dt
  const airtime = state.airtime + dt
  let vy = state.vy + PHYS.GRAVITY * dt
  const x = state.x + state.vx * dt
  const y = state.y + vy * dt
  const impact = decayImpact(state.impact, dt)
  const coyoteT = decayTo0(state.coyoteT, dt, 1)

  const spinning = input.spinDir !== 0 || input.jumpHeld
  const rotationDeg = spinning ? state.rotationDeg + PHYS.SPIN_RATE * dt : state.rotationDeg
  const rotationIdleS = spinning ? 0 : state.rotationIdleS + dt

  let charge = state.charge
  let bufferT = decayTo0(state.bufferT, dt, 1)
  // Coyote: a held jump released inside the grace window still pops.
  if (state.coyoteT > 0 && state.tucking && !input.jumpHeld) {
    vy -= PHYS.BASE_POP + charge * PHYS.CHARGE_POP
    charge = 0
  } else if (state.coyoteT <= 0 && input.jumpPressed) {
    bufferT = PHYS.BUFFER_S // buffer a late press for the coming landing
  }

  const moved: RiderState = {
    ...state,
    time,
    airtime,
    vy,
    x,
    y,
    impact,
    coyoteT,
    charge,
    bufferT,
    rotationDeg,
    rotationIdleS,
    grabbing: input.grabHeld,
    grabHappened: state.grabHappened || input.grabHeld,
    tucking: input.jumpHeld,
  }

  const snap = trySnapToRail(moved, course)
  if (snap) return snap
  if (moved.y >= slopeY(moved.x)) {
    // A hop too brief to be a trick (a crest micro-detach) glues back silently;
    // a grind-exit air always completes its trick, however short (the grind is
    // the earned action), so grindLength > 0 forces the landing bands to run.
    const completesTrick = moved.airtime >= PHYS.MIN_AIR_S || moved.grindLength > 0
    return completesTrick ? landOrBail(moved, course) : glueBack(moved)
  }
  return moved
}

/** Reconnect with the snow after a sub-trick hop: keep the chain, fire nothing. */
function glueBack(s: RiderState): RiderState {
  const angle = slopeAngle(s.x)
  return {
    ...s,
    ...clearAir(),
    mode: 'snow',
    y: slopeY(s.x),
    speed: clamp(project(s.vx, s.vy, angle), PHYS.MIN_SPEED, PHYS.MAX_SPEED),
    coyoteT: 0,
    bufferT: 0,
  }
}

/** If dropping onto a rail/box surface within reach, lock into a grind. */
function trySnapToRail(s: RiderState, course: Course): RiderState | null {
  if (s.vy < 0) return null
  const os = course.obstacles
  for (let i = 0; i < os.length; i++) {
    const o = os[i]
    if (o.type !== 'rail' && o.type !== 'box') continue
    if (s.x < o.x || s.x > o.x + o.length) continue
    if (Math.abs(s.y - obstacleSurfaceY(o, s.x)) < PHYS.GRIND_SNAP_DIST) {
      return {
        ...s,
        mode: 'grind',
        y: obstacleSurfaceY(o, s.x),
        speed: Math.max(s.vx, PHYS.MIN_SPEED),
        attributedObstacle: i,
      }
    }
  }
  return null
}

/** Board-vs-slope landing check: clean snaps and boosts, scrubbed bleeds speed, worse bails. */
function landOrBail(s: RiderState, course: Course): RiderState {
  const slopeAngleDeg = slopeAngle(s.x) * DEG
  const boardDiff = wrap180(s.launchAngleDeg + s.rotationDeg - slopeAngleDeg)
  const mag = Math.abs(boardDiff)
  if (mag > PHYS.LANDING_TOLERANCE_DEG) return bail(s)
  const angle = slopeAngle(s.x)
  const proj = project(s.vx, s.vy, angle)
  return mag <= PHYS.SNAP_DEG
    ? landClean(s, proj, angle, course)
    : landScrubbed(s, proj, angle)
}

function landClean(s: RiderState, proj: number, angle: number, course: Course): RiderState {
  const snapped = Math.round(s.rotationDeg / 180) * 180
  const speed = clamp(proj + PHYS.CLEAN_BOOST, PHYS.MIN_SPEED, PHYS.MAX_SPEED)
  const impact = clamp(Math.abs(s.vy) / 900, 0.2, 1)
  const chain = s.chain + 1
  const late = snapped >= 180 && s.rotationIdleS <= PHYS.LATE_WINDOW_S
  const big = snapped >= 360 || s.grindLength >= 100
  const landed: RiderState = {
    ...s,
    mode: 'snow',
    y: slopeY(s.x),
    speed,
    rotationDeg: snapped,
    chain,
    impact,
    coyoteT: 0,
    justLanded: 'clean',
    bigMoment: big,
  }
  return maybeBufferedRelaunch(bankTrick(landed, s, late, course), angle)
}

function landScrubbed(s: RiderState, proj: number, angle: number): RiderState {
  const speed = clamp(proj * PHYS.SCRUB_FACTOR, PHYS.MIN_SPEED, PHYS.MAX_SPEED)
  const impact = clamp(Math.abs(s.vy) / 900, 0.2, 1)
  // chain PRESERVED (no boost, no trick bank).
  const landed: RiderState = {
    ...s,
    mode: 'snow',
    y: slopeY(s.x),
    speed,
    impact,
    coyoteT: 0,
    justLanded: 'scrubbed',
  }
  return maybeBufferedRelaunch(landed, angle)
}

function bail(s: RiderState): RiderState {
  return {
    ...s,
    mode: 'bail',
    bailTimer: PHYS.BAIL_TIME,
    bailed: true,
    chain: 0,
    impact: 1,
    bigMoment: true,
  }
}

/** A jump buffered before touchdown fires as a zero-charge pop the instant we land. */
function maybeBufferedRelaunch(landed: RiderState, angle: number): RiderState {
  if (landed.bufferT <= 0) return landed
  return {
    ...landed,
    ...clearAir(),
    mode: 'air',
    vx: Math.cos(angle) * landed.speed,
    vy: Math.sin(angle) * landed.speed - PHYS.BASE_POP,
    launchAngleDeg: angle * DEG,
    attributedObstacle: null,
    charge: 0,
    coyoteT: 0,
    bufferT: 0,
    justLaunched: true,
  }
}

/** Award points for the trick attributed to obstacle `i` and mark it collected. */
function bankTrick(
  landed: RiderState,
  s: RiderState,
  late: boolean,
  course: Course
): RiderState {
  const i = s.attributedObstacle
  if (i === null || s.collected[i]) return landed
  const skill = course.obstacles[i].skill
  const trick = {
    rotationDeg: landed.rotationDeg,
    grab: s.grabHappened,
    grindLength: s.grindLength,
    late,
  }
  const name = trickName(trick)
  const points = trickScore(trick, skill.years, s.chain)
  const collected = s.collected.map((c, idx) => (idx === i ? true : c))
  const bestTrick =
    !s.bestTrick || points > s.bestTrick.points ? { name, points } : s.bestTrick
  return {
    ...landed,
    collected,
    score: s.score + points,
    lastEvent: { obstacleIndex: i, line: collectLine(name, skill), points, late },
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
  const impact = decayImpact(state.impact, dt)
  const o = course.obstacles[state.attributedObstacle ?? 0]
  const x = state.x + state.speed * dt
  const grindLength = state.grindLength + state.speed * dt
  const base: RiderState = { ...state, time, impact, x, grindLength, y: obstacleSurfaceY(o, x) }

  if (input.jumpPressed) return exitGrind(base, o, -PHYS.GRIND_EXIT_POP)
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
    airtime: 0,
    rotationIdleS: 0,
    coyoteT: 0,
    justLaunched: true,
  }
}

function stepBail(state: RiderState, dt: number, course: Course): RiderState {
  const time = state.time + dt
  const impact = decayImpact(state.impact, dt)
  const bailTimer = state.bailTimer - dt
  if (bailTimer <= 0) return respawn({ ...state, time }, course)
  return { ...state, time, impact, bailTimer }
}

/** Finish crescendo: ease speed to 0 at FINISH_DECEL while still advancing
 * along the slope, instead of freezing in place the instant the mode flips.
 * Retry is intentionally not handled here (see stepRider) — the run is over;
 * "run it back" is the shell's restart, not a mid-glide respawn. */
function stepFinish(state: RiderState, dt: number): RiderState {
  const time = state.time + dt
  const speed = decayTo0(state.speed, dt, PHYS.FINISH_DECEL)
  const x = speed > 0 ? advanceAlongSlope(state.x, speed * dt) : state.x
  return { ...state, time, speed, x, y: slopeY(x) }
}

/** Drop the rider back on the snow a lead-in before the next obstacle. */
function respawn(state: RiderState, course: Course): RiderState {
  const target = course.obstacles[Math.min(state.nextObstacle, course.obstacles.length - 1)]
  const x = Math.max(0, target.x - PHYS.RESPAWN_LEAD)
  return {
    ...state,
    ...clearAir(),
    mode: 'snow',
    x,
    y: slopeY(x),
    vx: 0,
    vy: 0,
    speed: PHYS.START_SPEED,
    launchAngleDeg: 0,
    attributedObstacle: null,
    bailTimer: 0,
    bailed: false,
    charge: 0,
    tucking: false,
    coyoteT: 0,
    bufferT: 0,
    impact: 0,
    chain: 0,
  }
}
