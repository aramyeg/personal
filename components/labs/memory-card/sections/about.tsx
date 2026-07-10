'use client'

/**
 * AboutSection — act 4, the CRT.
 *
 * The bio, told twice: as prose the reader can actually read (two grotesk
 * columns flanking the console, verbatim from the main site's about section —
 * claims law: Senior Frontend Engineer, never a lead title, no invented facts),
 * and as a phosphor ticker playing on the CRT's screen. Between them, the
 * career in one oversized mono line — the section's typographic ornament.
 *
 * The console is a decorative vignette (aria-hidden); every fact it shows in
 * caps exists as real DOM text in the columns beside it. Hydration-safe: the
 * reveal starts from the `hidden` literal so SSR and both client modes agree,
 * and reduced motion collapses it to a static, present-on-first-frame panel.
 */

import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { MC, TYPE, GLYPH_PATHS, SECTION_ACCENT, inkAlpha } from '../tokens'
import { grotesk, monoFamily } from '../fonts'
import { VignetteCanvas } from '../three/stage'
import { CrtVignette } from '../three/crt-vignette'

const ABOUT_ACCENT = MC.glyphs[SECTION_ACCENT.about]
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

/** CRT staging — the look-dev framing approved at GATE 0 for this GLB. */
const CRT_CAMERA = { position: [0.35, 1.72, 6.4] as [number, number, number], fov: 32 }
const CRT_TARGET: [number, number, number] = [0, 1.5, 0]

/**
 * Bio, transcribed VERBATIM from `components/sections/about.tsx` — the four
 * paragraphs' text content, apostrophes and em dash intact. Never edited for
 * this lab; never a "lead" title; no claim the main site does not make.
 */
const BIO = [
  "I'm a Senior Frontend Engineer. For the last eight years I've built production applications for banks, messaging platforms, and startups.",
  "My journey started in 2016 when I transitioned from marketing to software development. Since then, I've worked remotely for companies across Switzerland, Germany, Estonia, Ireland, and the UAE, specializing in fintech and enterprise platforms.",
  "Currently at xDataGroup, I build the frontend of AMIO Bank's retail banking platform while collaborating directly with founders on an early-stage PropTech startup.",
  'Most of my work sits where correctness matters: moving money, messaging at scale, banking security. I care about interfaces that stay fast and accessible under real load — and about mentoring the developers who build them with me.',
] as const

/** The bio condensed to short caps ticker lines — every one traceable to a fact
 *  above (role, tenure, current employer, the PropTech work, location, start). */
const CRT_LINES = [
  'SENIOR FRONTEND ENGINEER',
  '8 YRS · FINTECH',
  'AMIO BANK · RETAIL',
  'PROPTECH · EARLY STAGE',
  'YEREVAN · WORLDWIDE',
  'SINCE 2016',
]

const ORNAMENT = '8 yrs · fintech systems · yerevan → worldwide'

const reveal: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: ({ reduced }: { reduced: boolean }) => ({
    opacity: 1,
    y: 0,
    transition: reduced ? { duration: 0 } : { duration: 0.7, ease: EASE },
  }),
}

function BioParagraph({ text }: { text: string }) {
  return (
    <p
      style={{
        fontFamily: grotesk.style.fontFamily,
        fontSize: TYPE.body,
        lineHeight: 1.62,
        color: inkAlpha(0.74),
      }}
    >
      {text}
    </p>
  )
}

export type AboutSectionProps = {
  /** Override the media query (client islands otherwise read it themselves). */
  reduced?: boolean
}

export function AboutSection({ reduced: reducedProp }: AboutSectionProps) {
  const systemReduced = useReducedMotion()
  const reduced = reducedProp ?? systemReduced ?? false

  return (
    <section
      id="about"
      style={{ ['--mc-ring' as string]: ABOUT_ACCENT, background: MC.paper, color: MC.ink }}
      className="relative px-6 py-16 sm:px-12 sm:py-32"
    >
      {/* Hairline section edge — skills and about both sit on paper, so a rule
          marks the seam between them. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: inkAlpha(0.14) }}
      />

      <motion.div
        custom={{ reduced }}
        variants={reveal}
        initial="hidden"
        animate={reduced ? 'show' : undefined}
        whileInView={reduced ? undefined : 'show'}
        viewport={reduced ? undefined : { once: true, amount: 0.3 }}
        className="mx-auto w-full max-w-[72rem]"
      >
        {/* Eyebrow — the section marker + its one accent glyph (square). */}
        <div className="mb-10 flex items-center gap-3 sm:mb-14">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="none">
            <path d={GLYPH_PATHS.square} stroke={ABOUT_ACCENT} strokeWidth={2.2} />
          </svg>
          <span
            style={{
              fontFamily: monoFamily,
              fontSize: TYPE.label,
              letterSpacing: '0.24em',
              color: inkAlpha(0.55),
            }}
            className="lowercase"
          >
            act 04 · about
          </span>
        </div>

        {/* The flank row: bio prose, the console, more bio. On mobile the
            console drops between the two halves of the bio. */}
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)_minmax(0,1fr)] lg:gap-12">
          <div className="flex flex-col gap-5 lg:order-1">
            <BioParagraph text={BIO[0]} />
            <BioParagraph text={BIO[1]} />
          </div>

          {/* The CRT — decorative; the columns carry the same facts as text. */}
          <div
            data-testid="about-vignette"
            aria-hidden="true"
            className="order-first h-[360px] w-full sm:h-[420px] lg:order-2"
          >
            <VignetteCanvas
              height="100%"
              reduced={reduced}
              camera={CRT_CAMERA}
              target={CRT_TARGET}
              shadowRadius={2.2}
              envIntensity={0.7}
              fallbackGlyph={SECTION_ACCENT.about}
            >
              <CrtVignette lines={CRT_LINES} reduced={reduced} />
            </VignetteCanvas>
          </div>

          <div className="flex flex-col gap-5 lg:order-3">
            <BioParagraph text={BIO[2]} />
            <BioParagraph text={BIO[3]} />
          </div>
        </div>

        {/* The career in one oversized mono line — the section's ornament. */}
        <p
          style={{
            fontFamily: monoFamily,
            fontSize: 'clamp(1.5rem, 4.6vw, 3.25rem)',
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
            color: inkAlpha(0.82),
          }}
          className="mt-14 lowercase sm:mt-24"
        >
          {ORNAMENT}
        </p>
      </motion.div>
    </section>
  )
}

export default AboutSection
