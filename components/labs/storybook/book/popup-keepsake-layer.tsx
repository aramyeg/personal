'use client'

/**
 * Renders one REMOVABLE KEEPSAKE layer (popup-keepsake.ts, D6): a flat die-cut
 * card in a page-internal sleeve that the reader pulls clear of the book. The
 * card slides coplanar with the page (invariant I1) until it detaches past
 * p_exit, then settles onto a world-fixed desk seat; grabbing the seated card,
 * or any book-state change with it out, plays the auto-return home (law H8).
 *
 * D6 "THE HAND": the card is a real REMOVAL handle (law H7 grammar — a proud,
 * dog-eared card corner, NOT the tab piece's flush grip-notch tab). While in
 * the sleeve the drag maps 1:1 to the pull p; crossing p_exit while grabbed
 * detaches it (grab ends, settle begins). The seated card is a click target
 * that triggers its own auto-return. High-frequency pull values live in the
 * module scrub channel (user-drive.ts); zustand holds only the low-frequency
 * grab identity and the H8 macro state (home/out/returning).
 *
 * The macro state resets to HOME on every mount (useEffect below) — a lab exit
 * / unmount is a state reset, so a card can never persist OUT across a re-entry.
 *
 * Follows the tab-piece / knob-tower layer conventions: unlit print, the
 * piece's own kraft fallback tint, a BackSide interior mesh, a cut-edge
 * hairline, DynamicDrawUsage positions rewritten per frame, an invisible exact
 * + 1.5x touch-slop hit mesh, and a contact/drop shadow at renderOrder -1.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { makeKeepsakeCanvas, makePaperCanvas, makeShadowCanvas } from '../procedural/paper-texture'
import { makeCanvasTexture } from './book'
import { kraftTints } from './paper-stock'
import { liveSpreadRole, spreadPageAnglesTilted, type KeepsakeGeom, type Vec3 } from './popup-mechanics'
import {
  KEEPSAKE_POPUP_WORLD_Y,
  KEEPSAKE_RETURN_MS,
  keepsakeCardInPlane,
  keepsakePExit,
  keepsakeSeatCorners,
  keepsakeSleeveLines,
  keepsakeTwoLegPose,
} from './popup-keepsake'
import { shadowLift } from './shadow-light'
import { easeTurnWeighted } from './page-geometry'
import { TURN_MS, type TurnFrame } from './use-turn-driver'
import { useArtTexture } from './use-layer-texture'
import { useStorybookStore } from '../store'
import {
  beginGrabChannel,
  clearUserDrive,
  endGrabChannel,
  readUserDrive,
  writeUserDrive,
} from '../user-drive'
import { STEP_CAP, stepUserDriveReturn, turnFrames } from './user-drive-return'
import { pointerLocalRay } from './user-drive-pointer'

const FLAT_EPSILON = 0.02
const SHADOW_Y_LIFT = 0.001
const CARD_SHADOW_MAX = 0.3
const FOLD_SHADE_TINT = '#d9cdb4'
const CUT_EDGE_COLOR = '#f6eedb'
const TOUCH_SLOP = 1.5

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

// Scratch for the H7 pointer projection (one grab at a time, consumed at once).
const _plane = new THREE.Plane()
const _u = new THREE.Vector3()
const _hit = new THREE.Vector3()

/** Dev-only keepsake override for the D6 capture deck: `?sbkeepsake=<p|seated>`
 *  freezes the card at pull `p` (in the sleeve) or fully `seated` on the desk,
 *  like ?sbdrive / ?sbknob. Compiled out of production builds. */
function readKeepsakeOverride(): { seated: true } | { p: number } | null {
  if (process.env.NODE_ENV === 'production') return null
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('sbkeepsake')
  if (raw === null) return null
  if (raw === 'seated') return { seated: true }
  const p = Number(raw)
  return Number.isFinite(p) ? { p } : null
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

function makeEdgeGeometry(count: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
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

function writeSegments(geometry: THREE.BufferGeometry, points: readonly Vec3[]): void {
  const attr = geometry.getAttribute('position') as THREE.BufferAttribute
  const arr = attr.array as Float32Array
  points.forEach((p, i) => {
    arr[i * 3] = p[0]
    arr[i * 3 + 1] = p[1]
    arr[i * 3 + 2] = p[2]
  })
  attr.needsUpdate = true
  geometry.computeBoundingSphere()
}

function enlargeQuad(quad: readonly Vec3[], k: number): Vec3[] {
  const c: number[] = [0, 0, 0]
  for (const p of quad) for (let i = 0; i < 3; i++) c[i] += p[i] / 4
  return quad.map((p) => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k, c[2] + (p[2] - c[2]) * k] as Vec3)
}

const centroid = (quad: readonly Vec3[]): Vec3 => {
  const c: number[] = [0, 0, 0]
  for (const p of quad) for (let i = 0; i < 3; i++) c[i] += p[i] / 4
  return [c[0], c[1], c[2]]
}

/** The seat pose mapped into the popup group's LOCAL frame (world minus the
 *  container lift) — the card is authored on the desk in WORLD, but rendered as
 *  a child of the popup group like every other page piece (see the constant's
 *  note on the rest-pose approximation). */
const seatLocalCorners = (geom: KeepsakeGeom): Vec3[] =>
  keepsakeSeatCorners(geom).map((c) => [c[0], c[1] - KEEPSAKE_POPUP_WORLD_Y, c[2]] as Vec3)

export function KeepsakePopupLayer({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & KeepsakeGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const shadowRef = useRef<THREE.Mesh>(null)
  const handleRef = useRef<THREE.Mesh>(null)
  const slopRef = useRef<THREE.Mesh>(null)
  const gl = useThree((s) => s.gl)

  const cardArt = useArtTexture(layer.id)
  const tint = useMemo(() => kraftTints(layer.id), [layer.id])
  const returnMs = layer.returnMs ?? KEEPSAKE_RETURN_MS
  const pExit = useMemo(() => keepsakePExit(layer), [layer])

  const cardGeometry = useMemo(() => makeQuadGeometry(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), [])
  const edgeGeometry = useMemo(() => makeEdgeGeometry(4), [])
  const handleGeometry = useMemo(() => makeQuadGeometry(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), [])
  const slopGeometry = useMemo(() => makeQuadGeometry(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), [])
  // The printed pocket: the fore-edge slit + the sleeve mouth, two hairlines
  // riding the page rigidly (the tabPieceSlit precedent) so the card reads as
  // drawn from a real cut pocket even while it is out on the desk.
  const sleeveGeometry = useMemo(() => makeEdgeGeometry(4), []) // two segments

  const handleMaterial = useMemo(() => new THREE.MeshBasicMaterial({ visible: false }), [])
  const edgeMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: CUT_EDGE_COLOR, transparent: true, opacity: 0.85 }),
    []
  )
  const sleeveMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: tint.edge, transparent: true, opacity: 0.9 }),
    [tint]
  )

  const keepsakeTexture = useMemo(() => makeCanvasTexture(makeKeepsakeCanvas()), [])
  const paperTexture = useMemo(() => makeCanvasTexture(makePaperCanvas(256, 256)), [])
  const materials = useMemo(
    () => ({
      front: new THREE.MeshBasicMaterial({ side: THREE.FrontSide, transparent: true, alphaTest: 0.1, color: '#ffffff' }),
      back: new THREE.MeshBasicMaterial({ side: THREE.BackSide, transparent: true, alphaTest: 0.1, map: paperTexture, color: FOLD_SHADE_TINT }),
    }),
    [paperTexture]
  )

  useEffect(() => {
    const texture = cardArt ?? keepsakeTexture
    if (cardArt) {
      cardArt.wrapS = THREE.ClampToEdgeWrapping
      cardArt.wrapT = THREE.ClampToEdgeWrapping
    }
    materials.front.map = texture
    materials.front.color.set(cardArt ? '#ffffff' : tint.lit)
    materials.front.needsUpdate = true
  }, [cardArt, keepsakeTexture, materials, tint])

  const shadowTexture = useMemo(() => makeCanvasTexture(makeShadowCanvas()), [])
  const shadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 }),
    [shadowTexture]
  )
  // The seated card's far edge lifts off the desk by (cardW/2) sin(tilt): the
  // key-light response for its drop shadow (shadow-light.ts).
  const seatLift = useMemo(() => {
    const peak = ((layer.z1 - layer.z0) / 2) * Math.sin((layer.seat.tiltDeg * Math.PI) / 180)
    return shadowLift(Math.max(0, peak))
  }, [layer])

  // Mount reset (law H8): a fresh lab session always starts the card HOME with
  // no stale scrub value — a lab exit / unmount is a state reset.
  useEffect(() => {
    useStorybookStore.getState().keepsakeReset(layer.id)
    clearUserDrive(layer.id)
    return () => {
      clearUserDrive(layer.id)
      endGrabChannel(layer.id)
    }
  }, [layer.id])

  useEffect(
    () => () => {
      cardGeometry.dispose()
      edgeGeometry.dispose()
      handleGeometry.dispose()
      slopGeometry.dispose()
      sleeveGeometry.dispose()
      handleMaterial.dispose()
      edgeMaterial.dispose()
      sleeveMaterial.dispose()
      keepsakeTexture.dispose()
      paperTexture.dispose()
      materials.front.dispose()
      materials.back.dispose()
      shadowTexture.dispose()
      shadowMaterial.dispose()
    },
    [
      cardGeometry, edgeGeometry, handleGeometry, slopGeometry, sleeveGeometry, handleMaterial,
      edgeMaterial, sleeveMaterial, keepsakeTexture, paperTexture, materials, shadowTexture, shadowMaterial,
    ]
  )

  // --- Grab lifecycle (laws H1/H2/H7). High-frequency pull p flows through the
  // module scrub channel; only the low-frequency grab identity + H8 macro state
  // touch zustand.
  const grabRef = useRef<{ pGrabStart: number; dGrab: number } | null>(null)
  // The card's live LOCAL pose, captured so an auto-return starts from wherever
  // the card actually is (a seated card, or an interrupted mid-settle one).
  const poseRef = useRef<readonly Vec3[]>(seatLocalCorners(layer))
  // The local phase of the out/returning animations, on the frame clock.
  const animRef = useRef<{ kind: 'settle' | 'seated' | 'return'; startT: number; start: readonly Vec3[] } | null>(null)

  const anglesNow = (): { thetaL: number; thetaR: number } =>
    spreadPageAnglesTilted(
      spreadIndex,
      committedSpread.current,
      frame.current?.dir ?? null,
      frame.current ? easeTurnWeighted(frame.current.t) : 0
    )

  /** The pointer's projection onto the live page's slide axis (page-frame u),
   *  in the layer's local frame — the pull coordinate d (law H7, rebuilt from
   *  theta each event). */
  const projectPointerD = (e: ThreeEvent<PointerEvent>, thetaL: number, thetaR: number): number | null => {
    const t = layer.side === 'left' ? thetaL : thetaR
    _u.set(Math.cos(t), Math.sin(t), 0)
    _plane.setComponents(Math.sin(t), -Math.cos(t), 0, 0) // page plane through the spine
    const ray = pointerLocalRay(e)
    if (!ray.intersectPlane(_plane, _hit)) return null
    return _hit.dot(_u)
  }

  const endExtractionGrab = (e: ThreeEvent<PointerEvent>): void => {
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
    const store = useStorybookStore.getState()
    if (!store.booted || store.turning !== null || store.spread !== spreadIndex) return
    const state = store.keepsakes[layer.id] ?? 'home'
    if (state === 'out') {
      // A seated card is a click target — send it home (the reader dismisses
      // it). No grab identity: the auto-return is autonomous, not finger-paced.
      store.keepsakeReturn(layer.id)
      e.stopPropagation()
      return
    }
    if (state !== 'home') return // mid-return: ignore
    const { thetaL, thetaR } = anglesNow()
    const dGrab = projectPointerD(e, thetaL, thetaR)
    if (dGrab === null) return
    const pStart = clamp(readUserDrive(layer.id) ?? 0, 0, pExit)
    store.beginGrab(layer.id, 'keepsake')
    if (useStorybookStore.getState().grab?.id !== layer.id) return // booted/turning re-check no-oped
    grabRef.current = { pGrabStart: pStart, dGrab }
    writeUserDrive(layer.id, pStart, [0, pExit])
    beginGrabChannel(layer.id)
    ;(e.target as Element).setPointerCapture(e.pointerId)
    e.stopPropagation()
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>): void => {
    const grab = grabRef.current
    if (!grab) return
    // A keyboard/wheel turn cannot force-release a keepsake grab (it sequences
    // behind the auto-return, law H8); but a lost grab id still means stop.
    if (useStorybookStore.getState().grab?.id !== layer.id) {
      endExtractionGrab(e)
      return
    }
    const { thetaL, thetaR } = anglesNow()
    const dNow = projectPointerD(e, thetaL, thetaR)
    if (dNow === null) return
    const pRaw = grab.pGrabStart + (dNow - grab.dGrab)
    if (pRaw >= pExit) {
      // Crossed p_exit while grabbed — DETACH: the grab ends and the card
      // settles autonomously onto the desk (it is no longer finger-paced).
      endExtractionGrab(e)
      clearUserDrive(layer.id)
      useStorybookStore.getState().keepsakeOut(layer.id)
      e.stopPropagation()
      return
    }
    writeUserDrive(layer.id, clamp(pRaw, 0, pExit), [0, pExit])
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

  useFrame((state, delta) => {
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
    if (shadowRef.current) shadowRef.current.visible = visible
    if (!visible) return

    const now = state.clock.elapsedTime
    const store = useStorybookStore.getState()
    const macro = store.keepsakes[layer.id] ?? 'home'
    const grabbed = store.grab?.id === layer.id
    const override = readKeepsakeOverride()

    const exitLocal = keepsakeCardInPlane(layer, pExit, thetaL, thetaR)
    const homeLocal = keepsakeCardInPlane(layer, 0, thetaL, thetaR)
    const seatLocal = seatLocalCorners(layer)

    let card: readonly Vec3[]
    let seatedShadow = false

    if (override) {
      // Capture deck: freeze at a pull or fully seated.
      card = 'seated' in override ? seatLocal : keepsakeCardInPlane(layer, clamp(override.p, 0, pExit), thetaL, thetaR)
      seatedShadow = 'seated' in override
    } else if (macro === 'home') {
      animRef.current = null
      // In-sleeve: the pull p from the grab channel, easing home on release.
      let p = readUserDrive(layer.id)
      if (grabbed) {
        p = p ?? 0
      } else if (p !== undefined) {
        // Release return — capped positional slide back to the sleeve (p -> 0),
        // yielding its per-frame budget exactly like the tab/flap return law.
        const worst = (a0: number, a1: number): number => Math.abs(a0 - a1) // rigid slide along u
        const { next, settled } = stepUserDriveReturn(p, 0, turnFrames(delta, TURN_MS), worst, STEP_CAP)
        if (settled) {
          clearUserDrive(layer.id)
          p = 0
        } else {
          writeUserDrive(layer.id, next, [0, pExit])
          p = next
        }
      } else {
        p = 0
      }
      card = keepsakeCardInPlane(layer, p, thetaL, thetaR)
    } else if (macro === 'out') {
      // Detached: settle exit -> seat, then hold at the seat.
      if (!animRef.current || animRef.current.kind === 'return') {
        animRef.current = { kind: 'settle', startT: now, start: exitLocal }
      }
      const anim = animRef.current
      if (anim.kind === 'settle') {
        const eased = easeTurnWeighted(clamp((now - anim.startT) / returnMs, 0, 1))
        // Degenerate second leg (seat -> seat) collapses to the exit -> seat lerp.
        card = keepsakeTwoLegPose(anim.start, seatLocal, seatLocal, eased)
        if (now - anim.startT >= returnMs) animRef.current = { kind: 'seated', startT: now, start: seatLocal }
      } else {
        card = seatLocal
      }
      seatedShadow = true
    } else {
      // Returning: reverse polyline start -> exit -> home, then report home.
      if (!animRef.current || animRef.current.kind !== 'return') {
        animRef.current = { kind: 'return', startT: now, start: poseRef.current }
      }
      const anim = animRef.current
      const eased = easeTurnWeighted(clamp((now - anim.startT) / returnMs, 0, 1))
      card = keepsakeTwoLegPose(anim.start, exitLocal, homeLocal, eased)
      seatedShadow = now - anim.startT < returnMs * 0.5
      if (now - anim.startT >= returnMs) {
        animRef.current = null
        useStorybookStore.getState().keepsakeHomed(layer.id)
      }
    }

    poseRef.current = card
    writeQuad(cardGeometry, card)
    writeQuad(edgeGeometry, card)
    writeQuad(handleGeometry, card)
    writeQuad(slopGeometry, enlargeQuad(card, TOUCH_SLOP))

    const { slit, mouth } = keepsakeSleeveLines(layer, thetaL, thetaR)
    writeSegments(sleeveGeometry, [slit[0], slit[1], mouth[0], mouth[1]])

    // Contact / drop shadow: negligible while the card lies coplanar in the
    // sleeve, a real desk drop shadow once it stands tilted on the desk.
    const shadow = shadowRef.current
    if (shadow) {
      const c = centroid(card)
      shadow.position.set(c[0] + (seatedShadow ? seatLift.dx : 0), SHADOW_Y_LIFT - KEEPSAKE_POPUP_WORLD_Y * (seatedShadow ? 1 : 0), c[2] + (seatedShadow ? seatLift.dz : 0))
      const s = seatedShadow ? seatLift.spread : 0.7
      shadow.scale.set(layer.cardL * s, (layer.z1 - layer.z0) * s, 1)
      shadowMaterial.opacity = CARD_SHADOW_MAX * (seatedShadow ? seatLift.depth : 0.15 * Math.sin(beta / 2) ** 2)
    }
  })

  return (
    <>
      <group ref={groupRef} visible={false}>
        <mesh geometry={cardGeometry} material={materials.front} renderOrder={0} />
        <mesh geometry={cardGeometry} material={materials.back} renderOrder={0} />
        <lineLoop geometry={edgeGeometry} material={edgeMaterial} renderOrder={1} />
        <lineSegments geometry={sleeveGeometry} material={sleeveMaterial} renderOrder={1} />
        {/* Invisible removal handle (raycast targets, never rendered): the card
            quad exact for mouse/pen, 1.5x for touch (laws H6/H7). */}
        <group
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endExtractionGrab}
          onPointerCancel={endExtractionGrab}
          onLostPointerCapture={endExtractionGrab}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
        >
          <mesh ref={handleRef} geometry={handleGeometry} material={handleMaterial} renderOrder={2} />
          <mesh ref={slopRef} geometry={slopGeometry} material={handleMaterial} renderOrder={2} />
        </group>
      </group>
      {/* renderOrder=-1: all ground shading joins the gutter crease's early
          transparent tier (D-G3 audit) so no shadow can draw over paper. */}
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} material={shadowMaterial} renderOrder={-1} visible={false}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </>
  )
}
