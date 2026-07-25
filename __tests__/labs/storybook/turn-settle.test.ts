import { describe, expect, it } from 'vitest'
import { easeTurnWeighted } from '@/components/labs/storybook/book/page-geometry'
import {
  COVER_MS,
  SETTLE_MS,
  TURN_MS,
  settleProgress,
  turnPublishedT,
} from '@/components/labs/storybook/book/use-turn-driver'

// The landing settle (M2): the main sweep stops half a degree of dihedral
// short of rest and an exponential tail relaxes into it before the commit.
// The driver publishes the whole composite through the one raw `t` its
// consumers run back through easeTurnWeighted, so what has to hold is the
// shape of that composite — continuity, monotonicity, and a commit residual
// far inside the already-accepted hand-off air. Reference numbers are the
// design bench .superpowers/sdd/bench/e3sys-settle.mjs.

const REST_BETA = (176 * Math.PI) / 180
const FRAME_MS = 1000 / 60
/** Steepest per-frame vertex step any shipped gearing may take (the motion
 *  character covenant's GLOBAL_CAP, __tests__/.../motion-character.test.ts). */
const GLOBAL_CAP = 0.0497

describe('turn landing settle', () => {
  it('runs a 250ms tail past the main sweep', () => {
    expect(SETTLE_MS).toBe(250)
  })

  it('the main sweep lands half a degree of dihedral short of rest', () => {
    const deficitDeg = (1 - settleProgress(TURN_MS, TURN_MS)) * 176
    expect(deficitDeg).toBeCloseTo(0.5, 9)
  })

  it('is continuous across the sweep/settle junction', () => {
    const left = settleProgress(TURN_MS, TURN_MS)
    const right = settleProgress(TURN_MS + 1e-9, TURN_MS)
    expect(Math.abs(left - right)).toBeLessThan(1e-12)
  })

  it('is monotone over the whole extended clock, both durations', () => {
    for (const duration of [TURN_MS, COVER_MS]) {
      let prev = -1
      for (let ms = 0; ms <= duration + SETTLE_MS; ms++) {
        const e = settleProgress(ms, duration)
        expect(e).toBeGreaterThanOrEqual(prev - 1e-15)
        prev = e
      }
    }
  })

  it('leaves a commit snap far inside the accepted hand-off residual', () => {
    // The rest hand-off already carries ~0.5deg of visible air
    // (page-geometry.ts's bulge note); the settle's leftover must be a small
    // fraction of it to be invisible by that same precedent.
    const residualDeg = (1 - settleProgress(TURN_MS + SETTLE_MS, TURN_MS)) * 176
    expect(residualDeg).toBeLessThan(0.03)
  })

  it('never exceeds the global per-frame motion cap during the tail', () => {
    let worst = 0
    for (let ms = TURN_MS - FRAME_MS; ms < TURN_MS + SETTLE_MS; ms += FRAME_MS) {
      const step = (settleProgress(ms + FRAME_MS, TURN_MS) - settleProgress(ms, TURN_MS)) * REST_BETA
      worst = Math.max(worst, Math.abs(step))
    }
    expect(worst).toBeLessThan(GLOBAL_CAP)
  })

  it('publishes a raw t that recovers the composite through the shared ease', () => {
    for (let ms = 0; ms <= TURN_MS + SETTLE_MS; ms += 5) {
      const t = turnPublishedT(ms, TURN_MS)
      expect(t).toBeGreaterThanOrEqual(0)
      expect(t).toBeLessThanOrEqual(1)
      expect(easeTurnWeighted(t)).toBeCloseTo(settleProgress(ms, TURN_MS), 12)
    }
  })

  it('publishes raw t well below 1 at landing — no consumer may key off raw t', () => {
    // The quint is so flat near 1 that the whole tail lives in t 0.82..0.91.
    // turning-page's traveling shade is geared to the eased value for exactly
    // this reason; a raw-t consumer would never reach its endpoint.
    expect(turnPublishedT(TURN_MS, TURN_MS)).toBeCloseTo(0.8222, 3)
    expect(turnPublishedT(TURN_MS + SETTLE_MS, TURN_MS)).toBeCloseTo(0.9048, 3)
  })

  it('starts at rest and reaches the sweep midpoint on the raw half-time', () => {
    expect(turnPublishedT(0, TURN_MS)).toBe(0)
    expect(settleProgress(TURN_MS / 2, TURN_MS)).toBeCloseTo(0.5 * (1 - 0.5 / 176), 9)
  })
})
