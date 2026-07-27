'use client'

/**
 * Renders one VOLVELLE layer (popup-volvelle.ts, E2.2 Batch B): a reader-spun
 * DISPATCH DIAL beneath a static WINDOW CARD, both hub-riveted coplanar INTO the
 * page. PAGE-ROOTED like the knob tower — one page carries the whole assembly;
 * it mirrors the s4 winch (winch crank left, dispatch dial right).
 *
 * The dial is the sole grab handle; its machinery reuses the knob-tower / winch
 * disc pattern verbatim — pointer angle about the hub in the page plane,
 * wrapped-delta accumulation into the module scrub channel, release HOLDS theta
 * (the disc remembers the twist through page turns and book close). On release
 * the held twist eases to the nearest detent (the sectors click into their
 * windows — volvelleSnap). A coplanar disc lies flat at any rotation, so it
 * needs no fold-flat envelope: it rides the folding page and casts no
 * page-contact shadow (the rotor rule).
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { useGuardedDispose } from './material-pool'
import type { PanelQuad } from './popup-mechanics'
import { liveSpreadRole, spreadPageAnglesTilted, type VolvelleGeom } from './popup-mechanics'
import {
  solveVolvellePose,
  volvelleCrankStep,
  volvelleDetentCell,
  volvelleHubFrame,
  volvelleSnap,
  volvelleThetaMax,
  VOLVELLE_LIFT,
} from './popup-volvelle'
import { sbSound } from '../sound'
import { kraftTints } from './paper-stock'
import { easeTurnWeighted } from './page-geometry'
import { sharedHandleMaterial, sharedKnobTexture, sharedPaperTexture } from './shared-procedural-textures'
import { turnCullOpacity } from './turn-cull'
import type { TurnFrame } from './use-turn-driver'
import { useArtTexture } from './use-layer-texture'
import { useStorybookStore } from '../store'
import { beginGrabChannel, endGrabChannel, readDriveOverride, readUserDrive, writeUserDrive } from '../user-drive'
import { applyHandleGlow, stepHoverGlow, markHandleHovered } from './handle-hover'
import { pointerLocalRay } from './user-drive-pointer'
import { HANDLE_INERT, HANDLE_SLOP_FLAT, acceptsHandleHit, handleSlopFactor } from './handle-hit'
import { NUDGE_SPAN_ANGLE, TAP_EPS, nudgeOffset } from './handle-nudge'
import { useHandleTap } from './use-handle-tap'
import { crankTangentialDelta, projectHubAngle, type HubHit } from './handle-projection'

const FLAT_EPSILON = 0.02
const HUB_DEADZONE = 0.25
/** Page-flat handle: the reading camera foreshortens it hard, so it takes
 *  the generous pad (handle-hit.ts). */
const TOUCH_SLOP = HANDLE_SLOP_FLAT
/** Detent-snap ease rate per frame while the dial is released and off a detent.
 *  A soft exponential so the sectors "click" into their windows (bench-proven
 *  snap target volvelleSnap); it stops once within SNAP_EPS. */
const SNAP_EASE = 0.28
const SNAP_EPS = 1e-4
/**
 * The disc quad's uvs, oriented so the die-cut art reads UPRIGHT at the pinned
 * reading camera. The disc spins on the page frame (e1 = page-fore, e2 = the
 * spine axis +z); at the camera +z projects to screen-DOWN, so with three's
 * default flipY the image lands upside-down under identity uvs — a V-FLIP fixes
 * it. e1 is page-side dependent (right page +x -> screen-right; left page -x ->
 * screen-left), so the LEFT page also needs a U-FLIP. The dial and card share
 * these uvs, so their window/sector registration is preserved (both transform
 * together — the reveal is unchanged). Robust for either page-side.
 */
function discUvs(side: 'left' | 'right'): Float32Array {
  // corners [bl, br, tr, tl]; right = v-flip, left = u+v-flip (180deg).
  return side === 'left'
    ? new Float32Array([1, 1, 0, 1, 0, 0, 1, 0])
    : new Float32Array([0, 1, 1, 1, 1, 0, 0, 0])
}
const rad = (d: number): number => (d * Math.PI) / 180
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const wrapDelta = (d: number): number => Math.atan2(Math.sin(d), Math.cos(d))


function readKnobOverrideDeg(): number | null {
  if (process.env.NODE_ENV === 'production') return null
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('sbknob')
  if (raw === null) return null
  const deg = Number(raw)
  return Number.isFinite(deg) ? deg : null
}

/** The live twist for this frame: the dev overrides win (?sbknob=<deg> shared
 *  with the other dials, or the golden harness's ?sbdrive=<id>:<deg>), else the
 *  reader's held twist from the scrub channel, else untwisted — clamped to the
 *  dial's working range. */
function readVolvelleTheta(layer: SceneLayer & VolvelleGeom): number {
  const max = volvelleThetaMax()
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
/** True when a dev override is pinning the twist — the release ease must not
 *  fight a frozen capture pose. */
function overrideActive(layer: SceneLayer & VolvelleGeom): boolean {
  return readKnobOverrideDeg() !== null || readDriveOverride(layer.id) !== null
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
    // turnT is the driver's RAW published progress (0 at rest, no frame at all);
    // the cull window is specified against it, not against the eased angle.
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

/** One coplanar disc (dial or card) — the FrontSide print over a kraft BackSide
 *  underside; positions rewritten per frame. */
function useDiscMaterials(fallbackTexture: THREE.Texture, artId: string) {
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
  useGuardedDispose([materials.front, materials.back])
  return materials
}

export function VolvellePopupLayer({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & VolvelleGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const slopRef = useRef<THREE.Mesh>(null)
  const readAngles = usePageAngles(spreadIndex, frame, committedSpread)
  const thetaMax = volvelleThetaMax()

  const dialGeometry = useMemo(() => makeQuadGeometry(discUvs(layer.side)), [layer.side])
  const cardGeometry = useMemo(() => makeQuadGeometry(discUvs(layer.side)), [layer.side])
  const slopGeometry = useMemo(() => makeQuadGeometry(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), [])

  const handleMaterial = sharedHandleMaterial()
  const knobTexture = sharedKnobTexture()
  const paperTexture = sharedPaperTexture()
  const dialMaterials = useDiscMaterials(knobTexture, `${layer.id}-dial`)
  const cardMaterials = useDiscMaterials(paperTexture, `${layer.id}-card`)

  useGuardedDispose([dialGeometry, cardGeometry, slopGeometry])

  // --- Twist handle (law H4). Accumulate per-frame pointer deltas about the hub
  // measured on the page's own e1/e2 axes (the knob-tower/winch disc idiom).
  //
  // TWO READS LIVE HERE (S7R2-1a + the s4 route plate, same round). `crank:
  // 'tangential'` takes the hand's own tangential drag through volvelleCrankStep
  // — geared, notched, stopped; the honest quantity is how far the hand dragged
  // the PAPER round at a fixed reference radius, so the wheel cannot be spun by
  // poking its middle. Every dial that has not opted in keeps the raw atan2
  // accumulation it shipped with, unchanged to the last bit. `cell` remembers
  // which detent the wheel was sitting in so the click sounds once per room,
  // and re-arms.
  const grabRef = useRef<{ lastAngle: number | null; last: HubHit | null; cell: number } | null>(null)
  const tap = useHandleTap()
  const tangential = layer.crank === 'tangential'

  const hubHit = (
    e: ThreeEvent<PointerEvent>,
    thetaL: number,
    thetaR: number
  ): { hit: HubHit; stable: boolean } | null => {
    const { center, e1, e2, n } = volvelleHubFrame(layer, thetaL, thetaR, VOLVELLE_LIFT)
    const hub = projectHubAngle(pointerLocalRay(e), center, e1, e2, n)
    if (!hub) return null
    // The deadzone exists to hide the atan2 read's centre singularity. The
    // tangential crank has none — a stroke through the hub simply turns nothing,
    // which is what pushing a real wheel across its face does — so opting in
    // also retires the gate that used to swallow those moves.
    return { hit: hub, stable: tangential || hub.r >= HUB_DEADZONE * layer.radius }
  }

  /** How much twist the step from `prev` to `next` is worth, in radians. */
  const twistDelta = (prev: HubHit, next: HubHit): number =>
    tangential
      ? crankTangentialDelta(prev, next, layer.radius)
      : wrapDelta(next.angle - prev.angle)

  const releaseGrab = (e?: ThreeEvent<PointerEvent> | null): void => {
    if (!grabRef.current) return
    grabRef.current = null
    tap.end(layer.id) // a press that never turned the dial answers with a nudge
    endGrabChannel(layer.id)
    useStorybookStore.getState().endGrab() // theta HELD; the frame loop eases it to a detent
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
    const hub = hubHit(e, thetaL, thetaR)
    st.beginGrab(layer.id, 'knob')
    if (useStorybookStore.getState().grab?.id !== layer.id) return
    const seeded = clamp(readUserDrive(layer.id) ?? 0, 0, thetaMax)
    writeUserDrive(layer.id, seeded, [0, thetaMax])
    tap.begin(seeded)
<<<<<<< HEAD
    grabRef.current = { last: hub && hub.stable ? hub.hit : null }
=======
    grabRef.current = {
      lastAngle: hub && hub.stable ? hub.hit.angle : null,
      last: hub && hub.stable ? hub.hit : null,
      cell: volvelleDetentCell(layer, seeded),
    }
>>>>>>> e3/s7r2
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
    const hub = hubHit(e, thetaL, thetaR)
    if (!hub || !hub.stable) return // discard deltas from the unstable centre — hold last
<<<<<<< HEAD
    if (grab.last !== null) {
      const cur = clamp(readUserDrive(layer.id) ?? 0, 0, thetaMax)
      const next = clamp(cur + twistDelta(grab.last, hub.hit), 0, thetaMax)
=======
    if (grab.lastAngle !== null && grab.last !== null) {
      const cur = clamp(readUserDrive(layer.id) ?? 0, 0, thetaMax)
      const next = tangential
        ? volvelleCrankStep(layer, cur, crankTangentialDelta(grab.last, hub.hit, layer.radius))
        : clamp(cur + wrapDelta(hub.hit.angle - grab.lastAngle), 0, thetaMax)
>>>>>>> e3/s7r2
      writeUserDrive(layer.id, next, [0, thetaMax])
      tap.track(next, TAP_EPS)
      // THE BALL DROPS INTO THE NEXT NOTCH. One dull click the moment the wheel
      // crosses into a new detent cell — the sound a riveted volvelle makes, and
      // the confirmation the blind reader never got that a room had changed.
      if (tangential) {
        const cell = volvelleDetentCell(layer, next)
        if (cell !== grab.cell) sbSound.thump()
        grab.cell = cell
      }
    }
<<<<<<< HEAD
=======
    grab.lastAngle = hub.hit.angle
>>>>>>> e3/s7r2
    grab.last = hub.hit
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
    // TURN-CULL (C-3): the dial is a reader's instrument, not structure — it
    // stops drawing for the body of a page turn and ramps back across the
    // landing settle. Pose maths below are untouched (it still solves; it just
    // isn't submitted), so no fold-flat proof is affected.
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
      for (const m of [dialMaterials.front, dialMaterials.back]) applyHandleGlow(m, w)
    }
    for (const m of [dialMaterials.front, dialMaterials.back, cardMaterials.front, cardMaterials.back]) {
      m.opacity = cull
    }

    // Detent snap-on-release: while not grabbed (and no dev override), ease the
    // held twist to the nearest detent so the sectors click into their windows.
    if (!grabRef.current && !overrideActive(layer)) {
      const held = readUserDrive(layer.id)
      if (held !== undefined) {
        const target = volvelleSnap(layer, held)
        const delta = target - held
        if (Math.abs(delta) > SNAP_EPS) {
          writeUserDrive(layer.id, held + delta * SNAP_EASE, [0, thetaMax])
        } else if (held !== target) {
          writeUserDrive(layer.id, target, [0, thetaMax])
        }
      }
    }

    const pose = solveVolvellePose(layer, thetaL, thetaR, readVolvelleTheta(layer))
    writeQuad(dialGeometry, pose.dial)
    writeQuad(cardGeometry, pose.card)
    writeQuad(slopGeometry, enlargeQuad(pose.dial, handleSlopFactor(pose.dial, TOUCH_SLOP)))
  })

  return (
    <group
      ref={groupRef}
      name={`volvelle-${layer.id}`}
      visible={false}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={releaseGrab}
      onPointerCancel={releaseGrab}
      onLostPointerCapture={releaseGrab}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {/* Dial (spun) beneath, then the static window card above it — the card's
          die-cut windows reveal the dial's sectors. renderOrder keeps the card
          drawing after the dial so its alpha windows composite over it. */}
      <mesh geometry={dialGeometry} material={dialMaterials.front} renderOrder={0} />
      <mesh geometry={dialGeometry} material={dialMaterials.back} renderOrder={0} />
      {/* The faceplate is static — it takes no twist, so the dial's slop pad
          must not defer to it (HANDLE_INERT, handle-hit.ts). */}
      <mesh geometry={cardGeometry} material={cardMaterials.front} renderOrder={1} userData={HANDLE_INERT} />
      <mesh geometry={cardGeometry} material={cardMaterials.back} renderOrder={1} userData={HANDLE_INERT} />
      {/* Coarse-pointer slop (law H6): 1.5x the dial, touch only. */}
      <mesh ref={slopRef} geometry={slopGeometry} material={handleMaterial} renderOrder={2} />
    </group>
  )
}
