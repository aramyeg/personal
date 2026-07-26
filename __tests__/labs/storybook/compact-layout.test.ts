import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COMPACT_QUERY } from '@/components/labs/storybook/overlay/compact-layout'

const labFile = (name: string) => readFileSync(join(process.cwd(), 'components/labs/storybook', name), 'utf8')
const responsiveCss = labFile('storybook-responsive.css')
const overlayCss = labFile('storybook-overlay.css')
const quillCursor = labFile('overlay/quill-cursor.tsx')

const COMPACT_BLOCK_OPEN = `@media ${COMPACT_QUERY} {`

/**
 * The compact layout is half CSS (where the sheet, tab and scrim actually
 * live) and half JS (whether they are rendered, and how they dismiss). The
 * previous build let those two halves drift: the CSS media query styled a
 * `.sb-drawer-toggle` that nothing in JS knew about, and every reviewer read
 * it as a dead node. This suite pins the seam.
 */
describe('compact layout: CSS/JS breakpoint parity', () => {
  it('storybook-responsive.css opens its override block with the exact COMPACT_QUERY', () => {
    expect(responsiveCss).toContain(COMPACT_BLOCK_OPEN)
  })

  it('declares the breakpoint exactly once, and only there', () => {
    expect(responsiveCss.split(COMPACT_BLOCK_OPEN).length - 1).toBe(1)
    expect(overlayCss).not.toContain('max-width: 820px')
    // quill-cursor.tsx used to keep its own hand-typed copy of the query.
    expect(quillCursor).toContain("import { COMPACT_QUERY } from './compact-layout'")
    expect(quillCursor).not.toContain('max-width: 820px')
  })

  it('covers phones, portrait tablets AND landscape phones', () => {
    // Landscape phones are the clause the old two-clause query missed: an
    // 844×390 phone is neither portrait nor under 820px wide, so it fell
    // through to the desktop three-column grid on a 390px-tall viewport.
    expect(COMPACT_QUERY).toContain('(max-width: 820px)')
    expect(COMPACT_QUERY).toContain('(orientation: portrait)')
    expect(COMPACT_QUERY).toContain('(max-height: 540px) and (max-width: 1000px)')
  })
})

describe('compact layout: the book owns the viewport at rest', () => {
  const compactBlock = responsiveCss.split(COMPACT_BLOCK_OPEN)[1] ?? ''

  it('parks the whole sheet off-screen until it is opened', () => {
    // Percentage of the sheet's OWN height, so a short spread hides as
    // completely as a long one.
    expect(compactBlock).toMatch(/#sb-drawer-panel\s*\{[^}]*transform:\s*translateY\(100%\)/)
    expect(compactBlock).toMatch(
      /\[data-expanded='true'\]\s*#sb-drawer-panel\s*\{[^}]*transform:\s*none/
    )
  })

  it('leaves every canvas pixel swipeable while it is folded away', () => {
    // The regression this rework fixes: the old collapsed drawer set
    // `pointer-events: auto` on a full-width plate covering the bottom third
    // of the screen, so the book could not be swiped there at all.
    expect(compactBlock).toMatch(/\.sb-overlay\s*\{[^}]*pointer-events:\s*none/)
    expect(compactBlock).toMatch(/#sb-drawer-panel\s*\{[^}]*pointer-events:\s*none/)
    expect(compactBlock).toMatch(
      /\[data-expanded='true'\]\s*#sb-drawer-panel\s*\{[^}]*pointer-events:\s*auto/
    )
  })

  it('sizes the tab for touch and keeps it clear of the nav row', () => {
    // 2.75rem = 44px, the floor for a touch target.
    expect(compactBlock).toMatch(/\.sb-drawer-toggle\s*\{[^}]*min-height:\s*2\.75rem/)
    expect(compactBlock).toContain('--sb-nav-lift')
    // Both bottom-anchored surfaces respect an iOS home indicator.
    expect(compactBlock).toContain('env(safe-area-inset-bottom, 0px)')
  })
})

/**
 * R-2 (s6 blind re-review, finding 3): "the page has HIDDEN the cursor
 * (`cursor: none`), so on a grabbable you get the gold sparkle AND a system hand
 * fighting each other" — reported against the build that had just claimed this
 * fixed. The canvas cursor owner had hand-rolled its scope as
 *   `(pointer: fine) and not (max-width: 820px) and not (orientation: portrait)`
 * and `not` is legal only at the START of a media query, so Chrome parsed the
 * whole string as invalid and reported it back as `not all`. Measured on the
 * lane server: `matchMedia(QUILL_QUERY).media === 'not all'`, matches === false
 * forever, so the native cursor was written on every desktop, under the quill.
 *
 * A jsdom matchMedia does not parse media queries, so the gate is on the SOURCE:
 * the one place that decides where the quill is drawn must reuse COMPACT_QUERY
 * and negate it in JS, where negation cannot be mis-parsed.
 */
describe('one cursor: the canvas cursor owner shares the quill s own scope', () => {
  const bookScene = labFile('book/book-scene.tsx')

  it('reuses COMPACT_QUERY instead of hand-rolling a negation', () => {
    expect(bookScene).toContain("import { COMPACT_QUERY } from '../overlay/compact-layout'")
    expect(bookScene).toContain("window.matchMedia(COMPACT_QUERY)")
  })

  it('contains no `and not (...)` media query anywhere (the invalid form)', () => {
    // Comments are stripped first: the files are free to QUOTE the broken query
    // in their own postmortem, which is exactly where it belongs.
    const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const src of [bookScene, quillCursor, labFile('overlay/compact-layout.ts')]) {
      expect(code(src)).not.toMatch(/and\s+not\s+\(/)
    }
  })

  it('hides the native cursor exactly where the quill is drawn', () => {
    // Both halves of the condition, and the quill sprite is gated on the same
    // two queries (quill-cursor.tsx watches `(pointer: fine)` + COMPACT_QUERY).
    expect(bookScene).toContain("const FINE_POINTER_QUERY = '(pointer: fine)'")
    expect(bookScene).toContain('fine.matches && !compact.matches')
    expect(quillCursor).toContain("window.matchMedia('(pointer: fine)')")
  })
})
