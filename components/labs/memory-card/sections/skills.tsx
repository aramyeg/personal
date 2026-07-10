'use client'

/**
 * SkillsSection — act 3, "kinetic type wall".
 *
 * The lab's first ink-on-paper flip: each skill category renders as a huge
 * outlined display word (stroked in its cycling glyph accent, transparent
 * fill) followed by its skill rows — name, years, and a segmented era HP-bar
 * that fills left-to-right once the row scrolls into view. No 3D.
 */

import { motion, useReducedMotion } from 'framer-motion'
import { getSkillsByCategory, skillCategories } from '@/data/skills'
import type { Skill } from '@/types'
import { HP_BAR, MC, TYPE, accentFor } from '../tokens'
import { anton, grotesk, monoFamily } from '../fonts'

/**
 * `Skill.level` is a string union, not a 1-5 number — 12 segments total per
 * bar, three clean visual tiers. Exported so tests derive expected segment
 * counts from this map instead of hardcoding a magic count.
 */
export const LEVEL_SEGMENTS: Record<Skill['level'], number> = {
  expert: 12,
  advanced: 9,
  intermediate: 6,
}

/** Stable DOM hook for a skill's HP bar — collapses punctuation/whitespace. */
export function skillSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const outlinedWordStyle = (accent: string): React.CSSProperties => ({
  fontFamily: anton.style.fontFamily,
  fontSize: `calc(${TYPE.h2} * 1.6)`,
  lineHeight: 0.9,
  letterSpacing: '0.01em',
  textTransform: 'uppercase',
  color: 'transparent',
  WebkitTextStroke: `2px ${accent}`,
  WebkitTextFillColor: 'transparent',
})

type HpBarProps = {
  skill: Skill
  accent: string
  reduced: boolean
}

/**
 * 12-segment era meter. `initial` is always `hidden` so SSR and both client
 * modes paint identical markup (hero's hydration-safe pattern). Reduced
 * motion swaps `whileInView` for a direct `animate`, so the bar snaps to its
 * filled state on mount instead of waiting on scroll — "pre-filled, no
 * animation" without depending on the element ever entering the viewport.
 */
function HpBar({ skill, accent, reduced }: HpBarProps) {
  const filled = LEVEL_SEGMENTS[skill.level]

  return (
    <div
      aria-hidden="true"
      data-testid={`hp-bar-${skillSlug(skill.name)}`}
      className="flex shrink-0"
      style={{ gap: HP_BAR.gap }}
    >
      {Array.from({ length: HP_BAR.totalSegments }, (_, i) => {
        const isFilled = i < filled
        return (
          <motion.span
            key={i}
            data-filled={isFilled}
            initial="hidden"
            animate={reduced ? 'shown' : undefined}
            whileInView={reduced ? undefined : 'shown'}
            viewport={reduced ? undefined : { once: true, amount: 0.6 }}
            variants={{
              hidden: { backgroundColor: HP_BAR.emptyColor },
              shown: { backgroundColor: isFilled ? accent : HP_BAR.emptyColor },
            }}
            transition={reduced ? { duration: 0 } : { duration: 0.2, delay: i * 0.04 }}
            style={{ width: HP_BAR.segmentWidth, height: HP_BAR.segmentHeight }}
          />
        )
      })}
    </div>
  )
}

type SkillRowProps = {
  skill: Skill
  accent: string
  reduced: boolean
}

function SkillRow({ skill, accent, reduced }: SkillRowProps) {
  return (
    <div
      role="group"
      aria-label={`${skill.name}: ${skill.level}, ${skill.years} yrs`}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b py-3"
      style={{ borderColor: 'rgba(16,16,20,0.12)' }}
    >
      <span style={{ fontFamily: grotesk.style.fontFamily, fontWeight: 600, color: MC.ink }}>
        {skill.name}
      </span>
      <div className="flex items-center gap-4">
        <HpBar skill={skill} accent={accent} reduced={reduced} />
        <span
          style={{ fontFamily: monoFamily, fontSize: TYPE.label, color: 'rgba(16,16,20,0.55)' }}
          className="w-14 shrink-0 text-right tabular-nums lowercase"
        >
          {skill.years} yrs
        </span>
      </div>
    </div>
  )
}

export type SkillsSectionProps = {
  /** Override the media query (client islands otherwise read it themselves). */
  reduced?: boolean
}

export function SkillsSection({ reduced: reducedProp }: SkillsSectionProps) {
  const systemReduced = useReducedMotion()
  const reduced = reducedProp ?? systemReduced ?? false

  const visibleCategories = skillCategories
    .map((category) => ({ ...category, items: getSkillsByCategory(category.id) }))
    .filter((category) => category.items.length > 0)

  return (
    <section
      id="skills"
      style={{ background: MC.paper, color: MC.ink }}
      className="relative px-6 py-20 sm:px-12 sm:py-28"
    >
      {/* Hairline transition edge — the ink-to-paper flip is deliberate, not a
          blunt cut. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: 'rgba(16,16,20,0.16)' }}
      />
      <span
        aria-hidden="true"
        style={{
          fontFamily: monoFamily,
          fontSize: TYPE.label,
          letterSpacing: '0.24em',
          color: 'rgba(16,16,20,0.45)',
        }}
        className="absolute left-6 top-6 lowercase sm:left-12"
      >
        save complete
      </span>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-16 pt-10 sm:gap-20">
        {visibleCategories.map((category, idx) => {
          const accent = accentFor(idx)
          const bleedLeft = idx % 2 === 0

          return (
            <div key={category.id} className="flex flex-col gap-6">
              <div className={bleedLeft ? '-ml-6 sm:-ml-12' : '-mr-6 text-right sm:-mr-12'}>
                <h3 style={outlinedWordStyle(accent)}>{category.label}</h3>
              </div>
              <ul className="flex flex-col">
                {category.items.map((skill) => (
                  <li key={skill.name}>
                    <SkillRow skill={skill} accent={accent} reduced={reduced} />
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default SkillsSection
