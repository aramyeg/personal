import { WORLD_RADIUS } from './camera'
import { DESK_CLEARANCE, journeyFloorY } from './desk-stage'

/**
 * THE GLOBE STAND (Task 66) — the thing the little world turns out to be sitting in.
 *
 * ============================================================================
 * WHY IT ARRIVES, WHEN NOTHING ELSE IN THIS LAB DOES
 * ============================================================================
 * Task 65's desk is permanently mounted and the argument for that is good: a fade is a thing the
 * eye can catch, the pull-back already has one job, and parked geometry has no entrance to get
 * wrong at any scrub speed. This module does the opposite, and it is not a reversal of that
 * reasoning — it is the case the reasoning does not reach.
 *
 * The desk can be parked because the desk never touches the world. This cannot. `desk-stage.ts`
 * carries the theorem: the journey's camera shows 8.524° of sky under the world for six chapters,
 * so ANY static geometry that meets the planet from below is on screen from the first frame of the
 * lab. A cradle is exactly such geometry. The choice is therefore not "park it or fade it" — it is
 * "arrive, or do not exist", and Aram asked for a world that is sitting on its stand.
 *
 * So it arrives, and it arrives on the one beat that had nothing else to do. The still beat used to
 * hold a bow; now it holds this. The stand comes up from below the frame while the camera is still
 * frozen at its journey pose, and by the time the pull-back starts the world is seated.
 *
 * ============================================================================
 * WHAT MAKES IT A CRADLE AND NOT A DISH
 * ============================================================================
 * The failure Task 65 shipped and Aram named is a stand that is BEHIND the world rather than under
 * it. What separates the two is not proximity — ten pixels of gap is a gap — it is whether the
 * world OCCLUDES part of the stand. So the cradle is a horizontal ring centred on the world:
 *
 *   - its NEAR arc passes in front of the world's lower silhouette and hangs below it;
 *   - its FAR arc is behind the world and the depth buffer hides it completely;
 *   - its sides emerge either side, just outside the silhouette.
 *
 * A ring around a sphere is what that reads as, at every zoom stop, because it is what it is. The
 * ring does NOT touch the terrain and cannot: the bake's ceiling budget is 1.35·R, so a ring hugging
 * the sphere would be speared by the first mountain that rotated under it. It stands
 * CRADLE_TERRAIN_CLEAR outside that budget instead, which is invisible from a camera that only ever
 * sees this from above and outside — the contact the eye reads is the occlusion, and the occlusion
 * is real.
 *
 * ============================================================================
 * DETERMINISM
 * ============================================================================
 * Everything is a pure function of `EndingState.stand`. No clock, no state, no easing that
 * remembers: scrubbing back lowers the stand through the identical arithmetic, bit for bit. The
 * PLANET never moves — the stand travels to it, which is also why nothing about the renewal proofs
 * or the bake is touched.
 */

// --- the cradle -------------------------------------------------------------

/**
 * How far the ring's own tube must stay outside the bake's ceiling budget.
 *
 * The budget is 1.35·R and it is a real ceiling, not a typical value — the ring spans the whole
 * width of the world at its latitude, so every wedge passes under it as the planet turns and the
 * clearance has to hold for the tallest thing any of them carries.
 */
export const CRADLE_TERRAIN_CLEAR = 0.12

/** The bake's own ceiling, restated from the constant `land-bake.ts` documents. */
export const WORLD_CEILING = 1.35 * WORLD_RADIUS

/** Major radius of the cradle ring, measured to the tube's centreline. */
export const CRADLE_RADIUS = 2.75

/** How far below the world's centre the ring's plane sits. */
export const CRADLE_DROP = 1.75

/** Tube radius. Thin enough to read as a turned ring rather than as a tyre. */
export const CRADLE_TUBE = 0.15

/** The closest the ring's surface comes to the world's centre — what the clearance is measured on. */
export const CRADLE_INNER_REACH = Math.hypot(CRADLE_RADIUS, CRADLE_DROP) - CRADLE_TUBE

/** True when the ring cannot be speared by terrain at the bake's ceiling. */
export const cradleClearsTerrain = (): boolean =>
  CRADLE_INNER_REACH - WORLD_CEILING >= CRADLE_TERRAIN_CLEAR

// --- the column below it ----------------------------------------------------

/**
 * Where the stand's foot sits, and why it is so far down.
 *
 * The stand may never show sky underneath it. There are two things that can satisfy that — the
 * frame's own bottom edge, and the desk's back edge — and they hand over to each other partway
 * through the pull-back: at rest the desk is off screen and the FRAME crops the column, and by the
 * time the desk's edge has climbed into view it is above where the column's foot projects, so the
 * desk occludes it. In between there is a window where the frame has released the foot and the desk
 * has not yet caught it, and the foot has to be low enough to clear that window entirely.
 *
 * −6.5 does it with room: the worst case over the whole pull-back leaves the foot 0.134 of the
 * frame's half-height BELOW whichever of the two is holding it. `globe-stand.test.ts` sweeps the
 * shipped camera path and gates it rather than trusting this paragraph, and a foot at −5.5 (the
 * first cut) fails that sweep by 0.012 at zoom scale 1.04 — a one-percent-of-frame sliver of sky
 * under the stand, for about two percent of the pull-back. Visible if you look for it.
 */
export const STAND_FOOT_Y = -6.5

/** Where the column's collar meets the struts, clear of the world's bottom at −R. */
export const STAND_COLLAR_Y = -3.15

/** Radius of the collar the three struts land on. */
export const STAND_COLLAR_R = 0.68

/** ...and of the foot at the bottom of the column. */
export const STAND_FOOT_R = 0.95

/** How many struts carry the ring. Three: the fewest that cannot rock. */
export const STAND_STRUTS = 3

/** Bearing of the first strut, so none of them stands dead centre in front of the world. */
export const STAND_STRUT_PHASE = Math.PI / 6

// --- the rise ---------------------------------------------------------------

/**
 * How far the whole stand drops when it is parked — SOLVED against the journey's own containment
 * rule rather than chosen, so a retuned camera moves the parked pose instead of opening a leak.
 *
 * The binding point is the ring's crown at its REARMOST bearing: `journeyFloorY` climbs with z, so
 * the frustum's floor is lowest behind the world, and the topmost parked vertex there is
 * `CRADLE_TUBE` above the ring's plane at `z = −CRADLE_RADIUS`. Everything else on the stand is
 * below the ring and in front of that point, so one evaluation bounds the whole object.
 */
export const STAND_PARK_DROP =
  -CRADLE_DROP + CRADLE_TUBE - (journeyFloorY(-CRADLE_RADIUS) - DESK_CLEARANCE)

/**
 * The stand's vertical offset at an ending state's `stand` value: `−STAND_PARK_DROP` parked,
 * exactly 0 seated.
 *
 * Eased with smootherstep rather than smoothstep, and that is the whole choreography: this is a
 * REVEAL, not a transition, so it has to leave the bottom of the frame without a visible start and
 * arrive under the world without a visible stop. Smoothstep's ends have non-zero curvature and at
 * this travel (6.4 world units) you can see the arrival snap. Smootherstep is zero in both the
 * first and second derivative at each end.
 *
 * `smootherstep(0)` is exactly 0 and `smootherstep(1)` is exactly 1 (1·1·1·(6−15+10)), so both the
 * parked pose and the seated pose are exact rather than asymptotic — the seated stand is bit-for-bit
 * the same object for the whole pull-back, which is what lets the composition proofs be made once.
 */
export function standOffsetY(stand: number): number {
  const x = stand < 0 ? 0 : stand > 1 ? 1 : stand
  const e = x * x * x * (x * (x * 6 - 15) + 10)
  return STAND_PARK_DROP * (e - 1)
}

/**
 * Every world-space y the stand's geometry occupies at a given `stand`, as the interval the
 * containment gate is made against. `top` is the ring's crown; `bottom` is the foot.
 */
export function standYRange(stand: number): { top: number; bottom: number } {
  const dy = standOffsetY(stand)
  return { top: -CRADLE_DROP + CRADLE_TUBE + dy, bottom: STAND_FOOT_Y + dy }
}

/**
 * The rearmost z any part of the stand reaches — where its containment is decided, exactly as a
 * desk prop's is decided at its own back.
 */
export const STAND_BACK_REACH = CRADLE_RADIUS + CRADLE_TUBE

/** True when the stand at this `stand` value is wholly below the journey camera's bottom edge. */
export function standBelowJourneyFrame(stand: number): boolean {
  return standYRange(stand).top < journeyFloorY(-STAND_BACK_REACH)
}
