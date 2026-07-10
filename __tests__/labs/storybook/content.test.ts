import { describe, expect, it } from 'vitest'
import { experiences } from '@/data'
import {
  CHAPTERS,
  EXTRA_SPREAD_LAYERS,
  SPREAD_COUNT,
  TITLE_LAYERS,
  chapterForSpread,
  experienceFor,
  popupContentForSpread,
} from '@/components/labs/storybook/content'

describe('storybook content', () => {
  it('has exactly one chapter per experience, oldest first', () => {
    expect(CHAPTERS.map((c) => c.experienceId)).toEqual([
      'bluenet',
      'flyerbee',
      '360dialog',
      'accenture',
      'akna',
      'xdatagroup',
    ])
    expect(new Set(experiences.map((e) => e.id))).toEqual(
      new Set(CHAPTERS.map((c) => c.experienceId))
    )
  })

  it('maps chapters to spreads 2..7 and resolves lookups', () => {
    expect(SPREAD_COUNT).toBe(10)
    expect(CHAPTERS.map((c) => c.spread)).toEqual([2, 3, 4, 5, 6, 7])
    expect(chapterForSpread(4)?.title).toMatch(/Ravens/)
    expect(chapterForSpread(0)).toBeUndefined()
    expect(chapterForSpread(8)).toBeUndefined()
  })

  it('resolves real experience facts (never hardcoded)', () => {
    for (const ch of CHAPTERS) {
      const exp = experienceFor(ch)
      expect(exp.id).toBe(ch.experienceId)
      expect(exp.highlights.length).toBeGreaterThan(0)
    }
  })

  it('every chapter has the four pop-up layers in depth order', () => {
    for (const ch of CHAPTERS) {
      expect(ch.layers.map((l) => l.kind)).toEqual([
        'backdrop',
        'midground',
        'hero',
        'foreground',
      ])
      const zs = ch.layers.map((l) => l.apexZ)
      expect([...zs].sort((a, b) => a - b)).toEqual(zs) // far → near
    }
  })

  it('narration respects the no-lead-claims rule', () => {
    const ch6 = CHAPTERS[5]
    expect(ch6.narration.toLowerCase()).not.toMatch(/\blead(s|ing|er)?\b/)
    expect(ch6.narration).toMatch(/apprentices/)
  })

  it('gives every non-chapter spread with pop-up content its own layers', () => {
    expect(EXTRA_SPREAD_LAYERS[1]).toBe(TITLE_LAYERS)
    for (const spread of [1, 8, 9]) {
      const content = popupContentForSpread(spread)
      expect(content?.layers.length).toBeGreaterThan(0)
      expect(content?.accents.length).toBeGreaterThan(0)
    }
  })

  it('resolves pop-up content for chapters too, and nothing for the closed cover', () => {
    expect(popupContentForSpread(4)?.layers).toBe(chapterForSpread(4)?.layers)
    expect(popupContentForSpread(0)).toBeUndefined()
  })
})
