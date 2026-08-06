'use client'
import type { CSSProperties } from 'react'
import { balloonFontCqw, DRAWN_INK_MARGIN, LINE_STEP, pageAspect } from '../manga/lettering'
import type { Balloon, Caption, MangaPage } from '../manga/types'
import { PALETTE } from '../palette'

/**
 * The words. Everything with letters in it is drawn here rather than in the
 * art — that was the deal the pages were generated under (blank balloons, no
 * lettering anywhere), and it is why the dialogue is crisp at any card size,
 * types itself, and is in the lab's own font.
 */

/** Trailing block cursor while a line is still arriving. */
function Typed({ text, shown }: { text: string; shown: number }) {
  const done = shown >= text.length
  return (
    <>
      {text.slice(0, shown)}
      {!done && shown > 0 ? <span style={{ opacity: 0.45 }}>▍</span> : null}
    </>
  )
}

/**
 * A balloon the ART does not contain, drawn in its style.
 *
 * Two of the pack's lines came back with no balloon at all (page-1's big panel,
 * page-4's foundation panel). Rather than drop those lines or letter them onto
 * bare art, the site draws the balloon: an ellipse in the same weight of ink as
 * the printed ones, with a tail toward the speaker — a cloud scallop with two
 * trailing bubbles for a thought, a straight spike for speech.
 *
 * The shape is drawn in the page's own coordinate space and stretched with it,
 * which is what keeps the balloon registered to the head its tail points at.
 */
function DrawnBalloon({ balloon, aspect }: { balloon: Balloon; aspect: number }) {
  if (!balloon.drawn) return null
  const { at, box, voice, drawn } = balloon

  // COORDINATES. The viewBox is 100 wide by 100*aspect tall — the page's own
  // proportions — so one unit is the same distance on both axes and the ink
  // strokes stay circular rather than being squashed. That makes X and Y
  // DIFFERENT conversions from a page fraction, which is the trap: an unscaled
  // y put page-4's balloon a fifteenth of a page above its own words, with
  // "Now it holds." printed on the rock below it (captured).
  const X = (v: number) => v * 100
  const Y = (v: number) => v * 100 * aspect

  // The ink sits outside the readable box. An ellipse with semi-axes (rx, ry)
  // contains a rectangle of half-extents (a, b) only when (a/rx)² + (b/ry)² ≤ 1,
  // so the margin has to clear √2 — at the 1.22 this started with, the box's
  // corners stuck out and the last line of a two-line balloon fell outside it.
  const MARGIN = DRAWN_INK_MARGIN
  const rx = X(box.w / 2) * MARGIN
  const ry = Y(box.h / 2) * MARGIN
  const cx = X(at.x)
  const cy = Y(at.y)
  const tail = { x: X(drawn.tail.x), y: Y(drawn.tail.y) }

  // Where the tail leaves the balloon: the point on the ellipse toward the
  // speaker, found by normalising the direction in the ellipse's own units.
  const dx = tail.x - cx
  const dy = tail.y - cy
  const k = 1 / (Math.hypot(dx / rx, dy / ry) || 1)
  const edge = { x: cx + k * dx, y: cy + k * dy }

  const ink = PALETTE.ink
  return (
    <svg
      viewBox={`0 0 100 ${100 * aspect}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <g>
        {voice === 'thought' ? (
          <>
            {/* two trailing bubbles, shrinking toward the thinker */}
            <ellipse
              cx={edge.x + (tail.x - edge.x) * 0.45}
              cy={edge.y + (tail.y - edge.y) * 0.45}
              rx={rx * 0.16}
              ry={ry * 0.16}
              fill="#fff"
              stroke={ink}
              strokeWidth={0.45}
            />
            <ellipse
              cx={edge.x + (tail.x - edge.x) * 0.78}
              cy={edge.y + (tail.y - edge.y) * 0.78}
              rx={rx * 0.09}
              ry={ry * 0.09}
              fill="#fff"
              stroke={ink}
              strokeWidth={0.45}
            />
          </>
        ) : (
          <polygon
            points={`${edge.x - rx * 0.22},${edge.y - ry * 0.16} ${edge.x + rx * 0.22},${edge.y + ry * 0.2} ${tail.x},${tail.y}`}
            fill="#fff"
            stroke={ink}
            strokeWidth={0.5}
            strokeLinejoin="round"
          />
        )}
        {/* Drawn LAST so its fill covers where the tail meets it, the way an
            inked balloon reads — one closed shape, not a shape plus a spike. */}
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#fff" stroke={ink} strokeWidth={0.6} />
      </g>
    </svg>
  )
}

/** One balloon's lettering (and, for the two the art lacks, the balloon too). */
export function BalloonText({
  balloon,
  page,
  shown,
}: {
  balloon: Balloon
  page: MangaPage
  shown: number
}) {
  const aspect = pageAspect(page)
  const font = balloonFontCqw(balloon, page)
  const style: CSSProperties = {
    position: 'absolute',
    left: `${balloon.at.x * 100}%`,
    top: `${balloon.at.y * 100}%`,
    width: `${balloon.box.w * 100}%`,
    height: `${balloon.box.h * 100}%`,
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    fontFamily: 'var(--sw-font-body)',
    fontWeight: balloon.voice === 'thought' ? 600 : 700,
    fontStyle: balloon.voice === 'thought' ? 'italic' : 'normal',
    fontSize: `${font}cqw`,
    lineHeight: LINE_STEP,
    color: PALETTE.ink,
    // Hyphenation would break a typing animation's rhythm; balloons are sized
    // from the same estimate the browser is wrapping against, so leave it off.
    hyphens: 'none',
    pointerEvents: 'none',
  }
  return (
    <>
      {balloon.drawn ? <DrawnBalloon balloon={balloon} aspect={aspect} /> : null}
      <span style={style}>
        <span>
          <Typed text={balloon.text} shown={shown} />
        </span>
      </span>
    </>
  )
}

/**
 * A narrator box. Never in the art by design, so the site owns its whole look:
 * a hard-cornered ink-ruled box with the lab pink on its leading edge — one of
 * the three places the pink is allowed on a page (trim, stamp ink, caption
 * rule), and never baked into the artwork.
 */
export function CaptionBox({ caption, page, shown }: { caption: Caption; page: MangaPage; shown: number }) {
  const font = Math.min(3.1, Math.max(2.2, 26 / caption.text.length + 1.5))
  const style: CSSProperties = {
    position: 'absolute',
    left: `${caption.at.x * 100}%`,
    top: `${caption.at.y * 100}%`,
    width: `${caption.width * 100}%`,
    boxSizing: 'border-box',
    background: PALETTE.sky,
    border: `0.32cqw solid ${PALETTE.ink}`,
    borderLeft: `1.1cqw solid ${PALETTE.blossomDeep}`,
    padding: '0.9cqw 1.1cqw',
    fontFamily: 'var(--sw-font-panel)',
    fontSize: `${font}cqw`,
    letterSpacing: '0.06em',
    lineHeight: 1.16,
    color: PALETTE.ink,
    pointerEvents: 'none',
  }
  return (
    <span style={style}>
      <Typed text={caption.text} shown={shown} />
    </span>
  )
}
