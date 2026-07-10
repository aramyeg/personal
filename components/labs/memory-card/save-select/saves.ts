/**
 * Save file model — the memory card's "load game" screen is literally a
 * save-select list. Real portfolio projects become save slots '01'..'03',
 * followed by three fixed system slots ('system data' / 'written with' /
 * 'save?') that round the rail out to six. Pure data mapping — no React, no
 * canvas — so the screen UI and the icon generator can both consume it
 * without importing each other.
 */
import { accentFor } from '../tokens'
import type { ExtendedProject } from '@/data/projects'

export type SaveKind = 'project' | 'bio' | 'stack' | 'contact'

export type SaveSlot = {
  slot: string
  kind: SaveKind
  label: string
  sub: string
  blocks: number
  accent: string
  project?: ExtendedProject
}

/** Total ▮ capacity a physical PS1 memory card block meter would show. */
export const CARD_BLOCKS_TOTAL = 15

type SystemSlotCopy = { kind: Exclude<SaveKind, 'project'>; label: string; sub: string }

/** Fixed system slots that always trail the project saves, in this order. */
const SYSTEM_SLOTS: SystemSlotCopy[] = [
  { kind: 'bio', label: 'system data', sub: 'aram yeghiazaryan · senior frontend engineer' },
  { kind: 'stack', label: 'written with', sub: '7 entries · this page only' },
  { kind: 'contact', label: 'save?', sub: 'save your progress' },
]

/** `year · first two technologies`, lowercased for the mono stat line. */
function projectSub(project: ExtendedProject): string {
  const [first, second] = project.technologies
  return `${project.year} · ${first} · ${second}`.toLowerCase()
}

/** Projects (data order) as slots 01..N, then the three fixed system slots. */
export function buildSaves(projects: ExtendedProject[]): SaveSlot[] {
  const projectSlots: SaveSlot[] = projects.map((project, i) => ({
    slot: String(i + 1).padStart(2, '0'),
    kind: 'project',
    label: project.title,
    sub: projectSub(project),
    blocks: project.metrics?.length ?? 0,
    accent: accentFor(i),
    project,
  }))

  const systemSlots: SaveSlot[] = SYSTEM_SLOTS.map((system, i) => ({
    slot: String(projects.length + i + 1).padStart(2, '0'),
    kind: system.kind,
    label: system.label,
    sub: system.sub,
    blocks: 0,
    accent: accentFor(projects.length + i),
  }))

  return [...projectSlots, ...systemSlots]
}

/** Sum of every slot's block count — how much of CARD_BLOCKS_TOTAL is "used". */
export function blocksUsed(saves: SaveSlot[]): number {
  return saves.reduce((total, save) => total + save.blocks, 0)
}
