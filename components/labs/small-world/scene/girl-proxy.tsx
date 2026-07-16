'use client'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../palette'
import { PLANET_RADIUS, SURFACE_Y } from './planet'
import type { JourneyRef } from './use-journey'

/** Surface distance covered by one skip — ties hop cadence to rotation. */
const STRIDE = 0.55
const HOP_HEIGHT = 0.16
/** Lifts the capsule's own pivot so its feet rest on the surface point, not its center. */
const FOOT_OFFSET = 0.28

/**
 * Capsule stand-in for the girl. Its ONLY job: prove that hop cadence
 * locks to surface speed (no moonwalking) before the real GLB lands.
 * Contract for the real Girl (Task 7): same group transform, hop offset
 * ADDED to the surface y — never replacing it. The group itself never
 * moves in x/z; only the planet spins beneath it (fixed-character pattern).
 */
export function GirlProxy({ journeyRef }: { journeyRef: JourneyRef }) {
  const group = useRef<THREE.Group>(null)

  useFrame(() => {
    const { rotation } = journeyRef.current
    const surfaceDistance = rotation * PLANET_RADIUS
    const hopPhase = (surfaceDistance / STRIDE) * Math.PI
    const hop = Math.abs(Math.sin(hopPhase)) * HOP_HEIGHT
    const squash = 1 - 0.12 * Math.cos(hopPhase * 2) // squash at contact, stretch mid-air
    if (group.current) {
      group.current.position.y = SURFACE_Y + FOOT_OFFSET + hop
      group.current.scale.set(1 / squash, squash, 1 / squash)
    }
  })

  return (
    <group ref={group} position={[-0.6, SURFACE_Y + FOOT_OFFSET, 0]}>
      <mesh>
        <capsuleGeometry args={[0.14, 0.28, 8, 16]} />
        <meshToonMaterial color={PALETTE.blossomDeep} />
      </mesh>
      <mesh position={[0, 0.34, 0]}>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshToonMaterial color={PALETTE.blossom} />
      </mesh>
    </group>
  )
}
