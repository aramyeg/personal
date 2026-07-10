import { describe, expect, it } from 'vitest'
import { panelUvs } from '@/components/labs/storybook/book/popup-spread'
import type { SceneLayer } from '@/components/labs/storybook/content'

// Art orientation is this project's recurring bug class (the page prints
// rendered upside down, then the hanging children did). These tests pin the
// texture-v convention per mechanism: under three's default flipY, v=1 is
// the image's TOP row, and the image top must always render at the
// physically HIGHEST edge of the piece.
//
// PanelQuad corner order: [base-inner, base-outer, free-outer, free-inner],
// where "base" is the glue edge and "free" the die-cut's far edge. For
// standing pieces the free edge is up; for a HANGING child (vDir -1, glued
// under its parent's crease) the free edge is the LOWEST — its die is
// printed rotated 180 degrees, like a fabricator would rotate it before
// gluing.

const vfold: SceneLayer = {
  id: 't-vfold', kind: 'hero', mech: 'vfold',
  apexZ: 0, vDir: 1, phiDeg: 52, rhoDeg: 80, creaseU: 0.4, width: 1, height: 1,
}
const standingChild: SceneLayer = {
  id: 't-up', kind: 'hero', mech: 'child', parentId: 't-vfold',
  mount: 0.3, vDir: 1, phiDeg: 60, rhoDeg: 83, width: 0.2, height: 0.2,
}
const hangingChild: SceneLayer = { ...standingChild, id: 't-down', vDir: -1 }

const vAt = (uvs: Float32Array, corner: number) => uvs[corner * 2 + 1]
const uAt = (uvs: Float32Array, corner: number) => uvs[corner * 2]

describe('panelUvs orientation', () => {
  it('standing pieces put the image top (v=1) on the free edge', () => {
    for (const layer of [vfold, standingChild]) {
      for (const side of ['right', 'left'] as const) {
        const uvs = panelUvs(layer, side)
        expect(vAt(uvs, 0)).toBe(0) // base corners sample the image bottom
        expect(vAt(uvs, 1)).toBe(0)
        expect(vAt(uvs, 2)).toBe(1) // free corners sample the image top
        expect(vAt(uvs, 3)).toBe(1)
      }
    }
  })

  it('hanging children (vDir -1) print rotated 180deg: image top at the glue edge', () => {
    for (const side of ['right', 'left'] as const) {
      const uvs = panelUvs(hangingChild, side)
      expect(vAt(uvs, 0)).toBe(1) // base (mount, physically highest) = image top
      expect(vAt(uvs, 1)).toBe(1)
      expect(vAt(uvs, 2)).toBe(0) // free edge (hanging low) = image bottom
      expect(vAt(uvs, 3)).toBe(0)
    }
  })

  it('the rotation is a true rotation, not a mirror: u flips with v', () => {
    // Rotating (u,v) -> (1-u, 1-v) must land each panel's crease corners on
    // the art's fold line and swap the outer edges across it.
    const up = panelUvs(standingChild, 'right')
    const down = panelUvs(hangingChild, 'right')
    for (let corner = 0; corner < 4; corner++) {
      expect(uAt(down, corner)).toBeCloseTo(1 - uAt(up, corner), 12)
      expect(vAt(down, corner)).toBeCloseTo(1 - vAt(up, corner), 12)
    }
  })

  it('the fold seam stays on the crease corners in both orientations (center-fold children)', () => {
    for (const layer of [standingChild, hangingChild]) {
      for (const side of ['right', 'left'] as const) {
        const uvs = panelUvs(layer, side)
        expect(uAt(uvs, 0)).toBeCloseTo(0.5, 12) // base-inner rides the crease
        expect(uAt(uvs, 3)).toBeCloseTo(0.5, 12) // free-inner rides the crease
      }
    }
  })
})
