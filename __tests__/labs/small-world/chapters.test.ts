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

  it('carries the round-3 pack through verbatim', () => {
    // THE PACK IS THE SOURCE, and this is the gate that stops anyone quietly
    // rewriting a real person's CV. Pinned on the LAST stop because it is the one
    // a careless edit reaches for first — it is her current job.
    const last = chapters[CHAPTER_COUNT - 1]
    expect(last.theme).toBe('The dashboards')
    expect(last.caption).toBe('Frontend Engineer — Sync Design Tech, 2025–now')
    expect(last.hook).toBe('Now I build dashboards where the data never sits still.')
  })

  it('keeps the dead metrics dead', () => {
    // FILTERED ON ATTRIBUTABILITY, which is a truthfulness question and not an
    // editing one: these are numbers she cannot personally stand behind. A future
    // round adding "impact" back is exactly how they return, so the gate is on the
    // strings rather than on anyone's memory. `+15% session` is deliberately NOT
    // here — it survives, as a body line.
    const words = JSON.stringify(chapters)
    for (const dead of ['42%', '19%', 'retention', '30% smoother']) {
      expect(words, `"${dead}" came back`).not.toContain(dead)
    }
  })

  it('spends stamps scarcely: three in the whole walk, on two stops', () => {
    // A STAMP ROW ON EVERY CHAPTER was the loudest generated-copy tell the research
    // round found, and the fix is scarcity rather than wording: a badge means "this
    // one is the number", and six of them mean nothing. Asserted as a census, so
    // helpfully filling an empty array fails loudly.
    expect(chapters.filter((c) => c.stamps.length > 0)).toHaveLength(2)
    expect(chapters.reduce((n, c) => n + c.stamps.length, 0)).toBe(3)
  })

  it('never describes her from outside — hooks AND body lines', () => {
    // THE LAW: the piece is her CV in her voice, so a line that talks ABOUT her is
    // a bio someone else wrote.
    //
    // IT IS BROADER THAN IT WAS, AND WEAKER IN ONE PLACE, both deliberately.
    // Broader: it checked hooks only, and the body lines were shipping "no code
    // needed by anyone but her" and "The whole picture, hers." — third person,
    // rendered, unnoticed for four rounds. Weaker: it also required an explicit
    // first-person PRONOUN, and the approved round-3 copy elides the subject on
    // three stops ("Eight months on a sports platform. All the small stuff."),
    // which is still first person and is how a CV line is normally written.
    // Requiring a pronoun would reject approved copy, so what is kept is the half
    // of the gate with teeth.
    for (const c of chapters) {
      for (const text of [c.hook, ...c.lines]) {
        expect(/(she|her|hers|herself)/i.test(text), `${c.id}: "${text}" is third person`).toBe(
          false
        )
      }
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
      // A wall label names the years. The separator is the pack's em dash now, so
      // asserting a middot would only have been pinning the punctuation.
      expect(c.caption).toMatch(/\d{4}/)
      expect(c.lines.length).toBeGreaterThan(0)
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
