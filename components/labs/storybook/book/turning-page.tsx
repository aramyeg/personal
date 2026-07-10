'use client'

/**
 * The single page currently mid-turn: a segmented quad whose vertices are
 * curled every frame via Task 7's page-geometry math, plus a cheap
 * traveling shade plane standing in for the shadow a lifting page casts on
 * the page beneath it. Mounted once and left in the scene permanently
 * (procedural texture generation isn't free) — only the two meshes'
 * `visible` flags toggle per frame, driven by the turn driver ref. Cover
 * turns are animated entirely by book.tsx's front-cover pivot, so this page
 * stays hidden whenever `frame.isCover`.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PAGE_H, PAGE_W, buildPageTemplate, curlPositions, easeTurn } from './page-geometry'
import { makeCanvasTexture } from './book'
import { makePaperCanvas } from '../procedural/paper-texture'
import type { TurnFrame } from './use-turn-driver'

const SHADE_WIDTH = PAGE_W * 0.7
const SHADE_LIFT = 0.003

export function TurningPage({
  frame,
  originY,
}: {
  frame: RefObject<TurnFrame | null>
  /** World-space Y of the stack this page is currently departing from
   *  (matches the static page it was, per book.tsx's own height formula). */
  originY: number
}) {
  const meshRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>(null)
  const shadeRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>(null)
  const templateRef = useRef<Float32Array | null>(null)

  const paperCanvas = useMemo(() => makePaperCanvas(), [])
  const paperTexture = useMemo(() => makeCanvasTexture(paperCanvas), [paperCanvas])
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: paperTexture,
        roughness: 0.9,
        side: THREE.DoubleSide,
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
      shadeMaterial.dispose()
    },
    [paperTexture, material, shadeMaterial]
  )

  // Builds a private geometry (never shared with the static pages' geometry
  // — its position attribute is rewritten every frame) before first paint,
  // so the very first r3f render tick never sees a geometry-less mesh.
  useLayoutEffect(() => {
    const { positions, uvs, indices } = buildPageTemplate()
    templateRef.current = positions
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    if (meshRef.current) meshRef.current.geometry = geometry
    return () => geometry.dispose()
  }, [])

  useFrame(() => {
    const mesh = meshRef.current
    const shade = shadeRef.current
    const template = templateRef.current
    if (!mesh || !shade || !template) return

    const f = frame.current
    const active = f !== null && !f.isCover
    mesh.visible = active
    shade.visible = active
    if (!active || !f) return

    const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    curlPositions(template, posAttr.array as Float32Array, f.t, f.dir, easeTurn)
    posAttr.needsUpdate = true
    mesh.geometry.computeVertexNormals()

    shade.material.opacity = 0.25 * Math.sin(Math.PI * f.t)
    shade.position.x = Math.cos(Math.PI * easeTurn(f.t)) * (PAGE_W / 2)
  })

  return (
    <>
      <mesh ref={meshRef} position={[0, originY, 0]} material={material} visible={false} />
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
