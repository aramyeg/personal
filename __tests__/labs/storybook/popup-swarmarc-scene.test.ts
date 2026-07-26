/**
 * SPREAD 3 SCENE GATES — "The Carrier Swarm", read as a PICTURE.
 *
 * Every other s3 suite asks whether the paper is legal (popup-swarmarc.test.ts:
 * radius wall, containment, fold-flat, wave stagger). This one asks the question
 * the blind first-time reader actually asked, which is a composition question,
 * and it asks it in the only units that answer it: SCREEN PIXELS at the pinned
 * reading camera. Every threshold here traces to a numbered finding in
 * .superpowers/sdd/blind/s3-2026-07-26.md.
 *
 *   SC1  the crown accent trio is not GUILLOTINED by the backdrop crest
 *        (finding 6: "white feathery shapes ... sliced off by the wall's top
 *        edge. It reads as a rendering error")
 *   SC2  the STIR ripple is a visible EVENT (finding 1: the spread advertises
 *        its one interaction in words and then refuses it)
 *   SC3  nothing DOWNSTAGE of the hero masks him (finding 8's "hides the hero's
 *        legs"; this is the gate the retired meadow windmill failed)
 *   SC4  the swarm is a swarm, not a picket fence (finding 8)
 *   SC5  every courier is SEATED above its stalk tip, not skewered on it
 *        (finding 8: "bees skewered on sticks")
 *   SC6  no die-cut figure reads as an edge-on sliver (finding 3: the "yellow
 *        and black V" across the hero's face was bee-b presenting 683 px² of
 *        the 2400 px² it can)
 *   SC7  the STIR tab is big enough to carry a readable label (finding 4:
 *        "cap height is ~4px ... two rows of grey mush")
 *
 * CAMERA. book-scene.tsx's pinned rig: position (0, 1.85, 3.05), lookAt
 * (0, 0.38, 0.05), fov 34, at the 1600x900 frame the blind reviews are shot at.
 * Popup layers render inside a group lifted to POPUP_Y, and the spread's pages
 * sit at their own rest tilts, so both are applied — with all three the model
 * puts the shipped STIR tab's centre at (1292, 609) against (1291, 601) measured
 * off a real capture, i.e. inside a pixel horizontally and 8 px vertically.
 */

import { describe, expect, it } from 'vitest'
import { popupContentForSpread, type SceneLayer } from '@/components/labs/storybook/content'
import {
  solveBoxPose,
  solveChildPose,
  solveVFoldPose,
  type PanelQuad,
  type Vec3,
} from '@/components/labs/storybook/book/popup-mechanics'
import { solveDressPose } from '@/components/labs/storybook/book/popup-anatomy'
import {
  solveSwarmArcPose,
  swarmStirTabQuad,
  SWARM_RIDER_SEAT,
  type SwarmArcGeom,
} from '@/components/labs/storybook/book/popup-swarmarc'
import { restAngles } from '@/components/labs/storybook/book/page-geometry'
import { POPUP_Y } from '@/components/labs/storybook/book/book'

// ---------------------------------------------------------------------------
// the pinned reading camera, in pixels
const CAM: Vec3 = [0, 1.85, 3.05]
const LOOK: Vec3 = [0, 0.38, 0.05]
const FOV_DEG = 34
const VW = 1600
const VH = 900

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const unit = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2])
  return [a[0] / l, a[1] / l, a[2] / l]
}
const FWD = unit(sub(LOOK, CAM))
const RIGHT = unit(cross(FWD, [0, 1, 0]))
const UPV = cross(RIGHT, FWD)
const TAN_HALF = Math.tan((FOV_DEG * Math.PI) / 360)

type Pt = readonly [number, number]

/** World point -> screen pixel (POPUP_Y applied: every popup layer lives in the
 *  lifted popups group). */
const px = (p: Vec3): Pt => {
  const d = sub([p[0], p[1] + POPUP_Y, p[2]], CAM)
  const z = dot(d, FWD)
  return [
    VW / 2 + ((dot(d, RIGHT) / (z * TAN_HALF * (VW / VH))) * VW) / 2,
    VH / 2 - ((dot(d, UPV) / (z * TAN_HALF)) * VH) / 2,
  ]
}

// --- convex hull + clip, for "how much of the hero does this cover" ---
const cross2 = (o: Pt, a: Pt, b: Pt): number =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

const hull = (points: readonly Pt[]): Pt[] => {
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
  return [...lower, ...upper]
}

const area = (poly: readonly Pt[]): number => {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]
    const [x2, y2] = poly[(i + 1) % poly.length]
    s += x1 * y2 - x2 * y1
  }
  return Math.abs(s) / 2
}

/** Sutherland-Hodgman clip of `poly` by the CCW convex `clip`. */
const clipPoly = (poly: readonly Pt[], clip: readonly Pt[]): Pt[] => {
  let out: Pt[] = [...poly]
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i]
    const b = clip[(i + 1) % clip.length]
    const inside = (p: Pt): boolean => cross2(a, b, p) >= 0
    const next: Pt[] = []
    for (let j = 0; j < out.length; j++) {
      const p = out[j]
      const q = out[(j + 1) % out.length]
      const pin = inside(p)
      const qin = inside(q)
      if (pin) next.push(p)
      if (pin !== qin) {
        const d1 = cross2(a, b, p)
        const d2 = cross2(a, b, q)
        const t = d1 / (d1 - d2)
        next.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t])
      }
    }
    out = next
  }
  return out
}

// ---------------------------------------------------------------------------
// spread 3 at its true rest pose
const LAYERS = popupContentForSpread(3)!.layers
const REST = restAngles(3)
const TL = Math.PI - REST.aL
const TR = REST.aR
const byId = (id: string): SceneLayer => LAYERS.find((l) => l.id === id)!

const seatQuadOf = (l: SceneLayer): PanelQuad => {
  const parent = byId((l as unknown as { parentId: string }).parentId)
  const seat = (l as unknown as { seat: string }).seat
  if (parent.mech === 'vfold') {
    const pose = solveVFoldPose(parent, TL, TR)
    return seat === 'left' ? pose.left : pose.right
  }
  if (parent.mech === 'box') return solveBoxPose(parent, TL, TR).find((p) => p.face === seat)!.quad
  throw new Error(`unsupported dress parent ${parent.mech}`)
}

/** Every world quad a layer poses at rest (the families s3 actually ships). */
const quadsOf = (l: SceneLayer): PanelQuad[] => {
  switch (l.mech) {
    case 'vfold': {
      const p = solveVFoldPose(l, TL, TR)
      return [p.right, p.left]
    }
    case 'child': {
      const parent = byId(l.parentId) as SceneLayer & { mech: 'vfold' }
      const p = solveChildPose(l, solveVFoldPose(parent, TL, TR))
      return [p.right, p.left]
    }
    case 'box':
      return solveBoxPose(l, TL, TR).map((p) => p.quad)
    case 'dress':
      return [solveDressPose(l, seatQuadOf(l))]
    case 'swarmarc':
      return solveSwarmArcPose(l, TL, TR, 0).flatMap((p) => [p.strut, p.rider])
    default:
      throw new Error(`spread 3 grew a ${l.mech} layer — teach this gate to pose it`)
  }
}

const hullOf = (l: SceneLayer): Pt[] => hull(quadsOf(l).flat().map((p) => px(p as Vec3)))
const minZ = (l: SceneLayer): number => Math.min(...quadsOf(l).flat().map((p) => p[2]))

const SWARM = byId('ch2-swarm') as SceneLayer & SwarmArcGeom
const HERO = byId('ch2-hero')
const HERO_HULL = hullOf(HERO)
const HERO_APEX_Z = 0.1 // ch2-hero's apexZ

// ---------------------------------------------------------------------------
describe('SC1 — the crown accent trio clears the backdrop crest', () => {
  // The three flung couriers ride the backdrop's own crease. At mounts
  // 0.84 / 0.90 they poked 4.8 px and 11.7 px ABOVE the panel's projected top
  // edge, so the wall's crest cut across a bee and the reader logged it as a
  // z/clip bug. A die-cut may stand in front of the sky OR clear above the
  // wall; what it must never do is straddle the edge at a few pixels.
  const bp = solveVFoldPose(byId('ch2-backdrop') as SceneLayer & { mech: 'vfold' }, TL, TR)
  const topEdge = (q: PanelQuad): [Pt, Pt] => {
    const pts = q.map((p) => px(p as Vec3)).sort((a, b) => a[1] - b[1])
    return [pts[0], pts[1]]
  }
  const edges = [topEdge(bp.left), topEdge(bp.right)]
  /** Screen y of the backdrop's top edge at screen x (Infinity = no cover). */
  const crestY = (x: number): number => {
    let best = Number.POSITIVE_INFINITY
    for (const [a, b] of edges) {
      if (x < Math.min(a[0], b[0]) - 1 || x > Math.max(a[0], b[0]) + 1) continue
      const t = (x - a[0]) / (b[0] - a[0])
      best = Math.min(best, a[1] + t * (b[1] - a[1]))
    }
    return best
  }

  it.each(['ch2-bee-a', 'ch2-crown-b', 'ch2-crown-c'])('%s sits wholly below the crest', (id) => {
    let worst = Number.POSITIVE_INFINITY
    for (const q of quadsOf(byId(id))) {
      for (const p of q) {
        const [sx, sy] = px(p as Vec3)
        const cy = crestY(sx)
        if (Number.isFinite(cy)) worst = Math.min(worst, sy - cy)
      }
    }
    expect(worst, `${id} clears the crest by ${worst.toFixed(1)}px`).toBeGreaterThanOrEqual(10)
  })

  it('keeps the trio a fanned CLUSTER, not two dies on one spot', () => {
    const centres = ['ch2-bee-a', 'ch2-crown-b', 'ch2-crown-c'].map((id) => {
      const pts = quadsOf(byId(id)).flat().map((p) => px(p as Vec3))
      return [
        pts.reduce((a, p) => a + p[0], 0) / pts.length,
        pts.reduce((a, p) => a + p[1], 0) / pts.length,
      ] as Pt
    })
    for (let i = 0; i < centres.length; i++) {
      for (let j = i + 1; j < centres.length; j++) {
        const d = Math.hypot(centres[i][0] - centres[j][0], centres[i][1] - centres[j][1])
        expect(d, `crown pair ${i}/${j} centres ${d.toFixed(0)}px apart`).toBeGreaterThan(18)
      }
    }
  })
})

describe('SC2 — STIR THE SWARM is a visible event', () => {
  const stroke = SWARM.stir.stroke
  const centre = (q: PanelQuad): Pt => {
    const a = px(q[0] as Vec3)
    const b = px(q[2] as Vec3)
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  }
  const rest = solveSwarmArcPose(SWARM, TL, TR, 0)
  const pulled = solveSwarmArcPose(SWARM, TL, TR, stroke)
  const travels = SWARM.struts
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.stir >= 0)
    .map(({ i }) => {
      const a = centre(rest[i].rider)
      const b = centre(pulled[i].rider)
      return Math.hypot(b[0] - a[0], b[1] - a[1])
    })

  it('displaces EVERY rippled courier, not one', () => {
    // The shipped 12°/0.12 ripple moved the tab-nearest rider exactly 0 px at
    // full stroke: the wave had run off the arm before the pull finished.
    expect(travels).toHaveLength(4)
    for (const t of travels) expect(t, `rider travel ${t.toFixed(1)}px`).toBeGreaterThanOrEqual(15)
  })

  it('peaks well past the reading-distance noise floor', () => {
    // Peak was 17.5 px and read as nothing; a rider sprite is ~30-50 px across,
    // so the arch must displace one by about its own body length.
    expect(Math.max(...travels)).toBeGreaterThanOrEqual(30)
    // and the arm moves as a WAVE: total displacement across the four ranks
    expect(travels.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(90)
  })

  it('draws the tab itself far enough to be seen leaving the page', () => {
    const c0 = centre(swarmStirTabQuad(SWARM, 0, TL, TR))
    const c1 = centre(swarmStirTabQuad(SWARM, stroke, TL, TR))
    expect(Math.hypot(c1[0] - c0[0], c1[1] - c0[1])).toBeGreaterThanOrEqual(40)
  })

  it('holds the whole ripple inside the frame', () => {
    for (const pose of pulled) {
      for (const q of [pose.strut, pose.rider]) {
        for (const p of q) {
          const [sx, sy] = px(p as Vec3)
          expect(sx).toBeGreaterThan(0)
          expect(sx).toBeLessThan(VW)
          expect(sy).toBeGreaterThan(0)
          expect(sy).toBeLessThan(VH)
        }
      }
    }
  })
})

describe('SC3 — nothing downstage of the hero masks him', () => {
  // The retired meadow windmill measured x 752..838, y 487..628 — inside the
  // hero's own box and downstage of him, drawing across his legs hip to boot.
  // A kinetic arm's apex is ON the spine by construction, so no placement could
  // fix it; the piece went. The hive is exempt BY NAME: it is a knee-high box at
  // his feet, the chapter's story volume, and the pairing is already whitelisted
  // in art-overlap.test.ts as a silhouette dialogue.
  const EXEMPT = new Set(['ch2-hero', 'ch2-hive', 'ch2-hive-swarm', 'ch2-hive-flowers'])
  const heroArea = area(HERO_HULL)

  it.each(
    LAYERS.filter((l) => !EXEMPT.has(l.id) && l.mech !== 'swarmarc' && minZ(l) > HERO_APEX_Z).map((l) => l.id)
  )('%s covers ≤ 8%% of the hero', (id) => {
    // 8% is the house screen-overlap floor (art-overlap.test.ts). The retired
    // windmill measured ~22% of the hero hull; the foreground meadow fringe
    // clips his boots at 4.5%, which is the composition (he stands BEHIND the
    // meadow) rather than a mask.
    const covered = area(clipPoly(hullOf(byId(id)), HERO_HULL)) / heroArea
    expect(covered, `${id} covers ${(covered * 100).toFixed(1)}% of the hero`).toBeLessThanOrEqual(0.08)
  })

  it('no swarm stalk seated downstage of the hero crosses him', () => {
    const poses = solveSwarmArcPose(SWARM, TL, TR, 0)
    const inHero = (p: Pt): boolean => clipPoly([p, [p[0] + 0.01, p[1]], [p[0], p[1] + 0.01]], HERO_HULL).length > 0
    const crossers: string[] = []
    SWARM.struts.forEach((s, i) => {
      if (s.z0 <= HERO_APEX_Z) return // seated upstage: the hero occludes it
      const q = poses[i].strut
      for (let k = 0; k <= 14; k++) {
        const t = k / 14
        const p: Vec3 = [
          q[0][0] + (q[3][0] - q[0][0]) * t,
          q[0][1] + (q[3][1] - q[0][1]) * t,
          q[0][2] + (q[3][2] - q[0][2]) * t,
        ]
        if (inHero(px(p))) {
          crossers.push(`strut ${i}`)
          break
        }
      }
    })
    expect(crossers, `downstage stalks crossing the hero: ${crossers.join(', ')}`).toEqual([])
  })
})

describe('SC4 — the swarm reads as a swarm, not a picket fence', () => {
  it('ships no more than 24 pieces', () => {
    expect(SWARM.struts.length).toBeLessThanOrEqual(24)
  })

  it('spans a wide band of stalk heights on screen', () => {
    const poses = solveSwarmArcPose(SWARM, TL, TR, 0)
    const heights = poses.map((p) => {
      const foot = px([
        (p.strut[0][0] + p.strut[1][0]) / 2,
        (p.strut[0][1] + p.strut[1][1]) / 2,
        (p.strut[0][2] + p.strut[1][2]) / 2,
      ])
      const tip = px([
        (p.strut[2][0] + p.strut[3][0]) / 2,
        (p.strut[2][1] + p.strut[3][1]) / 2,
        (p.strut[2][2] + p.strut[3][2]) / 2,
      ])
      return foot[1] - tip[1]
    })
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThanOrEqual(100)
  })

  it('still fills the frame it used to fill with 28 pieces', () => {
    // Thinning must not shrink the composition: the ring's screen span carries
    // the chapter's "a thousand couriers aloft" read.
    const pts = quadsOf(SWARM).flat().map((p) => px(p as Vec3))
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    expect((Math.max(...xs) - Math.min(...xs)) / VW).toBeGreaterThanOrEqual(0.42)
    expect((Math.max(...ys) - Math.min(...ys)) / VH).toBeGreaterThanOrEqual(0.36)
  })
})

describe('SC5 — every courier is seated above its stalk, not skewered on it', () => {
  it('lands the stalk tip in the rider footprint but below its centre', () => {
    for (const s of SWARM.struts) {
      const tipRho = s.L - s.r * SWARM_RIDER_SEAT
      expect(tipRho).toBeGreaterThan(s.L - s.r)
      expect(tipRho).toBeLessThan(s.L)
      // and the seat is deep enough to matter at reading scale: the gap between
      // the stalk tip and the rider centre must be a real fraction of the cell
      expect((s.L - tipRho) / (2 * s.r)).toBeGreaterThanOrEqual(0.1)
    }
  })
})

describe('SC6 — no die-cut figure reads as an edge-on sliver', () => {
  // bee-b at vDir −1 presented 683 px² of the 2406 px² its quads can, and the
  // reader could not tell it was a bee at 4x zoom. Comparing raw px² across the
  // five couriers would only measure how big and how near each die is, so the
  // gate is PRESENTATION EFFICIENCY: projected px² per unit of die area. The old
  // bee-b scored 48k; every shipped courier scores 73k or better, so the floor
  // sits at 62k — a die that foreshortens into a sliver fails it wherever it is.
  it.each(['ch2-bee-a', 'ch2-bee-b', 'ch2-bee-c', 'ch2-crown-b', 'ch2-crown-c'])(
    '%s presents enough pixels per unit of die to be read',
    (id) => {
      const l = byId(id) as SceneLayer & { width: number; height: number }
      const shown = quadsOf(l).reduce((a, q) => a + area(q.map((p) => px(p as Vec3))), 0)
      const efficiency = shown / (l.width * l.height)
      expect(
        efficiency,
        `${id} presents ${shown.toFixed(0)}px² = ${(efficiency / 1000).toFixed(0)}k px²/die-unit`
      ).toBeGreaterThanOrEqual(62_000)
    }
  )
})

describe('SC7 — the STIR tab can carry a readable label', () => {
  const q = swarmStirTabQuad(SWARM, 0, TL, TR).map((p) => px(p as Vec3))

  it('is a plaque, not a sliver', () => {
    // shipped: 57 x 34 px, 1938 px², "cap height ~4px". A two-line serif label
    // needs ~85 px of plaque height to reach a 12 px cap at this camera.
    const w = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1])
    const h = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1])
    expect(w).toBeGreaterThanOrEqual(120)
    expect(h).toBeGreaterThanOrEqual(70)
    expect(area(q)).toBeGreaterThanOrEqual(9000)
  })

  it('sits beside the arm it drives, not alone in the empty corner', () => {
    const c: Pt = [
      q.reduce((a, p) => a + p[0], 0) / 4,
      q.reduce((a, p) => a + p[1], 0) / 4,
    ]
    // nearest rippled rider on screen
    const poses = solveSwarmArcPose(SWARM, TL, TR, 0)
    const near = Math.min(
      ...SWARM.struts
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.stir >= 0)
        .map(({ i }) => {
          const r = px([
            (poses[i].rider[0][0] + poses[i].rider[2][0]) / 2,
            (poses[i].rider[0][1] + poses[i].rider[2][1]) / 2,
            (poses[i].rider[0][2] + poses[i].rider[2][2]) / 2,
          ])
          return Math.hypot(r[0] - c[0], r[1] - c[1])
        })
    )
    expect(near, `nearest rippled rider is ${near.toFixed(0)}px from the tab`).toBeLessThanOrEqual(220)
  })

  it('stays on its page at rest and inside the frame when fully drawn', () => {
    const drawn = swarmStirTabQuad(SWARM, SWARM.stir.stroke, TL, TR)
    for (const p of drawn) {
      const [sx, sy] = px(p as Vec3)
      expect(sx).toBeLessThan(VW)
      expect(sy).toBeLessThan(VH)
    }
    // at rest the whole die is inboard of the page fore edge (PAGE_W 1.15)
    for (const p of swarmStirTabQuad(SWARM, 0, TL, TR)) {
      expect(Math.hypot(p[0], p[1])).toBeLessThanOrEqual(1.15)
    }
  })
})
