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
  stripFlapTravel,
  STRIPFLAP_ANTI_FLIP,
  type StripFlapGeom,
  type Vec3,
} from './popup-mechanics'
import { idleOffset, idlePeak, idleSeed, type IdleKind } from './idle-life'
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
import { applyHandleGlow, stepHoverGlow } from './handle-hover'
import { pointerLocalRay } from './user-drive-pointer'
import { HANDLE_SLOP_STANDING, acceptsHandleHit, handleSlopFactor } from './handle-hit'
import { NUDGE_SPAN_ANGLE, TAP_EPS, nudgeOffset } from './handle-nudge'
import { useHandleTap } from './use-handle-tap'
import { projectHingeAngle } from './handle-projection'

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

/** A pinned pose (`?sbpose=`) freezes the idle clock, so golden captures and
 *  the physics bench stay run-to-run identical. Local twin of the generic
 *  layer's guard: importing it would couple two renderers for four lines. */
function idlePosePinned(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has('sbpose')
}
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

  // Rebuilt if an atlas rect resolves, so the two half-quads address this
  // figure's region of a shared page instead of the whole atlas.
  const geometries = useMemo(
    () => ({
      right: makePanelGeometry(applyUvRect(RIGHT_UVS, rect)),
      left: makePanelGeometry(applyUvRect(LEFT_UVS, rect)),
    }),
    [rect]
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

  /** The pointer's angle about the flap hinge line, in the flap swing plane
   *  (law H3): intersect the ray with the plane through the hinge centre
   *  normal to the hinge axis, then atan2(along n, along flat). */
  const angleAboutHinge = (e: ThreeEvent<PointerEvent>, thetaL: number, thetaR: number): number | null => {
    const fr = stripFlapFrame(layer, thetaL, thetaR)
    return projectHingeAngle(pointerLocalRay(e), fr.center, fr.hinge, fr.flat, fr.n)
  }

  const releaseGrab = (e: ThreeEvent<PointerEvent>): void => {
    if (!grabRef.current) return
    grabRef.current = null
    tap.end(layer.id) // a press that never moved the flap answers with a nudge
    endGrabChannel(layer.id)
    useStorybookStore.getState().endGrab()
    try {
      ;(e.target as Element).releasePointerCapture(e.pointerId)
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
    const st = useStorybookStore.getState()
    if (st.grab === null && st.booted && st.turning === null && st.spread === spreadIndex) {
      // ONE cursor identity (s4 reader: the native hand and the gold quill both
      // appeared over a handle). The store's `hover` is the single source; the
      // canvas cursor is owned entirely by book-scene.tsx's CanvasCursor, which
      // shows a native hand ONLY where the quill sprite is not drawn.
      st.setHover(layer.id)
    }
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
    const pose = solveStripFlapPoseAt(layer, shownA, thetaL, thetaR)
    writeQuad(geometries.right, pose.right)
    writeQuad(geometries.left, pose.left)
    // Slop spans the WHOLE flap (both halves): base ends h0/h1 and their tops.
    const full: Vec3[] = [pose.left[1], pose.right[1], pose.right[2], pose.left[2]]
    writeQuad(slopGeometry, enlargeQuad(full, handleSlopFactor(full, TOUCH_SLOP)))
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
