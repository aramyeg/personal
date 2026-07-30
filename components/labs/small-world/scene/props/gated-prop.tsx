'use client'
import { useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { anchorTransform } from '../stage'
import { canonicalTheta, sceneVariantAt } from '../renewal'
import type { JourneyRef } from '../use-journey'

/**
 * A prop that swaps in/out with the renewal front. Plants children on the terrain
 * at (theta, x) — seated on its variant's terrain — and toggles its OWN visibility
 * by the gate at its OWN longitude: variant 0 (spring) is shown while the gate is
 * < 0.5, variant 1 (autumn) while ≥ 0.5, and variant 2 (Task 60's epilogue snow
 * field) once the epilogue gate crosses one turn later. A coincident set is therefore
 * always exactly one-visible. The swap is instant (no grow/sink) because it always
 * happens behind the horizon — proven by renewal-scan.mjs — so it never pops on
 * camera. Per-ITEM gating (never whole-group) so a longitude-spanning set flips
 * one item at a time, each as it passes the hidden back.
 */
export function GatedProp({
  theta,
  x = 0,
  variant,
  journeyRef,
  children,
}: {
  theta: number
  x?: number
  variant: 0 | 1 | 2
  journeyRef: JourneyRef
  children: ReactNode
}) {
  const ref = useRef<THREE.Group>(null)
  const tc = useMemo(() => canonicalTheta(theta), [theta])
  const { position, quaternion } = useMemo(
    // The epilogue rides variant B's relief exactly (it repaints, it never re-sculpts), so an
    // epilogue prop seats on the B terrain like its variant-B neighbours.
    () => anchorTransform(theta, x, variant === 0 ? 0 : 1),
    [theta, x, variant]
  )

  useFrame(() => {
    const g = ref.current
    if (!g) return
    g.visible = variant === sceneVariantAt(tc, journeyRef.current.rotation)
  })

  return (
    <group ref={ref} position={position} quaternion={quaternion}>
      {children}
    </group>
  )
}
