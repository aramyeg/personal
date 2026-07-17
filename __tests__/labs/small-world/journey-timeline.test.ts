import { describe, it, expect } from 'vitest'
import {
  journeyStateAt,
  ROTATION_TOTAL,
  TRAVEL_END,
  BURST_END,
  PANEL_END,
  CHAPTER_SLICE,
  chapterStartRotation,
  easeOutBack,
} from '@/components/labs/small-world/journey-timeline'
import { CHAPTER_COUNT } from '@/components/labs/small-world/chapters'

const SEG = 1 / CHAPTER_COUNT
/** progress at a local position inside chapter i's segment */
const at = (i: number, local: number) => (i + local) * SEG

describe('journeyStateAt', () => {
  it('clamps progress to [0,1]', () => {
    expect(journeyStateAt(-0.5).progress).toBe(0)
    expect(journeyStateAt(1.5).progress).toBe(1)
  })

  it('starts at zero rotation and completes one full lap', () => {
    expect(journeyStateAt(0).rotation).toBe(0)
    expect(journeyStateAt(1).rotation).toBeCloseTo(ROTATION_TOTAL, 10)
  })

  it('rotation is monotonically non-decreasing', () => {
    let prev = -1
    for (let p = 0; p <= 1.0001; p += 0.001) {
      const r = journeyStateAt(p).rotation
      expect(r).toBeGreaterThanOrEqual(prev)
      prev = r
    }
  })

  it('freezes rotation while a panel is open', () => {
    const a = journeyStateAt(at(2, BURST_END + 0.01))
    const b = journeyStateAt(at(2, PANEL_END - 0.01))
    expect(a.rotation).toBeCloseTo(b.rotation, 10)
  })

  it('reports the active chapter', () => {
    expect(journeyStateAt(0).chapter).toBe(0)
    expect(journeyStateAt(at(3, 0.5)).chapter).toBe(3)
    expect(journeyStateAt(0.999).chapter).toBe(CHAPTER_COUNT - 1)
  })

  it('opens the panel only inside the dwell window, with t in (0,1)', () => {
    expect(journeyStateAt(at(2, 0.3)).panel).toBeNull()
    const mid = journeyStateAt(at(2, (BURST_END + PANEL_END) / 2)).panel
    expect(mid).not.toBeNull()
    expect(mid!.chapter).toBe(2)
    expect(mid!.t).toBeGreaterThan(0)
    expect(mid!.t).toBeLessThan(1)
    expect(journeyStateAt(at(2, PANEL_END + 0.01)).panel).toBeNull()
  })

  it('exposes the discovery burst window between travel and panel', () => {
    expect(journeyStateAt(at(1, 0.3)).burst).toBeNull()
    const b = journeyStateAt(at(1, (TRAVEL_END + BURST_END) / 2)).burst
    expect(b).toBeGreaterThan(0)
    expect(b).toBeLessThan(1)
  })

  it('morphs the incoming set in as the outgoing set sinks', () => {
    const start = journeyStateAt(0)
    expect(start.morph[0]).toBe(1)
    expect(start.morph[1]).toBe(0)
    const mid = journeyStateAt(at(3, 0.175)) // halfway through the morph window
    expect(mid.morph[3]).toBeCloseTo(0.5, 1)
    expect(mid.morph[2]).toBeCloseTo(0.5, 1)
    const settled = journeyStateAt(at(3, 0.5))
    expect(settled.morph[3]).toBe(1)
    expect(settled.morph[2]).toBe(0)
    expect(settled.morph[4]).toBe(0)
  })
})

describe('slice constants', () => {
  it('CHAPTER_SLICE covers the full rotation across all chapters', () => {
    expect(CHAPTER_SLICE * CHAPTER_COUNT).toBeCloseTo(ROTATION_TOTAL, 10)
  })

  it('chapterStartRotation is the chapter index times the slice', () => {
    for (let i = 0; i < CHAPTER_COUNT; i++) {
      expect(chapterStartRotation(i)).toBeCloseTo(i * CHAPTER_SLICE, 10)
    }
  })
})

describe('easeOutBack', () => {
  it('is pinned at 0 and 1', () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 10)
    expect(easeOutBack(1)).toBeCloseTo(1, 10)
  })

  it('overshoots past 1 in the back half (the springy pop)', () => {
    expect(easeOutBack(0.8)).toBeGreaterThan(1)
  })

  it('clamps input outside [0,1]', () => {
    expect(easeOutBack(-1)).toBeCloseTo(0, 10)
    expect(easeOutBack(2)).toBeCloseTo(1, 10)
  })
})

// Round 5 removed worldBlend / LAP_BOUNDARY_CHAPTER from the timeline: the world
// no longer morphs on a lap-boundary panel — it restages per-vertex behind the
// horizon (see renewal.test.ts for the gate pins). The boundary rotation itself
// is still exactly 2π, kept here as a plain rotation fact.
describe('lap boundary rotation', () => {
  it('chapter 2 travel completes exactly one full turn (2π)', () => {
    expect(chapterStartRotation(2) + CHAPTER_SLICE).toBeCloseTo(Math.PI * 2, 10)
  })
})

describe('morph scratch array', () => {
  it('reuses the provided morphOut array (no per-frame allocation)', () => {
    const scratch = new Array<number>(CHAPTER_COUNT).fill(0)
    const state = journeyStateAt(0.4, scratch)
    expect(state.morph).toBe(scratch)
  })

  it('produces identical morph values with and without the scratch', () => {
    const scratch = new Array<number>(CHAPTER_COUNT).fill(-1)
    for (const p of [0, 0.05, 0.2, 0.5, 0.83, 1]) {
      const fresh = journeyStateAt(p)
      const reused = journeyStateAt(p, scratch)
      expect(reused.morph).toEqual(fresh.morph)
    }
  })

  it('ignores a scratch of the wrong length', () => {
    const bad = [0, 0]
    const state = journeyStateAt(0.4, bad)
    expect(state.morph).not.toBe(bad)
    expect(state.morph).toHaveLength(CHAPTER_COUNT)
  })
})
