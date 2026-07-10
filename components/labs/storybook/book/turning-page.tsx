'use client'

/**
 * The single page currently mid-turn: a segmented quad whose vertices are
 * curled every frame via page-geometry's math, plus a cheap traveling shade
 * plane standing in for the shadow a lifting page casts on the page beneath
 * it. Mounted once and left in the scene permanently (procedural texture
 * generation isn't free) — only the meshes' `visible` flags toggle per
 * frame, driven by the turn driver ref. Cover turns are animated entirely
 * by book.tsx's front-cover pivot, so this page stays hidden whenever
 * `frame.isCover`.
 *
 * Task 18: two meshes share one live geometry — a FrontSide mesh in the
 * regular paper material, and a BackSide mesh in a darker tint standing in
 * for the page's underside. Both read the same BufferAttribute (one
 * curlPositionsPhased call updates it for both), so as the page curls past
 * ~90° the camera starts seeing the BackSide mesh's back-facing triangles
 * instead of the front's — a two-material trick that reads as paper with
 * real thickness rather than a lit, glowing film.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PAGE_H, PAGE_W, buildPageTemplate, curlPositionsPhased, easeTurnWeighted } from './page-geometry'
import { makeCanvasTexture } from './book'
import { makePaperCanvas } from '../procedural/paper-texture'
import type { TurnFrame } from './use-turn-driver'

const SHADE_WIDTH = PAGE_W * 0.7
const SHADE_LIFT = 0.003
const SHADE_MAX_OPACITY = 0.34
// Shapes the shade's opacity so it peaks a little past mid-turn (t≈0.59)
// instead of dead-center — the page has more of its underside exposed to
// the stack below it on the way down than on the way up.
const SHADE_PEAK_EXPONENT = 1.3
const BACK_TINT = '#4a3a2c'

export function TurningPage({
  frame,
  originY,
  frontMap = null,
  backMap = null,
}: {
  frame: RefObject<TurnFrame | null>
  /** World-space Y of the stack this page is currently departing from
   *  (matches the static page it was, per book.tsx's own height formula). */
  originY: number
  /** v2 printed faces (book.tsx picks the right print halves per turn
   *  direction): the face this sheet was showing when it lifted, and the
   *  face it lands as. Falls back to plain paper when a print hasn't
   *  resolved. The back map arrives pre-mirrored (a `left` half from
   *  use-page-print.ts), matching the landed pose's spine-out uv run. */
  frontMap?: THREE.Texture | null
  backMap?: THREE.Texture | null
}) {
  const meshRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>(null)
  const backMeshRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>(null)
  const shadeRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>(null)
  const templateRef = useRef<Float32Array | null>(null)

  const paperCanvas = useMemo(() => makePaperCanvas(), [])
  const paperTexture = useMemo(() => makeCanvasTexture(paperCanvas), [paperCanvas])
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: paperTexture,
        roughness: 0.9,
        side: THREE.FrontSide,
      }),
    [paperTexture]
  )
  // The page's underside: same paper grain, tinted dark and rougher so the
  // curl reads as paper with real thickness rather than a lit, glowing
  // film. BackSide so it only ever draws the triangles FrontSide culls —
  // together the two meshes cover the whole page with no overlap/z-fight.
  const backMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: paperTexture,
        color: BACK_TINT,
        roughness: 0.97,
        side: THREE.BackSide,
      }),
    [paperTexture]
  )
  const shadeMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#0d0805',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    []
  )

  useEffect(
    () => () => {
      paperTexture.dispose()
      material.dispose()
      backMaterial.dispose()
      shadeMaterial.dispose()
    },
    [paperTexture, material, backMaterial, shadeMaterial]
  )

  // Swap the printed faces in as book.tsx resolves them (between turns, not
  // mid-flight — the maps only change when `turning` flips). With a printed
  // back the underside tint relaxes to a mild shade: at landing that face
  // *is* the next left page, and a heavy tint would visibly pop when the
  // untinted static page takes over at commit.
  useEffect(() => {
    material.map = frontMap ?? paperTexture
    material.needsUpdate = true
    backMaterial.map = backMap ?? paperTexture
    backMaterial.color.set(backMap ? '#b9ad99' : BACK_TINT)
    backMaterial.needsUpdate = true
  }, [material, backMaterial, frontMap, backMap, paperTexture])

  // Builds a private geometry (never shared with the static pages' geometry
  // — its position attribute is rewritten every frame) before first paint,
  // so the very first r3f render tick never sees a geometry-less mesh. Both
  // the front and back meshes share this exact geometry instance, so the
  // one curlPositionsPhased call below updates both at once.
  useLayoutEffect(() => {
    const { positions, uvs, indices } = buildPageTemplate()
    templateRef.current = positions
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    if (meshRef.current) meshRef.current.geometry = geometry
    if (backMeshRef.current) backMeshRef.current.geometry = geometry
    return () => geometry.dispose()
  }, [])

  useFrame(() => {
    const mesh = meshRef.current
    const backMesh = backMeshRef.current
    const shade = shadeRef.current
    const template = templateRef.current
    if (!mesh || !backMesh || !shade || !template) return

    const f = frame.current
    const active = f !== null && !f.isCover
    mesh.visible = active
    backMesh.visible = active
    shade.visible = active
    if (!active || !f) return

    const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    curlPositionsPhased(template, posAttr.array as Float32Array, f.t, f.dir, easeTurnWeighted)
    posAttr.needsUpdate = true
    mesh.geometry.computeVertexNormals()

    const tClamped = Math.min(1, Math.max(0, f.t))
    shade.material.opacity = SHADE_MAX_OPACITY * Math.sin(Math.PI * Math.pow(tClamped, SHADE_PEAK_EXPONENT))
    // Sweeps from the spine (x=0) out toward the free edge on the side the
    // page is departing toward: +X for 'next' (trailing shadow falls to the
    // right, under the still-flat right stack), mirrored to -X for 'prev'
    // (the page is curling back down onto the left stack instead).
    const sweep = Math.cos(Math.PI * easeTurnWeighted(f.t)) * (PAGE_W / 2)
    shade.position.x = f.dir === 'next' ? sweep : -sweep
  })

  return (
    <>
      <mesh ref={meshRef} position={[0, originY, 0]} material={material} visible={false} />
      <mesh ref={backMeshRef} position={[0, originY, 0]} material={backMaterial} visible={false} />
      <mesh
        ref={shadeRef}
        position={[0, originY - SHADE_LIFT, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={shadeMaterial}
        visible={false}
      >
        <planeGeometry args={[SHADE_WIDTH, PAGE_H]} />
      </mesh>
    </>
  )
}
