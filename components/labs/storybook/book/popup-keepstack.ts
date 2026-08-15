/**
 * THE DISPATCH KEEP — STORY CASCADE (E1 showpiece, element 1). Bench-proven in
 * .superpowers/sdd/bench/derive-keep-stack.mjs (S1-S8) and derive-keep-gallery
 * .mjs (the balcony, B1-B6); spec docs/superpowers/specs/2026-07-16-dispatch-
 * keep-derivation.md.
 *
 * THE MECHANISM (paper truth). A hollow grey-stone keep rising FOUR stories out
 * of the spine to backdrop height (~0.84): Dispatch Hall (hollow, open front) ->
 * Balcony Gallery (open arcade) -> Rookery Loft (open belfry) -> Signal-Spire
 * crown. Birmingham mech 67 (box) carrying a stack of mech 21-22 (V-on-V)
 * stories: "lower stories hoist upper ones, no scissoring between stories."
 *
 * THE DERIVATION (no new physics). A flat-roofed box fold's lid is a miniature
 * SPREAD stacked at wall-top height H, its seam over the spine, opening at
 * dihedral EXACTLY beta (the same fact the RIDER 'boxLid' seat rides). So a
 * story seated on the story below is just a box fold whose whole bisector-x is
 * offset by baseH = the sum of the lower stories' heights: its walls glue onto
 * the lower lid at lid-distance a_k, exactly ON the lid iff a_k <= a_{k-1}
 * (telescoping inward). Same beta, same m — one rigid kinematic chain driven by
 * the single page dihedral, folding dead flat at close for free. The recursion
 * is boxPose(+baseH): each story is a BoxGeom (popup-mechanics.ts) with its
 * baseH set, rendered through the EXISTING popup-box-layer renderer, one
 * instance per story. This module only computes the cumulative baseH and the
 * balcony/raven that ride the stack.
 *
 * THE BALCONY (derive-keep-gallery.mjs). Architecturally the gallery FLOOR
 * extending past the facade — and the gallery floor IS the hall's flat lid. So
 * the balcony is a two-panel DECK riding the hall lid, overhanging +z (toward
 * the reader) past the lid's front edge; it creases at x=0 exactly as the lid
 * does, so it folds dead flat with the lid for free (no new DOF, no new solver).
 * As the book opens the hall lid swings flat-horizontal, carrying the balcony
 * from flush-against-the-facade to jutting-horizontal — the board's "balcony
 * swings out on its jutting hinge."
 */

import { PLY, plyLift } from './lift-ladder'
import type { BoxFace, BoxGeom, BoxPatch, FanMember, PanelQuad, TurnStage, Vec3 } from './popup-mechanics'
import { openElevation, solveBoxPose } from './popup-mechanics'
import { solveFanPose } from './popup-anatomy'

const rad = (d: number): number => (d * Math.PI) / 180
const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale3 = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

// Seat-lift the balcony deck off the hall lid plane (ROTOR_LIFT/CW_LIFT scale):
// the deck rides IN the lid plane and its inner strip (z 0.30..0.34) overlaps the
// lid coplanarly -> z-fight flicker ("part of it is under a rectangle"). Lifting
// it a hair along the lid normal breaks the shared plane. The lift is SCALED by
// the openness (sh = sin(beta/2)) so it is EXACTLY 0 at book-closed (the deck
// still folds dead flat — B1 stays at 1e-9) and ~this value at the reading pose;
// it only nudges world X/Y (never z), so B3 fore-edge containment is untouched.
// Plate class: two plies (lift-ladder.ts).
export const BALCONY_LIFT = plyLift(2)

// Same idiom for the facade plates: a plate rides IN its cap plane, and from the
// cap base up to the cap top it coplanarly overlaps the still-rendered cap face
// (the interior-shadow recess behind the die-cut) -> z-fight flicker on every
// camera/parallax move. Each half lifts along ITS OWN cap-half outward normal
// (local (0, sign*ch, sh), a unit vector), magnitude PLATE_LIFT*sh: exactly 0 at
// book-closed (fold-flat + S1 stay at 1e-9) and ~PLATE_LIFT toward the reader at
// the open pose. A per-half rigid translation, so plate rigidity is untouched;
// the crease halves part by ±PLATE_LIFT*ch laterally at mid-turn (sub-3mm at
// book scale, unreadable at the sliver angles where ch is large).
// Plate class: two plies (lift-ladder.ts).
export const PLATE_LIFT = plyLift(2)

/** One story of the keep — a box fold seated on the story below. `key` names
 *  the story (hall/gallery/loft/crown) so its per-face art ids resolve as
 *  `<keepId>-<key>-front/-back/-side/-top` (the box-family suffix scheme). */
export type KeepStorySpec = {
  key: string
  /** Box half-width (glue distance from the spine on both pages). */
  a: number
  height: number
  z0: number
  z1: number
  roof: 'flat' | 'gable' | 'open'
  gableRise?: number
  capFront?: boolean
  capBack?: boolean
  /** DIE-CUT FACADE PLATE dims (the raven-finial idiom generalized to a tier
   *  front). When set, the tier's `-front` art prints as TWO coplanar half-quads
   *  in the capFront planes — creased at y=0, split art u at 0.5 — anchored at
   *  the cap BASE edge and sized to the art's TRUE (uncropped) aspect, so the
   *  silhouette (curtain wall / belfry roof / spire) shows past the cap's top and
   *  side edges. In-plane extension = ZERO off-plane reach: folds flat with the
   *  cap, wedge containment inherits the cap's proof. The box cap itself renders
   *  as plain bracing paper behind the plate (capFrontArt:false). `width` is the
   *  TOTAL plate width across both halves (crease->outer per half = width/2, along
   *  the cap plane's lateral); `height` is the run UP the cap plane from the base
   *  edge. mesh aspect width/height MUST equal the delivered art aspect. */
  plate?: { width: number; height: number }
  /** E4 PER-PART STAGING: this story's own erection window inside the page
   *  turn (popup-mechanics `TurnStage`). Omitted = erects across the whole
   *  turn, i.e. the pre-E4 behaviour, bit-identical. A staged story runs its
   *  whole travel inside its window while STAYING GLUED to the lid below it as
   *  that lid is itself still rising — see `keepStackStoryPoses`. */
  stage?: TurnStage
  /** DIE-CUT ARCH declared in content (E4 §2c), mirroring `OanaveGeom.aperture`
   *  (popup-oanave.ts). Aperture in this engine is ALPHA IN THE PAINTED ART,
   *  not punched geometry: this field cuts nothing, it records for the painter
   *  and for the covenant test WHERE the hole in this story's facade plate is.
   *  `halfW` across the plate crease, `apexH` up the plate from its base edge,
   *  both in world units and both inside the plate's own width/2 x height box.
   *  The box's front CAP stays solid behind the plate at PLATE_LIFT, so the
   *  hole shows real paper at a real depth offset rather than the background. */
  aperture?: { halfW: number; apexH: number }
}

/** The jutting gold dispatch balcony — a deck riding the ground story's flat
 *  lid, overhanging +z toward the reader. World half-width per side, and the
 *  deck's z-span (starts just in front of the story-above wall so nothing
 *  occludes or scissors it). */
export type KeepBalconySpec = {
  halfW: number
  z0: number
  z1: number
  /** E4 PER-PART STAGING. The deck already rides the ground story's lid, so
   *  its own window cannot be a second dihedral — it is a FLAP about the lid's
   *  front edge: before the window the deck lies FOLDED BACK onto the roof
   *  (psi = 180deg, still in the lid plane, so still dead flat at book-closed),
   *  and across the window it swings forward over the arch to psi = 0, its
   *  shipped jutting pose. Omitted = psi is 0 throughout, bit-identical. */
  stage?: TurnStage
}

/** The hero raven finial riding the FAN SPIRE'S PEAK member (Concept A). A
 *  coplanar extension of the steepest member's two panels, PAST its ridge tip
 *  along the member crease — the raven-finial idiom (was: keepStackRavenDeck on
 *  the retired crown's front cap) transplanted from the cap to the spire peak.
 *  Coplanar with a folding member => zero off-plane reach: folds dead flat with
 *  the spire for free, wedge containment inherits the member's proof. Stays the
 *  topmost hero silhouette, reader-visible at the pinned camera. `finialH` is
 *  the run UP the crease past the ridge tip; the finial spreads to the member's
 *  own half-width (so it reads at the peak's scale). */
export type KeepSpireRavenSpec = {
  finialH: number
}

/** THE FAN SPIRE CROWN (Concept A "Silhouette-Break Keep"; bench derive-keep-
 *  spire.mjs). Birmingham mech 21-29 M-fold: k INDEPENDENT v-fold members
 *  sharing ONE apex, SEATED ON THE TOP STORY'S FLAT LID. The apex sits on the
 *  lid's backbone-top seam (bisector-x = sum of story heights, y=0, over the
 *  spine) and every member's glue lines run down the two lid panels — the
 *  boxLid rider seat (delta=0, hEff=h) generalized from one v-fold to a fan. So
 *  a page fan and the lid-seated fan are the SAME solveFanPose, translated by
 *  the seat height along the bisector X. The translation collapses into the
 *  page plane as beta->0 and a v-fold folds flat on its own, so the spire folds
 *  DEAD FLAT for free. Members run laid-back-flank -> steep-narrow-peak (the
 *  LAST member is the peak and the raven's seat), narrowing so the silhouette
 *  reads as a pierced peak, not a fan of sails. */
export type KeepSpireSpec = {
  apexZ: number
  vDir: 1 | -1
  members: readonly FanMember[]
  raven?: KeepSpireRavenSpec
  /** E4 PER-PART STAGING: the fan's own erection window. The fan is solved at
   *  its own remapped dihedral and RE-SEATED on the top story's lid AS THAT
   *  LID CURRENTLY LIES, so before its window the whole spire lies folded flat
   *  ON the roof and then erects off it. Omitted = bit-identical. */
  stage?: TurnStage
}

export type KeepStackGeom = {
  mech: 'keepstack'
  /** Stories ground -> top. Telescoping (a_k <= a_{k-1}) and nested z-spans are
   *  REQUIRED (asserted by the content covenant + keepStackTelescopes below).
   *  Every story is FLAT-lidded: its lid is the seat for the story (or spire)
   *  above — the box-on-lid hoist chain. */
  stories: readonly KeepStorySpec[]
  balcony?: KeepBalconySpec
  /** The fan spire crown seated on the TOP story's flat lid (replaces the old
   *  gabled crown box). Carries the hero raven finial. */
  spire?: KeepSpireSpec
}

/** Each story as a BoxGeom with its cumulative baseH filled in (the offset that
 *  seats it on the lower lid), tagged with its `key` for art-id resolution.
 *  This is the whole "expansion" — one keepstack entry -> N box poses. */
export function keepStackStoryGeoms(
  geom: KeepStackGeom
): ReadonlyArray<BoxGeom & { key: string; plate?: KeepStorySpec['plate'] }> {
  let base = 0
  const out: Array<BoxGeom & { key: string; plate?: KeepStorySpec['plate'] }> = []
  for (const s of geom.stories) {
    out.push({
      mech: 'box',
      a: s.a,
      height: s.height,
      z0: s.z0,
      z1: s.z1,
      roof: s.roof,
      gableRise: s.gableRise,
      capFront: s.capFront,
      capBack: s.capBack,
      // A tier with a facade plate suppresses its own cap-front art (the plate
      // prints the front; the cap stays raw bracing paper behind it).
      capFrontArt: s.plate ? false : undefined,
      baseH: base,
      key: s.key,
      plate: s.plate,
    })
    base += s.height
  }
  return out
}

/** The bisector-x the spire apex seats on: the sum of the story heights (the
 *  top story's flat-lid backbone-top seam). */
export function keepStackSeatHeight(geom: KeepStackGeom): number {
  return geom.stories.reduce((h, s) => h + s.height, 0)
}

/** The keep's structural crown reach up the bisector at full open (beta=PI) —
 *  now the FAN SPIRE peak: the seat height plus the peak member's crease run
 *  (height * sin(open crease elevation)). Bench derive-keep-spire T7: ~1.0
 *  world, clearly above the retired gabled crown's ~0.90. Falls back to the
 *  top-story roof for a spire-less keep. */
export function keepStackCrownHeight(geom: KeepStackGeom): number {
  const seat = keepStackSeatHeight(geom)
  if (geom.spire && geom.spire.members.length > 0) {
    const peak = geom.spire.members[geom.spire.members.length - 1]
    const lambda = openElevation(rad(peak.phiDeg), rad(peak.rhoDeg))
    return seat + peak.height * Math.sin(lambda)
  }
  const top = geom.stories[geom.stories.length - 1]
  return seat + (top.roof === 'gable' ? (top.gableRise ?? 0) : 0)
}

/** True iff every story telescopes inward (a_k <= a_{k-1}) — the fold-flat
 *  seating constraint (bench S3/S6b). Asserted by the covenant tests. */
export function keepStackTelescopes(geom: KeepStackGeom): boolean {
  return geom.stories.every((s, k) => k === 0 || s.a <= geom.stories[k - 1].a + 1e-12)
}

// ---------------------------------------------------------------------------
// E4 PER-PART STAGING — the box-on-lid chain with its parts on different clocks.
//
// THE PROBLEM. `baseH` seats a story by offsetting its whole bisector-x by the
// heights below it. That works ONLY because parent and child share one beta:
// the lid at lid-distance t sits at bisector (H + t*cos(h), +-t*sin(h)), which
// is exactly where the child's glue lines land when the child uses the same h.
// Give the child its own h and the two stop agreeing — the glue lines float
// above the lid (child behind its parent) or sink through it (child ahead).
//
// THE FIX — RE-SEATING. A story's left half is a rigid body GLUED TO THE LEFT
// LID HALF of the story below; the same for the right. So solve the child on
// its own clock in its OWN page frame (baseH 0) and then map each half rigidly
// onto the parent's lid half: decompose a corner in the child's own page basis
// (e = along the page, n = the page normal), recompose in the seat's basis, and
// translate to the seat's crease. The glue line (u = a, w = 0) therefore lands
// EXACTLY on the lid at lid-distance a whatever the two clocks are doing, and
// when the clocks agree the map degenerates to the pure baseH translation —
// bit-identical, which the bench asserts to 1e-15.
//
// THE WELD. Corners that live on the CREASE (the backbone, the caps' inner
// edge, a plate's crease edge, the fan apex) belong to BOTH halves at once. A
// per-half rigid map would tear them apart into a slot down the middle of the
// piece, so those corners take the MEAN of the two half-images: the piece stays
// closed at every stage value and the break lands where it cannot be seen —
// crease-adjacent panels shear by O(H * sin(h_seat - h_own)) instead of gaping.
// Paper physics is a tool here, not a rule (E4 contract §0); fold-flat at
// book-closed and the rest pose are the two things that stay exact.
//
// THE PLY LADDER. A story lying folded flat ON its parent's lid is coplanar
// with it (that IS what flat-folding means), so the flat plies are separated by
// paper thickness exactly as real folded stock is — scaled by
// sin|h_seat - h_own| so the lift is EXACTLY 0 at rest and at book-closed.

/** The page angles one part of the keep runs on. */
export type KeepAngles = { thetaL: number; thetaR: number }

/** Resolves a part's own page angles from its stage window — the layer hands
 *  in `spreadPageAnglesTilted(..., stage)` so every part reads one turn clock
 *  through its own window. Omitted anywhere below = every part shares the
 *  passed-in angles, which is the pre-E4 behaviour exactly. */
export type KeepStageSolver = (stage?: TurnStage) => KeepAngles

/** The unstaged solver: every part runs on the one dihedral it is handed. */
export const fixedKeepAngles =
  (thetaL: number, thetaR: number): KeepStageSolver =>
  () => ({ thetaL, thetaR })

/** A dihedral's world frame: the bisector, the lateral, and the half-angle
 *  that places the two page (or lid) halves at +-h about the bisector. */
type HalfFrame = { bis: Vec3; lat: Vec3; h: number }

function halfFrame(angles: KeepAngles): HalfFrame {
  const m = (angles.thetaL + angles.thetaR) / 2
  return {
    bis: [Math.cos(m), Math.sin(m), 0],
    lat: [-Math.sin(m), Math.cos(m), 0],
    h: clamp(angles.thetaL - angles.thetaR, 0, Math.PI) / 2,
  }
}

/** One half-plane's in-plane direction `e` (crease -> outward) and outward
 *  normal `n`. sign +1 = the left half, -1 = the right. */
function halfAxes(f: HalfFrame, sign: number): { e: Vec3; n: Vec3 } {
  const ch = Math.cos(f.h)
  const sh = Math.sin(f.h)
  return {
    e: [ch * f.bis[0] + sign * sh * f.lat[0], ch * f.bis[1] + sign * sh * f.lat[1], 0],
    n: [sh * f.bis[0] - sign * ch * f.lat[0], sh * f.bis[1] - sign * ch * f.lat[1], 0],
  }
}

/** The surface a part is glued to: a crease point plus the frame whose two
 *  half-planes ARE the two halves of that surface. For the ground story this
 *  is the page pair itself; for everything above it, the lid below. */
type KeepSeat = { frame: HalfFrame; origin: Vec3 }

/** Map one corner of a part solved in its own page frame onto one half of its
 *  seat, lifted `lift` off the seat along that half's outward normal. */
function reseatHalf(p: Vec3, own: HalfFrame, seat: KeepSeat, sign: number, lift: number): Vec3 {
  const o = halfAxes(own, sign)
  const s = halfAxes(seat.frame, sign)
  const u = p[0] * o.e[0] + p[1] * o.e[1]
  const w = p[0] * o.n[0] + p[1] * o.n[1] + lift
  return [
    seat.origin[0] + u * s.e[0] + w * s.n[0],
    seat.origin[1] + u * s.e[1] + w * s.n[1],
    p[2],
  ]
}

/** `sigma` +1/-1 = the corner belongs to the left/right half; 0 = it lives on
 *  the crease and belongs to both, so it takes the mean of the two images (the
 *  weld). */
function reseatCorner(p: Vec3, own: HalfFrame, seat: KeepSeat, sigma: number, lift: number): Vec3 {
  if (sigma > 0) return reseatHalf(p, own, seat, 1, lift)
  if (sigma < 0) return reseatHalf(p, own, seat, -1, lift)
  const a = reseatHalf(p, own, seat, 1, lift)
  const b = reseatHalf(p, own, seat, -1, lift)
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
}

function reseatQuad(q: PanelQuad, sigma: readonly number[], own: HalfFrame, seat: KeepSeat, lift: number): PanelQuad {
  return [
    reseatCorner(q[0], own, seat, sigma[0], lift),
    reseatCorner(q[1], own, seat, sigma[1], lift),
    reseatCorner(q[2], own, seat, sigma[2], lift),
    reseatCorner(q[3], own, seat, sigma[3], lift),
  ]
}

const CREASE_EPS = 1e-9

/** Which half each corner of a solved part belongs to, DERIVED (never
 *  hard-coded off another module's corner order) from a reference solve at the
 *  flat-open pose (thetaL PI, thetaR 0): there the bisector is +y and the
 *  lateral is -x, so a corner's side is the sign of -x and a crease corner is
 *  the one with x == 0. Every part's patch list is constant in its geometry,
 *  so this mask is too. */
function halfSigns(reference: readonly PanelQuad[]): number[][] {
  return reference.map((q) => q.map((c) => (Math.abs(c[0]) < CREASE_EPS ? 0 : c[0] < 0 ? 1 : -1)))
}

/** Paper thickness between a flat-folded part and the surface it lies on. */
const STAGE_PLY = PLY

/** How far a part is lifted off its seat: zero when the part and its seat run
 *  the same clock (so REST AND BOOK-CLOSED ARE EXACT), one ply-count's worth of
 *  stock when the part lies folded flat on a surface it would otherwise be
 *  coplanar with. */
function stageLift(own: HalfFrame, seat: KeepSeat, plies: number): number {
  return plies * STAGE_PLY * Math.sin(Math.abs(seat.frame.h - own.h))
}

/** Face -> ply index in the flat-folded stack. A flat-folded box lies wall
 *  first, then its lid folded back OVER that wall; caps fold out past the wall
 *  ends in z and never overlap it. */
function facePlies(face: BoxFace): number {
  return face === 'lidL' || face === 'lidR' || face === 'roofL' || face === 'roofR' ? 2 : 1
}

/** One story of a staged keep: the box geom the renderers already expect (with
 *  its cumulative `baseH` for art ids, shadows and plate lookup), its own
 *  solved-and-re-seated patches, and the LID FRAME it offers to whatever rides
 *  above it. */
export type KeepStoryPose = {
  key: string
  geom: BoxGeom & { key: string; plate?: KeepStorySpec['plate'] }
  /** The frame this story's own clock puts it in. */
  own: HalfFrame
  /** The lid it is glued to. */
  seat: KeepSeat
  /** Its own lid — the seat for the story / spire above. */
  lid: KeepSeat
  patches: readonly BoxPatch[]
}

/**
 * The whole story stack, each story solved on its OWN clock and re-seated on
 * the lid below it AS THAT LID CURRENTLY LIES.
 *
 * The seat chain. Every lid in the stack is parallel to the ground story's own
 * page pair (a flat lid is parallel to the surface its box stands on, and a
 * rigid per-half map preserves that), so all seats share ONE frame and differ
 * only in their crease origin. Story k's crease sits `height * cos(h_seat -
 * h_own)` further up the bisector than story k-1's: the welded image of the
 * child's own backbone-top, which is `height` when the clocks agree.
 *
 * The one approximation, stated honestly: a re-seated story's lid is SHEARED
 * (its wall-top edge leaves the seat plane by `height * cos(h_seat) *
 * sin(h_own - h_seat)`), so a story two levels up rides a plane that is off its
 * parent's warped lid by that much. It is 0 at rest, 0 at full open, and 0
 * whenever the ground story leads — which is the only staging order that reads
 * as construction anyway. The bench measures it (`seat drift`).
 */
export function keepStackStoryPoses(
  geom: KeepStackGeom,
  thetaL: number,
  thetaR: number,
  angles?: KeepStageSolver
): KeepStoryPose[] {
  const resolve = angles ?? fixedKeepAngles(thetaL, thetaR)
  const seatFrame = halfFrame(resolve(geom.stories[0]?.stage))
  const out: KeepStoryPose[] = []
  let origin: Vec3 = [0, 0, 0]
  let base = 0
  for (const s of geom.stories) {
    const ownAngles = resolve(s.stage)
    const own = halfFrame(ownAngles)
    const seat: KeepSeat = { frame: seatFrame, origin }
    const solveGeom: BoxGeom = {
      mech: 'box',
      a: s.a,
      height: s.height,
      z0: s.z0,
      z1: s.z1,
      roof: s.roof,
      gableRise: s.gableRise,
      capFront: s.capFront,
      capBack: s.capBack,
      baseH: 0,
    }
    const local = solveBoxPose(solveGeom, ownAngles.thetaL, ownAngles.thetaR)
    const sigma = halfSigns(solveBoxPose(solveGeom, Math.PI, 0).map((p) => p.quad))
    const patches = local.map((p, i) => ({
      face: p.face,
      quad: reseatQuad(p.quad, sigma[i], own, seat, stageLift(own, seat, facePlies(p.face))),
    }))
    const rise = s.height * Math.cos(seatFrame.h - own.h)
    const lid: KeepSeat = {
      frame: seatFrame,
      origin: [origin[0] + rise * seatFrame.bis[0], origin[1] + rise * seatFrame.bis[1], 0],
    }
    out.push({
      key: s.key,
      geom: {
        ...solveGeom,
        capFrontArt: s.plate ? false : undefined,
        baseH: base,
        key: s.key,
        plate: s.plate,
      },
      own,
      seat,
      lid,
      patches,
    })
    origin = lid.origin
    base += s.height
  }
  return out
}

/** The two half-decks of the jutting balcony, riding the ground story's flat
 *  lid at lid-distance t in [0, halfW] and overhanging +z. Returns null when
 *  the keep carries no balcony. Corner order [bl, br, tr, tl] like a lid panel.
 */
export function keepStackBalconyDeck(
  geom: KeepStackGeom,
  thetaL: number,
  thetaR: number,
  angles?: KeepStageSolver
): { deckL: PanelQuad; deckR: PanelQuad } | null {
  if (!geom.balcony) return null
  const bal = geom.balcony
  const resolve = angles ?? fixedKeepAngles(thetaL, thetaR)
  const seat = keepStackStoryPoses(geom, thetaL, thetaR, angles)[0].lid
  const { h } = seat.frame
  // E4 STAGING — THE FLAP. The deck lies IN the lid plane, so it has no second
  // dihedral of its own to run; what it has is a hinge on the lid's front edge.
  // psi runs 180deg (folded BACK onto the roof, still in the lid plane, so
  // still dead flat at book-closed and clear of the arch) -> 0deg (the shipped
  // jutting pose) across the deck's window. Its progress through that window is
  // read off its own clock against its seat's — 1 (done) whenever the deck
  // carries no window at all, which is the pre-E4 pose exactly.
  const own = halfFrame(resolve(bal.stage))
  const done = !bal.stage || h < CREASE_EPS ? 1 : clamp(own.h / h, 0, 1)
  const psi = Math.PI * (1 - done)
  const cpsi = Math.cos(psi)
  const spsi = Math.sin(psi)
  const hingeZ = geom.stories[0].z1
  // Each half-deck lifts along its own lid-half normal, magnitude
  // BALCONY_LIFT*sin(h) -> 0 at close, ~BALCONY_LIFT at open.
  const lift = BALCONY_LIFT * Math.sin(h)
  const lidPt = (t: number, sign: number, z: number): Vec3 => {
    const { e, n } = halfAxes(seat.frame, sign)
    const dz = z - hingeZ
    const w = lift + dz * spsi
    return [
      seat.origin[0] + t * e[0] + w * n[0],
      seat.origin[1] + t * e[1] + w * n[1],
      hingeZ + dz * cpsi,
    ]
  }
  const half = (sign: number): PanelQuad => [
    lidPt(0, sign, bal.z0),
    lidPt(0, sign, bal.z1),
    lidPt(bal.halfW, sign, bal.z1),
    lidPt(bal.halfW, sign, bal.z0),
  ]
  return { deckL: half(1), deckR: half(-1) }
}

/** One solved spire member seated on the top story's flat lid. The fan is
 *  solved on the spine (solveFanPose, apex [0,0,apexZ]) then RIGIDLY translated
 *  by the seat height along the bisector X — [seat*cm, seat*sm, 0] — so the apex
 *  lands on the lid seam and every glue line runs down the lid panels (the
 *  boxLid seat, delta=0). Translation leaves the crease/glue DIRECTIONS
 *  unchanged, so this is bit-identical physics to a page fan, just lifted onto
 *  the lid. Corner order per panel: [apex, glue-out, glue-out+crease, crease-top]
 *  (parallelogram convention). */
export type KeepSpireMemberPose = {
  left: PanelQuad
  right: PanelQuad
  /** Unit crease (ridge) direction in world; the raven extends along it. */
  crease: Vec3
  /** Ridge tip (apex + height*crease) — shared by both panels. */
  tip: Vec3
}

export function keepStackSpirePoses(
  geom: KeepStackGeom,
  thetaL: number,
  thetaR: number,
  angles?: KeepStageSolver
): KeepSpireMemberPose[] | null {
  if (!geom.spire || geom.spire.members.length === 0) return null
  const resolve = angles ?? fixedKeepAngles(thetaL, thetaR)
  const stories = keepStackStoryPoses(geom, thetaL, thetaR, angles)
  const seat = stories[stories.length - 1].lid
  const ownAngles = resolve(geom.spire.stage)
  const own = halfFrame(ownAngles)
  const fan = { mech: 'fan', apexZ: geom.spire.apexZ, vDir: geom.spire.vDir, members: geom.spire.members } as const
  // E4 staging: the fan is solved on its OWN clock in its own page frame and
  // re-seated on the top lid AS THAT LID CURRENTLY LIES (unstaged, the map is
  // exactly the old `seat * (cm, sm, 0)` translation). Every member's glue line
  // therefore stays down on the lid panels whatever the two clocks are doing,
  // and before its window the whole spire lies folded flat ON the roof.
  const poses = solveFanPose(fan, ownAngles.thetaL, ownAngles.thetaR)
  const reference = solveFanPose(fan, Math.PI, 0)
  const lift = stageLift(own, seat, 1)
  const sigma = halfSigns(reference.flatMap((p) => [p.left, p.right]))
  return poses.map((pose, i) => {
    const left = reseatQuad(pose.left, sigma[i * 2], own, seat, lift)
    const right = reseatQuad(pose.right, sigma[i * 2 + 1], own, seat, lift)
    // The ridge direction after re-seating: apex -> tip of the mapped member
    // (identical to the solved `pose.crease` whenever the clocks agree).
    const ridge: Vec3 = [left[3][0] - left[0][0], left[3][1] - left[0][1], left[3][2] - left[0][2]]
    const len = Math.hypot(ridge[0], ridge[1], ridge[2]) || 1
    return { left, right, crease: scale3(ridge, 1 / len), tip: left[3] }
  })
}

/** The hero raven finial riding the spire's PEAK (last) member — a coplanar
 *  extension of both peak panels PAST the ridge tip along the member crease,
 *  spreading to the member's own half-width. Being coplanar with each folding
 *  member panel means ZERO off-plane reach: folds dead flat with the spire for
 *  free, wedge containment inherits the member's proof. Corner order per half:
 *  [crease-bottom, crease-top, outer-top, outer-bottom] — the raven-finial idiom
 *  (reuses RAVEN_FINIAL_UVS). Returns null when the keep carries no spire raven. */
export function keepStackSpireRaven(
  geom: KeepStackGeom,
  thetaL: number,
  thetaR: number,
  angles?: KeepStageSolver
): { crestL: PanelQuad; crestR: PanelQuad } | null {
  const poses = keepStackSpirePoses(geom, thetaL, thetaR, angles)
  if (!poses || !geom.spire?.raven) return null
  const peak = poses[poses.length - 1]
  const { finialH } = geom.spire.raven
  const base = peak.tip // crease-bottom (ridge tip, shared by both panels)
  const up = scale3(peak.crease, finialH)
  const creaseTop = add3(base, up)
  // outer-bottom of each half = the panel's glue-out-top corner (left[2]/right[2]);
  // outer-top = that corner lifted by the same finial run along the crease.
  const outL = peak.left[2]
  const outR = peak.right[2]
  return {
    crestL: [base, creaseTop, add3(outL, up), outL],
    crestR: [base, creaseTop, add3(outR, up), outR],
  }
}

/** A tier's DIE-CUT FACADE PLATE — the raven-finial idiom (keepStackRavenDeck)
 *  generalized, anchored at the cap BASE edge instead of its top. TWO coplanar
 *  half-quads in the story's capFront planes (one per side of the y=0 crease),
 *  each running BASE->TOP along the cap plane (X from a*ch up by plate.height,
 *  free to exceed the cap height H) and CREASE->OUTER in the cap's own lateral
 *  direction (wh from 0 to plate.width/2, free to exceed the wall half-width a =
 *  the bailey-wall lateral overhang). Being coplanar with the folding cap means
 *  ZERO off-plane reach: it folds dead flat with the cap for free, and its wedge
 *  containment inherits the cap's proof (the raven precedent). Returns null when
 *  the story carries no plate. Corner order [crease-bottom, crease-top,
 *  outer-top, outer-bottom] — identical to the raven, so it reuses the raven UVs
 *  (art-u 0.5 at the crease -> 0/1 at the outer edge, art-v 0 base -> 1 top). */
export function keepStackFacadePlate(
  geom: KeepStackGeom,
  storyKey: string,
  thetaL: number,
  thetaR: number,
  angles?: KeepStageSolver
): { plateL: PanelQuad; plateR: PanelQuad } | null {
  const story = keepStackStoryPoses(geom, thetaL, thetaR, angles).find((g) => g.key === storyKey)
  if (!story || !story.geom.plate) return null
  // The plate rides its OWN story's cap, so it is solved on that story's clock
  // in the story's own page frame (baseH 0) and re-seated exactly as the cap is
  // — the two stay coplanar at every stage value, which is the whole point of
  // the die-cut idiom. Corner roles below: [crease-bottom, crease-top,
  // outer-top, outer-bottom], so the first two weld across the crease.
  const { own, seat } = story
  const ch = Math.cos(own.h)
  const sh = Math.sin(own.h)
  const W = (x: number, y: number, z: number): Vec3 => [
    x * own.bis[0] + y * own.lat[0],
    x * own.bis[1] + y * own.lat[1],
    z,
  ]
  const { width, height } = story.geom.plate
  const a = story.geom.a
  // The cap's BASE edge (bisector-x = a*ch, the tier floor / wall-top seam) is the
  // plate's BOTTOM; the crease is at (y=0, z = z1 + a*ch) and the crease->outer
  // direction in the cap plane is (y,z) = (sh, -ch) per unit wh (toward the front
  // wall corner, hitting it exactly at wh = a).
  const X0 = a * ch
  const zc = story.geom.z1 + a * ch
  const wh = width / 2
  // PLATE_LIFT: rigid per-half translation along the cap-half outward normal
  // (see the constant) so the plate never shares the rendered cap's plane.
  const lift = PLATE_LIFT * sh
  const stage = stageLift(own, seat, 1)
  const half = (sign: number): PanelQuad => {
    const dy = sign * lift * ch
    const dz = lift * sh
    const local: PanelQuad = [
      W(X0, dy, zc + dz),
      W(X0 + height, dy, zc + dz),
      W(X0 + height, sign * wh * sh + dy, zc - wh * ch + dz),
      W(X0, sign * wh * sh + dy, zc - wh * ch + dz),
    ]
    return reseatQuad(local, [0, 0, sign, sign], own, seat, stage)
  }
  return { plateL: half(1), plateR: half(-1) }
}

/** Every world-space quad the keep poses at a given dihedral — the story box
 *  faces plus any facade plates, the balcony half-decks, the fan spire members
 *  and the raven finial — for the collision / sightline / motion / depth
 *  dispatchers. */
export function keepStackQuads(
  geom: KeepStackGeom,
  thetaL: number,
  thetaR: number,
  angles?: KeepStageSolver
): PanelQuad[] {
  const quads: PanelQuad[] = []
  for (const story of keepStackStoryPoses(geom, thetaL, thetaR, angles)) {
    for (const patch of story.patches) quads.push(patch.quad)
    const plate = keepStackFacadePlate(geom, story.key, thetaL, thetaR, angles)
    if (plate) quads.push(plate.plateL, plate.plateR)
  }
  const deck = keepStackBalconyDeck(geom, thetaL, thetaR, angles)
  if (deck) quads.push(deck.deckL, deck.deckR)
  const spire = keepStackSpirePoses(geom, thetaL, thetaR, angles)
  if (spire) for (const p of spire) quads.push(p.left, p.right)
  const raven = keepStackSpireRaven(geom, thetaL, thetaR, angles)
  if (raven) quads.push(raven.crestL, raven.crestR)
  return quads
}

/** Per-story solved patches, keyed for the renderer (one popup-box-layer
 *  instance per story). Balcony + raven come from their own helpers. */
export function solveKeepStackPose(
  geom: KeepStackGeom,
  thetaL: number,
  thetaR: number,
  angles?: KeepStageSolver
): ReadonlyArray<{ key: string; geom: BoxGeom & { key: string }; patches: readonly BoxPatch[] }> {
  return keepStackStoryPoses(geom, thetaL, thetaR, angles).map((s) => ({
    key: s.key,
    geom: s.geom,
    patches: s.patches,
  }))
}

export type { BoxFace }
