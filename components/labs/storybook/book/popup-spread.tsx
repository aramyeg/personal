'use client'

/**
 * A pop-up book spread: one paper mechanism per `SceneLayer`, posed every
 * frame by the pure closed-form solvers in popup-mechanics.ts. Each piece
 * is glued to BOTH pages of its spread (or to its parent piece's panels,
 * for cascaded children), so its pose is a function of nothing but the
 * spread's dihedral angle:
 *
 *  - 'current' (at rest): pages flat, dihedral PI — the scene stands open.
 *  - 'outgoing': this spread's dihedral closes PI -> 0 with the turning
 *    sheet (which IS one of its pages), folding every piece flat into the
 *    closing wedge — the paper moves exactly when and as fast as the page.
 *  - 'incoming': dihedral opens 0 -> PI as the sheet lands; the pieces are
 *    stretched open by the page itself, blooming hardest just before flat
 *    (a geometric property of the mechanism, not an animation curve).
 *  - 'hidden': a warm-texture neighbor; never visible.
 *
 * No springs or timers: one shared driving angle, like real glued paper
 * (benchmark B9). Mounted by book.tsx for the current spread ± 1. The
 * enclosing group sits at the open page's surface height (page-geometry.ts),
 * so a layer's local y=0 is the page plane and the spine runs along z at x=0.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import {
  liveSpreadRole,
  solveLayerPose,
  spreadPageAnglesTilted,
  type MechPose,
  type PanelQuad,
} from './popup-mechanics'
import { solveRiderPose } from './popup-anatomy'
import { peakHeight, shadowLift } from './shadow-light'
import { easeTurnWeighted } from './page-geometry'
import { sharedShadowTexture } from './shared-procedural-textures'
import { BoxPopupLayer } from './popup-box-layer'
import { PlatformPopupLayer } from './popup-platform-layer'
import { TabPiecePopupLayer } from './popup-tabpiece-layer'
import { StripFlapPopupLayer } from './popup-stripflap-layer'
import { KnobTowerPopupLayer } from './popup-knobtower-layer'
import { KeepsakePopupLayer } from './popup-keepsake-layer'
import { KeepStackPopupLayer } from './popup-keepstack-layer'
import { KeepWinchPopupLayer } from './popup-keepwinch-layer'
import { KeepSkylinePopupLayer } from './popup-skyline-layer'
import { SwarmArcPopupLayer } from './popup-swarmarc-layer'
import { DepthVistaPopupLayer } from './popup-depthvista-layer'
import { DissolvePopupLayer } from './popup-dissolve-layer'
import { MFoldRangePopupLayer } from './popup-mfoldrange-layer'
import { StagedChainPopupLayer } from './popup-stagedchain-layer'
import { DispatchLinePopupLayer } from './popup-dispatchline-layer'
import { OanavePopupLayer } from './popup-oanave-layer'
import { DressPopupLayer, RotorPopupLayer, fanMemberLayers } from './popup-anatomy-layers'
import { VolvellePopupLayer } from './popup-volvelle-layer'
import { LiftFlapPopupLayer } from './popup-liftflap-layer'
import type { TurnFrame } from './use-turn-driver'
import { useLayerSprite } from './use-layer-texture'
import { applyUvRect } from '../art-atlas'

const SHADOW_HEIGHT = 0.16
const SHADOW_Y_LIFT = 0.001
const SHADOW_MAX_OPACITY = 0.32
// Below this dihedral the piece is flat paper coincident with the page —
// drawing it would only z-fight the page print (and, during a turn, the
// identical flattened neighbor). A hair above 0 so float noise can't
// flicker the mesh.
const FLAT_EPSILON = 0.02
// Fold shading, baked as a material tint (the print carries its own light —
// materials are unlit): the panel facing away from the key light reads a
// step darker, which is what sells the center crease as a real fold.
const FOLD_SHADE_TINT = '#d9cdb4'
// E-G5 floor (f): PAINTED v-folds get this gentle NEUTRAL step on the shaded
// panel; the warm FOLD_SHADE_TINT (~x0.85/0.80/0.71) is reserved for kraft
// placeholder v-folds (no texture) so painted art is not dimmed + warm-cast
// across the whole left leaf of a crease.
const PAINTED_FOLD_SHADE = '#e4e4e4'

/** A pop-up spread's relationship to any turn currently in flight. The
 *  React-clock value (book.tsx's `role` prop) only coarse-gates mounting
 *  visibility; every POSE consumer re-derives its live role per frame via
 *  `liveSpreadRole` so role and dihedral tick on the driver clock (see
 *  popup-mechanics.ts — the commit-frame pop-open flash). */
export type PopupRole = 'current' | 'outgoing' | 'incoming' | 'hidden'

type PopupSpreadProps = {
  layers: readonly SceneLayer[]
  accents: readonly string[]
  spreadIndex: number
  role: PopupRole
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}

/** Fold-line position in texture u, fixed per die-cut: where the art's
 *  crease falls for v-folds/children, where the ridge splits a parallel
 *  strip's two slopes. Boxes never reach here (their faces carry their own
 *  uv mapping in popup-box-layer.tsx). */
const foldSplit = (layer: SceneLayer): number => {
  if (layer.mech === 'parallel') {
    return (layer.glueR + layer.rise) / (layer.glueL + layer.glueR + 2 * layer.rise)
  }
  if (layer.mech === 'box') return 0.5
  if (layer.mech === 'platform') return layer.qA / (layer.qA + layer.qB) // deck crease
  if (layer.mech === 'fan') return 0.5 // per-member creaseU applies at render
  if (layer.mech === 'dress') return 0.5 // single quad, no fold
  if (layer.mech === 'rotor') return 0.5 // single spinning quad, no fold
  if (layer.mech === 'volvelle') return 0.5 // dial + card quads, per-face uvs in the volvelle layer
  if (layer.mech === 'liftflap') return 0.5 // board + door quads, per-face uvs in the liftflap layer
  if (layer.mech === 'stripflap') return 0.5 // coplanar halves, invisible seam
  if (layer.mech === 'tabpiece') return 0.5 // per-face uvs live in the tabpiece layer
  if (layer.mech === 'knobtower') return 0.5 // per-face uvs live in the knobtower layer
  if (layer.mech === 'keepsake') return 0.5 // single card quad, no fold
  // The E1 showpiece mechs carry their per-face uvs in their own layers.
  if (layer.mech === 'keepstack' || layer.mech === 'keepwinch' || layer.mech === 'skyline') return 0.5
  if (layer.mech === 'swarmarc') return 0.5 // merged strut/rider quads, per-cell uvs in the swarmarc layer
  if (layer.mech === 'depthvista') return 0.5 // arch decks + wing quads, per-face uvs in the depthvista layer
  if (layer.mech === 'dissolve') return 0.5 // base + slat + tab quads, per-slat uvs in the dissolve layer
  if (layer.mech === 'mfoldrange') return 0.5 // per-rank atlas uvs live in the range layer
  if (layer.mech === 'stagedchain') return 0.5 // per-storey atlas bands live in the staged-chain layer
  if (layer.mech === 'dispatchline') return 0.5 // die-cut panel + rider uvs live in the dispatch-line layer
  if (layer.mech === 'kinetic') return layer.flapW / (layer.flapW + layer.armW) // flap | arm
  if (layer.mech === 'oanave') return 0.5 // host + relief uvs live in the oanave layer (fold at 0.5, symmetric)
  return layer.creaseU ?? 0.5
}

/** Screen-up direction on the book, derived from the fixed reading camera
 *  (book-scene.tsx: position (0, 2.6, 2.9) looking at (0, 0.32, 0.15)):
 *  world up minus its component along the view direction, normalized.
 *  Re-derive if the camera framing ever changes materially. */
const SCREEN_UP: readonly [number, number, number] = [0, 0.77, -0.638]

/**
 * Whether a piece's die must be printed rotated 180 degrees so its art
 * reads upright from the reading camera. Decided from the REST pose (a
 * pure function of the layer's geometry): if the piece's v-axis — apex
 * toward top corners — points DOWN-SCREEN, its art would render on its
 * head. This is the book's recurring bug class, and no static rule covers
 * it: children of deep-V parents tip past the vertical (fold elevation
 * lambda > 90 deg puts sign/lantern/banner v-axes at dot ~ -0.99) while
 * the same child geometry on a near-flat wall parent stands upright
 * (bees/ravens/balcony at dot ~ +0.2..0.5); hanging children (coins,
 * vault door) point at the camera and land at dot ~ -0.3. Rotating is a
 * real fabricator move — the die turns 180 before gluing; paper cannot be
 * mirror-printed. Flipped pieces are center-fold only (all shipped ones
 * are): an off-center creaseU would land the art's painted seam at 1-s
 * after the rotation.
 */
export function dieFlipped(layer: SceneLayer, parent: SceneLayer | undefined): boolean {
  if (layer.mech === 'parallel') return false // handled in panelUvs' own mapping
  if (layer.mech === 'box') return false // per-face uvs live in popup-box-layer.tsx
  if (layer.mech === 'platform') return false // per-face uvs live in the platform layer
  if (layer.mech === 'fan' || layer.mech === 'rider' || layer.mech === 'dress') {
    // Anatomy mechs route through their own renderers (fan members and
    // riders re-enter here as synthesized v-fold poses when they land).
    return false
  }
  if (layer.mech === 'rotor') return false // spun in-plane by its own renderer; disc art is symmetric
  if (layer.mech === 'volvelle') return false // dial spun in-plane by its own renderer; disc art is symmetric
  if (layer.mech === 'liftflap') return false // page-flat art, side-aware uvs live in the liftflap layer
  if (layer.mech === 'knobtower') return false // per-face uvs live in the knobtower layer
  if (layer.mech === 'tabpiece') return false // per-face uvs live in the tabpiece layer
  if (layer.mech === 'keepsake') return false // single card quad, its own renderer
  // The E1 showpiece mechs pose their own per-face uvs in their own renderers.
  if (layer.mech === 'keepstack' || layer.mech === 'keepwinch' || layer.mech === 'skyline') return false
  if (layer.mech === 'swarmarc') return false // atlas-cell uvs live in the swarmarc layer
  if (layer.mech === 'depthvista') return false // per-face uvs live in the depthvista layer
  if (layer.mech === 'dissolve') return false // per-slat screen-space uvs live in the dissolve layer
  if (layer.mech === 'mfoldrange') return false // per-rank atlas uvs live in the range layer
  if (layer.mech === 'stagedchain') return false // per-storey atlas bands live in the staged-chain layer
  if (layer.mech === 'dispatchline') return false // die-cut panel + rider uvs live in the dispatch-line layer
  const rest = solveLayerPose(layer, parent, Math.PI, 0)
  const v: [number, number, number] = [
    rest.right[3][0] - rest.right[0][0],
    rest.right[3][1] - rest.right[0][1],
    rest.right[3][2] - rest.right[0][2],
  ]
  return v[0] * SCREEN_UP[0] + v[1] * SCREEN_UP[1] + v[2] * SCREEN_UP[2] < 0
}

/** Per-corner uvs (matching PanelQuad order) selecting one panel's share of
 *  the layer's art, split at the fold line so the print continues
 *  seamlessly across it (benchmark B6). V-folds read u across the width
 *  and v up the standing panel; parallel strips read u across the fold and
 *  v along their span. Under three's default flipY, v=1 is the image TOP —
 *  and the image top must always land on the piece's up-screen edge. */
export function panelUvs(layer: SceneLayer, side: 'right' | 'left', flipped = false): Float32Array {
  const s = foldSplit(layer)
  if (layer.mech === 'parallel') {
    // corners: [glue@z0, glue@z1, ridge@z1, ridge@z0] (left) and
    // [ridge@z0, ridge@z1, glue@z1, glue@z0] (right). v runs along the
    // spine span, and the image top (v=1) must sit at z0 — the FAR edge,
    // up-screen from the reading camera. v=z-order rendered every tent
    // print upside down (the page-print v-flip bug, third appearance).
    return side === 'left'
      ? new Float32Array([0, 1, 0, 0, s, 0, s, 1])
      : new Float32Array([s, 1, s, 0, 1, 0, 1, 1])
  }
  // corners: [apex, bottom-outer, top-outer, top-inner]
  if (flipped) {
    return side === 'left'
      ? new Float32Array([1 - s, 1, 1, 1, 1, 0, 1 - s, 0])
      : new Float32Array([1 - s, 1, 0, 1, 0, 0, 1 - s, 0])
  }
  return side === 'left'
    ? new Float32Array([s, 0, 0, 0, 0, 1, s, 1])
    : new Float32Array([s, 0, 1, 0, 1, 1, s, 1])
}

/** 4-corner quad geometry with fixed uvs; positions are rewritten from the
 *  solver every frame. */
function makePanelGeometry(uvs: Float32Array): THREE.BufferGeometry {
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
  for (let i = 0; i < 4; i++) {
    arr[i * 3] = quad[i][0]
    arr[i * 3 + 1] = quad[i][1]
    arr[i * 3 + 2] = quad[i][2]
  }
  attr.needsUpdate = true
  geometry.computeBoundingSphere()
}

/** Contact-shadow footprint per mechanism: v-folds shade across their glue
 *  fan, parallel strips shade the band between their glue lines. Children
 *  ride high on a parent and cast no page-contact shadow of their own —
 *  the parent's is already there. */
function shadowPlacement(
  layer: SceneLayer
): { position: [number, number, number]; size: [number, number] } | null {
  if (layer.mech === 'vfold') {
    return {
      position: [0, SHADOW_Y_LIFT, layer.apexZ + layer.vDir * 0.04],
      size: [layer.width * 0.9, SHADOW_HEIGHT],
    }
  }
  if (layer.mech === 'parallel') {
    return {
      position: [(layer.glueR - layer.glueL) / 2, SHADOW_Y_LIFT, (layer.z0 + layer.z1) / 2],
      size: [(layer.glueL + layer.glueR) * 0.85, (layer.z1 - layer.z0) * 0.95],
    }
  }
  if (layer.mech === 'stripflap') {
    return {
      position: [layer.side === 'left' ? -layer.hingeX : layer.hingeX, SHADOW_Y_LIFT, layer.hingeZ],
      size: [layer.width * 0.9, SHADOW_HEIGHT * 0.8],
    }
  }
  if (layer.mech === 'kinetic') {
    // The arm stands nearly vertical over the spine at rest — its contact
    // patch is a small footprint at the muscle's base, offset toward the
    // fold direction like a v-fold.
    return {
      position: [0, SHADOW_Y_LIFT, layer.apexZ + layer.vDir * 0.04],
      size: [(layer.armW + layer.flapW) * 1.6, SHADOW_HEIGHT * 0.7],
    }
  }
  return null
}

function PopupLayer({
  layer,
  parent,
  accents,
  spreadIndex,
  frame,
  committedSpread,
  solvePose,
}: {
  layer: SceneLayer
  parent: SceneLayer | undefined
  accents: readonly string[]
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
  /** Overrides the internal `solveLayerPose` for mechs whose pose is not a
   *  pure function of the layer alone (riders re-solve their parent). */
  solvePose?: (thetaL: number, thetaR: number) => MechPose | null
}) {
  // INFRA-2: the generic two-quad path is the widest family in the book
  // (v-folds, children, ground swells, riders, kinetic arms, and every fan
  // member), so teaching it the sprite path is what lets a whole spread's
  // scenery share one page. `panelUvs` already authors in the unit square —
  // including its die-flips and off-centre creases — so one affine remap
  // carries any of its tables into the region.
  const { texture, rect } = useLayerSprite(layer.id, layer.kind, accents)
  const cutoutRef = useRef<THREE.Group>(null)
  const shadowRef = useRef<THREE.Mesh>(null)
  const rightMeshRef = useRef<THREE.Mesh>(null)
  const leftMeshRef = useRef<THREE.Mesh>(null)

  const geometries = useMemo(() => {
    const flipped = dieFlipped(layer, parent)
    return {
      right: makePanelGeometry(applyUvRect(panelUvs(layer, 'right', flipped), rect)),
      left: makePanelGeometry(applyUvRect(panelUvs(layer, 'left', flipped), rect)),
    }
  }, [layer, parent, rect])

  // Unlit print materials — the artwork carries its own light, like ink on
  // paper; scene lights set the mood around the book, not on the print. One
  // shared full texture, halved by each panel's uvs (no clone uploads). The
  // left panel faces away from the key light and reads a step darker.
  const materials = useMemo(() => {
    const make = (tint: string) =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        alphaTest: 0.1,
        side: THREE.DoubleSide,
        color: tint,
      })
    return { right: make('#ffffff'), left: make(FOLD_SHADE_TINT) }
  }, [])

  useEffect(() => {
    if (!texture) return
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    materials.right.map = texture
    materials.right.needsUpdate = true
    materials.left.map = texture
    // Painted leaf: swap the warm kraft seam for the neutral painted step
    // (floor f). A kraft v-fold has no texture, so it keeps FOLD_SHADE_TINT
    // from material creation and never reaches here.
    materials.left.color.set(PAINTED_FOLD_SHADE)
    materials.left.needsUpdate = true
  }, [texture, materials])

  // Contact shadow, placed and weighted by the book's single key light
  // (shadow-light.ts): the base footprint offset DOWN-SCREEN-RIGHT and
  // deepened/spread by how high the piece stands at rest. Peak height comes
  // from one flat-open solve — pure math, computed once per piece.
  const shadow = useMemo(() => {
    const placement = shadowPlacement(layer)
    if (!placement) return null
    const rest = solveLayerPose(layer, parent, Math.PI, 0)
    const lift = shadowLift(peakHeight([rest.left, rest.right]))
    return {
      position: [
        placement.position[0] + lift.dx,
        placement.position[1],
        placement.position[2] + lift.dz,
      ] as [number, number, number],
      size: [placement.size[0] * lift.spread, placement.size[1] * lift.spread] as [number, number],
      maxOpacity: SHADOW_MAX_OPACITY * lift.depth,
    }
  }, [layer, parent])
  const shadowTexture = sharedShadowTexture()
  const shadowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    [shadowTexture]
  )

  useEffect(
    () => () => {
      geometries.right.dispose()
      geometries.left.dispose()
      materials.right.dispose()
      materials.left.dispose()
      shadowMaterial.dispose()
      // shadowTexture is a shared singleton — never disposed per-instance.
    },
    [geometries, materials, shadowMaterial]
  )

  useFrame(() => {
    const cutout = cutoutRef.current
    if (!cutout) return

    const f = frame.current
    // Role derived HERE, from the driver refs — never from a React prop.
    // At eased t=0 both turn roles coincide with their rest pose for either
    // direction (tilted A16 hand-off coincidence), so a transition frame
    // where the driver ref hasn't populated yet can never snap.
    const role = liveSpreadRole(spreadIndex, committedSpread.current, f?.dir ?? null)
    const { thetaL, thetaR } = spreadPageAnglesTilted(
      spreadIndex,
      committedSpread.current,
      f?.dir ?? null,
      f ? easeTurnWeighted(f.t) : 0
    )
    const beta = thetaL - thetaR

    const pose =
      role !== 'hidden' && beta > FLAT_EPSILON && texture !== null
        ? solvePose
          ? solvePose(thetaL, thetaR)
          : solveLayerPose(layer, parent, thetaL, thetaR)
        : null
    const visible = pose !== null
    cutout.visible = visible
    if (shadowRef.current) shadowRef.current.visible = visible && shadow !== null
    if (!pose) return

    if (rightMeshRef.current) writeQuad(geometries.right, pose.right)
    if (leftMeshRef.current) writeQuad(geometries.left, pose.left)

    // Contact shadow deepens as the piece stands — driven by the same
    // dihedral as the paper (one shared angle, benchmark B9/B11); its
    // elevation-weighted ceiling is baked into `shadow.maxOpacity`.
    shadowMaterial.opacity = (shadow?.maxOpacity ?? SHADOW_MAX_OPACITY) * Math.sin(beta / 2) ** 2
  })

  return (
    <>
      {/* renderOrder=0 (the three.js default, pinned explicitly) keeps the
          cutouts drawing after the gutter crease's renderOrder=-1 (see
          book.tsx) regardless of distance-based transparent sorting. */}
      <group ref={cutoutRef} visible={false}>
        <mesh ref={rightMeshRef} geometry={geometries.right} material={materials.right} renderOrder={0} />
        <mesh ref={leftMeshRef} geometry={geometries.left} material={materials.left} renderOrder={0} />
      </group>
      {/* Shadows take renderOrder=-1 with the gutter crease (D-G3 audit):
          every ground-shading plane draws before every piece of paper, so
          a shadow can never blend on top of a cutout mid-turn. */}
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

/** One spread's worth of pop-up layers. Always mounted (for the current
 *  spread ± 1) but only visible while `role !== 'hidden'`. Children find
 *  their parent in the same spread's layer list. */
export function PopupSpread({ layers, accents, spreadIndex, role, frame, committedSpread }: PopupSpreadProps) {
  return (
    <group visible={role !== 'hidden'} name={`popup-spread-${spreadIndex}`}>
      {layers.map((layer) => {
        if (layer.mech === 'box') {
          return (
            <BoxPopupLayer
              key={layer.id}
              layer={layer}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
            />
          )
        }
        if (layer.mech === 'platform') {
          return (
            <PlatformPopupLayer
              key={layer.id}
              layer={layer}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
            />
          )
        }
        if (layer.mech === 'tabpiece') {
          return (
            <TabPiecePopupLayer
              key={layer.id}
              layer={layer}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
            />
          )
        }
        if (layer.mech === 'knobtower') {
          return (
            <KnobTowerPopupLayer
              key={layer.id}
              layer={layer}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
            />
          )
        }
        if (layer.mech === 'keepsake') {
          return (
            <KeepsakePopupLayer
              key={layer.id}
              layer={layer}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
            />
          )
        }
        if (layer.mech === 'keepstack') {
          return (
            <KeepStackPopupLayer
              key={layer.id}
              layer={layer}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
            />
          )
        }
        if (layer.mech === 'keepwinch') {
          return (
            <KeepWinchPopupLayer
              key={layer.id}
              layer={layer}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
            />
          )
        }
        if (layer.mech === 'swarmarc') {
          return (
            <SwarmArcPopupLayer
              key={layer.id}
              layer={layer}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
            />
          )
        }
        if (layer.mech === 'skyline') {
          return (
            <KeepSkylinePopupLayer
              key={layer.id}
              layer={layer}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
            />
          )
        }
        // The nave rank renders through its own layer: host wings + die-cut
        // OA relief strata merged into ONE mesh/draw (popup-oanave.ts).
        if (layer.mech === 'oanave') {
          return (
            <OanavePopupLayer
              key={layer.id}
              layer={layer}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
            />
          )
        }
        if (layer.mech === 'depthvista') {
          return (
            <DepthVistaPopupLayer
              key={layer.id}
              layer={layer}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
            />
          )
        }
        // The pull-tab dissolve renders through its own layer (E2.2): the tab is
        // a grab handle, so it owns pointer wiring + the release snap. With no
        // drive it draws the dunes (tau=0) state.
        // The E3 s5 dune range: one card of k v-fold ranks + flat gussets,
        // one atlas, one mesh — its own layer owns the per-rank uv bands.
        if (layer.mech === 'mfoldrange') {
          return (
            <MFoldRangePopupLayer
              key={layer.id}
              layer={layer}
              accents={accents}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
            />
          )
        }
        // The E3 s4 rookery cliffs: a multi-storey page-rooted wall whose
        // storeys unroll top-down on their own beta cams — one merged mesh.
        if (layer.mech === 'stagedchain') {
          return (
            <StagedChainPopupLayer
              key={layer.id}
              layer={layer}
              accents={accents}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
            />
          )
        }
        // The E3 s4 round-4 dispatch line: the same chain, die-cut down to a
        // swooping cable, plus the basket the reader pushes along it.
        if (layer.mech === 'dispatchline') {
          return (
            <DispatchLinePopupLayer
              key={layer.id}
              layer={layer}
              accents={accents}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
            />
          )
        }
        if (layer.mech === 'dissolve') {
          return (
            <DissolvePopupLayer
              key={layer.id}
              layer={layer}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
            />
          )
        }
        // Strip flaps render through their own layer (D6): the flap is a grab
        // handle, so it owns pointer wiring + the release return. With no drive
        // the pose it draws is bit-identical to the generic two-panel layer's.
        if (layer.mech === 'stripflap') {
          return (
            <StripFlapPopupLayer
              key={layer.id}
              layer={layer}
              accents={accents}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
            />
          )
        }
        // A fan is k independent v-folds sharing one apex — each member renders
        // as an ordinary two-panel layer (identical geometry to solveFanPose).
        if (layer.mech === 'fan') {
          return (
            <group key={layer.id}>
              {fanMemberLayers(layer).map((member) => (
                <PopupLayer
                  key={member.id}
                  layer={member}
                  parent={undefined}
                  accents={accents}
                  spreadIndex={spreadIndex}
                  frame={frame}
                  committedSpread={committedSpread}
                />
              ))}
            </group>
          )
        }
        // A rider's "pages" are a box/platform/ground-swell patch pair;
        // solveRiderPose re-solves that parent's geometry each frame from
        // the layer alone.
        if (layer.mech === 'rider') {
          const seat = layers.find((l) => l.id === layer.parentId)
          if (!seat || (seat.mech !== 'box' && seat.mech !== 'platform' && seat.mech !== 'parallel'))
            return null
          return (
            <PopupLayer
              key={layer.id}
              layer={layer}
              parent={undefined}
              accents={accents}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
              solvePose={(thetaL, thetaR) => solveRiderPose(layer, seat, thetaL, thetaR)}
            />
          )
        }
        if (layer.mech === 'dress') {
          return (
            <DressPopupLayer
              key={layer.id}
              layer={layer}
              layers={layers}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
            />
          )
        }
        if (layer.mech === 'rotor') {
          return (
            <RotorPopupLayer
              key={layer.id}
              layer={layer}
              layers={layers}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
            />
          )
        }
        if (layer.mech === 'volvelle') {
          return (
            <VolvellePopupLayer
              key={layer.id}
              layer={layer}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
            />
          )
        }
        if (layer.mech === 'liftflap') {
          return (
            <LiftFlapPopupLayer
              key={layer.id}
              layer={layer}
              spreadIndex={spreadIndex}
              frame={frame}
              committedSpread={committedSpread}
            />
          )
        }
        return (
          <PopupLayer
            key={layer.id}
            layer={layer}
            parent={layer.mech === 'child' ? layers.find((l) => l.id === layer.parentId) : undefined}
            accents={accents}
            spreadIndex={spreadIndex}
            frame={frame}
            committedSpread={committedSpread}
          />
        )
      })}
    </group>
  )
}
