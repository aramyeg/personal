'use client'

/**
 * Renders the TOWER-HOIST WINCH (popup-keepwinch.ts, the E-G6 composed machine):
 * a die-cut knob disc riveted into the left page that the reader TWISTS (H4)
 * plus three staggered output bodies the crank drives — the semaphore arm, the
 * shutter-ring iris (6 blades), and the counterweight. The disc is the sole
 * grab handle; release HOLDS theta — the disc remembers the twist. Outputs
 * ride the keep's bisector frame; the disc rides the page frame.
 *
 * THE CRANK IS NO LONGER THE KNOB-TOWER'S WRAPPED-DELTA (E3 systems patch). The
 * disc used to accumulate the raw atan2 sweep about its hub, which is what the
 * s4 blind re-reviewer was fighting when they reported that slow turning is
 * ignored, that one flick eats all 302 degrees, that the stop cannot be felt and
 * that reverse is unreachable. It now reads the hand's TANGENTIAL DRAG
 * (crankTangentialDelta), geared down and stiffened into its stop
 * (keepWinchCrankStep) — see those two functions for the measurement and the
 * argument. The knob tower and the volvelle still carry the old mapping; the
 * change is opt-in per family on purpose.
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
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { useGuardedDispose } from './material-pool'
import type { PanelQuad } from './popup-mechanics'
import { liveSpreadRole, spreadPageAnglesTilted, type TurnStage } from './popup-mechanics'
import {
  KEEP_WINCH_IRIS_SHUTTERS,
  keepWinchAtPawl,
  keepWinchCrankStep,
  keepWinchCounterweightDeck,
  keepWinchDiscQuad,
  keepWinchIrisQuads,
  keepWinchMastQuad,
  keepWinchSemaphoreQuad,
  keepWinchThetaMax,
  type KeepWinchGeom,
} from './popup-keepwinch'
import { ROTOR_LIFT } from './popup-rotor'
import { kraftTints } from './paper-stock'
import { easeTurnWeighted } from './page-geometry'
import { sharedHandleMaterial, sharedKnobTexture, sharedPaperTexture } from './shared-procedural-textures'
import { sbSound } from '../sound'
import { turnCullOpacity } from './turn-cull'
import type { TurnFrame } from './use-turn-driver'
import { useArtSprite } from './use-layer-texture'
import { applyUvRect } from '../art-atlas'
import { useStorybookStore } from '../store'
import { beginGrabChannel, endGrabChannel, readDriveOverride, readUserDrive, writeUserDrive } from '../user-drive'
import { applyHandleGlow, stepHoverGlow, markHandleHovered } from './handle-hover'
import { pointerLocalRay } from './user-drive-pointer'
import { HANDLE_SLOP_FLAT, acceptsHandleHit, handleSlopFactor } from './handle-hit'
import { NUDGE_SPAN_ANGLE, TAP_EPS, nudgeOffset } from './handle-nudge'
import { useHandleTap } from './use-handle-tap'
import { crankTangentialDelta, projectHubAngle, type HubHit } from './handle-projection'

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
/** Page-flat handle: the reading camera foreshortens it hard, so it takes
 *  the generous pad (handle-hit.ts). */
const TOUCH_SLOP = HANDLE_SLOP_FLAT
const rad = (d: number): number => (d * Math.PI) / 180
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

const _center = new THREE.Vector3()
const _n = new THREE.Vector3()
const _u = new THREE.Vector3()
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
  committedSpread: RefObject<number>,
  stage?: TurnStage
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
      f ? easeTurnWeighted(turnT) : 0,
      stage
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
  const { texture: art, rect } = useArtSprite(`${layer.id}-disc`)
  const tint = useMemo(() => kraftTints(`${layer.id}-disc`), [layer.id])
  const readAngles = usePageAngles(spreadIndex, frame, committedSpread, layer.stage)
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

  useGuardedDispose([geometry, slopGeometry, materials.front, materials.back])

  // The previous hub HIT, not just its angle: the crank now reads the hand's
  // tangential drag (crankTangentialDelta), which needs the radius the hand had
  // as well as the direction it was in. `seated` remembers whether the wind has
  // already run into the pawl, so the seat thumps once per arrival rather than
  // once per frame.
  const grabRef = useRef<{ last: HubHit | null; seated: boolean } | null>(null)
  const tap = useHandleTap()

  const angleAboutHub = (
    e: ThreeEvent<PointerEvent>,
    thetaL: number,
    thetaR: number
  ): HubHit | null => {
    const t = layer.side === 'left' ? thetaL : thetaR
    _u.set(Math.cos(t), Math.sin(t), 0)
    _n.set(layer.side === 'left' ? Math.sin(t) : -Math.sin(t), layer.side === 'left' ? -Math.cos(t) : Math.cos(t), 0)
    _center.set(layer.hubD * _u.x + ROTOR_LIFT * _n.x, layer.hubD * _u.y + ROTOR_LIFT * _n.y, layer.hubZ)
    const hub = projectHubAngle(
      pointerLocalRay(e),
      [_center.x, _center.y, _center.z],
      [_u.x, _u.y, _u.z],
      [_ez.x, _ez.y, _ez.z],
      [_n.x, _n.y, _n.z]
    )
    return hub
  }

  const releaseGrab = (e?: ThreeEvent<PointerEvent> | null): void => {
    if (!grabRef.current) return
    grabRef.current = null
    tap.end(layer.id) // a press that never turned the dial answers with a nudge
    endGrabChannel(layer.id)
    useStorybookStore.getState().endGrab()
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
    const seeded = clamp(readUserDrive(layer.id) ?? 0, 0, thetaMax)
    writeUserDrive(layer.id, seeded, [0, thetaMax])
    tap.begin(seeded)
    grabRef.current = { last: hub, seated: keepWinchAtPawl(layer, seeded) }
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
    if (!hub) return
    if (grab.last !== null) {
      const cur = clamp(readUserDrive(layer.id) ?? 0, 0, thetaMax)
      // THE HAND'S OWN CRANK, geared and stiffened into the stop. Read the two
      // long comments this pair of calls stands on — crankTangentialDelta in
      // handle-projection.ts for why the raw atan2 sweep had to go, and
      // keepWinchCrankStep for what a turn of the hoist is now worth.
      const next = keepWinchCrankStep(
        layer,
        cur,
        crankTangentialDelta(grab.last, hub, layer.discR)
      )
      writeUserDrive(layer.id, next, [0, thetaMax])
      tap.track(next, TAP_EPS)
      // THE PAWL SEATS, ONCE. The wheel's own stiffening (keepWinchShownTheta)
      // is silent and the reviewer never felt the stop; a single dull thud at
      // the moment the wind runs into the pawl is the sound a real ratchet makes
      // when it drops into its last tooth. Re-armable: back off out of the band
      // and the next arrival seats again.
      const inPawl = keepWinchAtPawl(layer, next)
      if (inPawl && !grab.seated) sbSound.thump()
      grab.seated = inPawl
    }
    grab.last = hub
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
    const { role, thetaL, thetaR, beta, turnT } = readAngles()
    // TURN-CULL (C-3): the winch is the reader's machine. Mid-turn nobody is
    // cranking it, so the disc stops drawing (see ./turn-cull.ts). The KEEP it
    // drives is structure and is never culled.
    const cull = turnCullOpacity(turnT)
    const visible = role !== 'hidden' && beta > FLAT_EPSILON && cull > 0
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
    materials.front.opacity = cull
    materials.back.opacity = cull
    const disc = keepWinchDiscQuad(layer, readWinchTheta(layer), thetaL, thetaR)
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
  const readAngles = usePageAngles(spreadIndex, frame, committedSpread, layer.stage)
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

  useGuardedDispose([...geometries, material])

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
      {/* The STATIC signal mast the paddle pivots on (S4-4) — drawn before the
          arm so the arm's pivot sits over the mast head. */}
      <WinchOutput
        layer={layer}
        artId={`${layer.id}-mast`}
        count={1}
        solve={(_theta, _beta, tL, tR) => [keepWinchMastQuad(layer, tL, tR)]}
        spreadIndex={spreadIndex}
        frame={frame}
        committedSpread={committedSpread}
      />
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
