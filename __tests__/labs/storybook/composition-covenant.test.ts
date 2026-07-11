import { describe, expect, it } from 'vitest'
import {
  CHAPTERS,
  EXTRA_SPREAD_LAYERS,
  type SceneLayer,
} from '@/components/labs/storybook/content'

// The volumetric composition covenant (benchmark spec 2026-07-11, gate C1):
// a flat single-fold sheet needs a reason to exist. Story-role pieces —
// buildings, furniture, world-carrying props — must be volumetric boxes;
// flat sheets are legal only as backdrops, scenery planes, and figure
// standees (flat character cutouts at scene depth are authentic pop-up
// vocabulary). The allowlist below is a RATCHET: it names the story pieces
// still awaiting their multi-face art regeneration (call sheet v5) and only
// ever shrinks. Adding a name to it is a covenant violation by definition.

const PENDING_VOLUMETRIC: ReadonlySet<string> = new Set([
  'ch1-inn', // -> box building once front/side/top art lands
  'ch5-arch', // archway needs a dedicated volumetric treatment (it spans a walkway)
  'ch6-treasury', // -> box building; user is regenerating the split art
])

const ALL_SETS: ReadonlyArray<readonly [string, readonly SceneLayer[]]> = [
  ...CHAPTERS.map((c) => [`spread-${c.spread}`, c.layers] as const),
  ...Object.entries(EXTRA_SPREAD_LAYERS).map(([s, layers]) => [`extra-${s}`, layers] as const),
]

describe('composition covenant — volumetric by default (gate C1)', () => {
  it('every story-role piece is a box (or on the shrinking art allowlist)', () => {
    for (const [, layers] of ALL_SETS) {
      for (const layer of layers) {
        if (layer.role !== 'story') continue
        if (PENDING_VOLUMETRIC.has(layer.id)) continue
        expect(layer.mech, `${layer.id} is story-role and must be volumetric`).toBe('box')
      }
    }
  })

  it('no piece outside the covenant roles uses the demoted parallel fold', () => {
    // Tents "do not translate the idea" — nothing ships as a gutter tent.
    for (const [, layers] of ALL_SETS) {
      for (const layer of layers) {
        expect(layer.mech, `${layer.id} is a demoted gutter tent`).not.toBe('parallel')
      }
    }
  })

  it('volumetric census: every chapter spread ships an enclosed volume (C1)', () => {
    // barn, hive, counter, chest, stall, strongbox — 6/6 chapters.
    for (const chapter of CHAPTERS) {
      expect(
        chapter.layers.some((l) => l.mech === 'box'),
        `spread ${chapter.spread} has no volumetric piece`
      ).toBe(true)
    }
  })

  it('fold vocabulary: >= 3 mechanism families per chapter spread (C4)', () => {
    for (const chapter of CHAPTERS) {
      const families = new Set(chapter.layers.map((l) => l.mech))
      expect(families.size, `spread ${chapter.spread} families: ${[...families].join(',')}`)
        .toBeGreaterThanOrEqual(3)
    }
  })

  it('the allowlist only names pieces that still exist as story-role flats', () => {
    // A stale allowlist entry would silently weaken the covenant.
    const storyFlats = new Set(
      ALL_SETS.flatMap(([, layers]) =>
        layers.filter((l) => l.role === 'story' && l.mech !== 'box').map((l) => l.id)
      )
    )
    for (const id of PENDING_VOLUMETRIC) {
      expect(storyFlats.has(id), `${id} no longer needs its allowlist entry`).toBe(true)
    }
  })

  it('boxes ship both a lidded and a hollow read (gate B16)', () => {
    const roofs = new Set(
      ALL_SETS.flatMap(([, layers]) =>
        layers.filter((l) => l.mech === 'box').map((l) => (l.mech === 'box' ? l.roof : ''))
      )
    )
    expect(roofs.has('flat')).toBe(true) // painted top readable from the camera
    expect(roofs.has('open')).toBe(true) // hollow interior, raw paper
  })
})
