'use client'

/**
 * Renders one KNOB-TWIST TOWER layer (popup-knobtower.ts, D6): a die-cut knob
 * disc riveted flat into the page plus a row of N staggered knee towers that
 * the crank erects as the knob is twisted. PAGE-ROOTED like the tab piece —
 * one page carries the whole assembly.
 *
 * D6 "THE HAND": the knob disc is a real ROTATION handle (law H4). While
 * grabbed, the twist tracks the pointer's angle about the hub (per-frame
 * deltas, discarded near the numerically-unstable centre); release holds theta
 * PERMANENTLY — the coplanar disc remembers the twist through page turns and
 * book close/reopen (the fold-flat composition a_shown = a(theta)*E(beta)
 * collapses every tier at close for any frozen theta), so there is no return
 * law here. The high-frequency twist lives in the module scrub channel; the
 * dev override `?sbknob=<deg>` still freezes it for the capture deck.
 *
 * Follows the tab-piece / rotor layer conventions: unlit print, per-piece
 * kraft fallback tints, a BackSide interior mesh in deep shadow, cut-edge
 * hairlines, DynamicDrawUsage positions rewritten per frame, contact shadows
 * scaled by each tier's own lift.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { kraftTints } from './paper-stock'
import { liveSpreadRole, spreadPageAnglesTilted, type TurnStage, type KnobTowerGeom } from './popup-mechanics'
import { knobTowerThetaMax, knobTowerTierLift, solveKnobTowerPose } from './popup-knobtower'
import { ROTOR_LIFT } from './popup-rotor'
import { shadowLift } from './shadow-light'
import { easeTurnWeighted } from './page-geometry'
import { acquireMaterial, releaseMaterial, useGuardedDispose } from './material-pool'
import { sharedHandleMaterial, sharedKnobTexture, sharedPaperTexture, sharedShadowTexture } from './shared-procedural-textures'
import { type TurnFrame } from './use-turn-driver'
import { useArtTexture } from './use-layer-texture'
import { useStorybookStore } from '../store'
import { beginGrabChannel, endGrabChannel, readUserDrive, writeUserDrive } from '../user-drive'
import { applyHandleGlow, stepHoverGlow, markHandleHovered } from './handle-hover'
import { pointerLocalRay } from './user-drive-pointer'
import { HANDLE_SLOP_FLAT, acceptsHandleHit, handleSlopFactor } from './handle-hit'
import { NUDGE_SPAN_ANGLE, TAP_EPS, nudgeOffset } from './handle-nudge'
import { useHandleTap } from './use-handle-tap'
import { projectHubAngle } from './handle-projection'

const FLAT_EPSILON = 0.02
const SHADOW_Y_LIFT = 0.001
const STRUCT_SHADOW_MAX = 0.28
// E-G5 floor (f): PAINTED shaded faces use this gentle NEUTRAL step. The old
// warm fold seam (#d9cdb4, ~x0.85/0.80/0.71) dimmed + warm-cast painted art
// across half of a folded piece; the warm seam stays reserved for raw kraft
// placeholder stock (per-piece kraftTints), never painted art.
const PAINTED_FOLD_SHADE = '#e4e4e4'
const INTERIOR_SHADOW_TINT = '#5f5138'
const CUT_EDGE_COLOR = '#f6eedb'
/** Deltas from hit points inside this fraction of the disc radius are
 *  discarded — angle is numerically unstable at the hub (law H4). */
const HUB_DEADZONE = 0.25
/** Page-flat handle: the reading camera foreshortens it hard, so it takes
 *  the generous pad (handle-hit.ts). */
const TOUCH_SLOP = HANDLE_SLOP_FLAT
const rad = (d: number): number => (d * Math.PI) / 180
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const wrapDelta = (d: number): number => Math.atan2(Math.sin(d), Math.cos(d))

// Scratch for the H4 angle-about-hub projection (one grab at a time).
const _center = new THREE.Vector3()
const _n = new THREE.Vector3()
const _u = new THREE.Vector3()
const _ez = new THREE.Vector3(0, 0, 1)

/** Dev-only knob-angle override for the D6 capture deck: `?sbknob=<deg>`
 *  freezes the twist at that angle (clamped to [0, THETA_MAX]); absent, the
 *  live scrub channel drives it, resting untwisted (theta 0) with no grab.
 *  Same pattern as ?sbpose; compiled out of production builds. */
function readKnobOverrideDeg(): number | null {
  if (process.env.NODE_ENV === 'production') return null
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('sbknob')
  if (raw === null) return null
  const deg = Number(raw)
  return Number.isFinite(deg) ? deg : null
}

/** The live twist for this frame: the dev override wins, else the scrub
 *  channel (the reader's held twist), else untwisted — always clamped to the
 *  piece's working range. */
function readKnobTheta(layer: SceneLayer & KnobTowerGeom): number {
  const max = knobTowerThetaMax(layer)
  const override = readKnobOverrideDeg()
  if (override !== null) return clamp(rad(override), 0, max)
  const channel = readUserDrive(layer.id)
  const held = channel !== undefined ? clamp(channel, 0, max) : 0
  // Tap answer (BW-18): a press that never turned the dial rocks it a few
  // degrees and lets it settle. Applied HERE, in the one reader every consumer
  // shares, so the disc and everything it drives stay one rigid machine — and
  // only on the channel path, so a frozen ?sbdrive/?sbknob capture pose is
  // never disturbed. Render-time only: the excursion is not written back.
  return clamp(held + nudgeOffset(layer.id, held, 0, max, NUDGE_SPAN_ANGLE), 0, max)
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

function makeEdgeGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(12), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  return geometry
}

function writeQuad(geometry: THREE.BufferGeometry, quad: readonly (readonly [number, number, number])[]): void {
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

function enlargeQuad(
  quad: readonly (readonly [number, number, number])[],
  k: number
): [number, number, number][] {
  const cx = (quad[0][0] + quad[1][0] + quad[2][0] + quad[3][0]) / 4
  const cy = (quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1]) / 4
  const cz = (quad[0][2] + quad[1][2] + quad[2][2] + quad[3][2]) / 4
  return quad.map((p) => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k, cz + (p[2] - cz) * k])
}

/** The turn-clock page angles + live role for this spread, shared by the disc
 *  and every tier so they tick on one driver clock (never a React prop). */
function usePageAngles(
  spreadIndex: number,
  frame: RefObject<TurnFrame | null>,
  committedSpread: RefObject<number>,
  stage?: TurnStage
): () => { role: ReturnType<typeof liveSpreadRole>; thetaL: number; thetaR: number; beta: number } {
  return () => {
    const f = frame.current
    const role = liveSpreadRole(spreadIndex, committedSpread.current, f?.dir ?? null)
    const { thetaL, thetaR } = spreadPageAnglesTilted(
      spreadIndex,
      committedSpread.current,
      f?.dir ?? null,
      f ? easeTurnWeighted(f.t) : 0,
      stage
    )
    return { role, thetaL, thetaR, beta: thetaL - thetaR }
  }
}

/** The coplanar knob disc — a circular die-cut riveted flat into the page,
 *  spun by the reader's twist (law H4). Rides its page coplanar, so it casts
 *  no contact shadow (the rotor rule). It is the ROTATION handle: pointer
 *  handlers accumulate the twist into the scrub channel. */
function KnobDisc({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & KnobTowerGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const slopRef = useRef<THREE.Mesh>(null)
  const art = useArtTexture(`${layer.id}-disc`)
  const tint = useMemo(() => kraftTints(`${layer.id}-disc`), [layer.id])
  const readAngles = usePageAngles(spreadIndex, frame, committedSpread, layer.stage)
  const thetaMax = useMemo(() => knobTowerThetaMax(layer), [layer])

  const geometry = useMemo(() => makeQuadGeometry(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), [])
  const slopGeometry = useMemo(() => makeQuadGeometry(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), [])
  // Shared singleton (every grabbable layer used its own copy of this
  // identical invisible material — E-G4 fix wave).
  const handleMaterial = sharedHandleMaterial()
  // Placeholder is a spoked knob (thumb notch + arrow arc, H4) so the twist
  // reads before real art lands; its transparent corners keep the die-cut
  // circular under the material's alphaTest. Parameter-free canvas, shared.
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

  useGuardedDispose([geometry, slopGeometry, materials.front, materials.back])

  // --- Twist handle (law H4). Accumulate per-frame pointer deltas about the
  // hub; the last stable angle holds through the unstable centre.
  const grabRef = useRef<{ lastAngle: number | null } | null>(null)
  const tap = useHandleTap()

  /** The pointer's angle about the hub in the disc's seat plane, plus whether
   *  the hit fell inside the unstable centre deadzone. */
  const angleAboutHub = (
    e: ThreeEvent<PointerEvent>,
    thetaL: number,
    thetaR: number
  ): { angle: number; stable: boolean } | null => {
    const t = layer.side === 'left' ? thetaL : thetaR
    _u.set(Math.cos(t), Math.sin(t), 0)
    _n.set(layer.side === 'left' ? Math.sin(t) : -Math.sin(t), layer.side === 'left' ? -Math.cos(t) : Math.cos(t), 0)
    // Hub centre P(hubD, ROTOR_LIFT, hubZ) in the page's own frame.
    _center.set(
      layer.hubD * _u.x + ROTOR_LIFT * _n.x,
      layer.hubD * _u.y + ROTOR_LIFT * _n.y,
      layer.hubZ
    )
    const hub = projectHubAngle(
      pointerLocalRay(e),
      [_center.x, _center.y, _center.z],
      [_u.x, _u.y, _u.z],
      [_ez.x, _ez.y, _ez.z],
      [_n.x, _n.y, _n.z]
    )
    if (!hub) return null
    return { angle: hub.angle, stable: hub.r >= HUB_DEADZONE * layer.discR }
  }

  const releaseGrab = (e?: ThreeEvent<PointerEvent> | null): void => {
    if (!grabRef.current) return
    grabRef.current = null
    tap.end(layer.id) // a press that never turned the dial answers with a nudge
    endGrabChannel(layer.id)
    useStorybookStore.getState().endGrab() // theta HELD in the channel (law H4)
    try {
      if (e) (e.target as Element).releasePointerCapture(e.pointerId)
    } catch {
      // capture already gone
    }
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>): void => {
    if (!acceptsHandleHit(e, slopRef.current)) return
    const st = useStorybookStore.getState()
    if (!st.booted || st.turning !== null || st.spread !== spreadIndex) return
    const { thetaL, thetaR } = readAngles()
    const hub = angleAboutHub(e, thetaL, thetaR)
    st.beginGrab(layer.id, 'knob')
    if (useStorybookStore.getState().grab?.id !== layer.id) return
    // Seed the channel with the current held twist so accumulation is relative.
    const seeded = clamp(readUserDrive(layer.id) ?? 0, 0, thetaMax)
    writeUserDrive(layer.id, seeded, [0, thetaMax])
    tap.begin(seeded)
    grabRef.current = { lastAngle: hub && hub.stable ? hub.angle : null }
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
    const hub = angleAboutHub(e, thetaL, thetaR)
    if (!hub || !hub.stable) return // discard deltas from the unstable centre — hold last
    if (grab.lastAngle !== null) {
      const cur = clamp(readUserDrive(layer.id) ?? 0, 0, thetaMax)
      const next = clamp(cur + wrapDelta(hub.angle - grab.lastAngle), 0, thetaMax)
      writeUserDrive(layer.id, next, [0, thetaMax])
      tap.track(next, TAP_EPS)
    }
    grab.lastAngle = hub.angle
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
    const visible = role !== 'hidden' && beta > FLAT_EPSILON
    group.visible = visible
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
      for (const m of [materials.front, materials.back]) applyHandleGlow(m, w)
    }
    const patches = solveKnobTowerPose(layer, readKnobTheta(layer), thetaL, thetaR)
    const disc = patches[0].quad // 'disc' is always the first patch
    writeQuad(geometry, disc)
    writeQuad(slopGeometry, enlargeQuad(disc, handleSlopFactor(disc, TOUCH_SLOP)))
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
      {/* Coarse-pointer slop (law H6): 1.5x the disc, touch only. */}
      <mesh ref={slopRef} geometry={slopGeometry} material={handleMaterial} renderOrder={2} />
    </group>
  )
}

/** One knee tier — a mound of two slope panels over a ridge band, standing IN
 *  the page. Owns its own art texture (`<id>-tier<k>`) and a contact shadow
 *  scaled by its own current lift. Reads the live twist each frame. */
function KnobTier({
  layer,
  k,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & KnobTowerGeom
  k: number
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const shadowGroupRef = useRef<THREE.Group>(null)
  const faceArt = useArtTexture(`${layer.id}-tier${k}`)
  const tint = useMemo(() => kraftTints(`${layer.id}-tier${k}`), [layer.id, k])
  const readAngles = usePageAngles(spreadIndex, frame, committedSpread, layer.stage)
  const tier = layer.tiers[k]
  const inFace = `tier${k}In`
  const outFace = `tier${k}Out`

  // Unfolded-die-cut v bands: slopeIn [0, 0.5], slopeOut [0.5, 1] (arc length
  // from the inner hinge over the flat span), u across the spine.
  const geometries = useMemo(
    () => ({
      in: makeQuadGeometry(new Float32Array([0, 0, 1, 0, 1, 0.5, 0, 0.5])),
      out: makeQuadGeometry(new Float32Array([0, 0.5, 1, 0.5, 1, 1, 0, 1])),
    }),
    []
  )
  const edgeGeometries = useMemo(() => ({ in: makeEdgeGeometry(), out: makeEdgeGeometry() }), [])
  const edgeMaterials = useMemo(
    () => ({
      in: new THREE.LineBasicMaterial({ color: CUT_EDGE_COLOR, transparent: true, opacity: 0.8 }),
      out: new THREE.LineBasicMaterial({ color: CUT_EDGE_COLOR, transparent: true, opacity: 0.8 }),
    }),
    []
  )

  const paperTexture = sharedPaperTexture()
  const materials = useMemo(
    () => ({
      in: new THREE.MeshBasicMaterial({ side: THREE.FrontSide, color: '#ffffff' }),
      out: new THREE.MeshBasicMaterial({ side: THREE.FrontSide, color: PAINTED_FOLD_SHADE }),
    }),
    []
  )
  // Every knob-tier's underside is the same raw-paper-stock BackSide wall,
  // pooled (E-G4 fix wave) — shared with box/platform/tabpiece's interior.
  const interiorMaterial = useMemo(
    () => acquireMaterial({ side: THREE.BackSide, map: paperTexture, color: INTERIOR_SHADOW_TINT }),
    [paperTexture]
  )
  useEffect(() => () => releaseMaterial(interiorMaterial), [interiorMaterial])

  useEffect(() => {
    // slopeOut is the darker sibling (turned away from the fore-edge light).
    const set = (mat: THREE.MeshBasicMaterial, edge: THREE.LineBasicMaterial, shaded: boolean) => {
      mat.map = faceArt ?? paperTexture
      if (faceArt) {
        faceArt.wrapS = THREE.ClampToEdgeWrapping
        faceArt.wrapT = THREE.ClampToEdgeWrapping
        mat.color.set(shaded ? PAINTED_FOLD_SHADE : '#ffffff')
      } else {
        mat.color.set(shaded ? tint.shade : tint.lit)
      }
      mat.needsUpdate = true
      edge.color.set(faceArt ? CUT_EDGE_COLOR : tint.edge)
    }
    set(materials.in, edgeMaterials.in, false)
    set(materials.out, edgeMaterials.out, true)
  }, [faceArt, paperTexture, materials, edgeMaterials, tint])

  const shadowTexture = sharedShadowTexture()
  const shadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 }),
    [shadowTexture]
  )
  // Key-light placement (shadow-light.ts): sized for the FULL-ERECT tier so the
  // pool is right when twisted; per-frame opacity scales with the tier's actual
  // lift (0 when untwisted or book-closed).
  const shadowSpec = useMemo(() => {
    const sign = layer.side === 'left' ? -1 : 1
    const peak = tier.w * Math.sin(rad(tier.aRestDeg))
    const lift = shadowLift(peak)
    const centerD = layer.foreHingeD - tier.w // mound centre along the run
    return {
      position: [sign * centerD + lift.dx, SHADOW_Y_LIFT, tier.zc + lift.dz] as [number, number, number],
      size: [tier.w * 2 * 0.95 * lift.spread, tier.ridgeLen * 1.05 * lift.spread] as [number, number],
      maxOpacity: STRUCT_SHADOW_MAX * lift.depth,
      aRest: rad(tier.aRestDeg),
    }
  }, [layer, tier])

  useGuardedDispose([geometries.in, geometries.out, edgeGeometries.in, edgeGeometries.out, edgeMaterials.in, edgeMaterials.out, materials.in, materials.out, shadowMaterial])

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const { role, thetaL, thetaR, beta } = readAngles()
    const visible = role !== 'hidden' && beta > FLAT_EPSILON
    group.visible = visible
    if (shadowGroupRef.current) shadowGroupRef.current.visible = visible
    if (!visible) return

    const knobTheta = readKnobTheta(layer)
    const patches = solveKnobTowerPose(layer, knobTheta, thetaL, thetaR)
    const inPatch = patches.find((p) => p.face === inFace)
    const outPatch = patches.find((p) => p.face === outFace)
    if (!inPatch || !outPatch) return
    writeQuad(geometries.in, inPatch.quad)
    writeQuad(edgeGeometries.in, inPatch.quad)
    writeQuad(geometries.out, outPatch.quad)
    writeQuad(edgeGeometries.out, outPatch.quad)

    const a = knobTowerTierLift(layer, k, knobTheta, beta)
    shadowMaterial.opacity = shadowSpec.maxOpacity * (Math.sin(a) / Math.sin(shadowSpec.aRest))
  })

  return (
    <>
      <group ref={groupRef} visible={false}>
        <mesh geometry={geometries.in} material={materials.in} renderOrder={0} />
        <mesh geometry={geometries.in} material={interiorMaterial} renderOrder={0} />
        <lineLoop geometry={edgeGeometries.in} material={edgeMaterials.in} renderOrder={1} />
        <mesh geometry={geometries.out} material={materials.out} renderOrder={0} />
        <mesh geometry={geometries.out} material={interiorMaterial} renderOrder={0} />
        <lineLoop geometry={edgeGeometries.out} material={edgeMaterials.out} renderOrder={1} />
      </group>
      <group ref={shadowGroupRef} visible={false}>
        {/* renderOrder=-1: ground shading joins the gutter crease's early
            transparent tier (D-G3 audit) so no shadow can draw over paper. */}
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

export function KnobTowerPopupLayer({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & KnobTowerGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  return (
    <group name={`knobtower-${layer.id}`}>
      <KnobDisc layer={layer} spreadIndex={spreadIndex} frame={frame} committedSpread={committedSpread} />
      {layer.tiers.map((_, k) => (
        <KnobTier
          key={k}
          layer={layer}
          k={k}
          spreadIndex={spreadIndex}
          frame={frame}
          committedSpread={committedSpread}
        />
      ))}
    </group>
  )
}
