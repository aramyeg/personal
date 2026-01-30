'use client'

import { motion } from 'framer-motion'
import { Gamepad2, Zap, Skull, Clock, Heart, Shield, Star } from 'lucide-react'
import type { GameMode } from '@/lib/game/types'

type GameModeSelectorProps = {
  onSelectMode: (mode: GameMode) => void
}

const MODE_DETAILS: Record<GameMode, {
  icon: React.ReactNode
  name: string
  description: string
  features: { icon: React.ReactNode; text: string }[]
  color: string
  bgColor: string
}> = {
  classic: {
    icon: <Gamepad2 className="h-6 w-6" />,
    name: 'Classic',
    description: 'The standard experience with checkpoints',
    features: [
      { icon: <Heart className="h-3 w-3" />, text: '3 lives' },
      { icon: <Shield className="h-3 w-3" />, text: 'Checkpoints' },
      { icon: <Star className="h-3 w-3" />, text: 'Power-ups' },
    ],
    color: 'text-primary',
    bgColor: 'bg-primary/10 hover:bg-primary/20 border-primary/30',
  },
  speedrun: {
    icon: <Zap className="h-6 w-6" />,
    name: 'Speedrun',
    description: 'Race against the clock for bonus points',
    features: [
      { icon: <Clock className="h-3 w-3" />, text: '60s time limit' },
      { icon: <Star className="h-3 w-3" />, text: '1.5x score' },
      { icon: <Shield className="h-3 w-3" />, text: 'Power-ups' },
    ],
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/30',
  },
  hardcore: {
    icon: <Skull className="h-6 w-6" />,
    name: 'Hardcore',
    description: 'One life, no checkpoints, double points',
    features: [
      { icon: <Heart className="h-3 w-3" />, text: '1 life' },
      { icon: <Star className="h-3 w-3" />, text: '2x score' },
      { icon: <Skull className="h-3 w-3" />, text: 'No power-ups' },
    ],
    color: 'text-red-500',
    bgColor: 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30',
  },
}

export function GameModeSelector({ onSelectMode }: GameModeSelectorProps) {
  const modes: GameMode[] = ['classic', 'speedrun', 'hardcore']

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-20"
    >
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-center mb-4"
      >
        <h2 className="text-2xl font-bold mb-1">Career Journey</h2>
        <p className="text-sm text-muted-foreground">Choose your challenge</p>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xl">
        {modes.map((mode, index) => {
          const details = MODE_DETAILS[mode]

          return (
            <motion.button
              key={mode}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              onClick={() => onSelectMode(mode)}
              className={`flex-1 p-3 rounded-xl border ${details.bgColor} transition-all group`}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Icon */}
              <div className={`${details.color} mb-2 flex justify-center`}>
                {details.icon}
              </div>

              {/* Name */}
              <h3 className={`font-bold text-sm ${details.color}`}>{details.name}</h3>

              {/* Description */}
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {details.description}
              </p>

              {/* Features */}
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {details.features.map((feature, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground"
                  >
                    {feature.icon}
                    {feature.text}
                  </span>
                ))}
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Controls hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-4 text-xs text-muted-foreground"
      >
        Use arrow keys to move, Space to jump
      </motion.p>
    </motion.div>
  )
}
