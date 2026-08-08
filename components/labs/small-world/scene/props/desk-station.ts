import {
  AMP_CAP,
  NOTE_CORNER_ZONE,
  hitPadFor,
  rayBoxHit,
  restingSpring,
  sampleAxis,
  type NudgeSpring,
} from './desk-nudge'
import { DESK_NUDGE_ZONES } from './desk-glb-contract'
import { PENCUP_PENS } from './desk-pens'
import { PLANT_CLAIM, laneRayHit } from './desk-deep'
import { globeRayHit } from '../globe-nudge'

/**
 * THE SCULPTING STATION'S FIVE VOICES (T97 fixes S2+S3) — the pure module: every table, closed
 * form and shader chunk the station's interactions are made of, and none of the three.js or React
 * they reach the screen through. `desk-interactions.tsx` is the plumbing; `desk-station.test.ts`
 * drives THIS module without a canvas and re-derives every measurement below from the shipped GLB.
 *
 * ============================================================================
 * THE FINDING (blind review S2/S3), AND THE VARIETY LAW
 * ============================================================================
 * The station's corner — five clay bars in a white tray, a mint tree, a pink kit case with a
 * sample-chip row, a carving knife, eleven loose chips — was a FALSE AFFORDANCE: everything inert
 * while the set-piece roll lived on one visually anonymous pale-blue bar the reviewer found only
 * by cursor sweep. Among near-identical chips exactly one thing responded, which reads as an
 * accident, not an invitation. The fix is five DISTINCT micro-answers — the variety law: different
 * MECHANISMS, not five clones — so the roll trigger becomes discoverable because its siblings
 * answer around it (plus its own hover shiver):
 *
 *  1. BARS — SCOOT-AND-SETTLE: a body TRANSLATION along the slot, the only thing on the desk that
 *     translates as a body; one overshoot, exact re-seat.
 *  2. TREE — SAPLING SWAY: the only SUSTAINED OSCILLATION, two detuned axes circling out.
 *  3. KNIFE — SEE-SAW TEETER: the only SIGNED ALTERNATION about a fixed axis; the tapped end dips.
 *  4. CASE — CORNER POP: a PULSE, not a spring — the one upward flex, and it never rings.
 *  5. CHIPS — PRESS-DIMPLE: a downward SQUASH pulse — the donut jiggles, the chip just yields.
 *
 * Every T89 law applies unchanged (see desk-nudge.ts): pointer-initiated, closed forms of the
 * trigger sequence on the armed clock, EXACT +0 rest under an epsilon, exact-zero shader guards
 * (the rest path is the untouched path, so a pointerless scrub is bit-identical), reduced-motion
 * inert, disarm resets in-frame, hover crossing = brush at HOVER_SCALE, click = full.
 *
 * ============================================================================
 * WHY SELECTION IS BY gl_VertexID RANGE, NOT BY BOX
 * ============================================================================
 * The six bars lie in parallel DIAGONAL tray slots: every bar's AABB overlaps its neighbours'
 * (the red bar's box crosses the lane's), and any box that contains one bar passes through the
 * tray's floor sheet — the LANE precedent from T92's bird swap, measured then and re-measured
 * now. The chips are the same story one size down. What IS exact is the accessor order: the T81
 * join wrote each object contiguously, so every station object is one contiguous `gl_VertexID`
 * run, and an index-range select cannot tear a neighbour BY CONSTRUCTION. The ray zones below DO
 * use AABBs — a ray claim may be generous where a vertex select may not — grown to the 44 px
 * floor by the pick's existing `hitPadFor`.
 *
 * ============================================================================
 * AMPLITUDES (the T89 lesson: slower and deeper beats fast and tiny)
 * ============================================================================
 * The station projects at ~225 px/world at the 1440x900 money shot, so:
 *  - bar scoot crest 0.035 ≈ 8 px along the slot, PLUS the shuffle hop 0.5·|offset| ≈ 4 px of
 *    whole-silhouette rise at the crest — the capture round measured the translation alone as
 *    nearly invisible, because sliding a self-similar uniform-colour tube along its own axis
 *    changes pixels only at its two end caps; the hop moves the entire silhouette;
 *  - tree tip 0.10 ≈ 22 px at the crown, ~10 px at mid-crown under the LINEAR height weight
 *    (the first cut squared the weight and measured ~2–3 px at mid-crown — illegible);
 *  - knife tip dip halfLen·sin(4.5°) = 0.056 ≈ 12.5 px, clatter hop 0.0195 ≈ 4.4 px;
 *  - case corner 0.07: ~15 px of lift over a ~65 px corner disc once the field is anchored to
 *    the REAL corner vertex (see the clearance section — the AABB-corner field was near-silent);
 *  - chip squash 0.5·h on chips 0.066–0.147 tall = 0.033–0.071 ≈ 7–16 px of flatten.
 *
 * ============================================================================
 * SLACK AND CLEARANCE (why the numbers cannot collide)
 * ============================================================================
 *  - BAR TRAVEL: along-slot slack between every bar and the tray's inner floor sheet is ≥ 0.0682
 *    in the tightest direction (tan, +). The scoot's travel is HARD-CAPPED at 0.05 — slack minus
 *    margin — and the test gates slack ≥ cap + 0.015 for every bar in both directions, so no
 *    pile-up of re-pokes can push a bar into the tray wall.
 *  - CASE FIELD: the corner flex weight is (1 − smoothstep(0, 0.30, d))², EXACTLY zero at d ≥
 *    0.30, measured from the case's real free corner — its min-x VERTEX (1.5208, 8.7618), NOT
 *    the AABB corner (1.5208, 8.3157) the first two cuts used. The case is a ROTATED body, so
 *    its AABB corner is AIR: the nearest actual case vertex sat 0.3766 away and the field was
 *    tiny at every vertex that exists (the pop measured near-silent on the composed frame) —
 *    the same lesson as the pick claims, one layer down. From the real corner the re-derived
 *    clearances are paper1 0.3392, paper2 0.5634, inner sheet 0.6908, chip row 0.7358, tray
 *    1.0878 — all outside 0.30, so they are structurally still (gated).
 *  - KNIFE HOP: at the 4.5° crest the dipping tip sinks 0.71·sin(4.5°) = 0.056 below its seat;
 *    the clatter hop lifts BOTH meshes by 0.35·halfLen·|sin θ| = 0.0195 at crest, hiding ~35% of
 *    the dip — split the difference, because the pad is soft clay and a see-saw that never
 *    presses in reads as floating while one that buries its tip reads as broken.
 *
 * ============================================================================
 * THE PICK LAYER IS PRIMITIVES, NOT BOXES (T97 round 3 — measured, structural)
 * ============================================================================
 * Three capture rounds proved every remaining click steal was BOX AIR under the ending's
 * grazing eye: the knife's padded roof (y 1.471 = its 1.3909 top + the 44 px pad inflating the
 * THIN axis of a flat object, buying zero screen target) ate bar clicks; the tan bar's padded
 * roof ate a chip; pen-box air at y 2.05–2.66 ate chips and the green bar; and before that the
 * pen cup's tall box and the tree's tall box shadowed whole regions. An AABB is the wrong claim
 * shape for a thin or diagonal object seen at grazing incidence, structurally — so the station's
 * claims are now the objects' OWN primitives (`resolveDeskPick`):
 *  - BARS: capsules along SLOT_DIR through each centroid at y 1.371 (max vert-to-axis measured
 *    0.094–0.098 → r 0.10);
 *  - CHIPS: spheres at each chip's centre (r = half its max extent + 0.02, grown to the 44 px
 *    floor at depth — the phone tap floor survives);
 *  - KNIFE: ONE capsule down the handle+blade line (fitted max vert-to-segment 0.0665 → r 0.10);
 *  - TREE: a vertical capsule up the crown (max xz reach 0.1858 → r 0.20);
 *  - PENS: five fitted capsules (max vert-to-segment 0.1026 → r 0.13); CUP BODY: the cylinder;
 *  - CASE: keeps its box — it IS a box — z-capped at 9.55 (the lane begins at 9.6367) and
 *    x-capped at 2.79 (blue2 begins at 2.7946), the round-1 measurements;
 *  - T89 chunky props and the note stay boxes: they never stole.
 * AND the resolution rule the sweep forced: padding buys a FLOOR TARGET, never priority — a
 * claim hit only inside its 44 px-grown skin yields to any true-surface hit (nearest-t breaks
 * ties within a class). Without it a grown chip sphere shadows the chip behind it: the pink
 * chips sit 0.147 apart along the ending's sight line and both project under 30 px, so their
 * floor-grown claims MUST overlap; the surface rule is what keeps both clickable.
 * The decisive gate lives in desk-station.test.ts: rays from the SETTLED ENDING EYE through
 * every station target's own visible point must resolve to that target.
 */

// --- the measured station (re-derived from the shipped bytes by desk-station.test.ts) ----------

const unit2 = (x: number, z: number): readonly [number, number, number] => {
  const m = Math.hypot(x, z)
  return [x / m, 0, z / m] as const
}

/** The tray's shared slot axis — per-bar PCA agrees with it to < 1° (gated). */
export const SLOT_DIR = unit2(0.9427, -0.3335)

export type StationAabb = {
  readonly min: readonly [number, number, number]
  readonly max: readonly [number, number, number]
}

export type StationBar = {
  readonly id: string
  /** Inclusive `gl_VertexID` run in DeskBaked — one whole connected component. */
  readonly range: readonly [number, number]
  /** Centroid, xz — the scoot direction's reference point. */
  readonly centre: readonly [number, number]
  readonly aabb: StationAabb
}

/** The six bars, lane first. The LANE's click belongs to the deep tier (the roll); its hover
 *  scoots like every sibling — that shiver is the roll's advertisement. */
export const STATION_BARS: readonly StationBar[] = [
  {
    id: 'lane',
    range: [29107, 29536],
    centre: [2.2434, 9.7988],
    aabb: { min: [1.8015, 1.3031, 9.6367], max: [2.5661, 1.4375, 10.0016] },
  },
  {
    id: 'tan',
    range: [27962, 28530],
    centre: [2.6913, 10.016],
    aabb: { min: [1.9187, 1.3017, 9.6953], max: [3.4618, 1.4387, 10.3335] },
  },
  {
    id: 'yellow',
    range: [28531, 29106],
    centre: [2.8123, 10.3496],
    aabb: { min: [2.0429, 1.3017, 10.0399], max: [3.5753, 1.4375, 10.6634] },
  },
  {
    id: 'cream',
    range: [29537, 30107],
    centre: [2.7505, 10.1833],
    aabb: { min: [1.9833, 1.3031, 9.8698], max: [3.5199, 1.4397, 10.4965] },
  },
  {
    id: 'green',
    range: [30108, 30520],
    centre: [3.2121, 10.3902],
    aabb: { min: [2.9273, 1.307, 10.2018], max: [3.6361, 1.4399, 10.5517] },
  },
  {
    id: 'red',
    range: [30521, 31024],
    centre: [2.4884, 9.9015],
    aabb: { min: [1.8671, 1.3024, 9.6852], max: [2.9749, 1.4397, 10.166] },
  },
] as const

/** Index of the roll trigger inside STATION_BARS — the one bar whose CLICK is not ours. */
export const LANE_BAR_INDEX = 0

/** The tray's inner floor sheet — the slack measurement's other half. */
export const TRAY_FLOOR_RANGE = [31025, 31271] as const

export type StationChip = {
  readonly id: string
  readonly range: readonly [number, number]
  readonly centre: readonly [number, number]
  /** The chip's own seat (component min y) — what the press squashes toward. */
  readonly seat: number
  readonly aabb: StationAabb
}

/** The eleven loose chips that answer. The six flat sample discs in the case's row are 0.0075
 *  thick — sub-pixel — and belong to the case's claim, not to the press. */
export const STATION_CHIPS: readonly StationChip[] = [
  { id: 'darkBrown', range: [32616, 32850], centre: [3.4308, 9.7367], seat: 1.3013, aabb: { min: [3.3754, 1.3013, 9.6882], max: [3.483, 1.3676, 9.7868] } },
  { id: 'blue1', range: [32851, 33100], centre: [2.6847, 9.6514], seat: 1.2963, aabb: { min: [2.6166, 1.2963, 9.5864], max: [2.7566, 1.3988, 9.7167] } },
  { id: 'blue2', range: [33101, 33366], centre: [2.8797, 9.5555], seat: 1.2914, aabb: { min: [2.7946, 1.2914, 9.4757], max: [2.9654, 1.4327, 9.6332] } },
  { id: 'blue3', range: [33367, 33599], centre: [3.105, 9.4888], seat: 1.2963, aabb: { min: [3.0419, 1.2963, 9.4295], max: [3.1657, 1.3786, 9.5468] } },
  { id: 'blue4', range: [33600, 33831], centre: [3.2767, 9.3939], seat: 1.2966, aabb: { min: [3.2309, 1.2966, 9.3427], max: [3.3245, 1.363, 9.4486] } },
  { id: 'darkGreen', range: [33832, 34067], centre: [3.4739, 10.1893], seat: 1.29, aabb: { min: [3.4152, 1.29, 10.1319], max: [3.5344, 1.3738, 10.2492] } },
  { id: 'pink1', range: [34068, 34334], centre: [3.0673, 9.7193], seat: 1.2946, aabb: { min: [2.99, 1.2946, 9.6485], max: [3.1392, 1.3995, 9.7906] } },
  { id: 'pink2', range: [34335, 34616], centre: [3.2366, 9.6354], seat: 1.2866, aabb: { min: [3.1506, 1.2866, 9.546], max: [3.3194, 1.4234, 9.7129] } },
  { id: 'orangeOff', range: [34617, 34866], centre: [3.9578, 10.3881], seat: 1.2611, aabb: { min: [3.885, 1.2611, 10.319], max: [4.0364, 1.3792, 10.4652] } },
  { id: 'blueOff', range: [34867, 35144], centre: [3.9263, 9.9974], seat: 1.255, aabb: { min: [3.8103, 1.255, 9.8874], max: [4.0496, 1.4351, 10.1038] } },
  { id: 'pinkOff', range: [35145, 35406], centre: [3.7796, 10.2845], seat: 1.2539, aabb: { min: [3.6811, 1.2539, 10.1897], max: [3.8776, 1.4106, 10.3755] } },
] as const

/** The mint tree: the pot stays still; only the foliage run bends. */
export const STATION_TREE = {
  potRange: [38377, 38786],
  foliageRange: [38787, 40009],
  /** The bend ramp: weight (y − y0)/(yTop − y0), clamped — zero at the pot rim, LINEAR up the
   *  crown: a small-angle bend about the base moves material in proportion to height to first
   *  order, and the first cut's squared weight starved the crown's mass (measured ~2–3 px at
   *  mid-crown, illegible). */
  bendY0: 1.45,
  bendYTop: 1.99,
  /** The rosette-like base centre (foliage centroid, xz) — the sway direction's reference. */
  base: [2.3833, 10.7094],
} as const

/** The carving knife: baked handle by id-range, metal blade by padded-AABB box select (the only
 *  DeskMetal component in that neighbourhood — gated by the test). */
export const STATION_KNIFE = {
  handleRange: [40010, 40390],
  bladeAabb: { min: [1.4569, 1.3198, 11.6688], max: [1.7771, 1.3742, 11.9386] } as StationAabb,
  /** How far the blade box grows before the shader selects by it. */
  bladePad: 0.05,
  assemblyAabb: { min: [1.4569, 1.3031, 11.0354], max: [2.5506, 1.3909, 11.9386] } as StationAabb,
  pivot: [2.0037, 1.3031, 11.487],
  longDir: unit2(0.7711, -0.6368),
  /** Horizontal perpendicular to longDir — the fixed see-saw axis. */
  axis: unit2(0.6368, 0.7711),
  halfLen: 0.71,
  /** The clatter hop's share of the crest dip — see the header's split-the-difference note. */
  hopK: 0.35,
} as const

/** The kit case: three id-closed components shipped contiguously (inner sheet + lid sheet +
 *  body) — the range is what the shader selects; the corner field is what moves. */
export const STATION_CASE = {
  range: [35407, 37214],
  /** The free corner: the case's min-x VERTEX, xz — a REAL point on the rotated body, not its
   *  AABB corner (which is air 0.3766 from the nearest vertex; anchored there the pop measured
   *  near-silent because the field had decayed before reaching any vertex that exists). The
   *  test re-derives it as the vertex attaining the component run's min x. */
  corner: [1.5208, 8.7618],
  /** The flex radius — the field is EXACTLY zero at and beyond it. 0.30 sits under the nearest
   *  structural neighbour from the REAL corner (paper1 at 0.3392, gated). */
  radius: 0.3,
  /** The case's own bottom and lid-top heights (measured: body min y / lid sheet y) — the peel
   *  weight's ramp, zero at the seated base, one at the lid. */
  baseY: 1.2949,
  lidY: 1.3327,
} as const

// --- the ray claims (pick layer; primitives, not boxes — see the header) -----------------------

export type StationKind = 'bar' | 'chip' | 'tree' | 'knife' | 'case'

export type StationClaim =
  | {
      readonly kind: 'bar' | 'tree' | 'knife'
      readonly index: number
      readonly shape: 'capsule'
      readonly a: readonly [number, number, number]
      readonly b: readonly [number, number, number]
      readonly r: number
    }
  | {
      readonly kind: 'chip'
      readonly index: number
      readonly shape: 'sphere'
      readonly c: readonly [number, number, number]
      /** True-surface radius: half the chip's max extent + 0.02. The pick grows it to the
       *  44 px floor at depth, but the grown skin is a FLOOR TARGET, not priority — see
       *  `resolveDeskPick`. */
      readonly r: number
    }
  | {
      readonly kind: 'case'
      readonly index: number
      readonly shape: 'box'
      readonly min: readonly [number, number, number]
      readonly max: readonly [number, number, number]
    }

/** The bar capsules' shared numbers: axis height = the bars' common centroid height; r covers
 *  the measured max vert-to-axis (0.094–0.098) with slack; halfLens are the re-derived
 *  along-slot half-extents, in STATION_BARS order. */
export const BAR_CLAIM = {
  axisY: 1.371,
  r: 0.1,
  halfLens: [0.394, 0.805, 0.799, 0.802, 0.368, 0.578],
} as const

/** Chip sphere slack over the half-extent. */
export const CHIP_CLAIM_PAD = 0.02

/** One capsule down the whole knife (handle + blade line; fitted max vert-to-segment 0.0665). */
export const KNIFE_CLAIM = {
  a: [1.5083, 1.347, 11.8964],
  b: [2.5038, 1.347, 11.0788],
  r: 0.1,
} as const

/** The crown as a vertical capsule; the pot is inert and claims nothing. The segment tops out
 *  at 1.80, NOT the crown's 1.99: the cap sphere then TAPERS the claim exactly the way the real
 *  foliage tapers (banded reach 0.186 low, 0.094 at 1.85–1.92, 0.057 above — the cap gives
 *  0.173/0.132/0.089 at those heights), and the whole crown still fits (max vert-to-segment
 *  0.1908 ≤ r, gated). A flat-topped capsule to 1.95 was tip AIR: it claimed 0.16 off-axis at
 *  y 2.09 and ate the blue1 chip's sightline behind the crown (sweep-measured). */
export const TREE_CLAIM = {
  a: [2.3833, 1.45, 10.7094],
  b: [2.3833, 1.8, 10.7094],
  r: 0.2,
} as const

/** The case IS a box, so its claim stays one — z-capped at 9.55 (the lane begins at 9.6367)
 *  and x-capped at 2.79 (blue2 begins at 2.7946), the round-1 measurements. */
export const CASE_CLAIM = {
  min: [1.45, 1.25, 8.25],
  max: [2.79, 1.42, 9.55],
} as const

const barClaim = (index: number): StationClaim => {
  const b = STATION_BARS[index]
  const h = BAR_CLAIM.halfLens[index]
  return {
    kind: 'bar',
    index,
    shape: 'capsule',
    a: [b.centre[0] - h * SLOT_DIR[0], BAR_CLAIM.axisY, b.centre[1] - h * SLOT_DIR[2]],
    b: [b.centre[0] + h * SLOT_DIR[0], BAR_CLAIM.axisY, b.centre[1] + h * SLOT_DIR[2]],
    r: BAR_CLAIM.r,
  }
}

const chipClaim = (index: number): StationClaim => {
  const c = STATION_CHIPS[index]
  const ext = Math.max(
    c.aabb.max[0] - c.aabb.min[0],
    c.aabb.max[1] - c.aabb.min[1],
    c.aabb.max[2] - c.aabb.min[2]
  )
  return {
    kind: 'chip',
    index,
    shape: 'sphere',
    c: [c.centre[0], (c.seat + c.aabb.max[1]) / 2, c.centre[1]],
    r: ext / 2 + CHIP_CLAIM_PAD,
  }
}

/** Every station claim, in the shape the object actually has. */
export const STATION_CLAIMS: readonly StationClaim[] = [
  ...STATION_BARS.map((_, i) => barClaim(i)),
  ...STATION_CHIPS.map((_, i) => chipClaim(i)),
  { kind: 'tree', index: 0, shape: 'capsule', a: TREE_CLAIM.a, b: TREE_CLAIM.b, r: TREE_CLAIM.r },
  { kind: 'knife', index: 0, shape: 'capsule', a: KNIFE_CLAIM.a, b: KNIFE_CLAIM.b, r: KNIFE_CLAIM.r },
  { kind: 'case', index: 0, shape: 'box', min: CASE_CLAIM.min, max: CASE_CLAIM.max },
] as const

// --- the pen cup's honest claim (T97 capture round, pick layer only) ---------------------------

/**
 * WHY THE PEN CUP'S RAY CLAIM LIVES HERE AND IS NOT ITS T89 BOX. The fire-log measured the cup's
 * tall AABB (y to 2.76 over its whole footprint, nearest to the camera in that corner)
 * out-claiming the tray behind it: clicks aimed at the green bar and the right-side chips
 * crossed the box's EMPTY UPPER CORNERS first and fired 'pencup' — an AABB whose upper volume
 * is mostly air casts a claim shadow over everything behind it along the view ray. So the pick
 * claims where the object actually is: the cup body as a CYLINDER (measured max xz reach from
 * the axis is 0.310 at y ≤ 1.97, so 0.36 = real radius + pad), and the pens above the rim as
 * five slender per-pen boxes (measured per-component AABBs, padded 0.03). DESK_NUDGE_ZONES and
 * the shader select are untouched — this is about what a ray may CLAIM, never about what moves.
 */
export const PENCUP_BODY = {
  /** The cup's vertical axis, xz — the T89 pivot's own footprint centre. */
  centre: [2.875, 11.855],
  radius: 0.36,
  yMin: 1.26,
  yMax: 1.97,
} as const

/** How much of a pen's claim counts as its SURFACE: the shaft's own radius. The full claim
 *  radius 0.13 is mostly tap slack around a thin object (fitted max vert-to-segment 0.1026 is
 *  one clip vertex; the shafts run ~0.04), and the sweep proved slack must never shadow: the
 *  darkRed pen's halo at 0.1105 from its axis ate the darkBrown chip behind it. Within the
 *  core a hit is surface; between core and claim it is padded and yields to any true surface. */
export const PEN_CORE_R = 0.05

/** The five pens: id-ranges for the gate, fitted CAPSULES for the pick (round 3 — their round-2
 *  AABBs still carried air at the corners that ate chip and bar clicks under the grazing eye;
 *  banded-mean endpoints, fitted max vert-to-segment 0.1026 incl. the clips → r 0.13).
 *  MEASURED IN `desk-pens.ts` since T100 — the clatter that DISPLACES a pen needs the same
 *  per-pen identity this claim does, and a measurement with two consumers gets one owner. */
export { PENCUP_PENS }

/**
 * Ray vs a solid vertical cylinder (finite, capped): the intersection of the infinite
 * cylinder's t-interval with the y-slab's IS the capped solid, so the caps come free. Returns
 * the entry distance like `rayBoxHit` (0 when the origin is inside), or null. Pure — the
 * component feeds it the camera ray; the tests feed it fixtures.
 */
export function rayCylinderHit(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  cx: number,
  cz: number,
  radius: number,
  yMin: number,
  yMax: number
): number | null {
  let t0 = -Infinity
  let t1 = Infinity
  if (dy === 0) {
    if (oy < yMin || oy > yMax) return null
  } else {
    let a = (yMin - oy) / dy
    let b = (yMax - oy) / dy
    if (a > b) {
      const t = a
      a = b
      b = t
    }
    if (a > t0) t0 = a
    if (b < t1) t1 = b
  }
  const fx = ox - cx
  const fz = oz - cz
  const qa = dx * dx + dz * dz
  if (qa === 0) {
    if (fx * fx + fz * fz > radius * radius) return null
  } else {
    const qb = fx * dx + fz * dz
    const qc = fx * fx + fz * fz - radius * radius
    const disc = qb * qb - qa * qc
    if (disc < 0) return null
    const root = Math.sqrt(disc)
    const ta = (-qb - root) / qa
    const tb = (-qb + root) / qa
    if (ta > t0) t0 = ta
    if (tb < t1) t1 = tb
  }
  if (t0 > t1 || t1 < 0) return null
  return t0 >= 0 ? t0 : 0
}

/**
 * Ray vs capsule, as a closest-approach test: the ray (t ≥ 0) claims the segment AB's capsule of
 * radius r iff their minimum distance is within r, and the claim's t is the ray's parameter at
 * closest approach (clamped to 0). The standard clamped segment-segment closest-point solve
 * (minimise |o + t·d − (A + s·v)|² over t ≥ 0, s ∈ [0, 1]) — closed form, pure, and the right
 * primitive for every thin diagonal object a box was mis-claiming for.
 */
export function raySegmentHit(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  A: readonly [number, number, number],
  B: readonly [number, number, number],
  r: number
): number | null {
  const vx = B[0] - A[0]
  const vy = B[1] - A[1]
  const vz = B[2] - A[2]
  const wx = ox - A[0]
  const wy = oy - A[1]
  const wz = oz - A[2]
  const a = dx * dx + dy * dy + dz * dz
  const b = dx * vx + dy * vy + dz * vz
  const c = vx * vx + vy * vy + vz * vz
  const p = dx * wx + dy * wy + dz * wz
  const q = vx * wx + vy * wy + vz * wz
  const denom = a * c - b * b
  let t = denom > 1e-12 ? (b * q - c * p) / denom : 0
  if (t < 0) t = 0
  let s = c > 1e-12 ? (b * t + q) / c : 0
  if (s < 0) s = 0
  else if (s > 1) s = 1
  t = (b * s - p) / a
  if (t < 0) t = 0
  const gx = wx + t * dx - s * vx
  const gy = wy + t * dy - s * vy
  const gz = wz + t * dz - s * vz
  return gx * gx + gy * gy + gz * gz <= r * r ? t : null
}

/** Ray vs sphere at centre C: the near root of the standard quadratic, 0 when the origin is
 *  inside (the globe module's own test is hard-wired to the origin; this one is not it). */
export function raySphereHit(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  C: readonly [number, number, number],
  r: number
): number | null {
  const fx = ox - C[0]
  const fy = oy - C[1]
  const fz = oz - C[2]
  const a = dx * dx + dy * dy + dz * dz
  const b = fx * dx + fy * dy + fz * dz
  const c = fx * fx + fy * fy + fz * fz - r * r
  const disc = b * b - a * c
  if (disc < 0) return null
  const root = Math.sqrt(disc)
  const t1 = (-b + root) / a
  if (t1 < 0) return null
  const t0 = (-b - root) / a
  return t0 >= 0 ? t0 : 0
}

/**
 * THE PLANT'S CLAIM AGAINST A RAY (T102) — cylinder OR dome, nearest entry wins, in the family of
 * `canRayHit`/`bookRayHit`/`laneRayHit`: one pure question both tiers ask, so the deep tier's click
 * and the micro tier's cursor cannot disagree about whether the pointer is over the plant.
 *
 * WHY IT LIVES HERE AND NOT BESIDE ITS SIBLINGS IN `desk-deep.ts`. The two primitives it needs are
 * this module's, and this module already imports `desk-deep` (for `laneRayHit`); a claim function
 * there would have to import them back, and a cycle through a module whose top level BUILDS tables
 * (`CAPSULE_CLAIMS`, `BOX_CLAIMS`) is a temporal-dead-zone trap waiting for an import-order change.
 * The measurement stays with the plant (`PLANT_CLAIM` in `desk-deep.ts`); the ray solve sits with
 * the ray solves. Neither number nor primitive is written twice.
 *
 * The plant is NOT registered in `resolveDeskPick`, for the same reason the can and the book are
 * not: nothing on the desk answers a click with a watering except the watering, so the plant has
 * no rival to be resolved against — it is a second door onto the can's own interaction. Standing
 * outside the resolver is also what makes it harmless: it cannot outrank a station claim, and the
 * micro tier consults it only where `resolveDeskPick` already found nothing. The claim's reach
 * stops at x −3.65 and the nearest other claim on the desk is the mug's box at x −3.20, so the
 * question does not arise geometrically either (gated by the sweep in desk-station.test.ts).
 *
 * The 44 px floor applies as everywhere else — fed each primitive's DIAMETER and added to its
 * radius, it grows the diameter by exactly the shortfall. On this object it is normally +0: the
 * body spans 0.80 and projects well over 44 px at the ending eye at both viewports.
 */
export function plantRayHit(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  fovDeg: number,
  heightPx: number
): { t: number; point: [number, number, number] } | null {
  const b = PLANT_CLAIM.body
  const c = PLANT_CLAIM.crown
  const bodyDist = Math.hypot(b.centre[0] - ox, (b.yMin + b.yMax) / 2 - oy, b.centre[1] - oz)
  const bodyR = b.r + hitPadFor(b.r * 2, bodyDist, fovDeg, heightPx)
  const crownDist = Math.hypot(c.c[0] - ox, c.c[1] - oy, c.c[2] - oz)
  const crownR = c.r + hitPadFor(c.r * 2, crownDist, fovDeg, heightPx)
  const tb = rayCylinderHit(ox, oy, oz, dx, dy, dz, b.centre[0], b.centre[1], bodyR, b.yMin, b.yMax)
  const tc = raySphereHit(ox, oy, oz, dx, dy, dz, c.c, crownR)
  const t = tb === null ? tc : tc === null ? tb : Math.min(tb, tc)
  return t === null ? null : { t, point: [ox + dx * t, oy + dy * t, oz + dz * t] }
}

// --- the pick resolution (ONE owner: the component and the sweep gate both call THIS) ----------

export type DeskPick = {
  id: string
  t: number
  point: [number, number, number]
  /** True when the ray hits the claim's own surface, not only its 44 px-grown skin. */
  surface: boolean
}

/** The T89 chunky boxes (minus the pen cup, whose claim is rebuilt above) plus the note's
 *  corner — the box claims, with their pick metadata precomputed once. */
const BOX_CLAIMS = [
  ...DESK_NUDGE_ZONES.filter((z) => z.kind !== 'pencup').map((z) => ({
    id: z.kind as string,
    min: z.min,
    max: z.max,
  })),
  { id: 'note', min: NOTE_CORNER_ZONE.min, max: NOTE_CORNER_ZONE.max },
  { id: 'station-case-0', min: CASE_CLAIM.min, max: CASE_CLAIM.max },
].map((z) => ({
  ...z,
  center: [
    (z.min[0] + z.max[0]) / 2,
    (z.min[1] + z.max[1]) / 2,
    (z.min[2] + z.max[2]) / 2,
  ] as const,
  minExtent: Math.min(z.max[0] - z.min[0], z.max[1] - z.min[1], z.max[2] - z.min[2]),
}))

const CAPSULE_CLAIMS = [
  ...STATION_CLAIMS.filter(
    (c): c is Extract<StationClaim, { shape: 'capsule' }> => c.shape === 'capsule'
  ).map((c) => ({
    id: `station-${c.kind}-${c.index}`,
    a: c.a,
    b: c.b,
    r: c.r,
    /** Station capsules are fitted to their objects — the whole claim is surface. */
    core: c.r,
  })),
  ...PENCUP_PENS.map((p) => ({ id: 'pencup', a: p.a, b: p.b, r: p.r, core: PEN_CORE_R })),
]

const SPHERE_CLAIMS = STATION_CLAIMS.filter(
  (c): c is Extract<StationClaim, { shape: 'sphere' }> => c.shape === 'sphere'
).map((c) => ({
  id: `station-chip-${c.index}`,
  c: c.c,
  r: c.r,
}))

/**
 * THE ONE PICK (T97 round 3). Every desk claim — T89 boxes, the note, the station's primitives,
 * the pens, the cup cylinder, the globe — against one ray, with two rules the capture rounds
 * forced:
 *
 *  - SURFACE BEATS PAD: a claim hit only inside its slack — the 44 px-grown skin of a sphere or
 *    box, or a pen's claim radius beyond its shaft core (PEN_CORE_R) — yields to any
 *    true-surface hit; nearest t breaks ties within a class. Padding exists to give small and
 *    thin objects a tap floor, and a floor must never become a SHIELD: grown chip spheres
 *    overlap along the ending's grazing sight lines (the pink chips project under 30 px, 29 px
 *    apart) and the darkRed pen's halo crosses the darkBrown chip's sightline at 0.1105 from
 *    its axis — without this rule the nearer claim's air eats the farther object's own surface.
 *  - LANE PRECEDENCE: if the ray crosses the lane's claim, the lane bar takes the pick — the
 *    set-piece trigger must never lose its own surface to a neighbour's air. Only a genuinely
 *    nearer GLOBE surface hit (a real sphere, not air) keeps it.
 *
 * Pure, three-free, and exported so `desk-station.test.ts` can drive the EXACT function the
 * component uses with rays from the settled ending eye — the decisive gate, not a replica.
 */
export function resolveDeskPick(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  fovDeg: number,
  heightPx: number
): DeskPick | null {
  let best: DeskPick | null = null
  const consider = (id: string, t: number, surface: boolean, px: number, py: number, pz: number): void => {
    if (best === null || (surface !== best.surface ? surface : t < best.t)) {
      best = { id, t, point: [px, py, pz], surface }
    }
  }
  const along = (t: number): [number, number, number] => [ox + dx * t, oy + dy * t, oz + dz * t]

  for (const z of BOX_CLAIMS) {
    const dist = Math.hypot(z.center[0] - ox, z.center[1] - oy, z.center[2] - oz)
    const pad = hitPadFor(z.minExtent, dist, fovDeg, heightPx)
    const t = rayBoxHit(
      ox, oy, oz, dx, dy, dz,
      [z.min[0] - pad, z.min[1] - pad, z.min[2] - pad],
      [z.max[0] + pad, z.max[1] + pad, z.max[2] + pad]
    )
    if (t !== null) {
      const surface = pad === 0 || rayBoxHit(ox, oy, oz, dx, dy, dz, z.min, z.max) !== null
      const p = along(t)
      consider(z.id, t, surface, p[0], p[1], p[2])
    }
  }
  for (const cl of CAPSULE_CLAIMS) {
    const t = raySegmentHit(ox, oy, oz, dx, dy, dz, cl.a, cl.b, cl.r)
    if (t !== null) {
      const surface = cl.core >= cl.r || raySegmentHit(ox, oy, oz, dx, dy, dz, cl.a, cl.b, cl.core) !== null
      const p = along(t)
      consider(cl.id, t, surface, p[0], p[1], p[2])
    }
  }
  for (const sp of SPHERE_CLAIMS) {
    const dist = Math.hypot(sp.c[0] - ox, sp.c[1] - oy, sp.c[2] - oz)
    const rEff = sp.r + hitPadFor(sp.r * 2, dist, fovDeg, heightPx)
    const t = raySphereHit(ox, oy, oz, dx, dy, dz, sp.c, rEff)
    if (t !== null) {
      const surface = raySphereHit(ox, oy, oz, dx, dy, dz, sp.c, sp.r) !== null
      const p = along(t)
      consider(sp.id, t, surface, p[0], p[1], p[2])
    }
  }
  const pc = rayCylinderHit(
    ox, oy, oz, dx, dy, dz,
    PENCUP_BODY.centre[0], PENCUP_BODY.centre[1],
    PENCUP_BODY.radius, PENCUP_BODY.yMin, PENCUP_BODY.yMax
  )
  if (pc !== null) {
    const p = along(pc)
    consider('pencup', pc, true, p[0], p[1], p[2])
  }
  const g = globeRayHit(ox, oy, oz, dx, dy, dz)
  if (g !== null) consider('globe', g.t, true, g.point[0], g.point[1], g.point[2])
  const lane = laneRayHit(ox, oy, oz, dx, dy, dz, fovDeg, heightPx)
  if (lane !== null) {
    // (cast: TS narrows `best` to null here because every write happens inside `consider`)
    const b = best as DeskPick | null
    if (b === null || b.id !== 'globe' || lane.t < b.t) {
      best = { id: `station-bar-${LANE_BAR_INDEX}`, t: lane.t, point: lane.point, surface: true }
    }
  }
  return best
}

// --- shared closed-form machinery -------------------------------------------------------------

const TAU = Math.PI * 2

/** The impulse velocity whose from-rest response crests at exactly `crest` (desk-nudge's
 *  `impulseFor`, generalised off degrees). */
const crestImpulse = (omega: number, zeta: number, crest: number): number => {
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  const tp = Math.atan2(wd, zeta * omega) / wd
  return crest / ((Math.exp(-zeta * omega * tp) * Math.sin(wd * tp)) / wd)
}

/** Conservative decay envelope of one axis: |x(t)| ≤ env·e^(−ζωt) for all t ≥ 0. */
const envelope1 = (x: number, v: number, omega: number, zeta: number): number => {
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  return Math.hypot(x, (v + zeta * omega * x) / wd)
}

/**
 * The EXACT peak |x| a state will ever reach — not the envelope, which overstates a from-rest
 * impulse by 1/(e^(−ζω·tp)·sin(wd·tp)) ≈ 1.87 at the scoot's tuning and would make the travel
 * cap eat the authored crest. The peak is at t = 0 or at the first stationary point (successive
 * extrema shrink by the logarithmic decrement e^(−ζωπ/wd)); the second is included as float
 * armour for the retrograde-kick corner.
 */
export function peakDisplacement(x0: number, v0: number, omega: number, zeta: number): number {
  if (x0 === 0 && v0 === 0) return 0
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  const zw = zeta * omega
  const b = (v0 + zw * x0) / wd
  let t = Math.atan2(b * wd - zw * x0, x0 * wd + zw * b) / wd
  if (t < 0) t += Math.PI / wd
  const at = (tt: number): number =>
    Math.abs(Math.exp(-zw * tt) * (x0 * Math.cos(wd * tt) + b * Math.sin(wd * tt)))
  return Math.max(Math.abs(x0), at(t), at(t + Math.PI / wd))
}

/** The PECK/PRESS pulse family: double exponential normalised so its crest is exactly 1, plus
 *  its crest TIME — a pulse's depth is 0 at the trigger instant too, so "settled" must mean
 *  "quiet AND past the crest", never "quiet" alone (a young pulse is quiet on its way up). */
const pulseOf = (attack: number, release: number): { at: (tau: number) => number; tp: number } => {
  const tp = (Math.log(release / attack) * attack * release) / (release - attack)
  const norm = 1 / (Math.exp(-tp / release) - Math.exp(-tp / attack))
  return {
    at: (tau: number): number =>
      tau <= 0 ? 0 : norm * (Math.exp(-tau / release) - Math.exp(-tau / attack)),
    tp,
  }
}

// --- voice 1: the bars' scoot-and-settle -------------------------------------------------------

/**
 * A poked bar scoots ALONG its slot away from the poked end and settles back with one overshoot:
 * a single-axis underdamped spring (sampleAxis — the T89 workhorse) whose from-rest crest is
 * `amp`, with the total travel HARD-CAPPED at `travelMax` (measured slack 0.068 minus margin) by
 * the exact-peak clamp below, so re-poke pile-ups cannot walk a bar into the tray wall.
 *
 * `hop` is the shuffle arc (capture round): sliding a self-similar uniform-colour tube along its
 * own axis changes pixels only at its two end caps, so the pure translation measured nearly
 * invisible. The bar therefore also RISES by hop·|offset| — a pure function of the same offset,
 * no new state, same guard — so the whole silhouette shifts and the scoot reads as the bar
 * shuffling in its slot (≈4 px of rise at the crest). Vertical is open air above the tray.
 */
export const SCOOT = { hz: 2.2, zeta: 0.42, amp: 0.035, travelMax: 0.05, hop: 0.5 } as const
/** Below this |envelope| (world units, ~0.11 px) a scoot is DONE and writes exact +0. */
export const SCOOT_EPS = 0.0005

const SCOOT_OMEGA = SCOOT.hz * TAU
const scootImpulse = crestImpulse(SCOOT_OMEGA, SCOOT.zeta, SCOOT.amp)

export type ScootSlot = { bar: number; t0: number; x0: number; v0: number; active: boolean }
export type ScootState = { slots: [ScootSlot, ScootSlot] }

const emptyScootSlot = (): ScootSlot => ({ bar: -1, t0: 0, x0: 0, v0: 0, active: false })
export const restingScoot = (): ScootState => ({ slots: [emptyScootSlot(), emptyScootSlot()] })

/** The scoot direction: away from the poked end, i.e. −sign(dot(hit − centre, SLOT_DIR)). */
export function scootSignFrom(
  hit: readonly [number, number, number],
  centre: readonly [number, number]
): number {
  const d = (hit[0] - centre[0]) * SLOT_DIR[0] + (hit[2] - centre[1]) * SLOT_DIR[2]
  return d > 0 ? -1 : 1
}

/**
 * The travel clamp: largest velocity share of the fresh kick whose exact peak stays under the
 * cap, found by bisection (the peak is not linear in the kick, so a single proportional rescale —
 * the rockers' AMP_CAP move — can leak past a HARD cap; 28 halvings pin it to float precision).
 * Inductively sound: every stored state's peak is ≤ cap, and a later sample of a capped motion
 * cannot exceed the motion's own peak, so the k = 0 end of the bracket is always valid.
 */
const capScootVelocity = (x0: number, vCur: number, vNew: number): number => {
  if (peakDisplacement(x0, vNew, SCOOT_OMEGA, SCOOT.zeta) <= SCOOT.travelMax) return vNew
  let lo = 0
  let hi = 1
  for (let i = 0; i < 28; i++) {
    const midK = (lo + hi) / 2
    const v = vCur + (vNew - vCur) * midK
    if (peakDisplacement(x0, v, SCOOT_OMEGA, SCOOT.zeta) <= SCOOT.travelMax) lo = midK
    else hi = midK
  }
  return vCur + (vNew - vCur) * lo
}

/**
 * Kick a bar. TWO slots (the note-press stance): a poke on a bar already in flight re-kicks that
 * slot VELOCITY-CONTINUOUSLY; a fresh bar takes an idle slot; a third bar steals the more-settled
 * one (its bar snaps to its exact seat — the smallest visible discontinuity on the desk, chosen
 * over a third uniform).
 */
export function triggerScoot(
  s: ScootState,
  now: number,
  bar: number,
  sign: number,
  strength: number
): void {
  const kick = scootImpulse * strength * sign
  let slot = s.slots.find((sl) => sl.active && sl.bar === bar)
  if (slot) {
    const cur = sampleAxis({ x0: slot.x0, v0: slot.v0 }, SCOOT_OMEGA, SCOOT.zeta, now - slot.t0)
    slot.t0 = now
    slot.x0 = cur.x
    slot.v0 = capScootVelocity(cur.x, cur.v, cur.v + kick)
    return
  }
  slot = s.slots.find((sl) => !sl.active)
  if (!slot) {
    const envOf = (sl: ScootSlot): number => {
      const c = sampleAxis({ x0: sl.x0, v0: sl.v0 }, SCOOT_OMEGA, SCOOT.zeta, now - sl.t0)
      return envelope1(c.x, c.v, SCOOT_OMEGA, SCOOT.zeta)
    }
    slot = envOf(s.slots[0]) <= envOf(s.slots[1]) ? s.slots[0] : s.slots[1]
  }
  slot.bar = bar
  slot.t0 = now
  slot.x0 = 0
  slot.v0 = capScootVelocity(0, 0, kick)
  slot.active = true
}

/** One slot's uniform for this frame: (idLo, idHi, along-slot displacement, 0) — or exact rest. */
const sampleScootSlot = (slot: ScootSlot, now: number, out: Float32Array): void => {
  if (!slot.active) return
  const cur = sampleAxis({ x0: slot.x0, v0: slot.v0 }, SCOOT_OMEGA, SCOOT.zeta, now - slot.t0)
  if (envelope1(cur.x, cur.v, SCOOT_OMEGA, SCOOT.zeta) < SCOOT_EPS) {
    slot.active = false
    slot.bar = -1
    out.fill(0)
    return
  }
  const bar = STATION_BARS[slot.bar]
  out[0] = bar.range[0]
  out[1] = bar.range[1]
  out[2] = cur.x
  out[3] = 0
}

export function sampleScoot(s: ScootState, now: number, out0: Float32Array, out1: Float32Array): void {
  sampleScootSlot(s.slots[0], now, out0)
  sampleScootSlot(s.slots[1], now, out1)
}

// --- voice 2: the tree's sapling sway ----------------------------------------------------------

/**
 * The only sustained oscillation on the desk: the crown's tip circles out on two DETUNED damped
 * axes (the penguin's precession mechanism, translated instead of rotated), applied in-shader to
 * the foliage only, weighted (y − 1.45)/0.54 clamped — zero at the pot rim, so pot and soil
 * never move, and LINEAR because a bend is (see STATION_TREE). `quad` sends a share of the kick
 * a quarter-turn out of phase, which with the detune is what turns a metronome into a sapling
 * circling out. amp 0.07 → 0.10 with the linear ramp (capture round): the tip now moves ~22 px
 * and mid-crown ~10 px, where the squared ramp at 0.07 measured ~2 px — a sway nobody saw.
 */
export const TREE_SWAY = { hzX: 1.9, hzZ: 2.05, zeta: 0.18, amp: 0.1, quad: 0.4 } as const
/** Below this envelope (world, ~0.2 px at the crown) the sway is DONE — exact +0. */
export const TREE_EPS = 0.001

export const restingTreeSway = (): NudgeSpring => restingSpring()

const treeImpulse = crestImpulse(TREE_SWAY.hzX * TAU, TREE_SWAY.zeta, TREE_SWAY.amp)

const treeEnvelope = (s: NudgeSpring, now: number): number => {
  const tau = now - s.t0
  const wx = TREE_SWAY.hzX * TAU
  const wz = TREE_SWAY.hzZ * TAU
  const ax = sampleAxis(s.x, wx, TREE_SWAY.zeta, tau)
  const az = sampleAxis(s.z, wz, TREE_SWAY.zeta, tau)
  return Math.hypot(envelope1(ax.x, ax.v, wx, TREE_SWAY.zeta), envelope1(az.x, az.v, wz, TREE_SWAY.zeta))
}

/**
 * Kick the crown toward (dx, dz) — velocity-continuous, then energy-capped with the GLOBE'S
 * exact clamp, not the rockers' proportional one: a proportional rescale of the fresh impulse
 * leaks under near-coherent pile-ups (the globe measured 8° past its ceiling; this bench
 * measured 9% past this one), so the cap is landed exactly by rescaling the VELOCITY SHARE of
 * the envelope — env² is 2-homogeneous in (x, b) and the positions are the visible state, so
 * they stay untouched and the clamp can never pop the crown mid-sway.
 */
export function triggerTreeSway(
  s: NudgeSpring,
  now: number,
  dx: number,
  dz: number,
  strength: number
): void {
  const tau = now - s.t0
  const wx = TREE_SWAY.hzX * TAU
  const wz = TREE_SWAY.hzZ * TAU
  const cx = s.active ? sampleAxis(s.x, wx, TREE_SWAY.zeta, tau) : { x: 0, v: 0 }
  const cz = s.active ? sampleAxis(s.z, wz, TREE_SWAY.zeta, tau) : { x: 0, v: 0 }
  const v = treeImpulse * strength
  const vx = cx.v + v * dx - v * TREE_SWAY.quad * dz
  const vz = cz.v + v * dz + v * TREE_SWAY.quad * dx
  s.t0 = now
  s.active = true
  const root = Math.sqrt(1 - TREE_SWAY.zeta * TREE_SWAY.zeta)
  const bx = (vx + TREE_SWAY.zeta * wx * cx.x) / (wx * root)
  const bz = (vz + TREE_SWAY.zeta * wz * cz.x) / (wz * root)
  const cap = TREE_SWAY.amp * AMP_CAP
  const pos2 = cx.x * cx.x + cz.x * cz.x
  const b2 = bx * bx + bz * bz
  if (pos2 + b2 > cap * cap && b2 > 0) {
    const k = Math.sqrt(Math.max(cap * cap - pos2, 0) / b2)
    s.x = { x0: cx.x, v0: bx * k * wx * root - TREE_SWAY.zeta * wx * cx.x }
    s.z = { x0: cz.x, v0: bz * k * wz * root - TREE_SWAY.zeta * wz * cz.x }
  } else {
    s.x = { x0: cx.x, v0: vx }
    s.z = { x0: cz.x, v0: vz }
  }
}

/** The tip displacement for this frame: (dx, dz, 0, 0) — or exact rest. */
export function sampleTreeSway(s: NudgeSpring, now: number, out: Float32Array): void {
  if (!s.active) return
  if (treeEnvelope(s, now) < TREE_EPS) {
    s.active = false
    out.fill(0)
    return
  }
  const tau = now - s.t0
  out[0] = sampleAxis(s.x, TREE_SWAY.hzX * TAU, TREE_SWAY.zeta, tau).x
  out[1] = sampleAxis(s.z, TREE_SWAY.hzZ * TAU, TREE_SWAY.zeta, tau).x
  out[2] = 0
  out[3] = 0
}

// --- voice 3: the knife's see-saw teeter -------------------------------------------------------

/**
 * The only signed alternation on the desk: a single damped sine about the fixed horizontal axis
 * through the pivot — the end you tap dips first (rotation by +θ about `axis` lowers the BLADE
 * end: axis × (blade − pivot) points down, checked in the test). Both meshes also take the
 * clatter hop 0.35·halfLen·|sin θ|, which keeps the dipping tip from burying in the soft pad.
 */
export const TEETER = { hz: 3.2, zeta: 0.22, crestDeg: 4.5 } as const
/** Below this |envelope| (rad, tip motion ~0.1 px) the teeter is DONE — exact +0. */
export const TEETER_EPS = 0.0006

const TEETER_OMEGA = TEETER.hz * TAU
const TEETER_CREST = (TEETER.crestDeg * Math.PI) / 180
const teeterImpulse = crestImpulse(TEETER_OMEGA, TEETER.zeta, TEETER_CREST)

export type TeeterState = { t0: number; x0: number; v0: number; active: boolean }
export const restingTeeter = (): TeeterState => ({ t0: 0, x0: 0, v0: 0, active: false })

/** +1 if the hit lies on the blade side of the pivot along the long dir, −1 for the handle. */
export function teeterSignFrom(hit: readonly [number, number, number]): number {
  const d =
    (hit[0] - STATION_KNIFE.pivot[0]) * STATION_KNIFE.longDir[0] +
    (hit[2] - STATION_KNIFE.pivot[2]) * STATION_KNIFE.longDir[2]
  return d <= 0 ? 1 : -1
}

/** Kick the see-saw — velocity-continuous, energy-capped with the same exact velocity-share
 *  clamp as the tree's (see triggerTreeSway: the proportional rescale leaks under pile-ups). */
export function triggerTeeter(s: TeeterState, now: number, sign: number, strength: number): void {
  const cur = s.active
    ? sampleAxis({ x0: s.x0, v0: s.v0 }, TEETER_OMEGA, TEETER.zeta, now - s.t0)
    : { x: 0, v: 0 }
  let v = cur.v + teeterImpulse * strength * sign
  const cap = TEETER_CREST * AMP_CAP
  const wd = TEETER_OMEGA * Math.sqrt(1 - TEETER.zeta * TEETER.zeta)
  const b = (v + TEETER.zeta * TEETER_OMEGA * cur.x) / wd
  if (cur.x * cur.x + b * b > cap * cap && b !== 0) {
    const k = Math.sqrt(Math.max(cap * cap - cur.x * cur.x, 0) / (b * b))
    v = b * k * wd - TEETER.zeta * TEETER_OMEGA * cur.x
  }
  s.t0 = now
  s.x0 = cur.x
  s.v0 = v
  s.active = true
}

/** The teeter angle for this frame: (θ, 0, 0, 0) — or exact rest. */
export function sampleTeeter(s: TeeterState, now: number, out: Float32Array): void {
  if (!s.active) return
  const cur = sampleAxis({ x0: s.x0, v0: s.v0 }, TEETER_OMEGA, TEETER.zeta, now - s.t0)
  if (envelope1(cur.x, cur.v, TEETER_OMEGA, TEETER.zeta) < TEETER_EPS) {
    s.active = false
    out.fill(0)
    return
  }
  out[0] = cur.x
  out[1] = 0
  out[2] = 0
  out[3] = 0
}

// --- voice 4: the case's corner pop ------------------------------------------------------------

/**
 * A pulse, not a spring — nothing else on the desk pulses upward. The free corner flexes up and
 * settles on the PECK/PRESS double exponential; two slots overlap by max(), so a re-press
 * deepens and never pops. The field weight (1 − smoothstep(0, 0.68, d))² is EXACTLY zero at
 * d ≥ 0.68, which is what keeps the papers, the sample-chip row and the tray structurally still
 * (their measured distances all exceed the radius — gated). amp 0.045 → 0.07 and radius
 * 0.62 → 0.68 after the capture round measured the first cut pink-on-pink quiet (~100 px of
 * barely-contrasting corner): ≈16 px of lift over a wider hinge of case body.
 */
export const CASE_POP = { attack: 0.07, release: 0.3, amp: 0.105 } as const
/* 0.07/0.22/0.07 measured 90 ms and ~8 px on the composed frame (the corner projects at only
 * ~115 px/world of vertical, and pink-on-pink carries no contrast) — the blink-and-miss class
 * again. Deeper and slower: ~12 px at the crest over a ~0.5 s visible life. The radius CANNOT
 * grow (paper1 sits at 0.3392), so legibility is bought in y and in time, never in reach. */
/** Below this crest share (world, ~0.2 px) the pop is DONE — exact +0. */
export const CASE_EPS = 0.001

const casePulse = pulseOf(CASE_POP.attack, CASE_POP.release).at

export type CasePopState = { slots: [{ t0: number; amp: number }, { t0: number; amp: number }] }
export const restingCasePop = (): CasePopState => ({
  slots: [
    { t0: -1e9, amp: 0 },
    { t0: -1e9, amp: 0 },
  ],
})

const casePopDepth = (slot: { t0: number; amp: number }, now: number): number =>
  slot.amp * casePulse(now - slot.t0)

export function triggerCasePop(s: CasePopState, now: number, strength: number): void {
  const d0 = casePopDepth(s.slots[0], now)
  const d1 = casePopDepth(s.slots[1], now)
  s.slots[d0 <= d1 ? 0 : 1] = { t0: now, amp: CASE_POP.amp * strength }
}

/** The corner's lift for this frame: (lift, 0, 0, 0) — or exact rest. */
export function sampleCasePop(s: CasePopState, now: number, out: Float32Array): void {
  const d = Math.max(casePopDepth(s.slots[0], now), casePopDepth(s.slots[1], now))
  if (d < CASE_EPS) {
    out.fill(0)
    return
  }
  out[0] = d
  out[1] = 0
  out[2] = 0
  out[3] = 0
}

/** The corner field, mirrored off the shader for the tests: exactly 0 at d ≥ radius. */
export function caseFlexWeight(dxz: number): number {
  const t = Math.min(Math.max(dxz / STATION_CASE.radius, 0), 1)
  const s = t * t * (3 - 2 * t)
  const w = 1 - s
  return w * w
}

// --- voice 5: the chips' press-dimple ----------------------------------------------------------

/**
 * A downward squash pulse — the donut jiggles on a spring; the chip just YIELDS and springs
 * back, no ring. The clicked chip flattens toward its own seat: y' = seat + (y − seat)(1 − s).
 * TWO slots, each owning one chip at a time and carrying (idLo, idHi, squash, seatY) as its
 * uniform; within a slot the pulse pair overlaps by max() (a re-press deepens, never pops), and
 * a third chip steals the more-settled slot.
 */
export const CHIP_PRESS = { attack: 0.05, release: 0.16, squash: 0.5 } as const
/** Below this squash share (≤ 0.2 px on the tallest chip) the press is DONE — exact +0. */
export const CHIP_EPS = 0.004

const chipPulseDef = pulseOf(CHIP_PRESS.attack, CHIP_PRESS.release)
const chipPulse = chipPulseDef.at

type ChipPulse = { t0: number; amp: number }
export type ChipSlot = { chip: number; pulses: [ChipPulse, ChipPulse] }
export type ChipPressState = { slots: [ChipSlot, ChipSlot] }

const emptyChipSlot = (): ChipSlot => ({
  chip: -1,
  pulses: [
    { t0: -1e9, amp: 0 },
    { t0: -1e9, amp: 0 },
  ],
})
export const restingChipPress = (): ChipPressState => ({ slots: [emptyChipSlot(), emptyChipSlot()] })

const chipSlotDepth = (slot: ChipSlot, now: number): number =>
  Math.max(slot.pulses[0].amp * chipPulse(now - slot.pulses[0].t0), slot.pulses[1].amp * chipPulse(now - slot.pulses[1].t0))

export function triggerChipPress(s: ChipPressState, now: number, chip: number, strength: number): void {
  const amp = CHIP_PRESS.squash * strength
  let slot = s.slots.find((sl) => sl.chip === chip)
  if (!slot) slot = s.slots.find((sl) => sl.chip < 0)
  if (!slot) slot = chipSlotDepth(s.slots[0], now) <= chipSlotDepth(s.slots[1], now) ? s.slots[0] : s.slots[1]
  if (slot.chip !== chip) {
    slot.chip = chip
    slot.pulses = [
      { t0: -1e9, amp: 0 },
      { t0: -1e9, amp: 0 },
    ]
  }
  const d0 = slot.pulses[0].amp * chipPulse(now - slot.pulses[0].t0)
  const d1 = slot.pulses[1].amp * chipPulse(now - slot.pulses[1].t0)
  slot.pulses[d0 <= d1 ? 0 : 1] = { t0: now, amp }
}

/** One slot's uniform for this frame: (idLo, idHi, squash, seatY) — or exact rest. */
const sampleChipSlot = (slot: ChipSlot, now: number, out: Float32Array): void => {
  if (slot.chip < 0) return
  const d = chipSlotDepth(slot, now)
  if (d < CHIP_EPS) {
    // quiet AND past both pulses' crests = settled; quiet alone can be a young press on its way
    // up (the pulse family starts at 0), which must not clear the slot
    if (now - slot.pulses[0].t0 > chipPulseDef.tp && now - slot.pulses[1].t0 > chipPulseDef.tp) {
      slot.chip = -1
    }
    out.fill(0)
    return
  }
  const chip = STATION_CHIPS[slot.chip]
  out[0] = chip.range[0]
  out[1] = chip.range[1]
  out[2] = d
  out[3] = chip.seat
}

export function sampleChipPress(s: ChipPressState, now: number, out0: Float32Array, out1: Float32Array): void {
  sampleChipSlot(s.slots[0], now, out0)
  sampleChipSlot(s.slots[1], now, out1)
}

// --- the uniforms ------------------------------------------------------------------------------

/** One vec4 per moving part, written once per frame by desk-interactions and read by the desk's
 *  materials (bar/chip slots additionally CARRY their id-range, so two bars and two chips can
 *  move at once without a uniform per object). All-zero IS rest — the guards below. */
export const STATION_UNIFORMS = {
  uStBar0: { value: new Float32Array(4) },
  uStBar1: { value: new Float32Array(4) },
  uStChip0: { value: new Float32Array(4) },
  uStChip1: { value: new Float32Array(4) },
  uStTree: { value: new Float32Array(4) },
  uStKnife: { value: new Float32Array(4) },
  uStCase: { value: new Float32Array(4) },
} as const

// --- the shader chunks -------------------------------------------------------------------------

const f = (v: number): string => v.toFixed(5)

const barBlock = (u: string): string =>
  `if ( ${u}.z != 0.0 && float( gl_VertexID ) >= ${u}.x && float( gl_VertexID ) <= ${u}.y ) {
  transformed.x += ${f(SLOT_DIR[0])} * ${u}.z;
  transformed.z += ${f(SLOT_DIR[2])} * ${u}.z;
  transformed.y += ${f(SCOOT.hop)} * abs( ${u}.z );
}`

const chipBlock = (u: string): string =>
  `if ( ${u}.z != 0.0 && float( gl_VertexID ) >= ${u}.x && float( gl_VertexID ) <= ${u}.y ) {
  transformed.y = ${u}.w + ( transformed.y - ${u}.w ) * ( 1.0 - ${u}.z );
}`

/** The knife rotation + clatter hop, shared verbatim by the baked handle and the metal blade so
 *  the two meshes cannot disagree mid-teeter. `select` is the only part that differs. */
const knifeMotion = `  float stC = cos( uStKnife.x );
  float stS = sin( uStKnife.x );
  vec3 stAx = vec3( ${f(STATION_KNIFE.axis[0])}, 0.0, ${f(STATION_KNIFE.axis[2])} );
  vec3 stP = vec3( ${f(STATION_KNIFE.pivot[0])}, ${f(STATION_KNIFE.pivot[1])}, ${f(STATION_KNIFE.pivot[2])} );
  vec3 stQ = transformed - stP;
  transformed = stP + stQ * stC + cross( stAx, stQ ) * stS + stAx * dot( stAx, stQ ) * ( 1.0 - stC );
  transformed.y += ${f(STATION_KNIFE.hopK * STATION_KNIFE.halfLen)} * abs( stS );`

const bladeBox = (() => {
  const p = STATION_KNIFE.bladePad
  const { min, max } = STATION_KNIFE.bladeAabb
  return `position.x >= ${f(min[0] - p)} && position.x <= ${f(max[0] + p)} &&
     position.y >= ${f(min[1] - p)} && position.y <= ${f(max[1] + p)} &&
     position.z >= ${f(min[2] - p)} && position.z <= ${f(max[2] + p)}`
})()

export const STATION_VERTEX_DECL = `uniform vec4 uStBar0;
uniform vec4 uStBar1;
uniform vec4 uStChip0;
uniform vec4 uStChip1;
uniform vec4 uStTree;
uniform vec4 uStKnife;
uniform vec4 uStCase;`

/**
 * The DeskBaked half of the station: all five voices, each behind its own exact-zero guard so
 * the rest path is the untouched path. Bar and chip slots select by `gl_VertexID` against THEIR
 * OWN uniform's id range (the slot decides which object it is this frame); the tree, knife
 * handle and case selects are compile-time literals (they never change owner).
 */
export const STATION_VERTEX_BODY = `${barBlock('uStBar0')}
${barBlock('uStBar1')}
${chipBlock('uStChip0')}
${chipBlock('uStChip1')}
if ( ( uStTree.x != 0.0 || uStTree.y != 0.0 ) && gl_VertexID >= ${STATION_TREE.foliageRange[0]} && gl_VertexID <= ${STATION_TREE.foliageRange[1]} ) {
  float stW = clamp( ( position.y - ${f(STATION_TREE.bendY0)} ) / ${f(STATION_TREE.bendYTop - STATION_TREE.bendY0)}, 0.0, 1.0 );
  transformed.x += uStTree.x * stW;
  transformed.z += uStTree.y * stW;
}
if ( uStKnife.x != 0.0 && gl_VertexID >= ${STATION_KNIFE.handleRange[0]} && gl_VertexID <= ${STATION_KNIFE.handleRange[1]} ) {
${knifeMotion}
}
if ( uStCase.x != 0.0 && gl_VertexID >= ${STATION_CASE.range[0]} && gl_VertexID <= ${STATION_CASE.range[1]} ) {
  float stD = distance( position.xz, vec2( ${f(STATION_CASE.corner[0])}, ${f(STATION_CASE.corner[1])} ) );
  float stF = 1.0 - smoothstep( 0.0, ${f(STATION_CASE.radius)}, stD );
  // ...weighted by height within the case, so the BASE stays seated and the corner peels open
  // like a lid off its box: the first cut lifted the whole thickness, and the capture round
  // showed the case's dark baked side-wall rising off the pad as a black jag — a glitch read.
  // Peeled, the dark line is the lid/base gap's own shadow, which is what an opening case shows.
  float stW = clamp( ( position.y - ${f(STATION_CASE.baseY)} ) / ${f(STATION_CASE.lidY - STATION_CASE.baseY)}, 0.0, 1.0 );
  transformed.y += uStCase.x * stF * stF * stW;
}`

export const STATION_METAL_DECL = 'uniform vec4 uStKnife;'

/** The DeskMetal half: the blade, selected by its padded measured AABB (gated: the box contains
 *  the whole blade component and touches no other metal component). Same motion text as the
 *  handle's. */
export const STATION_METAL_BODY = `if ( uStKnife.x != 0.0 &&
     ${bladeBox} ) {
${knifeMotion}
}`

/**
 * The blade's normals rotate WITH the teeter (nudgeNormalChunk's pattern — a metal is nothing
 * but its reflection, and the sweep of that reflection as the blade tips is what the eye gets
 * paid). Lands in `beginnormal_vertex` because the standard material consumes `objectNormal`
 * before `begin_vertex` runs; the hop is a translation and touches no normal.
 */
export const STATION_METAL_NORMAL_BODY = `if ( uStKnife.x != 0.0 &&
     ${bladeBox} ) {
  vec3 stNAx = vec3( ${f(STATION_KNIFE.axis[0])}, 0.0, ${f(STATION_KNIFE.axis[2])} );
  float stNC = cos( uStKnife.x );
  float stNS = sin( uStKnife.x );
  objectNormal = objectNormal * stNC + cross( stNAx, objectNormal ) * stNS + stNAx * dot( stNAx, objectNormal ) * ( 1.0 - stNC );
}`
