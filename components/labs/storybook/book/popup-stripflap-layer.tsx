'use client'

/**
 * Renders one STRIP FLAP layer (popup-mechanics.ts solveStripFlapPose, C6): a
 * figure erected by a HIDDEN pull strip under the floor — no visible connector
 * (law L5), just the flap itself, two coplanar half-quads seamed at the hinge
 * centre. The book's own opening pulls it upright; the press-and-peel graze
 * clamp keeps its tip inside the closing wedge.
 *
 * D6 "THE HAND": the FLAP is the handle (law H3 — a hidden strip has no tab to
 * pull). The reader grabs the figure and swings it about its hinge; the lift
 * tracks the pointer's angle about the hinge line, clamped to [0, 90deg] (the
 * anti-flip stop). On release it eases back to the page cam (return law H2).
 * The high-frequency drive value lives in the module scrub channel
 * (user-drive.ts); zustand holds only the grab identity.
 *
 * Rendering mirrors the generic two-panel layer for the stripflap family:
 * unlit print art (`useLayerTexture`), a step-darker left half, a contact
 * shadow at the hinge scaled by sin(beta/2)^2. This dedicated component exists
 * only to own the flap's interactivity — the pose it draws with no drive is
 * bit-identical to what the generic layer drew.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { sharedHandleMaterial, sharedShadowTexture } from './shared-procedural-textures'
import {
  liveSpreadRole,
  solveStripFlapPose,
  solveStripFlapPoseAt,
  spreadPageAnglesTilted,
  stripFlapCamLift,
  stripFlapFrame,
  type MechPose,
  type StripFlapGeom,
  type Vec3,
} from './popup-mechanics'
import { peakHeight, shadowLift } from './shadow-light'
import { easeTurnWeighted } from './page-geometry'
import { TURN_MS, type TurnFrame } from './use-turn-driver'
import { useLayerTexture } from './use-layer-texture'
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
const SHADOW_HEIGHT = 0.16
const SHADOW_Y_LIFT = 0.001
const SHADOW_MAX_OPACITY = 0.32
const FOLD_SHADE_TINT = '#d9cdb4'
const ANTI_FLIP = Math.PI / 2 // the user ceiling (law H3): past vertical the figure flips
const TOUCH_SLOP = 1.5

const rad = (d: number): number => (d * Math.PI) / 180
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
/** Wrap an angle delta to (-pi, pi] so a grab tracks the short way round. */
const wrapDelta = (d: number): number => Math.atan2(Math.sin(d), Math.cos(d))

// Scratch for the H3 angle-about-hinge projection (one grab at a time).
const _plane = new THREE.Plane()
const _hit = new THREE.Vector3()
const _center = new THREE.Vector3()
const _hinge = new THREE.Vector3()
const _n = new THREE.Vector3()
const _flat = new THREE.Vector3()
const _rel = new THREE.Vector3()

// Stripflap uvs are fixed (fold split 0.5, never die-flipped): the print
// continues seamlessly across the invisible centre seam (matches panelUvs).
const RIGHT_UVS = new Float32Array([0.5, 0, 1, 0, 1, 1, 0.5, 1])
const LEFT_UVS = new Float32Array([0.5, 0, 0, 0, 0, 1, 0.5, 1])

function makePanelGeometry(uvs: Float32Array): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(12), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1))
  return geometry
}

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

function enlargeQuad(quad: readonly Vec3[], k: number): Vec3[] {
  const cx = (quad[0][0] + quad[1][0] + quad[2][0] + quad[3][0]) / 4
  const cy = (quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1]) / 4
  const cz = (quad[0][2] + quad[1][2] + quad[2][2] + quad[3][2]) / 4
  return quad.map((p) => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k, cz + (p[2] - cz) * k] as Vec3)
}

/** Every flap vertex is a ship vertex (no tab reveal) — the return cap
 *  measures the worst step over all eight corners. */
const flapVerts = (pose: MechPose): Vec3[] => [...pose.right, ...pose.left]

const worstVert = (a: readonly Vec3[], b: readonly Vec3[]): number => {
  let d = 0
  for (let i = 0; i < a.length; i++) {
    d = Math.max(d, Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1], a[i][2] - b[i][2]))
  }
  return d
}

export function StripFlapPopupLayer({
  layer,
  accents,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & StripFlapGeom
  accents: readonly string[]
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const shadowRef = useRef<THREE.Mesh>(null)
  const slopRef = useRef<THREE.Mesh>(null)
  const gl = useThree((s) => s.gl)

  const texture = useLayerTexture(layer.id, layer.kind, accents)

  const geometries = useMemo(
    () => ({ right: makePanelGeometry(RIGHT_UVS), left: makePanelGeometry(LEFT_UVS) }),
    []
  )
  const slopGeometry = useMemo(() => makePanelGeometry(RIGHT_UVS), [])
  const materials = useMemo(() => {
    const make = (tint: string) =>
      new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, color: tint })
    return { right: make('#ffffff'), left: make(FOLD_SHADE_TINT) }
  }, [])
  // Shared singleton (every grabbable layer used its own copy of this
  // identical invisible material — E-G4 fix wave).
  const handleMaterial = sharedHandleMaterial()

  useEffect(() => {
    if (!texture) return
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    materials.right.map = texture
    materials.right.needsUpdate = true
    materials.left.map = texture
    materials.left.needsUpdate = true
  }, [texture, materials])

  const shadow = useMemo(() => {
    const rest = solveStripFlapPose(layer, Math.PI, 0)
    const lift = shadowLift(peakHeight([rest.left, rest.right]))
    const sign = layer.side === 'left' ? -1 : 1
    return {
      position: [sign * layer.hingeX + lift.dx, SHADOW_Y_LIFT, layer.hingeZ + lift.dz] as [number, number, number],
      size: [layer.width * 0.9 * lift.spread, SHADOW_HEIGHT * 0.8 * lift.spread] as [number, number],
      maxOpacity: SHADOW_MAX_OPACITY * lift.depth,
    }
  }, [layer])
  const shadowTexture = sharedShadowTexture()
  const shadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 }),
    [shadowTexture]
  )

  useEffect(
    () => () => {
      geometries.right.dispose()
      geometries.left.dispose()
      slopGeometry.dispose()
      materials.right.dispose()
      materials.left.dispose()
      shadowMaterial.dispose()
      // handleMaterial/shadowTexture are shared singletons — never disposed
      // per-instance.
    },
    [geometries, slopGeometry, materials, shadowMaterial]
  )

  // --- Grab lifecycle (laws H1-H3). Offset-captured hinge angle for continuity.
  const grabRef = useRef<{ aGrabStart: number; angleGrab: number } | null>(null)
  const prevVertsRef = useRef<Vec3[] | null>(null)

  const anglesNow = (): { thetaL: number; thetaR: number } =>
    spreadPageAnglesTilted(
      spreadIndex,
      committedSpread.current,
      frame.current?.dir ?? null,
      frame.current ? easeTurnWeighted(frame.current.t) : 0
    )

  /** The pointer's angle about the flap hinge line, in the flap swing plane
   *  (law H3): intersect the ray with the plane through the hinge centre
   *  normal to the hinge axis, then atan2(along n, along flat). */
  const angleAboutHinge = (e: ThreeEvent<PointerEvent>, thetaL: number, thetaR: number): number | null => {
    const fr = stripFlapFrame(layer, thetaL, thetaR)
    _center.set(fr.center[0], fr.center[1], fr.center[2])
    _hinge.set(fr.hinge[0], fr.hinge[1], fr.hinge[2])
    _plane.setFromNormalAndCoplanarPoint(_hinge, _center)
    const ray = pointerLocalRay(e)
    if (!ray.intersectPlane(_plane, _hit)) return null
    _rel.copy(_hit).sub(_center)
    _n.set(fr.n[0], fr.n[1], fr.n[2])
    _flat.set(fr.flat[0], fr.flat[1], fr.flat[2])
    return Math.atan2(_rel.dot(_n), _rel.dot(_flat))
  }

  const releaseGrab = (e: ThreeEvent<PointerEvent>): void => {
    if (!grabRef.current) return
    grabRef.current = null
    endGrabChannel(layer.id)
    useStorybookStore.getState().endGrab()
    try {
      ;(e.target as Element).releasePointerCapture(e.pointerId)
    } catch {
      // capture already gone — nothing to release
    }
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>): void => {
    const isSlop = e.object === slopRef.current
    if ((e.pointerType === 'touch') !== isSlop) return
    const st = useStorybookStore.getState()
    if (!st.booted || st.turning !== null || st.spread !== spreadIndex) return
    const { thetaL, thetaR } = anglesNow()
    const angleGrab = angleAboutHinge(e, thetaL, thetaR)
    if (angleGrab === null) return
    const camA = stripFlapCamLift(layer, thetaL - thetaR)
    const aGrabStart = clamp(readUserDrive(layer.id) ?? camA, 0, ANTI_FLIP)
    st.beginGrab(layer.id, 'flap')
    if (useStorybookStore.getState().grab?.id !== layer.id) return
    grabRef.current = { aGrabStart, angleGrab }
    writeUserDrive(layer.id, aGrabStart, [0, ANTI_FLIP])
    beginGrabChannel(layer.id)
    ;(e.target as Element).setPointerCapture(e.pointerId)
    e.stopPropagation()
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>): void => {
    const grab = grabRef.current
    if (!grab) return
    if (useStorybookStore.getState().grab?.id !== layer.id) {
      releaseGrab(e)
      return
    }
    const { thetaL, thetaR } = anglesNow()
    const angleNow = angleAboutHinge(e, thetaL, thetaR)
    if (angleNow === null) return
    const aUser = clamp(grab.aGrabStart + wrapDelta(angleNow - grab.angleGrab), 0, ANTI_FLIP)
    writeUserDrive(layer.id, aUser, [0, ANTI_FLIP])
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

    const visible = role !== 'hidden' && beta > FLAT_EPSILON && texture !== null
    group.visible = visible
    if (shadowRef.current) shadowRef.current.visible = visible
    if (!visible) {
      prevVertsRef.current = null
      return
    }

    const camA = stripFlapCamLift(layer, beta)
    const override = readDriveOverride(layer.id)
    const grabbed = useStorybookStore.getState().grab?.id === layer.id
    const channelA = readUserDrive(layer.id)
    let effectiveA: number
    if (override !== null) {
      effectiveA = clamp(rad(override), 0, ANTI_FLIP) // ?sbdrive value is degrees
    } else if (grabbed) {
      effectiveA = channelA ?? camA
    } else if (channelA !== undefined) {
      const vertsAt = (a: number): Vec3[] => flapVerts(solveStripFlapPoseAt(layer, a, thetaL, thetaR))
      const held = vertsAt(channelA)
      const pageStep = prevVertsRef.current ? worstVert(prevVertsRef.current, held) : 0
      const budget = Math.max(0, STEP_CAP - pageStep)
      const { next, settled } = stepUserDriveReturn(
        channelA,
        camA,
        turnFrames(delta, TURN_MS),
        (a0, a1) => worstVert(vertsAt(a0), vertsAt(a1)),
        budget
      )
      if (settled) {
        clearUserDrive(layer.id)
        effectiveA = camA
      } else {
        writeUserDrive(layer.id, next, [0, ANTI_FLIP])
        effectiveA = next
      }
    } else {
      effectiveA = camA
    }

    const pose = solveStripFlapPoseAt(layer, effectiveA, thetaL, thetaR)
    writeQuad(geometries.right, pose.right)
    writeQuad(geometries.left, pose.left)
    // Slop spans the WHOLE flap (both halves): base ends h0/h1 and their tops.
    const full: Vec3[] = [pose.left[1], pose.right[1], pose.right[2], pose.left[2]]
    writeQuad(slopGeometry, enlargeQuad(full, TOUCH_SLOP))
    shadowMaterial.opacity = (shadow?.maxOpacity ?? SHADOW_MAX_OPACITY) * Math.sin(beta / 2) ** 2
    prevVertsRef.current = flapVerts(pose)
  })

  return (
    <>
      <group
        ref={groupRef}
        visible={false}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={releaseGrab}
        onPointerCancel={releaseGrab}
        onLostPointerCapture={releaseGrab}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <mesh geometry={geometries.right} material={materials.right} renderOrder={0} />
        <mesh geometry={geometries.left} material={materials.left} renderOrder={0} />
        {/* Coarse-pointer slop (law H6): 1.5x the flap, touch only. */}
        <mesh ref={slopRef} geometry={slopGeometry} material={handleMaterial} renderOrder={2} />
      </group>
      {shadow && (
        <mesh
          ref={shadowRef}
          position={shadow.position}
          rotation={[-Math.PI / 2, 0, 0]}
          material={shadowMaterial}
          renderOrder={-1}
          visible={false}
        >
          <planeGeometry args={shadow.size} />
        </mesh>
      )}
    </>
  )
}
