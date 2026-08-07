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

  it('carries the approved dialogue, and only the approved dialogue', () => {
    // THE GATE STILL HAS ITS TEETH: no line invented about a real person may reach
    // her page. What it points AT moved twice, and the second move is Task 82's.
    //
    // Task 75 put a staged revision layer between the manifests and the pages so
    // Aram could rule on seven swaps from captures with both wordings reachable,
    // and this test read the MANIFESTS so it could not be fooled by whatever the
    // layer happened to say. He has ruled: all seven are adopted, the winning text
    // is IN the manifests, and the layer is deleted. So the manifests are the
    // composed pages again, and this reads them directly.
    //
    // PROVENANCE FOR THE SWAPPED LINES lives in `.superpowers/sdd/task-80-report.md`
    // and in the diff that folded them; the pack line each one replaced is recorded
    // there. Nothing below is a sentence anyone made up in this repo.
    const lines = MANGA_PAGES.flatMap((p) => p.balloons.map((b) => b.text))
    // Untouched pack dialogue — the majority, and the reason the register is hers.
    expect(lines).toContain('Charts can tell me what people want…')
    expect(lines).toContain('It should be as easy as stacking blocks.')
    expect(lines).toContain('There. Now it holds.')
    // Adopted swaps, pinned so a re-edit has to come back through this file.
    expect(lines).toContain('Try dragging that one.')
    expect(lines).toContain('Almost… there.')
    expect(lines).toContain('Same box. New paint.')
    expect(lines).toContain('Careful — heavier than it looks.')
    expect(lines).toHaveLength(13)
    const captions = MANGA_PAGES.flatMap((p) => p.captions.map((c) => c.text))
    expect(captions).toEqual([
      'It worked in every browser. Eventually.',
      'Most of this work is invisible. That’s fine by me.',
      'One design. Thirteen colors.',
      '2025 — present. Still building.',
    ])
  })

  it('never lets the narrator back in', () => {
    // THREE OF THE SEVEN SWAPS EXISTED FOR THIS: "Her favorite thing to make:
    // makers.", "These days, she watches everything at once." — a narrator
    // describing her in the third person, printed on her own page, in a piece whose
    // every other word is hers. Stated as a rule rather than as four literals, so
    // it holds for lines nobody has written yet.
    for (const page of MANGA_PAGES) {
      for (const text of [...page.balloons.map((b) => b.text), ...page.captions.map((c) => c.text)]) {
        expect(/(she|her|hers|herself)/i.test(text), `"${text}" is third person`).toBe(false)
      }
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
