/**
 * Task 47 (worker bake, Phase 2b) — the PURE land-terrain bake, extracted verbatim from
 * planet.tsx so it can run in a Web Worker (planet.tsx is a `'use client'` r3f component and
 * cannot be imported into a worker). This module has ZERO react / react-three-fiber / DOM
 * dependencies — only THREE's worker-safe math + geometry, the biome/renewal/field leaf
 * modules, and the by-value dial snapshot. `planet.tsx` re-exports every public symbol here,
 * so all existing consumers (props, stage, tests, benches) keep importing from `./planet`.
 *
 * DETERMINISM IS BY-VALUE: the bake never reads a live tunables store. The main thread
 * snapshots the twelve land dials (`readLandDials()`) and threads the plain object through
 * `bakeLandArrays` → paintVertex / fieldDents / applyFieldMottle. The worker's own module
 * graph gets a fresh (defaulted) DIALS instance that the bake path never reads — every dial
 * it consumes arrives explicitly, so the worker and the synchronous fallback produce
 * byte-identical arrays for the same snapshot.
 */
import * as THREE from 'three'
import { PALETTE } from '../palette'
import {
  biomeBump,
  biomeBumpB,
  biomeTint,
  bandOf,
  paintBand,
  accentLatGate,
  boundaryRidgeShape,
  polarLatGate,
  canyonCreekDist,
  tideCarve,
  TIDE_LAT_LO,
  TIDE_DEPTH,
} from './biomes'
import { canonicalTheta, renewalGate } from './renewal'
import { fieldDents, applyFieldMottle, type Pal } from './field-clay'
import { readLandDials, type LandDials } from './tunables'

export const PLANET_RADIUS = 2.2

/** The icosphere subdivision the land bake runs at (37 500 verts). Shared with the worker so
 *  it can rebuild the base icosphere byte-identically when it bakes off the main thread. */
export const ICO_DETAIL = 24
/** Local sub-triangle edge length: the icosahedron edge (circumradius·1.0515) split into
 *  ICO_DETAIL segments. The tangential jitter is a fraction of this. */
export const ICO_EDGE = (PLANET_RADIUS * 1.0515) / ICO_DETAIL

/**
 * Base meadow relief — the gentle two-octave hand-pushed hills that carry the
 * whole planet UNDER the authored biome features. Amplitude reduced from the
 * Task-13 pass so the girl's spine band floor stays safely above the raised
 * waterline (verified ≥ 0.982R on the spine; see bench scan). Pure.
 */
export function baseMeadowBump(x: number, y: number, z: number): number {
  const a = Math.sin(3 * x + 1.7) * Math.sin(4 * y - 0.6) * Math.sin(3 * z + 2.2)
  const b = Math.sin(1.6 * x - 2.1 * y + 0.9) * Math.sin(2.3 * z + 1.3 * x - 0.4)
  return 0.013 * a + 0.009 * b
}

/**
 * Radial bump of the clay terrain on the UNIT direction scaled to
 * PLANET_RADIUS: base meadow relief PLUS the authored biome displacement
 * (ocean basin, one mountain range, brown canyon, river channels). The old
 * Task-13 flank ridge/basin noise is gone — features are now hand-placed in
 * biomes.ts. Kept pure so props + the girl sample the true surface height.
 */
export function terrainBump(x: number, y: number, z: number): number {
  const len = Math.sqrt(x * x + y * y + z * z) || 1
  const nx = x / len
  const ny = y / len
  const nz = z / len
  return baseMeadowBump(x, y, z) + biomeBump(nx, ny, nz)
}

/**
 * Lap-2 terrain: the same base meadow plus the variant-B biome displacement.
 * Because `biomeBumpB` gates every flank delta to zero on the spine band,
 * `terrainBumpB === terrainBump` exactly for |nx| < 0.45 — so surfaceYAt/walkYAt
 * and every spine-anchored prop stay lap-invariant. Pure; build-time only
 * (the render geometry lerps between the two bakes per frame). */
export function terrainBumpB(x: number, y: number, z: number): number {
  const len = Math.sqrt(x * x + y * y + z * z) || 1
  const nx = x / len
  const ny = y / len
  const nz = z / len
  return baseMeadowBump(x, y, z) + biomeBumpB(nx, ny, nz)
}

/**
 * Finite-difference gradient magnitude of terrainBump along the surface at a
 * unit direction — how steeply the clay is pinched here. Used to darken creases
 * (hand-pushed clay shows dirt in its folds). Pure; two centered samples per
 * tangent, four terrainBump calls (build-time only).
 */
export function terrainSlope(
  nx: number,
  ny: number,
  nz: number,
  bumpFn: (x: number, y: number, z: number) => number = terrainBump
): number {
  const eps = 0.02
  // tangent 1 = normalize(n × up); at the poles fall back to the x axis
  let t1x = -nz
  let t1z = nx
  const l = Math.hypot(t1x, t1z)
  const t1y = 0
  if (l < 1e-4) { t1x = 1; t1z = 0 } else { t1x /= l; t1z /= l }
  // tangent 2 = n × t1 (already unit for orthonormal n, t1)
  const t2x = ny * t1z - nz * t1y
  const t2y = nz * t1x - nx * t1z
  const t2z = nx * t1y - ny * t1x
  const R = PLANET_RADIUS
  const s = (ox: number, oy: number, oz: number): number =>
    bumpFn((nx + ox) * R, (ny + oy) * R, (nz + oz) * R)
  const dA = (s(eps * t1x, eps * t1y, eps * t1z) - s(-eps * t1x, -eps * t1y, -eps * t1z)) / (2 * eps)
  const dB = (s(eps * t2x, eps * t2y, eps * t2z) - s(-eps * t2x, -eps * t2y, -eps * t2z)) / (2 * eps)
  return Math.hypot(dA, dB)
}

/**
 * Variant-aware terrain bump at a point, for the CURRENT rotation: A (lap-1) and
 * B (lap-2) blended by the renewal gate at that point's longitude. Because a
 * walker/prop only samples ground where the gate is exactly 0 or 1 (visible ⇒
 * flipped or not — proven by renewal-scan.mjs), heights read exact, never
 * mid-lerp; on the spine terrainBumpB === terrainBump so it is a no-op there. */
export function terrainBumpAt(x: number, y: number, z: number, rotation: number): number {
  const len = Math.sqrt(x * x + y * y + z * z) || 1
  const nx = x / len, ny = y / len, nz = z / len
  const gate = renewalGate(canonicalTheta(Math.atan2(nz, ny)), rotation)
  // Round 7: the continuous overflow tide wets the +x grazing limb (|nx| ≥ 0.80) as a
  // monotone function of rotation. It is added on TOP of the A/B blend and is 0 for the
  // whole lane/anchor region (nx ≤ 0.80), so surfaceYAt/walkYAt are unchanged there.
  const tide = tideCarve(nx, ny, nz, rotation)
  if (gate <= 0) return terrainBump(x, y, z) + tide
  if (gate >= 1) return terrainBumpB(x, y, z) + tide
  const a = terrainBump(x, y, z)
  return a + (terrainBumpB(x, y, z) - a) * gate + tide
}

/**
 * World-space surface point directly under a stance at world z (x=0, upper
 * hemisphere), for a planet rotated by `rotation` about x. Returns the y of the
 * displaced terrain surface at that z. Samples the variant-aware terrain, so the
 * girl and prop anchors ride the active variant; the girl's lane is spine
 * (A === B), so this is lap-invariant there. The girl's on-bridge height is in
 * walkYAt.
 */
export function surfaceYAt(worldZ: number, rotation: number): number {
  const baseY = Math.sqrt(PLANET_RADIUS * PLANET_RADIUS - worldZ * worldZ)
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const ly = baseY * cos - worldZ * sin
  const lz = baseY * sin + worldZ * cos
  const bump = terrainBumpAt(0, ly, lz, rotation)
  const r = PLANET_RADIUS * (1 + bump)
  return Math.sqrt(Math.max(0, r * r - worldZ * worldZ))
}

/** Clay thumb-dents: a two-octave surface irregularity applied to the RENDER
 * geometry only (never to terrainBump, so dryness/props/tests are untouched). It
 * tilts the flat facet normals so the hard ramp breaks into pressed-clay patches
 * instead of a smooth soft gradient. A pure function of the unit direction, so it
 * is IDENTICAL on both laps and cancels out of the morph on the spine (where the
 * two bakes already coincide).
 *
 * Task-21 clay push: energy moved into the LOW octave — bigger, deeper thumb
 * presses (amp 0.005→0.009 at roughly half the frequency 15→8, ~1.8× deeper over
 * ~2× wider patches) so the surface reads as broad pressed hollows under the toon
 * bands; the fine octave stays subtle grain (0.003→0.0025). Peak |dimple| ≈
 * 0.0115·R.
 *
 * Task-27 rougher clay v3: both octaves dropped a notch in frequency (low 7.9→6.0,
 * fine 27→22) so the presses read as BIGGER, coarser pinches — the same amplitude
 * budget (contact-proof unchanged) spread over wider patches. Paired with the
 * raised tangential jitter (JITTER_TAN 0.34→0.44) this coarsens the facet grain
 * without eating the contact budget (tangential jitter re-samples terrain at the
 * moved vertex, so it never contributes to the render-vs-analytic spine offset). */
function clayDimple(nx: number, ny: number, nz: number): number {
  return (
    0.009 * Math.sin(6.0 * nx + 1.1) * Math.sin(5.6 * ny - 0.4) * Math.sin(5.9 * nz + 2.3) +
    0.0025 * Math.sin(21.7 * ny + 0.7) * Math.sin(20.9 * nz - 1.3) * Math.sin(22.4 * nx + 0.5)
  )
}

/** Amplitude ceiling of clayDimple (sum of the two octave amplitudes), so the
 * contact-proof scan and any ceiling math have one source of truth. */
export const CLAY_DIMPLE_MAX = 0.009 + 0.0025

/**
 * Task 23 — per-FIGURE clay signature (render-only, INWARD-only). Task 21's dimple
 * is one global surface voice; this gives each element FAMILY its own molded texture
 * so a mountain reads as a pinched clay piece, a canyon as stratified earth, a dune
 * as raked ripples — not one smooth swell of the same noise. Three signatures, each
 * carving grooves DOWN from the feature (never adding relief, so the 1.35R ceiling
 * only ever drops), by band + local relief:
 *  - RIDGED CRESTS on high relief (mountains + winter spires): abs-noise ridge lines
 *    stay at the peak while the troughs between them carve in → pinched, not blobby.
 *  - STRATIFIED TERRACES on the B1 canyon (near the creek): a sawtooth on local
 *    height steps the walls into molded earth strata.
 *  - DIRECTIONAL DUNE RIPPLES on the B0 golden dunes: raked parallel ridges.
 *  - SNOW (B2 drifts) gets NONE — smooth heavy lobes are the deliberate contrast.
 *
 * GATED to zero on the girl's lane (|nx| < ~0.14), so the spine contact budget is
 * exactly Task 21's (dimple+radial) — the girl/props never stand on a signature.
 * A pure function of direction + the variant's own bump, so A and B each bake their
 * own and the renewal front lerps them behind the horizon like the rest of the flank.
 */
export const CLAY_SIGNATURE_MAX = 0.03
const CREEK_HALF_LOCAL = 0.055 // mirrors biomes CREEK_HALF (zero-import there)
function claySignature(nx: number, ny: number, nz: number, bump: number, variant: 0 | 1): number {
  const lat = THREE.MathUtils.smoothstep(Math.abs(nx), 0.14, 0.24)
  if (lat <= 0) return 0
  const thetaC = canonicalTheta(Math.atan2(nz, ny))
  const band = bandOf(thetaC)
  let carve = 0
  // ridged crests — the taller the relief, the sharper the pinch (both variants)
  const high = THREE.MathUtils.smoothstep(bump, 0.08, 0.18)
  if (high > 0) {
    const ridge = Math.abs(
      Math.sin(18.0 * nx + 0.3) * Math.sin(17.0 * ny - 0.8) * Math.sin(19.0 * nz + 1.5)
    ) // 0 on the ridge lines, →1 between them
    carve -= 0.03 * high * ridge
  }
  // stratified terraces on the B1 canyon walls
  if (variant === 1 && band === 1) {
    const cd = canyonCreekDist(nx, ny, nz)
    const canyonMask = 1 - THREE.MathUtils.smoothstep(cd, CREEK_HALF_LOCAL, CREEK_HALF_LOCAL + 0.22)
    if (canyonMask > 0) {
      const LEVELS = 5
      const step = bump * LEVELS - Math.floor(bump * LEVELS) // 0 at each band base → 1 at its top
      carve -= 0.02 * canyonMask * step
    }
  }
  // directional raked ripples on the B0 golden dunes
  if (variant === 1 && band === 0) {
    const duneMask = THREE.MathUtils.smoothstep(bump, 0.02, 0.08)
    if (duneMask > 0) {
      const ripple = 0.5 + 0.5 * Math.sin(34.0 * nz + 12.0 * ny)
      carve -= 0.012 * duneMask * ripple
    }
  }
  // Task-27 lever 4 — broad terrace steps on QUIET open meadow (both variants). The
  // gentle base swells are the "soft overflowing" background: quantize their low
  // relief into discrete steps so even the calm zones read molded, not melted. Only
  // on low-relief ground (faded out by bump 0.09, so features keep their own
  // signature) and only where the surface rises above the base (bump > 0), so water/
  // beach are untouched. Inward-only (carve toward the step below), off-lane gated by
  // `lat` — the girl's lane never terraces, so the contact budget is unchanged.
  const quiet = 1 - THREE.MathUtils.smoothstep(bump, 0.05, 0.09)
  if (quiet > 0 && bump > 0.008) {
    const STEP = 0.024
    const frac = bump / STEP - Math.floor(bump / STEP) // 0 at each step base → 1 below the next
    carve -= 0.016 * quiet * frac
  }
  return carve * lat
}

/** Deterministic hash of a source-vertex direction → [0,1). Pure sin-fract with a
 * per-call seed; NO Math.random, so both bakes and the bench agree byte-for-byte. */
function hash01(x: number, y: number, z: number, seed: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed) * 43758.5453
  return s - Math.floor(s)
}

/**
 * Task-21 grid-break (headline lever). The icosahedron's regular triangle lattice
 * reads "3D asset"; jitter each SOURCE vertex TANGENTIALLY (within its own tangent
 * plane) by up to JITTER_TAN·edge before displacement, so the flat facets become
 * irregular hand-pinched planes. Deterministic hash of the source direction ⇒
 * identical on both bakes, so the renewal A→B lerp stays seamless. Terrain/dimple
 * are re-evaluated at the JITTERED direction (that is where the vertex physically
 * sits), so the render surface still equals analytic terrain at every vertex — the
 * only render-vs-analytic offset is dimple + the tiny radial jitter below.
 *
 * `edge` is the local sub-triangle edge length (world units); `t1`,`t2` are an
 * orthonormal tangent basis at the source direction. Returns the new UNIT
 * direction. */
function jitterDir(
  nx: number, ny: number, nz: number,
  t1x: number, t1y: number, t1z: number,
  t2x: number, t2y: number, t2z: number,
  edge: number
): [number, number, number] {
  const rho = JITTER_TAN * edge * hash01(nx, ny, nz, 0.0)
  const phi = 2 * Math.PI * hash01(nx, ny, nz, 17.3)
  const a = rho * Math.cos(phi)
  const b = rho * Math.sin(phi)
  // P = n·R displaced sideways by (a·t1 + b·t2), then re-projected to a unit dir.
  const px = nx * PLANET_RADIUS + a * t1x + b * t2x
  const py = ny * PLANET_RADIUS + a * t1y + b * t2y
  const pz = nz * PLANET_RADIUS + a * t1z + b * t2z
  const l = Math.hypot(px, py, pz) || 1
  return [px / l, py / l, pz / l]
}

/** Tangential jitter budget as a fraction of the local sub-triangle edge. Task-27:
 * raised 0.34→0.44 for coarser, rougher facet planes (bigger hand-pinched facets).
 * Contact-neutral by construction — the vertex re-samples terrain where it lands, so
 * the tangential nudge never widens the render-vs-analytic spine offset. Held below
 * ~0.5 to stay clear of the "low-poly game asset" guardrail (Task 21). */
const JITTER_TAN = 0.44
/** Tiny radial jitter (fraction of R) layered on the dimple for extra hand-made
 * lumpiness. Kept small so the combined render-vs-analytic offset the girl/shadow
 * must forgive stays well inside the dimple-dominated budget. Peak = this value. */
const JITTER_RAD = 0.0013
/** Task 29 lever 4 — static facet-normal dither amplitude on OPEN field facets lives in
 *  DIALS.terminatorDither (default 0.02, unit-normal units ≈ radians of tilt). Small
 *  enough to only re-band a facet that already grazes a ramp threshold (the terminator),
 *  so the lit face never speckles. Normals only — positions/contact/ceiling untouched. */

/**
 * Task 33 — the authored LAND flow tangent at a unit direction: the terrain's steepest
 * DESCENT (downslope of the biome bump, from a finite-difference gradient of `bumpFn`)
 * BLENDED with the same poleward-drainage + around-sphere swirl the water flow uses
 * (`flowStrength` scales the blend). Returns a unit tangent, or [0,0,0] at the poles /
 * where the field degenerates (no preferred flow) — so the flow-aligned field streak runs
 * downhill toward the drainage, exactly like tool-dragged clay. Pure; bake-time only (four
 * bumpFn samples), and colour-only downstream — no displacement term.
 */
function terrainFlowDir(
  nx: number,
  ny: number,
  nz: number,
  bumpFn: (x: number, y: number, z: number) => number,
  flowStrength: number
): [number, number, number] {
  // tangent basis (same convention as terrainSlope); at the poles there is no flow.
  let t1x = -nz
  let t1z = nx
  const l = Math.hypot(t1x, t1z)
  if (l < 1e-4) return [0, 0, 0]
  const t1y = 0
  t1x /= l; t1z /= l
  const t2x = ny * t1z - nz * t1y
  const t2y = nz * t1x - nx * t1z
  const t2z = nx * t1y - ny * t1x
  const R = PLANET_RADIUS
  const eps = 0.02
  const s = (ox: number, oy: number, oz: number): number =>
    bumpFn((nx + ox) * R, (ny + oy) * R, (nz + oz) * R)
  const dA = (s(eps * t1x, eps * t1y, eps * t1z) - s(-eps * t1x, -eps * t1y, -eps * t1z)) / (2 * eps)
  const dB = (s(eps * t2x, eps * t2y, eps * t2z) - s(-eps * t2x, -eps * t2y, -eps * t2z)) / (2 * eps)
  // steepest descent (downhill) tangent = −∇bump projected onto the surface
  let fx = -(dA * t1x + dB * t2x)
  let fy = -(dA * t1y + dB * t2y)
  let fz = -(dA * t1z + dB * t2z)
  // blend the water drainage field: poleward projection of −x̂ + azimuthal swirl about x.
  const px = -1 + nx * nx, py = nx * ny, pz = nx * nz
  fx += flowStrength * px
  fy += flowStrength * (py - nz)
  fz += flowStrength * (pz + ny)
  const fl = Math.hypot(fx, fy, fz)
  if (fl < 1e-6) return [0, 0, 0]
  return [fx / fl, fy / fl, fz / fl]
}

/** Per-vertex invariants the bake precomputes ONCE and threads into `paintVertex`, so the
 *  paint pass reuses the clay signature, dimple, field dents, boundary-ridge shape, and the
 *  terrain gradient (crease + flow) the radius pass already produced instead of recomputing
 *  them. Omitted on the standalone/test path, where paintVertex recomputes each exactly as
 *  before — byte-identical either way. */
export type PaintPrecomp = {
  sig: number
  dip: number
  dent: number
  ridgeShape: number
  crease: number
  flow: readonly [number, number, number]
}

/**
 * Task 43 (perf) — the SHARED terrain gradient for the bake. `terrainSlope` (crease) and
 * `terrainFlowDir` (flow streak) each computed the SAME finite-difference ∇bump per vertex:
 * identical tangent basis, identical `eps = 0.02`, the identical four `bumpFn` samples. This
 * merges them so those four samples are taken ONCE and feed both the crease magnitude and the
 * steepest-descent flow tangent — halving the biome-field evaluations in the hot bake path.
 *
 * BYTE-IDENTICAL to calling `terrainSlope` then `terrainFlowDir`: the basis + `dA`/`dB` math
 * is copied verbatim from both, and the pole/degenerate handling matches each consumer — the
 * crease uses the x-axis fallback basis exactly like terrainSlope, and the flow returns the
 * zero tangent at a pole / vanishing field / when `flowAlign <= 0` exactly like the
 * `flowAlign > 0 ? terrainFlowDir(...) : [0,0,0]` guard in paintVertex. Bake-time only; the
 * standalone terrainSlope/terrainFlowDir stay for the paintVertex test path.
 */
export function terrainGradientField(
  nx: number,
  ny: number,
  nz: number,
  bumpFn: (x: number, y: number, z: number) => number,
  flowStrength: number,
  flowAlign: number
): { crease: number; flow: [number, number, number] } {
  let t1x = -nz
  let t1z = nx
  const l = Math.hypot(t1x, t1z)
  const t1y = 0
  const degenerate = l < 1e-4
  if (degenerate) { t1x = 1; t1z = 0 } else { t1x /= l; t1z /= l }
  const t2x = ny * t1z - nz * t1y
  const t2y = nz * t1x - nx * t1z
  const t2z = nx * t1y - ny * t1x
  const R = PLANET_RADIUS
  const eps = 0.02
  const s = (ox: number, oy: number, oz: number): number =>
    bumpFn((nx + ox) * R, (ny + oy) * R, (nz + oz) * R)
  const dA = (s(eps * t1x, eps * t1y, eps * t1z) - s(-eps * t1x, -eps * t1y, -eps * t1z)) / (2 * eps)
  const dB = (s(eps * t2x, eps * t2y, eps * t2z) - s(-eps * t2x, -eps * t2y, -eps * t2z)) / (2 * eps)
  const crease = Math.hypot(dA, dB)
  // flow: `flowAlign <= 0` reproduces paintVertex's guard (no flow ⇒ [0,0,0]); `degenerate`
  // reproduces terrainFlowDir's pole early-return. Both leave the crease untouched above.
  if (flowAlign <= 0 || degenerate) return { crease, flow: [0, 0, 0] }
  let fx = -(dA * t1x + dB * t2x)
  let fy = -(dA * t1y + dB * t2y)
  let fz = -(dA * t1z + dB * t2z)
  const px = -1 + nx * nx, py = nx * ny, pz = nx * nz
  fx += flowStrength * px
  fy += flowStrength * (py - nz)
  fz += flowStrength * (pz + ny)
  const fl = Math.hypot(fx, fy, fz)
  if (fl < 1e-6) return { crease, flow: [0, 0, 0] }
  return { crease, flow: [fx / fl, fy / fl, fz / fl] }
}

/**
 * Applies the per-wedge scene accent to open ground (the six scenes each own a
 * saturated identity). `g` is wedgeGate at this point, so every accent fades to
 * neutral meadow on the meridians (all four abutting scenes seam through one
 * shared meadow — no hard colour lines) and at the poles (into beach/ocean).
 */
function accentMeadow(
  c: THREE.Color,
  pal: Pal,
  band: 0 | 1 | 2,
  variant: 0 | 1,
  nx: number,
  ny: number,
  nz: number,
  g: number
): void {
  if (g <= 0) return
  const spk = Math.sin(41.3 * nx + 2.1) * Math.sin(37.7 * ny - 1.3) * Math.sin(43.1 * nz + 0.6)
  const spk2 = Math.sin(29.1 * ny + 4.2) * Math.sin(31.7 * nz - 0.8) * Math.sin(27.3 * nx + 1.9)
  const hi = spk > 0.68
  const lo = spk < -0.72
  const hi2 = spk2 > 0.74
  const dot = (col: THREE.Color, amt: number) => c.lerp(col, amt * g)
  if (variant === 0) {
    if (band === 0) {
      // A0 BlueNet spring: vivid spring green, white-pink blossom speckle
      dot(pal.springGreen, 0.55)
      if (hi) dot(pal.snow, 0.5)
      else if (lo) dot(pal.petal, 0.6)
      if (hi2) dot(pal.blossom, 0.5)
    } else if (band === 1) {
      // A1 JUNGLE (Task 42): deep saturated jungle green floor — the fern-lit highlights
      // lift to moss, the shadow pockets sink to deep understory green, with the occasional
      // surviving flower (it was the flower field). The shared green field-mottle then layers
      // foliageDeep pockets + pineDeep veins on top for a lush, thumbed jungle floor; the
      // dense instanced flora (jungle.tsx) rides on the canopy mounds above it.
      dot(pal.jungleFloor, 0.74)
      if (hi) dot(pal.jungleMoss, 0.5)
      else if (lo) dot(pal.jungleDeep, 0.62)
      if (hi2) dot(pal.blossom, 0.3)
    } else {
      // A2 delta (Task 48): a WET-sandy braided delta — damp olive-silt banks, pale wet
      // sandbar crests and olive-green marsh hollows. Deliberately muddy/olive, NOT the
      // desert's dry gold: the silt base reads distinct from both B0 dune-gold and the A1
      // jungle green. The dense wetland flora + waders (delta.tsx) sit on the levee banks
      // (deltaLevees) above it.
      dot(pal.deltaSilt, 0.82)
      if (hi) dot(pal.deltaSand, 0.45) // exposed sandbar / levee crest
      else if (lo) dot(pal.deltaMoss, 0.55) // reed-grown marsh hollow
    }
  } else {
    if (band === 0) {
      // B0 Accenture golden dunes: rich saturated gold
      dot(pal.goldSand, 0.82)
      if (hi) dot(pal.honey, 0.5)
      else if (lo) dot(pal.dune, 0.55)
    } else if (band === 1) {
      // B1 AKNA: warm tuff-pink meadow SURROUND, so the rich-brown canyon (painted
      // by the biomeTint 'canyon' kind) reads as clay ADDED onto pink-warm ground —
      // a brown gorge winding through pink countryside. Tuff echoes the Yerevan set.
      dot(pal.meadow, 0.18)
      dot(pal.tuff, 0.62)
      if (hi) dot(pal.blossom, 0.45)
      else if (lo) dot(pal.petal, 0.45)
      if (hi2) dot(pal.tuff, 0.45)
    } else {
      // B2 winter (Task 50): cold blue-white drift ground — a pale ice base, bright snow crests,
      // frost-blue scoured hollows and sparse deep-spruce flecks. NO blossom pink (cold-palette
      // discipline; the winter scene's one warm note is the fox, a prop, not the ground).
      dot(pal.ice, 0.6)
      if (hi) dot(pal.snow, 0.5)
      else if (lo) dot(pal.frostShadow, 0.5)
      if (hi2) dot(pal.spruceDeep, 0.22)
    }
  }
}

/**
 * Paints one vertex from the biome map into `c`. `isB` selects the lap-2 (variant
 * B) scenes. The base meadow read is the fallback; biomeTint classifies water /
 * beach / canyon / snow, and accentMeadow lays each wedge's saturated identity on
 * the open ground (spring green, flower pink, delta sand, dune gold, canyon
 * brown, winter white-pink). Polar oceans + their beach ring are lap-invariant.
 */
export function paintVertex(
  c: THREE.Color,
  pal: Pal,
  nx: number,
  ny: number,
  nz: number,
  bump: number,
  isB: boolean,
  pre?: PaintPrecomp,
  dials?: LandDials
): void {
  const variant: 0 | 1 = isB ? 1 : 0
  // Task 47 — by-value dial snapshot for the worker/coalesced bake (the bake ALWAYS passes
  // `dials`, so `readLandDials()` never runs in the hot path). Omitted only on the standalone
  // unit-test path, where the live DIALS are read exactly as before — byte-identical.
  const d = dials ?? readLandDials()
  const wanderAmp = d.boundaryWander
  // open-meadow height read is the fallback everywhere
  const t = THREE.MathUtils.clamp(bump / 0.1 + 0.5, 0, 1)
  if (t < 0.5) c.lerpColors(pal.leaf, pal.meadow, t * 2)
  else c.lerpColors(pal.meadow, pal.sprout, (t - 0.5) * 2)

  const { kind, t: kt } = biomeTint(nx, ny, nz, bump, variant, wanderAmp)
  switch (kind) {
    case 'underwater':
      c.lerp(pal.deep, 0.55 + 0.35 * kt)
      break
    case 'beach': {
      c.lerp(pal.sand, 0.85 * kt)
      // shore takes a hint of its wedge (icy by the winter pond, earthy by the canyon)
      // so the beach ring isn't a uniform sand stripe. Task 38: the hint switches HARD
      // at the torn boundary (paintBand), like the land accents — no soft meridian fade.
      // It is faded to 0 before the grazing limb (polarLatGate → 0 by |nx|=0.75, well
      // inside the 0.80 invariance line), so the variant-specific hint only ever exists
      // in the proven-hidden mid-latitudes and never pops at the pole.
      const bthetaC = canonicalTheta(Math.atan2(nz, ny))
      const pband = paintBand(bthetaC, nx, wanderAmp)
      const latG = polarLatGate(nx)
      if (variant === 1 && pband === 2) c.lerp(pal.ice, 0.4 * kt * latG)
      else if (variant === 1 && pband === 1) c.lerp(pal.rust, 0.3 * kt * latG)
      // Task 48 — the A2 delta's braided shallows are WET silt, not dry desert sand:
      // pull the sandbar/shore toward the olive delta silt so the extensive delta beach
      // reads as damp mudflat, keeping the whole wedge distinct from the B0 gold desert.
      else if (variant === 0 && pband === 2) c.lerp(pal.deltaSilt, 0.72 * kt * latG)
      break
    }
    case 'canyon': {
      // rich brown layered earth: floor darkens to deep earth, banks/rims lighten
      // to warm terracotta clay — authored contrast so the gorge reads as carved.
      c.copy(pal.earth)
      c.lerp(pal.earthDeep, 0.6 * kt) // creek floor / deep gorge = darkest
      c.lerp(pal.clay, 0.4 * (1 - kt)) // upper banks + rims = lightened terracotta
      c.lerp(pal.rust, 0.12) // overall terracotta warmth
      break
    }
    case 'snow': {
      c.lerp(pal.snow, kt)
      // Task 50 — cold mottling replaces the old blossom-pink cast (cold-palette discipline):
      // wind-scoured frost-blue hollows, bright ice crest glints and sparse deep-spruce shadow
      // flecks, so the snow reads as pressed cold clay with character, not flat warm white.
      const spk = Math.sin(41.3 * nx + 2.1) * Math.sin(37.7 * ny - 1.3) * Math.sin(43.1 * nz + 0.6)
      const spk2 = Math.sin(29.1 * ny + 4.2) * Math.sin(31.7 * nz - 0.8) * Math.sin(27.3 * nx + 1.9)
      if (spk < -0.5) c.lerp(pal.frostShadow, 0.4 * kt)
      else if (spk > 0.6) c.lerp(pal.ice, 0.3 * kt)
      if (spk2 > 0.7) c.lerp(pal.spruceDeep, 0.2 * kt)
      break
    }
    default: {
      const thetaC = canonicalTheta(Math.atan2(nz, ny))
      // Task 38 — HARD boundary: the wedge accent paints at FULL strength across the
      // whole band (accentLatGate fades it ONLY toward the limbs), and the band identity
      // switches at the torn boundary curve (paintBand), so two neighbouring scenes abut
      // like two pressed clay slabs — no green connective seam. The near-meridian paint
      // is now variant-dependent (spring vs winter at full strength); it is renewal-safe
      // because every such vertex flips A→B only inside the occlusion-proven-hidden window
      // (proven by the paint-delta pass in bench/renewal-scan.mjs).
      const pband = paintBand(thetaC, nx, wanderAmp)
      accentMeadow(c, pal, pband, variant, nx, ny, nz, accentLatGate(nx))
    }
  }
  // Task 29 lever 1 (headline) — multi-scale field colour mottling. Variance WITHIN
  // the biome colour (deeper-hue pockets, drier smudges, sparse veins/grime) so the
  // open ground reads as pressed clay with character, not one flat CG-plastic field.
  // The 4-step ramp quantizes LIGHT then multiplies albedo, so this colour variance
  // survives at any frequency — the cheapest, most reliable clay cue we have.
  // Task 33: pass the LAND flow tangent so the mottle carries a flow-aligned streak
  // deepening (only computed when the flow field is enabled — align 0 skips the gradient).
  // Task 43: the bake threads the flow tangent (shared with the crease gradient) via `pre`;
  // the standalone/test path recomputes it exactly as before.
  const flow = pre
    ? pre.flow
    : d.terrainFlowAlign > 0
      ? terrainFlowDir(nx, ny, nz, isB ? terrainBumpB : terrainBump, d.terrainFlowStrength)
      : ([0, 0, 0] as [number, number, number])
  applyFieldMottle(c, pal, kind, nx, ny, nz, flow, d)
  // Crease darkening: hand-pushed clay carries dirt in its steep folds. Uses the
  // matching lap's slope so the deeper canyon / taller spires crease right.
  // Task-21: strengthened a notch (0.14 → 0.20) so the pinched folds read harder.
  // Task-27 (lever 5): the hardened feature skirts (pressed-edge peakBump) raise the
  // rim slope, so this same slope gate now auto-lays a shadow line along every pressed
  // edge; the multiplier is nudged 0.20→0.24 and the low threshold pulled in (0.12→
  // 0.10) so the new edges carry a crisp crease dark. Edge-gated (slope), not global,
  // so flat pastel meadow stays bright — rough, not gloomy.
  const crease = THREE.MathUtils.smoothstep(
    pre ? pre.crease : terrainSlope(nx, ny, nz, isB ? terrainBumpB : terrainBump),
    0.1,
    0.6
  )
  if (crease > 0) c.multiplyScalar(1 - 0.24 * crease)
  // Task 29 lever 3 — dent AO baked into albedo by DEPTH, not slope. Every pressed
  // hollow (the global dimple octaves AND the new off-lane field dents) darkens by its
  // own depth, independent of surface slope, so FLAT fields get "imperfections cast
  // shadow" — the crease gate above is slope-gated and misses them. Pure function of
  // the (jittered) direction, so it is identical on both bakes and a no-op on the spine
  // (dimple is symmetric there and the field dents are gated to exactly 0 on the lane).
  const dip = pre ? pre.dip : clayDimple(nx, ny, nz)
  const dent = pre ? pre.dent : fieldDents(nx, ny, nz, bump, d.dentDepth)
  let hollow = 0
  if (dip < 0) hollow += -dip / CLAY_DIMPLE_MAX
  // normalize by the snapshot dent depth (the dial) so the AO tracks the hollow, not a stale
  // constant; dent < 0 already implies dentDepth > 0.
  if (dent < 0) hollow += -dent / d.dentDepth
  hollow = THREE.MathUtils.clamp(hollow, 0, 1)
  if (hollow > 0) c.multiplyScalar(1 - d.dentAO * hollow)
  // Signature AO + edge definition (Task 23 lever 4): the molded grooves — ridge
  // troughs, canyon strata steps, dune ripple valleys — hold dirt, so each figure's
  // own carve darkens into it. This is the crease-dirt logic pushed to the feature's
  // own structure, so a mountain/canyon/dune reads pressed, not blended into meadow.
  const sig = pre ? pre.sig : claySignature(nx, ny, nz, bump, variant)
  if (sig < 0) {
    const groove = THREE.MathUtils.clamp(-sig / CLAY_SIGNATURE_MAX, 0, 1)
    c.multiplyScalar(1 - 0.12 * groove)
  }
  // Task 38 — the pressed-clay seam crease. Where two wedges meet at the torn boundary
  // the raised lip (baked into geometry below) carries a dark crease line, like dirt in
  // the fold where two clay slabs are pushed together. Colour-only here; gated to EXACTLY
  // 0 on the lane + limbs by boundaryRidgeShape, and skipped entirely when the ridge dial
  // is 0 (the "truly hard colour switch, no physicality" fallback).
  if (d.boundaryRidge > 0) {
    const ridgeProf = pre ? pre.ridgeShape : boundaryRidgeShape(nx, ny, nz, wanderAmp)
    if (ridgeProf > 0) c.multiplyScalar(1 - 0.16 * ridgeProf)
  }
}

/** Flat per-face normals for a non-indexed positions buffer. */
function flatNormals(positions: Float32Array): Float32Array {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  g.computeVertexNormals()
  const n = (g.attributes.normal.array as Float32Array).slice()
  g.dispose()
  return n
}

/** The planet colour palette as THREE.Colors, built once per bake from the hex PALETTE.
 *  Exported so the paint unit tests can reproduce the exact bake palette (single source). */
export function buildPal(): Pal {
  return {
    leaf: new THREE.Color(PALETTE.leaf),
    meadow: new THREE.Color(PALETTE.meadow),
    sprout: new THREE.Color(PALETTE.sprout),
    clay: new THREE.Color(PALETTE.clayPath),
    deep: new THREE.Color(PALETTE.riverDeep),
    honey: new THREE.Color(PALETTE.honey),
    snow: new THREE.Color(PALETTE.snow),
    earth: new THREE.Color(PALETTE.earth),
    pine: new THREE.Color(PALETTE.pine),
    dune: new THREE.Color(PALETTE.dune),
    blossom: new THREE.Color(PALETTE.blossom),
    blossomDeep: new THREE.Color(PALETTE.blossomDeep),
    springGreen: new THREE.Color(PALETTE.springGreen),
    petal: new THREE.Color(PALETTE.petal),
    sand: new THREE.Color(PALETTE.sand),
    goldSand: new THREE.Color(PALETTE.goldSand),
    earthDeep: new THREE.Color(PALETTE.earthDeep),
    rust: new THREE.Color(PALETTE.rust),
    ice: new THREE.Color(PALETTE.ice),
    tuff: new THREE.Color(PALETTE.tuff),
    foliageDeep: new THREE.Color(PALETTE.foliageDeep),
    pineDeep: new THREE.Color(PALETTE.pineDeep),
    meadowDry: new THREE.Color(PALETTE.meadowDry),
    jungleFloor: new THREE.Color(PALETTE.jungleFloor),
    jungleDeep: new THREE.Color(PALETTE.jungleDeep),
    jungleMoss: new THREE.Color(PALETTE.jungleMoss),
    deltaSilt: new THREE.Color(PALETTE.deltaSilt),
    deltaSand: new THREE.Color(PALETTE.deltaSand),
    deltaMoss: new THREE.Color(PALETTE.deltaMoss),
    frostShadow: new THREE.Color(PALETTE.frostShadow),
    spruceDeep: new THREE.Color(PALETTE.spruceDeep),
  } satisfies Pal
}

/** The raw baked arrays for the land — everything `useHillGeometry` needs to assemble the
 *  live geometry + MorphBake. Extracted (Task 43) so the bake is a pure function the perf
 *  hash/timing harness can drive directly (the hook only wraps it in a useMemo and wires the
 *  THREE attributes). */
export type LandBake = {
  positionsA: Float32Array; positionsB: Float32Array
  colorsA: Float32Array; colorsB: Float32Array
  normalsA: Float32Array; normalsB: Float32Array
  floodedPositions: Float32Array; floodedColors: Float32Array; floodedNormals: Float32Array
  thetaC: Float32Array
  capIdx: Int32Array; capNx: Float32Array; capNy: Float32Array; capNz: Float32Array
}

/**
 * Bakes both variant worlds over the pre-displacement icosahedron `src` (a position
 * BufferAttribute of `count` verts; `EDGE` is the local sub-triangle edge length). Pure —
 * the dial values arrive by VALUE (`dials`, a plain snapshot), never from a live store, so the
 * same snapshot bakes byte-identical arrays whether this runs on the worker or the synchronous
 * fallback. `dials` defaults to a fresh `readLandDials()` (main-thread callers / the perf
 * bench); the worker always passes an explicit snapshot. Single source of truth for the land
 * bake shared by the runtime hook, the worker, and the perf/identity benches.
 */
export function bakeLandArrays(
  src: THREE.BufferAttribute,
  count: number,
  EDGE: number,
  dials: LandDials = readLandDials()
): LandBake {
  const positionsA = new Float32Array(count * 3)
  const positionsB = new Float32Array(count * 3)
  const colorsA = new Float32Array(count * 3)
  const colorsB = new Float32Array(count * 3)
  // Round 7 tide targets: the flooded state of the right grazing limb + its verts.
  const floodedPositions = new Float32Array(count * 3)
  const floodedColors = new Float32Array(count * 3)
  // Task 29 lever 4 — per-FACE static normal dither (one vector per triangle, seeded
  // by its first vertex, gated to OPEN field facets). Applied to the flat normals
  // after they are computed so field facets straddle the ramp bands at the terminator
  // (grazing-light speckle) while feature facets + the lit mid-band stay clean. The
  // geometry is non-indexed with contiguous face triplets, so one vector per face
  // keeps every facet flat.
  const faceDither = new Float32Array(count) // [f*3 .. f*3+2] per face f = i/3
  const capIdx: number[] = []
  const capNxL: number[] = []
  const capNyL: number[] = []
  const capNzL: number[] = []
  const thetaC = new Float32Array(count)
  const v = new THREE.Vector3()
  const pal = buildPal()
  // Task 38 — the torn-boundary dials (rebake-class). The wander warps WHERE two wedges
  // switch accent; the ridge is the pressed-clay lip baked onto the boundary curve. Both
  // are variant-INVARIANT, so both bakes carry the same lip and the seam never flips.
  const wanderAmp = dials.boundaryWander
  const ridgeH = dials.boundaryRidge
  // Task 43: the flow dials are constant across the bake — read once so the merged gradient
  // (Win A) can be threaded into paintVertex without a per-vertex dial read.
  const flowAlign = dials.terrainFlowAlign
  const flowStrength = dials.terrainFlowStrength
  const c = new THREE.Color()
  // Task 43: reused scratch carrying the per-vertex invariants into paintVertex (Win B/C:
  // claySignature / dimple / field-dents / boundary-ridge shape; Win A: crease + flow).
  // Reused (not reallocated) per vertex — the paint call reads each synchronously.
  const preA: PaintPrecomp = { sig: 0, dip: 0, dent: 0, ridgeShape: 0, crease: 0, flow: [0, 0, 0] }
  const preB: PaintPrecomp = { sig: 0, dip: 0, dent: 0, ridgeShape: 0, crease: 0, flow: [0, 0, 0] }
  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(src, i)
    const sx = v.x / PLANET_RADIUS
    const sy = v.y / PLANET_RADIUS
    const sz = v.z / PLANET_RADIUS
    // Orthonormal tangent basis at the SOURCE direction (same convention as
    // terrainSlope): t1 = normalize(n × up) with an x-axis fallback at the poles.
    let t1x = -sz
    let t1z = sx
    const tl = Math.hypot(t1x, t1z)
    const t1y = 0
    if (tl < 1e-4) { t1x = 1; t1z = 0 } else { t1x /= tl; t1z /= tl }
    const t2x = sy * t1z - sz * t1y
    const t2y = sz * t1x - sx * t1z
    const t2z = sx * t1y - sy * t1x
    // Break the geodesic grid: jitter the source vertex tangentially, then work
    // from the jittered direction for everything the vertex renders.
    const [nx, ny, nz] = jitterDir(sx, sy, sz, t1x, t1y, t1z, t2x, t2y, t2z, EDGE)
    thetaC[i] = canonicalTheta(Math.atan2(nz, ny))
    const dimple = clayDimple(nx, ny, nz)
    const rjit = JITTER_RAD * (2 * hash01(sx, sy, sz, 5.1) - 1)
    const bumpA = terrainBump(nx * PLANET_RADIUS, ny * PLANET_RADIUS, nz * PLANET_RADIUS)
    const bumpB = terrainBumpB(nx * PLANET_RADIUS, ny * PLANET_RADIUS, nz * PLANET_RADIUS)
    // per-figure molded signature (inward-only, off-lane): each variant bakes its own.
    // Task 29 lever 2 — off-lane field press-dents (inward-only, EXACTLY 0 on the lane
    // band, so no new spine-band render term — the contact budget is unmoved).
    // Task 38 — the pressed-clay boundary lip: a variant-INVARIANT raised welt on the
    // torn seam curve, EXACTLY 0 on the lane band (boundaryRidgeShape early-returns), so
    // it adds no spine-band displacement; identical in rA and rB, so the renewal front
    // lerps it as a no-op (it never flips).
    // Task 43 (Win B/C): compute the per-figure signature + field dents ONCE per variant
    // + the shared boundary-ridge shape here (the radius pass needs them), then thread them
    // into paintVertex — removing the duplicate recompute that used to run inside each
    // paintVertex call. The radius expressions are unchanged (same operands, same order).
    const ridgeShape = boundaryRidgeShape(nx, ny, nz, wanderAmp)
    const ridge = ridgeH * ridgeShape
    const sigA = claySignature(nx, ny, nz, bumpA, 0)
    const sigB = claySignature(nx, ny, nz, bumpB, 1)
    const dentA = fieldDents(nx, ny, nz, bumpA, dials.dentDepth)
    const dentB = fieldDents(nx, ny, nz, bumpB, dials.dentDepth)
    const rA = 1 + bumpA + dimple + rjit + sigA + dentA + ridge
    const rB = 1 + bumpB + dimple + rjit + sigB + dentB + ridge
    // Task 29 lever 4 — one dither vector per face (on the first face-vertex), gated to
    // low-relief open ground. A ~1° tilt only re-bands a facet within ~0.02 of a ramp
    // threshold (i.e. at the terminator), never mid-face — so the lit face stays clean.
    if (i % 3 === 0) {
      const fieldG = 1 - THREE.MathUtils.smoothstep(bumpA, 0.05, 0.12)
      const ds = dials.terminatorDither * fieldG
      const f3 = i // i is already the face base (i%3===0) → store at [i..i+2]
      faceDither[f3] = ds * (2 * hash01(nx, ny, nz, 71.3) - 1)
      faceDither[f3 + 1] = ds * (2 * hash01(nx, ny, nz, 91.7) - 1)
      faceDither[f3 + 2] = ds * (2 * hash01(nx, ny, nz, 113.1) - 1)
    }
    positionsA[i * 3] = nx * PLANET_RADIUS * rA
    positionsA[i * 3 + 1] = ny * PLANET_RADIUS * rA
    positionsA[i * 3 + 2] = nz * PLANET_RADIUS * rA
    positionsB[i * 3] = nx * PLANET_RADIUS * rB
    positionsB[i * 3 + 1] = ny * PLANET_RADIUS * rB
    positionsB[i * 3 + 2] = nz * PLANET_RADIUS * rB

    // Task 43 (Win A): the terrain gradient (crease magnitude + flow tangent) computed ONCE
    // per variant here — it was computed TWICE inside each paintVertex call (terrainSlope +
    // terrainFlowDir each did the same four terrainBump samples). Threaded through preA/preB
    // along with the Win B/C invariants above.
    const gradA = terrainGradientField(nx, ny, nz, terrainBump, flowStrength, flowAlign)
    const gradB = terrainGradientField(nx, ny, nz, terrainBumpB, flowStrength, flowAlign)
    preA.sig = sigA; preA.dip = dimple; preA.dent = dentA; preA.ridgeShape = ridgeShape
    preA.crease = gradA.crease; preA.flow = gradA.flow
    preB.sig = sigB; preB.dip = dimple; preB.dent = dentB; preB.ridgeShape = ridgeShape
    preB.crease = gradB.crease; preB.flow = gradB.flow
    paintVertex(c, pal, nx, ny, nz, bumpA, false, preA, dials)
    colorsA[i * 3] = c.r; colorsA[i * 3 + 1] = c.g; colorsA[i * 3 + 2] = c.b
    paintVertex(c, pal, nx, ny, nz, bumpB, true, preB, dials)
    colorsB[i * 3] = c.r; colorsB[i * 3 + 1] = c.g; colorsB[i * 3 + 2] = c.b

    // Round 7 tide: bake the FLOODED target for the +x grazing limb (nx > LO). rA
    // === rB there (grazing-limb invariant), so A is the base; the flooded radius
    // drops TIDE_DEPTH below it (clearly under the waterline) and the colour goes to
    // deep water. Elsewhere the flooded target === the A bake (a no-op the tide never
    // touches). The per-frame tide lerps A → flooded by tideWetness on the cap bucket.
    if (nx > TIDE_LAT_LO) {
      const floodedR = rA - TIDE_DEPTH
      floodedPositions[i * 3] = nx * PLANET_RADIUS * floodedR
      floodedPositions[i * 3 + 1] = ny * PLANET_RADIUS * floodedR
      floodedPositions[i * 3 + 2] = nz * PLANET_RADIUS * floodedR
      floodedColors[i * 3] = pal.deep.r
      floodedColors[i * 3 + 1] = pal.deep.g
      floodedColors[i * 3 + 2] = pal.deep.b
      capIdx.push(i); capNxL.push(nx); capNyL.push(ny); capNzL.push(nz)
    } else {
      floodedPositions[i * 3] = positionsA[i * 3]
      floodedPositions[i * 3 + 1] = positionsA[i * 3 + 1]
      floodedPositions[i * 3 + 2] = positionsA[i * 3 + 2]
      floodedColors[i * 3] = colorsA[i * 3]
      floodedColors[i * 3 + 1] = colorsA[i * 3 + 1]
      floodedColors[i * 3 + 2] = colorsA[i * 3 + 2]
    }
  }
  const normalsA = flatNormals(positionsA)
  const normalsB = flatNormals(positionsB)
  const floodedNormals = flatNormals(floodedPositions)
  // Task 29 lever 4 — add the per-face field dither to the flat normals and
  // renormalize. Same vector on all 3 verts of a face keeps the facet flat; the
  // dither is a pure function of direction, so A/B/flooded share it and the morph
  // (which lerps normals) stays seamless.
  const faces = count / 3
  const applyFaceDither = (nor: Float32Array): void => {
    for (let f = 0; f < faces; f++) {
      const dx = faceDither[f * 3], dy = faceDither[f * 3 + 1], dz = faceDither[f * 3 + 2]
      if (dx === 0 && dy === 0 && dz === 0) continue
      for (let vtx = 0; vtx < 3; vtx++) {
        const k = (f * 3 + vtx) * 3
        const x = nor[k] + dx, y = nor[k + 1] + dy, z = nor[k + 2] + dz
        const l = Math.hypot(x, y, z) || 1
        nor[k] = x / l; nor[k + 1] = y / l; nor[k + 2] = z / l
      }
    }
  }
  applyFaceDither(normalsA)
  applyFaceDither(normalsB)
  applyFaceDither(floodedNormals)

  return {
    positionsA, positionsB, colorsA, colorsB, normalsA, normalsB,
    thetaC,
    floodedPositions, floodedColors, floodedNormals,
    capIdx: Int32Array.from(capIdx),
    capNx: Float32Array.from(capNxL),
    capNy: Float32Array.from(capNyL),
    capNz: Float32Array.from(capNzL),
  }
}

