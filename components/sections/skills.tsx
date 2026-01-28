'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeIn, StaggerChildren, StaggerItem } from '@/components/animation'
import { skills, skillCategories, getSkillsByCategory } from '@/data/skills'
import type { SkillCategory, Skill } from '@/types'
import { cn } from '@/lib/utils'

const levelColors = {
  expert: 'bg-primary/20 text-primary border-primary/30',
  advanced: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  intermediate: 'bg-amber-500/20 text-amber-500 border-amber-500/30',
}

const levelLabels = {
  expert: 'Expert',
  advanced: 'Advanced',
  intermediate: 'Intermediate',
}

export function Skills() {
  const [activeCategory, setActiveCategory] = useState<SkillCategory>('frontend')
  const filteredSkills = getSkillsByCategory(activeCategory)

  return (
    <section id="skills" className="py-24 sm:py-32 bg-muted/30">
      <div className="section-container">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Skills</h2>
          <div className="h-1 w-12 bg-primary rounded-full mb-8" />
        </FadeIn>

        {/* Category tabs */}
        <FadeIn delay={0.1} className="mb-12">
          <div className="flex flex-wrap gap-2">
            {skillCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-all duration-300',
                  activeCategory === category.id
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                    : 'bg-card hover:bg-card/80 text-muted-foreground hover:text-foreground border border-border'
                )}
              >
                {category.label}
              </button>
            ))}
          </div>
        </FadeIn>

        {/* Skills grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredSkills.map((skill, index) => (
              <SkillCard key={skill.name} skill={skill} index={index} />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Stats summary */}
        <FadeIn delay={0.3} className="mt-16">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard value={skills.length} label="Technologies" />
            <StatCard value={skills.filter((s) => s.level === 'expert').length} label="Expert Level" />
            <StatCard value="8+" label="Years Experience" />
            <StatCard value="20+" label="Projects Delivered" />
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

function SkillCard({ skill, index }: { skill: Skill; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="group relative p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-all duration-300"
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 rounded-xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />

      <div className="relative flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
            {skill.name}
          </h3>
          <p className="text-sm text-muted-foreground">{skill.years} years</p>
        </div>
        <span
          className={cn(
            'px-2 py-1 rounded-md text-xs font-medium border',
            levelColors[skill.level]
          )}
        >
          {levelLabels[skill.level]}
        </span>
      </div>

      {/* Experience bar */}
      <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(skill.years * 12.5, 100)}%` }}
          transition={{ duration: 0.8, delay: index * 0.05 + 0.2 }}
        />
      </div>
    </motion.div>
  )
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="p-4 rounded-xl bg-card border border-border text-center">
      <p className="text-2xl sm:text-3xl font-bold text-primary">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
