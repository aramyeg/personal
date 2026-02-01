'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { FadeIn } from '@/components/animation'
import { experiences } from '@/data/experience'
import { BentoCell } from '@/components/experience/bento-cell'
import { getGridConfig } from '@/lib/experience-grid'

export function ExperienceBento() {
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
        {/* Section Header */}
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Experience</h2>
          <div className="h-1 w-12 bg-primary rounded-full mb-8" />
        </FadeIn>

        {/* Career Stats */}
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

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-auto">
          {experiences.map((experience, index) => (
            <BentoCell
              key={experience.id}
              experience={experience}
              config={getGridConfig(experience.id)}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
