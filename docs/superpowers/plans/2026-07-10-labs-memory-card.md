# Memory Card Designer-Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the rejected PS1 dev-room lab (and the v1 synthwave scene) with "Memory Card" — an editorial designer site at `/labs/memory-card` with crisp retro-3D vignettes (voxel avatar, memory-card rail, CRT), typography-led sections, scroll choreography, custom cursor, and salvaged synth audio.

**Architecture:** A server-rendered five-act page (hero/work/skills/about/contact) whose content is plain HTML from `data/`; three client-island r3f canvases render full-resolution, studio-lit 3D vignettes gated by IntersectionObserver; framer-motion drives reveals, one pinned rail scene, and HP-bars; a tokens module owns the palette/type/glyph system.

**Tech Stack:** Next.js 15 App Router, React 19, react-three-fiber + three (bundled), framer-motion (bundled), next/font/google (Anton, Space Grotesk — build-time self-hosted, zero packages), Tailwind 4 utilities + inline styles, Vitest unit project, Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-07-10-labs-memory-card-design.md` — its user-direction anchors, look rules, and copy law bind every task below.
**Skills (installed, mandatory consults):** implementers of Tasks 3, 6, 7, 8, 9 invoke `design-system` and/or `frontend-design` before styling; Tasks 6–10 consult `web-motion-design` for any animation they add. Read the skill, apply its checklists, note in the report what it changed.

## Global Constraints

- Zero new npm packages. Fonts via `next/font/google` (Anton, Space_Grotesk) — build-time, no package. Mono = the already-bundled JetBrains Mono (fontsource, loaded globally via `lib/fonts.ts`); the spec's IBM Plex Mono is superseded by this to avoid a new package.
- No `Math.random` — `mulberry32` (kept in the lab's lib) for any seeded variation.
- Palette (exact, from spec — tuned only at gates): ink `#101014`, paper `#e9e7e0`, shell `#b7b9bd`, warm grey `#8f8c84`, glyph accents: triangle `#00ac9f`, circle `#df0024`, cross `#2e6db4`, square `#d651a7`. One accent per section: hero=triangle, work=circle, skills=cross, about=square, contact=triangle. Never mix accents in one gradient.
- 3D look (binding): full-res, `antialias: true`, dpr `[1, 2]`, smooth shading, three-point studio lighting, soft contact shadows, emissive allowed. BANNED: dither, vertex snap, affine warp, low-res targets, pixelation of any kind.
- Era via geometry/palette/copy only: glyph shapes △○✕□ as abstract SVG/3D geometry; NO Sony marks, logos, fonts, or product names. Copy law: UI copy dry lowercase, save/load vocabulary, no emoji.
- Real content ONLY from `data/` + `lib/labs-manifest.ts` + verbatim bio from `components/sections/about.tsx`. Claims law: Senior Frontend Engineer — never "lead".
- Navigation clarity outranks spectacle: native scroll; exactly ONE pinned scene (work rail); reduced-motion gets no pinning/parallax/cursor/spin and static vignettes; all content readable without WebGL and without JS.
- Esc/back: GalleryChrome owns them. NO custom Escape handling anywhere in this lab.
- A11y: r3f canvases `aria-hidden="true"`; 44px min touch targets; visible era-colored focus rings (`outline-color` from the section accent); skip link.
- Dev server for visual checks: `pnpm dev -p 3010` in THIS worktree (port 3000 belongs to the primary checkout). Never `pnpm build` while it runs.
- The canvas-2d jsdom shim (`__tests__/helpers/canvas-2d.ts`) is opt-in test infra — extend with real arithmetic only, never stubs.

## File Structure

```
components/labs/memory-card/
  tokens.ts            — MC palette/type/spacing/glyph paths/accentFor (pure)
  fonts.ts             — next/font Anton + Space Grotesk exports
  lib/bitmap-font.ts   — MOVED from ps1 (unchanged) + its test moves too
  lib/voxel-grid.ts    — pixel-avatar rects → blended voxel color grid (pure)
  lib/mulberry.ts      — mulberry32 (extracted from deleted textures.ts)
  audio.ts             — MOVED from ps1 (storage key renamed)
  three/stage.tsx      — <VignetteCanvas> shared stage (lights/shadow/IO gating)
  three/voxel-character.tsx — instanced voxel avatar + dais turntable
  three/card-model.tsx — rounded memory card + grooves + label texture
  three/crt-model.tsx  — CRT shell + curved screen + bitmap ticker
  sections/chrome.tsx  — fixed top bar + anchors + sound toggle + skip link
  sections/hero.tsx    — act 1: display type + character vignette
  sections/work.tsx    — act 2: pinned card rail + in-flow project list
  sections/skills.tsx  — act 3: kinetic type wall + HP bars
  sections/about.tsx   — act 4: CRT vignette + bio columns
  sections/contact.tsx — act 5: save prompt + footer/labs links
  cursor.tsx           — custom cursor (dot + glyph morph)
app/labs/memory-card/page.tsx      — server metadata + section assembly
app/labs/memory-card/lookdev/page.tsx — GATE 0 stage (deleted in Task 11)
scripts/posters/memory-card-poster.html + capture-memory-card.mjs
e2e/labs-memory-card.spec.ts
__tests__/labs/memory-card/{tokens,voxel-grid,bitmap-font,audio,sections}.test.*
DELETED: entire app/labs/ps1 route (redirect replaces it), all remaining
  components/labs/ps1/** , __tests__/labs/ps1/**
```

Execution order: 1→2 (ground zero) → 3,4 (pure modules) → 5 (**GATE 0, USER approves**) → 6 → 7 (**GATE 1**) → 8 → 9 → 10 (**GATE 2**) → 11 (battery) → 12 (poster) → 13 (footsteps rider) → 14 (final review, **GATE 3**, PR).

---

### Task 1: Merge main into the branch

**Files:** none created — merge commit only.

- [ ] **Step 1:** `git fetch origin main && git merge origin/main` from the worktree root. Expected conflicts: none or trivial (this branch never modified `lib/labs-manifest.ts`; main added the XP lab). If a conflict appears in any file this branch owns (`components/labs/ps1/**`, `docs/superpowers/**`), keep OUR side; for anything else keep THEIRS and report it.
- [ ] **Step 2:** `pnpm install` (main may have added deps — it did: xp assets/fontsource are already in lock), then `pnpm test:unit`, `npx tsc --noEmit`, `pnpm lint`. All green. KNOWN pre-existing failure allowance: none expected — if `navigation.spec.ts`-adjacent unit failures appear, STOP and report (that's e2e-only historically).
- [ ] **Step 3:** Commit is the merge commit itself. Report the merged SHA.

### Task 2: Teardown + scaffold — delete the dev room, claim the new slug

**Files:**
- Delete: `components/labs/ps1/ps1-scene.tsx`, `memory-card.tsx`, `ps1.module.css`, `boot.tsx`, `ps1-experience.tsx`, `panels/` (all 7 files), `scene/psx-pipeline.tsx`, `scene/psx-materials.ts`, `scene/room.tsx`, `scene/props.ts`, `scene/cameras.ts`, `scene/hotspots.ts`, `scene/textures.ts`, `scene/psx-constants.ts`
- Delete: `app/labs/ps1/` (page.tsx + proof/page.tsx)
- Delete tests: `__tests__/labs/ps1/{psx-materials,cameras,hotspots,textures}.test.ts`, `panels.test.tsx`
- Move: `components/labs/ps1/audio.ts` → `components/labs/memory-card/audio.ts`; `components/labs/ps1/scene/bitmap-font.ts` → `components/labs/memory-card/lib/bitmap-font.ts`; `__tests__/labs/ps1/{audio,bitmap-font}.test.ts` → `__tests__/labs/memory-card/` (update import paths only)
- Create: `components/labs/memory-card/lib/mulberry.ts`
- Create: `app/labs/memory-card/page.tsx` (placeholder assembly, real metadata)
- Modify: `next.config.ts` (redirect), `lib/labs-manifest.ts` (replace ps1 entry)
- Create: `public/labs/memory-card/poster.jpg` (TEMPORARY copy of `public/labs/ps1/poster.jpg`, replaced in Task 12; without it the museum painting errors to an empty wall) — then delete `public/labs/ps1/`

**Interfaces (Produces):**
- `lib/mulberry.ts`: `export function mulberry32(seed: number): () => number` (copy the exact function body from the deleted `textures.ts` before deleting it).
- `audio.ts`: unchanged API (`createPS1Audio` etc.) except the localStorage key literal `'ps1-sound'` → `'memory-card-sound'` (update its test accordingly).
- Manifest entry (verbatim):

```ts
{
  slug: 'memory-card',
  title: 'Memory Card',
  date: '2026-07-10',
  thesis:
    'The PS1 memory-card manager as an editorial site — crisp retro-3D product shots, save-slot typography, four button-glyph accents. No pixelation, all nostalgia.',
  status: 'live',
},
```

- `next.config.ts` gains:

```ts
async redirects() {
  return [
    { source: '/labs/ps1', destination: '/labs/memory-card', permanent: true },
  ]
},
```

- Placeholder page (server component — replaced piecewise by Tasks 6–9):

```tsx
import type { Metadata } from 'next'
import { GalleryChrome } from '@/components/labs/gallery-chrome'

export const metadata: Metadata = {
  title: 'Memory Card — Style Lab | Aram Yeghiazaryan',
  description:
    'Style Lab experiment: the PS1 memory-card manager as an editorial designer site — crisp retro-3D, save-slot typography, button-glyph accents.',
  openGraph: {
    title: 'Memory Card — Style Lab',
    description:
      'The PS1 memory-card manager as an editorial site. No pixelation, all nostalgia.',
    images: ['/labs/memory-card/poster.jpg'],
  },
}

export default function MemoryCardLabPage() {
  return (
    <GalleryChrome>
      <main className="min-h-screen" style={{ background: '#101014', color: '#e9e7e0' }}>
        <h1 className="p-8 text-2xl">memory card</h1>
      </main>
    </GalleryChrome>
  )
}
```

- [ ] **Step 1:** moves first (`git mv`), then deletions (`git rm`), then creations. Grep the repo for `labs/ps1` and `components/labs/ps1` after — remaining hits must ONLY be docs/, .superpowers/, scripts/posters/ps1-poster.html (leave those; the poster html is history).
- [ ] **Step 2:** update the two moved tests' imports; run them: `pnpm vitest run __tests__/labs/memory-card/` → green. Any manifest test asserting the `ps1` slug: update to `memory-card`.
- [ ] **Step 3:** full `pnpm test:unit` + `npx tsc --noEmit` + `pnpm lint` green. Visit `http://localhost:3010/labs/memory-card` (placeholder renders inside GalleryChrome) and `http://localhost:3010/labs/ps1` (302/308 → memory-card).
- [ ] **Step 4: Commit** `git commit -m "feat(memory-card): claim the slug - dev room deleted, redirect, salvage moved"`

### Task 3: Design tokens + fonts

**Files:**
- Create: `components/labs/memory-card/tokens.ts`, `components/labs/memory-card/fonts.ts`
- Test: `__tests__/labs/memory-card/tokens.test.ts`

**Before coding:** invoke the `design-system` skill; structure `tokens.ts` per its primitive→semantic layering advice where it fits a single-file module.

**Interfaces (Produces):**

```ts
// tokens.ts (values are the spec's exact anchors; gates tune ONLY here)
export const MC = {
  ink: '#101014',
  paper: '#e9e7e0',
  shell: '#b7b9bd',
  warmGrey: '#8f8c84',
  glyphs: {
    triangle: '#00ac9f',
    circle: '#df0024',
    cross: '#2e6db4',
    square: '#d651a7',
  },
} as const
export type GlyphName = keyof typeof MC.glyphs
export const GLYPH_ORDER: GlyphName[] = ['triangle', 'circle', 'cross', 'square']
/** idx % 4 cycling — same rule the old poster generators used. */
export function accentFor(i: number): string
/** Section → accent (hero triangle, work circle, skills cross, about square, contact triangle). */
export const SECTION_ACCENT: Record<'hero' | 'work' | 'skills' | 'about' | 'contact', GlyphName>
/** SVG path data for the four glyph shapes in a 24×24 viewBox, stroke-style. */
export const GLYPH_PATHS: Record<GlyphName, string>
export const TYPE = {
  display: 'clamp(3.5rem, 11vw, 8.5rem)', // Anton, uppercase, line-height 0.92
  h2: 'clamp(2rem, 5vw, 3.5rem)',
  label: '0.75rem', // mono, letter-spacing 0.2em, uppercase
  body: '1.0625rem', // Space Grotesk, line-height 1.6
} as const

// fonts.ts
import { Anton, Space_Grotesk } from 'next/font/google'
export const anton = Anton({ weight: '400', subsets: ['latin'], display: 'swap' })
export const grotesk = Space_Grotesk({ subsets: ['latin'], display: 'swap' })
// mono comes from the global fontsource JetBrains Mono:
export const monoFamily = 'JetBrains Mono Variable, JetBrains Mono, ui-monospace, monospace'
```

Glyph paths (verbatim — centered, stroke-drawable): triangle `M12 4 L21 19 L3 19 Z`, circle `M12 4 a8 8 0 1 0 0.001 0 Z`, cross `M5 5 L19 19 M19 5 L5 19`, square `M5 5 H19 V19 H5 Z`.

- [ ] **Step 1: failing test** — asserts: every `MC` hex matches `/^#[0-9a-f]{6}$/`; `accentFor(0..7)` cycles GLYPH_ORDER twice; `SECTION_ACCENT` covers exactly the five sections; each `GLYPH_PATHS` entry is a non-empty string starting with `M`.
- [ ] **Step 2:** RED (module missing) → implement → GREEN. `next/font` in a non-page module is fine (it's imported by client/server components later); if vitest chokes on `next/font/google` at import time in the tokens test, keep fonts.ts UNIMPORTED by tokens.ts (they're separate files; the test imports only tokens.ts).
- [ ] **Step 3:** full suite + tsc + lint green.
- [ ] **Step 4: Commit** `git commit -m "feat(memory-card): design tokens - glyph palette, type scale, fonts"`

### Task 4: Voxel grid — the avatar as data

**Files:**
- Create: `components/labs/memory-card/lib/voxel-grid.ts`
- Test: `__tests__/labs/memory-card/voxel-grid.test.ts`

**Interfaces (Produces):**

```ts
export type Voxel = { x: number; y: number; color: string } // y grows downward (grid space)
export const GRID_W = 32
export const GRID_H = 37
/** Paint the avatar's layered rects into a 32×37 grid (painter's order,
 *  alpha layers blended over what's beneath), return occupied cells. */
export function buildVoxelGrid(): Voxel[]
```

Implementation: transcribe the `Px` rect arrays and `LAYERS` list EXACTLY from `components/labs/xp/pixel-avatar.tsx` (same repo — read it; do not import it, the data becomes this module's own). Paint into a `(string | null)[]` of 32×37. For `rgba(r,g,b,a)` fills, blend over the existing cell: `out = round(fg*a + bg*(1-a))` per channel (cells painted by an alpha layer with NO base beneath are skipped — the avatar's alpha layers only ever shade existing pixels). Output hex lowercase.

- [ ] **Step 1: failing test** — asserts: `buildVoxelGrid()` is deterministic (two calls deep-equal); every voxel in bounds; total count > 400 (the figure is dense); cell (12,7) is `'#1c1917'` (pupil painted over eye-white); cell (11,7) is `'#fafaf9'` (eye white); cell (13,14) is the neck-shadow blend of `rgba(217,168,120,0.7)` over `#eec9a2` = `'#dcb083'` (compute in-test with the same formula to avoid hand-arithmetic errors: expect the module's cell to equal the test's own blend of those two constants); no cell equals `'#ffffff'` (no accidental default).
- [ ] **Step 2:** RED → implement → GREEN. **Step 3:** full suite + tsc + lint. 
- [ ] **Step 4: Commit** `git commit -m "feat(memory-card): voxel grid - pixel avatar as blended cell data"`

### Task 5: Vignette stage + three models + look-dev page → GATE 0

**Files:**
- Create: `components/labs/memory-card/three/stage.tsx`, `three/voxel-character.tsx`, `three/card-model.tsx`, `three/crt-model.tsx`
- Create (temporary, deleted Task 11): `app/labs/memory-card/lookdev/page.tsx`

**Before coding:** read the spec's "3D vignettes" look rules. This is a LOOK-DEV task — visual iteration through your own screenshots is the work; budget most of your time there.

**Interfaces (Produces):**
- `stage.tsx`: `<VignetteCanvas height?: string, reduced?: boolean, camera?: {position: [n,n,n], fov: number}>{children}</VignetteCanvas>` — r3f `<Canvas gl={{ antialias: true }} dpr={[1, 2]} aria-hidden>` wrapped in a div that mounts the Canvas only while intersecting (IntersectionObserver, `rootMargin: '200px'`); inside: three-point rig — key `directionalLight` `#fff` 2.2 from (3, 4, 2.5), fill `directionalLight` `#dfe8e6` 0.8 from (-3, 1.5, 2), rim `directionalLight` `#fff` 1.4 from (0, 3, -4), `ambientLight` `#404448` 0.5; contact shadow = a `circleGeometry` plane at y=0 with a radial-gradient CanvasTexture (black center 0.35 alpha → transparent edge, 256px). Background transparent (`gl.setClearColor(0x000000, 0)`). No-WebGL fallback (spec-mandated): before mounting the Canvas, probe `document.createElement('canvas').getContext('webgl2') ?? getContext('webgl')`; on failure render the reserved aspect box in `MC.paper` at 0.06 opacity with a centered stroked glyph (pass `fallbackGlyph: GlyphName` prop) — layout must not shift either way.
- `voxel-character.tsx`: `<VoxelCharacter spin?: boolean>` — one `InstancedMesh` of `BoxGeometry(0.94, 0.94, 0.94)` (0.06 gap reads as bevel), `MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 })`, per-instance `instanceColor` from `buildVoxelGrid()` (grid x→world x−16, grid y→world (37−y), z=0; scale so the figure is ~2.4 units tall), plus a SECOND back layer at z=−0.94 in the same colors darkened ×0.55 (depth read). Dais: `cylinderGeometry(2.1, 2.3, 0.28)` in `MC.shell` with a top ring of the four glyph shapes (canvas texture, `GLYPH_PATHS` stroked in their colors at 45° intervals). Whole group rotates `0.5 rad/s` via `useFrame` when `spin` (no rotation when not).
- `card-model.tsx`: `<CardModel label: { title: string; company: string; year: string; slot: string; accent: string }, tilt?: {x: number, y: number}, flipped?: boolean, backLines?: string[]>` — `flipped` springs group rotation.y to π revealing a BACK label plane at z=−0.145 (same texture generator, `backLines` = the metrics list instead of the title block) — shell `RoundedBoxGeometry(2.2, 2.9, 0.28, 5, 0.09)` (import from `three/examples/jsm/geometries/RoundedBoxGeometry.js`) in `MC.shell`; three groove caps: `BoxGeometry(0.5, 0.1, 0.3)` ×3 across the top edge, darkened shell; label = `planeGeometry(1.9, 2.3)` at z=0.145 with a 512×620 CanvasTexture: paper field, accent header band with the slot number (mono), title (big grotesque caps — `ctx.font = '700 64px "Space Grotesk", sans-serif'`), company + year rows (mono 28px), a small stroked glyph in the accent, 1px inner border in ink at 0.15 alpha. `anisotropy = 8`. Group rotation lerps to `tilt` each frame.
- `crt-model.tsx`: `<CRTModel lines: string[]>` — shell `RoundedBoxGeometry(3.2, 2.6, 2.4, 4, 0.12)` in `MC.warmGrey`; screen = `sphereGeometry(3.4, 48, 32, …)` section (φ/θ windowed to a ~2.4×1.8 cap) placed so the bulge faces +z, `MeshStandardMaterial({ emissive: '#0e2a26', emissiveIntensity: 0.55, color: '#0a1412', roughness: 0.35 })` with an `emissiveMap` CanvasTexture ticker: 640×480, `#0c1a18` field, `drawBitmapText` (moved lib) lines in `#7de8e0` scaled ×4, scanlines every 3px at 0.12 black, texture scrolls upward via `map.offset.y` in `useFrame` (0.02/s); a foot `boxGeometry(2.4, 0.24, 1.8)`.
- `lookdev/page.tsx`: client page, `?item=character|card|crt|all` (default all, three stages side by side on `MC.ink` background, each ~520px tall) — character spins, card shows a real project from `data/projects` (first entry, accent `accentFor(0)`), CRT shows 4 bio-ish lines (hardcoded era-generic: `['LOADING BIO…', '8 YRS FINTECH', 'YEREVAN → WORLDWIDE', 'PRESS START']`). No GalleryChrome (scaffolding).

- [ ] **Step 1:** implement stage + models + page. tsc + lint + full unit suite green (no unit tests for r3f components).
- [ ] **Step 2:** self-check screenshots at :3010/labs/memory-card/lookdev — per item AND all. Iterate until: voxel figure clearly reads as the site's avatar (sword visible, face readable); card reads as a glossy product shot (label crisp, bevels catching rim light); CRT screen legible with a gentle glow, no blown emissive. Save shots as `.superpowers/sdd/mc-task-5-{character,card,crt,all}.png` and VIEW them.
- [ ] **Step 3: Commit** `git commit -m "feat(memory-card): vignette stage + voxel avatar, card, crt look-dev"`
- [ ] **GATE 0 (ORCHESTRATOR → USER):** orchestrator re-screenshots and sends the set TO THE USER for approval. Page structure does not start until the user approves the objects. Tune (stage lighting values, material roughness, dais/label details) via fix waves under orchestrator art direction.

### Task 6: Chrome + hero (act 1)

**Files:**
- Create: `components/labs/memory-card/sections/chrome.tsx`, `sections/hero.tsx`
- Modify: `app/labs/memory-card/page.tsx` (assemble chrome + hero; placeholder h1 dies)
- Test: `__tests__/labs/memory-card/sections.test.tsx` (new — grows in Tasks 7–9)

**Before coding:** invoke `frontend-design` and `web-motion-design`.

**Interfaces:**
- Consumes: `MC/TYPE/SECTION_ACCENT/GLYPH_PATHS` (Task 3), `anton/grotesk/monoFamily` (Task 3), `<VignetteCanvas>` + `<VoxelCharacter>` (Task 5), `data/` (name/role — check `lib/constants.ts` `siteConfig` and `data/` for the exact name/title strings the main hero uses; reuse them).
- Produces: `<MemoryCardChrome soundOn onToggleSound>` fixed top bar; `<HeroSection reduced>` server-renderable section with a client vignette island. `page.tsx` becomes: server component reading `prefers-reduced-motion` is impossible server-side — the page renders all sections statically; client components read `useReducedMotion()` from framer-motion themselves.
- Chrome: fixed top, `mix-blend-mode: difference`-free (use per-section detection later if needed — keep solid `MC.ink` bar at 48px with bottom hairline `1px rgba(233,231,224,0.14)`), left `AY-01 · memory card` (mono label), center-right anchors `work skills about contact` (mono, lowercase, 44px hit areas, `href="#work"` etc.), right `sound: off` button (Task 10 wires it; render disabled-looking but present). Skip link: visually-hidden-until-focus `skip to the content` → `#work`.
- Hero: full-viewport (`min-h-[100svh]`) on `MC.ink`; oversized `h1` in Anton — line 1 `ARAM`, line 2 `YEGHIAZARYAN`, line 3 role (`SENIOR FRONTEND ENGINEER` — from siteConfig, uppercase styling only) at `TYPE.display`, `line-height: 0.92`, color paper, the character vignette absolutely positioned right overlapping line ends (`~44vw` wide desktop, below the type on mobile); a triangle glyph (SECTION_ACCENT.hero) stroked large and faint behind the type (`opacity 0.12`); intro: framer-motion staggered clip-path line reveals (0.09s stagger, 0.7s, `[0.16, 1, 0.3, 1]` ease), glyph flicker (opacity keyframes ×3 over 0.5s) — total under 1s, plays once; `useReducedMotion` → everything static, `spin={false}`. Scroll cue bottom-center: mono `scroll` + a triangle rotated 180°, gentle 1.6s y-bob (static under reduced motion).
- jsdom tests (RTL): chrome renders the four anchors with correct hrefs + the skip link; hero renders the name from siteConfig (import same source) and an aria-hidden vignette container. (Canvas/r3f: mock `three/stage.tsx` with `vi.mock` returning a plain div — the section test is about structure/content, not WebGL.)

- [ ] **Step 1:** failing tests → RED. **Step 2:** implement → GREEN. **Step 3:** full suite + tsc + lint; self-check screenshot at :3010 (hero top-of-page and post-intro states) — VIEW it: type must dominate, character overlaps the grid, no layout shift from the canvas mount (reserve the box with aspect ratio).
- [ ] **Step 4: Commit** `git commit -m "feat(memory-card): chrome + hero - display type, character vignette, intro kinetics"`

### Task 7: Skills (act 3 — built before act 2: no 3D, locks the type system) → GATE 1

**Files:**
- Create: `components/labs/memory-card/sections/skills.tsx`
- Modify: `app/labs/memory-card/page.tsx` (mount after hero for now; final order set in Task 9)
- Test: extend `__tests__/labs/memory-card/sections.test.tsx`

**Before coding:** invoke `frontend-design` + `web-motion-design`.

**Interfaces:**
- Consumes: `data/skills.ts` (`skillCategories`, `getSkillsByCategory`, `Skill{name, years, level, category}` — read the file for exact members), `accentFor`, fonts.
- Section `id="skills"`, paper background, ink text. Per category (in `skillCategories` order, accent `accentFor(idx)`): a huge outlined category word (Anton uppercase, `-webkit-text-stroke: 2px <accent>`, transparent fill, `TYPE.h2`×1.6 size, overflowing the container edge on alternating sides) followed by its skill rows. Row: name (grotesk 600), years right-aligned (mono, `{years} yrs`), HP bar: 12 segments (`level`∈1–5 → filled = `level * 2 + 2`, cap 12), filled segments in the accent, empty in `rgba(16,16,20,0.12)`, each segment 18×8px with 3px gap; fill animates left→right on scroll-into-view (whileInView, once, 0.04s stagger per segment; reduced-motion: pre-filled).
- jsdom test: renders EVERY skill name from the imported data; each category word present; bar segment count for a known skill (compute expected from the same imported `level`).

- [ ] **Steps:** failing tests → RED → implement → GREEN → full suite/tsc/lint → self-check screenshots (top of section + mid-scroll) → **Commit** `git commit -m "feat(memory-card): skills - kinetic type wall, hp bars"`
- [ ] **GATE 1 (ORCHESTRATOR):** screenshots of hero + skills against the design system: type scale/tracking, accent discipline (one per section), spacing rhythm, focus rings. Tune tokens only; commit `chore(memory-card): tune at gate 1 - …`.

### Task 8: Work (act 2 — the pinned card rail)

**Files:**
- Create: `components/labs/memory-card/sections/work.tsx`
- Modify: `app/labs/memory-card/page.tsx`
- Test: extend `__tests__/labs/memory-card/sections.test.tsx`

**Before coding:** invoke `web-motion-design`; read framer-motion `useScroll`/`useTransform` docs if unsure.

**Interfaces:**
- Consumes: `data/projects.ts` (exact shape: `{id, title, company, metrics: string[], year}` — verify by reading), `<VignetteCanvas>`, `<CardModel>`, `accentFor`, audio hooks arrive in Task 10 (leave `onCardFlip?: () => void` prop seams).
- Section `id="work"`, ink background. Structure: a wrapper of height `${projects.length * 90}vh`; inside, `position: sticky; top: 0; height: 100svh` stage containing ONE `<VignetteCanvas>` with all N cards in a row (world x = idx × 3.1), camera fov 40 at z≈6; `useScroll({ target: wrapper })` → `useTransform(scrollYProgress, [0,1], [0, -(N-1) * 3.1])` drives the card group's x each frame (spring-smoothed, `stiffness 90, damping 24`). HTML overlay bottom-left: current slot `mono` readout `slot 01 / 03` + project title (crossfades per nearest index). Cursor tilt: pointermove over the stage sets per-card tilt (max ±0.12 rad) for the card nearest center; click flips the centered card (rotation.y spring to π) revealing a back label texture (same generator, metrics list instead of title block); click again flips back. Touch: tap = flip; no tilt.
- BELOW the pinned scene (normal flow, same section): the in-flow project list — every project as an article: slot number (mono, accent `accentFor(idx)`), title (h3, grotesk 700), company · year (mono), both metrics as plain text. This list is the crawlable/reduced-motion/no-WebGL truth. Reduced-motion: the pinned wrapper collapses to a single static viewport-height stage (no sticky scroll math, first card centered, no spin/tilt) — content list unchanged.
- jsdom test: in-flow list renders every project title + all metrics from imported data; slot numbers zero-padded (`slot 01`).

- [ ] **Steps:** failing tests → RED → implement → GREEN → full suite/tsc/lint → self-check: screenshots at 4 scroll positions through the rail + one flip state; confirm rail progress maps 1:1 to scroll (no dead zones at entry/exit) → **Commit** `git commit -m "feat(memory-card): work - pinned memory card rail + crawlable list"`

### Task 9: About + contact (acts 4–5) + final page order

**Files:**
- Create: `components/labs/memory-card/sections/about.tsx`, `sections/contact.tsx`
- Modify: `app/labs/memory-card/page.tsx` (final order: chrome, hero, work, skills, about, contact)
- Test: extend `__tests__/labs/memory-card/sections.test.tsx`

**Before coding:** invoke `frontend-design`.

**Interfaces:**
- Consumes: bio strings — transcribe verbatim from `components/sections/about.tsx` (the four BIO paragraphs the old about-panel used; claims law), `siteConfig`/`data` contact values + `socialLinks` (exact source: read what `contact-panel.tsx` consumed before deletion — `lib/constants.ts`), `<CRTModel>`, `GLYPH_PATHS`.
- About (`id="about"`, paper): two text columns (grotesk body) flanking the CRT vignette on the grid line (CRT ~380px tall, square glyph accent); the CRT `lines` prop gets the bio condensed to 6 short caps lines (era ticker — write them from the bio facts, e.g. `8 YRS FINTECH`, `AMIO BANK · RETAIL`, `YEREVAN → WORLDWIDE`; no new claims); the `8 yrs · fintech systems · Yerevan → worldwide` line renders as an oversized mono ornament between the columns.
- Contact (`id="contact"`, ink): heading `save your progress?` (Anton, triangle accent), three rows (email/github/linkedin from constants): value in mono `1.25rem`, 44px `copy` button each, inline `copied` swap for 1.6s (the exact `copyText` try/catch pattern that lived in the deleted `contact-panel.tsx` — navigator.clipboard, execCommand fallback, never rejects). Footer: `← gallery` link to /labs + the other labs as text links from `hallLabs` (mono, exclude self), one line `© {year} aram yeghiazaryan` lowercase.
- jsdom tests: about renders a known verbatim bio sentence + the ornament line; contact renders all three values + copy buttons; footer lists every hallLabs title except Memory Card.

- [ ] **Steps:** failing tests → RED → implement → GREEN → full suite/tsc/lint → self-check screenshots (about, contact) → **Commit** `git commit -m "feat(memory-card): about crt + contact save prompt + final page order"`

### Task 10: Cursor + audio wiring → GATE 2

**Files:**
- Create: `components/labs/memory-card/cursor.tsx`
- Modify: `sections/chrome.tsx` (sound toggle live), `sections/work.tsx` (flip/hover sounds via the prop seams), `sections/hero.tsx` (first-scroll chime trigger), `app/labs/memory-card/page.tsx` (mount cursor + audio provider)
- Test: extend `__tests__/labs/memory-card/sections.test.tsx` (toggle + persistence with mocked audio)

**Before coding:** invoke `web-motion-design`. This task's REVIEW also covers the salvaged-but-unreviewed `audio.ts` (commit f6d58c2) — flag that in the report.

**Interfaces:**
- `cursor.tsx`: `<GlyphCursor/>` — fixed, pointer-events-none, `mix-blend-mode: difference`; a 6px paper dot following the pointer (spring `stiffness 400, damping 40`); hovering an element bearing `data-cursor="triangle|circle|cross|square"` morphs the dot into that stroked glyph at 22px in the element's accent (sections set `data-cursor` on their interactive elements per SECTION_ACCENT). Hidden entirely when: `(pointer: coarse)`, reduced motion, or pointer leaves the window. The native cursor stays VISIBLE (the glyph is an accompaniment, not a replacement — navigation clarity law).
- Audio wiring (factory API unchanged): one lazily-created instance in a module-level ref via a small `useMemoryCardAudio()` hook in `audio.ts` (add it there — wraps createPS1Audio, mounts once); chrome toggle ↔ `setEnabled` + label `sound: on/off` (persisted state read once on mount, same one-way reconciliation the factory already ships); nav anchors + copy buttons + card hover → `blip()`; card flip → `select()`; flip back → `back()`; boot chime fires once when hero scrolls out (IntersectionObserver, only if enabled). All calls are no-ops until the persisted/gestured enable — the factory already guarantees that.
- jsdom test: toggling calls `setEnabled(true)` and flips the label (mock the audio module with `vi.mock`); localStorage key asserted as `'memory-card-sound'` in the (moved) audio test — already done in Task 2, just confirm it still passes.

- [ ] **Steps:** failing tests → RED → implement → GREEN → full suite/tsc/lint → self-check: cursor morph over each section's interactives, sounds audible post-toggle (verify call sites fire via a console tap in dev, then remove it) → **Commit** `git commit -m "feat(memory-card): glyph cursor + synth audio wiring"`
- [ ] **GATE 2 (ORCHESTRATOR):** full scroll-through at :3010 — screenshots at ≥8 scroll positions incl. rail mid-states + flip, cursor states, reduced-motion emulation pass (no pin/spin/cursor, content complete), console clean. Placement/motion tune waves under art direction; commits `chore(memory-card): tune at gate 2 - …`.

### Task 11: E2E + battery (+ lookdev removal)

**Files:**
- Create: `e2e/labs-memory-card.spec.ts`
- Delete: `app/labs/memory-card/lookdev/page.tsx`, any `e2e/labs-ps1.spec.ts` remnant
- Test: the e2e file itself

**E2E (Playwright, follows the repo's existing lab spec patterns — read `e2e/labs-attic.spec.ts` for idioms; URL assertions after a settle wait, dev-server compile lag is a known false-green source):**

```ts
import { test, expect } from '@playwright/test'

test.describe('memory card lab', () => {
  test('redirects the old ps1 slug', async ({ page }) => {
    await page.goto('/labs/ps1')
    await page.waitForURL('**/labs/memory-card', { timeout: 15000 })
    await expect(page).toHaveURL(/\/labs\/memory-card$/)
  })

  test('renders all five acts with real content', async ({ page }) => {
    await page.goto('/labs/memory-card')
    await expect(page.locator('h1')).toContainText(/aram/i)
    for (const id of ['work', 'skills', 'about', 'contact']) {
      await expect(page.locator(`#${id}`)).toBeVisible()
    }
    await expect(page.locator('#work')).toContainText(/slot 01/i)
  })

  test('content exists without javascript', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false })
    const page = await ctx.newPage()
    await page.goto('/labs/memory-card')
    await expect(page.locator('#contact')).toContainText(/save your progress/i)
    await ctx.close()
  })

  test('escape returns to the gallery', async ({ page }) => {
    await page.goto('/labs/memory-card')
    await page.waitForLoadState('networkidle')
    await page.keyboard.press('Escape')
    await page.waitForURL('**/labs', { timeout: 15000 })
  })

  test('reduced motion stays static and complete', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    await page.goto('/labs/memory-card')
    await expect(page.locator('#skills')).toContainText(/react/i)
    await ctx.close()
  })
})
```

- [ ] **Step 1:** write the spec file; run `pnpm test:e2e -- labs-memory-card` (or the repo's single-file invocation — check package.json) with the dev server STOPPED first if the config starts its own (E2E_PORT lesson: config reuses an existing server — coordinate with the orchestrator's :3010 server via `E2E_PORT=3010`). All 5 green across the browser matrix or documented browser-specific skips.
- [ ] **Step 2:** delete lookdev; grep `lookdev` → no hits outside docs/.superpowers.
- [ ] **Step 3:** STOP the dev server (coordinate with orchestrator — it owns it), run `pnpm build` → clean; restart is the orchestrator's job.
- [ ] **Step 4: Commit** `git commit -m "test(memory-card): e2e - redirect, acts, no-js, esc, reduced motion"`

### Task 12: Museum poster

**Files:**
- Create: `scripts/posters/memory-card-poster.html`, `scripts/posters/capture-memory-card.mjs`
- Replace: `public/labs/memory-card/poster.jpg` (kills the Task-2 temp copy)

Poster (portrait 3:4, ≤200 KB, follows `xp-poster.html` + `capture-xp.mjs` patterns — read them): ink field, huge Anton `MEMORY CARD` cropped off-edge, a flat-design memory card front-and-center (CSS: shell rounded-rect, grooves, paper label with mono slot text), the four glyphs in their colors as a corner strip, `AY-01` mono footer. Pure HTML/CSS → captured at 900×1200 via the existing capture pattern → `poster.jpg` quality ~80.

- [ ] **Steps:** build html → capture → verify ≤200 KB and legible at 240px wide (museum size) by viewing it → visit :3010/labs (museum) and confirm the painting hangs → **Commit** `git commit -m "feat(memory-card): museum poster"`

### Task 13: Museum footsteps (rider — unchanged scope from the original brief)

**Files:**
- Create: `components/labs/museum/footsteps.ts`
- Modify: `components/labs/museum/player-controls.tsx` (wiring only)
- Test: `__tests__/labs/museum/footsteps.test.ts`

**SEQUENCING CHECK FIRST (orchestrator does this before dispatch):** `git log origin/main --oneline -5 -- components/labs/museum/` — if the museum changed since this branch's merge-base, merge main again before this task.

**Interfaces:**
- `footsteps.ts`: `createFootsteps(ctxFactory?: () => AudioContext)` returning `{ step(surface: 'marble' | 'wood'): void; setEnabled(on: boolean): void; enabled(): boolean }` — same synth-only/gesture/localStorage rules as the lab audio (key `'museum-sound'`); marble = short filtered-noise tap (bandpass ~1800 Hz, 60 ms decay), wood = lower knock (bandpass ~700 Hz, 90 ms, slight pitch drop). Pure factory, mock-ctx tested like `audio.ts`.
- `strideCrossed(prevDist: number, dist: number, stride = 1.9): boolean` — pure, exported: true when `floor(dist/stride) > floor(prevDist/stride)`.
- Wiring in `player-controls.tsx`: accumulate horizontal distance walked; on `strideCrossed` fire `step(floorY(x, z) > 0.1 ? 'wood' : 'marble')`; a small `sound: on/off` toggle in the museum HUD corner (dry lowercase, 44px), muted until gesture, reduced-motion default off. Do NOT touch collision/floorY math.
- Tests: `strideCrossed` boundary cases (crossing 1.9, 3.8; standing still; tiny jitter never fires); factory node-graph via mock ctx (two distinct voices, enable gating).

- [ ] **Steps:** failing tests → RED → implement → GREEN → full suite/tsc/lint → self-check at :3010/labs (walk hall + stairs, steps alternate surface) → **Commit** `git commit -m "feat(museum): synth footsteps - marble and wood strides"`

### Task 14: Final whole-branch review + PR → GATE 3

- [ ] **Step 1 (orchestrator):** `scripts/review-package $(git merge-base origin/main HEAD) HEAD` → dispatch the final code reviewer (most capable model) per `superpowers:requesting-code-review`, pointing it at the package, the spec, and the ledger's Minor-findings list for triage.
- [ ] **Step 2:** ONE fix subagent for the complete findings list; re-review the delta.
- [ ] **Step 3 (GATE 3):** battery re-run (unit, e2e, build), fresh full-page screenshots, then push `-u origin feat/labs-ps1-rework`, open the PR (title `feat(labs): memory card - the ps1 lab reborn as a designer site`) with before/after screenshots (dev-room vs memory-card) and the deletion note. Hand the Vercel preview to the user. **Merge only on the user's word.**
