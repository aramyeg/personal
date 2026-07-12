'use client'

/**
 * FigureStage — the hero half of the select screen, and the payoff of the whole
 * lab: the character stands large on a lit ground, slowly turning on a
 * turntable, and choosing a save re-dresses it into that save's fit. Each save
 * owns a fit GLB (a distinct outfit on a shared skeleton, saves.ts maps
 * slot→fit); the active fit loads, plays its baked idle, and swaps for the next
 * when the highlighted save changes.
 *
 * Renderer law (spec §2). Fits render as PS-era unlit polygons: on load every
 * material is converted to an unlit `MeshBasicMaterial` (map only) and every
 * texture is point-sampled with no mip chain. "Lighting lives in the texture" —
 * AO, folds and seams are baked into each fit's atlas — so the material must be
 * unlit or that baked light would be double-shaded; PBR/normal contributions are
 * dropped and tone-mapping disabled so the paint renders 1:1. The per-save accent
 * is therefore delivered as ATMOSPHERE, never as material lights (which unlit
 * materials ignore anyway): a canvas-side accent ground glow here, meeting the
 * DOM-side accent backdrop the screen composites behind this transparent canvas.
 * The renderer pass is written over the loaded scene, not per file, so the E2
 * repainted GLBs inherit it through the same loader path.
 *
 * Turntable. One slow revolution (~28s, constant rate) driven by a rAF loop that
 * calls `invalidate()` on the canvas's demand frameloop, so the spin PAUSES for
 * free when the tab is hidden, the canvas unmounts off-viewport (the shared rig's
 * IntersectionObserver), or an overlay dialog/route covers the hero (`paused`,
 * the signal the screen already owns). Under reduced motion there is no spin: the
 * figure holds a static three-quarter pose and the idle is sampled to one frame.
 *
 * Swap choreography (~280ms, the shared select clock). On a fit change the figure
 * dips and springs back (equip pop, easeOutBack) while the accent ground glow
 * crossfades to the new accent — in step with the screen's atmosphere crossfade
 * and title swap. The other fits are warmed into the loader cache once idle, so a
 * re-dress hits cache; a cold swap degrades to the Suspense fallback while the
 * turntable keeps turning. StrictMode law: anything created here is disposed in a
 * paired cleanup; loader-cache-owned scenes/materials/textures are never disposed.
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
import {
  MAX_FRAME_DELTA,
  REDUCED_YAW,
  SPIN_RATE,
  applyEraRenderer,
  turntableRunning,
} from '../lib/figure-era'
import { MC, MOTION } from '../tokens'
import { CHARACTER_IDLE_CLIP, FIT_COUNT, fitSrc } from './character'

/** A second into the idle lands on a natural mid-pose, not the frame-0 A-pose. */
const REDUCED_POSE_TIME = 0.6

/** Equip pop: how far the figure squashes at the start of a re-dress. It settles
 *  back over the shared select clock (MOTION.select). */
const SWAP_DIP = 0.82

/** easeOutBack — settles at exactly 1 after a small overshoot; gives the equip
 *  pop its snap. Constants are the CSS `back` curve's defaults. */
const BACK_C1 = 1.70158
const BACK_C3 = BACK_C1 + 1
function easeOutBack(x: number): number {
  return 1 + BACK_C3 * (x - 1) ** 3 + BACK_C1 * (x - 1) ** 2
}

/** Accent ground glow radius (world units) and its resting opacity. */
const GROUND_RADIUS = 1.5
const GROUND_OPACITY = 0.5

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

/**
 * Seam law: clear the figure canvas to the ink token behind it (imported, never
 * a hex literal), fully transparent so the DOM accent atmosphere composites
 * through. The shared rig clears to transparent black; this re-points the colour
 * channel at the exact ink token for an honest seam.
 */
function SeamClear(): null {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    gl.setClearColor(new THREE.Color(MC.ink), 0)
  }, [gl])
  return null
}

/** Soft white radial disc — tinted by the material colour into an accent pool. */
function makeGroundGlow(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.32)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * The canvas-side accent ground: a soft glow disc on the floor, unlit and
 * era-flat (no PBR), tinted to the active accent — the character-visible ground
 * contact that meets the DOM atmosphere. It stays fixed while the figure turns.
 * On a save change its colour crossfades to the new accent over the shared select
 * clock; under reduced motion it snaps and forces one repaint (the demand loop
 * won't advance a lerp on its own).
 */
function AccentGround({ accent, reduced }: { accent: string; reduced: boolean }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  const invalidate = useThree((s) => s.invalidate)

  const target = useMemo(() => new THREE.Color(accent), [accent])
  const from = useRef(new THREE.Color(accent))
  const progress = useRef(1)

  // Paired create + dispose in ONE effect (StrictMode texture law, per
  // crt-vignette): a memo runs once but an effect cleanup re-runs on the dev
  // double-mount, so a memoized-then-cleanup-disposed texture would leave the
  // material pointing at an already-disposed texture. Creating it here means
  // every effect run owns a fresh glow texture and disposes exactly that one.
  useLayoutEffect(() => {
    const mat = matRef.current
    if (!mat) return
    const tex = makeGroundGlow()
    mat.map = tex
    mat.needsUpdate = true
    invalidate()
    return () => {
      mat.map = null
      mat.needsUpdate = true
      tex.dispose()
    }
  }, [invalidate])

  useLayoutEffect(() => {
    const mat = matRef.current
    if (!mat) return
    if (reduced) {
      mat.color.copy(target)
      invalidate()
      return
    }
    from.current.copy(mat.color)
    progress.current = 0
  }, [target, reduced, invalidate])

  useFrame((_, dt) => {
    if (reduced || progress.current >= 1) return
    progress.current = Math.min(1, progress.current + dt / MOTION.select)
    matRef.current?.color.lerpColors(from.current, target, progress.current)
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
      <circleGeometry args={[GROUND_RADIUS, 48]} />
      <meshBasicMaterial
        ref={matRef}
        color={accent}
        transparent
        depthWrite={false}
        opacity={GROUND_OPACITY}
        toneMapped={false}
      />
    </mesh>
  )
}

/**
 * Warms the loader cache for every fit shortly after first paint, so a re-dress
 * hits cache (near-instant). Preloading a fit that is already loaded is a cache
 * no-op, so the active fit is included and no per-swap bookkeeping is needed.
 *
 * The warm prefers `requestIdleCallback` but MUST carry a `timeout`: a busy rAF
 * loop can starve idle callbacks, so the timeout guarantees the warm runs. A
 * plain `setTimeout` is the fallback where rIC is absent.
 */
function FitPreloader(): null {
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
 * The turntable. Owns the yaw group (so the spin survives fit swaps and cold
 * Suspense gaps) and drives it from a single rAF loop that advances the angle at
 * a constant rate and calls `invalidate()` on the canvas's demand frameloop. The
 * loop is torn down while `paused` (an overlay covers the hero) and skips work
 * while the tab is hidden — the angle is held in a ref so it resumes seamlessly.
 * Under reduced motion the group is parked at the static three-quarter pose and
 * the loop never runs.
 */
function Turntable({
  reduced,
  paused,
  children,
}: {
  reduced: boolean
  paused: boolean
  children: ReactNode
}) {
  const groupRef = useRef<THREE.Group>(null)
  const angle = useRef(0)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    const group = groupRef.current
    if (!group) return

    if (reduced) {
      group.rotation.y = REDUCED_YAW
      invalidate()
      return
    }
    if (paused) return // frozen at the held angle; re-runs when paused clears

    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      if (turntableRunning({ reduced, paused, hidden: document.hidden })) {
        const dt = Math.min((now - last) / 1000, MAX_FRAME_DELTA)
        angle.current = (angle.current + dt * SPIN_RATE) % (Math.PI * 2)
        group.rotation.y = angle.current
        invalidate()
      }
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // Becoming visible resets the clock so hidden time never lands as one jump.
    const onVisible = () => {
      if (!document.hidden) last = performance.now()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reduced, paused, invalidate])

  return <group ref={groupRef}>{children}</group>
}

/**
 * The equip pop. On every fit change after the first, the wrapped figure
 * squashes to `SWAP_DIP` and springs back to full scale with a small overshoot,
 * settling over the shared select clock. Under reduced motion it is inert (no
 * squash, instant swap) — the demand loop wouldn't advance the ease. Sits OUTSIDE
 * the model's Suspense boundary so its frame loop survives a cold swap's gap.
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

  useLayoutEffect(() => {
    if (prevFit.current === fit) return
    prevFit.current = fit
    if (reduced) return
    progress.current = 0
    groupRef.current?.scale.setScalar(SWAP_DIP)
  }, [fit, reduced])

  useFrame((_, dt) => {
    if (reduced || progress.current >= 1) return
    progress.current = Math.min(1, progress.current + dt / MOTION.select)
    const s = SWAP_DIP + (1 - SWAP_DIP) * easeOutBack(progress.current)
    groupRef.current?.scale.setScalar(s)
  })

  return <group ref={groupRef}>{children}</group>
}

type FigureModelProps = {
  fit: number
  fitHeight: number
  reduced: boolean
}

/** Loads + fits the active fit, converts it to the era renderer, and plays its
 *  idle. The turntable above owns the yaw. */
function FigureModel({ fit, fitHeight, reduced }: FigureModelProps): JSX.Element {
  const gltf = useLoader(GLTFLoader, fitSrc(fit))
  const invalidate = useThree((s) => s.invalidate)

  // Era renderer pass — unlit, point-sampled, no PBR. Runs in a layout effect so
  // the conversion lands before the first paint of a newly-loaded/swapped scene,
  // never a frame of lit PBR before it. Mutates the loader-cached scene in place
  // and restores + disposes-only-ours on cleanup (StrictMode law).
  useLayoutEffect(() => {
    const restore = applyEraRenderer(gltf.scene)
    invalidate()
    return restore
  }, [gltf.scene, invalidate])

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

  // Clamp the idle delta so a resume after a pause never fast-forwards the clip.
  useFrame((_, dt) => {
    if (mixer && !reduced) mixer.update(Math.min(dt, MAX_FRAME_DELTA))
  })

  return (
    <group scale={fitTransform.scale} position={fitTransform.offset}>
      <primitive object={gltf.scene} />
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
  reduced: boolean
  accent: string
  /** True while an overlay dialog/route covers the hero — the turntable freezes. */
  paused: boolean
  fitHeight?: number
}

/**
 * The scene contents for the figure — seam clear, accent ground, and the
 * turntable-mounted character, warmed by the idle fit preloader. Mounted as
 * `VignetteCanvas` children by the screen so the figure shares the stage rig.
 */
export function FigureSceneContents({
  fit,
  reduced,
  accent,
  paused,
  fitHeight = 2.35,
}: FigureStageChildrenProps): JSX.Element {
  return (
    <>
      <SeamClear />
      <AccentGround accent={accent} reduced={reduced} />
      <FitPreloader />
      <FigureBoundary>
        <Turntable reduced={reduced} paused={paused}>
          <SwapPop fit={fit} reduced={reduced}>
            <Suspense fallback={null}>
              <FigureModel fit={fit} fitHeight={fitHeight} reduced={reduced} />
            </Suspense>
          </SwapPop>
        </Turntable>
      </FigureBoundary>
    </>
  )
}

export default FigureSceneContents
