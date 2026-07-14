'use client'

/**
 * Renders one TAB PIECE layer (popup-tabpiece.ts, D1): a one-page slider
 * structure — mound (two slopes) or table (legs + deck) — whose internal
 * strip ends in a VISIBLE tab at the page's fore edge. The tab slides out
 * by exactly the strip draw as the structure erects (inextensible law).
 *
 * D6 "THE HAND": the tab is a real handle. The reader grabs it and pulls; the
 * lift tracks the finger's projection onto the page's strip axis (law H3,
 * direct manipulation), clamped between a flat fold and the mechanical stop.
 * On release the lift eases back to the page cam (user-drive-return.ts). The
 * high-frequency drive value lives in the module-level scrub channel
 * (user-drive.ts), never React state; zustand holds only the grab identity.
 *
 * Follows the platform layer's every convention: unlit print, kraft
 * fallback tints, BackSide interior mesh in deep shadow, cut-edge
 * hairlines, DynamicDrawUsage positions rewritten per frame, two-tier
 * unlit shadows scaled by sin(beta/2)^2.
 *
 * Art: ONE painting per piece (`<id>-face`) mapped as the UNFOLDED die-cut
 * — u along the spine, v along the unrolled slide direction (0 at the
 * inner hinge, 1 at the fixed hinge; the ridge/deck breaks sit at their
 * arc-length stations). Printed exactly like a real die-cut sheet: the
 * image is continuous over every crease. The tab prints raw kraft with a
 * shaded tint — a visibly separate strip of card, the grab handle.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { makePaperCanvas, makeShadowCanvas, makeTabGripCanvas } from '../procedural/paper-texture'
import { makeCanvasTexture } from './book'
import { kraftTints } from './paper-stock'
import { liveSpreadRole, spreadPageAnglesTilted, type TabPieceGeom, type Vec3 } from './popup-mechanics'
import {
  solveTabPiecePose,
  solveTabPiecePoseAt,
  tabPieceCeiling,
  tabPieceFlatSpan,
  tabPieceLift,
  tabPieceLiftFromSlide,
  tabPieceSlideFromLift,
  tabPieceSlit,
  tabPieceStopLift,
  tabPieceStopSlide,
  type TabPieceFace,
} from './popup-tabpiece'
import { peakHeight, shadowLift } from './shadow-light'
import { easeTurnWeighted } from './page-geometry'
import { TURN_MS, type TurnFrame } from './use-turn-driver'
import { useArtTexture } from './use-layer-texture'
import { useStorybookStore } from '../store'
import {
  beginGrabChannel,
  clearUserDrive,
  endGrabChannel,
  readDriveOverride,
  readUserDrive,
  writeUserDrive,
} from '../user-drive'
import { STEP_CAP, stepUserDriveReturn, turnFrames } from './user-drive-return'
import { pointerLocalRay } from './user-drive-pointer'

const FLAT_EPSILON = 0.02
const SHADOW_Y_LIFT = 0.001
const STRUCT_SHADOW_MAX = 0.28
const FOLD_SHADE_TINT = '#d9cdb4'
const INTERIOR_SHADOW_TINT = '#5f5138'
const CUT_EDGE_COLOR = '#f6eedb'
/** Coarse-pointer hit widening (law H6): the invisible slop mesh is 1.5x the
 *  tab, engaged only for `pointerType === 'touch'`. */
const TOUCH_SLOP = 1.5

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

// Scratch for the H3 pointer projection (one grab at a time, consumed at once).
const _plane = new THREE.Plane()
const _u = new THREE.Vector3()
const _hit = new THREE.Vector3()

/** The darker sibling of each crease pair — the face turned away from the
 *  fore edge's light in the flat print (slopeOut/legOut), plus the tab. */
const isShaded = (face: TabPieceFace): boolean =>
  face === 'slopeOut' || face === 'legOut' || face === 'tab'

/** Unfolded-die-cut v bands per face (arc length from inner hinge, over
 *  the flat span). The tab is raw kraft — identity uvs. */
function tabFaceUvs(face: TabPieceFace, geom: TabPieceGeom): Float32Array {
  const span = tabPieceFlatSpan(geom)
  const w = geom.legW / span
  const d = (geom.deckD ?? 0) / span
  const bands: Partial<Record<TabPieceFace, [number, number]>> = {
    slopeIn: [0, 0.5],
    slopeOut: [0.5, 1],
    legIn: [0, w],
    deck: [w, w + d],
    legOut: [w + d, 1],
  }
  const band = bands[face]
  if (!band) return new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])
  const [vA, vB] = band
  return new Float32Array([0, vA, 1, vA, 1, vB, 0, vB])
}

function makeFaceGeometry(uvs: Float32Array): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(12), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1))
  return geometry
}

function makeEdgeGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(12), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  return geometry
}

/** Two-point line geometry for the fore-edge SLIT the tab emerges through
 *  (D3 tab-legibility package) — one segment, positions rewritten every
 *  frame from `tabPieceSlit`. */
function makeSlitGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(6), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  return geometry
}

/** Rewrites a 4-corner geometry's positions from a quad. */
function writeQuad(geometry: THREE.BufferGeometry, quad: readonly Vec3[]): void {
  const attr = geometry.getAttribute('position') as THREE.BufferAttribute
  const arr = attr.array as Float32Array
  for (let c = 0; c < 4; c++) {
    arr[c * 3] = quad[c][0]
    arr[c * 3 + 1] = quad[c][1]
    arr[c * 3 + 2] = quad[c][2]
  }
  attr.needsUpdate = true
  geometry.computeBoundingSphere()
}

/** A quad scaled `k`x about its own centre — the coarse-pointer slop target. */
function enlargeQuad(quad: readonly Vec3[], k: number): Vec3[] {
  const cx = (quad[0][0] + quad[1][0] + quad[2][0] + quad[3][0]) / 4
  const cy = (quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1]) / 4
  const cz = (quad[0][2] + quad[1][2] + quad[2][2] + quad[3][2]) / 4
  return quad.map((p) => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k, cz + (p[2] - cz) * k] as Vec3)
}

/** The structure ship-vertices of a solved pose (every panel except the tab
 *  reveal — the motion-character convention the return cap measures against). */
function structVerts(patches: readonly { face: TabPieceFace; quad: readonly Vec3[] }[]): Vec3[] {
  const verts: Vec3[] = []
  for (const p of patches) if (p.face !== 'tab') for (const c of p.quad) verts.push(c)
  return verts
}

/** Worst per-vertex world step between two equal-length vertex lists. */
function worstVert(a: readonly Vec3[], b: readonly Vec3[]): number {
  let d = 0
  for (let i = 0; i < a.length; i++) {
    d = Math.max(d, Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1], a[i][2] - b[i][2]))
  }
  return d
}

export function TabPiecePopupLayer({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & TabPieceGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const shadowGroupRef = useRef<THREE.Group>(null)
  const handleRef = useRef<THREE.Mesh>(null)
  const slopRef = useRef<THREE.Mesh>(null)
  const gl = useThree((s) => s.gl)

  const faceArt = useArtTexture(`${layer.id}-face`)
  // This piece's own stock (D3 kraft-legibility package): replaces the
  // shared PAPER_TINT/PAPER_SHADE_TINT pair so a mid-turn tangle of several
  // artless tab pieces separates by tone instead of reading as one mass.
  const tint = useMemo(() => kraftTints(layer.id), [layer.id])

  const patches = useMemo(() => solveTabPiecePose(layer, Math.PI, 0), [layer])
  const geometries = useMemo(
    () => patches.map((p) => makeFaceGeometry(tabFaceUvs(p.face, layer))),
    [patches, layer]
  )
  const edgeGeometries = useMemo(() => patches.map(() => makeEdgeGeometry()), [patches])
  // One hairline material per patch (not shared): artless faces get this
  // piece's own darker `tint.edge` for contrast against same-family
  // neighbors mid-turn; painted faces keep the standard pale cut-edge core.
  const edgeMaterials = useMemo(
    () => patches.map(() => new THREE.LineBasicMaterial({ color: CUT_EDGE_COLOR, transparent: true, opacity: 0.8 })),
    [patches]
  )

  const paperTexture = useMemo(() => makeCanvasTexture(makePaperCanvas(256, 256)), [])
  const tabGripTexture = useMemo(() => makeCanvasTexture(makeTabGripCanvas()), [])
  const materials = useMemo(() => {
    const exterior = patches.map(
      (p) =>
        new THREE.MeshBasicMaterial({
          side: THREE.FrontSide,
          color: isShaded(p.face) ? FOLD_SHADE_TINT : '#ffffff',
        })
    )
    const interior = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      map: paperTexture,
      color: INTERIOR_SHADOW_TINT,
    })
    return { exterior, interior }
  }, [patches, paperTexture])

  // The invisible grab handles (law H3/H6): an exact-tab mesh for mouse/pen
  // precision and a 1.5x slop mesh for touch. Both raycast (object visible)
  // but never render (material.visible = false). Positions track the tab
  // quad every frame.
  const handleGeometry = useMemo(() => makeFaceGeometry(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), [])
  const slopGeometry = useMemo(() => makeFaceGeometry(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), [])
  const handleMaterial = useMemo(() => new THREE.MeshBasicMaterial({ visible: false }), [])

  useEffect(() => {
    patches.forEach((p, i) => {
      const material = materials.exterior[i]
      const art = p.face === 'tab' ? null : faceArt
      // The tab never prints art (file header) — its raw-kraft map carries
      // the grip-notch texture instead of the generic paper grain.
      material.map = art ?? (p.face === 'tab' ? tabGripTexture : paperTexture)
      if (art) {
        art.wrapS = THREE.ClampToEdgeWrapping
        art.wrapT = THREE.ClampToEdgeWrapping
        material.color.set(isShaded(p.face) ? FOLD_SHADE_TINT : '#ffffff')
      } else {
        material.color.set(isShaded(p.face) ? tint.shade : tint.lit)
      }
      material.needsUpdate = true
      edgeMaterials[i].color.set(art ? CUT_EDGE_COLOR : tint.edge)
    })
  }, [patches, materials, edgeMaterials, paperTexture, tabGripTexture, faceArt, tint])

  // The fore-edge SLIT the tab emerges through (D3 tab-legibility package):
  // a short hairline riding the page rigidly at d = PAGE_W, tinted this
  // piece's own darker `edge` sibling so it reads as a cut, not a stray line.
  const slitGeometry = useMemo(() => makeSlitGeometry(), [])
  const slitMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: tint.edge, transparent: true, opacity: 0.9 }),
    [tint]
  )

  const shadowTexture = useMemo(() => makeCanvasTexture(makeShadowCanvas()), [])
  const shadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 }),
    [shadowTexture]
  )
  // Key-light placement (shadow-light.ts): the erected mound/table stands, so
  // its pool offsets down-screen-right and deepens/spreads with its rest peak.
  const shadowSpec = useMemo(() => {
    const span = tabPieceFlatSpan(layer)
    const sign = layer.side === 'left' ? -1 : 1
    const rest = solveTabPiecePose(layer, Math.PI, 0)
    const lift = shadowLift(peakHeight(rest.map((p) => p.quad)))
    return {
      position: [
        sign * (layer.hingeX - span / 2) + lift.dx,
        SHADOW_Y_LIFT,
        (layer.z0 + layer.z1) / 2 + lift.dz,
      ] as [number, number, number],
      size: [span * 0.95 * lift.spread, (layer.z1 - layer.z0) * 1.05 * lift.spread] as [number, number],
      maxOpacity: STRUCT_SHADOW_MAX * lift.depth,
    }
  }, [layer])

  // Channel bounds and the mechanical stop for this piece (law H3).
  const aStop = useMemo(() => tabPieceStopLift(layer), [layer])
  const sStop = useMemo(() => tabPieceStopSlide(layer), [layer])

  useEffect(
    () => () => {
      geometries.forEach((g) => g.dispose())
      edgeGeometries.forEach((g) => g.dispose())
      edgeMaterials.forEach((m) => m.dispose())
      materials.exterior.forEach((m) => m.dispose())
      materials.interior.dispose()
      paperTexture.dispose()
      tabGripTexture.dispose()
      handleGeometry.dispose()
      slopGeometry.dispose()
      handleMaterial.dispose()
      slitGeometry.dispose()
      slitMaterial.dispose()
      shadowTexture.dispose()
      shadowMaterial.dispose()
    },
    [
      geometries,
      edgeGeometries,
      edgeMaterials,
      materials,
      paperTexture,
      tabGripTexture,
      handleGeometry,
      slopGeometry,
      handleMaterial,
      slitGeometry,
      slitMaterial,
      shadowTexture,
      shadowMaterial,
    ]
  )

  // --- Grab lifecycle (laws H1-H3). High-frequency values flow through the
  // module scrub channel; only the low-frequency grab identity touches zustand.
  const grabRef = useRef<{ sGrabStart: number; dGrab: number } | null>(null)
  const prevStructRef = useRef<Vec3[] | null>(null)

  const restAnglesNow = (): { thetaL: number; thetaR: number } =>
    spreadPageAnglesTilted(
      spreadIndex,
      committedSpread.current,
      frame.current?.dir ?? null,
      frame.current ? easeTurnWeighted(frame.current.t) : 0
    )

  /** The pointer's projection onto the live page's strip axis (page-frame u),
   *  in the layer's local frame (law H3: rebuilt from theta each event). */
  const projectPointerD = (e: ThreeEvent<PointerEvent>, thetaL: number, thetaR: number): number | null => {
    const t = layer.side === 'left' ? thetaL : thetaR
    _u.set(Math.cos(t), Math.sin(t), 0)
    _plane.setComponents(Math.sin(t), -Math.cos(t), 0, 0) // page plane through the spine
    const ray = pointerLocalRay(e)
    if (!ray.intersectPlane(_plane, _hit)) return null
    return _hit.dot(_u)
  }

  const releaseGrab = (e: ThreeEvent<PointerEvent>): void => {
    if (!grabRef.current) return
    grabRef.current = null
    endGrabChannel(layer.id)
    useStorybookStore.getState().endGrab()
    try {
      ;(e.target as Element).releasePointerCapture(e.pointerId)
    } catch {
      // capture already gone (e.g. lostpointercapture) — nothing to release
    }
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>): void => {
    // Touch uses the 1.5x slop mesh; mouse/pen use the exact tab mesh (H6).
    const isSlop = e.object === slopRef.current
    if ((e.pointerType === 'touch') !== isSlop) return
    const st = useStorybookStore.getState()
    if (!st.booted || st.turning !== null || st.spread !== spreadIndex) return
    const { thetaL, thetaR } = restAnglesNow()
    const dGrab = projectPointerD(e, thetaL, thetaR)
    if (dGrab === null) return
    const camA = tabPieceLift(layer, thetaL - thetaR)
    const aGrabStart = clamp(readUserDrive(layer.id) ?? camA, 0, aStop)
    st.beginGrab(layer.id, 'tab')
    if (useStorybookStore.getState().grab?.id !== layer.id) return // booted/turning re-check no-oped
    grabRef.current = { sGrabStart: tabPieceSlideFromLift(layer, aGrabStart), dGrab }
    writeUserDrive(layer.id, aGrabStart, [0, aStop])
    beginGrabChannel(layer.id)
    ;(e.target as Element).setPointerCapture(e.pointerId)
    e.stopPropagation()
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>): void => {
    const grab = grabRef.current
    if (!grab) return
    // A keyboard/wheel turn can force-release the grab mid-drag (law H2); the
    // return stepper then owns the channel, so stop writing and clean up.
    if (useStorybookStore.getState().grab?.id !== layer.id) {
      releaseGrab(e)
      return
    }
    const { thetaL, thetaR } = restAnglesNow()
    const dNow = projectPointerD(e, thetaL, thetaR)
    if (dNow === null) return
    const sUser = clamp(grab.sGrabStart + (dNow - grab.dGrab), 0, sStop)
    writeUserDrive(layer.id, tabPieceLiftFromSlide(layer, sUser), [0, aStop])
    e.stopPropagation()
  }

  const onPointerOver = (): void => {
    const st = useStorybookStore.getState()
    if (st.grab === null && st.booted && st.turning === null && st.spread === spreadIndex) {
      gl.domElement.style.cursor = 'grab'
    }
  }
  const onPointerOut = (): void => {
    if (useStorybookStore.getState().grab === null) gl.domElement.style.cursor = ''
  }

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return
    const f = frame.current
    const role = liveSpreadRole(spreadIndex, committedSpread.current, f?.dir ?? null)
    const { thetaL, thetaR } = spreadPageAnglesTilted(
      spreadIndex,
      committedSpread.current,
      f?.dir ?? null,
      f ? easeTurnWeighted(f.t) : 0
    )
    const beta = thetaL - thetaR

    const visible = role !== 'hidden' && beta > FLAT_EPSILON
    group.visible = visible
    if (shadowGroupRef.current) shadowGroupRef.current.visible = visible
    if (!visible) {
      prevStructRef.current = null
      return
    }

    // --- Effective lift (laws H2/H3): reader drive, release return, or cam.
    const camA = tabPieceLift(layer, beta)
    const ceiling = tabPieceCeiling(layer, beta)
    const override = readDriveOverride(layer.id)
    const grabbed = useStorybookStore.getState().grab?.id === layer.id
    const channelA = readUserDrive(layer.id)
    let effectiveA: number
    if (override !== null) {
      effectiveA = clamp(tabPieceLiftFromSlide(layer, override), 0, aStop) // ?sbdrive value is s
    } else if (grabbed) {
      effectiveA = channelA ?? camA
    } else if (channelA !== undefined) {
      // Release return — capped exponential toward the cam, yielding its
      // per-frame budget to a page turn moving the same piece (gate UT).
      const structAt = (a: number): Vec3[] =>
        structVerts(solveTabPiecePoseAt(layer, a, thetaL, thetaR))
      const heldStruct = structAt(Math.min(channelA, ceiling))
      const pageStep = prevStructRef.current ? worstVert(prevStructRef.current, heldStruct) : 0
      const budget = Math.max(0, STEP_CAP - pageStep)
      const { next, settled } = stepUserDriveReturn(
        channelA,
        camA,
        turnFrames(delta, TURN_MS),
        (a0, a1) => worstVert(structAt(a0), structAt(a1)),
        budget
      )
      if (settled) {
        clearUserDrive(layer.id)
        effectiveA = camA
      } else {
        writeUserDrive(layer.id, next, [0, aStop])
        effectiveA = next
      }
    } else {
      effectiveA = camA
    }
    const rendered = Math.min(effectiveA, ceiling)

    const solved = solveTabPiecePoseAt(layer, rendered, thetaL, thetaR)
    solved.forEach((patch, i) => {
      for (const geometry of [geometries[i], edgeGeometries[i]]) {
        writeQuad(geometry, patch.quad)
      }
    })

    // Track the tab quad onto the invisible grab handles.
    const tab = solved[solved.length - 1].quad
    writeQuad(handleGeometry, tab)
    writeQuad(slopGeometry, enlargeQuad(tab, TOUCH_SLOP))

    const [slitA, slitB] = tabPieceSlit(layer, thetaL, thetaR)
    const slitAttr = slitGeometry.getAttribute('position') as THREE.BufferAttribute
    const slitArr = slitAttr.array as Float32Array
    slitArr[0] = slitA[0]
    slitArr[1] = slitA[1]
    slitArr[2] = slitA[2]
    slitArr[3] = slitB[0]
    slitArr[4] = slitB[1]
    slitArr[5] = slitB[2]
    slitAttr.needsUpdate = true
    slitGeometry.computeBoundingSphere()

    shadowMaterial.opacity = shadowSpec.maxOpacity * Math.sin(beta / 2) ** 2
    prevStructRef.current = structVerts(solved)
  })

  return (
    <>
      <group ref={groupRef} visible={false}>
        {patches.map((p, i) => (
          <group key={p.face}>
            <mesh geometry={geometries[i]} material={materials.exterior[i]} renderOrder={0} />
            <mesh geometry={geometries[i]} material={materials.interior} renderOrder={0} />
            <lineLoop geometry={edgeGeometries[i]} material={edgeMaterials[i]} renderOrder={1} />
          </group>
        ))}
        <lineSegments geometry={slitGeometry} material={slitMaterial} renderOrder={1} />
        {/* Invisible grab handles (raycast targets, never rendered) — the tab
            quad exact for mouse/pen, 1.5x for touch (laws H3/H6). */}
        <group
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={releaseGrab}
          onPointerCancel={releaseGrab}
          onLostPointerCapture={releaseGrab}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
        >
          <mesh ref={handleRef} geometry={handleGeometry} material={handleMaterial} renderOrder={2} />
          <mesh ref={slopRef} geometry={slopGeometry} material={handleMaterial} renderOrder={2} />
        </group>
      </group>
      <group ref={shadowGroupRef} visible={false}>
        {/* renderOrder=-1: all ground shading joins the gutter crease's
            early transparent tier (D-G3 audit; book.tsx precedent) so no
            shadow can ever draw over paper. */}
        <mesh
          position={shadowSpec.position}
          rotation={[-Math.PI / 2, 0, 0]}
          material={shadowMaterial}
          renderOrder={-1}
        >
          <planeGeometry args={shadowSpec.size} />
        </mesh>
      </group>
    </>
  )
}
