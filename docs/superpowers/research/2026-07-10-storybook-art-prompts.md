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
2. **Generate all layers of one scene in a single ChatGPT conversation.** For a
   4-layer chapter spread, do backdrop → midground → hero → foreground back to
   back in the same thread so paper grain, light, and palette stay consistent
   across the set. If a later layer starts drifting, remind the model: "same
   paper, same light, same palette as the previous image."
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
   semi-transparent edges, trims dead space (backdrops keep full canvas width),
   resizes to fit within 1536px, and emits `public/labs/storybook/art/<id>.webp`
   — a stdout table lists what it produced.

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

# Batch 2 — remaining spreads (32 assets)

Same four-layer pattern as Chapter IV (backdrop panorama with a torn-paper
skyline top edge → midground set-piece strip → hero figurine group → foreground
fringe strip), generated per §4's scene descriptions and §3.1's accents, plus the
title page, the satchel and its six items, and the closing pages.

**Chapter I — The Inn of a Hundred Keys**

## ch1-backdrop — 1536×1024

*Chapter I — The Inn of a Hundred Keys — backdrop layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: spring green #6a8f5f, terracotta roofs #b0603f, dawn peach #e8a978, snow white. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. wide panorama of a stone-built village beneath snow-capped twin peaks (echoing Mount Ararat), spring-green foothills in layered strips, dawn-peach sky; decorative torn-paper skyline top edge (mountain silhouette), transparent above. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch1-midground — 1536×1024

*Chapter I — The Inn of a Hundred Keys — midground layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: spring green #6a8f5f, terracotta roofs #b0603f, dawn peach #e8a978, snow white. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. skyline strip of a stone-built village climbing a hillside: terracotta-roofed stone houses, a many-windowed inn glowing with warm light, a narrow cobbled lane; isolated strip, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch1-hero — 1024×1024

*Chapter I — The Inn of a Hundred Keys — hero layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: spring green #6a8f5f, terracotta roofs #b0603f, dawn peach #e8a978, snow white. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. the Hero: a small paper-cut figurine of a young man with short dark hair, warm friendly eyes and a slight smile, wearing a simple forest-green tunic with rolled sleeves, brown trousers and boots, a leather satchel across his chest, holding a faintly glowing golden quill, an oversized brass key tucked through his belt and one hand raised in greeting, standing before the open door of a stone inn glowing with many lit windows; isolated group, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch1-foreground — 1536×1024

*Chapter I — The Inn of a Hundred Keys — foreground layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: spring green #6a8f5f, terracotta roofs #b0603f, dawn peach #e8a978, snow white. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. foreground fringe strip: cobblestones scattered with fallen apple-blossom petals, a couple of spare brass keys, and a patch of lingering snow; isolated strip, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

---

**Chapter II — The Carrier Swarm**

## ch2-backdrop — 1536×1024

*Chapter II — The Carrier Swarm — backdrop layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: alpine blue #7d9bb5, chalet timber #8a5a3b, honey gold #d9a441, bee black. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. wide alpine panorama: layered snow-dusted mountain peaks in cool blue, honey-gold late-afternoon sky, distant valley haze; decorative torn-paper skyline top edge (jagged peaks), transparent above. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch2-midground — 1536×1024

*Chapter II — The Carrier Swarm — midground layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: alpine blue #7d9bb5, chalet timber #8a5a3b, honey gold #d9a441, bee black. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. skyline strip of timber chalets stepped down a pine slope: steep gabled roofs, dark ranks of pine trees, small glowing windows; isolated strip, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch2-hero — 1024×1024

*Chapter II — The Carrier Swarm — hero layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: alpine blue #7d9bb5, chalet timber #8a5a3b, honey gold #d9a441, bee black. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. the Hero: a small paper-cut figurine of a young man with short dark hair, warm friendly eyes and a slight smile, wearing a simple forest-green tunic with rolled sleeves, brown trousers and boots, a leather satchel across his chest, holding a faintly glowing golden quill, a small glowing paper map unrolled between both hands with faint golden route-lines, flanked by two giant friendly striped paper bees hovering beside him each carrying a tiny parcel; isolated group, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch2-foreground — 1536×1024

*Chapter II — The Carrier Swarm — foreground layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: alpine blue #7d9bb5, chalet timber #8a5a3b, honey gold #d9a441, bee black. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. foreground fringe strip: scattered pine needles and a few fallen honeycomb fragments along a low wooden fence rail, one small trail of bee footprints; isolated strip, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

---

**Chapter III — The Rookery of Four Billion Ravens**

## ch3-backdrop — 1536×1024

*Chapter III — The Rookery of Four Billion Ravens — backdrop layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: slate #5a6470, raven black #2b2d33, dusk violet #6f5a7d, window amber #d98e3f. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. wide grey-citadel panorama at dusk: slate rooftops and a single tall spire silhouette (television-tower nod), dusk-violet sky, scattered amber window lights; decorative torn-paper skyline top edge, transparent above. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch3-midground — 1536×1024

*Chapter III — The Rookery of Four Billion Ravens — midground layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: slate #5a6470, raven black #2b2d33, dusk violet #6f5a7d, window amber #d98e3f. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. skyline strip of a tall stone rookery tower dense with roosting ravens on its ledges, small arched openings, a weathervane at the top; isolated strip, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch3-hero — 1024×1024

*Chapter III — The Rookery of Four Billion Ravens — hero layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: slate #5a6470, raven black #2b2d33, dusk violet #6f5a7d, window amber #d98e3f. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. the Hero: a small paper-cut figurine of a young man with short dark hair, warm friendly eyes and a slight smile, wearing a simple forest-green tunic with rolled sleeves, brown trousers and boots, a leather satchel across his chest, holding a faintly glowing golden quill, standing before a huge wooden dispatch board covered in scroll-letters and pinned paper routes, one raven landing on his outstretched arm with a scroll in its beak; isolated group, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch3-foreground — 1536×1024

*Chapter III — The Rookery of Four Billion Ravens — foreground layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: slate #5a6470, raven black #2b2d33, dusk violet #6f5a7d, window amber #d98e3f. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. foreground fringe strip: a cobblestone edge scattered with a few black feathers and a couple of dropped scroll-letters tied with amber ribbon; isolated strip, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

---

**Chapter V — The Bazaar of a Thousand Stalls**

## ch5-backdrop — 1536×1024

*Chapter V — The Bazaar of a Thousand Stalls — backdrop layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: tuff rose #c4766a, awning red #a63d2f, awning cream, fruit tones. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. wide rose-stone city panorama: sun-warmed pink-tuff domes and arches in layered strips, warm cream sky, distant low hills; decorative torn-paper skyline top edge, transparent above. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch5-midground — 1536×1024

*Chapter V — The Bazaar of a Thousand Stalls — midground layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: tuff rose #c4766a, awning red #a63d2f, awning cream, fruit tones. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. skyline strip of an arched bazaar row: pink-tuff archways, red-and-cream striped awnings, hanging fruit baskets and strung lanterns; isolated strip, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch5-hero — 1024×1024

*Chapter V — The Bazaar of a Thousand Stalls — hero layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: tuff rose #c4766a, awning red #a63d2f, awning cream, fruit tones. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. the Hero: a small paper-cut figurine of a young man with short dark hair, warm friendly eyes and a slight smile, wearing a simple forest-green tunic with rolled sleeves, brown trousers and boots, a leather satchel across his chest, holding a faintly glowing golden quill, carving a small glowing golden pattern-stone with a chisel, a row of identical paper market stalls springing up mid-assembly beside him; isolated group, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch5-foreground — 1536×1024

*Chapter V — The Bazaar of a Thousand Stalls — foreground layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: tuff rose #c4766a, awning red #a63d2f, awning cream, fruit tones. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. foreground fringe strip: scattered fruit (pomegranates, apricots, figs) and a few pink-tuff stone chips along a market-stall counter edge; isolated strip, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

---

**Chapter VI — The Northern Treasury**

## ch6-backdrop — 1536×1024

*Chapter VI — The Northern Treasury — backdrop layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: pine #2e5244, aurora teal #4fd6b8, aurora violet #8a6fd6, night navy #1d2a45. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. wide northern panorama: a dark pine forest ridgeline in layered strips, night-navy sky with a soft teal-and-violet aurora ribbon overhead; decorative torn-paper skyline top edge (treeline), transparent above. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch6-midground — 1536×1024

*Chapter VI — The Northern Treasury — midground layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: pine #2e5244, aurora teal #4fd6b8, aurora violet #8a6fd6, night navy #1d2a45. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. skyline strip of a glass-and-stone treasury building rising among pines: tall glass panels, stone buttresses, warm interior glow through the windows; isolated strip, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch6-hero — 1024×1024

*Chapter VI — The Northern Treasury — hero layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: pine #2e5244, aurora teal #4fd6b8, aurora violet #8a6fd6, night navy #1d2a45. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. the Hero: a small paper-cut figurine of a young man with short dark hair, warm friendly eyes and a slight smile, wearing a simple forest-green tunic with rolled sleeves, brown trousers and boots, a leather satchel across his chest, holding a faintly glowing golden quill, flanked by two smaller apprentice paper figurines, all three gathered around a table of unrolled paper plans and looking down at them together; isolated group, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## ch6-foreground — 1536×1024

*Chapter VI — The Northern Treasury — foreground layer*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: pine #2e5244, aurora teal #4fd6b8, aurora violet #8a6fd6, night navy #1d2a45. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. foreground fringe strip: snow-dusted pine branches and a scatter of pinecones along a stone ledge; isolated strip, transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
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

## end-letter — 1024×1024

*The End — folded letter*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: seal burgundy #641e26, slate #5a6470. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. a folded parchment letter sealed with a burgundy wax seal stamped with a small dragon crest, one corner gently curled; isolated on transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## end-raven — 1024×1024

*The End — raven messenger*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: seal burgundy #641e26, slate #5a6470. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. a paper raven in flight with wings spread, carrying a small rolled letter in its beak; isolated on transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```

## back-crest — 1024×1024

*Back cover — small crest*

```
Handmade paper-craft illustration for an artisanal fantasy pop-up book. Everything is cut from matte construction paper and cardstock: visible paper grain, crisp die-cut edges, layered flat shapes with subtle soft shadows between paper layers. Whimsical storybook fairy-tale shapes, charming and warm, like a children's book made by a master paper artist. Muted earthy palette anchored on aged parchment cream #E7D5A8, warm sepia #3B2A1A, and antique gold #C9A227, plus these scene accents: leather burgundy #641e26, antique gold #c9a227. Flat matte lighting as if photographed on a copy stand under soft warm light. No text or letters anywhere. No photorealism, no 3D-render look, no glossy digital gradients, no airbrush. small circular heraldic dragon crest medallion, simpler than the front cover crest, antique gold foil paper with a coiled dragon motif; isolated on transparent background. Isolated on a fully transparent background (transparent PNG, no background fill). If transparency is not possible: place the isolated subject on a solid uniform pure magenta #FF00FF background that touches nothing else. Reject if: glossy 3D render look, airbrushed gradients, photoreal texture, or any text/letters appear anywhere in the image.
```
