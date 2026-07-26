/**
 * SPREAD 6 SCENE GATES — "raise a stall" must be a thing a reader can do.
 *
 * A context-quarantined blind reader played chapter V and reported three faults
 * that are really one:
 *
 *  S6-1  "The RAISE A STALL card is inert. It is the only imperative text in the
 *         scene... a reader will press it first and get nothing."
 *  S6-5  "The only working mechanism runs backwards relative to the story. The
 *         text and the card are about RAISING stalls. The stalls start fully
 *         raised, and the only thing a reader can do is drag them DOWN."
 *  S6-3  "The vendor tent inverts. Drag it down and it rotates past flat and
 *         comes to rest fully upside-down... it reads as a hinge with no stop."
 *
 * Every one of those is invisible to a solver test fed hand-picked drive values,
 * so this file gates the READER'S EXPERIENCE of the spread instead: what pose the
 * spread hands over, which way the reader's gesture runs, how far the paper
 * visibly travels in SCREEN pixels at the pinned reading camera, and whether the
 * end of travel is a pose that still reads right side up.
 *
 * Every sample box and threshold here is DERIVED — from content.ts's own numbers
 * and book-scene.tsx's own camera — never eyeballed off a screenshot.
 */

import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  liveSpreadRole,
  solveStripFlapPoseAt,
  spreadPageAnglesTilted,
  stripFlapCamLift,
  stripFlapDetent,
  stripFlapFrame,
  stripFlapHoldEnvelope,
  stripFlapRestLift,
  stripFlapTravel,
  STRIPFLAP_ANTI_FLIP,
  STRIPFLAP_DETENT,
  type StripFlapGeom,
  type PanelQuad,
  type Vec3,
} from '@/components/labs/storybook/book/popup-mechanics'
import {
  solveTabPiecePoseAt,
  tabPieceCeiling,
  tabPieceLift,
  tabPieceLiftFromSlide,
  tabPieceSlideFromLift,
  tabPieceStopSlide,
  type TabPieceGeom,
} from '@/components/labs/storybook/book/popup-tabpiece'
import { projectHingeAngle, projectPageD } from '@/components/labs/storybook/book/handle-projection'
import { PAGE_H, PAGE_W } from '@/components/labs/storybook/book/page-geometry'
import {
  SPREAD_COUNT,
  popupContentForSpread,
  type SceneLayer,
} from '@/components/labs/storybook/content'

const SPREAD = 6
const rad = (d: number): number => (d * Math.PI) / 180
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const wrapDelta = (d: number): number => Math.atan2(Math.sin(d), Math.cos(d))

// --- book-scene.tsx's pinned composition camera, at the reference viewport ----
// CAMERA_POSITION / CAMERA_LOOKAT / CAMERA_FOV verbatim; 1600x900 is the size
// every blind review has been run at, so "screen px" here means the same thing
// the reader's report meant.
const EYE = new THREE.Vector3(0, 1.85, 3.05)
const LOOKAT = new THREE.Vector3(0, 0.38, 0.05)
const FOV_Y = rad(34)
const VIEW_W = 1600
const VIEW_H = 900

const FWD = LOOKAT.clone().sub(EYE).normalize()
const RIGHT = FWD.clone().cross(new THREE.Vector3(0, 1, 0)).normalize()
const UP = RIGHT.clone().cross(FWD).normalize()
const TAN_H = Math.tan(FOV_Y / 2)

/** Perspective-projects a world point to viewport pixels (y down). */
function toScreen(p: Vec3): { x: number; y: number } {
  const rel = new THREE.Vector3(p[0], p[1], p[2]).sub(EYE)
  const depth = rel.dot(FWD)
  const sx = rel.dot(RIGHT) / (depth * TAN_H * (VIEW_W / VIEW_H))
  const sy = rel.dot(UP) / (depth * TAN_H)
  return { x: (sx * 0.5 + 0.5) * VIEW_W, y: (1 - (sy * 0.5 + 0.5)) * VIEW_H }
}

const pxBetween = (a: Vec3, b: Vec3): number => {
  const p = toScreen(a)
  const q = toScreen(b)
  return Math.hypot(p.x - q.x, p.y - q.y)
}

// --- scene access ------------------------------------------------------------

function locate(id: string): { layer: SceneLayer; spreadIndex: number } {
  for (let s = 0; s < SPREAD_COUNT; s++) {
    const layer = popupContentForSpread(s)?.layers.find((l) => l.id === id)
    if (layer) return { layer, spreadIndex: s }
  }
  throw new Error(`no layer ${id} in the book`)
}

function restAngles(spreadIndex: number): { thetaL: number; thetaR: number } {
  expect(liveSpreadRole(spreadIndex, spreadIndex, null)).toBe('current')
  return spreadPageAnglesTilted(spreadIndex, spreadIndex, null, 0)
}

const stripFlap = (id: string): SceneLayer & StripFlapGeom => {
  const { layer, spreadIndex } = locate(id)
  expect(spreadIndex, `${id} must live on spread ${SPREAD}`).toBe(SPREAD)
  expect(layer.mech).toBe('stripflap')
  return layer as SceneLayer & StripFlapGeom
}

/** The flap's FREE edge midpoint (the corner pair furthest from the hinge) at
 *  lift `a` — the edge a reader watches travel. */
function freeEdgeMid(geom: StripFlapGeom, a: number, thetaL: number, thetaR: number): Vec3 {
  const pose = solveStripFlapPoseAt(geom, a, thetaL, thetaR)
  // parallelogram corner order is [hinge apex, hinge end, free end, free apex]:
  // corners 2 and 3 are the free edge.
  const pts = [pose.left[2], pose.left[3], pose.right[2], pose.right[3]]
  return [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
    pts.reduce((s, p) => s + p[2], 0) / pts.length,
  ]
}

const allCorners = (quads: readonly (PanelQuad | readonly Vec3[])[]): Vec3[] =>
  quads.flatMap((q) => q.map((c) => [c[0], c[1], c[2]] as Vec3))

// ============================================================================
// S6-5 — the rest pose the spread hands over is the FOLDED one
// ============================================================================

describe('s6 stall rank — the spread hands the reader a FOLDED row (S6-5)', () => {
  const geom = stripFlap('ch5-throng')
  const { thetaL, thetaR } = restAngles(SPREAD)
  const beta = thetaL - thetaR
  const [lo, hi] = stripFlapTravel(geom)

  it('is declared reader-raised, not page-driven', () => {
    expect(geom.restDeg, 'the stall rank must ship its strip SLACK').toBeDefined()
    // The page cam would stand it bolt upright — that is the pose the reader
    // complained about being handed.
    expect(stripFlapCamLift(geom, beta)).toBeGreaterThan(rad(80))
    expect(stripFlapRestLift(geom, beta)).toBeLessThan(rad(8))
  })

  it('rests proud of the page rather than coplanar with it (no z-fight)', () => {
    // A leaf at exactly 0 shares the page plane it is glued to. The rest angle
    // has to lift the free edge clear of the floor print by a visible hair.
    const rest = stripFlapRestLift(geom, beta)
    expect(rest).toBeGreaterThan(0)
    const tip = freeEdgeMid(geom, rest, thetaL, thetaR)
    expect(tip[1]).toBeGreaterThan(0.005)
  })

  it('the reader drag RAISES it: the whole travel window is above rest', () => {
    // NOTE the two domains. `travelDeg` bounds the DRIVE (the raw held angle);
    // the SHOWN lift is that angle times the hold envelope, which is 0.99937 at
    // the tilted rest bloom rather than exactly 1. Comparing the drive bound
    // against a rendered lift would be an apples-to-oranges 0.003deg miss, so
    // the stop is checked against the declared rest angle in its own domain, and
    // the render is checked separately above.
    expect(lo).toBeLessThanOrEqual(rad(geom.restDeg as number))
    expect(hi).toBeGreaterThan(rad(geom.restDeg as number))
    // The rendered rest sits inside the window's rendered image, so the reader
    // can always put the row back exactly where they found it.
    const env = stripFlapHoldEnvelope(geom, beta)
    expect(stripFlapRestLift(geom, beta)).toBeCloseTo(rad(geom.restDeg as number) * env, 12)
    // and the window's upper end is the anti-flip stop: standing, not leaning.
    expect(hi).toBeCloseTo(STRIPFLAP_ANTI_FLIP, 6)
  })

  it('a real screen-ray drag from the resting row raises it (full pipeline)', () => {
    // Same pipeline handle-drag-regression.test.ts gates, aimed at the FLAT row:
    // ray -> projectHingeAngle -> the layer's drive arithmetic -> solver.
    const rest = stripFlapRestLift(geom, beta)
    const fr = stripFlapFrame(geom, thetaL, thetaR)
    const grabPoint = new THREE.Vector3(...freeEdgeMid(geom, rest, thetaL, thetaR))
    const ray = (p: THREE.Vector3): THREE.Ray =>
      new THREE.Ray(EYE.clone(), p.clone().sub(EYE).normalize())
    const project = (r: THREE.Ray): number | null =>
      projectHingeAngle(r, fr.center, fr.hinge, fr.flat, fr.n)
    const pGrab = project(ray(grabPoint))
    expect(pGrab, 'the projector missed the resting row').not.toBeNull()

    // A 0.2 world-unit stroke (~75 screen px) straight up the screen.
    const pNow = project(ray(grabPoint.clone().addScaledVector(UP, 0.2)))
    expect(pNow).not.toBeNull()
    const drive = stripFlapDetent(rest + wrapDelta((pNow as number) - (pGrab as number)), lo, hi)
    expect(drive, 'dragging up the screen must RAISE the row').toBeGreaterThan(rest + rad(20))
  })
})

// ============================================================================
// S6-6 — the raise has to be a VISIBLE event
// ============================================================================

describe('s6 stall rank — raising it is a visible event (S6-6)', () => {
  const geom = stripFlap('ch5-throng')
  const { thetaL, thetaR } = restAngles(SPREAD)
  const beta = thetaL - thetaR
  const [, hi] = stripFlapTravel(geom)

  /** The bar. The reader's verdict on the shipped row was "~8 shapes, ~25
   *  screen pixels of travel... as a reader I would have finished this spread
   *  believing it was a static diorama". The shipped geometry's FULL stroke
   *  measured 87 px at this camera; a payoff a reader cannot miss wants well
   *  clear of that, and the delivered geometry gives 134. */
  const TRAVEL_FLOOR_PX = 110

  it('the free edge travels far enough across the frame to be unmissable', () => {
    const rest = freeEdgeMid(geom, stripFlapRestLift(geom, beta), thetaL, thetaR)
    const raised = freeEdgeMid(geom, hi, thetaL, thetaR)
    expect(pxBetween(rest, raised)).toBeGreaterThan(TRAVEL_FLOOR_PX)
  })

  it('and the travel crosses the hinge line, flat-toward-reader to standing', () => {
    // The categorical half of the payoff: at rest the row's free edge projects
    // BELOW its own hinge (a die-cut lying flat toward the reader); raised it
    // projects above. That sign flip is what makes it read as standing UP.
    const hinge = toScreen([
      geom.hingeX * Math.cos(thetaR),
      0,
      geom.hingeZ,
    ] as Vec3)
    const restTip = toScreen(freeEdgeMid(geom, stripFlapRestLift(geom, beta), thetaL, thetaR))
    const raisedTip = toScreen(freeEdgeMid(geom, hi, thetaL, thetaR))
    expect(restTip.y).toBeGreaterThan(hinge.y)
    expect(raisedTip.y).toBeLessThan(hinge.y)
  })

  it('stays on its own page in the flat pose (containment)', () => {
    const rest = stripFlapRestLift(geom, beta)
    for (const c of allCorners([
      solveStripFlapPoseAt(geom, rest, thetaL, thetaR).left,
      solveStripFlapPoseAt(geom, rest, thetaL, thetaR).right,
    ])) {
      expect(Math.abs(c[2]), 'flat rest pose runs off the page fore/aft edge').toBeLessThanOrEqual(
        PAGE_H / 2
      )
      // Right-page piece: every corner is on the +x half, inside the fore edge.
      expect(c[0]).toBeGreaterThan(0)
      expect(c[0]).toBeLessThanOrEqual(PAGE_W)
    }
  })

  it('folds flat at book close for any angle the reader may latch', () => {
    for (const held of [rad(5), rad(30), rad(60), STRIPFLAP_ANTI_FLIP]) {
      expect(held * stripFlapHoldEnvelope(geom, 0)).toBeCloseTo(0, 12)
    }
    // and the handed-over pose folds flat too — it rides the same envelope.
    expect(stripFlapRestLift(geom, 0)).toBeCloseTo(0, 12)
  })
})

// ============================================================================
// S6-3 — the tea corner's fold must read as a fold at the whole travel
// ============================================================================

describe('s6 tea corner — the fold never reads inverted (S6-3)', () => {
  const geom = stripFlap('ch5-tea')
  const { thetaL, thetaR } = restAngles(SPREAD)
  const [lo, hi] = stripFlapTravel(geom)

  /** The reader's words were "fully inverted... dome hanging down-left". The
   *  measurable form of that: the flap's own tip projecting BELOW its hinge. A
   *  20 px clearance is the smallest gap at which the lean still reads as a
   *  standing tent leaning back rather than a fallen one. */
  const TIP_CLEARANCE_PX = 20

  const hingeScreen = toScreen([geom.hingeX * Math.cos(thetaR), 0, geom.hingeZ] as Vec3)

  it('the hinge has a lower stop ABOVE flat', () => {
    expect(lo).toBeGreaterThan(0)
  })

  it('flat would have read inverted — which is why the stop is not flat', () => {
    // The finding, reproduced. The mechanism's drive was always clamped at 0;
    // 0 itself is the bad pose, so clamping harder could not have fixed it.
    const flatTip = toScreen(freeEdgeMid(geom, 0, thetaL, thetaR))
    expect(flatTip.y).toBeGreaterThan(hingeScreen.y)
  })

  it('every pose inside the travel window keeps the tip clear above the hinge', () => {
    for (let k = 0; k <= 20; k++) {
      const a = lo + ((hi - lo) * k) / 20
      const tip = toScreen(freeEdgeMid(geom, a, thetaL, thetaR))
      expect(
        hingeScreen.y - tip.y,
        `tea at ${((a * 180) / Math.PI).toFixed(1)}deg puts its tip ${(tip.y - hingeScreen.y).toFixed(1)} px below its hinge`
      ).toBeGreaterThanOrEqual(TIP_CLEARANCE_PX)
    }
  })

  it('still gives the reader a real, visible give', () => {
    expect(pxBetween(freeEdgeMid(geom, lo, thetaL, thetaR), freeEdgeMid(geom, hi, thetaL, thetaR))).toBeGreaterThan(30)
  })
})

// ============================================================================
// The detent — the end of travel has to feel like paper arriving
// ============================================================================

describe('strip flap end detent', () => {
  const lo = rad(20)
  const hi = rad(80)

  it('lands exactly ON a stop through the innermost part of the band', () => {
    expect(stripFlapDetent(lo, lo, hi)).toBeCloseTo(lo, 12)
    expect(stripFlapDetent(lo + STRIPFLAP_DETENT * 0.2, lo, hi)).toBeCloseTo(lo, 12)
    expect(stripFlapDetent(hi, lo, hi)).toBeCloseTo(hi, 12)
    expect(stripFlapDetent(hi - STRIPFLAP_DETENT * 0.2, lo, hi)).toBeCloseTo(hi, 12)
  })

  it('is the identity away from both stops', () => {
    const mid = (lo + hi) / 2
    expect(stripFlapDetent(mid, lo, hi)).toBeCloseTo(mid, 12)
  })

  it('never leaves the window and never runs backwards', () => {
    let prev = -Infinity
    for (let k = 0; k <= 200; k++) {
      const a = lo - rad(5) + ((hi - lo + rad(10)) * k) / 200
      const out = stripFlapDetent(a, lo, hi)
      expect(out).toBeGreaterThanOrEqual(lo - 1e-12)
      expect(out).toBeLessThanOrEqual(hi + 1e-12)
      expect(out).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = out
    }
  })

  it('degenerates safely on a zero-width window', () => {
    expect(stripFlapDetent(rad(40), rad(30), rad(30))).toBeCloseTo(rad(30), 12)
  })
})

// ============================================================================
// The regression guard: every OTHER strip flap in the book is untouched
// ============================================================================

describe('strip flap travel law — page-driven pieces are bit-identical', () => {
  const pageDriven: (SceneLayer & StripFlapGeom)[] = []
  for (let s = 0; s < SPREAD_COUNT; s++) {
    for (const l of popupContentForSpread(s)?.layers ?? []) {
      if (l.mech === 'stripflap' && (l as StripFlapGeom).restDeg === undefined) {
        pageDriven.push(l as SceneLayer & StripFlapGeom)
      }
    }
  }

  it('covers the pieces it claims to', () => {
    expect(pageDriven.length).toBeGreaterThan(3)
  })

  for (const geom of pageDriven) {
    it(`${geom.id}: rest lift is still exactly the strip cam`, () => {
      for (const beta of [0, rad(40), rad(90), rad(140), rad(176), Math.PI]) {
        expect(stripFlapRestLift(geom, beta)).toBe(stripFlapCamLift(geom, beta))
      }
    })
  }

  it('the default travel window is flat-to-anti-flip', () => {
    for (const geom of pageDriven) {
      if (geom.travelDeg !== undefined) continue
      expect(stripFlapTravel(geom)).toEqual([0, STRIPFLAP_ANTI_FLIP])
    }
  })
})

// ============================================================================
// S6-1 — the card that carries the imperative is itself a handle
// ============================================================================

describe('s6 RAISE A STALL card — the structure is a handle (S6-1)', () => {
  const { layer, spreadIndex } = locate('ch5-raise-stall')
  const geom = layer as SceneLayer & TabPieceGeom
  const { thetaL, thetaR } = restAngles(spreadIndex)
  const beta = thetaL - thetaR
  const t = geom.side === 'left' ? thetaL : thetaR

  /** Same bar as the drag-regression bench: ~8 screen px of paper movement. */
  const MIN_TRAVEL = 0.02
  const STROKE = 0.2

  const camA = tabPieceLift(geom, beta)
  const sStop = tabPieceStopSlide(geom)
  const aStop = tabPieceLiftFromSlide(geom, sStop)
  const ceiling = tabPieceCeiling(geom, beta)
  const restPatches = solveTabPiecePoseAt(geom, camA, thetaL, thetaR)

  const vertsAt = (a: number): Vec3[] =>
    allCorners(
      solveTabPiecePoseAt(geom, Math.min(clamp(a, 0, aStop), ceiling), thetaL, thetaR).map(
        (p) => p.quad
      )
    )

  const centroid = (quad: readonly Vec3[]): THREE.Vector3 => {
    const v = new THREE.Vector3()
    for (const c of quad) v.add(new THREE.Vector3(c[0], c[1], c[2]))
    return v.multiplyScalar(1 / quad.length)
  }

  it('it is a table form, so the reader has a deck and two legs to press', () => {
    expect(geom.form).toBe('table')
    expect(restPatches.map((p) => p.face)).toEqual(['legIn', 'deck', 'legOut', 'tab'])
  })

  // Every rendered face of the erected body now raycasts into the same grab as
  // the tab (popup-tabpiece-layer.tsx). Gate the pipeline on each one: pressing
  // the printed instruction has to move the paper it is printed on.
  for (const face of ['legIn', 'deck', 'legOut'] as const) {
    it(`a drag on the ${face} draws the same strip`, () => {
      const patch = restPatches.find((p) => p.face === face)
      expect(patch).toBeDefined()
      const grabPoint = centroid((patch as { quad: PanelQuad }).quad)
      const ray = (p: THREE.Vector3): THREE.Ray =>
        new THREE.Ray(EYE.clone(), p.clone().sub(EYE).normalize())
      const pGrab = projectPageD(ray(grabPoint), t)
      expect(pGrab, `the projector missed the ${face} at rest`).not.toBeNull()

      const sGrabStart = tabPieceSlideFromLift(geom, camA)
      const restVerts = vertsAt(camA)
      let best = 0
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4
        const dir = RIGHT.clone()
          .multiplyScalar(Math.cos(ang))
          .addScaledVector(UP, Math.sin(ang))
        const pNow = projectPageD(ray(grabPoint.clone().addScaledVector(dir, STROKE)), t)
        if (pNow === null) continue
        const drive = tabPieceLiftFromSlide(
          geom,
          clamp(sGrabStart + (pNow - (pGrab as number)), 0, sStop)
        )
        const moved = vertsAt(drive)
        let d = 0
        for (let k = 0; k < restVerts.length; k++) {
          d = Math.max(
            d,
            Math.hypot(
              restVerts[k][0] - moved[k][0],
              restVerts[k][1] - moved[k][1],
              restVerts[k][2] - moved[k][2]
            )
          )
        }
        best = Math.max(best, d)
      }
      expect(
        best,
        `${face}: no drag direction moved the card (best ${best.toFixed(4)} world units)`
      ).toBeGreaterThan(MIN_TRAVEL)
    })
  }

  it('the painted linkage has a page-side gap to cover, and it is where the floor print puts it', () => {
    // S6-1's other half: the tab exits at the fore edge, the card's fore hinge
    // stops short of it, and the empty run between them is what made the handle
    // read as "a piece that has fallen off the page". The floor print paints a
    // setting-out track across exactly this span, so the numbers must agree.
    expect(geom.hingeX).toBeLessThan(PAGE_W)
    const gap = PAGE_W - geom.hingeX
    expect(gap).toBeGreaterThan(0.2)
    expect(gap).toBeLessThan(0.3)
    // and the slit's z band is the card's own centre band
    const zc = (geom.z0 + geom.z1) / 2
    expect(zc).toBeCloseTo(0.5, 6)
  })
})
