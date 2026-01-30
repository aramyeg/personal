/**
 * World Data Configuration
 * Maps career experiences to game worlds with progression system
 */

import type {
  World,
  WorldId,
  WorldTheme,
  WorldThemeConfig,
  Level,
  LevelDifficulty,
  SkillId,
} from './types'

// ============================================
// THEME CONFIGURATIONS
// ============================================

export const WORLD_THEMES: Record<WorldTheme, WorldThemeConfig> = {
  hotel: {
    theme: 'hotel',
    primaryColor: '#8B5CF6',
    secondaryColor: '#A78BFA',
    accentColor: '#C4B5FD',
    backgroundStyle: 'city',
    platformStyle: 'tech_block',
  },
  logistics: {
    theme: 'logistics',
    primaryColor: '#F59E0B',
    secondaryColor: '#FBBF24',
    accentColor: '#FCD34D',
    backgroundStyle: 'nature',
    platformStyle: 'server_rack',
  },
  messaging: {
    theme: 'messaging',
    primaryColor: '#10B981',
    secondaryColor: '#34D399',
    accentColor: '#6EE7B7',
    backgroundStyle: 'tech',
    platformStyle: 'cloud',
  },
  banking: {
    theme: 'banking',
    primaryColor: '#3B82F6',
    secondaryColor: '#60A5FA',
    accentColor: '#93C5FD',
    backgroundStyle: 'corporate',
    platformStyle: 'mobile_device',
  },
  ecommerce: {
    theme: 'ecommerce',
    primaryColor: '#EC4899',
    secondaryColor: '#F472B6',
    accentColor: '#F9A8D4',
    backgroundStyle: 'city',
    platformStyle: 'code_block',
  },
  fintech: {
    theme: 'fintech',
    primaryColor: '#06B6D4',
    secondaryColor: '#22D3EE',
    accentColor: '#67E8F9',
    backgroundStyle: 'corporate',
    platformStyle: 'terminal',
  },
}

// ============================================
// WORLD CONFIGURATIONS
// ============================================

type WorldConfig = {
  id: WorldId
  experienceId: string
  name: string
  company: string
  theme: WorldTheme
  grantsSkill: SkillId | null
  order: number
  description: string
  mapPosition: { x: number; y: number }
}

export const WORLD_CONFIGS: WorldConfig[] = [
  {
    id: 'bluenet',
    experienceId: 'bluenet',
    name: 'Hotel Systems',
    company: 'BlueNet / FreeDOM',
    theme: 'hotel',
    grantsSkill: 'double_jump',
    order: 1,
    description: 'Where the journey began - building hotel management systems',
    mapPosition: { x: 80, y: 220 },
  },
  {
    id: 'flyerbee',
    experienceId: 'flyerbee',
    name: 'Fleet Command',
    company: 'FLYERBEE AG',
    theme: 'logistics',
    grantsSkill: 'wall_slide',
    order: 2,
    description: 'Real-time logistics and fleet tracking',
    mapPosition: { x: 180, y: 150 },
  },
  {
    id: '360dialog',
    experienceId: '360dialog',
    name: 'Message Hub',
    company: '360dialog',
    theme: 'messaging',
    grantsSkill: 'dash',
    order: 3,
    description: 'WhatsApp Business API serving billions of messages',
    mapPosition: { x: 300, y: 200 },
  },
  {
    id: 'accenture',
    experienceId: 'accenture',
    name: 'Mobile Vault',
    company: 'Accenture',
    theme: 'banking',
    grantsSkill: 'shield',
    order: 4,
    description: 'Secure mobile banking for the Middle East',
    mapPosition: { x: 400, y: 130 },
  },
  {
    id: 'akna',
    experienceId: 'akna',
    name: 'Commerce Core',
    company: 'AKNA',
    theme: 'ecommerce',
    grantsSkill: 'magnet',
    order: 5,
    description: 'Scalable e-commerce platforms',
    mapPosition: { x: 480, y: 210 },
  },
  {
    id: 'xdatagroup',
    experienceId: 'xdatagroup',
    name: 'Tech Summit',
    company: 'xDataGroup',
    theme: 'fintech',
    grantsSkill: 'float',
    order: 6,
    description: 'Leading retail banking and PropTech development',
    mapPosition: { x: 560, y: 140 },
  },
]

// ============================================
// LEVEL TEMPLATE
// ============================================

type LevelConfig = {
  name: string
  difficulty: LevelDifficulty
  width: number
}

// Single level per world - moderate difficulty for all
const LEVEL_TEMPLATE: LevelConfig = {
  name: 'Journey',
  difficulty: 2,
  width: 45,
}

// ============================================
// WORLD GENERATION
// ============================================

function createLevel(worldId: WorldId, config: WorldConfig): Level {
  const levelId = `${worldId}_1`

  return {
    id: levelId,
    worldId,
    name: config.company, // Use company name as level name
    order: 1,
    difficulty: LEVEL_TEMPLATE.difficulty,
    width: LEVEL_TEMPLATE.width,
    platforms: [],
    collectibles: [],
    checkpoints: [],
    spawnPoint: { x: 50, y: 150 },
    exitPoint: { x: (LEVEL_TEMPLATE.width - 2) * 32, y: 150 },
    completed: false,
    starsEarned: 0,
    bestTime: null,
    deathCount: 0,
  }
}

function createWorld(config: WorldConfig): World {
  // Single level per world
  const levels = [createLevel(config.id, config)]

  return {
    id: config.id,
    experienceId: config.experienceId,
    name: config.name,
    theme: config.theme,
    levels,
    mapPosition: config.mapPosition,
    unlocked: config.order === 1,
    completed: false,
    grantsSkill: config.grantsSkill,
    order: config.order,
    description: config.description,
    company: config.company,
  }
}

/**
 * Generate all worlds from configuration
 */
export function generateWorlds(): World[] {
  return WORLD_CONFIGS
    .sort((a, b) => a.order - b.order)
    .map(createWorld)
}

/**
 * Get world by ID
 */
export function getWorldById(worlds: World[], worldId: WorldId): World | undefined {
  return worlds.find(w => w.id === worldId)
}

/**
 * Get level by ID
 */
export function getLevelById(worlds: World[], levelId: string): Level | undefined {
  for (const world of worlds) {
    const level = world.levels.find(l => l.id === levelId)
    if (level) return level
  }
  return undefined
}

/**
 * Get the next world in progression
 */
export function getNextWorld(worlds: World[], currentWorldId: WorldId): World | undefined {
  const currentWorld = getWorldById(worlds, currentWorldId)
  if (!currentWorld) return undefined

  return worlds.find(w => w.order === currentWorld.order + 1)
}

/**
 * Check if all levels in a world are completed
 */
export function isWorldComplete(world: World): boolean {
  return world.levels.every(level => level.completed)
}

/**
 * Get total stars in a world
 */
export function getWorldStars(world: World): number {
  return world.levels.reduce((sum, level) => sum + level.starsEarned, 0)
}

/**
 * Get max possible stars in a world
 */
export function getWorldMaxStars(world: World): number {
  return world.levels.length * 3
}

/**
 * Calculate star rating based on performance
 */
export function calculateStars(deaths: number, collectRatio: number): 1 | 2 | 3 {
  if (deaths === 0 && collectRatio >= 0.9) return 3
  if (deaths <= 1 && collectRatio >= 0.6) return 2
  return 1
}

/**
 * Get experience ID to world ID mapping
 */
export const EXPERIENCE_TO_WORLD: Record<string, WorldId> = {
  bluenet: 'bluenet',
  flyerbee: 'flyerbee',
  '360dialog': '360dialog',
  accenture: 'accenture',
  akna: 'akna',
  xdatagroup: 'xdatagroup',
}

/**
 * Get world ID from experience ID
 */
export function getWorldIdFromExperience(experienceId: string): WorldId | undefined {
  return EXPERIENCE_TO_WORLD[experienceId]
}
