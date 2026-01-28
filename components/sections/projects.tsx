'use client'

import { motion } from 'framer-motion'
import { ExternalLink, Building2, TrendingUp } from 'lucide-react'
import { FadeIn } from '@/components/animation'
import { projects } from '@/data/projects'
import type { Project } from '@/types'

export function Projects() {
  return (
    <section id="projects" className="py-24 sm:py-32 bg-muted/30">
      <div className="section-container">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Featured Projects</h2>
          <div className="h-1 w-12 bg-primary rounded-full mb-4" />
          <p className="text-muted-foreground max-w-2xl mb-12">
            A selection of enterprise-grade applications I&apos;ve built for international clients,
            handling millions of users and billions of transactions.
          </p>
        </FadeIn>

        <div className="grid gap-8">
          {projects.map((project, index) => (
            <ProjectCard key={project.id} project={project} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      className="group relative"
    >
      <div className="relative p-6 sm:p-8 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-500 overflow-hidden">
        {/* Background gradient on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Content */}
        <div className="relative grid lg:grid-cols-3 gap-6">
          {/* Main info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                  {project.title}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>{project.company}</span>
                  <span className="text-border">•</span>
                  <span className="text-primary font-medium">{project.role}</span>
                </div>
              </div>

              {project.link && (
                <a
                  href={project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden sm:inline">Visit</span>
                </a>
              )}
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
          </div>

          {/* Metrics sidebar */}
          {project.metrics && (
            <div className="lg:border-l lg:border-border lg:pl-6">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
                <TrendingUp className="h-4 w-4" />
                <span>Key Metrics</span>
              </div>
              <div className="space-y-3">
                {project.metrics.map((metric, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: index * 0.15 + i * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    <span className="text-sm font-medium">{metric}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.article>
  )
}
