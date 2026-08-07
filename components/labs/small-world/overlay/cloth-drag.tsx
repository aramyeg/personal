'use client'
import type { CSSProperties, ReactNode } from 'react'
import { CHIBI_SHEET, anchorSrc } from '../manga/anchors'
import { PALETTE } from '../palette'
import { CvSheetLink } from './cv-sheet-link'
import type { InfoPageSpec } from './info-page-spec'
import { KETSU_LINE, easeOut, phase } from './info-beats'

/**
 * THE CLOTH-DRAG — a chibi runs across the leaf unrolling a sheet, AND THE WORDS
 * ARE PRINTED ON THE SHEET.
 *
 * ============================================================================
 * THIS IS THE THIRD VERSION, AND THE FIRST ONE THAT IS BOTH THINGS AT ONCE
 * ============================================================================
 * V1 REVEALED the line: the words were clipped to the region the cloth had swept,
 * so until she had run, the sentence did not exist. The blind audit named that
 * correctly as a fact gated on watching — on a flick the line was simply never
 * there — and it was right.
 *
 * V2 was the remedy applied to that finding: print the sentence from frame 1 and
 * demote the cloth to a 0.66-opacity veil that passes OVER it. The fact was safe
 * and the gag was gone. A translucent thing sliding across a caption is not a
 * character unrolling a page, and Aram's verdict on it was exactly that.
 *
 * V3 — this one — is possible because Task 82 found the actual cause. The reason
 * a flicked-past card showed no sentence was never that text-on-a-reveal is
 * unsafe. It was that the page ran on a WALL CLOCK: `useInkClock` counted real
 * milliseconds from the leaf's arrival, so it could still be mid-count after the
 * reader had stopped and started reading. `t` is now a pure function of scroll
 * (`info-beats.ts`), and the unfurl closes before the story stop a fling snaps to.
 *
 * That dissolves the conflict rather than trading one side of it away: "the sheet
 * is open" and "the reader is looking at this card" are now the SAME CONDITION.
 * So the words can go back onto the paper.
 *
 * ============================================================================
 * WHAT KEEPS THE AUDIT'S LAW, CONCRETELY
 * ============================================================================
 * Three separate guarantees, because one would be a promise and three are a
 * structure:
 *
 *  1. THE TEXT IS IN THE DOM, COMPLETE, FROM FRAME 1. Every line element exists
 *     and is laid out at p = 0. Nothing is inserted as the sheet passes.
 *  2. THE TEXT IS NEVER CLIPPED TO THE SWEEP. The leading edge carries a SOFT
 *     MASK that fades words ahead of the paper toward `AHEAD_ALPHA` — it dims,
 *     it never removes, and it is dropped entirely once the sheet is open. A word
 *     ahead of the edge is grey ink on white, which is legible; it is not absent.
 *  3. THE UNFURL FINISHES BEFORE THE READER DOES. `KETSU_LINE` closes at 93% of
 *     the page's span and the span closes before `DWELL_MID`. A settled card is
 *     an open sheet by construction.
 *
 * REDUCED MOTION IS NOT A FASTER RUN. p = 1, no runner, no wave: the sheet is
 * simply open and the words are simply printed.
 *
 * ============================================================================
 * WHY THE 2.5D IS DOM AND NOT WEBGL
 * ============================================================================
 * A real roll needs a vertex shader — the Codrops author's "rolling things with
 * CSS or SVG is next to impossible" is honest — but a real roll also means the
 * text is a texture, and the only route to arbitrary HTML on that mesh is
 * html2canvas, i.e. words baked to pixels. Copy on this page is DATA (a story
 * rewrite is in flight), so anything that rasterises a sentence is disqualified
 * before it is judged on looks.
 *
 * What survives is a curl APPROXIMATED across a few line elements: a `perspective`
 * wrapper, `transform-style: preserve-3d`, and a per-line `rotateX`/`translateZ`
 * hinged at the line's top edge, easing to flat as the sheet settles. Piecewise
 * linear, and at a 100px band on a phone indistinguishable from a real curve. The
 * text stays real DOM text — selectable, searchable, and a prop.
 */

/**
 * THE RUNNER'S BOX, and the one place the sheet and the sprite agree about where
 * her hand is.
 *
 * `HAND_LAG` used to be 0.14, hand-picked, because the bake she is drawn from has
 * no visible gripping hand at all and 0.14 was what stopped the words appearing
 * out of her chest. It is DERIVED now: her frame is `RUNNER_W` of the band, it is
 * anchored `RUNNER_ANCHOR_X` of its own width left of her travel position, and the
 * gripping hand sits `GRIP_X` across it. The lag is the distance between the two,
 * so the sheet's leading edge lands in her hand rather than near it.
 *
 * `GRIP_X` is a CONTRACT WITH THE BAKE, not an observation of it: the sprite is
 * re-baked with the trailing arm posed onto the banner line at this fraction. If
 * the bake moves the hand, this number moves with it and nothing else does.
 */
export const RUNNER_W = 0.18
export const RUNNER_ANCHOR_X = 0.3
export const GRIP_X = 0.1
export const HAND_LAG = (RUNNER_ANCHOR_X - GRIP_X) * RUNNER_W

/** Where the runner is, 0 (off the left edge) → 1 (off the right), for a clock. */
export function runnerAt(t: number): number {
  return easeOut(phase(t, KETSU_LINE))
}

/**
 * How much of the sheet has been laid: her GRIP's position, remapped so the sheet
 * reaches the full width of the band exactly as she leaves it.
 */
export function layAt(t: number): number {
  return Math.max(0, Math.min(1, (runnerAt(t) - HAND_LAG) / (1 - HAND_LAG)))
}

/**
 * Amplitude of the trailing wave, which decays to nothing as the sheet rests.
 *
 * 2.1 of the path's 20 units — about a tenth of the band. The first pass used 0.9
 * and it measured as nothing: captured mid-unfurl the edges were straight, so the
 * sheet read as a rectangle sliding out rather than as cloth being pulled.
 */
function waveAmp(run: number): number {
  // Full while she is moving, gone by the time she is off the edge — the settle IS
  // the wave dying, so there is no second animation to keep in step with this one.
  return run >= 1 ? 0 : Math.sin(Math.PI * Math.min(1, run / 0.92)) * 2.1 + (1 - run) * 0.2
}

/** How far the leading edge bulges past her hand, in path units — the roll's girth. */
const LEAD_BULGE = 3

/**
 * Where the sheet's long edges sit in the 0–20 path space, and therefore how much
 * air the words must keep from them.
 *
 * IT IS SHARED WITH THE TEXT'S PADDING ON PURPOSE. The first version drew the
 * edges at 1.4/18.6 (7% and 93% of the band) while the text wrapper padded by
 * about 4%, and captured on chapter 1 the contact line ran straight through the
 * paper's own outline. One number, converted once, so the two cannot drift.
 */
const EDGE_Y = 1.0
/** The same inset as a percentage of the band, for the text that sits on it. */
const TEXT_INSET_PCT = (EDGE_Y / 20) * 100 + 3

/**
 * The sheet's outline for a given sweep: a band whose long edges ripple and whose
 * LEADING EDGE IS A CURVE.
 *
 * Drawn in a 100 x 20 space so the wave's wavelength is expressed in the same
 * units at any leaf size, and stretched with `preserveAspectRatio: none`.
 *
 * The leading edge was a straight vertical line in the first pass and captured as
 * exactly what it was: a box clipped by a ruler. Paper coming off a roll in
 * somebody's hand is round there, so the two long edges are joined by a quadratic
 * that bulges past her grip. It is 3 units — about 1.5% of the band's width, six
 * pixels on a desktop leaf — because the job is to stop the cut reading as a cut,
 * not to draw a cylinder.
 */
function clothPath(sweep: number, amp: number, phaseShift: number): string {
  const right = sweep * 100
  if (right <= 0) return ''
  const step = 4
  const top: string[] = []
  const bottom: string[] = []
  for (let x = 0; x <= right; x += step) {
    // The ripple grows toward the TRAILING end (the left, away from her hand):
    // the sheet is taut where she holds it and loose where it has been dropped.
    const slack = right > 0 ? 1 - x / right : 0
    const w = Math.sin((x / 100) * Math.PI * 3.2 + phaseShift) * amp * slack
    top.push(`${x.toFixed(2)},${(EDGE_Y + w).toFixed(2)}`)
    bottom.unshift(`${x.toFixed(2)},${(20 - EDGE_Y + w).toFixed(2)}`)
  }
  if (top.length === 0) return ''
  const bulge = amp > 0 ? LEAD_BULGE : 0
  return `M ${top.join(' L ')} Q ${(right + bulge).toFixed(2)},10 ${bottom[0]} L ${bottom
    .slice(1)
    .join(' L ')} Z`
}

/**
 * Break a sentence into whole-word runs, so each can carry its own curl.
 *
 * ONE LINE PER ~6 WORDS, between two and `max`. Fewer than two and there is no
 * curl to see; more than four and the sheet becomes a paragraph, which is the one
 * thing the text guard on this page exists to prevent.
 *
 * Balanced by CHARACTERS rather than by word count — four short words and four
 * long ones are not two equal lines — and the `remaining` check is what stops a
 * greedy split leaving the last line with one word on it.
 */
export function sheetLines(text: string, max = 4): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return words.length ? [words.join(' ')] : []
  const n = Math.max(2, Math.min(max, Math.ceil(words.length / 6)))
  const target = words.join(' ').length / n
  const out: string[] = []
  let cur = ''
  for (let i = 0; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i]
    const wordsLeft = words.length - i - 1
    const linesLeft = n - out.length - 1
    if (out.length < n - 1 && next.length >= target && wordsLeft >= linesLeft && linesLeft > 0) {
      out.push(next)
      cur = ''
    } else {
      cur = next
    }
  }
  if (cur) out.push(cur)
  return out
}

/**
 * The runner sprite.
 *
 * The stride rate is a property of the DISTANCE covered rather than of time, which
 * is why she never moonwalks when the clock eases — and it is why the mechanism
 * needed no change when the clock became the scroll.
 *
 * The fallback is deliberately a crude ink figure rather than an empty box: a box
 * tells a reviewer nothing about whether the RUN reads, and the run is the thing
 * being approved.
 */
function Runner({ frame }: { frame: number }) {
  if (CHIBI_SHEET.ready) {
    return (
      <div
        data-testid="sw-chibi"
        style={{
          width: '100%',
          height: '100%',
          backgroundImage: `url(${anchorSrc(CHIBI_SHEET.id)})`,
          backgroundSize: `${CHIBI_SHEET.frames * 100}% 100%`,
          backgroundPosition: `${(frame / (CHIBI_SHEET.frames - 1)) * 100}% 0`,
        }}
      />
    )
  }
  // The stand-in: big head, tiny body, one arm trailing back to the sheet's edge.
  const bob = frame % 2 === 0 ? 0 : -1.2
  return (
    <svg
      data-testid="sw-chibi"
      viewBox="0 0 24 30"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
      aria-hidden
    >
      <g transform={`translate(0 ${bob})`} stroke={PALETTE.ink} strokeWidth={1.4} fill={PALETTE.pagePaper}>
        <circle cx="12" cy="9" r="8" />
        <rect x="8.5" y="17" width="7" height="7.5" rx="1.6" />
        {/* the trailing arm — the hand that holds the sheet, at GRIP_X of the frame */}
        <path d="M9 19.5 L2.4 23.5" fill="none" strokeLinecap="round" />
        <circle cx="2.4" cy="23.5" r="1.5" />
        <path
          d={frame % 2 === 0 ? 'M10.5 24.5 L8 29.5 M13.5 24.5 L16.5 28' : 'M10.5 24.5 L7 28 M13.5 24.5 L17 29.5'}
          fill="none"
          strokeLinecap="round"
        />
        {/* goggles, so it is recognisably her even as a stand-in */}
        <path d="M5.5 7.5 L18.5 7.5" fill="none" strokeWidth={2.4} strokeLinecap="round" />
      </g>
    </svg>
  )
}

/** How far ahead of the paper's edge a word is dimmed to. It never reaches zero. */
const AHEAD_ALPHA = 0.42
/** The feather's width, as a percentage of the band. Short: it is an edge, not a fade. */
const FEATHER = 9
/** How far each line hinges out of the page before it settles flat. */
const TILT_DEG = 17
/** Stagger between one line settling and the next, as a fraction of the unfurl. */
const STAGGER = 0.09

/**
 * The whole beat: the sheet, the words printed on it, and the runner who unrolls it.
 */
export function ClothDrag({
  line,
  intro,
  t,
  reduced = false,
}: {
  line: string
  /** Present on the FIRST sheet only — see `info-page-spec.ts`. */
  intro?: InfoPageSpec['ketsu']['intro']
  /** The leaf's page progress, in the beats' millisecond units. */
  t: number
  reduced?: boolean
}) {
  // REDUCED MOTION: the sheet is simply open. Same DOM, same sheet, no runner and
  // no wave — the reduced path is the words, immediately, not a hurried version of
  // the animation.
  const p = reduced ? 1 : easeOut(phase(t, KETSU_LINE))
  const run = reduced ? 1 : runnerAt(t)
  const lay = reduced ? 1 : layAt(t)
  const amp = reduced ? 0 : waveAmp(run)
  const frame = Math.min(CHIBI_SHEET.frames - 1, Math.floor(run * 14) % CHIBI_SHEET.frames)
  const path = clothPath(lay, amp, run * 9)

  // NO ROLE-AND-YEARS ROW. It came over from the retired title card, it is not in
  // the approved sheet copy, and it said a third time what the identity line above
  // it and the colophon below it already say. It also cost a row the hero could
  // not spare: the sheet is `0 0 auto` and the hero takes what is left, so every
  // line here is a line off chapter 1's SELF-TAUGHT — captured, with the wordmark
  // climbing out of its panel onto the photograph above.
  // THE ESCAPE HATCH RIDES THE CONTACT ROW (Task 83) rather than taking one of its
  // own, for exactly the budget reason in the note above: the first sheet is the
  // tallest and every row here is a row off chapter 1's hero panel. `after` is a
  // node so the middot stays a REAL TEXT NODE inside the row's own inline flow —
  // see the separator note further down, which is the same defect twice.
  const rows: {
    key: string
    text: string
    kind: keyof typeof ROW_STYLE
    after?: ReactNode
  }[] = [
    ...(intro
      ? [
          { key: 'name', text: intro.name, kind: 'name' as const },
          { key: 'says', text: intro.says, kind: 'says' as const },
        ]
      : []),
    ...sheetLines(line).map((text, i) => ({ key: `l${i}`, text, kind: 'line' as const })),
    ...(intro
      ? [
          {
            key: 'contact',
            text: intro.contact,
            kind: 'contact' as const,
            after: (
              <>
                {' · '}
                <CvSheetLink />
              </>
            ),
          },
        ]
      : []),
  ]

  const edge = lay * 100
  // Dropped entirely once the sheet is open: a mask is a compositing layer, and
  // the settled page is the one that has to be crisp.
  const mask =
    lay >= 1
      ? undefined
      : `linear-gradient(to right, #000 0%, #000 ${edge}%, rgba(0,0,0,${AHEAD_ALPHA}) ${Math.min(
          100,
          edge + FEATHER
        )}%, rgba(0,0,0,${AHEAD_ALPHA}) 100%)`

  return (
    <div
      data-testid="sw-cloth-drag"
      data-unfurl={p.toFixed(3)}
      style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}
    >
      {/* THE SHEET. OPAQUE PAPER, because it is a surface now and not a veil — the
          words are printed ON it. It is drawn only as far as she has pulled it,
          and it does NOT fade when she leaves: what she was dragging is the page
          the reader is now reading. */}
      {path ? (
        <svg
          viewBox="0 0 100 20"
          preserveAspectRatio="none"
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            // The sheet is allowed past its own box: the leading edge bulges, and
            // clipping the bulge would put the ruler back.
            overflow: 'visible',
          }}
        >
          {/* A SHADOW, because at rest the sheet is a rectangle of paper on paper.
              Captured without one, the settled state read as a bordered text box
              inside a bordered panel — two boxes, no sheet. An offset copy is what
              says "this is lying ON the page" in one shape and no filter. */}
          <path
            d={path}
            transform="translate(0.35 0.55)"
            fill={PALETTE.ink}
            opacity={0.17}
            strokeLinejoin="round"
          />
          <path
            d={path}
            fill={PALETTE.pagePaper}
            stroke={PALETTE.ink}
            strokeWidth={0.6}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}

      {/* THE WORDS. Real DOM text, complete from the first frame, sitting on the
          paper in a perspective wrapper so the leading lines are still hinged out
          of the page while the trailing ones have lain flat. */}
      <div
        data-sw-text="info-line"
        data-testid="sw-cloth-line"
        style={{
          position: 'relative',
          width: '100%',
          padding: `${TEXT_INSET_PCT}% 2.2cqw`,
          boxSizing: 'border-box',
          textAlign: 'center',
          perspective: '46cqw',
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      >
        <div style={{ transformStyle: 'preserve-3d' }}>
          {rows.map((row, i) => {
            // Each line flattens on its own beat, top first, so the sheet lies
            // down rather than snapping. All of them are flat at p = 1.
            const settle = easeOut(
              Math.max(0, Math.min(1, (p - i * STAGGER) / Math.max(0.2, 1 - STAGGER * (rows.length - 1))))
            )
            const lift = 1 - settle
            return (
              <div
                key={row.key}
                style={{
                  ...ROW_STYLE[row.kind],
                  // Hinged at its TOP edge: paper falling forward, not a card
                  // spinning about its middle.
                  transformOrigin: '50% 0%',
                  transform: `rotateX(${lift * TILT_DEG}deg) translateZ(${lift * -3.2}cqw)`,
                }}
              >
                {row.text}
                {row.after}
                {/* THE SEPARATOR IS A REAL TEXT NODE, and it is not decoration.
                    Splitting the sentence into block elements splits its TEXT
                    CONTENT too, and without this the line reads "…choose — then
                    taught…" on screen but concatenates as "thentaught" — which is
                    what a copy-paste, a page search and an assistive reader all
                    get. Caught by e2e asserting the leaf contains `ketsu.line`.
                    A trailing space collapses visually, so it costs nothing. */}
                {i < rows.length - 1 ? ' ' : ''}
              </div>
            )
          })}
        </div>
      </div>

      {/* THE RUNNER, ahead of her own hand. She leaves the frame; the sheet stays. */}
      {run > 0 && run < 1 ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: `${run * 100}%`,
            top: '50%',
            width: `${RUNNER_W * 100}%`,
            aspectRatio: '24 / 30',
            // Her BODY clears the sheet and only the trailing hand drops into it —
            // captured with her at the band's centre, standing on the words she was
            // supposed to be dragging.
            transform: `translate(${-RUNNER_ANCHOR_X * 100}%, -88%)`,
            pointerEvents: 'none',
          }}
        >
          <Runner frame={frame} />
        </div>
      ) : null}
    </div>
  )
}

const BASE_ROW: CSSProperties = {
  fontFamily: 'var(--sw-font-panel)',
  color: PALETTE.ink,
  letterSpacing: '0.02em',
  lineHeight: 1.22,
}

/**
 * The sheet's three registers. NO PINK anywhere on it: pink is the hero number's
 * semantic channel and the moment it decorates, numbers stop reading as the point.
 */
const ROW_STYLE: Record<'name' | 'says' | 'line' | 'contact', CSSProperties> = {
  name: { ...BASE_ROW, fontSize: 'max(13px, 6.6cqw)', lineHeight: 1.06 },
  says: {
    ...BASE_ROW,
    fontFamily: 'var(--sw-font-body)',
    fontSize: 'max(10px, 3.5cqw)',
    opacity: 0.9,
    marginBottom: '0.6cqw',
  },
  line: { ...BASE_ROW, fontSize: 'max(11px, 5cqw)' },
  contact: {
    ...BASE_ROW,
    fontFamily: 'var(--sw-font-body)',
    fontSize: 'max(10px, 3.4cqw)',
    opacity: 0.82,
    marginTop: '0.9cqw',
  },
}
