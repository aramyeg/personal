'use client'

/**
 * One lit scene, orthographic pixel-space world. Restaged 2026-08-08: the
 * chibi walks screen-right on a treadmill stage (floor marks scroll under
 * her), towing the banner behind her on two strings. All sim stepping
 * happens in a single useFrame so the order is explicit: chibi mixer ->
 * fist anchor -> motion -> chain -> banner -> geometry writes.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CFG } from '@/lib/labs/cloth-pull/config'
import {
  beginGrab,
  endGrab,
  moveGrab,
  nudge,
} from '@/lib/labs/cloth-pull/motion'
import { fistStretch } from '@/lib/labs/cloth-pull/chain'
import { bottomLeadingCorner } from '@/lib/labs/cloth-pull/banner'
import { BannerMesh, type BannerMeshHandle } from './banner-mesh'
import { Chibi, ChibiSprite, type ChibiHandle } from './chibi'
import { StringsMesh, type StringsMeshHandle } from './strings-mesh'
import {
  createSimWorld,
  endWorldGrab,
  stepSimWorld,
  tryGrab,
} from './use-sim'

/** the authored tow GLB already faces +X (screen right) */
const WALK_YAW = 0

function FloorMarks({
  w,
  floorWorldY,
}: {
  w: number
  floorWorldY: number
}) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 16
    const x = c.getContext('2d')
    if (!x) return null
    x.clearRect(0, 0, 256, 16)
    x.fillStyle = 'rgba(92, 74, 51, 0.55)'
    x.beginPath()
    x.ellipse(30, 9, 14, 2.6, 0, 0, Math.PI * 2)
    x.fill()
    x.beginPath()
    x.ellipse(150, 6, 8, 2, 0, 0, Math.PI * 2)
    x.fill()
    x.beginPath()
    x.ellipse(205, 11, 5, 1.6, 0, 0, Math.PI * 2)
    x.fill()
    const t = new THREE.CanvasTexture(c)
    t.wrapS = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  if (texture) texture.repeat.x = (w * 1.4) / CFG.scene.markSpacing
  return (
    <mesh position={[0, floorWorldY - 8, -80]}>
      <planeGeometry args={[w * 1.4, 16]} />
      <meshBasicMaterial
        ref={matRef}
        map={texture ?? undefined}
        transparent
        opacity={0.6}
        depthWrite={false}
      />
    </mesh>
  )
}

function Stage({ message, reduced }: { message: string; reduced: boolean }) {
  const { size, gl } = useThree()
  const w = size.width
  const h = size.height

  const firstWorld = useRef(true)
  const world = useMemo(() => {
    const wd = createSimWorld(w, h, reduced)
    if (!firstWorld.current) {
      // resize mid-session: skip the intro, land settled
      wd.motion.mode = 'toy'
      wd.motion.x = wd.motion.xRest
      wd.motion.speed = CFG.motion.cruise
      wd.started = true
    }
    firstWorld.current = false
    return wd
  }, [w, h, reduced])

  const stringsRef = useRef<StringsMeshHandle>(null)
  const bannerRef = useRef<BannerMeshHandle>(null)
  const chibiRef = useRef<ChibiHandle>(null)
  const chibiGroup = useRef<THREE.Group>(null)
  const marksTex = useRef<THREE.Group>(null)
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

  // pointer: grab the cloth, 1:1, anywhere on the stage
  useEffect(() => {
    const el = gl.domElement
    const toSim = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const down = (e: PointerEvent) => {
      e.preventDefault()
      el.setPointerCapture(e.pointerId)
      const p = toSim(e)
      if (tryGrab(world, p.x, p.y)) {
        beginGrab(world.motion, p.x, p.y)
        el.style.cursor = 'grabbing'
      }
    }
    const move = (e: PointerEvent) => {
      if (!world.motion.grabbing) return
      const p = toSim(e)
      moveGrab(world.motion, p.x, p.y)
    }
    const up = () => {
      if (!world.motion.grabbing) return
      endGrab(world.motion)
      endWorldGrab(world)
      el.style.cursor = 'grab'
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        nudge(world.motion, 1)
        e.preventDefault()
      } else if (e.key === 'ArrowLeft') {
        nudge(world.motion, -1)
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

  // e2e/debug probe: read-only snapshot of the live sim
  useEffect(() => {
    const target = window as unknown as Record<string, unknown>
    target.__cloth = {
      get state() {
        const m = world.motion
        return {
          mode: m.mode,
          x: m.x,
          speed: m.speed,
          effort: m.effort,
          grabbing: m.grabbing,
          started: world.started,
          energy: world.energy,
          stretch: fistStretch(world.chain),
          travel: world.travel,
        }
      },
    }
    return () => {
      delete target.__cloth
    }
  }, [world])

  const fistWorld = useRef(new THREE.Vector3())
  const floorY = h * world.layout.floorFrac
  const floorWorldY = h / 2 - floorY
  const chibiH = h * world.layout.chibiHeightFrac

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, CFG.scene.maxDt)
    const m = world.motion

    // place her first so the fist anchor read matches this frame's x
    if (chibiGroup.current) {
      chibiGroup.current.position.x = m.x - w / 2
    }

    let fist: { x: number; y: number } | null = null
    let fistZ = 30
    const chibi = chibiRef.current
    if (chibi?.ready) {
      chibi.frame(dt, m.effort, m.speed / CFG.motion.cruise)
      const f = chibi.getFist(fistWorld.current)
      fist = { x: f.x + w / 2, y: h / 2 - f.y }
      fistZ = f.z
    }

    stepSimWorld(world, dt, fist)

    const corner = bottomLeadingCorner(world.bannerSim, world.dims)
    stringsRef.current?.write(world.chain, fistZ, corner, w, h)
    bannerRef.current?.write(world.bannerSim, w, h, world.lowPower)
    // floor marks scroll with travel
    const marks = marksTex.current
    if (marks) {
      marks.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        const mat = mesh.material as THREE.MeshBasicMaterial | undefined
        if (mat?.map) {
          mat.map.offset.x = world.travel / (w * 1.4)
        }
      })
    }
  })

  const chibiPos: [number, number, number] = [0, floorWorldY, 0]

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
      <mesh position={[0, floorWorldY - h * 0.65, -159]} receiveShadow>
        <planeGeometry args={[w * 2.6, h * 1.3]} />
        <meshStandardMaterial color="#E2D2B4" />
      </mesh>

      <group ref={marksTex}>
        <FloorMarks w={w} floorWorldY={floorWorldY} />
      </group>

      {/* soft contact shadow grounding the chibi (rides with her) */}
      <group ref={chibiGroup}>
        <mesh
          position={[chibiH * 0.02, floorWorldY + 2, -100]}
          scale={[chibiH * 0.34, chibiH * 0.05, 1]}
        >
          <circleGeometry args={[1, 24]} />
          <meshBasicMaterial color="#5c4a33" transparent opacity={0.22} />
        </mesh>
        <Suspense
          fallback={<ChibiSprite position={chibiPos} heightPx={chibiH} />}
        >
          <Chibi
            ref={chibiRef}
            position={chibiPos}
            heightPx={chibiH}
            yaw={WALK_YAW}
            reduced={reduced}
            onReady={() => setChibiReady(true)}
          />
        </Suspense>
      </group>

      <StringsMesh ref={stringsRef} />
      <BannerMesh ref={bannerRef} dims={world.dims} message={message} />
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
