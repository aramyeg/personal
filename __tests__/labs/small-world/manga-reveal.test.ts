import { describe, expect, it } from 'vitest'
import {
  MIN_TYPE_MS,
  MS_PER_CHAR,
  PANEL_INK_MS,
  PANEL_STAGGER_MS,
  panelInk,
  pageRevealMs,
  textStartMs,
  typedLength,
} from '@/components/labs/small-world/manga/reveal'

describe('the page inks in reading order', () => {
  it('starts each panel a stagger after the one before it', () => {
    expect(panelInk(0, 0)).toBe(0)
    expect(panelInk(1, PANEL_STAGGER_MS - 1)).toBe(0)
    expect(panelInk(1, PANEL_STAGGER_MS + 1)).toBeGreaterThan(0)
    expect(panelInk(3, 3 * PANEL_STAGGER_MS + PANEL_INK_MS)).toBe(1)
  })

  it('never runs a later panel ahead of an earlier one', () => {
    // The whole illusion is a page being drawn; a panel that overtook its
    // predecessor would read as a shuffle.
    for (let t = 0; t <= 3000; t += 37) {
      for (let i = 1; i < 4; i++) {
        expect(panelInk(i, t)).toBeLessThanOrEqual(panelInk(i - 1, t))
      }
    }
  })

  it('clamps rather than overshooting, so a parked checkpoint is a constant', () => {
    expect(panelInk(0, 1e9)).toBe(1)
    expect(panelInk(0, -500)).toBe(0)
  })
})

describe('lettering types a beat after its panel lands', () => {
  it('waits for the panel to finish inking', () => {
    const text = 'You can now.'
    expect(typedLength(text, 1, textStartMs(1) - 1)).toBe(0)
    // ...and the beat is genuinely after the ink, not overlapping it.
    expect(textStartMs(1)).toBeGreaterThan(PANEL_STAGGER_MS + PANEL_INK_MS)
  })

  it('reveals whole characters only, and finishes on the last one', () => {
    const text = 'Build it once. Build it right.'
    const duration = Math.max(MIN_TYPE_MS, text.length * MS_PER_CHAR)
    const mid = typedLength(text, 0, textStartMs(0) + duration / 2)
    expect(Number.isInteger(mid)).toBe(true)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(text.length)
    expect(typedLength(text, 0, textStartMs(0) + duration)).toBe(text.length)
    expect(typedLength(text, 0, 1e9)).toBe(text.length)
  })

  it('gives a long line more time than a short one rather than sprinting it', () => {
    const short = '…wobbly.'
    const long = 'She studied how people choose — then taught herself to build.'
    const at = textStartMs(0) + 600
    expect(typedLength(short, 0, at) / short.length).toBeGreaterThan(
      typedLength(long, 0, at) / long.length
    )
  })

  it('fits inside the dwell it plays in', () => {
    // The longest page is four panels, and the longest line in the pack is ~40
    // characters. The whole reveal has to be well inside a checkpoint dwell or a
    // reader who does not linger never sees the last line arrive.
    expect(pageRevealMs(4, 40)).toBeLessThan(3000)
  })
})
