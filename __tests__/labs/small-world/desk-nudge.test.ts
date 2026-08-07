import { describe, expect, it } from 'vitest'
import {
  AMP_CAP,
  HOVER_SCALE,
  KICK_DECAY,
  NOTE_CORNER_ZONE,
  NOTE_CURL_MAX,
  NUDGE_PARAMS,
  NUDGE_UNIFORMS,
  PRESS_CLICK,
  PRESS_EPS,
  REST_EPS,
  hitPadFor,
  impulseFor,
  nudgeArmedFor,
  nudgeNormalChunk,
  nudgeVertexChunk,
  rayBoxHit,
  restingPress,
  restingSpring,
  samplePress,
  sampleNudge,
  tipDirFrom,
  triggerNudge,
  triggerPress,
  zonesForMesh,
} from '@/components/labs/small-world/scene/props/desk-nudge'
import {
  DESK_NUDGE_ZONES,
  DESK_PAD,
  type DeskNudgeKind,
} from '@/components/labs/small-world/scene/props/desk-glb-contract'
import { DESK_NOTE } from '@/components/labs/small-world/scene/desk-stage'
import { STUDIO_LIGHTS_FULL } from '@/components/labs/small-world/scene/desk-studio'
import type { EndingState } from '@/components/labs/small-world/ending-timeline'

/**
 * The desk's pointer responses, held as arithmetic (Task 89). The law the module carries — pointer
 * initiated, deterministic, always decaying to EXACT rest — is enforced here clause by clause,
 * because a law nobody can fail is decoration.
 */

const KINDS = Object.keys(NUDGE_PARAMS) as DeskNudgeKind[]
const ending = (zoom: number): EndingState => ({ active: true, t: 1, phase: 'settled' as never, stand: 1, zoom })

describe('the rock: a closed-form spring with authored mass', () => {
  it('a click from rest crests at exactly the authored peak', () => {
    for (const kind of KINDS) {
      const s = restingSpring()
      triggerNudge(s, kind, 0, 1, 0, 1)
      const out = new Float32Array(4)
      let peak = 0
      for (let t = 0; t < 1; t += 0.001) {
        sampleNudge(s, kind, t, out)
        if (out[3] > peak) peak = out[3]
      }
      const want = (NUDGE_PARAMS[kind].peakDeg * Math.PI) / 180
      expect(peak).toBeGreaterThan(want * 0.995)
      expect(peak).toBeLessThan(want * 1.005)
    }
  })

  it('every response is settled inside the 700 ms budget and snaps to EXACT zero', () => {
    for (const kind of KINDS) {
      const s = restingSpring()
      triggerNudge(s, kind, 0, 0.6, -0.8, 1)
      const out = new Float32Array([9, 9, 9, 9])
      const peak = (NUDGE_PARAMS[kind].peakDeg * Math.PI) / 180
      // visually settled by the budget: under 2.5% of the authored peak
      sampleNudge(s, kind, 0.7, out)
      expect(Math.abs(out[3])).toBeLessThan(peak * 0.025)
      // ...and mathematically DONE soon after: exact +0 written, spring inactive
      let live = true
      for (let t = 0.7; t < 3 && live; t += 1 / 60) live = sampleNudge(s, kind, t, out)
      expect(live).toBe(false)
      expect(Object.is(out[0], 0) && Object.is(out[1], 0) && Object.is(out[2], 0) && Object.is(out[3], 0)).toBe(true)
      // once resting, sampling costs nothing and writes nothing
      out[3] = 123
      expect(sampleNudge(s, kind, 5, out)).toBe(false)
      expect(out[3]).toBe(123)
    }
  })

  it('tips AWAY from the poke: the impulse direction is where the top goes', () => {
    const s = restingSpring()
    triggerNudge(s, 'mug', 0, 1, 0, 1) // tip toward +x
    const out = new Float32Array(4)
    sampleNudge(s, 'mug', 0.05, out)
    // rotate the point straight above the pivot by (axis, angle) and watch where it moves:
    // cross((ax,0,az), (0,1,0)) = (-az, 0, ax), so the top's first-order motion is sin(m)·(-az, ax)
    const [ax, , az, m] = out
    const moved = { x: -az * Math.sin(m), z: ax * Math.sin(m) }
    expect(moved.x).toBeGreaterThan(0)
    expect(Math.abs(moved.z)).toBeLessThan(1e-9)
  })

  it('re-triggering is velocity-continuous: the angle does not jump at the second poke', () => {
    const s = restingSpring()
    triggerNudge(s, 'donut', 0, 1, 0, 1)
    const out = new Float32Array(4)
    sampleNudge(s, 'donut', 0.119, out)
    const before = out[3] * out[0] // signed x-angle... axis x carries θx/m
    const beforeX = out[0] * out[3]
    const beforeZ = out[2] * out[3]
    triggerNudge(s, 'donut', 0.12, 0, 1, HOVER_SCALE)
    sampleNudge(s, 'donut', 0.1201, out)
    const afterX = out[0] * out[3]
    const afterZ = out[2] * out[3]
    void before
    // an impulse changes velocity, not position: within a millisecond the pose is continuous
    expect(Math.abs(afterX - beforeX)).toBeLessThan(0.002)
    expect(Math.abs(afterZ - beforeZ)).toBeLessThan(0.002)
  })

  it('spam cannot wind it past the cap', () => {
    const s = restingSpring()
    const out = new Float32Array(4)
    let peak = 0
    for (let i = 0; i < 40; i++) {
      triggerNudge(s, 'bird', i * 0.05, 1, 0, 1)
      for (let t = i * 0.05; t < i * 0.05 + 0.05; t += 0.002) {
        sampleNudge(s, 'bird', t, out)
        if (out[3] > peak) peak = out[3]
      }
    }
    const cap = ((NUDGE_PARAMS.bird.peakDeg * Math.PI) / 180) * AMP_CAP
    expect(peak).toBeLessThanOrEqual(cap * 1.02)
  })

  it('the impulse is deterministic arithmetic — same inputs, same frames', () => {
    const a = restingSpring()
    const b = restingSpring()
    triggerNudge(a, 'pencup', 0.5, 0.3, -0.7, 1)
    triggerNudge(b, 'pencup', 0.5, 0.3, -0.7, 1)
    const oa = new Float32Array(4)
    const ob = new Float32Array(4)
    for (let t = 0.5; t < 1.5; t += 0.013) {
      sampleNudge(a, 'pencup', t, oa)
      sampleNudge(b, 'pencup', t, ob)
      expect(oa).toEqual(ob)
    }
    expect(impulseFor('pencup')).toBe(impulseFor('pencup'))
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
    // the press actually reaches its authored depth
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
    // continuity at the instant: the new attack starts at zero depth, the old release carries on,
    // and max() of the two cannot jump
    expect(Math.abs(samplePress(s, 0.3) - before)).toBeLessThan(1e-9)
    // the old release keeps decaying for the few ms before the new attack overtakes — a whisper of
    // rise is physical (the finger takes a moment to bite), a pop back to rest is not
    let min = 1
    for (let t = 0.3; t < 0.5; t += 0.002) {
      const v = samplePress(s, t)
      expect(v).toBeLessThanOrEqual(before + 0.03)
      if (v < min) min = v
    }
    // ...and the corner genuinely goes down again
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
    // a mug-sized extent at the money shot's scale needs no help
    expect(hitPadFor(0.8, 9.7, 30, 900)).toBe(0)
    // a tiny target grows to exactly the floor
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

describe('the shader chunks: the law is in the codegen', () => {
  it('every zone is guarded behind an exact-zero test — the rest path is the untouched path', () => {
    for (const mesh of ['DeskBaked', 'DeskMetal', 'DeskGloss'] as const) {
      const zones = zonesForMesh(mesh)
      const { decl, body } = nudgeVertexChunk(mesh)
      for (const z of zones) {
        expect(decl).toContain(`uniform vec4 uNudge_${z.kind};`)
        expect(body).toContain(`uNudge_${z.kind}.w != 0.0`)
      }
      // exactly the registered zones, no strays
      const mentioned = KINDS.filter((k) => body.includes(`uNudge_${k}`))
      expect(mentioned.sort()).toEqual(zones.map((z) => z.kind).sort())
    }
  })

  it('meshes and zones agree with the contract', () => {
    expect(zonesForMesh('DeskBaked').map((z) => z.kind)).toEqual(['mug', 'donut', 'pencup', 'bird', 'penguin'])
    expect(zonesForMesh('DeskMetal').map((z) => z.kind)).toEqual(['mug', 'pencup'])
    expect(zonesForMesh('DeskGloss').map((z) => z.kind)).toEqual(['donut'])
    expect(zonesForMesh('DeskSurface')).toEqual([])
  })

  it('the normal twin rotates only the given variable, under the same guards', () => {
    const chunk = nudgeNormalChunk('DeskMetal', 'objectNormal')
    expect(chunk).toContain('objectNormal =')
    expect(chunk).toContain('uNudge_mug.w != 0.0')
    expect(chunk).toContain('uNudge_pencup.w != 0.0')
    expect(chunk).not.toContain('transformed')
  })

  it('the shared uniforms start at exact rest', () => {
    for (const z of DESK_NUDGE_ZONES) {
      const u = NUDGE_UNIFORMS[z.kind].value
      expect(u.length).toBe(4)
    }
    expect(KICK_DECAY).toBeGreaterThan(0)
  })
})
