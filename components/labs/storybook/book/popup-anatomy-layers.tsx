'use client'

/**
 * The two anatomy mechs that don't map onto an existing renderer as-is:
 *
 *  - FAN (`fanMemberLayers`): pure composition — each member IS the shipped
 *    v-fold (solveFanPose maps every member through solveVFoldPose), so a
 *    fan renders as N synthesized v-fold SceneLayers routed through the
 *    ordinary two-panel PopupLayer. Nothing new to solve or draw; the
 *    member art follows the `${id}-m${index}` convention automatically
 *    because each synthesized layer carries that id.
 *
 *  - DRESS (`DressPopupLayer`): a rigid, non-kinematic silhouette quad glued
 *    flat onto one parent surface, allowed to overhang (the Sabuda recipe).
 *    It rides its parent, so it casts no page-contact shadow of its own. The
 *    front prints the die-cut alpha art; the back is the raw kraft underside
 *    of the same cut sheet (the art's alpha, tinted kraft, so an overhang
 *    reads as cut paper rather than a rectangular slab).
 *
 *  - ROTOR (`RotorPopupLayer`): the KINETIC sibling of the dress patch — the
 *    SAME seat resolution and riding lift, but the disc quad SPINS about its
 *    hub by a designed cam of the dihedral (popup-rotor.ts). Rides its parent
 *    coplanar, so it casts no page-contact shadow either. Its placeholder is a
 *    spoked disc so the rotation reads even in kraft.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { kraftTints } from './paper-stock'
import { sharedPaperTexture, sharedRotorTexture } from './shared-procedural-textures'
import {
  liveSpreadRole,
  solveBoxPose,
  solveLayerPose,
  spreadPageAnglesTilted,
  type FanGeom,
  type DressGeom,
  type RotorGeom,
  type PanelQuad,
} from './popup-mechanics'
import { solveDressPose, solvePlatformPose } from './popup-anatomy'
import { solveRotorPose } from './popup-rotor'
import { easeTurnWeighted } from './page-geometry'
import type { TurnFrame } from './use-turn-driver'
import { useArtSprite } from './use-layer-texture'
import { applyUvRect, type UvRect } from '../art-atlas'

const FLAT_EPSILON = 0.02

/** Synthesizes one v-fold SceneLayer per fan member — identical geometry to
 *  solveFanPose (which is itself member -> solveVFoldPose), so the members
 *  route cleanly through the ordinary two-panel renderer, each carrying the
 *  `${id}-m${index}` art id. */
export function fanMemberLayers(layer: SceneLayer & FanGeom): readonly SceneLayer[] {
  return layer.members.map((member, index) => ({
    id: `${layer.id}-m${index}`,
    kind: layer.kind,
    role: layer.role,
    mech: 'vfold' as const,
    apexZ: layer.apexZ,
    vDir: layer.vDir,
    phiDeg: member.phiDeg,
    rhoDeg: member.rhoDeg,
    skewDeg: member.skewDeg,
    creaseU: member.creaseU,
    width: member.width,
    height: member.height,
  }))
}

/** The dress's seat quad from its parent's solved pose. Two-panel parents
 *  expose 'left'/'right' panels; boxes a BoxFace; platforms a PlatformFace
 *  (bay 0 when a seat rank has several bays). Returns null for an
 *  unresolvable seat rather than throwing inside the render loop. */
function solveSeatQuad(
  parent: SceneLayer,
  grandParent: SceneLayer | undefined,
  seat: string,
  thetaL: number,
  thetaR: number
): PanelQuad | null {
  if (parent.mech === 'box') {
    const patch = solveBoxPose(parent, thetaL, thetaR).find((p) => p.face === seat)
    return patch ? patch.quad : null
  }
  if (parent.mech === 'platform') {
    const patch = solvePlatformPose(parent, thetaL, thetaR).find((p) => p.face === seat && p.bay === 0)
    return patch ? patch.quad : null
  }
  if (parent.mech === 'vfold' || parent.mech === 'parallel' || parent.mech === 'child') {
    const pose = solveLayerPose(parent, grandParent, thetaL, thetaR)
    return seat === 'left' ? pose.left : pose.right
  }
  return null
}

/** The single quad both a dress patch and a rotor disc draw: identity uvs
 *  remapped into the piece's atlas region when it has one (INFRA-2), positions
 *  rewritten from the solver every frame. */
function makePatchGeometry(rect: UvRect | null): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(12), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  g.setAttribute('position', positions)
  g.setAttribute('uv', new THREE.BufferAttribute(applyUvRect(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), rect), 2))
  g.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1))
  return g
}

export function DressPopupLayer({
  layer,
  layers,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & DressGeom
  layers: readonly SceneLayer[]
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const { texture: art, rect } = useArtSprite(layer.id)
  // This piece's own stock (D3 kraft-legibility package): replaces the
  // shared PAPER_TINT/PAPER_SHADE_TINT pair so a mid-turn tangle of several
  // artless dress patches separates by tone instead of reading as one mass.
  const tint = useMemo(() => kraftTints(layer.id), [layer.id])

  // The seat surface, and (if that parent is itself a cascaded child) its own
  // parent — both needed to re-solve the seat quad every frame.
  const { parent, grandParent } = useMemo(() => {
    const p = layers.find((l) => l.id === layer.parentId)
    const gp = p?.mech === 'child' ? layers.find((l) => l.id === p.parentId) : undefined
    return { parent: p, grandParent: gp }
  }, [layers, layer.parentId])

  const geometry = useMemo(() => makePatchGeometry(rect), [rect])

  const paperTexture = sharedPaperTexture()
  const materials = useMemo(
    () => ({
      front: new THREE.MeshBasicMaterial({ side: THREE.FrontSide, transparent: true, alphaTest: 0.1, color: '#ffffff' }),
      back: new THREE.MeshBasicMaterial({ side: THREE.BackSide, transparent: true, alphaTest: 0.1, color: tint.shade }),
    }),
    [tint]
  )

  useEffect(() => {
    const texture = art ?? paperTexture
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
  }, [art, paperTexture, materials, tint])

  useEffect(
    () => () => {
      geometry.dispose()
      materials.front.dispose()
      materials.back.dispose()
      // paperTexture is a shared singleton — never disposed per-instance.
    },
    [geometry, materials]
  )

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const f = frame.current
    // Role from the driver refs, never a React prop (see liveSpreadRole).
    const role = liveSpreadRole(spreadIndex, committedSpread.current, f?.dir ?? null)
    const { thetaL, thetaR } = spreadPageAnglesTilted(
      spreadIndex,
      committedSpread.current,
      f?.dir ?? null,
      f ? easeTurnWeighted(f.t) : 0
    )
    const beta = thetaL - thetaR

    const seat =
      parent && role !== 'hidden' && beta > FLAT_EPSILON
        ? solveSeatQuad(parent, grandParent, layer.seat, thetaL, thetaR)
        : null
    group.visible = seat !== null
    if (!seat) return

    const quad = solveDressPose(layer, seat)
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    for (let i = 0; i < 4; i++) {
      arr[i * 3] = quad[i][0]
      arr[i * 3 + 1] = quad[i][1]
      arr[i * 3 + 2] = quad[i][2]
    }
    attr.needsUpdate = true
    geometry.computeBoundingSphere()
  })

  return (
    <group ref={groupRef} visible={false}>
      <mesh geometry={geometry} material={materials.front} renderOrder={0} />
      <mesh geometry={geometry} material={materials.back} renderOrder={0} />
    </group>
  )
}

export function RotorPopupLayer({
  layer,
  layers,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & RotorGeom
  layers: readonly SceneLayer[]
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const { texture: art, rect } = useArtSprite(layer.id)
  const tint = useMemo(() => kraftTints(layer.id), [layer.id])

  const { parent, grandParent } = useMemo(() => {
    const p = layers.find((l) => l.id === layer.parentId)
    const gp = p?.mech === 'child' ? layers.find((l) => l.id === p.parentId) : undefined
    return { parent: p, grandParent: gp }
  }, [layers, layer.parentId])

  const geometry = useMemo(() => makePatchGeometry(rect), [rect])

  // Placeholder is a spoked DISC (not a paper square) so the spin reads before
  // real art lands; its transparent corners keep the die-cut circular.
  const discTexture = sharedRotorTexture()
  const materials = useMemo(
    () => ({
      front: new THREE.MeshBasicMaterial({ side: THREE.FrontSide, transparent: true, alphaTest: 0.1, color: '#ffffff' }),
      back: new THREE.MeshBasicMaterial({ side: THREE.BackSide, transparent: true, alphaTest: 0.1, color: tint.shade }),
    }),
    [tint]
  )

  useEffect(() => {
    const texture = art ?? discTexture
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
  }, [art, discTexture, materials, tint])

  useEffect(
    () => () => {
      geometry.dispose()
      materials.front.dispose()
      materials.back.dispose()
      // discTexture is a shared singleton — never disposed per-instance.
    },
    [geometry, materials]
  )

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

    const seat =
      parent && role !== 'hidden' && beta > FLAT_EPSILON
        ? solveSeatQuad(parent, grandParent, layer.seat, thetaL, thetaR)
        : null
    group.visible = seat !== null
    if (!seat) return

    const quad = solveRotorPose(layer, seat, beta)
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    for (let i = 0; i < 4; i++) {
      arr[i * 3] = quad[i][0]
      arr[i * 3 + 1] = quad[i][1]
      arr[i * 3 + 2] = quad[i][2]
    }
    attr.needsUpdate = true
    geometry.computeBoundingSphere()
  })

  return (
    <group ref={groupRef} visible={false}>
      <mesh geometry={geometry} material={materials.front} renderOrder={0} />
      <mesh geometry={geometry} material={materials.back} renderOrder={0} />
    </group>
  )
}
