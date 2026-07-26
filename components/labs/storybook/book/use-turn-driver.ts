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
import { easeTurnWeighted, easeTurnWeightedInv } from './page-geometry'
import { sbSound } from '../sound'
import { SPREAD_COUNT } from '../content'
import { useStorybookStore, type TurnDir } from '../store'
import { resetUserDrives } from '../user-drive'
import { resetNudgePulses } from './handle-nudge'
import { initialBeckonState, stepBeckon } from './handle-beckon'
import { emitTurnLand, emitTurnStart } from '../turn-events'

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
// Fraction of the turn at which the overlay's "text landed" cue fires (E-G4
// item 5, spec E-P3). Deliberately BEFORE t=1: the incoming spread's text
// begins its staggered entrance a beat before the page geometrically settles
// (the v-fold family's late-rush is the final ~15%), so the page turn reads
// as DELIVERING the words rather than the words being appended after the
// motion stops. Bridged to the DOM overlay via turn-events (no per-frame
// React — fired once per turn, like the sound cues below).
const TEXT_LAND_AT_T = 0.72

// Landing settle (the half-degree sigh). The main sweep stops SETTLE_DEFICIT
// short of rest, then an exponential tail relaxes into it over SETTLE_MS
// before the commit fires. Implemented ONCE here by warping the published
// `t`: every consumer runs it back through easeTurnWeighted, so publishing
// easeTurnWeightedInv(E) hands each of them exactly the progress E — sheet,
// popup gearing, block relaxation and cover board all inherit the tail with
// no code of their own. Derived in .superpowers/sdd/bench/e3sys-settle.mjs:
// commit residual 0.022deg (2.5% of the already-accepted 0.5deg hand-off
// residual), worst per-vertex step through the steepest shipped gearing
// 0.0085 — 6x under the motion-character GLOBAL_CAP.
export const SETTLE_MS = 250
const SETTLE_TAU_MS = 80
// 0.5 deg of the ~176 deg dihedral sweep, in eased-progress units.
const SETTLE_DEFICIT = 0.5 / 176

/** Eased progress at `elapsed` ms into a turn of `duration` ms: the quint
 *  sweep scaled to fall SETTLE_DEFICIT short, then the exponential tail. */
export const settleProgress = (elapsed: number, duration: number): number =>
  elapsed <= duration
    ? (1 - SETTLE_DEFICIT) * easeTurnWeighted(elapsed / duration)
    : 1 - SETTLE_DEFICIT * Math.exp(-(elapsed - duration) / SETTLE_TAU_MS)

/** The raw `t` the driver publishes at `elapsed` ms — the inverse ease of
 *  settleProgress, so a consumer's own easeTurnWeighted(t) recovers it. */
export const turnPublishedT = (elapsed: number, duration: number): number =>
  easeTurnWeightedInv(settleProgress(elapsed, duration))

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
 * `null` at rest. Starts when `store.turning` flips truthy; once the main
 * sweep and its settle tail have both run (or a queued turn cuts the tail
 * short) it calls `completeTurn()` exactly once and resets its clock — if that commit
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
  const firedLand = useRef(false)
  // The thump latches at the PERCEPTUAL landing (main sweep end), not at the
  // commit a settle later — the sound must sit on the moment the page hits.
  const firedThump = useRef(false)
  // The idle beckon's clock (handle-beckon.ts). It lives here because this is
  // the one frame loop that already knows the committed spread and whether a
  // turn is in flight — the two things a beckon must never fight.
  const beckon = useRef(initialBeckonState())

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
    // SPREAD-EXIT RESET (E3 BW-19). The committed spread has just changed, so
    // the reader has LEFT a page: drop every held reader value and any pending
    // tap pulse, because a reopened page is a fresh pop-up. (A blind reader
    // turned away from spread 7 and back and found the vault lid still standing
    // open.) Done here rather than in the store because the drives live outside
    // React entirely, and this ref moves in lockstep with the sheet — the same
    // clock the pieces themselves are posed on.
    if (committedSpread.current !== state.spread) {
      resetUserDrives()
      resetNudgePulses()
    }
    committedSpread.current = state.spread

    // AFFORDANCE, third leg (BW-1): if the reader has touched nothing for a few
    // seconds, the spread's primary playable twitches once — the same nudge a
    // press would give it. It withdraws the offer the moment a grab happens and
    // never offers more than BECKON_LIMIT times.
    stepBeckon(
      beckon.current,
      state.spread,
      delta,
      state.booted && state.turning === null && frame.current === null,
      state.grab !== null
    )

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
      firedLand.current = false
      firedThump.current = false
      return
    }

    if (armedFor.current !== turning) {
      armedFor.current = turning
      elapsedMs.current = 0
      firedCreak.current = false
      firedFlip.current = false
      firedLand.current = false
      firedThump.current = false
      // Overlay choreography: the outgoing text exits now (turn-events →
      // spread-overlay.tsx). `spread` is the committed spread being left.
      emitTurnStart({ dir: turning, from: spread })
    }

    const isCover = isCoverTurn(spread, turning)
    const duration = isCover ? COVER_MS : TURN_MS

    elapsedMs.current += delta * 1000
    const elapsed = elapsedMs.current
    // The RAW main-sweep fraction. Every cue threshold below compares against
    // it so the settle tail leaves cue timing exactly where it was.
    const raw = elapsed / duration
    frame.current = { t: turnPublishedT(elapsed, duration), dir: turning, isCover }

    if (isCover && !firedCreak.current) {
      firedCreak.current = true
      sbSound.creak()
    }
    if (!firedFlip.current && raw >= FLIP_AT_T) {
      firedFlip.current = true
      sbSound.flip()
    }
    // The "deliver the text" cue — fired once, a beat before landing, so the
    // incoming overlay text staggers in as the page settles rather than after.
    if (!firedLand.current && raw >= TEXT_LAND_AT_T) {
      firedLand.current = true
      emitTurnLand({ dir: turning, to: spread + (turning === 'next' ? 1 : -1) })
    }

    if (raw >= 1 && !firedThump.current) {
      // A large frame delta (e.g. a backgrounded tab resuming) can jump
      // straight from < FLIP_AT_T past the landing in one frame — flip still
      // plays once, just back-to-back with thump, rather than being skipped.
      if (!firedFlip.current) {
        firedFlip.current = true
        sbSound.flip()
      }
      firedThump.current = true
      sbSound.thump()
    }

    // The settle is a sigh, not a queue: a hand already reaching for the next
    // page kills it, like a real book. A turn queued at the sweep's end (or
    // arriving mid-settle) commits on that frame. A single frame long enough
    // to jump the whole tail falls straight through here too.
    if (elapsed >= duration + SETTLE_MS || (raw >= 1 && state.queued !== null)) {
      useStorybookStore.getState().completeTurn()
      // Land the whole commit inside THIS rAF: every default-priority
      // consumer (book.tsx's page prints, the sheet, every popup layer)
      // runs after this hook in the same frame — enforced by
      // DRIVER_PRIORITY, not mount order — so nulling the frame and
      // advancing the committed spread here swaps the static pages, hides
      // the sheet, and re-roles the popups in one atomic paint. Leaving
      // frame.current live until the next rAF let React's commit race the
      // driver — a landed-but-still-visible sheet whose materials a passive
      // effect had already reset painted one blank-paper frame.
      // (The settle has run the sheet to within 0.022deg of the static
      // landed page — 2.5% of the accepted hand-off residual — so hiding it
      // a frame "early" is indistinguishable, as it was at t=1 before.)
      committedSpread.current = useStorybookStore.getState().spread
      frame.current = null
      elapsedMs.current = 0
      armedFor.current = null
      firedCreak.current = false
      firedFlip.current = false
      firedLand.current = false
      firedThump.current = false
    }
  }, DRIVER_PRIORITY)

  return { frame, committedSpread }
}
