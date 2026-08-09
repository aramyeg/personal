import { useRef } from 'react'
import type { MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { journeyStateAt, type JourneyState } from '../journey-timeline'
import { JUMP_MAX, burstFromLatch, stepBurstLatch, type ArrivalState, type BurstLatch } from '../arrival'

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
  /** Last frame's TARGET, so a teleport can be told from a scroll — see the note in the loop. */
  const lastTarget = useRef(progressRef.current)
  const morphScratch = useRef<number[]>([])
  const burstLatch = useRef<BurstLatch>(null)
  const journeyRef = useRef<JourneyState>(
    journeyStateAt(progressRef.current, undefined, arrivalRef?.current.reveal ?? null)
  )
  if (morphScratch.current.length === 0) {
    morphScratch.current = journeyRef.current.morph
  }

  useFrame((_, delta) => {
    /**
     * A TELEPORT IS NOT SMOOTHED (Task 106), which is a rule this file was already downstream of
     * rather than a new one. `stepArrival` honours a one-frame jump exactly — "smoothing a
     * teleport would fight the input and would be the one case that turns a scroll into a long
     * automatic ride" — and then handed the jumped value to a damper that did precisely that.
     * At lambda 4 a jump across the whole track takes about 2.4 s to converge, so a scrollbar
     * drag, an End key, or Task 106's restart all glided the scene through every intervening
     * biome afterwards. Measured on the restart: the page landed at scroll 0 in ONE frame and the
     * world was still crossing the desert two thirds of a second later.
     *
     * The discriminator is the arrival machine's own ceiling, imported rather than restated: a
     * target that moves more than a whole chapter between two frames is not a hand on a page.
     * A fast fling is nowhere near it (a 8 000 px/s fling moves 0.011 of the track in a frame),
     * so the smoothing every other input relies on is untouched.
     */
    const target = progressRef.current
    const teleported = Math.abs(target - lastTarget.current) > JUMP_MAX
    lastTarget.current = target
    damped.current = teleported
      ? target
      : THREE.MathUtils.damp(damped.current, target, DAMP_LAMBDA, delta)
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
