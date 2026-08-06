'use client'
import { Suspense, useCallback, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { hasArt } from '../art-manifest'
import { BiomeAtmosphere } from './biome-atmosphere'
import {
  CAMERA_FOV,
  CAMERA_POSITION,
  CAMERA_RIG_PRIORITY,
  cameraPositionInto,
  cameraTargetInto,
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
import { WinterLife } from './props/winter'
import { YetiEgg } from './props/yeti-egg'
import { EpilogueSet } from './props/epilogue'
import { DeskSet } from './props/desk-set'
import { GlobeStand } from './props/globe-stand'
import { XdatagroupSet } from './props/set-xdatagroup'
import { CheckpointPeekers } from './props/peekers'
import { LoadSignal } from '../loader/load-signal'
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

    if (ending.zoom === lastZoom.current && y === lastYaw.current && p === lastPitch.current) return
    lastZoom.current = ending.zoom
    lastYaw.current = y
    lastPitch.current = p

    // The ending withdraws AND re-aims (Task 66): both halves are pure functions of the same
    // `zoom`, and both are bit-identical to the static pose while it is 0, so the skip above still
    // covers the whole journey. At zoom 0 this target is exactly CAMERA_TARGET.
    const t = cameraTargetInto(ending, aim.current)
    const base = cameraPositionInto(ending, eye.current)
    camera.position.fromArray(orbitEyeInto(base, t, y, p, orbited.current))
    camera.lookAt(t[0], t[1], t[2])
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
      <CameraRig journeyRef={journeyRef} />
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
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
      {/* TAP-TO-ADVANCE, as the FALLBACK it should always have been (Task 61). r3f calls this only
          when a click hit no interactive object, so clicking the yeti egg peeks and clicking
          anywhere else advances the journey. During travel no panel is registered and this is a
          no-op — see panel-tap.ts, where the registration's lifetime does that work structurally. */}
      <Canvas
        camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
        gl={{ antialias: true }}
        dpr={[1, 2]}
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
