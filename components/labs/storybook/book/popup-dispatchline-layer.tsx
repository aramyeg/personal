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
 *
 * UNDER THE BOOK'S HANDLE LAWS as of 2026-07-26. This layer was written in
 * parallel with the hit/hover/cursor laws and missed all three, which a
 * context-quarantined reader felt precisely: it called the trolley "the one thing
 * on the page that behaves like a paper toy" and then reported (i) a ~26x40 px
 * grab box it had to hunt for and (ii) a native hand cursor fighting the gold
 * quill. So the trolley now carries a touch-slop sentinel sized by
 * `handleSlopFactor` (handle-hit.ts), answers a hover with candlelight rather
 * than motion (handle-hover.ts), and reports hover through the store's single
 * cursor identity instead of writing `gl.domElement.style.cursor` itself.
 *
 * The reader's second finding — after one trip the handle is somewhere else with
 * no cue — is not addressed here: where the trolley IS after a send is true, and
 * the fix belongs to whatever draws the cue, not to the mechanism. What this file
 * owes that reader is that the handle be findable wherever it has stopped, which
 * is why the min-hit gate walks the whole travel rather than checking home.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
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
import { projectPageD } from './handle-projection'
import { HANDLE_SLOP_STANDING, acceptsHandleHit, handleSlopFactor } from './handle-hit'
import { applyHandleGlow, stepHoverGlow, markHandleHovered } from './handle-hover'
import { sharedHandleMaterial } from './shared-procedural-textures'
import { useGuardedDispose } from './material-pool'

const FLAT_EPSILON = 0.02
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/**
 * STANDING, not page-flat. The trolley is an in-plane quad on a sheet that
 * stands off the page at rootDeg 82 — it presents very nearly its full area to
 * the ~27deg reading camera rather than foreshortening to a sliver, so it takes
 * the smaller of the two base pads (handle-hit.ts).
 *
 * The base is not what rescues this handle, though. Measured from the shipped
 * geom: the die-cut trolley is 0.0693 x 0.1125 world units at every station, so
 * `handleSlopFactor`'s absolute floor — HANDLE_MIN_HIT = 0.12, roughly 45 screen
 * px — asks for 1.73x and wins over the 1.5x base, taking the short edge to
 * exactly 0.12. That is what answers the blind reader's "the grab box is ~26x40
 * px"; the min-hit gate in handle-drag-regression.test.ts holds it there along
 * the whole wire.
 */
const TOUCH_SLOP = HANDLE_SLOP_STANDING

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

/** Scale a quad about its own centroid — the touch-slop surface, in the plane
 *  the quad already lies in (so an in-plane rider's pad stays coplanar with the
 *  sheet and cannot poke through it). Same helper every handle layer carries. */
function enlargeQuad(quad: PanelQuad, kf: number): PanelQuad {
  const cx = (quad[0][0] + quad[1][0] + quad[2][0] + quad[3][0]) / 4
  const cy = (quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1]) / 4
  const cz = (quad[0][2] + quad[1][2] + quad[2][2] + quad[3][2]) / 4
  return quad.map((p) => [
    cx + (p[0] - cx) * kf,
    cy + (p[1] - cy) * kf,
    cz + (p[2] - cz) * kf,
  ]) as unknown as PanelQuad
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
  const groupRef = useRef<THREE.Group>(null)
  const panelRef = useRef<THREE.Mesh>(null)
  const riderRef = useRef<THREE.Mesh>(null)
  const slopRef = useRef<THREE.Mesh>(null)
  const grabRef = useRef<{ sStart: number; dGrab: number } | null>(null)
  const sRef = useRef(0)
  const sendChannel = `${layer.id}~send`

  const panelTexture = useLayerTexture(layer.id, layer.kind, accents)
  const riderTexture = useLayerTexture(`${layer.id}-basket`, layer.kind, accents)

  const panelGeometry = useMemo(() => makeQuads(layer.stages.length, panelUvs(layer)), [layer])
  const riderGeometry = useMemo(() => makeQuads(1, new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), [])
  // The touch-slop surface never samples art — it is the shared invisible
  // raycast sentinel, so its UVs are a placeholder.
  const slopGeometry = useMemo(() => makeQuads(1, new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), [])
  const handleMaterial = sharedHandleMaterial()

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

  // StrictMode-guarded (material-pool.ts): a bare `useEffect` cleanup disposes
  // the very objects the mount rehearsal hands straight back, which is what was
  // spraying `glGetProgramiv: Program object expected`. The shared handle
  // sentinel is module-lifetime and is deliberately NOT disposed here.
  useGuardedDispose([panelGeometry, riderGeometry, slopGeometry, panelMaterial, riderMaterial])

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
  // CLASS A projection (handle-projection.ts), shared with every other
  // page-plane slide in the book: the rider travels within the standing sheet,
  // but the sheet is rooted on the page, so the drag is still read off the
  // carrying page's plane. Using the shared projector rather than a private copy
  // is what lets the drag-regression gate drive this handle's REAL pipeline.
  const projectPointerD = (e: ThreeEvent<PointerEvent>, theta: number): number | null =>
    projectPageD(pointerLocalRay(e), theta)
  // The basket's travel is measured in the page's own radial coordinate, so a
  // drag of `w` world units across the sheet is a full send — the stroke IS the
  // panel's width, which is what makes the gesture feel like the wire's length.
  const stroke = Math.max(0.05, layer.w)

  const releaseGrab = (e?: ThreeEvent<PointerEvent> | null): void => {
    if (!grabRef.current) return
    grabRef.current = null
    endGrabChannel(layer.id)
    useStorybookStore.getState().endGrab()
    try {
      if (e) (e.target as Element).releasePointerCapture(e.pointerId)
    } catch {
      // capture already gone — nothing to release
    }
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>): void => {
    if (!acceptsHandleHit(e, slopRef.current)) return
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
    beginGrabChannel(layer.id, releaseGrab)
    ;(e.target as Element).setPointerCapture(e.pointerId)
    e.stopPropagation()
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>): void => {
    markHandleHovered(layer.id, spreadIndex)
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
    markHandleHovered(layer.id, spreadIndex)
  }
  const onPointerOut = (): void => {
    useStorybookStore.getState().clearHover(layer.id)
  }

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return
    const { role, thetaL, thetaR, beta } = readAngles()
    const visible = role !== 'hidden' && beta > FLAT_EPSILON && panelTexture !== null
    group.visible = visible
    if (!visible) return

    // HOVER RESPONSE (BW-1) on the TROLLEY ONLY — the panel is scenery, and a
    // whole die-cut wall brightening would say the wall is grabbable. Light
    // rather than motion: this mechanism's own answer to a grab is travel along
    // the wire, and a hover must not imply it has already started.
    {
      const glowSt = useStorybookStore.getState()
      applyHandleGlow(
        riderMaterial,
        stepHoverGlow(layer.id, delta, glowSt.hover === layer.id || glowSt.grab?.id === layer.id)
      )
    }

    const override = readDriveOverride(sendChannel)
    const channel = readUserDrive(sendChannel)
    // Release HOLDS (the winch/dial H4 idiom): no decay term at all. The hold is
    // legal because the rider is in-plane — the sheet's cam is its envelope, so
    // a basket parked mid-wire still folds dead flat with the page.
    const drive = clamp(override ?? channel ?? sRef.current, 0, 1)
    sRef.current = drive
    if (override === null && channel === undefined && drive === 0) clearUserDrive(sendChannel)

    writeQuads(panelGeometry, solveStagedChainPose(dispatchLinePanel(layer), thetaL, thetaR).panels)
    const rider = dispatchLineBasketQuad(layer, dispatchLineRiderS(layer, drive), thetaL, thetaR)
    writeQuads(riderGeometry, [rider])
    writeQuads(slopGeometry, [enlargeQuad(rider, handleSlopFactor(rider, TOUCH_SLOP))])
  })

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={panelRef} geometry={panelGeometry} material={panelMaterial} renderOrder={0} />
      {/* The handle, and ONLY the handle, inside the pointer group: the panel is
          a wall the reader must be able to look past, and putting it under these
          handlers would also make it an "exact" surface that the slop defers to
          (acceptsHandleHit compares within one eventObject). */}
      <group
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={releaseGrab}
        onPointerCancel={releaseGrab}
        onLostPointerCapture={releaseGrab}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <mesh ref={riderRef} geometry={riderGeometry} material={riderMaterial} renderOrder={1} />
        <mesh ref={slopRef} geometry={slopGeometry} material={handleMaterial} renderOrder={2} />
      </group>
    </group>
  )
}
