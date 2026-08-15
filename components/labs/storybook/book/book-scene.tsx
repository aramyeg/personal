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
import { activeGrabId } from '../user-drive'
import { CAMERA_FOV, CAMERA_LOOKAT, CAMERA_POSITION } from './reading-stage'
import { COMPACT_QUERY } from '../overlay/compact-layout'
import { primeHover } from './hover-prime'

// task-17: the book is the whole-screen hero now (side-column narration
// replaces the old on-page text plates), so the camera sits noticeably
// closer than the original framing — same elevation angle (the offset from
// lookAt is just scaled down ~0.73x), just tighter, so the open spread
// reads at roughly 55-65% of viewport width on a 16:9-ish desktop instead
// of ~44%. Standing pop-up layers (up to ~1.05 world units tall) still
// clear the frustum at rest and mid-turn — verified via screenshot, not
// just math.
// E1.5 PINNED COMPOSITION CAMERA (2026-07-17): lowered from the original
// ~40deg lid-dominant view to a ~27deg reading angle — vertical faces
// (facades, the surfaces that carry the scene) gain ~2x screen presence
// while the painted page still reads as ground/sky. Every art and scale
// decision from E1.5 on is composed for THIS frame; probed against all
// 10 spreads (standing scenes gain, flat-lay spreads stay legible)
// before pinning. Goldens re-blessed book-wide at this camera.
// The three numbers themselves now live in reading-stage.ts, so the layers'
// screen-space hit floor and the unit gates (s2-keyboard among them) measure
// "screen px" against the SAME eye this Canvas mounts (E3 R-3 + wave-2 s2:
// an art gate that hard-codes a stale camera is the "eyeballed QA box"
// failure with extra steps).
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
// E3 BW-17 TRIM (2026-07-26): a blind reader measured an 8px pointer move
// repainting 2.9% of the frame — "reaching for a 40px prop swings the world
// out from under the cursor". The gain is book-wide (there is no per-spread
// camera config), and four of five readers called the parallax the best thing
// on the page, so this is a ~22% trim, not a redesign: the swing still reads,
// it just stops out-running the hand.
const PARALLAX_TILT_X = 0.055
const PARALLAX_TILT_Y = 0.085
// Raised 4 -> 7 (time constant 250ms -> 143ms, settled inside ~0.5s). The old
// rate left the diorama drifting for well over a second after the pointer
// stopped, which is the window BW-10 lived in.
const PARALLAX_EASE_RATE = 7
// Below this per-frame rotation step the rig counts as parked and stops
// re-stitching hover state (see ParallaxRig). One thousandth of a degree.
const PARALLAX_PARKED_EPS = 1.7e-5
/** How long (s) to keep re-deriving hover after a grab ends — long enough to
 *  cover a latched piece settling into its new pose. */
const RESTITCH_TAIL_S = 0.7
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
  const settleRef = useRef(0)
  const eventsUpdate = useThree((s) => s.events.update)

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return
    const grabbed = useStorybookStore.getState().grab !== null
    const ease = Math.min(1, delta * PARALLAX_EASE_RATE)
    const targetX = grabbed ? group.rotation.x : -state.pointer.y * PARALLAX_TILT_X
    const targetY = grabbed ? group.rotation.y : state.pointer.x * PARALLAX_TILT_Y
    const stepX = (targetX - group.rotation.x) * ease
    const stepY = (targetY - group.rotation.y) * ease
    group.rotation.x += stepX
    group.rotation.y += stepY
    group.position.y = parallaxLift(
      group.rotation.x,
      group.rotation.y,
      COVER_FOOTPRINT_HALF_W,
      COVER_FOOTPRINT_HALF_D
    )
    // HOVER TRUTH (E3 BW-10/BW-11, the top input bug of the blind sweep).
    // r3f re-raycasts only when a pointer EVENT arrives. This rig keeps moving
    // the whole book for a beat AFTER the pointer stops, and no event ever
    // comes to correct what the reader is told: measured on the live page, a
    // settled `grab` cursor sat over bare paper while the live handle 40px
    // away gave no cursor at all — and a press, which DOES raycast the current
    // pose, then disagreed with the cursor in both directions. Re-running the
    // last pointer move on any frame the rig actually turned keeps hover state
    // pinned to the geometry the reader can see, so "the cursor says grab" and
    // "a press engages" become one statement again.
    // The same argument applies whenever the PAPER moves rather than the rig: a
    // grabbed piece travels under a pointer that may be perfectly still, and a
    // latched piece comes to rest somewhere new (s4 reader: the cable-carrier
    // handle "RELOCATES after travel with no cue"). So restitch while a grab is
    // live and for a beat after it ends, which is exactly when a handle's hit
    // surface and its hover glow have moved out from under the reader.
    // The same argument covers the book being BUSY (R-2). A layer refuses to
    // write `hover` while the book is booting, mid page-turn, or holding another
    // grab — and r3f announces an object as hovered exactly ONCE, on entry, so a
    // refusal is permanent for a pointer that does not move: measured on the
    // lane server, a pointer parked through the boot read `hover: null` for six
    // seconds on a live handle, which is precisely the reader's "the cursor lies
    // whenever I pause". Replaying the last move through the busy window and for
    // a beat after gives the layers the chance to answer once the answer can
    // change (see handle-hover.ts's markHandleHovered).
    const store = useStorybookStore.getState()
    const busy = !store.booted || store.turning !== null
    const grabLive = grabbed || activeGrabId() !== null
    if (grabLive || busy) settleRef.current = RESTITCH_TAIL_S
    else if (settleRef.current > 0) settleRef.current = Math.max(0, settleRef.current - delta)
    if (
      grabLive ||
      busy ||
      settleRef.current > 0 ||
      Math.abs(stepX) > PARALLAX_PARKED_EPS ||
      Math.abs(stepY) > PARALLAX_PARKED_EPS
    ) {
      eventsUpdate?.()
    }
  })

  return <group ref={groupRef}>{children}</group>
}

/**
 * THE ONE CURSOR OWNER (E3, s4 reader: "the canvas is cursor:none with the quill
 * sprite, but handle meshes set inline cursor:grab — readers get the native hand
 * AND the gold quill simultaneously"). Every handle layer used to write
 * `gl.domElement.style.cursor` itself, which produced two cursors wherever the
 * quill is drawn and a sticky one wherever an `onPointerOut` was missed.
 *
 * Now the store's `hover`/`grab` are the single source of truth and this is the
 * only writer. It shows a native hand ONLY where the quill sprite is not drawn —
 * the quill is fine-pointer, non-compact (see storybook-responsive.css, which
 * also owns the `cursor: none` that hides the native one) — so the two can never
 * appear together, and a coarse or compact reader still gets a real hint.
 *
 * THE TWO-CURSOR BUG, PART 2 (E3 R-2, caught by the s6 blind RE-review: "you get
 * the gold sparkle AND a system hand fighting each other" — on the very build
 * that claimed the fix). The scope above was hand-rolled as
 *   `(pointer: fine) and not (max-width: 820px) and not (orientation: portrait)`
 * and `not` is only legal at the START of a media query — Chrome parses that
 * whole string as INVALID and reports it back as `not all`, which matches
 * nothing, ever. So `quill.matches` was permanently false and this component
 * wrote a native `grab`/`grabbing` under the quill on every desktop. Measured on
 * the lane server: `matchMedia(QUILL_QUERY).media === 'not all'`.
 *
 * The fix is not a better hand-rolled negation — it is to stop hand-rolling one.
 * The quill's own conditions are `(pointer: fine)` AND not `COMPACT_QUERY`
 * (quill-cursor.tsx watches exactly those two), so this reads the SAME two
 * queries and negates the compact one in JS, where negation is unambiguous and
 * cannot drift from the breakpoint the CSS uses.
 */
const FINE_POINTER_QUERY = '(pointer: fine)'

/**
 * HOVER TRUTH FOR A HAND THAT NEVER MOVES (E3 R-2). ParallaxRig can only replay
 * an event r3f has already seen; a reader who parked their pointer while the
 * book was booting, or who turned the page from the keyboard without lifting
 * their hand, has never given it one. This re-delivers the last position the
 * WINDOW saw (book/hover-prime.ts, installed by the loader) to the canvas the
 * moment the book becomes able to answer differently — boot finishing, a turn
 * landing, a spread committing — so the cursor and the piece's glow describe
 * where the hand actually is instead of where it last happened to arrive.
 */
function HoverPrime() {
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    const el = gl.domElement
    let raf = 0
    const prime = () => {
      cancelAnimationFrame(raf)
      // One frame later: the piece the reader is over has to have been posed by
      // the frame loop before a hit test can tell the truth about it.
      raf = requestAnimationFrame(() => primeHover(el))
    }
    prime()
    const unsubscribe = useStorybookStore.subscribe((s, prev) => {
      if (s.booted !== prev.booted || s.turning !== prev.turning || s.spread !== prev.spread) prime()
    })
    return () => {
      cancelAnimationFrame(raf)
      unsubscribe()
    }
  }, [gl])

  return null
}

function CanvasCursor() {
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    const el = gl.domElement
    const fine = window.matchMedia(FINE_POINTER_QUERY)
    const compact = window.matchMedia(COMPACT_QUERY)
    const apply = () => {
      const { grab, hover } = useStorybookStore.getState()
      // Where the quill sprite is drawn, the native cursor stays hidden and the
      // quill alone carries the state (quill-cursor.tsx reads the same store).
      if (fine.matches && !compact.matches) {
        el.style.cursor = ''
        return
      }
      el.style.cursor = grab !== null ? 'grabbing' : hover !== null ? 'grab' : ''
    }
    apply()
    const unsubscribe = useStorybookStore.subscribe(apply)
    fine.addEventListener('change', apply)
    compact.addEventListener('change', apply)
    return () => {
      unsubscribe()
      fine.removeEventListener('change', apply)
      compact.removeEventListener('change', apply)
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
      camera={{ position: [...CAMERA_POSITION], fov: CAMERA_FOV }}
      onCreated={(state) => {
        state.camera.lookAt(...CAMERA_LOOKAT)
        // E5 perf. three checks every program's link result on its FIRST USE
        // (WebGLProgram's deferred `onFirstUse`), and that check costs three
        // synchronous `getShaderInfoLog`/`getProgramInfoLog` round trips to
        // the GPU process per program — the single largest line in the turn
        // profile (2256ms on the cover-open turn at 4x throttle). The shaders
        // here are three's own, from a build that already compiled; there is
        // no author to report a shader error TO in production. Dev keeps the
        // check, so a broken material still shouts during development.
        // book/warm-programs.ts handles the other half: absorbing the link
        // WAIT at an idle moment instead of on the first frame of a turn.
        if (process.env.NODE_ENV === 'production') state.gl.debug.checkShaderErrors = false
      }}
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
      <CanvasCursor />
      <HoverPrime />
      <ParallaxRig>
        <Book />
      </ParallaxRig>
    </Canvas>
  )
}
