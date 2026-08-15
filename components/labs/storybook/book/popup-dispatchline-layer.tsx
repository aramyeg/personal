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
 * It missed a fourth (SP-1): a CLICK on the trolley answered nothing, so the one
 * gesture every blind reader tried first — press, release, look — said the wire
 * was a picture. It now shares the book's tap detector (use-handle-tap.ts) and
 * rocks the basket a fraction of the wire on a press that never sent it, which
 * is also what makes it eligible for the idle invitation (handle-beckon.ts).
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
  dispatchLineCableAt,
  dispatchLineDockT,
  dispatchLinePanel,
  dispatchLineRavenUV,
  dispatchLineRiderS,
  dispatchLineSpriteQuad,
  dispatchLineTravelFrame,
  rotateQuadInPlane,
  type DispatchLineGeom,
} from './popup-dispatchline'
import { idleGate, idleOffset, idlePeak, idleSeed, idleClockPinned } from './idle-life'
import { solveStagedChainPose, stagedChainBand, stagedChainNodeU } from './popup-stagedchain'
import { liveSpreadRole, spreadPageAnglesTilted, type PanelQuad, type Vec3 } from './popup-mechanics'
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
import { projectPlaneAlong } from './handle-projection'
import { HANDLE_SLOP_STANDING, acceptsHandleHit, handleSlopFactor } from './handle-hit'
import { applyHandleGlow, stepHoverGlow, markHandleHovered } from './handle-hover'
import { NUDGE_SPAN_STROKE_FRAC, TAP_EPS, nudgeOffset } from './handle-nudge'
import { useHandleTap } from './use-handle-tap'
import { sharedHandleMaterial } from './shared-procedural-textures'
import { useGuardedDispose } from './material-pool'

const FLAT_EPSILON = 0.02
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/**
 * The tap answer's excursion, in the send stroke's own domain (SP-1). The stroke
 * is NORMALISED — the whole wire is drive 0..1 — so the span is the family's
 * slide fraction of that whole range rather than the angle span the flaps and
 * dials use: a tapped basket creeps a fifth of the way down the wire and slides
 * back, which is the same gesture at the same scale as the strip that answers a
 * tap by creeping out of its slot.
 */
const NUDGE_SPAN_SEND = NUDGE_SPAN_STROKE_FRAC * 1

/**
 * The send stroke AS RENDERED: the held drive plus the tap/beckon excursion.
 *
 * Applied here, in the one reader every consumer of the drive shares (the rider
 * quad and the touch-slop pad that must stay on it), so the basket and its grab
 * surface travel as one piece — the readWinchTheta idiom. Render-time only: the
 * excursion is never written back to the channel, so it cannot survive a page
 * turn, compose with a held send, or leak into the hold. `frozen` is a dev
 * capture pose (`?sbdrive=<id>~send:<s>`), which the nudge must leave exactly
 * where the harness put it or the goldens stop being deterministic.
 */
function shownSend(channel: string, held: number, frozen: boolean): number {
  if (frozen) return held
  return clamp(held + nudgeOffset(channel, held, 0, 1, NUDGE_SPAN_SEND), 0, 1)
}

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
  const grabRef = useRef<{
    sStart: number
    dGrab: number
    frame: { center: Vec3; n: Vec3; dir: Vec3; len: number }
  } | null>(null)
  const sRef = useRef(0)
  const sendChannel = `${layer.id}~send`
  // A press that never sends the basket still gets an answer (BW-18). The
  // trolley shipped without one, so the reader who called it the page's one
  // paper toy had to guess that a CLICK was not the gesture.
  const tap = useHandleTap()

  const panelTexture = useLayerTexture(layer.id, layer.kind, accents)
  const riderTexture = useLayerTexture(`${layer.id}-basket`, layer.kind, accents)
  // THE LANDING's two sprites share ONE texture, stacked as two rows: the
  // taking-off raven on top, the roost lantern beneath. One art id, one upload,
  // and the two pieces of the payoff cannot drift apart in style.
  const landingTexture = useLayerTexture(`${layer.id}-landing`, layer.kind, accents)

  const panelGeometry = useMemo(() => makeQuads(layer.stages.length, panelUvs(layer)), [layer])
  const riderGeometry = useMemo(() => makeQuads(1, new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), [])
  const ravenGeometry = useMemo(() => makeQuads(1, new Float32Array([0, 0.5, 1, 0.5, 1, 1, 0, 1])), [])
  const lampGeometry = useMemo(() => makeQuads(1, new Float32Array([0, 0, 1, 0, 1, 0.5, 0, 0.5])), [])
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
  // The landing pieces fade UP out of nothing as the trolley arrives, so they
  // carry no alphaTest (which would pop them in at a threshold) and are drawn
  // last. At dock 0 they are fully transparent and invisible.
  const ravenMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide, color: '#ffffff', depthWrite: false }),
    []
  )
  const lampMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide, color: '#ffffff', depthWrite: false }),
    []
  )

  useEffect(() => {
    for (const [tex, mat] of [
      [panelTexture, panelMaterial],
      [riderTexture, riderMaterial],
      [landingTexture, ravenMaterial],
      [landingTexture, lampMaterial],
    ] as const) {
      if (!tex) continue
      tex.wrapS = THREE.ClampToEdgeWrapping
      tex.wrapT = THREE.ClampToEdgeWrapping
      mat.map = tex
      mat.needsUpdate = true
    }
  }, [panelTexture, riderTexture, landingTexture, panelMaterial, riderMaterial, ravenMaterial, lampMaterial])

  // THE SPREAD'S DRAUGHT (s4 round-3, item 5). GLINT ONLY, and on the PANEL
  // only: this sheet is die-cut down to a wire, its masts and its lanterns, so
  // a change in how much light the print catches lands on nothing but those
  // lamps. The trolley is a grab handle and keeps the hover glow instead, so the
  // two never write the same tint in one frame. An untagged line resolves to
  // null and pays one null check.
  const idle = useMemo(() => {
    const tag = layer.idle
    if (!tag || tag.kind !== 'glint') return null
    return { seed: idleSeed(layer.id), peak: idlePeak('glint', tag.amp), pinned: idleClockPinned() }
  }, [layer.idle, layer.id])

  // StrictMode-guarded (material-pool.ts): a bare `useEffect` cleanup disposes
  // the very objects the mount rehearsal hands straight back, which is what was
  // spraying `glGetProgramiv: Program object expected`. The shared handle
  // sentinel is module-lifetime and is deliberately NOT disposed here.
  useGuardedDispose([
    panelGeometry,
    riderGeometry,
    ravenGeometry,
    lampGeometry,
    slopGeometry,
    panelMaterial,
    riderMaterial,
    ravenMaterial,
    lampMaterial,
  ])

  const readAngles = () => {
    const f = frame.current
    const role = liveSpreadRole(spreadIndex, committedSpread.current, f?.dir ?? null)
    const { thetaL, thetaR } = spreadPageAnglesTilted(
      spreadIndex,
      committedSpread.current,
      f?.dir ?? null,
      f ? easeTurnWeighted(f.t) : 0,
      layer.stage
    )
    return { role, thetaL, thetaR, beta: thetaL - thetaR }
  }

  // --- the hand: drag the basket along the wire, release HOLDS -------------
  //
  // CLASS A-P projection (handle-projection.ts). This handle used to take the
  // plain page-plane read every tab in the book takes — and the gesture-axis
  // gate measured what that cost: 64.9 degrees between the direction the reader
  // must drag and the direction the paper under their finger goes, more than
  // twice the book's bar, filed as a known failure with this file's name on it.
  // The cause is that the trolley is NOT on the page: it rides an arc inside a
  // sheet standing at rootDeg 82, and reading its travel off the page's fore
  // axis throws away the whole climb. The s6 stall row's cylinder read does not
  // transplant (that pathology is a rotation; this is a translation), so the fix
  // is to measure the hand where the piece actually travels — on the SHEET's
  // plane, along the CABLE's own tangent.
  const travelFrame = (s: number, thetaL: number, thetaR: number) =>
    dispatchLineTravelFrame(layer, s, thetaL, thetaR)
  const projectPointerD = (
    e: ThreeEvent<PointerEvent>,
    f: { center: Vec3; n: Vec3; dir: Vec3 }
  ): number | null => projectPlaneAlong(pointerLocalRay(e), f.center, f.n, f.dir)

  const releaseGrab = (e?: ThreeEvent<PointerEvent> | null): void => {
    if (!grabRef.current) return
    grabRef.current = null
    tap.end(sendChannel) // a press that never sent the basket answers with a nudge
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
    const sStart = clamp(readUserDrive(sendChannel) ?? sRef.current, 0, 1)
    // The travel frame is frozen at the grab, like dGrab itself: one stable
    // axis for the whole stroke, so the mapping cannot shift under the hand as
    // the wire's tangent changes along the sag.
    const frame0 = travelFrame(dispatchLineRiderS(layer, sStart), thetaL, thetaR)
    const dGrab = projectPointerD(e, frame0)
    if (dGrab === null) return
    st.beginGrab(layer.id, 'tab')
    if (useStorybookStore.getState().grab?.id !== layer.id) return
    grabRef.current = { sStart, dGrab, frame: frame0 }
    writeUserDrive(sendChannel, sStart, [0, 1])
    tap.begin(sStart)
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
    const dNow = projectPointerD(e, grab.frame)
    if (dNow === null) return
    const sUser = clamp(grab.sStart + (dNow - grab.dGrab) / grab.frame.len, 0, 1)
    writeUserDrive(sendChannel, sUser, [0, 1])
    // The send stroke is normalised, so TAP_EPS is read as a thousandth of the
    // whole wire — a press that moves the basket less than that is a click.
    tap.track(sUser, TAP_EPS)
    e.stopPropagation()
  }

  const onPointerOver = (): void => {
    markHandleHovered(layer.id, spreadIndex)
  }
  const onPointerOut = (): void => {
    useStorybookStore.getState().clearHover(layer.id)
  }

  useFrame((state, delta) => {
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

    // THE LANTERNS BREATHE (item 5). The sheet is die-cut down to a wire, its
    // masts and its lamps, so a multiplicative tint on the print is light on
    // those lamps and on nothing else. Panel only — the trolley above owns its
    // own tint.
    if (idle) {
      panelMaterial.color.setScalar(
        1 + idleOffset(idle.peak, idle.seed, state.clock.elapsedTime, beta, idle.pinned || frame.current !== null)
      )
    }

    writeQuads(panelGeometry, solveStagedChainPose(dispatchLinePanel(layer), thetaL, thetaR).panels)
    const shown = shownSend(sendChannel, drive, override !== null)
    const s = dispatchLineRiderS(layer, shown)
    // THE LANDING (S4R3-2). One number — how far into the last fifth of the
    // wire the reader has pushed — drives all three parts of the payoff, so a
    // basket parked half-way in keeps half an event and a page turn folds it
    // flat with everything else on the sheet.
    const dockT = dispatchLineDockT(layer, shown)
    const tip = ((layer.dock?.tipDeg ?? 0) * Math.PI) / 180
    const rider = rotateQuadInPlane(
      dispatchLineBasketQuad(layer, s, thetaL, thetaR),
      // The pannier tips the way the wire falls, so the letters go INTO the
      // roost rather than back up the line. The sheet's own openness gates it,
      // like every other excursion in the book: at book-close there is nothing
      // to tip over.
      tip * dockT * idleGate(beta, false)
    )
    writeQuads(riderGeometry, [rider])
    writeQuads(slopGeometry, [enlargeQuad(rider, handleSlopFactor(rider, TOUCH_SLOP))])

    if (layer.dock) {
      const [ru, rv] = dispatchLineRavenUV(layer, dockT)
      writeQuads(ravenGeometry, [
        dispatchLineSpriteQuad(layer, ru, rv, layer.basketHalfU, layer.basketHalfV, thetaL, thetaR),
      ])
      const [lu, lv] = dispatchLineCableAt(layer, layer.dock.lampS)
      writeQuads(lampGeometry, [
        dispatchLineSpriteQuad(
          layer,
          lu,
          lv,
          layer.basketHalfU * 0.6,
          layer.basketHalfV * 0.6,
          thetaL,
          thetaR
        ),
      ])
      // The raven only exists once it is airborne; the lamp comes up first, so
      // the light arrives ahead of the bird.
      ravenMaterial.opacity = Math.max(0, dockT * dockT)
      lampMaterial.opacity = Math.min(1, dockT * 1.6)
    }
  })

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={panelRef} geometry={panelGeometry} material={panelMaterial} renderOrder={0} />
      {/* THE LANDING — scenery, deliberately OUTSIDE the pointer group: the
          payoff is something the reader's send causes, never something they can
          grab and stage by hand. */}
      {layer.dock ? <mesh geometry={lampGeometry} material={lampMaterial} renderOrder={1} /> : null}
      {layer.dock ? <mesh geometry={ravenGeometry} material={ravenMaterial} renderOrder={3} /> : null}
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
