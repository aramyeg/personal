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
import { useGuardedDispose } from './material-pool'
import { liveSpreadRole, spreadPageAnglesTilted, type TurnStage, type PanelQuad } from './popup-mechanics'
import { solveSkylineRow, keepSkylineEnvelope, type KeepSkylineGeom } from './popup-skyline'
import { kraftTints } from './paper-stock'
import { easeTurnWeighted } from './page-geometry'
import { shadowLift } from './shadow-light'
import { sharedPaperTexture, sharedShadowTexture } from './shared-procedural-textures'
import type { TurnFrame } from './use-turn-driver'
import { useArtSprite } from './use-layer-texture'
import { applyUvRect, type UvRect } from '../art-atlas'
import { useLayerOutline, type Outline } from './use-layer-outline'

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

// SHAPED-MESH path (E2.1). When a code-generated outline sidecar exists, the
// flat renders as the art's TRUE silhouette instead of an alpha-tested
// rectangle: triangulate the normalized [0,1]^2 outline once (THREE's own
// earcut — the same triangulator ShapeGeometry uses), UV = the outline verbatim
// (identity: u along the radial base, v up the flap, matching ROW_UVS), and each
// frame place every vertex by BILINEARLY interpolating the SAME four solver
// corners writeQuad uses. Zero solver change; and because a bilinear combination
// with u,v in [0,1] is a convex combination of the four corners, every shaped
// vertex stays inside the solver quad — fold-flat + wedge containment are
// inherited (proven per-slot in .superpowers/sdd/bench/procart-outline-bench.mjs).
export function makeShapedGeometry(outline: Outline, rect: UvRect | null = null): THREE.BufferGeometry {
  const n = outline.length
  const contour = outline.map(([u, v]) => new THREE.Vector2(u, v))
  const faces = THREE.ShapeUtils.triangulateShape(contour, [])
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(n * 3), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  const uv = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    uv[i * 2] = outline[i][0]
    uv[i * 2 + 1] = outline[i][1]
  }
  geometry.setAttribute('position', positions)
  // INFRA-1: the outline IS the uv table (identity), so an atlas-backed strip
  // remaps it into its region with the same affine pass every other layer uses.
  // The POSITION write below is untouched — it interpolates the solver corners
  // by the outline's own u,v, which is what inherits the containment proof.
  geometry.setAttribute('uv', new THREE.BufferAttribute(applyUvRect(uv, rect), 2))
  const index: number[] = []
  for (const [a, b, c] of faces) index.push(a, b, c)
  geometry.setIndex(index)
  return geometry
}

export function writeShapedQuad(geometry: THREE.BufferGeometry, quad: PanelQuad, outline: Outline): void {
  const attr = geometry.getAttribute('position') as THREE.BufferAttribute
  const arr = attr.array as Float32Array
  const [c0, c1, c2, c3] = quad // [base-inner (0,0), base-outer (1,0), top-outer (1,1), top-inner (0,1)]
  for (let i = 0; i < outline.length; i++) {
    const u = outline[i][0]
    const v = outline[i][1]
    const w0 = (1 - u) * (1 - v)
    const w1 = u * (1 - v)
    const w2 = u * v
    const w3 = (1 - u) * v
    arr[i * 3] = w0 * c0[0] + w1 * c1[0] + w2 * c2[0] + w3 * c3[0]
    arr[i * 3 + 1] = w0 * c0[1] + w1 * c1[1] + w2 * c2[1] + w3 * c3[1]
    arr[i * 3 + 2] = w0 * c0[2] + w1 * c1[2] + w2 * c2[2] + w3 * c3[2]
  }
  attr.needsUpdate = true
  geometry.computeBoundingSphere()
}

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
  const { texture: faceArt, rect } = useArtSprite(`${layer.id}-mound${k}`)
  // The code-generated shaped-mesh contour, or null until it loads / when no
  // sidecar exists — in which case we keep the original rectangle quad.
  const outline = useLayerOutline(`${layer.id}-mound${k}`)
  const tint = useMemo(() => kraftTints(`${layer.id}-mound${k}`), [layer.id, k])
  const readAngles = usePageAngles(spreadIndex, frame, committedSpread, layer.stage)
  const row = layer.rows[k]

  // Rebuilt when the atlas rect resolves (it arrives a frame or two after the
  // outline), so the uvs address this row's region of the shared flank page.
  const geometry = useMemo(
    () => (outline ? makeShapedGeometry(outline, rect) : makeQuadGeometry(applyUvRect(ROW_UVS, rect))),
    [outline, rect]
  )
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

  // Geometry disposal is keyed on geometry ALONE: the shaped path swaps the
  // geometry when the outline loads, and this must dispose only the OLD
  // geometry — not the still-live materials (which never change identity).
  useEffect(() => () => geometry.dispose(), [geometry])
  useGuardedDispose([material, shadowMaterial])

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const { role, thetaL, thetaR, beta } = readAngles()
    const visible = role !== 'hidden' && beta > FLAT_EPSILON
    group.visible = visible
    if (shadowGroupRef.current) shadowGroupRef.current.visible = visible
    if (!visible) return
    const quad = solveSkylineRow(layer, row, thetaL, thetaR)
    if (outline) writeShapedQuad(geometry, quad, outline)
    else writeQuad(geometry, quad)
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
