'use client'
import { Suspense, useCallback, useLayoutEffect, useState } from 'react'
import type { MutableRefObject } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { hasArt } from '../art-manifest'
import { Sky } from './sky'
import { Planet } from './planet'
import { Girl } from './girl'
import { GirlProxy } from './girl-proxy'
import { DiscoveryBurst } from './discovery-burst'
import { useDampedJourney } from './use-journey'
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
import { XdatagroupSet } from './props/set-xdatagroup'
import { CheckpointPeekers } from './props/peekers'
import { LoadSignal } from '../loader/load-signal'

export type SceneProps = { progressRef: MutableRefObject<number> }

/**
 * Composition target (reference-language research): whole planet visible
 * with void margin, filling ~55% of the viewport's shorter axis; camera
 * above the planet's center height, looking down ~20°.
 */
const CAMERA_FOV = 38
const CAMERA_PITCH_DEG = 20
/** World units from the planet's center — tuned against CAMERA_FOV for the fill target above. */
const CAMERA_DISTANCE = 12.1

const PITCH = (CAMERA_PITCH_DEG * Math.PI) / 180
const CAMERA_POSITION: [number, number, number] = [
  0,
  CAMERA_DISTANCE * Math.sin(PITCH),
  CAMERA_DISTANCE * Math.cos(PITCH),
]

/** Aims the camera at the planet's center once — the elevated position + this look-at is the downward pitch. */
function CameraRig() {
  const camera = useThree((s) => s.camera)
  useLayoutEffect(() => {
    camera.lookAt(0, 0, 0)
  }, [camera])
  return null
}

function SceneContents({
  progressRef,
  onBakeReady,
}: SceneProps & { onBakeReady?: () => void }) {
  const journeyRef = useDampedJourney(progressRef)
  return (
    <>
      <CameraRig />
      <Sky />
      {/* Lower ambient so the 4-step ramp actually bands across the form — high
          fill washed the clay creases into a soft haze. */}
      <ambientLight intensity={0.42} />
      {/* Warm key raking from the upper-left, low enough that the terminator
          crosses the visible face — shadow pools in the clay dents and reads the
          toon bands as pinched facets. */}
      <directionalLight position={[-6, 2, 3.2]} intensity={1.55} color="#fff2e0" />
      <Planet journeyRef={journeyRef} onBakeReady={onBakeReady}>
        <GlobalDressing journeyRef={journeyRef} />
        <GlobalDressingAutumn journeyRef={journeyRef} />
        <Forest journeyRef={journeyRef} />
        <Jungle journeyRef={journeyRef} />
        <DeltaLife journeyRef={journeyRef} />
        <DesertLife journeyRef={journeyRef} />
        <CanyonGeysers journeyRef={journeyRef} />
        <WinterLife journeyRef={journeyRef} />
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
      {/* Sky-anchored corner characters for each checkpoint — a SIBLING of the planet, never a
          child: they hold the frame's top corners while the world keeps spinning beneath them. */}
      <CheckpointPeekers journeyRef={journeyRef} />
    </>
  )
}

/** Side-view stage: planet is a wheel spinning about z; girl pinned on top. */
export function SmallWorldScene({
  progressRef,
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
      <Canvas camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }} gl={{ antialias: true }} dpr={[1, 2]}>
        <ToonRampProvider>
          <SceneContents progressRef={progressRef} onBakeReady={onBakeReady} />
        </ToonRampProvider>
        {/* Reports the girl-GLB load + the first land bake to the DOM planet loader. */}
        {onLoadChange && <LoadSignal onChange={onLoadChange} bakeReady={bakeReady} />}
      </Canvas>
    </div>
  )
}
