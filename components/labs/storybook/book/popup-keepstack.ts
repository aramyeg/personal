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

import type { BoxFace, BoxGeom, BoxPatch, PanelQuad, Vec3 } from './popup-mechanics'
import { solveBoxPose } from './popup-mechanics'

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

/** The kept hero raven, folded into the keep as a flat die-cut silhouette
 *  perched on a story's roof/lid (the child-v-fold it used to ride retired with
 *  ch3-towers; nothing external can parent onto the one-entry keep). `storyKey`
 *  picks the seat story; `u` is the run out along the seat lid/roof from the
 *  spine seam, `z` the perch position along the spine, and width/height the
 *  silhouette size (stands up along the seat's outward normal). */
export type KeepRavenSpec = {
  storyKey: string
  u: number
  z: number
  width: number
  height: number
}

export type KeepStackGeom = {
  mech: 'keepstack'
  /** Stories ground -> top. Telescoping (a_k <= a_{k-1}) and nested z-spans are
   *  REQUIRED (asserted by the content covenant + keepStackTelescopes below). */
  stories: readonly KeepStorySpec[]
  balcony?: KeepBalconySpec
  raven?: KeepRavenSpec
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

/** The keep's structural crown height above the pages at full open — the sum of
 *  story heights plus the crown's gable rise. Bench S5: ~0.84, 107% of the
 *  backdrop crest reference. */
export function keepStackCrownHeight(geom: KeepStackGeom): number {
  const total = geom.stories.reduce((h, s) => h + s.height, 0)
  const top = geom.stories[geom.stories.length - 1]
  return total + (top.roof === 'gable' ? (top.gableRise ?? 0) : 0)
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

/** The hero raven finial — an IN-PLANE extension of the crown's FRONT CAP, past
 *  its top edge, as TWO coplanar half-quads (one in each capFront plane), creased
 *  at y=0 exactly like the cap. Being coplanar with a folding cap face means ZERO
 *  off-plane reach: it folds dead flat with the cap for free (at close sh->0 so
 *  every lateral y-> 0), and its mid-turn wedge containment inherits the cap's own
 *  proof. At open the cap faces the reader (+z), so the finial faces the reader
 *  face-on — unlike a y-spanning quad, whose normal is lateral and reads edge-on.
 *  The raven art is split across the crease (like the balcony deck). Returns null
 *  when the keep carries no raven. `width` is the TOTAL finial width across both
 *  halves (each half is width/2 crease->outer, along the cap top edge); `height`
 *  is the run UP the cap plane from the cap top edge. */
export function keepStackRavenDeck(
  geom: KeepStackGeom,
  thetaL: number,
  thetaR: number
): { crestL: PanelQuad; crestR: PanelQuad } | null {
  if (!geom.raven) return null
  const seat = keepStackStoryGeoms(geom).find((g) => g.key === geom.raven!.storyKey)
  if (!seat) return null
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
  const { width, height } = geom.raven
  const a = seat.a
  // The front cap's top edge (bisector-x = a*ch + seat.height) is the finial's
  // BOTTOM; its crease-to-outer direction in the cap plane is (y,z) = (sh, -ch)
  // from the spine peak (y=0, z = z1 + a*ch) toward the outer front corner.
  const X0 = a * ch + seat.height
  const zc = seat.z1 + a * ch
  const wh = width / 2
  const crease0 = W(X0, 0, zc)
  const creaseTop = W(X0 + height, 0, zc)
  const half = (sign: number): PanelQuad => [
    crease0,
    creaseTop,
    W(X0 + height, sign * wh * sh, zc - wh * ch),
    W(X0, sign * wh * sh, zc - wh * ch),
  ]
  return { crestL: half(1), crestR: half(-1) }
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

/** Every world-space quad the keep poses at a given dihedral — the four story
 *  box faces plus any facade plates, the balcony half-decks and the raven — for
 *  the collision / sightline / motion / depth dispatchers. */
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
  const raven = keepStackRavenDeck(geom, thetaL, thetaR)
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
