'use client'

/**
 * Renders one box-fold layer (popup-mechanics.ts §4): an enclosed paper
 * prism with per-face art. Faces load their own paintings from the art
 * pipeline — `<id>-front`, `<id>-back`, `<id>-side`, `<id>-top` — and any
 * face without baked art renders as raw paper stock, which is exactly what
 * an unprinted handmade box looks like (and what the volumetric benchmark's
 * C5 gate wants for interiors). Exteriors draw front-side only with the
 * art; every patch also draws its BACK side as raw paper, so a hollow
 * box's interior reads as unpainted stock rather than mirrored art.
 *
 * Corner order comes from solveBoxPose ([bl, br, tr, tl] seen from outside
 * at rest), so each face's uvs are the identity square — split in half for
 * the paired faces (caps, lid, roof), whose shared crease sits at u = 0.5.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { makePaperCanvas, makeShadowCanvas } from '../procedural/paper-texture'
import { makeCanvasTexture } from './book'
import {
  liveSpreadRole,
  solveBoxPose,
  spreadPageAnglesTilted,
  type BoxFace,
  type BoxGeom,
} from './popup-mechanics'
import { easeTurnWeighted } from './page-geometry'
import type { TurnFrame } from './use-turn-driver'
import { useArtTexture } from './use-layer-texture'

const FLAT_EPSILON = 0.02
const SHADOW_Y_LIFT = 0.001
const SHADOW_MAX_OPACITY = 0.32
// Same fold-shading rule as the v-folds: the half left of a seam reads a
// step darker than its lit sibling, which is what sells the crease.
const FOLD_SHADE_TINT = '#d9cdb4'
// Caps face the reader straight-on and catch less of the key light than
// the top — a half-step tint keeps front/top from reading as one surface.
const CAP_TINT = '#f2ebdc'
// Artless faces read as warm kraft stock, with the same lit/shaded split
// the printed faces get — without it a raw box renders as one white-hot
// blob against the painted pieces (capture review 2026-07-11).
const PAPER_TINT = '#d8c8a4'
const PAPER_SHADE_TINT = '#c0af88'
// Interior surfaces sit in deep shadow. The materials are unlit, so
// without this an open-front room's back wall renders as bright as an
// exterior face and the opening reads as a solid wall (user, C6 round 2:
// "they aren't open, there is clearly a wall right behind it") — the
// darkness IS the hollow.
const INTERIOR_SHADOW_TINT = '#5f5138'
// C5 paper physicality: every patch border draws a hairline in the
// sheet's pale core color — cut edges and scored fold lines both read as
// lighter lines on a real paper model, and they are what makes a box
// read as CONSTRUCTED from sheets rather than extruded.
const CUT_EDGE_COLOR = '#f6eedb'

/** Which art asset a face prints, and which horizontal half of it. */
const FACE_ART: Record<BoxFace, { asset: 'front' | 'back' | 'side' | 'top' | null; u0: number; u1: number }> = {
  wallL: { asset: 'side', u0: 0, u1: 1 },
  wallR: { asset: 'side', u0: 0, u1: 1 },
  lidL: { asset: 'top', u0: 0, u1: 0.5 },
  lidR: { asset: 'top', u0: 0.5, u1: 1 },
  roofL: { asset: 'top', u0: 0, u1: 0.5 },
  roofR: { asset: 'top', u0: 0.5, u1: 1 },
  capFrontL: { asset: 'front', u0: 0, u1: 0.5 },
  capFrontR: { asset: 'front', u0: 0.5, u1: 1 },
  capBackR: { asset: 'back', u0: 0, u1: 0.5 },
  capBackL: { asset: 'back', u0: 0.5, u1: 1 },
  backbone: { asset: null, u0: 0, u1: 1 },
}

/** The darker sibling of each split pair (and the always-shaded backbone). */
const SHADED_FACES: ReadonlySet<BoxFace> = new Set(['wallL', 'lidL', 'roofL', 'capBackL', 'capBackR', 'backbone'])

const faceUvs = (face: BoxFace): Float32Array => {
  const { u0, u1 } = FACE_ART[face]
  return new Float32Array([u0, 0, u1, 0, u1, 1, u0, 1])
}

function makeFaceGeometry(face: BoxFace): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(12), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  geometry.setAttribute('uv', new THREE.BufferAttribute(faceUvs(face), 2))
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1))
  return geometry
}

/** Hairline loop around a patch's border (positions shared per frame with
 *  the face quad) — the cut-edge/scored-crease line of the C5 gate. */
function makeEdgeGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(12), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  return geometry
}

export function BoxPopupLayer({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & BoxGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const shadowRef = useRef<THREE.Mesh>(null)

  const frontArt = useArtTexture(`${layer.id}-front`)
  const backArt = useArtTexture(`${layer.id}-back`)
  const sideArt = useArtTexture(`${layer.id}-side`)
  const topArt = useArtTexture(`${layer.id}-top`)

  // The face list is constant per geometry — only the corners move.
  const faces = useMemo(() => solveBoxPose(layer, Math.PI, 0).map((p) => p.face), [layer])
  const geometries = useMemo(() => faces.map((face) => makeFaceGeometry(face)), [faces])
  const edgeGeometries = useMemo(() => faces.map(() => makeEdgeGeometry()), [faces])
  const edgeMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: CUT_EDGE_COLOR, transparent: true, opacity: 0.8 }),
    []
  )

  const paperTexture = useMemo(() => makeCanvasTexture(makePaperCanvas(256, 256)), [])
  const materials = useMemo(() => {
    const exterior = faces.map(
      (face) =>
        new THREE.MeshBasicMaterial({
          side: THREE.FrontSide,
          color: SHADED_FACES.has(face) ? FOLD_SHADE_TINT : face.startsWith('capFront') ? CAP_TINT : '#ffffff',
        })
    )
    const interior = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      map: paperTexture,
      color: INTERIOR_SHADOW_TINT,
    })
    return { exterior, interior }
  }, [faces, paperTexture])

  // Wire each face's art (or raw paper) into its exterior material.
  useEffect(() => {
    const art = { front: frontArt, back: backArt, side: sideArt, top: topArt }
    faces.forEach((face, i) => {
      const asset = FACE_ART[face].asset
      const texture = asset ? art[asset] : null
      const material = materials.exterior[i]
      material.map = texture ?? paperTexture
      if (!texture) material.color.set(SHADED_FACES.has(face) ? PAPER_SHADE_TINT : PAPER_TINT)
      if (texture) {
        texture.wrapS = THREE.ClampToEdgeWrapping
        texture.wrapT = THREE.ClampToEdgeWrapping
      }
      material.needsUpdate = true
    })
  }, [faces, materials, paperTexture, frontArt, backArt, sideArt, topArt])

  const shadowTexture = useMemo(() => makeCanvasTexture(makeShadowCanvas()), [])
  const shadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 }),
    [shadowTexture]
  )

  useEffect(
    () => () => {
      geometries.forEach((g) => g.dispose())
      edgeGeometries.forEach((g) => g.dispose())
      edgeMaterial.dispose()
      materials.exterior.forEach((m) => m.dispose())
      materials.interior.dispose()
      paperTexture.dispose()
      shadowTexture.dispose()
      shadowMaterial.dispose()
    },
    [geometries, edgeGeometries, edgeMaterial, materials, paperTexture, shadowTexture, shadowMaterial]
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

    const visible = role !== 'hidden' && beta > FLAT_EPSILON
    group.visible = visible
    if (shadowRef.current) shadowRef.current.visible = visible
    if (!visible) return

    const patches = solveBoxPose(layer, thetaL, thetaR)
    patches.forEach((patch, i) => {
      for (const geometry of [geometries[i], edgeGeometries[i]]) {
        const attr = geometry.getAttribute('position') as THREE.BufferAttribute
        const arr = attr.array as Float32Array
        for (let c = 0; c < 4; c++) {
          arr[c * 3] = patch.quad[c][0]
          arr[c * 3 + 1] = patch.quad[c][1]
          arr[c * 3 + 2] = patch.quad[c][2]
        }
        attr.needsUpdate = true
        geometry.computeBoundingSphere()
      }
    })

    shadowMaterial.opacity = SHADOW_MAX_OPACITY * Math.sin(beta / 2) ** 2
  })

  return (
    <>
      <group ref={groupRef} visible={false}>
        {faces.map((face, i) => (
          <group key={face}>
            <mesh geometry={geometries[i]} material={materials.exterior[i]} renderOrder={0} />
            <mesh geometry={geometries[i]} material={materials.interior} renderOrder={0} />
            <lineLoop geometry={edgeGeometries[i]} material={edgeMaterial} renderOrder={1} />
          </group>
        ))}
      </group>
      <mesh
        ref={shadowRef}
        position={[0, SHADOW_Y_LIFT, (layer.z0 + layer.z1) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={shadowMaterial}
        renderOrder={0}
        visible={false}
      >
        <planeGeometry args={[layer.a * 2 * 1.05, (layer.z1 - layer.z0) * 1.05]} />
      </mesh>
    </>
  )
}
