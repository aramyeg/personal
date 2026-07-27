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
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { useGuardedDispose } from './material-pool'
import { sharedHandleMaterial, sharedShadowTexture } from './shared-procedural-textures'
import {
  liveSpreadRole,
  solveStripFlapPoseAt,
  spreadPageAnglesTilted,
  stripFlapDetent,
  stripFlapFrame,
  stripFlapHoldEnvelope,
  stripFlapRestLift,
  stripFlapRippleColumns,
  stripFlapRipplePhase,
  stripFlapTravel,
  STRIPFLAP_ANTI_FLIP,
  type StripFlapGeom,
  type Vec3,
} from './popup-mechanics'
import { idleClockPinned, idleOffset, idlePeak, idleSeed, type IdleKind } from './idle-life'
import { peakHeight, shadowLift } from './shadow-light'
import { easeTurnWeighted } from './page-geometry'
import type { TurnFrame } from './use-turn-driver'
import { useLayerSprite } from './use-layer-texture'
import { applyUvRect } from '../art-atlas'
import { useStorybookStore } from '../store'
import {
  beginGrabChannel,
  endGrabChannel,
  readDriveOverride,
  readUserDrive,
  writeUserDrive,
} from '../user-drive'
import { applyHandleGlow, stepHoverGlow, markHandleHovered } from './handle-hover'
import { pointerLocalRay } from './user-drive-pointer'
import { HANDLE_SLOP_STANDING, acceptsHandleHit, hitQuadFor } from './handle-hit'
import { NUDGE_SPAN_ANGLE, TAP_EPS, nudgeOffset } from './handle-nudge'
import { useHandleTap } from './use-handle-tap'
import { projectHingeAngle, projectHingeAngleCyl } from './handle-projection'

const FLAT_EPSILON = 0.02
const SHADOW_HEIGHT = 0.16
const SHADOW_Y_LIFT = 0.001
const SHADOW_MAX_OPACITY = 0.32
const FOLD_SHADE_TINT = '#d9cdb4'
// E-G5 floor (f): a PAINTED stripflap gets this gentle NEUTRAL step on its
// shaded leaf; the warm FOLD_SHADE_TINT (~x0.85/0.80/0.71) is reserved for a
// kraft placeholder flap (no texture) so painted art is not dimmed + warm-cast.
const PAINTED_FOLD_SHADE = '#e4e4e4'
/** The glint's shade-panel base — the SAME constant the texture effect installs
 *  on the shaded leaf, re-derived rather than snapshotted so the two cannot
 *  silently disagree (popup-spread.tsx keeps the identical pair). */
const IDLE_SHADE_BASE = new THREE.Color(PAINTED_FOLD_SHADE)

/** A pinned pose (`?sbpose=`) freezes the idle clock so golden captures and the
 *  physics bench stay run-to-run identical; `?sbidle=1` starts it again. This
 *  was a local twin of the generic layer's guard — four duplicated lines that
 *  turned out to decide whether a blind reviewer can see the book breathe at
 *  all (S2R2-4), which is not a decision to keep two copies of. */
const idlePosePinned = idleClockPinned
const ANTI_FLIP = STRIPFLAP_ANTI_FLIP // the user ceiling (law H3): past vertical the figure flips
const TOUCH_SLOP = HANDLE_SLOP_STANDING

const rad = (d: number): number => (d * Math.PI) / 180
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
/** Wrap an angle delta to (-pi, pi] so a grab tracks the short way round. */
const wrapDelta = (d: number): number => Math.atan2(Math.sin(d), Math.cos(d))

// Stripflap uvs are fixed (fold split 0.5, never die-flipped): the print
// continues seamlessly across the invisible centre seam (matches panelUvs).
const RIGHT_UVS = new Float32Array([0.5, 0, 1, 0, 1, 1, 0.5, 1])
const LEFT_UVS = new Float32Array([0.5, 0, 0, 0, 0, 1, 0.5, 1])

/** The u band of RIPPLE column `i` of `n`, as the two half-quads' uvs. At n = 1
 *  this returns the two constants above byte-for-byte, so an un-rippled flap
 *  addresses its print exactly as it always did. */
function columnUvs(i: number, n: number): { right: Float32Array; left: Float32Array } {
  if (n <= 1) return { right: RIGHT_UVS.slice(), left: LEFT_UVS.slice() }
  const a = i / n
  const b = (i + 1) / n
  const m = (a + b) / 2
  return {
    right: new Float32Array([m, 0, b, 0, b, 1, m, 1]),
    left: new Float32Array([m, 0, a, 0, a, 1, m, 1]),
  }
}

/** One buffer holding `uvs.length / 8` quads — the whole rank's lit (or shaded)
 *  halves in ONE geometry, so a six-card ripple costs the same two draws the
 *  single flap cost (the spread's turn-pair draw budget is already at its
 *  ceiling: content.ts gate-matrix G5). */
function makePanelGeometry(uvs: Float32Array): THREE.BufferGeometry {
  const quads = uvs.length / 8
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(12 * quads), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  const index = new Uint16Array(6 * quads)
  for (let q = 0; q < quads; q++) {
    const o = q * 4
    index.set([o, o + 1, o + 2, o, o + 2, o + 3], q * 6)
  }
  geometry.setIndex(new THREE.BufferAttribute(index, 1))
  return geometry
}

function writeQuads(geometry: THREE.BufferGeometry, quads: readonly (readonly Vec3[])[]): void {
  const attr = geometry.getAttribute('position') as THREE.BufferAttribute
  const arr = attr.array as Float32Array
  for (let q = 0; q < quads.length; q++) {
    for (let c = 0; c < 4; c++) {
      const o = (q * 4 + c) * 3
      arr[o] = quads[q][c][0]
      arr[o + 1] = quads[q][c][1]
      arr[o + 2] = quads[q][c][2]
    }
  }
  attr.needsUpdate = true
  geometry.computeBoundingSphere()
}

const writeQuad = (geometry: THREE.BufferGeometry, quad: readonly Vec3[]): void =>
  writeQuads(geometry, [quad])

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

  const { texture, rect } = useLayerSprite(layer.id, layer.kind, accents)

  // THE RIPPLE (A-4): the rank's paper as the cards it is printed as. One entry
  // — the layer itself — for every flap that declares no ripple, which is all of
  // them but the s6 stall rank.
  const columns = useMemo(() => stripFlapRippleColumns(layer), [layer])

  // Rebuilt if an atlas rect resolves, so the half-quads address this figure's
  // region of a shared page instead of the whole atlas. One buffer per side
  // carrying every column, so the draw count is 2 whatever the card count is.
  const geometries = useMemo(() => {
    const n = columns.length
    const right = new Float32Array(8 * n)
    const left = new Float32Array(8 * n)
    for (let i = 0; i < n; i++) {
      const uv = columnUvs(i, n)
      right.set(applyUvRect(uv.right, rect), i * 8)
      left.set(applyUvRect(uv.left, rect), i * 8)
    }
    return { right: makePanelGeometry(right), left: makePanelGeometry(left) }
  }, [rect, columns])
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
    // Painted leaf: swap the warm kraft seam for the neutral painted step
    // (floor f). A kraft flap has no texture, so it keeps FOLD_SHADE_TINT from
    // material creation and never reaches here.
    materials.left.color.set(PAINTED_FOLD_SHADE)
    materials.left.needsUpdate = true
  }, [texture, materials])

  // The reader's hard stops for this piece (law H3 + the s6 travel window).
  const travel = useMemo(() => stripFlapTravel(layer), [layer])

  // IDLE LIFE, OPT-IN (E3 WAVE-2 s7). FIX-SYS wired idle-life into the generic
  // PopupLayer only, which covers v-folds/children/riders — every strip flap in
  // the book (the s7 clerk with his never-flickering candle among them) was left
  // outside it. This is the same resolve-once shape popup-spread.tsx uses, and
  // it is GLINT-ONLY by design: 'sway'/'drift' would move a figure the reader
  // can also grab, i.e. a second, smaller copy of this family's own travel —
  // the exact thing handle-hover.ts forbids an untouched piece from implying.
  // An UNTAGGED strip flap resolves to null and pays one null check per frame:
  // no transform, no tint write, bit-identical to what it drew before.
  const idle = useMemo(() => {
    const tag = layer.idle
    if (!tag || tag.kind !== 'glint') return null
    return {
      seed: idleSeed(layer.id),
      peak: idlePeak(tag.kind as IdleKind, tag.amp),
      pinned: idlePosePinned(),
    }
  }, [layer.idle, layer.id])

  const shadow = useMemo(() => {
    // Reference pose for the pool's SIZE and DEPTH: the piece STANDING. A
    // page-driven flap stands at rest, so this is the shadow it always had. A
    // reader-raised flap is handed over lying down, so its pool is sized to the
    // pose the reader will raise it to — the pool then only has to fade in
    // (below), never re-derive its own geometry mid-drag.
    const standing =
      layer.restDeg === undefined ? stripFlapRestLift(layer, Math.PI) : travel[1]
    const rest = solveStripFlapPoseAt(layer, standing, Math.PI, 0)
    const lift = shadowLift(peakHeight([rest.left, rest.right]))
    const sign = layer.side === 'left' ? -1 : 1
    return {
      position: [sign * layer.hingeX + lift.dx, SHADOW_Y_LIFT, layer.hingeZ + lift.dz] as [number, number, number],
      size: [layer.width * 0.9 * lift.spread, SHADOW_HEIGHT * 0.8 * lift.spread] as [number, number],
      maxOpacity: SHADOW_MAX_OPACITY * lift.depth,
    }
  }, [layer, travel])
  const shadowTexture = sharedShadowTexture()
  const shadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 }),
    [shadowTexture]
  )

  useGuardedDispose([geometries.right, geometries.left, slopGeometry, materials.right, materials.left, shadowMaterial])

  // --- Grab lifecycle (laws H1-H3). Offset-captured hinge angle for continuity.
  const grabRef = useRef<{ aGrabStart: number; angleGrab: number } | null>(null)
  const tap = useHandleTap()

  const anglesNow = (): { thetaL: number; thetaR: number } =>
    spreadPageAnglesTilted(
      spreadIndex,
      committedSpread.current,
      frame.current?.dir ?? null,
      frame.current ? easeTurnWeighted(frame.current.t) : 0
    )

  /** The pointer's angle about the flap hinge line (law H3). The family's
   *  default is the swing-PLANE intersection; a piece whose swing plane the
   *  reading camera sees edge-on opts into the CYLINDER read instead, where the
   *  flap's own tip circle — not an infinite plane — carries the angle
   *  (StripFlapGeom.grabProjection, handle-projection.ts class B1-C). */
  const angleAboutHinge = (e: ThreeEvent<PointerEvent>, thetaL: number, thetaR: number): number | null => {
    const fr = stripFlapFrame(layer, thetaL, thetaR)
    const ray = pointerLocalRay(e)
    return layer.grabProjection === 'cylinder'
      ? projectHingeAngleCyl(ray, fr.center, fr.hinge, fr.flat, fr.n, layer.height)
      : projectHingeAngle(ray, fr.center, fr.hinge, fr.flat, fr.n)
  }

  const releaseGrab = (e?: ThreeEvent<PointerEvent> | null): void => {
    if (!grabRef.current) return
    grabRef.current = null
    tap.end(layer.id) // a press that never moved the flap answers with a nudge
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
    const { thetaL, thetaR } = anglesNow()
    const angleGrab = angleAboutHinge(e, thetaL, thetaR)
    if (angleGrab === null) return
    const restA = stripFlapRestLift(layer, thetaL - thetaR)
    const aGrabStart = clamp(readUserDrive(layer.id) ?? restA, travel[0], travel[1])
    st.beginGrab(layer.id, 'flap')
    if (useStorybookStore.getState().grab?.id !== layer.id) return
    grabRef.current = { aGrabStart, angleGrab }
    writeUserDrive(layer.id, aGrabStart, travel)
    tap.begin(aGrabStart)
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
    const { thetaL, thetaR } = anglesNow()
    const angleNow = angleAboutHinge(e, thetaL, thetaR)
    if (angleNow === null) return
    // The detent runs on the DRIVE so the piece latches exactly on a stop.
    const aUser = stripFlapDetent(
      grab.aGrabStart + wrapDelta(angleNow - grab.angleGrab),
      travel[0],
      travel[1]
    )
    writeUserDrive(layer.id, aUser, travel)
    tap.track(aUser, TAP_EPS)
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
    if (!visible) return

    // HOVER RESPONSE (BW-1): the piece under the reader's hand catches the
    // candlelight. Light rather than motion, deliberately — a geometric lift
    // would be a second, smaller version of the mechanism's own travel, which is
    // the one thing a hover must not imply (see handle-hover.ts).
    {
      const glowSt = useStorybookStore.getState()
      const w = stepHoverGlow(
        layer.id,
        delta,
        glowSt.hover === layer.id || glowSt.grab?.id === layer.id
      )
      for (const m of [materials.right, materials.left]) applyHandleGlow(m, w)
      // IDLE GLINT, composed under the hover glow rather than fought with it:
      // the glow snapshots whatever colour it finds as its restore base, so a
      // glint writing every frame would hand it a moving base. While the hand is
      // on the piece the glow owns the tint (which is what a reader wants — the
      // answer to their pointer, not weather); the breath resumes the moment the
      // glow lets go, and at excursion 0 both panels land on their exact bases.
      if (idle && w <= 0) {
        const k =
          1 +
          idleOffset(
            idle.peak,
            idle.seed,
            state.clock.elapsedTime,
            beta,
            idle.pinned || (f?.dir ?? null) !== null
          )
        materials.right.color.setScalar(k)
        materials.left.color.copy(IDLE_SHADE_BASE).multiplyScalar(k)
      }
    }

    // The un-driven pose: the strip cam for a page-driven flap, the declared
    // rest angle for a reader-raised one (S6-5 — the stalls are handed over
    // lying flat on the page and the reader is the one who raises them).
    const camA = stripFlapRestLift(layer, beta)
    const override = readDriveOverride(layer.id)
    const grabbed = useStorybookStore.getState().grab?.id === layer.id
    const channelA = readUserDrive(layer.id)
    let effectiveA: number
    if (override !== null) {
      effectiveA = clamp(rad(override), 0, ANTI_FLIP) // ?sbdrive value is degrees
    } else if (grabbed) {
      effectiveA = channelA ?? camA
    } else if (channelA !== undefined) {
      // RELEASE = LATCH (E3 release law, BW-12). This used to decay back to the
      // page cam, and blind readers hated it in the same words on two different
      // spreads: "springs back on release; nothing persists", "the one hidden
      // gesture produces a ~30px bow that springs straight back". A real paper
      // flap stays where your finger left it. The held angle is kept as-is and
      // the SHOWN lift is angle * stripFlapHoldEnvelope(beta) — the lift-flap
      // persistence composition — so fold-flat at book close is preserved for
      // any held angle without a per-frame return at all.
      effectiveA = clamp(channelA, travel[0], travel[1]) * stripFlapHoldEnvelope(layer, beta)
    } else {
      effectiveA = camA
    }

    // Tap answer (BW-18): a render-time excursion only — never written to the
    // channel, so it cannot survive a turn or leak into the release return.
    // Bounded by the piece's own travel window, so the nudge rocks the flap the
    // way the reader could — a piece lying at its lower stop rocks UP (which is
    // exactly the invitation a reader-raised row wants), one standing at its
    // ceiling rocks down.
    const shownA = clamp(
      effectiveA + nudgeOffset(layer.id, effectiveA, travel[0], travel[1], NUDGE_SPAN_ANGLE),
      0,
      ANTI_FLIP
    )
    // THE RIPPLE (A-4). The rank's own progress across the reader's window at
    // THIS dihedral drives a per-card phase; the phase map is bounded above by
    // that progress, so every card's angle stays under the rank's and the
    // fold-flat / turn-step arguments are inherited rather than re-made. A flap
    // with no ripple has one column at phase identity — the same single solve,
    // the same two quads, bit-identical.
    const env = stripFlapHoldEnvelope(layer, beta)
    const floorA = travel[0] * env
    const topA = travel[1] * env
    const span = topA - floorA
    const p = span > 1e-6 ? clamp((shownA - floorA) / span, 0, 1) : 0
    const rightQuads: (readonly Vec3[])[] = []
    const leftQuads: (readonly Vec3[])[] = []
    for (let i = 0; i < columns.length; i++) {
      const aCard =
        columns.length > 1 ? floorA + stripFlapRipplePhase(layer, p, i) * span : shownA
      const pose = solveStripFlapPoseAt(columns[i], aCard, thetaL, thetaR)
      rightQuads.push(pose.right)
      leftQuads.push(pose.left)
    }
    writeQuads(geometries.right, rightQuads)
    writeQuads(geometries.left, leftQuads)
    // Slop spans the WHOLE flap (both halves): base ends h0/h1 and their tops —
    // across the rank, the outermost cards' outer edges.
    const loPose = { left: leftQuads[0], right: rightQuads[0] }
    const hiPose = {
      left: leftQuads[leftQuads.length - 1],
      right: rightQuads[rightQuads.length - 1],
    }
    const full: Vec3[] = [loPose.left[1], hiPose.right[1], hiPose.right[2], loPose.left[2]]
    // SCREEN HIT FLOOR (R-3): the world-space pad above cannot see that a
    // leaning flap has turned nearly edge-on to the reader — rotating a quad
    // never changes its edge LENGTHS, only its projection. Measured across this
    // family's own travel: the s6 vendor collapses 96x94 -> 108x37 px at his
    // latch, and the stall row passes through 474x21 px. A latched state whose
    // handle is a sliver is a piece the reader cannot take back, so the hit quad
    // is stretched along whichever of its own axes is collapsing until it clears
    // the touch floor. A piece facing the reader is untouched (k = 1).
    writeQuad(slopGeometry, hitQuadFor(full, TOUCH_SLOP))
    // THE POOL TRACKS THE LIFT (s6 S6-3, second half). The pool used to depend
    // on the page dihedral alone, so a flap the reader had pressed all the way
    // down still cast a standing figure's shadow — the one cue that would have
    // told them the fold had landed, contradicting it. The ratio is measured
    // against the piece's OWN standing reference at this same dihedral, so an
    // un-driven page-driven flap is exactly 1 at every beta and its pool is
    // bit-identical to the shipped one; only a moved flap changes.
    const standingNow =
      layer.restDeg === undefined ? camA : travel[1] * stripFlapHoldEnvelope(layer, beta)
    const ref = Math.sin(Math.min(standingNow, ANTI_FLIP))
    const liftFraction = ref > 1e-6 ? clamp(Math.sin(shownA) / ref, 0, 1) : 0
    shadowMaterial.opacity =
      (shadow?.maxOpacity ?? SHADOW_MAX_OPACITY) * Math.sin(beta / 2) ** 2 * liftFraction
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
