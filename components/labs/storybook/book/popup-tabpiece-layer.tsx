'use client'

/**
 * Renders one TAB PIECE layer (popup-tabpiece.ts, D1): a one-page slider
 * structure — mound (two slopes) or table (legs + deck) — whose internal
 * strip ends in a VISIBLE tab at the page's fore edge. The tab slides out
 * by exactly the strip draw as the structure erects (inextensible law).
 *
 * D6 "THE HAND": the tab is a real handle. The reader grabs it and pulls; the
 * lift tracks the finger's projection onto the page's strip axis (law H3,
 * direct manipulation), clamped between a flat fold and the mechanical stop.
 * On release the lift eases back to the page cam (user-drive-return.ts). The
 * high-frequency drive value lives in the module-level scrub channel
 * (user-drive.ts), never React state; zustand holds only the grab identity.
 *
 * THE STRUCTURE IS A HANDLE TOO (E3 s6 S6-1, "the headline lie"). A blind reader
 * met this family on spread 6, where the piece carries the chapter's only
 * imperative — a woodcut cartouche reading RAISE A STALL — and reported: "it is
 * the only labelled object in the scene. Highest-priority affordance by far...
 * it does nothing on click or on drag in any direction. This is the spread's
 * headline affordance and it is a lie." The tab WAS live; it was 0.25 world
 * units away across the page's fore edge, and nothing connected the two.
 *
 * So the erected body — legs and deck — now raycasts into the SAME grab, with
 * the same projector and the same drive arithmetic. That is paper-true, not a
 * shortcut: the structure has exactly one degree of freedom, and pushing a
 * table-form piece fore by its deck draws its strip by the identical slide (the
 * deck's own stations move fore as the lift rises, so the sign even agrees).
 * The reader presses the thing the instruction is printed on and the instruction
 * comes true. The scene lane's other half of the fix is the painted linkage on
 * the floor print and real art on the tab (below).
 *
 * Follows the platform layer's every convention: unlit print, kraft
 * fallback tints, BackSide interior mesh in deep shadow, cut-edge
 * hairlines, DynamicDrawUsage positions rewritten per frame, two-tier
 * unlit shadows scaled by sin(beta/2)^2.
 *
 * Art: ONE painting per piece (`<id>-face`) mapped as the UNFOLDED die-cut
 * — u along the spine, v along the unrolled slide direction (0 at the
 * inner hinge, 1 at the fixed hinge; the ridge/deck breaks sit at their
 * arc-length stations). Printed exactly like a real die-cut sheet: the
 * image is continuous over every crease.
 *
 * The tab takes its OWN painting, `<id>-tab`, when the piece ships one: u across
 * the tab's width, v along the pull (0 at the slit, 1 at the outer tip). Without
 * it the tab falls back to the shared kraft grip texture, which is what every
 * tab wore until a blind reader named it (BW-13): "the shared grey tab-grip
 * reads as an untextured placeholder". A handle a reader is meant to trust has
 * to look painted, on-palette and attached.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { kraftTints } from './paper-stock'
import { acquireMaterial, releaseMaterial, useGuardedDispose } from './material-pool'
import { sharedHandleMaterial, sharedPaperTexture, sharedShadowTexture, sharedTabGripTexture } from './shared-procedural-textures'
import { liveSpreadRole, spreadPageAnglesTilted, type TabPieceGeom, type Vec3 } from './popup-mechanics'
import {
  tabPieceCamShape,
  solveTabPiecePose,
  solveTabPiecePoseAt,
  tabPieceCeiling,
  tabPieceFlatSpan,
  tabPieceLift,
  tabPieceLiftFromSlide,
  tabPieceSlideFromLift,
  tabPieceSlit,
  tabPieceStopLift,
  tabPieceStopSlide,
  type TabPieceFace,
} from './popup-tabpiece'
import { peakHeight, shadowLift } from './shadow-light'
import { turnCullOpacity } from './turn-cull'
import { easeTurnWeighted } from './page-geometry'
import type { TurnFrame } from './use-turn-driver'
import { useArtTexture } from './use-layer-texture'
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
import { HANDLE_SLOP_FLAT, acceptsHandleHit, handleSlopFactor } from './handle-hit'
import { NUDGE_SPAN_ANGLE, TAP_EPS, nudgeOffset } from './handle-nudge'
import { useHandleTap } from './use-handle-tap'
import { projectPageD } from './handle-projection'

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
/** Coarse-pointer hit widening (law H6): the invisible slop mesh is 1.5x the
 *  tab, engaged only for `pointerType === 'touch'`. */
/** Page-flat handle: the reading camera foreshortens it hard, so it takes
 *  the generous pad (handle-hit.ts). */
const TOUCH_SLOP = HANDLE_SLOP_FLAT
/** Rest lift, as a fraction of the mechanical stop, below which a tab piece is
 *  READER-raised rather than page-raised (see the shadow spec). */
const READER_RAISED_REST = 0.5

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

// Scratch for the H3 pointer projection (one grab at a time, consumed at once).

/** The darker sibling of each crease pair — the face turned away from the
 *  fore edge's light in the flat print (slopeOut/legOut), plus the tab. */
const isShaded = (face: TabPieceFace): boolean =>
  face === 'slopeOut' || face === 'legOut' || face === 'tab'

/** Unfolded-die-cut v bands per face (arc length from inner hinge, over
 *  the flat span). The tab is raw kraft — identity uvs. */
function tabFaceUvs(face: TabPieceFace, geom: TabPieceGeom): Float32Array {
  const span = tabPieceFlatSpan(geom)
  const w = geom.legW / span
  const d = (geom.deckD ?? 0) / span
  const bands: Partial<Record<TabPieceFace, [number, number]>> = {
    slopeIn: [0, 0.5],
    slopeOut: [0.5, 1],
    legIn: [0, w],
    deck: [w, w + d],
    legOut: [w + d, 1],
  }
  const band = bands[face]
  if (!band) return new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])
  const [vA, vB] = band
  return new Float32Array([0, vA, 1, vA, 1, vB, 0, vB])
}

function makeFaceGeometry(uvs: Float32Array): THREE.BufferGeometry {
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

/** Two-point line geometry for the fore-edge SLIT the tab emerges through
 *  (D3 tab-legibility package) — one segment, positions rewritten every
 *  frame from `tabPieceSlit`. */
function makeSlitGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(6), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  return geometry
}

/** Rewrites a 4-corner geometry's positions from a quad. */
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

/** A quad scaled `k`x about its own centre — the coarse-pointer slop target. */
function enlargeQuad(quad: readonly Vec3[], k: number): Vec3[] {
  const cx = (quad[0][0] + quad[1][0] + quad[2][0] + quad[3][0]) / 4
  const cy = (quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1]) / 4
  const cz = (quad[0][2] + quad[1][2] + quad[2][2] + quad[3][2]) / 4
  return quad.map((p) => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k, cz + (p[2] - cz) * k] as Vec3)
}

export function TabPiecePopupLayer({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & TabPieceGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const shadowGroupRef = useRef<THREE.Group>(null)
  const handleRef = useRef<THREE.Mesh>(null)
  const slopRef = useRef<THREE.Mesh>(null)

  const faceArt = useArtTexture(`${layer.id}-face`)
  // Optional per-piece tab painting (BW-13). `useArtTexture` returns null for
  // an id the manifest does not carry, so a piece without one costs nothing and
  // keeps the kraft grip below.
  const tabArt = useArtTexture(`${layer.id}-tab`)
  // This piece's own stock (D3 kraft-legibility package): replaces the
  // shared PAPER_TINT/PAPER_SHADE_TINT pair so a mid-turn tangle of several
  // artless tab pieces separates by tone instead of reading as one mass.
  const tint = useMemo(() => kraftTints(layer.id), [layer.id])

  const patches = useMemo(() => solveTabPiecePose(layer, Math.PI, 0), [layer])
  const geometries = useMemo(
    () => patches.map((p) => makeFaceGeometry(tabFaceUvs(p.face, layer))),
    [patches, layer]
  )
  const edgeGeometries = useMemo(() => patches.map(() => makeEdgeGeometry()), [patches])
  // One hairline material per patch (not shared): artless faces get this
  // piece's own darker `tint.edge` for contrast against same-family
  // neighbors mid-turn; painted faces keep the standard pale cut-edge core.
  const edgeMaterials = useMemo(
    () => patches.map(() => new THREE.LineBasicMaterial({ color: CUT_EDGE_COLOR, transparent: true, opacity: 0.8 })),
    [patches]
  )

  // TURN-CULL opt-in (C-3). A culled piece must be able to RAMP, and an
  // opacity ramp needs materials this piece alone owns and may write — the
  // pool's own contract forbids mutating a shared material's opacity. So the
  // flag also decides two allocation questions below: transparent exteriors,
  // and an unpooled interior. Un-culled pieces keep the E-G4 pooling exactly.
  const culled = layer.turnCull === true

  const paperTexture = sharedPaperTexture()
  const tabGripTexture = sharedTabGripTexture()
  const materials = useMemo(() => {
    const exterior = patches.map(
      (p) =>
        new THREE.MeshBasicMaterial({
          side: THREE.FrontSide,
          color: isShaded(p.face) ? PAINTED_FOLD_SHADE : '#ffffff',
          transparent: culled,
        })
    )
    return { exterior }
  }, [patches, culled])
  // Every tab piece's underside is the same raw-paper-stock BackSide wall,
  // pooled (E-G4 fix wave) — shared with box/platform's interior material.
  // A culled piece owns its copy instead: the pool is only safe for materials
  // nobody writes after acquiring, and this one's opacity is written per frame
  // through the cull ramp.
  const interiorMaterial = useMemo(
    () =>
      culled
        ? new THREE.MeshBasicMaterial({
            side: THREE.BackSide,
            map: paperTexture,
            color: INTERIOR_SHADOW_TINT,
            transparent: true,
          })
        : acquireMaterial({ side: THREE.BackSide, map: paperTexture, color: INTERIOR_SHADOW_TINT }),
    [paperTexture, culled]
  )
  useEffect(
    () => () => {
      if (culled) interiorMaterial.dispose()
      else releaseMaterial(interiorMaterial)
    },
    [interiorMaterial, culled]
  )

  // The invisible grab handles (law H3/H6): an exact-tab mesh for mouse/pen
  // precision and a 1.5x slop mesh for touch. Both raycast (object visible)
  // but never render (material.visible = false). Positions track the tab
  // quad every frame. Shared singleton (every grabbable layer used its own
  // copy of this identical invisible material — E-G4 fix wave).
  const handleGeometry = useMemo(() => makeFaceGeometry(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), [])
  const slopGeometry = useMemo(() => makeFaceGeometry(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), [])
  const handleMaterial = sharedHandleMaterial()

  useEffect(() => {
    patches.forEach((p, i) => {
      const material = materials.exterior[i]
      // The tab takes its own painting when the piece ships one, otherwise the
      // raw-kraft grip-notch texture (never the face art — different unfold).
      const art = p.face === 'tab' ? tabArt : faceArt
      material.map = art ?? (p.face === 'tab' ? tabGripTexture : paperTexture)
      if (art) {
        art.wrapS = THREE.ClampToEdgeWrapping
        art.wrapT = THREE.ClampToEdgeWrapping
        // A PAINTED tab is lit like any other painted face: the `isShaded` step
        // exists to separate creases in raw kraft, and stepping a painted tab
        // down would dim the very handle the reader is being invited to find.
        material.color.set(p.face === 'tab' || !isShaded(p.face) ? '#ffffff' : PAINTED_FOLD_SHADE)
      } else {
        material.color.set(isShaded(p.face) ? tint.shade : tint.lit)
      }
      material.needsUpdate = true
      edgeMaterials[i].color.set(art ? CUT_EDGE_COLOR : tint.edge)
    })
  }, [patches, materials, edgeMaterials, paperTexture, tabGripTexture, faceArt, tabArt, tint])

  // The fore-edge SLIT the tab emerges through (D3 tab-legibility package):
  // a short hairline riding the page rigidly at d = PAGE_W, tinted this
  // piece's own darker `edge` sibling so it reads as a cut, not a stray line.
  const slitGeometry = useMemo(() => makeSlitGeometry(), [])
  const slitMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: tint.edge, transparent: true, opacity: 0.9 }),
    [tint]
  )

  const shadowTexture = sharedShadowTexture()
  const shadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 }),
    [shadowTexture]
  )
  // Key-light placement (shadow-light.ts): the erected mound/table stands, so
  // its pool offsets down-screen-right and deepens/spreads with its rest peak.
  //
  // THE POOL TRACKS THE LIFT (A-3, the strip flap's S6-3 law in this family's
  // units). A piece the PAGE raises stands at rest, so its reference pose is the
  // rest pose and its pool is the one it always cast. A piece the READER raises
  // is handed over lying flat — sizing its pool from that pose would give the
  // fully raised stall the shadow of a folded sheet — so its reference is the
  // pose the reader can raise it to, and the pool only has to fade in (below),
  // never re-derive its geometry mid-drag. The test is numeric, not a flag:
  // a rest lift under half the mechanical stop is a piece handed over flat.
  const shadowSpec = useMemo(() => {
    const span = tabPieceFlatSpan(layer)
    const sign = layer.side === 'left' ? -1 : 1
    const stop = tabPieceStopLift(layer)
    const readerRaised = tabPieceLift(layer, Math.PI) < READER_RAISED_REST * stop
    const rest = readerRaised
      ? solveTabPiecePoseAt(layer, stop, Math.PI, 0)
      : solveTabPiecePose(layer, Math.PI, 0)
    const lift = shadowLift(peakHeight(rest.map((p) => p.quad)))
    return {
      position: [
        sign * (layer.hingeX - span / 2) + lift.dx,
        SHADOW_Y_LIFT,
        (layer.z0 + layer.z1) / 2 + lift.dz,
      ] as [number, number, number],
      size: [span * 0.95 * lift.spread, (layer.z1 - layer.z0) * 1.05 * lift.spread] as [number, number],
      maxOpacity: STRUCT_SHADOW_MAX * lift.depth,
      // 0 for a page-raised piece: the frame loop then holds its pool at full
      // strength exactly as it always did.
      refLift: readerRaised ? stop : 0,
    }
  }, [layer])

  // Channel bounds and the mechanical stop for this piece (law H3).
  const aStop = useMemo(() => tabPieceStopLift(layer), [layer])
  const sStop = useMemo(() => tabPieceStopSlide(layer), [layer])

  // paperTexture/tabGripTexture/shadowTexture/handleMaterial are shared
  // singletons — never disposed per-instance; interiorMaterial is pooled —
  // released above.
  useGuardedDispose([
    ...geometries,
    ...edgeGeometries,
    ...edgeMaterials,
    ...materials.exterior,
    handleGeometry,
    slopGeometry,
    slitGeometry,
    slitMaterial,
    shadowMaterial,
  ])

  // --- Grab lifecycle (laws H1-H3). High-frequency values flow through the
  // module scrub channel; only the low-frequency grab identity touches zustand.
  const grabRef = useRef<{ sGrabStart: number; dGrab: number } | null>(null)
  const tap = useHandleTap()

  const restAnglesNow = (): { thetaL: number; thetaR: number } =>
    spreadPageAnglesTilted(
      spreadIndex,
      committedSpread.current,
      frame.current?.dir ?? null,
      frame.current ? easeTurnWeighted(frame.current.t) : 0
    )

  /** The pointer's projection onto the live page's strip axis (page-frame u),
   *  in the layer's local frame (law H3: rebuilt from theta each event). */
  const projectPointerD = (e: ThreeEvent<PointerEvent>, thetaL: number, thetaR: number): number | null =>
    projectPageD(pointerLocalRay(e), layer.side === 'left' ? thetaL : thetaR)

  const releaseGrab = (e?: ThreeEvent<PointerEvent> | null): void => {
    if (!grabRef.current) return
    grabRef.current = null
    tap.end(layer.id) // a press that never drew the strip answers with a nudge
    endGrabChannel(layer.id)
    useStorybookStore.getState().endGrab()
    try {
      if (e) (e.target as Element).releasePointerCapture(e.pointerId)
    } catch {
      // capture already gone (e.g. lostpointercapture) — nothing to release
    }
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>): void => {
    // Touch uses the 1.5x slop mesh; mouse/pen use the exact tab mesh (H6).
    if (!acceptsHandleHit(e, slopRef.current)) return
    const st = useStorybookStore.getState()
    if (!st.booted || st.turning !== null || st.spread !== spreadIndex) return
    const { thetaL, thetaR } = restAnglesNow()
    const dGrab = projectPointerD(e, thetaL, thetaR)
    if (dGrab === null) return
    const camA = tabPieceLift(layer, thetaL - thetaR)
    const aGrabStart = clamp(readUserDrive(layer.id) ?? camA, 0, aStop)
    st.beginGrab(layer.id, 'tab')
    if (useStorybookStore.getState().grab?.id !== layer.id) return // booted/turning re-check no-oped
    grabRef.current = { sGrabStart: tabPieceSlideFromLift(layer, aGrabStart), dGrab }
    writeUserDrive(layer.id, aGrabStart, [0, aStop])
    tap.begin(aGrabStart)
    beginGrabChannel(layer.id, releaseGrab)
    ;(e.target as Element).setPointerCapture(e.pointerId)
    e.stopPropagation()
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>): void => {
    markHandleHovered(layer.id, spreadIndex)
    const grab = grabRef.current
    if (!grab) return
    // A keyboard/wheel turn can force-release the grab mid-drag (law H2); the
    // return stepper then owns the channel, so stop writing and clean up.
    if (useStorybookStore.getState().grab?.id !== layer.id) {
      releaseGrab(e)
      return
    }
    const { thetaL, thetaR } = restAnglesNow()
    const dNow = projectPointerD(e, thetaL, thetaR)
    if (dNow === null) return
    const sUser = clamp(grab.sGrabStart + (dNow - grab.dGrab), 0, sStop)
    const aUser = tabPieceLiftFromSlide(layer, sUser)
    writeUserDrive(layer.id, aUser, [0, aStop])
    tap.track(aUser, TAP_EPS)
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
    const f = frame.current
    const role = liveSpreadRole(spreadIndex, committedSpread.current, f?.dir ?? null)
    const { thetaL, thetaR } = spreadPageAnglesTilted(
      spreadIndex,
      committedSpread.current,
      f?.dir ?? null,
      f ? easeTurnWeighted(f.t) : 0
    )
    const beta = thetaL - thetaR

    // TURN-CULL (C-3, the dial/winch/dissolve lever): a playable tab piece is
    // the reader's instrument, not the spread's structure — mid-turn it is a
    // sliver on a sheet sweeping past at speed and nobody is reading it, so it
    // stops drawing and ramps back across the landing settle. `frame.t` is the
    // driver's RAW published progress (turn-cull.ts is explicit that the eased
    // value is still ~0 a fifth of the way in, which would put the fade nowhere
    // near the specified window). Everything below — pose, lift, envelope,
    // fold-flat — is untouched; hiding the group is what returns the draws.
    const cull = culled ? turnCullOpacity(f?.t ?? 0) : 1
    const visible = role !== 'hidden' && beta > FLAT_EPSILON && cull > 0
    group.visible = visible
    if (shadowGroupRef.current) shadowGroupRef.current.visible = visible
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
      for (const m of [...materials.exterior, interiorMaterial]) applyHandleGlow(m, w)
    }
    if (culled) {
      for (const m of materials.exterior) m.opacity = cull
      interiorMaterial.opacity = cull
      for (const m of edgeMaterials) m.opacity = 0.8 * cull // its rest opacity, ramped
      slitMaterial.opacity = 0.9 * cull
    }

    // --- Effective lift (laws H2/H3): reader drive, release return, or cam.
    const camA = tabPieceLift(layer, beta)
    const ceiling = tabPieceCeiling(layer, beta)
    const override = readDriveOverride(layer.id)
    const grabbed = useStorybookStore.getState().grab?.id === layer.id
    const channelA = readUserDrive(layer.id)
    let effectiveA: number
    if (override !== null) {
      effectiveA = clamp(tabPieceLiftFromSlide(layer, override), 0, aStop) // ?sbdrive value is s
    } else if (grabbed) {
      effectiveA = channelA ?? camA
    } else if (channelA !== undefined) {
      // RELEASE = LATCH (E3 release law, BW-12). This used to decay back to the
      // page cam, and it was the single most deflating thing a blind reader
      // reported on spread 5: "Travel follows the drag continuously — that part
      // feels genuinely good, like working a real paper strip. On release it
      // snaps all the way back to the closed tent. Delightful while held,
      // deflating on let-go." The identical mechanism one chapter later
      // latched, and the reader called the inconsistency a bug. It is.
      // The held angle stays put; the SHOWN lift is angle * S(beta) (the shared
      // cam shape), which is the lift-flap persistence composition in this
      // family's units — 0 at book close for any held angle, and never a
      // faster per-frame step than the always-on ceiling that already gates it.
      effectiveA = clamp(channelA, 0, aStop) * tabPieceCamShape(layer, beta)
    } else {
      effectiveA = camA
    }
    // Tap answer (BW-18), render-time only: the excursion never reaches the
    // scrub channel, so the release return and the press-and-peel ceiling below
    // both still see the reader's own value.
    const nudged = clamp(
      effectiveA + nudgeOffset(layer.id, effectiveA, 0, aStop, NUDGE_SPAN_ANGLE),
      0,
      aStop
    )
    const rendered = Math.min(nudged, ceiling)

    const solved = solveTabPiecePoseAt(layer, rendered, thetaL, thetaR)
    solved.forEach((patch, i) => {
      for (const geometry of [geometries[i], edgeGeometries[i]]) {
        writeQuad(geometry, patch.quad)
      }
    })

    // Track the tab quad onto the invisible grab handles.
    const tab = solved[solved.length - 1].quad
    writeQuad(handleGeometry, tab)
    writeQuad(slopGeometry, enlargeQuad(tab, handleSlopFactor(tab, TOUCH_SLOP)))

    const [slitA, slitB] = tabPieceSlit(layer, thetaL, thetaR)
    const slitAttr = slitGeometry.getAttribute('position') as THREE.BufferAttribute
    const slitArr = slitAttr.array as Float32Array
    slitArr[0] = slitA[0]
    slitArr[1] = slitA[1]
    slitArr[2] = slitA[2]
    slitArr[3] = slitB[0]
    slitArr[4] = slitB[1]
    slitArr[5] = slitB[2]
    slitAttr.needsUpdate = true
    slitGeometry.computeBoundingSphere()

    // The pool fades with the LIFT for a reader-raised piece (A-3): a stall the
    // reader has pressed flat must not still cast a standing tent's shadow —
    // that is the one cue that would tell them the fold landed, contradicting
    // it. Measured against the piece's own reference lift, so a page-raised
    // piece is exactly 1 at every beta and its pool is bit-identical.
    const liftFraction =
      shadowSpec.refLift > 1e-6 ? clamp(Math.sin(rendered) / Math.sin(shadowSpec.refLift), 0, 1) : 1
    shadowMaterial.opacity = shadowSpec.maxOpacity * Math.sin(beta / 2) ** 2 * cull * liftFraction
  })

  return (
    <>
      <group ref={groupRef} visible={false}>
        {patches.map((p, i) => (
          <group key={p.face}>
            <mesh geometry={geometries[i]} material={materials.exterior[i]} renderOrder={0} />
            <mesh geometry={geometries[i]} material={interiorMaterial} renderOrder={0} />
            <lineLoop geometry={edgeGeometries[i]} material={edgeMaterials[i]} renderOrder={1} />
          </group>
        ))}
        <lineSegments geometry={slitGeometry} material={slitMaterial} renderOrder={1} />
        {/* Invisible grab handles (raycast targets, never rendered) — the tab
            quad exact for mouse/pen, padded for coarse pointers (laws H3/H6),
            PLUS the erected body's own faces (S6-1: the structure the
            instruction is printed on is a handle). The body meshes borrow the
            render geometries, which the frame loop already rewrites, so they
            cost one draw-free mesh each and can never drift from the paper. */}
        <group
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={releaseGrab}
          onPointerCancel={releaseGrab}
          onLostPointerCapture={releaseGrab}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
        >
          <mesh ref={handleRef} geometry={handleGeometry} material={handleMaterial} renderOrder={2} />
          <mesh ref={slopRef} geometry={slopGeometry} material={handleMaterial} renderOrder={2} />
          {patches.map((p, i) =>
            p.face === 'tab' ? null : (
              <mesh key={p.face} geometry={geometries[i]} material={handleMaterial} renderOrder={2} />
            )
          )}
        </group>
      </group>
      <group ref={shadowGroupRef} visible={false}>
        {/* renderOrder=-1: all ground shading joins the gutter crease's
            early transparent tier (D-G3 audit; book.tsx precedent) so no
            shadow can ever draw over paper. */}
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
