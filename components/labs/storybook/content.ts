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
  /** D-G1/D-G8: the layer id whose motion is this spread's signature moment.
   *  Must exist in `layers`, its FAMILY must differ from the previous and next
   *  spread's hero (rotation), and its measured sweep displacement must clear
   *  0.35 x page height (0.525 world units) unless it is strip-driven
   *  (tabpiece/stripflap — the future-interactive vocabulary). Enforced by
   *  __tests__/labs/storybook/hero-wow.test.ts. */
  hero: string
  /** SHOWPIECE (Part E, charter 2026-07-14 pillar E-P2 "prune the crowds:
   *  fewer, larger, distinct structures... variety survives at the BOOK level,
   *  not by piling mechanisms per spread"): a grand-architecture spread built as
   *  ONE near-backdrop structure rather than the D-series per-chapter template.
   *  A declared marker (not a spread-index literal) so the covenant tests exempt
   *  it from the crowd-template gates — the platform-per-chapter, the depth-band
   *  ratchet, the art-overlap coverage floor — while every physics/quality gate
   *  (D-G2 collision, real-time, sightline, golden) stays hard everywhere. Set on
   *  the E1 pilot (the Dispatch Keep) and extends to the E2 grand chapter by
   *  setting this flag, no test edit. */
  showpiece?: boolean
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
  { id: 'ch1-backdrop', kind: 'backdrop', role: 'backdrop', mech: 'vfold', apexZ: -0.42, vDir: -1, phiDeg: 82, rhoDeg: 88.8, skewDeg: -1.5, creaseU: 0.42, width: 1.6, height: 0.85 },
  { id: 'ch1-inn', kind: 'hero', role: 'story', mech: 'vfold', apexZ: 0.06, vDir: 1, phiDeg: 56, rhoDeg: 81, skewDeg: 3, creaseU: 0.55, width: 0.72, height: 0.7 },
  // DRESSED ASSEMBLY (C1v2): the inn is now a v-fold core wearing shaped
  // silhouette patches — the eaves overhang its roofline off the left
  // panel, a hanging lamp bracket off the right.
  { id: 'ch1-inn-eaves', kind: 'hero', role: 'scenery', mech: 'dress', parentId: 'ch1-inn', seat: 'left', u: 0.06, v: 0.62, width: 0.3, height: 0.12 },
  { id: 'ch1-inn-lamp', kind: 'hero', role: 'scenery', mech: 'dress', parentId: 'ch1-inn', seat: 'right', u: 0.13, v: 0.28, width: 0.08, height: 0.14 },
  { id: 'ch1-dormer', kind: 'midground', role: 'scenery', mech: 'child', parentId: 'ch1-inn', mount: 0.62, vDir: 1, phiDeg: 64, rhoDeg: 85, width: 0.16, height: 0.15 },
  { id: 'ch1-sign', kind: 'hero', role: 'scenery', mech: 'vfold', apexZ: 0.2, vDir: 1, phiDeg: 58, rhoDeg: 82, width: 0.2, height: 0.26 },
  // LIFT-THE-FLAP (E2.2 Batch B, new family): the chapter's conceit AND its
  // playable (G4). A page-flat KEY-BOARD plaque riveted into the RIGHT page's
  // open mid-ground meadow (where loose brass keys are already printed) carries
  // a row of four numbered inn doors; the reader lifts each to find a hanging
  // brass key — behind door 3, the innkeeper's cat (the surprise). Page-rooted
  // and page-flat (the winch/volvelle seat: lid-orientation reads best at the
  // pinned camera; the inn hero is a single v-fold PAINTING, so its flaps live
  // on a piece I fully control). Doors HOLD their open/shut state through page
  // turns; the page-openness envelope eases them shut at book close. Numbers
  // bench-verified in derive-liftflap.mjs (L1-L9). Clears the stable (z 0.43+)
  // and the spine v-folds (it sits out at d 0.4+).
  {
    id: 'ch1-keyboard', kind: 'foreground', role: 'scenery', mech: 'liftflap', side: 'right',
    hingeD: 0.44, leafLen: 0.16, boardD0: 0.4, boardD1: 0.62, boardZ0: -0.03, boardZ1: 0.42,
    doors: [
      { z0: -0.005, z1: 0.08, reveal: 'key', plate: 1 },
      { z0: 0.1, z1: 0.185, reveal: 'key', plate: 2 },
      { z0: 0.215, z1: 0.3, reveal: 'cat', plate: 3 },
      { z0: 0.33, z1: 0.415, reveal: 'key', plate: 4 },
    ],
  },
  // VOLUMETRIC: the stable is a gabled OPEN-FRONT barn at the gate — the
  // user's canonical pop-up structure ("left wall, right wall and a
  // ceiling", C6 round-1 verdict 2026-07-11): open front toward the
  // reader, hollow interior, back wall as the brace. Sized down and kept
  // forward so the inn's painted story and the signpost stay clear.
  { id: 'ch1-stable', kind: 'backdrop', role: 'story', mech: 'box', a: 0.13, height: 0.15, z0: 0.43, z1: 0.58, roof: 'gable', gableRise: 0.075, capFront: false },
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
  { id: 'ch1-yard', kind: 'midground', role: 'story', mech: 'platform', strutA: { glueL: 0.3, glueR: 0.14, rise: 0.26, spans: [[-0.24, -0.19], [-0.17, -0.12]] }, strutB: { glueL: 0.14, glueR: 0.3, rise: 0.26, spans: [[-0.24, -0.19], [-0.17, -0.12]] }, qA: 0.28, qB: 0.28, deckZ0: -0.24, deckZ1: -0.12 },
  { id: 'ch1-wall', kind: 'foreground', role: 'scenery', mech: 'vfold', apexZ: 0.66, vDir: 1, phiDeg: 84, rhoDeg: 88, width: 1.25, height: 0.2 },
]

// Chapter II — airy alpine spread, no foreground fringe: one big leaning
// ridge with two bees popping off its fold, the courier balloon hero with
// a third bee circling it. Deliberately the SPARSEST chapter — density
// contrast is part of the variation.
const CH2_LAYERS: readonly SceneLayer[] = [
  { id: 'ch2-backdrop', kind: 'backdrop', role: 'backdrop', mech: 'vfold', apexZ: -0.45, vDir: -1, phiDeg: 84, rhoDeg: 88.5, skewDeg: 1.5, creaseU: 0.6, width: 1.65, height: 0.94 },
  { id: 'ch2-bee-a', kind: 'hero', role: 'figure', mech: 'child', parentId: 'ch2-backdrop', mount: 0.48, vDir: 1, phiDeg: 60, rhoDeg: 83, width: 0.22, height: 0.117 },
  { id: 'ch2-hero', kind: 'hero', role: 'figure', mech: 'vfold', apexZ: 0.1, vDir: 1, phiDeg: 50, rhoDeg: 82, skewDeg: -2, creaseU: 0.45, width: 0.51, height: 0.89 },
  { id: 'ch2-bee-b', kind: 'hero', role: 'figure', mech: 'child', parentId: 'ch2-hero', mount: 0.62, vDir: -1, phiDeg: 64, rhoDeg: 85, width: 0.16, height: 0.089 },
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
  // deck steps down toward the reader. D5 arm-lane pass: its depth footprint
  // was tightened (deckZ -0.28..-0.10, was -0.30..-0.02) — pulling the shelf's
  // reader edge back opens clean air at the spine for the windmill downstage
  // of it and drops the meadow's mid-turn crossings with the backdrop/hero/
  // bees by ~30, the budget the visible sail spends against the backdrop.
  { id: 'ch2-meadow', kind: 'midground', role: 'story', mech: 'platform', strutA: { glueL: 0.12, glueR: 0.12, rise: 0.14, spans: [[-0.28, -0.22]] }, strutB: { glueL: 0.1, glueR: 0.1, rise: 0.06, spans: [[-0.16, -0.1]] }, qA: 0.06, qB: 0.06, deckZ0: -0.28, deckZ1: -0.1 },
  // The long-planned painted meadow fringe up front (call sheet v5): a low
  // wide reader-edge wall that ratchets the chapter's depth bands.
  { id: 'ch2-fringe', kind: 'foreground', role: 'scenery', mech: 'vfold', apexZ: 0.56, vDir: 1, phiDeg: 84, rhoDeg: 88, width: 1.2, height: 0.22 },
  // KINETIC (D4/D5): a WINDMILL SAIL standing in the meadow — Birmingham mech
  // 73, a 45-deg arm that sweeps a quarter-turn up to vertical as the book
  // opens (the sail catching the wind). D5 arm-lane pass moved it from the deep
  // upstage park (apexZ -0.62) to a VISIBLE mid-page downstage lane (apexZ 0.20,
  // vDir +1): it stands at the meadow's front edge, just downstage of the
  // courier hero, rising a hair over the fringe. Its quarter-turn sweep costs
  // ~18 mid-turn brushes against the big backdrop wall; the meadow-shelf
  // tightening above returns that budget (net mid-turn count DROPS vs the park).
  { id: 'ch2-windmill', kind: 'midground', role: 'scenery', mech: 'kinetic', apexZ: 0.2, vDir: 1, phiDeg: 45, rhoDeg: 88, armW: 0.12, armLen: 0.3, flapW: 0.14, flapLen: 0.18 },
]

// Chapter III — THE DISPATCH KEEP (E1 pilot showpiece; derivation
// docs/superpowers/specs/2026-07-16-dispatch-keep-derivation.md, five bench
// proofs derive-keep-{stack,gallery,winch,skyline,wings}.mjs). The old rookery
// crowd (ch3-towers/rank/balcony/counter+dress/sorting/towerworks/semaphore/
// perch-raven/raven-b) is retired PER THE FATE LIST into ONE grand structure:
// a hollow grey-stone keep rising four stacked box-fold stories out of the
// spine to backdrop height (~0.84) — Dispatch Hall (hollow, open front) ->
// Balcony Gallery (open arcade, gold balcony cantilevering toward the reader)
// -> Rookery Loft (open belfry) -> Signal-Spire crown — with an interactive
// tower-hoist winch driving semaphore/iris/counterweight, a low mound skyline
// flanking it, and the kept fore wall. The reset's E-P2 "prune the crowds":
// fewer, larger, distinct structures; variety lives at the BOOK level. The old
// wing-rank v-folds become PAINTED aerial recession on the keep's own back
// walls (art, not mechanism — see the art call sheet). ch3-raven-a is kept as
// the hero raven, folded onto the crown (its child-v-fold parent retired, and
// nothing external can parent onto the one-entry keep).
const CH3_LAYERS: readonly SceneLayer[] = [
  // THE KEEP — one content entry expanding to four stacked box poses
  // (popup-keepstack.ts), each rendered through the existing box renderer. The
  // stories telescope inward (a_k <= a_{k-1}) and nest in z, so the whole stack
  // is one rigid chain geared to the single page dihedral and folds dead flat
  // at close. The balcony deck rides the hall's flat lid overhanging +z (the
  // board's jutting gold gallery, derive-keep-gallery.mjs), and the hero raven
  // perches on the crown.
  {
    id: 'ch3-keep', kind: 'backdrop', role: 'story', mech: 'keepstack',
    // E1.5 RE-MASS (composition FAIL -> "design the picture, then engineer").
    // The keep is re-massed as a READER-FACING TIERED FACADE composed for the
    // pinned composition camera, not a lid-stack: the Dispatch HALL is now a
    // SOLID capFront base (the master painting's big lower facade), the GALLERY
    // stays an OPEN loggia (capFront:false) so the jutting gold balcony reads as
    // a cantilevered gallery, the LOFT belfry + CROWN spire cap the tiers. The
    // stack is sized to the S4 FOLD-FLAT MAXIMUM: at book-close it folds flat
    // ALONG the page, so its footprint reach (top-story roof peak up the page,
    // = sum(H) + a + H + sqrt(a^2+gable^2)) must stay <= PAGE_W 1.15 — this, not
    // z-containment, caps the keep HEIGHT at ~0.90 world (reach 1.13). Wider
    // stories (a up to the z1+a<=0.75 front-cap-fold ceiling) widen the facade.
    stories: [
      // Dispatch Hall — SOLID capFront base facade. E1.5.1 FACADE-PLATE fix: the
      // front no longer prints as art CROPPED to the rectangular cap face (which
      // read as a square block); instead a DIE-CUT PLATE (keepStackFacadePlate)
      // prints the UNCROPPED curtain-wall art (delivered 4.448 w/h). The wide
      // bailey-wing variant (height 0.25 -> width 1.112, overhanging the tower)
      // was REJECTED: at 4.448 its wings reach lateral 0.556 and collide with the
      // grown citadel rank (skyline-r inner edge 0.537, A9) and graze the page
      // wedge (A10). FALLBACK adopted: width = cap width 0.80 (wh = a, flush with
      // the walls, no lateral overhang) -> plate height 0.1799. PHASE 1 "STRUCTURE
      // FITS INSIDE ART": the structural cap height is pulled DOWN to equal the
      // plate height (0.25 -> 0.1799) so the die-cut curtain-wall plate covers the
      // cap edge-to-edge — no raw tan/kraft cap strip is exposed above the art from
      // the pinned camera (the old 0.070 strip dies). capFrontArt:false interior
      // shadow now simply never shows (zero exposed strip). Back cap braces, flat
      // lid seats the gallery + carries the balcony.
      { key: 'hall', a: 0.4, height: 0.1799, z0: -0.34, z1: 0.34, roof: 'flat', capFront: true, capBack: true, plate: { width: 0.8, height: 0.1799 } },
      // Balcony Gallery — solid capFront tier below the jutting gold balcony.
      // Facade plate: painted arcade loggia (delivered 3.677) sized plate width =
      // cap width 0.68 (flush, like the hall fallback) -> plate height 0.1849. PHASE
      // 1: the structural cap height is pulled DOWN to the plate height (0.22 ->
      // 0.1849) so the loggia plate covers the cap edge-to-edge — the old 0.035
      // exposed strip under the balcony cantilever dies.
      { key: 'gallery', a: 0.34, height: 0.1849, z0: -0.28, z1: 0.28, roof: 'flat', capFront: true, capBack: true, plate: { width: 0.68, height: 0.1849 } },
      // Rookery Loft — box shell whose walls carry die-cut arch voids (art: a
      // see-through belfry) and host the winch iris + counterweight; its flat cap
      // slab is now the FAN SPIRE'S SEAT (the apex sits on this lid's seam).
      // Facade plate: painted roof + bell (delivered 2.427) sized plate width =
      // cap width 0.54 -> height 0.2225, so the roofline + bell rise ABOVE the cap
      // top edge as silhouette. (A1 Concept A: the gabled crown box is RETIRED —
      // see `spire` below. ROOF DIFFERENTIATION note: the three box tiers all keep
      // FLAT lids because each tier's lid IS the seat that hoists the tier/spire
      // above — the box-on-lid chain. gable/open remove the lid, so they are
      // walled for a seating tier; the middle-tier roofline variety is carried by
      // the die-cut facade PLATES, and the top silhouette break is the fan spire.)
      { key: 'loft', a: 0.27, height: 0.18, z0: -0.2, z1: 0.2, roof: 'flat', capFront: true, capBack: true, plate: { width: 0.54, height: 0.2225 } },
    ],
    // The jutting gold gallery deck, GROWN (halfW 0.26, z 0.30..0.58) into a
    // hero cantilever off the hall lid, starting just in front of the gallery
    // wall (z1 0.28) so nothing occludes it. Art splits across the spine crease
    // (deckL art-u 0.5->0, deckR 0.5->1) — one continuous painting.
    balcony: { halfW: 0.26, z0: 0.3, z1: 0.58 },
    // THE FAN SPIRE CROWN (Concept A "Silhouette-Break Keep"; bench derive-keep-
    // spire.mjs, T1-T8 green). Birmingham mech 21-29 M-fold: 3 nested v-fold
    // members sharing ONE apex, SEATED ON THE LOFT'S FLAT LID (apex on the lid
    // seam at bisector-x = sum(H) = 0.65, glue lines running down the two lid
    // panels — the boxLid rider seat generalized from one v-fold to a fan). Solved
    // as solveFanPose translated by the seat height along the bisector, so it is
    // bit-identical physics to a page fan and folds DEAD FLAT for free. Members
    // run laid-back-flank -> steep-narrow-peak (widths narrowing), so the
    // silhouette reads as a PIERCED PEAK, not a lid: the peak member's ridge
    // reaches ~1.00 world-Y at rest (raven finial ~1.12), clearly above the
    // retired gabled crown's ~0.90. The steepest (last) member carries the raven.
    spire: {
      apexZ: 0.0,
      vDir: 1,
      members: [
        // flank: broadest/shortest sail — kept STEEP so it rises, not flops
        // forward over the keep's front caps (T5 keep clearance).
        { phiDeg: 35.5, rhoDeg: 52.7, width: 0.26, height: 0.28 },
        // mid
        { phiDeg: 42.4, rhoDeg: 63.0, width: 0.2, height: 0.34 },
        // peak: steepest + narrowest, pierces above the old crown; carries the raven.
        { phiDeg: 49.3, rhoDeg: 74.5, width: 0.15, height: 0.38 },
      ],
      // Raven = the hero finial, a coplanar extension of the PEAK member past its
      // ridge tip (was: keepStackRavenDeck on the crown cap). Coplanar with a
      // folding member => zero off-plane reach: folds dead flat for free, wedge
      // containment inherits the member's proof. Stays the topmost hero
      // silhouette, reader-visible at the pinned camera (T8 sightline 100%).
      raven: { finialH: 0.12 },
    },
  },
  // THE CITADEL RANK — E1.5.2 RE-DERIVED as +z-FACING CITY ROWS
  // (derive-keep-cityrows.mjs). The v1 fore-hinge PRISM read END-ON: its ridge
  // ran ALONG the spine, so the along-spine composition camera saw leaning shards
  // (current) / kraft backs (flip) — the orchestrator eye-test killed both. Root
  // cause is orientation class: every piece that READS in this book faces +z.
  // Now each row is a single-page cammed FLAP hinged on a RADIAL line, standing
  // up (leaning back toward -z, standDeg 64) as the book opens — the SAME
  // page-driven envelope class as the retired mound, REORIENTED so the die-cut
  // roofline faces the reader (face spans radial x up at a fixed depth, normal
  // along z). GROWN + MARCHED-FORWARD pass (user order "bigger, nearer, wider"):
  // the three tiers now STEP toward the reader and outboard together — deep back
  // tier (F 0.43, zc -0.52) tallest at ~0.10-0.11, mid tier (F 0.46, zc -0.38),
  // front tier jutting to zc -0.16 out at F 0.52 (0.21 world nearer than the old
  // -0.37 front; a real forward+lateral depth march that reads as a PRESENT
  // flanking city, verified 0% occlusion of the hall facade + winch disc). The
  // HARD WALL is the real-time radius cap: F+width must stay <= ~0.752 (the
  // per-vertex page-turn step is PURE page-sweep = rfar * dtheta, independent of
  // standDeg/envelope), and the wide 3.2-3.5:1 delivered strip art binds
  // width = height*artAspect — so a literal 2x height (~0.16) would need width
  // ~0.55, forcing the inner edge to radius ~0.20 (INTO the keep, the opposite of
  // "toward the sides"). Infeasible; the frontier gain is ~+29% apparent size at
  // rfar 0.752, not 2x. Bench Y1-Y6 all green (fold-flat, keep D-G2,
  // row/fringe/winch-disc D-G2, real-time 3% margin, fits-page, pinned-camera
  // sightline 63% visible). Slot->strip aspect per the prepare-art FAN_OUT
  // (a-strips 2.956 -> l0/r1, b-strips 3.484 -> l1/r2, c-strips 3.185 -> l2/r0).
  // E3 s4 RING (scenes/s4-scene-pack.md §4a): the three legacy rows per page are
  // the ring's REAR stations (the far rim, upstage of the keep at zc -0.52/-0.38/
  // -0.16); rows 3-4 below are the NEW downstage arms that turn a flanking city
  // into a radial amphitheater sweeping around to the reader's apron. Same
  // mechanism, same envelope class, zero new physics — the pack's R1 amendment
  // proved the facade-plate "ring arms" idea geometrically dead (plate-overhang
  // wedge excursion 0.070 vs 0.02 tol), so the ring is built from the page-riding
  // family this spread already fields. Bench .superpowers/sdd/bench/e3s4-ring.mjs.
  //
  // R3 LAW UPGRADE, and the reason these rows may finally be TALL: the real-time
  // rotation-radius cap is hypot(F + width, height * sin(stand)) <= 0.752, NOT the
  // flat F + width the old reading used. The 0.107 height era was bound by the
  // delivered 3.2:1 strip ART aspect, not by physics; at F+w 0.70 the honest cap
  // allows height up to ~0.28. The mid arms take 0.16 (1.5x the old rows) and land
  // at radius 0.700-0.740.
  { id: 'ch3-skyline-l', kind: 'backdrop', role: 'scenery', mech: 'skyline', side: 'left', rows: [
    { F: 0.43, zc: -0.52, height: 0.1089, width: 0.3219, standDeg: 64 },
    { F: 0.46, zc: -0.38, height: 0.0838, width: 0.292, standDeg: 64 },
    { F: 0.52, zc: -0.16, height: 0.0728, width: 0.2319, standDeg: 64 },
    // ring-mid left arm: dovecote facade, the ring's tallest station — biggest
    // portals, most amber-lit windows, the parapet raven rank facing spine-ward.
    { F: 0.44, zc: 0.12, height: 0.16, width: 0.26, standDeg: 64 },
    // ring-front gate wall (LEFT PAGE ONLY; the right page's front station is the
    // dispatch desk). F 0.55 is RAY-GATED, not chosen for looks: inboard variants
    // (F 0.42-0.48) occluded 12-15% of the winch disc rim from the pinned camera;
    // at 0.55 it is 3.1% (bench C3).
    { F: 0.55, zc: 0.575, height: 0.1, width: 0.19, standDeg: 64 },
  ] },
  { id: 'ch3-skyline-r', kind: 'backdrop', role: 'scenery', mech: 'skyline', side: 'right', rows: [
    { F: 0.43, zc: -0.52, height: 0.1011, width: 0.322, standDeg: 64 },
    { F: 0.46, zc: -0.38, height: 0.0988, width: 0.2921, standDeg: 64 },
    { F: 0.52, zc: -0.16, height: 0.0666, width: 0.232, standDeg: 64 },
    // ring-mid right arm — the left arm's mirror (art shares one drawing, flipped).
    { F: 0.44, zc: 0.12, height: 0.16, width: 0.26, standDeg: 64 },
  ] },
  // THE GATEHOUSE (s4 pack §4a-C): a slender strip-erected dovecote tower where
  // the painted post-road enters the ring — the right page's vertical accent,
  // balancing the winch's semaphore mast on the left. Its legality is a Z-BAND
  // trick: the keep's hall wall plane sweeps lateral 0 -> 0.40 while opening, but
  // only within z <= |0.34|, and this tower's fold footprint lives in z
  // [0.38, 0.58] — z-disjoint by 0.02 (bench C2), which is what makes a tower
  // standing in mid-court legal at all. Radial band [0.30, 0.42] threads the same
  // corridor: outside the balcony's lateral sweep (<= 0.26), inside the dial
  // paper (radial >= 0.49). The default fold sign lays the leaf along +z from the
  // hinge, so hingeZ 0.38 puts the footprint exactly in band (no mirror needed).
  { id: 'ch3-ring-tower', kind: 'midground', role: 'figure', mech: 'stripflap',
    side: 'right', anchor: 0.2, anchorZ: 0.48, slot: 0.26, slotZ: 0.48,
    hingeX: 0.36, hingeZ: 0.38, width: 0.12, height: 0.2 },
  // THE TOWER-HOIST WINCH (derive-keep-winch.mjs) — the E-G6 composed-machine
  // moment. A die-cut disc hub-riveted into the LEFT page (hubD 0.34, hubZ 0.30,
  // discR = crankR = 0.13, pin on the rim) that the reader TWISTS; a Scotch-yoke
  // crank drives THREE staggered outputs in sequence off one drag — the
  // semaphore paddle up (engages 0deg), the roost-mouth shutters ajar around the
  // loft (55deg), the counterweight sash-weight descending the hall flank (81deg).
  // THETA_MAX 112.6deg, one comfortable winding drag; release HOLDS the twist
  // (H4, the disc remembers). RIGID-FOLD re-derivation (2026-07-16): the iris is
  // 4 shutters hinged on the loft walls (off-wall reach 0.10*sin(deploy)*E ->0 at
  // close, riding the folding wall), and the counterweight is an IN-PLANE
  // SASH-WEIGHT that descends WITHIN the hall flank-wall plane (zero off-wall
  // reach — winding-insensitive and always wedge-contained; bench N8). Both fold
  // flat with the folding keep walls. The two `host` boxes MUST match the keep's
  // loft + hall stories (asserted by the winch test).
  {
    id: 'ch3-keep-winch', kind: 'hero', role: 'scenery', mech: 'keepwinch', side: 'left',
    // Disc moved OUT to hubD 0.50 so it clears the re-massed hall flank (a 0.40)
    // and reads on the open left page beside the keep; discR/crankR 0.13 hold the
    // proven THETA_MAX 112.6deg and cam behaviour. (At the low composition camera
    // a page-flat handle foreshortens; it reads full at the interaction camera.)
    hubD: 0.5, hubZ: 0.3, discR: 0.13, crankR: 0.13,
    // Semaphore mast lifted to baseX 0.96 to sit just above the re-massed
    // structural crown (~0.90) so the paddle reads over the crest. armHalfW is
    // the at-close off-page residual the N4/N8 fold-flat gates ride on; 0.0195
    // leaves a 2.5% margin under the 0.02 paper-thickness tol.
    semaphore: { L: 0, sMax: 0.09, range: (90 * Math.PI) / 180, baseX: 0.96, armLen: 0.1287, armHalfW: 0.0195 },
    // Iris + counterweight hosts RE-STATIONED to the re-massed LOFT story
    // (a 0.27, height 0.18, z +-0.20, baseH 0.3648 = hall.H 0.1799 + gallery.H 0.1849).
    // Both must equal the keep's loft story (asserted by popup-keepwinch.test).
    iris: { L: 0.055, sMax: 0.075, range: (68 * Math.PI) / 180, bladeLen: 0.1, host: { mech: 'box', a: 0.27, height: 0.18, z0: -0.2, z1: 0.2, roof: 'flat', capFront: true, capBack: true, baseH: 0.3648 } },
    // Counterweight on the LOFT FRONT CAP (belfry mouth), dead-center in the
    // reading sightline; descends within the cap plane (zero off-plane reach).
    counterweight: { L: 0.11, sMax: 0.07, range: 1, host: { mech: 'box', a: 0.27, height: 0.18, z0: -0.2, z1: 0.2, roof: 'flat', capFront: true, capBack: true, baseH: 0.3648 } },
  },
  // KEPT: the fore-edge low wall (the dispatch-yard foreground), a jutting
  // v-fold at the fore edge — the spread's nearest plane framing the keep, its
  // scalloped painter reading as the yard's front wall until real art lands.
  { id: 'ch3-fringe', kind: 'foreground', role: 'scenery', mech: 'vfold', apexZ: 0.66, vDir: 1, phiDeg: 84, rhoDeg: 88, width: 1.1, height: 0.155 },
  // THE DISPATCH DIAL (E2.2 Batch B — the book's first VOLVELLE; Birmingham mech
  // 103 THE HUB + 104 ROTATING WINDOW; bench derive-volvelle.mjs V1-V10). A
  // reader-spun raven dial riveted flat into the RIGHT page (the dispatch yard),
  // MIRRORING the winch's crank knob on the left — winch left, dispatch dial
  // right. The reader twists the dial (the winch/knob H4 idiom: pointer angle
  // about the hub, release HOLDS the twist) and raven silhouettes + route glyphs
  // cycle through the three die-cut windows of the static card over it — "four
  // billion ravens routed by one wheel." Release clicks the sectors into their
  // windows (45deg detents, snap ease). A coplanar disc lies flat at ANY
  // rotation, so the dial simply rides the folding page (no envelope) and folds
  // dead flat at close — the book remembers the twist through page turns. Second
  // user-driven piece on s4 beside the winch by DESIGN: a windowed dial is a new
  // mechanism FAMILY (G1), reads distinct from the crank machine, and sits on the
  // opposite page. hubD 0.60 seats the dial in the open lower-right yard: its
  // spine-side swept corner (0.60 - 0.11*sqrt2 = 0.44) clears the keep's
  // full-open hall wall (x=0.40) with margin, and it reads clear of the keep at
  // the real rest (where the near-flat book collapses the keep to x~0.02). hubZ
  // 0.36 sits downstage of the skyline, upstage of the fringe (z 0.60+). Art:
  // ch3-dispatch-dial (8 sectors) + ch3-dispatch-card (3 windows + thumb-tab).
  {
    id: 'ch3-dispatch', kind: 'foreground', role: 'scenery', mech: 'volvelle',
    side: 'right', hubD: 0.6, hubZ: 0.36, radius: 0.11, sectors: 8,
    windows: [
      { psiDeg: 45, halfWidthDeg: 16, rMid: 0.62, rHalf: 0.22 },
      { psiDeg: 90, halfWidthDeg: 16, rMid: 0.62, rHalf: 0.22 },
      { psiDeg: 135, halfWidthDeg: 16, rMid: 0.62, rHalf: 0.22 },
    ],
  },
]

// Chapter IV (the Batch-1 real-art spread, the physics-benchmark subject):
// the four painted pieces keep their exact benchmark geometry — sizes
// re-derived from the trimmed art's true aspect ratios (backdrop 1499x584,
// midground 1465x363, hero 949x741, foreground 1422x280) so every panel
// displays its print undistorted. One storytelling child joins them:
// coins spilling off the dragon's own fold (placeholder art until Batch-2).
const CH4_LAYERS: readonly SceneLayer[] = [
  // E3 s5 NOCTURNE MASSIF (pack §4; bench e3s5-mfoldrange.mjs ALL GREEN):
  // the NEW mfoldrange family — ONE card carrying 4 width-graded dune ranks
  // at distinct apexZ stations, painted gussets between them as the valley
  // floor. Replaces the retired ch4-backdrop + ch4-midground flat walls.
  // Phi graded 82/84/85/86 back->front = the closed-form BLOOM WAVE (front
  // ranks complete later, from angle grading alone); creaseU alternates
  // 0.44/0.60/0.35/0.65 for the witch-ref diagonal sweep; width 2.0 -> 1.5
  // front-narrowest (mech 118 law). Art constraint (bench G-E): r3's
  // silhouette dips <= 0.36 inside |x| < 0.45 — the notch that frames the
  // gold-foil dragon as the one glowing thing in a dark spread.
  // BUILD-LANE DIVERGENCE from the pack table: r4 width 2.0 -> 1.82 and r3
  // 1.85 -> 1.80. The pack's off-center creases put a 0.56/0.60 panel share
  // on one page, and at book-closed that panel's flat reach (glueLen*sin phi
  // + height*sin(phi+rho)) ran past the fore edge (1.245/1.177 > PAGE_W
  // 1.15) — the A4 closed-containment gate the derivation bench never
  // sampled. Trimming width (not creaseU, not heights) keeps the diagonal
  // sweep, the crest stack, the notch, and the bloom wave bench-identical.
  // Second divergence — the STATION/HEIGHT schedule is re-derived against
  // the KEPT hoard, which the pack's schedule never collision-checked
  // (bench G-D only sampled rank-vs-rank). The hoard's strut planes sweep
  // the spine channel (lateral -0.22..+0.17, up to y 0.55, deck to 0.68)
  // across z in [-0.3, -0.2], and a wall rank's crest SWEEPS z by
  // +-cot(lambda)*height ~ +-0.26..0.38*h between full open (lambda ~73-79
  // deg, leaning away from its vDir) and the tilted rest (lambda ~101-111
  // deg, leaning past vertical the OTHER way). No wall taller than ~0.3x
  // its clearance can stand near the slab, from either side, with either
  // vDir — so the chain alternates mountain/valley (the TRUE Birmingham
  // M-fold section): the tall back pair folds -1 and lives fully BEHIND
  // the slab (r4 -0.46 -> -0.50 h 0.82; r3 -0.33 -> -0.44 h 0.56 -> 0.50),
  // the short front pair folds +1 and lives fully IN FRONT (r2 -0.21 ->
  // -0.125, h 0.36 -> 0.22; r1 -0.10 -> -0.095, h 0.22 -> 0.18), each
  // pair parallel-leaning so it never self-converges. Angles, creaseU
  // diagonals, and the phi-graded bloom wave are pack-verbatim.
  // gussetReach 0.12: the valley-floor prints stay inside the spine channel,
  // clear of the hoard platform's strut glue (0.14 from the spine) whose
  // bays sit between the r3/r2 stations.
  { id: 'ch4-range', kind: 'backdrop', role: 'backdrop', mech: 'mfoldrange', vDir: -1, gussetReach: 0.12,
    ranks: [
      { apexZ: -0.50, phiDeg: 82, rhoDeg: 88.5, creaseU: 0.44, width: 1.82, height: 0.82 },
      { apexZ: -0.44, phiDeg: 84, rhoDeg: 88.5, creaseU: 0.60, width: 1.80, height: 0.50 },
      { apexZ: -0.125, phiDeg: 85, rhoDeg: 88.5, creaseU: 0.35, width: 1.70, height: 0.22, vDir: 1 },
      { apexZ: -0.095, phiDeg: 86, rhoDeg: 88.5, creaseU: 0.65, width: 1.50, height: 0.18, vDir: 1 },
    ] },
  { id: 'ch4-hero', kind: 'hero', role: 'figure', mech: 'vfold', apexZ: 0.06, vDir: 1, phiDeg: 52, rhoDeg: 80, width: 0.794, height: 0.62 },
  // The gilded vault-ring AUREOLE: a guilloché arc dress overhanging the
  // hero's right panel behind the dragon's head — preciousness by framing
  // (Cinderella-carriage grammar), zero DOF, zero solver work.
  { id: 'ch4-aureole', kind: 'hero', role: 'scenery', mech: 'dress', parentId: 'ch4-hero', seat: 'right', u: 0.04, v: 0.34, width: 0.34, height: 0.30 },
  { id: 'ch4-coins', kind: 'hero', role: 'scenery', mech: 'child', parentId: 'ch4-hero', mount: 0.22, vDir: -1, phiDeg: 60, rhoDeg: 83, width: 0.24, height: 0.24 },
  // VOLUMETRIC: an open treasure chest in front of the dragon — the
  // book's HOLLOW box (open top, no backbone): the reading camera looks
  // straight down into a raw-paper interior (benchmark B16).
  { id: 'ch4-chest', kind: 'backdrop', role: 'story', mech: 'box', a: 0.12, height: 0.12, z0: 0.34, z1: 0.46, roof: 'open' },
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
  { id: 'ch4-hoard', kind: 'midground', role: 'story', mech: 'platform', strutA: { glueL: 0.22, glueR: 0.14, rise: 0.4, spans: [[-0.3, -0.26], [-0.24, -0.2]] }, strutB: { glueL: 0.14, glueR: 0.22, rise: 0.4, spans: [[-0.3, -0.26], [-0.24, -0.2]] }, qA: 0.21, qB: 0.21, deckZ0: -0.3, deckZ1: -0.2 },
  // D1 TAB PIECE: the hoard's loose gold rises as a MOUND on the right
  // page, its tab creeping out of the fore edge as the spread blooms —
  // the treasure literally grows when the book opens. Strip-driven family
  // beyond the satchel (palette law), opposite side from ch5's table.
  // D6 THE HAND re-site: the old z-band (0.08..0.36) put the fore-edge tab
  // exactly behind the right-column HTML plaque (tab screen box inside the
  // card's box), so the pull handle was hidden at grab time. The band moved
  // DOWNSTAGE to 0.26..0.54 (tab centre 0.40) so the tab projects clear
  // BELOW the plaque's bottom edge at the resting/grab-hover view (probe:
  // +41px neutral, +10px at grab-hover; the mound's parallax swing still
  // grazes the plaque only at the mouse-far-corner extreme — inherent to the
  // book's tilt, not a grab-time state). Still clear of the midground wall's
  // glue (z ~0.04) and the spine-hugging chest (x <= ~0.24; z overlap is at a
  // disjoint x, no crossing). Ships at the same 218/13 spread-5 ceilings.
  { id: 'ch4-goldpile', kind: 'midground', role: 'scenery', mech: 'tabpiece', side: 'right', form: 'mound', hingeX: 0.9, z0: 0.26, z1: 0.54, legW: 0.26, liftDeg: 55 },
  // E2.2 PULL-TAB DISSOLVE (Birmingham 92/93/119; bench derive-dissolve.mjs):
  // the book's first paper CROSSFADE and a genuinely NEW mechanism family for
  // G1. A page-flat rack of 6 venetian SLATS in the open sand field on the LEFT
  // page — the mirror of the right-page goldpile tab (a second fore-edge tab,
  // symmetric tab vocabulary). The reader pulls the tab and the shared flip
  // angle tau carries rolling DUNES (a distant camel-train) through the edge-on
  // "blinds close" over to the dragon's GOLD hoard — the transmutation. Both end
  // states are coplanar (volvelle-class, no fold-flat envelope); the release
  // snaps to a pure end {dunes, gold} the book remembers. Placed downstage-left
  // clear of the spine-hugging chest (d<=0.24), the deep hoard shelf (z<=-0.18)
  // and the hero dragon's base footprint (d<=~0.32) — it does NOT touch the
  // ch4-hoard strut region behind the dragon.
  // Promoted to the spread's THESIS (celebrated brass ▼PULL▼ affordance) and
  // turn-culled (Batch C-3, the dial-class lever): interaction-only + page-
  // flat, it stops drawing through the fast middle of a turn and ramps back
  // inside the landing-settle window (~13 draws returned on the s4->s5 peak).
  { id: 'ch4-dissolve', kind: 'midground', role: 'story', mech: 'dissolve', side: 'left', d0: 0.46, d1: 0.98, z0: 0.2, z1: 0.6, slats: 6, stroke: 0.14, turnCull: true },
  // The ember-sashed camel caravan FRIEZE (replaces the retired flat
  // ch4-foreground fringe): one linked-chain cutout walking INTO the picture
  // toward the PULL tab. Art constraint (pack §4.2): silhouette dips <= 0.06
  // in x in [-0.75, -0.44] (camel-leg gaps) to keep the placard sightline.
  { id: 'ch4-frieze', kind: 'foreground', role: 'scenery', mech: 'vfold', apexZ: 0.62, vDir: 1, phiDeg: 84, rhoDeg: 88, width: 1.5, height: 0.16 },
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
  { id: 'ch6-strongbox', kind: 'backdrop', role: 'story', mech: 'box', a: 0.095, height: 0.1, z0: 0.38, z1: 0.5, roof: 'flat' },
  // RECURSION (C4v2): the bank's griffin crest standing ON the strongbox lid.
  { id: 'ch6-crest', kind: 'midground', role: 'scenery', mech: 'rider', parentId: 'ch6-strongbox', seat: 'boxLid', mountZ: 0.42, vDir: 1, phiDeg: 29, rhoDeg: 43, width: 0.09, height: 0.08 },
  // Dress on the strongbox: a wax seal on the front cap, minted coins heaped
  // at the side-wall base (v=0 — no overhang below the page-glued edge).
  { id: 'ch6-strongbox-seal', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch6-strongbox', seat: 'capFrontL', u: 0.02, v: 0.03, width: 0.07, height: 0.07 },
  { id: 'ch6-strongbox-coins', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch6-strongbox', seat: 'wallL', u: 0, v: 0, width: 0.12, height: 0.06 },
  // PLAYABLE (E2.2 s7, charter gate G4): a lift-the-flap TREASURE COFFER out on
  // the open right-page ground — the reader lifts a teal-steel strongbox lid and
  // an aurora-lit gold hoard glows inside (the Northern Treasury made drivable).
  // REUSES the shipped liftflap family (popup-liftflap solver/layer verbatim)
  // with a DIFFERENT read — one chest lid, not the s2 numbered doors — which also
  // serves variety. Page-rooted, NOT on the standing strongbox: that box self-
  // folds (its own lid/caps crease) so a rigid flap glued to it would fight the
  // fold, and it shows the reading camera mostly its front cap (its top is a
  // foreshortened sliver), so an up-opening lid there reveals edge-on. Page-flat,
  // the lid + open interior read square-on at the lid-dominant reading camera
  // (the winch/volvelle/keyboard precedent). SEATED in the eye-proven VISIBLE
  // right-page zone (d~0.42-0.70, z~0-0.24): the first spot at z~0.44 rendered
  // occluded behind the fringe/figures (a G4 discoverability miss caught in the
  // interaction capture); out here it reads clear, right of the treasury, and
  // forms its own depth band (C3v2 ratchet 5 -> 6). A visible gold hasp on the
  // lid's fore edge is the affordance. The door HOLDS its open/shut state (H4);
  // E(beta) eases the lid shut at book close. Bench-verified in derive-s7lid.mjs
  // (L1-L9 + L5b strongbox no-clip). The standing strongbox stays (massing + the
  // 6/6 box census).
  {
    id: 'ch6-coffer', kind: 'foreground', role: 'scenery', mech: 'liftflap', side: 'right',
    hingeD: 0.46, leafLen: 0.24, boardD0: 0.42, boardD1: 0.7, boardZ0: 0.0, boardZ1: 0.24,
    doors: [
      { z0: 0.01, z1: 0.23, reveal: 'key', plate: 1 },
    ],
  },
  // FLOATING TIER (C3v2): the treasury's glass gallery — a BRIDGE platform in
  // the approach lane behind the vault. COMPOSITION SPREAD-D: the treasury is
  // the book's TALLEST hero (0.91) and it LEANS RIGHT (skew -2), so a wide
  // deck raised on tall struts (rise 0.40, qA 0.28) crests near its shoulder
  // while its LEFT wing — deck and struts — swings toward the open left of
  // the leaning tower. Was a narrow one-sided TERRACE the treasury fully hid;
  // the wide bridge and the lean together give it a real reveal. Deep back
  // lane, so it keeps its own depth band.
  { id: 'ch6-steps', kind: 'midground', role: 'story', mech: 'platform', strutA: { glueL: 0.26, glueR: 0.14, rise: 0.4, spans: [[-0.32, -0.24], [-0.22, -0.14]] }, strutB: { glueL: 0.14, glueR: 0.26, rise: 0.4, spans: [[-0.32, -0.24], [-0.22, -0.14]] }, qA: 0.28, qB: 0.28, deckZ0: -0.32, deckZ1: -0.14 },
  { id: 'ch6-fringe', kind: 'foreground', role: 'scenery', mech: 'vfold', apexZ: 0.62, vDir: 1, phiDeg: 84, rhoDeg: 88, width: 1.3, height: 0.25 },
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
    hero: 'ch1-inn', // vfold, sweep 0.85
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
    hero: 'ch2-bee-a', // recursion (child), sweep 0.82 — the carrier bee
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
    showpiece: true, // E1 pilot — the Dispatch Keep (one grand structure)
    // D-G1/D-G8 signature MOTION moment = the interactive tower-hoist winch (the
    // E-G6 composed-machine, the board's "launch moment"): one twist drives three
    // staggered outputs. The keep is the E-G3 near-backdrop CENTERPIECE (a
    // separate visual gate), but a spine-centered structure rises rigidly rather
    // than swinging out, so the winch's interactive drive is the declared hero —
    // exempt from the page-turn sweep floor like the rest of the hand-driven
    // vocabulary (D-G8 "or the piece is interactive").
    hero: 'ch3-keep-winch',
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
    hero: 'ch4-goldpile', // tabpiece (strip-driven, exempt), sweep 1.27 — the hoard growing
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
    hero: 'ch5-lantern-b', // recursion (child), sweep 0.67 — a bazaar lantern
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
    hero: 'ch6-treasury', // vfold, sweep 0.97 — the northern treasury (the crescendo)
  },
]

// Pop-up layers for the three spreads that aren't a career chapter: the
// title page (spread 1) and the closing satchel/end pages (8, 9) — hand-
// tuned one-off decorative sets, since there's no career experience to
// derive them from. The end spread gets its raven as a child riding the
// letter's fold — the raven the closing line asks the reader to send.
// E2.2 OVERTURE MASSING (endpapers-composition lane, 2026-07-25): the title
// page was the book's palest, thinnest spread — a lone hero on empty parchment
// behind a washed-out banner (G3 pale/sparse + G6 thin, both honest FAILs).
// Rebuilt as a GRANDIOSE proscenium overture that promises the whole tale: a
// bold aged-parchment PROSCENIUM (the enlarged + rebaked banner — heavy walnut
// scroll-frame, gold rule, burgundy cartouche, painted-in pennant bunting AND a
// row of the six-kingdom heraldic shields), the boy hero + crest, the writer's
// QUILL still strip-erected at the fore edge (the spread's hero), and the far
// berm. NO net-new v-fold: title-border + title-hero stay the only two v-folds.
// (An earlier backdrop-fan "crown" was cut — occluded behind the proscenium at
// the lid-dominant camera; the six kingdoms are painted into the banner where
// the camera sees them.)
export const TITLE_LAYERS: readonly SceneLayer[] = [
  // THE PROSCENIUM (vfold, enlarged 1.3->1.55 + rebaked BOLD): the grand aged-
  // parchment banner-canopy framing the hero — heavy walnut scroll-frame, gold
  // rule, a burgundy title cartouche, painted-in pennant bunting along the top
  // rail, and a row of the SIX-KINGDOM heraldic SHIELDS across the cloth (the
  // promise of the realms, carried IN the banner). Was pale/thin; now the
  // overture arch. The six kingdoms ride the banner rather than a backdrop fan
  // because a spine-anchored fan behind this wider/taller spine-anchored
  // proscenium is fully occluded at the lid-dominant reading camera (verified
  // in the e28-r1 capture — cf. the "backdrop wings vs central tower wall" law).
  { id: 'title-border', kind: 'backdrop', role: 'backdrop', mech: 'vfold', apexZ: -0.22, vDir: -1, phiDeg: 84, rhoDeg: 88, width: 1.55, height: 0.6 },
  { id: 'title-hero', kind: 'hero', role: 'figure', mech: 'vfold', apexZ: 0.15, vDir: 1, phiDeg: 52, rhoDeg: 80, width: 0.38, height: 0.63 },
  { id: 'title-crest', kind: 'hero', role: 'scenery', mech: 'child', parentId: 'title-hero', mount: 0.24, vDir: 1, phiDeg: 62, rhoDeg: 84, width: 0.18, height: 0.13 },
  // D5 MASSING (silhouette review: the title was "a lone small cutout"). The
  // HERO is now the writer's QUILL erected by a hidden pull strip — the tale
  // being written as the book opens (stripflap, the spread's hero FAMILY: no
  // other extra can field it, and it's the future-interactive vocabulary so
  // it's exempt from the D-G8 sweep floor). Stood in profile at the fore edge,
  // downstage of the emblem in its own z-band (z >= 0.44) so, since spine
  // rotation preserves z, it never crosses the center cluster (extra-1 ceiling).
  { id: 'title-quill', kind: 'hero', role: 'figure', mech: 'stripflap', side: 'right', anchor: 0.2, anchorZ: 0.44, slot: 0.26, slotZ: 0.44, hingeX: 0.36, hingeZ: 0.44, width: 0.0887, height: 0.24 },
  // The far berm massing (ground swell — parallel fold, covenant: scenery,
  // rise <= 0.08, carries a rider) upstage behind the crown, a distant berm
  // with a wax-seal tuft. Own z-band (z <= -0.36) so it never crosses center.
  { id: 'title-swell', kind: 'backdrop', role: 'scenery', mech: 'parallel', glueL: 0.24, glueR: 0.24, rise: 0.05, z0: -0.62, z1: -0.48 },
  { id: 'title-swell-seal', kind: 'backdrop', role: 'scenery', mech: 'rider', parentId: 'title-swell', seat: 'tentRidge', mountZ: -0.55, vDir: -1, phiDeg: 32, rhoDeg: 52, width: 0.12, height: 0.095 },
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
  // DEPTH VISTA (E2.2 Batch B; bench derive-depthvista.mjs, all gates GREEN): an
  // ALL-WINGS graded tunnel-frame around the satchel hero — 3 page-rooted flap
  // PAIRS (near/mid/rear), each a single +z-facing cammed flap (the ch3-skyline
  // form; NO arches, NO raw-kraft risers), mirrored to both pages and graded in
  // warmth + scale + depth: near = warmest/largest front-flank, rear = coolest/
  // simplest innermost-visible (six-kingdoms horizon). Their shaped inner-top
  // arcs imply one receding vaulted aperture wrapping over the satchel. Page-
  // driven, folds dead flat at close. Frozen config VERBATIM from the bench.
  { id: 'satchel-vista', kind: 'backdrop', role: 'scenery', mech: 'depthvista',
    wings: [
      { key: 'near', F: 0.5, width: 0.42, height: 0.26, zc: 0.34, standDeg: 58 }, // FOREGROUND: broad warm tents, short
      { key: 'mid', F: 0.72, width: 0.3, height: 0.32, zc: 0.2, standDeg: 60 }, //   MIDGROUND: the road, taller (crest peeks)
      { key: 'rear', F: 0.82, width: 0.2, height: 0.4, zc: -0.2, standDeg: 62 }, //  DISTANT: tall narrow six-kingdom spires
    ] },
  // D5 MASSING (silhouette review: "inventory not scene — needs an anchor"):
  // the bag is GROWN into the clear anchor mass so the items read as spilling
  // FROM it rather than as a row of equals — hierarchy, not more pieces.
  { id: 'satchel-bag', kind: 'hero', role: 'scenery', mech: 'vfold', apexZ: -0.1, vDir: 1, phiDeg: 52, rhoDeg: 80, width: 1.0, height: 0.6 },
  // KINETIC (D4 wave 2): the Wayfinder's ASTROLABE, its star-dial spinning
  // open on the satchel flap — a die-cut disc riveted flat on the bag's right
  // panel (mech 76) that turns 130deg as the book opens. Rides the panel
  // coplanar, so it never collides; distinct drive from the standing compass
  // stripflap below (the palette law — no monoculture per spread).
  { id: 'satchel-astrolabe', kind: 'hero', role: 'scenery', mech: 'rotor', parentId: 'satchel-bag', seat: 'right', u: 0.23, v: 0.3, radius: 0.13, spinDeg: 130 },
  { id: 'satchel-burst', kind: 'midground', role: 'scenery', mech: 'fan', apexZ: 0.24, vDir: 1, members: [{ phiDeg: 17.2, rhoDeg: 31.5, width: 0.26, height: 0.26 }, { phiDeg: 31.5, rhoDeg: 48.7, width: 0.4, height: 0.34 }, { phiDeg: 45.8, rhoDeg: 65.9, width: 0.5, height: 0.36 }] },
  // The map table: gutter-bound, standing well out on the right page
  // (equal-height ridges keep its top level), the Router's Scroll
  // unrolled across it.
  { id: 'satchel-table', kind: 'midground', role: 'story', mech: 'platform', strutA: { glueL: 0.05, glueR: 0.55, rise: 0.05, spans: [[-0.62, -0.36]] }, strutB: { glueL: 0.18, glueR: 0.452, rise: 0.018, spans: [[-0.62, -0.36]] }, qA: 0.136, qB: 0.136, deckZ0: -0.62, deckZ1: -0.36 },
  { id: 'satchel-scroll', kind: 'midground', role: 'scenery', mech: 'dress', parentId: 'satchel-table', seat: 'deckB', u: 0.02, v: 0.05, width: 0.09, height: 0.16 },
  // The Ever-Sharp Sword: strip-erected frontal figure, mid-left.
  { id: 'satchel-sword', kind: 'hero', role: 'figure', mech: 'stripflap', side: 'left', anchor: 0.22, anchorZ: -0.3, slot: 0.3, slotZ: -0.3, hingeX: 0.38, hingeZ: -0.3, width: 0.1392, height: 0.4 },
  // The Wayfarer's Compass: strip-erected frontal dial, front-right.
  { id: 'satchel-compass', kind: 'midground', role: 'scenery', mech: 'stripflap', side: 'right', anchor: 0.2, anchorZ: 0.35, slot: 0.26, slotZ: 0.35, hingeX: 0.36, hingeZ: 0.35, width: 0.1679, height: 0.24 },
]
const SATCHEL_ACCENTS: readonly string[] = ['#c9a227', '#8a5a3b'] // gold + leather

const END_LAYERS: readonly SceneLayer[] = [
  // E2.2 EPILOGUE MASSING (endpapers-composition lane, 2026-07-25): the end
  // page was thin (G6 FAIL) — small scattered props on an empty desk behind an
  // ugly cold-green hill fan that clashed with the warm printed desk. Rebuilt
  // as the writer's WRITING-DESK vignette that CONVERSES with the page print's
  // candle, inkwell and wax seals: the letter grown into the clear centrepiece,
  // a warm fan of postmarked ROUTE-CARDS fanned behind it (the hero's letters
  // home — replacing the green hills), the raven LARGER and launching mid-flight
  // on a 45-degree kinetic arm ("the raven away"), a warm desk-edge foreground
  // band, and the removable ex-libris keepsake. NO net-new v-fold (the letter
  // stays the only one); routes are the fan hero, the raven trades its child
  // mount for the kinetic family.
  //
  // THE ROUTE-CARDS (fan hero, was end-hills): a warm fan of postmarked cards
  // fanning open behind the letter — the correspondence the closing line is
  // about. Deep own z-band (apex z <= -0.4) so, since spine rotation preserves
  // z, it never crosses the mid-page letter at any turn angle. Bloom outward.
  { id: 'end-routes', kind: 'backdrop', role: 'scenery', mech: 'fan', apexZ: -0.5, vDir: -1, members: [{ phiDeg: 40, rhoDeg: 66, width: 0.42, height: 0.19 }, { phiDeg: 50, rhoDeg: 74, width: 0.55, height: 0.22 }, { phiDeg: 60, rhoDeg: 82, width: 0.68, height: 0.24 }] },
  // THE LETTER (vfold, grown 0.75->0.85 into the clear centrepiece): the letter
  // the closing line asks the reader to answer — ruled hand, burgundy wax seal.
  { id: 'end-letter', kind: 'hero', role: 'scenery', mech: 'vfold', apexZ: -0.13, vDir: 1, phiDeg: 52, rhoDeg: 80, width: 0.85, height: 0.58 },
  // KINETIC (Birmingham mech 76): the hero's SIGNET SEAL, its heraldic rosette
  // turning 110deg as the letter unfolds — a die-cut disc hub-riveted flat on
  // the letter's left panel. Coplanar, so it adds ZERO collision footprint.
  { id: 'end-seal', kind: 'hero', role: 'scenery', mech: 'rotor', parentId: 'end-letter', seat: 'left', u: 0.2, v: 0.27, radius: 0.13, spinDeg: 110 },
  // THE RAVEN AWAY (kinetic 45-degree arm — Birmingham mech 73; was a small
  // child riding the letter fold): larger and LAUNCHING up off the desk in
  // front of the letter as the book opens — "send a raven". Its 45-fold arm
  // sweeps a clean quarter-turn; downstage own z-band, clear of the letter.
  { id: 'end-raven', kind: 'hero', role: 'figure', mech: 'kinetic', apexZ: 0.45, vDir: 1, phiDeg: 45, rhoDeg: 88, armW: 0.26, armLen: 0.42, flapW: 0.16, flapLen: 0.16 },
  // (An earlier fore-edge desk-BAND ground swell was cut: on the spine
  // centerline it collided with the launching raven's arm at rest — A9 — and
  // its low parallel fold read as a chevron "paper airplane". The launching
  // raven and the removable keepsake carry the foreground; the letter/routes/
  // seal carry mid+back. The desk itself is the printed page ground.)
  // D6 REMOVABLE KEEPSAKE (the book's first removable piece; law H7/H8): the
  // reader's own EX-LIBRIS — a wax-sealed card of the six kingdoms — tucked in
  // a printed pocket on the right endpaper. Pull its dog-eared fore corner and
  // it draws out coplanar with the page, detaches past the fore-edge slit, and
  // settles tilted on the desk; grab it, or turn the page, and it auto-returns
  // home. The seat is authored in TRUE WORLD coordinates (desk-fixed) — the
  // renderer transforms it into the popup group's live frame each frame, so the
  // card lies genuinely flat on the static desk (no parallax tilt / group Y
  // offset). RE-SITED (D6 polish) to { x .5, y .03, z .95 }: the bench seat
  // { x .33, z 1.06 } projected onto the bottom-centre nav pill; this sits it
  // downstage-RIGHT on the lit desk between the book's fore corner and the
  // right column — clear of both HTML columns, the book silhouette, AND the nav
  // pill (probe: screen px[893,1058] py[759,829], all zones clear). y .03 rests
  // the card's near edge on the desk (tilt 22deg toward the camera, law H8).
  { id: 'end-keepsake', kind: 'foreground', role: 'scenery', mech: 'keepsake', side: 'right', z0: 0.245, z1: 0.395, cardL: 0.312, seat: { x: 0.5, y: 0.03, z: 0.95, tiltDeg: 22 } },
]
const END_ACCENTS: readonly string[] = ['#641e26', '#5a6470'] // seal burgundy + slate

export const EXTRA_SPREAD_LAYERS: Readonly<Record<number, readonly SceneLayer[]>> = {
  1: TITLE_LAYERS,
  8: SATCHEL_LAYERS,
  9: END_LAYERS,
}

/** D-G1/D-G8 hero declaration for the non-chapter spreads (same contract as
 *  Chapter.hero). Title fields the stripflap family (the erected quill,
 *  strip-driven so exempt from the sweep floor), satchel the platform (the
 *  map table, sweep 0.78), end the LETTER unfolding (vfold — the epilogue's
 *  signature moment; the route-cards fan had to be shrunk deep to clear the
 *  grown letter and no longer sweeps the wow floor, and the kinetic raven's
 *  max-corner sweep sits just under it). */
export const EXTRA_SPREAD_HERO: Readonly<Record<number, string>> = {
  1: 'title-quill',
  8: 'satchel-table',
  9: 'end-letter',
}

/** The declared hero layer id for any spread (chapter or extra), or undefined
 *  for the coverless spread 0. */
export const heroForSpread = (spread: number): string | undefined =>
  chapterForSpread(spread)?.hero ?? EXTRA_SPREAD_HERO[spread]

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
