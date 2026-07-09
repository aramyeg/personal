import { describe, expect, it } from 'vitest'
import { compileCourse } from '@/components/labs/snowpark/course'
import {
  slopeAngle,
  slopeCurvature,
  slopeGradient,
  slopeY,
} from '@/components/labs/snowpark/slope'
import {
  PHYS,
  createRider,
  obstacleSurfaceY,
  stepRider,
  type RiderInput,
  type RiderState,
} from '@/components/labs/snowpark/rider'

const course = compileCourse()
const DEG = 180 / Math.PI
const slopeAngleDeg = (x: number): number => slopeAngle(x) * DEG

const idle: RiderInput = {
  jumpHeld: false,
  jumpPressed: false,
  grabHeld: false,
  spinDir: 0,
  retryPressed: false,
}

/** Step at a fixed 120 Hz for `seconds`. */
function run(state: RiderState, input: RiderInput, seconds: number): RiderState {
  const dt = 1 / 120
  let s = state
  for (let t = 0; t < seconds; t += dt) s = stepRider(s, input, dt, course)
  return s
}

/**
 * Build an airborne state positioned just above the snow at `landingX` so that a
 * single step touches down. `launchAngleDeg` is chosen so the board-vs-slope diff
 * at touchdown equals `diff` degrees (accounting for any pre-set `rotationDeg`).
 */
function airAboveLanding(opts: {
  landingX: number
  diff: number
  rotationDeg?: number
  vx?: number
  vy?: number
  aboveBy?: number
  chain?: number
  rotationIdleS?: number
  attributedObstacle?: number | null
}): RiderState {
  const {
    landingX,
    diff,
    rotationDeg = 0,
    aboveBy = 0.5,
    chain = 0,
    rotationIdleS = 0,
    attributedObstacle = null,
  } = opts
  const a = slopeAngle(landingX)
  const vx = opts.vx ?? Math.cos(a) * 300
  const vy = opts.vy ?? 220
  return {
    ...createRider(course),
    mode: 'air',
    x: landingX,
    y: slopeY(landingX) - aboveBy,
    vx,
    vy,
    launchAngleDeg: slopeAngleDeg(landingX) + diff - rotationDeg,
    rotationDeg,
    rotationIdleS,
    chain,
    attributedObstacle,
    airtime: 0.3,
  }
}

describe('createRider', () => {
  it('starts on snow at x=0 glued to the slope, chain 0, one collected slot per obstacle', () => {
    const s = createRider(course)
    expect(s.mode).toBe('snow')
    expect(s.x).toBe(0)
    expect(s.y).toBeCloseTo(slopeY(0), 6)
    expect(s.chain).toBe(0)
    expect(s.collected).toHaveLength(course.obstacles.length)
    expect(s.collected.every((c) => c === false)).toBe(true)
    expect(s.score).toBe(0)
  })

  it('never mutates a frozen state when stepped', () => {
    const s = createRider(course)
    const frozen = Object.freeze({ ...s, collected: Object.freeze([...s.collected]) })
    expect(() => stepRider(frozen as RiderState, idle, 1 / 60, course)).not.toThrow()
  })
})

describe('snow momentum', () => {
  it('converges toward a sub-MAX equilibrium under quadratic drag (no railing)', () => {
    // Linear drag let idle rail at MAX; quadratic drag settles speed into a band
    // that tracks the local slope (~150–360 on this curve) — never a wall at MAX.
    const dt = 1 / 120
    let s = createRider(course)
    const speeds: number[] = []
    for (let t = 0; t < 8; t += dt) {
      s = stepRider(s, idle, dt, course)
      if (t > 1) speeds.push(s.speed) // drop the startup transient
    }
    const max = Math.max(...speeds)
    const min = Math.min(...speeds)
    expect(max).toBeLessThan(PHYS.MAX_SPEED - 60) // never rails at MAX
    expect(min).toBeGreaterThanOrEqual(PHYS.MIN_SPEED)
    expect(max - min).toBeGreaterThan(30) // oscillates around a moving equilibrium
  })

  it('tucking sustains far more speed than idling and charges to full', () => {
    // Equilibria desync the two riders' positions, so compare AVERAGE speed over
    // the run rather than a single instant (a fixed-time point can invert).
    const dt = 1 / 120
    let si = createRider(course)
    let st = createRider(course)
    let sumI = 0
    let sumT = 0
    let n = 0
    for (let t = 0; t < 3; t += dt) {
      si = stepRider(si, idle, dt, course)
      st = stepRider(st, { ...idle, jumpHeld: true }, dt, course)
      sumI += si.speed
      sumT += st.speed
      n += 1
    }
    expect(sumT / n).toBeGreaterThan(sumI / n + 80)
    expect(st.charge).toBeGreaterThan(0.99)
  })
})

describe('natural detach', () => {
  it('leaves the snow off a convex crest at 120 Hz when curvature outruns gravity', () => {
    // Curvature peaks where the primary and secondary rollers beat into phase
    // (~every 3260 u), NOT within a single primary period; the first such crest
    // is near x≈2600. The rule is frame-rate independent, so a normal 1/120 step
    // fires there at top speed (the intended "earn your air near max speed" tune).
    let crestX = 0
    let maxK = -Infinity
    for (let x = 0; x <= 4000; x += 1) {
      const k = slopeCurvature(x)
      if (k > maxK) {
        maxK = k
        crestX = x
      }
    }
    const vx = Math.cos(slopeAngle(crestX)) * PHYS.MAX_SPEED
    expect(slopeCurvature(crestX) * vx * vx).toBeGreaterThan(PHYS.DETACH_G) // precondition
    const s0: RiderState = {
      ...createRider(course),
      x: crestX,
      y: slopeY(crestX),
      speed: PHYS.MAX_SPEED,
    }
    const s = stepRider(s0, idle, 1 / 120, course)
    expect(s.mode).toBe('air')
    expect(s.justLaunched).toBe(true)
    expect(s.coyoteT).toBeCloseTo(PHYS.COYOTE_S, 5)
  })

  it('treats sub-MIN_AIR_S crest hops as neutral — no clean landings, chain untouched', () => {
    // Riding a beat crest at top speed detaches and re-lands within a few frames
    // (< MIN_AIR_S), which must glue back silently rather than bank a "clean".
    let crestX = 0
    let maxK = -Infinity
    for (let x = 0; x <= 4000; x += 1) {
      const k = slopeCurvature(x)
      if (k > maxK) {
        maxK = k
        crestX = x
      }
    }
    let s: RiderState = {
      ...createRider(course),
      x: crestX,
      y: slopeY(crestX),
      speed: PHYS.MAX_SPEED,
    }
    let sawAir = false
    let hops = 0
    let anyJustLanded = false
    let prevMode = s.mode
    const dt = 1 / 120
    for (let t = 0; t < 1; t += dt) {
      s = stepRider(s, idle, dt, course)
      if (s.mode === 'air') sawAir = true
      if (prevMode === 'air' && s.mode === 'snow') hops += 1
      if (s.justLanded !== null) anyJustLanded = true
      prevMode = s.mode
    }
    expect(sawAir).toBe(true)
    expect(hops).toBeGreaterThanOrEqual(1) // detached and re-landed at least once
    expect(anyJustLanded).toBe(false)
    expect(s.chain).toBe(0)
  })
})

describe('forgiveness windows', () => {
  it('coyote: a held jump released inside the grace window still pops', () => {
    // A rider who tucked off a lip (coyote window open, charge carried) and
    // releases the button a beat later gets the full pop applied to vy.
    const a = slopeAngle(1400)
    const detached: RiderState = {
      ...createRider(course),
      mode: 'air',
      x: 1400,
      y: slopeY(1400) - 50,
      vx: Math.cos(a) * 250,
      vy: Math.sin(a) * 250,
      launchAngleDeg: slopeAngleDeg(1400),
      coyoteT: PHYS.COYOTE_S,
      tucking: true,
      charge: 0.2,
      airtime: 0.02,
    }
    const released = stepRider(detached, idle, 1 / 120, course)
    expect(released.vy).toBeLessThanOrEqual(detached.vy - PHYS.BASE_POP * 0.9)
  })

  it('buffer: a jump pressed just before touchdown re-launches on landing', () => {
    let s = airAboveLanding({ landingX: 2000, diff: 0, aboveBy: 20, vy: 250 })
    s = stepRider(s, { ...idle, jumpPressed: true }, 1 / 120, course) // arm the buffer
    expect(s.bufferT).toBeGreaterThan(0)
    for (let i = 0; i < 30 && s.justLanded === null; i++) {
      s = stepRider(s, idle, 1 / 120, course)
    }
    expect(s.justLanded).toBe('clean')
    expect(s.mode).toBe('air') // buffered pop fired the instant we landed
  })
})

describe('air rotation', () => {
  it('rotates continuously while a rotation input is held', () => {
    const airborne: RiderState = {
      ...createRider(course),
      mode: 'air',
      x: 1400,
      y: slopeY(1400) - 400,
      vx: 200,
      vy: -100,
      launchAngleDeg: slopeAngleDeg(1400),
    }
    const s = run(airborne, { ...idle, jumpHeld: true }, 0.5)
    expect(s.mode).toBe('air')
    expect(s.rotationDeg).toBeGreaterThan(PHYS.SPIN_RATE * 0.5 - 5)
    expect(s.rotationDeg).toBeLessThan(PHYS.SPIN_RATE * 0.5 + 5)
  })
})

describe('landing quality', () => {
  it('snap-clean: a small board diff snaps rotation, boosts speed, marks clean', () => {
    const s0 = airAboveLanding({ landingX: 2000, diff: 15 })
    const dt = 1 / 120
    const movedVy = s0.vy + PHYS.GRAVITY * dt
    const movedX = s0.x + s0.vx * dt
    const movedAngle = slopeAngle(movedX)
    const proj = s0.vx * Math.cos(movedAngle) + movedVy * Math.sin(movedAngle)

    const landed = stepRider(s0, idle, dt, course)
    expect(landed.justLanded).toBe('clean')
    expect(landed.rotationDeg % 180).toBe(0)
    expect(landed.speed).toBeGreaterThanOrEqual(proj + PHYS.CLEAN_BOOST * 0.5)
    expect(landed.chain).toBe(1)
  })

  it('scrubbed: a middling board diff lands, bleeds speed, preserves the chain', () => {
    const s0 = airAboveLanding({ landingX: 2000, diff: 28, chain: 2 })
    const dt = 1 / 120
    const movedVy = s0.vy + PHYS.GRAVITY * dt
    const movedX = s0.x + s0.vx * dt
    const movedAngle = slopeAngle(movedX)
    const proj = s0.vx * Math.cos(movedAngle) + movedVy * Math.sin(movedAngle)

    const landed = stepRider(s0, idle, dt, course)
    expect(landed.justLanded).toBe('scrubbed')
    expect(landed.chain).toBe(2)
    expect(landed.speed).toBeLessThan(proj)
  })

  it('bail: a large board diff wipes out and resets the chain', () => {
    const s0 = airAboveLanding({ landingX: 2000, diff: 50, chain: 3 })
    const landed = stepRider(s0, idle, 1 / 120, course)
    expect(landed.mode).toBe('bail')
    expect(landed.chain).toBe(0)
    expect(landed.bigMoment).toBe(true)
  })

  it('late bonus: a rotation finished just before a clean landing banks late', () => {
    const kickerIdx = course.obstacles.findIndex((o) => o.type === 'kicker')
    expect(kickerIdx).toBeGreaterThanOrEqual(0)
    const s0 = airAboveLanding({
      landingX: 2000,
      diff: 0,
      rotationDeg: 180,
      rotationIdleS: 0.1,
      attributedObstacle: kickerIdx,
    })
    const landed = stepRider(s0, idle, 1 / 120, course)
    expect(landed.justLanded).toBe('clean')
    expect(landed.lastEvent?.late).toBe(true)
  })
})

describe('grind', () => {
  it('snaps onto a rail when falling onto it and accumulates grind length', () => {
    const rail = course.obstacles.find((o) => o.type === 'rail')!
    const idx = course.obstacles.indexOf(rail)
    const s0: RiderState = {
      ...createRider(course),
      mode: 'air',
      x: rail.x + 5,
      y: obstacleSurfaceY(rail, rail.x + 5) - 10,
      vx: PHYS.START_SPEED,
      vy: 40,
      nextObstacle: idx,
    }
    const s = stepRider(s0, idle, 1 / 120, course)
    expect(s.mode).toBe('grind')
    expect(s.attributedObstacle).toBe(idx)
    const later = run(s, idle, 0.3)
    expect(later.grindLength).toBeGreaterThan(0)
  })

  it('grind then ollie into a clean landing collects the skill and raises the chain', () => {
    const rail = course.obstacles.find((o) => o.type === 'rail')!
    const idx = course.obstacles.indexOf(rail)
    let s: RiderState = {
      ...createRider(course),
      mode: 'air',
      x: rail.x + 5,
      y: obstacleSurfaceY(rail, rail.x + 5) - 10,
      vx: 300,
      vy: 40,
      nextObstacle: idx,
      chain: 1,
    }
    s = run(s, idle, 0.4) // snap on and grind a stretch of the rail
    expect(s.mode).toBe('grind')
    // Ollie off (GRIND_EXIT_POP gives a full air arc, clearing MIN_AIR_S); a
    // low roll-off would glue back silently on gentle sections — see report.
    s = stepRider(s, { ...idle, jumpPressed: true }, 1 / 120, course)
    for (let i = 0; i < 240 && !s.collected[idx]; i++) s = stepRider(s, idle, 1 / 120, course)
    expect(s.collected[idx]).toBe(true)
    expect(s.chain).toBeGreaterThan(1)
    expect(s.score).toBeGreaterThan(0)
    expect(s.lastEvent?.line).toContain(rail.skill.name)
  })

  it('grind roll-off (no jump) on a gentle section still banks the skill', () => {
    // The gentlest rail gives the shortest roll-off air; grindLength (not airtime)
    // is what completes the trick here, so the skill must still bank.
    const rail = course.obstacles
      .filter((o) => o.type === 'rail')
      .reduce((a, b) =>
        slopeGradient(b.x + b.length) < slopeGradient(a.x + a.length) ? b : a
      )
    const idx = course.obstacles.indexOf(rail)
    let s: RiderState = {
      ...createRider(course),
      mode: 'air',
      x: rail.x + 5,
      y: obstacleSurfaceY(rail, rail.x + 5) - 10,
      vx: PHYS.START_SPEED,
      vy: 40,
      nextObstacle: idx,
      chain: 2,
    }
    for (let i = 0; i < 600 && !s.collected[idx]; i++) s = stepRider(s, idle, 1 / 120, course)
    expect(s.collected[idx]).toBe(true)
    expect(s.chain).toBeGreaterThan(2)
    expect(s.score).toBeGreaterThan(0)
  })

  it('a sub-MIN_AIR_S grind-exit air still completes the trick (grindLength banks it)', () => {
    // Fully controlled guard: 0.1 s of air (below MIN_AIR_S) but grindLength > 0.
    const rail = course.obstacles.find((o) => o.type === 'rail')!
    const idx = course.obstacles.indexOf(rail)
    const landingX = rail.x + rail.length + 40
    const a = slopeAngle(landingX)
    const s0: RiderState = {
      ...createRider(course),
      mode: 'air',
      x: landingX,
      y: slopeY(landingX) - 0.5,
      vx: Math.cos(a) * 250,
      vy: 200,
      launchAngleDeg: slopeAngleDeg(landingX), // boardDiff ≈ 0 → clean
      grindLength: 150,
      airtime: 0.1,
      attributedObstacle: idx,
    }
    expect(s0.airtime).toBeLessThan(PHYS.MIN_AIR_S) // would glue without the grind clause
    const landed = stepRider(s0, idle, 1 / 120, course)
    expect(landed.justLanded).toBe('clean')
    expect(landed.collected[idx]).toBe(true)
    expect(landed.lastEvent?.line).toContain(rail.skill.name)
  })
})

describe('bail and respawn', () => {
  it('respawns on snow RESPAWN_LEAD before the next obstacle, keeping score and collected', () => {
    const s0 = createRider(course)
    const bailed: RiderState = {
      ...s0,
      mode: 'bail',
      bailTimer: PHYS.BAIL_TIME,
      bailed: true,
      score: 500,
      nextObstacle: 3,
      x: course.obstacles[3].x - 700,
    }
    const s = run(bailed, idle, PHYS.BAIL_TIME + 0.1)
    expect(s.mode).toBe('snow')
    expect(s.bailed).toBe(false)
    expect(s.score).toBe(500)
    expect(s.x).toBeCloseTo(Math.max(0, course.obstacles[3].x - PHYS.RESPAWN_LEAD), -2)
    expect(s.y).toBeCloseTo(slopeY(s.x), 4)
  })

  it('R retries the section instantly from any live mode', () => {
    const s0 = { ...createRider(course), x: 400, nextObstacle: 1 }
    const s = stepRider(s0, { ...idle, retryPressed: true }, 1 / 120, course)
    expect(s.mode).toBe('snow')
    expect(s.x).toBeCloseTo(Math.max(0, course.obstacles[1].x - PHYS.RESPAWN_LEAD), 0)
  })

  it('R retry resets the chain (respawn is unconditional)', () => {
    const s0 = { ...createRider(course), x: 400, nextObstacle: 1, chain: 5 }
    const s = stepRider(s0, { ...idle, retryPressed: true }, 1 / 120, course)
    expect(s.mode).toBe('snow')
    expect(s.chain).toBe(0)
  })
})

describe('finish', () => {
  it('enters finish mode past finishX and decelerates to a stop within 2s', () => {
    const nearEnd: RiderState = { ...createRider(course), x: course.finishX - 50 }
    const s = run(nearEnd, idle, 2)
    expect(s.mode).toBe('finish')
    expect(s.speed).toBe(0)
    const after = stepRider(s, idle, 1 / 120, course)
    expect(after.x).toBe(s.x)
  })

  it('still advances along the slope while decelerating, unlike the old hard stop', () => {
    const nearEnd: RiderState = { ...createRider(course), x: course.finishX - 50 }
    const justCrossed = run(nearEnd, idle, 0)
    // Drive a couple of snow steps to actually cross finishX, then confirm
    // the very next finish-mode step still moves x (speed hasn't decayed
    // away yet at FINISH_DECEL = 300 u/s²).
    let s = justCrossed
    while (s.mode !== 'finish') s = stepRider(s, idle, 1 / 120, course)
    const xAtFinish = s.x
    const after = stepRider(s, idle, 1 / 120, course)
    expect(after.mode).toBe('finish')
    expect(after.x).toBeGreaterThan(xAtFinish)
    expect(after.speed).toBeLessThan(s.speed)
  })
})

describe('obstacleSurfaceY', () => {
  it('sits SURFACE_RAISE above the snow at both ends of the obstacle', () => {
    const rail = course.obstacles.find((o) => o.type === 'rail')!
    expect(obstacleSurfaceY(rail, rail.x)).toBeCloseTo(slopeY(rail.x) - PHYS.SURFACE_RAISE, 6)
    expect(obstacleSurfaceY(rail, rail.x + rail.length)).toBeCloseTo(
      slopeY(rail.x + rail.length) - PHYS.SURFACE_RAISE,
      6
    )
  })
})
