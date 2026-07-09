'use client'

/**
 * 120 candlelit motes drifting above the desk. Positions are seeded once
 * per mount into a Float32Array shared directly with the GPU buffer; each
 * frame mutates that same array in place and flags the attribute dirty —
 * the standard three.js/r3f pattern for a per-frame particle update, since
 * allocating a fresh 360-float array every frame would be wasted GC churn
 * for a purely cosmetic effect.
 */

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

const DUST_COUNT = 120
const BOUNDS_X: [number, number] = [-1.5, 1.5]
const BOUNDS_Y: [number, number] = [0.2, 2.2]
const BOUNDS_Z: [number, number] = [-1, 1.5]
const DRIFT_SPEED = 0.02
const DUST_COLOR = '#ffdba8'
const DUST_SIZE = 0.012
const DUST_OPACITY = 0.32

const randomInRange = (min: number, max: number): number => min + Math.random() * (max - min)

function seedDustPositions(): Float32Array {
  const positions = new Float32Array(DUST_COUNT * 3)
  for (let i = 0; i < DUST_COUNT; i++) {
    positions[i * 3] = randomInRange(BOUNDS_X[0], BOUNDS_X[1])
    positions[i * 3 + 1] = randomInRange(BOUNDS_Y[0], BOUNDS_Y[1])
    positions[i * 3 + 2] = randomInRange(BOUNDS_Z[0], BOUNDS_Z[1])
  }
  return positions
}

/** Slow-drifting dust motes that wrap back to the bottom of their box on exit. */
export function Dust() {
  const pointsRef = useRef<THREE.Points>(null)
  const positions = useMemo(() => seedDustPositions(), [])

  useFrame((_, delta) => {
    const points = pointsRef.current
    if (!points) return
    const attribute = points.geometry.attributes.position as THREE.BufferAttribute
    const array = attribute.array as Float32Array
    for (let i = 0; i < DUST_COUNT; i++) {
      const yIndex = i * 3 + 1
      const next = array[yIndex] + DRIFT_SPEED * delta
      array[yIndex] = next > BOUNDS_Y[1] ? BOUNDS_Y[0] : next
    }
    attribute.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={DUST_SIZE}
        color={DUST_COLOR}
        transparent
        opacity={DUST_OPACITY}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}
