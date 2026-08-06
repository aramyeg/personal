'use client'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Chapter } from '../chapters'
import { easeOutBack } from '../journey-timeline'
import { mangaPageFor } from '../manga'
import { PALETTE } from '../palette'
import { setPanelAdvance } from '../panel-tap'
import { MangaCard } from './manga-card'
import { MangaLightbox } from './manga-lightbox'
import { StoryCard } from './story-card'

/**
 * MOBILE (<900px): THE SPREAD BECOMES A STACK, ANCHORED LOW.
 *
 * There is no room to flank the girl with two cards on a phone, and the two
 * things that were wrong with the old treatment pull in opposite directions:
 * the art card hid entirely (a placeholder earned no phone pixels — the manga
 * does), and the data card sat at the top of the screen, where it covered the
 * girl at every checkpoint (T71's blind review).
 *
 * So the cards share one box at the BOTTOM of the viewport, one in front of the
 * other, and the top ~45vh is left to the world and to her. The card behind
 * peeks out up and to the left, which is what makes the stack legible as a
 * stack; the tab in the corner swaps them.
 *
 * `--sw-enter` (set once on the root, inherited) drives the entrance through
 * calc()/var(); `!important` is required to beat the desktop inline transforms,
 * which are more specific than any rule here.
 */
const MOBILE_STYLES = `
  @media (max-width: 900px) {
    .sw-stack-tab { display: block !important; }
    .sw-panel-art, .sw-panel-data {
      left: 50% !important;
      right: auto !important;
      top: auto !important;
      bottom: 4vh !important;
      width: min(72vw, 300px) !important;
      transform:
        translateX(-50%)
        translateY(calc((1 - var(--sw-enter)) * 26px))
        rotate(calc(var(--sw-rotate) * var(--sw-enter)))
        scale(calc(0.88 + 0.12 * var(--sw-enter)))
        !important;
    }
    .sw-panel-data {
      max-height: 52vh !important;
      overflow: hidden !important;
      padding: 14px 16px !important;
    }
    /* The one behind: lifted and turned so its shoulder shows, and dimmed so
       the front card keeps the contrast. */
    [data-front='art'] .sw-panel-data,
    [data-front='story'] .sw-panel-art {
      z-index: 1 !important;
      filter: brightness(0.93) !important;
      transform:
        translateX(calc(-50% - 10px))
        translateY(calc((1 - var(--sw-enter)) * 26px - 18px))
        rotate(calc(-3deg * var(--sw-enter)))
        scale(calc(0.86 + 0.11 * var(--sw-enter)))
        !important;
    }
    [data-front='art'] .sw-panel-art,
    [data-front='story'] .sw-panel-data { z-index: 2 !important; }
    [data-front='story'] .sw-panel-art { pointer-events: none !important; }
  }
`

/**
 * One chapter stop's spread: her manga page on the left, her words on the right.
 *
 * `enter` is the entrance clock 0→1 — on arrival it is driven by the wall-clock
 * reveal (the spread rolls in by itself, a beat behind the "!"), and it walks back
 * down to 0 when the visitor leaves the checkpoint in either direction. The mapping
 * from that clock lives in use-journey-ui; this component only eases what it gets,
 * so it renders the same whatever drives it.
 *
 * The PAGE's own reveal — panels inking in order, lettering typing a beat behind
 * each one — runs on its own clock inside `MangaPageArt`, because the arrival
 * clock is far too short to carry it. See `manga/reveal.ts`.
 */
export function ChapterPanels({
  chapter,
  index,
  enter: entrance,
  onAdvance,
}: {
  chapter: Chapter
  index: number
  enter: number
  /**
   * `null` renders the spread WITHOUT arming tap-to-advance (Task 63 fix round). The two used to be
   * the same thing because the spread's lifetime was the registration's lifetime — see below — and
   * that stopped being true the moment the ending let a retracting spread outlive the journey.
   */
  onAdvance: (() => void) | null
}) {
  const enter = easeOutBack(entrance)
  const page = mangaPageFor(index)
  const [expanded, setExpanded] = useState(false)
  const [front, setFront] = useState<'art' | 'story'>('art')

  // The registration's LIFETIME is this component's, which is what makes "no advance during travel"
  // structural rather than a flag: this panel only renders while it is up, so a missed click with no
  // panel mounted has nothing to fire — including a scrub across the dwell edge that lands between
  // pointerdown and pointerup.
  //
  // ONE CASE BREAKS THAT EQUIVALENCE and it is why `onAdvance` is nullable. Chapter 6's spread
  // retracts on a wall clock, so it can still be mounted after progress has crossed into the
  // ending — and there `advanceTo` would smooth-scroll the visitor BACKWARDS out of the still beat
  // call. Registering nothing (rather than hiding the spread, which would hard-cut a retraction
  // mid-way) keeps the exit visible and leaves no live click target behind it.
  //
  // WHILE THE LIGHTBOX IS OPEN the advance is un-armed as well. The modal takes every click itself
  // so nothing should reach the canvas — but a stray `onPointerMissed` (a synthetic event, a
  // pointer already captured by the canvas when the modal opened) would scroll the visitor to the
  // next chapter out from under the page they just opened. Cheaper to make it impossible.
  useEffect(
    () => (onAdvance && !expanded ? setPanelAdvance(onAdvance) : undefined),
    [onAdvance, expanded]
  )

  /**
   * THE ROOT NO LONGER TAKES POINTER EVENTS, and that is the whole of Task 61's fix here.
   *
   * It used to be `pointer-events: auto` with an `onClick` on a full-viewport `inset: 0` div — a
   * blanket over the canvas whenever a panel was up. Measured at a checkpoint dwell,
   * `elementFromPoint` at the yeti egg's hotspot returned THIS div and the canvas received no
   * trusted click at all, so the lab's first canvas interaction was unreachable exactly where a
   * visitor is most likely to try it.
   *
   * Advance now comes from the other side: the canvas takes the click and r3f's `onPointerMissed`
   * fires the registration below when nothing interactive was hit (see `panel-tap.ts`). Clicking ON
   * an object does that object's thing; clicking anywhere else advances, which is what
   * tap-to-advance always meant. `inset: 0` stays — the panel is a full-frame stage and its cards
   * are positioned within it.
   *
   * The art card is now clickable, and that is NOT a return of the blanket: it is a visible,
   * painted, card-sized element whose own footprint takes the click. Everything outside it still
   * reaches the canvas. There is a click probe on the yeti egg's hotspot in the T73 evidence set
   * for exactly this reason.
   */
  const rootStyle: Record<string, string | number> = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    '--sw-enter': enter,
  }

  return (
    <div data-testid="sw-panel-tap" data-front={front} style={rootStyle as CSSProperties}>
      <style>{MOBILE_STYLES}</style>

      {page ? (
        <MangaCard
          page={page}
          enter={enter}
          onExpand={() => (front === 'art' ? setExpanded(true) : setFront('art'))}
        />
      ) : null}

      <StoryCard chapter={chapter} index={index} enter={enter} />

      {/* Phone only (the media query switches it on): the stack's swap. A real
          button rather than a tap zone, so it is reachable by keyboard and
          announces what it does. */}
      <button
        type="button"
        className="sw-stack-tab"
        onClick={() => setFront((f) => (f === 'art' ? 'story' : 'art'))}
        style={{
          display: 'none',
          position: 'absolute',
          left: '50%',
          bottom: 'calc(4vh + min(108vw, 450px))',
          transform: 'translateX(calc(-50% + min(36vw, 150px) - 44px))',
          pointerEvents: 'auto',
          padding: '5px 12px',
          borderRadius: 999,
          border: `2.5px solid ${PALETTE.ink}`,
          background: PALETTE.blossom,
          color: PALETTE.ink,
          fontFamily: 'var(--sw-font-panel)',
          fontSize: 13,
          letterSpacing: 0.8,
          opacity: enter,
        }}
      >
        {front === 'art' ? 'Story' : 'Page'}
      </button>

      {expanded && page ? <MangaLightbox page={page} onClose={() => setExpanded(false)} /> : null}
    </div>
  )
}
