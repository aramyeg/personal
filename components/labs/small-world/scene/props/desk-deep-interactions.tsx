'use client'
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { JourneyRef } from '../use-journey'
import { usePrefersReducedMotion } from '../use-reduced-motion'
import { nudgeArmedFor, steamKickMail, tipDirFrom } from './desk-nudge'
import {
  BOOK_UNIFORM,
  COFFEE_ZONE,
  STIR,
  STIR_UNIFORM,
  WATER_UNIFORM,
  bookRayHit,
  canRayHit,
  coffeeRayHit,
  deepClipMail,
  mugStirMail,
  restingBook,
  restingStir,
  restingWater,
  sampleBook,
  sampleStir,
  sampleWater,
  triggerBook,
  triggerStir,
  triggerWater,
  type BookState,
  type StirState,
  type WaterState,
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
  const book = useRef<BookState>(restingBook())
  const water = useRef<WaterState>(restingWater())
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
        book.current = restingBook()
        water.current = restingWater()
        STIR_UNIFORM.value.fill(0)
        BOOK_UNIFORM.value.fill(0)
        WATER_UNIFORM.value.fill(0)
        deepClipMail.water = 0
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
      const fov = (state.camera as THREE.PerspectiveCamera).fov
      const hit = coffeeRayHit(o.x, o.y, o.z, d.x, d.y, d.z, fov, state.size.height)
      if (bookRayHit(o.x, o.y, o.z, d.x, d.y, d.z, fov, state.size.height)) {
        // the notebook: the cover opens on its spring; mid-arc clicks are absorbed
        triggerBook(book.current, now)
      }
      if (canRayHit(o.x, o.y, o.z, d.x, d.y, d.z, fov, state.size.height)) {
        // the watering: the can lifts, tips, and the plant answers; mid-arc clicks are absorbed
        triggerWater(water.current, now)
      }
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
    BOOK_UNIFORM.value[0] = sampleBook(book.current, now)
    // The pour's clip time goes out by MAIL rather than uniform — the paused action lives with
    // the meshes in desk-glb.tsx; the perk envelope rides the uniform like every other field.
    deepClipMail.water = sampleWater(water.current, now, WATER_UNIFORM.value)
  })

  return null
}
