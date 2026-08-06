import { describe, it, expect } from 'vitest'
import {
  journeyStateAt,
  ROTATION_TOTAL,
  TRAVEL_END,
  BURST_END,
  PANEL_END,
  CHAPTER_SLICE,
  chapterParkRotation,
  chapterStartRotation,
  easeOutBack,
  approachRevealGrow,
  revealPhase,
  rotationAt,
  BURST_PHASE_END,
  CARD_PHASE_START,
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
    expect(journeyStateAt(at(2, TRAVEL_END / 2)).panel, 'travelling').toBeNull()
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

// Round 15 / Task 54 — the arrival reveal clock. journeyStateAt stays pure: it
// only passes the clock through and re-keys the "!" to it, so the entrance can
// play with no scroll input. The clock itself is proven in arrival.test.ts.
/**
 * Task 59 — `rotationAt` is the same rule `journeyStateAt` renders with, lifted out so a consumer
 * that only wants the angle (the biome grade keys its crossfade to it) does not have to build a
 * whole JourneyState or, worse, restate the formula. These pin the extraction rather than the
 * value: if the two ever disagree, something has been changed in one place and not the other.
 */
describe('rotationAt', () => {
  it('is exactly the rotation journeyStateAt renders', () => {
    for (let i = 0; i <= 2000; i++) {
      const p = i / 2000
      expect(rotationAt(p), `p=${p}`).toBe(journeyStateAt(p).rotation)
    }
    for (const p of [-1, -0.001, 1.001, 5]) {
      expect(rotationAt(p), `p=${p}`).toBe(journeyStateAt(p).rotation)
    }
  })

  // The property the grade leans on: rotation advances only over a chapter's TRAVEL and is frozen
  // for the whole dwell, so anything keyed to it cannot move while a checkpoint is parked.
  it('freezes for the whole of every dwell, at the chapter’s own park', () => {
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      // Task 73: the park is PARK_FRAC into the chapter's OWN slice, not the next chapter's start.
      // That is the whole framing fix — the card is now over the biome it is about.
      const parked = chapterParkRotation(c)
      for (let k = 0; k <= 10; k++) {
        const local = TRAVEL_END + ((PANEL_END - TRAVEL_END) * k) / 10
        expect(rotationAt(at(c, local)), `ch${c} @${local.toFixed(2)}`).toBeCloseTo(parked, 12)
      }
    }
  })

  it('is monotone non-decreasing across the whole journey', () => {
    let prev = -Infinity
    for (let i = 0; i <= 5000; i++) {
      const r = rotationAt(i / 5000)
      expect(r).toBeGreaterThanOrEqual(prev)
      prev = r
    }
    expect(prev).toBeCloseTo(ROTATION_TOTAL, 10)
  })
})

describe('reveal clock pass-through', () => {
  const dwell = at(2, 0.75)

  it('is null unless a driver supplies one', () => {
    expect(journeyStateAt(dwell).reveal).toBeNull()
  })

  it('publishes exactly what the driver supplied', () => {
    const reveal = { chapter: 2, t: 0.4, phase: 'in' as const }
    expect(journeyStateAt(dwell, undefined, reveal).reveal).toBe(reveal)
  })

  it('re-keys the discovery burst to the reveal, so it pops on arrival', () => {
    // Parked at the girl's stop with no further scrolling: the old scroll window
    // would sit frozen at 0 forever; the clock pops it.
    const arrival = at(2, TRAVEL_END + 1e-9)
    expect(journeyStateAt(arrival).burst).toBeCloseTo(0, 6)
    const popped = journeyStateAt(arrival, undefined, { chapter: 2, t: 0.21, phase: 'in' })
    expect(popped.burst).toBeGreaterThan(0.4)
    expect(popped.burst).toBeLessThan(0.6)
  })

  it('drops the burst once its beat is over, and never re-fires it on the way out', () => {
    const rolled = journeyStateAt(dwell, undefined, { chapter: 2, t: 0.9, phase: 'in' })
    expect(rolled.burst).toBeNull()
    // Retracting back through the burst's own window must NOT pop it a second time.
    const leaving = journeyStateAt(dwell, undefined, { chapter: 2, t: 0.2, phase: 'out' })
    expect(leaving.burst).toBeNull()
  })

  it('leaves the burst scroll-keyed while another chapter retracts', () => {
    const travelling = at(3, TRAVEL_END / 2)
    expect(journeyStateAt(travelling, undefined, { chapter: 2, t: 0.5, phase: 'out' }).burst).toBeNull()
  })

  it('never touches rotation, morph or the dwell panel', () => {
    const bare = journeyStateAt(dwell)
    const clocked = journeyStateAt(dwell, undefined, { chapter: 2, t: 0.33, phase: 'in' })
    expect(clocked.rotation).toBe(bare.rotation)
    expect(clocked.morph).toEqual(bare.morph)
    expect(clocked.panel).toEqual(bare.panel)
  })
})

describe('revealPhase', () => {
  it('remaps a sub-window to its own 0→1 and clamps outside it', () => {
    expect(revealPhase(0.2, 0.26, 1)).toBe(0)
    expect(revealPhase(0.26, 0.26, 1)).toBe(0)
    expect(revealPhase(0.63, 0.26, 1)).toBeCloseTo(0.5, 6)
    expect(revealPhase(1, 0.26, 1)).toBe(1)
    expect(revealPhase(1.4, 0.26, 1)).toBe(1)
  })

  it('starts the cards after the burst beat has begun, so the "!" leads', () => {
    expect(CARD_PHASE_START).toBeGreaterThan(0)
    expect(CARD_PHASE_START).toBeLessThan(BURST_PHASE_END)
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

// Task 46 — the desert camels + oasis "appear as the girl approaches": a deterministic,
// rotation-driven grow (no wall-clock) so the reveal is bit-reproducible when scrubbing.
describe('approachRevealGrow (Task 46 desert approach reveal)', () => {
  const CH = 3 // desert chapter
  const START = 0.45
  const SPAN = 0.4
  const grow = (rot: number) => approachRevealGrow(CH, rot, START, SPAN)
  const chapterStop = chapterStartRotation(CH) + CHAPTER_SLICE // rotation at the desert stop

  it('is deterministic — same rotation gives the exact same grow', () => {
    for (const rot of [chapterStartRotation(CH), chapterStartRotation(CH) + 1.2, chapterStop]) {
      expect(grow(rot)).toBe(grow(rot))
    }
  })

  it('holds hidden (0) before the reveal begins (start of the desert travel)', () => {
    expect(grow(chapterStartRotation(CH))).toBeCloseTo(0, 10)
    // still 0 right up to the start fraction
    expect(grow(chapterStartRotation(CH) + CHAPTER_SLICE * (START - 0.02))).toBeCloseTo(0, 10)
  })

  it('is fully grown (1) by the stop and stays full through the frozen dwell', () => {
    expect(grow(chapterStop)).toBeCloseTo(1, 10)
    // rotation freezes at the stop through burst + panel — grow must stay pinned at 1
    expect(grow(chapterStop + 0.5)).toBeCloseTo(1, 10)
  })

  it('grows through the middle of the approach (a real before/mid/after reveal)', () => {
    const mid = grow(chapterStartRotation(CH) + CHAPTER_SLICE * (START + SPAN * 0.5))
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThanOrEqual(easeOutBack(0.5) + 1e-9)
    // strictly larger than the hidden start
    expect(mid).toBeGreaterThan(grow(chapterStartRotation(CH)))
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
