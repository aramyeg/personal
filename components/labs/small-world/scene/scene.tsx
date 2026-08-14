'use client'
import { Suspense, useCallback, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { hasArt } from '../art-manifest'
import { BiomeAtmosphere } from './biome-atmosphere'
import { ENDING_DPR_FLOOR, endingDprFor } from './ending-dpr'
import { LOOK } from './look-table'
import {
  CAMERA_FOV,
  CAMERA_POSITION,
  CAMERA_RIG_PRIORITY,
  cameraPositionIntoFor,
  cameraTargetIntoFor,
} from './camera'
import {
  PARALLAX_LAMBDA,
  dampAngle,
  driftAnglesInto,
  orbitEyeInto,
  parallaxGainFor,
  pointerAnglesInto,
} from './camera-parallax'
import { usePointerParallax } from './use-pointer-parallax'
import { writeNoteParallaxShift } from './note-parallax-shift'
import { Planet } from './planet'
import { Girl } from './girl'
import { GirlProxy } from './girl-proxy'
import { DiscoveryBurst } from './discovery-burst'
import { useDampedJourney, type JourneyRef } from './use-journey'
import { ToonRampProvider } from './toon-ramp'
import { ChapterSet } from './props/chapter-set'
import { GlobalDressing, GlobalDressingAutumn } from './props/global-dressing'
import { Forest } from './props/forest'
import { Jungle } from './props/jungle'
import { DeltaLife } from './props/delta'
import { Bridges } from './props/bridges'
import { Delights } from './props/delights'
import { BluenetSet } from './props/set-bluenet'
import { FlyerbeeSet } from './props/set-flyerbee'
import { Dialog360Set } from './props/set-360dialog'
import { AccentureSet, DesertLife } from './props/set-accenture'
import { AknaSet } from './props/set-akna'
import { CanyonGeysers } from './props/canyon'
import { ApproachDressing } from './props/approach-dressing'
import { WinterLife } from './props/winter'
import { YetiEgg } from './props/yeti-egg'
import { EpilogueSet } from './props/epilogue'
import { DeskSet } from './props/desk-set'
import { GlobeStand } from './props/globe-stand'
import { NeonSign } from './props/neon-sign'
import { XdatagroupSet } from './props/set-xdatagroup'
import { CheckpointPeekers } from './props/peekers'
import { LoadSignal } from '../loader/load-signal'
import { ScenePrecompile } from './precompile'
import { firePanelAdvance } from '../panel-tap'
import type { ArrivalJourney } from '../use-arrival-journey'

export type SceneProps = {
  progressRef: MutableRefObject<number>
  /** Supplies the arrival reveal clock; absent → the scene runs scroll-pure (Task 54). */
  journey?: Pick<ArrivalJourney, 'arrivalRef'>
}

/**
 * Places the camera every frame from the ending's pull-back path (scene/camera.ts
 * owns the pose; ending-timeline.ts owns the invariant that makes it safe), and
 * then WRAPS it in the desk stop's breath (scene/camera-parallax.ts).
 *
 * It was a one-shot `lookAt` for nineteen rounds and it has to stay EXACTLY that
 * for the whole journey — the renewal proofs rest on the camera never moving while
 * rotation can. So the rig SKIPS on an unchanged pose rather than re-deriving one
 * it knows is identical: across all six chapters this costs three float compares
 * per frame and touches nothing, and the first write happens only once the ending's
 * pull-back has begun. `lastZoom` starts at NaN so the mount frame always applies
 * once (NaN !== NaN), which is what supplies the initial `lookAt` — the elevated
 * position plus that aim IS the downward pitch.
 *
 * ============================================================================
 * THE PARALLAX IS COMPOSED, NEVER MERGED (Task 72)
 * ============================================================================
 * The scroll camera is solved first, complete, by the functions it has always used.
 * Only then is the eye orbited about the aim it already computed. Nothing in
 * `camera.ts` or `ending-timeline.ts` learned that a pointer exists, and the aim is
 * not composed with anything at all — the orbit is ABOUT it, so Task 66's aim
 * invariant survives by there being no second path for the aim to take.
 *
 * The angles are the damped pointer TIMES `parallaxGainFor`, and that ordering is
 * load-bearing rather than stylistic: the gain is exactly +0 for the whole journey,
 * the whole still beat and the first four fifths of the pull-back, so the angles are
 * exactly ±0 there by multiplication — not by a damper that is merely heading for
 * zero and could still be short of it if a visitor flung the scroll back into the
 * journey. `orbitEyeInto` then takes its exact-zero branch and COPIES the pose.
 * Bit-identity is therefore a property of the arithmetic at every scroll position
 * the invariant covers, which is what `ending-camera.test.ts` has always asserted
 * and `camera-parallax.test.ts` now asserts of the composed rig.
 */
function CameraRig({ journeyRef }: { journeyRef: JourneyRef }) {
  const camera = useThree((s) => s.camera)
  const eye = useRef<[number, number, number]>([0, 0, 0])
  const orbited = useRef<[number, number, number]>([0, 0, 0])
  const aim = useRef<[number, number, number]>([0, 0, 0])
  const want = useRef<[number, number]>([0, 0])
  const yaw = useRef(0)
  const pitch = useRef(0)
  const lastZoom = useRef(Number.NaN)
  const lastYaw = useRef(Number.NaN)
  const lastPitch = useRef(Number.NaN)
  const lastAspect = useRef(Number.NaN)
  const input = usePointerParallax()

  useFrame((state, dt) => {
    const { ending } = journeyRef.current

    // WHAT THE POINTER IS ASKING FOR, before the envelope. Under the reduced-motion
    // preference nothing asks for anything; without a hovering pointer the drift asks
    // instead. `dt` is r3f's own frame delta, so the damping is frame-rate independent.
    const inp = input.current
    // The yaw budget is spent in FRAME units rather than in degrees, so a phone's swing costs the
    // same fraction of the picture a laptop's does — see `yawMaxFor`. Read off r3f's own `size`
    // rather than subscribed to, so a resize costs nothing and never re-registers this callback.
    const aspect = state.size.width / state.size.height
    if (inp.reduced) {
      want.current[0] = 0
      want.current[1] = 0
    } else if (inp.fine) {
      pointerAnglesInto(inp.x, inp.y, aspect, want.current)
    } else {
      driftAnglesInto(state.clock.elapsedTime, aspect, want.current)
    }
    yaw.current = dampAngle(yaw.current, want.current[0], PARALLAX_LAMBDA, dt)
    pitch.current = dampAngle(pitch.current, want.current[1], PARALLAX_LAMBDA, dt)

    const gain = parallaxGainFor(ending)
    const y = yaw.current * gain
    const p = pitch.current * gain

    // THE ASPECT IS PART OF THE POSE NOW (Task 76), so it is part of the skip key. A resize that
    // crosses the portrait band has to re-place the camera even at a frozen scroll position, and
    // without this line it would not — the rig would hold a pose solved for the old viewport until
    // the visitor scrolled. It costs one more float compare per frame and it changes nothing during
    // the journey, where every aspect gives the same pose.
    if (
      ending.zoom === lastZoom.current &&
      y === lastYaw.current &&
      p === lastPitch.current &&
      aspect === lastAspect.current
    )
      return
    lastZoom.current = ending.zoom
    lastYaw.current = y
    lastPitch.current = p
    lastAspect.current = aspect

    // The ending withdraws AND re-aims (Task 66): both halves are pure functions of the same
    // `zoom`, and both are bit-identical to the static pose while it is 0, so the skip above still
    // covers the whole journey. At zoom 0 this target is exactly CAMERA_TARGET.
    //
    // Task 76 gives both halves the ASPECT as a second input — a phone gets its own pull-back and
    // its own aim, because ndc y is aspect-free but the world WIDTH the frame covers is not (see
    // camera.ts, THE PHONE'S FRAME). It is read here, once per frame, off the same `state.size` the
    // parallax already reads: a pure input like the pointer's reduced-motion flag, never a clock.
    // At any landscape aspect both functions return the Task 66 pose bit for bit.
    const t = cameraTargetIntoFor(ending, aspect, aim.current)
    const base = cameraPositionIntoFor(ending, aspect, eye.current)
    const posed = orbitEyeInto(base, t, y, p, orbited.current)
    camera.position.fromArray(posed)
    camera.lookAt(t[0], t[1], t[2])

    // The connect block is DOM anchored to the viewport, so the orbit would slide the note out from
    // under it — see `note-parallax-shift.ts` for the collision this closes and for why no amount of
    // extra clearance can. Published as a difference, so it is a hard +0 at zero input and the
    // overlay is untouched for the whole journey.
    writeNoteParallaxShift(base, posed, t, aspect, y !== 0 || p !== 0)
  }, CAMERA_RIG_PRIORITY)

  return null
}

/**
 * Raises the render's pixel ratio — for the ending since Task 81, for the journey too since Task 130.
 *
 * `ending-dpr.ts` carries the whole argument — why a ceiling with no floor left a 1080p monitor
 * rendering the ending at 1440x900, and why the decision latches rather than being taken per frame.
 * T130 gave the JOURNEY a floor of its own (`LOOK.journeyDpr`, default 2, Aram's ask), which this
 * component passes in: at 1 the behaviour is T81's exactly, at 2 the whole lab renders at the
 * ending's density. All this does is read the zoom and write when the answer changes, at the same
 * priority as the rig so the buffer is never resized between the camera being placed and the frame
 * being drawn.
 */
function EndingDpr({ journeyRef }: { journeyRef: JourneyRef }) {
  const setDpr = useThree((s) => s.setDpr)
  useFrame((state) => {
    const device = typeof window === 'undefined' ? 1 : window.devicePixelRatio
    // The renderer's LIVE ratio, never a copy of what this component last asked for — see
    // `ending-dpr.ts`'s "WHAT IT COMPARES AGAINST IS LOAD-BEARING" for the failure that costs, and
    // for the trace. Reading the truth is free here (this is already a pure function of the frame)
    // and it deletes the only piece of state in this component that could be wrong.
    const next = endingDprFor(
      journeyRef.current.ending.zoom,
      device,
      state.viewport.dpr,
      LOOK.journeyDpr.value
    )
    if (next === null) return
    setDpr(next)
  }, CAMERA_RIG_PRIORITY)
  return null
}

function SceneContents({
  progressRef,
  journey,
  onBakeReady,
}: SceneProps & { onBakeReady?: () => void }) {
  const journeyRef = useDampedJourney(progressRef, journey?.arrivalRef)
  return (
    <>
      {/* Whole-graph shader precompile during the loader hold — eats the two
          first-visit pipeline stalls (ch1 prop field, ending desk) off-screen.
          Fire-and-forget: never wired into the loader's ready condition. */}
      <ScenePrecompile />
      <CameraRig journeyRef={journeyRef} />
      <EndingDpr journeyRef={journeyRef} />
      {/* Backdrop + key/ambient light, both graded to the chapter's biome mood (Task 55). */}
      <BiomeAtmosphere journeyRef={journeyRef} />
      <Planet journeyRef={journeyRef} onBakeReady={onBakeReady}>
        <GlobalDressing journeyRef={journeyRef} />
        <GlobalDressingAutumn journeyRef={journeyRef} />
        <Forest journeyRef={journeyRef} />
        <Jungle journeyRef={journeyRef} />
        <DeltaLife journeyRef={journeyRef} />
        <DesertLife journeyRef={journeyRef} />
        <CanyonGeysers journeyRef={journeyRef} />
        <WinterLife journeyRef={journeyRef} />
        {/* Task 86 — the four wedges' approach + tail ground, which is what the reader is
            actually looking at below the middle of every checkpoint frame. */}
        <ApproachDressing journeyRef={journeyRef} />
        {/* The retired yeti, hiding in the winter wedge's right-hand conifers. The lab's one click
            interaction — its hotspot arms only while that ground is on frame (Task 61). */}
        <YetiEgg journeyRef={journeyRef} />
        <EpilogueSet journeyRef={journeyRef} />
        <Bridges journeyRef={journeyRef} />
        <Delights journeyRef={journeyRef} />
        <ChapterSet index={0} journeyRef={journeyRef}>
          <BluenetSet />
        </ChapterSet>
        <ChapterSet index={1} journeyRef={journeyRef}>
          <FlyerbeeSet />
        </ChapterSet>
        <ChapterSet index={2} journeyRef={journeyRef}>
          <Dialog360Set />
        </ChapterSet>
        <ChapterSet index={3} journeyRef={journeyRef}>
          <AccentureSet />
        </ChapterSet>
        <ChapterSet index={4} journeyRef={journeyRef}>
          <AknaSet />
        </ChapterSet>
        <ChapterSet index={5} journeyRef={journeyRef}>
          <XdatagroupSet />
        </ChapterSet>
      </Planet>
      {hasArt('girl') ? (
        <Suspense fallback={<GirlProxy journeyRef={journeyRef} />}>
          <Girl journeyRef={journeyRef} />
        </Suspense>
      ) : (
        <GirlProxy journeyRef={journeyRef} />
      )}
      <DiscoveryBurst journeyRef={journeyRef} />
      {/* THE DESK (Task 65) — a sibling of the planet and permanently mounted: it is parked outside
          the journey camera's frustum rather than gated, so there is no entrance to scrub. See
          scene/desk-stage.ts for the containment proof the placement rests on. */}
      <DeskSet journeyRef={journeyRef} />
      {/* THE GLOBE STAND (Task 66) — the one thing in the ending that ARRIVES. It rises from below
          the journey frame during the still beat and the world ends up sitting in its cradle; see
          scene/globe-stand.ts for why this and not the desk is allowed an entrance. */}
      <GlobeStand journeyRef={journeyRef} />
      {/* THE "LET'S CREATE" NEON (Task 99) — the money shot's flanking sign. It cannot be parked
          below the journey frame (it lives at globe height), so its containment is the studio
          lights themselves: the strike envelope is exactly 0 wherever the lights are, which is
          the whole journey and the whole still beat. See scene/neon-sign.ts. */}
      <NeonSign journeyRef={journeyRef} />
      {/* Sky-anchored corner characters for each checkpoint — a SIBLING of the planet, never a
          child: they hold the frame's top corners while the world keeps spinning beneath them. */}
      <CheckpointPeekers journeyRef={journeyRef} />
    </>
  )
}

/** Side-view stage: planet is a wheel spinning about z; girl pinned on top. */
export function SmallWorldScene({
  progressRef,
  journey,
  onLoadChange,
}: SceneProps & { onLoadChange?: (progress: number, ready: boolean) => void }) {
  // Task 47 — the land bake is async (Web Worker), so "ready" must also wait for the first bake
  // to apply, not just the GLB manager. Planet fires onBakeReady on its first applied bake; this
  // flag is ANDed into the loader ready condition (see LoadSignal) so the loader never reveals an
  // empty planet. One-time false→true flip.
  const [bakeReady, setBakeReady] = useState(false)
  const onBakeReady = useCallback(() => setBakeReady(true), [])
  // Read ONCE, at mount. A new array on every render would make r3f reconfigure the renderer on
  // every render; a live change to the row is picked up by `<EndingDpr>` on the next frame instead,
  // which is the path that exists for exactly that.
  const dprRange = useMemo<[number, number]>(() => [LOOK.journeyDpr.value, ENDING_DPR_FLOOR], [])

  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
      {/* TAP-TO-ADVANCE, as the FALLBACK it should always have been (Task 61). r3f calls this only
          when a click hit no interactive object, so clicking the yeti egg peeks and clicking
          anywhere else advances the journey. During travel no panel is registered and this is a
          no-op — see panel-tap.ts, where the registration's lifetime does that work structurally. */}
      <Canvas
        camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
        gl={{ antialias: true }}
        /* A RANGE, not a setting: r3f clamps window.devicePixelRatio into it. The 2 is a CEILING
           (above it this lab renders no extra pixels — T79 proved a dsf6 capture was the browser
           upscaling a 2× render); the floor is the look table's journey row, so the buffer is
           ALLOCATED at the density the lab is going to run at instead of being reallocated on the
           first frame. It also settles a fight: r3f re-applies this range on every reconfigure,
           so a range that disagreed with `<EndingDpr>` above would keep undoing it. See
           `ending-dpr.ts`. */
        dpr={dprRange}
        onPointerMissed={firePanelAdvance}
      >
        <ToonRampProvider>
          <SceneContents progressRef={progressRef} journey={journey} onBakeReady={onBakeReady} />
        </ToonRampProvider>
        {/* Reports the girl-GLB load + the first land bake to the DOM planet loader. */}
        {onLoadChange && <LoadSignal onChange={onLoadChange} bakeReady={bakeReady} />}
      </Canvas>
    </div>
  )
}
