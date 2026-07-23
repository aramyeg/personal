/**
 * Pure girl animation state machine — the journey-driven logic behind the GLB
 * girl's AnimationMixer (girl.tsx wires these results into three.js). No React,
 * no three imports: just state resolution from scroll speed + discovery burst,
 * and clip-slot fallback selection given whichever named clips the loaded GLB
 * actually carries. The pure parts are unit-pinned; the mixer side-effects live
 * in girl.tsx.
 *
 * Design contract — the mixer must NEVER be left without an active action (that
 * shows a T-pose). So every journey state resolves to a real clip: the fallback
 * selection below degrades a missing Idle/Walk_Backward/Wave onto the one clip
 * that always ships (the forward skip), driven differently (parked at a settled
 * frame / reversed timeScale / badge-only). When Aram's Meshy clips land under
 * the expected names, resolveClipPlan picks them up with ZERO code changes.
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

/** How a resolved slot's action is driven on the mixer. */
export type PlaybackMode = 'play' | 'pause-settled'

export type SlotPlan = {
  /** the animation name to bind this state's action to */
  readonly clip: string
  /** play the clip in reverse (negative timeScale) — the backward fallback */
  readonly reversed: boolean
  /** 'pause-settled' parks the clip at a grounded frame instead of advancing */
  readonly mode: PlaybackMode
  /** true when the dedicated named clip was absent and a fallback was chosen */
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
 *   Idle          → the forward clip parked at a settled (grounded) frame
 *   Walk_Backward → the forward clip played in reverse
 *   Wave/Celebrate → badge-only celebrate (no clip)
 * The forward slot is the skip clip when present, else the first animation.
 */
export function resolveClipPlan(available: readonly string[]): ClipPlan {
  const forwardClip = has(available, SKIP_CLIP) ? SKIP_CLIP : (available[0] ?? SKIP_CLIP)
  const forward: SlotPlan = { clip: forwardClip, reversed: false, mode: 'play', fallback: false }

  const idle: SlotPlan = has(available, IDLE_SLOT)
    ? { clip: IDLE_SLOT, reversed: false, mode: 'play', fallback: false }
    : { clip: forwardClip, reversed: false, mode: 'pause-settled', fallback: true }

  const backward: SlotPlan = has(available, BACKWARD_SLOT)
    ? { clip: BACKWARD_SLOT, reversed: false, mode: 'play', fallback: false }
    : { clip: forwardClip, reversed: true, mode: 'play', fallback: true }

  const celebrateClip = CELEBRATE_SLOTS.find((n) => has(available, n)) ?? null
  const celebrate: CelebratePlan = celebrateClip ? { clip: celebrateClip } : null

  return { forward, idle, backward, celebrate }
}

/**
 * Surface-speed magnitude → forward/backward cadence timeScale, clamped to a
 * lively band. Replaces the old MIN_TIMESCALE keep-alive: idle is now its own
 * state (parked), so this only runs while she is actually travelling.
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
