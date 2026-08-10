'use client'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { PALETTE } from '../palette'
import { PLANET_RADIUS } from './planet'
import { STANCE_ALPHA, STANCE_Z, walkYAt } from './stage'
import { useClayRamp } from './toon-ramp'
import { toonifyGirl } from './girl-clay'
import {
  GIRL_DESK_SEAT_Y,
  GIRL_GLOBE_SCALE,
  girlPoseAt,
  jumpBlendAt,
  jumpClipFracAt,
  strideAt,
  type GirlPose,
} from './girl-exit'
import { usePrefersReducedMotion } from './use-reduced-motion'
import {
  BASE_STRIDE,
  initialGearState,
  nextTimeScale,
  resolveClipPlan,
  resolveLocomotionHysteretic,
  selectCelebrateClip,
  shouldTriggerCelebrate,
  shouldYieldCelebrate,
  speedToTimeScale,
  stepForwardGear,
  type ClipPlan,
  type GearState,
  type Locomotion,
  type SlotPlan,
} from './girl-anim'
import type { JourneyRef } from './use-journey'

import { GIRL_URL } from './girl-url'
import { girlGlbHandoff } from '../loader/glb-handoff'

/** Prime three's cache with the loader shell's prefetched bytes BEFORE useGLTF
 *  ever asks, so the GLB crosses the wire exactly once (HTTP revalidation
 *  measurably re-downloads it — see glb-handoff.ts). Runs at chunk eval, which
 *  precedes any render of <Girl/>. FileLoader keys its cache as `file:${url}`
 *  (three r185) and wants the raw ArrayBuffer. Released in an effect below once
 *  the mesh is parsed, so the cache never grows past this one entry and the
 *  ~1.5MB buffer is freed. */
if (girlGlbHandoff.buffer) {
  THREE.Cache.enabled = true
  THREE.Cache.add(`file:${GIRL_URL}`, girlGlbHandoff.buffer)
}

/** Mesh is 1.7 units tall. 0.53 matched the old ~0.9u proxy; raised per
 * Aram's Gate-2 note — she should command the planet, not decorate it.
 * Lives in `girl-exit.ts` now that the ending gives her a second one. */
const GIRL_SCALE = GIRL_GLOBE_SCALE
/** Surface distance one clip-cycle covers at timeScale 1. Forward travel now
 * carries a stride PER GEAR (girl-anim's FORWARD_GEARS); this is the value the
 * ungeared states — backward step, idle keep-alive — measure against, and it is
 * the pre-T110 number for all of them. */
const CLIP_STRIDE = BASE_STRIDE
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
/** How much flight lift fully thins her contact pool (T87) — about a body length
 * of air under her feet and the pool is gone, the way a jump shadow dies. */
const SHADOW_FADE_LIFT = 0.9
/** How far the contact pool floats off the ground it is drawn on, along that
 *  ground's own normal — enough to beat z-fighting on the planet's facets and on
 *  the desk pad, small enough to read as contact. */
const SHADOW_LIFT = 0.015
/**
 * THE DESK NEEDS A DIFFERENT CONTACT POOL FROM THE PLANET (Task 76).
 *
 * The planet's pool is a hard-edged disc at 0.26, and on faceted snow at journey
 * scale it is invisible as an edge. On the desk it is not: the pad is a smooth,
 * evenly lit baked surface, the studio fill has just come up, and a flat grey
 * ellipse under her reads as a plate she is standing on. Her two neighbours do not
 * have the problem because THEIR shadows are painted into the pad's bake — she is
 * the only figure on that desk that moves, so she is the only one that has to draw
 * its own.
 *
 * So the desk gets its own pool, with a radial falloff and a tighter radius, and the
 * planet's is left EXACTLY as it was — one mesh each rather than one mesh with a
 * property that changes, because swapping an `alphaMap` on a live material forces a
 * shader recompile mid-scroll. The second mesh costs one draw call and only while
 * she is on the desk; `visible = false` keeps it out of the render list otherwise.
 *
 * THE SIZE AND THE DEPTH ARE BOTH MEASURED, and the first cut got both wrong in a
 * way only a derived sample could show. A pool at 0.26 is SMALLER THAN SHE IS — she
 * is about 0.21 across at the shoes — so every part of it that carried any alpha was
 * underneath her, and a ring sampled just outside her silhouette read 4.9% BRIGHTER
 * than bare pad. (A hand-placed pixel box read brighter too, for the different and
 * worse reason that it was sitting on her white trainers. Both numbers are in the
 * report as the wrong ones.)
 *
 * The target is the pool her neighbours already have. Measured on the shipped bake
 * through a ring derived from the penguin's own base radius, its painted shadow
 * runs **27.8% darker** than bare pad over r ∈ [1.05, 1.5] of that base. So hers is
 * sized to reach past her feet the same way and levelled to land in the same place.
 * `bench/shadow` re-measures both from the render.
 */
const DESK_SHADOW_RADIUS = 0.4
const DESK_SHADOW_OPACITY = 0.38
/** How much of the pool is solid core before the rim starts to fall away. A pure
 *  peak-at-the-centre ramp puts all its darkness where her body already hides it. */
const DESK_SHADOW_CORE = 0.45
/** Resolution of the falloff. 64 is already past the ~40 px the pool ever occupies. */
const FALLOFF_N = 64

/** A radial alpha ramp — solid to `DESK_SHADOW_CORE`, then smoothstepped to nothing
 *  at the rim. Shared by every instance. three's `alphamap_fragment` reads the GREEN
 *  channel, so the ramp is written to all four rather than to red alone: a
 *  `RedFormat` texture samples green as 0 and erases the pool entirely. */
function buildShadowFalloff(): THREE.DataTexture {
  const data = new Uint8Array(FALLOFF_N * FALLOFF_N * 4)
  for (let y = 0; y < FALLOFF_N; y++) {
    for (let x = 0; x < FALLOFF_N; x++) {
      const r = Math.min(
        1,
        2 * Math.hypot((x + 0.5) / FALLOFF_N - 0.5, (y + 0.5) / FALLOFF_N - 0.5)
      )
      const u =
        r <= DESK_SHADOW_CORE ? 1 : 1 - (r - DESK_SHADOW_CORE) / (1 - DESK_SHADOW_CORE)
      const v = Math.round(255 * u * u * (3 - 2 * u))
      const i = (y * FALLOFF_N + x) * 4
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = v
    }
  }
  const tex = new THREE.DataTexture(data, FALLOFF_N, FALLOFF_N, THREE.RGBAFormat)
  tex.needsUpdate = true
  return tex
}

/**
 * How many idle cycles her settled sway spends over the whole ending.
 *
 * She is scroll-driven from progress = 1 onward, so a settled idle CANNOT loop on
 * a clock without reopening the wall-clock exception the steam holds alone. Low
 * enough that the last stretch of scroll reads as breathing rather than as a
 * second walk.
 */
const ENDING_IDLE_CYCLES = 1.5

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
  entering: boolean,
  stride: number = CLIP_STRIDE
): void {
  action.paused = false
  if (loco === 'idle' && !slot.fallback) {
    action.timeScale = 1
    tsMagRef.current = 1
    return
  }
  const target = speedToTimeScale(
    Math.abs(signedSpeed),
    stride,
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
  const deskShadow = useRef<THREE.Mesh>(null)
  const ramp = useClayRamp()
  const { scene, animations } = useGLTF(GIRL_URL)
  const { actions, mixer } = useAnimations(animations, group)
  // The mesh is parsed (useGLTF resolved above), so release the prefetch
  // handoff: drop the cache entry, switch the global cache back off before any
  // later asset (desk.glb) could accumulate in it, and free the buffer.
  useEffect(() => {
    if (!girlGlbHandoff.buffer) return
    THREE.Cache.remove(`file:${GIRL_URL}`)
    THREE.Cache.enabled = false
    girlGlbHandoff.buffer = null
  }, [])
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
  /** Clip currently driving the mixer, so a GEAR change counts as an entering
   *  edge too — the state stays 'forward' across walk→run, but the cadence must
   *  still be seeded rather than eased out of the previous gear's value. */
  const drivingClip = useRef<string | null>(null)
  /** The forward gear chooser's memory (girl-anim's `stepForwardGear`): the gear
   *  driving the mixer, the averaged speed it was chosen from, and how long it
   *  has held. Kept across dwells and backward scrubs so resumed travel re-enters
   *  the gear she left, and stepped EVERY frame so the average is current when
   *  she starts moving again. */
  const gearState = useRef<GearState>(initialGearState())
  /** Ordinal of discoveries seen — alternates Jump_A/Jump_B on the celebrate cycle. */
  const celebrateIndex = useRef(0)
  const reduced = usePrefersReducedMotion()
  /** True while the ENDING owns the mixer: both locomotion actions paused, their
   *  times written from scroll and their weights blended by hand. */
  const endingOwned = useRef(false)
  /**
   * The clip phase the mixer happened to be on when the ending took over.
   *
   * Her stride is a pure function of distance walked, which starts at 0 — so
   * without this her legs would jump to the top of the cycle on the frame the
   * scroll crosses progress = 1. Latched once per entry and constant for the whole
   * visit, so scrubbing INSIDE the ending is still exactly reversible, which is the
   * property the ending's purity claim is actually about.
   */
  const phaseSeed = useRef(0)
  /** One scratch set for the frame path; nothing here allocates after mount. */
  const scratch = useMemo(
    () => ({
      tilt: new THREE.Quaternion(),
      /** The GROUND's own tilt at her bearing — the same thing as `tilt` for every
       *  grounded frame, and the thing her contact pool keeps following while the
       *  flight freezes hers (T101). */
      groundTilt: new THREE.Quaternion(),
      spin: new THREE.Quaternion(),
      flat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2),
      xAxis: new THREE.Vector3(1, 0, 0),
      yAxis: new THREE.Vector3(0, 1, 0),
      up: new THREE.Vector3(),
      ground: new THREE.Vector3(),
    }),
    []
  )

  const plan: ClipPlan = useMemo(
    () => resolveClipPlan(animations.map((a) => a.name)),
    [animations]
  )

  // Blend her into the clay world once, before first paint: shared toon ramp +
  // pastel texture grade, dropping the GLB's fullbright emissive. Idempotent.
  useMemo(() => toonifyGirl(scene, ramp, GIRL_FLAT_SHADING), [scene, ramp])

  const falloff = useMemo(buildShadowFalloff, [])
  useEffect(() => () => falloff.dispose(), [falloff])

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

  /**
   * THE ENDING DRIVES THE MIXER FROM SCROLL (Task 76).
   *
   * Both locomotion actions play at once, paused, with their times written from
   * `pose.walked` and `ending.t` and their weights blended by `pose.moving`. A
   * `crossFadeTo` could not be used: its blend is a wall clock, so a reader who
   * scrubbed back through the settle would find her half-faded into a pose she was
   * on her way out of. Weights that are a function of scroll un-blend exactly.
   */
  const driveEnding = (pose: GirlPose, t: number) => {
    const fwd = actions[plan.forward.clip] ?? null
    const idle = actions[plan.idle.clip] ?? null
    const jump = plan.exitJump ? (actions[plan.exitJump.clip] ?? null) : null
    const paired = idle !== null && idle !== fwd
    if (!endingOwned.current) {
      const dur = fwd ? fwd.getClip().duration : 0
      phaseSeed.current = fwd && dur > 0 ? fwd.time / dur : 0
      celebrating.current = false
      for (const name of Object.keys(actions)) actions[name]?.stop()
      fwd?.reset().play()
      if (paired) idle.reset().play()
      jump?.reset().play()
      endingOwned.current = true
    }
    // The exit jump owns the mixer for the flight (T87), on the same scroll-pure
    // terms as everything else here: its TIME is written from the flight phase
    // through `jumpClipFracAt` and its WEIGHT is `jumpBlendAt` — both pure in t,
    // so a backward scrub un-jumps her exactly. A GLB with no jump clip leaves
    // jw at 0 and she rides the skip/idle blend through the arc instead.
    const jw = jump ? jumpBlendAt(pose.jump) : 0
    if (fwd) {
      const dur = fwd.getClip().duration
      const phase = phaseSeed.current + pose.walked / strideAt(pose.scale)
      fwd.paused = true
      fwd.time = (((phase % 1) + 1) % 1) * dur
      fwd.setEffectiveWeight((paired ? pose.moving : 1) * (1 - jw))
    }
    if (paired) {
      const dur = idle.getClip().duration
      idle.paused = true
      idle.time = (((t * ENDING_IDLE_CYCLES) % 1 + 1) % 1) * dur
      idle.setEffectiveWeight((1 - pose.moving) * (1 - jw))
    }
    if (jump) {
      jump.paused = true
      jump.time = jumpClipFracAt(pose.jump) * jump.getClip().duration
      jump.setEffectiveWeight(jw)
    }
  }

  /** Hand the mixer back to the journey's own machine, exactly as it found it. */
  const releaseEnding = () => {
    for (const name of Object.keys(actions)) {
      const action = actions[name]
      if (!action) continue
      action.paused = false
      action.setEffectiveWeight(1)
      action.stop()
    }
    activeClip.current = null
    drivingLoco.current = null
    drivingClip.current = null
    prevLoco.current = 'idle'
    tsMag.current = MIN_TIMESCALE
    endingOwned.current = false
  }

  useFrame((_, delta) => {
    const { rotation, burst, ending } = journeyRef.current
    const pose = girlPoseAt(ending, reduced)

    // ---- the ending: she walks off the world and onto the desk --------------
    if (pose.stage !== 'journey') {
      driveEnding(pose, ending.t)
      if (group.current) {
        if (pose.stage === 'globe') {
          const zw = PLANET_RADIUS * Math.sin(pose.theta)
          const y = walkYAt(zw, rotation)
          // The flight's lift rides the surface normal at her bearing. `lift · c`
          // is +0 while she is grounded, so every walking frame is bit-identical
          // to what it was before the jump existed.
          const ny = Math.cos(pose.theta)
          const nz = Math.sin(pose.theta)
          group.current.position.set(0, y + pose.lift * ny, zw + pose.lift * nz)
          scratch.ground.set(0, y, zw)
          // Relative to the pose she holds on the planet, never absolute: she stands
          // UPRIGHT at STANCE_ALPHA today, so tilting to the surface normal would
          // move her on the ending's very first frame. This is exactly identity there.
          // HER lean is `pose.tilt` — frozen at the takeoff bearing once she is in
          // the air, because a body in flight carries no torque — while the ground
          // under her keeps turning with `pose.theta`, which is what her contact
          // pool lies on. The two are the same number for every grounded frame.
          scratch.tilt.setFromAxisAngle(scratch.xAxis, pose.tilt - STANCE_ALPHA)
          scratch.groundTilt.setFromAxisAngle(scratch.xAxis, pose.theta - STANCE_ALPHA)
          scratch.up.set(0, y, zw).normalize()
        } else {
          group.current.position.set(pose.x, GIRL_DESK_SEAT_Y, pose.z)
          scratch.ground.set(pose.x, GIRL_DESK_SEAT_Y, pose.z)
          scratch.tilt.identity()
          scratch.groundTilt.identity()
          scratch.up.set(0, 1, 0)
        }
        scratch.spin.setFromAxisAngle(scratch.yAxis, pose.yaw)
        group.current.quaternion.copy(scratch.tilt).multiply(scratch.spin)
        group.current.scale.setScalar(pose.scale / GIRL_SCALE)
        group.current.visible = pose.visible
        const onDesk = pose.stage === 'desk'
        // Her contact pool stays ON THE GROUND while she flies — a jump shadow —
        // and thins with height (pure in pose.lift, so a scrub restores it). It
        // follows the surface point under her arc, which the planet itself
        // occludes once that point passes the crest.
        if (shadow.current) {
          const mat = shadow.current.material as THREE.MeshBasicMaterial
          mat.opacity =
            SHADOW_OPACITY * (1 - Math.min(1, Math.abs(pose.lift) / SHADOW_FADE_LIFT))
        }
        // Two pools, one job each — see DESK_SHADOW_RADIUS. Exactly one is ever drawn.
        for (const [mesh, mine] of [
          [shadow.current, !onDesk],
          [deskShadow.current, onDesk],
        ] as const) {
          if (!mesh) continue
          mesh.visible = pose.visible && mine
          if (!mesh.visible) continue
          mesh.position.copy(scratch.ground).addScaledVector(scratch.up, SHADOW_LIFT)
          mesh.quaternion.copy(scratch.groundTilt).multiply(scratch.flat)
          mesh.scale.setScalar(pose.scale / GIRL_SCALE)
        }
      }
      return
    }
    if (deskShadow.current) deskShadow.current.visible = false
    if (endingOwned.current) releaseEnding()

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
      // Forward travel picks a GEAR from |speed| (T110); every other state keeps
      // the single slot it always had. The gear index advances only while
      // travelling forward, so a dwell or a backward scrub leaves her in the
      // gear she was last in and she resumes on it rather than restarting at a
      // walk.
      let slot: SlotPlan = plan[loco]
      let stride = CLIP_STRIDE
      gearState.current = stepForwardGear(
        gearState.current,
        Math.abs(signedSpeed),
        dt,
        loco === 'forward'
      )
      if (loco === 'forward') {
        const geared = plan.forwardGears[gearState.current.gear]
        slot = geared
        stride = geared.stride
      }
      const action = fadeTo(slot.clip, fade)
      if (action) {
        // Changing GEAR is as much an "entering" edge as changing state: easing
        // the cadence out of the walk's held timeScale into the run's would be
        // the same stale-value sluggishness `nextTimeScale` exists to prevent.
        const entering = drivingLoco.current !== loco || drivingClip.current !== slot.clip
        driveLocomotion(action, loco, slot, signedSpeed, tsMag, dt, entering, stride)
        drivingLoco.current = loco
        drivingClip.current = slot.clip
      }
    }

    // Ground contact. Written in FULL rather than as `position.y` alone, because a
    // scrub back out of the ending has to undo everything the ending wrote — an
    // ending that only moved her y would leave her standing on the desk's x.
    const groundY = walkYAt(STANCE_Z, rotation)
    if (group.current) {
      group.current.position.set(0, groundY, STANCE_Z)
      group.current.quaternion.identity()
      group.current.scale.setScalar(1)
      group.current.visible = true
    }
    if (shadow.current) {
      shadow.current.position.set(0, groundY + SHADOW_LIFT, STANCE_Z)
      shadow.current.quaternion.copy(scratch.flat)
      shadow.current.scale.setScalar(1)
      shadow.current.visible = true
      // Undo the flight's thinning on the way back into the journey.
      ;(shadow.current.material as THREE.MeshBasicMaterial).opacity = SHADOW_OPACITY
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
      {/* Her contact pool ON THE DESK: softer, tighter, and never drawn during the
          journey — see DESK_SHADOW_RADIUS for why the planet's cannot just be reused. */}
      <mesh ref={deskShadow} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[DESK_SHADOW_RADIUS, 32]} />
        <meshBasicMaterial
          color={PALETTE.shadowClay}
          alphaMap={falloff}
          transparent
          opacity={DESK_SHADOW_OPACITY}
          depthWrite={false}
        />
      </mesh>
    </>
  )
}
