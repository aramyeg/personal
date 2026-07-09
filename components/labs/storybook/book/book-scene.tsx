'use client'

/**
 * The WebGL stage: Canvas, camera, candlelit lighting, desk, dust, and a
 * pointer-driven parallax rig wrapping the book. Default export so
 * `storybook-loader.tsx` can `next/dynamic(() => import('./book/book-scene'), { ssr: false })`
 * it — three.js must never reach the route's initial (server-rendered) chunk.
 */

import { type ReactNode, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { Book } from './book'
import { Dust } from './dust'

const CAMERA_POSITION: [number, number, number] = [0, 2.6, 2.9]
const CAMERA_LOOKAT: [number, number, number] = [0, 0, 0.15]
const CAMERA_FOV = 40
const DESK_COLOR = '#17100b'
const DESK_SIZE: [number, number] = [9, 6]
const CANDLE_POSITION: [number, number, number] = [1.6, 1.1, 1.4]
const CANDLE_COLOR = '#ff9f4d'
const CANDLE_BASE_INTENSITY = 2.2
const PARALLAX_TILT_X = 0.03
const PARALLAX_TILT_Y = 0.05
const PARALLAX_EASE_RATE = 4

function Desk() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
      <planeGeometry args={DESK_SIZE} />
      <meshStandardMaterial color={DESK_COLOR} roughness={0.95} />
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
      distance={6}
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
      <ambientLight color="#ffe8c8" intensity={0.55} />
      <directionalLight position={[2, 4, 2]} color="#fff1d6" intensity={1.5} />
      <CandleLight />
      <Desk />
      <Dust />
      <ParallaxRig>
        <Book />
      </ParallaxRig>
    </Canvas>
  )
}
