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

  it('every chapter has a bespoke construction: a backdrop, its own mix, no duplicate template', () => {
    const signatures = new Set<string>()
    for (const ch of CHAPTERS) {
      // every scene is anchored by a backdrop wall and has depth to it
      expect(ch.layers[0].kind).toBe('backdrop')
      expect(ch.layers.length).toBeGreaterThanOrEqual(3)
      // page-glued pieces come far -> near; children ride their parents and
      // sit next to them in the list instead
      const zs = ch.layers.filter((l) => l.mech === 'vfold').map((l) => l.apexZ)
      expect([...zs].sort((a, b) => a - b)).toEqual(zs)
      // the variation phase's whole point: no two chapters share a
      // construction (mechanism sequence + sizes)
      signatures.add(
        ch.layers
          .map((l) => {
            const size =
              l.mech === 'parallel'
                ? l.glueL + l.glueR
                : l.mech === 'box'
                  ? l.a
                  : l.mech === 'platform'
                    ? l.qA + l.qB
                    : l.mech === 'fan'
                      ? l.members.length
                      : l.mech === 'tabpiece'
                        ? l.legW
                        : l.mech === 'kinetic'
                          ? l.armLen
                          : l.mech === 'rotor'
                            ? l.radius
                            : l.mech === 'knobtower'
                              ? l.crankR
                              : l.mech === 'keepsake'
                                ? l.cardL
                                : l.mech === 'keepstack'
                                  ? l.stories.length
                                  : l.mech === 'keepwinch'
                                    ? l.crankR
                                    : l.mech === 'skyline'
                                      ? l.rows.length
                                      : l.mech === 'volvelle'
                                        ? l.radius
                                        : l.mech === 'liftflap'
                                          ? l.leafLen
                                          : l.mech === 'depthvista'
                                            ? l.wings.length
                                            : l.mech === 'dissolve'
                                              ? l.slats
                                              : l.mech === 'swarmarc'
                                                ? l.struts.length
                                                : l.mech === 'mfoldrange'
                                                  ? l.ranks.length
                                                : l.width
            return `${l.mech}:${size}`
          })
          .join('|')
      )
    }
    expect(signatures.size).toBe(CHAPTERS.length)
  })

  it('children reference an earlier v-fold in their own spread', () => {
    for (const ch of CHAPTERS) {
      for (const layer of ch.layers) {
        if (layer.mech !== 'child') continue
        const parentIndex = ch.layers.findIndex((l) => l.id === layer.parentId)
        expect(parentIndex).toBeGreaterThanOrEqual(0)
        expect(parentIndex).toBeLessThan(ch.layers.indexOf(layer))
        expect(ch.layers[parentIndex].mech).toBe('vfold')
      }
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
