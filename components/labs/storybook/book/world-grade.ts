/**
 * WORLD DUSK — a one-value frame channel from the courtyard dissolve to the
 * rest of its spread (E4 judge round: "make the pull change the WORLD").
 *
 * The ch1 dissolve's tau drives a spread-wide nightfall: the page print (sky
 * and courtyard, both halves) and the yard-wall wings sink toward night while
 * the keepstack inn keeps its full painted brightness — night falls, and the
 * hundred-lamp inn becomes the one glowing thing on the page. Windows read as
 * "brightening" by pure relative contrast; no texture is swapped.
 *
 * Shape of the thing (deliberately not zustand): consumers read it inside
 * useFrame, and a store write per frame is exactly what user-drive.ts exists
 * to avoid. Same pattern, one slot.
 *
 * OWNERSHIP + STALENESS. The value carries the writer's spread index, and
 * readers pass their own — a latched dusk on spread 2 must never tint spread
 * 3's page after a turn. And because the writer is a mounted layer's frame
 * loop (which stops when the spread scrolls out of the ±1 warm window), a
 * reader also ignores values older than a few frames rather than trusting a
 * corpse. Both guards fail toward "no tint", which is the correct failure.
 */

type WorldDusk = { spread: number; w: number; at: number }

const STALE_MS = 250

let current: WorldDusk | null = null

/** Writer: the dissolve layer, every frame, with its shown (envelope-carried)
 *  flip fraction 0..1. Writing 0 is meaningful — it clears the grade. */
export function writeWorldDusk(spread: number, w: number): void {
  current = { spread, w: Math.min(1, Math.max(0, w)), at: performance.now() }
}

/** Reader: any material owner on the SAME spread, inside useFrame. */
export function readWorldDusk(spread: number): number {
  if (!current) return 0
  if (current.spread !== spread) return 0
  if (performance.now() - current.at > STALE_MS) return 0
  return current.w
}
