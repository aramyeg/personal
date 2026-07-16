'use client'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../palette'
import type { JourneyRef } from './use-journey'

export const PLANET_RADIUS = 2.2
/** World y of the planet's top. Task 7's Girl stands here plus her own foot offset. */
export const SURFACE_Y = PLANET_RADIUS

/** 4-step toon ramp — the clay read. */
function useToonRamp(): THREE.DataTexture {
  return useMemo(() => {
    const steps = new Uint8Array([120, 170, 220, 255])
    const data = new Uint8Array(steps.length * 4)
    steps.forEach((v, i) => data.set([v, v, v, 255], i * 4))
    const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat)
    tex.needsUpdate = true
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    return tex
  }, [])
}

/** Chunky vertex-displaced sphere: gentle rolling hills, no noisy detail. */
function useHillGeometry(): THREE.IcosahedronGeometry {
  return useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(PLANET_RADIUS, 24)
    const pos = geo.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const bump =
        0.05 * Math.sin(3 * v.x + 1.7) * Math.sin(4 * v.y - 0.6) * Math.sin(3 * v.z + 2.2)
      v.multiplyScalar(1 + bump)
      pos.setXYZ(i, v.x, v.y, v.z)
    }
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
        <meshToonMaterial color={PALETTE.meadow} gradientMap={ramp} />
      </mesh>
    </group>
  )
}
