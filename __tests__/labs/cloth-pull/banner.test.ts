import { describe, expect, it } from 'vitest'
import {
  createSwing,
  poseBanner,
  stepSwing,
  textCalmFactor,
  type BannerDims,
} from '@/lib/labs/cloth-pull/banner'
import { CFG } from '@/lib/labs/cloth-pull/config'
import { atLength, createRope, ropeLength, stepRope } from '@/lib/labs/cloth-pull/rope'

const ROPE_OPTS = {
  handX: 288,
  handY: 360,
  anchorX: 1555,
  anchorY: 270,
  viewportH: 900,
}

const DIMS: BannerDims = { width: 600, height: 216, segX: 24, segY: 10 }
const NX = DIMS.segX + 1
const NY = DIMS.segY + 1

function settledRope() {
  const rope = createRope(ROPE_OPTS)
  for (let f = 0; f < 240; f++) {
    stepRope(rope, 1 / 60, { time: 0, tension: 0, wind: 0 })
  }
  return rope
}

function pose(time = 0, energy = 0.4) {
  const rope = settledRope()
  const sw = createSwing()
  const out = new Float32Array(NX * NY * 3)
  poseBanner(out, rope, sw, DIMS, {
    sMid: ropeLength(rope) * 0.55,
    time,
    energy,
    dt: 1 / 60,
  })
  return { rope, out }
}

describe('poseBanner', () => {
  it('hangs the top edge from the sampled rope curve (thread length below it)', () => {
    const { rope, out } = pose()
    const sMid = ropeLength(rope) * 0.55
    for (const i of [0, NX >> 1, NX - 1]) {
      const u = i / DIMS.segX
      const top = atLength(rope, sMid - DIMS.width / 2 + u * DIMS.width)
      const o = i * 3
      const dx = out[o] - top.x
      const dy = out[o + 1] - top.y
      const dist = Math.hypot(dx, dy)
      expect(dist).toBeGreaterThan(CFG.banner.threadLen * 0.5)
      expect(dist).toBeLessThan(CFG.banner.threadLen * 2.2)
      expect(dy).toBeGreaterThan(0)
    }
  })

  it('rows hang progressively lower (y-down) and rake pushes the hem back', () => {
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

  it('wave displacement is near zero at the pinned top corners', () => {
    const { rope, out } = pose(3.7, 1.0)
    const sMid = ropeLength(rope) * 0.55
    for (const i of [0, NX - 1]) {
      const u = i / DIMS.segX
      const top = atLength(rope, sMid - DIMS.width / 2 + u * DIMS.width)
      const o = i * 3
      const off = Math.hypot(out[o] - top.x, out[o + 1] - top.y)
      expect(off).toBeLessThan(CFG.banner.threadLen * 1.6)
      expect(Math.abs(out[o + 2])).toBeLessThan(8)
    }
  })

  it('feeds the banner weight back into the rope at the loop points', () => {
    const rope = settledRope()
    const sw = createSwing()
    const out = new Float32Array(NX * NY * 3)
    poseBanner(out, rope, sw, DIMS, {
      sMid: ropeLength(rope) * 0.55,
      time: 0,
      energy: 0,
      dt: 1 / 60,
    })
    let totalFy = 0
    let loadedPts = 0
    for (const q of rope.pts) {
      totalFy += q.fy
      if (q.fy > 0) loadedPts++
    }
    expect(totalFy).toBeCloseTo(CFG.banner.weight, 0)
    expect(loadedPts).toBeGreaterThanOrEqual(CFG.banner.loops)
    expect(rope.pts[0].fy).toBe(0)
    expect(rope.pts[rope.n - 1].fy).toBe(0)
  })

  it('produces only finite values at violent energy', () => {
    const { out } = pose(12.3, 1.2)
    for (let i = 0; i < out.length; i++) {
      expect(Number.isFinite(out[i])).toBe(true)
    }
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
