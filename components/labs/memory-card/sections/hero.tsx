'use client'

/**
 * HeroSection — act 1, "select your file".
 *
 * The name is the thesis: massive Anton display type on boot black, with the
 * (identity-agnostic, swappable) character breaking out of the type block on
 * the right. The intro is one orchestrated beat — a top-to-bottom cascade of
 * clip-path line wipes plus a select-screen flicker on the ghost triangle,
 * under a second, played once. Everything collapses to a still, well-posed
 * frame under reduced motion.
 */

import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { siteConfig } from '@/lib/constants'
import { MC, TYPE, GLYPH_PATHS, SECTION_ACCENT, inkAlpha, paperAlpha } from '../tokens'
import { anton, monoFamily } from '../fonts'
import { VignetteCanvas } from '../three/stage'
import { GltfVignette } from '../three/gltf-vignette'

const HERO_ACCENT = MC.glyphs[SECTION_ACCENT.hero]

// The hero character GLB and the idle clip baked into it. Named for its role,
// never its identity — the asset is swapped later and nothing here assumes one.
const CHARACTER_SRC = '/labs/memory-card/models/character.glb'
const CHARACTER_IDLE_CLIP = 'Armature.F|bashful'
// Head-on look-dev framing: the figure is centered inside the capsule now, so
// the old +x breakout pan is dropped and camera/target sit back on the axis
// with headroom and floor room. The capsule (not the raw figure) is what
// overlaps the headline — that layering is done in layout, not the camera.
const HERO_CAMERA = { position: [0.4, 1.75, 6.3] as [number, number, number], fov: 30 }
const HERO_TARGET: [number, number, number] = [0, 1.4, 0]

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

/**
 * One line of the intro cascade: a bottom-up clip wipe with a small rise,
 * staggered by its index so the whole block reads top-to-bottom in ~0.95s.
 * `initial` is always `hidden` (server and client agree, so no hydration
 * mismatch); reduced motion just collapses the transition to zero so the line
 * snaps to its resting state on the first frame instead of wiping in.
 */
const lineReveal: Variants = {
  hidden: { clipPath: 'inset(0 0 118% 0)', y: '0.18em', opacity: 0 },
  show: ({ i, reduced }: { i: number; reduced: boolean }) => ({
    clipPath: 'inset(0 0 0% 0)',
    y: 0,
    opacity: 1,
    transition: reduced
      ? { duration: 0 }
      : { duration: 0.66, ease: EASE, delay: 0.04 + i * 0.085 },
  }),
}

export type HeroSectionProps = {
  /** Override the media query (client islands otherwise read it themselves). */
  reduced?: boolean
}

export function HeroSection({ reduced: reducedProp }: HeroSectionProps) {
  const systemReduced = useReducedMotion()
  const reduced = reducedProp ?? systemReduced ?? false

  const [firstName, ...restName] = siteConfig.name.split(' ')
  const lastName = restName.join(' ')

  const revealProps = (i: number) => ({
    custom: { i, reduced },
    variants: lineReveal,
    initial: 'hidden' as const,
    animate: 'show' as const,
  })

  return (
    <section
      id="hero"
      style={{ ['--mc-ring' as string]: HERO_ACCENT, background: MC.ink, color: MC.paper }}
      className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden px-6 pt-16 pb-24 sm:px-12 lg:pb-16"
    >
      {/* Ghost triangle — select-screen flicker on load, faint hold after. */}
      <motion.svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="pointer-events-none absolute left-[4%] top-1/2 z-0 h-[86vh] w-[86vh] -translate-y-1/2"
        initial={{ opacity: 0 }}
        animate={reduced ? { opacity: 0.12 } : { opacity: [0, 0.12, 0.03, 0.12, 0.05, 0.12] }}
        transition={
          reduced
            ? { duration: 0 }
            : { duration: 0.5, delay: 0.15, times: [0, 0.2, 0.4, 0.6, 0.8, 1] }
        }
      >
        <path
          d={GLYPH_PATHS.triangle}
          stroke={HERO_ACCENT}
          strokeWidth={0.4}
          strokeLinejoin="round"
        />
      </motion.svg>

      {/* Character capsule: a select-screen pod drawn in the lab's hairline
          language — a tall pill that crops the canvas (this overflow-hidden
          replaces the old edge-fade mask). Reserved + aria-hidden so the canvas
          mount never shifts layout. Centered below the type on mobile; on
          desktop it sits right-of-center and its frame overlaps the headline's
          right edge, keeping the layered feel while the type still dominates. */}
      <div
        data-testid="hero-vignette"
        aria-hidden="true"
        className="pointer-events-none relative z-20 order-last mx-auto mt-8 h-[50vh] w-[64vw] max-w-[300px] overflow-hidden rounded-full lg:absolute lg:inset-y-0 lg:right-[18vw] lg:my-auto lg:mt-0 lg:h-[76vh] lg:w-[32vw] lg:max-w-[460px]"
        style={{ border: `1px solid ${paperAlpha(0.2)}`, background: paperAlpha(0.03) }}
      >
        <VignetteCanvas
          height="100%"
          reduced={reduced}
          camera={HERO_CAMERA}
          target={HERO_TARGET}
          shadowRadius={1.5}
          envIntensity={1.15}
          fallbackGlyph={SECTION_ACCENT.hero}
        >
          <GltfVignette
            src={CHARACTER_SRC}
            fitHeight={2.4}
            yaw={0.7}
            spin={false}
            animation={CHARACTER_IDLE_CLIP}
          />
        </VignetteCanvas>

        {/* Rim nameplate — one small mono chip, character-select energy. */}
        <div
          className="absolute bottom-[6%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1"
          style={{ border: `1px solid ${paperAlpha(0.18)}`, background: inkAlpha(0.5) }}
        >
          <span
            style={{
              fontFamily: monoFamily,
              fontSize: '0.625rem',
              letterSpacing: '0.24em',
              color: paperAlpha(0.7),
            }}
            className="lowercase"
          >
            file 01 · idle
          </span>
        </div>
      </div>

      {/* Type block */}
      <div className="relative z-10 max-w-[62rem]">
        <motion.p
          {...revealProps(0)}
          style={{
            fontFamily: monoFamily,
            fontSize: TYPE.label,
            letterSpacing: '0.28em',
            color: HERO_ACCENT,
          }}
          className="mb-5 lowercase"
        >
          select your file
        </motion.p>

        <h1
          style={{
            fontFamily: anton.style.fontFamily,
            fontSize: TYPE.display,
            lineHeight: 0.92,
            letterSpacing: '-0.005em',
            textTransform: 'uppercase',
          }}
        >
          <motion.span {...revealProps(1)} className="block">
            {firstName}
          </motion.span>
          <motion.span {...revealProps(2)} className="block">
            {lastName}
          </motion.span>
        </h1>

        <motion.p
          {...revealProps(3)}
          style={{
            fontFamily: anton.style.fontFamily,
            fontSize: TYPE.h2,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            color: paperAlpha(0.82),
          }}
          className="mt-5"
        >
          {siteConfig.title}
        </motion.p>
      </div>

      {/* Scroll cue — save-glyph pointing down, gentle bob. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reduced ? { duration: 0 } : { delay: 1.05, duration: 0.5 }}
      >
        <motion.div
          className="flex flex-col items-center gap-2"
          animate={reduced ? undefined : { y: [0, 8, 0] }}
          transition={reduced ? undefined : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span
            style={{
              fontFamily: monoFamily,
              fontSize: '0.6875rem',
              letterSpacing: '0.3em',
              color: paperAlpha(0.55),
            }}
            className="lowercase"
          >
            scroll
          </span>
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            style={{ transform: 'rotate(180deg)' }}
          >
            <path
              d={GLYPH_PATHS.triangle}
              stroke={HERO_ACCENT}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </motion.div>
      </motion.div>
    </section>
  )
}

export default HeroSection
