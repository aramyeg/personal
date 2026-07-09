import type { Skill } from '@/types'

export type TrickInput = {
  /** total rotation in degrees — multiples of 180 */
  rotationDeg: number
  grab: boolean
  /** world units grinded; 0 when none */
  grindLength: number
  /** rotation finished just before touchdown — earns the land-it-late bonus */
  late: boolean
}

export const BASE_TRICK = 100
export const PER_180 = 150
export const GRAB_BONUS = 120
export const GRIND_PER_UNIT = 2
export const CHAIN_STEP = 0.25
export const LATE_BONUS = 1.5

export function trickName(t: TrickInput): string {
  const parts: string[] = []
  if (t.rotationDeg > 0) parts.push(String(t.rotationDeg))
  if (t.grab) parts.push('Nose Grab')
  if (t.grindLength > 0) parts.push(parts.length > 0 ? '+ Grind' : 'Grind')
  return parts.length > 0 ? parts.join(' ') : 'Ollie'
}

export function trickScore(t: TrickInput, years: number, chain: number): number {
  const raw =
    BASE_TRICK +
    (t.rotationDeg / 180) * PER_180 +
    (t.grab ? GRAB_BONUS : 0) +
    t.grindLength * GRIND_PER_UNIT
  const multiplier = (1 + CHAIN_STEP * chain) * (t.late ? LATE_BONUS : 1)
  return Math.round(raw * years * multiplier)
}

/** Spec trick-card format: `360 Nose Grab — TypeScript · 6 yrs · expert` */
export function collectLine(name: string, skill: Skill): string {
  return `${name} — ${skill.name} · ${skill.years} yrs · ${skill.level}`
}
