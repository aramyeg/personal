# Storybook Art Prompts — ChatGPT Image Call Sheet

Paste-ready ChatGPT image prompts for all 38 art assets of the `/labs/storybook`
pop-up book lab (spec: `docs/superpowers/specs/2026-07-10-labs-storybook-design.md`,
asset manifest §8.5). Every prompt below is complete on its own — no "similar to
above" shortcuts — so any asset can be regenerated independently.

## How to use this sheet

1. **Paste one whole prompt block per ChatGPT image request.** Each `## <id>`
   section below is one complete, self-contained prompt (style preamble + subject
   + transparency ask + magenta fallback + reject criteria) — copy the full fenced
   block, nothing more needed.
2. **Batch by what must stay consistent — see "Generation order" below.** The
   two consistency axes: the HERO must be the same person in every chapter
   (generate all hero-bearing pieces in ONE conversation, anchored on the
   approved `ch4-hero` as a reference image), and each chapter's scenery +
   its riders must share paper grain, light, and palette (one short
   conversation per chapter). If a later image starts drifting, remind the
   model: "same paper, same light, same palette as the previous image."
3. **If a result comes back with a filled (non-transparent) background** instead
   of a transparent PNG, re-run the *same* prompt but explicitly repeat/emphasize
   the magenta fallback line at the end of your message — e.g. "place the subject
   on a solid, uniform, pure magenta #FF00FF background, no gradient, nothing else
   in frame." `scripts/storybook/prepare-art.mjs` chroma-keys that magenta back out.
4. **Drop finished PNGs into `public/labs/storybook/art-src/`**, named *exactly*
   `<id>.png` (e.g. `ch4-hero.png`, `cover-crest.png` — ids match the `##`
   headings below one-to-one).
5. **Run the prep script**: `node scripts/storybook/prepare-art.mjs`. It
   chroma-keys any magenta fallback backgrounds, de-fringes the magenta cast off
   semi-transparent edges, trims dead space (EVERY cutout trims now, backdrops
   included — the fold physics glues each texture edge-to-edge onto its panel),
   resizes to fit within 1536px, emits `public/labs/storybook/art/<id>.webp`,
   and rebuilds `art/manifest.json` (the runtime only requests art listed
   there — skip this step and new art stays invisible).

## Generation order — consistency sessions (v3)

Batch 1 (cover crest/corner + the four ch4 pieces) is approved and
benchmark-verified — do NOT regenerate it. Better: `ch4-hero` is now the
canonical CHARACTER REFERENCE for every other hero appearance.

Each bullet below = one ChatGPT conversation window. Within a session,
generate in the listed order; re-anchor with the reference image whenever a
result drifts.

1. **`page-5` alone, first.** One asset, zero dependencies, validates the
   whole page-print system against the ch4 art already in the app.
2. **Hero session A** — open with the approved `ch4-hero` image uploaded:
   "This is the canonical hero figurine from this book; keep his face,
   hair, green tunic, satchel and golden quill identical in everything
   that follows." Then: `title-hero` → `ch1-inn` → `ch1-sign` →
   `ch1-dormer` → `ch2-hero` → `ch3-counter`. (The sign and dormer ride
   the inn's fold — making them right after the inn keeps the wood/brass/
   roof language matched.)
3. **Hero session B** — new window, re-upload `ch4-hero` AND the fresh
   `title-hero` as anchors: `ch5-arch` → `ch5-lantern` → `ch5-lantern-b` →
   `ch6-treasury` → `ch6-door` → `ch6-banner` → `ch4-coins` (show
   `ch4-hero` again for the coin gold). Splitting the hero work into two
   windows keeps threads short enough that the character doesn't drift by
   the tenth image.
4. **One short scenery window per chapter** — parent pieces and their
   riders together so a raven matches its tower, a bee its ridge, and a
   stall row its city:
   - ch1: `ch1-backdrop` → `ch1-stable` → `ch1-wall`
   - ch2: `ch2-backdrop` → `ch2-bee-a` → `ch2-bee-b` → `ch2-bee-c`
   - ch3: `ch3-towers` → `ch3-balcony` → `ch3-raven-a` → `ch3-rank` → `ch3-raven-b`
   - ch5: `ch5-city` → `ch5-stalls` → `ch5-awning`
   - ch6: `ch6-pines` → `ch6-fringe`
5. **Endpapers window** — upload `cover-crest` as the gold-foil reference:
   `title-border` → `title-crest` → `end-letter` → `end-raven` → `back-crest`.
6. **Satchel window** — upload `ch4-hero` so the bag matches the one he
   wears: `satchel-bag` → the six `item-*` prompts.
7. **Remaining page prints** — one window for `page-1..4, 6..9` (the
   quiet printed-parchment register must stay uniform across all pages;
   palettes shift per chapter, treatment must not).

After each session: drop PNGs in `art-src/`, run the prep script, look at
the live spread, and only then move on — catching a drift after one
session is cheap, after five it's a redo.

## Locked style preamble (spec §8.3 — verbatim, prepended to every prompt below)

> Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything
> is cut from matte construction paper and cardstock: visible paper grain, crisp
> die-cut edges, layered flat shapes with subtle soft shadows between paper layers.
> Whimsical storybook fairy-tale shapes, charming and warm, like a children's book
> made by a master paper artist. Muted earthy palette anchored on aged parchment
> cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene
> accents: {CHAPTER_ACCENTS}. Flat matte lighting as if photographed on a copy stand
> under soft warm light. No text or letters anywhere. No photorealism, no 3D-render
> look, no glossy digital gradients, no airbrush.

`{CHAPTER_ACCENTS}` is filled per asset below from the chapter's accent palette
(spec §3.1). Kept identical letter-for-letter otherwise across every prompt so the
paper stock, light, and rendering register never drift between assets.

## Locked hero description (spec §8.4 — verbatim, embedded in every hero-bearing prompt)

> the Hero: a small paper-cut figurine of a young man with short dark hair, warm
> friendly eyes and a slight smile, wearing a simple forest-green tunic with rolled
> sleeves, brown trousers and boots, a leather satchel across his chest, holding a
> faintly glowing golden quill

Reused word-for-word everywhere `{HERO}` appears below (the user may tune his
look once against Batch 1, then it freezes for the rest of the book — spec §8.1).

## Transparency + reject conventions (appended to every prompt below)

Every single prompt ends with these two lines, verbatim:

>. Isolated on a fully transparent background (transparent PNG, no background fill).
> If transparency is not possible: place the isolated subject on a solid uniform
> pure magenta #FF00FF background that touches nothing else.

And a quality gate:

> Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or
> any text/letters appear anywhere in the image.

**Flat white/solid backgrounds are salvageable — don't regenerate for that
alone.** The prep pipeline flood-keys any uniform background connected to
the image border (Batch-2 experience: many outputs ignored both the
transparency ask and the magenta fallback and landed on flat white).
Interior whites — glowing windows, snow — survive, since only
border-connected background is removed. Full-bleed strips and page prints
are exempt (their varied edge colors fail the uniformity vote).

## Sizes

Backdrops, midgrounds, and foregrounds render **1536×1024**; figurines,
ornaments, and items render **1024×1024** (spec §8.5).

---

# Batch 1 — look-dev gate zero (6 assets)

Cover crest + corner, and all four layers of Chapter IV (the money-shot spread —
spec §8.6). Generate and approve this batch first; it locks the style for
everything in Batch 2.

## cover-crest — 1024×1024

*Cover — central medallion*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: leather burgundy #641e26, antique gold #c9a227. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. circular heraldic crest medallion of antique gold foil paper: a coiled dragon wrapped around an upright quill, engraved filigree ring border; isolated on transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## cover-corner — 1024×1024

*Cover — corner flourish (mirrored ×4 in app)*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: leather burgundy #641e26, antique gold #c9a227. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. single ornate gold-foil filigree corner flourish for a book cover, L-shaped, curling vine ends. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch4-backdrop — 1536×1024

*Chapter IV — The Vault-Dragon of the Golden Dunes — backdrop layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: dune gold #d9a24a, sunset coral #d96f4a, oasis teal #4f8f85, coin gold #e6c65a. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. wide desert panorama at sunset: rolling paper dunes in layered strips, coral-to-gold sky, distant caravan silhouette; decorative torn-paper skyline top edge, transparent above. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch4-midground — 1536×1024

*Chapter IV — The Vault-Dragon of the Golden Dunes — midground layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: dune gold #d9a24a, sunset coral #d96f4a, oasis teal #4f8f85, coin gold #e6c65a. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. skyline strip of a golden-domed desert city: onion domes, minaret towers, arched gates, tiny warm windows; isolated strip, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch4-hero — 1024×1024

*Chapter IV — The Vault-Dragon of the Golden Dunes — hero layer (the money shot)*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: dune gold #d9a24a, sunset coral #d96f4a, oasis teal #4f8f85, coin gold #e6c65a. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. the Hero: a small paper-cut figurine of a young man with short dark hair, warm friendly eyes and a slight smile, wearing a simple forest-green tunic with rolled sleeves, brown trousers and boots, a leather satchel across his chest, holding a faintly glowing golden quill — standing calmly, holding the rein of a large friendly dragon whose overlapping scales are gold coins, the dragon lowering its head to him, wings half-folded; isolated group, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch4-foreground — 1536×1024

*Chapter IV — The Vault-Dragon of the Golden Dunes — foreground layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: dune gold #d9a24a, sunset coral #d96f4a, oasis teal #4f8f85, coin gold #e6c65a. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. foreground fringe strip: a dune crest with desert grass tufts, a few scattered gold coins and one small cactus; isolated strip, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

---

# Batch 2 — remaining spreads (v3, variation phase)

**v3 addendum — fold-aware die-cuts (read before generating).** The engine now
poses three mechanism families, and each piece's art must be drawn around its
fold line:

- **Standing cutouts (v-folds).** The subject must sit ON the bottom edge of
  the canvas — that edge is glued to the page. The piece folds along ONE
  vertical line at the percentage given per asset below ("fold at N% from
  left"); place a natural seam there (a tower edge, a peak, the dragon's
  spine) so the crease disappears into the drawing. The artwork continues
  seamlessly across the fold. Some pieces LEAN in the book (asymmetric
  fold) — draw the subject upright; the lean comes from the paper, not the
  art.
- **Tents (parallel folds).** The strip is glued along BOTH long edges and
  ridges along the line given per asset ("ridge at N% from left"); the left
  portion of the canvas becomes the left slope, the rest the right slope.
  Draw it like a printed strip seen flat — the fold gives it the pitch.
- **Riders (children).** Small standalone cutouts glued onto a bigger
  piece's fold — a raven on the rookery, coins off the dragon. Center fold
  unless stated. Keep silhouettes bold and readable at small size; they
  render about a fifth the size of a hero piece.
- Backdrops are trimmed tight and creased like everything else now — no
  dead margin, and the panorama needs a believable vertical seam at its
  fold percentage.
- After a batch lands, run `node scripts/storybook/prepare-art.mjs` (it also
  rebuilds the art manifest); world sizes are then re-derived from the
  trimmed aspect ratios exactly as Chapter IV's were, and the fold
  percentages here must stay in sync with `creaseU` in content.ts.

**Chapter I — The Inn of a Hundred Keys** *(mountain wall, the two-story
coaching inn carrying its key-sign AND an attic dormer on one fold, the
stable tented in the yard before it, a low field wall at the front edge)*

## ch1-backdrop — 1536×1024 · fold at 42% from left, slight lean

*Chapter I — sleeping-mountain panorama*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: spring green #6a8f5f, terracotta roofs #b0603f, dawn peach #e8a978, snow white. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. wide panorama of a stone-built village beneath snow-capped twin peaks (echoing Mount Ararat), the taller peak rising at about forty percent from the left where a clean ridge line runs top to bottom, spring-green foothills in layered strips, dawn-peach sky; decorative torn-paper skyline top edge (mountain silhouette), transparent above, village rooftops resting on the flat bottom edge. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch1-inn — 1024×1024 · fold at 55% from left, leans

*Chapter I — the inn itself, hero at the door*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: spring green #6a8f5f, terracotta roofs #b0603f, dawn peach #e8a978, snow white. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. a tall stone inn with many glowing windows and a terracotta roof, its front corner edge falling at about fifty-five percent from the left where the building visibly turns (a clean vertical corner seam top to bottom), and standing at the open door the Hero: a small paper-cut figurine of a young man with short dark hair, warm friendly eyes and a slight smile, wearing a simple forest-green tunic with rolled sleeves, brown trousers and boots, a leather satchel across his chest, holding a faintly glowing golden quill, one hand raised in greeting; the whole group resting on the flat bottom edge; isolated group, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch1-sign — 1024×1024 · rider on the inn's fold, center fold

*Chapter I — hanging key-sign*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: antique gold #c9a227, terracotta #b0603f. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. a small hanging tavern sign: an oversized brass key on a wooden shield-shaped board, dangling from a simple wrought-iron bracket, bold simple silhouette readable at tiny size, the bracket base resting on the flat bottom edge; isolated object, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch1-dormer — 1024×1024 · second rider on the inn's fold, center fold

*Chapter I — attic dormer (the inn's upper story)*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: terracotta roofs #b0603f, window amber #d98e3f, spring green #6a8f5f. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. a small attic dormer piece: a gabled dormer window with a terracotta roof cap and a warm glowing lattice window, a tiny sparrow perched on its ridge, bold simple silhouette readable at tiny size, symmetrical about its vertical centerline, the dormer base resting on the flat bottom edge; isolated object, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch1-wall — 1536×1024 · center fold

*Chapter I — low field wall*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: spring green #6a8f5f, terracotta roofs #b0603f, dawn peach #e8a978. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. long low dry-stone field wall strip with tufts of spring grass and apple-blossom sprigs along its top, a wooden gate exactly at the center of the strip (a clean vertical seam there), the wall base resting on the flat bottom edge; isolated strip, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch1-stable — SUPERSEDED by v5 box faces (ch1-stable-front/-side/-top below) — do not regenerate

*Chapter I — the innyard stable*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: chalet timber #8a5a3b, terracotta roofs #b0603f, spring green #6a8f5f. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. full-bleed printed strip for a folded stable piece, edge to edge with NO transparent margin: the inn's timber stable seen as a long low barn — plank walls, a haystack, a dozing dapple pony looking over a half-door, a hanging horseshoe and coiled rope (no letters anywhere); the roof-line runs horizontally at just past half the height, and the composition reads correctly when the strip is later folded along the vertical line at forty-one percent from the left. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

---

**Chapter II — The Carrier Swarm** *(one big alpine ridge with two bees riding
its fold, the courier balloon with a third bee circling it — deliberately
airy, no foreground)*

## ch2-backdrop — 1536×1024 · fold at 60% from left, slight lean

*Chapter II — alpine ridge panorama*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: alpine blue #7d9bb5, chalet timber #8a5a3b, honey gold #d9a441, bee black. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. wide alpine panorama: layered snow-dusted mountain peaks in cool blue with timber chalets stepped down the lower slopes, the highest peak rising at about sixty percent from the left where a clean ridge line runs top to bottom, honey-gold late-afternoon sky; decorative torn-paper skyline top edge (jagged peaks), transparent above, the valley floor resting on the flat bottom edge. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch2-bee-a — 1024×1024 · rider on the ridge's fold, center fold

*Chapter II — courier bee, wings spread*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: honey gold #d9a441, bee black, alpine blue #7d9bb5. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. one plump friendly striped paper bee seen head-on with both wings spread wide and symmetrical, carrying a tiny wrapped parcel under its body, bold simple silhouette readable at tiny size, the body centered so the vertical centerline runs between the wings, sitting on the flat bottom edge; isolated figure, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch2-bee-b — 1024×1024 · second rider, center fold

*Chapter II — smaller courier bee, letter in legs*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: honey gold #d9a441, bee black, sealing-wax red. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. one small friendly striped paper bee seen head-on with wings spread symmetrically, clutching a folded letter with a wax seal in its legs, bold simple silhouette readable at very small size, vertical centerline between the wings, sitting on the flat bottom edge; isolated figure, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch2-hero — 1024×1024 · fold at 45% from left, leans

*Chapter II — the hero's courier balloon*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: alpine blue #7d9bb5, chalet timber #8a5a3b, honey gold #d9a441. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. a charming paper hot-air balloon with a honey-gold striped envelope and a small wicker basket, and leaning out of the basket the Hero: a small paper-cut figurine of a young man with short dark hair, warm friendly eyes and a slight smile, wearing a simple forest-green tunic with rolled sleeves, brown trousers and boots, a leather satchel across his chest, holding a faintly glowing golden quill, looking through a small brass looking-glass; the balloon's left seam line falling at about forty-five percent from the left (a clean vertical seam top to bottom), the basket resting on the flat bottom edge; isolated group, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch2-bee-c — 1024×1024 · rider on the balloon's fold, center fold

*Chapter II — the smallest bee of the swarm*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: honey gold #d9a441, bee black, alpine blue #7d9bb5. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. one tiny friendly striped paper bee seen head-on with wings spread symmetrically and antennae curled, carrying nothing — the smallest scout of the swarm, bold simple silhouette readable at very small size, vertical centerline between the wings, sitting on the flat bottom edge; isolated figure, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

---

**Chapter III — The Rookery of Four Billion Ravens** *(the great tower now
carries a jutting dispatch BALCONY at mid-height with a raven perched above
it — one multi-story compound fold — plus a second tower rank with its own
raven and the dispatch-counter tent; the citadel IS the scene, no separate
hero figurine piece; the hero works at the counter)*

## ch3-towers — 1536×1024 · fold at 34% from left, slight lean

*Chapter III — tall citadel rank*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: slate #5a6470, raven black #2b2d33, dusk violet #6f5a7d, window amber #d98e3f. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. tall grey-citadel skyline at dusk: a great stone rookery tower rising at about one third from the left where its sheer corner edge runs top to bottom (a clean vertical seam), lower slate towers and a single spire (television-tower nod) stepping away to the right, ravens circling, scattered amber window lights; torn-paper top edge, transparent above, the street line resting on the flat bottom edge. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch3-balcony — 1024×1024 · rider at mid-height on the towers' fold, center fold

*Chapter III — the dispatch balcony (the tower's second story)*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: slate #5a6470, raven black #2b2d33, window amber #d98e3f. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. a small stone dispatch balcony piece: a jutting half-round balcony with a carved slate parapet and a wrought-iron rail, message scrolls tucked into pigeonholes beneath it, one raven alighting on the rail, bold simple silhouette readable at small size, symmetrical about its vertical centerline, the corbel base resting on the flat bottom edge; isolated object, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch3-raven-a — 1024×1024 · rider high on the towers' fold, center fold

*Chapter III — raven, wings spread*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: raven black #2b2d33, dusk violet #6f5a7d, window amber #d98e3f. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. one paper raven seen head-on with both wings spread wide and symmetrical, a small scroll in its beak, bold simple silhouette readable at tiny size, vertical centerline down the body, feet resting on the flat bottom edge; isolated figure, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch3-rank — 1536×1024 · fold at 64% from left, slight lean

*Chapter III — second tower rank*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: slate #5a6470, raven black #2b2d33, dusk violet #6f5a7d, window amber #d98e3f. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. lower rank of rookery rooftops and chimneys with ravens roosting on the ledges, arched dovecote openings glowing amber, a stout gate-tower at about two thirds from the left where its corner edge runs top to bottom (a clean vertical seam); torn-paper top edge, transparent above, the rooftop line resting on the flat bottom edge. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch3-raven-b — 1024×1024 · second rider, center fold

*Chapter III — small raven, folded wings*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: raven black #2b2d33, window amber #d98e3f. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. one small paper raven perched upright seen head-on, wings tucked, head tilted curiously, a sealed letter at its feet, bold simple silhouette readable at very small size, vertical centerline down the body, feet resting on the flat bottom edge; isolated figure, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch3-counter — SUPERSEDED by v5 box faces (ch3-counter-front/-side/-top below) — do not regenerate

*Chapter III — dispatch counter (the hero works here)*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: slate #5a6470, raven black #2b2d33, window amber #d98e3f. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. full-bleed printed strip for a folded counter piece, edge to edge with NO transparent margin: a long wooden dispatch counter covered edge to edge with pinned paper routes, sorted scroll-letters, brass stamps and an inkwell, and standing behind it at about the middle the Hero: a small paper-cut figurine of a young man with short dark hair, warm friendly eyes and a slight smile, wearing a simple forest-green tunic with rolled sleeves, brown trousers and boots, a leather satchel across his chest, holding a faintly glowing golden quill, sorting the letters while two ravens watch; the counter's front edge line runs horizontally at just past half the height, the composition reads correctly when the strip is later folded along the vertical line at fifty-nine percent from the left. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

---

**Chapter IV — one addition to the approved Batch-1 set**

## ch4-coins — 1024×1024 · rider on the dragon's fold, center fold

*Chapter IV — spilling coins*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: coin gold #e6c65a, dune gold #d9a24a. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. a small cascade of overlapping gold paper coins tumbling from a tipped bronze goblet, a few coins mid-air, bold simple silhouette readable at tiny size, symmetrical about its vertical centerline, the coin pile resting on the flat bottom edge; isolated group, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

---

**Chapter V — The Bazaar of a Thousand Stalls** *(rose-stone skyline, a ROW
of identical stall fronts flanking the archway — the master-pattern
repetition made visible — the archway strung with TWO lanterns on one fold,
and a striped awning tented out front)*

## ch5-city — 1536×1024 · fold at 58% from left, slight lean

*Chapter V — rose-stone skyline*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: tuff rose #c4766a, awning red #a63d2f, awning cream, fruit tones. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. wide rose-stone city panorama: sun-warmed pink-tuff domes and arches in layered strips, a great domed hall rising at about fifty-eight percent from the left where its edge runs top to bottom (a clean vertical seam), warm cream sky, distant low hills; decorative torn-paper skyline top edge, transparent above, the street line resting on the flat bottom edge. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch5-stalls — 1536×1024 · fold at 62% from left, slight lean

*Chapter V — row of master-pattern stall fronts*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: tuff rose #c4766a, awning red #a63d2f, awning cream, fruit tones. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. a row of market stall fronts all cut from the same master pattern — repeating pink-tuff stall arches with small striped canopies, stacked fruit and folded carpets in each opening, the repetition clearly readable, one slightly taller stall arch at about sixty-two percent from the left where a clean vertical seam runs top to bottom; torn-paper top edge, transparent above, the stall bases resting on the flat bottom edge. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch5-arch — 1024×1024 · center fold · RE-EXPORT needed: source arrived low-res (trims to ~456px; peers are 1000+) — re-download the original full-size image

*Chapter V — the master-pattern archway, hero carving*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: tuff rose #c4766a, awning red #a63d2f, antique gold #c9a227. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. a grand pink-tuff stone archway carved with repeating master patterns, its keystone exactly on the vertical centerline (the arch symmetrical left-to-right), and beneath it the Hero: a small paper-cut figurine of a young man with short dark hair, warm friendly eyes and a slight smile, wearing a simple forest-green tunic with rolled sleeves, brown trousers and boots, a leather satchel across his chest, holding a faintly glowing golden quill, chiseling a small glowing golden pattern-stone; the arch feet resting on the flat bottom edge; isolated group, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch5-lantern — 1024×1024 · rider on the arch's fold, center fold

*Chapter V — hanging market lantern*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: window amber #d98e3f, awning red #a63d2f, antique gold #c9a227. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. one glowing paper market lantern with a warm amber panel and a red tassel, hanging from a small curved bracket, bold simple silhouette readable at tiny size, symmetrical about its vertical centerline, the bracket base resting on the flat bottom edge; isolated object, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch5-lantern-b — 1024×1024 · second rider higher on the arch's fold, center fold

*Chapter V — the little sister lantern*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: window amber #d98e3f, awning red #a63d2f, antique gold #c9a227. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. one small paper market lantern glowing warm amber with a short red ribbon, hanging from a simple hook — plainer and smaller than its sibling lantern, bold simple silhouette readable at very small size, symmetrical about its vertical centerline, the hook base resting on the flat bottom edge; isolated object, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch5-awning — SUPERSEDED by v5 box faces (ch5-stall-front/-side/-top below) — do not regenerate

*Chapter V — market awning canopy*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: awning red #a63d2f, awning cream, fruit tones. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. full-bleed printed strip for a folded awning piece, edge to edge with NO transparent margin: bold red-and-cream awning stripes running left to right, a scalloped fringe along both long edges, small hanging fruit bundles and one strung lantern along the lower stripe; the composition reads correctly when the strip is later folded along the vertical line at fifty-seven percent from the left. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

---

**Chapter VI — The Northern Treasury** *(pine treeline, the largest hero of
the book — the glass treasury grown to a multi-story compound: its round
vault door low on the fold, its banner raised high, the piece leaning —
and a pine fringe)*

## ch6-pines — 1536×1024 · fold at 44% from left, slight lean

*Chapter VI — pine treeline under the aurora*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: pine #2e5244, aurora teal #4fd6b8, aurora violet #8a6fd6, night navy #1d2a45. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. wide northern panorama: a dark pine forest ridgeline in layered strips, the tallest pine rising at about forty-four percent from the left (a clean vertical seam runs top to bottom through it), night-navy sky with a soft teal-and-violet aurora ribbon overhead; decorative torn-paper top edge (treeline), transparent above, the forest floor resting on the flat bottom edge. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch6-treasury — 1024×1024 · fold at 47% from left, leans · REGENERATE v2: building ONLY

*Chapter VI — the glass treasury (user 2026-07-11: the hero and founders
become their own cutout, `ch6-founders` below, so the building stands
alone)*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: pine #2e5244, aurora teal #4fd6b8, aurora violet #8a6fd6, night navy #1d2a45. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. a tall treasury hall with walls of glass panels between stone buttresses, warm golden light glowing from within so tiny stacked vault shelves show through the glass, a round brass vault-door set in its base, its front corner edge falling at about forty-seven percent from the left where the building visibly turns (a clean vertical corner seam top to bottom), NO people anywhere — the building alone, resting on the flat bottom edge; isolated building, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch6-founders — 1024×1024 · NEW piece · center fold

*Chapter VI — the hero unrolling plans with the founders (split out of the
treasury so the figures stand on their own paper, in front of the hall)*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: pine #2e5244, aurora teal #4fd6b8, night navy #1d2a45. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. a small standing group: the Hero — a small paper-cut figurine of a young man with short dark hair, warm friendly eyes and a slight smile, wearing a simple forest-green tunic with rolled sleeves, brown trousers and boots, a leather satchel across his chest, holding a faintly glowing golden quill — unrolling a large paper plan together with two founder figures in long northern coats and fur collars, the three gathered around the unrolled sheet, the group symmetrical enough that its vertical centerline can carry a clean fold, everyone resting on the flat bottom edge; isolated group, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch6-door — 1024×1024 · rider low on the treasury's fold, center fold

*Chapter VI — the round vault door (the treasury's ground story)*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: antique gold #c9a227, aurora teal #4fd6b8, night navy #1d2a45. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. a small round vault door piece: a circular glass-and-brass vault door with radiating spokes and a central wheel handle (echoing a round vault emblem, no letters), set in a stone door-frame, warm gold light leaking around its rim, bold simple silhouette readable at small size, symmetrical about its vertical centerline, the threshold resting on the flat bottom edge; isolated object, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch6-banner — 1024×1024 · rider on the treasury's fold, center fold

*Chapter VI — raised vault banner*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: aurora teal #4fd6b8, night navy #1d2a45, antique gold #c9a227. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. a small heraldic banner on a short flagpole: deep navy field with a round gold vault-door emblem at its center (a circle with radiating spokes, no letters), two swallow-tail points, bold simple silhouette readable at tiny size, symmetrical about the vertical centerline of the pole, the pole base resting on the flat bottom edge; isolated object, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch6-fringe — 1536×1024 · center fold

*Chapter VI — snowy pine fringe*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: pine #2e5244, aurora teal #4fd6b8, night navy #1d2a45. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. low foreground fringe strip: snow-dusted pine branches and a scatter of pinecones along a stone ledge, one small snow drift exactly at the center of the strip (a clean vertical seam there), the ledge resting on the flat bottom edge; isolated strip, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

---

**Title page**

## title-border — 1536×1024

*Title page — illuminated vine border*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: antique gold #c9a227, spring green #6a8f5f. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. ornate illuminated vine border: a curling gold-foil vine with small spring-green paper leaves and tiny flourish blossoms, symmetrical left-to-right, a full-width decorative band framing a page; isolated strip, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## title-hero — 1024×1024

*Title page — waving hero*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: antique gold #c9a227, spring green #6a8f5f. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. the Hero: a small paper-cut figurine of a young man with short dark hair, warm friendly eyes and a slight smile, wearing a simple forest-green tunic with rolled sleeves, brown trousers and boots, a leather satchel across his chest, holding a faintly glowing golden quill, waving cheerfully with one hand raised, standing in a relaxed welcoming pose; isolated figurine, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## title-crest — 1024×1024 · rider on the title-hero's fold, center fold

*Title page — small heraldic crest*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: antique gold #c9a227, spring green #6a8f5f. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. a small standing heraldic crest piece: a paper shield quartered with a quill, a key, a raven and a coin (pictorial emblems only, no letters), wreathed by a curling gold vine, bold simple silhouette readable at small size, symmetrical about its vertical centerline, the shield base resting on the flat bottom edge; isolated object, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

---

**The Hero's Satchel**

## satchel-bag — 1024×1024

*The Hero's Satchel — the bag itself*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: antique gold #c9a227, leather brown #8a5a3b. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. an open brown leather satchel bag with brass buckles, its flap folded back, sitting upright as if just set down; isolated on transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## item-sword — 1024×1024

*The Hero's Satchel — item cutout*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: antique gold #c9a227, leather brown #8a5a3b. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. The Ever-Sharp Sword (React) — a heroic paper longsword with a simple crossguard, a faint leaf-shaped blade, and small gold filigree wrapping the hilt; isolated on transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## item-spellbook — 1024×1024

*The Hero's Satchel — item cutout*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: antique gold #c9a227, leather brown #8a5a3b. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. The Book of True Names (TypeScript) — a thick bound spellbook with a blue paper cover, a gold clasp, and a faint glow along the page edges; isolated on transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## item-scroll — 1024×1024

*The Hero's Satchel — item cutout*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: antique gold #c9a227, leather brown #8a5a3b. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. The Router's Scroll (Next.js) — a partly unrolled parchment scroll tied with a black-and-white ribbon, a faint branching road-line drawn across it; isolated on transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## item-potion — 1024×1024

*The Hero's Satchel — item cutout*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: antique gold #c9a227, leather brown #8a5a3b. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. The Bear's Draught (Zustand) — a small round glass potion bottle with a cork stopper, filled with amber liquid, a tiny bear silhouette painted on its paper label; isolated on transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## item-compass — 1024×1024

*The Hero's Satchel — item cutout*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: antique gold #c9a227, leather brown #8a5a3b. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. The Wayfarer's Compass (React Native) — an open brass pocket compass with an ornate hinged lid, a faintly glowing needle; isolated on transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## item-shield — 1024×1024

*The Hero's Satchel — item cutout*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: antique gold #c9a227, leather brown #8a5a3b. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. The Tester's Shield (Jest) — a small round wooden shield with a worn, dented rim and a painted red insignia at its center; isolated on transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

---

**The End & back cover**

## end-letter — 1024×1024 · center fold

*The End — folded letter*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: seal burgundy #641e26, slate #5a6470. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. a folded parchment letter sealed with a burgundy wax seal stamped with a small dragon crest, one corner gently curled; isolated on transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## end-raven — 1024×1024 · rider on the letter's fold, center fold

*The End — raven messenger (the raven the closing line asks the reader to send)*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: seal burgundy #641e26, slate #5a6470. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. one paper raven seen head-on with both wings spread wide and symmetrical, carrying a small rolled letter in its beak, bold simple silhouette readable at tiny size, vertical centerline down the body, feet resting on the flat bottom edge; isolated figure, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## back-crest — 1024×1024

*Back cover — small crest*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: leather burgundy #641e26, antique gold #c9a227. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. small circular heraldic dragon crest medallion, simpler than the front cover crest, antique gold foil paper with a coiled dragon motif; isolated on transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

---

# v2 addendum — printed page spreads (the missing half of the medium)

The pivot (2026-07-10 evening): real pop-up books print the world onto the
page itself — cutouts rise out of a fully illustrated spread, never out of
blank paper. This adds ONE new asset class: a full-bleed printed spread per
page, `page-<spread>.png` → 9 assets. These are **opaque full rectangles,
1536×1024, NO transparency** — the pipeline detects `page-` ids and skips
trimming/rims.

*(Superseded by v3: the Batch-2 cutout prompts above now carry their fold
guidance inline — each heading states the fold/ridge position and the
prompt text places a natural seam there. Nothing extra to append.)*

Every page print below shares the same structure: printed FLAT on aged
parchment (paper grain showing through), ground plane covering the lower
half, sky/air above, printed saturation a step quieter than the cutouts,
nothing that belongs to a pop-up piece, no text, no border.

## page-5 — 1536×1024 — Chapter IV spread (GENERATE FIRST — validates the system with the art you already made)

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is printed flat on aged parchment paper with visible paper grain showing through the print. Whimsical storybook fairy-tale shapes, charming and warm. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: dune gold #d9a24a, sunset coral #d96f4a, oasis teal #4f8f85, coin gold #e6c65a. Flat matte lighting. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. Subject: one continuous full-bleed two-page book spread printed flat: rolling golden dune-sand ground with printed sand ripples covering the lower half, scattered printed gold coins and small caravan footprints wandering toward the center gutter, a coral-to-gold sunset sky filling the upper half with soft printed cloud bands; printed saturation a step quieter than a paper cutout would be; no dragon, no figures, no buildings; no border. Opaque full rectangle, landscape orientation, NO transparency.
```

## page-2 — 1536×1024 — Chapter I spread

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is printed flat on aged parchment paper with visible paper grain showing through the print. Whimsical storybook fairy-tale shapes, charming and warm. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: spring green #6a8f5f, terracotta #b0603f, dawn peach #e8a978. Flat matte lighting. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. Subject: one continuous full-bleed two-page book spread printed flat: a spring-green village meadow ground covering the lower half with a winding printed cobblestone path crossing the center gutter, tiny printed wildflowers and scattered brass keys, a dawn-peach sky filling the upper half with soft printed clouds and a faint distant hill line; printed saturation a step quieter than a paper cutout; no buildings, no figures; no border. Opaque full rectangle, landscape orientation, NO transparency.
```

## page-3 — 1536×1024 — Chapter II spread

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is printed flat on aged parchment paper with visible paper grain showing through the print. Whimsical storybook fairy-tale shapes, charming and warm. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: alpine blue #7d9bb5, chalet timber #8a5a3b, honey gold #d9a441. Flat matte lighting. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. Subject: one continuous full-bleed two-page book spread printed flat: an alpine valley floor covering the lower half with printed snow patches, pine-needle scatter and a winding trail of tiny printed honey-drop dots crossing the center gutter, a pale alpine-blue sky filling the upper half with soft printed cloud bands and a faint printed peak line at the horizon; printed saturation a step quieter than a paper cutout; no chalets, no bees, no figures; no border. Opaque full rectangle, landscape orientation, NO transparency.
```

## page-4 — 1536×1024 — Chapter III spread

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is printed flat on aged parchment paper with visible paper grain showing through the print. Whimsical storybook fairy-tale shapes, charming and warm. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: slate #5a6470, dusk violet #6f5a7d, window amber #d98e3f. Flat matte lighting. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. Subject: one continuous full-bleed two-page book spread printed flat: a slate cobblestone plaza ground covering the lower half with a few scattered printed scroll-letters and black feathers drifting toward the center gutter, a dusk-violet sky filling the upper half with tiny printed raven silhouettes very far away and a warm amber glow along the horizon line; printed saturation a step quieter than a paper cutout; no towers, no perched ravens, no figures; no border. Opaque full rectangle, landscape orientation, NO transparency.
```

## page-6 — 1536×1024 — Chapter V spread

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is printed flat on aged parchment paper with visible paper grain showing through the print. Whimsical storybook fairy-tale shapes, charming and warm. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: tuff rose #c4766a, awning red #a63d2f, awning cream. Flat matte lighting. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. Subject: one continuous full-bleed two-page book spread printed flat: a rose-pink tuff-stone paving ground covering the lower half with printed woven-rug motifs and scattered printed apricots and pomegranate seeds near the center gutter, a warm cream late-afternoon sky filling the upper half with soft printed shadow arcs cast by unseen awnings; printed saturation a step quieter than a paper cutout; no market stalls, no figures; no border. Opaque full rectangle, landscape orientation, NO transparency.
```

## page-7 — 1536×1024 — Chapter VI spread

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is printed flat on aged parchment paper with visible paper grain showing through the print. Whimsical storybook fairy-tale shapes, charming and warm. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: pine #2e5244, aurora teal #4fd6b8, aurora violet #8a6fd6, night navy #1d2a45. Flat matte lighting. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. Subject: one continuous full-bleed two-page book spread printed flat: a dark pine-forest floor covering the lower half with printed moss patches, soft pine-needle texture and a few unrolled printed blueprint scrolls near the center gutter, a night-navy sky filling the upper half crossed by one soft printed aurora ribbon in teal and violet with tiny printed stars; printed saturation a step quieter than a paper cutout; no buildings, no figures; no border. Opaque full rectangle, landscape orientation, NO transparency.
```

## page-1 — 1536×1024 — title spread

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is printed flat on aged parchment paper with visible paper grain showing through the print. Whimsical storybook fairy-tale shapes, charming and warm. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: antique gold #c9a227, forest green #6a8f5f. Flat matte lighting. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. Subject: one continuous full-bleed two-page book spread printed flat: warm parchment with delicate printed golden vine tendrils curling in from the four corners, tiny printed quill and star motifs scattered sparsely, a soft radiant cream glow at the center of each page; printed saturation quiet and elegant; no figures; no border, no text. Opaque full rectangle, landscape orientation, NO transparency.
```

## page-8 — 1536×1024 — satchel spread

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is printed flat on aged parchment paper with visible paper grain showing through the print. Whimsical storybook fairy-tale shapes, charming and warm. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: antique gold #c9a227, saddle leather #8a5a3b. Flat matte lighting. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. Subject: one continuous full-bleed two-page book spread printed flat: a craftsman's workbench tabletop seen from above covering the whole spread, printed wood grain, faint printed stitched-leather seams, a printed measuring cord winding across the center gutter, small printed buckles and thread spools scattered sparsely; printed saturation a step quieter than a paper cutout; no satchel itself, no tools standing up, no figures; no border. Opaque full rectangle, landscape orientation, NO transparency.
```

## page-9 — 1536×1024 — end spread

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is printed flat on aged parchment paper with visible paper grain showing through the print. Whimsical storybook fairy-tale shapes, charming and warm. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: seal burgundy #7a1f2b, slate #5a6470. Flat matte lighting. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. Subject: one continuous full-bleed two-page book spread printed flat: a scholar's writing desk seen from above covering the whole spread, printed dark wood grain, faint printed ink rings from an inkwell, a few printed drips of burgundy sealing wax, one printed black feather lying across the center gutter, the soft printed glow of an unseen candle warming one corner; printed saturation a step quieter than a paper cutout; no letter, no raven, no figures; no border. Opaque full rectangle, landscape orientation, NO transparency.
```

---

# v5 addendum — box faces (the volumetric phase)

The counter, stable, and awning tents are gone: they are now BOX FOLDS —
enclosed paper prisms with a camera-facing front, painted side walls, and
a lid or pitched roof (plus a new treasure chest in Chapter IV). Their old
tent-strip prompts above (ch1-stable, ch3-counter, ch5-awning) are
SUPERSEDED — do not regenerate those.

**Box face conventions (every prompt below):**

- Each face is its OWN image, full bleed edge to edge, NO transparent
  margin (like the page prints — the whole rectangle is glued to a face).
  The transparency/magenta lines are dropped for these on purpose.
- The engine maps: `<id>-front` onto the front face, `<id>-side` onto both
  side walls (mirrored placement left/right — authentic same-die
  printing), `<id>-top` onto the lid or both roof slopes, `<id>-back`
  (optional, skippable) onto the back face. A face with no art renders as
  raw kraft stock, which also reads fine — fronts first if you batch.
- A real vertical seam runs down the exact center of every front face
  when the box folds (the classic pop-up box seam), so keep any single
  focal motif — a face, an emblem, a keyhole — OFF the exact centerline.
- Top/roof images: the image's top edge lands at the BACK of the box (the
  far edge from the reader). Roof strips split at the vertical center
  into the two slopes — paint the ridge line vertically down the middle.
- Every prompt starts with the locked style preamble (spec §8.3, verbatim
  as everywhere else) with that chapter's accents — abbreviated below as
  `{STYLE PREAMBLE + accents}`.

**Chapter I — the stable, now a gabled box barn at the innyard gate**

## ch1-stable-front — ON HOLD (C6 round-1: the barn is now an OPEN-FRONT room — no front face to print; an interior back-wall prompt replaces this once interior art faces land)

```
{STYLE PREAMBLE + accents: chalet timber #8a5a3b, terracotta roofs #b0603f, spring green #6a8f5f} full-bleed printed panel for the front face of a small paper barn box, edge to edge with NO margin: a timber stable front — plank walls, a wide barn door standing slightly ajar with warm lantern light inside, a dozing dapple pony looking over the half-door on the right side, a hanging horseshoe above the door frame, small tufts of straw at the sill. Composition reads correctly when displayed a little wider than tall. No text or letters anywhere. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch1-stable-side — 1024×1024 · box side wall (used mirrored on both sides)

```
{STYLE PREAMBLE + same accents} full-bleed printed panel for the side wall of a small paper barn box, edge to edge with NO margin: weathered plank siding with a single square hay-window, a coiled rope on a peg, a wooden bucket at the base, a chicken pecking near the corner. Square composition. No text or letters anywhere. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch1-stable-top — 1536×1024 · roof strip, ridge vertically down the exact center

```
{STYLE PREAMBLE + same accents} full-bleed printed strip for the pitched roof of a small paper barn box, edge to edge with NO margin: terracotta shingle rows on both halves, a straight ridge line running vertically down the exact center of the image, a few patches of moss and one tiny sparrow perched on the ridge. The two halves read as the two slopes of one roof. No text or letters anywhere. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

**Chapter III — the dispatch counter, now a lidded flat-top box desk**

## ch3-counter-front — 1536×1024 · box front

```
{STYLE PREAMBLE + accents: slate blues #5a6470, charcoal #2b2d33, muted violet #6f5a7d, ember orange #d98e3f} full-bleed printed panel for the front face of a paper dispatch-counter box, edge to edge with NO margin: a carved dark-wood counter front with two rows of small pigeonhole compartments stuffed with rolled messages, brass fittings, a raven feather quill resting in a holder, wax seals in ember orange. Composition reads correctly when displayed a little wider than tall. No text or letters anywhere. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch3-counter-side — 1536×1024 · box side wall

```
{STYLE PREAMBLE + same accents} full-bleed printed panel for the side wall of a paper dispatch-counter box, edge to edge with NO margin: the counter's dark-wood side panel with a shelf of stacked ledgers, a hanging brass lantern, and a small perch with message capsules. No text or letters anywhere. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch3-counter-top — 1024×1024 · lid seen from above

```
{STYLE PREAMBLE + same accents} full-bleed printed panel for the top writing surface of a paper dispatch-counter box seen straight from above, edge to edge with NO margin: an open ledger book, an ink pot, a burning stub of sealing wax, two sealed letters, scattered raven feathers on dark wood — arranged so no single object sits exactly on the vertical centerline. Square composition. No text or letters anywhere (the ledger shows only faint ruled lines, no writing). Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

**Chapter IV — NEW: the treasure chest (hollow box, open top — the interior stays raw paper on purpose)**

## ch4-chest-front — 1536×1024 · box front

```
{STYLE PREAMBLE + accents: dune gold #d9a24a, burnt sienna #d96f4a, oasis teal #4f8f85, treasure glint #e6c65a} full-bleed printed panel for the front face of a small paper treasure-chest box, edge to edge with NO margin: dark banded wood with riveted gold straps, an ornate keyhole plate placed left of center, a few gold coins spilling over the front lip at the top edge. Composition reads correctly when displayed twice as wide as tall. No text or letters anywhere. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch4-chest-side — 1024×1024 · box side wall

```
{STYLE PREAMBLE + same accents} full-bleed printed panel for the side wall of a small paper treasure-chest box, edge to edge with NO margin: banded dark wood with a gold strap corner, a heavy iron carrying handle, one small scratch mark as if from a dragon claw. Square composition. No text or letters anywhere. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

**Chapter V — the awning, now a gabled market-stall box**

## ch5-stall-front — ON HOLD (C6 round-1: the stall is now an OPEN-FRONT room — no front face to print; an interior back-wall prompt replaces this once interior art faces land)

```
{STYLE PREAMBLE + accents: rose stone #c4766a, deep terracotta #a63d2f, sand parchment #e7d5a8} full-bleed printed panel for the front face of a paper market-stall box, edge to edge with NO margin: a rose-stone stall front with a wooden counter board, woven baskets of oranges and pomegranates, hanging bundles of dried herbs, a folded carpet leaning at one side. Composition reads correctly when displayed a little wider than tall. No text or letters anywhere. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch5-stall-side — 1536×1024 · box side wall

```
{STYLE PREAMBLE + same accents} full-bleed printed panel for the side wall of a paper market-stall box, edge to edge with NO margin: hanging patterned rugs in rose and terracotta, a stack of clay pots, a string of dried peppers down one edge. No text or letters anywhere. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch5-stall-top — 1536×1024 · roof strip, ridge vertically down the exact center

```
{STYLE PREAMBLE + same accents} full-bleed printed strip for the pitched canvas roof of a paper market-stall box, edge to edge with NO margin: striped market-awning canvas in terracotta and cream, the stripes running away from a straight ridge line down the exact vertical center of the image, gently scalloped shadow bands suggesting draped fabric. The two halves read as the two slopes of one canopy. No text or letters anywhere. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

**Chapter VI — NEW: the banker's strongbox on the path to the vaults (lidded box)**

## ch6-strongbox-front — 1536×1024 · box front

```
{STYLE PREAMBLE + accents: deep pine #2e5244, glass teal #4fd6b8, twilight violet #8a6fd6, midnight navy #1d2a45} full-bleed printed panel for the front face of a small paper strongbox, edge to edge with NO margin: dark iron-bound northern wood with teal-enameled strap hinges, a round vault-dial ornament placed right of center, faint frost crystals creeping in from the corners. Composition reads correctly when displayed a little wider than tall. No text or letters anywhere. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch6-strongbox-side — 1024×1024 · box side wall

```
{STYLE PREAMBLE + same accents} full-bleed printed panel for the side wall of a small paper strongbox, edge to edge with NO margin: iron-bound dark wood with a heavy riveted corner plate, a hanging brass key on a cord, a dusting of snow along the bottom edge. Square composition. No text or letters anywhere. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch6-strongbox-top — 1024×1024 · lid seen from above

```
{STYLE PREAMBLE + same accents} full-bleed printed panel for the top lid of a small paper strongbox seen straight from above, edge to edge with NO margin: dark wood planks crossed by two teal-enameled iron straps, a fine dusting of snow settled along the strap edges, one small aurora-green reflection — arranged so nothing sits exactly on the vertical centerline. Square composition. No text or letters anywhere. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

**Chapter II — NEW cutout (not a box face): a low alpine meadow fringe. This is
the spread's missing fourth depth plane (C3) — it enters content.ts only when
this art lands, so the airy chapter never shows a placeholder blob.**

## ch2-fringe — 1536×1024 · standard cutout, center fold, transparent background

```
{STYLE PREAMBLE + accents: alpine slate blue #7d9bb5, chalet timber #8a5a3b, honey gold #d9a441} a long LOW paper-cut fringe strip of alpine meadow grass for the front edge of a pop-up scene: tufts of mountain grass and tiny wildflowers in honey gold and slate blue, two or three small stones, one tiny paper bee resting on a flower near the right end; wide and shallow silhouette with a gently varied top edge, solid along the bottom; the composition reads correctly when the strip is later folded along the vertical line at its center. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

---

## v6 addendum — anatomy phase (platforms, fan, riders, dress patches)

House style unchanged (storybook gouache, warm paper, no text in art).
All assets manifest-gated as before. Two NEW asset shapes:

**DECK paintings** (`<id>-deck`): ONE image spanning the whole deck,
crease running VERTICALLY at the u-split given below (paint continuous
across it — it's a fold, not a border). Image TOP = the far edge (away
from the reader). These are viewed from above at an angle — paint
top-down scenes.

| asset | aspect (w:h) | crease u | scene |
|---|---|---|---|
| ch1-yard-deck | 24:18 | 0.50 | cobbled coaching-yard: well, barrels, hens |
| ch2-meadow-deck | 12:28 | 0.50 | alpine flower shelf: gentians, clover drifts |
| ch3-sorting-deck | 20:18 | 0.50 | dispatch sorting table: letters, twine, wax |
| ch4-hoard-deck | 16:10 | 0.50 | coin drifts and a spilled goblet |
| ch5-goods-deck | 18:22 | 0.50 | market wares: bolts of cloth, spice bowls |
| ch6-steps-deck | 18:20 | 0.64 | glass treasury steps, aurora reflections |

**DIE-CUT DRESS PATCHES** (transparent PNG, alpha IS the die-cut — the
silhouette edge is the artwork; nothing rectangular): ch1-inn-eaves
(carved eave board 30:12), ch1-inn-lamp (hanging lantern 8:14),
ch1-stable-vane (weathervane cockerel 7:12), ch1-stable-hay (hay pile
14:8), ch2-hive-swarm (bee swarm arc 16:10), ch2-hive-flowers (clover
clump 14:7), ch3-counter-ledgers (leaning ledger stack 12:10),
ch3-counter-scale (brass balance 9:10), ch4-chest-lid (propped-open lid
13:14), ch4-chest-spill (coin spill 12:9), ch5-arch-garland (pennant
garland 30:10), ch5-arch-keystone (carved keystone 10:10),
ch5-stall-valance (scalloped valance 20:7), ch5-stall-crates (fruit
crates 12:9), ch6-treasury-spire (glass spire finial 14:20),
ch6-treasury-vines (frosted vine base 20:12), ch6-strongbox-seal (wax
bank seal 7:7), ch6-strongbox-coins (coin scatter 12:6).

**RIDERS** (standard center-crease standee sheets like figures):
ch3-perch-raven (10:9, a raven perched wings-half-open — it stands ON
the dispatch counter), ch6-crest (9:8, gilded griffin crest plaque —
stands on the strongbox).

**FAN MEMBERS** (v6.1 — the showcase moved to the satchel spread; the
ch5-canopies-m* prompts are DEAD): satchel-burst-m0 (26:26),
-m1 (40:34), -m2 (50:36) — a golden fan of treasures bursting out of
the hero's opened satchel: gilded rays, tool silhouettes, coin glints;
each member a center-crease sheet, nested trio, richest ray outermost.

**FLAT SHEET**: ch2-fringe (120:22) — long meadow-edge fringe strip,
scalloped top silhouette like ch6-fringe.

Still open from v5 (unchanged): box face sets for stable (-side/-top),
hive/counter/strongbox (-front/-back/-side/-top), chest (-front/-back/
-side), stall (-side/-top). The v5 'treasury/inn/arch box conversion'
line is DEAD: under the v2 anatomy bar they stay dressed v-fold heroes —
their existing paintings stand, no regen needed.
