'use client'

import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import type { Achievement } from '@/lib/game/types'

type AchievementNotificationProps = {
  achievement: Achievement
  onDismiss: () => void
}

export function AchievementNotification({ achievement, onDismiss }: AchievementNotificationProps) {
  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="absolute top-4 right-4 bg-gradient-to-r from-yellow-500/90 to-amber-500/90 backdrop-blur-md border border-yellow-400/50 rounded-lg shadow-xl z-40 overflow-hidden"
    >
      {/* Content */}
      <div className="flex items-center gap-3 p-3">
        {/* Trophy icon */}
        <motion.div
          animate={{
            rotate: [0, -10, 10, -10, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 0.5 }}
          className="shrink-0"
        >
          <div className="w-10 h-10 bg-yellow-300/30 rounded-full flex items-center justify-center">
            <Trophy className="h-5 w-5 text-yellow-100" />
          </div>
        </motion.div>

        {/* Achievement info */}
        <div className="min-w-0">
          <p className="text-xs font-medium text-yellow-100/80 uppercase tracking-wide">
            Achievement Unlocked!
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-lg">{achievement.icon}</span>
            <h4 className="font-bold text-white text-sm truncate">{achievement.name}</h4>
          </div>
          <p className="text-xs text-yellow-100/70 mt-0.5 line-clamp-1">
            {achievement.description}
          </p>
        </div>
      </div>

      {/* Auto-dismiss progress bar */}
      <motion.div
        className="h-0.5 bg-yellow-300/50"
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: 4, ease: 'linear' }}
        onAnimationComplete={onDismiss}
      />
    </motion.div>
  )
}
