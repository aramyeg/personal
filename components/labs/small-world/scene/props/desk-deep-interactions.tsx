'use client'
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { JourneyRef } from '../use-journey'
import { usePrefersReducedMotion } from '../use-reduced-motion'
import { nudgeArmedFor, steamKickMail, tipDirFrom } from './desk-nudge'
import {
  COFFEE_ZONE,
  STIR,
  STIR_UNIFORM,
  coffeeRayHit,
  mugStirMail,
  restingStir,
  sampleStir,
  triggerStir,
  type StirState,
} from './desk-deep'

/**
 * THE DEEP TIER'S HANDS (Task 92) — the plumbing that turns pointer events into the set-piece
 * responses `desk-deep.ts` defines. Same shape as `desk-interactions.tsx`, deliberately: its own
 * click listener, its own armed clock (advancing only while the studio is fully lit, reset to zero
 * on disarm in the same frame), analytic hit tests against the pure module's zones, uniforms
 * written from closed forms. Renders nothing, allocates nothing after mount.
 *
 * The deep tier is CLICK-ONLY: hovers belong to the micro tier, whose brushes already advertise
 * every prop (and whose mug zone covers the liquid, so the cursor over the coffee is already a
 * pointer). A set piece is a deliberate act, and asking for a click is how the desk says so.
 *
 * PRECEDENCE: `desk-interactions.tsx` skips its mug tap when the same ray crosses the liquid's
 * slab (both tiers call the one `coffeeRayHit`), and this component answers instead — the stir,
 * a low-strength mug nudge through `mugStirMail`, and a strong stamp on the steam's mailbox.
 * Reduced motion: inert, no listener, uniform stays zero — end state IS rest state.
 */
export function DeskDeepInteractions({ journeyRef }: { journeyRef: JourneyRef }) {
  const reduced = usePrefersReducedMotion()

  const tap = useRef<{ x: number; y: number } | null>(null)
  const stir = useRef<StirState>(restingStir())
  const clock = useRef(0)
  const armed = useRef(false)

  const raycaster = useRef(new THREE.Raycaster())
  const ndc = useRef(new THREE.Vector2())

  useEffect(() => {
    if (reduced) return
    const onClick = (e: MouseEvent) => {
      const w = window.innerWidth
      const h = window.innerHeight
      if (!(w > 0) || !(h > 0)) return
      tap.current = { x: (e.clientX / w) * 2 - 1, y: -((e.clientY / h) * 2 - 1) }
    }
    window.addEventListener('click', onClick, { passive: true })
    return () => {
      window.removeEventListener('click', onClick)
      tap.current = null
    }
  }, [reduced])

  useFrame((state, dt) => {
    const nowArmed = !reduced && nudgeArmedFor(journeyRef.current.ending)
    if (nowArmed !== armed.current) {
      armed.current = nowArmed
      if (!nowArmed) {
        // Scroll-away: rest in the same frame — closed forms have no unwind to run.
        stir.current = restingStir()
        STIR_UNIFORM.value.fill(0)
        clock.current = 0
        tap.current = null
      }
    }
    if (!nowArmed) return
    // The micro tier's armed-clock discipline: a response is a pure function of the input
    // sequence, never of how long the journey took.
    clock.current += dt
    const now = clock.current

    if (tap.current) {
      ndc.current.set(tap.current.x, tap.current.y)
      tap.current = null
      raycaster.current.setFromCamera(ndc.current, state.camera)
      const o = raycaster.current.ray.origin
      const d = raycaster.current.ray.direction
      const hit = coffeeRayHit(
        o.x,
        o.y,
        o.z,
        d.x,
        d.y,
        d.z,
        (state.camera as THREE.PerspectiveCamera).fov,
        state.size.height
      )
      if (hit) {
        triggerStir(stir.current, now, 1)
        // The cup answers the spoon: a low-strength micro rock, posted to the tier that owns the
        // mug's spring; direction away from the poked side, exactly as a direct mug tap computes it.
        const [dx, dz] = tipDirFrom(
          hit.point,
          [COFFEE_ZONE.center[0], (COFFEE_ZONE.min[1] + COFFEE_ZONE.max[1]) / 2, COFFEE_ZONE.center[1]],
          [d.x, d.z]
        )
        mugStirMail.seq += 1
        mugStirMail.dirX = dx
        mugStirMail.dirZ = dz
        mugStirMail.amp = STIR.mugNudge
        // ...and the plume answers the swirl, on the steam's own clock — a strong stamp.
        steamKickMail.seq += 1
        steamKickMail.dirX = dx
        steamKickMail.dirZ = dz
        steamKickMail.amp = STIR.steamAmp
      }
    }

    sampleStir(stir.current, now, STIR_UNIFORM.value)
  })

  return null
}
