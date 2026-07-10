# Memory Card lab — "Save Select" layout (design)

Date: 2026-07-10. Supersedes the section-scroll structure of
`2026-07-10-labs-memory-card-design.md` (assets, tokens, and tech from that spec survive;
its page anatomy was rejected at GATE 2: "generic sloppy layout… the scrolling doesn't work
well with memory cards"). User-selected concept: **the PS1 save/load screen becomes the
site's information architecture** — one viewport, zero page scroll, ink console surface.

## Concept

`/labs/memory-card` renders a single full-viewport **SELECT FILE** console screen on ink
(`MC.ink` full-bleed). A 15-block grid (5×3 — the PS1 card's real 15 save blocks) is the
only index. Highlighting a block previews it on a 3D stage; **LOAD** opens its content as a
paper panel over the screen. The layout is the concept: save-screen anatomy = information
architecture. No scroll-jacking anywhere; at desktop sizes the page never scrolls.

## Block → content mapping

| Block | Label       | Stage object                | LOAD opens                          |
|-------|-------------|-----------------------------|-------------------------------------|
| 01    | amio bank   | card, amio sticker          | save panel `/labs/memory-card/save/amio-bank` |
| 02    | 360dialog   | card, 360dialog sticker     | save panel `/labs/memory-card/save/360dialog` |
| 03    | snb mobile  | card, snb sticker           | save panel `/labs/memory-card/save/snb-mobile` |
| 04    | system data | character in capsule        | bio panel (client dialog)           |
| 05    | written with| card back, stack sticker (makeBackSticker w/ 4 stack names) | curated stack panel (client dialog) |
| 06    | save?       | card, front                 | contact panel styled as PS1 confirm dialog |
| 07–15 | (empty)     | —                           | nothing; blocks render honestly empty |

Project blocks read from `data/projects.ts` (id/title/year/metrics/technologies/description)
— no invented copy. `written with` reuses `lib/written-with.ts` (curated 7). `save?` reuses
the gate-2 contact content (copy rows, clipboard fallback) restyled as a confirm dialog
("save your progress? — yes / no", glyph-accented). Bio panel reuses the verbatim bio.

Each block carries a **shimmer icon**: 16×16-style pixel icon, 3-frame animation loop
(the real PS1 save-icon format), canvas-generated deterministically per block id via
`lib/mulberry.ts` — each visually distinct, junk-drawer charm intended. Empty blocks show a
dim empty-cell glyph, no icon, not focusable for LOAD (cursor may pass over them; stat line
reads `empty block`).

## Screen anatomy (desktop ≥ lg)

- **Chrome strip** (top, ~48px, adapted `sections/chrome.tsx`): `memory card — aram` +
  sound toggle + gallery link. Bottom hairline strip (mono, ~10px, `paperAlpha(0.42)`):
  both CC-BY attribution lines — always visible (license compliance), plus © year.
- **Left column**: `SELECT FILE` eyebrow (mono, letter-spacing 0.2em) + the 5×3 block grid.
  Cursor = teal (`MC.glyphs.triangle`) rounded outline + subtle glow; unselected blocks
  dim; selected block's icon animates faster (XMB focus-cue energy: emphasis by scale/
  brightness, never a loud highlight box).
- **Right/stage**: the 3D preview (reuses `three/stage.tsx` VignetteCanvas — IO gate,
  RoomEnvironment, context-loss recovery all survive). New `three/save-stage.tsx` renders
  ONE object at a time: the card (single-card extraction of `card-rail.tsx` — recess
  constants, sticker float quads, `lib/label-texture.ts` generators reused verbatim) or the
  character (existing GLB + `Armature.F|bashful` idle via `gltf-vignette.tsx` mixer path).
  Selecting a block swaps the front sticker (quick eject-nudge + crossfade; reduced: instant).
  Pointer drag on the card = bounded rotate-to-inspect (use existing pointer events, no new
  dep); tap = flip to metrics back. Character swap-in only for block 04.
- **Stat line** (bottom, FF7 save-slot anatomy): dense mono strip for the highlighted block —
  `slot 01 · AMIO BANK IBANK · saved 2023–present · react / typescript · ▮▮▮ 3 blocks` —
  plus the **LOAD** affordance (also `enter`). Metrics count maps to block-bars.

## LOAD, routing, crawlability

- Project saves use **Next.js parallel + intercepting routes**: `app/labs/memory-card/`
  gets an `@panel` slot; in-app LOAD renders the save as a paper panel sliding over the ink
  screen (Esc / back button closes, screen stays mounted beneath); hard navigation to
  `/labs/memory-card/save/[id]` renders a standalone full page (paper, same content,
  link back to the screen). Deep-linkable, crawlable, SEO-safe.
- Panel content (compact save-data, from `data/projects.ts`): title, year, category, role
  line, description, metrics list (accent `›` ticks — back-sticker language), technologies,
  links if present. CRT sits at the panel head as the "now playing" vignette:
  `three/crt-vignette.tsx` with a per-project ticker line set (title/year/stack facts) —
  same `lib/crt-screen.ts` machinery, lines passed per save.
- Blocks 04–06 are client-side dialogs (no URL) — content still server-rendered in the DOM
  (visually hidden until open) so it stays crawlable. A `<noscript>` block on the page
  carries name/role/summary/contact as plain HTML.

## Input model

- Keyboard: arrows move the block cursor (roving tabindex grid, `aria-activedescendant`
  pattern NOT used — real focus moves), Enter = LOAD, Esc closes panel (Esc law).
  Tab order: chrome → grid → stat-line LOAD → footer.
- Pointer/touch: tap block = highlight; tap again (or LOAD) = open. Fat targets ≥44px.
- Cursor: existing `cursor.tsx` GlyphCursor survives (difference blend works on ink).
- Hub-and-spoke law: every panel closes back to the same screen state; nothing navigates
  away except the gallery link.

## Sound grammar (all existing synths, square-wave family)

- cursor move = `blip`, LOAD/open = `select`, close = `back`. Sounds fire ONLY from
  explicit user actions — the scroll-triggered boot chime is DELETED (it was the
  "Windows shutdown music" misread; verdict in ledger).
- `audio.ts` / `audio-context.tsx` survive: persistence key `memory-card-sound`,
  gesture-arming for returning visitors, stable-actions context split — unchanged.
- Room tone: unchanged (toggle-gated).

## Boot sequence

- Visual: ~1.5s ink boot beat on first entry per session (`sessionStorage`), any
  key/tap skips instantly, reduced-motion never sees it. Diamond/glyph shimmer +
  `memory card` wordmark — PS1-BIOS-flavored, built from tokens (no ripped imagery).
- Audio (user's bar: "no generic windows boot sound… it should be the original ps1 iconic
  boot start music"): the original recording is Sony-copyrighted; ripping the BIOS audio
  violates the standing no-ripped-assets law (the branding amendment covered printed marks
  only). Lane: **WebAudio recreation of the actual PS1 boot phrase** (deep layered swell +
  bell shimmer, convolver reverb from a generated impulse). User judges at the gate; if it
  doesn't convince, boot ships SILENT. No generic chime under any outcome. Plays only if
  sound is on and the context is gesture-armed; otherwise visual-only.

## Mobile (< lg)

Single column, native scroll allowed but gentle (≈1.2 screens max), never jacked:
chrome → stage (reduced height) → stat line → block grid (larger cells, tap-first) →
footer strip. Panels open full-screen (sheet), Esc/back closes.

## Reduced motion

Static icons (frame 0), no idle float/eject animation, instant sticker/stage swaps,
panels cut in/out (opacity only), boot skipped entirely, stage renders static poses
(existing `frameloop='demand'` + `invalidate()` discipline).

## Aesthetic spec

- Surface: `MC.ink` full-bleed; text/rules in `MC.paper` via `paperAlpha()`; accents =
  glyph colors, one accent hit per region (cursor teal, LOAD tick per-save `accentFor`).
- Type: Anton only for the `SELECT FILE` header word; everything else Space Grotesk +
  mono per `TYPE`. Stat line mono. No display-type walls (GATE-1 lesson: curate).
- Restraint law: no scanline overlays or CRT filters on the page itself (the CRT object
  carries that language); at most a soft viewport vignette. Glow ≤ one shadow radius.
- Panels: paper (`MC.paper` / `STICKER_PAPER`), printed-keyline language from the sticker
  generators — the panel should read as label stock over the console screen.

## Architecture

New (components/labs/memory-card/):
- `save-select/screen.tsx` — the viewport layout (chrome, grid, stat line, stage mount)
- `save-select/block-grid.tsx` — roving-tabindex grid + cursor logic
- `save-select/stat-line.tsx` — FF7 stat strip + LOAD
- `save-select/blocks.ts` — block model (id, kind, label, data binding, icon seed)
- `lib/block-icon.ts` — deterministic 16×16 3-frame shimmer icon generator (canvas)
- `three/save-stage.tsx` — single-object stage (card w/ sticker swap, character)
- `panels/save-panel.tsx`, `panels/bio-panel.tsx`, `panels/stack-panel.tsx`,
  `panels/contact-panel.tsx` — paper panels (contact = confirm-dialog styling)
- `boot.tsx` — skippable boot beat
- app: `app/labs/memory-card/@panel/` slot + `save/[id]/page.tsx` standalone pages +
  intercepting route; `page.tsx` becomes the screen mount
- `audio.ts`: add `bootPhrase()` (the recreation attempt), delete nothing else

Deleted (content migrates first): `sections/hero.tsx`, `sections/skills.tsx`,
`sections/work.tsx`, `sections/about.tsx`, `sections/contact.tsx`,
`three/card-rail.tsx` (after single-card extraction). `lookdev/` stays until final task.
`lib/voxel-grid.ts` + `three/voxel-character.tsx` + `three/card-model.tsx` +
`three/crt-model.tsx` (procedural leftovers) die with this rework if still unreferenced.

## Testing

- Unit: block model mapping (projects → blocks, empties), roving tabindex/keyboard nav,
  icon generator determinism, boot skip/session logic, panel open/close state, stat-line
  formatting; existing law tests migrate (no `/lead/i`, character-agnostic copy, attribution
  lines present in chrome footer).
- Panels/screen hydration: SSR + client byte-identical (existing renderToStaticMarkup harness).
- E2E (re-planned final task): keyboard-only run (arrows → enter → esc), deep-link to a
  save URL, mobile tap run, reduced-motion run.

## Standing constraints (carried forward, binding)

Senior Frontend Engineer only (no lead claims, test-enforced) · character-agnostic code/copy/
tests (GLB drop-in swappable; male-swap rider open) · CC-BY attribution lines always visible ·
no game-ripped assets (incl. audio recordings) · real PS branding allowed (user amendment) ·
no `Math.random` (mulberry32) · immutability · sound only from explicit gestures · Esc law ·
user previews on Vercel before ANY merge; merge only on his word.
