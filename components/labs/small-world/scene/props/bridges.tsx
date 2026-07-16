'use client'
import { RIVER_CROSSINGS } from '../biomes'
import { DECK_RISE } from '../stage'
import { PropAnchor } from './prop-anchor'
import { ClayBridge } from './clay-kit'

/**
 * Always-visible wooden footbridges, one per authored river crossing. Lives
 * inside Planet like GlobalDressing (not chapter-gated) so the girl always has
 * a deck to cross when the planet turns a crossing under her feet.
 */
export function Bridges() {
  return (
    <>
      {RIVER_CROSSINGS.map((theta) => (
        <PropAnchor key={theta} theta={theta} x={0}>
          <ClayBridge rise={DECK_RISE} />
        </PropAnchor>
      ))}
    </>
  )
}
