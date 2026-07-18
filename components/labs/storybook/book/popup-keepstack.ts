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

import type { BoxFace, BoxGeom, BoxPatch, FanMember, PanelQuad, Vec3 } from './popup-mechanics'
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
const BALCONY_LIFT = 0.004

// Same idiom for the facade plates: a plate rides IN its cap plane, and from the
// cap base up to the cap top it coplanarly overlaps the still-rendered cap face
// (the interior-shadow recess behind the die-cut) -> z-fight flicker on every
// camera/parallax move. Each half lifts along ITS OWN cap-half outward normal
// (local (0, sign*ch, sh), a unit vector), magnitude PLATE_LIFT*sh: exactly 0 at
// book-closed (fold-flat + S1 stay at 1e-9) and ~PLATE_LIFT toward the reader at
// the open pose. A per-half rigid translation, so plate rigidity is untouched;
// the crease halves part by ±PLATE_LIFT*ch laterally at mid-turn (sub-3mm at
// book scale, unreadable at the sliver angles where ch is large).
const PLATE_LIFT = 0.004

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
}

/** The jutting gold dispatch balcony — a deck riding the ground story's flat
 *  lid, overhanging +z toward the reader. World half-width per side, and the
 *  deck's z-span (starts just in front of the story-above wall so nothing
 *  occludes or scissors it). */
export type KeepBalconySpec = {
  halfW: number
  z0: number
  z1: number
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

/** The two half-decks of the jutting balcony, riding the ground story's flat
 *  lid at lid-distance t in [0, halfW] and overhanging +z. Returns null when
 *  the keep carries no balcony. Corner order [bl, br, tr, tl] like a lid panel.
 */
export function keepStackBalconyDeck(
  geom: KeepStackGeom,
  thetaL: number,
  thetaR: number
): { deckL: PanelQuad; deckR: PanelQuad } | null {
  if (!geom.balcony) return null
  const hall = geom.stories[0]
  const bal = geom.balcony
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  const m = (thetaL + thetaR) / 2
  const h = beta / 2
  const ch = Math.cos(h)
  const sh = Math.sin(h)
  const cm = Math.cos(m)
  const sm = Math.sin(m)
  // The ground story sits at baseH 0, so its lid rides bisector-x = H + t*ch.
  const W = (x: number, y: number, z: number): Vec3 => [x * cm - y * sm, x * sm + y * cm, z]
  // Each half-deck lifts along its own lid-half normal (bisector (sh, -sign*ch),
  // a unit vector), magnitude BALCONY_LIFT*sh -> 0 at close, ~BALCONY_LIFT at open.
  const lift = BALCONY_LIFT * sh
  const lidPt = (t: number, sign: number, z: number): Vec3 =>
    W(hall.height + t * ch + lift * sh, sign * (t * sh - lift * ch), z)
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
  thetaR: number
): KeepSpireMemberPose[] | null {
  if (!geom.spire || geom.spire.members.length === 0) return null
  const m = (thetaL + thetaR) / 2
  const cm = Math.cos(m)
  const sm = Math.sin(m)
  const seat = keepStackSeatHeight(geom)
  // seat translation: bisector-x offset (seat, 0, 0) rotated to world by m.
  const delta: Vec3 = [seat * cm, seat * sm, 0]
  const tr = (q: PanelQuad): PanelQuad => [add3(q[0], delta), add3(q[1], delta), add3(q[2], delta), add3(q[3], delta)]
  return solveFanPose(
    { mech: 'fan', apexZ: geom.spire.apexZ, vDir: geom.spire.vDir, members: geom.spire.members },
    thetaL,
    thetaR
  ).map((pose) => {
    const left = tr(pose.left)
    return { left, right: tr(pose.right), crease: pose.crease, tip: left[3] }
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
  thetaR: number
): { crestL: PanelQuad; crestR: PanelQuad } | null {
  const poses = keepStackSpirePoses(geom, thetaL, thetaR)
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
  thetaR: number
): { plateL: PanelQuad; plateR: PanelQuad } | null {
  const seat = keepStackStoryGeoms(geom).find((g) => g.key === storyKey)
  if (!seat || !seat.plate) return null
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  const m = (thetaL + thetaR) / 2
  const h = beta / 2
  const ch = Math.cos(h)
  const sh = Math.sin(h)
  const cm = Math.cos(m)
  const sm = Math.sin(m)
  const baseH = seat.baseH ?? 0
  const W = (x: number, y: number, z: number): Vec3 => {
    const X = x + baseH
    return [X * cm - y * sm, X * sm + y * cm, z]
  }
  const { width, height } = seat.plate
  const a = seat.a
  // The cap's BASE edge (bisector-x = a*ch, the tier floor / wall-top seam) is the
  // plate's BOTTOM; the crease is at (y=0, z = z1 + a*ch) and the crease->outer
  // direction in the cap plane is (y,z) = (sh, -ch) per unit wh (toward the front
  // wall corner, hitting it exactly at wh = a).
  const X0 = a * ch
  const zc = seat.z1 + a * ch
  const wh = width / 2
  // PLATE_LIFT: rigid per-half translation along the cap-half outward normal
  // (see the constant) so the plate never shares the rendered cap's plane.
  const lift = PLATE_LIFT * sh
  const half = (sign: number): PanelQuad => {
    const dy = sign * lift * ch
    const dz = lift * sh
    return [
      W(X0, dy, zc + dz),
      W(X0 + height, dy, zc + dz),
      W(X0 + height, sign * wh * sh + dy, zc - wh * ch + dz),
      W(X0, sign * wh * sh + dy, zc - wh * ch + dz),
    ]
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
  thetaR: number
): PanelQuad[] {
  const quads: PanelQuad[] = []
  for (const g of keepStackStoryGeoms(geom)) {
    for (const patch of solveBoxPose(g, thetaL, thetaR)) quads.push(patch.quad)
    const plate = keepStackFacadePlate(geom, g.key, thetaL, thetaR)
    if (plate) quads.push(plate.plateL, plate.plateR)
  }
  const deck = keepStackBalconyDeck(geom, thetaL, thetaR)
  if (deck) quads.push(deck.deckL, deck.deckR)
  const spire = keepStackSpirePoses(geom, thetaL, thetaR)
  if (spire) for (const p of spire) quads.push(p.left, p.right)
  const raven = keepStackSpireRaven(geom, thetaL, thetaR)
  if (raven) quads.push(raven.crestL, raven.crestR)
  return quads
}

/** Per-story solved patches, keyed for the renderer (one popup-box-layer
 *  instance per story). Balcony + raven come from their own helpers. */
export function solveKeepStackPose(
  geom: KeepStackGeom,
  thetaL: number,
  thetaR: number
): ReadonlyArray<{ key: string; geom: BoxGeom & { key: string }; patches: readonly BoxPatch[] }> {
  return keepStackStoryGeoms(geom).map((g) => ({
    key: g.key,
    geom: g,
    patches: solveBoxPose(g, thetaL, thetaR),
  }))
}

export type { BoxFace }
