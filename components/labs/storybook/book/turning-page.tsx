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
 * The card has THICKNESS: printed faces at ±PAPER_T/2 around the pivot
 * plane plus three paper-edge ribbons (fore edge and both z rims; the
 * spine edge hides in the gutter). Two zero-thickness planes vanished
 * entirely for the frames where the sheet passed vertical — the reading
 * camera sits at x=0, so θ=90° is EXACTLY edge-on — baring the whole
 * incoming spread mid-turn (the "cutouts through the page" flash). Real
 * card stock edge-on is a lit paper edge, never nothing.
 *
 * The two face materials are OWNED BY book.tsx and passed in: their maps
 * (and the underside shade ramp) swap inside book.tsx's useFrame on the
 * driver-ref clock, atomically with this sheet's visibility. A React
 * effect here raced the driver at the turn's endpoints and painted a
 * blank-paper face whenever its flush landed while the sheet was visible.
 *
 * Mounted once and left in the scene permanently; only a group `visible`
 * flag toggles per frame, driven by the turn driver ref. Cover turns are
 * animated by book.tsx's front-cover pivot, so this page stays hidden
 * whenever `frame.isCover`.
 *
 * As the page passes vertical the camera stops seeing the FrontSide face
 * and starts seeing the BackSide one, so the face swap point is geometric,
 * not timed. A cheap traveling shade plane stands in for the shadow the
 * lifting page casts on the stack beneath it.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PAGE_H, PAGE_W, buildPageTemplate, easeTurnWeighted } from './page-geometry'
import { sheetAngleTilted } from './popup-mechanics'
import { makeCanvasTexture } from './book'
import { makeShadowCanvas } from '../procedural/paper-texture'
import type { TurnFrame } from './use-turn-driver'

const SHADE_WIDTH = PAGE_W * 0.7
const SHADE_LIFT = 0.003
// Peak material opacity; the radial gradient map (center alpha 0.55)
// multiplies in, so the effective peak is ~0.28 fading to nothing at the
// edges — light passing through paper, not a hard cast slab (benchmark B11).
const SHADE_MAX_OPACITY = 0.5
// Shapes the shade's opacity so it peaks a little past mid-turn (t≈0.59):
// the page exposes more of its underside to the stack on the way down.
const SHADE_PEAK_EXPONENT = 1.3
// Tiny lift keeping the sheet from z-fighting the static page it rests on
// at the ends of the turn. Applied to the PIVOT's world y (not the mesh's
// local y): a local offset would rotate with the sheet and push it BELOW
// the page plane once past vertical, clipping into the landing page. The
// raised pivot keeps the sheet a paper-thickness above the pop-up wedge it
// bounds through the whole sweep.
const SHEET_LIFT = 0.004
// Card-stock thickness, split ±t/2 around the pivot plane. Bounded above
// by SHEET_LIFT: the underside face (at lift − t/2) must stay clear of the
// page surface AND above the flattened pop-up pieces (page + 0.0015) so
// nothing z-fights at the flat poses. At 0.004 the edge-on silhouette is a
// few pixels — a visible paper edge, exactly what a real page shows.
const PAPER_T = 0.004

export function TurningPage({
  frame,
  committedSpread,
  originY,
  frontMaterial,
  backMaterial,
  rimMaterial,
}: {
  frame: RefObject<TurnFrame | null>
  /** Driver ref (same clock as `frame`): the tilted sweep's endpoints are
   *  the rest planes of the spread being left and the one being landed
   *  (sheetAngleTilted / derive-bulge A16). */
  committedSpread: RefObject<number>
  /** World-space Y of the shared hinge line the sheet pivots on
   *  (book.tsx's PAGE_SURFACE_Y — the gutter valley floor). */
  originY: number
  /** The sheet's two printed faces, owned and frame-loop-updated by
   *  book.tsx (see its sheetFront/sheetBackMaterial). Front shows the face
   *  the sheet lifted with (FrontSide), back the face it lands as
   *  (BackSide, pre-mirrored `left` half — see use-page-print.ts). */
  frontMaterial: THREE.MeshStandardMaterial
  backMaterial: THREE.MeshStandardMaterial
  /** Rim ribbon material, owned and per-frame-tinted by book.tsx: the cut
   *  edges wear the identity color of the sheet currently flying. */
  rimMaterial: THREE.MeshStandardMaterial
}) {
  const pivotRef = useRef<THREE.Group>(null)
  const cardRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>(null)
  const backMeshRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>(null)
  const shadeRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>(null)
  // Soft radial-gradient shade (not a flat slab): light reads as passing
  // through the paper with a diffuse penumbra (benchmark B11).
  const shadeCanvas = useMemo(() => makeShadowCanvas(), [])
  const shadeTexture = useMemo(() => makeCanvasTexture(shadeCanvas), [shadeCanvas])
  const shadeMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: shadeTexture,
        color: '#0d0805',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [shadeTexture]
  )

  useEffect(
    () => () => {
      shadeTexture.dispose()
      shadeMaterial.dispose()
    },
    [shadeTexture, shadeMaterial]
  )

  // Flat page geometry shared by both printed faces, built once before
  // first paint. Rigid: never rewritten — the pivot group's rotation does
  // all the motion, and each face mesh carries its ±PAPER_T/2 offset.
  // The template's gutter-shade vertex colors ride along (the face
  // materials render with vertexColors), so the fold's shadow stays ON the
  // sheet through the whole sweep — matching the static pages exactly at
  // both flat poses.
  useLayoutEffect(() => {
    const { positions, uvs, colors, indices } = buildPageTemplate()
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    geometry.computeVertexNormals()
    if (meshRef.current) meshRef.current.geometry = geometry
    if (backMeshRef.current) backMeshRef.current.geometry = geometry
    return () => geometry.dispose()
  }, [])

  useFrame(() => {
    const pivot = pivotRef.current
    const card = cardRef.current
    const shade = shadeRef.current
    if (!pivot || !card || !shade) return

    const f = frame.current
    const active = f !== null && !f.isCover
    card.visible = active
    shade.visible = active
    if (!active || !f) return

    const eased = easeTurnWeighted(f.t)
    pivot.rotation.z = sheetAngleTilted(f.dir, eased, committedSpread.current)

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
      <group ref={pivotRef} position={[0, originY + SHEET_LIFT, 0]}>
        <group ref={cardRef} visible={false}>
          <mesh ref={meshRef} material={frontMaterial} position={[0, PAPER_T / 2, 0]} />
          <mesh ref={backMeshRef} material={backMaterial} position={[0, -PAPER_T / 2, 0]} />
          {/* Fore edge: the cut rim opposite the spine. */}
          <mesh material={rimMaterial} position={[PAGE_W, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[PAGE_H, PAPER_T]} />
          </mesh>
          {/* Near and far rims (±z). The spine edge stays bare: it lives
              inside the gutter shadow for the whole sweep. */}
          <mesh material={rimMaterial} position={[PAGE_W / 2, 0, PAGE_H / 2]}>
            <planeGeometry args={[PAGE_W, PAPER_T]} />
          </mesh>
          <mesh material={rimMaterial} position={[PAGE_W / 2, 0, -PAGE_H / 2]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[PAGE_W, PAPER_T]} />
          </mesh>
        </group>
      </group>
      {/* renderOrder=-1: the traveling shade joins the ground-shading tier
          (D-G3 audit) — it must never blend over the sheet or a pop-up. */}
      <mesh
        ref={shadeRef}
        position={[0, originY - SHADE_LIFT, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={shadeMaterial}
        renderOrder={-1}
        visible={false}
      >
        <planeGeometry args={[SHADE_WIDTH, PAGE_H]} />
      </mesh>
    </>
  )
}
