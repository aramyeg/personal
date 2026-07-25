'use client'

/**
 * Renders one MULTI-FOLD RANGE layer (popup-mfoldrange.ts, E3 s5): the dune
 * massif — k standing v-fold ranks + the flat valley-floor gussets between
 * them, all cut from ONE card and painted on ONE atlas texture, submitted
 * as ONE mesh (a single draw: the whole point of the family's budget case).
 *
 * Every rank's pair of panels and every gusset strip is a quad in a single
 * BufferGeometry; positions are rewritten each frame from the closed-form
 * solver, uvs are static atlas bands (popup-mfoldrange.ts row layout — one
 * source of truth shared with the generate-art painter). Lee/windward fold
 * shading is PAINTED into the atlas (violet lee faces vs gold-lit windward
 * per the pack), not applied as a per-panel material tint — one material,
 * one draw, and the art carries its own light like every other print.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import type { MFoldRangeGeom } from './popup-mfoldrange'
import {
  MFOLD_GUSSET_ROW_LEFT,
  MFOLD_GUSSET_ROW_RIGHT,
  mfoldAtlasBand,
  mfoldRankRow,
  solveMFoldRangePose,
  type MFoldRangePose,
} from './popup-mfoldrange'
import { liveSpreadRole, spreadPageAnglesTilted, type PanelQuad } from './popup-mechanics'
import { easeTurnWeighted } from './page-geometry'
import type { TurnFrame } from './use-turn-driver'
import { useLayerTexture } from './use-layer-texture'

const FLAT_EPSILON = 0.02

/** Static uvs for the whole card, quad-ordered exactly as the position
 *  writer walks the pose: per rank [right panel, left panel], then per
 *  gusset [left strip, right strip]. Panel corner order is the PanelQuad
 *  convention [apex, bottom-outer, top-outer, top-inner]; u splits at the
 *  rank's creaseU (the v-fold panelUvs law), v spans the rank's atlas band.
 *  Gusset corners run [near-spine, near-out, far-out, far-spine]; u runs
 *  along the spine span (far edge at u=0), v across the 24px strip row. */
function rangeUvs(geom: MFoldRangeGeom): Float32Array {
  const uvs: number[] = []
  geom.ranks.forEach((rank, i) => {
    const [v0, v1] = mfoldAtlasBand(mfoldRankRow(i))
    const s = rank.creaseU ?? 0.5
    // right panel: apex -> art's right half
    uvs.push(s, v0, 1, v0, 1, v1, s, v1)
    // left panel: apex -> art's left half
    uvs.push(s, v0, 0, v0, 0, v1, s, v1)
  })
  for (let g = 0; g + 1 < geom.ranks.length; g++) {
    for (const row of [MFOLD_GUSSET_ROW_LEFT, MFOLD_GUSSET_ROW_RIGHT]) {
      const [v0, v1] = mfoldAtlasBand(row)
      uvs.push(1, v0, 1, v1, 0, v1, 0, v0)
    }
  }
  return new Float32Array(uvs)
}

function makeRangeGeometry(geom: MFoldRangeGeom): THREE.BufferGeometry {
  const rankQuads = geom.ranks.length * 2
  const gussetQuads = (geom.ranks.length - 1) * 2
  const quads = rankQuads + gussetQuads
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(quads * 4 * 3), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  geometry.setAttribute('uv', new THREE.BufferAttribute(rangeUvs(geom), 2))
  const index = new Uint16Array(quads * 6)
  for (let q = 0; q < quads; q++) {
    const base = q * 4
    index.set([base, base + 1, base + 2, base, base + 2, base + 3], q * 6)
  }
  geometry.setIndex(new THREE.BufferAttribute(index, 1))
  return geometry
}

function writePose(geometry: THREE.BufferGeometry, pose: MFoldRangePose): void {
  const attr = geometry.getAttribute('position') as THREE.BufferAttribute
  const arr = attr.array as Float32Array
  let o = 0
  const put = (quad: PanelQuad): void => {
    for (let c = 0; c < 4; c++) {
      arr[o++] = quad[c][0]
      arr[o++] = quad[c][1]
      arr[o++] = quad[c][2]
    }
  }
  for (const rank of pose.ranks) {
    put(rank.right)
    put(rank.left)
  }
  for (const gusset of pose.gussets) {
    put(gusset.left)
    put(gusset.right)
  }
  attr.needsUpdate = true
  geometry.computeBoundingSphere()
}

export function MFoldRangePopupLayer({
  layer,
  accents,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & MFoldRangeGeom
  accents: readonly string[]
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const texture = useLayerTexture(layer.id, layer.kind, accents)

  const geometry = useMemo(() => makeRangeGeometry(layer), [layer])
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

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material]
  )

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
    writePose(geometry, solveMFoldRangePose(layer, thetaL, thetaR))
  })

  return <mesh ref={meshRef} geometry={geometry} material={material} renderOrder={0} visible={false} />
}
