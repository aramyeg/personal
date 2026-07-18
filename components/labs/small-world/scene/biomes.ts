/**
 * Authored biome map — the single hand-placed source of truth for the six
 * wedge-scenes the world renews between (Task 20). The planet is divided into
 * three longitude BANDS (meridians at m_j = j·2π/3 + STANCE_ALPHA); each band
 * carries a variant-A scene (lap 1) and a variant-B scene (lap 2), so six
 * distinct wedges tile the two-lap journey:
 *
 *   band 0  A0 BlueNet spring pond    · B0 Accenture golden dunes
 *   band 1  A1 FLYERBEE flower field  · B1 AKNA brown canyon creek
 *   band 2  A2 360dialog grand delta  · B2 xDataGroup winter summit
 *
 * TWO structural invariants keep the renewal seamless (they replace the retired
 * Task-15/16 spineGate + strait). Round 6 makes the limbs ASYMMETRIC:
 *  - The one ocean (left, −x): a single permanent deep-water cap grown big and
 *    given a deterministic azimuthal coastline warp (bays + headlands, an offshore
 *    island or two). Variant-INVARIANT, so the left limb reads as one irregular
 *    sea in every frame forever and never pops across the A/B flip. The RIGHT
 *    limb (+x) is NO LONGER an ocean — it is continental coast (land), with a
 *    warped shore where a shelf sea laps in only at some longitudes.
 *  - Wedge gate: every wedge delta is multiplied by wedgeGate = meridianGate ·
 *    polarLatGate, which is EXACTLY 0 within 0.075 rad of any meridian and fades
 *    to 0 by |nx| = 0.75. So (a) on every meridian bumpA === bumpB === base +
 *    ocean carve (all four abutting scenes seam through one shared meadow), and
 *    (b) the limbs are bit-identical across variants: the left limb invariantly
 *    ocean, the right limb invariantly coast. Every wedge routes its water to the
 *    LEFT ocean or an authored local sea; the grand delta drains inland-source →
 *    braid → the left ocean, filling it at the limb.
 *
 * Coordinate frame: planet-LOCAL unit directions. The girl walks the great
 * circle at nx=0; the planet spins about x, so nx=±1 are the permanent poles.
 * Scene relief lives OFF her lane (|nx| ≥ ~0.3) so her lane stays gentle and
 * walkable; the only thing that touches nx=0 is a channel carve at each of the
 * six authored crossings (one wooden bridge per wedge).
 *
 * Purity: every evaluator is a pure scalar function; arc planes + directions are
 * precomputed at module load so the hot paths allocate nothing. Zero cross-module
 * imports (like renewal.ts) so `node bench/*.mjs` can import this file directly —
 * STANCE_ALPHA / canonicalTheta are duplicated here, not imported.
 */

export type Cap = { dir: readonly [number, number, number]; radius: number; feather: number }
export type Peak = { dir: readonly [number, number, number]; h: number; r: number }
/** A basin of water: a cap that carves the terrain down to a floor. */
export type WaterBody = Cap & { depth: number }

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)
const smoothstep01 = (t: number): number => {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}
const clampU = (t: number): number => (t < -1 ? -1 : t > 1 ? 1 : t)

function norm3(v: readonly [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

// --- Structural frame (bands, meridians, gates) ----------------------------

const PLANET_RADIUS = 2.2
const TWO_PI = Math.PI * 2
/** Duplicated from renewal.ts (kept a zero-import leaf for the Node benches). */
const STANCE_ALPHA = Math.asin(0.75 / PLANET_RADIUS)
const BAND_SPAN = TWO_PI / 3

/** Canonical vertex-theta wrap (mirrors renewal.canonicalTheta exactly). */
export function canonicalTheta(a: number): number {
  let t = a
  while (t < STANCE_ALPHA) t += TWO_PI
  while (t >= STANCE_ALPHA + TWO_PI) t -= TWO_PI
  return t
}

/** The three band meridians. Chapter j travels band (j mod 3). */
export const MERIDIANS = [
  STANCE_ALPHA,
  STANCE_ALPHA + BAND_SPAN,
  STANCE_ALPHA + 2 * BAND_SPAN,
] as const

/** Band index 0..2 of a canonical longitude. */
export function bandOf(thetaC: number): 0 | 1 | 2 {
  const k = Math.floor((thetaC - STANCE_ALPHA) / BAND_SPAN)
  return (((k % 3) + 3) % 3) as 0 | 1 | 2
}

/** Angular distance (rad) from a longitude to the nearest meridian. */
export function meridianDist(thetaC: number): number {
  let best = Infinity
  for (let i = 0; i < MERIDIANS.length; i++) {
    let d = Math.abs(thetaC - MERIDIANS[i]) % TWO_PI
    if (d > Math.PI) d = TWO_PI - d
    if (d < best) best = d
  }
  return best
}

// Neutral connective bands (Task 20 R2): tightened from 0.12 → 0.075 half-width
// (same 0.833 feather ratio) so the green meridian seams read as brief countryside
// breaths between scenes, not hard borders. Still EXACTLY 0 on each meridian
// (meridianDist=0), so the A/B identity + m0 wrap-identity strip are untouched.
const MERIDIAN_HALF = 0.075
const MERIDIAN_RAMP = 0.0625
/** 0 within MERIDIAN_HALF of a meridian, ramping to 1 in the band interior. */
export function meridianGate(thetaC: number): number {
  return smoothstep01((meridianDist(thetaC) - MERIDIAN_HALF) / MERIDIAN_RAMP)
}

/** 1 near the spine, fading to 0 by |nx| = 0.75 (protects the polar caps/beach).
 *  R2: holds full to |nx|=0.68 then drops sharply to 0 at 0.75, so wedge water
 *  (the grand delta's arms) reaches closer to the polar-ocean shore before the
 *  structural gate takes over — the blue-limb → channel → blue-limb read joins up
 *  instead of leaving a dry shallow gap. Still EXACTLY 0 for |nx| ≥ 0.75. */
export function polarLatGate(nx: number): number {
  return 1 - smoothstep01((Math.abs(nx) - 0.68) / 0.07)
}

/** Master mask for every wedge delta — zero on the meridians AND at the poles. */
export function wedgeGate(thetaC: number, nx: number): number {
  return meridianGate(thetaC) * polarLatGate(nx)
}

/**
 * Gate for the COLOUR accent only (decoupled from the terrain gate): a thinner
 * meridian seam and a latitude fade that holds almost to the ocean shore, so
 * each wedge's saturated identity reaches the limbs instead of dissolving into a
 * green crescent. Terrain identity (biomeBump) is unaffected — this shapes paint.
 */
export function colorGate(thetaC: number, nx: number): number {
  const seam = smoothstep01((meridianDist(thetaC) - 0.05) / 0.08)
  const lat = 1 - smoothstep01((Math.abs(nx) - 0.74) / 0.12)
  return seam * lat
}

// --- Water ------------------------------------------------------------------

/** Water glaze radius as a fraction of PLANET_RADIUS. */
export const WATER_LEVEL = 0.972

/** The one great ocean, on the LEFT limb (−x) — variant-INVARIANT (Round 6). Grown
 *  from the old radius-0.8 cap; `POLAR_L.radius` is its BASE angular radius, warped
 *  per-azimuth by `oceanWarp` into an irregular coastline (bays + headlands). The
 *  right limb has NO ocean (POLAR_R deleted): it is continental coast. Base radius
 *  1.05 with warp amp 0.15 keeps the invariant core |nx|>0.75 solidly ocean while
 *  the shore swings between nx≈−0.42 (headland) and nx≈−0.67 (bay). */
export const POLAR_L: WaterBody = { dir: [-1, 0, 0], radius: 1.05, feather: 0.34, depth: 0.13 }
/** Back-compat: the ocean list (a single body now). */
export const POLAR_OCEANS: readonly WaterBody[] = [POLAR_L]

const OCEAN_WARP_AMP = 0.15
/** Deterministic low-frequency coastline warp: the azimuth φ around the −x pole
 *  (which equals a point's longitude θ) → a bounded ~[-1,1] offset added to the
 *  ocean's angular radius, carving bays and headlands. The 3φ octave (period 2π/3,
 *  phased to peak at the three band centres) lets the sea reach inland where each
 *  wedge drains into it; the 5φ + 2φ octaves break the 3-fold symmetry so no two
 *  headlands/bays match (the irregular coast Aram asked for). Pure sines (NO
 *  Math.random); shared by both variants, so the warped left limb is bit-identical
 *  A vs B (the structural invariant). */
function oceanWarp(ny: number, nz: number): number {
  const phi = Math.atan2(nz, ny)
  return 0.45 * Math.sin(3 * phi - 2.618) + 0.35 * Math.sin(5 * phi - 1.9) + 0.2 * Math.sin(2 * phi + 2.4)
}
/** Feathered 0..1 membership of the warped left ocean at a unit point. */
export function oceanMask(nx: number, ny: number, nz: number): number {
  const d = Math.acos(clampU(-nx)) // angular distance to the −x pole
  const eff = POLAR_L.radius + OCEAN_WARP_AMP * oceanWarp(ny, nz)
  return smoothstep01((eff - d) / POLAR_L.feather)
}

/** Smooth 0..1 membership of a cap, feathered at its rim. */
export function capMask(nx: number, ny: number, nz: number, cap: Cap): number {
  const dot = clampU(nx * cap.dir[0] + ny * cap.dir[1] + nz * cap.dir[2])
  const d = Math.acos(dot)
  return smoothstep01((cap.radius - d) / cap.feather)
}

/** A gaussian swell's contribution at a unit point (shared peak evaluator). */
function peakBump(nx: number, ny: number, nz: number, p: Peak): number {
  const dot = clampU(nx * p.dir[0] + ny * p.dir[1] + nz * p.dir[2])
  const g = Math.acos(dot) / p.r
  return p.h * Math.exp(-g * g)
}

// --- Great-circle arcs (channel centre-lines) ------------------------------

type Arc = {
  ax: number; ay: number; az: number
  bx: number; by: number; bz: number
  nx: number; ny: number; nz: number
  ab: number
}
function makeArc(a: readonly [number, number, number], b: readonly [number, number, number]): Arc {
  const [ax, ay, az] = norm3(a)
  const [bx, by, bz] = norm3(b)
  const cx = ay * bz - az * by
  const cy = az * bx - ax * bz
  const cz = ax * by - ay * bx
  const [nx, ny, nz] = norm3([cx, cy, cz])
  const ab = Math.acos(clampU(ax * bx + ay * by + az * bz))
  return { ax, ay, az, bx, by, bz, nx, ny, nz, ab }
}
/** Angular distance from a unit point to a great-circle arc segment (radians). */
function arcDist(px: number, py: number, pz: number, arc: Arc): number {
  const pn = px * arc.nx + py * arc.ny + pz * arc.nz
  let qx = px - arc.nx * pn
  let qy = py - arc.ny * pn
  let qz = pz - arc.nz * pn
  const ql = Math.hypot(qx, qy, qz) || 1
  qx /= ql; qy /= ql; qz /= ql
  const angA = Math.acos(clampU(qx * arc.ax + qy * arc.ay + qz * arc.az))
  const angB = Math.acos(clampU(qx * arc.bx + qy * arc.by + qz * arc.bz))
  if (angA + angB <= arc.ab + 1e-3) return Math.abs(Math.asin(clampU(pn)))
  const dA = Math.acos(clampU(px * arc.ax + py * arc.ay + pz * arc.az))
  const dB = Math.acos(clampU(px * arc.bx + py * arc.by + pz * arc.bz))
  return dA < dB ? dA : dB
}

/** Unit direction at latitude nx and longitude theta (matches anchorTransform). */
function place(nx: number, theta: number): [number, number, number] {
  const ring = Math.sqrt(Math.max(0, 1 - nx * nx))
  return [nx, ring * Math.cos(theta), ring * Math.sin(theta)]
}
/** Point on the girl's ring (nx=0) at a crossing longitude. */
function crossPoint(theta: number): [number, number, number] {
  return [0, Math.cos(theta), Math.sin(theta)]
}

// --- Authored crossings (one wooden bridge per wedge) ----------------------

/** Per-variant spine crossings, indexed by band. Each ≥ 0.25 rad from every
 *  meridian and ≥ 0.12 rad from its own chapter's near-spine props. Variant A
 *  (chapters 0–2) on lap 1, variant B (chapters 3–5) on lap 2. */
export const CROSSINGS_A = [1.7, 3.52, 5.8] as const
export const CROSSINGS_B = [1.2, 3.22, 5.3] as const
/** Back-compat alias (old importers). */
export const RIVER_CROSSINGS = CROSSINGS_A

// --- Channels: streams, the grand delta, the canyon creek ------------------

/** A carved water channel. `widen` (optional) grows the half-width + depth with
 *  |nx| so a channel can stay a narrow bridge-span at the girl's lane (nx≈0) yet
 *  open into a broad, deep artery off the lane — used by the grand delta so the
 *  water is the protagonist across the face without flooding the near-spine props
 *  or the walkable lane. */
type Channel = {
  arcs: Arc[]
  half: number
  ramp: number
  depth: number
  /** Grows half-width + depth off the lane. Metric is |nx| by default, or −nx when
   *  `neg` is set (the grand delta widens ONLY toward the left ocean, so the inland
   *  source stays a narrow thread while the mouth opens into a broad braided fan). */
  widen?: { half: number; depth: number; lo: number; hi: number; neg?: boolean }
}

const STREAM_HALF = 0.04
const STREAM_RAMP = 0.05
const STREAM_DEPTH = 0.055
const DELTA_HALF = 0.1
const DELTA_RAMP = 0.08
const DELTA_DEPTH = 0.07
const CREEK_HALF = 0.055
const CREEK_RAMP = 0.05
const CREEK_DEPTH = 0.08

/** A single stream from a spine crossing out to the LEFT ocean (pole at −x, so
 *  sign is −1 for every wedge now the right ocean is gone). `sign` is retained for
 *  clarity/back-compat but the mouth always lands in the one ocean. */
function streamChannel(theta: number, sign: 1 | -1, depth = STREAM_DEPTH): Channel {
  const c = crossPoint(theta)
  const mouth: [number, number, number] = [sign * 0.82, c[1] * 0.18, c[2] * 0.18]
  return { arcs: [makeArc(c, mouth)], half: STREAM_HALF, ramp: STREAM_RAMP, depth }
}

/** The continent-break strait (A0): a wide water gap that cuts the spring continent
 *  in two — the LEFT ocean on one side, a right-limb inlet sea (A0_INLET) on the
 *  other, the girl's ONLY continuation the bridge across the lane. `widen` opens the
 *  gap off-lane toward BOTH shores (metric |nx|) yet stays a bridge-span at the lane
 *  (lo 0.16), so the deck provably covers the wet lane. */
function straitChannel(theta: number): Channel {
  const c = crossPoint(theta)
  const lMouth: [number, number, number] = [-0.82, c[1] * 0.18, c[2] * 0.18]
  const rInlet = place(0.58, theta + 0.3) // right inlet sea, angled off the near-lane props
  // Width (not depth) carries the "wide strait" read at the lane, so the on-bridge
  // ramp stays gentle for the girl; the flanks deepen off-lane into the two seas.
  const widen = { half: 0.12, depth: 0.04, lo: 0.16, hi: 0.5 }
  return { arcs: [makeArc(c, lMouth), makeArc(c, rInlet)], half: 0.09, ramp: 0.08, depth: 0.055, widen }
}

/** The grand delta (A2, Round 6 redesign): the artery rises INLAND at a highland
 *  tarn (A2_SOURCE, off-lane at +nx), steps down through the spine crossing and
 *  broadens into a braided fan that drains INTO the LEFT ocean — one-glance read
 *  inland thread → widening braid → open blue at the left limb. `widen` is signed
 *  (`neg`), growing ONLY toward −x, so the source stays a narrow thread while the
 *  mouth opens wide; the under-bridge crossing stays a modest wet span. Sand islets
 *  (A_PEAKS[2]) and the stepping-stone discs poke out of the braid as sandbars. */
function deltaChannel(theta: number): Channel {
  const c = crossPoint(theta)
  const lMouth: [number, number, number] = [-0.82, c[1] * 0.18, c[2] * 0.18]
  const source = place(0.5, 6.0) // highland tarn (matches A2_SOURCE)
  const feeder = place(0.32, theta + 0.08) // steps down toward the lane
  // braids fan into the left-ocean approach so the mouth reads as one wide delta.
  const braidA = place(-0.3, theta + 0.14)
  const braidB = place(-0.4, theta - 0.1)
  const widen = { half: 0.22, depth: 0.05, lo: 0.04, hi: 0.52, neg: true }
  return {
    arcs: [
      makeArc(source, feeder),
      makeArc(feeder, c),
      makeArc(c, lMouth),
      makeArc(braidA, [-0.76, braidA[1] * 0.22, braidA[2] * 0.22]),
      makeArc(braidB, [-0.8, braidB[1] * 0.18, braidB[2] * 0.18]),
    ],
    half: DELTA_HALF,
    ramp: DELTA_RAMP,
    depth: DELTA_DEPTH,
    widen,
  }
}

/** The canyon creek: a meandering channel from the spine crossing to a polar
 *  ocean, snaking down the canyon floor (its earth walls are added separately in
 *  sceneRaw). Three segments give it a clear S-bend so it reads as a river in a
 *  gorge, not a straight ditch. */
function creekChannel(theta: number, sign: 1 | -1): Channel {
  const c = crossPoint(theta)
  const bend1 = crossPoint(theta + 0.14)
  const bend2 = crossPoint(theta - 0.06)
  const midA: [number, number, number] = [sign * 0.3, bend1[1] * 0.72, bend1[2] * 0.72]
  const midB: [number, number, number] = [sign * 0.55, bend2[1] * 0.42, bend2[2] * 0.42]
  const mouth: [number, number, number] = [sign * 0.82, c[1] * 0.18, c[2] * 0.18]
  return {
    arcs: [makeArc(c, midA), makeArc(midA, midB), makeArc(midB, mouth)],
    half: CREEK_HALF,
    ramp: CREEK_RAMP,
    depth: CREEK_DEPTH,
  }
}

/** Variant channels indexed by band (band 0,1,2). Every wedge routes to the ONE
 *  left ocean now (Round 6); A0 is the continent-break strait, A2 the inland-source
 *  grand delta. */
const A_CHANNELS: readonly Channel[] = [
  straitChannel(CROSSINGS_A[0]), // A0 continent-break strait: left ocean ↔ right inlet
  streamChannel(CROSSINGS_A[1], -1), // A1 isthmus stream → left ocean
  deltaChannel(CROSSINGS_A[2]), // A2 grand delta: inland source → left ocean
]
const B_CHANNELS: readonly Channel[] = [
  streamChannel(CROSSINGS_B[0], -1), // B0 oasis stream → left ocean
  creekChannel(CROSSINGS_B[1], -1), // B1 canyon creek → left ocean
  streamChannel(CROSSINGS_B[2], -1), // B2 frozen creek → left ocean
]
const CHANNELS = [A_CHANNELS, B_CHANNELS] as const

function channelCarve(nx: number, ny: number, nz: number, ch: Channel): number {
  let d = Infinity
  for (let i = 0; i < ch.arcs.length; i++) {
    const x = arcDist(nx, ny, nz, ch.arcs[i])
    if (x < d) d = x
  }
  let half = ch.half
  let depth = ch.depth
  if (ch.widen) {
    const metric = ch.widen.neg ? -nx : Math.abs(nx)
    const f = smoothstep01((metric - ch.widen.lo) / (ch.widen.hi - ch.widen.lo))
    half += ch.widen.half * f
    depth += ch.widen.depth * f
  }
  if (d >= half + ch.ramp) return 0
  return -depth * (1 - smoothstep01((d - half) / ch.ramp))
}

/** Distance (rad) to the nearest channel centre-line of a variant (beach tint). */
export function channelDist(nx: number, ny: number, nz: number, variant: 0 | 1): number {
  const set = CHANNELS[variant]
  let d = Infinity
  for (let b = 0; b < set.length; b++) {
    for (let i = 0; i < set[b].arcs.length; i++) {
      const x = arcDist(nx, ny, nz, set[b].arcs[i])
      if (x < d) d = x
    }
  }
  return d
}

// --- Local water bodies (ponds / oasis / frozen pond), per variant ----------

type LocalBody = { band: 0 | 1 | 2; body: WaterBody }
/** A0 glassy spring pond. */
const A0_POND: WaterBody = { dir: norm3(place(0.36, 1.3)), radius: 0.15, feather: 0.1, depth: 0.05 }
/** A0 continent-break: the right-limb inlet sea — the far shore of the strait that
 *  cuts the spring continent, so the bridge crosses open water with coast both sides. */
const A0_INLET: WaterBody = { dir: norm3(place(0.55, 1.7)), radius: 0.26, feather: 0.12, depth: 0.06 }
/** A1 isthmus: a right-limb shelf sea that laps in opposite an ocean headland,
 *  pinching the flower land into a narrow neck (the girl still crosses on dry lane). */
const A1_SHELF: WaterBody = { dir: norm3(place(0.55, 3.25)), radius: 0.26, feather: 0.14, depth: 0.09 }
/** A2 grand-delta inland source: a highland tarn feeding the braided delta down to
 *  the left ocean. */
const A2_SOURCE: WaterBody = { dir: norm3(place(0.5, 6.0)), radius: 0.14, feather: 0.09, depth: 0.09 }
/** B0 desert oasis pool. */
const B0_OASIS: WaterBody = { dir: norm3(place(0.3, 1.12)), radius: 0.11, feather: 0.08, depth: 0.05 }
/** B2 frozen pond. */
const B2_FROZEN: WaterBody = { dir: norm3(place(0.34, 5.55)), radius: 0.14, feather: 0.1, depth: 0.045 }
const A_PONDS: readonly LocalBody[] = [
  { band: 0, body: A0_POND },
  { band: 0, body: A0_INLET },
  { band: 1, body: A1_SHELF },
  { band: 2, body: A2_SOURCE },
]
const B_PONDS: readonly LocalBody[] = [
  { band: 0, body: B0_OASIS },
  { band: 2, body: B2_FROZEN },
]
const PONDS = [A_PONDS, B_PONDS] as const

/** One or two LOW offshore islands poking above the left ocean (invariant relief).
 *  Kept low so the renewal-scan occlusion budget and the 1.35R ceiling hold —
 *  coastal cliffs read via colour, not height. */
const OCEAN_ISLANDS: readonly Peak[] = [
  { dir: norm3(place(-0.58, 2.1)), h: 0.1, r: 0.08 },
  { dir: norm3(place(-0.55, 4.35)), h: 0.09, r: 0.075 },
]

// --- Scene relief (positive swells), per variant per band -------------------

const A_PEAKS: readonly (readonly Peak[])[] = [
  // A0 spring: soft rolling hills
  [
    { dir: norm3(place(0.44, 1.05)), h: 0.05, r: 0.28 },
    { dir: norm3(place(-0.42, 1.55)), h: 0.045, r: 0.26 },
    { dir: norm3(place(0.5, 1.95)), h: 0.04, r: 0.24 },
  ],
  // A1 flower field: broad terraced meadow swells
  [
    { dir: norm3(place(0.4, 2.95)), h: 0.055, r: 0.32 },
    { dir: norm3(place(-0.46, 3.5)), h: 0.05, r: 0.3 },
    { dir: norm3(place(0.48, 3.95)), h: 0.045, r: 0.28 },
  ],
  // A2 delta: inland HIGHLAND (source of the artery) + low braided sandbanks/islets
  // between the wide channel arms; each near-spine / off-lane stepping-stone disc
  // sits on its own islet so it pokes out of the widened water as a sandbar (dry
  // anchor) rather than drowning.
  [
    { dir: norm3(place(0.7, 6.15)), h: 0.12, r: 0.15 }, // highland ridge cradling the tarn source
    { dir: norm3(place(0.62, 5.8)), h: 0.09, r: 0.15 }, // highland shoulder stepping down to the lane
    { dir: norm3(place(0.34, 5.5)), h: 0.03, r: 0.2 },
    { dir: norm3(place(-0.34, 5.95)), h: 0.03, r: 0.2 },
    { dir: norm3(place(-0.26, 5.54)), h: 0.1, r: 0.15 }, // sandbar holding the -x delta discs above the widened artery
    { dir: norm3(place(0.28, 5.63)), h: 0.08, r: 0.15 }, // sandbar holding the +x delta discs above the widened artery
    { dir: norm3(place(0.52, 5.62)), h: 0.06, r: 0.06 }, // islet
    { dir: norm3(place(-0.5, 5.9)), h: 0.05, r: 0.055 }, // islet
    { dir: norm3(place(0.318, 5.668)), h: 0.08, r: 0.06 }, // stepping-stone islet (ch2 disc t0.54 x0.7 → nx0.318)
  ],
]
const B_PEAKS: readonly (readonly Peak[])[] = [
  // B0 golden dunes: ripple ridge swells
  [
    { dir: norm3(place(0.4, 0.95)), h: 0.1, r: 0.22 },
    { dir: norm3(place(-0.44, 1.3)), h: 0.11, r: 0.2 },
    { dir: norm3(place(0.5, 1.62)), h: 0.09, r: 0.22 },
    { dir: norm3(place(-0.5, 1.92)), h: 0.1, r: 0.2 },
    { dir: norm3(place(0.36, 2.02)), h: 0.08, r: 0.24 },
  ],
  // B1 canyon: standalone mesas beside the creek (walls added in sceneRaw)
  [
    { dir: norm3(place(0.52, 3.3)), h: 0.17, r: 0.12 },
    { dir: norm3(place(-0.5, 3.72)), h: 0.15, r: 0.13 },
    { dir: norm3(place(0.46, 4.05)), h: 0.13, r: 0.13 },
  ],
  // B2 winter summit: drift mounds + snowy spires
  [
    { dir: norm3(place(0.4, 5.28)), h: 0.06, r: 0.22 },
    { dir: norm3(place(-0.42, 5.62)), h: 0.055, r: 0.22 },
    { dir: norm3(place(0.46, 5.95)), h: 0.05, r: 0.2 },
    { dir: norm3(place(0.52, 5.42)), h: 0.24, r: 0.1 }, // spire
    { dir: norm3(place(-0.52, 5.82)), h: 0.22, r: 0.1 }, // spire
  ],
]

// --- Canyon walls (B1 only) -------------------------------------------------

const B1_CREEK = B_CHANNELS[1]
const CANYON_BANK_H = 0.16
/** Distance to the B1 creek centre-line (for walls + canyon tint). */
export function canyonCreekDist(nx: number, ny: number, nz: number): number {
  let d = Infinity
  for (let i = 0; i < B1_CREEK.arcs.length; i++) {
    const x = arcDist(nx, ny, nz, B1_CREEK.arcs[i])
    if (x < d) d = x
  }
  return d
}
/** Raised earth walls flanking the B1 creek, gated off the girl's lane so she
 *  never faces a cliff (walls rise only for |nx| ≳ 0.15). */
function canyonWalls(nx: number, ny: number, nz: number): number {
  const cd = canyonCreekDist(nx, ny, nz)
  if (cd >= CREEK_HALF + 0.18) return 0
  const latG = smoothstep01((Math.abs(nx) - 0.15) / 0.2)
  if (latG <= 0) return 0
  const wall =
    smoothstep01((cd - CREEK_HALF) / 0.04) - smoothstep01((cd - CREEK_HALF - 0.09) / 0.05)
  return CANYON_BANK_H * latG * wall
}

// --- Assembled displacement -------------------------------------------------

/** The one left ocean carved below the waterline (variant-INVARIANT): the warped
 *  coastline cap plus a couple of low offshore island swells. */
function oceanCarve(nx: number, ny: number, nz: number): number {
  let c = -POLAR_L.depth * oceanMask(nx, ny, nz)
  for (let i = 0; i < OCEAN_ISLANDS.length; i++) c += peakBump(nx, ny, nz, OCEAN_ISLANDS[i])
  return c
}

/** Raw wedge relief for a band+variant, BEFORE the wedge gate. */
function sceneRaw(band: 0 | 1 | 2, nx: number, ny: number, nz: number, variant: 0 | 1): number {
  let bump = 0
  const peaks = (variant === 0 ? A_PEAKS : B_PEAKS)[band]
  for (let i = 0; i < peaks.length; i++) bump += peakBump(nx, ny, nz, peaks[i])
  bump += channelCarve(nx, ny, nz, CHANNELS[variant][band])
  const ponds = PONDS[variant]
  for (let i = 0; i < ponds.length; i++) {
    if (ponds[i].band === band) bump -= ponds[i].body.depth * capMask(nx, ny, nz, ponds[i].body)
  }
  if (variant === 1 && band === 1) bump += canyonWalls(nx, ny, nz)
  return bump
}

/** Wedge delta at a point for a variant: sceneRaw × wedgeGate (0 on meridians,
 *  0 at the poles), so both variants collapse to the shared base at every seam. */
export function wedgeDelta(nx: number, ny: number, nz: number, variant: 0 | 1): number {
  const thetaC = canonicalTheta(Math.atan2(nz, ny))
  const g = wedgeGate(thetaC, nx)
  if (g <= 0) return 0
  return g * sceneRaw(bandOf(thetaC), nx, ny, nz, variant)
}

/** Variant-A authored displacement (lap 1). */
export function biomeBump(nx: number, ny: number, nz: number): number {
  return oceanCarve(nx, ny, nz) + wedgeDelta(nx, ny, nz, 0)
}
/** Variant-B authored displacement (lap 2). Equals biomeBump on every meridian
 *  and at the limbs by construction (wedgeGate = 0 there, oceanCarve is invariant). */
export function biomeBumpB(nx: number, ny: number, nz: number): number {
  return oceanCarve(nx, ny, nz) + wedgeDelta(nx, ny, nz, 1)
}

// --- Classification for the colour pass -------------------------------------

/** Strongest ocean + active-wedge local-water membership (0..1) at a point. */
export function waterMask(nx: number, ny: number, nz: number, variant: 0 | 1): number {
  let m = oceanMask(nx, ny, nz)
  const band = bandOf(canonicalTheta(Math.atan2(nz, ny)))
  const ponds = PONDS[variant]
  for (let i = 0; i < ponds.length; i++) {
    if (ponds[i].band === band) {
      const v = capMask(nx, ny, nz, ponds[i].body)
      if (v > m) m = v
    }
  }
  return m
}

export type BiomeKind = 'underwater' | 'beach' | 'canyon' | 'snow' | 'meadow'

/**
 * Cheap per-vertex classification for the colour pass, variant-aware.
 * `currentBump` is the full terrainBump (base + biome) so the caller doesn't
 * recompute it. Returns the terrain KIND; the wedge ACCENT (which green/gold/
 * brown/white) is applied by paintVertex from band + variant.
 */
export function biomeTint(
  nx: number,
  ny: number,
  nz: number,
  currentBump: number,
  variant: 0 | 1
): { kind: BiomeKind; t: number } {
  const radius = 1 + currentBump
  if (radius < WATER_LEVEL) {
    return { kind: 'underwater', t: clamp01((WATER_LEVEL - radius) / 0.08) }
  }
  const nearWater =
    waterMask(nx, ny, nz, variant) > 0.02 || channelDist(nx, ny, nz, variant) < STREAM_HALF + 0.06
  if (nearWater && radius < 0.987) {
    return { kind: 'beach', t: clamp01((0.987 - radius) / 0.015) }
  }
  const thetaC = canonicalTheta(Math.atan2(nz, ny))
  const band = bandOf(thetaC)
  // B1 canyon: the rich-brown gorge (near the creek) + standalone badland buttes
  // read as clay added onto the pink-warm surround. `t` runs 1 in the creek floor
  // (deepest brown) to 0 on the upper banks/rims (lightened terracotta) so the
  // gorge has authored floor-dark / rim-light contrast, not a flat brown wash.
  if (variant === 1 && band === 1 && meridianGate(thetaC) > 0.1 && polarLatGate(nx) > 0.1) {
    const cd = canyonCreekDist(nx, ny, nz)
    const CANYON_REACH = CREEK_HALF + 0.22
    const nearCreek = cd < CANYON_REACH
    const butte = currentBump > 0.045 // a raised mesa/butte of clay
    if (nearCreek || butte) {
      const t = nearCreek ? clamp01((CANYON_REACH - cd) / CANYON_REACH) : 0.35
      return { kind: 'canyon', t }
    }
  }
  // B2 winter summit reads as snow (colour-gated so it seams at the meridians but
  // reaches the shore before the polar ocean, no green crescent on the limb).
  if (variant === 1 && band === 2) {
    const w = colorGate(thetaC, nx)
    if (w > 0.05) return { kind: 'snow', t: w }
  }
  return { kind: 'meadow', t: 0 }
}
