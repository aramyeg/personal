'use client'

/**
 * Renders one KNOB-TWIST TOWER layer (popup-knobtower.ts, D6): a die-cut knob
 * disc riveted flat into the page plus a row of N staggered knee towers that
 * the crank erects as the knob is twisted. PAGE-ROOTED like the tab piece —
 * one page carries the whole assembly.
 *
 * Follows the tab-piece / rotor layer conventions: unlit print, per-piece
 * kraft fallback tints, a BackSide interior mesh in deep shadow, cut-edge
 * hairlines, DynamicDrawUsage positions rewritten per frame, contact shadows
 * scaled by each tier's own lift.
 *
 * Art: the DISC prints `<id>-disc` as a circular die-cut (its placeholder is a
 * spoked knob carrying the H4 thumb notch + arrow arc so the twist reads
 * before it is touched); each tier prints `<id>-tier<k>` as its unfolded mound
 * (u along the spine, v the unrolled slide — 0 at the inner hinge, 1 at the
 * fore hinge, the ridge break at v=0.5). Each tier owns its own art texture, so
 * a subcomponent per tier keeps the hooks at the top level.
 *
 * For NOW the knob angle is a frozen dev override (`?sbknob=<deg>`); the
 * interactive gesture (hand-interaction-laws H1-H4) is a later wave. In normal
 * viewing the knob rests untwisted (theta 0), so the towers lie flat.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { makeKnobCanvas, makePaperCanvas, makeShadowCanvas } from '../procedural/paper-texture'
import { makeCanvasTexture } from './book'
import { kraftTints } from './paper-stock'
import { liveSpreadRole, spreadPageAnglesTilted, type KnobTowerGeom } from './popup-mechanics'
import { knobTowerThetaMax, knobTowerTierLift, solveKnobTowerPose } from './popup-knobtower'
import { shadowLift } from './shadow-light'
import { easeTurnWeighted } from './page-geometry'
import type { TurnFrame } from './use-turn-driver'
import { useArtTexture } from './use-layer-texture'

const FLAT_EPSILON = 0.02
const SHADOW_Y_LIFT = 0.001
const STRUCT_SHADOW_MAX = 0.28
const FOLD_SHADE_TINT = '#d9cdb4'
const INTERIOR_SHADOW_TINT = '#5f5138'
const CUT_EDGE_COLOR = '#f6eedb'
const rad = (d: number): number => (d * Math.PI) / 180

/** Dev-only knob-angle override for the D6 look-dev harness: `?sbknob=<deg>`
 *  freezes the twist at that angle (the parent clamps it to [0, THETA_MAX]);
 *  absent, the knob rests untwisted (theta 0). The interactive gesture wiring
 *  (hand-interaction-laws H1-H4) is a later wave — this reads a static value,
 *  no pointer handling. Same pattern as use-turn-driver's `?sbpose`; compiled
 *  out of production builds. */
function readKnobOverrideDeg(): number | null {
  if (process.env.NODE_ENV === 'production') return null
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('sbknob')
  if (raw === null) return null
  const deg = Number(raw)
  return Number.isFinite(deg) ? deg : null
}

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

function writeQuad(geometry: THREE.BufferGeometry, quad: readonly (readonly [number, number, number])[]): void {
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

/** The turn-clock page angles + live role for this spread, shared by the disc
 *  and every tier so they tick on one driver clock (never a React prop). */
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

/** The coplanar knob disc — a circular die-cut riveted flat into the page,
 *  spun by the frozen knob angle. Rides its page coplanar, so it casts no
 *  contact shadow (the rotor rule). */
function KnobDisc({
  layer,
  knobTheta,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & KnobTowerGeom
  knobTheta: number
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const art = useArtTexture(`${layer.id}-disc`)
  const tint = useMemo(() => kraftTints(`${layer.id}-disc`), [layer.id])
  const readAngles = usePageAngles(spreadIndex, frame, committedSpread)

  const geometry = useMemo(() => makeQuadGeometry(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])), [])
  // Placeholder is a spoked knob (thumb notch + arrow arc, H4) so the twist
  // reads before real art lands; its transparent corners keep the die-cut
  // circular under the material's alphaTest.
  const knobTexture = useMemo(() => makeCanvasTexture(makeKnobCanvas(256, 256)), [])
  const materials = useMemo(
    () => ({
      front: new THREE.MeshBasicMaterial({ side: THREE.FrontSide, transparent: true, alphaTest: 0.1, color: '#ffffff' }),
      back: new THREE.MeshBasicMaterial({ side: THREE.BackSide, transparent: true, alphaTest: 0.1, color: tint.shade }),
    }),
    [tint]
  )

  useEffect(() => {
    const texture = art ?? knobTexture
    if (art) {
      art.wrapS = THREE.ClampToEdgeWrapping
      art.wrapT = THREE.ClampToEdgeWrapping
    }
    materials.front.map = texture
    materials.front.color.set(art ? '#ffffff' : tint.lit)
    materials.back.map = texture
    materials.back.color.set(tint.shade)
    materials.front.needsUpdate = true
    materials.back.needsUpdate = true
  }, [art, knobTexture, materials, tint])

  useEffect(
    () => () => {
      geometry.dispose()
      materials.front.dispose()
      materials.back.dispose()
      knobTexture.dispose()
    },
    [geometry, materials, knobTexture]
  )

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const { role, thetaL, thetaR, beta } = readAngles()
    const visible = role !== 'hidden' && beta > FLAT_EPSILON
    group.visible = visible
    if (!visible) return
    const patches = solveKnobTowerPose(layer, knobTheta, thetaL, thetaR)
    writeQuad(geometry, patches[0].quad) // 'disc' is always the first patch
  })

  return (
    <group ref={groupRef} visible={false}>
      <mesh geometry={geometry} material={materials.front} renderOrder={0} />
      <mesh geometry={geometry} material={materials.back} renderOrder={0} />
    </group>
  )
}

/** One knee tier — a mound of two slope panels over a ridge band, standing IN
 *  the page. Owns its own art texture (`<id>-tier<k>`) and a contact shadow
 *  scaled by its own current lift. */
function KnobTier({
  layer,
  k,
  knobTheta,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & KnobTowerGeom
  k: number
  knobTheta: number
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const shadowGroupRef = useRef<THREE.Group>(null)
  const faceArt = useArtTexture(`${layer.id}-tier${k}`)
  const tint = useMemo(() => kraftTints(`${layer.id}-tier${k}`), [layer.id, k])
  const readAngles = usePageAngles(spreadIndex, frame, committedSpread)
  const tier = layer.tiers[k]
  const inFace = `tier${k}In`
  const outFace = `tier${k}Out`

  // Unfolded-die-cut v bands: slopeIn [0, 0.5], slopeOut [0.5, 1] (arc length
  // from the inner hinge over the flat span), u across the spine.
  const geometries = useMemo(
    () => ({
      in: makeQuadGeometry(new Float32Array([0, 0, 1, 0, 1, 0.5, 0, 0.5])),
      out: makeQuadGeometry(new Float32Array([0, 0.5, 1, 0.5, 1, 1, 0, 1])),
    }),
    []
  )
  const edgeGeometries = useMemo(() => ({ in: makeEdgeGeometry(), out: makeEdgeGeometry() }), [])
  const edgeMaterials = useMemo(
    () => ({
      in: new THREE.LineBasicMaterial({ color: CUT_EDGE_COLOR, transparent: true, opacity: 0.8 }),
      out: new THREE.LineBasicMaterial({ color: CUT_EDGE_COLOR, transparent: true, opacity: 0.8 }),
    }),
    []
  )

  const paperTexture = useMemo(() => makeCanvasTexture(makePaperCanvas(256, 256)), [])
  const materials = useMemo(
    () => ({
      in: new THREE.MeshBasicMaterial({ side: THREE.FrontSide, color: '#ffffff' }),
      out: new THREE.MeshBasicMaterial({ side: THREE.FrontSide, color: FOLD_SHADE_TINT }),
      interior: new THREE.MeshBasicMaterial({ side: THREE.BackSide, map: paperTexture, color: INTERIOR_SHADOW_TINT }),
    }),
    [paperTexture]
  )

  useEffect(() => {
    // slopeOut is the darker sibling (turned away from the fore-edge light).
    const set = (mat: THREE.MeshBasicMaterial, edge: THREE.LineBasicMaterial, shaded: boolean) => {
      mat.map = faceArt ?? paperTexture
      if (faceArt) {
        faceArt.wrapS = THREE.ClampToEdgeWrapping
        faceArt.wrapT = THREE.ClampToEdgeWrapping
        mat.color.set(shaded ? FOLD_SHADE_TINT : '#ffffff')
      } else {
        mat.color.set(shaded ? tint.shade : tint.lit)
      }
      mat.needsUpdate = true
      edge.color.set(faceArt ? CUT_EDGE_COLOR : tint.edge)
    }
    set(materials.in, edgeMaterials.in, false)
    set(materials.out, edgeMaterials.out, true)
  }, [faceArt, paperTexture, materials, edgeMaterials, tint])

  const shadowTexture = useMemo(() => makeCanvasTexture(makeShadowCanvas()), [])
  const shadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 }),
    [shadowTexture]
  )
  // Key-light placement (shadow-light.ts): sized for the FULL-ERECT tier so the
  // pool is right when twisted; per-frame opacity scales with the tier's actual
  // lift (0 when untwisted or book-closed).
  const shadowSpec = useMemo(() => {
    const sign = layer.side === 'left' ? -1 : 1
    const peak = tier.w * Math.sin(rad(tier.aRestDeg))
    const lift = shadowLift(peak)
    const centerD = layer.foreHingeD - tier.w // mound centre along the run
    return {
      position: [sign * centerD + lift.dx, SHADOW_Y_LIFT, tier.zc + lift.dz] as [number, number, number],
      size: [tier.w * 2 * 0.95 * lift.spread, tier.ridgeLen * 1.05 * lift.spread] as [number, number],
      maxOpacity: STRUCT_SHADOW_MAX * lift.depth,
      aRest: rad(tier.aRestDeg),
    }
  }, [layer, tier])

  useEffect(
    () => () => {
      geometries.in.dispose()
      geometries.out.dispose()
      edgeGeometries.in.dispose()
      edgeGeometries.out.dispose()
      edgeMaterials.in.dispose()
      edgeMaterials.out.dispose()
      materials.in.dispose()
      materials.out.dispose()
      materials.interior.dispose()
      paperTexture.dispose()
      shadowTexture.dispose()
      shadowMaterial.dispose()
    },
    [geometries, edgeGeometries, edgeMaterials, materials, paperTexture, shadowTexture, shadowMaterial]
  )

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const { role, thetaL, thetaR, beta } = readAngles()
    const visible = role !== 'hidden' && beta > FLAT_EPSILON
    group.visible = visible
    if (shadowGroupRef.current) shadowGroupRef.current.visible = visible
    if (!visible) return

    const patches = solveKnobTowerPose(layer, knobTheta, thetaL, thetaR)
    const inPatch = patches.find((p) => p.face === inFace)
    const outPatch = patches.find((p) => p.face === outFace)
    if (!inPatch || !outPatch) return
    writeQuad(geometries.in, inPatch.quad)
    writeQuad(edgeGeometries.in, inPatch.quad)
    writeQuad(geometries.out, outPatch.quad)
    writeQuad(edgeGeometries.out, outPatch.quad)

    const a = knobTowerTierLift(layer, k, knobTheta, beta)
    shadowMaterial.opacity = shadowSpec.maxOpacity * (Math.sin(a) / Math.sin(shadowSpec.aRest))
  })

  return (
    <>
      <group ref={groupRef} visible={false}>
        <mesh geometry={geometries.in} material={materials.in} renderOrder={0} />
        <mesh geometry={geometries.in} material={materials.interior} renderOrder={0} />
        <lineLoop geometry={edgeGeometries.in} material={edgeMaterials.in} renderOrder={1} />
        <mesh geometry={geometries.out} material={materials.out} renderOrder={0} />
        <mesh geometry={geometries.out} material={materials.interior} renderOrder={0} />
        <lineLoop geometry={edgeGeometries.out} material={edgeMaterials.out} renderOrder={1} />
      </group>
      <group ref={shadowGroupRef} visible={false}>
        {/* renderOrder=-1: ground shading joins the gutter crease's early
            transparent tier (D-G3 audit) so no shadow can draw over paper. */}
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

export function KnobTowerPopupLayer({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & KnobTowerGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  // The frozen knob angle for this view: the dev override clamped to the
  // piece's own working range, or untwisted flat in normal viewing.
  const knobTheta = useMemo(() => {
    const override = readKnobOverrideDeg()
    if (override === null) return 0
    return Math.min(knobTowerThetaMax(layer), Math.max(0, rad(override)))
  }, [layer])

  return (
    <group name={`knobtower-${layer.id}`}>
      <KnobDisc
        layer={layer}
        knobTheta={knobTheta}
        spreadIndex={spreadIndex}
        frame={frame}
        committedSpread={committedSpread}
      />
      {layer.tiers.map((_, k) => (
        <KnobTier
          key={k}
          layer={layer}
          k={k}
          knobTheta={knobTheta}
          spreadIndex={spreadIndex}
          frame={frame}
          committedSpread={committedSpread}
        />
      ))}
    </group>
  )
}
