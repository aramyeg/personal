import { experiences } from '@/data'
import type { Experience } from '@/types'

export type LayerKind = 'backdrop' | 'midground' | 'hero' | 'foreground'

export type SceneLayer = {
  id: string
  kind: LayerKind
  hingeZ: number
  height: number
  width: number
  standAngle: number
  offsetX?: number
}

export type Chapter = {
  spread: number
  experienceId: string
  numeral: string
  kicker: string
  title: string
  narration: string
  accents: readonly string[]
  layers: readonly SceneLayer[]
}

export const SPREAD_COUNT = 10
export const BOOK_TITLE = 'A Tale of Six Kingdoms'
export const BOOK_SUBTITLE = "being the true chronicle of one frontend engineer’s quest"

const layerDefaults = (ch: number): SceneLayer[] => [
  { id: `ch${ch}-backdrop`, kind: 'backdrop', hingeZ: -0.52, height: 1.05, width: 2.0, standAngle: 90 },
  { id: `ch${ch}-midground`, kind: 'midground', hingeZ: -0.18, height: 0.7, width: 1.9, standAngle: 78 },
  { id: `ch${ch}-hero`, kind: 'hero', hingeZ: 0.12, height: 0.62, width: 1.0, standAngle: 85 },
  { id: `ch${ch}-foreground`, kind: 'foreground', hingeZ: 0.48, height: 0.3, width: 2.1, standAngle: 65 },
]

export const CHAPTERS: readonly Chapter[] = [
  {
    spread: 2,
    experienceId: 'bluenet',
    numeral: 'I',
    kicker: 'Chapter the First',
    title: 'The Inn of a Hundred Keys',
    narration:
      "Once upon a time, in a stone-built city beneath a sleeping mountain, a young clerk of the merchant’s guild grew tired of selling things and resolved instead to make them. He apprenticed himself to the code-wrights of BlueNet, and his first great labor was an enchanted ledger for the Inn of a Hundred Keys — a book that knew every guest, every room, and every candle lit therein. And the innkeepers marveled, for nothing was ever lost again.",
    accents: ['#6a8f5f', '#b0603f', '#e8a978'],
    layers: layerDefaults(1),
  },
  {
    spread: 3,
    experienceId: 'flyerbee',
    numeral: 'II',
    kicker: 'Chapter the Second',
    title: 'The Carrier Swarm',
    narration:
      "Word of the apprentice’s craft crossed the mountains to the alpine city of Zürich, where the Guild of the Bee kept a thousand couriers aloft. ‘Build us a looking-glass,’ said the beekeepers, ‘that we may see every wing at once.’ So he built it from nothing at all — his first work made to be carried in a pocket — and from that day no parcel, however small, ever wandered from its path.",
    accents: ['#7d9bb5', '#8a5a3b', '#d9a441'],
    layers: layerDefaults(2),
  },
  {
    spread: 4,
    experienceId: '360dialog',
    numeral: 'III',
    kicker: 'Chapter the Third',
    title: 'The Rookery of Four Billion Ravens',
    narration:
      "In the grey citadel of Berlin stood a rookery of unusual size. Four billion ravens passed through its towers, each bearing a message, and fifty thousand merchant houses trusted them with their words. The hero — for so we may now call him — was set over the great dispatch boards, and he wrought them so well that the sky itself seemed orderly.",
    accents: ['#5a6470', '#2b2d33', '#6f5a7d', '#d98e3f'],
    layers: layerDefaults(3),
  },
  {
    spread: 5,
    experienceId: 'accenture',
    numeral: 'IV',
    kicker: 'Chapter the Fourth',
    title: 'The Vault-Dragon of the Golden Dunes',
    narration:
      "Then came a summons from the golden dunes, where a great bank kept a dragon of renown coiled about its treasure. None doubted the beast’s strength; the trouble was teaching it manners. The hero built passages of glass through which the people could reach their gold — safely, swiftly, and without waking so much as one scale — and he even taught the dragon to lease out carriages.",
    accents: ['#d9a24a', '#d96f4a', '#4f8f85', '#e6c65a'],
    layers: layerDefaults(4),
  },
  {
    spread: 6,
    experienceId: 'akna',
    numeral: 'V',
    kicker: 'Chapter the Fifth',
    title: 'The Bazaar of a Thousand Stalls',
    narration:
      "Homeward then, to the rose-stone city, where a bazaar of a thousand stalls was to be raised. The hero did not build the stalls. He did something cleverer: he carved master patterns from which any stall could be raised in a day, true and identical, by any pair of willing hands. Masons came from far away just to study the stones.",
    accents: ['#c4766a', '#a63d2f', '#e7d5a8'],
    layers: layerDefaults(5),
  },
  {
    spread: 7,
    experienceId: 'xdatagroup',
    numeral: 'VI',
    kicker: 'Chapter the Sixth',
    title: 'The Northern Treasury',
    narration:
      "And so at last the road bent north, to a kingdom of pine and long light, where a new treasury was rising — AMIO by name — with walls of glass, so the people might always see their gold. There the hero works to this day: raising vaults, drawing plans with the founders themselves, and teaching young apprentices the old craft. Whether he lives happily ever after is not yet written — the best chronicles never quite end.",
    accents: ['#2e5244', '#4fd6b8', '#8a6fd6', '#1d2a45'],
    layers: layerDefaults(6),
  },
]

// Pop-up layers for the three spreads that aren't a career chapter: the
// title page (spread 1) and the closing satchel/end pages (8, 9). Chapters
// get their four-layer set from `layerDefaults` above; these are hand-tuned
// one-off decorative sets instead, since there's no career experience to
// derive them from.
export const TITLE_LAYERS: readonly SceneLayer[] = [
  { id: 'title-border', kind: 'backdrop', hingeZ: -0.3, height: 0.5, width: 1.6, standAngle: 85 },
  { id: 'title-hero', kind: 'hero', hingeZ: 0.2, height: 0.45, width: 0.7, standAngle: 88 },
]
const TITLE_ACCENTS: readonly string[] = ['#c9a227', '#6a8f5f']

const SATCHEL_LAYERS: readonly SceneLayer[] = [
  { id: 'satchel-bag', kind: 'hero', hingeZ: -0.25, height: 0.6, width: 0.9, standAngle: 85 },
]
const SATCHEL_ACCENTS: readonly string[] = ['#c9a227', '#8a5a3b'] // gold + leather

const END_LAYERS: readonly SceneLayer[] = [
  { id: 'end-letter', kind: 'hero', hingeZ: -0.2, height: 0.5, width: 0.75, standAngle: 85 },
  { id: 'end-raven', kind: 'midground', hingeZ: -0.45, height: 0.55, width: 0.8, standAngle: 80 },
]
const END_ACCENTS: readonly string[] = ['#641e26', '#5a6470'] // seal burgundy + slate

export const EXTRA_SPREAD_LAYERS: Record<number, readonly SceneLayer[]> = {
  1: TITLE_LAYERS,
  8: SATCHEL_LAYERS,
  9: END_LAYERS,
}

const EXTRA_SPREAD_ACCENTS: Record<number, readonly string[]> = {
  1: TITLE_ACCENTS,
  8: SATCHEL_ACCENTS,
  9: END_ACCENTS,
}

export type PopupContent = { layers: readonly SceneLayer[]; accents: readonly string[] }

/** Resolves whatever pop-up content (if any) belongs to a spread: a career
 *  chapter's four layers, one of the decorative extra sets above, or
 *  `undefined` for the closed cover (spread 0). */
export const popupContentForSpread = (spread: number): PopupContent | undefined => {
  const chapter = chapterForSpread(spread)
  if (chapter) return { layers: chapter.layers, accents: chapter.accents }
  const layers = EXTRA_SPREAD_LAYERS[spread]
  const accents = EXTRA_SPREAD_ACCENTS[spread]
  if (!layers || !accents) return undefined
  return { layers, accents }
}

export const chapterForSpread = (spread: number): Chapter | undefined =>
  CHAPTERS.find((c) => c.spread === spread)

export const experienceFor = (ch: Chapter): Experience => {
  const exp = experiences.find((e) => e.id === ch.experienceId)
  if (!exp) throw new Error(`storybook: unknown experience id ${ch.experienceId}`)
  return exp
}
