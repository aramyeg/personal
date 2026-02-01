'use client'

import { SkillTree } from '@/components/game/skill-tree'

/**
 * CareerGame - Interactive skill tree visualization
 *
 * A visually engaging skill tree that shows all technologies,
 * connections between skills, and career progression over time.
 *
 * Features:
 * - Breathing glow effects on skill nodes
 * - Particle effects on interactions
 * - Parallax background
 * - Timeline mode to watch skills unlock chronologically
 * - Click to explore skill details and related companies
 */
export function CareerGame() {
  return (
    <section id="career" className="scroll-mt-20">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Career Journey</h2>
        <p className="text-muted-foreground text-sm">
          Watch my skills evolve over 8+ years of software engineering
        </p>
      </div>

      <SkillTree />
    </section>
  )
}
