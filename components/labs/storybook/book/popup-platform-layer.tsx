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
 * The struts print `<id>-strut` if the piece supplies one and raw warm kraft
 * otherwise; either way strutR is shaded and strutL lit.
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
import { kraftTints } from './paper-stock'
import { liveSpreadRole, spreadPageAnglesTilted, type PlatformGeom } from './popup-mechanics'
import { solvePlatformPose, type PlatformFace } from './popup-anatomy'
import { peakHeight, shadowLift } from './shadow-light'
import { easeTurnWeighted } from './page-geometry'
import { acquireMaterial, releaseMaterial, useGuardedDispose } from './material-pool'
import { sharedPaperTexture, sharedShadowTexture } from './shared-procedural-textures'
import type { TurnFrame } from './use-turn-driver'
import { useArtSprite, useArtTexture } from './use-layer-texture'
import { applyUvRect, type UvRect } from '../art-atlas'

const FLAT_EPSILON = 0.02
const SHADOW_Y_LIFT = 0.001
// The deck pool is broader but softer than the strut footprints; being the
// strongest stacked-paper cue it carries a touch more weight per pixel.
const STRUT_SHADOW_MAX = 0.26
const DECK_SHADOW_MAX = 0.34
// Same fold-shading rule as the box: the sibling left of a seam reads a step
// darker than its lit partner, which is what sells the crease.
// E-G5 floor (f): PAINTED shaded faces use this gentle NEUTRAL step. The old
// warm fold seam (#d9cdb4, ~x0.85/0.80/0.71) dimmed + warm-cast painted art
// across half of a folded piece; the warm seam stays reserved for raw kraft
// placeholder stock (per-piece kraftTints), never painted art.
const PAINTED_FOLD_SHADE = '#e4e4e4'
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
 *  on the far edge, matching the box lid), then that painting's region of the
 *  atlas page it was packed onto (INFRA-2); struts print their own `<id>-strut`
 *  sheet (or raw kraft) with identity uvs, so one strut sheet serves every
 *  strut face whatever the deck resolved to. */
function platformFaceUvs(face: PlatformFace, split: number, deckRect: UvRect | null): Float32Array {
  if (face === 'deckA') return applyUvRect(new Float32Array([0, 0, split, 0, split, 1, 0, 1]), deckRect)
  if (face === 'deckB') return applyUvRect(new Float32Array([split, 0, 1, 0, 1, 1, split, 1]), deckRect)
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
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & PlatformGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const shadowGroupRef = useRef<THREE.Group>(null)

  const { texture: deckArt, rect: deckRect } = useArtSprite(`${layer.id}-deck`)
  // Struts print `<id>-strut` when a piece supplies one, and fall back to raw
  // kraft when it doesn't (missing art resolves to null) — so a platform whose
  // trusses would otherwise out-value its own scene can paint them instead.
  const strutArt = useArtTexture(`${layer.id}-strut`)
  const split = layer.qA / (layer.qA + layer.qB)
  // This piece's own stock (D3 kraft-legibility package): replaces the
  // shared PAPER_TINT/PAPER_SHADE_TINT pair so a mid-turn tangle of several
  // artless platforms separates by tone instead of reading as one mass.
  const tint = useMemo(() => kraftTints(layer.id), [layer.id])

  // The patch LIST (faces, ranks, bays, order) is constant per geometry —
  // only the corners move. Solve once at rest to build it.
  const patches = useMemo(() => solvePlatformPose(layer, Math.PI, 0), [layer])
  const geometries = useMemo(
    () => patches.map((p) => makeFaceGeometry(platformFaceUvs(p.face, split, deckRect))),
    [patches, split, deckRect]
  )
  const edgeGeometries = useMemo(() => patches.map(() => makeEdgeGeometry()), [patches])
  // One hairline material per patch (not shared): artless faces get this
  // piece's own darker `tint.edge` for contrast against same-family
  // neighbors mid-turn; painted faces keep the standard pale cut-edge core.
  const edgeMaterials = useMemo(
    () => patches.map(() => new THREE.LineBasicMaterial({ color: CUT_EDGE_COLOR, transparent: true, opacity: 0.8 })),
    [patches]
  )

  const paperTexture = sharedPaperTexture()
  const materials = useMemo(() => {
    const exterior = patches.map(
      (p) =>
        new THREE.MeshBasicMaterial({
          side: THREE.FrontSide,
          color: isShaded(p.face) ? PAINTED_FOLD_SHADE : '#ffffff',
        })
    )
    return { exterior }
  }, [patches])
  // Every platform's underside is the same raw-paper-stock BackSide wall,
  // pooled (E-G4 fix wave): shared map + fixed color + fixed side, never
  // mutated after acquisition — shared with popup-box-layer's interior too.
  const interiorMaterial = useMemo(
    () => acquireMaterial({ side: THREE.BackSide, map: paperTexture, color: INTERIOR_SHADOW_TINT }),
    [paperTexture]
  )
  useEffect(() => () => releaseMaterial(interiorMaterial), [interiorMaterial])

  // Wire the deck painting (or raw kraft) into each exterior material.
  useEffect(() => {
    patches.forEach((p, i) => {
      const material = materials.exterior[i]
      const art = isDeck(p.face) ? deckArt : strutArt
      material.map = art ?? paperTexture
      if (art) {
        art.wrapS = THREE.ClampToEdgeWrapping
        art.wrapT = THREE.ClampToEdgeWrapping
        material.color.set(isShaded(p.face) ? PAINTED_FOLD_SHADE : '#ffffff')
      } else {
        material.color.set(isShaded(p.face) ? tint.shade : tint.lit)
      }
      material.needsUpdate = true
      edgeMaterials[i].color.set(art ? CUT_EDGE_COLOR : tint.edge)
    })
  }, [patches, materials, edgeMaterials, paperTexture, deckArt, strutArt, tint])

  const shadowTexture = sharedShadowTexture()
  const strutShadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 }),
    [shadowTexture]
  )
  const deckShadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 }),
    [shadowTexture]
  )
  // Key-light placement (shadow-light.ts). The DECK floats high, so its
  // inter-tier pool throws far down-screen-right, deep and spread — the
  // strongest stacked-paper cue. The struts SIT on the page: they keep a
  // tight, near-base footprint (a small fraction of the deck's throw) so the
  // light direction stays consistent without lifting them off their contact.
  const shadowTiers = useMemo(() => {
    const rest = solvePlatformPose(layer, Math.PI, 0)
    const deckPeak = peakHeight(rest.filter((p) => isDeck(p.face)).map((p) => p.quad))
    const deckLift = shadowLift(deckPeak)
    const strutLift = shadowLift(deckPeak * 0.28)
    const applyLift = (spec: ShadowSpec, lift: { dx: number; dz: number; spread: number }): ShadowSpec => ({
      position: [spec.position[0] + lift.dx, spec.position[1], spec.position[2] + lift.dz],
      size: [spec.size[0] * lift.spread, spec.size[1] * lift.spread],
    })
    return {
      strut: strutShadowSpecs(layer).map((s) => applyLift(s, strutLift)),
      strutMax: STRUT_SHADOW_MAX * strutLift.depth,
      deck: applyLift(deckShadowSpec(layer), deckLift),
      deckMax: DECK_SHADOW_MAX * deckLift.depth,
    }
  }, [layer])

  // paperTexture/shadowTexture are shared singletons — never disposed
  // per-instance; interiorMaterial is pooled — released above.
  useGuardedDispose([
    ...geometries,
    ...edgeGeometries,
    ...edgeMaterials,
    ...materials.exterior,
    strutShadowMaterial,
    deckShadowMaterial,
  ])

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
    strutShadowMaterial.opacity = shadowTiers.strutMax * contact
    deckShadowMaterial.opacity = shadowTiers.deckMax * contact
  })

  return (
    <>
      <group ref={groupRef} visible={false}>
        {patches.map((p, i) => (
          <group key={`${p.face}-${p.rank}-${p.bay}`}>
            <mesh geometry={geometries[i]} material={materials.exterior[i]} renderOrder={0} />
            <mesh geometry={geometries[i]} material={interiorMaterial} renderOrder={0} />
            <lineLoop geometry={edgeGeometries[i]} material={edgeMaterials[i]} renderOrder={1} />
          </group>
        ))}
      </group>
      {/* renderOrder=-1: both shadow tiers join the gutter crease's early
          transparent tier (D-G3 audit; book.tsx precedent). */}
      <group ref={shadowGroupRef} visible={false}>
        {shadowTiers.strut.map((spec, i) => (
          <mesh
            key={`strut-shadow-${i}`}
            position={spec.position}
            rotation={[-Math.PI / 2, 0, 0]}
            material={strutShadowMaterial}
            renderOrder={-1}
          >
            <planeGeometry args={spec.size} />
          </mesh>
        ))}
        <mesh
          position={shadowTiers.deck.position}
          rotation={[-Math.PI / 2, 0, 0]}
          material={deckShadowMaterial}
          renderOrder={-1}
        >
          <planeGeometry args={shadowTiers.deck.size} />
        </mesh>
      </group>
    </>
  )
}
