'use client'

/**
 * GltfVignette — loads a hero GLB and stages it like a product shot inside a
 * `VignetteCanvas`: auto-fit framing (fixed world-height, centered, resting on
 * the floor), an optional turntable spin, and full resource disposal on unmount.
 *
 * It degrades on every axis. While the file loads, a `Suspense` boundary shows
 * an empty stage; if the file is missing or unparseable, a local error boundary
 * swaps in a wireframe `ModelPlaceholder` so look-dev still shows that something
 * is expected in that slot — the page never crashes and the console stays quiet.
 * Under `prefers-reduced-motion` the spin is replaced by a static, well-chosen
 * yaw rather than a paused animation (the stage's demand frameloop would freeze
 * a lerp mid-state).
 */

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { MC } from '../tokens'
import { fitToStage } from '../lib/fit-model'

export type GltfVignetteProps = {
  src: string // e.g. '/labs/memory-card/models/crt.glb'
  fitHeight?: number // world-units target height after auto-fit, default 2.2
  scale?: number // extra multiplier on top of auto-fit, default 1
  yaw?: number // initial/static Y rotation, default -0.5
  spin?: boolean // default true; ignored (static) under reduced motion
  spinSpeed?: number // rad/s, default 0.45
  floorY?: number // where the model's bottom sits, default 0
}

/** Live `(prefers-reduced-motion: reduce)` state, resolved client-side. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** Dispose a material and any textures it references (map, normalMap, …). */
function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material)) {
    const texture = value as THREE.Texture | null
    if (texture && texture.isTexture) texture.dispose()
  }
  material.dispose()
}

/** Free every geometry/material/texture the loaded scene owns. */
function disposeScene(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    if (mesh.geometry) mesh.geometry.dispose()
    const material = mesh.material
    if (Array.isArray(material)) material.forEach(disposeMaterial)
    else if (material) disposeMaterial(material)
  })
}

/**
 * Missing/failed-load stand-in: a slowly turning wireframe rounded box in the
 * shell grey, sized like a generic hero object so the slot doesn't read empty.
 */
function ModelPlaceholder({ floorY = 0 }: { floorY?: number }) {
  const reduced = usePrefersReducedMotion()
  const groupRef = useRef<THREE.Group>(null)
  const geometry = useMemo(
    () => new RoundedBoxGeometry(1.4, 2.2, 0.4, 4, 0.08),
    []
  )
  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, delta) => {
    if (!reduced && groupRef.current) groupRef.current.rotation.y += 0.2 * delta
  })

  return (
    <group ref={groupRef} position={[0, floorY + 1.1, 0]} rotation-y={-0.5}>
      <mesh geometry={geometry}>
        <meshBasicMaterial wireframe color={MC.shell} />
      </mesh>
    </group>
  )
}

type BoundaryProps = { fallback: ReactNode; children: ReactNode }
type BoundaryState = { failed: boolean }

/**
 * Catches a failed GLB load (404 / parse error thrown out of `useLoader`) and
 * renders the placeholder instead of unwinding to the page. No logging: three's
 * own load path is the only thing that may touch the console.
 */
class ModelErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

type GltfModelProps = Required<GltfVignetteProps>

/** Suspends on `useLoader`; fits, spins, and disposes the resolved GLB. */
function GltfModel({
  src,
  fitHeight,
  scale,
  yaw,
  spin,
  spinSpeed,
  floorY,
}: GltfModelProps) {
  const gltf = useLoader(GLTFLoader, src)
  const groupRef = useRef<THREE.Group>(null)
  const reduced = usePrefersReducedMotion()

  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene)
    return fitToStage(
      [box.min.x, box.min.y, box.min.z],
      [box.max.x, box.max.y, box.max.z],
      fitHeight,
      floorY
    )
  }, [gltf.scene, fitHeight, floorY])

  useEffect(() => {
    return () => {
      disposeScene(gltf.scene)
      useLoader.clear(GLTFLoader, src)
    }
  }, [gltf.scene, src])

  useFrame((_, delta) => {
    if (spin && !reduced && groupRef.current) {
      groupRef.current.rotation.y += spinSpeed * delta
    }
  })

  return (
    <group ref={groupRef} scale={scale} rotation-y={yaw}>
      <group scale={fit.scale} position={fit.offset}>
        <primitive object={gltf.scene} />
      </group>
    </group>
  )
}

export function GltfVignette({
  src,
  fitHeight = 2.2,
  scale = 1,
  yaw = -0.5,
  spin = true,
  spinSpeed = 0.45,
  floorY = 0,
}: GltfVignetteProps): JSX.Element {
  return (
    <ModelErrorBoundary fallback={<ModelPlaceholder floorY={floorY} />}>
      <Suspense fallback={null}>
        <GltfModel
          src={src}
          fitHeight={fitHeight}
          scale={scale}
          yaw={yaw}
          spin={spin}
          spinSpeed={spinSpeed}
          floorY={floorY}
        />
      </Suspense>
    </ModelErrorBoundary>
  )
}

export default GltfVignette
