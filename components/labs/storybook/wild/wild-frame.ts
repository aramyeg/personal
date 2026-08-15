/**
 * WILD lane — the single owner of per-frame diorama state.
 *
 * Every consumer derives its pose from `readWildFrame` inside its own `useFrame`. There is
 * deliberately no producer/consumer ordering: the derivation is pure, so it does not matter
 * which component ticks first and no component can read a stale value.
 *
 * Frame of reference (inherited from <PopupSpread>, which sits at [0, POPUP_Y, 0]):
 *   y = 0 is the page surface · x = 0 is the spine · -z is far, +z is toward the reader.
 */
import type { RefObject } from 'react'
import { createContext, useContext } from 'react'

import { easeTurnWeighted, easeTurnWeightedInv } from '../book/page-geometry'
import { liveSpreadRole, spreadPageAnglesTilted } from '../book/popup-mechanics'
import { SETTLE_MS, TURN_MS, turnPublishedT, type TurnFrame } from '../book/use-turn-driver'

export type WildRole = ReturnType<typeof liveSpreadRole>

/** Dihedral of a fully open spread. The page bulge keeps it just under PI. */
export const BETA_OPEN = 3.07
/** Below this the spread is a closed sliver; the diorama hides entirely. */
export const BETA_HIDDEN = 0.02

export type WildFrame = {
  role: WildRole
  /** Live dihedral, 0 (shut) .. ~3.07 (open). */
  beta: number
  /**
   * The two page planes this spread is printed on, as the book itself defines them: each page
   * runs from the spine along [cos theta, sin theta, 0]. A flat-open book would read PI and 0;
   * the stacks under each side tilt them (at chapter I one sheet lies under the left page and
   * eight under the right, so the right is by far the steeper). Anything that has to lie ON the
   * paper rather than float over it — the courtyard, above all — poses off these and not off a
   * flat y, because a flat plane sinks under the paper as |x| grows and the old page art shows.
   */
  thetaL: number
  thetaR: number
  /** Curtain-up progress, 0 .. 1, eased. Drives every reveal on the stage. */
  open: number
  /** The key's turn, 0 (asleep) .. 1 (every room lit). Reader-driven, reversible. */
  wake: number
  /** Seconds since the diorama mounted. Idle motion only — never pose. */
  time: number
  /** True when the spread is shut far enough that nothing should render. */
  hidden: boolean
}

export type WildContextValue = {
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
  /** Written by the key toy's pointer handler, read by everything that responds to waking. */
  wake: RefObject<number>
  /** Wall clock shared by all idle motion so drifts stay phase-locked. */
  clock: RefObject<number>
}

export const WildContext = createContext<WildContextValue | null>(null)

export function useWild(): WildContextValue {
  const ctx = useContext(WildContext)
  if (!ctx) throw new Error('useWild must be used inside <Ch1Diorama>')
  return ctx
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Smooth Hermite ramp between two edges. The stage's only interpolator — use it everywhere. */
export function ramp(v: number, edge0: number, edge1: number): number {
  const t = clamp01((v - edge0) / (edge1 - edge0 || 1e-6))
  return t * t * (3 - 2 * t)
}

// ---------------------------------------------------------------------------------------------
// THE CURTAIN CLOCK — and why it is no longer a function of the dihedral
// ---------------------------------------------------------------------------------------------

/**
 * `open` used to be `smoothstep(beta, 0.62, 3.02)`. That looks reasonable and is a trap, because
 * THREE EASINGS COMPOSE on the way from wall time to that number:
 *
 *   1. the driver's own `easeTurnWeighted` (a QUINT) maps elapsed -> published progress,
 *   2. the dihedral is linear in that, and
 *   3. the smoothstep eased it again.
 *
 * Measured on the real title -> chapter-I turn (scripts/storybook/bench/e5-foldbirth.mjs, the
 * WALL block): `open` sat at exactly 0 for the first 539 ms of the 1250 ms turn and reached 1 by
 * 860 ms. The ENTIRE curtain-up — night, courtyard, the seven-event fold-birth, the dressing —
 * was crammed into a 320 ms band, and the fold's individual events completed in 18-33 ms each,
 * one to two frames. It read as a pop-in, which is exactly the defect the fold was built to fix.
 *
 * So the curtain no longer rides the dihedral's SHAPE. It rides WALL TIME, gated by the dihedral:
 *
 *   - the gate is unchanged and load-bearing. Nothing may show before beta passes BETA_LEGIBLE,
 *     because this lane's diorama is not glued to the two page planes (D1) — it stands in the
 *     spread's flat local frame, so before the leaf is properly over it would render on top of
 *     the spread the reader is still looking at. (That leak has been shipped once already; see
 *     the perf round's note about the night diorama appearing on the title page.)
 *   - past the gate the clock advances LINEARLY IN WALL TIME to the turn's commit, so every beat
 *     downstream — and every hinge event — gets an even share of the ~978 ms that remain.
 *
 * Every consumer's staging is expressed as fractions of `open`, so this changes WHEN things
 * happen in real time and never their order or their relative spacing.
 */
export const BETA_LEGIBLE = 0.62

const TURN_TOTAL_MS = TURN_MS + SETTLE_MS

/**
 * The driver's own published-progress curve, sampled per millisecond. Inverting it by search is
 * how this module recovers WALL TIME from the one number the driver publishes without restating
 * the driver's settle constants (`SETTLE_DEFICIT` and the tail's tau are private to it, and the
 * tail is exactly the stretch the curtain most needs).
 */
const T_AT_MS = (() => {
  const table = new Float64Array(TURN_TOTAL_MS + 1)
  for (let ms = 0; ms <= TURN_TOTAL_MS; ms += 1) table[ms] = turnPublishedT(ms, TURN_MS)
  return table
})()

/** Fraction of the whole turn (sweep + settle tail) elapsed at published progress `t`. */
export function turnElapsedFraction(t: number): number {
  let lo = 0
  let hi = TURN_TOTAL_MS
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (T_AT_MS[mid] < t) lo = mid + 1
    else hi = mid
  }
  return lo / TURN_TOTAL_MS
}

/** The dihedral this spread would show at either end of the turn it is taking part in. */
function betaAtEased(ctx: WildContextValue, dir: 'next' | 'prev', easedT: number): number {
  const { thetaL, thetaR } = spreadPageAnglesTilted(
    ctx.spreadIndex,
    ctx.committedSpread.current,
    dir,
    easedT,
  )
  return thetaL - thetaR
}

type TurnShape = { key: string; cross: number; rising: boolean }
let turnShapeCache: TurnShape | null = null

/**
 * Where in the turn this spread becomes legible, and which way its dihedral is going. Both depend
 * only on WHICH spread is turning WHICH way, so they are constant for the whole turn — worth one
 * cache entry, because `readWildFrame` is called by every consumer on every frame and this would
 * otherwise re-solve the page angles a dozen times a frame for an answer that cannot change.
 */
function turnShape(ctx: WildContextValue, dir: 'next' | 'prev'): TurnShape {
  const key = `${ctx.spreadIndex}:${ctx.committedSpread.current}:${dir}`
  if (turnShapeCache && turnShapeCache.key === key) return turnShapeCache
  const b0 = betaAtEased(ctx, dir, 0)
  const b1 = betaAtEased(ctx, dir, 1)
  const span = b1 - b0
  // The dihedral is linear in the eased clock, so the crossing is one division.
  const easedAtCross = Math.abs(span) < 1e-9 ? 0 : clamp01((BETA_LEGIBLE - b0) / span)
  turnShapeCache = {
    key,
    cross: turnElapsedFraction(easeTurnWeightedInv(easedAtCross)),
    rising: span > 0,
  }
  return turnShapeCache
}

/**
 * Curtain-up progress: 0 until the spread is legible, then linear in wall time to the commit.
 * Runs backwards for an outgoing spread, so the inn folds itself away as the leaf leaves.
 */
function curtainClock(
  ctx: WildContextValue,
  role: WildRole,
  dir: 'next' | 'prev' | null,
  t: number,
): number {
  if (role === 'hidden') return 0
  if (dir === null || role === 'current') return 1
  const { cross, rising } = turnShape(ctx, dir)
  const elapsed = turnElapsedFraction(t)
  return rising
    ? clamp01((elapsed - cross) / Math.max(1e-6, 1 - cross))
    : clamp01((cross - elapsed) / Math.max(1e-6, cross))
}

export function readWildFrame(ctx: WildContextValue): WildFrame {
  const f = ctx.frame.current
  const dir = f?.dir ?? null
  const role = liveSpreadRole(ctx.spreadIndex, ctx.committedSpread.current, dir)
  const { thetaL, thetaR } = spreadPageAnglesTilted(
    ctx.spreadIndex,
    ctx.committedSpread.current,
    dir,
    f ? easeTurnWeighted(f.t) : 0,
  )
  const beta = thetaL - thetaR
  const hidden = role === 'hidden' || beta <= BETA_HIDDEN
  return {
    role,
    beta,
    thetaL,
    thetaR,
    // A role-hidden spread reads as SHUT no matter what the page angles say: the angle
    // derivation is only meaningful for the current/turning spreads, and the diorama tree is
    // never visibility-gated (a light-count change re-links every program in the scene), so
    // `open` is the one switch every consumer self-hides from — the stage must arrive at 0.
    // (The `hidden` term is belt and braces: below BETA_HIDDEN the curtain clock is already 0,
    // because BETA_HIDDEN is far under BETA_LEGIBLE.)
    open: hidden ? 0 : curtainClock(ctx, role, dir, f ? f.t : 0),
    wake: clamp01(ctx.wake.current),
    time: ctx.clock.current,
    hidden,
  }
}

/**
 * Frame-rate independent approach, for anything that chases a target (the key's spring, the
 * camera lean, flicker settling). `lambda` is the reciprocal time constant in 1/seconds.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt)
}
