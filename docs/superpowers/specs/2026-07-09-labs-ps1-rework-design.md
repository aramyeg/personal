# PS1 Lab Rework — The Dev Room Design Spec

**Date:** 2026-07-09
**Status:** Approved direction (dev-room diorama, three.js PSX pipeline, fixed-camera cuts, crude-THPS tone, procedural-first assets, minimal synth audio)
**Route:** `/labs/ps1` (unchanged) · Supersedes the v1 scene (synthwave grid hero + DOM memory card)
**Research inputs:** `docs/superpowers/research/research-psx-pipeline.md`, `docs/superpowers/research/research-psx-art-direction.md` (both cited)
**Branch:** `feat/labs-ps1-rework` (isolated worktree; primary checkout left free for a parallel agent)

## Why a rework

V1 reads as retro-cyberpunk, not PS1: starfield void + neon perspective grid +
floating dithered polyhedra is structurally the synthwave formula. The user's
goal: genuine PS1-era 3D aesthetics, visually stunning, a fuller experience.
Research verdict: PS1's technical fingerprint (dither, vertex jitter, affine
warp, low-res textures, Gouraud lighting) is mood-agnostic; what makes a scene
read PS1 is a dense, specific PLACE rendered through a pipeline-level
constraint set — not a filter over a modern/empty scene.

## Tone law (binding — user-directed)

**Crude THPS grit, energetic register.** Anchors: Tony Hawk's Pro Skater 1–2
(original 1999 palettes, NOT the remaster's golden hour), Crash Bandicoot,
Twisted Metal 2. Explicitly banned poles: synthwave (neon on void — the v1
failure) and PS1-horror melancholy (Silent Hill fog-dread).

- Surfaces are crude neutrals: concrete greys, plywood browns, carpet,
  overcast neutral daylight through the window (grey-white key, flat).
- Saturation is spent ONLY on accents: skate-deck graphic, sticker sheet,
  poster art, game-box spines, LED dots, and the CRT's teal glow
  (`#7de8e0` family) — the single cool pop against warm-neutral grime.
- Shadows stay colored (teal-leaning), never flat grey-black — desaturation,
  not hue, is what causes the dread read (research finding; binding).
- Density over emptiness: every surface carries specific stuff. A cluttered
  small room reads "real place"; empty geometric space reads "tech demo."

## The world

One room: a 1999 bedroom dev setup, daytime-overcast. Contents (all load-
bearing props; each is either a hotspot or set dressing):

- Desk: CRT monitor (live menu screen texture), stickered PC tower,
  mechanical keyboard, mouse + mousepad, desk lamp (off — daylight scene),
  pager/phone, coffee mug, CD spindle.
- Shelf: memory cards (the projects), game boxes with saturated spines
  (the other labs + gallery link), stack of zines.
- Walls: 3–4 posters (skills by category, rendered as skate/band poster
  art), a corkboard, window with an overcast street/rooftops view.
- Floor: tube TV + console on the carpet (about/bio plays here), skate deck
  leaning on the wall, crate of cables, scattered CD cases.
- No fog crutch: draw distance is hidden by the room itself (Spyro/Crash
  rule — solid geometry masses, not atmospheric fade).

## The experience

- **Boot:** ≤1.5 s evocative-not-copying PSX-flavored boot flash (black →
  dither bloom → title card overlaying the establishing angle). Skippable by
  any input; reduced-motion skips it entirely.
- **Fixed cameras (RE/FF7 grammar), 4 angles:**
  1. `room` — wide establishing shot, most props visible
  2. `desk` — CRT fills frame (menu hub)
  3. `shelf` — memory cards + game boxes close-up
  4. `tv` — floor TV corner + deck
  Arrow keys / on-screen edge arrows cut between angles (hard cut, era
  dissolve-free). Camera positions/rotations are authored constants.
- **Hotspots:** interactive objects carry a subtle era highlight (slow pulse
  of a brightened vertex-color tint, never a modern glow/outline shader).
  Crosshair-free: hover (desktop) / tap (touch) targets with generous hit
  areas. Clicking opens the object's panel.
- **Content mapping (all real content from `data/`):**
  - CRT monitor → main menu hub (about + navigation to everything)
  - Memory cards → projects (the v1 save-slot concept survives, reskinned
    into the era memory-card manager grid)
  - Posters → skills (grouped by category; each poster is a category)
  - Pager → contact
  - Game boxes → other Style Lab experiments (+ `← gallery`)
  - Tube TV → about/bio (plays as scanline text on the TV screen texture)
- **Panels are DOM overlays** styled to era: PSX BIOS/Gran Turismo
  structural chrome (boxy caps, rigid grids, dithered-gradient panels) with
  a THPS grunge personality layer (stencil accents, sticker chips, tape
  edges). Real HTML — crawlable, screen-reader accessible, keyboard
  navigable. Esc closes the open panel first; a second Esc follows the
  standard GalleryChrome chain (capture-phase hardening law unchanged).
- **A11y/fallbacks:** reduced-motion gets a static pre-rendered room still +
  the panels as a plain document flow. The panel content doubles as the
  crawlable layer (server-rendered, sr-visible), same pattern as snowpark's
  crawlable skills. A quiet `skip to the content` affordance from the start.

## The pipeline (all hand-rolled, zero new deps; react-three-fiber + three)

Per `research-psx-pipeline.md`, ranked non-negotiables all present:

1. **Low internal resolution:** render to a 384×216 `WebGLRenderTarget`
   (keeps the lab's 384px identity), blit with `NearestFilter` — hard pixels.
2. **Affine texture mapping:** UV×w trick (pre-multiply varyings by w,
   divide in fragment) via `onBeforeCompile` — THE PS1 fingerprint.
3. **Vertex snapping:** clip-space snap (`floor(ndc * grid) / grid`) in the
   vertex shader; grid tuned at the gate so jitter reads era, not broken.
4. **Gouraud-only lighting:** patched Lambert (vertex-lit), zero specular /
   PBR / normal maps. Baked vertex-color AO/light pools where cheap
   (Crash's vertex-color + modulate-2x trick for saturated hotspot props).
5. **Dither + quantize post pass:** 4×4 Bayer ordered dither and ~5-bit/
   channel quantization, applied at the low-res target AFTER tonemap/sRGB.
6. **Textures:** 64–128px, `NearestFilter`, no mipmaps.
7. **Bans:** no bloom, no AA, no SSAO, no soft shadows, no smooth camera
   drift (fixed cuts only) — the "generic retro" failure modes.
8. 30 fps frame lock (era cadence, and battery-friendly).
- Materials patched via `onBeforeCompile` with `customProgramCacheKey` per
  variant. Era text inside the 3D scene (CRT screen, labels) uses a
  bitmap-font canvas atlas, never TextGeometry/DOM-scaled fonts.

## Assets (procedural-first; manual Codex as gated escape hatch)

- **Primary lane:** every texture is seeded procedural canvas pixel-art
  (the museum `textures.ts` pattern, one shared `mulberry32`): wood, carpet,
  concrete, plaster, sticker sheet, poster art (shape+type compositions),
  deck graphic, box spines, corkboard, CRT/TV screen content, window view.
  All quantized to the era palette at generation time.
- **Escape hatch (user-manual, zero budget):** if a hero piece (window view,
  poster art) reads weak at the visual gate, hand the user exact prompts +
  dimensions to run through their own ChatGPT; committed results pass
  through the same downscale + 15-bit quantize import step. Nothing in the
  plan blocks on this lane. (No API keys available/wanted; Figma MCP
  reserved — free-plan call limits make it unfit as a workhorse.)
- **Geometry:** 100% procedural primitives (box/cylinder/plane assemblies) —
  era-authentic and fully tunable at gates.

## Audio (first lab in the series with sound)

- **WebAudio synthesis only, no asset files:** menu move blip, select
  thunk, back tick, boot chime (two-note fifth, soft square), faint room
  tone (filtered noise at −40 dB). All silent until first user interaction
  (autoplay law), visible `sound: on/off` toggle in era UI chrome,
  preference persisted in localStorage. Reduced-motion default: muted.
- **Rider task (museum, same branch):** footsteps while walking —
  step cadence from horizontal speed, two surface voices (marble tap in the
  hall, wood knock on stairs/attic) chosen via the existing `floorY`
  region; same synth-only, muted-until-interaction, and toggle rules.
  Touches `components/labs/museum/player-controls.tsx` wiring only — if the
  user's parallel agent works on the museum, this task holds until sequenced.

## Architecture

```
components/labs/ps1/
  scene/
    psx-pipeline.tsx   — low-res target, blit, dither/quantize pass, 30fps lock
    psx-materials.ts   — onBeforeCompile patches: snap, affine, vertex-lit
    room.tsx           — room shell + prop assemblies (pure placement data in)
    props.ts           — prop geometry builders (desk, crt, shelf, tv, deck…)
    cameras.ts         — authored angles + cut state machine (pure, tested)
    hotspots.ts        — hotspot registry: object ↔ panel id ↔ hit area (pure)
    textures.ts        — seeded canvas pixel-art generators + quantize helpers
    bitmap-font.ts     — era glyph atlas for in-scene text
  panels/
    panel-shell.tsx    — era chrome (BIOS/GT structure + THPS grunge accents)
    menu-panel.tsx, projects-panel.tsx, skills-panel.tsx,
    contact-panel.tsx, labs-panel.tsx, about-panel.tsx
  audio.ts             — synth blips + room tone + toggle (pure factory, tested)
  boot.tsx             — boot flash overlay
  ps1-experience.tsx   — shell: state (angle, open panel, booted), input, a11y
app/labs/ps1/page.tsx  — server-rendered crawlable content + experience mount
components/labs/museum/player-controls.tsx — footsteps wiring (rider task)
scripts/posters/       — regenerated PS1 poster at the end (museum wall)
```

- Pure, unit-tested modules: `cameras.ts` (cut state machine), `hotspots.ts`
  (registry integrity: every hotspot maps to a panel and content source),
  `textures.ts` quantize math, `audio.ts` node-graph factory (constructible
  with a mock AudioContext).
- e2e: page mounts canvas + boot skips; a panel opens and carries real
  content; Esc chain (panel → gallery) preserved; crawlable content present
  without JS; reduced-motion renders the static document.
- v1 files (`ps1-scene.tsx`, `memory-card.tsx`, `ps1.module.css`) are
  deleted in the final integration task; the save-slot DOM pattern migrates
  into `projects-panel.tsx`.
- Manifest: thesis rewritten for the new concept (same slug/route); museum
  poster regenerated in the new art (portrait 3:4, ≤200 KB, generator
  committed to `scripts/posters/`).

## Out of scope

Walking/free camera, a playable game inside the CRT, real Sony boot
assets/logos/fonts (evoke only — original graphics throughout), music
tracks (UI sounds only), v1 poster reconstruction, 3D model imports.

## Execution model

Same as the attic/snowpark: subagent-driven tasks with per-task review;
Fable orchestrates, tunes at gates, and personally screenshots each visual
gate (headless Playwright against the worktree's own dev server on a
non-3000 port). Milestone gates: (A) pipeline proof — a textured cube room
through the full PSX pipeline reads PS1 in a screenshot; (B) the room reads
(geometry + textures + lighting, all four angles); (C) experience complete
(boot, cuts, hotspots, panels, audio); (D) polish + poster + manifest +
crawlable/e2e + museum footsteps. User previews the Vercel build before
merge, as always.
