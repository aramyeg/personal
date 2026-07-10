/**
 * Pure math driving pop-up layer fold/rise progress directly from a page
 * turn's t∈[0,1], instead of an independent per-layer spring, whenever a
 * turn is in flight (task 18: the old spring let incoming paper stand up —
 * or outgoing paper stay standing — while the turning page was still
 * airborne overhead). No three.js imports here, same jsdom-testable
 * convention as page-geometry.ts; popup-spread.tsx is the only consumer.
 *
 * Shared timeline (every layer only shifts within it by a small
 * `phaseOffset` window fraction, computed by the caller from a fixed
 * per-layer ms stagger and the turn's actual duration):
 *
 *   t ∈ [0, FOLD_END_T]              outgoing spread folds `start` -> 0
 *   t ∈ (FOLD_END_T, RISE_START_T)   both spreads lie flat — the turning
 *                                    page sweeps overhead during this gap
 *   t ∈ [RISE_START_T, 1]            incoming spread rises 0 -> RISE_LANDING_STAND
 *
 * The last stretch from RISE_LANDING_STAND to a full stand of 1 is *not*
 * handled here — the caller's existing spring takes it once the layer's
 * role flips from "incoming" to "current" at commit, landing as a small,
 * natural overshoot-settle rather than a kinematic snap.
 */

import { easeTurn } from './page-geometry'

export const FOLD_END_T = 0.4
export const RISE_START_T = 0.62
export const RISE_LANDING_STAND = 0.92

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))

/**
 * Outgoing-spread fold progress: `start` (whatever stand value this layer
 * was actually captured at when it became the outgoing spread — see
 * popup-spread.tsx's foldStart ref — never assumed to be 1) eases down to
 * 0 across t ∈ [phaseOffset, FOLD_END_T]. Clamped flat for any t at or past
 * FOLD_END_T regardless of phaseOffset, so every layer — whatever its
 * stagger — is guaranteed flat well before the incoming spread starts
 * rising at RISE_START_T.
 */
export function outgoingFoldStand(t: number, start: number, phaseOffset: number): number {
  if (start <= 0) return 0
  if (t <= phaseOffset) return start
  if (t >= FOLD_END_T) return 0
  const u = clamp01((t - phaseOffset) / (FOLD_END_T - phaseOffset))
  return start * (1 - easeTurn(u))
}

/**
 * Incoming-spread rise progress: held at 0 until t = RISE_START_T +
 * phaseOffset, then eases up to RISE_LANDING_STAND by t = 1. Never reaches
 * a full stand under this function alone by design — see file header.
 */
export function incomingRiseStand(t: number, phaseOffset: number): number {
  const windowStart = Math.min(RISE_START_T + phaseOffset, 1)
  if (t <= windowStart) return 0
  if (t >= 1) return RISE_LANDING_STAND
  const u = clamp01((t - windowStart) / (1 - windowStart))
  return RISE_LANDING_STAND * easeTurn(u)
}
