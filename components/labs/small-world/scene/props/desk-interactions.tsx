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
  NOTE_CORNER_ZONE,
  NOTE_CURL_UNIFORM,
  NUDGE_UNIFORMS,
  PRESS_CLICK,
  PRESS_HOVER,
  RATTLE_UNIFORM,
  ROCK_PARAMS,
  hitPadFor,
  nudgeArmedFor,
  rayBoxHit,
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

/**
 * THE POINTER'S HANDS (Task 89) — the plumbing that turns pointer events into the responses
 * `desk-nudge.ts` defines. That module carries the law, the six signatures and every number; this
 * file only listens, raycasts, dispatches per kind and writes uniforms. Nothing here allocates
 * after mount and nothing renders: the component returns null and the desk's own materials do the
 * moving.
 *
 * HIT-TESTING is analytic — the zone boxes from the contract against the camera ray, six slab
 * tests once per frame on the latest pointer position — because the desk is a merged bake with no
 * per-object meshes to raycast (see `DESK_NUDGE_ZONES`), and because an interaction list of
 * invisible colliders would be six scene objects doing the job of one function. The same boxes
 * are inflated to a 44 px minimum effective target at their own depth, the phone's tap floor and
 * a no-op on desktop.
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

type ZoneId = DeskNudgeKind | 'note'

type Hit = { id: ZoneId; t: number; point: [number, number, number] }

const ZONES = DESK_NUDGE_ZONES.map((z) => ({
  id: z.kind as ZoneId,
  min: z.min,
  max: z.max,
  center: [(z.min[0] + z.max[0]) / 2, (z.min[1] + z.max[1]) / 2, (z.min[2] + z.max[2]) / 2] as const,
  minExtent: Math.min(z.max[0] - z.min[0], z.max[1] - z.min[1], z.max[2] - z.min[2]),
}))
const NOTE_ZONE = {
  id: 'note' as ZoneId,
  min: NOTE_CORNER_ZONE.min,
  max: NOTE_CORNER_ZONE.max,
  center: [
    (NOTE_CORNER_ZONE.min[0] + NOTE_CORNER_ZONE.max[0]) / 2,
    (NOTE_CORNER_ZONE.min[1] + NOTE_CORNER_ZONE.max[1]) / 2,
    (NOTE_CORNER_ZONE.min[2] + NOTE_CORNER_ZONE.max[2]) / 2,
  ] as const,
  minExtent: Math.min(
    NOTE_CORNER_ZONE.max[0] - NOTE_CORNER_ZONE.min[0],
    NOTE_CORNER_ZONE.max[1] - NOTE_CORNER_ZONE.min[1],
    NOTE_CORNER_ZONE.max[2] - NOTE_CORNER_ZONE.min[2]
  ),
}
const ALL_ZONES = [...ZONES, NOTE_ZONE]

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
  const squash = useRef<SquashSpring>(restingSquash())
  const rattle = useRef<RattleState>(restingRattle())
  const peck = useRef<PeckState>(restingPeck())
  const press = useRef<NotePressState>(restingPress())
  /** The module's own clock: advances only while armed, so a response is a pure function of the
   *  input sequence and never of how long the journey took (the law's determinism clause). */
  const clock = useRef(0)
  const armed = useRef(false)
  const hovered = useRef<ZoneId | null>(null)
  const cursorOwned = useRef(false)

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
        squash.current = restingSquash()
        rattle.current = restingRattle()
        peck.current = restingPeck()
        press.current = restingPress()
        RATTLE_UNIFORM.value.fill(0)
        BEND_UNIFORM.value.fill(0)
        NOTE_CURL_UNIFORM.value = 1
        clock.current = 0
        hovered.current = null
        tap.current = null
        setCursor(false)
      }
    }
    if (!nowArmed) return
    clock.current += dt
    const now = clock.current

    const cam = state.camera
    const heightPx = state.size.height

    /** The nearest zone under an NDC position, boxes inflated to the 44 px floor. */
    const pick = (x: number, y: number): Hit | null => {
      ndc.current.set(x, y)
      raycaster.current.setFromCamera(ndc.current, cam)
      const o = raycaster.current.ray.origin
      const d = raycaster.current.ray.direction
      let best: Hit | null = null
      for (const z of ALL_ZONES) {
        const dist = Math.hypot(z.center[0] - o.x, z.center[1] - o.y, z.center[2] - o.z)
        const pad = hitPadFor(z.minExtent, dist, (cam as THREE.PerspectiveCamera).fov, heightPx)
        const min: [number, number, number] = [z.min[0] - pad, z.min[1] - pad, z.min[2] - pad]
        const max: [number, number, number] = [z.max[0] + pad, z.max[1] + pad, z.max[2] + pad]
        const t = rayBoxHit(o.x, o.y, o.z, d.x, d.y, d.z, min, max)
        if (t !== null && (best === null || t < best.t)) {
          best = { id: z.id, t, point: [o.x + d.x * t, o.y + d.y * t, o.z + d.z * t] }
        }
      }
      return best
    }

    /** Each object answers in its own voice — the dispatch IS the signature list. */
    const fwd: [number, number] = [0, 0]
    const dirTmp = raycaster.current.ray.direction
    const fire = (hit: Hit, strength: number) => {
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
        default: {
          const zone = ZONES.find((z) => z.id === hit.id)
          if (!zone) return
          fwd[0] = dirTmp.x
          fwd[1] = dirTmp.z
          const [dx, dz] = tipDirFrom(hit.point, zone.center as unknown as [number, number, number], fwd)
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
      setCursor(id !== null)
    } else {
      hovered.current = null
      setCursor(false)
    }

    // TAP/CLICK — the full response, any pointer kind.
    if (tap.current) {
      const hit = pick(tap.current.x, tap.current.y)
      tap.current = null
      if (hit) fire(hit, 1)
    }

    // Drive every signature; each settles to its own exact rest (see desk-nudge.ts samplers).
    for (const k of ['mug', 'pencup', 'bird', 'penguin'] as const) {
      sampleRock(rocks.current[k], ROCK_PARAMS[k]!, now, NUDGE_UNIFORMS[k].value)
    }
    NUDGE_UNIFORMS.donut.value[3] = sampleSquash(squash.current, now)
    RATTLE_UNIFORM.value[0] = sampleRattle(rattle.current, now)
    RATTLE_UNIFORM.value[1] = now
    BEND_UNIFORM.value[0] = samplePeck(peck.current, now)
    NOTE_CURL_UNIFORM.value = samplePress(press.current, now)
  })

  return null
}
