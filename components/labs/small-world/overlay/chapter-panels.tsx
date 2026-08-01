'use client'
import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import { panelArtSrc } from '../art-manifest'
import type { Chapter } from '../chapters'
import { easeOutBack } from '../journey-timeline'
import { PALETTE } from '../palette'
import { setPanelAdvance } from '../panel-tap'

const INK_BORDER = `4px solid ${PALETTE.ink}`
const HALFTONE = `radial-gradient(circle, ${PALETTE.ink}18 1px, transparent 1.5px)`

/**
 * Below 900px there's no room for side-flanking cards: the data card takes
 * the top alone and the art card hides — its placeholder (chapter number +
 * theme) earns no phone pixels, and when real manga art lands the mobile
 * treatment gets its own pass. `--sw-enter` (set once on the root, inherited)
 * drives the bounce/rotate/scale via calc()/var() — `!important` is required
 * to beat the desktop inline transform.
 */
const MOBILE_STYLES = `
  @media (max-width: 900px) {
    .sw-panel-art {
      display: none !important;
    }
    .sw-panel-data {
      left: 50% !important;
      right: auto !important;
      top: 6vh !important;
      width: min(84vw, 340px) !important;
      transform:
        translateX(-50%)
        translateY(calc((1 - var(--sw-enter)) * -24px))
        rotate(calc(var(--sw-rotate) * var(--sw-enter)))
        scale(calc(0.85 + 0.15 * var(--sw-enter)))
        !important;
    }
  }
`

/**
 * One chapter stop's spread: art panel + typeset data panel, comic-tilted.
 *
 * `enter` is the entrance clock 0→1 — on arrival it is driven by the wall-clock
 * reveal (the spread rolls in by itself, a beat behind the "!"), and it walks back
 * down to 0 when the visitor leaves the checkpoint in either direction. The mapping
 * from that clock lives in use-journey-ui; this component only eases what it gets,
 * so it renders the same whatever drives it.
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
  const artSrc = panelArtSrc(chapter.id)

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
  useEffect(() => (onAdvance ? setPanelAdvance(onAdvance) : undefined), [onAdvance])

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
   * are positioned within it — and the `cursor: pointer` goes with the handler, since a cursor that
   * promises a click this element no longer takes is a lie.
   */
  const rootStyle: Record<string, string | number> = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    '--sw-enter': enter,
  }

  const artStyle: Record<string, string | number> = {
    '--sw-rotate': '-3deg',
    position: 'absolute',
    left: 'min(4vw, 48px)',
    top: '34vh',
    width: 'min(24vw, 300px)',
    aspectRatio: '2 / 3',
    border: INK_BORDER,
    borderRadius: 6,
    boxShadow: `10px 12px 0 ${PALETTE.ink}`,
    background: chapter.accent,
    overflow: 'hidden',
    transform: `translateY(-50%) translateX(calc(-120% * (1 - ${enter}))) rotate(${-3 * enter}deg) scale(${0.85 + 0.15 * enter})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const dataStyle: Record<string, string | number> = {
    '--sw-rotate': '2deg',
    position: 'absolute',
    right: 'min(4vw, 48px)',
    top: '34vh',
    width: 'min(27vw, 340px)',
    border: INK_BORDER,
    borderRadius: 6,
    boxShadow: `-8px 12px 0 ${PALETTE.ink}`,
    background: PALETTE.sky,
    backgroundImage: HALFTONE,
    backgroundSize: '9px 9px',
    padding: '20px 22px',
    transform: `translateY(-50%) translateX(calc(120% * (1 - ${enter}))) rotate(${2 * enter}deg) scale(${0.85 + 0.15 * enter})`,
    color: PALETTE.ink,
    fontFamily: 'var(--sw-font-body)',
  }

  return (
    <div data-testid="sw-panel-tap" style={rootStyle as CSSProperties}>
      <style>{MOBILE_STYLES}</style>
      <div className="sw-panel-art" style={artStyle as CSSProperties}>
        {artSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              backgroundImage: HALFTONE,
              backgroundSize: '9px 9px',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <span style={{ fontFamily: 'var(--sw-font-panel)', fontSize: 'min(18vw, 120px)', color: PALETTE.ink, lineHeight: 1 }}>
              {index + 1}
            </span>
            <span style={{ fontFamily: 'var(--sw-font-body)', fontWeight: 700, color: PALETTE.ink, fontSize: 14 }}>
              {chapter.theme}
            </span>
          </div>
        )}
      </div>

      <article data-testid="sw-panel-data" className="sw-panel-data" style={dataStyle as CSSProperties}>
        <p style={{ fontFamily: 'var(--sw-font-panel)', fontSize: 15, letterSpacing: 1, margin: 0, color: PALETTE.blossomDeep }}>
          Chapter {index + 1} · {chapter.period}
        </p>
        <h2 style={{ fontFamily: 'var(--sw-font-display)', fontSize: 30, lineHeight: 1.05, margin: '6px 0 2px' }}>
          {chapter.company}
        </h2>
        <p style={{ fontWeight: 800, margin: '0 0 2px', fontSize: 15 }}>{chapter.role}</p>
        <p style={{ margin: '0 0 10px', fontSize: 12, opacity: 0.75 }}>{chapter.location}</p>
        <p style={{ fontSize: 13.5, lineHeight: 1.45, margin: '0 0 12px' }}>{chapter.description}</p>
        <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 12.5, lineHeight: 1.5 }}>
          {chapter.highlights.slice(0, 3).map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {chapter.technologies.map((tech) => (
            <span
              key={tech}
              style={{
                fontFamily: 'var(--sw-font-panel)',
                fontSize: 12,
                letterSpacing: 0.8,
                padding: '3px 9px',
                borderRadius: 999,
                border: `2px solid ${PALETTE.ink}`,
                background: chapter.accent,
              }}
            >
              {tech}
            </span>
          ))}
        </div>
      </article>
    </div>
  )
}
