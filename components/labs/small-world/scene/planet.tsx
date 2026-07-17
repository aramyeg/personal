'use client'
import { useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../palette'
import type { JourneyRef } from './use-journey'
import { useClayRamp } from './toon-ramp'
import { WATER_LEVEL, biomeBump, biomeTint } from './biomes'

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
 * Finite-difference gradient magnitude of terrainBump along the surface at a
 * unit direction — how steeply the clay is pinched here. Used to darken creases
 * (hand-pushed clay shows dirt in its folds). Pure; two centered samples per
 * tangent, four terrainBump calls (build-time only).
 */
export function terrainSlope(nx: number, ny: number, nz: number): number {
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
    terrainBump((nx + ox) * R, (ny + oy) * R, (nz + oz) * R)
  const dA = (s(eps * t1x, eps * t1y, eps * t1z) - s(-eps * t1x, -eps * t1y, -eps * t1z)) / (2 * eps)
  const dB = (s(eps * t2x, eps * t2y, eps * t2z) - s(-eps * t2x, -eps * t2y, -eps * t2z)) / (2 * eps)
  return Math.hypot(dA, dB)
}

/**
 * World-space surface point directly under a stance at world z (x=0, upper
 * hemisphere), for a planet rotated by `rotation` about x. Returns the y of the
 * displaced terrain surface at that z. PURE TERRAIN — prop anchors and the
 * pinned tests depend on this; the girl's on-bridge height lives in walkYAt.
 */
export function surfaceYAt(worldZ: number, rotation: number): number {
  const baseY = Math.sqrt(PLANET_RADIUS * PLANET_RADIUS - worldZ * worldZ)
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const ly = baseY * cos - worldZ * sin
  const lz = baseY * sin + worldZ * cos
  const bump = terrainBump(0, ly, lz)
  const r = PLANET_RADIUS * (1 + bump)
  return Math.sqrt(Math.max(0, r * r - worldZ * worldZ))
}

/**
 * Chunky vertex-displaced sphere, vertex-colored straight from the biome map:
 * snow at the cold pole, rich-brown canyon clay, pine forest floor, sand
 * shorelines edging every water body, deep glaze underwater, and the gentle
 * leaf→meadow→sprout height read on the open meadow — no textures.
 */
function useHillGeometry(): THREE.IcosahedronGeometry {
  return useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(PLANET_RADIUS, 24)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const v = new THREE.Vector3()
    const leaf = new THREE.Color(PALETTE.leaf)
    const meadow = new THREE.Color(PALETTE.meadow)
    const sprout = new THREE.Color(PALETTE.sprout)
    const clay = new THREE.Color(PALETTE.clayPath)
    const deep = new THREE.Color(PALETTE.riverDeep)
    const honey = new THREE.Color(PALETTE.honey)
    const snow = new THREE.Color(PALETTE.snow)
    const earth = new THREE.Color(PALETTE.earth)
    const pine = new THREE.Color(PALETTE.pine)
    const dune = new THREE.Color(PALETTE.dune)
    const blossom = new THREE.Color(PALETTE.blossom)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const nx = v.x / PLANET_RADIUS
      const ny = v.y / PLANET_RADIUS
      const nz = v.z / PLANET_RADIUS
      const bump = terrainBump(v.x, v.y, v.z)
      // Clay thumb-dents: a small two-octave surface irregularity applied to the
      // RENDER geometry only (never to terrainBump, so dryness/props/tests are
      // untouched). It tilts the flat facet normals so the hard ramp breaks into
      // pressed-clay patches instead of a smooth soft gradient. Amplitude is tiny
      // enough that the spine stays above the waterline (verified in bench scan).
      const dimple =
        0.005 * Math.sin(15.3 * nx + 1.1) * Math.sin(14.7 * ny - 0.4) * Math.sin(15.1 * nz + 2.3) +
        0.003 * Math.sin(26.1 * ny + 0.7) * Math.sin(25.4 * nz - 1.3) * Math.sin(26.9 * nx + 0.5)
      v.multiplyScalar(1 + bump + dimple)
      pos.setXYZ(i, v.x, v.y, v.z)

      // open-meadow height read is the fallback everywhere
      const t = THREE.MathUtils.clamp(bump / 0.05 / 2 + 0.5, 0, 1)
      if (t < 0.5) c.lerpColors(leaf, meadow, t * 2)
      else c.lerpColors(meadow, sprout, (t - 0.5) * 2)

      const { kind, t: kt } = biomeTint(nx, ny, nz, bump)
      switch (kind) {
        case 'underwater':
          c.lerp(deep, 0.55 + 0.35 * kt)
          break
        case 'beach':
          c.lerp(dune, 0.85 * kt)
          break
        case 'canyon': {
          c.copy(earth)
          // darken the channel floor, keep the banks a touch lighter
          c.lerp(deep.clone().lerp(earth, 0.7), 0.25 * kt)
          break
        }
        case 'snow': {
          c.lerp(snow, kt)
          // snowline pulled DOWN: earth rock shows only on the steep upper
          // spires, so the enlarged cap + range read as ONE white cold region.
          const rock =
            THREE.MathUtils.smoothstep(bump, 0.09, 0.14) *
            (1 - THREE.MathUtils.smoothstep(bump, 0.2, 0.26))
          if (rock > 0) c.lerp(earth, 0.5 * rock * kt)
          break
        }
        case 'forest':
          c.lerp(pine, 0.4 * kt)
          break
        default: {
          // terracotta breaking through the odd high meadow crest
          const peak = THREE.MathUtils.clamp((bump - 0.07) / 0.04, 0, 1)
          if (peak > 0) c.lerp(clay, 0.4 * peak)
          // subtle warm longitude drift, never stripes
          const t2 = 0.5 + 0.5 * Math.sin(1.2 * Math.atan2(nz, ny) + 0.7)
          c.lerp(honey, 0.06 * t2)
          // wildflower speckle — deterministic pink/gold dots break the uniform
          // green so no meadow face reads as flat green (dense, high-frequency)
          const spk = Math.sin(41.3 * nx + 2.1) * Math.sin(37.7 * ny - 1.3) * Math.sin(43.1 * nz + 0.6)
          if (spk > 0.68) c.lerp(blossom, 0.55)
          else if (spk < -0.72) c.lerp(honey, 0.5)
          const spk2 = Math.sin(29.1 * ny + 4.2) * Math.sin(31.7 * nz - 0.8) * Math.sin(27.3 * nx + 1.9)
          if (spk2 > 0.74) c.lerp(sprout, 0.5)
        }
      }
      // Crease darkening: hand-pushed clay carries dirt in its steep folds. The
      // per-face flat normals already band under the ramp; this deepens the
      // color where the terrain is pinched (biome flanks, channel + canyon
      // banks) so the facets read as pressed clay, not shaded haze.
      const crease = THREE.MathUtils.smoothstep(terrainSlope(nx, ny, nz), 0.12, 0.6)
      if (crease > 0) c.multiplyScalar(1 - 0.14 * crease)
      colors.set([c.r, c.g, c.b], i * 3)
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    // IcosahedronGeometry is already non-indexed, so per-face normals here give
    // flat facets straight away — the ramp turns them into pinched clay planes.
    geo.computeVertexNormals()
    return geo
  }, [])
}

/**
 * The clay water sphere at WATER_LEVEL. Every basin, river channel and canyon
 * floor dips below it, so it shows through as sea, veins and pools. Deep river
 * blue DOMINATES the surface (darkening toward an ink-blue abyss in the deeps);
 * the lighter river blue survives only as a shallow rim near shores. The sphere
 * carries its own gentle inward-only clay displacement so it reads as
 * hand-pushed clay under the toon ramp, never flat glass — and never pokes
 * above the shoreline.
 */
function useWaterGeometry(): THREE.BufferGeometry {
  return useMemo(() => {
    // Fewer segments = larger facets; the SphereGeometry is indexed, so
    // toNonIndexed + flat normals below turns it into visible lumpy clay water.
    const geo = new THREE.SphereGeometry(PLANET_RADIUS * WATER_LEVEL, 48, 48)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const v = new THREE.Vector3()
    const ink = new THREE.Color(PALETTE.ink)
    const river = new THREE.Color(PALETTE.river)
    // deep clay blue DOMINATES: riverDeep pushed darker for the body of the water
    const deepBase = new THREE.Color(PALETTE.riverDeep).lerp(ink, 0.22)
    const abyss = new THREE.Color(PALETTE.riverDeep).lerp(ink, 0.5)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const dir = v.clone().normalize()
      const bump = terrainBump(dir.x * PLANET_RADIUS, dir.y * PLANET_RADIUS, dir.z * PLANET_RADIUS)
      const depth = THREE.MathUtils.clamp((WATER_LEVEL - (1 + bump)) / 0.08, 0, 1)
      // deep-blue dominant, darkening into the abyss where the floor sinks far
      c.copy(deepBase).lerp(abyss, THREE.MathUtils.smoothstep(depth, 0.3, 1))
      // lighter river blue only as a NARROW shallow rim right at the shoreline
      const rim = 1 - THREE.MathUtils.smoothstep(depth, 0.0, 0.15)
      c.lerp(river, 0.5 * rim)
      colors.set([c.r, c.g, c.b], i * 3)
      // clay lumps, inward-only (radius never exceeds WATER_LEVEL → no shoreline
      // poke-through); two octaves + recomputed normals catch the ramp as clay.
      const w1 = Math.sin(5.1 * dir.x + 1.3) * Math.sin(4.7 * dir.y - 0.7) * Math.sin(5.3 * dir.z + 2.1)
      const w2 = Math.sin(9.4 * dir.y + 0.5) * Math.sin(8.7 * dir.z - 1.1) * Math.sin(9.1 * dir.x + 2.6)
      v.multiplyScalar(1 - 0.009 * (0.5 + 0.5 * w1) - 0.004 * (0.5 + 0.5 * w2))
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    // Flat-shade: expand to non-indexed then per-face normals so the water shows
    // hand-pinched clay facets under the ramp, not a smooth glass blob. Colors
    // (set above) are expanded with the positions, so they stay facet-crisp too.
    const flat = geo.toNonIndexed()
    geo.dispose()
    flat.computeVertexNormals()
    return flat
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
  const geometry = useHillGeometry()
  const water = useWaterGeometry()

  useFrame(() => {
    if (group.current) group.current.rotation.x = -journeyRef.current.rotation
  })

  return (
    <group ref={group}>
      <mesh geometry={water}>
        <meshToonMaterial vertexColors gradientMap={ramp} />
      </mesh>
      <mesh geometry={geometry}>
        <meshToonMaterial vertexColors gradientMap={ramp} />
      </mesh>
      {children}
    </group>
  )
}
