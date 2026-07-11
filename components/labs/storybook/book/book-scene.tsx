'use client'

/**
 * The WebGL stage: Canvas, camera, candlelit lighting, desk, dust, and a
 * pointer-driven parallax rig wrapping the book. Default export so
 * `storybook-loader.tsx` can `next/dynamic(() => import('./book/book-scene'), { ssr: false })`
 * it — three.js must never reach the route's initial (server-rendered) chunk.
 */

import { type ReactNode, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { Book, makeCanvasTexture } from './book'
import { Dust } from './dust'
import { makeDeskCanvas } from '../procedural/paper-texture'

// task-17: the book is the whole-screen hero now (side-column narration
// replaces the old on-page text plates), so the camera sits noticeably
// closer than the original framing — same elevation angle (the offset from
// lookAt is just scaled down ~0.73x), just tighter, so the open spread
// reads at roughly 55-65% of viewport width on a 16:9-ish desktop instead
// of ~44%. Standing pop-up layers (up to ~1.05 world units tall) still
// clear the frustum at rest and mid-turn — verified via screenshot, not
// just math, since the perspective is a foreshortened top-down angle.
const CAMERA_POSITION: [number, number, number] = [0, 2.6, 2.9]
const CAMERA_LOOKAT: [number, number, number] = [0, 0.32, 0.15]
const CAMERA_FOV = 34
const DESK_COLOR = '#17100b'
const DESK_SIZE: [number, number] = [9, 6]
const CANDLE_POSITION: [number, number, number] = [1.6, 1.1, 1.4]
const CANDLE_COLOR = '#ff9f4d'
// Lowered from the original 2.2/6 pairing (task-9 concern: candle falloff
// over a flat page washed the paper texture to near-white). A shorter
// `distance` cutoff also gives the desk plane a visible light-pool falloff
// instead of an even wash clear out to its edges.
const CANDLE_BASE_INTENSITY = 1.3
const CANDLE_DISTANCE = 3.6
// Doubled 2026-07-11 (user: "more depth... maybe by allowing tilting it
// more") — the pointer now swings the desk noticeably, letting the standing
// paper parallax against the page prints. Still well inside the frustum
// margin verified for ~1.05-tall pieces.
const PARALLAX_TILT_X = 0.07
const PARALLAX_TILT_Y = 0.11
const PARALLAX_EASE_RATE = 4

/** Desk surface: a baked warm light-pool texture (see makeDeskCanvas) rather
 * than a flat fill, so the near-black desk reads as a lit surface the tome
 * sits on instead of blending into the background void. */
function Desk() {
  const deskCanvas = useMemo(() => makeDeskCanvas(), [])
  const deskTexture = useMemo(() => makeCanvasTexture(deskCanvas), [deskCanvas])

  useEffect(() => () => deskTexture.dispose(), [deskTexture])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
      <planeGeometry args={DESK_SIZE} />
      <meshStandardMaterial map={deskTexture} roughness={0.95} />
    </mesh>
  )
}

/** Warm point light standing in for a candle, flickering via two summed sine waves. */
function CandleLight() {
  const ref = useRef<THREE.PointLight>(null)

  useFrame((state) => {
    const light = ref.current
    if (!light) return
    const t = state.clock.elapsedTime
    light.intensity = CANDLE_BASE_INTENSITY + 0.25 * Math.sin(t * 9.3) + 0.15 * Math.sin(t * 23.7)
  })

  return (
    <pointLight
      ref={ref}
      position={CANDLE_POSITION}
      color={CANDLE_COLOR}
      intensity={CANDLE_BASE_INTENSITY}
      distance={CANDLE_DISTANCE}
    />
  )
}

/** Eases the wrapped group's tilt toward the pointer position, giving the desk a parallax feel. */
function ParallaxRig({ children }: { children: ReactNode }) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return
    const ease = Math.min(1, delta * PARALLAX_EASE_RATE)
    const targetX = -state.pointer.y * PARALLAX_TILT_X
    const targetY = state.pointer.x * PARALLAX_TILT_Y
    group.rotation.x += (targetX - group.rotation.x) * ease
    group.rotation.y += (targetY - group.rotation.y) * ease
  })

  return <group ref={groupRef}>{children}</group>
}

/** Default export for `next/dynamic` — renders the full Canvas; nothing outside this
 * directory may import three. */
export default function BookScene() {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
      onCreated={(state) => state.camera.lookAt(...CAMERA_LOOKAT)}
    >
      <color attach="background" args={[DESK_COLOR]} />
      {/* v2 pivot: the book reads like a bright printed object — childhood
          pop-up books live in daylight, not murk. The candle keeps its warm
          flicker as seasoning; the vignette/desk keep the dark theatre
          around the book. */}
      <ambientLight color="#fff3e0" intensity={0.85} />
      <directionalLight position={[2, 4, 2]} color="#fff6e4" intensity={0.95} />
      <CandleLight />
      <Desk />
      <Dust />
      <ParallaxRig>
        <Book />
      </ParallaxRig>
    </Canvas>
  )
}
