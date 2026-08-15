import { describe, expect, it } from 'vitest'
import { fitToStage, type Vec3 } from '@/components/labs/memory-card/lib/fit-model'

/**
 * Post-scale placement of a box corner under a FitResult, reimplemented here so
 * the assertions don't lean on the same expression the module uses: a raw point
 * p maps to `scale * p + offset`.
 */
function place(p: Vec3, scale: number, offset: Vec3): Vec3 {
  return [
    scale * p[0] + offset[0],
    scale * p[1] + offset[1],
    scale * p[2] + offset[2],
  ]
}

describe('fitToStage', () => {
  it('scales a 2x4x2 box to the target height and rests it on the floor', () => {
    // Box 2x4x2 centered at (1, 3, -1) → min (0,1,-2), max (2,5,0).
    const min: Vec3 = [0, 1, -2]
    const max: Vec3 = [2, 5, 0]

    const { scale, offset } = fitToStage(min, max, 2, 0)

    // height 4 → scale 2/4 = 0.5.
    expect(scale).toBe(0.5)
    // offset centers x/z (−scale·center) and rests bottom on floor (0 − scale·min.y).
    //   x: −0.5·1 = −0.5   y: 0 − 0.5·1 = −0.5   z: −0.5·(−1) = 0.5
    expect(offset).toEqual([-0.5, -0.5, 0.5])

    // Invariants: bottom-center corner lands at (0, 0, 0), top at y = fitHeight.
    expect(place([1, 1, -1], scale, offset)).toEqual([0, 0, 0])
    expect(place([1, 5, -1], scale, offset)[1]).toBeCloseTo(2)
  })

  it('leaves a zero-height (degenerate) box at scale 1', () => {
    // Flat box on the y = 2 plane → height 0.
    const { scale } = fitToStage([0, 2, 0], [4, 2, 4], 3, 0)
    expect(scale).toBe(1)
  })

  it('rests the box bottom on a non-zero floorY', () => {
    // Box 2x2x2 centered at (1, 2, 1) → min (0,1,0), max (2,3,2).
    const min: Vec3 = [0, 1, 0]
    const max: Vec3 = [2, 3, 2]

    const { scale, offset } = fitToStage(min, max, 4, 0.5)

    // height 2 → scale 4/2 = 2.
    expect(scale).toBe(2)
    //   x: −2·1 = −2   y: 0.5 − 2·1 = −1.5   z: −2·1 = −2
    expect(offset).toEqual([-2, -1.5, -2])

    // Bottom-center corner sits on the floor plane at y = 0.5, centered on x/z.
    expect(place([1, 1, 1], scale, offset)).toEqual([0, 0.5, 0])
  })
})
