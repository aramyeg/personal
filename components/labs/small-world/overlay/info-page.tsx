'use client'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { MANGA_PAGES, mangaPageSrc } from '../manga'
import {
  BAND_ASPECT,
  ZOOM,
  anchorFor,
  anchorSrc,
  reactionCell,
  REACTION_SHEET,
  type ReactionName,
} from '../manga/anchors'
import { ClothDrag } from './cloth-drag'
import { PALETTE } from '../palette'
import {
  KETSU_INK,
  KI_ART,
  KI_INK,
  PAGE_DONE,
  SHO_ART,
  SHO_INK,
  SHO_NOTE,
  TEN_BURST,
  TEN_INK,
  TEN_NUMBER,
  TEN_SPEED,
  easeOut,
  inkOf,
  markWindow,
  phase,
} from './info-beats'
import {
  infoPageFor,
  type Hero,
  type InfoPageSpec,
  type SpotCrop,
} from './info-page-spec'

/**
 * THE RIGHT-HAND LEAF, INKED — four beats, drawn in reading order.
 *
 * `info-page-spec.ts` says what each chapter's page contains and why; `info-beats.ts`
 * says when each part of it arrives; this file draws it.
 *
 * ============================================================================
 * IT SIZES ITSELF AGAINST THE PAGE, NOT THE VIEWPORT
 * ============================================================================
 * Every measurement is in `cqw` against the leaf's own inline size, which is what
 * the printed page beside it already does for its lettering. The same page is drawn
 * at ~378px in the spread and ~300px in the phone's stack, and a layout in px is
 * correct at one of them. Sizing against the container makes the phone free rather
 * than a second stylesheet — the lesson Task 74's fit round paid for. Type keeps a
 * px FLOOR through `type()`, because a ratio right at 378px is unreadable at 300.
 *
 * ============================================================================
 * THREE TONES, AND ONE PINK
 * ============================================================================
 * In black and white, TONE IS THE HIERARCHY, so there are exactly three densities
 * and each means something: PRIMARY (the hero's ground), CONTEXT (a supporting
 * panel), ASIDE (the colophon's strip). A fourth density would stop being a rank
 * and start being a texture.
 *
 * PINK IS A SEMANTIC CHANNEL. It appears on the beat-3 number and its impact burst
 * and nowhere else on this page. The first draft of this leaf spent pink on caption
 * rules and stamp outlines; measured against the research's own rule, that is
 * exactly what stops a number reading as the point.
 */

/**
 * ============================================================================
 * THE INVERSION (blind audit, information conveyance 3/10)
 * ============================================================================
 * INFORMATION IS PRESENT INSTANTLY. ANIMATION EMBELLISHES. Never gate a fact on
 * watching.
 *
 * This page was built the other way round and the audit measured the cost: at a
 * fixed dwell it said NOTHING for the first half-second and carried no colophon
 * until 3.0s, inside a caption window about 700px wide on a 2133px chapter. A
 * visitor who flicks — which is most of them — saw a blank card with some ink
 * borders drawing themselves. The progressive-drawing research is real and it
 * still holds, but it holds FOR PEOPLE WHO WATCH, and a CV may not be legible
 * only to them.
 *
 * So every FACT — the colophon, the stack, her line, the hero's value — renders
 * at full strength from the first frame, and the clock now drives only things
 * whose absence costs nothing: the border ink, the art wipe, the stamp punch, the
 * burst, the runner.
 *
 * THE HERO NUMBER IS THE HARD CASE and the trade is recorded rather than hidden.
 * A count-up from zero is not a delayed fact, it is a WRONG one — a card caught
 * at 200ms reads "+0%". So the numeral is always final and the flourish is a
 * scale punch instead of a counting one. The research's "delayed earned reveal"
 * is what was given up; being right at every scroll position is what was bought.
 */

/** The page is 2:3, like the printed pages it is bound with. */
export const INFO_PAGE_ASPECT = 1.5

const RULE_CQW = 0.85
const GAP = '1.6cqw'

/** Type that never falls below a floor, however small the leaf gets. */
const type = (cqw: number, floorPx = 11) => `max(${floorPx}px, ${cqw}cqw)`

/** The three densities, and nothing between them. */
const TONE = {
  primary: `${PALETTE.ink}3D`,
  context: `${PALETTE.ink}26`,
  aside: `${PALETTE.ink}14`,
} as const

function toneStyle(density: keyof typeof TONE | 'none'): CSSProperties {
  if (density === 'none') return { backgroundColor: PALETTE.pagePaper }
  const dot = `radial-gradient(circle at center, ${TONE[density]} 0.6px, transparent 0.95px)`
  return {
    backgroundColor: PALETTE.pagePaper,
    backgroundImage: `${dot}, ${dot}`,
    backgroundSize: '5px 5px, 5px 5px',
    backgroundPosition: '0 0, 2.5px 2.5px',
  }
}

/**
 * A panel whose border DRAWS ITSELF ON.
 *
 * The rule is an SVG rect with `pathLength=1`, so one dashoffset from 1 to 0 inks
 * the whole frame at a constant rate regardless of its proportions — which is what
 * lets every panel on the page share one progress number without a per-panel
 * length calculation. `vectorEffect: non-scaling-stroke` keeps the weight honest
 * while the rect stretches to the panel.
 */
function InkedPanel({
  ink,
  tone = 'none',
  inverted = false,
  children,
  style,
}: {
  ink: number
  tone?: keyof typeof TONE | 'none'
  inverted?: boolean
  children?: ReactNode
  style?: CSSProperties
}) {
  const ground = inverted ? PALETTE.ink : undefined
  return (
    <div
      style={{
        position: 'relative',
        flex: '1 1 0',
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        ...(inverted ? { backgroundColor: ground } : toneStyle(tone)),
        ...style,
      }}
    >
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        {/* THE FRAME IS ALWAYS THERE, faintly, and the ink draws ON TOP of it.
            A dashoffset alone means no frame at all at t=0 — the panel structure,
            which is itself information, would be gated on watching exactly like
            the words were. Two strokes: a light one that never animates, and the
            drawn one over it. */}
        <rect
          x="0.5"
          y="0.5"
          width="99"
          height="99"
          fill="none"
          stroke={inverted ? PALETTE.pagePaper : PALETTE.ink}
          opacity={0.28}
          vectorEffect="non-scaling-stroke"
          style={{ strokeWidth: `${RULE_CQW}cqw` }}
        />
        <rect
          x="0.5"
          y="0.5"
          width="99"
          height="99"
          pathLength={1}
          fill="none"
          stroke={inverted ? PALETTE.pagePaper : PALETTE.ink}
          strokeDasharray={1}
          strokeDashoffset={1 - ink}
          vectorEffect="non-scaling-stroke"
          style={{ strokeWidth: `${RULE_CQW}cqw` }}
        />
      </svg>
      {children}
    </div>
  )
}

/**
 * A close-up cut out of a printed page.
 *
 * The crop is a rectangle in page fractions: the image is scaled until the crop's
 * WIDTH fills the panel, then translated by the crop's own origin. Transform
 * percentages are of the element, which is what makes this one expression rather
 * than a pixel computation the component cannot do.
 */
function Spot({ crop, alt, reveal }: { crop: SpotCrop; alt: string; reveal: number }) {
  const page = MANGA_PAGES[crop.page]
  if (!page) return null
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
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
          // The art arrives with the ink rather than after it: a wipe from the
          // leading edge, which reads as the panel being filled in.
          clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)`,
        }}
      />
    </div>
  )
}

/**
 * An art beat sizes itself to its CROP, never the other way round.
 *
 * `Spot` scales the source until the crop's WIDTH fills the panel, so a panel with
 * any other aspect shows an arbitrary strip of it. Giving the panel the crop's own
 * aspect makes the fit exact and nothing is ever cropped by accident or letterboxed.
 */
const cropAspect = (crop: SpotCrop): number => {
  const page = MANGA_PAGES[crop.page]
  return page ? (crop.w * page.size.w) / (crop.h * page.size.h) : 1.6
}

/**
 * A rectangle of an anchor, drawn to fill its panel — and optionally zoomed into
 * its own centre for beat 2.
 *
 * Same technique `Spot` uses on the printed pages: scale until the crop's WIDTH
 * fills the box, then translate by the crop's origin. `object-fit: cover` was
 * what the blind audit called grey mush — it takes a full-width slice of the
 * whole illustration, and most of a full-width slice is background.
 */
function AnchorCrop({
  id,
  band,
  alt,
  reveal,
  zoom = 1,
}: {
  id: string
  band: { x: number; y: number; w: number }
  alt: string
  reveal: number
  zoom?: number
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        transform: `scale(${zoom})`,
        transformOrigin: 'center',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={anchorSrc(id)}
        alt={alt}
        decoding="async"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          maxWidth: 'none',
          width: `${100 / band.w}%`,
          // Percentages in a transform are of the ELEMENT, per axis — so the band's
          // origin in image fractions IS the shift, on both axes, with no
          // conversion. (A first version invented one and produced nonsense.)
          transform: `translate(${-band.x * 100}%, ${-band.y * 100}%)`,
          display: 'block',
          clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)`,
        }}
      />
    </div>
  )
}


/**
 * Beat 1: the chapter's own generated anchor panel.
 *
 * FALLBACK, and it is deliberate rather than temporary scaffolding left in: while
 * the v3 art is being generated the leaf shows a crop of the chapter's printed
 * page instead, so the whole mechanism — the beats, the zoom, the cloth, the
 * motion states — is reviewable and capturable now. `ANCHORS[n].ready` is the one
 * switch, and nothing about the layout moves when it flips.
 */
function KiPanel({ chapter, crop, alt, t }: { chapter: number; crop: SpotCrop; alt: string; t: number }) {
  const anchor = anchorFor(chapter)
  const reveal = easeOut(phase(t, KI_ART))
  if (anchor?.ready) {
    // A BAND THROUGH THE ANCHOR, not the whole 3:2 panel.
    //
    // The anchors are generated at 3:2 and a four-beat vertical stack cannot
    // afford two panels that tall — captured the moment the art went live: beats
    // 1 and 2 took 504px of the leaf's 567 and pushed the hero and the colophon
    // off the bottom. `cover` on a wider box crops top and bottom, which is where
    // the pack put the air: every anchor's subject is composed at its centre,
    // because beat 2 zooms there.
    return (
      <InkedPanel ink={inkOf(t, KI_INK)} style={{ flex: '0 0 auto', aspectRatio: `${BAND_ASPECT}` }}>
        <AnchorCrop id={anchor.id} band={anchor.band} alt={alt} reveal={reveal} />
      </InkedPanel>
    )
  }
  return (
    <InkedPanel ink={inkOf(t, KI_INK)} style={{ flex: '0 0 auto', aspectRatio: `${cropAspect(crop)}` }}>
      <Spot crop={crop} alt={alt} reveal={reveal} />
    </InkedPanel>
  )
}

/** Beat 2: the same art, closer, with at most one supporting figure printed on it. */
function ShoPanel({
  chapter,
  crop,
  alt,
  note,
  t,
}: {
  chapter: number
  crop: SpotCrop
  alt: string
  note?: string
  t: number
}) {
  const shown = 1
  const nudge = phase(t, SHO_NOTE)
  const anchor = anchorFor(chapter)
  const reveal = easeOut(phase(t, SHO_ART))
  // THE ZOOM IS DERIVED, not authored: the pack composes every anchor so its
  // centre holds a close-up at exactly this magnification, so restating the
  // rectangle would be a second place for one agreement to drift. Scaling to
  // ZOOM and offsetting by half the overflow is what centres it.
  return (
    <InkedPanel
      ink={inkOf(t, SHO_INK)}
      tone="context"
      style={{ flex: '0 0 auto', aspectRatio: anchor?.ready ? `${BAND_ASPECT}` : `${cropAspect(crop)}` }}
    >
      {anchor?.ready ? (
        // THE ZOOM IS A TRANSFORM, not a percentage offset. An earlier version
        // sized the image to 240% and shifted it by -70% of the parent, which is
        // correct arithmetic and rendered as a third of a picture with white
        // beside it — too many percentages resolving against too many boxes.
        // Scaling about the centre says the same thing in one operation that
        // cannot be misread.
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={anchorSrc(anchor.id)}
            alt={alt}
            decoding="async"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              transform: `scale(${ZOOM})`,
              transformOrigin: 'center',
              clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)`,
            }}
          />
        </div>
      ) : (
        <Spot crop={crop} alt={alt} reveal={reveal} />
      )}
      {note ? (
        <span
          data-testid="sw-info-note"
          style={{
            position: 'absolute',
            right: '2.4cqw',
            bottom: '2cqw',
            fontFamily: 'var(--sw-font-panel)',
            fontSize: type(4.4),
            letterSpacing: '0.03em',
            lineHeight: 1,
            color: PALETTE.ink,
            background: PALETTE.pagePaper,
            border: `${RULE_CQW}cqw solid ${PALETTE.ink}`,
            padding: '0.6cqw 1.2cqw',
            // The note is a caption ON the picture, so it arrives after the art —
            // and it is INK, not pink: it is not the hero.
            opacity: shown,
            transform: `translateY(${(1 - nudge) * 12}%)`,
            whiteSpace: 'nowrap',
          }}
        >
          {note}
        </span>
      ) : null}
    </InkedPanel>
  )
}

/**
 * Beat 3: THE HERO.
 *
 * Half the page, and everything in it points at one number. Speed lines rake in
 * from the frame; the number counts up from zero into an already-drawn empty panel;
 * the unit lands after the digits stop; a single pink burst marks the impact.
 *
 * THE NUMBER BREAKS THE BORDER on purpose. Hand-lettered SFX in manga is not
 * contained by its panel — it is drawn over it — and that is the one device that
 * says "this is the sound the panel makes" rather than "this is a label inside a
 * box". `overflow: visible` on the panel and a negative inset on the type are the
 * whole trick.
 */
function TenPanel({ hero, inverted, t }: { hero: Hero; inverted?: boolean; t: number }) {
  const ink = inkOf(t, TEN_INK)
  const speed = phase(t, TEN_SPEED)
  const burst = phase(t, TEN_BURST)
  const fg = inverted ? PALETTE.pagePaper : PALETTE.ink
  return (
    <InkedPanel
      ink={ink}
      tone={inverted ? 'none' : 'primary'}
      inverted={inverted}
      style={{ flex: '1 1 0', minHeight: 0 }}
    >
      {/* SPEED LINES — they aim AT the number, so they are drawn from the frame
          inward and they arrive BEFORE it. Their job is to have already pointed
          the eye at an empty space by the time it fills. */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        {Array.from({ length: 22 }, (_, i) => {
          const a = (i / 22) * Math.PI * 2 + 0.31
          const x = 50 + Math.cos(a) * 70
          const y = 50 + Math.sin(a) * 70
          const own = Math.min(1, Math.max(0, (speed * 1.6 - (i % 7) * 0.06) / 0.8))
          // Each line is drawn from the rim toward the centre and stops short.
          const k = 0.42 + 0.16 * ((i * 37) % 5) * 0.1
          return (
            <line
              key={i}
              x1={x}
              y1={y}
              x2={x + (50 - x) * k}
              y2={y + (50 - y) * k}
              stroke={fg}
              strokeWidth={0.5}
              opacity={own * (inverted ? 0.5 : 0.34)}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - own}
            />
          )
        })}
      </svg>

      {/* THE IMPACT BURST — one pink radial flash at the landing, gone in 300ms. */}
      {burst > 0 && burst < 1 ? (
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2
            const r0 = 14 + burst * 26
            const r1 = r0 + 9 + burst * 14
            return (
              <line
                key={i}
                x1={50 + Math.cos(a) * r0}
                y1={50 + Math.sin(a) * r0}
                x2={50 + Math.cos(a) * r1}
                y2={50 + Math.sin(a) * r1}
                stroke={PALETTE.blossomDeep}
                strokeWidth={1.4}
                strokeLinecap="round"
                opacity={1 - burst}
              />
            )
          })}
        </svg>
      ) : null}

      {hero.kind === 'sfx' ? (
        <HeroSfx hero={hero} t={t} fg={fg} />
      ) : hero.kind === 'number' ? (
        <HeroNumber hero={hero} t={t} fg={fg} />
      ) : (
        <HeroCount count={hero.count} label={hero.label} t={t} fg={fg} />
      )}
      <Chaser face="stunned" t={t} fg={fg} />
    </InkedPanel>
  )
}


/**
 * THE CHASER — a small reaction bust under the hero, the sports-manga event-sell.
 *
 * When a number lands in a sports manga, the next panel is somebody's FACE. The
 * cut to a reaction is what tells the reader the thing that just happened was
 * worth reacting to; without it a big number is an assertion, and with it the page
 * has told you how to feel about it before you have finished reading it.
 *
 * It arrives AFTER the burst — it is a reaction, so it cannot precede the event —
 * and it is small, because a chaser that competes with the hero is a second hero.
 *
 * PLACEHOLDER UNTIL `reactions` LANDS, on the same terms as the runner: the slot,
 * the timing and the size are built and captured now, and the sheet swap changes
 * only what is drawn inside the frame.
 */
function Chaser({ face, t, fg }: { face: ReactionName; t: number; fg: string }) {
  const shown = easeOut(phase(t, [TEN_BURST[1] - 120, TEN_BURST[1] + 200]))
  if (shown <= 0) return null
  const cell = reactionCell(face)
  return (
    <div
      data-testid="sw-info-chaser"
      data-reaction={face}
      style={{
        position: 'absolute',
        right: '2.4cqw',
        bottom: '2.4cqw',
        width: '19%',
        aspectRatio: '1',
        border: `${RULE_CQW}cqw solid ${fg}`,
        background: PALETTE.pagePaper,
        overflow: 'hidden',
        opacity: shown,
        // It snaps in slightly over-size, the way a cut-in panel is pasted on.
        transform: `rotate(3deg) scale(${0.86 + 0.14 * shown})`,
      }}
    >
      {REACTION_SHEET.ready ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundImage: `url(${anchorSrc(REACTION_SHEET.id)})`,
            backgroundSize: `${REACTION_SHEET.cols * 100}% ${REACTION_SHEET.rows * 100}%`,
            backgroundPosition: `${cell.x}% ${cell.y}%`,
          }}
        />
      ) : (
        <svg viewBox="0 0 20 20" style={{ width: '100%', height: '100%' }} aria-hidden>
          <g stroke={PALETTE.ink} strokeWidth={1.1} fill="none" strokeLinecap="round">
            <circle cx="10" cy="9" r="6.4" fill={PALETTE.pagePaper} />
            {/* stunned: huge eyes, small gasp */}
            <circle cx="7.6" cy="8.6" r="1.7" fill={PALETTE.ink} stroke="none" />
            <circle cx="12.4" cy="8.6" r="1.7" fill={PALETTE.ink} stroke="none" />
            <circle cx="8.1" cy="8" r="0.55" fill={PALETTE.pagePaper} stroke="none" />
            <circle cx="12.9" cy="8" r="0.55" fill={PALETTE.pagePaper} stroke="none" />
            <ellipse cx="10" cy="13" rx="1.1" ry="1.5" />
            {/* goggles pushed up */}
            <path d="M3.9 4.6 L16.1 4.6" strokeWidth={1.8} />
          </g>
        </svg>
      )}
    </div>
  )
}

function HeroNumber({
  hero,
  t,
  fg,
}: {
  hero: Extract<Hero, { kind: 'number' }>
  t: number
  fg: string
}) {
  const p = phase(t, TEN_NUMBER)
  // ALWAYS THE REAL NUMBER. See the inversion note at the top of this file.
  const shown = hero.value
  const suffix = 1
  // Anticipation, overshoot, settle — the stamp's own curve, ridden by the whole
  // numeral so the impact reads as a press rather than as a zoom.
  const settle = p < 1 ? 1 + 0.08 * Math.sin(Math.PI * p) : 1
  return (
    <div
      data-testid="sw-info-hero"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        // BREAKING THE FRAME: the numeral is allowed wider than its panel.
        margin: '0 -3cqw',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--sw-font-panel)',
          fontSize: type(26, 44),
          lineHeight: 0.86,
          color: PALETTE.blossomDeep,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
          transform: `rotate(-4deg) scale(${settle})`,
          // A hand-lettered number sits ON the art, so it carries the paper's own
          // outline rather than sitting in a box.
          WebkitTextStroke: `0.5cqw ${PALETTE.pagePaper}`,
          paintOrder: 'stroke fill',
        }}
      >
        {hero.prefix}
        {shown}
        <span style={{ opacity: suffix, marginLeft: '0.4cqw' }}>{hero.suffix}</span>
      </span>
      <span
        style={{
          fontFamily: 'var(--sw-font-panel)',
          fontSize: type(4.6),
          letterSpacing: '0.1em',
          lineHeight: 1,
          color: fg,
          opacity: suffix,
          marginTop: '0.6cqw',
        }}
      >
        {hero.label}
      </span>
      {hero.marks ? (
        <div style={{ marginTop: '1.6cqw', opacity: suffix }}>
          <HeroCount
            count={hero.marks.count}
            label={hero.marks.label}
            t={t}
            fg={fg}
            pink={false}
            scale={0.62}
            isHero={false}
          />
        </div>
      ) : null}
    </div>
  )
}

/**
 * A word given the number's treatment: hand-lettered SFX, oversized and tilted and
 * breaking the frame. For the chapters whose biggest claim is not a quantity.
 */
function HeroSfx({ hero, t, fg }: { hero: Extract<Hero, { kind: 'sfx' }>; t: number; fg: string }) {
  const p = phase(t, TEN_NUMBER)
  const settle = p < 1 ? 1 + 0.08 * Math.sin(Math.PI * p) : 1
  const tail = 1
  return (
    <div
      data-testid="sw-info-hero"
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 -3cqw' }}
    >
      <span
        style={{
          fontFamily: 'var(--sw-font-panel)',
          fontSize: type(19, 34),
          lineHeight: 0.9,
          color: PALETTE.blossomDeep,
          whiteSpace: 'nowrap',
          transform: `rotate(-4deg) scale(${settle})`,
          WebkitTextStroke: `0.5cqw ${PALETTE.pagePaper}`,
          paintOrder: 'stroke fill',
        }}
      >
        {hero.text}
      </span>
      <span
        style={{
          fontFamily: 'var(--sw-font-panel)',
          fontSize: type(4.6),
          letterSpacing: '0.1em',
          lineHeight: 1,
          color: fg,
          opacity: tail,
          marginTop: '0.6cqw',
        }}
      >
        {hero.label}
      </span>
    </div>
  )
}

/**
 * The Isotype hero: `count` repeated marks, planted one at a time.
 *
 * NEVER one big mark scaled up — that is the Isotype rule and it is the whole
 * reason this reads faster than the numeral would. Thirteen pennants say "a lot,
 * and exactly this many" in one look, and counting them is a pleasure.
 */
function HeroCount({
  count,
  label,
  t,
  fg,
  pink = true,
  scale = 1,
  isHero = true,
}: {
  count: number
  label: string
  t: number
  fg: string
  /** Pink only when the count IS the fact. A supporting row is ink. */
  pink?: boolean
  scale?: number
  /**
   * Whether this row IS the page's hero. A supporting count under a number is not
   * a second hero and must not answer to the one-hero gate — it rides along.
   */
  isHero?: boolean
}) {
  // A mark's size is a function of how many there are: thirteen at the four-mark
  // size overflow the panel and wrap, which reads as a ruler rather than a tally.
  const w = Math.min(9, 62 / count) * scale
  const done = 1
  return (
    <div
      {...(isHero ? { 'data-testid': 'sw-info-hero' } : {})}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.4cqw',
        margin: '0 -2cqw',
      }}
    >
      <div
        data-testid="sw-info-tally"
        data-count={count}
        style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '0.8cqw 1.2cqw' }}
      >
        {Array.from({ length: count }, (_, i) => {
          // Present from the first frame; the plant is a small drop on top of a
          // mark that is already countable.
          const own = 0.55 + 0.45 * easeOut(phase(t, markWindow(i, count)))
          return (
            <svg
              key={i}
              viewBox="0 0 12 20"
              aria-hidden
              style={{
                display: 'block',
                flex: '0 0 auto',
                width: `${w}cqw`,
                height: `${(w * 20) / 12}cqw`,
                opacity: own,
                // planted: it drops onto the line rather than fading in
                transform: `translateY(${(1 - own) * -34}%) scale(${0.9 + 0.1 * own})`,
              }}
            >
              <path d="M1.4 0.6 L1.4 19.4" stroke={fg} strokeWidth="1.5" strokeLinecap="round" fill="none" />
              <path
                d="M1.4 1.6 L11.2 4.6 L8.4 7.2 L11.2 9.8 L1.4 12.8 Z"
                fill={pink ? PALETTE.blossomDeep : 'none'}
                stroke={fg}
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
          fontSize: type(5),
          letterSpacing: '0.1em',
          lineHeight: 1,
          color: fg,
          opacity: done,
        }}
      >
        {label}
      </span>
    </div>
  )
}

/** Beat 4: quiet. Her line, then the colophon and the stack as an aside. */
function KetsuPanel({
  line,
  tools,
  footer,
  t,
  reduced,
}: InfoPageSpec['ketsu'] & { footer: InfoPageSpec['footer']; t: number; reduced: boolean }) {
  return (
    <InkedPanel
      ink={inkOf(t, KETSU_INK)}
      tone="aside"
      style={{ flex: '0 0 auto', flexDirection: 'column', padding: '2cqw 0' }}
    >
      {/* SHE DRAGS THE LINE IN. See cloth-drag.tsx — the sentence is the banner. */}
      <div style={{ position: 'relative', width: '100%', height: '38%', minHeight: '9cqw' }}>
        <ClothDrag line={line} t={t} reduced={reduced} />
      </div>
      <span
        data-sw-text="info-footer"
        style={{
          fontFamily: 'var(--sw-font-body)',
          fontSize: type(3),
          lineHeight: 1.24,
          color: PALETTE.ink,
          opacity: 0.82,
          textAlign: 'center',
          marginTop: '1.4cqw',
          padding: '0 1.4cqw',
        }}
      >
        {footer.role} · {footer.org} · {footer.period}
        <br />
        {tools.join(' · ')}
      </span>
    </InkedPanel>
  )
}

/**
 * Milliseconds since the page started inking.
 *
 * Ticks on rAF only while unfinished, then stops — a parked checkpoint costs
 * nothing. `instant` (reduced motion) skips the clock rather than fast-forwarding
 * it, so no frame is scheduled at all.
 *
 * `?swInk=<ms>` PINS the clock, and exists so a capture harness can photograph a
 * named moment — mid-ink, the empty frame before the number, the burst — rather
 * than racing it. Development only: it is a camera, not a feature.
 */
function useInkClock(running: boolean, instant: boolean): number {
  const [elapsed, setElapsed] = useState(instant ? PAGE_DONE : 0)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
      const pinned = new URLSearchParams(window.location.search).get('swInk')
      if (pinned !== null) {
        setElapsed(Number(pinned))
        return
      }
    }
    if (instant) {
      setElapsed(PAGE_DONE)
      return
    }
    if (!running) {
      startRef.current = null
      setElapsed(0)
      return
    }
    let raf = 0
    let stopped = false
    const tick = (now: number) => {
      if (stopped) return
      if (startRef.current === null) startRef.current = now
      const next = now - startRef.current
      setElapsed(next)
      if (next < PAGE_DONE) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
    }
  }, [running, instant])

  return elapsed
}

/**
 * The whole leaf.
 *
 * `enter` is the spread's entrance clock; the page starts inking once the leaf has
 * essentially arrived, so the beats land on a page that has stopped moving.
 */
export function InfoPage({
  chapter,
  enter,
  instant = false,
}: {
  chapter: number
  enter: number
  instant?: boolean
}) {
  const spec = infoPageFor(chapter)
  const t = useInkClock(enter > 0.55, instant)
  if (!spec) return null
  return (
    <div
      data-testid="sw-info-page"
      style={{
        containerType: 'inline-size',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: GAP,
        padding: '2.2cqw',
        boxSizing: 'border-box',
        background: PALETTE.pagePaper,
        overflow: 'hidden',
      }}
    >
      <KiPanel chapter={chapter} crop={spec.ki.crop} alt={spec.ki.alt} t={t} />
      <ShoPanel chapter={chapter} crop={spec.sho.crop} alt={spec.sho.alt} note={spec.sho.note} t={t} />
      <TenPanel hero={spec.ten.hero} inverted={spec.ten.inverted} t={t} />
      <KetsuPanel line={spec.ketsu.line} tools={spec.ketsu.tools} footer={spec.footer} t={t} reduced={instant} />
    </div>
  )
}
