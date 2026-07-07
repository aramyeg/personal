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
import { projects, categoryLabels, type ExtendedProject, type ProjectCategory } from '@/data/projects'
import { cn } from '@/lib/utils'

export function Projects() {
  const [activeCategory, setActiveCategory] = useState<ProjectCategory | 'all'>('all')

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
    console.log('%c 🚀 DEPLOYMENT INITIATED ', 'background: #b0563d; color: #faf8f5; font-size: 16px; padding: 8px; border-radius: 4px;')
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
    <section id="projects" className="py-24 sm:py-32 bg-muted/30">
      <div className="section-container">
        {/* Launch sequence confetti */}
        <AnimatePresence>
          {launchSequence && (
            <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
              {confettiParticles.map((particle, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    background: ['#b0563d', '#e0a878', '#6b5f52', '#c9803f'][i % 4],
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

        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-3xl sm:text-4xl font-bold">Featured Projects</h2>
          <motion.button
            onClick={handleZapClick}
            className="cursor-pointer"
            aria-label="Launch"
            animate={launchSequence ? {
              y: [0, -20, -100],
              rotate: [0, 0, -45],
              scale: [1, 1.2, 0.5],
            } : {}}
            transition={launchSequence ? { duration: 1 } : undefined}
          >
            {launchSequence ? (
              <Rocket className="h-6 w-6 text-primary" />
            ) : (
              <Zap className="h-6 w-6 text-primary" />
            )}
          </motion.button>
        </div>
        <div className="h-1 w-12 bg-primary rounded-full mb-4" />
        <p className="text-muted-foreground max-w-2xl mb-8">
          Banking, messaging, and mobile platforms built for international clients —
          from AMIO Bank&apos;s retail banking suite to 360dialog&apos;s WhatsApp
          Business platform.
        </p>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200',
                activeCategory === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border hover:border-primary/50 text-muted-foreground'
              )}
            >
              {cat === 'all' ? 'All Projects' : categoryLabels[cat].label}
            </button>
          ))}
        </div>

        <div className="grid gap-8">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} isLaunching={launchSequence} />
          ))}
        </div>

        {filteredProjects.length === 0 && (
          <p className="text-center text-muted-foreground py-12">
            No projects in this category yet.
          </p>
        )}
      </div>
    </section>
  )
}

function ProjectCard({
  project,
  isLaunching,
}: {
  project: ExtendedProject
  isLaunching: boolean
}) {
  return (
    <motion.article
      animate={isLaunching ? { y: [0, -30, 0] } : {}}
      className={cn(
        'group relative p-6 sm:p-8 rounded-2xl bg-card border transition-colors duration-300',
        project.featured
          ? 'border-primary/30'
          : 'border-border hover:border-primary/30'
      )}
    >
      {/* Featured badge */}
      {project.featured && (
        <div className="absolute top-4 right-4 z-10">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
            <Star className="h-3 w-3" />
            Current Project
          </div>
        </div>
      )}

      {/* Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header with icon and category */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl shrink-0">
              {project.icon}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-xl sm:text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                {project.title}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{project.company}</span>
                <span className="text-border">•</span>
                <span className="text-primary font-medium">{project.role}</span>
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

          {/* Technologies */}
          <div className="flex flex-wrap gap-2 pt-2">
            {project.technologies.map((tech) => (
              <span
                key={tech}
                className="px-3 py-1 rounded-full bg-muted text-xs font-medium text-foreground border border-border"
              >
                {tech}
              </span>
            ))}
          </div>

          {/* Visit link */}
          {project.link && (
            <a
              href={project.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary font-medium hover:text-primary/80 transition-colors group/link"
            >
              <ExternalLink className="h-4 w-4" />
              Visit live project
              <ChevronRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1" />
            </a>
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
                <div key={i} className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-sm font-medium">{metric}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.article>
  )
}
