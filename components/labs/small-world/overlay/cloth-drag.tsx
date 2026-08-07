'use client'
import type { CSSProperties } from 'react'
import { CHIBI_SHEET, anchorSrc } from '../manga/anchors'
import { PALETTE } from '../palette'
import { KETSU_LINE, easeOut, phase } from './info-beats'

/**
 * THE CLOTH-DRAG — a chibi runs across the leaf, and the chapter's line is on the
 * cloth she trails.
 *
 * ============================================================================
 * THE INVERSION CHANGED WHAT THIS IS (blind audit)
 * ============================================================================
 * It used to REVEAL the line: the words were clipped to the region the cloth had
 * swept, so until she had run the sentence did not exist. That is precisely the
 * failure the audit named — a fact gated on watching — and on a flick the line
 * was simply never there.
 *
 * So the sentence is now PRINTED FROM THE FIRST FRAME, and she runs across it.
 * The cloth passes over the words rather than delivering them: where it covers
 * them they read light-on-ink for a moment, and when she is gone the line is what
 * it always was. The gesture survives; the dependency does not.
 *
 * ============================================================================
 * WHAT IT IS
 * ============================================================================
 * Beat 4's line does not type itself on any more. A super-deformed mini-Alwina
 * runs the width of the panel with one hand trailing back, gripping the leading
 * edge of a banner, and THE BANNER IS THE SENTENCE: the words are laid down along
 * her path as she passes, the way a cloth unrolls. When she leaves the frame the
 * cloth settles and fades and what remains is an ordinary printed caption.
 *
 * The sprite's banner is BLANK by contract (see the v3 prompt pack) — the site
 * draws the cloth and the words on it, because they have to be typeset, animated
 * and legible at two very different leaf sizes.
 *
 * ============================================================================
 * WHY IT IS A MASKED REVEAL AND NOT A CLOTH SIMULATION
 * ============================================================================
 * Budgeted honestly: a real cloth needs a solver, a per-frame mesh and a texture
 * for the type, and it would run on every chapter stop on a page that already
 * carries a WebGL scene. What actually sells "fabric being laid" is much cheaper —
 * the leading edge arriving with the runner, a waving trailing edge behind her,
 * and the text appearing only where the cloth has already passed. So:
 *
 *  - the RUNNER's x is the clock;
 *  - the CLOTH is one SVG path whose top and bottom edges are sine waves, drawn
 *    from the left of the panel to wherever she is;
 *  - the TEXT is clipped to exactly that swept region, so a word is never visible
 *    before the cloth reaches it;
 *  - the WAVE decays as the cloth comes to rest, so the settle is the wave dying
 *    rather than a separate animation.
 *
 * ============================================================================
 * SCROLL-PURITY AND REDUCED MOTION
 * ============================================================================
 * The run rides the leaf's own ink clock, exactly as the panel borders do — the
 * same released-once-arrived signal, so nothing here starts a second timeline and
 * a scrub replays it identically.
 *
 * REDUCED MOTION IS NOT A FASTER RUN. There is no runner, no cloth, and no
 * reveal: the line is simply present, printed. A caption that a reader cannot see
 * until an animation has finished is an accessibility failure however gentle the
 * animation is, so the reduced path is the words, immediately.
 */

/** Where the runner is, 0 (off the left edge) → 1 (off the right), for a clock. */
export function runnerAt(t: number): number {
  return easeOut(phase(t, KETSU_LINE))
}

/**
 * How much of the line has been laid, for a clock.
 *
 * The cloth's leading edge is at her trailing hand, which is BEHIND her — so the
 * text lags the runner by `HAND_LAG` of the panel width. Without the lag the words
 * appear out of her chest, which reads as her emitting them rather than dragging
 * them.
 */
export const HAND_LAG = 0.14
export function layAt(t: number): number {
  return Math.max(0, Math.min(1, (runnerAt(t) - HAND_LAG) / (1 - HAND_LAG)))
}

/** Amplitude of the trailing wave, which decays to nothing as the cloth rests. */
function waveAmp(run: number): number {
  // Full while she is moving, gone by the time she is off the edge — the settle IS
  // the wave dying, so there is no second animation to keep in step with this one.
  return run >= 1 ? 0 : Math.sin(Math.PI * Math.min(1, run / 0.92)) * 0.9 + (1 - run) * 0.1
}

/**
 * The cloth's outline for a given sweep: a rectangle whose long edges ripple.
 *
 * Drawn in a 100 x 20 space so the wave's wavelength is expressed in the same
 * units at any leaf size, and stretched with `preserveAspectRatio: none`.
 */
function clothPath(sweep: number, amp: number, phaseShift: number): string {
  const right = sweep * 100
  if (right <= 0) return ''
  const step = 4
  const top: string[] = []
  const bottom: string[] = []
  for (let x = 0; x <= right; x += step) {
    // The ripple grows toward the TRAILING end (the left, away from her hand):
    // the cloth is taut where she holds it and loose where it has been dropped.
    const slack = right > 0 ? 1 - x / right : 0
    const w = Math.sin((x / 100) * Math.PI * 3.2 + phaseShift) * amp * slack
    top.push(`${x.toFixed(2)},${(3 + w).toFixed(2)}`)
    bottom.unshift(`${x.toFixed(2)},${(17 + w).toFixed(2)}`)
  }
  if (top.length === 0) return ''
  return `M ${top.join(' L ')} L ${bottom.join(' L ')} Z`
}

/**
 * The runner sprite.
 *
 * PLACEHOLDER UNTIL THE SHEET LANDS. `CHIBI_SHEET.ready` flips to true when
 * `chibi-run` is prepared, and the only thing that changes is which of these two
 * branches draws — the run, the lag, the cloth and the reveal are all built and
 * captured against the placeholder, so the sprite swap cannot move any of them.
 *
 * The placeholder is deliberately a crude ink figure rather than an empty box: a
 * box tells a reviewer nothing about whether the RUN reads, and the run is the
 * thing being approved.
 */
function Runner({ frame, flip }: { frame: number; flip: boolean }) {
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
          transform: flip ? 'scaleX(-1)' : undefined,
        }}
      />
    )
  }
  // The stand-in: big head, tiny body, one arm trailing back. Enough of a
  // silhouette to judge the timing and the hand's height against the cloth.
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
        {/* the trailing arm — the hand that holds the cloth, at banner height */}
        <path d="M9 19.5 L1.5 22" fill="none" strokeLinecap="round" />
        {/* legs, alternating with the frame so the stride reads */}
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

/**
 * The whole beat: the cloth, the words on it, and the runner who drags them.
 *
 * `height` is the band the cloth occupies as a fraction of the panel — the runner
 * is scaled to it, so the sprite and the cloth stay in register at any leaf size.
 */
export function ClothDrag({
  line,
  t,
  reduced = false,
}: {
  line: string
  /** The leaf's ink clock, in ms. */
  t: number
  reduced?: boolean
}) {
  // REDUCED MOTION: the words, printed, with none of the above.
  if (reduced) {
    return (
      <span data-sw-text="info-line" data-testid="sw-cloth-line" style={LINE_STYLE}>
        {line}
      </span>
    )
  }

  const run = runnerAt(t)
  const lay = layAt(t)
  const amp = waveAmp(run)
  // Six poses over the run, and the stride rate is a property of the DISTANCE
  // covered rather than of time — so she never moonwalks when the clock eases.
  const frame = Math.min(CHIBI_SHEET.frames - 1, Math.floor(run * 14) % CHIBI_SHEET.frames)
  const path = clothPath(lay, amp, run * 9)

  return (
    <div
      data-testid="sw-cloth-drag"
      style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}
    >
      {/* THE CLOTH. Behind the words, drawn only as far as she has dragged it. */}
      {path ? (
        <svg
          viewBox="0 0 100 20"
          preserveAspectRatio="none"
          aria-hidden
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <path
            d={path}
            // Semi-transparent now that it passes OVER the sentence rather than
            // carrying it: the words stay readable through the cloth.
            fill={PALETTE.pagePaper}
            fillOpacity={0.66}
            stroke={PALETTE.ink}
            strokeWidth={0.6}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            // It fades out as it settles: what remains is a printed caption, not a
            // banner someone left on the page.
            opacity={run >= 1 ? 0 : 1}
            style={{ transition: 'none' }}
          />
        </svg>
      ) : null}

      {/* THE WORDS. Printed, complete, from the first frame — see the note above. */}
      <span data-sw-text="info-line" data-testid="sw-cloth-line" style={{ ...LINE_STYLE, position: 'relative' }}>
        {line}
      </span>

      {/* THE RUNNER, ahead of her own hand. She leaves the frame; the cloth stays. */}
      {run > 0 && run < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: `${run * 100}%`,
            top: '50%',
            width: '18%',
            aspectRatio: '24 / 30',
            // Her BODY clears the cloth band and only the trailing hand drops into
            // it — captured with her at the band's centre, where she stood on top of
            // the words she was supposed to be dragging.
            transform: 'translate(-30%, -88%)',
            pointerEvents: 'none',
          }}
        >
          <Runner frame={frame} flip={false} />
        </div>
      ) : null}
    </div>
  )
}

const LINE_STYLE: CSSProperties = {
  fontFamily: 'var(--sw-font-panel)',
  fontSize: 'max(11px, 5cqw)',
  letterSpacing: '0.02em',
  lineHeight: 1.2,
  color: PALETTE.ink,
  textAlign: 'center',
  padding: '0 1.8cqw',
  width: '100%',
}
