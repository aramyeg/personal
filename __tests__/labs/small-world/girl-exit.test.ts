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
  TRACK_END,
  ZOOM_FIRST_MOVE,
  ZOOM_START,
  endingStateAt,
} from '@/components/labs/small-world/ending-timeline'
import { DESK_BACK_Z, DESK_TOP_Y, propCeiling } from '@/components/labs/small-world/scene/desk-stage'
import {
  CAMERA_THETA,
  CREST_THETA,
  DESK_STAGINGS,
  GIRL_DESK_HEIGHT,
  GIRL_DESK_MOUNTED,
  GIRL_DESK_REVEAL,
  GIRL_DESK_SCALE,
  GIRL_DESK_SEAT_Y,
  GIRL_DESK_SETTLED,
  GIRL_DESK_STAGING,
  GIRL_DESK_WALK_START,
  GIRL_GLOBE_HEIGHT,
  GIRL_GLOBE_SCALE,
  GIRL_JUMP_APEX,
  GIRL_JUMP_END,
  GIRL_JUMP_END_THETA,
  GIRL_JUMP_FALL,
  GIRL_JUMP_RISE,
  GIRL_JUMP_START,
  GIRL_LOOK_END,
  GIRL_LOOK_START,
  GIRL_STOP_THETA,
  GIRL_TRANSFER,
  GIRL_TURN_END,
  GIRL_TURN_START,
  GIRL_WALK_ARC,
  GIRL_WALK_END,
  JUMP_BLEND_IN,
  JUMP_CLIP_APEX,
  JUMP_CLIP_HOLD,
  deskFloatFor,
  exitSinkShare,
  feetHiddenAt,
  girlPoseAt,
  headHiddenAt,
  jumpBlendAt,
  jumpClipFracAt,
  jumpLiftAt,
  pointHiddenAt,
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
 * ALWINA LEAVES THE WORLD (Task 76, restaged by Task 87) — held to the ending's
 * two standing obligations, plus the one this beat adds.
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
 *
 * Task 87 re-derives the exit-beat family for the new staging — stop at the
 * crest, turn back for the goodbye, JUMP off the world — without weakening any
 * of it: the sinking beat survives as the plunge, the hidden-at-every-camera-stop
 * claim gets STRONGER (she ends inside the planet's own ball, which no outside
 * camera can see into), and two beats gain gates the walk never needed (whole at
 * the goodbye, whole at the apex).
 */

const poseAtT = (t: number) => girlPoseAt(endingStateAt(1 + t * ENDING_SPAN), false)

/** An EndingState with EXACTLY this `t` — see the exactness tests for why the
 *  scroll round trip cannot supply one. */
const atExactly = (t: number) =>
  girlPoseAt({ active: true, t, phase: t < 0.38 ? 'still' : 'zoom', stand: 1, zoom: 0 }, false)

const REST = CAMERA_DISTANCE
const FULL = CAMERA_DISTANCE * ZOOM_FACTOR

/** Her bearing and lift at a flight phase — the arc the module authors. */
const flightAt = (p: number) => ({
  theta: (1 - p) * GIRL_STOP_THETA + p * GIRL_JUMP_END_THETA,
  lift: jumpLiftAt(p),
})

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
    expect(Object.is(pose.lift, 0)).toBe(true)
    expect(Object.is(pose.jump, 0)).toBe(true)
  })

  it('has not begun to turn or walk on the ending’s own first frames either', () => {
    // The turn opens at GIRL_TURN_START, so everything before it is still the
    // journey's pose even though the ending is technically running.
    for (let i = 0; i <= 200; i++) {
      const pose = poseAtT((i / 200) * GIRL_TURN_START)
      expect(Object.is(pose.yaw, 0)).toBe(true)
      expect(Object.is(pose.theta, STANCE_ALPHA)).toBe(true)
      expect(Object.is(pose.lift, 0)).toBe(true)
    }
  })
})

describe('the stop is at the crest, and it is solved, not chosen', () => {
  it('derives the crest from the rest camera, which renders every airborne frame', () => {
    // The camera cannot leave its rest pose before ZOOM_START, and the whole
    // performance is over before GIRL_TRANSFER < ZOOM_START — so the crest the
    // reader sees is the rest camera's tangent and no other.
    expect(GIRL_TRANSFER).toBeLessThan(ZOOM_START)
    expect(Object.is(CREST_THETA, CAMERA_THETA - Math.acos(PLANET_RADIUS / CAMERA_DISTANCE))).toBe(
      true
    )
  })

  it('stops her a real step short of the crest, on the visible side of it', () => {
    expect(GIRL_STOP_THETA).toBeGreaterThan(CREST_THETA)
    expect(GIRL_STOP_THETA).toBeLessThan(STANCE_ALPHA)
  })

  it('walks her the far way round rather than the way she faces', () => {
    expect(GIRL_WALK_ARC).toBeCloseTo((STANCE_ALPHA - GIRL_STOP_THETA) * PLANET_RADIUS, 12)
    expect(GIRL_WALK_ARC).toBeGreaterThan(0)
  })

  it('keeps her WHOLE for the entire walk — the goodbye cannot be delivered half-sunk', () => {
    // The Task 76 walk sank her on purpose; this walk must NOT — she stops while
    // both feet and head are safely inside the visible cap, at both camera stops.
    for (let i = 0; i <= 400; i++) {
      const theta = STANCE_ALPHA + ((GIRL_STOP_THETA - STANCE_ALPHA) * i) / 400
      for (const d of [REST, FULL]) {
        expect(feetHiddenAt(theta, 0, d)).toBe(false)
        expect(headHiddenAt(theta, 0, d)).toBe(false)
      }
    }
  })

  it('arrives at the stop EXACTLY, and holds it through the whole goodbye', () => {
    // Exactly, because `a + (b − a) · 1` is not b in IEEE-754, and the goodbye
    // beat is staged at a bearing, not near one. Fed an EndingState directly:
    // the round trip progress → t re-rounds, so no real scroll position lands on
    // the boundary exactly — the exactness is a property of the function.
    expect(Object.is(atExactly(GIRL_WALK_END).theta, GIRL_STOP_THETA)).toBe(true)
    expect(Object.is(atExactly(GIRL_JUMP_START).theta, GIRL_STOP_THETA)).toBe(true)
    for (let i = 0; i <= 200; i++) {
      const t = GIRL_WALK_END + ((GIRL_JUMP_START - GIRL_WALK_END) * i) / 200
      expect(Object.is(atExactly(t).theta, GIRL_STOP_THETA)).toBe(true)
      expect(Object.is(atExactly(t).lift, 0)).toBe(true)
    }
  })

  it('leaves her stance EXACTLY at the other end of the same interpolation', () => {
    expect(Object.is(atExactly(GIRL_TURN_START).theta, STANCE_ALPHA)).toBe(true)
    expect(Object.is(atExactly(GIRL_TURN_START).yaw, 0)).toBe(true)
  })
})

describe('the goodbye: she turns her back to leave, and turns back to say it', () => {
  it('turns her round before she walks, so the exit is not a moonwalk', () => {
    expect(GIRL_TURN_END).toBeLessThanOrEqual(GIRL_WALK_END)
    expect(atExactly(GIRL_TURN_END).yaw).toBeCloseTo(Math.PI, 9)
    expect(Object.is(atExactly(GIRL_TURN_END).theta, STANCE_ALPHA)).toBe(true)
  })

  it('turns her BACK to face the reader after the walk and before the jump', () => {
    expect(GIRL_LOOK_START).toBeGreaterThanOrEqual(GIRL_WALK_END)
    expect(GIRL_LOOK_END).toBeLessThanOrEqual(GIRL_JUMP_START)
    // mix(x, 0, 1) is exactly +0 — from the look's end she faces the reader
    // without residue, and stays facing them through the launch.
    for (let i = 0; i <= 200; i++) {
      const t = GIRL_LOOK_END + ((GIRL_JUMP_END - GIRL_LOOK_END) * i) / 200
      expect(Object.is(atExactly(t).yaw, 0)).toBe(true)
    }
  })

  it('holds a real beat between the turn-back and the launch — a goodbye, not a bounce', () => {
    expect(GIRL_JUMP_START - GIRL_LOOK_END).toBeGreaterThanOrEqual(0.015)
  })

  it('walks facing away — the turn-back has not begun anywhere in the walk', () => {
    for (let i = 0; i <= 200; i++) {
      const t = GIRL_TURN_END + ((GIRL_LOOK_START - GIRL_TURN_END) * i) / 200
      expect(atExactly(t).yaw).toBeCloseTo(Math.PI, 9)
    }
  })
})

describe('the jump: the ballistics are authored, the hiding is solved', () => {
  it('leaves the ground EXACTLY at zero lift, so the takeoff frame has no seam', () => {
    expect(Object.is(jumpLiftAt(0), 0)).toBe(true)
    expect(Object.is(atExactly(GIRL_JUMP_START).lift, 0)).toBe(true)
  })

  it('crests at the authored rise, at the apex the fall ratio dictates', () => {
    expect(jumpLiftAt(GIRL_JUMP_APEX)).toBeCloseTo(GIRL_JUMP_RISE, 12)
    // The apex is a maximum: nothing on either side of it stands higher. The
    // grid cannot land on the apex exactly, so the grid max is bounded rather
    // than matched — the exact value is pinned at GIRL_JUMP_APEX above.
    let max = -Infinity
    for (let i = 0; i <= 2000; i++) max = Math.max(max, jumpLiftAt(i / 2000))
    expect(max).toBeLessThanOrEqual(GIRL_JUMP_RISE + 1e-12)
    expect(max).toBeGreaterThan(GIRL_JUMP_RISE - 1e-6)
    // Rise short, fall long — the shape a jump off an edge has.
    expect(GIRL_JUMP_APEX).toBeGreaterThan(0.1)
    expect(GIRL_JUMP_APEX).toBeLessThan(0.5)
  })

  it('ends the flight at the authored fall depth', () => {
    expect(jumpLiftAt(1)).toBeCloseTo(-GIRL_JUMP_FALL, 9)
  })

  it('is WHOLE at the apex — the leap must read before the fall takes her', () => {
    const { theta, lift } = flightAt(GIRL_JUMP_APEX)
    expect(feetHiddenAt(theta, lift, REST)).toBe(false)
    expect(headHiddenAt(theta, lift, REST)).toBe(false)
  })

  it('parks her head INSIDE the planet’s ball, with real slack', () => {
    // The strongest hiding there is: a camera outside a convex body cannot see a
    // point inside it, from any distance. The slack keeps a retuned rise/fall
    // from quietly walking her back out.
    const headRadius = PLANET_RADIUS + jumpLiftAt(1) + GIRL_GLOBE_HEIGHT
    expect(headRadius).toBeLessThan(PLANET_RADIUS - 0.4)
  })

  it('is fully hidden at the end of the flight at EVERY camera stop', () => {
    for (const d of [REST, FULL, (REST + FULL) / 2]) {
      expect(headHiddenAt(GIRL_JUMP_END_THETA, jumpLiftAt(1), d)).toBe(true)
      expect(feetHiddenAt(GIRL_JUMP_END_THETA, jumpLiftAt(1), d)).toBe(true)
    }
  })

  it('...and was already hidden with slack to spare before the flight window closed', () => {
    // The hiding must complete INSIDE the flight, not on its last frame — a
    // margin a retune of the sweep or the fall would eat visibly here first.
    const { theta, lift } = flightAt(0.95)
    for (const d of [REST, FULL]) expect(headHiddenAt(theta, lift, d)).toBe(true)
  })

  it('takes her feet BEFORE her head, which is what "off the edge" means', () => {
    let feetGone = -1
    let headGone = -1
    for (let i = 0; i <= 2000; i++) {
      const p = i / 2000
      const { theta, lift } = flightAt(p)
      if (feetGone < 0 && feetHiddenAt(theta, lift, REST)) feetGone = p
      if (headGone < 0 && headHiddenAt(theta, lift, REST)) headGone = p
    }
    expect(feetGone).toBeGreaterThan(0)
    expect(headGone).toBeGreaterThan(feetGone)
  })

  it('spends a real share of the flight sinking behind the crest, not a frame of it', () => {
    // The plunge is the beat: she goes down behind the world by the head. The
    // inside-ball conditions dominate both ends of the window, so the share
    // holds at the pull-back too, where the tangent sits further round.
    expect(exitSinkShare(REST)).toBeGreaterThan(0.25)
    expect(exitSinkShare(FULL)).toBeGreaterThan(0.25)
  })

  it('keeps her on the planet, and drawn, for the whole performance', () => {
    for (let i = 0; i <= 600; i++) {
      const t = GIRL_TURN_START + ((GIRL_JUMP_END - GIRL_TURN_START) * i) / 600
      const pose = poseAtT(t)
      expect(pose.stage).toBe('globe')
      expect(pose.visible).toBe(true)
    }
  })

  it('never un-walks: her bearing is monotone over the whole globe stage', () => {
    let prev = Infinity
    for (let i = 0; i <= 2000; i++) {
      const t = (GIRL_TRANSFER * i) / 2000
      const theta = poseAtT(Math.min(t, GIRL_TRANSFER - 1e-9)).theta
      expect(theta).toBeLessThanOrEqual(prev + 1e-12)
      prev = theta
    }
  })
})

describe('the jump clip mapping never reaches ground she no longer has', () => {
  it('is zero at takeoff and monotone through the flight', () => {
    expect(Object.is(jumpClipFracAt(0), 0)).toBe(true)
    let prev = -Infinity
    for (let i = 0; i <= 1000; i++) {
      const f = jumpClipFracAt(i / 1000)
      expect(f).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = f
    }
  })

  it('plays the clip’s own apex frame exactly at the arc’s apex', () => {
    expect(jumpClipFracAt(GIRL_JUMP_APEX)).toBeCloseTo(JUMP_CLIP_APEX, 12)
  })

  it('stops before the clip’s landing absorb — she never lands', () => {
    // Jump_B's hips cross rest at ~0.32 of the clip and the landing squat is in
    // full absorb by ~0.36 (t87 clip inventory). The hold must stay clear of it.
    expect(JUMP_CLIP_HOLD).toBeLessThan(0.36)
    expect(jumpClipFracAt(1)).toBeCloseTo(JUMP_CLIP_HOLD, 12)
  })

  it('blends in fast, exactly, and stays there', () => {
    expect(Object.is(jumpBlendAt(0), 0)).toBe(true)
    expect(Object.is(jumpBlendAt(-1), 0)).toBe(true)
    expect(jumpBlendAt(JUMP_BLEND_IN)).toBe(1)
    expect(jumpBlendAt(1)).toBe(1)
    let prev = -Infinity
    for (let i = 0; i <= 500; i++) {
      const w = jumpBlendAt(i / 500)
      expect(w).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = w
    }
  })
})

describe('the cut is covered at both ends', () => {
  it('has finished the flight before she stops being on the planet', () => {
    expect(GIRL_JUMP_END).toBeLessThanOrEqual(GIRL_TRANSFER)
    expect(poseAtT(GIRL_TRANSFER - 1e-6).stage).toBe('globe')
    expect(poseAtT(GIRL_TRANSFER).stage).toBe('desk')
  })

  it('is already hidden behind the planet when she stops being on it', () => {
    const pose = poseAtT(GIRL_TRANSFER - 1e-6)
    expect(headHiddenAt(pose.theta, pose.lift, REST)).toBe(true)
    expect(headHiddenAt(pose.theta, pose.lift, FULL)).toBe(true)
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
      for (const k of ['theta', 'lift', 'jump', 'x', 'z', 'yaw', 'scale', 'walked', 'moving'] as const) {
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

  it('freezes the walked distance for the goodbye and the flight — the skip clip is weightless there', () => {
    const atStop = poseAtT(GIRL_WALK_END + 1e-6).walked
    for (let i = 0; i <= 400; i++) {
      const t = GIRL_WALK_END + ((GIRL_TRANSFER - 1e-6 - GIRL_WALK_END) * i) / 400
      expect(poseAtT(t).walked).toBeCloseTo(atStop, 9)
    }
  })

  it('holds the driver’s whole domain without leaving the ending’s vocabulary', () => {
    for (let i = 0; i <= 2000; i++) {
      const pose = girlPoseAt(endingStateAt((i / 2000) * TRACK_END), false)
      expect(['journey', 'globe', 'desk']).toContain(pose.stage)
      expect(Number.isFinite(pose.x)).toBe(true)
      expect(Number.isFinite(pose.z)).toBe(true)
      expect(Number.isFinite(pose.yaw)).toBe(true)
      expect(Number.isFinite(pose.lift)).toBe(true)
      expect(pose.jump).toBeGreaterThanOrEqual(0)
      expect(pose.jump).toBeLessThanOrEqual(1)
      expect(pose.scale).toBeGreaterThan(0)
    }
  })

  it('leaves the camera invariant’s domain completely alone', () => {
    // Her whole performance lives before ZOOM_START's own still-beat boundary;
    // nothing here may be read as licence for the camera to move earlier.
    expect(1 + GIRL_TURN_START * ENDING_SPAN).toBeGreaterThan(1)
    expect(ZOOM_FIRST_MOVE).toBeGreaterThan(1)
    expect(GIRL_JUMP_END).toBeLessThan(ZOOM_START)
  })
})

describe('the hiding predicate is honest at its seams', () => {
  it('hides any point inside the ball from any distance at all', () => {
    expect(pointHiddenAt(CAMERA_THETA, PLANET_RADIUS - 0.01, 1e9)).toBe(true)
    expect(pointHiddenAt(0, PLANET_RADIUS * 0.5, REST)).toBe(true)
  })

  it('keeps the Task 76 two-horizon behaviour for raised points', () => {
    // A raised point stays visible far past the surface horizon — the finding
    // the whole Task 76 exit was solved around.
    const surfaceHorizon = CAMERA_THETA - Math.acos(PLANET_RADIUS / REST)
    expect(pointHiddenAt(surfaceHorizon - 0.2, PLANET_RADIUS + GIRL_GLOBE_HEIGHT, REST)).toBe(false)
    expect(pointHiddenAt(surfaceHorizon - 0.01, PLANET_RADIUS, REST)).toBe(true)
  })

  it('is still visible at the start of the walk — she does not vanish early', () => {
    expect(headHiddenAt(STANCE_ALPHA, 0, REST)).toBe(false)
    expect(feetHiddenAt(STANCE_ALPHA, 0, REST)).toBe(false)
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
      expect(Object.is(pose.jump, 0)).toBe(true)
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
