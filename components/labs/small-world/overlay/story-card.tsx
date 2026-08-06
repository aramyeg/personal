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
 * ============================================================================
 * TASK 74 — IT IS PRINTED IN THE SAME BOOK NOW
 * ============================================================================
 * Aram's verdict on the finished spread: "with the manga cards being black and
 * white the other detail cards are sticking out with the colors." Both halves
 * already shared a frame — 4px ink, hard offset shadow — and shared nothing
 * else. The card was a warm cream sheet carrying a row of honey/river/dune
 * pills, i.e. a pastel UI parked beside a black-and-white comic.
 *
 * Three changes, and the first is the one that does most of the work:
 *
 * 1. THE SHEET. `pagePaper`, measured off the seven shipped pages rather than
 *    picked (see the palette note). The cream stays for exactly one object.
 *
 * 2. THE CARD IS BUILT LIKE A PAGE. Two panels divided by a full-bleed ink
 *    gutter rule: the STORY panel on bare paper, and below it the RECORD panel
 *    on screentone. That division is not decoration — it is the page's own
 *    grammar applied to the card, and it is what makes "chapter text" and "the
 *    figures behind it" read as two panels instead of one scrolling column.
 *    The eyebrow is a narrator CAPTION BOX in the comic's exact vocabulary
 *    (cream label, ink rule, pink leading edge, `--sw-font-panel`), tucked into
 *    the panel's corner the way the pages' own captions are.
 *
 * 3. ONE COLOUR. The lab pink is the only hue left on the card, and it appears
 *    where the manga plan already allows it: the caption's leading edge, and
 *    the stamp ink. Every biome tint is gone — the tech pills are printed
 *    labels now (paper, ink rule, hard shadow), which is also the honest
 *    hierarchy, because a pill's colour never meant anything.
 *
 * The stamps are still the card's only animated element. `enter` drives them so
 * they stay in lockstep with the spread's own entrance rather than running a
 * second clock.
 *
 * COPY FLOWS THROUGH UNCHANGED. Every string still arrives from `Chapter` —
 * hook, lines, tech, stamps, caption — so the story rework lands in
 * `alwina-story.ts` without touching this file.
 */

/**
 * SCREENTONE, not the polka dots this used to have — and the PITCH IS MEASURED.
 *
 * The old fill was one 9px square grid of 2px dots, which at card size reads as
 * patterned stationery. Tone is a 45° lattice fine enough to be a VALUE rather
 * than a pattern: two offset square grids give the rotation without a rotated
 * element, so a `5px` square is a 3.54px lattice pitch.
 *
 * 3.54 because that is what the pages themselves are printed at. Autocorrelating
 * the toned rows of all seven shipped webps (`bench/task74-tone.mjs`) puts their
 * dominant texture period at 6–11 source pixels, which on a page served at 840px
 * into a 420px card is 3.0–5.5 CSS px, mean 3.75. The first pass at this ran a
 * 4.24px lattice with harder dots and a phone at 2x resolved every one of them —
 * captured, and it read as spotted stationery next to art whose own tone had
 * already dissolved into grey.
 *
 * The alpha is then chosen for a VALUE, not for a look: ~0.6px dots twice per
 * 25px² is 9% coverage, so 0x33 lands the record panel a few points of luminance
 * under the story panel above it. Enough to divide the card into two panels; not
 * enough to sit under 12px type as texture. `bench/task74-panels.mjs` measures
 * the two panels off the shipped capture and holds the gap in single figures.
 */
const TONE_DOT = `radial-gradient(circle at center, ${PALETTE.ink}33 0.6px, transparent 0.95px)`
const SCREENTONE: CSSProperties = {
  backgroundColor: PALETTE.pagePaper,
  backgroundImage: `${TONE_DOT}, ${TONE_DOT}`,
  backgroundSize: '5px 5px, 5px 5px',
  backgroundPosition: '0 0, 2.5px 2.5px',
}

/** The gutter between the card's two panels — the same ink the frame is drawn in. */
const GUTTER = `3px solid ${PALETTE.ink}`

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
    // The gutter between the panels' type and the card's ink. Read by BOTH panels
    // and by the caption label's own bleed, and re-declared by the phone rule in
    // `chapter-panels.tsx` — one number, so nothing can drift out of register.
    '--sw-card-pad': '20px',
    position: 'absolute',
    right: 'min(4vw, 48px)',
    top: '34vh',
    width: 'min(27vw, 340px)',
    border: `4px solid ${PALETTE.ink}`,
    borderRadius: 6,
    boxShadow: `-8px 12px 0 ${PALETTE.ink}`,
    background: PALETTE.pagePaper,
    // The panels carry their own padding now — the card is a frame around two of
    // them, and the gutter rule has to reach the ink on both sides.
    padding: 0,
    overflow: 'hidden',
    transform: `translateY(-50%) translateX(calc(120% * (1 - ${enter}))) rotate(${2 * enter}deg) scale(${0.85 + 0.15 * enter})`,
    color: PALETTE.ink,
    fontFamily: 'var(--sw-font-body)',
  }

  return (
    <article data-testid="sw-panel-data" className="sw-panel-data" style={style as CSSProperties}>
      {/* PANEL ONE — the story, on bare paper. */}
      <div
        className="sw-card-panel sw-card-story"
        style={{ padding: '18px var(--sw-card-pad) 16px' } as CSSProperties}
      >
        {/* The narrator box, in the comic's own hand. It runs out to the card's
            left ink so it reads as a label ON the panel rather than a heading
            inside a text column — which is where a manga puts its captions.
            The bleed is the panel's OWN padding negated, so the phone's tighter
            padding moves the label with it instead of past the frame. */}
        <p
          className="sw-card-eyebrow"
          data-sw-text="card-caption"
          style={{
            display: 'inline-block',
            margin: '0 0 10px calc(-1 * var(--sw-card-pad))',
            padding: '4px 10px 4px 8px',
            background: PALETTE.sky,
            border: `2px solid ${PALETTE.ink}`,
            borderLeft: `5px solid ${PALETTE.blossomDeep}`,
            fontFamily: 'var(--sw-font-panel)',
            fontSize: 14,
            letterSpacing: 1.1,
            lineHeight: 1.1,
            color: PALETTE.ink,
          }}
        >
          Chapter {index + 1} · {chapter.theme}
        </p>

        <h2
          className="sw-card-hook"
          style={{ fontFamily: 'var(--sw-font-display)', fontSize: 21, lineHeight: 1.2, margin: '0 0 10px' }}
        >
          {chapter.hook}
        </h2>

        {chapter.lines.map((line) => (
          <p key={line} className="sw-card-line" style={{ fontSize: 13.5, lineHeight: 1.45, margin: '0 0 6px' }}>
            {line}
          </p>
        ))}
      </div>

      {/* PANEL TWO — the record, on tone. */}
      <div
        className="sw-card-panel sw-card-record"
        style={{ ...SCREENTONE, borderTop: GUTTER, padding: '14px var(--sw-card-pad) 13px' } as CSSProperties}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, margin: 0 }}>
          {chapter.tech.map((tech) => (
            <span
              key={tech}
              style={{
                fontFamily: 'var(--sw-font-panel)',
                fontSize: 12,
                letterSpacing: 0.8,
                padding: '2px 9px',
                borderRadius: 2,
                border: `2px solid ${PALETTE.ink}`,
                // Printed labels: paper stock and a hard shadow, the same
                // vocabulary as the two cards themselves at a tenth the scale.
                background: PALETTE.pagePaper,
                boxShadow: `2px 2px 0 ${PALETTE.ink}`,
                color: PALETTE.ink,
              }}
            >
              {tech}
            </span>
          ))}
        </div>

        <div
          className="sw-card-stamps"
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 8, margin: '14px 0 0' }}
        >
          {chapter.stamps.map((stamp, i) => (
            <Stamp key={stamp} label={stamp} index={i} press={pressAt(enter, i, chapter.stamps.length)} />
          ))}
        </div>

        <p
          className="sw-card-credit"
          data-sw-text="card-credit"
          // Slightly firmer than the 0.72 it carried on plain cream: the tone under
          // it costs the smallest type on the card some of its contrast, and the
          // credit line is where a reader goes to find out WHO the chapter is about.
          style={{ margin: '14px 0 0', fontSize: 11.5, opacity: 0.8, letterSpacing: 0.3 }}
        >
          {chapter.caption}
        </p>
      </div>
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
 * The angle a stamp comes to REST at, by position in the row.
 *
 * It used to settle at exactly 0°, which is the one thing a hand-pressed stamp
 * never does — a row of them squared up to the millimetre reads as a row of
 * buttons. Small, alternating, and DETERMINISTIC: the same chapter must draw the
 * same card every time it is arrived at, so this is indexed rather than random.
 */
const REST_TILT = [-2.1, 1.5, -1.2, 2.0]
/** ...and they do not share a baseline either. Same argument, same table shape. */
const REST_DROP = [0, 3, 1, 4]

/**
 * One figure, pressed onto the card.
 *
 * The press is the whole gesture: it comes in oversized and slightly turned,
 * slams to size, and stays a few degrees off square the way a real rubber stamp
 * lands. `press` is squared on the way in so the last part of the travel is the
 * fast part — a linear approach reads as a zoom, not a stamp.
 *
 * The mark is INK ON THE PAGE and nothing else: one heavy pink rule, no fill, so
 * the panel's tone runs straight through it the way a stamp pressed onto a toned
 * page does. A first pass gave it a double rule with a paper-coloured hairline
 * between, which at 13px stopped reading as a die's second bite and started
 * reading as a white sticker laid on the tone (captured at 2x).
 */
function Stamp({ label, index, press }: { label: string; index: number; press: number }) {
  const settled = 1 - (1 - press) * (1 - press)
  const rest = REST_TILT[index % REST_TILT.length]
  const style: CSSProperties = {
    fontFamily: 'var(--sw-font-panel)',
    fontSize: 13,
    letterSpacing: 0.6,
    padding: '3px 10px',
    marginTop: REST_DROP[index % REST_DROP.length],
    color: PALETTE.blossomDeep,
    border: `2.5px solid ${PALETTE.blossomDeep}`,
    borderRadius: 2,
    background: 'transparent',
    opacity: Math.min(1, press * 2.2),
    transform: `scale(${1 + 0.75 * (1 - settled)}) rotate(${-3.5 + (3.5 + rest) * settled}deg)`,
    transformOrigin: 'center',
    whiteSpace: 'nowrap',
  }
  return (
    <span style={style} data-testid="sw-story-stamp">
      {label}
    </span>
  )
}
