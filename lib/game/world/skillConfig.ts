/**
 * Skill Configuration
 * Defines all unlockable skills and their gameplay effects
 */

import type { SkillId, SkillConfig } from './types'

// ============================================
// SKILL DEFINITIONS
// ============================================

export const SKILLS: Record<SkillId, SkillConfig> = {
  double_jump: {
    id: 'double_jump',
    name: 'Double Jump',
    description: 'Perform an extra jump while airborne',
    tech: 'React',
    icon: '🔄',
    control: 'Space (while airborne)',
    cooldown: null,
    duration: null,
  },
  wall_slide: {
    id: 'wall_slide',
    name: 'Wall Slide',
    description: 'Slide down walls slowly and perform wall jumps',
    tech: 'React Native',
    icon: '🧗',
    control: 'Touch wall + Space to wall jump',
    cooldown: null,
    duration: null,
  },
  dash: {
    id: 'dash',
    name: 'Dash',
    description: 'Quick horizontal burst of speed',
    tech: 'TypeScript',
    icon: '💨',
    control: 'Shift',
    cooldown: 2000,
    duration: 300,
  },
  shield: {
    id: 'shield',
    name: 'Shield',
    description: 'Temporary invulnerability',
    tech: 'Mobile Dev',
    icon: '🛡️',
    control: 'Q',
    cooldown: 10000,
    duration: 2000,
  },
  magnet: {
    id: 'magnet',
    name: 'Magnet',
    description: 'Double collectible attraction radius',
    tech: 'E-commerce',
    icon: '🧲',
    control: 'Passive',
    cooldown: null,
    duration: null,
  },
  float: {
    id: 'float',
    name: 'Float',
    description: 'Reduced gravity while holding jump',
    tech: 'Leadership',
    icon: '🎈',
    control: 'Hold Space',
    cooldown: null,
    duration: 1000,
  },
}

// ============================================
// SKILL EFFECTS
// ============================================

export type SkillEffect = {
  extraJumps?: number
  slideSpeed?: number
  wallJumpForceX?: number
  wallJumpForceY?: number
  speedMultiplier?: number
  dashDuration?: number
  dashCooldown?: number
  invincible?: boolean
  shieldDuration?: number
  shieldCooldown?: number
  magnetRadiusMultiplier?: number
  gravityMultiplier?: number
  floatDuration?: number
}

export const SKILL_EFFECTS: Record<SkillId, SkillEffect> = {
  double_jump: {
    extraJumps: 1,
  },
  wall_slide: {
    slideSpeed: 0.5,
    wallJumpForceX: 8,
    wallJumpForceY: -11,
  },
  dash: {
    speedMultiplier: 3,
    dashDuration: 300,
    dashCooldown: 2000,
  },
  shield: {
    invincible: true,
    shieldDuration: 2000,
    shieldCooldown: 10000,
  },
  magnet: {
    magnetRadiusMultiplier: 2,
  },
  float: {
    gravityMultiplier: 0.3,
    floatDuration: 1000,
  },
}

// ============================================
// SKILL STATE
// ============================================

export type SkillState = {
  doubleJump: {
    jumpsRemaining: number
  }
  wallSlide: {
    isTouchingWall: boolean
    wallDirection: 'left' | 'right' | null
  }
  dash: {
    isDashing: boolean
    dashTimeRemaining: number
    cooldownRemaining: number
  }
  shield: {
    isActive: boolean
    timeRemaining: number
    cooldownRemaining: number
  }
  float: {
    isFloating: boolean
    timeRemaining: number
  }
}

export function createInitialSkillState(): SkillState {
  return {
    doubleJump: {
      jumpsRemaining: 1,
    },
    wallSlide: {
      isTouchingWall: false,
      wallDirection: null,
    },
    dash: {
      isDashing: false,
      dashTimeRemaining: 0,
      cooldownRemaining: 0,
    },
    shield: {
      isActive: false,
      timeRemaining: 0,
      cooldownRemaining: 0,
    },
    float: {
      isFloating: false,
      timeRemaining: 0,
    },
  }
}

// ============================================
// SKILL HELPERS
// ============================================

export function getSkillById(skillId: SkillId): SkillConfig {
  return SKILLS[skillId]
}

export function getSkillEffect(skillId: SkillId): SkillEffect {
  return SKILL_EFFECTS[skillId]
}

export function isPassiveSkill(skillId: SkillId): boolean {
  return skillId === 'magnet'
}

export function hasActivation(skillId: SkillId): boolean {
  return ['dash', 'shield'].includes(skillId)
}

export function getSkillKeybind(skillId: SkillId): string | null {
  switch (skillId) {
    case 'double_jump':
      return 'Space (airborne)'
    case 'wall_slide':
      return 'Space (on wall)'
    case 'dash':
      return 'Shift'
    case 'shield':
      return 'Q'
    case 'float':
      return 'Hold Space'
    case 'magnet':
      return null
    default:
      return null
  }
}

// ============================================
// SKILL ORDER (for UI display)
// ============================================

export const SKILL_ORDER: SkillId[] = [
  'double_jump',
  'wall_slide',
  'dash',
  'shield',
  'magnet',
  'float',
]

export function getSkillsInOrder(): SkillConfig[] {
  return SKILL_ORDER.map(id => SKILLS[id])
}
