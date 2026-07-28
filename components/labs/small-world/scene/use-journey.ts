import { useRef } from 'react'
import type { MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { journeyStateAt, type JourneyState } from '../journey-timeline'
import type { ArrivalState } from '../arrival'

export type JourneyRef = MutableRefObject<JourneyState>

/** Exponential-damping rate (lambda) for scroll progress smoothing — tuned 3-6. */
const DAMP_LAMBDA = 4

/**
 * Damps raw scroll progress once per frame and derives the JourneyState from
 * that smoothed value — the single source every scene consumer reads. Planet
 * and GirlProxy must never compute journeyStateAt from two different progress
 * values, or the rotation and the hop cadence drift apart.
 *
 * The arrival reveal is merged in UNDAMPED: it is a wall clock, not a scroll
 * value, and damping it would make the entrance start late and drift out of
 * step with the DOM cards reading the same clock (see RevealState).
 *
 * Runs at priority -1 so it updates before default-priority consumers read
 * the ref later in the same frame.
 */
export function useDampedJourney(
  progressRef: MutableRefObject<number>,
  arrivalRef?: MutableRefObject<ArrivalState>
): JourneyRef {
  const damped = useRef(progressRef.current)
  const morphScratch = useRef<number[]>([])
  const journeyRef = useRef<JourneyState>(
    journeyStateAt(progressRef.current, undefined, arrivalRef?.current.reveal ?? null)
  )
  if (morphScratch.current.length === 0) {
    morphScratch.current = journeyRef.current.morph
  }

  useFrame((_, delta) => {
    damped.current = THREE.MathUtils.damp(damped.current, progressRef.current, DAMP_LAMBDA, delta)
    journeyRef.current = journeyStateAt(
      damped.current,
      morphScratch.current,
      arrivalRef?.current.reveal ?? null
    )
  }, -1)

  return journeyRef
}
