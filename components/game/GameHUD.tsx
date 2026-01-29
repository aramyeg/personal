'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Timer, Star, Zap, Rocket, Shield, Magnet } from 'lucide-react'
import {
  useLives,
  useMaxLives,
  useScore,
  useGameTime,
  useTimeLimit,
  useActivePowerUps,
  useGameMode,
  formatTime,
  getRemainingTime,
} from '@/lib/game/gameState'
import type { PowerUpType } from '@/lib/game/types'

type GameHUDProps = {
  className?: string
}

const POWER_UP_ICONS: Record<PowerUpType, typeof Zap> = {
  speed_boost: Zap,
  super_jump: Rocket,
  shield: Shield,
  magnet: Magnet,
}

const POWER_UP_COLORS: Record<PowerUpType, string> = {
  speed_boost: 'text-yellow-400',
  super_jump: 'text-cyan-400',
  shield: 'text-green-400',
  magnet: 'text-pink-400',
}

export function GameHUD({ className = '' }: GameHUDProps) {
  const lives = useLives()
  const maxLives = useMaxLives()
  const score = useScore()
  const gameTime = useGameTime()
  const timeLimit = useTimeLimit()
  const activePowerUps = useActivePowerUps()
  const mode = useGameMode()

  const remainingTime = getRemainingTime(gameTime, timeLimit)
  const isLowTime = remainingTime !== null && remainingTime < 10000

  return (
    <div
      className={`absolute top-2 left-2 right-2 flex justify-between items-start pointer-events-none z-10 ${className}`}
    >
      {/* Lives */}
      <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-md border border-border/50">
        <AnimatePresence mode="popLayout">
          {Array.from({ length: maxLives }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1, opacity: i < lives ? 1 : 0.3 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            >
              <Heart
                className={`h-4 w-4 ${
                  i < lives ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
                }`}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Timer (speedrun mode or when there's a time limit) */}
      {timeLimit !== null && (
        <motion.div
          className={`flex items-center gap-1 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-md border border-border/50 ${
            isLowTime ? 'border-red-500/50' : ''
          }`}
          animate={isLowTime ? { scale: [1, 1.05, 1] } : {}}
          transition={{ repeat: Infinity, duration: 0.5 }}
        >
          <Timer className={`h-4 w-4 ${isLowTime ? 'text-red-500' : 'text-primary'}`} />
          <span
            className={`font-mono text-sm font-medium ${
              isLowTime ? 'text-red-500' : ''
            }`}
          >
            {formatTime(remainingTime ?? 0)}
          </span>
        </motion.div>
      )}

      {/* Elapsed time for classic mode */}
      {timeLimit === null && mode !== 'classic' && (
        <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-md border border-border/50">
          <Timer className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-sm text-muted-foreground">
            {formatTime(gameTime)}
          </span>
        </div>
      )}

      {/* Score */}
      <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-md border border-border/50">
        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        <motion.span
          key={score}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          className="font-mono text-sm font-medium"
        >
          {score}
        </motion.span>
      </div>

      {/* Active Power-ups */}
      <AnimatePresence>
        {activePowerUps.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-10 left-2 flex flex-col gap-1"
          >
            {activePowerUps.map((powerUp) => {
              const Icon = POWER_UP_ICONS[powerUp.type]
              const colorClass = POWER_UP_COLORS[powerUp.type]
              const now = Date.now()
              const remaining = Math.max(0, powerUp.expiresAt - now)
              const progress = remaining / powerUp.duration

              return (
                <motion.div
                  key={powerUp.type}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-md border border-border/50"
                >
                  <Icon className={`h-3 w-3 ${colorClass}`} />
                  <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${colorClass.replace('text-', 'bg-')}`}
                      initial={{ width: '100%' }}
                      animate={{ width: `${progress * 100}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
