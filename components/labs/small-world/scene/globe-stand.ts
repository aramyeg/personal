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

/** The closest the ring's surface comes to the world's centre. */
export const CRADLE_INNER_REACH = Math.hypot(CRADLE_RADIUS, CRADLE_DROP) - CRADLE_TUBE

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
 * −7.5 does it with room: the worst case over the whole pull-back leaves the foot 0.151 of the
 * frame's half-height BELOW whichever of the two is holding it. `globe-stand.test.ts` sweeps the
 * shipped camera path and gates it rather than trusting this paragraph, and a foot at −5.5 (the
 * first cut) fails that sweep by 0.012 at zoom scale 1.04 — a one-percent-of-frame sliver of sky
 * under the stand, for about two percent of the pull-back. Visible if you look for it.
 *
 * The SECOND cut, −6.5, passed that same sweep by 0.134 and was still wrong, because the sweep ran
 * against `DESK_BACK_Z` rather than against the edge the slab actually draws. The hand-formed wobble
 * carries that edge up to `EDGE_WOBBLE` forward, i.e. 0.06 of the frame LOWER, and against the real
 * boundary −6.5 clears by 0.009 — a hundredth of the frame, which is not a margin, it is a
 * coincidence. Gating on the line nobody can see is how a defect ships twice.
 */
export const STAND_FOOT_Y = -7.5

/**
 * Where the column's collar meets the struts — and it is a LOW one for a reason that only shows up
 * when you measure the strut instead of its endpoints.
 *
 * A strut is a straight line from the collar to the ring, and both of its ENDS are comfortably
 * outside the bake's ceiling: the collar at 3.77 from the world's centre, the ring at 3.26. The
 * CHORD between them is not. A line between two points outside a sphere dips toward it, and the
 * first cut's narrow collar (r = 0.68 at y = −3.15) put the deepest point of that dip at 2.8522 —
 * INSIDE the 2.97 ceiling by 0.118, in a stand whose whole documented safety property is that it
 * stands outside it. Nothing was visibly wrong (the struts stay 0.128 ndc clear of the silhouette on
 * screen, and the planet is parked so nothing can rotate into them) which is exactly why it survived
 * a capture pass: the module was claiming something the geometry did not do.
 *
 * The fix has to come from the chord's GEOMETRY, and there are two ways to get it. WIDENING the
 * collar works arithmetically and was the first attempt — at (1.4, −3.5) the dip clears by 0.138 —
 * and it was reverted after a capture: a wide collar landing on a wide foot collapses the open
 * tripod into one bulbous silhouette. That is exactly the "a wide flared cup at close range is a
 * mushroom" failure Task 65 recorded about its own dish, reintroduced from the other direction.
 *
 * DROPPING a narrow collar does the same work and costs nothing. The lower the strut's bottom end,
 * the more upright the chord and the shallower its dip: at (0.75, −4.5) the deepest point is 3.1153,
 * clear by 0.145 — a better margin than the wide collar bought — with struts that are longer, more
 * slender and 36° off vertical. `globe-stand.test.ts` measures EVERY authored primitive rather than
 * the ring alone, which is what would have caught the original in the first place.
 */
export const STAND_COLLAR_Y = -4.5

/** Radius of the collar the three struts land on. See STAND_COLLAR_Y for why it stayed narrow. */
export const STAND_COLLAR_R = 0.75

/** ...and of the foot at the bottom of the column. Never visible (cropped by the frame at rest,
 *  occluded by the desk after), so this only has to keep the turned profile honest. */
export const STAND_FOOT_R = 0.95

/** How many struts carry the ring. Three: the fewest that cannot rock. */
export const STAND_STRUTS = 3

/** Bearing of the first strut, so none of them stands dead centre in front of the world. */
export const STAND_STRUT_PHASE = Math.PI / 6

/** The strut's own tube, tapering from the ring down to the collar. Owned here rather than in the
 *  renderer because the clearance below is measured against it. */
export const STRUT_TUBE_TOP = CRADLE_TUBE * 0.7
export const STRUT_TUBE_BOTTOM = CRADLE_TUBE * 0.92

/** How thick the collar ring is, and how tall the foot. Both feed the clearances below. */
export const STAND_COLLAR_H = CRADLE_TUBE * 2.4
export const STAND_FOOT_H = 0.34

/**
 * Closest approach to the world's CENTRE of every authored primitive, in world units.
 *
 * This is the whole of the stand's terrain-safety claim, and it covers the whole stand because the
 * version that covered only the ring was WRONG about the struts by 0.118 (see STAND_COLLAR_Y). The
 * shapes are solids of revolution about the y axis, so each one's closest point is found in the
 * (radial, y) half-plane:
 *  - the CRADLE is a torus, so its closest point is its centreline distance less the tube;
 *  - a STRUT is a segment between two (radial, y) points, so it is a point-to-segment distance less
 *    its widest tube — the case the first cut got wrong, because both ENDS are clear and the middle
 *    is not;
 *  - the COLLAR, STEM and FOOT are solid cylinders on the axis, so their closest point is the centre
 *    of the top face, i.e. the height of that face.
 */
export function standPrimitiveReaches(): { part: string; reach: number }[] {
  const segmentReach = (ar: number, ay: number, br: number, by: number): number => {
    const dr = br - ar
    const dy = by - ay
    const len2 = dr * dr + dy * dy
    const t = Math.min(1, Math.max(0, -(ar * dr + ay * dy) / len2))
    return Math.hypot(ar + t * dr, ay + t * dy)
  }
  return [
    { part: 'cradle', reach: CRADLE_INNER_REACH },
    {
      part: 'strut',
      reach:
        segmentReach(STAND_COLLAR_R, STAND_COLLAR_Y, CRADLE_RADIUS, -CRADLE_DROP) -
        Math.max(STRUT_TUBE_TOP, STRUT_TUBE_BOTTOM),
    },
    { part: 'collar', reach: Math.abs(STAND_COLLAR_Y + STAND_COLLAR_H / 2) },
    { part: 'stem', reach: Math.abs(STAND_COLLAR_Y) },
    { part: 'foot', reach: Math.abs(STAND_FOOT_Y + STAND_FOOT_H) },
  ]
}

/** ...and the binding one. */
export const standTerrainClearance = (): number =>
  Math.min(...standPrimitiveReaches().map((p) => p.reach)) - WORLD_CEILING

/** True when NO part of the stand can be speared by anything inside the bake's ceiling budget. */
export const standClearsTerrain = (): boolean => standTerrainClearance() >= CRADLE_TERRAIN_CLEAR

// --- the rise ---------------------------------------------------------------

/**
 * The rearmost z any part of the stand reaches — where its containment is decided, exactly as a
 * desk prop's is decided at its own back.
 */
export const STAND_BACK_REACH = CRADLE_RADIUS + CRADLE_TUBE

/**
 * How far the whole stand drops when it is parked — SOLVED against the journey's own containment
 * rule rather than chosen, so a retuned camera moves the parked pose instead of opening a leak.
 *
 * The binding point is the ring's crown at its REARMOST bearing: `journeyFloorY` climbs with z, so
 * the frustum's floor is lowest behind the world, and the topmost parked vertex there is
 * `CRADLE_TUBE` above the ring's plane. Everything else on the stand is below the ring and in front
 * of that point, so one evaluation bounds the whole object — verified by sweeping every authored
 * primitive in `globe-stand.test.ts`, which finds the true worst margin at the cradle.
 *
 * Evaluated at `−STAND_BACK_REACH` rather than at `−CRADLE_RADIUS`, which is the same point the GATE
 * uses. The two disagreed by the tube's width: the solve gave the crown a clearance of exactly
 * DESK_CLEARANCE at the ring's CENTRELINE while the gate measured it a tube further back, where the
 * frustum floor is lower, so the shipped margin was 0.2285 and the docblock said 0.35. Solving at
 * the gate's own point makes the sentence true instead of nearly true.
 */
export const STAND_PARK_DROP =
  -CRADLE_DROP + CRADLE_TUBE - (journeyFloorY(-STAND_BACK_REACH) - DESK_CLEARANCE)

/**
 * The stand's vertical offset at an ending state's `stand` value: `−STAND_PARK_DROP` parked,
 * exactly 0 seated.
 *
 * Eased with smootherstep rather than smoothstep, and that is the whole choreography: this is a
 * REVEAL, not a transition, so it has to leave the bottom of the frame without a visible start and
 * arrive under the world without a visible stop. Smoothstep's ends have non-zero curvature and at
 * this travel (6.2 world units) you can see the arrival snap. Smootherstep is zero in both the
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


/** True when the stand at this `stand` value is wholly below the journey camera's bottom edge. */
export function standBelowJourneyFrame(stand: number): boolean {
  return standYRange(stand).top < journeyFloorY(-STAND_BACK_REACH)
}
