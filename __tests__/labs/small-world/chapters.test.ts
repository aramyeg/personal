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

  it('carries the story pack through verbatim, except for the one recorded edit', () => {
    // THE PACK IS STILL THE SOURCE. Themes and captions are its words untouched,
    // and this is the gate that stops anyone quietly rewriting a real person's CV.
    const last = chapters[CHAPTER_COUNT - 1]
    expect(last.theme).toBe('The Observatory')
    expect(last.caption).toBe('Frontend Engineer · Sync Design Tech · 2025–now')

    // THE HOOKS CHANGED PERSON, and only person. The pack wrote them for a
    // narrator — "Now she owns the glass" — and the lab has no narrator any more:
    // every other word in it is hers. They also rendered NOWHERE until the blind
    // audit found them (their only consumer was the no-WebGL fallback), so the
    // third person had never been seen to be wrong. Recorded here rather than
    // silently updated, alongside the pack's own line for comparison.
    //
    //   pack:    "Now she owns the glass — and the foundations under the snow."
    //   shipped: "Now I keep the glass — and the foundations under the snow."
    expect(last.hook).toBe('Now I keep the glass — and the foundations under the snow.')
    expect(last.hook).toContain('the foundations under the snow')
  })

  it('speaks every hook in the first person', () => {
    // The law the audit's inversion made explicit: the piece is her CV in her
    // voice, so a hook that talks ABOUT her is a bio someone else wrote. Cheap to
    // assert, and it is the thing that went unnoticed for four rounds.
    for (const c of chapters) {
      expect(/\b(I|my|me|mine|myself)\b/i.test(c.hook), `${c.id} speaks as herself`).toBe(true)
      expect(/\b(she|her|herself)\b/i.test(c.hook), `${c.id} avoids the third person`).toBe(false)
    }
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

  it('never prints the same word as both a pill and a stamp', () => {
    // The two rows sit one above the other on the card. A word in both reads as
    // a mistake, not as emphasis — chapter 6 shipped "real-time" twice until a
    // capture caught it.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
    for (const c of chapters) {
      const pills = new Set(c.tech.map(norm))
      for (const stamp of c.stamps) {
        expect(pills.has(norm(stamp)), `${c.id}: "${stamp}" is also a tech pill`).toBe(false)
      }
    }
  })

  it('palette anchors match the spec', () => {
    expect(PALETTE.meadow).toBe('#7BC47F')
    expect(PALETTE.blossom).toBe('#F7A8C4')
    expect(PALETTE.river).toBe('#6FB7D9')
    expect(PALETTE.sky).toBe('#FFF3D6')
  })
})
