/**
 * TASK 76 — NO PANEL ON BOTH LEAVES.
 *
 * The right-hand leaf opens on a panel of the chapter's own printed page
 * (`DONATED_PANEL`), so the story leaf leaves that panel out and re-pastes what
 * is left: shared bounding box, UNIFORM scale, centred.
 *
 * WHAT THIS FILE IS ACTUALLY GUARDING, in order of how badly it would break:
 *
 *  1. REGISTRATION. The lettering is placed in PAGE fractions. If the art moves
 *     under a transform and the balloons do not, every line lands off its
 *     balloon — the exact failure T73's measured boxes were introduced to
 *     prevent. So a surviving balloon is checked to still sit inside its own
 *     panel after the map, computed rather than eyeballed.
 *  2. THE DELIBERATE ASYMMETRY. The spread avoids the duplication; the LIGHTBOX
 *     is the artefact and prints complete. A well-meaning refactor that gave the
 *     lightbox the same prop would silently delete a panel from the only place
 *     the reader can see the page whole.
 *  3. NO CHANGE WHERE NONE WAS ASKED FOR. With no donated panel there must be no
 *     wrapper and no transform at all.
 */
import { describe, expect, it, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MangaPageArt, fitRect, redistributeFit } from '@/components/labs/small-world/overlay/manga-page'
import { MANGA_PAGES } from '@/components/labs/small-world/manga'
import type { MangaPage, Rect } from '@/components/labs/small-world/manga/types'
import { DONATED_PANEL, donatedPanelFor } from '@/components/labs/small-world/overlay/info-page-spec'
import { ChapterPanels } from '@/components/labs/small-world/overlay/chapter-panels'

afterEach(cleanup)

/** The leaf, finished, with a panel donated away. */
const leaf = (page: MangaPage, omitPanel?: number) =>
  render(<MangaPageArt page={page} running instant omitPanel={omitPanel} />)

const panelIndices = (root: HTMLElement = screen.getByTestId('sw-manga-page')) =>
  [...root.querySelectorAll('[data-manga-panel]')].map((el) =>
    Number((el as HTMLElement).dataset.mangaPanel)
  )

/** `inner` sits inside `outer`, with a hair of tolerance for the eye-cut manifests. */
const contains = (outer: Rect, inner: Rect, eps = 1e-6) =>
  inner.x >= outer.x - eps &&
  inner.y >= outer.y - eps &&
  inner.x + inner.w <= outer.x + outer.w + eps &&
  inner.y + inner.h <= outer.y + outer.h + eps

/** A balloon's readable box as a rect — it is centred on `at`. */
const balloonRect = (b: { at: { x: number; y: number }; box: { w: number; h: number } }): Rect => ({
  x: b.at.x - b.box.w / 2,
  y: b.at.y - b.box.h / 2,
  w: b.box.w,
  h: b.box.h,
})

const CHAPTERS = MANGA_PAGES.map((page, i) => [i + 1, page.id, i] as const)

describe('the donated panel leaves the story leaf', () => {
  it.each(CHAPTERS)('chapter %i (%s) renders every panel except the one it gave away', (_n, _id, i) => {
    const page = MANGA_PAGES[i]
    const omit = donatedPanelFor(i)!
    leaf(page, omit)

    const rendered = panelIndices()
    expect(rendered, 'the donated panel is not printed on this leaf').not.toContain(omit)
    // ...and NOTHING else went missing with it. A re-paste that quietly dropped a
    // second panel would still look like a page.
    const expected = page.panels.map((_, k) => k).filter((k) => k !== omit)
    expect([...rendered].sort((a, b) => a - b)).toEqual(expected)
  })

  it.each(CHAPTERS)('chapter %i (%s) drops the lettering that belonged to it', (_n, _id, i) => {
    const page = MANGA_PAGES[i]
    const omit = donatedPanelFor(i)!
    leaf(page, omit)

    const lettering = [...screen.getByTestId('sw-manga-page').querySelectorAll('[data-sw-text]')]
    const printed = lettering.map((el) => el.textContent ?? '')

    for (const b of page.balloons) {
      if (b.panel !== omit) continue
      expect(printed.some((t) => t.includes(b.text)), `${b.text} outlived its panel`).toBe(false)
    }
    for (const c of page.captions) {
      if (c.panel !== omit) continue
      expect(printed.some((t) => t.includes(c.text)), `${c.text} outlived its panel`).toBe(false)
    }

    // And every SURVIVING line is still on the page — the drop must be surgical.
    for (const b of page.balloons) {
      if (b.panel === omit) continue
      expect(printed.some((t) => t.includes(b.text)), `${b.text} was lost`).toBe(true)
    }
    for (const c of page.captions) {
      if (c.panel === omit) continue
      expect(printed.some((t) => t.includes(c.text)), `${c.text} was lost`).toBe(true)
    }
  })

  it('drops a caption with its panel, on the one chapter that has one to lose', () => {
    // page-5's caption lives in panel 0, which chapter 6 donates. Stated on its
    // own so the guarantee is not carried only by a loop that would still pass if
    // no chapter ever donated a captioned panel.
    const page = MANGA_PAGES[5]
    const caption = page.captions.find((c) => c.panel === DONATED_PANEL[5])!
    expect(caption, 'chapter 6 donates its captioned panel').toBeTruthy()
    leaf(page, DONATED_PANEL[5])
    expect(screen.getByTestId('sw-manga-page').textContent).not.toContain(caption.text)
  })
})

describe('the re-paste keeps its registration', () => {
  it.each(CHAPTERS)('chapter %i (%s) maps art and lettering through one transform', (_n, _id, i) => {
    const page = MANGA_PAGES[i]
    const omit = donatedPanelFor(i)!
    const fit = redistributeFit(page.panels, omit)!
    expect(fit, 'a donated panel produces a fit').toBeTruthy()

    const leafBox: Rect = { x: 0, y: 0, w: 1, h: 1 }
    for (const [k, rect] of page.panels.entries()) {
      if (k === omit) continue
      const mapped = fitRect(fit, rect)
      expect(contains(leafBox, mapped, 1e-6), `panel ${k} fell off the leaf`).toBe(true)
    }

    for (const b of page.balloons) {
      if (b.panel === omit) continue
      const panel = fitRect(fit, page.panels[b.panel])
      const balloon = fitRect(fit, balloonRect(b))
      // The point of the whole exercise: the words are still inside the frame
      // they are spoken in, AFTER the remainder has been moved and scaled.
      expect(contains(panel, balloon, 1e-6), `"${b.text}" left panel ${b.panel}`).toBe(true)
    }

    for (const c of page.captions) {
      if (c.panel === omit) continue
      // A caption's HEIGHT is set by its text, so only its top-left corner and
      // its width are geometry we own.
      const panel = fitRect(fit, page.panels[c.panel])
      const box = fitRect(fit, { x: c.at.x, y: c.at.y, w: c.width, h: 0 })
      expect(contains(panel, box, 1e-6), `"${c.text}" left panel ${c.panel}`).toBe(true)
    }
  })

  it('scales uniformly — the art is never stretched', () => {
    for (const [i, page] of MANGA_PAGES.entries()) {
      const fit = redistributeFit(page.panels, donatedPanelFor(i))!
      const square: Rect = { x: fit.bbox.x, y: fit.bbox.y, w: 0.1, h: 0.1 }
      const mapped = fitRect(fit, square)
      expect(mapped.w, `chapter ${i + 1} squashed an axis`).toBeCloseTo(mapped.h, 12)
      // ...and it fills one axis exactly, so the fit is the largest one available.
      const filled = Math.max(fit.scale * fit.bbox.w, fit.scale * fit.bbox.h)
      expect(filled, `chapter ${i + 1} left slack on both axes`).toBeCloseTo(1, 12)
    }
  })

  it('centres the remainder, so the residue is margin on both sides', () => {
    for (const [i, page] of MANGA_PAGES.entries()) {
      const fit = redistributeFit(page.panels, donatedPanelFor(i))!
      expect(fit.offset.x).toBeCloseTo((1 - fit.scale * fit.bbox.w) / 2, 12)
      expect(fit.offset.y).toBeCloseTo((1 - fit.scale * fit.bbox.h) / 2, 12)
      expect(fit.offset.x).toBeGreaterThanOrEqual(-1e-12)
      expect(fit.offset.y).toBeGreaterThanOrEqual(-1e-12)
    }
  })

  it('carries the lettering inside the transformed wrapper, not beside it', () => {
    // The DOM-level half of the registration guarantee. If a future edit moves
    // the balloons back out to the root they would sit at their un-mapped page
    // fractions while the art had moved — which the pure-geometry assertions
    // above would not notice.
    leaf(MANGA_PAGES[0], donatedPanelFor(0))
    const wrapper = screen.getByTestId('sw-manga-fit')
    const lettering = screen.getByTestId('sw-manga-page').querySelectorAll('[data-sw-text]')
    expect(lettering.length).toBeGreaterThan(0)
    for (const el of lettering) expect(wrapper.contains(el), 'lettering left the transform').toBe(true)
    for (const el of screen.getByTestId('sw-manga-page').querySelectorAll('[data-manga-panel]')) {
      expect(wrapper.contains(el), 'art left the transform').toBe(true)
    }
    expect(wrapper.style.transform).toContain('scale(')
  })
})

describe('where no panel is donated, nothing changes', () => {
  it.each(CHAPTERS)('chapter %i (%s) prints complete with no omitPanel', (_n, _id, i) => {
    const page = MANGA_PAGES[i]
    leaf(page)
    expect(panelIndices()).toEqual(page.panels.map((_, k) => k))
    expect(screen.queryByTestId('sw-manga-fit'), 'an un-omitted page grew a wrapper').toBeNull()
  })

  it('renders byte-identical markup with omitPanel undefined and with it absent', () => {
    const withProp = render(<MangaPageArt page={MANGA_PAGES[2]} running instant omitPanel={undefined} />)
    const html = withProp.container.innerHTML
    cleanup()
    const without = render(<MangaPageArt page={MANGA_PAGES[2]} running instant />)
    expect(without.container.innerHTML).toBe(html)
  })

  it('ignores an index that is not a panel rather than blanking the page', () => {
    const page = MANGA_PAGES[0]
    for (const bad of [-1, page.panels.length, 99, 1.5]) {
      leaf(page, bad)
      expect(panelIndices(), `omitPanel=${bad}`).toEqual(page.panels.map((_, k) => k))
      expect(screen.queryByTestId('sw-manga-fit')).toBeNull()
      cleanup()
    }
    expect(redistributeFit(page.panels, undefined)).toBeNull()
  })
})

describe('the lightbox is the artefact, and prints whole', () => {
  it.each(CHAPTERS)('chapter %i (%s) opens full size with every panel', (_n, _id, i) => {
    render(<ChapterPanels index={i} enter={1} onAdvance={null} />)
    const page = MANGA_PAGES[i]
    const omit = donatedPanelFor(i)!

    // The leaf, first: the donated panel is missing there.
    expect(panelIndices(screen.getByTestId('sw-manga-page'))).not.toContain(omit)

    fireEvent.click(screen.getByTestId('sw-manga-card'))
    const lightbox = screen.getByTestId('sw-manga-lightbox')
    const full = lightbox.querySelector('[data-testid="sw-manga-page"]') as HTMLElement
    expect(full, 'the lightbox shows a page').toBeTruthy()

    expect(panelIndices(full)).toEqual(page.panels.map((_, k) => k))
    expect(full.querySelector('[data-testid="sw-manga-fit"]'), 'the artefact is not re-pasted').toBeNull()
    for (const b of page.balloons) expect(full.textContent).toContain(b.text)
    for (const c of page.captions) expect(full.textContent).toContain(c.text)
  })
})
