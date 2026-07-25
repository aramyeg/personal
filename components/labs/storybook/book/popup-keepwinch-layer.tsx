'use client'

/**
 * Renders the TOWER-HOIST WINCH (popup-keepwinch.ts, the E-G6 composed machine):
 * a die-cut knob disc riveted into the left page that the reader TWISTS (H4)
 * plus three staggered output bodies the crank drives — the semaphore arm, the
 * shutter-ring iris (6 blades), and the counterweight. The disc is the sole
 * grab handle; its machinery reuses the knob-tower disc pattern verbatim
 * (pointer angle about the hub, wrapped-delta accumulation into the module
 * scrub channel, release HOLDS theta — the disc remembers the twist). Outputs
 * ride the keep's bisector frame; the disc rides the page frame.
 *
 * FOLD-FLAT (2026-07-16 rigid re-derivation): the iris is 4 roost-mouth shutters
 * hinged on the loft walls (off-wall reach 0.10*sin(deploy)*E -> 0 at close), and
 * the counterweight is an IN-PLANE SASH-WEIGHT descending within the hall flank-
 * wall plane (zero off-wall reach by construction — winding-insensitive, always
 * wedge-contained). Both ride FOLDING keep walls, so the whole machine folds flat
 * (bench N4 body containment + N8 mid-turn wedge, app A3/A10). This renderer draws
 * that geometry.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import type { PanelQuad } from './popup-mechanics'
import { liveSpreadRole, spreadPageAnglesTilted } from './popup-mechanics'
import {
  KEEP_WINCH_IRIS_SHUTTERS,
  keepWinchCounterweightDeck,
  keepWinchDiscQuad,
  keepWinchIrisQuads,
  keepWinchSemaphoreQuad,
  keepWinchThetaMax,
  type KeepWinchGeom,
} from './popup-keepwinch'
import { ROTOR_LIFT } from './popup-rotor'
import { kraftTints } from './paper-stock'
import { easeTurnWeighted } from './page-geometry'
import { sharedHandleMaterial, sharedKnobTexture, sharedPaperTexture } from './shared-procedural-textures'
import { turnCullOpacity } from './turn-cull'
import type { TurnFrame } from './use-turn-driver'
import { useArtSprite } from './use-layer-texture'
import { applyUvRect } from '../art-atlas'
import { useStorybookStore } from '../store'
import { beginGrabChannel, endGrabChannel, readDriveOverride, readUserDrive, writeUserDrive } from '../user-drive'
import { pointerLocalRay } from './user-drive-pointer'

const FLAT_EPSILON = 0.02
// Counterweight deck UVs — the iron-weight art split across the loft cap crease
// (same idiom as the raven finial): crestL (capFrontL, reader LEFT) fans art-u 0.5
// at the crease -> 0 outward; crestR (capFrontR) 0.5 -> 1. art-v bottom(0)->top(1)
// so the weight prints upright. Corner order [crease-bottom, crease-top, outer-top,
// outer-bottom] from keepWinchCounterweightDeck.
const COUNTERWEIGHT_DECK_UVS: readonly Float32Array[] = [
  new Float32Array([0.5, 0, 0.5, 1, 0, 1, 0, 0]), // crestL
  new Float32Array([0.5, 0, 0.5, 1, 1, 1, 1, 0]), // crestR
]
const HUB_DEADZONE = 0.25
const TOUCH_SLOP = 1.5
const rad = (d: number): number => (d * Math.PI) / 180
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const wrapDelta = (d: number): number => Math.atan2(Math.sin(d), Math.cos(d))

const _plane = new THREE.Plane()
const _hit = new THREE.Vector3()
const _center = new THREE.Vector3()
const _n = new THREE.Vector3()
const _u = new THREE.Vector3()
const _rel = new THREE.Vector3()
const _ez = new THREE.Vector3(0, 0, 1)

function readKnobOverrideDeg(): number | null {
  if (process.env.NODE_ENV === 'production') return null
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('sbknob')
  if (raw === null) return null
  const deg = Number(raw)
  return Number.isFinite(deg) ? deg : null
}

function readWinchTheta(layer: SceneLayer & KeepWinchGeom): number {
  const max = keepWinchThetaMax(layer)
  // Dev capture overrides: ?sbknob=<deg> (shared with the knob tower) or the
  // golden harness's ?sbdrive=<id>:<deg>; both freeze the twist in DEGREES.
  const knob = readKnobOverrideDeg()
  if (knob !== null) return clamp(rad(knob), 0, max)
  const drive = readDriveOverride(layer.id)
  if (drive !== null) return clamp(rad(drive), 0, max)
  const channel = readUserDrive(layer.id)
  return channel !== undefined ? clamp(channel, 0, max) : 0
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

function usePageAngles(
  spreadIndex: number,
  frame: RefObject<TurnFrame | null>,
  committedSpread: RefObject<number>
): () => { role: ReturnType<typeof liveSpreadRole>; thetaL: number; thetaR: number; beta: number; turnT: number } {
  return () => {
    const f = frame.current
    const role = liveSpreadRole(spreadIndex, committedSpread.current, f?.dir ?? null)
    // See the volvelle layer: the cull window is specified against the driver's
    // RAW published progress, not the eased page angle.
    const turnT = f?.t ?? 0
    const { thetaL, thetaR } = spreadPageAnglesTilted(
      spreadIndex,
      committedSpread.current,
      f?.dir ?? null,
      f ? easeTurnWeighted(turnT) : 0
    )
    return { role, thetaL, thetaR, beta: thetaL - thetaR, turnT }
  }
}

/** The coplanar knob disc — the H4 rotation handle. Verbatim knob-tower disc
 *  grab machinery, driving the winch's scrub channel. */
function WinchDisc({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & KeepWinchGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const slopRef = useRef<THREE.Mesh>(null)
  const gl = useThree((s) => s.gl)
  const { texture: art, rect } = useArtSprite(`${layer.id}-disc`)
  const tint = useMemo(() => kraftTints(`${layer.id}-disc`), [layer.id])
  const readAngles = usePageAngles(spreadIndex, frame, committedSpread)
  const thetaMax = useMemo(() => keepWinchThetaMax(layer), [layer])

  // Only the DRAWN quad is remapped into the atlas region; the touch-slop quad
  // below is invisible (shared handle material) and never samples art.
  const geometry = useMemo(
    () => makeQuadGeometry(applyUvRect(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), rect)),
    [rect]
  )
  const slopGeometry = useMemo(() => makeQuadGeometry(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), [])
  const handleMaterial = sharedHandleMaterial()
  const knobTexture = sharedKnobTexture()
  const materials = useMemo(
    () => ({
      front: new THREE.MeshBasicMaterial({ side: THREE.FrontSide, transparent: true, alphaTest: 0.1, color: '#ffffff' }),
      back: new THREE.MeshBasicMaterial({ side: THREE.BackSide, transparent: true, alphaTest: 0.1, color: tint.shade }),
    }),
    [tint]
  )

  useEffect(() => {
    const texture = art ?? knobTexture
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
  }, [art, knobTexture, materials, tint])

  useEffect(
    () => () => {
      geometry.dispose()
      slopGeometry.dispose()
      materials.front.dispose()
      materials.back.dispose()
    },
    [geometry, slopGeometry, materials]
  )

  const grabRef = useRef<{ lastAngle: number | null } | null>(null)

  const angleAboutHub = (
    e: ThreeEvent<PointerEvent>,
    thetaL: number,
    thetaR: number
  ): { angle: number; stable: boolean } | null => {
    const t = layer.side === 'left' ? thetaL : thetaR
    _u.set(Math.cos(t), Math.sin(t), 0)
    _n.set(layer.side === 'left' ? Math.sin(t) : -Math.sin(t), layer.side === 'left' ? -Math.cos(t) : Math.cos(t), 0)
    _center.set(layer.hubD * _u.x + ROTOR_LIFT * _n.x, layer.hubD * _u.y + ROTOR_LIFT * _n.y, layer.hubZ)
    _plane.setFromNormalAndCoplanarPoint(_n, _center)
    const ray = pointerLocalRay(e)
    if (!ray.intersectPlane(_plane, _hit)) return null
    _rel.copy(_hit).sub(_center)
    const along = _rel.dot(_u)
    const spin = _rel.dot(_ez)
    const r = Math.hypot(along, spin)
    return { angle: Math.atan2(spin, along), stable: r >= HUB_DEADZONE * layer.discR }
  }

  const releaseGrab = (e: ThreeEvent<PointerEvent>): void => {
    if (!grabRef.current) return
    grabRef.current = null
    endGrabChannel(layer.id)
    useStorybookStore.getState().endGrab()
    try {
      ;(e.target as Element).releasePointerCapture(e.pointerId)
    } catch {
      // capture already gone
    }
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>): void => {
    const isSlop = e.object === slopRef.current
    if ((e.pointerType === 'touch') !== isSlop) return
    const st = useStorybookStore.getState()
    if (!st.booted || st.turning !== null || st.spread !== spreadIndex) return
    const { thetaL, thetaR } = readAngles()
    const hub = angleAboutHub(e, thetaL, thetaR)
    st.beginGrab(layer.id, 'knob')
    if (useStorybookStore.getState().grab?.id !== layer.id) return
    writeUserDrive(layer.id, clamp(readUserDrive(layer.id) ?? 0, 0, thetaMax), [0, thetaMax])
    grabRef.current = { lastAngle: hub && hub.stable ? hub.angle : null }
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
    const hub = angleAboutHub(e, thetaL, thetaR)
    if (!hub || !hub.stable) return
    if (grab.lastAngle !== null) {
      const cur = clamp(readUserDrive(layer.id) ?? 0, 0, thetaMax)
      writeUserDrive(layer.id, clamp(cur + wrapDelta(hub.angle - grab.lastAngle), 0, thetaMax), [0, thetaMax])
    }
    grab.lastAngle = hub.angle
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

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const { role, thetaL, thetaR, beta, turnT } = readAngles()
    // TURN-CULL (C-3): the winch is the reader's machine. Mid-turn nobody is
    // cranking it, so the disc stops drawing (see ./turn-cull.ts). The KEEP it
    // drives is structure and is never culled.
    const cull = turnCullOpacity(turnT)
    const visible = role !== 'hidden' && beta > FLAT_EPSILON && cull > 0
    group.visible = visible
    if (!visible) return
    materials.front.opacity = cull
    materials.back.opacity = cull
    const disc = keepWinchDiscQuad(layer, readWinchTheta(layer), thetaL, thetaR)
    writeQuad(geometry, disc)
    writeQuad(slopGeometry, enlargeQuad(disc, TOUCH_SLOP))
  })

  return (
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
      <mesh geometry={geometry} material={materials.front} renderOrder={0} />
      <mesh geometry={geometry} material={materials.back} renderOrder={0} />
      <mesh ref={slopRef} geometry={slopGeometry} material={handleMaterial} renderOrder={2} />
    </group>
  )
}

/** One or more output-body quads sharing an art id, redrawn each frame from the
 *  live twist. */
function WinchOutput({
  layer,
  artId,
  count,
  solve,
  uvs,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & KeepWinchGeom
  artId: string
  count: number
  solve: (theta: number, beta: number, thetaL: number, thetaR: number) => PanelQuad[]
  /** per-quad UVs (default: identity each) — pass a split pair to print ONE art
   *  across a crease (the counterweight straddling the loft cap crease). */
  uvs?: readonly Float32Array[]
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const { texture: art, rect } = useArtSprite(artId)
  const tint = useMemo(() => kraftTints(artId), [artId])
  const readAngles = usePageAngles(spreadIndex, frame, committedSpread)
  const geometries = useMemo(
    () =>
      Array.from({ length: count }, (_, i) =>
        makeQuadGeometry(applyUvRect(new Float32Array(uvs?.[i] ?? [0, 0, 1, 0, 1, 1, 0, 1]), rect))
      ),
    [count, uvs, rect]
  )
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, alphaTest: 0.1, color: '#ffffff' }),
    []
  )
  const paperTexture = sharedPaperTexture()

  useEffect(() => {
    material.map = art ?? paperTexture
    material.color.set(art ? '#ffffff' : tint.lit)
    material.needsUpdate = true
    if (art) {
      art.wrapS = THREE.ClampToEdgeWrapping
      art.wrapT = THREE.ClampToEdgeWrapping
    }
  }, [art, paperTexture, material, tint])

  useEffect(
    () => () => {
      geometries.forEach((g) => g.dispose())
      material.dispose()
    },
    [geometries, material]
  )

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const { role, thetaL, thetaR, beta, turnT } = readAngles()
    // TURN-CULL (C-3), same window as the disc that drives these bodies.
    const cull = turnCullOpacity(turnT)
    const visible = role !== 'hidden' && beta > FLAT_EPSILON && cull > 0
    group.visible = visible
    if (!visible) return
    material.opacity = cull
    const quads = solve(readWinchTheta(layer), beta, thetaL, thetaR)
    quads.forEach((q, i) => {
      if (geometries[i]) writeQuad(geometries[i], q)
    })
  })

  return (
    <group ref={groupRef} visible={false}>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} material={material} renderOrder={0} />
      ))}
    </group>
  )
}

export function KeepWinchPopupLayer({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & KeepWinchGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  return (
    <group name={`keepwinch-${layer.id}`}>
      <WinchDisc layer={layer} spreadIndex={spreadIndex} frame={frame} committedSpread={committedSpread} />
      <WinchOutput
        layer={layer}
        artId={`${layer.id}-semaphore`}
        count={1}
        solve={(theta, beta, tL, tR) => [keepWinchSemaphoreQuad(layer, theta, beta, tL, tR)]}
        spreadIndex={spreadIndex}
        frame={frame}
        committedSpread={committedSpread}
      />
      <WinchOutput
        layer={layer}
        artId={`${layer.id}-iris`}
        count={KEEP_WINCH_IRIS_SHUTTERS}
        solve={(theta, beta, tL, tR) => keepWinchIrisQuads(layer, theta, beta, tL, tR)}
        spreadIndex={spreadIndex}
        frame={frame}
        committedSpread={committedSpread}
      />
      <WinchOutput
        layer={layer}
        artId={`${layer.id}-counterweight`}
        count={2}
        solve={(theta, beta, tL, tR) => {
          const cw = keepWinchCounterweightDeck(layer, theta, beta, tL, tR)
          return [cw.crestL, cw.crestR]
        }}
        uvs={COUNTERWEIGHT_DECK_UVS}
        spreadIndex={spreadIndex}
        frame={frame}
        committedSpread={committedSpread}
      />
    </group>
  )
}
