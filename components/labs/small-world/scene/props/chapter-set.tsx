'use client'
import { useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { easeOutBack } from '../../journey-timeline'
import type { JourneyRef } from '../use-journey'

/**
 * Scales a chapter's props by its morph value ABOUT THE PLANET CENTER —
 * shrinking pulls every anchored prop radially into the clay, growing pops
 * it back out with easeOutBack overshoot. Gate-1 pivot (fixed planet):
 * replace the frame body with `ref.current.scale.setScalar(1)` + always
 * visible; sets and anchors stay untouched.
 */
export function ChapterSet({
  index,
  journeyRef,
  children,
}: {
  index: number
  journeyRef: JourneyRef
  children: ReactNode
}) {
  const ref = useRef<THREE.Group>(null)

  useFrame(() => {
    const g = ref.current
    if (!g) return
    const m = journeyRef.current.morph[index]
    g.visible = m > 0.001
    if (g.visible) g.scale.setScalar(Math.max(easeOutBack(m), 0.0001))
  })

  return <group ref={ref}>{children}</group>
}
