'use client'

/**
 * SaveCard — the single branded memory card the "select file" stage shows for a
 * project / written-with / contact save. It's the single-object distillation of
 * the old `card-rail.tsx`: the shipped GLB (`memory-card.glb`, PlayStation front
 * decal baked in), measured + fit ONCE at a fixed world-height, with the printed
 * save-label stickers (`lib/label-texture.ts`) floated over its blank recess.
 *
 * One card, driven entirely by the `save` prop:
 *  - project → front sticker (slot · title · saved-year) plus a back sticker of
 *    its metrics; a tap flips it π to reveal that back.
 *  - written-with (stack) → rests already turned to its back, which carries the
 *    curated-stack sticker; `flipped` is ignored (there's nothing more to show).
 *  - contact → a bare card (the branded decal only, no printed sticker at all).
 *
 * Highlighting a new save eject-nudges the card (a 0.25s up-and-back hop while
 * the fresh sticker prints in) and pointer-drag rotates it within a bounded
 * inspect arc that springs back on release. Under reduced motion none of that
 * runs: the card sits at a static three-quarter pose, stickers swap instantly,
 * and the stage's demand frameloop is nudged once to paint it.
 *
 * StrictMode discipline (carried from the rail): the sticker CanvasTextures are
 * the only GPU resources this component owns, disposed in paired memo/effect
 * cleanups; the GLB clone shares the loader cache and is never disposed here —
 * the Canvas unmount (IO gating) reclaims the context.
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
import { useFrame, useLoader, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { grotesk } from '../fonts'
import { fitToStage } from '../lib/fit-model'
import { makeFrontSticker, makeBackSticker } from '../lib/label-texture'
import { WRITTEN_WITH } from '../lib/written-with'
import type { SaveSlot } from '../save-select/saves'

const SRC = '/labs/memory-card/models/memory-card.glb'

const FIT_HEIGHT = 1.9
const FLOOR_Y = 0

/** Resting orientation: π turns the branded model −Z face toward the +Z camera. */
const BASE_YAW = Math.PI
/** A pleasant static three-quarter turn for the reduced-motion still. */
const REDUCED_YAW = -0.42

/**
 * Card-face geometry, measured off the GLB after its own transforms — the recess
 * center + size the printed stickers float over. Verbatim from the rail: front
 * is the model −Z (branded) face, back is +Z. See `card-rail.tsx` for the full
 * derivation from the 768×1039 face texture's label window.
 */
const RECESS_CX = 0.0132
const RECESS_CY = -0.3395
const RECESS_W = 1.117
const RECESS_H = 0.703
const FRONT_Z = -0.1094 // model −Z face (−0.1054) floated 0.004 outward
const BACK_Z = 0.1311 // model +Z face (0.1271) floated 0.004 outward

/** Card footprint is ~1.4 world units wide at FIT_HEIGHT — pool sized to it. */
const CARD_SHADOW_RADIUS = 0.95

/** Eject-nudge on save change: a short up-and-back hop while the sticker prints in. */
const EJECT_DURATION = 0.25 // seconds
const EJECT_RISE = 0.06 // world units at the peak

/** Bounded pointer inspect: yaw clamp around the resting orientation, and its feel. */
const DRAG_CLAMP = 0.5 // rad, either side of resting
const DRAG_SENSITIVITY = 0.005 // rad per px dragged
const TAP_SLOP = 4 // px of travel before a press counts as a drag, not a tap

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/**
 * Soft radial pool for the card's floor shadow — the same gradient the stage's
 * ContactShadow draws, carried per-card so it rides the eject hop's base rather
 * than sitting detached at the stage origin (rail T8 precedent).
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

/**
 * World-space bounds of the loaded scene. `updateMatrixWorld(true)` up front so
 * every mesh reports settled world matrices before we union their bounds — the
 * guard the vignette fit relies on.
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

export type SaveCardProps = {
  save: SaveSlot
  flipped: boolean
  reduced: boolean
  onTap?: () => void
}

/** Loads + fits the GLB, floats the save stickers, animates the eject/flip/inspect. */
function SaveCardInner({ save, flipped, reduced, onTap }: SaveCardProps) {
  const gltf = useLoader(GLTFLoader, SRC)
  const invalidate = useThree((s) => s.invalidate)

  const pivot = useRef<THREE.Group>(null)
  const frontMat = useRef<THREE.MeshStandardMaterial>(null)
  const backMat = useRef<THREE.MeshStandardMaterial>(null)
  const ejectStart = useRef(0)
  const drag = useRef({ active: false, moved: false, startX: 0, yaw: 0 })
  const didInit = useRef(false)

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

  // One clone keeps this card isolated from any other consumer of the cached
  // GLB; it shares geometry + materials, so it's cheap and needs no disposal.
  const model = useMemo(() => gltf.scene.clone(true), [gltf.scene])

  // The card's own floor-pool texture (component-owned, so it IS disposed — the
  // same memo + paired-dispose idiom as the stickers).
  const shadowTex = useMemo(() => makeShadowTexture(), [])
  useEffect(() => () => shadowTex.dispose(), [shadowTex])

  const fit = useMemo(() => {
    const box = measureScene(model)
    if (box.isEmpty()) {
      return { scale: 1, offset: [0, FLOOR_Y, 0] as [number, number, number] }
    }
    return fitToStage(
      [box.min.x, box.min.y, box.min.z],
      [box.max.x, box.max.y, box.max.z],
      FIT_HEIGHT,
      FLOOR_Y
    )
  }, [model])

  const titleFont = grotesk.style.fontFamily

  // Front sticker: projects only (slot · title · saved-year). `fontsReady` forces
  // one redraw once the webfont resolves; the paired effect disposes the old tex.
  const frontTex = useMemo(() => {
    if (save.kind !== 'project') return null
    return makeFrontSticker(
      { slot: save.slot, title: save.label, year: save.project?.year ?? '', accent: save.accent },
      titleFont
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.kind, save.slot, save.label, save.project?.year, save.accent, titleFont, fontsReady])
  useEffect(() => () => frontTex?.dispose(), [frontTex])

  // Back sticker: a project's metrics, or the curated-stack names for the
  // written-with card (which rests turned to this face). Contact has no sticker.
  const backTex = useMemo(() => {
    if (save.kind === 'project') {
      return makeBackSticker({ slot: save.slot, metrics: save.project?.metrics ?? [], accent: save.accent })
    }
    if (save.kind === 'stack') {
      return makeBackSticker({
        slot: save.slot,
        metrics: WRITTEN_WITH.slice(0, 4).map((e) => e.name),
        accent: save.accent,
      })
    }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.kind, save.slot, save.project?.metrics, save.accent, fontsReady])
  useEffect(() => () => backTex?.dispose(), [backTex])

  // The written-with card is authored back-first; every other card rests front-on.
  const restingYaw = save.kind === 'stack' ? BASE_YAW + Math.PI : BASE_YAW
  // A flip only means something where a back sticker waits behind the front.
  const flipApplies = save.kind !== 'stack'

  // Seed the resting orientation. Reduced motion snaps to the static
  // three-quarter pose (instant flip too) and nudges the demand frameloop; the
  // motion path seeds once on mount so useFrame lerps from a sane pose, never a
  // full spin up from zero.
  useLayoutEffect(() => {
    const p = pivot.current
    if (!p) return
    p.rotation.x = 0
    const flip = flipApplies && flipped ? Math.PI : 0
    if (reduced) {
      p.rotation.y = restingYaw + flip + REDUCED_YAW
      p.position.y = 0
      invalidate()
    } else if (!didInit.current) {
      p.rotation.y = restingYaw + flip
    }
    didInit.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, restingYaw, flipped, invalidate])

  // Start an eject hop whenever the highlighted save changes (motion only).
  useEffect(() => {
    if (reduced) return
    ejectStart.current = performance.now()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save])

  // Repaint the demand frameloop when the shown content changes under reduced
  // motion, so the instant sticker swap actually lands on screen.
  useEffect(() => {
    if (reduced) invalidate()
  }, [reduced, invalidate, frontTex, backTex, fit])

  useFrame((_, dt) => {
    const p = pivot.current
    if (!p || reduced) return

    // Eject hop: y out-and-back over EJECT_DURATION, with the fresh sticker
    // fading up from transparent as the card returns (crossfade via opacity).
    const elapsed = (performance.now() - ejectStart.current) / 1000
    let opacity = 1
    if (elapsed < EJECT_DURATION) {
      const t = elapsed / EJECT_DURATION
      p.position.y = EJECT_RISE * Math.sin(Math.PI * t)
      opacity = t
      invalidate()
    } else if (p.position.y !== 0) {
      p.position.y = 0
    }
    if (frontMat.current) frontMat.current.opacity = opacity
    if (backMat.current) backMat.current.opacity = opacity

    // Yaw: resting + flip + the live inspect offset, exponentially eased. On
    // release the drag term drops and the same easing springs it back.
    const flip = flipApplies && flipped ? Math.PI : 0
    const target = restingYaw + flip + (drag.current.active ? drag.current.yaw : 0)
    const k = Math.min(1, dt * 8)
    p.rotation.y += (target - p.rotation.y) * k
    if (Math.abs(target - p.rotation.y) > 1e-3) invalidate()
  })

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const el = e.target as unknown as { setPointerCapture?: (id: number) => void }
    el.setPointerCapture?.(e.pointerId)
    drag.current = { active: !reduced, moved: false, startX: e.clientX, yaw: 0 }
  }
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d.active) return
    const dx = e.clientX - d.startX
    if (Math.abs(dx) > TAP_SLOP) d.moved = true
    d.yaw = clamp(dx * DRAG_SENSITIVITY, -DRAG_CLAMP, DRAG_CLAMP)
    invalidate()
  }
  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    // Stop at the frontmost hit: the card is several meshes deep (GLB shells +
    // sticker planes), and without this the group handler fires once per pierced
    // mesh — an even number of onTap()s that cancel the flip out. Mirrors the
    // stopPropagation the press already does (canonical R3F capture pattern).
    e.stopPropagation()
    const d = drag.current
    const el = e.target as unknown as { releasePointerCapture?: (id: number) => void }
    el.releasePointerCapture?.(e.pointerId)
    // A press that never travelled is a tap — the screen turns it into a flip /
    // load; a real drag was an inspect and must not trigger either.
    if (!d.moved) onTap?.()
    d.active = false
    d.yaw = 0
    invalidate()
  }

  return (
    <group>
      {/* Floor pool OUTSIDE the pivot: holds its ground while the card hops/turns. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[CARD_SHADOW_RADIUS, 48]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} opacity={0.9} />
      </mesh>
      <group
        ref={pivot}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <group scale={fit.scale} position={fit.offset}>
          <primitive object={model} />
          {/* Front sticker over the branded (−Z) recess, turned to read upright
              once the base yaw brings that face to the camera. */}
          {frontTex && (
            <mesh position={[RECESS_CX, RECESS_CY, FRONT_Z]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[RECESS_W, RECESS_H]} />
              <meshStandardMaterial
                ref={frontMat}
                map={frontTex}
                roughness={0.62}
                metalness={0}
                transparent
              />
            </mesh>
          )}
          {/* Back sticker over the +Z recess — a project's metrics on flip, or
              the written-with card's resting face. */}
          {backTex && (
            <mesh position={[RECESS_CX, RECESS_CY, BACK_Z]}>
              <planeGeometry args={[RECESS_W, RECESS_H]} />
              <meshStandardMaterial
                ref={backMat}
                map={backTex}
                roughness={0.62}
                metalness={0}
                transparent
              />
            </mesh>
          )}
        </group>
      </group>
    </group>
  )
}

type BoundaryProps = { children: ReactNode }
type BoundaryState = { failed: boolean }

/**
 * Swallows a failed GLB load so the stage simply renders nothing (the strip
 * index beside it carries every fact). No logging — three owns the console.
 */
class CardErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }
  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export function SaveCard(props: SaveCardProps) {
  return (
    <CardErrorBoundary>
      <Suspense fallback={null}>
        <SaveCardInner {...props} />
      </Suspense>
    </CardErrorBoundary>
  )
}

export default SaveCard
