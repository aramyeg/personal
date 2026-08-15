import { afterEach, describe, expect, it } from 'vitest'
import {
  spreadPageAnglesTilted,
  stageTurnT,
  stripFlapHoldEnvelope,
  stripFlapTravel,
  type DissolveGeom,
  type StripFlapGeom,
  type TurnStage,
} from '@/components/labs/storybook/book/popup-mechanics'
import {
  driveChannelDomain,
  readChannelUnit,
  readDrivePhase,
} from '@/components/labs/storybook/book/drive-phase'
import { resetUserDrives, writeUserDrive } from '@/components/labs/storybook/user-drive'
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

/**
 * E4 §2d — ONE READER INPUT, SEVERAL STAGGERED OUTPUTS.
 *
 * The failure this guards against is a units failure: the drive store keeps
 * each family's OWN domain, so a follower that assumed 0..1 would read a
 * half-flipped dissolve (tau = PI/2) as "157% pulled" and sit pinned at its
 * stop for the reader's whole stroke.
 */
describe('driveFrom — a follower riding another piece\'s channel', () => {
  afterEach(() => resetUserDrives())

  const SOURCE: DissolveGeom = {
    mech: 'dissolve',
    side: 'right',
    d0: 0.2,
    d1: 0.8,
    z0: -0.2,
    z1: 0.2,
    slats: 9,
  }
  const FOLLOWER: StripFlapGeom = {
    mech: 'stripflap',
    side: 'right',
    anchor: 0.4,
    anchorZ: 0,
    slot: 0.4,
    slotZ: 0,
    hingeX: 0.45,
    hingeZ: 0.1,
    hingeDeg: 30,
    width: 0.3,
    height: 0.22,
    travelDeg: [34, 86],
  }
  const PHASE = [0, 0.55] as const

  it('normalises the source by ITS OWN domain, not by an assumed 0..1', () => {
    expect(driveChannelDomain(SOURCE)).toEqual([0, Math.PI])
    writeUserDrive('src', Math.PI / 2)
    expect(readChannelUnit(SOURCE, 'src')).toBeCloseTo(0.5, 12)
    writeUserDrive('src', Math.PI)
    expect(readChannelUnit(SOURCE, 'src')).toBe(1)
    // the naive read of the same number would have been 3.14, i.e. pinned
    expect(readChannelUnit(SOURCE, 'src')).not.toBeCloseTo(Math.PI, 3)
  })

  it('reads 0 when the reader has not touched the source yet', () => {
    expect(readChannelUnit(SOURCE, 'src')).toBe(0)
    expect(readDrivePhase({ channel: 'src', phase: PHASE }, SOURCE)).toBe(0)
  })

  it('completes its travel over the phase window and holds after it', () => {
    const at = (tau: number) => {
      writeUserDrive('src', tau)
      return readDrivePhase({ channel: 'src', phase: PHASE }, SOURCE)
    }
    expect(at(0)).toBe(0)
    expect(at(Math.PI * 0.275)).toBeCloseTo(0.5, 12)
    expect(at(Math.PI * 0.55)).toBe(1)
    expect(at(Math.PI * 0.8)).toBe(1)
    expect(at(Math.PI)).toBe(1)
  })

  it('staggers: two followers on one channel peak at different points', () => {
    const early = { channel: 'src', phase: [0, 0.55] as const }
    const late = { channel: 'src', phase: [0.4, 1] as const }
    writeUserDrive('src', Math.PI * 0.3)
    // a third of the way in, the early piece is most of the way through its
    // travel and the late one has not started — that IS the double action
    expect(readDrivePhase(early, SOURCE)).toBeGreaterThan(0.5)
    expect(readDrivePhase(late, SOURCE)).toBe(0)
    writeUserDrive('src', Math.PI * 0.7)
    expect(readDrivePhase(early, SOURCE)).toBe(1)
    expect(readDrivePhase(late, SOURCE)).toBeGreaterThan(0)
  })

  it('keeps the shipped visibility stops, and folds flat at book close', () => {
    // The layer composes shown = (travel0 + q * span) * E(beta); reproduced
    // here so the composition law is gated, not just the phase map.
    const travel = stripFlapTravel(FOLLOWER)
    const shown = (q: number, beta: number) =>
      (travel[0] + q * (travel[1] - travel[0])) * stripFlapHoldEnvelope(FOLLOWER, beta)
    const rest = (176 * Math.PI) / 180
    // the >32deg screen-up crossing (StripFlapGeom.travelDeg) survives at q = 0
    expect((shown(0, rest) * 180) / Math.PI).toBeGreaterThan(32)
    // ...and the piece never exceeds its own ceiling
    expect(shown(1, rest)).toBeLessThanOrEqual(travel[1] + 1e-12)
    // fold-flat: E(0) = 0 kills ANY driven angle, which is the whole reason the
    // universal composition rule is multiplicative
    for (const q of [0, 0.5, 1]) expect(shown(q, 0)).toBe(0)
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

  it('every driveFrom names a real layer on its own spread, with a sane phase', () => {
    for (const chapter of CHAPTERS) {
      for (const layer of chapter.layers) {
        const link = layer.driveFrom
        if (!link) continue
        const source = chapter.layers.find((l) => l.id === link.channel)
        expect(source, `${layer.id} -> ${link.channel}`).toBeDefined()
        expect(source?.id, `${layer.id} drives itself`).not.toBe(layer.id)
        expect(link.phase[0], `${layer.id} phase lo`).toBeGreaterThanOrEqual(0)
        expect(link.phase[1], `${layer.id} phase hi`).toBeLessThanOrEqual(1)
        expect(link.phase[0], `${layer.id} phase`).toBeLessThan(link.phase[1])
      }
    }
  })
})
