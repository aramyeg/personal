import { describe, expect, it } from 'vitest'
import {
  addForceAt,
  atLength,
  chainLength,
  createChain,
  fistStretch,
  grabChain,
  nearestHemIndex,
  releaseChain,
  setFist,
  stepChain,
} from '@/lib/labs/cloth-pull/chain'

const OPTS = {
  fistX: 1080,
  fistY: 420,
  stringLen: 80,
  hemLen: 700,
  viewportH: 900,
}

function settle(
  chain: ReturnType<typeof createChain>,
  frames: number,
  env: Partial<{ time: number; speed: number; wind: number }> = {}
) {
  for (let f = 0; f < frames; f++) {
    stepChain(chain, 1 / 60, { time: 0, speed: 0, wind: 0, ...env })
  }
}

describe('createChain', () => {
  it('trails leftward from the fist with the designed length', () => {
    const chain = createChain(OPTS)
    expect(chain.pts[0].x).toBe(OPTS.fistX)
    const end = chain.pts[chain.n - 1]
    expect(end.x).toBeLessThan(OPTS.fistX - OPTS.hemLen * 0.9)
    expect(chainLength(chain)).toBeGreaterThan(OPTS.stringLen + OPTS.hemLen * 0.95)
  })
})

describe('stepChain', () => {
  it('settles onto the drooping baseline: free end below the fist, motion dies', () => {
    const chain = createChain(OPTS)
    settle(chain, 300)
    let maxMove = 0
    for (const q of chain.pts) {
      maxMove = Math.max(maxMove, Math.hypot(q.x - q.px, q.y - q.py))
    }
    expect(maxMove).toBeLessThan(0.15)
    const end = chain.pts[chain.n - 1]
    expect(end.y).toBeGreaterThan(OPTS.fistY + 20)
  })

  it('is deterministic for identical inputs', () => {
    const a = createChain(OPTS)
    const b = createChain(OPTS)
    for (let f = 0; f < 60; f++) {
      const env = { time: f / 60, speed: 80, wind: 1 }
      stepChain(a, 1 / 60, env)
      stepChain(b, 1 / 60, env)
    }
    expect(a.pts[20].x).toBe(b.pts[20].x)
    expect(a.pts[20].y).toBe(b.pts[20].y)
  })

  it('travel speed streams the chain flatter than standing still', () => {
    const still = createChain(OPTS)
    const moving = createChain(OPTS)
    settle(still, 300, { speed: 0 })
    settle(moving, 300, { speed: 110 })
    const droopOf = (c: typeof still) => {
      let worst = 0
      for (const q of c.pts) worst = Math.max(worst, q.y - OPTS.fistY)
      return worst
    }
    expect(droopOf(moving)).toBeLessThan(droopOf(still) * 0.85)
  })

  it('the fist pin follows setFist exactly', () => {
    const chain = createChain(OPTS)
    setFist(chain, 1000, 500)
    stepChain(chain, 1 / 60, { time: 0, speed: 0, wind: 0 })
    expect(chain.pts[0].x).toBe(1000)
    expect(chain.pts[0].y).toBe(500)
  })

  it('a grabbed point sits exactly at the pointer and stretches the lead segments', () => {
    const chain = createChain(OPTS)
    settle(chain, 120)
    const idx = nearestHemIndex(chain, chain.pts[chain.n - 4].x, chain.pts[chain.n - 4].y)
    grabChain(chain, idx)
    const restStretch = fistStretch(chain)
    const gx = OPTS.fistX - OPTS.stringLen - OPTS.hemLen - 260
    const gy = OPTS.fistY + 60
    for (let f = 0; f < 120; f++) {
      stepChain(chain, 1 / 60, { time: 0, speed: 0, wind: 0, grabX: gx, grabY: gy })
    }
    expect(chain.pts[idx].x).toBe(gx)
    expect(chain.pts[idx].y).toBe(gy)
    expect(fistStretch(chain)).toBeGreaterThan(restStretch + 0.01)
  })

  it('release lets the chain spring back toward the baseline', () => {
    const chain = createChain(OPTS)
    settle(chain, 120)
    const idx = chain.n - 3
    grabChain(chain, idx)
    const gx = OPTS.fistX - OPTS.stringLen - OPTS.hemLen - 300
    for (let f = 0; f < 60; f++) {
      stepChain(chain, 1 / 60, { time: 0, speed: 0, wind: 0, grabX: gx, grabY: OPTS.fistY })
    }
    releaseChain(chain)
    settle(chain, 360)
    const end = chain.pts[chain.n - 1]
    const baselineEndX = OPTS.fistX - chain.length
    expect(Math.abs(end.x - baselineEndX)).toBeLessThan(60)
    expect(fistStretch(chain)).toBeLessThan(0.02)
  })

  it('never produces NaN under a violent grab yank at speed', () => {
    const chain = createChain(OPTS)
    grabChain(chain, chain.n - 2)
    for (let f = 0; f < 90; f++) {
      const gx = OPTS.fistX + (f % 2 === 0 ? 800 : -1600)
      stepChain(chain, 1 / 60, { time: f / 60, speed: 110, wind: 1, grabX: gx, grabY: 100 })
    }
    for (const q of chain.pts) {
      expect(Number.isFinite(q.x)).toBe(true)
      expect(Number.isFinite(q.y)).toBe(true)
    }
  })
})

describe('atLength / addForceAt / nearestHemIndex', () => {
  it('atLength hits both ends and clamps out-of-range s', () => {
    const chain = createChain(OPTS)
    settle(chain, 120)
    const start = atLength(chain, 0)
    const end = atLength(chain, chainLength(chain))
    expect(start.x).toBeCloseTo(chain.pts[0].x, 0)
    expect(end.x).toBeCloseTo(chain.pts[chain.n - 1].x, 0)
    const under = atLength(chain, -500)
    expect(under.x).toBeCloseTo(chain.pts[0].x, 0)
  })

  it('addForceAt deflects near the tap, much less at the fist end', () => {
    const loaded = createChain(OPTS)
    const free = createChain(OPTS)
    const s = OPTS.stringLen + OPTS.hemLen * 0.5
    for (let f = 0; f < 240; f++) {
      addForceAt(loaded, s, 0, 9000)
      stepChain(loaded, 1 / 60, { time: 0, speed: 0, wind: 0 })
      stepChain(free, 1 / 60, { time: 0, speed: 0, wind: 0 })
    }
    let maxDy = 0
    for (let i = 0; i < loaded.n; i++) {
      maxDy = Math.max(maxDy, loaded.pts[i].y - free.pts[i].y)
    }
    const dyNearFist = Math.abs(loaded.pts[2].y - free.pts[2].y)
    expect(maxDy).toBeGreaterThan(10)
    expect(dyNearFist).toBeLessThan(maxDy * 0.35)
  })

  it('nearestHemIndex never returns a string-run point', () => {
    const chain = createChain(OPTS)
    settle(chain, 60)
    const idx = nearestHemIndex(chain, OPTS.fistX, OPTS.fistY)
    expect(chain.cum[idx]).toBeGreaterThanOrEqual(OPTS.stringLen)
  })
})
