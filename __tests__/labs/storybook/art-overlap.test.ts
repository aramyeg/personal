import { describe, expect, it } from 'vitest'
import { CHAPTERS, type SceneLayer } from '@/components/labs/storybook/content'
import {
  solveBoxPose,
  solveParallelPose,
  solveStripFlapPose,
  solveVFoldPose,
  solveChildPose,
  spreadPageAnglesTilted,
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
import { solveDissolvePose } from '@/components/labs/storybook/book/popup-dissolve'
import { solveKineticArmPose } from '@/components/labs/storybook/book/popup-kinetic'
import { solveRotorPose } from '@/components/labs/storybook/book/popup-rotor'
import { keepStackQuads } from '@/components/labs/storybook/book/popup-keepstack'
import { keepWinchOutputQuads, keepWinchThetaMax } from '@/components/labs/storybook/book/popup-keepwinch'
import { keepSkylineQuads } from '@/components/labs/storybook/book/popup-skyline'
import { swarmArcQuads } from '@/components/labs/storybook/book/popup-swarmarc'
import { oanavePatches } from '@/components/labs/storybook/book/popup-oanave'

// D-G7 ART & OVERLAP whitelist gate, second half (benchmark spec
// docs/superpowers/specs/2026-07-13-grand-book-benchmark.md): "Screen-space
// overlaps between story-role pieces at rest must be whitelisted, and each
// whitelist entry names its complement reason (framing / depth echo /
// silhouette dialogue). Unlisted overlap = failure." Extended here to both
// art-carrying tiers (role 'story' and 'figure' — backdrop/scenery are flat
// scene-setting sheets the covenant already allows to sit behind everything,
// so their overlaps aren't a composition question this gate needs to police).

// Reading camera (book-scene.tsx): position (0, 2.6, 2.9) looking at
// (0, 0.32, 0.15) — same constants as volumetric-gates.test.ts, extended
// here with a full camera basis so pieces project to 2D screen polygons
// instead of just direction cosines.
const EYE: Vec3 = [0, 2.6, 2.9]
const LOOKAT: Vec3 = [0, 0.32, 0.15]

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

const FORWARD = normalize(sub(LOOKAT, EYE))
const RIGHT = normalize(cross(FORWARD, [0, 1, 0]))
const UP = cross(RIGHT, FORWARD)

type Pt = readonly [number, number]

/** Perspective-projects a world point onto the reading camera's screen
 *  plane. No fov/aspect term: a per-axis scale constant is an invertible
 *  linear map applied uniformly to every projected point, and every gate
 *  below is an area RATIO (intersection / footprint), which such a map
 *  always preserves — so raw view-space x/y over depth is enough. */
const project = (p: Vec3): Pt => {
  const rel = sub(p, EYE)
  const depth = dot(rel, FORWARD)
  return [dot(rel, RIGHT) / depth, dot(rel, UP) / depth]
}

// ---------------------------------------------------------------------------
// Geometry pipeline: every layer's world quads at a given pose. Mirrors
// poseQuads/seatQuad in volumetric-gates.test.ts (same six mechanism
// families' dispatch) — kept as its own copy since this gate's inputs
// (screen polygons) differ from that file's (depth/visibility scalars).

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
    case 'dissolve':
      // The dissolve's art footprint is its coplanar placard (the sand base the
      // slats tile at rest); posed flat (dunes, tau=0).
      return [solveDissolvePose(l, 0, tL, tR).base]
    case 'kinetic': {
      const pose = solveKineticArmPose(l, tL, tR)
      return [pose.right, pose.left]
    }
    case 'keepstack':
      return keepStackQuads(l, tL, tR)
    case 'keepwinch':
      return keepWinchOutputQuads(l, keepWinchThetaMax(l), tL, tR)
    case 'skyline':
      return keepSkylineQuads(l, tL, tR)
    case 'swarmarc':
      return swarmArcQuads(l, tL, tR)
    case 'oanave':
      // Host wings + die-cut relief strata — the rank's whole painted
      // footprint (popup-oanave.ts); the nested-portal overlaps ARE the
      // composition, judged by the whitelist like any depth staging.
      return oanavePatches(l, tL, tR).map((p) => p.quad)
    default:
      throw new Error(`poseQuads: unhandled mech ${(l as SceneLayer).mech}`)
  }
}

// ---------------------------------------------------------------------------
// 2D convex hull (monotone chain) + Sutherland-Hodgman convex clip. Every
// piece is approximated by ONE silhouette (the convex hull of every corner
// of every quad it poses) — the spec's "2D convex hull or bounding polygon"
// choice, picked over per-face polygons because the reader reads a piece as
// one shape, not its individual painted faces.

const cross2 = (o: Pt, a: Pt, b: Pt): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

const convexHull = (points: readonly Pt[]): Pt[] => {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (pts.length <= 2) return pts
  const lower: Pt[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross2(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Pt[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross2(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  lower.pop()
  upper.pop()
  return [...lower, ...upper] // CCW winding
}

const polygonArea = (poly: readonly Pt[]): number => {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]
    const [x2, y2] = poly[(i + 1) % poly.length]
    s += x1 * y2 - x2 * y1
  }
  return Math.abs(s) / 2
}

const segIntersect = (a: Pt, b: Pt, p: Pt, q: Pt): Pt => {
  const a1 = b[1] - a[1]
  const b1 = a[0] - b[0]
  const c1 = a1 * a[0] + b1 * a[1]
  const a2 = q[1] - p[1]
  const b2 = p[0] - q[0]
  const c2 = a2 * p[0] + b2 * p[1]
  const det = a1 * b2 - a2 * b1
  if (Math.abs(det) < 1e-12) return p
  return [(b2 * c1 - b1 * c2) / det, (a1 * c2 - a2 * c1) / det]
}

/** Clips a convex `subject` polygon against a convex `clip` polygon (both
 *  CCW) — exact, since both footprints here are already convex hulls. */
const clipConvex = (subject: readonly Pt[], clip: readonly Pt[]): Pt[] => {
  let output: Pt[] = [...subject]
  for (let i = 0; i < clip.length && output.length > 0; i++) {
    const a = clip[i]
    const b = clip[(i + 1) % clip.length]
    const input = output
    output = []
    for (let j = 0; j < input.length; j++) {
      const cur = input[j]
      const prev = input[(j - 1 + input.length) % input.length]
      const curIn = cross2(a, b, cur) >= 0
      const prevIn = cross2(a, b, prev) >= 0
      if (curIn) {
        if (!prevIn) output.push(segIntersect(a, b, prev, cur))
        output.push(cur)
      } else if (prevIn) {
        output.push(segIntersect(a, b, prev, cur))
      }
    }
  }
  return output
}

/** Screen-space footprint of a layer at a pose: the convex hull of every
 *  corner of every quad it poses, projected to the reading camera. */
const footprint = (layer: SceneLayer, layers: readonly SceneLayer[], tL: number, tR: number): Pt[] =>
  convexHull(poseQuads(layer, layers, tL, tR).flatMap((q) => q.map(project)))

/** Intersection area over the SMALLER piece's area — a small prop fully
 *  inside a big backdrop reads as 100% overlapping it, not some tiny sliver
 *  of the backdrop's own area. */
const overlapRatio = (a: readonly Pt[], b: readonly Pt[]): number => {
  const areaA = polygonArea(a)
  const areaB = polygonArea(b)
  if (areaA === 0 || areaB === 0) return 0
  const inter = polygonArea(clipConvex(a, b))
  return inter / Math.min(areaA, areaB)
}

// ---------------------------------------------------------------------------
// The gate: every PAIR of art-carrying (role 'story'/'figure') pieces within
// a chapter, at that chapter's TRUE rest pose, whose screen footprints
// overlap above the 8% floor must appear in WHITELIST with a real reason.
// Parent-child/rider/dress/rotor glued pairs are exempt (a rider or dress
// patch is SUPPOSED to sit on its parent's paper — that's glue, not a
// collision this gate polices).

const ART_ROLES: ReadonlySet<SceneLayer['role']> = new Set(['story', 'figure'])
const OVERLAP_FLOOR = 0.08

const isGluedPair = (a: SceneLayer, b: SceneLayer): boolean =>
  ('parentId' in a && a.parentId === b.id) || ('parentId' in b && b.parentId === a.id)

type Reason = 'framing' | 'depth-echo' | 'silhouette-dialogue'
type WhitelistEntry = { pair: string; reason: Reason; note: string }

// Measured 2026-07-13 (D5 art-overlap gate stand-up), classified against
// captures at http://localhost:3123/labs/storybook?sbpose=<spread>. Every
// entry's reason was checked against the actual capture, not assumed from
// the numbers alone. Three pairs measured above the floor were LEFT OFF
// this list on purpose — see the accompanying report for why they read as
// composition debt rather than a genuine complement.
const WHITELIST: readonly WhitelistEntry[] = [
  // (the E3 s2 stage-set rebuild retired both halves of the old
  // 'ch1-inn x ch1-yard' depth-echo pair — entry removed with them.)
  {
    pair: 'ch2-hero x ch2-hive',
    reason: 'silhouette-dialogue',
    note:
      "the guild's hive sits at the courier balloon's feet in the capture — the bee-courier and its home " +
      'hive read as one beat (Chapter II is literally about the Guild of the Bee), not an incidental clash.',
  },
  {
    pair: 'ch2-hero x ch2-swarm',
    reason: 'framing',
    note:
      'THE composition (E3 s3 pack §1): the horseshoe vortex wheels AROUND the hero — the swarm ring is a ' +
      'literal frame centered on the raised looking-glass; total screen containment is the design, not a clash.',
  },
  {
    pair: 'ch2-bee-b x ch2-swarm',
    reason: 'depth-echo',
    note:
      "the hero's pop-off bee is the swarm's INNER ORBIT (pack §1 second read) — a ring member at hero depth, " +
      'inside the same wheeling silhouette by construction.',
  },
  {
    pair: 'ch2-bee-c x ch2-swarm',
    reason: 'depth-echo',
    note: 'same inner-orbit relationship as bee-b — the second pop-off bee brushing past the hero inside the ring.',
  },
  {
    pair: 'ch2-hive x ch2-swarm',
    reason: 'framing',
    note:
      "the ring ERUPTS from the hive (pack §2.6): the front strut ends (θ ±150°) hover just upstage of the hive " +
      'box so the eruption reads point-blank — the overlap is the story beat.',
  },
  {
    pair: 'ch2-bee-a x ch2-crown-b',
    reason: 'silhouette-dialogue',
    note:
      'the crown accent trio (three flung bees on the backdrop crease) reads as ONE burst above the ring crown; ' +
      'bee-a is the promoted center of that cluster — the trio overlapping each other is the cluster.',
  },
  {
    pair: 'ch2-bee-a x ch2-crown-c',
    reason: 'silhouette-dialogue',
    note: 'same crown-trio cluster read — the third flung bee tucks under the promoted bee-a.',
  },
  {
    pair: 'ch4-hero x ch4-chest',
    reason: 'silhouette-dialogue',
    note:
      "the design comment is explicit — 'an open treasure chest in front of the dragon' — and the capture " +
      'shows it sitting right at the coiled dragon\'s feet: the guardian-and-treasure beat the chapter is about.',
  },
  {
    pair: 'ch4-hero x ch4-hoard',
    reason: 'depth-echo',
    note:
      "documented intent: the hoard platform is 'grown onto tall struts... so the gold heap crests ABOVE " +
      "the skyline and shows through the torn-paper sky' — confirmed in the capture escaping past the " +
      "dragon's wing from its own deep lane.",
  },
  {
    pair: 'ch5-arch x ch5-goods',
    reason: 'framing',
    note:
      'the capture shows the goods table staged directly beneath/within the archway opening — a literal ' +
      'architectural frame around the market wares, the clearest framing case in the book.',
  },
  {
    pair: 'ch5-stall x ch5-goods',
    reason: 'silhouette-dialogue',
    note:
      "documented intent: the goods platform 'spans the stall row' — the wares table and the stall it " +
      'belongs to are one market beat by construction, not two pieces that happen to collide.',
  },
  {
    pair: 'ch3-keep x ch3-ring-tower',
    reason: 'depth-echo',
    note:
      'E3 s4 ring (scenes/s4-scene-pack.md §2): the gatehouse is a NEAR piece standing downstage of the ' +
      'far keep — z band [0.38, 0.58] against the keep body at |z| <= 0.34, which is the very z-disjointness ' +
      'that makes a mid-court tower legal (bench C2, margin 0.020). It occludes 0.0% of the court, the keep ' +
      "gate, the balcony and the dial (bench C3), so the overlap is the amphitheater's depth staging, not a " +
      'mask. MEASURED CAVEAT for the eye-test, recorded rather than hidden: at the pinned camera the tower ' +
      "sits ENTIRELY below the keep's silhouette in its own x band (clearance -0.148 screen units, 0% of the " +
      'tower rises clear), so it reads against the keep facade rather than against sky — flagged in the s4 ' +
      'build ledger for the chapter-boundary review.',
  },
  // E3 s7 nave (scenes/s7-scene-pack.md): the spread IS a stack of nested
  // portals — every rank deliberately overlaps the ranks behind it, and the
  // sightline bench (e3s7-nave-sightline.mjs, ported into
  // popup-oanave.test.ts OA-7/OA-8) proves each deeper rank still shows a
  // crown band (15.3/8.6/7.4/7.6% frameH), exposed wings (>= 0.08/side) and
  // gilt jamb rims (>= 1% frameW) past the rank in front. Recession, not
  // masking, is the composition.
  {
    pair: 'ch6-nave-b x ch6-nave-c',
    reason: 'depth-echo',
    note: 'nested nave ranks — rank C shows through and around B by the bench-gated crown band + jamb rim.',
  },
  {
    pair: 'ch6-nave-b x ch6-nave-d',
    reason: 'depth-echo',
    note: 'nested nave ranks — B reads over D by its crown band; the mouth frames its column bases.',
  },
  {
    pair: 'ch6-nave-c x ch6-nave-d',
    reason: 'depth-echo',
    note: 'nested nave ranks — C portal shows through D below y = 0.13 (column bases + path, by design).',
  },
  {
    pair: 'ch6-nave-d x ch6-steps',
    reason: 'framing',
    note:
      "the entrance dais climbs INTO rank D's portal — the mouth frames the deck; the dais grazing ray " +
      "lands at y ~ 0 exactly at D's sill (bench §A), so the overlap hides nothing inside the nave.",
  },
  {
    pair: 'ch6-strongbox x ch6-steps',
    reason: 'silhouette-dialogue',
    note:
      'documented intent: the strongbox is the waystation the gold processional path splits around before ' +
      'climbing the dais — one path beat by construction; its shadow dies at z ~ 0.22, before the dais top.',
  },
]

const whitelistFor = (pair: string): WhitelistEntry | undefined => WHITELIST.find((w) => w.pair === pair)

type OverlapRow = {
  spread: number
  pair: string
  ratio: number
  reason: Reason | ''
  verdict: 'ok' | 'whitelisted' | 'FAIL'
}

const OVERLAP_ROWS: readonly OverlapRow[] = CHAPTERS.flatMap((chapter) => {
  const { thetaL, thetaR } = spreadPageAnglesTilted(chapter.spread, chapter.spread, null, 0)
  const artLayers = chapter.layers.filter((l) => ART_ROLES.has(l.role))
  const hulls = new Map(artLayers.map((l) => [l.id, footprint(l, chapter.layers, thetaL, thetaR)] as const))
  const rows: OverlapRow[] = []
  for (let i = 0; i < artLayers.length; i++) {
    for (let j = i + 1; j < artLayers.length; j++) {
      const a = artLayers[i]
      const b = artLayers[j]
      if (isGluedPair(a, b)) continue
      const ratio = overlapRatio(hulls.get(a.id)!, hulls.get(b.id)!)
      const pair = `${a.id} x ${b.id}`
      const entry = ratio > OVERLAP_FLOOR ? whitelistFor(pair) : undefined
      rows.push({
        spread: chapter.spread,
        pair,
        ratio: Number(ratio.toFixed(4)),
        reason: entry?.reason ?? '',
        verdict: ratio <= OVERLAP_FLOOR ? 'ok' : entry ? 'whitelisted' : 'FAIL',
      })
    }
  }
  return rows
})

describe('D-G7 art overlap whitelist — story/figure pieces at their chapter rest pose', () => {
  it('measurement table: screen-space overlap between art-carrying piece pairs', () => {
    console.table(OVERLAP_ROWS)
    // Sanity floor on the gate's own coverage: every chapter must contribute
    // at least one checked pair, or the role/glue filters have gone stale
    // and are silently checking nothing. SHOWPIECE EXEMPTION (E1 reset, charter
    // E-P2 "prune the crowds"): spread 4 is ONE grand story piece (the dispatch
    // keep) — there is no second art-carrying story/figure piece to pair it
    // with, so it contributes no overlap pair by design. Its internal
    // composition is judged by E-G2 sightline, not this inter-piece whitelist.
    // Keyed to the declared `showpiece` marker (not a spread index) so it
    // extends to the E2 grand chapter with no test edit.
    const spreadsCovered = new Set(OVERLAP_ROWS.map((r) => r.spread))
    for (const c of CHAPTERS) {
      if (c.showpiece) continue
      expect(spreadsCovered.has(c.spread), `chapter ${c.spread} has no checked pair`).toBe(true)
    }
  })

  it.each(OVERLAP_ROWS.map((r) => [`spread ${r.spread}: ${r.pair}`, r] as const))(
    '%s stays below the 8%% overlap floor or is whitelisted with a reason',
    (_label, row) => {
      expect(row.verdict, `${row.pair} measured ${row.ratio} overlap — not whitelisted`).not.toBe('FAIL')
    }
  )
})
