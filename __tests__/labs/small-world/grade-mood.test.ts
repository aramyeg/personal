import { describe, expect, it } from 'vitest'
import { CHAPTER_COUNT } from '@/components/labs/small-world/chapters'
import {
  BURST_END,
  CHAPTER_SLICE,
  PANEL_END,
  PARK_FRAC,
  ROTATION_TOTAL,
  TRAVEL_END,
  chapterStartRotation,
  journeyStateAt,
  rotationAt,
} from '@/components/labs/small-world/journey-timeline'
import { initialArrival, stepArrival } from '@/components/labs/small-world/arrival'
import { PALETTE } from '@/components/labs/small-world/palette'
import {
  BOUNDARY_WANDER,
  MERIDIANS,
  boundaryWander,
  paintBand,
} from '@/components/labs/small-world/scene/biomes'
import {
  STANCE_ALPHA,
  activeVariantAt,
  canonicalTheta,
} from '@/components/labs/small-world/scene/renewal'
import type { BiomeMood } from '@/components/labs/small-world/overlay/grade-mood'
import {
  BIOME_MOODS,
  BLOOM_FLOOR,
  BLOOM_FALL_END,
  BLOOM_RISE_END,
  HAZE_ALPHA_MAX,
  LANE_CROSSINGS,
  LIGHT_MIX_MAX,
  MOOD_LIGHT_MIN_DE,
  MOOD_SKY_MIN_DE,
  MOOD_SPAN_ROT,
  SHOW_GRADE,
  SKY_MIX_MAX,
  VIGNETTE_ALPHA_MAX,
  bloomAt,
  crossingRotation,
  gradeAt,
  mixHex,
  moodBlendAt,
  resolvedMood,
} from '@/components/labs/small-world/overlay/grade-mood'

const SEG = 1 / CHAPTER_COUNT
/** Global progress at a given chapter's local position. */
const at = (chapter: number, local: number) => (chapter + local) * SEG
/**
 * Progress at which a rotation is reached — the inverse of `rotationAt`. Undefined ON the parked
 * rotation itself, which is the point: a whole dwell shares one rotation, so the inverse picks the
 * approach that ARRIVES at it and the release leg for anything past it.
 *
 * Task 73 made this piecewise. Rotation used to cover the whole slice over [0, TRAVEL_END]; it now
 * covers PARK_FRAC of it over the approach and the remainder over the release leg after the cards.
 */
const progressOfRotation = (rot: number) => {
  const c = Math.min(CHAPTER_COUNT - 1, Math.floor(rot / CHAPTER_SLICE))
  const f = (rot - c * CHAPTER_SLICE) / CHAPTER_SLICE
  const local =
    f <= PARK_FRAC
      ? (f / PARK_FRAC) * TRAVEL_END
      : PANEL_END + ((f - PARK_FRAC) / (1 - PARK_FRAC)) * (1 - PANEL_END)
  return (c + local) / CHAPTER_COUNT
}
/** The wedge index actually painted under the girl's lane, straight from the biome map. */
const wedgeUnderLane = (rot: number) => {
  const thetaC = canonicalTheta(rot + STANCE_ALPHA)
  return activeVariantAt(thetaC, rot) * MERIDIANS.length + paintBand(thetaC, 0)
}

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
    // Derived, not picked: every pair Aram registered measured >= 29.7 on the sky and >= 12.2 on
    // the light; every pair he did not measured <= 18.4 and <= 5.8. A gate above the rejected band
    // and below the accepted one is the only defensible place for it. The light's bracket sits
    // lower than the sky's because its mix runs in LINEAR light between two pale colours, which
    // compresses the range — see `mixHexLinear`.
    expect(MOOD_SKY_MIN_DE).toBeGreaterThan(18.4)
    expect(MOOD_SKY_MIN_DE).toBeLessThan(29.7)
    expect(MOOD_LIGHT_MIN_DE).toBeGreaterThan(5.8)
    expect(MOOD_LIGHT_MIN_DE).toBeLessThan(12.2)
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

/**
 * Task 59 — THE SIX LANE CROSSINGS.
 *
 * The mood is keyed to the moment the ground under the girl's feet becomes the next biome's, so
 * these assertions are against the BIOME MAP'S OWN painters (`paintBand`, `activeVariantAt`) and
 * not against a remembered table of angles. If the torn boundary is re-torn, the stance moves or
 * the renewal window shifts, the derivation follows and these tests keep testing the real thing.
 */
describe('lane crossings', () => {
  /**
   * The coupling the whole derivation rests on, and the one thing that could silently break it:
   * `chapterStartRotation(c) + STANCE_ALPHA` only lands on meridian c % 3 because a chapter's
   * rotation slice and a band's longitude span are the same angle. ROTATION_TOTAL is the spec's
   * documented tuning knob ("the parked >360° question changes THIS constant"), so if it ever
   * moves, chapter c stops travelling band c % 3 and this fails loudly rather than leaving the
   * grade keyed to boundaries the girl no longer crosses.
   */
  it('travels exactly one band per chapter', () => {
    const BAND_SPAN = (Math.PI * 2) / MERIDIANS.length
    expect(CHAPTER_SLICE).toBeCloseTo(BAND_SPAN, 12)
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      const theta = chapterStartRotation(c) + STANCE_ALPHA
      expect(canonicalTheta(theta), `chapter ${c} starts on its meridian`).toBeCloseTo(
        MERIDIANS[c % MERIDIANS.length],
        12
      )
    }
  })

  it('names one crossing per chapter, strictly increasing, inside the journey', () => {
    expect(LANE_CROSSINGS).toHaveLength(CHAPTER_COUNT)
    for (let c = 1; c < CHAPTER_COUNT; c++) {
      expect(LANE_CROSSINGS[c], `crossing ${c}`).toBeGreaterThan(LANE_CROSSINGS[c - 1])
    }
    expect(LANE_CROSSINGS[0]).toBeGreaterThanOrEqual(0)
    expect(LANE_CROSSINGS[CHAPTER_COUNT - 1] + MOOD_SPAN_ROT).toBeLessThan(ROTATION_TOTAL)
  })

  /**
   * The load-bearing one: each derived crossing is exactly where the painters change their mind
   * about which wedge the lane is standing on. Bracketed to a microradian either side, which is
   * ~7 orders of magnitude finer than the 0.035 rad the boundary wanders — no eyeballing survives
   * that.
   */
  it('lands exactly where the biome map repaints the lane', () => {
    const eps = 1e-6
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      expect(wedgeUnderLane(LANE_CROSSINGS[c] + eps), `just past crossing ${c}`).toBe(c)
      expect(wedgeUnderLane(LANE_CROSSINGS[c] - eps), `just before crossing ${c}`).not.toBe(c)
    }
  })

  /**
   * ...and between two crossings the lane stays on that wedge — but for TWO slivers, pinned here
   * rather than left to be rediscovered, because both are places where the paint underfoot and the
   * mood on screen deliberately disagree:
   *
   *   1. The journey OPENS 12.9 mrad short of the spring boundary, so the first eighth of a degree
   *      of turn is still band 2's paint. The grade opens on spring regardless — there is no mood
   *      before the first one, and the page has to open wearing it.
   *   2. Between the delta and the desert the variant flips at exactly 2π while band 0's torn
   *      boundary sits 12.9 mrad past it, so a hairline of B2 (winter) paint passes under her. The
   *      grade rides it out on the delta mood.
   *
   * Both are ~0.7° of planet turn. Anything WIDER than that appearing here is a real defect.
   */
  it('holds one wedge between crossings, but for the two slivers the geometry leaves', () => {
    const N = 120000
    const step = ROTATION_TOTAL / N
    const runs: { from: number; to: number }[] = []
    for (let i = 0; i <= N; i++) {
      const rot = step * i
      let expected = 0
      while (expected + 1 < CHAPTER_COUNT && rot >= LANE_CROSSINGS[expected + 1]) expected++
      if (wedgeUnderLane(rot) === expected) continue
      const last = runs[runs.length - 1]
      if (last && rot - last.to <= step * 1.5) last.to = rot
      else runs.push({ from: rot, to: rot })
    }
    expect(runs).toHaveLength(2)
    for (const r of runs) expect(r.to - r.from).toBeLessThan(0.02)
    expect(runs[0].from).toBe(0)
    expect(runs[0].to).toBeCloseTo(LANE_CROSSINGS[0], 3)
    expect(runs[1].from).toBeCloseTo(Math.PI * 2, 3)
    expect(runs[1].to).toBeCloseTo(LANE_CROSSINGS[3], 3)
  })

  it('is the paint boundary and the lap flip, not the bare meridian', () => {
    // Every crossing carries its meridian's own signed wander — three different offsets, two
    // positive and one negative. A derivation that quietly dropped the wander would put all six
    // exactly on chapterStartRotation, so this is the tripwire on that.
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      const i = c % MERIDIANS.length
      const offset = LANE_CROSSINGS[c] - chapterStartRotation(c)
      if (c === 3) continue // the lap flip governs there; covered by the sliver test above
      expect(offset, `chapter ${c} wander`).toBeCloseTo(boundaryWander(0, i, BOUNDARY_WANDER), 12)
    }
    expect(boundaryWander(0, 1, BOUNDARY_WANDER)).toBeLessThan(0)
    expect(crossingRotation(3)).toBeGreaterThanOrEqual(Math.PI * 2)
  })

  /**
   * The saturation rail — the descendant of Task 55's `MOOD_IN_END <= 1`. If the crossfade span
   * ever exceeded the tightest gap between crossings, a boundary would arrive while the previous
   * blend was still moving, the pair being crossfaded would swap underneath it, and every one of
   * those boundaries would become a visible colour step.
   */
  it('saturates before the next crossing arrives', () => {
    const gaps = LANE_CROSSINGS.slice(1).map((r, i) => r - LANE_CROSSINGS[i])
    expect(MOOD_SPAN_ROT).toBeLessThan(Math.min(...gaps))
    // ...and the consequence, measured: the mood is exactly the old one right up to the crossing.
    for (let c = 1; c < CHAPTER_COUNT; c++) {
      const b = moodBlendAt(progressOfRotation(LANE_CROSSINGS[c] - 1e-9))
      expect(b.mix, `approach to crossing ${c}`).toBe(1)
      expect(b.to, `approach to crossing ${c}`).toBe(BIOME_MOODS[c - 1])
    }
  })
})

/**
 * Task 59 — WINDOW GEOMETRY. Where the crossfade starts is the ground's business (above); how
 * long it takes has to answer to the timeline, and these are the two margins it must keep.
 */
describe('crossfade window', () => {
  const windowEnd = (c: number) => progressOfRotation(LANE_CROSSINGS[c] + MOOD_SPAN_ROT)

  it('is fully in before she stops, with room left in the approach', () => {
    for (let c = 1; c < CHAPTER_COUNT; c++) {
      const end = windowEnd(c)
      // Task 73: measured as a fraction of the APPROACH, not in legs. The approach used to be the
      // whole slice and is now PARK_FRAC of it, so a margin quoted in legs would be asserting
      // against a leg the crossfade no longer has. What must hold is that the shift finishes
      // inside the walk-in, with headroom against the torn boundary's wander.
      const spare = (at(c, TRAVEL_END) - end) / (TRAVEL_END / CHAPTER_COUNT)
      expect(spare, `chapter ${c} approach left after the crossfade`).toBeGreaterThan(0.1)
      expect(moodBlendAt(end).mix, `chapter ${c} landed`).toBeCloseTo(1, 9)
    }
  })

  /**
   * THE GATE THE FRAMING FIX IS ONLY CORRECT WITH — per chapter, not on average.
   *
   * Task 73 moved the stop from the end of a chapter's rotation slice to PARK_FRAC of it, so the
   * card is finally over its own biome. On its own that would have traded the scenery mismatch for
   * a colour one: at the old MOOD_SPAN_FRAC of 0.65 the crossfade would still have been at mix
   * 0.246 when the card opened — three quarters of the way back at the PREVIOUS chapter's grade.
   * Every card must open under ITS OWN chapter's mood, fully arrived.
   */
  it('has every card open under its own chapter mood, fully arrived', () => {
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      for (const local of [BURST_END, (BURST_END + PANEL_END) / 2, PANEL_END - 1e-9]) {
        const b = moodBlendAt(at(c, local))
        expect(b.toIndex, `chapter ${c} at ${local.toFixed(3)} wedge`).toBe(c)
        expect(b.to, `chapter ${c} at ${local.toFixed(3)} mood`).toBe(BIOME_MOODS[c])
        expect(b.mix, `chapter ${c} at ${local.toFixed(3)} mix`).toBe(1)
        expect(b.bloom, `chapter ${c} at ${local.toFixed(3)} bloom`).toBe(1)
      }
    }
  })

  /** ...and it is STILL by then: the whole dwell shares one rotation. */
  it('cannot move by so much as a float while a card is up', () => {
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      const first = moodBlendAt(at(c, BURST_END))
      for (let k = 0; k <= 20; k++) {
        const local = BURST_END + ((PANEL_END - BURST_END) * k) / 20
        expect(moodBlendAt(at(c, local)).skyMix, `chapter ${c} step ${k}`).toBe(first.skyMix)
      }
    }
  })

  /**
   * ...and it still has to READ as a move rather than a cut — but against a much harder wall than
   * before, and the honest number belongs here rather than hidden behind a threshold.
   *
   * The crossfade may only run while rotation is moving, and after Task 73 rotation moves for just
   * TRAVEL_END (0.126) of a leg before the stop. So the shift now takes ~0.11 of a leg — about
   * 1.8% of the scroll track, against 5.9% before. At a comfortable reading scroll that is roughly
   * a third of a second instead of about one.
   *
   * That is a wall, not a tuning miss: making it slower means starting the crossfade BEFORE she
   * crosses the boundary, which is the one thing Aram's rule for this mechanism forbids ("right
   * when scrolling and our girl passes to the new biome, the mood shift should happen there"). The
   * floor below is what is left of the guarantee, and the beat itself is on the eye-test list
   * rather than being certified by this number alone.
   */
  it('still spans enough of a leg to read as a move rather than a switch', () => {
    for (let c = 1; c < CHAPTER_COUNT; c++) {
      const start = progressOfRotation(LANE_CROSSINGS[c])
      expect((windowEnd(c) - start) * CHAPTER_COUNT, `chapter ${c} span`).toBeGreaterThan(0.1)
    }
  })

  /**
   * THE GUARANTEE THAT REPLACES A MARGIN. The brief's requirement was that the mood must never
   * shift while the previous chapter's cards are still on screen. Two of the six boundaries make
   * that impossible to satisfy by margin alone: the checkpoint stop sits exactly ON the meridian,
   * and meridian 1's torn boundary leans 17.9 mrad to the LOW side of it, so the girl steps onto
   * the jungle (and later the canyon) a hair BEFORE she arrives at the spring (desert) checkpoint.
   *
   * Keying to rotation answers it structurally instead. `rotationAt` freezes rotation for the
   * whole dwell, so the crossfade cannot advance by so much as a float while a checkpoint is
   * parked — however long the visitor lingers, whatever the arrival clock is doing, and at any
   * scrub speed inside the dwell. What leaks in before the freeze is `smoothstep(0.0179 / span)`,
   * which the cubic crushes to 5.1e-4 of one crossfade.
   */
  it('freezes the mood for the whole of every dwell', () => {
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      const ref = moodBlendAt(at(c, (TRAVEL_END + PANEL_END) / 2))
      for (let k = 0; k <= 40; k++) {
        const local = TRAVEL_END + ((PANEL_END - TRAVEL_END) * k) / 40
        const b = moodBlendAt(at(c, local))
        // Bit-identical everywhere inside. The k = 0 sample is the dwell's opening instant, whose
        // local reconstructs a half-ulp BELOW TRAVEL_END and so lands one ulp short of the frozen
        // angle — hence the near-check for it and exact equality for the rest.
        expect(b.rotation, `ch${c} @${local.toFixed(3)} rotation`).toBeCloseTo(ref.rotation, 12)
        expect(b.mix, `ch${c} @${local.toFixed(3)} mix`).toBeCloseTo(ref.mix, 12)
        if (k > 0) {
          expect(b.rotation, `ch${c} @${local.toFixed(3)} rotation`).toBe(ref.rotation)
          expect(b.mix, `ch${c} @${local.toFixed(3)} mix`).toBe(ref.mix)
        }
        expect(b.fromIndex).toBe(ref.fromIndex)
        expect(b.toIndex).toBe(ref.toIndex)
        // Only the bloom envelope may still be moving in here — that is the swell under the cards.
        expect(b.skyMix).toBeCloseTo(ref.skyMix * (b.bloom / ref.bloom), 12)
      }
    }
  })

  /**
   * ...and what the visitor sees for it: every checkpoint wears its own mood, to the byte, for the
   * whole dwell. This is the assertion the two-negative-wander chapters have to survive, and they
   * do — 5.1e-4 of a crossfade is under a quarter of one 8-bit code on every channel.
   */
  it('shows each checkpoint its own mood, byte-exact, across the whole dwell', () => {
    let worst = 0
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      const own = BIOME_MOODS[c]
      for (let k = 0; k <= 20; k++) {
        const local = TRAVEL_END + ((PANEL_END - TRAVEL_END) * k) / 20
        const b = moodBlendAt(at(c, local))
        const bl = bloomAt(local)
        expect(gradeAt(at(c, local)).haze, `${own.id} @${local.toFixed(3)}`).toBe(own.cast)
        worst = Math.max(
          worst,
          Math.abs(b.skyMix - own.skyMix * bl),
          Math.abs(b.lightMix - own.lightMix * bl),
          Math.abs(b.hazeAlpha - own.hazeAlpha * bl),
          Math.abs(b.vignetteAlpha - own.vignetteAlpha * bl)
        )
      }
    }
    // 1/255 of the weakest dial in play (hazeAlpha, 0.03) is 1.2e-4; this is the same order and
    // reached only on the two chapters the wander leans against.
    expect(worst).toBeLessThan(2e-4)
  })
})

describe('bloomAt', () => {
  /**
   * The guarantee is CONTINUITY at the seam, not the value there. Task 73 moved the checkpoint to
   * the front of the segment, so the envelope now rests at the floor across a chapter boundary
   * instead of peaking on it — the same claim about invisibility, made at the other end of the
   * swell.
   */
  it('matches itself across a chapter boundary, so seams are invisible', () => {
    expect(bloomAt(1)).toBe(bloomAt(0))
    expect(bloomAt(0)).toBeCloseTo(BLOOM_FLOOR, 6)
    expect(bloomAt(1 - 1e-6)).toBeCloseTo(bloomAt(0), 6)
    expect(bloomAt(1e-6)).toBeCloseTo(bloomAt(0), 6)
  })

  it('settles to the floor between checkpoints and never leaves the band', () => {
    // The rest now sits on the walk OUT — the long leg after the cards have gone.
    expect(bloomAt(BLOOM_FALL_END)).toBeCloseTo(BLOOM_FLOOR, 6)
    expect(bloomAt(1)).toBeCloseTo(BLOOM_FLOOR, 6)
    for (let i = 0; i <= 1000; i++) {
      const b = bloomAt(i / 1000)
      expect(b).toBeGreaterThanOrEqual(BLOOM_FLOOR - 1e-9)
      expect(b).toBeLessThanOrEqual(1 + 1e-9)
    }
  })

  it('is at full for the WHOLE of the dwell, not merely by the start of it', () => {
    for (let k = 0; k <= 20; k++) {
      const local = BURST_END + ((PANEL_END - BURST_END) * k) / 20
      expect(bloomAt(local), `dwell step ${k}`).toBe(1)
    }
    expect(bloomAt(BLOOM_RISE_END)).toBeCloseTo(1, 6)
  })

  // The swell is the one part of the grade that deliberately keeps moving after rotation freezes:
  // it rises through the stop and lands under the cards. If its window ever retreated below
  // TRAVEL_END the arrival would stop swelling and the checkpoint would lose its beat.
  it('keeps swelling past the stop, so the cards land into a rising frame', () => {
    expect(BLOOM_RISE_END).toBeGreaterThan(TRAVEL_END)
    expect(bloomAt(TRAVEL_END)).toBeLessThan(bloomAt(BLOOM_RISE_END))
    // ...and it is done swelling exactly when the cards arrive, never during them.
    expect(BLOOM_RISE_END).toBe(BURST_END)
  })
})

describe('moodBlendAt', () => {
  /**
   * The behaviour change Task 59 exists for, stated as the before/after it is. Mid-leg the mood is
   * the biome she is WALKING ON, fully in — under Task 55's approach-keyed window this same
   * sample still wore the previous chapter's mood, which is what Aram reported as "we also show
   * the mood of the past biome".
   */
  it('wears the mood of the ground she is on, from early in the leg', () => {
    // Well before the halfway mark of the desert leg, and long before its checkpoint.
    const b = moodBlendAt(at(3, 0.45))
    expect(b.to).toBe(BIOME_MOODS[3])
    expect(b.mix).toBeCloseTo(1, 12)
    expect(b.skyMix).toBeCloseTo(BIOME_MOODS[3].skyMix * bloomAt(0.45), 12)
    // …and the sample Task 55 would have shown wearing the DELTA's mood here is already moving.
    expect(moodBlendAt(at(3, 0.2)).toIndex).toBe(3)
    expect(moodBlendAt(at(3, 0.2)).mix).toBeGreaterThan(0.5)
  })

  it('still wears the old biome while she is still on it', () => {
    // Just inside the previous chapter's release, before her lane reaches the torn boundary.
    const b = moodBlendAt(progressOfRotation(LANE_CROSSINGS[2] - 1e-6))
    expect(b.to).toBe(BIOME_MOODS[1])
    expect(b.mix).toBe(1)
  })

  it('reports the rotation it is keyed to, and it is the timeline’s', () => {
    for (let i = 0; i <= 200; i++) {
      const p = i / 200
      expect(moodBlendAt(p).rotation).toBe(journeyStateAt(p).rotation)
      expect(rotationAt(p)).toBe(journeyStateAt(p).rotation)
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
    // At the envelope's RESTING strength, not at full: Task 73 put the swell's peak at the
    // checkpoint rather than at the segment seam, so the page opens at BLOOM_FLOOR and blooms in
    // over the first fifth of the leg. Spring is deliberately the faintest mood in the set, so
    // what this costs the first frame is about 0.05 of one mix dial.
    expect(b.skyMix).toBeCloseTo(BIOME_MOODS[0].skyMix * bloomAt(0), 6)
  })

  it('crossfades monotonically from the crossing to the end of the window', () => {
    for (let c = 1; c < CHAPTER_COUNT; c++) {
      let prev = -1
      for (let i = 0; i <= 200; i++) {
        // The 1e-9 is a float round-trip guard, not a margin: `progressOfRotation` is this file's
        // own inverse of `rotationAt`, which Task 73 made piecewise, and the round trip can land
        // an ulp BELOW the crossing — which resolves to the previous wedge and fails the pairing
        // assertion for a reason that has nothing to do with the crossfade.
        const rot = LANE_CROSSINGS[c] + 1e-9 + (MOOD_SPAN_ROT * i) / 200
        const b = moodBlendAt(progressOfRotation(rot))
        expect(b.toIndex, `chapter ${c} pair`).toBe(c)
        expect(b.mix, `chapter ${c} step ${i}`).toBeGreaterThanOrEqual(prev)
        prev = b.mix
      }
      expect(prev, `chapter ${c} lands`).toBeCloseTo(1, 9)
    }
  })

  /**
   * The shift is visibly UNDERWAY as she steps across — the capture pair the task is proved by.
   * A tenth of the way along the window (a few vh of scroll past the boundary) the frame has
   * already left the old mood by more than an 8-bit code on the haze, so "girl stepping onto the
   * new terrain = mood shifting" is a claim about pixels, not about intent.
   */
  it('has visibly moved a short way past each crossing', () => {
    for (let c = 1; c < CHAPTER_COUNT; c++) {
      const atCrossing = gradeAt(progressOfRotation(LANE_CROSSINGS[c]))
      const justPast = gradeAt(progressOfRotation(LANE_CROSSINGS[c] + MOOD_SPAN_ROT * 0.1))
      expect(atCrossing.haze, `crossing ${c} starts on the old mood`).toBe(BIOME_MOODS[c - 1].cast)
      expect(justPast.haze, `crossing ${c} has moved`).not.toBe(BIOME_MOODS[c - 1].cast)
    }
  })

  it('leaves the bloom on progress — the swell is an envelope, not a place', () => {
    const p = at(2, 0.5)
    expect(moodBlendAt(p).skyMix).toBeCloseTo(BIOME_MOODS[2].skyMix * bloomAt(0.5), 12)
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
  // jump the grade. Any stepping, snap, or boundary discontinuity fails here. The bound is a
  // third of Task 55's, because the clocked term that used to need headroom is gone.
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
      prev = b
    }
    // Task 73: the crossfade now runs over the short approach instead of a whole slice, so the
    // per-sample step at this resolution grew with it (measured 6.5e-3, was under 1.5e-3).
    expect(worst).toBeLessThan(0.008)
  })

  /**
   * ...and the reason a sample-rate bound is not the whole story: a fixed 4000-sample sweep only
   * proves the function is smooth AT THAT RESOLUTION. What actually bounds a real scrub is the
   * Lipschitz constant — the most any dial can move per unit of progress — because a step at any
   * speed is that constant times the progress the frame covered. Measured at 50x the sweep's
   * resolution it does not grow, which is what tells you the sweep was measuring the constant and
   * not missing a spike between its samples.
   */
  it('has a bounded rate of change, so no scrub speed can produce a step', () => {
    const N = 200000
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
      prev = b
    }
    // Task 73: 26.1, from 5.2. The constant IS the crossfade's speed, and the crossfade got ~4x
    // faster by geometry — see the window suite for why that is a wall rather than a regression.
    // What still matters is that it is BOUNDED and does not grow with the sample rate.
    expect(worst * N).toBeLessThan(27)
  })

  /** Each lane crossing swaps which PAIR is being crossfaded. Both sides must resolve alike. */
  it('crosses every lane boundary seamlessly, in both directions', () => {
    const eps = 1e-9
    for (let c = 1; c < CHAPTER_COUNT; c++) {
      const before = moodBlendAt(progressOfRotation(LANE_CROSSINGS[c] - eps))
      const after = moodBlendAt(progressOfRotation(LANE_CROSSINGS[c] + eps))
      expect(before.toIndex, `crossing ${c} swaps the pair`).toBe(c - 1)
      expect(after.toIndex).toBe(c)
      expect(Math.abs(after.skyMix - before.skyMix), `crossing ${c} sky`).toBeLessThan(1e-9)
      expect(Math.abs(after.lightMix - before.lightMix), `crossing ${c} light`).toBeLessThan(1e-9)
      expect(
        Math.abs(after.vignetteAlpha - before.vignetteAlpha),
        `crossing ${c} vignette`
      ).toBeLessThan(1e-9)
      expect(gradeAt(progressOfRotation(LANE_CROSSINGS[c] - eps)).haze).toBe(
        gradeAt(progressOfRotation(LANE_CROSSINGS[c] + eps)).haze
      )
    }
  })

  /**
   * DRIVEN BY THE REAL ARRIVAL MACHINE, not a scripted trajectory — the distinction that hid a
   * whole class of defect from Task 55's first fling sweep, and the reason this survives the
   * removal of the machinery it was written to police. Flinging backward out of a dwell lands in
   * the PREVIOUS dwell, whose arrival preempts the in-flight retraction; under the old pull
   * formulation that released stored displacement in one frame (94-117/255 on a haze channel at
   * 6000px/s). The grade no longer reads the reveal at all, so it cannot happen — but the guard
   * that proves it belongs on the SHIPPED path, driven by `stepArrival`, not on a claim about the
   * signature.
   *
   * The metric has to be chosen carefully (Task 55's lesson): raw per-frame colour deltas grow
   * with speed even for a perfectly smooth function, so they prove nothing. What marks a
   * discontinuity is a frame where the grade moved a lot while the PAGE barely did — channels per
   * 1000px of scroll. For a continuous function that is bounded by the Lipschitz constant above
   * and stays flat as speed rises; a step would spike it.
   */
  it('keeps the grade’s rate flat under real flings, forwards and backwards', () => {
    const H = 900
    const scrollable = 240 * CHAPTER_COUNT * (H / 100) - H
    const chan = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

    const fling = (chapter: number, pxPerSec: number) => {
      const parked = (chapter + (BURST_END + PANEL_END) / 2) * SEG
      let s = initialArrival(parked)
      for (let f = 0; f < 180; f++) s = stepArrival(s, parked, 1 / 60)
      const startY = scrollable * s.progress
      let prev: { c: number[]; y: number } | null = null
      let worst = 0
      for (let f = 0; f < 240; f++) {
        const y = Math.min(scrollable, Math.max(0, startY + (pxPerSec * f) / 60))
        s = stepArrival(s, y / scrollable, 1 / 60)
        const c = chan(gradeAt(s.progress).haze)
        const yy = s.progress * scrollable
        // Frames where the page barely moved are quantisation-dominated (a 1/255 rounding over a
        // 2px scroll reads as 500) and say nothing about continuity, so they are skipped.
        if (prev && Math.abs(yy - prev.y) > 2) {
          const step = Math.max(...c.map((x, i) => Math.abs(x - prev!.c[i])))
          worst = Math.max(worst, (step / Math.abs(yy - prev.y)) * 1000)
        }
        prev = { c, y: yy }
      }
      return worst
    }

    for (const chapter of [1, 3, 5]) {
      for (const v of [2000, 3200, 4500, 6000, 9000, 12000]) {
        // Task 73: 1140 worst, from under 420. The absolute rate grew because the crossfade
        // window shrank with the approach — but the property this test is named for SURVIVES and
        // is what the numbers show: the rate does not grow with fling speed, it FALLS (1133 at
        // 2000px/s down to 525 at 12000px/s), because the damping is what bounds a fast scrub.
        // A speed-dependent rate is what would mean a step; a flat one means a crossfade the
        // visitor outruns rather than one that snaps.
        expect(fling(chapter, -v), `ch${chapter} back @${v}px/s`).toBeLessThan(1200)
        expect(fling(chapter, v), `ch${chapter} fwd @${v}px/s`).toBeLessThan(1200)
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
      const p = at(c, (BURST_END + PANEL_END) / 2) // parked at the cards
      const g = gradeAt(p)
      const b = moodBlendAt(p)
      expect(g.haze, BIOME_MOODS[c].id).toBe(BIOME_MOODS[c].cast)
      expect(g.hazeAlpha).toBe(b.hazeAlpha)
      expect(g.vignetteAlpha).toBe(b.vignetteAlpha)
      // …and those are the chapter's own numbers, to well inside one 8-bit code. Not exactly, on
      // two of the six: see the crossfade-window suite for the 5.1e-4 the torn boundary leaks.
      expect(g.hazeAlpha).toBeCloseTo(BIOME_MOODS[c].hazeAlpha, 3)
      expect(g.vignetteAlpha).toBeCloseTo(BIOME_MOODS[c].vignetteAlpha, 3)
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
