import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CvDocument } from '@/components/labs/small-world/overlay/cv-document'
import { CV_DOC_TESTID } from '@/components/labs/small-world/overlay/cv-open'
import { InfoPage } from '@/components/labs/small-world/overlay/info-page'
import { JourneyProgress } from '@/components/labs/small-world/overlay/journey-progress'
import { FallbackTimeline } from '@/components/labs/small-world/fallback-timeline'
import { FALLBACK_STYLE } from '@/components/labs/small-world/fallback-timeline-style'
import { FALLBACK_CLASS } from '@/components/labs/small-world/fallback-class'
import { PALETTE } from '@/components/labs/small-world/palette'
import { ALWINA_STORY, SMALL_WORLD_PREMISE } from '@/components/labs/small-world/alwina-story'

afterEach(cleanup)

describe('FALLBACK_STYLE (pre-scene pastel identity)', () => {
  it('ships an OPAQUE pastel background so the dark site theme never shows through', () => {
    // The bug: the fallback was transparent, so during the chunk-load window the
    // dark `--background` showed as black behind white career text. Guard that it
    // now paints the lab's own butter-cream → pink backdrop.
    expect(FALLBACK_STYLE).toContain('linear-gradient')
    expect(FALLBACK_STYLE).toContain(PALETTE.sky)
    expect(FALLBACK_STYLE).toContain(PALETTE.horizon)
    // never transparent / theme-inherited
    expect(FALLBACK_STYLE).not.toMatch(/background\s*:\s*(transparent|none)/i)
  })

  it('uses ink text (not the theme foreground) and covers the viewport', () => {
    expect(FALLBACK_STYLE).toContain(`color:${PALETTE.ink}`)
    expect(FALLBACK_STYLE).toContain('min-height:100dvh')
  })

  it('is fully scoped under the fallback class so it cannot leak to the site', () => {
    // Every rule block must be prefixed with the fallback selector.
    const selectors = FALLBACK_STYLE.match(/[^{}]+(?=\{)/g) ?? []
    expect(selectors.length).toBeGreaterThan(0)
    for (const sel of selectors) {
      expect(sel).toContain(`.${FALLBACK_CLASS}`)
    }
  })
})

describe('FallbackTimeline (server-rendered, crawlable)', () => {
  it('renders the pastel style block AND stays crawlable (career text intact)', () => {
    render(<FallbackTimeline />)
    const section = screen.getByTestId('small-world-fallback')
    expect(section).toHaveClass(FALLBACK_CLASS)
    // Crawler-facing content still present (mirrors the e2e crawler assertions).
    // The lab tells Alwina's story now, so this is HER career — the same six
    // chapters the scene tells, in markup a crawler and a no-WebGL visitor read.
    // READ FROM THE STORY, never pinned as strings: Task 82 wired the approved
    // round-3 pack and all three of these literals moved. As literals they would
    // have failed as a copy edit rather than as a crawlable-content defect, which
    // is the only thing this assertion is here to catch.
    expect(section).toHaveTextContent(ALWINA_STORY[ALWINA_STORY.length - 1].theme)
    expect(section).toHaveTextContent(ALWINA_STORY[ALWINA_STORY.length - 1].caption)
    expect(section).toHaveTextContent(ALWINA_STORY[0].theme)
    // The pastel skin ships inline with the markup.
    expect(section.querySelector('style')?.textContent).toContain('linear-gradient')
  })
})

describe('the default experience carries every fact the fallback does', () => {
  /**
   * TASK 85, FINDING 10 — THE REDUCED-MOTION BUILD WAS THE BETTER CV.
   *
   * `prefers-reduced-motion: reduce` served chapter titles, three substantive
   * claims per role, full metrics, and the only stated premise in the product —
   * "Small World — a career in one lap of a tiny planet". The animated build
   * served a strict SUBSET. The blind audit's words: "the best sentence in the
   * product is served only to people who asked for less motion."
   *
   * The two may disagree about presentation. They may not disagree about what the
   * FACTS are, and the direction of the fix is settled by the INFO score: the
   * default gains them and the fallback loses nothing.
   *
   * Each fact is asserted at its new home rather than by scraping a rendered
   * page, because the homes are the decision: titles on the progress rail (up for
   * the whole journey, and the only words in the long travel stretches), claims
   * on the plain CV (the dense surface, behind two doors), the premise on the
   * first sheet (where a title page puts it).
   */
  it('states the premise once, and both openings print that one', () => {
    // It was a literal in the `<h1>` below and nowhere else.
    render(<FallbackTimeline />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(SMALL_WORLD_PREMISE)
    cleanup()
    // ...and the first sheet — the default's opening — prints the same constant.
    render(<InfoPage chapter={0} page={1} instant />)
    expect(screen.getByTestId('sw-info-page').textContent).toContain(SMALL_WORLD_PREMISE)
    cleanup()
    // ONE SHEET ONLY. A premise reprinted six times is a watermark, exactly as
    // her name would be.
    for (let c = 1; c < ALWINA_STORY.length; c++) {
      render(<InfoPage chapter={c} page={1} instant />)
      expect(screen.getByTestId('sw-info-page').textContent, `chapter ${c + 1}`).not.toContain(
        SMALL_WORLD_PREMISE
      )
      cleanup()
    }
  })

  it('gives every chapter title a home in the animated build', () => {
    // `theme` reached only the fallback. The rail already knows the chapter and is
    // mounted for the whole journey, so it costs no new surface.
    const progressRef = { current: 0 }
    for (const [i, ch] of ALWINA_STORY.entries()) {
      progressRef.current = (i + 0.5) / ALWINA_STORY.length
      render(<JourneyProgress progressRef={progressRef} />)
      expect(screen.getByRole('group').textContent, `chapter ${i + 1}`).toContain(ch.theme)
      cleanup()
    }
  })

  it('gives every claim a home in the animated build', () => {
    // Three sentences per chapter is the thing the info leaf exists NOT to be —
    // it has a seven-word text guard. The plain CV is the opposite by design, and
    // it is in the default experience behind two doors.
    render(<CvDocument />)
    const text = screen.getByTestId(CV_DOC_TESTID).textContent!.replace(/\s+/g, ' ')
    for (const ch of ALWINA_STORY) {
      for (const claim of ch.lines) {
        expect(text, `"${claim}" reaches the default`).toContain(claim)
      }
    }
  })

  it('leaves the fallback a superset of nothing but its own chrome', () => {
    // THE STANDING GATE. Everything the fallback prints per chapter must be
    // reachable in the default; a future line added to `alwina-story` fails here
    // until it is given a home, which is what stops the two drifting apart again.
    render(<FallbackTimeline />)
    const fallbackFacts = new Set<string>()
    for (const ch of ALWINA_STORY) {
      fallbackFacts.add(ch.theme)
      fallbackFacts.add(ch.hook)
      for (const l of ch.lines) fallbackFacts.add(l)
    }
    cleanup()

    const surfaces: string[] = []
    render(<CvDocument />)
    surfaces.push(screen.getByTestId(CV_DOC_TESTID).textContent ?? '')
    cleanup()
    for (let c = 0; c < ALWINA_STORY.length; c++) {
      render(<InfoPage chapter={c} page={1} instant />)
      surfaces.push(screen.getByTestId('sw-info-page').textContent ?? '')
      cleanup()
      const progressRef = { current: (c + 0.5) / ALWINA_STORY.length }
      render(<JourneyProgress progressRef={progressRef} />)
      surfaces.push(screen.getByRole('group').textContent ?? '')
      cleanup()
    }
    const dflt = surfaces.join(' ').replace(/\s+/g, ' ')
    const missing = [...fallbackFacts].filter((f) => !dflt.includes(f.replace(/\s+/g, ' ')))
    expect(missing, `facts the fallback carries and the default does not`).toEqual([])
  })
})
