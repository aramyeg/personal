# Part E benchmark (v0 SKELETON) — visual gates for the showpiece reset

2026-07-15. Measuring stick for the Part E loop (charter:
2026-07-14-showpiece-reset-goal.md). DRAFT: gate structure fixed,
thresholds marked TBD are filled from the E0 diagnosis before this
spec is pinned. All D-benchmark gates (2026-07-13-grand-book-
benchmark.md, D-G1..D-G9) remain in force as floors underneath —
they are necessary and insufficient: they cannot see cheap. E-gates
judge what the D-gates cannot: how it LOOKS and how it FEELS.

## Doctrine

- A visual gate FAILURE blocks a change even when every numeric
  test is green.
- Golden boards are the unit of judgment: standardized capture sets
  per spread, blessed by the user, diffed on every change.
- Floors only ratchet upward, same as C/D doctrine.

## Gates

E-G1 GOLDEN-BOARD DIFF (the anti-degradation gate) — RESOLVED
  2026-07-16 (harness live: .superpowers/sdd/bench/golden/, three
  commands documented in its README; first full blessed set = 64
  stations across all 10 spreads)
  - Stations per spread: rest, mid-turn 25/50/75%, two parallax
    tilt extremes, each drivable piece at ~60% travel. Every
    station double-captured (throwaway + keeper).
  - THRESHOLD (measured): pixel-threshold 24/255, image threshold
    0.5% diff pixels. Noise floor measured per station across all
    spreads: 0.033–0.060% (worst: s9 rest — dust-mote layer is
    irreducibly nondeterministic; freeze param filed as future
    app-code improvement). Real-move signal: 0.72% = 12x worst
    noise. Never tighten below ~0.1% while dust is unfrozen.
  - Every change touching visuals runs diff-boards against the
    blessed set; any failing image requires either a bless
    (intentional improvement — orchestrator judgment, user at
    phase boundary) or a revert. Degradation never ships. Exit
    code enforces it (verified: intentional-change demo fails at
    0.72% with heatmap outlining exactly the moved piece).
  - Blessed set lineage: user-approved at phase boundaries; between
    boundaries the orchestrator blesses only strict improvements.
    Blessing overwrites (no history) — bless only reviewed boards.

E-G2 SIGHTLINE (the "book completes 3D space" law) — RESOLVED by
  E0c audit 2026-07-16
  - Technique (proven, capture-verified): run the real pose solvers
    in Node for true world-space geometry, sample each layer's own
    surface on a fine screen grid, ray-cast from the reading camera
    (book-scene EYE/LOOKAT) against all nearer layer quads. Measure
    at rest + all 4 parallax-tilt extremes (±0.07/±0.11 rad).
  - Classification (adopted from E0c): FULLY_HIDDEN >= 95%,
    MOSTLY_HIDDEN > 50%, PARTIAL > 8% (D-G7 overlap floor), else
    CLEAR.
  - Gate: no STORY-role piece FULLY or MOSTLY hidden at rest —
    HARD ZERO, no whitelist. Tilt-extreme-only crossings (> 50%
    only at a parallax corner) are reviewed, not auto-failed.
  - Partial overlaps remain governed by the D-G7 whitelist; stale
    whitelist entries invalidated by measurement are removed (the
    "ch2-hero x ch2-meadow depth-echo" entry is measured FALSE —
    meadow is 100% hidden at rest).
  - E0c measured debt (fix during E1/E2 rebuilds, worst first):
    ch2-meadow 100% (story platform, invisible); ch6-strongbox
    assembly 73–100% (box/crest/seal/coins behind ch6-fringe);
    ch4-chest assembly 70–100% (behind ch4-foreground); plus
    lower-priority scenery cases in the E0c table.
  - CORRECTION to the charter: ch3-balcony is only 2.4% occluded —
    its invisibility is CAMOUFLAGE (matching placeholder tint), an
    E-G5 art-legibility case, not a sightline case.
  - Full data: .superpowers/sdd/bench/out/e0/sightline/
    (occlusion-raw.json, occlusion-table.tsv, annotated captures).

E-G3 SCALE FLOORS (anti-debris)
  - Each spread's HERO/centerpiece: height >= [TBD-E1: fraction of
    backdrop height the approved boards establish; charter target
    "approaching backdrop height"] and footprint >= [TBD].
  - Story-role pieces: minimum on-screen size at rest — E0a data
    brackets the legibility floor: 115–215px long edge all fail,
    >= 620px reads (1600px reference viewport). Proposed floor
    ~300–400px CSS long edge; CONFIRM against the E1 boards before
    pinning.
  - Dressing pieces exempt but counted: max [TBD] small pieces per
    spread (prune law).

E-G4 FRAME-TIME + ARTIFACT (crisp motion, his pinned bar) —
  RESOLVED by E0b profile 2026-07-16 (data:
  .superpowers/sdd/bench/out/e0/perf/)
  - Measurement law: HEADED Chromium only — headless falls back to
    SwiftShader software WebGL and inflates frames 10–20x (measured
    ~150ms idle frames that are renderer artifacts). Never gate on
    headless numbers.
  - Baseline measured (warm, headed, dev): page turns 8–9% of
    frames > 33ms (worst 100–367ms); handle drags 1–2% > 33ms;
    first-ever visit to a spread: 12 frames in a 2.3s window
    (mean 190ms, worst 966ms) — dominated by first-use SHADER
    PROGRAM COMPILATION, not texture decode.
  - Gate targets (the fix wave must reach, then ratchet): during
    warm turns and drags, ZERO frames > 33ms and p95 <= 16.7ms;
    first-visit stall eliminated via shader warm-up/precompile.
    Gate binds on production-build measurements at phase
    boundaries; dev numbers tracked separately.
  - Root causes filed for the fix wave: (1) per-layer
    MeshBasicMaterial instances (every popup layer allocates its
    own; three re-validates each material's program cache key per
    frame — getParameters/getProgram dominate every CPU profile)
    => pool materials by (color, transparent, alphaTest, side);
    (2) shader compile on first spread visit => precompile/warm-up.
    Input architecture confirmed GOOD (module-level drive channel,
    no React state per pointermove) — do not rework it.
  - Artifact half, ZERO TOLERANCE: no flashing, flickering,
    unintended dimming, z-fighting shimmer, or texture pop-in.
    Technique (proven): screencast + luminance/pixel transient
    scoring, whole-canvas AND per-handle ROI; any single anomalous
    frame is a failure. Measured today: zero whole-canvas events
    (candle flicker + shadow curves are clean); THREE local
    one-frame bugs filed for the fix wave with before/FLAG/after
    triplets: satchel-sword full-piece vanish (frame 47/175),
    satchel-compass pose jump (80/181), end-keepsake edge-mark
    dropout (96/140).
  - USER-REPORTED (2026-07-16, fix wave): (4) TURN-END CLICK —
    the page "clicks into place" at landing. Easing is quint
    (zero end-velocity), so suspects are: frame drops clustering
    late in the turn (the measured 8–9%), the v-fold family's
    geometric late-rush concentrating panel motion in the final
    degrees, and a possible one-frame pose mismatch when the turn
    frame nulls to the committed rest pose (verify t=1 pose ==
    rest pose bit-exactly, incl. parallax unfreeze timing).
    (5) POST-TURN TEXT POP — the HTML overlay swaps content and
    fades in (flat 220ms, spread-overlay.tsx style + .sb-overlay
    transition) only AFTER completeTurn: text reads as appended,
    not choreographed. Fix direction: overlay participates in the
    turn's motion design (staggered fade/rise beginning before the
    page settles), per E-P3 "page-turn + erection choreo reviewed
    as motion design."

E-G5 ART FIDELITY (in-scene == generated) — RESOLVED by E0a audit
  2026-07-16 (full ranked-degrader report:
  .superpowers/sdd/bench/out/e0/art-fidelity/findings.md)
  - Side-by-side law: every painted piece's in-scene render must
    read as the same artwork as its source file — audited with the
    E0a side-by-side method at art integration time.
  - Pipeline floors (from the measured degraders):
    (a) art aspect == mesh aspect — hard rule (v-folds already
        honor it and read well; failures were the squeezed family);
    (b) tone rule: no ACES film tone-map on flat painted prints
        (measured 17% luminance loss + desat on a full-res
        aspect-true backdrop before any other degrader);
    (c) no single-texture fold across a knee — every face of a
        folded structure gets its own per-face art brief;
    (d) art textures get max anisotropy (today: 1 vs 4 for
        procedural — the most foreshortened pieces are least
        filtered);
    (e) texel floor: >= ~0.5 texture px per screen px (pieces at
        7–11x minify all fail; <= 4x pass);
    (f) FOLD_SHADE_TINT reserved for placeholder stock — painted
        art never multiplied by the shade tint;
    (g) FIGURE/GROUND CONTRAST FLOOR (the camouflage gate,
        refined by the E0a addendum): from the reading camera,
        every story piece must clear ~25 mean-luma delta OR a hue
        break against the layer directly behind it — measurable
        with the E-G2 solver+raycast rig (sample piece texels +
        nearest layer behind each). Orthogonal to E-G2: a piece
        can be visible yet camouflaged. Measured case: ch3-balcony
        IS painted (content.ts comment stale) but sits at |dLum| 9
        against the dark rank tower — merge; it separates fine
        (dLum 72+) from the lit half. Craft levers: contact/drop
        shadow onto the backdrop, darken-blur band behind story
        pieces, palette nudges — the thin cream cut-rim cannot
        separate grey-on-grey.
    (h) LATENT KRAFT DEBT: 48 of 88 pieces are unpainted placeholder
        stock (the box/platform/dress/kinetic/fan family) — a
        book-wide camouflage bomb against warm backdrops. They
        cannot pass legibility judgment until painted; the E1/E2
        per-face briefs absorb this list (many are also E-G2
        occlusion debt: ch2-meadow, ch6-strongbox, ch4-chest —
        double-hidden).
  - RESOLVED FALSE POSITIVE (2026-07-16): the "knob-tier art never
    renders" bug does NOT exist — the E0a montage crop box framed
    the neighboring ch3-counter (a legitimately kraft piece) and
    called it the tier; the tier renders its stone art correctly
    (runtime-traced 5+ fresh navigations). The orchestrator's own
    edge-color verification also read the wrong piece inside the
    same crop. SECOND occurrence of the misidentification class —
    piece identity must be established by decomposition BEFORE any
    property of the image is used as evidence. Lifecycle
    regression tests added (use-layer-texture.test.ts) so a real
    future regression fails a test, not a live trace.

E-G6 COMPOSED INTERACTION (no lone planes)
  - Every interactive moment moves >= 2 linked parts or produces
    secondary motion + settle; a single flat piece rotating on one
    axis with no consequence is a failure regardless of physics
    correctness.
  - Eye-test half: the interaction reads as operating a precious
    paper machine.

## Review protocol

- Per phase boundary: full golden capture -> contact sheets ->
  user judgment (his pinned cadence: per phase or batched).
- Between boundaries: orchestrator runs E-G1..E-G5 on every visual
  change; subagents never bless.

## TBD ledger (fill before pinning)

- [x] E-G1 diff threshold (E0d: resolved 2026-07-16 — 0.5% gate,
      noise floor 0.033–0.060% all spreads, signal 12x worst
      noise; blessed set v1 = 64 stations live)
- [x] E-G2 automated visibility technique (E0c: solver + screen-
      grid ray-cast; thresholds 95/50/8; resolved 2026-07-16)
- [~] E-G3 min on-screen px (E0a: bracketed 115–215 fail / 620
      pass; proposed 300–400px — confirm vs E1 boards); hero
      fraction still TBD-E1
- [x] E-G4 frame-time numbers + artifact technique (E0b: resolved
      2026-07-16; material-pooling + shader-warmup + 3 local
      artifact bugs filed for the fix wave)
- [x] E-G5 pipeline floors per degrader (E0a: resolved 2026-07-16;
      knob-tier wiring bug filed for the fix wave)
