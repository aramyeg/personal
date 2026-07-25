import { describe, expect, it } from 'vitest'
import { CHAPTERS, type SceneLayer } from '@/components/labs/storybook/content'
import {
  solveBoxPose,
  solveParallelPose,
  solveStripFlapPose,
  solveVFoldPose,
  solveChildPose,
  type PanelQuad,
  type Vec3,
} from '@/components/labs/storybook/book/popup-mechanics'
import {
  solvePlatformPose,
  solveFanPose,
  solveRiderPose,
  solveDressPose,
  type PlatformPatch,
} from '@/components/labs/storybook/book/popup-anatomy'
import { solveTabPiecePose } from '@/components/labs/storybook/book/popup-tabpiece'
import { solveKineticArmPose } from '@/components/labs/storybook/book/popup-kinetic'
import { solveRotorPose } from '@/components/labs/storybook/book/popup-rotor'
import { solveKnobTowerPose, knobTowerThetaMax } from '@/components/labs/storybook/book/popup-knobtower'
import { keepsakeCardInPlane } from '@/components/labs/storybook/book/popup-keepsake'
import { keepStackQuads } from '@/components/labs/storybook/book/popup-keepstack'
import { keepWinchOutputQuads, keepWinchThetaMax } from '@/components/labs/storybook/book/popup-keepwinch'
import { solveLiftFlapPose } from '@/components/labs/storybook/book/popup-liftflap'
import { solveDissolvePose } from '@/components/labs/storybook/book/popup-dissolve'
import { keepSkylineQuads } from '@/components/labs/storybook/book/popup-skyline'
import { swarmArcQuads } from '@/components/labs/storybook/book/popup-swarmarc'

// Volumetric benchmark gates C2 + C3, RAISED to Part C v2 (spec 2026-07-11)
// as numeric floors. Capture review remains the other half of both gates —
// these assertions keep the geometry from regressing between reviews now
// that platforms, fans, riders and dress patches share the stage.

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

// Every layer's world quads at a given pose — one entry point across all six
// mechanism families, so the depth histogram sees the whole assembly.
const seatQuad = (
  l: SceneLayer & { parentId: string; seat: string },
  layers: readonly SceneLayer[],
  tL: number,
  tR: number
): PanelQuad => {
  const parent = layers.find((p) => p.id === l.parentId)!
  if (parent.mech === 'vfold') {
    const pose = solveVFoldPose(parent, tL, tR)
    return l.seat === 'left' ? pose.left : pose.right
  }
  if (parent.mech === 'box') return solveBoxPose(parent, tL, tR).find((p) => p.face === l.seat)!.quad
  if (parent.mech === 'platform') {
    return solvePlatformPose(parent, tL, tR).find((p: PlatformPatch) => p.face === l.seat)!.quad
  }
  throw new Error(`${l.mech} ${l.id}: unsupported parent ${parent.mech}`)
}
const poseQuads = (l: SceneLayer, layers: readonly SceneLayer[], tL: number, tR: number): PanelQuad[] => {
  switch (l.mech) {
    case 'box':
      return solveBoxPose(l, tL, tR).map((p) => p.quad)
    case 'platform':
      return solvePlatformPose(l, tL, tR).map((p) => p.quad)
    case 'fan':
      return solveFanPose(l, tL, tR).flatMap((p) => [p.right, p.left])
    case 'rider': {
      const parent = layers.find((p) => p.id === l.parentId) as SceneLayer & {
        mech: 'box' | 'platform' | 'parallel'
      }
      const pose = solveRiderPose(l, parent, tL, tR)
      return [pose.right, pose.left]
    }
    case 'dress':
      return [solveDressPose(l, seatQuad(l, layers, tL, tR))]
    case 'rotor':
      return [solveRotorPose(l, seatQuad(l, layers, tL, tR), tL - tR)]
    case 'child': {
      const parent = layers.find((p) => p.id === l.parentId) as SceneLayer & { mech: 'vfold' }
      const pose = solveChildPose(l, solveVFoldPose(parent, tL, tR))
      return [pose.right, pose.left]
    }
    case 'vfold': {
      const pose = solveVFoldPose(l, tL, tR)
      return [pose.right, pose.left]
    }
    case 'parallel': {
      const pose = solveParallelPose(l, tL, tR)
      return [pose.right, pose.left]
    }
    case 'stripflap': {
      const pose = solveStripFlapPose(l, tL, tR)
      return [pose.right, pose.left]
    }
    case 'tabpiece':
      return solveTabPiecePose(l, tL, tR).map((p) => p.quad)
    case 'knobtower':
      // No theta channel in the depth/readability gates — pose at full erect
      // (THETA_MAX), the worst-case footprint, conservative for occupancy.
      return solveKnobTowerPose(l, knobTowerThetaMax(l), tL, tR).map((p) => p.quad)
    case 'keepsake':
      // No pull channel in the depth gates — pose the card HOME (p=0), coplanar
      // in its sleeve, its resting depth footprint.
      return [keepsakeCardInPlane(l, 0, tL, tR)]
    case 'keepstack':
      // The keep expands to three stacked box poses plus the balcony deck, the
      // fan spire members + the raven finial — its whole depth footprint
      // (popup-keepstack.ts).
      return keepStackQuads(l, tL, tR)
    case 'keepwinch':
      // No theta channel in the depth gates — pose the outputs at full erect
      // (THETA_MAX), the worst-case footprint (the disc is a coplanar handle,
      // excluded like the knob-tower disc).
      return keepWinchOutputQuads(l, keepWinchThetaMax(l), tL, tR)
    case 'skyline':
      return keepSkylineQuads(l, tL, tR)
    case 'swarmarc':
      // Radial-hinge strut ring + riders at stir 0 — its whole depth footprint.
      return swarmArcQuads(l, tL, tR)
    case 'kinetic': {
      const pose = solveKineticArmPose(l, tL, tR)
      return [pose.right, pose.left]
    }
    case 'liftflap': {
      // No lift channel in the depth gates — pose every door SHUT (the resting
      // coplanar footprint); the static board dominates the occupancy centroid.
      const pose = solveLiftFlapPose(l, [], tL, tR)
      return [pose.board, ...pose.doors]
    }
    case 'dissolve': {
      // No flip channel in the depth gates — pose flat (dunes, tau=0): the sand
      // base + the coplanar slats + the flush tab, the resting depth footprint.
      const pose = solveDissolvePose(l, 0, tL, tR)
      return [pose.base, ...pose.slats, pose.tab]
    }
    default:
      throw new Error(`poseQuads: unhandled mech ${(l as SceneLayer).mech}`)
  }
}

// A dependent piece rides another's paper: children ride their parent v-fold,
// riders their host box/platform, dress patches and rotors their seat panel.
// They may JOIN a plane or form their own, but never BRIDGE two.
const isDependent = (l: SceneLayer): boolean =>
  l.mech === 'child' || l.mech === 'rider' || l.mech === 'dress' || l.mech === 'rotor'

const boxes = CHAPTERS.flatMap((c) =>
  c.layers.filter((l): l is SceneLayer & { mech: 'box' } => l.mech === 'box').map(
    (layer) => [layer.id, layer] as const
  )
)
const platforms = CHAPTERS.flatMap((c) =>
  c.layers.filter((l): l is SceneLayer & { mech: 'platform' } => l.mech === 'platform').map(
    (layer) => [layer.id, layer] as const
  )
)

describe('C2 three-face readability — boxes present real faces to the camera', () => {
  it.each(boxes)('%s: front and top read squarely, a side face opens under tilt', (_id, layer) => {
    const patches = solveBoxPose(layer, Math.PI, 0)
    const face = (name: string) => patches.find((p) => p.face === name)

    // Front read toward the camera (the tent failure mode this gate
    // exists to prevent: faces that only ever look left/right). A closed
    // box presents its painted front cap; an OPEN-FRONT room (the user's
    // canonical "left wall, right wall and a ceiling") presents its
    // opening — normal +Z, straight at the reader.
    const front = face('capFrontL')
    if (front) {
      expect(visibility(front.quad), 'front face').toBeGreaterThan(0.25)
    } else {
      expect(-dot([0, 0, 1], VIEW), 'open front').toBeGreaterThan(0.25)
    }

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

  it.each(platforms)('%s: the floating deck presents an upward face to the reader', (_id, layer) => {
    // The deck's readable top (bisector X at open ~ +Y) must clear the same
    // front/top cosine floor as a box lid. A BRIDGE deck reads on both
    // panels; a TERRACE deck's riser faces sideways by design, so its
    // up-facing tread — the greater-visibility panel — carries the read.
    const deck = solvePlatformPose(layer, Math.PI, 0).filter(
      (p) => p.face === 'deckA' || p.face === 'deckB'
    )
    const topVis = Math.max(...deck.map((p) => visibility(p.quad)))
    expect(topVis, 'deck top face').toBeGreaterThan(0.25)
  })
})

describe('C3v2 depth occupancy — pieces spread across >= 5 depth bands', () => {
  const SEPARATION = 0.12

  const centroidOf = (layer: SceneLayer, chapter: (typeof CHAPTERS)[number]): number => {
    const quads = poseQuads(layer, chapter.layers, Math.PI, 0)
    let zSum = 0
    let aSum = 0
    for (const q of quads) {
      const a = quadArea(q)
      zSum += ((q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4) * a
      aSum += a
    }
    return zSum / aSum
  }

  const bandsOf = (chapter: (typeof CHAPTERS)[number]): number => {
    // Independent (page-glued) pieces define the parallax planes via
    // single-linkage clustering. A platform occupies its floating deck as
    // ONE independent piece; a fan occupies its spine apex like a v-fold.
    // Dependent pieces (children, riders, dress) ride another's paper — they
    // may JOIN a plane or, when they jut clear of everything, form their own,
    // but they can never BRIDGE two planes into one.
    const indep = chapter.layers
      .filter((l) => !isDependent(l))
      .map((l) => centroidOf(l, chapter))
      .sort((a, b) => a - b)
    const bands: Array<{ min: number; max: number }> = []
    for (const z of indep) {
      const last = bands[bands.length - 1]
      if (!last || z - last.max > SEPARATION) bands.push({ min: z, max: z })
      else last.max = z
    }
    let extra = 0
    for (const layer of chapter.layers) {
      if (!isDependent(layer)) continue
      const z = centroidOf(layer, chapter)
      const clear = bands.every((b) => z < b.min - SEPARATION || z > b.max + SEPARATION)
      if (clear) extra++
    }
    return bands.length + extra
  }

  it('every non-showpiece chapter spread meets its raised depth-band ratchet (target: 5 everywhere)', () => {
    // Part C v2 raises the floor to 5 for every spread; where a spread
    // measures higher it ratchets at the measured value. Measured
    // 2026-07-11 (anatomy recomposition): 2:5, 3:5, 4:7, 5:5, 6:5, 7:5.
    //
    // SHOWPIECE EXEMPTION (E1 reset, charter pillar E-P2 "prune the crowds"):
    // spread 4 (the dispatch keep) was rebuilt from a 7-piece crowd into ONE
    // grand multi-story structure. The depth-band ratchet counts SEPARATE
    // pieces at distinct depths — the exact "pile pieces per spread" philosophy
    // the reset reverses. The keep's depth is real (hall/gallery/loft/crown
    // stacked, the balcony cantilevering +z to 0.44, the skyline stepping in Z)
    // but lives INSIDE the one structure, and is judged by the E-gates
    // (E-G2 sightline, E-G3 scale, golden boards), not by counting pieces. No
    // physics/quality gate is weakened. Keyed to the declared `showpiece` marker
    // (not a spread index) so it extends to the E2 grand chapter, no test edit.
    const RATCHET: Record<number, number> = { 2: 5, 3: 5, 4: 7, 5: 5, 6: 5, 7: 5 }
    for (const chapter of CHAPTERS) {
      if (chapter.showpiece) continue
      expect(bandsOf(chapter), `spread ${chapter.spread} depth bands`).toBeGreaterThanOrEqual(
        RATCHET[chapter.spread]
      )
    }
  })
})
