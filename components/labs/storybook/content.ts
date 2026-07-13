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
 *  geometry fields ARE its die-cut. Eight mechanism families give each
 *  spread its own construction:
 *   - 'vfold': the spherical four-bar wall/centerpiece; optionally skewed
 *     (asymmetric glue angles — the piece leans) and with an off-center
 *     crease (creaseU — the peak sits off-middle).
 *   - 'parallel': a strip creased parallel to the spine (planar four-bar).
 *     DEMOTED as an artwork carrier (its faces only ever look left/right)
 *     but re-derived by C6 round 7 as the GROUND SWELL: a low terrain
 *     mound whose ridge sits at lateral station ~ (glueL - glueR) — the
 *     full-range off-spine anchor a tentRidge rider stands on. Covenant:
 *     must carry >= 1 rider, rise <= 0.08, scenery role.
 *   - 'child': a small v-fold riding a parent's central crease (Glassner
 *     "generations") — ravens on rookery folds, coins spilling off a
 *     dragon. Driven by the parent's own panel dihedral, so one page turn
 *     moves the whole cascade.
 *   - 'box': the volumetric mechanism — an enclosed paper prism straddling
 *     the gutter with camera-facing caps, painted side walls, and a flat
 *     lid, gabled roof, or open hollow top. Counters, barns, stalls,
 *     chests. Per-face art: `<id>-front/-back/-side/-top`.
 *  The anatomy-phase families (Part C v2 — dressed assemblies; solvers in
 *  book/popup-anatomy.ts):
 *   - 'platform': a floating deck hinged on two tent-strut ranks — the
 *     BRIDGE (mirror ranks, one flat tier) or the TERRACE (stepped ranks).
 *     Art held above the page plane: the single biggest depth win.
 *   - 'fan': k v-folds sharing one spine apex at nested angles (Birmingham
 *     M-fold) — many planes from one crease.
 *   - 'rider': a v-fold whose "pages" are a parent's hinged patch pair —
 *     a prop standing ON a flat-roofed box or a bridge deck (recursion).
 *   - 'dress': a non-kinematic die-cut silhouette patch glued flat onto one
 *     parent panel, riding its link and free to overhang the panel edges
 *     (the Sabuda recipe) — zero DOF, pure decoration.
 *   - 'stripflap' (C6 round 7c): a figure erected by a HIDDEN pull strip
 *     under the floor — the book's own opening pulls it upright at any
 *     station with any facing, with no visible connector (law L5). The
 *     off-center standee/building vocabulary.
 *   - 'tabpiece' (Part D1): a one-page slider — mound (Birmingham 90
 *     "knee") or table — erected by a page-internal strip whose end is a
 *     VISIBLE tab at the fore edge; the tab slides out by exactly the
 *     strip draw as the book opens (solver in book/popup-tabpiece.ts).
 *     The future interactive pull/push handle (D6).
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
  { id: 'ch1-inn', kind: 'hero', role: 'story', mech: 'vfold', apexZ: 0.06, vDir: 1, phiDeg: 56, rhoDeg: 81, skewDeg: 3, creaseU: 0.55, width: 0.72, height: 0.7 },
  // DRESSED ASSEMBLY (C1v2): the inn is now a v-fold core wearing shaped
  // silhouette patches — the eaves overhang its roofline off the left
  // panel, a hanging lamp bracket off the right.
  { id: 'ch1-inn-eaves', kind: 'hero', role: 'scenery', mech: 'dress', parentId: 'ch1-inn', seat: 'left', u: 0.06, v: 0.62, width: 0.3, height: 0.12 },
  { id: 'ch1-inn-lamp', kind: 'hero', role: 'scenery', mech: 'dress', parentId: 'ch1-inn', seat: 'right', u: 0.13, v: 0.28, width: 0.08, height: 0.14 },
  { id: 'ch1-dormer', kind: 'midground', role: 'scenery', mech: 'child', parentId: 'ch1-inn', mount: 0.62, vDir: 1, phiDeg: 64, rhoDeg: 85, width: 0.16, height: 0.15 },
  { id: 'ch1-sign', kind: 'hero', role: 'scenery', mech: 'vfold', apexZ: 0.2, vDir: 1, phiDeg: 58, rhoDeg: 82, width: 0.2, height: 0.26 },
  // VOLUMETRIC: the stable is a gabled OPEN-FRONT barn at the gate — the
  // user's canonical pop-up structure ("left wall, right wall and a
  // ceiling", C6 round-1 verdict 2026-07-11): open front toward the
  // reader, hollow interior, back wall as the brace. Sized down and kept
  // forward so the inn's painted story and the signpost stay clear.
  { id: 'ch1-stable', kind: 'backdrop', role: 'story', mech: 'box', a: 0.13, height: 0.16, z0: 0.42, z1: 0.58, roof: 'gable', gableRise: 0.08, capFront: false },
  // Dress on the stable: a weathervane overhanging the ridge, a hay bale low against the side wall.
  { id: 'ch1-stable-vane', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch1-stable', seat: 'roofL', u: 0.12, v: 0.02, width: 0.07, height: 0.12 },
  { id: 'ch1-stable-hay', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch1-stable', seat: 'wallR', u: 0.01, v: 0, width: 0.14, height: 0.08 },
  // FLOATING TIER (C3v2): the inn's coaching-yard deck — a BRIDGE platform,
  // two mirror strut ranks (equal closed reach, qA===qB) carrying one deck
  // across the gap between them. COMPOSITION SPREAD-D: raised on tall struts
  // (rise 0.26) and widened by a lopsided glue split (0.30/0.14, qA 0.30) so
  // the deck crest clears the inn's roofline and its struts show past the
  // building on both sides — a rampart-terrace behind the inn instead of a
  // flap the hero fully masks. Still sunk in the back lane so it owns its
  // depth band (the inn nudged to apexZ 0.06 to drop its screen-top clear).
  { id: 'ch1-yard', kind: 'midground', role: 'story', mech: 'platform', strutA: { glueL: 0.3, glueR: 0.14, rise: 0.26, spans: [[-0.3, -0.24], [-0.18, -0.12]] }, strutB: { glueL: 0.14, glueR: 0.3, rise: 0.26, spans: [[-0.3, -0.24], [-0.18, -0.12]] }, qA: 0.3, qB: 0.3, deckZ0: -0.3, deckZ1: -0.12 },
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
  // Dress on the hive: a bee swarm hanging off the lid, flowers at the base.
  { id: 'ch2-hive-swarm', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch2-hive', seat: 'lidR', u: 0, v: 0.01, width: 0.16, height: 0.1 },
  { id: 'ch2-hive-flowers', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch2-hive', seat: 'wallL', u: 0, v: 0, width: 0.14, height: 0.07 },
  // FLOATING TIER (C3v2): an alpine meadow shelf — a TERRACE platform (two
  // strut ranks of DIFFERENT closed reach, qA+qB spanning the gap) so the
  // deck steps down toward the reader.
  { id: 'ch2-meadow', kind: 'midground', role: 'story', mech: 'platform', strutA: { glueL: 0.12, glueR: 0.12, rise: 0.14, spans: [[-0.3, -0.22]] }, strutB: { glueL: 0.1, glueR: 0.1, rise: 0.06, spans: [[-0.1, -0.02]] }, qA: 0.06, qB: 0.06, deckZ0: -0.3, deckZ1: -0.02 },
  // The long-planned painted meadow fringe up front (call sheet v5): a low
  // wide reader-edge wall that ratchets the chapter's depth bands.
  { id: 'ch2-fringe', kind: 'foreground', role: 'scenery', mech: 'vfold', apexZ: 0.56, vDir: 1, phiDeg: 84, rhoDeg: 88, width: 1.2, height: 0.22 },
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
  // RECURSION (C4v2): a raven standing ON the dispatch counter's lid — a
  // rider v-fold whose "pages" are the box's lid patch pair.
  { id: 'ch3-perch-raven', kind: 'midground', role: 'figure', mech: 'rider', parentId: 'ch3-counter', seat: 'boxLid', mountZ: 0.42, vDir: 1, phiDeg: 29, rhoDeg: 43, width: 0.1, height: 0.09 },
  // Dress on the counter: stacked ledgers overhanging the lid edge, a weigh-scale on the front cap.
  { id: 'ch3-counter-ledgers', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch3-counter', seat: 'lidR', u: 0.1, v: 0.11, width: 0.12, height: 0.1 },
  { id: 'ch3-counter-scale', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch3-counter', seat: 'capFrontL', u: 0.04, v: 0.05, width: 0.09, height: 0.1 },
  // FLOATING TIER (C3v2): the parcel-sorting deck — a BRIDGE platform like
  // the coaching yard but tucked in toward the spine.
  { id: 'ch3-sorting', kind: 'midground', role: 'story', mech: 'platform', strutA: { glueL: 0.16, glueR: 0.11, rise: 0.13, spans: [[0.02, 0.08], [0.14, 0.2]] }, strutB: { glueL: 0.11, glueR: 0.16, rise: 0.13, spans: [[0.02, 0.08], [0.14, 0.2]] }, qA: 0.1, qB: 0.1, deckZ0: 0.02, deckZ1: 0.2 },
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
  // Dress on the chest: the propped-open lid silhouette rising off the side
  // wall, gold heaped across the front cap (patches ride at/above the panel
  // base — paper cannot overhang below a page-glued edge).
  { id: 'ch4-chest-lid', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch4-chest', seat: 'wallL', u: 0, v: 0.02, width: 0.13, height: 0.14 },
  { id: 'ch4-chest-spill', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch4-chest', seat: 'capFrontR', u: 0, v: 0, width: 0.12, height: 0.09 },
  // FLOATING TIER (C3v2): the gold-hoard shelf — a BRIDGE platform in the
  // deep lane behind the dragon (the back of its lair), where the coin is
  // heaped. COMPOSITION SPREAD-D: this deck was buried behind BOTH the city
  // skyline (a full-width standing wall) and the dragon. Kept DEEP (its own
  // depth band) but grown onto tall struts (rise 0.40, qA 0.21) and a
  // lopsided glue split so the gold heap crests ABOVE the skyline and shows
  // through the torn-paper sky — deep AND tall, since a deeper piece sits
  // HIGHER on this top-down camera.
  { id: 'ch4-hoard', kind: 'midground', role: 'story', mech: 'platform', strutA: { glueL: 0.22, glueR: 0.14, rise: 0.4, spans: [[-0.39, -0.34], [-0.32, -0.26]] }, strutB: { glueL: 0.14, glueR: 0.22, rise: 0.4, spans: [[-0.39, -0.34], [-0.32, -0.26]] }, qA: 0.21, qB: 0.21, deckZ0: -0.39, deckZ1: -0.26 },
  // D1 TAB PIECE: the hoard's loose gold rises as a MOUND on the right
  // page, its tab creeping out of the fore edge as the spread blooms —
  // the treasure literally grows when the book opens. Strip-driven family
  // beyond the satchel (palette law), opposite side from ch5's table.
  // Sited z 0.08+ so the midground wall's glue path (crosses z ~0.04 at
  // this x range) stays clear, x >= 0.38 so the chest (x <= ~0.24) does.
  { id: 'ch4-goldpile', kind: 'midground', role: 'scenery', mech: 'tabpiece', side: 'right', form: 'mound', hingeX: 0.9, z0: 0.08, z1: 0.36, legW: 0.26, liftDeg: 55 },
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
  // (C6 round 4: the canopy fan that briefly lived here was shrunk to a
  // nubbin by the packed bazaar lanes and read as nothing — the fan
  // showcase moved to the TITLE spread at full size, where it has room to
  // be six planes. The bazaar keeps its four families without it:
  // vfold / child / box / platform.)
  // Arch pulled a step deeper (C6 round 4 band audit): its panel centroid
  // sat within the goods table's band and the two merged once the canopy
  // fan left — a real depth gap between archway and market table restores
  // the fifth band the eye reads.
  { id: 'ch5-arch', kind: 'hero', role: 'story', mech: 'vfold', apexZ: -0.16, vDir: 1, phiDeg: 54, rhoDeg: 81, width: 0.8, height: 0.8 },
  // Dress on the arch: a garland swagged high across the right panel, a keystone medallion high-center on the left.
  { id: 'ch5-arch-garland', kind: 'hero', role: 'scenery', mech: 'dress', parentId: 'ch5-arch', seat: 'right', u: 0.05, v: 0.72, width: 0.3, height: 0.1 },
  { id: 'ch5-arch-keystone', kind: 'hero', role: 'scenery', mech: 'dress', parentId: 'ch5-arch', seat: 'left', u: 0.15, v: 0.68, width: 0.1, height: 0.1 },
  { id: 'ch5-lantern', kind: 'hero', role: 'scenery', mech: 'child', parentId: 'ch5-arch', mount: 0.54, vDir: 1, phiDeg: 62, rhoDeg: 84, width: 0.15, height: 0.26 },
  { id: 'ch5-lantern-b', kind: 'hero', role: 'scenery', mech: 'child', parentId: 'ch5-arch', mount: 0.66, vDir: 1, phiDeg: 64, rhoDeg: 85, width: 0.09, height: 0.252 },
  // VOLUMETRIC: the awning tent is reimagined as an OPEN-FRONT market
  // stall — left wall, right wall, canvas canopy, open toward the shopper
  // (market stalls ARE open-fronted; C6 round-1 made this the canonical
  // read). Back wall braces. Sized so the arch's painted opening and the
  // hero walking through it stay clear above it.
  { id: 'ch5-stall', kind: 'backdrop', role: 'story', mech: 'box', a: 0.12, height: 0.15, z0: 0.36, z1: 0.58, roof: 'gable', gableRise: 0.075, capFront: false },
  // Dress on the stall: a scalloped valance hanging off the canopy edge, stacked crates low against the side wall.
  { id: 'ch5-stall-valance', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch5-stall', seat: 'roofL', u: 0, v: 0.07, width: 0.2, height: 0.07 },
  { id: 'ch5-stall-crates', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch5-stall', seat: 'wallL', u: 0.04, v: 0, width: 0.12, height: 0.09 },
  // FLOATING TIER (C3v2): the goods table — a BRIDGE platform spanning the
  // stall row, its deck the laid-out wares.
  { id: 'ch5-goods', kind: 'midground', role: 'story', mech: 'platform', strutA: { glueL: 0.15, glueR: 0.1, rise: 0.12, spans: [[0.08, 0.14], [0.24, 0.3]] }, strutB: { glueL: 0.1, glueR: 0.15, rise: 0.12, spans: [[0.08, 0.14], [0.24, 0.3]] }, qA: 0.09, qB: 0.09, deckZ0: 0.08, deckZ1: 0.3 },
  // D1 TAB PIECE: a market TABLE erected by its own fore-edge tab on the
  // left page, downstage of the stall row — legs + level deck. Inner
  // hinge at 0.34 clears the stall box's left-wall reach (~0.27); the
  // z band sits past the goods platform (z <= 0.3) and the stalls fold
  // (z ~ -0.2). Mirrors ch4's mound on the other side of the book.
  { id: 'ch5-market-table', kind: 'midground', role: 'scenery', mech: 'tabpiece', side: 'left', form: 'table', hingeX: 0.9, z0: 0.36, z1: 0.64, legW: 0.18, deckD: 0.2, liftDeg: 60 },
]

// Chapter VI — the crescendo: pine treeline and the book's LARGEST hero —
// the glass treasury grown to a true multi-story compound: vault door low
// on the fold (ground story), banner raised high (top story), the whole
// piece leaning with real skew. Low pine fringe up front.
const CH6_LAYERS: readonly SceneLayer[] = [
  { id: 'ch6-pines', kind: 'backdrop', role: 'backdrop', mech: 'vfold', apexZ: -0.42, vDir: -1, phiDeg: 84, rhoDeg: 88, skewDeg: 1.4, creaseU: 0.44, width: 1.7, height: 0.69 },
  { id: 'ch6-treasury', kind: 'hero', role: 'story', mech: 'vfold', apexZ: 0.04, vDir: 1, phiDeg: 54, rhoDeg: 80, skewDeg: -2, creaseU: 0.47, width: 0.86, height: 0.91 },
  // Dress on the treasury: a glass spire overhanging the roofline off the
  // left panel, climbing vines low across the right — the dressed hero.
  { id: 'ch6-treasury-spire', kind: 'hero', role: 'scenery', mech: 'dress', parentId: 'ch6-treasury', seat: 'left', u: 0.14, v: 0.75, width: 0.14, height: 0.2 },
  { id: 'ch6-treasury-vines', kind: 'hero', role: 'scenery', mech: 'dress', parentId: 'ch6-treasury', seat: 'right', u: 0.13, v: 0.02, width: 0.2, height: 0.12 },
  { id: 'ch6-door', kind: 'midground', role: 'scenery', mech: 'child', parentId: 'ch6-treasury', mount: 0.18, vDir: -1, phiDeg: 60, rhoDeg: 83, width: 0.24, height: 0.24 },
  { id: 'ch6-banner', kind: 'hero', role: 'scenery', mech: 'child', parentId: 'ch6-treasury', mount: 0.66, vDir: 1, phiDeg: 60, rhoDeg: 83, width: 0.18, height: 0.36 },
  // VOLUMETRIC: a banker's strongbox on the path to the vaults — the
  // chapter's enclosed volume until the treasury itself becomes a box
  // (waiting on the art split). Completes the census: 6/6 chapters.
  { id: 'ch6-strongbox', kind: 'backdrop', role: 'story', mech: 'box', a: 0.1, height: 0.11, z0: 0.38, z1: 0.5, roof: 'flat' },
  // RECURSION (C4v2): the bank's griffin crest standing ON the strongbox lid.
  { id: 'ch6-crest', kind: 'midground', role: 'scenery', mech: 'rider', parentId: 'ch6-strongbox', seat: 'boxLid', mountZ: 0.44, vDir: 1, phiDeg: 29, rhoDeg: 43, width: 0.09, height: 0.08 },
  // Dress on the strongbox: a wax seal on the front cap, minted coins heaped
  // at the side-wall base (v=0 — no overhang below the page-glued edge).
  { id: 'ch6-strongbox-seal', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch6-strongbox', seat: 'capFrontL', u: 0.02, v: 0.03, width: 0.07, height: 0.07 },
  { id: 'ch6-strongbox-coins', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch6-strongbox', seat: 'wallL', u: 0, v: 0, width: 0.12, height: 0.06 },
  // FLOATING TIER (C3v2): the treasury's glass gallery — a BRIDGE platform in
  // the approach lane behind the vault. COMPOSITION SPREAD-D: the treasury is
  // the book's TALLEST hero (0.91) and it LEANS RIGHT (skew -2), so a wide
  // deck raised on tall struts (rise 0.40, qA 0.28) crests near its shoulder
  // while its LEFT wing — deck and struts — swings toward the open left of
  // the leaning tower. Was a narrow one-sided TERRACE the treasury fully hid;
  // the wide bridge and the lean together give it a real reveal. Deep back
  // lane, so it keeps its own depth band.
  { id: 'ch6-steps', kind: 'midground', role: 'story', mech: 'platform', strutA: { glueL: 0.26, glueR: 0.14, rise: 0.4, spans: [[-0.32, -0.24], [-0.22, -0.14]] }, strutB: { glueL: 0.14, glueR: 0.26, rise: 0.4, spans: [[-0.32, -0.24], [-0.22, -0.14]] }, qA: 0.28, qB: 0.28, deckZ0: -0.32, deckZ1: -0.14 },
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

// THE FAN SHOWCASE (C6 round 4): the canopy fan died as a nubbin in the
// packed bazaar, and the title page's center hides under the HTML title
// card — the satchel spread is the stage with actual room. Narrative fit:
// "the satchel, unpacked" — a golden fan of treasures bursting out of the
// opened bag toward the reader. Widths bloom OUTWARD (inner ray short,
// outer rays long): a low-phi member's glue lines run nearly parallel to
// the spine, so the inner ray is what would reach the bag — kept short —
// while the outer rays angle away from the spine and carry the span.
// ROUND 7d — THE PALETTE LAW: the scene mixes drives and stations, no
// monoculture. Spine pieces (bag v-fold, fan burst), a gutter-bound
// OFF-CENTER table (non-mirrored bridge — modest ramps are part of the
// paper's honesty; 7c rejected dominant ramps, not the family), and
// strip-erected frontal figures (hidden pull strips — no connectors at
// all). Variety and asymmetry ARE the aesthetic.
const SATCHEL_LAYERS: readonly SceneLayer[] = [
  { id: 'satchel-bag', kind: 'hero', role: 'scenery', mech: 'vfold', apexZ: -0.1, vDir: 1, phiDeg: 52, rhoDeg: 80, width: 0.9, height: 0.6 },
  { id: 'satchel-burst', kind: 'midground', role: 'scenery', mech: 'fan', apexZ: 0.24, vDir: 1, members: [{ phiDeg: 17.2, rhoDeg: 31.5, width: 0.26, height: 0.26 }, { phiDeg: 31.5, rhoDeg: 48.7, width: 0.4, height: 0.34 }, { phiDeg: 45.8, rhoDeg: 65.9, width: 0.5, height: 0.36 }] },
  // The map table: gutter-bound, standing well out on the right page
  // (equal-height ridges keep its top level), the Router's Scroll
  // unrolled across it.
  { id: 'satchel-table', kind: 'midground', role: 'story', mech: 'platform', strutA: { glueL: 0.05, glueR: 0.55, rise: 0.05, spans: [[-0.62, -0.36]] }, strutB: { glueL: 0.18, glueR: 0.452, rise: 0.018, spans: [[-0.62, -0.36]] }, qA: 0.136, qB: 0.136, deckZ0: -0.62, deckZ1: -0.36 },
  { id: 'satchel-scroll', kind: 'midground', role: 'scenery', mech: 'dress', parentId: 'satchel-table', seat: 'deckB', u: 0.02, v: 0.05, width: 0.09, height: 0.16 },
  // The Ever-Sharp Sword: strip-erected frontal figure, mid-left.
  { id: 'satchel-sword', kind: 'hero', role: 'figure', mech: 'stripflap', side: 'left', anchor: 0.22, anchorZ: -0.3, slot: 0.3, slotZ: -0.3, hingeX: 0.38, hingeZ: -0.3, width: 0.34, height: 0.4 },
  // The Wayfarer's Compass: strip-erected frontal dial, front-right.
  { id: 'satchel-compass', kind: 'midground', role: 'scenery', mech: 'stripflap', side: 'right', anchor: 0.2, anchorZ: 0.35, slot: 0.26, slotZ: 0.35, hingeX: 0.36, hingeZ: 0.35, width: 0.22, height: 0.24 },
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
