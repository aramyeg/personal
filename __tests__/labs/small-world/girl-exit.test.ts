import { describe, expect, it } from 'vitest'
import {
  CAMERA_DISTANCE,
  ZOOM_FACTOR,
  cameraZoomScale,
  endingAimDrop,
  ndcYAt,
} from '@/components/labs/small-world/scene/camera'
import {
  ENDING_IDLE,
  ENDING_SPAN,
  STAND_END,
  TRACK_END,
  ZOOM_FIRST_MOVE,
  endingStateAt,
} from '@/components/labs/small-world/ending-timeline'
import { DESK_BACK_Z, DESK_TOP_Y, propCeiling } from '@/components/labs/small-world/scene/desk-stage'
import {
  CAMERA_THETA,
  DESK_STAGINGS,
  GIRL_DESK_HEIGHT,
  GIRL_DESK_MOUNTED,
  GIRL_DESK_REVEAL,
  GIRL_DESK_SCALE,
  GIRL_DESK_SEAT_Y,
  GIRL_DESK_SETTLED,
  GIRL_DESK_STAGING,
  GIRL_DESK_WALK_START,
  GIRL_EXIT_ARC,
  GIRL_EXIT_THETA,
  GIRL_GLOBE_HEIGHT,
  GIRL_GLOBE_SCALE,
  GIRL_TRANSFER,
  GIRL_TURN_END,
  GIRL_TURN_START,
  GIRL_WALK_END,
  deskFloatFor,
  exitSinkShare,
  feetHiddenAt,
  girlPoseAt,
  headHiddenAt,
  strideAt,
} from '@/components/labs/small-world/scene/girl-exit'
import { PLANET_RADIUS } from '@/components/labs/small-world/scene/land-bake'
import {
  DESK_FIGURINES,
  DESK_PAD,
  FIGURINE_HEIGHT,
} from '@/components/labs/small-world/scene/props/desk-glb-contract'
import { STANCE_ALPHA } from '@/components/labs/small-world/scene/renewal'

/**
 * ALWINA LEAVES THE WORLD (Task 76) — held to the ending's own two standing
 * obligations, plus the one this beat adds.
 *
 * The two standing ones: nothing may move while the journey can still turn the
 * planet, and everything must scrub backwards bit-identically. `Object.is`
 * throughout, because "very nearly the journey pose" is what a thing that has
 * quietly started moving looks like.
 *
 * The one this beat adds is a CONTINUITY obligation, and it is the only place in
 * the lab where a cut is allowed: she must be invisible at the instant she stops
 * being on the planet and starts being on the desk, and she must be invisible for
 * the whole gap between the two. The tests below prove the two hiding windows
 * OVERLAP rather than merely both existing, which is the difference between a cut
 * and a blink.
 */

const poseAtT = (t: number) => girlPoseAt(endingStateAt(1 + t * ENDING_SPAN), false)

/** An EndingState with EXACTLY this `t` — see the exactness tests for why the
 *  scroll round trip cannot supply one. */
const atExactly = (t: number) =>
  girlPoseAt({ active: true, t, phase: t < 0.38 ? 'still' : 'zoom', stand: 1, zoom: 0 }, false)

describe('the journey does not know she is going anywhere', () => {
  it('returns the SHARED frozen journey pose for every progress the journey owns', () => {
    const first = girlPoseAt(endingStateAt(0), false)
    for (let i = 0; i <= 4000; i++) {
      const pose = girlPoseAt(endingStateAt((i / 4000) * 1), false)
      // Identity, not equality: the journey must allocate nothing per frame.
      expect(pose).toBe(first)
    }
    expect(Object.isFrozen(first)).toBe(true)
  })

  it('is the journey pose for the shared idle state every journey frame reads', () => {
    expect(girlPoseAt(ENDING_IDLE, false).stage).toBe('journey')
    expect(girlPoseAt(ENDING_IDLE, true).stage).toBe('journey')
  })

  it('holds her exactly at her stance and exactly at her planet scale there', () => {
    const pose = girlPoseAt(ENDING_IDLE, false)
    expect(Object.is(pose.theta, STANCE_ALPHA)).toBe(true)
    expect(Object.is(pose.scale, GIRL_GLOBE_SCALE)).toBe(true)
    expect(Object.is(pose.yaw, 0)).toBe(true)
    expect(Object.is(pose.walked, 0)).toBe(true)
  })

  it('has not begun to turn or walk on the ending’s own first frames either', () => {
    // The turn opens at GIRL_TURN_START, so everything before it is still the
    // journey's pose even though the ending is technically running.
    for (let i = 0; i <= 200; i++) {
      const pose = poseAtT((i / 200) * GIRL_TURN_START)
      expect(Object.is(pose.yaw, 0)).toBe(true)
      expect(Object.is(pose.theta, STANCE_ALPHA)).toBe(true)
    }
  })
})

describe('the exit angle is solved, not chosen', () => {
  /**
   * A point at radius rho is hidden from a camera at distance d by a sphere of
   * radius R exactly when its angular separation from the camera exceeds
   * acos(R/d) + acos(R/rho) — the two horizon half-angles. Her HEAD is the binding
   * point, and the tangent that hides a point ON the surface does not hide it.
   */
  const hiddenPast = (d: number, rho: number) =>
    CAMERA_THETA - (Math.acos(PLANET_RADIUS / d) + Math.acos(PLANET_RADIUS / rho))

  it('hides the top of her head at the REST camera', () => {
    expect(GIRL_EXIT_THETA).toBeLessThan(hiddenPast(CAMERA_DISTANCE, PLANET_RADIUS + GIRL_GLOBE_HEIGHT))
  })

  it('...and at the FULL PULL-BACK, which is the binding one', () => {
    // A camera further away sees further round the sphere, so the pulled-back
    // horizon is the deeper requirement. One angle has to satisfy both.
    const rest = hiddenPast(CAMERA_DISTANCE, PLANET_RADIUS + GIRL_GLOBE_HEIGHT)
    const full = hiddenPast(CAMERA_DISTANCE * ZOOM_FACTOR, PLANET_RADIUS + GIRL_GLOBE_HEIGHT)
    expect(full).toBeLessThan(rest)
    expect(GIRL_EXIT_THETA).toBeLessThan(full)
  })

  it('is much further than the angle that would hide a point on the ground she walks on', () => {
    // The whole reason the solve exists: the surface's own horizon is 29.5 degrees
    // away and would leave her head standing over it like a hill walker.
    const surfaceHorizon = CAMERA_THETA - Math.acos(PLANET_RADIUS / CAMERA_DISTANCE)
    expect(GIRL_EXIT_THETA).toBeLessThan(surfaceHorizon - 0.7)
  })

  it('walks her the far way round rather than the way she faces', () => {
    expect(GIRL_EXIT_THETA).toBeLessThan(STANCE_ALPHA)
    expect(GIRL_EXIT_ARC).toBeCloseTo((STANCE_ALPHA - GIRL_EXIT_THETA) * PLANET_RADIUS, 12)
  })

  it('reaches that angle before the stand has finished rising, EXACTLY', () => {
    // Exactly, because `a + (b − a) · 1` is not b in IEEE-754 and "she has all but
    // arrived at the angle that hides her" is not the claim this module makes. The
    // interpolation is written `(1 − s)·a + s·b` for precisely this.
    //
    // Fed an EndingState directly rather than through `endingStateAt`: the round
    // trip progress → t re-rounds (`(1 + k·SPAN − 1) / SPAN` is not k), so no real
    // scroll position lands on the boundary exactly. The exactness is a property of
    // the function, and that is the property worth pinning — the frames either side
    // are covered by the sweep above.
    expect(GIRL_WALK_END).toBeLessThanOrEqual(STAND_END + 0.02)
    expect(Object.is(atExactly(GIRL_WALK_END).theta, GIRL_EXIT_THETA)).toBe(true)
  })

  it('leaves her stance EXACTLY at the other end of the same interpolation', () => {
    expect(Object.is(atExactly(GIRL_TURN_START).theta, STANCE_ALPHA)).toBe(true)
    expect(Object.is(atExactly(GIRL_TURN_START).yaw, 0)).toBe(true)
  })
})

describe('the cut is covered at both ends', () => {
  it('is already hidden behind the planet when she stops being on it', () => {
    expect(GIRL_TRANSFER).toBeGreaterThanOrEqual(GIRL_WALK_END)
    expect(poseAtT(GIRL_TRANSFER - 1e-6).stage).toBe('globe')
    expect(poseAtT(GIRL_TRANSFER).stage).toBe('desk')
  })

  it('is not drawn at all between the transfer and her reveal', () => {
    expect(GIRL_DESK_REVEAL).toBeGreaterThan(GIRL_TRANSFER)
    for (let i = 0; i <= 400; i++) {
      const t = GIRL_TRANSFER + ((GIRL_DESK_REVEAL - GIRL_TRANSFER) * i) / 400
      if (t >= GIRL_DESK_REVEAL) break
      expect(poseAtT(t).visible).toBe(false)
    }
  })

  it('is under the frame’s bottom edge on the frame she is first drawn in', () => {
    // Her first visible pixel has to be one the frame is already cropping, or the
    // reveal is a pop. Head exactly at ndc -1 is the solve's own definition.
    const e = endingStateAt(1 + GIRL_DESK_REVEAL * ENDING_SPAN)
    const head = ndcYAt(
      [0, GIRL_DESK_SEAT_Y + GIRL_DESK_HEIGHT, GIRL_DESK_STAGING.from[1]],
      cameraZoomScale(e),
      endingAimDrop(e)
    )
    expect(head).toBeGreaterThan(-1.002)
    expect(head).toBeLessThan(-0.99)
  })

  it('DOES NOT FLOAT: the desk’s back edge is above her head when she appears', () => {
    // The defect this gate exists for shipped in the first cut of this beat — at
    // t = 0.50 her head and shoulders stood in the studio's empty backdrop with the
    // desk's own back edge still below the frame. Cropped is not covered.
    expect(deskFloatFor(GIRL_DESK_STAGING)).toBeLessThanOrEqual(0)
  })

  it('starts walking before it reveals her, so the first frame of her is a moving one', () => {
    expect(GIRL_DESK_WALK_START).toBeLessThan(GIRL_DESK_REVEAL)
  })

  it('has arrived before the studio has finished coming up', () => {
    // STUDIO_LIGHTS_FULL is 0.82 of the pull-back; the frame Aram approved is one
    // she has already landed in rather than one she is passing through.
    expect(GIRL_DESK_SETTLED).toBeLessThan(1)
    const settled = poseAtT(GIRL_DESK_SETTLED)
    expect(Object.is(settled.x, GIRL_DESK_STAGING.to[0])).toBe(true)
    expect(Object.is(settled.z, GIRL_DESK_STAGING.to[1])).toBe(true)
    expect(Object.is(settled.yaw, GIRL_DESK_STAGING.restYaw)).toBe(true)
    expect(Object.is(settled.moving, 0)).toBe(true)
  })
})

describe('she scrubs backwards exactly', () => {
  it('gives bit-identical poses forward and reversed over the whole ending', () => {
    const forward: ReturnType<typeof girlPoseAt>[] = []
    for (let i = 0; i <= 3000; i++) forward.push(poseAtT(i / 3000))
    for (let i = 3000; i >= 0; i--) {
      const back = poseAtT(i / 3000)
      const fwd = forward[i]
      for (const k of ['theta', 'x', 'z', 'yaw', 'scale', 'walked', 'moving'] as const) {
        expect(Object.is(back[k], fwd[k])).toBe(true)
      }
      expect(back.stage).toBe(fwd.stage)
      expect(back.visible).toBe(fwd.visible)
    }
  })

  it('never un-walks inside a stage, so her stride never plays against her motion', () => {
    for (const [lo, hi] of [
      [GIRL_TURN_START, GIRL_WALK_END],
      [GIRL_DESK_WALK_START, GIRL_DESK_SETTLED],
    ]) {
      let prev = -Infinity
      for (let i = 0; i <= 2000; i++) {
        const t = lo + ((hi - lo) * i) / 2000
        const w = poseAtT(t).walked
        expect(w).toBeGreaterThanOrEqual(prev - 1e-12)
        prev = w
      }
    }
  })

  it('holds the driver’s whole domain without leaving the ending’s vocabulary', () => {
    for (let i = 0; i <= 2000; i++) {
      const pose = girlPoseAt(endingStateAt((i / 2000) * TRACK_END), false)
      expect(['journey', 'globe', 'desk']).toContain(pose.stage)
      expect(Number.isFinite(pose.x)).toBe(true)
      expect(Number.isFinite(pose.z)).toBe(true)
      expect(Number.isFinite(pose.yaw)).toBe(true)
      expect(pose.scale).toBeGreaterThan(0)
    }
  })

  it('leaves the camera invariant’s domain completely alone', () => {
    // Her whole performance lives past ZOOM_FIRST_MOVE's own still beat; nothing
    // here may be read as licence for the camera to move earlier.
    expect(1 + GIRL_TURN_START * ENDING_SPAN).toBeGreaterThan(1)
    expect(ZOOM_FIRST_MOVE).toBeGreaterThan(1)
  })
})

describe('the scale reads as a cut rather than a resize', () => {
  const pxPerUnit = (z: number) => {
    const e = endingStateAt(TRACK_END)
    const k = cameraZoomScale(e)
    const drop = endingAimDrop(e)
    const a = ndcYAt([0, GIRL_DESK_SEAT_Y, z], k, drop)
    const b = ndcYAt([0, GIRL_DESK_SEAT_Y + 0.01, z], k, drop)
    return (Math.abs(b - a) / 0.01) * 450
  }

  it('lands her within a sixth of the size she was on the planet', () => {
    const onDesk = pxPerUnit(GIRL_DESK_STAGING.to[1]) * GIRL_DESK_HEIGHT
    // Her planet size at the money shot, projected at the stance she leaves from.
    const e = endingStateAt(TRACK_END)
    const k = cameraZoomScale(e)
    const drop = endingAimDrop(e)
    const gy = Math.sqrt(PLANET_RADIUS * PLANET_RADIUS - 0.75 * 0.75)
    const a = ndcYAt([0, gy, 0.75], k, drop)
    const b = ndcYAt([0, gy + 0.01, 0.75], k, drop)
    const onGlobe = (Math.abs(b - a) / 0.01) * 450 * GIRL_GLOBE_HEIGHT
    expect(Math.abs(onDesk / onGlobe - 1)).toBeLessThan(0.17)
  })

  it('stands taller than the souvenirs she is standing among, but not twice as tall', () => {
    const ratio = GIRL_DESK_HEIGHT / FIGURINE_HEIGHT
    expect(ratio).toBeGreaterThan(1.1)
    expect(ratio).toBeLessThan(1.35)
  })

  it('derives her desk scale from the mesh rather than restating it', () => {
    expect(GIRL_DESK_SCALE * 1.7).toBeCloseTo(GIRL_DESK_HEIGHT, 12)
    expect(GIRL_GLOBE_SCALE * 1.7).toBeCloseTo(GIRL_GLOBE_HEIGHT, 12)
  })

  it('shortens her stride with her, so a smaller girl does not moonwalk', () => {
    expect(strideAt(GIRL_DESK_SCALE)).toBeLessThan(strideAt(GIRL_GLOBE_SCALE))
    expect(strideAt(GIRL_GLOBE_SCALE)).toBeCloseTo(1, 12)
  })
})

describe('her mark is somewhere the desk and the phone both allow', () => {
  const TAN_HALF = Math.tan((38 * Math.PI) / 360)

  it('clears the two souvenirs it stands between', () => {
    // Task 81: the souvenirs are baked into the asset now, so their places come from the contract
    // that measures the shipped models rather than from a builder the lab no longer has. They are
    // NOT symmetric about x — the bird sits at −0.92 and the penguin at +0.83 — so this reads both
    // rather than mirroring one, and it clears each figurine's own half-width instead of its anchor.
    for (const fig of DESK_FIGURINES) {
      const gap = Math.hypot(GIRL_DESK_STAGING.to[0] - fig.x, GIRL_DESK_STAGING.to[1] - fig.z)
      expect(gap, fig.kind).toBeGreaterThan(0.45 + fig.halfW)
    }
  })

  it('stays inside the frame on the narrowest viewport the lab declares', () => {
    // 360x800 is the declared Android floor (Task 72). ndc y is aspect-free; ndc x
    // is not, and the desk plane is only +-1.38 wide at this depth there.
    const e = endingStateAt(TRACK_END)
    const k = cameraZoomScale(e)
    const drop = endingAimDrop(e)
    const depthOf = (z: number) => {
      const a = ndcYAt([0, GIRL_DESK_SEAT_Y, z], k, drop)
      const b = ndcYAt([0, GIRL_DESK_SEAT_Y + 0.01, z], k, drop)
      return 0.01 / (Math.abs(b - a) * TAN_HALF)
    }
    for (const mark of [GIRL_DESK_STAGING.to, GIRL_DESK_STAGING.from]) {
      const halfW = depthOf(mark[1]) * TAN_HALF * (360 / 800)
      // Her own half-width, not just her anchor: desk-figurines learned that lesson twice.
      expect(Math.abs(mark[0]) + GIRL_DESK_HEIGHT * 0.25).toBeLessThan(halfW)
    }
  })

  it('sits on the pad the figurines stand on, not the slab beneath it', () => {
    expect(GIRL_DESK_SEAT_Y).toBe(DESK_PAD.top)
    expect(GIRL_DESK_SEAT_Y).toBeGreaterThan(DESK_TOP_Y)
  })

  it('stands in front of the desk’s back edge with headroom to spare', () => {
    for (const mark of [GIRL_DESK_STAGING.to, GIRL_DESK_STAGING.from]) {
      expect(mark[1]).toBeGreaterThan(DESK_BACK_Z)
      expect(propCeiling(mark[1])).toBeGreaterThan(GIRL_DESK_HEIGHT)
    }
  })

  it('names one staging out of the candidates rather than an index nobody can read', () => {
    expect(DESK_STAGINGS.map((s) => s.id)).toContain(GIRL_DESK_STAGING.id)
  })
})

describe('reduced motion gets the ending without the performance', () => {
  it('puts her at her mark for the whole ending and never walks her', () => {
    for (let i = 1; i <= 1000; i++) {
      const pose = girlPoseAt(endingStateAt(1 + (i / 1000) * ENDING_SPAN), true)
      expect(pose.stage).toBe('desk')
      // Drawn only while the desk arrival is MOUNTED. Phase 1 ships it off (she
      // arrives in ink instead) and the flag is what phase 2 flips — so this
      // follows the flag rather than restating a literal that would then lie.
      expect(pose.visible).toBe(GIRL_DESK_MOUNTED)
      expect(Object.is(pose.moving, 0)).toBe(true)
      expect(Object.is(pose.walked, 0)).toBe(true)
      expect(Object.is(pose.x, GIRL_DESK_STAGING.to[0])).toBe(true)
      expect(Object.is(pose.z, GIRL_DESK_STAGING.to[1])).toBe(true)
    }
  })

  it('still leaves the journey untouched, which is the only cut it can afford', () => {
    for (let i = 0; i <= 500; i++) {
      expect(girlPoseAt(endingStateAt((i / 500) * 1), true).stage).toBe('journey')
    }
  })
})

/**
 * THE EXIT BEAT IS THE PIECE, so it gets its own gate (orchestrator's polish
 * order 4). Aram's redirect discarded where she ARRIVES; it kept, unchanged, the
 * walk over the crest and the head going down behind it. That beat is not one
 * number — it is a relation between three constants and the camera's own horizon,
 * and any of them could be retuned by someone who never looked at the frames.
 *
 * What these hold: she is on the planet and drawn for the whole walk; the ground
 * leaves her feet BEFORE the horizon takes her head, so there is a real sinking;
 * that sinking is a substantial share of the walk rather than a rounding error;
 * and she is gone before the transfer, at every camera stop the ending can reach.
 */
describe('the walk over the crest cannot be clipped by a retune', () => {
  const REST = CAMERA_DISTANCE
  const FULL = CAMERA_DISTANCE * ZOOM_FACTOR

  it('keeps her on the planet, and drawn, for the whole exit walk', () => {
    for (let i = 0; i <= 600; i++) {
      const t = GIRL_TURN_START + ((GIRL_WALK_END - GIRL_TURN_START) * i) / 600
      const pose = poseAtT(t)
      expect(pose.stage).toBe('globe')
      expect(pose.visible).toBe(true)
    }
  })

  it('takes her ground away BEFORE her head, which is what "over the hill" means', () => {
    // If these two coincided she would blink out at the horizon instead of sinking.
    let feetGone = -1
    let headGone = -1
    for (let i = 0; i <= 2000; i++) {
      const theta = STANCE_ALPHA + ((GIRL_EXIT_THETA - STANCE_ALPHA) * i) / 2000
      if (feetGone < 0 && feetHiddenAt(theta, REST)) feetGone = i / 2000
      if (headGone < 0 && headHiddenAt(theta, REST)) headGone = i / 2000
    }
    expect(feetGone).toBeGreaterThan(0)
    expect(headGone).toBeGreaterThan(feetGone)
  })

  it('spends a real share of the walk sinking, not a frame of it', () => {
    // Measured at the rest camera, which is the one the still beat renders through.
    expect(exitSinkShare(REST)).toBeGreaterThan(0.5)
    // ...and it survives the pull-back, where the horizon sits further round.
    expect(exitSinkShare(FULL)).toBeGreaterThan(0.45)
  })

  it('has her fully hidden by the end of the walk at EVERY camera stop', () => {
    for (const d of [REST, FULL, (REST + FULL) / 2]) {
      expect(headHiddenAt(GIRL_EXIT_THETA, d)).toBe(true)
    }
  })

  it('is still visible at the start of the walk — she does not vanish early', () => {
    expect(headHiddenAt(STANCE_ALPHA, CAMERA_DISTANCE)).toBe(false)
    expect(feetHiddenAt(STANCE_ALPHA, CAMERA_DISTANCE)).toBe(false)
  })

  it('finishes the walk before the transfer takes her off the planet', () => {
    expect(GIRL_WALK_END).toBeLessThanOrEqual(GIRL_TRANSFER)
    expect(headHiddenAt(poseAtT(GIRL_TRANSFER - 1e-4).theta, CAMERA_DISTANCE)).toBe(true)
  })

  it('turns her round before she walks, so the exit is not a moonwalk', () => {
    expect(GIRL_TURN_END).toBeLessThanOrEqual(GIRL_WALK_END)
    expect(atExactly(GIRL_TURN_END).yaw).toBeCloseTo(Math.PI, 9)
    expect(Object.is(atExactly(GIRL_TURN_END).theta, STANCE_ALPHA)).toBe(true)
  })
})

/**
 * PHASE 1 SHIPS THE EXIT WITHOUT THE ARRIVAL (Aram's redirect). She leaves the
 * world and does not come back — the ink epilogue that once carried her return
 * was itself removed in the T82 kill list. Everything the arrival needed is still
 * derived and still gated above — these hold the SHIPPED state, so that neither
 * half can drift while the other waits.
 */
describe('the desk arrival is built, gated, and not mounted', () => {
  it('draws nothing on the desk at any point in the ending', () => {
    for (let i = 0; i <= 1500; i++) {
      const pose = poseAtT(i / 1500)
      if (pose.stage === 'desk') expect(pose.visible).toBe(false)
    }
  })

  it('still leaves her ON the planet, and drawn, for the whole exit', () => {
    // The half that ships. If a future edit disabled the girl wholesale rather
    // than only her arrival, this is what would catch it.
    let globeFrames = 0
    for (let i = 0; i <= 1500; i++) {
      const pose = poseAtT(i / 1500)
      if (pose.stage === 'globe') {
        expect(pose.visible).toBe(true)
        globeFrames++
      }
    }
    expect(globeFrames).toBeGreaterThan(300)
  })

  it('keeps every number the arrival was solved from, so phase 2 is one flag', () => {
    expect(GIRL_DESK_MOUNTED).toBe(false)
    expect(GIRL_DESK_HEIGHT).toBeGreaterThan(0)
    expect(GIRL_DESK_REVEAL).toBeGreaterThan(GIRL_TRANSFER)
    expect(deskFloatFor(GIRL_DESK_STAGING)).toBeLessThanOrEqual(0)
  })
})
