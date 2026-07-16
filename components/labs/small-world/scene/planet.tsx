'use client'
import { useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../palette'
import type { JourneyRef } from './use-journey'
import { useClayRamp } from './toon-ramp'

export const PLANET_RADIUS = 2.2

/**
 * Water glaze radius as a fraction of PLANET_RADIUS. The terrain's carved
 * flank basins dip below this; everything else stays above it, so the shared
 * water sphere only shows through in the lakes. Chosen well below the spine
 * band's base-only trough floor (~0.949R) so blue never leaks under the girl,
 * and the flank mask keeps every lake out past |nx| ≈ 0.65.
 */
export const WATER_LEVEL = 0.928

/** Clamped 0→1 smoothstep, used to mask the flank drama in and out. */
function smoothstep01(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x * x * (3 - 2 * x)
}

/**
 * Radial bump of the clay terrain, evaluated on the UNIT-radius direction
 * scaled to PLANET_RADIUS (the same pre-displacement position the geometry
 * pass feeds it). Kept as a pure function so the girl can sample the true
 * surface height under her feet each frame.
 *
 * The spine meridian (small |nx|, where the girl travels) keeps the gentle
 * two-octave meadow. Drama keys off |nx|: the flanks grow ridge mountains and
 * carved basins that sink below WATER_LEVEL into lakes, so the limbs read as a
 * handmade world while the girl's line stays calm.
 */
export function terrainBump(x: number, y: number, z: number): number {
  const len = Math.sqrt(x * x + y * y + z * z) || 1
  const nx = x / len
  const ny = y / len
  const nz = z / len

  // Two offset sin-product octaves — the second breaks the first's lattice
  // regularity so the hills read hand-pushed, not golf-ball dimpled.
  const a = Math.sin(3 * x + 1.7) * Math.sin(4 * y - 0.6) * Math.sin(3 * z + 2.2)
  const b = Math.sin(1.6 * x - 2.1 * y + 0.9) * Math.sin(2.3 * z + 1.3 * x - 0.4)
  const base = 0.038 * a + 0.028 * b

  // 0 on the spine and near-spine (keeps the girl's band + chapter props dry —
  // lakes never breach inside |nx| ≈ 0.57), ramping to 1 out on the limbs.
  const flank = smoothstep01((Math.abs(nx) - 0.4) / 0.4)

  // Carved basins first — a smooth blob field thresholded into lake bowls.
  const blob =
    0.5 + 0.5 * Math.sin(1.3 * ny + 2.2 * nz - 0.6) * Math.sin(1.9 * nz + 1.1 * ny + 1.8)
  const basin = smoothstep01((blob - 0.35) / 0.6)

  // Ridge mountains — muted where a basin sits so lake bowls stay clean.
  const ridge =
    Math.abs(Math.sin(2.2 * ny + 3.1 * nz + 0.9)) * Math.abs(Math.sin(1.6 * nz - 2.4 * ny + 2.0))
  const mountains = 0.14 * flank * ridge * (1 - 0.85 * basin)

  // Flanks own the drama; the meadow base is damped a touch under it.
  return base * (1 - 0.3 * flank) + mountains - 0.3 * flank * basin
}

/**
 * World-space surface point directly under a stance at world z (x=0, upper
 * hemisphere), for a planet rotated by `rotation` about the x-axis (the
 * toward-camera travel direction: the girl faces the viewer and the surface
 * under her feet moves away over the back while new terrain rises over the
 * front horizon). Returns the y of the displaced surface at that z.
 */
export function surfaceYAt(worldZ: number, rotation: number): number {
  const baseY = Math.sqrt(PLANET_RADIUS * PLANET_RADIUS - worldZ * worldZ)
  // World stance direction rotated INTO planet-local space (the mesh spins
  // by -rotation about x, so local = R_x(rotation) · world).
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const ly = baseY * cos - worldZ * sin
  const lz = baseY * sin + worldZ * cos
  const bump = terrainBump(0, ly, lz)
  const r = PLANET_RADIUS * (1 + bump)
  return Math.sqrt(Math.max(0, r * r - worldZ * worldZ))
}

/**
 * Chunky vertex-displaced sphere with height-tinted vertex colors: valleys
 * sink toward deep leaf green, crests lift toward pale sprout, terracotta
 * clay breaks through the mountain tops, underwater floors glaze river-blue,
 * and a slow longitude wobble warms whole regions — the hand-tinted clay
 * read, no textures.
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
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const ny = v.y / PLANET_RADIUS
      const nz = v.z / PLANET_RADIUS
      const bump = terrainBump(v.x, v.y, v.z)
      v.multiplyScalar(1 + bump)
      pos.setXYZ(i, v.x, v.y, v.z)
      // base height tint: bump in [-0.066, 0.066] → t in [0, 1]
      const t = THREE.MathUtils.clamp(bump / 0.066 / 2 + 0.5, 0, 1)
      if (t < 0.5) c.lerpColors(leaf, meadow, t * 2)
      else c.lerpColors(meadow, sprout, (t - 0.5) * 2)
      // terracotta clay breaking through the mountain crests
      const peak = THREE.MathUtils.clamp((bump - 0.075) / 0.04, 0, 1)
      if (peak > 0) c.lerp(clay, 0.5 * peak)
      // underwater floors glaze toward deep river so shorelines read clay-lake
      const submerge = THREE.MathUtils.clamp((WATER_LEVEL - (1 + bump)) / 0.03, 0, 1)
      if (submerge > 0) c.lerp(deep, 0.6 * submerge)
      // low-frequency longitude wobble — subtle warm regions, never stripes
      const t2 = 0.5 + 0.5 * Math.sin(1.2 * Math.atan2(nz, ny) + 0.7)
      c.lerp(honey, 0.08 * t2)
      colors.set([c.r, c.g, c.b], i * 3)
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    return geo
  }, [])
}

/**
 * The clay-glaze water sphere sitting just under the terrain at WATER_LEVEL.
 * Only its lake patches are visible (terrain occludes the rest); vertex colors
 * deepen from river toward riverDeep where the basin floor sinks farthest
 * below, giving each lake a two-tone depth band without any shader work.
 */
function useWaterGeometry(): THREE.SphereGeometry {
  return useMemo(() => {
    const geo = new THREE.SphereGeometry(PLANET_RADIUS * WATER_LEVEL, 48, 48)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const v = new THREE.Vector3()
    const river = new THREE.Color(PALETTE.river)
    const deep = new THREE.Color(PALETTE.riverDeep)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const dir = v.clone().normalize()
      const bump = terrainBump(dir.x * PLANET_RADIUS, dir.y * PLANET_RADIUS, dir.z * PLANET_RADIUS)
      // how far the basin floor sits below the waterline (world-radius units)
      const depth = THREE.MathUtils.clamp((WATER_LEVEL - (1 + bump)) / 0.03, 0, 1)
      c.lerpColors(river, deep, depth)
      colors.set([c.r, c.g, c.b], i * 3)
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
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
    // -rotation about x: the top surface moves away from the camera, so the
    // viewer-facing girl advances toward the viewer; incoming terrain rises
    // over the front horizon where the camera can see it coming.
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
