'use client'

/**
 * THE MERGED KEEP (Batch C-2). The keep is the book's densest piece — three box
 * stories (9 faces each), three die-cut facade plates, the balcony deck, three
 * fan-spire members and the raven finial, drawn as ~50 separate meshes. Every
 * one of those meshes is the SAME unlit paper material with a different picture
 * on it, so the whole keep collapses into ONE BufferGeometry sampling ONE atlas
 * page (components/labs/storybook/art-atlas.ts):
 *
 *   ~50 draws  ->  1 art mesh + 1 merged hairline LineSegments + 3 contact
 *                  shadows (+1 interior shell if any story is ever hollowed).
 *
 * NOTHING about the paper physics changes. The solvers (solveBoxPose via
 * keepStackStoryGeoms, keepStackFacadePlate, keepStackBalconyDeck,
 * keepStackSpirePoses, keepStackSpireRaven) are called EXACTLY as the
 * per-mesh renderer called them, in the same order, and their world quads are
 * written straight into a DynamicDrawUsage position attribute. Every fold-flat,
 * wedge and containment proof the keep shipped with is untouched — this is a
 * draw-call change, not a geometry change.
 *
 * Two things a single material cannot do on its own, and how they are kept:
 *  - PER-FACE TINT (the shaded sibling of each split pair, the cap half-step,
 *    the interior-shadow recess behind a die-cut plate) becomes a static
 *    per-vertex `color` attribute with `vertexColors: true`, which the unlit
 *    shader multiplies exactly as `material.color` did.
 *  - FACES WITH NO ART OF THEIR OWN (the backbone; a cap whose art is suppressed
 *    because a die-cut plate prints that front) used to sample raw paper stock.
 *    They now sample their story's own `-side` region — an opaque wall texture —
 *    under the same tint they had before. Both are hidden surfaces: the backbone
 *    sits at y=0 inside a closed box, and a suppressed cap sits behind the plate
 *    that covers it edge to edge.
 *
 * The merge is GATED on the atlas: if any of the keep's art ids is missing from
 * the sidecar, `KeepStackPopupLayer` renders the legacy per-mesh path instead,
 * which is byte-for-byte what shipped before.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import type { UvRect } from '../art-atlas'
import { applyUvRect } from '../art-atlas'
import type { BoxFace, PanelQuad } from './popup-mechanics'
import { liveSpreadRole, solveBoxPose, spreadPageAnglesTilted } from './popup-mechanics'
import {
  keepStackBalconyDeck,
  keepStackFacadePlate,
  keepStackSpirePoses,
  keepStackSpireRaven,
  keepStackStoryGeoms,
  type KeepStackGeom,
} from './popup-keepstack'
import { easeTurnWeighted } from './page-geometry'
import { peakHeight, shadowLift } from './shadow-light'
import { sharedShadowTexture } from './shared-procedural-textures'
import type { TurnFrame } from './use-turn-driver'
import type { AtlasSet } from './use-layer-texture'
import {
  BALCONY_DECK_UVS,
  CUT_EDGE_COLOR,
  FACADE_PLATE_UVS,
  RAVEN_FINIAL_UVS,
  SPIRE_MEMBER_UVS,
} from './popup-keepstack-uvs'

const FLAT_EPSILON = 0.02
const SHADOW_Y_LIFT = 0.001
const SHADOW_MAX_OPACITY = 0.32

// The three per-face tints, verbatim from popup-box-layer.tsx (see its comments
// for why each exists) — here they become vertex colors instead of materials.
const PAINTED_FOLD_SHADE = '#e4e4e4'
const CAP_TINT = '#f2ebdc'
const INTERIOR_SHADOW_TINT = '#5f5138'
const PLAIN = '#ffffff'

/** Which art asset a box face prints, and which horizontal half of it —
 *  the same table popup-box-layer.tsx uses (`backbone` prints nothing). */
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

const SHADED_FACES: ReadonlySet<BoxFace> = new Set(['wallL', 'lidL', 'roofL', 'capBackL', 'capBackR', 'backbone'])

/** One merged quad: where its art lives, how it is tinted, whether it draws a
 *  cut-edge hairline, and how to fetch its four world corners this frame. */
type Slot = {
  readonly artId: string
  readonly uvs: Float32Array
  readonly tint: string
  readonly hairline: boolean
}

/** The per-frame source of every slot's corners, solved once per family. */
type SolvedKeep = {
  box: readonly (readonly { face: BoxFace; quad: PanelQuad }[])[]
  plates: readonly (readonly [PanelQuad, PanelQuad] | null)[]
  balcony: readonly [PanelQuad, PanelQuad] | null
  spire: readonly (readonly [PanelQuad, PanelQuad])[]
  raven: readonly [PanelQuad, PanelQuad] | null
}

function solveKeep(geom: KeepStackGeom, thetaL: number, thetaR: number): SolvedKeep {
  const stories = keepStackStoryGeoms(geom)
  const box = stories.map((g) => solveBoxPose(g, thetaL, thetaR).map((p) => ({ face: p.face, quad: p.quad })))
  const plates = stories.map((g) => {
    if (!g.plate) return null
    const plate = keepStackFacadePlate(geom, g.key, thetaL, thetaR)
    return plate ? ([plate.plateL, plate.plateR] as const) : null
  })
  const deck = keepStackBalconyDeck(geom, thetaL, thetaR)
  const poses = keepStackSpirePoses(geom, thetaL, thetaR)
  const finial = keepStackSpireRaven(geom, thetaL, thetaR)
  return {
    box,
    plates,
    balcony: deck ? ([deck.deckL, deck.deckR] as const) : null,
    spire: poses ? poses.map((p) => [p.left, p.right] as const) : [],
    raven: finial ? ([finial.crestL, finial.crestR] as const) : null,
  }
}

/**
 * The keep's slot table, in the fixed order the merged buffers use. Derived
 * from geometry alone (a flat-open solve names the faces), so it is stable for
 * the layer's whole lifetime and the per-frame writer can index into it.
 */
export function keepSlots(layer: SceneLayer & KeepStackGeom): Slot[] {
  const slots: Slot[] = []
  const stories = keepStackStoryGeoms(layer)
  for (const g of stories) {
    for (const patch of solveBoxPose(g, Math.PI, 0)) {
      const face = patch.face
      const { asset, u0, u1 } = FACE_ART[face]
      // A face with no art of its own (backbone) or whose front art is printed
      // by a die-cut plate instead samples the story's opaque `-side` wall; both
      // are surfaces the reader never sees (see the file header).
      const suppressed = asset === 'front' && !!g.plate
      const printed = asset !== null && !suppressed
      slots.push({
        artId: `${layer.id}-${g.key}-${printed ? asset : 'side'}`,
        uvs: printed
          ? new Float32Array([u0, 0, u1, 0, u1, 1, u0, 1])
          : new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
        tint: suppressed
          ? INTERIOR_SHADOW_TINT
          : SHADED_FACES.has(face)
            ? PAINTED_FOLD_SHADE
            : face.startsWith('capFront')
              ? CAP_TINT
              : PLAIN,
        hairline: false,
      })
    }
  }
  for (const g of stories) {
    if (!g.plate) continue
    for (const uvs of FACADE_PLATE_UVS) {
      slots.push({ artId: `${layer.id}-${g.key}-front`, uvs: new Float32Array(uvs), tint: PLAIN, hairline: false })
    }
  }
  // DIE-CUT PIECES DRAW NO QUAD-BORDER HAIRLINE. A cut-edge hairline marks where
  // the paper was cut; on a die-cut piece the cut runs INSIDE the quad, so tracing
  // the quad border draws a box around the silhouette instead of along it. The
  // balcony desk and the spire sails are both die-cut art, and at the pinned
  // camera the three spire members' borders read as a wireframe CAGE around the
  // spire (orchestrator eye-test round 1). Their true cut edge is carried by the
  // baked pale rim in the art (T1/T-EDGE), which is what the ring pieces use.
  if (layer.balcony) {
    for (const uvs of BALCONY_DECK_UVS) {
      slots.push({ artId: `${layer.id}-balcony`, uvs: new Float32Array(uvs), tint: PLAIN, hairline: false })
    }
  }
  layer.spire?.members.forEach((_, i) => {
    for (const uvs of SPIRE_MEMBER_UVS) {
      slots.push({ artId: `${layer.id}-spire-m${i}`, uvs: new Float32Array(uvs), tint: PLAIN, hairline: false })
    }
  })
  if (layer.spire?.raven) {
    for (const uvs of RAVEN_FINIAL_UVS) {
      slots.push({ artId: `${layer.id}-raven`, uvs: new Float32Array(uvs), tint: PLAIN, hairline: false })
    }
  }
  return slots
}

/** Every art id the merged keep samples — the set the atlas must cover for the
 *  merge to be legal (exported so the layer can gate on it before mounting). */
export function keepAtlasIds(layer: SceneLayer & KeepStackGeom): string[] {
  return [...new Set(keepSlots(layer).map((s) => s.artId))].sort()
}

/** Walk the solved families in slot order, handing each slot its quad. */
function eachSlotQuad(
  layer: SceneLayer & KeepStackGeom,
  solved: SolvedKeep,
  visit: (index: number, quad: PanelQuad | null) => void
): void {
  let i = 0
  for (const patches of solved.box) for (const p of patches) visit(i++, p.quad)
  solved.plates.forEach((plate, k) => {
    // Slots exist only for PLATED stories (keepSlots skips the others), so the
    // walk must skip them here too or every later slot shifts by two.
    if (!layer.stories[k]?.plate) return
    visit(i++, plate?.[0] ?? null)
    visit(i++, plate?.[1] ?? null)
  })
  if (layer.balcony) {
    visit(i++, solved.balcony?.[0] ?? null)
    visit(i++, solved.balcony?.[1] ?? null)
  }
  layer.spire?.members.forEach((_, k) => {
    visit(i++, solved.spire[k]?.[0] ?? null)
    visit(i++, solved.spire[k]?.[1] ?? null)
  })
  if (layer.spire?.raven) {
    visit(i++, solved.raven?.[0] ?? null)
    visit(i++, solved.raven?.[1] ?? null)
  }
}

function buildArtGeometry(slots: readonly Slot[], rects: ReadonlyMap<string, UvRect>): THREE.BufferGeometry {
  const n = slots.length
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  const uv = new Float32Array(n * 4 * 2)
  const color = new Float32Array(n * 4 * 3)
  const index = new Uint16Array(n * 6)
  const c = new THREE.Color()
  slots.forEach((slot, s) => {
    uv.set(applyUvRect(slot.uvs, rects.get(slot.artId) ?? null), s * 8)
    c.set(slot.tint)
    for (let v = 0; v < 4; v++) {
      color[(s * 4 + v) * 3] = c.r
      color[(s * 4 + v) * 3 + 1] = c.g
      color[(s * 4 + v) * 3 + 2] = c.b
    }
    const base = s * 4
    index.set([base, base + 1, base + 2, base, base + 2, base + 3], s * 6)
  })
  geometry.setAttribute('position', positions)
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 3))
  geometry.setIndex(new THREE.BufferAttribute(index, 1))
  return geometry
}

/** One LineSegments carrying every hairline slot's four border edges. */
function buildEdgeGeometry(count: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(count * 4 * 2 * 3), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  return geometry
}

export function KeepStackMergedLayer({
  layer,
  atlas,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & KeepStackGeom
  atlas: AtlasSet
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const shadowGroupRef = useRef<THREE.Group>(null)

  const slots = useMemo(() => keepSlots(layer), [layer])
  const hairlineSlots = useMemo(
    () => slots.map((s, i) => (s.hairline ? i : -1)).filter((i) => i >= 0),
    [slots]
  )
  const geometry = useMemo(() => buildArtGeometry(slots, atlas.rects), [slots, atlas.rects])
  const edgeGeometry = useMemo(() => buildEdgeGeometry(hairlineSlots.length), [hairlineSlots])

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        map: atlas.texture,
        // Per-face tints ride the vertex color attribute; `color` stays white so
        // the shader's map * vColor * color reproduces the per-mesh materials.
        color: '#ffffff',
        vertexColors: true,
        // Cutout (not blended) transparency: the die-cut plates, raven and spire
        // members carry alpha, solid faces are baked opaque so this is a no-op
        // on them. Blending is deliberately OFF — a merged mesh cannot be depth
        // sorted per quad, and every keep surface is opaque or a hard cut.
        alphaTest: 0.1,
      }),
    [atlas.texture]
  )
  const edgeMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: CUT_EDGE_COLOR, transparent: true, opacity: 0.8 }),
    []
  )

  // One contact pool per story, placed exactly as popup-box-layer places its own
  // (peak height of the flat-open solve -> shadow-light's key-light offsets).
  const shadowTexture = sharedShadowTexture()
  const shadowSpecs = useMemo(
    () =>
      keepStackStoryGeoms(layer).map((g) => {
        const rest = solveBoxPose(g, Math.PI, 0)
        const lift = shadowLift(peakHeight(rest.map((p) => p.quad)))
        return {
          key: g.key,
          position: [lift.dx, SHADOW_Y_LIFT, (g.z0 + g.z1) / 2 + lift.dz] as [number, number, number],
          size: [g.a * 2 * 1.05 * lift.spread, (g.z1 - g.z0) * 1.05 * lift.spread] as [number, number],
          maxOpacity: SHADOW_MAX_OPACITY * lift.depth,
        }
      }),
    [layer]
  )
  const shadowMaterials = useMemo(
    () =>
      shadowSpecs.map(
        () => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 })
      ),
    [shadowSpecs, shadowTexture]
  )

  useEffect(
    () => () => {
      geometry.dispose()
      edgeGeometry.dispose()
      material.dispose()
      edgeMaterial.dispose()
      shadowMaterials.forEach((m) => m.dispose())
      // The atlas texture is shared and refcounted by useAtlasSet; the shadow
      // texture is a module singleton. Neither is disposed here.
    },
    [geometry, edgeGeometry, material, edgeMaterial, shadowMaterials]
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

    const solved = solveKeep(layer, thetaL, thetaR)
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const edgeArr = (edgeGeometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
    const edgeIndex = new Map(hairlineSlots.map((slot, e) => [slot, e]))

    eachSlotQuad(layer, solved, (i, quad) => {
      const base = i * 12
      if (!quad) {
        // A family that solved to null this frame collapses to a degenerate
        // point rather than drawing stale corners.
        arr.fill(0, base, base + 12)
      } else {
        for (let c = 0; c < 4; c++) {
          arr[base + c * 3] = quad[c][0]
          arr[base + c * 3 + 1] = quad[c][1]
          arr[base + c * 3 + 2] = quad[c][2]
        }
      }
      const e = edgeIndex.get(i)
      if (e === undefined) return
      const eb = e * 24
      for (let c = 0; c < 4; c++) {
        const a = quad ? quad[c] : ([0, 0, 0] as const)
        const b = quad ? quad[(c + 1) % 4] : ([0, 0, 0] as const)
        edgeArr[eb + c * 6] = a[0]
        edgeArr[eb + c * 6 + 1] = a[1]
        edgeArr[eb + c * 6 + 2] = a[2]
        edgeArr[eb + c * 6 + 3] = b[0]
        edgeArr[eb + c * 6 + 4] = b[1]
        edgeArr[eb + c * 6 + 5] = b[2]
      }
    })

    pos.needsUpdate = true
    geometry.computeBoundingSphere()
    const edgePos = edgeGeometry.getAttribute('position') as THREE.BufferAttribute
    edgePos.needsUpdate = true
    edgeGeometry.computeBoundingSphere()

    const openness = Math.sin(beta / 2) ** 2
    shadowMaterials.forEach((m, i) => {
      m.opacity = shadowSpecs[i].maxOpacity * openness
    })
  })

  return (
    <>
      <group ref={groupRef} name={`keepstack-${layer.id}`} visible={false}>
        <mesh geometry={geometry} material={material} renderOrder={0} />
        {hairlineSlots.length > 0 && (
          <lineSegments geometry={edgeGeometry} material={edgeMaterial} renderOrder={1} />
        )}
      </group>
      <group ref={shadowGroupRef} visible={false}>
        {shadowSpecs.map((spec, i) => (
          <mesh
            key={spec.key}
            position={spec.position}
            rotation={[-Math.PI / 2, 0, 0]}
            material={shadowMaterials[i]}
            renderOrder={-1}
          >
            <planeGeometry args={spec.size} />
          </mesh>
        ))}
      </group>
    </>
  )
}
