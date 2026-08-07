/**
 * Motion state for the treadmill stage: her walking speed, the intro
 * walk-in, the visitor's cloth grab, and the effort she displays. The cloth
 * physics live in chain.ts — this module only decides speeds and reads the
 * tension back. Everything routes through springs; nothing teleports.
 *
 * Pure module: time is stepped by the caller, never read from a clock.
 */

import { CFG } from './config'

export type MotionMode = 'intro' | 'toy'

export interface MotionState {
  mode: MotionMode
  /** chibi world x, sim px (moves during intro, fixed after) */
  x: number
  /** her rest x once walked in */
  xRest: number
  /** ground-scroll speed, px/s */
  speed: number
  /** flick / keyboard boost on top of cruise, px/s (decays) */
  boost: number
  /** smoothed 0..~1.2 effort for the pose layer */
  effort: number
  /** pointer grab of the cloth */
  grabbing: boolean
  grabX: number
  grabY: number
  /** where the grab started, to measure the backward pull */
  grabX0: number
  /** seconds since creation, drives nothing but determinism helpers */
  t: number
  reduced: boolean
}

export function createMotion(
  viewportW: number,
  xRest: number,
  reduced = false
): MotionState {
  return {
    mode: reduced ? 'toy' : 'intro',
    x: reduced ? xRest : -viewportW * 0.28,
    xRest,
    speed: 0,
    boost: 0,
    effort: 0,
    grabbing: false,
    grabX: 0,
    grabY: 0,
    grabX0: 0,
    t: 0,
    reduced,
  }
}

export function beginGrab(m: MotionState, x: number, y: number): void {
  m.mode = 'toy'
  m.grabbing = true
  m.grabX = x
  m.grabY = y
  m.grabX0 = x
}

export function moveGrab(m: MotionState, x: number, y: number): void {
  if (!m.grabbing) return
  m.grabX = x
  m.grabY = y
}

export function endGrab(m: MotionState): void {
  m.grabbing = false
}

/** Keyboard: right = hurry forward, left = ease off. */
export function nudge(m: MotionState, dir: 1 | -1): void {
  m.mode = 'toy'
  m.boost += dir * CFG.motion.keyBoost
}

export interface MotionStepIn {
  /** mean leading-segment stretch from the chain (fistStretch) */
  stretch: number
  /** viewport width, for intro speed */
  viewportW: number
}

export function stepMotion(
  m: MotionState,
  dt: number,
  input: MotionStepIn
): void {
  const M = CFG.motion
  m.t += dt

  if (m.mode === 'intro') {
    const introSpeed = input.viewportW * M.introSpeedFrac
    m.x += introSpeed * dt
    m.speed = introSpeed
    if (m.x >= m.xRest) {
      m.x = m.xRest
      m.mode = 'toy'
      m.speed = M.cruise
    }
  } else {
    m.boost *= Math.exp(-M.boostDecay * dt)
    // a backward pull on the cloth brakes her; stretch beyond the idle load
    // (cloth weight + travel drag) is the honest signal
    const brake = Math.min(
      M.cruise * 1.1,
      Math.max(0, input.stretch - M.stretchIdle) * M.brakePerStretch
    )
    const target = m.reduced
      ? 0
      : Math.max(0, M.cruise + m.boost - brake)
    m.speed += (target - m.speed) * Math.min(1, M.speedK * dt)
  }

  const tension = Math.min(
    1.4,
    Math.max(0, input.stretch - M.stretchIdle * 0.5) / M.stretchRef
  )
  const deficit = m.reduced
    ? 0
    : Math.max(0, 1 - m.speed / M.cruise) * M.deficitGain
  const targetEffort = Math.min(1.2, tension + deficit * tension)
  const rate = targetEffort > m.effort ? M.effortRise : M.effortFall
  m.effort += (targetEffort - m.effort) * Math.min(1, rate * dt)
}
