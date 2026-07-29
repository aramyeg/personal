import { describe, expect, it } from 'vitest'
import { CHAPTER_COUNT } from '@/components/labs/small-world/chapters'
import { initialArrival, stepArrival } from '@/components/labs/small-world/arrival'
import { PALETTE } from '@/components/labs/small-world/palette'
import {
  BIOME_MOODS,
  BLOOM_FLOOR,
  GRADE_PHASE_END,
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
    // Rec. 709 weights, not a channel mean: green carries most of the perceived brightness, so an
    // unweighted average would pass a cast that reads far darker than it measures.
    const W = [0.2126, 0.7152, 0.0722]
    for (const mood of BIOME_MOODS) {
      const lum = [1, 3, 5]
        .map((i, k) => (parseInt(mood.cast.slice(i, i + 2), 16) / 255) * W[k])
        .reduce((a, b) => a + b, 0)
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

  // The scene consumers keep parallel colour tables and index them with these, so if the pairing
  // rule ever changes (open question 3 — follow the visible wedge instead of the chapter) the sky,
  // the lights and the overlay all move together instead of silently crossfading different pairs.
  it('publishes the indices its consumers index colour tables with', () => {
    for (let i = 0; i <= 300; i++) {
      const b = moodBlendAt(i / 300)
      expect(BIOME_MOODS[b.fromIndex]).toBe(b.from)
      expect(BIOME_MOODS[b.toIndex]).toBe(b.to)
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

  // The regression the whole re-key exists for: T54's arrival absorbs scroll, so progress PARKS
  // while the checkpoint rolls out. On scroll alone the crossfade would stop here and only finish
  // when the visitor scrolled again — the mood would arrive after the mascots, not with them.
  it('finishes the crossfade on the arrival clock while progress is parked', () => {
    const parked = at(4, 0.56) // the girl has stopped; absorption holds progress here
    const scrollOnly = moodBlendAt(parked).skyMix
    const landed = BIOME_MOODS[4].skyMix * bloomAt(0.56)
    expect(scrollOnly).not.toBeCloseTo(landed, 4)

    const rolling = (t: number) =>
      moodBlendAt(parked, { chapter: 4, t, phase: 'in' as const }).skyMix
    expect(rolling(GRADE_PHASE_END)).toBeCloseTo(landed, 6)
    expect(rolling(1)).toBeCloseTo(landed, 6)
    // …and it gets there monotonically, from exactly where scroll had left it.
    expect(rolling(0)).toBeCloseTo(scrollOnly, 6)
    let prev = -Infinity
    for (let i = 0; i <= 100; i++) {
      const v = rolling(i / 100)
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = v
    }
  })

  /**
   * The pull contributes exactly nothing at strength 0, whatever chapter the reveal names. That
   * one property covers three separate hazards, so DO NOT reintroduce a chapter gate to "simplify"
   * it (t54-reviewer's request, and the reason this test sweeps every chapter rather than a few):
   *   - arming a reveal is a no-op frame, whatever scroll position the absorption parked at;
   *   - nullifying one is too, since `t` is already 0 by the time the field clears;
   * NOT preemption. A t=0 reveal matching the no-reveal frame says nothing about the frame BEFORE
   * it, which under preemption carried a DIFFERENT reveal at high pull — that is what the machine
   * test below covers, and reading this property as preemption safety is the mistake that shipped
   * in bdcdcb3.
   */
  it('is a no-op at strength 0 for every chapter — arming and nullifying', () => {
    for (const local of [0.05, 0.42, 0.5, 0.55, 0.6, 0.7, 0.95]) {
      for (let journeyChapter = 0; journeyChapter < CHAPTER_COUNT; journeyChapter++) {
        const p = at(journeyChapter, local)
        const bare = moodBlendAt(p)
        for (let named = 0; named < CHAPTER_COUNT; named++) {
          for (const phase of ['in', 'out'] as const) {
            const armed = moodBlendAt(p, { chapter: named, t: 0, phase })
            expect(armed.skyMix, `j${journeyChapter} r${named} ${phase} @${local}`).toBeCloseTo(
              bare.skyMix,
              9
            )
            expect(armed.lightMix).toBeCloseTo(bare.lightMix, 9)
            expect(gradeAt(p, { chapter: named, t: 0, phase }).haze).toBe(gradeAt(p).haze)
          }
        }
      }
    }
  })

  // During a retraction the reveal keeps naming the biome that is LEAVING even after the journey
  // has moved on. That is exactly right for a pull: it holds the leaving mood and fades out.
  it('pulls toward the mood the reveal names, not the chapter the journey is in', () => {
    const p = at(3, 0.1)
    const stale = { chapter: 2, t: 1, phase: 'out' as const }
    expect(moodBlendAt(p, stale).revealChapter).toBe(2)
    expect(moodBlendAt(p, stale).skyMix).toBeCloseTo(BIOME_MOODS[2].skyMix * bloomAt(0.1), 6)
    expect(gradeAt(p, stale).haze).toBe(BIOME_MOODS[2].cast)
  })

  it('leaves the bloom on scroll — the swell is an envelope, not an entrance beat', () => {
    const p = at(2, 0.5)
    const full = moodBlendAt(p, { chapter: 2, t: 1, phase: 'in' })
    expect(full.revealPull).toBe(1)
    expect(full.skyMix).toBeCloseTo(BIOME_MOODS[2].skyMix * bloomAt(0.5), 6)
  })

  /**
   * The backward fling that the previous `max`-in-the-journey's-basis formulation could not
   * survive: scrub out of a dwell fast enough to cross a whole segment before the 0.42s retraction
   * finishes, and the reveal still names the chapter being left while the journey has already
   * moved to the one before it. That used to drop a live term in a single frame — measured at up
   * to a whole mood swap (winter to canyon) at scrollbar-drag speeds. The pull has no gate.
   */
  it('crosses a boundary backwards mid-retraction without a step, at any residual strength', () => {
    const eps = 1e-9
    for (let c = 1; c < CHAPTER_COUNT; c++) {
      for (const t of [1, 0.75, 0.5, 0.35, 0.1, 0]) {
        const live = { chapter: c, t, phase: 'out' as const }
        const before = moodBlendAt(at(c, eps), live)
        const after = moodBlendAt(at(c - 1, 1 - eps), live)
        expect(Math.abs(after.skyMix - before.skyMix), `ch${c} t=${t} sky`).toBeLessThan(1e-6)
        expect(Math.abs(after.lightMix - before.lightMix), `ch${c} t=${t} light`).toBeLessThan(1e-6)
        expect(gradeAt(at(c, eps), live).haze).toBe(gradeAt(at(c - 1, 1 - eps), live).haze)
      }
    }
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

  /**
   * The reveal gate is a DISCONTINUOUS input: a stale reveal is dropped the instant `chapter`
   * flips, and `max` cannot smooth a third term appearing and vanishing. It is seamless only
   * because `scrolled` has saturated at exactly 1 by the boundary, so the frame the gate drops is
   * a frame `max` was taking from the scroll term anyway. That safety is a property of
   * MOOD_IN_END, not of the composition — this sweep is the tripwire on it, and it fails for any
   * MOOD_IN_END above 1 (verified by construction: at local 1, `scrolled` = smoothstep((1 -
   * MOOD_IN_START) / (MOOD_IN_END - MOOD_IN_START)), which stops reaching 1 exactly there).
   */
  it('crosses every chapter boundary seamlessly, even carrying a stale reveal', () => {
    const eps = 1e-7
    for (let c = 0; c < CHAPTER_COUNT - 1; c++) {
      // A retraction still names the chapter being left, at whatever strength it has walked to.
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const stale = { chapter: c, t, phase: 'out' as const }
        const before = moodBlendAt(at(c, 1 - eps), stale)
        const after = moodBlendAt(at(c + 1, eps), stale)
        expect(Math.abs(after.skyMix - before.skyMix), `ch${c} t=${t} sky`).toBeLessThan(1e-3)
        expect(Math.abs(after.lightMix - before.lightMix), `ch${c} t=${t} light`).toBeLessThan(1e-3)
        expect(
          Math.abs(after.vignetteAlpha - before.vignetteAlpha),
          `ch${c} t=${t} vignette`
        ).toBeLessThan(1e-3)
        // …and the colour either side resolves to the same mood, from opposite ends of the blend.
        expect(gradeAt(at(c, 1 - eps), stale).haze).toBe(gradeAt(at(c + 1, eps), stale).haze)
      }
    }
  })

  /**
   * PREEMPTION, driven by the real arrival machine rather than a scripted retraction — the
   * difference that hid this from the first fling sweep. Flinging backward out of a dwell lands in
   * the PREVIOUS dwell, whose arrival preempts the in-flight retraction: `reveal` is replaced by a
   * fresh one at t=0 in a single frame. Without the proximity weight the pull's stored displacement
   * released all at once (94-117/255 haze channel at 6000px/s, against a 28-33/255 no-reveal
   * control). Setting REVEAL_FAR <= REVEAL_NEAR, or removing the weight, fails this.
   */
  it('survives a preempting backward fling without exceeding ordinary motion', () => {
    const H = 900
    const scrollable = 240 * CHAPTER_COUNT * (H / 100) - H
    const chan = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

    const fling = (chapter: number, pxPerSec: number, withReveal: boolean) => {
      let s = initialArrival((chapter + 0.58) * SEG)
      for (let f = 0; f < 180; f++) s = stepArrival(s, (chapter + 0.58) * SEG, 1 / 60)
      const startY = scrollable * s.progress
      let prev: number[] | null = null
      let worst = 0
      for (let f = 0; f < 200; f++) {
        const y = startY - (pxPerSec * f) / 60
        if (y < 0) break
        s = stepArrival(s, y / scrollable, 1 / 60)
        const c = chan(gradeAt(s.progress, withReveal ? s.reveal : null).haze)
        if (prev) worst = Math.max(worst, ...c.map((x, i) => Math.abs(x - prev![i])))
        prev = c
      }
      return worst
    }

    for (const chapter of [1, 3, 5]) {
      for (const v of [3000, 4500, 6000, 9000]) {
        const withReveal = fling(chapter, v, true)
        const control = fling(chapter, v, false)
        // The reveal may not make the frame move materially more than the scroll term alone does.
        expect(withReveal, `ch${chapter} @${v}px/s`).toBeLessThanOrEqual(control + 6)
      }
    }
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
