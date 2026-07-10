'use client'

/**
 * CardRail — the horizontal rail of real branded memory cards for the Work act.
 *
 * The card is the shipped GLB (`memory-card.glb`, PlayStation-branded front
 * decal baked into the mesh). It's loaded ONCE and `clone(true)`'d per project;
 * clones share geometry + materials, so a rail of them is cheap. The whole rail
 * is measured and fit ONCE (the same union-of-mesh-bounds pattern the single
 * vignette uses) and every clone's wrapper takes that one scale/offset, sitting
 * at world x = idx × RAIL_GAP.
 *
 * Each clone carries two floated stickers — a printed save-label over the card's
 * blank recess (front: slot + title; back: metrics) — drawn as CanvasTextures.
 * The recess rect and face convention are measured constants (see below): the
 * front face is the model −Z (branded) side, the back is +Z.
 *
 * Motion lives in `useFrame` and only runs while the stage's frameloop is live
 * (never under reduced motion — there the cards render once at a static pose):
 * the rail x tracks a spring MotionValue, and the card nearest center tilts to
 * the cursor and flips on click.
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
  type RefObject,
} from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { type MotionValue } from 'framer-motion'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { accentFor } from '../tokens'
import { grotesk } from '../fonts'
import { fitToStage } from '../lib/fit-model'
import { makeFrontSticker, makeBackSticker } from '../lib/label-texture'
import type { ExtendedProject } from '@/data/projects'

const SRC = '/labs/memory-card/models/memory-card.glb'

/** Rail spacing and framing. */
export const RAIL_GAP = 3.1
const FIT_HEIGHT = 1.9
const FLOOR_Y = 0 // cards rest on the floor; the camera aims at their mid-height

/** Resting orientation: π turns the branded model −Z face toward the +Z camera. */
const BASE_YAW = Math.PI
/** A pleasant static three-quarter turn for the reduced-motion still. */
const REDUCED_YAW = -0.42

/**
 * Card-face geometry, measured off the GLB after its own transforms (world
 * bounds X −0.7163..0.7427, Y −0.9743..1.0002, Z −0.1054..0.1271). The face rect
 * maps 1:1 to a 768×1039 texture; the blank label recess is tx 90–678, ty
 * 520–890 of it. Converted to model-space coordinates (image-left → maxX on the
 * −Z face) these give the recess center + size the stickers float over.
 */
const RECESS_CX = 0.0132
const RECESS_CY = -0.3395
const RECESS_W = 1.117
const RECESS_H = 0.703
const FRONT_Z = -0.1094 // model −Z face (−0.1054) floated 0.004 outward
const BACK_Z = 0.1311 // model +Z face (0.1271) floated 0.004 outward

/**
 * Soft radial pool for the per-card floor shadow — same gradient the stage's
 * ContactShadow draws. Per-card quads ride each card's outer position group
 * (T8 review: the stage-level pool is fixed at world origin, so cards visibly
 * detached from their shadows mid-transit; the stage pool is now near-zero for
 * this section and each card carries its own).
 */
function makeShadowTexture(): THREE.CanvasTexture {
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
}

/** Card footprint is ~1.4 world units wide at FIT_HEIGHT — pool sized to it. */
const CARD_SHADOW_RADIUS = 0.95

/**
 * World-space bounds of the loaded scene. `updateMatrixWorld(true)` up front so
 * every mesh reports settled world matrices before we union their bounds — the
 * same guard the single-model vignette relies on.
 */
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

type CardProps = {
  project: ExtendedProject
  index: number
  clone: THREE.Object3D
  fit: { scale: number; offset: [number, number, number] }
  railX: MotionValue<number>
  tiltRef: RefObject<{ x: number; y: number }>
  flipped: boolean
  reduced: boolean
  shadowTex: THREE.CanvasTexture
}

/** One card: the clone plus its two floated save-label stickers. */
function Card({
  project,
  index,
  clone,
  fit,
  railX,
  tiltRef,
  flipped,
  reduced,
  shadowTex,
}: CardProps) {
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

  const slot = String(index + 1).padStart(2, '0')
  const accent = accentFor(index)
  const titleFont = grotesk.style.fontFamily

  const frontTex = useMemo(
    () =>
      makeFrontSticker(
        { slot, title: project.title, year: project.year, accent },
        titleFont
      ),
    // fontsReady forces a redraw once the webfont is available
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slot, project.title, project.year, accent, titleFont, fontsReady]
  )
  useEffect(() => () => frontTex.dispose(), [frontTex])

  const backTex = useMemo(
    () => makeBackSticker({ slot, metrics: project.metrics ?? [], accent }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slot, project.metrics, accent, fontsReady]
  )
  useEffect(() => () => backTex.dispose(), [backTex])

  // Set the resting yaw before the first paint so a card never flashes its
  // blank back face for a frame while useFrame catches up.
  useLayoutEffect(() => {
    if (pivot.current) {
      pivot.current.rotation.y = reduced ? BASE_YAW + REDUCED_YAW : BASE_YAW
      pivot.current.rotation.x = 0
    }
  }, [reduced])

  useFrame((_, dt) => {
    const p = pivot.current
    if (!p || reduced) return
    const center = Math.round(-railX.get() / RAIL_GAP)
    const isCenter = center === index
    const tilt = isCenter ? tiltRef.current : { x: 0, y: 0 }
    const targetY = BASE_YAW + (isCenter && flipped ? Math.PI : 0) + tilt.y
    const k = Math.min(1, dt * 8)
    p.rotation.y += (targetY - p.rotation.y) * k
    p.rotation.x += (tilt.x - p.rotation.x) * k
  })

  return (
    <group position={[index * RAIL_GAP, 0, 0]}>
      {/* Floor pool OUTSIDE the pivot: rides the card's x, never tilts/flips. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[CARD_SHADOW_RADIUS, 48]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} opacity={0.9} />
      </mesh>
      <group ref={pivot}>
        <group scale={fit.scale} position={fit.offset}>
          <primitive object={clone} />
          {/* Front sticker over the branded (−Z) face's recess. The plane is
              turned to face −Z so it reads upright once the card's base yaw
              brings that face to the camera. */}
          <mesh position={[RECESS_CX, RECESS_CY, FRONT_Z]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[RECESS_W, RECESS_H]} />
            <meshStandardMaterial map={frontTex} roughness={0.62} metalness={0} transparent />
          </mesh>
          {/* Back sticker over the +Z face, revealed on flip. */}
          <mesh position={[RECESS_CX, RECESS_CY, BACK_Z]}>
            <planeGeometry args={[RECESS_W, RECESS_H]} />
            <meshStandardMaterial map={backTex} roughness={0.62} metalness={0} transparent />
          </mesh>
        </group>
      </group>
    </group>
  )
}

export type CardRailProps = {
  projects: ExtendedProject[]
  railX: MotionValue<number>
  tiltRef: RefObject<{ x: number; y: number }>
  flipped: boolean
  reduced: boolean
}

/** Loads + fits the GLB once, then renders the cloned cards on the rail group. */
function CardRailInner({ projects, railX, tiltRef, flipped, reduced }: CardRailProps) {
  const gltf = useLoader(GLTFLoader, SRC)
  const railRef = useRef<THREE.Group>(null)
  const invalidate = useThree((s) => s.invalidate)

  const fit = useMemo(() => {
    const box = measureScene(gltf.scene)
    if (box.isEmpty()) {
      return { scale: 1, offset: [0, FLOOR_Y, 0] as [number, number, number] }
    }
    return fitToStage(
      [box.min.x, box.min.y, box.min.z],
      [box.max.x, box.max.y, box.max.z],
      FIT_HEIGHT,
      FLOOR_Y
    )
  }, [gltf.scene])

  // One clone per project — static mesh, so clones share geometry + materials.
  const clones = useMemo(
    () => projects.map(() => gltf.scene.clone(true)),
    [gltf.scene, projects]
  )

  // One shared floor-pool texture for every card's shadow quad (rail-owned, so
  // it IS disposed — same memo+paired-dispose idiom as the sticker textures).
  const shadowTex = useMemo(() => makeShadowTexture(), [])
  useEffect(() => () => shadowTex.dispose(), [shadowTex])

  // No disposal here: the clones share the loader-cached geometry/materials, and
  // the stage's canvas unmount (IO gating) owns GPU cleanup — the StrictMode
  // precedent. Only the per-card CanvasTextures are disposed, inside Card.

  // Under reduced motion the stage runs a demand frameloop that never advances
  // useFrame, so once the model is fit + cloned force one repaint to paint the
  // static rail (mirrors the single vignette's reduced-pose invalidate).
  useEffect(() => {
    if (reduced) invalidate()
  }, [reduced, invalidate, fit, clones])

  useFrame(() => {
    const g = railRef.current
    if (g && !reduced) g.position.x = railX.get()
  })

  return (
    <group ref={railRef}>
      {projects.map((project, index) => (
        <Card
          key={project.id}
          project={project}
          index={index}
          clone={clones[index]}
          fit={fit}
          railX={railX}
          tiltRef={tiltRef}
          flipped={flipped}
          reduced={reduced}
          shadowTex={shadowTex}
        />
      ))}
    </group>
  )
}

type BoundaryProps = { children: ReactNode }
type BoundaryState = { failed: boolean }

/**
 * Swallows a failed GLB load so the decorative rail simply renders nothing (the
 * crawlable list below carries every fact). No logging — three owns the console.
 */
class RailErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }
  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export function CardRail(props: CardRailProps) {
  return (
    <RailErrorBoundary>
      <Suspense fallback={null}>
        <CardRailInner {...props} />
      </Suspense>
    </RailErrorBoundary>
  )
}

export default CardRail
