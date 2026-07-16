/**
 * Discrete turn-choreography signals bridging the r3f frame-loop turn clock
 * (book/use-turn-driver.ts) to the HTML text overlay (overlay/spread-
 * overlay.tsx). Like user-drive.ts, this is a plain module channel — NOT
 * React/zustand state — so the driver can announce the two moments the
 * overlay's motion design hangs on WITHOUT a per-frame re-render:
 *
 *   - START: a turn has ARMED — the outgoing spread's text exits (a quick
 *     fade/lift, as the page begins to lift).
 *   - LAND: the turn has passed its landing cue (a beat BEFORE the page
 *     fully settles, per spec E-P3) — the incoming spread's text is
 *     delivered, staggered in, so the page turn reads as HANDING the reader
 *     the new page's words rather than the words being appended after.
 *
 * Fired at most twice per turn (once each), off the same driver clock the
 * sheet's own pose runs on — never per frame. No three.js, no react:
 * importable from both the r3f driver and the DOM overlay without pulling
 * either into the other's bundle (same rule as user-drive.ts / store.ts).
 */

import type { TurnDir } from './store'

export type TurnStartEvent = { dir: TurnDir; from: number }
export type TurnLandEvent = { dir: TurnDir; to: number }

type StartListener = (event: TurnStartEvent) => void
type LandListener = (event: TurnLandEvent) => void

const startListeners = new Set<StartListener>()
const landListeners = new Set<LandListener>()

/** Subscribe to turn-arm signals; returns an unsubscribe. */
export function onTurnStart(listener: StartListener): () => void {
  startListeners.add(listener)
  return () => void startListeners.delete(listener)
}

/** Subscribe to turn-landing-cue signals; returns an unsubscribe. */
export function onTurnLand(listener: LandListener): () => void {
  landListeners.add(listener)
  return () => void landListeners.delete(listener)
}

export function emitTurnStart(event: TurnStartEvent): void {
  for (const listener of startListeners) listener(event)
}

export function emitTurnLand(event: TurnLandEvent): void {
  for (const listener of landListeners) listener(event)
}

/**
 * True when the page is loaded on a FROZEN mid-turn benchmark pose
 * (`?sbpose=<spread>:<t>:<dir>` — use-turn-driver.ts's readPoseOverride).
 * Such a pose sets `turning` non-null but never runs the turn clock, so the
 * overlay's start/land cues never fire; the golden-board harness freezes
 * these to check CANVAS geometry, and the text overlay must stay blacked out
 * over them exactly as it did before this choreography (or every mid-turn
 * golden station would gain text and fail the diff). Detected from the URL —
 * available synchronously at mount, unlike the store's `turning`, which the
 * driver's pose effect only sets AFTER the first commit. Dev-only, like
 * readPoseOverride: production never serves `?sbpose`.
 */
export function isFrozenTurnPose(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  if (typeof window === 'undefined') return false
  const raw = new URLSearchParams(window.location.search).get('sbpose')
  if (!raw) return false
  const t = raw.split(':')[1]
  return t !== undefined && t !== '' && Number.isFinite(Number(t))
}
