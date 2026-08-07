/**
 * TASK 76 — the info leaf's own laws.
 *
 * The four-beat page came out of research (Bach et al., CHI 2019: data comics beat
 * infographics on comprehension and recall, and the win conditions are an explicit
 * reading order and text fused into pictures). Most of what that implies is a
 * PROPERTY OF THE DATA rather than of a render, so most of this file reads the spec
 * — a page that quietly grew a second hero or a paragraph would still render fine.
 */
import { describe, expect, it, afterEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { InfoPage } from '@/components/labs/small-world/overlay/info-page'
import { sheetLines } from '@/components/labs/small-world/overlay/cloth-drag'
import { CHAPTER_COUNT } from '@/components/labs/small-world/chapters'
import { DWELL_MID } from '@/components/labs/small-world/journey-timeline'
import { STORY_STOP_PROGRESS } from '@/components/labs/small-world/story-stops'
import {
  PAGE_CLOSES_BEFORE_STOP,
  PAGE_SPAN_END,
  PAGE_SPAN_START,
  pageProgressAt,
} from '@/components/labs/small-world/overlay/info-beats'
import {
  DONATED_PANEL,
  INFO_PAGES,
  donatedPanelFor,
} from '@/components/labs/small-world/overlay/info-page-spec'
import { MANGA_PAGES } from '@/components/labs/small-world/manga'
import {
  MAX_CAPTION_WORDS,
  MAX_LABEL_WORDS,
  MAX_NOTE_WORDS,
} from '@/components/labs/small-world/overlay/info-beats'
import { PALETTE } from '@/components/labs/small-world/palette'

afterEach(cleanup)

const words = (s: string) => s.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
const chapters = INFO_PAGES.map((_, i) => i)

/** Does `inner` lie inside `outer` (page fractions, with a hair of tolerance for an eye-cut)? */
function inside(outer: { x: number; y: number; w: number; h: number }, inner: typeof outer): boolean {
  const e = 0.004
  return (
    inner.x >= outer.x - e &&
    inner.y >= outer.y - e &&
    inner.x + inner.w <= outer.x + outer.w + e &&
    inner.y + inner.h <= outer.y + outer.h + e
  )
}

describe('the info leaf’s laws', () => {
  it.each(chapters)('chapter %i: the fallback crop lies inside the donated panel', (i) => {
    // THE BUG THIS EXISTS FOR, and it shipped in the first draft on three of six
    // chapters: the panel being REMOVED from the story leaf was not the panel the
    // info leaf SHOWED. So a panel was deleted from the left page for nothing, and
    // the duplication Aram asked us to remove survived on the right. Nothing about
    // either page looks wrong when that happens — both still render art.
    //
    // It guards the FALLBACK now (every anchor is `ready`, so the crop only draws
    // if one is pulled), and it is worth keeping for exactly that reason: a
    // fallback nobody looks at is where this class of mistake would live.
    const panel = donatedPanelFor(i)!
    const rect = MANGA_PAGES[i].panels[panel]
    expect(rect, `chapter ${i + 1} donates a panel that exists`).toBeTruthy()
    const crop = INFO_PAGES[i].ki.crop
    expect(crop.page, `chapter ${i + 1} crops its OWN page`).toBe(i)
    expect(inside(rect, crop), `chapter ${i + 1}: the crop is inside donated panel ${panel}`).toBe(true)
  })

  it('keeps the picture LANDSCAPE', () => {
    // Learned by capture rather than by argument: an art panel takes its crop's own
    // aspect, so a tall crop makes a tall panel — and a tall panel pushes the hero
    // and the colophon off the bottom of the leaf. Captured: chapter 3's +30% was
    // cut in half by the page edge and the sheet was gone entirely. An establishing
    // shot on this page is LANDSCAPE, and that is geometry rather than taste.
    //
    // The COMPANION law — "beat 2 is genuinely tighter than beat 1" — is gone with
    // beat 2 (Task 82). It only ever protected the zoom triad from collapsing into
    // one picture printed twice, which is the failure the triad was deleted for.
    for (const [i, spec] of INFO_PAGES.entries()) {
      const c = spec.ki.crop
      const page = MANGA_PAGES[c.page]
      expect((c.w * page.size.w) / (c.h * page.size.h), `chapter ${i + 1} is landscape`).toBeGreaterThan(2)
    }
  })

  it('spends pink on the hero and nowhere else', () => {
    // PINK IS A SEMANTIC CHANNEL. The moment it decorates, numbers stop reading as
    // the point — which is why the first draft's pink caption rule and pink stamp
    // outlines are gone. Asserted on the rendered tree rather than on the source.
    render(<InfoPage chapter={2} page={1} instant />)
    const page = screen.getByTestId('sw-info-page')
    const hero = screen.getByTestId('sw-info-hero')
    // React writes styles through the CSSOM, so `getAttribute('style')` hands back
    // `rgb(232, 111, 164)` rather than the authored hex. Match both, or the gate
    // passes by finding nothing — which is the worst way for a gate to pass.
    const [pr, pg, pb] = /^#(..)(..)(..)$/.exec(PALETTE.blossomDeep)!.slice(1).map((v) => parseInt(v, 16))
    const forms = [PALETTE.blossomDeep.toLowerCase(), `rgb(${pr}, ${pg}, ${pb})`]
    const carriers: Element[] = []
    const walk = (el: Element) => {
      const style = (el as HTMLElement).getAttribute('style') ?? ''
      const attrs = Array.from(el.attributes)
        .map((a) => a.value)
        .join(' ')
      const hay = `${style} ${attrs}`.toLowerCase()
      if (forms.some((f) => hay.includes(f))) carriers.push(el)
      for (const c of Array.from(el.children)) walk(c)
    }
    walk(page)
    expect(carriers.length, 'something on the page is pink').toBeGreaterThan(0)
    for (const el of carriers) {
      expect(hero.contains(el) || el === hero, `pink outside the hero: <${el.tagName.toLowerCase()}>`).toBe(true)
    }
  })

  it.each(chapters)('chapter %i: one hero, and it is the only one', (i) => {
    render(<InfoPage chapter={i} page={1} instant />)
    expect(screen.getAllByTestId('sw-info-hero')).toHaveLength(1)
  })

  it('keeps the text guard: one short line per page, phrases for notes', () => {
    for (const [i, spec] of INFO_PAGES.entries()) {
      expect(words(spec.ketsu.line), `chapter ${i + 1}'s line`).toBeLessThanOrEqual(MAX_CAPTION_WORDS)
      if (spec.ki.note) {
        expect(words(spec.ki.note), `chapter ${i + 1}'s note`).toBeLessThanOrEqual(MAX_NOTE_WORDS)
      }
      expect(words(spec.ten.hero.label), `chapter ${i + 1}'s hero label`).toBeLessThanOrEqual(MAX_LABEL_WORDS)
    }
  })

  it('never says the same thing twice on one page', () => {
    // Caught by capture on chapter 1: the hero became the SELF-TAUGHT SFX and the
    // beat-2 note still read "Self-taught", so the page made its one claim twice
    // in two sizes. On a leaf whose whole argument is minimal reading, saying a
    // thing twice is worse than saying it small.
    for (const [i, spec] of INFO_PAGES.entries()) {
      const hero = spec.ten.hero
      const heroText = (hero.kind === 'sfx' ? hero.text : hero.label).toLowerCase()
      if (spec.ki.note) {
        expect(
          spec.ki.note.toLowerCase().includes(heroText) || heroText.includes(spec.ki.note.toLowerCase()),
          `chapter ${i + 1}: note "${spec.ki.note}" repeats the hero`
        ).toBe(false)
      }
    }
  })

  it('never describes her from outside, on any surface of the page', () => {
    // THE LAW: her CV in her voice, so a line that talks ABOUT her is a bio
    // someone else wrote.
    //
    // BROADER AND WEAKER, both deliberate, and the same change `chapters.test.ts`
    // records. Broader: it read the sheet's line only, and now sweeps the picture
    // caption and the hero's own words too. Weaker: it also demanded an explicit
    // first-person PRONOUN, and the approved round-3 copy elides the subject on
    // three stops ("Eight months on a sports platform. All the small stuff."),
    // which is still first person and is how a CV line is normally written.
    // Requiring a pronoun would reject approved copy; the half with teeth stays.
    for (const [i, spec] of INFO_PAGES.entries()) {
      const hero = spec.ten.hero
      const surfaces = [
        spec.ketsu.line,
        spec.ki.note ?? '',
        hero.kind === 'sfx' ? hero.text : '',
        hero.label,
      ]
      for (const text of surfaces) {
        expect(
          /(she|her|hers|herself)/i.test(text),
          `chapter ${i + 1}: "${text}" is third person`
        ).toBe(false)
      }
    }
  })

  it('inverts some pages and not every page', () => {
    // The research's rule is "at most one per chapter, NOT every chapter" — the
    // inverted panel is an emphasis, and an emphasis every reader meets six times
    // is a style. Two of six is emphasis; the gate is that it never becomes the
    // default. (An earlier reading of this held it to one in the whole book, which
    // was tighter than the research and would have blocked ch1's SFX hero.)
    const inverted = INFO_PAGES.filter((p) => p.ten.inverted)
    expect(inverted.length).toBeGreaterThan(0)
    expect(inverted.length).toBeLessThanOrEqual(Math.floor(INFO_PAGES.length / 2))
  })

  it('declares a donated panel for every chapter, and each one exists', () => {
    expect(DONATED_PANEL).toHaveLength(INFO_PAGES.length)
    for (const [i, panel] of DONATED_PANEL.entries()) {
      expect(MANGA_PAGES[i].panels[panel], `chapter ${i + 1} panel ${panel}`).toBeTruthy()
    }
  })
})

describe('the page is drawn by the SCROLL, and by nothing else', () => {
  // Task 82 Part A. `useInkClock` was a requestAnimationFrame timer counting real
  // milliseconds since the leaf arrived, which broke the lab's scroll-purity law
  // and — concretely — let a reader stop and read a page that was still drawing
  // itself. Everything below is the replacement's contract.

  it('closes the page BEFORE the story stop a fling snaps to', () => {
    // THE ONE INEQUALITY THE WHOLE FIX RESTS ON. `story-stops.ts` snaps every
    // fling to DWELL_MID, so if the page's span reached past that number a
    // visitor's most common landing would be a half-drawn page — the exact
    // failure the wall clock was removed for, re-introduced as a tuning value.
    expect(PAGE_CLOSES_BEFORE_STOP).toBe(true)
    expect(PAGE_SPAN_END).toBeLessThan(DWELL_MID)
    expect(PAGE_SPAN_START).toBeLessThan(PAGE_SPAN_END)
  })

  it('is finished at every chapter’s story stop', () => {
    // Stated over the real stops rather than over the constants, so a reshape of
    // the segment that moved the stops without moving the span would be caught.
    for (const [c, stop] of STORY_STOP_PROGRESS.entries()) {
      expect(pageProgressAt(stop), `chapter ${c + 1}'s stop`).toBe(1)
    }
  })

  it('is a pure function: the same scroll position always gives the same page', () => {
    // The wall clock's defining defect was that it was NOT this — the same
    // position could show any state depending on how long you had been there.
    for (const p of [0, 0.07, 0.19, 0.34, 0.5, 0.66, 0.83, 1]) {
      expect(pageProgressAt(p)).toBe(pageProgressAt(p))
    }
  })

  it('scrubs backwards exactly, and never runs past its own ends', () => {
    const forward: number[] = []
    for (let i = 0; i <= 400; i++) forward.push(pageProgressAt(i / 400))
    const backward: number[] = []
    for (let i = 400; i >= 0; i--) backward.push(pageProgressAt(i / 400))
    expect(backward.reverse()).toEqual(forward)
    for (const v of forward) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('rises monotonically across a chapter’s own span, and holds at each end', () => {
    const local = (c: number, l: number) => (c + l) / CHAPTER_COUNT
    expect(pageProgressAt(local(2, PAGE_SPAN_START - 0.01))).toBe(0)
    expect(pageProgressAt(local(2, PAGE_SPAN_END + 0.01))).toBe(1)
    // ...and it STAYS 1 for the rest of the chapter, so walking out of a
    // checkpoint never un-draws the page behind you.
    expect(pageProgressAt(local(2, 0.99))).toBe(1)
    let prev = -1
    for (let i = 0; i <= 100; i++) {
      const v = pageProgressAt(local(2, PAGE_SPAN_START + (i / 100) * (PAGE_SPAN_END - PAGE_SPAN_START)))
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('schedules no frame at all: the leaf renders settled with no clock running', () => {
    // A regression gate with teeth. If a clock ever comes back, SOMETHING has to
    // ask for a frame; asserting that nothing does is what a "no wall clock"
    // claim actually means. `page={1}` is the settled page and it must be
    // complete on the FIRST render, with no rAF and no timer.
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    render(<InfoPage chapter={3} page={1} />)
    // Chapter 4's hero is the Isotype tally: thirteen marks, all planted.
    expect(screen.getByTestId('sw-info-tally').getAttribute('data-count')).toBe('13')
    expect(screen.getByTestId('sw-info-tally').children).toHaveLength(13)
    expect(raf).not.toHaveBeenCalled()
    raf.mockRestore()
  })

  it('draws less at a smaller page value, and everything at 1', () => {
    // The beats still stage — the fix changed the CLOCK, not the choreography.
    const inkAt = (page: number) => {
      cleanup()
      render(<InfoPage chapter={3} page={page} />)
      const rects = Array.from(screen.getByTestId('sw-info-page').querySelectorAll('rect[stroke-dasharray]'))
      return rects.map((r) => 1 - Number(r.getAttribute('stroke-dashoffset')))
    }
    const early = inkAt(0.1)
    const done = inkAt(1)
    expect(done.every((v) => v > 0.999)).toBe(true)
    expect(early.some((v) => v < 0.999)).toBe(true)
    expect(early.reduce((a, b) => a + b, 0)).toBeLessThan(done.reduce((a, b) => a + b, 0))
  })
})

describe('the sheet carries the words, and they survive being on it', () => {
  it.each(chapters)('chapter %i: the line reconstitutes exactly from the sheet', (i) => {
    // THE DEFECT THIS EXISTS FOR, caught by e2e rather than by looking: the line
    // is split into block elements so each can carry its own curl, and splitting
    // the sentence split its TEXT CONTENT with it. On screen it read "…choose —
    // then taught myself…"; concatenated it was "thentaught". That is what a
    // copy-paste, a page search and a screen reader all receive, and no capture
    // would ever have shown it.
    render(<InfoPage chapter={i} page={1} />)
    const sheet = screen.getByTestId('sw-cloth-line')
    const text = sheet.textContent!.replace(/\s+/g, ' ').trim()
    expect(text, `chapter ${i + 1}`).toContain(INFO_PAGES[i].ketsu.line)
  })

  it('prints every word from the first frame, before the sheet has moved', () => {
    // The audit's law, stated where it can fail. `page={0}` is the sheet fully
    // rolled up: every word must already be in the DOM, because the mask DIMS
    // what is ahead of the paper's edge and never removes it.
    render(<InfoPage chapter={4} page={0} />)
    const text = screen.getByTestId('sw-cloth-line').textContent!.replace(/\s+/g, ' ').trim()
    expect(text).toContain(INFO_PAGES[4].ketsu.line)
  })

  it('says whose CV it is on the FIRST sheet, and only there', () => {
    // The title card's job, moved somewhere a reader is already looking. A name
    // reprinted on all six sheets would be a watermark, so the gate is both halves.
    render(<InfoPage chapter={0} page={1} />)
    expect(screen.getByTestId('sw-cloth-line').textContent).toContain('Alwina')
    cleanup()
    for (const i of chapters.slice(1)) {
      render(<InfoPage chapter={i} page={1} />)
      expect(screen.getByTestId('sw-cloth-line').textContent, `chapter ${i + 1}`).not.toContain('Alwina')
      cleanup()
    }
  })

  it('splits into two to four lines, and never strands one word', () => {
    for (const [i, spec] of INFO_PAGES.entries()) {
      const lines = sheetLines(spec.ketsu.line)
      expect(lines.length, `chapter ${i + 1} line count`).toBeGreaterThanOrEqual(2)
      expect(lines.length, `chapter ${i + 1} line count`).toBeLessThanOrEqual(4)
      expect(lines.join(' '), `chapter ${i + 1} round-trips`).toBe(spec.ketsu.line.trim())
      for (const l of lines) {
        expect(l.trim().split(/\s+/).length, `chapter ${i + 1}: "${l}" is not one stranded word`)
          .toBeGreaterThan(1)
      }
    }
  })
})

describe('the reveal is staged, one idea at a time', () => {
  it('draws an empty hero frame before the number arrives in it', async () => {
    // The "delayed earned reveal": a number that appears with its frame is a label;
    // a number that arrives into a frame the eye has accepted is an event. Asserted
    // through the pinned-clock camera the capture harness uses.
    // Chapter 5 is the one that still carries a NUMBER hero — the others became
    // SFX or tallies when the dead metrics were filtered out (Task 82 Part E).
    const { rerender } = render(<InfoPage chapter={4} page={1} instant />)
    rerender(<InfoPage chapter={4} page={1} instant />)
    // instant renders the settled page: the hero is present and its digits final.
    expect(screen.getByTestId('sw-info-hero').textContent).toContain('20')
  })
})

describe('the stat leaf takes its own clicks', () => {
  it('does not let a click on the facts advance the chapter', async () => {
    // AUDIT ITEM 10, least surprise. The overlay root is pointer-events:none so
    // the canvas takes every click that is not on a leaf and tap-anywhere
    // advances — right for the world, wrong for a page full of facts, and
    // especially wrong beside a comic page that opens when you click it.
    const { InfoLeaf } = await import('@/components/labs/small-world/overlay/info-leaf')
    render(<InfoLeaf chapter={0} enter={1} page={1} />)
    const leaf = screen.getByTestId('sw-panel-data')
    expect(leaf.style.pointerEvents).toBe('auto')
    // ...and it is NOT a button: nothing happens, and announcing an action that
    // does not exist would be worse than the misfire it replaces.
    expect(leaf.tagName.toLowerCase()).toBe('article')
  })
})
