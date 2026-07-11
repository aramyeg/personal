'use client'

/**
 * FigureStage — the character half of the select screen. The figure stands on
 * one side of the shared void, posed by its baked idle, and re-lights itself in
 * the highlighted save's accent: an accent rim light rakes the silhouette edge
 * so choosing a save visibly "equips" the figure in that save's colour. For one
 * designated save a small accent charm is clipped to a hand bone as proof of the
 * real equipment swap (gear assets land next task); for every other save it is
 * simply hidden.
 *
 * It reuses the shared `VignetteCanvas` rig (IO gating, RoomEnvironment,
 * context-loss recovery) and adds the accent rim + the character as children.
 * The figure owns the loader-cached GLB directly (never cloned — plain clone
 * breaks skinned-mesh binding), so it is the single renderer of that scene.
 *
 * Motion discipline: the rim lerps under the live frameloop and snaps + one
 * `invalidate()` under reduced motion's demand loop; the idle mixer samples a
 * natural pose and repaints once when motion is suppressed.
 */

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type JSX,
  type ReactNode,
} from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { fitToStage } from '../lib/fit-model'
import { CHARACTER_SRC, CHARACTER_IDLE_CLIP } from './character'

/** A second into the idle lands on a natural mid-pose, not the frame-0 A-pose. */
const REDUCED_POSE_TIME = 0.6

/** Bones a hand-held charm can ride, most-specific first — matched case-insensitively. */
const HAND_BONE_HINTS = ['righthand', 'hand_r', 'r_hand', 'wrist_r', 'hand', 'wrist']

/** World-space bounds, skinned-mesh-aware (bone matrices settled up front). */
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

/** First bone whose name matches a hand hint, or null if the rig has none. */
function findHandBone(scene: THREE.Object3D): THREE.Bone | null {
  let found: THREE.Bone | null = null
  scene.traverse((o) => {
    if (found) return
    const bone = o as THREE.Bone
    if (!bone.isBone) return
    const name = bone.name.toLowerCase()
    if (HAND_BONE_HINTS.some((hint) => name.includes(hint))) found = bone
  })
  return found
}

type AccentRimProps = { accent: string; reduced: boolean }

/**
 * A coloured rim from behind the figure's shoulder that eases to the active
 * accent. Under the live loop it lerps; under reduced motion's demand loop it
 * snaps to the new colour and forces one repaint so the change is never frozen.
 */
function AccentRim({ accent, reduced }: AccentRimProps) {
  const lightRef = useRef<THREE.DirectionalLight>(null)
  const invalidate = useThree((s) => s.invalidate)
  const target = useMemo(() => new THREE.Color(accent), [accent])

  useEffect(() => {
    if (reduced && lightRef.current) {
      lightRef.current.color.copy(target)
      invalidate()
    }
  }, [target, reduced, invalidate])

  useFrame((_, dt) => {
    const light = lightRef.current
    if (!light || reduced) return
    light.color.lerp(target, Math.min(1, dt * 3))
  })

  return (
    <directionalLight
      ref={lightRef}
      color={accent}
      intensity={2.1}
      position={[-3.4, 3.6, -2.6]}
    />
  )
}

type FigureModelProps = {
  fitHeight: number
  yaw: number
  reduced: boolean
  accent: string
  equip: boolean
}

/** Loads + fits the character, plays its idle, and clips the accent charm on. */
function FigureModel({ fitHeight, yaw, reduced, accent, equip }: FigureModelProps): JSX.Element {
  const gltf = useLoader(GLTFLoader, CHARACTER_SRC)
  const invalidate = useThree((s) => s.invalidate)
  const charmRef = useRef<THREE.Mesh | null>(null)

  const mixer = useMemo(
    () => (gltf.animations.length > 0 ? new THREE.AnimationMixer(gltf.scene) : null),
    [gltf.scene, gltf.animations]
  )

  useEffect(() => {
    if (!mixer) return
    const clip =
      gltf.animations.find((c) => c.name === CHARACTER_IDLE_CLIP) ?? gltf.animations[0]
    mixer.clipAction(clip).reset().play()
    if (reduced) {
      mixer.update(REDUCED_POSE_TIME)
      invalidate()
    }
    return () => {
      mixer.stopAllAction()
    }
  }, [mixer, gltf.animations, reduced, invalidate])

  const fit = useMemo(() => {
    const box = measureScene(gltf.scene)
    if (box.isEmpty()) return { scale: 1, offset: [0, 0, 0] as [number, number, number] }
    return fitToStage(
      [box.min.x, box.min.y, box.min.z],
      [box.max.x, box.max.y, box.max.z],
      fitHeight,
      0
    )
  }, [gltf.scene, fitHeight])

  // Charm: a small accent icosahedron clipped to a hand bone, created once and
  // reused. Its visibility + colour track the active save; only the designated
  // save shows it, proving the equipment swap without any gear asset. Disposed
  // and unparented on unmount so the cached GLB is left clean.
  useEffect(() => {
    const bone = findHandBone(gltf.scene)
    if (!bone) return
    if (!charmRef.current) {
      const geometry = new THREE.IcosahedronGeometry(0.06, 0)
      const material = new THREE.MeshStandardMaterial({
        color: accent,
        emissive: accent,
        emissiveIntensity: 0.9,
        roughness: 0.35,
        metalness: 0.1,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(0.04, 0.02, 0)
      charmRef.current = mesh
      bone.add(mesh)
    }
    const charm = charmRef.current
    charm.visible = equip
    const mat = charm.material as THREE.MeshStandardMaterial
    mat.color.set(accent)
    mat.emissive.set(accent)
    if (reduced) invalidate()
    return () => {
      const held = charmRef.current
      if (held) {
        held.parent?.remove(held)
        held.geometry.dispose()
        ;(held.material as THREE.Material).dispose()
        charmRef.current = null
      }
    }
  }, [gltf.scene, accent, equip, reduced, invalidate])

  useFrame((_, dt) => {
    if (mixer && !reduced) mixer.update(dt)
  })

  return (
    <group rotation-y={yaw}>
      <group scale={fit.scale} position={fit.offset}>
        <primitive object={gltf.scene} />
      </group>
    </group>
  )
}

type BoundaryProps = { children: ReactNode }
type BoundaryState = { failed: boolean }

/** Swallows a failed character load — the DOM index + story band carry the facts. */
class FigureBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }
  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export type FigureStageChildrenProps = {
  yaw: number
  reduced: boolean
  accent: string
  equip: boolean
  fitHeight?: number
}

/**
 * The scene contents for the figure — the accent rim plus the character. Mounted
 * as `VignetteCanvas` children by the screen so the figure shares the stage rig.
 */
export function FigureSceneContents({
  yaw,
  reduced,
  accent,
  equip,
  fitHeight = 2.35,
}: FigureStageChildrenProps): JSX.Element {
  return (
    <>
      <AccentRim accent={accent} reduced={reduced} />
      <FigureBoundary>
        <Suspense fallback={null}>
          <FigureModel
            fitHeight={fitHeight}
            yaw={yaw}
            reduced={reduced}
            accent={accent}
            equip={equip}
          />
        </Suspense>
      </FigureBoundary>
    </>
  )
}

export default FigureSceneContents
