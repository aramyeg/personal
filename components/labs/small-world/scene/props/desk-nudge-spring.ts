/**
 * THE ONE DAMPED OSCILLATOR the whole desk is built on.
 *
 * Extracted from `desk-nudge.ts` (T100) for a boring reason with a sharp edge: the pens' clatter
 * needs both this closed form AND the per-pen geometry that `desk-station.ts` measured, and
 * `desk-station.ts` already imports `desk-nudge.ts`. Leaving the machine where it was would have
 * made `desk-nudge → desk-pens → desk-nudge` a load-time cycle whose module-scope constants
 * evaluate against `undefined`. So the machine moved down here, under both, and `desk-nudge.ts`
 * re-exports it — every existing importer is unaffected, and there is still exactly one of it.
 */

export type SpringAxis = { x0: number; v0: number }

/**
 * Position and velocity of one axis at `tau` seconds after its initial conditions — the closed
 * form that makes the determinism clause cheap to keep: every signature on this desk is a pure
 * function of its trigger sequence, never an integration of frame deltas.
 */
export function sampleAxis(
  s: SpringAxis,
  omega: number,
  zeta: number,
  tau: number
): { x: number; v: number } {
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  const decay = Math.exp(-zeta * omega * tau)
  const b = (s.v0 + zeta * omega * s.x0) / wd
  const c = Math.cos(wd * tau)
  const sn = Math.sin(wd * tau)
  return {
    x: decay * (s.x0 * c + b * sn),
    v: decay * ((b * wd - zeta * omega * s.x0) * c - (s.x0 * wd + zeta * omega * b) * sn),
  }
}
