'use client'
import { useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { anchorTransform } from '../stage'
import { activeVariantAt, canonicalTheta } from '../renewal'
import type { JourneyRef } from '../use-journey'

/**
 * A prop that swaps in/out with the renewal front. Plants children on the terrain
 * at (theta, x) — seated on its variant's terrain — and toggles its OWN visibility
 * by the gate at its OWN longitude: variant 0 (spring) is shown while the gate is
 * < 0.5, variant 1 (autumn) while ≥ 0.5. A coincident A/B pair is therefore always
 * A-visible XOR B-visible. The swap is instant (no grow/sink) because it always
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
  variant: 0 | 1
  journeyRef: JourneyRef
  children: ReactNode
}) {
  const ref = useRef<THREE.Group>(null)
  const tc = useMemo(() => canonicalTheta(theta), [theta])
  const { position, quaternion } = useMemo(
    () => anchorTransform(theta, x, variant),
    [theta, x, variant]
  )

  useFrame(() => {
    const g = ref.current
    if (!g) return
    g.visible = variant === activeVariantAt(tc, journeyRef.current.rotation)
  })

  return (
    <group ref={ref} position={position} quaternion={quaternion}>
      {children}
    </group>
  )
}
