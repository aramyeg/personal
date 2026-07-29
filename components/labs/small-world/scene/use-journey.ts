import { useRef } from 'react'
import type { MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { journeyStateAt, type JourneyState } from '../journey-timeline'
import { burstFromLatch, stepBurstLatch, type ArrivalState, type BurstLatch } from '../arrival'

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
 * THE BURST LATCH is the one thing that must NOT ride the undamped clock. The girl's
 * celebrate jump fires on this value's rising edge and is handed back the instant she
 * still reads as travelling, and her locomotion is derived from the DAMPED rotation.
 * The undamped clock starts roughly v/lambda of a segment before the damped girl
 * plants, so firing on it caught her mid-stride and the jump was reclaimed 1-2 frames
 * in — a 70ms jump is not a jump. So the edge waits for the damped timeline to enter
 * the dwell, where `journeyStateAt` CLAMPS rotation: the next frame's rotation delta
 * is then exactly 0, she settles to idle, and the one-shot survives. The ramp is still
 * wall-clock from that instant, so the "!" plays with no scrolling. One latch per
 * reveal also means one rising edge per arrival, whatever the two progress sources are
 * doing during a catch-up.
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
  const burstLatch = useRef<BurstLatch>(null)
  const journeyRef = useRef<JourneyState>(
    journeyStateAt(progressRef.current, undefined, arrivalRef?.current.reveal ?? null)
  )
  if (morphScratch.current.length === 0) {
    morphScratch.current = journeyRef.current.morph
  }

  useFrame((_, delta) => {
    damped.current = THREE.MathUtils.damp(damped.current, progressRef.current, DAMP_LAMBDA, delta)
    const reveal = arrivalRef?.current.reveal ?? null
    burstLatch.current = stepBurstLatch(burstLatch.current, reveal, damped.current, delta)
    journeyRef.current = journeyStateAt(
      damped.current,
      morphScratch.current,
      reveal,
      // With no clock at all (no driver) the timeline keeps its original scroll window.
      arrivalRef === undefined ? undefined : burstFromLatch(burstLatch.current)
    )
  }, -1)

  return journeyRef
}
