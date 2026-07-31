import { CAMERA_DISTANCE, CAMERA_FOV, CAMERA_PITCH_DEG, ZOOM_FACTOR } from './camera'

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
 * lifts the back edge on screen until it closes on the planet's silhouette. At the shipped values
 * the back edge lands 2.3% of the frame height below the planet's bottom, and the stand prop
 * (`DESK_PROPS`, kind 'stand') closes the last two thirds of that: its rim is authored to sit just
 * under the world, so the eye reads a sphere resting in a dish rather than a sphere hanging over a
 * table. The remaining sliver is the 8.524° wedge, and it is not removable.
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

/** The desk plane's height. THE free parameter — see the header for what moving it does. */
export const DESK_TOP_Y = 0

/**
 * The desk's far edge: the first z at which a surface at DESK_TOP_Y is still DESK_CLEARANCE below
 * the journey's bottom edge. Solved rather than typed, so retuning the fov, the pitch, the distance
 * or the clearance walks the desk to wherever it is legal instead of quietly opening a leak.
 */
export const DESK_BACK_Z = CAM_Z - (CAM_Y - DESK_TOP_Y - DESK_CLEARANCE) / FLOOR_SLOPE

/**
 * The desk's near edge, derived from the OTHER end of the same geometry: the same bottom-frustum
 * line, drawn for the camera pulled back by ZOOM_FACTOR, crosses DESK_TOP_Y somewhere in front of
 * the world — that is where the surface leaves the bottom of the money shot. The slab runs past it,
 * so the desk reaches the bottom of the frame instead of ending in a visible near edge with sky
 * underneath.
 */
export const DESK_NEAR_Z =
  CAM_Z * ZOOM_FACTOR - (CAM_Y * ZOOM_FACTOR - DESK_TOP_Y) / FLOOR_SLOPE + 2.2

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
export const DESK_HALF_W = (() => {
  const camY = CAM_Y * ZOOM_FACTOR
  const camZ = CAM_Z * ZOOM_FACTOR
  // depth of the back edge along the view axis
  const depth =
    Math.sin(PITCH) * (camY - DESK_TOP_Y) + Math.cos(PITCH) * (camZ - DESK_BACK_Z)
  return depth * TAN_HALF_FOV * DESK_MAX_ASPECT * 1.05
})()

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

/** Every desk prop, as data, so a test can check the shipped composition rather than a sample. */
export type DeskPropKind =
  | 'stand'
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
 * THE COMPOSITION, as numbers.
 *
 * Three rings, because the desk's visible WIDTH collapses on a phone while its visible height does
 * not: at full pull-back the back edge spans ±16.5 world units on 1440×900 and ±4.8 on 430×932.
 * A single arrangement authored for the desktop frame puts most of itself off a phone's edges, and
 * one authored for the phone leaves a desktop desk empty either side of a small huddle.
 *
 *   core — |x| ≤ 3.4. On screen at every viewport. The stand and the note live here, and nothing
 *          else does: this is the band the DOM connect block sits over, and clay under type is
 *          clutter.
 *   wing — |x| 5…9. The desk's own life: what you'd actually reach for. Off a phone's frame.
 *   far  — |x| ≥ 10. Desktop and ultrawide only, and deliberately the tallest pieces, because they
 *          are the ones with headroom to spare and the ones that stop a wide frame reading empty.
 *
 * Every `top` here was chosen against `propCeiling(z - radius)`, and `desk-stage.test.ts` re-checks
 * all of them — the whole point of authoring the set as data is that the gate reads the shipped
 * arrangement instead of a sample of it.
 */
export const DESK_PROPS: readonly DeskProp[] = [
  // THE BLOTTER, first because everything else stands on it. It is the piece that stops the bottom
  // two fifths of the money shot being one unbroken field of tan, and it groups the stand and the
  // note into one object instead of two things on a plain.
  { kind: 'mat', x: 0, z: 11.9, top: 0.05, backReach: 3.6, halfW: 5.6, rot: 0, ring: 'core' },

  // THE STAND. Its saucer rim is authored hard against the ceiling: it is the only prop whose job
  // is a SCREEN-SPACE relationship rather than a desk-space one, and every millimetre it can keep
  // is more of the world's lower edge it takes a bite out of at full pull-back.
  { kind: 'stand', x: 0, z: 9.9, top: 1.95, backReach: 0.95, rot: 0, ring: 'core' },

  { kind: 'mug', x: -6.1, z: 11.4, top: 1.05, backReach: 0.75, rot: 0.5, ring: 'wing' },
  { kind: 'cup', x: 6.4, z: 10.9, top: 1.62, backReach: 0.72, rot: -0.3, ring: 'wing' },
  { kind: 'books', x: -7.4, z: 14.2, top: 0.72, backReach: 1.5, rot: 0.18, ring: 'wing' },
  { kind: 'pencil', x: 5.2, z: 13.8, top: 0.13, backReach: 1.5, rot: -0.42, ring: 'wing' },
  { kind: 'clip', x: -4.9, z: 9.9, top: 0.1, backReach: 0.35, rot: 0.9, ring: 'wing' },
  { kind: 'pencil', x: -5.6, z: 16.1, top: 0.13, backReach: 1.5, rot: 0.22, ring: 'wing' },

  { kind: 'plant', x: -9.7, z: 10.2, top: 2.05, backReach: 0.95, rot: 0.4, ring: 'far' },
  { kind: 'lamp', x: 10.3, z: 10.9, top: 2.35, backReach: 1.35, rot: -0.55, ring: 'far' },
  { kind: 'books', x: 10.6, z: 14.6, top: 0.98, backReach: 1.6, rot: -0.25, ring: 'far' },
  { kind: 'mug', x: -10.4, z: 15.6, top: 1.05, backReach: 0.75, rot: -0.8, ring: 'far' },
  { kind: 'clip', x: 7.9, z: 15.0, top: 0.1, backReach: 0.35, rot: -0.4, ring: 'far' },
]

/**
 * The note sheet: centre, size and yaw. Kept here rather than in the renderer so the containment
 * gate covers it like everything else — a sheet is flat, but it is authored with a curl and the
 * curl has a height. Its containment is measured at the rearmost corner a yaw could swing to
 * (half the diagonal), so the gate holds for any rotation rather than for the one authored.
 */
export const DESK_NOTE = {
  x: 0.15,
  z: 13.1,
  /** Along the desk's x before yaw. */
  width: 6.4,
  /** Along the desk's z before yaw. */
  depth: 3.4,
  rot: -0.13,
  /**
   * How high the sheet's flat part rides. It has to clear the blotter it is lying ON — a first cut
   * parked the sheet at 0.02 and the mat's 0.05 swallowed every part of it except the curled corner.
   */
  lift: 0.075,
  /** The sheet's highest point above the desk: the lift plus the lifted corner of the curl. */
  top: 0.26,
} as const

/** The note's own containment, made the same way a prop's is. */
export function deskNoteFits(): boolean {
  const reach = Math.hypot(DESK_NOTE.width, DESK_NOTE.depth) / 2
  return DESK_TOP_Y + DESK_NOTE.top < journeyFloorY(DESK_NOTE.z - reach)
}
