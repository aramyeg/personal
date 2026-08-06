/**
 * The dialogue revision is a set of swaps keyed by position, applied to a real
 * person's words. Two things have to stay true of it, and neither is visible by
 * looking at a rendered page — a mis-keyed swap still produces a page with
 * words on it.
 */
import { describe, expect, it } from 'vitest'
import {
  DIALOGUE_REVISION,
  REVISION_ON,
  withRevision,
} from '@/components/labs/small-world/manga/dialogue-revision'
import { balloonFontCqw, effectiveTextPx } from '@/components/labs/small-world/manga/lettering'
import { pageWidth } from '@/components/labs/small-world/book'
import { PAGE_0 } from '@/components/labs/small-world/manga/page-0'
import { PAGE_1 } from '@/components/labs/small-world/manga/page-1'
import { PAGE_2 } from '@/components/labs/small-world/manga/page-2'
import { PAGE_3 } from '@/components/labs/small-world/manga/page-3'
import { PAGE_4 } from '@/components/labs/small-world/manga/page-4'
import { PAGE_5 } from '@/components/labs/small-world/manga/page-5'

/** The manifests as authored — imported directly, so the revision cannot launder itself. */
const SOURCE = [PAGE_0, PAGE_1, PAGE_2, PAGE_3, PAGE_4, PAGE_5]

describe('the dialogue revision', () => {
  it('still points at the lines it says it replaces', () => {
    // THE FAILURE THIS EXISTS FOR: a swap is keyed by page + kind + index, and a
    // manifest re-lettered upstream would silently retarget it — putting Alwina's
    // new line in somebody else's balloon, on a page that still looks fine.
    for (const swap of DIALOGUE_REVISION) {
      const page = SOURCE.find((p) => p.id === swap.page)
      expect(page, `${swap.page} exists`).toBeTruthy()
      const list = swap.kind === 'balloon' ? page!.balloons : page!.captions
      expect(list[swap.index], `${swap.page} ${swap.kind} ${swap.index} exists`).toBeTruthy()
      expect(list[swap.index].text, `${swap.page} ${swap.kind} ${swap.index}`).toBe(swap.from)
    }
  })

  it('changes exactly the lines it lists, and nothing else', () => {
    for (const page of SOURCE) {
      const revised = withRevision(page)
      const mine = DIALOGUE_REVISION.filter((s) => s.page === page.id)
      for (const [i, b] of page.balloons.entries()) {
        const swap = mine.find((s) => s.kind === 'balloon' && s.index === i)
        expect(revised.balloons[i].text).toBe(REVISION_ON && swap ? swap.to : b.text)
      }
      for (const [i, c] of page.captions.entries()) {
        const swap = mine.find((s) => s.kind === 'caption' && s.index === i)
        expect(revised.captions[i].text).toBe(REVISION_ON && swap ? swap.to : c.text)
      }
      // The geometry is the ART's, and a lettering change may never move it: the
      // balloon boxes were measured off the printed interiors.
      expect(revised.panels).toEqual(page.panels)
      expect(revised.balloons.map((b) => b.at)).toEqual(page.balloons.map((b) => b.at))
      expect(revised.balloons.map((b) => b.box)).toEqual(page.balloons.map((b) => b.box))
      expect(revised.captions.map((c) => c.at)).toEqual(page.captions.map((c) => c.at))
    }
  })

  it('does not mutate the manifests it reads', () => {
    // They are module constants shared by the card, the lightbox and the info
    // leaf's crops; a mutation would reach all three from whichever rendered first.
    const before = SOURCE.map((p) => p.balloons.map((b) => b.text).join('|'))
    SOURCE.forEach((p) => withRevision(p))
    expect(SOURCE.map((p) => p.balloons.map((b) => b.text).join('|'))).toEqual(before)
  })

  it('never shrinks a balloon’s type below what the printed interior already gives it', () => {
    // MEASURED, not counted. Balloon interiors are PRINTED ART (T73's recorded
    // wall): lettering is fitted to the box measured off the source pixels, so a
    // longer line does not overflow — it SHRINKS, and these balloons are already
    // the smallest type in the lab (6.78px on the 360 stack). A swap is therefore
    // gated on the size its line actually lands at, at the smallest page the lab
    // draws, rather than on how many characters it has.
    const DESKTOP_PAGE = pageWidth({ width: 1440, height: 900 })
    const PHONE_PAGE = Math.min(0.72 * 360, 300, 0.58 * 800) // the stack's own width rule
    for (const swap of DIALOGUE_REVISION) {
      if (swap.kind !== 'balloon') continue
      const page = SOURCE.find((p) => p.id === swap.page)!
      const balloon = page.balloons[swap.index]
      const before = balloonFontCqw(balloon, page)
      const after = balloonFontCqw({ ...balloon, text: swap.to }, page)
      for (const [name, w] of [
        ['desktop', DESKTOP_PAGE],
        ['phone', PHONE_PAGE],
      ] as const) {
        const px = effectiveTextPx(after, w)
        expect(
          px,
          `${swap.page} balloon ${swap.index} on ${name}: "${swap.to}" lands at ${px.toFixed(2)}px (was ${effectiveTextPx(before, w).toFixed(2)}px)`
        ).toBeGreaterThanOrEqual(6.5)
      }
    }
  })
})
