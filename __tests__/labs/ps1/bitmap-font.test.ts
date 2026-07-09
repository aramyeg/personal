import '../../helpers/canvas-2d'
import { describe, expect, it } from 'vitest'
import { drawBitmapText, measureBitmapText } from '@/components/labs/ps1/scene/bitmap-font'

describe('bitmap font', () => {
  it('draws every supported glyph with nonzero ink', () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:/-·%+()!?'
    for (const ch of chars) {
      const c = document.createElement('canvas')
      c.width = 8; c.height = 8
      const g = c.getContext('2d')!
      drawBitmapText(g, ch, 0, 0, { color: '#ffffff' })
      const d = g.getImageData(0, 0, 8, 8).data
      let ink = 0
      for (let i = 3; i < d.length; i += 4) ink += d[i]
      expect(ink, `glyph ${ch}`).toBeGreaterThan(0)
    }
  })
  it('measures width as glyphs*(5+1)*scale - kerning gap', () => {
    expect(measureBitmapText('AB', 2)).toBe((6 + 6 - 1) * 2)
  })
  it('advances the pen and returns drawn width', () => {
    const c = document.createElement('canvas')
    c.width = 64; c.height = 8
    const w = drawBitmapText(c.getContext('2d')!, 'HI', 0, 0)
    expect(w).toBe(measureBitmapText('HI'))
  })
})
