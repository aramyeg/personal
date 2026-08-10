import { describe, expect, it, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MangaPageArt } from '@/components/labs/small-world/overlay/manga-page'
import { MANGA_PAGES } from '@/components/labs/small-world/manga'

afterEach(cleanup)

/**
 * A MANGA PAGE IS COMPLETE ON ITS FIRST FRAME (T111).
 *
 * Aram: "I want to see the manga pages with initially loaded texts, without the
 * animation." The page used to run its own 2.6s clock — panels landing one at a
 * time, lettering typing a beat behind each — and these are the laws that keep
 * it from growing back. They assert the FIRST render, with no timers advanced
 * and no act() pumping a frame, because "from frame one" is the whole order.
 *
 * The spread's own entrance and the info leaf's draw are deliberately NOT tested
 * here: they were not in the order and they still animate (info-page.test.tsx).
 */
describe('a manga page renders complete from its first frame', () => {
  it('mounts every panel', () => {
    for (const page of MANGA_PAGES) {
      cleanup()
      render(<MangaPageArt page={page} />)
      expect(
        document.querySelectorAll('[data-manga-panel]').length,
        `${page.id} shows all ${page.panels.length} panels`
      ).toBe(page.panels.length)
    }
  })

  it('prints every line of every balloon and caption whole', () => {
    for (const page of MANGA_PAGES) {
      cleanup()
      render(<MangaPageArt page={page} />)
      const balloons = [...document.querySelectorAll('[data-sw-text="balloon"]')].map(
        (n) => n.textContent
      )
      const captions = [...document.querySelectorAll('[data-sw-text="caption"]')].map(
        (n) => n.textContent
      )
      expect(balloons).toEqual(page.balloons.map((b) => b.text))
      expect(captions).toEqual(page.captions.map((c) => c.text))
    }
  })

  it('leaves no typing cursor behind', () => {
    // The reveal's trailing block caret. If this glyph is on the page at rest,
    // some part of the typing clock came back.
    render(<MangaPageArt page={MANGA_PAGES[1]} />)
    expect(screen.getByTestId('sw-manga-page').textContent).not.toContain('▍')
  })

  it('paints no panel part-way in — no fades, no scale-ups, no landing trim', () => {
    // The reveal drove opacity, a transform and a pink border straight from the
    // clock. A page that still carries any of them on its first frame is a page
    // that is still animating.
    render(<MangaPageArt page={MANGA_PAGES[0]} />)
    for (const el of document.querySelectorAll('[data-manga-panel]')) {
      const style = (el as HTMLElement).style
      expect(style.opacity).toBe('')
      expect(style.transform).toBe('')
      expect(style.willChange).toBe('')
      // The pink landing trim was a span alongside the image inside each panel.
      // A panel that holds anything but its own crop of the page is animating.
      expect(el.children.length).toBe(1)
      expect(el.children[0].tagName).toBe('IMG')
    }
  })
})
