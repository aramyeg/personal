'use client'

/**
 * SaveSelectScreen — the whole lab is this one screen: a single full-viewport
 * ink console that never scrolls at desktop sizes. The save index (header +
 * strips) holds the left column, a single-object 3D stage previews the
 * highlighted save on the right, and a mono stat line spans the bottom with the
 * LOAD affordance. Below lg it relaxes into a gently scrolling column — stage
 * first, then strips, then the stat line.
 *
 * State lives here: `activeIndex` (which save is highlighted) and `flipped`
 * (whether the previewed card shows its metrics back). Highlighting a save
 * resets the flip so a fresh save always opens on its front. `onLoad` is the
 * one outward seam — R4 wires it to routing / dialogs; its default no-op keeps
 * this screen shippable on its own.
 *
 * Reduced motion is read via effect-set state so SSR and the first client paint
 * are byte-identical (both unreduced) before reconciling to the real
 * preference — it never appears in initial render output.
 */

import { useEffect, useMemo, useState } from 'react'
import { MC, TYPE, paperAlpha } from '../tokens'
import { anton, monoFamily } from '../fonts'
import { SaveStage } from '../three/save-stage'
import { SaveStrips } from './save-strips'
import { StatLine } from './stat-line'
import { buildSaves, blocksUsed, CARD_BLOCKS_TOTAL, type SaveSlot } from './saves'
import { projects } from '@/data/projects'

const CURSOR = MC.glyphs.triangle

export type SaveSelectScreenProps = {
  /** R4 wires this to router.push / dialog state; default no-op ships R3 alone. */
  onLoad?: (save: SaveSlot) => void
  /** Test/SSR override; otherwise detected via effect after mount. */
  reduced?: boolean
}

export function SaveSelectScreen({ onLoad, reduced: reducedProp }: SaveSelectScreenProps) {
  const saves = useMemo(() => buildSaves(projects), [])
  const used = useMemo(() => blocksUsed(saves), [saves])

  const [activeIndex, setActiveIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [detectedReduced, setDetectedReduced] = useState(false)

  useEffect(() => {
    setDetectedReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  const reduced = reducedProp ?? detectedReduced
  const activeSave = saves[activeIndex]

  const handleHighlight = (index: number) => {
    setActiveIndex(index)
    setFlipped(false)
  }

  const handleActivate = (save: SaveSlot) => {
    onLoad?.(save)
  }

  const handleTap = () => {
    if (activeSave.kind === 'bio') return
    setFlipped((current) => !current)
  }

  return (
    <main
      style={{ ['--mc-ring' as string]: CURSOR, background: MC.ink, color: MC.paper }}
      className="relative h-[100svh] overflow-hidden"
    >
      {/* Soft studio light pool — the only atmosphere the page allows itself
          (restraint law: no scanlines or CRT filters here). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: `radial-gradient(58% 52% at 56% 34%, ${paperAlpha(0.05)} 0%, transparent 62%)`,
        }}
      />

      {/* `pb-[7rem]` clears the fixed credits footer (chrome.tsx), whose
          real rendered height is ~68px across 320–390px mobile viewports
          (3 wrapped credit lines + padding + hairline) — comfortable buffer
          so the last strip and the stat line always scroll fully clear of
          it. Desktop never scrolls this column (`lg:overflow-hidden`), so
          `lg:pb-16` stays the original, unrelated spacing value. */}
      <div className="relative z-10 flex h-full flex-col overflow-y-auto px-5 pb-[7rem] pt-[4.5rem] sm:px-8 lg:grid lg:grid-cols-[minmax(0,44%)_1fr] lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-x-12 lg:overflow-hidden lg:pb-16 lg:pt-[4.5rem]">
        {/* Stage — first on mobile, right column on desktop. */}
        <div className="order-1 flex h-[38svh] min-h-0 shrink-0 flex-col lg:order-2 lg:col-start-2 lg:row-start-1 lg:h-auto">
          <div className="relative min-h-0 flex-1">
            <SaveStage save={activeSave} flipped={flipped} reduced={reduced} onTap={handleTap} />
          </div>
          <p
            className="mt-2 shrink-0 text-center lowercase"
            style={{
              fontFamily: monoFamily,
              fontSize: '0.625rem',
              letterSpacing: '0.16em',
              color: paperAlpha(0.42),
            }}
          >
            previewing · {activeSave.label.toLowerCase()}
            {activeSave.kind === 'project' ? ' · tap to flip' : ''}
          </p>
        </div>

        {/* Index — the SELECT FILE header and the save strips. */}
        <section className="order-2 mt-8 flex shrink-0 flex-col lg:order-1 lg:col-start-1 lg:row-start-1 lg:mt-0 lg:min-h-0 lg:justify-center">
          <header className="mb-5 shrink-0">
            <h1
              style={{
                fontFamily: anton.style.fontFamily,
                fontSize: TYPE.h2,
                lineHeight: 0.95,
                letterSpacing: '0.005em',
                textTransform: 'uppercase',
              }}
            >
              select file
            </h1>
            <p
              className="mt-2 lowercase"
              style={{
                fontFamily: monoFamily,
                fontSize: '0.6875rem',
                letterSpacing: '0.18em',
                color: paperAlpha(0.5),
              }}
            >
              aram yeghiazaryan · senior frontend engineer
            </p>
          </header>

          <div className="min-h-0 lg:overflow-y-auto">
            <SaveStrips
              saves={saves}
              activeIndex={activeIndex}
              onHighlight={handleHighlight}
              onActivate={handleActivate}
              reduced={reduced}
            />
          </div>
        </section>

        {/* Stat line — last on mobile, full-width bottom row on desktop. */}
        <div className="order-3 mt-8 shrink-0 lg:col-span-2 lg:row-start-2 lg:mt-6">
          <StatLine save={activeSave} used={used} total={CARD_BLOCKS_TOTAL} onLoad={handleActivate} />
        </div>
      </div>
    </main>
  )
}

export default SaveSelectScreen
