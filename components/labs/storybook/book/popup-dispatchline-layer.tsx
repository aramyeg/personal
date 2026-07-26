'use client'

/**
 * Renders one DISPATCH LINE layer (popup-dispatchline.ts, E3 s4 round-4): the
 * die-cut cable panel, its hanging basket lanterns, and the ONE basket the
 * reader pushes down the wire.
 *
 * TWO MESHES, and the split is the whole design. The PANEL is a stagedchain
 * submitted exactly as the tower is — one merged mesh, one atlas, positions
 * rewritten each frame from the closed-form solver — except that its atlas is
 * mostly TRANSPARENT: the alpha carries a swooping cable, its masts and its
 * fixed lanterns, and everything else is cut away. A wall of paper reads as a
 * wire. The RIDER is a second quad laid IN the panel's own plane at the cable's
 * current arc parameter, which is why it needs no envelope of its own: a
 * constant-weight bilinear point of a folding sheet folds with the sheet, at
 * any held position (popup-dispatchline.ts, and gate L12/L13 of
 * `.superpowers/sdd/bench/e3s4r4-cable.mjs`).
 *
 * THE HAND (drive channel `<id>~send`, the winch/dial H4 idiom): drag the
 * basket and it travels; RELEASE HOLDS IT. A dispatch basket that snapped back
 * would be a toy; one that stays where you sent it is a machine the reader has
 * operated, and the book remembers it through page turns for free because the
 * hold is in-plane. Dev override `?sbdrive=<id>~send:<s>` freezes it for
 * captures.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import {
  dispatchLineBasketQuad,
  dispatchLinePanel,
  dispatchLineRiderS,
  type DispatchLineGeom,
} from './popup-dispatchline'
import { solveStagedChainPose, stagedChainBand, stagedChainNodeU } from './popup-stagedchain'
import { liveSpreadRole, spreadPageAnglesTilted, type PanelQuad } from './popup-mechanics'
import { easeTurnWeighted } from './page-geometry'
import type { TurnFrame } from './use-turn-driver'
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
import { pointerLocalRay } from './user-drive-pointer'

const FLAT_EPSILON = 0.02
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

const _u = new THREE.Vector3()
const _plane = new THREE.Plane()
const _hit = new THREE.Vector3()

function panelUvs(geom: DispatchLineGeom): Float32Array {
  const panel = dispatchLinePanel(geom)
  const uvs: number[] = []
  panel.stages.forEach((_, k) => {
    const [v0, v1] = stagedChainBand(panel, k)
    const [u0a, u1a] = stagedChainNodeU(panel, k)
    const [u0b, u1b] = stagedChainNodeU(panel, k + 1)
    uvs.push(u0a, v0, u1a, v0, u1b, v1, u0b, v1)
  })
  return new Float32Array(uvs)
}

function makeQuads(count: number, uvs: Float32Array): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(count * 4 * 3), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  const index = new Uint16Array(count * 6)
  for (let q = 0; q < count; q++) {
    const base = q * 4
    index.set([base, base + 1, base + 2, base, base + 2, base + 3], q * 6)
  }
  geometry.setIndex(new THREE.BufferAttribute(index, 1))
  return geometry
}

function writeQuads(geometry: THREE.BufferGeometry, quads: readonly PanelQuad[]): void {
  const attr = geometry.getAttribute('position') as THREE.BufferAttribute
  const arr = attr.array as Float32Array
  let o = 0
  for (const quad of quads) {
    for (let c = 0; c < 4; c++) {
      arr[o++] = quad[c][0]
      arr[o++] = quad[c][1]
      arr[o++] = quad[c][2]
    }
  }
  attr.needsUpdate = true
  geometry.computeBoundingSphere()
}

export function DispatchLinePopupLayer({
  layer,
  accents,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & DispatchLineGeom
  accents: readonly string[]
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const gl = useThree((s) => s.gl)
  const groupRef = useRef<THREE.Group>(null)
  const panelRef = useRef<THREE.Mesh>(null)
  const riderRef = useRef<THREE.Mesh>(null)
  const grabRef = useRef<{ sStart: number; dGrab: number } | null>(null)
  const sRef = useRef(0)
  const sendChannel = `${layer.id}~send`

  const panelTexture = useLayerTexture(layer.id, layer.kind, accents)
  const riderTexture = useLayerTexture(`${layer.id}-basket`, layer.kind, accents)

  const panelGeometry = useMemo(() => makeQuads(layer.stages.length, panelUvs(layer)), [layer])
  const riderGeometry = useMemo(() => makeQuads(1, new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), [])

  const panelMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, color: '#ffffff' }),
    []
  )
  const riderMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, color: '#ffffff' }),
    []
  )

  useEffect(() => {
    for (const [tex, mat] of [
      [panelTexture, panelMaterial],
      [riderTexture, riderMaterial],
    ] as const) {
      if (!tex) continue
      tex.wrapS = THREE.ClampToEdgeWrapping
      tex.wrapT = THREE.ClampToEdgeWrapping
      mat.map = tex
      mat.needsUpdate = true
    }
  }, [panelTexture, riderTexture, panelMaterial, riderMaterial])

  useEffect(
    () => () => {
      panelGeometry.dispose()
      riderGeometry.dispose()
      panelMaterial.dispose()
      riderMaterial.dispose()
    },
    [panelGeometry, riderGeometry, panelMaterial, riderMaterial]
  )

  const readAngles = () => {
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

  // --- the hand: drag the basket along the wire, release HOLDS -------------
  const projectPointerD = (e: ThreeEvent<PointerEvent>, theta: number): number | null => {
    _u.set(Math.cos(theta), Math.sin(theta), 0)
    _plane.setComponents(Math.sin(theta), -Math.cos(theta), 0, 0)
    const ray = pointerLocalRay(e)
    if (!ray.intersectPlane(_plane, _hit)) return null
    return _hit.dot(_u)
  }
  // The basket's travel is measured in the page's own radial coordinate, so a
  // drag of `w` world units across the sheet is a full send — the stroke IS the
  // panel's width, which is what makes the gesture feel like the wire's length.
  const stroke = Math.max(0.05, layer.w)

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
    const st = useStorybookStore.getState()
    if (!st.booted || st.turning !== null || st.spread !== spreadIndex) return
    const { thetaL, thetaR } = readAngles()
    const dGrab = projectPointerD(e, layer.side === 'left' ? thetaL : thetaR)
    if (dGrab === null) return
    const sStart = clamp(readUserDrive(sendChannel) ?? sRef.current, 0, 1)
    st.beginGrab(layer.id, 'tab')
    if (useStorybookStore.getState().grab?.id !== layer.id) return
    grabRef.current = { sStart, dGrab }
    writeUserDrive(sendChannel, sStart, [0, 1])
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
    const dNow = projectPointerD(e, layer.side === 'left' ? thetaL : thetaR)
    if (dNow === null) return
    writeUserDrive(sendChannel, clamp(grab.sStart + (dNow - grab.dGrab) / stroke, 0, 1), [0, 1])
    e.stopPropagation()
  }

  const onPointerOver = (): void => {
    const st = useStorybookStore.getState()
    if (st.grab === null && st.booted && st.turning === null && st.spread === spreadIndex) {
      gl.domElement.style.cursor = 'grab'
    }
  }
  const onPointerOut = (): void => {
    if (!grabRef.current && useStorybookStore.getState().grab === null) gl.domElement.style.cursor = ''
  }

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const { role, thetaL, thetaR, beta } = readAngles()
    const visible = role !== 'hidden' && beta > FLAT_EPSILON && panelTexture !== null
    group.visible = visible
    if (!visible) return

    const override = readDriveOverride(sendChannel)
    const channel = readUserDrive(sendChannel)
    // Release HOLDS (the winch/dial H4 idiom): no decay term at all. The hold is
    // legal because the rider is in-plane — the sheet's cam is its envelope, so
    // a basket parked mid-wire still folds dead flat with the page.
    const drive = clamp(override ?? channel ?? sRef.current, 0, 1)
    sRef.current = drive
    if (override === null && channel === undefined && drive === 0) clearUserDrive(sendChannel)

    writeQuads(panelGeometry, solveStagedChainPose(dispatchLinePanel(layer), thetaL, thetaR).panels)
    writeQuads(riderGeometry, [
      dispatchLineBasketQuad(layer, dispatchLineRiderS(layer, drive), thetaL, thetaR),
    ])
  })

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={panelRef} geometry={panelGeometry} material={panelMaterial} renderOrder={0} />
      <mesh
        ref={riderRef}
        geometry={riderGeometry}
        material={riderMaterial}
        renderOrder={1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={releaseGrab}
        onPointerCancel={releaseGrab}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      />
    </group>
  )
}
