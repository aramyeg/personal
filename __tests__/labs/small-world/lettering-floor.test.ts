import { describe, expect, it } from 'vitest'
import { EPILOGUE, MANGA_PAGES } from '@/components/labs/small-world/manga'
import type { MangaPage } from '@/components/labs/small-world/manga/types'
import {
  balloonFontCqw,
  effectiveTextPx,
  LINE_STEP,
  MAX_FONT_CQW,
  MIN_FONT_CQW,
  MIN_TEXT_PX,
  pageAspect,
} from '@/components/labs/small-world/manga/lettering'
import { chapters } from '@/components/labs/small-world/chapters'

/**
 * NOTHING USER-FACING BELOW 11px, AT ANY MOUNT THIS PAGE HAS.
 *
 * The blind review measured the phone captions at 6.0px and called them "unreadable, still a smear
 * magnified". The cause was that every size in `lettering.ts` was a RATIO — correct for serving a
 * 444px card, a 557px lightbox and a 294px phone from one manifest, and completely silent about
 * whether the result is legible. This is the gate that ratio needed.
 *
 * The widths below are MEASURED from the shipped layout, not assumed — see the probe table in
 * task-73-report.md. If the card geometry changes, re-measure and change them here; the point of
 * naming them is that a regression in the CARD size shows up as a failure in the TEXT gate, which
 * is the coupling that actually bit.
 */
const MOUNTS: ReadonlyArray<{ name: string; pageWidthPx: number }> = [
  { name: 'phone 360 stack', pageWidthPx: 270.56 },
  { name: 'phone 390 stack', pageWidthPx: 293.84 },
  { name: 'phone 390 lightbox', pageWidthPx: 326 },
  { name: 'desktop 1440 card', pageWidthPx: 443.78 },
  { name: 'desktop 1440 lightbox', pageWidthPx: 557 },
]

const ALL: MangaPage[] = [...MANGA_PAGES, EPILOGUE]

/** The caption's own size rule, mirrored from `CaptionBox`. */
const captionFontCqw = (text: string) => Math.min(3.1, Math.max(2.2, 26 / text.length + 1.5))

describe('the lettering floor', () => {
  it('keeps every caption at or above the floor, at every mount', () => {
    for (const mount of MOUNTS) {
      for (const page of ALL) {
        for (const c of page.captions) {
          const px = effectiveTextPx(captionFontCqw(c.text), mount.pageWidthPx)
          expect(px, `${mount.name}: "${c.text}"`).toBeGreaterThanOrEqual(MIN_TEXT_PX)
        }
      }
    }
  })

  it('proves the floor is doing work rather than being met by the ratio anyway', () => {
    // If this stops being true the floor has become decorative and the gate above is vacuous: it
    // would pass because the proportional size happens to clear 11px, not because anything holds
    // it there. Measured on the narrowest mount, where the review found 6.0px.
    const narrow = MOUNTS[0].pageWidthPx
    const raw = ALL.flatMap((p) => p.captions.map((c) => (captionFontCqw(c.text) / 100) * narrow))
    expect(Math.min(...raw), 'the unfloored caption size on the narrowest mount').toBeLessThan(MIN_TEXT_PX)
  })

  /**
   * BALLOONS ARE DELIBERATELY NOT FLOORED, and this is the gate that keeps that decision honest
   * rather than letting it rot into an oversight.
   *
   * A balloon's interior is printed art, so raising its type does not reflow the box — it runs
   * onto the ink. What can be asserted is that every balloon is set at the size its own interior
   * was solved for, at every mount, which is a ratio and therefore mount-independent. The cost —
   * that the phone card cannot letter these balloons legibly at ANY size — is a property of the
   * drawing at that display size and is recorded as a wall, not papered over here.
   */
  it('sets every balloon at the size its own ink was solved for, and says so', () => {
    for (const page of ALL) {
      for (const b of page.balloons) {
        const cqw = balloonFontCqw(b, page)
        expect(cqw).toBeGreaterThanOrEqual(MIN_FONT_CQW)
        expect(cqw).toBeLessThanOrEqual(MAX_FONT_CQW)
        // The area solve the size comes from: text area must fit the interior it was given.
        const aspect = pageAspect(page)
        const boxArea = b.box.w * 100 * b.box.h * 100 * aspect
        const textArea = 0.52 * LINE_STEP * b.text.length * cqw * cqw
        expect(textArea, `${page.id}: "${b.text}"`).toBeLessThanOrEqual(boxArea * 1.001)
      }
    }
  })

  it('records the wall: the phone cannot reach the floor inside printed ink', () => {
    // Not a target — a measurement, kept so that anyone who later "fixes" the balloons by flooring
    // them can see exactly what they would be trading away. Reaching 11px on the narrowest mount
    // needs over twice the interior area the drawing provides.
    const narrow = MOUNTS[0].pageWidthPx
    let worstPx = Infinity
    let worstAreaRatio = 0
    for (const p of ALL) {
      for (const b of p.balloons) {
        const px = (balloonFontCqw(b, p) / 100) * narrow
        worstPx = Math.min(worstPx, px)
        worstAreaRatio = Math.max(worstAreaRatio, (MIN_TEXT_PX / px) ** 2)
      }
    }
    expect(worstPx).toBeLessThan(MIN_TEXT_PX)
    expect(worstPx).toBeGreaterThan(6) // a drop below 6 is a different problem
    // THE WALL IS STILL THERE AND IT MOVED, which is worth recording rather than
    // re-baselining silently. It read 6.78px / 2.63x area when T73 measured it.
    // Task 75's dialogue revision shortens several lines, and a shorter line fits
    // the same printed interior at a LARGER size — so the worst balloon is now
    // ~8.0px and needs ~1.88x the area rather than 2.63x. The phone still cannot
    // reach 11px inside drawn ink (the first assertion above is the wall), but the
    // gap the panel-at-a-time reader has to close got materially smaller, and it
    // got smaller as a side effect of writing shorter dialogue rather than of any
    // change to the type system. Anyone flooring these balloons is still trading
    // away drawn ink; this is how much.
    expect(worstAreaRatio).toBeGreaterThan(1.5)
    expect(worstAreaRatio).toBeLessThan(2.8)
  })
})

describe('stamp copy shape', () => {
  it('never lets one figure in a chapter lose its sign while its neighbour keeps one', () => {
    // Chapter 3 shipped "+15% SESSION" beside "30% SMOOTHER" — the second read as a typo rather
    // than as a different kind of number. Within a chapter the percentages agree or they are all
    // bare; a silent half-and-half is the shape this forbids.
    for (const c of chapters) {
      const pct = c.stamps.filter((s) => s.includes('%'))
      if (pct.length < 2) continue
      const signed = pct.filter((s) => /^[+−-]/.test(s))
      expect(
        signed.length === 0 || signed.length === pct.length,
        `${c.id}: ${JSON.stringify(pct)} mixes signed and unsigned figures`
      ).toBe(true)
    }
  })

  it('uses the typographic minus, not a hyphen, wherever a figure is negative', () => {
    for (const c of chapters) {
      for (const s of c.stamps) {
        expect(s.startsWith('-'), `${c.id}: "${s}" uses a hyphen`).toBe(false)
      }
    }
  })
})
