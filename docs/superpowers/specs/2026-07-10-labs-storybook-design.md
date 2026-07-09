# Style Lab #5 — "Storybook" (`/labs/storybook`) — Design Spec

**Date:** 2026-07-10
**Status:** Approved direction (user: "the goal is to have a fairy-tale pop-up book experience,
it should be magical and shouldn't contain AI slop, the details matter. The story matters.")

## 1. Concept

The portfolio as a fantasy pop-up book. A burgundy, gold-tooled tome sits on a candlelit
dark-oak desk filling the viewport. It opens; each spread is one career chapter told in
fairy-tale narration, with layered paper-cutout scenes that physically fold up from the
page crease. Cover title: **"A Tale of Six Kingdoms"** — *being the true chronicle of one
frontend engineer's quest*. The lab title in the manifest is **"Storybook"** — a frontend
developer's portfolio that is literally a storybook.

Decisions locked during brainstorm:

| Decision | Choice |
|---|---|
| Navigation | Hybrid: scroll/swipe **and** click/keys both snap to the same animated page turn |
| Narration | Fairy-tale voice with real facts on an illuminated plaque per spread |
| Art | Layered transparent PNG cutouts per scene (backdrop / midground / hero / foreground) |
| Pages | Cover → title page → 6 chapters → Hero's Satchel (skills) → The End (contact) |
| Rendering | WebGL (react-three-fiber) book with real page-mesh curl; text stays real HTML |
| Quality bar | Awwwards-level page turn; design-craft bar applies; no AI slop |

## 2. Why WebGL (and how we avoid the PS1 failure mode)

The pop-up magic — a page that genuinely bends, cutouts that cast shadows on paper,
light raking across grain as the page angles — is only honest in 3D. The PS1 rejection
was about a navigable 3D *world* hiding content. This is a **fixed-camera object** with
linear, obvious navigation (next/previous page), real HTML text over the resting spread,
and a server-rendered plain-chapter fallback for crawlers / reduced-motion / no-WebGL.

## 3. Visual identity

### 3.1 Color tokens (CSS variables scoped to the lab root)

Primitive → semantic; all colors defined once in `components/labs/storybook/storybook.css`.

| Token | Hex | Use |
|---|---|---|
| `--sb-leather` | `#641e26` | cover/spine base burgundy |
| `--sb-leather-shadow` | `#4a151c` | cover shading, spine gutter |
| `--sb-leather-worn` | `#7b2a33` | edge wear highlights |
| `--sb-gold` | `#c9a227` | foil tooling, rules, plaque frames |
| `--sb-gold-bright` | `#e6c65a` | foil glint, drop-cap highlight |
| `--sb-gold-deep` | `#8f6f1a` | foil shadow |
| `--sb-paper` | `#e7d5a8` | page face (dark creamy yellow) |
| `--sb-paper-aged` | `#c9b078` | page edges, vignetted corners |
| `--sb-paper-deep` | `#b89c66` | crease shadow, under-layer paper |
| `--sb-ink` | `#3b2a1a` | all text (warm sepia, never black) |
| `--sb-desk` | `#17100b` | environment near-black |
| `--sb-candle` | `#ff9f4d` | warm glow accents (low alpha) |
| `--sb-seal` | `#7a1f2b` | wax seal |

Per-chapter accent palettes (used in scene art prompts and plaque flourishes):

| Ch | Kingdom | Accents |
|---|---|---|
| I | Yerevan village | spring green `#6a8f5f`, terracotta roofs `#b0603f`, dawn peach `#e8a978`, snow white |
| II | Alps | alpine blue `#7d9bb5`, chalet timber `#8a5a3b`, honey gold `#d9a441`, bee black |
| III | Berlin citadel | slate `#5a6470`, raven black `#2b2d33`, dusk violet `#6f5a7d`, window amber `#d98e3f` |
| IV | Golden dunes | dune gold `#d9a24a`, sunset coral `#d96f4a`, oasis teal `#4f8f85`, coin gold `#e6c65a` |
| V | Rose-stone bazaar | tuff rose `#c4766a`, awning red `#a63d2f`, awning cream, fruit tones |
| VI | Northern pines | pine `#2e5244`, aurora teal `#4fd6b8`, aurora violet `#8a6fd6`, night navy `#1d2a45` |

### 3.2 Typography (next/font/google, scoped to the lab)

- **Grenze Gotisch** — display: cover title, chapter titles, illuminated drop caps.
  Playful blackletter; the cartoon-fantasy-book register (Shrek storybook opening).
  Weights 500/700. Chapter titles ~clamp(28px, 4vw, 44px), tracking slightly tight.
- **Alegreya** — narration body. Literary book face; 400/500 + italic. ~17–19px/1.6,
  oldstyle numerals where available. Narration measures ≤ 34em.
- **Alegreya SC** — small-caps for fact-plaques, folio numbers, UI labels.
- Drop cap: oversized Grenze Gotisch initial (3-line height), gold foil gradient fill
  (`--sb-gold-deep → --sb-gold-bright`), hairline ink outline, small flourish ornament.

### 3.3 Paper & environment craft

- Page faces get a subtle procedural grain (tileable noise normal/roughness, generated
  by a committed script — no photo textures of unknown license).
- Deckled (lightly irregular) page edges; visible page-block thickness on the closed book.
- Environment: near-black desk, one warm key light with gentle flicker (candle), floating
  dust motes in the light cone (instanced points), CSS vignette overlay. The book is the
  only bright object — theatre lighting.

## 4. The book — page list & story

Spreads are numbered; each chapter's facts come from `data/experience.ts` by `id`
(single source of truth for company/role/period/highlights — the lab file holds only
the fantasy narration and scene config). Contact from `siteConfig`/`socialLinks` in
`lib/constants.ts`. Skills from `data/skills.ts`.

0. **Cover** (closed book): burgundy leather, gold corner flourishes, central dragon
   crest, title "A Tale of Six Kingdoms", subtitle "being the true chronicle of one
   frontend engineer's quest". A gold ribbon bookmark trails from the pages.
   CTA: "Open the book" (click/scroll/Enter).
1. **Title page**: illuminated vine border, title restated, "written & illustrated in
   paper · Aram Yeghiazaryan", small hero figurine waving. Ink line: "Once upon a time —
   which is to say, in the year two thousand and sixteen —".
2. **Chapter I — The Inn of a Hundred Keys** (`bluenet`, 2016–2018)
   Narration: "Once upon a time, in a stone-built city beneath a sleeping mountain,
   a young clerk of the merchant's guild grew tired of selling things and resolved
   instead to make them. He apprenticed himself to the code-wrights of BlueNet, and his
   first great labor was an enchanted ledger for the Inn of a Hundred Keys — a book that
   knew every guest, every room, and every candle lit therein. And the innkeepers
   marveled, for nothing was ever lost again."
   Scene: village beneath snow-capped twin peaks (Ararat), stone inn with many lit
   windows, apprentice holding an oversized brass key and a quill.
3. **Chapter II — The Carrier Swarm** (`flyerbee`, 2018–2019)
   Narration: "Word of the apprentice's craft crossed the mountains to the alpine city
   of Zürich, where the Guild of the Bee kept a thousand couriers aloft. 'Build us a
   looking-glass,' said the beekeepers, 'that we may see every wing at once.' So he built
   it from nothing at all — his first work made to be carried in a pocket — and from that
   day no parcel, however small, ever wandered from its path."
   Scene: alpine peaks, chalets on a pine slope, giant friendly parcel-bees, hero
   holding a living map with glowing routes.
4. **Chapter III — The Rookery of Four Billion Ravens** (`360dialog`, 2019–2021)
   Narration: "In the grey citadel of Berlin stood a rookery of unusual size. Four
   billion ravens passed through its towers, each bearing a message, and fifty thousand
   merchant houses trusted them with their words. The hero — for so we may now call
   him — was set over the great dispatch boards, and he wrought them so well that the
   sky itself seemed orderly."
   Scene: grey citadel skyline with a spire (TV-tower nod), rookery tower thick with
   ravens carrying scroll-letters, hero at a huge dispatch board.
5. **Chapter IV — The Vault-Dragon of the Golden Dunes** (`accenture`, 2021–2022)
   Narration: "Then came a summons from the golden dunes, where a great bank kept a
   dragon of renown coiled about its treasure. None doubted the beast's strength; the
   trouble was teaching it manners. The hero built passages of glass through which the
   people could reach their gold — safely, swiftly, and without waking so much as one
   scale — and he even taught the dragon to lease out carriages."
   Scene: sunset dunes, golden-domed city, hero calmly bridling a dragon whose scales
   are gold coins. **The money shot of the whole book.**
6. **Chapter V — The Bazaar of a Thousand Stalls** (`akna`, 2022–2023)
   Narration: "Homeward then, to the rose-stone city, where a bazaar of a thousand
   stalls was to be raised. The hero did not build the stalls. He did something
   cleverer: he carved master patterns from which any stall could be raised in a day,
   true and identical, by any pair of willing hands. Masons came from far away just to
   study the stones."
   Scene: pink-tuff arched bazaar, hero carving a glowing pattern-stone, identical
   stalls springing up in a row.
7. **Chapter VI — The Northern Treasury** (`xdatagroup`, 2023–present)
   Narration: "And so at last the road bent north, to a kingdom of pine and long light,
   where a new treasury was rising — AMIO by name — with walls of glass, so the people
   might always see their gold. There the hero works to this day: raising vaults,
   drawing plans with the founders themselves, and teaching young apprentices the old
   craft. Whether he lives happily ever after is not yet written — the best chronicles
   never quite end."
   Scene: pine forest under an aurora, glass-and-stone treasury, hero with two
   apprentices over unrolled plans. (Copy respects no-lead-title-claims: senior
   engineer + mentoring, never "leading".)
8. **The Hero's Satchel** (skills): "No knight sets out unarmed. Herein, the satchel,
   unpacked for the curious." Paper items laid out museum-style with small-caps labels
   drawn from `data/skills.ts`: a sword (React — 8 years, expert), a spellbook
   (TypeScript), potion bottles (Zustand / TanStack Query), a scroll (Next.js), a shield
   (testing/Jest), a compass (React Native). Hovering an item shows name + years +
   level on a small parchment tag. All 23 skills listed in the plain view.
9. **The End**: "Here ends — for now — the Tale of Six Kingdoms. Should you have need
   of the hero — a kingdom to raise, a dragon to gentle — send a raven." A folded
   letter with a burgundy wax seal (email), plus heraldic sigil links (GitHub,
   LinkedIn) from `socialLinks`. Back cover closes on a final click with the crest.

Every chapter spread carries an **illuminated fact-plaque** (right page, below
narration): company · real role · location · period in Alegreya SC, plus 2–3 real
highlights. Recruiter truth at a glance; the tale carries the charm.

## 5. Architecture

```
app/labs/storybook/page.tsx          server: metadata/OG, GalleryChrome,
                                     <StorybookLoader /> + <CrawlableTale />
components/labs/storybook/
  storybook-loader.tsx               'use client'; next/dynamic (ssr: false) → experience
  storybook-experience.tsx           orchestrator: capability gate, canvas + overlay
  store.ts                           zustand: spread index, turn state, sound, view mode
  content.ts                         chapters: narration, scene config, refs into data/
  assets-manifest.ts                 typed asset registry + procedural fallback flags
  crawlable-tale.tsx                 server-rendered full tale + facts; removes itself
                                     after hydration (CrawlableCv pattern from XP lab)
  plain-tale.tsx                     styled non-WebGL reading view (auto for
                                     reduced-motion / no-WebGL / ?view=plain)
  book/                              r3f internals
    book-scene.tsx                   canvas, camera, lights, desk, dust, book assembly
    book-cover.tsx                   leather covers, spine, page block, ribbon
    page-mesh.tsx                    segmented plane + curl deformation (useFrame)
    popup-layer.tsx                  hinged textured planes + fake contact shadows
    use-turn-machine.ts              drives turn progress from store intents
  overlay/
    spread-overlay.tsx               narration + drop cap + plaque, synced to rest pose
    nav.tsx                          corner hotspots, arrows, ribbon progress, folio
    quill-cursor.tsx                 custom cursor layer
    sound-toggle.tsx                 inkwell toggle (default muted)
  procedural/
    placeholder-art.ts               SVG paper-silhouette generator per scene layer
    paper-textures.ts                canvas-generated grain/normal maps
scripts/
  posters/storybook-poster.html      museum poster generator
  storybook/prepare-art.mjs          magenta chroma-key → trim → resize → webp
public/labs/storybook/
  poster.jpg                         museum painting (≤200 KB, ~3:4)
  art/*.webp                         processed cutouts (from the user's PNGs)
```

- **State:** Zustand (+Immer, repo pattern) holds *discrete* state only: `spread`,
  `turning: {dir} | null`, `soundOn`, `mode: 'book' | 'plain'`. Continuous turn
  progress lives in the r3f loop (refs), never in the store — no re-render per frame.
- **Store↔3D contract:** UI dispatches `requestTurn(dir)`; the turn machine owns
  progress 0→1, commits `spread` on completion, ignores/queues (max 1) input mid-turn.
- **Overlay sync:** camera is fixed; the resting right-page quad maps to a stable
  screen-space rect (calibrated constants per breakpoint). Overlay fades out during
  turns (first 15%), fades in on landing.
- **Lazy three.js:** all of `book/` behind `next/dynamic` — three.js must never enter
  the route's initial chunk (XP lab rule).

## 6. Motion grammar (the awwwards part)

- **Page turn (~1.1 s):** hovered corner pre-curls (magnetic peek, ~35 px lift);
  on commit the page mesh curls with a traveling cylindrical bend (radius tightens
  mid-flight), slight vertical lift, a soft shadow sweeping the page beneath;
  landing settles with a 2–3° paper overshoot. Custom ease: fast middle, soft land.
- **Pop-up choreography:** on landing, layers rise staggered 60–90 ms apart —
  backdrop (to 90°) → midground (78°) → hero (85°) → foreground (65°) — springs with
  slight overshoot, like stiff paper snapping open. On leaving, all fold flat within
  the first 40% of the turn.
- **Idle life:** layers sway ±1° on mouse parallax (spring-damped), candle flicker
  (perlin, subtle), dust motes drift, ribbon bookmark sways once on landing.
- **Cover open:** the front cover is a special heavy turn (~1.4 s, deeper shadow,
  slight camera dolly-in) — opening a real hardback.
- **Cursor:** quill cursor; tip dips toward hotspots; gold glint on interactive hover.
- **Sound (polish, default off):** paper flip, leather creak on cover, fireplace room
  tone. CC0 sources committed with attribution file. Inkwell toggle; respects the
  returning-session unlock lesson from the XP lab.
- **Input:** wheel/trackpad accumulate → threshold snaps to one turn; touch swipe;
  click corners/arrows; ←/→ keys; Home/End to cover/end. Esc belongs to GalleryChrome.

## 7. Responsive & fallback

- **Desktop / landscape:** full spread, text overlaid on the right page.
- **Portrait / narrow (≤ ~820 px):** camera frames a single page; the scene owns the
  page; narration + plaque render as an HTML parchment sheet below the canvas
  (55/45 split). Same turn animation. Single-tap corners advance
  (`pointer: coarse` single-tap lesson from XP).
- **Plain view** (`?view=plain`, auto on `prefers-reduced-motion`, WebGL-unavailable,
  or bots): a styled long-form reading page — same fonts/paper tokens, all narration,
  plaques, skills, contact — fully server-renderable and crawlable. `CrawlableTale`
  additionally ships sr-only full content on the book view (XP pattern).
- **A11y:** book canvas `aria-hidden`; the overlay text is real DOM in reading order;
  nav buttons are real buttons with labels ("Turn to Chapter IV"); focus management
  keeps keyboard users on the visible spread; `prefers-reduced-motion` never sees the
  3D book at all.

## 8. Art pipeline (user-generated via ChatGPT)

### 8.1 Anti-slop system

1. **One locked style preamble** on every prompt (§8.3) — same paper, light, palette.
2. **One locked hero description** reused verbatim in every scene featuring him
   (user may tune his look once in Batch 1, then it freezes).
3. Chapter accent palettes injected per prompt from §3.1.
4. **No text in images** — all lettering is real typography in the app.
5. Generate all layers of one scene in a single ChatGPT conversation; when a scene's
   first layer looks right, reference it: "same paper, same light, same palette".
6. Reject-and-regenerate is expected; the manifest gives per-asset "reject if" notes
   (e.g. glossy 3D-render look, airbrushed gradients, photoreal fibers).

### 8.2 Transparency reality check

ChatGPT's transparent-PNG output is unreliable (often flattened). Every prompt asks
for a transparent background AND carries a fallback line: *"If transparency is not
possible, place the isolated subject on a solid uniform pure magenta (#FF00FF)
background."* `scripts/storybook/prepare-art.mjs` (sharp) chroma-keys magenta,
trims, resizes, and emits webp. Paper cutouts have crisp die-cut edges — ideal for
keying. Backdrops need transparency only above their skyline silhouette.

### 8.3 Locked style preamble (prepended to every prompt)

> Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything
> is cut from matte construction paper and cardstock: visible paper grain, crisp
> die-cut edges, layered flat shapes with subtle soft shadows between paper layers.
> Whimsical storybook fairy-tale shapes, charming and warm, like a children's book
> made by a master paper artist. Muted earthy palette anchored on aged parchment
> cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene
> accents: {CHAPTER_ACCENTS}. Flat matte lighting as if photographed on a copy stand
> under soft warm light. No text or letters anywhere. No photorealism, no 3D-render
> look, no glossy digital gradients, no airbrush.

### 8.4 Locked hero description

> the Hero: a small paper-cut figurine of a young man with short dark hair, warm
> friendly eyes and a slight smile, wearing a simple forest-green tunic with rolled
> sleeves, brown trousers and boots, a leather satchel across his chest, holding a
> faintly glowing golden quill

### 8.5 Asset manifest (38 assets)

Sizes: backdrops/midgrounds/foregrounds **1536×1024**; figurines/ornaments/items
**1024×1024**. Files land in `public/labs/storybook/art-src/` (user drop), processed
to `art/*.webp`. Every asset has a procedural silhouette fallback so the book always
works.

**Batch 1 — look-dev gate zero (6 images):**

| ID | Subject (appended to preamble) |
|---|---|
| `cover-crest` | circular heraldic crest medallion of antique gold foil paper: a coiled dragon wrapped around an upright quill, engraved filigree ring border; isolated on transparent background |
| `cover-corner` | single ornate gold-foil filigree corner flourish for a book cover, L-shaped, curling vine ends; isolated on transparent background (mirrored ×4 in app) |
| `ch4-backdrop` | wide desert panorama at sunset: rolling paper dunes in layered strips, coral-to-gold sky, distant caravan silhouette; decorative torn-paper skyline top edge, transparent above |
| `ch4-midground` | skyline strip of a golden-domed desert city: onion domes, minaret towers, arched gates, tiny warm windows; isolated strip, transparent background |
| `ch4-hero` | {HERO} calmly holding the rein of a large friendly dragon whose overlapping scales are gold coins, the dragon lowering its head to him, wings half-folded; isolated group, transparent background |
| `ch4-foreground` | foreground fringe strip: a dune crest with desert grass tufts, a few scattered gold coins and one small cactus; isolated strip, transparent background |

**Batch 2 (32 images):** same four-layer structure for chapters I, II, III, V, VI
(20); title-page vine border + waving hero (2); satchel + 6 item cutouts (7);
wax-sealed letter, raven-with-letter, back-cover small crest (3). Full per-asset
prompts generated from the same template; delivered as a paste-ready list after the
look-dev gate locks the style.

### 8.6 Look-dev gate zero (hard gate, user-approved)

Build order stops after: environment + closed cover + typography sample + Chapter IV
spread assembled from Batch 1 art. Screenshots go to the user. **No further spreads
are built until the user approves the look.** (design-craft-bar rule.)

## 9. Performance budget

- Initial route JS (excl. lazy three chunk) ≤ 250 KB gz; three chunk loads behind the
  cover while the reader reads the title.
- Textures: ≤ 600 KB webp per spread; only current ± 1 spread resident; others evicted.
- DPR capped at 2; shadows: one 1024 map or fake contact shadows on low tier.
- 60 fps turns on a mid laptop; automatic low-tier (no shadow map, no dust) via
  `navigator.hardwareConcurrency`/`deviceMemory` heuristic + first-frame timing probe.

## 10. Testing

- **Unit (jsdom):** store/turn machine (bounds, mid-turn locking, queued input, wheel
  accumulation threshold); content integrity (every `experiences[].id` has exactly one
  chapter; plaque fields come from `data/`; all 23 skills present in satchel data);
  asset manifest ↔ files consistency; plain-view render contains all six companies.
- **e2e (Playwright):** book loads and cover opens; ArrowRight advances folio; plain
  view lists all companies + contact links; `prefers-reduced-motion` gets plain view;
  Esc returns to /labs (dispatch on `document.body` — snowpark lesson); mobile viewport
  single-tap corner advances; no console errors.
- **Milestone Chrome playtests** by the orchestrator between phases (snowpark
  gate pattern) with screenshots against the craft bar.

## 11. Integration checklist

- `lib/labs-manifest.ts`: `{ slug: 'storybook', title: 'Storybook', date: '2026-07-10',
  thesis: 'The portfolio as a fantasy pop-up book — six kingdoms, one hero, paper
  dragons; every page turn a small theatre.', status: 'live' }`
- Poster `public/labs/storybook/poster.jpg` (~3:4, ≤200 KB) + generator in
  `scripts/posters/` — museum painting + list thumbnail.
- OG metadata on the route (poster as OG image) for the LinkedIn unfurl.
- Page wrapped in `<GalleryChrome>`; lab does not consume Esc.
- Work happens in an isolated worktree; PR to main when done.

## 12. Milestones

1. **M0 scaffold:** worktree, route, manifest entry, tokens/fonts, plain view (ships
   value even artless), crawlable tale.
2. **M1 stage:** environment + closed book + cover typography (procedural leather/
   paper). *Internal screenshot gate.*
3. **M2 mechanics:** page turn deformation, turn machine, input (wheel/touch/keys/
   corners), overlay sync. *Internal gate: the turn must already feel great with
   blank pages.*
4. **M3 look-dev gate zero:** Batch-1 art integrated into cover + Chapter IV pop-up.
   **USER GATE — approve or iterate.**
5. **M4 content:** all spreads with procedural placeholders, satchel, The End,
   plaques, folio/ribbon nav.
6. **M5 art & polish:** Batch-2 integration as delivered, cursor, dust, sound,
   low-tier path, poster, OG.
7. **M6 ship:** tests green, code review, verify pass, PR.
