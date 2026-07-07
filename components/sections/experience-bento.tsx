'use client'

import { experiences } from '@/data/experience'
import { BentoCell } from '@/components/experience/bento-cell'
import { getGridConfig } from '@/lib/experience-grid'

export function ExperienceBento() {
  return (
    <section id="experience" className="py-24 sm:py-32 bg-muted/30">
      <div className="section-container">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">Experience</h2>
        <div className="h-1 w-12 bg-primary rounded-full mb-8" />

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
