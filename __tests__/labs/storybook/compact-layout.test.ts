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
