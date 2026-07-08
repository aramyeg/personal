'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gamepad2 } from 'lucide-react'
import { skillCategories, getSkillsByCategory, focusSkills, type FocusSkill } from '@/data/skills'
import type { SkillCategory, Skill } from '@/types'
import { cn } from '@/lib/utils'

const COMBO_TIMEOUT = 5000 // 5 seconds to click all categories
const STORAGE_KEY = 'fun-skills-unlocked'

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

      console.log(
        '%c 🎮 COMBO COMPLETE! Fun Skills Unlocked! ',
        'background: #b0563d; color: #faf8f5; padding: 10px; font-size: 16px; font-weight: bold; border-radius: 5px;'
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
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">Skills</h2>
        <div className="h-1 w-12 bg-primary rounded-full mb-8" />

        {/* Current focus — the stack in daily production use */}
        <div className="mb-12 p-6 rounded-2xl bg-card border border-border">
          <div className="mb-4">
            <h3 className="text-lg font-bold">Current Focus</h3>
            <p className="text-sm text-muted-foreground">
              The stack behind my current banking and PropTech work
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {focusSkills.map((skill) => (
              <FocusSkillCard key={skill.name} skill={skill} />
            ))}
          </div>
        </div>

        {/* Combo notification */}
        <AnimatePresence>
          {showCombo && (
            <motion.div
              initial={{ scale: 0.8, y: -50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: -50, opacity: 0 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-8 py-4 bg-primary text-primary-foreground font-bold text-xl rounded-2xl shadow-2xl flex items-center gap-3"
            >
              <Gamepad2 className="h-6 w-6" />
              <span>COMBO COMPLETE! Fun Skills Unlocked!</span>
              <Gamepad2 className="h-6 w-6" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category tabs */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <p className="text-sm font-medium text-muted-foreground">Browse by category</p>
          <div className="flex flex-wrap gap-2">
            {visibleCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-colors duration-300',
                  activeCategory === category.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card hover:bg-card/80 text-muted-foreground hover:text-foreground border border-border',
                  category.id === 'fun' && activeCategory !== 'fun' && 'border-primary/40 text-primary'
                )}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {/* Skills grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
          >
            {filteredSkills.map((skill) => (
              <SkillCard key={skill.name} skill={skill} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}

function FocusSkillCard({ skill }: { skill: FocusSkill }) {
  return (
    <div className="group p-4 rounded-xl bg-background border border-border hover:border-primary/50 transition-colors duration-300">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{skill.icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
            {skill.name}
          </h4>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {skill.description}
          </p>
          <p className="text-xs text-primary/80 mt-2">{skill.growth}</p>
        </div>
      </div>
    </div>
  )
}

function SkillCard({ skill }: { skill: Skill }) {
  return (
    <div className="group p-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors duration-300">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">
          {skill.name}
        </h3>
        {skill.level === 'expert' && (
          <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" aria-label="Expert" />
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {skill.years} {skill.years === 1 ? 'year' : 'years'}
      </p>
    </div>
  )
}
