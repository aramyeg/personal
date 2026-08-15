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

import { easeTurnWeighted } from '../book/page-geometry'
import { liveSpreadRole, spreadPageAnglesTilted } from '../book/popup-mechanics'
import type { TurnFrame } from '../book/use-turn-driver'

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

/**
 * Curtain-up is deliberately back-loaded: nothing legible happens until the spread is
 * two-thirds open, so the four reveal events all land inside the last stretch of the turn
 * rather than smearing across the whole page swing.
 */
function opennessFromBeta(beta: number): number {
  return ramp(beta, 0.62, BETA_OPEN - 0.05)
}

export function readWildFrame(ctx: WildContextValue): WildFrame {
  const f = ctx.frame.current
  const role = liveSpreadRole(ctx.spreadIndex, ctx.committedSpread.current, f?.dir ?? null)
  const { thetaL, thetaR } = spreadPageAnglesTilted(
    ctx.spreadIndex,
    ctx.committedSpread.current,
    f?.dir ?? null,
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
    open: hidden ? 0 : opennessFromBeta(beta),
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
