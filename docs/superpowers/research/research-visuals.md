# Journey / Alto-grade visuals in a browser snowboard game

Research brief: replace a flat-color canvas-2D snowboard game (currently "cheap 2000s flash")
with something in the visual league of *Alto's Adventure* and *Journey*. Target project is a
Next.js 15 / React 19 app that already ships three.js + react-three-fiber elsewhere and has a
custom canvas-2D engine driving the current game.

TL;DR recommendation: **Rich 2D is the right route for this project.** Alto's premium look is
almost entirely 2D-compositing tricks (gradient light, layered silhouettes, particles, a trailing
scarf) that map cleanly onto your existing canvas engine and keep your working physics. Journey's
sand shimmer is a genuinely 3D shader effect that does *not* transfer to a side-scroller — but its
*atmosphere ingredients* (time-of-day gradient light, haze-based depth, rim light, restrained
palette) are the same ideas Alto uses and are all achievable in 2D. Full stylized-3D is a rewrite
that throws away your engine to buy depth a side-view snowboarder doesn't need. See §5.

---

## 1. What actually makes Journey & Alto look premium (named ingredients)

Both games get their quality from the **same small set of ingredients**, not from raw detail.
The recurring lesson from both dev breakdowns is *stack several cheap effects rather than compute
one expensive one*, and *ruthless minimalism so every element reads*.

### Alto's Adventure (Harry Nesbitt, sole artist+programmer; Unity; ~18 months)
- **Watercolor gradient palette.** "Colors and gradients flow into one another" — the whole scene
  is built from smooth gradient fills, not textures. This is the single biggest reason it doesn't
  look like flat-color flash.
- **Layered silhouette parallax.** Foreground terrain, mid-ground hills, distant mountain ranges,
  and sky are separate layers at decreasing contrast and increasing haze, moving at different
  speeds → depth from overlap + atmospheric perspective, no 3D.
- **Continuous time-of-day + weather.** "The mountain is procedurally generated and the weather and
  time of day are always changing." Sky gradient, layer tint, and light direction interpolate over
  a day/night cycle; fog, snow, rain, rainbows-after-rain, lightning are additive systems.
- **Legibility-first night design.** "All important elements are given a glowing color or a distinct
  silhouette to remain legible at night" — campfires, lanterns, and lit windows become the light
  sources at night; gameplay objects glow.
- **Ambient life ("living, breathing world").** Paper lanterns drifting across the horizon, birds
  scattering out of trees, fireflies at dusk, shooting stars. Cheap per-instance sprites that sell
  atmosphere far beyond their cost.
- **Minimalism as a rule.** The team deliberately avoided the "cartoon-y" mobile look and cut detail
  down to only what's emotionally load-bearing. Restraint is the aesthetic.
- Sources: [Harry Nesbitt – The Making of Alto's Adventure](http://www.harrynesbitt.com/blog/the-making-of-altos-adventure/),
  [80.lv – A Game With Style](https://80.lv/articles/altos-adventure-a-game-with-style),
  [Team Alto Q&A](https://umatechnology.org/exclusive-qa-with-team-alto-the-people-behind-altos-odyssey-and-altos-adventure/),
  [Game Developer case study](https://www.gamedeveloper.com/design/alto-s-adventure-case-study),
  [Snowman press sheet](https://www.builtbysnowman.com/press/sheet.php?p=altos_adventure).

### Journey (thatgamecompany; John Edwards, "Sand Rendering in Journey", GDC 2013)
The famous sand is **six layered shader effects**, each individually simple:
1. **Diffuse (Lambertian)** — matte base color, the gradient shading foundation. Cheap.
2. **Sand normal (bump mapping)** — grain detail via normal perturbation, no extra geometry. Cheap.
3. **Rim light (Fresnel)** — "subtle shimmering only visible on the edge of a dune"; separates
   dunes/silhouettes against the sky. Cheap, high impact.
4. **Ocean specular (Blinn-Phong)** — water-like glints that make sand feel *fluid*. Moderate.
5. **Glitter reflection** — random per-grain sparkle, present even in shadow; the "magic". Moderate.
6. **Sand ripples** — wind-pattern texture blended by slope/orientation. Higher cost.
- Key transferable ideas for 2D: **gradient light + rim light on silhouette edges + a restrained,
  warm, directional palette + tasteful specular/sparkle sparingly**. The per-grain sand shimmer
  itself is 3D-surface-specific and not worth chasing in a side-scroller.
- Sources: [GDC Vault – Sand Rendering in Journey](https://gdcvault.com/play/1017742/Sand-Rendering-in),
  [Slides (PPTX)](https://advances.realtimerendering.com/s2012/thatgamecompany/SandRenderingInJourney_thatgamecompany.pptx),
  [Alan Zucconi – A Journey Into Journey's Sand Shader](https://www.alanzucconi.com/2019/10/08/journey-sand-shader-1/),
  [Talk video](https://www.youtube.com/watch?v=wt2yYnBRD3U).

**The shared formula:** smooth gradient light that changes over time + depth by layered
haze/parallax + rim light on silhouettes + one flowing motion element (Journey's scarf/ribbon,
Alto's scarf) + particulate life + hard minimalism.

---

## 2. Canvas-2D technique inventory

Each: what it buys / how / effort (S = hours, M = a day or two, L = several days) / reference.
This is the route that reuses your existing engine and physics.

| Technique | What it buys | How | Effort | Reference |
|---|---|---|---|---|
| **Multi-stop gradient sky + time-of-day** | The #1 "not-flash" upgrade | `createLinearGradient` with 3-5 stops; keep an array of keyframe palettes (dawn/day/dusk/night) and lerp stop colors by a `timeOfDay` 0..1. Interpolate in **HSL or LAB**, not RGB, to avoid muddy midpoints | S | [MDN createLinearGradient](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createLinearGradient), [color interp in LAB/HSL](https://gamedev.net/forums/topic/691498-color-interpolation-between-orange-and-blue/) |
| **Layered silhouette parallax** | Depth without 3D | 3-5 back-to-front layers (sky, far range, mid hills, near terrain, foreground props); each a filled path at its own scroll speed. Tint distant layers toward the sky color and lower contrast | S–M | [JS parallax canvas tutorial](https://justinjerzak.wordpress.com/2014/05/14/javascript-parallax-scroll-canvas-tutorial/) |
| **Soft haze / atmospheric depth** | Alto's "flow into one another" | Overlay translucent gradient fills between layers (sky-colored, low alpha) rather than blur filters (blur is expensive per-frame). A vertical fog band near the horizon + per-layer alpha does most of the work | S | (compositing; see MDN canvas optimizing) |
| **Procedural terrain (Perlin + spline)** | Smooth infinite alpine slopes | Perlin/simplex noise for coarse height, Catmull-Rom / spline through control points for smooth carve-able curve; fill below the curve with a gradient. Same algorithm Alto uses | M | [Alto-style surface gen gist](https://gist.github.com/josephbk117/123be8038f266601b8798170f42e1193), [bitshiftprogrammer writeup](https://www.bitshiftprogrammer.com/game-dev/altos-adventure-style-procedural) |
| **Rim light on silhouette edges** | Journey's edge shimmer | Redraw the terrain/rider silhouette path with a thin, offset, additive (`lighter`) stroke in the sun's direction/color. Sells directional lighting for near-zero cost | S | [Journey rim light (Fresnel) breakdown](https://www.alanzucconi.com/2019/10/08/journey-sand-shader-1/) |
| **Scarf / ribbon via verlet chain** | The signature flowing element | 20-50 point chain, pin head to rider's neck, 3-4 constraint-relaxation iterations/frame, draw as a tapered stroke or filled ribbon. Gravity + rider velocity feed the motion. Cheap and stable | M | [Pikuma – verlet cloth/rope](https://pikuma.com/blog/verlet-integration-2d-cloth-physics-simulation), [subprotocol/verlet-js](https://github.com/subprotocol/verlet-js) |
| **Procedural rider animation (IK-ish)** | Fluid lean/crouch/grab/spin without sprite sheets | Draw the rider from a few jointed segments; drive lean angle from slope + input, crouch from landing impact, rotation from air time. No frames to author | M–L | (procedural; pairs with skeletal approach in §4) |
| **Carve spray + landing particles** | Kinetic feedback | Small pooled particle system: spawn white/blue soft dots on carve/land, additive blend, short life, gravity + drag. Pre-render one soft-dot sprite to an offscreen canvas and stamp it (avoid `shadowBlur`) | S–M | [MDN optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) |
| **Snow-trail deformation illusion** | Rider "leaves a mark" | Don't deform geometry; draw a fading translucent line/ribbon along the recent path on a persistent trail layer that slowly clears. Reads as carved snow | S | (compositing) |
| **Sun disc + tasteful bloom** | Focal warmth | Radial gradient sun + a couple of large low-alpha additive radial "glow" halos; optional god-ray streaks as low-alpha triangles. Keep alpha low — bloom is where "tasteful" is won or lost | S | (compositing) |
| **Ambient life** | "Living world" | Pooled sprites: drifting lanterns, scattering birds, fireflies, shooting stars, on their own slow layer | S | [80.lv](https://80.lv/articles/altos-adventure-a-game-with-style) |
| **Grain / vignette finish** | Cohesive "art" feel | One pre-rendered noise tile at very low alpha + a radial vignette overlay drawn last | S | (post) |

**Ceiling of the 2D route:** With gradient light + haze parallax + rim light + verlet scarf +
particles + restrained palette, canvas-2D genuinely reaches Alto-grade. What 2D *cannot* do:
true camera rotation, real 3D specular/glitter, and view-dependent lighting on surfaces. For a
side-view snowboarder none of those are needed.

---

## 3. three.js / WebGL route assessment

You already ship three.js + r3f, so the infrastructure cost is zero; the cost is in scene/asset/
character work. Two sub-variants:

**3a. Full stylized 3D (side or 3/4 view)**

| Technique | What it buys | How | Effort |
|---|---|---|---|
| Toon/gradient shading | Cel/gradient-banded look | `MeshToonMaterial` + a custom **gradient map** (X×1 texture, `NearestFilter` on min/mag) for the ramp | S–M |
| Rim light | Journey edge glow | `dot(normal, viewDir)` inverted, added to emissive; standard stylized shader trick | M |
| Fog for depth | Atmospheric perspective | Built-in `THREE.Fog`/`FogExp2` tinted to the sky; note custom shaders must opt into fog | S |
| Low-poly terrain | Stylized slopes | Flat-shaded displaced plane / procedural mesh, follow-camera; terrain-following for the rider is the fiddly part | L |
| Gradient sky | Same as 2D | Full-screen shader/gradient skydome interpolated by time-of-day | S |

References: [MeshToonMaterial docs](https://threejs.org/docs/pages/MeshToonMaterial.html),
[three.js materials manual (gradient map)](https://threejs.org/manual/en/materials.html),
[custom toon shader tutorial](https://www.maya-ndljk.com/blog/threejs-basic-toon-shader),
[snow-fog discourse thread](https://discourse.threejs.org/t/how-to-recreate-realistic-snow-fog-from-example/85951),
[three-runner endless runner](https://github.com/jinpyojeon/three-runner),
[semi-realistic landscapes in the browser](https://nathanpointer.com/blog/landscapes).

Honest complexity vs 2D: **substantially higher.** You'd rewrite the game (camera, terrain
following, collision in 3D, character rig/animation state machine, GLTF pipeline) and gain depth
that a side-scroller doesn't need. This is the right call only if the design wants real 3D
(rotating camera, over-the-shoulder, true parallax through geometry).

**3b. Hybrid — canvas-2D gameplay + a thin WebGL atmosphere layer (recommended if you want extra polish)**

Keep the 2D engine for everything gameplay; render the **sky + haze + bloom + grain** as one
full-screen fragment shader behind (or a post-pass over) the canvas. You get shader-quality
gradients, animated god-rays, and bloom that are awkward in 2D, at the cost of one quad. Low risk
because it doesn't touch physics. Since r3f is already in the bundle, incremental cost is small.

---

## 4. Character / rider animation options compared

Goal: a fluid, elegant rider that leans, crouches, grabs, spins, with a trailing scarf — at
minimum authoring cost (no designer available).

| Option | Fluidity | Cost without a designer | Notes |
|---|---|---|---|
| **Sprite sheet** | Only as good as frames drawn | **High** — must author dozens of frames per action; adding a trick means redrawing | Fine for tiny/pixel characters; wrong choice for varied, fluid tricks. [sprite vs skeletal](https://marionettestudio.com/advantages-and-disadvantages-of-skeletal-versus-sprite-sheet-animations/) |
| **Procedural / code-drawn jointed rig (2D)** | High, physically reactive | **Lowest** — no assets; lean/crouch/spin are math on a few segments; scarf = verlet | Best fit for canvas route. Reuses your engine; motion derives from physics state so it always matches gameplay. Pair with verlet scarf. |
| **2D skeletal (Spine/Spriter/DragonBones)** | Very high, smooth | Medium (tooling + rigging one rig) | "Reuse a single rig for all actions… days to hours." Spine $69–329; Spriter cheap/beginner; **DragonBones free**; Creature does procedural walk/soft-body. Runtime plays into canvas/WebGL. [comparison](https://charios.com/blog/phaser-spritesheet-vs-skeleton-2d), [tools list](https://www.slant.co/topics/588/~best-2d-skeletal-animation-tools) |
| **Rigged GLTF + Mixamo (3D)** | Very high | Medium–High | Only for the 3D route. Mixamo gives free auto-rigged characters + animations; **Kenney** has free (public-domain) rigged/animated modular characters. Needs blend trees / animation state machine. [Kenney assets](https://kenney.nl/assets), [Kenney animated characters](https://kenney-assets.itch.io/animated-characters-3) |

**Recommendation for this project:** procedural 2D jointed rig + verlet scarf. It costs no art
assets, reacts to physics for free (lean from slope, crouch from impact, rotation from air time),
and is exactly the elegant-minimal-rider aesthetic both reference games use. If you later want more
character, a single DragonBones/Spine rig is the cheap upgrade; skip sprite sheets.

---

## 5. Performance constraints (60fps on mid phones, full viewport)

**Canvas-2D (fill-rate bound at full viewport):**
- Biggest cost is overdraw — every translucent layer repaints the whole screen. Keep layers few.
- **Layer/offscreen caching:** render static/slow layers (sky, far ranges) to offscreen canvases
  once and blit; only redraw the dynamic layer each frame. Stacked `<canvas>` or CSS-`background`
  for the static sky removes it from the per-frame budget.
- **Dirty rectangles** cut redraw 70-80% when only part changes — less useful for a scrolling game,
  more useful for HUD.
- **Avoid `shadowBlur` and canvas `text` in the loop** (both very slow) — pre-render soft
  glows/particles as sprites and stamp them; pre-render text.
- Use `requestAnimationFrame`; consider **OffscreenCanvas + web worker** to move rendering off the
  main thread if input jank appears.
- Refs: [MDN Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas),
  [web.dev canvas performance](https://web.dev/articles/canvas-performance),
  [web.dev OffscreenCanvas](https://web.dev/articles/offscreen-canvas).

**WebGL / r3f:**
- Draw calls dominate: **instance** repeated geometry (trees, particles) — "thousands of instances,
  one draw call." Reuse geometries/materials.
- Cap **DPR** (e.g. `dpr={[1, 1.5]}`) and keep **textures 512–1024** on mobile; WebP/KTX2; Draco for
  meshes (~10× smaller).
- Use `frameloop="demand"` where the scene is static; a real case went 20-30 → 45-55 → 60fps after
  offloading. [Krapton R3F mobile deep dive](https://www.krapton.com/blog/boosting-react-three-fiber-mobile-performance-in-2026-a-deep-dive-d6105c),
  [three.js runner FPS capping](https://discourse.threejs.org/t/harmonizing-speed-of-runner-game-on-all-device-cap-fps/45034).

**2D vs WebGL tradeoff:** at full viewport with lots of translucent layering, WebGL wins on
fill-rate (the GPU eats overdraw for breakfast) and on shader effects (bloom, god-rays, gradient
banding). Canvas-2D wins on simplicity, zero asset pipeline, and reuse of your existing engine, and
is *entirely capable of 60fps mid-phone* if you keep layers few and cache static ones. The hybrid
(§3b) gets the best of both.

---

## 6. Final recommendation — rich 2D vs stylized 3D for THIS project

**Go rich 2D (option §2), with the hybrid WebGL atmosphere layer (§3b) as an optional polish pass.**

Why:
1. **You keep a working game.** Your physics/gameplay already exist in the canvas engine; the
   problem is purely the render layer. Rich 2D upgrades the render layer without a rewrite. Stylized
   3D is a rewrite (camera, terrain-following, 3D collision, character rig/state machine, GLTF
   pipeline) for depth a side-view snowboarder doesn't need.
2. **Alto proves the ceiling.** Alto's premium look *is* 2D compositing — gradient light, layered
   silhouettes, haze, particles, a trailing scarf, hard minimalism. Every one of those maps to your
   canvas engine, and the "named ingredients" list in §1 is your build order.
3. **Journey's transferable parts are 2D-friendly.** Time-of-day gradient light, rim light on
   silhouettes, restrained warm palette, one flowing motion element. Its per-grain sand shimmer is
   3D-surface-specific and not worth chasing.
4. **Character cost stays near zero** with a procedural jointed rig + verlet scarf (§4) — no
   designer, no sprite sheets, motion driven by physics.
5. **The hybrid keeps the 3D door open cheaply.** Because r3f is already bundled, adding a
   full-screen shader for sky/haze/bloom/grain is low-risk polish. Only commit to full stylized-3D
   if the design later wants a rotating/over-the-shoulder camera.

**Suggested build order (highest visual ROI first):**
1. Multi-stop gradient sky + time-of-day interpolation (LAB/HSL lerp).
2. Layered silhouette parallax with distance-tinting + haze bands.
3. Restrained palette pass + rim light on rider/terrain silhouettes.
4. Verlet scarf + procedural rider lean/crouch/spin.
5. Carve spray / landing particles (pooled, pre-rendered soft sprite) + fading snow trail.
6. Sun disc + tasteful bloom, ambient life (lanterns/birds/fireflies), grain + vignette finish.
7. (Optional) Move sky/bloom/grain into a WebGL full-screen shader layer for shader-grade polish.

Steps 1-3 alone will move it from "cheap flash" to "clearly crafted"; 4-6 get it into Alto's league.
