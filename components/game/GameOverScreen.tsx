'use client'

import { motion } from 'framer-motion'
import { Skull, RotateCcw, Home, Trophy, Clock, Target, Star } from 'lucide-react'
import {
  useScore,
  useGameTime,
  useGameState,
  formatTime,
} from '@/lib/game/gameState'

type GameOverScreenProps = {
  onRetry: () => void
  onMainMenu: () => void
}

export function GameOverScreen({ onRetry, onMainMenu }: GameOverScreenProps) {
  const score = useScore()
  const gameTime = useGameTime()
  const {
    platformsReached,
    totalPlatforms,
    collectiblesCollected,
    totalCollectibles,
    mode,
  } = useGameState()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-4 z-20"
    >
      <motion.div
        animate={{
          rotate: [0, -10, 10, -10, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 0.5 }}
      >
        <Skull className="h-16 w-16 text-destructive" />
      </motion.div>

      <h2 className="text-2xl font-bold">Game Over</h2>

      {mode === 'hardcore' && (
        <p className="text-sm text-muted-foreground">
          Hardcore mode is unforgiving!
        </p>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 text-sm bg-card/50 p-4 rounded-lg border border-border">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-400" />
          <span>Score: {score}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <span>Time: {formatTime(gameTime)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-green-400" />
          <span>
            Platforms: {platformsReached}/{totalPlatforms}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-purple-400" />
          <span>
            Items: {collectiblesCollected}/{totalCollectibles}
          </span>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="w-full max-w-xs">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Progress</span>
          <span>{Math.round((platformsReached / totalPlatforms) * 100)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${(platformsReached / totalPlatforms) * 100}%` }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-4">
        <motion.button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <RotateCcw className="h-4 w-4" />
          Try Again
        </motion.button>
        <motion.button
          onClick={onMainMenu}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Home className="h-4 w-4" />
          Menu
        </motion.button>
      </div>
    </motion.div>
  )
}
