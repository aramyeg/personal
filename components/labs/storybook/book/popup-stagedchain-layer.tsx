'use client'

/**
 * Renders one STAGED CHAIN layer (popup-stagedchain.ts, E3 s4): a multi-storey
 * page-rooted wall whose storeys unfold top-down as the page opens, submitted
 * as ONE merged mesh with ONE atlas texture — a single draw for the whole
 * cliff, which is what lets the family replace nine skyline row draws.
 *
 * Positions are rewritten each frame from the closed-form solver; uvs are
 * static per-storey v-bands of one continuous painting (popup-stagedchain.ts
 * `stagedChainBand`, the single source of truth shared with the generate-art
 * painter). Storey lighting — rim-lit crenellations, the amber blaze of each
 * portal rank — is PAINTED into the atlas, not applied as a per-panel tint:
 * one material, one draw, and the art carries its own light like every other
 * print in the book.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { useGuardedDispose } from './material-pool'
import {
  solveStagedChainPose,
  stagedChainBand,
  stagedChainNodeU,
  type StagedChainGeom,
} from './popup-stagedchain'
import { liveSpreadRole, spreadPageAnglesTilted, type PanelQuad } from './popup-mechanics'
import { easeTurnWeighted } from './page-geometry'
import type { TurnFrame } from './use-turn-driver'
import { useLayerTexture } from './use-layer-texture'

const FLAT_EPSILON = 0.02

/** Static uvs, quad-ordered exactly as the position writer walks the pose:
 *  one quad per storey, root first, corners [inner-base, outer-base,
 *  outer-top, inner-top]. v climbs the storey's band of the shared painting;
 *  u is the storey's own sub-range of the chain's full radial extent, so a
 *  TRAPEZOID wall cuts the right slice of one crooked silhouette instead of
 *  stretching the whole sheet across every storey. */
function chainUvs(geom: StagedChainGeom): Float32Array {
  const uvs: number[] = []
  geom.stages.forEach((_, k) => {
    const [v0, v1] = stagedChainBand(geom, k)
    const [u0a, u1a] = stagedChainNodeU(geom, k)
    const [u0b, u1b] = stagedChainNodeU(geom, k + 1)
    uvs.push(u0a, v0, u1a, v0, u1b, v1, u0b, v1)
  })
  return new Float32Array(uvs)
}

function makeChainGeometry(geom: StagedChainGeom): THREE.BufferGeometry {
  const quads = geom.stages.length
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(quads * 4 * 3), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  geometry.setAttribute('uv', new THREE.BufferAttribute(chainUvs(geom), 2))
  const index = new Uint16Array(quads * 6)
  for (let q = 0; q < quads; q++) {
    const base = q * 4
    index.set([base, base + 1, base + 2, base, base + 2, base + 3], q * 6)
  }
  geometry.setIndex(new THREE.BufferAttribute(index, 1))
  return geometry
}

function writePose(geometry: THREE.BufferGeometry, panels: readonly PanelQuad[]): void {
  const attr = geometry.getAttribute('position') as THREE.BufferAttribute
  const arr = attr.array as Float32Array
  let o = 0
  for (const quad of panels) {
    for (let c = 0; c < 4; c++) {
      arr[o++] = quad[c][0]
      arr[o++] = quad[c][1]
      arr[o++] = quad[c][2]
    }
  }
  attr.needsUpdate = true
  geometry.computeBoundingSphere()
}

export function StagedChainPopupLayer({
  layer,
  accents,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & StagedChainGeom
  accents: readonly string[]
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const texture = useLayerTexture(layer.id, layer.kind, accents)

  const geometry = useMemo(() => makeChainGeometry(layer), [layer])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        alphaTest: 0.1,
        side: THREE.DoubleSide,
        color: '#ffffff',
      }),
    []
  )

  useEffect(() => {
    if (!texture) return
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    material.map = texture
    material.needsUpdate = true
  }, [texture, material])

  useGuardedDispose([geometry, material])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const f = frame.current
    const role = liveSpreadRole(spreadIndex, committedSpread.current, f?.dir ?? null)
    const { thetaL, thetaR } = spreadPageAnglesTilted(
      spreadIndex,
      committedSpread.current,
      f?.dir ?? null,
      f ? easeTurnWeighted(f.t) : 0
    )
    const beta = thetaL - thetaR
    const visible = role !== 'hidden' && beta > FLAT_EPSILON && texture !== null
    mesh.visible = visible
    if (!visible) return
    writePose(geometry, solveStagedChainPose(layer, thetaL, thetaR).panels)
  })

  return <mesh ref={meshRef} geometry={geometry} material={material} renderOrder={0} visible={false} />
}
