import '../../helpers/canvas-2d'
import { describe, expect, it } from 'vitest'
import {
  mulberry32,
  quantize15,
  ditherQuantizeCanvas,
  makePosterTexture,
  makeStickerSheetTexture,
  makeDeckTexture,
} from '@/components/labs/ps1/scene/textures'
import type { SkillCategory } from '@/types'

/** The dithered canvas a generator baked into its returned CanvasTexture. */
function texCanvas(tex: { image: unknown }): HTMLCanvasElement {
  return tex.image as HTMLCanvasElement
}

function pixelsOf(canvas: HTMLCanvasElement): Uint8ClampedArray {
  return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
}

/** Count of distinct RGBA colors — proves a generator drew more than a flat fill. */
function distinctColors(data: Uint8ClampedArray): number {
  const seen = new Set<number>()
  for (let i = 0; i < data.length; i += 4) {
    seen.add(((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]) >>> 0)
  }
  return seen.size
}

/** Every real skill category plus `fun` — each must yield a valid poster. */
const ALL_CATEGORIES: SkillCategory[] = [
  'frontend',
  'mobile',
  'state',
  'styling',
  'backend',
  'tools',
  'fun',
]

describe('quantize15', () => {
  it('maps 0..255 onto exactly 32 levels', () => {
    const levels = new Set<number>()
    for (let v = 0; v <= 255; v++) levels.add(quantize15(v))
    expect(levels.size).toBe(32)
    expect(quantize15(0)).toBe(0)
    expect(quantize15(255)).toBe(255)
  })
  it('is idempotent', () => {
    for (const v of [0, 37, 128, 200, 255]) expect(quantize15(quantize15(v))).toBe(quantize15(v))
  })
})

describe('mulberry32', () => {
  it('is deterministic per seed and uniform-ish in [0,1)', () => {
    const a = mulberry32(7)
    const b = mulberry32(7)
    const seq = Array.from({ length: 8 }, () => a())
    expect(Array.from({ length: 8 }, () => b())).toEqual(seq)
    expect(seq.every((x) => x >= 0 && x < 1)).toBe(true)
  })
})

describe('ditherQuantizeCanvas', () => {
  it('leaves every channel on a 5-bit level', () => {
    const c = document.createElement('canvas')
    c.width = c.height = 8
    const g = c.getContext('2d')!
    g.fillStyle = '#8a8578'
    g.fillRect(0, 0, 8, 8)
    const data = ditherQuantizeCanvas(c).getContext('2d')!.getImageData(0, 0, 8, 8).data
    for (let i = 0; i < data.length; i += 4) {
      expect(quantize15(data[i])).toBe(data[i])
      expect(quantize15(data[i + 1])).toBe(data[i + 1])
      expect(quantize15(data[i + 2])).toBe(data[i + 2])
    }
  })
  it('dithers a gradient into more than one level per row', () => {
    const c = document.createElement('canvas')
    c.width = 32; c.height = 4
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, 32, 0)
    grad.addColorStop(0, '#404040'); grad.addColorStop(1, '#484848')
    g.fillStyle = grad
    g.fillRect(0, 0, 32, 4)
    const data = ditherQuantizeCanvas(c).getContext('2d')!.getImageData(0, 0, 32, 1).data
    const reds = new Set<number>()
    for (let i = 0; i < data.length; i += 4) reds.add(data[i])
    expect(reds.size).toBeGreaterThan(1)
  })
})

describe('makePosterTexture', () => {
  it('is a 128x192 portrait canvas for every category', () => {
    for (const category of ALL_CATEGORIES) {
      const canvas = texCanvas(makePosterTexture(category))
      expect(canvas.width).toBe(128)
      expect(canvas.height).toBe(192)
    }
  })

  it('draws more than a flat fill (accent, ink, tape, footer)', () => {
    for (const category of ALL_CATEGORIES) {
      const data = pixelsOf(texCanvas(makePosterTexture(category)))
      expect(distinctColors(data)).toBeGreaterThan(1)
    }
  })

  it('renders skill-name ink in the footer band (near-white over the dark strip)', () => {
    // The footer is the only near-white content on the poster (accent fields
    // and stencil ink are not near-white), so bright pixels there prove the
    // top-3 skill names were actually rendered — not just a background fill.
    const FOOTER_TOP = 156
    const FOOTER_BOTTOM = 184
    for (const category of ALL_CATEGORIES) {
      const canvas = texCanvas(makePosterTexture(category))
      const band = canvas
        .getContext('2d')!
        .getImageData(0, FOOTER_TOP, 128, FOOTER_BOTTOM - FOOTER_TOP).data
      let brightInk = 0
      for (let i = 0; i < band.length; i += 4) {
        if (band[i] > 170 && band[i + 1] > 170 && band[i + 2] > 170) brightInk++
      }
      expect(brightInk, `footer ink for "${category}"`).toBeGreaterThan(0)
    }
  })

  it('is deterministic — two calls produce byte-identical pixels', () => {
    for (const category of ALL_CATEGORIES) {
      const a = pixelsOf(texCanvas(makePosterTexture(category)))
      const b = pixelsOf(texCanvas(makePosterTexture(category)))
      expect(Array.from(a)).toEqual(Array.from(b))
    }
  })

  it('gives adjacent categories different accent-driven pixels', () => {
    // Category index selects the accent, so two different categories must not
    // produce identical posters.
    const frontend = Array.from(pixelsOf(texCanvas(makePosterTexture('frontend'))))
    const mobile = Array.from(pixelsOf(texCanvas(makePosterTexture('mobile'))))
    expect(frontend).not.toEqual(mobile)
  })
})

describe('makeStickerSheetTexture', () => {
  it('is a 128x128 canvas', () => {
    const canvas = texCanvas(makeStickerSheetTexture())
    expect(canvas.width).toBe(128)
    expect(canvas.height).toBe(128)
  })

  it('draws stickers over a transparent background', () => {
    const data = pixelsOf(texCanvas(makeStickerSheetTexture()))
    let transparent = 0
    let opaque = 0
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 0) transparent++
      else if (data[i] === 255) opaque++
    }
    expect(transparent, 'transparent background pixels').toBeGreaterThan(0)
    expect(opaque, 'opaque sticker pixels').toBeGreaterThan(0)
    expect(distinctColors(data)).toBeGreaterThan(1)
  })

  it('is deterministic — two calls produce byte-identical pixels', () => {
    const a = pixelsOf(texCanvas(makeStickerSheetTexture()))
    const b = pixelsOf(texCanvas(makeStickerSheetTexture()))
    expect(Array.from(a)).toEqual(Array.from(b))
  })
})

describe('makeDeckTexture', () => {
  it('is a 64x256 skate-deck canvas', () => {
    const canvas = texCanvas(makeDeckTexture())
    expect(canvas.width).toBe(64)
    expect(canvas.height).toBe(256)
  })

  it('draws more than a flat fill', () => {
    const data = pixelsOf(texCanvas(makeDeckTexture()))
    expect(distinctColors(data)).toBeGreaterThan(1)
  })

  it('has a top-to-bottom accent gradient (top band differs from bottom band)', () => {
    const canvas = texCanvas(makeDeckTexture())
    const g = canvas.getContext('2d')!
    const top = g.getImageData(0, 8, 64, 8).data
    const bottom = g.getImageData(0, 240, 64, 8).data
    const avg = (d: Uint8ClampedArray, ch: number) => {
      let sum = 0
      for (let i = ch; i < d.length; i += 4) sum += d[i]
      return sum / (d.length / 4)
    }
    const delta =
      Math.abs(avg(top, 0) - avg(bottom, 0)) +
      Math.abs(avg(top, 1) - avg(bottom, 1)) +
      Math.abs(avg(top, 2) - avg(bottom, 2))
    expect(delta).toBeGreaterThan(20)
  })

  it('is deterministic — two calls produce byte-identical pixels', () => {
    const a = pixelsOf(texCanvas(makeDeckTexture()))
    const b = pixelsOf(texCanvas(makeDeckTexture()))
    expect(Array.from(a)).toEqual(Array.from(b))
  })
})
