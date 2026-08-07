/**
 * Haul drive: hauled distance h in px, from 0 (banner off-screen right) to
 * hRest (banner centered). Autonomous intro, 1:1 pointer drag, spring-settle
 * release, flick momentum, idle inviting tugs, keyboard nudges. Everything
 * routes through second-order dynamics — no state ever teleports.
 *
 * Pure module: time is stepped by the caller, never read from a clock.
 */

import { CFG } from './config'

export type DriveMode = 'intro' | 'toy'

export interface DriveState {
  mode: DriveMode
  /** hauled distance, px */
  h: number
  /** haul velocity, px/s */
  v: number
  /** smoothed 0..~1.2 effort the chibi displays */
  effort: number
  /** rest target the release spring settles to */
  hRest: number
  /** soft range [min, max] for h */
  hMin: number
  hMax: number
  introT: number
  dragging: boolean
  dragH0: number
  dragX0: number
  /** pointer velocity estimate while dragging, px/s */
  dragV: number
  /** seconds since the user last interacted */
  idleT: number
  /** cadence timer for the inviting tug */
  tugT: number
  /** prefers-reduced-motion: no intro, no autonomous tugs */
  reduced: boolean
}

export function createDrive(
  viewportW: number,
  reduced = false,
  hRestOverride?: number
): DriveState {
  const D = CFG.drive
  const hRest = hRestOverride ?? viewportW * D.introFrac
  return {
    mode: reduced ? 'toy' : 'intro',
    h: reduced ? hRest : 0,
    v: 0,
    effort: 0,
    hRest,
    hMin: hRest - viewportW * D.underhaulFrac,
    hMax: hRest + viewportW * D.overhaulFrac,
    introT: 0,
    dragging: false,
    dragH0: 0,
    dragX0: 0,
    dragV: 0,
    idleT: 0,
    tugT: D.tugPeriod * 0.55,
    reduced,
  }
}

/** d(smoothstep)/dt for the intro's base ease. */
function dSmoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return 6 * c * (1 - c)
}

export function beginDrag(d: DriveState, pointerX: number): void {
  d.mode = 'toy'
  d.dragging = true
  d.dragH0 = d.h
  d.dragX0 = pointerX
  d.dragV = 0
  d.idleT = 0
}

/** Dragging left (negative dx) hauls the line in. 1:1 while held. */
export function moveDrag(d: DriveState, pointerX: number, dt: number): void {
  if (!d.dragging) return
  const target = d.dragH0 + (d.dragX0 - pointerX)
  const clamped = Math.max(d.hMin, Math.min(d.hMax, target))
  if (dt > 0) {
    const v = (clamped - d.h) / dt
    d.dragV = d.dragV * 0.7 + v * 0.3
  }
  d.v = d.dragV
  d.h = clamped
  d.idleT = 0
}

export function endDrag(d: DriveState): void {
  if (!d.dragging) return
  d.dragging = false
  d.v =
    Math.abs(d.dragV) > CFG.drive.flickVel
      ? d.dragV
      : d.dragV * 0.35
  d.idleT = 0
}

/** Keyboard nudge: dir +1 hauls in, -1 pays out. */
export function nudge(d: DriveState, dir: 1 | -1): void {
  d.mode = 'toy'
  d.v += dir * CFG.drive.keyStep * 6
  d.idleT = 0
}

export interface DriveStepOut {
  /** true on the frames the idle tug fires (chibi should visibly tug) */
  tugged: boolean
}

export function stepDrive(d: DriveState, dt: number): DriveStepOut {
  const D = CFG.drive
  let tugged = false

  if (d.mode === 'intro') {
    d.introT += dt
    const t = d.introT / D.introDuration
    const strokeHz = 1.35
    const base = (d.hRest * dSmoothstep(t)) / D.introDuration
    d.v = base * (1 + 0.5 * Math.sin(2 * Math.PI * strokeHz * d.introT))
    d.h += d.v * dt
    if (t >= 1) {
      d.mode = 'toy'
      d.v = Math.max(0, (d.hRest - d.h) * 2)
    }
  } else if (d.dragging) {
    // a held-but-still hand isn't hauling: let the felt velocity bleed off
    d.v *= Math.exp(-4 * dt)
    d.dragV = d.v
  } else {
    const acc = -D.springK * (d.h - d.hRest) - D.springDamp * d.v
    d.v += acc * dt
    d.h += d.v * dt
    if (d.h < d.hMin) {
      d.h = d.hMin
      d.v *= -0.35
    } else if (d.h > d.hMax) {
      d.h = d.hMax
      d.v *= -0.35
    }

    d.idleT += dt
    const settled =
      !d.reduced && Math.abs(d.h - d.hRest) < 6 && Math.abs(d.v) < 12
    if (settled && d.idleT > D.tugPeriod * 0.5) {
      d.tugT += dt
      if (d.tugT >= D.tugPeriod) {
        d.tugT = 0
        d.v += D.tugImpulse
        tugged = true
      }
    }
  }

  const target = Math.min(1.2, Math.abs(d.v) / D.effortVelRef)
  const rate = target > d.effort ? D.effortRise : D.effortFall
  d.effort += (target - d.effort) * Math.min(1, rate * dt)

  return { tugged }
}

/** Rope tension derived from what the hand is doing. */
export function driveTension(d: DriveState): number {
  const pull = Math.max(0, d.effort)
  const hold = d.dragging ? 0.35 : 0
  return Math.min(1.3, pull + hold)
}
