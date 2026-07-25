import { describe, expect, it } from 'vitest'
import {
  CHAPTERS,
  EXTRA_SPREAD_LAYERS,
  type SceneLayer,
} from '@/components/labs/storybook/content'
import { solvePlatformPose, strutClosedReach } from '@/components/labs/storybook/book/popup-anatomy'
import { tabPieceFlatSpan } from '@/components/labs/storybook/book/popup-tabpiece'
import { solveKineticArmPose, kineticArmFlatReach } from '@/components/labs/storybook/book/popup-kinetic'
import { rotorSweptRadius } from '@/components/labs/storybook/book/popup-rotor'
import {
  knobTowerRunGap,
  knobTowerStrokeFull,
  knobTowerThetaMax,
} from '@/components/labs/storybook/book/popup-knobtower'
import {
  solveBoxPose,
  solveVFoldPose,
  type PanelQuad,
  type Vec3,
} from '@/components/labs/storybook/book/popup-mechanics'
import {
  KEEPSAKE_SLIT_TOL,
  KEEPSAKE_SLEEVE_TOL,
  keepsakeCardW,
  keepsakeForeLead,
  keepsakePExit,
  keepsakeSeatCorners,
  keepsakeTrailHome,
} from '@/components/labs/storybook/book/popup-keepsake'
import { PAGE_W, PAGE_H } from '@/components/labs/storybook/book/page-geometry'

// Reading camera (book-scene.tsx), for the keepsake seat's clear-band gate —
// same constants derive-keepsake.mjs S4 projects the desk seat through.
const CAM_POS: Vec3 = [0, 2.6, 2.9]
const CAM_LOOK: Vec3 = [0, 0.32, 0.15]
const CAM_FOV = 34
const CAM_ASPECT = 16 / 9
// HTML side columns leave this central screen-NDC-x band clear for the seat.
const CLEAR_BAND_X: readonly [number, number] = [-0.37, 0.45]
const vsub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const vcross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const vdot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const vnorm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2])
  return [a[0] / l, a[1] / l, a[2] / l]
}
const projectX = (p: Vec3): number => {
  const f = vnorm(vsub(CAM_LOOK, CAM_POS))
  const r = vnorm(vcross(f, [0, 1, 0]))
  const v = vsub(p, CAM_POS)
  const depth = vdot(v, f)
  const th = Math.tan((CAM_FOV * Math.PI) / 360)
  return vdot(v, r) / depth / (th * CAM_ASPECT)
}

/** The [u-edge, v-edge] lengths of a rotor/dress seat panel at full open —
 *  the bounds a spin-swept disc must fit within at its anchor. */
const seatPanelDims = (
  parent: SceneLayer,
  seat: string
): readonly [number, number] | null => {
  const edges = (q: PanelQuad): readonly [number, number] => [
    Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]),
    Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1], q[3][2] - q[0][2]),
  ]
  if (parent.mech === 'vfold') {
    const pose = solveVFoldPose(parent, Math.PI, 0)
    return edges(seat === 'left' ? pose.left : pose.right)
  }
  if (parent.mech === 'box') {
    const patch = solveBoxPose(parent, Math.PI, 0).find((p) => p.face === seat)
    return patch ? edges(patch.quad) : null
  }
  if (parent.mech === 'platform') {
    const patch = solvePlatformPose(parent, Math.PI, 0).find((p) => p.face === seat && p.bay === 0)
    return patch ? edges(patch.quad) : null
  }
  return null
}

// The volumetric composition covenant, RAISED to Part C v2 (benchmark spec
// 2026-07-11, "raised acceptance"). The box-era premise is inverted: real
// pop-up "dimensions" come from ASSEMBLY ANATOMY, not enclosed volumes. A
// flat single-fold sheet is legal only as backdrop / scenery / figure; a
// story-role piece must be a dressed assembly (a kinematic core wearing >= 2
// shaped die-cut patches) or a multi-tier floating platform. A bare
// primitive — v-fold, tent, OR box — in a story role now fails CI, exactly
// as gutter tents were demoted before it. The old PENDING_VOLUMETRIC
// allowlist is gone: dressed v-fold heroes are legal anatomy.

const CHAPTER_SETS: ReadonlyArray<readonly [string, readonly SceneLayer[]]> = CHAPTERS.map(
  (c) => [`spread-${c.spread}`, c.layers] as const
)
const ALL_SETS: ReadonlyArray<readonly [string, readonly SceneLayer[]]> = [
  ...CHAPTER_SETS,
  ...Object.entries(EXTRA_SPREAD_LAYERS).map(([s, layers]) => [`extra-${s}`, layers] as const),
]

// A dress patch is decorative (zero DOF); it does not itself count as a
// mechanism family, but two of them riding a core turn that core into an
// assembly. Platforms and fans are inherently multi-plane assemblies (a
// deck spanning strut ranks; k v-folds sharing one apex), so they carry no
// dress seat and satisfy the census on their own.
const familyOf = (l: SceneLayer): string | null => {
  switch (l.mech) {
    case 'vfold':
      return 'vfold'
    case 'box':
      return 'box'
    case 'platform':
      return 'platform'
    case 'fan':
      return 'fan'
    case 'child':
    case 'rider':
      return 'recursion'
    case 'parallel':
      return 'parallel'
    case 'stripflap':
      return 'stripflap'
    case 'tabpiece':
      return 'tabpiece'
    case 'keepsake':
      // The removable card is its own hand-driven family (the only piece that
      // leaves the book) — page-rooted like the tab piece, but pull-to-REMOVE
      // rather than pull-to-erect (law H7).
      return 'keepsake'
    case 'kinetic':
    case 'rotor':
    case 'knobtower':
    case 'keepwinch':
      // The rotor is the kinetic family's SECOND form (a spinning disc rather
      // than a sweeping arm); the knob-tower is its USER-DRIVEN third form (a
      // hand-twisted crank); the keep-winch is its composed fourth form (one
      // crank driving three staggered outputs) — all page/hand-driven
      // image-animating folds.
      return 'kinetic'
    case 'keepstack':
      // The dispatch keep — four stacked box-fold stories rising as one rigid
      // chain: an inherent multi-story assembly, its own showpiece family.
      return 'keepstack'
    case 'skyline':
      // A row of page-driven rooftop mounds (the tab-piece/knob-tier cross-
      // section without a knob) — its own low-scenery family.
      return 'skyline'
    case 'swarmarc':
      // The graded-strut carrier swarm (E3 s3): many radial-hinge page-riding
      // struts wave-staggered into one wheeling ring + a stir ripple tab — an
      // inherent multi-member assembly, its own family.
      return 'swarmarc'
    case 'volvelle':
      // The reader-spun windowed dial (Birmingham 103/104) — a rotating-window
      // reveal, distinct from the winch's crank/iris: its own hand-driven family.
      return 'volvelle'
    case 'liftflap':
      // The reader-lifted numbered door-flaps (Birmingham 94/95) — a hinged
      // reveal (lift to uncover a recess), distinct from the volvelle's rotating
      // window: its own hand-driven family.
      return 'liftflap'
    case 'depthvista':
      // The tunnel-mouth depth vista — 2 centred vaulted-arch planes + a flanking
      // wing pair, all parallel-fold: an inherent multi-plane assembly, its own
      // page-driven backdrop family.
      return 'depthvista'
    case 'dissolve':
      // The pull-tab dissolve (Birmingham 92/93/119) — a page-flat rack of
      // venetian slats the reader flips to crossfade one picture into another
      // (dunes -> gold): the book's only paper crossfade, its own hand-driven
      // family, distinct from the volvelle's rotating window and the liftflap's
      // hinged reveal.
      return 'dissolve'
    case 'mfoldrange':
      // The multi-fold range (Birmingham 28/57) — ONE card of k standing
      // v-fold ranks at DISTINCT apexZ stations chained by page-glued flat
      // gussets. Distinct from the fan (k planes at ONE shared apex): the
      // sequential stations give each rank its own closed-form response
      // curve — the bloom wave — which a shared-vertex fan cannot produce.
      return 'mfoldrange'
    case 'oanave':
      // The origamic-architecture nave rank (E3 s7) — a v-fold wall host
      // carrying die-cut relief strata folded from its own sheet: the
      // relief DOF class (internal parallelograms, cut-from construction)
      // is the mechanism, not the host — its own family by the same house
      // precedent that separates m-fold/child/rider from the v-fold.
      return 'oanave'
    case 'dress':
      return null
  }
}

const dressTargeting = (id: string, layers: readonly SceneLayer[]): SceneLayer[] =>
  layers.filter((l) => l.mech === 'dress' && l.parentId === id)

// Legal dress seats per parent mechanism (popup-mechanics DressGeom doc).
const VFOLD_SEATS: ReadonlySet<string> = new Set(['left', 'right'])
const BOX_FACES: ReadonlySet<string> = new Set([
  'wallL', 'wallR', 'lidL', 'lidR', 'roofL', 'roofR', 'capFrontL', 'capFrontR', 'capBackL', 'capBackR',
])
const PLATFORM_FACES: ReadonlySet<string> = new Set(['deckA', 'deckB', 'strutL', 'strutR'])

// Seats whose bottom (v=0) edge is glued or hinged to a PAGE — v-fold glue
// lines, box wall bases, and box cap hinges. A dress patch overhanging BELOW
// such an edge (v < 0) swings outside the dihedral wedge as the book closes
// (A10 wedge containment) — impossible paper. Overhang is legal only past a
// FREE edge (a top or side away from the pages), so on these seats v >= 0.
const PAGE_GLUED_BOTTOM_SEATS: ReadonlySet<string> = new Set([
  'left', 'right', 'wallL', 'wallR', 'capFrontL', 'capFrontR', 'capBackL', 'capBackR',
])

describe('composition covenant v2 — dressed assemblies by default (gate C1v2)', () => {
  it('C1v2 ANATOMY CENSUS: every story piece is a platform, a fan, or a dressed core', () => {
    for (const [name, layers] of ALL_SETS) {
      for (const layer of layers) {
        if (layer.role !== 'story') continue
        if (layer.mech === 'platform' || layer.mech === 'fan' || layer.mech === 'keepstack') continue // inherent assemblies
        if (layer.mech === 'dissolve') continue // inherent assembly: a rack of N slats + sand base + tab (the paper crossfade)
        if (layer.mech === 'oanave') {
          // Inherent assembly when it carries relief: each stratum is two
          // more kinematic planes die-cut from the host sheet (each rank
          // reads as ~7 elements — columns, moldings, keystone, rim, crown).
          // A bare oanave (no strata) is the apse backdrop, not story.
          expect(
            layer.strata.length,
            `${name} ${layer.id} is a bare oanave in a story role — needs >= 1 relief stratum`
          ).toBeGreaterThanOrEqual(1)
          continue
        }
        if (layer.mech === 'vfold' || layer.mech === 'box') {
          const dresses = dressTargeting(layer.id, layers)
          expect(
            dresses.length,
            `${name} ${layer.id} is a bare ${layer.mech} in a story role — needs >= 2 dress patches`
          ).toBeGreaterThanOrEqual(2)
          continue
        }
        throw new Error(`${name} ${layer.id}: story role with non-assembly mech ${layer.mech}`)
      }
    }
  })

  it('parallel folds appear only as GROUND SWELLS carrying tentRidge riders (off-spine anchors)', () => {
    // The 2026-07-11 demotion stands for the tent's OLD role (artwork
    // carrier: its faces only ever look left/right). C6 round 7 gave it a
    // NEW role — a low terrain mound whose ridge is an off-spine anchor
    // (derive-offspine.mjs). Legal iff it carries at least one rider, sits
    // low (rise is slack: open height ~ sqrt(rise * reach)), stays scenery,
    // and folds flat inside the page.
    for (const [name, layers] of ALL_SETS) {
      for (const layer of layers) {
        if (layer.mech !== 'parallel') continue
        const riders = layers.filter(
          (l) => l.mech === 'rider' && l.seat === 'tentRidge' && l.parentId === layer.id
        )
        expect(
          riders.length,
          `${name} ${layer.id}: a tent carrying no rider is the demoted billboard`
        ).toBeGreaterThanOrEqual(1)
        expect(layer.role, `${name} ${layer.id}: ground swells are scenery`).toBe('scenery')
        expect(layer.rise, `${name} ${layer.id}: ground swells stay low`).toBeLessThanOrEqual(0.08)
        // closed containment: the strip folds flat to glueL+glueR+rise up the page
        expect(
          layer.glueL + layer.glueR + layer.rise,
          `${name} ${layer.id}: closed reach exceeds the page`
        ).toBeLessThanOrEqual(PAGE_W)
        expect(layer.z0).toBeLessThan(layer.z1)
        expect(Math.abs(layer.z0)).toBeLessThanOrEqual(PAGE_H / 2)
        expect(Math.abs(layer.z1)).toBeLessThanOrEqual(PAGE_H / 2)
      }
    }
  })

  it('C4v2 FOLD VOCABULARY: >= 4 distinct mechanism families per chapter spread', () => {
    // Families {v-fold, box, platform, fan, recursion(child|rider)}. Dress is
    // zero-DOF decoration and does not count toward the vocabulary.
    for (const chapter of CHAPTERS) {
      const families = new Set(chapter.layers.map(familyOf).filter((f): f is string => f !== null))
      expect(
        families.size,
        `spread ${chapter.spread} families: ${[...families].join(',')}`
      ).toBeGreaterThanOrEqual(4)
    }
  })

  it('the floating-tier gate: every non-showpiece chapter spread ships >= 1 platform (C3v2 structural half)', () => {
    // SHOWPIECE EXEMPTION (E1 reset, charter 2026-07-14 pillar E-P2 "prune the
    // crowds: fewer, larger, distinct structures beat many small pieces;
    // variety survives at the BOOK level, not by piling mechanisms per
    // spread"): the pilot showpiece spread (4, the dispatch keep) is ONE grand
    // multi-story structure, not a per-chapter template of {box, platform,
    // fan, ...}. Its floating-tier depth is carried inside the keep (the
    // cantilevered balcony deck riding the hall lid) and judged by the E-gates
    // (E-G2 sightline, E-G3 scale, golden boards), not by a separate platform
    // piece. Every OTHER chapter still ships its platform. This exemption
    // relaxes a D-series template covenant per the fate list; it does NOT
    // weaken any physics/quality gate (D-G2 collision, real-time, sightline
    // stay hard). Keyed to the declared `showpiece` marker (not a spread index)
    // so it extends to the E2 grand chapter with no test edit.
    // STAGE-SET EXEMPTION (E3 scene packs, s2 pack Q2 APPROVED by the
    // orchestrator 2026-07-25): a Birmingham-118 graded stage set carries its
    // depth in three receding gutter-spanning planes; a platform buried behind
    // a full-span hero plane is invisible scaffolding (riser-silhouette law),
    // so the per-chapter platform template no longer binds spreads rebuilt as
    // stage sets. Listed per spread as each pack's retirement is accepted.
    const STAGE_SET_SPREADS: ReadonlySet<number> = new Set([2])
    // SWARMARC EXEMPTION (E3 s3 pack §2): the carrier swarm IS the floating
    // tier generalized — 28 struts holding rider art 0.09–0.61 above the page
    // plane (the platform family's whole depth win, multiplied), and the
    // retired ch2-meadow platform sat exactly in the ring's left anchor lane.
    // The gate accepts either the platform piece or the strut-swarm carrying
    // that structural role.
    for (const chapter of CHAPTERS) {
      if (chapter.showpiece || STAGE_SET_SPREADS.has(chapter.spread)) continue
      expect(
        chapter.layers.some((l) => l.mech === 'platform' || l.mech === 'swarmarc'),
        `spread ${chapter.spread} has no floating platform`
      ).toBe(true)
    }
  })
})

describe('mechanism validity — the flat-fold / mount / seat laws (every layer)', () => {
  it('platform flat-fold: bridge => equal reach + qA===qB; terrace => qA+qB === gap', () => {
    for (const [name, layers] of ALL_SETS) {
      for (const l of layers) {
        if (l.mech !== 'platform') continue
        const reachA = strutClosedReach(l.strutA)
        const reachB = strutClosedReach(l.strutB)
        if (Math.abs(reachA - reachB) < 1e-9) {
          // BRIDGE: mirror ranks fold together, so the deck panels must be equal.
          expect(l.qA, `${name} ${l.id} bridge needs qA===qB`).toBe(l.qB)
        } else {
          // TERRACE: the deck's two panels bridge the closed gap between ranks.
          expect(
            Math.abs(l.qA + l.qB - Math.abs(reachA - reachB)),
            `${name} ${l.id} terrace: qA+qB must equal the closed reach gap`
          ).toBeLessThan(1e-9)
        }
      }
    }
  })

  it('platform containment + disjoint strut spans (folds flat inside the page)', () => {
    for (const [name, layers] of ALL_SETS) {
      for (const l of layers) {
        if (l.mech !== 'platform') continue
        const reachA = strutClosedReach(l.strutA)
        const reachB = strutClosedReach(l.strutB)
        // closed folded reach along the page stays within the page width
        expect(
          Math.max(reachA, reachB) + Math.max(l.qA, l.qB),
          `${name} ${l.id} reach+q exceeds the page`
        ).toBeLessThanOrEqual(PAGE_W)
        // every strut bay and the deck stay within the page depth
        for (const strut of [l.strutA, l.strutB]) {
          for (const [z0, z1] of strut.spans) {
            expect(z0).toBeLessThan(z1)
            expect(Math.abs(z0)).toBeLessThanOrEqual(PAGE_H / 2)
            expect(Math.abs(z1)).toBeLessThanOrEqual(PAGE_H / 2)
          }
          // bays of a rank must be disjoint (they share one ridge line)
          const sorted = [...strut.spans].sort((a, b) => a[0] - b[0])
          for (let i = 1; i < sorted.length; i++) {
            expect(
              sorted[i][0],
              `${name} ${l.id} strut bays overlap`
            ).toBeGreaterThanOrEqual(sorted[i - 1][1])
          }
        }
        expect(l.deckZ0).toBeLessThan(l.deckZ1)
        expect(Math.abs(l.deckZ0)).toBeLessThanOrEqual(PAGE_H / 2)
        expect(Math.abs(l.deckZ1)).toBeLessThanOrEqual(PAGE_H / 2)
      }
    }
  })

  it('rider mount rule: boxLid on a flat box, deckCrease on a bridge, tentRidge on a swell', () => {
    for (const [name, layers] of ALL_SETS) {
      for (const l of layers) {
        if (l.mech !== 'rider') continue
        const parent = layers.find((p) => p.id === l.parentId)
        expect(parent, `${name} ${l.id} rider parent missing`).toBeDefined()
        if (!parent) continue
        if (l.seat === 'boxLid') {
          expect(parent.mech, `${name} ${l.id} boxLid needs a box`).toBe('box')
          if (parent.mech === 'box') {
            expect(parent.roof, `${name} ${l.id} boxLid needs a flat roof`).toBe('flat')
            expect(l.mountZ).toBeGreaterThanOrEqual(parent.z0)
            expect(l.mountZ).toBeLessThanOrEqual(parent.z1)
          }
          // rooftop props stay small — they rise only partway (design rules)
          expect(l.width).toBeLessThanOrEqual(0.12)
          expect(l.height).toBeLessThanOrEqual(0.1)
        } else if (l.seat === 'deckCrease') {
          expect(parent.mech, `${name} ${l.id} deckCrease needs a platform`).toBe('platform')
          if (parent.mech === 'platform') {
            // EQUAL CLOSED REACH is the whole bridge rule — mirrored ranks
            // are a special case, not a requirement (derive-offspine).
            expect(
              Math.abs(strutClosedReach(parent.strutA) - strutClosedReach(parent.strutB)),
              `${name} ${l.id} deckCrease needs a BRIDGE platform`
            ).toBeLessThan(1e-9)
            expect(l.mountZ).toBeGreaterThanOrEqual(parent.deckZ0)
            expect(l.mountZ).toBeLessThanOrEqual(parent.deckZ1)
          }
          expect(l.width).toBeLessThanOrEqual(0.12)
          expect(l.height).toBeLessThanOrEqual(0.1)
        } else {
          // tentRidge STANDEES (the off-spine family): bigger than rooftop
          // props — they are the scene pieces the de-centering law exists
          // for — but bounded by their mound: at book-closed the rider
          // wraps the ridge spine-ward, so its height must stay inside the
          // tent's own folded reach.
          expect(parent.mech, `${name} ${l.id} tentRidge needs a parallel ground swell`).toBe('parallel')
          if (parent.mech === 'parallel') {
            expect(l.mountZ).toBeGreaterThanOrEqual(parent.z0)
            expect(l.mountZ).toBeLessThanOrEqual(parent.z1)
            expect(l.height).toBeLessThanOrEqual(parent.glueL + parent.glueR + parent.rise)
          }
          expect(l.width).toBeLessThanOrEqual(0.5)
          expect(l.height).toBeLessThanOrEqual(0.42)
        }
        expect(l.rhoDeg).toBeGreaterThan(l.phiDeg)
      }
    }
  })

  it('dress validity: parent resolves in-spread and the seat is legal for its mechanism', () => {
    for (const [name, layers] of ALL_SETS) {
      for (const l of layers) {
        if (l.mech !== 'dress') continue
        const parent = layers.find((p) => p.id === l.parentId)
        expect(parent, `${name} ${l.id} dress parent ${l.parentId} not in spread`).toBeDefined()
        if (!parent) continue
        const legal =
          parent.mech === 'vfold'
            ? VFOLD_SEATS
            : parent.mech === 'box'
              ? BOX_FACES
              : parent.mech === 'platform'
                ? PLATFORM_FACES
                : new Set<string>()
        expect(
          legal.has(l.seat),
          `${name} ${l.id} seat '${l.seat}' is not legal for a ${parent.mech} parent`
        ).toBe(true)
        // no overhang below a page-glued edge (would exit the wedge on close)
        if (PAGE_GLUED_BOTTOM_SEATS.has(l.seat)) {
          expect(
            l.v,
            `${name} ${l.id} overhangs below a page-glued edge (A10 wedge)`
          ).toBeGreaterThanOrEqual(0)
        }
        // dress is decorative scenery, never a story piece on its own
        expect(l.role).toBe('scenery')
        // each patch stays within the die-cut bound (overhang allowed, sprawl not)
        expect(l.width).toBeLessThanOrEqual(0.35)
        expect(l.height).toBeLessThanOrEqual(0.35)
      }
    }
  })

  it('rotor validity: parent resolves in-spread, seat legal, spin capped at 150, decorative role', () => {
    for (const [name, layers] of ALL_SETS) {
      for (const l of layers) {
        if (l.mech !== 'rotor') continue
        const label = `${name} ${l.id}`
        const parent = layers.find((p) => p.id === l.parentId)
        expect(parent, `${label} rotor parent ${l.parentId} not in spread`).toBeDefined()
        if (!parent) continue
        const legal =
          parent.mech === 'vfold'
            ? VFOLD_SEATS
            : parent.mech === 'box'
              ? BOX_FACES
              : parent.mech === 'platform'
                ? PLATFORM_FACES
                : new Set<string>()
        expect(legal.has(l.seat), `${label} seat '${l.seat}' is not legal for a ${parent.mech} parent`).toBe(true)
        // mechanism 76 caps the turn at 2xE with E <= 75 -> |spin| <= 150.
        expect(Math.abs(l.spinDeg), `${label} spin exceeds the mech-76 cap`).toBeLessThanOrEqual(150)
        // a real, visible disc (radius > 0) that isn't a sprawling slab
        expect(l.radius, label).toBeGreaterThan(0)
        expect(l.radius, label).toBeLessThanOrEqual(0.25)
        // the spin-swept circumcircle (radius*sqrt(2) from the hub) fits
        // inside the parent panel at the anchor — the disc never spins its
        // corners off its own seat.
        const dims = seatPanelDims(parent, l.seat)
        expect(dims, `${label} could not resolve its seat panel`).not.toBeNull()
        if (dims) {
          const reach = rotorSweptRadius(l)
          expect(l.u - reach, `${label} spins off the panel's spine edge`).toBeGreaterThanOrEqual(0)
          expect(l.u + reach, `${label} spins off the panel's fore edge`).toBeLessThanOrEqual(dims[0])
          expect(l.v - reach, `${label} spins off the panel's bottom edge`).toBeGreaterThanOrEqual(0)
          expect(l.v + reach, `${label} spins off the panel's top edge`).toBeLessThanOrEqual(dims[1])
        }
        // a spinning disc is decorative kinetic scenery, never a story piece
        // on its own (the C1v2 census forbids non-assembly story mechs).
        expect(l.role === 'scenery' || l.role === 'figure', `${label} rotor role must be scenery/figure`).toBe(true)
      }
    }
  })

  it('knobtower belongs to the kinetic family (its user-driven third form)', () => {
    const knob: SceneLayer = {
      id: 'probe-knob',
      kind: 'hero',
      role: 'figure',
      mech: 'knobtower',
      side: 'right',
      hubD: 0.3,
      hubZ: 0,
      discR: 0.16,
      crankR: 0.2,
      foreHingeD: 0.82,
      tiers: [
        { w: 0.09, aRestDeg: 70, zc: -0.12, ridgeLen: 0.12 },
        { w: 0.11, aRestDeg: 74, zc: 0, ridgeLen: 0.12 },
        { w: 0.13, aRestDeg: 78, zc: 0.12, ridgeLen: 0.12 },
      ],
    }
    expect(familyOf(knob)).toBe('kinetic')
  })

  it('knobtower validity: crank stroke, disjoint disc/tower run-bands, aRest < 90, wind + z-bands', () => {
    // Shipped-content-dependent: vacuous until a knob-tower lands in content.
    for (const [name, layers] of ALL_SETS) {
      for (const l of layers) {
        if (l.mech !== 'knobtower') continue
        const label = `${name} ${l.id}`
        // the crank stroke can actually reach full erection (s_full <= 2*crankR)
        expect(knobTowerStrokeFull(l), `${label} crank stroke too short`).toBeLessThanOrEqual(
          2 * l.crankR + 1e-9
        )
        // the disc's spin-swept circle and the towers occupy disjoint run-bands
        expect(knobTowerRunGap(l), `${label} disc/tower run-bands overlap`).toBeGreaterThanOrEqual(0)
        // every tier is a real knee that folds flat (0 < aRest < 90)
        for (const t of l.tiers) {
          expect(t.aRestDeg, label).toBeGreaterThan(0)
          expect(t.aRestDeg, `${label} aRest must stay below 90`).toBeLessThan(90)
          expect(t.w, label).toBeGreaterThan(0)
          expect(t.ridgeLen, label).toBeGreaterThan(0)
        }
        // one comfortable drag: the 270-degree ergonomic covenant ceiling
        expect((knobTowerThetaMax(l) * 180) / Math.PI, `${label} wind exceeds 270deg`).toBeLessThanOrEqual(270)
        // disjoint tier z-bands (each tier stands in its own lane)
        const bands = l.tiers
          .map((t) => [t.zc - t.ridgeLen / 2, t.zc + t.ridgeLen / 2] as const)
          .sort((a, b) => a[0] - b[0])
        for (let i = 1; i < bands.length; i++) {
          expect(bands[i][0], `${label} tier z-bands overlap`).toBeGreaterThanOrEqual(bands[i - 1][1])
        }
      }
    }
  })

  it('stripflap validity: the strip can pull, and the whole die stays inside the page', () => {
    for (const [name, layers] of ALL_SETS) {
      for (const l of layers) {
        if (l.mech !== 'stripflap') continue
        const label = `${name} ${l.id}`
        // a working strip needs a real anchor and slot on their pages
        expect(l.anchor, label).toBeGreaterThan(0)
        expect(l.slot, label).toBeGreaterThan(0)
        expect(l.anchor, label).toBeLessThanOrEqual(PAGE_W)
        expect(l.slot, label).toBeLessThanOrEqual(PAGE_W)
        expect(Math.abs(l.anchorZ), label).toBeLessThanOrEqual(PAGE_H / 2)
        expect(Math.abs(l.slotZ), label).toBeLessThanOrEqual(PAGE_H / 2)
        // hinge plus the flat-lying flap stays inside the page (the die
        // lies flat at book-closed): width runs along the hinge, height
        // perpendicular to it in the page plane
        const hd = ((l.hingeDeg ?? 0) * Math.PI) / 180
        const cx = Math.abs(Math.cos(hd))
        const sz = Math.abs(Math.sin(hd))
        expect(l.hingeX + (l.width / 2) * cx + l.height * sz, label).toBeLessThanOrEqual(PAGE_W)
        expect(l.hingeX - (l.width / 2) * cx - l.height * sz, label).toBeGreaterThanOrEqual(0)
        expect(Math.abs(l.hingeZ) + (l.width / 2) * sz + l.height * cx, label).toBeLessThanOrEqual(
          PAGE_H / 2
        )
      }
    }
  })

  it('tabpiece validity: one-page footprint, workable lift, tab room at the fore edge', () => {
    for (const [name, layers] of ALL_SETS) {
      for (const l of layers) {
        if (l.mech !== 'tabpiece') continue
        const label = `${name} ${l.id}`
        expect(l.legW, label).toBeGreaterThan(0)
        if (l.form === 'table') expect(l.deckD ?? 0, label).toBeGreaterThan(0)
        const lift = l.liftDeg ?? 55
        expect(lift, label).toBeGreaterThan(0)
        expect(lift, label).toBeLessThanOrEqual(85)
        // the flat structure fits its ONE page: fixed hinge inside the fore
        // edge, sliding hinge clear of the gutter by a margin
        expect(l.hingeX, label).toBeLessThanOrEqual(PAGE_W - 0.02)
        expect(l.hingeX - tabPieceFlatSpan(l), label).toBeGreaterThanOrEqual(0.06)
        expect(l.z0, label).toBeLessThan(l.z1)
        expect(Math.abs(l.z0), label).toBeLessThanOrEqual(PAGE_H / 2)
        expect(Math.abs(l.z1), label).toBeLessThanOrEqual(PAGE_H / 2)
        // the visible tab fits the piece's spine extent
        expect(l.tabW ?? 0.1, label).toBeLessThanOrEqual(l.z1 - l.z0)
      }
    }
  })

  it('keepsake validity: sleeve/slit containment + a seat in the clear band below the book', () => {
    for (const [name, layers] of ALL_SETS) {
      for (const l of layers) {
        if (l.mech !== 'keepsake') continue
        const label = `${name} ${l.id}`
        const cardW = keepsakeCardW(l)
        // real card, real sleeve span (bench S1 sizeOK)
        expect(cardW, label).toBeGreaterThan(0)
        expect(l.cardL, label).toBeGreaterThan(0)
        expect(l.z0, label).toBeLessThan(l.z1)
        expect(Math.abs(l.z0), label).toBeLessThanOrEqual(PAGE_H / 2)
        expect(Math.abs(l.z1), label).toBeLessThanOrEqual(PAGE_H / 2)
        // the through-slit (card width + 4 mm canon) fits the page depth, and
        // its z-edge stays inside the bench's 0.75 containment bound (S1)
        const zc = (l.z0 + l.z1) / 2
        const zEdge = Math.abs(zc) + (cardW + KEEPSAKE_SLIT_TOL) / 2
        expect(zEdge, `${label} slit z-edge`).toBeLessThanOrEqual(PAGE_H / 2)
        expect(zEdge, `${label} slit z-edge`).toBeLessThanOrEqual(0.75)
        // the sleeve fits one page: leading edge inside the fore edge, trailing
        // (sleeve mouth) clear of the gutter by the tab-piece T6 margin
        expect(keepsakeForeLead(l), `${label} fore lead`).toBeLessThanOrEqual(PAGE_W - 0.02)
        expect(keepsakeTrailHome(l), `${label} trail home`).toBeGreaterThanOrEqual(0.06)
        // Birmingham law 9 slit:sleeve ratio (4 mm : 3 mm) preserved
        expect(Math.abs(KEEPSAKE_SLIT_TOL / KEEPSAKE_SLEEVE_TOL - 4 / 3), label).toBeLessThan(0.05)
        // the pull that detaches the card equals cardL + tabLip (p_exit)
        expect(keepsakePExit(l), label).toBeCloseTo(l.cardL + (l.tabLip ?? 0.02), 12)
        // SEAT legality (bench S4): a real flat card tilted up toward the
        // camera, seated downstage of the book (z beyond the fore edge), its
        // whole screen-x footprint inside the clear band between the HTML columns
        expect(l.seat.tiltDeg, `${label} seat tilt`).toBeGreaterThan(0)
        expect(l.seat.tiltDeg, `${label} seat tilt`).toBeLessThan(90)
        expect(l.seat.z, `${label} seat downstage`).toBeGreaterThan(PAGE_H / 2)
        const xs = keepsakeSeatCorners(l).map(projectX)
        expect(Math.min(...xs), `${label} seat left of clear band`).toBeGreaterThanOrEqual(CLEAR_BAND_X[0])
        expect(Math.max(...xs), `${label} seat right of clear band`).toBeLessThanOrEqual(CLEAR_BAND_X[1])
      }
    }
  })

  it('kinetic arm validity: 45 fold, flap+arm fold flat inside the page, arm sweeps up', () => {
    // The moving arm (Birmingham 73) is a two-panel MechPose whose ARM panel
    // extends up a 45-deg v-fold ridge. Its tip is the fastest point in the
    // book, but the v-fold late-bloom parks that speed near flat-open where
    // the eased turn clock is slowest — so the arm passes the D-G5 GLOBAL_CAP
    // (0.0497) with ~85% margin at armLen up to ~0.48 (bench K7). This gate
    // guards the design constraints; the cap itself is enforced in
    // motion-character.test.ts across every shipped layer.
    for (const [name, layers] of ALL_SETS) {
      for (const l of layers) {
        if (l.mech !== 'kinetic') continue
        const label = `${name} ${l.id}`
        const phi = l.phiDeg ?? 45
        expect(l.armLen, label).toBeGreaterThan(0)
        expect(l.armW, label).toBeGreaterThan(0)
        expect(l.flapW, label).toBeGreaterThan(0)
        expect(l.flapLen, label).toBeGreaterThan(0)
        // 45 fold, muscle stands and stays reachable
        expect(phi, label).toBeGreaterThan(0)
        expect(l.rhoDeg, label).toBeGreaterThan(phi)
        expect(phi + l.rhoDeg, label).toBeLessThan(180)
        // flap + arm fold flat entirely inside the page rectangle at closed
        const closed = solveKineticArmPose(l, 0, 0)
        for (const p of [...closed.right, ...closed.left]) {
          expect(Math.abs(p[1]), `${label} flat`).toBeLessThan(1e-9)
          expect(p[0], `${label} spine`).toBeGreaterThanOrEqual(-1e-9)
          expect(p[0], `${label} fore edge`).toBeLessThanOrEqual(PAGE_W + 1e-9)
          expect(Math.abs(p[2]), `${label} depth`).toBeLessThanOrEqual(PAGE_H / 2 + 1e-9)
        }
        // the flat reach fits the page even before the fold-flat fan
        expect(kineticArmFlatReach(l), label).toBeLessThanOrEqual(PAGE_W)
        // the arm stands nearly vertical at rest (its ridge points up)
        const rest = solveKineticArmPose(l, Math.PI, 0)
        expect(rest.crease[1], `${label} stands`).toBeGreaterThan(0.7)
      }
    }
  })

  it('fan members: rho > phi each, nested non-crossing (non-decreasing phi and rho)', () => {
    for (const [name, layers] of ALL_SETS) {
      for (const l of layers) {
        if (l.mech !== 'fan') continue
        expect(l.members.length, `${name} ${l.id} fan needs >= 2 members`).toBeGreaterThanOrEqual(2)
        for (const m of l.members) {
          expect(m.rhoDeg, `${name} ${l.id} member must bridge its glue`).toBeGreaterThan(m.phiDeg)
        }
        for (let i = 1; i < l.members.length; i++) {
          expect(l.members[i].phiDeg).toBeGreaterThanOrEqual(l.members[i - 1].phiDeg)
          expect(l.members[i].rhoDeg).toBeGreaterThanOrEqual(l.members[i - 1].rhoDeg)
        }
      }
    }
  })

  it('boxes still ship both a lidded and a hollow read (gate B16)', () => {
    const roofs = new Set(
      ALL_SETS.flatMap(([, layers]) =>
        layers.filter((l) => l.mech === 'box').map((l) => (l.mech === 'box' ? l.roof : ''))
      )
    )
    expect(roofs.has('flat')).toBe(true) // painted top readable from the camera
    expect(roofs.has('open')).toBe(true) // hollow interior, raw paper
  })
})
