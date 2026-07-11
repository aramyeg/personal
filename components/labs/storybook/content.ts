import { experiences } from '@/data'
import type { Experience } from '@/types'
import type { LayerGeom } from '@/components/labs/storybook/book/popup-mechanics'

export type LayerKind = 'backdrop' | 'midground' | 'hero' | 'foreground'

/** Composition role — the volumetric covenant (benchmark spec 2026-07-11):
 *  a flat single-fold sheet needs a reason to exist.
 *   - 'backdrop': the big scenic sheet near the spine. Flat allowed.
 *   - 'scenery': mid-page scene-setting planes and rider props. Flat
 *     allowed, sparingly.
 *   - 'figure': character/creature standees — flat cutouts at scene depth
 *     are AUTHENTIC pop-up vocabulary for figures.
 *   - 'story': buildings, furniture, props that carry the scene's physical
 *     world. MUST be volumetric ('box') — enforced by the composition-
 *     covenant test, with a shrinking allowlist for pieces awaiting
 *     multi-face art. */
export type LayerRole = 'backdrop' | 'scenery' | 'figure' | 'story'

/** Every pop-up piece is a real paper mechanism glued to BOTH pages of its
 *  spread and posed purely by the spread's dihedral angle (see
 *  book/popup-mechanics.ts and the physics benchmark spec). A layer's
 *  geometry fields ARE its die-cut. Four mechanism families give each
 *  spread its own construction:
 *   - 'vfold': the spherical four-bar wall/centerpiece; optionally skewed
 *     (asymmetric glue angles — the piece leans) and with an off-center
 *     crease (creaseU — the peak sits off-middle).
 *   - 'parallel': a strip creased parallel to the spine (planar four-bar).
 *     DEMOTED by the volumetric benchmark: its faces only ever look
 *     left/right, so nothing that needs a camera-facing face may use it.
 *   - 'child': a small v-fold riding a parent's central crease (Glassner
 *     "generations") — ravens on rookery folds, coins spilling off a
 *     dragon. Driven by the parent's own panel dihedral, so one page turn
 *     moves the whole cascade.
 *   - 'box': the volumetric mechanism — an enclosed paper prism straddling
 *     the gutter with camera-facing caps, painted side walls, and a flat
 *     lid, gabled roof, or open hollow top. Counters, barns, stalls,
 *     chests. Per-face art: `<id>-front/-back/-side/-top`.
 *  Constraints enforced by tests: pieces stand when open, fold exactly
 *  flat when closed, stay inside the closed page ("nothing sticks out"),
 *  never tear or jam, and children keep their glue on the parent's paper.
 */
export type SceneLayer = { id: string; kind: LayerKind; role: LayerRole } & LayerGeom

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
// micro-pieces — instead of one uniform four-wall template. RICHER-
// STRUCTURE PHASE on top of it: compound scenes assembled from several
// pieces (a parent fold carrying two children at different heights reads
// as one multi-story building; paired asymmetric tents read as a row of
// stalls), and the chapter centerpieces grew. Parameter
// regimes (kinematics research + containment analysis, benchmark spec):
// reader-facing walls take phi near 90 with rho a few degrees above; the
// standing margin rho - phi caps wall skew at |skew| < (rho - phi) / 2
// before a panel stops standing, so walls get their asymmetry mostly from
// off-center creases (creaseU) while the deeper-V heroes (rho - phi ~ 25)
// can lean with real skew. Children ride a parent crease and inherit its
// motion; parallel strips crease along the spine. Every set below passes
// the full Part-A invariant suite (flat fold, containment, no tearing,
// separation) — sizes were chosen against those bounds.

// Chapter I — stone city beneath a sleeping mountain. RICHER-STRUCTURE
// PHASE: the inn is now a compound two-story coaching inn — one bigger
// parent wall carrying TWO children (the hanging key-sign low on the fold,
// an attic dormer above it — the stories of the building are literally
// stories of the fold), the stable tented in the yard IN FRONT of it
// (asymmetric parallel, ridge toward the left page — pieces placed behind
// a taller mid-page piece are invisible from the reading camera), and the
// low field wall pushed to the very front edge. Four depth planes plus a
// cascade — the densest chapter open.
const CH1_LAYERS: readonly SceneLayer[] = [
  { id: 'ch1-backdrop', kind: 'backdrop', role: 'backdrop', mech: 'vfold', apexZ: -0.42, vDir: -1, phiDeg: 84, rhoDeg: 88, skewDeg: -1.5, creaseU: 0.42, width: 1.6, height: 0.85 },
  { id: 'ch1-inn', kind: 'hero', role: 'story', mech: 'vfold', apexZ: -0.02, vDir: 1, phiDeg: 56, rhoDeg: 81, skewDeg: 3, creaseU: 0.55, width: 0.72, height: 0.7 },
  { id: 'ch1-dormer', kind: 'midground', role: 'scenery', mech: 'child', parentId: 'ch1-inn', mount: 0.62, vDir: 1, phiDeg: 64, rhoDeg: 85, width: 0.16, height: 0.15 },
  { id: 'ch1-sign', kind: 'hero', role: 'scenery', mech: 'vfold', apexZ: 0.2, vDir: 1, phiDeg: 58, rhoDeg: 82, width: 0.2, height: 0.26 },
  // VOLUMETRIC: the stable is a gabled box barn in the yard — pitched roof
  // pair on a floating ridge, camera-facing gable front, painted sides.
  // Boxes straddle the spine by construction, so it is sized DOWN and kept
  // forward: dead center in front of the inn, it must not swallow the
  // inn's painted ground story (capture review 2026-07-11).
  // ...and pushed forward to the gate (z 0.42-0.58): the camera looks down
  // the spine, so screen separation between spine-stacked pieces comes
  // from z-depth — at the wall the barn clears the signpost's sight-line.
  { id: 'ch1-stable', kind: 'backdrop', role: 'story', mech: 'box', a: 0.13, height: 0.16, z0: 0.42, z1: 0.58, roof: 'gable', gableRise: 0.08 },
  { id: 'ch1-wall', kind: 'foreground', role: 'scenery', mech: 'vfold', apexZ: 0.6, vDir: 1, phiDeg: 84, rhoDeg: 88, width: 1.25, height: 0.2 },
]

// Chapter II — airy alpine spread, no foreground fringe: one big leaning
// ridge with two bees popping off its fold, the courier balloon hero with
// a third bee circling it. Deliberately the SPARSEST chapter — density
// contrast is part of the variation.
const CH2_LAYERS: readonly SceneLayer[] = [
  { id: 'ch2-backdrop', kind: 'backdrop', role: 'backdrop', mech: 'vfold', apexZ: -0.45, vDir: -1, phiDeg: 84, rhoDeg: 88.5, skewDeg: 1.5, creaseU: 0.6, width: 1.65, height: 0.94 },
  { id: 'ch2-bee-a', kind: 'hero', role: 'figure', mech: 'child', parentId: 'ch2-backdrop', mount: 0.48, vDir: 1, phiDeg: 60, rhoDeg: 83, width: 0.22, height: 0.117 },
  { id: 'ch2-bee-b', kind: 'hero', role: 'figure', mech: 'child', parentId: 'ch2-backdrop', mount: 0.22, vDir: -1, phiDeg: 64, rhoDeg: 85, width: 0.16, height: 0.089 },
  { id: 'ch2-hero', kind: 'hero', role: 'figure', mech: 'vfold', apexZ: 0.1, vDir: 1, phiDeg: 50, rhoDeg: 82, skewDeg: -2, creaseU: 0.45, width: 0.51, height: 0.89 },
  { id: 'ch2-bee-c', kind: 'hero', role: 'figure', mech: 'child', parentId: 'ch2-hero', mount: 0.4, vDir: 1, phiDeg: 64, rhoDeg: 85, width: 0.15, height: 0.069 },
  // VOLUMETRIC: the guild's hive — a small lidded box in the meadow (real
  // beehives ARE stacked boxes); keeps the chapter airy but gives it its
  // enclosed volume and a third fold family.
  { id: 'ch2-hive', kind: 'backdrop', role: 'story', mech: 'box', a: 0.09, height: 0.14, z0: 0.34, z1: 0.46, roof: 'flat' },
]

// Chapter III — the rookery: the great tower now carries a dispatch
// BALCONY jutting off its fold at mid-height with a raven perched above it
// (one compound multi-story piece), a second rank of towers with its own
// raven, and the dispatch counter tented off-center toward the right page.
const CH3_LAYERS: readonly SceneLayer[] = [
  { id: 'ch3-towers', kind: 'backdrop', role: 'backdrop', mech: 'vfold', apexZ: -0.38, vDir: -1, phiDeg: 84, rhoDeg: 88, skewDeg: 1.5, creaseU: 0.34, width: 1.5, height: 0.84 },
  // deeper V than the ravens so it juts clear of the facade; the scalloped
  // 'foreground' painter reads as its railing until real art lands
  { id: 'ch3-balcony', kind: 'foreground', role: 'scenery', mech: 'child', parentId: 'ch3-towers', mount: 0.44, vDir: 1, phiDeg: 52, rhoDeg: 78, width: 0.3, height: 0.36 },
  { id: 'ch3-raven-a', kind: 'hero', role: 'figure', mech: 'child', parentId: 'ch3-towers', mount: 0.76, vDir: 1, phiDeg: 62, rhoDeg: 84, width: 0.2, height: 0.113 },
  { id: 'ch3-rank', kind: 'midground', role: 'backdrop', mech: 'vfold', apexZ: -0.06, vDir: -1, phiDeg: 84, rhoDeg: 88.5, skewDeg: -1.5, creaseU: 0.64, width: 1.3, height: 0.67 },
  { id: 'ch3-raven-b', kind: 'hero', role: 'figure', mech: 'child', parentId: 'ch3-rank', mount: 0.34, vDir: 1, phiDeg: 66, rhoDeg: 86, width: 0.11, height: 0.245 },
  // VOLUMETRIC: the dispatch counter is a lidded flat-top box — a real
  // desk with a painted writing top and a camera-facing front.
  { id: 'ch3-counter', kind: 'backdrop', role: 'story', mech: 'box', a: 0.16, height: 0.2, z0: 0.26, z1: 0.58, roof: 'flat' },
]

// Chapter IV (the Batch-1 real-art spread, the physics-benchmark subject):
// the four painted pieces keep their exact benchmark geometry — sizes
// re-derived from the trimmed art's true aspect ratios (backdrop 1499x584,
// midground 1465x363, hero 949x741, foreground 1422x280) so every panel
// displays its print undistorted. One storytelling child joins them:
// coins spilling off the dragon's own fold (placeholder art until Batch-2).
const CH4_LAYERS: readonly SceneLayer[] = [
  { id: 'ch4-backdrop', kind: 'backdrop', role: 'backdrop', mech: 'vfold', apexZ: -0.4, vDir: -1, phiDeg: 84, rhoDeg: 88, width: 1.9, height: 0.74 },
  { id: 'ch4-midground', kind: 'midground', role: 'backdrop', mech: 'vfold', apexZ: -0.05, vDir: -1, phiDeg: 84, rhoDeg: 88.5, width: 2.0, height: 0.495 },
  { id: 'ch4-hero', kind: 'hero', role: 'figure', mech: 'vfold', apexZ: 0.06, vDir: 1, phiDeg: 52, rhoDeg: 80, width: 0.794, height: 0.62 },
  { id: 'ch4-coins', kind: 'hero', role: 'scenery', mech: 'child', parentId: 'ch4-hero', mount: 0.22, vDir: -1, phiDeg: 60, rhoDeg: 83, width: 0.24, height: 0.24 },
  // VOLUMETRIC: an open treasure chest in front of the dragon — the
  // book's HOLLOW box (open top, no backbone): the reading camera looks
  // straight down into a raw-paper interior (benchmark B16).
  { id: 'ch4-chest', kind: 'backdrop', role: 'story', mech: 'box', a: 0.12, height: 0.12, z0: 0.3, z1: 0.42, roof: 'open' },
  { id: 'ch4-foreground', kind: 'foreground', role: 'scenery', mech: 'vfold', apexZ: 0.44, vDir: 1, phiDeg: 84, rhoDeg: 88, width: 1.5, height: 0.295 },
]

// Chapter V — the bazaar: rose-stone skyline, then a ROW of identical
// stall fronts flanking the archway (the "master patterns" story told as
// repetition — its wide flanks stay visible past the arch), the archway
// strung with TWO lanterns (children at different heights on one fold),
// and the market awning tented out front, ridge toward the right page and
// sized so the arch shows over it.
const CH5_LAYERS: readonly SceneLayer[] = [
  { id: 'ch5-city', kind: 'backdrop', role: 'backdrop', mech: 'vfold', apexZ: -0.44, vDir: -1, phiDeg: 84, rhoDeg: 88, skewDeg: -1.2, creaseU: 0.58, width: 1.7, height: 0.72 },
  { id: 'ch5-stalls', kind: 'midground', role: 'scenery', mech: 'vfold', apexZ: -0.24, vDir: -1, phiDeg: 84, rhoDeg: 88, skewDeg: 1.2, creaseU: 0.62, width: 1.15, height: 0.3 },
  { id: 'ch5-arch', kind: 'hero', role: 'story', mech: 'vfold', apexZ: -0.06, vDir: 1, phiDeg: 54, rhoDeg: 81, width: 0.8, height: 0.8 },
  { id: 'ch5-lantern', kind: 'hero', role: 'scenery', mech: 'child', parentId: 'ch5-arch', mount: 0.54, vDir: 1, phiDeg: 62, rhoDeg: 84, width: 0.15, height: 0.26 },
  { id: 'ch5-lantern-b', kind: 'hero', role: 'scenery', mech: 'child', parentId: 'ch5-arch', mount: 0.66, vDir: 1, phiDeg: 64, rhoDeg: 85, width: 0.09, height: 0.252 },
  // VOLUMETRIC: the awning tent is reimagined as a gabled market stall —
  // a boxed stall with a pitched canopy roof and a camera-facing front
  // (the tent "did not translate the idea"; this is the reply). Sized so
  // the arch's painted opening and the hero walking through it stay clear
  // above it (capture review 2026-07-11).
  { id: 'ch5-stall', kind: 'backdrop', role: 'story', mech: 'box', a: 0.12, height: 0.15, z0: 0.36, z1: 0.58, roof: 'gable', gableRise: 0.075 },
]

// Chapter VI — the crescendo: pine treeline and the book's LARGEST hero —
// the glass treasury grown to a true multi-story compound: vault door low
// on the fold (ground story), banner raised high (top story), the whole
// piece leaning with real skew. Low pine fringe up front.
const CH6_LAYERS: readonly SceneLayer[] = [
  { id: 'ch6-pines', kind: 'backdrop', role: 'backdrop', mech: 'vfold', apexZ: -0.42, vDir: -1, phiDeg: 84, rhoDeg: 88, skewDeg: 1.4, creaseU: 0.44, width: 1.7, height: 0.69 },
  { id: 'ch6-treasury', kind: 'hero', role: 'story', mech: 'vfold', apexZ: 0.04, vDir: 1, phiDeg: 54, rhoDeg: 80, skewDeg: -2, creaseU: 0.47, width: 0.86, height: 0.91 },
  { id: 'ch6-door', kind: 'midground', role: 'scenery', mech: 'child', parentId: 'ch6-treasury', mount: 0.18, vDir: -1, phiDeg: 60, rhoDeg: 83, width: 0.24, height: 0.24 },
  { id: 'ch6-banner', kind: 'hero', role: 'scenery', mech: 'child', parentId: 'ch6-treasury', mount: 0.66, vDir: 1, phiDeg: 60, rhoDeg: 83, width: 0.18, height: 0.36 },
  // VOLUMETRIC: a banker's strongbox on the path to the vaults — the
  // chapter's enclosed volume until the treasury itself becomes a box
  // (waiting on the art split). Completes the census: 6/6 chapters.
  { id: 'ch6-strongbox', kind: 'backdrop', role: 'story', mech: 'box', a: 0.1, height: 0.11, z0: 0.38, z1: 0.5, roof: 'flat' },
  { id: 'ch6-fringe', kind: 'foreground', role: 'scenery', mech: 'vfold', apexZ: 0.54, vDir: 1, phiDeg: 84, rhoDeg: 88, width: 1.3, height: 0.25 },
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
  { id: 'title-border', kind: 'backdrop', role: 'backdrop', mech: 'vfold', apexZ: -0.25, vDir: -1, phiDeg: 84, rhoDeg: 88, width: 1.3, height: 0.5 },
  { id: 'title-hero', kind: 'hero', role: 'figure', mech: 'vfold', apexZ: 0.15, vDir: 1, phiDeg: 52, rhoDeg: 80, width: 0.38, height: 0.63 },
  { id: 'title-crest', kind: 'hero', role: 'scenery', mech: 'child', parentId: 'title-hero', mount: 0.24, vDir: 1, phiDeg: 62, rhoDeg: 84, width: 0.18, height: 0.13 },
]
const TITLE_ACCENTS: readonly string[] = ['#c9a227', '#6a8f5f']

const SATCHEL_LAYERS: readonly SceneLayer[] = [
  { id: 'satchel-bag', kind: 'hero', role: 'scenery', mech: 'vfold', apexZ: -0.1, vDir: 1, phiDeg: 52, rhoDeg: 80, width: 0.9, height: 0.6 },
]
const SATCHEL_ACCENTS: readonly string[] = ['#c9a227', '#8a5a3b'] // gold + leather

const END_LAYERS: readonly SceneLayer[] = [
  { id: 'end-letter', kind: 'hero', role: 'scenery', mech: 'vfold', apexZ: -0.15, vDir: 1, phiDeg: 52, rhoDeg: 80, width: 0.75, height: 0.5 },
  { id: 'end-raven', kind: 'hero', role: 'figure', mech: 'child', parentId: 'end-letter', mount: 0.28, vDir: 1, phiDeg: 62, rhoDeg: 84, width: 0.2, height: 0.15 },
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
