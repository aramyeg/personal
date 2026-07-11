import { describe, expect, it } from 'vitest'
import {
  CHAPTERS,
  EXTRA_SPREAD_LAYERS,
  type SceneLayer,
} from '@/components/labs/storybook/content'
import { strutClosedReach } from '@/components/labs/storybook/book/popup-anatomy'
import { PAGE_W, PAGE_H } from '@/components/labs/storybook/book/page-geometry'

// The volumetric composition covenant, RAISED to Part C v2 (benchmark spec
// 2026-07-11, "raised acceptance"). The box-era premise is inverted: real
// pop-up "dimensions" come from ASSEMBLY ANATOMY, not enclosed volumes. A
// flat single-fold sheet is legal only as backdrop / scenery / figure; a
// story-role piece must be a dressed assembly (a kinematic core wearing >= 2
// shaped die-cut patches) or a multi-tier floating platform. A bare
// primitive — v-fold, tent, OR box — in a story role now fails CI, exactly
// as gutter tents were demoted before it. The old PENDING_VOLUMETRIC
// allowlist is gone: dressed v-fold heroes are legal anatomy.

const CHAPTER_SETS: ReadonlyArray<readonly [string, readonly SceneLayer[]]> = CHAPTERS.map(
  (c) => [`spread-${c.spread}`, c.layers] as const
)
const ALL_SETS: ReadonlyArray<readonly [string, readonly SceneLayer[]]> = [
  ...CHAPTER_SETS,
  ...Object.entries(EXTRA_SPREAD_LAYERS).map(([s, layers]) => [`extra-${s}`, layers] as const),
]

// A dress patch is decorative (zero DOF); it does not itself count as a
// mechanism family, but two of them riding a core turn that core into an
// assembly. Platforms and fans are inherently multi-plane assemblies (a
// deck spanning strut ranks; k v-folds sharing one apex), so they carry no
// dress seat and satisfy the census on their own.
const familyOf = (l: SceneLayer): string | null => {
  switch (l.mech) {
    case 'vfold':
      return 'vfold'
    case 'box':
      return 'box'
    case 'platform':
      return 'platform'
    case 'fan':
      return 'fan'
    case 'child':
    case 'rider':
      return 'recursion'
    case 'parallel':
      return 'parallel'
    case 'dress':
      return null
  }
}

const dressTargeting = (id: string, layers: readonly SceneLayer[]): SceneLayer[] =>
  layers.filter((l) => l.mech === 'dress' && l.parentId === id)

// Legal dress seats per parent mechanism (popup-mechanics DressGeom doc).
const VFOLD_SEATS: ReadonlySet<string> = new Set(['left', 'right'])
const BOX_FACES: ReadonlySet<string> = new Set([
  'wallL', 'wallR', 'lidL', 'lidR', 'roofL', 'roofR', 'capFrontL', 'capFrontR', 'capBackL', 'capBackR',
])
const PLATFORM_FACES: ReadonlySet<string> = new Set(['deckA', 'deckB', 'strutL', 'strutR'])

describe('composition covenant v2 — dressed assemblies by default (gate C1v2)', () => {
  it('C1v2 ANATOMY CENSUS: every story piece is a platform, a fan, or a dressed core', () => {
    for (const [name, layers] of ALL_SETS) {
      for (const layer of layers) {
        if (layer.role !== 'story') continue
        if (layer.mech === 'platform' || layer.mech === 'fan') continue // inherent assemblies
        if (layer.mech === 'vfold' || layer.mech === 'box') {
          const dresses = dressTargeting(layer.id, layers)
          expect(
            dresses.length,
            `${name} ${layer.id} is a bare ${layer.mech} in a story role — needs >= 2 dress patches`
          ).toBeGreaterThanOrEqual(2)
          continue
        }
        throw new Error(`${name} ${layer.id}: story role with non-assembly mech ${layer.mech}`)
      }
    }
  })

  it('no piece anywhere uses the demoted parallel (gutter tent) fold', () => {
    for (const [name, layers] of ALL_SETS) {
      for (const layer of layers) {
        expect(layer.mech, `${name} ${layer.id} is a demoted gutter tent`).not.toBe('parallel')
      }
    }
  })

  it('C4v2 FOLD VOCABULARY: >= 4 distinct mechanism families per chapter spread', () => {
    // Families {v-fold, box, platform, fan, recursion(child|rider)}. Dress is
    // zero-DOF decoration and does not count toward the vocabulary.
    for (const chapter of CHAPTERS) {
      const families = new Set(chapter.layers.map(familyOf).filter((f): f is string => f !== null))
      expect(
        families.size,
        `spread ${chapter.spread} families: ${[...families].join(',')}`
      ).toBeGreaterThanOrEqual(4)
    }
  })

  it('the floating-tier gate: every chapter spread ships >= 1 platform (C3v2 structural half)', () => {
    for (const chapter of CHAPTERS) {
      expect(
        chapter.layers.some((l) => l.mech === 'platform'),
        `spread ${chapter.spread} has no floating platform`
      ).toBe(true)
    }
  })
})

describe('mechanism validity — the flat-fold / mount / seat laws (every layer)', () => {
  it('platform flat-fold: bridge => equal reach + qA===qB; terrace => qA+qB === gap', () => {
    for (const [name, layers] of ALL_SETS) {
      for (const l of layers) {
        if (l.mech !== 'platform') continue
        const reachA = strutClosedReach(l.strutA)
        const reachB = strutClosedReach(l.strutB)
        if (Math.abs(reachA - reachB) < 1e-9) {
          // BRIDGE: mirror ranks fold together, so the deck panels must be equal.
          expect(l.qA, `${name} ${l.id} bridge needs qA===qB`).toBe(l.qB)
        } else {
          // TERRACE: the deck's two panels bridge the closed gap between ranks.
          expect(
            Math.abs(l.qA + l.qB - Math.abs(reachA - reachB)),
            `${name} ${l.id} terrace: qA+qB must equal the closed reach gap`
          ).toBeLessThan(1e-9)
        }
      }
    }
  })

  it('platform containment + disjoint strut spans (folds flat inside the page)', () => {
    for (const [name, layers] of ALL_SETS) {
      for (const l of layers) {
        if (l.mech !== 'platform') continue
        const reachA = strutClosedReach(l.strutA)
        const reachB = strutClosedReach(l.strutB)
        // closed folded reach along the page stays within the page width
        expect(
          Math.max(reachA, reachB) + Math.max(l.qA, l.qB),
          `${name} ${l.id} reach+q exceeds the page`
        ).toBeLessThanOrEqual(PAGE_W)
        // every strut bay and the deck stay within the page depth
        for (const strut of [l.strutA, l.strutB]) {
          for (const [z0, z1] of strut.spans) {
            expect(z0).toBeLessThan(z1)
            expect(Math.abs(z0)).toBeLessThanOrEqual(PAGE_H / 2)
            expect(Math.abs(z1)).toBeLessThanOrEqual(PAGE_H / 2)
          }
          // bays of a rank must be disjoint (they share one ridge line)
          const sorted = [...strut.spans].sort((a, b) => a[0] - b[0])
          for (let i = 1; i < sorted.length; i++) {
            expect(
              sorted[i][0],
              `${name} ${l.id} strut bays overlap`
            ).toBeGreaterThanOrEqual(sorted[i - 1][1])
          }
        }
        expect(l.deckZ0).toBeLessThan(l.deckZ1)
        expect(Math.abs(l.deckZ0)).toBeLessThanOrEqual(PAGE_H / 2)
        expect(Math.abs(l.deckZ1)).toBeLessThanOrEqual(PAGE_H / 2)
      }
    }
  })

  it('rider mount rule: boxLid on a flat box, deckCrease on a bridge platform; mountZ in range', () => {
    for (const [name, layers] of ALL_SETS) {
      for (const l of layers) {
        if (l.mech !== 'rider') continue
        const parent = layers.find((p) => p.id === l.parentId)
        expect(parent, `${name} ${l.id} rider parent missing`).toBeDefined()
        if (!parent) continue
        if (l.seat === 'boxLid') {
          expect(parent.mech, `${name} ${l.id} boxLid needs a box`).toBe('box')
          if (parent.mech === 'box') {
            expect(parent.roof, `${name} ${l.id} boxLid needs a flat roof`).toBe('flat')
            expect(l.mountZ).toBeGreaterThanOrEqual(parent.z0)
            expect(l.mountZ).toBeLessThanOrEqual(parent.z1)
          }
        } else {
          expect(parent.mech, `${name} ${l.id} deckCrease needs a platform`).toBe('platform')
          if (parent.mech === 'platform') {
            expect(
              Math.abs(strutClosedReach(parent.strutA) - strutClosedReach(parent.strutB)),
              `${name} ${l.id} deckCrease needs a BRIDGE platform`
            ).toBeLessThan(1e-9)
            expect(l.mountZ).toBeGreaterThanOrEqual(parent.deckZ0)
            expect(l.mountZ).toBeLessThanOrEqual(parent.deckZ1)
          }
        }
        // riders stay small — a rooftop prop rises only partway (design rules)
        expect(l.width).toBeLessThanOrEqual(0.12)
        expect(l.height).toBeLessThanOrEqual(0.1)
        expect(l.rhoDeg).toBeGreaterThan(l.phiDeg)
      }
    }
  })

  it('dress validity: parent resolves in-spread and the seat is legal for its mechanism', () => {
    for (const [name, layers] of ALL_SETS) {
      for (const l of layers) {
        if (l.mech !== 'dress') continue
        const parent = layers.find((p) => p.id === l.parentId)
        expect(parent, `${name} ${l.id} dress parent ${l.parentId} not in spread`).toBeDefined()
        if (!parent) continue
        const legal =
          parent.mech === 'vfold'
            ? VFOLD_SEATS
            : parent.mech === 'box'
              ? BOX_FACES
              : parent.mech === 'platform'
                ? PLATFORM_FACES
                : new Set<string>()
        expect(
          legal.has(l.seat),
          `${name} ${l.id} seat '${l.seat}' is not legal for a ${parent.mech} parent`
        ).toBe(true)
        // dress is decorative scenery, never a story piece on its own
        expect(l.role).toBe('scenery')
        // each patch stays within the die-cut bound (overhang allowed, sprawl not)
        expect(l.width).toBeLessThanOrEqual(0.35)
        expect(l.height).toBeLessThanOrEqual(0.35)
      }
    }
  })

  it('fan members: rho > phi each, nested non-crossing (non-decreasing phi and rho)', () => {
    for (const [name, layers] of ALL_SETS) {
      for (const l of layers) {
        if (l.mech !== 'fan') continue
        expect(l.members.length, `${name} ${l.id} fan needs >= 2 members`).toBeGreaterThanOrEqual(2)
        for (const m of l.members) {
          expect(m.rhoDeg, `${name} ${l.id} member must bridge its glue`).toBeGreaterThan(m.phiDeg)
        }
        for (let i = 1; i < l.members.length; i++) {
          expect(l.members[i].phiDeg).toBeGreaterThanOrEqual(l.members[i - 1].phiDeg)
          expect(l.members[i].rhoDeg).toBeGreaterThanOrEqual(l.members[i - 1].rhoDeg)
        }
      }
    }
  })

  it('boxes still ship both a lidded and a hollow read (gate B16)', () => {
    const roofs = new Set(
      ALL_SETS.flatMap(([, layers]) =>
        layers.filter((l) => l.mech === 'box').map((l) => (l.mech === 'box' ? l.roof : ''))
      )
    )
    expect(roofs.has('flat')).toBe(true) // painted top readable from the camera
    expect(roofs.has('open')).toBe(true) // hollow interior, raw paper
  })
})
