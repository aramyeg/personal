import { BOOK_HINGE, PLANT } from './desk-deep'
import { DESK_NUDGE_ZONES, DESK_PAD, type DeskNudgeKind } from './desk-glb-contract'
import { LANE_BAR_INDEX, STATION_BARS, STATION_CASE, TRAY_FLOOR_RANGE } from './desk-station'

/**
 * THE BLACK UNDERSIDES (T102) — what a lift, a peel or an open reveals, and why it is not black.
 *
 * Aram, critique round 2, item 1: *any* wobble/tilt/lift interaction that reveals an object's
 * UNDERSIDE shows BLACK; it should read PINK (the desk's pink cover) or WHITE (the bare table),
 * depending on what the object is standing over.
 *
 * ============================================================================
 * THE DIAGNOSIS — FIFTEEN INTERACTIONS MEASURED, FOUR REGIONS CONVICTED
 * ============================================================================
 * The failure class is known and has two solved precedents in this codebase (`BIRD_LIFT` in
 * desk-deep.ts, `CAN_GRADE` in desk-water-look.ts): the bake is honest bytes, but a face the
 * geometry hides from the light bakes to near-black, and a motion that turns it toward the camera
 * shows the hole. Both precedents fix it with a DISPLACEMENT-weighted, LUMINANCE-banded colour
 * lift computed after the motion, so the rest pose takes the untouched path and rest identity is
 * STRUCTURAL rather than tuned. This keeps that shape. It does NOT keep their scoping, and the
 * measurements are the reason.
 *
 * Every armed interaction on the ending's desk was measured twice — the shipped bytes
 * (per-vertex baked luminance by face orientation) and the shipped picture (headed real-GPU
 * captures of each interaction at the worst frame of its own arc, against a reference taken with
 * the pointer already parked and the parallax settled). The picture is the arbiter: this reading
 * camera is lid-dominant, so an object whose numbers look terrible but whose underside never
 * turns toward the eye is not a defect.
 *
 * CONVICTED BY PICTURE — all in `DeskBaked`, and all of them a face that was pressed flat against
 * something until an interaction turned it toward the eye:
 *
 *   the plant's leaf perk    capture p1 luminance 102 -> 54; the succulent's leaves grow hard
 *                            BLACK RIMS as the perk rotates their undersides up
 *   the notebook cover open  p1 93 -> 39, p5 150 -> 107; the cover stands like a screen and its
 *                            underside renders as a flat black band across the frame
 *   the tray floor under     p1 146 -> 0 (true black), p5 162 -> 77; clicking the clay lane
 *   the clay lane            collapses the baked bar and uncovers the tray's inner floor
 *
 * ...and one carried on NUMBERS ALONE, stated as such: the kit case's corner peel. Its downward
 * faces are 72% under luminance 0.12 with a median of 0.000, so the hole is certainly in the
 * bytes — but the peel could not be staged in a capture, because every pointer position that
 * reaches the case's back-left corner also claims the clay lane, and the lane's roll is what the
 * frame then shows. The region is kept because it is harmless if the peel never shows it (the
 * weight needs displacement AND a crushed luminance AND to be in view) and a real fix if it does.
 * A later round that can stage the peel should confirm or drop it.
 *
 * ACQUITTED, by picture, with their worst-frame darkening in capture luminance: mug rock
 * (89 -> 89), penguin weeble (52 -> 52), bird figurine peck (max channel delta 15), pen-cup rock
 * (118 -> 118), all five pens' clatter (120 -> 119), donut squash (47 -> 43 — that is the
 * chocolate's own albedo, not a hole), station bar scoot (116 -> 116), chip press (118 -> 119),
 * knife see-saw (103 -> 93), note press (25 -> 25), globe cradle wobble (48 -> 48 — a sphere
 * turning 3 degrees in its cradle uncovers nothing), watering can lift (its bake has no blacks at
 * all: minimum luminance 0.282, and it is already graded by `CAN_GRADE`), the clay lane's own roll
 * (already lifted by `BIRD_LIFT` — confirmed, not redone). The rigid rockers tilt 0.8-7 degrees
 * and simply never bring a downward face into view.
 *
 * AND ONE THING THE MEASUREMENT COULD NOT REACH: the tree's sway never staged either, on any of
 * eight settled pointer positions over its crown. It is called innocent on numbers, which are the
 * healthiest on the desk — its downward faces run a median luminance of 0.426 with only 11% under
 * 0.12, where every convicted region is bimodal against a crushed core.
 *
 * ============================================================================
 * WHY NEITHER PRECEDENT'S SCOPING TERM WORKS HERE — THE MEASUREMENT THAT DECIDED THE DESIGN
 * ============================================================================
 * T100 measured that for the roll the DISPLACEMENT ramp saturates and the LUMINANCE BAND is what
 * actually scopes the lift. On this desk BOTH terms fail to scope, in opposite directions, and a
 * lift built on either alone would repaint objects that were never broken:
 *
 *   THE DISPLACEMENT RAMP CANNOT SEPARATE THEM. Peak displacement at each motion's own re-poke
 *   cap, world units: plant perk 0.049 — the SMALLEST on the desk — against penguin 0.166, bird
 *   figurine 0.305, pens 0.153, knife 0.130, mug 0.118, bar scoot 0.056. The case's peel maxes at
 *   0.105, right in the middle of the innocent pack. The two convicted panels that move least
 *   move less than every acquitted object.
 *
 *   THE LUMINANCE BAND CANNOT SEPARATE THEM EITHER. The penguin is a penguin: 79% of its
 *   NON-underside vertices — faces that point at the key light — sit under luminance 0.12. That
 *   is paint, not occlusion, and any band tight enough to catch a crushed underside catches the
 *   penguin's black head. Same for the donut's chocolate glaze.
 *
 * So the term that scopes this family is the REGION: the objects the diagnosis convicted, selected
 * exactly the way their own motions select them (three contiguous `gl_VertexID` runs and one
 * rest-position box, every one read from the constant that already owns it, so a re-measure cannot
 * move the motion and the lift apart). The band and the ramp keep their jobs, but as GUARDS inside
 * those regions rather than as the scope:
 *
 *   THE BAND, MEASURED INSIDE THE REGIONS AND NOT INHERITED. Their luminance histograms are
 *   sharply bimodal with a near-empty valley — the cover has 124 vertices under 0.02, then
 *   EXACTLY ZERO between 0.02 and 0.16, then its whole honest range from 0.16 up (top face
 *   0.868). The others have the same shape with a thin tail. So the band can sit far tighter than
 *   `BIRD_LIFT`'s 0.12/0.42, because these regions have a valley the roll's continuous vertical
 *   gradient did not.
 *
 *   THE RAMP, WHICH IS WHAT MAKES REST EXACT. Its edge sits at 0.0015 world units against a rest
 *   displacement of EXACTLY ZERO: at rest every motion block in this material is behind its own
 *   exact-zero guard, so `transformed` is bit-identically `position`, the length is +0, and
 *   `smoothstep` returns a true +0. Rest identity is therefore structural — a property of the
 *   arithmetic, not of a threshold anyone tuned. Inside the case's region the ramp also does real
 *   scoping work for free: only the corner inside the peel's flex radius passes it.
 *
 * THE LANE-COLLAPSE HAZARD IS CLOSED STRUCTURALLY. `BIRD_VERTEX_BODY` collapses the hidden baked
 * lane to a single point while the skinned twin performs — a huge false displacement on vertices
 * that emit no fragments. Those vertices (ids 29107-29536) are outside every region, so their
 * weight is zero by the region test and never reaches the ramp at all. The degenerate triangles
 * are a second line of defence, not the argument.
 *
 * ============================================================================
 * T104 — THE SECOND FAMILY: A BLACK THAT WAS NEVER AN UNDERSIDE, BUT A BURIED ONE
 * ============================================================================
 * Aram, after T102 shipped: *"the bottom sides of the elements that wiggle are still black, like
 * for example the penguin, when its animation is invoked the bottom of the penguin's feet are
 * black... it happens with the other items as well, but it is super noticeable with the penguin."*
 *
 * T102's acquittal of the penguin was right about its own question and wrong about Aram's. It
 * asked whether a downward face turns toward the eye — it does not; the weeble tilts 7° and the
 * lid-dominant camera never sees under a foot. What it did not ask is what a 7° tilt LIFTS OUT OF
 * THE PAD, and that is a different defect with a different cause:
 *
 *   BOTH FIGURINES ARE SUNK INTO THE DESK. The pad's top is 1.3030 and the bluebird is seated at
 *   1.2653, the penguin at 1.2625 — the authoring slip the figurine ticket already costs. So the
 *   penguin ships 879 of its 5,355 vertices UNDERGROUND (16.4%), and a face that was inside a
 *   solid pad when the scene was baked is not shaded at all: 96% of them are under luminance 0.12
 *   with a median of 0.0008. That is not a crushed bake, it is NO bake.
 *
 *   ITS OWN WEEBLE DIGS THEM UP. The rock is `baseR * angle` of lift plus a rotation about the
 *   base pivot, so at the re-poke cap (12.25°) 854 of those 879 vertices rise ABOVE the pad's top
 *   plane, by up to 0.0721 world units — a true-black band the height of the sink, wrapping the
 *   feet, appearing and disappearing with the wobble. Simulated over 24 tilt directions against
 *   the shipped bytes at both the single-click peak and the cap.
 *
 *   AND IT IS THE ONLY FAMILY LIKE IT. Every buried vertex on the desk was clustered and
 *   attributed to the run that owns it: the two figurines (879 + 97), the kit case's base (364 —
 *   already a region here, and its peel is height-weighted so the base never rises), the tray's
 *   body and the plant's saucer (static, nothing moves them) and the sunk clay chips, whose press
 *   only ever squashes them DOWN toward their own seat. Mug, donut and pen cup sit exactly on the
 *   pad with zero vertices under it, and the tree's foliage, the knife's handle, the plant's
 *   leaves and its pot have none either — so no other motion on this desk can uncover a buried
 *   VERTEX. The bluebird is the "other items as well": same slip, but 97 vertices and a 2°
 *   peck-recoil, so it lifts 21 of them by at most 0.0101 — which is exactly why it is not the one
 *   Aram named.
 *
 *   THAT LAST CLAUSE IS THE ONE T104 GOT WRONG, and T104e corrects it in place: it read as "so no
 *   other motion on this desk can uncover one [black]", and a buried vertex is not the only black
 *   a motion can uncover. Every seated prop also stands on a black patch that belongs to the DESK
 *   — see the T104e section below, which measures it. The buried-vertex census is sound; it was
 *   the wrong census to close the question with.
 *
 * THE SCOPE IS THE ONE TERM T102 RULED OUT FOR THIS OBJECT, PLUS THE PLANE THAT MAKES IT SAFE.
 * A luminance band still cannot scope a penguin (83% of the whole figurine is under 0.12 — it is
 * a penguin), and T102's warning stands: catch its paint and the bird turns grey mid-wobble. So
 * the region is the nudge box that already owns the motion, capped at a ceiling that separates the
 * hole from the paint. T104 set that ceiling at `DESK_PAD.top` — the plane that separates what the
 * pad hides from what it does not — and its own capture round then proved the plane too low: the
 * feet's undersides sit just above it. T104b walks the ceiling out of the vertex rings instead
 * (`FIGURINE_FOOT_TOP`, `SEAT_BAND_TOP`, below), and the family grew from the two figurines to the
 * four seated wigglers whose motion can lift a contact band at all.
 *
 * The rest guard is unchanged and still doubled: the ramp's exact zero as everywhere else, and
 * geometry — every vertex the lift can reach is, at rest, either inside a solid pad or pressed
 * against it under the object that stands on it.
 *
 * NOT THE FIGURINE TICKET, AND IT DOES NOT DISCHARGE IT. The ticket is to RE-SEAT the two, which
 * would put this same band on screen AT REST, where a displacement-driven lift structurally cannot
 * reach it; that still needs a re-bake or a static treatment. This fixes only what the wobble digs
 * up, which is what the wobble is allowed to be judged on.
 *
 * ============================================================================
 * WHAT THE UNDERSIDES ARE LIFTED TOWARD — READ, NOT CHOSEN
 * ============================================================================
 * `DeskSurface` carries no vertex colour; it is atlas-textured. So both family colours were read
 * out of the shipped lit atlas (`t71_atlas_lit`, 1408 square) at the UVs under the desk's two top
 * planes, which the file itself separates: the pink cover's top is at y 1.3030 and the bare
 * table's at y 1.2675, and every object's footprint lands unambiguously on one of them.
 *
 * The FIRST attempt at this sampled straight under each object and got black — the atlas is a
 * Cycles bake of the desk WITH its props standing on it, so the cover under a mug is fully
 * occluded. An underside catches the family's colour in OPEN light, so the numbers below are
 * grid means over each surface's unoccluded half (2,302 samples on the cover, 6,140 on the
 * table). See `UNDERSIDE_ZONES` for the values and `UNDERSIDE_BOUNCE` for the one coefficient
 * that turns a surface colour into the light it throws back up.
 */

const f = (v: number): string => v.toFixed(5)
const v3 = (c: readonly [number, number, number]): string => `vec3( ${f(c[0])}, ${f(c[1])}, ${f(c[2])} )`

/**
 * How much of a surface's own colour comes back up onto what stands on it. ONE coefficient for
 * every region and both families, deliberately: what separates the targets is measurement — the
 * surface's colour and the object's own albedo — and a per-object coefficient would be taste
 * wearing a table's clothes.
 *
 * ============================================================================
 * WHY THE TARGET IS A PRODUCT AND NOT THE SURFACE COLOUR (the capture round said so)
 * ============================================================================
 * The first cut aimed every crushed vertex at the surface family's own colour. It closed the
 * notebook cover's black band outright, and the captures then convicted it on the plant: a green
 * leaf's underside lifted toward a WHITE table reads GREY. That is not what bounce does. Bounce
 * light is the surface's colour; what you see is that light times THE OBJECT'S OWN ALBEDO, which
 * is why a leaf over a white table stays a leaf and a pink case over a pink cover goes deeper
 * pink rather than paler.
 *
 * So the target is `albedo x surface x UNDERSIDE_BOUNCE`, with both factors read off the shipped
 * bytes — the albedo per region (its own bright family, see `UNDERSIDE_REGIONS`), the surface per
 * zone. Aram's note is still answered literally: what the underside picks up over the cover is
 * the cover's pink, and over the table the table's white.
 *
 * 0.75 is set by the tightest of the four regions. After `LIFT_K` a fully crushed vertex lands at
 * linear luminance 0.286 on the plant against its own leaf median of 0.347; 0.231 on the case
 * against 0.424; 0.417 on the cover against 0.868; 0.263 on the tray floor against 0.585. An
 * underside that outshone the lit side would be a worse lie than the black.
 */
export const UNDERSIDE_BOUNCE = 0.75

/** How far a fully crushed, fully displaced vertex travels toward its family's bounce. */
export const LIFT_K = 0.82

/**
 * The luminance band, measured inside the three convicted regions (see the header). Everything
 * under `lumLo` is a hole and lifts fully; everything over `lumHi` is the object's own honest
 * tone and keeps its bake EXACTLY. The gap between them is the occlusion penumbra, which is thin
 * here by measurement: the notebook cover has zero vertices anywhere in it.
 *
 * The T104 figurine bases inherited it rather than re-tuning it, and the shipped bytes say they
 * may: the bluebird's base has ZERO vertices in the gap and the penguin's 3.4%, against 99% and
 * 93% below `lumLo`. A band that lands on a bimodal core is doing the same job it was measured for.
 */
export const LIFT_BAND = { lumLo: 0.03, lumHi: 0.22 } as const

/**
 * The ramp. `dispLo` is not a tuned threshold — anything strictly positive gives the exact-zero
 * rest guard, because the untouched path's displacement is +0 exactly. It is set low because the
 * plant's perk, the smallest motion on the desk, peaks at 0.049; `dispHi` sits under that so the
 * perk saturates while the case's peel still fades in across its own flex radius.
 */
export const LIFT_RAMP = { dispLo: 0.0015, dispHi: 0.018 } as const

const target = (
  albedo: readonly [number, number, number],
  surf: readonly [number, number, number]
): readonly [number, number, number] => [
  albedo[0] * surf[0] * UNDERSIDE_BOUNCE,
  albedo[1] * surf[1] * UNDERSIDE_BOUNCE,
  albedo[2] * surf[2] * UNDERSIDE_BOUNCE,
]

/**
 * The measured pink cover, linear rgb — the mean of the 1,151 unoccluded grid samples on the top
 * plane at y 1.3030 (sRGB 234, 218, 222 / #eadade; chroma r/g 1.168, b/g 1.038 — the pink is in
 * the red channel and a little in the blue, which is why it must be a measurement and not a
 * hand-picked "pink").
 */
export const PAD_SURFACE = [0.8207, 0.7025, 0.729] as const

/** ...and the bare table at y 1.2675 (sRGB 239, 237, 237 / #efeded) — very nearly neutral, which
 *  is the whole difference between the two targets. */
export const TABLE_SURFACE = [0.863, 0.8502, 0.8487] as const

/**
 * THE ZONE TABLE. One rectangle per surface family that is not the default, evaluated at each
 * vertex's own REST xz and folded in order — so an object that straddles a boundary gets the
 * right answer on both halves rather than one answer for the whole object. Two of the three
 * convicted objects do straddle: the notebook cover runs x −3.99..−2.84 across the cover's own
 * edge at −3.3, and the kit case reaches x 3.357 just past it.
 *
 * The rectangle is `DESK_PAD`'s published footprint, not a copy of it, and the sampling confirmed
 * it: every footprint inside these bounds reads the cover's 1.3030 plane and every one outside
 * reads the table's 1.2675.
 */
export const UNDERSIDE_ZONES: readonly {
  readonly id: string
  readonly min: readonly [number, number]
  readonly max: readonly [number, number]
  /** The surface's own measured linear colour — the target is this times `UNDERSIDE_BOUNCE`. */
  readonly surface: readonly [number, number, number]
}[] = [
  {
    id: 'pad',
    min: [-DESK_PAD.halfW, DESK_PAD.backZ],
    max: [DESK_PAD.halfW, DESK_PAD.nearZ],
    surface: PAD_SURFACE,
  },
] as const

/** What an object standing on no listed zone is over: the bare table. */
export const UNDERSIDE_DEFAULT = TABLE_SURFACE

/**
 * How wide a zone's edge is, world units. A hard edge would draw a straight seam across the
 * notebook cover's underside where it crosses the cover's edge; bounce has no such edge, and at
 * the money shot 0.2 spans about 27 px of a tint difference of 0.06 in luminance — invisible by
 * construction rather than by luck.
 */
export const ZONE_SOFT = 0.2

/** The lane's own footprint, from the bar table that already owns it. */
const LANE_AABB = STATION_BARS[LANE_BAR_INDEX]!.aabb

/**
 * THE REGIONS. Each carries how it is SELECTED (the id run or box its own motion already uses),
 * its measured ALBEDO (the mean of its own vertices over luminance 0.35 — the object's honest
 * colour, which is what the bounce lands on), and what DRIVES its weight.
 *
 * `drive` is the part the captures forced. Five of the six are 'displacement': the face that
 * goes black is the face that moved, so `transformed - position` both scopes the lift and gives
 * the exact-zero rest guard for free. The fourth is not, and could never have been:
 *
 *   THE TRAY FLOOR IS REVEALED BY SOMETHING ELSE MOVING. Clicking the clay lane collapses the
 *   baked bar to a point (`BIRD_VERTEX_BODY`) while the skinned traveler performs, and what the
 *   vanished bar uncovers is the tray's inner floor — a STATIC sheet at y 1.3120 whose bake is
 *   black because a bar was lying on it when it was baked (74% of the vertices under the lane's
 *   footprint are below luminance 0.03, median 0.0002). Its displacement is identically zero, so
 *   no displacement-weighted term can ever reach it. Its weight comes from the driver that
 *   uncovers it, `uBird.x` — which `desk-glb.tsx` writes as a clean 0 or 1 and fills to 0 at
 *   rest, so the guard is exactly as structural as the ramp's. This is the same clause the
 *   watering can would need if it needed one at all (`WATER_UNIFORM`'s canLift): a node-driven or
 *   id-driven reveal must be weighted by its own driver.
 *
 *   It is scoped to the LANE'S FOOTPRINT and not to the whole sheet, because the rest of the
 *   floor is equally black and equally baked-under-a-bar — but those patches are either still
 *   covered or already visible, and brightening an already-visible one when an unrelated bar
 *   rolls would be a new defect rather than a fix.
 */
export type UndersideRegion = {
  readonly id: string
  /** The object's own honest colour, the mean over its vertices above luminance 0.35. */
  readonly albedo: readonly [number, number, number]
  readonly drive: 'displacement' | 'bird'
  /** Where the drive applies, xz, when the drive is not the vertex's own motion. */
  readonly foot?: { readonly min: readonly [number, number]; readonly max: readonly [number, number] }
  /**
   * How far ABOVE the region's own ceiling its albedo had to be read, world units — set only when
   * the region has no honest colour of its own to read.
   *
   * The four T102 regions each hold both a crushed core and their own lit family, so their albedo
   * is the mean over their own vertices above luminance 0.35 and nothing else is needed. A SEAT
   * BAND cannot: it is the part that was inside the pad or pressed against it, so it is all core
   * and there is no bright half to average. Its colour therefore comes from the body standing
   * directly on top of it, sampled in the same xz column from the region's ceiling up by
   * `BORROWED_ALBEDO_BAND` — the geometry the emergent band is physically continuous with, and the
   * only honest answer to "what colour is this thing" for a surface that has never been lit.
   *
   * T104b RETIRED IT FOR THE PENGUIN, and that is the shape of the fix rather than a tidy-up: once
   * the ceiling rises to the top of the feet (`FIGURINE_FOOT_TOP`), the region CONTAINS the feet's
   * own lit family — 219 vertices over luminance 0.35 — so the T102 rule applies directly and the
   * colour stops being borrowed at all. The two answers agree, which is the check: borrowed from
   * above the pad it read [0.7287, 0.5620, 0.4171] (r/g 1.297, b/g 0.742); read from the region's
   * own lit vertices it reads [0.7507, 0.5695, 0.3723] (r/g 1.318, b/g 0.654). The same warm foot.
   */
  readonly albedoAbove?: number
} & (
  | { readonly kind: 'range'; readonly range: readonly [number, number] }
  | { readonly kind: 'box'; readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] }
)

/**
 * How far above a seat band its own colour is read (see `albedoAbove`). 0.2 is five times the
 * deepest sink and about a quarter of either figurine's height, so the sample is the body directly
 * above the band rather than the head — and it is not a knife-edge for any of the three regions
 * that still borrow: at sample bands 0.1 / 0.2 / 0.3 the bluebird reads r/g 0.759 / 0.765 / 0.771,
 * the mug 2.023 / 2.015 / 1.995 and the pen cup 1.613 / 1.566 / 1.486. It is set at 0.2 because
 * that is where every borrower has a bright family big enough to mean something (258, 210 and 206
 * vertices over luminance 0.35; at 0.1 the bluebird has 34).
 */
export const BORROWED_ALBEDO_BAND = 0.2

/**
 * ============================================================================
 * T104b — THE TWO CEILINGS, WALKED OUT OF THE RINGS RATHER THAN CHOSEN
 * ============================================================================
 * T104 capped both figurine boxes at `DESK_PAD.top` and gated the result, and the capture round
 * then convicted the fix at the FIRST CREST: at t=120 ms only 59 of 150 near-black pixels in the
 * penguin's foot crop belonged to the region. The rest were the feet's OWN underside rims, sitting
 * just ABOVE the pad, self-occluded at rest and swung into view only at maximum tilt. T104 refused
 * to raise the ceiling by hand because the penguin's black does not stop above its feet — y
 * (1.333, 1.343] is 32 vertices, ALL crushed, ZERO lit, and the pattern repeats up the body. That
 * is paint, and a typed ceiling would eventually reach it.
 *
 * So the ceiling is not typed. This geometry is authored as horizontal LOOPS at discrete y, and
 * both ceilings are walked out of those loops by a rule, then placed at the MIDPOINT OF THE EMPTY
 * GAP the walk stops in — never on a loop, so no float32 rounding can include or drop a whole ring.
 * `scratchpad/t104/probe-ceil.mjs` runs the walk against the shipped bytes and prints it.
 *
 * THE FOOT RULE (figurines). Start at `DESK_PAD.top` and walk up. KEEP every ring that carries BOTH
 * a crushed family and a lit family — a ring that is dark in places is a ring the bake shadowed by
 * GEOMETRY, which is the whole defect. STOP at the first ring with no lit member at all: that is
 * the object's own black paint, which has no lit half anywhere. The walk, printed:
 *
 *   penguin  1.30521(n64 c24 l39) 1.30823(c24 l37) 1.31091(c26 l32) 1.31320(c28 l28)
 *            1.31505(c30 l25) 1.31640(c32 l15) 1.31722(c36 l13) | 1.31750(n2 c2 l0) <- STOP
 *
 * Seven mixed rings, and their lit family holds ONE colour throughout (b/g 0.614 → 0.621, the warm
 * foot); the ring that stops the walk has no lit vertex, and the next lit ring above it reads
 * b/g 0.938 — a different animal, the body. Ceiling = (1.317223 + 1.317500) / 2. It adds 200
 * crushed vertices to the region, which the weeble lifts to +0.0472 above the pad at a single
 * click and +0.0731 at the `AMP_CAP` re-poke ceiling.
 *
 *   bluebird 1.31591(n32 c0 l3) <- STOP on the FIRST ring above the pad
 *
 * The same rule returns the bluebird's EXISTING ceiling, because its run is empty: it has zero
 * crushed vertices anywhere between 1.3030 and 1.4300. Its region is unchanged, byte for byte —
 * a derived no-op rather than an assumed one.
 */
export const FIGURINE_FOOT_TOP: Readonly<Record<string, number>> = {
  /** The walk stops on the first ring, so this IS `DESK_PAD.top` — stated as a measurement. */
  bird: DESK_PAD.top,
  penguin: 1.317361,
}

/**
 * THE SEAT RULE (vessels) — T104b's second family, and the trap inside it.
 *
 * Aram: it is not just the penguin, every wiggling desk object shows it, with one exception, the
 * watering can. The can is the control and it settles the mechanism: its underside was visible to
 * the rig at bake time and it has NO crushed vertices anywhere (minimum luminance 0.2930), while
 * every SEATED object carries a crushed contact band at the pad. So the black is baked-in contact
 * darkness on the object itself, and the figurines' buried band is one special case of it.
 *
 * HEIGHT ABOVE THE SEAT IS NOT A SUFFICIENT SCOPE, which is the trap: the mug's and the pen cup's
 * crushed runs continue upward into their own INTERIORS, which are honestly dark and visible at
 * rest, and repainting those would be a new defect rather than a fix. The rings say exactly where
 * one stops and the other starts, and they say it in RADIUS as well as height:
 *
 *   mug     1.30300(n44 c44, loop r 0.2720) | 1.30447(n44 c13) <- STOP
 *   pen cup 1.30300(n40 c40, loop r 0.2440) | 1.30437(n40 c0)  <- STOP
 *
 * Walk up from the object's lowest vertex and keep every ring that is ENTIRELY crushed — the
 * contact CORE, where the bake reached nothing at all. Stop at the first ring that is not. Both
 * vessels stop after one loop, and stopping on the core is also what keeps `LIFT_BAND`'s own
 * precondition true: each band is 100% crushed with a 0.0% valley, the bimodal shape the band was
 * measured for. (The mug's next ring is the wall's PENUMBRA — 13 crushed and 31 vertices strewn
 * through the valley — and a region that included it would import the continuous gradient
 * `LIFT_BAND` was chosen to avoid. That ring cost a test failure before it cost a picture.)
 *
 * What the stop buys is visible in the RADII, which is the second scoping term §7 asked for and
 * the reason none had to be typed: the kept loops lie on the vessel's outer profile, which rises
 * monotonically into its lit wall (mug 0.2720 → 0.2813 → 0.2896 → 0.2963 → 0.3005; cup 0.2440 →
 * 0.2605 → 0.2667 → 0.2706). The crushed sets ABOVE the stop do not: the mug's next is a loop at
 * r 0.2500 — inside its own wall — and the one after is a DISC spanning r 0.0000..0.2050, the
 * interior floor you look straight down into. The pen cup's is the same disc at r 0.0000..0.1700.
 * Those are exactly the vertices §7 warned about, and the walk never reaches them.
 *
 * THE DONUT IS ACQUITTED STRUCTURALLY, not on a band. It has the family's contact darkness (its
 * bottom two rings are 225 crushed vertices of 234), but it is the one seated wiggler that does not
 * ROCK: its verb is `squashBlock`, `transformed.y = pivotY + (transformed.y - pivotY) * (1 - w)`,
 * about a pivot whose y IS the seat plane. So its bottom ring's height is invariant under its own
 * motion — bit-exactly, since the factor multiplies zero — and every vertex above it moves DOWN.
 * A squash cannot raise a crushed vertex above the pad; it can only press it harder into it. The
 * donut needs no region for the same kind of reason the watering can needs no exclusion, and the
 * capture round carries it as a second control.
 */
export const SEAT_BAND_TOP: Readonly<Record<string, number>> = {
  mug: 1.303734,
  pencup: 1.303685,
}

/**
 * THE FOUR SEAT BANDS — each one its own nudge box, capped at its own derived ceiling.
 *
 * No bound here is typed: the xz extent and the floor are `DESK_NUDGE_ZONES`' own box, so the
 * region an object's colour is fixed in is BY CONSTRUCTION the box its motion is selected by and a
 * re-measure cannot move the two apart; the ceiling is the walk above. What IS measured is the
 * albedo — the mean over the vertices above luminance 0.35, taken from the region's own vertices
 * where it has a lit family and borrowed from the body above it where it does not (`albedoAbove`).
 */
const SEAT_CEILINGS: Readonly<Record<string, number>> = { ...FIGURINE_FOOT_TOP, ...SEAT_BAND_TOP }

const SEAT_ALBEDOS: Readonly<Record<string, readonly [number, number, number]>> = {
  /** The bluebird's own blue, over the 258 lit vertices above its ceiling — b/g 1.273, r/g 0.765. */
  bird: [0.354, 0.4627, 0.5892],
  /** ...and the penguin's FEET, which are warm, not black: r/g 1.318, b/g 0.654 over the 219 lit
   *  vertices INSIDE its own region (see `albedoAbove`). This is the measurement that decides the
   *  look — a penguin lifted toward its own body would go white or go black, and neither is what a
   *  foot's shadowed side does over a pink pad. */
  penguin: [0.7507, 0.5695, 0.3723],
  /** The mug's ceramic, over 210 lit vertices of the wall above the band: r/g 2.015, b/g 1.188 —
   *  much the pinkest object on the desk, which is why it could not be given the pad's own tint. */
  mug: [0.7325, 0.3634, 0.4319],
  /** ...and the pen cup's, over 206: r/g 1.566, b/g 1.103. */
  pencup: [0.6599, 0.4213, 0.4648],
}

const SEAT_BANDS: readonly UndersideRegion[] = DESK_NUDGE_ZONES.filter(
  (z) => SEAT_CEILINGS[z.kind] !== undefined
).map((z) => ({
  id: `${z.kind}Base`,
  kind: 'box' as const,
  min: [z.min[0], z.min[1], z.min[2]] as const,
  max: [z.max[0], SEAT_CEILINGS[z.kind]!, z.max[2]] as const,
  albedo: SEAT_ALBEDOS[z.kind]!,
  drive: 'displacement' as const,
  // the penguin's band contains the feet it belongs to, so it reads its own colour; the other
  // three are all core and borrow from the body standing on them.
  ...(z.kind === 'penguin' ? {} : { albedoAbove: BORROWED_ALBEDO_BAND }),
}))

export const UNDERSIDE_REGIONS: readonly UndersideRegion[] = [
  { id: 'plantLeaves', kind: 'range', range: PLANT.leaves, albedo: [0.5542, 0.5494, 0.4788], drive: 'displacement' },
  { id: 'kitCase', kind: 'range', range: STATION_CASE.range, albedo: [0.7499, 0.4325, 0.5104], drive: 'displacement' },
  {
    id: 'bookCover',
    kind: 'box',
    min: [BOOK_HINGE.box.min[0], BOOK_HINGE.box.min[1], BOOK_HINGE.box.min[2]],
    max: [BOOK_HINGE.box.max[0], BOOK_HINGE.box.max[1], BOOK_HINGE.box.max[2]],
    albedo: [0.8068, 0.5772, 0.6308],
    drive: 'displacement',
  },
  {
    id: 'trayFloor',
    kind: 'range',
    range: TRAY_FLOOR_RANGE,
    albedo: [0.6559, 0.5656, 0.5667],
    drive: 'bird',
    foot: { min: [LANE_AABB.min[0], LANE_AABB.min[2]], max: [LANE_AABB.max[0], LANE_AABB.max[2]] },
  },
  ...SEAT_BANDS,
] as const

/** How wide the lane footprint's edge is. Tight: the floor either side of it is visible at rest
 *  and must not move, and the sheet's own vertex spacing is ~0.2 anyway. */
export const FOOT_SOFT = 0.05

const select = (r: UndersideRegion): string =>
  r.kind === 'range'
    ? `gl_VertexID >= ${r.range[0]} && gl_VertexID <= ${r.range[1]}`
    : `position.x >= ${f(r.min[0])} && position.x <= ${f(r.max[0])} &&
      position.y >= ${f(r.min[1])} && position.y <= ${f(r.max[1])} &&
      position.z >= ${f(r.min[2])} && position.z <= ${f(r.max[2])}`

const weight = (r: UndersideRegion): string => {
  if (r.drive === 'displacement')
    return `smoothstep( ${f(LIFT_RAMP.dispLo)}, ${f(LIFT_RAMP.dispHi)}, length( transformed - position ) )`
  const foot = r.foot!
  const cx = (foot.min[0] + foot.max[0]) / 2
  const cz = (foot.min[1] + foot.max[1]) / 2
  const hx = (foot.max[0] - foot.min[0]) / 2
  const hz = (foot.max[1] - foot.min[1]) / 2
  // uBird.x is 0 at rest and 1 while the lane is hidden — desk-glb.tsx writes nothing between.
  return `uBird.x * smoothstep( ${f(-FOOT_SOFT)}, ${f(FOOT_SOFT)}, ${f(hx)} - abs( position.x - ${f(cx)} ) )
    * smoothstep( ${f(-FOOT_SOFT)}, ${f(FOOT_SOFT)}, ${f(hz)} - abs( position.z - ${f(cz)} ) )`
}

/** The zone fold: membership of each listed rectangle, softened at its edge. */
const zoneWeight = (z: (typeof UNDERSIDE_ZONES)[number]): string => {
  const cx = (z.min[0] + z.max[0]) / 2
  const cz = (z.min[1] + z.max[1]) / 2
  const hx = (z.max[0] - z.min[0]) / 2
  const hz = (z.max[1] - z.min[1]) / 2
  return `smoothstep( ${f(-ZONE_SOFT)}, ${f(ZONE_SOFT)}, ${f(hx)} - abs( position.x - ${f(cx)} ) ) *
    smoothstep( ${f(-ZONE_SOFT)}, ${f(ZONE_SOFT)}, ${f(hz)} - abs( position.z - ${f(cz)} ) )`
}

/**
 * THE VERTEX HALF. Runs AFTER every motion block in this material — `desk-glb.tsx` inserts it
 * before `#include <project_vertex>`, which is downstream of `begin_vertex` and therefore of
 * STATION, BIRD, BOOK, WATER and the nudge body alike. `transformed` there holds the fully moved
 * position while `position` still holds the rest attribute, so the difference is exactly how far
 * this motion has moved this vertex.
 *
 * `.x` is the lift's weight (region times ramp); `.yzw` is the bounce this vertex stands over,
 * folded over the whole zone table at its REST xz. Resolving the colour here rather than in the
 * fragment is what keeps the table a TABLE — a second family costs one more fold line and no new
 * varying — and it is also where the soft edge belongs, since the fold is per-vertex.
 */
export const UNDERSIDE_VERTEX_DECL = 'varying vec4 vUnderLift;'
export const UNDERSIDE_VERTEX_BODY = `vUnderLift = vec4( 0.0, 0.0, 0.0, 0.0 );
vec3 udS = ${v3(UNDERSIDE_DEFAULT as readonly [number, number, number])};
${UNDERSIDE_ZONES.map(
  (z) => `udS = mix( udS, ${v3(z.surface as readonly [number, number, number])}, clamp(
  ${zoneWeight(z)}, 0.0, 1.0 ) );`
).join('\n')}
${UNDERSIDE_REGIONS.map(
  (r) => `if ( ${select(r)} ) {
  vUnderLift.x = clamp( ${weight(r)}, 0.0, 1.0 );
  vUnderLift.yzw = udS * ${v3(r.albedo)} * ${f(UNDERSIDE_BOUNCE)};
}`
).join('\n')}`

/**
 * THE FRAGMENT HALF. The band is applied to the FINAL mixed lit/dim colour — the same value the
 * rest pixel-diff gate sees — and the whole term is scaled by `uLights` so the lift cannot reach
 * the dark end of the pull-back, where the dim bake is under the band everywhere and lifting it
 * would repaint an unlit desk.
 */
export const UNDERSIDE_FRAGMENT_DECL = 'varying vec4 vUnderLift;'
export const UNDERSIDE_FRAGMENT_BODY = `if ( vUnderLift.x != 0.0 ) {
  float udL = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  float udB = 1.0 - smoothstep( ${f(LIFT_BAND.lumLo)}, ${f(LIFT_BAND.lumHi)}, udL );
  diffuseColor.rgb = mix( diffuseColor.rgb, vUnderLift.yzw, vUnderLift.x * udB * ${f(LIFT_K)} * uLights );
}`

/**
 * ============================================================================
 * T104e — THE THIRD FAMILY: THE BLACK IS NOT ON THE OBJECT AT ALL. IT IS ON THE DESK.
 * ============================================================================
 * T104d took the penguin's crest apart term by term and found the fix above working at full
 * strength on the geometry it selects — and then found that NOT ONE near-black pixel in the
 * penguin's crop, at any tilt from 4° to the re-poke cap, belongs to that geometry. Hiding
 * `DeskBaked` at the frozen crest leaves a hard, foot-shaped black patch standing on the bare
 * desk; hiding `DeskSurface` instead takes the whole band away. The black Aram named is drawn by
 * the pad.
 *
 * WHAT THE PATCH IS, SETTLED (`scratchpad/t104/probe-pad.mjs`). It is texels of `t71_atlas_lit`.
 * The file already said so and nobody followed it through: WHAT THE UNDERSIDES ARE LIFTED TOWARD,
 * above, records that "the atlas is a Cycles bake of the desk WITH its props standing on it, so
 * the cover under a mug is fully occluded". Fully occluded means BLACK, and it is: rasterising
 * the pad's top plane top-down through its own uv map produces a photograph of the pink pad with
 * every prop's contact patch on it as a hard black silhouette inside a soft ambient halo.
 *
 * T104d could not confirm this because its atlas probe read a smooth 0.61–0.63 with no shadow in
 * it, and it blamed the covering-triangle test. The covering triangle was fine. THE V AXIS WAS
 * FLIPPED: glTF puts the uv origin at the image's TOP-left (three loads these with
 * `flipY = false`), the probe sampled `1 − v`, and the pad's island happens to sit in the mirror
 * position of the SLAB's — so it read the desk's clean white top and reported no shadow, twice,
 * consistently. The solve is now checked against a landmark before it is believed: the open pad's
 * mean comes back [0.8064, 0.6840, 0.7111] against the `PAD_SURFACE` [0.8207, 0.7025, 0.7290]
 * this file measured years earlier by a different route, chroma r/g 1.179 against 1.168.
 *
 * THE MECHANISM. At rest the prop's own base covers its patch almost exactly, so what shows is a
 * thin dark contact line and it looks RIGHT — that line is the seat, and it is doing real work.
 * The weeble lifts the whole figurine by `baseR · angle` and tilts it about its base pivot, the
 * base moves off its own patch, and the uncovered patch is what appears: a black band that grows
 * with the tilt and shrinks back as the wobble decays. The patch is STATIC. The wobble does not
 * create it; it merely stops hiding it. That is exactly `trayFloor`'s defect above — a black
 * baked under something that later moves — on a different surface with a different driver, which
 * is why it takes the same shape of clause and not a new idea.
 *
 * ============================================================================
 * WHY THIS ONE CANNOT BE A VERTEX REGION, WHICH IS WHAT MAKES IT A NEW DRIVE KIND
 * ============================================================================
 * Every region above selects VERTICES and resolves its weight in the vertex half. `DeskSurface`
 * cannot: its pad top carries no interior vertices at all. It is a 76-vertex rounded-rectangle
 * boundary loop, fan-triangulated, so the whole footprint of both figurines lies inside ONE
 * triangle and a per-vertex weight would smear across the entire pad. The patch is a TEXEL
 * region, and the only place a texel region can be selected is the fragment half.
 *
 * The surface already has a clause of exactly that shape and this one is built on it: the can's
 * seat (`SURFACE_SHADOW_FRAGMENT_BODY` in desk-water-look.ts) is a footprint mask in world xz,
 * scaled by its own driver, applied to the final colour. This clause shares that clause's
 * `vSurfXZ` varying rather than declaring a second copy of the same fact — `desk-glb.tsx` inserts
 * the two together and `desk-underside.test.ts` holds the pairing so the coupling cannot drift.
 *
 * ============================================================================
 * THE WEIGHT RIDES THE DRIVE, NOT THE FOOTPRINT — THE CLAUSE'S WHOLE SAFETY ARGUMENT
 * ============================================================================
 * The patch is not a defect at rest. At rest it IS the contact shadow, it is covered by the base
 * that cast it, and the sliver that shows is what seats the prop on the pad. So a clause scoped by
 * the footprint alone would repaint a seat that was never broken. Three terms, in order:
 *
 *   THE DRIVE, PER FRAGMENT. How far this prop has lifted the pad point under THIS fragment:
 *   Rodrigues to first order about the zone's own pivot plus the edge-rock lift the motion already
 *   applies, `dy = angle · ( baseR + (axis × d).y )` with `d` the fragment's horizontal offset
 *   from the pivot — the same arithmetic `rockBlock` moves the prop with, read off the same
 *   uniform, so the lift and the motion cannot disagree. Reading it per fragment is what makes the
 *   result a CRESCENT on the side that rose: on the side the base dug down, `dy` is negative and
 *   the term clamps to zero, so the half of the patch that is pressed harder into the pad is not
 *   touched at all. It is then ramped by `LIFT_RAMP`, this file's own ramp, unchanged.
 *
 *   REST IS STRUCTURAL, twice over. `uNudge_<kind>.w` is written as an exact +0 by `sampleRock`
 *   the moment the envelope falls under `REST_EPS`, and the clause is behind `!= 0.0` exactly as
 *   `rockBlock` is — so at rest no fragment enters the block and `DeskSurface` is bit-identical by
 *   construction, not by a threshold. And inside the block `dy` is `angle × …`, so it is +0 too.
 *
 *   THE BAND DOES THE SHAPING, and it is why the halo is safe. `LIFT_BAND` is inherited unchanged
 *   and it lands on a histogram it was measured for: the penguin's patch is 428 texels under the
 *   band's ceiling of which 415 are under `lumLo`, while the soft halo AROUND it reads luminance
 *   0.58 at two texels out, rising to 0.65 at 0.2 world units. The halo is a factor of two above
 *   `lumHi`, so `1 − smoothstep(lumLo, lumHi, lum)` is EXACTLY zero on it and the ambient
 *   occlusion that makes the prop sit on the pad is untouchable by this clause at any tilt.
 *
 * WHAT IT LIFTS TOWARD — READ FROM THE PAD ITSELF, not from `PAD_SURFACE`. The obvious target is
 * the pad's own open colour and it is WRONG by measurement: the uncovered texel is still deep
 * under the prop's body, and taking it to the open pad's 0.720 luminance while its own neighbours
 * sit at 0.580 would swap a black hole for a bright one. So the target is the tone the pad
 * actually carries immediately outside the patch — the honest answer to "what should this texel
 * be", since a texel's neighbours are what it is being read against. It is not a knife-edge: the
 * penguin's ring reads luminance 0.580 / 0.588 / 0.598 at 0.02 / 0.05 / 0.08 world units out. It
 * is also not reconstructible from `PAD_SURFACE` times any scalar — the ring runs r/g 1.288
 * against the open pad's 1.168, because it carries the warm bounce of the penguin's own feet
 * (albedo r/g 1.318, measured above). `LIFT_K` is inherited, so a fully crushed texel lands 82%
 * of the way to its neighbours and stays a little darker than them, which is what the deepest part
 * of a contact shadow should do.
 *
 * ============================================================================
 * THE CENSUS — WHICH PROPS GET A ROW, AND WHY THE OTHERS DO NOT
 * ============================================================================
 * All five nudge props stand on a patch; `scratchpad/t104/probe-final.mjs` measures every one.
 * Standing on one is not the test — SHOWING one is, and the test is run at each prop's own frozen
 * crest (see `SURFACE_PATCHES` for the per-prop verdicts and their evidence).
 *
 * THE DONUT IS EXCLUDED STRUCTURALLY, for the same reason it needs no seat band above: its verb is
 * `squashBlock` about a pivot whose y IS the seat plane, so every point of it moves DOWN or stays.
 * A squash cannot uncover a patch; there is no tilt for `dy` to be positive under. Its 1,102-texel
 * patch is real and permanently hidden.
 */

/**
 * A surface patch: a prop's contact silhouette in the pad's own atlas, and the nudge that uncovers
 * it. Every number is a measurement from `scratchpad/t104/probe-final.mjs` against the shipped
 * `desk.glb` — the patch's extent is flood-filled from the prop's nudge box using `LIFT_BAND`'s
 * own `lumLo` as the definition of "a hole", and the target is the ring two texels outside it.
 */
export type SurfacePatch = {
  /** The nudge zone whose uniform drives it — also the uniform's name suffix. */
  readonly kind: DeskNudgeKind
  /** The patch's measured centre and half-extent in world xz. */
  readonly centre: readonly [number, number]
  readonly half: readonly [number, number]
  /** What the pad reads immediately outside it, linear rgb. */
  readonly target: readonly [number, number, number]
}

/**
 * THE PATCHES THAT SHOW. One row per prop whose patch was proven visible at its own frozen crest;
 * the verdicts, with their numbers, are in `.superpowers/sdd/task-104e-report.md`.
 *
 * The extents are the PATCH's own, not the nudge box's, and that is deliberate: the thing being
 * selected here is a region of a bake, so the honest scope is where that region measurably is.
 * Every prop's patch does sit inside its nudge box (checked, with 0.10–0.34 world units of margin
 * on the three that ship a row), but the boxes are looser than the patches and the mug's box in
 * particular reaches 148 dark texels that are NOT its patch — its neighbour the donut's, which
 * must not brighten when the mug rocks. Scoping to the measured patch drops those from 148 to the
 * handful in the patch's own antialiased rim.
 */
export const SURFACE_PATCHES: readonly SurfacePatch[] = [
  /** The one Aram named. 415 texels under `lumLo` of 428 under the band's ceiling, shaped like two
   *  feet with the notch between them, and 60 of the 65 near-black pixels in his crop at the
   *  re-poke cap (T104d §5/§6, by removal). Ring r/g 1.288 — the penguin's own warm bounce. */
  { kind: 'penguin', centre: [0.8234, 9.5361], half: [0.1379, 0.1214], target: [0.701, 0.5442, 0.5719] },
  /** 2,013 texels, the widest core on the pad and the one T102 already named when it wrote that
   *  "the cover under a mug is fully occluded". Ring 0.540 — the mug sits in its own deeper well. */
  { kind: 'mug', centre: [-2.5921, 11.3099], half: [0.2704, 0.2704], target: [0.6797, 0.4996, 0.5318] },
  /** The "other items as well". 479 texels, and its ring is the darkest of the three at 0.400,
   *  which is why its lift is the smallest even where it fires. */
  { kind: 'bird', centre: [-0.9145, 9.5026], half: [0.1159, 0.149], target: [0.4828, 0.3719, 0.4413] },
]

/** How wide the patch mask's edge is, world units — `FOOT_SOFT`, for the same reason the lane
 *  footprint uses it: the pad either side of a patch is visible at rest and must not move. The
 *  band is what shapes the patch; this edge only has to not cut it. */
export const PATCH_SOFT = FOOT_SOFT

/**
 * THE SURFACE HALF. Fragment-side, because the patch is a texel region (see the T104e header), and
 * inserted after the can's seat so both read the same `vSurfXZ`. It declares only its uniforms:
 * `uLights` and `vSurfXZ` are already in scope from the surface material's own preamble.
 */
export const SURFACE_PATCH_FRAGMENT_DECL = SURFACE_PATCHES.map(
  (p) => `uniform vec4 uNudge_${p.kind};`
).join('\n')

const patchClause = (p: SurfacePatch): string => {
  const z = DESK_NUDGE_ZONES.find((n) => n.kind === p.kind)!
  return `if ( uNudge_${p.kind}.w != 0.0 ) {
  vec2 spD = vSurfXZ - vec2( ${f(z.pivot[0])}, ${f(z.pivot[2])} );
  float spY = uNudge_${p.kind}.w * ( ${f(z.baseR)}
    + uNudge_${p.kind}.z * spD.x - uNudge_${p.kind}.x * spD.y );
  vec2 spM = vSurfXZ - vec2( ${f(p.centre[0])}, ${f(p.centre[1])} );
  float spW = smoothstep( ${f(LIFT_RAMP.dispLo)}, ${f(LIFT_RAMP.dispHi)}, spY )
    * smoothstep( ${f(-PATCH_SOFT)}, ${f(PATCH_SOFT)}, ${f(p.half[0])} - abs( spM.x ) )
    * smoothstep( ${f(-PATCH_SOFT)}, ${f(PATCH_SOFT)}, ${f(p.half[1])} - abs( spM.y ) );
  if ( spW > 0.0 ) {
    float spL = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
    float spB = 1.0 - smoothstep( ${f(LIFT_BAND.lumLo)}, ${f(LIFT_BAND.lumHi)}, spL );
    diffuseColor.rgb = mix( diffuseColor.rgb, ${v3(p.target)}, spW * spB * ${f(LIFT_K)} * uLights );
  }
}`
}

export const SURFACE_PATCH_FRAGMENT_BODY = SURFACE_PATCHES.map(patchClause).join('\n')

/** Every target the shader can resolve — region albedo times zone surface times the bounce — for
 *  the tests and for anyone reading numbers rather than GLSL. */
export const UNDERSIDE_TARGETS: Record<string, { pad: readonly number[]; table: readonly number[] }> =
  Object.fromEntries(
    UNDERSIDE_REGIONS.map((r) => [
      r.id,
      {
        pad: target(r.albedo as readonly [number, number, number], PAD_SURFACE),
        table: target(r.albedo as readonly [number, number, number], TABLE_SURFACE),
      },
    ])
  )
