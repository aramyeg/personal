'use client'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../palette'
import type { JourneyRef } from './use-journey'

export const PLANET_RADIUS = 2.2

/**
 * Radial bump of the rolling-hill terrain, evaluated on the UNIT-radius
 * direction scaled to PLANET_RADIUS (the same pre-displacement position the
 * geometry pass feeds it). Kept as a pure function so the girl can sample
 * the true surface height under her feet each frame.
 */
export function terrainBump(x: number, y: number, z: number): number {
  // Two offset sin-product octaves — the second breaks the first's lattice
  // regularity so the hills read hand-pushed, not golf-ball dimpled.
  const a = Math.sin(3 * x + 1.7) * Math.sin(4 * y - 0.6) * Math.sin(3 * z + 2.2)
  const b = Math.sin(1.6 * x - 2.1 * y + 0.9) * Math.sin(2.3 * z + 1.3 * x - 0.4)
  return 0.038 * a + 0.028 * b
}

/**
 * World-space surface point directly under a stance at world x (z=0, upper
 * hemisphere), for a planet rotated by `rotation` about z. Returns the y of
 * the displaced surface at that x.
 */
export function surfaceYAt(worldX: number, rotation: number): number {
  const baseY = Math.sqrt(PLANET_RADIUS * PLANET_RADIUS - worldX * worldX)
  // World stance direction rotated INTO planet-local space (planet spins by
  // -rotation, so local = R_z(-(-rotation)) · world = R_z(rotation) · world).
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const lx = worldX * cos - baseY * sin
  const ly = worldX * sin + baseY * cos
  const bump = terrainBump(lx, ly, 0)
  const r = PLANET_RADIUS * (1 + bump)
  return Math.sqrt(Math.max(0, r * r - worldX * worldX))
}

/** 3-step toon ramp — hard clay banding. */
function useToonRamp(): THREE.DataTexture {
  return useMemo(() => {
    const steps = new Uint8Array([140, 200, 255])
    const data = new Uint8Array(steps.length * 4)
    steps.forEach((v, i) => data.set([v, v, v, 255], i * 4))
    const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat)
    tex.needsUpdate = true
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    return tex
  }, [])
}

/**
 * Chunky vertex-displaced sphere with height-tinted vertex colors: valleys
 * sink toward deep leaf green, crests lift toward pale sprout — the
 * hand-tinted clay read, no textures.
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
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const bump = terrainBump(v.x, v.y, v.z)
      v.multiplyScalar(1 + bump)
      pos.setXYZ(i, v.x, v.y, v.z)
      // bump in [-0.066, 0.066] → t in [0, 1]
      const t = THREE.MathUtils.clamp(bump / 0.066 / 2 + 0.5, 0, 1)
      if (t < 0.5) c.lerpColors(leaf, meadow, t * 2)
      else c.lerpColors(meadow, sprout, (t - 0.5) * 2)
      colors.set([c.r, c.g, c.b], i * 3)
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    return geo
  }, [])
}

export function Planet({ journeyRef }: { journeyRef: JourneyRef }) {
  const group = useRef<THREE.Group>(null)
  const ramp = useToonRamp()
  const geometry = useHillGeometry()

  useFrame(() => {
    if (group.current) group.current.rotation.z = -journeyRef.current.rotation
  })

  return (
    <group ref={group}>
      <mesh geometry={geometry}>
        <meshToonMaterial vertexColors gradientMap={ramp} />
      </mesh>
    </group>
  )
}
