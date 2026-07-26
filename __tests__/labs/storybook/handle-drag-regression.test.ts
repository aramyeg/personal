/**
 * DRAG-REGRESSION BENCH — "a handle that takes a grab must move paper."
 *
 * WHY: five context-quarantined blind readers (2026-07-26) each found at least
 * one handle that showed a `grab` cursor, captured the pointer, and then moved
 * NOTHING. Every existing suite passed the whole time, because every existing
 * suite tests solvers with hand-fed drive values — nobody tested the PIPELINE
 * (screen ray -> projector -> drive value -> solver -> vertices).
 *
 * This bench closes that hole for EVERY handle family in the book. For each
 * shipped grabbable it:
 *   1. poses the piece at rest from the real content.ts entry,
 *   2. aims a ray from the pinned reading camera at the handle's own surface,
 *   3. drags that aim point across the screen basis in 8 directions,
 *   4. runs the layer's real projector (book/handle-projection.ts) and the
 *      layer's real drive arithmetic,
 *   5. re-solves the piece and measures the worst vertex displacement.
 *
 * A family passes only if SOME drag direction moves the piece at least
 * MIN_TRAVEL world units. A dead handle — bad projection, zero-range clamp,
 * unit mismatch, wrong sign into a saturated stop — fails here, at unit-test
 * speed, instead of in a reader's hands.
 *
 * The camera and the drag stroke are deliberately coarse: this is a
 * liveness gate, not a pixel golden. See MIN_TRAVEL for the bar.
 */

import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  projectHingeAngle,
  projectHingeAngleCyl,
  projectHubAngle,
  projectPageD,
} from '@/components/labs/storybook/book/handle-projection'
import {
  liveSpreadRole,
  solveStripFlapPoseAt,
  spreadPageAnglesTilted,
  stripFlapDetent,
  stripFlapFrame,
  stripFlapRestLift,
  stripFlapTravel,
  type PanelQuad,
  type StripFlapGeom,
  type Vec3,
} from '@/components/labs/storybook/book/popup-mechanics'
import {
  liftFlapDoorQuad,
  liftFlapHingeFrame,
  liftFlapMax,
  type LiftFlapGeom,
} from '@/components/labs/storybook/book/popup-liftflap'
import {
  solveTabPiecePoseAt,
  tabPieceCeiling,
  tabPieceLift,
  tabPieceLiftFromSlide,
  tabPieceSlideFromLift,
  tabPieceStopSlide,
  type TabPieceGeom,
} from '@/components/labs/storybook/book/popup-tabpiece'
import {
  dissolveStroke,
  dissolveTabOut,
  dissolveTabQuad,
  dissolveTauFromDraw,
  solveDissolvePose,
  type DissolveGeom,
} from '@/components/labs/storybook/book/popup-dissolve'
import {
  solveSwarmArcPose,
  swarmStirTabQuad,
  type SwarmArcGeom,
} from '@/components/labs/storybook/book/popup-swarmarc'
import {
  keepsakeCardInPlane,
  keepsakePExit,
  type KeepsakeGeom,
} from '@/components/labs/storybook/book/popup-keepsake'
import {
  keepWinchDiscQuad,
  keepWinchOutputQuads,
  keepWinchThetaMax,
  type KeepWinchGeom,
} from '@/components/labs/storybook/book/popup-keepwinch'
import {
  knobTowerThetaMax,
  solveKnobTowerPose,
  type KnobTowerGeom,
} from '@/components/labs/storybook/book/popup-knobtower'
import {
  solveVolvellePose,
  volvelleDetentStep,
  volvelleHubFrame,
  volvelleSectorSeen,
  volvelleThetaMax,
  VOLVELLE_LIFT,
  type VolvelleGeom,
} from '@/components/labs/storybook/book/popup-volvelle'
import {
  dispatchLineBasketQuad,
  dispatchLineRiderS,
  type DispatchLineGeom,
} from '@/components/labs/storybook/book/popup-dispatchline'
import { ROTOR_LIFT } from '@/components/labs/storybook/book/popup-rotor'
import {
  HANDLE_MIN_HIT,
  HANDLE_SLOP_STANDING,
  handleSlopFactor,
} from '@/components/labs/storybook/book/handle-hit'
import { toScreenPx } from '@/components/labs/storybook/book/reading-stage'
import {
  SPREAD_COUNT,
  popupContentForSpread,
  type SceneLayer,
} from '@/components/labs/storybook/content'

// --- The reading stage -------------------------------------------------------
// book-scene.tsx's pinned camera, expressed in a layer's own local frame. The
// spread group sits a few millimetres above the desk, which is far below the
// resolution this gate cares about, so the world camera is used as-is.
const CAMERA = new THREE.Vector3(0, 1.85, 3.05)
const LOOK_AT = new THREE.Vector3(0, 0.38, 0.05)
const WORLD_UP = new THREE.Vector3(0, 1, 0)

const VIEW = LOOK_AT.clone().sub(CAMERA).normalize()
const SCREEN_RIGHT = VIEW.clone().cross(WORLD_UP).normalize()
const SCREEN_UP = SCREEN_RIGHT.clone().cross(VIEW).normalize()

/** Probe stroke in world units at the piece's own depth. At the pinned camera
 *  the open spread spans ~2.3 world units across ~900 screen px, so 0.20 is
 *  roughly a 75 px drag — a deliberate, unambiguous reader gesture. */
const STROKE = 0.2

/** The bar: the piece's worst vertex must travel at least this far (world
 *  units, ~8 screen px at the reading camera) in SOME drag direction. Below
 *  this a reader cannot see that anything happened, which is exactly the
 *  defect this file exists to prevent. */
const MIN_TRAVEL = 0.02

/** The eight screen directions a reader might try, as unit vectors in the
 *  camera's screen basis. */
const DIRECTIONS: readonly THREE.Vector3[] = (() => {
  const out: THREE.Vector3[] = []
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    out.push(
      SCREEN_RIGHT.clone().multiplyScalar(Math.cos(a)).addScaledVector(SCREEN_UP, Math.sin(a))
    )
  }
  return out
})()

const rayTo = (p: THREE.Vector3): THREE.Ray =>
  new THREE.Ray(CAMERA.clone(), p.clone().sub(CAMERA).normalize())

const centroid = (quad: PanelQuad | readonly Vec3[]): THREE.Vector3 => {
  const v = new THREE.Vector3()
  for (const c of quad) v.add(new THREE.Vector3(c[0], c[1], c[2]))
  return v.multiplyScalar(1 / quad.length)
}

const worstTravel = (a: readonly Vec3[], b: readonly Vec3[]): number => {
  let d = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    d = Math.max(d, Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1], a[i][2] - b[i][2]))
  }
  return d
}

const flatten = (quads: readonly (PanelQuad | readonly Vec3[])[]): Vec3[] =>
  quads.flatMap((q) => q.map((c) => [c[0], c[1], c[2]] as Vec3))

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const wrapDelta = (d: number): number => Math.atan2(Math.sin(d), Math.cos(d))

/** Rest page angles for the spread a layer lives on (no turn in flight). */
function restAngles(spreadIndex: number): { thetaL: number; thetaR: number } {
  expect(liveSpreadRole(spreadIndex, spreadIndex, null)).toBe('current')
  return spreadPageAnglesTilted(spreadIndex, spreadIndex, null, 0)
}

/** A grabbable, described end to end. */
type HandleCase = {
  /** Layer id (or `id#door`) — the test name. */
  name: string
  /** A point ON the handle surface at rest, in the layer's local frame. */
  grabPoint: THREE.Vector3
  /** The layer's real projector, applied to a ray. Returns the projector's
   *  scalar, or null if the ray misses the handle's working plane. */
  project: (ray: THREE.Ray) => number | null
  /** The layer's real drive arithmetic: grab scalar + current scalar -> drive. */
  driveFrom: (pGrab: number, pNow: number) => number
  /** The drive value the piece rests at with no reader input. */
  restDrive: number
  /** The piece's own vertices at a drive value. */
  vertsAt: (drive: number) => Vec3[]
}

/** Locate a layer anywhere in the book (spread index included). */
function locate(id: string): { layer: SceneLayer; spreadIndex: number } {
  for (let s = 0; s < SPREAD_COUNT; s++) {
    const layer = popupContentForSpread(s)?.layers.find((l) => l.id === id)
    if (layer) return { layer, spreadIndex: s }
  }
  throw new Error(`no layer ${id} in the book`)
}

// --- Case builders (one per family) -----------------------------------------

function liftFlapCases(id: string): HandleCase[] {
  const { layer, spreadIndex } = locate(id)
  const geom = layer as SceneLayer & LiftFlapGeom
  const { thetaL, thetaR } = restAngles(spreadIndex)
  const max = liftFlapMax(geom)
  return geom.doors.map((_, k) => {
    const fr = liftFlapHingeFrame(geom, k, thetaL, thetaR)
    // The reader grabs the FREE (fore) edge of a shut leaf, not the hinge.
    const shut = liftFlapDoorQuad(geom, k, 0, thetaL, thetaR)
    const grabPoint = centroid([shut[1], shut[2]]).lerp(centroid(shut), 0.35)
    return {
      name: `${id}#door${k}`,
      grabPoint,
      project: (ray) => projectHingeAngle(ray, fr.center, fr.axis, fr.flat, fr.n),
      driveFrom: (g, n) => clamp(0 + wrapDelta(n - g), 0, max),
      restDrive: 0,
      vertsAt: (a) => flatten([liftFlapDoorQuad(geom, k, a, thetaL, thetaR)]),
    }
  })
}

function stripFlapCase(id: string): HandleCase {
  const { layer, spreadIndex } = locate(id)
  const geom = layer as SceneLayer & StripFlapGeom
  const { thetaL, thetaR } = restAngles(spreadIndex)
  const beta = thetaL - thetaR
  // The un-driven pose the reader actually grabs — the strip cam for a
  // page-driven flap, the declared slack angle for a reader-raised one (s6's
  // stall rank ships lying flat and is RAISED by the drag) — and the piece's own
  // hard stops, which are [0, 90deg] unless it names a narrower window.
  const restA = stripFlapRestLift(geom, beta)
  const [lo, hi] = stripFlapTravel(geom)
  const fr = stripFlapFrame(geom, thetaL, thetaR)
  const rest = solveStripFlapPoseAt(geom, restA, thetaL, thetaR)
  return {
    name: id,
    grabPoint: centroid([...rest.right, ...rest.left]),
    project: (ray) => projectHingeAngle(ray, fr.center, fr.hinge, fr.flat, fr.n),
    driveFrom: (g, n) => stripFlapDetent(restA + wrapDelta(n - g), lo, hi),
    restDrive: restA,
    vertsAt: (a) => {
      const pose = solveStripFlapPoseAt(geom, a, thetaL, thetaR)
      return flatten([pose.right, pose.left])
    },
  }
}

function tabPieceCase(id: string): HandleCase {
  const { layer, spreadIndex } = locate(id)
  const geom = layer as SceneLayer & TabPieceGeom
  const { thetaL, thetaR } = restAngles(spreadIndex)
  const beta = thetaL - thetaR
  const t = geom.side === 'left' ? thetaL : thetaR
  const camA = tabPieceLift(geom, beta)
  const sStop = tabPieceStopSlide(geom)
  const aStop = tabPieceLiftFromSlide(geom, sStop)
  const sGrabStart = tabPieceSlideFromLift(geom, camA)
  const restPatches = solveTabPiecePoseAt(geom, camA, thetaL, thetaR)
  const tabQuad = restPatches[restPatches.length - 1].quad
  const ceiling = tabPieceCeiling(geom, beta)
  return {
    name: id,
    grabPoint: centroid(tabQuad),
    project: (ray) => projectPageD(ray, t),
    driveFrom: (g, n) =>
      tabPieceLiftFromSlide(geom, clamp(sGrabStart + (n - g), 0, sStop)),
    restDrive: camA,
    vertsAt: (a) =>
      flatten(solveTabPiecePoseAt(geom, Math.min(clamp(a, 0, aStop), ceiling), thetaL, thetaR).map((p) => p.quad)),
  }
}

function dissolveCase(id: string): HandleCase {
  const { layer, spreadIndex } = locate(id)
  const geom = layer as SceneLayer & DissolveGeom
  const { thetaL, thetaR } = restAngles(spreadIndex)
  const t = geom.side === 'left' ? thetaL : thetaR
  const stroke = dissolveStroke(geom)
  const deltaStart = dissolveTabOut(geom, 0)
  return {
    name: id,
    grabPoint: centroid(dissolveTabQuad(geom, 0, thetaL, thetaR)),
    project: (ray) => projectPageD(ray, t),
    driveFrom: (g, n) => dissolveTauFromDraw(geom, clamp(deltaStart + (n - g), 0, stroke)),
    restDrive: 0,
    vertsAt: (tau) => {
      const pose = solveDissolvePose(geom, tau, thetaL, thetaR)
      return flatten(pose.slats)
    },
  }
}

function swarmArcCase(id: string): HandleCase {
  const { layer, spreadIndex } = locate(id)
  const geom = layer as SceneLayer & SwarmArcGeom
  const { thetaL, thetaR } = restAngles(spreadIndex)
  const t = geom.stir.side === 'left' ? thetaL : thetaR
  return {
    name: id,
    grabPoint: centroid(swarmStirTabQuad(geom, 0, thetaL, thetaR)),
    project: (ray) => projectPageD(ray, t),
    driveFrom: (g, n) => clamp(0 + (n - g), 0, geom.stir.stroke),
    restDrive: 0,
    vertsAt: (s) => {
      // The stir must move the SWARM, not just the tab it is pulled by.
      const poses = solveSwarmArcPose(geom, thetaL, thetaR, s)
      return flatten(poses.flatMap((p) => [p.strut, p.rider]))
    },
  }
}

function keepsakeCase(id: string): HandleCase {
  const { layer, spreadIndex } = locate(id)
  const geom = layer as SceneLayer & KeepsakeGeom
  const { thetaL, thetaR } = restAngles(spreadIndex)
  const t = geom.side === 'left' ? thetaL : thetaR
  const pExit = keepsakePExit(geom)
  return {
    name: id,
    grabPoint: centroid(keepsakeCardInPlane(geom, 0, thetaL, thetaR)),
    project: (ray) => projectPageD(ray, t),
    driveFrom: (g, n) => clamp(0 + (n - g), 0, pExit),
    restDrive: 0,
    vertsAt: (p) => flatten([keepsakeCardInPlane(geom, p, thetaL, thetaR)]),
  }
}

/**
 * THE DISPATCH LINE's cable trolley — the one handle a blind reader called "the
 * one thing on the page that behaves like a paper toy", which makes it the one
 * this gate can least afford to leave uncovered.
 *
 * It is a CLASS A page-plane slide like the pull tabs, even though the piece it
 * rides stands off the page: the rider translates in the standing sheet, but the
 * sheet is rooted on the page, so the layer reads the drag off the carrying
 * page's plane through `projectPageD` on its own side.
 *
 * REST is drive 0, which is NOT s = 0: drive is the send stroke and the rider's
 * arc parameter is `dispatchLineRiderS(geom, drive)`, so at rest the trolley sits
 * at `riderHome` (0.06 as shipped) — `vertsAt` maps through the same function the
 * layer does so the gate cannot pass on an off-by-a-home error.
 */
function dispatchLineCase(id: string): HandleCase {
  const { layer, spreadIndex } = locate(id)
  const geom = layer as SceneLayer & DispatchLineGeom
  const { thetaL, thetaR } = restAngles(spreadIndex)
  const t = geom.side === 'left' ? thetaL : thetaR
  // The layer's own stroke, verbatim: a drag of the panel's WIDTH across the
  // sheet is a full send, which is what makes the gesture feel like the wire's
  // length. The floor guards a degenerate geom against a division blow-up.
  const stroke = Math.max(0.05, geom.w)
  const riderQuad = (drive: number): PanelQuad =>
    dispatchLineBasketQuad(geom, dispatchLineRiderS(geom, drive), thetaL, thetaR)
  return {
    name: id,
    // The reader grabs the trolley itself — there is no tab, the basket IS the
    // handle — so the aim point is its own centre at rest.
    grabPoint: centroid(riderQuad(0)),
    project: (ray) => projectPageD(ray, t),
    driveFrom: (g, n) => clamp(0 + (n - g) / stroke, 0, 1),
    restDrive: 0,
    // Deliberately the RIDER quad alone, not the panel: the panel is scenery and
    // is posed by the page angles, so including it would let a dead drive channel
    // pass on the sheet's own motion. What must travel is the thing the reader
    // has hold of.
    vertsAt: (drive) => flatten([riderQuad(drive)]),
  }
}

const HUB_DEADZONE = 0.18

function keepWinchCase(id: string): HandleCase {
  const { layer, spreadIndex } = locate(id)
  const geom = layer as SceneLayer & KeepWinchGeom
  const { thetaL, thetaR } = restAngles(spreadIndex)
  const t = geom.side === 'left' ? thetaL : thetaR
  const u: Vec3 = [Math.cos(t), Math.sin(t), 0]
  const n: Vec3 =
    geom.side === 'left' ? [Math.sin(t), -Math.cos(t), 0] : [-Math.sin(t), Math.cos(t), 0]
  const center: Vec3 = [
    geom.hubD * u[0] + ROTOR_LIFT * n[0],
    geom.hubD * u[1] + ROTOR_LIFT * n[1],
    geom.hubZ,
  ]
  const ez: Vec3 = [0, 0, 1]
  const thetaMax = keepWinchThetaMax(geom)
  // The reader grabs the rim, not the hub: the deadzone discards centre hits.
  const grabPoint = new THREE.Vector3(center[0], center[1], center[2]).addScaledVector(
    new THREE.Vector3(u[0], u[1], u[2]),
    geom.discR * 0.7
  )
  return {
    name: id,
    grabPoint,
    project: (ray) => {
      const hub = projectHubAngle(ray, center, u, ez, n)
      return hub && hub.r >= HUB_DEADZONE * geom.discR ? hub.angle : null
    },
    driveFrom: (g, nn) => clamp(0 + wrapDelta(nn - g), 0, thetaMax),
    restDrive: 0,
    vertsAt: (spin) =>
      flatten([
        keepWinchDiscQuad(geom, thetaL, thetaR, spin),
        ...keepWinchOutputQuads(geom, thetaL, thetaR, spin),
      ]),
  }
}

function volvelleCase(id: string): HandleCase {
  const { layer, spreadIndex } = locate(id)
  const geom = layer as SceneLayer & VolvelleGeom
  const { thetaL, thetaR } = restAngles(spreadIndex)
  const fr = volvelleHubFrame(geom, thetaL, thetaR, VOLVELLE_LIFT)
  const thetaMax = volvelleThetaMax()
  const grabPoint = new THREE.Vector3(fr.center[0], fr.center[1], fr.center[2]).addScaledVector(
    new THREE.Vector3(fr.e1[0], fr.e1[1], fr.e1[2]),
    geom.radius * 0.7
  )
  return {
    name: id,
    grabPoint,
    project: (ray) => {
      const hub = projectHubAngle(ray, fr.center, fr.e1, fr.e2, fr.n)
      return hub && hub.r >= HUB_DEADZONE * geom.radius ? hub.angle : null
    },
    driveFrom: (g, n) => clamp(0 + wrapDelta(n - g), 0, thetaMax),
    restDrive: 0,
    vertsAt: (spin) => flatten([solveVolvellePose(geom, thetaL, thetaR, spin).dial]),
  }
}

/** The knob tower ships no content entry today (its family code is live and
 *  reachable from the spread dispatcher), so the gate runs against a
 *  representative geom rather than skipping the family entirely. */
const KNOBTOWER_PROBE: KnobTowerGeom = {
  mech: 'knobtower',
  side: 'right',
  hubD: 0.5,
  hubZ: 0.2,
  discR: 0.12,
  crankR: 0.12,
  foreHingeD: 0.86,
  tiers: [
    { w: 0.1, aRestDeg: 62, zc: -0.12, ridgeLen: 0.2 },
    { w: 0.08, aRestDeg: 58, zc: 0.14, ridgeLen: 0.16 },
  ],
}

function knobTowerCase(): HandleCase {
  const geom = KNOBTOWER_PROBE
  const thetaL = Math.PI
  const thetaR = 0
  const t = geom.side === 'left' ? thetaL : thetaR
  const u: Vec3 = [Math.cos(t), Math.sin(t), 0]
  const n: Vec3 =
    geom.side === 'left' ? [Math.sin(t), -Math.cos(t), 0] : [-Math.sin(t), Math.cos(t), 0]
  const center: Vec3 = [
    geom.hubD * u[0] + ROTOR_LIFT * n[0],
    geom.hubD * u[1] + ROTOR_LIFT * n[1],
    geom.hubZ,
  ]
  const ez: Vec3 = [0, 0, 1]
  const thetaMax = knobTowerThetaMax(geom)
  return {
    name: 'knobtower(probe)',
    grabPoint: new THREE.Vector3(center[0], center[1], center[2]).addScaledVector(
      new THREE.Vector3(u[0], u[1], u[2]),
      geom.discR * 0.7
    ),
    project: (ray) => {
      const hub = projectHubAngle(ray, center, u, ez, n)
      return hub && hub.r >= HUB_DEADZONE * geom.discR ? hub.angle : null
    },
    driveFrom: (g, nn) => clamp(0 + wrapDelta(nn - g), 0, thetaMax),
    restDrive: 0,
    vertsAt: (spin) => flatten(solveKnobTowerPose(geom, thetaL, thetaR, spin).map((p) => p.quad)),
  }
}

// --- The gate ----------------------------------------------------------------

/** Best displacement over the eight probe directions, plus the direction that
 *  produced it (for a failure message a human can act on). */
function bestTravel(c: HandleCase): { travel: number; dir: number; drive: number } {
  const rayGrab = rayTo(c.grabPoint)
  const pGrab = c.project(rayGrab)
  expect(pGrab, `${c.name}: the projector missed its own handle at rest`).not.toBeNull()
  const restVerts = c.vertsAt(c.restDrive)
  let best = { travel: 0, dir: -1, drive: c.restDrive }
  DIRECTIONS.forEach((d, i) => {
    const pNow = c.project(rayTo(c.grabPoint.clone().addScaledVector(d, STROKE)))
    if (pNow === null) return
    const drive = c.driveFrom(pGrab as number, pNow)
    const travel = worstTravel(restVerts, c.vertsAt(drive))
    if (travel > best.travel) best = { travel, dir: i, drive }
  })
  return best
}

const CASES: HandleCase[] = [
  ...liftFlapCases('ch1-keyboard'),
  ...liftFlapCases('ch6-coffer'),
  stripFlapCase('ch1-rank'),
  // (ch3-ring-tower retired in ROUND-4 — the raven city's terraced roosts
  // replaced the gatehouse. Its dispatchline family is covered below.)
  stripFlapCase('ch5-throng'),
  stripFlapCase('ch5-tea'),
  stripFlapCase('ch6-clerk'),
  tabPieceCase('ch4-goldpile'),
  tabPieceCase('ch5-raise-stall'),
  dissolveCase('ch4-dissolve'),
  swarmArcCase('ch2-swarm'),
  keepsakeCase('end-keepsake'),
  keepWinchCase('ch3-keep-winch'),
  volvelleCase('ch3-dispatch'),
  // E3 WAVE-2 s7: the counting wheel, the spread's headline play. Listed
  // explicitly rather than leaning on the family-coverage guard (which is
  // satisfied by any ONE volvelle) — s7's whole S7-1 finding was a foreground
  // touch cue that did not move, and this is the gate that says it does.
  volvelleCase('ch6-assay'),
  dispatchLineCase('ch3-dispatch-line'),
  knobTowerCase(),
]

describe('handle drag regression — every grabbable must move paper', () => {
  it('covers every handle family the book ships', () => {
    // Guard against a family silently dropping out of the gate.
    const families = new Set<string>(
      CASES.map((c) => c.name.replace(/[#(].*$/, '')).map((id) =>
        id === 'knobtower' ? 'knobtower' : (locate(id).layer.mech as string)
      )
    )
    for (const family of [
      'liftflap',
      'stripflap',
      'tabpiece',
      'dissolve',
      'swarmarc',
      'keepsake',
      'keepwinch',
      'volvelle',
      'dispatchline',
      'knobtower',
    ]) {
      expect(families.has(family), `family ${family} is not covered`).toBe(true)
    }
  })

  for (const c of CASES) {
    it(`${c.name} answers a reader's drag with visible travel`, () => {
      const best = bestTravel(c)
      expect(
        best.travel,
        `${c.name}: no drag direction moved it (best ${best.travel.toFixed(4)} world units at ` +
          `drive ${best.drive.toFixed(4)}; the handle takes a grab and returns silence)`
      ).toBeGreaterThan(MIN_TRAVEL)
    })
  }
})

/**
 * THE WHOLE WINDOW, AND SOMETHING TO SEE FOR IT (E3 s2 round-2, S2R2-3).
 *
 * THE HOLE THIS CLOSES. The gate above passed s2's welcome rank the entire time
 * a blind re-reader was calling it "functionally dead — it advertises grab and
 * delivers an 8-12 px shift that is identical at 50 px and 900 px of travel".
 * Both of them were right, because MIN_TRAVEL is a LIVENESS floor: 0.02 world
 * units, about 8 screen px, taken as the best of eight directions. A piece whose
 * entire declared travel is worth 16 screen px clears it comfortably and is
 * still, to a reader, a picture that will not move.
 *
 * So this adds the two questions the liveness gate does not ask.
 *
 *  1. CAN A READER REACH BOTH STOPS? Not "does a drag change something" but
 *     "does a drag of reader scale carry the piece from one hard stop to the
 *     other, and back". This drives the pipeline TWICE — grabbing the piece
 *     where it actually is at each stop, because the grab point rides the pose
 *     — which is how a saturating projector (one that spends the whole window
 *     in twenty pixels and then answers nothing) and a starved one (which never
 *     arrives) both get caught by the same assertion.
 *
 *  2. IS THE WINDOW WORTH TRAVELLING? The piece's own worst-vertex displacement
 *     between its two stops, in reference-viewport pixels through the book's one
 *     camera definition (reading-stage.ts). The floor is the 25 px the s2 lane
 *     itself wrote into content.ts when it derived this rank's travel — the
 *     smallest excursion that lane was willing to call visible. The rank shipped
 *     at 16 px against its own note promising 60.
 *
 * Both run over EVERY strip flap the book ships, discovered from content rather
 * than listed, so a new figure cannot quietly arrive without answering them.
 */
describe('strip flaps — the reader must be able to sweep the whole window, and see it', () => {
  /** A big but ordinary reader drag: 0.4 world at the piece's depth is ~150 px
   *  at the pinned camera, roughly a thumb's length of pointer. */
  const STROKE_FULL = 0.4
  /** Radians of slack allowed at each stop (the detent lands exactly ON it, so
   *  this only absorbs the search grid's coarseness). */
  const STOP_EPS = 1e-6
  /** The visible-excursion floor, in REFERENCE_VIEW pixels. content.ts's own
   *  number, quoted: "comfortably over the 25px floor the sweep set". */
  const WINDOW_SCREEN_PX_MIN = 25

  /** 16 directions rather than 8: a projector with a narrow live sector (the
   *  cylinder read answers only where the flap has freedom) must not be able to
   *  fall between two probes. */
  const FINE_DIRECTIONS: readonly THREE.Vector3[] = (() => {
    const out: THREE.Vector3[] = []
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8
      out.push(SCREEN_RIGHT.clone().multiplyScalar(Math.cos(a)).addScaledVector(SCREEN_UP, Math.sin(a)))
    }
    return out
  })()

  const stripFlaps = (): { id: string; geom: SceneLayer & StripFlapGeom; spreadIndex: number }[] => {
    const out: { id: string; geom: SceneLayer & StripFlapGeom; spreadIndex: number }[] = []
    for (let s = 0; s < SPREAD_COUNT; s++) {
      for (const l of popupContentForSpread(s)?.layers ?? []) {
        if (l.mech === 'stripflap') out.push({ id: l.id, geom: l as SceneLayer & StripFlapGeom, spreadIndex: s })
      }
    }
    return out
  }

  /** The AUTHORED mechanisms: a strip flap whose lane wrote down a travel
   *  window has said, in content, "I intend the reader to move this between
   *  these two stops". The book's other strip flaps (the title quill, the
   *  satchel's sword and compass) are page-driven standing die-cuts that take
   *  the family's default [0, 90] and are dressing, not mechanisms � they are
   *  still held to the visible-excursion floor below, but nobody has promised a
   *  reader can walk them stop to stop. */
  const authored = () => stripFlaps().filter((f) => f.geom.travelDeg !== undefined)

  it('covers every strip flap in the book, and knows which are mechanisms', () => {
    expect(stripFlaps().map((f) => f.id).sort()).toEqual(
      ['ch1-rank', 'ch5-tea', 'ch5-throng', 'ch6-clerk', 'satchel-compass', 'satchel-sword', 'title-quill'].sort()
    )
    expect(authored().map((f) => f.id).sort()).toEqual(['ch1-rank', 'ch5-tea', 'ch5-throng'].sort())
  })

  for (const { id, geom, spreadIndex } of stripFlaps()) {
    /** The layer's own projector for this piece — the plane read, or the
     *  cylinder read for a piece whose swing plane the camera sees edge-on. */
    const project = (ray: THREE.Ray, fr: ReturnType<typeof stripFlapFrame>): number | null =>
      geom.grabProjection === 'cylinder'
        ? projectHingeAngleCyl(ray, fr.center, fr.hinge, fr.flat, fr.n, geom.height)
        : projectHingeAngle(ray, fr.center, fr.hinge, fr.flat, fr.n)

    /** Grab the piece AT `from`, drag STROKE_FULL in every direction, and report
     *  the extreme drive reached — exactly the layer's own arithmetic. */
    const sweepFrom = (from: number, want: 'up' | 'down'): number => {
      const { thetaL, thetaR } = restAngles(spreadIndex)
      const [lo, hi] = stripFlapTravel(geom)
      const fr = stripFlapFrame(geom, thetaL, thetaR)
      const pose = solveStripFlapPoseAt(geom, from, thetaL, thetaR)
      const grabPoint = centroid([...pose.right, ...pose.left])
      const pGrab = project(rayTo(grabPoint), fr)
      expect(pGrab, `${id}: the projector missed the piece at ${from.toFixed(3)} rad`).not.toBeNull()
      let best = from
      for (const d of FINE_DIRECTIONS) {
        const pNow = project(rayTo(grabPoint.clone().addScaledVector(d, STROKE_FULL)), fr)
        if (pNow === null) continue
        const drive = stripFlapDetent(from + wrapDelta(pNow - (pGrab as number)), lo, hi)
        if (want === 'up' ? drive > best : drive < best) best = drive
      }
      return best
    }

    it.skipIf(geom.travelDeg === undefined)(`${id}: a reader-scale drag carries it from stop to stop, both ways`, () => {
      const [lo, hi] = stripFlapTravel(geom)
      expect(hi - lo, `${id}: a travel window of zero width is not a mechanism`).toBeGreaterThan(0.01)
      expect(
        sweepFrom(lo, 'up'),
        `${id}: grabbed at its lower stop, no ${STROKE_FULL} drag reached the upper one ` +
          `(window ${((lo * 180) / Math.PI).toFixed(1)}..${((hi * 180) / Math.PI).toFixed(1)} deg)`
      ).toBeGreaterThanOrEqual(hi - STOP_EPS)
      expect(
        sweepFrom(hi, 'down'),
        `${id}: grabbed at its upper stop, no ${STROKE_FULL} drag brought it back down — ` +
          `a piece the reader can raise and never lower is a one-way switch, not a flap`
      ).toBeLessThanOrEqual(lo + STOP_EPS)
    })

    it(`${id}: the travel window is worth a reader's arm`, () => {
      const { thetaL, thetaR } = restAngles(spreadIndex)
      const [lo, hi] = stripFlapTravel(geom)
      const at = (a: number): { x: number; y: number }[] => {
        const p = solveStripFlapPoseAt(geom, a, thetaL, thetaR)
        return [...p.right, ...p.left].map((v) => toScreenPx(v))
      }
      const a = at(lo)
      const b = at(hi)
      let worst = 0
      for (let k = 0; k < a.length; k++) worst = Math.max(worst, Math.hypot(a[k].x - b[k].x, a[k].y - b[k].y))
      expect(
        worst,
        `${id}: its whole declared travel moves the paper ${worst.toFixed(1)} screen px at the ` +
          `reading camera. A reader cannot see that. (The usual cause is a swing plane the camera ` +
          `sees edge-on, where the tip's climb in y and its travel in z project to opposite screen ` +
          `directions and cancel. StripFlapGeom.hingeDeg is the dial that trades that cancellation ` +
          `for page-fore travel, and carries the derivation.)`
      ).toBeGreaterThanOrEqual(WINDOW_SCREEN_PX_MIN)
    })
  }
})

/**
 * THE EDGE-ON HINGE READ (E3 s2 round-2, S2R2-3) — a unit gate on the projector
 * itself, so the reason class B1-C exists is written down in an assertion rather
 * than only in a comment.
 *
 * The setup is s2's welcome rank in miniature and in the abstract: a hinge whose
 * axis runs ACROSS the screen, so the camera's view direction lies IN the swing
 * plane. This asserts the pathology of the plane read (a ten-pixel twitch
 * delivers more angle than the whole window) and that the cylinder read is
 * graded over the same strokes — small drag, small answer; reader-scale drag,
 * whole window.
 */
describe('projectHingeAngleCyl — the read for a swing plane seen edge-on', () => {
  const CENTER: Vec3 = [-0.34, 0, 0.4]
  const AXIS: Vec3 = [-1, 0, 0] // across the screen: the camera sits on x = 0
  const FLAT: Vec3 = [0, 0, 1]
  const NRM: Vec3 = [0, 1, 0]
  const R = 0.21
  /** The grab point: the flap's tip at 44 deg, where s2's rank is handed over. */
  const grabPoint = new THREE.Vector3(
    CENTER[0],
    CENTER[1] + R * Math.sin(Math.PI * (44 / 180)),
    CENTER[2] + R * Math.cos(Math.PI * (44 / 180))
  )
  /** ~10 px and ~150 px of pointer at this depth. */
  const TWITCH = 0.027
  const FULL = 0.4

  const spread = (project: (r: THREE.Ray) => number | null, stroke: number): number => {
    const pGrab = project(rayTo(grabPoint))
    if (pGrab === null) return NaN
    let worst = 0
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8
      const d = SCREEN_RIGHT.clone().multiplyScalar(Math.cos(a)).addScaledVector(SCREEN_UP, Math.sin(a))
      const pNow = project(rayTo(grabPoint.clone().addScaledVector(d, stroke)))
      // A null IS the pathology for the plane read (the ray misses the infinite
      // plane), and counts as an unbounded excursion for the purposes below.
      if (pNow === null) return Infinity
      worst = Math.max(worst, Math.abs(wrapDelta(pNow - pGrab)))
    }
    return worst
  }

  const planeRead = (r: THREE.Ray): number | null => projectHingeAngle(r, CENTER, AXIS, FLAT, NRM)
  const cylRead = (r: THREE.Ray): number | null => projectHingeAngleCyl(r, CENTER, AXIS, FLAT, NRM, R)

  it('the plane read saturates here — this is the defect, stated', () => {
    // Ten pixels of pointer buys more than a right angle (or misses the plane
    // outright). That is what "identical at 50 px and 900 px" looked like.
    expect(spread(planeRead, TWITCH)).toBeGreaterThan(Math.PI / 2)
  })

  it('the cylinder read is graded: a twitch is a twitch', () => {
    expect(spread(cylRead, TWITCH)).toBeLessThan((15 * Math.PI) / 180)
  })

  it('the cylinder read still spans a whole window on a real drag', () => {
    // s2's rank asks for 46 deg; a reader-scale drag must comfortably clear it.
    expect(spread(cylRead, FULL)).toBeGreaterThan((46 * Math.PI) / 180)
  })

  it('never returns null for a pointer anywhere on the stage', () => {
    // The silhouette clamp: past the tip circle the reader keeps a live handle.
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8
      const d = SCREEN_RIGHT.clone().multiplyScalar(Math.cos(a)).addScaledVector(SCREEN_UP, Math.sin(a))
      expect(cylRead(rayTo(grabPoint.clone().addScaledVector(d, 1.2)))).not.toBeNull()
    }
  })
})

/**
 * DIAL VISIBILITY (E3 s4 review, "dead handle #4"). The s4 reader reported the
 * SPIN dial showing both a `grab` and a `grabbing` cursor and then producing
 * "ZERO scene change" for 450 degrees of circular drag, linear drags, rim-peg
 * drags and clicks.
 *
 * The pipeline above proves that handle is LIVE: its projector, its drive
 * arithmetic and its solver move the dial's own vertices 0.26 world units. So
 * the failure is DOWNSTREAM of the mechanism, and it has a specific shape worth
 * gating: a dial that snaps to a detent whose step equals its own art's
 * rotational symmetry period renders pixel-identically after ANY drag. The
 * reader measured after release, which is exactly when the snap has landed.
 *
 * The mechanism's OBSERVABLE output is which sector each window frames. This
 * asserts that a single detent step changes every window's reading — i.e. the
 * mechanism does have something to show. Whether the reader can SEE it is then
 * purely a question of the dial's sectors being painted differently from one
 * another, which is a scene-lane art requirement, not an input one.
 */
describe('volvelle — a detent step must change what the windows frame', () => {
  it('ch3-dispatch: every window reads a different sector one detent on', () => {
    const { layer } = locate('ch3-dispatch')
    const geom = layer as SceneLayer & VolvelleGeom
    const step = volvelleDetentStep(geom)
    expect(geom.windows.length).toBeGreaterThan(0)
    for (const w of geom.windows) {
      const at0 = volvelleSectorSeen(geom, w, 0)
      const at1 = volvelleSectorSeen(geom, w, step)
      expect(at1).not.toBe(at0)
    }
  })

  it('ch3-dispatch: a full turn walks every sector past a window', () => {
    const { layer } = locate('ch3-dispatch')
    const geom = layer as SceneLayer & VolvelleGeom
    const step = volvelleDetentStep(geom)
    const seen = new Set<number>()
    for (let k = 0; k < geom.sectors; k++) seen.add(volvelleSectorSeen(geom, geom.windows[0], k * step))
    // If a drag cannot bring a new sector into view, no art could rescue it.
    expect(seen.size).toBe(geom.sectors)
  })
})

/**
 * THE TROLLEY MUST STAY FINDABLE ALONG ITS WHOLE TRAVEL.
 *
 * The blind reader who called the dispatch line "the one thing on the page that
 * behaves like a paper toy" reported the defect that nearly cost it: "the grab
 * box is ~26x40 px" — a handle it had to hunt for. `handle-hit.ts` answers that
 * with HANDLE_MIN_HIT, an absolute world-unit floor (~45 screen px at the pinned
 * reading camera) that `handleSlopFactor` grows a pad until the piece's SHORTEST
 * edge clears.
 *
 * This gate holds the trolley to that floor at STATIONS ALONG ITS TRAVEL, not
 * just at home, because the reader's other finding was that after one trip the
 * handle is somewhere else — a floor that only held at rest would be no floor at
 * all. Everything below is derived from the shipped geom and the shipped
 * constants: no pixel number appears in an assertion.
 */
describe('dispatch line — the trolley clears the book hit floor along the wire', () => {
  /** The layer's own slop pad, scaled about the quad's centroid. Same helper
   *  popup-dispatchline-layer.tsx writes into its slop geometry each frame. */
  const enlargeQuad = (quad: PanelQuad, kf: number): Vec3[] => {
    const c = centroid(quad)
    return quad.map((p) => [
      c.x + (p[0] - c.x) * kf,
      c.y + (p[1] - c.y) * kf,
      c.z + (p[2] - c.z) * kf,
    ] as Vec3)
  }

  const shortestEdge = (quad: readonly Vec3[]): number => {
    let shortest = Infinity
    for (let i = 0; i < 4; i++) {
      const a = quad[i]
      const b = quad[(i + 1) % 4]
      shortest = Math.min(shortest, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]))
    }
    return shortest
  }

  const STATIONS = [0, 0.25, 0.5, 0.75, 1] as const

  it('ch3-dispatch-line: the padded grab surface clears HANDLE_MIN_HIT at every station', () => {
    const { layer, spreadIndex } = locate('ch3-dispatch-line')
    const geom = layer as SceneLayer & DispatchLineGeom
    const { thetaL, thetaR } = restAngles(spreadIndex)
    for (const drive of STATIONS) {
      const quad = dispatchLineBasketQuad(geom, dispatchLineRiderS(geom, drive), thetaL, thetaR)
      // HANDLE_SLOP_STANDING is the base the layer picks: the rider is in-plane
      // on a sheet that STANDS off the page, so it presents its face to the
      // camera rather than foreshortening to a sliver.
      const padded = enlargeQuad(quad, handleSlopFactor(quad, HANDLE_SLOP_STANDING))
      // The floor binds exactly (the factor is HANDLE_MIN_HIT / shortest), so the
      // comparison carries a float epsilon rather than a safety margin.
      expect(
        shortestEdge(padded),
        `trolley at drive ${drive}: die-cut short edge ${shortestEdge(quad).toFixed(4)} padded to ` +
          `${shortestEdge(padded).toFixed(4)}, under the book's ${HANDLE_MIN_HIT} floor`
      ).toBeGreaterThanOrEqual(HANDLE_MIN_HIT - 1e-9)
    }
  })

  it('ch3-dispatch-line: the pad grows the die-cut rather than replacing it', () => {
    // A pad that shrank a handle, or one applied to a quad that had already
    // cleared the floor, would both be bugs — the law is "at least `base`, and
    // enough to reach the floor" (handle-hit.ts).
    const { layer, spreadIndex } = locate('ch3-dispatch-line')
    const geom = layer as SceneLayer & DispatchLineGeom
    const { thetaL, thetaR } = restAngles(spreadIndex)
    const quad = dispatchLineBasketQuad(geom, dispatchLineRiderS(geom, 0), thetaL, thetaR)
    const kf = handleSlopFactor(quad, HANDLE_SLOP_STANDING)
    expect(kf).toBeGreaterThanOrEqual(HANDLE_SLOP_STANDING)
    expect(shortestEdge(enlargeQuad(quad, kf))).toBeGreaterThan(shortestEdge(quad))
  })
})
