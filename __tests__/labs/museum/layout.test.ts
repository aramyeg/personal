import { describe, expect, it } from 'vitest'
import {
  ATTIC,
  STAIR,
  HALL,
  atticDepth,
  atticGableHeight,
  atticPlacements,
  atticPlaquePlacement,
  clampToRegions,
  floorY,
  hallLength,
} from '@/components/labs/museum/layout'
import { atticLabs, type LabEntry } from '@/lib/labs-manifest'

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
  it('centres the row on the gable wall however many have been retired', () => {
    for (const n of [1, 2, 3, 4]) {
      const ps = atticPlacements(
        Array.from({ length: n }, (_, i) => entry(`a${i}`)),
        L
      )
      const xs = ps.map((p) => p.position[0])
      expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(0, 6)
    }
  })
  // Gated against the real manifest, not a fabricated count: the wall has room
  // for the failures shipped today, and the day one more is retired this fires.
  //
  // A hall frame is 2.12 x 2.72 (painting.tsx: ART_W/ART_H + 2 * FRAME_T);
  // attic placements carry a scale, so every bound below is derived from it.
  const FRAME_W = 2.12
  const FRAME_H = 2.72
  const shipped = atticPlacements(atticLabs, L)
  const corners = (p: (typeof shipped)[number]) => {
    const s = p.scale ?? 1
    return {
      halfW: (FRAME_W / 2) * s,
      top: p.position[1] + (FRAME_H / 2) * s,
      bottom: p.position[1] - (FRAME_H / 2) * s,
    }
  }

  it('keeps every shipped exhibit on the gable wall, clear of the knee walls', () => {
    for (const p of shipped) {
      expect(Math.abs(p.position[0]) + corners(p).halfW).toBeLessThanOrEqual(ATTIC.halfWidth)
    }
  })
  it('keeps every frame under the roof and off the floor', () => {
    // The failure this gates: a frame's upper OUTER corners leaving the gable
    // and hanging in the dark past the roof line.
    for (const p of shipped) {
      const { halfW, top, bottom } = corners(p)
      for (const x of [p.position[0] - halfW, p.position[0] + halfW]) {
        expect(top).toBeLessThanOrEqual(atticGableHeight(x))
      }
      expect(bottom).toBeGreaterThan(STAIR.rise)
    }
  })
  it('never overlaps two shipped frames', () => {
    for (let i = 1; i < shipped.length; i++) {
      const gap =
        shipped[i].position[0] -
        corners(shipped[i]).halfW -
        (shipped[i - 1].position[0] + corners(shipped[i - 1]).halfW)
      expect(gap).toBeGreaterThan(0)
    }
  })
  it('hangs the plaque on the left knee wall, inside it and facing the room', () => {
    const plaque = atticPlaquePlacement(L)
    expect(plaque.rotationY).toBeCloseTo(Math.PI / 2, 6) // normal points +x, into the room
    expect(plaque.position[0]).toBeLessThan(-(ATTIC.halfWidth - 0.1)) // on the wall
    expect(plaque.position[0]).toBeGreaterThan(-ATTIC.halfWidth) // not through it
    // fits between the attic floor and the knee wall's top (plaque is 1.15 tall)
    expect(plaque.position[1] - 0.575).toBeGreaterThan(STAIR.rise)
    expect(plaque.position[1] + 0.575).toBeLessThan(STAIR.rise + ATTIC.wallHeight)
    // and inside the attic's depth rather than in the stair shaft or the wall
    expect(plaque.position[2]).toBeLessThan(-(L + STAIR.run))
    expect(plaque.position[2]).toBeGreaterThan(-atticDepth(L))
  })
  it('keeps the plaque clear of every hung exhibit', () => {
    // The two hang on perpendicular walls, so the separation that matters is
    // along z: the plaque must stand well off the gable the frames cover.
    const plaque = atticPlaquePlacement(L)
    for (const p of atticPlacements(atticLabs, L)) {
      expect(plaque.position[2] - p.position[2]).toBeGreaterThan(1)
    }
  })
})
