import { describe, expect, it } from 'vitest'
import {
  ATTIC,
  STAIR,
  HALL,
  atticDepth,
  atticPlacements,
  atticPlaquePlacement,
  clampToRegions,
  floorY,
  hallLength,
} from '@/components/labs/museum/layout'
import type { LabEntry } from '@/lib/labs-manifest'

const L = hallLength(2) // hall with two paintings

describe('floorY', () => {
  it('is 0 through the hall and at the door plane', () => {
    expect(floorY(-1, L)).toBe(0)
    expect(floorY(-L, L)).toBe(0)
  })
  it('ramps linearly to the attic floor over the stair run', () => {
    expect(floorY(-(L + STAIR.run / 2), L)).toBeCloseTo(STAIR.rise / 2, 6)
    expect(floorY(-(L + STAIR.run), L)).toBeCloseTo(STAIR.rise, 6)
  })
  it('holds the attic floor beyond the stair top', () => {
    expect(floorY(-(L + STAIR.run + 2), L)).toBe(STAIR.rise)
  })
  it('is continuous at both seams', () => {
    const eps = 1e-4
    expect(floorY(-L + eps, L)).toBeCloseTo(floorY(-L - eps, L), 3)
    const top = -(L + STAIR.run)
    expect(floorY(top + eps, L)).toBeCloseTo(floorY(top - eps, L), 3)
  })
})

describe('clampToRegions', () => {
  const wallZ = -(L - HALL.margin)
  it('blocks the end wall away from the door', () => {
    const r = clampToRegions({ x: 0, z: wallZ + 0.05 }, { x: 0, z: wallZ - 0.2 }, L)
    expect(r.z).toBeGreaterThanOrEqual(wallZ)
    expect(r.x).toBe(0) // no sideways teleport
  })
  it('lets the player through the doorway span', () => {
    const r = clampToRegions({ x: STAIR.doorX, z: wallZ + 0.05 }, { x: STAIR.doorX, z: wallZ - 0.2 }, L)
    expect(r.z).toBeLessThan(wallZ)
  })
  it('holds corridor side walls on the stairs', () => {
    const midStair = -(L + STAIR.run / 2)
    const r = clampToRegions(
      { x: STAIR.doorX, z: midStair },
      { x: STAIR.doorX + 2, z: midStair },
      L
    )
    expect(r.x).toBeLessThanOrEqual(STAIR.doorX + STAIR.walkHalf)
  })
  it('opens into the full attic width past the stair top', () => {
    const atticMid = -(L + STAIR.run + 2)
    const r = clampToRegions({ x: STAIR.doorX, z: atticMid }, { x: -2.5, z: atticMid }, L)
    expect(r.x).toBeCloseTo(-2.5, 6)
  })
  it('stops at the attic far wall', () => {
    const deep = -(atticDepth(L) + 1)
    const r = clampToRegions({ x: 0, z: -(L + STAIR.run + 2) }, { x: 0, z: deep }, L)
    expect(r.z).toBeGreaterThanOrEqual(-(atticDepth(L) - ATTIC.floorMargin))
  })
  it('cannot jump from hall into attic width while standing in the corridor band', () => {
    const midStair = -(L + STAIR.run / 2)
    const r = clampToRegions({ x: STAIR.doorX, z: midStair }, { x: 0, z: midStair }, L)
    expect(r.x).toBeGreaterThanOrEqual(STAIR.doorX - STAIR.walkHalf)
  })
})

describe('attic placements', () => {
  const entry = (slug: string): LabEntry => ({
    slug,
    title: slug,
    date: '2026-07-09',
    thesis: 't',
    status: 'attic',
    retrospective: 'r',
  })
  it('hangs exhibits on the far gable wall facing the room', () => {
    const [p] = atticPlacements([entry('snowpark')], L)
    expect(p.rotationY).toBe(0)
    expect(p.position[2]).toBeCloseTo(-(atticDepth(L) - ATTIC.hangOffset), 6)
    expect(p.position[1]).toBeGreaterThan(STAIR.rise) // hangs above the attic floor
  })
  it('spreads multiple exhibits across x', () => {
    const ps = atticPlacements([entry('a'), entry('b')], L)
    expect(ps[0].position[0]).not.toBe(ps[1].position[0])
  })
  it('places the plaque beside the first exhibit on the same wall', () => {
    const plaque = atticPlaquePlacement(L)
    expect(plaque.rotationY).toBe(0)
    expect(plaque.position[2]).toBeCloseTo(-(atticDepth(L) - ATTIC.hangOffset), 6)
  })
})
