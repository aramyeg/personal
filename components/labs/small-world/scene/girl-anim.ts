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
/** Aram's two jump exports, wired to the celebrate one-shot. */
export const JUMP_A_SLOT = 'Jump_A'
export const JUMP_B_SLOT = 'Jump_B'
/**
 * Celebrate one-shot cycle, in priority/rotation order. His jumps lead; the old
 * Wave/Celebrate names trail so a pre-v2 GLB still finds a clip. selectCelebrateClip
 * rotates through whichever of these the GLB actually carries.
 */
export const CELEBRATE_SLOTS = [JUMP_A_SLOT, JUMP_B_SLOT, 'Wave', 'Celebrate'] as const

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

  return { forward, idle, backward, celebrate }
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
