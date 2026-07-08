# Style Lab — Powder Lines (Snowboard Run) Design Spec

**Date:** 2026-07-08
**Status:** Approved for planning
**Route:** `/labs/snowpark` · Lab #2 in the Style Lab series

## Summary

A fully playable 2D snowboarding game drawn entirely as geometry — long
flowing terrain lines, waves, and shapes in a restrained arctic palette.
One designed ~90-second descent where every obstacle IS a skill from
`data/skills.ts`: land a trick on it to collect the skill. A finish-line
recap renders the collected skills as an expedition-log scorecard — the
CV as a snowboard run.

## Decisions (settled during brainstorming)

| Question | Decision |
|---|---|
| Interaction | Fully playable game: jumps, tricks, bails, score, restart |
| Art style | Abstract shape/line aesthetic — no sprites, everything drawn geometry |
| Theme | Arctic, de-slopped (see Palette) |
| Skill hook | Obstacles ARE skills; landing collects them; recap scorecard |
| Run shape | Fixed designed course containing every skill; finish banner + recap |
| Technology | Custom canvas-2D engine, kinematic rider, zero new dependencies |

## Palette and anti-slop rules

- Background ice field: `#eef3f6` (near-white, cold).
- Terrain/wave lines, one glacial-blue family only: pale `#b8d4e2`,
  mid `#6e9cb4`, deep `#2e5468`. Depth via line weight + parallax, never blur.
- Polar ink `#122630`: rider, obstacle strokes, all type.
- ONE accent — muted low-sun amber `#d9a441` — reserved for the sun disc,
  the score, and collected-skill moments. Nothing else is colored.
- Banned: gradients as decoration, glows, lavender/peach/mint pastel soup,
  particle confetti, emoji in game copy, hype microcopy ("EPIC!", "🔥").
- Copy is factual and dry. Trick card: `360 Nose Grab — TypeScript · 6 yrs ·
  expert`. Bail line: `washed out — press R to retry the section`.
- Snow: sparse drifting dots, count capped; a mood, not a particle system.

## The world

Full-viewport canvas owned by the lab page (site theme does not apply).
The mountain profile is a long ribbon of 3–5 parallel offset lines following
one master curve. Behind it: two or three slow parallax layers of contour/
wave lines and a flat amber sun disc low on the sky. The rider is a minimal
ink figure — a leaning capsule on a board-line — leaving a fading trail
ribbon. Obstacles are pure shapes: kickers are clean wedges, rails are long
floating lines on thin posts, boxes are rounded rectangles. Each obstacle
carries a small ink label with its skill name.

## Course

Compiled at module load from `data/skills.ts` (`skills: Skill[]` —
name/years/category/level). One obstacle per skill, grouped by category into
named stretches of the mountain (e.g. frontend face → mobile ridge → state
park → styling bowl → backend flats → tooling run-out), in manifest order
within each group. Obstacle type assignment is deterministic from the skill
(e.g. expert-level → kickers for big air, others alternate rail/box), spacing
tuned so the full descent runs ~90 seconds at cruise speed. The course ends
at a finish banner. The course compiler is a pure function
(`skills → CourseObstacle[]`) and is unit-tested; adding a skill to the data
file adds an obstacle to the mountain automatically.

## Rider model (kinematic, not physics-sim)

- On snow: the rider is glued to the slope curve, position parameterized by
  arc length; speed from slope gradient (accelerate downhill, bleed on flats)
  within min/max clamps. This is a pure step function `(state, input, dt) →
  state`, unit-tested.
- Jump: Space (tap = ollie; hold ≤0.5 s charges pop). Leaving a kicker lip
  converts slope + charge into launch velocity. Airborne = ballistic.
- In air: ←/→ rotate in 180° increments queued smoothly; ↑ held = nose grab.
  Trick name composes from rotation + grab ("180", "360 Nose Grab", …).
- Landing: within ±35° of slope tangent and rotation settled = clean → trick
  scores and the obstacle's skill is collected. Otherwise bail: brief tumble
  of shapes (rider decomposes into its primitives), combo lost, respawn
  ~2 s before the next obstacle. R restarts the section instantly; full
  restart from the recap or pause.
- Rails/boxes: overlapping the surface while airborne-or-landing snaps into
  a grind (auto-balance — no balance meter); grind length feeds score; jump
  or run off the end to land.
- Scoring: base trick value + rotation + grab + grind length, multiplied by
  the skill's real `years`, plus a combo chain for consecutive clean
  landings. Pure scoring module, unit-tested.

## Controls

- Desktop: Space jump/charge, ←/→ spin, ↑ grab, R retry section, P/Esc pause
  (Esc while paused → GalleryChrome navigates to /labs; the pause menu says
  so). Keys listed in a quiet corner hint, not a tutorial modal.
- REQUIRED HARDENING: during play the game's Esc handler pauses and calls
  `e.preventDefault()`; `components/labs/gallery-chrome.tsx` must gain a
  `if (e.defaultPrevented) return` guard (the museum review deferred this —
  this lab makes it load-bearing, ship it here with a unit test).
- Touch: tap = jump, horizontal swipe in air = spin, second-finger hold =
  grab. Tap the pause glyph for the menu.
- Tab hidden → auto-pause. `prefers-reduced-motion` → the game does not
  auto-run; the page renders the static skill sheet (recap layout with all
  skills listed from data) with a "start the run anyway" button.

## HUD and recap

- HUD (DOM overlay, not canvas): score + combo top-right in amber mono;
  current stretch name top-left; last trick line bottom-center, fades after
  2 s. Nothing else.
- Collect moment: small ink card slides up — skill name, years, level — and
  a +N amber score tick. One at a time, no queue spam.
- Recap (on finishing): expedition-log card — run time, total score, best
  trick, then skills in two columns: collected (amber tick) and missed
  (ink circle) grouped by category with years/level. Buttons: `run it back`
  and `← gallery`. Missed skills are the restart bait.

## Architecture

```
app/labs/snowpark/page.tsx            — metadata/OG; GalleryChrome; mounts game (client, dynamic)
components/labs/snowpark/
  course.ts        — pure: skills → stretches + obstacle layout
  slope.ts         — pure: master curve, sampling, tangents/normals, arc length
  rider.ts         — pure: state machine step (snow/air/grind/bail/finish)
  tricks.ts        — pure: rotation/grab/grind → trick name + score; combo logic
  palette.ts       — the arctic tokens above, single source
  renderer.ts      — canvas draw: layers, terrain ribbon, obstacles, rider, trail
  use-game-loop.ts — fixed-timestep rAF loop, pause/visibility handling
  input.ts         — keyboard + touch → intent flags
  snowpark-game.tsx— shell: canvas + HUD + recap + reduced-motion gate
lib/labs-manifest.ts                  — new entry (slug 'snowpark', title 'Powder Lines')
public/labs/snowpark/poster.jpg       — poster (generator in scripts/posters/)
```

Pure modules (course, slope, rider, tricks) are unit-tested; renderer and
shell are verified visually and by e2e smoke (canvas mounts, Esc returns to
/labs). The game bundle is dynamically imported so the labs list/museum pay
nothing for it.

## Integration (Style Lab conventions)

- Manifest entry hangs it in the museum automatically; poster is drawn in
  the lab's own language (terrain lines + ink rider + amber sun, 768×1024,
  ≤200 KB, reproducible generator).
- Page wrapped in `GalleryChrome` (back button + Esc → /labs).
- All content from `data/skills.ts`; no invented skills, no inflated titles
  ([[no-lead-title-claims]]).
- Own OG metadata for LinkedIn unfurls.

## Out of scope

- Endless mode, leaderboards, sound (a later polish pass may add optional
  audio), 3D, multiplayer, mobile-specific level tuning beyond the control
  scheme above.
