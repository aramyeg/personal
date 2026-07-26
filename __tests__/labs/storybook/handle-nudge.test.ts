/**
 * TAP ANSWERS (BW-18) — the law, gated.
 *
 * All five blind readers clicked before they dragged, got nothing, and wrote
 * the spread off as a static illustration. A press that does not drag now
 * answers with a small physical excursion of the piece. These tests hold the
 * three properties that make that excursion legal paper rather than a UI
 * animation, and prove the excursion actually reaches the SOLVERS — a nudge
 * that produced no vertex motion would be the same defect wearing a new hat.
 */

import { describe, expect, it, beforeEach } from 'vitest'
import {
  NUDGE_MS,
  NUDGE_SPAN_ANGLE,
  NUDGE_SPAN_STROKE_FRAC,
  clearNudgePulse,
  nudgeOffset,
  nudgeShape,
  pulseHandle,
  readNudgePulse,
} from '@/components/labs/storybook/book/handle-nudge'
import {
  liftFlapDoorQuad,
  liftFlapMax,
  type LiftFlapGeom,
} from '@/components/labs/storybook/book/popup-liftflap'
import {
  solveStripFlapPoseAt,
  spreadPageAnglesTilted,
  stripFlapCamLift,
  type StripFlapGeom,
} from '@/components/labs/storybook/book/popup-mechanics'
import { popupContentForSpread, SPREAD_COUNT } from '@/components/labs/storybook/content'
import type { SceneLayer } from '@/components/labs/storybook/content'
import type { Vec3 } from '@/components/labs/storybook/book/popup-mechanics'

const ID = 'test-handle'

const locate = (id: string): { layer: SceneLayer; spreadIndex: number } => {
  for (let s = 0; s < SPREAD_COUNT; s++) {
    const layer = popupContentForSpread(s)?.layers.find((l) => l.id === id)
    if (layer) return { layer, spreadIndex: s }
  }
  throw new Error(`no layer ${id}`)
}

const worst = (a: readonly Vec3[], b: readonly Vec3[]): number => {
  let d = 0
  for (let i = 0; i < a.length; i++) {
    d = Math.max(d, Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1], a[i][2] - b[i][2]))
  }
  return d
}

beforeEach(() => clearNudgePulse(ID))

describe('nudgeShape — an overdamped one-shot excursion', () => {
  it('is exactly zero outside its own window, both ends', () => {
    expect(nudgeShape(0)).toBe(0)
    expect(nudgeShape(1)).toBe(0)
    expect(nudgeShape(-0.2)).toBe(0)
    expect(nudgeShape(1.5)).toBe(0)
    expect(nudgeShape(Number.NaN)).toBe(0)
  })

  it('never exceeds unit amplitude and peaks early (a flick, not a swell)', () => {
    let peak = 0
    let peakAt = 0
    for (let i = 0; i <= 1000; i++) {
      const t = i / 1000
      const v = nudgeShape(t)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
      if (v > peak) {
        peak = v
        peakAt = t
      }
    }
    expect(peak).toBeGreaterThan(0.99) // span MEANS the peak excursion

    expect(peakAt).toBeLessThan(0.35)
  })

  it('decays monotonically after the peak (no second bounce)', () => {
    let prev = Infinity
    for (let t = 0.3; t <= 1; t += 0.01) {
      const v = nudgeShape(t)
      expect(v).toBeLessThanOrEqual(prev + 1e-12)
      prev = v
    }
  })
})

describe('readNudgePulse — the pulse retires itself', () => {
  it('is silent with no pulse', () => {
    expect(readNudgePulse(ID, 1000)).toBe(0)
  })

  it('plays inside the window and is exactly zero past it', () => {
    pulseHandle(ID, 1000)
    expect(readNudgePulse(ID, 1000 + NUDGE_MS * 0.145)).toBeGreaterThan(0.98)
    expect(readNudgePulse(ID, 1000 + NUDGE_MS)).toBe(0)
    // …and having retired, it stays silent without a fresh press.
    expect(readNudgePulse(ID, 1000 + NUDGE_MS * 0.145)).toBe(0)
  })

  it('restarts on a second press rather than smearing into the first', () => {
    pulseHandle(ID, 1000)
    const first = readNudgePulse(ID, 1000 + NUDGE_MS * 0.8)
    pulseHandle(ID, 1000 + NUDGE_MS * 0.8)
    const restarted = readNudgePulse(ID, 1000 + NUDGE_MS * 0.8 + NUDGE_MS * 0.145)
    expect(restarted).toBeGreaterThan(first)
  })
})

describe('nudgeOffset — it always moves INTO the range', () => {
  it('pushes a piece resting at its ceiling back DOWN off the stop', () => {
    // The s2 figure group rests at exactly its 90deg anti-flip ceiling; a
    // fixed-sign nudge would be swallowed whole by the clamp and the tap would
    // answer nothing all over again.
    pulseHandle(ID, 0)
    const off = nudgeOffset(ID, Math.PI / 2, 0, Math.PI / 2, NUDGE_SPAN_ANGLE, NUDGE_MS * 0.145)
    expect(off).toBeLessThan(0)
    expect(Math.abs(off)).toBeLessThanOrEqual(NUDGE_SPAN_ANGLE + 1e-12)
  })

  it('pushes a piece resting shut UP', () => {
    pulseHandle(ID, 0)
    expect(nudgeOffset(ID, 0, 0, 1.5, NUDGE_SPAN_ANGLE, NUDGE_MS * 0.145)).toBeGreaterThan(0)
  })

  it('never leaves the range, however small the room', () => {
    pulseHandle(ID, 0)
    for (const rest of [0, 0.001, 0.5, 1.499, 1.5]) {
      for (let i = 0; i <= 40; i++) {
        const off = nudgeOffset(ID, rest, 0, 1.5, NUDGE_SPAN_ANGLE, (i / 40) * NUDGE_MS)
        pulseHandle(ID, 0) // readNudgePulse retires the entry; re-arm per sample
        expect(rest + off).toBeGreaterThanOrEqual(-1e-12)
        expect(rest + off).toBeLessThanOrEqual(1.5 + 1e-12)
      }
    }
  })

  it('is silent — exactly zero — with no pulse armed', () => {
    expect(nudgeOffset(ID, 0.4, 0, 1.5, NUDGE_SPAN_ANGLE, 5000)).toBe(0)
  })
})

describe('the nudge reaches the paper', () => {
  it('moves a lift-flap door leaf visibly', () => {
    const { layer, spreadIndex } = locate('ch1-keyboard')
    const geom = layer as SceneLayer & LiftFlapGeom
    const { thetaL, thetaR } = spreadPageAnglesTilted(spreadIndex, spreadIndex, null, 0)
    const max = liftFlapMax(geom)
    pulseHandle(ID, 0)
    const a = nudgeOffset(ID, 0, 0, max, NUDGE_SPAN_ANGLE, NUDGE_MS * 0.145)
    const travel = worst(
      liftFlapDoorQuad(geom, 0, 0, thetaL, thetaR),
      liftFlapDoorQuad(geom, 0, a, thetaL, thetaR)
    )
    // Perceptible (~6 screen px at the reading camera) but nowhere near the
    // 0.24 world units a real drag on this door produces.
    expect(travel).toBeGreaterThan(0.012)
    expect(travel).toBeLessThan(0.05)
  })

  it('rocks the strip flap that rests ON its ceiling', () => {
    const { layer, spreadIndex } = locate('ch1-rank')
    const geom = layer as SceneLayer & StripFlapGeom
    const { thetaL, thetaR } = spreadPageAnglesTilted(spreadIndex, spreadIndex, null, 0)
    const ANTI_FLIP = Math.PI / 2
    const cam = stripFlapCamLift(geom, thetaL - thetaR)
    // The precondition that makes the signed nudge necessary at all.
    expect(ANTI_FLIP - cam).toBeLessThan(1e-2)
    pulseHandle(ID, 0)
    const a = cam + nudgeOffset(ID, cam, 0, ANTI_FLIP, NUDGE_SPAN_ANGLE, NUDGE_MS * 0.145)
    const rest = solveStripFlapPoseAt(geom, cam, thetaL, thetaR)
    const rocked = solveStripFlapPoseAt(geom, a, thetaL, thetaR)
    expect(worst([...rest.right, ...rest.left], [...rocked.right, ...rocked.left])).toBeGreaterThan(0.01)
  })

  it('keeps the slide-domain span a modest fraction of a stroke', () => {
    expect(NUDGE_SPAN_STROKE_FRAC).toBeGreaterThan(0.05)
    expect(NUDGE_SPAN_STROKE_FRAC).toBeLessThan(0.3)
  })
})
