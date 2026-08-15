import { describe, expect, it } from 'vitest'
import {
  spreadPageAnglesTilted,
  stageTurnT,
  type TurnStage,
} from '@/components/labs/storybook/book/popup-mechanics'
import { CHAPTERS } from '@/components/labs/storybook/content'

/**
 * E4 §1a — PER-LAYER TURN STAGING.
 *
 * The whole lane rests on one property: a stage window changes WHEN a piece
 * moves, never WHERE it ends up. If that fails, fold-flat at book-closed and
 * the rest pose at book-open both fail with it, and a staged piece either
 * pokes out of a shut book or snaps on arrival. So these are invariant tests,
 * not literals: they sweep windows and clocks and assert the endpoints are
 * EXACTLY (Object.is) the un-staged ones.
 */

/** Every window a piece may legally declare — the identity below is only true
 *  for windows inside [0, 1] (see the guard test at the bottom). */
const WINDOWS: readonly TurnStage[] = [
  { t0: 0, t1: 1 },
  { t0: 0, t1: 0.4 },
  { t0: 0.12, t1: 0.4 },
  { t0: 0.28, t1: 0.6 },
  { t0: 0.46, t1: 0.76 },
  { t0: 0.54, t1: 0.84 },
  { t0: 0.72, t1: 0.98 },
  { t0: 0.6, t1: 1 },
  { t0: 0.499, t1: 0.5 },
]

const GRID = Array.from({ length: 41 }, (_, i) => i / 40)

describe('stageTurnT', () => {
  it('pins both endpoints exactly, for every window', () => {
    for (const w of WINDOWS) {
      expect(stageTurnT(0, w)).toBe(0)
      expect(stageTurnT(1, w)).toBe(1)
    }
  })

  it('is the identity when unstaged or degenerate', () => {
    const degenerate: readonly (TurnStage | undefined)[] = [
      undefined,
      { t0: 0.5, t1: 0.5 },
      { t0: 0.8, t1: 0.2 },
    ]
    for (const w of degenerate) {
      for (const t of GRID) expect(stageTurnT(t, w)).toBe(t)
    }
  })

  it('runs the whole travel inside the window and holds outside it', () => {
    const w = { t0: 0.25, t1: 0.75 }
    expect(stageTurnT(0.2, w)).toBe(0)
    expect(stageTurnT(0.25, w)).toBe(0)
    expect(stageTurnT(0.5, w)).toBeCloseTo(0.5, 12)
    expect(stageTurnT(0.75, w)).toBe(1)
    expect(stageTurnT(0.9, w)).toBe(1)
  })

  it('is monotone non-decreasing', () => {
    for (const w of WINDOWS) {
      let prev = -Infinity
      for (const t of GRID) {
        const v = stageTurnT(t, w)
        expect(v).toBeGreaterThanOrEqual(prev)
        prev = v
      }
    }
  })
})

describe('spreadPageAnglesTilted with a stage', () => {
  const SPREADS = [2, 3, 5]
  const DIRS = ['next', 'prev'] as const

  it('is bit-identical to the un-staged call when no window is given', () => {
    for (const s of SPREADS) {
      for (const dir of DIRS) {
        for (const idx of [s - 1, s, s + 1]) {
          for (const t of GRID) {
            const bare = spreadPageAnglesTilted(idx, s, dir, t)
            expect(spreadPageAnglesTilted(idx, s, dir, t, undefined)).toEqual(bare)
          }
        }
      }
    }
  })

  it('lands on the same two endpoint poses as the un-staged turn — both directions', () => {
    // BOTH directions matter: 'prev' is the book CLOSING / the reader turning
    // back, and a staged piece must DE-erect over its window rather than snap.
    for (const s of SPREADS) {
      for (const dir of DIRS) {
        for (const idx of [s - 1, s, s + 1]) {
          for (const w of WINDOWS) {
            for (const t of [0, 1]) {
              expect(spreadPageAnglesTilted(idx, s, dir, t, w)).toEqual(
                spreadPageAnglesTilted(idx, s, dir, t)
              )
            }
          }
        }
      }
    }
  })

  it('never snaps: the staged sweep is continuous and monotone in beta, both directions', () => {
    const w = { t0: 0.46, t1: 0.76 }
    for (const s of SPREADS) {
      for (const dir of DIRS) {
        for (const idx of [s, s + 1, s - 1]) {
          const betas = GRID.map((t) => {
            const a = spreadPageAnglesTilted(idx, s, dir, t, w)
            return a.thetaL - a.thetaR
          })
          const steps = betas.slice(1).map((b, i) => b - betas[i])
          const sign = Math.sign(steps.reduce((acc, x) => acc + x, 0))
          for (const st of steps) {
            // monotone (allowing exactly-flat holds outside the window)
            expect(Math.sign(st) === 0 || Math.sign(st) === sign || sign === 0).toBe(true)
            // and bounded: the whole travel is compressed into the window, so a
            // step can be at most (1 / windowWidth) times a whole-turn step.
            expect(Math.abs(st)).toBeLessThan((Math.PI / GRID.length) / (w.t1 - w.t0) + 1e-9)
          }
        }
      }
    }
  })

  it('holds a piece flat before its window and erect after it', () => {
    const late = { t0: 0.72, t1: 0.98 }
    const s = 2
    // the INCOMING page of a 'next' turn is the one that erects
    const at = (t: number) => {
      const a = spreadPageAnglesTilted(s + 1, s, 'next', t, late)
      return a.thetaL - a.thetaR
    }
    const start = at(0)
    expect(at(0.5)).toBeCloseTo(start, 12)
    expect(at(0.72)).toBeCloseTo(start, 12)
    expect(at(0.98)).toBeCloseTo(at(1), 12)
  })
})

describe('declared stage windows', () => {
  it('every layer window lies inside [0, 1] — the endpoint identity depends on it', () => {
    for (const chapter of CHAPTERS) {
      for (const layer of chapter.layers) {
        const stage = layer.stage
        if (!stage) continue
        expect(stage.t0, `${layer.id} t0`).toBeGreaterThanOrEqual(0)
        expect(stage.t1, `${layer.id} t1`).toBeLessThanOrEqual(1)
        expect(stage.t0, `${layer.id} window`).toBeLessThan(stage.t1)
      }
    }
  })
})
