import { describe, expect, it } from 'vitest'
import {
  DESK_BACK_Z,
  DESK_NEAR_Z,
  DESK_NOTE,
  DESK_PROPS,
  DESK_HALF_W,
  DESK_TOP_Y,
  EDGE_WOBBLE,
  journeyFloorY,
} from '@/components/labs/small-world/scene/desk-stage'
import { buildSlab, edgeOffset } from '@/components/labs/small-world/scene/props/desk-set'
import { deskNoteShadowPart, deskPropParts } from '@/components/labs/small-world/scene/props/desk-kit'
import { buildMergedClay } from '@/components/labs/small-world/scene/props/clay-kit'
import { noteRepaintAllowed } from '@/components/labs/small-world/scene/props/desk-note'
import {
  TRACK_END,
  ZOOM_FIRST_MOVE,
  endingStateAt,
} from '@/components/labs/small-world/ending-timeline'
import {
  CAMERA_POSITION,
  cameraPositionAt,
} from '@/components/labs/small-world/scene/camera'

/**
 * THE OTHER HALF OF THE CONTAINMENT PROOF (Task 65).
 *
 * `desk-stage.test.ts` proves that the heights `DESK_PROPS` publishes are outside the journey
 * camera's frustum. That is a statement about a data file. This one measures the geometry the
 * builders actually emit and holds it to the same numbers, which is what makes the pair a statement
 * about the scene: a mug whose handle overshot its published `top` by a hair, or a lamp shade whose
 * rotation swung it up rather than down, would sail through the placement suite and put clay in
 * frame during chapter three.
 *
 * Measured against the WORLD-space vertices, not the local ones, because `deskPropParts` bakes the
 * placement into the geometry — so this reads exactly the numbers the GPU gets.
 */

function bounds(parts: ReturnType<typeof deskPropParts>) {
  let maxY = -Infinity
  let minY = Infinity
  let minZ = Infinity
  for (const part of parts) {
    const pos = part.geo.attributes.position.array as ArrayLike<number>
    for (let i = 0; i < pos.length; i += 3) {
      maxY = Math.max(maxY, pos[i + 1])
      minY = Math.min(minY, pos[i + 1])
      minZ = Math.min(minZ, pos[i + 2])
    }
  }
  return { maxY, minY, minZ }
}

describe('the desk kit builds to the heights it publishes', () => {
  it.each(DESK_PROPS.map((p, i) => [`${p.kind}#${i}`, p] as const))(
    '%s tops out at or below its published top',
    (_label, p) => {
      const { maxY, minY } = bounds(deskPropParts(p))
      // Float32 vertex data: the tolerance is the storage format's, not a fudge factor
      expect(maxY).toBeLessThanOrEqual(DESK_TOP_Y + p.top + 1e-5)
      // and it is not a stub that happens to fit: it uses most of the height it claimed
      expect(maxY).toBeGreaterThan(DESK_TOP_Y + p.top * 0.88)
      // nothing sinks through the desk surface
      expect(minY).toBeGreaterThan(DESK_TOP_Y - 0.02)
    }
  )

  it.each(DESK_PROPS.map((p, i) => [`${p.kind}#${i}`, p] as const))(
    '%s keeps every vertex under the journey camera, not just its tallest one',
    (_label, p) => {
      // the end-to-end claim, per vertex: this is the assertion that would fail if a builder grew
      // sideways into shallower headroom rather than upward
      for (const part of deskPropParts(p)) {
        const pos = part.geo.attributes.position.array as ArrayLike<number>
        for (let i = 0; i < pos.length; i += 3) {
          expect(pos[i + 1]).toBeLessThan(journeyFloorY(pos[i + 2]))
        }
      }
    }
  )

  it('reaches no further back than the prop declared, so the placement gate is honest', () => {
    for (const p of DESK_PROPS) {
      const { minZ } = bounds(deskPropParts(p))
      expect(minZ, `${p.kind} at z=${p.z} reaches behind its declared backReach`).toBeGreaterThanOrEqual(
        p.z - p.backReach - 1e-5
      )
    }
  })

  it("keeps the note's own shadow under the camera too", () => {
    const pos = deskNoteShadowPart(DESK_NOTE).geo.attributes.position.array as ArrayLike<number>
    for (let i = 0; i < pos.length; i += 3) {
      expect(pos[i + 1]).toBeLessThan(journeyFloorY(pos[i + 2]))
    }
  })

  it('merges the whole set into ONE vertex-coloured geometry', () => {
    const merged = buildMergedClay([
      deskNoteShadowPart(DESK_NOTE),
      ...DESK_PROPS.flatMap(deskPropParts),
    ])
    expect(merged.attributes.position.count).toBeGreaterThan(0)
    expect(merged.attributes.color.count).toBe(merged.attributes.position.count)
    expect(merged.attributes.normal.count).toBe(merged.attributes.position.count)
    expect(merged.index).toBeNull()
    // the whole desk set is two draws plus the note — a budget claim worth a number
    expect(merged.attributes.position.count).toBeLessThan(60_000)
  })
})

/**
 * THE SLAB, held to the same standard as everything standing on it.
 *
 * Review's finding: `buildSlab` was the one piece of geometry in the set whose emitted vertices no
 * test read. The frustum sweep in `desk-stage.test.ts` tests the ANALYTIC plane — `y = DESK_TOP_Y`
 * over `z in [DESK_BACK_Z, DESK_NEAR_Z]` — which bounds the shipped slab only because the shipped
 * slab happens to be strictly safer: `roll` lowers the back row, and `edgeOffset` is non-negative.
 * And `edgeOffset` is non-negative purely because its three amplitudes sum to exactly 1, which is
 * the kind of fact that survives right up until somebody retunes one of them.
 */
describe('the slab is measured, not assumed', () => {
  it('has a hand-formed edge that can only wander FORWARD', () => {
    // the coincidence, asserted: sample far wider than the slab is, so a retuned amplitude cannot
    // hide in the gaps
    let lo = Infinity
    let hi = -Infinity
    for (let i = 0; i <= 200_000; i++) {
      const x = -200 + (i / 200_000) * 400
      const v = edgeOffset(x)
      lo = Math.min(lo, v)
      hi = Math.max(hi, v)
    }
    expect(lo).toBeGreaterThanOrEqual(0)
    expect(hi).toBeLessThanOrEqual(EDGE_WOBBLE)
    // and it really uses its range — a wobble pinned near one end is a straight edge
    expect(hi - lo).toBeGreaterThan(EDGE_WOBBLE * 0.7)
  })

  it('emits no vertex behind the back edge, above the surface, or inside the camera', () => {
    const geo = buildSlab()
    const pos = geo.attributes.position.array as ArrayLike<number>
    expect(pos.length).toBeGreaterThan(0)
    let minZ = Infinity
    let maxZ = -Infinity
    let maxY = -Infinity
    for (let i = 0; i < pos.length; i += 3) {
      const y = pos[i + 1]
      const z = pos[i + 2]
      minZ = Math.min(minZ, z)
      maxZ = Math.max(maxZ, z)
      maxY = Math.max(maxY, y)
      // the end-to-end claim, per vertex, against the same line the placement suite uses
      expect(y).toBeLessThan(journeyFloorY(z))
    }
    expect(minZ).toBeGreaterThanOrEqual(DESK_BACK_Z - 1e-5)
    expect(maxZ).toBeLessThanOrEqual(DESK_NEAR_Z + 1e-5)
    expect(maxY).toBeLessThanOrEqual(DESK_TOP_Y + 1e-5)
    geo.dispose()
  })

  it('spans the width it advertises, so the no-side-edge proof is about this slab', () => {
    const geo = buildSlab()
    const pos = geo.attributes.position.array as ArrayLike<number>
    let minX = Infinity
    let maxX = -Infinity
    for (let i = 0; i < pos.length; i += 3) {
      minX = Math.min(minX, pos[i])
      maxX = Math.max(maxX, pos[i])
    }
    expect(maxX).toBeCloseTo(DESK_HALF_W, 4)
    expect(minX).toBeCloseTo(-DESK_HALF_W, 4)
    geo.dispose()
  })
})

/**
 * THE NOTE'S DEFERRED REPAINT (fix round, review finding 1).
 *
 * A late webfont upgrades the note's texture, and that upgrade must never be visible. The gate is
 * `ending.zoom === 0`, and its safety is not a margin — it is two proofs meeting exactly:
 *
 *   at zoom 0  ->  the camera pose is bit-identical to the static pose   (ending-camera.test.ts)
 *   static pose ->  every vertex of the sheet is out of frame            (desk-stage.test.ts)
 *
 * This holds the join. If a future edit let the gate open one frame into the pull-back, the second
 * implication stops applying and this fails.
 */
describe("the note's late-font upgrade can only happen off camera", () => {
  it('opens exactly where the camera is still at its static pose, and nowhere else', () => {
    for (let i = 0; i <= 4000; i++) {
      const progress = (i / 4000) * TRACK_END
      const ending = endingStateAt(progress)
      if (noteRepaintAllowed(ending)) {
        // the pose the containment proof is about — bit-identity, not closeness
        const pose = cameraPositionAt(progress)
        expect(Object.is(pose[0], CAMERA_POSITION[0])).toBe(true)
        expect(Object.is(pose[1], CAMERA_POSITION[1])).toBe(true)
        expect(Object.is(pose[2], CAMERA_POSITION[2])).toBe(true)
      } else {
        expect(ending.zoom).toBeGreaterThan(0)
      }
    }
  })

  it('is open for the whole journey and the whole still beat, and shut after', () => {
    expect(noteRepaintAllowed(endingStateAt(0))).toBe(true)
    expect(noteRepaintAllowed(endingStateAt(1))).toBe(true)
    expect(noteRepaintAllowed(endingStateAt(ZOOM_FIRST_MOVE))).toBe(true)
    expect(noteRepaintAllowed(endingStateAt(ZOOM_FIRST_MOVE + 1e-6))).toBe(false)
    expect(noteRepaintAllowed(endingStateAt(TRACK_END))).toBe(false)
  })
})
