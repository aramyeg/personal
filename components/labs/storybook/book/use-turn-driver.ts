'use client'

/**
 * Drives page-turn progress entirely inside the r3f frame loop. Per the
 * store's documented contract, continuous turn progress never touches
 * Zustand (no re-render per frame) — only the discrete start/commit
 * transitions do. Consumers (book.tsx, turning-page.tsx) read the returned
 * ref's `.current` each frame themselves; it is `null` at rest and
 * `{ t, dir, isCover }` for the duration of a turn.
 */

import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { sbSound } from '../sound'
import { useStorybookStore, type TurnDir } from '../store'

// task 18: nudged up from 1100/1400 — paired with page-geometry's
// easeTurnWeighted (a gentler grip at the start, a softer landing) this is
// what reads as a real hardback page rather than a quick, weightless swipe.
// COVER_MS keeps roughly the same ~1.27x ratio over TURN_MS a cover always
// had (there's more leather/board mass to swing).
export const TURN_MS = 1250
export const COVER_MS = 1600
// Fraction of the turn at which the paper "flip" whoosh fires — roughly the
// moment the page is mid-air, past the initial lift.
const FLIP_AT_T = 0.15

export type TurnFrame = { t: number; dir: TurnDir; isCover: boolean }

/** True when `dir` would flip the front cover itself (spread 0<->1) rather
 *  than turning an interior page — shared with book.tsx so it can gate the
 *  left static page/block's visibility using the same rule this driver uses
 *  to pick the cover animation branch. */
export const isCoverTurn = (spread: number, dir: TurnDir): boolean =>
  (spread === 0 && dir === 'next') || (spread === 1 && dir === 'prev')

/**
 * Returns a ref whose `.current` is `{t: 0..1, dir, isCover}` while turning,
 * `null` at rest. Starts when `store.turning` flips truthy; on `t >= 1` it
 * calls `completeTurn()` exactly once and resets its clock — if that commit
 * chain-promotes a queued turn, `turning` is still truthy on the very next
 * frame, so this hook re-arms automatically without any extra bookkeeping.
 *
 * Also the single owner of the turn's procedural sound cues (task 13): a
 * `creak()` the instant a cover turn arms, a `flip()` once `t` first passes
 * `FLIP_AT_T`, and a `thump()` on landing — each latched with its own
 * "fired" ref so a sustained condition (t past the threshold, isCover true)
 * plays exactly once per turn instead of once per frame. sbSound itself
 * no-ops unless sound is on, so these calls are unconditional here.
 */
export function useTurnDriver(): RefObject<TurnFrame | null> {
  const frame = useRef<TurnFrame | null>(null)
  const elapsedMs = useRef(0)
  // Which direction the clock is currently timing. Reset to null right
  // after a completion so the very next frame always re-arms — even when
  // the promoted queued turn shares the same direction as the one that
  // just finished.
  const armedFor = useRef<TurnDir | null>(null)
  const firedCreak = useRef(false)
  const firedFlip = useRef(false)

  useFrame((_, delta) => {
    const { turning, spread } = useStorybookStore.getState()

    if (!turning) {
      frame.current = null
      elapsedMs.current = 0
      armedFor.current = null
      firedCreak.current = false
      firedFlip.current = false
      return
    }

    if (armedFor.current !== turning) {
      armedFor.current = turning
      elapsedMs.current = 0
      firedCreak.current = false
      firedFlip.current = false
    }

    const isCover = isCoverTurn(spread, turning)
    const duration = isCover ? COVER_MS : TURN_MS

    elapsedMs.current += delta * 1000
    const t = Math.min(1, elapsedMs.current / duration)
    frame.current = { t, dir: turning, isCover }

    if (isCover && !firedCreak.current) {
      firedCreak.current = true
      sbSound.creak()
    }
    if (!firedFlip.current && t >= FLIP_AT_T) {
      firedFlip.current = true
      sbSound.flip()
    }

    if (t >= 1) {
      // A large frame delta (e.g. a backgrounded tab resuming) can jump t
      // straight from < FLIP_AT_T to >= 1 in one frame — flip still plays
      // once, just back-to-back with thump, rather than being skipped.
      if (!firedFlip.current) {
        firedFlip.current = true
        sbSound.flip()
      }
      sbSound.thump()
      useStorybookStore.getState().completeTurn()
      elapsedMs.current = 0
      armedFor.current = null
      firedCreak.current = false
      firedFlip.current = false
    }
  })

  return frame
}
