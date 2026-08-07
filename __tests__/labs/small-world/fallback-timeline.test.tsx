import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FallbackTimeline } from '@/components/labs/small-world/fallback-timeline'
import { FALLBACK_STYLE } from '@/components/labs/small-world/fallback-timeline-style'
import { FALLBACK_CLASS } from '@/components/labs/small-world/fallback-class'
import { PALETTE } from '@/components/labs/small-world/palette'
import { ALWINA_STORY } from '@/components/labs/small-world/alwina-story'

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
