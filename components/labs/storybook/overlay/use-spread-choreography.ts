'use client'

/**
 * Shared page-turn TEXT choreography state. Both the side-column overlay
 * (spread-overlay.tsx) and the bottom nav label (nav.tsx) read it so their
 * two text surfaces swap on the SAME turn cue instead of drifting apart — the
 * overlay used to swap at the 0.72 land cue while the nav label swapped on the
 * store commit at t=1, a visible ~280ms mismatch mid-cascade.
 *
 * Each caller runs its own copy of this hook; they are deterministic in the
 * same store + turn-events inputs (and React runs their effects in one commit),
 * so the copies stay bit-synced without a shared store field.
 */

import { useEffect, useState } from 'react'
import { useStorybookStore } from '../store'
import { isFrozenTurnPose, onTurnLand, onTurnStart } from '../turn-events'

/** Live `prefers-reduced-motion` flag. Reduced-motion readers get an instant
 *  swap at the store commit (no land-cue lead, no entrance/exit). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  return reduced
}

export type SpreadChoreography = {
  /** The spread the text surfaces should show — synced to the turn's 0.72 land
   *  cue so the overlay text and the nav label swap together, a beat before the
   *  store commit. Reduced motion / frozen poses follow the committed store
   *  spread instead (instant swap at commit). */
  displaySpread: number
  /** True while the outgoing text animates away (turn armed, not yet landed). */
  exiting: boolean
  /** Loaded on a frozen `?sbpose=<n>:<t>:<dir>` benchmark pose — the overlay
   *  blacks out over these so the golden harness's mid-turn stations stay
   *  text-free (see turn-events.isFrozenTurnPose). */
  frozenTurn: boolean
}

export function useSpreadChoreography(): SpreadChoreography {
  const spread = useStorybookStore((s) => s.spread)
  const reduceMotion = usePrefersReducedMotion()
  const [frozenTurn] = useState(isFrozenTurnPose)
  const [displaySpread, setDisplaySpread] = useState(spread)
  const [exiting, setExiting] = useState(false)

  // Reconcile with the committed spread: the resting source of truth, the
  // reduced-motion path (no bridge subscription below), and the settle after
  // a land cue already moved us (a no-op when displaySpread is already there).
  useEffect(() => {
    setDisplaySpread(spread)
    setExiting(false)
  }, [spread])

  // Bridge the frame-loop turn clock to the entrance/exit choreography. Skipped
  // under reduced motion (instant swap at commit via the effect above) and for
  // a frozen pose (no cues ever arrive).
  useEffect(() => {
    if (reduceMotion || frozenTurn) return
    const offStart = onTurnStart(() => setExiting(true))
    const offLand = onTurnLand((event) => {
      setDisplaySpread(event.to)
      setExiting(false)
    })
    return () => {
      offStart()
      offLand()
    }
  }, [reduceMotion, frozenTurn])

  return { displaySpread, exiting, frozenTurn }
}
