import { experiences } from '@/data'
import type { Experience } from '@/types'

export type LayerKind = 'backdrop' | 'midground' | 'hero' | 'foreground'

/** Every pop-up piece is a symmetric V-FOLD — a real paper mechanism glued
 *  to BOTH pages of its spread and posed purely by the spread's dihedral
 *  angle (see book/popup-mechanics.ts and the physics benchmark spec).
 *  These fields ARE the die-cut: apex position on the spine, glue-line
 *  angle phi, panel corner angle rho, V direction, and art size. Walls that
 *  face the reader use phi near 90 deg (glue lines nearly perpendicular to
 *  the spine); the hero centerpiece uses a deeper V. Constraints enforced
 *  by tests: rho > phi (stands when open), |cos rho| <= cos phi (linkage
 *  reachable at every angle), and the folded piece must fit inside the
 *  closed page ("nothing sticks out").
 */
export type SceneLayer = {
  id: string
  kind: LayerKind
  /** Apex position along the spine (world z, + toward the camera). */
  apexZ: number
  /** Which way along the spine the V opens: +1 toward the camera, -1 away.
   *  The piece folds flat in the OPPOSITE direction when the book closes. */
  vDir: 1 | -1
  /** Glue-line angle from the gutter, degrees. */
  phiDeg: number
  /** Panel corner angle (glue crease to central crease), degrees. */
  rhoDeg: number
  /** Full art width across both halves (world units). */
  width: number
  /** Art height along the central crease (world units). */
  height: number
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

// Title/satchel/end page copy — verbatim from spec §4, kept alongside the
// chapter narration so every scrap of the tale's prose lives in one file.
export const TITLE_OPENING_LINE =
  'Once upon a time — which is to say, in the year two thousand and sixteen —'
export const SATCHEL_HEADING = 'The Hero’s Satchel'
export const SATCHEL_INTRO =
  'No knight sets out unarmed. Herein, the satchel, unpacked for the curious.'
export const END_CLOSING_LINE =
  'Here ends — for now — the Tale of Six Kingdoms. Should you have need of the hero — a kingdom to raise, a dragon to gentle — send a raven.'

// Physics rework: every layer is a v-fold die-cut. Parameter regimes (from
// the kinematics research + containment analysis in the benchmark spec):
// walls that must face the reader take phi near 90 (glue lines nearly
// perpendicular to the spine) with rho a few degrees above phi — they stand
// tall with an authentic lean and fold flat ALONG the spine (vDir chooses
// which way, picked so the folded piece stays on the page). The hero takes
// a deeper V (phi ~52) for a pronounced 3-D centerpiece. rho - phi sets the
// lean AND the late-bloom snap: smaller gap = sharper bloom near flat-open.
const layerDefaults = (ch: number): SceneLayer[] => [
  { id: `ch${ch}-backdrop`, kind: 'backdrop', apexZ: -0.4, vDir: -1, phiDeg: 84, rhoDeg: 88, width: 1.5, height: 0.95 },
  { id: `ch${ch}-midground`, kind: 'midground', apexZ: -0.05, vDir: -1, phiDeg: 84, rhoDeg: 88.5, width: 1.9, height: 0.55 },
  { id: `ch${ch}-hero`, kind: 'hero', apexZ: 0.06, vDir: 1, phiDeg: 52, rhoDeg: 80, width: 1.0, height: 0.55 },
  { id: `ch${ch}-foreground`, kind: 'foreground', apexZ: 0.44, vDir: 1, phiDeg: 84, rhoDeg: 88, width: 1.5, height: 0.32 },
]

// Chapter IV (the Batch-1 real-art spread, the physics-benchmark subject):
// sizes re-derived from the trimmed art's true aspect ratios — backdrop
// 1536x1024 (1.5), midground 1465x363 (4.04), hero 949x741 (1.28),
// foreground 1422x280 (5.08) — so every panel displays its print
// undistorted. Widths chosen so the folded pieces pass the closed-book
// containment test (see popup-mechanics.test.ts).
const CH4_LAYERS: readonly SceneLayer[] = [
  { id: 'ch4-backdrop', kind: 'backdrop', apexZ: -0.4, vDir: -1, phiDeg: 84, rhoDeg: 88, width: 1.5, height: 1.0 },
  { id: 'ch4-midground', kind: 'midground', apexZ: -0.05, vDir: -1, phiDeg: 84, rhoDeg: 88.5, width: 2.0, height: 0.495 },
  { id: 'ch4-hero', kind: 'hero', apexZ: 0.06, vDir: 1, phiDeg: 52, rhoDeg: 80, width: 0.794, height: 0.62 },
  { id: 'ch4-foreground', kind: 'foreground', apexZ: 0.44, vDir: 1, phiDeg: 84, rhoDeg: 88, width: 1.5, height: 0.295 },
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
    layers: CH4_LAYERS,
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
  { id: 'title-border', kind: 'backdrop', apexZ: -0.25, vDir: -1, phiDeg: 84, rhoDeg: 88, width: 1.3, height: 0.5 },
  { id: 'title-hero', kind: 'hero', apexZ: 0.15, vDir: 1, phiDeg: 52, rhoDeg: 80, width: 0.7, height: 0.45 },
]
const TITLE_ACCENTS: readonly string[] = ['#c9a227', '#6a8f5f']

const SATCHEL_LAYERS: readonly SceneLayer[] = [
  { id: 'satchel-bag', kind: 'hero', apexZ: -0.1, vDir: 1, phiDeg: 52, rhoDeg: 80, width: 0.9, height: 0.6 },
]
const SATCHEL_ACCENTS: readonly string[] = ['#c9a227', '#8a5a3b'] // gold + leather

const END_LAYERS: readonly SceneLayer[] = [
  { id: 'end-letter', kind: 'hero', apexZ: -0.15, vDir: 1, phiDeg: 52, rhoDeg: 80, width: 0.75, height: 0.5 },
  { id: 'end-raven', kind: 'midground', apexZ: -0.45, vDir: -1, phiDeg: 84, rhoDeg: 88.5, width: 0.8, height: 0.55 },
]
const END_ACCENTS: readonly string[] = ['#641e26', '#5a6470'] // seal burgundy + slate

export const EXTRA_SPREAD_LAYERS: Readonly<Record<number, readonly SceneLayer[]>> = {
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
