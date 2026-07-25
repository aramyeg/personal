'use client'

/**
 * Renders one box-fold layer (popup-mechanics.ts §4): an enclosed paper
 * prism with per-face art. Faces load their own paintings from the art
 * pipeline — `<id>-front`, `<id>-back`, `<id>-side`, `<id>-top` — and any
 * face without baked art renders as raw paper stock, which is exactly what
 * an unprinted handmade box looks like (and what the volumetric benchmark's
 * C5 gate wants for interiors). Exteriors draw front-side only with the
 * art; every patch also draws its BACK side as raw paper, so a hollow
 * box's interior reads as unpainted stock rather than mirrored art.
 *
 * Corner order comes from solveBoxPose ([bl, br, tr, tl] seen from outside
 * at rest), so each face's uvs are the identity square — split in half for
 * the paired faces (caps, lid, roof), whose shared crease sits at u = 0.5.
 *
 * INFRA-2: those four assets resolve through `useArtSprite`, so a box whose
 * faces are packed onto a shared atlas page addresses its regions instead of
 * fetching four webps of its own — the single largest texture-file win left in
 * the book (every chapter spread carries at least one box, and the terraced
 * spreads carry two). Each face composes TWO uv transforms: its own half-split
 * within the asset (`FACE_ART`), then the asset's rect within the page. All four
 * assets are addressed independently, so a box may be half-packed with no
 * special case.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { kraftTints } from './paper-stock'
import {
  liveSpreadRole,
  solveBoxPose,
  spreadPageAnglesTilted,
  type BoxFace,
  type BoxGeom,
} from './popup-mechanics'
import { easeTurnWeighted } from './page-geometry'
import { peakHeight, shadowLift } from './shadow-light'
import { acquireMaterial, releaseMaterial } from './material-pool'
import { sharedPaperTexture, sharedShadowTexture } from './shared-procedural-textures'
import type { TurnFrame } from './use-turn-driver'
import { SLIVER_TIER, useArtSprite } from './use-layer-texture'
import { applyUvRect, type UvRect } from '../art-atlas'

const FLAT_EPSILON = 0.02
const SHADOW_Y_LIFT = 0.001
const SHADOW_MAX_OPACITY = 0.32
// E-G5 floor (f): PAINTED shaded faces read a step darker than their lit
// sibling to sell the crease, but with a gentle NEUTRAL dim. The old warm fold
// seam (#d9cdb4, ~x0.85/0.80/0.71) both dimmed AND warm-cast the artwork, so
// half of every folded piece read as a different print; a painting carries its
// own light, so its crease only needs a faint neutral hint. The warm seam is
// reserved for raw placeholder stock (per-piece kraftTints), never painted art.
const PAINTED_FOLD_SHADE = '#e4e4e4'
// Caps face the reader straight-on and catch less of the key light than
// the top — a half-step tint keeps front/top from reading as one surface.
const CAP_TINT = '#f2ebdc'
// Interior surfaces sit in deep shadow. The materials are unlit, so
// without this an open-front room's back wall renders as bright as an
// exterior face and the opening reads as a solid wall (user, C6 round 2:
// "they aren't open, there is clearly a wall right behind it") — the
// darkness IS the hollow.
const INTERIOR_SHADOW_TINT = '#5f5138'
// C5 paper physicality: every patch border draws a hairline in the
// sheet's pale core color — cut edges and scored fold lines both read as
// lighter lines on a real paper model, and they are what makes a box
// read as CONSTRUCTED from sheets rather than extruded.
const CUT_EDGE_COLOR = '#f6eedb'

/** The four per-face assets a box prints, keyed as `FACE_ART` names them. */
type BoxAsset = 'front' | 'back' | 'side' | 'top'
/** Each asset's atlas region, or null where it owns its whole texture. */
type BoxRects = Readonly<Record<BoxAsset, UvRect | null>>

/** Which art asset a face prints, and which horizontal half of it. */
const FACE_ART: Record<BoxFace, { asset: BoxAsset | null; u0: number; u1: number }> = {
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

/** The darker sibling of each split pair (and the always-shaded backbone). */
const SHADED_FACES: ReadonlySet<BoxFace> = new Set(['wallL', 'lidL', 'roofL', 'capBackL', 'capBackR', 'backbone'])

/** A face's uvs: its half of the asset, then that asset's region of the atlas
 *  page it was packed onto (identity when the asset owns its own texture). */
const faceUvs = (face: BoxFace, rects: BoxRects): Float32Array => {
  const { asset, u0, u1 } = FACE_ART[face]
  const own = new Float32Array([u0, 0, u1, 0, u1, 1, u0, 1])
  return applyUvRect(own, asset ? rects[asset] : null)
}

function makeFaceGeometry(face: BoxFace, rects: BoxRects): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(12), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  geometry.setAttribute('uv', new THREE.BufferAttribute(faceUvs(face, rects), 2))
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1))
  return geometry
}

/** Hairline loop around a patch's border (positions shared per frame with
 *  the face quad) — the cut-edge/scored-crease line of the C5 gate. */
function makeEdgeGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(12), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  return geometry
}

export function BoxPopupLayer({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & BoxGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const shadowRef = useRef<THREE.Mesh>(null)

  // Fix C tiering: the front cap faces the reader straight-on (full 1024
  // art), but the top/back/side faces are edge-on slivers or hollow-interior
  // faces at the reading camera — half-size, no mips.
  const front = useArtSprite(`${layer.id}-front`)
  const back = useArtSprite(`${layer.id}-back`, SLIVER_TIER)
  const side = useArtSprite(`${layer.id}-side`, SLIVER_TIER)
  const top = useArtSprite(`${layer.id}-top`, SLIVER_TIER)
  const frontArt = front.texture
  const backArt = back.texture
  const sideArt = side.texture
  const topArt = top.texture
  // Rects change exactly once per box (null -> resolved, when the sidecar and
  // the page land), so the geometry rebuild they trigger below is a one-off.
  const rects = useMemo<BoxRects>(
    () => ({ front: front.rect, back: back.rect, side: side.rect, top: top.rect }),
    [front.rect, back.rect, side.rect, top.rect]
  )
  // This piece's own stock (D3 kraft-legibility package): replaces the
  // shared PAPER_TINT/PAPER_SHADE_TINT pair so a mid-turn tangle of several
  // artless boxes separates by tone instead of reading as one mass.
  const tint = useMemo(() => kraftTints(layer.id), [layer.id])

  // Fix D — cut-edge hairlines are gated to hero-kind pieces. A per-face
  // lineLoop is ~50% extra draw calls on a dense box stack (the s4 keep), and
  // at the reading distance the hairline is illegible on the non-hero story
  // props and the keep's own backdrop-kind tiers. Heroes (the pieces the eye
  // lands on) keep it; everything else drops it. The keep's legible reading-
  // distance edges — its balcony deck and fan spire — are their own rides in
  // popup-keepstack-layer and are unaffected by this box-face gate.
  const showCutEdge = layer.kind === 'hero'
  // Fix E — the interior BackSide walls only ever read through an OPENING: a
  // hollow-top 'open' roof, or a suppressed front/back cap. A fully sealed box
  // (flat/gable roof, both caps — every keep tier, the hive, the strongbox)
  // occludes its own interior from every angle, so that second per-face draw
  // is pure waste. Static from the geometry, so no mid-turn popping is possible
  // (a sealed box never exposes an interior at any dihedral angle).
  const needsInterior = layer.roof === 'open' || layer.capFront === false || layer.capBack === false

  // The face list is constant per geometry — only the corners move.
  const faces = useMemo(() => solveBoxPose(layer, Math.PI, 0).map((p) => p.face), [layer])
  const geometries = useMemo(() => faces.map((face) => makeFaceGeometry(face, rects)), [faces, rects])
  const edgeGeometries = useMemo(() => (showCutEdge ? faces.map(() => makeEdgeGeometry()) : []), [faces, showCutEdge])
  // One hairline material per face (not shared): artless faces get this
  // piece's own darker `tint.edge` for contrast against same-family
  // neighbors mid-turn; painted faces keep the standard pale cut-edge core.
  const edgeMaterials = useMemo(
    () =>
      showCutEdge
        ? faces.map(() => new THREE.LineBasicMaterial({ color: CUT_EDGE_COLOR, transparent: true, opacity: 0.8 }))
        : [],
    [faces, showCutEdge]
  )

  const paperTexture = sharedPaperTexture()
  const materials = useMemo(() => {
    const exterior = faces.map(
      (face) =>
        new THREE.MeshBasicMaterial({
          side: THREE.FrontSide,
          color: SHADED_FACES.has(face) ? PAINTED_FOLD_SHADE : face.startsWith('capFront') ? CAP_TINT : '#ffffff',
        })
    )
    return { exterior }
  }, [faces])
  // Every box's interior is the same raw-paper-stock BackSide wall, pooled
  // (E-G4 fix wave): shared map + fixed color + fixed side, never mutated
  // after acquisition, so every box in the book shares this ONE material.
  const interiorMaterial = useMemo(
    () => acquireMaterial({ side: THREE.BackSide, map: paperTexture, color: INTERIOR_SHADOW_TINT }),
    [paperTexture]
  )
  useEffect(() => () => releaseMaterial(interiorMaterial), [interiorMaterial])

  // Wire each face's art (or raw paper) into its exterior material. LAYOUT
  // effect (not passive): the map binds BEFORE paint, so any future material-
  // identity churn can never commit an unmapped pure-white frame (the E-G4 turn
  // flash; the keepstack's inline-layer churn was the trigger, now also memoized).
  useLayoutEffect(() => {
    const art = { front: frontArt, back: backArt, side: sideArt, top: topArt }
    faces.forEach((face, i) => {
      const asset = FACE_ART[face].asset
      // A tier with a die-cut facade plate (keepstack) suppresses its own cap-
      // front art: the plate prints the front, and the cap stays raw bracing
      // paper hidden behind it (never the uncropped plate art stretched to the
      // cap aspect).
      const suppressed = asset === 'front' && layer.capFrontArt === false
      const texture = asset && !suppressed ? art[asset] : null
      const material = materials.exterior[i]
      material.map = texture ?? paperTexture
      // A plate-suppressed cap renders in INTERIOR shadow, not raw kraft: the cap
      // sits behind (and mostly under) the die-cut plate, so any exposed strip
      // above a shorter plate must read as recession/depth behind the silhouette
      // (the fallback hall plate leaves a cap strip above it), never a bright
      // paper block.
      if (!texture) material.color.set(suppressed ? INTERIOR_SHADOW_TINT : SHADED_FACES.has(face) ? tint.shade : tint.lit)
      if (texture) {
        texture.wrapS = THREE.ClampToEdgeWrapping
        texture.wrapT = THREE.ClampToEdgeWrapping
      }
      material.needsUpdate = true
      // Edge material only exists on hero-kind pieces (fix D); on everything
      // else edgeMaterials is empty and there is no hairline to recolor.
      edgeMaterials[i]?.color.set(texture ? CUT_EDGE_COLOR : tint.edge)
    })
  }, [faces, materials, edgeMaterials, paperTexture, frontArt, backArt, sideArt, topArt, tint, layer.capFrontArt])

  // Contact-shadow map is a parameter-free radial blob (shared-procedural-
  // textures.ts) — the material itself stays owned (opacity is rewritten
  // every frame below from this box's own live lift, so it can never share
  // identity with another box's shadow material).
  const shadowTexture = sharedShadowTexture()
  const shadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 }),
    [shadowTexture]
  )
  // Contact pool placed and weighted by the book's key light (shadow-light.ts):
  // a box stands tall, so it throws a deep pool offset down-screen-right. Peak
  // height comes from one flat-open solve — pure math, computed once.
  const shadowSpec = useMemo(() => {
    const rest = solveBoxPose(layer, Math.PI, 0)
    const lift = shadowLift(peakHeight(rest.map((p) => p.quad)))
    return {
      position: [lift.dx, SHADOW_Y_LIFT, (layer.z0 + layer.z1) / 2 + lift.dz] as [number, number, number],
      size: [layer.a * 2 * 1.05 * lift.spread, (layer.z1 - layer.z0) * 1.05 * lift.spread] as [number, number],
      maxOpacity: SHADOW_MAX_OPACITY * lift.depth,
    }
  }, [layer])

  useEffect(
    () => () => {
      geometries.forEach((g) => g.dispose())
      edgeGeometries.forEach((g) => g.dispose())
      edgeMaterials.forEach((m) => m.dispose())
      materials.exterior.forEach((m) => m.dispose())
      shadowMaterial.dispose()
      // paperTexture/shadowTexture are shared singletons (shared-procedural-
      // textures.ts) — never disposed per-instance; interiorMaterial is
      // pooled — released above, not disposed here.
    },
    [geometries, edgeGeometries, edgeMaterials, materials, shadowMaterial]
  )

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
    if (shadowRef.current) shadowRef.current.visible = visible
    if (!visible) return

    const patches = solveBoxPose(layer, thetaL, thetaR)
    patches.forEach((patch, i) => {
      // The edge geometry only exists on hero-kind pieces (fix D); skip its
      // per-frame position rewrite entirely when there is no hairline.
      const targets = showCutEdge ? [geometries[i], edgeGeometries[i]] : [geometries[i]]
      for (const geometry of targets) {
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

    shadowMaterial.opacity = shadowSpec.maxOpacity * Math.sin(beta / 2) ** 2
  })

  return (
    <>
      <group ref={groupRef} visible={false}>
        {faces.map((face, i) => (
          <group key={face}>
            <mesh geometry={geometries[i]} material={materials.exterior[i]} renderOrder={0} />
            {/* Interior BackSide only when the box has an opening (fix E). */}
            {needsInterior && <mesh geometry={geometries[i]} material={interiorMaterial} renderOrder={0} />}
            {/* Cut-edge hairline only on hero-kind pieces (fix D). */}
            {showCutEdge && <lineLoop geometry={edgeGeometries[i]} material={edgeMaterials[i]} renderOrder={1} />}
          </group>
        ))}
      </group>
      {/* renderOrder=-1: ground shading joins the gutter crease's early
          transparent tier (D-G3 audit; book.tsx precedent). */}
      <mesh
        ref={shadowRef}
        position={shadowSpec.position}
        rotation={[-Math.PI / 2, 0, 0]}
        material={shadowMaterial}
        renderOrder={-1}
        visible={false}
      >
        <planeGeometry args={shadowSpec.size} />
      </mesh>
    </>
  )
}
