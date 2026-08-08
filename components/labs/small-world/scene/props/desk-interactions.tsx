'use client'
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { JourneyRef } from '../use-journey'
import { useFinePointer, usePrefersReducedMotion } from '../use-reduced-motion'
import { DESK_NUDGE_ZONES, type DeskNudgeKind } from './desk-glb-contract'
import {
  BEND_UNIFORM,
  HOVER_SCALE,
  NOTE_CURL_UNIFORM,
  NUDGE_UNIFORMS,
  PRESS_CLICK,
  PRESS_HOVER,
  RATTLE_UNIFORM,
  ROCK_PARAMS,
  nudgeArmedFor,
  restingPeck,
  restingPress,
  restingRattle,
  restingSpring,
  restingSquash,
  samplePeck,
  samplePress,
  sampleRattle,
  sampleRock,
  sampleSquash,
  steamKickMail,
  tipDirFrom,
  triggerPeck,
  triggerPress,
  triggerRattle,
  triggerRock,
  triggerSquash,
  type NotePressState,
  type NudgeSpring,
  type PeckState,
  type RattleState,
  type SquashSpring,
} from './desk-nudge'
import { GLOBE_ROCK, GLOBE_UNIFORM, triggerGlobeRock } from '../globe-nudge'
import { bookRayHit, canRayHit, coffeeRayHit, laneRayHit, mugStirMail } from './desk-deep'
import {
  LANE_BAR_INDEX,
  PENCUP_BODY,
  STATION_BARS,
  STATION_CLAIMS,
  STATION_TREE,
  STATION_UNIFORMS,
  resolveDeskPick,
  restingCasePop,
  restingChipPress,
  restingScoot,
  restingTeeter,
  restingTreeSway,
  sampleCasePop,
  sampleChipPress,
  sampleScoot,
  sampleTeeter,
  sampleTreeSway,
  scootSignFrom,
  teeterSignFrom,
  triggerCasePop,
  triggerChipPress,
  triggerScoot,
  triggerTeeter,
  triggerTreeSway,
  type CasePopState,
  type ChipPressState,
  type ScootState,
  type StationKind,
  type TeeterState,
} from './desk-station'

/**
 * THE POINTER'S HANDS (Task 89) — the plumbing that turns pointer events into the responses
 * `desk-nudge.ts` defines. That module carries the law, the six signatures and every number; this
 * file only listens, raycasts, dispatches per kind and writes uniforms. Nothing here allocates
 * after mount and nothing renders: the component returns null and the desk's own materials do the
 * moving.
 *
 * HIT-TESTING is analytic and owned by `resolveDeskPick` (desk-station.ts, T97 round 3): every
 * claim on the desk — the T89 boxes, the note's corner, the station's capsules and spheres, the
 * pens, the cup's cylinder, the globe, the lane's precedence — against one camera ray, once per
 * frame on the latest pointer position. One pure function, because the desk is a merged bake
 * with no per-object meshes to raycast (see `DESK_NUDGE_ZONES`), because an interaction list of
 * invisible colliders would be dozens of scene objects doing the job of one function, and
 * because the claim-resolution sweep in desk-station.test.ts must drive the EXACT function this
 * component uses — a replica would drift. Sub-44 px targets are grown to the phone's tap floor
 * at their own depth, but a floor is never a shield: see the resolver's surface-beats-pad rule.
 *
 * ARMING follows the yeti's discipline: the gate is checked in the frame loop, a disarm resets
 * every signature to exact rest in the same frame (there is no unwind to run — rest is each
 * closed form's own destination), and the cursor can never promise a click the desk will not
 * answer. Hover triggers only for a genuinely hovering pointer (`pointerType` filtered exactly as
 * `use-pointer-parallax.ts` does, and for the same reason: a touch drag is a scroll, not a
 * hover); taps come through `click`, which the browser already suppresses for drags.
 *
 * A11Y, honestly: same stance as the yeti — the canvas is decorative and `aria-hidden`, the lab's
 * real content lives in the DOM, and reduced-motion visitors get the static timeline upstream.
 * These are toys on a desk, not controls; no tab stops are added inside a hidden canvas.
 */

type ZoneId = DeskNudgeKind | 'note' | 'globe' | `station-${string}`

type Hit = { id: ZoneId; t: number; point: [number, number, number] }

/** id → (kind, index) for the station dispatch — geometry lives with the resolver. */
const STATION_LOOKUP = new Map<ZoneId, { kind: StationKind; index: number }>(
  STATION_CLAIMS.map((c) => [`station-${c.kind}-${c.index}` as ZoneId, { kind: c.kind, index: c.index }])
)
/** The rocker dispatch's tip-direction reference points: box centres for the chunky T89 props,
 *  the cup's own axis for the pen cup (whichever pen or wall was tapped, the cup answers about
 *  its axis — its claims are a cylinder and five capsules now, not one box with a centre). */
const ROCKER_CENTERS = new Map<ZoneId, readonly [number, number, number]>([
  ...DESK_NUDGE_ZONES.filter((z) => z.kind !== 'pencup').map(
    (z) =>
      [
        z.kind as ZoneId,
        [
          (z.min[0] + z.max[0]) / 2,
          (z.min[1] + z.max[1]) / 2,
          (z.min[2] + z.max[2]) / 2,
        ] as const,
      ] as const
  ),
  [
    'pencup' as ZoneId,
    [PENCUP_BODY.centre[0], (PENCUP_BODY.yMin + PENCUP_BODY.yMax) / 2, PENCUP_BODY.centre[1]] as const,
  ] as const,
])

export function DeskInteractions({ journeyRef }: { journeyRef: JourneyRef }) {
  const reduced = usePrefersReducedMotion()
  const fine = useFinePointer()

  /** Latest pointer, as NDC. `has` false ⇒ the pointer left the window (or never arrived). */
  const pointer = useRef({ x: 0, y: 0, has: false })
  /** One pending tap per frame is plenty — a double-click lands as two frames' taps anyway. */
  const tap = useRef<{ x: number; y: number } | null>(null)

  /** One state per signature; the rockers share a machine, the rest have their own. */
  const rocks = useRef<Record<'mug' | 'pencup' | 'bird' | 'penguin', NudgeSpring>>({
    mug: restingSpring(),
    pencup: restingSpring(),
    bird: restingSpring(),
    penguin: restingSpring(),
  })
  /** The ending's globe (T97 S1): the same rocker machine, the heaviest voice — see globe-nudge. */
  const globeSpring = useRef<NudgeSpring>(restingSpring())
  const squash = useRef<SquashSpring>(restingSquash())
  const rattle = useRef<RattleState>(restingRattle())
  const peck = useRef<PeckState>(restingPeck())
  const press = useRef<NotePressState>(restingPress())
  /** The sculpting station's five voices (T97 S2/S3): two bar slots, two chip slots, the tree's
   *  sway, the knife's teeter, the case's pop — all closed forms in desk-station.ts. */
  const scoots = useRef<ScootState>(restingScoot())
  const chips = useRef<ChipPressState>(restingChipPress())
  const treeSway = useRef<NudgeSpring>(restingTreeSway())
  const teeter = useRef<TeeterState>(restingTeeter())
  const casePop = useRef<CasePopState>(restingCasePop())
  /** The module's own clock: advances only while armed, so a response is a pure function of the
   *  input sequence and never of how long the journey took (the law's determinism clause). */
  const clock = useRef(0)
  const armed = useRef(false)
  const hovered = useRef<ZoneId | null>(null)
  const cursorOwned = useRef(false)
  /** The last stir nudge consumed from the deep tier's mailbox (Task 92). */
  const lastStir = useRef(mugStirMail.seq)

  const raycaster = useRef(new THREE.Raycaster())
  const ndc = useRef(new THREE.Vector2())

  useEffect(() => {
    if (reduced) return
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const w = window.innerWidth
      const h = window.innerHeight
      if (!(w > 0) || !(h > 0)) return
      pointer.current.x = (e.clientX / w) * 2 - 1
      pointer.current.y = -((e.clientY / h) * 2 - 1)
      pointer.current.has = true
    }
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) pointer.current.has = false
    }
    const onBlur = () => {
      pointer.current.has = false
    }
    const onClick = (e: MouseEvent) => {
      const w = window.innerWidth
      const h = window.innerHeight
      if (!(w > 0) || !(h > 0)) return
      tap.current = { x: (e.clientX / w) * 2 - 1, y: -((e.clientY / h) * 2 - 1) }
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerout', onOut, { passive: true })
    window.addEventListener('blur', onBlur)
    window.addEventListener('click', onClick, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerout', onOut)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('click', onClick)
      pointer.current.has = false
      tap.current = null
    }
  }, [reduced])

  const setCursor = (on: boolean): void => {
    if (on === cursorOwned.current) return
    cursorOwned.current = on
    document.body.style.cursor = on ? 'pointer' : ''
  }
  useEffect(() => () => {
    if (cursorOwned.current) document.body.style.cursor = ''
  }, [])

  useFrame((state, dt) => {
    const nowArmed = !reduced && nudgeArmedFor(journeyRef.current.ending)
    if (nowArmed !== armed.current) {
      armed.current = nowArmed
      if (!nowArmed) {
        // Scroll-away, yeti-style: rest in the same frame, no unwind, and a fresh clock next time.
        for (const k of Object.keys(rocks.current) as (keyof typeof rocks.current)[]) {
          rocks.current[k] = restingSpring()
        }
        for (const k of Object.keys(NUDGE_UNIFORMS) as DeskNudgeKind[]) NUDGE_UNIFORMS[k].value.fill(0)
        globeSpring.current = restingSpring()
        GLOBE_UNIFORM.value.fill(0)
        squash.current = restingSquash()
        rattle.current = restingRattle()
        peck.current = restingPeck()
        press.current = restingPress()
        RATTLE_UNIFORM.value.fill(0)
        BEND_UNIFORM.value.fill(0)
        NOTE_CURL_UNIFORM.value = 1
        // ...and the station: all five voices to their resting constructors, all seven uniforms
        // to exact zero, in this same frame — the T89 disarm clause.
        scoots.current = restingScoot()
        chips.current = restingChipPress()
        treeSway.current = restingTreeSway()
        teeter.current = restingTeeter()
        casePop.current = restingCasePop()
        for (const u of Object.values(STATION_UNIFORMS)) u.value.fill(0)
        clock.current = 0
        hovered.current = null
        tap.current = null
        // a stir posted the frame the gate shut must not fire as a phantom nudge on re-arm
        lastStir.current = mugStirMail.seq
        setCursor(false)
      }
    }
    if (!nowArmed) return
    clock.current += dt
    const now = clock.current

    const cam = state.camera
    const heightPx = state.size.height

    /** One resolver owns every claim (desk-station's `resolveDeskPick` — T89 boxes, note,
     *  station primitives, pens, cup cylinder, globe, lane precedence, surface-beats-pad).
     *  This wrapper only builds the ray from the camera and narrows the id. */
    const pick = (x: number, y: number): Hit | null => {
      ndc.current.set(x, y)
      raycaster.current.setFromCamera(ndc.current, cam)
      const o = raycaster.current.ray.origin
      const d = raycaster.current.ray.direction
      const best = resolveDeskPick(
        o.x, o.y, o.z, d.x, d.y, d.z,
        (cam as THREE.PerspectiveCamera).fov, heightPx
      )
      return best === null ? null : { id: best.id as ZoneId, t: best.t, point: best.point }
    }

    /** Each object answers in its own voice — the dispatch IS the signature list. */
    const fwd: [number, number] = [0, 0]
    const dirTmp = raycaster.current.ray.direction
    const fire = (hit: Hit, strength: number) => {
      const station = STATION_LOOKUP.get(hit.id)
      if (station) {
        // The station's five voices (T97 S2/S3) — one distinct mechanism per sibling.
        switch (station.kind) {
          case 'bar': {
            // The LANE bar's CLICK is the deep tier's (the roll); its hover still scoots — the
            // shiver that advertises the set piece. Every other bar answers both.
            if (station.index === LANE_BAR_INDEX && strength >= 1) return
            const sign = scootSignFrom(hit.point, STATION_BARS[station.index].centre)
            triggerScoot(scoots.current, now, station.index, sign, strength)
            return
          }
          case 'chip':
            triggerChipPress(chips.current, now, station.index, strength)
            return
          case 'tree': {
            fwd[0] = dirTmp.x
            fwd[1] = dirTmp.z
            const [dx, dz] = tipDirFrom(
              hit.point,
              [STATION_TREE.base[0], 0, STATION_TREE.base[1]],
              fwd
            )
            triggerTreeSway(treeSway.current, now, dx, dz, strength)
            return
          }
          case 'knife':
            triggerTeeter(teeter.current, now, teeterSignFrom(hit.point), strength)
            return
          case 'case':
            triggerCasePop(casePop.current, now, strength)
            return
        }
      }
      switch (hit.id) {
        case 'note':
          triggerPress(press.current, now, strength >= 1 ? PRESS_CLICK : PRESS_HOVER)
          return
        case 'donut':
          // jelly: direction ignored, it squashes the same for every finger
          triggerSquash(squash.current, now, strength)
          return
        case 'bird':
          // a bird pecks the way it faces; the body takes a whisper of recoil
          triggerPeck(peck.current, now, strength)
          triggerRock(rocks.current.bird, ROCK_PARAMS.bird!, now, 0, 1, strength)
          return
        case 'globe': {
          // the ending's centrepiece, nudged in its cradle (T97 S1) — the rocker convention
          // exactly, about the world's own centre, through the globe's hard-capped trigger
          // (the T90 shading ceiling — see globe-nudge.ts). Its own case: the default arm
          // indexes ROCK_PARAMS/NUDGE_UNIFORMS by kind, and 'globe' is not a desk kind.
          fwd[0] = dirTmp.x
          fwd[1] = dirTmp.z
          const [dx, dz] = tipDirFrom(hit.point, [0, 0, 0], fwd)
          triggerGlobeRock(globeSpring.current, now, dx, dz, strength)
          return
        }
        default: {
          const center = ROCKER_CENTERS.get(hit.id)
          if (!center) return
          fwd[0] = dirTmp.x
          fwd[1] = dirTmp.z
          const [dx, dz] = tipDirFrom(hit.point, center, fwd)
          const kind = hit.id as 'mug' | 'pencup' | 'penguin'
          triggerRock(rocks.current[kind], ROCK_PARAMS[kind]!, now, dx, dz, strength)
          if (kind === 'pencup') triggerRattle(rattle.current, now, strength)
          if (kind === 'mug') {
            // the clink reaches the plume — a stamped impulse on the steam's own clock
            steamKickMail.seq += 1
            steamKickMail.dirX = dx
            steamKickMail.dirZ = dz
            steamKickMail.amp = strength
          }
        }
      }
    }

    // HOVER — a crossing is a brush. Only a hovering pointer gets one, and only on the transition.
    if (fine && pointer.current.has) {
      const hit = pick(pointer.current.x, pointer.current.y)
      const id = hit?.id ?? null
      if (id !== hovered.current) {
        hovered.current = id
        if (hit) fire(hit, HOVER_SCALE)
      }
      // The notebook and the watering can have no micro zones — their clicks belong to the deep
      // tier (Task 92) — but the cursor's promise is this component's to keep, so both count.
      const o = raycaster.current.ray.origin
      const d = raycaster.current.ray.direction
      const fovNow = (cam as THREE.PerspectiveCamera).fov
      const overDeep =
        id === null &&
        (bookRayHit(o.x, o.y, o.z, d.x, d.y, d.z, fovNow, heightPx) !== null ||
          canRayHit(o.x, o.y, o.z, d.x, d.y, d.z, fovNow, heightPx) !== null ||
          laneRayHit(o.x, o.y, o.z, d.x, d.y, d.z, fovNow, heightPx) !== null)
      setCursor(id !== null || overDeep)
    } else {
      hovered.current = null
      setCursor(false)
    }

    // TAP/CLICK — the full response, any pointer kind. ONE precedence rule with the deep tier
    // (Task 92): a tap whose ray crosses the coffee's slab belongs to the stir, not the mug —
    // both tiers ask the same `coffeeRayHit`, so they cannot disagree about whose click it was.
    // The mug still answers (a low-strength nudge arrives through `mugStirMail` below); it just
    // does not full-rock over the set piece.
    if (tap.current) {
      const hit = pick(tap.current.x, tap.current.y)
      tap.current = null
      if (hit) {
        const o = raycaster.current.ray.origin
        const d = raycaster.current.ray.direction
        const deepClaimed =
          hit.id === 'mug' &&
          coffeeRayHit(o.x, o.y, o.z, d.x, d.y, d.z, (cam as THREE.PerspectiveCamera).fov, heightPx) !== null
        // ...and the lane's twin rule (T97 S2/S3): a click whose ray crosses the lane's claim
        // belongs to the deep tier's roll even when the nearest STATION zone is a neighbouring
        // bar (the red bar's box overlaps the lane's) — suppress the scoot, let the roll answer.
        // Both tiers ask the same `laneRayHit`, so they cannot disagree about whose click it was.
        const laneClaimed =
          STATION_LOOKUP.get(hit.id)?.kind === 'bar' &&
          laneRayHit(o.x, o.y, o.z, d.x, d.y, d.z, (cam as THREE.PerspectiveCamera).fov, heightPx) !== null
        if (!deepClaimed && !laneClaimed) fire(hit, 1)
      }
    }

    // The stir's mug nudge (Task 92): posted by the deep tier, stamped here where the mug's
    // spring lives — the steam mailbox pattern, one tier's clock never reaching the other's.
    if (mugStirMail.seq !== lastStir.current) {
      lastStir.current = mugStirMail.seq
      triggerRock(rocks.current.mug, ROCK_PARAMS.mug!, now, mugStirMail.dirX, mugStirMail.dirZ, mugStirMail.amp)
    }

    // Drive every signature; each settles to its own exact rest (see desk-nudge.ts samplers).
    for (const k of ['mug', 'pencup', 'bird', 'penguin'] as const) {
      sampleRock(rocks.current[k], ROCK_PARAMS[k]!, now, NUDGE_UNIFORMS[k].value)
    }
    sampleRock(globeSpring.current, GLOBE_ROCK, now, GLOBE_UNIFORM.value)
    NUDGE_UNIFORMS.donut.value[3] = sampleSquash(squash.current, now)
    // The pens' clatter: two shared waveforms, five voices (T100). Both components are written by
    // one call, and both snap to +0 together — see desk-pens.ts.
    sampleRattle(rattle.current, now, RATTLE_UNIFORM.value)
    BEND_UNIFORM.value[0] = samplePeck(peck.current, now)
    NOTE_CURL_UNIFORM.value = samplePress(press.current, now)
    // ...and the station's seven uniforms, each sampler snapping its own exact +0 at rest.
    sampleScoot(scoots.current, now, STATION_UNIFORMS.uStBar0.value, STATION_UNIFORMS.uStBar1.value)
    sampleChipPress(chips.current, now, STATION_UNIFORMS.uStChip0.value, STATION_UNIFORMS.uStChip1.value)
    sampleTreeSway(treeSway.current, now, STATION_UNIFORMS.uStTree.value)
    sampleTeeter(teeter.current, now, STATION_UNIFORMS.uStKnife.value)
    sampleCasePop(casePop.current, now, STATION_UNIFORMS.uStCase.value)
  })

  return null
}
