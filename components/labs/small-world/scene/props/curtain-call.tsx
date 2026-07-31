'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { JourneyRef } from '../use-journey'
import { revealPhase } from '../../journey-timeline'
import {
  PeekerDressing,
  PeekerFigure,
  PEEKER_SPECS,
  type PeekerDrive,
  type PeekerLimbs,
} from './peeker-cast'
import { PEEKER_FACE_IN, peekerDrift, peekerRollSpin, peekerUnroll } from './peeker-stage'
import {
  CURTAIN_BOW_DIP,
  CURTAIN_BOW_FOLD,
  CURTAIN_CAST,
  CURTAIN_FOOT_Y,
  CURTAIN_GATHER_SPAN,
  CURTAIN_LEAN,
  CURTAIN_LEAN_EXTRA,
  CURTAIN_ROWS,
  CURTAIN_STAGGER,
  curtainArrival,
  curtainBow,
  curtainHalfHeight,
  curtainIdle,
  curtainSlotV,
  curtainLayoutInfo,
  curtainPhase,
  curtainRowDistance,
  curtainRowOffset,
  curtainRowScale,
  curtainStageQuaternion,
  type CurtainSlot,
} from './curtain-stage'

/**
 * Task 64 — THE CURTAIN CALL. The whole cast comes out from behind the little world, gathers around
 * it and bows; then the camera pulls away from the bow rather than the bow packing up.
 *
 * curtain-stage.ts carries the staging argument and the layout; this file is only how it reaches
 * the screen. Three properties of the shape are worth reading here, because they are what keep it
 * cheap and what keep it out of the hazards the ending's spine warned about:
 *
 *  - ONE `useFrame`, at DEFAULT priority. The rig does not copy the camera's transform — the stage
 *    frame is static, see `curtainStageQuaternion` — so it cannot trail the pull-back by a frame
 *    and it has no relation to `CAMERA_RIG_PRIORITY` to get wrong. Default (0) is already after
 *    `useDampedJourney` (−1), which is the only ordering it needs.
 *  - ZERO COST DURING THE JOURNEY. `curtain` is exactly 0 for every progress ≤ 1, so the callback
 *    compares one float and returns with the group hidden — and an invisible group is pruned from
 *    the render list, so the cast costs no draw calls at all until the ending starts.
 *  - EVERYTHING IS A PURE FUNCTION OF `EndingState`. No clocks anywhere: the gather and the bow
 *    read `curtain`, the idle reads `t`, so scrubbing back runs the curtain call backwards exactly.
 */

type MemberRefs = {
  root: THREE.Group | null
  /** Carries the parked lean and the raft's roll — the whole composition, dressing included. */
  lean: THREE.Group | null
  /** ...and this one carries the bow's inward dip and the figure's own sway, hinged at its feet. */
  dip: THREE.Group | null
  /** The bow's forward fold, on the same hinge. */
  fold: THREE.Group | null
  spin: THREE.Group | null
  limbs: MutableRefObject<PeekerLimbs>
  drive: PeekerDrive
}

/** Allocation-free stand-in for a composition that does not float. */
const ZERO_DRIFT = { roll: 0, bob: 0 } as const

/** How long a resize has to settle before the layout is re-solved. */
const CURTAIN_RESOLVE_MS = 180

/**
 * Read once at mount, matching the rest of the lab. The whole canvas is swapped for the static
 * fallback page under `prefers-reduced-motion`, so this is a guarantee rather than the gate.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])
  return reduced
}

export function CurtainCall({ journeyRef }: { journeyRef: JourneyRef }) {
  const stage = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const reduced = usePrefersReducedMotion()

  // DEBOUNCED, because the solve is 40-165 ms on the main thread and `size` ticks continuously
  // through a resize drag. Undebounced, a drag that crosses square-ish aspects re-solved at every
  // frame of the drag; now it solves once the frame has settled. The first solve is NOT deferred —
  // `useState`'s initialiser runs it inline at mount, so nothing pops in a frame late.
  const { width, height } = size
  const [staged, setStaged] = useState(() => curtainLayoutInfo({ width, height }))
  const last = useRef({ width, height })
  useEffect(() => {
    if (last.current.width === width && last.current.height === height) return
    const id = window.setTimeout(() => {
      last.current = { width, height }
      setStaged(curtainLayoutInfo({ width, height }))
    }, CURTAIN_RESOLVE_MS)
    return () => window.clearTimeout(id)
  }, [width, height])
  const slots = staged.slots
  /**
   * THE PORTRAIT EXIT (fix round). On a frame where the desk leaves the company nowhere to stand,
   * it holds the bow through the still beat and then takes its leave — see `curtainExit`. On every
   * frame the desk allows, this is 0 for the whole ending and the pose is bit-identical to the
   * design Aram signed off: the bow becomes the thing the camera pulls away from.
   */
  const deskClear = staged.deskClear

  /**
   * World units per half-height at each row's own stage plane. A back row is further from the
   * camera, so the same screen-space slot is a LARGER world offset there — which is what lets two
   * rows line up on screen while being genuinely apart in depth.
   */
  const rowHalf = useMemo(
    () =>
      Array.from({ length: CURTAIN_ROWS }, (_, row) =>
        curtainHalfHeight(camera.fov, curtainRowDistance(row))
      ),
    [camera.fov]
  )

  const members = useRef<MemberRefs[]>(
    CURTAIN_CAST.map(() => ({
      root: null,
      lean: null,
      dip: null,
      fold: null,
      spin: null,
      limbs: { current: { a: null, b: null } },
      drive: { idle: 0, unroll: 1 },
    }))
  )

  // The camera's orientation is constant for the whole ending, so this is read once.
  const quaternion = useMemo(() => curtainStageQuaternion(), [])

  useFrame(() => {
    const g = stage.current
    if (!g) return
    const { ending } = journeyRef.current
    if (ending.curtain <= 0) {
      g.visible = false
      return
    }
    g.visible = true

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      const m = members.current[i]
      if (!m.root) continue
      const spec = PEEKER_SPECS[CURTAIN_CAST[i].kind]
      const dir: 1 | -1 = slot.side === -1 ? 1 : -1
      const halfH = rowHalf[slot.row]

      // THE GATHER. A composition travels radially OUT FROM THE CENTRE of the ring — where it sits
      // tucked behind the world, on a stage plane past the bake's whole ceiling budget — to its
      // slot. That is why the entrance needs no hiding rule: the world itself is the wing the cast
      // walks on from. The easeOutBack overshoot past 1 IS the settle.
      const arrival = curtainArrival(ending.curtain, i, reduced)
      const settled = arrival < 0 ? 0 : arrival > 1 ? 1 : arrival
      const hide = 1 - arrival

      // THE IDLE, on the ending's own `t` rather than on `curtain`: `curtain` parks at 1 for the
      // still beat and the whole pull-back, so an idle keyed to it would leave twelve statues to
      // be pulled away from.
      const phase = curtainPhase(i)
      const idle = reduced ? 0 : curtainIdle(ending.t, spec.cycles, phase) * settled
      // THE RAFT's heave is applied to the slot's `v` below and is deliberately NOT swept: at
      // `PEEKER_MAX_BOB` (0.014 figure-heights) it displaces 0.0027 half-heights at desktop size,
      // an order of magnitude inside `CURTAIN_WORLD_MARGIN`, which exists for exactly this class of
      // motion applied after the placement decision. Its ROLL is a different matter and IS
      // accounted for — the test pins `sway + DRIFT_ROLL` per kind against `CURTAIN_MAX_SWAY`.
      const raft = spec.drifts && !reduced ? peekerDrift(ending.t, phase) : ZERO_DRIFT
      const bow = curtainBow(ending.curtain, i)
      // ...and, where the desk forces it, how far this one has already sunk out of frame.
      const vAt = curtainSlotV(slot.v, ending.t, i, deskClear)

      m.root.position.set(
        slot.u * arrival * halfH,
        (vAt * arrival + raft.bob * settled * slot.size) * halfH,
        -curtainRowOffset(slot.row)
      )
      m.root.scale.setScalar(slot.size * curtainRowScale(slot.row) * halfH)

      // The composition's own lean, dressing included: the parked inward tilt, the steeper one it
      // carries while still tucked away, and the raft's roll for the one composition that floats.
      if (m.lean) {
        m.lean.rotation.z = slot.side * (CURTAIN_LEAN + hide * CURTAIN_LEAN_EXTRA) + raft.roll * settled
      }
      // THE BOW, hinged at the figure's FEET and applied to the FIGURE ALONE — the island it stands
      // on does not tip. (An 18° roll on a rock ledge reads as the ground tilting, which is the one
      // thing a set dressing must never do.) The dip leans it toward the girl, the fold tips its
      // head toward the reader, and the two hinge at the same point so their product is the single
      // rotation `curtainCompositionBox` sweeps.
      if (m.dip) m.dip.rotation.z = slot.side * bow * CURTAIN_BOW_DIP + spec.sway * idle
      if (m.fold) m.fold.rotation.x = bow * CURTAIN_BOW_FOLD

      // The pangolin still arrives as a ball and unfurls once it parks — the one entrance in the
      // cast that is a character beat rather than a placement, re-driven off scroll. It wants the
      // RAW window rather than the eased arrival: the unfurl is staged inside the entrance, and
      // easeOutBack's overshoot would run it past its own end and back.
      if (m.spin) {
        m.spin.rotation.z = spec.rolls && !reduced ? -slot.side * peekerRollSpin(arrival) : 0
      }
      m.drive.idle = idle
      m.drive.unroll =
        spec.rolls && !reduced
          ? peekerUnroll(
              revealPhase(
                ending.curtain,
                i * CURTAIN_STAGGER,
                i * CURTAIN_STAGGER + CURTAIN_GATHER_SPAN
              )
            )
          : 1
      spec.apply(m.limbs.current, m.drive, dir)
    }
  })

  if (slots.length === 0) return null

  return (
    <group ref={stage} quaternion={quaternion} visible={false}>
      {slots.map((slot, i) => (
        <Member key={CURTAIN_CAST[i].kind} slot={slot} index={i} refs={members.current[i]} />
      ))}
    </group>
  )
}

function Member({ slot, index, refs }: { slot: CurtainSlot; index: number; refs: MemberRefs }) {
  const member = CURTAIN_CAST[index]
  const dir: 1 | -1 = slot.side === -1 ? 1 : -1
  return (
    <group
      ref={(g) => {
        refs.root = g
      }}
    >
      <group rotation={[0, -slot.side * PEEKER_FACE_IN, 0]}>
        <group
          ref={(g) => {
            refs.lean = g
          }}
        >
          {/* The set dressing each mascot came back with — its own corner of the world, brought to
              the bow. It takes the composition's lean but nothing of the bow: the island does not
              bow, the animal standing on it does. */}
          <PeekerDressing biome={member.biome} kind={member.kind} dir={dir} vdir={-1} />
          {/* Two nested hinges rather than one Euler, and deliberately: three's Euler order would
              decide which of the dip and the fold is applied first, and the swept envelope in
              curtain-stage.ts multiplies them explicitly in THIS order. A sweep that describes a
              different pose than the one that renders is worse than no sweep at all. */}
          <group
            ref={(g) => {
              refs.dip = g
            }}
            position={[0, CURTAIN_FOOT_Y, 0]}
          >
            <group
              ref={(g) => {
                refs.fold = g
              }}
            >
              <group position={[0, -CURTAIN_FOOT_Y, 0]}>
                <group
                  ref={(g) => {
                    refs.spin = g
                  }}
                >
                  <PeekerFigure
                    biome={member.biome}
                    kind={member.kind}
                    limbs={refs.limbs}
                    dir={dir}
                  />
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
