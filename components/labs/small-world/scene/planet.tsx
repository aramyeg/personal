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
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const nx = v.x / PLANET_RADIUS
      const ny = v.y / PLANET_RADIUS
      const nz = v.z / PLANET_RADIUS
      const bump = terrainBump(v.x, v.y, v.z)
      v.multiplyScalar(1 + bump)
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
          // earth rock on the range's mid flanks, snow left on the crests
          const rock =
            THREE.MathUtils.smoothstep(bump, 0.02, 0.06) *
            (1 - THREE.MathUtils.smoothstep(bump, 0.1, 0.14))
          if (rock > 0) c.lerp(earth, 0.6 * rock * kt)
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
        }
      }
      colors.set([c.r, c.g, c.b], i * 3)
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    return geo
  }, [])
}

/**
 * The clay-glaze water sphere at WATER_LEVEL. Ocean basin, river channels and
 * the canyon floor dip below it, so it shows through as sea, veins and pools;
 * vertex colors deepen river → riverDeep where the floor sinks farthest.
 */
function useWaterGeometry(): THREE.SphereGeometry {
  return useMemo(() => {
    const geo = new THREE.SphereGeometry(PLANET_RADIUS * WATER_LEVEL, 96, 96)
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
      const depth = THREE.MathUtils.clamp((WATER_LEVEL - (1 + bump)) / 0.06, 0, 1)
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
