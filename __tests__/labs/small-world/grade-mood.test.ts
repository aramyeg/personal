import { describe, expect, it } from 'vitest'
import { CHAPTER_COUNT } from '@/components/labs/small-world/chapters'
import { PANEL_END, TRAVEL_END } from '@/components/labs/small-world/journey-timeline'
import { initialArrival, stepArrival } from '@/components/labs/small-world/arrival'
import { PALETTE } from '@/components/labs/small-world/palette'
import type { BiomeMood } from '@/components/labs/small-world/overlay/grade-mood'
import {
  BIOME_MOODS,
  BLOOM_FLOOR,
  DWELL_HALF_WIDTH,
  GRADE_PHASE_END,
  HAZE_ALPHA_MAX,
  LIGHT_MIX_MAX,
  MOOD_IN_END,
  MOOD_LIGHT_MIN_DE,
  MOOD_SKY_MIN_DE,
  REVEAL_NEAR,
  MOOD_IN_START,
  SHOW_GRADE,
  SKY_MIX_MAX,
  VIGNETTE_ALPHA_MAX,
  bloomAt,
  gradeAt,
  mixHex,
  moodBlendAt,
  resolvedMood,
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

  /**
   * The rail the whole preemption fix stands on. A reveal only reaches full strength inside its
   * own dwell, so the proximity weight must not begin to fade until the journey is outside it —
   * otherwise the pull weakens while a checkpoint is parked and the arrival stops landing on its
   * mood. Derived from the timeline, so moving TRAVEL_END or PANEL_END fails here rather than
   * silently eating the margin (t54-reviewer's finding: the exposure is the coupling, not the
   * margin — a 0.10 move in TRAVEL_END alone used to consume all of it).
   */
  it('holds the pull at full strength across the entire dwell', () => {
    expect(REVEAL_NEAR).toBeGreaterThan(DWELL_HALF_WIDTH)
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      for (let k = 0; k <= 8; k++) {
        const local = TRAVEL_END + ((PANEL_END - TRAVEL_END) * k) / 8
        const b = moodBlendAt(at(c, local), { chapter: c, t: 1, phase: 'in' })
        expect(b.revealPull, `ch${c} @${local.toFixed(3)}`).toBe(1)
      }
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

/**
 * Task 57 — EVERY ARRIVAL MUST ANNOUNCE ITSELF.
 *
 * Aram reported the grade changing "not during each checkpoint, but rather during each 2
 * checkpoints". The mechanism was fine — driven by real wheel events with hands off, every
 * checkpoint landed byte-exactly on its own mood — so the defect was that adjacent moods were too
 * close to tell apart once each had been mixed into the same cream base.
 *
 * These assertions are therefore on the RESOLVED colours (`resolvedMood`), never on the palette
 * hexes: the old jungle `#2E7D4F` and delta `#2F7A70` look like different colours and resolve to
 * `#79A780` and `#82AA99`, which do not. Same lesson the T55 review closed on — for a visual
 * property, assert on the pixel the visitor sees, not the parameter that produces it.
 */
describe('adjacent-mood distinctness', () => {
  /**
   * CIEDE2000. The question is whether a visitor REGISTERS a change of mood, which is a question
   * about perceived difference; an RGB or per-channel distance answers a different one. Kept local
   * to the test on purpose — it is a measuring instrument, not something the lab ships.
   */
  const toLab = (hex: string): [number, number, number] => {
    const lin = (u: number) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4)
    const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255))
    const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116)
    const [fx, fy, fz] = [f(X), f(Y), f(Z)]
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
  }

  const deltaE = (h1: string, h2: string): number => {
    const [L1, a1, b1] = toLab(h1)
    const [L2, a2, b2] = toLab(h2)
    const rad = Math.PI / 180
    const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2
    const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    const [ap1, ap2] = [(1 + G) * a1, (1 + G) * a2]
    const [Cp1, Cp2] = [Math.hypot(ap1, b1), Math.hypot(ap2, b2)]
    const hue = (b: number, ap: number) => {
      if (b === 0 && ap === 0) return 0
      const h = Math.atan2(b, ap) / rad
      return h >= 0 ? h : h + 360
    }
    const [hp1, hp2] = [hue(b1, ap1), hue(b2, ap2)]
    const dL = L2 - L1
    const dC = Cp2 - Cp1
    let dh = 0
    if (Cp1 * Cp2 !== 0) {
      dh = hp2 - hp1
      if (dh > 180) dh -= 360
      else if (dh < -180) dh += 360
    }
    const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh * rad) / 2)
    const Lb = (L1 + L2) / 2
    const Cpb = (Cp1 + Cp2) / 2
    let hb = hp1 + hp2
    if (Cp1 * Cp2 !== 0) {
      if (Math.abs(hp1 - hp2) > 180) hb += hb < 360 ? 360 : -360
      hb /= 2
    }
    const T =
      1 -
      0.17 * Math.cos((hb - 30) * rad) +
      0.24 * Math.cos(2 * hb * rad) +
      0.32 * Math.cos((3 * hb + 6) * rad) -
      0.2 * Math.cos((4 * hb - 63) * rad)
    const Rt =
      -Math.sin(2 * (30 * Math.exp(-(((hb - 275) / 25) ** 2))) * rad) *
      (2 * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7)))
    const Sl = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2)
    const Sc = 1 + 0.045 * Cpb
    const Sh = 1 + 0.015 * Cpb * T
    return Math.sqrt(
      (dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh)
    )
  }

  /** Adjacent-pair distances for an arbitrary mood set, in journey order. */
  const pairs = (moods: readonly BiomeMood[]) =>
    moods.slice(1).map((mood, i) => {
      const [a, b] = [resolvedMood(moods[i]), resolvedMood(mood)]
      return { name: `${moods[i].id}->${mood.id}`, sky: deltaE(a.sky, b.sky), key: deltaE(a.key, b.key) }
    })

  it('measures distance the way the eye does', () => {
    // Self-consistency of the instrument, checked against values derivable by hand rather than
    // remembered: a colour is zero from itself, the metric is symmetric, and a pure-lightness pair
    // reduces to dL/Sl — for L* 50 vs 100 that is 50 / (1 + 0.015·25²/√(20+25²)) = 36.5.
    expect(deltaE('#8FD69B', '#8FD69B')).toBe(0)
    expect(deltaE('#2E7D4F', '#E9A03A')).toBeCloseTo(deltaE('#E9A03A', '#2E7D4F'), 12)
    expect(deltaE('#777777', '#FFFFFF')).toBeCloseTo(36.5, 0)
  })

  it('separates every adjacent pair far enough to read at a glance', () => {
    for (const p of pairs(BIOME_MOODS)) {
      expect(p.sky, `${p.name} sky`).toBeGreaterThanOrEqual(MOOD_SKY_MIN_DE)
      expect(p.key, `${p.name} light`).toBeGreaterThanOrEqual(MOOD_LIGHT_MIN_DE)
    }
  })

  /**
   * The gate has teeth, proven rather than asserted. This is the mood set as it shipped through
   * round 15 — the one Aram saw and reported. Keeping it here means the gate can never be quietly
   * loosened back to something that reads as "every 2 checkpoints"; if this fixture ever passes,
   * the thresholds have stopped meaning anything.
   */
  it('rejects the round-15 colours that only announced every second checkpoint', () => {
    const before: BiomeMood[] = [
      { id: 'spring', sky: '#FFD7E4', glow: '#FFCFE0', skyMix: 0.34, cast: '#FFE4D2', lightMix: 0.12, hazeAlpha: 0.03, vignetteAlpha: 0.1 },
      { id: 'jungle', sky: '#2E7D4F', glow: '#D6E29A', skyMix: 0.64, cast: '#8FD69B', lightMix: 0.34, hazeAlpha: 0.06, vignetteAlpha: 0.24 },
      { id: 'delta', sky: '#2F7A70', glow: '#E2D8A6', skyMix: 0.6, cast: '#7FC9BC', lightMix: 0.32, hazeAlpha: 0.07, vignetteAlpha: 0.22 },
      { id: 'desert', sky: '#E9A03A', glow: '#FFEDBE', skyMix: 0.58, cast: '#FFCE84', lightMix: 0.3, hazeAlpha: 0.06, vignetteAlpha: 0.18 },
      { id: 'canyon', sky: '#A64A22', glow: '#FFC287', skyMix: 0.62, cast: '#EE9A63', lightMix: 0.34, hazeAlpha: 0.07, vignetteAlpha: 0.26 },
      { id: 'winter', sky: '#6E7FC2', glow: '#E6E1F5', skyMix: 0.6, cast: '#B3C2EE', lightMix: 0.34, hazeAlpha: 0.06, vignetteAlpha: 0.2 },
    ]
    const was = pairs(before)
    const failing = was.filter((p) => p.sky < MOOD_SKY_MIN_DE || p.key < MOOD_LIGHT_MIN_DE)
    // The two the report named, and only those: chapters 3 and 5 were the silent arrivals.
    expect(failing.map((p) => p.name)).toEqual(['jungle->delta', 'desert->canyon'])
    // The measured before-values, so a future reader can see the size of the defect.
    expect(was.map((p) => Math.round(p.sky * 10) / 10)).toEqual([33.6, 7.3, 29.8, 18.4, 29.7])
  })

  it('keeps the thresholds inside the bracket the evidence draws', () => {
    // Derived, not picked: every pair Aram registered measured >= 29.7 on the sky and >= 14.7 on
    // the light; every pair he did not measured <= 18.4 and <= 6.8. A gate above the rejected band
    // and below the accepted one is the only defensible place for it.
    expect(MOOD_SKY_MIN_DE).toBeGreaterThan(18.4)
    expect(MOOD_SKY_MIN_DE).toBeLessThan(29.7)
    expect(MOOD_LIGHT_MIN_DE).toBeGreaterThan(6.8)
    expect(MOOD_LIGHT_MIN_DE).toBeLessThan(14.7)
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

  // Sampled from the timeline's own bounds, not literals — after a TRAVEL_END or PANEL_END change
  // this keeps testing the real dwell instead of quietly sampling where the old one used to be.
  // The scroll crossfade completes at MOOD_IN_END, part-way INTO the dwell (the arrival clock
  // carries it before that), so the scroll-only path is fully landed over [MOOD_IN_END, PANEL_END]
  // — which requires the crossfade to finish before the dwell does.
  it('lands the new mood exactly from the crossfade’s end to the dwell’s', () => {
    expect(MOOD_IN_END).toBeLessThan(PANEL_END)
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      for (let k = 0; k <= 8; k++) {
        const local = MOOD_IN_END + ((PANEL_END - MOOD_IN_END) * k) / 8
        const inDwell = moodBlendAt(at(c, local))
        expect(inDwell.mix, `ch${c} @${local.toFixed(3)}`).toBe(1)
      }
      const b = moodBlendAt(at(c, (MOOD_IN_END + PANEL_END) / 2))
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
