'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { MapPin, Calendar } from 'lucide-react'
import { FadeIn } from '@/components/animation'
import { experiences } from '@/data/experience'
import type { Experience } from '@/types'

export function Timeline() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })

  const lineHeight = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  return (
    <section id="experience" className="py-24 sm:py-32">
      <div className="section-container">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Experience</h2>
          <div className="h-1 w-12 bg-primary rounded-full mb-8" />
        </FadeIn>

        <div ref={containerRef} className="relative">
          {/* Animated timeline line */}
          <div className="absolute left-0 md:left-1/2 top-0 bottom-0 w-px bg-border md:-translate-x-1/2">
            <motion.div
              className="w-full bg-gradient-to-b from-primary via-primary to-transparent"
              style={{ height: lineHeight }}
            />
          </div>

          {/* Timeline items */}
          <div className="space-y-12">
            {experiences.map((experience, index) => (
              <TimelineItem
                key={experience.id}
                experience={experience}
                index={index}
                isLeft={index % 2 === 0}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function TimelineItem({
  experience,
  index,
  isLeft,
}: {
  experience: Experience
  index: number
  isLeft: boolean
}) {
  const isCurrentRole = experience.endDate === null

  return (
    <motion.div
      initial={{ opacity: 0, x: isLeft ? -50 : 50 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className={`relative flex flex-col md:flex-row gap-8 ${
        isLeft ? 'md:flex-row-reverse' : ''
      }`}
    >
      {/* Timeline dot */}
      <div className="absolute left-0 md:left-1/2 w-4 h-4 -translate-x-1/2 md:-translate-x-1/2 top-0">
        <span
          className={`block w-4 h-4 rounded-full border-2 ${
            isCurrentRole
              ? 'bg-primary border-primary animate-pulse'
              : 'bg-card border-primary/50'
          }`}
        />
      </div>

      {/* Content */}
      <div className={`flex-1 pl-8 md:pl-0 ${isLeft ? 'md:pr-12' : 'md:pl-12'}`}>
        <div className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
            <div>
              <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                {experience.role}
              </h3>
              <p className="text-primary font-medium">{experience.company}</p>
            </div>
            {isCurrentRole && (
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                Current
              </span>
            )}
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

          {/* Highlights */}
          <ul className="space-y-2 mb-4">
            {experience.highlights.map((highlight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <span className="text-muted-foreground">{highlight}</span>
              </li>
            ))}
          </ul>

          {/* Technologies */}
          <div className="flex flex-wrap gap-2">
            {experience.technologies.map((tech) => (
              <span
                key={tech}
                className="px-2 py-1 rounded-md bg-muted text-xs font-medium text-muted-foreground"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Empty space for alternating layout on desktop */}
      <div className="hidden md:block flex-1" />
    </motion.div>
  )
}
