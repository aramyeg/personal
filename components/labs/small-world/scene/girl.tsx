'use client'
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { PALETTE } from '../palette'
import { PLANET_RADIUS } from './planet'
import { STANCE_Z, walkYAt } from './stage'
import type { JourneyRef } from './use-journey'

const GIRL_URL = '/labs/small-world/girl.glb'
/** Only clip in the delivered GLB — no idle/discovery/wave clips shipped. */
const CLIP_NAME = 'Armature|Skip_Forward|baselayer'
/** Mesh is 1.7 units tall. 0.53 matched the old ~0.9u proxy; raised per
 * Aram's Gate-2 note — she should command the planet, not decorate it. */
const GIRL_SCALE = 0.7
/** Surface distance one skip-cycle covers at timeScale 1 — tune to the clip. */
const CLIP_STRIDE = 1.0
/** Damping rate for mixer.timeScale so cadence eases rather than snaps to speed changes. */
const DAMP_LAMBDA = 6
/** Floor for the timeScale damp target — keeps a slow skip-in-place during dwell/panel windows instead of freezing mid-pose. */
const MIN_TIMESCALE = 0.12

/**
 * Real GLB girl — rendered only behind `hasArt('girl')` (see scene.tsx), so
 * this module's useGLTF call never fires while the asset is absent. Ground
 * contact ONLY: the clip carries the hop, this just follows surfaceYAt at
 * STANCE_Z (same fixed-character contract as GirlProxy — group never moves
 * in x/z, only the planet spins beneath it).
 */
export function Girl({ journeyRef }: { journeyRef: JourneyRef }) {
  const group = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const { scene, animations } = useGLTF(GIRL_URL)
  const { actions, mixer } = useAnimations(animations, group)
  const lastRotation = useRef<number | null>(null)
  const timeScale = useRef(MIN_TIMESCALE)

  useEffect(() => {
    actions[CLIP_NAME]?.reset().play()
  }, [actions])

  useFrame((_, delta) => {
    const { rotation } = journeyRef.current
    const dt = Math.max(delta, 1e-6)
    const prev = lastRotation.current ?? rotation
    lastRotation.current = rotation
    const surfaceSpeed = (Math.abs(rotation - prev) * PLANET_RADIUS) / dt
    const targetScale = THREE.MathUtils.clamp(surfaceSpeed / CLIP_STRIDE, MIN_TIMESCALE, 2.5)
    timeScale.current = THREE.MathUtils.damp(timeScale.current, targetScale, DAMP_LAMBDA, dt)
    mixer.timeScale = timeScale.current
    const groundY = walkYAt(STANCE_Z, rotation)
    if (group.current) {
      group.current.position.y = groundY
    }
    if (shadow.current) {
      shadow.current.position.y = groundY + 0.015
    }
  })

  return (
    <>
      <group ref={group} position={[0, PLANET_RADIUS, STANCE_Z]}>
        <primitive object={scene} scale={GIRL_SCALE} />
      </group>
      <mesh ref={shadow} position={[0, PLANET_RADIUS, STANCE_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.3, 24]} />
        <meshBasicMaterial color={PALETTE.ink} transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </>
  )
}
