'use client'

import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { useRef, useState, useMemo } from 'react'
import { MapPin, Calendar, ChevronDown, Briefcase, TrendingUp, Filter, X } from 'lucide-react'
import { FadeIn } from '@/components/animation'
import { experiences } from '@/data/experience'
import type { Experience } from '@/types'
import { cn } from '@/lib/utils'

export function Timeline() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedTech, setSelectedTech] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })

  const lineHeight = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  // Get all unique technologies
  const allTechnologies = useMemo(() => {
    const techSet = new Set<string>()
    experiences.forEach((exp) => exp.technologies.forEach((tech) => techSet.add(tech)))
    return Array.from(techSet).sort()
  }, [])

  // Filter experiences by selected tech
  const filteredExperiences = useMemo(() => {
    if (!selectedTech) return experiences
    return experiences.filter((exp) => exp.technologies.includes(selectedTech))
  }, [selectedTech])

  // Calculate career stats
  const careerStats = useMemo(() => {
    const totalYears = 8
    const totalCompanies = new Set(experiences.map((e) => e.company)).size
    const totalCountries = new Set(experiences.map((e) => e.location.split(', ').pop())).size
    return { totalYears, totalCompanies, totalCountries }
  }, [])

  return (
    <section id="experience" className="py-24 sm:py-32 bg-muted/30">
      <div className="section-container">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Experience</h2>
          <div className="h-1 w-12 bg-primary rounded-full mb-8" />
        </FadeIn>

        {/* Career Journey Stats */}
        <FadeIn delay={0.1}>
          <div className="grid grid-cols-3 gap-4 mb-8 p-4 rounded-2xl bg-card border border-border">
            <div className="text-center">
              <motion.div
                className="text-2xl sm:text-3xl font-bold text-primary"
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
              >
                {careerStats.totalYears}+
              </motion.div>
              <p className="text-xs sm:text-sm text-muted-foreground">Years Coding</p>
            </div>
            <div className="text-center border-x border-border">
              <motion.div
                className="text-2xl sm:text-3xl font-bold text-primary"
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
              >
                {careerStats.totalCompanies}
              </motion.div>
              <p className="text-xs sm:text-sm text-muted-foreground">Companies</p>
            </div>
            <div className="text-center">
              <motion.div
                className="text-2xl sm:text-3xl font-bold text-primary"
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                {careerStats.totalCountries}
              </motion.div>
              <p className="text-xs sm:text-sm text-muted-foreground">Countries</p>
            </div>
          </div>
        </FadeIn>

        {/* Technology Filter */}
        <FadeIn delay={0.2}>
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filter by technology:</span>
              {selectedTech && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => setSelectedTech(null)}
                  className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs"
                >
                  {selectedTech}
                  <X className="h-3 w-3" />
                </motion.button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {allTechnologies.slice(0, 10).map((tech) => (
                <motion.button
                  key={tech}
                  onClick={() => setSelectedTech(selectedTech === tech ? null : tech)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
                    selectedTech === tech
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {tech}
                </motion.button>
              ))}
              {allTechnologies.length > 10 && (
                <span className="px-3 py-1.5 text-xs text-muted-foreground">
                  +{allTechnologies.length - 10} more
                </span>
              )}
            </div>
          </div>
        </FadeIn>

        <div ref={containerRef} className="relative">
          {/* Animated timeline line */}
          <div className="absolute left-2 md:left-1/2 md:-translate-x-px top-0 bottom-0 w-0.5 bg-border">
            <motion.div
              className="w-full bg-gradient-to-b from-primary via-primary to-transparent"
              style={{ height: lineHeight }}
            />
          </div>

          {/* Timeline items */}
          <AnimatePresence mode="popLayout">
            <div className="space-y-12">
              {filteredExperiences.map((experience, index) => (
                <TimelineItem
                  key={experience.id}
                  experience={experience}
                  index={index}
                  isLeft={index % 2 === 0}
                  isExpanded={expandedId === experience.id}
                  onToggle={() =>
                    setExpandedId(expandedId === experience.id ? null : experience.id)
                  }
                  highlightTech={selectedTech}
                />
              ))}
            </div>
          </AnimatePresence>

          {filteredExperiences.length === 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-muted-foreground py-12"
            >
              No experience found with &ldquo;{selectedTech}&rdquo;
            </motion.p>
          )}
        </div>

        {/* Career progression indicator */}
        <FadeIn delay={0.3}>
          <div className="mt-12 p-6 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-semibold">Career Journey</span>
            </div>

            {/* Visual progression */}
            <div className="relative">
              {/* Progress line */}
              <div className="absolute top-4 left-0 right-0 h-1 bg-muted rounded-full">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary/60 via-primary to-primary rounded-full"
                  initial={{ width: 0 }}
                  whileInView={{ width: '100%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 2, ease: 'easeOut' }}
                />
              </div>

              {/* Milestones */}
              <div className="relative flex justify-between">
                {[
                  { year: '2016', role: 'Marketing', icon: '📈' },
                  { year: '2017', role: 'Developer', icon: '💻' },
                  { year: '2020', role: 'Senior', icon: '⚡' },
                  { year: '2024', role: 'Tech Lead', icon: '🚀' },
                ].map((milestone, i) => (
                  <motion.div
                    key={milestone.year}
                    className="flex flex-col items-center"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.2, duration: 0.5 }}
                  >
                    <motion.div
                      className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm mb-2"
                      whileHover={{ scale: 1.2 }}
                    >
                      {milestone.icon}
                    </motion.div>
                    <span className="text-xs font-medium">{milestone.role}</span>
                    <span className="text-xs text-muted-foreground">{milestone.year}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

function TimelineItem({
  experience,
  index,
  isLeft,
  isExpanded,
  onToggle,
  highlightTech,
}: {
  experience: Experience
  index: number
  isLeft: boolean
  isExpanded: boolean
  onToggle: () => void
  highlightTech: string | null
}) {
  const isCurrentRole = experience.endDate === null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: isLeft ? -50 : 50 }}
      whileInView={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className={`relative flex flex-col md:flex-row gap-8 ${
        isLeft ? 'md:flex-row-reverse' : ''
      }`}
    >
      {/* Timeline dot with pulse animation */}
      <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2 top-6 z-10">
        <motion.span
          className={cn(
            'block w-4 h-4 rounded-full border-2 transition-all duration-300',
            isCurrentRole
              ? 'bg-primary border-primary'
              : isExpanded
                ? 'bg-primary/50 border-primary'
                : 'bg-card border-primary/50'
          )}
          animate={
            isCurrentRole
              ? {
                  scale: [1, 1.2, 1],
                  boxShadow: [
                    '0 0 0 0 rgba(var(--primary), 0.4)',
                    '0 0 0 10px rgba(var(--primary), 0)',
                    '0 0 0 0 rgba(var(--primary), 0)',
                  ],
                }
              : {}
          }
          transition={{ duration: 2, repeat: isCurrentRole ? Infinity : 0 }}
        />
      </div>

      {/* Content */}
      <div className={`flex-1 pl-8 md:pl-0 ${isLeft ? 'md:pr-16' : 'md:pl-16'}`}>
        <motion.div
          className={cn(
            'group p-6 rounded-2xl bg-card border border-border cursor-pointer transition-all duration-300',
            isExpanded ? 'border-primary shadow-lg shadow-primary/10' : 'hover:border-primary/30'
          )}
          onClick={onToggle}
          whileHover={{ y: -2 }}
        >
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
            <div>
              <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                {experience.role}
              </h3>
              <p className="text-primary font-medium">{experience.company}</p>
            </div>
            <div className="flex items-center gap-2">
              {isCurrentRole && (
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  Current
                </span>
              )}
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              </motion.div>
            </div>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {experience.period}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {experience.location}
            </span>
          </div>

          {/* Description */}
          <p className="text-muted-foreground mb-4">{experience.description}</p>

          {/* Expandable content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                {/* Highlights */}
                <div className="mb-4 pt-4 border-t border-border">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" />
                    Key Achievements
                  </h4>
                  <ul className="space-y-2">
                    {experience.highlights.map((highlight, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-start gap-2 text-sm"
                      >
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                        <span className="text-muted-foreground">{highlight}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Technologies - always visible but with highlight */}
          <div className="flex flex-wrap gap-2">
            {experience.technologies.map((tech, techIndex) => (
              <motion.span
                key={tech}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: techIndex * 0.02 }}
                className={cn(
                  'px-2 py-1 rounded-md text-xs font-medium transition-all duration-200',
                  highlightTech === tech
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {tech}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Empty space for alternating layout on desktop */}
      <div className="hidden md:block flex-1" />
    </motion.div>
  )
}
