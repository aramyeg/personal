'use client'

/**
 * Renders one FLOATING PLATFORM layer (popup-anatomy.ts §1): two tent-strut
 * ranks carrying a two-panel deck that meets at a center crease. Follows the
 * box layer's every convention (popup-box-layer.tsx) — unlit MeshBasicMaterial
 * print, kraft fallback tints for artless faces, a BackSide interior mesh in
 * deep shadow per patch (the underside of a floating deck sits dark — that
 * darkness IS the float), cut-edge hairlines, and DynamicDrawUsage position
 * buffers rewritten every frame from the solver.
 *
 * The deck prints one painting (`<id>-deck`) split at qA / (qA + qB): deckA
 * takes u in [0, split] and is the SHADED sibling (same fold-shading rule as
 * the box lid's lidL); deckB takes [split, 1] and is lit. v runs along the
 * spine with the image top on the far edge (dz0), exactly like the box lid.
 * The struts carry no art — raw warm kraft, strutR shaded, strutL lit.
 *
 * Two shadow tiers sell the stack: a tight footprint under each strut bay
 * (sized from the bay span and the strut's glue reach) and one wide, soft
 * pool under the whole deck span — the INTER-TIER shadow, the single
 * strongest cue that paper is floating above more paper. Both deepen with
 * sin(beta/2)^2, driven by the same dihedral as the paper.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { makePaperCanvas, makeShadowCanvas } from '../procedural/paper-texture'
import { makeCanvasTexture } from './book'
import { spreadPageAngles, type PlatformGeom, type SpreadRole } from './popup-mechanics'
import { solvePlatformPose, type PlatformFace } from './popup-anatomy'
import { easeTurnWeighted } from './page-geometry'
import type { TurnFrame } from './use-turn-driver'
import { useArtTexture } from './use-layer-texture'
import type { PopupRole } from './popup-spread'

const FLAT_EPSILON = 0.02
const SHADOW_Y_LIFT = 0.001
// The deck pool is broader but softer than the strut footprints; being the
// strongest stacked-paper cue it carries a touch more weight per pixel.
const STRUT_SHADOW_MAX = 0.26
const DECK_SHADOW_MAX = 0.34
// Same fold-shading rule as the box: the sibling left of a seam reads a step
// darker than its lit partner, which is what sells the crease.
const FOLD_SHADE_TINT = '#d9cdb4'
// Artless faces read as warm kraft stock, lit/shaded like the printed ones.
const PAPER_TINT = '#d8c8a4'
const PAPER_SHADE_TINT = '#c0af88'
// Interior surfaces sit in deep shadow (materials are unlit, so without this
// the underside would render as bright as the top and the float would read
// flat).
const INTERIOR_SHADOW_TINT = '#5f5138'
// Cut-edge / scored-fold hairline in the sheet's pale core color — what makes
// the deck read as CONSTRUCTED from sheets rather than extruded.
const CUT_EDGE_COLOR = '#f6eedb'

const isDeck = (face: PlatformFace): boolean => face === 'deckA' || face === 'deckB'
/** The darker sibling of each pair: deckA (the box-lid rule) and strutR. */
const isShaded = (face: PlatformFace): boolean => face === 'deckA' || face === 'strutR'

/** Per-face uvs. Deck faces take their half of the split painting (image top
 *  on the far edge, matching the box lid); struts print raw kraft, so their
 *  uvs are the identity square. */
function platformFaceUvs(face: PlatformFace, split: number): Float32Array {
  if (face === 'deckA') return new Float32Array([0, 0, split, 0, split, 1, 0, 1])
  if (face === 'deckB') return new Float32Array([split, 0, 1, 0, 1, 1, split, 1])
  return new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])
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

/** Hairline loop around a patch border; positions shared per frame with the
 *  face quad. */
function makeEdgeGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(12), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  return geometry
}

type ShadowSpec = { position: [number, number, number]; size: [number, number] }

/** One footprint per strut bay, spanning the strut's glue reach across the
 *  page (glueL on the left page, glueR on the right) and the bay's z span. */
function strutShadowSpecs(geom: PlatformGeom): ShadowSpec[] {
  const specs: ShadowSpec[] = []
  for (const strut of [geom.strutA, geom.strutB]) {
    const cx = (strut.glueR - strut.glueL) / 2
    const width = (strut.glueL + strut.glueR) * 0.85
    for (const [z0, z1] of strut.spans) {
      specs.push({ position: [cx, SHADOW_Y_LIFT, (z0 + z1) / 2], size: [width, (z1 - z0) * 0.95] })
    }
  }
  return specs
}

/** The wide, soft inter-tier pool under the whole deck span, centered over
 *  the gutter the deck floats above. Wider than any strut footprint so the
 *  two tiers read as distinct pools of contact. */
function deckShadowSpec(geom: PlatformGeom): ShadowSpec {
  const width = Math.max(
    geom.qA + geom.qB,
    geom.strutA.glueL + geom.strutA.glueR,
    geom.strutB.glueL + geom.strutB.glueR
  )
  return {
    position: [0, SHADOW_Y_LIFT, (geom.deckZ0 + geom.deckZ1) / 2],
    size: [width * 1.1, (geom.deckZ1 - geom.deckZ0) * 1.15],
  }
}

export function PlatformPopupLayer({
  layer,
  role,
  frame,
}: {
  layer: SceneLayer & PlatformGeom
  role: PopupRole
  frame: RefObject<TurnFrame | null>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const shadowGroupRef = useRef<THREE.Group>(null)

  const deckArt = useArtTexture(`${layer.id}-deck`)
  const split = layer.qA / (layer.qA + layer.qB)

  // The patch LIST (faces, ranks, bays, order) is constant per geometry —
  // only the corners move. Solve once at rest to build it.
  const patches = useMemo(() => solvePlatformPose(layer, Math.PI, 0), [layer])
  const geometries = useMemo(
    () => patches.map((p) => makeFaceGeometry(platformFaceUvs(p.face, split))),
    [patches, split]
  )
  const edgeGeometries = useMemo(() => patches.map(() => makeEdgeGeometry()), [patches])
  const edgeMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: CUT_EDGE_COLOR, transparent: true, opacity: 0.8 }),
    []
  )

  const paperTexture = useMemo(() => makeCanvasTexture(makePaperCanvas(256, 256)), [])
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

  // Wire the deck painting (or raw kraft) into each exterior material.
  useEffect(() => {
    patches.forEach((p, i) => {
      const material = materials.exterior[i]
      const art = isDeck(p.face) ? deckArt : null
      material.map = art ?? paperTexture
      if (art) {
        art.wrapS = THREE.ClampToEdgeWrapping
        art.wrapT = THREE.ClampToEdgeWrapping
        material.color.set(isShaded(p.face) ? FOLD_SHADE_TINT : '#ffffff')
      } else {
        material.color.set(isShaded(p.face) ? PAPER_SHADE_TINT : PAPER_TINT)
      }
      material.needsUpdate = true
    })
  }, [patches, materials, paperTexture, deckArt])

  const shadowTexture = useMemo(() => makeCanvasTexture(makeShadowCanvas()), [])
  const strutShadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 }),
    [shadowTexture]
  )
  const deckShadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 }),
    [shadowTexture]
  )
  const strutSpecs = useMemo(() => strutShadowSpecs(layer), [layer])
  const deckSpec = useMemo(() => deckShadowSpec(layer), [layer])

  useEffect(
    () => () => {
      geometries.forEach((g) => g.dispose())
      edgeGeometries.forEach((g) => g.dispose())
      edgeMaterial.dispose()
      materials.exterior.forEach((m) => m.dispose())
      materials.interior.dispose()
      paperTexture.dispose()
      shadowTexture.dispose()
      strutShadowMaterial.dispose()
      deckShadowMaterial.dispose()
    },
    [
      geometries,
      edgeGeometries,
      edgeMaterial,
      materials,
      paperTexture,
      shadowTexture,
      strutShadowMaterial,
      deckShadowMaterial,
    ]
  )

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const f = frame.current
    const solveRole: SpreadRole = role === 'hidden' ? 'current' : role
    const { thetaL, thetaR } = spreadPageAngles(solveRole, f?.dir ?? null, f ? easeTurnWeighted(f.t) : 0)
    const beta = thetaL - thetaR

    const visible = role !== 'hidden' && beta > FLAT_EPSILON
    group.visible = visible
    if (shadowGroupRef.current) shadowGroupRef.current.visible = visible
    if (!visible) return

    const solved = solvePlatformPose(layer, thetaL, thetaR)
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

    const contact = Math.sin(beta / 2) ** 2
    strutShadowMaterial.opacity = STRUT_SHADOW_MAX * contact
    deckShadowMaterial.opacity = DECK_SHADOW_MAX * contact
  })

  return (
    <>
      <group ref={groupRef} visible={false}>
        {patches.map((p, i) => (
          <group key={`${p.face}-${p.rank}-${p.bay}`}>
            <mesh geometry={geometries[i]} material={materials.exterior[i]} renderOrder={0} />
            <mesh geometry={geometries[i]} material={materials.interior} renderOrder={0} />
            <lineLoop geometry={edgeGeometries[i]} material={edgeMaterial} renderOrder={1} />
          </group>
        ))}
      </group>
      <group ref={shadowGroupRef} visible={false}>
        {strutSpecs.map((spec, i) => (
          <mesh
            key={`strut-shadow-${i}`}
            position={spec.position}
            rotation={[-Math.PI / 2, 0, 0]}
            material={strutShadowMaterial}
            renderOrder={0}
          >
            <planeGeometry args={spec.size} />
          </mesh>
        ))}
        <mesh
          position={deckSpec.position}
          rotation={[-Math.PI / 2, 0, 0]}
          material={deckShadowMaterial}
          renderOrder={0}
        >
          <planeGeometry args={deckSpec.size} />
        </mesh>
      </group>
    </>
  )
}
