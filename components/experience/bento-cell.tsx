'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { MapPin, Calendar, Briefcase } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Experience } from '@/types'
import type { BentoGridConfig } from '@/lib/experience-grid'
import { getGridSpanClasses, getMinHeightClass } from '@/lib/experience-grid'
import { cn } from '@/lib/utils'

type Props = {
  experience: Experience
  config: BentoGridConfig
  index: number
}

export function BentoCell({ experience, config, index }: Props) {
  const shouldReduceMotion = useReducedMotion()
  const isCurrentRole = experience.endDate === null

  const gridSpanClass = getGridSpanClasses(config.gridSize)
  const minHeightClass = getMinHeightClass(config.gridSize)

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.4,
        delay: shouldReduceMotion ? 0 : index * 0.1,
      }}
      whileHover={shouldReduceMotion ? {} : { y: -4, scale: 1.01 }}
      className={cn(
        'group relative overflow-hidden rounded-2xl',
        'bg-card border border-border',
        'transition-shadow duration-300',
        'hover:shadow-xl hover:shadow-black/10',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        gridSpanClass,
        minHeightClass
      )}
      style={{
        '--accent': config.accentColor,
      } as React.CSSProperties}
      tabIndex={0}
      role="article"
      aria-label={`${experience.role} at ${experience.company}`}
    >
      {/* Accent border on hover */}
      <div
        className="absolute inset-0 rounded-2xl border-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none"
        style={{ borderColor: config.accentColor }}
      />

      {/* Accent glow on hover */}
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${config.accentColor}15 0%, transparent 50%)`,
        }}
      />

      <div className="relative p-6 h-full flex flex-col">
        {/* Header */}
        <header className="mb-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors leading-tight">
              {experience.role}
            </h3>
            {isCurrentRole && (
              <span
                className="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: config.accentColor }}
              >
                Current
              </span>
            )}
          </div>

          <p
            className="font-semibold text-base transition-colors"
            style={{ color: config.accentColor }}
          >
            {experience.company}
          </p>
        </header>

        {/* Meta info */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-4">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {experience.period}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {experience.location}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {experience.description}
        </p>

        {/* Highlights - always visible */}
        <ul className="space-y-1.5 mb-4 flex-1" aria-label="Key achievements">
          {experience.highlights.slice(0, config.gridSize === 'large' ? 4 : 3).map((highlight, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-muted-foreground"
            >
              <Briefcase className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/60" />
              <span className="line-clamp-2">{highlight}</span>
            </li>
          ))}
        </ul>

        {/* Technologies */}
        <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
          {experience.technologies.slice(0, config.gridSize === 'large' ? 8 : 5).map((tech) => (
            <Badge
              key={tech}
              variant="secondary"
              className="text-xs px-2 py-0.5 bg-muted/50"
            >
              {tech}
            </Badge>
          ))}
          {experience.technologies.length > (config.gridSize === 'large' ? 8 : 5) && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-muted/50">
              +{experience.technologies.length - (config.gridSize === 'large' ? 8 : 5)}
            </Badge>
          )}
        </div>
      </div>
    </motion.article>
  )
}
