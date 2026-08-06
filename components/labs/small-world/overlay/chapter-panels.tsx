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
 *
 * THIS IS A TEMPLATE LITERAL, so nothing between the backticks below may contain
 * one — a backtick in a CSS comment ends the string and the file stops parsing.
 * Quote identifiers in these comments plainly, not in code ticks.
 */
const MOBILE_STYLES = `
  @media (max-width: 900px) {
    .sw-stack-tab { display: block !important; }
    .sw-panel-art, .sw-panel-data {
      left: 50% !important;
      right: auto !important;
      top: auto !important;
      bottom: 4vh !important;
      /* Height-capped for the same reason the desktop card is: a 2:3 page at
         72vw is taller than a landscape phone, which also matches this query. */
      width: min(72vw, 300px, 58vh) !important;
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
    }
    /* ------------------------------------------------------------------
       THE PHONE CARD HAS TO FIT INSIDE ITS OWN FRAME.
       ------------------------------------------------------------------
       The cap above is a hard clip, and the card's last line is the CREDIT —
       who the chapter is actually about. Measured at 390x844 (the widest the
       stack ever is, so the worst case), chapter 5 overflowed by 32px BEFORE
       this round: its credit's second line was already being cut, silently.
       Task 74's two panels and narrator label added 22px more.
       Growing the box is not the answer. The data card is capped at 52vh = 439px
       and the comic card beside it is min(108vw, 450px, 87vh) = 421px tall on
       this viewport — they are deliberately the same size, which is what makes
       the stack read as a stack, and 4vh + 52vh is also what leaves the top of
       the screen to the girl (T71's finding). So the CONTENT gives instead, and
       it gives from the two places a phone has slack: the leading between the
       card's blocks, and a hook set at desktop size in a 270px column.
       The numbers below are solved against bench/task74-overflow.mjs, which
       reports scrollHeight − clientHeight per chapter; the round is not done
       until all six read 0. The card's padding lives on its two PANELS now, so
       the phone tightens those rather than the frame — padding on the frame
       would push the gutter rule in off the ink it is meant to meet — and the
       side gutter is one variable because the narrator label's bleed is negated
       from it. */
    .sw-panel-data { --sw-card-pad: 15px !important; }
    .sw-panel-data .sw-card-story { padding-top: 11px !important; padding-bottom: 9px !important; }
    .sw-panel-data .sw-card-record { padding-top: 9px !important; padding-bottom: 8px !important; }
    .sw-panel-data .sw-card-eyebrow { margin-bottom: 7px !important; padding-top: 3px !important; padding-bottom: 3px !important; }
    /* 18px, not 21. Hierarchy is a RATIO and it survives: against the 13.5px
       body this is still 1.33, and on chapter 5 it is the difference between a
       four-line hook and a three-line one. Nothing here goes anywhere near the
       11px floor T73 fought for — that was 6px captions, a different problem in
       the opposite direction. */
    .sw-panel-data .sw-card-hook { font-size: 18px !important; margin-bottom: 8px !important; }
    .sw-panel-data .sw-card-line { margin-bottom: 5px !important; }
    .sw-panel-data .sw-card-stamps { margin-top: 10px !important; }
    .sw-panel-data .sw-card-credit { margin-top: 9px !important; }
    /* The one behind: lifted and turned so its shoulder shows, and dimmed so
       the front card keeps the contrast. */
    [data-front='comic'] .sw-panel-data,
    [data-front='details'] .sw-panel-art {
      z-index: 1 !important;
      filter: brightness(0.93) !important;
      transform:
        translateX(calc(-50% - 10px))
        translateY(calc((1 - var(--sw-enter)) * 26px - 18px))
        rotate(calc(-3deg * var(--sw-enter)))
        scale(calc(0.86 + 0.11 * var(--sw-enter)))
        !important;
    }
    [data-front='comic'] .sw-panel-art,
    [data-front='details'] .sw-panel-data { z-index: 2 !important; }
    [data-front='details'] .sw-panel-art { pointer-events: none !important; }
  }

  /* ------------------------------------------------------------------
     AND THE SMALL PHONE PAYS MORE, BECAUSE IT HAS LESS.
     ------------------------------------------------------------------
     390x844 is not the worst case, and assuming it was is what nearly
     shipped this. Two axes squeeze the card and only one of them is width:

     WIDTH. At 360 the card is 251px against 281, so on chapter 5 every body
     sentence takes a second line, the tech labels take a third row and the
     stamps take a third. Measured, content that fits at 390 with 9px to
     spare overflowed 360 by 53px.

     HEIGHT, which is the one a max-width rule cannot see at all. The cap
     is 52vh and the content is in px, so a SHORT phone is squeezed without
     being narrow: at 390x700 the cap is 364px and stage one's chapter 5
     needs 422. Hence the second half of the query.

     Every rule below gives up something CHEAPER at this size than a cut
     credit line: the hand-pressed baseline scatter under the stamps (a
     desktop delight that costs a whole row here), the leading, and the
     label metrics. Everything that carries meaning stays above 11px.

     THIS DOES NOT FULLY CLOSE THE SHORT-PHONE CASE and the report says so
     with numbers — under about 780px of viewport height chapters 4-6 still
     clip, though by roughly half what they clipped before this round. Fixing
     it outright means either raising the 52vh cap (which is T71's "leave the
     top of the screen to the girl", not this round's to overrule) or the
     proper answer: size the card's type in cqw against the CARD, the way the
     comic page next to it already sizes its lettering. Both are written up in
     task-74-report.md. */
  @media (max-width: 380px), (max-width: 900px) and (max-height: 800px) {
    .sw-panel-data .sw-card-story { padding-top: 9px !important; padding-bottom: 6px !important; }
    .sw-panel-data .sw-card-record { padding-top: 7px !important; padding-bottom: 6px !important; }
    .sw-panel-data .sw-card-eyebrow { margin-bottom: 5px !important; padding-top: 2px !important; padding-bottom: 2px !important; }
    .sw-panel-data .sw-card-hook { font-size: 16px !important; margin-bottom: 6px !important; }
    .sw-panel-data .sw-card-line { line-height: 1.3 !important; margin-bottom: 4px !important; }
    .sw-panel-data .sw-card-record span { font-size: 11.5px !important; padding-left: 7px !important; padding-right: 7px !important; }
    /* The scatter goes, not the tilt: a stamp still lands off square, it just
       stops carrying its neighbours' rows down with it. */
    .sw-panel-data .sw-card-stamps > span { margin-top: 0 !important; }
    .sw-panel-data .sw-card-stamps { margin-top: 6px !important; gap: 6px !important; }
    .sw-panel-data .sw-card-credit { margin-top: 6px !important; }
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
  // 'comic' | 'details', not 'art' | 'story'. THE COMIC IS THE STORY — the stack
  // used to label the manga "Page" and the CV card "Story", which told the reader
  // the pictures were the packaging and the bullet points were the substance.
  // Exactly backwards, and the blind review caught it.
  const [front, setFront] = useState<'comic' | 'details'>('comic')

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
          chapterNumber={index + 1}
          enter={enter}
          onExpand={() => (front === 'comic' ? setExpanded(true) : setFront('comic'))}
        />
      ) : null}

      <StoryCard chapter={chapter} index={index} enter={enter} />

      {/* Phone only (the media query switches it on): the stack's swap. A real
          button rather than a tap zone, so it is reachable by keyboard and
          announces what it does. */}
      <button
        type="button"
        className="sw-stack-tab"
        onClick={() => setFront((f) => (f === 'comic' ? 'details' : 'comic'))}
        style={{
          display: 'none',
          position: 'absolute',
          left: '50%',
          // Clear of the stack's top edge (the card is 1.5x its own width) with
          // a few pixels of air, and ABOVE both cards: the mobile rule gives
          // them z-index 1 and 2, so a tab left on the default layer paints
          // behind the very stack it controls (captured).
          bottom: 'calc(4vh + min(108vw, 450px, 87vh) + 6px)',
          zIndex: 3,
          transform: 'translateX(calc(-50% + min(36vw, 150px, 29vh) - 46px))',
          pointerEvents: 'auto',
          padding: '5px 12px',
          // A PRINTED TAB, not a pastel pill (Task 74). Same stock and the same
          // hard shadow as the two cards it swaps between, hard-cornered, with
          // the lab pink carried by the LETTERING — which is the sanctioned use
          // (stamp ink, caption trim, the active tab) and also the readable one:
          // pink type on paper measures 4.0:1 where ink on the old pastel fill
          // was the only thing holding that row together.
          borderRadius: 3,
          border: `2.5px solid ${PALETTE.ink}`,
          background: PALETTE.pagePaper,
          boxShadow: `2px 3px 0 ${PALETTE.ink}`,
          color: PALETTE.blossomDeep,
          fontFamily: 'var(--sw-font-panel)',
          fontSize: 13,
          letterSpacing: 0.8,
          opacity: enter,
        }}
      >
        {front === 'comic' ? 'Details' : 'Comic'}
      </button>

      {expanded && page ? (
        <MangaLightbox page={page} chapterNumber={index + 1} onClose={() => setExpanded(false)} />
      ) : null}
    </div>
  )
}
