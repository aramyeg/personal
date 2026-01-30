/**
 * World Progression State Management
 * Zustand store for Super Mario World-style progression
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type {
  GameScreen,
  WorldId,
  SkillId,
  World,
  Level,
  StarRating,
  WorldProgress,
  LevelProgress,
  LevelCompletionData,
} from './types'
import {
  generateWorlds,
  getWorldById,
  getLevelById,
  getNextWorld,
  isWorldComplete,
  getWorldStars,
  calculateStars,
} from './worldData'
import { createInitialSkillState, type SkillState } from './skillConfig'

// ============================================
// STATE TYPE
// ============================================

type WorldProgressState = {
  // Navigation
  currentScreen: GameScreen
  selectedWorldId: WorldId | null
  currentWorldId: WorldId | null
  currentLevelId: string | null

  // World data
  worlds: World[]

  // Progress tracking
  unlockedSkills: SkillId[]
  worldProgress: Record<WorldId, WorldProgress>
  levelProgress: Record<string, LevelProgress>
  totalStarsEarned: number

  // Level gameplay state
  levelDeaths: number
  levelCollectiblesCollected: number
  levelTotalCollectibles: number
  levelStartTime: number | null

  // Skill runtime state
  skillState: SkillState

  // Completion data for UI
  lastCompletionData: LevelCompletionData | null
  pendingSkillUnlock: SkillId | null
}

// ============================================
// ACTIONS TYPE
// ============================================

type WorldProgressActions = {
  // Navigation
  goToMenu: () => void
  goToOverworld: () => void
  selectWorld: (worldId: WorldId) => void
  deselectWorld: () => void
  enterLevel: (levelId: string) => void
  exitToOverworld: () => void

  // Level gameplay
  startLevelTimer: () => void
  recordDeath: () => void
  collectLevelItem: () => void
  setLevelCollectibles: (total: number) => void
  completeLevel: () => void

  // Skill management
  unlockSkill: (skillId: SkillId) => void
  hasSkill: (skillId: SkillId) => boolean
  updateSkillState: (updates: Partial<SkillState>) => void
  resetSkillState: () => void

  // Screen transitions
  showLevelComplete: () => void
  showSkillUnlock: (skillId: SkillId) => void
  dismissSkillUnlock: () => void

  // Persistence
  resetProgress: () => void

  // Getters
  getCurrentWorld: () => World | undefined
  getCurrentLevel: () => Level | undefined
  getWorldProgress: (worldId: WorldId) => WorldProgress | undefined
  getLevelProgress: (levelId: string) => LevelProgress | undefined
}

// ============================================
// INITIAL STATE
// ============================================

function createInitialState(): WorldProgressState {
  const worlds = generateWorlds()

  const worldProgress: Record<WorldId, WorldProgress> = {} as Record<WorldId, WorldProgress>
  const levelProgress: Record<string, LevelProgress> = {}

  for (const world of worlds) {
    worldProgress[world.id] = {
      worldId: world.id,
      completed: false,
      totalStars: 0,
      levelsCompleted: 0,
    }

    for (const level of world.levels) {
      levelProgress[level.id] = {
        levelId: level.id,
        completed: false,
        starsEarned: 0,
        bestTime: null,
        collectiblesCollected: 0,
        totalCollectibles: 0,
      }
    }
  }

  return {
    currentScreen: 'overworld',
    selectedWorldId: null,
    currentWorldId: null,
    currentLevelId: null,
    worlds,
    unlockedSkills: [],
    worldProgress,
    levelProgress,
    totalStarsEarned: 0,
    levelDeaths: 0,
    levelCollectiblesCollected: 0,
    levelTotalCollectibles: 0,
    levelStartTime: null,
    skillState: createInitialSkillState(),
    lastCompletionData: null,
    pendingSkillUnlock: null,
  }
}

// ============================================
// STORE
// ============================================

export const useWorldState = create<WorldProgressState & WorldProgressActions>()(
  persist(
    immer((set, get) => ({
      ...createInitialState(),

      // ========== NAVIGATION ==========

      goToMenu: () => {
        set((state) => {
          state.currentScreen = 'menu'
          state.selectedWorldId = null
          state.currentWorldId = null
          state.currentLevelId = null
        })
      },

      goToOverworld: () => {
        set((state) => {
          state.currentScreen = 'overworld'
          state.currentLevelId = null
        })
      },

      selectWorld: (worldId) => {
        const world = getWorldById(get().worlds, worldId)
        if (!world || !world.unlocked) return

        set((state) => {
          state.selectedWorldId = worldId
        })
      },

      deselectWorld: () => {
        set((state) => {
          state.selectedWorldId = null
        })
      },

      enterLevel: (levelId) => {
        const level = getLevelById(get().worlds, levelId)
        if (!level) return

        const world = getWorldById(get().worlds, level.worldId)
        if (!world || !world.unlocked) return

        set((state) => {
          state.currentScreen = 'level'
          state.currentWorldId = level.worldId
          state.currentLevelId = levelId
          state.selectedWorldId = null
          state.levelDeaths = 0
          state.levelCollectiblesCollected = 0
          state.levelStartTime = null
          state.skillState = createInitialSkillState()
        })
      },

      exitToOverworld: () => {
        set((state) => {
          state.currentScreen = 'overworld'
          state.currentLevelId = null
          state.lastCompletionData = null
          state.pendingSkillUnlock = null
        })
      },

      // ========== LEVEL GAMEPLAY ==========

      startLevelTimer: () => {
        set((state) => {
          state.levelStartTime = Date.now()
        })
      },

      recordDeath: () => {
        set((state) => {
          state.levelDeaths += 1
        })
      },

      collectLevelItem: () => {
        set((state) => {
          state.levelCollectiblesCollected += 1
        })
      },

      setLevelCollectibles: (total) => {
        set((state) => {
          state.levelTotalCollectibles = total
        })
      },

      completeLevel: () => {
        const {
          currentLevelId,
          currentWorldId,
          levelDeaths,
          levelCollectiblesCollected,
          levelTotalCollectibles,
          levelStartTime,
          worlds,
          levelProgress,
          unlockedSkills,
        } = get()

        if (!currentLevelId || !currentWorldId) return

        const world = getWorldById(worlds, currentWorldId)
        const level = getLevelById(worlds, currentLevelId)
        if (!world || !level) return

        const time = levelStartTime ? Date.now() - levelStartTime : 0
        const collectRatio = levelTotalCollectibles > 0
          ? levelCollectiblesCollected / levelTotalCollectibles
          : 1
        const stars = calculateStars(levelDeaths, collectRatio)

        const existingProgress = levelProgress[currentLevelId]
        const isFirstCompletion = !existingProgress?.completed
        const isNewBestTime = !existingProgress?.bestTime || time < existingProgress.bestTime

        set((state) => {
          // Update level in worlds array
          for (const w of state.worlds) {
            if (w.id === currentWorldId) {
              for (const l of w.levels) {
                if (l.id === currentLevelId) {
                  l.completed = true
                  l.starsEarned = Math.max(l.starsEarned, stars) as StarRating
                  if (!l.bestTime || time < l.bestTime) {
                    l.bestTime = time
                  }
                }
              }

              // Check if world is now complete
              const worldComplete = isWorldComplete(w)
              if (worldComplete && !w.completed) {
                w.completed = true

                // Unlock next world
                const nextWorld = getNextWorld(state.worlds, currentWorldId)
                if (nextWorld) {
                  for (const nw of state.worlds) {
                    if (nw.id === nextWorld.id) {
                      nw.unlocked = true
                    }
                  }
                }
              }
            }
          }

          // Update level progress
          state.levelProgress[currentLevelId] = {
            levelId: currentLevelId,
            completed: true,
            starsEarned: Math.max(existingProgress?.starsEarned ?? 0, stars) as StarRating,
            bestTime: isNewBestTime ? time : existingProgress?.bestTime ?? time,
            collectiblesCollected: Math.max(
              existingProgress?.collectiblesCollected ?? 0,
              levelCollectiblesCollected
            ),
            totalCollectibles: levelTotalCollectibles,
          }

          // Update world progress
          const updatedWorld = getWorldById(state.worlds, currentWorldId)
          if (updatedWorld) {
            state.worldProgress[currentWorldId] = {
              worldId: currentWorldId,
              completed: updatedWorld.completed,
              totalStars: getWorldStars(updatedWorld),
              levelsCompleted: updatedWorld.levels.filter((l) => l.completed).length,
            }
          }

          // Calculate total stars
          state.totalStarsEarned = Object.values(state.levelProgress)
            .reduce((sum, lp) => sum + lp.starsEarned, 0)

          // Check for skill unlock
          let skillUnlocked: SkillId | null = null
          const completedWorld = getWorldById(state.worlds, currentWorldId)
          if (
            completedWorld?.completed &&
            completedWorld.grantsSkill &&
            !unlockedSkills.includes(completedWorld.grantsSkill)
          ) {
            skillUnlocked = completedWorld.grantsSkill
            state.unlockedSkills.push(skillUnlocked)
            state.pendingSkillUnlock = skillUnlocked
          }

          // Set completion data
          state.lastCompletionData = {
            levelId: currentLevelId,
            worldId: currentWorldId,
            time,
            deaths: levelDeaths,
            collectiblesCollected: levelCollectiblesCollected,
            totalCollectibles: levelTotalCollectibles,
            starsEarned: stars,
            isNewBestTime,
            isFirstCompletion,
            skillUnlocked,
            worldCompleted: completedWorld?.completed ?? false,
          }
        })
      },

      // ========== SKILL MANAGEMENT ==========

      unlockSkill: (skillId) => {
        set((state) => {
          if (!state.unlockedSkills.includes(skillId)) {
            state.unlockedSkills.push(skillId)
          }
        })
      },

      hasSkill: (skillId) => {
        return get().unlockedSkills.includes(skillId)
      },

      updateSkillState: (updates) => {
        set((state) => {
          state.skillState = { ...state.skillState, ...updates }
        })
      },

      resetSkillState: () => {
        set((state) => {
          state.skillState = createInitialSkillState()
        })
      },

      // ========== SCREEN TRANSITIONS ==========

      showLevelComplete: () => {
        set((state) => {
          state.currentScreen = 'level_complete'
        })
      },

      showSkillUnlock: (skillId) => {
        set((state) => {
          state.currentScreen = 'skill_unlock'
          state.pendingSkillUnlock = skillId
        })
      },

      dismissSkillUnlock: () => {
        set((state) => {
          state.pendingSkillUnlock = null
          state.currentScreen = 'overworld'
        })
      },

      // ========== PERSISTENCE ==========

      resetProgress: () => {
        set(createInitialState())
      },

      // ========== GETTERS ==========

      getCurrentWorld: () => {
        const { worlds, currentWorldId } = get()
        if (!currentWorldId) return undefined
        return getWorldById(worlds, currentWorldId)
      },

      getCurrentLevel: () => {
        const { worlds, currentLevelId } = get()
        if (!currentLevelId) return undefined
        return getLevelById(worlds, currentLevelId)
      },

      getWorldProgress: (worldId) => {
        return get().worldProgress[worldId]
      },

      getLevelProgress: (levelId) => {
        return get().levelProgress[levelId]
      },
    })),
    {
      name: 'career-game-world-progress',
      partialize: (state) => ({
        worlds: state.worlds,
        unlockedSkills: state.unlockedSkills,
        worldProgress: state.worldProgress,
        levelProgress: state.levelProgress,
        totalStarsEarned: state.totalStarsEarned,
      }),
    }
  )
)

// ============================================
// SELECTOR HOOKS
// ============================================

export const useCurrentScreen = () => useWorldState((s) => s.currentScreen)
export const useSelectedWorld = () => useWorldState((s) => s.selectedWorldId)
export const useCurrentWorldId = () => useWorldState((s) => s.currentWorldId)
export const useCurrentLevelId = () => useWorldState((s) => s.currentLevelId)
export const useWorlds = () => useWorldState((s) => s.worlds)
export const useUnlockedSkills = () => useWorldState((s) => s.unlockedSkills)
export const useTotalStars = () => useWorldState((s) => s.totalStarsEarned)
export const useLastCompletionData = () => useWorldState((s) => s.lastCompletionData)
export const usePendingSkillUnlock = () => useWorldState((s) => s.pendingSkillUnlock)
export const useSkillState = () => useWorldState((s) => s.skillState)
