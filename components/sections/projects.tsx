'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ExternalLink,
  Building2,
  TrendingUp,
  Star,
  Calendar,
  Zap,
  ChevronRight,
  Rocket,
} from 'lucide-react'
import { FadeIn } from '@/components/animation'
import { projects, categoryLabels, type ExtendedProject, type ProjectCategory } from '@/data/projects'
import { cn } from '@/lib/utils'

export function Projects() {
  const [activeCategory, setActiveCategory] = useState<ProjectCategory | 'all'>('all')
  const [hoveredProject, setHoveredProject] = useState<string | null>(null)

  // Launch sequence easter egg
  // NOTE: console.log statements are intentional easter egg outputs
  const [launchSequence, setLaunchSequence] = useState(false)
  const [zapClickCount, setZapClickCount] = useState(0)
  const zapClickTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const launchTimeoutsRef = useRef<NodeJS.Timeout[]>([])

  // Pre-generate confetti positions (client-only to avoid hydration mismatch)
  const [confettiParticles] = useState(() => {
    if (typeof window === 'undefined') return []
    return Array.from({ length: 40 }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2 + Math.random(),
      rotation: Math.random() * 720,
    }))
  })

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (zapClickTimeoutRef.current) clearTimeout(zapClickTimeoutRef.current)
      launchTimeoutsRef.current.forEach(clearTimeout)
    }
  }, [])

  const handleZapClick = () => {
    if (zapClickTimeoutRef.current) {
      clearTimeout(zapClickTimeoutRef.current)
    }

    const newCount = zapClickCount + 1
    setZapClickCount(newCount)

    if (newCount >= 3) {
      triggerLaunchSequence()
      setZapClickCount(0)
    } else {
      // Reset count after 500ms of no clicks
      zapClickTimeoutRef.current = setTimeout(() => {
        setZapClickCount(0)
      }, 500)
    }
  }

  const triggerLaunchSequence = () => {
    setLaunchSequence(true)

    // Clear any existing launch timeouts
    launchTimeoutsRef.current.forEach(clearTimeout)

    // Console deployment log with tracked timeouts
    console.log('%c 🚀 DEPLOYMENT INITIATED ', 'background: #0070f3; color: white; font-size: 16px; padding: 8px; border-radius: 4px;')
    launchTimeoutsRef.current = [
      setTimeout(() => console.log('%c ✓ Building production bundle...', 'color: #22c55e;'), 200),
      setTimeout(() => console.log('%c ✓ Optimizing assets...', 'color: #22c55e;'), 400),
      setTimeout(() => console.log('%c ✓ Deploying to edge network...', 'color: #22c55e;'), 600),
      setTimeout(() => console.log('%c 🎉 LAUNCH SUCCESSFUL! ', 'background: #22c55e; color: white; font-size: 16px; padding: 8px; border-radius: 4px;'), 1000),
      setTimeout(() => setLaunchSequence(false), 3000),
    ]
  }

  const filteredProjects =
    activeCategory === 'all'
      ? projects
      : projects.filter((p) => p.category === activeCategory)

  const categories: Array<'all' | ProjectCategory> = ['all', ...Object.keys(categoryLabels) as ProjectCategory[]]

  return (
    <section id="projects" className="py-24 sm:py-32 bg-muted/30 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -right-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="section-container relative">
        {/* Launch sequence confetti */}
        <AnimatePresence>
          {launchSequence && (
            <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
              {confettiParticles.map((particle, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    background: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff'][i % 4],
                    left: `${particle.left}%`,
                  }}
                  initial={{ y: -20, opacity: 1 }}
                  animate={{ y: '100vh', opacity: 0, rotate: particle.rotation }}
                  transition={{ duration: particle.duration, delay: particle.delay }}
                />
              ))}
            </div>
          )}
        </AnimatePresence>

        <FadeIn>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-3xl sm:text-4xl font-bold">Featured Projects</h2>
            <motion.div
              onClick={handleZapClick}
              className="cursor-pointer"
              animate={launchSequence ? {
                y: [0, -20, -100],
                rotate: [0, 0, -45],
                scale: [1, 1.2, 0.5],
              } : { rotate: [0, 15, -15, 0] }}
              transition={launchSequence ? { duration: 1 } : { duration: 2, repeat: Infinity, repeatDelay: 4 }}
            >
              {launchSequence ? (
                <Rocket className="h-6 w-6 text-primary" />
              ) : (
                <Zap className="h-6 w-6 text-primary" />
              )}
            </motion.div>
          </div>
          <div className="h-1 w-12 bg-primary rounded-full mb-4" />
          <p className="text-muted-foreground max-w-2xl mb-8">
            A selection of enterprise-grade applications I&apos;ve built for international clients,
            handling millions of users and billions of transactions.
          </p>
        </FadeIn>

        {/* Category filter */}
        <FadeIn delay={0.1}>
          <div className="flex flex-wrap gap-2 mb-8">
            {categories.map((cat) => (
              <motion.button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                  activeCategory === cat
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                    : 'bg-card border border-border hover:border-primary/50 text-muted-foreground'
                )}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {cat === 'all' ? 'All Projects' : categoryLabels[cat].label}
              </motion.button>
            ))}
          </div>
        </FadeIn>

        <AnimatePresence mode="popLayout">
          <div className="grid gap-8">
            {filteredProjects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={index}
                isHovered={hoveredProject === project.id}
                onHover={() => setHoveredProject(project.id)}
                onLeave={() => setHoveredProject(null)}
                isLaunching={launchSequence}
              />
            ))}
          </div>
        </AnimatePresence>

        {filteredProjects.length === 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-muted-foreground py-12"
          >
            No projects in this category yet.
          </motion.p>
        )}
      </div>
    </section>
  )
}

function ProjectCard({
  project,
  index,
  isHovered,
  onHover,
  onLeave,
  isLaunching,
}: {
  project: ExtendedProject
  index: number
  isHovered: boolean
  onHover: () => void
  onLeave: () => void
  isLaunching: boolean
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      animate={isLaunching ? { y: [0, -30, 0] } : {}}
      className="group relative"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <motion.div
        className={cn(
          'relative p-6 sm:p-8 rounded-2xl bg-card border transition-all duration-500 overflow-hidden',
          project.featured
            ? 'border-primary/30 shadow-lg shadow-primary/5'
            : 'border-border hover:border-primary/30'
        )}
        whileHover={{ y: -4 }}
      >
        {/* Featured badge */}
        {project.featured && (
          <div className="absolute top-4 right-4 z-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium"
            >
              <Star className="h-3 w-3" />
              Current Project
            </motion.div>
          </div>
        )}

        {/* Background gradient on hover */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />

        {/* Content */}
        <div className="relative grid lg:grid-cols-3 gap-6">
          {/* Main info */}
          <div className="lg:col-span-2 space-y-4">
            {/* Header with icon and category */}
            <div className="flex items-start gap-4">
              <motion.div
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center text-2xl shrink-0"
                animate={isHovered ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
                transition={{ duration: 0.5 }}
              >
                {project.icon}
              </motion.div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                      {project.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span className="truncate">{project.company}</span>
                      <span className="text-border">•</span>
                      <span className="text-primary font-medium">{project.role}</span>
                    </div>
                  </div>
                </div>

                {/* Category and year badges */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium',
                      categoryLabels[project.category].color
                    )}
                  >
                    {categoryLabels[project.category].label}
                  </span>
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {project.year}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-muted-foreground leading-relaxed">
              {project.longDescription || project.description}
            </p>

            {/* Technologies with animation */}
            <div className="flex flex-wrap gap-2 pt-2">
              {project.technologies.map((tech, techIndex) => (
                <motion.span
                  key={tech}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: techIndex * 0.05 }}
                  className="px-3 py-1 rounded-full bg-muted text-xs font-medium text-foreground border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-default"
                >
                  {tech}
                </motion.span>
              ))}
            </div>

            {/* Visit link */}
            {project.link && (
              <motion.a
                href={project.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary font-medium hover:text-primary/80 transition-colors group/link"
                whileHover={{ x: 5 }}
              >
                <ExternalLink className="h-4 w-4" />
                Visit live project
                <ChevronRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1" />
              </motion.a>
            )}
          </div>

          {/* Metrics sidebar */}
          {project.metrics && (
            <div className="lg:border-l lg:border-border lg:pl-6">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
                <TrendingUp className="h-4 w-4" />
                <span>Key Metrics</span>
              </div>
              <div className="space-y-4">
                {project.metrics.map((metric, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: index * 0.15 + i * 0.1 }}
                    className="relative"
                  >
                    <div className="flex items-center gap-3">
                      <motion.span
                        className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0"
                        animate={
                          isHovered
                            ? {
                                scale: [1, 1.3, 1],
                              }
                            : {}
                        }
                        transition={{ delay: i * 0.1 }}
                      />
                      <span className="text-sm font-medium">{metric}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Mini progress visual */}
              <div className="mt-6 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Impact Level</p>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: project.featured ? '95%' : '80%' }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: 0.5 }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.article>
  )
}
