/**
 * GESTURE-AXIS HONESTY — "a handle must respond to the drag it looks like it
 * takes."
 *
 * WHY (blind re-review of spread 3, 2026-07-26): the STIR THE SWARM pull tab
 * "responded to a drag that pulled UP while the tab itself visibly moved
 * DOWN-RIGHT". A control that moves at right angles to the gesture driving it
 * reads as broken no matter how live it is, and `handle-drag-regression.test.ts`
 * cannot see that: it asks only whether SOME of eight drag directions moves
 * paper, so a handle whose one live direction is the one no reader would try
 * passes it.
 *
 * WHAT THE MEASUREMENT SAID ABOUT THE SWARM TAB. Not an inversion. Its response
 * axis is up-right (0.90, 0.44), its travel axis is right (1.00, 0.07): 22.1 deg
 * apart, same sign, the TIGHTEST of the book's four page-plane slides (keepsake
 * 24.9, dissolve 28.0, goldpile 29.4, stall 29.0). The up-component is not the
 * tab's doing at all — it is `projectPageD` reading the pointer against a
 * near-horizontal page from a camera 26 deg above it, where raising the aim
 * pushes the ray's page intersection outward along the fore axis. What the
 * reader actually met was SATURATION: the whole stroke was spent in 58 px of
 * hand, so a flick in any roughly-rightward direction slammed it to the stop
 * before the reader could feel which way they were pulling. That is fixed by
 * gearing (SWARM_STIR_GEAR) and benched at the bottom of this file.
 *
 * THE LAW GATED HERE. For every grabbable in the book, the direction the reader
 * must drag to increase the drive (the RESPONSE AXIS) and the direction the
 * handle visibly travels for that same increase (the TRAVEL AXIS) must agree to
 * within MAX_MISMATCH_DEG, and must agree in SIGN — dragging the way the paper
 * goes may never wind the mechanism backwards.
 *
 * BOTH AXES ARE MEASURED, NEVER DECLARED. The response axis is the screen
 * gradient of the layer's REAL projector (book/handle-projection.ts) around the
 * reader's aim point. The travel axis is the screen displacement of the very
 * point of paper under that aim, tracked through the layer's REAL pose solver as
 * the drive advances. Both live in the reading camera's screen basis, derived
 * from reading-stage.ts so this file cannot drift from where the reader's eye
 * actually is.
 *
 * ROTARY HANDLES (volvelle, keep winch, knob tower). A disc does not travel
 * along a line, so "the travel axis" is stated for a rotation the way it is
 * meant: the TANGENTIAL direction at the grab point — where the grabbed patch of
 * paper goes for a small positive drive increment. That falls out of the same
 * material-point tracking as every other family, because a point tracked through
 * a spinning quad moves tangentially by construction. The law is unchanged: the
 * hand must push the way the paper under the hand goes.
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
  type DissolveGeom,
} from '@/components/labs/storybook/book/popup-dissolve'
import {
  SWARM_STIR_GEAR,
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
  volvelleHubFrame,
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
  CAMERA_LOOKAT,
  CAMERA_POSITION,
  toScreenPx,
} from '@/components/labs/storybook/book/reading-stage'
import {
  SPREAD_COUNT,
  popupContentForSpread,
  type SceneLayer,
} from '@/components/labs/storybook/content'

// --- The reading stage, from the book's one camera definition -----------------

const CAMERA = new THREE.Vector3(...CAMERA_POSITION)
const LOOK_AT = new THREE.Vector3(...CAMERA_LOOKAT)
const VIEW = LOOK_AT.clone().sub(CAMERA).normalize()
const SCREEN_RIGHT = VIEW.clone().cross(new THREE.Vector3(0, 1, 0)).normalize()
const SCREEN_UP = SCREEN_RIGHT.clone().cross(VIEW).normalize()

/** THE BAR. Beyond a quarter turn between hand and paper a reader stops reading
 *  the handle as a thing they are moving and starts reading it as a thing that
 *  reacts to them — which is the difference between a paper tab and a slider
 *  wired up wrong. 45 deg is generous on purpose: this gate is for gross
 *  mismatches (a swapped axis, an inverted sign), not for fine tuning. */
const MAX_MISMATCH_DEG = 45

/** Aim-point offset for the projector's screen gradient, in world units at the
 *  handle's own depth (~4 reference px). Small enough that the projector is
 *  locally linear, large enough to stay clear of float noise. */
const PROBE = 0.01

/** A reader-scale drag, world units at the handle's depth (~75 reference px) —
 *  the same stroke handle-drag-regression.test.ts probes with. */
const STROKE = 0.2

const rayTo = (p: THREE.Vector3): THREE.Ray =>
  new THREE.Ray(CAMERA.clone(), p.clone().sub(CAMERA).normalize())

const centroid = (quad: readonly Vec3[] | PanelQuad): THREE.Vector3 => {
  const v = new THREE.Vector3()
  for (const c of quad) v.add(new THREE.Vector3(c[0], c[1], c[2]))
  return v.multiplyScalar(1 / quad.length)
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const wrapDelta = (d: number): number => Math.atan2(Math.sin(d), Math.cos(d))
const deg = (r: number): number => (r * 180) / Math.PI

/** Rest page angles for the spread a layer lives on (no turn in flight). */
function restAngles(spreadIndex: number): { thetaL: number; thetaR: number } {
  expect(liveSpreadRole(spreadIndex, spreadIndex, null)).toBe('current')
  return spreadPageAnglesTilted(spreadIndex, spreadIndex, null, 0)
}

/** Locate a layer anywhere in the book (spread index included). */
function locate(id: string): { layer: SceneLayer; spreadIndex: number } {
  for (let s = 0; s < SPREAD_COUNT; s++) {
    const layer = popupContentForSpread(s)?.layers.find((l) => l.id === id)
    if (layer) return { layer, spreadIndex: s }
  }
  throw new Error(`no layer ${id} in the book`)
}

// --- Screen-space axis arithmetic --------------------------------------------

/** A unit direction in the reader's screen basis: x right, y up. */
type ScreenAxis = { x: number; y: number }

const unit = (x: number, y: number): ScreenAxis => {
  const l = Math.hypot(x, y)
  return l > 1e-12 ? { x: x / l, y: y / l } : { x: 0, y: 0 }
}

/** Angle between two screen axes, in degrees. */
const between = (a: ScreenAxis, b: ScreenAxis): number =>
  deg(Math.acos(clamp(a.x * b.x + a.y * b.y, -1, 1)))

const fmt = (a: ScreenAxis): string => `(${a.x.toFixed(2)}, ${a.y.toFixed(2)})`

/** A screen axis named the way a reader would name it. */
function compass(a: ScreenAxis): string {
  const names = ['right', 'up-right', 'up', 'up-left', 'left', 'down-left', 'down', 'down-right']
  const k = Math.round((Math.atan2(a.y, a.x) * 4) / Math.PI)
  return names[((k % 8) + 8) % 8]
}

/** A world point in the screen basis (y UP, unlike toScreenPx's y-down pixels).
 *  Pixels, so the two axes are commensurate under the camera's aspect. */
const screenXY = (p: Vec3): { x: number; y: number } => {
  const px = toScreenPx(p)
  return { x: px.x, y: -px.y }
}

// --- Material-point tracking --------------------------------------------------
// A handle's travel axis is where THE PAPER UNDER THE READER'S FINGER goes, not
// where the quad's centroid goes: a spinning disc has a stationary centroid and
// is nonetheless the clearest case of a handle that travels. So the aim point is
// resolved to coordinates in the handle quad's own basis once, and re-evaluated
// in the quad's basis at a second drive value. For a rigid quad (every disc) and
// for a parallelogram slide (every tab) this is exact.

const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot3 = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

function materialCoords(quad: readonly Vec3[], p: THREE.Vector3): { s: number; t: number } {
  const A = sub3(quad[1], quad[0])
  const B = sub3(quad[3], quad[0])
  const d = sub3([p.x, p.y, p.z], quad[0])
  const aa = dot3(A, A)
  const ab = dot3(A, B)
  const bb = dot3(B, B)
  const det = aa * bb - ab * ab
  if (Math.abs(det) < 1e-18) return { s: 0.5, t: 0.5 }
  return {
    s: (dot3(d, A) * bb - dot3(d, B) * ab) / det,
    t: (dot3(d, B) * aa - dot3(d, A) * ab) / det,
  }
}

function materialPoint(quad: readonly Vec3[], s: number, t: number): Vec3 {
  const A = sub3(quad[1], quad[0])
  const B = sub3(quad[3], quad[0])
  return [
    quad[0][0] + s * A[0] + t * B[0],
    quad[0][1] + s * A[1] + t * B[1],
    quad[0][2] + s * A[2] + t * B[2],
  ]
}

// --- One grabbable, described end to end -------------------------------------

type AxisCase = {
  /** Layer id (or `id#door`) — the test name. */
  name: string
  family: string
  rotary: boolean
  /** A point ON the handle surface at rest, in the layer's local frame. */
  grabPoint: THREE.Vector3
  /** The layer's real projector applied to a ray, or null on a miss. */
  project: (ray: THREE.Ray) => number | null
  /** The layer's real drive arithmetic: grab scalar + current scalar -> drive. */
  driveFrom: (pGrab: number, pNow: number) => number
  /** Where the piece sits with no reader input, and its hard stops. */
  restDrive: number
  driveRange: readonly [number, number]
  /** The surface the reader has hold of, posed at a drive value. */
  handleQuad: (drive: number) => readonly Vec3[]
  /** Drive increment used to read the travel direction (piece units). */
  driveStep: number
}

/** The screen direction a drag must go to INCREASE the projector's reading:
 *  the gradient of the real projector about the reader's aim point. */
function responseAxis(c: AxisCase): ScreenAxis {
  const at = (d: THREE.Vector3, k: number): number | null =>
    c.project(rayTo(c.grabPoint.clone().addScaledVector(d, k)))
  const along = (d: THREE.Vector3): number => {
    const plus = at(d, PROBE)
    const minus = at(d, -PROBE)
    if (plus === null || minus === null) {
      // One-sided where the ray leaves the working plane on one side (the
      // edge-on hinge read): the live half still names the direction.
      const p0 = c.project(rayTo(c.grabPoint))
      if (p0 === null) return 0
      if (plus !== null) return wrapDelta(plus - p0)
      if (minus !== null) return -wrapDelta(minus - p0)
      return 0
    }
    return wrapDelta(plus - minus)
  }
  return unit(along(SCREEN_RIGHT), along(SCREEN_UP))
}

/** The screen direction the grabbed patch of paper travels as the drive rises —
 *  a straight slide for a tab, the tangent at the grab radius for a disc. */
function travelAxis(c: AxisCase): ScreenAxis {
  const [lo, hi] = c.driveRange
  const a = Math.max(lo, c.restDrive - c.driveStep)
  const b = Math.min(hi, c.restDrive + c.driveStep)
  const { s, t } = materialCoords(c.handleQuad(c.restDrive), c.grabPoint)
  const pa = screenXY(materialPoint(c.handleQuad(a), s, t))
  const pb = screenXY(materialPoint(c.handleQuad(b), s, t))
  return unit(pb.x - pa.x, pb.y - pa.y)
}

/** What a reader-scale drag ALONG the piece's own travel direction does to the
 *  drive. Positive is the only honest answer: pulling a tab the way it comes out
 *  must draw it further out. */
function driveAfterDragAlongTravel(c: AxisCase, axis: ScreenAxis): number | null {
  const dir = SCREEN_RIGHT.clone().multiplyScalar(axis.x).addScaledVector(SCREEN_UP, axis.y)
  const pGrab = c.project(rayTo(c.grabPoint))
  const pNow = c.project(rayTo(c.grabPoint.clone().addScaledVector(dir, STROKE)))
  if (pGrab === null || pNow === null) return null
  return c.driveFrom(pGrab, pNow)
}

// --- Case builders (one per family) ------------------------------------------

function liftFlapCases(id: string): AxisCase[] {
  const { layer, spreadIndex } = locate(id)
  const geom = layer as SceneLayer & LiftFlapGeom
  const { thetaL, thetaR } = restAngles(spreadIndex)
  const max = liftFlapMax(geom)
  return geom.doors.map((_, k) => {
    const fr = liftFlapHingeFrame(geom, k, thetaL, thetaR)
    const shut = liftFlapDoorQuad(geom, k, 0, thetaL, thetaR)
    const grabPoint = centroid([shut[1], shut[2]]).lerp(centroid(shut), 0.35)
    return {
      name: `${id}#door${k}`,
      family: 'liftflap',
      rotary: false,
      grabPoint,
      project: (ray: THREE.Ray) => projectHingeAngle(ray, fr.center, fr.axis, fr.flat, fr.n),
      driveFrom: (g: number, n: number) => clamp(0 + wrapDelta(n - g), 0, max),
      restDrive: 0,
      driveRange: [0, max] as const,
      handleQuad: (a: number) => liftFlapDoorQuad(geom, k, a, thetaL, thetaR),
      driveStep: Math.min(0.12, max / 4),
    }
  })
}

function stripFlapCase(id: string): AxisCase {
  const { layer, spreadIndex } = locate(id)
  const geom = layer as SceneLayer & StripFlapGeom
  const { thetaL, thetaR } = restAngles(spreadIndex)
  const beta = thetaL - thetaR
  const restA = stripFlapRestLift(geom, beta)
  const [lo, hi] = stripFlapTravel(geom)
  const fr = stripFlapFrame(geom, thetaL, thetaR)
  // The layer raycasts the WHOLE flap (both halves' base ends and their tops —
  // popup-stripflap-layer.tsx's `full`), so that is the paper the aim point sits
  // on and the paper whose motion the reader attributes to their own hand.
  const panel = (a: number): PanelQuad => {
    const pose = solveStripFlapPoseAt(geom, a, thetaL, thetaR)
    return [pose.left[1], pose.right[1], pose.right[2], pose.left[2]]
  }
  return {
    name: id,
    family: 'stripflap',
    rotary: false,
    grabPoint: centroid(panel(restA)),
    project: (ray: THREE.Ray) =>
      geom.grabProjection === 'cylinder'
        ? projectHingeAngleCyl(ray, fr.center, fr.hinge, fr.flat, fr.n, geom.height)
        : projectHingeAngle(ray, fr.center, fr.hinge, fr.flat, fr.n),
    driveFrom: (g: number, n: number) => stripFlapDetent(restA + wrapDelta(n - g), lo, hi),
    restDrive: restA,
    driveRange: [lo, hi] as const,
    handleQuad: panel,
    driveStep: Math.min(0.12, (hi - lo) / 4),
  }
}

function tabPieceCase(id: string): AxisCase {
  const { layer, spreadIndex } = locate(id)
  const geom = layer as SceneLayer & TabPieceGeom
  const { thetaL, thetaR } = restAngles(spreadIndex)
  const beta = thetaL - thetaR
  const t = geom.side === 'left' ? thetaL : thetaR
  const camA = tabPieceLift(geom, beta)
  const sStop = tabPieceStopSlide(geom)
  const aStop = tabPieceLiftFromSlide(geom, sStop)
  const sGrabStart = tabPieceSlideFromLift(geom, camA)
  const ceiling = tabPieceCeiling(geom, beta)
  // The tab is the LAST patch the pose emits — the piece the reader pinches.
  const tabAt = (a: number): PanelQuad => {
    const patches = solveTabPiecePoseAt(geom, Math.min(clamp(a, 0, aStop), ceiling), thetaL, thetaR)
    return patches[patches.length - 1].quad
  }
  return {
    name: id,
    family: 'tabpiece',
    rotary: false,
    grabPoint: centroid(tabAt(camA)),
    project: (ray: THREE.Ray) => projectPageD(ray, t),
    driveFrom: (g: number, n: number) =>
      tabPieceLiftFromSlide(geom, clamp(sGrabStart + (n - g), 0, sStop)),
    restDrive: camA,
    driveRange: [0, Math.min(aStop, ceiling)] as const,
    handleQuad: tabAt,
    driveStep: Math.min(0.1, Math.max(1e-3, (Math.min(aStop, ceiling) - camA) / 4)),
  }
}

function dissolveCase(id: string): AxisCase {
  const { layer, spreadIndex } = locate(id)
  const geom = layer as SceneLayer & DissolveGeom
  const { thetaL, thetaR } = restAngles(spreadIndex)
  const t = geom.side === 'left' ? thetaL : thetaR
  const stroke = dissolveStroke(geom)
  const deltaStart = dissolveTabOut(geom, 0)
  const tauMax = dissolveTauFromDraw(geom, stroke)
  return {
    name: id,
    family: 'dissolve',
    rotary: false,
    grabPoint: centroid(dissolveTabQuad(geom, 0, thetaL, thetaR)),
    project: (ray: THREE.Ray) => projectPageD(ray, t),
    driveFrom: (g: number, n: number) =>
      dissolveTauFromDraw(geom, clamp(deltaStart + (n - g), 0, stroke)),
    restDrive: 0,
    driveRange: [0, tauMax] as const,
    handleQuad: (tau: number) => dissolveTabQuad(geom, tau, thetaL, thetaR),
    driveStep: tauMax / 8,
  }
}

function swarmArcCase(id: string): AxisCase {
  const { layer, spreadIndex } = locate(id)
  const geom = layer as SceneLayer & SwarmArcGeom
  const { thetaL, thetaR } = restAngles(spreadIndex)
  const t = geom.stir.side === 'left' ? thetaL : thetaR
  return {
    name: id,
    family: 'swarmarc',
    rotary: false,
    grabPoint: centroid(swarmStirTabQuad(geom, 0, thetaL, thetaR)),
    project: (ray: THREE.Ray) => projectPageD(ray, t),
    driveFrom: (g: number, n: number) =>
      clamp(0 + (n - g) * SWARM_STIR_GEAR, 0, geom.stir.stroke),
    restDrive: 0,
    driveRange: [0, geom.stir.stroke] as const,
    handleQuad: (s: number) => swarmStirTabQuad(geom, s, thetaL, thetaR),
    driveStep: geom.stir.stroke / 4,
  }
}

function keepsakeCase(id: string): AxisCase {
  const { layer, spreadIndex } = locate(id)
  const geom = layer as SceneLayer & KeepsakeGeom
  const { thetaL, thetaR } = restAngles(spreadIndex)
  const t = geom.side === 'left' ? thetaL : thetaR
  const pExit = keepsakePExit(geom)
  return {
    name: id,
    family: 'keepsake',
    rotary: false,
    grabPoint: centroid(keepsakeCardInPlane(geom, 0, thetaL, thetaR)),
    project: (ray: THREE.Ray) => projectPageD(ray, t),
    driveFrom: (g: number, n: number) => clamp(0 + (n - g), 0, pExit),
    restDrive: 0,
    driveRange: [0, pExit] as const,
    handleQuad: (p: number) => keepsakeCardInPlane(geom, p, thetaL, thetaR),
    driveStep: pExit / 4,
  }
}

function dispatchLineCase(id: string): AxisCase {
  const { layer, spreadIndex } = locate(id)
  const geom = layer as SceneLayer & DispatchLineGeom
  const { thetaL, thetaR } = restAngles(spreadIndex)
  const t = geom.side === 'left' ? thetaL : thetaR
  const stroke = Math.max(0.05, geom.w)
  const riderQuad = (drive: number): PanelQuad =>
    dispatchLineBasketQuad(geom, dispatchLineRiderS(geom, drive), thetaL, thetaR)
  return {
    name: id,
    family: 'dispatchline',
    rotary: false,
    grabPoint: centroid(riderQuad(0)),
    project: (ray: THREE.Ray) => projectPageD(ray, t),
    driveFrom: (g: number, n: number) => clamp(0 + (n - g) / stroke, 0, 1),
    restDrive: 0,
    driveRange: [0, 1] as const,
    handleQuad: riderQuad,
    driveStep: 0.15,
  }
}

const HUB_DEADZONE = 0.18

function keepWinchCase(id: string): AxisCase {
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
  const grabPoint = new THREE.Vector3(center[0], center[1], center[2]).addScaledVector(
    new THREE.Vector3(u[0], u[1], u[2]),
    geom.discR * 0.7
  )
  return {
    name: id,
    family: 'keepwinch',
    rotary: true,
    grabPoint,
    project: (ray: THREE.Ray) => {
      const hub = projectHubAngle(ray, center, u, ez, n)
      return hub && hub.r >= HUB_DEADZONE * geom.discR ? hub.angle : null
    },
    driveFrom: (g: number, nn: number) => clamp(0 + wrapDelta(nn - g), 0, thetaMax),
    restDrive: 0,
    driveRange: [0, thetaMax] as const,
    handleQuad: (spin: number) => keepWinchDiscQuad(geom, spin, thetaL, thetaR),
    driveStep: Math.min(0.15, thetaMax / 6),
  }
}

function volvelleCase(id: string): AxisCase {
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
    family: 'volvelle',
    rotary: true,
    grabPoint,
    project: (ray: THREE.Ray) => {
      const hub = projectHubAngle(ray, fr.center, fr.e1, fr.e2, fr.n)
      return hub && hub.r >= HUB_DEADZONE * geom.radius ? hub.angle : null
    },
    driveFrom: (g: number, n: number) => clamp(0 + wrapDelta(n - g), 0, thetaMax),
    restDrive: 0,
    driveRange: [0, thetaMax] as const,
    handleQuad: (spin: number) => solveVolvellePose(geom, thetaL, thetaR, spin).dial,
    driveStep: 0.15,
  }
}

/** The knob tower ships no content entry today (its family code is live and
 *  reachable from the spread dispatcher), so the gate runs against the same
 *  representative geom handle-drag-regression.test.ts uses. */
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

function knobTowerCase(): AxisCase {
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
    family: 'knobtower',
    rotary: true,
    grabPoint: new THREE.Vector3(center[0], center[1], center[2]).addScaledVector(
      new THREE.Vector3(u[0], u[1], u[2]),
      geom.discR * 0.7
    ),
    project: (ray: THREE.Ray) => {
      const hub = projectHubAngle(ray, center, u, ez, n)
      return hub && hub.r >= HUB_DEADZONE * geom.discR ? hub.angle : null
    },
    driveFrom: (g: number, nn: number) => clamp(0 + wrapDelta(nn - g), 0, thetaMax),
    restDrive: 0,
    driveRange: [0, thetaMax] as const,
    // The disc is the first patch the pose emits — the knob, not the mounds.
    handleQuad: (spin: number) => solveKnobTowerPose(geom, spin, thetaL, thetaR)[0].quad,
    driveStep: Math.min(0.15, thetaMax / 6),
  }
}

const CASES: AxisCase[] = [
  ...liftFlapCases('ch1-keyboard'),
  ...liftFlapCases('ch6-coffer'),
  stripFlapCase('ch1-rank'),
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
  volvelleCase('ch6-assay'),
  dispatchLineCase('ch3-dispatch-line'),
  knobTowerCase(),
]

// --- Findings this lane may not fix ------------------------------------------
/**
 * Handles that FAIL the axis law today and whose layers belong to other lanes
 * (SP-4 owns only the swarm arc). They are marked `it.fails` rather than deleted
 * so the finding stays in the suite and cannot be lost: the moment the owning
 * lane fixes one, its `it.fails` starts failing and the mark comes out with the
 * fix. The measured mismatch at the time of writing is quoted so nobody has to
 * re-derive it to know whether they have moved the number.
 *
 * All five share one shape: the piece travels along an axis its projector does
 * not read. The three plane-read strip flaps and the trolley are the acute
 * cases — the trolley rides an arc across the wire while `projectPageD` reads
 * only the page-fore component of the hand, and the strip flaps read a swing
 * plane the reading camera very nearly lies in (the pathology class B1-C exists
 * for; ch1-rank already uses the cylinder read and is still inverted).
 */
const OTHER_LANE_AXIS_FAILURES: Record<string, string> = {
  'ch1-rank': '110.9 deg (drag DOWN raises it) — popup-stripflap-layer.tsx, stripflap lane',
  'ch5-throng': '73.1 deg — popup-stripflap-layer.tsx, stripflap lane',
  'ch5-tea': '71.8 deg — popup-stripflap-layer.tsx, stripflap lane',
  'ch6-clerk': '51.3 deg — popup-stripflap-layer.tsx, stripflap lane',
  'ch3-dispatch-line': '64.9 deg (rides the wire, reads page-fore) — popup-dispatchline-layer.tsx',
}

// --- The gate ----------------------------------------------------------------

describe('gesture axis honesty — hand and paper must agree', () => {
  it('covers every handle family the book ships', () => {
    const families = new Set(CASES.map((c) => c.family))
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

  it('the known-failure list names only handles this lane does not own', () => {
    // A guard on the escape hatch above: every entry must still be a real case,
    // so a renamed or retired handle cannot leave a silent exemption behind.
    const names = new Set(CASES.map((c) => c.name))
    for (const id of Object.keys(OTHER_LANE_AXIS_FAILURES)) {
      expect(names.has(id), `${id} is exempted but is not a case any more`).toBe(true)
    }
    expect(OTHER_LANE_AXIS_FAILURES['ch2-swarm']).toBeUndefined()
  })

  for (const c of CASES) {
    const what = c.rotary ? 'tangent at the grab point' : 'travel'
    const known = OTHER_LANE_AXIS_FAILURES[c.name]
    // `it.fails` = this assertion is EXPECTED to fail and the reason is filed
    // against another lane. When they fix it this line goes red and comes out.
    const axisIt = known ? it.fails : it

    axisIt(`${c.name}: the drag axis it answers matches the ${what} axis it shows`, () => {
      expect(c.project(rayTo(c.grabPoint)), `${c.name}: the projector missed its own handle`)
        .not.toBeNull()
      const response = responseAxis(c)
      const travel = travelAxis(c)
      expect(Math.hypot(response.x, response.y), `${c.name}: the projector has no live axis here`)
        .toBeGreaterThan(0.5)
      expect(Math.hypot(travel.x, travel.y), `${c.name}: the handle shows no travel at all`)
        .toBeGreaterThan(0.5)
      const angle = between(response, travel)
      expect(
        angle,
        `${c.name} (${c.family}): the reader must drag ${compass(response)} ${fmt(response)} to ` +
          `work it, but the paper under their finger goes ${compass(travel)} ${fmt(travel)} — ` +
          `${angle.toFixed(1)} deg apart, over the ${MAX_MISMATCH_DEG} deg bar. Hand and paper ` +
          `disagree, which reads as a broken control however live the handle is.`
      ).toBeLessThanOrEqual(MAX_MISMATCH_DEG)
    })

    it(`${c.name}: dragging the way it travels winds it forward, not backward`, () => {
      const travel = travelAxis(c)
      const drive = driveAfterDragAlongTravel(c, travel)
      expect(drive, `${c.name}: a drag along its own travel axis left the working plane`)
        .not.toBeNull()
      const [, hi] = c.driveRange
      // A piece already parked at its upper stop has nowhere forward to go; the
      // axis test above still holds it to the law.
      if (c.restDrive >= hi - 1e-9) return
      expect(
        drive as number,
        `${c.name} (${c.family}): pulling ${compass(travel)} ${fmt(travel)} — the direction the ` +
          `handle itself moves — drove it from ${c.restDrive.toFixed(4)} to ` +
          `${(drive as number).toFixed(4)}. A handle that retreats from the hand that follows it ` +
          `is inverted, not merely mis-axed.`
      ).toBeGreaterThan(c.restDrive)
    })
  }
})

/**
 * HOW MUCH HAND A FULL PULL COSTS (s3 round-2, the second half of the STIR
 * finding: "the stroke saturates in under 90px of hand motion; a satisfying pull
 * should span ~200px+").
 *
 * Measured, not asserted from a constant: run the real projector out along the
 * axis it responds to until the real drive arithmetic reaches the far stop, and
 * convert that pointer travel to reference-viewport pixels through the book's
 * one camera. Ungeared this read 59 px — a switch, not a pull. The number this
 * gate holds is the reader-facing one; SWARM_STIR_GEAR is only how it is bought.
 */
describe('stir tab — a full pull is worth a full arm', () => {
  const FULL_PULL_PX = [200, 260] as const

  /** Reference px of pointer travel along `axis` to carry the case from its rest
   *  drive to its far stop, by bisection on the real pipeline. */
  const pullPx = (c: AxisCase, axis: ScreenAxis): number => {
    const dir = SCREEN_RIGHT.clone().multiplyScalar(axis.x).addScaledVector(SCREEN_UP, axis.y)
    const pGrab = c.project(rayTo(c.grabPoint))
    expect(pGrab).not.toBeNull()
    const driveAt = (w: number): number => {
      const p = c.project(rayTo(c.grabPoint.clone().addScaledVector(dir, w)))
      return p === null ? c.restDrive : c.driveFrom(pGrab as number, p)
    }
    const hi = c.driveRange[1]
    let lo = 0
    let up = 4
    for (let i = 0; i < 60; i++) {
      const mid = (lo + up) / 2
      if (driveAt(mid) >= hi - 1e-9) up = mid
      else lo = mid
    }
    const a = screenXY([c.grabPoint.x, c.grabPoint.y, c.grabPoint.z])
    const q = c.grabPoint.clone().addScaledVector(dir, up)
    const b = screenXY([q.x, q.y, q.z])
    return Math.hypot(b.x - a.x, b.y - a.y)
  }

  it('ch2-swarm: the stroke spans a reader-scale drag, both along the response axis and along the tab', () => {
    const c = CASES.find((k) => k.name === 'ch2-swarm') as AxisCase
    const onResponse = pullPx(c, responseAxis(c))
    const onTravel = pullPx(c, travelAxis(c))
    for (const [label, px] of [
      ['the axis it responds to', onResponse],
      ['the axis the tab slides along', onTravel],
    ] as const) {
      expect(
        px,
        `ch2-swarm: a full stir stroke costs ${px.toFixed(0)} px of hand along ${label}, outside ` +
          `the ${FULL_PULL_PX[0]}-${FULL_PULL_PX[1]} px a full pull wants. Under it the tab is a ` +
          `switch; over it the reader runs out of desk before the swarm finishes rippling.`
      ).toBeGreaterThanOrEqual(FULL_PULL_PX[0])
      expect(px).toBeLessThanOrEqual(FULL_PULL_PX[1])
    }
  })
})
