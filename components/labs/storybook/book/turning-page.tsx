'use client'

/**
 * The single page currently mid-turn: RIGID card stock rotating about the
 * spine (the z axis), exactly like a real pop-up book page — pop-up pages
 * are stiff cover stock and bend only at crease lines (rigid-panel /
 * compliant-crease model; see the construction research doc §2 and
 * benchmark B8). Its angle is `sheetAngle(dir, easedT)`, the SAME value
 * popup-mechanics.ts uses as the moving page of both affected spreads'
 * dihedrals — the sheet and the paper glued to it are geared to one
 * number, so they can never desynchronize.
 *
 * Mounted once and left in the scene permanently; only the meshes'
 * `visible` flags toggle per frame, driven by the turn driver ref. Cover
 * turns are animated by book.tsx's front-cover pivot, so this page stays
 * hidden whenever `frame.isCover`.
 *
 * Two meshes share one flat geometry — a FrontSide mesh showing the face
 * the sheet lifted with, and a BackSide mesh for the face it lands as. As
 * the page passes vertical the camera stops seeing front-facing triangles
 * and starts seeing back-facing ones, so the swap point is geometric, not
 * timed. A cheap traveling shade plane stands in for the shadow the
 * lifting page casts on the stack beneath it.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PAGE_H, PAGE_W, buildPageTemplate, easeTurnWeighted } from './page-geometry'
import { sheetAngle } from './popup-mechanics'
import { makeCanvasTexture } from './book'
import { makePaperCanvas } from '../procedural/paper-texture'
import type { TurnFrame } from './use-turn-driver'

const SHADE_WIDTH = PAGE_W * 0.7
const SHADE_LIFT = 0.003
const SHADE_MAX_OPACITY = 0.34
// Shapes the shade's opacity so it peaks a little past mid-turn (t≈0.59):
// the page exposes more of its underside to the stack on the way down.
const SHADE_PEAK_EXPONENT = 1.3
// Tiny lift keeping the sheet from z-fighting the static page it rests on
// at the ends of the turn.
const SHEET_LIFT = 0.004
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
  /** Printed faces (book.tsx picks the right print halves per turn
   *  direction): the face this sheet was showing when it lifted, and the
   *  face it lands as. Falls back to plain paper when a print hasn't
   *  resolved. The back map arrives pre-mirrored (a `left` half from
   *  use-page-print.ts), matching the landed pose's spine-out uv run. */
  frontMap?: THREE.Texture | null
  backMap?: THREE.Texture | null
}) {
  const pivotRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>(null)
  const backMeshRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>(null)
  const shadeRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>(null)

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
  // The page's underside: same paper grain, tinted darker so the sheet
  // reads as card with real thickness rather than a lit, glowing film.
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

  // Flat page geometry, built once before first paint. Rigid: never
  // rewritten — the pivot group's rotation does all the motion.
  useLayoutEffect(() => {
    const { positions, uvs, indices } = buildPageTemplate()
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    geometry.computeVertexNormals()
    if (meshRef.current) meshRef.current.geometry = geometry
    if (backMeshRef.current) backMeshRef.current.geometry = geometry
    return () => geometry.dispose()
  }, [])

  useFrame(() => {
    const pivot = pivotRef.current
    const mesh = meshRef.current
    const backMesh = backMeshRef.current
    const shade = shadeRef.current
    if (!pivot || !mesh || !backMesh || !shade) return

    const f = frame.current
    const active = f !== null && !f.isCover
    mesh.visible = active
    backMesh.visible = active
    shade.visible = active
    if (!active || !f) return

    const eased = easeTurnWeighted(f.t)
    pivot.rotation.z = sheetAngle(f.dir, eased)

    const tClamped = Math.min(1, Math.max(0, f.t))
    shade.material.opacity = SHADE_MAX_OPACITY * Math.sin(Math.PI * Math.pow(tClamped, SHADE_PEAK_EXPONENT))
    // Tracks the sheet's footprint: starts under the lifting page (+X for
    // 'next', the right stack), crosses the spine at mid-turn, and ends
    // under the landing side — cos(theta) of the sheet's own angle.
    const sweep = Math.cos(Math.PI * eased) * (PAGE_W / 2)
    shade.position.x = f.dir === 'next' ? sweep : -sweep
  })

  return (
    <>
      <group ref={pivotRef} position={[0, originY, 0]}>
        <mesh ref={meshRef} position={[0, SHEET_LIFT, 0]} material={material} visible={false} />
        <mesh ref={backMeshRef} position={[0, SHEET_LIFT, 0]} material={backMaterial} visible={false} />
      </group>
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
