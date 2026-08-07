import { describe, expect, it } from 'vitest'
import {
  addForceAt,
  atLength,
  createRope,
  ropeLength,
  setHand,
  stepRope,
} from '@/lib/labs/cloth-pull/rope'

const OPTS = {
  handX: 288,
  handY: 360,
  anchorX: 1555,
  anchorY: 270,
  viewportH: 900,
}

function settle(rope: ReturnType<typeof createRope>, frames: number, env = {}) {
  for (let f = 0; f < frames; f++) {
    stepRope(rope, 1 / 60, { time: 0, tension: 0, wind: 0, ...env })
  }
}

describe('createRope', () => {
  it('spans hand to anchor with slight slack over the straight distance', () => {
    const rope = createRope(OPTS)
    const straight = Math.hypot(OPTS.anchorX - OPTS.handX, OPTS.anchorY - OPTS.handY)
    expect(ropeLength(rope)).toBeGreaterThan(straight)
    expect(ropeLength(rope)).toBeLessThan(straight * 1.1)
    expect(rope.pts[0].pin).toBe(true)
    expect(rope.pts[rope.n - 1].pin).toBe(true)
  })
})

describe('stepRope', () => {
  it('settles: point motion decays below a tenth of a px per frame', () => {
    const rope = createRope(OPTS)
    settle(rope, 240)
    let maxMove = 0
    for (const q of rope.pts) {
      maxMove = Math.max(maxMove, Math.hypot(q.x - q.px, q.y - q.py))
    }
    expect(maxMove).toBeLessThan(0.1)
  })

  it('is deterministic for identical inputs', () => {
    const a = createRope(OPTS)
    const b = createRope(OPTS)
    for (let f = 0; f < 60; f++) {
      const env = { time: f / 60, tension: 0.3, wind: 1 }
      stepRope(a, 1 / 60, env)
      stepRope(b, 1 / 60, env)
    }
    expect(a.pts[20].x).toBe(b.pts[20].x)
    expect(a.pts[20].y).toBe(b.pts[20].y)
  })

  it('tension visibly tautens the settled line (less sag depth)', () => {
    const slack = createRope(OPTS)
    const taut = createRope(OPTS)
    settle(slack, 240, { tension: 0 })
    settle(taut, 240, { tension: 1 })
    const sagOf = (rope: typeof slack) => {
      let worst = 0
      for (const q of rope.pts) {
        const t =
          (q.x - OPTS.handX) / (OPTS.anchorX - OPTS.handX)
        const base = OPTS.handY + (OPTS.anchorY - OPTS.handY) * t
        worst = Math.max(worst, q.y - base)
      }
      return worst
    }
    expect(sagOf(taut)).toBeLessThan(sagOf(slack) * 0.75)
  })

  it('the hand pin follows setHand exactly', () => {
    const rope = createRope(OPTS)
    setHand(rope, 200, 500)
    stepRope(rope, 1 / 60, { time: 0, tension: 0, wind: 0 })
    expect(rope.pts[0].x).toBe(200)
    expect(rope.pts[0].y).toBe(500)
  })

  it('never produces NaN under a violent hand yank', () => {
    const rope = createRope(OPTS)
    settle(rope, 30)
    setHand(rope, OPTS.handX - 600, OPTS.handY + 400)
    settle(rope, 30, { tension: 1.3, wind: 1 })
    for (const q of rope.pts) {
      expect(Number.isFinite(q.x)).toBe(true)
      expect(Number.isFinite(q.y)).toBe(true)
    }
  })
})

describe('atLength', () => {
  it('hits both endpoints and is monotonic in x along a settled rope', () => {
    const rope = createRope(OPTS)
    settle(rope, 120)
    const start = atLength(rope, 0)
    const end = atLength(rope, ropeLength(rope))
    expect(start.x).toBeCloseTo(rope.pts[0].x, 0)
    expect(end.x).toBeCloseTo(rope.pts[rope.n - 1].x, 0)
    let prev = -Infinity
    for (let s = 0; s <= ropeLength(rope); s += 50) {
      const p = atLength(rope, s)
      expect(p.x).toBeGreaterThanOrEqual(prev - 1)
      prev = p.x
    }
  })

  it('clamps out-of-range s instead of exploding', () => {
    const rope = createRope(OPTS)
    const under = atLength(rope, -500)
    const over = atLength(rope, ropeLength(rope) + 500)
    expect(under.x).toBeCloseTo(rope.pts[0].x, 0)
    expect(over.x).toBeCloseTo(rope.pts[rope.n - 1].x, 0)
  })
})

describe('addForceAt', () => {
  it('deflects the rope near the applied arc position, not elsewhere', () => {
    const loaded = createRope(OPTS)
    const free = createRope(OPTS)
    const s = ropeLength(loaded) * 0.5
    for (let f = 0; f < 240; f++) {
      addForceAt(loaded, s, 0, 12000)
      stepRope(loaded, 1 / 60, { time: 0, tension: 0, wind: 0 })
      stepRope(free, 1 / 60, { time: 0, tension: 0, wind: 0 })
    }
    let maxDy = 0
    let maxI = 0
    for (let i = 0; i < loaded.n; i++) {
      const dy = loaded.pts[i].y - free.pts[i].y
      if (dy > maxDy) {
        maxDy = dy
        maxI = i
      }
    }
    const dyFar = Math.abs(loaded.pts[4].y - free.pts[4].y)
    expect(maxDy).toBeGreaterThan(10)
    expect(Math.abs(maxI - (loaded.n >> 1))).toBeLessThanOrEqual(6)
    expect(dyFar).toBeLessThan(maxDy * 0.35)
  })

  it('never moves the pinned endpoints', () => {
    const rope = createRope(OPTS)
    addForceAt(rope, 1, 0, 1e6)
    addForceAt(rope, ropeLength(rope) - 1, 0, 1e6)
    stepRope(rope, 1 / 60, { time: 0, tension: 0, wind: 0 })
    expect(rope.pts[0].y).toBe(OPTS.handY)
    expect(rope.pts[rope.n - 1].y).toBe(OPTS.anchorY)
  })
})
