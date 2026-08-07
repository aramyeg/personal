import { describe, expect, it } from 'vitest'
import {
  AMP_CAP,
  BEND_UNIFORM,
  HOVER_SCALE,
  NOTE_CORNER_ZONE,
  NOTE_CURL_MAX,
  PECK,
  PRESS_CLICK,
  PRESS_EPS,
  RATTLE,
  RATTLE_UNIFORM,
  ROCK_PARAMS,
  SQUASH_PARAMS,
  hitPadFor,
  impulseFor,
  nudgeArmedFor,
  nudgeNormalChunk,
  nudgeVertexChunk,
  rayBoxHit,
  restingPeck,
  restingPress,
  restingRattle,
  restingSpring,
  restingSquash,
  samplePeck,
  samplePress,
  sampleRattle,
  sampleRock,
  sampleSquash,
  tipDirFrom,
  triggerPeck,
  triggerPress,
  triggerRattle,
  triggerRock,
  triggerSquash,
  zonesForMesh,
} from '@/components/labs/small-world/scene/props/desk-nudge'
import { DESK_PAD } from '@/components/labs/small-world/scene/props/desk-glb-contract'
import { DESK_NOTE } from '@/components/labs/small-world/scene/desk-stage'
import { STUDIO_LIGHTS_FULL } from '@/components/labs/small-world/scene/desk-studio'
import type { EndingState } from '@/components/labs/small-world/ending-timeline'

/**
 * The desk's pointer responses, held as arithmetic (Task 89). The law the module carries — pointer
 * initiated, deterministic, always decaying to EXACT rest — is enforced here clause by clause and
 * SIGNATURE BY SIGNATURE, because a law nobody can fail is decoration.
 */

const ending = (zoom: number): EndingState => ({ active: true, t: 1, phase: 'settled' as never, stand: 1, zoom })

describe('the rockers: mug, pen cup, recoil, weeble', () => {
  it('a click from rest crests at exactly the authored peak (equal-frequency kinds)', () => {
    for (const kind of ['mug', 'pencup', 'bird'] as const) {
      const p = ROCK_PARAMS[kind]!
      const s = restingSpring()
      triggerRock(s, p, 0, 1, 0, 1)
      const out = new Float32Array(4)
      let peak = 0
      for (let t = 0; t < 1; t += 0.001) {
        sampleRock(s, p, t, out)
        if (out[3] > peak) peak = out[3]
      }
      const want = (p.peakDeg * Math.PI) / 180
      expect(peak).toBeGreaterThan(want * 0.995)
      expect(peak).toBeLessThan(want * 1.005)
    }
  })

  it('mug and pen cup settle inside the 700 ms budget and snap to EXACT zero', () => {
    for (const kind of ['mug', 'pencup', 'bird'] as const) {
      const p = ROCK_PARAMS[kind]!
      const s = restingSpring()
      triggerRock(s, p, 0, 0.6, -0.8, 1)
      const out = new Float32Array([9, 9, 9, 9])
      const peak = (p.peakDeg * Math.PI) / 180
      sampleRock(s, p, 0.7, out)
      expect(Math.abs(out[3])).toBeLessThan(peak * 0.025)
      let live = true
      for (let t = 0.7; t < 4 && live; t += 1 / 60) live = sampleRock(s, p, t, out)
      expect(live).toBe(false)
      expect(Object.is(out[3], 0)).toBe(true)
      // once resting, sampling costs nothing and writes nothing
      out[3] = 123
      expect(sampleRock(s, p, 5, out)).toBe(false)
      expect(out[3]).toBe(123)
    }
  })

  it("the penguin is the slow one — still audibly wobbling when everyone else is done, settled by ~2.6 s, exact zero after", () => {
    const p = ROCK_PARAMS.penguin!
    const s = restingSpring()
    triggerRock(s, p, 0, 1, 0, 1)
    const out = new Float32Array(4)
    const peak = (p.peakDeg * Math.PI) / 180
    sampleRock(s, p, 0.7, out)
    // at the others' budget it is still visibly going — that contrast is the character
    expect(out[3]).toBeGreaterThan(peak * 0.2)
    sampleRock(s, p, 2.6, out)
    expect(out[3]).toBeLessThan(peak * 0.05)
    let live = true
    for (let t = 2.6; t < 10 && live; t += 1 / 60) live = sampleRock(s, p, t, out)
    expect(live).toBe(false)
    expect(Object.is(out[3], 0)).toBe(true)
  })

  it("the weeble PRECESSES: detuned axes + quadrature rotate the wobble's axis as it settles", () => {
    const p = ROCK_PARAMS.penguin!
    const s = restingSpring()
    triggerRock(s, p, 0, 1, 0, 1)
    const out = new Float32Array(4)
    // the DOMINANT swing direction (the axis at the biggest crest) inside a window — sampling at
    // zero crossings would read noise, so each window votes with its largest excursion
    const dominantLine = (t0: number, t1: number): number => {
      let bestM = -1
      let ang = 0
      for (let t = t0; t < t1; t += 0.004) {
        sampleRock(s, p, t, out)
        if (out[3] > bestM) {
          bestM = out[3]
          ang = Math.atan2(out[2], out[0])
        }
      }
      return ang
    }
    // a planar rock holds one line for its whole life (angle constant mod π); the weeble's
    // detuned axes dephase at (hzZ − hzX)·2π rad/s, so the line visibly turns between windows
    const a0 = dominantLine(0, 0.45)
    const a1 = dominantLine(1.35, 1.8)
    const raw = Math.abs(a1 - a0) % Math.PI
    const turn = Math.min(raw, Math.PI - raw)
    expect(turn).toBeGreaterThan(0.15)
    // ...and a control: the mug (no detune, no quadrature) holds its line
    const pm = ROCK_PARAMS.mug!
    const sm = restingSpring()
    triggerRock(sm, pm, 0, 1, 0, 1)
    let m0 = 0
    let m1 = 0
    let b0 = -1
    let b1 = -1
    for (let t = 0; t < 0.2; t += 0.002) {
      sampleRock(sm, pm, t, out)
      if (out[3] > b0) {
        b0 = out[3]
        m0 = Math.atan2(out[2], out[0])
      }
    }
    for (let t = 0.3; t < 0.5; t += 0.002) {
      sampleRock(sm, pm, t, out)
      if (out[3] > b1) {
        b1 = out[3]
        m1 = Math.atan2(out[2], out[0])
      }
    }
    const rawM = Math.abs(m1 - m0) % Math.PI
    expect(Math.min(rawM, Math.PI - rawM)).toBeLessThan(0.02)
  })

  it('tips AWAY from the poke: the impulse direction is where the top goes', () => {
    const p = ROCK_PARAMS.mug!
    const s = restingSpring()
    triggerRock(s, p, 0, 1, 0, 1) // tip toward +x
    const out = new Float32Array(4)
    sampleRock(s, p, 0.05, out)
    // cross((ax,0,az), (0,1,0)) = (-az, 0, ax): the top's first-order motion is sin(m)·(-az, ax)
    const [ax, , az, m] = out
    expect(-az * Math.sin(m)).toBeGreaterThan(0)
    expect(Math.abs(ax * Math.sin(m))).toBeLessThan(1e-9)
  })

  it('re-triggering is velocity-continuous: the angle does not jump at the second poke', () => {
    const p = ROCK_PARAMS.mug!
    const s = restingSpring()
    triggerRock(s, p, 0, 1, 0, 1)
    const out = new Float32Array(4)
    sampleRock(s, p, 0.119, out)
    const beforeX = out[0] * out[3]
    const beforeZ = out[2] * out[3]
    triggerRock(s, p, 0.12, 0, 1, HOVER_SCALE)
    sampleRock(s, p, 0.1201, out)
    expect(Math.abs(out[0] * out[3] - beforeX)).toBeLessThan(0.002)
    expect(Math.abs(out[2] * out[3] - beforeZ)).toBeLessThan(0.002)
  })

  it('spam cannot wind a rock past the cap', () => {
    const p = ROCK_PARAMS.bird!
    const s = restingSpring()
    const out = new Float32Array(4)
    let peak = 0
    for (let i = 0; i < 40; i++) {
      triggerRock(s, p, i * 0.05, 1, 0, 1)
      for (let t = i * 0.05; t < i * 0.05 + 0.05; t += 0.002) {
        sampleRock(s, p, t, out)
        if (out[3] > peak) peak = out[3]
      }
    }
    expect(peak).toBeLessThanOrEqual(((p.peakDeg * Math.PI) / 180) * AMP_CAP * 1.02)
  })

  it('the impulse is deterministic arithmetic — same inputs, same frames', () => {
    const p = ROCK_PARAMS.pencup!
    const a = restingSpring()
    const b = restingSpring()
    triggerRock(a, p, 0.5, 0.3, -0.7, 1)
    triggerRock(b, p, 0.5, 0.3, -0.7, 1)
    const oa = new Float32Array(4)
    const ob = new Float32Array(4)
    for (let t = 0.5; t < 1.5; t += 0.013) {
      sampleRock(a, p, t, oa)
      sampleRock(b, p, t, ob)
      expect(oa).toEqual(ob)
    }
    expect(impulseFor(p)).toBe(impulseFor(p))
  })
})

describe("the donut's jelly squish", () => {
  it('crests at the authored squash, overshoots into a stretch, settles to EXACT zero', () => {
    const s = restingSquash()
    triggerSquash(s, 0, 1)
    let peak = 0
    let trough = 0
    for (let t = 0; t < 1.5; t += 0.001) {
      const v = sampleSquash(s, t)
      if (v > peak) peak = v
      if (v < trough) trough = v
    }
    expect(peak).toBeGreaterThan(SQUASH_PARAMS.peak * 0.99)
    expect(peak).toBeLessThan(SQUASH_PARAMS.peak * 1.05)
    // the stretch-tall half of squash-and-stretch: a real negative lobe
    expect(trough).toBeLessThan(-SQUASH_PARAMS.peak * 0.4)
    expect(Object.is(sampleSquash(s, 3), 0)).toBe(true)
    expect(s.active).toBe(false)
  })

  it('is settled inside the 700 ms budget', () => {
    const s = restingSquash()
    triggerSquash(s, 0, 1)
    expect(Math.abs(sampleSquash(s, 0.7))).toBeLessThan(SQUASH_PARAMS.peak * 0.05)
  })

  it('a hover is a gentler squish of the same shape', () => {
    const s = restingSquash()
    triggerSquash(s, 0, HOVER_SCALE)
    let peak = 0
    for (let t = 0; t < 0.5; t += 0.001) peak = Math.max(peak, sampleSquash(s, t))
    expect(peak).toBeGreaterThan(SQUASH_PARAMS.peak * HOVER_SCALE * 0.95)
    expect(peak).toBeLessThan(SQUASH_PARAMS.peak * HOVER_SCALE * 1.1)
  })
})

describe("the pens' rattle", () => {
  it('decays inside the budget and snaps to EXACT zero', () => {
    const s = restingRattle()
    triggerRattle(s, 0, 1)
    expect(sampleRattle(s, 0)).toBeCloseTo(RATTLE.amp, 5)
    expect(sampleRattle(s, 0.7)).toBeLessThan(RATTLE.amp * 0.05)
    let v = 1
    for (let t = 0.7; t < 4 && v !== 0; t += 1 / 60) v = sampleRattle(s, t)
    expect(Object.is(v, 0)).toBe(true)
    expect(s.amp).toBe(0)
  })

  it('re-triggers stack continuously and cap out', () => {
    const s = restingRattle()
    triggerRattle(s, 0, 1)
    const before = sampleRattle(s, 0.1)
    triggerRattle(s, 0.1, 1)
    // the envelope may only step UP by at most one fresh impulse, and never over the cap
    const after = sampleRattle(s, 0.1)
    expect(after).toBeGreaterThanOrEqual(before)
    expect(after).toBeLessThanOrEqual(RATTLE.cap)
    for (let i = 0; i < 20; i++) triggerRattle(s, 0.2 + i * 0.01, 1)
    expect(sampleRattle(s, 0.4)).toBeLessThanOrEqual(RATTLE.cap)
  })

  it('the spatial phase splits pens without shearing one: cross-cup spread ≫ within-pen spread', () => {
    // pens stand ~0.66 u apart across the cup and are ~0.1 u thick
    const phase = (x: number, z: number) => x * RATTLE.kx + z * RATTLE.kz
    const acrossCup = Math.abs(phase(3.19, 11.86) - phase(2.57, 11.7))
    const withinPen = Math.abs(phase(2.67, 11.72) - phase(2.57, 11.7))
    expect(acrossCup).toBeGreaterThan(1.5)
    expect(withinPen).toBeLessThan(0.45)
  })
})

describe("the bird's peck", () => {
  it('pecks twice — two crests, the second lighter — and returns to EXACT zero', () => {
    const s = restingPeck()
    triggerPeck(s, 0, 1)
    const vals: number[] = []
    for (let t = 0; t < 0.8; t += 0.002) vals.push(samplePeck(s, t))
    const crests: number[] = []
    for (let i = 1; i < vals.length - 1; i++) {
      if (vals[i] > vals[i - 1] && vals[i] >= vals[i + 1] && vals[i] > 0.01) crests.push(vals[i])
    }
    expect(crests.length).toBe(2)
    expect(crests[0]).toBeGreaterThan(PECK.depth * 0.9)
    expect(crests[1]).toBeLessThan(crests[0])
    expect(crests[1]).toBeGreaterThan(PECK.depth * 0.4)
    expect(Object.is(samplePeck(s, 2), 0)).toBe(true)
  })

  it('is settled inside the 700 ms budget', () => {
    const s = restingPeck()
    triggerPeck(s, 0, 1)
    expect(samplePeck(s, 0.7)).toBeLessThan(PECK.depth * 0.05)
  })

  it('a re-peck mid-peck deepens through max(), never pops to rest first', () => {
    const s = restingPeck()
    triggerPeck(s, 0, 1)
    const before = samplePeck(s, 0.1)
    triggerPeck(s, 0.1, 1)
    expect(Math.abs(samplePeck(s, 0.1) - before)).toBeLessThan(1e-9)
  })

  it('the neck band sits inside the bird: the bend cannot reach the desk', () => {
    expect(PECK.neckLo).toBeGreaterThan(1.24)
    expect(PECK.neckHi).toBeGreaterThan(PECK.neckLo)
    expect(PECK.neckHi).toBeLessThan(1.96)
  })
})

describe("the note's press: paper, downward only", () => {
  it('never rises above the authored curl and returns to EXACTLY 1', () => {
    const s = restingPress()
    triggerPress(s, 0, PRESS_CLICK)
    let min = 1
    for (let t = 0; t < 2; t += 0.001) {
      const v = samplePress(s, t)
      expect(v).toBeLessThanOrEqual(1)
      expect(v).toBeGreaterThanOrEqual(1 - PRESS_CLICK)
      if (v < min) min = v
    }
    expect(min).toBeLessThan(1 - PRESS_CLICK + PRESS_EPS * 3)
    expect(Object.is(samplePress(s, 3), 1)).toBe(true)
  })

  it('is settled inside the 700 ms budget', () => {
    const s = restingPress()
    triggerPress(s, 0, PRESS_CLICK)
    expect(1 - samplePress(s, 0.7)).toBeLessThan(0.02)
  })

  it('a re-press mid-release is continuous and deepens again', () => {
    const s = restingPress()
    triggerPress(s, 0, PRESS_CLICK)
    const before = samplePress(s, 0.3)
    triggerPress(s, 0.3, PRESS_CLICK)
    expect(Math.abs(samplePress(s, 0.3) - before)).toBeLessThan(1e-9)
    let min = 1
    for (let t = 0.3; t < 0.5; t += 0.002) {
      const v = samplePress(s, t)
      expect(v).toBeLessThanOrEqual(before + 0.03)
      if (v < min) min = v
    }
    expect(min).toBeLessThan(1 - PRESS_CLICK + 0.02)
  })

  it('the sheet ceiling holds: curl scale 1 IS the authored geometry, and the corner zone spans it', () => {
    expect(NOTE_CURL_MAX).toBeCloseTo(DESK_NOTE.top - DESK_NOTE.lift, 12)
    expect(NOTE_CORNER_ZONE.max[1]).toBeGreaterThan(DESK_PAD.top + DESK_NOTE.top)
    expect(NOTE_CORNER_ZONE.min[1]).toBe(DESK_PAD.top)
  })
})

describe('arming and aiming', () => {
  it('arms exactly when the studio is fully lit, like the dpr floor and the full parallax', () => {
    expect(nudgeArmedFor(ending(STUDIO_LIGHTS_FULL))).toBe(true)
    expect(nudgeArmedFor(ending(STUDIO_LIGHTS_FULL - 1e-9))).toBe(false)
    expect(nudgeArmedFor(ending(0))).toBe(false)
    expect(nudgeArmedFor(ending(1))).toBe(true)
  })

  it('ray vs box: hits, misses, and inside-start', () => {
    const min = [-1, -1, -1] as const
    const max = [1, 1, 1] as const
    expect(rayBoxHit(0, 0, 5, 0, 0, -1, min, max)).toBeCloseTo(4)
    expect(rayBoxHit(3, 0, 5, 0, 0, -1, min, max)).toBeNull()
    expect(rayBoxHit(0, 0, 0, 0, 0, -1, min, max)).toBe(0)
    expect(rayBoxHit(0, 0, 5, 0, 0, 1, min, max)).toBeNull()
  })

  it('the 44 px floor pads small targets and leaves the desk props alone', () => {
    expect(hitPadFor(0.8, 9.7, 30, 900)).toBe(0)
    const pad = hitPadFor(0.05, 9.7, 30, 900)
    const worldPerPx = (2 * 9.7 * Math.tan((30 * Math.PI) / 360)) / 900
    expect(0.05 + 2 * pad).toBeCloseTo(44 * worldPerPx, 10)
  })

  it('the tip direction points from the poke through the centre, with a forward fallback', () => {
    const [dx, dz] = tipDirFrom([1, 0, 0], [2, 0, 0], [0, 1])
    expect(dx).toBeCloseTo(1)
    expect(dz).toBeCloseTo(0)
    const [fx, fz] = tipDirFrom([2, 0, 0], [2, 0, 0.01], [0.6, 0.8])
    expect(fx).toBeCloseTo(0.6)
    expect(fz).toBeCloseTo(0.8)
  })
})

describe('the shader chunks: the signatures are in the codegen', () => {
  it('every field is guarded behind an exact-zero test — the rest path is the untouched path', () => {
    for (const mesh of ['DeskBaked', 'DeskMetal', 'DeskGloss'] as const) {
      const zones = zonesForMesh(mesh)
      const { decl, body } = nudgeVertexChunk(mesh)
      for (const z of zones) {
        expect(decl).toContain(`uniform vec4 uNudge_${z.kind};`)
        expect(body).toContain(`uNudge_${z.kind}.w != 0.0`)
      }
    }
  })

  it('each object gets its OWN field, not a copy of its neighbour’s', () => {
    const baked = nudgeVertexChunk('DeskBaked')
    // the donut squashes — scale, not Rodrigues
    expect(baked.body).toMatch(/uNudge_donut[\s\S]*?transformed\.xz = vec2/)
    expect(baked.body).not.toMatch(/uNudge_donut[\s\S]{0,400}cross\( swAx/)
    // the pens rattle above the measured rim, with the spatial phase
    expect(baked.body).toContain('uRattle_pencup.x != 0.0')
    expect(baked.body).toContain(RATTLE.rimY.toFixed(5))
    expect(baked.body).toContain(RATTLE.kx.toFixed(5))
    // the bird bends over a smooth neck band — no rigid head split
    expect(baked.body).toContain('uBend_bird.x != 0.0')
    expect(baked.body).toContain('smoothstep')
    // uniforms travel with the chunk
    expect(baked.uniforms.uRattle_pencup).toBe(RATTLE_UNIFORM)
    expect(baked.uniforms.uBend_bird).toBe(BEND_UNIFORM)
  })

  it('meshes and zones agree with the contract', () => {
    expect(zonesForMesh('DeskBaked').map((z) => z.kind)).toEqual(['mug', 'donut', 'pencup', 'bird', 'penguin'])
    expect(zonesForMesh('DeskMetal').map((z) => z.kind)).toEqual(['mug', 'pencup'])
    expect(zonesForMesh('DeskGloss').map((z) => z.kind)).toEqual(['donut'])
    expect(zonesForMesh('DeskSurface')).toEqual([])
  })

  it('the metal rattles its gold pen but never bends or squashes', () => {
    const metal = nudgeVertexChunk('DeskMetal')
    expect(metal.body).toContain('uRattle_pencup.x != 0.0')
    expect(metal.body).not.toContain('uBend_bird')
    expect(metal.body).not.toContain('uNudge_donut')
  })

  it("the gloss squashes the icing's normal by the inverse scale, so the sheen flattens too", () => {
    const gloss = nudgeVertexChunk('DeskGloss', 'swNrm')
    expect(gloss.body).toContain('swNrm.y / swY')
    expect(gloss.body).toContain('transformed.xz')
  })

  it('the normal twin turns only the rockers (a rattle translates, it does not turn)', () => {
    const chunk = nudgeNormalChunk('DeskMetal', 'objectNormal')
    expect(chunk).toContain('objectNormal =')
    expect(chunk).toContain('uNudge_mug.w != 0.0')
    expect(chunk).toContain('uNudge_pencup.w != 0.0')
    expect(chunk).not.toContain('transformed')
    expect(chunk).not.toContain('uRattle')
  })
})
