import { describe, expect, it } from 'vitest'
import {
  solveStripFlapPoseAt,
  type StripFlapGeom,
  type Vec3,
} from '@/components/labs/storybook/book/popup-mechanics'
import {
  keepsakeCardInPlane,
  keepsakePExit,
  type KeepsakeGeom,
} from '@/components/labs/storybook/book/popup-keepsake'
import { CHAPTERS, EXTRA_SPREAD_LAYERS, type SceneLayer } from '@/components/labs/storybook/content'

/**
 * User-drive-domain no-snap (E-G4 item 3). The three E0b one-frame artifacts —
 * satchel-sword "full-piece vanish", satchel-compass "pose jump", end-keepsake
 * "edge-mark dropout" — were filed against the HAND-DRIVEN pieces. Re-verified
 * on the live app they no longer reproduce (the drag exercises each piece over
 * its full range with a glitch-free drive channel, and the E0b burst scores
 * clean): the artifacts were resolved by the fix wave's material/texture
 * pooling. This guards the OTHER precondition a one-frame pose glitch would
 * need — a discontinuity in the pose as a function of the reader's DRIVE value
 * (the flap lift / the keepsake pull). motion-character.test.ts covers the
 * page-driven (beta) domain; this covers the user-drive domain those pieces
 * are dragged through, so a future solver change that snaps under the hand
 * fails a test rather than only a live capture.
 */

const rad = (d: number) => (d * Math.PI) / 180
/** Symmetric rest bloom (same convention as motion-character.test.ts). */
const bloom = (beta: number): [number, number] => [Math.PI / 2 + beta / 2, Math.PI / 2 - beta / 2]
const [REST_THETA_L, REST_THETA_R] = bloom(rad(176))

const ALL_LAYERS: readonly SceneLayer[] = [
  ...CHAPTERS.flatMap((c) => c.layers),
  ...Object.values(EXTRA_SPREAD_LAYERS).flatMap((layers) => layers),
]

const STRIPFLAPS = ALL_LAYERS.filter(
  (l): l is SceneLayer & StripFlapGeom => l.mech === 'stripflap'
)
const KEEPSAKES = ALL_LAYERS.filter((l): l is SceneLayer & KeepsakeGeom => l.mech === 'keepsake')

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** Worst per-vertex move between two same-length corner lists. */
const worstVert = (a: readonly Vec3[], b: readonly Vec3[]): number => {
  let d = 0
  for (let i = 0; i < a.length; i++) d = Math.max(d, dist(a[i], b[i]))
  return d
}

/** Max / mean per-vertex step over a fine sweep of `drive` -> corners. A single
 *  step far above the mean is a snap (branch flip / solver blow-up). */
function stepRatio(
  corners: (drive: number) => readonly Vec3[],
  from: number,
  to: number,
  steps: number
) {
  let prev: readonly Vec3[] | null = null
  let maxStep = 0
  let sum = 0
  let n = 0
  for (let i = 0; i <= steps; i++) {
    const cur = corners(from + ((to - from) * i) / steps)
    if (prev) {
      const d = worstVert(prev, cur)
      if (d > maxStep) maxStep = d
      sum += d
      n++
    }
    prev = cur
  }
  return { maxStep, meanStep: sum / n }
}

const STEPS = 360

describe('E-G4 user-drive no-snap — dragged pieces stay continuous across their whole drive range', () => {
  it('there are stripflap and keepsake pieces to check', () => {
    expect(STRIPFLAPS.length).toBeGreaterThan(0)
    expect(KEEPSAKES.length).toBeGreaterThan(0)
  })

  it.each(STRIPFLAPS.map((l) => [l.id, l] as const))(
    'stripflap %s: flap pose is continuous over the full 0..90deg lift (no full-piece vanish / pose jump)',
    (_id, layer) => {
      const corners = (lift: number): Vec3[] => {
        const pose = solveStripFlapPoseAt(layer, lift, REST_THETA_L, REST_THETA_R)
        return [...pose.right, ...pose.left]
      }
      const { maxStep, meanStep } = stepRatio(corners, 0, Math.PI / 2, STEPS)
      // A smooth swing moves ~evenly; a snap spikes far above the mean. The
      // press-and-peel graze clamp is a continuous cap, so even its knee stays
      // well under this ratio (measured worst < 6x; ceiling set with headroom).
      expect(maxStep).toBeLessThan(10 * meanStep)
    }
  )

  it.each(KEEPSAKES.map((l) => [l.id, l] as const))(
    'keepsake %s: card pose is continuous over the full 0..pExit pull (no edge-mark dropout from a pose jump)',
    (_id, layer) => {
      const pExit = keepsakePExit(layer)
      const corners = (p: number): readonly Vec3[] =>
        keepsakeCardInPlane(layer, p, REST_THETA_L, REST_THETA_R)
      const { maxStep, meanStep } = stepRatio(corners, 0, pExit, STEPS)
      // A rigid coplanar slide is near-linear in p — max/mean hugs 1.
      expect(maxStep).toBeLessThan(3 * meanStep)
    }
  )
})
