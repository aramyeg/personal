/**
 * Game State Management
 * Centralized Zustand store for career platformer game mechanics
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  GameMode,
  PowerUpType,
  ActivePowerUp,
  Achievement,
  AchievementId,
  ExtendedGameState,
} from './types'

// ============================================
// CONSTANTS
// ============================================

/** Number of unique technology collectible types in the game */
export const TOTAL_TECH_TYPES = 8

/** Speedrun target times in milliseconds */
export const SPEEDRUN_TARGETS = {
  GOLD: 30000,   // Under 30s
  SILVER: 60000, // Under 60s
} as const

// ============================================
// GAME MODE CONFIGURATIONS
// ============================================

export const GAME_MODE_CONFIGS: Record<GameMode, {
  lives: number
  timeLimit: number | null
  scoreMultiplier: number
  hasCheckpoints: boolean
  powerUpsEnabled: boolean
}> = {
  classic: {
    lives: 3,
    timeLimit: null,
    scoreMultiplier: 1,
    hasCheckpoints: true,
    powerUpsEnabled: true,
  },
  speedrun: {
    lives: 3,
    timeLimit: 60000,
    scoreMultiplier: 1.5,
    hasCheckpoints: true,
    powerUpsEnabled: true,
  },
  hardcore: {
    lives: 1,
    timeLimit: null,
    scoreMultiplier: 2,
    hasCheckpoints: false,
    powerUpsEnabled: false,
  },
}

// ============================================
// INITIAL ACHIEVEMENTS
// ============================================

const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_platform',
    name: 'First Steps',
    description: 'Reach your first career milestone',
    icon: '👣',
    unlocked: false,
  },
  {
    id: 'all_platforms',
    name: 'Journey Complete',
    description: 'Visit all career milestones',
    icon: '🏆',
    unlocked: false,
  },
  {
    id: 'first_tech',
    name: 'Tech Collector',
    description: 'Collect your first technology',
    icon: '💎',
    unlocked: false,
  },
  {
    id: 'all_tech',
    name: 'Full Stack',
    description: 'Collect all technology types',
    icon: '🌟',
    unlocked: false,
  },
  {
    id: 'speedrun_60s',
    name: 'Speed Runner',
    description: 'Complete the game in under 60 seconds',
    icon: '⚡',
    unlocked: false,
  },
  {
    id: 'speedrun_30s',
    name: 'Lightning Fast',
    description: 'Complete the game in under 30 seconds',
    icon: '⏱️',
    unlocked: false,
  },
  {
    id: 'no_damage',
    name: 'Flawless',
    description: 'Complete the game without losing a life',
    icon: '💪',
    unlocked: false,
  },
  {
    id: 'collector',
    name: 'Completionist',
    description: 'Collect all items in a single run',
    icon: '🎯',
    unlocked: false,
  },
  {
    id: 'hardcore_complete',
    name: 'Hardcore Champion',
    description: 'Complete the game in Hardcore mode',
    icon: '💀',
    unlocked: false,
  },
]

// ============================================
// INITIAL STATE
// ============================================

const createInitialState = (mode: GameMode = 'classic'): ExtendedGameState => {
  const config = GAME_MODE_CONFIGS[mode]
  return {
    mode,
    lives: config.lives,
    maxLives: config.lives,
    gameStarted: false,
    gamePaused: false,
    gameOver: false,
    gameWon: false,
    gameTime: 0,
    timeLimit: config.timeLimit,
    score: 0,
    scoreMultiplier: config.scoreMultiplier,
    activePowerUps: [],
    platformsReached: 0,
    totalPlatforms: 0,
    currentPlatformIndex: null,
    lastCheckpointIndex: -1,
    techCollected: [],
    totalCollectibles: 0,
    collectiblesCollected: 0,
    achievements: loadAchievements(),
    recentAchievement: null,
  }
}

// ============================================
// PERSISTENCE
// ============================================

/** Valid achievement IDs for validation */
const VALID_ACHIEVEMENT_IDS: Set<AchievementId> = new Set([
  'first_platform',
  'all_platforms',
  'first_tech',
  'all_tech',
  'speedrun_60s',
  'speedrun_30s',
  'no_damage',
  'collector',
  'hardcore_complete',
])

type StoredAchievement = { id: AchievementId; unlockedAt: number }

/**
 * Validates stored achievement data structure
 */
function isValidStoredAchievements(data: unknown): data is StoredAchievement[] {
  if (!Array.isArray(data)) return false

  return data.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      'unlockedAt' in item &&
      typeof item.id === 'string' &&
      VALID_ACHIEVEMENT_IDS.has(item.id as AchievementId) &&
      typeof item.unlockedAt === 'number'
  )
}

function loadAchievements(): Achievement[] {
  if (typeof window === 'undefined') return INITIAL_ACHIEVEMENTS

  try {
    const stored = localStorage.getItem('career-game-achievements')
    if (!stored) return INITIAL_ACHIEVEMENTS

    const parsed: unknown = JSON.parse(stored)

    if (!isValidStoredAchievements(parsed)) {
      // Invalid data, clear and return fresh achievements
      localStorage.removeItem('career-game-achievements')
      return INITIAL_ACHIEVEMENTS
    }

    const unlockedMap = new Map<AchievementId, number>(
      parsed.map((u) => [u.id, u.unlockedAt])
    )

    return INITIAL_ACHIEVEMENTS.map((a) => ({
      ...a,
      unlocked: unlockedMap.has(a.id),
      unlockedAt: unlockedMap.get(a.id),
    }))
  } catch {
    return INITIAL_ACHIEVEMENTS
  }
}

function saveAchievements(achievements: Achievement[]): void {
  if (typeof window === 'undefined') return

  const unlocked = achievements
    .filter((a) => a.unlocked)
    .map((a) => ({ id: a.id, unlockedAt: a.unlockedAt }))

  localStorage.setItem('career-game-achievements', JSON.stringify(unlocked))
}

// ============================================
// STORE ACTIONS TYPE
// ============================================

type GameStateActions = {
  // Initialization
  initGame: (mode: GameMode, totalPlatforms: number, totalCollectibles: number) => void
  resetGame: () => void

  // Game flow
  startGame: () => void
  pauseGame: () => void
  resumeGame: () => void
  setGameOver: () => void
  setGameWon: () => void

  // Lives
  loseLife: () => boolean // Returns true if game over
  setLives: (lives: number) => void

  // Score
  addScore: (points: number) => void

  // Time
  updateGameTime: (deltaMs: number) => void
  isTimeUp: () => boolean

  // Platforms
  reachPlatform: (index: number) => void
  setCheckpoint: (index: number) => void
  getCheckpointIndex: () => number

  // Collectibles
  collectTech: (techName: string, points: number) => void

  // Power-ups
  activatePowerUp: (type: PowerUpType, durationMs: number) => void
  updatePowerUps: () => void
  hasPowerUp: (type: PowerUpType) => boolean
  getPowerUpMultiplier: (type: 'speed' | 'jump' | 'magnet') => number

  // Achievements
  checkAchievements: () => void
  clearRecentAchievement: () => void
}

// ============================================
// ZUSTAND STORE
// ============================================

export const useGameState = create<ExtendedGameState & GameStateActions>()(
  immer((set, get) => ({
    ...createInitialState(),

    // ========== INITIALIZATION ==========

    initGame: (mode, totalPlatforms, totalCollectibles) => {
      set((state) => {
        const config = GAME_MODE_CONFIGS[mode]
        state.mode = mode
        state.lives = config.lives
        state.maxLives = config.lives
        state.timeLimit = config.timeLimit
        state.scoreMultiplier = config.scoreMultiplier
        state.totalPlatforms = totalPlatforms
        state.totalCollectibles = totalCollectibles
        state.gameStarted = false
        state.gamePaused = false
        state.gameOver = false
        state.gameWon = false
        state.gameTime = 0
        state.score = 0
        state.platformsReached = 0
        state.currentPlatformIndex = null
        state.lastCheckpointIndex = -1
        state.techCollected = []
        state.collectiblesCollected = 0
        state.activePowerUps = []
        state.recentAchievement = null
      })
    },

    resetGame: () => {
      const { mode, totalPlatforms, totalCollectibles, achievements } = get()
      set((state) => {
        const config = GAME_MODE_CONFIGS[mode]
        state.lives = config.lives
        state.maxLives = config.lives
        state.gameStarted = false
        state.gamePaused = false
        state.gameOver = false
        state.gameWon = false
        state.gameTime = 0
        state.score = 0
        state.platformsReached = 0
        state.currentPlatformIndex = null
        state.lastCheckpointIndex = -1
        state.techCollected = []
        state.collectiblesCollected = 0
        state.activePowerUps = []
        state.recentAchievement = null
        state.achievements = achievements // Keep achievements
      })
    },

    // ========== GAME FLOW ==========

    startGame: () => set((state) => { state.gameStarted = true }),
    pauseGame: () => set((state) => { state.gamePaused = true }),
    resumeGame: () => set((state) => { state.gamePaused = false }),
    setGameOver: () => set((state) => { state.gameOver = true }),
    setGameWon: () => set((state) => { state.gameWon = true }),

    // ========== LIVES ==========

    loseLife: () => {
      const { lives, mode } = get()
      const newLives = lives - 1

      set((state) => {
        state.lives = newLives
        if (newLives <= 0) {
          state.gameOver = true
        }
      })

      // In hardcore mode or no lives left = game over
      return newLives <= 0
    },

    setLives: (lives) => set((state) => { state.lives = lives }),

    // ========== SCORE ==========

    addScore: (points) => {
      const { scoreMultiplier, activePowerUps } = get()
      const hasDoublePoints = activePowerUps.some(
        (p) => p.type === 'magnet' && p.expiresAt > Date.now()
      )
      const multiplier = scoreMultiplier * (hasDoublePoints ? 1.5 : 1)
      const earnedPoints = Math.floor(points * multiplier)

      set((state) => {
        state.score += earnedPoints
      })
    },

    // ========== TIME ==========

    updateGameTime: (deltaMs) => {
      set((state) => {
        state.gameTime += deltaMs
      })
    },

    isTimeUp: () => {
      const { timeLimit, gameTime } = get()
      return timeLimit !== null && gameTime >= timeLimit
    },

    // ========== PLATFORMS ==========

    reachPlatform: (index) => {
      const { currentPlatformIndex, mode, totalPlatforms } = get()

      if (currentPlatformIndex === index) return

      set((state) => {
        state.currentPlatformIndex = index
        state.platformsReached += 1

        // Set checkpoint in modes that support it
        if (GAME_MODE_CONFIGS[mode].hasCheckpoints) {
          state.lastCheckpointIndex = index
        }

        // Check if final platform
        if (index === totalPlatforms - 1) {
          state.gameWon = true
        }
      })

      // Check achievements after platform reach
      get().checkAchievements()
    },

    setCheckpoint: (index) => {
      set((state) => {
        state.lastCheckpointIndex = index
      })
    },

    getCheckpointIndex: () => {
      const { lastCheckpointIndex, mode } = get()
      if (!GAME_MODE_CONFIGS[mode].hasCheckpoints) return -1
      return lastCheckpointIndex
    },

    // ========== COLLECTIBLES ==========

    collectTech: (techName, points) => {
      set((state) => {
        if (!state.techCollected.includes(techName)) {
          state.techCollected.push(techName)
        }
        state.collectiblesCollected += 1
      })

      get().addScore(points)
      get().checkAchievements()
    },

    // ========== POWER-UPS ==========

    activatePowerUp: (type, durationMs) => {
      const expiresAt = Date.now() + durationMs

      set((state) => {
        const existing = state.activePowerUps.findIndex((p) => p.type === type)

        if (existing >= 0) {
          // Extend existing power-up
          state.activePowerUps[existing].expiresAt = expiresAt
        } else {
          state.activePowerUps.push({ type, expiresAt, duration: durationMs })
        }
      })
    },

    updatePowerUps: () => {
      const now = Date.now()
      set((state) => {
        state.activePowerUps = state.activePowerUps.filter((p) => p.expiresAt > now)
      })
    },

    hasPowerUp: (type) => {
      const { activePowerUps } = get()
      const now = Date.now()
      return activePowerUps.some((p) => p.type === type && p.expiresAt > now)
    },

    getPowerUpMultiplier: (type) => {
      const { activePowerUps } = get()
      const now = Date.now()

      const multipliers: Record<string, { powerUp: PowerUpType; value: number }> = {
        speed: { powerUp: 'speed_boost', value: 1.5 },
        jump: { powerUp: 'super_jump', value: 1.4 },
        magnet: { powerUp: 'magnet', value: 2.0 },
      }

      const config = multipliers[type]
      if (!config) return 1

      const active = activePowerUps.find(
        (p) => p.type === config.powerUp && p.expiresAt > now
      )
      return active ? config.value : 1
    },

    // ========== ACHIEVEMENTS ==========

    checkAchievements: () => {
      const state = get()
      let newlyUnlocked: Achievement | null = null

      set((draft) => {
        draft.achievements = draft.achievements.map((achievement) => {
          if (achievement.unlocked) return achievement

          let shouldUnlock = false

          switch (achievement.id) {
            case 'first_platform':
              shouldUnlock = state.platformsReached >= 1
              break
            case 'all_platforms':
              shouldUnlock = state.gameWon && state.platformsReached >= state.totalPlatforms
              break
            case 'first_tech':
              shouldUnlock = state.techCollected.length >= 1
              break
            case 'all_tech':
              shouldUnlock = state.techCollected.length >= TOTAL_TECH_TYPES
              break
            case 'speedrun_60s':
              shouldUnlock = state.gameWon && state.gameTime < SPEEDRUN_TARGETS.SILVER
              break
            case 'speedrun_30s':
              shouldUnlock = state.gameWon && state.gameTime < SPEEDRUN_TARGETS.GOLD
              break
            case 'no_damage':
              shouldUnlock = state.gameWon && state.lives === state.maxLives
              break
            case 'collector':
              shouldUnlock = state.collectiblesCollected >= state.totalCollectibles && state.totalCollectibles > 0
              break
            case 'hardcore_complete':
              shouldUnlock = state.gameWon && state.mode === 'hardcore'
              break
          }

          if (shouldUnlock) {
            newlyUnlocked = {
              ...achievement,
              unlocked: true,
              unlockedAt: Date.now(),
            }
            return newlyUnlocked
          }

          return achievement
        })

        if (newlyUnlocked) {
          draft.recentAchievement = newlyUnlocked
        }
      })

      // Persist to localStorage
      if (newlyUnlocked) {
        saveAchievements(get().achievements)
      }
    },

    clearRecentAchievement: () => {
      set((state) => {
        state.recentAchievement = null
      })
    },
  }))
)

// ============================================
// SELECTOR HOOKS
// ============================================

export const useGameMode = () => useGameState((s) => s.mode)
export const useLives = () => useGameState((s) => s.lives)
export const useMaxLives = () => useGameState((s) => s.maxLives)
export const useScore = () => useGameState((s) => s.score)
export const useGameTime = () => useGameState((s) => s.gameTime)
export const useTimeLimit = () => useGameState((s) => s.timeLimit)
export const useActivePowerUps = () => useGameState((s) => s.activePowerUps)
export const useIsGameOver = () => useGameState((s) => s.gameOver)
export const useIsGameWon = () => useGameState((s) => s.gameWon)
export const useIsGameStarted = () => useGameState((s) => s.gameStarted)
export const useAchievements = () => useGameState((s) => s.achievements)
export const useRecentAchievement = () => useGameState((s) => s.recentAchievement)

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function getRemainingTime(gameTime: number, timeLimit: number | null): number | null {
  if (timeLimit === null) return null
  return Math.max(0, timeLimit - gameTime)
}
