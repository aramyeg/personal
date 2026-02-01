'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, TrendingUp, Zap, Gamepad2 } from 'lucide-react'
import { FadeIn } from '@/components/animation'
import { skills, skillCategories, getSkillsByCategory, focusSkills, type FocusSkill } from '@/data/skills'
import type { SkillCategory, Skill } from '@/types'
import { cn } from '@/lib/utils'

const COMBO_TIMEOUT = 5000 // 5 seconds to click all categories
const STORAGE_KEY = 'fun-skills-unlocked'

const levelColors = {
  expert: 'bg-primary/20 text-primary border-primary/30',
  advanced: 'bg-sky-500/20 text-sky-500 border-sky-500/30',
  intermediate: 'bg-amber-500/20 text-amber-500 border-amber-500/30',
}

const levelLabels = {
  expert: 'Expert',
  advanced: 'Advanced',
  intermediate: 'Intermediate',
}

export function Skills() {
  const [activeCategory, setActiveCategory] = useState<SkillCategory>('frontend')

  // Combo easter egg state
  const [clickedCategories, setClickedCategories] = useState<Set<SkillCategory>>(new Set())
  const [showCombo, setShowCombo] = useState(false)
  const [funUnlocked, setFunUnlocked] = useState(false)
  const comboStartTimeRef = useRef<number | null>(null)

  // Load persisted state on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') {
      setFunUnlocked(true)
    }
  }, [])

  const handleCategoryClick = (category: SkillCategory) => {
    setActiveCategory(category)

    // Skip combo logic if already unlocked or clicking fun category
    if (funUnlocked || category === 'fun') return

    const now = Date.now()

    // Reset if timeout exceeded
    if (comboStartTimeRef.current && now - comboStartTimeRef.current > COMBO_TIMEOUT) {
      setClickedCategories(new Set([category]))
      comboStartTimeRef.current = now
      return
    }

    // Start timer on first click
    if (clickedCategories.size === 0) {
      comboStartTimeRef.current = now
    }

    const newClicked = new Set(clickedCategories)
    newClicked.add(category)
    setClickedCategories(newClicked)

    // Check if all 6 main categories clicked
    if (newClicked.size === 6) {
      setShowCombo(true)
      setFunUnlocked(true)
      localStorage.setItem(STORAGE_KEY, 'true')

      // Console log with style
      console.log(
        '%c 🎮 COMBO COMPLETE! Fun Skills Unlocked! ',
        'background: linear-gradient(90deg, #8b5cf6, #ec4899); color: white; padding: 10px; font-size: 16px; font-weight: bold; border-radius: 5px;'
      )

      setTimeout(() => setShowCombo(false), 3000)
      setClickedCategories(new Set())
    }
  }

  // Build visible categories (add fun when unlocked)
  const visibleCategories = funUnlocked
    ? [...skillCategories, { id: 'fun' as SkillCategory, label: '🎮 Fun Skills' }]
    : skillCategories

  const filteredSkills = getSkillsByCategory(activeCategory)

  return (
    <section id="skills" className="py-24 sm:py-32 bg-muted/30">
      <div className="section-container">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Skills</h2>
          <div className="h-1 w-12 bg-primary rounded-full mb-8" />
        </FadeIn>

        {/* Current Focus Section - Highlight modern stack */}
        <FadeIn delay={0.1} className="mb-12">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-transparent border border-primary/20">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-primary/20">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Current Focus</h3>
                <p className="text-sm text-muted-foreground">Modern stack I&apos;m highly confident in</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {focusSkills.map((skill, index) => (
                <FocusSkillCard key={skill.name} skill={skill} index={index} />
              ))}
            </div>

            <p className="mt-4 text-sm text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Quick learner with a passion for adopting cutting-edge technologies
            </p>
          </div>
        </FadeIn>

        {/* Combo notification */}
        <AnimatePresence>
          {showCombo && (
            <motion.div
              initial={{ scale: 0, y: -50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0, y: -50, opacity: 0 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-8 py-4 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 text-white font-bold text-xl rounded-2xl shadow-2xl flex items-center gap-3"
            >
              <Gamepad2 className="h-6 w-6" />
              <span>COMBO COMPLETE! Fun Skills Unlocked!</span>
              <Gamepad2 className="h-6 w-6" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category tabs */}
        <FadeIn delay={0.2} className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <p className="text-sm font-medium text-muted-foreground">Browse by category</p>
            <div className="flex flex-wrap gap-2">
              {visibleCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category.id)}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-medium transition-all duration-300',
                    activeCategory === category.id
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                      : 'bg-card hover:bg-card/80 text-muted-foreground hover:text-foreground border border-border',
                    category.id === 'fun' && 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30'
                  )}
                >
                  {category.label}
                </button>
              ))}
            </div>
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
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
          >
            {filteredSkills.map((skill, index) => (
              <SkillCard key={skill.name} skill={skill} index={index} />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Stats summary */}
        <FadeIn delay={0.3} className="mt-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard value={skills.length} label="Technologies" icon="🛠️" />
            <StatCard value={skills.filter((s) => s.level === 'expert').length} label="Expert Level" icon="⭐" />
            <StatCard value="8+" label="Years Experience" icon="📅" />
            <StatCard value="20+" label="Projects Delivered" icon="🚀" />
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

function FocusSkillCard({ skill, index }: { skill: FocusSkill; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="group p-4 rounded-xl bg-card/80 backdrop-blur-sm border border-border hover:border-primary/50 transition-all duration-300"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{skill.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {skill.name}
            </h4>
            <span className="flex items-center gap-1 text-xs font-medium text-primary whitespace-nowrap flex-shrink-0">
              <Zap className="h-3 w-3" />
              {skill.confidence}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {skill.description}
          </p>
          <p className="text-xs text-primary/80 mt-2 italic">
            {skill.growth}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

function SkillCard({ skill, index }: { skill: Skill; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className="group relative p-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-all duration-300"
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 rounded-xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />

      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">
            {skill.name}
          </h3>
          <span
            className={cn(
              'px-1.5 py-0.5 rounded text-[10px] font-medium border flex-shrink-0',
              levelColors[skill.level]
            )}
          >
            {levelLabels[skill.level]}
          </span>
        </div>

        {/* Experience bar */}
        <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(skill.years * 12.5, 100)}%` }}
            transition={{ duration: 0.8, delay: index * 0.03 + 0.2 }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">{skill.years} years</p>
      </div>
    </motion.div>
  )
}

function StatCard({ value, label, icon }: { value: string | number; label: string; icon: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="p-4 rounded-xl bg-card border border-border text-center"
    >
      <span className="text-2xl mb-2 block">{icon}</span>
      <p className="text-2xl sm:text-3xl font-bold text-primary">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </motion.div>
  )
}
