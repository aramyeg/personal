import { describe, expect, it } from 'vitest'
import {
  CAMERA_DISTANCE,
  ENDING_AIM_DROP,
  ZOOM_FACTOR,
  endingRig,
  globeEdgesAt,
  ndcYAt,
} from '@/components/labs/small-world/scene/camera'
import { PLANET_RADIUS } from '@/components/labs/small-world/scene/land-bake'
import {
  DESK_BACK_Z,
  DESK_TOP_Y,
  journeyFloorY,
} from '@/components/labs/small-world/scene/desk-stage'
import {
  CRADLE_DROP,
  CRADLE_INNER_REACH,
  CRADLE_RADIUS,
  CRADLE_TERRAIN_CLEAR,
  CRADLE_TUBE,
  STAND_BACK_REACH,
  STAND_COLLAR_R,
  STAND_COLLAR_Y,
  STAND_FOOT_R,
  STAND_FOOT_Y,
  STAND_PARK_DROP,
  WORLD_CEILING,
  cradleClearsTerrain,
  standBelowJourneyFrame,
  standOffsetY,
  standYRange,
} from '@/components/labs/small-world/scene/globe-stand'
import {
  ENDING_SPAN,
  STAND_END,
  TRACK_END,
  ZOOM_START,
  endingStateAt,
} from '@/components/labs/small-world/ending-timeline'

/**
 * THE GLOBE STAND (Task 66).
 *
 * Three claims, and they are the three the brief asked to be PROVED rather than shown:
 *   1. the journey never sees it — its whole travel is inside progress > 1;
 *   2. it is seated — the cradle wraps the world's lower silhouette, in front AND behind, at every
 *      zoom stop, and never covers terrain;
 *   3. nothing shows sky underneath it, at any stop.
 *
 * Everything re-derives off the shipped constants and the shipped camera path. Where a number is
 * quoted in a message it is computed, not typed.
 */

const endingAt = (u: number) => 1 + u * ENDING_SPAN

/** Every zoom stop the pull-back actually attains, with the aim that goes with it. */
function stops(n = 240): { k: number; aim: number; label: string }[] {
  const out: { k: number; aim: number; label: string }[] = []
  for (let i = 0; i <= n; i++) {
    const zoom = i / n
    const s = zoom * zoom * (3 - 2 * zoom)
    out.push({
      k: Math.exp(Math.log(ZOOM_FACTOR) * s),
      aim: ENDING_AIM_DROP * s,
      label: `zoom=${zoom.toFixed(3)}`,
    })
  }
  return out
}

describe('the stand does not exist during the journey', () => {
  it('is parked wholly below the journey camera at every progress the journey owns', () => {
    for (let i = 0; i <= 4000; i++) {
      const p = i / 4000
      expect(endingStateAt(p).stand, `progress ${p}`).toBe(0)
    }
    expect(standBelowJourneyFrame(0)).toBe(true)
    // ...by exactly the clearance the desk is held to, at the point that decides it
    expect(standYRange(0).top).toBeLessThan(journeyFloorY(-STAND_BACK_REACH))
  })

  it('completes its whole travel inside the ending, before the camera may move', () => {
    // The rise is finished at STAND_END, which is strictly inside the still beat — so the stand
    // never moves and the camera never moves in the same frame.
    expect(STAND_END).toBeLessThan(ZOOM_START)
    expect(endingStateAt(endingAt(STAND_END)).stand).toBe(1)
    expect(endingStateAt(endingAt(STAND_END)).zoom).toBe(0)
    expect(standOffsetY(1)).toBe(0)
    expect(standOffsetY(0)).toBe(-STAND_PARK_DROP)
    // parked at the last journey frame, seated for the whole pull-back
    expect(standOffsetY(endingStateAt(1).stand)).toBe(-STAND_PARK_DROP)
    expect(standOffsetY(endingStateAt(TRACK_END).stand)).toBe(0)
  })

  it('rises without a pop: eased to zero slope at both ends, and monotone between', () => {
    const dy = 1e-4
    // smootherstep is C2 at both ends, which is what makes a 6-unit travel leave and arrive unseen
    expect(Math.abs(standOffsetY(dy) - standOffsetY(0))).toBeLessThan(1e-10)
    expect(Math.abs(standOffsetY(1) - standOffsetY(1 - dy))).toBeLessThan(1e-10)
    let prev = -Infinity
    for (let i = 0; i <= 2000; i++) {
      const y = standOffsetY(i / 2000)
      expect(y).toBeGreaterThanOrEqual(prev)
      prev = y
    }
  })

  it('is bit-exact backwards — the whole rise is a pure function of scroll', () => {
    const forward: number[] = []
    for (let i = 0; i <= 4000; i++) forward.push(standOffsetY(endingStateAt((i / 4000) * TRACK_END).stand))
    for (let i = 4000; i >= 0; i--) {
      expect(standOffsetY(endingStateAt((i / 4000) * TRACK_END).stand)).toBe(forward[i])
    }
  })

  it('is only ever off-frame while it is moving into frame', () => {
    // The containment claim is about the PARKED pose; while it rises it is deliberately visible.
    // What must not happen is the reverse — a stand already on screen at stand = 0.
    for (let i = 0; i <= 400; i++) {
      const stand = i / 400
      const seated = standBelowJourneyFrame(stand)
      if (stand === 0) expect(seated).toBe(true)
      if (stand === 1) expect(seated).toBe(false)
    }
  })
})

describe('the cradle is a cradle', () => {
  it('cannot be speared by terrain at the bake ceiling', () => {
    expect(WORLD_CEILING).toBeCloseTo(1.35 * PLANET_RADIUS, 12)
    expect(cradleClearsTerrain()).toBe(true)
    expect(CRADLE_INNER_REACH - WORLD_CEILING).toBeGreaterThanOrEqual(CRADLE_TERRAIN_CLEAR)
    // ...and it is not clearing it by being enormous: the ring is within half a radius of the world
    expect(CRADLE_RADIUS).toBeLessThan(PLANET_RADIUS * 1.3)
  })

  it('hangs its NEAR arc below the world and hides its FAR arc behind it, at every stop', () => {
    let minDip = Infinity
    let maxDip = -Infinity
    let minHide = Infinity
    for (const { k, aim, label } of stops()) {
      const g = globeEdgesAt(k, aim)
      const near = ndcYAt([0, -CRADLE_DROP, CRADLE_RADIUS], k, aim)
      const far = ndcYAt([0, -CRADLE_DROP, -CRADLE_RADIUS], k, aim)
      // the near arc is BELOW the world's bottom tangent: that is the part you see
      expect(near, `near arc climbs into the world at ${label}`).toBeLessThan(g.bot)
      // the far arc is INSIDE the silhouette, so the depth buffer removes it: that is the occlusion
      // which separates a cradle from a dish standing behind the world
      expect(far, `far arc escapes the silhouette at ${label}`).toBeGreaterThan(g.bot)
      expect(far).toBeLessThan(g.top)
      minDip = Math.min(minDip, g.bot - near)
      maxDip = Math.max(maxDip, g.bot - near)
      minHide = Math.min(minHide, far - g.bot)
    }
    // readable at its shallowest, and never so deep it reads as a life ring the world floats in
    expect(minDip).toBeGreaterThan(0.05)
    expect(maxDip).toBeLessThan(0.24)
    expect(minHide).toBeGreaterThan(0.04)
  })

  it('never covers the world — the whole ring stays outside the silhouette disc', () => {
    for (const { k, aim, label } of stops(60)) {
      const g = globeEdgesAt(k, aim)
      const cy = (g.top + g.bot) / 2
      const rad = (g.top - g.bot) / 2
      const r = endingRig(k, aim)
      const camDist = Math.hypot(r.cam[1], r.cam[2])
      for (let i = 0; i < 72; i++) {
        const th = (i / 72) * Math.PI * 2
        const p: [number, number, number] = [
          Math.sin(th) * CRADLE_RADIUS,
          -CRADLE_DROP,
          Math.cos(th) * CRADLE_RADIUS,
        ]
        const v = [p[0] - r.cam[0], p[1] - r.cam[1], p[2] - r.cam[2]]
        const depth = v[0] * r.fwd[0] + v[1] * r.fwd[1] + v[2] * r.fwd[2]
        // only the arc IN FRONT of the world's centre plane can cover anything
        if (depth >= camDist) continue
        const y = ndcYAt(p, k, aim)
        const x = v[0] / (depth * Math.tan((38 * Math.PI) / 360))
        expect(
          Math.hypot(x, y - cy),
          `the ring covers terrain at ${label}, bearing ${((th * 180) / Math.PI).toFixed(0)}°`
        ).toBeGreaterThan(rad)
      }
    }
  })
})

describe('nothing shows sky under the stand', () => {
  it('is cropped by the frame or occluded by the desk at every zoom stop', () => {
    // The stand's lowest visible point is the foot. Checked at its CENTRE, which is conservative:
    // the foot's near rim projects lower still, so a centre that clears the line means the whole
    // disc does.
    let worst = -Infinity
    let worstAt = ''
    for (const { k, aim, label } of stops(400)) {
      const foot = ndcYAt([0, STAND_FOOT_Y, 0], k, aim)
      const desk = ndcYAt([0, DESK_TOP_Y, DESK_BACK_Z], k, aim)
      // whichever of the two is currently holding it — the frame while the desk is still off screen,
      // the desk's own edge once it has climbed into view
      const held = Math.max(-1, desk)
      if (foot - held > worst) {
        worst = foot - held
        worstAt = label
      }
    }
    expect(worst, `sky under the stand at ${worstAt}`).toBeLessThan(0)
    // and it is a real margin rather than a squeak — a foot at −5.5 fails this by +0.012
    expect(worst).toBeLessThan(-0.05)
  })

  it('would FAIL with the shallower column the first cut shipped', () => {
    // mutation: the gate has to be the thing that rejects a shorter stem, not decoration around it
    const shallow = -5.5
    let worst = -Infinity
    for (const { k, aim } of stops(400)) {
      const foot = ndcYAt([0, shallow, 0], k, aim)
      const desk = ndcYAt([0, DESK_TOP_Y, DESK_BACK_Z], k, aim)
      worst = Math.max(worst, foot - Math.max(-1, desk))
    }
    expect(worst).toBeGreaterThan(0)
  })

  it('keeps its column clear of the world it stands under', () => {
    // the collar and everything below it must sit under the sphere's own bottom, or the column
    // would be inside the planet rather than under it
    expect(STAND_COLLAR_Y).toBeLessThan(-PLANET_RADIUS)
    expect(STAND_FOOT_Y).toBeLessThan(STAND_COLLAR_Y)
    expect(STAND_COLLAR_R).toBeLessThan(CRADLE_RADIUS)
    expect(STAND_FOOT_R).toBeGreaterThan(STAND_COLLAR_R)
    // ...and the cradle sits above the collar, so the struts really do rise
    expect(-CRADLE_DROP).toBeGreaterThan(STAND_COLLAR_Y)
    expect(CRADLE_TUBE).toBeLessThan(CRADLE_RADIUS * 0.1)
  })
})

describe('the seated read is the same read at rest and at the money shot', () => {
  it('shows the cradle at the rest camera too, where the still beat leaves it', () => {
    // The whole rise happens with the camera frozen, so the beat's own frame is the rest one — if
    // the cradle only worked at full pull-back the still beat would show a ring under nothing.
    const g = globeEdgesAt(1, 0)
    const near = ndcYAt([0, -CRADLE_DROP, CRADLE_RADIUS], 1, 0)
    const far = ndcYAt([0, -CRADLE_DROP, -CRADLE_RADIUS], 1, 0)
    expect(near).toBeLessThan(g.bot)
    expect(far).toBeGreaterThan(g.bot)
    expect(near).toBeGreaterThan(-1) // on frame, not below it
  })

  it('travels a distance that is a consequence of the camera, not a chosen number', () => {
    // STAND_PARK_DROP is solved off journeyFloorY; a different camera moves it. Re-derived here
    // rather than restated, which is what stops this becoming a number typed in two places.
    expect(STAND_PARK_DROP).toBeCloseTo(
      -CRADLE_DROP + CRADLE_TUBE - (journeyFloorY(-CRADLE_RADIUS) - 0.35),
      12
    )
    expect(STAND_PARK_DROP).toBeGreaterThan(0)
    expect(CAMERA_DISTANCE).toBeGreaterThan(0)
  })
})
