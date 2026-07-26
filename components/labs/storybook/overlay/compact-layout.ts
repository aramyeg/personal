'use client'

/**
 * The lab's ONE compact-layout breakpoint, shared by CSS and JS.
 *
 * `COMPACT_QUERY` is the single source of truth for "the book is the whole
 * view and the text lives in a drawer". storybook-responsive.css opens its
 * override block with the identical media query, and
 * `__tests__/labs/storybook/compact-layout.test.ts` reads that file and
 * asserts the two strings still match — so the JS-side behaviour (rendering
 * the drawer handle, the scrim, the dismiss gestures) can never drift out of
 * step with the CSS-side layout the way the old vestigial toggle did.
 *
 * Three clauses, and each earns its place:
 *   - `(max-width: 820px)`     — phones and narrow tablets in any orientation.
 *   - `(orientation: portrait)` — a portrait tablet is wide but the desktop's
 *     three-column grid (24rem | book | 20rem) still squeezes the book.
 *   - `(max-height: 540px) and (max-width: 1000px)` — LANDSCAPE PHONES, which
 *     the first two clauses both miss (a 844×390 phone is landscape and wider
 *     than 820px, yet has less vertical room than any of the side columns
 *     need). The width half keeps a short-but-wide desktop window on the
 *     desktop layout.
 */

import { useEffect, useState } from 'react'

export const COMPACT_QUERY =
  '(max-width: 820px), (orientation: portrait), (max-height: 540px) and (max-width: 1000px)'

const matchesCompact = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(COMPACT_QUERY).matches
}

/**
 * `true` when the viewport is on the drawer layout. Read eagerly on first
 * render (not in an effect) so the drawer handle is painted correctly on the
 * very first frame — safe here because the whole WebGL book tree is
 * client-only: storybook-loader.tsx renders `<VellumLoading/>` on the server
 * and only mounts `<BookTale/>` after its own capability effect resolves, so
 * there is no server HTML for this to disagree with. Re-syncs on `change`,
 * so rotating the device or resizing across the breakpoint swaps layouts live.
 */
export function useCompactLayout(): boolean {
  const [compact, setCompact] = useState(matchesCompact)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(COMPACT_QUERY)
    const sync = () => setCompact(mql.matches)
    sync()
    mql.addEventListener('change', sync)
    return () => mql.removeEventListener('change', sync)
  }, [])

  return compact
}
