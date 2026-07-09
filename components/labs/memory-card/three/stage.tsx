'use client'

/**
 * VignetteCanvas — the shared studio stage for every Memory Card hero object.
 *
 * A look-dev-grade "product shot" rig: a three-point light setup, a soft
 * radial contact shadow, a transparent background, and full-resolution
 * antialiased rendering (no dither, no pixelation — see the lab spec's
 * "3D vignettes" look rules). The Canvas only mounts while the wrapper is
 * near the viewport (IntersectionObserver) so a page full of these stays
 * light, and it degrades to a static reserved box when WebGL is missing so
 * layout never shifts.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { MC, GLYPH_PATHS, type GlyphName } from '../tokens'

type CameraSpec = { position: [number, number, number]; fov: number }

const DEFAULT_CAMERA: CameraSpec = { position: [0, 1.35, 6.4], fov: 30 }
const DEFAULT_TARGET: [number, number, number] = [0, 1.2, 0]

/** Probe for a usable WebGL context — spec-mandated fallback gate. */
function hasWebGL(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const c = document.createElement('canvas')
    return Boolean(
      c.getContext('webgl2') ??
        (c.getContext('webgl') as WebGLRenderingContext | null)
    )
  } catch {
    return false
  }
}

/** Soft round drop shadow: a radial black→transparent gradient on a flat disc. */
function ContactShadow({ radius = 2.6 }: { radius?: number }) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    grad.addColorStop(0, 'rgba(0,0,0,0.35)')
    grad.addColorStop(0.55, 'rgba(0,0,0,0.18)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 256)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
      <circleGeometry args={[radius, 48]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        opacity={0.9}
      />
    </mesh>
  )
}

/** Aims the camera at the object's optical center once it exists. */
function LookAt({ target }: { target: [number, number, number] }) {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    camera.lookAt(target[0], target[1], target[2])
  }, [camera, target])
  return null
}

/**
 * Studio HDRI: bakes `RoomEnvironment` into a PMREM and assigns it as the
 * scene's image-based light, so every PBR material picks up soft, wrapping
 * studio reflections instead of flat directional fill. Built once per canvas
 * mount; the render target + generator are disposed and `scene.environment`
 * cleared on unmount so a page of vignettes doesn't leak GPU memory.
 */
function StudioEnvironment({ intensity }: { intensity: number }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const envRT = pmrem.fromScene(room, 0.04)
    scene.environment = envRT.texture
    room.dispose()
    return () => {
      scene.environment = null
      envRT.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])

  useEffect(() => {
    scene.environmentIntensity = intensity
    return () => {
      scene.environmentIntensity = 1
    }
  }, [scene, intensity])

  return null
}

/**
 * Key + rim only. The environment map now supplies the broad fill that the old
 * fill light and ambient used to fake, so those are dropped: the key (kept, at
 * reduced intensity) still anchors the contact-shadow direction and carves the
 * primary form; the rim separates the object from the background.
 */
function LightRig() {
  return (
    <>
      <directionalLight color="#ffffff" intensity={1.2} position={[3, 4, 2.5]} />
      <directionalLight color="#ffffff" intensity={0.9} position={[0, 3, -4]} />
    </>
  )
}

export type VignetteCanvasProps = {
  height?: string
  reduced?: boolean
  camera?: CameraSpec
  target?: [number, number, number]
  shadowRadius?: number
  /** Scene-wide multiplier on the studio environment light. Default 1. */
  envIntensity?: number
  fallbackGlyph?: GlyphName
  children: ReactNode
}

export function VignetteCanvas({
  height = '100%',
  reduced = false,
  camera = DEFAULT_CAMERA,
  target = DEFAULT_TARGET,
  shadowRadius,
  envIntensity = 1,
  fallbackGlyph = 'triangle',
  children,
}: VignetteCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [webgl, setWebgl] = useState(true)

  useEffect(() => {
    setWebgl(hasWebGL())
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '200px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const mountCanvas = visible && webgl

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      style={{ height, width: '100%', position: 'relative' }}
    >
      {mountCanvas ? (
        <Canvas
          dpr={[1, 2]}
          frameloop={reduced ? 'demand' : 'always'}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ position: camera.position, fov: camera.fov, near: 0.1, far: 100 }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0)
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 1.05
            gl.outputColorSpace = THREE.SRGBColorSpace
          }}
        >
          <LookAt target={target} />
          <StudioEnvironment intensity={envIntensity} />
          <LightRig />
          {children}
          <ContactShadow radius={shadowRadius ?? 2.6} />
        </Canvas>
      ) : (
        <Fallback glyph={fallbackGlyph} />
      )}
    </div>
  )
}

/** No-WebGL reserved box: same footprint, faint paper field, stroked glyph. */
function Fallback({ glyph }: { glyph: GlyphName }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: MC.paper,
        opacity: 0.06,
      }}
    >
      <svg width="72" height="72" viewBox="0 0 24 24" fill="none">
        <path
          d={GLYPH_PATHS[glyph]}
          stroke={MC.ink}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export default VignetteCanvas
