'use client'

/**
 * SaveSelectScreen — the whole lab is one character-select screen, now composed
 * as a split hero. On the LEFT half the character stands large on a lit ground —
 * a CSS atmosphere (accent wash, cool mid lift, ground glow, fog + turntable
 * disc) pooled around the ONE live WebGL scene (the FigureStage canvas), the
 * per-save accent finally owning real estate. A giant Anton display title runs
 * across the bottom, bridging the seam, with the figure standing over its own
 * name (poster depth). On the RIGHT half a flat spec-sheet of six save files
 * (`SlotSelect`) is the index; its active row lifts into a raised card that
 * expands to the save's story, chips, stats, and LOAD control. The card fan and
 * its second 3D scene are gone.
 *
 * Choosing a save re-lights the hero atmosphere in that save's accent, re-dresses
 * the figure into its fit, and swaps the display title — the payoff of the lab.
 * The real control is `SlotSelect` (roving-tabindex listbox); the figure canvas
 * is aria-hidden. Desktop (lg+) is one non-scrolling poster; below lg it relaxes
 * into a scrolling column (hero, title, slots) with the footer flowing clear of
 * the last rows. Reduced motion is read via effect-set state so SSR and the
 * first client paint are byte-identical before reconciling to the real
 * preference.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useAnimate, stagger } from 'framer-motion'
import {
  MC,
  GLYPH_ORDER,
  MOTION,
  inkAlpha,
  paperAlpha,
  withAlpha,
  heroAtmosphere,
  pageBackdrop,
  type GlyphName,
} from '../tokens'
import { anton, monoFamily } from '../fonts'
import { useMemoryCardAudioActions } from '../audio-context'
import { BootBeat } from '../boot'
import { Grain } from '../grain'
import { VignetteCanvas } from '../three/stage'
import { FigureSceneContents } from '../three/figure-stage'
import { PanelShell } from '../panels/panel-shell'
import { BioPanel } from '../panels/bio-panel'
import { StackPanel } from '../panels/stack-panel'
import { ContactPanel } from '../panels/contact-panel'
import { SlotSelect } from './slot-select'
import { buildSaves, saveTitle, type SaveKind, type SaveSlot } from './saves'
import { projects } from '@/data/projects'

/** The three system saves that open a dialog rather than routing to a panel. */
type SystemKind = Exclude<SaveKind, 'project'>

/** Dialog accessible name per system kind (PanelShell's `title`). */
const DIALOG_TITLE: Record<SystemKind, string> = {
  bio: 'system data',
  stack: 'written with',
  contact: 'save your progress',
}

/** The content component for a system save, rendered inside PanelShell (or bare
 *  inside the hidden crawler wrapper when the dialog is closed). */
function systemDialogContent(save: SaveSlot, onClose: () => void) {
  switch (save.kind) {
    case 'bio':
      return <BioPanel save={save} />
    case 'stack':
      return <StackPanel save={save} />
    case 'contact':
      return <ContactPanel save={save} onClose={onClose} />
    default:
      return null
  }
}

/**
 * One system dialog. Its content stays in the DOM in both states so crawlers
 * always see it: closed, it renders bare inside a `hidden` wrapper (present in
 * the server HTML); open, the wrapper shows and the content lifts into a
 * paper `PanelShell` over an ink scrim — the same overlay language as the
 * project save panels. PanelShell owns Esc / focus-trap / return-focus while
 * mounted, so it is mounted only while open (never three at once).
 */
function SystemDialogHost({
  save,
  open,
  reduced,
  onClose,
}: {
  save: SaveSlot
  open: boolean
  reduced: boolean
  onClose: () => void
}) {
  const content = systemDialogContent(save, onClose)
  return (
    <div hidden={!open}>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex lg:items-center lg:justify-center lg:p-6"
          style={{ background: inkAlpha(0.6), ['--mc-ring' as string]: save.accent }}
          onClick={onClose}
          // Panels fade only — no slide/scale — and instant under reduced motion.
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
        >
          <div className="w-full lg:max-w-[46rem]">
            <PanelShell title={DIALOG_TITLE[save.kind as SystemKind]} onClose={onClose}>
              {content}
            </PanelShell>
          </div>
        </motion.div>
      ) : (
        content
      )}
    </div>
  )
}

const CURSOR = MC.glyphs.triangle

/** Reverse the accent cycle back to a glyph name for the no-WebGL fallback mark. */
function glyphForAccent(accent: string): GlyphName {
  return GLYPH_ORDER.find((g) => MC.glyphs[g] === accent) ?? 'triangle'
}

/** The hero eyebrow — a mono spec tag in the active save's accent. */
function eyebrowText(save: SaveSlot): string {
  if (save.kind === 'project' && save.project) {
    return `save ${save.slot} · loaded · ${save.project.category}`
  }
  return `save ${save.slot} · ${save.label}`
}

export type SaveSelectScreenProps = {
  /** Test override for the load action; defaults to routing to the save panel. */
  onLoad?: (save: SaveSlot) => void
  /** Test/SSR override; otherwise detected via effect after mount. */
  reduced?: boolean
}

export function SaveSelectScreen({ onLoad, reduced: reducedProp }: SaveSelectScreenProps) {
  const router = useRouter()
  const saves = useMemo(() => buildSaves(projects), [])

  const [activeIndex, setActiveIndex] = useState(0)
  const [openDialog, setOpenDialog] = useState<SystemKind | null>(null)
  const [detectedReduced, setDetectedReduced] = useState(false)

  const [heroScope, animateHero] = useAnimate()
  const firstReveal = useRef(true)

  const audio = useMemoryCardAudioActions()

  useEffect(() => {
    setDetectedReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  const reduced = reducedProp ?? detectedReduced
  const activeSave = saves[activeIndex]
  const fallbackGlyph = glyphForAccent(activeSave.accent)

  // Title swap + eyebrow crossfade — the hero half of the signature select
  // transition. Client-only (skips first paint for hydration) and reduced-safe.
  useEffect(() => {
    if (firstReveal.current) {
      firstReveal.current = false
      return
    }
    if (reduced) return
    animateHero(
      '[data-hero-reveal]',
      { opacity: [0, 1], y: [MOTION.rise, 0] },
      { duration: MOTION.select, delay: stagger(MOTION.stagger), ease: MOTION.easeEntranceArr }
    )
  }, [activeIndex, reduced, animateHero])

  const handleHighlight = (index: number) => setActiveIndex(index)

  // Closing any system dialog fires the back() blip and drops the overlay — the
  // one place the close sound lives, mirroring the project panel's `close()`.
  const closeDialog = useCallback(() => {
    audio.back()
    setOpenDialog(null)
  }, [audio])

  // Loading a save opens it as a paper panel over this screen. Project saves
  // route to their intercepting overlay (`/save/[id]`); the three system saves
  // open their dialog in place (content already in the DOM for crawlers). The
  // select() blip is fired by the slot-select handlers. A test-injected `onLoad`
  // overrides both to observe the call.
  const handleActivate = (save: SaveSlot) => {
    if (onLoad) {
      onLoad(save)
      return
    }
    if (save.kind === 'project' && save.project) {
      router.push(`/labs/memory-card/save/${save.project.id}`)
      return
    }
    setOpenDialog(save.kind as SystemKind)
  }

  const systemSaves = useMemo(() => saves.filter((save) => save.kind !== 'project'), [saves])

  // Face the figure toward the camera (front three-quarter) now that it stands
  // alone over its own name — no card fan to address. The turntable spin is E5's.
  const figureYaw = 0

  return (
    <main
      style={{
        ['--mc-ring' as string]: CURSOR,
        background: pageBackdrop(),
        color: MC.paper,
      }}
      className="relative min-h-[100svh] overflow-x-hidden lg:h-[100svh] lg:overflow-hidden"
    >
      <BootBeat />

      <div
        ref={heroScope}
        className="relative flex min-h-[100svh] flex-col px-5 pb-[6rem] pt-[4rem] sm:px-8 lg:absolute lg:inset-x-0 lg:bottom-9 lg:top-12 lg:block lg:min-h-0 lg:p-0"
      >
        {/* HERO — atmosphere + ground + figure + eyebrow (one WebGL scene). */}
        <div className="relative h-[48svh] w-full lg:contents">
          {/* per-save accent atmosphere (behind everything) */}
          <div
            aria-hidden="true"
            className="absolute inset-0 z-0 lg:bottom-0 lg:left-0 lg:right-auto lg:top-0 lg:w-[54%]"
            style={{ background: heroAtmosphere(activeSave.accent) }}
          />
          {/* fog glow + turntable disc at the figure's feet */}
          <div
            aria-hidden="true"
            className="absolute bottom-[8%] left-1/2 z-[1] h-[26%] w-[78%] -translate-x-1/2 lg:bottom-[15%] lg:left-[27%] lg:w-[42%]"
            style={{
              background: `radial-gradient(60% 100% at 50% 100%, ${withAlpha(activeSave.accent, 0.1)}, transparent 70%)`,
              filter: 'blur(24px)',
            }}
          />
          <div
            aria-hidden="true"
            className="absolute bottom-[9%] left-1/2 z-[1] h-[52px] w-[62%] -translate-x-1/2 rounded-[50%] lg:bottom-[16%] lg:left-[27%] lg:w-[34%]"
            style={{
              border: `1px solid ${withAlpha(activeSave.accent, 0.22)}`,
              background: `radial-gradient(ellipse at center, ${withAlpha(activeSave.accent, 0.05)}, transparent 70%)`,
            }}
          />
          {/* the figure — transparent canvas, stands over the title (poster depth) */}
          <div className="absolute inset-0 z-[3] lg:bottom-0 lg:left-0 lg:right-auto lg:top-0 lg:w-[54%]">
            <VignetteCanvas
              reduced={reduced}
              envIntensity={1.05}
              shadowRadius={1.35}
              fallbackGlyph={fallbackGlyph}
            >
              <FigureSceneContents
                fit={activeSave.fit}
                yaw={figureYaw}
                reduced={reduced}
                accent={activeSave.accent}
              />
            </VignetteCanvas>
          </div>
          {/* eyebrow */}
          <p
            data-hero-reveal
            className="absolute left-1 top-1 z-[4] uppercase lg:left-[6%] lg:top-[8%]"
            style={{
              fontFamily: monoFamily,
              fontSize: '0.6875rem',
              letterSpacing: '0.2em',
              color: activeSave.accent,
            }}
          >
            {eyebrowText(activeSave)}
          </p>
          {/* vertical editorial spine (desktop) */}
          <span
            aria-hidden="true"
            className="z-[4] hidden select-none uppercase lg:absolute lg:left-1 lg:top-1/2 lg:block lg:-translate-y-1/2"
            style={{
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              fontFamily: monoFamily,
              fontSize: '0.625rem',
              letterSpacing: '0.42em',
              color: paperAlpha(0.32),
            }}
          >
            save select · character re-dress
          </span>
        </div>

        {/* BIG DISPLAY TITLE — bridges the seam, behind the figure. */}
        <div className="relative z-[2] mt-6 lg:absolute lg:bottom-0 lg:left-0 lg:right-0 lg:mt-0 lg:flex lg:h-[20vh] lg:items-end lg:px-[3.5vw]">
          <h1
            data-hero-reveal
            className="whitespace-normal lg:whitespace-nowrap"
            style={{
              fontFamily: anton.style.fontFamily,
              fontWeight: 400,
              fontSize: 'clamp(3rem, 13vw, 12rem)',
              lineHeight: 0.86,
              letterSpacing: '-0.03em',
              color: MC.paper,
            }}
          >
            {saveTitle(activeSave)}
          </h1>
        </div>

        {/* SLOT SELECT — the spec-sheet index, right half. */}
        <div className="relative z-[5] mt-8 lg:absolute lg:bottom-[22vh] lg:right-0 lg:top-0 lg:mt-0 lg:w-[46%] lg:overflow-y-auto lg:pl-6 lg:pr-10">
          <SlotSelect
            saves={saves}
            activeIndex={activeIndex}
            reduced={reduced}
            onHighlight={handleHighlight}
            onActivate={handleActivate}
          />
        </div>
      </div>

      <Grain />

      {/* System dialogs — bio / written-with / contact. Content is always in the
          DOM (hidden when closed) so it ships in the server HTML; activating a
          system save lifts it into a paper panel over this screen. */}
      {systemSaves.map((save) => (
        <SystemDialogHost
          key={save.kind}
          save={save}
          open={openDialog === save.kind}
          reduced={reduced}
          onClose={closeDialog}
        />
      ))}
    </main>
  )
}

export default SaveSelectScreen
