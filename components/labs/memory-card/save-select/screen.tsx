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

import { useEffect, useMemo, useState } from 'react'
import { MC, GLYPH_ORDER, voidBackdrop, paperAlpha, type GlyphName } from '../tokens'
import { monoFamily } from '../fonts'
import { VignetteCanvas } from '../three/stage'
import { FigureSceneContents } from '../three/figure-stage'
import { CardArc } from '../three/card-arc'
import { IndexRail } from './index-rail'
import { StoryBand } from './story-band'
import { buildSaves, type SaveSlot } from './saves'
import { projects } from '@/data/projects'

const CURSOR = MC.glyphs.triangle

/** Reverse the accent cycle back to a glyph name for the no-WebGL fallback mark. */
function glyphForAccent(accent: string): GlyphName {
  return GLYPH_ORDER.find((g) => MC.glyphs[g] === accent) ?? 'triangle'
}

export type SaveSelectScreenProps = {
  /** R4 wires this to router.push / dialog state; default no-op ships this alone. */
  onLoad?: (save: SaveSlot) => void
  /** Test/SSR override; otherwise detected via effect after mount. */
  reduced?: boolean
}

export function SaveSelectScreen({ onLoad, reduced: reducedProp }: SaveSelectScreenProps) {
  const saves = useMemo(() => buildSaves(projects), [])

  const [activeIndex, setActiveIndex] = useState(0)
  const [detectedReduced, setDetectedReduced] = useState(false)

  useEffect(() => {
    setDetectedReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  const reduced = reducedProp ?? detectedReduced
  const activeSave = saves[activeIndex]
  const fallbackGlyph = glyphForAccent(activeSave.accent)

  const handleHighlight = (index: number) => setActiveIndex(index)
  const handleActivate = (save: SaveSlot) => onLoad?.(save)

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
    </main>
  )
}

export default SaveSelectScreen
