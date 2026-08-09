import { describe, expect, it } from 'vitest'
import {
  ENDING_SPAN,
  TRACK_END,
  ZOOM_START,
  endingStateAt,
} from '@/components/labs/small-world/ending-timeline'
import {
  CAMERA_FOV,
  WORLD_RADIUS,
  cameraPositionAtFor,
  cameraTargetAtFor,
} from '@/components/labs/small-world/scene/camera'
import {
  PARALLAX_PITCH_MAX,
  orbitEyeInto,
  orbitRig,
  yawMaxFor,
} from '@/components/labs/small-world/scene/camera-parallax'
import { studioLightsFor } from '@/components/labs/small-world/scene/desk-studio'
import {
  A_COUNTER,
  CREATE_STROKES,
  HALO_CANVAS_H,
  HALO_CANVAS_W,
  LETS_STROKES,
  NEON_DARK,
  NEON_HALO_BITE,
  NEON_HUM,
  SIGN_IGNITE_AT,
  SIGN_STEADY_AT,
  SIGN_TUBE_R,
  SIGN_WORDS,
  SIGN_WORLD_CEILING,
  SIGN_XHEIGHT,
  flickerAt,
  haloCell,
  haloFrame,
  haloPx,
  haloPy,
  letsCapHeight,
  neonAmbientAt,
  neonClockAt,
  sampleStroke,
  signMinReachFromOrigin,
  signPointsWorld,
  wordPointsWorld,
} from '@/components/labs/small-world/scene/neon-sign'

/**
 * THE NEON'S GATES (Task 99). The sign lives at globe height, INSIDE the journey camera's
 * frame, so it cannot be parked out of the frustum the way the desk is — its containment is the
 * strike envelope being exactly 0 wherever the studio lights are 0, and its composition is a set
 * of projection gates swept across the full parallax envelope at both reference viewports.
 */

const TAN_HALF_FOV = Math.tan((CAMERA_FOV * Math.PI) / 360)
const REF_ASPECT = 1440 / 900
const PHONE_ASPECT = 390 / 844

/** Project a world point through the ending camera at an aspect, orbited by (yaw, pitch). */
function project(
  p: readonly [number, number, number],
  aspect: number,
  yaw: number,
  pitch: number
): { x: number; y: number } {
  const eye = cameraPositionAtFor(TRACK_END, aspect)
  const aim = cameraTargetAtFor(TRACK_END, aspect)
  const orb: [number, number, number] = [0, 0, 0]
  orbitEyeInto(eye, aim, yaw, pitch, orb)
  const r = orbitRig(orb, aim)
  const v = [p[0] - r.cam[0], p[1] - r.cam[1], p[2] - r.cam[2]]
  const depth = v[0] * r.fwd[0] + v[1] * r.fwd[1] + v[2] * r.fwd[2]
  return {
    x: (v[0] * r.right[0] + v[1] * r.right[1] + v[2] * r.right[2]) / (depth * TAN_HALF_FOV * aspect),
    y: (v[0] * r.up[0] + v[1] * r.up[1] + v[2] * r.up[2]) / (depth * TAN_HALF_FOV),
  }
}

/** The globe's silhouette half-width in ndc x at the orbited pose (angular radius at depth). */
function globeHalfWidthNdc(aspect: number, yaw: number, pitch: number): number {
  const eye = cameraPositionAtFor(TRACK_END, aspect)
  const aim = cameraTargetAtFor(TRACK_END, aspect)
  const orb: [number, number, number] = [0, 0, 0]
  orbitEyeInto(eye, aim, yaw, pitch, orb)
  const d = Math.hypot(orb[0], orb[1], orb[2])
  return Math.tan(Math.asin(WORLD_RADIUS / d)) / (TAN_HALF_FOV * aspect)
}

const ENVELOPE = (aspect: number): [number, number][] => {
  const yaw = yawMaxFor(aspect)
  const corners: [number, number][] = []
  for (const sy of [-1, 0, 1]) {
    for (const sp of [-1, 0, 1]) {
      corners.push([sy * yaw, sp * PARALLAX_PITCH_MAX])
    }
  }
  return corners
}

describe('the strike envelope (containment by light)', () => {
  it('is exactly 0 for the whole journey and the whole still beat', () => {
    for (let i = 0; i <= 400; i++) {
      const progress = (i / 400) * (1 + ZOOM_START * ENDING_SPAN)
      const lights = studioLightsFor(endingStateAt(progress))
      expect(flickerAt(lights)).toBe(0)
      expect(flickerAt(lights, true)).toBe(0)
    }
  })

  it('is exactly 1 at the money shot — parked, nothing may crawl', () => {
    const lights = studioLightsFor(endingStateAt(TRACK_END))
    expect(lights).toBe(1)
    expect(flickerAt(1)).toBe(1)
    expect(flickerAt(1, true)).toBe(1)
    // the whole steady band, not just the endpoint
    for (let i = 0; i <= 50; i++) {
      const l = SIGN_STEADY_AT + (i / 50) * (1 - SIGN_STEADY_AT)
      expect(flickerAt(l)).toBe(1)
    }
  })

  it('strikes inside (IGNITE, STEADY) and never leaves [0, 1]', () => {
    let sawDark = false
    let sawLit = false
    for (let i = 0; i <= 500; i++) {
      const l = SIGN_IGNITE_AT + (i / 500) * (SIGN_STEADY_AT - SIGN_IGNITE_AT)
      const v = flickerAt(l)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
      if (l > SIGN_IGNITE_AT + 0.02 && v < 0.01) sawDark = true
      if (v > 0.5) sawLit = true
    }
    expect(sawDark).toBe(true) // the strike really does drop dark between pulses
    expect(sawLit).toBe(true)
  })

  it('reduced motion takes the monotone ramp — steady on, no flicker', () => {
    let prev = -1
    for (let i = 0; i <= 200; i++) {
      const l = (i / 200) * 1
      const v = flickerAt(l, true)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('is deterministic — the same input replays bit-identically (scrub safety)', () => {
    for (let i = 0; i <= 100; i++) {
      const l = i / 100
      expect(flickerAt(l)).toBe(flickerAt(l))
      expect(Object.is(flickerAt(l), flickerAt(l))).toBe(true)
    }
  })
})

/**
 * TASK 106 — the ambient flicker. `flickerAt` above is untouched and still exactly 1 across the
 * steady band; what is new is the multiplier the component applies on top of it, and the clock it
 * runs on. The laws here are the ones that keep a wall clock inside the ending: it does not run
 * while the sign is dark, it cannot put the sign out, and the preference switches it off.
 */
describe('the bar-neon stutter (Task 106)', () => {
  it('the clock does not advance while the sign is dark — the whole journey costs it nothing', () => {
    let t = 0
    for (let i = 0; i <= 400; i++) {
      const progress = (i / 400) * (1 + ZOOM_START * ENDING_SPAN)
      const env = flickerAt(studioLightsFor(endingStateAt(progress)))
      t = neonClockAt(t, 1 / 60, env, false)
    }
    expect(t).toBe(0)
    // and it holds whatever it had rather than resetting, exactly as the steam's does
    expect(neonClockAt(7.25, 1 / 60, 0, false)).toBe(7.25)
    expect(neonClockAt(7.25, 1 / 60, 0.4, false)).toBeGreaterThan(7.25)
  })

  it('reduced motion is steady on — no hum, no stutter, on either tube', () => {
    expect(neonClockAt(9, 1 / 60, 1, true)).toBe(0)
    for (let i = 0; i <= 200; i++) {
      expect(neonAmbientAt(i * 0.37, 0, true)).toBe(1)
      expect(neonAmbientAt(i * 0.37, 1, true)).toBe(1)
    }
  })

  // A gate lasts at least 25 ms, so a 5 ms step cannot step over one — these sweeps are sized to
  // the mechanism rather than to a round number, and they stay cheap enough to run under load.
  const STEP = 0.005
  const SAMPLES = 20000 // 100 s per tube, about eleven stutters

  it('a struck-out tube goes nearly dark but never out, and never overdrives', () => {
    for (let word = 0; word < SIGN_WORDS.length; word++) {
      for (let i = 0; i <= SAMPLES; i++) {
        const v = neonAmbientAt(i * STEP, word)
        expect(v).toBeLessThanOrEqual(1)
        expect(v).toBeGreaterThan(0)
        expect(v).toBeGreaterThanOrEqual(NEON_DARK - NEON_HUM)
      }
    }
  })

  /**
   * THE LAW THAT SEPARATES A STUTTER FROM A DIP, and it is the one Aram's note is about: a sine
   * fade is a dimmer, a stutter CLATTERS. Sampled at the frame rate the renderer actually runs at,
   * a real bar neon changes by most of its range between two adjacent frames.
   */
  it('clatters — adjacent frames swing most of the tube s range', () => {
    let biggest = 0
    let prev = neonAmbientAt(0, 0)
    for (let i = 1; i <= 60 * 200; i++) {
      const v = neonAmbientAt(i / 60, 0)
      biggest = Math.max(biggest, Math.abs(v - prev))
      prev = v
    }
    expect(biggest).toBeGreaterThan(0.6 * (1 - NEON_DARK))
  })

  it('is a lit sign that misbehaves, not a broken one', () => {
    const N = SAMPLES
    let steady = 0
    let out = 0
    for (let i = 0; i <= N; i++) {
      const v = neonAmbientAt(i * STEP, 0)
      if (v > 0.95) steady++
      if (v < 0.3) out++
    }
    expect(steady / N).toBeGreaterThan(0.9) // it holds far more than it stutters
    expect(out).toBeGreaterThan(0) // and it really does drop out
  })

  it('one tube at a time — the words do not stutter in unison', () => {
    let together = 0
    let either = 0
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i * STEP
      const a = neonAmbientAt(t, 0) < 0.3
      const b = neonAmbientAt(t, 1) < 0.3
      if (a || b) either++
      if (a && b) together++
    }
    expect(either).toBeGreaterThan(0)
    // independent schedules, so overlap is rare rather than forbidden
    expect(together / either).toBeLessThan(0.15)
  })

  it('is deterministic — the same instant replays bit-identically', () => {
    for (let i = 0; i <= 500; i++) {
      const t = i * 0.041
      expect(Object.is(neonAmbientAt(t, 0), neonAmbientAt(t, 0))).toBe(true)
      expect(Object.is(neonAmbientAt(t, 1), neonAmbientAt(t, 1))).toBe(true)
    }
  })

  it('the halo bite leaves the ignition alone: at full gas it is exactly 1', () => {
    expect(Math.pow(neonAmbientAt(0, 0, true), NEON_HALO_BITE)).toBe(1)
  })
})

describe('the composition gates at the money shot (1440×900 reference)', () => {
  const [lets, create] = SIGN_WORDS
  const letsPts = wordPointsWorld(lets).flat()
  const createPts = wordPointsWorld(create).flat()

  it('flanks the globe with clear air on both sides, across the whole parallax envelope', () => {
    for (const [yaw, pitch] of ENVELOPE(REF_ASPECT)) {
      const halfW = globeHalfWidthNdc(REF_ASPECT, yaw, pitch)
      const centre = project([0, 0, 0], REF_ASPECT, yaw, pitch)
      const letsMax = Math.max(...letsPts.map((p) => project(p, REF_ASPECT, yaw, pitch).x))
      const createMin = Math.min(...createPts.map((p) => project(p, REF_ASPECT, yaw, pitch).x))
      // the words never enter the globe's silhouette band, with margin
      expect(letsMax).toBeLessThan(centre.x - halfW - 0.02)
      expect(createMin).toBeGreaterThan(centre.x + halfW + 0.02)
    }
  })

  it('stays inside the frame and above the desk band at every envelope corner', () => {
    for (const [yaw, pitch] of ENVELOPE(REF_ASPECT)) {
      for (const p of [...letsPts, ...createPts]) {
        const s = project(p, REF_ASPECT, yaw, pitch)
        expect(Math.abs(s.x)).toBeLessThan(0.98) // in frame horizontally
        expect(s.y).toBeLessThan(0.97) // in frame vertically
        expect(s.y).toBeGreaterThan(0.02) // far above the desk edge and the connect row
      }
    }
  })

  it('never reaches the bake ceiling — terrain cannot spear the tube', () => {
    expect(signMinReachFromOrigin()).toBeGreaterThan(SIGN_WORLD_CEILING + 0.1)
  })

  it('the geometry is deterministic', () => {
    const a = signPointsWorld()
    const b = signPointsWorld()
    expect(a).toEqual(b)
  })
})

/**
 * TASK 103 — the letterform gates. Aram read the sign and said the `a` was unreadable, the `L`
 * too small and the apostrophe ill-fitting. Two of those three are geometry with a number in
 * them, so they are pinned here rather than left to the next capture.
 */
describe('the letterforms (Task 103)', () => {
  it("nothing crosses the a's counter — the hole is what makes it an a", () => {
    const nearestOf = (stroke: readonly (readonly [number, number])[]) =>
      Math.min(
        ...sampleStroke(stroke).map(([x, y]) => Math.hypot(x - A_COUNTER.x, y - A_COUNTER.y))
      )
    // T99's ligature ran a chord straight across this disc — the counter's centre sat 0.03 from
    // the main stroke, so the hole was ink. Now the bowl is its own tube and the main stroke
    // arcs OVER it: the closest things to the centre are the bowl's rim and the stem, both of
    // which are the letter's own outline.
    const perStroke = CREATE_STROKES.map(nearestOf)
    for (const d of perStroke) expect(d).toBeGreaterThan(A_COUNTER.r)
    // and the hole is OPEN, not merely uncrossed: the clear air left once the tube's own
    // thickness is taken off is four times the tube is wide, so the glow cannot close it.
    const openDiameter = 2 * (Math.min(...perStroke) - SIGN_TUBE_R)
    expect(openDiameter).toBeGreaterThan(8 * SIGN_TUBE_R)
  })

  it('the L reads as a capital — cap height and a loop wide enough to hold a counter', () => {
    expect(letsCapHeight()).toBeGreaterThan(2.25)
    // the loop's own width, measured over the strokes above the t's ascender
    const loop = sampleStroke(LETS_STROKES[0]).filter(([, y]) => y > 1.8)
    const w = Math.max(...loop.map((p) => p[0])) - Math.min(...loop.map((p) => p[0]))
    expect(w).toBeGreaterThan(0.42) // T99's loop was 0.32 against a 0.116 tube — it shut
  })

  it('there is no apostrophe, and Create carries exactly one extra tube (its bowl)', () => {
    expect(LETS_STROKES).toHaveLength(2) // main + t crossbar
    expect(CREATE_STROKES).toHaveLength(3) // main + the a's bowl + t crossbar
  })

  it('the sign grew by a tad, not by a step', () => {
    const T99_XHEIGHT = 0.95
    const growth = SIGN_XHEIGHT / T99_XHEIGHT - 1
    expect(growth).toBeGreaterThan(0.09)
    expect(growth).toBeLessThan(0.16)
  })
})

/**
 * THE HALO'S REGISTRATION. The canvas carries a narrow near-white core pass, so a mismatch
 * between the rectangle the painter uses and the rectangle the quad maps is not a soft blur
 * being soft — it is a white ghost beside every tube, and that ghost is what filled the a's
 * counter on the shipped build. One frame, two readers, gated by re-derivation.
 */
describe('the halo frame (Task 103)', () => {
  it('the painted rectangle IS the quad — the cell maps onto it exactly', () => {
    for (let i = 0; i < SIGN_WORDS.length; i++) {
      const f = haloFrame(i)
      const cell = haloCell(i)
      expect(haloPx(f, f.x0)).toBeCloseTo(cell.x, 6)
      expect(haloPx(f, f.x1)).toBeCloseTo(cell.x + cell.w, 6)
      expect(haloPy(f, f.y1)).toBeCloseTo(0, 6)
      expect(haloPy(f, f.y0)).toBeCloseTo(HALO_CANVAS_H, 6)
      expect(f.u0 * HALO_CANVAS_W).toBeCloseTo(cell.x, 6)
      expect(f.u1 * HALO_CANVAS_W).toBeCloseTo(cell.x + cell.w, 6)
    }
  })

  it('every tube point is painted inside its own cell, with the glow room to breathe', () => {
    // the far corona is SIGN_TUBE_R * 11 wide; half of it must still land on the canvas
    const corona = (SIGN_TUBE_R * 11) / 2
    for (let i = 0; i < SIGN_WORDS.length; i++) {
      const f = haloFrame(i)
      const cell = haloCell(i)
      for (const stroke of wordPointsWorld(SIGN_WORDS[i])) {
        for (const [x, y] of stroke) {
          expect(haloPx(f, x)).toBeGreaterThan(cell.x + corona * f.s)
          expect(haloPx(f, x)).toBeLessThan(cell.x + cell.w - corona * f.s)
          expect(haloPy(f, y)).toBeGreaterThan(corona * f.s)
          expect(haloPy(f, y)).toBeLessThan(HALO_CANVAS_H - corona * f.s)
        }
      }
    }
  })

  it('the two cells tile the canvas and never overlap', () => {
    const a = haloCell(0)
    const b = haloCell(1)
    expect(a.x).toBe(0)
    expect(a.x + a.w).toBe(b.x)
    expect(b.x + b.w).toBe(HALO_CANVAS_W)
  })
})

describe('the phone frame (390×844): the sign hides by aperture, not by branch', () => {
  it('every tube point is off frame at every parallax corner', () => {
    for (const [yaw, pitch] of ENVELOPE(PHONE_ASPECT)) {
      for (const p of signPointsWorld().flat()) {
        const s = project(p, PHONE_ASPECT, yaw, pitch)
        expect(Math.abs(s.x)).toBeGreaterThan(1.02)
      }
    }
  })
})
