'use client'

/**
 * Renders the DISPATCH KEEP (popup-keepstack.ts): one content entry expanding
 * to four stacked box-fold stories, each drawn through the EXISTING box
 * renderer (popup-box-layer.tsx) with its baseH baked in — the reuse the
 * derivation asked for (no forked box renderer). On top of the stack ride the
 * jutting balcony deck (two half-decks on the hall lid) and the hero raven
 * silhouette on the crown, each a small unlit print following the box layer's
 * conventions (kraft fallback, interior BackSide in deep shadow, cut-edge
 * hairlines, DynamicDrawUsage positions rewritten per frame).
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import type { BoxGeom, PanelQuad } from './popup-mechanics'
import { liveSpreadRole, spreadPageAnglesTilted } from './popup-mechanics'
import {
  keepStackBalconyDeck,
  keepStackRavenQuad,
  keepStackStoryGeoms,
  type KeepStackGeom,
} from './popup-keepstack'
import { kraftTints } from './paper-stock'
import { easeTurnWeighted } from './page-geometry'
import { acquireMaterial, releaseMaterial } from './material-pool'
import { sharedPaperTexture } from './shared-procedural-textures'
import { BoxPopupLayer } from './popup-box-layer'
import type { TurnFrame } from './use-turn-driver'
import { useArtTexture } from './use-layer-texture'

const FLAT_EPSILON = 0.02
const FOLD_SHADE_TINT = '#d9cdb4'
const INTERIOR_SHADOW_TINT = '#5f5138'
const CUT_EDGE_COLOR = '#f6eedb'

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

/** The turn-clock page angles + live role for this spread. */
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

/** A small two-quad print riding a solved-per-frame pair of quads (the balcony
 *  deck's two half-decks), following the box lid's look. */
function TwoQuadRide({
  artId,
  solve,
  spreadIndex,
  frame,
  committedSpread,
}: {
  artId: string
  solve: (thetaL: number, thetaR: number) => { a: PanelQuad; b: PanelQuad } | null
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const art = useArtTexture(artId)
  const tint = useMemo(() => kraftTints(artId), [artId])
  const readAngles = usePageAngles(spreadIndex, frame, committedSpread)

  const geometries = useMemo(
    () => [makeQuadGeometry(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), makeQuadGeometry(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]))],
    []
  )
  const edgeGeometries = useMemo(() => [makeEdgeGeometry(), makeEdgeGeometry()], [])
  const edgeMaterials = useMemo(
    () => geometries.map(() => new THREE.LineBasicMaterial({ color: CUT_EDGE_COLOR, transparent: true, opacity: 0.8 })),
    [geometries]
  )
  const paperTexture = sharedPaperTexture()
  const materials = useMemo(
    () => geometries.map((_, i) => new THREE.MeshBasicMaterial({ side: THREE.FrontSide, color: i === 0 ? '#ffffff' : FOLD_SHADE_TINT })),
    [geometries]
  )
  const interiorMaterial = useMemo(
    () => acquireMaterial({ side: THREE.BackSide, map: paperTexture, color: INTERIOR_SHADOW_TINT }),
    [paperTexture]
  )
  useEffect(() => () => releaseMaterial(interiorMaterial), [interiorMaterial])

  useEffect(() => {
    materials.forEach((mat, i) => {
      const shaded = i !== 0
      mat.map = art ?? paperTexture
      if (art) {
        art.wrapS = THREE.ClampToEdgeWrapping
        art.wrapT = THREE.ClampToEdgeWrapping
        mat.color.set(shaded ? FOLD_SHADE_TINT : '#ffffff')
      } else {
        mat.color.set(shaded ? tint.shade : tint.lit)
      }
      mat.needsUpdate = true
      edgeMaterials[i].color.set(art ? CUT_EDGE_COLOR : tint.edge)
    })
  }, [art, paperTexture, materials, edgeMaterials, tint])

  useEffect(
    () => () => {
      geometries.forEach((g) => g.dispose())
      edgeGeometries.forEach((g) => g.dispose())
      edgeMaterials.forEach((m) => m.dispose())
      materials.forEach((m) => m.dispose())
    },
    [geometries, edgeGeometries, edgeMaterials, materials]
  )

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const { role, thetaL, thetaR, beta } = readAngles()
    const solved = role !== 'hidden' && beta > FLAT_EPSILON ? solve(thetaL, thetaR) : null
    group.visible = solved !== null
    if (!solved) return
    for (const [i, quad] of [solved.a, solved.b].entries()) {
      writeQuad(geometries[i], quad)
      writeQuad(edgeGeometries[i], quad)
    }
  })

  return (
    <group ref={groupRef} visible={false}>
      {geometries.map((g, i) => (
        <group key={i}>
          <mesh geometry={g} material={materials[i]} renderOrder={0} />
          <mesh geometry={g} material={interiorMaterial} renderOrder={0} />
          <lineLoop geometry={edgeGeometries[i]} material={edgeMaterials[i]} renderOrder={1} />
        </group>
      ))}
    </group>
  )
}

/** The hero raven silhouette perched on the crown — a single DoubleSide alpha
 *  print riding a solved-per-frame quad. */
function RavenSilhouette({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & KeepStackGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const art = useArtTexture(`${layer.id}-raven`)
  const tint = useMemo(() => kraftTints(`${layer.id}-raven`), [layer.id])
  const readAngles = usePageAngles(spreadIndex, frame, committedSpread)
  const geometry = useMemo(() => makeQuadGeometry(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), [])
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, alphaTest: 0.1, color: '#ffffff' }),
    []
  )
  const paperTexture = sharedPaperTexture()

  useEffect(() => {
    material.map = art ?? paperTexture
    material.color.set(art ? '#ffffff' : tint.lit)
    material.needsUpdate = true
    if (art) {
      art.wrapS = THREE.ClampToEdgeWrapping
      art.wrapT = THREE.ClampToEdgeWrapping
    }
  }, [art, paperTexture, material, tint])

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const { role, thetaL, thetaR, beta } = readAngles()
    const quad = role !== 'hidden' && beta > FLAT_EPSILON ? keepStackRavenQuad(layer, thetaL, thetaR) : null
    mesh.visible = quad !== null
    if (quad) writeQuad(geometry, quad)
  })

  return <mesh ref={meshRef} geometry={geometry} material={material} renderOrder={0} visible={false} />
}

export function KeepStackPopupLayer({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & KeepStackGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const stories = useMemo(() => keepStackStoryGeoms(layer), [layer])
  return (
    <group name={`keepstack-${layer.id}`}>
      {stories.map((storyGeom) => {
        const boxLayer: SceneLayer & BoxGeom = {
          ...storyGeom,
          id: `${layer.id}-${storyGeom.key}`,
          kind: layer.kind,
          role: layer.role,
        }
        return (
          <BoxPopupLayer
            key={storyGeom.key}
            layer={boxLayer}
            spreadIndex={spreadIndex}
            frame={frame}
            committedSpread={committedSpread}
          />
        )
      })}
      {layer.balcony && (
        <TwoQuadRide
          artId={`${layer.id}-balcony`}
          solve={(tL, tR) => {
            const deck = keepStackBalconyDeck(layer, tL, tR)
            return deck ? { a: deck.deckL, b: deck.deckR } : null
          }}
          spreadIndex={spreadIndex}
          frame={frame}
          committedSpread={committedSpread}
        />
      )}
      {layer.raven && (
        <RavenSilhouette layer={layer} spreadIndex={spreadIndex} frame={frame} committedSpread={committedSpread} />
      )}
    </group>
  )
}
