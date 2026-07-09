import { describe, expect, it } from 'vitest'
import { buildVoxelGrid, GRID_H, GRID_W, type Voxel } from '@/components/labs/memory-card/lib/voxel-grid'

/**
 * Same per-channel blend formula the module uses (out = round(fg*a + bg*(1-a))),
 * reimplemented here so the neck-shadow assertion doesn't rely on a
 * hand-derived hex constant that could itself be wrong.
 */
function blend(fg: [number, number, number], a: number, bgHex: string): string {
  const bh = bgHex.replace('#', '')
  const bg: [number, number, number] = [
    parseInt(bh.slice(0, 2), 16),
    parseInt(bh.slice(2, 4), 16),
    parseInt(bh.slice(4, 6), 16),
  ]
  const out = fg.map((c, i) => Math.round(c * a + bg[i] * (1 - a)))
  return `#${out.map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

function cellAt(voxels: Voxel[], x: number, y: number): Voxel | undefined {
  return voxels.find((v) => v.x === x && v.y === y)
}

describe('voxel grid', () => {
  it('is deterministic across calls', () => {
    expect(buildVoxelGrid()).toEqual(buildVoxelGrid())
  })

  it('keeps every voxel within grid bounds', () => {
    for (const v of buildVoxelGrid()) {
      expect(v.x).toBeGreaterThanOrEqual(0)
      expect(v.x).toBeLessThan(GRID_W)
      expect(v.y).toBeGreaterThanOrEqual(0)
      expect(v.y).toBeLessThan(GRID_H)
    }
  })

  it('paints a dense figure', () => {
    expect(buildVoxelGrid().length).toBeGreaterThan(400)
  })

  it('paints the pupil over the eye white', () => {
    const voxels = buildVoxelGrid()
    expect(cellAt(voxels, 12, 7)?.color).toBe('#1c1917')
  })

  it('leaves the eye white where the pupil does not cover it', () => {
    const voxels = buildVoxelGrid()
    expect(cellAt(voxels, 11, 7)?.color).toBe('#fafaf9')
  })

  it('blends the neck shadow over the face color', () => {
    const voxels = buildVoxelGrid()
    const expected = blend([217, 168, 120], 0.7, '#eec9a2')
    expect(cellAt(voxels, 13, 14)?.color).toBe(expected)
  })

  it('never defaults a cell to plain white', () => {
    for (const v of buildVoxelGrid()) {
      expect(v.color).not.toBe('#ffffff')
    }
  })
})
