/**
 * Clickable scene hotspots and the panel content they open. Pure data +
 * lookups — no three.js, no React.
 */

import type { AngleId, PanelId } from './cameras'

export type Hotspot = {
  id: string
  panel: Exclude<PanelId, null>
  label: string
  angles: AngleId[]
}

export const HOTSPOTS: Hotspot[] = [
  { id: 'crt', panel: 'menu', label: 'the monitor — menu', angles: ['desk', 'room'] },
  { id: 'memcards', panel: 'projects', label: 'the memory cards — projects', angles: ['shelf', 'room'] },
  { id: 'posters', panel: 'skills', label: 'the posters — skills', angles: ['room', 'desk'] },
  { id: 'pager', panel: 'contact', label: 'the pager — contact', angles: ['desk'] },
  { id: 'gameboxes', panel: 'labs', label: 'the game boxes — labs', angles: ['shelf'] },
  { id: 'tv', panel: 'about', label: 'the tv — about', angles: ['tv', 'room'] },
]

export function hotspotById(id: string): Hotspot | undefined {
  return HOTSPOTS.find((h) => h.id === id)
}

export function hotspotsForAngle(angle: AngleId): Hotspot[] {
  return HOTSPOTS.filter((h) => h.angles.includes(angle))
}
