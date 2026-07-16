'use client'
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { PLANET_RADIUS, surfaceYAt } from './planet'
import { STANCE_X } from './girl-proxy'
import type { JourneyRef } from './use-journey'

const GIRL_URL = '/labs/small-world/girl.glb'
/** Surface distance one skip-cycle covers at timeScale 1 — tune to the clip. */
const CLIP_STRIDE = 0.55
/** Damping rate for mixer.timeScale so cadence eases rather than snaps to speed changes. */
const DAMP_LAMBDA = 6

/**
 * Real GLB girl — rendered only behind `hasArt('girl')` (see scene.tsx), so
 * this module's useGLTF call never fires while the asset is absent. Ground
 * contact ONLY: the clip carries the hop, this just follows surfaceYAt at
 * STANCE_X (same fixed-character contract as GirlProxy — group never moves
 * in x/z, only the planet spins beneath it).
 */
export function Girl({ journeyRef }: { journeyRef: JourneyRef }) {
  const group = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF(GIRL_URL)
  const { actions, mixer } = useAnimations(animations, group)
  const lastRotation = useRef<number | null>(null)
  const timeScale = useRef(0)

  useEffect(() => {
    actions.skip?.reset().play()
  }, [actions])

  useFrame((_, delta) => {
    const { rotation } = journeyRef.current
    const dt = Math.max(delta, 1e-6)
    const prev = lastRotation.current ?? rotation
    lastRotation.current = rotation
    const surfaceSpeed = (Math.abs(rotation - prev) * PLANET_RADIUS) / dt
    const targetScale = THREE.MathUtils.clamp(surfaceSpeed / CLIP_STRIDE, 0, 2.5)
    timeScale.current = THREE.MathUtils.damp(timeScale.current, targetScale, DAMP_LAMBDA, dt)
    mixer.timeScale = timeScale.current
    if (group.current) {
      group.current.position.y = surfaceYAt(STANCE_X, rotation)
    }
  })

  return (
    <group ref={group} position={[STANCE_X, PLANET_RADIUS, 0]}>
      <primitive object={scene} />
    </group>
  )
}
