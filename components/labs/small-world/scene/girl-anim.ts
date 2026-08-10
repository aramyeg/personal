/**
 * Pure girl animation state machine — the journey-driven logic behind the GLB
 * girl's AnimationMixer (girl.tsx wires these results into three.js). No React,
 * no three imports: just state resolution from scroll speed + discovery burst,
 * and clip-slot fallback selection given whichever named clips the loaded GLB
 * actually carries. The pure parts are unit-pinned; the mixer side-effects live
 * in girl.tsx.
 *
 * Design contract — the mixer must NEVER be left without an active action (that
 * shows a T-pose). So every journey state resolves to a real clip. When a named
 * Idle/Walk_Backward is ABSENT, the state degrades onto the one clip that always
 * ships (the forward skip), driven the pre-T28 way: the forward skip plays for
 * ALL locomotion, its cadence mapped from |speed| with a slow keep-alive floor
 * during dwell (no reversed playback, no parked frame — those were rejected).
 *
 * The celebrate one-shot is INTERRUPTIBLE (T52): travel always outranks it, so a
 * jump caught mid-air by resumed scrolling hands the mixer straight back to the
 * locomotion clip instead of masking it for the clip's full 2.5-3.0s.
 *
 * With Aram's girl-v2 export the canonical clips are all present:
 *   Skip_Forward   → forward travel (cadence-driven skip)
 *   Idle           → real happy-sway loop (natural rate)
 *   Walk_Backward  → real backward step (cadence-driven)
 *   Jump_A / Jump_B → the celebrate one-shot, alternating on discovery parity
 * resolveClipPlan picks them up by name with ZERO wiring changes; the fallback
 * table below is kept purely so an older/partial GLB still degrades gracefully.
 */

/** Canonical forward clip name shipped in girl.glb (v2). */
export const SKIP_CLIP = 'Skip_Forward'
/** Pre-v2 forward clip name — kept in the fallback chain so an old GLB still works. */
export const LEGACY_SKIP_CLIP = 'Armature|Skip_Forward|baselayer'
/** Forward-slot lookup order: canonical first, then the legacy name. */
export const FORWARD_SLOTS = [SKIP_CLIP, LEGACY_SKIP_CLIP] as const

/** Named clip slots the canonicalized girl.glb carries (see the task report). */
export const IDLE_SLOT = 'Idle'
export const BACKWARD_SLOT = 'Walk_Backward'
/** The two library clips T110 brought into the shipping GLB, giving forward
 *  travel a slow and a fast gear either side of the skip. */
export const WALK_SLOT = 'Walk_Forward'
export const RUN_SLOT = 'Run_Forward'
/** Aram's two jump exports, wired to the celebrate one-shot. */
export const JUMP_A_SLOT = 'Jump_A'
export const JUMP_B_SLOT = 'Jump_B'
/**
 * Celebrate one-shot cycle, in priority/rotation order. His jumps lead; the old
 * Wave/Celebrate names trail so a pre-v2 GLB still finds a clip. selectCelebrateClip
 * rotates through whichever of these the GLB actually carries.
 */
export const CELEBRATE_SLOTS = [JUMP_A_SLOT, JUMP_B_SLOT, 'Wave', 'Celebrate'] as const

/**
 * The ENDING's exit jump (T87) — the clip the scroll scrubs by hand when she
 * leaps off the planet. Jump_B leads: its launch ramps from the first frame
 * (Jump_A holds four dead frames then snaps) and its apex rides higher
 * (+0.27 u against +0.15 in the hips channel — t87 clip inventory). A GLB with
 * neither degrades to no jump action at all, and the ending keeps her on the
 * skip/idle blend through the arc rather than showing a T-pose.
 */
export const EXIT_JUMP_SLOTS = [JUMP_B_SLOT, JUMP_A_SLOT] as const

/**
 * FORWARD TRAVEL HAS GEARS (T110).
 *
 * Until now one skip clip served every forward speed, from a gentle read to a
 * hard fling — which is what "the movement patterns feel too generic" meant in
 * practice: the only thing that changed with speed was playback rate. The GLB
 * now carries a walk and a run alongside the skip, so speed picks the clip and
 * the rate only trims within it.
 *
 * THE BOUNDARIES ARE MEASURED, not chosen by feel. Real wheel input was
 * captured from the live lab in a headed browser and replayed through this
 * lab's own scroll→progress→rotation chain (`scratchpad/t110/speed/`), giving
 * |surface speed| in world u/s over four reader behaviours:
 *
 *   slow read-through   p50 1.28   p95 2.16   MAX 2.23
 *   normal browse       p50 3.31   p95 8.61   max 9.04
 *   fast fling          p50 8.45   p95 20.1   max 23.9
 *   backward scrub      p50 3.53   p95 4.80   max 5.17
 *
 * WALK_MAX 2.5 sits just above the slow read-through's entire range, so a
 * reader who is actually reading never sees anything but a walk; it is also
 * exactly where the old cadence law saturated (speed/CLIP_STRIDE hits
 * MAX_TIMESCALE at 2.5), i.e. the speed past which one clip could no longer
 * express the difference anyway. RUN_MIN 8.0 is the pooled natural p99: about
 * 1–2% of ordinary reading frames reach a run, against 52% of fling frames. So
 * the run is what a fling looks like, not what browsing looks like.
 *
 * The DOWN thresholds are ~10% lower than the UP ones for the same reason
 * IDLE_REST_EPS sits below IDLE_MOVE_EPS: the per-frame speed is jittery, and
 * measured on those traces 4.7% of browse frames and 9.3% of fling frames cross
 * a bare 2.5 in a single frame. Without the dead band she would flicker between
 * gaits mid-stride.
 */
export const WALK_MAX = 2.5
export const WALK_MAX_DOWN = 2.2
export const RUN_MIN = 8.0
export const RUN_MIN_DOWN = 7.2

/**
 * Each gear's stride: the surface speed at which that clip plays at its natural
 * rate. `speedToTimeScale` divides by it, so it is what keeps a gear from
 * running flat out across its whole band — the skip inherits 4.0 rather than
 * the old 1.0 precisely because it no longer covers 0–2.5 u/s, and at 1.0 it
 * would now sit pinned at MAX_TIMESCALE for every frame it is on screen.
 * Values are the measured centre of each band (walk: the slow reader's p50 of
 * 1.28; skip: the middle of 2.5–8.0; run: the fling's p50 of 8.45).
 */
export const FORWARD_GEARS = [
  { slot: WALK_SLOT, stride: 1.3 },
  { slot: SKIP_CLIP, stride: 4.0 },
  { slot: RUN_SLOT, stride: 9.0 },
] as const

/**
 * The stride every non-geared use of the cadence law measures against — the
 * backward step, the idle keep-alive, and any gear that had to fall back onto
 * the base forward clip. 1.0 is the pre-T110 value for ALL locomotion, kept
 * exactly so a GLB without the new clips behaves as it did before.
 */
export const BASE_STRIDE = 1.0

/**
 * Which gear this frame, given the magnitude of the forward surface speed and
 * the gear that was driving last frame. Hysteretic on both boundaries: a gear
 * is entered at the UP threshold and only left at the lower DOWN one, so a
 * speed hovering on a boundary holds whatever it is already doing.
 *
 * Pure and memoryless apart from `prev`, so girl.tsx can pin it frame to frame
 * the same way it pins the idle↔moving band.
 */
export function resolveForwardGear(speedMag: number, prev: number): number {
  const up = prev < 1 ? WALK_MAX : WALK_MAX_DOWN
  const runUp = prev < 2 ? RUN_MIN : RUN_MIN_DOWN
  if (speedMag >= runUp) return 2
  if (speedMag >= up) return 1
  return 0
}

/** Locomotion state derived from signed surface speed. */
export type Locomotion = 'forward' | 'backward' | 'idle'

/**
 * Signed surface speed (world units/s; +forward travel, −scrubbing back) → the
 * locomotion state. A magnitude within `eps` is a rest/dwell (panel windows
 * freeze rotation, so their speed collapses to ~0 → idle). This is the
 * instantaneous, memoryless classifier; girl.tsx drives the hysteretic variant.
 */
export function resolveLocomotion(signedSpeed: number, eps: number): Locomotion {
  if (signedSpeed > eps) return 'forward'
  if (signedSpeed < -eps) return 'backward'
  return 'idle'
}

/**
 * Hysteretic locomotion resolver: a wider bar to START moving than to SETTLE
 * back to idle, so a speed hovering near the rest threshold does not flicker the
 * girl between her idle loop and a locomotion skip frame-to-frame (the T28 M3
 * recommendation, dormant until real clips landed). `restEps < moveEps`:
 *   - from idle  → stays idle until |speed| exceeds the high `moveEps` bar
 *   - from moving → keeps moving until |speed| drops below the low `restEps` bar
 *   - in between  → holds the previous state
 * A fast sign reversal while moving flips direction directly.
 */
export function resolveLocomotionHysteretic(
  signedSpeed: number,
  prev: Locomotion,
  restEps: number,
  moveEps: number
): Locomotion {
  const mag = Math.abs(signedSpeed)
  const dir: Locomotion = signedSpeed >= 0 ? 'forward' : 'backward'
  if (prev === 'idle') return mag > moveEps ? dir : 'idle'
  // Currently moving (forward|backward): settle to idle at or below the low bar.
  return mag <= restEps ? 'idle' : dir
}

/**
 * The one-shot celebrate fires on the RISING edge of the discovery burst (the
 * "!" appearing), and only when a dedicated clip exists — without one, celebrate
 * is the badge/burst bounce alone (DiscoveryBurst), leaving her locomotion clip
 * untouched. Pure edge detection so girl.tsx can pin it frame-to-frame.
 */
export function shouldTriggerCelebrate(
  prevBurst: number | null,
  burst: number | null,
  hasCelebrateClip: boolean
): boolean {
  return hasCelebrateClip && prevBurst === null && burst !== null
}

/**
 * Travel outranks celebration (T52). The one-shot jump is INTERRUPTIBLE: it owns
 * the mixer only while the world is still. The discovery burst is a position in
 * the scroll timeline, not a pause — it fires whether the reader stops to read
 * the panel or scrolls straight through — and the jump clips run 2.5–3.0s, far
 * longer than the staged rotation freeze. Without this yield the jump keeps the
 * mixer for its full length and the resumed skip is simply never seen (the bug:
 * "the run animation is not shown but instead I see the jump animation").
 *
 * `loco` is the hysteretic state, so the dead band (restEps < moveEps) decides
 * what counts as travel: a dwell's jitter can never abort the jump, while real
 * scrolling reclaims the mixer on the frame it resumes.
 */
export function shouldYieldCelebrate(celebrating: boolean, loco: Locomotion): boolean {
  return celebrating && loco !== 'idle'
}

/**
 * Frame-rate independent exponential approach — the cadence easing, as a pure
 * function (girl-anim imports no three, so the damp lives here rather than
 * reaching for THREE.MathUtils). `lambda` is the approach rate per second.
 */
export function dampTimeScale(
  current: number,
  target: number,
  lambda: number,
  delta: number
): number {
  return current + (target - current) * (1 - Math.exp(-lambda * delta))
}

/**
 * The skip cadence for this frame. Easing the timeScale is what makes a speed
 * change read as acceleration rather than a snap — but on the FIRST frame of a
 * locomotion stretch there is nothing to ease from: the held value is stale from
 * whatever played before (an idle sway at 1, or a jump that owned the mixer for
 * three seconds). Easing out of that stale value is exactly the sluggish restart
 * Aram reported, so entering a state SEEDS the cadence at the demanded value and
 * only subsequent frames ease.
 */
export function nextTimeScale(
  current: number,
  target: number,
  entering: boolean,
  lambda: number,
  delta: number
): number {
  return entering ? target : dampTimeScale(current, target, lambda, delta)
}

/**
 * A resolved locomotion slot: which animation to bind this state's action to,
 * and whether it is a fallback (the dedicated named clip was absent, so the
 * forward skip is standing in). girl.tsx drives a fallback idle as a slow
 * keep-alive skip-in-place; a real Idle clip (fallback:false) loops naturally.
 */
export type SlotPlan = {
  /** the animation name to bind this state's action to */
  readonly clip: string
  /** true when the dedicated named clip was absent and the skip is standing in */
  readonly fallback: boolean
}

/**
 * The celebrate slot: an ordered cycle of one-shot clips (his jumps), or null =
 * badge-only (no clip). girl.tsx advances an index per discovery and reads the
 * clip via selectCelebrateClip so two jumps alternate deterministically.
 */
export type CelebratePlan = { readonly clips: readonly string[] } | null

/** A resolved forward gear: the clip to play and the stride its cadence is
 *  measured against. `fallback` marks a gear whose own clip was absent and
 *  which is standing on the base forward slot instead. */
export type GearPlan = SlotPlan & { readonly stride: number }

export type ClipPlan = {
  readonly forward: SlotPlan
  readonly idle: SlotPlan
  readonly backward: SlotPlan
  readonly celebrate: CelebratePlan
  /** The ending's exit jump, or null when the GLB carries no jump clip at all. */
  readonly exitJump: SlotPlan | null
  /**
   * Forward travel's three gears, slow to fast, indexed by `resolveForwardGear`.
   * ALWAYS three entries, and every one of them names a clip the GLB actually
   * carries: a GLB without the new walk/run degrades that gear onto the base
   * forward slot (carrying the base stride with it, so the cadence law does not
   * change either). That is what keeps the mixer's no-empty-action contract —
   * and therefore T-pose immunity — true by construction rather than by luck.
   */
  readonly forwardGears: readonly GearPlan[]
}

const has = (available: readonly string[], name: string): boolean => available.includes(name)

/**
 * Choose an action for each journey state from the animation names the GLB
 * carries, degrading gracefully so the mixer always has a clip to play:
 *   forward       → the first present FORWARD_SLOTS name, else the first animation
 *   Idle          → the Idle clip, else the forward skip (slow keep-alive in-place)
 *   Walk_Backward → the Walk_Backward clip, else the forward skip (cadence from |speed|)
 *   celebrate     → the ordered subset of CELEBRATE_SLOTS present, else badge-only
 */
export function resolveClipPlan(available: readonly string[]): ClipPlan {
  const forwardClip = FORWARD_SLOTS.find((n) => has(available, n)) ?? available[0] ?? SKIP_CLIP
  const forward: SlotPlan = { clip: forwardClip, fallback: false }

  const idle: SlotPlan = has(available, IDLE_SLOT)
    ? { clip: IDLE_SLOT, fallback: false }
    : { clip: forwardClip, fallback: true }

  const backward: SlotPlan = has(available, BACKWARD_SLOT)
    ? { clip: BACKWARD_SLOT, fallback: false }
    : { clip: forwardClip, fallback: true }

  const celebrateClips = CELEBRATE_SLOTS.filter((n) => has(available, n))
  const celebrate: CelebratePlan = celebrateClips.length ? { clips: celebrateClips } : null

  const exitClip = EXIT_JUMP_SLOTS.find((n) => has(available, n))
  const exitJump: SlotPlan | null = exitClip ? { clip: exitClip, fallback: false } : null

  const forwardGears: readonly GearPlan[] = FORWARD_GEARS.map((gear) =>
    has(available, gear.slot)
      ? { clip: gear.slot, fallback: false, stride: gear.stride }
      : { clip: forwardClip, fallback: true, stride: BASE_STRIDE }
  )

  return { forward, idle, backward, celebrate, exitJump, forwardGears }
}

/**
 * Pick the celebrate clip for a given discovery index, rotating through the
 * cycle so two jumps alternate on parity (0→Jump_A, 1→Jump_B, 2→Jump_A, …).
 * A one-clip cycle returns that clip for every index; a null plan returns null.
 * Deterministic — a function only of the ordered clip cycle and the index.
 */
export function selectCelebrateClip(plan: CelebratePlan, index: number): string | null {
  if (!plan || plan.clips.length === 0) return null
  const n = plan.clips.length
  return plan.clips[((index % n) + n) % n]
}

/**
 * Surface-speed magnitude → skip cadence timeScale, clamped to a lively band.
 * The `min` floor is the pre-T28 keep-alive: a dwell (|speed|→0) still skips
 * slowly in place rather than freezing, and a fast fling never runs away past
 * `max`. A real Idle clip supersedes this by looping at its natural rate.
 */
export function speedToTimeScale(
  speedMag: number,
  stride: number,
  min: number,
  max: number
): number {
  const raw = speedMag / stride
  return Math.min(max, Math.max(min, raw))
}
