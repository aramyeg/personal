'use client'

/**
 * A pop-up book spread: one v-fold paper mechanism per `SceneLayer`, posed
 * every frame by the pure closed-form solver in popup-mechanics.ts. Each
 * piece is glued to BOTH pages of its spread, so its pose is a function of
 * nothing but the spread's dihedral angle:
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
 * No springs, no timers, no per-layer easing: one shared driving angle,
 * like real glued paper (benchmark B9). Mounted by book.tsx for the current
 * spread ± 1 so neighboring textures are warm before you turn to them.
 *
 * Convention (matches page-geometry.ts): the enclosing group sits at the
 * open page's surface height, so a layer's local y=0 is the page plane;
 * the spine runs along z at x=0.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { makeShadowCanvas } from '../procedural/paper-texture'
import { makeCanvasTexture } from './book'
import {
  solveVFold,
  spreadPageAngles,
  type PanelQuad,
  type SpreadRole,
  type VFoldSpec,
} from './popup-mechanics'
import { easeTurnWeighted } from './page-geometry'
import type { TurnFrame } from './use-turn-driver'
import { useLayerTexture } from './use-layer-texture'

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

/** A pop-up spread's relationship to any turn currently in flight. */
export type PopupRole = 'current' | 'outgoing' | 'incoming' | 'hidden'

type PopupSpreadProps = {
  layers: readonly SceneLayer[]
  accents: readonly string[]
  spreadIndex: number
  role: PopupRole
  frame: RefObject<TurnFrame | null>
}

const toSpec = (layer: SceneLayer): VFoldSpec => ({
  apexZ: layer.apexZ,
  vDir: layer.vDir,
  phi: (layer.phiDeg * Math.PI) / 180,
  rho: (layer.rhoDeg * Math.PI) / 180,
  width: layer.width,
  height: layer.height,
})

/** 4-corner quad geometry with fixed uvs selecting one art half; positions
 *  are rewritten from the solver every frame. u runs 0.5 at the central
 *  crease to `uOuter` at the glue edge, so the print continues seamlessly
 *  across the fold (benchmark B6). */
function makePanelGeometry(uOuter: 0 | 1): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(12), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  // corner order matches PanelQuad: [apex, bottom-outer, top-outer, top-inner]
  geometry.setAttribute(
    'uv',
    new THREE.BufferAttribute(new Float32Array([0.5, 0, uOuter, 0, uOuter, 1, 0.5, 1]), 2)
  )
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

function PopupLayer({
  layer,
  accents,
  role,
  frame,
}: {
  layer: SceneLayer
  accents: readonly string[]
  role: PopupRole
  frame: RefObject<TurnFrame | null>
}) {
  const texture = useLayerTexture(layer.id, layer.kind, accents)
  const spec = useMemo(() => toSpec(layer), [layer])
  const cutoutRef = useRef<THREE.Group>(null)
  const shadowRef = useRef<THREE.Mesh>(null)
  const rightMeshRef = useRef<THREE.Mesh>(null)
  const leftMeshRef = useRef<THREE.Mesh>(null)

  const geometries = useMemo(
    () => ({ right: makePanelGeometry(1), left: makePanelGeometry(0) }),
    []
  )

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
    materials.left.needsUpdate = true
  }, [texture, materials])

  const shadowCanvas = useMemo(() => makeShadowCanvas(), [])
  const shadowTexture = useMemo(() => makeCanvasTexture(shadowCanvas), [shadowCanvas])
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
      shadowTexture.dispose()
      shadowMaterial.dispose()
    },
    [geometries, materials, shadowTexture, shadowMaterial]
  )

  useFrame(() => {
    const cutout = cutoutRef.current
    const shadow = shadowRef.current
    if (!cutout || !shadow) return

    const f = frame.current
    // At eased t=0 both turn roles coincide with their rest/flat pose for
    // either direction, so a transition frame where the driver ref hasn't
    // populated yet can never snap (see popup-mechanics.test.ts, A7).
    const solveRole: SpreadRole = role === 'hidden' ? 'current' : role
    const { thetaL, thetaR } = spreadPageAngles(
      solveRole,
      f?.dir ?? null,
      f ? easeTurnWeighted(f.t) : 0
    )
    const beta = thetaL - thetaR

    const visible = role !== 'hidden' && beta > FLAT_EPSILON && texture !== null
    cutout.visible = visible
    shadow.visible = visible
    if (!visible) return

    const pose = solveVFold(spec, thetaL, thetaR)
    if (rightMeshRef.current) writeQuad(geometries.right, pose.right)
    if (leftMeshRef.current) writeQuad(geometries.left, pose.left)

    // Contact shadow deepens as the piece stands — driven by the same
    // dihedral as the paper (one shared angle, benchmark B9/B11).
    shadowMaterial.opacity = SHADOW_MAX_OPACITY * Math.sin(beta / 2) ** 2
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
      <mesh
        ref={shadowRef}
        position={[0, SHADOW_Y_LIFT, layer.apexZ + layer.vDir * 0.04]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={shadowMaterial}
        renderOrder={0}
        visible={false}
      >
        <planeGeometry args={[layer.width * 0.9, SHADOW_HEIGHT]} />
      </mesh>
    </>
  )
}

/** One spread's worth of pop-up layers. Always mounted (for the current
 *  spread ± 1) but only visible while `role !== 'hidden'`. */
export function PopupSpread({ layers, accents, spreadIndex, role, frame }: PopupSpreadProps) {
  return (
    <group visible={role !== 'hidden'} name={`popup-spread-${spreadIndex}`}>
      {layers.map((layer) => (
        <PopupLayer key={layer.id} layer={layer} accents={accents} role={role} frame={frame} />
      ))}
    </group>
  )
}
