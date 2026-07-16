'use client'

/**
 * Renders the SKYLINE (popup-skyline.ts): a row of low rooftop mounds per outer
 * page, each two slope panels over a ridge band, page-driven by the fold-flat
 * envelope (no knob). Follows the knob-tier renderer's conventions verbatim —
 * unlit print, kraft fallback, interior BackSide in deep shadow, cut-edge
 * hairlines, a contact shadow scaled by the mound's own lift.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { liveSpreadRole, spreadPageAnglesTilted } from './popup-mechanics'
import { solveKeepSkylinePose, keepSkylineEnvelope, type KeepSkylineGeom } from './popup-skyline'
import { kraftTints } from './paper-stock'
import { easeTurnWeighted } from './page-geometry'
import { shadowLift } from './shadow-light'
import { acquireMaterial, releaseMaterial } from './material-pool'
import { sharedPaperTexture, sharedShadowTexture } from './shared-procedural-textures'
import type { TurnFrame } from './use-turn-driver'
import { useArtTexture } from './use-layer-texture'

const FLAT_EPSILON = 0.02
const SHADOW_Y_LIFT = 0.001
const STRUCT_SHADOW_MAX = 0.28
const FOLD_SHADE_TINT = '#d9cdb4'
const INTERIOR_SHADOW_TINT = '#5f5138'
const CUT_EDGE_COLOR = '#f6eedb'
const rad = (d: number): number => (d * Math.PI) / 180

function makeQuadGeometry(uvs: Float32Array): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(12), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1))
  return geometry
}

function makeEdgeGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(12), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  return geometry
}

function writeQuad(geometry: THREE.BufferGeometry, quad: readonly (readonly [number, number, number])[]): void {
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

function SkylineMound({
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
  const mound = layer.mounds[k]

  const geometries = useMemo(
    () => ({
      in: makeQuadGeometry(new Float32Array([0, 0, 1, 0, 1, 0.5, 0, 0.5])),
      out: makeQuadGeometry(new Float32Array([0, 0.5, 1, 0.5, 1, 1, 0, 1])),
    }),
    []
  )
  const edgeGeometries = useMemo(() => ({ in: makeEdgeGeometry(), out: makeEdgeGeometry() }), [])
  const edgeMaterials = useMemo(
    () => ({
      in: new THREE.LineBasicMaterial({ color: CUT_EDGE_COLOR, transparent: true, opacity: 0.8 }),
      out: new THREE.LineBasicMaterial({ color: CUT_EDGE_COLOR, transparent: true, opacity: 0.8 }),
    }),
    []
  )
  const paperTexture = sharedPaperTexture()
  const materials = useMemo(
    () => ({
      in: new THREE.MeshBasicMaterial({ side: THREE.FrontSide, color: '#ffffff' }),
      out: new THREE.MeshBasicMaterial({ side: THREE.FrontSide, color: FOLD_SHADE_TINT }),
    }),
    []
  )
  const interiorMaterial = useMemo(
    () => acquireMaterial({ side: THREE.BackSide, map: paperTexture, color: INTERIOR_SHADOW_TINT }),
    [paperTexture]
  )
  useEffect(() => () => releaseMaterial(interiorMaterial), [interiorMaterial])

  useEffect(() => {
    const set = (mat: THREE.MeshBasicMaterial, edge: THREE.LineBasicMaterial, shaded: boolean) => {
      mat.map = faceArt ?? paperTexture
      if (faceArt) {
        faceArt.wrapS = THREE.ClampToEdgeWrapping
        faceArt.wrapT = THREE.ClampToEdgeWrapping
        mat.color.set(shaded ? FOLD_SHADE_TINT : '#ffffff')
      } else {
        mat.color.set(shaded ? tint.shade : tint.lit)
      }
      mat.needsUpdate = true
      edge.color.set(faceArt ? CUT_EDGE_COLOR : tint.edge)
    }
    set(materials.in, edgeMaterials.in, false)
    set(materials.out, edgeMaterials.out, true)
  }, [faceArt, paperTexture, materials, edgeMaterials, tint])

  const shadowTexture = sharedShadowTexture()
  const shadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 }),
    [shadowTexture]
  )
  const shadowSpec = useMemo(() => {
    const sign = layer.side === 'left' ? -1 : 1
    const peak = mound.w * Math.sin(rad(mound.aRestDeg))
    const lift = shadowLift(peak)
    const centerD = mound.F - mound.w
    return {
      position: [sign * centerD + lift.dx, SHADOW_Y_LIFT, mound.zc + lift.dz] as [number, number, number],
      size: [mound.w * 2 * 0.95 * lift.spread, mound.ridgeLen * 1.05 * lift.spread] as [number, number],
      maxOpacity: STRUCT_SHADOW_MAX * lift.depth,
    }
  }, [layer, mound])

  useEffect(
    () => () => {
      geometries.in.dispose()
      geometries.out.dispose()
      edgeGeometries.in.dispose()
      edgeGeometries.out.dispose()
      edgeMaterials.in.dispose()
      edgeMaterials.out.dispose()
      materials.in.dispose()
      materials.out.dispose()
      shadowMaterial.dispose()
    },
    [geometries, edgeGeometries, edgeMaterials, materials, shadowMaterial]
  )

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const { role, thetaL, thetaR, beta } = readAngles()
    const visible = role !== 'hidden' && beta > FLAT_EPSILON
    group.visible = visible
    if (shadowGroupRef.current) shadowGroupRef.current.visible = visible
    if (!visible) return
    const patch = solveKeepSkylinePose(layer, thetaL, thetaR)[k]
    writeQuad(geometries.in, patch.slopeIn)
    writeQuad(edgeGeometries.in, patch.slopeIn)
    writeQuad(geometries.out, patch.slopeOut)
    writeQuad(edgeGeometries.out, patch.slopeOut)
    shadowMaterial.opacity = shadowSpec.maxOpacity * keepSkylineEnvelope(layer, beta)
  })

  return (
    <>
      <group ref={groupRef} visible={false}>
        <mesh geometry={geometries.in} material={materials.in} renderOrder={0} />
        <mesh geometry={geometries.in} material={interiorMaterial} renderOrder={0} />
        <lineLoop geometry={edgeGeometries.in} material={edgeMaterials.in} renderOrder={1} />
        <mesh geometry={geometries.out} material={materials.out} renderOrder={0} />
        <mesh geometry={geometries.out} material={interiorMaterial} renderOrder={0} />
        <lineLoop geometry={edgeGeometries.out} material={edgeMaterials.out} renderOrder={1} />
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
      {layer.mounds.map((_, k) => (
        <SkylineMound
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
