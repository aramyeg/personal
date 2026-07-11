'use client'

/**
 * FigureStage — the character half of the select screen, and the payoff of the
 * whole lab: choosing a save re-dresses the figure into that save's fit. Each
 * save owns a fit GLB (a distinct outfit on a shared skeleton, saves.ts maps
 * slot→fit); the active fit loads, plays its baked idle, and swaps for the next
 * one when the highlighted save changes. The figure also re-lights itself in the
 * highlighted save's accent — an accent rim rakes the silhouette edge and a
 * short-range accent fill washes the lower body — so a choice visibly "equips"
 * the figure in that save's outfit AND colour, legible even in a still.
 *
 * Swap grammar (web-motion-design): a quick "equip pop" — the figure squashes to
 * a dip and eases back with a slight overshoot (easeOutBack) as the new fit
 * lands. The accent atmosphere (void backdrop + rim) is the secondary action,
 * shifting in step. Under reduced motion the swap is instant with no squash and
 * the idle is sampled to a static mid-pose. The other fits are warmed into the
 * loader cache once the stage is idle, so a re-dress hits cache (near-instant); a
 * cold swap degrades to the stage's Suspense fallback.
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
  useLayoutEffect,
  useMemo,
  useRef,
  type JSX,
  type ReactNode,
} from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { fitToStage } from '../lib/fit-model'
import { CHARACTER_IDLE_CLIP, FIT_COUNT, fitSrc } from './character'

/** A second into the idle lands on a natural mid-pose, not the frame-0 A-pose. */
const REDUCED_POSE_TIME = 0.6

/** Bones a hand-held charm can ride, most-specific first — matched case-insensitively. */
const HAND_BONE_HINTS = ['righthand', 'hand_r', 'r_hand', 'wrist_r', 'hand', 'wrist']

/** Equip pop: how far the figure squashes at the start of a re-dress, and how
 *  long (seconds) the pop takes to settle back to full scale. */
const SWAP_DIP = 0.82
const SWAP_DURATION = 0.38

/** easeOutBack — settles at exactly 1 after a small overshoot; gives the equip
 *  pop its snap. Constants are the CSS `back` curve's defaults. */
const BACK_C1 = 1.70158
const BACK_C3 = BACK_C1 + 1
function easeOutBack(x: number): number {
  return 1 + BACK_C3 * (x - 1) ** 3 + BACK_C1 * (x - 1) ** 2
}

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

/** Contact-shadow radius on the figure's `VignetteCanvas` — the fill light's
 *  `distance` is capped to this so its glow never spreads past the shadow. */
const FILL_MAX_DISTANCE = 1.3

/**
 * A coloured rim from behind the figure's shoulder plus a short-range fill low
 * at its front, both easing to the active accent. Under the live loop they
 * lerp; under reduced motion's demand loop they snap to the new colour and
 * force one repaint so the change is never frozen.
 */
function AccentRim({ accent, reduced }: AccentRimProps) {
  const rimRef = useRef<THREE.DirectionalLight>(null)
  const fillRef = useRef<THREE.PointLight>(null)
  const invalidate = useThree((s) => s.invalidate)
  const target = useMemo(() => new THREE.Color(accent), [accent])

  useEffect(() => {
    if (reduced) {
      rimRef.current?.color.copy(target)
      fillRef.current?.color.copy(target)
      invalidate()
    }
  }, [target, reduced, invalidate])

  useFrame((_, dt) => {
    if (reduced) return
    const k = Math.min(1, dt * 3)
    rimRef.current?.color.lerp(target, k)
    fillRef.current?.color.lerp(target, k)
  })

  return (
    <>
      <directionalLight
        ref={rimRef}
        color={accent}
        intensity={4.6}
        position={[-3.4, 3.6, -2.6]}
      />
      {/* Low accent bounce so the equipped colour reads across the figure's
          front — torso height, close enough to camera-facing surfaces (tank
          top, waist) that the tint is legible in a still, not just grazing
          the silhouette edge. Short range keeps it a tint, not a wash. */}
      <pointLight
        ref={fillRef}
        color={accent}
        intensity={2.6}
        distance={FILL_MAX_DISTANCE}
        decay={2}
        position={[0.5, 0.95, 1.0]}
      />
    </>
  )
}

/**
 * Warms the loader cache for every fit shortly after first paint, so a re-dress
 * hits cache (near-instant). Preloading a fit that is already loaded is a cache
 * no-op, so the active fit is included and no per-swap bookkeeping is needed.
 * ~3.5MB total on a lazy timer is acceptable.
 *
 * The warm prefers `requestIdleCallback` but MUST carry a `timeout`: the stage's
 * live frameloop renders every rAF and starves idle callbacks (observed live —
 * the other fits never warmed and swaps stayed cold), so the timeout guarantees
 * the warm runs. A plain `setTimeout` is the fallback where rIC is absent.
 */
function FitPreloader() {
  useEffect(() => {
    const warm = () => {
      for (let n = 1; n <= FIT_COUNT; n++) useLoader.preload(GLTFLoader, fitSrc(n))
    }
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(warm, { timeout: 1200 })
      return () => window.cancelIdleCallback?.(id)
    }
    const t = window.setTimeout(warm, 1200)
    return () => window.clearTimeout(t)
  }, [])
  return null
}

/**
 * The equip pop. On every fit change after the first, the wrapped figure
 * squashes to `SWAP_DIP` and eases back to full scale with a small overshoot
 * under the live loop. Under reduced motion it is inert (no squash, instant
 * swap) — the demand loop wouldn't advance the ease and would freeze it mid-pop.
 * Sits OUTSIDE the model's Suspense boundary so its frame loop keeps running
 * through a cold swap's fallback gap.
 */
function SwapPop({
  fit,
  reduced,
  children,
}: {
  fit: number
  reduced: boolean
  children: ReactNode
}) {
  const groupRef = useRef<THREE.Group>(null)
  const progress = useRef(1) // 1 = settled at full scale
  const prevFit = useRef(fit)

  // Kick synchronously at commit (before paint) so the new fit never flashes at
  // full scale for a frame before dipping.
  useLayoutEffect(() => {
    if (prevFit.current === fit) return
    prevFit.current = fit
    if (reduced) return
    progress.current = 0
    groupRef.current?.scale.setScalar(SWAP_DIP)
  }, [fit, reduced])

  useFrame((_, dt) => {
    if (reduced || progress.current >= 1) return
    progress.current = Math.min(1, progress.current + dt / SWAP_DURATION)
    const s = SWAP_DIP + (1 - SWAP_DIP) * easeOutBack(progress.current)
    groupRef.current?.scale.setScalar(s)
  })

  return <group ref={groupRef}>{children}</group>
}

type FigureModelProps = {
  fit: number
  fitHeight: number
  yaw: number
  reduced: boolean
  accent: string
  equip: boolean
}

/** Loads + fits the active fit, plays its idle, and clips the accent charm on. */
function FigureModel({ fit, fitHeight, yaw, reduced, accent, equip }: FigureModelProps): JSX.Element {
  const gltf = useLoader(GLTFLoader, fitSrc(fit))
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

  const fitTransform = useMemo(() => {
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
  // save shows it, a selected-accent token in the figure's hand. Recreated when
  // the fit swaps (new scene, new bone); disposed and unparented on unmount so
  // the cached GLB is left clean.
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
      <group scale={fitTransform.scale} position={fitTransform.offset}>
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
  fit: number
  yaw: number
  reduced: boolean
  accent: string
  equip: boolean
  fitHeight?: number
}

/**
 * The scene contents for the figure — the accent rim plus the character, warmed
 * by the idle fit preloader. Mounted as `VignetteCanvas` children by the screen
 * so the figure shares the stage rig.
 */
export function FigureSceneContents({
  fit,
  yaw,
  reduced,
  accent,
  equip,
  fitHeight = 2.35,
}: FigureStageChildrenProps): JSX.Element {
  return (
    <>
      <AccentRim accent={accent} reduced={reduced} />
      <FitPreloader />
      <FigureBoundary>
        <SwapPop fit={fit} reduced={reduced}>
          <Suspense fallback={null}>
            <FigureModel
              fit={fit}
              fitHeight={fitHeight}
              yaw={yaw}
              reduced={reduced}
              accent={accent}
              equip={equip}
            />
          </Suspense>
        </SwapPop>
      </FigureBoundary>
    </>
  )
}

export default FigureSceneContents
