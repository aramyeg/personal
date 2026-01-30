/**
 * Level Generator
 * Procedurally generates platform layouts for levels
 */

import type {
  Level,
  LevelDifficulty,
  PlatformConfig,
  CollectibleConfig,
  CheckpointConfig,
  SkillId,
} from './types'

// ============================================
// CONSTANTS
// ============================================

const TILE_SIZE = 32
const GROUND_Y = 180
const MIN_PLATFORM_HEIGHT = 80
const MAX_PLATFORM_HEIGHT = 160
const PLATFORM_WIDTH_MIN = 64
const PLATFORM_WIDTH_MAX = 128

// ============================================
// DIFFICULTY PRESETS
// ============================================

type DifficultyConfig = {
  platformDensity: number
  gapSize: { min: number; max: number }
  heightVariance: number
  movingPlatformChance: number
  collectibleDensity: number
}

const DIFFICULTY_CONFIGS: Record<LevelDifficulty, DifficultyConfig> = {
  1: {
    platformDensity: 0.7,
    gapSize: { min: 60, max: 100 },
    heightVariance: 40,
    movingPlatformChance: 0,
    collectibleDensity: 0.8,
  },
  2: {
    platformDensity: 0.6,
    gapSize: { min: 80, max: 140 },
    heightVariance: 60,
    movingPlatformChance: 0.2,
    collectibleDensity: 0.6,
  },
  3: {
    platformDensity: 0.5,
    gapSize: { min: 100, max: 180 },
    heightVariance: 80,
    movingPlatformChance: 0.35,
    collectibleDensity: 0.4,
  },
}

// ============================================
// SEEDED RANDOM
// ============================================

function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

// ============================================
// PLATFORM GENERATION
// ============================================

export function generateLevelPlatforms(
  levelId: string,
  width: number,
  difficulty: LevelDifficulty,
  requiredSkill?: SkillId
): PlatformConfig[] {
  const config = DIFFICULTY_CONFIGS[difficulty]
  const seed = hashString(levelId)
  const random = seededRandom(seed)
  const platforms: PlatformConfig[] = []

  const levelWidth = width * TILE_SIZE
  let currentX = 100

  // Starting platform (safe zone)
  platforms.push({
    x: 20,
    y: GROUND_Y - 40,
    width: 80,
    height: 24,
    type: 'static',
  })

  // Generate main path
  while (currentX < levelWidth - 150) {
    const gap = config.gapSize.min + random() * (config.gapSize.max - config.gapSize.min)
    currentX += gap

    if (currentX >= levelWidth - 150) break

    const platformWidth = PLATFORM_WIDTH_MIN + random() * (PLATFORM_WIDTH_MAX - PLATFORM_WIDTH_MIN)
    const baseY = GROUND_Y - MIN_PLATFORM_HEIGHT
    const heightOffset = (random() - 0.5) * config.heightVariance
    const y = Math.max(
      GROUND_Y - MAX_PLATFORM_HEIGHT,
      Math.min(GROUND_Y - MIN_PLATFORM_HEIGHT + 20, baseY + heightOffset)
    )

    // Determine platform type
    const isMoving = random() < config.movingPlatformChance

    if (isMoving) {
      platforms.push({
        x: currentX,
        y,
        width: platformWidth,
        height: 24,
        type: 'moving',
        movementRange: {
          startX: currentX - 30,
          endX: currentX + 30,
          speed: 1 + random() * 1.5,
        },
      })
    } else {
      platforms.push({
        x: currentX,
        y,
        width: platformWidth,
        height: 24,
        type: 'static',
      })
    }

    currentX += platformWidth
  }

  // Add skill-gated bonus area for harder levels
  if (difficulty >= 2 && requiredSkill) {
    const bonusY = GROUND_Y - MAX_PLATFORM_HEIGHT - 40
    platforms.push({
      x: levelWidth * 0.6,
      y: bonusY,
      width: 100,
      height: 24,
      type: 'skill_gated',
      requiredSkill,
    })
  }

  // Exit platform
  platforms.push({
    x: levelWidth - 100,
    y: GROUND_Y - 50,
    width: 80,
    height: 24,
    type: 'static',
  })

  return platforms
}

// ============================================
// COLLECTIBLE GENERATION
// ============================================

export function generateLevelCollectibles(
  levelId: string,
  platforms: PlatformConfig[],
  difficulty: LevelDifficulty
): CollectibleConfig[] {
  const config = DIFFICULTY_CONFIGS[difficulty]
  const seed = hashString(levelId + '_collectibles')
  const random = seededRandom(seed)
  const collectibles: CollectibleConfig[] = []

  const techNames = [
    'React', 'TypeScript', 'Node.js', 'Next.js',
    'GraphQL', 'PostgreSQL', 'Redis', 'Docker',
  ]

  // Place collectibles on and above platforms
  for (const platform of platforms) {
    if (platform.type === 'skill_gated') {
      // Always place tech on skill-gated platforms
      collectibles.push({
        x: platform.x + platform.width / 2,
        y: platform.y - 30,
        type: 'tech',
        techName: techNames[Math.floor(random() * techNames.length)],
        points: 100,
      })
      continue
    }

    if (random() > config.collectibleDensity) continue

    // Place 1-3 collectibles per platform
    const count = Math.floor(1 + random() * 2)
    for (let i = 0; i < count; i++) {
      const xOffset = (platform.width / (count + 1)) * (i + 1)
      const yOffset = 20 + random() * 40

      const isTech = random() < 0.3
      collectibles.push({
        x: platform.x + xOffset,
        y: platform.y - yOffset,
        type: isTech ? 'tech' : 'coin',
        techName: isTech ? techNames[Math.floor(random() * techNames.length)] : undefined,
        points: isTech ? 50 : 10,
      })
    }
  }

  // Add some floating collectibles in gaps
  for (let i = 0; i < platforms.length - 1; i++) {
    const platform = platforms[i]
    const nextPlatform = platforms[i + 1]
    const gapX = (platform.x + platform.width + nextPlatform.x) / 2

    if (random() < 0.3) {
      const avgY = (platform.y + nextPlatform.y) / 2
      collectibles.push({
        x: gapX,
        y: avgY - 20,
        type: 'coin',
        points: 20,
      })
    }
  }

  return collectibles
}

// ============================================
// CHECKPOINT GENERATION
// ============================================

export function generateLevelCheckpoints(
  levelId: string,
  platforms: PlatformConfig[],
  difficulty: LevelDifficulty
): CheckpointConfig[] {
  const checkpoints: CheckpointConfig[] = []

  // Place checkpoints at 1/3 and 2/3 of the level (not for hardest levels)
  if (difficulty < 3 && platforms.length > 6) {
    const oneThird = Math.floor(platforms.length / 3)
    const twoThirds = Math.floor((platforms.length * 2) / 3)

    const platform1 = platforms[oneThird]
    if (platform1 && platform1.type === 'static') {
      checkpoints.push({
        x: platform1.x + platform1.width / 2,
        y: platform1.y - 10,
        id: `${levelId}_checkpoint_1`,
      })
    }

    if (difficulty < 2) {
      const platform2 = platforms[twoThirds]
      if (platform2 && platform2.type === 'static') {
        checkpoints.push({
          x: platform2.x + platform2.width / 2,
          y: platform2.y - 10,
          id: `${levelId}_checkpoint_2`,
        })
      }
    }
  }

  return checkpoints
}

// ============================================
// FULL LEVEL GENERATION
// ============================================

export function populateLevelData(level: Level, unlockedSkills: SkillId[]): Level {
  // Determine if there's a skill to gate content with
  const gatableSkill = unlockedSkills.length > 0
    ? unlockedSkills[Math.floor(Math.random() * unlockedSkills.length)]
    : undefined

  const platforms = generateLevelPlatforms(
    level.id,
    level.width,
    level.difficulty,
    level.difficulty >= 2 ? gatableSkill : undefined
  )

  const collectibles = generateLevelCollectibles(
    level.id,
    platforms,
    level.difficulty
  )

  const checkpoints = generateLevelCheckpoints(
    level.id,
    platforms,
    level.difficulty
  )

  // Find last platform for exit
  const lastPlatform = platforms[platforms.length - 1]

  return {
    ...level,
    platforms,
    collectibles,
    checkpoints,
    spawnPoint: { x: 40, y: GROUND_Y - 80 },
    exitPoint: {
      x: lastPlatform.x + lastPlatform.width / 2,
      y: lastPlatform.y,
    },
  }
}

// ============================================
// HELPERS
// ============================================

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

// ============================================
// LEVEL BOUNDS
// ============================================

export function getLevelBounds(level: Level): {
  minX: number
  maxX: number
  minY: number
  maxY: number
} {
  return {
    minX: 0,
    maxX: level.width * TILE_SIZE,
    minY: 0,
    maxY: GROUND_Y + 50,
  }
}

export function isAtLevelExit(
  playerX: number,
  playerY: number,
  playerWidth: number,
  playerHeight: number,
  exitX: number,
  exitY: number
): boolean {
  const exitWidth = 40
  const exitHeight = 60

  return (
    playerX + playerWidth > exitX - exitWidth / 2 &&
    playerX < exitX + exitWidth / 2 &&
    playerY + playerHeight > exitY - exitHeight &&
    playerY < exitY
  )
}
