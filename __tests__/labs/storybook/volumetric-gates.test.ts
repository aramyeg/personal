import { describe, expect, it } from 'vitest'
import { CHAPTERS, type SceneLayer } from '@/components/labs/storybook/content'
import {
  solveBoxPose,
  solveLayerPose,
  type PanelQuad,
  type Vec3,
} from '@/components/labs/storybook/book/popup-mechanics'

// Volumetric benchmark gates C2 + C3 (spec 2026-07-11) as numeric floors.
// Capture review remains the other half of both gates — these assertions
// keep the geometry from regressing between reviews.

// Reading camera (book-scene.tsx): position (0, 2.6, 2.9) looking at
// (0, 0.32, 0.15); pointer parallax tilts the whole book group by up to
// +-TILT_X about X and +-TILT_Y about Y (doubled 2026-07-11).
const VIEW = normalize([0, 0.32 - 2.6, 0.15 - 2.9])
const TILT_X = 0.07
const TILT_Y = 0.11

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l]
}
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Outward normal of a [bl, br, tr, tl] solver quad. */
const quadNormal = (q: PanelQuad): Vec3 => normalize(cross(sub(q[1], q[0]), sub(q[3], q[0])))
const quadArea = (q: PanelQuad): number => {
  const n1 = cross(sub(q[1], q[0]), sub(q[3], q[0]))
  const n2 = cross(sub(q[3], q[2]), sub(q[1], q[2]))
  return (Math.hypot(n1[0], n1[1], n1[2]) + Math.hypot(n2[0], n2[1], n2[2])) / 2
}

/** Rotate a vector by the book tilt (rx about X, then ry about Y). */
function tilt(v: Vec3, rx: number, ry: number): Vec3 {
  const y1 = v[1] * Math.cos(rx) - v[2] * Math.sin(rx)
  const z1 = v[1] * Math.sin(rx) + v[2] * Math.cos(rx)
  return [v[0] * Math.cos(ry) + z1 * Math.sin(ry), y1, -v[0] * Math.sin(ry) + z1 * Math.cos(ry)]
}

/** How squarely a face looks at the camera under a given tilt (0 = edge-on). */
const visibility = (q: PanelQuad, rx = 0, ry = 0): number => -dot(tilt(quadNormal(q), rx, ry), VIEW)

const boxes = CHAPTERS.flatMap((c) =>
  c.layers.filter((l): l is SceneLayer & { mech: 'box' } => l.mech === 'box').map(
    (layer) => [layer.id, layer] as const
  )
)

describe('C2 three-face readability — boxes present real faces to the camera', () => {
  it.each(boxes)('%s: front and top read squarely, a side face opens under tilt', (_id, layer) => {
    const patches = solveBoxPose(layer, Math.PI, 0)
    const face = (name: string) => patches.find((p) => p.face === name)

    // Front face looks at the reading camera (the tent failure mode this
    // gate exists to prevent: faces that only ever look left/right).
    const front = face('capFrontL')!
    expect(visibility(front.quad), 'front face').toBeGreaterThan(0.25)

    // Top: painted lid / roof slopes read from the high camera; a hollow
    // box instead shows its open interior (opening normal is +Y).
    const top = face('lidL') ?? face('roofL')
    if (top) {
      expect(visibility(top.quad), 'top face').toBeGreaterThan(0.25)
    } else {
      expect(-dot([0, 1, 0], VIEW), 'open interior').toBeGreaterThan(0.25)
    }

    // Side walls are edge-on at rest by construction; under the pointer
    // tilt at least one wall must genuinely open toward the camera. The
    // floor is low because the current tilt is small — the C2 capture
    // review tracks whether "sides tell a story" needs a bigger tilt.
    let side = 0
    for (const rx of [-TILT_X, TILT_X])
      for (const ry of [-TILT_Y, TILT_Y])
        for (const wall of [face('wallL')!, face('wallR')!])
          side = Math.max(side, visibility(wall.quad, rx, ry))
    expect(side, 'side face under tilt').toBeGreaterThan(0.02)
  })
})

describe('C3 depth occupancy — pieces spread across distinct depth bands', () => {
  const SEPARATION = 0.12

  const bandsOf = (chapter: (typeof CHAPTERS)[number]): number => {
    const centroids = chapter.layers
      .map((layer) => {
        const quads =
          layer.mech === 'box'
            ? solveBoxPose(layer, Math.PI, 0).map((p) => p.quad)
            : (() => {
                const parent =
                  layer.mech === 'child'
                    ? chapter.layers.find((l) => l.id === layer.parentId)
                    : undefined
                const pose = solveLayerPose(layer, parent, Math.PI, 0)
                return [pose.right, pose.left]
              })()
        let zSum = 0
        let aSum = 0
        for (const q of quads) {
          const a = quadArea(q)
          zSum += ((q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4) * a
          aSum += a
        }
        return zSum / aSum
      })
      .sort((a, b) => a - b)
    let bands = 0
    let lastMax = -Infinity
    for (const z of centroids) {
      if (z - lastMax > SEPARATION) bands++
      lastMax = Math.max(lastMax, z)
    }
    return bands
  }

  it('every chapter spread meets its depth-band ratchet (target: 4 everywhere)', () => {
    // Measured 2026-07-11 (box-fold iteration 1). Spreads 3 (Chapter II,
    // airy by design) and 7 (Chapter VI, waits on the treasury box +
    // founders standee) sit at 3 — they ratchet UP to 4 as those
    // compositions land; every other spread must never drop below 4.
    const RATCHET: Record<number, number> = { 2: 4, 3: 3, 4: 4, 5: 4, 6: 4, 7: 3 }
    for (const chapter of CHAPTERS) {
      expect(bandsOf(chapter), `spread ${chapter.spread} depth bands`).toBeGreaterThanOrEqual(
        RATCHET[chapter.spread]
      )
    }
  })
})
