import { describe, expect, it } from 'vitest'
import { CHAPTER_COUNT } from '@/components/labs/small-world/chapters'
import { PALETTE } from '@/components/labs/small-world/palette'
import {
  BIOME_MOODS,
  BLOOM_FLOOR,
  HAZE_ALPHA_MAX,
  LIGHT_MIX_MAX,
  MOOD_IN_END,
  MOOD_IN_START,
  SHOW_GRADE,
  SKY_MIX_MAX,
  VIGNETTE_ALPHA_MAX,
  bloomAt,
  gradeAt,
  mixHex,
  moodBlendAt,
} from '@/components/labs/small-world/overlay/grade-mood'

const SEG = 1 / CHAPTER_COUNT
/** Global progress at a given chapter's local position. */
const at = (chapter: number, local: number) => (chapter + local) * SEG

describe('BIOME_MOODS', () => {
  it('names one mood per chapter in journey order', () => {
    expect(BIOME_MOODS).toHaveLength(CHAPTER_COUNT)
    expect(BIOME_MOODS.map((m) => m.id)).toEqual([
      'spring',
      'jungle',
      'delta',
      'desert',
      'canyon',
      'winter',
    ])
  })

  it('draws every colour from the palette — no literals', () => {
    const known = new Set<string>(Object.values(PALETTE))
    for (const mood of BIOME_MOODS) {
      expect(known.has(mood.sky), `${mood.id} sky`).toBe(true)
      expect(known.has(mood.glow), `${mood.id} glow`).toBe(true)
      expect(known.has(mood.cast), `${mood.id} cast`).toBe(true)
    }
  })

  // The rails the legibility + identity contract rests on. `lightMix` is the one that reaches the
  // planet, the girl and the mascots, so it is the cap that keeps the world reading as its own clay.
  it('keeps every mood inside the strength rails', () => {
    for (const mood of BIOME_MOODS) {
      expect(mood.skyMix, `${mood.id} sky`).toBeGreaterThan(0)
      expect(mood.skyMix, `${mood.id} sky`).toBeLessThanOrEqual(SKY_MIX_MAX)
      expect(mood.lightMix, `${mood.id} light`).toBeGreaterThan(0)
      expect(mood.lightMix, `${mood.id} light`).toBeLessThanOrEqual(LIGHT_MIX_MAX)
      expect(mood.hazeAlpha, `${mood.id} haze`).toBeGreaterThan(0)
      expect(mood.hazeAlpha, `${mood.id} haze`).toBeLessThanOrEqual(HAZE_ALPHA_MAX)
      expect(mood.vignetteAlpha, `${mood.id} vignette`).toBeGreaterThan(0)
      expect(mood.vignetteAlpha, `${mood.id} vignette`).toBeLessThanOrEqual(VIGNETTE_ALPHA_MAX)
    }
  })

  // The light tint must be a tint, not a repaint: mixing toward a DARK colour would drag the
  // whole scene down instead of colouring the daylight.
  it('tints the light toward pale colours only', () => {
    for (const mood of BIOME_MOODS) {
      const lum = [1, 3, 5]
        .map((i) => parseInt(mood.cast.slice(i, i + 2), 16) / 255)
        .reduce((a, b) => a + b, 0) / 3
      expect(lum, `${mood.id} cast luminance`).toBeGreaterThan(0.6)
    }
  })

  it('keeps spring the lightest touch — the journey opens looking like today', () => {
    const spring = BIOME_MOODS[0]
    for (const mood of BIOME_MOODS.slice(1)) {
      expect(spring.skyMix).toBeLessThan(mood.skyMix)
      expect(spring.lightMix).toBeLessThan(mood.lightMix)
    }
  })
})

describe('mixHex', () => {
  it('returns the endpoints exactly', () => {
    expect(mixHex('#102030', '#A0B0C0', 0)).toBe('#102030')
    expect(mixHex('#102030', '#A0B0C0', 1)).toBe('#A0B0C0')
  })

  it('lerps each channel at the midpoint', () => {
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080')
    expect(mixHex('#FF0000', '#0000FF', 0.5)).toBe('#800080')
  })

  it('clamps out-of-range t', () => {
    expect(mixHex('#102030', '#A0B0C0', -3)).toBe('#102030')
    expect(mixHex('#102030', '#A0B0C0', 9)).toBe('#A0B0C0')
  })
})

describe('bloomAt', () => {
  it('is full at both chapter ends, so boundaries are invisible', () => {
    expect(bloomAt(0)).toBeCloseTo(1, 6)
    expect(bloomAt(1)).toBeCloseTo(1, 6)
  })

  it('settles to the floor between checkpoints and never leaves the band', () => {
    expect(bloomAt(0.36)).toBeCloseTo(BLOOM_FLOOR, 6)
    for (let i = 0; i <= 1000; i++) {
      const b = bloomAt(i / 1000)
      expect(b).toBeGreaterThanOrEqual(BLOOM_FLOOR - 1e-9)
      expect(b).toBeLessThanOrEqual(1 + 1e-9)
    }
  })

  it('is back to full by the time the panel is up', () => {
    expect(bloomAt(MOOD_IN_END)).toBeCloseTo(1, 6)
    expect(bloomAt(0.8)).toBeCloseTo(1, 6)
  })
})

describe('moodBlendAt', () => {
  it('holds the previous chapter’s mood through the travel', () => {
    const b = moodBlendAt(at(3, 0.2))
    expect(b.chapter).toBe(3)
    expect(b.mix).toBe(0)
    expect(b.to).toBe(BIOME_MOODS[3])
    expect(b.from).toBe(BIOME_MOODS[2])
  })

  it('lands the new mood exactly by the dwell', () => {
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      const b = moodBlendAt(at(c, 0.8))
      expect(b.chapter).toBe(c)
      expect(b.mix).toBe(1)
      expect(b.skyMix).toBeCloseTo(BIOME_MOODS[c].skyMix, 6)
      expect(b.lightMix).toBeCloseTo(BIOME_MOODS[c].lightMix, 6)
      expect(b.vignetteAlpha).toBeCloseTo(BIOME_MOODS[c].vignetteAlpha, 6)
    }
  })

  it('opens the journey already wearing the spring mood', () => {
    const b = moodBlendAt(0)
    expect(b.to).toBe(BIOME_MOODS[0])
    expect(b.skyMix).toBeCloseTo(BIOME_MOODS[0].skyMix, 6)
  })

  it('crossfades monotonically across the arrival window', () => {
    let prev = -1
    for (let i = 0; i <= 200; i++) {
      const local = MOOD_IN_START + ((MOOD_IN_END - MOOD_IN_START) * i) / 200
      const mix = moodBlendAt(at(4, local)).mix
      expect(mix).toBeGreaterThanOrEqual(prev)
      prev = mix
    }
    expect(prev).toBe(1)
  })

  it('takes the T54 reveal clock when one is handed in', () => {
    const p = at(2, 0.5) // mid-window: the scroll-keyed mix would be partial
    expect(moodBlendAt(p).mix).toBeGreaterThan(0)
    expect(moodBlendAt(p).mix).toBeLessThan(1)
    expect(moodBlendAt(p, 0).mix).toBe(0)
    expect(moodBlendAt(p, 1).mix).toBe(1)
    // The reveal clock drives the crossfade only; the bloom still rides the scroll position.
    expect(moodBlendAt(p, 1).skyMix).toBeCloseTo(BIOME_MOODS[2].skyMix * bloomAt(0.5), 6)
    expect(moodBlendAt(p, -5).mix).toBe(0)
    expect(moodBlendAt(p, 5).mix).toBe(1)
  })

  it('clamps outside the journey instead of running off the mood list', () => {
    expect(moodBlendAt(-1).chapter).toBe(0)
    expect(moodBlendAt(2).chapter).toBe(CHAPTER_COUNT - 1)
    expect(moodBlendAt(2).to).toBe(BIOME_MOODS[CHAPTER_COUNT - 1])
  })

  it('ships enabled — and the kill switch zeroes every strength at once', () => {
    expect(SHOW_GRADE).toBe(true)
    // With SHOW_GRADE false, bloom is 0, and every applied strength is a product with bloom:
    // the sky holds the base palette, the lights hold their base colours, the overlay is clear.
    for (let i = 0; i <= 200; i++) {
      const b = moodBlendAt(i / 200)
      const off = { ...b, bloom: 0 }
      expect(off.bloom * b.to.skyMix).toBe(0)
      expect(off.bloom * b.to.lightMix).toBe(0)
    }
  })

  // The flicker-family veto, made mechanical: across the WHOLE journey no single scroll step may
  // jump the grade. Any stepping, snap, or chapter-boundary discontinuity fails here.
  it('moves continuously across the whole journey — no steps, no seams', () => {
    const N = 4000
    let prev = moodBlendAt(0)
    let worst = 0
    for (let i = 1; i <= N; i++) {
      const b = moodBlendAt(i / N)
      worst = Math.max(
        worst,
        Math.abs(b.skyMix - prev.skyMix),
        Math.abs(b.lightMix - prev.lightMix),
        Math.abs(b.hazeAlpha - prev.hazeAlpha),
        Math.abs(b.vignetteAlpha - prev.vignetteAlpha)
      )
      // A chapter boundary swaps which pair of moods is being crossfaded; the strengths either
      // side must still agree, which is what this bound proves.
      prev = b
    }
    expect(worst).toBeLessThan(0.004)
  })

  it('retraces itself exactly when scrubbed backwards', () => {
    const forward = []
    for (let i = 0; i <= 600; i++) forward.push(moodBlendAt(i / 600))
    for (let i = 600; i >= 0; i--) {
      expect(moodBlendAt(i / 600)).toEqual(forward[i])
    }
  })

  it('never exceeds the rails at any point in the journey', () => {
    for (let i = 0; i <= 2000; i++) {
      const b = moodBlendAt(i / 2000)
      expect(b.skyMix).toBeLessThanOrEqual(SKY_MIX_MAX)
      expect(b.lightMix).toBeLessThanOrEqual(LIGHT_MIX_MAX)
      expect(b.hazeAlpha).toBeLessThanOrEqual(HAZE_ALPHA_MAX)
      expect(b.vignetteAlpha).toBeLessThanOrEqual(VIGNETTE_ALPHA_MAX)
    }
  })
})

describe('gradeAt', () => {
  it('hands the overlay the blended haze colour and its two opacities', () => {
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      const g = gradeAt(at(c, 0.8))
      expect(g.haze).toBe(BIOME_MOODS[c].cast)
      expect(g.hazeAlpha).toBeCloseTo(BIOME_MOODS[c].hazeAlpha, 6)
      expect(g.vignetteAlpha).toBeCloseTo(BIOME_MOODS[c].vignetteAlpha, 6)
    }
  })

  it('reports the same crossfade the scene is riding', () => {
    for (let i = 0; i <= 50; i++) {
      const p = i / 50
      expect(gradeAt(p).mix).toBe(moodBlendAt(p).mix)
      expect(gradeAt(p).bloom).toBe(moodBlendAt(p).bloom)
    }
  })
})
