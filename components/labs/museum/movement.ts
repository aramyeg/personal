/**
 * Pure movement math for the museum's first-person rig — sprint speed and
 * the Space-bar hop. The hop is a vertical OFFSET added on top of the
 * per-frame `floorY(z) + eyeHeight` camera height (player-controls hard-sets
 * that every frame, so jump state must live outside it and be additive).
 */

export const SPRINT_MULT = 1.85
export const JUMP_V0 = 3.2
export const GRAVITY = 9.8
/** Matches the Canvas camera in museum-gallery.tsx. */
export const FOV_BASE = 62
export const FOV_SPRINT = 68

export type JumpState = {
  /** vertical offset above the floor, in world units */
  offset: number
  /** vertical velocity, units/sec */
  velocity: number
  airborne: boolean
}

export const GROUNDED: JumpState = { offset: 0, velocity: 0, airborne: false }

/** Walk speed for the frame; sprinting scales the base speed. */
export function speedFor(base: number, sprinting: boolean): number {
  return sprinting ? base * SPRINT_MULT : base
}

/** Begin a hop if grounded; airborne input is ignored (no double jump). */
export function tryJump(state: JumpState): JumpState {
  if (state.airborne) return state
  return { offset: 0, velocity: JUMP_V0, airborne: true }
}

/** Advance the hop by dt seconds (semi-implicit Euler); land on GROUNDED. */
export function stepJump(state: JumpState, dt: number): JumpState {
  if (!state.airborne) return state
  const velocity = state.velocity - GRAVITY * dt
  const offset = state.offset + velocity * dt
  if (offset <= 0) return GROUNDED
  return { offset, velocity, airborne: true }
}

/** Camera FOV target: widen only while actually sprint-moving. */
export function fovTarget(sprinting: boolean, moving: boolean): number {
  return sprinting && moving ? FOV_SPRINT : FOV_BASE
}
