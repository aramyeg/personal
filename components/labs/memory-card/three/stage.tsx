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

/** Three-point studio rig + ambient fill (values from the brief's recipe). */
function LightRig() {
  return (
    <>
      <directionalLight color="#ffffff" intensity={2.2} position={[3, 4, 2.5]} />
      <directionalLight color="#dfe8e6" intensity={0.8} position={[-3, 1.5, 2]} />
      <directionalLight color="#ffffff" intensity={1.4} position={[0, 3, -4]} />
      <ambientLight color="#404448" intensity={0.5} />
    </>
  )
}

export type VignetteCanvasProps = {
  height?: string
  reduced?: boolean
  camera?: CameraSpec
  target?: [number, number, number]
  shadowRadius?: number
  fallbackGlyph?: GlyphName
  children: ReactNode
}

export function VignetteCanvas({
  height = '100%',
  reduced = false,
  camera = DEFAULT_CAMERA,
  target = DEFAULT_TARGET,
  shadowRadius,
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
          }}
        >
          <LookAt target={target} />
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
