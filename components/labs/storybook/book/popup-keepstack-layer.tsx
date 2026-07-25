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

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import type { BoxGeom, PanelQuad } from './popup-mechanics'
import { liveSpreadRole, spreadPageAnglesTilted } from './popup-mechanics'
import {
  keepStackBalconyDeck,
  keepStackFacadePlate,
  keepStackSpirePoses,
  keepStackSpireRaven,
  keepStackStoryGeoms,
  type KeepStackGeom,
} from './popup-keepstack'
import { kraftTints } from './paper-stock'
import { easeTurnWeighted } from './page-geometry'
import { sharedPaperTexture } from './shared-procedural-textures'
import { BoxPopupLayer } from './popup-box-layer'
import type { TurnFrame } from './use-turn-driver'
import { useArtTexture, useAtlasSet } from './use-layer-texture'
import { KeepStackMergedLayer, keepAtlasIds } from './popup-keepstack-merged'
import {
  BALCONY_DECK_UVS,
  CUT_EDGE_COLOR,
  FACADE_PLATE_UVS,
  RAVEN_FINIAL_UVS,
  SPIRE_MEMBER_UVS,
} from './popup-keepstack-uvs'

const FLAT_EPSILON = 0.02

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
 *  deck's two half-decks), following the box lid's look. `uvs` gives each quad's
 *  texture coords; pass a split pair to print ONE painting across the crease. */
function TwoQuadRide({
  artId,
  solve,
  uvs,
  alpha = false,
  spreadIndex,
  frame,
  committedSpread,
}: {
  artId: string
  solve: (thetaL: number, thetaR: number) => { a: PanelQuad; b: PanelQuad } | null
  uvs: readonly [Float32Array, Float32Array]
  /** die-cut silhouette (raven finial): alpha-tested, no rectangular cut-edge loop. */
  alpha?: boolean
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const art = useArtTexture(artId)
  const tint = useMemo(() => kraftTints(artId), [artId])
  const readAngles = usePageAngles(spreadIndex, frame, committedSpread)

  const geometries = useMemo(
    () => [makeQuadGeometry(new Float32Array(uvs[0])), makeQuadGeometry(new Float32Array(uvs[1]))],
    [uvs]
  )
  const edgeGeometries = useMemo(() => [makeEdgeGeometry(), makeEdgeGeometry()], [])
  const edgeMaterials = useMemo(
    () => geometries.map(() => new THREE.LineBasicMaterial({ color: CUT_EDGE_COLOR, transparent: true, opacity: 0.8 })),
    [geometries]
  )
  const paperTexture = sharedPaperTexture()
  // ONE continuous painting split across the crease — both halves print the art
  // UNSHADED (a fold-shade seam would break the continuity), DoubleSide so the ride
  // reads from the reader side regardless of each half-quad's winding (the two
  // half-decks/finials have OPPOSITE front-face normals, so a FrontSide material
  // shows one half's raw-paper back — the old "flat olive band" balcony bug).
  const materials = useMemo(
    () =>
      geometries.map(
        () =>
          new THREE.MeshBasicMaterial({
            side: THREE.DoubleSide,
            color: '#ffffff',
            transparent: alpha,
            alphaTest: alpha ? 0.1 : 0,
          })
      ),
    [geometries, alpha]
  )

  // useLayoutEffect (not passive): bind the map BEFORE paint so an identity
  // churn can never commit an unmapped pure-white frame (the E-G4 turn flash).
  useLayoutEffect(() => {
    materials.forEach((mat, i) => {
      mat.map = art ?? paperTexture
      mat.color.set(art ? '#ffffff' : tint.lit)
      mat.needsUpdate = true
      if (art) {
        art.wrapS = THREE.ClampToEdgeWrapping
        art.wrapT = THREE.ClampToEdgeWrapping
      }
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
          {/* die-cut silhouettes (alpha) skip the rectangular cut-edge loop — it
              would draw a box around the cutout. */}
          {!alpha && <lineLoop geometry={edgeGeometries[i]} material={edgeMaterials[i]} renderOrder={1} />}
        </group>
      ))}
    </group>
  )
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
  // Batch C-2: when every face of this keep is packed into ONE atlas page, the
  // whole stack draws as a single merged mesh (~50 draws -> <=5). Any gap in
  // the sidecar falls through to the per-mesh path below, unchanged.
  const atlasIds = useMemo(() => keepAtlasIds(layer), [layer])
  const atlas = useAtlasSet(atlasIds)
  if (atlas) {
    return (
      <KeepStackMergedLayer
        layer={layer}
        atlas={atlas}
        spreadIndex={spreadIndex}
        frame={frame}
        committedSpread={committedSpread}
      />
    )
  }
  return (
    <KeepStackMeshedLayer
      layer={layer}
      spreadIndex={spreadIndex}
      frame={frame}
      committedSpread={committedSpread}
    />
  )
}

/** The legacy per-mesh keep: one BoxPopupLayer per story plus a TwoQuadRide for
 *  each plate/balcony/spire member/raven. Kept as the fallback for a keep whose
 *  art is not atlas-packed (and as the reference the merged path is diffed
 *  against). */
function KeepStackMeshedLayer({
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
  // STABLE per-story box layer identities. Building these inline every render
  // churned BoxPopupLayer's [layer]-memoized materials back to unmapped white,
  // and the map only rebinds in a passive effect AFTER paint — the landing's two
  // commits then painted the whole stack pure white for ~2 frames (the reported
  // turn "flash"/click). Memoized on the stable story geoms + the keep's own
  // kind/role, so a landing re-render reuses the same box layer objects.
  const boxLayers = useMemo<(SceneLayer & BoxGeom)[]>(
    () =>
      stories.map((storyGeom) => ({
        ...storyGeom,
        id: `${layer.id}-${storyGeom.key}`,
        kind: layer.kind,
        role: layer.role,
      })),
    [stories, layer.id, layer.kind, layer.role]
  )
  return (
    <group name={`keepstack-${layer.id}`}>
      {boxLayers.map((boxLayer) => (
        <BoxPopupLayer
          key={boxLayer.id}
          layer={boxLayer}
          spreadIndex={spreadIndex}
          frame={frame}
          committedSpread={committedSpread}
        />
      ))}
      {/* DIE-CUT FACADE PLATES — the tier front art as a coplanar cap-plane plate
          (raven-finial idiom), one per plated story. The box cap behind it is raw
          bracing paper (capFrontArt:false). */}
      {stories
        .filter((s) => s.plate)
        .map((s) => (
          <TwoQuadRide
            key={`plate-${s.key}`}
            artId={`${layer.id}-${s.key}-front`}
            solve={(tL, tR) => {
              const plate = keepStackFacadePlate(layer, s.key, tL, tR)
              return plate ? { a: plate.plateL, b: plate.plateR } : null
            }}
            uvs={FACADE_PLATE_UVS}
            alpha
            spreadIndex={spreadIndex}
            frame={frame}
            committedSpread={committedSpread}
          />
        ))}
      {layer.balcony && (
        <TwoQuadRide
          artId={`${layer.id}-balcony`}
          solve={(tL, tR) => {
            const deck = keepStackBalconyDeck(layer, tL, tR)
            return deck ? { a: deck.deckL, b: deck.deckR } : null
          }}
          uvs={BALCONY_DECK_UVS}
          spreadIndex={spreadIndex}
          frame={frame}
          committedSpread={committedSpread}
        />
      )}
      {/* THE FAN SPIRE — each M-fold member (two panels meeting at the shared
          ridge crease) rides as one split painting, drawn like the box lids
          (solid paper, cut-edge hairlines). Seated on the loft's flat lid. */}
      {layer.spire?.members.map((_, i) => (
        <TwoQuadRide
          key={`spire-m${i}`}
          artId={`${layer.id}-spire-m${i}`}
          solve={(tL, tR) => {
            const poses = keepStackSpirePoses(layer, tL, tR)
            return poses ? { a: poses[i].left, b: poses[i].right } : null
          }}
          uvs={SPIRE_MEMBER_UVS}
          spreadIndex={spreadIndex}
          frame={frame}
          committedSpread={committedSpread}
        />
      ))}
      {layer.spire?.raven && (
        <TwoQuadRide
          artId={`${layer.id}-raven`}
          solve={(tL, tR) => {
            const finial = keepStackSpireRaven(layer, tL, tR)
            return finial ? { a: finial.crestL, b: finial.crestR } : null
          }}
          uvs={RAVEN_FINIAL_UVS}
          alpha
          spreadIndex={spreadIndex}
          frame={frame}
          committedSpread={committedSpread}
        />
      )}
    </group>
  )
}
