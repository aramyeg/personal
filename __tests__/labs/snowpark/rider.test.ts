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
    expect(s.x).toBeCloseTo(Math.max(0, course.obstacles[3].x - RESPAWN_LEAD), -2)
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
