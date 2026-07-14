# The Showpiece Reset — goal charter (Part E) — DRAFT, pending pin

2026-07-14. Drafted from the user's quality verdict on the D-series
("in 1 word everything looks cheap... we added variety and lost the
quality"). Supersedes Part D as the umbrella goal once pinned. All
physics laws and D-gates remain floors — they are necessary and
insufficient: they cannot see cheap.

## The honest diagnosis (what went wrong)

The D-series built mechanism variety behind numeric gates while art
stayed kraft, then squeezed generated paintings onto pre-designed
abstract geometry. The v1 book — few mechanisms, art-first v-folds —
looked beautiful. We inverted art-leads into mechanism-leads and the
quality collapsed even as every test stayed green. Specific fails,
his words: tab-piece art "doesn't convert" (treasure painted on a
tent reads as wallpaper, not a pile of gold — ch4 worst); the knob
tiers are "just a mesh... 2 small pieces of paper" (small +
single-crease + mirror-squeezed art); flap interactions are "a piece
of paper tilting in a choppy manner in 1 axis"; ch3 balcony pieces
sit invisible behind the backdrop; in-scene art reads worse than the
generated files.

## North star (pinnable one-liner)

Every spread is a showpiece: an art-led, near-backdrop-scale paper
architecture that erects as the page opens and folds away
beautifully — lit, composed, and animated at awwwards craft level —
with interactions that feel like operating a precious paper machine.

## Pillars

E-P1 ART LEADS (the inversion that fixes the inversion)
   - No structure ships before its VISUAL is approved: concept
     captures (look-dev) come first, geometry derives from the
     approved image — never art onto abstract forms.
   - Per-face art briefs like the box family: every paintable face
     of a structure gets its own aspect-true prompt; no mirroring/
     squeezing hacks on delivered art.
   - Audit and fix the render path where in-scene art reads worse
     than the source (material/lighting/scale/compression — measure
     side-by-side before touching anything).

E-P2 GRAND ARCHITECTURE (his ask, verbatim-approximate: "pages that
     erect full multi-story structures that fold beautifully and
     look amazing in 3d space")
   - Each chapter spread gets ONE multi-story volumetric centerpiece
     approaching backdrop height — stacked tiers with real
     dimensions (multi-face, hollow, walkable-looking), erecting on
     page open, folding dead flat on close.
   - Prune the crowds: fewer, larger, distinct structures beat many
     small pieces (small pieces read as debris). Variety survives
     at the BOOK level (no two spreads share a construction), not by
     piling mechanisms per spread.
   - Blender MCP is an allowed lane for simple 3D assets/references
     where paper solvers can't reach the look; research first when
     unsure (Sabuda/Reinhart showpiece references, awwwards paper
     sites).

E-P3 CRISP MOTION
   - 60fps interaction budget: profile and eliminate the choppiness
     (frame-time gate during drags/turns on a mid-tier machine).
   - Interactions produce composed, multi-part responses — pulling
     a tab or twisting a knob moves a MACHINE (linked parts,
     secondary motion, settle), never a lone plane on one axis.
   - Every animation eased with intent; page-turn + erection choreo
     reviewed as motion design, not just physics.

E-P4 VISUAL VERIFICATION (the new gate he asked for)
   - Golden boards: per spread, an approved reference capture set
     (rest, mid-turn, interaction poses). Every change posts
     BEFORE/AFTER against the board; visual degradation blocks the
     change regardless of green tests.
   - Automated composition checks where geometry can prove them:
     SIGHTLINE GATE (no piece meaningfully occluded by backdrops
     from the reading camera — the ch3 balcony class), SCALE FLOORS
     (story pieces >= a stated fraction of backdrop height),
     screen-coverage sanity per spread.
   - The user is the merge gate at phase boundaries (async, as
     before): contact sheets of golden-board diffs, not raw dumps.

## Phase roadmap (sketch — refine at pin time)

E0 DIAGNOSE (no redesign yet): (a) art-fidelity audit — source PNG
   vs in-scene render side-by-side for every painted piece; name
   the degraders (lighting/tint/scale/webp/UV); (b) interaction
   perf profile — find the chop; (c) sightline audit — every
   occluded piece listed; (d) golden-board harness built (the
   visual gate infrastructure).
E1 THE PILOT SHOWPIECE: rebuild ONE chapter (candidate: ch4 dunes —
   his named worst — or ch3 citadel) end-to-end the new way:
   concept board -> his approval -> mechanism derived FOR the
   approved look (multi-story, near-backdrop scale) -> per-face art
   briefs -> integration -> golden board. This calibrates the whole
   pipeline before rollout.
E2 ROLL-OUT: remaining chapters to the pilot's bar, one at a time,
   pruning small pieces as centerpieces land.
E3 INTERACTION REWORK: flaps/tabs/knob rebuilt as machine moments
   (multi-part, crisp, 60fps), keeping the derived physics laws.
E4 AWWWARDS POLISH: light/shadow refinement, endpapers, die-cut
   voids, sound moments, cursor/micro-interactions, final e2e +
   whole-branch review + PR.

## Open questions for the pin (his call)

1. Pilot chapter: ch4 (named worst) or ch3 (knob-tower home)?
2. Prune list: which existing small pieces may die outright vs be
   absorbed into centerpieces? (Default: orchestrator proposes per
   spread at E1/E2, he vetoes.)
3. Blender scope: reference-only, or shipped GLB assets for select
   centerpieces (hybrid paper+3D look)?
4. Golden-board judging cadence: per phase (default) or per spread?
