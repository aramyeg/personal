import { describe, it, expect } from 'vitest'
import { chapters, CHAPTER_COUNT } from '@/components/labs/small-world/chapters'
import { ALWINA_STORY } from '@/components/labs/small-world/alwina-story'
import { PALETTE } from '@/components/labs/small-world/palette'

describe('small-world chapters', () => {
  it('exposes exactly six chapters, oldest first', () => {
    expect(chapters).toHaveLength(CHAPTER_COUNT)
    expect(chapters[0].id).toBe('lyon')
    expect(chapters[CHAPTER_COUNT - 1].id).toBe('sync-design')
  })

  it('carries the story pack through verbatim', () => {
    const last = chapters[CHAPTER_COUNT - 1]
    expect(last.theme).toBe('The Observatory')
    expect(last.caption).toBe('Frontend Engineer · Sync Design Tech · 2025–now')
    expect(last.hook).toBe('Now she owns the glass — and the foundations under the snow.')
  })

  it('tells ALWINA’s story, not the portfolio’s', () => {
    // The lab is a gift now. `data/experience.ts` is Aram's CV and still feeds the
    // portfolio's own Experience section; if this module ever reaches for it again,
    // the two stories have started leaking into each other.
    const words = JSON.stringify(chapters)
    for (const aram of ['xDataGroup', 'BlueNet', '360dialog', 'Flyerbee', 'Accenture']) {
      expect(words).not.toContain(aram)
    }
  })

  it('gives every chapter its index, a theme, a hook, a caption and a hex accent', () => {
    chapters.forEach((c, i) => {
      expect(c.index).toBe(i)
      expect(c.theme.length).toBeGreaterThan(0)
      expect(c.hook.length).toBeGreaterThan(0)
      expect(c.caption).toContain('·')
      expect(c.lines.length).toBeGreaterThan(0)
      expect(c.stamps.length).toBeGreaterThan(0)
      expect(c.tech.length).toBeGreaterThan(0)
      expect(c.accent).toMatch(/^#[0-9A-Fa-f]{6}$/)
    })
  })

  it('adds nothing to the story pack but the index', () => {
    // The mapping must stay thin: one source of words. A field invented here would
    // be a claim about a real person with no line of the pack behind it.
    chapters.forEach((c, i) => {
      const { index, ...rest } = c
      expect(index).toBe(i)
      expect(rest).toEqual(ALWINA_STORY[i])
    })
  })

  it('palette anchors match the spec', () => {
    expect(PALETTE.meadow).toBe('#7BC47F')
    expect(PALETTE.blossom).toBe('#F7A8C4')
    expect(PALETTE.river).toBe('#6FB7D9')
    expect(PALETTE.sky).toBe('#FFF3D6')
  })
})
