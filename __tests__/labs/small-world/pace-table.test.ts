import { afterEach, describe, expect, it } from 'vitest'
import {
  CEILING_ENTRIES,
  PACE_ROWS,
  authoredTotalSeconds,
  ceilingAt,
  paceRow,
  paceRowAt,
  spanEndAt,
  totalSecondsFor,
  type PaceSpan,
} from '@/components/labs/small-world/pace-table'
import {
  GOVERNED_MAX_SPEED,
  initialArrival,
  stepArrival,
} from '@/components/labs/small-world/arrival'
import { beatPaceOf, beatWindows } from '@/components/labs/small-world/beat-windows'
import {
  FAST_FORWARD_IDLE,
  fastForwardFactor,
  stepFastForward,
} from '@/components/labs/small-world/fast-forward'
import { ENDING_SPAN, TRACK_END } from '@/components/labs/small-world/ending-timeline'
import { CHAPTER_COUNT } from '@/components/labs/small-world/chapters'
import {
  GIRL_JUMP_START,
  GIRL_TRANSFER,
  GIRL_TURN_START,
  GIRL_WALK_END,
} from '@/components/labs/small-world/scene/girl-exit'
import { DIALS, resetDials, setDial } from '@/components/labs/small-world/scene/tunables'

/**
 * ============================================================================
 * THE PACE TABLE (Task 129) — the invariants the three mechanisms rest on
 * ============================================================================
 * `arrival.ts` reads the ceilings, `beat-windows.ts` projects the floors and
 * `fast-forward.ts` reads the amendment, so a defect in the table is a defect in all
 * three at once. These are the properties none of those files can check for itself:
 * that the rows TILE the story without overlapping, that the holes in the tiling are
 * the ones that were argued for rather than ones that were forgotten, that a floor
 * can never fight the ceiling above it, and that the fast-forward cannot become a
 * way past a beat rather than through one.
 */

const FRAME = 1 / 60
const endingAt = (t: number) => 1 + t * ENDING_SPAN

/** Every span of every row, flattened and sorted — the table's own lookup structure. */
const flatSpans = PACE_ROWS.flatMap((row) => row.spans.map((span) => ({ span, row }))).sort(
  (a, b) => a.span[0] - b.span[0]
)

afterEach(() => {
  // The dials are module-level and shared with every other suite in this process.
  // Anything written here is put back, always — a leaked pace dial would silently
  // retune arrival.test.ts's governor rather than fail anything of its own.
  resetDials()
})

describe('coverage: the rows tile the story', () => {
  it('is ordered and non-overlapping, and lives inside the track', () => {
    for (const { span } of flatSpans) {
      expect(span[1]).toBeGreaterThan(span[0])
      expect(span[0]).toBeGreaterThanOrEqual(0)
      expect(span[1]).toBeLessThanOrEqual(TRACK_END + 1e-12)
    }
    for (let i = 1; i < flatSpans.length; i++) {
      expect(flatSpans[i].span[0]).toBeGreaterThanOrEqual(flatSpans[i - 1].span[1] - 1e-12)
    }
  })

  it('covers the whole journey [0, 1] — travel, notes and animals tile every chapter', () => {
    // The tiling stated as a chain rather than as a sweep: each chapter is exactly
    // travel-in, notes, animals, travel-out, end to end with no seam and no overlap.
    const journey = flatSpans.filter(({ span }) => span[1] <= 1 + 1e-12)
    expect(journey[0].span[0]).toBe(0)
    for (let i = 1; i < journey.length; i++) {
      expect(journey[i].span[0]).toBeCloseTo(journey[i - 1].span[1], 12)
    }
    expect(journey[journey.length - 1].span[1]).toBeCloseTo(1, 12)
    expect(journey.map((e) => e.row.id).join(',')).toBe(
      Array.from({ length: CHAPTER_COUNT }, () => 'travel,notes,animals,travel').join(',')
    )

    // …and swept, because the chain above would be satisfied by a table that agreed
    // with itself and disagreed with `paceRowAt`.
    for (let i = 0; i < 2000; i++) {
      const p = (i / 2000) * (1 - 1e-9)
      expect(paceRowAt(p)).not.toBeNull()
    }
  })

  it('names a ceiling entry for every ceilinged span, and only for those', () => {
    const expected = flatSpans
      .filter(({ row }) => row.ceiling)
      .map(({ span }) => span[0])
      .sort((a, b) => a - b)
    expect([...CEILING_ENTRIES]).toEqual(expected)
  })
})

describe('the gaps are the ones that were argued for', () => {
  /** Every maximal run of progress the table says nothing about, swept at 1e-4. */
  const gaps: PaceSpan[] = (() => {
    const out: PaceSpan[] = []
    const step = 1e-4
    let from: number | null = null
    for (let p = 0; p <= TRACK_END + 1e-12; p += step) {
      const covered = paceRowAt(p) !== null
      if (!covered && from === null) from = p
      if (covered && from !== null) {
        out.push([from, p])
        from = null
      }
    }
    if (from !== null) out.push([from, TRACK_END])
    return out
  })()

  it('leaves exactly three holes, all of them in the ending', () => {
    expect(gaps).toHaveLength(3)
    for (const gap of gaps) expect(gap[0]).toBeGreaterThan(1)
  })

  it('leaves THE BRINK free — she is standing on the edge of her world', () => {
    // `[GIRL_WALK_END, GIRL_JUMP_START]`, girl-exit's "a decision rather than a
    // stumble". A reader who stops there is looking at the picture the leap launches
    // from, and pacing it would be the table overruling the staging.
    const brink = endingAt((GIRL_WALK_END + GIRL_JUMP_START) / 2)
    expect(paceRowAt(brink)).toBeNull()
    expect(ceilingAt(brink)).toBe(Infinity)
    expect(spanEndAt(brink)).toBeNull()
    // …and it is a hole in the table, not a hole in the ending: both edges are rows.
    expect(paceRowAt(endingAt(GIRL_WALK_END - 1e-6))?.row.id).toBe('ending-walk')
    expect(paceRowAt(endingAt(GIRL_JUMP_START + 1e-6))?.row.id).toBe('ending-jump')
  })

  it('leaves everything past GIRL_TRANSFER free — the desk and the pull-back', () => {
    // She has left the planet; what remains is a camera move with a legible frame at
    // every point of it.
    for (let i = 0; i <= 40; i++) {
      const p = endingAt(GIRL_TRANSFER) + (i / 40) * (TRACK_END - endingAt(GIRL_TRANSFER))
      expect(paceRowAt(Math.min(p, TRACK_END))).toBeNull()
    }
  })

  it('leaves the ending OPENING free too, which is the gap the brief did not name', () => {
    // `[1, GIRL_TURN_START)` — the last frames of the journey's own travel handing
    // over to the ending, before she turns. It is uncovered for the pull-back's
    // reason rather than the brink's: nothing of hers is moving in it yet, so there
    // is no beat there to pace. Asserted so it stays a decision.
    expect(paceRowAt(1)).toBeNull()
    expect(paceRowAt(endingAt(GIRL_TURN_START / 2))).toBeNull()
    expect(paceRowAt(endingAt(GIRL_TURN_START + 1e-6))?.row.id).toBe('ending-turn')
  })
})

describe('floors never exceed ceilings', () => {
  it('paces every floor at exactly its own row’s ceiling, sampled across the span', () => {
    const windows = beatWindows()
    expect(windows.length).toBe(PACE_ROWS.filter((r) => r.floor).length)
    for (const w of windows) {
      const pace = beatPaceOf(w)
      expect(pace).toBeGreaterThan(0)
      for (let i = 0; i <= 20; i++) {
        const p = w.start + ((w.end - w.start) * i) / 20
        // Half-open: the end belongs to the next row, so sample strictly inside.
        if (p >= w.end) continue
        expect(pace).toBeLessThanOrEqual(ceilingAt(p))
      }
    }
  })

  it('keeps Task 125’s gate: no floor outruns the reader the ceiling serves in full', () => {
    // A floor that could push the document harder than a reader can scroll without
    // meeting the ceiling would be a floor fighting a ceiling.
    for (const row of PACE_ROWS) {
      if (!row.floor) continue
      expect(row.rate()).toBeLessThanOrEqual(GOVERNED_MAX_SPEED)
    }
  })

  it('gives every floor row a ceiling — a floor without one is a fight waiting', () => {
    for (const row of PACE_ROWS) {
      if (row.floor) expect(row.ceiling).toBe(true)
    }
  })
})

describe('the fast-forward cannot leave the span it was armed in', () => {
  const NOTES = paceRow('notes')
  const SPAN = NOTES.spans[2]
  const START = SPAN[0] + (SPAN[1] - SPAN[0]) * 0.1

  /** Frames to cross the rest of the span under a fling that never lets up. */
  function crossFrames(fastForward: boolean): number {
    let s = initialArrival(START)
    let frames = 0
    while (s.progress < SPAN[1] - 1e-12 && frames < 2000) {
      // dt is deliberately huge (a stuttering frame) and `raw` is the bottom of the
      // track: the hardest input this function can be given.
      s = stepArrival(s, TRACK_END, 0.5, false, 'travel', fastForward)
      expect(s.progress).toBeLessThanOrEqual(SPAN[1] + 1e-12)
      frames++
    }
    expect(s.progress).toBeCloseTo(SPAN[1], 12)
    return frames
  }

  it('lands exactly on the span end and never a hair past it', () => {
    crossFrames(true)
  })

  it('is genuinely faster than the normal cap, or it would not be worth having', () => {
    const fast = crossFrames(true)
    const normal = crossFrames(false)
    expect(fast).toBeLessThan(normal)
    // It is a GLIDE, not a teleport: the page still draws over several frames.
    expect(fast).toBeGreaterThan(1)
  })

  it('disarms the moment the reader stands in a row that does not allow it', () => {
    // The state machine's half of the same guarantee: the row past the notes span is
    // the mascots' beat, which has no fast-forward, so the glide cannot continue into
    // it even with the reader still leaning on the wheel.
    const armed = { row: 'notes', held: 10, active: true }
    const next = stepFastForward(armed, SPAN[1] + 1e-9, 1, true, FRAME)
    expect(next).toEqual(FAST_FORWARD_IDLE)
  })
})

describe('the fast-forward factor is never a brake', () => {
  it('is at least 1 even when the dial is written below it', () => {
    expect(fastForwardFactor()).toBeGreaterThanOrEqual(1)
    // The panel's own slider cannot go below 1 — the dial's `min` is 1 — so `setDial`
    // clamps and the guard is unreachable through it. The guard is not there for the
    // slider: it is there because a dial's range is a panel affordance and the
    // invariant "the fast path is never the slow one" belongs to this function.
    setDial('paceFastForward', 0.2)
    expect(fastForwardFactor()).toBeGreaterThanOrEqual(1)
    DIALS.paceFastForward.value = 0.2
    expect(fastForwardFactor()).toBe(1)
    DIALS.paceFastForward.value = -5
    expect(fastForwardFactor()).toBe(1)
  })
})

describe('reduced motion', () => {
  it('lifts every ceiling, everywhere', () => {
    for (let i = 0; i <= 500; i++) {
      const p = (i / 500) * TRACK_END
      expect(ceilingAt(p, true)).toBe(Infinity)
    }
  })

  it('never arms the fast-forward, however hard the reader pushes', () => {
    let ff = FAST_FORWARD_IDLE
    const inside = paceRow('notes').spans[0][0] + 1e-4
    for (let f = 0; f < 120; f++) {
      ff = stepFastForward(ff, inside, 1, true, FRAME, true)
      expect(ff.active).toBe(false)
      expect(ff).toEqual(FAST_FORWARD_IDLE)
    }
  })
})

describe('the dials are live', () => {
  it('moves the notes ceiling on the next call, and puts it back on reset', () => {
    const inside = paceRow('notes').spans[1][0] + 1e-4
    const before = ceilingAt(inside)
    setDial('paceNotesSeconds', 3)
    // Twice the seconds is half the rate, and the span did not move.
    expect(ceilingAt(inside)).toBeCloseTo(before / 2, 12)
    resetDials()
    expect(ceilingAt(inside)).toBeCloseTo(before, 12)
  })

  it('moves the travel ceiling, and only inside travel', () => {
    const travel = paceRow('travel').spans[0][0] + 1e-4
    const notes = paceRow('notes').spans[0][0] + 1e-4
    const travelBefore = ceilingAt(travel)
    const notesBefore = ceilingAt(notes)
    setDial('paceTravelSpeed', DIALS.paceTravelSpeed.default * 2)
    expect(ceilingAt(travel)).toBeCloseTo(travelBefore * 2, 12)
    expect(ceilingAt(notes)).toBe(notesBefore)
    resetDials()
    expect(ceilingAt(travel)).toBeCloseTo(travelBefore, 12)
  })

  it('moves the ending rows, floors and ceilings together', () => {
    const jump = paceRow('ending-jump')
    const inside = jump.spans[0][0] + 1e-6
    const before = ceilingAt(inside)
    setDial('paceJumpSeconds', DIALS.paceJumpSeconds.default * 2)
    const after = ceilingAt(inside)
    expect(after).toBeCloseTo(before / 2, 12)
    // The floor is the same number by construction — one dial, both mechanisms.
    const window = beatWindows().find((w) => w.id === 'ending-jump')!
    expect(beatPaceOf(window)).toBeCloseTo(after, 12)
    resetDials()
  })

  it('moves the authored total, which is what the stopwatch is measured against', () => {
    const before = authoredTotalSeconds()
    expect(before).toBeCloseTo(
      PACE_ROWS.filter((r) => r.ceiling).reduce((sum, r) => sum + totalSecondsFor(r), 0),
      12
    )
    setDial('paceNotesSeconds', DIALS.paceNotesSeconds.default * 2)
    expect(authoredTotalSeconds()).toBeCloseTo(
      before + totalSecondsFor(paceRow('notes')) / 2,
      9
    )
    resetDials()
    expect(authoredTotalSeconds()).toBeCloseTo(before, 12)
  })
})
