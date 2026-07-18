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
import { useArtTexture } from './use-layer-texture'

const FLAT_EPSILON = 0.02
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

// Balcony deck UVs — the art (a single gold desk, arch frame at image-top, front
// rail at image-bottom) is ONE painting split across the spine crease, not printed
// twice. Each half-deck's quad is [seam-z0, seam-z1, outer-z1, outer-z0]
// (keepStackBalconyDeck). art-u (image WIDTH) fans ACROSS the crease: 0.5 at both
// seam corners (t=0) -> 0 on deckL / 1 on deckR at the outer edge, so the desk runs
// continuously left-to-right (deckL rides +y = world -x = reader LEFT, verified by
// corner math). art-v (image HEIGHT) runs along z; with the default flipY, v=1 is
// image-top (the arch), mapped to z0 (the facade-attachment edge toward the tower),
// v=0 (the rail) to z1 (the reader-facing jut). Corner->uv table (deckL): seam-z0
// (0.5,1), seam-z1 (0.5,0), outer-z1 (0,0), outer-z0 (0,1).
const BALCONY_DECK_UVS: [Float32Array, Float32Array] = [
  new Float32Array([0.5, 1, 0.5, 0, 0, 0, 0, 1]), // deckL (solved.a): seam art-u 0.5 -> outer 0; arch(v1)@z0
  new Float32Array([0.5, 1, 0.5, 0, 1, 0, 1, 1]), // deckR (solved.b): seam art-u 0.5 -> outer 1; arch(v1)@z0
]

// Raven finial UVs — the raven art split across the crown crease, same idiom as
// the balcony. The finial half-quads are [crease-bottom, crease-top, outer-top,
// outer-bottom] (keepStackRavenDeck). art-u fans 0.5 at the crease -> 0 (crestL,
// +y = reader LEFT) / 1 (crestR) at the outer edge; art-v runs bottom (cap top
// edge, v=0) -> top (finial top, v=1) so the bird stands upright (head at v=1).
const RAVEN_FINIAL_UVS: [Float32Array, Float32Array] = [
  new Float32Array([0.5, 0, 0.5, 1, 0, 1, 0, 0]), // crestL: crease 0.5 -> outer 0
  new Float32Array([0.5, 0, 0.5, 1, 1, 1, 1, 0]), // crestR: crease 0.5 -> outer 1
]

// Facade plate UVs — the tier front art split across the capFront crease, same
// idiom and corner order as the raven finial (keepStackFacadePlate returns
// [crease-bottom, crease-top, outer-top, outer-bottom]), so it reuses the raven
// UV table verbatim: art-u 0.5 at the crease -> 0 (plateL, reader LEFT) / 1
// (plateR) at the outer edge; art-v 0 at the cap base edge -> 1 at the plate top.
const FACADE_PLATE_UVS = RAVEN_FINIAL_UVS

// Fan spire member UVs — each member's art split across the SHARED CREASE (apex
// -> ridge tip), the two panels having OPPOSITE front-face normals like the
// balcony/raven, so DoubleSide + one painting reads continuous. Panel corner
// order is the parallelogram [apex(=crease-bottom), glue-out-bottom, glue-out-
// top, crease-top] (keepStackSpirePoses), so art-u fans 0.5 at the crease -> 0
// (left) / 1 (right) at the outer glue edge; art-v 0 at the apex -> 1 at the tip.
const SPIRE_MEMBER_UVS: [Float32Array, Float32Array] = [
  new Float32Array([0.5, 0, 0, 0, 0, 1, 0.5, 1]), // left: crease 0.5 -> outer 0
  new Float32Array([0.5, 0, 1, 0, 1, 1, 0.5, 1]), // right: crease 0.5 -> outer 1
]

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
