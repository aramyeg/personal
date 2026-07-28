'use client'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { PALETTE } from '../palette'
import { PLANET_RADIUS } from './planet'
import { STANCE_Z, walkYAt } from './stage'
import { useClayRamp } from './toon-ramp'
import { toonifyGirl } from './girl-clay'
import {
  nextTimeScale,
  resolveClipPlan,
  resolveLocomotionHysteretic,
  selectCelebrateClip,
  shouldTriggerCelebrate,
  shouldYieldCelebrate,
  speedToTimeScale,
  type ClipPlan,
  type Locomotion,
  type SlotPlan,
} from './girl-anim'
import type { JourneyRef } from './use-journey'

const GIRL_URL = '/labs/small-world/girl.glb'
/** Mesh is 1.7 units tall. 0.53 matched the old ~0.9u proxy; raised per
 * Aram's Gate-2 note — she should command the planet, not decorate it. */
const GIRL_SCALE = 0.7
/** Surface distance one skip-cycle covers at timeScale 1 — tune to the clip. */
const CLIP_STRIDE = 1.0
/** Damping rate for the skip cadence timeScale so it eases rather than snaps to
 * speed changes. */
const DAMP_LAMBDA = 6
/** Skip cadence band. The floor is the pre-T28 keep-alive: during dwell she
 * skips slowly in place (never freezes, never T-poses); the ceiling stops a fast
 * fling running away. A real Idle clip loops at its own rate, ignoring this. */
const MIN_TIMESCALE = 0.12
const MAX_TIMESCALE = 2.5
/** Idle↔moving hysteresis (signed surface speed, world u/s). She must exceed
 * IDLE_MOVE_EPS to leave the idle loop, and drop to/under IDLE_REST_EPS to settle
 * back — the gap keeps a speed hovering near rest from flickering her between the
 * idle sway and a locomotion step frame-to-frame (the T28 M3 recommendation, now
 * that real clips distinguish the states). Panel windows freeze rotation, so a
 * dwell collapses well under IDLE_REST_EPS. */
const IDLE_REST_EPS = 0.03
const IDLE_MOVE_EPS = 0.06
/** AnimationMixer crossfade between distinct clips (Idle ↔ Skip_Forward ↔
 * Walk_Backward ↔ the jump celebrate). Same-clip transitions just re-drive params. */
const CROSSFADE = 0.25
/** Hand-back fade when travel interrupts a celebrate mid-air (T52). Shorter than
 * CROSSFADE: the reader has just resumed scrolling and the world is already
 * moving, so the skip has to be under her the moment it does. */
const CELEBRATE_YIELD_FADE = 0.12
/** Facet her toon surface to match the faceted clay world (lever 4). Off by
 *  default — capture-gated against face/hair readability; kept as a one-line
 *  dial. See task-24-report for the tried-and-rejected finding. */
const GIRL_FLAT_SHADING = false
/** Contact-shadow blob, retuned to the ramp floor: a warm-ink pool (not pure
 * ink) at the darkest-band feel, sized so she sits grounded like the props. */
const SHADOW_RADIUS = 0.32
const SHADOW_OPACITY = 0.26

/**
 * Drive the active locomotion action. A real Idle clip (a resolved, non-fallback
 * idle slot) loops at its natural rate. Everything else — forward/backward
 * travel AND the idle fallback — is the shipped forward skip, its cadence eased
 * from |speed| toward the clamped band; the MIN_TIMESCALE floor keeps a dwell
 * skipping slowly in place instead of freezing. The action never stops → the
 * mixer always has an active clip (no T-pose). No reversed playback: a backward
 * scrub just plays the forward skip while the planet spins the other way.
 *
 * `entering` marks the first frame of a locomotion stretch — after an idle sway
 * or an interrupted celebrate — where the cadence is seeded straight from the
 * demanded speed instead of easing out of a stale held value.
 */
function driveLocomotion(
  action: THREE.AnimationAction,
  loco: Locomotion,
  slot: SlotPlan,
  signedSpeed: number,
  tsMagRef: { current: number },
  delta: number,
  entering: boolean
): void {
  action.paused = false
  if (loco === 'idle' && !slot.fallback) {
    action.timeScale = 1
    tsMagRef.current = 1
    return
  }
  const target = speedToTimeScale(
    Math.abs(signedSpeed),
    CLIP_STRIDE,
    MIN_TIMESCALE,
    MAX_TIMESCALE
  )
  tsMagRef.current = nextTimeScale(tsMagRef.current, target, entering, DAMP_LAMBDA, delta)
  action.timeScale = tsMagRef.current
}

/**
 * Real GLB girl — rendered only behind `hasArt('girl')` (see scene.tsx), so
 * this module's useGLTF call never fires while the asset is absent. Ground
 * contact ONLY: the clip carries the hop, this just follows surfaceYAt at
 * STANCE_Z (same fixed-character contract as GirlProxy — group never moves
 * in x/z, only the planet spins beneath it).
 *
 * Journey-state animation machine: signed scroll speed selects Forward /
 * Backward / Idle (girl-anim.ts), a discovery burst fires a one-shot Celebrate
 * when a clip exists (else the DiscoveryBurst badge alone). Missing clips
 * degrade onto the one shipped skip clip so the mixer is never empty.
 */
export function Girl({ journeyRef }: { journeyRef: JourneyRef }) {
  const group = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const ramp = useClayRamp()
  const { scene, animations } = useGLTF(GIRL_URL)
  const { actions, mixer } = useAnimations(animations, group)
  const lastRotation = useRef<number | null>(null)
  const tsMag = useRef(MIN_TIMESCALE)
  const prevBurst = useRef<number | null>(null)
  const activeClip = useRef<string | null>(null)
  const celebrating = useRef(false)
  /** Last resolved locomotion state — feeds the idle↔moving hysteresis band. It
   * advances every frame, celebrate or not, so the machine is current the moment
   * travel reclaims the mixer (and so a finishing jump returns to the state she
   * is actually in, not the one she left three seconds ago). */
  const prevLoco = useRef<Locomotion>('idle')
  /** Locomotion state currently driving the mixer — null while a celebrate owns
   * it. A change here is the "entering" edge that seeds the skip cadence. */
  const drivingLoco = useRef<Locomotion | null>(null)
  /** Ordinal of discoveries seen — alternates Jump_A/Jump_B on the celebrate cycle. */
  const celebrateIndex = useRef(0)

  const plan: ClipPlan = useMemo(
    () => resolveClipPlan(animations.map((a) => a.name)),
    [animations]
  )

  // Blend her into the clay world once, before first paint: shared toon ramp +
  // pastel texture grade, dropping the GLB's fullbright emissive. Idempotent.
  useMemo(() => toonifyGirl(scene, ramp, GIRL_FLAT_SHADING), [scene, ramp])

  // Crossfade to a target clip's action, fading the current one out. Same-clip
  // targets just (re)play the shared action — no fade, no interruption.
  const fadeTo = useMemo(
    () =>
      (toClip: string, fade: number = CROSSFADE): THREE.AnimationAction | null => {
        const to = actions[toClip]
        if (!to) return null
        const from = activeClip.current ? actions[activeClip.current] : null
        if (from && from !== to) {
          from.fadeOut(fade)
          to.reset().setEffectiveWeight(1).fadeIn(fade).play()
        } else {
          to.play()
        }
        activeClip.current = toClip
        return to
      },
    [actions]
  )

  // Seed the mixer with the forward action before the first frame so there is
  // never a T-pose, and wire the celebrate one-shot's return crossfade.
  useEffect(() => {
    fadeTo(plan.forward.clip)
    // Only the celebrate one-shot uses LoopOnce; locomotion clips loop forever
    // and never fire 'finished', so the celebrating guard is sufficient.
    // A celebrate that runs to its end hands back to the state she is in NOW —
    // after a panel dwell that is the idle sway, not the skip she arrived on.
    const onFinished = () => {
      if (!celebrating.current) return
      celebrating.current = false
      fadeTo(plan[prevLoco.current].clip)
    }
    mixer.addEventListener('finished', onFinished)
    return () => mixer.removeEventListener('finished', onFinished)
  }, [fadeTo, mixer, plan])

  useFrame((_, delta) => {
    const { rotation, burst } = journeyRef.current
    const dt = Math.max(delta, 1e-6)
    const prev = lastRotation.current ?? rotation
    lastRotation.current = rotation
    const signedSpeed = ((rotation - prev) * PLANET_RADIUS) / dt

    // The locomotion state advances EVERY frame, celebrate or not — the machine
    // has to be current the instant travel reclaims the mixer.
    const loco: Locomotion = resolveLocomotionHysteretic(
      signedSpeed,
      prevLoco.current,
      IDLE_REST_EPS,
      IDLE_MOVE_EPS
    )
    prevLoco.current = loco

    // Travel outranks celebration. A jump still in the air when the reader
    // resumes scrolling gives the mixer straight back — checked BEFORE the
    // trigger below, so a jump firing on a still-travelling frame keeps that
    // first frame and only yields once the world is genuinely moving again.
    let fade = CROSSFADE
    if (shouldYieldCelebrate(celebrating.current, loco)) {
      celebrating.current = false
      fade = CELEBRATE_YIELD_FADE
    }

    // Celebrate one-shot: fire on the burst's rising edge when a clip exists.
    // Each discovery advances the cycle so his two jumps alternate on parity.
    if (shouldTriggerCelebrate(prevBurst.current, burst, plan.celebrate !== null)) {
      const clip = selectCelebrateClip(plan.celebrate, celebrateIndex.current)
      celebrateIndex.current += 1
      if (clip) {
        const action = fadeTo(clip)
        if (action) {
          action.setLoop(THREE.LoopOnce, 1)
          action.clampWhenFinished = true
          action.paused = false
          action.timeScale = 1
          celebrating.current = true
          drivingLoco.current = null
        }
      }
    }
    prevBurst.current = burst

    // While a celebrate owns the mixer, leave it to the clip (it returns via the
    // 'finished' listener, or by yielding above). Otherwise drive locomotion.
    if (!celebrating.current) {
      const slot = plan[loco]
      const action = fadeTo(slot.clip, fade)
      if (action) {
        driveLocomotion(action, loco, slot, signedSpeed, tsMag, dt, drivingLoco.current !== loco)
        drivingLoco.current = loco
      }
    }

    const groundY = walkYAt(STANCE_Z, rotation)
    if (group.current) {
      group.current.position.y = groundY
    }
    if (shadow.current) {
      shadow.current.position.y = groundY + 0.015
    }
  })

  return (
    <>
      <group ref={group} position={[0, PLANET_RADIUS, STANCE_Z]}>
        <primitive object={scene} scale={GIRL_SCALE} />
      </group>
      <mesh ref={shadow} position={[0, PLANET_RADIUS, STANCE_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[SHADOW_RADIUS, 24]} />
        <meshBasicMaterial color={PALETTE.shadowClay} transparent opacity={SHADOW_OPACITY} depthWrite={false} />
      </mesh>
    </>
  )
}
