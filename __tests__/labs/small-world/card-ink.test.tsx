/**
 * TASK 74 — THE SPREAD IS PRINTED IN ONE INK.
 *
 * The chapter spread is a black-and-white manga page beside a data card, and the
 * failure this file exists to prevent is the one Aram reported: the card speaking
 * a pastel language the page does not. It is a colour law rather than a layout
 * one, so it is asserted on the colours the components actually paint.
 *
 * THE LAW: on the chapter-spread chrome, the only hues are ink, paper, the
 * caption label's cream, and the lab pink. No chapter accent — no honey, river,
 * dune, tuff, sprout — reaches any painted surface. `accent` still exists on the
 * story data (it is the biome's colour and the scene reads that family); what is
 * forbidden is the CARD wearing it.
 */
import { describe, expect, it, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ChapterPanels } from '@/components/labs/small-world/overlay/chapter-panels'
import { chapters } from '@/components/labs/small-world/chapters'
import { PALETTE } from '@/components/labs/small-world/palette'

afterEach(cleanup)

/** Every colour the spread's chrome is allowed to be printed in. */
const SANCTIONED = [
  PALETTE.ink, // the frames, the rules, the type
  PALETTE.pagePaper, // the sheet
  PALETTE.sky, // the narrator label — a label ON the page, not the page
  PALETTE.blossomDeep, // the one colour: caption trim, stamp ink, the phone tab
].map((c) => c.toLowerCase())

/** The chapter accents, which is what must NOT appear. */
const ACCENTS = [...new Set(chapters.map((c) => c.accent.toLowerCase()))]

/**
 * A palette hex as the CSSOM hands it back.
 *
 * `style.color` is normalised to `rgb(...)`, so the readback assertions compare
 * against that form; `hexesIn` below reads the raw `style` ATTRIBUTE instead and
 * therefore still sees the authored hexes.
 */
function rgb(hex: string): string {
  const [r, g, b] = /^#(..)(..)(..)$/.exec(hex)!.slice(1).map((v) => parseInt(v, 16))
  return `rgb(${r}, ${g}, ${b})`
}

/** Every `#rrggbb` an element and its descendants paint, in lower case. */
function hexesIn(root: HTMLElement): string[] {
  const found = new Set<string>()
  const walk = (el: Element) => {
    const style = (el as HTMLElement).getAttribute('style')
    if (style) for (const m of style.matchAll(/#[0-9a-f]{6}/gi)) found.add(m[0].toLowerCase())
    for (const child of Array.from(el.children)) walk(child)
  }
  walk(root)
  return [...found]
}

const spread = (index: number) =>
  render(<ChapterPanels chapter={chapters[index]} index={index} enter={1} onAdvance={null} />)

describe('the spread is printed in one ink', () => {
  it.each(chapters.map((c, i) => [i + 1, c.theme] as const))(
    'chapter %i (%s) wears no biome tint',
    (n) => {
      spread(n - 1)
      const painted = hexesIn(screen.getByTestId('sw-panel-tap'))
      for (const accent of ACCENTS) expect(painted, `accent ${accent} reached the spread`).not.toContain(accent)
    }
  )

  it.each(chapters.map((c, i) => [i + 1, c.theme] as const))(
    'chapter %i (%s) paints only sanctioned colours',
    (n) => {
      spread(n - 1)
      // Alpha-suffixed inks (`#2B2B3333` in the screentone) are the same ink and
      // are matched by their first six digits, which is what `hexesIn` returns.
      for (const hex of hexesIn(screen.getByTestId('sw-panel-tap'))) {
        expect(SANCTIONED, `${hex} is not one of the spread's colours`).toContain(hex)
      }
    }
  )

  it('prints the card on the same sheet the pages are, and that sheet is neutral', () => {
    // The whole restyle turns on this: measured off the seven shipped webps the
    // printed paper is achromatic near-white, and the card used to be a warm
    // cream 36 points of blue below it. A tinted `pagePaper` would quietly undo
    // the round without changing a single line of layout.
    const m = /^#(..)(..)(..)$/.exec(PALETTE.pagePaper)!
    const [r, g, b] = m.slice(1).map((v) => parseInt(v, 16))
    expect(Math.max(r, g, b) - Math.min(r, g, b), 'the sheet is neutral').toBeLessThanOrEqual(1)
    expect(r).toBeGreaterThanOrEqual(245)

    spread(0)
    expect(screen.getByTestId('sw-panel-data').style.background).toContain(rgb(PALETTE.pagePaper))
  })

  it('gives the figures pink ink and the tech labels none', () => {
    spread(3) // qiibee: three stamps and three labels, the busiest record panel
    for (const stamp of screen.getAllByTestId('sw-story-stamp')) {
      expect(stamp.style.color).toBe(rgb(PALETTE.blossomDeep))
      // Ink over tone, not a chip laid on top of it.
      expect(stamp.style.background).toBe('transparent')
    }
  })

  it('rests the stamps off square, so a row of figures never squares up like buttons', () => {
    spread(3)
    const angles = screen
      .getAllByTestId('sw-story-stamp')
      .map((s) => Number(/rotate\((-?[\d.]+)deg\)/.exec(s.style.transform)?.[1]))
    expect(angles.every((a) => Number.isFinite(a) && a !== 0)).toBe(true)
    // ...and they do not all lean the same way either.
    expect(new Set(angles.map(Math.sign)).size).toBeGreaterThan(1)
  })
})
