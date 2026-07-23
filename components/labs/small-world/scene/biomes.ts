/**
 * Authored biome map — the single hand-placed source of truth for the six
 * wedge-scenes the world renews between (Task 20). The planet is divided into
 * three longitude BANDS (meridians at m_j = j·2π/3 + STANCE_ALPHA); each band
 * carries a variant-A scene (lap 1) and a variant-B scene (lap 2), so six
 * distinct wedges tile the two-lap journey:
 *
 *   band 0  A0 BlueNet spring + strait · B0 Accenture DUNES + PYRAMIDS (dry desert)
 *   band 1  A1 FLYERBEE flower field   · B1 AKNA canyon creek + shelf sea
 *   band 2  A2 360dialog grand delta   · B2 xDataGroup winter + shelf sea
 *
 * Round 7 (the flood arc): lap 1 (A) is the dry "before" — left ocean dominant,
 * right side continental coast. Across the B variants the water advances wedge by
 * wedge and the grazing right limb (|nx| ≥ 0.80) wets CONTINUOUSLY via the tide
 * (see tideCarve), so by journey's end the ocean has overflowed to the other side.
 * Task 41 (Aram, Round 12): the B0 desert wedge is now a DRY dune-and-pyramid scene —
 * its old right sea + breach strait (which cut a water passage across the desert face)
 * are retired; the overflow read is carried by the B1/B2 shelf seas (which still advance
 * FURTHER right wedge by wedge) plus the continuous limb tide (untouched). B0 keeps only
 * its single bridged crossing stream (draining LEFT to the ocean, like every wedge) and a
 * small classic oasis pool in an inter-dune hollow — no passage crosses the visible face.
 *
 * TWO structural invariants keep the renewal seamless (they replace the retired
 * Task-15/16 spineGate + strait). Round 6 makes the limbs ASYMMETRIC:
 *  - The one ocean (left, −x): a single permanent deep-water cap grown big and
 *    given a deterministic azimuthal coastline warp (bays + headlands, an offshore
 *    island or two). Task 25 (evolving caps): its mid-latitude COASTLINE now
 *    diverges per lap — a different sea comes around on lap 2 (bays where headlands
 *    were) — but the change is tapered back to bit-identical ocean at the grazing
 *    limb (|nx| ≥ 0.8, the screen-stable silhouette) so the flip is never caught on
 *    camera (capDivGate, occlusion-sweep proven). The RIGHT limb (+x) is
 *    NO LONGER an ocean — it is continental coast (land), whose shelf seas are
 *    authored per-wedge, so its shoreline likewise changes lap to lap. Round 7: on
 *    lap 2 those shelf seas advance further right wedge by wedge, and the grazing
 *    limb itself (|nx| ≥ 0.80) is wetted by the CONTINUOUS tide (tideCarve, a
 *    rotation-driven term layered by terrainBumpAt / the render, NOT part of the
 *    A/B bakes) — so the discrete bakes below still read the right limb as invariant
 *    coast, while the sampled/rendered world floods it monotonically across the journey.
 *  - Wedge gate: every wedge delta is multiplied by wedgeGate = meridianGate ·
 *    polarLatGate, which is EXACTLY 0 within 0.075 rad of any meridian and fades
 *    to 0 by |nx| = 0.75. So (a) on every meridian bumpA === bumpB === base +
 *    ocean carve (all four abutting scenes seam through one shared meadow — the
 *    ocean carve also collapses to one coastline there, capDivGate·meridianGate = 0),
 *    and (b) the GRAZING limbs (|nx| ≥ 0.8) are bit-identical across variants: the
 *    left limb invariantly ocean, the right limb invariantly coast (the left
 *    coastline diverges only at mid-latitude, below the limb). Every wedge routes
 *    its water to the LEFT ocean or an authored local sea; the grand delta drains
 *    inland-source → braid → the left ocean, filling it at the limb.
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
 * Latitude-only gate for the COLOUR accent (Task 38). Each wedge's saturated identity
 * paints at FULL strength right across its band — up to the HARD torn boundary curve
 * (see paintBand) — and fades ONLY toward the limbs (|nx| ≳ 0.74) into the beach/ocean.
 * The old meridian "seam" fade is GONE: abutting scenes now meet at a hard pressed-clay
 * boundary, not through a green connective band (Aram's Round-12 verdict). Terrain
 * identity (biomeBump) is unaffected — this shapes paint only.
 */
export function accentLatGate(nx: number): number {
  return 1 - smoothstep01((Math.abs(nx) - 0.74) / 0.12)
}

/** Index (0..2) of the meridian nearest a canonical longitude — selects which
 *  meridian's torn boundary curve a near-seam point is classified against. Pure. */
export function nearestMeridianIndex(thetaC: number): 0 | 1 | 2 {
  let best = Infinity
  let bestI: 0 | 1 | 2 = 0
  for (let i = 0; i < MERIDIANS.length; i++) {
    let d = Math.abs(thetaC - MERIDIANS[i]) % TWO_PI
    if (d > Math.PI) d = TWO_PI - d
    if (d < best) {
      best = d
      bestI = i as 0 | 1 | 2
    }
  }
  return bestI
}

// --- Torn biome boundaries (Task 38) ----------------------------------------
//
// Aram (Round 12): the green connective seams are REJECTED — "there should be a hard
// rough terrain change, without a seam." So two abutting wedges now meet like two slabs
// of clay pressed together: each paints its FULL accent right up to a shared boundary
// CURVE, which is not the straight meridian but an irregular hand-cut line.
//
// The boundary between band i−1 (low-longitude side) and band i is the curve
// longitude = m_i + boundaryWander(nx, i): a small deterministic multi-octave-sine fBm
// along latitude (fixed per-meridian phases), so the seam is torn, not ruled. It is a
// PURE function of position (no variant, no rotation) ⇒ variant-INVARIANT: the boundary
// sits in the same place on both laps, so it never flips. |offset| ≤ amp ≪ BAND_SPAN/2,
// so a point is always unambiguously on one side of its single nearest meridian.
//
// The RENEWAL identity moves from "paint A===B on the meridian" (retired with the seam)
// to the wedge-interior rule: near-meridian paint is now variant-dependent (full spring
// vs full winter), and that is safe because every such vertex flips A→B only inside the
// occlusion-proven-hidden renewalGate window — proven by the paint-delta pass in
// bench/renewal-scan.mjs (the geometry seam bumpA===bumpB on the meridian is UNTOUCHED,
// only paint goes hard). The boundary ridge below is invariant, so it never flips.

/** Shipped default of the torn-boundary wander amplitude (rad). Pinned equal to
 *  DIALS.boundaryWander.default in the tunables test; the benches import this so the
 *  proof uses the shipped curve. */
export const BOUNDARY_WANDER = 0.035
/** Shipped default of the pressed-lip height (fraction of R). Pinned equal to
 *  DIALS.boundaryRidge.default; the render + benches scale the ridge profile by it. */
export const BOUNDARY_RIDGE = 0.018

/** Unit torn-boundary offset shape for meridian i at latitude nx: a 3-octave sine fBm
 *  (amplitudes summing to 1, so |shape| ≤ 1) with golden-angle phases per meridian so
 *  the three seams are all differently torn. Deterministic, pure. */
function boundaryWanderShape(nx: number, i: number): number {
  const ph = i * 2.399963
  return (
    0.55 * Math.sin(3.1 * nx + 1.7 + ph) +
    0.3 * Math.sin(6.7 * nx - 0.9 + 2 * ph) +
    0.15 * Math.sin(12.3 * nx + 0.4 + 3 * ph)
  )
}
/** The torn-boundary longitude offset (rad) for meridian i at latitude nx, scaled by
 *  `amp` (the boundaryWander dial). |result| ≤ amp. Variant-invariant. */
export function boundaryWander(nx: number, i: number, amp: number): number {
  return amp * boundaryWanderShape(nx, i)
}

/** Signed longitude offset (rad, wrapped to (−π,π]) of a canonical longitude from its
 *  nearest meridian. Shared by paintBand + boundaryDist. */
function signedMeridianDelta(thetaC: number, i: number): number {
  let delta = thetaC - MERIDIANS[i]
  if (delta > Math.PI) delta -= TWO_PI
  else if (delta < -Math.PI) delta += TWO_PI
  return delta
}

/** Which wedge band's accent paints this point — HARD-switched at the torn boundary
 *  curve (Task 38). A point is in band i−1 if it lies on the low-longitude side of its
 *  nearest meridian's warped boundary, else band i. With amp = 0 this reproduces bandOf
 *  exactly (a straight meridian). Pure + variant-invariant, so both laps switch at the
 *  same curve. */
export function paintBand(thetaC: number, nx: number, amp: number = BOUNDARY_WANDER): 0 | 1 | 2 {
  const i = nearestMeridianIndex(thetaC)
  const delta = signedMeridianDelta(thetaC, i)
  return delta < boundaryWander(nx, i, amp) ? (((i + 2) % 3) as 0 | 1 | 2) : (i as 0 | 1 | 2)
}

/** Surface angular distance (rad) from a point to its nearest torn boundary curve —
 *  drives the pressed-lip + crease profile. Scaled by the ring radius so the crease
 *  keeps a constant surface width and narrows to 0 at the poles (where it is faded out
 *  anyway). Pure + variant-invariant. */
export function boundaryDist(thetaC: number, nx: number, amp: number = BOUNDARY_WANDER): number {
  const i = nearestMeridianIndex(thetaC)
  const delta = signedMeridianDelta(thetaC, i)
  const ring = Math.sqrt(Math.max(0, 1 - nx * nx))
  return Math.abs(delta - boundaryWander(nx, i, amp)) * ring
}

// Pressed-lip profile geometry (surface radians): full lip within HALF of the curve,
// ramping to 0 by HALF+RAMP.
const RIDGE_HALF = 0.012
const RIDGE_RAMP = 0.03
/**
 * Pressed-clay lip profile [0,1] centred on the torn boundary curve (Task 38 — "two
 * slabs of clay pressed together"). Returns a UNIT profile the caller scales by the
 * ridge-height dial. Gated:
 *  - EXACTLY 0 on the girl's lane band (|nx| < 0.14, hard early-return like fieldDents),
 *    so it adds NO spine-band displacement term — the analytic contact bound (0.01247R)
 *    is untouched, and the deck footprints (all on the lane) carry no lip.
 *  - faded to 0 before the limbs (|nx| ≥ 0.72), so it never touches the grazing
 *    silhouette / the invariant polar caps.
 * Variant-invariant (pure position fn), so it is identical in both bakes and the renewal
 * front lerps it as a no-op (it never flips). */
export function boundaryRidgeShape(nx: number, ny: number, nz: number, amp: number = BOUNDARY_WANDER): number {
  const ax = Math.abs(nx)
  if (ax < 0.14) return 0
  const lat = smoothstep01((ax - 0.14) / 0.08) * (1 - smoothstep01((ax - 0.6) / 0.12))
  if (lat <= 0) return 0
  const thetaC = canonicalTheta(Math.atan2(nz, ny))
  const d = boundaryDist(thetaC, nx, amp)
  if (d >= RIDGE_HALF + RIDGE_RAMP) return 0
  return (1 - smoothstep01((d - RIDGE_HALF) / RIDGE_RAMP)) * lat
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
export const POLAR_L: WaterBody = { dir: [-1, 0, 0], radius: 1.05, feather: 0.22, depth: 0.13 }
/** Back-compat: the ocean list (a single body now). */
export const POLAR_OCEANS: readonly WaterBody[] = [POLAR_L]

/** Ocean coastline warp parameters, PER VARIANT: [amp, a3, p3, a5, p5, a2, p2] for
 *  amp·(a3·sin3φ+p3 + a5·sin5φ+p5 + a2·sin2φ+p2). Task 25 (evolving caps): the two
 *  rows now DIFFER — the left ocean's coastline is a different sea on lap 2 (its
 *  bays/headlands moved: the 3φ octave phase is shifted π/1.5 so the main bays land
 *  where lap-1 headlands were, and the 5φ/2φ octaves are re-phased so no headland
 *  matches). The divergence is confined to the mid-latitude coastline by
 *  `capDivGate` below; the grazing limb stays bit-identical ocean (see there). */
const OCEAN_WARP: readonly (readonly [number, number, number, number, number, number, number])[] = [
  [0.15, 0.45, -2.618, 0.35, -1.9, 0.2, 2.4], // A (lap 1)
  [0.15, 0.48, -1.5, 0.44, 1.2, 0.28, -0.6], // B (lap 2) — Task 25 diverged coastline (all 3 bands move)
]

/** Cap-divergence taper (Task 25 — Mechanism A). The ±x rotation poles sit on the
 *  screen limb forever, so a discrete A→B flip there is grazing-visible and cannot
 *  hide. But the left-ocean COASTLINE lives at mid-latitude (|nx| ≈ 0.4–0.75, where
 *  the ocean mask transitions), and that band owns a proven-hidden renewal window
 *  just like the wedge interiors. So the lap-2 coastline (OCEAN_WARP[1]) is blended
 *  back toward lap-1 (OCEAN_WARP[0]) as |nx| approaches the limb: FULL divergence
 *  below CAP_DIV_LO, tapering to ZERO (A === B, bit-identical ocean) by CAP_DIV_HI.
 *  CAP_DIV_HI = the proven latitude L: the occlusion sweep (workspace bench, not
 *  tracked in-repo) finds 0 mid-flip visibility violations (dry-tip pass AND a
 *  conservative limb-water pass) for any L up to 0.92; 0.80 is chosen so the grazing
 *  limb |nx| ≥ 0.80 stays EXACTLY invariant by construction — smoothstep clamps to 1
 *  there, so lat = 0 exactly (preserving the polar-identity pin) with margin to
 *  spare. Wet-reach tops out at |nx| ≈ 0.784; tiny DRY land deltas (~6e-4R) extend
 *  to just below 0.80 — the hard divergence ceiling is 0.80, not 0.784. The gate is
 *  ALSO multiplied by meridianGate, so the coastline is invariant on the meridians
 *  too — the meridian seam identity is untouched. */
const CAP_DIV_LO = 0.7
const CAP_DIV_HI = 0.8
function capDivGate(nx: number, thetaC: number): number {
  const lat = 1 - smoothstep01((Math.abs(nx) - CAP_DIV_LO) / (CAP_DIV_HI - CAP_DIV_LO))
  return meridianGate(thetaC) * lat
}
/** Deterministic low-frequency coastline warp for a variant: the azimuth φ around
 *  the −x pole (which equals a point's longitude θ) → a bounded ~[-1,1] offset added
 *  to the ocean's angular radius, carving bays and headlands. The 3φ octave (period
 *  2π/3, phased to peak at the three band centres) lets the sea reach inland where
 *  each wedge drains into it; the 5φ + 2φ octaves break the 3-fold symmetry so no
 *  two headlands/bays match (the irregular coast Aram asked for). For variant B the
 *  lap-2 offset is blended back toward lap-1 by `capDivGate` (0 at the limb + the
 *  meridians), so the coastline only truly diverges where the renewal front can hide
 *  the flip. Pure sines (NO Math.random). */
function warpOffset(phi: number, w: readonly [number, number, number, number, number, number, number]): number {
  return w[1] * Math.sin(3 * phi + w[2]) + w[3] * Math.sin(5 * phi + w[4]) + w[5] * Math.sin(2 * phi + w[6])
}
function oceanWarp(nx: number, ny: number, nz: number, variant: 0 | 1): number {
  const phi = Math.atan2(nz, ny)
  const offA = warpOffset(phi, OCEAN_WARP[0])
  if (variant === 0) return offA
  const offB = warpOffset(phi, OCEAN_WARP[1])
  return offA + capDivGate(nx, canonicalTheta(phi)) * (offB - offA)
}
/** Feathered 0..1 membership of the warped left ocean at a unit point, for a variant. */
export function oceanMask(nx: number, ny: number, nz: number, variant: 0 | 1): number {
  const d = Math.acos(clampU(-nx)) // angular distance to the −x pole
  const eff = POLAR_L.radius + OCEAN_WARP[variant][0] * oceanWarp(nx, ny, nz, variant)
  return smoothstep01((eff - d) / POLAR_L.feather)
}

/** Smooth 0..1 membership of a cap, feathered at its rim. */
export function capMask(nx: number, ny: number, nz: number, cap: Cap): number {
  const dot = clampU(nx * cap.dir[0] + ny * cap.dir[1] + nz * cap.dir[2])
  const d = Math.acos(dot)
  return smoothstep01((cap.radius - d) / cap.feather)
}

// Task-27 lever 1 — pressed feature edges. A pure gaussian never ends: its tail
// bleeds outward forever, which is the "soft overflowing" read. We multiply the
// gaussian by a finite skirt WINDOW so every feature ENDS with a crisp pressed edge
// instead of melting into meadow: full inside PEAK_EDGE_IN·r, ramped hard to 0 by
// PEAK_EDGE_OUT·r. Because it only ever REMOVES skirt height (never adds), the 1.35R
// ceiling can only drop, and the steeper rim it creates feeds the crease-dark gate
// (lever 5) so each edge carries a shadow line. The cutoff sits past the gaussian's
// own near-zero tail region, so a feature's core + its dry-anchor support are intact.
const PEAK_EDGE_IN = 1.2
const PEAK_EDGE_OUT = 1.75
/** A gaussian swell with a finite pressed skirt (shared peak evaluator). */
function peakBump(nx: number, ny: number, nz: number, p: Peak): number {
  const dot = clampU(nx * p.dir[0] + ny * p.dir[1] + nz * p.dir[2])
  const ang = Math.acos(dot)
  const g = ang / p.r
  const core = p.h * Math.exp(-g * g)
  if (ang <= p.r * PEAK_EDGE_IN) return core
  const w = 1 - smoothstep01((ang - p.r * PEAK_EDGE_IN) / (p.r * (PEAK_EDGE_OUT - PEAK_EDGE_IN)))
  return core * w
}

// --- The overflow tide (Round 7, Mechanism B — RIGHT limb ring only) --------
//
// Aram: "we still have the ocean stone set as a pole … at some point have it
// overflow to the other side." The discrete wedge restaging floods the right
// side out to |nx| ≈ 0.74 (wedgeGate zeros deltas by 0.75); the grazing right
// limb (|nx| ≥ TIDE_LAT_LO) cannot flip discretely (Task 25's proof stands, the
// ±x poles sit on the screen limb forever). So the limb's wetness is a CONTINUOUS
// monotone function of the UNWRAPPED rotation ∈ [0, ROTATION_TOTAL]: a slow tide
// whose shoreline advances from the shelf edge toward the +x pole across the two
// laps. Every frame is a valid coastline (no invalid half-state to hide, so no
// occlusion proof is needed — unlike the discrete A→B flip), it is deterministic
// (rotation is the ONLY time-like input — NO Date.now), and it is slow enough not
// to read as sliding ground (max d(coast)/d(rotation) reported in scan-task26).
//
// Scope: +x hemisphere only (the LEFT limb is the permanent ocean, already wet).
// terrainBumpAt adds `tideCarve` here as ground truth; the render re-evaluates the
// static right-cap vertex bucket per frame (planet.tsx). The girl/props never stand
// at |nx| ≥ TIDE_LAT_LO (delta-arm anchors top out near |nx| ≈ 0.42), so the lane,
// walkYAt and every seated anchor are untouched — tideWetness is 0 for nx ≤ LO.

/** Duplicated from journey-timeline.ROTATION_TOTAL (kept a zero-import leaf). */
const TIDE_ROTATION_TOTAL = Math.PI * 4
/** Tide is confined to the +x grazing limb; 0.80 is exactly where the wedge gate
 *  (polarLatGate → 0 by 0.75) and the left-ocean cap divergence (capDivGate → 0 by
 *  0.80) have both ended, so the tide owns a band no other water term touches. */
export const TIDE_LAT_LO = 0.8
/** Shoreline latitude (nx) at journey start (nothing wet) and end (limb reads wet).
 *  The pole tip past END stays a last dry islet. */
const TIDE_FRONT_START = TIDE_LAT_LO
const TIDE_FRONT_END = 1.05
/** Shoreline softness in nx (a gentle wetting, not a hard step). */
const TIDE_FEATHER = 0.06
/** Carve below the coast at full wetness — sized so the ~[0.978,1.022]R right-cap
 *  coast (base meadow only past the wedge gate) drops clearly under WATER_LEVEL. */
export const TIDE_DEPTH = 0.06

/** The tide's per-point azimuthal shoreline offset (bays + headlands in the tide
 *  line). Deterministic. The render bakes this ONCE per cap vertex so the per-frame
 *  hot path (tideWetnessFast) avoids atan2 — see planet.tsx makeTideMorph. */
export function tideFrontOffset(ny: number, nz: number): number {
  return 0.015 * Math.sin(3 * Math.atan2(nz, ny) + 0.7)
}

/** 0..1 tide wetness from a PRECOMPUTED front offset (render hot path). 0 for
 *  nx ≤ TIDE_LAT_LO; rises to 1 once the advancing shoreline (front) has swept past
 *  this latitude. Monotone-increasing in rotation (front only grows). */
export function tideWetnessFast(nx: number, wob: number, rotation: number): number {
  if (nx <= TIDE_LAT_LO) return 0
  const p = clamp01(rotation / TIDE_ROTATION_TOTAL)
  const front = TIDE_FRONT_START + (TIDE_FRONT_END - TIDE_FRONT_START) * p + wob
  return smoothstep01((front - nx) / TIDE_FEATHER)
}

/** 0..1 tide wetness at a right-cap point under the current rotation: 0 across the
 *  whole left hemisphere and for nx ≤ TIDE_LAT_LO; rises to 1 once the advancing
 *  shoreline has swept past this latitude. Continuous, and monotone-increasing in
 *  rotation, so the limb goes dry→wet exactly once. (Ground-truth entry; the render
 *  uses tideWetnessFast with a baked offset for the same result without atan2.) */
export function tideWetness(nx: number, ny: number, nz: number, rotation: number): number {
  if (nx <= TIDE_LAT_LO) return 0
  return tideWetnessFast(nx, tideFrontOffset(ny, nz), rotation)
}

/** Rotation-dependent tide carve (ground truth): lowers the right-limb coast under
 *  the waterline as the tide advances. Zero everywhere except the wetting +x cap. */
export function tideCarve(nx: number, ny: number, nz: number, rotation: number): number {
  return -TIDE_DEPTH * tideWetness(nx, ny, nz, rotation)
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

// Task 41 (Round 12): the B0 breach strait is RETIRED. Aram — "in desert terrain there
// should be no ridge and water passage." The old breachStraitChannel widened a massive
// water passage across the desert face and joined a swollen right sea (B0_SEA) to the left
// ocean. The desert is now dry dunes + pyramids; B0 keeps only a modest bridged crossing
// stream draining LEFT to the ocean (streamChannel, like every other wedge — no wide flank,
// no right sea), so no passage crosses the visible face. The overflow narrative continues
// via the B1/B2 shelf seas (still advancing further right) + the continuous limb tide.

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
function creekChannel(theta: number, sign: 1 | -1, half = CREEK_HALF, depth = CREEK_DEPTH): Channel {
  const c = crossPoint(theta)
  const bend1 = crossPoint(theta + 0.14)
  const bend2 = crossPoint(theta - 0.06)
  const midA: [number, number, number] = [sign * 0.3, bend1[1] * 0.72, bend1[2] * 0.72]
  const midB: [number, number, number] = [sign * 0.55, bend2[1] * 0.42, bend2[2] * 0.42]
  const mouth: [number, number, number] = [sign * 0.82, c[1] * 0.18, c[2] * 0.18]
  return {
    arcs: [makeArc(c, midA), makeArc(midA, midB), makeArc(midB, mouth)],
    half,
    ramp: CREEK_RAMP,
    depth,
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
  streamChannel(CROSSINGS_B[0], -1), // B0 desert: single bridged crossing stream → LEFT ocean (Task 41)
  creekChannel(CROSSINGS_B[1], -1, CREEK_HALF, 0.1), // B1 canyon creek → left ocean, fattened (deeper)
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
/** B0 desert oasis pool — a small classic tarn nestled in an inter-dune hollow (Task 41;
 *  the dune field flattens to a basin around it, see duneField). The only water on the
 *  desert face; NOT a passage. Depth carries a clear blue even after the surrounding dunes
 *  rise, so it stays a wet pool. */
const B0_OASIS: WaterBody = { dir: norm3(place(0.3, 1.12)), radius: 0.085, feather: 0.06, depth: 0.06 }
// Task 41: B0_SEA (the swollen breach right-sea) is RETIRED with the breach strait — the
// desert face carries no sea. The flood arc's advancing water lives in the B1/B2 shelf seas
// + the continuous limb tide (see the header note + FLOOD ARC section of scan-task26).
/** B1 canyon shelf sea (Round 7 flood arc, step 2): a right-limb sea lapping the
 *  fattened canyon, reaching FURTHER right than the B0 breach. */
const B1_SHELF: WaterBody = { dir: norm3(place(0.54, 3.5)), radius: 0.22, feather: 0.12, depth: 0.09 }
/** B2 frozen pond. */
const B2_FROZEN: WaterBody = { dir: norm3(place(0.34, 5.55)), radius: 0.14, feather: 0.1, depth: 0.045 }
/** B2 winter shelf sea (Round 7 flood arc, step 3 — journey's end): the frozen sea
 *  reaches FURTHEST right, so by journey's end the coast is drowned right up to where
 *  the continuous tide (tideCarve) takes over on the grazing limb. */
const B2_SHELF: WaterBody = { dir: norm3(place(0.6, 5.72)), radius: 0.28, feather: 0.13, depth: 0.09 }
const A_PONDS: readonly LocalBody[] = [
  { band: 0, body: A0_POND },
  { band: 0, body: A0_INLET },
  { band: 1, body: A1_SHELF },
  { band: 2, body: A2_SOURCE },
]
const B_PONDS: readonly LocalBody[] = [
  { band: 0, body: B0_OASIS },
  { band: 1, body: B1_SHELF },
  { band: 2, body: B2_FROZEN },
  { band: 2, body: B2_SHELF },
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
  // B0 golden desert (Task 41): only a couple of BROAD low swells for large-scale ground
  // roll — the dune FORM is the wind-coherent crescent field (duneField, added in sceneRaw),
  // not these. The old five symmetric "ripple ridge" swells (which read as a ridge) are gone.
  [
    { dir: norm3(place(-0.46, 1.3)), h: 0.05, r: 0.32 },
    { dir: norm3(place(0.48, 1.75)), h: 0.045, r: 0.34 },
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

// --- Desert dunes (B0, Task 41) ---------------------------------------------
//
// Aram (Round 12): "In desert terrain there should be no ridge and water passage, let's
// add dunes and pyramides." The B0 wedge now rolls with wind-coherent crescent dunes —
// asymmetric waves with a gentle windward BACK and a steep leeward SLIP FACE, NOT noise
// ripples. Authored HERE as displacement so both renewal bakes agree byte-for-byte and the
// bench reads the real relief; the render's claySignature layers fine raked ripples on the
// dune flanks (planet.tsx, bump∈[0.02,0.08]). This owns the FORM.
//
// Gated EXACTLY 0 on the girl's lane band (|nx| < DUNE_LANE_LO, a hard early-return like
// fieldDents/claySignature) so it adds NO spine-band term — the contact budget (0.01247R) is
// untouched and the lane stays gentle + dry. Faded to 0 before the limb so it never fights the
// polar ocean/beach, and wedge-gated to 0 on the meridians via wedgeDelta (so bumpA===bumpB
// there). The classic oasis pool sits in a flattened inter-dune hollow (oasisFlat below).
const DUNE_LANE_LO = 0.16
const DUNE_LANE_HI = 0.28
const DUNE_LIMB_LO = 0.58
const DUNE_LIMB_HI = 0.72
/** Dune crest count marching across a full 2π of longitude (≈4 crescents across the wedge). */
const DUNE_FREQ = 12
/** How much the crest lines bow with latitude → crescent (barchan) horns, not straight ridges. */
const DUNE_CURVE = 2.3
/** Fraction of each dune period spent on the gentle windward back (the rest = steep slip face). */
const DUNE_BACK = 0.72
/** Peak dune height (fraction of R). */
const DUNE_AMP = 0.075

/** One asymmetric dune wave from a phase p∈[0,1): a gentle windward rise to the crest at
 *  DUNE_BACK, then a steep leeward slip-face drop. The slip face is compressed into the
 *  remaining (1−DUNE_BACK) of the period so it reads markedly steeper than the back. */
function duneProfile(p: number): number {
  if (p < DUNE_BACK) return smoothstep01(p / DUNE_BACK)
  return 1 - smoothstep01((p - DUNE_BACK) / (1 - DUNE_BACK))
}

/** Lane/limb gate bounds for the dune field, exported so the unit test pins the gating
 *  contract (0 on the girl's lane band, 0 past the limb) against the shipped constants. */
export const DUNE_GATE = { laneLo: DUNE_LANE_LO, laneHi: DUNE_LANE_HI, limbLo: DUNE_LIMB_LO, limbHi: DUNE_LIMB_HI } as const

/** Wind-coherent crescent dune field for the B0 desert (variant B, added in sceneRaw).
 *  Pure function of the unit direction; adds only (never carves), so the 1.35R ceiling can
 *  only rise a little and no accidental water forms. 0 on the lane + past the limb fade.
 *  Exported for the unit test (gating + determinism); the render consumes it via biomeBumpB. */
export function duneField(nx: number, ny: number, nz: number): number {
  const ax = Math.abs(nx)
  const lane = smoothstep01((ax - DUNE_LANE_LO) / (DUNE_LANE_HI - DUNE_LANE_LO))
  if (lane <= 0) return 0
  const limb = 1 - smoothstep01((ax - DUNE_LIMB_LO) / (DUNE_LIMB_HI - DUNE_LIMB_LO))
  if (limb <= 0) return 0
  const thetaC = canonicalTheta(Math.atan2(nz, ny))
  // primary transverse dune train: crests march in longitude, bowed by latitude into crescents
  const phase = (DUNE_FREQ * thetaC + DUNE_CURVE * nx) / TWO_PI
  let h = duneProfile(phase - Math.floor(phase))
  // a weaker second train at a slight yaw breaks the monotony while staying wind-coherent
  const phase2 = (DUNE_FREQ * 0.55 * thetaC - 1.4 * nx + 1.3) / TWO_PI
  h = 0.82 * h + 0.18 * duneProfile(phase2 - Math.floor(phase2))
  // large-scale height modulation so the field has tall + low dunes (a field, not corrugation)
  const envelope = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(2.3 * thetaC + 3.1 * nx + 0.7))
  // flatten the dunes into a hollow around the oasis so the pool sits on a calm basin, not a hump
  const od = Math.acos(clampU(nx * B0_OASIS.dir[0] + ny * B0_OASIS.dir[1] + nz * B0_OASIS.dir[2]))
  const oasisFlat = smoothstep01((od - 0.14) / 0.06)
  return DUNE_AMP * h * envelope * lane * limb * oasisFlat
}

// --- Jungle canopy mounds (A1, Task 42) -------------------------------------
//
// Aram (Round 12): the second green wedge (band 1, variant A — the FLYERBEE flower
// field) becomes a "very green jungle terrain." The FORM of a jungle read from the
// reading camera is a lumpy, bulbous CANOPY — overlapping rounded domes, not the
// smooth terraced swells of a meadow. Authored HERE as displacement (like duneField)
// so both renewal bakes agree byte-for-byte and the bench reads the real relief; the
// dense instanced flora (jungle.tsx) sits ON these mounds so the wedge reads as a
// packed canopy of green crowns riding a hummocky floor.
//
// Same hard gating contract as duneField: EXACTLY 0 on the girl's lane band
// (|nx| < CANOPY_LANE_LO, an early return) so it adds NO spine-band term — the contact
// budget (0.01247R) is untouched and the lane stays gentle + walkable; faded to 0
// before the limb so it never fights the polar ocean/beach; and wedge-gated to 0 on the
// meridians via wedgeDelta (so bumpA === bumpB there). Adds only (never carves), so no
// accidental water forms and the 1.35R ceiling only rises a little.
const CANOPY_LANE_LO = 0.16
const CANOPY_LANE_HI = 0.3
const CANOPY_LIMB_LO = 0.56
const CANOPY_LIMB_HI = 0.72
/** Dome cells marching across a full 2π of longitude (≈4–5 canopy clusters across the wedge). */
const CANOPY_FREQ_LON = 13
/** Dome cells across latitude (≈2–3 rows of canopy up each flank). */
const CANOPY_FREQ_LAT = 4.5
/** Peak canopy-mound height (fraction of R). */
const CANOPY_AMP = 0.085

/** A single rounded dome from a cell's fractional coordinates: 1 at the cell centre,
 *  smoothly 0 at the cell-radius rim (0.5). Bulbous (smoothstep of a radial parabola),
 *  so summed/maxed offset grids read as overlapping cauliflower canopy, not corrugation. */
function domeCell(u: number, v: number): number {
  const fu = u - Math.floor(u) - 0.5
  const fv = v - Math.floor(v) - 0.5
  const d2 = (fu * fu + fv * fv) / 0.25 // 0 at centre → 1 at the 0.5 cell radius
  if (d2 >= 1) return 0
  return smoothstep01(1 - d2)
}

/** Lane/limb gate bounds for the canopy field, exported so the unit test pins the gating
 *  contract (0 on the girl's lane band, 0 past the limb) against the shipped constants. */
export const CANOPY_GATE = { laneLo: CANOPY_LANE_LO, laneHi: CANOPY_LANE_HI, limbLo: CANOPY_LIMB_LO, limbHi: CANOPY_LIMB_HI } as const

/** Bulbous overlapping-dome canopy field for the A1 jungle (variant A, added in sceneRaw).
 *  Pure function of the unit direction; adds only (never carves), 0 on the lane + past the
 *  limb fade. Exported for the unit test (gating + determinism); the render consumes it via
 *  biomeBump. Three offset/rotated dome grids are MAXed (not summed) so the canopy is a floor
 *  of overlapping rounded humps with shaded valleys between, and a low-frequency clump term
 *  gives dense thickets and thinner clearings (the "gaps" where the understory shows). */
export function canopyMounds(nx: number, ny: number, nz: number): number {
  const ax = Math.abs(nx)
  const lane = smoothstep01((ax - CANOPY_LANE_LO) / (CANOPY_LANE_HI - CANOPY_LANE_LO))
  if (lane <= 0) return 0
  const limb = 1 - smoothstep01((ax - CANOPY_LIMB_LO) / (CANOPY_LIMB_HI - CANOPY_LIMB_LO))
  if (limb <= 0) return 0
  // Never build canopy ON the water — flatten to 0 inside the A1 shelf sea (so it stays a wet
  // lagoon) and along the stream channel (so the bridged crossing stays wet). Same idea as
  // duneField's oasisFlat.
  const shelfD = Math.acos(clampU(nx * A1_SHELF.dir[0] + ny * A1_SHELF.dir[1] + nz * A1_SHELF.dir[2]))
  const shelfAvoid = smoothstep01((shelfD - (A1_SHELF.radius + 0.05)) / 0.06)
  if (shelfAvoid <= 0) return 0
  const chAvoid = smoothstep01((channelDist(nx, ny, nz, 0) - (STREAM_HALF + 0.05)) / 0.05)
  if (chAvoid <= 0) return 0
  const thetaC = canonicalTheta(Math.atan2(nz, ny))
  // Keep the canopy OUT of the seam "breath" zone: full only in the wedge interior, tapering
  // to 0 well before the meridians (a wider taper than the wedgeGate ramp) so the two abutting
  // scenes still meet through a clean low meadow and no steep near-seam height gradient forms.
  const seam = smoothstep01((meridianDist(thetaC) - 0.16) / 0.14)
  if (seam <= 0) return 0
  const u = (CANOPY_FREQ_LON * thetaC) / TWO_PI
  const v = CANOPY_FREQ_LAT * nx
  // three overlapping dome grids (offset + yawed) → a lumpy cauliflower canopy silhouette
  let h = domeCell(u, v)
  h = Math.max(h, 0.85 * domeCell(u + 0.5, v + 0.5))
  h = Math.max(h, 0.7 * domeCell(1.7 * u + 0.3, 1.3 * v - 0.2))
  // large-scale clumping: dense thickets vs thinner clearings (understory gaps)
  const clump = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(2.1 * thetaC + 2.7 * nx + 0.6))
  return CANOPY_AMP * h * clump * lane * limb * seam * shelfAvoid * chAvoid
}

// --- Assembled displacement -------------------------------------------------

/** The one left ocean carved below the waterline, for a variant: the warped
 *  coastline cap plus a couple of low offshore island swells (the islands are
 *  invariant). Task 25: variant B's coastline diverges at mid-latitude (oceanMask
 *  blends the lap-2 warp in below the limb), so A and B carve DIFFERENTLY where the
 *  coast lives (|nx| ≈ 0.4–0.78) but still identically for |nx| ≥ 0.8 (capDivGate
 *  taper) — the grazing limb never pops. */
function oceanCarve(nx: number, ny: number, nz: number, variant: 0 | 1): number {
  let c = -POLAR_L.depth * oceanMask(nx, ny, nz, variant)
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
  if (variant === 1 && band === 0) bump += duneField(nx, ny, nz) // B0 crescent dune field (Task 41)
  if (variant === 0 && band === 1) bump += canopyMounds(nx, ny, nz) // A1 jungle canopy mounds (Task 42)
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
  return oceanCarve(nx, ny, nz, 0) + wedgeDelta(nx, ny, nz, 0)
}
/** Variant-B authored displacement (lap 2). Equals biomeBump on every meridian and
 *  at the GRAZING limbs by construction (wedgeGate = 0 there; capDivGate = 0 there,
 *  so the divergent left coastline collapses back to the invariant ocean). Between
 *  those seams — including the mid-latitude left coastline — B genuinely differs. */
export function biomeBumpB(nx: number, ny: number, nz: number): number {
  return oceanCarve(nx, ny, nz, 1) + wedgeDelta(nx, ny, nz, 1)
}

// --- Classification for the colour pass -------------------------------------

/** Strongest ocean + active-wedge local-water membership (0..1) at a point. */
export function waterMask(nx: number, ny: number, nz: number, variant: 0 | 1): number {
  let m = oceanMask(nx, ny, nz, variant)
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
  variant: 0 | 1,
  wanderAmp: number = BOUNDARY_WANDER
): { kind: BiomeKind; t: number } {
  const radius = 1 + currentBump
  if (radius < WATER_LEVEL) {
    return { kind: 'underwater', t: clamp01((WATER_LEVEL - radius) / 0.08) }
  }
  // Task-27 lever 2 — cut shores. The beach reach + tint band are narrowed (channel
  // skirt 0.06→0.04, meadow-side band 0.987→0.982 over 0.015→0.010) so the sand reads
  // as a thin pressed rim where land meets water, not a wide fade that melts the coast
  // into meadow. Paired with the tightened ocean feather (POLAR_L) the whole coastline
  // now reads cut. (Untouched: the A0 strait near-deck blue fix, the B0 breach read,
  // and the tide feather — those are proven and own their own edges.)
  const nearWater =
    waterMask(nx, ny, nz, variant) > 0.02 || channelDist(nx, ny, nz, variant) < STREAM_HALF + 0.04
  if (nearWater && radius < 0.982) {
    return { kind: 'beach', t: clamp01((0.982 - radius) / 0.01) }
  }
  const thetaC = canonicalTheta(Math.atan2(nz, ny))
  // Task 38: band membership follows the HARD torn boundary, not the straight meridian,
  // so the canyon/snow scenes abut their neighbours at the same pressed-clay curve the
  // accents do — no soft meridian fade.
  const pband = paintBand(thetaC, nx, wanderAmp)
  // B1 canyon: the rich-brown gorge (near the creek) + standalone badland buttes
  // read as clay added onto the pink-warm surround. `t` runs 1 in the creek floor
  // (deepest brown) to 0 on the upper banks/rims (lightened terracotta) so the
  // gorge has authored floor-dark / rim-light contrast, not a flat brown wash.
  if (variant === 1 && pband === 1 && polarLatGate(nx) > 0.1) {
    const cd = canyonCreekDist(nx, ny, nz)
    const CANYON_REACH = CREEK_HALF + 0.22
    const nearCreek = cd < CANYON_REACH
    const butte = currentBump > 0.045 // a raised mesa/butte of clay
    if (nearCreek || butte) {
      const t = nearCreek ? clamp01((CANYON_REACH - cd) / CANYON_REACH) : 0.35
      return { kind: 'canyon', t }
    }
  }
  // B2 winter summit reads as snow at FULL coverage right up to the hard boundary,
  // fading only toward the limb (accentLatGate) — no green meridian crescent.
  if (variant === 1 && pband === 2) {
    const w = accentLatGate(nx)
    if (w > 0.05) return { kind: 'snow', t: w }
  }
  return { kind: 'meadow', t: 0 }
}
