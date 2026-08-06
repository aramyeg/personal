'use client'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { MANGA_PAGES, mangaPageSrc } from '../manga'
import { PALETTE } from '../palette'
import {
  KETSU_INK,
  KETSU_LINE,
  KETSU_TAIL,
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
  TEN_SUFFIX,
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
        <rect
          x="0.5"
          y="0.5"
          width="99"
          height="99"
          pathLength={1}
          fill="none"
          stroke={inverted ? PALETTE.pagePaper : PALETTE.ink}
          strokeWidth={RULE_CQW}
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

/** Beat 1: a wide shot cut from the panel this chapter's story page gave up. */
function KiPanel({ crop, alt, t }: { crop: SpotCrop; alt: string; t: number }) {
  return (
    <InkedPanel ink={inkOf(t, KI_INK)} style={{ flex: '0 0 auto', aspectRatio: `${cropAspect(crop)}` }}>
      <Spot crop={crop} alt={alt} reveal={easeOut(phase(t, KI_ART))} />
    </InkedPanel>
  )
}

/** Beat 2: the same art, closer, with at most one supporting figure printed on it. */
function ShoPanel({ crop, alt, note, t }: { crop: SpotCrop; alt: string; note?: string; t: number }) {
  const shown = phase(t, SHO_NOTE)
  return (
    <InkedPanel
      ink={inkOf(t, SHO_INK)}
      tone="context"
      style={{ flex: '0 0 auto', aspectRatio: `${cropAspect(crop)}` }}
    >
      <Spot crop={crop} alt={alt} reveal={easeOut(phase(t, SHO_ART))} />
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
            transform: `translateY(${(1 - shown) * 30}%)`,
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

      {hero.kind === 'number' ? (
        <HeroNumber hero={hero} t={t} fg={fg} />
      ) : (
        <HeroCount hero={hero} t={t} fg={fg} />
      )}
    </InkedPanel>
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
  const eased = easeOut(p)
  const shown = Math.round(hero.value * eased)
  const suffix = phase(t, TEN_SUFFIX)
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
        opacity: p > 0 ? 1 : 0,
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
function HeroCount({ hero, t, fg }: { hero: Extract<Hero, { kind: 'count' }>; t: number; fg: string }) {
  const { count, label } = hero
  // A mark's size is a function of how many there are: thirteen at the four-mark
  // size overflow the panel and wrap, which reads as a ruler rather than a tally.
  const w = Math.min(9, 62 / count)
  const done = phase(t, [markWindow(count - 1, count)[0], markWindow(count - 1, count)[1]])
  return (
    <div
      data-testid="sw-info-hero"
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
          const own = easeOut(phase(t, markWindow(i, count)))
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
                fill={PALETTE.blossomDeep}
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
function KetsuPanel({ line, tools, footer, t }: InfoPageSpec['ketsu'] & { footer: InfoPageSpec['footer']; t: number }) {
  const typed = phase(t, KETSU_LINE)
  const shown = Math.round(line.length * typed)
  const tail = phase(t, KETSU_TAIL)
  return (
    <InkedPanel
      ink={inkOf(t, KETSU_INK)}
      tone="aside"
      style={{ flex: '0 0 auto', flexDirection: 'column', padding: '2cqw 0' }}
    >
      <span
        data-sw-text="info-line"
        style={{
          fontFamily: 'var(--sw-font-panel)',
          fontSize: type(5),
          letterSpacing: '0.02em',
          lineHeight: 1.2,
          color: PALETTE.ink,
          textAlign: 'center',
          padding: '0 1.8cqw',
        }}
      >
        {line.slice(0, shown)}
      </span>
      <span
        data-sw-text="info-footer"
        style={{
          fontFamily: 'var(--sw-font-body)',
          fontSize: type(3),
          lineHeight: 1.24,
          color: PALETTE.ink,
          opacity: tail * 0.82,
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
      <KiPanel crop={spec.ki.crop} alt={spec.ki.alt} t={t} />
      <ShoPanel crop={spec.sho.crop} alt={spec.sho.alt} note={spec.sho.note} t={t} />
      <TenPanel hero={spec.ten.hero} inverted={spec.ten.inverted} t={t} />
      <KetsuPanel line={spec.ketsu.line} tools={spec.ketsu.tools} footer={spec.footer} t={t} />
    </div>
  )
}
