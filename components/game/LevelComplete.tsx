'use client'

import { motion } from 'framer-motion'
import { Star, Clock, Trophy, Zap, RotateCcw, ArrowRight } from 'lucide-react'
import {
  useLastCompletionData,
  useWorldState,
  SKILLS,
  getWorldById,
} from '@/lib/game/world'

export function LevelComplete() {
  const completionData = useLastCompletionData()
  const { worlds, exitToOverworld, enterLevel, showSkillUnlock } = useWorldState()

  if (!completionData) return null

  const {
    levelId,
    worldId,
    time,
    deaths,
    collectiblesCollected,
    totalCollectibles,
    starsEarned,
    isNewBestTime,
    isFirstCompletion,
    skillUnlocked,
    worldCompleted,
  } = completionData

  const world = getWorldById(worlds, worldId)
  const level = world?.levels.find((l) => l.id === levelId)

  const handleContinue = () => {
    if (skillUnlocked) {
      showSkillUnlock(skillUnlocked)
    } else {
      exitToOverworld()
    }
  }

  const handleReplay = () => {
    enterLevel(levelId)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center z-20"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="bg-card border border-border rounded-xl p-6 w-[90%] max-w-sm shadow-xl text-center"
      >
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Trophy className="h-12 w-12 mx-auto text-yellow-400 mb-2" />
          <h2 className="text-xl font-bold">
            {isFirstCompletion ? 'Level Complete!' : 'Level Cleared!'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {world?.name} - {level?.name}
          </p>
        </motion.div>

        {/* Stars */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="flex items-center justify-center gap-2 my-6"
        >
          {[1, 2, 3].map((star, index) => (
            <motion.div
              key={star}
              initial={{ scale: 0, rotate: -180 }}
              animate={{
                scale: star <= starsEarned ? 1 : 0.6,
                rotate: 0,
              }}
              transition={{ delay: 0.3 + index * 0.15, type: 'spring' }}
            >
              <Star
                className={`h-10 w-10 ${
                  star <= starsEarned
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-muted-foreground/30'
                }`}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-3 gap-4 mb-6"
        >
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Clock className="h-3 w-3" />
              <span className="text-[10px] uppercase">Time</span>
            </div>
            <div className="font-bold text-sm">{formatTime(time)}</div>
            {isNewBestTime && (
              <span className="text-[10px] text-green-500 font-medium">
                New Best!
              </span>
            )}
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Zap className="h-3 w-3" />
              <span className="text-[10px] uppercase">Deaths</span>
            </div>
            <div className="font-bold text-sm">{deaths}</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Star className="h-3 w-3" />
              <span className="text-[10px] uppercase">Items</span>
            </div>
            <div className="font-bold text-sm">
              {collectiblesCollected}/{totalCollectibles}
            </div>
          </div>
        </motion.div>

        {/* World completed badge */}
        {worldCompleted && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
            className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20"
          >
            <div className="flex items-center justify-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="font-bold text-primary">World Complete!</span>
            </div>
            {skillUnlocked && (
              <p className="text-xs text-muted-foreground mt-1">
                New skill unlocked: {SKILLS[skillUnlocked].icon}{' '}
                {SKILLS[skillUnlocked].name}
              </p>
            )}
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex gap-3"
        >
          <motion.button
            onClick={handleReplay}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-muted hover:bg-muted/80 font-medium text-sm transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <RotateCcw className="h-4 w-4" />
            Replay
          </motion.button>

          <motion.button
            onClick={handleContinue}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const centiseconds = Math.floor((ms % 1000) / 10)
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds
    .toString()
    .padStart(2, '0')}`
}
