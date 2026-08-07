import { describe, expect, it } from 'vitest'
import {
  bottomLeadingCorner,
  createSwing,
  poseBanner,
  stepSwing,
  textCalmFactor,
  type BannerDims,
} from '@/lib/labs/cloth-pull/banner'
import { CFG } from '@/lib/labs/cloth-pull/config'
import { atLength, createChain, stepChain } from '@/lib/labs/cloth-pull/chain'

const CHAIN_OPTS = {
  fistX: 1080,
  fistY: 420,
  stringLen: 80,
  hemLen: 620,
  viewportH: 900,
}

const DIMS: BannerDims = { width: 600, height: 216, segX: 24, segY: 10 }
const NX = DIMS.segX + 1
const NY = DIMS.segY + 1

function settledChain() {
  const chain = createChain(CHAIN_OPTS)
  for (let f = 0; f < 300; f++) {
    stepChain(chain, 1 / 60, { time: 0, speed: 0, wind: 0 })
  }
  return chain
}

function pose(time = 0, energy = 0.4, speed = 0) {
  const chain = settledChain()
  const sw = createSwing()
  const out = new Float32Array(NX * NY * 3)
  poseBanner(out, chain, sw, DIMS, { time, energy, speed, dt: 1 / 60 })
  return { chain, out }
}

describe('poseBanner', () => {
  it('hangs the top edge just below the chain hem span', () => {
    const { chain, out } = pose()
    for (const i of [0, NX >> 1, NX - 1]) {
      const u = i / DIMS.segX
      const top = atLength(chain, CHAIN_OPTS.stringLen + u * DIMS.width)
      const o = i * 3
      const dist = Math.hypot(out[o] - top.x, out[o + 1] - top.y)
      expect(dist).toBeLessThan(CFG.banner.hemChannel * 3 + 8)
      expect(out[o + 1]).toBeGreaterThan(top.y - 2)
    }
  })

  it('the leading column (u=0) sits nearest her; trailing column far left', () => {
    const { out } = pose()
    const lead = out[0]
    const trail = out[(NX - 1) * 3]
    expect(lead).toBeGreaterThan(trail + DIMS.width * 0.8)
  })

  it('rows hang progressively lower and rake pushes the hem back in z', () => {
    const { out } = pose()
    const col = NX >> 1
    let prevY = -Infinity
    for (let j = 0; j < NY; j++) {
      const o = (j * NX + col) * 3
      expect(out[o + 1]).toBeGreaterThan(prevY)
      prevY = out[o + 1]
    }
    const zTop = out[(0 * NX + col) * 3 + 2]
    const zHem = out[((NY - 1) * NX + col) * 3 + 2]
    expect(zHem).toBeLessThan(zTop - 30)
  })

  it('speed tilts the hang backward (toward -x, the trailing side)', () => {
    const still = pose(0, 0.4, 0)
    const moving = pose(0, 0.4, CFG.motion.cruise)
    const col = NX >> 1
    const hemO = ((NY - 1) * NX + col) * 3
    const topO = (0 * NX + col) * 3
    const stillLean = still.out[hemO] - still.out[topO]
    const movingLean = moving.out[hemO] - moving.out[topO]
    expect(movingLean).toBeLessThan(stillLean - 20)
  })

  it('feeds the cloth weight back into the chain along the hem span', () => {
    const chain = settledChain()
    const sw = createSwing()
    const out = new Float32Array(NX * NY * 3)
    poseBanner(out, chain, sw, DIMS, { time: 0, energy: 0, speed: 0, dt: 1 / 60 })
    let totalFy = 0
    for (const q of chain.pts) totalFy += q.fy
    expect(totalFy).toBeCloseTo(CFG.banner.weight, 0)
    expect(chain.pts[0].fy).toBe(0)
  })

  it('produces only finite values at violent energy and speed', () => {
    const { out } = pose(12.3, 1.2, 300)
    for (let i = 0; i < out.length; i++) {
      expect(Number.isFinite(out[i])).toBe(true)
    }
  })
})

describe('bottomLeadingCorner', () => {
  it('returns the bottom row, leading column vertex', () => {
    const { out } = pose()
    const c = bottomLeadingCorner(out, DIMS)
    const o = DIMS.segY * NX * 3
    expect(c.x).toBe(out[o])
    expect(c.y).toBe(out[o + 1])
    expect(c.z).toBe(out[o + 2])
    // bottom-leading: right of the trailing bottom corner, below the top row
    expect(c.y).toBeGreaterThan(out[1])
  })
})

describe('textCalmFactor', () => {
  it('calms the type region and leaves the borders raging', () => {
    const center = textCalmFactor(0.5, 0.45)
    const edgeU = textCalmFactor(0.02, 0.45)
    const hem = textCalmFactor(0.5, 0.98)
    expect(center).toBeLessThan(1 - CFG.banner.textCalm * 0.9)
    expect(edgeU).toBeGreaterThan(0.97)
    expect(hem).toBeGreaterThan(0.97)
  })
})

describe('stepSwing', () => {
  it('kicks on hang-point acceleration then decays back toward zero', () => {
    const sw = createSwing()
    stepSwing(sw, 1 / 60, 0, 0, 0)
    let x = 0
    for (let f = 0; f < 12; f++) {
      x += 40
      stepSwing(sw, 1 / 60, x, 0, f / 60)
    }
    const kicked = Math.abs(sw.theta)
    expect(kicked).toBeGreaterThan(0.0005)
    for (let f = 0; f < 600; f++) {
      stepSwing(sw, 1 / 60, x, 0, (f + 12) / 60)
    }
    expect(Math.abs(sw.theta)).toBeLessThan(kicked * 0.2)
  })

  it('stays clamped inside swingMax under absurd input', () => {
    const sw = createSwing()
    stepSwing(sw, 1 / 60, 0, 0, 0)
    for (let f = 0; f < 120; f++) {
      stepSwing(sw, 1 / 60, f % 2 === 0 ? 4000 : -4000, 1.2, f / 60)
    }
    expect(Math.abs(sw.theta)).toBeLessThanOrEqual(CFG.banner.swingMax + 1e-9)
  })
})
