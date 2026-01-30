'use client'

import { motion } from 'framer-motion'
import { X, Briefcase } from 'lucide-react'
import type { Experience } from '@/types'

type ExperiencePopupCardProps = {
  experience: Experience
  onDismiss: () => void
}

export function ExperiencePopupCard({ experience, onDismiss }: ExperiencePopupCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.9 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="absolute right-2 bottom-2 w-56 bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-lg z-30 overflow-hidden"
    >
      {/* Compact header with company + role */}
      <div className="flex items-center justify-between p-2 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Briefcase className="h-3.5 w-3.5 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-xs truncate">{experience.company}</h3>
            <p className="text-[10px] text-muted-foreground truncate">{experience.role}</p>
          </div>
        </div>
        <motion.button
          onClick={onDismiss}
          className="p-0.5 hover:bg-muted rounded transition-colors shrink-0"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </motion.button>
      </div>

      {/* Auto-dismiss progress bar - 3 seconds */}
      <motion.div
        className="h-0.5 bg-primary/40"
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: 3, ease: 'linear' }}
        onAnimationComplete={onDismiss}
      />
    </motion.div>
  )
}
