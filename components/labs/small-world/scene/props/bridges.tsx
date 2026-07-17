'use client'
import { CROSSINGS_A, CROSSINGS_B } from '../biomes'
import { DECK_RISE } from '../stage'
import { GatedProp } from './gated-prop'
import { ClayBridge } from './clay-kit'
import type { JourneyRef } from '../use-journey'

/**
 * Always-present wooden footbridges, one per authored river crossing — but now a
 * variant-A copy AND a variant-B copy at each crossing, each gated at that
 * crossing's own longitude so exactly one is visible (A-visible XOR B-visible by
 * the shared 0.5 threshold). Today the two lists are identical, so the swap is
 * invisible; Task 20 diverges them and the mechanism already carries it. Lives
 * inside Planet (not chapter-gated) so the girl always has a deck to cross.
 */
export function Bridges({ journeyRef }: { journeyRef: JourneyRef }) {
  return (
    <>
      {CROSSINGS_A.map((theta) => (
        <GatedProp key={`a-${theta}`} theta={theta} x={0} variant={0} journeyRef={journeyRef}>
          <ClayBridge rise={DECK_RISE} />
        </GatedProp>
      ))}
      {CROSSINGS_B.map((theta) => (
        <GatedProp key={`b-${theta}`} theta={theta} x={0} variant={1} journeyRef={journeyRef}>
          <ClayBridge rise={DECK_RISE} />
        </GatedProp>
      ))}
    </>
  )
}
