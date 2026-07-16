'use client'

/**
 * The WebGL stage: Canvas, camera, candlelit lighting, desk, dust, and a
 * pointer-driven parallax rig wrapping the book. Default export so
 * `storybook-loader.tsx` can `next/dynamic(() => import('./book/book-scene'), { ssr: false })`
 * it — three.js must never reach the route's initial (server-rendered) chunk.
 */

import { type ReactNode, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { BOOK, Book, makeCanvasTexture } from './book'
import { Dust } from './dust'
import { parallaxLift } from './parallax-lift'
import { makeDeskCanvas } from '../procedural/paper-texture'
import { useStorybookStore } from '../store'

// task-17: the book is the whole-screen hero now (side-column narration
// replaces the old on-page text plates), so the camera sits noticeably
// closer than the original framing — same elevation angle (the offset from
// lookAt is just scaled down ~0.73x), just tighter, so the open spread
// reads at roughly 55-65% of viewport width on a 16:9-ish desktop instead
// of ~44%. Standing pop-up layers (up to ~1.05 world units tall) still
// clear the frustum at rest and mid-turn — verified via screenshot, not
// just math, since the perspective is a foreshortened top-down angle.
const CAMERA_POSITION: [number, number, number] = [0, 2.6, 2.9]
const CAMERA_LOOKAT: [number, number, number] = [0, 0.32, 0.15]
const CAMERA_FOV = 34
const DESK_COLOR = '#17100b'
const DESK_SIZE: [number, number] = [9, 6]
// E-G5 floor (b) rebalance: removing the ACES tone-map lifted every rendered
// surface, but the desk is the one that must NOT — it is the dark theatre the
// candlelit book sits in (measured: the flat-fill desk luma more than doubled,
// ~10->28, washing the murk toward a lit floor). The book itself (unlit pop-up
// prints + lit cover/pages) KEEPS the lift — that is the fidelity fix. So the
// desk plane alone gets an albedo multiplier that pulls it back near its
// blessed darkness, its warm candle pool intact (the pool is still the brightest
// part of the desk, just no longer washing the frame). sRGB-encoded: #a9a9a9
// ~= a 0.42x linear albedo scale (tuned against the s0 desk probe vs blessed).
const DESK_ALBEDO = '#a9a9a9'
const CANDLE_POSITION: [number, number, number] = [1.6, 1.1, 1.4]
const CANDLE_COLOR = '#ff9f4d'
// Lowered from the original 2.2/6 pairing (task-9 concern: candle falloff
// over a flat page washed the paper texture to near-white). A shorter
// `distance` cutoff also gives the desk plane a visible light-pool falloff
// instead of an even wash clear out to its edges.
const CANDLE_BASE_INTENSITY = 1.3
const CANDLE_DISTANCE = 3.6
// Doubled 2026-07-11 (user: "more depth... maybe by allowing tilting it
// more") — the pointer now swings the desk noticeably, letting the standing
// paper parallax against the page prints. Still well inside the frustum
// margin verified for ~1.05-tall pieces.
const PARALLAX_TILT_X = 0.07
const PARALLAX_TILT_Y = 0.11
const PARALLAX_EASE_RATE = 4
// DRAG-TO-TILT v1 REVERTED (2026-07-11): a canvas-wide left-drag tilt
// collided with the existing swipe-to-turn gesture (use-book-input.ts:
// 60px within 600ms turns the page) — the user vetoed it on first touch.
// The deep-tilt gesture returns once its input is disambiguated (hold-
// then-drag, right-button drag, or another pick of his).
// COVER-DIP FIX (2026-07-14, user: "the book cover shrinks from the
// bottom... like the cover disappears for 1/8th of its length" while
// tilting): ParallaxRig rotates the whole book about its own origin, which
// sits at the spine on the desk (y=0). At the open spread the front cover
// (rotation.z=PI) and the fixed back cover together span the book's full
// horizontal footprint symmetrically about that origin — from -BOOK.coverW
// to +BOOK.coverW (book.tsx: the open front cover's board spans local x in
// [-coverW, 0], the back cover [0, coverW]) — and BOOK.coverH is the
// deepest z-extent of either (it overhangs the page block). That's the
// largest slab in the assembly, so it's the footprint parallaxLift guards:
// half-extents (coverW, coverH/2) centered on the rotation origin.
const COVER_FOOTPRINT_HALF_W = BOOK.coverW
const COVER_FOOTPRINT_HALF_D = BOOK.coverH / 2

/** Desk surface: a baked warm light-pool texture (see makeDeskCanvas) rather
 * than a flat fill, so the near-black desk reads as a lit surface the tome
 * sits on instead of blending into the background void. */
function Desk() {
  const deskCanvas = useMemo(() => makeDeskCanvas(), [])
  const deskTexture = useMemo(() => makeCanvasTexture(deskCanvas), [deskCanvas])

  useEffect(() => () => deskTexture.dispose(), [deskTexture])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
      <planeGeometry args={DESK_SIZE} />
      <meshStandardMaterial map={deskTexture} color={DESK_ALBEDO} roughness={0.95} />
    </mesh>
  )
}

/** Warm point light standing in for a candle, flickering via two summed sine waves. */
function CandleLight() {
  const ref = useRef<THREE.PointLight>(null)

  useFrame((state) => {
    const light = ref.current
    if (!light) return
    const t = state.clock.elapsedTime
    light.intensity = CANDLE_BASE_INTENSITY + 0.25 * Math.sin(t * 9.3) + 0.15 * Math.sin(t * 23.7)
  })

  return (
    <pointLight
      ref={ref}
      position={CANDLE_POSITION}
      color={CANDLE_COLOR}
      intensity={CANDLE_BASE_INTENSITY}
      distance={CANDLE_DISTANCE}
    />
  )
}

/** Eases the wrapped group's tilt toward the pointer position, giving the desk a parallax feel.
 *  Law H5: while a handle grab is active, the ease target holds at the group's CURRENT rotation
 *  instead of the pointer — a freeze, not a snap, so the rig simply stops chasing the pointer
 *  rather than jumping anywhere. A wobbling stage under the finger would corrupt the H3/H4
 *  handle-plane projections and read as the book squirming away mid-grab.
 *
 *  COVER-DIP FIX: after easing, `parallaxLift` reads the group's just-updated
 *  rotation (whatever it is — chasing the pointer, or frozen under a grab)
 *  and lifts the whole rig by exactly enough that the cover footprint clears
 *  the desk plane. Deriving the lift from the CURRENT rotation rather than
 *  the pointer directly means it composes with the H5 freeze for free: a
 *  frozen rotation keeps producing the same lift, so there's nothing to jump
 *  when a grab starts or ends. */
function ParallaxRig({ children }: { children: ReactNode }) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return
    const grabbed = useStorybookStore.getState().grab !== null
    const ease = Math.min(1, delta * PARALLAX_EASE_RATE)
    const targetX = grabbed ? group.rotation.x : -state.pointer.y * PARALLAX_TILT_X
    const targetY = grabbed ? group.rotation.y : state.pointer.x * PARALLAX_TILT_Y
    group.rotation.x += (targetX - group.rotation.x) * ease
    group.rotation.y += (targetY - group.rotation.y) * ease
    group.position.y = parallaxLift(
      group.rotation.x,
      group.rotation.y,
      COVER_FOOTPRINT_HALF_W,
      COVER_FOOTPRINT_HALF_D
    )
  })

  return <group ref={groupRef}>{children}</group>
}

/** Cursor contract for law H2: while any grab is active the canvas shows 'grabbing'; it
 *  reverts to the default on release/unmount. Hover 'grab' cursors are per-handle and
 *  arrive with the handle wave — this only ever shows the active-grab state. */
function GrabCursor() {
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    const el = gl.domElement
    const applyCursor = (grab: ReturnType<typeof useStorybookStore.getState>['grab']) => {
      el.style.cursor = grab !== null ? 'grabbing' : ''
    }
    applyCursor(useStorybookStore.getState().grab)
    const unsubscribe = useStorybookStore.subscribe((state) => applyCursor(state.grab))
    return () => {
      unsubscribe()
      el.style.cursor = ''
    }
  }, [gl])

  return null
}

/** Default export for `next/dynamic` — renders the full Canvas; nothing outside this
 * directory may import three. */
export default function BookScene() {
  return (
    <Canvas
      dpr={[1, 2]}
      // E-G5 floor (b): r3f v9 defaults gl.toneMapping to ACESFilmic, which
      // film-compresses every unlit painted print — a flat aspect-true backdrop
      // measured a ~17% luminance + saturation loss before any other degrader.
      // The pieces are MeshBasicMaterial (their painting already carries its own
      // light), so a filmic response curve has nothing legitimate to do here; it
      // only pulls the art away from its source file. NoToneMapping renders the
      // paintings at true value. The candlelit MOOD is not carried by the tone
      // map — it lives in the lit desk/candle pool and the unlit contact
      // shadows, which are rebalanced (ambient/directional/candle) to hold the
      // dark-theatre look now that the film curve no longer dims the whole frame.
      gl={{ antialias: true, alpha: false, toneMapping: THREE.NoToneMapping }}
      camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
      onCreated={(state) => state.camera.lookAt(...CAMERA_LOOKAT)}
    >
      <color attach="background" args={[DESK_COLOR]} />
      {/* v2 pivot: the book reads like a bright printed object — childhood
          pop-up books live in daylight, not murk. The candle keeps its warm
          flicker as seasoning; the vignette/desk keep the dark theatre
          around the book. */}
      <ambientLight color="#fff3e0" intensity={0.85} />
      <directionalLight position={[2, 4, 2]} color="#fff6e4" intensity={0.95} />
      <CandleLight />
      <Desk />
      <Dust />
      <GrabCursor />
      <ParallaxRig>
        <Book />
      </ParallaxRig>
    </Canvas>
  )
}
