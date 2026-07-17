'use client'
import { useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { easeOutBack } from '../../journey-timeline'
import type { JourneyRef } from '../use-journey'

/**
 * The ChapterSet mechanism generalized to the lap boundary: a group whose scale
 * follows worldBlend so the lap-1 dressing sinks radially into the clay while
 * the lap-2 dressing pops back out (easeOutBack overshoot) across the boundary
 * panel. lap-1 scales 1→0.0001, lap-2 scales 0.0001→1; both visible-gated so the
 * hidden lap costs no draw calls once fully collapsed.
 */
export function LapSet({
  lap,
  journeyRef,
  children,
}: {
  lap: 1 | 2
  journeyRef: JourneyRef
  children: ReactNode
}) {
  const ref = useRef<THREE.Group>(null)

  useFrame(() => {
    const g = ref.current
    if (!g) return
    const blend = journeyRef.current.worldBlend
    const s = lap === 1 ? 1 - blend : blend
    g.visible = s > 0.001
    if (g.visible) g.scale.setScalar(Math.max(easeOutBack(s), 0.0001))
  })

  return <group ref={ref}>{children}</group>
}
