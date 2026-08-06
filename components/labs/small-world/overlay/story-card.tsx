'use client'
import type { CSSProperties } from 'react'
import type { Chapter } from '../chapters'
import { PALETTE } from '../palette'

/**
 * The right-hand card: Alwina's words for this chapter.
 *
 * Reading order is the point of the layout — HOOK (the one line that has to
 * land), then the body lines, then what she worked in, then the FIGURES, then
 * the credit in small type. The figures come last on purpose: they are the
 * claim the rest of the card has just earned, and they arrive stamped.
 *
 * The stamps are the card's only animated element and the only place the lab
 * pink appears on this side of the spread. `enter` drives them so they stay in
 * lockstep with the spread's own entrance rather than running a second clock.
 */

const HALFTONE = `radial-gradient(circle, ${PALETTE.ink}18 1px, transparent 1.5px)`

/** Stamps begin after the card has essentially arrived, and land one by one. */
const STAMP_START = 0.6
/** How much of the entrance one stamp's own press takes. */
const STAMP_SPAN = 0.26

export function StoryCard({ chapter, index, enter }: { chapter: Chapter; index: number; enter: number }) {
  // `--sw-rotate` is read by the mobile stack's CSS, which cannot see this
  // inline transform; the Record cast is how a custom property gets past
  // CSSProperties' key type.
  const style: Record<string, string | number> = {
    '--sw-rotate': '2deg',
    position: 'absolute',
    right: 'min(4vw, 48px)',
    top: '34vh',
    width: 'min(27vw, 340px)',
    border: `4px solid ${PALETTE.ink}`,
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
    <article data-testid="sw-panel-data" className="sw-panel-data" style={style as CSSProperties}>
      <p
        style={{
          fontFamily: 'var(--sw-font-panel)',
          fontSize: 15,
          letterSpacing: 1,
          margin: 0,
          color: PALETTE.blossomDeep,
        }}
      >
        Chapter {index + 1} · {chapter.theme}
      </p>

      <h2 style={{ fontFamily: 'var(--sw-font-display)', fontSize: 21, lineHeight: 1.2, margin: '8px 0 10px' }}>
        {chapter.hook}
      </h2>

      {chapter.lines.map((line) => (
        <p key={line} style={{ fontSize: 13.5, lineHeight: 1.45, margin: '0 0 6px' }}>
          {line}
        </p>
      ))}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0 0' }}>
        {chapter.tech.map((tech) => (
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '14px 0 0' }}>
        {chapter.stamps.map((stamp, i) => (
          <Stamp key={stamp} label={stamp} press={pressAt(enter, i, chapter.stamps.length)} />
        ))}
      </div>

      <p style={{ margin: '14px 0 0', fontSize: 11.5, opacity: 0.72, letterSpacing: 0.2 }}>{chapter.caption}</p>
    </article>
  )
}

/**
 * 0→1 for stamp `i` of `count`: nothing, then a fast press.
 *
 * The stagger is DERIVED from the count rather than fixed, so the last stamp
 * always finishes exactly as the entrance does. With a fixed stagger a
 * three-stamp chapter (qiibee, Wooskill) ran its last press past the end of the
 * clock — `enter` parks at 1, so that stamp sat permanently two-thirds pressed:
 * over-sized and slightly crooked, for the whole dwell, on the two cards with
 * the most figures to show.
 */
export function pressAt(enter: number, i: number, count: number): number {
  const stagger = count > 1 ? (1 - STAMP_START - STAMP_SPAN) / (count - 1) : 0
  return Math.min(1, Math.max(0, (enter - STAMP_START - i * stagger) / STAMP_SPAN))
}

/**
 * One figure, pressed onto the card.
 *
 * The press is the whole gesture: it comes in oversized and slightly turned,
 * slams to size, and stays a few degrees off square the way a real rubber stamp
 * lands. `press` is squared on the way in so the last part of the travel is the
 * fast part — a linear approach reads as a zoom, not a stamp.
 */
function Stamp({ label, press }: { label: string; press: number }) {
  const settled = 1 - (1 - press) * (1 - press)
  const style: CSSProperties = {
    fontFamily: 'var(--sw-font-panel)',
    fontSize: 13,
    letterSpacing: 0.6,
    padding: '3px 10px',
    color: PALETTE.blossomDeep,
    border: `2.5px solid ${PALETTE.blossomDeep}`,
    borderRadius: 3,
    opacity: Math.min(1, press * 2.2),
    transform: `scale(${1 + 0.75 * (1 - settled)}) rotate(${-3.5 + 3.5 * settled}deg)`,
    transformOrigin: 'center',
    whiteSpace: 'nowrap',
  }
  return (
    <span style={style} data-testid="sw-story-stamp">
      {label}
    </span>
  )
}
