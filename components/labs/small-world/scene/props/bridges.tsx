'use client'
import { CROSSINGS_A, CROSSINGS_B } from '../biomes'
import { DECK_RISE } from '../stage'
import { GatedProp } from './gated-prop'
import { ClayBridge } from './clay-kit'
import type { JourneyRef } from '../use-journey'

/**
 * Always-present wooden footbridges, one per authored river crossing — a variant-A copy
 * at each A crossing and a variant-B copy at each B crossing, each gated at that crossing's
 * own longitude so exactly one is visible (A-visible XOR B-visible by the shared 0.5
 * threshold). Task 20 diverged the two lists; Task 46 dropped the B0 DESERT crossing
 * entirely (CROSSINGS_B now holds only the canyon + winter B crossings), so lap 2 has NO
 * bridge over the desert — the girl walks continuous dry sand there. Lives inside Planet
 * (not chapter-gated) so the girl always has a deck wherever a crossing DOES exist.
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
