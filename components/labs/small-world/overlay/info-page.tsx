'use client'
import type { CSSProperties, ReactNode } from 'react'
import { MANGA_PAGES, mangaPageSrc } from '../manga'
import { PALETTE } from '../palette'
import { infoPageFor, type InfoPanel, type InfoPageSpec, type SpotCrop } from './info-page-spec'

/**
 * THE RIGHT-HAND LEAF, INKED.
 *
 * `info-page-spec.ts` says what each chapter's page contains; this file knows how
 * to print it. Everything here is the vocabulary the printed pages already use —
 * ink rules, screentone, one pink — applied to information instead of to story.
 *
 * ============================================================================
 * IT SIZES ITSELF AGAINST THE PAGE, NOT THE VIEWPORT
 * ============================================================================
 * Every measurement below is in `cqw` against the page's own inline size, which
 * is what the printed pages next to it already do for their lettering. That is
 * not tidiness: the same page is drawn at ~378px in the desktop spread and
 * ~300px in the phone's stack, and a layout in px is then correct at one of
 * them. Sizing against the container makes the phone case free instead of a
 * second stylesheet — the lesson Task 74's fit round paid for.
 *
 * Type still gets a FLOOR, via `max(Npx, Mcqw)`, because a ratio that is right
 * at 378px is unreadable at 300px. The floors are 11px, which is where T73's
 * lettering work landed.
 */

/** The page is 2:3, like the printed pages it is bound with. */
export const INFO_PAGE_ASPECT = 1.5

/** Ink weights, in page-relative units so a rule is the same rule at any size. */
const RULE = '0.85cqw'
const PANEL_GAP = '1.5cqw'

/** Type that never falls below a floor, however small the page gets. */
const type = (cqw: number, floorPx = 11) => `max(${floorPx}px, ${cqw}cqw)`

const SCREENTONE = `radial-gradient(circle at center, ${PALETTE.ink}33 0.6px, transparent 0.95px)`

/** A panel: paper, an ink border, and whatever it holds. */
function Panel({ children, tone = false, pad = true }: { children: ReactNode; tone?: boolean; pad?: boolean }) {
  const style: CSSProperties = {
    position: 'relative',
    flex: '1 1 0',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `${RULE} solid ${PALETTE.ink}`,
    background: PALETTE.pagePaper,
    ...(tone
      ? {
          backgroundImage: `${SCREENTONE}, ${SCREENTONE}`,
          backgroundSize: '5px 5px, 5px 5px',
          backgroundPosition: '0 0, 2.5px 2.5px',
        }
      : null),
    padding: pad ? '1.2cqw 1.3cqw' : 0,
    overflow: 'hidden',
  }
  return <div style={style}>{children}</div>
}

/**
 * A close-up cut out of a printed page.
 *
 * The crop is a rectangle in page fractions, so the image is scaled until the
 * crop's WIDTH fills the panel and then translated by the crop's own origin —
 * percentages in a transform are of the element, which is what makes this one
 * expression rather than a computation in pixels the component cannot do. The
 * panel takes the crop's true aspect, so nothing is ever letterboxed or
 * stretched: the art arrives at the proportions it was drawn in.
 */
function Spot({ crop, alt }: { crop: SpotCrop; alt: string }) {
  const page = MANGA_PAGES[crop.page]
  if (!page) return null
  const aspect = (crop.w * page.size.w) / (crop.h * page.size.h)
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: `${aspect}`,
        border: `${RULE} solid ${PALETTE.ink}`,
        background: PALETTE.pagePaper,
        overflow: 'hidden',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mangaPageSrc(page.id)}
        alt={alt}
        decoding="async"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          maxWidth: 'none',
          width: `${100 / crop.w}%`,
          transform: `translate(${-crop.x * 100}%, ${-crop.y * 100}%)`,
          display: 'block',
        }}
      />
    </div>
  )
}

/**
 * A figure, pressed.
 *
 * The NUMERAL is the whole point — it is set large enough to be legible across a
 * room, because a recruiter's eye lands on the number and decides from there
 * whether to read the label under it. `press` runs the existing entrance: it
 * arrives oversized and slightly turned and slams to size, and it rests a degree
 * or two off square, the way a hand-pressed stamp lands.
 */
function Stamp({ value, label, press, index }: { value: string; label: string; press: number; index: number }) {
  const settled = 1 - (1 - press) * (1 - press)
  const rest = [-2.4, 1.8, -1.4][index % 3]
  return (
    <div
      data-testid="sw-info-stamp"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.2cqw',
        color: PALETTE.blossomDeep,
        border: `0.7cqw solid ${PALETTE.blossomDeep}`,
        borderRadius: '0.5cqw',
        padding: '0.9cqw 1.6cqw',
        opacity: Math.min(1, press * 2.2),
        transform: `scale(${1 + 0.7 * (1 - settled)}) rotate(${-4 + (4 + rest) * settled}deg)`,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontFamily: 'var(--sw-font-panel)', fontSize: type(13.5, 26), lineHeight: 0.92 }}>{value}</span>
      <span
        style={{
          fontFamily: 'var(--sw-font-panel)',
          fontSize: type(3.5),
          letterSpacing: '0.08em',
          lineHeight: 1,
          color: PALETTE.ink,
        }}
      >
        {label}
      </span>
    </div>
  )
}

/** A word pressed like a rubber stamp, for the chapters whose claim is not a number. */
function Mark({ text, press }: { text: string; press: number }) {
  const settled = 1 - (1 - press) * (1 - press)
  return (
    <span
      data-testid="sw-info-mark"
      style={{
        fontFamily: 'var(--sw-font-panel)',
        fontSize: type(7),
        letterSpacing: '0.05em',
        lineHeight: 1.05,
        textAlign: 'center',
        color: PALETTE.blossomDeep,
        border: `0.7cqw solid ${PALETTE.blossomDeep}`,
        borderRadius: '0.5cqw',
        padding: '0.9cqw 1.4cqw',
        opacity: Math.min(1, press * 2.2),
        transform: `scale(${1 + 0.7 * (1 - settled)}) rotate(${-4 + 1.4 * settled}deg)`,
      }}
    >
      {text}
    </span>
  )
}

/**
 * `count` drawn flags.
 *
 * The count is the claim, so it is DRAWN rather than written: thirteen pennants
 * on a line read as "a lot, and exactly this many" in one look, and counting them
 * is a small pleasure rather than a task. Pink cloth, ink pole — the flags are
 * one of the three places the page spends its only colour.
 */
function Tally({ count, label, press }: { count: number; label: string; press: number }) {
  const flags = Array.from({ length: count }, (_, i) => i)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9cqw', width: '100%' }}>
      <div
        data-testid="sw-info-tally"
        data-count={count}
        style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.6cqw 1.1cqw' }}
      >
        {flags.map((i) => {
          // Each flag lands in turn, left to right, across the back half of the
          // entrance — a row that appears all at once reads as an icon, and the
          // point of drawing thirteen of them is that they arrive as thirteen.
          const own = Math.min(1, Math.max(0, (press * count - i) / 0.9))
          return (
            <svg
              key={i}
              viewBox="0 0 12 20"
              width="7cqw"
              style={{
                display: 'block',
                overflow: 'visible',
                opacity: own,
                transform: `translateY(${(1 - own) * -25}%)`,
              }}
              aria-hidden
            >
              {/* the pole */}
              <path d="M1.4 0.6 L1.4 19.4" stroke={PALETTE.ink} strokeWidth="1.5" strokeLinecap="round" fill="none" />
              {/* the cloth, with a swallowtail so it reads as a pennant at 16px */}
              <path
                d="M1.4 1.6 L11.2 4.6 L8.4 7.2 L11.2 9.8 L1.4 12.8 Z"
                fill={PALETTE.blossomDeep}
                stroke={PALETTE.ink}
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
            </svg>
          )
        })}
      </div>
      <span
        style={{
          fontFamily: 'var(--sw-font-panel)',
          fontSize: type(4),
          letterSpacing: '0.1em',
          lineHeight: 1,
          color: PALETTE.ink,
        }}
      >
        {label}
      </span>
    </div>
  )
}

/**
 * The tools of the trade, hanging from a rail.
 *
 * A row of pills is a UI control; a row of tags on a rail is a workbench. Same
 * words, and the second one belongs on a printed page — which is the whole
 * argument of this round in miniature.
 */
function Shelf({ tools }: { tools: string[] }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        // Top-aligned: things hang DOWN from a rail. Centred in the panel, the
        // rail floated in the middle of the box and the whole thing read as a
        // labelled diagram rather than as a wall with tools on it.
        justifyContent: 'flex-start',
        paddingTop: '1.4cqw',
      }}
    >
      {/* the rail, running the full width of the panel and out to its ink */}
      <div style={{ height: RULE, background: PALETTE.ink, width: '100%', flex: '0 0 auto' }} />
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: '0 2.4cqw',
        }}
      >
        {tools.map((tool) => (
          <span key={tool} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* the hook it hangs by */}
            <span style={{ width: RULE, height: '2.6cqw', background: PALETTE.ink, flex: '0 0 auto' }} />
            <span
              data-testid="sw-info-tool"
              style={{
                fontFamily: 'var(--sw-font-panel)',
                fontSize: type(4.1),
                letterSpacing: '0.05em',
                lineHeight: 1.05,
                whiteSpace: 'nowrap',
                color: PALETTE.ink,
                border: `${RULE} solid ${PALETTE.ink}`,
                background: PALETTE.pagePaper,
                // The hard shadow is what makes a tag an OBJECT hanging off a
                // rail rather than a word in a box.
                boxShadow: `0.5cqw 0.6cqw 0 ${PALETTE.ink}`,
                padding: '0.7cqw 1.4cqw',
              }}
            >
              {tool}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** THE one sentence, in the narrator box the printed pages use for narration. */
function CaptionPanel({ text }: { text: string }) {
  return (
    <span
      data-sw-text="info-caption"
      style={{
        fontFamily: 'var(--sw-font-panel)',
        fontSize: type(5.1),
        letterSpacing: '0.02em',
        lineHeight: 1.2,
        color: PALETTE.ink,
        textAlign: 'center',
      }}
    >
      {text}
    </span>
  )
}

function PanelBody({ panel, press }: { panel: InfoPanel; press: number }) {
  switch (panel.kind) {
    case 'spot':
      return <Spot crop={panel.crop} alt={panel.alt} />
    case 'stamps':
      return (
        <Panel tone>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.2cqw 2.6cqw' }}>
            {panel.figures.map((f, i) => (
              <Stamp
                key={f.value + f.label}
                value={f.value}
                label={f.label}
                index={i}
                press={pressAt(press, i, panel.figures.length)}
              />
            ))}
          </div>
        </Panel>
      )
    case 'mark':
      return (
        <Panel tone>
          <Mark text={panel.text} press={press} />
        </Panel>
      )
    case 'tally':
      return (
        <Panel>
          <Tally count={panel.count} label={panel.label} press={press} />
        </Panel>
      )
    case 'shelf':
      return (
        <Panel pad={false}>
          <Shelf tools={panel.tools} />
        </Panel>
      )
    case 'caption':
      // THE PINK LEADING EDGE is the printed pages' own narrator device
      // (`manga-lettering.tsx` rules its caption boxes the same way), and this
      // panel holds the same thing they do: the voice speaking over the picture.
      // Borrowing the rule rather than inventing one is what ties the two leaves
      // together at the level a reader notices without noticing.
      return (
        <div
          style={{
            flex: '1 1 0',
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `${RULE} solid ${PALETTE.ink}`,
            borderLeft: `2.6cqw solid ${PALETTE.blossomDeep}`,
            background: PALETTE.pagePaper,
            padding: '1.2cqw 1.4cqw',
            overflow: 'hidden',
          }}
        >
          <CaptionPanel text={panel.text} />
        </div>
      )
  }
}

/** How much of the press one stamp's own landing takes. */
const STAMP_SPAN = 0.55

/**
 * 0→1 for stamp `i` of `count`: nothing, then a fast press.
 *
 * The stagger is DERIVED from the count rather than fixed, so the last stamp
 * always finishes exactly as the entrance does. With a fixed stagger a
 * three-figure chapter (qiibee, Wooskill) ran its last press past the end of the
 * clock — the clock parks at 1, so that stamp sat permanently two-thirds
 * pressed: over-sized and crooked, for the whole dwell, on the two pages with
 * the most figures to show. Carried over from the card this page replaces,
 * because the trap is a property of the staging and not of the old layout.
 */
export function pressAt(press: number, i: number, count: number): number {
  const stagger = count > 1 ? (1 - STAMP_SPAN) / (count - 1) : 0
  return Math.min(1, Math.max(0, (press - i * stagger) / STAMP_SPAN))
}

/**
 * The whole leaf.
 *
 * `enter` is the spread's entrance clock, already eased. The marks and stamps
 * ride it so the page's figures land as it settles, rather than running a second
 * clock the reader has no reason to expect.
 */
export function InfoPage({ chapter, enter }: { chapter: number; enter: number }) {
  const spec = infoPageFor(chapter)
  if (!spec) return null
  // The figures begin once the page has essentially arrived.
  const press = Math.min(1, Math.max(0, (enter - 0.55) / 0.45))
  return <InfoPageBody spec={spec} press={press} />
}

export function InfoPageBody({ spec, press }: { spec: InfoPageSpec; press: number }) {
  return (
    <div
      data-testid="sw-info-page"
      style={{
        // The page is the container everything inside it is measured against.
        containerType: 'inline-size',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: PANEL_GAP,
        padding: '2.2cqw',
        boxSizing: 'border-box',
        background: PALETTE.pagePaper,
        overflow: 'hidden',
      }}
    >
      {spec.rows.map((row, r) => (
        <div
          key={r}
          style={{
            display: 'flex',
            gap: PANEL_GAP,
            ...(row.h === 'auto' ? { flex: '0 0 auto' } : { flex: `${row.h} 1 0`, minHeight: 0 }),
          }}
        >
          {row.cells.map((cell, c) => (
            <div key={c} style={{ flex: `${cell.w} 1 0`, minWidth: 0, display: 'flex' }}>
              <PanelBody panel={cell.panel} press={press} />
            </div>
          ))}
        </div>
      ))}

      {/* The colophon. Not a panel — printed matter sits outside the frames, the
          way a page number does. */}
      <p
        data-sw-text="info-footer"
        style={{
          margin: 0,
          flex: '0 0 auto',
          fontFamily: 'var(--sw-font-body)',
          fontSize: type(3.2),
          lineHeight: 1.22,
          letterSpacing: '0.01em',
          color: PALETTE.ink,
          opacity: 0.82,
          textAlign: 'center',
        }}
      >
        {spec.footer.role} · {spec.footer.org} · {spec.footer.period}
      </p>
    </div>
  )
}
