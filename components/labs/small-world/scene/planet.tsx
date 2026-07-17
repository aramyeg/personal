'use client'
import { useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../palette'
import type { JourneyRef } from './use-journey'
import { useClayRamp } from './toon-ramp'
import { WATER_LEVEL, SNOW, SNOW_B, biomeBump, biomeBumpB, biomeTint } from './biomes'
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
  const gate = renewalGate(canonicalTheta(Math.atan2(z / len, y / len)), rotation)
  if (gate <= 0) return terrainBump(x, y, z)
  if (gate >= 1) return terrainBumpB(x, y, z)
  const a = terrainBump(x, y, z)
  return a + (terrainBumpB(x, y, z) - a) * gate
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

/** Clay thumb-dents: a small two-octave surface irregularity applied to the
 * RENDER geometry only (never to terrainBump, so dryness/props/tests are
 * untouched). It tilts the flat facet normals so the hard ramp breaks into
 * pressed-clay patches instead of a smooth soft gradient. A pure function of the
 * unit direction, so it is IDENTICAL on both laps and cancels out of the morph
 * on the spine (where the two bakes already coincide). */
function clayDimple(nx: number, ny: number, nz: number): number {
  return (
    0.005 * Math.sin(15.3 * nx + 1.1) * Math.sin(14.7 * ny - 0.4) * Math.sin(15.1 * nz + 2.3) +
    0.003 * Math.sin(26.1 * ny + 0.7) * Math.sin(25.4 * nz - 1.3) * Math.sin(26.9 * nx + 0.5)
  )
}

/**
 * Paints one vertex from the biome map into `c`. `isB` selects the lap-2
 * autumn-into-winter palette (meadow greens shift to honey/dune amber, forest
 * floor warms toward earth, canyon walls saturate, wildflower confetti re-tints,
 * snow reads across the wider SNOW_B cap). Water/beach are lap-invariant.
 */
function paintVertex(
  c: THREE.Color,
  pal: {
    leaf: THREE.Color; meadow: THREE.Color; sprout: THREE.Color; clay: THREE.Color
    deep: THREE.Color; honey: THREE.Color; snow: THREE.Color; earth: THREE.Color
    pine: THREE.Color; dune: THREE.Color; blossom: THREE.Color; blossomDeep: THREE.Color
    amber: THREE.Color
  },
  nx: number,
  ny: number,
  nz: number,
  bump: number,
  isB: boolean
): void {
  const snowCap = isB ? SNOW_B : SNOW
  // open-meadow height read is the fallback everywhere
  const t = THREE.MathUtils.clamp(bump / 0.05 / 2 + 0.5, 0, 1)
  if (t < 0.5) c.lerpColors(pal.leaf, pal.meadow, t * 2)
  else c.lerpColors(pal.meadow, pal.sprout, (t - 0.5) * 2)

  const { kind, t: kt } = biomeTint(nx, ny, nz, bump, snowCap)
  switch (kind) {
    case 'underwater':
      c.lerp(pal.deep, 0.55 + 0.35 * kt)
      break
    case 'beach':
      c.lerp(pal.dune, 0.85 * kt)
      break
    case 'canyon': {
      c.copy(pal.earth)
      // darken the channel floor, keep the banks a touch lighter
      c.lerp(pal.deep.clone().lerp(pal.earth, 0.7), 0.25 * kt)
      // lap 2: richer, more saturated earth walls
      if (isB) c.lerp(pal.earth, 0.35)
      break
    }
    case 'snow': {
      c.lerp(pal.snow, kt)
      // snowline pulled DOWN: earth rock shows only on the steep upper
      // spires, so the enlarged cap + range read as ONE white cold region.
      const rock =
        THREE.MathUtils.smoothstep(bump, 0.09, 0.14) *
        (1 - THREE.MathUtils.smoothstep(bump, 0.2, 0.26))
      if (rock > 0) c.lerp(pal.earth, 0.5 * rock * kt)
      break
    }
    case 'forest':
      c.lerp(pal.pine, 0.4 * kt)
      // lap 2: warm the pine floor toward earth (autumn leaf litter)
      if (isB) c.lerp(pal.earth, 0.2 * kt)
      break
    default: {
      // lap 2: the open meadow turns autumn — greens lerp toward honey/dune amber
      if (isB) c.lerp(pal.amber, 0.52)
      // terracotta breaking through the odd high meadow crest
      const peak = THREE.MathUtils.clamp((bump - 0.07) / 0.04, 0, 1)
      if (peak > 0) c.lerp(pal.clay, 0.4 * peak)
      // subtle warm longitude drift, never stripes (richer on lap 2)
      const t2 = 0.5 + 0.5 * Math.sin(1.2 * Math.atan2(nz, ny) + 0.7)
      c.lerp(pal.honey, (isB ? 0.12 : 0.06) * t2)
      // wildflower speckle — deterministic dots break the uniform ground; the
      // lap-2 confetti re-tints to amber/blossomDeep/dune (autumn seed heads).
      const spk = Math.sin(41.3 * nx + 2.1) * Math.sin(37.7 * ny - 1.3) * Math.sin(43.1 * nz + 0.6)
      if (spk > 0.68) c.lerp(isB ? pal.honey : pal.blossom, 0.55)
      else if (spk < -0.72) c.lerp(isB ? pal.blossomDeep : pal.honey, 0.5)
      const spk2 = Math.sin(29.1 * ny + 4.2) * Math.sin(31.7 * nz - 0.8) * Math.sin(27.3 * nx + 1.9)
      if (spk2 > 0.74) c.lerp(isB ? pal.dune : pal.sprout, 0.5)
    }
  }
  // Crease darkening: hand-pushed clay carries dirt in its steep folds. Uses the
  // matching lap's slope so the deeper lap-2 canyon / taller peaks crease right.
  const crease = THREE.MathUtils.smoothstep(
    terrainSlope(nx, ny, nz, isB ? terrainBumpB : terrainBump),
    0.12,
    0.6
  )
  if (crease > 0) c.multiplyScalar(1 - 0.14 * crease)
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
    const geo = new THREE.IcosahedronGeometry(PLANET_RADIUS, 24)
    const src = geo.attributes.position
    const count = src.count
    const positionsA = new Float32Array(count * 3)
    const positionsB = new Float32Array(count * 3)
    const colorsA = new Float32Array(count * 3)
    const colorsB = new Float32Array(count * 3)
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
      amber: new THREE.Color(PALETTE.honey).lerp(new THREE.Color(PALETTE.dune), 0.5),
    }
    const c = new THREE.Color()
    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(src, i)
      const nx = v.x / PLANET_RADIUS
      const ny = v.y / PLANET_RADIUS
      const nz = v.z / PLANET_RADIUS
      thetaC[i] = canonicalTheta(Math.atan2(nz, ny))
      const dimple = clayDimple(nx, ny, nz)
      const bumpA = terrainBump(v.x, v.y, v.z)
      const bumpB = terrainBumpB(v.x, v.y, v.z)
      const rA = 1 + bumpA + dimple
      const rB = 1 + bumpB + dimple
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
    }
    const normalsA = flatNormals(positionsA)
    const normalsB = flatNormals(positionsB)

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
    const paintDepth = (out: Float32Array, i: number, bump: number): void => {
      const depth = THREE.MathUtils.clamp((WATER_LEVEL - (1 + bump)) / 0.08, 0, 1)
      c.copy(deepBase).lerp(abyss, THREE.MathUtils.smoothstep(depth, 0.3, 1))
      const rim = 1 - THREE.MathUtils.smoothstep(depth, 0.0, 0.15)
      c.lerp(river, 0.5 * rim)
      out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b
    }
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const dir = v.clone().normalize()
      const px = dir.x * PLANET_RADIUS, py = dir.y * PLANET_RADIUS, pz = dir.z * PLANET_RADIUS
      paintDepth(colorsIdxA, i, terrainBump(px, py, pz))
      paintDepth(colorsIdxB, i, terrainBumpB(px, py, pz))
      // clay lumps, inward-only (radius never exceeds WATER_LEVEL → no shoreline
      // poke-through); two octaves + recomputed normals catch the ramp as clay.
      const w1 = Math.sin(5.1 * dir.x + 1.3) * Math.sin(4.7 * dir.y - 0.7) * Math.sin(5.3 * dir.z + 2.1)
      const w2 = Math.sin(9.4 * dir.y + 0.5) * Math.sin(8.7 * dir.z - 1.1) * Math.sin(9.1 * dir.x + 2.6)
      v.multiplyScalar(1 - 0.009 * (0.5 + 0.5 * w1) - 0.004 * (0.5 + 0.5 * w2))
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

  useFrame(() => {
    const j = journeyRef.current
    if (group.current) group.current.rotation.x = -j.rotation
    planetMorph.update(j.rotation)
    waterMorph.update(j.rotation)
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
