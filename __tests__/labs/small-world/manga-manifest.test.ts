import { describe, expect, it } from 'vitest'
import { EPILOGUE, MANGA_PAGES, mangaPageFor, mangaPageSrc } from '@/components/labs/small-world/manga'
import type { MangaPage, Rect } from '@/components/labs/small-world/manga/types'
import {
  balloonFontCqw,
  drawnInkBox,
  MAX_FONT_CQW,
  MIN_FONT_CQW,
  pageAspect,
} from '@/components/labs/small-world/manga/lettering'
import { CHAPTER_COUNT } from '@/components/labs/small-world/chapters'
import { withRevision } from '@/components/labs/small-world/manga/dialogue-revision'
import { PAGE_0 } from '@/components/labs/small-world/manga/page-0'
import { PAGE_1 } from '@/components/labs/small-world/manga/page-1'
import { PAGE_2 } from '@/components/labs/small-world/manga/page-2'
import { PAGE_3 } from '@/components/labs/small-world/manga/page-3'
import { PAGE_4 } from '@/components/labs/small-world/manga/page-4'
import { PAGE_5 } from '@/components/labs/small-world/manga/page-5'

/** The manifests as AUTHORED — the pack's own lettering, before any revision layer. */
const SOURCE: MangaPage[] = [PAGE_0, PAGE_1, PAGE_2, PAGE_3, PAGE_4, PAGE_5]

/**
 * The manifests place typeset words inside blank balloons that were DRAWN BY A
 * GENERATOR — there is no layout engine keeping them registered, only these
 * numbers. A rect that drifts 2% puts a word on the ink, and nothing in the
 * type system would notice. So the geometry is asserted here.
 *
 * What this file does NOT do is re-measure the art: the derivation ran against
 * the source pixels (a gutter scan for the panels, a largest-blank-rectangle
 * solve inside each balloon) and reported 100.0% near-white for all eleven
 * printed balloons. These are the INVARIANTS that must hold whatever the
 * numbers are — in bounds, inside the right panel, big enough to read.
 */

const ALL: MangaPage[] = [...MANGA_PAGES, EPILOGUE]

const contains = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x - 1e-6 &&
  inner.y >= outer.y - 1e-6 &&
  inner.x + inner.w <= outer.x + outer.w + 1e-6 &&
  inner.y + inner.h <= outer.y + outer.h + 1e-6

describe('manga page manifests', () => {
  it('gives every chapter exactly one page, plus the wordless epilogue', () => {
    expect(MANGA_PAGES).toHaveLength(CHAPTER_COUNT)
    for (let i = 0; i < CHAPTER_COUNT; i++) expect(mangaPageFor(i)?.id).toBe(`page-${i}`)
    expect(mangaPageFor(CHAPTER_COUNT)).toBeUndefined()
    expect(EPILOGUE.balloons).toHaveLength(0)
    expect(EPILOGUE.captions).toHaveLength(0)
  })

  it('addresses the files the pipeline actually writes', () => {
    for (const page of ALL) {
      expect(mangaPageSrc(page.id)).toBe(`/labs/small-world/manga/${page.id}.webp`)
      // prepare-manga.mjs ships 840px-wide pages; the manifest carries the
      // SOURCE size, and only the ratio has to agree between them.
      expect(page.size.w).toBeGreaterThan(0)
      expect(pageAspect(page)).toBeCloseTo(1.5, 1)
    }
  })

  it('keeps every panel inside the page and in reading order', () => {
    for (const page of ALL) {
      expect(page.panels.length).toBeGreaterThan(0)
      for (const r of page.panels) {
        expect(r.w).toBeGreaterThan(0.05)
        expect(r.h).toBeGreaterThan(0.05)
        expect(contains({ x: 0, y: 0, w: 1, h: 1 }, r)).toBe(true)
      }
    }
  })

  it('speaks every line inside the panel it belongs to', () => {
    for (const page of ALL) {
      for (const b of page.balloons) {
        expect(b.panel, `${page.id}: balloon panel index`).toBeGreaterThanOrEqual(0)
        expect(b.panel).toBeLessThan(page.panels.length)
        const box: Rect = {
          x: b.at.x - b.box.w / 2,
          y: b.at.y - b.box.h / 2,
          w: b.box.w,
          h: b.box.h,
        }
        expect(contains(page.panels[b.panel], box), `${page.id}: "${b.text}" is inside its panel`).toBe(true)
      }
      for (const c of page.captions) {
        expect(c.panel).toBeLessThan(page.panels.length)
        expect(c.at.x + c.width).toBeLessThanOrEqual(1)
      }
    }
  })

  it('draws exactly the two balloons the art is missing, and no others', () => {
    // The generator dropped page-1's big-panel thought and page-4's foundation
    // line. Those two are the ONLY ones the site is allowed to draw — a third
    // would mean a printed balloon has been covered by a drawn one.
    const drawn = ALL.flatMap((p) => p.balloons.filter((b) => b.drawn).map((b) => `${p.id}:${b.panel}`))
    expect(drawn.sort()).toEqual(['page-1:0', 'page-4:1'])
    for (const page of ALL) {
      for (const b of page.balloons.filter((x) => x.drawn)) {
        const tail = b.drawn!.tail
        expect(contains(page.panels[b.panel], { x: tail.x, y: tail.y, w: 0, h: 0 })).toBe(true)
        // The INK, not just the words. The site draws an ellipse around the text
        // box with a margin past sqrt(2) (it has to contain the box's corners),
        // and that ellipse is what the reader sees leave the panel — page-1's
        // hung off the top of the page until its centre was nudged down.
        expect(
          contains(page.panels[b.panel], drawnInkBox(b)),
          `${page.id}: the drawn balloon's ink is inside its panel`
        ).toBe(true)
      }
    }
  })

  it('carries the story pack’s dialogue, and only the story pack’s dialogue', () => {
    // THE GATE STILL HAS ITS TEETH, and it is now pointed at the right object.
    //
    // This asserts PROVENANCE: no line invented about a real person may reach her
    // page. It used to read `MANGA_PAGES`, which was the same thing as the source
    // manifests until Task 75 put Aram's proposed dialogue revision between them
    // (`manga/dialogue-revision.ts` — a staged layer he judges from captures, with
    // one flag back to the shipped wording).
    //
    // So provenance is asserted where it lives: the MANIFESTS still carry the pack
    // verbatim, and every revision entry names the pack line it replaces and is
    // checked against it in `dialogue-revision.test.ts`. Reading the composed
    // pages here instead would have let this test do nothing but restate whatever
    // the revision happened to say.
    const lines = SOURCE.flatMap((p) => p.balloons.map((b) => b.text))
    expect(lines).toContain('Charts can tell me what people want…')
    expect(lines).toContain('It should be as easy as stacking blocks.')
    expect(lines).toContain('You can now.')
    expect(lines).toContain('If they can feel the seam, it isn’t done.')
    expect(lines).toContain('Build it once. Build it right.')
    expect(lines).toContain('There. Now it holds.')
    expect(lines).toContain('Look how far the meadow is from here.')
    expect(lines).toHaveLength(13)
    const captions = SOURCE.flatMap((p) => p.captions.map((c) => c.text))
    expect(captions).toEqual([
      'Her favorite thing to make: makers.',
      'Nobody notices a perfect stone. Everybody feels it.',
      'One design. Thirteen colors.',
      'These days, she watches everything at once.',
    ])
  })

  it('differs from the manifests by the revision and by nothing else', () => {
    // The other half of the same guarantee: whatever the composed pages say, the
    // ONLY thing standing between them and the pack is the reviewed list.
    for (const [i, page] of SOURCE.entries()) {
      expect(MANGA_PAGES[i].balloons.map((b) => b.text)).toEqual(
        withRevision(page).balloons.map((b) => b.text)
      )
      expect(MANGA_PAGES[i].captions.map((c) => c.text)).toEqual(
        withRevision(page).captions.map((c) => c.text)
      )
    }
  })

  it('sizes every line to something a reader can actually read', () => {
    for (const page of ALL) {
      for (const b of page.balloons) {
        const font = balloonFontCqw(b, page)
        expect(font).toBeGreaterThanOrEqual(MIN_FONT_CQW)
        expect(font).toBeLessThanOrEqual(MAX_FONT_CQW)
        // The fit is an ESTIMATE, so the thing worth guarding is that no balloon
        // is so small for its line that the estimate had to clamp at the floor —
        // that is the case where the words would overflow the blank interior.
        expect(font, `${page.id}: "${b.text}" had to clamp to the minimum`).toBeGreaterThan(MIN_FONT_CQW)
      }
    }
  })
})
