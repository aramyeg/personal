import { describe, expect, it } from 'vitest'
import {
  MC,
  GLYPH_ORDER,
  GLYPH_PATHS,
  SECTION_ACCENT,
  accentFor,
} from '@/components/labs/memory-card/tokens'

const HEX = /^#[0-9a-f]{6}$/

describe('memory-card design tokens', () => {
  it('every MC hex is a lowercase 6-digit hex color', () => {
    const hexValues = [MC.ink, MC.paper, MC.shell, MC.warmGrey, ...Object.values(MC.glyphs)]
    for (const hex of hexValues) {
      expect(hex).toMatch(HEX)
    }
  })

  it('accentFor cycles GLYPH_ORDER twice across indices 0-7', () => {
    for (let i = 0; i < 8; i++) {
      const expected = MC.glyphs[GLYPH_ORDER[i % GLYPH_ORDER.length]]
      expect(accentFor(i)).toBe(expected)
    }
  })

  it('SECTION_ACCENT covers exactly the five sections', () => {
    expect(Object.keys(SECTION_ACCENT).sort()).toEqual(
      ['about', 'contact', 'hero', 'skills', 'work'].sort()
    )
    expect(SECTION_ACCENT.hero).toBe('triangle')
    expect(SECTION_ACCENT.work).toBe('circle')
    expect(SECTION_ACCENT.skills).toBe('cross')
    expect(SECTION_ACCENT.about).toBe('square')
    expect(SECTION_ACCENT.contact).toBe('triangle')
  })

  it('every GLYPH_PATHS entry is a non-empty stroke path starting with M', () => {
    for (const name of GLYPH_ORDER) {
      const path = GLYPH_PATHS[name]
      expect(path.length).toBeGreaterThan(0)
      expect(path.startsWith('M')).toBe(true)
    }
  })
})
