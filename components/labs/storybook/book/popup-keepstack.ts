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
): ReadonlyArray<BoxGeom & { key: string }> {
  let base = 0
  const out: Array<BoxGeom & { key: string }> = []
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
      baseH: base,
      key: s.key,
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
  const lidPt = (t: number, sign: number, z: number): Vec3 => W(hall.height + t * ch, sign * t * sh, z)
  const half = (sign: number): PanelQuad => [
    lidPt(0, sign, bal.z0),
    lidPt(0, sign, bal.z1),
    lidPt(bal.halfW, sign, bal.z1),
    lidPt(bal.halfW, sign, bal.z0),
  ]
  return { deckL: half(1), deckR: half(-1) }
}

/** The hero raven silhouette perched on its seat story's roof/lid. A flat
 *  rigid quad standing up along the seat's outward normal — decorative, zero
 *  DOF, folds flat with the seat. Returns null when the keep carries no raven.
 */
export function keepStackRavenQuad(
  geom: KeepStackGeom,
  thetaL: number,
  thetaR: number
): PanelQuad | null {
  if (!geom.raven) return null
  const geoms = keepStackStoryGeoms(geom)
  const seat = geoms.find((g) => g.key === geom.raven!.storyKey)
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
  const { u, z, width, height } = geom.raven
  // Perch on the +y half of the seat's flat lid / roof top, standing up along
  // the seat's lid plane toward the crown (bisector-x = H + u*ch).
  const footX = seat.height + u * ch
  const footY = u * sh
  const top = footX + height
  return [
    W(footX, footY, z - width / 2),
    W(footX, footY, z + width / 2),
    W(top, footY, z + width / 2),
    W(top, footY, z - width / 2),
  ]
}

/** Every world-space quad the keep poses at a given dihedral — the four story
 *  box faces plus the balcony half-decks and the raven — for the collision /
 *  sightline / motion / depth dispatchers. */
export function keepStackQuads(
  geom: KeepStackGeom,
  thetaL: number,
  thetaR: number
): PanelQuad[] {
  const quads: PanelQuad[] = []
  for (const g of keepStackStoryGeoms(geom)) {
    for (const patch of solveBoxPose(g, thetaL, thetaR)) quads.push(patch.quad)
  }
  const deck = keepStackBalconyDeck(geom, thetaL, thetaR)
  if (deck) quads.push(deck.deckL, deck.deckR)
  const raven = keepStackRavenQuad(geom, thetaL, thetaR)
  if (raven) quads.push(raven)
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
