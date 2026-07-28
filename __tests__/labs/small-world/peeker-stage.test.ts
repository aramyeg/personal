import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PEEKER_CAST,
  PEEKER_DEPTH,
  PEEKER_FIGURE_RADIUS,
  PEEK_IN_START,
  PEEK_OUT_END,
  PEEK_UNROLL_START,
  peekerCastFor,
  peekerDepthMargin,
  peekerIdle,
  peekerPlacement,
  peekerPlanetClearance,
  peekerPresence,
  peekerRollSpin,
  peekerSize,
  peekerUnroll,
} from '@/components/labs/small-world/scene/props/peeker-stage'
import { PEEKER_SPECS } from '@/components/labs/small-world/scene/props/peeker-cast'

// Task 53 — checkpoint peekers. The two things that can actually break the world are pinned
// here: the corners must stay pure sky at every aspect (the planet is never covered), and the
// entrance must be a pure function of the panel dwell so scrubbing back is exact.

// Camera rig, mirrored from scene.tsx (a tripwire test below fails if those literals drift).
const CAMERA_FOV = 38
const CAMERA_DISTANCE = 12.1
const PLANET_RADIUS = 2.2
/** Standing terrain + prop ceiling budget — the bench must clear the tallest possible spire. */
const CEILING = 1.35 * PLANET_RADIUS

const HALF_H = PEEKER_DEPTH * Math.tan((CAMERA_FOV * Math.PI) / 360)
/** Landscape desktop, square, tablet portrait, phone portrait, and a very tall sliver. */
const ASPECTS = [3.2, 2.4, 1.7778, 1.5, 1.0, 0.75, 0.5625, 0.5, 0.4, 0.35]

describe('peekerPresence — dwell-driven entrance, scrub-exact', () => {
  it('is a pure function of the dwell fraction (scrubbing back replays it exactly)', () => {
    const forward: number[] = []
    for (let i = 0; i <= 400; i++) forward.push(peekerPresence(i / 400))
    for (let i = 400; i >= 0; i--) expect(peekerPresence(i / 400)).toBe(forward[i])
  })

  it('is fully off-frame before the entrance and after the exit', () => {
    // easeOutBack(0) leaves a float residue rather than a hard zero; the rig's visibility
    // threshold is 5e-4, so "off" means "below anything that could ever draw".
    expect(peekerPresence(0)).toBeCloseTo(0, 12)
    expect(peekerPresence(PEEK_IN_START)).toBeCloseTo(0, 12)
    expect(peekerPresence(PEEK_OUT_END)).toBe(0)
    expect(peekerPresence(1.4)).toBe(0)
  })

  it('reaches the parked pose and holds it through the middle of the dwell', () => {
    for (const t of [0.45, 0.55, 0.65, 0.75]) expect(peekerPresence(t)).toBeCloseTo(1, 6)
  })

  it('overshoots past parked on the way in — the house easeOutBack settle', () => {
    let peak = 0
    for (let i = 0; i <= 1000; i++) peak = Math.max(peak, peekerPresence(i / 1000))
    expect(peak).toBeGreaterThan(1.02)
  })

  it('never overshoots under reduced motion, and still parks and leaves', () => {
    let peak = 0
    for (let i = 0; i <= 1000; i++) peak = Math.max(peak, peekerPresence(i / 1000, true))
    expect(peak).toBeLessThanOrEqual(1)
    expect(peekerPresence(0.5, true)).toBeCloseTo(1, 6)
    expect(peekerPresence(0, true)).toBe(0)
    expect(peekerPresence(1, true)).toBe(0)
  })

  it('moves continuously — no step big enough to read as a flicker', () => {
    let prev = peekerPresence(0)
    for (let i = 1; i <= 5000; i++) {
      const cur = peekerPresence(i / 5000)
      expect(Math.abs(cur - prev)).toBeLessThan(0.02)
      prev = cur
    }
  })
})

describe('peekerIdle / peekerUnroll / peekerRollSpin', () => {
  it('idles as a bounded, continuous, dwell-driven oscillation', () => {
    let prev = peekerIdle(0, 6, 0)
    for (let i = 1; i <= 5000; i++) {
      const cur = peekerIdle(i / 5000, 6, 0)
      expect(Math.abs(cur)).toBeLessThanOrEqual(1)
      expect(Math.abs(cur - prev)).toBeLessThan(0.02)
      prev = cur
    }
  })

  it('unrolls the pangolins monotonically, tucked before the window and open after', () => {
    expect(peekerUnroll(0)).toBe(0)
    expect(peekerUnroll(PEEK_UNROLL_START)).toBe(0)
    expect(peekerUnroll(1)).toBe(1)
    let prev = -1
    for (let i = 0; i <= 1000; i++) {
      const cur = peekerUnroll(i / 1000)
      expect(cur).toBeGreaterThanOrEqual(prev)
      prev = cur
    }
  })

  it('unwinds the roll-in spin to exactly zero once parked', () => {
    expect(peekerRollSpin(1)).toBe(0)
    expect(peekerRollSpin(1.09)).toBe(0)
    expect(peekerRollSpin(0)).toBeGreaterThan(Math.PI * 2)
  })
})

describe('peekerPlacement — derived from the frustum, never hardcoded', () => {
  it('tracks the frame corner: a wider viewport pushes the pair further out', () => {
    const wide = peekerPlacement(HALF_H, HALF_H * 2.4)
    const narrow = peekerPlacement(HALF_H, HALF_H * 0.5)
    expect(wide.x).toBeGreaterThan(narrow.x)
    expect(wide.y).toBeGreaterThan(0)
  })

  it('sizes off the frame height on wide viewports and shrinks on narrow ones', () => {
    expect(peekerSize(HALF_H, HALF_H * 1.7778)).toBeCloseTo(peekerSize(HALF_H, HALF_H * 3.2), 10)
    expect(peekerSize(HALF_H, HALF_H * 0.5)).toBeLessThan(peekerSize(HALF_H, HALF_H * 1.7778))
  })

  it('waits fully above the frame before entering', () => {
    for (const aspect of ASPECTS) {
      const p = peekerPlacement(HALF_H, HALF_H * aspect)
      expect(p.hiddenY - PEEKER_FIGURE_RADIUS * p.size).toBeGreaterThan(HALF_H)
    }
  })

  it('parks inside the frame at every aspect', () => {
    for (const aspect of ASPECTS) {
      const p = peekerPlacement(HALF_H, HALF_H * aspect)
      expect(p.x).toBeLessThan(HALF_H * aspect)
      expect(p.y).toBeLessThan(HALF_H)
      expect(p.y).toBeGreaterThan(0)
    }
  })
})

describe('planet clearance — the corners are sky at every aspect', () => {
  it('never lets a parked peeker reach the planet silhouette', () => {
    for (const aspect of ASPECTS) {
      const gap = peekerPlanetClearance(aspect, CAMERA_FOV, CAMERA_DISTANCE, CEILING)
      expect(gap, `aspect ${aspect}`).toBeGreaterThan(0.05)
    }
  })

  it('keeps the pair in the outer eighth of the frame, well clear of the girl on the pole', () => {
    // The girl stands on the pole at the middle of the frame; anything past ~0.7 of the
    // half-width is a corner, so this is the "they are atmosphere, not a focal hijack" pin.
    for (const aspect of ASPECTS) {
      const halfW = HALF_H * aspect
      const p = peekerPlacement(HALF_H, halfW)
      expect(p.x / halfW, `aspect ${aspect}`).toBeGreaterThan(0.7)
    }
  })

  it('sits behind the planet ceiling in depth — the z-buffer alone forbids covering it', () => {
    for (const aspect of ASPECTS) {
      const margin = peekerDepthMargin(HALF_H, HALF_H * aspect, CAMERA_DISTANCE, CEILING)
      expect(margin, `aspect ${aspect}`).toBeGreaterThan(0.4)
    }
  })

  it('stays well in front of the sky backdrop plane (world z = -20)', () => {
    // Worst case is the nearest sky pixel the frustum can reach; the plane sits ~14 units
    // beyond the peekers along the view axis at this depth.
    expect(PEEKER_DEPTH).toBeLessThan(CAMERA_DISTANCE + 20)
  })

  it('pins the camera rig it was derived from (drift tripwire on scene.tsx)', () => {
    const src = readFileSync(
      path.resolve(process.cwd(), 'components/labs/small-world/scene/scene.tsx'),
      'utf8'
    )
    expect(src).toContain(`const CAMERA_FOV = ${CAMERA_FOV}`)
    expect(src).toContain(`const CAMERA_DISTANCE = ${CAMERA_DISTANCE}`)
    // and the peekers must stay a sibling of the planet, or they would spin with the world
    expect(src).toMatch(/<\/Planet>[\s\S]*<CheckpointPeekers/)
  })
})

describe('the cast', () => {
  it('leaves spring bare and gives every other checkpoint a pair', () => {
    expect(peekerCastFor(0)).toBeNull()
    for (let ch = 1; ch <= 5; ch++) expect(peekerCastFor(ch)).not.toBeNull()
    expect(peekerCastFor(6)).toBeNull()
    expect(peekerCastFor(-1)).toBeNull()
  })

  it('never mirrors a checkpoint — the two sides are different characters', () => {
    for (const pair of PEEKER_CAST) {
      if (!pair) continue
      expect(pair[0]).not.toBe(pair[1])
    }
  })

  it('uses each character exactly once and has a spec for all of them', () => {
    const used = PEEKER_CAST.flatMap((pair) => (pair ? [pair[0], pair[1]] : []))
    expect(new Set(used).size).toBe(used.length)
    expect(used.sort()).toEqual(Object.keys(PEEKER_SPECS).sort())
    for (const kind of used) {
      const spec = PEEKER_SPECS[kind]
      expect(spec.cycles).toBeGreaterThan(0)
      expect(spec.sway).toBeGreaterThan(0)
    }
  })

  it('only the canyon rolls in', () => {
    const rolling = Object.entries(PEEKER_SPECS)
      .filter(([, spec]) => spec.rolls)
      .map(([kind]) => kind)
      .sort()
    expect(rolling).toEqual(['pangolinBig', 'pangolinSmall'])
  })
})
