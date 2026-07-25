'use client'

/**
 * Renders one OANAVE rank (popup-oanave.ts, E3 s7 "The Northern Treasury"):
 * two host wing panels + the die-cut OA relief strata, ALL IN ONE MERGED
 * MESH — one geometry, one material, one draw. The relief is cut FROM the
 * painted sheet (zero glue), so every relief quad samples the exact atlas
 * region it was cut from: paint continuity across the cuts is automatic and
 * the strata add ZERO marginal draws (pack §5 budget headline).
 *
 * Die-cut silhouette (the apse dome scallop, the portal aperture) is alpha
 * in the painted art, exactly like the skyline flaps — no outline sidecar,
 * no extra cut-edge loop. Positions are DynamicDrawUsage buffers rewritten
 * each frame straight from the solver (liveSpreadRole /
 * spreadPageAnglesTilted / easeTurnWeighted — the one shared clock).
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { kraftTints } from './paper-stock'
import {
  liveSpreadRole,
  spreadPageAnglesTilted,
} from './popup-mechanics'
import { oanavePatches, oanavePatchCount, type OanaveGeom } from './popup-oanave'
import { easeTurnWeighted } from './page-geometry'
import { shadowLift } from './shadow-light'
import { sharedPaperTexture, sharedShadowTexture } from './shared-procedural-textures'
import type { TurnFrame } from './use-turn-driver'
import { useArtSprite } from './use-layer-texture'
import { applyUvRect } from '../art-atlas'

const FLAT_EPSILON = 0.02
const SHADOW_Y_LIFT = 0.001
const STRUCT_SHADOW_MAX = 0.22

export function OanavePopupLayer({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & OanaveGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const shadowRef = useRef<THREE.Mesh>(null)
  // Atlas-aware: the whole nave + clerk share ONE 1024 page (nave-atlas-s7);
  // the sprite rect remaps this rank's unit-square uv table into its region.
  // The T4 print-back sprite (flat shaded paper carrying the same die alpha,
  // never mirrored art) lives on the SAME page, so the back-face quads stay
  // inside the one texture upload — zero extra draws.
  const { texture: faceArt, rect } = useArtSprite(layer.id)
  const { rect: backRect } = useArtSprite(`${layer.id}-back`)
  const tint = useMemo(() => kraftTints(layer.id), [layer.id])

  // ONE merged geometry: every die patch twice — a FRONT quad wound toward
  // the painted side (left-hand faces flip their index winding so every
  // front quad faces the valley/camera side at rest) and a BACK quad wound
  // the other way sampling the print-back tint. UVs and the index are
  // static (the patch list is pose-independent); positions are rewritten
  // each frame from the solver.
  const quadCount = oanavePatchCount(layer)
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const positions = new THREE.BufferAttribute(new Float32Array(quadCount * 24), 3)
    positions.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('position', positions)
    const patches = oanavePatches(layer, Math.PI, 0)
    const frontUvs = new Float32Array(quadCount * 8)
    const backUvs = new Float32Array(quadCount * 8)
    patches.forEach((p, k) => {
      const [u0, v0, u1, v1] = p.uv
      // Quad corner order [inner@v0, outer@v0, outer@v1, inner@v1].
      frontUvs.set([u0, v0, u1, v0, u1, v1, u0, v1], k * 8)
      backUvs.set([u0, v0, u1, v0, u1, v1, u0, v1], k * 8)
    })
    const uvs = new Float32Array(quadCount * 16)
    uvs.set(applyUvRect(frontUvs, rect), 0)
    // A missing back sprite falls back to the face art (mirrored, the old
    // DoubleSide read) rather than sampling a wrong region.
    uvs.set(applyUvRect(backUvs, backRect ?? rect), quadCount * 8)
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    const index = new Uint16Array(quadCount * 12)
    patches.forEach((p, k) => {
      const flip = p.face === 'hostL' || p.face === 'reliefL'
      const f = k * 4
      const b = (quadCount + k) * 4
      index.set(flip ? [f, f + 2, f + 1, f, f + 3, f + 2] : [f, f + 1, f + 2, f, f + 2, f + 3], k * 6)
      index.set(flip ? [b, b + 1, b + 2, b, b + 2, b + 3] : [b, b + 2, b + 1, b, b + 3, b + 2], (quadCount + k) * 6)
    })
    g.setIndex(new THREE.BufferAttribute(index, 1))
    return g
    // eslint-disable-next-line react-hooks/exhaustive-deps -- geometry is sized by the (static) content entry + its atlas rects
  }, [layer.id, quadCount, rect, backRect])

  const paperTexture = sharedPaperTexture()
  // FrontSide: the geometry carries explicit front AND back quads (T4 —
  // the reverse of the sheet is shaded paper, not mirrored art).
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        side: THREE.FrontSide,
        color: '#ffffff',
        transparent: true,
        alphaTest: 0.1,
      }),
    []
  )
  useEffect(() => {
    material.map = faceArt ?? paperTexture
    material.transparent = !!faceArt
    material.alphaTest = faceArt ? 0.1 : 0
    material.color.set(faceArt ? '#ffffff' : tint.lit)
    if (faceArt) {
      faceArt.wrapS = THREE.ClampToEdgeWrapping
      faceArt.wrapT = THREE.ClampToEdgeWrapping
    }
    material.needsUpdate = true
  }, [faceArt, paperTexture, material, tint])

  const shadowTexture = sharedShadowTexture()
  const shadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 }),
    [shadowTexture]
  )
  const shadowSpec = useMemo(() => {
    const lift = shadowLift(layer.height)
    return {
      position: [0 + lift.dx, SHADOW_Y_LIFT, layer.apexZ + lift.dz] as [number, number, number],
      size: [layer.width * 1.05 * lift.spread, Math.max(0.1, layer.height * 0.5) * lift.spread] as [number, number],
      maxOpacity: STRUCT_SHADOW_MAX * lift.depth,
    }
  }, [layer])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(
    () => () => {
      material.dispose()
      shadowMaterial.dispose()
    },
    [material, shadowMaterial]
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
    const visible = role !== 'hidden' && beta > FLAT_EPSILON
    group.visible = visible
    if (shadowRef.current) shadowRef.current.visible = visible
    if (!visible) return
    const patches = oanavePatches(layer, thetaL, thetaR)
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    const backBase = patches.length * 12
    patches.forEach((p, k) => {
      for (let c = 0; c < 4; c++) {
        arr[k * 12 + c * 3] = p.quad[c][0]
        arr[k * 12 + c * 3 + 1] = p.quad[c][1]
        arr[k * 12 + c * 3 + 2] = p.quad[c][2]
        arr[backBase + k * 12 + c * 3] = p.quad[c][0]
        arr[backBase + k * 12 + c * 3 + 1] = p.quad[c][1]
        arr[backBase + k * 12 + c * 3 + 2] = p.quad[c][2]
      }
    })
    attr.needsUpdate = true
    geometry.computeBoundingSphere()
    shadowMaterial.opacity = shadowSpec.maxOpacity * Math.min(1, Math.sin(beta / 2) * 1.2)
  })

  return (
    <>
      <group ref={groupRef} visible={false} name={`oanave-${layer.id}`}>
        <mesh geometry={geometry} material={material} renderOrder={0} />
      </group>
      <mesh
        ref={shadowRef}
        position={shadowSpec.position}
        rotation={[-Math.PI / 2, 0, 0]}
        material={shadowMaterial}
        renderOrder={-1}
        visible={false}
      >
        <planeGeometry args={shadowSpec.size} />
      </mesh>
    </>
  )
}
