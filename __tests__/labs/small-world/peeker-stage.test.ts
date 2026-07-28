import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  PEEKER_CAST,
  PEEKER_DEPTH,
  PEEKER_FIGURE_BOX,
  PEEKER_LEFT_MIN_WIDTH,
  PEEKER_FACE_TOP,
  PEEKER_LEFT_MAX_DROP,
  PEEKER_NAV_PILL,
  PEEKER_PRESENCE_PEAK,
  PEEK_IN_START,
  PEEK_OUT_END,
  PEEK_SIDE_STAGGER,
  PEEK_UNROLL_START,
  peekerCastFor,
  peekerDepthMargin,
  peekerHalfHeight,
  peekerIdle,
  peekerParkedY,
  peekerPlacement,
  peekerPlanetClearance,
  peekerPresence,
  peekerReach,
  peekerRollSpin,
  peekerSize,
  peekerUnroll,
  planetNdcRadius,
} from '@/components/labs/small-world/scene/props/peeker-stage'
import { PEEKER_SPECS } from '@/components/labs/small-world/scene/props/peeker-cast'

// Task 53 — checkpoint peekers. The things that can actually break the world are pinned here:
// the peekers must never be able to cover the planet, they must stay visually clear of it, and
// the entrance must be a pure function of the panel dwell so scrubbing back is exact.

// Camera rig, mirrored from scene.tsx (a tripwire test below fails if those literals drift).
const CAMERA_FOV = 38
const CAMERA_DISTANCE = 12.1
const PLANET_RADIUS = 2.2
/** Standing terrain + prop ceiling BUDGET — nothing on the planet may exceed it. */
const CEILING = 1.35 * PLANET_RADIUS

const HALF_H = peekerHalfHeight(CAMERA_FOV)

/** Real device frames plus deliberate extremes, since the nav-pill drop depends on pixel size. */
const VIEWPORTS = [
  { width: 2560, height: 1080 }, // ultrawide
  { width: 1920, height: 1080 },
  { width: 1600, height: 900 },
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 900, height: 900 },
  { width: 820, height: 1180 }, // tablet portrait
  { width: 768, height: 1024 }, // iPad portrait
  { width: 600, height: 960 },
  { width: 1600, height: 500 }, // short landscape
  { width: 1024, height: 420 }, // very short
]
/** Below PEEKER_LEFT_MIN_WIDTH only the right figure shows; these still get swept. */
const NARROW_VIEWPORTS = [
  { width: 430, height: 932 },
  { width: 414, height: 896 },
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 320, height: 568 },
]
const ALL = [...VIEWPORTS, ...NARROW_VIEWPORTS]
const label = (v: { width: number; height: number }) => `${v.width}x${v.height}`
const placeFor = (v: { width: number; height: number }) =>
  peekerPlacement(HALF_H, (HALF_H * v.width) / v.height, v)

const _e = new THREE.Euler()
const _m = new THREE.Matrix4()
const _v = new THREE.Vector3()

/**
 * TRUE separation between the figures and the planet: samples the rotated bounding box's surface
 * and measures each point against the planet's ellipse in that point's OWN column. This is what
 * the shipped bench approximates conservatively — see the conservatism test below.
 */
function trueSeparation(v: { width: number; height: number }, extent: number): number {
  const halfW = (HALF_H * v.width) / v.height
  const p = peekerPlacement(HALF_H, halfW, v)
  const ry = planetNdcRadius(CAMERA_FOV, CAMERA_DISTANCE, extent)
  const rx = ry / (v.width / v.height)
  const b = PEEKER_FIGURE_BOX
  const N = 14
  let worst = Infinity
  for (const side of [-1, 1] as const) {
    if (side === -1 && !p.leftVisible) continue
    for (const hide of [-0.1, -0.05, 0, 0.1, 0.2, 0.35]) {
      for (const sway of [-0.06, 0, 0.06]) {
        _e.set(0, -side * 0.3, side * (0.2 + hide * 0.34) + sway, 'XYZ')
        _m.makeRotationFromEuler(_e)
        const parkedY = peekerParkedY(p, side)
        const cx = side * (p.x + hide * p.hiddenOut)
        const cy = parkedY + hide * (p.hiddenY - parkedY)
        const xs = side === -1 ? [b.minX, b.maxX] : [-b.maxX, -b.minX]
        for (let i = 0; i <= N; i++) {
          for (let j = 0; j <= N; j++) {
            const fx = xs[0] + ((xs[1] - xs[0]) * i) / N
            const fy = b.minY + ((b.maxY - b.minY) * j) / N
            const fz = -b.absZ + ((2 * b.absZ) * i) / N
            for (const pt of [
              [fx, fy, -b.absZ],
              [fx, fy, b.absZ],
              [xs[0], fy, fz],
              [xs[1], fy, fz],
              [fx, b.minY, fz],
              [fx, b.maxY, fz],
            ]) {
              _v.set(pt[0], pt[1], pt[2]).applyMatrix4(_m).multiplyScalar(p.size)
              const column = Math.abs(cx + _v.x) / halfW
              if (column >= rx) continue
              const ndcY = (cy + _v.y) / HALF_H
              worst = Math.min(worst, ndcY - ry * Math.sqrt(1 - (column / rx) * (column / rx)))
            }
          }
        }
      }
    }
  }
  return worst
}

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
    for (let i = 0; i <= 100000; i++) peak = Math.max(peak, peekerPresence(i / 100000))
    expect(peak).toBeCloseTo(PEEKER_PRESENCE_PEAK, 5)
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
    for (const stagger of [0, PEEK_SIDE_STAGGER]) {
      let prev = peekerPresence(0, false, stagger)
      for (let i = 1; i <= 5000; i++) {
        const cur = peekerPresence(i / 5000, false, stagger)
        expect(Math.abs(cur - prev)).toBeLessThan(0.02)
        prev = cur
      }
    }
  })

  it('finishes the staggered figure BEFORE the panel can unmount, at any stagger', () => {
    // `panel` goes null the instant dwell reaches 1. The stagger delays the entrance but LEADS
    // the exit, so the trailing figure is provably at 0 by then rather than being dropped
    // mid-retreat — the failure mode a trailing exit would have had.
    for (const stagger of [0, 0.02, PEEK_SIDE_STAGGER, 0.1, 0.2]) {
      expect(peekerPresence(1, false, stagger), `stagger ${stagger}`).toBe(0)
      expect(peekerPresence(0.999, false, stagger)).toBeLessThan(0.02)
    }
  })

  it('still staggers the entrance — the pair does not land in lockstep', () => {
    expect(peekerPresence(0.2, false, PEEK_SIDE_STAGGER)).toBeLessThan(peekerPresence(0.2, false, 0))
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
    const wide = peekerPlacement(HALF_H, HALF_H * 2.4, { width: 2400, height: 1000 })
    const narrow = peekerPlacement(HALF_H, HALF_H * 0.5, { width: 500, height: 1000 })
    expect(wide.x).toBeGreaterThan(narrow.x)
    expect(wide.y).toBeGreaterThan(0)
  })

  it('sizes off the frame height on wide viewports and shrinks on narrow ones', () => {
    expect(peekerSize(HALF_H, HALF_H * 1.7778)).toBeCloseTo(peekerSize(HALF_H, HALF_H * 3.2), 10)
    expect(peekerSize(HALF_H, HALF_H * 0.5)).toBeLessThan(peekerSize(HALF_H, HALF_H * 1.7778))
  })

  it('waits fully above the frame before entering, at every viewport', () => {
    for (const v of ALL) {
      const p = placeFor(v)
      for (const side of [-1, 1] as const) {
        expect(peekerReach(p, side, 1, 0).lowestY, label(v)).toBeGreaterThan(HALF_H)
      }
    }
  })

  it('parks inside the frame at every viewport', () => {
    for (const v of ALL) {
      const p = placeFor(v)
      expect(p.x).toBeLessThan((HALF_H * v.width) / v.height)
      expect(p.y).toBeLessThan(HALF_H)
      expect(p.leftY).toBeGreaterThan(0)
    }
  })
})

describe('the navigation pill — the left corner is shared UI, not free sky', () => {
  it('drops the left figure so its eye band clears the pill, wherever the left figure shows', () => {
    for (const v of ALL) {
      const p = placeFor(v)
      if (!p.leftVisible) continue
      // world height of the pill's lower edge, in the same frame the placement works in
      const pillBottomY =
        HALF_H * (1 - (2 * (PEEKER_NAV_PILL.bottom + PEEKER_NAV_PILL.pad)) / v.height)
      const cleared = p.leftY + PEEKER_FACE_TOP * p.size <= pillBottomY + 1e-9
      // On a very short frame the pill is a large share of the height and clearing it fully
      // would drive the figure into the planet, so the drop caps out instead. Either the eye
      // band clears the pill, or the drop is pinned at exactly that cap — never in between.
      const capped = Math.abs(p.leftY - (p.y - PEEKER_LEFT_MAX_DROP * p.size)) < 1e-9
      expect(cleared || capped, `${label(v)} cleared=${cleared} capped=${capped}`).toBe(true)
    }
  })

  it('never lifts the left figure above the right one', () => {
    for (const v of ALL) {
      const p = placeFor(v)
      expect(p.leftY, label(v)).toBeLessThanOrEqual(p.y + 1e-9)
      expect(peekerParkedY(p, 1)).toBe(p.y)
      expect(peekerParkedY(p, -1)).toBe(p.leftY)
    }
  })

  it('stands the left figure down on viewports too narrow for a corner to exist', () => {
    for (const v of NARROW_VIEWPORTS) expect(placeFor(v).leftVisible, label(v)).toBe(false)
    for (const v of VIEWPORTS) expect(placeFor(v).leftVisible, label(v)).toBe(true)
  })

  it('puts the cut exactly at PEEKER_LEFT_MIN_WIDTH', () => {
    const below = { width: PEEKER_LEFT_MIN_WIDTH - 1, height: 900 }
    const at = { width: PEEKER_LEFT_MIN_WIDTH, height: 900 }
    expect(placeFor(below).leftVisible).toBe(false)
    expect(placeFor(at).leftVisible).toBe(true)
  })
})

describe('planet clearance', () => {
  it('keeps every peeker visually clear of the planet, worst pose, at every viewport', () => {
    // Measured against the planet's OWN silhouette — the one a reader sees. The bench samples
    // the figure's inner edge and the entrance overshoot, i.e. the hard side of the figure.
    for (const v of ALL) {
      const gap = peekerPlanetClearance(v, CAMERA_FOV, CAMERA_DISTANCE, PLANET_RADIUS)
      expect(gap, label(v)).toBeGreaterThan(0.045)
    }
  })

  it('reaches lower at the entrance overshoot than at the parked pose', () => {
    // The settle dips 0.165·size below parked, which is why the bench sweeps the whole window
    // instead of measuring the parked pose alone. (The inward reach is NOT strictly worse at
    // the overshoot — the lean unwinds slightly there — so only the height is asserted.)
    for (const v of [
      { width: 1600, height: 900 },
      { width: 768, height: 1024 },
    ]) {
      const place = placeFor(v)
      for (const side of [-1, 1] as const) {
        const parked = peekerReach(place, side, 0, 0)
        const overshot = peekerReach(place, side, 1 - PEEKER_PRESENCE_PEAK, 0)
        expect(overshot.lowestY, label(v)).toBeLessThan(parked.lowestY)
      }
    }
  })

  it('sits behind the planet CEILING budget in depth at every viewport — the hard guarantee', () => {
    // This, not the NDC gap above, is what makes "the planet is never covered" true: no peeker
    // fragment is ever nearer the camera than the tallest thing the terrain may build.
    for (const v of ALL) {
      expect(peekerDepthMargin(v, CAMERA_FOV, CAMERA_DISTANCE, CEILING), label(v)).toBeGreaterThan(1.05)
    }
  })

  it('documents where a maximal spire could reach a peeker column (and why that is harmless)', () => {
    // Against the 1.35R ceiling BUDGET rather than the real planet, the NDC gap does go negative
    // on portrait frames: a maximal spire in that column would rise past the figure's lower
    // body. The planet then OCCLUDES the peeker, which is depth-correct — the reverse is
    // impossible by the depth margin above. Pinned so the trade-off stays visible.
    const landscape = { width: 1600, height: 900 }
    const portrait = { width: 768, height: 1024 }
    expect(peekerPlanetClearance(landscape, CAMERA_FOV, CAMERA_DISTANCE, CEILING)).toBeGreaterThan(0)
    expect(peekerPlanetClearance(portrait, CAMERA_FOV, CAMERA_DISTANCE, CEILING)).toBeLessThan(0)
    // ...and against the planet itself, the same portrait frame is clear.
    expect(
      peekerPlanetClearance(portrait, CAMERA_FOV, CAMERA_DISTANCE, PLANET_RADIUS)
    ).toBeGreaterThan(0.045)
  })

  it('is CONSERVATIVE: it never reports more separation than the figure really has', () => {
    // peekerReach minimises lowest-y and innermost-x independently over the box corners, so the
    // bench compares a point the figure never occupies — lowest AND innermost at once. That is
    // deliberate and safe (it can only under-report), but "safe direction" is a claim, so it is
    // checked here against a real surface sample: every point of the rotated box measured against
    // the ellipse in its OWN column.
    for (const v of ALL) {
      const bench = peekerPlanetClearance(v, CAMERA_FOV, CAMERA_DISTANCE, PLANET_RADIUS)
      expect(bench, label(v)).toBeLessThanOrEqual(trueSeparation(v, PLANET_RADIUS) + 1e-9)
    }
  })

  it('warns the next engineer off a phantom alarm below the swept frames', () => {
    // At 575x680 the bench reports a NEGATIVE gap while the true separation is comfortably
    // positive — pure corner-pairing artefact. Pinned so that anyone who widens the viewport
    // sweep and sees red here recognises it instead of re-tuning the staging against a figure
    // that was never there. If this ever flips, the bench got tighter, not the staging worse.
    const phantom = { width: 575, height: 680 }
    expect(peekerPlanetClearance(phantom, CAMERA_FOV, CAMERA_DISTANCE, PLANET_RADIUS)).toBeLessThan(0)
    expect(trueSeparation(phantom, PLANET_RADIUS)).toBeGreaterThan(0.05)
  })

  it('pins the worst case over the whole sweep, so drift shows up as a failure', () => {
    let worstGap = Infinity
    let worstDepth = Infinity
    for (const v of ALL) {
      worstGap = Math.min(worstGap, peekerPlanetClearance(v, CAMERA_FOV, CAMERA_DISTANCE, PLANET_RADIUS))
      worstDepth = Math.min(worstDepth, peekerDepthMargin(v, CAMERA_FOV, CAMERA_DISTANCE, CEILING))
    }
    // Tightest visual separation as the (conservative) bench reports it: iPad portrait, ~0.049
    // NDC. True separation there is ~0.090 — see the conservatism test above.
    expect(worstGap).toBeGreaterThan(0.045)
    expect(worstGap).toBeLessThan(0.09)
    // Tightest depth margin, ~1.07 world units on a square frame. NOTE the scope: this is over
    // SETTLE_HIDES, which stops at hide = 0.35 — the poses where a figure is on frame. Sweeping
    // the FULL entrance (out to hide = 1) it dips to ~1.03, while the figure is high above the
    // top edge and invisible. A future wider sweep landing near 1.03 is that, not a regression.
    expect(worstDepth).toBeGreaterThan(1.05)
    expect(worstDepth).toBeLessThan(1.3)
  })

  it('keeps the pair out of the middle of the frame, well clear of the girl on the pole', () => {
    for (const v of ALL) {
      const halfW = (HALF_H * v.width) / v.height
      const p = placeFor(v)
      for (const side of [-1, 1] as const) {
        if (side === -1 && !p.leftVisible) continue
        expect(peekerReach(p, side, 0, 0).innerX / halfW, label(v)).toBeGreaterThan(0.2)
      }
    }
  })

  it('projects the planet the way the bench assumes (silhouette, not naive radius/distance)', () => {
    expect(planetNdcRadius(CAMERA_FOV, CAMERA_DISTANCE, PLANET_RADIUS)).toBeCloseTo(0.537, 3)
    expect(planetNdcRadius(CAMERA_FOV, CAMERA_DISTANCE, CEILING)).toBeCloseTo(0.7355, 3)
  })

  it('stays well in front of the sky backdrop plane (world z = -20)', () => {
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

  it('bounds the figure box the benches rest on to something a figure could fill', () => {
    // the measured-fit assertion lives in peeker-cast.test.ts, against the real geometry
    expect(PEEKER_FIGURE_BOX.minY).toBeLessThan(0)
    expect(PEEKER_FIGURE_BOX.maxY).toBeGreaterThan(0)
    expect(PEEKER_FIGURE_BOX.absZ).toBeGreaterThan(0)
  })
})
