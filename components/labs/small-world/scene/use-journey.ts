import { useRef } from 'react'
import type { MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { journeyStateAt, type JourneyState } from '../journey-timeline'

export type JourneyRef = MutableRefObject<JourneyState>

/** Exponential-damping rate (lambda) for scroll progress smoothing — tuned 3-6. */
const DAMP_LAMBDA = 4

/**
 * Damps raw scroll progress once per frame and derives the JourneyState from
 * that smoothed value — the single source every scene consumer reads. Planet
 * and GirlProxy must never compute journeyStateAt from two different progress
 * values, or the rotation and the hop cadence drift apart.
 *
 * Runs at priority -1 so it updates before default-priority consumers read
 * the ref later in the same frame.
 */
export function useDampedJourney(progressRef: MutableRefObject<number>): JourneyRef {
  const damped = useRef(progressRef.current)
  const journeyRef = useRef<JourneyState>(journeyStateAt(progressRef.current))

  useFrame((_, delta) => {
    damped.current = THREE.MathUtils.damp(damped.current, progressRef.current, DAMP_LAMBDA, delta)
    journeyRef.current = journeyStateAt(damped.current)
  }, -1)

  return journeyRef
}
