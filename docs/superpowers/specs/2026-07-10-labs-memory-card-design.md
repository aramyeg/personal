# Memory Card — Designer Site Rework of the PS1 Lab (Design Spec)

**Date:** 2026-07-10
**Status:** Direction approved (concept A: editorial designer site + crisp retro-3D vignettes). Supersedes and deletes the dev-room rework AND the v1 synthwave scene.
**Route:** `/labs/memory-card` (new slug — "change the name" per user); `/labs/ps1` becomes a permanent redirect to it (the v1 URL was posted on LinkedIn).
**Branch:** `feat/labs-ps1-rework` (this worktree). REBASE onto latest main first — the XP lab (PR #7) merged after this branch was cut and touches `lib/labs-manifest.ts`.
**Prior specs:** `2026-07-09-labs-ps1-rework-design.md` (dev room — REJECTED by user, retained for history).

## Why this rework of the rework

The dev-room lab passed every internal gate and was rejected by the user on
first look: "super low poly… the idea is bad, the implementation is bad…
super hard to navigate and to even understand what this should represent."
Root causes, now binding constraints:

1. **Navigation was opaque.** A 3D shell owned the navigation. Never again:
   the page is a real website — clear nav, native scroll, labeled sections.
2. **Crude low-poly read.** Box-primitive 3D at 384×216 read cheap, not
   nostalgic. The 3D is now rendered crisp at full resolution with modern
   polish; era reads through design (shape language, palette, iconography),
   never through pixelation. The dither/affine/vertex-snap pipeline is dead.
3. **Craft details were subordinated to systems.** Per the extended
   knowledge base (design-craft-bar): typography, color systems, motion,
   cursor, and fine details are first-class requirements. "Designer site
   with designer solutions."

## User direction (verbatim anchors, binding)

- "I want a designer site, with designer solutions, 3d objects breaking the
  usual layout. Scroll should also be a part of the experience."
- Skills to apply: `design` + `design-system` (ui-ux-pro-max), official
  `frontend-design`, `web-motion-design`, `21st-registry` (all installed).
- 3D vignettes chosen: spinning PS1 memory cards, spinning low-poly
  character, CRT/console vignette. Look: "Clean retro-3D, modern polish."
- The dev room: "just straight up delete it."

## The concept — MEMORY CARD

The PS1 memory-card manager reimagined as an editorial, award-site-grade
page. One continuous native scroll. Typography does the storytelling; three
crisp 3D vignettes break the grid and reward the scroll. Era is carried by
the four button-glyph shapes (triangle/circle/cross/square — abstract
geometry, no Sony marks/logos/fonts ever), boot-black + paper contrast, and
save/load language in the copy.

### Page structure (five acts + chrome)

Fixed top chrome: wordmark `AY-01 · memory card`, section anchors
(`work / skills / about / contact`), `sound: off` toggle. GalleryChrome's
back-to-gallery affordance and Esc → /labs behavior stay untouched (no
custom Esc handling anywhere on this page — the page is a normal document).

1. **HERO — "select your file".** Massive display type (name + role from
   `data/`), kinetic on load (staggered line reveal, glyph flicker accents).
   The **voxel character** spins slowly on a select-screen dais, breaking
   out of the type block (overlapping the headline's right edge). Scroll
   indicator styled as a save-glyph. ≤1s type intro; reduced-motion: static.
2. **WORK — the memory-card rail.** One pinned scroll scene (the page's
   single pinned moment): as the user scrolls through the section's height,
   a horizontal rail of **3D memory cards** (one per project from
   `data/projects`) translates across. Each card: rounded shell, top
   grooves, glossy label with the project's save-slot metadata (title,
   company, year, `saved` / `in progress`). Cursor-tilt on hover; click
   flips the card to its back with 2 metrics. A plain in-flow list of the
   same projects renders below the scene (content never lives only in 3D).
3. **SKILLS — kinetic type wall.** No 3D. Categories as huge outlined
   words; each skill row: name, years, and a segmented era HP-bar that
   fills on scroll-into-view. The four glyph colors cycle across the
   category groups (same idx % 4 rule the poster generators used).
4. **ABOUT — the CRT vignette.** A crisp CRT/console model sitting on the
   grid line between two text columns; its curved screen plays the bio as
   a scanline ticker (canvas texture, bitmap-font accent face). Bio prose
   verbatim from `components/sections/about.tsx` (claims law: Senior
   Frontend Engineer, never lead). The `8 yrs · fintech systems · Yerevan →
   worldwide` line features as typographic ornament.
5. **CONTACT — "save your progress?".** Save-prompt framing: three big
   monospace rows (email / github / linkedin) with `copy` buttons and
   inline `copied` feedback. Footer: `← gallery` + labs cross-links from
   the manifest (text links — no 3D shelf).

### The 3D vignettes (crisp, modern polish — binding look rules)

- Full-resolution rendering, antialias ON, soft three-point studio
  lighting, smooth shading, subtle contact shadows. NO dither, NO vertex
  snap, NO affine warp, NO low-res target. Emissive glow allowed (CRT
  screen). The old pipeline bans are void — this is product-shot rendering.
- **Character = the site's pixel avatar, voxelized.** Extrude the
  `PixelAvatar` rect data (components/labs/xp/pixel-avatar.tsx on main
  after rebase) into beveled 3D voxels — a designed, personal object that
  procedural building CAN hit reliably (voxels read deliberate; organic
  modeling reads cheap — that trap killed the dev room). Slow turntable
  spin on a shallow cylindrical dais with a glyph-ring inscription.
  Fallback if the voxel read fails at the gate: designed abstract
  mannequin; last resort: user's manual-ChatGPT reference lane.
- **Memory card**: rounded-box shell (real bevels), groove caps, glossy
  label decal (canvas texture — save-slot layout, quantize-free), subtle
  fresnel-ish rim via lighting. It should read like a product shot from a
  modern re-issue campaign.
- **CRT**: rounded shell, curved-glass front (sphere-section), plastic
  foot; screen texture = scanline ticker with bitmap-font text, gentle
  emissive. Sits still; screen animates.
- r3f canvases are decorative: `aria-hidden`, gated by IntersectionObserver
  (render only in view), `frameloop` paused off-screen, dispose on unmount.
  Canvas strategy (one shared canvas + views vs per-vignette canvases)
  decided at plan time after checking whether drei is available.

### Design system (locked at Gate 0, tuned only there)

- **Palette anchors** (5-bit quantization is dead; these are exact):
  ink `#101014` (boot black), paper `#e9e7e0`, shell grey `#b7b9bd`,
  console warm-grey `#8f8c84`, plus the four glyph accents —
  triangle green `#00ac9f`, circle red `#df0024`, cross blue `#2e6db4`,
  square pink `#d651a7`. One accent per section, never mixed gradients.
  Dark sections (hero, contact) on ink; light sections (work, skills,
  about) on paper — alternating film-strip rhythm.
- **Typography** (via next/font, lab-scoped): display = Anton (massive
  condensed headlines, tight tracking, uppercase); text = Space Grotesk;
  metadata/save-slots = IBM Plex Mono; sparse accent = the existing 5×7
  bitmap font (CRT ticker, tiny labels). Type scale, leading, and tracking
  specified in the plan per section — "big" is not a spec.
- **Motion grammar** (framer-motion, already bundled): staggered line
  reveals on entry; scroll-linked transforms for the rail and HP-bars; the
  ONE pinned scene is the work rail; cursor = small dot + glyph shape that
  morphs per hovered element (interactive elements only); hover tilts on
  cards. Reduced-motion: no pinning, no parallax, no custom cursor, no
  spin — static renders and instant content. Implementation tasks MUST
  consult `web-motion-design` + `frontend-design` skills; design-token
  tasks MUST consult `design` / `design-system`.
- **Copy law:** UI copy dry lowercase; save/load vocabulary; no emoji;
  era-generic words only; no Sony marks.

### Audio (salvage)

`components/labs/ps1/audio.ts` + its 20 tests survive as-is (commit
f6d58c2, unreviewed — review during its integration task). Wiring: hover
blip on nav/cards, select thunk on card flip, back tick on close, boot
chime once on first scroll past hero (gesture-gated), `sound: off` toggle
in the chrome, localStorage `ps1-sound` key renamed to `memory-card-sound`.
Reduced-motion defaults muted. Room tone: dropped (no room anymore).

### Deletions and migrations

- DELETE: v1 files (`ps1-scene.tsx`, `memory-card.tsx`, `ps1.module.css`),
  the entire dev-room layer (`scene/psx-pipeline.tsx`, `psx-materials.ts`,
  `room.tsx`, `props.ts`, `cameras.ts`, `hotspots.ts`, `boot.tsx`,
  `ps1-experience.tsx`, `panels/*`, proof page) and their tests.
- KEEP (adapted): `bitmap-font.ts` (+tests), `audio.ts` (+tests),
  `textures.ts` trimmed to what the new lab uses (label/CRT-screen
  canvas generators, re-rendered crisp at higher res; quantize/dither
  helpers deleted with their tests), canvas-2d test shim.
- Components move to `components/labs/memory-card/`; route
  `app/labs/memory-card/page.tsx` (server-rendered content + client
  islands); `app/labs/ps1` → permanent redirect (next.config or a
  `redirect()` page — plan decides).
- Manifest: the `ps1` entry is REPLACED by `memory-card` (new title,
  thesis, date 2026-07-10, poster path). Museum poster regenerated
  (portrait 3:4, ≤200 KB, generator in `scripts/posters/`). OG metadata
  for LinkedIn unfurls.

### Museum footsteps rider (unchanged, still wanted)

Synth footsteps while walking the museum (marble hall / wood stairs+attic
via `floorY`), muted-until-gesture, toggle rules — LAST task, preceded by a
sequencing check (`git log origin/main -- components/labs/museum/`): the XP
lab merged meanwhile and the parallel agent may touch museum files again.

## Accessibility / fallbacks

The page is server-rendered real HTML by construction — the crawlable
layer is the page itself (no shadow document needed). 3D canvases are
decorative and `aria-hidden`; every fact they show exists in adjacent HTML.
Keyboard: normal document order, visible focus (era ring color), skip
link. Touch: tilt becomes tap-flip; custom cursor disabled. No WebGL →
vignettes render nothing, layout unaffected (reserved aspect boxes with
paper background + glyph mark).

## Gates (execution model — subagent tasks + orchestrator gates)

- **GATE 0 — look-dev (USER approves, not just orchestrator):** voxel
  character + one memory card + CRT rendered on a bare stage, screenshot
  set to the user BEFORE any page structure is built. This is the lesson
  of both snowpark and the dev room: the hero visual passes first.
- **GATE 1 — typography/layout:** hero + skills section with real type
  scale/palette, orchestrator screenshot check against the design system.
- **GATE 2 — full scroll-through:** all five acts, pinned rail, motion,
  cursor; orchestrator screenshots at multiple scroll positions + smoke.
- **GATE 3 — battery:** unit + e2e + build + redirect + reduced-motion +
  poster/OG; then push, PR with before/after, USER plays the Vercel
  preview. Merge only on his word.

## Out of scope

Walking/free 3D navigation, game content inside the CRT, model imports,
music tracks, the attic (the dev room is deleted, not exhibited),
reconstructing v1 posters.
