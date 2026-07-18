'use client'
import { useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../palette'
import type { JourneyRef } from './use-journey'
import { useClayRamp } from './toon-ramp'
import {
  WATER_LEVEL,
  biomeBump,
  biomeBumpB,
  biomeTint,
  bandOf,
  colorGate,
  channelDist,
  canyonCreekDist,
  tideCarve,
  tideWetnessFast,
  tideFrontOffset,
  TIDE_LAT_LO,
  TIDE_DEPTH,
} from './biomes'
import { canonicalTheta, renewalGate } from './renewal'
import { buildBuckets, makeRenewalMorph, type Buckets } from './bucketed-morph'

export const PLANET_RADIUS = 2.2

/** Re-exported so prop/dressing modules keep importing the waterline from here. */
export { WATER_LEVEL }

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
 * 0.0115·R. */
function clayDimple(nx: number, ny: number, nz: number): number {
  return (
    0.009 * Math.sin(7.9 * nx + 1.1) * Math.sin(7.4 * ny - 0.4) * Math.sin(7.7 * nz + 2.3) +
    0.0025 * Math.sin(27.3 * ny + 0.7) * Math.sin(26.4 * nz - 1.3) * Math.sin(28.1 * nx + 0.5)
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

/** Tangential jitter budget as a fraction of the local sub-triangle edge. */
const JITTER_TAN = 0.34
/** Tiny radial jitter (fraction of R) layered on the dimple for extra hand-made
 * lumpiness. Kept small so the combined render-vs-analytic offset the girl/shadow
 * must forgive stays well inside the dimple-dominated budget. Peak = this value. */
const JITTER_RAD = 0.0013

type Pal = {
  leaf: THREE.Color; meadow: THREE.Color; sprout: THREE.Color; clay: THREE.Color
  deep: THREE.Color; honey: THREE.Color; snow: THREE.Color; earth: THREE.Color
  pine: THREE.Color; dune: THREE.Color; blossom: THREE.Color; blossomDeep: THREE.Color
  springGreen: THREE.Color; petal: THREE.Color; sand: THREE.Color; goldSand: THREE.Color
  earthDeep: THREE.Color; rust: THREE.Color; ice: THREE.Color; tuff: THREE.Color
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
      // A1 FLYERBEE flower field: lush green rioting with pink/honey flowers
      dot(pal.meadow, 0.25)
      if (hi) dot(pal.petal, 0.72)
      else if (lo) dot(pal.honey, 0.62)
      if (hi2) dot(pal.blossomDeep, 0.55)
    } else {
      // A2 delta: sandy braided banks (mostly water + sand)
      dot(pal.sand, 0.78)
      if (hi) dot(pal.dune, 0.5)
      else if (lo) dot(pal.goldSand, 0.4)
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
      // B2 winter-meets-blossom: pink on white (snow kind covers the core)
      dot(pal.ice, 0.6)
      if (hi) dot(pal.blossom, 0.6)
      else if (lo) dot(pal.petal, 0.55)
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
function paintVertex(
  c: THREE.Color,
  pal: Pal,
  nx: number,
  ny: number,
  nz: number,
  bump: number,
  isB: boolean
): void {
  const variant: 0 | 1 = isB ? 1 : 0
  // open-meadow height read is the fallback everywhere
  const t = THREE.MathUtils.clamp(bump / 0.1 + 0.5, 0, 1)
  if (t < 0.5) c.lerpColors(pal.leaf, pal.meadow, t * 2)
  else c.lerpColors(pal.meadow, pal.sprout, (t - 0.5) * 2)

  const { kind, t: kt } = biomeTint(nx, ny, nz, bump, variant)
  switch (kind) {
    case 'underwater':
      c.lerp(pal.deep, 0.55 + 0.35 * kt)
      break
    case 'beach': {
      c.lerp(pal.sand, 0.85 * kt)
      // shore takes a hint of its wedge (icy by the winter pond, earthy by the
      // canyon) so the beach ring isn't a uniform sand stripe
      const band = bandOf(canonicalTheta(Math.atan2(nz, ny)))
      if (variant === 1 && band === 2) c.lerp(pal.ice, 0.4 * kt)
      else if (variant === 1 && band === 1) c.lerp(pal.rust, 0.3 * kt)
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
      // faint blossom-pink cast dusting the winter summit
      const spk = Math.sin(41.3 * nx + 2.1) * Math.sin(37.7 * ny - 1.3) * Math.sin(43.1 * nz + 0.6)
      if (spk > 0.72) c.lerp(pal.blossom, 0.35 * kt)
      break
    }
    default: {
      const thetaC = canonicalTheta(Math.atan2(nz, ny))
      const g = colorGate(thetaC, nx)
      accentMeadow(c, pal, bandOf(thetaC), variant, nx, ny, nz, g)
    }
  }
  // Crease darkening: hand-pushed clay carries dirt in its steep folds. Uses the
  // matching lap's slope so the deeper canyon / taller spires crease right.
  // Task-21: strengthened a notch (0.14 → 0.20) so the pinched folds read harder.
  const crease = THREE.MathUtils.smoothstep(
    terrainSlope(nx, ny, nz, isB ? terrainBumpB : terrainBump),
    0.12,
    0.6
  )
  if (crease > 0) c.multiplyScalar(1 - 0.2 * crease)
  // Cheap AO for the thumb presses: pressed-in dimple hollows hold a little shadow.
  // Pure function of the (jittered) direction, so it is identical on both bakes and
  // is a no-op in the morph on the spine.
  const dip = clayDimple(nx, ny, nz)
  if (dip < 0) {
    const hollow = THREE.MathUtils.clamp(-dip / CLAY_DIMPLE_MAX, 0, 1)
    c.multiplyScalar(1 - 0.06 * hollow)
  }
  // Signature AO + edge definition (Task 23 lever 4): the molded grooves — ridge
  // troughs, canyon strata steps, dune ripple valleys — hold dirt, so each figure's
  // own carve darkens into it. This is the crease-dirt logic pushed to the feature's
  // own structure, so a mountain/canyon/dune reads pressed, not blended into meadow.
  const sig = claySignature(nx, ny, nz, bump, variant)
  if (sig < 0) {
    const groove = THREE.MathUtils.clamp(-sig / CLAY_SIGNATURE_MAX, 0, 1)
    c.multiplyScalar(1 - 0.12 * groove)
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

/** The two baked worlds + per-vertex thetaC buckets the per-frame traveling front
 *  lerps between. */
type MorphBake = {
  positionsA: Float32Array; positionsB: Float32Array
  colorsA: Float32Array; colorsB: Float32Array
  normalsA: Float32Array; normalsB: Float32Array
  thetaC: Float32Array; buckets: Buckets
  // Round 7 tide: the flooded-limb target + the static right-cap vertex bucket the
  // per-frame tide re-evaluates (base A === B on the grazing limb, so A is the base).
  floodedPositions: Float32Array; floodedColors: Float32Array; floodedNormals: Float32Array
  capIdx: Int32Array; capNx: Float32Array; capNy: Float32Array; capNz: Float32Array
}

/**
 * Chunky vertex-displaced sphere, dual-baked: variant A (lap-1 spring) and
 * variant B (lap-2 autumn→winter) over the SAME pre-displacement icosahedron.
 * The returned geometry starts on A; the bucketed renewal front lerps position/
 * color/normal toward B per vertex as each longitude passes behind the horizon.
 * Because the spine band never morphs, A and B coincide there and the lerp is a
 * no-op on the lane.
 */
function useHillGeometry(): { geometry: THREE.BufferGeometry; bake: MorphBake } {
  return useMemo(() => {
    const ICO_DETAIL = 24
    const geo = new THREE.IcosahedronGeometry(PLANET_RADIUS, ICO_DETAIL)
    const src = geo.attributes.position
    const count = src.count
    // Local sub-triangle edge length: icosahedron edge (circumradius·1.0515)
    // split into ICO_DETAIL segments. The tangential jitter is a fraction of this.
    const EDGE = (PLANET_RADIUS * 1.0515) / ICO_DETAIL
    const positionsA = new Float32Array(count * 3)
    const positionsB = new Float32Array(count * 3)
    const colorsA = new Float32Array(count * 3)
    const colorsB = new Float32Array(count * 3)
    // Round 7 tide targets: the flooded state of the right grazing limb + its verts.
    const floodedPositions = new Float32Array(count * 3)
    const floodedColors = new Float32Array(count * 3)
    const capIdx: number[] = []
    const capNxL: number[] = []
    const capNyL: number[] = []
    const capNzL: number[] = []
    const thetaC = new Float32Array(count)
    const v = new THREE.Vector3()
    const pal = {
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
    } satisfies Pal
    const c = new THREE.Color()
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
      const rA = 1 + bumpA + dimple + rjit + claySignature(nx, ny, nz, bumpA, 0)
      const rB = 1 + bumpB + dimple + rjit + claySignature(nx, ny, nz, bumpB, 1)
      positionsA[i * 3] = nx * PLANET_RADIUS * rA
      positionsA[i * 3 + 1] = ny * PLANET_RADIUS * rA
      positionsA[i * 3 + 2] = nz * PLANET_RADIUS * rA
      positionsB[i * 3] = nx * PLANET_RADIUS * rB
      positionsB[i * 3 + 1] = ny * PLANET_RADIUS * rB
      positionsB[i * 3 + 2] = nz * PLANET_RADIUS * rB

      paintVertex(c, pal, nx, ny, nz, bumpA, false)
      colorsA[i * 3] = c.r; colorsA[i * 3 + 1] = c.g; colorsA[i * 3 + 2] = c.b
      paintVertex(c, pal, nx, ny, nz, bumpB, true)
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

    // Live attributes start on lap-1 (A); the frame lerp writes toward B.
    const posAttr = new THREE.BufferAttribute(positionsA.slice(), 3).setUsage(THREE.DynamicDrawUsage)
    const colAttr = new THREE.BufferAttribute(colorsA.slice(), 3).setUsage(THREE.DynamicDrawUsage)
    const norAttr = new THREE.BufferAttribute(normalsA.slice(), 3).setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('position', posAttr)
    geo.setAttribute('color', colAttr)
    geo.setAttribute('normal', norAttr)

    return {
      geometry: geo,
      bake: {
        positionsA, positionsB, colorsA, colorsB, normalsA, normalsB,
        thetaC, buckets: buildBuckets(thetaC),
        floodedPositions, floodedColors, floodedNormals,
        capIdx: Int32Array.from(capIdx),
        capNx: Float32Array.from(capNxL),
        capNy: Float32Array.from(capNyL),
        capNz: Float32Array.from(capNzL),
      },
    }
  }, [])
}

/** The dual-baked water sphere: variant-independent geometry, two colour bakes. */
type WaterBake = {
  geometry: THREE.BufferGeometry
  colorsA: Float32Array; colorsB: Float32Array
  thetaC: Float32Array; buckets: Buckets
}

/**
 * The clay water sphere at WATER_LEVEL. Every basin, river channel and canyon
 * floor dips below it, so it shows through as sea, veins and pools. Deep river
 * blue DOMINATES the surface (darkening toward an ink-blue abyss in the deeps);
 * the lighter river blue survives only as a shallow rim near shores. The sphere
 * carries its own gentle inward-only clay displacement so it reads as
 * hand-pushed clay under the toon ramp, never flat glass — and never pokes
 * above the shoreline.
 *
 * Positions/lumps are variant-INDEPENDENT (water geography is just terrain dipping
 * under the sphere), but the depth-tinted COLOURS read terrainBump — so they are
 * dual-baked (depth vs bumpA and bumpB) and lerped by the SAME bucketed renewal
 * gate as the land. On the spine bumpB === bumpA, so the colour is lap-invariant
 * there; only flank shallows re-tint.
 */
function useWaterGeometry(): WaterBake {
  return useMemo(() => {
    // Fewer segments = larger facets; the SphereGeometry is indexed, so
    // toNonIndexed + flat normals below turns it into visible lumpy clay water.
    const geo = new THREE.SphereGeometry(PLANET_RADIUS * WATER_LEVEL, 48, 48)
    const pos = geo.attributes.position
    const colorsIdxA = new Float32Array(pos.count * 3)
    const colorsIdxB = new Float32Array(pos.count * 3)
    const v = new THREE.Vector3()
    const ink = new THREE.Color(PALETTE.ink)
    const river = new THREE.Color(PALETTE.river)
    // deep clay blue DOMINATES: riverDeep pushed darker for the body of the water
    const deepBase = new THREE.Color(PALETTE.riverDeep).lerp(ink, 0.22)
    const abyss = new THREE.Color(PALETTE.riverDeep).lerp(ink, 0.5)
    const c = new THREE.Color()
    // Task 23 — molded water: the deep-blue reads TOUGHER and hand-pressed. Colour
    // now answers THREE depths, not just the terrain basin: (1) terrain depth (deep
    // basins → abyss); (2) the sphere's own molded TROUGH depth (a pressed hollow in
    // the clay sheet darkens toward abyss even over a flat floor, so the water is not
    // one even blue); (3) a near-DECK deepening along the lane channels (the A0 strait
    // read pale at mid-face because the shallow-rim brightening dominated its
    // width-carried carve — this pushes its near-deck tint back to deep blue). Rims
    // (high, shallow crests of the clay sheet) keep the lighter river blue.
    const paintDepth = (
      out: Float32Array, i: number, bump: number, trough: number, deck: number
    ): void => {
      const terrainDepth = THREE.MathUtils.clamp((WATER_LEVEL - (1 + bump)) / 0.08, 0, 1)
      const deep = Math.max(terrainDepth, 0.85 * trough, 0.7 * deck)
      c.copy(deepBase).lerp(abyss, THREE.MathUtils.smoothstep(deep, 0.3, 1))
      // river-blue rim survives only on the shallow crests: killed in troughs and by
      // the near-deck deepening, so molded hollows + the strait deck stay deep blue.
      const rim = (1 - THREE.MathUtils.smoothstep(terrainDepth, 0.0, 0.15)) *
        (1 - 0.6 * trough) * (1 - 0.7 * deck)
      c.lerp(river, 0.5 * rim)
      out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b
    }
    // Peak inward push of the molded clay sheet (trough-biased low octave + fine
    // grain). Floor = WATER_LEVEL·(1−WATER_MOLD_MAX) ≈ 0.969·WATER_LEVEL, still well
    // above every basin floor and below the shoreline (proven in scan-task23).
    const WATER_MOLD_MAX = 0.024 + 0.007
    // How near a lane channel the deep near-deck tint reaches (rad); kept tight to the
    // girl's lane (|nx|) so the wide off-lane delta fan / beach shallows are NOT
    // over-darkened — only the deck approaches deepen.
    const DECK_REACH = 0.14
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const dir = v.clone().normalize()
      const px = dir.x * PLANET_RADIUS, py = dir.y * PLANET_RADIUS, pz = dir.z * PLANET_RADIUS
      // clay lumps, inward-only (radius never exceeds WATER_LEVEL → no shoreline
      // poke-through); two octaves + recomputed normals catch the ramp as clay.
      // Task-23: trough-biased so most of the sheet sits at the shallow rim while
      // occasional pressed hollows dig DEEP (a power curve on the low octave), giving
      // the molded deep-trough / shallow-rim contrast — beyond Task 21's even scale.
      const w1 = Math.sin(3.3 * dir.x + 1.3) * Math.sin(3.0 * dir.y - 0.7) * Math.sin(3.5 * dir.z + 2.1)
      const w2 = Math.sin(7.1 * dir.y + 0.5) * Math.sin(6.6 * dir.z - 1.1) * Math.sin(6.9 * dir.x + 2.6)
      const t1 = Math.pow(0.5 + 0.5 * w1, 1.7)
      const t2 = 0.5 + 0.5 * w2
      const inward = 0.024 * t1 + 0.007 * t2
      const trough = THREE.MathUtils.clamp(inward / WATER_MOLD_MAX, 0, 1)
      // near-deck deepening, per variant (the strait is A0; every lane channel gets a
      // deep deck approach). Gated tight to the lane so the delta/beach stay untouched.
      const nearLane = 1 - THREE.MathUtils.smoothstep(Math.abs(dir.x), 0.12, 0.36)
      const deckA = nearLane * THREE.MathUtils.clamp(
        (DECK_REACH - channelDist(dir.x, dir.y, dir.z, 0)) / DECK_REACH, 0, 1)
      const deckB = nearLane * THREE.MathUtils.clamp(
        (DECK_REACH - channelDist(dir.x, dir.y, dir.z, 1)) / DECK_REACH, 0, 1)
      paintDepth(colorsIdxA, i, terrainBump(px, py, pz), trough, deckA)
      paintDepth(colorsIdxB, i, terrainBumpB(px, py, pz), trough, deckB)
      v.multiplyScalar(1 - inward)
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    // Flat-shade: expand to non-indexed then per-face normals so the water shows
    // hand-pinched clay facets under the ramp, not a smooth glass blob. Both colour
    // bakes are expanded with the positions, so they stay facet-crisp too.
    geo.setAttribute('color', new THREE.BufferAttribute(colorsIdxA.slice(), 3))
    geo.setAttribute('colorB', new THREE.BufferAttribute(colorsIdxB, 3))
    const flat = geo.toNonIndexed()
    geo.dispose()
    flat.computeVertexNormals()

    // Per-vertex thetaC of the non-indexed water verts, for the same bucketed gate.
    const fpos = flat.attributes.position
    const colorsA = (flat.attributes.color.array as Float32Array).slice()
    const colorsB = (flat.attributes.colorB.array as Float32Array).slice()
    flat.deleteAttribute('colorB')
    // live colour buffer starts on A; the bucketed morph writes toward B per frame
    flat.setAttribute('color', new THREE.BufferAttribute(colorsA.slice(), 3).setUsage(THREE.DynamicDrawUsage))
    const thetaC = new Float32Array(fpos.count)
    for (let i = 0; i < fpos.count; i++) {
      thetaC[i] = canonicalTheta(Math.atan2(fpos.getZ(i), fpos.getY(i)))
    }
    return { geometry: flat, colorsA, colorsB, thetaC, buckets: buildBuckets(thetaC) }
  }, [])
}

/**
 * The Round 7 overflow tide (Mechanism B). Re-evaluates ONLY the static right-cap
 * vertex bucket (|nx| > TIDE_LAT_LO — a fixed set, since the poles sit at ±x and the
 * planet spins about x) each frame, lerping the base (A, which equals B on the grazing
 * limb) toward the flooded target by tideWetness(nx, rotation). Continuous + monotone
 * in rotation, so the right limb goes dry → wet exactly once across the journey. Runs
 * AFTER the renewal front each frame so it owns the final cap value. Cost is reported
 * next to the front in renewal-cost.mjs (cap bucket ≈ 10% of the buffer).
 */
function makeTideMorph(args: {
  geo: THREE.BufferGeometry
  bake: MorphBake
}): { update: (rotation: number) => void } {
  const { geo, bake } = args
  const posArr = geo.attributes.position.array as Float32Array
  const colArr = geo.attributes.color.array as Float32Array
  const norArr = geo.attributes.normal.array as Float32Array
  const { capIdx, capNx, capNy, capNz } = bake
  const basePos = bake.positionsA
  const baseCol = bake.colorsA
  const baseNor = bake.normalsA
  const { floodedPositions: fPos, floodedColors: fCol, floodedNormals: fNor } = bake
  // Bake the azimuthal shoreline offset per cap vertex ONCE, so the per-frame lerp
  // avoids atan2 (keeps front + tide under the ~0.5 ms budget — see renewal-cost.mjs).
  const capWob = new Float32Array(capIdx.length)
  for (let k = 0; k < capIdx.length; k++) capWob[k] = tideFrontOffset(capNy[k], capNz[k])
  let last = Number.NaN
  const update = (rotation: number): void => {
    if (rotation === last) return
    last = rotation
    for (let k = 0; k < capIdx.length; k++) {
      const i = capIdx[k]
      const g = tideWetnessFast(capNx[k], capWob[k], rotation)
      const j = i * 3
      posArr[j] = basePos[j] + (fPos[j] - basePos[j]) * g
      posArr[j + 1] = basePos[j + 1] + (fPos[j + 1] - basePos[j + 1]) * g
      posArr[j + 2] = basePos[j + 2] + (fPos[j + 2] - basePos[j + 2]) * g
      colArr[j] = baseCol[j] + (fCol[j] - baseCol[j]) * g
      colArr[j + 1] = baseCol[j + 1] + (fCol[j + 1] - baseCol[j + 1]) * g
      colArr[j + 2] = baseCol[j + 2] + (fCol[j + 2] - baseCol[j + 2]) * g
      const nx = baseNor[j] + (fNor[j] - baseNor[j]) * g
      const ny = baseNor[j + 1] + (fNor[j + 1] - baseNor[j + 1]) * g
      const nz = baseNor[j + 2] + (fNor[j + 2] - baseNor[j + 2]) * g
      const l = Math.hypot(nx, ny, nz) || 1
      norArr[j] = nx / l; norArr[j + 1] = ny / l; norArr[j + 2] = nz / l
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
    geo.attributes.normal.needsUpdate = true
  }
  return { update }
}

export function Planet({
  journeyRef,
  children,
}: {
  journeyRef: JourneyRef
  children?: ReactNode
}) {
  const group = useRef<THREE.Group>(null)
  const ramp = useClayRamp()
  const { geometry, bake } = useHillGeometry()
  const water = useWaterGeometry()
  // The traveling front: each updater re-lerps only the thetaC buckets swept since
  // the last rotation (a full re-apply on the first frame / any big jump). The
  // spine buckets never change, so the girl's lane costs nothing.
  const planetMorph = useMemo(
    () =>
      makeRenewalMorph({
        geo: geometry, thetaC: bake.thetaC, buckets: bake.buckets,
        colorsA: bake.colorsA, colorsB: bake.colorsB,
        positionsA: bake.positionsA, positionsB: bake.positionsB,
        normalsA: bake.normalsA, normalsB: bake.normalsB,
      }),
    [geometry, bake]
  )
  const waterMorph = useMemo(
    () =>
      makeRenewalMorph({
        geo: water.geometry, thetaC: water.thetaC, buckets: water.buckets,
        colorsA: water.colorsA, colorsB: water.colorsB,
      }),
    [water]
  )
  // Round 7 overflow tide — the right-cap bucket, re-evaluated per frame AFTER the
  // renewal front so it owns the final grazing-limb value.
  const tideMorph = useMemo(() => makeTideMorph({ geo: geometry, bake }), [geometry, bake])

  useFrame(() => {
    const j = journeyRef.current
    if (group.current) group.current.rotation.x = -j.rotation
    planetMorph.update(j.rotation)
    waterMorph.update(j.rotation)
    tideMorph.update(j.rotation)
  })

  return (
    <group ref={group}>
      <mesh geometry={water.geometry}>
        <meshToonMaterial vertexColors gradientMap={ramp} />
      </mesh>
      <mesh geometry={geometry}>
        <meshToonMaterial vertexColors gradientMap={ramp} />
      </mesh>
      {children}
    </group>
  )
}
