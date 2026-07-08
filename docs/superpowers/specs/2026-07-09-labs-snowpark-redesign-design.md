# Powder Lines Redesign — Alto-Grade 2D Design Spec

**Date:** 2026-07-09
**Status:** Approved direction (Alto-grade 2D, one-button-first, no audio); spec pending user review
**Route:** `/labs/snowpark` (unchanged) · Supersedes `2026-07-08-labs-snowpark-design.md`
**Research inputs:** `docs/superpowers/research/research-{game-feel,visuals,portfolio-games}.md` (sourced)

## Why a redesign

V1 shipped mechanically correct and visually dead: flat polylines, a 20px stick
figure, no animation, no feedback — "a cheap copy of Happy Wheels …
reminiscent of 20-s flash games" (user). The named bar is **Journey / Alto's
Adventure**: atmosphere, gradient light, flowing motion, and a game that is
fun to *move* in. Research verdict: v1's deficit is a dead core loop (momentum
not felt, landings unrewarded, zero juice) plus an aesthetic that banned the
very ingredients (art-directed gradients, particles, fluid character motion)
that make elegant minimalism read as premium. Both are fixable in 2D — Alto
itself is 2D compositing built by one developer.

## Design pillars (from research, binding)

1. **Momentum is a felt, spendable currency.** Build it down slope backsides,
   spend it on launches, win it back with clean landings. If speed is
   scripted, the game is dead.
2. **Close the input loop under 100ms and forgive intent:** coyote time,
   input buffering, landing snap-assist. Invisible, non-negotiable.
3. **Over-report every action (juice).** Spray, bursts, ribbons,
   squash-and-stretch, shake, hit-stop. Every audio beat has a visual twin
   (there is no audio this round).
4. **The camera is a speed instrument:** zoom with velocity, lead the travel
   direction, hang at apex, shake on impact.
5. **Atmosphere = gradient light + layered parallax haze + one flowing
   element + tight palette.** Depth via layers and weight, never blur filters.
6. **Front-load and let people leave:** the first hill and first skill land
   within ~5s; a visible skip path to the skills; the resume content also
   exists as crawlable HTML. (Average engagement with even the best gamified
   portfolios is ~1 minute.)
7. **De-slop, corrected:** banned = particle confetti, emoji, hype copy,
   lazy pastel soup, undirected glow. Explicitly ALLOWED and required =
   art-directed gradient light, tasteful particles, fluid procedural
   animation. Intentionality is the rule, not flatness.

## The run

- Fixed descent, ~75–90 s at flow pace, all 23 skills from `data/skills.ts`
  placed (compiler retained, spacing retuned to terrain rhythm).
- Terrain re-authored as a **pumpable rhythm**: smooth rolling spline hills
  with a build → launch → land tempo. Obstacles sit where the rhythm sends
  you: kickers on natural crests, rails/boxes on runout lines. No spiky
  hazard shapes.
- **Escalation via environment, not rules:** the run crosses a day cycle —
  golden morning → pale noon → alpenglow → deep-blue night — with light
  snowfall ramping in the back third and the final stretch's skill markers
  glowing. Ends on a crescendo into the finish.
- Stretches keep category identities (frontend face … tooling run-out) and
  each shifts palette/props subtly so the mountain has chapters.

## Physics and feel (rider rework)

- On snow: gravity-driven acceleration along the slope (keep), plus **tuck**:
  holding Space on snow presses into the slope — faster downhill acceleration
  — and charges the pop. Release to jump. Tap = ollie.
- **Crest launch:** at speed, convex terrain falling away launches the rider
  naturally (ballistic), proportional to speed.
- **Forgiveness (exact windows):** coyote time ~100 ms after a crest/lip;
  input buffer ~100 ms before landing; rotation snap-assist: within ±20° of
  clean at touchdown snaps clean and counts.
- **Landing quality → speed:** clean, aligned landing = speed boost + clean
  pop FX; sloppy-but-within-tolerance = speed bleed; beyond tolerance = bail
  (tumble of rig segments, ~1.2 s, respawn short of the next obstacle; R
  retries instantly — all kept from v1).
- Bail copy stays: `washed out — press R to retry the section`.

## Tricks and scoring

- **One-button-first:** hold Space in air = backflip (continuous rotation
  while held; release stops). ↑ = grab, ←/→ = spins remain as optional depth.
  Rails/boxes auto-grind on contact (kept).
- **Chain multiplier:** tricks and grinds stack a multiplier while the run
  stays clean; a clean landing banks it. A bail zeroes it. HUD makes the
  multiplier the loud number.
- **Proximity/lateness bonus:** rotation completed later / closer to the
  ground scores more and boosts more — the player-owned risk dial.
- Skill years multiplier and the trick-card format survive:
  `360 Nose Grab — TypeScript · 6 yrs · expert`.
- Scoring stays a pure, unit-tested module.

## Controls

| Input | On snow | In air | Grinding |
|---|---|---|---|
| Space tap | ollie | — | hop off |
| Space hold | tuck + charge pop | backflip (continuous) | — |
| ↑ | — | grab | — |
| ← / → | — | spin | — |
| R | retry section | retry section | retry section |
| P / pause glyph | pause | pause | pause |
| Esc | pause first, second Esc → gallery (capture-phase hardening kept exactly) |

Touch: hold = tuck/jump-charge; hold in air = flip; second finger = grab;
swipe = spin; pause glyph. Canvas `touchAction: none` kept.

## Visual world (render rebuild)

- **Sky:** multi-stop gradient interpolated across the run's day cycle
  (authored color stops per phase; LAB/HSL lerp). The sun is a warm disc with
  a restrained halo, arcing and setting as the run progresses.
- **Terrain:** filled silhouette shapes (not naked polylines) — snow surface
  with a subtle vertical gradient and a **rim-light edge** along the crest
  line; carve line darkening where the board passed.
- **Depth (2.5D allowed and encouraged):** 3–4 parallax silhouette mountain
  bands with haze layers between; scale-with-depth props (pines, rock spurs,
  banners); occasional foreground occluders sweeping past close to camera;
  drifting fog wisps. Old-game 2.5D trickery is in-bounds; real 3D is not.
- **Snowfall:** sparse, ramping in the final third; pooled particles, capped.
- **Night legibility:** in the last stretch, skill markers and the finish
  banner glow softly as light sources (Alto's night rule).
- **Palette:** the arctic anchors survive (ice, glacial blues, polar ink,
  amber) but each day-cycle phase owns an authored gradient set derived from
  them. Amber stays the reward color (sun, score, collect moments, scarf).

## The rider (procedural rig, no sprite assets)

- Jointed 2D figure (~6 segments: board, front/back leg, torso, arms, head)
  driven entirely by physics state: leans with slope angle, crouches while
  tucking, extends on pop, tucks through flips, reaches to the board on grab.
- **Verlet scarf** (~30 points, 3–4 constraint iterations) in amber, trailing
  from the rider — the one flowing element.
- Squash-and-stretch on landing/launch (opposed X/Y scale, area conserved).
- Bail = the same segments tumbling apart with the scarf free (deterministic
  seed from state, kept).

## Juice inventory (all fire-conditions specified)

| Effect | Fires when |
|---|---|
| Carve spray particles | continuous while carving, scaled to speed/turn |
| Landing burst + squash | any landing; bigger with impact |
| Trail ribbon | always; brightens with combo |
| Camera zoom-out | with speed (continuous) |
| Camera lead + apex hang | travel direction; big launches |
| Screen shake (small) | hard landings, bails; scaled to impact |
| Speed lines | above a speed threshold |
| Hit-stop (3–5 frames) | big trick landings, bails only |
| Flash + scale-pop on combo counter | every banked trick |
| Combo escalation (brighter trail, larger bursts) | multiplier tiers |
| Collect card slide-up | skill collected (kept, dry copy) |

## Resume integration

- Obstacles ARE skills (kept). Collect card + expedition-log recap (kept,
  restyled to the new world).
- **Crawlable fallback (new, required):** the full skill list (name, years,
  level, grouped by category) renders as real server-rendered HTML on the
  page (below/behind the canvas experience), so recruiter-side parsers see it
  without playing. The reduced-motion static sheet reuses this content.
- **Skip path (new, required):** a quiet but visible `skip to the skills`
  affordance available from the start, scrolling/jumping to the recap
  content. `← Gallery` and Esc behavior unchanged.
- Per-skill custom mechanics: cut for scope; stretch-level flavor only.

## Architecture

```
components/labs/snowpark/
  course.ts        — kept; spacing retuned to terrain rhythm
  slope.ts         — re-authored: rhythm-authored spline (build/launch/land tempo)
  tricks.ts        — rescored: chain multiplier, lateness bonus (pure, tested)
  rider.ts         — reworked physics contract (tuck/launch/landing-quality,
                     forgiveness windows as pure testable logic; state machine kept)
  input.ts         — remapped one-button-first; capture-phase Esc hardening kept
  use-game-loop.ts — kept
  render/          — NEW split (small modules):
    camera.ts        zoom/lead/shake/apex-hang (pure math + state)
    sky.ts           day-cycle gradients, sun, snowfall
    terrain.ts       filled silhouettes, rim light, parallax bands, props
    rider-rig.ts     jointed figure poses from physics state
    scarf.ts         verlet chain
    particles.ts     pooled spray/bursts/trail
    fx.ts            speed lines, hit-stop, flashes, shake application
    renderer.ts      orchestrator (layer order, offscreen caches)
  snowpark-game.tsx — shell kept; HUD restyled (multiplier loud), skip path added
app/labs/snowpark/page.tsx — + server-rendered crawlable skill list
public/labs/snowpark/poster.jpg — REDRAWN in the new visual language (final task)
```

- Pure modules (course, slope, tricks, rider, camera math, forgiveness
  windows) unit-tested; existing rider/course/tricks suites updated to the
  new contract, not deleted.
- e2e kept and extended: skip path lands on skill content; crawlable list
  present without JS execution (request the HTML, assert content).
- Zero new dependencies. Optional M6 atmosphere pass (soft bloom/grain/haze)
  uses a full-screen WebGL fragment shader via the already-bundled three, or
  raw WebGL2 — still zero new deps; skipped if the 2D stack already hits the
  bar.

## Execution model (user-directed)

Fable (session lead) designs and reviews every feel-critical module and
**personally playtests each milestone in Chrome** before it counts as done.
Opus implements physics/render/rig; Sonnet only mechanical tasks. Milestones
are playable checkpoints, in this order:

1. **M1 Feel core** — new physics/forgiveness/camera on placeholder flat
   visuals. Gate: momentum loop is fun with rectangles.
2. **M2 Juice** — particles, ribbons, squash/stretch, shake, hit-stop, flashes.
3. **M3 World** — sky cycle, filled terrain, parallax bands, haze, snowfall.
4. **M4 Rider** — jointed rig + scarf + bail tumble.
5. **M5 Integration** — skills/collect/recap restyle, skip path, crawlable
   HTML, HUD.
6. **M6 Polish** — escalation FX, night glow, optional WebGL atmosphere pass,
   new poster, OG image refresh.

Each milestone ends with a Fable browser playtest against its gate; course
corrections happen at milestones, not after the whole build.

## Out of scope

Audio (later polish pass), endless mode, leaderboards, 3D, per-skill custom
mechanics, multiplayer, real weather simulation beyond the snowfall ramp.
