import { experiences } from '@/data/experience'
import { PALETTE } from './palette'

export const CHAPTER_COUNT = 6

export type Chapter = {
  id: string
  company: string
  role: string
  period: string
  location: string
  description: string
  highlights: string[]
  technologies: string[]
  /** One-line staging direction for the chapter's planet region */
  theme: string
  accent: string
}

type ChapterStaging = { theme: string; accent: string }

/** Per-chapter staging: theme + accent, keyed by experience id. */
const STAGING = {
  bluenet: { theme: 'First shoots of spring — seedlings and a small clay hotel with a reception bell', accent: PALETTE.sprout },
  flyerbee: { theme: 'Beehive and fat clay bees over pink flowers along a winding delivery path', accent: PALETTE.honey },
  '360dialog': { theme: 'A wide blue river delta with message-pebble stepping stones and carrier birds', accent: PALETTE.river },
  accenture: { theme: 'Golden dunes rising from the green, a palm, a geometric bank facade', accent: PALETTE.dune },
  akna: { theme: 'A clay market street of stacked component-block buildings in pink tuff', accent: PALETTE.tuff },
  xdatagroup: { theme: 'Blossom summit at present day — pink trees in bloom, a vault door in the hillside', accent: PALETTE.blossomDeep },
} satisfies Record<string, ChapterStaging>

/** The journey runs the career chronologically: oldest experience first. */
export const chapters: Chapter[] = [...experiences].reverse().map((e) => ({
  id: e.id,
  company: e.company,
  role: e.role,
  period: e.period,
  location: e.location,
  description: e.description,
  highlights: e.highlights,
  technologies: e.technologies,
  ...STAGING[e.id as keyof typeof STAGING],
}))
