/**
 * WILD lane — FOLD-BIRTH: the inn ERECTS as the leaf comes over.
 *
 * This module replaces the clipping-plane rise. Nothing grows out of the paper any more;
 * separated staged events swing pieces up about VISIBLE hinge lines, each landing with an
 * overshoot and a thump, so the building reads as crease-born rather than clip-born.
 *
 * THE LAW (the user's own words): "It shouldn't strictly obey the physics but it should appear
 * to obey them, so we can have folds that otherwise would not make sense and would need more
 * leverages, but they should feel close to foldable structures." Every moving part therefore
 * rotates about a plausible hinge line and reads as if it COULD fold flat; leverage is cheated
 * freely, the hinge-line look never is.
 *
 * ---------------------------------------------------------------------------------------------
 * THE COLLAPSING HINGE — the one transform, and why it is not a lie
 *
 * A solid box cannot rotate flat about one of its base edges: its depth becomes height and it
 * pokes through the closed leaf. A pop-up BOX does not do that either — it rises AND its plan
 * opens out of a flat stack (Birmingham 51 / 67-72, two parallel sticking strips). So each piece
 * gets a frame (O; R, F, A): O a point on the hinge line, A the hinge axis, R the direction the
 * piece rises at rest, F where R lies down when the piece is flat.
 *
 *   p  = O + r R + f F + a A                          (rest decomposition)
 *   p' = O + r (sin psi R + kappa cos psi F) + f sin psi F + a A + thump
 *
 * with psi = q * 90deg. At q = 1 (sin 1, cos 0) the map is EXACTLY the identity — the rest pose
 * is bit-untouched, which is the one contract the whole lane depends on. At q = 0 the piece is
 * exactly flat in the (F, A) plane: r maps onto kappa*r along F, f collapses to zero. That
 * collapse of the plan depth IS the pop-up box opening, read backwards.
 *
 * `kappa` is the leverage cheat and the only one: a 1.0-tall stair tower laid flat about a
 * crease at its own foot would overhang the trim, so its flat reach is shortened. Mid-fold the
 * tip traces an ellipse instead of a circle, which reads as a piece with a strut behind it —
 * exactly the "folds that would need more leverages" the brief authorises.
 *
 * NORMALS travel by the TRUE rotation (about A, through 90deg - psi), never by the linear part:
 * the linear part shears, and a sheared normal turns a folding wall inside out. That rotation
 * ships as a quaternion per chunk.
 *
 * CHILDREN compose: a chunk's world map is `parent.map o own.map`, both acting on rest-space
 * world coordinates (skinning without bind matrices). The jetty rides the hall's rise with its
 * floor plate folded down against the wall, then swings up on its own beat — and because a
 * flat parent's map is a projection onto the page, every descendant of a flat piece is flat too.
 *
 * ---------------------------------------------------------------------------------------------
 * Staging + settle are ported from the GRAND lane's `book/popup-mechanics.ts` (TurnStage /
 * stageTurnT / stageSettleProgress), adapted: the consumer here is a diorama driven by the
 * WILD frame's `open`, not the book's layer solver.
 */
import {
  BARRELS,
  CHIMNEY,
  DORMERS,
  HALL,
  JETTY,
  LANTERN,
  ROOF,
  SIGN,
  SPREAD,
  STEP,
  TOWER,
  WELL,
  type Vec3,
} from './inn-model'

// ---------------------------------------------------------------------------------------------
// THE EVENT TABLE — the tuning surface. One table, named events, nothing else to hunt for.
// ---------------------------------------------------------------------------------------------

export type FoldEventName =
  | 'walls'
  | 'tower'
  | 'jetty'
  | 'yard'
  | 'roof'
  | 'crest'
  | 'dressing'

/** A piece's own slice of the curtain-up, as fractions of the WILD frame's eased `open`. */
export type FoldWindow = { readonly t0: number; readonly t1: number }

/**
 * Seven separated erection events. Spans are equal (0.17) and step by 0.11, so every adjacent
 * pair overlaps by 0.06 — 35% of the shorter window, inside the donor's 40% ceiling. Overlap is
 * what keeps the build continuous; more than 40% and the events stop reading as separate.
 *
 * The order is structural, not arbitrary: nothing may erect before what it stands on.
 */
export const FOLD_EVENTS: Record<FoldEventName, FoldWindow> = {
  walls: { t0: 0.16, t1: 0.33 },
  tower: { t0: 0.27, t1: 0.44 },
  jetty: { t0: 0.38, t1: 0.55 },
  yard: { t0: 0.49, t1: 0.66 },
  roof: { t0: 0.6, t1: 0.77 },
  crest: { t0: 0.71, t1: 0.88 },
  dressing: { t0: 0.82, t1: 0.99 },
}

/** Events in start order — the order the window-overlap law is checked in. */
export const FOLD_EVENT_ORDER: readonly FoldEventName[] = [
  'walls',
  'tower',
  'jetty',
  'yard',
  'roof',
  'crest',
  'dressing',
]

// ---------------------------------------------------------------------------------------------
// THE LANDING SETTLE — ported from GRAND's M2, same shape, same reasons
// ---------------------------------------------------------------------------------------------

/** Where in a piece's own window the base travel ends and the settle begins. */
export const SETTLE_TAIL = 0.72

/** Peak overshoot past the landing, in degrees of the folding piece's own hinge angle. */
export const SETTLE_PEAK_DEG = 1.5

/** Every hinge here sweeps a quarter turn, so a peak in degrees is a fixed gain in progress. */
export const FOLD_SWEEP_DEG = 90
const SETTLE_GAIN = SETTLE_PEAK_DEG / FOLD_SWEEP_DEG

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** A piece's raw progress through its own window. 0 and 1 are exact at the window's edges. */
export function stageU(open: number, w: FoldWindow): number {
  if (w.t1 <= w.t0) return clamp01(open)
  return clamp01((open - w.t0) / (w.t1 - w.t0))
}

/**
 * Staged progress with the landing settle: the base ramp compressed into [0, SETTLE_TAIL], then
 * one velocity-matched lobe of peak `gain` that carries PAST 1 and returns to exactly 1.
 *
 * Exact at both ends by early return, so a piece is exactly flat at u = 0 and exactly at rest at
 * u = 1 however the lobe is tuned. NaN-safe. (Verbatim shape from the donor; see its header for
 * why the base travel has to be compressed rather than the bump merely added.)
 */
export function stageSettleProgress(u: number, gain: number = SETTLE_GAIN): number {
  if (!(u > 0)) return 0
  if (u >= 1) return 1
  if (!(gain > 0)) return u
  if (u <= SETTLE_TAIL) return u / SETTLE_TAIL
  const x = (u - SETTLE_TAIL) / (1 - SETTLE_TAIL)
  const slope = (1 - SETTLE_TAIL) / SETTLE_TAIL
  const xp = Math.min(0.5, (2 * gain) / slope)
  if (x <= xp) return 1 + slope * x - (slope / (2 * xp)) * x * x
  const y = (x - xp) / (1 - xp)
  return 1 + gain * (1 - y * y * (3 - 2 * y))
}

// ---------------------------------------------------------------------------------------------
// THE SINK — how a folded-flat inn stays invisible
// ---------------------------------------------------------------------------------------------

/**
 * A flat piece lies exactly ON the page, and the page is exactly where the reader is looking.
 * The old clip-rise hid the sleeping building by parking the whole mass a metre under the paper;
 * the fold has no such parking, and the diorama tree is never visibility-gated (a light-count
 * change re-links every program in the scene), so a page-rooted piece that is still flat would
 * render as a smeared silhouette printed on the paper — including on spreads the reader is not
 * even on.
 *
 * So a flat page-rooted piece sits `sink` BELOW the page surface, where RISE_CLIP swallows it
 * whole, and that offset is retired inside the first ~10 degrees of its swing. The reader's read
 * of those ten degrees is the best part: the piece's top edge peeling up out of the paper.
 * Children inherit it through their parent's map, which is exactly right — a floor plate folded
 * against a sunken wall is sunken too.
 */
export const SINK_END = 0.18

/** How far under the page a flat page-rooted piece parks. RISE_CLIP takes it from there. */
export const PAGE_SINK = 0.04

/** 1 while a piece is flat, 0 once it has cleared the page. sin(psi) is the argument. */
export function sinkFactor(sinPsi: number): number {
  return clamp01(1 - sinPsi / SINK_END)
}

/**
 * THE THUMP, as a pure shape in [0, 1]: zero everywhere until the piece reaches its landing at
 * SETTLE_TAIL, then one compression toward the hinge and a much smaller rebound, back to exactly
 * zero at u = 1. Multiplied by the chunk's own amplitude and applied along -R, so the piece
 * settles ONTO its crease rather than merely stopping on it. Peaks at ~0.60 near x = 0.22.
 */
export function thumpShape(u: number): number {
  if (u <= SETTLE_TAIL || u >= 1) return 0
  const x = (u - SETTLE_TAIL) / (1 - SETTLE_TAIL)
  const d = 1 - x
  return d * d * Math.sin(2 * Math.PI * x)
}

// ---------------------------------------------------------------------------------------------
// THE CHUNKS — every moving part, its hinge line, and what it takes with it
// ---------------------------------------------------------------------------------------------

export type FoldChunkName =
  | 'walls'
  | 'tower'
  | 'jetty'
  | 'yard'
  | 'roof'
  | 'dormers'
  | 'chimney'
  | 'sign'
  | 'lantern'

export type FoldChunk = {
  readonly name: FoldChunkName
  readonly event: FoldEventName
  /** Whose fold this piece rides. Parents are always listed before their children. */
  readonly parent: FoldChunkName | null
  /** A point ON the hinge line, in rest space. */
  readonly origin: Vec3
  /** Unit direction the piece rises in at rest (the crease's normal, in the piece's plane). */
  readonly rise: Vec3
  /** Unit direction the rise lies down along when the piece is flat. Perpendicular to `rise`. */
  readonly fall: Vec3
  /** Flat-reach shortening, 0..1. 1 = a pure hinge; below 1 the piece rises steeper than paper. */
  readonly kappa: number
  /** Crease darkening at the hinge line while the piece is in flight, 0..1. */
  readonly creaseGain: number
  /** How far the crease shadow reaches up the panel, in world units. */
  readonly creaseFalloff: number
  /** Landing-thump amplitude along -rise, world units. */
  readonly thump: number
  /** How far under the page this piece hides while flat. Page-rooted pieces only — a child
   *  inherits its parent's, which is what a floor plate folded against a sunken wall does. */
  readonly sink: number
  /** Where the crease shadow is measured from, if not the hinge itself (the roof's is the
   *  RIDGE: its two slopes spread apart from a closed book-fold, and the ridge is the spine
   *  of that fold even though the piece hinges at eave height). */
  readonly creaseOrigin?: Vec3
  readonly creaseAxis?: Vec3
  /** Conservative rest-space AABB, for the bench's flat/containment gates. */
  readonly extent: { readonly min: Vec3; readonly max: Vec3 }
}

const UP: Vec3 = [0, 1, 0]
const FORE: Vec3 = [0, 0, 1]
const RIGHT: Vec3 = [1, 0, 0]

/** The dormer rank's shared sill / crown / face, derived rather than restated (D8). */
const DORMER_SILL_Y = Math.min(...DORMERS.map((d) => d.sillY))
const DORMER_APEX_Y = Math.max(...DORMERS.map((d) => d.apexY))
const DORMER_FRONT_Z = Math.max(...DORMERS.map((d) => d.frontZ))
const DORMER_MIN_X = Math.min(...DORMERS.map((d) => d.cx - d.halfW))
const DORMER_MAX_X = Math.max(...DORMERS.map((d) => d.cx + d.halfW))

/**
 * THE PIECES, parents first.
 *
 * Hinge lines, and why each one is plausible paper:
 *
 *  walls   — the hall's own front base crease, on the page, running across it. A wall flap.
 *  tower   — a second base crease parallel to the first (Birmingham law 3: parallel creases are
 *            how neighbouring pieces avoid clashing). Shortened reach, because a metre of tower
 *            laid flat would run off the trim.
 *  jetty   — the wall-top crease. The bressummer beam IS the hinge; the first floor is folded
 *            down against the stone while the wall rises, then swings out and up.
 *  yard    — a spine-PARALLEL crease at the foot of the inn: the courtyard furniture on two
 *            parallel sticking strips, the oldest mechanism in the book.
 *  roof    — the line under the ridge. The two slopes are folded face to face at the start and
 *            OPEN as the ridge lifts, which is exactly a gable closing, run backwards.
 *  dormers — the dormer sill line: little gables flipping up out of the slope.
 *  chimney — a spine-parallel crease inside the slates, so the stack hinges up sideways out of
 *            the roof rather than sharing the roof's own direction. Variety, deliberately.
 *  sign    — a VERTICAL hinge on the jetty's right return: the bracket swings out like a door.
 *            The only non-horizontal crease on the building, and it lands the reading diagonal.
 *  lantern — a vertical hinge on the hall's front wall, the same idiom one size down.
 */
export const FOLD_CHUNKS: readonly FoldChunk[] = [
  {
    name: 'walls',
    event: 'walls',
    parent: null,
    origin: [0, 0, HALL.max[2]],
    rise: UP,
    fall: FORE,
    kappa: 1,
    creaseGain: 0.55,
    creaseFalloff: 0.075,
    thump: 0.008,
    sink: PAGE_SINK,
    extent: {
      min: [HALL.min[0] - 0.03, -0.03, HALL.min[2] - 0.03],
      max: [HALL.max[0] + 0.03, HALL.max[1] + 0.02, STEP.max[2] + 0.03],
    },
  },
  {
    name: 'tower',
    event: 'tower',
    parent: null,
    origin: [0, 0, TOWER.max[2]],
    rise: UP,
    fall: FORE,
    // A pure hinge lays the 1.00 apex down at z = 0.74, a centimetre inside the trim — too near
    // to trust once the page tilts. 0.72 keeps the flat reach at 0.46 and reads as a strut.
    kappa: 0.72,
    creaseGain: 0.55,
    creaseFalloff: 0.09,
    thump: 0.009,
    sink: PAGE_SINK,
    extent: {
      min: [TOWER.min[0] - 0.04, -0.03, TOWER.min[2] - 0.03],
      max: [TOWER.max[0] + 0.04, TOWER.cap.apexY + 0.02, TOWER.max[2] + 0.03],
    },
  },
  {
    name: 'jetty',
    event: 'jetty',
    parent: 'walls',
    origin: [0, JETTY.min[1], HALL.max[2]],
    rise: UP,
    fall: FORE,
    kappa: 1,
    creaseGain: 0.6,
    creaseFalloff: 0.06,
    thump: 0.007,
    sink: 0,
    extent: {
      min: [JETTY.min[0] - 0.04, JETTY.min[1] - 0.06, JETTY.min[2] - 0.04],
      max: [JETTY.max[0] + 0.04, JETTY.max[1] + 0.03, JETTY.max[2] + 0.04],
    },
  },
  {
    name: 'yard',
    event: 'yard',
    parent: null,
    origin: [HALL.max[0], 0, 0],
    rise: UP,
    fall: RIGHT,
    kappa: 1,
    creaseGain: 0.45,
    creaseFalloff: 0.05,
    thump: 0.006,
    sink: PAGE_SINK,
    extent: {
      min: [BARRELS[0].center[0] - 0.08, -0.03, WELL.center[2] - WELL.radius - 0.14],
      max: [WELL.center[0] + WELL.radius + 0.04, WELL.archY + 0.03, WELL.center[2] + WELL.radius + 0.04],
    },
  },
  {
    name: 'roof',
    event: 'roof',
    parent: 'jetty',
    origin: [0, ROOF.eaveY, ROOF.ridgeZ],
    rise: UP,
    fall: FORE,
    kappa: 1,
    // The piece hinges at eave height but its CREASE is the ridge — the slopes spread apart from
    // a closed book-fold, so the shadow belongs in a band under the ridge on both sides.
    creaseOrigin: [0, ROOF.ridgeY, ROOF.ridgeZ],
    creaseAxis: UP,
    creaseGain: 0.65,
    creaseFalloff: 0.055,
    thump: 0.0075,
    sink: 0,
    extent: {
      min: [ROOF.minX - 0.03, ROOF.eaveY - 0.05, ROOF.backEaveZ - 0.04],
      max: [ROOF.maxX + 0.03, ROOF.ridgeY + 0.03, ROOF.frontEaveZ + 0.04],
    },
  },
  {
    name: 'dormers',
    event: 'crest',
    parent: 'roof',
    origin: [0, DORMER_SILL_Y, DORMER_FRONT_Z],
    rise: UP,
    fall: FORE,
    kappa: 1,
    creaseGain: 0.6,
    creaseFalloff: 0.04,
    thump: 0.005,
    sink: 0,
    extent: {
      min: [DORMER_MIN_X - 0.05, DORMER_SILL_Y - 0.04, -0.26],
      max: [DORMER_MAX_X + 0.05, DORMER_APEX_Y + 0.03, DORMER_FRONT_Z + 0.04],
    },
  },
  {
    name: 'chimney',
    event: 'crest',
    parent: 'roof',
    // The stack's own base, trimmed to the slates (see CHIMNEY.foldBase). The crease reads where
    // brick meets shingle, which is where a paper chimney would be creased anyway.
    origin: [CHIMNEY.max[0], CHIMNEY.foldBase, 0],
    rise: UP,
    fall: RIGHT,
    kappa: 1,
    creaseGain: 0.6,
    creaseFalloff: 0.05,
    thump: 0.005,
    sink: 0,
    extent: {
      min: [CHIMNEY.min[0] - 0.04, CHIMNEY.foldBase - 0.01, CHIMNEY.min[2] - 0.04],
      max: [CHIMNEY.max[0] + 0.04, CHIMNEY.cap.topY + 0.03, CHIMNEY.max[2] + 0.04],
    },
  },
  {
    name: 'sign',
    event: 'dressing',
    parent: 'jetty',
    origin: SIGN.bracketRoot,
    rise: RIGHT,
    fall: FORE,
    kappa: 1,
    creaseGain: 0.35,
    creaseFalloff: 0.04,
    thump: 0.005,
    sink: 0,
    extent: {
      min: [SIGN.bracketRoot[0] - 0.03, SIGN.pivot[1] - SIGN.height - 0.08, SIGN.pivot[2] - 0.05],
      max: [SIGN.pivot[0] + SIGN.halfW + 0.03, SIGN.bracketRoot[1] + 0.04, SIGN.pivot[2] + 0.05],
    },
  },
  {
    name: 'lantern',
    event: 'dressing',
    parent: 'walls',
    origin: [LANTERN.pos[0], LANTERN.pos[1], HALL.max[2] - 0.01],
    rise: FORE,
    fall: RIGHT,
    kappa: 1,
    creaseGain: 0.35,
    creaseFalloff: 0.03,
    thump: 0.004,
    sink: 0,
    extent: {
      min: [LANTERN.pos[0] - 0.05, LANTERN.pos[1] - 0.06, HALL.max[2] - 0.02],
      max: [LANTERN.pos[0] + 0.05, LANTERN.pos[1] + 0.09, LANTERN.pos[2] + 0.05],
    },
  },
]

// ---------------------------------------------------------------------------------------------
// SLOTS — slot 0 is the identity, so any mesh WITHOUT a fold tag simply does not fold. That is
// the deliberate failure mode: a plumbing mistake costs the fold, never the building.
// ---------------------------------------------------------------------------------------------

export const FOLD_SLOT_COUNT = FOLD_CHUNKS.length + 1

const SLOT_BY_NAME = new Map<FoldChunkName, number>(
  FOLD_CHUNKS.map((c, i) => [c.name, i + 1] as const)
)

/** The uniform slot a chunk's pose lands in. Slot 0 is reserved for "does not fold". */
export function foldSlot(name: FoldChunkName): number {
  const slot = SLOT_BY_NAME.get(name)
  if (slot === undefined) throw new Error(`wild/fold-birth: no chunk named ${name}`)
  return slot
}

// ---------------------------------------------------------------------------------------------
// SOLVER
// ---------------------------------------------------------------------------------------------

type Mat4 = number[]
type Quat = [number, number, number, number]

const cross3 = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

/** Column-major 4x4 product a . b (apply b first, then a). */
function mulMat(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16).fill(0)
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      let s = 0
      for (let k = 0; k < 4; k += 1) s += a[k * 4 + r] * b[c * 4 + k]
      out[c * 4 + r] = s
    }
  }
  return out
}

/** Hamilton product a * b — apply b's rotation first, then a's. */
function mulQuat(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ]
}

export type FoldPose = {
  readonly name: FoldChunkName
  readonly slot: number
  /** World map for a REST-space position. Column-major, ready for THREE.Matrix4.fromArray. */
  readonly matrix: Mat4
  /** World normal rotation, as (x, y, z, w). */
  readonly quat: Quat
  /** Crease darkening at this piece's own hinge line, 0 (rest) .. creaseGain (flat). */
  readonly crease: number
  /** This piece's raw window progress, before the settle. Landing cues fire off this. */
  readonly u: number
  /** How far under the page this piece is currently parked (0 once it has cleared it). */
  readonly sink: number
}

function localMatrix(c: FoldChunk, psi: number, thump: number, sink: number): Mat4 {
  const R = c.rise
  const F = c.fall
  const A = cross3(R, F)
  const s = Math.sin(psi)
  const co = Math.cos(psi)
  const kc = c.kappa * co
  // L = s (R R^T) + kc (F R^T) + s (F F^T) + (A A^T)
  const L: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      L[i][j] = s * R[i] * R[j] + kc * F[i] * R[j] + s * F[i] * F[j] + A[i] * A[j]
    }
  }
  const O = c.origin
  const t: number[] = []
  for (let i = 0; i < 3; i += 1) {
    t.push(O[i] - (L[i][0] * O[0] + L[i][1] * O[1] + L[i][2] * O[2]) - thump * R[i])
  }
  // The sink is world-DOWN, not along the piece's own rise: it exists to put the piece under the
  // page's clipping plane, and the plane is horizontal.
  t[1] -= sink
  return [
    L[0][0], L[1][0], L[2][0], 0,
    L[0][1], L[1][1], L[2][1], 0,
    L[0][2], L[1][2], L[2][2], 0,
    t[0], t[1], t[2], 1,
  ]
}

function localQuat(c: FoldChunk, psi: number): Quat {
  const A = cross3(c.rise, c.fall)
  // The piece's paper rotation is about A through (90deg - psi): zero at rest, a quarter turn
  // when flat. Normals ride THIS, never the sheared linear part.
  const alpha = Math.PI / 2 - psi
  const h = alpha / 2
  const s = Math.sin(h)
  return [A[0] * s, A[1] * s, A[2] * s, Math.cos(h)]
}

const IDENTITY_M: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const IDENTITY_Q: Quat = [0, 0, 0, 1]

/**
 * Pose every chunk for a curtain-up progress. Parents are solved before their children (the
 * table is ordered that way), so composition is a single forward pass.
 *
 * At `open >= 1` every matrix is exactly the identity and every crease exactly 0: the rest pose
 * and its pixels are untouched by the existence of this file.
 */
export function solveFoldBirth(open: number): FoldPose[] {
  const byName = new Map<FoldChunkName, FoldPose>()
  const out: FoldPose[] = []
  for (const c of FOLD_CHUNKS) {
    const u = stageU(open, FOLD_EVENTS[c.event])
    const q = stageSettleProgress(u)
    const psi = (q * Math.PI) / 2
    const sink = c.sink * sinkFactor(Math.sin(psi))
    const own = localMatrix(c, psi, c.thump * thumpShape(u), sink)
    const ownQ = localQuat(c, psi)
    const parent = c.parent ? byName.get(c.parent) : undefined
    const pose: FoldPose = {
      name: c.name,
      slot: foldSlot(c.name),
      matrix: parent ? mulMat(parent.matrix, own) : own,
      quat: parent ? mulQuat(parent.quat, ownQ) : ownQ,
      crease: c.creaseGain * (1 - Math.sin(psi)),
      u,
      sink: sink + (parent?.sink ?? 0),
    }
    byName.set(c.name, pose)
    out.push(pose)
  }
  return out
}

/** The identity pose that lives in slot 0 — exported so the runtime can seed the array. */
export const FOLD_IDENTITY = { matrix: IDENTITY_M, quat: IDENTITY_Q } as const

// ---------------------------------------------------------------------------------------------
// LANDING CUES — the hook a sound layer will hang off
// ---------------------------------------------------------------------------------------------

export type FoldLanding = { readonly name: FoldChunkName; readonly event: FoldEventName }

type LandingListener = (landing: FoldLanding) => void

const landingListeners = new Set<LandingListener>()

/** Subscribe to "a piece just hit its stop". Returns the unsubscribe. */
export function onFoldLanding(listener: LandingListener): () => void {
  landingListeners.add(listener)
  return () => landingListeners.delete(listener)
}

/**
 * A per-consumer edge detector over a solved curtain-up: fires each piece's landing exactly once
 * as its progress crosses into the settle, and re-arms if the reader turns the page back. The
 * thump is already IN the pose; this is only the cue a sound layer needs.
 */
export function createLandingWatch(): (poses: readonly FoldPose[]) => void {
  const previous = new Map<FoldChunkName, number>()
  return (poses) => {
    for (const pose of poses) {
      const before = previous.get(pose.name) ?? 0
      previous.set(pose.name, pose.u)
      if (before < SETTLE_TAIL && pose.u >= SETTLE_TAIL && landingListeners.size > 0) {
        const chunk = FOLD_CHUNKS.find((c) => c.name === pose.name)
        if (chunk) for (const fn of landingListeners) fn({ name: chunk.name, event: chunk.event })
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// THE SIGN BOARD — the last beat of the curtain-up, kept as its own sub-move
// ---------------------------------------------------------------------------------------------

/**
 * "The sign drops onto its bracket and swings" is event 4 of the original curtain-up and it
 * survives the fold-birth intact — it is simply crease-born now. The board rides the bracket's
 * swing folded UP against the arm, and falls onto its shackle over the back half of the dressing
 * window. Returns the board's hinge angle in radians: PI/2 folded up, 0 hanging.
 */
export const SIGN_BOARD_LAG = 0.45

export function signBoardAngle(open: number): number {
  const u = stageU(open, FOLD_EVENTS.dressing)
  const boardU = clamp01((u - SIGN_BOARD_LAG) / (1 - SIGN_BOARD_LAG))
  return (1 - stageSettleProgress(boardU)) * (Math.PI / 2)
}

// ---------------------------------------------------------------------------------------------
// BENCH SUPPORT — the footprint the gates measure against
// ---------------------------------------------------------------------------------------------

/** The open spread's own footprint. Anything outside it at close hangs off the trim. */
export const FOLD_FOOTPRINT = SPREAD

/** The eight corners of a chunk's rest-space AABB — what the containment gates transform. */
export function extentCorners(c: FoldChunk): Vec3[] {
  const { min, max } = c.extent
  const out: Vec3[] = []
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) out.push([x, y, z])
    }
  }
  return out
}

/** Apply a solved (column-major) world map to a rest-space point. */
export function applyFoldMatrix(m: readonly number[], p: Vec3): Vec3 {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ]
}
