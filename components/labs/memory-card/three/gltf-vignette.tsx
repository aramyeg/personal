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
import { useFrame, useLoader, useThree } from '@react-three/fiber'
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
  animation?: string // clip name to play as an idle; omit for a still model
}

/**
 * Where to sample a baked idle when motion is suppressed: a second into the
 * clip lands on a natural mid-pose rather than the frame-0 rest/A-pose.
 */
const REDUCED_MOTION_POSE_TIME = 0.6

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

/**
 * World-space bounds of a loaded scene, safe for skinned content. The key is
 * the up-front `updateMatrixWorld(true)`: `Box3.setFromObject`'s own traversal
 * updates each node's world matrix lazily in DFS order, so a `SkinnedMesh`
 * visited before its skeleton's bone nodes computes its skinning-aware bounds
 * from stale bone matrices (observed live as a near-zero box). Refreshing the
 * whole subtree first makes `SkinnedMesh.computeBoundingBox()` (bone-aware
 * since three r151) read settled matrices.
 */
function measureScene(scene: THREE.Object3D): THREE.Box3 {
  scene.updateMatrixWorld(true)
  const box = new THREE.Box3()
  const tmp = new THREE.Box3()
  scene.traverse((o) => {
    const skinned = o as THREE.SkinnedMesh
    if (skinned.isSkinnedMesh) {
      skinned.computeBoundingBox()
      if (skinned.boundingBox) {
        tmp.copy(skinned.boundingBox).applyMatrix4(skinned.matrixWorld)
        box.union(tmp)
      }
      return
    }
    const mesh = o as THREE.Mesh
    if (mesh.isMesh && mesh.geometry) {
      mesh.geometry.computeBoundingBox()
      if (mesh.geometry.boundingBox) {
        tmp.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld)
        box.union(tmp)
      }
    }
  })
  return box
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

type GltfModelProps = Required<Omit<GltfVignetteProps, 'animation'>> & {
  animation?: string
}

/** Suspends on `useLoader`; fits, animates, spins, and disposes the resolved GLB. */
function GltfModel({
  src,
  fitHeight,
  scale,
  yaw,
  spin,
  spinSpeed,
  floorY,
  animation,
}: GltfModelProps) {
  const gltf = useLoader(GLTFLoader, src)
  const groupRef = useRef<THREE.Group>(null)
  const reduced = usePrefersReducedMotion()
  const invalidate = useThree((s) => s.invalidate)

  // Only build a mixer when an idle clip is requested; still models (look-dev,
  // card, crt) keep their existing rest-pose-plus-turntable behavior untouched.
  const mixer = useMemo(
    () =>
      animation && gltf.animations.length > 0
        ? new THREE.AnimationMixer(gltf.scene)
        : null,
    [animation, gltf.scene, gltf.animations]
  )

  useEffect(() => {
    if (!mixer) return
    // Exact-name lookup with a safe fallback to the first clip: a renamed or
    // absent idle never crashes — the model just plays whatever it ships with.
    const clip =
      gltf.animations.find((c) => c.name === animation) ?? gltf.animations[0]
    const action = mixer.clipAction(clip)
    action.reset().play()
    if (reduced) {
      // Under reduced motion the stage runs a demand frameloop that never
      // advances the mixer, so sample one natural pose up front and force a
      // single repaint — otherwise the model would freeze on the A-pose.
      mixer.update(REDUCED_MOTION_POSE_TIME)
      invalidate()
    }
    return () => {
      mixer.stopAllAction()
    }
  }, [mixer, gltf.animations, animation, reduced, invalidate])

  const fit = useMemo(() => {
    const box = measureScene(gltf.scene)
    if (box.isEmpty())
      return { scale: 1, offset: [0, floorY, 0] as [number, number, number] }
    return fitToStage(
      [box.min.x, box.min.y, box.min.z],
      [box.max.x, box.max.y, box.max.z],
      fitHeight,
      floorY
    )
  }, [gltf.scene, fitHeight, floorY])

  // No per-component disposal: `useLoader`'s cache is shared, and React
  // StrictMode's dev double-mount makes an unmount-time dispose destroy GPU
  // buffers the surviving mount still renders (observed live: model reduced
  // to a corrupt sliver). GPU memory is reclaimed when `VignetteCanvas`
  // unmounts the whole canvas (IO gating) and drops the GL context; the
  // parsed GLB stays in the loader cache by design, like any asset cache.

  useFrame((_, delta) => {
    if (mixer && !reduced) mixer.update(delta)
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
  animation,
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
          animation={animation}
        />
      </Suspense>
    </ModelErrorBoundary>
  )
}

export default GltfVignette
