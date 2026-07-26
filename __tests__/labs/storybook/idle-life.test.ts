/**
 * IDLE LIFE gates (BW-2). idle-life.ts is the only motion in the book that is
 * not a function of the driving dihedral, so it is the only motion that can
 * break a law by accident. These tests gate the LAWS, not the arithmetic:
 * fold-flat supremacy, the amplitude budget, no lockstep, determinism, no
 * allocation, and — the one that will actually catch a future author — that no
 * tag in content.ts lands on a grab handle or on a family the renderer cannot
 * pose.
 */

import { describe, expect, it } from 'vitest'
import {
  IDLE_DETUNE,
  IDLE_DRIFT_MAX,
  IDLE_FORBIDDEN_MECHS,
  IDLE_GLINT_MAX,
  IDLE_HZ_FAST,
  IDLE_HZ_SLOW,
  IDLE_REST_DEG,
  IDLE_SUPPORTED_MECHS,
  IDLE_SWAY_MAX_DEG,
  idleGate,
  idleOffset,
  idlePeak,
  idleSeed,
  idleWave,
} from '@/components/labs/storybook/book/idle-life'
import {
  SPREAD_COUNT,
  heroForSpread,
  popupContentForSpread,
  type SceneLayer,
} from '@/components/labs/storybook/content'

const REST = (IDLE_REST_DEG * Math.PI) / 180
const SWAY_MAX_RAD = (IDLE_SWAY_MAX_DEG * Math.PI) / 180

/** Every tagged piece in the shipped book, spread by spread. */
const taggedLayers = (): readonly { spread: number; layer: SceneLayer }[] => {
  const out: { spread: number; layer: SceneLayer }[] = []
  for (let spread = 0; spread < SPREAD_COUNT; spread++) {
    const content = popupContentForSpread(spread)
    if (!content) continue
    for (const layer of content.layers) if (layer.idle) out.push({ spread, layer })
  }
  return out
}

/** 20 s at 60 fps — long enough that a single-frequency wave would have looped
 *  many times and a drifting/stateful implementation would have escaped. */
const SWEEP_SECONDS = 20
const SWEEP_STEP = 1 / 60

describe('idle life — fold-flat supremacy', () => {
  it('is EXACTLY zero at book close for every kind and every tagged piece', () => {
    for (const { layer } of taggedLayers()) {
      const seed = idleSeed(layer.id)
      const peak = idlePeak(layer.idle!.kind, layer.idle!.amp)
      for (let t = 0; t < 4; t += 0.137) {
        expect(idleOffset(peak, seed, t, 0, false)).toBe(0)
      }
    }
  })

  it('gates to exactly zero at beta = 0 and below (a closed or over-closed book)', () => {
    expect(idleGate(0, false)).toBe(0)
    expect(idleGate(-0.5, false)).toBe(0)
  })

  it('is EXACTLY zero while a turn is in flight, at any openness', () => {
    const seed = idleSeed('ch2-bee-a')
    const peak = idlePeak('sway', undefined)
    for (let beta = 0; beta <= REST; beta += REST / 24) {
      for (let t = 0; t < 3; t += 0.31) {
        expect(idleOffset(peak, seed, t, beta, true)).toBe(0)
        expect(idleGate(beta, true)).toBe(0)
      }
    }
  })

  it('reaches full amplitude only at the open rest pose, and rises monotonically', () => {
    expect(idleGate(REST, false)).toBeCloseTo(1, 6)
    let previous = -1
    for (let beta = 0; beta <= REST; beta += REST / 64) {
      const gate = idleGate(beta, false)
      expect(gate).toBeGreaterThanOrEqual(previous)
      expect(gate).toBeLessThanOrEqual(1)
      previous = gate
    }
  })
})

describe('idle life — amplitude budget', () => {
  it('keeps every kind inside its ceiling across a 20 s sweep at full openness', () => {
    const ceilings: Readonly<Record<string, number>> = {
      sway: SWAY_MAX_RAD,
      drift: IDLE_DRIFT_MAX,
      glint: IDLE_GLINT_MAX,
    }
    for (const kind of ['sway', 'drift', 'glint'] as const) {
      const peak = idlePeak(kind, undefined)
      const seed = idleSeed(`budget-${kind}`)
      let worst = 0
      for (let t = 0; t <= SWEEP_SECONDS; t += SWEEP_STEP) {
        worst = Math.max(worst, Math.abs(idleOffset(peak, seed, t, REST, false)))
      }
      expect(worst).toBeLessThanOrEqual(ceilings[kind])
      // ...and it must actually MOVE: a budget met by doing nothing is the
      // defect this whole module exists to fix.
      expect(worst).toBeGreaterThan(0.5 * peak)
    }
  })

  it('clamps an over-eager authored amp to the ceiling instead of trusting it', () => {
    expect(idlePeak('sway', 99)).toBeCloseTo(SWAY_MAX_RAD, 12)
    expect(idlePeak('drift', 99)).toBe(IDLE_DRIFT_MAX)
    expect(idlePeak('glint', 99)).toBe(IDLE_GLINT_MAX)
    expect(idlePeak('sway', 0)).toBe(0)
    expect(idlePeak('sway', -5)).toBe(0)
  })

  it('every shipped tag is inside the budget as authored', () => {
    for (const { layer } of taggedLayers()) {
      const tag = layer.idle!
      const peak = idlePeak(tag.kind, tag.amp)
      const ceiling =
        tag.kind === 'sway' ? SWAY_MAX_RAD : tag.kind === 'drift' ? IDLE_DRIFT_MAX : IDLE_GLINT_MAX
      expect(peak).toBeGreaterThan(0)
      expect(peak).toBeLessThanOrEqual(ceiling)
    }
  })

  it('breathes in the 0.15-0.6 Hz band with two incommensurate terms', () => {
    // Both terms, at either extreme of the per-piece detune.
    for (const hz of [IDLE_HZ_SLOW, IDLE_HZ_FAST]) {
      expect(hz * (1 - IDLE_DETUNE)).toBeGreaterThanOrEqual(0.15)
      expect(hz * (1 + IDLE_DETUNE)).toBeLessThanOrEqual(0.6)
    }
    // A single-frequency wave would repeat exactly one slow period later. The
    // second term must break that, or a parked reader watches a metronome.
    const seed = idleSeed('ch1-sign')
    const period = 1 / IDLE_HZ_SLOW
    let maxLoopError = 0
    for (let t = 0; t < period; t += SWEEP_STEP) {
      maxLoopError = Math.max(maxLoopError, Math.abs(idleWave(seed, t) - idleWave(seed, t + period)))
    }
    expect(maxLoopError).toBeGreaterThan(0.2)
  })
})

describe('idle life — determinism and phase scatter', () => {
  it('gives the same value for the same (id, time), always', () => {
    for (const id of ['ch1-sign', 'ch2-bee-a', 'end-raven']) {
      const seed = idleSeed(id)
      expect(idleSeed(id)).toBe(seed)
      for (let t = 0; t < 5; t += 0.7) {
        const first = idleOffset(idlePeak('sway', undefined), seed, t, REST, false)
        const second = idleOffset(idlePeak('sway', undefined), idleSeed(id), t, REST, false)
        expect(second).toBe(first)
      }
    }
  })

  it('never lets two shipped tags move in lockstep', () => {
    const tagged = taggedLayers()
    expect(tagged.length).toBeGreaterThanOrEqual(8)
    // The weakest pair in the whole book, reported by name: separation is the
    // largest gap the two waves ever open over a 20 s watch, as a fraction of
    // full scale. A pair that stays under a fifth of scale is two pieces moving
    // as one, which is what the reader notices first.
    let worstPair = ''
    let worstSeparation = Number.POSITIVE_INFINITY
    for (let i = 0; i < tagged.length; i++) {
      for (let j = i + 1; j < tagged.length; j++) {
        const a = idleSeed(tagged[i].layer.id)
        const b = idleSeed(tagged[j].layer.id)
        expect(a).not.toBe(b)
        let separation = 0
        for (let t = 0; t <= SWEEP_SECONDS; t += SWEEP_STEP) {
          separation = Math.max(separation, Math.abs(idleWave(a, t) - idleWave(b, t)))
        }
        if (separation < worstSeparation) {
          worstSeparation = separation
          worstPair = `${tagged[i].layer.id} / ${tagged[j].layer.id}`
        }
      }
    }
    expect(worstSeparation, `weakest pair: ${worstPair}`).toBeGreaterThan(0.2)
  })

  it('stays bounded and finite over a long session (no integration, no drift)', () => {
    const seed = idleSeed('ch5-pigeon-b')
    for (let t = 0; t < 6 * 60 * 60; t += 37.13) {
      const wave = idleWave(seed, t)
      expect(Number.isFinite(wave)).toBe(true)
      expect(Math.abs(wave)).toBeLessThanOrEqual(1)
    }
  })
})

describe('idle life — zero allocation in the hot path', () => {
  it('takes only scalars and returns a single number', () => {
    expect(typeof idleWave(1, 1)).toBe('number')
    expect(typeof idleGate(1, false)).toBe('number')
    expect(typeof idleOffset(1, 1, 1, 1, false)).toBe('number')
    // Arity is fixed and positional: no options bag to build per frame.
    expect(idleWave.length).toBe(2)
    expect(idleGate.length).toBe(2)
    expect(idleOffset.length).toBe(5)
  })

  it('allocates nothing per call — no constructors, no array iteration', () => {
    for (const fn of [idleWave, idleGate, idleOffset]) {
      const source = fn.toString()
      expect(source).not.toMatch(/new\s/)
      expect(source).not.toMatch(/\.map\(|\.filter\(|\.slice\(|\.concat\(/)
    }
  })
})

describe('idle life — where tags are allowed to land', () => {
  it('never tags a grab-handle family', () => {
    for (const { spread, layer } of taggedLayers()) {
      expect(
        IDLE_FORBIDDEN_MECHS.includes(layer.mech),
        `spread ${spread}: ${layer.id} is a ${layer.mech} handle`
      ).toBe(false)
    }
  })

  it('only tags families the generic two-quad renderer actually poses', () => {
    for (const { spread, layer } of taggedLayers()) {
      expect(
        IDLE_SUPPORTED_MECHS.includes(layer.mech),
        `spread ${spread}: ${layer.id} is a ${layer.mech}, which popup-spread.tsx routes elsewhere`
      ).toBe(true)
    }
  })

  it('never tags a spread hero or a backdrop-role sheet', () => {
    // A hero is the spread's signature MOTION (hero-wow.test.ts measures its
    // sweep) and a backdrop-role sheet is the architecture behind everything —
    // both must be dead still when the reader is.
    for (const { spread, layer } of taggedLayers()) {
      expect(layer.id, `spread ${spread}: the hero must not tremble`).not.toBe(heroForSpread(spread))
      expect(layer.role, `spread ${spread}: ${layer.id} is a backdrop sheet`).not.toBe('backdrop')
    }
  })

  it('spreads no more than three tags, and never a bare one', () => {
    const perSpread = new Map<number, number>()
    for (const { spread, layer } of taggedLayers()) {
      perSpread.set(spread, (perSpread.get(spread) ?? 0) + 1)
      expect(['sway', 'glint', 'drift']).toContain(layer.idle!.kind)
    }
    for (const [spread, count] of perSpread) {
      expect(count, `spread ${spread} carries ${count} idle tags`).toBeLessThanOrEqual(3)
    }
    // At least half the book's spreads must have some life, or BW-2 is not fixed.
    expect(perSpread.size).toBeGreaterThanOrEqual(5)
  })
})
