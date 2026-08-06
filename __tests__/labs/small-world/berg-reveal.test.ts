import { describe, expect, it } from 'vitest'
import {
  BERG_MIN_SCALE,
  BERG_REVEAL_SPAN_FRAC,
  BERG_REVEAL_START_FRAC,
  WINTER_CHAPTER,
  bergGrow,
} from '@/components/labs/small-world/scene/props/berg-reveal'
import {
  CHAPTER_SLICE,
  PANEL_END,
  PARK_FRAC,
  TRAVEL_END,
  chapterStartRotation,
  rotationAt,
} from '@/components/labs/small-world/journey-timeline'
import { CHAPTER_COUNT } from '@/components/labs/small-world/chapters'
import { LANE_CROSSINGS } from '@/components/labs/small-world/overlay/grade-mood'

/**
 * Task 62 — the icebergs arrive with the winter.
 *
 * Aram saw polar ice on the left limb from the desert. The bergs cannot flip behind the horizon
 * (see berg-reveal.ts), so they GROW, in view, keyed to the winter crossing. What follows pins the
 * user-facing claim — "not there before winter, fully there by the checkpoint" — in terms of
 * SCROLL POSITIONS rather than of the constants the implementation happens to use, plus the
 * derivation itself, so a literal creeping back in would be caught by the first group and a
 * re-derivation that changed the answer by the second.
 */

/** Scroll progress at a chapter's local fraction — the same mapping the journey uses. */
const at = (chapter: number, local: number) => (chapter + local) / CHAPTER_COUNT

describe('the iceberg reveal', () => {
  it('shows no ice at all before the winter crossing', () => {
    // The complaint, expressed as the thing a visitor does: walk the whole journey up to winter and
    // there must be no berg drawn at any point of it. Sampled densely rather than at checkpoints,
    // because the bergs sit on the limb during TRAVEL too and that is where he saw them.
    for (let p = 0; p < 5 / CHAPTER_COUNT; p += 0.005) {
      expect(bergGrow(rotationAt(p)), `progress ${p.toFixed(3)}`).toBeLessThanOrEqual(BERG_MIN_SCALE)
    }
    // ...including every dwell of the five chapters before it, which is where a reader lingers
    for (let c = 0; c < WINTER_CHAPTER; c++) {
      for (const local of [TRAVEL_END, 0.8, PANEL_END]) {
        expect(bergGrow(rotationAt(at(c, local))), `chapter ${c} dwell`).toBeLessThanOrEqual(
          BERG_MIN_SCALE
        )
      }
    }
  })

  it('is fully grown by the winter checkpoint, and stays grown through the ending', () => {
    // "Fully" is >= 1: easeOutBack passes 1 well before the window closes and overshoots past it,
    // so the assertion is a floor rather than an equality.
    for (const local of [TRAVEL_END, 0.8, PANEL_END, 0.999]) {
      expect(bergGrow(rotationAt(at(WINTER_CHAPTER, local))), `winter ${local}`).toBeGreaterThanOrEqual(1)
    }
    expect(bergGrow(rotationAt(1)), 'the very end').toBeGreaterThanOrEqual(1)
  })

  it('grows on the limb without a pop: continuous, and off a base of nothing', () => {
    // The bergs are on the always-visible left limb, so unlike every other staged change in this
    // world the growth happens ON CAMERA. That makes continuity a requirement rather than a nicety:
    // a step here is a silhouette pop.
    //
    // Asserting "no sample step exceeds X" would only have measured the sample spacing I chose, so
    // this measures the property directly: refine the spacing fourfold and the largest step must
    // fall with it. A continuous curve's worst step shrinks in proportion; a JUMP's does not move
    // at all, which is exactly the artefact being ruled out.
    const worstStep = (h: number): number => {
      let worst = 0
      let prev = bergGrow(rotationAt(0.82))
      for (let p = 0.82; p <= 0.93; p += h) {
        const g = bergGrow(rotationAt(p))
        worst = Math.max(worst, Math.abs(g - prev))
        prev = g
      }
      return worst
    }
    const coarse = worstStep(0.0008)
    const fine = worstStep(0.0002)
    expect(fine, 'a jump would survive refinement; a curve does not').toBeLessThan(coarse * 0.5)

    // ...and it is not instantaneous either. The growth has to occupy real scroll, or "continuous"
    // is true of something a reader still experiences as an appearance.
    const span = (() => {
      let from = 1
      let to = 0
      for (let p = 0.8; p <= 0.95; p += 0.0005) {
        const g = bergGrow(rotationAt(p))
        if (g > BERG_MIN_SCALE) from = Math.min(from, p)
        if (g < 1) to = Math.max(to, p)
      }
      return to - from
    })()
    // This reveal may only run inside the APPROACH (the ice has to be standing before the card
    // opens), so it is worth exactly what the approach is worth: 0.55 of a leg originally, 0.126
    // after Task 73's framing fix, 0.24 after Task 75 took the park later. The growth therefore
    // occupies ~0.013 of the track, against ~0.019 originally and ~0.006 at the tightest. The
    // floor here is what is left of the guarantee; whether it reads as an event rather than a pop
    // is an EYE-TEST item, captured on the limb, not something this number can settle.
    expect(span, 'scroll the growth occupies').toBeGreaterThan(0.004)

    // and it starts from nothing rather than from a visible size — a berg that appears at 30% and
    // then grows is still a pop, just a smaller one
    expect(bergGrow(rotationAt(0.8333))).toBeLessThanOrEqual(BERG_MIN_SCALE)
  })

  it('scrubs backward along exactly the curve it grew on', () => {
    // Purity is the whole determinism argument, so it is asserted as a property rather than
    // assumed from the absence of state: the same rotation must give the same scale whichever
    // direction the sample sequence approached it from.
    const up: number[] = []
    const down: number[] = []
    for (let p = 0.83; p <= 0.9; p += 0.002) up.push(bergGrow(rotationAt(p)))
    for (let p = 0.9; p >= 0.83; p -= 0.002) down.unshift(bergGrow(rotationAt(p)))
    expect(down.length).toBe(up.length)
    for (let i = 0; i < up.length; i++) expect(down[i]).toBeCloseTo(up[i], 12)
  })

  it('cannot move while a checkpoint is parked', () => {
    // `rotationAt` freezes rotation for the whole dwell, which is what T59's boundary-keyed grade
    // rests on; the same property is what stops the ice creeping under a reader's eyes while they
    // are reading. Worth pinning here because it is a property of the KEYING CHOICE — a reveal
    // keyed to progress instead of rotation would fail this and nothing else in the suite.
    const parked = bergGrow(rotationAt(at(WINTER_CHAPTER, TRAVEL_END)))
    for (const local of [TRAVEL_END, (TRAVEL_END + PANEL_END) / 2, PANEL_END]) {
      expect(bergGrow(rotationAt(at(WINTER_CHAPTER, local)))).toBe(parked)
    }
  })

  it('takes its window from the lane crossing and the approach, not from literals', () => {
    // The derivation, asserted against the two constants it is derived FROM. If either moves the
    // ice follows it; if somebody replaces the expression with the number it happens to equal
    // today, this is what fails.
    expect(BERG_REVEAL_START_FRAC).toBeCloseTo(
      (LANE_CROSSINGS[WINTER_CHAPTER] - chapterStartRotation(WINTER_CHAPTER)) / CHAPTER_SLICE,
      12
    )
    // Task 73: the span is no longer borrowed from the mood crossfade. The two used to want the
    // same number and stopped agreeing when the approach shrank — the crossfade spends only part
    // of it on purpose, the bergs want all of it because they grow in plain sight.
    expect(BERG_REVEAL_SPAN_FRAC).toBe((PARK_FRAC - BERG_REVEAL_START_FRAC) * 0.9)
    // ...and the thing that actually matters: the ice is fully grown BEFORE the card opens.
    expect(BERG_REVEAL_START_FRAC + BERG_REVEAL_SPAN_FRAC).toBeLessThan(PARK_FRAC)

    // ...and the derived window really does open AT the crossing: nothing a hair before, something
    // a hair after. This is the behavioural half, and it is what would catch a start frac that was
    // correct arithmetic wired to the wrong chapter.
    const start = LANE_CROSSINGS[WINTER_CHAPTER]
    expect(bergGrow(start - 1e-4)).toBeLessThanOrEqual(BERG_MIN_SCALE)
    expect(bergGrow(start + 0.02)).toBeGreaterThan(BERG_MIN_SCALE)

    // The whole growth fits inside the APPROACH — rotation covers PARK_FRAC of the slice before
    // the stop and then freezes, so a window ending under PARK_FRAC is one that closes before the
    // girl stops. That rail is asserted above, against PARK_FRAC rather than against 1: before
    // Task 73 the approach WAS the whole slice and the two tests were the same test.
    expect(bergGrow(rotationAt(at(WINTER_CHAPTER, TRAVEL_END * 0.98)))).toBeGreaterThanOrEqual(1)
  })
})
