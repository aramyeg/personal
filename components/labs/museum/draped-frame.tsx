'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { drapedPlacement } from './layout'
import { makePlacardTexture } from './textures'

const GOLD = '#b08d3f'
const W = 2.1
const H = 2.7

/** Cloth-covered frame on the far wall — the museum's own tease. */
export function DrapedFrame({ labCount }: { labCount: number }) {
  const placement = drapedPlacement(labCount)

  // Cloth: a plane with gentle sine folds, computed once
  const cloth = useMemo(() => {
    const geo = new THREE.PlaneGeometry(W + 0.5, H + 0.6, 24, 32)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const sag = Math.sin((x / (W + 0.5)) * Math.PI * 5) * 0.05
      const belly = Math.cos((y / (H + 0.6)) * Math.PI) * 0.06
      pos.setZ(i, 0.12 + sag + belly)
    }
    geo.computeVertexNormals()
    return geo
  }, [])

  const placard = useMemo(() => makePlacardTexture('Opening soon', '', 'The next experiment is being hung.'), [])

  return (
    <group position={placement.position} rotation-y={placement.rotationY}>
      {/* Frame edges peeking out behind the cloth */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[W + 0.7, H + 0.8, 0.08]} />
        <meshStandardMaterial color={GOLD} metalness={0.75} roughness={0.3} />
      </mesh>
      {/* The cloth */}
      <mesh geometry={cloth} position={[0, 0.05, 0.02]}>
        <meshStandardMaterial color="#6d1f2c" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {/* Placard */}
      <mesh position={[0, -(H / 2 + 0.35), 0.28]}>
        <planeGeometry args={[0.9, 0.45]} />
        <meshStandardMaterial map={placard} roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Dedicated warm light bathing the drape (pointLight — spotLight
          targets must live in the scene graph, not worth the ceremony here) */}
      <pointLight position={[0, H / 2 + 1, 1.6]} intensity={18} distance={7} decay={2} color="#ffe7c4" />
    </group>
  )
}
