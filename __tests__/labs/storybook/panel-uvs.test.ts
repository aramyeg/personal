import { describe, expect, it } from 'vitest'
import { dieFlipped, panelUvs } from '@/components/labs/storybook/book/popup-spread'
import { CHAPTERS, type SceneLayer } from '@/components/labs/storybook/content'

// Art orientation is this project's recurring bug class (the page prints
// rendered upside down, then the tents, then whole families of children).
// The rule under test: a die is printed rotated 180 degrees exactly when
// its REST-pose v-axis points down-screen from the fixed reading camera —
// no static vDir/mechanism rule covers all cases (a child of a deep-V
// parent tips past vertical while the same geometry on a wall stands up).

const layersOf = (spread: number) => CHAPTERS.find((c) => c.spread === spread)!.layers
const byId = (layers: readonly SceneLayer[], id: string) => {
  const layer = layers.find((l) => l.id === id)!
  const parent = layer.mech === 'child' ? layers.find((l) => l.id === layer.parentId) : undefined
  return { layer, parent }
}

const vAt = (uvs: Float32Array, corner: number) => uvs[corner * 2 + 1]
const uAt = (uvs: Float32Array, corner: number) => uvs[corner * 2]

describe('dieFlipped — rest-pose screen-up rule, pinned to user-verified pieces', () => {
  it('children of deep-V parents tip past vertical and need the flip', () => {
    // User-reported upside down 2026-07-11: sign, dormer, lantern (inn and
    // arch are deep-V parents — child fold elevation lambda > 90deg). The
    // sign has since become a freestanding v-fold; the dormer still pins
    // the inn's deep-V case.
    for (const [spread, id] of [
      [2, 'ch1-dormer'],
      // bee-b re-homed to the deep-V hero in D5 (it was 100% swallowed as a
      // backdrop child) — it now tips past vertical like its sibling bee-c.
      [3, 'ch2-bee-b'],
      [6, 'ch5-lantern'],
      // ch6-banner retired with the treasury exterior (E3 s7 nave rebuild);
      // the deep-V child case stays pinned by the dormer/bee/lantern trio.
    ] as const) {
      const { layer, parent } = byId(layersOf(spread), id)
      expect(dieFlipped(layer, parent), id).toBe(true)
    }
  })

  it('hanging children (coins) need the flip', () => {
    // ch6-door (the other hanging child) retired with the treasury exterior
    // (E3 s7 nave rebuild); the coins still pin the hanging case.
    for (const [spread, id] of [[5, 'ch4-coins']] as const) {
      const { layer, parent } = byId(layersOf(spread), id)
      expect(dieFlipped(layer, parent), id).toBe(true)
    }
  })

  it('children of near-flat wall parents stand upright — no flip', () => {
    // User-verified upright: bees on the alpine ridge. (The ch3 rookery
    // children — the balcony and its ravens — retired in the E1 keep rebuild;
    // the near-flat-wall upright case is now carried by the alpine bee.)
    for (const [spread, id] of [[3, 'ch2-bee-a']] as const) {
      const { layer, parent } = byId(layersOf(spread), id)
      expect(dieFlipped(layer, parent), id).toBe(false)
    }
  })

  it('page-glued v-folds never flip (standing validity keeps their crease up)', () => {
    for (const chapter of CHAPTERS) {
      for (const layer of chapter.layers) {
        if (layer.mech !== 'vfold') continue
        expect(dieFlipped(layer, undefined), layer.id).toBe(false)
      }
    }
  })
})

describe('panelUvs orientation', () => {
  const { layer: upChild, parent: upParent } = byId(layersOf(3), 'ch2-bee-a')

  it('standing pieces put the image top (v=1) on the free edge', () => {
    for (const side of ['right', 'left'] as const) {
      const uvs = panelUvs(upChild, side, dieFlipped(upChild, upParent))
      expect(vAt(uvs, 0)).toBe(0) // base corners sample the image bottom
      expect(vAt(uvs, 1)).toBe(0)
      expect(vAt(uvs, 2)).toBe(1) // free corners sample the image top
      expect(vAt(uvs, 3)).toBe(1)
    }
  })

  it('flipped dies rotate 180deg — a true rotation, not a mirror', () => {
    for (const side of ['right', 'left'] as const) {
      const up = panelUvs(upChild, side, false)
      const down = panelUvs(upChild, side, true)
      for (let corner = 0; corner < 4; corner++) {
        expect(uAt(down, corner)).toBeCloseTo(1 - uAt(up, corner), 12)
        expect(vAt(down, corner)).toBeCloseTo(1 - vAt(up, corner), 12)
      }
    }
  })

  it('parallel strips put the image top (v=1) at z0 — the far, up-screen edge', () => {
    // No shipped piece is a parallel tent anymore (all demoted to boxes by
    // the volumetric covenant), so the mapping is pinned on a synthetic
    // strip — the mechanism stays available.
    const tent: SceneLayer = {
      id: 'synthetic-tent',
      kind: 'backdrop',
      role: 'scenery',
      mech: 'parallel',
      glueL: 0.25,
      glueR: 0.41,
      rise: 0.1,
      z0: 0.26,
      z1: 0.66,
    }
    for (const side of ['right', 'left'] as const) {
      const uvs = panelUvs(tent, side)
      // corner order: [...@z0, ...@z1, ...@z1, ...@z0]
      expect(vAt(uvs, 0)).toBe(1) // z0 corners sample the image top
      expect(vAt(uvs, 3)).toBe(1)
      expect(vAt(uvs, 1)).toBe(0) // z1 corners (near the reader) the bottom
      expect(vAt(uvs, 2)).toBe(0)
    }
  })

  it('the fold seam stays on the crease/ridge corners in both orientations', () => {
    for (const flipped of [false, true]) {
      for (const side of ['right', 'left'] as const) {
        const uvs = panelUvs(upChild, side, flipped)
        expect(uAt(uvs, 0)).toBeCloseTo(0.5, 12) // center-fold child
        expect(uAt(uvs, 3)).toBeCloseTo(0.5, 12)
      }
    }
  })
})
