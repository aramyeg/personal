'use client'

/**
 * Illuminated-manuscript ornaments for the spread overlay's side columns:
 * a gold flourish divider (kicker → title), a closing fleuron (❦-style),
 * and a helper that gold-tints em-dashes/quotation marks inline within
 * narration text. All colors come from the `--sb-gold*` tokens (storybook.css)
 * so they track the lab's palette instead of hardcoding hex here. Pure
 * presentation — no store/content coupling, so both the desktop columns and
 * the portrait drawer (spread-overlay.tsx) reuse the same pieces.
 */

import type { ReactNode } from 'react'
import { Fragment } from 'react'

/** Curved gold line with a small diamond at its midpoint — reuses the thin,
 *  tapered-stroke language of the quill cursor / sound-toggle glyphs. Sits
 *  between a chapter's kicker and its title. */
export function FlourishDivider() {
  return (
    <svg
      width="76"
      height="14"
      viewBox="0 0 76 14"
      fill="none"
      aria-hidden="true"
      className="sb-flourish"
    >
      <path
        d="M2 7c11-6.5 21 6.5 32 0s21-6.5 32-0"
        stroke="var(--sb-gold)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M38 3.2l3 3.8-3 3.8-3-3.8z"
        fill="var(--sb-gold-bright)"
        stroke="var(--sb-gold-deep)"
        strokeWidth="0.5"
      />
    </svg>
  )
}

/** Small gold fleuron (❦-style ornament) closing a block of narration. */
export function Fleuron() {
  return (
    <span className="sb-fleuron" aria-hidden="true">
      ❦
    </span>
  )
}

/** Thin double gold hairline with a single diamond finial at its center —
 *  frames the top or bottom edge of a side column. */
export function Hairline() {
  return (
    <div className="sb-hairline" aria-hidden="true">
      <span className="sb-hairline-finial" />
    </div>
  )
}

const GLYPH_SPLIT = /([—‘’“”])/g
const GLYPH_CHARS = new Set(['—', '‘', '’', '“', '”'])

/** Wraps em-dashes and curly quotation marks in a gold-tinted span so the
 *  whole passage reads as decorated, not just its heading — purely a
 *  render-time transform, the underlying narration string (from content.ts)
 *  is never altered. (Checks membership in `GLYPH_CHARS` rather than
 *  re-testing the global `GLYPH_SPLIT` regex, whose `lastIndex` would
 *  otherwise desync across the array of split fragments.) */
export function decorateText(text: string): ReactNode {
  const parts = text.split(GLYPH_SPLIT)
  return (
    <Fragment>
      {parts.map((part, i) =>
        GLYPH_CHARS.has(part) ? (
          <span key={i} className="sb-ornament-glyph">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </Fragment>
  )
}
