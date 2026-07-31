import { describe, expect, it } from 'vitest'
import { DESK_NOTE, DESK_PROPS, DESK_TOP_Y, journeyFloorY } from '@/components/labs/small-world/scene/desk-stage'
import { deskNoteShadowPart, deskPropParts } from '@/components/labs/small-world/scene/props/desk-kit'
import { buildMergedClay } from '@/components/labs/small-world/scene/props/clay-kit'

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
