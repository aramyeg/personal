import { describe, expect, it } from 'vitest'
import { parallaxLift } from '@/components/labs/storybook/book/parallax-lift'

// The rig's cover footprint (book-scene.tsx COVER_FOOTPRINT_HALF_W/D, mirroring
// book.tsx's BOOK.coverW / BOOK.coverH) — kept as literals here rather than
// importing book.tsx, which pulls in three.js/@react-three/fiber; this test
// stays three-free like the rig's other pure math (page-geometry.test.ts).
const HALF_W = 1.22 // BOOK.coverW
const HALF_D = 0.79 // BOOK.coverH / 2

/** Independent reimplementation of the rig's rotation (three's default
 *  'XYZ' Euler, rotation.z = 0), applied by hand rather than reusing the
 *  module under test — so a sign error in parallaxLift's own rotation math
 *  can't also hide in the check. */
function rotateY(rx: number, ry: number, x: number, z: number): number {
  const a = Math.cos(rx)
  const b = Math.sin(rx)
  const c = Math.cos(ry)
  const d = Math.sin(ry)
  // 'XYZ' rotation matrix, y-row, with rotation.z = 0 (see book-scene.tsx's
  // ParallaxRig): y' = b*d*x + a*0 - b*c*z (the point's own y is 0).
  return b * d * x - b * c * z
}

const CORNERS: readonly (readonly [number, number])[] = [
  [HALF_W, HALF_D],
  [HALF_W, -HALF_D],
  [-HALF_W, HALF_D],
  [-HALF_W, -HALF_D],
]

describe('parallaxLift', () => {
  it('is zero at zero tilt — no lift needed at rest', () => {
    expect(parallaxLift(0, 0, HALF_W, HALF_D)).toBe(0)
  })

  it('stays zero when only the untilted axis is nonzero (sin(rx)=0 kills every corner term)', () => {
    expect(parallaxLift(0, 0.11, HALF_W, HALF_D)).toBe(0)
  })

  it('is positive once pitched forward (rotation.x > 0, the reported bug)', () => {
    expect(parallaxLift(0.07, 0, HALF_W, HALF_D)).toBeGreaterThan(0)
    expect(parallaxLift(0.07, 0.11, HALF_W, HALF_D)).toBeGreaterThan(0)
  })

  it('exactly cancels the deepest corner: every rotated corner lands at y >= 0 after the lift', () => {
    const rx = 0.07
    const ry = 0.11
    const lift = parallaxLift(rx, ry, HALF_W, HALF_D)
    for (const [x, z] of CORNERS) {
      const cornerY = rotateY(rx, ry, x, z) + lift
      expect(cornerY).toBeGreaterThanOrEqual(0)
    }
    // The deepest corner clears by only the pure-clearance hair, not a huge
    // margin — the lift isn't overcompensating.
    const deepest = Math.min(...CORNERS.map(([x, z]) => rotateY(rx, ry, x, z)))
    expect(deepest + lift).toBeLessThan(0.01)
  })

  it('is symmetric in the sign of each rotation axis — tilting either way dips a mirror corner by the same amount', () => {
    const rx = 0.05
    const ry = 0.08
    expect(parallaxLift(-rx, ry, HALF_W, HALF_D)).toBeCloseTo(parallaxLift(rx, ry, HALF_W, HALF_D), 10)
    expect(parallaxLift(rx, -ry, HALF_W, HALF_D)).toBeCloseTo(parallaxLift(rx, ry, HALF_W, HALF_D), 10)
  })

  it('grows with steeper forward pitch (monotonic in |rotation.x| over the rig’s actual tilt range)', () => {
    const ry = 0.11
    let prev = parallaxLift(0, ry, HALF_W, HALF_D)
    for (let rx = 0.01; rx <= 0.07; rx += 0.01) {
      const lift = parallaxLift(rx, ry, HALF_W, HALF_D)
      expect(lift).toBeGreaterThan(prev)
      prev = lift
    }
  })

  it('composes with the H5 grab freeze for free: re-evaluating the same held rotation returns the same lift', () => {
    // The rig derives the lift from group.rotation.x/y AFTER the ease step,
    // so a frozen rotation (H5: target := current rotation while grabbed)
    // keeps producing an identical lift frame over frame — nothing to jump.
    const rx = 0.04
    const ry = -0.06
    const first = parallaxLift(rx, ry, HALF_W, HALF_D)
    const second = parallaxLift(rx, ry, HALF_W, HALF_D)
    expect(second).toBe(first)
  })
})
