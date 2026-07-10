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
import { useStorybookStore, type TurnDir } from '../store'

export const TURN_MS = 1100
export const COVER_MS = 1400

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
 */
export function useTurnDriver(): RefObject<TurnFrame | null> {
  const frame = useRef<TurnFrame | null>(null)
  const elapsedMs = useRef(0)
  // Which direction the clock is currently timing. Reset to null right
  // after a completion so the very next frame always re-arms — even when
  // the promoted queued turn shares the same direction as the one that
  // just finished.
  const armedFor = useRef<TurnDir | null>(null)

  useFrame((_, delta) => {
    const { turning, spread } = useStorybookStore.getState()

    if (!turning) {
      frame.current = null
      elapsedMs.current = 0
      armedFor.current = null
      return
    }

    if (armedFor.current !== turning) {
      armedFor.current = turning
      elapsedMs.current = 0
    }

    const isCover = isCoverTurn(spread, turning)
    const duration = isCover ? COVER_MS : TURN_MS

    elapsedMs.current += delta * 1000
    const t = Math.min(1, elapsedMs.current / duration)
    frame.current = { t, dir: turning, isCover }

    if (t >= 1) {
      useStorybookStore.getState().completeTurn()
      elapsedMs.current = 0
      armedFor.current = null
    }
  })

  return frame
}
