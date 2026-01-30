/**
 * World System - Public API
 */

// Types
export * from './types'

// World Data
export {
  WORLD_THEMES,
  WORLD_CONFIGS,
  generateWorlds,
  getWorldById,
  getLevelById,
  getNextWorld,
  isWorldComplete,
  getWorldStars,
  getWorldMaxStars,
  calculateStars,
  EXPERIENCE_TO_WORLD,
  getWorldIdFromExperience,
} from './worldData'

// Skill Configuration
export {
  SKILLS,
  SKILL_EFFECTS,
  SKILL_ORDER,
  getSkillById,
  getSkillEffect,
  isPassiveSkill,
  hasActivation,
  getSkillKeybind,
  getSkillsInOrder,
  createInitialSkillState,
  type SkillEffect,
  type SkillState,
} from './skillConfig'

// World State
export {
  useWorldState,
  useCurrentScreen,
  useSelectedWorld,
  useCurrentWorldId,
  useCurrentLevelId,
  useWorlds,
  useUnlockedSkills,
  useTotalStars,
  useLastCompletionData,
  usePendingSkillUnlock,
  useSkillState,
} from './worldState'

// Level Generator
export {
  generateLevelPlatforms,
  generateLevelCollectibles,
  generateLevelCheckpoints,
  populateLevelData,
  getLevelBounds,
  isAtLevelExit,
} from './levelGenerator'

// Skill Physics
export {
  applySkillPhysics,
  getGravityMultiplier,
  canTakeDamage,
  getCollectRadius,
  type SkillInput,
  type PlayerPhysics,
  type SkillPhysicsResult,
} from './skillPhysics'
