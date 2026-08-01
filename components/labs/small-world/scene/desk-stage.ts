import {
  CAMERA_DISTANCE,
  CAMERA_FOV,
  CAMERA_PITCH_DEG,
  DESK_EDGE_V,
  ENDING_AIM_DROP,
  ZOOM_FACTOR,
  endingRig,
  ndcYAt,
} from './camera'

/**
 * THE DESK'S STAGE (Task 65) — where a permanently-mounted desk is allowed to exist.
 *
 * ============================================================================
 * THE PROBLEM
 * ============================================================================
 * The desk is static world-space geometry: it is mounted for the whole visit, it never fades in
 * and it never moves, so there is nothing to pop and nothing to scrub. The price of that is a
 * containment proof — during the six chapters the camera is frozen at ONE pose, and it must not
 * see a single pixel of the desk. A desk corner peeking under the planet mid-journey is not a
 * blemish, it is the reveal spent early.
 *
 * ============================================================================
 * THE CONSTRAINT, AND WHY IT DOES NOT DEPEND ON THE VIEWPORT
 * ============================================================================
 * The rest camera sits at CAMERA_DISTANCE along CAMERA_RAY, pitched CAMERA_PITCH_DEG down, aimed
 * at the origin, with no roll. Its bottom frustum plane therefore contains the world x axis, so
 * it is the graph of a straight line in the (z, y) plane:
 *
 *     journeyFloorY(z) = camY − tan(pitch + fov/2) · (camZ − z)
 *
 * and a point is out of frame — off the BOTTOM of it — exactly when `y < journeyFloorY(z)`.
 *
 * `aspect` appears nowhere in that expression, and that is the whole aperture argument. three.js's
 * PerspectiveCamera holds the VERTICAL fov fixed and widens the horizontal one with the viewport,
 * so a wider window moves the left and right planes and leaves the top and bottom exactly where
 * they were. Ultrawide — T63's binding case for the sky — cannot pull the desk into frame; it can
 * only reveal more of the desk's own width, which is why DESK_HALF_W below is sized from an aspect
 * far past anything real. `desk-stage.test.ts` re-derives the same bound from the real frustum
 * CORNER RAYS at every aspect rather than trusting this paragraph.
 *
 * ============================================================================
 * WHAT THE CONSTRAINT COSTS THE COMPOSITION (the honest part)
 * ============================================================================
 * At rest the planet's lower tangent ray leaves the camera 30.476° below horizontal and the frame's
 * bottom edge leaves it at 39.000°. Between them is 8.524° — 22.4% of the frame height — of sky the
 * journey shows under the world, every frame, for six chapters. Nothing contained by the rule above
 * can enter that wedge, so NO STATIC GEOMETRY CAN TOUCH THE PLANET. Not a stand, not a plinth, not
 * a cradle: the world is unreachable from below by construction, and any drawing of one that shows
 * clay meeting the planet is drawing a leak.
 *
 * The desk therefore does not hold the world up — it sits IN FRONT of it, and the reveal resolves
 * in perspective instead of in contact. `DESK_TOP_Y` is the free parameter that buys that: raising
 * the desk plane pushes its back edge FORWARD (the line above is climbing), which at full pull-back
 * lifts the back edge on screen.
 *
 * ============================================================================
 * WHAT TASK 66 CHANGED ABOUT THE ANSWER (not about the theorem)
 * ============================================================================
 * The wedge stands; it is a fact about this camera. What Task 65 did with it was close the gap by
 * OCCLUSION — a stand prop nine units in front of the world whose rim rose past the planet's
 * silhouette at full pull-back. Aram's verdict on that was "make so the globe is sitting on the
 * stand not hovering behind it", and he was reading the geometry correctly: a prop at z = 9.9
 * standing under a sphere at z = 0 is the wrong size to be holding it, and at every zoom stop
 * before the last one there is visible sky between the two.
 *
 * The resolution is the one the theorem itself points at. The wedge forbids STATIC geometry from
 * touching the world; it says nothing about geometry that arrives after the journey is over. So the
 * stand left this file: it is now real geometry AT the world — a cradle ring the sphere sits in,
 * whose far arc is genuinely behind the sphere and hidden by it — that rises from below the frame
 * during the ending's still beat. `scene/globe-stand.ts` carries it, and its REST pose is held to
 * exactly the containment rule this module publishes, so the journey still cannot see it.
 *
 * What is left here is the desk, which never touched the world and never will.
 */

const PITCH = (CAMERA_PITCH_DEG * Math.PI) / 180
const HALF_FOV = (CAMERA_FOV * Math.PI) / 360
const TAN_HALF_FOV = Math.tan(HALF_FOV)

/** The rest camera, spelled the way camera.ts spells it — the desk moves if the camera is retuned. */
const CAM_Y = CAMERA_DISTANCE * Math.sin(PITCH)
const CAM_Z = CAMERA_DISTANCE * Math.cos(PITCH)

/** Slope of the bottom frustum plane in the (z, y) plane. */
const FLOOR_SLOPE = Math.tan(PITCH + HALF_FOV)

/**
 * The height of the journey camera's bottom frustum plane at a given z. Everything the desk set
 * owns must sit strictly below this line; nothing is exempt, including the props' tips.
 */
export function journeyFloorY(z: number): number {
  return CAM_Y - FLOOR_SLOPE * (CAM_Z - z)
}

/** How far below the journey's bottom edge the desk's own surface is parked, in world units. */
export const DESK_CLEARANCE = 0.35

/** The desk's far edge for a given plane height: the first z at which a surface there is still
 *  DESK_CLEARANCE below the journey's bottom edge. */
const backZFor = (topY: number): number => CAM_Z - (CAM_Y - topY - DESK_CLEARANCE) / FLOOR_SLOPE

/**
 * The desk plane's height — SOLVED from the composition (Task 66), where Task 65 authored it as 0.
 *
 * It was always THE free parameter, and what it actually buys is now written down as a target
 * rather than as a paragraph: raising the plane pushes the back edge FORWARD (the frustum floor
 * climbs with z), which lifts the edge on screen at full pull-back. `DESK_EDGE_V` says where that
 * edge has to land; this bisects for the plane that puts it there. Monotone, so the bisection is
 * honest: a higher plane is a nearer edge is a higher screen line, with no turning point.
 *
 * At the shipped targets it lands at 1.26 — the plane sits ABOVE the world's centre height, which
 * looks alarming written down and is not: the desk begins 8.2 units in FRONT of the world and the
 * two never share a z. What it means is that the visitor is looking at a near table edge with the
 * world beyond it, which is the geometry that reads as "on the desk" from this camera. The honest
 * limit of that reading is the 8.5° wedge (see the header) and it is why the world needs a STAND
 * that arrives with the ending rather than a taller desk.
 */
export const DESK_TOP_Y = (() => {
  let lo = -6
  let hi = 6
  for (let i = 0; i < 90; i++) {
    const mid = (lo + hi) / 2
    if (ndcYAt([0, mid, backZFor(mid)], ZOOM_FACTOR, ENDING_AIM_DROP) < DESK_EDGE_V) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
})()

/**
 * The desk's far edge. Solved rather than typed, so retuning the fov, the pitch, the distance or
 * the clearance walks the desk to wherever it is legal instead of quietly opening a leak.
 */
export const DESK_BACK_Z = backZFor(DESK_TOP_Y)

/**
 * Where the desk surface LEAVES the bottom of the money shot: the z at which the plane crosses
 * ndc −1 at full pull-back, aim included. Solved against the real projection rather than against
 * the un-aimed frustum line Task 65 could use, because the aim drop moves this by 2.6 units and a
 * slab that stopped short of it would show sky under its own near edge.
 */
const DESK_EXIT_Z = (() => {
  // Closed form, and deliberately NOT a bisection on `ndcYAt`: ndc y is not monotone in z along
  // this plane — it dives to −∞ where the plane crosses the camera's own depth and reappears
  // positive behind it, so a bisection over any range wide enough to be safe brackets the WRONG
  // root and returns a desk 56 units long. Intersecting the bottom frustum ray with the plane has
  // no such branch.
  const r = endingRig(ZOOM_FACTOR, ENDING_AIM_DROP)
  const dy = r.fwd[1] - TAN_HALF_FOV * r.up[1]
  const dz = r.fwd[2] - TAN_HALF_FOV * r.up[2]
  return r.cam[2] + ((DESK_TOP_Y - r.cam[1]) / dy) * dz
})()

/** ...and the slab runs past it, so the desk reaches the bottom of the frame. */
export const DESK_NEAR_Z = DESK_EXIT_Z + 2.2

/**
 * The widest viewport the slab is sized for. 4 is not a hedge — 5120×1440 is 3.556 and the desk
 * costs two triangles per unit of width, so the honest thing is to buy far past the edge case
 * rather than to pick a number that happens to cover the monitors we tested on.
 */
export const DESK_MAX_ASPECT = 4

/**
 * Half the slab's width. The frame is widest, in world units, at the DEEPEST desk point still on
 * screen — which is the back edge at full pull-back, because pulling back is the only thing that
 * moves the camera and every nearer point is nearer. So one evaluation there bounds every zoom and
 * every aspect at once.
 */
export const DESK_HALF_W = deskAxialDepth(DESK_BACK_Z) * TAN_HALF_FOV * DESK_MAX_ASPECT * 1.05

/**
 * How far a point on the desk plane at `z` sits along the money shot's VIEW AXIS.
 *
 * Every width question about the money shot goes through this, and it takes the aim into account —
 * `Math.cos(PITCH)` was the right projection while the camera looked at the origin and is simply a
 * different axis now. Exported because the prop composition below is authored against the frame it
 * produces rather than against world units someone eyeballed.
 */
export function deskAxialDepth(z: number, topY = DESK_TOP_Y): number {
  const r = endingRig(ZOOM_FACTOR, ENDING_AIM_DROP)
  return (topY - r.cam[1]) * r.fwd[1] + (z - r.cam[2]) * r.fwd[2]
}

/** Half the frame's WIDTH in world units, on the desk plane at `z`, at full pull-back. */
export function deskFrameHalfW(z: number, aspect: number): number {
  return deskAxialDepth(z) * TAN_HALF_FOV * aspect
}

/**
 * THE VISIBLE STAGE (Task 66), and why the prop rings had to be rebuilt rather than nudged.
 *
 * Round 20 pulled back 3× aiming at the origin; the desk's back edge stood ±16.5 world units wide
 * on a 1440×900 frame and the surface stayed on screen out to z ≈ 21. The composition spread three
 * rings across that, out to |x| = 10.6. At 1.5× with the aim drop, the same frame is ±5.6 at the
 * back edge, ±3.7 by z = 12, and the surface leaves the bottom of the frame at z = 12.0 — a stage
 * roughly a NINTH of the area. Every prop Task 65 placed outside |x| ≈ 5, and everything behind
 * z ≈ 12, is now off screen at the money shot; the 'far' ring is entirely gone and 'wing' means
 * something different. Keeping the old table would have shipped ten props nobody can see and a
 * note below the bottom edge.
 */
export const DESK_STAGE_EXIT_Z = DESK_EXIT_Z

/**
 * How tall a prop standing at `z` may be, measured from the desk surface.
 *
 * The line CLIMBS with z, so the argument a prop has to pass is made at its own BACK rather than at
 * its centre: a mug is legal where the far side of its footprint is, not where it is. That single
 * detail is what makes the staging counter-intuitive — headroom on this desk is a function of how
 * near the viewer a thing stands, so the tall pieces belong at the front and the sides and the back
 * of the desk can hold almost nothing. The set below is arranged to that rule, not around it.
 */
export function propCeiling(z: number): number {
  return journeyFloorY(z) - DESK_TOP_Y
}

/** Every desk prop, as data, so a test can check the shipped composition rather than a sample.
 *  'stand' is gone: the world's stand is no longer a desk prop nine units in front of it that
 *  closes a gap by perspective — it is real geometry at the world, arriving with the ending.
 *  See scene/globe-stand.ts. */
export type DeskPropKind =
  | 'mat'
  | 'mug'
  | 'cup'
  | 'books'
  | 'plant'
  | 'lamp'
  | 'pencil'
  | 'clip'

export type DeskProp = {
  kind: DeskPropKind
  /** Centre on the desk surface. */
  x: number
  z: number
  /** Height above the desk surface of the prop's highest point. The renderer BUILDS to this. */
  top: number
  /** Distance from the centre to the prop's REARMOST point — where its containment is decided. */
  backReach: number
  /** Half-extent along x, for the pieces that are not roughly square. Defaults to `backReach`. */
  halfW?: number
  /** Yaw, radians. */
  rot?: number
  /** Which of the three composition rings it belongs to — see DESK_PROPS. */
  ring: 'core' | 'wing' | 'far'
}

/** True when a prop's highest point is below the journey camera's bottom edge at its own back. */
export function deskPropFits(p: DeskProp): boolean {
  return DESK_TOP_Y + p.top < journeyFloorY(p.z - p.backReach)
}

/**
 * THE COMPOSITION, as numbers — rebuilt for the Task 66 frame.
 *
 * Three rings still, because the desk's visible WIDTH collapses on a phone while its visible
 * height does not, and one arrangement cannot serve both. What changed is every number in them:
 * the stage is now z ∈ [8.26, 12.0] and |x| ≲ 5.5 falling to 3.6, where Task 65 composed against
 * z out to 21 and |x| out to 16.5. See DESK_STAGE_EXIT_Z above for why.
 *
 *   core — |x| ≤ 1.5. On screen at every viewport, phone included. The note and the two figurines
 *          live here and nothing else does: this is the band the DOM connect block sits over, and
 *          clay under type is clutter.
 *   wing — |x| 1.9…4.5. The desk's own life: what you'd actually reach for. Off a phone's frame.
 *   far  — |x| ≥ 5.5. Ultrawide only, and only enough of it to stop 3440×1440 reading as an empty
 *          plain either side of the blotter.
 *
 * FEWER AND CLOSER, which is the brief's instruction and also what the frame can now hold: eleven
 * pieces against Task 65's thirteen, none of them further out than the frame's own edge. The lamp
 * and the tall plant are gone — they were the 'far' ring's tallest pieces, chosen when 'far' meant
 * |x| = 10 with headroom to spare, and at this distance they would stand in front of the world.
 *
 * Every `top` here was chosen against `propCeiling(z - backReach)`, and `desk-stage.test.ts`
 * re-checks all of them against the SHIPPED geometry — the whole point of authoring the set as
 * data is that the gate reads the arrangement instead of a sample of it.
 */
export const DESK_PROPS: readonly DeskProp[] = [
  // THE BLOTTER, first because everything else lies on it. It is the piece that stops the bottom
  // two fifths of the money shot being one unbroken field of tan, and it gives the note an object
  // to sit on instead of a plain. Sized to run off the bottom of the frame and to leave bare desk
  // either side of it on a wide frame.
  { kind: 'mat', x: 0, z: 10.5, top: 0.03, backReach: 1.75, halfW: 3.15, rot: 0, ring: 'core' },

  { kind: 'clip', x: -1.15, z: 9.35, top: 0.07, backReach: 0.24, rot: 0.9, ring: 'core' },

  { kind: 'mug', x: -3.05, z: 10.95, top: 0.86, backReach: 0.62, rot: 0.5, ring: 'wing' },
  { kind: 'cup', x: 3.25, z: 10.7, top: 1.55, backReach: 0.58, rot: -0.3, ring: 'wing' },
  { kind: 'books', x: 4.35, z: 11.65, top: 0.58, backReach: 1.0, rot: -0.25, ring: 'wing' },
  { kind: 'plant', x: -4.25, z: 11.55, top: 1.5, backReach: 0.7, rot: 0.4, ring: 'wing' },
  { kind: 'pencil', x: -1.95, z: 11.75, top: 0.09, backReach: 0.85, rot: -0.42, ring: 'wing' },
  { kind: 'pencil', x: 2.25, z: 11.95, top: 0.09, backReach: 0.85, rot: 0.22, ring: 'wing' },

  { kind: 'books', x: -6.0, z: 10.7, top: 0.72, backReach: 1.05, rot: 0.18, ring: 'far' },
  { kind: 'mug', x: 6.15, z: 11.2, top: 0.9, backReach: 0.62, rot: -0.8, ring: 'far' },
  { kind: 'clip', x: 5.45, z: 9.8, top: 0.07, backReach: 0.24, rot: -0.4, ring: 'far' },
]

/**
 * The note sheet: centre, size and yaw. Kept here rather than in the renderer so the containment
 * gate covers it like everything else — a sheet is flat, but it is authored with a curl and the
 * curl has a height. Its containment is measured at the rearmost corner a yaw could swing to
 * (half the diagonal), so the gate holds for any rotation rather than for the one authored.
 */
export const DESK_NOTE = {
  x: 0.06,
  z: 10.55,
  /**
   * Along the desk's x before yaw.
   *
   * THE BRIEF'S ONE INVERTED ASSUMPTION, and it is worth the paragraph. "The note is bigger in
   * frame now" reads as a consequence of pulling back less; it is the opposite. The sheet is a
   * fixed world object, so halving the camera's distance nearly TRIPLES its share of the frame —
   * left at 6.4 it would have spanned 77% of a desktop frame and 265% of a phone's. What actually
   * pins its size is the NARROW frame: the desk plane is only ±1.3 world units wide at the note's
   * depth on 430×932, and the ratio between a phone's frame width and a desktop's is a property of
   * the two aspects (3.47×), not something the composition gets to choose. So the sheet is sized to
   * very nearly fill the phone and lands where it lands on desktop — 2.37 gives 96% and 28%, against
   * Task 65's 84% and 24%. Bigger, but by a sixth, not by the third anyone expected.
   */
  width: 2.37,
  /** Along the desk's z before yaw. Task 65's 1.88 sheet aspect, kept. */
  depth: 1.26,
  rot: -0.13,
  /**
   * How high the sheet's flat part rides. It has to clear the blotter it is lying ON — a first cut
   * parked the sheet at 0.02 and the mat swallowed every part of it except the curled corner.
   */
  lift: 0.05,
  /** The sheet's highest point above the desk: the lift plus the lifted corner of the curl. */
  top: 0.14,
} as const

/** The note's own containment, made the same way a prop's is. */
export function deskNoteFits(): boolean {
  const reach = Math.hypot(DESK_NOTE.width, DESK_NOTE.depth) / 2
  return DESK_TOP_Y + DESK_NOTE.top < journeyFloorY(DESK_NOTE.z - reach)
}
