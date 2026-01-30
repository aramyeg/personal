/**
 * World System Type Definitions
 * Types for Super Mario World-style progression system
 */

// ============================================
// WORLD IDENTIFIERS
// ============================================

export type WorldId =
  | 'bluenet'
  | 'flyerbee'
  | '360dialog'
  | 'accenture'
  | 'akna'
  | 'xdatagroup'

// ============================================
// SKILL SYSTEM
// ============================================

export type SkillId =
  | 'double_jump'
  | 'wall_slide'
  | 'dash'
  | 'shield'
  | 'magnet'
  | 'float'

export type SkillConfig = {
  id: SkillId
  name: string
  description: string
  tech: string
  icon: string
  control: string
  cooldown: number | null
  duration: number | null
}

// ============================================
// WORLD THEMES
// ============================================

export type WorldTheme =
  | 'hotel'
  | 'logistics'
  | 'messaging'
  | 'banking'
  | 'ecommerce'
  | 'fintech'

export type WorldThemeConfig = {
  theme: WorldTheme
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundStyle: 'city' | 'tech' | 'nature' | 'corporate'
  platformStyle: string
}

// ============================================
// LEVEL SYSTEM
// ============================================

export type LevelDifficulty = 1 | 2 | 3

export type StarRating = 0 | 1 | 2 | 3

export type PlatformConfig = {
  x: number
  y: number
  width: number
  height?: number
  type: 'static' | 'moving' | 'falling' | 'skill_gated'
  requiredSkill?: SkillId
  movementRange?: { startX: number; endX: number; speed: number }
}

export type CollectibleConfig = {
  x: number
  y: number
  type: 'tech' | 'coin' | 'powerup'
  techName?: string
  points?: number
}

export type CheckpointConfig = {
  x: number
  y: number
  id: string
}

export type Level = {
  id: string
  worldId: WorldId
  name: string
  order: number
  difficulty: LevelDifficulty
  width: number
  platforms: PlatformConfig[]
  collectibles: CollectibleConfig[]
  checkpoints: CheckpointConfig[]
  spawnPoint: { x: number; y: number }
  exitPoint: { x: number; y: number }
  completed: boolean
  starsEarned: StarRating
  bestTime: number | null
  deathCount: number
}

// ============================================
// WORLD SYSTEM
// ============================================

export type World = {
  id: WorldId
  experienceId: string
  name: string
  theme: WorldTheme
  levels: Level[]
  mapPosition: { x: number; y: number }
  unlocked: boolean
  completed: boolean
  grantsSkill: SkillId | null
  order: number
  description: string
  company: string
}

// ============================================
// WORLD PROGRESS STATE
// ============================================

export type WorldProgress = {
  worldId: WorldId
  completed: boolean
  totalStars: number
  levelsCompleted: number
}

export type LevelProgress = {
  levelId: string
  completed: boolean
  starsEarned: StarRating
  bestTime: number | null
  collectiblesCollected: number
  totalCollectibles: number
}

// ============================================
// NAVIGATION STATE
// ============================================

export type GameScreen = 'menu' | 'overworld' | 'level' | 'level_complete' | 'skill_unlock'

export type WorldProgressState = {
  currentScreen: GameScreen
  worlds: World[]
  currentWorldId: WorldId | null
  currentLevelId: string | null
  unlockedSkills: SkillId[]
  worldProgress: Record<WorldId, WorldProgress>
  levelProgress: Record<string, LevelProgress>
  totalStarsEarned: number
  selectedWorldId: WorldId | null
}

// ============================================
// LEVEL COMPLETION
// ============================================

export type LevelCompletionData = {
  levelId: string
  worldId: WorldId
  time: number
  deaths: number
  collectiblesCollected: number
  totalCollectibles: number
  starsEarned: StarRating
  isNewBestTime: boolean
  isFirstCompletion: boolean
  skillUnlocked: SkillId | null
  worldCompleted: boolean
}

// ============================================
// WORLD MAP RENDERING
// ============================================

export type WorldNodeState = 'locked' | 'unlocked' | 'current' | 'completed'

export type WorldNode = {
  world: World
  state: WorldNodeState
  position: { x: number; y: number }
  scale: number
}

export type PathConnection = {
  fromWorldId: WorldId
  toWorldId: WorldId
  points: { x: number; y: number }[]
  unlocked: boolean
}

// ============================================
// LEVEL GENERATION
// ============================================

export type LevelTemplate = {
  name: string
  difficulty: LevelDifficulty
  width: number
  platformDensity: number
  collectibleDensity: number
  hasMovingPlatforms: boolean
  hasSkillGates: boolean
  requiredSkill?: SkillId
}

export type WorldTemplate = {
  worldId: WorldId
  levelTemplates: LevelTemplate[]
}
