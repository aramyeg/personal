# Memory Card "Save Select" Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the rejected section-scroll layout of `/labs/memory-card` with a single-viewport "Save Select" console screen — editorial save strips as the index, a single-object 3D stage (card/character), paper panels via intercepting routes, real PS1 boot audio.

**Architecture:** One full-viewport ink screen (no page scroll at desktop): a roving-tabindex stack of typographic save strips on the left, a 3D preview stage on the right (memory-card GLB with swappable stickers, or the character for `system data`), a stat-line footer with LOAD. Project saves open as paper panels over the screen via Next.js parallel+intercepting routes (real pages at `/labs/memory-card/save/[id]`); system slots open client dialogs whose content is server-rendered. All GATE-2-surviving tech (GLBs, sticker generators, CRT ticker, VignetteCanvas context recovery, square-wave synths) is reused, not rebuilt.

**Tech Stack:** Next.js 15 App Router (parallel + intercepting routes), React 19, react-three-fiber + three (bundled), framer-motion (bundled), Vitest unit, Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-07-10-labs-memory-card-save-select-design.md` — binding for every task.
**Skills (installed, mandatory consults):** implementers of R3, R4, R5 invoke `frontend-design` and/or `design-system` before styling; R3 and R6 consult `web-motion-design` for any animation added.

## Global Constraints

- Zero new npm packages. Fonts stay: Anton + Space Grotesk via `components/labs/memory-card/fonts.ts`, mono = bundled JetBrains Mono (`monoFamily` from fonts.ts).
- Palette/type ONLY through `components/labs/memory-card/tokens.ts` (`MC`, `TYPE`, `accentFor`, `paperAlpha`, `inkAlpha`, `STICKER_PAPER`, `GLYPH_PATHS`). No new hex literals; add tokens if a value is unowned.
- No `Math.random` — `lib/mulberry.ts` for any seeded variation.
- Claims law: "Senior Frontend Engineer" — never "lead" (`/lead/i` test must survive the rework). Character-agnostic law: no she/her/identity words in code/copy/tests; character GLB is drop-in swappable (`CHARACTER_IDLE_CLIP` constant, single definition).
- Attribution law: "crt model by meipal (cc by 4.0)" + "character by humans of the world (cc by 4.0)" ALWAYS visible on the screen (footer strip), plus on standalone save pages.
- Ripped/authentic assets ALLOWED (user repealed the law 2026-07-10): the boot plays the original PS1 boot recording from `public/labs/memory-card/sounds/ps1-boot.mp3`. USER LANE: he drops the file (or approves a fetch); ALL audio code must no-op gracefully while the file is absent.
- Sound fires ONLY from explicit user gestures (cursor move blip / LOAD select / close back / boot on armed entry). The old scroll-triggered `boot()` synth is deleted — it was the "Windows shutdown music" bug (ledger verdict).
- Reduced motion: static icon frame 0, no idle float/eject, instant sticker/stage swaps, panels fade only, boot skipped entirely, stages render static poses (`frameloop='demand'` + `invalidate()` discipline).
- Esc: panels/dialogs own Esc while open (close + `back()` sound, stopPropagation — XP-lab precedent); GalleryChrome keeps Esc otherwise.
- Copy law: UI copy dry lowercase, save/load vocabulary, no emoji. Content only from `data/projects.ts`, `lib/written-with.ts`, the verbatim bio, existing contact rows.
- Hydration law: SSR + first client paint byte-identical in both reduced modes (existing `renderToStaticMarkup` test harness pattern).
- A11y: 44px min touch targets; r3f canvases `aria-hidden`; visible focus rings (`--mc-ring` pattern from chrome.tsx); skip link stays.
- Restraint law (spec): NO scanline overlays or CRT filters on the page itself — the CRT object owns that language; at most a soft viewport vignette; glow ≤ one shadow radius.
- Dev server: `pnpm dev -p 3010` runs in THIS worktree (orphan process hot-reloads it). Never `pnpm build` while it runs. Screenshot scripts live in `.superpowers/sdd/` (gitignored).
- ZOOM-CROP LAW: any visual claim in reports/reviews must be verified on a zoomed crop, not full-frame.

## File Structure

```
components/labs/memory-card/
  save-select/saves.ts        — NEW save model (pure): SaveSlot type + buildSaves()
  save-select/screen.tsx      — NEW viewport layout: chrome+strips+stage+stat line
  save-select/save-strips.tsx — NEW roving-tabindex strip stack
  save-select/stat-line.tsx   — NEW LOAD affordance + blocks-used footer
  lib/save-icon.ts            — NEW deterministic 16×16 3-frame shimmer icon
  three/save-card.tsx         — NEW single card + stickers (extracted from card-rail)
  three/save-stage.tsx        — NEW one-object stage host (card | character)
  panels/panel-shell.tsx      — NEW shared paper panel chrome (focus trap, Esc)
  panels/save-panel.tsx       — NEW project save-data content (+ CRT head)
  panels/bio-panel.tsx        — NEW verbatim bio (port from sections/about.tsx)
  panels/stack-panel.tsx      — NEW written-with (port from sections/skills.tsx)
  panels/contact-panel.tsx    — NEW confirm-dialog contact (port from sections/contact.tsx)
  boot.tsx                    — NEW skippable boot beat + bootMusic trigger
  audio.ts                    — MODIFY: boot() synth → bootMusic() (HTMLAudio)
  audio-context.tsx           — MODIFY: actions type boot→bootMusic
  sections/chrome.tsx         — MODIFY: attribution footer strip; anchors removed
  three/crt-vignette.tsx      — MODIFY: accept lines?: string[] pass-through
  lib/crt-screen.ts           — MODIFY: ticker lines injectable (default = current 6)
app/labs/memory-card/
  layout.tsx                  — NEW: renders {children} + {panel} parallel slot
  page.tsx                    — MODIFY: mounts SaveSelectScreen (sections gone)
  @panel/default.tsx          — NEW: returns null
  @panel/(.)save/[id]/page.tsx— NEW: intercepted overlay render of SavePanel
  save/[id]/page.tsx          — NEW: standalone paper page per save
public/labs/memory-card/sounds/ps1-boot.mp3 — USER-provided asset (graceful absent)
DELETED (R7): sections/{hero,work,skills,about,contact}.tsx, three/card-rail.tsx,
  three/{card-model,crt-model}.tsx, three/voxel-character.tsx, lib/voxel-grid.ts,
  their tests (law tests MIGRATE first) · (R8): app/labs/memory-card/lookdev/
__tests__/labs/memory-card/save-select/*.test.{ts,tsx} — NEW per task
```

Execution order: R1 → R2 → R3 (**GATE A: user look-dev on the screen**) → R4 → R5 → R6 → R7 (**GATE B: user plays full experience on :3010**) → R8 → R9 → R10 (**GATE C → PR → Vercel preview → merge only on his word**).

---

### Task R1: Save model + shimmer icons (pure modules)

**Files:**
- Create: `components/labs/memory-card/save-select/saves.ts`
- Create: `components/labs/memory-card/lib/save-icon.ts`
- Test: `__tests__/labs/memory-card/save-select/saves.test.ts`, `__tests__/labs/memory-card/save-select/save-icon.test.ts`

**Interfaces (Produces):**

```ts
// saves.ts
export type SaveKind = 'project' | 'bio' | 'stack' | 'contact'
export type SaveSlot = {
  slot: string            // '01'…'06'
  kind: SaveKind
  label: string           // strip title, display caps source (project.title or system label)
  sub: string             // mono stat sub-line, lowercase (e.g. '2023–present · next.js · typescript')
  blocks: number          // ▮ count; projects = metrics.length, system slots = 0
  accent: string          // accentFor(index)
  project?: ExtendedProject // present iff kind === 'project'
}
export const CARD_BLOCKS_TOTAL = 15
export function buildSaves(projects: ExtendedProject[]): SaveSlot[]
export function blocksUsed(saves: SaveSlot[]): number   // sum of blocks
// buildSaves: projects (in data order) → slots 01..N, then
// { kind:'bio', label:'system data' }, { kind:'stack', label:'written with' },
// { kind:'contact', label:'save?' } as the last three slots.
// sub for projects: `${year} · first two technologies` lowercased;
// bio: 'aram yeghiazaryan · senior frontend engineer'; stack: '7 entries · this page only';
// contact: 'save your progress'.

// save-icon.ts (browser-only, canvas)
export const ICON_FRAMES = 3
export function makeSaveIconFrames(seed: string, accent: string): HTMLCanvasElement[]
// three 16×16-cell frames drawn on 64×64 canvases (4px cells, crisp), mulberry32-seeded
// from `seed` (hash its chars), symmetric-half pixel pattern (mirror x) so icons read as
// deliberate marks; frame 1/2 mutate ~4 cells from frame 0 (the PS1 shimmer).
```

- [ ] **Step 1:** Write failing tests: `buildSaves` maps 3 projects → 6 slots in order with slots '01'–'06'; kinds sequence `project×3, bio, stack, contact`; `blocks` = metrics.length for projects, 0 for system; `blocksUsed` = 9 with current data; `sub` strings lowercase; accent = `accentFor(i)`. Icon tests (jsdom + canvas shim OR node-canvas-free logic split): same seed → identical pixel data across two calls; different seeds → different data; 3 frames; frames 1,2 differ from frame 0. If the jsdom canvas shim lacks `getImageData`, split the pure pattern math into an exported `saveIconPattern(seed): number[][]` (16×16×3 of 0/1/2 accent indices) and test THAT — drawing stays thin and untested.
- [ ] **Step 2:** Run: `pnpm vitest __tests__/labs/memory-card/save-select/ --run` → FAIL (modules missing).
- [ ] **Step 3:** Implement both modules (pure, no React). `saves.ts` imports `accentFor` from `../tokens` and `type ExtendedProject` from `@/data/projects`. `save-icon.ts` imports `mulberry32` from `./mulberry` — NOT Math.random.
- [ ] **Step 4:** Tests green; `npx tsc --noEmit`; `pnpm lint` clean.
- [ ] **Step 5:** Commit `feat(labs/memory-card): save model + shimmer icon generator`.

### Task R2: Single-object save stage

**Files:**
- Create: `components/labs/memory-card/three/save-card.tsx`
- Create: `components/labs/memory-card/three/save-stage.tsx`
- Test: `__tests__/labs/memory-card/save-select/save-stage.test.tsx` (jsdom: mock three internals per existing section-test pattern; assert host wiring/props, not GL)

**Interfaces:**
- Consumes: `SaveSlot` from R1; `VignetteCanvas` (`three/stage.tsx`, props `{reduced, camera, target, shadowRadius, envIntensity, fallbackGlyph, children}`); `GltfVignette` (props `{src, fitHeight, yaw, spin, floorY, animation}`); `makeFrontSticker`/`makeBackSticker` from `lib/label-texture.ts`; `fitToStage` from `lib/fit-model.ts`.
- Produces: `SaveStage({ save, flipped, reduced, onTap }: { save: SaveSlot; flipped: boolean; reduced: boolean; onTap?: () => void }): JSX.Element` — one `VignetteCanvas` whose child is `SaveCard` (kinds project/stack/contact) or the character `GltfVignette` (kind bio); `onTap` fires on card click/tap (screen uses it to toggle `flipped`; ignored for bio kind). `SaveCard({ save, flipped, reduced, onTap })` exports nothing else.

**Steps:**
- [ ] **Step 1:** `save-card.tsx`: extract the single-card essentials from `three/card-rail.tsx` (READ it first; card-rail itself stays untouched until R7): `SRC='/labs/memory-card/models/memory-card.glb'`, `BASE_YAW=Math.PI`, recess constants (`RECESS_CX 0.0132, RECESS_CY -0.3395, RECESS_W 1.117, RECESS_H 0.703, FRONT_Z -0.1094, BACK_Z 0.1311`), `measureScene`/`fitToStage` fit at `FIT_HEIGHT 1.9`, fonts-ready redraw effect, per-card `makeShadowTexture()` floor quad. Behavior: front sticker from `save` (project kinds: `makeFrontSticker({slot, title: save.label, year: save.project.year, accent})`; stack kind: card faces BACK (`BASE_YAW + π` resting yaw) with `makeBackSticker({slot: save.slot, metrics: WRITTEN_WITH.slice(0,4).map(e => e.name), accent})`; contact kind: front, plain amio… no — contact shows the FRONT with NO project sticker: keep the card bare (branded decal only)). Sticker swap on `save` change: 0.25s eject-nudge (y +0.06 out-and-back lerp in `useFrame`) + texture crossfade via material opacity; `reduced` → instant swap, no nudge. Pointer drag = bounded yaw inspect (clamp ±0.5 around resting yaw, spring-return on release, existing pointer-event pattern from work.tsx tilt); click/tap toggles nothing here — `flipped` prop drives a π y-flip lerp (screen owns the state).
- [ ] **Step 2:** `save-stage.tsx`: `kind === 'bio'` → `<GltfVignette src="/labs/memory-card/models/character.glb" fitHeight={2.3} yaw={0.7} spin={false} animation={CHARACTER_IDLE_CLIP} />` with `export const CHARACTER_IDLE_CLIP = 'Armature.F|bashful'` moved HERE (single definition; hero.tsx's copy dies in R7 — until then hero has its own, acceptable duplication for one task window). Canvas per kind: card kinds `envIntensity 0.35`, camera default, `shadowRadius 0.001` (card carries its own pool); bio `envIntensity 1.15`, `shadowRadius 1.5`. `fallbackGlyph` = save.accent's glyph name — pass through from a small `GLYPH_ORDER` lookup.
- [ ] **Step 3:** jsdom test: renders without provider; bio save mounts character src; project save mounts card; `flipped` prop forwarded. Run → green after implementation; `tsc`/`lint` green.
- [ ] **Step 4:** Commit `feat(labs/memory-card): single-object save stage (card + character)`.

### Task R3: The Save Select screen (strips, stat line, layout) — GATE A after this

**Files:**
- Create: `components/labs/memory-card/save-select/save-strips.tsx`, `save-select/stat-line.tsx`, `save-select/screen.tsx`
- Modify: `components/labs/memory-card/sections/chrome.tsx` (drop section anchors entirely; add fixed bottom footer strip: both attribution lines + `© {year}` + gallery/labs links, mono 10px `paperAlpha(0.42)`)
- Modify: `app/labs/memory-card/page.tsx` (mount `SaveSelectScreen`; remove the five section imports/renders; keep GalleryChrome/AudioProvider/GlyphCursor/metadata)
- Test: `__tests__/labs/memory-card/save-select/{save-strips,screen}.test.tsx`

**Interfaces:**
- Consumes: `buildSaves`, `SaveSlot`, `blocksUsed`, `CARD_BLOCKS_TOTAL` (R1); `SaveStage` (R2); `makeSaveIconFrames`/`saveIconPattern` (R1); `useMemoryCardAudioActions()` (`blip/select/back`); tokens/fonts.
- Produces: `SaveSelectScreen({ onLoad }: { onLoad?: (save: SaveSlot) => void })` — R4 wires `onLoad` to router.push / dialog state; default no-op keeps R3 shippable alone. `SaveStrips({ saves, activeIndex, onHighlight, onActivate })` with roving tabindex. `StatLine({ save, used, total, onLoad })`.

**Steps:**
- [ ] **Step 1 (failing tests first):** strips render 6 rows with slot numerals '01'–'06' and display-caps labels; ONLY the active strip has `tabIndex=0` (others −1); ArrowDown moves focus+highlight to next (wraps), ArrowUp previous; Enter calls `onActivate(save)`; strip click sets highlight, second click activates; stat line shows `blocks 9/15 used` and a LOAD button (`aria-label` names the active save); screen renders `SELECT FILE` heading exactly once (Anton); no `/lead/i` match anywhere in rendered screen; both attribution strings present (chrome footer). Hydration: `renderToStaticMarkup` identical for reduced/unreduced first paint.
- [ ] **Step 2:** Run tests → FAIL. Implement:
  - `save-strips.tsx`: `<ol role="listbox">`-free semantics — use a plain list of `<button role="option">`? NO: keep it simple and native — `<ol>` of `<li><button>` with roving tabindex + `aria-current="true"` on active; arrow handling on the list's `onKeyDown`. Strip anatomy per spec: ghost numeral (display font, `paperAlpha(0.25)`, ~clamp(2.5rem,6vw,4rem)), shimmer icon `<canvas>` (draw frames from `makeSaveIconFrames`, 480ms interval ONLY while strip is active AND not reduced; static frame 0 otherwise), label in display caps (Space Grotesk 700 caps, not Anton — Anton is reserved for SELECT FILE), mono `sub` line, `▮`-bar span (blocks count, accent color), hairline `borderBottom: 1px solid paperAlpha(0.16)`. Slots 04–06 render in a visually quieter compact group (smaller numeral scale 0.6em, tighter rows). Highlight: teal edge rule (`boxShadow inset 2px 0 0 MC.glyphs.triangle` equivalent via borderLeft) + numeral fills to `paperAlpha(0.8)`; call `blip()` on highlight change (pointer or keyboard) — inside the event handlers, never effects.
  - `stat-line.tsx`: mono row `▸ LOAD slot {slot} · blocks {used}/{total} used`; LOAD = real `<button data-cursor>` firing `onLoad`; `select()` sound inside the click handler.
  - `screen.tsx`: owns `activeIndex` + `flipped` state (stage `onTap` toggles `flipped` for card kinds; highlight change resets it); layout `h-[100svh] overflow-hidden` grid: chrome (fixed) / `lg:grid-cols-[minmax(0,44%)_1fr]` strips|stage / stat line; `<lg`: `flex-col` with `overflow-y-auto` (native, gentle), stage `h-[38svh]` first, strips after, stat line last. `SELECT FILE` in Anton at `TYPE.h2` scale. Sticker swap latency guard: highlight change updates stage `save` immediately (the stage animates its own nudge).
  - `page.tsx` also gains the spec's `<noscript>` block: name, role (Senior Frontend Engineer), one-line summary, email — plain HTML.
- [ ] **Step 3:** Full gates: `pnpm test:unit`, `tsc`, `lint` green. Visual: run `.superpowers/sdd/shot-page.mjs` (1440×900 + 390×844, plus `SHOT_STATIC=1` reduced pass) — verify with zoomed crops: strips typography reads editorial (numerals ghost, rules hairline), card centered with grounded shadow, no horizontal overflow, chrome footer attributions legible.
- [ ] **Step 4:** Commit `feat(labs/memory-card): save select screen — strips, stat line, ink console layout`.
- [ ] **Step 5 (orchestrator, not implementer):** screenshot set → USER → **GATE A verdict** before R4 dispatch.

### Task R4: Routing + project save panels

**Files:**
- Create: `app/labs/memory-card/layout.tsx`, `app/labs/memory-card/@panel/default.tsx`, `app/labs/memory-card/@panel/(.)save/[id]/page.tsx`, `app/labs/memory-card/save/[id]/page.tsx`
- Create: `components/labs/memory-card/panels/panel-shell.tsx`, `components/labs/memory-card/panels/save-panel.tsx`
- Modify: `components/labs/memory-card/lib/crt-screen.ts` (ticker lines param: `createCrtScreen(lines: string[] = DEFAULT_LINES)` — keep current 6 as default), `components/labs/memory-card/three/crt-vignette.tsx` (add `lines?: string[]`, thread through), `save-select/screen.tsx` (wire `onLoad`: project kinds → `router.push('/labs/memory-card/save/'+save.project.id)`)
- Test: `__tests__/labs/memory-card/save-select/save-panel.test.tsx`

**Interfaces:**
- Consumes: `projects` + `ExtendedProject` from `@/data/projects`; `PanelShell` produces `{ title, onClose, children }` focus-trapped paper shell; `SavePanel({ project, standalone }: { project: ExtendedProject; standalone?: boolean })`.
- Produces: routes. `layout.tsx` signature: `({ children, panel }: { children: ReactNode; panel: ReactNode })` returning `<>{children}{panel}</>` — metadata stays in `page.tsx`.

**Steps:**
- [ ] **Step 1:** Failing tests: SavePanel renders title, year, role, `longDescription`, metrics list with `›` ticks, technologies row, external link when `project.link` exists; contains NO `/lead/i`; PanelShell traps focus (Tab from last wraps to first — port the tested trap from the deleted XP `panel-shell` pattern if referenced, else hand-roll like sections had), Esc calls `onClose` and stops propagation.
- [ ] **Step 2:** Implement panels. `panel-shell.tsx`: paper field (`MC.paper`), printed keyline (sticker language: 1px `inkAlpha(0.16)` rounded rect inset), slot chip accent header, close button (`back()` sound), focus trap + return-focus, `role="dialog"` + `aria-modal` only in overlay mode. `save-panel.tsx`: save-data layout per spec; CRT head: `<VignetteCanvas …><CrtVignette lines={[project.title.toUpperCase(), `SAVED · ${project.year}`, …tech.slice(0,3), 'NOW PLAYING']} /></VignetteCanvas>` (6 lines max, all from project data).
- [ ] **Step 3:** Routes. `@panel/(.)save/[id]/page.tsx` (client wrapper): looks up project by `params.id` (`notFound()` if missing), renders `<PanelShell onClose={() => router.back()}><SavePanel project={p}/></PanelShell>` in a fixed inset overlay (`z-50`, ink scrim `inkAlpha(0.6)`). `save/[id]/page.tsx` (server): full paper page — chrome-less standalone with `SavePanel standalone` + a `← select file` link to `/labs/memory-card` + attribution footer; `generateStaticParams()` from `projects`; own `generateMetadata` (title = `${project.title} — Memory Card`). `@panel/default.tsx` → `return null`. `layout.tsx` renders both slots.
- [ ] **Step 4:** Wire `screen.tsx` `onLoad`. Gates green. LIVE verify on :3010 (implementer, headless ok): click LOAD → overlay over still-visible screen, browser back closes, hard-load `/labs/memory-card/save/amio-bank` → standalone page, unknown id → 404. `<lg` viewports: overlay renders as a full-screen sheet (inset-0, no scrim margin). Screenshot overlay (1440 + 390) + standalone.
- [ ] **Step 5:** Commit `feat(labs/memory-card): save panels via parallel + intercepting routes`.

### Task R5: System dialogs (bio / stack / contact)

**Files:**
- Create: `components/labs/memory-card/panels/bio-panel.tsx`, `panels/stack-panel.tsx`, `panels/contact-panel.tsx`
- Modify: `save-select/screen.tsx` (dialog state: `openDialog: SaveKind | null`; `onLoad` for kinds bio/stack/contact sets it; render the three dialogs SERVER-VISIBLE but hidden — mounted with `hidden` attribute when closed so content stays in the DOM for crawlers, shown as overlay when open)
- Test: `__tests__/labs/memory-card/save-select/system-panels.test.tsx`

**Interfaces:**
- Consumes: `PanelShell` (R4); bio copy ported VERBATIM from `sections/about.tsx` (read it; the two-column bio paragraphs — copy the exact strings); `WRITTEN_WITH` from `lib/written-with.ts`; contact rows + `copyText` clipboard helper + attribution lines ported from `sections/contact.tsx`.
- Produces: `BioPanel()`, `StackPanel()`, `ContactPanel()` — content-only components rendered inside `PanelShell` by the screen.

**Steps:**
- [ ] **Step 1:** Failing tests: bio panel contains the exact opening bio sentence (assert a verbatim substring copied from `sections/about.tsx` at implementation time); stack panel renders all 7 `WRITTEN_WITH` names + notes; contact panel styled as confirm dialog — heading `save your progress?`, the yes/no row (`yes` = mailto CTA, `no` = closes with `back()`), 3 copy rows with clipboard fallback behavior (port `copyText` + `copiedTimer` cleanup EXACTLY — it had a reviewed unmount-clear guard); character-agnostic scan: rendered output of all three panels contains no `/\b(she|her|hers)\b/i`.
- [ ] **Step 2:** Implement panels + screen dialog wiring (Esc closes per panel-shell; `back()` on close; opening fires `select()` — in the LOAD handler, already wired). Crawlability: the three dialogs render inside `<div hidden={openDialog !== kind}>` wrappers present in the server HTML.
- [ ] **Step 3:** Gates green. Live check: keyboard-only tour — arrows to slot 04, Enter opens bio, Esc closes, focus returns to strip 04. Zoom-crop screenshot each dialog at 1440 + 390.
- [ ] **Step 4:** Commit `feat(labs/memory-card): system dialogs — bio, written-with, contact confirm`.

### Task R6: Boot beat + real PS1 boot audio

**Files:**
- Create: `components/labs/memory-card/boot.tsx`
- Modify: `components/labs/memory-card/audio.ts` (delete `boot()` synth + `BOOT_FIFTH_HZ`; add `bootMusic(): boolean` — creates/reuses one `HTMLAudioElement('/labs/memory-card/sounds/ps1-boot.mp3')`, `volume 0.6`, returns false + no-ops when disabled/unarmed/file-missing (`onerror` latch); `dispose()` pauses it)
- Modify: `components/labs/memory-card/audio-context.tsx` (`MemoryCardAudioActions.boot` → `bootMusic`; keep name `boot` in the actions shape to minimize churn — it now plays the recording)
- Modify: `save-select/screen.tsx` (mount `<BootBeat/>` first)
- Modify: `components/labs/memory-card/sections/hero.tsx` (DELETE the boot-chime IO effect NOW — the misread-sound bug dies in this task even though the file itself dies in R7)
- Test: update `__tests__/labs/memory-card/audio.test.ts` (boot synth tests → bootMusic gating tests: disabled → false; enabled+armed → element.play called (mock `Audio`)); new `__tests__/labs/memory-card/save-select/boot.test.tsx`
- USER LANE (blocker for the sound only, not the task): `public/labs/memory-card/sounds/ps1-boot.mp3` — user drops the PS1 BIOS boot recording (e.g. from sounds.spriters-resource.com/playstation/systembios/) or approves the fetch in-session.

**Interfaces:**
- Produces: `BootBeat()` — self-contained: `sessionStorage['memory-card-booted']` guard, reduced-motion → render null immediately, otherwise full-viewport ink overlay ~1.5s (glyph diamond shimmer + `memory card` wordmark, tokens only), ANY keydown/pointerdown skips instantly, on mount fires `actions.boot()` (outcome-aware — plays only if armed+enabled), unmounts itself after.

**Steps:**
- [ ] **Step 1:** Failing tests: boot renders null when `sessionStorage['memory-card-booted']` set; sets it after completing; any keydown removes overlay immediately; reduced (mock matchMedia) → null; `bootMusic` gating table.
- [ ] **Step 2:** Implement. Timing via one `setTimeout` cleared on unmount/skip; overlay `role="presentation"` `aria-hidden`; the skip listeners on `window`, capture, removed on teardown (AbortController).
- [ ] **Step 3:** Gates green; live: first visit shows beat then screen; reload (same tab) skips; reduced pass never shows it. If mp3 present, sound-on visit after a gallery click plays it once — verify; if absent, console stays clean (no unhandled promise).
- [ ] **Step 4:** Commit `feat(labs/memory-card): boot beat + original PS1 boot audio (synth chime removed)`.

### Task R7: Teardown of the old layout + law-test migration — GATE B after this

**Files:**
- Delete: `components/labs/memory-card/sections/{hero,work,skills,about,contact}.tsx`, `three/card-rail.tsx`, `three/card-model.tsx`, `three/crt-model.tsx`, `three/voxel-character.tsx`, `lib/voxel-grid.ts`
- Delete/Migrate tests: every `__tests__/labs/memory-card/**` test importing a deleted module — port surviving LAW assertions (no `/lead/i`, attributions, character-agnostic, hydration) into the save-select suites FIRST, then delete old files. `lib/bitmap-font.ts`, `lib/crt-screen.ts` and their tests STAY (CRT head uses them).
- Modify: `components/labs/memory-card/tokens.ts` ONLY if dead exports remain (e.g. `SECTION_ACCENT` if now unreferenced — delete unused exports, keep used ones).

**Steps:**
- [ ] **Step 1:** `grep -r "sections/hero\|sections/work\|sections/skills\|sections/about\|sections/contact\|card-rail\|voxel" --include="*.ts*"` across repo — every hit must be a file on the delete list or fixed in this task. `CHARACTER_IDLE_CLIP`'s only definition must now be `three/save-stage.tsx`.
- [ ] **Step 2:** Migrate law tests, delete files, fix stragglers. Run FULL battery: `pnpm test:unit`, `tsc`, `lint` — green, zero skips.
- [ ] **Step 3:** Live full pass on :3010 (fresh session): boot → screen → arrows through all 6 → flip card → LOAD project → back → bio/stack/contact dialogs → sound toggle on → cursor moves blip. Console error-free incl. a fast wheel-storm (context-recovery still works — stage remount visible then recovered). Screenshot set: 1440, 390, reduced, overlay, standalone page.
- [ ] **Step 4:** Commit `refactor(labs/memory-card): delete section-scroll layout (save select is the lab)`.
- [ ] **Step 5 (orchestrator):** screenshots + Vercel-preview-grade walkthrough description → USER → **GATE B**.

### Task R8: E2E + battery + lookdev removal

**Files:**
- Create: `e2e/labs-memory-card.spec.ts` (REPLACE existing if present — check first)
- Delete: `app/labs/memory-card/lookdev/` + any lookdev-only scripts references
- Test: e2e spec itself

**Steps:**
- [ ] **Step 1:** E2E journeys (Playwright, coordinate `E2E_PORT=3010` with the running dev server per repo convention — check `playwright.config.ts` for how labs e2e boot): (1) keyboard-only: land (skip boot via sessionStorage seed or a keydown), ArrowDown×2, Enter → overlay visible, URL `/save/360dialog`, Esc → back on screen, focus restored; (2) deep link: goto `/labs/memory-card/save/amio-bank` → standalone page has title + `← select file` link; (3) mobile viewport 390×844: tap strip 01 twice → overlay; (4) reduced-motion: no boot overlay, strips static, LOAD still works; (5) a11y smoke: exactly one h1-equivalent (`SELECT FILE` region labelled), attribution text visible.
- [ ] **Step 2:** Delete lookdev; grep for references. Full battery + e2e green.
- [ ] **Step 3:** Commit `test(labs/memory-card): save-select e2e journeys; drop lookdev`.

### Task R9: Poster + museum sequencing check

**Files:**
- Modify: `public/labs/memory-card/poster.jpg` (regenerate: 1440×900 screenshot of the new screen, cropped/graded per existing poster pipeline in `scripts/posters/` — reuse `capture-memory-card.mjs` if present, else screenshot + sharp resize)
- Check (no blind edits): `lib/labs-manifest.ts` entry copy still accurate ("save-slot typography" stays true; update description if it references scrolling), `git log origin/main -- components/labs/museum/` for parallel museum changes (footsteps rider from old T13: if museum hall wiring changed on main, rebase/hold and report).

**Steps:**
- [ ] **Step 1:** Regenerate poster from the live screen (sound off, boot skipped, slot 01 highlighted). Zoom-crop check: strips legible at poster scale.
- [ ] **Step 2:** Manifest copy pass + museum sequencing check. Page `metadata.description` in `app/labs/memory-card/page.tsx`: update to save-select wording (drop "scroll" claims).
- [ ] **Step 3:** Battery green. Commit `chore(labs/memory-card): save-select poster + manifest copy`.

### Task R10: Final whole-branch review — GATE C → PR

**Steps:**
- [ ] **Step 1:** Fresh-eyes review agent over `git diff main...HEAD` scope: spec conformance checklist (every spec section → implementation), MINOR-findings triage from ledger, dead-code sweep (knip-style grep for unreferenced exports in the lab), a11y pass, hydration verification rerun.
- [ ] **Step 2:** Fix wave if needed; full battery + e2e green; worktree clean.
- [ ] **Step 3:** Push branch, open PR (analyze full commit history per git-workflow rules; test plan includes the e2e journeys + gate history). **USER plays the Vercel preview. Merge only on his word.**

## Verification Summary

Per task: unit + tsc + lint. Visual tasks (R3, R4, R5, R6, R7, R9): live :3010 screenshots at 1440×900 and 390×844 + reduced pass, claims verified on zoomed crops. Gates: A (screen look-dev, after R3), B (full experience, after R7), C (final review + Vercel preview, after R10). The user's verdict is the only pass criterion at gates.
