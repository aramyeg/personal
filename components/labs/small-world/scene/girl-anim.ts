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

/**
 * FORWARD TRAVEL IS ONE CLIP AT EVERY SPEED — the standing rule, not an accident
 * of what the GLB happened to carry.
 *
 * T110/T111 shipped the alternative and it was reverted on sight: the GLB was
 * given a walk and a run either side of the skip, speed picked the clip against
 * measured thresholds, and the chooser was smoothed and hold-gated so a gait
 * lasted longer than the mixer's crossfade. All of that worked as specified, and
 * Aram's ruling on seeing it was that he liked the always-skipping version "way
 * more". The reason is worth keeping, because gears will look like an obvious
 * improvement to anyone reading the cadence law cold: the girl is not a
 * simulation of a person moving at a speed, she is the reader's own hand made
 * visible on a small planet, and a skip that quickens and slows reads as ONE
 * continuous gesture answering ONE continuous input. Swapping her gait mid-scroll
 * breaks that thread — each change is a little discontinuity the reader did not
 * ask for, and the character stops being an extension of the scroll and starts
 * being a thing being driven. The rate carries the speed; the clip carries who
 * she is. So: only `speedToTimeScale` may respond to speed here, and the forward
 * slot resolves to exactly one clip. Do not reintroduce gait selection.
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

export type ClipPlan = {
  readonly forward: SlotPlan
  readonly idle: SlotPlan
  readonly backward: SlotPlan
  readonly celebrate: CelebratePlan
  /** The ending's exit jump, or null when the GLB carries no jump clip at all. */
  readonly exitJump: SlotPlan | null
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

  return { forward, idle, backward, celebrate, exitJump }
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
