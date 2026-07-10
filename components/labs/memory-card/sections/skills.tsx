'use client'

/**
 * SkillsSection — act 3, "written with".
 *
 * This lab is a save file; this section is its metadata panel. Not the whole
 * skill inventory (that lives on the main site) — just the curated stack that
 * actually wrote THIS page, each entry pointing at something real and present
 * on it. One hairline slot-panel on paper, rhyming in form with the hero
 * capsule and inverting its palette (ink-on-paper, not paper-on-ink). No bars,
 * no meters, no outlined-word wall — the usage notes carry the section.
 */

import Link from 'next/link'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { MC, TYPE, GLYPH_PATHS, SECTION_ACCENT, inkAlpha } from '../tokens'
import { grotesk, monoFamily } from '../fonts'
import { WRITTEN_WITH } from '../lib/written-with'

const SKILLS_ACCENT = MC.glyphs[SECTION_ACCENT.skills]

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

/**
 * One quiet reveal for the whole panel: a small rise + fade, once, on scroll-in.
 * `initial` is always the `hidden` literal so SSR and both client modes paint
 * identical markup (hero's hydration-safe pattern); reduced motion collapses the
 * transition to zero so the panel is simply present on the first frame.
 */
const panelReveal: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: ({ reduced }: { reduced: boolean }) => ({
    opacity: 1,
    y: 0,
    transition: reduced ? { duration: 0 } : { duration: 0.7, ease: EASE },
  }),
}

export type SkillsSectionProps = {
  /** Override the media query (client islands otherwise read it themselves). */
  reduced?: boolean
}

export function SkillsSection({ reduced: reducedProp }: SkillsSectionProps) {
  const systemReduced = useReducedMotion()
  const reduced = reducedProp ?? systemReduced ?? false

  return (
    <section
      id="skills"
      style={{ ['--mc-ring' as string]: SKILLS_ACCENT, background: MC.paper, color: MC.ink }}
      className="relative px-6 py-14 sm:px-12 sm:py-32"
    >
      {/* Hairline transition edge — the ink-to-paper flip is deliberate. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: inkAlpha(0.16) }}
      />

      <motion.div
        custom={{ reduced }}
        variants={panelReveal}
        initial="hidden"
        animate={reduced ? 'show' : undefined}
        whileInView={reduced ? undefined : 'show'}
        viewport={reduced ? undefined : { once: true, amount: 0.4 }}
        className="mx-auto w-full max-w-[46rem]"
      >
        {/* The slot panel — a hairline vessel, faint recessed fill, echoing the
            hero capsule's rounded-vessel language on the opposite palette. */}
        <div
          className="rounded-[28px] px-6 py-8 sm:px-10 sm:py-10"
          style={{ border: `1px solid ${inkAlpha(0.2)}`, background: inkAlpha(0.025) }}
        >
          {/* Panel header — the section's glyph leads the mono label as an
              identity mark (kept inline so it never reads as a close button),
              the section's single accent hit. */}
          <div
            className="flex items-center gap-3 border-b pb-5"
            style={{ borderColor: inkAlpha(0.12) }}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="13" height="13" fill="none">
              <path
                d={GLYPH_PATHS.cross}
                stroke={SKILLS_ACCENT}
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            </svg>
            <span
              style={{
                fontFamily: monoFamily,
                fontSize: TYPE.label,
                letterSpacing: '0.22em',
                color: inkAlpha(0.55),
              }}
              className="lowercase"
            >
              this file · written with
            </span>
          </div>

          {/* Curated entries — name (grotesk 600) + a concrete lowercase mono
              note. A description list: each note describes its skill, so screen
              readers read "React, the component tree behind every section." */}
          <dl className="flex flex-col">
            {WRITTEN_WITH.map((entry, idx) => (
              <div
                key={entry.name}
                className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-8"
                style={
                  idx < WRITTEN_WITH.length - 1
                    ? { borderBottom: `1px solid ${inkAlpha(0.08)}` }
                    : undefined
                }
              >
                <dt
                  style={{ fontFamily: grotesk.style.fontFamily, fontWeight: 600, color: MC.ink }}
                  className="shrink-0 text-[1.0625rem] sm:w-44"
                >
                  {entry.name}
                </dt>
                <dd
                  style={{
                    fontFamily: monoFamily,
                    fontSize: TYPE.label,
                    letterSpacing: '0.02em',
                    color: inkAlpha(0.5),
                  }}
                  className="lowercase leading-relaxed"
                >
                  {entry.note}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Closing line — the curated subset here, the full stack elsewhere. */}
        {/* Right-aligned at every width — the gallery FAB owns the bottom-left,
            and the mobile left inset keeps the long label wrapping clear of it. */}
        <div className="mt-6 flex justify-end pl-16 sm:pl-0">
          <Link
            href="/#skills"
            style={{
              fontFamily: monoFamily,
              fontSize: TYPE.label,
              letterSpacing: '0.06em',
              color: inkAlpha(0.5),
            }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md px-2 lowercase transition-colors hover:text-[color:var(--mc-ring)] focus-visible:outline-none focus-visible:[outline:2px_solid_var(--mc-ring)] focus-visible:[outline-offset:3px]"
          >
            full save data lives in the main site
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </motion.div>
    </section>
  )
}

export default SkillsSection
