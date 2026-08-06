import { describe, expect, it } from 'vitest'
import { CHAPTER_COUNT } from '@/components/labs/small-world/chapters'
import { TRACK_END, trackOffsetFor } from '@/components/labs/small-world/ending-timeline'
import {
  BURST_END,
  BURST_SPAN,
  DWELL_SPAN,
  PANEL_END,
  TRAVEL_END,
  chapterDwellProgress,
  journeyStateAt,
} from '@/components/labs/small-world/journey-timeline'
import {
  FLING_VELOCITY,
  STORY_STOP_PROGRESS,
  advanceTargetFrom,
  flingArmed,
  stopOffsets,
  storyStopsAvailable,
} from '@/components/labs/small-world/story-stops'

/**
 * TASK 75 PART B — the story stops, as arithmetic.
 *
 * What a unit test can hold here is the GEOMETRY (where a fling is allowed to stop) and the POLICY
 * (when the mechanism is allowed to engage at all). What it cannot hold is the behaviour itself:
 * a fling is momentum, jsdom has none, and even a real headless browser has none — the verdicts
 * for that live in the capture inventory, taken with timestamped touch dispatch in a headed
 * browser. These are the invariants that would have to break before those verdicts could.
 */
describe('where the stops are', () => {
  it('puts one stop in every chapter, in order', () => {
    expect(STORY_STOP_PROGRESS).toHaveLength(CHAPTER_COUNT)
    for (let c = 1; c < CHAPTER_COUNT; c++) {
      expect(STORY_STOP_PROGRESS[c]).toBeGreaterThan(STORY_STOP_PROGRESS[c - 1])
    }
  })

  it('lands each one on the beat where the cards are up and settled', () => {
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      const p = STORY_STOP_PROGRESS[c]
      expect(p).toBe(chapterDwellProgress(c))
      const local = p * CHAPTER_COUNT - c
      expect(local, `ch${c} after the burst`).toBeGreaterThan(BURST_END)
      expect(local, `ch${c} before the release`).toBeLessThan(PANEL_END)
      // ...and the card is actually up there, asked of the timeline rather than of the window.
      expect(journeyStateAt(p).panel?.chapter, `ch${c} card up`).toBe(c)
    }
  })

  it('leaves a wide margin either side of the landing, in derived units', () => {
    // The stop is the middle of the CARD dwell, so the margins are the halves of the beats around
    // it rather than numbers of their own: half the dwell before the cards retract, and that plus
    // the whole burst back to the girl's stop. Stated this way they survive the next park move.
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      const local = STORY_STOP_PROGRESS[c] * CHAPTER_COUNT - c
      expect(PANEL_END - local, `ch${c} to the release`).toBeCloseTo(DWELL_SPAN / 2, 12)
      expect(local - TRAVEL_END, `ch${c} back to her stop`).toBeCloseTo(
        BURST_SPAN + DWELL_SPAN / 2,
        12
      )
      // ...and the tighter of the two is still more than a third of the whole dwell window.
      expect(PANEL_END - local).toBeGreaterThan((PANEL_END - TRAVEL_END) / 3)
    }
  })

  it('stops at the last checkpoint — the walk-out and the ending carry none', () => {
    const last = STORY_STOP_PROGRESS[CHAPTER_COUNT - 1]
    expect(last).toBeLessThan((CHAPTER_COUNT - 1 + PANEL_END) / CHAPTER_COUNT)
    expect(last).toBeLessThan(1)
    for (const p of STORY_STOP_PROGRESS) expect(p).toBeLessThan(1)
  })

  it('places the areas exactly where tap-to-advance aims, by sharing the expression', () => {
    // Not "close to": the same function on the same measurement. Anything else would put the snap
    // position and the tap target a few hundred pixels apart at the bottom of a 14,000 px track.
    for (const total of [13335, 9000, 20000]) {
      const offsets = stopOffsets(total)
      offsets.forEach((top, c) => expect(top).toBe(trackOffsetFor(STORY_STOP_PROGRESS[c], total)))
      expect(offsets[0]).toBeGreaterThan(0)
      expect(offsets[CHAPTER_COUNT - 1]).toBeLessThan(total / TRACK_END)
    }
  })
})

describe('a tap goes where a fling goes', () => {
  it('sends a tap to the NEXT story stop, not to the boundary before it', () => {
    for (let c = 0; c < CHAPTER_COUNT - 1; c++) {
      expect(advanceTargetFrom(c)).toBe(STORY_STOP_PROGRESS[c + 1])
      // The old target — local 0 of the next chapter — left the reader with the whole approach
      // still to scroll and no card up. It is strictly earlier than the stop, every chapter.
      expect(advanceTargetFrom(c)).toBeGreaterThan((c + 1) / CHAPTER_COUNT)
    }
  })

  it('hands the last card to the ending rather than inventing a seventh stop', () => {
    expect(advanceTargetFrom(CHAPTER_COUNT - 1)).toBe(1)
    expect(STORY_STOP_PROGRESS).toHaveLength(CHAPTER_COUNT)
  })
})

describe('when the mechanism may engage', () => {
  it('exists only on a touch device that has not asked for less motion', () => {
    expect(storyStopsAvailable(true, false)).toBe(true)
    expect(storyStopsAvailable(false, false)).toBe(false) // desktop: nothing is mounted at all
    expect(storyStopsAvailable(true, true)).toBe(false) // a snap moves the page by itself
    expect(storyStopsAvailable(false, true)).toBe(false)
  })

  /**
   * The threshold is the velocity at which the PLATFORM starts flinging, measured on a 300 px
   * gesture: nothing below 856 px/s produced a single pixel of momentum, everything from
   * 1152 px/s did. Both ends of that bracket are asserted so a future retune has to move the
   * constant past real evidence rather than past a round number.
   */
  it('arms on a fling and never on a drag', () => {
    expect(flingArmed(1152, 0, 10000)).toBe(true)
    expect(flingArmed(856, 0, 10000)).toBe(false)
    expect(FLING_VELOCITY).toBeGreaterThan(856)
    expect(FLING_VELOCITY).toBeLessThan(1152)
  })

  it('arms on a fling in either direction', () => {
    // A backward fling settles on a stop too — the reader who flicks back lands on a card, not in
    // the middle of a walk-out.
    expect(flingArmed(-2000, 0, 10000)).toBe(true)
    expect(flingArmed(-400, 0, 10000)).toBe(false)
  })

  it('refuses at and past the last checkpoint, so the ending is never snapped', () => {
    expect(flingArmed(5000, 9998, 10000)).toBe(true)
    expect(flingArmed(5000, 10000, 10000)).toBe(false)
    expect(flingArmed(5000, 12000, 10000)).toBe(false)
  })
})
