import { describe, expect, it } from 'vitest'
import {
  labelVariantFor,
  wearSeedFor,
  wearProfile,
} from '@/components/labs/memory-card/lib/save-visuals'
import { hashSeed } from '@/components/labs/memory-card/lib/mulberry'
import { buildSaves } from '@/components/labs/memory-card/save-select/saves'
import { projects } from '@/data/projects'

const SLOTS = ['01', '02', '03', '04', '05', '06']

describe('labelVariantFor', () => {
  it('gives each project a distinct loud variant, cycling by index', () => {
    expect(labelVariantFor('project', 0)).toBe('bankform')
    expect(labelVariantFor('project', 1)).toBe('chat')
    expect(labelVariantFor('project', 2)).toBe('appbadge')
    expect(labelVariantFor('project', 3)).toBe('bankform') // cycles
  })

  it('maps each system kind to its own quiet variant', () => {
    expect(labelVariantFor('bio', 3)).toBe('sysdata')
    expect(labelVariantFor('stack', 4)).toBe('syslog')
    expect(labelVariantFor('contact', 5)).toBe('sysprompt')
  })

  it('assigns the six shipped saves six distinct layouts (a collection, not clones)', () => {
    const saves = buildSaves(projects)
    const variants = saves.map((save, i) => labelVariantFor(save.kind, i))
    expect(new Set(variants).size).toBe(6)
  })
})

describe('wearSeedFor / hashSeed', () => {
  it('is stable per slot', () => {
    expect(wearSeedFor('03')).toBe(wearSeedFor('03'))
  })

  it('gives every shipped slot a distinct seed', () => {
    expect(new Set(SLOTS.map(wearSeedFor)).size).toBe(SLOTS.length)
  })

  it('hashSeed returns a uint32', () => {
    for (const slot of SLOTS) {
      const h = hashSeed(slot)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThanOrEqual(0xffffffff)
      expect(Number.isInteger(h)).toBe(true)
    }
  })
})

describe('wearProfile', () => {
  it('is deterministic for a seed (same seed, same wear, forever)', () => {
    expect(wearProfile(12345)).toEqual(wearProfile(12345))
    expect(wearProfile(wearSeedFor('02'))).toEqual(wearProfile(wearSeedFor('02')))
  })

  it('varies across seeds', () => {
    const uniq = new Set([1, 2, 3, 4, 5].map((s) => JSON.stringify(wearProfile(s))))
    expect(uniq.size).toBeGreaterThan(1)
  })

  it('keeps grime in [0.32, 0.82) and scuffCorner in 0..3', () => {
    for (let s = 0; s < 256; s++) {
      const p = wearProfile(s)
      expect(p.grime).toBeGreaterThanOrEqual(0.32)
      expect(p.grime).toBeLessThan(0.82 + 1e-9)
      expect([0, 1, 2, 3]).toContain(p.scuffCorner)
    }
  })

  it('lands the sticker-residue ghost on 1–2 of the six shipped saves (subtle, not dirty)', () => {
    const residue = SLOTS.filter((slot) => wearProfile(wearSeedFor(slot)).hasResidue)
    expect(residue.length).toBeGreaterThanOrEqual(1)
    expect(residue.length).toBeLessThanOrEqual(2)
  })
})
