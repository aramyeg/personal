'use client'

/**
 * Drives page-turn progress entirely inside the r3f frame loop. Per the
 * store's documented contract, continuous turn progress never touches
 * Zustand (no re-render per frame) — only the discrete start/commit
 * transitions do. Consumers (book.tsx, turning-page.tsx) read the returned
 * ref's `.current` each frame themselves; it is `null` at rest and
 * `{ t, dir, isCover }` for the duration of a turn.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { sbSound } from '../sound'
import { SPREAD_COUNT } from '../content'
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

// The driver's useFrame subscribes at this negative priority. r3f sorts
// subscribers ascending by priority (and only priorities > 0 switch the
// canvas to manual rendering), so this guarantees the driver ticks BEFORE
// every default-priority consumer in the same rAF regardless of mount
// order. Without it the ordering was a mount-order accident — TurningPage
// mounts with Book, so its child layout effect subscribed AHEAD of this
// hook's and read the refs one frame stale: at lift-off the reveal-side
// page had already pre-swapped to the incoming print while the sheet was
// still a frame from appearing over it — a one-frame bare-print flash.
const DRIVER_PRIORITY = -1

/** Dev-only deterministic pose override for the physics benchmark harness
 *  (see .superpowers/sdd/bench/capture.mjs): `?sbpose=<spread>` opens the
 *  book at rest on that spread; `?sbpose=<spread>:<t>:<dir>` freezes a turn
 *  from that spread at exactly raw progress t — pixel-reproducible mid-turn
 *  frames with zero timing noise. Compiled out of production builds. */
type PoseOverride = { spread: number; t: number | null; dir: TurnDir }

function readPoseOverride(): PoseOverride | null {
  if (process.env.NODE_ENV === 'production') return null
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('sbpose')
  if (!raw) return null
  const [spreadPart, tPart, dirPart] = raw.split(':')
  const spread = Number(spreadPart)
  if (!Number.isInteger(spread) || spread < 0 || spread >= SPREAD_COUNT) return null
  if (tPart === undefined) return { spread, t: null, dir: 'next' }
  const t = Number(tPart)
  if (!Number.isFinite(t)) return null
  return {
    spread,
    t: Math.min(1, Math.max(0, t)),
    dir: dirPart === 'prev' ? 'prev' : 'next',
  }
}

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
export function useTurnDriver(): { frame: RefObject<TurnFrame | null>; committedSpread: RefObject<number> } {
  const frame = useRef<TurnFrame | null>(null)
  // The committed `spread`, mirrored off the store every frame so consumers
  // reading it inside the frame loop (book.tsx's static-page prints) share the
  // sheet's own clock. `spread` on React's render clock lands a frame or two
  // late at a turn's commit — long enough for the sheet to have hidden (driver
  // ref) while the static page still showed the outgoing print: the turn
  // flash. This ref moves in lockstep with the sheet.
  const committedSpread = useRef(0)
  const elapsedMs = useRef(0)
  // Which direction the clock is currently timing. Reset to null right
  // after a completion so the very next frame always re-arms — even when
  // the promoted queued turn shares the same direction as the one that
  // just finished.
  const armedFor = useRef<TurnDir | null>(null)
  const firedCreak = useRef(false)
  const firedFlip = useRef(false)

  const pose = useMemo(readPoseOverride, [])
  useEffect(() => {
    if (!pose) return
    useStorybookStore.setState({
      spread: pose.spread,
      turning: pose.t !== null ? pose.dir : null,
      queued: null,
    })
  }, [pose])

  useFrame((_, delta) => {
    const state = useStorybookStore.getState()
    committedSpread.current = state.spread

    if (pose && pose.t !== null) {
      // Frozen benchmark pose: hold the frame forever, no clock, no
      // completion, no sound cues.
      frame.current = { t: pose.t, dir: pose.dir, isCover: isCoverTurn(pose.spread, pose.dir) }
      return
    }

    const { turning, spread } = state

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
      // Land the whole commit inside THIS rAF: every default-priority
      // consumer (book.tsx's page prints, the sheet, every popup layer)
      // runs after this hook in the same frame — enforced by
      // DRIVER_PRIORITY, not mount order — so nulling the frame and
      // advancing the committed spread here swaps the static pages, hides
      // the sheet, and re-roles the popups in one atomic paint. Leaving
      // frame.current at {t:1} until the next rAF let React's commit race
      // the driver — a landed-but-still-visible sheet whose materials a
      // passive effect had already reset painted one blank-paper frame.
      // (At t=1 the sheet's pose is exactly the static landed page, so
      // hiding it a frame "early" is pixel-identical.)
      committedSpread.current = useStorybookStore.getState().spread
      frame.current = null
      elapsedMs.current = 0
      armedFor.current = null
      firedCreak.current = false
      firedFlip.current = false
    }
  }, DRIVER_PRIORITY)

  return { frame, committedSpread }
}
