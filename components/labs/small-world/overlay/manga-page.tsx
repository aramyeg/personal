'use client'
import type { CSSProperties } from 'react'
import { mangaPageSrc, type MangaPage } from '../manga/types'
import { PALETTE } from '../palette'
import { BalloonText, CaptionBox } from './manga-lettering'

/**
 * One manga page, printed complete.
 *
 * THE PAGE IS ONE IMAGE, DRAWN SEVERAL TIMES. Each panel is the same `<img>`
 * clipped to its own rectangle, so the browser makes one request and one decode
 * and the panels are exact crops of the printed page — gutters, borders and the
 * splash's overlapping insets included, with no per-panel asset to keep in sync.
 *
 * IT USED TO INK ITSELF IN (removed in T111 on Aram's order: "I want to see the
 * manga pages with initially loaded texts, without the animation"). A page had
 * its own 2.6s wall clock — panels landing one at a time on the reading order,
 * each one ruled in the lab pink as it settled, then the lettering typing itself
 * a beat behind the panel that spoke it. It is gone whole rather than disabled:
 * the clock, the pink trim, the per-character substrings and `manga/reveal.ts`
 * with them. A page is complete on its FIRST frame.
 *
 * What survives is everything the order did not name: the spread still ENTERS on
 * the arrival clock (`BookLeaf`, driven by `enter`), and the info leaf beside
 * this one still draws itself over ~1.5s — which is also the span the pace
 * governor derives its checkpoint from (`info-beats`), so the beat still paces.
 *
 * The `loading`/`decoding` hints matter more than they look: this component
 * only mounts when its checkpoint is close (see `manga-card.tsx`), so the
 * request is the point at which the page enters the payload at all.
 */
/**
 * WHAT THE 11px FLOOR COSTS, AND WHERE IT IS PAID BACK.
 *
 * Below ~340px of page the floor stops the lettering scaling down with the art, so the type is
 * suddenly LARGE relative to its box — and a caption box sized as a fraction of the page becomes a
 * tall thin column of two-word lines. So on a narrow page the narrator boxes get most of their
 * panel's width instead of their manifest fraction.
 *
 * A container query rather than a viewport one, because the page — not the window — is what the
 * lettering is sized against: the same rule then covers the phone stack AND the phone lightbox AND
 * any future small mount, and leaves the desktop card and its lightbox at the geometry the round
 * already verified.
 */
const NARROW_PAGE_STYLES = `
  @container (max-width: 340px) {
    .sw-manga-caption {
      /* Twice its authored width, but never past the page: a caption that starts
         halfway across has only the remainder to grow into, and 3% of trailing
         margin keeps it off the page's own edge. */
      width: min(calc(var(--sw-cap-w) * 2), calc(97% - var(--sw-cap-x))) !important;
      padding: 1.6cqw 1.8cqw !important;
      border-width: 0.5cqw !important;
      border-left-width: 1.8cqw !important;
    }
  }
`

/**
 * REDISTRIBUTION WAS HERE, AND IT IS GONE (Task 77).
 *
 * For one round this component could omit one panel — the one the info leaf had
 * borrowed — and re-paste the remainder so no panel appeared twice on a spread.
 * It worked, and it was measured: survivable on two chapters of six, and a 26-27%
 * hole in the middle of the composition on two others.
 *
 * Aram killed it on better grounds than the arithmetic: a page with a panel torn
 * out reads as DAMAGED however carefully the rest is re-laid, and that is true
 * even where the numbers were clean. Story pages print whole. The info leaf has
 * its own generated anchor art now (`manga/anchors.ts`).
 *
 * The mechanism is deleted rather than left inert, because code in a render path
 * that looks live and never runs is the most expensive kind to keep. It is in git
 * history and the measurements are in task-74-report.md if the question reopens.
 */

export function MangaPageArt({
  page,
  priority = false,
}: {
  page: MangaPage
  priority?: boolean
}) {
  const rootStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    aspectRatio: `${page.size.w} / ${page.size.h}`,
    // The page is the container every piece of lettering sizes itself against
    // (`cqw` in manga-lettering), which is what lets one manifest serve the
    // card, the lightbox and the phone from a single set of fractions.
    containerType: 'inline-size',
    // The paper behind the panels, and it has to be the paper the pages are
    // actually printed on — `pagePaper`, measured. It shows in the gutters and
    // for however long the image itself takes to arrive.
    background: PALETTE.pagePaper,
    overflow: 'hidden',
  }

  const body = (
    <>
      {page.panels.map((rect, i) => {
        const inset = `${rect.y * 100}% ${(1 - rect.x - rect.w) * 100}% ${(1 - rect.y - rect.h) * 100}% ${rect.x * 100}%`
        const style: CSSProperties = {
          position: 'absolute',
          inset: 0,
          clipPath: `inset(${inset})`,
        }
        return (
          <div key={`${page.id}-p${i}`} style={style} data-manga-panel={i}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mangaPageSrc(page.id)}
              alt=""
              width={page.size.w}
              height={page.size.h}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
          </div>
        )
      })}

      {page.balloons.map((balloon, i) => (
        <BalloonText key={`${page.id}-b${i}`} balloon={balloon} page={page} />
      ))}

      {page.captions.map((caption, i) => (
        <CaptionBox key={`${page.id}-c${i}`} caption={caption} />
      ))}
    </>
  )

  return (
    <div style={rootStyle} data-testid="sw-manga-page" data-manga-page={page.id}>
      <style>{NARROW_PAGE_STYLES}</style>
      {body}
    </div>
  )
}

