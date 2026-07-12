/**
 * Save file model — the memory card's "load game" screen is literally a
 * save-select list. Real portfolio projects become save slots '01'..'03',
 * followed by three fixed system slots ('system data' / 'written with' /
 * 'save?') that round the rail out to six. Pure data mapping — no React, no
 * canvas — so the screen UI and the icon generator can both consume it
 * without importing each other.
 */
import { accentFor } from '../tokens'
import { FIT_COUNT } from '../three/character'
import type { ExtendedProject } from '@/data/projects'

export type SaveKind = 'project' | 'bio' | 'stack' | 'contact'

export type SaveSlot = {
  slot: string
  kind: SaveKind
  label: string
  sub: string
  blocks: number
  accent: string
  /** 1-based fit number (matches the slot position) — the character GLB this
   *  save re-dresses the figure into on select. See three/character.ts#fitSrc. */
  fit: number
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

/** 1-based fit number for a 0-based slot position, cycling within the fits that
 *  actually exist on disk — mirrors the accent cycle so an extra save never asks
 *  for a missing char-fit GLB (which would throw the figure loader sticky). */
function fitFor(position: number): number {
  return (position % FIT_COUNT) + 1
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
    fit: fitFor(i),
    project,
  }))

  const systemSlots: SaveSlot[] = SYSTEM_SLOTS.map((system, i) => ({
    slot: String(projects.length + i + 1).padStart(2, '0'),
    kind: system.kind,
    label: system.label,
    sub: system.sub,
    blocks: 0,
    accent: accentFor(projects.length + i),
    fit: fitFor(projects.length + i),
  }))

  return [...projectSlots, ...systemSlots]
}

/** Sum of every slot's block count — how much of CARD_BLOCKS_TOTAL is "used". */
export function blocksUsed(saves: SaveSlot[]): number {
  return saves.reduce((total, save) => total + save.blocks, 0)
}

/**
 * System slots carry lowercase copy in `label` (lab mono voice); this is their
 * display TITLE in true casing for the big screen title and the slot rows.
 * Casing law: titles never render CSS-uppercased, so the correct human casing
 * lives in the data, not a transform. Projects render their title verbatim so
 * product names ("iBank") survive intact.
 */
const SYSTEM_TITLE: Record<Exclude<SaveKind, 'project'>, string> = {
  bio: 'System Data',
  stack: 'Written With',
  contact: 'Save?',
}

/** The active save's on-screen title, in its true casing. */
export function saveTitle(save: SaveSlot): string {
  return save.kind === 'project' ? save.label : SYSTEM_TITLE[save.kind]
}
