'use client'

import { motion } from 'framer-motion'
import { X, Star, Clock, Lock, Play } from 'lucide-react'
import {
  useWorldState,
  WORLD_THEMES,
  SKILLS,
  type World,
  type Level,
} from '@/lib/game/world'

type LevelSelectModalProps = {
  world: World
  onClose: () => void
  onStartLevel: () => void
}

export function LevelSelectModal({
  world,
  onClose,
  onStartLevel,
}: LevelSelectModalProps) {
  const { enterLevel, levelProgress } = useWorldState()
  const theme = WORLD_THEMES[world.theme]

  const handleSelectLevel = (level: Level) => {
    // Check if level is accessible (first level or previous completed)
    const levelIndex = world.levels.findIndex((l) => l.id === level.id)
    const previousLevel = levelIndex > 0 ? world.levels[levelIndex - 1] : null
    const isAccessible = levelIndex === 0 || previousLevel?.completed

    if (isAccessible) {
      enterLevel(level.id)
      onStartLevel()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-20"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-card border border-border rounded-xl p-4 w-[90%] max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: theme.primaryColor }}
              />
              <h3 className="font-bold text-lg">{world.name}</h3>
            </div>
            <p className="text-xs text-muted-foreground">{world.company}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-md transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4">
          {world.description}
        </p>

        {/* Levels */}
        <div className="space-y-2">
          {world.levels.map((level, index) => {
            const progress = levelProgress[level.id]
            const previousLevel = index > 0 ? world.levels[index - 1] : null
            const isAccessible = index === 0 || previousLevel?.completed
            const stars = progress?.starsEarned ?? 0

            return (
              <motion.button
                key={level.id}
                onClick={() => handleSelectLevel(level)}
                disabled={!isAccessible}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  isAccessible
                    ? 'bg-card hover:bg-muted border-border cursor-pointer'
                    : 'bg-muted/50 border-border/50 cursor-not-allowed opacity-60'
                }`}
                whileHover={isAccessible ? { scale: 1.02 } : {}}
                whileTap={isAccessible ? { scale: 0.98 } : {}}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Level number */}
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                        isAccessible
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isAccessible ? (
                        index + 1
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                    </div>

                    {/* Level info */}
                    <div>
                      <div className="font-medium text-sm">{level.name}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {'⭐'.repeat(level.difficulty)}
                          {'☆'.repeat(3 - level.difficulty)}
                        </span>
                        {progress?.bestTime && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {formatTime(progress.bestTime)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stars earned */}
                  <div className="flex items-center gap-1">
                    {level.completed || progress?.completed ? (
                      <>
                        {[1, 2, 3].map((s) => (
                          <Star
                            key={s}
                            className={`h-4 w-4 ${
                              s <= stars
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-muted-foreground/30'
                            }`}
                          />
                        ))}
                      </>
                    ) : isAccessible ? (
                      <Play className="h-4 w-4 text-primary" />
                    ) : null}
                  </div>
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* Skill reward info */}
        {world.grantsSkill && (
          <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2">
              <span className="text-lg">{SKILLS[world.grantsSkill].icon}</span>
              <div>
                <p className="text-xs font-medium text-primary">
                  Complete to unlock:
                </p>
                <p className="text-sm font-bold">
                  {SKILLS[world.grantsSkill].name}
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
