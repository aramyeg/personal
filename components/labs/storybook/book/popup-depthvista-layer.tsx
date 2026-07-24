'use client'

/**
 * Renders one DEPTH VISTA layer (popup-depthvista.ts, E2.2 Batch B): an all-wings
 * graded tunnel-frame — N wing configs, each mirrored to the left + right pages
 * as a SINGLE +z-facing cammed FLAP (the ch3-skyline form). Each flap is one
 * die-cut painting `<id>-<key>` (alpha silhouette, shaped-mesh when a code-
 * generated outline sidecar exists), DoubleSide so it reads front however it
 * leans, kraft fallback when unpainted, plus a contact shadow scaled by the
 * flap's own stand (the fold-flat envelope). There is NO raw-kraft riser: a
 * single flap has no back slope to silhouette as scaffolding beside the hero
 * (the bench's STRUT-SILHOUETTE gate). Positions are DynamicDrawUsage buffers
 * rewritten each frame straight from the solver (liveSpreadRole /
 * spreadPageAnglesTilted / easeTurnWeighted).
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { kraftTints } from './paper-stock'
import { liveSpreadRole, spreadPageAnglesTilted, type DepthVistaGeom, type DepthVistaWing, type PanelQuad } from './popup-mechanics'
import { depthVistaEnvelope, moundPatches } from './popup-depthvista'
import { easeTurnWeighted } from './page-geometry'
import { shadowLift } from './shadow-light'
import { sharedPaperTexture, sharedShadowTexture } from './shared-procedural-textures'
import type { TurnFrame } from './use-turn-driver'
import { useArtTexture } from './use-layer-texture'
import { useLayerOutline } from './use-layer-outline'
import { makeShapedGeometry, writeShapedQuad } from './popup-skyline-layer'

const FLAT_EPSILON = 0.02
const SHADOW_Y_LIFT = 0.001
const STRUCT_SHADOW_MAX = 0.22
const rad = (d: number): number => (d * Math.PI) / 180

// Flap uvs: u along the spine band (0..1), v hinge (0) -> tip/ridge crest (1),
// matching the flap corner order [hinge@za, hinge@zb, tip@zb, tip@za].
const FLAP_UVS = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])

function makeQuadGeometry(uvs: Float32Array): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(12), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1))
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

function WingFlap({
  layer,
  wing,
  side,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & DepthVistaGeom
  wing: DepthVistaWing
  side: 'left' | 'right'
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const shadowGroupRef = useRef<THREE.Group>(null)
  // Both mirrored sides share one painting, painted generically to read on either.
  const faceArt = useArtTexture(`${layer.id}-${wing.key}`)
  const outline = useLayerOutline(`${layer.id}-${wing.key}`)
  const tint = useMemo(() => kraftTints(`${layer.id}-${wing.key}`), [layer.id, wing.key])
  const readAngles = usePageAngles(spreadIndex, frame, committedSpread)

  const geometry = useMemo(
    () => (outline ? makeShapedGeometry(outline) : makeQuadGeometry(new Float32Array(FLAP_UVS))),
    [outline]
  )
  const paperTexture = sharedPaperTexture()
  // ONE die-cut flap: the full shaped silhouette (alpha), DoubleSide so the reader
  // reads its front face however it leans, and the sky above the shaped inner arc
  // shows through the cut.
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: '#ffffff', transparent: true, alphaTest: 0.1 }),
    []
  )

  useEffect(() => {
    material.map = faceArt ?? paperTexture
    material.transparent = !!faceArt
    material.alphaTest = faceArt ? 0.1 : 0
    material.color.set(faceArt ? '#ffffff' : tint.lit)
    if (faceArt) {
      faceArt.wrapS = THREE.ClampToEdgeWrapping
      faceArt.wrapT = THREE.ClampToEdgeWrapping
    }
    material.needsUpdate = true
  }, [faceArt, paperTexture, material, tint])

  const shadowTexture = sharedShadowTexture()
  const shadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 }),
    [shadowTexture]
  )
  const shadowSpec = useMemo(() => {
    const sign = side === 'left' ? -1 : 1
    const peak = wing.height * Math.sin(rad(wing.standDeg))
    const lift = shadowLift(peak)
    const centerD = wing.F + wing.width / 2 // radial centre of the mass
    return {
      position: [sign * centerD + lift.dx, SHADOW_Y_LIFT, wing.zc + lift.dz] as [number, number, number],
      size: [Math.max(0.1, wing.width) * 1.1 * lift.spread, Math.max(0.1, wing.height) * 1.1 * lift.spread] as [number, number],
      maxOpacity: STRUCT_SHADOW_MAX * lift.depth,
    }
  }, [wing, side])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(
    () => () => {
      material.dispose()
      shadowMaterial.dispose()
    },
    [material, shadowMaterial]
  )

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const { role, thetaL, thetaR, beta } = readAngles()
    const visible = role !== 'hidden' && beta > FLAT_EPSILON
    group.visible = visible
    if (shadowGroupRef.current) shadowGroupRef.current.visible = visible
    if (!visible) return
    const { flap } = moundPatches(layer, wing, side, thetaL, thetaR)
    if (outline) writeShapedQuad(geometry, flap, outline)
    else writeQuad(geometry, flap)
    shadowMaterial.opacity = shadowSpec.maxOpacity * depthVistaEnvelope(layer, beta)
  })

  return (
    <>
      <group ref={groupRef} visible={false}>
        {/* die-cut silhouette (alpha): no rectangular cut-edge loop — it would
            draw a box around the shaped cutout. */}
        <mesh geometry={geometry} material={material} renderOrder={0} />
      </group>
      <group ref={shadowGroupRef} visible={false}>
        <mesh position={shadowSpec.position} rotation={[-Math.PI / 2, 0, 0]} material={shadowMaterial} renderOrder={-1}>
          <planeGeometry args={shadowSpec.size} />
        </mesh>
      </group>
    </>
  )
}

export function DepthVistaPopupLayer({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & DepthVistaGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  return (
    <group name={`depthvista-${layer.id}`}>
      {layer.wings.map((wing) =>
        (['left', 'right'] as const).map((side) => (
          <WingFlap
            key={`${wing.key}-${side}`}
            layer={layer}
            wing={wing}
            side={side}
            spreadIndex={spreadIndex}
            frame={frame}
            committedSpread={committedSpread}
          />
        ))
      )}
    </group>
  )
}
