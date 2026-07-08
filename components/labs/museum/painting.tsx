'use client'

import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { makePlacardTexture } from './textures'
import type { PaintingPlacement } from './layout'

/**
 * Catches render errors from a single painting (e.g. a missing poster.jpg that
 * makes drei's useTexture throw) so one bad lab removes only its own frame
 * instead of taking down the whole gallery. Fails silently — the wall stays empty.
 */
export class PaintingBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

const GOLD = '#b08d3f'
// poster is 3:4 portrait
const ART_W = 1.8
const ART_H = 2.4
const FRAME_T = 0.16 // frame bar thickness
const FRAME_D = 0.09 // how far the frame sticks out of the wall

/** A hung lab: gilded frame, poster canvas, brass placard, picture light. */
export function Painting({
  placement,
  focused,
  register,
}: {
  placement: PaintingPlacement
  focused: boolean
  register: (slug: string, obj: THREE.Object3D | null) => void
}) {
  const group = useRef<THREE.Group>(null)
  const poster = useTexture(`/labs/${placement.slug}/poster.jpg`)
  poster.colorSpace = THREE.SRGBColorSpace

  const placard = useMemo(
    () => makePlacardTexture(placement.title, placement.date, placement.thesis),
    [placement.title, placement.date, placement.thesis]
  )

  useEffect(() => {
    register(placement.slug, group.current)
    return () => register(placement.slug, null)
  }, [placement.slug, register])

  const frameColor = focused ? '#d6b968' : GOLD

  return (
    <group ref={group} position={placement.position} rotation-y={placement.rotationY}>
      {/* Poster */}
      <mesh position={[0, 0, FRAME_D / 2]}>
        <planeGeometry args={[ART_W, ART_H]} />
        <meshStandardMaterial map={poster} roughness={0.7} />
      </mesh>

      {/* Frame: four gilded bars */}
      {(
        [
          [0, ART_H / 2 + FRAME_T / 2, ART_W + FRAME_T * 2, FRAME_T],
          [0, -(ART_H / 2 + FRAME_T / 2), ART_W + FRAME_T * 2, FRAME_T],
          [-(ART_W / 2 + FRAME_T / 2), 0, FRAME_T, ART_H],
          [ART_W / 2 + FRAME_T / 2, 0, FRAME_T, ART_H],
        ] as const
      ).map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, FRAME_D / 2]}>
          <boxGeometry args={[w, h, FRAME_D]} />
          <meshStandardMaterial color={frameColor} metalness={0.75} roughness={0.3} />
        </mesh>
      ))}

      {/* Brass placard below */}
      <mesh position={[0, -(ART_H / 2 + FRAME_T + 0.35), 0.03]}>
        <planeGeometry args={[0.9, 0.45]} />
        <meshStandardMaterial map={placard} roughness={0.4} metalness={0.3} />
      </mesh>

      {/* Picture light: warm glow onto the art */}
      <pointLight position={[0, ART_H / 2 + 0.6, 0.8]} intensity={6} distance={4} decay={2} color="#ffdfae" />
    </group>
  )
}
