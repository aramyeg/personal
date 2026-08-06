import { describe, expect, it } from 'vitest'
import {
  BOOK_MOBILE_MAX,
  PAGE_ASPECT,
  PAGE_CENTRE_VH,
  PAGE_INSET_MAX,
  PAGE_INSET_VW,
  PAGE_MAX_PX,
  PAGE_TILT_LEFT_DEG,
  PAGE_TILT_RIGHT_DEG,
  PAGE_VH,
  PAGE_VW,
  pageWidth,
} from '@/components/labs/small-world/book'
import {
  overlayBoxes,
  peekerAnchor,
  peekerCardClearance,
  peekerHalfHeight,
  type PxBox,
  type Side,
} from '@/components/labs/small-world/scene/props/peeker-stage'
import { CAMERA_FOV } from '@/components/labs/small-world/scene/camera'

/**
 * THE PAGE YIELDS, NEVER THE MASCOT.
 *
 * Aram's rule for the open-book spread, as a gate. The chapter stop shows two things at once — the
 * pages you read and the clay animals leaning in from the corners — and when they compete for the
 * same band of screen it is the PAGE that gives way. The defect this file exists to prevent is the
 * exact opposite outcome, and it has already shipped once: Task 73 grew the art card and moved it
 * down the frame, the staging model in `peeker-stage.ts` still described the card as it had been
 * two rounds earlier, and the mascots were placed into a band the model believed was empty. At the
 * five desktop frames the shipped card covered 47%-61% of the left mascot's own box. Aram's report
 * was "the cards cover the mascot animals - defeats the whole purpose".
 *
 * Two failure modes follow from that, and both are gated below:
 *
 *   1. THE MODEL DISAGREES WITH THE CSS. That is what actually happened, and no amount of staging
 *      logic can survive it — the placement was correct about a layout nobody was drawing. Gated by
 *      re-deriving the expected leaf boxes from `book.ts` (the single source both the stylesheet and
 *      the model read) and comparing them to what `overlayBoxes` returns.
 *   2. THE PAGES ARE SIMPLY TOO BIG. Even a perfectly faithful model cannot place a character in a
 *      corner that has been papered over. Gated by asserting the shipped geometry still leaves a
 *      real character - `mode === 'pair'`, not dressing-only - at every desktop frame, with size to
 *      spare, and clear of both leaves.
 *
 * Everything here calls the SHIPPED `peekerAnchor` / `peekerCardClearance` rather than restating
 * their arithmetic, so the gate measures the rig the lab runs rather than a paraphrase of it.
 */

const FOV = CAMERA_FOV
const DEG = Math.PI / 180

/** The desktop frames the book has to work at — the suite Aram's report was measured over. */
const DESKTOP_FRAMES: readonly (readonly [number, number])[] = [
  [1440, 900],
  [1920, 1080],
  [1280, 800],
  [1512, 982],
  [1366, 768],
]

/**
 * The character floor this gate defends.
 *
 * The measured minimum across the five frames is 0.3331 half-heights, at 1366x768 (the shortest
 * frame, which is the binding one — the page's height is what competes with the mascot, so a short
 * viewport is the hard case rather than a narrow one). The gate is set at 0.30 rather than at the
 * measurement: ~10% of headroom, enough that an unrelated retune of the world silhouette or the
 * dressing reach does not fail this file spuriously, and far too little to let the pages creep back
 * over the corners without tripping it. `PEEKER_MIN_SIZE_FRAC` (0.22) is where the rig itself gives
 * up and shows dressing only; this floor sits well above that on purpose, because "technically a
 * character" was never the bar.
 */
const MIN_SIZE_FRAC = 0.3

const stage = (w: number, h: number, side: Side, cards?: PxBox[]) => {
  const halfH = peekerHalfHeight(FOV)
  return peekerAnchor(halfH, (halfH * w) / h, { width: w, height: h }, side, cards)
}

/** The two leaves as `book.ts` says CSS will lay them out — derived here, not imported from the model. */
function expectedLeaves(w: number, h: number, widthPx = pageWidth({ width: w, height: h })): PxBox[] {
  const pw = widthPx
  const ph = pw * PAGE_ASPECT
  const cy = PAGE_CENTRE_VH * h
  const inset = Math.min(PAGE_INSET_VW * w, PAGE_INSET_MAX)
  return ([
    [PAGE_TILT_LEFT_DEG, inset],
    [PAGE_TILT_RIGHT_DEG, w - inset - pw],
  ] as const).map(([tiltDeg, untiltedX0]) => {
    const c = Math.abs(Math.cos(tiltDeg * DEG))
    const s = Math.abs(Math.sin(tiltDeg * DEG))
    const bw = pw * c + ph * s
    const bh = pw * s + ph * c
    const x0 = untiltedX0 - (bw - pw) / 2
    return { x0, y0: cy - bh / 2, x1: x0 + bw, y1: cy + bh / 2 }
  })
}

describe('the book leaves both corners to the mascots', () => {
  it('fields a real character on BOTH sides at every desktop frame', () => {
    // Not `visible` — `visible` is also true for a corner that has fallen back to set dressing with
    // no animal in it, which is precisely the outcome the too-large pages produced. The promise is
    // an animal.
    for (const [w, h] of DESKTOP_FRAMES) {
      for (const side of [-1, 1] as const) {
        const a = stage(w, h, side)
        expect(a.mode, `${w}x${h} side ${side}`).toBe('pair')
        expect(a.visible, `${w}x${h} side ${side}`).toBe(true)
      }
    }
  })

  it('gives that character a size worth looking at', () => {
    const halfH = peekerHalfHeight(FOV)
    for (const [w, h] of DESKTOP_FRAMES) {
      for (const side of [-1, 1] as const) {
        const a = stage(w, h, side)
        expect(a.size / halfH, `${w}x${h} side ${side}`).toBeGreaterThanOrEqual(MIN_SIZE_FRAC)
      }
    }
  })

  it('keeps the character clear of both leaves, everywhere', () => {
    // Strictly positive: a zero would mean the mascot's box is touching a page, and the whole
    // complaint was about contact. `peekerCardClearance` measures the MASCOT box (not the dressing,
    // which is allowed to pass behind a page) against every box `overlayBoxes` returns.
    for (const [w, h] of DESKTOP_FRAMES) {
      for (const side of [-1, 1] as const) {
        expect(peekerCardClearance({ width: w, height: h }, FOV, side), `${w}x${h} side ${side}`)
          .toBeGreaterThan(0)
      }
    }
  })
})

describe('the staging model and the page CSS cannot drift apart', () => {
  it('models exactly the leaves book.ts describes', () => {
    // THE REGRESSION GUARD. This is the assertion that would have caught the original bug: the
    // model claimed the art card sat at x 36..360, y 73..539 at 1440x900 while the shipped card
    // occupied x 32..484, y 124..776. Both sides of that comparison are now derived from the same
    // constants, so the only way to fail here is to hand-write a box in `overlayBoxes` again.
    for (const [w, h] of [...DESKTOP_FRAMES, [2560, 1440], [1024, 768], [BOOK_MOBILE_MAX + 1, 800]] as const) {
      const modelled = overlayBoxes({ width: w, height: h })
      const expected = expectedLeaves(w, h)
      expect(modelled.length, `${w}x${h} leaf count`).toBe(2)
      for (let i = 0; i < 2; i++) {
        for (const k of ['x0', 'y0', 'x1', 'y1'] as const) {
          expect(modelled[i][k], `${w}x${h} leaf ${i} ${k}`).toBeCloseTo(expected[i][k], 6)
        }
      }
    }
  })

  it('keeps the two leaves the same size and inset from their own edges', () => {
    // They are two leaves of one book. A spread whose leaves differ reads as two cards again — the
    // thing the redesign is getting away from — and a model that let them differ would also be a
    // model nobody could check by symmetry.
    for (const [w, h] of DESKTOP_FRAMES) {
      const [left, right] = overlayBoxes({ width: w, height: h })
      const pw = pageWidth({ width: w, height: h })
      const inset = Math.min(PAGE_INSET_VW * w, PAGE_INSET_MAX)
      expect(pw, `${w}x${h} page width`).toBe(Math.min(PAGE_VW * w, PAGE_MAX_PX, PAGE_VH * h))
      // the untilted pages are mirror images about the frame's centre line
      expect(left.x0 + (left.x1 - left.x0) / 2 - inset, `${w}x${h}`).toBeCloseTo(pw / 2, 6)
      expect(w - inset - (right.x0 + (right.x1 - right.x0) / 2), `${w}x${h}`).toBeCloseTo(pw / 2, 6)
      // and both are centred on the same line
      expect((left.y0 + left.y1) / 2, `${w}x${h}`).toBeCloseTo((right.y0 + right.y1) / 2, 6)
      expect((left.y0 + left.y1) / 2, `${w}x${h}`).toBeCloseTo(PAGE_CENTRE_VH * h, 6)
    }
  })
})

describe('the gate has teeth', () => {
  it('fails an over-large page, which is what makes the passes above mean something', () => {
    // A MUTATION CHECK. Every assertion above passes on the shipped numbers; none of that is worth
    // anything unless the same machinery FAILS on a page that would cover a corner. So feed
    // `peekerAnchor` a deliberately fattened spread through the `cards` override and require the
    // corners to notice.
    //
    // The oversize is applied to the LAID-OUT width rather than to `PAGE_MAX_PX` alone, and that
    // distinction is the whole reason this comment is long. Raising only the px cap to
    // `PAGE_MAX_PX * 1.4` = 532px changes nothing at any frame in the suite, because at all five of
    // them the binding term is `PAGE_VH · vh`, not the cap — the first version of this check
    // mutated a constant that was not load-bearing and passed while proving nothing. A gate whose
    // mutation is inert is indistinguishable from no gate.
    const OVERSIZE = 1.4
    const fat = (w: number, h: number) => expectedLeaves(w, h, pageWidth({ width: w, height: h }) * OVERSIZE)

    let degraded = 0
    for (const [w, h] of DESKTOP_FRAMES) {
      for (const side of [-1, 1] as const) {
        const a = stage(w, h, side, fat(w, h))
        if (a.mode !== 'pair') degraded++
      }
    }
    expect(degraded, 'an over-large spread must cost at least one corner its character').toBeGreaterThan(0)

    // ...and it is not a whole-suite tautology either: the same override at the SHIPPED width leaves
    // every corner a character, so what the check above detected is the extra width and nothing else.
    for (const [w, h] of DESKTOP_FRAMES) {
      for (const side of [-1, 1] as const) {
        expect(stage(w, h, side, expectedLeaves(w, h)).mode, `${w}x${h} side ${side}`).toBe('pair')
      }
    }
  })

  it('degrades rather than overlapping when the pages are too big', () => {
    // The rule's other half. When a page and a mascot truly cannot both fit, the honest outcome is
    // a corner that stands down — never a character with a page drawn across it. Whatever the fat
    // spread leaves standing must still be fully clear of it.
    for (const [w, h] of DESKTOP_FRAMES) {
      const fat = expectedLeaves(w, h, pageWidth({ width: w, height: h }) * 1.4)
      for (const side of [-1, 1] as const) {
        const a = stage(w, h, side, fat)
        if (a.mode !== 'pair') continue
        expect(peekerCardClearance({ width: w, height: h }, FOV, side, fat), `${w}x${h} side ${side}`)
          .toBeGreaterThan(0)
      }
    }
  })
})
