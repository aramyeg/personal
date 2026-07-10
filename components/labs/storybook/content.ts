import { experiences } from '@/data'
import type { Experience } from '@/types'
import type { LayerGeom } from '@/components/labs/storybook/book/popup-mechanics'

export type LayerKind = 'backdrop' | 'midground' | 'hero' | 'foreground'

/** Every pop-up piece is a real paper mechanism glued to BOTH pages of its
 *  spread and posed purely by the spread's dihedral angle (see
 *  book/popup-mechanics.ts and the physics benchmark spec). A layer's
 *  geometry fields ARE its die-cut. Three mechanism families give each
 *  spread its own construction:
 *   - 'vfold': the spherical four-bar wall/centerpiece; optionally skewed
 *     (asymmetric glue angles — the piece leans) and with an off-center
 *     crease (creaseU — the peak sits off-middle).
 *   - 'parallel': a strip creased parallel to the spine (planar four-bar) —
 *     tents, awnings, counters.
 *   - 'child': a small v-fold riding a parent's central crease (Glassner
 *     "generations") — ravens on rookery folds, coins spilling off a
 *     dragon. Driven by the parent's own panel dihedral, so one page turn
 *     moves the whole cascade.
 *  Constraints enforced by tests: pieces stand when open, fold exactly
 *  flat when closed, stay inside the closed page ("nothing sticks out"),
 *  never tear or jam, and children keep their glue on the parent's paper.
 */
export type SceneLayer = { id: string; kind: LayerKind } & LayerGeom

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

// VARIATION PHASE: every chapter gets a bespoke construction — different
// mechanism mixes, layer counts, sizes, asymmetry, and storytelling
// micro-pieces — instead of one uniform four-wall template. Parameter
// regimes (kinematics research + containment analysis, benchmark spec):
// reader-facing walls take phi near 90 with rho a few degrees above; the
// standing margin rho - phi caps wall skew at |skew| < (rho - phi) / 2
// before a panel stops standing, so walls get their asymmetry mostly from
// off-center creases (creaseU) while the deeper-V heroes (rho - phi ~ 25)
// can lean with real skew. Children ride a parent crease and inherit its
// motion; parallel strips crease along the spine. Every set below passes
// the full Part-A invariant suite (flat fold, containment, no tearing,
// separation) — sizes were chosen against those bounds.

// Chapter I — stone city beneath a sleeping mountain; the inn, its hanging
// key-sign swinging off the inn's own fold, a low field wall up front.
const CH1_LAYERS: readonly SceneLayer[] = [
  { id: 'ch1-backdrop', kind: 'backdrop', mech: 'vfold', apexZ: -0.42, vDir: -1, phiDeg: 84, rhoDeg: 88, skewDeg: -1.5, creaseU: 0.42, width: 1.6, height: 0.88 },
  { id: 'ch1-inn', kind: 'hero', mech: 'vfold', apexZ: 0.02, vDir: 1, phiDeg: 56, rhoDeg: 81, skewDeg: 3, creaseU: 0.55, width: 0.82, height: 0.5 },
  { id: 'ch1-sign', kind: 'hero', mech: 'child', parentId: 'ch1-inn', mount: 0.34, vDir: 1, phiDeg: 62, rhoDeg: 84, width: 0.22, height: 0.16 },
  { id: 'ch1-wall', kind: 'foreground', mech: 'vfold', apexZ: 0.42, vDir: 1, phiDeg: 84, rhoDeg: 88, width: 1.25, height: 0.26 },
]

// Chapter II — airy alpine spread, no foreground fringe: one big leaning
// ridge with two bees popping off its fold, and the courier balloon hero.
const CH2_LAYERS: readonly SceneLayer[] = [
  { id: 'ch2-backdrop', kind: 'backdrop', mech: 'vfold', apexZ: -0.45, vDir: -1, phiDeg: 84, rhoDeg: 88.5, skewDeg: 1.5, creaseU: 0.6, width: 1.65, height: 0.72 },
  { id: 'ch2-bee-a', kind: 'hero', mech: 'child', parentId: 'ch2-backdrop', mount: 0.48, vDir: 1, phiDeg: 60, rhoDeg: 83, width: 0.2, height: 0.17 },
  { id: 'ch2-bee-b', kind: 'hero', mech: 'child', parentId: 'ch2-backdrop', mount: 0.22, vDir: -1, phiDeg: 64, rhoDeg: 85, width: 0.15, height: 0.12 },
  { id: 'ch2-hero', kind: 'hero', mech: 'vfold', apexZ: 0.1, vDir: 1, phiDeg: 50, rhoDeg: 78, skewDeg: -4, creaseU: 0.45, width: 0.88, height: 0.58 },
]

// Chapter III — the rookery: two ranks of towers (no hero centerpiece —
// the citadel IS the scene), ravens riding both folds, and a low dispatch
// counter creased parallel to the spine.
const CH3_LAYERS: readonly SceneLayer[] = [
  { id: 'ch3-towers', kind: 'backdrop', mech: 'vfold', apexZ: -0.38, vDir: -1, phiDeg: 84, rhoDeg: 88, skewDeg: 1.5, creaseU: 0.34, width: 1.5, height: 1.0 },
  { id: 'ch3-raven-a', kind: 'hero', mech: 'child', parentId: 'ch3-towers', mount: 0.72, vDir: 1, phiDeg: 62, rhoDeg: 84, width: 0.2, height: 0.15 },
  { id: 'ch3-rank', kind: 'midground', mech: 'vfold', apexZ: -0.06, vDir: -1, phiDeg: 84, rhoDeg: 88.5, skewDeg: -1.5, creaseU: 0.64, width: 1.3, height: 0.6 },
  { id: 'ch3-raven-b', kind: 'hero', mech: 'child', parentId: 'ch3-rank', mount: 0.38, vDir: -1, phiDeg: 66, rhoDeg: 86, width: 0.16, height: 0.12 },
  // kind 'backdrop' picks the solid placeholder painter — a tent's faces
  // are full printed paper, not a fringe silhouette
  { id: 'ch3-counter', kind: 'backdrop', mech: 'parallel', glueL: 0.34, glueR: 0.42, rise: 0.12, z0: 0.3, z1: 0.62 },
]

// Chapter IV (the Batch-1 real-art spread, the physics-benchmark subject):
// the four painted pieces keep their exact benchmark geometry — sizes
// re-derived from the trimmed art's true aspect ratios (backdrop 1499x584,
// midground 1465x363, hero 949x741, foreground 1422x280) so every panel
// displays its print undistorted. One storytelling child joins them:
// coins spilling off the dragon's own fold (placeholder art until Batch-2).
const CH4_LAYERS: readonly SceneLayer[] = [
  { id: 'ch4-backdrop', kind: 'backdrop', mech: 'vfold', apexZ: -0.4, vDir: -1, phiDeg: 84, rhoDeg: 88, width: 1.9, height: 0.74 },
  { id: 'ch4-midground', kind: 'midground', mech: 'vfold', apexZ: -0.05, vDir: -1, phiDeg: 84, rhoDeg: 88.5, width: 2.0, height: 0.495 },
  { id: 'ch4-hero', kind: 'hero', mech: 'vfold', apexZ: 0.06, vDir: 1, phiDeg: 52, rhoDeg: 80, width: 0.794, height: 0.62 },
  { id: 'ch4-coins', kind: 'hero', mech: 'child', parentId: 'ch4-hero', mount: 0.22, vDir: -1, phiDeg: 60, rhoDeg: 83, width: 0.24, height: 0.16 },
  { id: 'ch4-foreground', kind: 'foreground', mech: 'vfold', apexZ: 0.44, vDir: 1, phiDeg: 84, rhoDeg: 88, width: 1.5, height: 0.295 },
]

// Chapter V — the bazaar: rose-stone skyline, the master-pattern archway
// with a lantern hung on its fold, and a market awning tented over the
// gutter (parallel fold — its ridge runs along the spine).
const CH5_LAYERS: readonly SceneLayer[] = [
  { id: 'ch5-city', kind: 'backdrop', mech: 'vfold', apexZ: -0.44, vDir: -1, phiDeg: 84, rhoDeg: 88, skewDeg: -1.2, creaseU: 0.58, width: 1.7, height: 0.66 },
  { id: 'ch5-arch', kind: 'hero', mech: 'vfold', apexZ: -0.06, vDir: 1, phiDeg: 54, rhoDeg: 81, width: 0.78, height: 0.5 },
  { id: 'ch5-lantern', kind: 'hero', mech: 'child', parentId: 'ch5-arch', mount: 0.3, vDir: 1, phiDeg: 62, rhoDeg: 84, width: 0.18, height: 0.14 },
  { id: 'ch5-awning', kind: 'backdrop', mech: 'parallel', glueL: 0.46, glueR: 0.46, rise: 0.18, z0: 0.26, z1: 0.6 },
]

// Chapter VI — the crescendo: pine treeline, the largest hero of the book
// (the glass treasury, leaning with real skew), its raised banner, and a
// low pine fringe.
const CH6_LAYERS: readonly SceneLayer[] = [
  { id: 'ch6-pines', kind: 'backdrop', mech: 'vfold', apexZ: -0.42, vDir: -1, phiDeg: 84, rhoDeg: 88, skewDeg: 1.4, creaseU: 0.44, width: 1.7, height: 0.76 },
  { id: 'ch6-treasury', kind: 'hero', mech: 'vfold', apexZ: 0.04, vDir: 1, phiDeg: 48, rhoDeg: 76, skewDeg: -3, creaseU: 0.47, width: 0.95, height: 0.65 },
  { id: 'ch6-banner', kind: 'hero', mech: 'child', parentId: 'ch6-treasury', mount: 0.5, vDir: 1, phiDeg: 60, rhoDeg: 83, width: 0.26, height: 0.2 },
  { id: 'ch6-fringe', kind: 'foreground', mech: 'vfold', apexZ: 0.44, vDir: 1, phiDeg: 84, rhoDeg: 88, width: 1.3, height: 0.28 },
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
    layers: CH1_LAYERS,
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
    layers: CH2_LAYERS,
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
    layers: CH3_LAYERS,
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
    layers: CH5_LAYERS,
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
    layers: CH6_LAYERS,
  },
]

// Pop-up layers for the three spreads that aren't a career chapter: the
// title page (spread 1) and the closing satchel/end pages (8, 9) — hand-
// tuned one-off decorative sets, since there's no career experience to
// derive them from. The end spread gets its raven as a child riding the
// letter's fold — the raven the closing line asks the reader to send.
export const TITLE_LAYERS: readonly SceneLayer[] = [
  { id: 'title-border', kind: 'backdrop', mech: 'vfold', apexZ: -0.25, vDir: -1, phiDeg: 84, rhoDeg: 88, width: 1.3, height: 0.5 },
  { id: 'title-hero', kind: 'hero', mech: 'vfold', apexZ: 0.15, vDir: 1, phiDeg: 52, rhoDeg: 80, width: 0.7, height: 0.45 },
]
const TITLE_ACCENTS: readonly string[] = ['#c9a227', '#6a8f5f']

const SATCHEL_LAYERS: readonly SceneLayer[] = [
  { id: 'satchel-bag', kind: 'hero', mech: 'vfold', apexZ: -0.1, vDir: 1, phiDeg: 52, rhoDeg: 80, width: 0.9, height: 0.6 },
]
const SATCHEL_ACCENTS: readonly string[] = ['#c9a227', '#8a5a3b'] // gold + leather

const END_LAYERS: readonly SceneLayer[] = [
  { id: 'end-letter', kind: 'hero', mech: 'vfold', apexZ: -0.15, vDir: 1, phiDeg: 52, rhoDeg: 80, width: 0.75, height: 0.5 },
  { id: 'end-raven', kind: 'hero', mech: 'child', parentId: 'end-letter', mount: 0.28, vDir: 1, phiDeg: 62, rhoDeg: 84, width: 0.2, height: 0.15 },
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
