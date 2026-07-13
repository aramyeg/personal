# Storybook Lab — Art Call Sheet (D-G7)

The definitive interface document between the code and the art. Every asset key below
is copied **exactly** as the renderer requests it — grep any key against
`components/labs/storybook/book/*.tsx` if in doubt. Grouped by spread; a conventions
section up front covers everything that applies across every piece so the per-piece
rows can stay short.

Verified against the code on 2026-07-13 (worktree `labs-storybook`): every asset key
below was read out of `use-layer-texture.ts`, `popup-spread.tsx`, `popup-box-layer.tsx`,
`popup-platform-layer.tsx`, `popup-tabpiece-layer.tsx`, `popup-anatomy-layers.tsx`,
`popup-kinetic.ts`, `cover-decals.tsx`, `use-page-print.ts` and `spread-overlay.tsx`
directly, and every `dieFlipped` flag was computed by actually running the solver
(`components/labs/storybook/book/popup-spread.ts`'s `dieFlipped`), not eyeballed.

**Status count (2026-07-13):** ~42 of ~99 assets have real art (all of Chapter IV's
four hero pieces, the `page-1..9` full-bleed prints, both cover decals, and most
vfold/child heroes+riders in chapters I–III, V, VI). Everything volumetric — every
box face, every platform deck, both tabpiece faces, every dress patch, every rotor,
both kinetic pieces, the whole satchel/end spreads except `title-hero`, and all six
satchel-drawer icons — is still placeholder (procedural kraft/paper-grain fallback).

## 1. Conventions

### 1.1 Color, palette, light — read once, applies to every asset

- **Color space:** paint at normal sRGB/display-referred values — textures are loaded
  with `colorSpace = SRGBColorSpace` (`use-layer-texture.ts`), no gamma pre-correction
  needed.
- **Palette anchors** (`components/labs/storybook/storybook.css`): parchment cream
  `#E7D5A8`, warm sepia `#3B2A1A`, antique gold `#C9A227` — the locked style preamble
  below bakes these in. Per-chapter accent palettes (used in every prompt):

  | Ch | Accents |
  |---|---|
  | I — Inn | spring green `#6a8f5f`, terracotta `#b0603f`, dawn peach `#e8a978` |
  | II — Alps | alpine blue `#7d9bb5`, chalet timber `#8a5a3b`, honey gold `#d9a441` |
  | III — Rookery | slate `#5a6470`, raven black `#2b2d33`, dusk violet `#6f5a7d`, window amber `#d98e3f` |
  | IV — Dunes | dune gold `#d9a24a`, sunset coral `#d96f4a`, oasis teal `#4f8f85`, coin gold `#e6c65a` |
  | V — Bazaar | tuff rose `#c4766a`, awning red `#a63d2f`, awning cream, fruit tones |
  | VI — Treasury | pine `#2e5244`, aurora teal `#4fd6b8`, aurora violet `#8a6fd6`, night navy `#1d2a45` |
  | Title | gold `#c9a227`, spring green `#6a8f5f` |
  | Satchel | gold `#c9a227`, leather `#8a5a3b` |
  | End | seal burgundy `#641e26`, slate `#5a6470` |

  A piece whose neighbors on the same spread have real art but it doesn't (e.g. a box
  next to a painted v-fold hero) falls back to `paper-stock.ts`'s warm-kraft family
  (7 hue variants, ~20–48° hue, kraft/tan/amber/oat/cream) — new art should read as
  compatible with that family, not clash against it, for however long the piece stays
  mixed-media.
- **Key light** (`book/shadow-light.ts`): ONE lamp for the whole book, **up-screen-left**
  and high; every contact shadow the engine casts falls **down-screen-right**. The
  locked preamble's "flat matte lighting... copy stand" keeps painted shading mostly
  flat by design, but any directional cue drawn INTO a piece (a cast shadow under an
  eave, a lit vs. shadowed wall face) must agree with this direction — light from
  upper-left, shadow down-screen-right, on every piece, every spread.
- **No text or letters anywhere** — every word in the book is real HTML/canvas
  typography layered on top; text baked into art gets rejected.

### 1.2 Locked style preamble (verbatim — prepend to every image prompt)

> Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything
> is cut from matte construction paper and cardstock: visible paper grain, crisp
> die-cut edges, layered flat shapes with subtle soft shadows between paper layers.
> Whimsical storybook fairy-tale shapes, charming and warm, like a children's book
> made by a master paper artist. Muted earthy palette anchored on aged parchment
> cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene
> accents: {CHAPTER_ACCENTS}. Flat matte lighting as if photographed on a copy stand
> under soft warm light. No text or letters anywhere. No photorealism, no 3D-render
> look, no glossy digital gradients, no airbrush.

### 1.3 Locked hero description (verbatim — the SAME person in every appearance)

> the Hero: a small paper-cut figurine of a young man with short dark hair, warm
> friendly eyes and a slight smile, wearing a simple forest-green tunic with rolled
> sleeves, brown trousers and boots, a leather satchel across his chest, holding a
> faintly glowing golden quill

`ch4-hero` (already painted, approved, in the manifest) is the canonical reference
image — anchor every future hero-bearing generation on it.

### 1.4 Format & pipeline

Drop a transparent PNG named **exactly `<id>.png`** in `public/labs/storybook/art-src/`,
then run `node scripts/storybook/prepare-art.mjs`. It chroma-keys a magenta `#FF00FF`
fallback background (use it if transparency isn't possible), flood-fills a flat/white
uniform background as a last resort, trims every cutout to its drawn silhouette plus a
hairline cream die-cut rim, caps the long edge at 1536px, re-encodes to webp, and
rebuilds `art/manifest.json` — **art is invisible to the app until that manifest
rebuild runs.** Generate at 1536×1024 (wide pieces) or 1024×1024 (small figures/riders/
props); the pipeline trims to the drawn subject's own bounding box afterward, so only
the SUBJECT's own proportions need to match the "Aspect" column below, not the canvas.

### 1.5 Asset-key patterns by mechanism (what the code actually requests)

| Mechanism | Asset key(s) | Cutout |
|---|---|---|
| `vfold` (page-glued) | `<id>` | **ALPHA** silhouette; both panels share one painting, split at the crease |
| `child` | `<id>` | **ALPHA**; same convention, rides a parent's crease |
| `rider` | `<id>` | **ALPHA**; same convention, posed on a parent surface (box lid / bridge deck) |
| `dress` | `<id>` | **ALPHA**; front print + kraft-tinted back of the SAME cutout; may overhang its seat panel |
| `rotor` | `<id>` (no suffix — same as dress, not box) | **ALPHA**; circular die-cut in a square canvas |
| `stripflap` | `<id>` | **ALPHA**; standing frontal/profile figure, no visible connector |
| `kinetic` | `<id>` | **ALPHA**; two panels (arm + flap) share one painting |
| `fan` | `<id>-m<index>`, one per member (0-based) | **ALPHA**; each member is its own painting |
| `box` | `<id>-front`, `<id>-back`, `<id>-side`, `<id>-top` — **only the faces that geometry actually uses**, see each row | **OPAQUE** full-bleed rectangle, no transparency at all; `-side` paints the SAME image on BOTH side walls (not split/mirrored — paint it generically); `backbone` is always raw paper, never art |
| `platform` | `<id>-deck` | **OPAQUE** full-bleed rectangle; struts are always raw kraft, never art |
| `tabpiece` | `<id>-face` | **OPAQUE** full-bleed rectangle; one continuous unfolded print across every crease; the tab itself never prints art |
| cover decals | `cover-crest`, `cover-corner` (fixed, book-level) | **ALPHA**; corner is mirrored ×4 by the app from one asset |
| page prints | `page-<spread>`, spreads 1–9 (fixed, book-level) | **OPAQUE** full-bleed; one print per spread, split left/right by the app |
| satchel drawer icons | `item-<name>` (fixed; **HTML overlay**, not a WebGL layer — see §4) | **ALPHA** |

### 1.6 Orientation — v=1 is always the image TOP; which world edge that lands on depends on the mechanism's "Map":

- **STAND** (vfold, child, rider, stripflap, kinetic, fan members): the subject stands
  on the canvas's BOTTOM edge (v=0) — that edge glues to the page/parent crease. Image
  TOP (v=1) lands on the piece's free/far standing edge, up-screen. The piece folds
  along one vertical seam at its crease fraction (default center); draw a natural seam
  there (a corner, a peak, a spine) so the crease disappears into the art, continuous
  across it.
- **FACE** (box wall & cap patches): same rule as STAND, per patch — v=0 at the
  page-glued base, v=1 at the wall top. `-front`/`-back` split in half across their two
  patches; `-side` does NOT split — the full image paints both walls identically.
- **TOPDOWN** (box `-top`, platform `-deck`): a straight-down view, like a map. Image
  TOP (v=1) lands on the FAR edge (away from the reader, toward the spine's far side);
  image BOTTOM (v=0) lands on the NEAR edge (toward the reader). Splits at the deck
  crease (always center in the shipped book — every platform has `qA === qB`).
- **UNFOLD** (tabpiece `-face`): one continuous print across every crease of the
  erected structure. v runs from the INNER hinge (v=0, hidden low in the fold) to the
  TAB at the fore edge (v=1); band fractions are given per row. u runs across the
  piece's width, parallel to the spine.
- **DISC** (rotor): circular die-cut art in a square canvas, side = 2×radius.
  Rotationally near-symmetric designs (compass rose, sundial, astrolabe face) read
  best — the disc physically spins in place.
- **FLAT** (dress patches, cover decals): a rigid flat cutout riding one parent
  surface, may overhang its edges (the Sabuda recipe) — standard v=1-top orientation,
  no fold.

### 1.7 The die-flip rule — "PAINT ROTATED 180"

A handful of STAND-family pieces are children mounted high on a deep-V parent (or
hanging low with `vDir=-1`, pointing back toward the parent's own apex); their
rest-pose v-axis tips past vertical from the fixed reading camera, so the die is cut
and printed **rotated 180° from the normal STAND rule** — v=0 becomes the image's
TOP edge, v=1 the bottom. This is a real fabricator move (the paper is turned upside
down on the press before the final die-cut), decided per-piece by the physics
(`dieFlipped`), not a fixed rule from mount height or `vDir` alone — verified by
actually running the solver, not eyeballed:

**Rotated 180° (9 shipped pieces + 2 fan members):** `ch1-dormer`, `ch2-bee-c`,
`ch4-coins`, `ch5-lantern`, `ch5-lantern-b`, `ch6-door`, `ch6-banner`, `title-crest`,
`end-raven`, `satchel-burst-m0`, `satchel-burst-m1`.

Every other STAND piece prints upright, including `satchel-burst-m2` and **every
page-glued `vfold` layer without exception** (standing validity keeps a page-glued
crease up by construction — confirmed for all 33 vfold layers in the book).

---

## 2. Chapter I — The Inn of a Hundred Keys (spread 2)

| Layer id | Asset key(s) | Piece & story | Aspect (W:H) | Map | Status |
|---|---|---|---|---|---|
| `ch1-backdrop` | `ch1-backdrop` | Stone-built village beneath snow-capped twin peaks (Ararat echo) | ≈1.88:1 landscape | STAND | **art** |
| `ch1-inn` | `ch1-inn` | The chapter hero: a two-story coaching inn, many lit windows | ≈1.03:1 near-square | STAND | **art** |
| `ch1-inn-eaves` | `ch1-inn-eaves` | Dressed roofline: eaves overhanging the inn's left panel | ≈2.5:1 wide | FLAT | placeholder |
| `ch1-inn-lamp` | `ch1-inn-lamp` | Dressed hanging lamp bracket off the inn's right panel | ≈0.57:1 portrait | FLAT | placeholder |
| `ch1-dormer` | `ch1-dormer` | Attic dormer — the inn's own upper story, riding its fold | ≈1.07:1 near-square | STAND — **ROTATED 180** | **art** |
| `ch1-sign` | `ch1-sign` | Hanging key-sign: an oversized brass key on a shield board (now a freestanding v-fold, not a rider) | ≈0.77:1 portrait | STAND | **art** |
| `ch1-stable` | `ch1-stable-back`, `ch1-stable-side`, `ch1-stable-top` (no `-front` — `capFront:false`, open toward the reader) | Gabled open-front barn in the coaching yard: left wall, right wall, hollow interior, back wall as brace | side ≈1.0:1 · back ≈1.63:1 · top ≈1.91:1 | FACE / TOPDOWN | placeholder — **a legacy `ch1-stable.webp` (old single-strip design) sits on disk but is orphaned; the box renderer never requests it** |
| `ch1-stable-vane` | `ch1-stable-vane` | Dressed weathervane overhanging the stable's roof ridge | ≈0.58:1 portrait | FLAT | placeholder |
| `ch1-stable-hay` | `ch1-stable-hay` | Dressed hay bale against the stable's side wall | ≈1.75:1 wide | FLAT | placeholder |
| `ch1-yard` | `ch1-yard-deck` | Coaching-yard BRIDGE deck floating behind the inn, a rampart-terrace | ≈4.67:1 very wide strip | TOPDOWN | placeholder |
| `ch1-wall` | `ch1-wall` | Low dry-stone field wall at the very front edge, apple blossom + gate | ≈6.25:1 very wide fringe | STAND | **art** |

## 3. Chapter II — The Carrier Swarm (spread 3)

| Layer id | Asset key(s) | Piece & story | Aspect (W:H) | Map | Status |
|---|---|---|---|---|---|
| `ch2-backdrop` | `ch2-backdrop` | Alpine ridge panorama, chalets stepped down the slope | ≈1.76:1 landscape | STAND | **art** |
| `ch2-bee-a` | `ch2-bee-a` | Courier bee riding the ridge's fold, wings spread, parcel underneath | ≈1.88:1 landscape | STAND | **art** |
| `ch2-bee-b` | `ch2-bee-b` | Smaller courier bee, letter in its legs (re-homed to the balloon's fold in D5 — was invisible behind it) | ≈1.80:1 landscape | STAND — **ROTATED 180** | **art** |
| `ch2-hero` | `ch2-hero` | The hero's courier hot-air balloon, looking-glass in hand | ≈0.57:1 portrait | STAND | **art** |
| `ch2-bee-c` | `ch2-bee-c` | Smallest scout bee, riding the balloon's own fold | ≈2.17:1 wide | STAND — **ROTATED 180** | **art** |
| `ch2-hive` | `ch2-hive-front`, `ch2-hive-back`, `ch2-hive-side`, `ch2-hive-top` | Lidded beehive box in the meadow — real hives ARE stacked boxes | side ≈0.86:1 · front/back ≈1.29:1 · top ≈1.5:1 | FACE / TOPDOWN | placeholder |
| `ch2-hive-swarm` | `ch2-hive-swarm` | Dressed bee swarm hanging off the hive lid | ≈1.6:1 wide | FLAT | placeholder |
| `ch2-hive-flowers` | `ch2-hive-flowers` | Dressed flowers at the hive's base | ≈2.0:1 wide | FLAT | placeholder |
| `ch2-meadow` | `ch2-meadow-deck` | Alpine meadow TERRACE deck, stepping down toward the reader | ≈0.67:1 tall strip | TOPDOWN | placeholder |
| `ch2-fringe` | `ch2-fringe` | Painted meadow fringe at the very front edge | ≈5.45:1 very wide | STAND | placeholder |
| `ch2-windmill` | `ch2-windmill` | Windmill sail standing in the meadow, just downstage of the courier hero, sweeps to vertical as the book opens | combined ≈0.80:1 portrait-ish (arm dominates; see §1.6 caveat below) | STAND (kinetic) | placeholder — **moved from the deep-upstage park to a visible downstage lane (2026-07-13, in-flight composition pass); geometry above is current as of verification but may still be tuning — recheck `armLen`/`apexZ` before painting if this row looks stale** |

## 4. Chapter III — The Rookery of Four Billion Ravens (spread 4)

| Layer id | Asset key(s) | Piece & story | Aspect (W:H) | Map | Status |
|---|---|---|---|---|---|
| `ch3-towers` | `ch3-towers` | Tall grey citadel rank, rookery tower, spire, scattered amber windows | ≈1.79:1 landscape | STAND | **art** |
| `ch3-balcony` | `ch3-balcony` | Dispatch balcony jutting off the towers' fold, mid-height (the building's second story) | ≈0.83:1 near-square | STAND | **art** |
| `ch3-raven-a` | `ch3-raven-a` | Raven, wings spread, high on the towers' fold | ≈1.77:1 landscape | STAND | **art** |
| `ch3-rank` | `ch3-rank` | Second, lower tower rank — rooftops, chimneys, a gate-tower | ≈1.94:1 landscape | STAND | **art** |
| `ch3-raven-b` | `ch3-raven-b` | Small raven, folded wings, on the second rank's fold | ≈0.45:1 portrait | STAND | **art** |
| `ch3-counter` | `ch3-counter-front`, `ch3-counter-back`, `ch3-counter-side`, `ch3-counter-top` | Dispatch counter — lidded flat-top box, painted writing surface | side/front/back ≈1.6:1 · top ≈1.0:1 | FACE / TOPDOWN | placeholder — **legacy `ch3-counter.webp` (old single-strip design) is orphaned** |
| `ch3-perch-raven` | `ch3-perch-raven` | Raven standing ON the counter's lid (rider recursion) | ≈1.11:1 near-square | STAND | placeholder |
| `ch3-counter-ledgers` | `ch3-counter-ledgers` | Dressed stacked ledgers overhanging the counter lid | ≈1.2:1 near-square | FLAT | placeholder |
| `ch3-counter-scale` | `ch3-counter-scale` | Dressed weigh-scale on the counter's front cap | ≈0.9:1 near-square | FLAT | placeholder |
| `ch3-sorting` | `ch3-sorting-deck` | Parcel-sorting BRIDGE deck, tucked in toward the spine | ≈1.33:1 landscape | TOPDOWN | placeholder |
| `ch3-semaphore` | `ch3-semaphore` | Dispatch tower's semaphore arm, sweeps to vertical "raising the signal" | combined ≈0.92:1 near-square (see §1.6 caveat) | STAND (kinetic) | placeholder — **parked deep upstage, currently near-invisible; low priority until re-composed (see §5)** |

## 5. Chapter IV — The Vault-Dragon of the Golden Dunes (spread 5)

*The look-dev gate-zero spread — all four hero pieces are the approved reference art.*

| Layer id | Asset key(s) | Piece & story | Aspect (W:H) | Map | Status |
|---|---|---|---|---|---|
| `ch4-backdrop` | `ch4-backdrop` | Desert panorama at sunset, layered dunes, distant caravan | ≈2.57:1 landscape | STAND | **art** |
| `ch4-midground` | `ch4-midground` | Golden-domed desert city skyline strip | ≈4.04:1 very wide | STAND | **art** |
| `ch4-hero` | `ch4-hero` | THE MONEY SHOT: the hero bridling the coin-scaled dragon (canonical hero reference image) | ≈1.28:1 landscape | STAND | **art** |
| `ch4-coins` | `ch4-coins` | Gold coins spilling off the dragon's own fold | ≈1.0:1 square | STAND — **ROTATED 180** | **art** |
| `ch4-chest` | `ch4-chest-front`, `ch4-chest-back`, `ch4-chest-side` (**no `-top`** — `roof:'open'`, hollow, no lid) | Open treasure chest — hollow box, reading camera looks straight down into a raw-paper interior; only 3 exterior faces need art | side ≈1.0:1 · front/back ≈2.0:1 | FACE | placeholder |
| `ch4-chest-lid` | `ch4-chest-lid` | Dressed propped-open lid silhouette off the chest's side wall | ≈0.93:1 near-square | FLAT | placeholder |
| `ch4-chest-spill` | `ch4-chest-spill` | Dressed heaped gold on the chest's front cap | ≈1.33:1 landscape | FLAT | placeholder |
| `ch4-hoard` | `ch4-hoard-deck` | Gold-hoard BRIDGE deck, deep behind the dragon, cresting above the skyline | ≈4.2:1 very wide strip | TOPDOWN | placeholder |
| `ch4-goldpile` | `ch4-goldpile-face` | MOUND tab piece: loose gold rising as the spread blooms, tab creeps out the fore edge | u:v ≈0.54:1 (portrait unfolded strip) — bands: `slopeIn` v∈[0,0.5], `slopeOut` v∈[0.5,1] | UNFOLD | placeholder |
| `ch4-foreground` | `ch4-foreground` | Dune-crest fringe, desert grass, scattered coins, one cactus | ≈5.09:1 very wide | STAND | **art** |

## 6. Chapter V — The Bazaar of a Thousand Stalls (spread 6)

| Layer id | Asset key(s) | Piece & story | Aspect (W:H) | Map | Status |
|---|---|---|---|---|---|
| `ch5-city` | `ch5-city` | Rose-stone skyline, sun-warmed pink-tuff domes and arches | ≈2.36:1 landscape | STAND | **art** |
| `ch5-stalls` | `ch5-stalls` | Row of IDENTICAL master-pattern stall fronts — repetition made visible | ≈3.83:1 very wide | STAND | **art** |
| `ch5-arch` | `ch5-arch` | The master-pattern archway, hero chiseling a glowing pattern-stone | ≈1.0:1 square | STAND | **art — flagged low-res in the source research doc (trims to ~456px vs. peers at 1000+px); re-export recommended** |
| `ch5-arch-garland` | `ch5-arch-garland` | Dressed garland swagged high across the arch's right panel | ≈3.0:1 very wide | FLAT | placeholder |
| `ch5-arch-keystone` | `ch5-arch-keystone` | Dressed keystone medallion, high-center on the arch's left panel | ≈1.0:1 square | FLAT | placeholder |
| `ch5-lantern` | `ch5-lantern` | Hanging market lantern, glowing amber, riding the arch's fold | ≈0.58:1 portrait | STAND — **ROTATED 180** | **art** |
| `ch5-lantern-b` | `ch5-lantern-b` | Smaller sister lantern, higher on the arch's fold | ≈0.36:1 tall portrait | STAND — **ROTATED 180** | **art** |
| `ch5-stall` | `ch5-stall-back`, `ch5-stall-side`, `ch5-stall-top` (no `-front` — `capFront:false`, open toward the shopper) | Open-front market stall — left wall, right wall, canvas canopy | side ≈1.47:1 · back ≈1.6:1 · top ≈1.29:1 | FACE / TOPDOWN | placeholder — **legacy `ch5-awning.webp` (old parallel-tent design) is orphaned** |
| `ch5-stall-valance` | `ch5-stall-valance` | Dressed scalloped valance hanging off the canopy edge | ≈2.86:1 wide | FLAT | placeholder |
| `ch5-stall-crates` | `ch5-stall-crates` | Dressed stacked crates against the stall's side wall | ≈1.33:1 landscape | FLAT | placeholder |
| `ch5-goods` | `ch5-goods-deck` | Goods-table BRIDGE deck spanning the stall row, laid-out wares | ≈0.82:1 near-square | TOPDOWN | placeholder |
| `ch5-market-table` | `ch5-market-table-face` | TABLE tab piece: legs + level deck, erected by its own fore-edge tab | u:v ≈0.5:1 (portrait unfolded strip) — bands: `legIn` v∈[0,0.32], *deck* v∈[0.32,0.68], `legOut` v∈[0.68,1] | UNFOLD | placeholder |

## 7. Chapter VI — The Northern Treasury (spread 7)

*The book's largest hero (`ch6-treasury`, height 0.91) — leans right, real skew.*

| Layer id | Asset key(s) | Piece & story | Aspect (W:H) | Map | Status |
|---|---|---|---|---|---|
| `ch6-pines` | `ch6-pines` | Pine treeline under the aurora | ≈2.46:1 landscape | STAND | **art** |
| `ch6-treasury` | `ch6-treasury` | The chapter hero: multi-story glass treasury, leaning | ≈0.95:1 near-square | STAND | **art** |
| `ch6-treasury-spire` | `ch6-treasury-spire` | Dressed glass spire overhanging the roofline, off the left panel | ≈0.7:1 portrait | FLAT | placeholder |
| `ch6-treasury-vines` | `ch6-treasury-vines` | Dressed climbing vines low across the right panel | ≈1.67:1 landscape | FLAT | placeholder |
| `ch6-door` | `ch6-door` | Round vault door, low on the treasury's fold (ground story) | ≈1.0:1 square | STAND — **ROTATED 180** | **art** |
| `ch6-banner` | `ch6-banner` | Raised banner, high on the treasury's fold (top story) | ≈0.5:1 tall banner strip | STAND — **ROTATED 180** | **art** |
| `ch6-strongbox` | `ch6-strongbox-front`, `ch6-strongbox-back`, `ch6-strongbox-side`, `ch6-strongbox-top` | Banker's strongbox on the path to the vaults | side ≈1.09:1 · front/back ≈1.82:1 · top ≈1.67:1 | FACE / TOPDOWN | placeholder |
| `ch6-crest` | `ch6-crest` | Bank's griffin crest, standing ON the strongbox lid (rider recursion) | ≈1.13:1 near-square | STAND | placeholder |
| `ch6-strongbox-seal` | `ch6-strongbox-seal` | Dressed wax seal on the strongbox's front cap | ≈1.0:1 square | FLAT | placeholder |
| `ch6-strongbox-coins` | `ch6-strongbox-coins` | Dressed minted coins heaped at the strongbox's side-wall base | ≈2.0:1 wide | FLAT | placeholder |
| `ch6-steps` | `ch6-steps-deck` | Glass-gallery BRIDGE deck in the approach lane, crests near the treasury's shoulder | ≈3.11:1 very wide | TOPDOWN | placeholder |
| `ch6-fringe` | `ch6-fringe` | Low pine fringe at the very front edge | ≈5.2:1 very wide | STAND | **art** |

## 8. Title page (spread 1)

| Layer id | Asset key(s) | Piece & story | Aspect (W:H) | Map | Status |
|---|---|---|---|---|---|
| `title-border` | `title-border` | Illuminated vine border framing the title page | ≈2.6:1 landscape | STAND | placeholder |
| `title-hero` | `title-hero` | Small hero figurine waving, opening line ink | ≈0.60:1 portrait | STAND | **art** |
| `title-crest` | `title-crest` | Small crest riding the hero's own fold | ≈1.39:1 landscape | STAND — **ROTATED 180** | placeholder |
| `title-quill` | `title-quill` | The writer's quill, strip-erected at the fore edge — the tale being written as the book opens (the spread's D-G8 hero; strip-driven, no visible connector) | ≈0.92:1 near-square | STAND | placeholder |
| `title-swell` | `title-swell` | A low distant berm behind the border — ground-swell massing that fills the top of frame | ≈2.2:1 wide low | FLAT | placeholder |
| `title-swell-seal` | `title-swell-seal` | A wax-seal tuft standing on the berm's ridge | ≈1.29:1 landscape | STAND | placeholder |

## 9. The Hero's Satchel (spread 8) — the fan showcase

*Round 7d "palette law": spine pieces (bag, fan burst), an off-center gutter-bound
platform, and strip-erected frontal figures — deliberate mechanism variety, not a
monoculture.*

| Layer id | Asset key(s) | Piece & story | Aspect (W:H) | Map | Status |
|---|---|---|---|---|---|
| `satchel-bag` | `satchel-bag` | The satchel itself, bursting open toward the reader — grown into the spread's anchor mass so the items read as spilling FROM it | ≈1.67:1 landscape | STAND | placeholder |
| `satchel-astrolabe` | `satchel-astrolabe` | Wayfinder's Astrolabe, star-dial spinning on the bag's flap (rotor, riveted flat, coplanar) | 1:1 square (disc, radius 0.13 → canvas 0.26×0.26) | DISC | placeholder |
| `satchel-burst` | `satchel-burst-m0`, `satchel-burst-m1`, `satchel-burst-m2` | Golden fan of treasures bursting from the bag — 3 independent v-folds, one shared apex, blooming outward (inner ray short, outer rays long) | m0 ≈1.0:1 · m1 ≈1.18:1 · m2 ≈1.39:1 | STAND — **m0 and m1 ROTATED 180; m2 upright** | placeholder |
| `satchel-table` | `satchel-table-deck` | The map table: off-center, non-mirrored BRIDGE deck, standing on the right page | ≈1.05:1 near-square | TOPDOWN | placeholder |
| `satchel-scroll` | `satchel-scroll` | Dressed Router's Scroll, unrolled across the map table's deck | ≈0.56:1 portrait | FLAT | placeholder |
| `satchel-sword` | `satchel-sword` | The Ever-Sharp Sword — strip-erected standing figure, mid-left, no visible connector | ≈0.85:1 portrait | STAND | placeholder |
| `satchel-compass` | `satchel-compass` | The Wayfarer's Compass — strip-erected standing dial, front-right | ≈0.92:1 near-square | STAND | placeholder |

## 10. The End (spread 9)

| Layer id | Asset key(s) | Piece & story | Aspect (W:H) | Map | Status |
|---|---|---|---|---|---|
| `end-hills` | `end-hills-m0`, `end-hills-m1`, `end-hills-m2` | The far country the road bent through — a fan of 3 nested distant-hill ridges from one deep apex, receding front-to-back (the spread's D-G8 hero). Deep upstage z-band so it never crosses the letter | m0 ≈4.0:1 · m1 ≈4.6:1 · m2 ≈5.0:1 wide low | STAND — **m2 upright; m0/m1 per fold** | placeholder |
| `end-letter` | `end-letter` | Folded letter with a burgundy wax seal, closing the tale | ≈1.5:1 landscape | STAND | placeholder |
| `end-raven` | `end-raven` | Raven riding the letter's own fold — the raven the closing line asks the reader to send | ≈1.33:1 landscape | STAND — **ROTATED 180** | placeholder |
| `end-mound` | `end-mound` | The low mound the letter rests against — a fore-edge ground swell (parallel fold) grounding the scene | ≈2.4:1 wide low | FLAT | placeholder |
| `end-mound-tuft` | `end-mound-tuft` | A grass tuft standing on the mound's ridge | ≈1.14:1 landscape | STAND | placeholder |
| `end-seal` | `end-seal` | Hero's signet seal, heraldic rosette turning as the letter unfolds (rotor, coplanar, zero collision cost) | 1:1 square (disc, radius 0.13 → canvas 0.26×0.26) | DISC | placeholder |

## 11. Covers (spread 0, closed book — `book/cover-decals.tsx`)

Book-level assets, not tied to any `content.ts` layer.

| Asset key | Piece | Aspect (real, trimmed) | Cutout | Status |
|---|---|---|---|---|
| `cover-crest` | Central medallion: coiled dragon around an upright quill, gold foil, engraved filigree ring | 798×781 ≈1.02:1 square | ALPHA | **art** |
| `cover-corner` | L-shaped gold-foil filigree flourish; ONE asset, mirrored ×4 by the app into all four corners — paint it non-symmetric-looking only if you want the mirroring to be invisible, otherwise a rotationally-neutral flourish reads cleanest | 856×814 ≈1.05:1 square | ALPHA | **art** |
| *(title banner)* | "A Tale of Six Kingdoms" + subtitle | — | — | **not an art asset** — rendered live from a 2D canvas (Grenze Gotisch / Alegreya webfonts, gold gradient + emboss shadow), no image needed |

## 12. Page prints (`page-<spread>`, `book/use-page-print.ts`)

One full-bleed background print per spread, both pages side by side; the app splits
it left/right via a texture-offset transform. Book-level, spreads 1–9 (`SPREAD_COUNT`
= 10; spread 0 is the closed cover, no print).

| Asset key(s) | Recommended aspect | Cutout | Status |
|---|---|---|---|
| `page-1`, `page-2`, `page-3`, `page-4`, `page-5`, `page-6`, `page-7`, `page-8`, `page-9` | ≈1536×1024, ≈1.5:1 landscape (matches the procedural fallback's own canvas ratio) | **OPAQUE** full-bleed | **all 9 have real art already** |

## 13. Satchel-drawer icons (HTML overlay, non-WebGL — `satchel-items.ts` / `overlay/spread-overlay.tsx`)

A **separate art system** from the 3D satchel spread above: flat `<img>` icons in the
DOM overlay's "unpacked satchel" grid, gated by the same `art-manifest.json` but
rendered as plain HTML, not a paper-cutout WebGL layer. **No procedural placeholder —
the overlay renders nothing at all for an ungenerated icon** (unlike every WebGL
layer above, which always shows a kraft placeholder).

| Asset key | Item / skill | Status |
|---|---|---|
| `item-sword` | The Ever-Sharp Sword / React | placeholder (no icon shown) |
| `item-spellbook` | The Book of True Names / TypeScript | placeholder (no icon shown) |
| `item-scroll` | The Router's Scroll / Next.js | placeholder (no icon shown) |
| `item-potion` | The Bear's Draught / Zustand | placeholder (no icon shown) |
| `item-compass` | The Wayfarer's Compass / React Native | placeholder (no icon shown) |
| `item-shield` | The Tester's Shield / Jest | placeholder (no icon shown) |

Recommended: square-ish crop (1024×1024, per the original figurine sizing), alpha
silhouette, museum-label read at small size.

**Name collision to know about, not a bug:** `satchel-sword`/`item-sword`,
`satchel-compass`/`item-compass`, and `satchel-scroll`/`item-scroll` are the SAME
in-story object rendered in TWO different UI systems under DIFFERENT asset keys (the
3D pop-up spread's standing figure vs. the flat drawer icon) — both need art,
independently. `item-spellbook`, `item-potion`, and `item-shield` have **no 3D
counterpart at all** — those three skills (TypeScript, Zustand, Jest) exist only as
flat drawer icons, never as a paper mechanism.

---

## 14. Open questions (orchestrator call)

1. **Three legacy orphaned webps.** `ch1-stable.webp`, `ch3-counter.webp`, and
   `ch5-awning.webp` exist in `public/labs/storybook/art/` from the pre-box single-strip
   design (explicitly marked SUPERSEDED in
   `docs/superpowers/research/2026-07-10-storybook-art-prompts.md`) but the current box
   renderer never requests those bare ids — it wants `-front/-back/-side/-top` per §1.5.
   Delete the orphans, or keep them as a reference for painting the new per-face set?
2. **`-side` paints both walls identically.** Every box's two side walls show the exact
   same image, unmirrored, full-bleed (`popup-box-layer.tsx`'s `FACE_ART` maps both
   `wallL` and `wallR` to the SAME `side` asset with identity uvs — not a split pair
   like front/back/top). Confirmed intentional in the current code, but it means a side
   painting with strong asymmetric detail (a door on only one wall) will look wrong
   repeated on the opposite wall. Worth flagging to whoever paints `-side` assets: keep
   them generic enough to read correctly on either side.
3. **One of the two kinetic pieces is still parked off-stage.** `ch3-semaphore` sits
   in the deep upstage lane per content.ts's own comment ("zero D-G2 collision
   headroom... no gate-passing home in the visible near-spine region") — essentially
   invisible at the current composition, pending a re-composition pass. Low priority
   for art generation until that lands. `ch2-windmill` was moved to a visible
   downstage lane by a concurrent composition pass while this call sheet was being
   written (see its row in §3) — its geometry is current as of verification but this
   spread is actively being tuned; recheck before painting.
4. **`ch5-arch` is flagged low-res** in the source research doc even though it already
   has real art in the manifest (trims to ~456px vs. 1000+px peers) — worth a re-export
   pass rather than treating it as "done."
5. **Kinetic aspect guidance is approximate.** The arm and flap panels share the SAME
   v∈[0,1] range despite having different physical lengths (`armLen` ≠ `flapLen`), so
   there's no single "correct" combined aspect — §1.6/UNFOLD-style banding doesn't
   apply here. The recommendation in §2/§3 (`armW+flapW` : `armLen`) favors the
   dominant, visible arm; treat the flap portion as a secondary mount, not a
   proportion-critical area.
