# Memory Card lab — "Save Select" layout (design)

Date: 2026-07-10. Supersedes the section-scroll structure of
`2026-07-10-labs-memory-card-design.md` (assets, tokens, and tech from that spec survive;
its page anatomy was rejected at GATE 2: "generic sloppy layout… the scrolling doesn't work
well with memory cards"). User-selected concept: **the PS1 save/load screen becomes the
site's information architecture** — one viewport, zero page scroll, ink console surface.

## Concept

`/labs/memory-card` renders a single full-viewport **SELECT FILE** console screen on ink
(`MC.ink` full-bleed). The index is a stack of **editorial save strips** — FF7 save-screen
anatomy rendered as typographic design (user-picked over a literal block grid, which he
correctly called out as UI-clone slop risk: tile grid + empty filler cells). Highlighting a
strip previews it on a 3D stage; **LOAD** opens its content as a paper panel over the
screen. The layout is the concept: save-screen anatomy = information architecture. No
scroll-jacking anywhere; at desktop sizes the page never scrolls. The card's 15-block
hardware truth survives as a stat-line detail (`blocks 9/15 used`), not as UI tiles.

## Save strip → content mapping

| Slot | Label       | Stage object                | LOAD opens                          |
|------|-------------|-----------------------------|-------------------------------------|
| 01   | amio bank   | card, amio sticker          | save panel `/labs/memory-card/save/amio-bank` |
| 02   | 360dialog   | card, 360dialog sticker     | save panel `/labs/memory-card/save/360dialog` |
| 03   | snb mobile  | card, snb sticker           | save panel `/labs/memory-card/save/snb-mobile` |
| 04   | system data | character in capsule        | bio panel (client dialog)           |
| 05   | written with| card back, stack sticker (makeBackSticker w/ 4 stack names) | curated stack panel (client dialog) |
| 06   | save?       | card, front                 | contact panel styled as PS1 confirm dialog |

Project strips read from `data/projects.ts` (id/title/year/metrics/technologies/description)
— no invented copy. `written with` reuses `lib/written-with.ts` (curated 7). `save?` reuses
the gate-2 contact content (copy rows, clipboard fallback) restyled as a confirm dialog
("save your progress? — yes / no", glyph-accented). Bio panel reuses the verbatim bio.

**Strip anatomy** (each strip is a designed typographic data row, NOT a tile): oversized
slot numeral (display type, `paperAlpha(0.25)` ghost weight) · a 16×16-style **shimmer
icon** (3-frame loop, the real PS1 save-icon format, canvas-generated deterministically per
slot id via `lib/mulberry.ts` — small, information-bearing project identity, not ornament) ·
title in display caps · dense mono stat sub-line (year · stack · `▮▮▮` block bars from
metrics count) · hairline rule between strips. Slots 04–06 are visually quieter (smaller
numeral scale, may sit as a compact row group) — projects lead the hierarchy. No empty
strips are rendered; free capacity appears only in the stat-line footer (`blocks 9/15
used`). Highlight = teal cursor rule + icon animates faster + numeral fills (XMB focus-cue
energy: emphasis by weight/brightness, never a highlight box).

## Screen anatomy (desktop ≥ lg)

- **Chrome strip** (top, ~48px, adapted `sections/chrome.tsx`): `memory card — aram` +
  sound toggle + gallery link. Bottom hairline strip (mono, ~10px, `paperAlpha(0.42)`):
  both CC-BY attribution lines — always visible (license compliance), plus © year.
- **Left column**: `SELECT FILE` header (Anton, the screen's one display-type hit) + the
  save-strip stack per the strip anatomy above. Cursor = teal (`MC.glyphs.triangle`)
  hairline rule/edge accent on the highlighted strip; unhighlighted strips dim slightly.
- **Right/stage**: the 3D preview (reuses `three/stage.tsx` VignetteCanvas — IO gate,
  RoomEnvironment, context-loss recovery all survive). New `three/save-stage.tsx` renders
  ONE object at a time: the card (single-card extraction of `card-rail.tsx` — recess
  constants, sticker float quads, `lib/label-texture.ts` generators reused verbatim) or the
  character (existing GLB + `Armature.F|bashful` idle via `gltf-vignette.tsx` mixer path).
  Selecting a strip swaps the front sticker (quick eject-nudge + crossfade; reduced: instant).
  Pointer drag on the card = bounded rotate-to-inspect (use existing pointer events, no new
  dep); tap = flip to metrics back. Character swap-in only for slot 04.
- **Stat line** (bottom): dense mono footer for the highlighted slot —
  `▸ LOAD slot 01 · blocks 9/15 used` — the **LOAD** affordance (also `enter`) plus the
  card's free-capacity detail. Per-save data lives in the strips themselves.

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
- Slots 04–06 are client-side dialogs (no URL) — content still server-rendered in the DOM
  (visually hidden until open) so it stays crawlable. A `<noscript>` block on the page
  carries name/role/summary/contact as plain HTML.

## Input model

- Keyboard: up/down arrows move the strip cursor (roving tabindex list,
  `aria-activedescendant` NOT used — real focus moves), Enter = LOAD, Esc closes panel
  (Esc law). Tab order: chrome → strips → stat-line LOAD → footer.
- Pointer/touch: tap strip = highlight; tap again (or LOAD) = open. Fat targets ≥44px.
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
  `memory card` wordmark — PS1-BIOS-flavored, built from tokens.
- Audio: **the original PS1 boot recording** (user's bar verbatim: "no generic windows
  boot sound, if we are going to do the boot sound, it should be the original ps1 iconic
  boot start music"; ripped-assets law repealed by him 2026-07-10 — he's an individual
  making fun experiments, his call, recorded in ledger). Asset lands at
  `public/labs/memory-card/sounds/ps1-boot.mp3` (source: PS1 system BIOS audio, e.g.
  sounds.spriters-resource.com/playstation/systembios/ — user downloads or approves the
  fetch). Plays only if sound is on and the context is gesture-armed (entry click from the
  gallery counts); otherwise the boot is visual-only. Trim/fade to the beat's length.

## Mobile (< lg)

Single column, native scroll allowed but gentle (≈1.2 screens max), never jacked:
chrome → stage (reduced height) → strip stack (taller rows, tap-first) → stat line →
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
- `save-select/screen.tsx` — the viewport layout (chrome, strips, stat line, stage mount)
- `save-select/save-strips.tsx` — roving-tabindex strip stack + cursor logic
- `save-select/stat-line.tsx` — LOAD affordance + blocks-used footer
- `save-select/saves.ts` — save model (slot, kind, label, data binding, icon seed)
- `lib/save-icon.ts` — deterministic 16×16 3-frame shimmer icon generator (canvas)
- `three/save-stage.tsx` — single-object stage (card w/ sticker swap, character)
- `panels/save-panel.tsx`, `panels/bio-panel.tsx`, `panels/stack-panel.tsx`,
  `panels/contact-panel.tsx` — paper panels (contact = confirm-dialog styling)
- `boot.tsx` — skippable boot beat
- app: `app/labs/memory-card/@panel/` slot + `save/[id]/page.tsx` standalone pages +
  intercepting route; `page.tsx` becomes the screen mount
- `audio.ts`: add `bootMusic()` (HTMLAudio playback of ps1-boot.mp3, gated by enabled+armed
  state), delete the old `boot()` synth and its scroll-out call site

Deleted (content migrates first): `sections/hero.tsx`, `sections/skills.tsx`,
`sections/work.tsx`, `sections/about.tsx`, `sections/contact.tsx`,
`three/card-rail.tsx` (after single-card extraction). `lookdev/` stays until final task.
`lib/voxel-grid.ts` + `three/voxel-character.tsx` + `three/card-model.tsx` +
`three/crt-model.tsx` (procedural leftovers) die with this rework if still unreferenced.

## Testing

- Unit: save model mapping (projects → strips), roving tabindex/keyboard nav,
  icon generator determinism, boot skip/session logic, panel open/close state, stat-line
  formatting; existing law tests migrate (no `/lead/i`, character-agnostic copy, attribution
  lines present in chrome footer).
- Panels/screen hydration: SSR + client byte-identical (existing renderToStaticMarkup harness).
- E2E (re-planned final task): keyboard-only run (arrows → enter → esc), deep-link to a
  save URL, mobile tap run, reduced-motion run.

## Standing constraints (carried forward, binding)

Senior Frontend Engineer only (no lead claims, test-enforced) · character-agnostic code/copy/
tests (GLB drop-in swappable; male-swap rider open) · CC-BY attribution lines always visible ·
ripped/authentic assets ALLOWED (law repealed by user 2026-07-10; real PS branding likewise) ·
no `Math.random` (mulberry32) · immutability · sound only from explicit gestures · Esc law ·
user previews on Vercel before ANY merge; merge only on his word.
