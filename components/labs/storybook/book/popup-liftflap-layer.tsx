'use client'

/**
 * Renders one LIFT-THE-FLAP layer (popup-liftflap.ts, E2.2 Batch B): a static
 * KEY-BOARD plaque riveted coplanar INTO the page carrying a row of numbered
 * DOOR LEAVES the reader lifts to reveal the recesses beneath (a hanging brass
 * key, or the innkeeper's cat behind one). PAGE-ROOTED like the knob tower /
 * volvelle — one page carries the whole assembly.
 *
 * Each leaf is a grab handle (law H3 — the reader swings the door about its
 * spine-ward hinge; the lift tracks the pointer's angle about the hinge line,
 * clamped to [0, LIFT_MAX], the stripflap idiom). Unlike the stripflap, release
 * HOLDS the angle (law H4 — the book remembers which doors are open, the
 * winch/volvelle persistence): each door keeps its own reader angle in a
 * composite scrub channel `${id}#k`. The shown lift is a_user * E(beta), so as
 * the page closes E(beta) -> 0 eases every leaf shut — the open state cannot
 * survive book close (no per-frame return needed; the envelope does it).
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import type { LiftFlapGeom, PanelQuad } from './popup-mechanics'
import { liveSpreadRole, spreadPageAnglesTilted } from './popup-mechanics'
import {
  doorSlopFactors,
  liftFlapHingeFrame,
  liftFlapMax,
  solveLiftFlapPose,
} from './popup-liftflap'
import { kraftTints } from './paper-stock'
import { easeTurnWeighted } from './page-geometry'
import { sharedHandleMaterial, sharedKnobTexture, sharedPaperTexture } from './shared-procedural-textures'
import type { TurnFrame } from './use-turn-driver'
import { useArtTexture } from './use-layer-texture'
import { useStorybookStore } from '../store'
import { beginGrabChannel, endGrabChannel, readDriveOverride, readUserDrive, writeUserDrive } from '../user-drive'
import { pointerLocalRay } from './user-drive-pointer'
import { acceptsHandleHit } from './handle-hit'
import { NUDGE_SPAN_ANGLE, TAP_EPS, nudgeOffset } from './handle-nudge'
import { useHandleTap } from './use-handle-tap'
import { projectHingeAngle } from './handle-projection'

const FLAT_EPSILON = 0.02
const rad = (d: number): number => (d * Math.PI) / 180
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const wrapDelta = (d: number): number => Math.atan2(Math.sin(d), Math.cos(d))

/** Per-door scrub-channel id — each door remembers its own open/shut angle.
 *  The separator is URL-safe (unreserved) so the `?sbdrive=<id>~<k>:<deg>` dev
 *  override survives the query string without hitting the `#` fragment trap. */
const doorChannel = (layerId: string, k: number): string => `${layerId}~${k}`

/**
 * Page-flat quad uvs, oriented so READABLE art (numbers, hinges) reads upright
 * at the pinned reading camera. Unlike the volvelle's rotation-symmetric disc,
 * these carry glyphs, so the FULL screen mapping matters, not just a flip: at
 * the reading camera the page-fore axis d projects screen-RIGHT and the spine
 * axis z projects screen-DOWN (the volvelle v-flip lesson, generalised). So the
 * art is authored in screen space (image-x = d = the door depth, image-y = z =
 * the door row) and these uvs map image-x -> d, image-y -> z with NO rotation.
 * Corner order [bl, br, tr, tl] = (dMin,zMin),(dMin,zMax),(dMax,zMax),(dMax,zMin);
 * the RIGHT page needs no flip, the LEFT page a u-flip (its fore edge is
 * screen-left). A door leaf carries these rigidly as it lifts.
 */
function flatUvs(side: 'left' | 'right'): Float32Array {
  // right: image-x->d (u), image-y(top->bottom)->z; left: u-flipped.
  return side === 'left'
    ? new Float32Array([1, 1, 1, 0, 0, 0, 0, 1])
    : new Float32Array([0, 1, 0, 0, 1, 0, 1, 1])
}

/** Dev override for a specific door: `?sbdrive=${id}#${k}:<deg>`. */
function readDoorOverrideDeg(layerId: string, k: number): number | null {
  return readDriveOverride(doorChannel(layerId, k))
}

function makeQuadGeometry(uvs: Float32Array): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(12), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1))
  return geometry
}

function writeQuad(geometry: THREE.BufferGeometry, quad: PanelQuad): void {
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

function enlargeQuad(quad: PanelQuad, kf: number): PanelQuad {
  const cx = (quad[0][0] + quad[1][0] + quad[2][0] + quad[3][0]) / 4
  const cy = (quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1]) / 4
  const cz = (quad[0][2] + quad[1][2] + quad[2][2] + quad[3][2]) / 4
  return quad.map((p) => [cx + (p[0] - cx) * kf, cy + (p[1] - cy) * kf, cz + (p[2] - cz) * kf]) as unknown as PanelQuad
}

/** One coplanar/hinged quad (board or door) — a FrontSide print over a kraft
 *  BackSide underside; positions rewritten per frame. */
function useFaceMaterials(fallbackTexture: THREE.Texture, artId: string) {
  const art = useArtTexture(artId)
  const tint = useMemo(() => kraftTints(artId), [artId])
  const materials = useMemo(
    () => ({
      front: new THREE.MeshBasicMaterial({ side: THREE.FrontSide, transparent: true, alphaTest: 0.1, color: '#ffffff' }),
      back: new THREE.MeshBasicMaterial({ side: THREE.BackSide, transparent: true, alphaTest: 0.1, color: tint.shade }),
    }),
    [tint]
  )
  useEffect(() => {
    const texture = art ?? fallbackTexture
    if (art) {
      art.wrapS = THREE.ClampToEdgeWrapping
      art.wrapT = THREE.ClampToEdgeWrapping
    }
    materials.front.map = texture
    materials.front.color.set(art ? '#ffffff' : tint.lit)
    materials.back.map = texture
    materials.back.color.set(tint.shade)
    materials.front.needsUpdate = true
    materials.back.needsUpdate = true
  }, [art, fallbackTexture, materials, tint])
  useEffect(
    () => () => {
      materials.front.dispose()
      materials.back.dispose()
    },
    [materials]
  )
  return materials
}

function usePageAngles(
  spreadIndex: number,
  frame: RefObject<TurnFrame | null>,
  committedSpread: RefObject<number>
): () => { role: ReturnType<typeof liveSpreadRole>; thetaL: number; thetaR: number; beta: number } {
  return () => {
    const f = frame.current
    const role = liveSpreadRole(spreadIndex, committedSpread.current, f?.dir ?? null)
    const { thetaL, thetaR } = spreadPageAnglesTilted(
      spreadIndex,
      committedSpread.current,
      f?.dir ?? null,
      f ? easeTurnWeighted(f.t) : 0
    )
    return { role, thetaL, thetaR, beta: thetaL - thetaR }
  }
}

/** The live held angle for door k: dev override wins, else the reader's held
 *  angle from the scrub channel, else shut (0) — clamped to the door's range. */
function readDoorAngle(layer: SceneLayer & LiftFlapGeom, k: number): number {
  const max = liftFlapMax(layer)
  const override = readDoorOverrideDeg(layer.id, k)
  if (override !== null) return clamp(rad(override), 0, max)
  const channel = readUserDrive(doorChannel(layer.id, k))
  return channel !== undefined ? clamp(channel, 0, max) : 0
}

export function LiftFlapPopupLayer({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & LiftFlapGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const doorMeshRefs = useRef<(THREE.Mesh | null)[]>([])
  const slopMeshRefs = useRef<(THREE.Mesh | null)[]>([])
  const gl = useThree((s) => s.gl)
  const readAngles = usePageAngles(spreadIndex, frame, committedSpread)
  const thetaMax = liftFlapMax(layer)
  const doorCount = layer.doors.length

  const boardGeometry = useMemo(() => makeQuadGeometry(flatUvs(layer.side)), [layer.side])
  const doorGeometries = useMemo(
    () => layer.doors.map(() => makeQuadGeometry(flatUvs(layer.side))),
    [layer.doors, layer.side]
  )
  const slopGeometries = useMemo(
    () => layer.doors.map(() => makeQuadGeometry(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]))),
    [layer.doors]
  )
  const slopFactors = useMemo(() => doorSlopFactors(layer.doors), [layer.doors])

  const handleMaterial = sharedHandleMaterial()
  const knobTexture = sharedKnobTexture()
  const paperTexture = sharedPaperTexture()
  const boardMaterials = useFaceMaterials(paperTexture, `${layer.id}-board`)
  // One material pair per door (each carries its numbered front art).
  const doorArtIds = useMemo(() => layer.doors.map((d) => `${layer.id}-door${d.plate}`), [layer.doors, layer.id])
  const door0 = useFaceMaterials(knobTexture, doorArtIds[0] ?? `${layer.id}-door`)
  const door1 = useFaceMaterials(knobTexture, doorArtIds[1] ?? `${layer.id}-door`)
  const door2 = useFaceMaterials(knobTexture, doorArtIds[2] ?? `${layer.id}-door`)
  const door3 = useFaceMaterials(knobTexture, doorArtIds[3] ?? `${layer.id}-door`)
  const doorMaterials = [door0, door1, door2, door3].slice(0, doorCount)

  useEffect(
    () => () => {
      boardGeometry.dispose()
      doorGeometries.forEach((g) => g.dispose())
      slopGeometries.forEach((g) => g.dispose())
    },
    [boardGeometry, doorGeometries, slopGeometries]
  )

  // --- Grab lifecycle (laws H3/H4). One door at a time; offset-captured hinge
  // angle for continuity; release HOLDS the door's angle.
  const grabRef = useRef<{ doorIndex: number; aGrabStart: number; angleGrab: number } | null>(null)
  const tap = useHandleTap()

  /** The pointer's angle about door k's hinge line, in its swing plane (H3). */
  const angleAboutHinge = (e: ThreeEvent<PointerEvent>, k: number, thetaL: number, thetaR: number): number | null => {
    const fr = liftFlapHingeFrame(layer, k, thetaL, thetaR)
    return projectHingeAngle(pointerLocalRay(e), fr.center, fr.axis, fr.flat, fr.n)
  }

  const releaseGrab = (e: ThreeEvent<PointerEvent>): void => {
    if (!grabRef.current) return
    const tapped = grabRef.current.doorIndex
    grabRef.current = null
    // A press that never swung the leaf answers with a nudge of THAT door
    // (BW-18) — the pulse is keyed per door, like the held angle itself.
    tap.end(doorChannel(layer.id, tapped))
    endGrabChannel(layer.id)
    useStorybookStore.getState().endGrab() // the door's angle is HELD (persistence)
    try {
      ;(e.target as Element).releasePointerCapture(e.pointerId)
    } catch {
      // capture already gone
    }
  }

  const doorIndexOf = (object: THREE.Object3D): number | null => {
    const idx = object.userData?.doorIndex
    return typeof idx === 'number' ? idx : null
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>): void => {
    // One leaf per press. r3f calls this handler once per intersected surface,
    // so without this a press could re-enter and hand the grab to a door the
    // pointer is not on (see doorSlopFactors).
    if (grabRef.current) return
    const idx = doorIndexOf(e.object)
    if (idx === null) return
    if (!acceptsHandleHit(e, slopMeshRefs.current[idx])) return
    const st = useStorybookStore.getState()
    if (!st.booted || st.turning !== null || st.spread !== spreadIndex) return
    const { thetaL, thetaR } = readAngles()
    const angleGrab = angleAboutHinge(e, idx, thetaL, thetaR)
    if (angleGrab === null) return
    const aGrabStart = clamp(readUserDrive(doorChannel(layer.id, idx)) ?? 0, 0, thetaMax)
    st.beginGrab(layer.id, 'flap')
    if (useStorybookStore.getState().grab?.id !== layer.id) return
    grabRef.current = { doorIndex: idx, aGrabStart, angleGrab }
    writeUserDrive(doorChannel(layer.id, idx), aGrabStart, [0, thetaMax])
    tap.begin(aGrabStart)
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
    const { thetaL, thetaR } = readAngles()
    const angleNow = angleAboutHinge(e, grab.doorIndex, thetaL, thetaR)
    if (angleNow === null) return
    const aUser = clamp(grab.aGrabStart + wrapDelta(angleNow - grab.angleGrab), 0, thetaMax)
    writeUserDrive(doorChannel(layer.id, grab.doorIndex), aUser, [0, thetaMax])
    tap.track(aUser, TAP_EPS)
    e.stopPropagation()
  }

  const onPointerOver = (): void => {
    const st = useStorybookStore.getState()
    if (st.grab === null && st.booted && st.turning === null && st.spread === spreadIndex) {
      gl.domElement.style.cursor = 'grab'
      st.setHover(layer.id)
    }
  }
  const onPointerOut = (): void => {
    const st = useStorybookStore.getState()
    if (st.grab === null) gl.domElement.style.cursor = ''
    st.clearHover(layer.id)
  }

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const { role, thetaL, thetaR, beta } = readAngles()
    const visible = role !== 'hidden' && beta > FLAT_EPSILON
    group.visible = visible
    if (!visible) return

    // Held reader angle + the tap excursion, per door. The nudge is render-time
    // only (handle-nudge.ts): it never reaches the scrub channel, so a door's
    // remembered open angle and the fold-flat envelope are both untouched.
    const held = layer.doors.map((_, k) => {
      const a = readDoorAngle(layer, k)
      return clamp(a + nudgeOffset(doorChannel(layer.id, k), a, 0, thetaMax, NUDGE_SPAN_ANGLE), 0, thetaMax)
    })
    const pose = solveLiftFlapPose(layer, held, thetaL, thetaR)
    writeQuad(boardGeometry, pose.board)
    pose.doors.forEach((quad, k) => {
      writeQuad(doorGeometries[k], quad)
      writeQuad(slopGeometries[k], enlargeQuad(quad, slopFactors[k]))
    })
  })

  return (
    <group
      ref={groupRef}
      name={`liftflap-${layer.id}`}
      visible={false}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={releaseGrab}
      onPointerCancel={releaseGrab}
      onLostPointerCapture={releaseGrab}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {/* The key-board plaque beneath (renderOrder 0), its recesses painted in;
          then each door leaf over it (renderOrder 1) so a shut leaf composites
          above its recess. */}
      <mesh geometry={boardGeometry} material={boardMaterials.front} renderOrder={0} />
      <mesh geometry={boardGeometry} material={boardMaterials.back} renderOrder={0} />
      {layer.doors.map((_, k) => (
        <group key={k}>
          <mesh
            ref={(m) => {
              doorMeshRefs.current[k] = m
            }}
            geometry={doorGeometries[k]}
            material={doorMaterials[k].front}
            renderOrder={1}
            userData={{ doorIndex: k }}
          />
          {/* The underside of a LIFTED leaf faces the reader; without the
              door index the shared handler silently bailed on it, so "close it
              again" only worked while the leaf was still nearly shut (BW-20). */}
          <mesh
            geometry={doorGeometries[k]}
            material={doorMaterials[k].back}
            renderOrder={1}
            userData={{ doorIndex: k }}
          />
          {/* Coarse-pointer slop (law H6): 1.4x the leaf, touch only. */}
          <mesh
            ref={(m) => {
              slopMeshRefs.current[k] = m
            }}
            geometry={slopGeometries[k]}
            material={handleMaterial}
            renderOrder={2}
            userData={{ doorIndex: k }}
          />
        </group>
      ))}
    </group>
  )
}
