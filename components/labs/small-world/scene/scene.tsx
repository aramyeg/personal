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
  CAMERA_TARGET,
  cameraPositionInto,
} from './camera'
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
 * owns the pose; ending-timeline.ts owns the invariant that makes it safe).
 *
 * It was a one-shot `lookAt` for nineteen rounds and it has to stay EXACTLY that
 * for the whole journey — the renewal proofs rest on the camera never moving while
 * rotation can. So the rig SKIPS on an unchanged zoom rather than re-deriving a
 * pose it knows is identical: across all six chapters this costs one float compare
 * per frame and touches nothing, and the first write happens only once the ending's
 * pull-back has begun. `lastZoom` starts at NaN so the mount frame always applies
 * once (NaN !== NaN), which is what supplies the initial `lookAt` — the elevated
 * position plus that aim IS the downward pitch.
 */
function CameraRig({ journeyRef }: { journeyRef: JourneyRef }) {
  const camera = useThree((s) => s.camera)
  const scratch = useRef<[number, number, number]>([0, 0, 0])
  const lastZoom = useRef(Number.NaN)

  useFrame(() => {
    const { ending } = journeyRef.current
    if (ending.zoom === lastZoom.current) return
    lastZoom.current = ending.zoom
    camera.position.fromArray(cameraPositionInto(ending, scratch.current))
    camera.lookAt(CAMERA_TARGET[0], CAMERA_TARGET[1], CAMERA_TARGET[2])
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
