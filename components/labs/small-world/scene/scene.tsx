'use client'
import { useLayoutEffect } from 'react'
import type { MutableRefObject } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Sky } from './sky'
import { Planet } from './planet'
import { GirlProxy } from './girl-proxy'
import { useDampedJourney } from './use-journey'

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

function SceneContents({ progressRef }: SceneProps) {
  const journeyRef = useDampedJourney(progressRef)
  return (
    <>
      <CameraRig />
      <Sky />
      <ambientLight intensity={0.7} />
      {/* Warm raking key from upper-left — makes the toon ramp bands read as clay facets. */}
      <directionalLight position={[-5, 3.5, 4]} intensity={1.35} color="#fff2e0" />
      <Planet journeyRef={journeyRef} />
      <GirlProxy journeyRef={journeyRef} />
    </>
  )
}

/** Side-view stage: planet is a wheel spinning about z; girl pinned on top. */
export function SmallWorldScene({ progressRef }: SceneProps) {
  return (
    <Canvas camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }} gl={{ antialias: true }} dpr={[1, 2]}>
      <SceneContents progressRef={progressRef} />
    </Canvas>
  )
}
