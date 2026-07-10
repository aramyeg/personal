'use client'

/**
 * A pop-up book spread: one folded paper-cutout layer per `SceneLayer`,
 * each hinged along its `hingeZ` line and sprung between lying flat on the
 * page (rotation.x = π/2) and standing up toward the reader (rotation.x =
 * π/2 − standAngle). Mounted by book.tsx for the current spread ± 1 so
 * neighboring textures are warm before you turn to them (see
 * use-layer-texture.ts) — but only the spread matching the store's current
 * `spread` is ever visible; the others stay hidden until it's their turn.
 *
 * Convention (matches page-geometry.ts): the enclosing group already sits
 * at the open page's surface height, so a layer's local y=0 is the page.
 * Lying flat, a layer's plane extends from its hinge toward +z (further
 * across the page); standing, it rises straight up in local y (world up).
 */

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { useStorybookStore } from '../store'
import { makeShadowCanvas } from '../procedural/paper-texture'
import { makeCanvasTexture } from './book'
import { useLayerTexture } from './use-layer-texture'

// Manual spring integrator constants (semi-implicit Euler): k is stiffness,
// c is damping. c sits below critical (2*sqrt(k) ≈ 19) on purpose — the
// layers should overshoot slightly and settle, like paper springing into
// place, not glide to a stop.
const SPRING_K = 90
const SPRING_C = 9
const STAGGER_S = 0.085
const SHADOW_HEIGHT = 0.18
const SHADOW_Z_OFFSET = 0.05
const SHADOW_Y_LIFT = 0.001
const SHADOW_MAX_OPACITY = 0.35
const PARALLAX_SWAY = 0.015

type PopupSpreadProps = {
  layers: readonly SceneLayer[]
  accents: readonly string[]
  spreadIndex: number
  /** True only for the spread matching the store's current `spread` — the
   *  one whose layers are visible at all (standing or mid-collapse). */
  active: boolean
}

function PopupLayer({
  layer,
  accents,
  index,
  rising,
}: {
  layer: SceneLayer
  accents: readonly string[]
  index: number
  /** True while this layer should be springing toward "standing"; false
   *  collapses it to flat immediately (leaving the spread, or a turn started). */
  rising: boolean
}) {
  const texture = useLayerTexture(layer.id, layer.kind, accents)
  const groupRef = useRef<THREE.Group>(null)
  // Spring state (stand progress 0..1) and its velocity, integrated by hand
  // every frame rather than via a library — see SPRING_K/SPRING_C above.
  const stand = useRef(0)
  const velocity = useRef(0)
  // Seconds since `rising` last flipped true; null while not rising. Drives
  // this layer's staggered entrance (target flips to 1 once it passes
  // index * STAGGER_S).
  const risingClock = useRef<number | null>(null)

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(layer.width, layer.height)
    // Bottom edge (local y = -height/2) moves to y = 0: the hinge.
    geo.translate(0, layer.height / 2, 0)
    return geo
  }, [layer.width, layer.height])

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        transparent: true,
        alphaTest: 0.1,
        side: THREE.DoubleSide,
        roughness: 0.85,
      }),
    []
  )

  useEffect(() => {
    material.map = texture
    material.needsUpdate = true
  }, [material, texture])

  const shadowCanvas = useMemo(() => makeShadowCanvas(), [])
  const shadowTexture = useMemo(() => makeCanvasTexture(shadowCanvas), [shadowCanvas])
  const shadowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    [shadowTexture]
  )

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
      shadowTexture.dispose()
      shadowMaterial.dispose()
    },
    [geometry, material, shadowTexture, shadowMaterial]
  )

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return

    if (rising) {
      risingClock.current = (risingClock.current ?? 0) + delta
    } else {
      risingClock.current = null
    }

    const staggerDelay = index * STAGGER_S
    const target = risingClock.current !== null && risingClock.current >= staggerDelay ? 1 : 0

    const accel = SPRING_K * (target - stand.current) - SPRING_C * velocity.current
    velocity.current += accel * delta
    stand.current += velocity.current * delta

    const standRad = (layer.standAngle * Math.PI) / 180
    // Extra per-layer parallax sway on top of the spring pose — deeper
    // layers (higher index) sway a touch more, cheap parallax depth cue.
    const depthFactor = index / 3
    const sway = state.pointer.y * PARALLAX_SWAY * depthFactor
    group.rotation.x = Math.PI / 2 - standRad * stand.current + sway

    shadowMaterial.opacity = SHADOW_MAX_OPACITY * stand.current
  })

  return (
    <>
      <group ref={groupRef} position={[layer.offsetX ?? 0, 0, layer.hingeZ]}>
        <mesh geometry={geometry} material={material} />
      </group>
      <mesh
        position={[layer.offsetX ?? 0, SHADOW_Y_LIFT, layer.hingeZ + SHADOW_Z_OFFSET]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={shadowMaterial}
      >
        <planeGeometry args={[layer.width, SHADOW_HEIGHT]} />
      </mesh>
    </>
  )
}

/** One spread's worth of pop-up layers. Always mounted (for the current
 *  spread ± 1) but only visible while `active` — see the file header. */
export function PopupSpread({ layers, accents, spreadIndex, active }: PopupSpreadProps) {
  const turning = useStorybookStore((s) => s.turning)
  const rising = active && !turning

  return (
    <group visible={active} name={`popup-spread-${spreadIndex}`}>
      {layers.map((layer, index) => (
        <PopupLayer key={layer.id} layer={layer} accents={accents} index={index} rising={rising} />
      ))}
    </group>
  )
}
