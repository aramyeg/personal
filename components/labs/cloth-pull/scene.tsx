'use client'

/**
 * One lit scene, orthographic pixel-space world: warm paper backdrop, a
 * shadow-casting key light, the chibi at the left hauling a rope whose far
 * end anchors off-screen right, and the banner riding the line. All sim
 * stepping happens here in a single useFrame so the order is explicit:
 * chibi mixer -> fist -> rope -> banner -> geometry writes.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CFG } from '@/lib/labs/cloth-pull/config'
import {
  beginDrag,
  endDrag,
  moveDrag,
  nudge,
} from '@/lib/labs/cloth-pull/drive'
import { BannerMesh, type BannerMeshHandle } from './banner-mesh'
import { Chibi, ChibiSprite, type ChibiHandle } from './chibi'
import { RopeMesh, type RopeMeshHandle } from './rope-mesh'
import { createSimWorld, stepSimWorld } from './use-sim'

function Stage({ message, reduced }: { message: string; reduced: boolean }) {
  const { size, gl } = useThree()
  const w = size.width
  const h = size.height

  const firstWorld = useRef(true)
  const world = useMemo(() => {
    const wd = createSimWorld(w, h, reduced)
    if (!firstWorld.current) {
      // resize mid-session: skip the intro, land settled
      wd.drive.mode = 'toy'
      wd.drive.h = wd.drive.hRest
      wd.started = true
    }
    firstWorld.current = false
    return wd
  }, [w, h, reduced])

  const ropeRef = useRef<RopeMeshHandle>(null)
  const bannerRef = useRef<BannerMeshHandle>(null)
  const chibiRef = useRef<ChibiHandle>(null)
  const [chibiReady, setChibiReady] = useState(false)

  // the intro waits for the chibi (or a grace timeout on very slow networks)
  useEffect(() => {
    if (chibiReady) {
      world.started = true
      return
    }
    const t = setTimeout(() => {
      world.started = true
    }, 2500)
    return () => clearTimeout(t)
  }, [world, chibiReady])

  // pointer drag: 1:1 haul on the whole stage
  useEffect(() => {
    const el = gl.domElement
    let lastT = 0
    const down = (e: PointerEvent) => {
      e.preventDefault()
      el.setPointerCapture(e.pointerId)
      beginDrag(world.drive, e.clientX)
      lastT = e.timeStamp
      el.style.cursor = 'grabbing'
    }
    const move = (e: PointerEvent) => {
      if (!world.drive.dragging) return
      const dt = Math.max(1 / 240, Math.min(1 / 15, (e.timeStamp - lastT) / 1000))
      moveDrag(world.drive, e.clientX, dt)
      lastT = e.timeStamp
    }
    const up = (e: PointerEvent) => {
      if (!world.drive.dragging) return
      endDrag(world.drive)
      el.style.cursor = 'grab'
      void e
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        nudge(world.drive, 1)
        e.preventDefault()
      } else if (e.key === 'ArrowRight') {
        nudge(world.drive, -1)
        e.preventDefault()
      }
    }
    el.style.cursor = 'grab'
    el.style.touchAction = 'none'
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('keydown', key)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('keydown', key)
    }
  }, [gl, world])

  // e2e/debug probe: read-only snapshot of the live sim (no wall-clock use)
  useEffect(() => {
    const target = window as unknown as Record<string, unknown>
    target.__cloth = {
      get state() {
        const d = world.drive
        return {
          mode: d.mode,
          h: d.h,
          v: d.v,
          effort: d.effort,
          started: world.started,
          energy: world.energy,
          fist: fistWorld.current.toArray(),
          haulWeight: chibiRef.current
            ? (chibiRef.current as unknown as { debugHaulWeight?: number })
                .debugHaulWeight
            : undefined,
        }
      },
    }
    return () => {
      delete target.__cloth
    }
  }, [world])

  const fistWorld = useRef(new THREE.Vector3())
  const chibiX = w * world.layout.chibiXFrac
  const floorY = h * world.layout.floorFrac
  const chibiPos: [number, number, number] = [
    chibiX - w / 2,
    h / 2 - floorY,
    0,
  ]
  const chibiH = h * world.layout.chibiHeightFrac

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, CFG.scene.maxDt)
    const d = world.drive
    const hauling =
      d.mode === 'intro' || d.dragging || d.effort > 0.12

    let hand: { x: number; y: number } | null = null
    let ropeZ = 40
    const chibi = chibiRef.current
    if (chibi?.ready) {
      const poseEffort = Math.min(
        1.2,
        d.effort + (d.dragging ? CFG.chibi.gripEffort : 0)
      )
      chibi.frame(dt, poseEffort, hauling)
      const f = chibi.getFist(fistWorld.current)
      hand = { x: f.x + w / 2, y: h / 2 - f.y }
      ropeZ = f.z
    }

    stepSimWorld(world, dt, hand)

    ropeRef.current?.write(world.rope, w, h, ropeZ, d.h)
    bannerRef.current?.write(world.bannerSim, w, h, world.lowPower)
  })

  return (
    <>
      <color attach="background" args={['#F7EFE1']} />
      <ambientLight color="#fff8ec" intensity={1.1} />
      <directionalLight
        color="#fff4e0"
        intensity={2.6}
        position={[-w * 0.22, h * 0.5, 1050]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-w * 1.2}
        shadow-camera-right={w * 1.2}
        shadow-camera-top={h * 1.2}
        shadow-camera-bottom={-h * 1.2}
        shadow-camera-near={50}
        shadow-camera-far={2500}
        shadow-radius={5}
      />

      {/* backdrop wall + darker floor band */}
      <mesh position={[0, 0, -160]} receiveShadow>
        <planeGeometry args={[w * 2.6, h * 2.6]} />
        <meshStandardMaterial color="#EDE0C9" />
      </mesh>
      <mesh
        position={[0, h / 2 - floorY - h * 0.65, -159]}
        receiveShadow
      >
        <planeGeometry args={[w * 2.6, h * 1.3]} />
        <meshStandardMaterial color="#E2D2B4" />
      </mesh>

      {/* soft contact shadow grounding the chibi */}
      <mesh
        position={[chibiPos[0] + chibiH * 0.06, chibiPos[1] + 2, -100]}
        scale={[chibiH * 0.34, chibiH * 0.05, 1]}
      >
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial color="#5c4a33" transparent opacity={0.22} />
      </mesh>

      <RopeMesh ref={ropeRef} />
      <BannerMesh ref={bannerRef} dims={world.dims} message={message} />

      <Suspense
        fallback={<ChibiSprite position={chibiPos} heightPx={chibiH} />}
      >
        <Chibi
          ref={chibiRef}
          position={chibiPos}
          heightPx={chibiH}
          reduced={reduced}
          onReady={() => setChibiReady(true)}
        />
      </Suspense>
    </>
  )
}

export function ClothPullScene({
  message,
  reduced,
}: {
  message: string
  reduced: boolean
}) {
  return (
    <Canvas
      orthographic
      shadows
      dpr={[1, CFG.scene.dprCap]}
      camera={{ position: [0, 0, 600], zoom: 1, near: 0.1, far: 3000 }}
      gl={{ antialias: true }}
    >
      <Stage message={message} reduced={reduced} />
    </Canvas>
  )
}
