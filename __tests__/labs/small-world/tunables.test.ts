import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DIALS,
  DIAL_KEYS,
  bakeVersion,
  isRebaking,
  isTuneEnabled,
  nonDefaultSettings,
  resetDials,
  setDial,
  subscribe,
} from '@/components/labs/small-world/scene/tunables'
import { BOIL_AMPLITUDE, BOIL_FPS } from '@/components/labs/small-world/scene/boil-material'
import { FIELD_DENT_DEPTH } from '@/components/labs/small-world/scene/field-clay'
import { WATER_DEFAULTS } from '@/components/labs/small-world/scene/water-clay'

// The store is module-global mutable state; restore defaults between every test.
beforeEach(() => resetDials())
afterEach(() => {
  vi.useRealTimers()
  resetDials()
})

describe('DIALS defaults pin the legacy shipped constants EXACTLY', () => {
  // Each default must equal the constant it replaced, so ?tune-absent is byte-identical.
  it('boil dials equal boil-material constants', () => {
    expect(DIALS.boilAmp.default).toBe(0)
    expect(DIALS.boilAmp.default).toBe(BOIL_AMPLITUDE)
    expect(DIALS.boilFps.default).toBe(10)
    expect(DIALS.boilFps.default).toBe(BOIL_FPS)
  })

  it('press-dent depth equals field-clay FIELD_DENT_DEPTH (Round-9 baked up)', () => {
    expect(DIALS.dentDepth.default).toBe(0.0375)
    expect(DIALS.dentDepth.default).toBe(FIELD_DENT_DEPTH)
    // extended headroom past the higher default (Round-9 range widening).
    expect(DIALS.dentDepth.max).toBe(0.1)
  })

  it('field + dent dial defaults reflect the Round-9 verdicts', () => {
    expect(DIALS.mottleMacro.default).toBe(0.035)
    expect(DIALS.mottleMicro.default).toBe(0.015)
    // macro·coarse + micro·fine reproduces the legacy 0.05·(0.7·coarse + 0.3·fine)
    expect(DIALS.mottleMacro.default + DIALS.mottleMicro.default).toBeCloseTo(0.05, 12)
    expect(DIALS.mottleMacro.default / (DIALS.mottleMacro.default + DIALS.mottleMicro.default)).toBeCloseTo(0.7, 12)
    expect(DIALS.mottleSaturation.default).toBe(0.2)
    expect(DIALS.veinDensity.default).toBe(0.12)
    expect(DIALS.grimeDensity.default).toBe(0.1)
    // terminator dither disliked (flickering shadows) → default OFF; dial kept.
    expect(DIALS.terminatorDither.default).toBe(0)
    expect(DIALS.terminatorDither.max).toBe(0.1)
    // Task 33 — terrain flow field (extends the water flow streak onto the land). Ships ON
    // at a modest default so Aram can judge the flow at scale; both dial back to 0.
    expect(DIALS.terrainFlowStrength.default).toBe(0.5)
    expect(DIALS.terrainFlowStrength.max).toBe(1.5)
    expect(DIALS.terrainFlowAlign.default).toBe(0.6)
    expect(DIALS.terrainFlowAlign.max).toBe(1)
    expect(DIALS.terrainFlowStrength.group).toBe('fields')
    expect(DIALS.terrainFlowAlign.group).toBe('fields')
    // dent AO baked up (Aram likes the higher settings) with doubled headroom.
    expect(DIALS.dentAO.default).toBe(0.3)
    expect(DIALS.dentAO.max).toBe(0.8)
  })

  it('every dial starts at its default with a valid range and class', () => {
    for (const k of DIAL_KEYS) {
      const d = DIALS[k]
      expect(d.value).toBe(d.default)
      expect(d.min).toBeLessThanOrEqual(d.default)
      expect(d.max).toBeGreaterThanOrEqual(d.default)
      expect(d.step).toBeGreaterThan(0)
      expect(['live', 'rebake']).toContain(d.cls)
    }
  })

  it('water dial defaults equal the WATER_DEFAULTS literals in water-clay', () => {
    expect(DIALS.waterPathWarp.default).toBe(WATER_DEFAULTS.pathWarp)
    expect(DIALS.waterPathStretch.default).toBe(WATER_DEFAULTS.pathStretch)
    expect(DIALS.waterPathDepth.default).toBe(WATER_DEFAULTS.pathDepth)
    expect(DIALS.waterPocketTint.default).toBe(WATER_DEFAULTS.pocketTint)
    expect(DIALS.waterReliefInward.default).toBe(WATER_DEFAULTS.reliefInward)
    expect(DIALS.waterReliefOutward.default).toBe(WATER_DEFAULTS.reliefOutward)
    expect(DIALS.waterRidgeSharp.default).toBe(WATER_DEFAULTS.ridgeSharp)
    expect(DIALS.waterOctaves.default).toBe(WATER_DEFAULTS.octaves)
    expect(DIALS.waterNormalRough.default).toBe(WATER_DEFAULTS.normalRough)
    expect(DIALS.waterFlowStrength.default).toBe(WATER_DEFAULTS.flowStrength)
    expect(DIALS.waterFlowAlign.default).toBe(WATER_DEFAULTS.flowAlign)
    // Task 33/34 water altitude: default 0 (today's recessed look). TWO-TIER range —
    // the shipped-default-safe region is ≤0.008·R (proven clear of the girl's lane +
    // props in scan-task33); the slider max is raised to 0.03·R for pure visual
    // exploration (Task 34 — Aram wants to play), where the slab may lap her path.
    expect(DIALS.waterRise.default).toBe(WATER_DEFAULTS.waterRise)
    expect(DIALS.waterRise.default).toBe(0)
    expect(DIALS.waterRise.max).toBe(0.03)
    // pocketTint is Aram's kept 0.8; the outward crest default is under its ≤0.4× cap.
    expect(DIALS.waterPocketTint.default).toBe(0.8)
    expect(DIALS.waterReliefOutward.default).toBeLessThanOrEqual(0.4 * DIALS.waterReliefInward.default)
  })

  it('declares exactly the Round-9 dial set, grouped boil/fields/dents/water', () => {
    expect(DIAL_KEYS).toEqual([
      'boilAmp',
      'boilFps',
      'mottleMacro',
      'mottleMicro',
      'mottleSaturation',
      'veinDensity',
      'grimeDensity',
      'terminatorDither',
      'terrainFlowStrength',
      'terrainFlowAlign',
      'dentDepth',
      'dentAO',
      'waterPathWarp',
      'waterPathStretch',
      'waterPathDepth',
      'waterPocketTint',
      'waterReliefInward',
      'waterReliefOutward',
      'waterRidgeSharp',
      'waterOctaves',
      'waterNormalRough',
      'waterFlowStrength',
      'waterFlowAlign',
      'waterRise',
    ])
    expect(DIALS.boilAmp.group).toBe('boil')
    expect(DIALS.mottleMacro.group).toBe('fields')
    expect(DIALS.dentDepth.group).toBe('dents')
    expect(DIALS.waterPathWarp.group).toBe('water')
  })
})

describe('setDial', () => {
  it('clamps writes to the dial range', () => {
    setDial('dentAO', 99)
    expect(DIALS.dentAO.value).toBe(DIALS.dentAO.max)
    setDial('dentAO', -5)
    expect(DIALS.dentAO.value).toBe(DIALS.dentAO.min)
  })

  it('ignores non-finite input (keeps the current value)', () => {
    setDial('boilAmp', 0.05)
    setDial('boilAmp', Number.NaN)
    expect(DIALS.boilAmp.value).toBe(0.05)
  })

  it('a LIVE dial applies immediately and does NOT trigger a rebake', () => {
    vi.useFakeTimers()
    const v0 = bakeVersion()
    setDial('boilFps', 14)
    expect(DIALS.boilFps.value).toBe(14)
    expect(isRebaking()).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(bakeVersion()).toBe(v0)
  })

  it('a REBAKE dial debounces: badge up now, version bumps after the debounce', () => {
    vi.useFakeTimers()
    const v0 = bakeVersion()
    setDial('mottleMacro', 0.08)
    expect(DIALS.mottleMacro.value).toBe(0.08)
    expect(isRebaking()).toBe(true)
    expect(bakeVersion()).toBe(v0) // not yet
    vi.advanceTimersByTime(399)
    expect(bakeVersion()).toBe(v0)
    vi.advanceTimersByTime(1)
    expect(isRebaking()).toBe(false)
    expect(bakeVersion()).toBe(v0 + 1) // exactly one bump
  })

  it('coalesces rapid REBAKE edits into a single version bump', () => {
    vi.useFakeTimers()
    const v0 = bakeVersion()
    setDial('mottleMacro', 0.04)
    vi.advanceTimersByTime(200)
    setDial('mottleMicro', 0.02)
    vi.advanceTimersByTime(200)
    setDial('dentDepth', 0.02)
    expect(bakeVersion()).toBe(v0) // still pending — the timer kept resetting
    vi.advanceTimersByTime(400)
    expect(bakeVersion()).toBe(v0 + 1)
  })

  it('notifies subscribers on change', () => {
    const spy = vi.fn()
    const unsub = subscribe(spy)
    setDial('boilAmp', 0.03)
    expect(spy).toHaveBeenCalled()
    unsub()
    spy.mockClear()
    setDial('boilAmp', 0.04)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('resetDials', () => {
  it('restores every default, clears the badge and bumps the bake version', () => {
    vi.useFakeTimers()
    setDial('mottleMacro', 0.09)
    setDial('boilAmp', 0.05)
    const v0 = bakeVersion()
    resetDials()
    expect(isRebaking()).toBe(false)
    expect(bakeVersion()).toBe(v0 + 1)
    for (const k of DIAL_KEYS) expect(DIALS[k].value).toBe(DIALS[k].default)
    // the pending pre-reset rebake timer must not fire a second bump
    vi.advanceTimersByTime(1000)
    expect(bakeVersion()).toBe(v0 + 1)
  })
})

describe('nonDefaultSettings (the copy-settings payload)', () => {
  it('is empty at defaults and lists only changed dials by key', () => {
    expect(nonDefaultSettings()).toEqual({})
    setDial('dentAO', 0.2)
    setDial('boilFps', 12)
    expect(nonDefaultSettings()).toEqual({ dentAO: 0.2, boilFps: 12 })
  })
})

describe('isTuneEnabled', () => {
  it('is true only for ?tune=1', () => {
    expect(isTuneEnabled('?tune=1')).toBe(true)
    expect(isTuneEnabled('')).toBe(false)
    expect(isTuneEnabled('?tune=0')).toBe(false)
    expect(isTuneEnabled('?foo=1')).toBe(false)
    expect(isTuneEnabled('?a=b&tune=1&c=d')).toBe(true)
  })
})
