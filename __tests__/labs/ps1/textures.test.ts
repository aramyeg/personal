import '../../helpers/canvas-2d'
import { describe, expect, it } from 'vitest'
import {
  mulberry32,
  quantize15,
  ditherQuantizeCanvas,
  makePosterTexture,
  makeStickerSheetTexture,
  makeDeckTexture,
  makeCRTScreenTexture,
  makeTVScreenTexture,
  makeBoxSpineTexture,
  makeWindowViewTexture,
  makeCorkboardTexture,
  makeMemcardTexture,
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

/** True if any pixel is unmistakably teal — both g and b clear r by >40. */
function hasTealPixel(data: Uint8ClampedArray): boolean {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 1] - data[i] > 40 && data[i + 2] - data[i] > 40) return true
  }
  return false
}

/** True if any pixel is near-white in all three channels (paper / bright UI). */
function hasNearWhitePixel(data: Uint8ClampedArray, threshold = 200): boolean {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > threshold && data[i + 1] > threshold && data[i + 2] > threshold) return true
  }
  return false
}

describe('makeCRTScreenTexture', () => {
  it('is a 128x96 menu canvas', () => {
    const canvas = texCanvas(makeCRTScreenTexture())
    expect(canvas.width).toBe(128)
    expect(canvas.height).toBe(96)
  })

  it('draws more than a flat fill (bar, rows, highlight, scanlines)', () => {
    const data = pixelsOf(texCanvas(makeCRTScreenTexture()))
    expect(distinctColors(data)).toBeGreaterThan(1)
  })

  it('carries the teal accent — some pixel has g and b each exceeding r by >40', () => {
    // This is THE teal moment of the lab; crtTeal (#7de8e0) menu text must survive
    // the dither+quantize and read as unmistakably teal.
    const data = pixelsOf(texCanvas(makeCRTScreenTexture()))
    expect(hasTealPixel(data)).toBe(true)
  })

  it('is deterministic — two calls produce byte-identical pixels', () => {
    const a = pixelsOf(texCanvas(makeCRTScreenTexture()))
    const b = pixelsOf(texCanvas(makeCRTScreenTexture()))
    expect(Array.from(a)).toEqual(Array.from(b))
  })
})

describe('makeTVScreenTexture', () => {
  it('is a 96x72 canvas', () => {
    const canvas = texCanvas(makeTVScreenTexture())
    expect(canvas.width).toBe(96)
    expect(canvas.height).toBe(72)
  })

  it('is a noise field — many distinct greys, not a flat fill', () => {
    const data = pixelsOf(texCanvas(makeTVScreenTexture()))
    expect(distinctColors(data)).toBeGreaterThan(8)
  })

  it('has a bright centered word over the static', () => {
    const data = pixelsOf(texCanvas(makeTVScreenTexture()))
    expect(hasNearWhitePixel(data)).toBe(true)
  })

  it('is deterministic — two calls produce byte-identical pixels', () => {
    const a = pixelsOf(texCanvas(makeTVScreenTexture()))
    const b = pixelsOf(texCanvas(makeTVScreenTexture()))
    expect(Array.from(a)).toEqual(Array.from(b))
  })
})

describe('makeBoxSpineTexture', () => {
  it('is a 24x96 spine canvas for each lab index', () => {
    for (const i of [0, 1, 2]) {
      const canvas = texCanvas(makeBoxSpineTexture(i))
      expect(canvas.width).toBe(24)
      expect(canvas.height).toBe(96)
    }
  })

  it('draws more than a flat fill (accent field, top band, vertical title)', () => {
    for (const i of [0, 1, 2]) {
      const data = pixelsOf(texCanvas(makeBoxSpineTexture(i)))
      expect(distinctColors(data)).toBeGreaterThan(1)
    }
  })

  it('has a near-white publisher band', () => {
    const data = pixelsOf(texCanvas(makeBoxSpineTexture(0)))
    expect(hasNearWhitePixel(data)).toBe(true)
  })

  it('gives different indices different accent-driven pixels', () => {
    const a = Array.from(pixelsOf(texCanvas(makeBoxSpineTexture(0))))
    const b = Array.from(pixelsOf(texCanvas(makeBoxSpineTexture(1))))
    expect(a).not.toEqual(b)
  })

  it('is deterministic per index — two calls produce byte-identical pixels', () => {
    for (const i of [0, 1, 2]) {
      const a = pixelsOf(texCanvas(makeBoxSpineTexture(i)))
      const b = pixelsOf(texCanvas(makeBoxSpineTexture(i)))
      expect(Array.from(a)).toEqual(Array.from(b))
    }
  })
})

describe('makeWindowViewTexture', () => {
  it('is a 192x144 canvas', () => {
    const canvas = texCanvas(makeWindowViewTexture())
    expect(canvas.width).toBe(192)
    expect(canvas.height).toBe(144)
  })

  it('draws more than a flat fill (sky, rooftops, props, street)', () => {
    const data = pixelsOf(texCanvas(makeWindowViewTexture()))
    expect(distinctColors(data)).toBeGreaterThan(1)
  })

  it('has a light overcast sky along its top row', () => {
    // Crude-tone law: the sky is flat grey-white, so the top row averages light
    // and roughly neutral — never a saturated sunset.
    const canvas = texCanvas(makeWindowViewTexture())
    const top = canvas.getContext('2d')!.getImageData(0, 0, 192, 1).data
    let r = 0, gg = 0, b = 0
    for (let i = 0; i < top.length; i += 4) { r += top[i]; gg += top[i + 1]; b += top[i + 2] }
    const n = top.length / 4
    r /= n; gg /= n; b /= n
    expect(r).toBeGreaterThan(150)
    expect(gg).toBeGreaterThan(150)
    expect(b).toBeGreaterThan(150)
    // Near-neutral: no channel dominates by more than a hair (no sunset warm cast).
    expect(Math.max(r, gg, b) - Math.min(r, gg, b)).toBeLessThan(30)
  })

  it('lights exactly a few warm windows — the only warm accent', () => {
    // Dull-yellow lit windows are the sole warm pixels; assert some exist so the
    // scene is not pure grey, but the palette stays crude.
    const data = pixelsOf(texCanvas(makeWindowViewTexture()))
    let warm = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > data[i + 1] && data[i + 1] > data[i + 2] && data[i] - data[i + 2] > 40) warm++
    }
    expect(warm).toBeGreaterThan(0)
  })

  it('is deterministic — two calls produce byte-identical pixels', () => {
    const a = pixelsOf(texCanvas(makeWindowViewTexture()))
    const b = pixelsOf(texCanvas(makeWindowViewTexture()))
    expect(Array.from(a)).toEqual(Array.from(b))
  })
})

describe('makeCorkboardTexture', () => {
  it('is a 128x96 canvas', () => {
    const canvas = texCanvas(makeCorkboardTexture())
    expect(canvas.width).toBe(128)
    expect(canvas.height).toBe(96)
  })

  it('draws more than a flat fill (cork speckle, polaroids, pins)', () => {
    const data = pixelsOf(texCanvas(makeCorkboardTexture()))
    expect(distinctColors(data)).toBeGreaterThan(1)
  })

  it('has near-white polaroid borders', () => {
    const data = pixelsOf(texCanvas(makeCorkboardTexture()))
    expect(hasNearWhitePixel(data)).toBe(true)
  })

  it('has red pin dots', () => {
    const data = pixelsOf(texCanvas(makeCorkboardTexture()))
    let red = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] - data[i + 1] > 40 && data[i] - data[i + 2] > 40) red++
    }
    expect(red).toBeGreaterThan(0)
  })

  it('is deterministic — two calls produce byte-identical pixels', () => {
    const a = pixelsOf(texCanvas(makeCorkboardTexture()))
    const b = pixelsOf(texCanvas(makeCorkboardTexture()))
    expect(Array.from(a)).toEqual(Array.from(b))
  })
})

describe('makeMemcardTexture', () => {
  it('is a 64x64 canvas', () => {
    const canvas = texCanvas(makeMemcardTexture())
    expect(canvas.width).toBe(64)
    expect(canvas.height).toBe(64)
  })

  it('draws more than a flat fill (shell, connector slots, label)', () => {
    const data = pixelsOf(texCanvas(makeMemcardTexture()))
    expect(distinctColors(data)).toBeGreaterThan(1)
  })

  it('is deterministic — two calls produce byte-identical pixels', () => {
    const a = pixelsOf(texCanvas(makeMemcardTexture()))
    const b = pixelsOf(texCanvas(makeMemcardTexture()))
    expect(Array.from(a)).toEqual(Array.from(b))
  })
})
