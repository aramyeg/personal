'use client'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../palette'
import { PLANET_RADIUS, surfaceYAt } from './planet'
import { STANCE_Z } from './stage'
import type { JourneyRef } from './use-journey'

/** Surface distance covered by one skip — ties hop cadence to rotation. */
const STRIDE = 0.55
const HOP_HEIGHT = 0.16

/**
 * Capsule stand-in for the girl. Its ONLY job: prove that hop cadence
 * locks to surface speed (no moonwalking) before the real GLB lands.
 * Contract for the real Girl (Task 7): same group transform — feet planted
 * on surfaceYAt(STANCE_Z, rotation), hop offset ADDED to that surface y,
 * never replacing it. The group never moves in x/z; only the planet spins
 * beneath it (fixed-character pattern).
 */
/** Surface speed (world units/s) considered "full skip" — scales hop amplitude. */
const FULL_SKIP_SPEED = 1.2

export function GirlProxy({ journeyRef }: { journeyRef: JourneyRef }) {
  const group = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const lastRotation = useRef<number | null>(null)
  const activity = useRef(0)

  useFrame(({ clock }, delta) => {
    const { rotation } = journeyRef.current
    const dt = Math.max(delta, 1e-6)
    const prev = lastRotation.current ?? rotation
    lastRotation.current = rotation
    const speed = (Math.abs(rotation - prev) * PLANET_RADIUS) / dt
    // Hop amplitude follows travel speed: full skips while the planet turns,
    // settling to the ground when it stops (a frozen mid-air pose during the
    // panel dwell reads broken). Same contract the GLB girl inherits via
    // mixer.timeScale + idle crossfade.
    activity.current = THREE.MathUtils.damp(
      activity.current,
      THREE.MathUtils.clamp(speed / FULL_SKIP_SPEED, 0, 1),
      6,
      dt
    )
    const surfaceDistance = rotation * PLANET_RADIUS
    const hopPhase = (surfaceDistance / STRIDE) * Math.PI
    const hop = Math.abs(Math.sin(hopPhase)) * HOP_HEIGHT * activity.current
    // Idle: a soft breathing bounce so she never goes statue-still.
    const idle = (1 - activity.current) * 0.012 * Math.sin(clock.elapsedTime * 2.4)
    const squashTravel = 1 - 0.12 * Math.cos(hopPhase * 2) // squash at contact, stretch mid-air
    const squash = 1 + (squashTravel - 1) * activity.current + idle
    const groundY = surfaceYAt(STANCE_Z, rotation)
    if (group.current) {
      group.current.position.y = groundY + hop
      group.current.scale.set(1 / squash, squash, 1 / squash)
    }
    if (shadow.current) {
      // Shadow hugs the ground and shrinks/fades as she leaves it.
      const lift = hop / HOP_HEIGHT
      shadow.current.position.y = groundY + 0.015
      const s = 1 - 0.35 * lift
      shadow.current.scale.set(s, s, s)
      const mat = shadow.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.22 * (1 - 0.55 * lift)
    }
  })

  return (
    <>
      {/* Feet-at-origin rig: meshes are lifted inside the group so the group's
          y IS the ground contact point. */}
      <group ref={group} position={[0, PLANET_RADIUS, STANCE_Z]}>
        <mesh position={[0, 0.42, 0]}>
          <capsuleGeometry args={[0.14, 0.28, 8, 16]} />
          <meshToonMaterial color={PALETTE.blossomDeep} />
        </mesh>
        <mesh position={[0, 0.76, 0]}>
          <sphereGeometry args={[0.16, 24, 24]} />
          <meshToonMaterial color={PALETTE.blossom} />
        </mesh>
      </group>
      <mesh ref={shadow} position={[0, PLANET_RADIUS, STANCE_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.24, 24]} />
        <meshBasicMaterial color={PALETTE.ink} transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </>
  )
}
