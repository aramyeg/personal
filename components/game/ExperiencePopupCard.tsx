'use client'

import { motion } from 'framer-motion'
import { X, MapPin, Calendar, Briefcase, Code2, CheckCircle2 } from 'lucide-react'
import type { Experience } from '@/types'

type ExperiencePopupCardProps = {
  experience: Experience
  onDismiss: () => void
}

export function ExperiencePopupCard({ experience, onDismiss }: ExperiencePopupCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="absolute left-1/2 -translate-x-1/2 bottom-4 w-[90%] max-w-md bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-xl z-30 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between p-3 border-b border-border bg-primary/5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary shrink-0" />
            <h3 className="font-bold text-sm truncate">{experience.company}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{experience.role}</p>
        </div>
        <motion.button
          onClick={onDismiss}
          className="p-1 hover:bg-muted rounded-md transition-colors shrink-0"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </motion.button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2.5">
        {/* Location and Period */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {experience.location}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {experience.period}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs leading-relaxed line-clamp-2">{experience.description}</p>

        {/* Highlights */}
        {experience.highlights.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs font-medium">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              <span>Key Achievements</span>
            </div>
            <ul className="space-y-0.5">
              {experience.highlights.slice(0, 2).map((highlight, i) => (
                <li key={i} className="text-xs text-muted-foreground pl-4 line-clamp-1">
                  • {highlight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Technologies */}
        {experience.technologies.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 text-xs font-medium">
              <Code2 className="h-3 w-3 text-primary" />
              <span>Technologies</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {experience.technologies.slice(0, 6).map((tech) => (
                <span
                  key={tech}
                  className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded-md font-medium"
                >
                  {tech}
                </span>
              ))}
              {experience.technologies.length > 6 && (
                <span className="px-1.5 py-0.5 bg-muted text-muted-foreground text-[10px] rounded-md">
                  +{experience.technologies.length - 6} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Auto-dismiss progress bar */}
      <motion.div
        className="h-0.5 bg-primary/30"
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: 5, ease: 'linear' }}
        onAnimationComplete={onDismiss}
      />
    </motion.div>
  )
}
