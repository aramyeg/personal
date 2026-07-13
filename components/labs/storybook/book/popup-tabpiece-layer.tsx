'use client'

/**
 * Renders one TAB PIECE layer (popup-tabpiece.ts, D1): a one-page slider
 * structure — mound (two slopes) or table (legs + deck) — whose internal
 * strip ends in a VISIBLE tab at the page's fore edge. The tab slides out
 * by exactly the strip draw as the structure erects (inextensible law).
 *
 * Follows the platform layer's every convention: unlit print, kraft
 * fallback tints, BackSide interior mesh in deep shadow, cut-edge
 * hairlines, DynamicDrawUsage positions rewritten per frame, two-tier
 * unlit shadows scaled by sin(beta/2)^2.
 *
 * Art: ONE painting per piece (`<id>-face`) mapped as the UNFOLDED die-cut
 * — u along the spine, v along the unrolled slide direction (0 at the
 * inner hinge, 1 at the fixed hinge; the ridge/deck breaks sit at their
 * arc-length stations). Printed exactly like a real die-cut sheet: the
 * image is continuous over every crease. The tab prints raw kraft with a
 * shaded tint — a visibly separate strip of card, the future grab handle.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { makePaperCanvas, makeShadowCanvas, makeTabGripCanvas } from '../procedural/paper-texture'
import { makeCanvasTexture } from './book'
import { kraftTints } from './paper-stock'
import { liveSpreadRole, spreadPageAnglesTilted, type TabPieceGeom } from './popup-mechanics'
import { solveTabPiecePose, tabPieceFlatSpan, tabPieceSlit, type TabPieceFace } from './popup-tabpiece'
import { peakHeight, shadowLift } from './shadow-light'
import { easeTurnWeighted } from './page-geometry'
import type { TurnFrame } from './use-turn-driver'
import { useArtTexture } from './use-layer-texture'

const FLAT_EPSILON = 0.02
const SHADOW_Y_LIFT = 0.001
const STRUCT_SHADOW_MAX = 0.28
const FOLD_SHADE_TINT = '#d9cdb4'
const INTERIOR_SHADOW_TINT = '#5f5138'
const CUT_EDGE_COLOR = '#f6eedb'

/** The darker sibling of each crease pair — the face turned away from the
 *  fore edge's light in the flat print (slopeOut/legOut), plus the tab. */
const isShaded = (face: TabPieceFace): boolean =>
  face === 'slopeOut' || face === 'legOut' || face === 'tab'

/** Unfolded-die-cut v bands per face (arc length from inner hinge, over
 *  the flat span). The tab is raw kraft — identity uvs. */
function tabFaceUvs(face: TabPieceFace, geom: TabPieceGeom): Float32Array {
  const span = tabPieceFlatSpan(geom)
  const w = geom.legW / span
  const d = (geom.deckD ?? 0) / span
  const bands: Partial<Record<TabPieceFace, [number, number]>> = {
    slopeIn: [0, 0.5],
    slopeOut: [0.5, 1],
    legIn: [0, w],
    deck: [w, w + d],
    legOut: [w + d, 1],
  }
  const band = bands[face]
  if (!band) return new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])
  const [vA, vB] = band
  return new Float32Array([0, vA, 1, vA, 1, vB, 0, vB])
}

function makeFaceGeometry(uvs: Float32Array): THREE.BufferGeometry {
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

/** Two-point line geometry for the fore-edge SLIT the tab emerges through
 *  (D3 tab-legibility package) — one segment, positions rewritten every
 *  frame from `tabPieceSlit`. */
function makeSlitGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(6), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  return geometry
}

export function TabPiecePopupLayer({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & TabPieceGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const shadowGroupRef = useRef<THREE.Group>(null)

  const faceArt = useArtTexture(`${layer.id}-face`)
  // This piece's own stock (D3 kraft-legibility package): replaces the
  // shared PAPER_TINT/PAPER_SHADE_TINT pair so a mid-turn tangle of several
  // artless tab pieces separates by tone instead of reading as one mass.
  const tint = useMemo(() => kraftTints(layer.id), [layer.id])

  const patches = useMemo(() => solveTabPiecePose(layer, Math.PI, 0), [layer])
  const geometries = useMemo(
    () => patches.map((p) => makeFaceGeometry(tabFaceUvs(p.face, layer))),
    [patches, layer]
  )
  const edgeGeometries = useMemo(() => patches.map(() => makeEdgeGeometry()), [patches])
  // One hairline material per patch (not shared): artless faces get this
  // piece's own darker `tint.edge` for contrast against same-family
  // neighbors mid-turn; painted faces keep the standard pale cut-edge core.
  const edgeMaterials = useMemo(
    () => patches.map(() => new THREE.LineBasicMaterial({ color: CUT_EDGE_COLOR, transparent: true, opacity: 0.8 })),
    [patches]
  )

  const paperTexture = useMemo(() => makeCanvasTexture(makePaperCanvas(256, 256)), [])
  const tabGripTexture = useMemo(() => makeCanvasTexture(makeTabGripCanvas()), [])
  const materials = useMemo(() => {
    const exterior = patches.map(
      (p) =>
        new THREE.MeshBasicMaterial({
          side: THREE.FrontSide,
          color: isShaded(p.face) ? FOLD_SHADE_TINT : '#ffffff',
        })
    )
    const interior = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      map: paperTexture,
      color: INTERIOR_SHADOW_TINT,
    })
    return { exterior, interior }
  }, [patches, paperTexture])

  useEffect(() => {
    patches.forEach((p, i) => {
      const material = materials.exterior[i]
      const art = p.face === 'tab' ? null : faceArt
      // The tab never prints art (file header) — its raw-kraft map carries
      // the grip-notch texture instead of the generic paper grain.
      material.map = art ?? (p.face === 'tab' ? tabGripTexture : paperTexture)
      if (art) {
        art.wrapS = THREE.ClampToEdgeWrapping
        art.wrapT = THREE.ClampToEdgeWrapping
        material.color.set(isShaded(p.face) ? FOLD_SHADE_TINT : '#ffffff')
      } else {
        material.color.set(isShaded(p.face) ? tint.shade : tint.lit)
      }
      material.needsUpdate = true
      edgeMaterials[i].color.set(art ? CUT_EDGE_COLOR : tint.edge)
    })
  }, [patches, materials, edgeMaterials, paperTexture, tabGripTexture, faceArt, tint])

  // The fore-edge SLIT the tab emerges through (D3 tab-legibility package):
  // a short hairline riding the page rigidly at d = PAGE_W, tinted this
  // piece's own darker `edge` sibling so it reads as a cut, not a stray line.
  const slitGeometry = useMemo(() => makeSlitGeometry(), [])
  const slitMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: tint.edge, transparent: true, opacity: 0.9 }),
    [tint]
  )

  const shadowTexture = useMemo(() => makeCanvasTexture(makeShadowCanvas()), [])
  const shadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 }),
    [shadowTexture]
  )
  // Key-light placement (shadow-light.ts): the erected mound/table stands, so
  // its pool offsets down-screen-right and deepens/spreads with its rest peak.
  const shadowSpec = useMemo(() => {
    const span = tabPieceFlatSpan(layer)
    const sign = layer.side === 'left' ? -1 : 1
    const rest = solveTabPiecePose(layer, Math.PI, 0)
    const lift = shadowLift(peakHeight(rest.map((p) => p.quad)))
    return {
      position: [
        sign * (layer.hingeX - span / 2) + lift.dx,
        SHADOW_Y_LIFT,
        (layer.z0 + layer.z1) / 2 + lift.dz,
      ] as [number, number, number],
      size: [span * 0.95 * lift.spread, (layer.z1 - layer.z0) * 1.05 * lift.spread] as [number, number],
      maxOpacity: STRUCT_SHADOW_MAX * lift.depth,
    }
  }, [layer])

  useEffect(
    () => () => {
      geometries.forEach((g) => g.dispose())
      edgeGeometries.forEach((g) => g.dispose())
      edgeMaterials.forEach((m) => m.dispose())
      materials.exterior.forEach((m) => m.dispose())
      materials.interior.dispose()
      paperTexture.dispose()
      tabGripTexture.dispose()
      slitGeometry.dispose()
      slitMaterial.dispose()
      shadowTexture.dispose()
      shadowMaterial.dispose()
    },
    [
      geometries,
      edgeGeometries,
      edgeMaterials,
      materials,
      paperTexture,
      tabGripTexture,
      slitGeometry,
      slitMaterial,
      shadowTexture,
      shadowMaterial,
    ]
  )

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const f = frame.current
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
    if (shadowGroupRef.current) shadowGroupRef.current.visible = visible
    if (!visible) return

    const solved = solveTabPiecePose(layer, thetaL, thetaR)
    solved.forEach((patch, i) => {
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

    const [slitA, slitB] = tabPieceSlit(layer, thetaL, thetaR)
    const slitAttr = slitGeometry.getAttribute('position') as THREE.BufferAttribute
    const slitArr = slitAttr.array as Float32Array
    slitArr[0] = slitA[0]
    slitArr[1] = slitA[1]
    slitArr[2] = slitA[2]
    slitArr[3] = slitB[0]
    slitArr[4] = slitB[1]
    slitArr[5] = slitB[2]
    slitAttr.needsUpdate = true
    slitGeometry.computeBoundingSphere()

    shadowMaterial.opacity = shadowSpec.maxOpacity * Math.sin(beta / 2) ** 2
  })

  return (
    <>
      <group ref={groupRef} visible={false}>
        {patches.map((p, i) => (
          <group key={p.face}>
            <mesh geometry={geometries[i]} material={materials.exterior[i]} renderOrder={0} />
            <mesh geometry={geometries[i]} material={materials.interior} renderOrder={0} />
            <lineLoop geometry={edgeGeometries[i]} material={edgeMaterials[i]} renderOrder={1} />
          </group>
        ))}
        <lineSegments geometry={slitGeometry} material={slitMaterial} renderOrder={1} />
      </group>
      <group ref={shadowGroupRef} visible={false}>
        {/* renderOrder=-1: all ground shading joins the gutter crease's
            early transparent tier (D-G3 audit; book.tsx precedent) so no
            shadow can ever draw over paper. */}
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
