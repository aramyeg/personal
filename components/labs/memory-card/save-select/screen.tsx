'use client'

/**
 * SaveSelectScreen — the whole lab is one character-select screen. A figure
 * stands on one side of a deep reflective void; an arc of slowly-spinning save
 * cards fills the other; a compact DOM index sits between them; and a full-width
 * story band under the stage tells the highlighted save's story. Choosing a save
 * re-lights the whole room in that save's PlayStation-button accent — the void
 * atmosphere, the figure's rim light, and the story band all shift together.
 *
 * The cards are the visual index but live inside aria-hidden canvases, so the
 * real control is `IndexRail`, a roving-tabindex listbox of the same six saves.
 * At lg+ the screen is one non-scrolling viewport (figure · index · cards, story
 * beneath); below lg it relaxes into a gently scrolling column.
 *
 * The figure stands left with a horizontal card fan filling the rest of the
 * stage. Reduced motion is read via effect-set state so SSR and the first
 * client paint are byte-identical before reconciling to the real preference.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { MC, GLYPH_ORDER, inkAlpha, voidBackdrop, paperAlpha, type GlyphName } from '../tokens'
import { monoFamily } from '../fonts'
import { useMemoryCardAudioActions } from '../audio-context'
import { BootBeat } from '../boot'
import { VignetteCanvas } from '../three/stage'
import { FigureSceneContents } from '../three/figure-stage'
import { CardArc } from '../three/card-arc'
import { PanelShell } from '../panels/panel-shell'
import { BioPanel } from '../panels/bio-panel'
import { StackPanel } from '../panels/stack-panel'
import { ContactPanel } from '../panels/contact-panel'
import { IndexRail } from './index-rail'
import { StoryBand } from './story-band'
import { buildSaves, type SaveKind, type SaveSlot } from './saves'
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

export type SaveSelectScreenProps = {
  /** Test override for the load action; defaults to routing to the save panel. */
  onLoad?: (save: SaveSlot) => void
  /** Test/SSR override; otherwise detected via effect after mount. */
  reduced?: boolean
}

export function SaveSelectScreen({ onLoad, reduced: reducedProp }: SaveSelectScreenProps) {
  const router = useRouter()
  const audio = useMemoryCardAudioActions()
  const saves = useMemo(() => buildSaves(projects), [])

  const [activeIndex, setActiveIndex] = useState(0)
  const [openDialog, setOpenDialog] = useState<SystemKind | null>(null)
  const [detectedReduced, setDetectedReduced] = useState(false)

  useEffect(() => {
    setDetectedReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  const reduced = reducedProp ?? detectedReduced
  const activeSave = saves[activeIndex]
  const fallbackGlyph = glyphForAccent(activeSave.accent)

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
  // select() blip is fired by the rail/story-band handlers. A test-injected
  // `onLoad` overrides both to observe the call.
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

  // Face the figure toward the cards (inward) so it addresses the arc.
  const figureYaw = 0.55

  const figureCol = (
    <div key="figure" className="relative order-1 min-h-0 lg:order-none lg:h-full">
      <div className="h-[30svh] w-full lg:h-full">
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
            equip={activeIndex === 0}
          />
        </VignetteCanvas>
      </div>
    </div>
  )

  const railCol = (
    <div
      key="rail"
      className="order-3 flex min-h-0 flex-col justify-center lg:order-none lg:h-full"
    >
      <IndexRail
        saves={saves}
        activeIndex={activeIndex}
        onHighlight={handleHighlight}
        onActivate={handleActivate}
      />
    </div>
  )

  const cardsCol = (
    <div key="cards" className="relative order-2 flex min-h-0 flex-col lg:order-none lg:h-full">
      <div className="relative h-[34svh] min-h-0 w-full flex-1 lg:h-full">
        <VignetteCanvas
          reduced={reduced}
          envIntensity={0.6}
          shadowRadius={0.001}
          camera={{ position: [0, 1.05, 6.1], fov: 34 }}
          target={[0, 0.8, 0]}
          fallbackGlyph={fallbackGlyph}
        >
          <CardArc saves={saves} focusIndex={activeIndex} reduced={reduced} />
        </VignetteCanvas>
      </div>
      <p
        className="mt-2 shrink-0 text-center lowercase lg:text-left"
        style={{
          fontFamily: monoFamily,
          fontSize: '0.625rem',
          letterSpacing: '0.16em',
          color: paperAlpha(0.42),
        }}
      >
        <span aria-hidden="true" style={{ color: activeSave.accent }}>
          ◄ ►
        </span>{' '}
        browse saves · enter to load · slot {activeSave.slot}
      </p>
    </div>
  )

  // Left→right stage order — figure, index, cards. The DOM index stays a
  // single ordered list; only the visual columns are arranged here.
  const stageChildren = [figureCol, railCol, cardsCol]
  const stageCols =
    'lg:[grid-template-columns:minmax(0,32%)_minmax(9rem,auto)_minmax(0,1fr)]'

  return (
    <main
      style={{ ['--mc-ring' as string]: CURSOR, background: voidBackdrop(activeSave.accent), color: MC.paper }}
      className="relative h-[100svh] overflow-hidden"
    >
      <BootBeat />

      <div className="relative z-10 flex h-full flex-col gap-y-6 overflow-y-auto px-5 pb-[7rem] pt-[4.5rem] sm:px-8 lg:grid lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-y-4 lg:overflow-hidden lg:px-12 lg:pb-14">
        {/* Stage — figure · index · cards. */}
        <div
          className={`flex min-h-0 shrink-0 flex-col gap-6 lg:grid lg:min-h-0 lg:items-stretch lg:gap-x-8 ${stageCols}`}
        >
          {stageChildren}
        </div>

        {/* Story band — the selected save's story, full width beneath the stage. */}
        <div className="shrink-0">
          <StoryBand save={activeSave} reduced={reduced} onLoad={handleActivate} />
        </div>
      </div>

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
