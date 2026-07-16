'use client'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../palette'
import { easeOutBack } from '../journey-timeline'
import { surfaceYAt } from './planet'
import { STANCE_Z } from './stage'
import { useClayRamp } from './toon-ramp'
import type { JourneyRef } from './use-journey'

/**
 * The "!" that pops over her head at each discovery stop: easeOutBack pop-in,
 * wobble, fade-out by scale in the last quarter of the burst window.
 */
export function DiscoveryBurst({ journeyRef }: { journeyRef: JourneyRef }) {
  const group = useRef<THREE.Group>(null)
  const ramp = useClayRamp()

  useFrame(() => {
    const g = group.current
    if (!g) return
    const { burst, rotation } = journeyRef.current
    g.visible = burst !== null
    if (burst === null) return
    const pop = easeOutBack(Math.min(1, burst / 0.35))
    const fade = 1 - THREE.MathUtils.smoothstep(burst, 0.75, 1)
    g.scale.setScalar(Math.max(0.4 * pop * fade, 0.0001))
    g.position.y = surfaceYAt(STANCE_Z, rotation) + 1.32 + 0.08 * burst
    g.rotation.z = 0.18 * Math.sin(burst * Math.PI * 4)
  })

  return (
    <group ref={group} position={[0, 0, STANCE_Z]} visible={false}>
      <mesh position={[0, 0.12, -0.02]}>
        <circleGeometry args={[0.28, 24]} />
        <meshToonMaterial color={PALETTE.honey} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <capsuleGeometry args={[0.055, 0.2, 6, 12]} />
        <meshToonMaterial color={PALETTE.blossomDeep} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, -0.06, 0]}>
        <sphereGeometry args={[0.06, 14, 14]} />
        <meshToonMaterial color={PALETTE.blossomDeep} gradientMap={ramp} />
      </mesh>
    </group>
  )
}
