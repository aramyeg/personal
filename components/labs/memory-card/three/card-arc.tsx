'use client'

/**
 * CardArc — the spinning save index. One branded memory card per save, arranged
 * on an arc: the non-focused cards turn slowly on their own axis while the
 * focused card eases to face the camera at full size so its printed label reads.
 * The arc IS the index (the old strip list is gone); a DOM listbox beside it
 * carries the same saves for keyboard + assistive tech.
 *
 * The card is the shipped GLB (`memory-card.glb`, branded front decal baked in),
 * loaded ONCE and `clone(true)`'d per save — clones share geometry + materials,
 * so six of them stay cheap. Each clone wears its save's printed sticker over
 * the blank recess (`lib/label-texture.ts`): projects get the front save-label,
 * system saves get a matching system label. Scene fog the colour of the void
 * melts the far cards into the backdrop for depth.
 *
 * Two composition variants change only the arc geometry: `a` fans the cards
 * left-to-right, `b` stacks them on a vertical arc. Motion runs only under the
 * live frameloop; reduced motion snaps to a static, readable pose and repaints
 * once (the shared canvas's demand loop).
 */

import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MC } from '../tokens'
import { grotesk } from '../fonts'
import { fitToStage } from '../lib/fit-model'
import { makeFrontSticker, makeSystemSticker } from '../lib/label-texture'
import type { SaveSlot } from '../save-select/saves'

const SRC = '/labs/memory-card/models/memory-card.glb'

export type ArcVariant = 'a' | 'b'

/** Base card height before per-card focus scaling. */
const FIT_HEIGHT = 1.62
/** World-height the focused card centres on; every card rests on floor y=0. */
const BASE_Y = 0.82
/** Sticker-to-camera resting yaw (π turns the branded −Z face front). */
const BASE_YAW = Math.PI
/** A pleasant static three-quarter turn for a non-focused reduced-motion card. */
const REDUCED_YAW = -0.5
const SPIN_SPEED = 0.5 // rad/s idle turntable
const FOCUS_SCALE = 1.5
const BASE_SCALE = 0.64
const FALLOFF = 1.3 // how quickly scale falls off with distance from focus

/** Card-face recess geometry (verbatim from card-rail: front is the −Z face). */
const RECESS_CX = 0.0132
const RECESS_CY = -0.3395
const RECESS_W = 1.117
const RECESS_H = 0.703
const FRONT_Z = -0.1094
const CARD_SHADOW_RADIUS = 0.95

/** Short tag printed on each system card's label chip row. */
const SYSTEM_TAG: Record<string, string> = { bio: 'system', stack: 'log', contact: 'save' }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Ease an angle toward a target along the shortest path (handles ±π wrap). */
function easeAngle(current: number, target: number, k: number): number {
  let d = (target - current) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return current + d * k
}

type ArcPose = { x: number; y: number; z: number }

/** Where a card sits given its signed distance `rel` from the focused card. */
function arcPose(rel: number, variant: ArcVariant): ArcPose {
  const depth = Math.min(Math.abs(rel), 3)
  const pop = (1 - clamp01(Math.abs(rel))) * 0.5 // focused card leans toward camera
  if (variant === 'a') {
    // Horizontal fan: cards spread left↔right, receding and cascading down.
    return {
      x: rel * 1.74,
      y: BASE_Y - depth * 0.26,
      z: -depth * 0.95 + pop,
    }
  }
  // Vertical stack-arc: the focused card leads, the rest cascade down and back
  // on a diagonal — a distinct silhouette from the horizontal fan.
  return {
    x: 0.28 + depth * 0.52,
    y: BASE_Y - rel * 0.82,
    z: -depth * 0.9 + pop,
  }
}

function makeShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  grad.addColorStop(0, 'rgba(0,0,0,0.4)')
  grad.addColorStop(0.55, 'rgba(0,0,0,0.2)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function measureScene(scene: THREE.Object3D): THREE.Box3 {
  scene.updateMatrixWorld(true)
  const box = new THREE.Box3()
  const tmp = new THREE.Box3()
  scene.traverse((o) => {
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

/** Cool fog the colour of the void so distant cards dissolve into the backdrop. */
function SceneFog() {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const prev = scene.fog
    scene.fog = new THREE.Fog(MC.ink, 5.5, 11)
    return () => {
      scene.fog = prev
    }
  }, [scene])
  return null
}

/** Build a save's printed front sticker — project label or system label. */
function stickerFor(save: SaveSlot, titleFont: string): THREE.CanvasTexture {
  if (save.kind === 'project') {
    return makeFrontSticker(
      { slot: save.slot, title: save.label, year: save.project?.year ?? '', accent: save.accent },
      titleFont
    )
  }
  return makeSystemSticker(
    {
      slot: save.slot,
      label: save.label,
      sub: save.sub,
      tag: SYSTEM_TAG[save.kind] ?? 'data',
      accent: save.accent,
    },
    titleFont
  )
}

type CardProps = {
  save: SaveSlot
  index: number
  clone: THREE.Object3D
  fit: { scale: number; offset: [number, number, number] }
  focusRef: React.RefObject<number>
  variant: ArcVariant
  reduced: boolean
  shadowTex: THREE.CanvasTexture
}

/** One card: clone + printed sticker, driven each frame from the shared focus. */
function Card({ save, index, clone, fit, focusRef, variant, reduced, shadowTex }: CardProps) {
  const outer = useRef<THREE.Group>(null)
  const scaler = useRef<THREE.Group>(null)
  const pivot = useRef<THREE.Group>(null)
  const [fontsReady, setFontsReady] = useState(false)

  useEffect(() => {
    let alive = true
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (fonts?.ready) fonts.ready.then(() => alive && setFontsReady(true))
    else setFontsReady(true)
    return () => {
      alive = false
    }
  }, [])

  const titleFont = grotesk.style.fontFamily
  const tex = useMemo(
    () => stickerFor(save, titleFont),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [save.slot, save.kind, save.label, save.sub, save.accent, titleFont, fontsReady]
  )
  useEffect(() => () => tex.dispose(), [tex])

  const applyStatic = (focus: number) => {
    const o = outer.current
    const s = scaler.current
    const p = pivot.current
    if (!o || !s || !p) return
    const rel = index - focus
    const pose = arcPose(rel, variant)
    o.position.set(pose.x, pose.y, pose.z)
    const focused = Math.abs(rel) < 0.5
    const scale = BASE_SCALE + (FOCUS_SCALE - BASE_SCALE) * clamp01(1 - Math.abs(rel) / FALLOFF)
    s.scale.setScalar(scale)
    p.rotation.y = focused ? BASE_YAW : BASE_YAW + REDUCED_YAW
  }

  // Seed a sane pose before first paint so no card flashes its blank back face.
  useLayoutEffect(() => {
    applyStatic(focusRef.current ?? index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant])

  useFrame((_, dt) => {
    if (reduced) return
    const o = outer.current
    const s = scaler.current
    const p = pivot.current
    if (!o || !s || !p) return
    const focus = focusRef.current ?? index
    const rel = index - focus
    const pose = arcPose(rel, variant)
    const k = Math.min(1, dt * 6)
    o.position.x += (pose.x - o.position.x) * k
    o.position.y += (pose.y - o.position.y) * k
    o.position.z += (pose.z - o.position.z) * k
    const targetScale =
      BASE_SCALE + (FOCUS_SCALE - BASE_SCALE) * clamp01(1 - Math.abs(rel) / FALLOFF)
    const cur = s.scale.x
    s.scale.setScalar(cur + (targetScale - cur) * k)
    if (Math.abs(rel) < 0.5) {
      p.rotation.y = easeAngle(p.rotation.y, BASE_YAW, k)
    } else {
      p.rotation.y += SPIN_SPEED * dt
    }
  })

  return (
    <group ref={outer}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -BASE_Y, 0]}>
        <circleGeometry args={[CARD_SHADOW_RADIUS, 48]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} opacity={0.85} />
      </mesh>
      <group ref={scaler}>
        <group ref={pivot}>
          <group scale={fit.scale} position={fit.offset}>
            <primitive object={clone} />
            <mesh position={[RECESS_CX, RECESS_CY, FRONT_Z]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[RECESS_W, RECESS_H]} />
              <meshStandardMaterial map={tex} roughness={0.6} metalness={0} transparent />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

export type CardArcProps = {
  saves: SaveSlot[]
  focusIndex: number
  variant: ArcVariant
  reduced: boolean
}

/** Loads + fits the GLB once, then eases the shared focus and renders the cards. */
function CardArcInner({ saves, focusIndex, variant, reduced }: CardArcProps) {
  const gltf = useLoader(GLTFLoader, SRC)
  const invalidate = useThree((s) => s.invalidate)
  const focusRef = useRef<number>(focusIndex)

  const fit = useMemo(() => {
    const box = measureScene(gltf.scene)
    if (box.isEmpty()) return { scale: 1, offset: [0, 0, 0] as [number, number, number] }
    return fitToStage(
      [box.min.x, box.min.y, box.min.z],
      [box.max.x, box.max.y, box.max.z],
      FIT_HEIGHT,
      0
    )
  }, [gltf.scene])

  const clones = useMemo(() => saves.map(() => gltf.scene.clone(true)), [gltf.scene, saves])

  const shadowTex = useMemo(() => makeShadowTexture(), [])
  useEffect(() => () => shadowTex.dispose(), [shadowTex])

  // Reduced motion: snap the shared focus and force one repaint of the static
  // arc (the demand loop never advances useFrame). Live motion eases in useFrame.
  useEffect(() => {
    if (reduced) {
      focusRef.current = focusIndex
      invalidate()
    }
  }, [reduced, focusIndex, variant, fit, clones, invalidate])

  useFrame((_, dt) => {
    if (reduced) return
    const k = Math.min(1, dt * 6)
    focusRef.current += (focusIndex - focusRef.current) * k
  })

  return (
    <>
      <SceneFog />
      {saves.map((save, index) => (
        <Card
          key={save.slot}
          save={save}
          index={index}
          clone={clones[index]}
          fit={fit}
          focusRef={focusRef}
          variant={variant}
          reduced={reduced}
          shadowTex={shadowTex}
        />
      ))}
    </>
  )
}

type BoundaryProps = { children: ReactNode }
type BoundaryState = { failed: boolean }

/** Swallows a failed GLB load — the DOM index + story band carry every fact. */
class ArcErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }
  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export function CardArc(props: CardArcProps) {
  return (
    <ArcErrorBoundary>
      <Suspense fallback={null}>
        <CardArcInner {...props} />
      </Suspense>
    </ArcErrorBoundary>
  )
}

export default CardArc
