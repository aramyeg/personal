'use client'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { JourneyRef } from '../use-journey'
import {
  PeekerDressing,
  PeekerFigure,
  PEEKER_SPECS,
  type PeekerDrive,
  type PeekerLimbs,
} from './peeker-cast'
import {
  DRESS_PHASE,
  FIGURE_PHASE,
  PEEKER_CAST,
  PEEKER_DEPTH,
  PEEKER_FACE_IN,
  PEEKER_LEAN,
  PEEKER_LEAN_EXTRA,
  PEEK_SIDE_STAGGER,
  peekerAnchor,
  peekerClock,
  peekerHalfHeight,
  peekerIdle,
  peekerPresence,
  peekerRollSpin,
  peekerUnroll,
  type PeekerAnchor,
  type PeekerBiome,
  type PeekerKind,
  type Side,
} from './peeker-stage'

/**
 * Task 56 — the CHECKPOINT MASCOT rig.
 *
 * The camera never moves (it is placed once and aimed at the planet's centre; the world spins
 * beneath it), so a single group that copies the camera's transform gives every mascot a stable
 * CAMERA-SPACE frame to live in. Children are then positioned in plain frustum coordinates, which
 * is what makes the staging aspect-correct for free: a resize re-derives the corner from the live
 * fov and viewport instead of stranding a hardcoded world position mid-frame.
 *
 * Where they sit is `peekerAnchor`'s decision, not a constant — see peeker-stage.ts. What drives
 * them is split deliberately:
 *
 *  - ENTRANCE and EXIT ride Task 54's arrival clock (`JourneyState.reveal`), so a checkpoint rolls
 *    its dressing and characters out on arrival with the visitor's hands off the wheel. Dressing
 *    leads, characters follow, and the right-hand side trails its partner by a beat.
 *  - IDLE stays on the panel's scroll dwell, so what a character DOES while you read is still a
 *    pure function of scroll position — the determinism contract survives where it matters.
 *
 * Cost: all twelve figures and six dressings mount once (their merged geometries are built at
 * mount and disposed on unmount), but only the active chapter's pair is ever visible, and an
 * invisible group is pruned from the render list.
 */

/** Idle phase offset for the right-hand figure so a pair never beats in lockstep. */
const RIGHT_PHASE = 0.37

function PeekerSide({
  journeyRef,
  chapter,
  biome,
  kind,
  side,
  anchor,
  reduced,
}: {
  journeyRef: JourneyRef
  chapter: number
  biome: PeekerBiome
  kind: PeekerKind
  side: Side
  anchor: PeekerAnchor
  reduced: boolean
}) {
  const spec = PEEKER_SPECS[kind]
  // Figures are authored facing +X (into the frame); the right-hand corner wants them turned.
  const dir: 1 | -1 = side === -1 ? 1 : -1
  const root = useRef<THREE.Group>(null)
  const dress = useRef<THREE.Group>(null)
  const figure = useRef<THREE.Group>(null)
  const spinner = useRef<THREE.Group>(null)
  const limbs = useRef<PeekerLimbs>({ a: null, b: null })
  const drive = useRef<PeekerDrive>({ idle: 0, unroll: 0 })
  const stagger = side === 1 ? PEEK_SIDE_STAGGER : 0

  useFrame(() => {
    const g = root.current
    if (!g) return
    const state = journeyRef.current
    const clock = anchor.visible ? peekerClock(state, chapter) : null
    if (clock === null) {
      g.visible = false
      return
    }

    const dressP = peekerPresence(clock, DRESS_PHASE, reduced, stagger)
    const figureP = peekerPresence(clock, FIGURE_PHASE, reduced, stagger)
    if (dressP <= 0.0005 && figureP <= 0.0005) {
      g.visible = false
      return
    }
    g.visible = true

    // Idle is scroll-driven, so it settles when you stop scrolling and replays exactly on a scrub.
    const panel = state.panel
    const dwell = panel && panel.chapter === chapter ? panel.t : 0
    const settled = Math.min(1, Math.max(0, figureP))
    const idle = reduced ? 0 : peekerIdle(dwell, spec.cycles, side === 1 ? RIGHT_PHASE : 0) * settled

    // Each element rides its own presence from its hidden pose to the parked one; the easeOutBack
    // overshoot past 1 IS the settle.
    place(dress.current, anchor, side, dressP, 0)
    place(figure.current, anchor, side, figureP, spec.sway * idle)

    if (spinner.current) {
      spinner.current.rotation.z = spec.rolls && !reduced ? -side * peekerRollSpin(figureP) : 0
    }
    drive.current.idle = idle
    drive.current.unroll = spec.rolls && !reduced ? peekerUnroll(clock) : 1
    spec.apply(limbs.current, drive.current, dir)
  })

  return (
    <group ref={root} visible={false} position={[0, 0, -PEEKER_DEPTH]}>
      <group ref={dress}>
        <PeekerDressing biome={biome} dir={dir} vdir={anchor.vdir} />
      </group>
      {anchor.mode === 'pair' ? (
        <group ref={figure}>
          <group ref={spinner}>
            <PeekerFigure biome={biome} kind={kind} limbs={limbs} dir={dir} />
          </group>
        </group>
      ) : null}
    </group>
  )
}

/** Lerp one element of a composition from its hidden pose to its parked pose. */
function place(g: THREE.Group | null, anchor: PeekerAnchor, side: Side, presence: number, sway: number): void {
  if (!g) return
  const hide = 1 - presence
  g.position.set(anchor.x, anchor.y + hide * (anchor.hiddenY - anchor.y), 0)
  g.rotation.set(0, -side * PEEKER_FACE_IN, side * (PEEKER_LEAN + hide * PEEKER_LEAN_EXTRA) + sway)
  g.scale.setScalar(anchor.size)
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

  const anchors = useMemo(() => {
    const halfH = peekerHalfHeight(camera.fov)
    const halfW = (halfH * size.width) / size.height
    return {
      [-1]: peekerAnchor(halfH, halfW, size, -1),
      [1]: peekerAnchor(halfH, halfW, size, 1),
    } as Record<number, PeekerAnchor>
  }, [camera.fov, size])

  // Priority −0.5 keeps this after the journey damp (−1) and before every side (0), so a side
  // always reads a camera frame and a JourneyState from the same tick.
  useFrame(() => {
    const g = frame.current
    if (!g) return
    g.position.copy(camera.position)
    g.quaternion.copy(camera.quaternion)
  }, -0.5)

  return (
    <group ref={frame}>
      {PEEKER_CAST.map((pair, chapter) => (
        <Fragment key={pair.biome}>
          <PeekerSide
            journeyRef={journeyRef}
            chapter={chapter}
            biome={pair.biome}
            kind={pair.left}
            side={-1}
            anchor={anchors[-1]}
            reduced={reduced}
          />
          <PeekerSide
            journeyRef={journeyRef}
            chapter={chapter}
            biome={pair.biome}
            kind={pair.right}
            side={1}
            anchor={anchors[1]}
            reduced={reduced}
          />
        </Fragment>
      ))}
    </group>
  )
}
