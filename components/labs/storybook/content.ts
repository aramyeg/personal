import { experiences } from '@/data'
import type { Experience } from '@/types'
import type { LayerGeom } from '@/components/labs/storybook/book/popup-mechanics'
import type { IdleTag } from '@/components/labs/storybook/book/idle-life'
import { buildSwarmStruts } from '@/components/labs/storybook/book/popup-swarmarc'

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
 *   - 'oanave' (E3 s7): an origamic-architecture nave rank — a v-fold wall
 *     host (kinematics verbatim) with a die-cut portal aperture and OA
 *     relief strata cut FROM the sheet (Birmingham 37): zero glue, driven
 *     purely by the host's own central-fold dihedral (book/popup-oanave.ts).
 *  Constraints enforced by tests: pieces stand when open, fold exactly
 *  flat when closed, stay inside the closed page ("nothing sticks out"),
 *  never tear or jam, and children keep their glue on the parent's paper.
 */
/** IDLE LIFE tag (BW-2 — every blind reader independently: "the scene is
 *  completely static when the pointer is still... for a page selling
 *  'enchanted', the diorama is frozen"). An OPTIONAL, purely decorative marker
 *  on a small ACCENT piece: a hanging sign, a bee, a bird, a glint of brass.
 *  book/idle-life.ts turns it into a sub-degree rigid swivel, a sub-millimetre
 *  slide or a brightness flicker that dies to exactly zero at fold-flat and
 *  during a turn. Three standing rules, all gated by
 *  __tests__/labs/storybook/idle-life.test.ts:
 *   - NEVER on a grab handle (a tagged handle trembles under the reader's own
 *     hand and fights the drive it is being dragged by);
 *   - NEVER on a structural hero — backdrop walls, facades, keeps, the
 *     treasury, the nave ranks. Those pieces ARE the architecture; architecture
 *     that shivers reads as a broken mechanism, not as air;
 *   - only on families the generic two-quad renderer poses, or the tag is dead
 *     paperwork.
 *  Deeper per-spread ambient art (smoke, candle halos, twinkle) belongs to the
 *  scene lanes; this is the draught in the room, nothing more. */
export type SceneLayer = { id: string; kind: LayerKind; role: LayerRole; idle?: IdleTag } & LayerGeom

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

// Chapter I — E3 s2 scene pack "The Inn of a Hundred Keys" (register R3
// THEATER-warm; .superpowers/sdd/scenes/s2-scene-pack.md, bench
// e3s2-reach.mjs 9/9). WELCOME — an enclosure opening toward the reader:
// a Birmingham-118 STAGE SET of three width-graded gutter-spanning valley
// folds (rear widest: mountain 1.9 > inn row 1.5 > gate 0.76), the full-
// span lamplit inn row as the hero plane carrying a dormer and the hanging
// key-sign on its crease (G6 multi-stage: folds on the fold) plus the
// great brass KEY rotor turning in the lock as the page opens, the open
// gate plane downstage, and the innkeeper's family strip-erected as ONE
// linked welcome rank in the courtyard air between them. The old
// single-sheet backdrop, the 0.72-wide inn painting with its two dress
// patches, the standalone sign v-fold and the fully-occluded yard platform
// are retired into this graded theater (v-fold count NET ZERO). The
// key-board playable, the stable box and the fore-edge wall are KEPT
// verbatim (repaint only).
const CH1_LAYERS: readonly SceneLayer[] = [
  // PLANE A — the sleeping mountain (rear, widest; the DIM plane). Solver
  // drift from the pack's pre-flight (phi 83/rho 88.8/skew -1.5/creaseU
  // 0.45/apexZ -0.52): that config's 5.8deg standing margin flops the crease
  // ~0.3 world TOWARD the reader at the near-flat rest pose, spearing plane
  // B's band, and its closed fold overreached the page (1.169 > 1.15).
  // phi 80/rho 88 (margin 8) with a centered crease stands the mountain up
  // (rest z <= -0.45), folds flat at 1.13, and the deeper apex keeps the
  // glue ends inside the page. Asymmetry moved to the painted crest.
  { id: 'ch1-mountain', kind: 'backdrop', role: 'backdrop', mech: 'vfold', apexZ: -0.55, vDir: -1, phiDeg: 80, rhoDeg: 88, creaseU: 0.5, width: 1.9, height: 0.92 },
  // PLANE B — the inn row (mid, THE HERO): edge-to-edge lamplit facades at
  // phi 74, a real toward-reader cant so the window art reads at the
  // lid-dominant camera and its children get a live crease dihedral.
  // Role 'scenery' (a stage-set plane, not a volumetric prop): the pack's
  // R2 covenant-allowlist rename predates the C1v2 census — a story-role
  // v-fold now needs >= 2 dress patches, and this scene retires the inn's
  // dresses into the plane's own paint per the stage-set grammar.
  { id: 'ch1-inn-row', kind: 'hero', role: 'scenery', mech: 'vfold', apexZ: -0.2, vDir: -1, phiDeg: 74, rhoDeg: 86, skewDeg: 2, creaseU: 0.58, width: 1.5, height: 0.68 },
  // Folds on the fold (G6): the attic dormer and the hanging key-sign ride
  // the inn row's own crease — Reinhart's V-fold off a V-fold.
  // (dormer mount dropped 0.66 -> 0.63: the child's glue edge runs ~0.030
  // up the crease past its mount, and the pack's 0.66 left it 0.010 off the
  // end of B's 0.68 crease — A11 glue-on-the-paper.)
  { id: 'ch1-dormer', kind: 'midground', role: 'scenery', mech: 'child', parentId: 'ch1-inn-row', mount: 0.63, vDir: 1, phiDeg: 64, rhoDeg: 85, width: 0.16, height: 0.14 },
  // IDLE (BW-2): the key-sign HANGS from the inn crease, which is the one
  // thing on this spread a draught would obviously move. Sway swivels the whole
  // die about its own crease axis — a shop sign turning on its irons, ~1.2deg,
  // which walks its outer corner about 1.5 thousandths of a page width.
  { id: 'ch1-sign', kind: 'hero', role: 'scenery', mech: 'child', parentId: 'ch1-inn-row', mount: 0.3, vDir: 1, phiDeg: 62, rhoDeg: 84, width: 0.14, height: 0.16, idle: { kind: 'sway' } },
  // The first of a hundred keys standing proud of the great door AS the
  // book opens. The pack's rotor form is GEARED-DEAD here (honest
  // rejection, the s6 mech-37 precedent): any rivet-riding decoration on a
  // wall-regime stage panel inherits the panel's late bloom and measures
  // max/mean ~3.5-4.1 against the rotor family's 2.0 character ceiling
  // (measured across phi 56..74 and spin/radius/restAt sweeps). A third
  // small fold on the door crease keeps the beat kinetic with a family
  // whose ceiling was calibrated on exactly this seat regime.
  // IDLE (BW-2): the great brass key gets the LIGHT treatment, not motion — a
  // lamplit inn row is exactly where polished brass would breathe in and out of
  // the lamp. Glint leaves the geometry alone, so the key stands as still and
  // proud as the scene wants it to while the spread stops being pixel-frozen.
  { id: 'ch1-key', kind: 'hero', role: 'scenery', mech: 'child', parentId: 'ch1-inn-row', mount: 0.1, vDir: 1, phiDeg: 62, rhoDeg: 84, width: 0.11, height: 0.09, idle: { kind: 'glint' } },
  // PLANE C — the open gate (front, narrowest): the gates open toward the
  // reader exactly when the spread opens. Its 0.376 panel x-reach + 0.02
  // margin clears the kept key-board at boardD0 0.40 (bench C1).
  // IDLE (BW-2, WAVE-2 accent pass): the two gate lanterns are the only OPEN
  // FLAMES the reader stands next to, so the gate plane takes the 'glint' — a
  // sub-visible brightness breath on the print, which is what a lantern in a
  // yard does and what a rigid die-cut is allowed to do. NOT sway: this plane
  // is a stone gateway.
  //
  // The chimney smoke could NOT be tagged and is a deliberate non-fix: the
  // smoke curl is cut into ch1-inn-row's OWN silhouette (innRowStage builds it
  // into the roofline path), so the only handle on it is the hero plane itself
  // — and idle-life forbids tagging a spread hero. Giving the smoke its own
  // motion means a new crease-child die and a new reach proof, which is a scene
  // change, not an accent tag.
  { id: 'ch1-gate', kind: 'midground', role: 'scenery', mech: 'vfold', apexZ: 0.16, vDir: -1, phiDeg: 82, rhoDeg: 87.5, creaseU: 0.5, width: 0.76, height: 0.42, idle: { kind: 'glint' } },
  // The WELCOME RANK — innkeeper with lantern, spouse with the enchanted
  // ledger, waving child, dog, die-cut as ONE linked chain and stood up
  // frontal by a hidden strip under the floor (law L5). Tip radius 0.576;
  // z band 0.23..0.57 clears the gate slab by 0.07 and the frieze by 0.09.
  // S2-5 THE RANK NOW HAS A PAYOFF. Once the book-wide hit fixes made this
  // handle answer at all, what it did was WRONG: page-driven, the strip is taut
  // and the family is handed over already at the 90deg anti-flip stop, so the
  // only gesture available was pushing the welcome party face-down through flat
  // onto the cobbles — and below ~32deg a flap's own tip projects BELOW its
  // hinge at this camera, so the last of that travel reads as the family
  // inverting (the s6 tea-corner finding, same class).
  //
  // The s6 opt-ins, on this piece: the strip ships SLACK (`restDeg`) and the
  // READER raises the rank. At rest the family leans back at 44deg — clearly
  // standing, well above the inversion crossing, so the courtyard is never
  // empty of figures — and pulling them to 90deg brings the whole linked chain
  // upright: lantern raised, ledger out, child waving. That IS the chapter
  // ("he was welcomed"), it is the direction the story runs in, and both ends
  // detent so the piece clicks home instead of asymptoting.
  //
  // ROUND-2, S2R2-3: THE RANK LIES FORE AND IS GRABBED OFF ITS OWN TIP CIRCLE.
  // A blind re-reader put 900 px of drag through this handle and got "one tiny
  // change and then saturation — the figure card shifts about 8-12 px and tips
  // a couple of degrees; every offset from -50 px to -900 px produces the
  // identical pixel diff". Both halves of that were one geometric fact: the
  // rank's swing plane is the y-z plane, which the pinned camera (parked on
  // x = 0) sees EXACTLY EDGE-ON.
  //
  // (1) WHAT THE READER SEES. The travel note below was derived with the tip's
  // screen height as R*443*sin(A - 33.3deg) — monotone, ~60 px across the
  // window. That is the FORE-lying sign, and `flat = hinge x n` points fore only
  // on the RIGHT page. This is a LEFT-side flap, so it shipped aft-lying, whose
  // screen height is R*443*sin(A + 33.3deg): a sinusoid PEAKING AT 56.7deg,
  // which the window [44, 90] straddles. Both of its ends therefore sit at
  // nearly the same screen height and the whole 46deg of travel measured 16 px
  // worst-vertex. `lie: 'fore'` restores the sign the derivation assumed and the
  // travel is ~60 px again, monotone, with the rank bowing toward the reader at
  // rest and coming upright as it is raised. The z footprint SHRINKS into the
  // band this piece was already cleared in (tip 0.40..0.551 against the old
  // 0.23..0.57), so no clearance argument is reopened.
  //
  // (2) WHAT THE READER'S HAND DOES. The swing plane containing the view
  // direction also breaks the pointer projection: |ray . planeNormal| = 0.10, so
  // ~20 px of sideways drag swept the whole window and the other way missed the
  // plane and wrote nothing. `grabProjection: 'cylinder'` reads the angle off
  // the flap's own tip circle instead (handle-projection class B1-C), which is
  // conditioned by the circle's angular width from the camera rather than by a
  // vanishing dot product: ~1:1 with the paper, live in both directions.
  //
  // ROUND-2, S2R2-3: THE RANK IS SKEWED UNTIL A READER CAN SEE IT MOVE.
  // A blind re-reader put 900 px of drag through this handle and got "one tiny
  // change and then saturation - the figure card shifts about 8-12 px and tips
  // a couple of degrees; every offset from -50 px to -900 px produces the
  // identical pixel diff". Two failures, one geometric fact: at hingeDeg 0 this
  // flap's tip sweeps the y-z plane, and the pinned camera parks on x = 0 and
  // therefore sees that plane EXACTLY EDGE-ON.
  //
  // (1) THE TRAVEL WAS NEVER THERE. The note below derives ~60 screen px from
  // the tip chord alone, which is a WORLD length. On screen the tip's height is
  // R*443*sin(A + 33.3deg) for an aft-lying flap (the derivation lives on
  // StripFlapGeom.hingeDeg): its climb in y and its retreat in z project to
  // OPPOSITE screen directions and very nearly cancel. That curve PEAKS at
  // 56.7deg and the window [44, 90] straddles the peak, so both ends sit at
  // almost the same screen height and the whole mechanism measured 16 px. It is
  // not a regression; it never moved.
  //   The FORE lie is monotone and measures 67 px, and it is wrong for this
  //   piece: below ~33deg a fore-lying flap's print faces the floor, so at the
  //   44deg rest the rank showed 0.31 of its face and stood 18 px tall - the
  //   welcome party face-down on the cobbles, the exact failure round 1 chose
  //   this window to avoid.
  //   So the lever is the HINGE SKEW, which trades cancelling vertical for
  //   page-fore travel on the 441 px/world axis that has nothing to cancel it.
  //   Swept: 25deg -> 26 px, 30 -> 31, 34 -> 34, 38 -> 38, 45 -> 44, 55 -> 52,
  //   with the standing rank's face-on falling 0.90 -> 0.78 -> 0.70 -> 0.51.
  //   38 was the first choice and is REJECTED by the collision ratchet (it adds
  //   2 mid-turn brushes on a spread whose ceiling may only ever fall), so the
  //   shipped skew is 34 with hingeZ/slotZ/anchorZ 0.40 -> 0.42. Measured on
  //   the shipped piece: 31.0 px of worst-vertex travel across the window
  //   (1.9x what it had, over the 25 px floor), the die 134 px tall at rest and
  //   127 standing (it was 95 and 85 - the group also reads bigger, which the
  //   same reader wanted), face-on 0.85 at rest and 0.78 standing against 0.94
  //   and 0.90 before. The rank now reads as a queue angled toward the gate
  //   rather than a police line-up.
  //   CLEARANCES UNCHANGED, and that is why hingeZ moved with the skew: the
  //   die's z band is 0.234..0.535 against round 1's 0.23..0.57, so the gate
  //   slab keeps its 0.07 and the frieze gains 0.035. Fore reach grows 0.51 ->
  //   0.561, well inside the 1.15 page. D-G2 Part 1 (hard zero at rest) and
  //   both severity ratchets are green at these numbers and were the binding
  //   constraint on the skew.
  //
  // (2) THE HAND WAS NEVER ANSWERED. The edge-on swing plane also breaks the
  // pointer projection: |ray . planeNormal| = 0.10, so 10 px of drag drove the
  // piece to its far stop, and the other way the ray missed the infinite plane
  // and the layer wrote nothing at all. `grabProjection: 'cylinder'` reads the
  // angle off the flap's own tip circle instead (handle-projection class B1-C),
  // conditioned by that circle's angular width from the camera rather than by a
  // vanishing dot product. Measured on the shipped piece: 10 px -> 7deg,
  // 40 px -> 28deg, 80 px -> the stop, and live in both directions.
  //
  // Travel derived, not eyeballed: 46deg of hinge sweep on a 0.21-deep flap
  // moves the tip 2*0.21*sin(23deg) = 0.164 world; what a reader SEES of that
  // is the projection above, gated in handle-drag-regression.test.ts against
  // the 25 px visible-excursion floor.
  { id: 'ch1-rank', kind: 'midground', role: 'figure', mech: 'stripflap', side: 'left', anchor: 0.2, anchorZ: 0.45, slot: 0.26, slotZ: 0.45, hingeX: 0.34, hingeZ: 0.45, hingeDeg: 30, width: 0.34, height: 0.21, restDeg: 44, travelDeg: [44, 90], grabProjection: 'cylinder' },
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
  // S2-1 THE BOARD IS RESCALED TO READ AT 1x. A blind reader: "the whole board
  // is ~110x95 px on a 1600x900 screen; the digits 1-4 are ~10px tall... A
  // reader at normal distance sees a brown smudge with yellow dots."
  //
  // Derived from the pinned camera, not eyeballed (book-scene.tsx: pos
  // (0,1.85,3.05), lookAt (0,0.38,0.05), fov 34, so k = (900/2)/tan(17deg) =
  // 1471.9 px per unit of screen-plane offset, at depth 3.337 over the board):
  //   * one world unit along the page-fore axis d  = 441 screen px
  //   * one world unit along the spine axis z      = 244 screen px  (0.55x — z
  //     is the foreshortened axis at a 27deg reading angle)
  //   * one world unit of standing height y        = 371 screen px
  // The board was 0.22 x 0.45 world = 97 x 110 px, and each door 0.16 x 0.085 =
  // 71 x 21 px, into which a 512x272 art plate was mapped — a 2.4x HORIZONTAL
  // STRETCH of every glyph on top of the smallness. Both are fixed here: the
  // board grows to 0.34 x 0.66 world = 150 x 161 px (2.2x the area), each door
  // to 0.26 x 0.142 = 115 x 35 px, and the art canvases are re-cut to the
  // pieces' SCREEN aspects (board 512x552, door 512x155) so a circle drawn in
  // the painter is a circle on the page. Digits land ~19px.
  //
  // Bands are the painter's own layout, so nothing has to be kept in sync by
  // hand: keyboardBoard lays out `gap = h*0.028` and `slot = (h - 5*gap)/4`,
  // i.e. gap = 0.028*Z and slot = 0.215*Z of the board's z span Z = 0.66 ->
  // gap 0.0185, slot 0.142, which is exactly the ladder below.
  //
  // Clearances re-checked at the new size: d stays >= 0.40 (the gate's 0.376
  // panel reach + 0.02 margin, bench C1) and ends at 0.74, well inside the
  // 1.15 page; z runs -0.09..0.57, clear of the inn row's glue band about
  // z -0.2 and of the fore wall's apex at z 0.66.
  {
    id: 'ch1-keyboard', kind: 'foreground', role: 'scenery', mech: 'liftflap', side: 'right',
    hingeD: 0.435, leafLen: 0.26, boardD0: 0.4, boardD1: 0.74, boardZ0: -0.09, boardZ1: 0.57,
    // S2-2, and it is NOT a uv flip. Captured at 1x with ?sbdrive: at the old
    // 95deg ceiling a lifted leaf is 9deg off EDGE-ON to the reading camera and
    // renders as a ~7px-wide sliver — its face, its number and its ring all
    // gone. Between about 40 and 80deg it is visible but its art frame has
    // swung: the leaf's long axis (image-x) rotates from screen-RIGHT at shut
    // to screen-UP at vertical, so the numeral tilts with it. That 90deg swing
    // is what the blind reader read as "rotated 180deg / mirrored glyphs".
    //
    // No uv assignment can fix it, and the memory law's own general clause
    // says so: a rigid texture cannot be upright in two poses 90deg apart. The
    // numeral's own up-vector (-image-y = -z) in fact projects screen-UP at
    // EVERY lift angle — that is gated below — so nothing is inverted; what
    // was wrong was the CEILING. It drops 95 -> 64deg, where the leaf still
    // presents 67% of its shut-pose screen area and reads as a little door
    // standing open on its straps. Nothing is lost from the reveal: the 1x
    // capture shows the niche key FULLY uncovered by 55deg, because the key art
    // sits in the aperture's fore half (bench L6). The open threshold follows
    // it down so a door still registers open well before the stop.
    liftMaxDeg: 64, regOpenDeg: 46,
    doors: [
      { z0: -0.072, z1: 0.07, reveal: 'key', plate: 1 },
      { z0: 0.089, z1: 0.231, reveal: 'key', plate: 2 },
      { z0: 0.249, z1: 0.391, reveal: 'cat', plate: 3 },
      { z0: 0.41, z1: 0.552, reveal: 'key', plate: 4 },
    ],
  },
  // VOLUMETRIC: the stable is a gabled OPEN-FRONT barn at the gate — the
  // user's canonical pop-up structure ("left wall, right wall and a
  // ceiling", C6 round-1 verdict 2026-07-11): open front toward the
  // reader, hollow interior, back wall as the brace. Sized down and kept
  // forward so the inn's painted story and the signpost stay clear.
  { id: 'ch1-stable', kind: 'backdrop', role: 'story', mech: 'box', a: 0.13, height: 0.15, z0: 0.43, z1: 0.58, roof: 'gable', gableRise: 0.075, capFront: false },
  // Dress on the stable: a weathervane overhanging the ridge, a hay bale low against the side wall.
  // S2-6(b): the vane grows ~17% (it read as a 12px "blue nib" at 1x, which is
  // how a barn came to read as a tented ledger with a quill in it) — the die
  // keeps its 0.583 aspect, so the repainted cockerel simply lands bigger.
  { id: 'ch1-stable-vane', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch1-stable', seat: 'roofL', u: 0.12, v: 0.02, width: 0.082, height: 0.14 },
  { id: 'ch1-stable-hay', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch1-stable', seat: 'wallR', u: 0.01, v: 0, width: 0.14, height: 0.08 },
  // The old coaching-yard platform is RETIRED (riser-silhouette law: the
  // full-span inn row buries it — struts behind a hero read as invisible
  // scaffolding; pack Q2 approved, no gate requires a per-chapter platform
  // post-E3). The fore-edge wall is KEPT at its station; its art is re-cut
  // as the key-baluster courtyard frieze.
  { id: 'ch1-wall', kind: 'foreground', role: 'scenery', mech: 'vfold', apexZ: 0.66, vDir: 1, phiDeg: 84, rhoDeg: 88, width: 1.25, height: 0.2 },
]

// Chapter II — airy alpine spread, no foreground fringe: one big leaning
// ridge with two bees popping off its fold, the courier balloon hero with
// a third bee circling it. Deliberately the SPARSEST chapter — density
// contrast is part of the variation.
const CH2_LAYERS: readonly SceneLayer[] = [
  { id: 'ch2-backdrop', kind: 'backdrop', role: 'backdrop', mech: 'vfold', apexZ: -0.45, vDir: -1, phiDeg: 84, rhoDeg: 88.5, skewDeg: 1.5, creaseU: 0.6, width: 1.65, height: 0.94 },
  // CROWN ACCENT TRIO (E3 s3, pack §2.2): the vortex flings its top riders
  // above the strut ceiling — three flung bees on the BACKDROP CREASE (gutter
  // class, the only legal way past the swarmarc 0.75 radius wall). bee-a is
  // PROMOTED, not cut: same die-cut geometry, re-seated near the crease top.
  // Mounts SOLVED against solveChildPose (crease leans back ~25°, so tips ride
  // z ≈ −0.73..−0.78 at the gated heights): tips land 0.08–0.30 above the ring
  // crown (y 0.609) with |x| ≤ 0.2 — the S4 accent-band gate in
  // __tests__/labs/storybook/popup-swarmarc-scene.test.ts.
  // IDLE (BW-2, the finding this spread earned by name: "a spread titled 'The
  // Carrier Swarm' containing ~30 bees in which no bee ever moves is a dead
  // diorama"). The three named couriers move — a sub-degree swivel or a
  // sub-millimetre slide of each die about its own mount crease, the paper-true
  // version of a wingbeat: the bee is a rigid cutout on a glue tab, and a glue
  // tab gives in a draught. Their phases come from an id hash in both wave
  // terms, so the three never twitch together. The ring itself is left to its
  // own `stir` drive — a whole wheeling armature is a scene lane's problem, not
  // a draught's.
  // WAVE-2 KIND PASS: the two high couriers take 'drift' (idle-life reserves the
  // slide for pieces the art shows as AIRBORNE, where the eye reads it as hover
  // rather than glue creep) and the chest bee keeps 'sway'. The clover and the
  // cut-paper clouds were the other two candidates the ledger names and BOTH are
  // ineligible: they are mech 'dress', which is not in IDLE_SUPPORTED_MECHS
  // (popup-spread.tsx routes dress patches through a seat quad, not the generic
  // two-quad pose the idle transform rides), and the per-spread tag ceiling is 3.
  // CREST CLEARANCE (WAVE-2, blind reader finding 6, "wings clipped through the
  // top of the back wall... reads as a rendering error"): at mounts 0.84/0.90
  // these two dies protruded 4.8 px and 11.7 px ABOVE the backdrop's projected
  // top edge, so the wall's crest cut across a bee. Lowered to 0.78/0.83, which
  // measures +15.7 px and +14.0 px of clearance BELOW the crest at the pinned
  // camera — the trio now wheels wholly against the painted sky. Gated by
  // __tests__/labs/storybook/popup-swarmarc-scene.test.ts (crest gate).
  { id: 'ch2-bee-a', kind: 'hero', role: 'figure', mech: 'child', parentId: 'ch2-backdrop', mount: 0.75, vDir: 1, phiDeg: 60, rhoDeg: 83, width: 0.22, height: 0.117, idle: { kind: 'drift' } },
  { id: 'ch2-crown-b', kind: 'hero', role: 'figure', mech: 'child', parentId: 'ch2-backdrop', mount: 0.83, vDir: 1, phiDeg: 62, rhoDeg: 84, width: 0.14, height: 0.08 },
  // (the trio is FANNED along the crease at 0.75 / 0.83 / 0.67 rather than
  //  bunched at 0.84 / 0.90 / 0.82. Two reasons, both measured: crown-b at 0.90
  //  and bee-a at 0.84 straddled the crest, and crown-b vs crown-c at 0.83/0.82
  //  measured 86% mutual screen overlap — one die hiding inside another is not a
  //  cluster. At the shipped mounts the three centres sit 29 px and 35 px apart
  //  on screen with 14/28/48 px of crest clearance: three readable couriers.)
  { id: 'ch2-crown-c', kind: 'hero', role: 'figure', mech: 'child', parentId: 'ch2-backdrop', mount: 0.67, vDir: 1, phiDeg: 62, rhoDeg: 84, width: 0.13, height: 0.07 },
  // ATMOSPHERE INTERLEAVE (ref 10): cut-paper clouds on the backdrop panels —
  // atmosphere BETWEEN the painted sky and the wheeling ring.
  // (u/v are world offsets from the panel's spine-side corner — the clouds
  // sit OUTBOARD at the ring's shoulders, overhanging the panel edges, clear
  // of the crown struts' sweep lane.)
  { id: 'ch2-cloud-l', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch2-backdrop', seat: 'left', u: 0.62, v: 0.55, width: 0.3, height: 0.11 },
  // (cloud-r stays mid-panel: outboard it brushes the right limb's mid-turn
  // sweep lane — measured 11 extra mid-turn hits vs ~0 here.)
  { id: 'ch2-cloud-r', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch2-backdrop', seat: 'right', u: 0.26, v: 0.6, width: 0.26, height: 0.1 },
  { id: 'ch2-hero', kind: 'hero', role: 'figure', mech: 'vfold', apexZ: 0.1, vDir: 1, phiDeg: 50, rhoDeg: 82, skewDeg: -2, creaseU: 0.45, width: 0.51, height: 0.89 },
  // BEE-B OFF THE FACE (WAVE-2, blind reader finding 3: "his head is a blank tan
  // oval with a yellow-and-black V smeared across the middle... whether that V is
  // a bee hovering in front of him is unresolvable even at 4x zoom"). Decomposed
  // rather than guessed at: the V was this die, and it was BOTH in the wrong place
  // and in the wrong pose.
  //  - PLACE: at mount 0.62 its projected box is x 772..826, y 337..376, and the
  //    hero's painted head band is y 330..380 — a dead-centre hit on the face.
  //    Moved to 0.86, which puts it at y 230..279: a courier flying up beside the
  //    raised looking-glass (painted at ~x 867, y 284), which is where the eye is
  //    already going.
  //  - POSE: vDir −1 tipped both panels away from the reader, so the die
  //    presented 683 px² of the 2406 px² it can — a bee squashed into two gold
  //    slivers meeting at a crease, i.e. exactly the unresolvable V. vDir +1 (its
  //    sibling bee-c's setting, which the same reader read correctly as "a big
  //    detailed bee") presents 2406 px², 3.5x more. dieFlipped stays true either
  //    way (the deep-V hero tips its children past vertical regardless), so the
  //    panel-uvs flip pin is unaffected.
  { id: 'ch2-bee-b', kind: 'hero', role: 'figure', mech: 'child', parentId: 'ch2-hero', mount: 0.86, vDir: 1, phiDeg: 64, rhoDeg: 85, width: 0.16, height: 0.089, idle: { kind: 'drift' } },
  { id: 'ch2-bee-c', kind: 'hero', role: 'figure', mech: 'child', parentId: 'ch2-hero', mount: 0.4, vDir: 1, phiDeg: 64, rhoDeg: 85, width: 0.15, height: 0.069, idle: { kind: 'sway' } },
  // VOLUMETRIC: the guild's hive — a small lidded box in the meadow (real
  // beehives ARE stacked boxes); keeps the chapter airy but gives it its
  // enclosed volume and a third fold family.
  { id: 'ch2-hive', kind: 'backdrop', role: 'story', mech: 'box', a: 0.09, height: 0.14, z0: 0.34, z1: 0.46, roof: 'flat' },
  // Dress on the hive: a bee swarm hanging off the lid, flowers at the base.
  { id: 'ch2-hive-swarm', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch2-hive', seat: 'lidR', u: 0, v: 0.01, width: 0.16, height: 0.1 },
  { id: 'ch2-hive-flowers', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch2-hive', seat: 'wallL', u: 0, v: 0, width: 0.14, height: 0.07 },
  // THE CARRIER SWARM (E3 s3, NEW FAMILY 'swarmarc' — replaces the ch2-meadow
  // platform, which sat exactly in the left arm's anchor lane and duplicated
  // the multiplicity role the ring now owns; retiring returns ~30 mid-turn
  // crossings + 3 draws + 2 textures). A horseshoe ring of 24 couriers on
  // graded hairline struts + 4 outrider strays, wheeling around the hero:
  // full table regenerated from the bench constants (e3s3-swarmarc.mjs, ALL
  // GATES GREEN S1–S7), wave-staggered deploy poured out of the hive by the
  // page itself, and the STIR THE SWARM tab rippling the outer right-arm
  // members (drive channel `ch2-swarm~stir`, held state).
  // WAVE-2: 22 members (was 28) and the ripple retuned from a 12° whisper to a
  // 38° wave with a 0.8 crest limiter — see popup-swarmarc.ts's header for the
  // measured screen travel and why each number is what it is.
  { id: 'ch2-swarm', kind: 'midground', role: 'figure', mech: 'swarmarc', struts: buildSwarmStruts(), strutW: 0.01, stir: { side: 'right', stroke: 0.14, deg: 38, phaseStep: 0.2, crest: 0.8 } },
  // The long-planned painted meadow fringe up front (call sheet v5): a low
  // wide reader-edge wall that ratchets the chapter's depth bands.
  { id: 'ch2-fringe', kind: 'foreground', role: 'scenery', mech: 'vfold', apexZ: 0.56, vDir: 1, phiDeg: 84, rhoDeg: 88, width: 1.2, height: 0.22 },
  // LINKED-RANK CHAINS (T-LINKED-RANK): each ONE die-cut of 2 bees + a strung
  // envelope on painted thread, overhanging the fringe top edge (the Sabuda
  // overhang recipe) — they hand the ring's width past the strut radius wall
  // and lead the eye down to the painted floor routes.
  // (outboard at x ≈ ±0.45..0.79 per the pack's ±0.52/±0.78 span targets —
  // clear of the gutter hive; they widen the composition past the strut wall.)
  { id: 'ch2-chain-l', kind: 'foreground', role: 'scenery', mech: 'dress', parentId: 'ch2-fringe', seat: 'left', u: 0.45, v: 0.14, width: 0.34, height: 0.12 },
  { id: 'ch2-chain-r', kind: 'foreground', role: 'scenery', mech: 'dress', parentId: 'ch2-fringe', seat: 'right', u: 0.44, v: 0.13, width: 0.32, height: 0.12 },
  // THE MEADOW WINDMILL IS RETIRED (E3 Wave-2, blind reader finding 8's
  // "clear the hero's silhouette zone" + his item 17). The kinetic sail stood at
  // apexZ 0.20 and measured x 752..838, y 487..628 at the pinned camera — wholly
  // inside the hero's own box (707..912, 232..617) and DOWNSTAGE of him (0.20 vs
  // his 0.10), so it drew across his legs from hip to boot. The first-time reader
  // named it "a stack of cream slabs ruled with brown verticals, sitting in a
  // wooden crate ... hive frames in a hive box": the one unreadable object in the
  // middle of the composition, and the thing masking the protagonist's stance.
  // It cannot be moved out of the way, and that is the honest reason it goes: a
  // kinetic arm's apex is ON THE SPINE by construction, so every legal placement
  // is in the hero's screen column — upstage of him it is simply invisible behind
  // him (measured: its whole box falls inside his), downstage of him it masks him.
  // This is the backdrop-wings law again (a tall spine-anchored centrepiece
  // forbids other spine-anchored pieces in its column). Returns ~18 mid-turn
  // brushes against the backdrop wall, 2 draws and a texture; s3 keeps 4 distinct
  // mechanism families (vfold / recursion / box / swarmarc), which is the C4v2
  // floor, and the swarmarc is itself a 22-member assembly.
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
//
// NO IDLE TAG on this spread, deliberately (BW-2 pass). Every piece here is
// either a showpiece mech that poses itself (keepstack, stagedchain, skyline,
// keepwinch) or a grab handle (the ring-tower strip, the dispatch volvelle),
// plus one structural fore-edge fringe. There is no small loose accent to give
// the draught to, and inventing one to satisfy a checklist would be a new piece
// of scenery smuggled in as a bug fix. This spread's ambient life is a scene
// lane's job.
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
  // E3 s4 ROUND-3 — THE ROOKERY CLIFFS (bench .superpowers/sdd/bench/
  // e3s4-cliffs.mjs, ALL GATES GREEN). The user's verdict on the ring was that
  // it read "uneffectful" and squat: nine flank strips of height 0.107-0.16
  // aggregating to 46k px^2 of screen. They are RETIRED here (the rear three
  // rows per side and both ring-mid arms) and replaced by TWO page-rooted
  // multi-storey cliffs of the new STAGEDCHAIN family — each one alone
  // out-massing the entire old ring (51.9k / 49.1k px^2) and standing 0.80-0.84
  // world tall instead of 0.16. Only the ring-front gate wall survives, as the
  // left page's lamplit yard wall.
  //
  // WHY THIS IS LEGAL AT ALL (playbook §1): a single-stage page-rooted flap's
  // worst real-time step is its far base corner riding the page, rfar*dtheta —
  // which capped row height near 0.11 and killed the "true 2x" ask. A CHAIN of
  // storey panels, each joint on its own beta cam, spends its joint arc in the
  // eased TAILS of the turn and holds a shallow pose through the fast mid-turn
  // station. The four family conditions (hold-through-midturn reach <= 0.252 at
  // rfar 0.73, joint arc fits the two tails, top-down unroll, q(0)=0 exact) are
  // asserted per config in popup-stagedchain.test.ts.
  //
  // THE LEAN-BACK LEVER (this scene's addition to the derivation, which swept
  // rootDeg 90 only): raking the chain back trades apex height for chain
  // LENGTH — the hold-through-midturn reach scales with sin(root), while the
  // elevated reading camera sees a raked face nearly square-on instead of
  // edge-on (the lid-dominant sightline law). An upright H 0.82 cliff projects
  // 40k px^2; the 58deg-raked chain of length 0.94 projects 51.9k at a LOWER
  // apex (0.816), so the keep's 1.01 spire keeps the gutter crown.
  //
  // AND THE WALL THAT SHAPED THEM: both cliffs are RIBBONS, not accordions. An
  // accordion storey swings through vertical on its way open and raises a tent
  // of nearly its own panel height — at the SMALLEST betas, because the
  // top-down unroll law deploys upper joints first. That breaks wedge
  // containment (measured 0.45 past the limit at beta 10deg, caught by the
  // book-wide A10 gate). A ribbon lies extended-collinear at close and only
  // ever articulates by relDeg, so it never tents. The price is page depth: the
  // closed footprint is the full chain length, which is what caps these chains
  // at 0.88 from a hinge at z 0.15 (0.15 + PAGE_H/2 = 0.90).
  //
  // Feet sit at radial 0.43 (0.03 clear of the keep's 0.40 gutter band) and the
  // hinge at z 0.15 — upstage of the winch disc (z 0.17+) and the dial (0.21+),
  // so the cliffs are BEHIND the keep facade and outboard of its cone: they
  // block 0.0% of the hall / gallery / spire sightline rays (bench S3).
  // ==========================================================================
  // E3 s4 ROUND-4 — "THE RAVEN CITY". The r3 mirror is RETIRED (ch3-cliff-l /
  // ch3-cliff-r, and with them ch3-skyline-l and the ch3-ring-tower gatehouse).
  // The user's verdict on the canyon was "still needs to be bigger and to have
  // some structures revised, maybe adding some asymmetry will help" — and the
  // mirror was the problem underneath all three notes: two near-identical
  // cliffs flanking the gutter make a SYMMETRY, and a symmetry has no scale,
  // because there is nothing for the eye to measure the big thing against.
  //
  // So the spread is rebuilt as ONE DIAGONAL SWEEP: a colossal crooked rookery
  // tower climbing the left page past the keep's crown, a working dispatch line
  // falling across the spread with letter-baskets on it, and a low sprawl of
  // terraced roosts on the right where the ravens land. Asymmetry IS the
  // composition. Derived in three benches — e3s4r4-tower.mjs, e3s4r4-cable.mjs,
  // e3s4r4-city.mjs — all gates green.
  //
  // THE CROOKED COLOSSUS. apex 1.017 (the r3 cliff was 0.816), chain length
  // 1.045, four UNEVEN storeys. Three things had to be derived to get here:
  //
  //  (a) THE WALL WAS A TAPE MEASURE, NOT KINEMATICS. A ribbon's closed
  //      footprint costs its full chain length in page depth, so
  //      L <= zc + PAGE_H/2 — and the winch disc's closed footprint pinned zc
  //      at 0.155, capping apex near 0.88 before the physics was even asked.
  //      The disc moves downstage (hubZ 0.30 -> 0.45) and buys 0.14 of tower.
  //      That move is structural, not cosmetic.
  //  (b) THE TRAPEZOID CHAIN. Per-node radial spans (rTop / wTop) cost nothing
  //      in the page-local (xi, eta) plane and give the whole crooked-tower
  //      vocabulary: widths taper 0.300 -> 0.203 as it climbs, while the inner
  //      edge ZIG-ZAGS 0.420 -> 0.445 -> 0.425 -> 0.450 -> 0.440, so the stack
  //      kicks out at the gantry belt and pulls back at the belfry. A tower
  //      that grew too fast to stand straight, in plan.
  //  (c) THE PER-NODE ROTATION RADIUS. The r3 cam charged every node the
  //      widest node's radius; the honest hypot(r_j + w_j, eta_j) widened the
  //      crown's hold-through-midturn window from 0.136 to 0.515, which is what
  //      makes a tower this tall affordable at all.
  //
  // (A fourth lever, the CROWN FLAP — a fold-back top storey deployed LAST —
  // was derived, proved legal, and NOT shipped: it buys chain past the depth
  // budget at pi x h of joint arc, and break-even needs relDeg > 180 - rootDeg,
  // which is not a crown. The bench keeps it measured, with a negative control.)
  {
    id: 'ch3-tower', kind: 'backdrop', role: 'scenery', mech: 'stagedchain',
    side: 'left', F: 0.42, w: 0.3, zc: 0.3, rootDeg: 74, safe: 0.98, camRestDeg: 173,
    style: 'ribbon',
    stages: [
      // 1 — the buttressed foot: the widest storey, the rank of big gate arches.
      { h: 0.301206, relDeg: 0, rTop: 0.445, wTop: 0.276 },
      // 2 — the squat gantry belt, shoved OUTBOARD (the first kink).
      { h: 0.221294, relDeg: 1.8, rTop: 0.425, wTop: 0.2613 },
      // 3 — the tall belfry storey, pulled back INBOARD (the second kink).
      { h: 0.28174, relDeg: 1.4, rTop: 0.45, wTop: 0.2274 },
      // 4 — the crown, kicking back out over the canyon. The dispatch line's
      //     first stretch and its gantry arm are DIE-CUT into this storey's
      //     sheet: the cable leaves the tower on the tower's own paper.
      { h: 0.24076, relDeg: 4.9, rTop: 0.44, wTop: 0.2031 },
    ],
  },
  // THE DISPATCH LINE — the working cable, and the spread's new playable.
  //
  // A cable CANNOT cross the gutter here, and the bench says why in three
  // measurements: a cross-gutter thread carries ~1.2 of slack at book-closed; a
  // dress overhang reaching spine-ward dies at the backdrop-wings wedge
  // (rnear -> 0); and a gutter-anchored die-cut v-fold — the answer that should
  // have worked, since a v-fold IS spine-anchored — rakes its crest through
  // z = apexZ + height*vDir*cos(lambda(beta)), an excursion of ~1.25 x height,
  // straight through the volume the keep occupies. HOUSE LAW: the keep owns the
  // gutter. A second gutter-class piece must be short or seated on the stack.
  //
  // So the line crosses the gutter the way a cut-paper book crosses anything:
  // the reader's eye does. It leaves the tower's crown storey (die-cut there),
  // passes the keep's spire lantern (painted on a piece already standing), and
  // lands HERE — a page-rooted die-cut panel carrying the long swooping run,
  // the basket lanterns, and the basket the reader pushes down the wire.
  // Upstage of everything (zc -0.28) so the baskets fly BEHIND the roosts.
  {
    id: 'ch3-dispatch-line', kind: 'backdrop', role: 'scenery', mech: 'dispatchline',
    side: 'right', F: 0.415, w: 0.315, zc: -0.125, rootDeg: 82, safe: 0.95, camRestDeg: 173,
    style: 'ribbon',
    stages: [
      { h: 0.36, relDeg: 0, rTop: 0.415, wTop: 0.315 },
      // The upper storey kicks 9deg downstage so the sheet's top edge leans out
      // and the die-cut cable reads as hanging in the air, not pasted on a wall.
      { h: 0.265, relDeg: 9, rTop: 0.415, wTop: 0.315 },
    ],
    // The cable in panel (u, v): enters high at the gutter side, where the eye
    // has just followed it off the keep's crown, and sags away outboard to the
    // roosts. Monotone in u and falling in v — the scene's one-diagonal law,
    // gated as L9/D4.
    // The first board capture failed HERE, and it is worth naming: the roosts
    // stood downstage of the line and their crest sat above it, so 79% of the
    // cable hid behind roofs and the spread's signature read as a stub. The
    // line is taller now and the sag shallower, so the cable clears the
    // roofline along its whole run and only meets it at the landing.
    cable: [
      [0.0, 0.965], [0.12, 0.894], [0.25, 0.822], [0.38, 0.752], [0.5, 0.692],
      [0.62, 0.635], [0.74, 0.584], [0.86, 0.535], [1.0, 0.48],
    ],
    baskets: [0.2, 0.47, 0.72],
    riderHome: 0.06,
    // THE HANDLE, SIZED BY MEASUREMENT (blind-review finding: mechanism handles
    // across the book are undiscoverable at 1:1). The reader's trolley used to
    // project 15 x 25 px at the pinned camera — a speck — and worse, it SQUASHED
    // to 7 px wide at the outboard end because the quad's corners were clamped
    // into the sheet while its centre kept travelling. It is now 29 x 43 px at
    // every station (gates L15/L16), centred ON the wire like a real trolley so
    // its pannier still clears the roosts' 0.287 crest (L17).
    basketHalfU: 0.11,
    basketHalfV: 0.09,
  },
  // THE TERRACED ROOSTS — the right page's answer to a colossus, and the piece
  // that kills the mirror by being its OPPOSITE. Where the tower is one tall
  // crooked stack, the roosts are a low, wide, five-storey sprawl, each storey
  // kicked back 7-12deg from the one below so the sheet reads as roof after
  // roof stepping away from the reader. Same family, opposite grammar; apex
  // 0.287 against the tower's 1.017.
  //
  // zc 0.19 is a three-way tape measure: the closed ribbon must clear the
  // dispatch line's ribbon behind it (front edge -0.125) AND stay 0.02 clear of
  // the dispatch dial's riveted card at z 0.21 — which is what caps the roosts
  // at 0.30 of chain. They are SHORT on purpose as well as by necessity: the
  // cable has to fly over them, and a taller sprawl would swallow it.
  {
    id: 'ch3-terrace', kind: 'backdrop', role: 'scenery', mech: 'stagedchain',
    side: 'right', F: 0.42, w: 0.31, zc: 0.19, rootDeg: 62, safe: 0.95, camRestDeg: 173,
    style: 'ribbon',
    stages: [
      { h: 0.0773, relDeg: 0, rTop: 0.425, wTop: 0.3 },
      { h: 0.0653, relDeg: 12, rTop: 0.44, wTop: 0.285 },
      { h: 0.06, relDeg: 10, rTop: 0.45, wTop: 0.265 },
      { h: 0.0514, relDeg: 9, rTop: 0.47, wTop: 0.24 },
      { h: 0.046, relDeg: 7, rTop: 0.485, wTop: 0.215 },
    ],
  },
  // THE TOWER-HOIST WINCH (derive-keep-winch.mjs) — the E-G6 composed-machine
  // moment. A die-cut disc hub-riveted into the LEFT page (hubD 0.34, hubZ 0.30,
  // discR = crankR = 0.13, pin on the rim) that the reader TWISTS; a Scotch-yoke
  // crank drives THREE staggered outputs in sequence off one drag — the
  // dispatch boards swinging out (0 -> 117deg), the counterweight sash-weight
  // descending the belfry mouth (90 -> 184deg), the signal flag rising
  // (164 -> 302deg). THETA_MAX 302deg — a real crank — and release HOLDS the twist
  // (H4, the disc remembers). RIGID-FOLD re-derivation (2026-07-16): the iris is
  // 4 shutters hinged on the loft walls (off-wall reach 0.10*sin(deploy)*E ->0 at
  // close, riding the folding wall), and the counterweight is an IN-PLANE
  // SASH-WEIGHT that descends WITHIN the hall flank-wall plane (zero off-wall
  // reach — winding-insensitive and always wedge-contained; bench N8). Both fold
  // flat with the folding keep walls. The two `host` boxes MUST match the keep's
  // loft + hall stories (asserted by the winch test).
  {
    id: 'ch3-keep-winch', kind: 'hero', role: 'scenery', mech: 'keepwinch', side: 'left',
    // Disc moved OUT to hubD 0.52 so it clears the re-massed hall flank (a 0.40)
    // and reads on the open left page beside the keep; discR/crankR 0.13 hold the
    // proven THETA_MAX 112.6deg and cam behaviour. (At the low composition camera
    // a page-flat handle foreshortens; it reads full at the interaction camera.)
    //
    // ROUND-4: hubZ 0.30 -> 0.45. This is STRUCTURAL, not a look. A page-rooted
    // ribbon's closed footprint costs its whole chain length in page depth, so
    // the crooked colossus can only be as tall as zc + PAGE_H/2 — and zc was
    // pinned by this disc's closed footprint starting at z 0.17. Walking the
    // disc downstage into the yard buys 0.14 of tower (apex 0.88 -> 1.017) and
    // seats the crank where the reader's hand already is, at the tower's foot.
    hubD: 0.52, hubZ: 0.45, discR: 0.13, crankR: 0.13,
    // WAVE-2 (S4-2). A blind reader cranked this wheel and got "one abrupt
    // 22-degree-wide snap followed by minutes of meaningless spinning": a bare
    // Scotch yoke tops out at half a turn, so the whole machine fired inside a
    // flick of the wrist. `reduction: 3` puts a gear train between the hand and
    // the yoke pin — the pull s keeps its exact range (so every fold-flat and
    // collision proof is untouched in s) while the WIND becomes 367.9deg, just
    // over one full crank, with something moving the whole way:
    //   boards 0 -> 195deg, weight 164 -> 263deg, flag 244 -> 368deg.
    // The last 24deg run into a pawl whose response fades to zero (the wheel
    // stiffens and dies under the hand instead of silently free-spinning).
    //
    // phaseDeg 40: the yoke pin starts 40deg past top-dead-centre. Without it the
    // old law's zero-slope liftoff — a virtue at 112deg of wind — becomes a
    // 3x-longer dead zone, which is the OTHER half of what the reader hit.
    reduction: 3, phaseDeg: 40,
    // THE SIGNAL FLAG, now the LAST output — the crank ends on a flag going up.
    //
    // Re-sited baseX 0.96 -> 1.05 and given a mast (S4-4). At 0.96 the paddle's
    // screen box (y 626.7..637.8 at the pinned camera) LANDED ON the crown
    // raven's (y 632.1..667.1): the reader saw a grey post through the
    // weathervane's back. At 1.05 the paddle rests at y 600.0..610.3 — 21.8px
    // clear above the raven — and the hoist carries it to y 560.6. The mast
    // stands on the loft lid (bisector-x 0.3648 + 0.18 = 0.5448) at the arm's own
    // z, so the paddle is carried by a visible post; where the post passes the
    // raven it is simply OCCLUDED by it (mast z -0.08 vs raven z +0.13), which is
    // a roofline, not a detachment. armHalfW is the at-close off-page residual
    // the N4/N8 fold-flat gates ride on; 0.0195 leaves a 2.5% margin under the
    // 0.02 paper-thickness tol, and the mast shares it.
    semaphore: { L: 0.11, sMax: 0.09, range: (90 * Math.PI) / 180, baseX: 1.05, armLen: 0.1287, armHalfW: 0.0195, mastFootX: 0.5448 },
    // Iris + counterweight hosts RE-STATIONED to the re-massed LOFT story
    // (a 0.27, height 0.18, z +-0.20, baseH 0.3648 = hall.H 0.1799 + gallery.H 0.1849).
    // Both must equal the keep's loft story (asserted by popup-keepwinch.test).
    // THE DISPATCH BOARDS lead the stagger now (L 0): the reader's first turn
    // swings the chapter's namesake object out of the loft.
    iris: { L: 0, sMax: 0.075, range: (68 * Math.PI) / 180, bladeLen: 0.1, host: { mech: 'box', a: 0.27, height: 0.18, z0: -0.2, z1: 0.2, roof: 'flat', capFront: true, capBack: true, baseH: 0.3648 } },
    // Counterweight on the LOFT FRONT CAP (belfry mouth), dead-center in the
    // reading sightline; descends within the cap plane (zero off-plane reach).
    counterweight: { L: 0.055, sMax: 0.07, range: 1, host: { mech: 'box', a: 0.27, height: 0.18, z0: -0.2, z1: 0.2, roof: 'flat', capFront: true, capBack: true, baseH: 0.3648 } },
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
  // Second divergence — the STATION/HEIGHT schedule was re-derived against
  // the then-KEPT hoard, which the pack's schedule never collision-checked
  // (bench G-D only sampled rank-vs-rank). The hoard has since been retired
  // (see its note below), so this schedule is now strictly SLACKER than the
  // clearance it was solved for — nothing here needs to move, and growing the
  // front ranks back into the freed channel is a separate, benched call.
  // The reasoning is kept because it is what pins these numbers: the hoard's
  // strut planes swept the spine channel (lateral -0.22..+0.17, up to y 0.55,
  // deck to 0.68) across z in [-0.3, -0.2], and a wall rank's crest SWEEPS z by
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
  // IDLE (BW-2): the spilling coins glint. A hoard is the one thing in the book
  // where a light that will not move is a defect the reader can name — and
  // spilled coins must NOT shift, so the treatment has to be light rather than
  // motion. The dragon, the range and the chest stay dead still: this spread's
  // architecture is its subject.
  { id: 'ch4-coins', kind: 'hero', role: 'scenery', mech: 'child', parentId: 'ch4-hero', mount: 0.22, vDir: -1, phiDeg: 60, rhoDeg: 83, width: 0.24, height: 0.24, idle: { kind: 'glint' } },
  // VOLUMETRIC: an open treasure chest in front of the dragon — the
  // book's HOLLOW box (open top, no backbone): the reading camera looks
  // straight down into a raw-paper interior (benchmark B16).
  { id: 'ch4-chest', kind: 'backdrop', role: 'story', mech: 'box', a: 0.12, height: 0.12, z0: 0.34, z1: 0.46, roof: 'open' },
  // Dress on the chest: the propped-open lid silhouette rising off the side
  // wall, gold heaped across the front cap (patches ride at/above the panel
  // base — paper cannot overhang below a page-glued edge).
  { id: 'ch4-chest-lid', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch4-chest', seat: 'wallL', u: 0, v: 0.02, width: 0.13, height: 0.14 },
  { id: 'ch4-chest-spill', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch4-chest', seat: 'capFrontR', u: 0, v: 0, width: 0.12, height: 0.09 },
  // (RETIRED — ch4-hoard, the gold-hoard BRIDGE platform. It was grown onto
  // tall struts, rise 0.40 / q 0.21, "so the gold heap crests ABOVE the
  // skyline"; the E3 rebuild replaced that skyline with the mfoldrange massif
  // and the piece stopped reading as a heap and started reading as a wireframe
  // kite hung in the range's notch above the dragon — its deck panels are only
  // 0.21 x 0.10 world and near edge-on, so all the reader ever saw was strut
  // scaffolding against the night sky (bench/out/e3-board-s5.png, riser-
  // silhouette law).
  //
  // Lowering it was tried first and is ruled out by measurement, not taste.
  // The rig's own top is ridgeX(rise) + the deck-crease rise, and the target
  // is the r3 rank's PAINTED notch cap — capV 0.44 of h 0.50 = 0.219 world,
  // screen-y 0.054 at the pinned camera. Sweeping rise 0.02..0.42 x q
  // 0.05..0.24 x five glue splits, the only settings that clear that cap sit
  // at rise <= ~0.09; and q may not drop below half the ridge separation
  // (~0.105 there) or the deck stops reaching across its own ranks. That
  // leaves exactly one legal candidate, rise 0.08 / q 0.11 — whose entire
  // screen footprint, x [-0.108, 0.108] y [-0.199, 0.027], lands 0.110 screen
  // units BELOW the dragon's top edge across its whole x window. The hero
  // stands nearer the camera (z 0.06..0.30 against the rig's -0.30..-0.20), so
  // the only rig that stops silhouetting is a rig nothing can see: not depth
  // mass, just draws. Retired instead, s2 precedent — the platform census has
  // no per-chapter requirement (composition-covenant STAGE_SET_SPREADS), the
  // family still ships on ch6-steps and satchel-table, and s5's depth is
  // carried by the four graded range planes the chapter was rebuilt around.)
  // BECKON ORDER (E3 W2 S5-7): the dissolve is listed BEFORE the gold pile.
  // handle-beckon.ts picks a spread's primary playable by family rank and
  // breaks ties by content order, and dissolve/tabpiece rank equally — so the
  // author's reading order is the vote. The blind reader called the golden
  // arcade behind this rack "the best image on the spread and the literal
  // payoff of the text", invisible at rest behind the least discoverable
  // control. The spread's one invitation now twitches THAT.
  // E2.2 PULL-TAB DISSOLVE (Birmingham 92/93/119; bench derive-dissolve.mjs):
  // the book's first paper CROSSFADE and a genuinely NEW mechanism family for
  // G1. A page-flat rack of 6 venetian SLATS in the open sand field on the LEFT
  // page — the mirror of the right-page goldpile tab (a second fore-edge tab,
  // symmetric tab vocabulary). The reader pulls the tab and the shared flip
  // angle tau carries rolling DUNES (a distant camel-train) through the edge-on
  // "blinds close" over to the dragon's GOLD hoard — the transmutation. Both end
  // states are coplanar (volvelle-class, no fold-flat envelope); the release
  // snaps to a pure end {dunes, gold} the book remembers. Placed downstage-left
  // clear of the spine-hugging chest (d<=0.24) and the hero dragon's base
  // footprint (d<=~0.32); it also cleared the retired hoard shelf (z<=-0.18)
  // and never touched its strut region behind the dragon.
  // Promoted to the spread's THESIS (celebrated brass ▼PULL▼ affordance) and
  // turn-culled (Batch C-3, the dial-class lever): interaction-only + page-
  // flat, it stops drawing through the fast middle of a turn and ramps back
  // inside the landing-settle window (~13 draws returned on the s4->s5 peak).
  // E3 W2 S5-1/S5-7: tabW 0.1 -> 0.26 and a 0.06 TONGUE past the fore edge at
  // rest, taking the handle from a measured 24x27 screen px ("a tiny gold
  // splinter"; found on the eighth scripted attempt) to 78x70 — a 7.5x hit area.
  // The tongue is paper the binder cut long, not a change to the drive
  // (dissolveTabOut still equals the draw exactly), and the latched-gold state
  // already reached 0.14 past the trim, so nothing about the closed book is
  // newly out of bounds. 0.06 rather than more: the tongue's outer corner lands
  // at screen x 217 against the narration's last line, which ends at x 213 — the
  // handle stays clear of the HTML column that hid the OTHER tab in D6.
  // The rack's own slats are grab surfaces now too (popup-dissolve-layer.tsx),
  // which is the half of the fix that makes the CLIMAX findable: the reader
  // presses the picture, and the picture turns to gold.
  { id: 'ch4-dissolve', kind: 'midground', role: 'story', mech: 'dissolve', side: 'left', d0: 0.46, d1: 0.98, z0: 0.2, z1: 0.6, slats: 6, stroke: 0.14, tabW: 0.26, tabTip: 0.06, turnCull: true },
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
  // E3 W2 S5-1: tabW 0.1 -> 0.24. The blind reader measured this handle at
  // 100x25 screen px ("a flat grey plate floating in the black off-page void")
  // and found it only by brute-force-sweeping a 1500-point hover grid. 0.24 is
  // the strip's own z-extent (0.28) less a binder's margin, so the tongue is now
  // exactly as wide as the paper that drives it — the widest a tab can honestly
  // be — and it takes painted art (`ch4-goldpile-tab`) instead of the shared
  // grey kraft grip (BW-13).
  { id: 'ch4-goldpile', kind: 'midground', role: 'scenery', mech: 'tabpiece', side: 'right', form: 'mound', hingeX: 0.9, z0: 0.26, z1: 0.54, legW: 0.26, liftDeg: 55, tabW: 0.24 },
  // THE PASSAGE OF GLASS (E3 W2 S5-3, repaint of the caravan frieze). The
  // chapter's whole point — "passages of glass through which the people could
  // reach their gold" — was text-only: the blind reader found the frieze's own
  // ground bar and called it "a thin white/silver rail... it reads as a metal
  // bar", and read the dune ranks' violet lee flanks as "pale translucent
  // quadrilaterals, unfinished geometry". So the frieze IS the passage now: a
  // glazed gallery in elevation (kerb, mullions, arched glazing, gold top rail)
  // with the caravan walking INSIDE it toward the vault's own reveal. Same card,
  // same station, same height — geometry untouched, the paint carries it.
  // Art constraint (pack §4.2, kept): silhouette dips <= 0.06 world in
  // x in [-0.75, -0.44] (u <= 0.207) — the gallery's PORTAL mouth stands at
  // u ~ 0.21 and only the low kerb continues past it, so the dissolve placard
  // still reads through.
  { id: 'ch4-frieze', kind: 'foreground', role: 'scenery', mech: 'vfold', apexZ: 0.62, vDir: 1, phiDeg: 84, rhoDeg: 88, width: 1.5, height: 0.16 },
]

// Chapter V — THE BAZAAR OF A THOUSAND STALLS (E3 s6 rebuild;
// scenes/s6-scene-pack.md, register R4 GRAND-DENSE amphitheater, bench
// e3s6-terrace.mjs ALL GREEN). Chapter meaning = DENSITY: no tall hero — the
// MASS is the hero. From the city gate the bazaar opens like a bowl: the
// retained city v-fold (repainted — curved streets, die-cut dome skyline)
// closes the rear under two wheeling pigeons; two concentric stall arcs
// (1-story keepstacks wearing die-cut facade plates — 7 gables + the modest
// gate-minaret at y 0.55 rear, 5 larger awninged fronts inner) curve around
// a sunken market floor; souk skyline wings run both arcs out to the page
// edges at matched depths; a stepped BOX TRAIN of terrace treads descends to
// the apron (the mech-37 stepped-terrace READ on the proven glued-box family
// — a cut-from-base parallelogram is geared-dead at our 176° rest bloom,
// sin(2°) = 3.5% of its riser), carrying linked crowd-chain riders on its
// carpet lids (2 pieces read as 11 figures); the six-stall rank stripflap lies
// flat on the near apron for the READER to raise (the signature moment, E3 s6
// Wave-2: the chapter's verb is now the chapter's playable); the tea-corner
// stripflap steams at the right apron; and the retained tabpiece is re-themed
// into the chapter's whole point — ⟡ RAISE A STALL ⟡. Concentricity is
// COMPOSED, not bent: gutter boxes grade a 0.40 → 0.34 → 0.30 → 0.26 toward
// the reader (Birmingham 118: front narrowest), the plates + souk wings carry
// the curve in paint and die-cut, the doodled floor print closes the arcs.
// Retired per the pack fate list: ch5-stalls, ch5-arch (+garland/keystone),
// ch5-lantern/-b (re-seated as die-cut lantern strings swagged across BOTH
// plates), ch5-stall (+valance/crates), ch5-goods (its wares role moved to
// the tread lids). ch5-market-table renamed → ch5-raise-stall (same solver
// params, re-themed).
const CH5_LAYERS: readonly SceneLayer[] = [
  // Curved painted city wall closing the rear. RETAINED v-fold, repainted +
  // re-cut: die-cut dome/rooftop top edge, painted concentric streets.
  { id: 'ch5-city', kind: 'backdrop', role: 'backdrop', mech: 'vfold', apexZ: -0.5, vDir: -1, phiDeg: 84, rhoDeg: 88, creaseU: 0.5, width: 1.9, height: 0.66 },
  // (Pack §4b said mount 0.7 — but a child's mount is a station in WORLD units
  // up the parent fold and the city sheet is 0.66 tall: 0.7 is off the paper
  // (A11 glue-on-paper). Re-seated at 0.58, the same "high on the crease" read
  // with the dormer's proven 0.08 top margin.)
  // IDLE (BW-2). The two pigeons are this spread's only pieces that are not
  // architecture or crowd, so they carry the draught: pigeon-a is PERCHED high
  // on the wall crease and sways (a bird shifting its weight); pigeon-b hangs
  // off the crease toward the reader — it is the one the art shows airborne, so
  // it drifts instead, a fraction of a millimetre along its own crease axis,
  // which reads as hover rather than as a swivel. The souk's stalls, treads and
  // crowd ranks stay still; a bazaar that shivers reads as an earthquake.
  { id: 'ch5-pigeon-a', kind: 'backdrop', role: 'figure', mech: 'child', parentId: 'ch5-city', mount: 0.58, vDir: 1, phiDeg: 62, rhoDeg: 84, width: 0.14, height: 0.07, idle: { kind: 'sway' } },
  { id: 'ch5-pigeon-b', kind: 'backdrop', role: 'figure', mech: 'child', parentId: 'ch5-city', mount: 0.45, vDir: -1, phiDeg: 64, rhoDeg: 85, width: 0.11, height: 0.055, idle: { kind: 'drift' } },
  // REAR STALL ARC — single-story keepstack; the facade plate is the arc:
  // 7 linked stall gables + gate-minaret (top y 0.55, the ONE modest vertical),
  // lantern strings die-cut between finials. Plate overhangs laterally to 0.44.
  //
  // CAP-LEAN LAW (in-engine D-G2 correction to the pack's flat T5 z-bands —
  // the bench-vs-render trap): a box's front cap leans +z by a*cos(h) as the
  // book closes, so consecutive train members need gap >= a_prev*cos(h) at
  // every dwell station (beta >= 165), not merely disjoint flat bands. The
  // train's z1 edges are pulled back accordingly (-0.08 -> -0.12, 0.14 ->
  // 0.10, 0.32 -> 0.29); with those gaps the D-G2 rest/near-rest gates hold
  // with every brace cap in place.
  // Plates FLUSH with their caps (width = 2a), NOT the pack's 0.44 lateral
  // overhang: in-engine A10 proves any wh > a dips below the opposite page
  // plane mid-turn by (wh - a)*sin(cap-page angle) — past the 0.004 lift
  // slack — which is the ch3 bailey-wing rejection re-derived at 1/20 the
  // overhang. Every plate this book has ever shipped is flush for exactly
  // this reason. UP-the-plane overhang (the 0.55 minaret die-cut) is legal —
  // the raven-finial precedent. The arc's continuation past the wall corners
  // is the souk wings' job; the plate/souk paint seam widens 0.06 -> 0.10
  // (risk 4, bridged by matched stripe cadence + the backdrop behind).
  { id: 'ch5-arc-rear', kind: 'backdrop', role: 'story', mech: 'keepstack',
    stories: [{ key: 'arc', a: 0.4, height: 0.17, z0: -0.34, z1: -0.12, roof: 'flat', capFront: true, capBack: true, plate: { width: 0.8, height: 0.55 } }] },
  // INNER STALL ARC — nearer/larger 5-stall row, scalloped awning die-cut.
  { id: 'ch5-arc-inner', kind: 'midground', role: 'story', mech: 'keepstack',
    stories: [{ key: 'arc', a: 0.34, height: 0.12, z0: -0.06, z1: 0.1, roof: 'flat', capFront: true, capBack: true, plate: { width: 0.68, height: 0.24 } }] },
  // SOUK WINGS — the arcs continued to both page edges at matched depths
  // (row0 ~ rear arc, row1 ~ inner arc). ch3 citadel form, rfar <= 0.752.
  { id: 'ch5-souk-l', kind: 'backdrop', role: 'scenery', mech: 'skyline', side: 'left', rows: [
    { F: 0.5, zc: -0.3, height: 0.1, width: 0.24, standDeg: 64 },
    { F: 0.55, zc: -0.02, height: 0.08, width: 0.2, standDeg: 64 } ] },
  { id: 'ch5-souk-r', kind: 'backdrop', role: 'scenery', mech: 'skyline', side: 'right', rows: [
    { F: 0.5, zc: -0.3, height: 0.1, width: 0.24, standDeg: 64 },
    { F: 0.55, zc: -0.02, height: 0.08, width: 0.2, standDeg: 64 } ] },
  // TERRACE TREADS — the stepped plinth apron (mech-37 read, box family).
  // Lids = carpets + goods (lid-dominant camera), front caps = arcade risers.
  { id: 'ch5-tread-mid', kind: 'midground', role: 'story', mech: 'box', a: 0.3, height: 0.085, z0: 0.16, z1: 0.29, roof: 'flat', capFront: true },
  { id: 'ch5-tread-low', kind: 'midground', role: 'story', mech: 'box', a: 0.26, height: 0.045, z0: 0.34, z1: 0.46, roof: 'flat', capFront: true },
  // CROWD CHAINS — one linked cutout each (6 + 5 figures), standing on lids.
  // WALL REGIME, not the pack's 30/46 prop regime: a rider's width runs ALONG
  // its glue lines, whose z-run is width*cos(phi) — at phi 30 a 0.44 chain
  // marches 0.38 down the gutter, off its own lid and into the throng's band
  // (the A9 crossing that killed it). At phi 84 the same chain spans its
  // width LATERALLY across the tread (z-run 0.046, on-lid), which is the
  // rank-facing-the-reader read the pack's T8 "0.8 x lid span" law describes.
  { id: 'ch5-crowd-mid', kind: 'midground', role: 'figure', mech: 'rider', parentId: 'ch5-tread-mid', seat: 'boxLid', mountZ: 0.22, vDir: 1, phiDeg: 84, rhoDeg: 88, width: 0.44, height: 0.09 },
  { id: 'ch5-crowd-low', kind: 'midground', role: 'figure', mech: 'rider', parentId: 'ch5-tread-low', seat: 'boxLid', mountZ: 0.4, vDir: 1, phiDeg: 84, rhoDeg: 88, width: 0.36, height: 0.075 },
  // THE STALL ROW (HERO, was the 8-shopper throng) — SIX IDENTICAL STALLS the
  // READER RAISES. E3 s6 Wave-2, findings S6-5/S6-6.
  //
  // The blind reader found this spread's one working mechanism running backwards
  // to its own story: "the text and the card are about RAISING stalls. The
  // stalls start fully raised, and the only thing a reader can do is drag them
  // DOWN. There is no raise gesture on this page." They also could not find it
  // (25 screen px of travel, no rest cue) and could not read it ("dome with two
  // prongs... my first reading was backpacks").
  //
  // All three are one design fault: the chapter's verb was scenery. So the rank
  // is now the chapter's verb. It ships SLACK (restDeg) — six identical stall
  // patterns lying flat on the near apron when the spread opens, awning-and-post
  // die-cuts printed on the page like the master pattern the prose describes —
  // and the reader's drag stands them up, where the release law latches them.
  // Identical is the POINT: the reader praised "the same stall stamped out four
  // times — the repetition is the point", so the six are one shape six times,
  // raised by one gesture.
  //
  // NUMBERS (derived, __tests__/labs/storybook/s6-stall-row.test.ts):
  //  - height 0.13 -> 0.2 takes the top edge's FULL-STROKE screen travel from
  //    87 px to 134 px at the pinned reading camera. The bigger win is not the
  //    54%: it is that the stroke is now the reader's RAISE rather than a
  //    lowering of a row that was already up, so the whole 134 px is a payoff
  //    instead of a subtraction (the reader measured only ~25 px because they
  //    were nudging an erected row part-way down). Bounded ABOVE by page
  //    containment: the flat rest pose reaches hingeZ + height = 0.72 up the
  //    page, inside PAGE_H/2 = 0.75.
  //  - width 0.5 -> 0.6 keeps each stall 0.1 world wide (1:2 against the new
  //    height — a booth, not a mast) at six copies.
  //  - hingeX 0.4 -> 0.62 moves the rank OFF the terrace train's lateral span.
  //    At 0.4 the taller row screen-overlapped the tread-low carpet lid by 24%
  //    and the crowd-low rank by 13% (D-G7 art-overlap gate, floor 8%): the
  //    treads straddle the gutter with half-span a = 0.26, so a rank centred at
  //    0.4 always sits partly in front of them. At 0.62 the rank spans radial
  //    0.32..0.92 — its screen band starts 30 px outboard of the tread lid's
  //    edge — and it also mirrors the RAISE A STALL card's station on the left
  //    page (0.52..0.90): pattern on one page, the stalls it raises on the other.
  //  - restDeg 5 rather than 0: a leaf at exactly 0 is coplanar with the page it
  //    is glued to and z-fights the floor print. At 5 degrees the free edge sits
  //    a scored-fold's height proud — which is also the grab lip.
  //  - ripple (ROUND-2 A-4): "the six stalls rise in perfect unison. No stagger,
  //    no ripple, no wave. The one place the page could have earned 'a thousand
  //    stalls, raised by any pair of willing hands' and it moves like a single
  //    rigid object." The rank is now hinged as the six cards it is PRINTED as
  //    (they tile the same 0.6 of hinge line, so its footprint, hit surface and
  //    shadow are the ones that shipped), each lagging its neighbour by 5% of
  //    the reader's stroke — the family cap, 25% spent across the row. Every
  //    card still ends at the same angle: identical is the point, and the wave
  //    is what makes six identical things read as six pairs of hands rather
  //    than one machine. Free mechanically — the phase map is bounded above by
  //    the rank's own progress at every point (popup-mechanics.ts).
  //  - grabProjection 'cylinder' (N-5). "Six identical stall kits sit inert
  //    beside the one that works, directly contradicting the paragraph they
  //    illustrate. I press-dragged them up, down, left and right, individually
  //    and as a row: nothing." The hit surface was never the problem — the row's
  //    printed cards ARE its raycast meshes and a press engages on every one of
  //    them (instrumented live on the lane server: `beginGrab` fires at all six
  //    card centres). What failed is the DRIVE, and it failed exactly the way
  //    handle-projection.ts's class B1-C note says it must. This is a frontal
  //    standing rank: the hinge axis runs ACROSS the screen, so the pinned
  //    camera's view direction LIES IN the swing plane, and the plane read is
  //    ill-conditioned along it. Measured at the six card centres, the grab
  //    angle came back -2.47, -2.45, -2.33, +0.40, +0.52, +0.58 rad — the left
  //    half of the row reading a ray/plane crossing 140 degrees round the wrong
  //    side of the hinge, where the drag delta is meaningless and the drive
  //    clamps at the rest stop. Live before/after: a 240px up-drag moved the row
  //    by 4.8 mean dRGB from card 3 and 0.8 (bare-paper noise is 0.09) from card
  //    0. The cylinder read takes the angle off the flap's own tip circle
  //    instead, conditioned by that circle's angular width from the camera
  //    rather than by a vanishing dot product — the identical opt-in ch1-rank
  //    took for the identical reason, and the whole printed row answers now.
  { id: 'ch5-throng', kind: 'foreground', role: 'figure', mech: 'stripflap', side: 'right', anchor: 0.24, anchorZ: 0.52, slot: 0.3, slotZ: 0.52, hingeX: 0.62, hingeZ: 0.52, width: 0.6, height: 0.2, restDeg: 5, travelDeg: [5, 90], ripple: { count: 6, lag: 0.05 }, grabProjection: 'cylinder' },
  // TEA CORNER — the intimate counterweight, right apron, over a painted rug.
  //
  // TRAVEL WINDOW (S6-3): "Drag it down or right and it rotates past flat and
  // comes to rest fully upside-down — striped valance on top, dome pointing
  // down-left, steam plume drooping below the rug it was sitting on. This does
  // not read as folding; it reads as a hinge with no stop."
  //
  // The hinge always HAD its stop — the drive has been clamped to [0, 90] since
  // the family shipped, and 0 is flat on the page. What the reader met is that
  // FLAT READS AS INVERTED at this camera: the pinned reading eye is 27 degrees
  // above the desk, so its screen-up basis crosses zero at a hinge angle of
  // ~32 degrees, and below that the flap's own tip projects BELOW its hinge.
  // Clamping harder at 0 would have changed nothing.
  //
  // So the stop moves to 50 degrees, where the tip still stands ~21 px clear
  // above its hinge, and the fold reads as a fold for its whole travel. That is
  // also the more paper-true bound: the hidden strip is inextensible and taut at
  // rest, so a real strip flap has almost no downward give to give.
  { id: 'ch5-tea', kind: 'foreground', role: 'figure', mech: 'stripflap', side: 'right', anchor: 0.5, anchorZ: 0.17, slot: 0.56, slotZ: 0.17, hingeX: 0.62, hingeZ: 0.17, width: 0.14, height: 0.16, travelDeg: [50, 90] },
  // RAISE A STALL — the retained tabpiece, geometry verbatim, re-themed: legs
  // repainted as stall posts, deck a striped awning mid-raise, the fore-edge
  // tab a woodcut ⟡ RAISE A STALL ⟡ cartouche (B-MEANING: the playable IS the
  // chapter's meaning — he carved the patterns any hands can raise).
  // TURN-CULLED (Batch C-3, the dial/winch/dissolve lever): the spread's one
  // interaction-only piece, and the s5->s6 turn pair was the book's last
  // draw-budget miss (171.8 vs 170, gate-matrix G5). Its faces + hairlines +
  // shadow stop drawing through the fast middle of a turn and ramp back
  // inside the landing settle. Geometry is verbatim — no solver, pose or
  // fold-flat proof is touched.
  //
  // ROUND-2, THE STORY INVERSION (A-3). The blind reader found the mechanism
  // running backwards to its own prose a second time, in a subtler way: "the
  // COLLAPSED state (the X-braced flat template) is far more beautiful than the
  // raised one, which inverts the whole point of the mechanism", and "the rest
  // state is a half-built stall — ~60% raised at load, not flat, not standing.
  // It reads as unfinished, and it hides the flat-pattern state, which is the
  // state that actually illustrates the text."
  //
  // So the rest lift drops 60 -> 7 degrees: the spread opens on the MASTER
  // PATTERN lying flat on the page — the thing the prose actually celebrates
  // ("he carved master patterns from which any stall could be raised in a day")
  // — and the reader's pull is what raises it. 7 rather than 0 for the strip
  // flap's own reason: a leaf at exactly 0 is coplanar with the page it is glued
  // to and z-fights the floor print; at 7 degrees the fold sits a scored crease
  // proud, which is also the grab lip. The reader's stop is untouched at 88.
  //
  // THE RAIL (A-2). "The pull tab travels off the page into the void. At full
  // pull the tab card is entirely off the left page edge, floating over black
  // table AND overlapping the body-copy column." The strip now comes up through
  // a slot cut in the page at d = 0.60 and the tab is a 0.14 card riding ON the
  // paper. Full pull draws 2*legW*(1-cos 88) = 0.3474, so the card's outer tip
  // stops at 0.60 + 0.3474 + 0.14 = 1.087 — 0.063 inside the fore edge at
  // PAGE_W = 1.15. The tab can no longer leave the paper at any reachable draw.
  //
  // WHICH LANE, and why not the obvious one. The finding has TWO halves and the
  // second is not fixed by staying on the paper: this spread's chapter column is
  // HTML laid over the book, and at the pinned reading camera it covers the left
  // page's own fore half (measured off the 1x capture: the copy occupies roughly
  // x <= 437, y <= 615 of a 1600x900 frame). A lane on the gutter side of the
  // structure (z 0.14..0.28) puts the card at (311..390, 588..625) at full pull —
  // still under the last line of the paragraph. The lane therefore sits on the
  // READER's side of the structure instead, z 0.645..0.745: the whole travel
  // lands below the text block, the handle is between the reader and the pattern
  // it raises (which is where a hand goes), and it is still clear of the
  // structure's own z band and of both terrace treads, which never reach past
  // d = 0.30. z1 = 0.745 keeps a 0.005 margin inside PAGE_H/2 = 0.75.
  { id: 'ch5-raise-stall', kind: 'midground', role: 'scenery', mech: 'tabpiece', side: 'left', form: 'table', hingeX: 0.9, z0: 0.36, z1: 0.64, legW: 0.18, deckD: 0.2, liftDeg: 7, turnCull: true, rail: { slitD: 0.6, tabLen: 0.14, z0: 0.645, z1: 0.745 } },
]

// Chapter VI — the crescendo steps THROUGH the door (E3 s7 scene pack,
// .superpowers/sdd/scenes/s7-scene-pack.md): the book's first INTERIOR.
// Every prior chapter showed a building from outside; here the viewer
// stands inside the nave of vaults, looking down the processional axis.
// REVERENCE = symmetry + recession, explicitly not size (playbook §6): four
// width-graded arched oanave ranks recede down the gutter axis, rank behind
// rank, rear widest — at the high reading camera they read as a rising
// stack of gilded arch crowns (bench e3s7-nave-sightline.mjs: 15.3 / 8.6 /
// 7.4 / 7.6% frameH crown bands), with the floor theater (painted gold
// processional path + pooled aurora light) visible THROUGH the nested
// portals. The old exterior compound (pines / treasury / spire / vines /
// door / banner / fringe) is retired per the pack's fate list: the 0.91
// centered hero was exactly the occluder class that killed the prior
// vista, and the fringe would sit on the painted path. Rank rho values sit
// 3 degrees above the pack's sketch: the flat-plane sightline bench never
// modeled the standing LEAN (crease z-recession ~ h * cot(lambda)), and at
// the sketch's rho the mouth ranks' wing tops pierced the apse sheet at
// rest (D-G2); the raised rho stands the ranks upright enough to clear
// while leaving every bench-fixed number (stations, widths, heights,
// apertures) untouched — chevron tracks phi, so the relief pop survives
// (measured in popup-oanave.test.ts, R3).
const CH6_LAYERS: readonly SceneLayer[] = [
  // THE NAVE (new family 'oanave' — popup-oanave.ts: host kinematics = the
  // shipped v-fold wall solver VERBATIM; die-cut portal apertures; OA relief
  // strata cut FROM each sheet, zero glue, dihedral-slaved). Deepest first:
  // the apse — solid, no relief; the aurora-rose window and treasure tiers
  // are painted (the grazing ray through D's portal apex reaches y = -0.11
  // at this plane: the apse face is INVISIBLE through the portals, so its
  // glow ships as the dome crown band + pooled floor light, bench §B).
  { id: 'ch6-nave-a', kind: 'backdrop', role: 'backdrop', mech: 'oanave', apexZ: -0.52, vDir: -1, phiDeg: 84, rhoDeg: 88, width: 1.9, height: 0.62, crownWingH: 0.46, chevronDeg: 10, aperture: null, strata: [] },
  { id: 'ch6-nave-b', kind: 'midground', role: 'story', mech: 'oanave', apexZ: -0.3, vDir: -1, phiDeg: 76, rhoDeg: 87.5, width: 1.52, height: 0.52, chevronDeg: 14, aperture: { halfW: 0.2, apexH: 0.38 }, strata: [{ kind: 'archMolding', e: 0.1, band: [0.4, 0.5] }, { kind: 'columnPair', e: 0.09, band: [0.02, 0.36] }] },
  { id: 'ch6-nave-c', kind: 'midground', role: 'story', mech: 'oanave', apexZ: -0.08, vDir: -1, phiDeg: 74, rhoDeg: 86.5, width: 1.16, height: 0.44, chevronDeg: 14, aperture: { halfW: 0.24, apexH: 0.32 }, strata: [{ kind: 'archMolding', e: 0.075, band: [0.34, 0.42] }, { kind: 'columnPair', e: 0.09, band: [0.02, 0.3] }] },
  // Rank D, the portal mouth — the keystone step is the book's only ORDER-2
  // relief cascade (a stratum whose spine is the parent stratum's crease).
  { id: 'ch6-nave-d', kind: 'hero', role: 'story', mech: 'oanave', apexZ: 0.157, vDir: -1, phiDeg: 72, rhoDeg: 85.5, width: 0.78, height: 0.36, chevronDeg: 14, aperture: { halfW: 0.28, apexH: 0.26 }, strata: [{ kind: 'archMolding', e: 0.1, band: [0.27, 0.34] }, { kind: 'keystoneStep', e: 0.05, parent: 0, band: [0.3, 0.34] }] },
  // VOLUMETRIC: a banker's strongbox on the path to the vaults — the
  // chapter's enclosed volume until the treasury itself becomes a box
  // (waiting on the art split). Completes the census: 6/6 chapters.
  { id: 'ch6-strongbox', kind: 'backdrop', role: 'story', mech: 'box', a: 0.095, height: 0.1, z0: 0.38, z1: 0.5, roof: 'flat' },
  // RECURSION (C4v2): the treasury's NIGHT-LAMP standing ON the strongbox lid.
  //
  // WAVE-2 s7 (blind finding 16 "a lit candle with a painted halo that never
  // flickers", and the ledger's idle-accent order). The piece was a rampant
  // griffin crest, which at its 0.09-world size is ~45 screen px of gold
  // filigree — a silhouette no reader could name. Recast as the object the
  // chapter's own light needs: a hooded brass lamp burning over the waystation,
  // whose flame is the spread's IDLE ACCENT. `glint` not `sway` — a lamp
  // hanging in still air does not swing, it BREATHES, and a 12% modulation of a
  // hot core is exactly what a flame does. (The nave ranks stay exempt: an OA
  // relief cascade is cut from the sheet, and a cathedral that trembles is a
  // broken mechanism, not weather.)
  { id: 'ch6-crest', kind: 'midground', role: 'scenery', mech: 'rider', parentId: 'ch6-strongbox', seat: 'boxLid', mountZ: 0.42, vDir: 1, phiDeg: 29, rhoDeg: 43, width: 0.09, height: 0.08, idle: { kind: 'glint' } },
  // Dress on the strongbox: the GLAZED INSPECTION PANE on the front cap, minted
  // coins heaped at the side-wall base (v=0 — no overhang below the page-glued
  // edge).
  //
  // WAVE-2 s7 (S7-1). The pane slot used to carry a violet WAX SEAL, and with
  // the box's own gold lock plate beside it that made the strongest press-me cue
  // on the spread — dead centre foreground, on a piece the reader can never
  // move (a `box` is posed by the spread dihedral alone). The blind reader
  // clicked it and dragged it four ways and called it "the strongest interact-
  // with-me object on the page is dead". The seal now rides the COUNTING WHEEL's
  // hub (`ch6-assay`, below), which turns; what stays here is a small pane of
  // the treasury's own glass with the gold showing behind it — the chapter's
  // thesis in miniature, and scenery that no longer advertises. The ID keeps its
  // `-seal` name deliberately (the s6 lane's ch5-throng precedent): renaming a
  // baked piece churns five files and has broken the atlas region lists three
  // times; the name is documented here instead.
  // NOT idle-tagged, deliberately: a `dress` renders through DressPopupLayer,
  // not the generic two-quad layer, so a tag here would be dead paperwork —
  // and idle-life.test.ts says so out loud rather than letting it rot. The
  // spread's two accents ride the pieces whose renderers honour them: the lamp
  // (a rider) and the clerk's candle (a strip flap, glint-only).
  { id: 'ch6-strongbox-seal', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch6-strongbox', seat: 'capFrontL', u: 0.02, v: 0.03, width: 0.07, height: 0.07 },
  { id: 'ch6-strongbox-coins', kind: 'backdrop', role: 'scenery', mech: 'dress', parentId: 'ch6-strongbox', seat: 'wallL', u: 0, v: 0, width: 0.12, height: 0.06 },
  // PLAYABLE, THE SPREAD'S HEADLINE (WAVE-2 s7, S7-1) — THE COUNTING WHEEL.
  //
  // "...a new treasury was rising — AMIO by name — with walls of glass, so the
  // people might always see their gold." The chapter's own sentence is a
  // WINDOWED DIAL: strongrooms turning past panes of glass so anyone may look
  // in. So the play is a volvelle (popup-volvelle.ts, the shipped s4 family,
  // solver and layer used VERBATIM — this piece adds no mechanism code at all):
  // a gilt wheel riveted flat into the treasury floor under a static card die-
  // cut with three GLASS ARCH windows. Eight sectors, eight strongrooms (bar
  // gold, coin, plate, ledgers, the jewel case, the aurora vault...); one 45deg
  // detent step advances every window by one room, so the art VISIBLY changes
  // per click — the s4 lane's hard-won lesson (six tilted copies of one badge do
  // not communicate a change; the sectors here are eight DIFFERENT rooms).
  //
  // WHERE THE SEAL WENT. The violet wax seal comes off the strongbox and rides
  // this wheel — but on the THUMB LOBE that juts past the rim, NOT on the hub.
  // The layer's grab reads a pointer angle about the hub and discards anything
  // inside HUB_DEADZONE (0.25 R), so a seal painted at the centre would be the
  // one part of the dial that does not answer a twist: the exact defect this
  // item exists to kill, rebuilt one ring inward. On the lobe the seal is the
  // grip — the object the blind reader tried to press is now the thing the hand
  // turns — and the hub carries a plain gold rivet, which is what a hub is.
  //
  // ROUND-2 (S7R2-1). The blind re-reader turned this wheel two full
  // revolutions each way and reported "no end-stop, no detents, no resistance"
  // and "I could not find one thing in the scene it changes". Live decomposition
  // (bench/s7r2-wheel-live.mjs, hi-res crops at three detents) settled which
  // half was broken: the mechanism was RIGHT — the dial spins, the faceplate is
  // static, the sectors under the vitrines really do change every 45 deg — and
  // the change arrived at a size no reader resolves. The disc projected ~110 x
  // 75 screen px at the reading camera, so each vitrine framed ~30 x 20 px of
  // which the changing gold was ~12 x 10. (The detent bench had measured a
  // SQUARE 144 px disc: it never applied the page-flat foreshortening, so it was
  // reading ~2.5x the area the reader gets. Both were true; one was misleading.)
  //
  // So the round-2 fix is size and consequence, not plumbing:
  //  - RADIUS 0.13 -> 0.165 (1.27x linear, 1.6x area) and the vitrines widen
  //    (halfWidth 16 -> 18 deg, band 0.38..0.88R -> 0.35..0.91R): ~2.4x the
  //    aperture the change has to happen inside.
  //  - `crank: 'tangential'` — the syspatch's LATENT item. A live hand probe
  //    (bench/s7r2-drag-live.mjs) had a 240 px stroke across the rim buying
  //    17.4 deg and saturating, the same stroke reversed buying zero, and a
  //    200 px vertical buying 3.1 deg. See popup-volvelle.ts's crank block.
  //  - the art carries the transformation: eight strongrooms whose GOLD TALLY
  //    runs 1..8 in order, so the three vitrines always frame three consecutive
  //    rooms and one detent marches the whole staircase — the counting-house
  //    counting, which is a shape a reader reads at 25 px where a swapped glyph
  //    is not (generate-art.mjs ASSAY_VAULTS).
  //
  // SEAT re-derived at the new radius: quad d 0.305..0.635, z 0.34..0.67.
  // Page edge |z| <= PAGE_H/2 = 0.75 (margin 0.08) and d <= PAGE_W = 1.15.
  // Clear of ch6-coffer (z <= 0.24, margin 0.10). ch6-steps ends at z 0.32,
  // margin 0.02 in z — but the dais sits at the SPINE (its struts glue at
  // d 0.10..0.15) and this wheel starts at d 0.305, so the two never share a
  // point; the z figure is a bound, not a contact. Clear of ch6-strongbox
  // (right-page d <= 0.095, margin 0.21). Coplanar, so it needs no fold-flat
  // envelope — it rides the folding page and the book's own close carries it
  // down (the volvelle rule), and the reader's angle latches through page turns
  // under the release law.
  {
    // `scenery`, like the s4 dial: the C1v2 anatomy census admits only assembly
    // mechs at `story` role, and art-overlap's pose solver has no volvelle case
    // (a coplanar disc has no silhouette to overlap) — both throw on a `story`
    // volvelle. The role is a census word, not a ranking; this piece is the
    // spread's headline all the same.
    id: 'ch6-assay', kind: 'foreground', role: 'scenery', mech: 'volvelle',
    side: 'right', hubD: 0.47, hubZ: 0.505, radius: 0.165, sectors: 8,
    crank: 'tangential',
    windows: [
      { psiDeg: 45, halfWidthDeg: 18, rMid: 0.63, rHalf: 0.28 },
      { psiDeg: 90, halfWidthDeg: 18, rMid: 0.63, rHalf: 0.28 },
      { psiDeg: 135, halfWidthDeg: 18, rMid: 0.63, rHalf: 0.28 },
    ],
  },
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
  // FLOATING TIER (C3v2, retuned per pack §4c): the entrance DAIS the gold
  // processional path climbs into rank D's portal — a low wide BRIDGE just
  // downstage of the mouth. Its grazing ray lands at y ~ 0 exactly at D's
  // sill, so it hides nothing inside the nave (bench §A), and the
  // strongbox's shadow dies at z ~ 0.22 before its top. (Re-derived from
  // the pack's sketch: its two identical strut ranks share one
  // cross-section — coincident ridges make a degenerate vertical deck — so
  // the dais is built as a proper LOW MIRROR BRIDGE in the ch5-goods
  // proportions instead, same z band and rise as the pack.)
  //
  // WAVE-2 s7 (S7-3), RE-DERIVED. Each rank used to carry TWO 0.045-deep bays
  // ([[0.2,0.245],[0.275,0.32]]), so four narrow tent blades stood in a row
  // behind the strongbox. Decomposition capture (bench e3w2s7-decompose.sh:
  // drop this one layer and the shape vanishes) proved those blades ARE the
  // "spray of ~20 thin strips exploding outward in a spiky starburst" the blind
  // reader could not identify at 3x — the ~120x90px foreground centrepiece that
  // "reads as pure geometric noise". A narrow tent seen near end-on at the
  // lid-dominant reading camera is a blade, and four of them mirrored is a
  // splay. One WIDE bay per rank over the same z band gives the same deck the
  // same rise on two SOLID risers, which is what a flight of steps looks like.
  // The RISE drops 0.1 -> 0.055 in the same pass. Widening the bays alone left
  // two broad tent panels splaying like wings over the portal arch — legible as
  // an object at last, but not yet as a STEP. A dais is low by definition (the
  // pack calls it "a low wide BRIDGE just downstage of the mouth"); at half the
  // stand-proud slack the tents lie shallow, the deck sits down where a landing
  // belongs, and the piece stops competing with the strongbox in front of it.
  //
  // ROUND-2 (S7R2-2), THE THIRD PASS, AND THIS TIME THE DECK. The blind
  // re-reader called this "the tallest thing at the gutter and the most
  // mechanism-shaped object on the page... a symmetric folded-paper canopy of
  // 6-8 flat teal panels", could not name it, and pressed it in four directions.
  // A layer-drop decomposition (bench/s7r2-decompose.sh: comment out this one
  // entry and the canopy vanishes, the tan mass behind it does not) proved the
  // canopy is THIS piece — and the arithmetic says which part of it. At rise
  // 0.055 the two ridges land 0.1202 apart, so a deck of two 0.09 panels has to
  // put its crease sqrt(0.09^2 - 0.0601^2) = 0.067 ABOVE the chord between them:
  // a tent with 48 deg panels, standing on ridges already 0.13 up the bisector.
  // Every previous pass tuned the STRUTS (four blades -> two, rise halved,
  // repainted dark) and left the deck peak untouched, which is why the shape
  // kept coming back as wings.
  //  - qA/qB 0.09 -> 0.065: peak 0.067 -> 0.0247, panel slope 48 deg -> 22 deg.
  //    A landing with a slight crown, which is what a bridge deck over a gutter
  //    is. Deliberately NOT the degenerate q = sep/2 = 0.060, where the crease
  //    is coplanar with the chord and the two panels become one flat sheet with
  //    a fold line the solver has to disambiguate.
  //  - the z span widens (struts 0.2..0.32 -> 0.19..0.33, deck 0.2..0.32 ->
  //    0.18..0.34) so the piece is longer than it is wide and reads as a step
  //    rather than a peak — and the deck overhangs its struts 0.01 each end,
  //    which is the floating look the family exists for.
  // THE WIDTH IS RATCHET-LIMITED, not chosen. D-G2's mid-turn ceiling for
  // spread-7 is 122 illegal (pair, station) hits and ceilings only ever go
  // DOWN. Measured on this gate: the wanted 0.15..0.37 deck costs 138 (the
  // deck reaches across rank D's apex station at z 0.157 at one end and up to
  // the strongbox's z 0.38 at the other, and brushes both as they sweep);
  // 0.17..0.35 costs 126; 0.18..0.34 is the widest that stays inside the
  // ratchet, and it is what ships. The q change carries the identity fix
  // anyway — the peak is what made it a canopy.
  // Clear of ch6-strongbox (z >= 0.38, margin 0.04 in z and the box sits at
  // right-page d <= 0.095 against this deck's d <= 0.13) and of ch6-assay
  // (d >= 0.305 against this piece's d <= 0.13).
  { id: 'ch6-steps', kind: 'midground', role: 'story', mech: 'platform', strutA: { glueL: 0.15, glueR: 0.1, rise: 0.055, spans: [[0.19, 0.33]] }, strutB: { glueL: 0.1, glueR: 0.15, rise: 0.055, spans: [[0.19, 0.33]] }, qA: 0.065, qB: 0.065, deckZ0: 0.18, deckZ1: 0.34 },
  // NEW: the intimate counterweight (T-COUNTERWEIGHT, ref 140028 Kristoff
  // corner) — a tiny clerk kneeling over his ledger by candlelight on the
  // left apron, already at prayer while the vaults are still rising around
  // him (stripflap = the early-riser family). His 3/4 facing toward the
  // coffer is a zero-cost affordance pointer (R5 discoverability).
  //
  // WAVE-2 s7 (S7-8 + the idle-accent order). The blind reader found him
  // "only legible at 4x zoom; at 1:1 a ~50px navy blob", and his bow "almost
  // invisible payoff for a gesture nobody will find". Two changes, no new
  // mechanism and NO inversion of the gesture:
  //  - SIZE. 0.16x0.20 -> 0.21x0.26. The figure is the chapter's intimate
  //    counterweight against a full-spread nave; at the old size the whole
  //    vignette (hood, ledger, candle) was under 50px and none of it read.
  //    Bigger body = a bigger swept silhouette, so the SAME fold now moves
  //    a shape the reader can see from across the spread.
  //  - LIFE + PAYOFF. `idle: glint` is the CANDLE — he is the only lit thing
  //    on the left apron and his flame never moved; a 12% breath on his print
  //    is the halo the blind reader asked for, and it is also his reward for
  //    being found (the ledger order's own first option). The stripflap layer
  //    gained the OPT-IN idle hook popup-spread.tsx has had since FIX-SYS;
  //    untagged strip flaps are bit-identical.
  //  DELIBERATELY NOT DONE: an angle-keyed art payoff ("the quill writes a
  //  line"). This family prints ONE texture on a rigid die-cut, so a reveal
  //  that changes with the fold angle is a new mechanism, not a scene fix.
  //  ROUND-2 (S7R2-5), the ch1-rank precedent: `grabProjection: 'cylinder'`.
  //  The clerk is a frontal standing figure, so his swing plane very nearly
  //  contains the view direction and the plane read is ill-conditioned — class
  //  B1-C exactly. Measured live (bench/s7r2-drag-live.mjs): a 160 px leftward
  //  drag ran him 76.8 -> 33.7 -> 0 in three 20 px sub-steps and then sat dead,
  //  and rightward and downward drags were both pinned at 90 for the whole
  //  stroke. One flag, and the gesture-axis known-failure mark comes out with
  //  the fix (gesture-axis.test.ts OTHER_LANE_AXIS_FAILURES).
  { id: 'ch6-clerk', kind: 'foreground', role: 'figure', mech: 'stripflap', side: 'left', anchor: 0.2, anchorZ: 0.44, slot: 0.3, slotZ: 0.44, hingeX: 0.55, hingeZ: 0.44, hingeDeg: 30, width: 0.21, height: 0.26, grabProjection: 'cylinder', idle: { kind: 'glint' } },
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
    hero: 'ch1-inn-row', // vfold, expected sweep ~0.8 (s1 stripflap / s3 child — rotation holds)
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
    // E3 s3: the SWARM is the chapter — 24 wave-staggered struts pour out of
    // the hive as the page opens (crown strut tip chord 0.78 > 0.525 floor,
    // and 24 of them do it in a wave). Family swarmarc differs from s2
    // (vfold) and s4 (keepwinch) — rotation law holds.
    hero: 'ch2-swarm',
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
    // E3 s6 R4 GRAND-DENSE register: ONE amphitheater composition (arcs +
    // wings + box train) rather than the per-chapter crowd template — the
    // goods platform's role moved onto the tread lids, so the spread rides
    // the declared showpiece exemption exactly as the E1 keep does (charter
    // E-P2; the Chapter.showpiece doc anticipates extending it this way).
    // Physics/quality gates (A9/A10, motion, sightline) stay hard.
    showpiece: true,
    // D-G1/D-G8: the stall-rank stripflap — six identical stalls the READER
    // raises at the terrace foot. Strip-driven family → exempt from the 0.525
    // page-turn sweep floor, and after the s6 Wave-2 inversion that exemption is
    // literal rather than anticipatory: this piece's signature moment IS the
    // hand-driven one, exactly the rationale D-G8 states. Rotation holds (prev
    // ch4 hero tabpiece, next ch6 hero vfold).
    hero: 'ch5-throng',
  },
  {
    spread: 7,
    experienceId: 'xdatagroup',
    numeral: 'VI',
    kicker: 'Chapter the Sixth',
    title: 'The Northern Treasury',
    narration:
      "And so at last the road bent north, to a kingdom of pine and long light, where a new treasury was rising — AMIO by name — with walls of glass, so the people might always see their gold. There the hero works to this day: raising vaults, drawing plans with the founders themselves, and teaching young apprentices the old craft. Whether he lives happily ever after is not yet written — the best chronicles never quite end.",
    // Accents swap (pack §4e, PACK REVIEW s7 decision 2: pine-green -> gold,
    // provisionally approved): the chapter is now a midnight/teal INTERIOR
    // full of quiet gold, not a pine exterior. Audited usages: accents[0] is
    // the chapter's page-edge/tab tint (book.tsx) — deep teal #14454b reads
    // as the same dark family the pine green did; placeholder art cycles the
    // whole array, where gold #d4a13c replaces amethyst (aurora amethyst now
    // lives ONLY in the painted apse window, the daisy-ref discipline).
    accents: ['#14454b', '#4fd6b8', '#d4a13c', '#1d2a45'],
    layers: CH6_LAYERS,
    hero: 'ch6-nave-a', // oanave (new family) — the apse rank; R2 sweep measured 1.337 in popup-oanave.test.ts
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
  // IDLE (BW-2): the boy's gilt crest glints. The overture is the first thing a
  // reader looks at and the longest thing they look at before touching
  // anything — if any spread must not be pixel-frozen it is this one — but the
  // proscenium is the promise of the tale and must hold absolutely still, so the
  // life goes on the two small pieces in front of it.
  { id: 'title-crest', kind: 'hero', role: 'scenery', mech: 'child', parentId: 'title-hero', mount: 0.24, vDir: 1, phiDeg: 62, rhoDeg: 84, width: 0.18, height: 0.13, idle: { kind: 'glint' } },
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
  // (…and the wax-seal tuft on the berm sways: a scrap of a piece standing in
  // the open upstage, the same swivel about its own ridge.)
  { id: 'title-swell-seal', kind: 'backdrop', role: 'scenery', mech: 'rider', parentId: 'title-swell', seat: 'tentRidge', mountZ: -0.55, vDir: -1, phiDeg: 32, rhoDeg: 52, width: 0.12, height: 0.095, idle: { kind: 'sway' } },
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
//
// NO IDLE TAG here either (BW-2 pass): the spread is the bag, the burst and the
// map table — its own composition — and everything else is a handle, a dress
// patch or a rotor. The fan burst looks like the obvious candidate and is not:
// its members are synthesized v-fold layers (`fanMemberLayers`) that carry only
// the fields listed there, so a tag on the fan would be dead paperwork. Giving
// the treasures a shimmer means teaching that synthesis to carry the tag, which
// is a change to the anatomy layer, not to this file.
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
  // IDLE (BW-2): the raven is mid-LAUNCH, the one piece in the whole book whose
  // art says it is not resting on anything — so it drifts, a fraction of a
  // millimetre along its own arm axis. On a bird already off the desk the eye
  // reads that as the beat of a wing catching air; the closing line asks the
  // reader to send it, and a frozen raven refuses.
  { id: 'end-raven', kind: 'hero', role: 'figure', mech: 'kinetic', apexZ: 0.45, vDir: 1, phiDeg: 45, rhoDeg: 88, armW: 0.26, armLen: 0.42, flapW: 0.16, flapLen: 0.16, idle: { kind: 'drift' } },
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
