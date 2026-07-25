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
| `knobtower` | `<id>-disc` (the twist knob) + `<id>-tier<k>`, one per tier (0-based) | disc is **ALPHA** circular die-cut in a square canvas (side = 2×`discR`), like a rotor; each `-tier<k>` is one **ALPHA** unfolded mound painting (both slopes share it, ridge across the middle) — see UNFOLD/MOUND in §1.6 |
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
- **DISC** (rotor, knob-tower `-disc`): circular die-cut art in a square canvas,
  side = 2×radius. Rotationally near-symmetric designs (compass rose, sundial,
  astrolabe face, a spoked winch/capstan knob) read best — the disc physically spins
  in place; give it a clear thumb-notch / grip cue so the reader reads it as twistable.
- **MOUND** (knob-tower `-tier<k>`): one continuous unfolded print per tier, painted
  like a tabpiece MOUND — v runs from the INNER hinge (v=0, hidden low in the fold)
  over the RIDGE/peak (v=0.5, across the middle of the canvas) to the FORE hinge
  (v=1, back down on the page); u runs across the tier's width, parallel to the spine
  (= `ridgeLen`). Both slope faces share the one painting, mirror-continuous across the
  ridge, so draw the peak detail centered. Canvas aspect W:H = `ridgeLen` : 2×`w`.
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

**Rotated 180° (7 shipped pieces + 2 fan members):** `ch2-bee-c`,
`ch4-coins`, `ch5-lantern`, `ch5-lantern-b`, `ch6-door`, `ch6-banner`, `title-crest`,
`satchel-burst-m0`, `satchel-burst-m1`. (`end-raven` is now a kinetic arm — upright,
like `ch2-windmill`; `ch1-dormer` moved to the phi-74 E3 inn ROW, no longer a
deep-V parent, and prints upright again alongside its new siblings `ch1-sign`
and `ch1-key`.)

Every other STAND piece prints upright, including `satchel-burst-m2` and **every
page-glued `vfold` layer without exception** (standing validity keeps a page-glued
crease up by construction — confirmed for all 33 vfold layers in the book).

---

## 2. Chapter I — The Inn of a Hundred Keys (spread 2)

| Layer id | Asset key(s) | Piece & story | Aspect (W:H) | Map | Status |
|---|---|---|---|---|---|
| `ch1-mountain` | `ch1-mountain` | STAGE PLANE A (rear, widest): the sleeping mountain — peach twilight sky bands, slate mass + snow crown, tiny far rooftops at the base, star pricks; torn-paper crest outline | ≈2.07:1 landscape (1.9:0.92) | STAND | **art** (procedural) |
| `ch1-inn-row` | `ch1-inn-row` | STAGE PLANE B (mid, THE HERO): full-span lamplit inn-row facades astride the gutter — central double-gable hall on the crease, timber wings, 9–11 gold windows, terracotta roofs, chimney + cut-paper smoke curl IN the outline, "100" shield over the door, painted lock escutcheon under the key rotor (right panel u 0.18, v 0.35) | ≈2.21:1 landscape (1.5:0.68) | STAND | **art** (procedural) |
| `ch1-dormer` | `ch1-dormer` | Attic dormer riding the inn row's crease — gabled, one gold window, terracotta cap | ≈1.14:1 near-square | STAND (upright on the phi-74 parent) | **art** (procedural) |
| `ch1-sign` | `ch1-sign` | Hanging key-sign riding the inn row's crease low (a child again, not a standalone v-fold): swinging bracket shield, three brass keys on a ring, walnut + gold | ≈0.88:1 portrait | STAND | **art** (procedural) |
| `ch1-key` | `ch1-key` | The great brass KEY rotor turning in the lock as the page opens — ornate key on a round walnut escutcheon disc, hub-riveted coplanar on the inn row's right panel (oriented disc art: side-aware UV flip) | 1:1 disc | FLAT (rotor disc) | **art** (procedural) |
| `ch1-gate` | `ch1-gate` | STAGE PLANE C (front, narrowest): the open gate — stone gateposts with lit lanterns + moth-glow halos, low swung-open timber gates at the outer edges, key-bunting swag as the outline's central dip (span low ≈v 0.45 so B's windows show through) | ≈1.81:1 landscape (0.76:0.42) | STAND | **art** (procedural) |
| `ch1-rank` | `ch1-rank` | The WELCOME RANK: innkeeper + lantern, spouse + enchanted ledger, waving child, dog — ONE die-cut linked chain (hands/bunting connect all silhouettes), strip-erected frontal in the courtyard | ≈1.62:1 (0.34:0.21) | STAND (stripflap) | **art** (procedural) |
| `ch1-keyboard` | `ch1-keyboard-board`, `ch1-keyboard-door1`, `ch1-keyboard-door2`, `ch1-keyboard-door3`, `ch1-keyboard-door4` | LIFT-THE-FLAP (the chapter's playable, G4): the inn's KEY-BOARD — a timber tavern plaque riveted flat into the right-page meadow with four numbered door leaves the reader lifts to reveal a hanging brass key behind each, save door 3 which hides the innkeeper's cat. `-board` = the plaque painted in the OPEN state (four dark recess niches, keys hanging, the cat curled in niche 3); `-door<N>` = one numbered timber door leaf (iron hinge straps at the spine edge, a ring handle at the lift edge, a brass `N` plate) | painted in SCREEN space (image-x = page-fore d, image-y = spine z): board PORTRAIT ≈0.49:1 (d 0.22 : z 0.45, row runs down) · doors LANDSCAPE ≈1.88:1 (d 0.16 : z 0.085, number upright) | FLAT (page-flat, screen-space uvs) | **art** (procedural) |
| `ch1-stable` | `ch1-stable-back`, `ch1-stable-side`, `ch1-stable-top` (no `-front` — `capFront:false`, open toward the reader) | The COACH HOUSE (E3 re-skin of the gabled open-front barn): mail-coach wheel + draw tongue leaning on the side wall, a lit lantern at the open front edge, loft opening on the back brace | side ≈1.0:1 · back ≈1.63:1 · top ≈1.91:1 | FACE / TOPDOWN | **art** (procedural) — a legacy `ch1-stable.webp` (old single-strip design) sits on disk but is orphaned; the box renderer never requests it |
| `ch1-stable-vane` | `ch1-stable-vane` | Dressed weathervane overhanging the stable's roof ridge | ≈0.58:1 portrait | FLAT | placeholder |
| `ch1-stable-hay` | `ch1-stable-hay` | Dressed hay bale against the stable's side wall | ≈1.75:1 wide | FLAT | placeholder |
| `ch1-wall` | `ch1-wall` | Fore-edge courtyard wall RE-CUT as the key-baluster frieze: key-shaped balusters as the die-cut top edge, painted villager-and-geese frieze band along the base | ≈6.25:1 very wide fringe | STAND | **art** (procedural) |

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

## 4. Chapter III — The Rookery of Four Billion Ravens · THE DISPATCH KEEP (spread 4)

The E1 PILOT SHOWPIECE (derivation `docs/superpowers/specs/2026-07-16-dispatch-keep-derivation.md`).
ONE grand structure replaces the old rookery crowd (`ch3-towers`/`ch3-rank`/`ch3-balcony`/
`ch3-counter`+dress/`ch3-sorting`/`ch3-towerworks`/`ch3-semaphore`/`ch3-perch-raven`/`ch3-raven-b`
all retired per the fate list): a four-story keep (`ch3-keep`, expanding to four stacked box
poses through the box renderer), a jutting gold balcony, the kept hero raven folded onto the
crown, an interactive tower-hoist winch (`ch3-keep-winch`), a flanking mound skyline
(`ch3-skyline-l` / `ch3-skyline-r`), and the kept fore wall (`ch3-fringe`). **E3 s4 (scenes/
s4-scene-pack.md)** turns that flanking rank into a RADIAL AMPHITHEATER: the six existing rows
are re-dressed as dovecote facades and become the ring's REAR stations, three NEW downstage rows
(`-mound3` on both pages, `-mound4` on the left) sweep the ring around to the reader's apron, and
a strip-erected gatehouse (`ch3-ring-tower`) stands where the painted post-road enters. The old wing-rank
stage-set flats are GONE: the citadel canyon is PAINTED aerial recession — stepped rooflines,
dusk-violet on the deepest — INTO the keep's own upper **back-wall faces** (`-back`), no separate
mechanism. Palette §1.1 Ch III (slate `#5a6470`, raven `#2b2d33`, dusk violet `#6f5a7d`, window
amber `#d98e3f`). The silhouette must read on kraft placeholders + shadow alone (the Sabuda
principle) before any of these land.

| Layer id | Asset key(s) | Piece & face | Aspect (W:H) | Map | Status |
|---|---|---|---|---|---|
| `ch3-keep` | `ch3-keep-hall-front` | Dispatch Hall FRONT — the keep's SOLID base facade (E1.5 re-mass; the master painting's big lower curtain wall): slate ashlar, the great arched dispatch gate, flanking amber lancets | ≈1.0:1 | FACE | placeholder |
| `ch3-keep` | `ch3-keep-hall-side` | Dispatch Hall side curtain wall — slate ashlar, three amber-lit lancet windows, raven-weathering (repeats both walls) | ≈1.0:1 | FACE | placeholder |
| `ch3-keep` | `ch3-keep-hall-back` | Hall back wall — the LOWEST painted aerial-recession band (near citadel rooftops), now braced (capBack) | ≈1.0:1 | FACE | placeholder |
| `ch3-keep` | `ch3-keep-hall-top` | Hall flat lid (the gallery floor) — slate flags from the high camera | ≈2.3:1 | TOPDOWN | placeholder |
| `ch3-keep` | `ch3-keep-gallery-side` | Balcony Gallery side — dusk-violet shadowed stone, corbels (both walls) | ≈1.0:1 | FACE | placeholder |
| `ch3-keep` | `ch3-keep-gallery-front` | Gallery front — painted arcaded loggia band (arched openings in deep warm shadow, amber glints; the E1.5 closed front that replaced the dead open-interior read) | ≈3.1:1 | FACE | placeholder |
| `ch3-keep` | `ch3-keep-gallery-back` | Gallery back wall — MID aerial-recession band (dusk-violet receding rooftops) | ≈1.0:1 | FACE | placeholder |
| `ch3-keep` | `ch3-keep-gallery-top` | Gallery flat lid (the loft floor) | ≈2.3:1 | TOPDOWN | placeholder |
| `ch3-keep` | `ch3-keep-loft-side` | Rookery Loft side — open belfry post-frame with die-cut arched roost-mouths, one amber-lit (genuinely see-through) | ≈1.06:1 | FACE (die-cut) | placeholder |
| `ch3-keep` | `ch3-keep-loft-front` | Loft front — arched roost belfry face, die-cut arch void | ≈1.06:1 | FACE (die-cut) | placeholder |
| `ch3-keep` | `ch3-keep-loft-back` | Loft back wall — DEEPEST aerial-recession band (dusk-violet, faintest rooftops) | ≈1.0:1 | FACE | placeholder |
| `ch3-keep` | `ch3-keep-loft-top` | Loft flat cap slab (seats the fan spire) | ≈2.3:1 | TOPDOWN | placeholder |
| `ch3-keep` | `ch3-keep-spire-m0` | Fan-spire flank member (Concept A M-fold, seated on the loft lid) — broad laid-back slate sail, split down the ridge crease | ≈0.9:1 | STAND (split) | placeholder |
| `ch3-keep` | `ch3-keep-spire-m1` | Fan-spire mid member — steeper slate sail, split down the ridge crease | ≈0.6:1 | STAND (split) | placeholder |
| `ch3-keep` | `ch3-keep-spire-m2` | Fan-spire PEAK member — steep narrow lead signal-spire, gold weathervane seam down the ridge; pierces above the old crown | ≈0.4:1 | STAND (split) | placeholder |
| `ch3-keep` | `ch3-keep-balcony` | The jutting gold dispatch-desk balcony deck from above — ink-pots, an open ledger, scattered quills, a wax-seal | ≈1.7:1 | TOPDOWN | placeholder |
| `ch3-keep` | `ch3-keep-raven` | The kept hero raven finial at the spire PEAK — wings spread, black die-cut silhouette (the retired ch3-raven-a, folded onto the spire's steepest member) | ≈1.5:1 | STAND (die-cut) | placeholder |
| `ch3-keep-winch` | `ch3-keep-winch-disc` | Spoked gold capstan crank knob — thumb-notch grip, engraved arrow-arc reading "HOIST" | 1:1 square | DISC | placeholder |
| `ch3-keep-winch` | `ch3-keep-winch-semaphore` | Gold signal paddle arm — the semaphore sweeping up to vertical | wide strip | STAND | placeholder |
| `ch3-keep-winch` | `ch3-keep-winch-iris` | One raven-shutter blade (repeats around the loft rim) — slate shutter, amber roost-glow behind | ≈0.5:1 | STAND | placeholder |
| `ch3-keep-winch` | `ch3-keep-winch-counterweight` | Slate counterweight block on a cable, dropping down the keep flank | ≈1:1 | STAND | placeholder |
| `ch3-skyline-l` | `ch3-skyline-l-mound0`, `ch3-skyline-l-mound1`, `ch3-skyline-l-mound2` | REAR RING STATIONS, left page (E3 s4 re-dress) — dovecote facades: regimented ranks of arched raven portals, 1-in-5 amber-lit, deep-cut crenellation, a linked raven rank cut into the parapet silhouette; coolest/dimmest of the ring, stepping back in Z | ≈3.0:1 / ≈3.5:1 / ≈3.2:1 | STAND (mound, shaped) | procedural |
| `ch3-skyline-l` | `ch3-skyline-l-mound3` | RING-MID left arm — the ring's tallest station: two-story dovecote terrace, the biggest portals and the most amber-lit windows, parapet raven rank facing spine-ward | ≈1.625:1 | STAND (mound, shaped) | procedural |
| `ch3-skyline-l` | `ch3-skyline-l-mound4` | RING-FRONT gate wall (left page only; the right front station is the dispatch desk) — low gate-wall, lantern posts, a raven pair, the post-road's shadow at its base | ≈1.9:1 | STAND (mound, shaped) | procedural |
| `ch3-skyline-r` | `ch3-skyline-r-mound0`, `ch3-skyline-r-mound1`, `ch3-skyline-r-mound2` | REAR RING STATIONS, right page (mirror rank, same dovecote grammar) | ≈3.2:1 / ≈3.0:1 / ≈3.5:1 | STAND (mound, shaped) | procedural |
| `ch3-skyline-r` | `ch3-skyline-r-mound3` | RING-MID right arm — the left arm's mirror (one drawing, flipped; own grain seed) | ≈1.625:1 | STAND (mound, shaped) | procedural |
| `ch3-ring-tower` | `ch3-ring-tower` | THE GATEHOUSE (E3 s4) — a slender strip-erected dovecote tower where the painted post-road enters the ring: stacked portal ranks, amber crown lantern, a raven atop; the right page's vertical accent, balancing the semaphore mast on the left | ≈0.6:1 | STAND (die-cut) | procedural |
| `ch3-fringe` | `ch3-fringe` | Fore-edge dispatch-yard wall — the rookery's outer yard wall in slate, a raven rank along its top, and the ROAD NOTCH where the post-road passes through | ≈7.1:1 low strip | FACE | procedural |
| `ch3-dispatch` | `ch3-dispatch-dial` | The reader-spun SORTING DESK dial (volvelle, riveted flat into the right-page yard, mirroring the winch) — a brass wheel of 8 sectors: raven sigils at staggered headings, route glyphs, a tally band | 1:1 square (disc, radius 0.11 → canvas 0.22×0.22) | DISC | procedural |
| `ch3-dispatch` | `ch3-dispatch-card` | The static WINDOW CARD over the dial — the sorting-office faceplate: pigeonhole shelves around 3 die-cut windows (top + two flanks at 45°) and the celebrated brass tag "① SPIN — ROUTE THE RAVENS" with a pointing manicule; the sectors show through the cut windows. RIGHT-PAGE V-FLIP applies — author in screen space | 1:1 square (disc, matches the dial) | DISC (windowed) | procedural |

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
| `ch4-dissolve` | `ch4-dissolve-dunes`, `ch4-dissolve-gold` | PULL-TAB DISSOLVE (Birmingham 92/93; the book's only paper CROSSFADE): a page-flat rack of 6 venetian SLATS on the LEFT-page open sand field (the mirror of the right-page goldpile tab). Pull the tab and rolling DUNES with a distant camel-train FLIP through the edge-on "blinds close" to the dragon's GOLD hoard — the two paintings share ONE composition (matching ridgelines, sun, and caravan station) so the flip reads as a transmutation. `-dunes` is the up-face at rest (tau=0), `-gold` the under-face revealed at tau=PI. Painted in SCREEN space (image-x = the page-fore axis d = the 6-slat stack; image-y = the spine axis z, SVG top = far sky, SVG bottom = near foreground), sliced into 6 vertical strips. | ≈1.18:1 each (d 0.52 : z 0.44) | SLAT-FLIP (screen-space) | **art** (procedural) |
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
| `ch6-coffer` | `ch6-coffer-board`, `ch6-coffer-door1` | LIFT-THE-FLAP (the spread's playable, G4): a TREASURE COFFER on the open right-page ground fore of the vault — the reader lifts a teal-steel strongbox lid and an aurora-lit gold hoard glows inside. Reuses the s2 liftflap family with ONE lid (a chest, not numbered doors). `-board` = the OPEN interior painted in the revealed state (aurora-lit minted-gold heap in the fore half, violet wax seal, dark teal-steel cavity); `-door1` = the closed teal-steel lid (gold reinforced corners, rivets, iron hinge straps at the spine edge, a bright gold HASP + keyhole at the fore/lift edge — the affordance) | painted in SCREEN space (image-x = page-fore d = screen-right, image-y = spine z = screen-down): board ≈1.2:1 (d 0.24 : z 0.20) · lid ≈1.05:1 near-square (d 0.19 : z 0.18) | FLAT (page-flat, screen-space uvs) | **art** (procedural) |
| `ch6-steps` | `ch6-steps-deck` | Glass-gallery BRIDGE deck in the approach lane, crests near the treasury's shoulder | ≈3.11:1 very wide | TOPDOWN | placeholder |
| `ch6-fringe` | `ch6-fringe` | Low pine fringe at the very front edge | ≈5.2:1 very wide | STAND | **art** |

## 8. Title page (spread 1)

| Layer id | Asset key(s) | Piece & story | Aspect (W:H) | Map | Status |
|---|---|---|---|---|---|
| `title-border` | `title-border` | E2.2 PROSCENIUM — the enlarged (1.3→1.55) + rebaked title banner-canopy: aged parchment, heavy walnut scroll-frame, gold rule, a burgundy cartouche behind the HTML title card, painted-in heraldic pennant bunting along the top rail, and a row of the six-kingdom heraldic shields across the cloth (the promise of the realms, carried IN the banner since a backdrop fan is occluded at the reading camera) | ≈2.58:1 landscape | STAND | placeholder |
| `title-hero` | `title-hero` | Small hero figurine waving, opening line ink | ≈0.60:1 portrait | STAND | **art** |
| `title-crest` | `title-crest` | Small crest riding the hero's own fold | ≈1.39:1 landscape | STAND — **ROTATED 180** | placeholder |
| `title-quill` | `title-quill` | The writer's quill, strip-erected at the fore edge — the tale being written as the book opens (the spread's D-G8 hero; strip-driven, no visible connector) | ≈0.92:1 near-square | STAND | placeholder |
| `title-swell` | `title-swell` | A low distant berm far upstage behind the crown — ground-swell massing | ≈2.2:1 wide low | FLAT | placeholder |
| `title-swell-seal` | `title-swell-seal` | A wax-seal tuft standing on the berm's ridge | ≈1.29:1 landscape | STAND | placeholder |

## 9. The Hero's Satchel (spread 8) — the fan showcase

*Round 7d "palette law": spine pieces (bag, fan burst), an off-center gutter-bound
platform, and strip-erected frontal figures — deliberate mechanism variety, not a
monoculture.*

| Layer id | Asset key(s) | Piece & story | Aspect (W:H) | Map | Status |
|---|---|---|---|---|---|
| `satchel-vista` | `satchel-vista-near`, `satchel-vista-mid`, `satchel-vista-rear` | DEPTH VISTA (E2.2 Batch B; bench derive-depthvista.mjs) — an ALL-WINGS graded tunnel-frame around the satchel hero: 3 page-rooted +z-FACING billboard FLAP pairs (ch3-skyline row form; NO arches, NO raw kraft), mirrored to both pages and graded in warmth + SCALE + depth (near = a satchel-scale reader-facing MASS, rear = a distant sliver). Each flap's shaped inner-top edge ARCS toward centre (u=0) so the six imply one receding vaulted aperture. `-near` = warmest, largest, saturated leather + gold keepsake TENTS + a waypost pennant, strong darks (front-flank); `-mid` = warm ochre, a winding ROAD + waypoints climbing back; `-rear` = pale/hazy cool dusk-violet six-KINGDOM spires + faint amber window glints (distant, atmospheric-perspective — the innermost visible depth). Three receding depths: FOREGROUND broad+short+dark, MIDGROUND taller, DISTANT tall+narrow+pale — each crest peeks over the one in front. Each shared by both mirrored flanks | near ≈1.6:1 (broad) · mid ≈0.94:1 · rear ≈0.5:1 (tall narrow) — width : height | MOUND — ALPHA die-cut, SHAPED mesh (u inner→outer, v base→crest) | placeholder (procedural) |
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
| `end-routes` | `end-routes-m0`, `end-routes-m1`, `end-routes-m2` | E2.2 EPILOGUE — a warm fan of postmarked ROUTE-CARDS fanning open behind the letter (the hero's correspondence, replacing the cold-green distant hills; the spread's D-G8 fan hero): overlapping cream cards with ruled address hands, franked postmark rings, wax dots, a dashed courier route. Deep upstage z-band so it never crosses the letter | m0 ≈2.0:1 · m1 ≈2.29:1 · m2 ≈2.53:1 | STAND — card fan | placeholder |
| `end-letter` | `end-letter` | Folded letter with a burgundy wax seal, grown into the clear centrepiece, closing the tale | ≈1.47:1 landscape | STAND | placeholder |
| `end-raven` | `end-raven` | E2.2 — the raven LARGER and LAUNCHING mid-flight on a 45° kinetic arm as the book opens ("the raven away"; was a small child on the letter fold). Body pitched up the ridge, wings thrown open | ≈0.62:1 portrait | STAND — kinetic arm, image top = up the ridge | placeholder |
| `end-seal` | `end-seal` | Hero's signet seal, heraldic rosette turning as the letter unfolds (rotor, coplanar, zero collision cost) | 1:1 square (disc, radius 0.13 → canvas 0.26×0.26) | DISC | placeholder |
| `end-keepsake` | `end-keepsake` | The reader's REMOVABLE keepsake — a wax-sealed ex-libris card of the six kingdoms, tucked in a right-endpaper sleeve; pull its dog-eared fore corner to draw it out and seat it on the desk (law H7/H8). Paint the whole die-cut card face; the loose-card grammar (rounded/notched corner, scored dogear, own drop shadow) must read against the flush tab pieces | ≈2.27:1 landscape (cardL 0.34 × cardW 0.15) | CARD — die-cut, ALPHA corners | placeholder |

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
3. **The ch3 semaphore is now a winch output.** The old `ch3-semaphore` kinetic arm was
   ABSORBED into the tower-hoist winch (E1 showpiece) — it is one of the three staggered
   outputs the crank drives, painted as `ch3-keep-winch-semaphore` (§4). `ch2-windmill`
   remains the book's standalone kinetic arm in its visible downstage lane (see §3) — its
   geometry is current as of verification; recheck before painting.
4. **`ch5-arch` is flagged low-res** in the source research doc even though it already
   has real art in the manifest (trims to ~456px vs. 1000+px peers) — worth a re-export
   pass rather than treating it as "done."
5. **Kinetic aspect guidance is approximate.** The arm and flap panels share the SAME
   v∈[0,1] range despite having different physical lengths (`armLen` ≠ `flapLen`), so
   there's no single "correct" combined aspect — §1.6/UNFOLD-style banding doesn't
   apply here. The recommendation in §2/§3 (`armW+flapW` : `armLen`) favors the
   dominant, visible arm; treat the flap portion as a secondary mount, not a
   proportion-critical area.
