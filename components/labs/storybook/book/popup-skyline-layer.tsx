'use client'

/**
 * Renders the CITADEL RANK (popup-skyline.ts): per outer page, a few low
 * +z-facing city-skyline ROWS — single-page cammed flaps hinged on a radial
 * line, standing up as the book opens (page-driven envelope, no knob). Each row
 * is ONE die-cut flap carrying the full roofline art (alpha-tested silhouette,
 * DoubleSide so the reader reads it from the front while the back rides the
 * distance), kraft fallback when unpainted, plus a contact shadow scaled by the
 * flap's own stand. The old prism mound (two slopes over a spine-running ridge)
 * read END-ON; this reorientation faces the reader.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { liveSpreadRole, spreadPageAnglesTilted, type PanelQuad } from './popup-mechanics'
import { solveSkylineRow, keepSkylineEnvelope, type KeepSkylineGeom } from './popup-skyline'
import { kraftTints } from './paper-stock'
import { easeTurnWeighted } from './page-geometry'
import { shadowLift } from './shadow-light'
import { sharedPaperTexture, sharedShadowTexture } from './shared-procedural-textures'
import type { TurnFrame } from './use-turn-driver'
import { useArtTexture } from './use-layer-texture'

const FLAT_EPSILON = 0.02
const SHADOW_Y_LIFT = 0.001
const STRUCT_SHADOW_MAX = 0.22
const rad = (d: number): number => (d * Math.PI) / 180

// Roofline flap uvs: u along the radial base (0 inner -> 1 outer), v up the flap
// (0 hinge -> 1 roofline crest), matching solveSkylineRow's corner order
// [base-inner, base-outer, top-outer, top-inner].
const ROW_UVS = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])

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

function usePageAngles(
  spreadIndex: number,
  frame: RefObject<TurnFrame | null>,
  committedSpread: RefObject<number>
): () => { role: ReturnType<typeof liveSpreadRole>; thetaL: number; thetaR: number; beta: number } {
  return () => {
    const f = frame.current
    const role = liveSpreadRole(spreadIndex, committedSpread.current, f?.dir ?? null)
    const { thetaL, thetaR } = spreadPageAnglesTilted(
      spreadIndex,
      committedSpread.current,
      f?.dir ?? null,
      f ? easeTurnWeighted(f.t) : 0
    )
    return { role, thetaL, thetaR, beta: thetaL - thetaR }
  }
}

function SkylineRow({
  layer,
  k,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & KeepSkylineGeom
  k: number
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const shadowGroupRef = useRef<THREE.Group>(null)
  const faceArt = useArtTexture(`${layer.id}-mound${k}`)
  const tint = useMemo(() => kraftTints(`${layer.id}-mound${k}`), [layer.id, k])
  const readAngles = usePageAngles(spreadIndex, frame, committedSpread)
  const row = layer.rows[k]

  const geometry = useMemo(() => makeQuadGeometry(new Float32Array(ROW_UVS)), [])
  const paperTexture = sharedPaperTexture()
  // ONE die-cut flap: the full roofline art (alpha-tested silhouette), DoubleSide
  // so the reader reads the front face regardless of the flap's winding as it
  // leans, and the transparent sky above the roofline shows through the cut.
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: '#ffffff', transparent: true, alphaTest: 0.1 }),
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
    const sign = layer.side === 'left' ? -1 : 1
    const peak = row.height * Math.sin(rad(row.standDeg))
    const lift = shadowLift(peak)
    const centerD = row.F + row.width / 2
    return {
      position: [sign * centerD + lift.dx, SHADOW_Y_LIFT, row.zc + lift.dz] as [number, number, number],
      size: [row.width * 1.05 * lift.spread, Math.max(0.08, row.height) * 1.2 * lift.spread] as [number, number],
      maxOpacity: STRUCT_SHADOW_MAX * lift.depth,
    }
  }, [layer, row])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
      shadowMaterial.dispose()
    },
    [geometry, material, shadowMaterial]
  )

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const { role, thetaL, thetaR, beta } = readAngles()
    const visible = role !== 'hidden' && beta > FLAT_EPSILON
    group.visible = visible
    if (shadowGroupRef.current) shadowGroupRef.current.visible = visible
    if (!visible) return
    writeQuad(geometry, solveSkylineRow(layer, row, thetaL, thetaR))
    shadowMaterial.opacity = shadowSpec.maxOpacity * keepSkylineEnvelope(layer, beta)
  })

  return (
    <>
      <group ref={groupRef} visible={false}>
        {/* die-cut silhouette (alpha): no rectangular cut-edge loop — it would
            draw a box around the roofline cutout. */}
        <mesh geometry={geometry} material={material} renderOrder={0} />
      </group>
      <group ref={shadowGroupRef} visible={false}>
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

export function KeepSkylinePopupLayer({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & KeepSkylineGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  return (
    <group name={`skyline-${layer.id}`}>
      {layer.rows.map((_, k) => (
        <SkylineRow
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
