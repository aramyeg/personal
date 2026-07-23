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
 * Missing Wave = badge-only celebrate. When Aram's Meshy clips land under the
 * expected names, resolveClipPlan picks them up with ZERO code changes and the
 * full state machine (real Idle loop, Walk_Backward, one-shot Wave) activates.
 */

/** The forward locomotion clip that ships in girl.glb today (its only clip). */
export const SKIP_CLIP = 'Armature|Skip_Forward|baselayer'

/** Named clip slots Aram's Meshy export should carry (see the task report). */
export const IDLE_SLOT = 'Idle'
export const BACKWARD_SLOT = 'Walk_Backward'
/** Either name is accepted for the one-shot celebrate at a discovery burst. */
export const CELEBRATE_SLOTS = ['Wave', 'Celebrate'] as const

/** Locomotion state derived from signed surface speed. */
export type Locomotion = 'forward' | 'backward' | 'idle'

/**
 * Signed surface speed (world units/s; +forward travel, −scrubbing back) → the
 * locomotion state. A magnitude within `eps` is a rest/dwell (panel windows
 * freeze rotation, so their speed collapses to ~0 → idle).
 */
export function resolveLocomotion(signedSpeed: number, eps: number): Locomotion {
  if (signedSpeed > eps) return 'forward'
  if (signedSpeed < -eps) return 'backward'
  return 'idle'
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

/** The celebrate slot: a one-shot clip, or null = badge-only (no clip). */
export type CelebratePlan = { readonly clip: string } | null

export type ClipPlan = {
  readonly forward: SlotPlan
  readonly idle: SlotPlan
  readonly backward: SlotPlan
  readonly celebrate: CelebratePlan
}

const has = (available: readonly string[], name: string): boolean => available.includes(name)

/**
 * Choose an action for each journey state from the animation names the GLB
 * carries, degrading gracefully so the mixer always has a clip to play:
 *   Idle          → the forward skip (slow keep-alive skip-in-place during dwell)
 *   Walk_Backward → the forward skip (played forward, cadence from |speed|)
 *   Wave/Celebrate → badge-only celebrate (no clip)
 * The forward slot is the skip clip when present, else the first animation.
 */
export function resolveClipPlan(available: readonly string[]): ClipPlan {
  const forwardClip = has(available, SKIP_CLIP) ? SKIP_CLIP : (available[0] ?? SKIP_CLIP)
  const forward: SlotPlan = { clip: forwardClip, fallback: false }

  const idle: SlotPlan = has(available, IDLE_SLOT)
    ? { clip: IDLE_SLOT, fallback: false }
    : { clip: forwardClip, fallback: true }

  const backward: SlotPlan = has(available, BACKWARD_SLOT)
    ? { clip: BACKWARD_SLOT, fallback: false }
    : { clip: forwardClip, fallback: true }

  const celebrateClip = CELEBRATE_SLOTS.find((n) => has(available, n)) ?? null
  const celebrate: CelebratePlan = celebrateClip ? { clip: celebrateClip } : null

  return { forward, idle, backward, celebrate }
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
