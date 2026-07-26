'use client'

/**
 * Renders one PULL-TAB DISSOLVE layer (popup-dissolve.ts, E2.2 Batch B): a
 * page-flat rack of N venetian SLATS the reader flips with a fore-edge tab to
 * transmute one picture into another (s5 dunes -> the dragon's gold hoard).
 * PAGE-ROOTED like the volvelle / tab piece — one page carries the whole rack.
 *
 * The tab is the grab handle. The drive is the LINEAR tab-piece idiom (law H3):
 * the pointer's projection onto the page's fore axis reads the strip draw
 * delta, mapped to the shared flip angle tau in [0,PI] (tab-piece pointer
 * projection). The HOLD + SNAP is the VOLVELLE idiom: release HOLDS tau in the
 * module scrub channel (the book remembers dunes-or-gold through page turns and
 * book close), then eases it to the nearest pure end {0,PI} — a 2-detent dial.
 * Both end states are coplanar, so — like the volvelle — the rack needs NO
 * fold-flat envelope: it rides the folding page. The high-frequency drive value
 * lives in the module scrub channel, never React state; zustand holds only the
 * grab identity.
 *
 * Art: TWO paintings per piece — `<id>-dunes` (up-face at tau=0) and
 * `<id>-gold` (under-face, revealed at tau=PI) — each sliced into N vertical
 * strips by the slats. Slat k shows strip k of each, mapped in SCREEN space
 * (image-x = the page-fore axis d, image-y = the spine axis z; the liftflap
 * screen-space law, side-aware). Dunes prints FrontSide, gold BackSide of the
 * same rigid ribbon. Under them an opaque sand BASE reads as the desert floor
 * the gaps between tilted slats reveal — the picture breaks into sand and
 * reforms as gold.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import type { DissolveGeom, PanelQuad, Vec3 } from './popup-mechanics'
import { liveSpreadRole, spreadPageAnglesTilted } from './popup-mechanics'
import {
  DISSOLVE_TAB_LIP,
  dissolveSnap,
  dissolveStroke,
  dissolveTabOut,
  dissolveTauFromDraw,
  solveDissolvePose,
  dissolveSlit,
} from './popup-dissolve'
import { kraftTints } from './paper-stock'
import { easeTurnWeighted } from './page-geometry'
import { turnCullOpacity } from './turn-cull'
import { sharedHandleMaterial, sharedPaperTexture, sharedShadowTexture, sharedTabGripTexture } from './shared-procedural-textures'
import { peakHeight, shadowLift } from './shadow-light'
import type { TurnFrame } from './use-turn-driver'
import { useArtTexture } from './use-layer-texture'
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
import { acceptsHandleHit, HANDLE_SLOP_FLAT } from './handle-hit'
import { NUDGE_SPAN_ANGLE, TAP_EPS, nudgeOffset } from './handle-nudge'
import { useHandleTap } from './use-handle-tap'
import { projectPageD } from './handle-projection'

const FLAT_EPSILON = 0.02
const SHADOW_Y_LIFT = 0.001
const STRUCT_SHADOW_MAX = 0.2
/** Page-flat handle: the reading camera foreshortens it hard, so it takes
 *  the generous pad (handle-hit.ts). */
const TOUCH_SLOP = HANDLE_SLOP_FLAT
/** Snap-to-end ease per frame while released and off a pure end (the volvelle
 *  detent ease). A soft exponential so the picture "clicks" to dunes or gold. */
const SNAP_EASE = 0.3
const SNAP_EPS = 1e-4
/** Desert-floor sand under the slats — VAULT_NIGHT register (E3 s5): violet
 *  dune shadow, so the one-pitch band the flipped rack vacates reads as the
 *  night floor and the gaps between tilted slats mid-flip read as dark sand. */
const SAND_COLOR = '#5c4160'
const SAND_SHADE = '#38294a'

const rad = (d: number): number => (d * Math.PI) / 180
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

// Scratch for the H3 pointer projection (one grab at a time).

/**
 * Screen-space band uvs for slat k of N (the liftflap flatUvs law, banded).
 * Corner order [bl, br, tr, tl] = [hinge@za, hinge@zb, far@zb, far@za]; image-x
 * runs along d (hinge -> far), image-y along z. The right page maps hinge->u=k/N,
 * far->u=(k+1)/N; the LEFT page's d projects screen-LEFT, so it mirrors u
 * (hinge->1-k/N, far->1-(k+1)/N) — exactly the liftflap side-aware flip, banded.
 */
function slatUvs(side: 'left' | 'right', k: number, n: number): Float32Array {
  const a = k / n
  const b = (k + 1) / n
  return side === 'left'
    ? new Float32Array([1 - a, 1, 1 - a, 0, 1 - b, 0, 1 - b, 1])
    : new Float32Array([a, 1, a, 0, b, 0, b, 1])
}
/** The full-placard uvs for the sand base (image spans the whole band). */
function baseUvs(side: 'left' | 'right'): Float32Array {
  return side === 'left'
    ? new Float32Array([1, 1, 1, 0, 0, 0, 0, 1])
    : new Float32Array([0, 1, 0, 0, 1, 0, 1, 1])
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
function makeSlitGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(6), 3)
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
function enlargeQuad(quad: PanelQuad, kf: number): PanelQuad {
  const cx = (quad[0][0] + quad[1][0] + quad[2][0] + quad[3][0]) / 4
  const cy = (quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1]) / 4
  const cz = (quad[0][2] + quad[1][2] + quad[2][2] + quad[3][2]) / 4
  return quad.map((p) => [cx + (p[0] - cx) * kf, cy + (p[1] - cy) * kf, cz + (p[2] - cz) * kf]) as unknown as PanelQuad
}

/** The live flip for this frame: dev override wins (?sbdrive=<id>:<deg>, tau in
 *  degrees), else the reader's held flip from the scrub channel, else dunes. */
function readDissolveTau(layer: SceneLayer & DissolveGeom): number {
  const drive = readDriveOverride(layer.id)
  if (drive !== null) return clamp(rad(drive), 0, Math.PI)
  const channel = readUserDrive(layer.id)
  return channel !== undefined ? clamp(channel, 0, Math.PI) : 0
}
function overrideActive(layer: SceneLayer & DissolveGeom): boolean {
  return readDriveOverride(layer.id) !== null
}

export function DissolvePopupLayer({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & DissolveGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const shadowGroupRef = useRef<THREE.Group>(null)
  const handleRef = useRef<THREE.Mesh>(null)
  const slopRef = useRef<THREE.Mesh>(null)
  const gl = useThree((s) => s.gl)
  const n = layer.slats

  const dunesArt = useArtTexture(`${layer.id}-dunes`)
  const goldArt = useArtTexture(`${layer.id}-gold`)
  // The celebrated affordance (T-AFFORDANCE): the tab wears its own engraved
  // brass-plate art when painted, falling back to the shared kraft grip.
  const tabArt = useArtTexture(`${layer.id}-tab`)
  const tint = useMemo(() => kraftTints(layer.id), [layer.id])
  const paperTexture = sharedPaperTexture()
  const tabGripTexture = sharedTabGripTexture()

  // One geometry pair per slat (dunes FrontSide uvs, gold BackSide uvs); both
  // share the per-frame slat quad. Plus the sand base and the tab.
  const dunesGeoms = useMemo(() => Array.from({ length: n }, (_, k) => makeQuadGeometry(slatUvs(layer.side, k, n))), [layer.side, n])
  const goldGeoms = useMemo(() => Array.from({ length: n }, (_, k) => makeQuadGeometry(slatUvs(layer.side, k, n))), [layer.side, n])
  const baseGeom = useMemo(() => makeQuadGeometry(baseUvs(layer.side)), [layer.side])
  const tabGeom = useMemo(() => makeQuadGeometry(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), [])
  const handleGeom = useMemo(() => makeQuadGeometry(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), [])
  const slopGeom = useMemo(() => makeQuadGeometry(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), [])
  const slitGeom = useMemo(() => makeSlitGeometry(), [])
  const handleMaterial = sharedHandleMaterial()

  // Transparent so the turn-cull ramp (C-3) can fade the rack out/in; at
  // opacity 1 (any rest frame) the prints render exactly as before.
  const dunesMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ side: THREE.FrontSide, color: '#ffffff', transparent: true }),
    []
  )
  const goldMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: '#ffffff', transparent: true }),
    []
  )
  const baseMaterial = useMemo(() => new THREE.MeshBasicMaterial({ side: THREE.FrontSide, color: SAND_COLOR, transparent: true }), [])
  const baseBackMaterial = useMemo(() => new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: SAND_SHADE, transparent: true }), [])
  const tabMaterial = useMemo(() => new THREE.MeshBasicMaterial({ side: THREE.FrontSide, color: tint.shade, transparent: true }), [tint])
  const edgeMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: tint.edge, transparent: true, opacity: 0.9 }),
    [tint]
  )

  useEffect(() => {
    const dunes = dunesArt ?? paperTexture
    const gold = goldArt ?? paperTexture
    for (const [mat, art, tex] of [
      [dunesMaterial, dunesArt, dunes],
      [goldMaterial, goldArt, gold],
    ] as const) {
      mat.map = tex
      if (art) {
        art.wrapS = THREE.ClampToEdgeWrapping
        art.wrapT = THREE.ClampToEdgeWrapping
      }
      mat.color.set(art ? '#ffffff' : tint.lit)
      mat.needsUpdate = true
    }
    if (tabArt) {
      tabArt.wrapS = THREE.ClampToEdgeWrapping
      tabArt.wrapT = THREE.ClampToEdgeWrapping
    }
    tabMaterial.map = tabArt ?? tabGripTexture
    tabMaterial.color.set(tabArt ? '#ffffff' : tint.shade)
    tabMaterial.needsUpdate = true
  }, [dunesArt, goldArt, tabArt, paperTexture, tabGripTexture, dunesMaterial, goldMaterial, tabMaterial, tint])

  // Contact shadow scaled by the placard's rest peak (it lies nearly flat, so a
  // gentle pool; deepens a touch mid-flip when the slats stand — the venetian).
  const shadowTexture = sharedShadowTexture()
  const shadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 }),
    [shadowTexture]
  )
  const shadowSpec = useMemo(() => {
    const sign = layer.side === 'left' ? -1 : 1
    const dC = (layer.d0 + layer.d1) / 2
    const lift = shadowLift(peakHeight([solveDissolvePose(layer, Math.PI / 2, Math.PI, 0).slats[0]]))
    return {
      position: [sign * dC + lift.dx, SHADOW_Y_LIFT, (layer.z0 + layer.z1) / 2 + lift.dz] as [number, number, number],
      size: [(layer.d1 - layer.d0) * 1.05 * lift.spread, (layer.z1 - layer.z0) * 1.05 * lift.spread] as [number, number],
      maxOpacity: STRUCT_SHADOW_MAX * lift.depth,
    }
  }, [layer])

  useEffect(
    () => () => {
      dunesGeoms.forEach((g) => g.dispose())
      goldGeoms.forEach((g) => g.dispose())
      baseGeom.dispose()
      tabGeom.dispose()
      handleGeom.dispose()
      slopGeom.dispose()
      slitGeom.dispose()
      dunesMaterial.dispose()
      goldMaterial.dispose()
      baseMaterial.dispose()
      baseBackMaterial.dispose()
      tabMaterial.dispose()
      edgeMaterial.dispose()
      shadowMaterial.dispose()
    },
    [dunesGeoms, goldGeoms, baseGeom, tabGeom, handleGeom, slopGeom, slitGeom, dunesMaterial, goldMaterial, baseMaterial, baseBackMaterial, tabMaterial, edgeMaterial, shadowMaterial]
  )

  const stroke = useMemo(() => dissolveStroke(layer), [layer])

  // --- Grab lifecycle (laws H1-H3): the LINEAR tab drive (tab-piece idiom),
  // held + snapped on release (volvelle idiom).
  const grabRef = useRef<{ deltaStart: number; dGrab: number } | null>(null)
  const tap = useHandleTap()

  const restAnglesNow = (): { thetaL: number; thetaR: number } =>
    spreadPageAnglesTilted(
      spreadIndex,
      committedSpread.current,
      frame.current?.dir ?? null,
      frame.current ? easeTurnWeighted(frame.current.t) : 0
    )

  /** The pointer's projection onto the live page's fore axis (page-frame u),
   *  in the layer's local frame (law H3: rebuilt from theta each event). */
  const projectPointerD = (e: ThreeEvent<PointerEvent>, thetaL: number, thetaR: number): number | null =>
    projectPageD(pointerLocalRay(e), layer.side === 'left' ? thetaL : thetaR)

  const releaseGrab = (e: ThreeEvent<PointerEvent>): void => {
    if (!grabRef.current) return
    grabRef.current = null
    tap.end(layer.id) // a press that never drew the strip answers with a nudge
    endGrabChannel(layer.id)
    useStorybookStore.getState().endGrab() // tau HELD; the frame loop snaps it to a pure end
    try {
      ;(e.target as Element).releasePointerCapture(e.pointerId)
    } catch {
      // capture already gone
    }
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>): void => {
    if (!acceptsHandleHit(e, slopRef.current)) return
    const st = useStorybookStore.getState()
    if (!st.booted || st.turning !== null || st.spread !== spreadIndex) return
    const { thetaL, thetaR } = restAnglesNow()
    const dGrab = projectPointerD(e, thetaL, thetaR)
    if (dGrab === null) return
    const tauStart = clamp(readUserDrive(layer.id) ?? 0, 0, Math.PI)
    st.beginGrab(layer.id, 'tab')
    if (useStorybookStore.getState().grab?.id !== layer.id) return
    grabRef.current = { deltaStart: dissolveTabOut(layer, tauStart), dGrab }
    writeUserDrive(layer.id, tauStart, [0, Math.PI])
    tap.begin(tauStart)
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
    const { thetaL, thetaR } = restAnglesNow()
    const dNow = projectPointerD(e, thetaL, thetaR)
    if (dNow === null) return
    const deltaNow = clamp(grab.deltaStart + (dNow - grab.dGrab), 0, stroke)
    const tauNow = dissolveTauFromDraw(layer, deltaNow)
    writeUserDrive(layer.id, tauNow, [0, Math.PI])
    tap.track(tauNow, TAP_EPS)
    e.stopPropagation()
  }

  const onPointerOver = (): void => {
    const st = useStorybookStore.getState()
    if (st.grab === null && st.booted && st.turning === null && st.spread === spreadIndex) {
      gl.domElement.style.cursor = 'grab'
      st.setHover(layer.id)
    }
  }
  const onPointerOut = (): void => {
    const st = useStorybookStore.getState()
    if (st.grab === null) gl.domElement.style.cursor = ''
    st.clearHover(layer.id)
  }

  useFrame(() => {
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
    // TURN-CULL (C-3, dissolve-class): the rack is interaction-only and
    // page-flat — mid-turn it is an edge-on sliver nobody is reading, so it
    // stops drawing through the fast middle and ramps back inside the
    // landing-settle beat. Pose maths below are untouched (no fold-flat
    // proof is affected); hiding the group is what returns the draw calls.
    const cull = layer.turnCull ? turnCullOpacity(f ? easeTurnWeighted(f.t) : 0) : 1
    const visible = role !== 'hidden' && beta > FLAT_EPSILON && cull > 0
    group.visible = visible
    if (shadowGroupRef.current) shadowGroupRef.current.visible = visible
    if (!visible) return
    if (layer.turnCull) {
      for (const m of [dunesMaterial, goldMaterial, baseMaterial, baseBackMaterial, tabMaterial]) {
        m.opacity = cull
      }
      edgeMaterial.opacity = 0.9 * cull // its rest opacity, ramped
    }

    // Snap-on-release: ease the held flip to the nearest pure end {0,PI} so the
    // picture clicks to dunes or gold (no half-dissolve rest state).
    if (!grabRef.current && !overrideActive(layer)) {
      const held = readUserDrive(layer.id)
      if (held !== undefined) {
        const target = dissolveSnap(held)
        const delta = target - held
        if (Math.abs(delta) > SNAP_EPS) writeUserDrive(layer.id, held + delta * SNAP_EASE, [0, Math.PI])
        else if (held !== target) {
          if (target === 0) clearUserDrive(layer.id)
          else writeUserDrive(layer.id, target, [0, Math.PI])
        }
      }
    }

    // Tap answer (BW-18): the slats twitch toward the reveal and settle back.
    // Render-time only — the snap-on-release above still owns the channel.
    const tauHeld = readDissolveTau(layer)
    const tau = Math.min(
      Math.PI,
      Math.max(0, tauHeld + nudgeOffset(layer.id, tauHeld, 0, Math.PI, 2 * NUDGE_SPAN_ANGLE))
    )
    const pose = solveDissolvePose(layer, tau, thetaL, thetaR)
    writeQuad(baseGeom, pose.base)
    pose.slats.forEach((quad, k) => {
      writeQuad(dunesGeoms[k], quad)
      writeQuad(goldGeoms[k], quad)
    })
    writeQuad(tabGeom, pose.tab)
    writeQuad(handleGeom, pose.tab)
    writeQuad(slopGeom, enlargeQuad(pose.tab, TOUCH_SLOP))

    const [slitA, slitB] = dissolveSlit(layer, thetaL, thetaR)
    const slitArr = (slitGeom.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
    slitArr[0] = slitA[0]; slitArr[1] = slitA[1]; slitArr[2] = slitA[2]
    slitArr[3] = slitB[0]; slitArr[4] = slitB[1]; slitArr[5] = slitB[2]
    slitGeom.getAttribute('position').needsUpdate = true
    slitGeom.computeBoundingSphere()

    // Mid-flip the slats stand — deepen the pool a touch at the venetian close.
    const flipPeak = Math.sin(tau)
    shadowMaterial.opacity = shadowSpec.maxOpacity * Math.sin(beta / 2) ** 2 * (0.6 + 0.4 * flipPeak)
  })

  return (
    <>
      <group ref={groupRef} visible={false}>
        {/* Sand base (desert floor) under the slats. */}
        <mesh geometry={baseGeom} material={baseMaterial} renderOrder={0} />
        <mesh geometry={baseGeom} material={baseBackMaterial} renderOrder={0} />
        {/* The venetian slats: dunes FrontSide (up at rest), gold BackSide
            (up when flipped). */}
        {Array.from({ length: n }, (_, k) => (
          <group key={k}>
            <mesh geometry={dunesGeoms[k]} material={dunesMaterial} renderOrder={1} />
            <mesh geometry={goldGeoms[k]} material={goldMaterial} renderOrder={1} />
          </group>
        ))}
        {/* The tab handle (raw kraft grip) + its fore-edge slit. */}
        <mesh geometry={tabGeom} material={tabMaterial} renderOrder={1} />
        <lineSegments geometry={slitGeom} material={edgeMaterial} renderOrder={2} />
        {/* Invisible grab handles (raycast targets): the tab exact for mouse/pen,
            1.5x for touch (laws H3/H6). */}
        <group
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={releaseGrab}
          onPointerCancel={releaseGrab}
          onLostPointerCapture={releaseGrab}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
        >
          <mesh ref={handleRef} geometry={handleGeom} material={handleMaterial} renderOrder={3} />
          <mesh ref={slopRef} geometry={slopGeom} material={handleMaterial} renderOrder={3} />
        </group>
      </group>
      <group ref={shadowGroupRef} visible={false}>
        <mesh position={shadowSpec.position} rotation={[-Math.PI / 2, 0, 0]} material={shadowMaterial} renderOrder={-1}>
          <planeGeometry args={shadowSpec.size} />
        </mesh>
      </group>
    </>
  )
}
