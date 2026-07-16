# Small World — Asset Manifest (for Aram)

Everything the lab needs from generation runs, with paste-ready prompts.
All assets are **optional at runtime**: the lab renders with a proxy
character and placeholder panels until files land, gated by
`components/labs/small-world/art-manifest.ts` (no 404 noise). Deliver files
to the exact paths below, then tell the session — it flips the manifest
entry and integrates.

Research this distills: `2026-07-16-small-world-meshy-pipeline.md`,
`2026-07-16-small-world-animation-retarget.md`.

---

## 1. The girl — turnaround sheet (ChatGPT)

Paste as-is. If the four views drift (outfit/proportions changing between
panels — the most common failure), regenerate rather than accepting drift;
consistency matters more than any single panel's beauty.

> Production character reference sheet, four views in a clean grid: front,
> three-quarter, side profile, back. The SAME character in every panel: a
> cheerful cartoon girl in the chunky rounded style of Pixar's Turning Red —
> big round head, large expressive eyes, short stocky limbs, bold simple
> shapes, soft clay-like surfaces. Dark bob haircut with a small pink flower
> clip. Outfit, identical in all four views: meadow-green spring dress
> (hex #7BC47F) with a small pink blossom print (hex #F7A8C4), white
> sneakers, blush-pink socks. Neutral A-pose: arms slightly out from the
> body, relaxed open hands, straight posture, feet together at hip width.
> Flat even studio lighting, no cast shadows, plain light-grey background,
> no props, full body fully visible in every panel, consistent proportions
> and outfit across all views. Clean 3D-render-style cel shading.

- Size: 1536×1024 (landscape grid) or one 1024×1536 per view — whichever
  ChatGPT keeps most consistent for you.
- Check before proceeding: hands have five fingers per hand in the sheet
  (Meshy inherits and worsens hand errors), and the silhouette reads
  "chunky-cute" — Meshy tends to flatten exaggeration, so the sheet should
  overshoot the chunkiness slightly.

## 2. The girl — Meshy pipeline (~48 credits)

1. **Image-to-3D**: Meshy-6 model, texture ON, multi-image input — feed the
   front + side + back (+ three-quarter) panels (~30 credits).
2. **Remesh** (1 credit) if the result is high-poly/irregular — auto-rig
   quality degrades badly on messy AI topology.
3. **Auto-Rig** (5 credits): Humanoid preset, model centered at origin,
   facing forward, **feet at Y=0**. Inspect shoulders/hips skinning — chunky
   proportions are Meshy's documented rig weak spot.
4. **Animate** (3 credits/clip) — four clips from the preset library:
   - skip cycle → search the library for "skip"; fallback `Hop_with_Arms_Raised`
     (happy bouncing hop). This clip is the lab's metronome — pick the one
     that reads joyful-skip, not athletic-jump.
   - idle → `Idle` (a calm variant, minimal foot movement)
   - discovery → a joyful jump/cheer variant (search "jump", "cheer", "excited")
   - wave → `Wave_One_Hand` or `Big_Wave_Hello`
5. **Export GLB** (single file, mesh + textures + skeleton + all clips
   embedded) → deliver to `public/labs/small-world/girl.glb`.
6. Note down the clip names as exported — the code binds them by name.

**If the Meshy mesh loses the chunky look** (flattened proportions,
over-detailed surface — its documented stylized-character weakness): stop
after step 1 and say so. Plan B is wired up on our side: we generate the
mesh with Hunyuan3D through the Blender MCP (better cartoon-shape
preservation), then you import that mesh into Meshy only for rig + animate +
export (Meshy accepts GLB/FBX imports as rig input).

## 3. Fallback animation lane — Mixamo round trip

Only if Meshy's animation clips disappoint at Gate 0:

1. Upload the (unrigged) mesh GLB/FBX to mixamo.com — Mixamo auto-rigs it.
2. Search clips: try "skip", "hop", "joyful jump", "cheer", "excited",
   "waving". (Exact catalog names couldn't be verified from outside the
   login wall — this UI search is the action item.)
3. Download each clip **with "In Place" checked** (kills root motion at the
   source) as FBX, same skeleton.
4. Hand us the files — we convert/merge to one GLB in Blender and bind the
   same clip names.

## 4. Comic panels (ChatGPT), one per chapter to start

Six art panels, portrait **1024×1536**, PNG, delivered to
`public/labs/small-world/panels/<chapter-id>-1.png`. The typeset data panel
(role/company/tech as styled HTML) is built in code — you only generate the
art moment. Shared style block — paste this before each subject line:

> Manga/comic action panel, thick black ink outlines, visible halftone dot
> shading, flat cel colors from a fixed palette: meadow green #7BC47F,
> blossom pink #F7A8C4, river blue #6FB7D9, butter-cream #FFF3D6, clay
> terracotta #D98E6A, ink #2B2B33. The recurring heroine: a cheerful chunky
> cartoon girl (Turning Red style), dark bob with pink flower clip,
> meadow-green spring dress with pink blossom print. Joyful discovery
> energy, radial speed lines where noted, generous margins safe to crop,
> no text or lettering anywhere in the image.

Per-chapter subject lines:

1. **bluenet** (`panels/bluenet-1.png`): The heroine kneels on tiny clay
   planet grass discovering a glowing sprouting seedling, radial speed
   lines, a small clay hotel with a reception bell on the hill behind her —
   the moment a marketer becomes a developer.
2. **flyerbee** (`panels/flyerbee-1.png`): The heroine rides/runs a winding
   clay path chased playfully by fat round clay bees carrying tiny parcels,
   beehive and pink flowers around — her first mobile app built from zero.
3. **360dialog** (`panels/360dialog-1.png`): The heroine hops across
   message-bubble-shaped stepping stones over a wide blue clay river delta
   while carrier birds stream overhead in the thousands — messages at
   planetary scale.
4. **accenture** (`panels/accenture-1.png`): The heroine stands amazed on
   warm golden clay dunes before a geometric bank facade with a palm tree,
   heat shimmer speed lines — banking for one of the Middle East's largest
   banks.
5. **akna** (`panels/akna-1.png`): The heroine stacks glowing modular clay
   blocks into a market-street building, other block-buildings in pink tuff
   stone behind — architecture and component libraries.
6. **xdatagroup** (`panels/xdatagroup-1.png`): The heroine at the blossom
   summit at golden hour, pink trees in full bloom, opening a small round
   vault door set into the hillside with light pouring out — building a
   bank, mentoring the next climbers.

## 5. Delivery checklist

- [ ] `public/labs/small-world/girl.glb` (rigged, 4 clips embedded; note clip names)
- [ ] `public/labs/small-world/panels/bluenet-1.png`
- [ ] `public/labs/small-world/panels/flyerbee-1.png`
- [ ] `public/labs/small-world/panels/360dialog-1.png`
- [ ] `public/labs/small-world/panels/accenture-1.png`
- [ ] `public/labs/small-world/panels/akna-1.png`
- [ ] `public/labs/small-world/panels/xdatagroup-1.png`

Storybook-lab lesson that applies here: export via the download button, not
right-click-save (right-click-save flattens alpha and resizes). Panels are
full-bleed art so alpha doesn't matter for them, but it will for any die-cut
props we ask for later. The planet, terrain, and clay props are NOT on your
plate — they're built procedurally / via Blender MCP on our side.
