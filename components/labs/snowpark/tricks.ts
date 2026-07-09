import type { Skill } from '@/types'

/** Which way (if any) the trailing arm reached: nose (toward the board's front)
 * or tail (back over the board's rear). */
export type Grab = 'none' | 'nose' | 'tail'

export type TrickInput = {
  /** board pitch in degrees — the flip, a multiple of 180 (180 lands switch) */
  flipDeg: number
  /** flat spin in degrees — a multiple of 360 when it lands clean */
  spinDeg: number
  grab: Grab
  /** world units grinded; 0 when none */
  grindLength: number
  /** rotation finished just before touchdown — earns the land-it-late bonus */
  late: boolean
}

export const BASE_TRICK = 100
/** a flip pays per half-turn (a full 360 backflip is two of these) */
export const PER_180 = 150
/** a spin pays per full 360 */
export const PER_360 = 180
export const GRAB_BONUS = 120
export const GRIND_PER_UNIT = 2
export const CHAIN_STEP = 0.25
export const LATE_BONUS = 1.5

/** Backflips off the pitch: a full 360 is one Backflip; a bare 180 lands switch. */
function flipName(flipDeg: number): string {
  const halfTurns = Math.round(Math.abs(flipDeg) / 180)
  if (halfTurns === 0) return ''
  const fulls = Math.floor(halfTurns / 2)
  if (fulls === 0) return '180' // a lone half-flip lands switch
  const FULLS = ['', 'Backflip', 'Double Backflip', 'Triple Backflip']
  const base = FULLS[fulls] ?? `${fulls}x Backflip`
  return halfTurns % 2 === 1 ? `${base} 180` : base
}

/** Flat spins name themselves by their degrees: 360, 720, ... */
function spinName(spinDeg: number): string {
  const turns = Math.round(Math.abs(spinDeg) / 360)
  return turns > 0 ? String(turns * 360) : ''
}

function grabName(grab: Grab): string {
  return grab === 'nose' ? 'Nose Grab' : grab === 'tail' ? 'Tail Grab' : ''
}

/** Compose the trick line: flip, then spin, then grab, then a grind suffix —
 * absent components drop out; a bare air is an Ollie. */
export function trickName(t: TrickInput): string {
  const parts = [flipName(t.flipDeg), spinName(t.spinDeg), grabName(t.grab)].filter(Boolean)
  if (t.grindLength > 0) parts.push(parts.length > 0 ? '+ Grind' : 'Grind')
  return parts.length > 0 ? parts.join(' ') : 'Ollie'
}

export function trickScore(t: TrickInput, years: number, chain: number): number {
  const raw =
    BASE_TRICK +
    (Math.abs(t.flipDeg) / 180) * PER_180 +
    (Math.abs(t.spinDeg) / 360) * PER_360 +
    (t.grab !== 'none' ? GRAB_BONUS : 0) +
    t.grindLength * GRIND_PER_UNIT
  const multiplier = (1 + CHAIN_STEP * chain) * (t.late ? LATE_BONUS : 1)
  return Math.round(raw * years * multiplier)
}

/** Spec trick-card format: `360 Nose Grab — TypeScript · 6 yrs · expert` */
export function collectLine(name: string, skill: Skill): string {
  return `${name} — ${skill.name} · ${skill.years} yrs · ${skill.level}`
}
