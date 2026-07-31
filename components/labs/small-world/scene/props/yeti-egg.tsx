'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CHAPTER_COUNT } from '../../chapters'
import { PANEL_END } from '../../journey-timeline'
import { PALETTE } from '../../palette'
import { anchorTransform } from '../stage'
import { activeVariantAt, canonicalTheta } from '../renewal'
import { useClayRamp } from '../toon-ramp'
import { buildMergedClay, type ClayPart } from './clay-kit'
import type { JourneyRef } from '../use-journey'

/**
 * Task 61 — THE YETI EASTER EGG.
 *
 * The yeti lost its corner in this round's recast (a polar bear and a penguin took the winter
 * checkpoint), and Aram did not want it retired: *"The yeti can have an easter egg appearance from
 * the snowy trees, if we click on it it will peak out sort of."* So it moved out of the sky and
 * onto the PLANET, hiding among the snow conifers on the winter wedge's right-hand flank — the
 * stand of trees `winter.tsx` calls "the beloved right-side conifer forest".
 *
 * It is the first CLICK interaction in this lab, and everything below is shaped by that being an
 * easter egg rather than navigation. The honest consequences are written out in `A11Y` at the
 * bottom of this file; read that before treating this as a pattern to copy.
 *
 * THREE RULES IT LIVES UNDER, in the order they constrain the code:
 *
 *  1. SUBTLE AT REST. Mostly buried behind the conifers, with about a third of a shoulder, one ear
 *     and the glint of an eye clear of the trunks. It has to be findable, never advertised, and —
 *     the harder half — it must not read as CLUTTER: a small pale blob among snowy trees is
 *     indistinguishable from a drift unless it has an eye, so the eye is what does the work.
 *  2. THE HOTSPOT IS ARMED ONLY WHEN THE THING IS ON FRAME. The planet spins; for most of the
 *     journey this patch of ground is behind the horizon or on a wedge that is not even painted as
 *     winter. A click target left live there is an invisible trap in the middle of the page, so the
 *     gate is checked in the handler itself rather than trusted to the renderer (see `armed`).
 *  3. DETERMINISM SURVIVES. The lab's standing rule is that the scene is a pure function of scroll
 *     position. The peek is the one sanctioned exception — it is USER-INITIATED, the same exception
 *     class as Task 54's arrival reveal — so it gets a local one-shot clock and nothing else in the
 *     file reads a clock at all. It never fires by itself, and scrolling away cancels it outright.
 */

// --- where it hides ---------------------------------------------------------

/**
 * Band-2 longitude and lateral offset, on the winter wedge's right-hand flank.
 *
 * THREE CONSTRAINTS, all measured, and the first two versions each violated one of them.
 *
 *  1. IN THE TREES. `Forest`'s SNOW_CAP scatters the winter conifers about
 *     [0.5, cos 5.55, sin 5.55]·0.866 with an angular radius of 0.55 and a 0.16 feather. This sits
 *     0.559 rad off that centre — at the edge of the instanced scatter, with trees immediately
 *     inboard of it, which is what a creature hiding at the wood's margin should have.
 *
 *  2. ON THE VISIBLE FACE. A first anchor chosen purely to sit between two named `WinterLife`
 *     conifers (5.66, +0.62) put the yeti on the FAR hemisphere at the parked dwell: a perfectly
 *     reasonable screen position, 864 x 240, at 12.67 units from a camera whose planet centre is
 *     12.1 — i.e. behind the horizon. On a spinning planet "in the forest" and "on the visible
 *     face" are different questions, and only the second one can be answered by looking at where
 *     the camera is. This sits at camera distance 11.86, in front of the centre plane.
 *
 *  3. NOT IN THE LAKE, which is the one this file would have shipped wrong. The winter wedge's
 *     only water is the icy lake — `B2_FROZEN` (r 0.14 + 0.10 feather) and `B2_SHELF` (r 0.28 +
 *     0.13) in `biomes.ts` — and it is sacred. The INSTANCED scatter rejects underwater candidates
 *     for itself, so "there are trees near here" is NOT evidence that a hand-placed prop is on dry
 *     land; a hand-placed one has no such check and will happily stand in the pond. The previous
 *     anchor (6.15, +1.0) measured 0.4016 rad from B2_SHELF's centre against a 0.410 limit — eight
 *     thousandths INSIDE the water, invisible to every test in this repo and caught only because
 *     the lane that owns the terrain said to check. This one clears the shelf by 0.051 and the
 *     frozen pond by 0.321.
 */
export const EGG_THETA = 6.15
export const EGG_X = 0.8

/**
 * How much of the winter wedge counts as "on frame".
 *
 * The variant gate alone is not enough. `activeVariantAt` says whether this longitude is currently
 * painted as winter, which is true for a long stretch of the journey including while the patch is
 * round the back of the planet — so on its own it would arm a click target the visitor cannot see.
 * This is the second half: the journey's own progress has to be inside winter's approach and dwell.
 * Chapter 5 owns progress [5/6, 1], and the approach begins a little before that.
 *
 * EXPORTED since Task 63's fix round: it is now the WHOLE of the visibility gate's progress half
 * (the upper bound governs the click only), so the test that pins the yeti as drawn through the
 * ending has to read this number rather than restate it.
 */
export const EGG_FROM = 4.72 / 6
/**
 * ...and the CLICK stops when the last checkpoint releases — the exact progress at which chapter
 * 6's dwell ends and the ending segment takes the frame. Note what this bound no longer does: it
 * does not hide the yeti. Arming and visibility were one boolean until Task 63's fix round; the
 * frame loop below now splits them, and this constant governs only the click.
 *
 * RE-DERIVED for Task 63, because the thing it used to be a relation to is gone. It was 0.98,
 * chosen to close just under `END_AT` = 0.985, where the retired `EndPanel` raised a full-viewport
 * `pointer-events: auto` scrim a click could not reach the canvas through. There is no scrim now:
 * the ending is scroll real estate past progress 1, and the overlay slot that marks it takes no
 * pointer events at all. The invariant survives its old justification intact, though — the hotspot
 * may only be armed where a click will actually reach it AND where the egg is actually on frame —
 * so it is re-anchored to the geometry that still exists: it closes strictly BEFORE the ending
 * (which begins at progress 1), so the curtain call and the pull-back never have a live click
 * target from the journey underneath them. Past that the clamp enforces it a second time for free:
 * `JourneyState.progress` reads exactly 1 for the whole ending, which is greater than this value,
 * so the arming gate below cannot re-open however far the visitor scrolls.
 *
 * WHAT MOVING IT FROM 0.98 ACTUALLY DID, corrected from the claim this comment first carried. The
 * first version said the widening "cannot change a pixel" because rotation is frozen across the
 * dwell — true about rotation, and irrelevant, because visibility was gated on this same bound.
 * Under 0.98 the yeti VANISHED at 0.98 and the widening draws it through the dwell tail where it
 * previously was not drawn. That was a real pixel change, mis-certified as none.
 *
 * Still a RELATION rather than a literal, for the reason Task 62 made it one: a frozen copy goes
 * stale the moment the thing it mirrors moves. `yeti-egg.test.ts` pins both halves.
 */
export const EGG_TO = (CHAPTER_COUNT - 1 + PANEL_END) / CHAPTER_COUNT

// --- the peek ---------------------------------------------------------------

/** Seconds of the one-shot: lean out, hold with a wave, settle back. */
const PEEK_SECONDS = 2.6
/** The three beats as fractions of that, so retiming the whole gesture is one number. */
const LEAN_END = 0.22
const HOLD_END = 0.74
/** How far it leans out of cover (rad about the trunk-side pivot) and rises. */
const LEAN_ANGLE = 0.72
const LEAN_RISE = 0.055
/** Waves per hold. */
const WAVE_CYCLES = 2.5

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t)
const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t))

/**
 * The peek pose at one point of the one-shot: how far out of cover, and where the arm is.
 *
 * Split out from the frame loop so it is a pure function of `t` and can be reasoned about (and
 * tested) without a renderer. `t` outside [0, 1] returns the RESTING pose, which is what makes
 * cancellation trivial — there is no unwinding to do, the figure simply stops being driven.
 */
export function peekPose(t: number): { lean: number; rise: number; wave: number } {
  if (!(t > 0) || t >= 1) return { lean: 0, rise: 0, wave: 0 }
  if (t < LEAN_END) {
    const f = easeOut(t / LEAN_END)
    return { lean: f, rise: f, wave: 0 }
  }
  if (t < HOLD_END) {
    const f = (t - LEAN_END) / (HOLD_END - LEAN_END)
    return { lean: 1, rise: 1, wave: Math.sin(f * Math.PI * 2 * WAVE_CYCLES) * Math.sin(f * Math.PI) }
  }
  // settle back, easing rather than snapping — the retreat is half the joke
  const f = easeInOut((t - HOLD_END) / (1 - HOLD_END))
  return { lean: 1 - f, rise: 1 - f, wave: 0 }
}

// --- the art ----------------------------------------------------------------

/**
 * The yeti itself, at planet scale.
 *
 * This is a DELIBERATELY SMALLER DRAWING than the corner mascot was. The peeker yetis were ~270px
 * tall and could carry a plush muzzle, a tongue, seven rings of shag and a chest bib; this one is a
 * fraction of a conifer that is itself 0.5 world units, so at reading size it is perhaps thirty
 * pixels. Everything that does not survive that has been cut, and what is left is the four things
 * that still say "yeti" at thirty pixels: a pale shaggy mass, a FACE RUFF around a bare face, two
 * big amber eyes, and ink brows over them.
 *
 * It keeps the retired mascot's palette exactly — `yetiCoat` over `yetiCoatDeep` with `yetiFur` and
 * `yetiMuzzle` as the accents. That family was derived for a figure seen against a lilac sky, and
 * against snow and dark spruce it holds for a different reason: the coat sits below the snow's
 * value and well above the spruce's, so the animal separates from BOTH things it is hiding among.
 */
function yetiParts(): ClayPart[] {
  const sph = (r: number, color: string, pos: [number, number, number], scl?: [number, number, number], seg = 10): ClayPart => ({
    geo: new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)),
    color,
    pos,
    scl,
  })
  return [
    // shoulders and chest, the mass the trunks cover most of
    sph(0.085, PALETTE.yetiCoat, [0, 0.05, 0], [1.35, 0.9, 1.0], 12),
    sph(0.07, PALETTE.yetiCoatDeep, [-0.035, -0.02, 0.01], [1.2, 0.85, 0.9], 10),
    // the lit band across the top of the shoulders — the same device the corner figure used, and
    // still the one thing that stops a pale mass reading as a drift
    sph(0.08, PALETTE.yetiFur, [0.005, 0.1, 0.02], [1.15, 0.28, 0.6], 10),
    // head
    sph(0.062, PALETTE.yetiCoat, [0.02, 0.175, 0.01], [1.0, 1.0, 0.95], 12),
    // THE FACE RUFF — the single cue that buys the species. A bare face inside a collar of fur is
    // what every drawn yeti has and no bear has, and it is legible at a size where nothing else is.
    ...[0.55, 0.78, 1.02, 1.26, 1.5, 1.74].map((a) =>
      sph(0.026, PALETTE.yetiCoat, [
        0.02 + Math.cos(a * Math.PI) * 0.062,
        0.175 + Math.sin(a * Math.PI) * 0.062,
        0.0,
      ], [1, 0.7, 0.6], 8)
    ),
    // the bare face inside it
    sph(0.04, PALETTE.yetiMuzzle, [0.03, 0.168, 0.05], [1.05, 0.9, 0.7], 10),
    // EYES. Amber, and oversized for the head on purpose: at this size an eye drawn to scale is one
    // pixel, and the eye is the whole difference between "a yeti hiding" and "a lump of snow".
    sph(0.017, PALETTE.honey, [0.012, 0.195, 0.078], [1, 1, 0.6], 8),
    sph(0.017, PALETTE.honey, [0.052, 0.19, 0.076], [1, 1, 0.6], 8),
    sph(0.009, PALETTE.ink, [0.014, 0.193, 0.088], undefined, 6),
    sph(0.009, PALETTE.ink, [0.054, 0.188, 0.086], undefined, 6),
    // ink brows, the second-strongest small-scale cue after the eyes
    sph(0.02, PALETTE.ink, [0.012, 0.216, 0.078], [1, 0.28, 0.5], 6),
    sph(0.02, PALETTE.ink, [0.053, 0.211, 0.076], [1, 0.28, 0.5], 6),
    // a small dark nose and a smile, both barely legible and both cheap
    sph(0.008, PALETTE.ink, [0.033, 0.166, 0.09], undefined, 6),
    sph(0.017, PALETTE.ink, [0.033, 0.146, 0.082], [1.3, 0.4, 0.4], 6),
  ]
}

/** The waving arm, authored about the shoulder so the wave is a roll at the joint. */
function armParts(): ClayPart[] {
  const sph = (r: number, color: string, pos: [number, number, number], scl?: [number, number, number]): ClayPart => ({
    geo: new THREE.SphereGeometry(r, 10, 8),
    color,
    pos,
    scl,
  })
  return [
    sph(0.032, PALETTE.yetiCoat, [0, 0, 0], [1.0, 1.0, 0.9]),
    sph(0.028, PALETTE.yetiCoat, [0.012, 0.055, 0.005], [0.85, 1.5, 0.85]),
    sph(0.03, PALETTE.yetiMuzzle, [0.022, 0.105, 0.015], [1.0, 0.9, 0.7]),
  ]
}

// --- the prop ---------------------------------------------------------------

/**
 * A11Y, stated honestly rather than claimed.
 *
 * This egg is NOT keyboard reachable, and that is a deliberate choice rather than an oversight.
 * The whole 3D canvas is `aria-hidden` (see `scene.tsx`) and the lab already ships a complete
 * non-canvas alternative: a visitor who prefers reduced motion gets a static timeline instead of
 * the experience entirely, and the journey's actual content — every chapter's copy — lives in the
 * DOM comic cards, not here. Adding a focusable control inside a decorative, aria-hidden canvas
 * would put a tab stop with no accessible name into the middle of a page whose real content is
 * elsewhere, which is worse for a screen-reader user than the egg simply not existing for them.
 *
 * What IS honoured:
 *  - REDUCED MOTION: the peek still works, but it snaps to the peeked pose and holds it rather
 *    than animating, then snaps back. The reward is the same; the movement is not.
 *  - The pointer affordance is real — `cursor: pointer` on hover, and only while the hotspot is
 *    genuinely armed, so the cursor never promises something that will not respond.
 *
 * If this ever stops being an easter egg and becomes something a visitor is expected to find, the
 * right fix is a DOM control outside the canvas that drives the same one-shot — not a tab stop
 * inside it.
 */
export function YetiEgg({ journeyRef }: { journeyRef: JourneyRef }) {
  const ramp = useClayRamp()
  const outer = useRef<THREE.Group>(null)
  const lean = useRef<THREE.Group>(null)
  const arm = useRef<THREE.Group>(null)
  /** The one-shot's own clock: seconds since the click, or null when it is not running. */
  const clock = useRef<number | null>(null)
  /** Whether the hotspot is live THIS frame. Read by the pointer handlers, written by the loop. */
  const armed = useRef(false)
  /** Whether THIS component currently owns the document cursor, so it only ever clears its own. */
  const owned = useRef(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  /**
   * RAYCAST GATING (Task 61 rail 2d). Now that the canvas takes pointer events, r3f raycasts its
   * interaction list on pointer moves and clicks — and this egg is the only member of that list. A
   * custom `raycast` that early-returns while the hotspot is disarmed means that outside winter's
   * on-frame window the list is walked but no geometry is ever tested, so the per-event cost is a
   * function call and nothing else. No state, no re-render: `armed` is a ref the frame loop already
   * maintains.
   *
   * It also HARDENS the gate rather than merely speeding it up. The handlers still re-check `armed`
   * (belt and braces, and the thing a reader should not have to infer), but with this in place an
   * off-window pointer never reaches them at all.
   */
  const gatedRaycast = useMemo(
    () =>
      function (this: THREE.Mesh, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
        if (!armed.current) return
        THREE.Mesh.prototype.raycast.call(this, raycaster, intersects)
      },
    []
  )

  const tc = useMemo(() => canonicalTheta(EGG_THETA), [])
  const { position, quaternion } = useMemo(() => anchorTransform(EGG_THETA, EGG_X, 1), [])
  const body = useMemo(() => buildMergedClay(yetiParts()), [])
  const limb = useMemo(() => buildMergedClay(armParts()), [])
  useEffect(() => () => {
    body.dispose()
    limb.dispose()
  }, [body, limb])

  /**
   * The cursor is owned here rather than by a CSS rule, because the target is a mesh inside a canvas
   * and there is no element to style.
   *
   * Set IMPERATIVELY on the pointer event rather than through React state and an effect. The state
   * version needed a commit before the cursor changed, so a pointer that moved and was sampled in
   * the same tick still saw the old value — which is exactly how the locating sweep in
   * `bench/task61-egg.mjs` came back with zero hits on a hotspot that was working. A cursor should
   * change on the event, not a render later.
   */
  const setCursor = (on: boolean): void => {
    if (on === owned.current) return
    owned.current = on
    document.body.style.cursor = on ? 'pointer' : ''
  }
  // ...and it must never outlive the component, or a stranded pointer cursor sits over dead canvas
  useEffect(() => () => {
    if (owned.current) document.body.style.cursor = ''
  }, [])

  useFrame((_, delta) => {
    const g = outer.current
    if (!g) return
    const j = journeyRef.current

    // VISIBILITY AND ARMING ARE SEPARATE GATES (Task 63 fix round). They were one boolean, and
    // that made the click's upper bound double as a vanishing act: the yeti blinked out of
    // existence at `EGG_TO` in a frame where rotation is frozen and nothing else moves at all —
    // the single most conspicuous place in the whole lab to pop something.
    //
    // VISIBLE has no upper bound. Both gates below still apply — the variant gate says this ground
    // is currently painted winter, the progress gate says the visitor is actually looking at it —
    // and past the journey the clamp holds `j.progress` at exactly 1, so the yeti simply stays
    // drawn in the frozen frame and recedes with the world through the pull-back, as part of the
    // diorama rather than as a thing that left before the ending started.
    const visible = activeVariantAt(tc, j.rotation) === 1 && j.progress >= EGG_FROM
    // ARMED adds the click's own bound. `gatedRaycast` early-returns while this is false, so a
    // drawn-but-disarmed yeti contributes no intersection and a click through it still reaches
    // `onPointerMissed` — being visible costs the canvas-first model nothing.
    const nowArmed = visible && j.progress <= EGG_TO
    g.visible = visible

    if (armed.current !== nowArmed) {
      armed.current = nowArmed
      // A cursor that promises a click the mesh no longer takes is a lie, so it goes with the arming.
      if (!nowArmed) setCursor(false)
    }

    if (!visible) {
      // SCROLL-AWAY, and this is the whole cancellation story: drop the clock and put the figure
      // back on its resting pose in the same frame. There is no unwind to run and no pose to
      // interpolate out of, so a peek interrupted at any point cannot leave a stuck figure behind.
      //
      // Keyed to VISIBILITY rather than to arming, deliberately. Snapping a peek back the instant
      // the click closes would reintroduce the pop this split exists to remove; a one-shot already
      // in flight instead plays out and ends on its own resting pose, exactly as chapter 6's card
      // spread finishes its retraction across the same boundary. Neither can START past it.
      if (clock.current !== null) {
        clock.current = null
        applyPose(lean.current, arm.current, 0)
      }
      return
    }

    if (clock.current === null) return
    // Reduced motion holds the peeked pose for the same duration instead of animating through it,
    // so the egg still rewards the click and still ends where it started.
    clock.current += delta
    const t = clock.current / PEEK_SECONDS
    if (t >= 1) {
      clock.current = null
      applyPose(lean.current, arm.current, 0)
      return
    }
    applyPose(lean.current, arm.current, reduced ? 1 : t, reduced)
  })

  return (
    <group ref={outer} position={position} quaternion={quaternion} visible={false}>
      <group ref={lean}>
        <mesh
          geometry={body}
          raycast={gatedRaycast}
          onPointerOver={(e) => {
            if (!armed.current) return
            e.stopPropagation()
            setCursor(true)
          }}
          onPointerOut={() => setCursor(false)}
          onClick={(e) => {
            // The gate is re-checked HERE rather than relying on the renderer skipping an invisible
            // mesh: r3f's event layer walks its own interaction list, so "not drawn" is not by
            // itself "not clickable", and an invisible click trap in the middle of a scrolling page
            // is exactly the failure this egg must not introduce.
            if (!armed.current) return
            e.stopPropagation()
            // Re-clicking mid-peek restarts it rather than queueing or ignoring — the same
            // preemption rule the arrival reveal follows, and the one a visitor expects from a toy.
            clock.current = 0
          }}
        >
          <meshToonMaterial vertexColors gradientMap={ramp} />
        </mesh>
        <group ref={arm} position={[0.075, 0.075, 0.02]}>
          <mesh geometry={limb}>
            <meshToonMaterial vertexColors gradientMap={ramp} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

/** Drive the two moving groups from the one-shot's `t`. Split out so the loop stays readable. */
function applyPose(
  lean: THREE.Group | null,
  arm: THREE.Group | null,
  t: number,
  snap = false
): void {
  const pose = snap ? { lean: 1, rise: 1, wave: 0 } : peekPose(t)
  if (lean) {
    // Leaning about Z tips the figure OUT from behind its trunk; the rise lifts it as it comes,
    // which is what makes the move read as stepping out rather than toppling over.
    lean.rotation.z = -LEAN_ANGLE * pose.lean
    lean.position.y = LEAN_RISE * pose.rise
    lean.position.x = 0.045 * pose.lean
  }
  if (arm) {
    // The arm only leaves its side once the figure is out — a wave that starts behind a tree is a
    // wave nobody sees.
    arm.rotation.z = -1.15 * pose.lean + 0.42 * pose.wave
  }
}
