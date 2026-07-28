'use client'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { JourneyRef } from '../use-journey'
import { PEEKER_SPECS, type PeekerDrive, type PeekerLimbs } from './peeker-cast'
import {
  PEEKER_DEPTH,
  PEEKER_FACE_IN,
  PEEKER_LEAN,
  PEEKER_LEAN_EXTRA,
  PEEK_SIDE_STAGGER,
  PEEKER_CAST,
  peekerIdle,
  peekerPlacement,
  peekerPresence,
  peekerRollSpin,
  peekerUnroll,
  type PeekerKind,
  type PeekerPlacement,
} from './peeker-stage'

/**
 * Task 53 — the CHECKPOINT PEEKER rig.
 *
 * The camera never moves (it is placed once and aimed at the planet's centre; the world spins
 * beneath it), so a single group that copies the camera's transform gives every peeker a stable
 * CAMERA-SPACE frame to live in. Children are then positioned in plain frustum coordinates,
 * which is what makes the staging aspect-correct for free: a resize re-derives the corner from
 * the live fov and viewport instead of stranding a hardcoded world position mid-frame.
 *
 * Where they sit: PEEKER_DEPTH is behind the planet's whole ceiling budget, so the depth buffer
 * alone guarantees a peeker can never draw over the world — the "planet is never covered" rule
 * holds by construction, not by tuning. The corners themselves are pure sky at every aspect
 * (peeker-stage.test.ts pins the NDC clearance).
 *
 * What drives them: the chapter's panel dwell fraction, the same JourneyState.panel the DOM
 * panels read. No wall clock anywhere, so scrubbing back up the page walks them out exactly the
 * way they walked in.
 *
 * Cost: all ten figures mount once (their merged geometries are built at mount and disposed on
 * unmount), but only the active chapter's pair is ever visible — an invisible group is pruned
 * from the render list, so the peekers add 4 draw calls at a checkpoint (6 at the canyon, where
 * each pangolin is a shell plus two unfurling pieces) and exactly 0 everywhere else.
 */

/** Idle phase offset for the right-hand figure so the pair never beats in lockstep. */
const RIGHT_PHASE = 0.37

function PeekerSide({
  journeyRef,
  chapter,
  kind,
  side,
  place,
  reduced,
}: {
  journeyRef: JourneyRef
  chapter: number
  kind: PeekerKind
  side: -1 | 1
  place: PeekerPlacement
  reduced: boolean
}) {
  const spec = PEEKER_SPECS[kind]
  // Figures are authored facing +X; the right-hand corner wants them turned the other way.
  const dir: 1 | -1 = side === -1 ? 1 : -1
  const outer = useRef<THREE.Group>(null)
  const spinner = useRef<THREE.Group>(null)
  const limbs = useRef<PeekerLimbs>({ a: null, b: null })
  const drive = useRef<PeekerDrive>({ idle: 0, unroll: 0 })
  const stagger = side === 1 ? PEEK_SIDE_STAGGER : 0

  useFrame(() => {
    const g = outer.current
    if (!g) return
    const panel = journeyRef.current.panel
    if (!panel || panel.chapter !== chapter) {
      g.visible = false
      return
    }
    const t = panel.t - stagger
    const p = peekerPresence(t, reduced)
    if (p <= 0.0005) {
      g.visible = false
      return
    }
    g.visible = true

    // `p` is the hidden→parked lerp; its easeOutBack overshoot past 1 IS the settle.
    const hide = 1 - p
    const settled = Math.min(1, Math.max(0, p))
    const idle = reduced ? 0 : peekerIdle(t, spec.cycles, side === 1 ? RIGHT_PHASE : 0) * settled

    g.position.set(
      side * (place.x + hide * place.hiddenOut),
      place.y + hide * (place.hiddenY - place.y),
      -PEEKER_DEPTH
    )
    g.rotation.set(
      0,
      -side * PEEKER_FACE_IN,
      side * (PEEKER_LEAN + hide * PEEKER_LEAN_EXTRA) + spec.sway * idle
    )
    g.scale.setScalar(place.size)

    if (spinner.current) {
      spinner.current.rotation.z = spec.rolls && !reduced ? -side * peekerRollSpin(p) : 0
    }

    drive.current.idle = idle
    drive.current.unroll = spec.rolls && !reduced ? peekerUnroll(t) : 1
    spec.apply(limbs.current, drive.current, dir)
  })

  const Figure = spec.Figure
  return (
    <group ref={outer} visible={false}>
      <group ref={spinner}>
        <Figure limbs={limbs} dir={dir} />
      </group>
    </group>
  )
}

/**
 * Read once at mount, matching the lab's existing treatment. Belt and braces: the whole 3D
 * experience is already swapped for the static timeline when a visitor prefers reduced motion
 * (small-world-experience.tsx), so this path is a guarantee rather than the primary gate.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])
  return reduced
}

export function CheckpointPeekers({ journeyRef }: { journeyRef: JourneyRef }) {
  const frame = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const reduced = usePrefersReducedMotion()

  const place = useMemo(() => {
    const halfH = PEEKER_DEPTH * Math.tan((camera.fov * Math.PI) / 360)
    return peekerPlacement(halfH, halfH * (size.width / size.height))
  }, [camera.fov, size.width, size.height])

  // Priority −0.5 keeps this after the journey damp (−1) and before every peeker side (0), so a
  // side always reads a camera frame and a JourneyState from the same tick.
  useFrame(() => {
    const g = frame.current
    if (!g) return
    g.position.copy(camera.position)
    g.quaternion.copy(camera.quaternion)
  }, -0.5)

  return (
    <group ref={frame}>
      {PEEKER_CAST.map((pair, chapter) =>
        pair === null ? null : (
          <Fragment key={chapter}>
            <PeekerSide
              journeyRef={journeyRef}
              chapter={chapter}
              kind={pair[0]}
              side={-1}
              place={place}
              reduced={reduced}
            />
            <PeekerSide
              journeyRef={journeyRef}
              chapter={chapter}
              kind={pair[1]}
              side={1}
              place={place}
              reduced={reduced}
            />
          </Fragment>
        )
      )}
    </group>
  )
}
