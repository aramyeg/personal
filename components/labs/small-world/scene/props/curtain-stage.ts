import * as THREE from 'three'
import { revealPhase, smoothstep } from '../../journey-timeline'
import {
  CAMERA_DISTANCE,
  CAMERA_FOV,
  CAMERA_PITCH_DEG,
  CAMERA_POSITION,
  CAMERA_TARGET,
  ZOOM_FACTOR,
} from '../camera'
// READ-ONLY across the lane boundary: T65 owns the desk's composition, this lane owns staying out
// from under it. Importing the geometry rather than copying the numbers means a desk that moves
// takes the cast's floor with it instead of silently starting to slice it.
import { DESK_BACK_Z, DESK_TOP_Y } from '../desk-stage'
import {
  DRESS_REACH,
  FACE_BOX,
  MASCOT_BOX,
  PEEKER_ABS_Z,
  PEEKER_CAST,
  PEEKER_FACE_IN,
  type PeekerBiome,
  type PeekerKind,
  type Side,
} from './peeker-stage'

/**
 * Task 64 — THE CURTAIN CALL: staging math for the whole cast's bow at the end of the journey.
 *
 * ============================================================================
 * THE FORK, AND WHY THIS IS WORLD SPACE
 * ============================================================================
 * The checkpoint rig lives at a fixed CAMERA-space depth, which is what makes a corner mascot the
 * same size at every viewport — and what makes it impossible to pull away from. The brief left the
 * curtain call's frame open between that (proscenium: the cast holds the frame edges while the
 * world recedes behind it) and a diorama (the cast recedes WITH the world and becomes part of the
 * object on the desk). This module implements the diorama, and three measured facts decided it:
 *
 *  1. THE FRAME CANNOT HOLD TWELVE MASCOTS AND A WORLD. At rest the planet's silhouette spans
 *     ±0.53 half-heights of a frame that is 1.0 half-height tall; a composition is 2.41 figure-
 *     heights tall. Whatever the frame of reference, the cast has to live in the void beside and
 *     around the world — so "camera space vs world space" is a question about what happens during
 *     the PULL-BACK only, not about where the bow is composed.
 *  2. DURING THE PULL-BACK THE PROSCENIUM INVERTS THE SUBJECT. Camera-space figures keep their
 *     apparent size for the whole zoom, so at full pull-back twelve full-size mascots ring a frame
 *     whose girl is nine pixels tall. The brief's own rule — the girl is the centre of the moment —
 *     is what the losing option breaks, and the capture in the report shows it.
 *  3. THE REVEAL HAS ONE JOKE AND THE CAST BELONGS INSIDE IT. The pull-back says the little world
 *     was a clay object. A cast that does not shrink with it is not part of the object; it is
 *     scenery in front of the object, and it occupies exactly the frame T65's desk needs.
 *
 * ============================================================================
 * THE STAGE FRAME
 * ============================================================================
 * Everything here is authored in SCREEN-LIKE coordinates and lives in WORLD space, which is not a
 * contradiction: the ending's camera translates along `CAMERA_RAY` and always aims at
 * `CAMERA_TARGET`, so its ORIENTATION is constant for the whole ending. A static group carrying
 * that orientation therefore gives a frame whose x is screen-right and y is screen-up at every
 * zoom stop, without copying the camera per frame — so this rig subscribes to nothing, cannot
 * trail the pull-back by a frame, and has no stake in `CAMERA_RIG_PRIORITY` at all.
 * `curtain-stage.test.ts` pins the orientation invariance against the shipped camera path rather
 * than assuming it, so a T65 re-aim that breaks it fails a test instead of a capture.
 *
 * The stage PLANE sits `CURTAIN_SET_BACK` behind the planet's centre along the camera ray. Two
 * things follow, and both are load-bearing:
 *  - no composition can ever intersect the world (the plane is behind the bake's whole ceiling
 *    budget), so "the planet is never covered" is true by geometry rather than by placement;
 *  - a composition MAY be partly occluded BY the world, which is what lets the layout keep the
 *    cast at a readable size on a portrait frame where the world fills the width. The rule the
 *    layout actually enforces is the peeker rule: a body may be hidden, a FACE may not.
 *
 * ============================================================================
 * WHAT IS SCROLL-PURE HERE
 * ============================================================================
 * Everything. The gather, the bow and the idle are pure functions of `EndingState`, so the whole
 * curtain call scrubs backwards exactly. The arrival clock is NOT used and could not be: a reveal
 * cannot exist past the last dwell (pinned in peeker-stage.test.ts), which is why the entrance
 * language is reproduced here off `curtain` rather than borrowed off `reveal`.
 */

const TAU = Math.PI * 2
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

// --- the stage frame --------------------------------------------------------

/**
 * How far behind the planet's centre the cast stands, along the camera ray.
 *
 * Floor: the bake's ceiling budget is 1.35·R = 2.97, and a composition swings `CURTAIN_NEAR_Z`
 * of its own scale toward the camera under the bow. 3.6 clears both with margin at the largest
 * size the layout can produce — `curtain-stage.test.ts` computes the real clearance from the swept
 * envelope rather than trusting this sentence.
 */
export const CURTAIN_SET_BACK = 3.6

/** Camera distance to the stage plane. Constant through the curtain call; grows with the zoom. */
export const CURTAIN_PLANE_DISTANCE = CAMERA_DISTANCE + CURTAIN_SET_BACK

/** Frustum half-height at the stage plane, for a vertical fov in degrees. */
export function curtainHalfHeight(fovDeg: number, distance = CURTAIN_PLANE_DISTANCE): number {
  return distance * Math.tan((fovDeg * Math.PI) / 360)
}

const _m = new THREE.Matrix4()
const _eye = new THREE.Vector3()
const _target = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

/**
 * The stage frame's orientation: the camera's own, read off the shipped pose rather than restated
 * as a pitch. Pass a camera position to check another zoom stop — the test does exactly that, and
 * that is the whole point of taking a parameter here.
 */
export function curtainStageQuaternion(
  eye: readonly [number, number, number] = CAMERA_POSITION,
  target: readonly [number, number, number] = CAMERA_TARGET
): THREE.Quaternion {
  _eye.set(eye[0], eye[1], eye[2])
  _target.set(target[0], target[1], target[2])
  // Matrix4.lookAt builds a basis whose +Z points from the target BACK to the eye, which is
  // exactly the convention the peeker art is authored in (+Z toward the reader).
  _m.lookAt(_eye, _target, _up)
  return new THREE.Quaternion().setFromRotationMatrix(_m)
}

// --- the world the cast has to stand clear of -------------------------------

/** Horizontal span of the sampled profile, in frustum half-heights. */
export const ENDING_U0 = -0.88
export const ENDING_U1 = 0.88

/**
 * The ENDING FACE's upper and lower silhouette, in frustum half-heights, sampled at 33 columns —
 * measured off rendered frames by `bench/task64-silhouette.mjs` at six viewports and both static
 * stops inside the curtain window.
 *
 * WHY THIS IS NOT `WORLD_TOP`/`WORLD_BOT`. That table is a UNION over all six chapters, so it
 * carries the canyon's spires and the jungle's canopy into a frame that shows a snow summit. The
 * curtain call stages against ONE face — rotation frozen at 4π, camera static, epilogue paint
 * standing — and paying six biomes of margin there costs the cast real size at exactly the moment
 * the lab most needs it. Re-measure with the bench if the epilogue set, the terrain or the camera
 * change; `curtain-stage.test.ts` pins that this table is a SUBSET of the union (a silhouette that
 * grew past the six-chapter envelope would mean the measurement, not the table, is wrong).
 */
export const ENDING_TOP: readonly number[] = [
  0, 0, 0, 0, 0, 0, 0.148, 0.203, 0.313, 0.372, 0.636, 0.636, 0.616, 0.604, 0.689, 0.713, 0.784,
  0.783, 0.696, 0.664, 0.635, 0.617, 0.531, 0.539, 0.461, 0.401, 0.313, 0, 0, 0, 0, 0, 0,
]
export const ENDING_BOT: readonly number[] = [
  0, 0, 0, 0, 0, 0, -0.189, -0.231, -0.3, -0.424, -0.455, -0.558, -0.557, -0.537, -0.531, -0.533,
  -0.534, -0.531, -0.547, -0.607, -0.622, -0.562, -0.459, -0.427, -0.339, -0.215, 0.313, 0, 0, 0, 0,
  0, 0,
]

/**
 * Breathing room kept between a composition's FACE and the world, in half-heights. Larger than the
 * peeker rig's 0.045 because this profile is a single face rather than a union: it has no other
 * chapter's spires standing in for the girl's animation and the props' idle motion.
 */
export const CURTAIN_WORLD_MARGIN = 0.055

/**
 * The world's blocked vertical interval across a column of screen, in half-heights, or null where
 * the world does not reach that column. Same conservative shape as `worldBlocked`: it takes the
 * extreme of every sampled bin the column touches.
 */
export function curtainBlocked(u0: number, u1: number): { top: number; bot: number } | null {
  const n = ENDING_TOP.length
  const step = (ENDING_U1 - ENDING_U0) / (n - 1)
  const lo = Math.max(0, Math.floor((Math.min(u0, u1) - ENDING_U0) / step))
  const hi = Math.min(n - 1, Math.ceil((Math.max(u0, u1) - ENDING_U0) / step))
  let top = -Infinity
  let bot = Infinity
  for (let i = lo; i <= hi; i++) {
    if (ENDING_TOP[i] === 0 && ENDING_BOT[i] === 0) continue
    top = Math.max(top, ENDING_TOP[i])
    bot = Math.min(bot, ENDING_BOT[i])
  }
  if (top === -Infinity) return null
  return { top: top + CURTAIN_WORLD_MARGIN, bot: bot - CURTAIN_WORLD_MARGIN }
}

// --- the pose set, and the envelopes it sweeps ------------------------------

/** Parked inward lean (rad) — the ring leans toward the world it is bowing to. */
export const CURTAIN_LEAN = 0.05
/** Extra lean carried while still tucked behind the world, unwound by the arrival. */
export const CURTAIN_LEAN_EXTRA = 0.26
/** How deep the forward fold of the bow goes (rad about the figure's own X, over its feet). */
export const CURTAIN_BOW_FOLD = 0.34
/**
 * ...and how far it dips inward on the same beat (rad about Z, added to the parked lean).
 *
 * Small on purpose, and it was three times this in the first pass. A roll turns a figure's whole
 * HEIGHT into width — 0.3 rad on a 1.73-tall envelope costs half a figure-width of clearance on
 * both sides — so an inward dip is the most expensive gesture in the vocabulary per degree. The
 * fold does the bowing; the dip only has to say which way the bow is aimed.
 */
export const CURTAIN_BOW_DIP = 0.26
/** What fraction of the bow is HELD once it lands. The bow does not pack up — it parks. */
export const CURTAIN_BOW_HOLD = 0.42
/** Largest whole-figure sway laid on top of the bow (rad) — pinned against the shipped specs. */
export const CURTAIN_MAX_SWAY = 0.055
/**
 * The y COORDINATE of the figure's feet in its own frame — the hinge the bow turns about.
 *
 * A bow that rotates a figure about its chest swings its feet out behind it, which reads as a
 * figure toppling rather than bowing. `MASCOT_BOX.down` is measured, so this hinge moves with the
 * art rather than being a number someone matched by eye.
 */
export const CURTAIN_FOOT_Y = -MASCOT_BOX.down

type Rect = { x0: number; y0: number; x1: number; y1: number }

const _yaw = new THREE.Matrix4()
const _roll = new THREE.Matrix4()
const _fold = new THREE.Matrix4()
const _mat = new THREE.Matrix4()
const _v = new THREE.Vector3()

/**
 * Union of a box's projected extent over a set of poses, in figure-heights around the composition
 * origin. `pivotY` is the y coordinate the pose's FOLD hinges about (the figure's feet, or 0 for
 * anything that does not bow).
 *
 * The three rotations are multiplied EXPLICITLY, in the order the scene graph applies them
 * (yaw group → roll group → fold pivot). Composing them through a single Euler instead would make
 * the envelope depend on an order convention that the component does not share, and a sweep that
 * describes a different pose than the one that renders is worse than no sweep at all.
 *
 * THE PIVOT TRANSLATION IS NOT IN THE SAME FRAME, and that is a recorded approximation rather than
 * an oversight. Here the foot offset is added back as a plain y-translation OUTSIDE the rotation
 * product; in the graph the pivot group is a CHILD of the lean group, so its offset is carried
 * through the yaw and the lean. The two differ by `f·(Ry·Rz(lean)·y - y)`, which over the settle
 * poses the layout actually uses is at most 0.0405 figure-heights — 0.0078 half-heights at desktop
 * size, about 3.5 px on a 900 px frame. That is comfortably inside `CURTAIN_WORLD_MARGIN` (0.055),
 * which is where the world clearance absorbs it; it is NOT inside the frame-edge and crown checks,
 * which carry no margin of their own, so those are the two that can sit a few pixels from where
 * the envelope says. Aligning it would make this function know the graph's NESTING as well as its
 * order, for a fifth of the ink line's own width.
 */
function sweep(
  box: { out: number; in: number; up: number; down: number },
  poses: readonly { yaw: number; roll: number; fold: number }[],
  pivotY: number
): Rect & { z: number } {
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  let z = -Infinity
  for (const p of poses) {
    _mat
      .copy(_yaw.makeRotationY(p.yaw))
      .multiply(_roll.makeRotationZ(p.roll))
      .multiply(_fold.makeRotationX(p.fold))
    for (const bx of [-box.out, box.in]) {
      for (const by of [-box.down - pivotY, box.up - pivotY]) {
        for (const bz of [-PEEKER_ABS_Z, PEEKER_ABS_Z]) {
          _v.set(bx, by, bz).applyMatrix4(_mat)
          const px = _v.x
          const py = _v.y + pivotY
          if (px < x0) x0 = px
          if (px > x1) x1 = px
          if (py < y0) y0 = py
          if (py > y1) y1 = py
          if (_v.z > z) z = _v.z
        }
      }
    }
  }
  return { x0, y0, x1, y1, z }
}

/**
 * Hide fractions swept AT THE SLOT: the easeOutBack overshoot and the parked pose.
 *
 * Deliberately not the whole arrival. A composition only occupies its slot once it has arrived —
 * at hide 0.5 it is halfway back to the centre of the ring, tucked behind the world, and sweeping
 * the tucked LEAN (which is much steeper) into the parked envelope would inflate every clearance
 * by a pose the figure only ever holds where it cannot be seen. The transit's own extent is
 * checked separately, in depth, by `curtainTransitDepth`.
 */
const SETTLE_HIDES = [-0.1, 0]
/** ...and the full arrival, for the checks that do care where it has been. */
const TRANSIT_HIDES = [1, 0.6, 0.3, -0.1, 0]
/** Bow fractions swept: none, the full fold, and the held incline. */
const BOWS = [0, 1, CURTAIN_BOW_HOLD]
const SWAYS = [-CURTAIN_MAX_SWAY, 0, CURTAIN_MAX_SWAY]

/** The poses a composition holds, as (yaw, roll, fold) triples in the order the graph applies. */
function posesFor(
  side: Side,
  folding: boolean,
  hides: readonly number[] = SETTLE_HIDES
): { yaw: number; roll: number; fold: number }[] {
  const out: { yaw: number; roll: number; fold: number }[] = []
  for (const hide of hides) {
    for (const bow of folding ? BOWS : [0]) {
      for (const sway of folding ? SWAYS : [0]) {
        out.push({
          yaw: -side * PEEKER_FACE_IN,
          roll: side * (CURTAIN_LEAN + hide * CURTAIN_LEAN_EXTRA + bow * CURTAIN_BOW_DIP) + sway,
          fold: folding ? bow * CURTAIN_BOW_FOLD : 0,
        })
      }
    }
  }
  return out
}

/**
 * The whole composition's swept envelope for one side, in figure-heights: the FIGURE swept through
 * every bow and sway (hinged at its feet) unioned with the DRESSING, which takes the frame's lean
 * but never the bow — the island does not fold, the animal standing on it does.
 *
 * This is the box the layout keeps clear of the frame edges, and it is deliberately the SWEPT one:
 * the T53 lesson is that a clearance evaluated at the parked pose is a clearance the figure leaves
 * the moment it moves.
 */
export function curtainFigureBox(side: Side): Rect & { z: number } {
  return sweep(MASCOT_BOX, posesFor(side, true), CURTAIN_FOOT_Y)
}

/**
 * ...and the whole composition, dressing included. Used for the depth budget and reported to T65
 * as the cast's world-space reach; NOT used for the frame test, because the dressing is exactly
 * the part the peeker language lets crop against an edge.
 */
export function curtainCompositionBox(side: Side): Rect & { z: number } {
  const fig = curtainFigureBox(side)
  // The peeker rig's own bottom-anchored composition envelope, reproduced from its constants
  // rather than copied: the dressing reaches DRESS_REACH.near past the mascot's top and .far past
  // its bottom, and DRESS_REACH.out/.in already exceed the mascot horizontally.
  const dress = sweep(
    {
      out: DRESS_REACH.out,
      in: DRESS_REACH.in,
      up: MASCOT_BOX.up + DRESS_REACH.near,
      down: MASCOT_BOX.down + DRESS_REACH.far,
    },
    posesFor(side, false),
    0
  )
  return {
    x0: Math.min(fig.x0, dress.x0),
    x1: Math.max(fig.x1, dress.x1),
    y0: Math.min(fig.y0, dress.y0),
    y1: Math.max(fig.y1, dress.y1),
    z: Math.max(fig.z, dress.z),
  }
}

/**
 * The FACE's swept envelope — the part that may never be behind the world, and the reason a
 * portrait frame can still field a full-size cast peeking over the horizon.
 */
export function curtainFaceBox(side: Side): Rect {
  return sweep(FACE_BOX, posesFor(side, true), CURTAIN_FOOT_Y)
}

/**
 * Nearest stage-frame z any fragment reaches over the WHOLE arrival, in figure-heights — the
 * transit poses included, since the steep tucked lean is exactly what swings a composition
 * furthest toward the camera. Multiplied by the world size, this is the depth budget the stage
 * plane's set-back has to cover.
 */
export function curtainTransitDepth(side: Side): number {
  return Math.max(
    sweep(MASCOT_BOX, posesFor(side, true, TRANSIT_HIDES), CURTAIN_FOOT_Y).z,
    sweep(
      {
        out: DRESS_REACH.out,
        in: DRESS_REACH.in,
        up: MASCOT_BOX.up + DRESS_REACH.near,
        down: MASCOT_BOX.down + DRESS_REACH.far,
      },
      posesFor(side, false, TRANSIT_HIDES),
      0
    ).z
  )
}

/** A swept envelope placed at a slot centre and scaled. */
function placed(box: Rect, u: number, v: number, size: number): Rect {
  return {
    x0: u + box.x0 * size,
    x1: u + box.x1 * size,
    y0: v + box.y0 * size,
    y1: v + box.y1 * size,
  }
}

// --- the layout -------------------------------------------------------------

/** Largest figure the ring will use, as a fraction of the frustum half-height at the stage plane. */
export const CURTAIN_SIZE_MAX = 0.3
/**
 * ...and the size past which the search stops buying size with DISTANCE.
 *
 * This constant is the difference between a curtain call and a border, and it was written after
 * looking at the alternative. Maximising size alone pushes the company out to the frame edges,
 * because that is where the longest stageable arc is — and twelve mascots stacked up the two edges
 * of the frame with a void between them and the world read as a UI sidebar, not as a cast gathered
 * around anything. Past this size the reader is not counting pixels any more, so the search spends
 * everything else on standing CLOSE to the world.
 */
export const CURTAIN_SIZE_GOOD = 0.175

/**
 * ...and the size below which a figure has stopped being a character.
 *
 * 0.11 puts a figure at 0.19 half-heights — about 85 px on a 900 px frame, roughly half the size
 * Aram rejected the Round-14 corners at, and the point where these figures stop reading as species
 * and start reading as coloured blobs. It is used for exactly one decision: whether honouring the
 * desk's floor is worth what it costs on a frame that cannot afford it.
 */
export const CURTAIN_SIZE_LEGIBLE = 0.11
/** ...and the smallest worth showing. Below this the layout has failed and the report says so. */
export const CURTAIN_SIZE_MIN = 0.05

/**
 * THE GIRL'S CROWN — the screen rectangle nothing may enter, `|u| ≤ .u` and `v ≥ .v`.
 *
 * She cannot be COVERED whatever the layout does: she is on the planet, at stage z ≈ +1.46, and
 * every composition is at −`CURTAIN_SET_BACK`, so the depth buffer settles it. This guard is the
 * other half of the same rule — she is the centre of the moment, and a cast closing over her head
 * takes the frame off her even from behind. Her own silhouette peaks at v = 0.784 over |u| ≲ 0.06
 * (the measured profile's two tallest bins); the keep-out is far wider than that so the ring reads
 * as opening around her rather than as stopping just short of her.
 *
 * An angular guard was the first shape of this and it was the wrong instrument: it scales with the
 * ring's radius, so on a portrait frame — where the only clear sky IS above and below the world —
 * it deleted the whole usable band while still not being the girl's actual extent anywhere.
 */
export const CURTAIN_CROWN = { u: 0.3, v: 0.44 } as const

/**
 * How deep the cast may hang below the world, in half-heights at the stage plane.
 *
 * A RESERVATION rather than a composition choice. The desk arrives under the receding world (T65)
 * and the cast recedes into the same space, so the useful thing this lane can do is bound its own
 * reach and state it: `curtainWorldReach` turns this into the world-space y the desk has to clear,
 * and it is a fixed number because the cast is world-space — it does not move as the camera pulls
 * back, it only gets further away.
 */
export const CURTAIN_V_FLOOR = -1.05

/** Spacing between neighbours as a multiple of a FIGURE's own swept width. 1 = shoulder to shoulder. */
export const CURTAIN_PACK = 1.04

/**
 * ...and the spacings a frame too small for that falls back to, in order.
 *
 * Relaxing the SPACING rather than the SIZE, once the size floor is reached, is a deliberate order
 * of preference and it is Aram's: the Round-14 corner mascots were rejected for being small, never
 * for being crowded. A phone in portrait genuinely cannot seat twelve compositions in one line
 * around a world that fills its width — the clear sky is one band under the horizon — so what it
 * gets is a HUDDLE at full size rather than twelve smudges in a tidy row. The alternating stage
 * rows below are what make a huddle legible instead of a pile.
 */
export const CURTAIN_PACK_FALLBACK: readonly number[] = [0.78, 0.6, 0.46, 0.34]

/** How much bigger a tighter spacing has to make the company before it is worth the overlap. */
export const CURTAIN_CROWD_GAIN = 1.25

/**
 * Every other member of the company stands one row further back, and reads that much smaller.
 *
 * Two things come out of this and both matter. Neighbours that crowd each other OCCLUDE cleanly
 * instead of interpenetrating, because they are genuinely at different depths — which is what
 * makes the fallback spacings above shippable. And a single line of twelve identical-depth figures
 * reads as a chorus line whatever the frame; two interleaved rows read as a company.
 */
export const CURTAIN_ROW_GAP = 0.9
export const CURTAIN_ROW_SCALE = 0.88
/**
 * How many rows deep the crowd may go, and the number is MEASURED rather than chosen. At the
 * tightest fallback spacing a mascot on a portrait frame overlaps up to five of its neighbours, so
 * the rows have to outnumber that run or two of them end up sharing a silhouette at one depth.
 * Two rows left a phone with a clash, and so did three and four; six clears it.
 *
 * If it ever stops being enough the layout leaves the clash in place and `curtain-stage.test.ts`
 * fails — which is the honest failure. Silently piling two mascots into one silhouette is not.
 */
export const CURTAIN_ROWS = 6

/** How far behind the world a row's stage plane sits, along the stage frame's own −Z. */
export function curtainRowOffset(row: number): number {
  return CURTAIN_SET_BACK + row * CURTAIN_ROW_GAP
}

/** ...and the camera's distance to it at rest. */
export function curtainRowDistance(row: number): number {
  return CAMERA_DISTANCE + curtainRowOffset(row)
}

/** A row's screen size relative to the front one. Compounding, so three rows read as three. */
export function curtainRowScale(row: number): number {
  return Math.pow(CURTAIN_ROW_SCALE, row)
}

export type CurtainSlot = {
  /** The composition's origin, in frustum half-heights at the stage plane. */
  u: number
  v: number
  /** Figure scale, in the same half-heights (a figure's nominal 1-unit height). */
  size: number
  /** Which half of the frame it stands in: −1 left, +1 right. Sets which way it faces. */
  side: Side
  /** Ring angle (rad), 0 = screen-right, increasing counter-clockwise. */
  angle: number
  /** 0 = the front row; each row back is one `CURTAIN_ROW_GAP` further and that much smaller. */
  row: number
  /** Which braid of the crowd this composition stands in — 0 hugs the world, 1 stands out past it. */
  lane: number
}

/**
 * Is a composition of this size, centred at this ring point, stageable?
 *
 * Two different rules, and the split is the whole reason a phone still gets a cast:
 *  - the FACE must be clear of the world's silhouette AND wholly on frame;
 *  - the BODY must be on frame, but may be behind the world. It is at a stage plane behind the
 *    bake's ceiling, so "behind the world" is an honest occlusion, not a clash.
 */
function stageable(
  u: number,
  v: number,
  size: number,
  side: Side,
  halfW: number,
  fig: Rect & { z: number },
  face: Rect,
  comp: Rect,
  deskFloor: readonly number[]
): boolean {
  // THE DESK'S BACK EDGE (Task 65). The desk is nearer the camera than the cast at every point, so
  // wherever a composition projects below the edge's screen line the desk simply draws over it —
  // and the edge CLIMBS as the camera pulls back while the cast shrinks toward the centre, so a
  // slot that is clear at the bow can be sliced at the bottom of the track. Checked against every
  // row, because a row further back shrinks LESS and therefore sits lower on screen.
  for (let row = 0; row < deskFloor.length; row++) {
    if (v + comp.y0 * size * curtainRowScale(row) < deskFloor[row]) return false
  }
  // Checked at the slot AND at the arrival's OVERSHOOT: the gather travels radially out from the
  // centre of the ring and easeOutBack peaks past 1, so a figure momentarily stands further out
  // than where it parks — away from the world (harmless) and toward the frame edge (not).
  for (const k of [1, CURTAIN_OVERSHOOT]) {
    // ON FRAME — the FACE, wholly, exactly as the checkpoint rig has it. A body may crop against
    // an edge (that is the peeking language, and it is what lets a narrow frame hold a full-size
    // cast at all); a cropped face is the Round-14 defect this lab already removed once.
    const f = placed(face, u * k, v * k, size)
    if (f.x0 < -halfW || f.x1 > halfW) return false
    if (f.y0 < -1 || f.y1 > 1) return false

    const body = placed(fig, u * k, v * k, size)
    // ...and the floor reservation, which is about the desk rather than about the frame.
    if (body.y0 < CURTAIN_V_FLOOR) return false
    // the girl's crown, which the ring opens around rather than closing over. On a frame too
    // narrow to hold both her and a wing, the keep-out narrows with the frame rather than
    // deleting the only clear sky there is.
    const crown = Math.min(CURTAIN_CROWN.u, 0.65 * halfW)
    if (body.x0 < crown && body.x1 > -crown && body.y1 > CURTAIN_CROWN.v) return false
  }

  // CLEAR OF THE WORLD — the FACE, at the slot. A body may be behind the world (the stage plane is
  // past the bake's whole ceiling, so that is an honest occlusion); a face may not. Everywhere
  // earlier in the gather the composition is nearer the centre of the ring, i.e. deliberately
  // tucked behind the world — that is the entrance, not a collision.
  const f = placed(face, u, v, size)
  const blocked = curtainBlocked(f.x0, f.x1)
  if (blocked && f.y0 < blocked.top && f.y1 > blocked.bot) return false
  return true
}

// --- the desk the cast must stay above (Task 65) -----------------------------
//
// The desk is a sibling of the world, parked outside the journey camera's frustum, and it comes
// into frame as the camera pulls back. Its BACK EDGE — the line `y = DESK_TOP_Y`, `z = DESK_BACK_Z`
// — is nearer the camera than every part of this cast (the stage plane is BEHIND the world, the
// desk is well in front of it), so the depth buffer gives the desk everything below that line.
//
// TWO PROPERTIES MAKE THIS CHEAP TO ENFORCE, and both are consequences of the camera translating
// along its own view axis rather than orbiting:
//
//  1. The back edge projects to a HORIZONTAL line. For a fixed (y, z) and varying x, the camera-
//     space height and depth are both constant, so its screen v does not depend on x at all — one
//     scalar per zoom stop bounds the whole width of the frame.
//  2. Camera-space height is INVARIANT under the pull-back. Moving the camera along its own +Z
//     cannot change a point's component along the camera's +Y, so only the DEPTH changes with the
//     zoom. The edge therefore climbs monotonically as a simple 1/depth, and so does the cast.
//
// Which is why this is a per-row constant rather than a per-frame test: see `CURTAIN_DESK_FLOOR`.

const PITCH_RAD = (CAMERA_PITCH_DEG * Math.PI) / 180
const HALF_FOV_RAD = (CAMERA_FOV * Math.PI) / 360

/**
 * Screen v of the desk's back edge at a camera distance, in half-heights. Derived from T65's own
 * exported geometry rather than from a number copied across the lane boundary, so a desk that moves
 * takes this lane's floor with it.
 */
export function deskEdgeV(distance: number): number {
  const s = Math.sin(PITCH_RAD)
  const c = Math.cos(PITCH_RAD)
  const height = DESK_TOP_Y * c - DESK_BACK_Z * s
  const depth = distance - DESK_TOP_Y * s - DESK_BACK_Z * c
  return height / (depth * Math.tan(HALF_FOV_RAD))
}

/**
 * Screen v of a stage-frame v on a given row, at a camera distance. The cast is world-space and
 * static, so only the depth changes: `v` is measured at the row's own rest half-height and shrinks
 * as `restDistance / distance`.
 */
export function curtainScreenV(v: number, row: number, distance: number): number {
  return (v * curtainRowDistance(row)) / (distance + curtainRowOffset(row))
}

/** Camera distances sampled across the pull-back — the whole range `endingCameraDistance` attains. */
const ZOOM_SAMPLES: readonly number[] = Array.from(
  { length: 25 },
  (_, i) => CAMERA_DISTANCE * (1 + (i / 24) * (ZOOM_FACTOR - 1))
)

/**
 * The lowest stage-frame v a composition's BOTTOM may occupy on each row, for the desk's back edge
 * never to cut it at any zoom stop.
 *
 * A constant rather than a per-frame test because of the two properties above: the edge's screen v
 * and the cast's screen v are both pure functions of the camera distance, so the binding stop can
 * be found once. It is the FULL pull-back on every row — the edge climbs faster than the cast
 * shrinks — but the maximum is taken over the sampled range rather than assumed, so a retuned
 * `ZOOM_FACTOR` or a desk that moves cannot quietly relocate the worst case.
 */
export const CURTAIN_DESK_FLOOR: readonly number[] = Array.from({ length: CURTAIN_ROWS }, (_, row) => {
  let floor = -Infinity
  for (const d of ZOOM_SAMPLES) {
    // the stage-frame v whose screen v lands exactly on the edge at this stop
    const v = (deskEdgeV(d) * (d + curtainRowOffset(row))) / curtainRowDistance(row)
    if (v > floor) floor = v
  }
  return floor
})

/**
 * Resolution of the two searches. Both are as coarse as the eye allows on purpose: the whole
 * layout runs at mount and on every resize, on the main thread, in a scene that is already loading
 * a GLB and baking terrain. At these steps a portrait frame costs about 150 ms once; the finer
 * grid it replaced cost 360 ms and moved no slot by as much as a pixel.
 */
const RADIUS_STEPS = 26
const RADIUS_MIN = 0.18
const RADIUS_MAX = 2.6

/**
 * The band of ring radii a composition can stand at on one bearing: `lo` is where it first clears
 * the world (the cast HUGS, so the bow reads as a crowd around the object rather than a border
 * pinned to the frame), `hi` is where the frame runs out. Null when the bearing has no band at all.
 *
 * Scanned rather than bisected from one end, because neither bound is guaranteed monotone: near a
 * diagonal, moving outward changes WHICH columns of the world silhouette the composition spans.
 */
export function curtainRadiusBand(
  angle: number,
  size: number,
  halfW: number,
  fig: Rect & { z: number },
  face: Rect,
  comp: Rect,
  deskFloor: readonly number[]
): { lo: number; hi: number } | null {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const side: Side = c < 0 ? -1 : 1
  let lo = -1
  let hi = -1
  for (let i = 0; i <= RADIUS_STEPS; i++) {
    const r = RADIUS_MIN + ((RADIUS_MAX - RADIUS_MIN) * i) / RADIUS_STEPS
    if (stageable(r * c, r * s, size, side, halfW, fig, face, comp, deskFloor)) {
      if (lo < 0) lo = r
      hi = r
    } else if (lo >= 0) break
  }
  return lo < 0 ? null : { lo, hi }
}

/** Where the ring parameterisation begins, measured from the top of the frame (rad). */
export const CURTAIN_RING_START = 0.35

const ANGLE_STEPS = 168

/**
 * The company does not stand in single file — it stands in two braided LANES.
 *
 * A wing is nearly VERTICAL, so a single file spends the frame's height and none of its width, and
 * the height is exactly what the desk's back edge took away. Two lanes spend the width instead: the
 * same wing seats three out-and-back pairs rather than six stacked figures, at roughly twice the
 * size. It also puts each biome's two members at neighbouring bearings on opposite lanes, so the
 * partners stand together with one a little further out.
 *
 * The gap between them is not a constant: it is the figure envelope's own support along the RADIAL
 * at each bearing (`footprintAlong`), times this margin. That is exactly the separating-axis
 * distance, so the lanes provably cannot overlap — and it is as small as it can be, which matters
 * because a constant sized for the worst bearing would charge every frame for the worst case. A
 * fixed 2.0 figure-heights cost 1024x768 a quarter of its figure size for nothing.
 */
export const CURTAIN_LANE_PACK = 1.02
export const CURTAIN_LANES = 2

type RingPoint = { angle: number; u: number; v: number }
type Run = { pts: RingPoint[] }

/**
 * How much of the packing budget one composition spends at a point where the ring runs along `t`.
 *
 * THIS IS THE FIX FOR THE STAIRCASE. The budget used to be spent in figure WIDTHS everywhere,
 * which is right along a horizontal stretch of ring and wrong along a vertical one — and both
 * wings are nearly vertical, so consecutive slots were separated mostly in `v` while being charged
 * for their `u`. The swept figure box is about 1.95 figure-heights tall against 1.5 wide, so every
 * adjacent pair in a wing overlapped, the depth-row fan fired on every frame the lab ships to, and
 * the company rendered as a 1.89x staircase instead of a line of equals.
 *
 * The support of an axis-aligned box along a unit direction is `|tx|·width + |ty|·height`, which is
 * exactly what two neighbours have to be separated by along that direction for the separating-axis
 * theorem to keep them apart. Spending the budget in THAT is what makes the spacing mean what it
 * says at every bearing.
 */
function footprintAlong(tx: number, ty: number, box: Rect, size: number): number {
  return (Math.abs(tx) * (box.x1 - box.x0) + Math.abs(ty) * (box.y1 - box.y0)) * size
}

/**
 * One lane of the ring at a given size and stand-off: every stageable bearing, placed at `standoff`
 * of the way from where it clears the world to where it runs out of frame and then pushed out by
 * the lane's own radial offset, collected into runs of consecutive bearings.
 *
 * Each run carries both its arc length and its CAPACITY — how many compositions fit along it, which
 * is the arc integrated against the local footprint rather than divided by a constant width.
 *
 * Parameterised from just left of the crown and running COUNTER-CLOCKWISE, so the company reads
 * down the left wing and up the right — the order the journey was walked in, and therefore the
 * order the gather and the bow ripple in.
 */
function ringAt(
  size: number,
  standoff: number,
  lane: number,
  halfW: number,
  figL: Rect & { z: number },
  figR: Rect & { z: number },
  faceL: Rect,
  faceR: Rect,
  compL: Rect,
  compR: Rect,
  deskFloor: readonly number[]
): Run[] {
  const runs: Run[] = []
  let cur: Run | null = null
  const start = Math.PI / 2 + CURTAIN_RING_START
  for (let i = 0; i <= ANGLE_STEPS; i++) {
    const angle = start + (TAU * i) / ANGLE_STEPS
    let pt: RingPoint | null = null
    const side: Side = Math.cos(angle) < 0 ? -1 : 1
    const fig = side === -1 ? figL : figR
    const band = curtainRadiusBand(
      angle,
      size,
      halfW,
      fig,
      side === -1 ? faceL : faceR,
      side === -1 ? compL : compR,
      deskFloor
    )
    if (band) {
      // the lane's own offset, measured along the radial at THIS bearing
      const push =
        lane * CURTAIN_LANE_PACK * footprintAlong(Math.cos(angle), Math.sin(angle), fig, size)
      const r = band.lo + standoff * (band.hi - band.lo) + push
      // the outer lane has to be stageable where it actually stands, not where the inner one does
      if (
        lane === 0 ||
        stageable(
          r * Math.cos(angle),
          r * Math.sin(angle),
          size,
          side,
          halfW,
          fig,
          side === -1 ? faceL : faceR,
          side === -1 ? compL : compR,
          deskFloor
        )
      ) {
        pt = { angle, u: r * Math.cos(angle), v: r * Math.sin(angle) }
      }
    }
    if (pt) {
      if (!cur) cur = { pts: [] }
      cur.pts.push(pt)
    } else if (cur) {
      if (cur.pts.length > 1) runs.push(cur)
      cur = null
    }
  }
  if (cur && cur.pts.length > 1) runs.push(cur)
  return runs
}

/**
 * Walk one lane's runs and drop a composition wherever the last one is far enough behind.
 *
 * CONSTRUCTIVE, and that is the whole point. The first version of this spent an arc-length budget
 * and then trusted the arithmetic — but the ring's radius jumps from bearing to bearing as a
 * composition's u-span crosses the world silhouette's bins, so the PATH between two neighbours is
 * far longer than the straight line between them. An arc budget therefore pays for travel the eye
 * never sees, and delivered neighbours less than half a figure apart while reporting them clear.
 * (That is the same defect the depth-row fan was written to paper over, one level further down.)
 *
 * So nothing is integrated: each candidate is accepted only if its CHORD from the last accepted one
 * clears the separating-axis distance along that chord, which is precisely the condition for the
 * two boxes to miss. `spread` scales that requirement up when a run has room to spare, so the
 * company distributes across the wing instead of bunching at the end it was walked from.
 */
function clears(
  pt: RingPoint,
  other: RingPoint,
  size: number,
  figL: Rect,
  figR: Rect,
  spread: number
): boolean {
  const dx = pt.u - other.u
  const dy = pt.v - other.v
  const chord = Math.hypot(dx, dy)
  if (chord <= 0) return false
  const box = pt.u < 0 ? figL : figR
  return chord >= spread * footprintAlong(dx / chord, dy / chord, box, size)
}

function packRun(
  run: Run,
  size: number,
  figL: Rect,
  figR: Rect,
  spread: number,
  avoid: readonly RingPoint[]
): RingPoint[] {
  const out: RingPoint[] = []
  for (const pt of run.pts) {
    // Checked against EVERY composition already standing, not just the one before it — in this lane
    // and in the other. Neither shortcut is safe here: the ring's radius jumps from bearing to
    // bearing, so a path that has moved on can fold back beside something it passed several samples
    // ago, and the lane offset only separates the two braids where they sit at the same bearing.
    let blocked = false
    for (const a of out) {
      if (!clears(pt, a, size, figL, figR, spread)) {
        blocked = true
        break
      }
    }
    for (let i = 0; i < avoid.length && !blocked; i++) {
      if (!clears(pt, avoid[i], size, figL, figR, spread)) blocked = true
    }
    if (blocked) continue
    out.push(pt)
  }
  return out
}

/** ...and across every run of a lane, in ring order. */
function packLane(
  runs: Run[],
  size: number,
  figL: Rect,
  figR: Rect,
  spread: number,
  avoid: readonly RingPoint[] = []
): RingPoint[] {
  const out: RingPoint[] = []
  for (const run of runs) out.push(...packRun(run, size, figL, figR, spread, [...avoid, ...out]))
  return out
}

/**
 * Which of a lane's packed positions the `n`-th of `of` compositions takes.
 *
 * When the packing found more room than the company needs, the extra shows up as SPACING rather
 * than as a gap at whichever end the ring was walked from.
 */
function pick(placed: readonly RingPoint[], n: number, of: number): RingPoint {
  const i = Math.round(((placed.length - 1) * n) / Math.max(1, of - 1))
  return placed[Math.min(placed.length - 1, Math.max(0, i))]
}

/** Standoffs tried, nearest the world first: the company stands as close in as it can fit. */
const STANDOFFS = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1]

/**
 * The staging decision for the whole cast: where twelve compositions stand and how big they are.
 *
 * Three nested searches, and the nesting is the composition rule rather than an implementation
 * detail. The OUTER one relaxes the SPACING only when it must. The MIDDLE one walks the stand-offs
 * outward and stops at the first that reaches a size worth showing, so the company crowds in around
 * the world instead of spreading to the frame edges where the longest arc happens to be. The INNER
 * one bisects for the largest figure that stand-off can seat.
 *
 * The slots are distributed evenly BY CAPACITY over the stageable runs of two braided lanes, so a
 * wide frame seats three pairs a side and a portrait frame — where the world fills the width and
 * the desk takes the floor — seats what it can where it can. Neither case is written down anywhere.
 */
export function curtainLayout(halfW: number, count = CURTAIN_CAST.length): CurtainSlot[] {
  return curtainLayoutInfo(halfW, count).slots
}

/** No floor at all — what a frame falls back to when the desk's leaves it nowhere to stand. */
const NO_DESK_FLOOR: readonly number[] = []

/**
 * The layout, plus whether it was reached WITH the desk's floor honoured.
 *
 * `deskClear === false` is a real, visible defect and not a soft mode: it means the desk's back edge
 * cuts into the company somewhere in the pull-back on that frame. It is reported rather than
 * silently absorbed, and `curtain-stage.test.ts` pins exactly which frame classes are which, because
 * the alternative on those frames is seating nobody at all — which is worse than the defect and
 * would also hide it.
 */
export function curtainLayoutInfo(
  halfW: number,
  count = CURTAIN_CAST.length
): { slots: CurtainSlot[]; deskClear: boolean } {
  const clear = solveLayout(halfW, count, CURTAIN_DESK_FLOOR)
  // Honouring the floor is worth having only if what is left is still a company the reader can
  // see. On a frame whose world fills the width, the only clear sky is UNDER the horizon and the
  // desk owns all of it, so the floor is satisfiable — at 45 px a figure, which is not a curtain
  // call. There the honest answer is the visible defect plus a report, not an invisible cast.
  if (clear.length > 0 && clear[0].size >= CURTAIN_SIZE_LEGIBLE) {
    return { slots: clear, deskClear: true }
  }
  return { slots: solveLayout(halfW, count, NO_DESK_FLOOR), deskClear: false }
}

function solveLayout(
  halfW: number,
  count: number,
  deskFloor: readonly number[]
): CurtainSlot[] {
  const figL = curtainFigureBox(-1)
  const figR = curtainFigureBox(1)
  const faceL = curtainFaceBox(-1)
  const faceR = curtainFaceBox(1)
  const compL = curtainCompositionBox(-1)
  const compR = curtainCompositionBox(1)
  const perLane = Math.ceil(count / CURTAIN_LANES)

  /** The lanes at one stand-off, or null if they cannot seat the company at this size and spacing. */
  /**
   * The company's twelve positions at one stand-off, size and spacing — or null.
   *
   * Every candidate is VERIFIED as the thing that would ship: the lanes are packed, the company is
   * picked out of them, and then the picked twelve are checked pairwise. Checking the packing
   * instead would be checking an intermediate — and an earlier version of this did exactly that,
   * accepted a size whose packed points were provably clear, and still shipped overlapping slots,
   * because what reaches the screen is the SUBSET the picker takes and not the list it takes it
   * from. The rule is the T56 one: gate the artefact, not the working.
   */
  const seatAt = (standoff: number, size: number, pack: number): RingPoint[] | null => {
    const lanes: RingPoint[][] = []
    for (let lane = 0; lane < CURTAIN_LANES; lane++) {
      const runs = ringAt(size, standoff, lane, halfW, figL, figR, faceL, faceR, compL, compR, deskFloor)
      // Each lane carries its own half of the company, so each has to seat it on its own — and
      // "seat" means a real packing, not a budget: `packRun` returns the compositions it actually
      // managed to place without touching.
      const taken = lanes.flat()
      let placed = packLane(runs, size, figL, figR, pack, taken)
      if (placed.length < perLane) return null
      // Room to spare: widen the requirement until only the company fits, so it spreads across the
      // wing rather than bunching at the end the ring was walked from.
      let lo = pack
      let hi = pack * 6
      for (let i = 0; i < 9; i++) {
        const mid = (lo + hi) / 2
        const got = packLane(runs, size, figL, figR, mid, taken)
        if (got.length >= perLane) {
          lo = mid
          placed = got
        } else hi = mid
      }
      lanes.push(placed)
    }

    const picked: RingPoint[] = []
    for (let k = 0; k < count; k++) {
      const lane = lanes[k % CURTAIN_LANES]
      picked.push(pick(lane, Math.floor(k / CURTAIN_LANES), perLane))
    }
    for (let i = 0; i < picked.length; i++) {
      for (let j = i + 1; j < picked.length; j++) {
        if (!clears(picked[j], picked[i], size, figL, figR, pack)) return null
      }
    }
    return picked
  }

  /** The largest size this stand-off can seat the company at, and its lanes. */
  const largestAt = (standoff: number, pack: number) => {
    if (!seatAt(standoff, CURTAIN_SIZE_MIN, pack)) return null
    const capped = seatAt(standoff, CURTAIN_SIZE_MAX, pack)
    if (capped) return { picked: capped, size: CURTAIN_SIZE_MAX }
    let lo = CURTAIN_SIZE_MIN
    let hi = CURTAIN_SIZE_MAX
    let picked = seatAt(standoff, lo, pack)
    let size = lo
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2
      const r = seatAt(standoff, mid, pack)
      if (r) {
        lo = mid
        picked = r
        size = mid
      } else hi = mid
    }
    return picked ? { picked, size } : null
  }

  /** The best the company can do at one spacing: nearest stand-off that reaches a size worth showing. */
  const atPack = (pack: number) => {
    let found: { picked: RingPoint[]; size: number } | null = null
    for (const standoff of STANDOFFS) {
      const got = largestAt(standoff, pack)
      if (!got) continue
      if (!found || got.size > found.size) found = got
      if (got.size >= CURTAIN_SIZE_GOOD) break
    }
    return found
  }

  // UNIFORM FIRST, and this is the rule the review's first finding is about. Shoulder-to-shoulder
  // spacing is tried before anything else and KEPT whenever what it produces is a company the
  // reader can see — a tighter spacing is not an upgrade you buy with size, it is a fallback for a
  // frame that has no other option.
  //
  // The rule used to be "keep it unless a tighter spacing buys 25% more size", and that is how a
  // 1920x1080 frame ended up crowded: 0.78 spacing bought it 40% and won, the overlaps went into
  // the depth rows, and twelve figures shipped as a 1.89x staircase down each wing on every frame
  // class in the lab. Size is what the eye judges first, but not at the price of the company no
  // longer looking like one.
  let best = atPack(CURTAIN_PACK)
  if (!best || best.size < CURTAIN_SIZE_LEGIBLE) {
    for (const pack of CURTAIN_PACK_FALLBACK) {
      const got = atPack(pack)
      if (got && (!best || got.size > best.size * CURTAIN_CROWD_GAIN)) best = got
      if (best && best.size >= CURTAIN_SIZE_LEGIBLE) break
    }
  }

  if (!best) return []
  const size = best.size

  const slots: CurtainSlot[] = []
  for (let k = 0; k < count; k++) {
    const lane = k % CURTAIN_LANES
    const pt = best.picked[k]
    if (!pt) return []
    slots.push({
      u: pt.u,
      v: pt.v,
      size,
      side: pt.u < 0 ? -1 : 1,
      angle: pt.angle,
      row: 0,
      lane,
    })
  }
  return rowed(slots, figL, figR)
}

/**
 * Push whatever still overlaps into the second row.
 *
 * The slots are distributed by ARC LENGTH, which over-states how far apart two neighbours actually
 * are wherever the ring curves — the straight line between them is shorter than the arc, so a
 * packing budget spent in arc length can still deliver a pair whose silhouettes touch. Rather than
 * inflate the budget until that can never happen (which costs every frame size to fix a few
 * bearings), the pairs that do touch are moved apart in DEPTH: one row back, one row smaller, and
 * the depth buffer resolves the overlap into a crowd instead of a collision.
 *
 * Greedy in ring order, so a run of three tight neighbours alternates rather than piling into one
 * row. `curtain-stage.test.ts` fails if two rows ever turn out not to be enough.
 */
function rowed(
  slots: CurtainSlot[],
  figL: Rect & { z: number },
  figR: Rect & { z: number }
): CurtainSlot[] {
  const boxOf = (s: CurtainSlot) => {
    const b = s.side === -1 ? figL : figR
    return {
      x0: s.u + b.x0 * s.size,
      x1: s.u + b.x1 * s.size,
      y0: s.v + b.y0 * s.size,
      y1: s.v + b.y1 * s.size,
    }
  }
  const hits = (a: CurtainSlot, b: CurtainSlot) => {
    const p = boxOf(a)
    const q = boxOf(b)
    return p.x0 < q.x1 && p.x1 > q.x0 && p.y0 < q.y1 && p.y1 > q.y0
  }
  const out = slots.map((s) => ({ ...s }))
  const clashes = (i: number, row: number): boolean => {
    for (let j = 0; j < out.length; j++) {
      if (j !== i && out[j].row === row && hits(out[i], out[j])) return true
    }
    return false
  }

  // A frame that seats the company shoulder to shoulder has nothing to resolve, and splitting it
  // across four depths anyway would read as twelve figures at four arbitrary sizes rather than as
  // a crowd. So: one row until something actually touches.
  let touching = false
  for (let i = 0; i < out.length && !touching; i++) touching = clashes(i, 0)
  if (!touching) return out

  // It does touch. Seed by RING ORDER rather than greedily: at the tightest spacing a figure
  // overlaps roughly its three nearest neighbours each way, and `i % CURTAIN_ROWS` separates every
  // such run BY CONSTRUCTION, where a first-fit walk paints itself into a corner and leaves the
  // last figure with no clear row at all (measured: it did, on a phone, at three rows and at four).
  for (let i = 0; i < out.length; i++) out[i].row = i % CURTAIN_ROWS
  for (let i = 0; i < out.length; i++) {
    if (!clashes(i, out[i].row)) continue
    for (let row = 0; row < CURTAIN_ROWS; row++) {
      if (!clashes(i, row)) {
        out[i].row = row
        break
      }
    }
  }
  return out
}

// --- the cast ---------------------------------------------------------------

export type CurtainMember = { biome: PeekerBiome; kind: PeekerKind }

/**
 * The whole company, in JOURNEY ORDER — spring's pair first, winter's last — flattened from the
 * same `PEEKER_CAST` the checkpoints field, so the curtain call cannot drift from who the visitor
 * actually met. This is the reuse Task 61's deduplication was for.
 */
export const CURTAIN_CAST: readonly CurtainMember[] = PEEKER_CAST.flatMap((pair) => [
  { biome: pair.biome, kind: pair.left },
  { biome: pair.biome, kind: pair.right },
])

// --- the choreography -------------------------------------------------------

/**
 * The gather occupies this much of `curtain`, and each figure trails the one before it by
 * `CURTAIN_STAGGER` of the same clock.
 *
 * The stagger is what separates a curtain call from a lineup materialising: the last figure is
 * still swinging out from behind the world when the first has settled, so the eye is led around
 * the ring in the order the journey met them.
 */
export const CURTAIN_GATHER_SPAN = 0.3
export const CURTAIN_STAGGER = 0.022
/**
 * ...and then the bow, in the same order and over the same span, on a tighter stagger — a wave
 * travelling round the ring rather than a queue forming.
 *
 * `CURTAIN_BOW_FROM` is past the LAST figure's arrival on purpose: nothing bows while anything is
 * still swinging out from behind the world, which is what makes the two beats read as two beats.
 * It is also what lets the clearance envelope leave the tucked lean out (see `SETTLE_HIDES`), so
 * the relation is pinned in `curtain-stage.test.ts` rather than left as an intention.
 */
export const CURTAIN_BOW_FROM = 0.56
export const CURTAIN_BOW_SPAN = 0.3
export const CURTAIN_BOW_STAGGER = 0.012
/** Where inside its own bow window the fold reaches full depth before easing to the held incline. */
export const CURTAIN_BOW_PEAK = 0.55

/**
 * How far a figure has arrived, 0 (tucked behind the world) → 1 (parked), with the easeOutBack
 * overshoot past 1 that IS the settle — the same language the checkpoint entrances use, driven off
 * scroll instead of off the arrival clock.
 */
export function curtainArrival(curtain: number, index: number, reduced = false): number {
  const from = index * CURTAIN_STAGGER
  const t = revealPhase(curtain, from, from + CURTAIN_GATHER_SPAN)
  if (reduced) return smoothstep(t)
  const c = 1.70158
  const p = t - 1
  return 1 + (c + 1) * p * p * p + c * p * p
}

/** Peak of easeOutBack — how far past its slot a composition swings on the way in. */
export const CURTAIN_OVERSHOOT = 1.1

/**
 * The bow, 0 → 1 → held at `CURTAIN_BOW_HOLD`. Multiply into `CURTAIN_BOW_FOLD` and
 * `CURTAIN_BOW_DIP`; both are swept by `curtainCompositionBox`, so a deeper bow than this is a
 * clearance change and not a tuning one.
 */
export function curtainBow(curtain: number, index: number): number {
  const from = CURTAIN_BOW_FROM + index * CURTAIN_BOW_STAGGER
  const p = revealPhase(curtain, from, from + CURTAIN_BOW_SPAN)
  if (p <= CURTAIN_BOW_PEAK) return smoothstep(p / CURTAIN_BOW_PEAK)
  return 1 - (1 - CURTAIN_BOW_HOLD) * smoothstep((p - CURTAIN_BOW_PEAK) / (1 - CURTAIN_BOW_PEAK))
}

/** The last `curtain` at which anything is still arriving — the bow may not start before it. */
export const CURTAIN_GATHER_DONE =
  (CURTAIN_CAST.length - 1) * CURTAIN_STAGGER + CURTAIN_GATHER_SPAN

/**
 * The parked idle, driven by the ENDING's own `t` rather than by `curtain`.
 *
 * `curtain` parks at 1 for the whole still beat and the whole pull-back, so an idle keyed to it
 * would freeze the cast the moment it finished bowing — twelve statues being pulled away from.
 * `t` keeps rising to the bottom of the track, so the company stays alive all the way out, and it
 * is just as scroll-pure.
 */
export function curtainIdle(t: number, cycles: number, phase: number): number {
  return Math.sin(TAU * (t * cycles + phase))
}

/** Idle phase offset per slot, so twelve figures never beat in lockstep. */
export function curtainPhase(index: number): number {
  return (index * 0.382) % 1
}

/**
 * Nearest camera-space depth any composition fragment reaches at the stage plane, in world units.
 * Must stay behind the planet's ceiling for the whole ending; `curtain-stage.test.ts` computes the
 * margin from the swept envelope and the largest size the layout can produce.
 */
export function curtainNearestDepth(size: number, halfHeightWorld: number): number {
  const near = Math.max(curtainTransitDepth(-1), curtainTransitDepth(1))
  return CURTAIN_PLANE_DISTANCE - near * size * halfHeightWorld
}

/**
 * The cast's WORLD-SPACE reach — what T65 needs, and the reason this lane can hand over a number
 * rather than a request.
 *
 * The curtain call is world-space and static: the pull-back does not move it, it only gets further
 * away. So the volume it occupies is a FIXED property of the layout, and a desk surface placed
 * below `minY` clears the whole company at every zoom stop by construction. Returned in the world
 * frame (the stage frame's own axes rotated by the camera's rest orientation), for the largest
 * composition the frame produces.
 */
export function curtainWorldReach(
  halfW: number,
  fovDeg: number
): { minY: number; maxY: number; radius: number } | null {
  const slots = curtainLayout(halfW)
  if (slots.length === 0) return null
  const q = curtainStageQuaternion()
  const compL = curtainCompositionBox(-1)
  const compR = curtainCompositionBox(1)
  let minY = Infinity
  let maxY = -Infinity
  let radius = 0
  const p = new THREE.Vector3()
  for (const slot of slots) {
    const halfH = curtainHalfHeight(fovDeg, curtainRowDistance(slot.row))
    const world = slot.size * curtainRowScale(slot.row) * halfH
    const box = slot.side === -1 ? compL : compR
    for (const bx of [box.x0, box.x1]) {
      for (const by of [box.y0, box.y1]) {
        for (const bz of [-PEEKER_ABS_Z, box.z]) {
          p.set(
            slot.u * halfH + bx * world,
            slot.v * halfH + by * world,
            -curtainRowOffset(slot.row) + bz * world
          ).applyQuaternion(q)
          if (p.y < minY) minY = p.y
          if (p.y > maxY) maxY = p.y
          radius = Math.max(radius, p.length())
        }
      }
    }
  }
  return { minY, maxY, radius }
}
