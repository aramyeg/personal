/**
 * Skill Physics
 * Applies skill effects to player movement and physics
 * IMPORTANT: All operations are immutable - no mutation of input objects
 */

import { SKILL_EFFECTS, type SkillState } from './skillConfig'
import type { SkillId } from './types'

// ============================================
// TYPES
// ============================================

export type SkillInput = {
  jump: boolean
  jumpPressed: boolean
  dash: boolean
  shield: boolean
  left: boolean
  right: boolean
}

export type PlayerPhysics = {
  x: number
  y: number
  vx: number
  vy: number
  grounded: boolean
  facingRight: boolean
  touchingWallLeft: boolean
  touchingWallRight: boolean
}

export type SkillPhysicsResult = {
  physics: PlayerPhysics
  skillState: SkillState
  effects: {
    isDashing: boolean
    isShielded: boolean
    isFloating: boolean
    isWallSliding: boolean
    usedDoubleJump: boolean
    collectRadiusMultiplier: number
  }
}

// ============================================
// PHYSICS CONSTANTS
// ============================================

const BASE_GRAVITY = 0.5
const BASE_JUMP_FORCE = -11

// ============================================
// DEEP CLONE HELPER
// ============================================

function deepCloneSkillState(state: SkillState): SkillState {
  return {
    doubleJump: { ...state.doubleJump },
    wallSlide: { ...state.wallSlide },
    dash: { ...state.dash },
    shield: { ...state.shield },
    float: { ...state.float },
  }
}

// ============================================
// MAIN SKILL PHYSICS PROCESSOR
// ============================================

export function applySkillPhysics(
  physics: PlayerPhysics,
  skillState: SkillState,
  input: SkillInput,
  unlockedSkills: SkillId[],
  deltaTime: number
): SkillPhysicsResult {
  // Deep clone to avoid mutations
  let newPhysics = { ...physics }
  let newSkillState = deepCloneSkillState(skillState)

  const effects = {
    isDashing: false,
    isShielded: false,
    isFloating: false,
    isWallSliding: false,
    usedDoubleJump: false,
    collectRadiusMultiplier: 1,
  }

  // Reset double jump when grounded
  if (physics.grounded) {
    newSkillState = {
      ...newSkillState,
      doubleJump: {
        jumpsRemaining: SKILL_EFFECTS.double_jump.extraJumps ?? 1,
      },
    }
  }

  // Update wall touching state
  newSkillState = {
    ...newSkillState,
    wallSlide: {
      isTouchingWall: physics.touchingWallLeft || physics.touchingWallRight,
      wallDirection: physics.touchingWallLeft
        ? 'left'
        : physics.touchingWallRight
        ? 'right'
        : null,
    },
  }

  // Process each skill
  if (unlockedSkills.includes('double_jump')) {
    const result = processDoubleJump(newPhysics, newSkillState, input)
    newPhysics = result.physics
    newSkillState = result.skillState
    effects.usedDoubleJump = result.usedJump
  }

  if (unlockedSkills.includes('wall_slide')) {
    const result = processWallSlide(newPhysics, newSkillState, input)
    newPhysics = result.physics
    newSkillState = result.skillState
    effects.isWallSliding = result.isSliding
  }

  if (unlockedSkills.includes('dash')) {
    const result = processDash(newPhysics, newSkillState, input, deltaTime)
    newPhysics = result.physics
    newSkillState = result.skillState
    effects.isDashing = result.isDashing
  }

  if (unlockedSkills.includes('shield')) {
    const result = processShield(newSkillState, input, deltaTime)
    newSkillState = result.skillState
    effects.isShielded = result.isActive
  }

  if (unlockedSkills.includes('magnet')) {
    effects.collectRadiusMultiplier = SKILL_EFFECTS.magnet.magnetRadiusMultiplier ?? 2
  }

  if (unlockedSkills.includes('float')) {
    const result = processFloat(newPhysics, newSkillState, input, deltaTime)
    newPhysics = result.physics
    newSkillState = result.skillState
    effects.isFloating = result.isFloating
  }

  return {
    physics: newPhysics,
    skillState: newSkillState,
    effects,
  }
}

// ============================================
// INDIVIDUAL SKILL PROCESSORS (IMMUTABLE)
// ============================================

function processDoubleJump(
  physics: PlayerPhysics,
  skillState: SkillState,
  input: SkillInput
): { physics: PlayerPhysics; skillState: SkillState; usedJump: boolean } {
  let usedJump = false
  let newPhysics = { ...physics }
  let newSkillState = skillState

  if (
    input.jumpPressed &&
    !physics.grounded &&
    skillState.doubleJump.jumpsRemaining > 0
  ) {
    newPhysics = {
      ...newPhysics,
      vy: BASE_JUMP_FORCE * 0.9, // Slightly weaker than ground jump
    }
    newSkillState = {
      ...skillState,
      doubleJump: {
        jumpsRemaining: skillState.doubleJump.jumpsRemaining - 1,
      },
    }
    usedJump = true
  }

  return { physics: newPhysics, skillState: newSkillState, usedJump }
}

function processWallSlide(
  physics: PlayerPhysics,
  skillState: SkillState,
  input: SkillInput
): { physics: PlayerPhysics; skillState: SkillState; isSliding: boolean } {
  let isSliding = false
  let newPhysics = { ...physics }
  const effects = SKILL_EFFECTS.wall_slide

  // Check if wall sliding
  if (
    skillState.wallSlide.isTouchingWall &&
    !physics.grounded &&
    physics.vy > 0
  ) {
    // Apply wall slide (reduced fall speed)
    newPhysics = {
      ...newPhysics,
      vy: Math.min(physics.vy, effects.slideSpeed ?? 2),
    }
    isSliding = true

    // Wall jump
    if (input.jumpPressed) {
      const jumpDir = skillState.wallSlide.wallDirection === 'left' ? 1 : -1
      newPhysics = {
        ...newPhysics,
        vx: (effects.wallJumpForceX ?? 8) * jumpDir,
        vy: effects.wallJumpForceY ?? -11,
        facingRight: jumpDir > 0,
      }
    }
  }

  return { physics: newPhysics, skillState, isSliding }
}

function processDash(
  physics: PlayerPhysics,
  skillState: SkillState,
  input: SkillInput,
  deltaTime: number
): { physics: PlayerPhysics; skillState: SkillState; isDashing: boolean } {
  const effects = SKILL_EFFECTS.dash
  let isDashing = skillState.dash.isDashing
  let newPhysics = { ...physics }
  let newSkillState = { ...skillState }
  let newDash = { ...skillState.dash }

  // Update cooldown
  if (newDash.cooldownRemaining > 0) {
    newDash = {
      ...newDash,
      cooldownRemaining: newDash.cooldownRemaining - deltaTime,
    }
  }

  // Start dash
  if (
    input.dash &&
    !newDash.isDashing &&
    newDash.cooldownRemaining <= 0
  ) {
    newDash = {
      ...newDash,
      isDashing: true,
      dashTimeRemaining: effects.dashDuration ?? 300,
    }
    isDashing = true
  }

  // Process active dash
  if (newDash.isDashing) {
    newDash = {
      ...newDash,
      dashTimeRemaining: newDash.dashTimeRemaining - deltaTime,
    }

    if (newDash.dashTimeRemaining <= 0) {
      // End dash
      newDash = {
        ...newDash,
        isDashing: false,
        cooldownRemaining: effects.dashCooldown ?? 2000,
      }
      isDashing = false
    } else {
      // Apply dash speed
      const dashDir = physics.facingRight ? 1 : -1
      newPhysics = {
        ...newPhysics,
        vx: (effects.speedMultiplier ?? 3) * 4 * dashDir,
        vy: 0, // Lock vertical movement during dash
      }
    }
  }

  newSkillState = { ...newSkillState, dash: newDash }

  return { physics: newPhysics, skillState: newSkillState, isDashing }
}

function processShield(
  skillState: SkillState,
  input: SkillInput,
  deltaTime: number
): { skillState: SkillState; isActive: boolean } {
  const effects = SKILL_EFFECTS.shield
  let newSkillState = { ...skillState }
  let newShield = { ...skillState.shield }

  // Update cooldown
  if (newShield.cooldownRemaining > 0) {
    newShield = {
      ...newShield,
      cooldownRemaining: newShield.cooldownRemaining - deltaTime,
    }
  }

  // Activate shield
  if (
    input.shield &&
    !newShield.isActive &&
    newShield.cooldownRemaining <= 0
  ) {
    newShield = {
      ...newShield,
      isActive: true,
      timeRemaining: effects.shieldDuration ?? 2000,
    }
  }

  // Update active shield
  if (newShield.isActive) {
    newShield = {
      ...newShield,
      timeRemaining: newShield.timeRemaining - deltaTime,
    }

    if (newShield.timeRemaining <= 0) {
      newShield = {
        ...newShield,
        isActive: false,
        cooldownRemaining: effects.shieldCooldown ?? 10000,
      }
    }
  }

  newSkillState = { ...newSkillState, shield: newShield }

  return { skillState: newSkillState, isActive: newShield.isActive }
}

function processFloat(
  physics: PlayerPhysics,
  skillState: SkillState,
  input: SkillInput,
  deltaTime: number
): { physics: PlayerPhysics; skillState: SkillState; isFloating: boolean } {
  const effects = SKILL_EFFECTS.float
  let newPhysics = { ...physics }
  let newSkillState = { ...skillState }
  let newFloat = { ...skillState.float }
  let isFloating = false

  // Start floating
  if (input.jump && !physics.grounded && physics.vy > 0) {
    if (newFloat.timeRemaining > 0 || !newFloat.isFloating) {
      newFloat = { ...newFloat, isFloating: true }
      isFloating = true
    }
  } else {
    newFloat = { ...newFloat, isFloating: false }
  }

  // Process float
  if (newFloat.isFloating && newFloat.timeRemaining > 0) {
    newFloat = {
      ...newFloat,
      timeRemaining: newFloat.timeRemaining - deltaTime,
    }

    // Apply reduced gravity
    const gravityMult = effects.gravityMultiplier ?? 0.3
    newPhysics = {
      ...newPhysics,
      vy: Math.min(physics.vy, BASE_GRAVITY * gravityMult * 10),
    }
    isFloating = true
  }

  // Reset float time when grounded
  if (physics.grounded) {
    newFloat = {
      ...newFloat,
      timeRemaining: effects.floatDuration ?? 1000,
    }
  }

  newSkillState = { ...newSkillState, float: newFloat }

  return { physics: newPhysics, skillState: newSkillState, isFloating }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getGravityMultiplier(
  unlockedSkills: SkillId[],
  skillState: SkillState
): number {
  if (unlockedSkills.includes('float') && skillState.float.isFloating) {
    return SKILL_EFFECTS.float.gravityMultiplier ?? 0.3
  }

  if (unlockedSkills.includes('wall_slide') && skillState.wallSlide.isTouchingWall) {
    return 0.3 // Wall slide gravity is much lower
  }

  return 1
}

export function canTakeDamage(
  unlockedSkills: SkillId[],
  skillState: SkillState
): boolean {
  if (unlockedSkills.includes('shield') && skillState.shield.isActive) {
    return false
  }
  return true
}

export function getCollectRadius(
  baseRadius: number,
  unlockedSkills: SkillId[]
): number {
  if (unlockedSkills.includes('magnet')) {
    return baseRadius * (SKILL_EFFECTS.magnet.magnetRadiusMultiplier ?? 2)
  }
  return baseRadius
}
