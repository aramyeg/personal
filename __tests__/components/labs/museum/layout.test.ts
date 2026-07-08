import { describe, it, expect } from 'vitest'
import {
  HALL,
  SPACING,
  FIRST_OFFSET,
  END_ZONE,
  hallLength,
  paintingPlacements,
  drapedPlacement,
  clampToHall,
} from '@/components/labs/museum/layout'
import type { LabEntry } from '@/lib/labs-manifest'

const lab = (slug: string): LabEntry => ({
  slug,
  title: slug.toUpperCase(),
  date: '2026-07-08',
  thesis: `${slug} thesis`,
  status: 'live',
})

describe('hallLength', () => {
  it('grows with lab count and keeps an end zone', () => {
    expect(hallLength(1)).toBe(FIRST_OFFSET + 1 * SPACING + END_ZONE)
    expect(hallLength(4)).toBe(FIRST_OFFSET + 4 * SPACING + END_ZONE)
  })
})

describe('paintingPlacements', () => {
  it('returns one placement per lab, spaced along negative z', () => {
    const p = paintingPlacements([lab('a'), lab('b'), lab('c')])
    expect(p).toHaveLength(3)
    expect(p[0].position[2]).toBe(-FIRST_OFFSET)
    expect(p[1].position[2]).toBe(-(FIRST_OFFSET + SPACING))
    expect(p[2].position[2]).toBe(-(FIRST_OFFSET + 2 * SPACING))
  })

  it('alternates walls: even index left (+x facing), odd index right', () => {
    const p = paintingPlacements([lab('a'), lab('b')])
    expect(p[0].position[0]).toBeLessThan(0)
    expect(p[0].rotationY).toBeCloseTo(Math.PI / 2)
    expect(p[1].position[0]).toBeGreaterThan(0)
    expect(p[1].rotationY).toBeCloseTo(-Math.PI / 2)
  })

  it('hangs paintings at eye-friendly height and carries lab copy', () => {
    const [p] = paintingPlacements([lab('ps1')])
    expect(p.position[1]).toBe(2)
    expect(p.slug).toBe('ps1')
    expect(p.title).toBe('PS1')
    expect(p.thesis).toBe('ps1 thesis')
  })
})

describe('drapedPlacement', () => {
  it('sits on the far wall, centered, facing the entrance', () => {
    const d = drapedPlacement(2)
    expect(d.position[0]).toBe(0)
    expect(d.position[2]).toBeCloseTo(-(hallLength(2) - 0.1))
    expect(d.rotationY).toBe(0)
  })
})

describe('clampToHall', () => {
  const len = hallLength(2)
  it('keeps the player inside side walls', () => {
    expect(clampToHall(99, -3, len).x).toBe(HALL.width / 2 - HALL.margin)
    expect(clampToHall(-99, -3, len).x).toBe(-(HALL.width / 2 - HALL.margin))
  })
  it('keeps the player between entrance and far wall', () => {
    expect(clampToHall(0, 5, len).z).toBe(-HALL.margin)
    expect(clampToHall(0, -999, len).z).toBe(-(len - HALL.margin))
  })
  it('passes through positions already inside', () => {
    expect(clampToHall(1.2, -4.5, len)).toEqual({ x: 1.2, z: -4.5 })
  })
})
