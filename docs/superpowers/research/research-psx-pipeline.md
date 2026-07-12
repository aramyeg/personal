# PS1/PSX Rendering Pipeline — Implementation Research

Target: rebuild `/labs/ps1` as a genuine PS1-aesthetic three.js scene (r3f available, zero new deps). This doc catalogs the hardware-derived artifacts that read as "PS1" and gives exact, current, known-good WebGL/three.js recipes for each.

## Non-negotiables (ranked)

If budget is tight, implement in this order — each is diminishing-returns after the one above it:

1. **Affine texture mapping (UV×w trick / `noperspective`)** — the single most recognizable PS1 fingerprint. Without it, everything else reads as "low-poly," not "PS1." Cheap: ~3 lines of shader.
2. **Vertex snapping/jitter to a low-res grid** — the second fingerprint; produces the geometry "wobble" everyone associates with PS1. Also cheap: clip-space floor in vertex shader.
3. **Low internal render resolution (e.g. 320×240 or 480×270) blitted up with `NearestFilter`** — without this, points 1 and 2 look too smooth/subtle. Resolution is what makes jitter and dithering visible instead of imperceptible.
4. **No/flat per-pixel lighting — vertex-baked Gouraud lighting only** — modern PBR specular highlights instantly break the illusion. This is as much a "don't do X" as a "do Y."
5. **Ordered (Bayer) dithering + reduced color depth (~15-bit / 5-bit per channel)** — sells the "old console" feel especially on gradients/fog; moderate cost, high payoff, but subtler than 1–3.
6. **Fog as an art-directed opaque/near cutoff (Silent Hill technique)**, not a modern exponential-height fog — cheap and doubles as a performance + draw-distance-pop cover.
7. **Low-res, low-density point-sampled textures (64–256px, `NearestFilter`, no mipmaps/aniso)** — supports the illusion but is the most "free" win since assets are already low-fi in a stylized lab.
8. **No bloom, no modern AA, no soft shadows** — a failure-mode item as much as a technique: the fastest way to make a PSX shader look "generic retro" is to leave modern post-processing (bloom/SSAO/TAA) turned on. Explicitly disable/avoid.
9. **Optional polish**: polygon-throughput-driven z-sorting quirks, screen-space triangle "popping," CRT/composite blur pass, interlace flicker. Nice-to-have, expensive relative to payoff for a portfolio lab; do last if at all.

---

## 1. Hardware-derived artifact catalog

### 1.1 Vertex snapping / jitter (rank 2)
**Why it happened:** The PS1 GTE (Geometry Transformation Engine) did all vertex math in fixed-point (roughly 16-bit / 4.12 or similar fixed-point formats), and — critically — the rasterizer accepted only **integer screen-space coordinates**, with no subpixel precision. A vertex that should smoothly glide from `(100.2, 50.3)` to `(100.8, 50.7)` snaps from `(100,50)` to `(101,51)` with no in-between. [How-To Geek](https://www.howtogeek.com/why-did-the-playstation-1-have-wobbly-graphics/), [Pikuma](https://pikuma.com/blog/how-to-make-ps1-graphics), [cosmicosmo.co](https://cosmicosmo.co/blog/ps1-graphics)
**What it looks like:** Polygon edges/vertices "swim" or judder in discrete steps as the camera or object moves, most visible on distant/small geometry where the snap grid is coarse relative to triangle size.
**Rank/essentiality:** Very high — this is the #1 or #2 thing people mean when they say "PS1 wobble." Cheap to implement, must not be overdone (real PS1 jitter is subtle at gameplay distances; overdoing it looks like a seasick camera).

### 1.2 Affine (non-perspective-correct) texture mapping (rank 1)
**Why it happened:** After the GTE projects a 3D vertex to 2D screen space, the depth (Z) value was **discarded before rasterization** — the rasterizer/texture-mapping unit had no per-pixel depth to do the two divisions per pixel that perspective-correct interpolation requires (division was extremely expensive on this hardware). So UV coordinates were linearly interpolated in **screen space** across the triangle, ignoring the fact that, in perspective, texture density should compress with distance. [Pikuma](https://pikuma.com/blog/how-to-make-ps1-graphics), [danielilett](https://danielilett.com/2021-11-06-tut5-21-ps1-affine-textures/)
**What it looks like:** Textures on large/oblique polygons (especially floors and walls viewed at a shallow angle) visibly warp, swim, and "bend" as the camera moves — most obvious on textures with straight lines (tile grids, brick courses). Iconic on PS1 floors.
**Mitigation devs used:** Subdividing polygons closer to the camera (more vertices = smaller triangles = less visible affine error per triangle) — see Crash Bandicoot / most late-era PS1 titles. [danielilett](https://danielilett.com/2021-11-06-tut5-21-ps1-affine-textures/)
**Rank/essentiality:** The single highest-value, lowest-cost artifact. Non-negotiable #1.

### 1.3 No Z-buffer — painter's algorithm + Ordering Table (rank 6/9, situational)
**Why it happened:** No hardware Z-buffer existed at all (RAM/cost constrained). Depth sorting was done in software via an **Ordering Table (OT)** — a linked list bucketed by an approximate per-primitive depth (often the *average* Z of the triangle's vertices, computed by the GTE), and primitives were drawn back-to-front (painter's algorithm) into the bucket list. [orbispatches.com](https://orbispatches.com/gaming-faq/did-ps1-have-a-z-buffer), [Pikuma](https://pikuma.com/blog/how-to-make-ps1-graphics)
**What it looks like:** Popping/flickering where triangles momentarily draw in the wrong order (per-triangle average-Z sorting breaks down for large/overlapping/intersecting polygons), most visible with complex overlapping geometry or large flat polygons crossing each other.
**Rank/essentiality:** Low priority to *deliberately* reproduce for a portfolio piece — modern GPUs and three.js use a real depth buffer, and faking Z-fighting/pop-through is fiddly and easily reads as "buggy" rather than "retro" unless very controlled. Skip unless there's a specific set-piece moment (e.g. intentionally sort two overlapping decals wrong for a wink). Not on the non-negotiables list.

### 1.4 15-bit color + ordered dithering (rank 5)
**Why it happened:** The PS1 framebuffer/color path was **15-bit (5-5-5 RGB)**, occasionally with a dithering hardware step to hide the resulting banding, especially on gradients (lighting falloff, fog). [vintageisthenewold](https://www.vintageisthenewold.com/what-is-the-texture-limit-on-ps1/), Pikuma.
**What it looks like:** Visible color banding on smooth gradients if undithered; a fine, regular speckled/checkerboard-like noise pattern (ordered/Bayer dither) breaking up gradients when dithered — very different from film-grain/random noise, it has a structured, grid-aligned look.
**Rank/essentiality:** Medium-high — it's what makes lighting falloff and fog "read" as retro instead of just flat-shaded-modern. Moderate cost (one postprocess pass).

### 1.5 Low-res, point-sampled textures (rank 7)
**Why it happened:** VRAM was 1MB total, shared between framebuffer and textures; a texture page was a 256×256 texel region, and texcoords were only 8-bit, so **no texture could exceed 256×256**; in practice most textures were 128×128 or smaller. No mipmapping in hardware — games faked LOD by hand (subdividing geometry, swapping texture pages) — e.g. Wipeout. Point (nearest) sampling only — no bilinear filtering, giving hard, blocky texel edges. [psx-spx](https://problemkaputt.de/psx-spx.htm), [vintageisthenewold](https://www.vintageisthenewold.com/how-big-were-ps1-textures/)
**What it looks like:** Chunky, low-detail, hard-edged (non-blurred) textures; visible texel grid up close; no smooth mip transitions (textures don't get softer with distance — they alias/shimmer instead, or games swap to a blurrier baked-in low-res version at a hard cut distance).
**Rank/essentiality:** Medium — mostly a content/asset-authoring concern (keep textures small, `NearestFilter`, no mipmaps) rather than a shader technique, but it's close to "free" once you commit to it.

### 1.6 Gouraud/vertex lighting only — baked vertex colors as the era's "lightmaps" (rank 4)
**Why it happened:** No per-pixel lighting hardware. Lighting was computed **once per vertex** (Gouraud shading) and linearly interpolated across the triangle face — visually indistinguishable from simply painting/baking a static light color into each vertex. The PS1 effectively supported only this: "vertex coloring in combination with texture mapping to simulate the effect of lights," often described as a single practical "global light" layer. [Patreon: PlayStation Aesthetics](https://www.patreon.com/jaybeemadethis/posts/overview-of-49375996), [Polycount](https://polycount.com/discussion/74597/vertex-colour-gouraud-shading)
**What it looks like:** Smooth color gradients across low-poly faces (not per-pixel specular highlights or normal-mapped detail); lighting looks "baked in," faceted on low-poly geometry, with visible interpolation banding across large triangles; NO specular sparkle, NO smooth PBR falloff.
**Rank/essentiality:** High — this is a "must avoid" as much as a "must do." A scene lit with modern PBR (roughness/metalness, specular IBL, soft shadows) will look like a modern low-poly game, not PS1, no matter how good the other tricks are. Non-negotiable #4.

### 1.7 Fog / draw-distance pop, art-directed (rank 6)
**Why it happened:** Limited polygon throughput and no efficient way to stream/cull geometry at range meant objects would pop into existence at a fixed draw distance. Fog (a hard or gradient color falloff) was the standard way to hide the pop-in cliff. **Silent Hill** is the canonical example: the PS1 "couldn't continually render the entirety of Silent Hill while the player moved around it... fog was conceived as a mask to conceal the fact that the game was only rendering the environment in the player's close vicinity" — and it became a defining *aesthetic* choice rather than staying an invisible workaround (players disliked the HD remaster's reduced fog). [SUPERJUMP](https://www.superjumpmagazine.com/drafting-through-the-mists/)
**What it looks like:** A flat, often single-color (not physically-based atmospheric-scattering) fog that fully occludes geometry at a fixed radius — visually a hard-ish falloff rather than three.js's default smooth exponential fog "glow." Frequently biased toward a specific mood color (grey/white for Silent Hill, sickly green, etc.) rather than realistic haze blue.
**Rank/essentiality:** Medium-high, and doubles as a real perf win (cull/hide geometry beyond fog distance). Non-negotiable #6.

### 1.8 Output resolution, interlacing, composite-video blur (rank 9, atmosphere-only)
**Why it happened:** Native output was typically **320×240** (or 512×240 in "hi-res" mode for a few titles like Crash Bandicoot; interlaced modes existed up to 640×480 but were rarely used well). Most consumers ran composite or RF video to a CRT, which is inherently blurry/soft and has visible scanlines; the CRT phosphor + composite signal further hid dithering noise and jaggies that would look harsh on a modern flat panel. [ConsoleMods wiki](https://consolemods.org/wiki/PS1:Video_Output_Notes)
**What it looks like:** Soft, low-fi image; scanlines; chroma bleed/blur; that "everything is slightly fuzzy" quality that a lot of "PS1-style" projects skip (rendering crisp low-res pixels on a sharp LCD instead), which is actually a big part of why *real* PS1 footage feels different from a lot of homage shaders.
**Rank/essentiality:** Low-medium and optional — an authentic CRT/composite pass (scanlines + slight blur/chroma-bleed) adds a lot of atmosphere but isn't required for the geometry/texture illusion to read as PS1. Treat as a stretch-goal polish pass, not core.

### 1.9 Other load-bearing details
- **Billboarded sprites for cheap detail** (foliage, particles, distant objects) — common PS1-era trick to add visual complexity without polygon budget. Worth using for e.g. attic dust motes, foliage, distant museum-exterior detail if the ps1 lab has such elements.
- **Skybox tricks / simple flat-color or low-res panoramic skyboxes** rather than physically based sky — keep sky flat/gradient, not a modern HDRI.
- **Screen-space triangle count / polygon budget consciousness** — PS1 scenes are low-poly by necessity; keeping actual geometry low (not just faking it with shaders) reinforces the whole effect and is a performance win too.
- **No anti-aliasing** — hard, aliased polygon edges are part of the look; do not add MSAA/FXAA/TAA.

---

## 2. three.js / WebGL implementation techniques

### 2.1 Vertex snapping — clip-space snap in the vertex shader

Canonical recipe (used across every source found, including the react-three-fiber Codrops tutorial and the three.js forum): after computing clip-space position, divide by `w` to get NDC, snap the X/Y to a coarse grid, then re-multiply by `w` to get back to clip space (so perspective division in the fixed-function pipeline still works correctly afterward).

```glsl
// vertex shader
uniform float uJitterLevel; // e.g. resolution.x/2 or a small grid size like 120–320

vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
gl_Position = projectionMatrix * mvPosition;

gl_Position.xy /= gl_Position.w;                                   // -> NDC
gl_Position.xy = floor(gl_Position.xy * uJitterLevel) / uJitterLevel; // snap
gl_Position.xy *= gl_Position.w;                                    // -> back to clip space
```

Source: [Codrops / Tympanus — "How to Create a PS1-Inspired Jitter Shader with React-Three-Fiber"](https://tympanus.net/codrops/2024/09/03/how-to-create-a-ps1-inspired-jitter-shader-with-react-three-fiber/) (full `onBeforeCompile` integration below); confirmed independently by the general PS1-jitter writeups. [80.lv](https://80.lv/articles/ps1-s-iconic-vertex-jittering-recreated-in-unreal-engine-5), [Superhive/BlenderMarket product notes](https://superhivemarket.com/products/ps1-vertex-snapping-and-jitter)

**Tuning note:** `uJitterLevel` controls grid coarseness — too fine (e.g. matching a 1920px canvas) is imperceptible; too coarse (e.g. 64) looks broken/glitchy rather than "PS1." Values roughly matching your internal low-res render target (see §2.3) — e.g. 160–320 — read as authentic. Consider snapping in view-space distance-scaled steps (closer objects snap less visibly than far ones) if you want to avoid main-character geometry looking too broken.

### 2.2 Affine texture mapping — the UV×w / noperspective emulation

**The core problem:** WebGL/OpenGL's fixed-function interpolation of `varying`/`in` values across a triangle is *always* perspective-correct by default — you cannot simply turn this off per-varying in GLSL ES 1.00/WebGL1 (there is no `noperspective` qualifier in vanilla WebGL1 GLSL). Two known-good ways to defeat it:

**Recipe A — manual "undo the correction" via UV × w / (1/w) trick** (works in WebGL1 and WebGL2, most portable, this is what the three.js community converged on):

```glsl
// vertex shader
varying vec2 vUv;
varying vec4 vPos; // carries w

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vPos = gl_Position;
  vUv = uv * gl_Position.w; // pre-multiply by w
}
```
```glsl
// fragment shader
varying vec2 vUv;
varying vec4 vPos;
uniform sampler2D map;

void main() {
  gl_FragColor = texture2D(map, vUv / vPos.w); // divide back out
}
```
Why this works: the GPU's perspective-correct interpolator normally computes `lerp(uv/w) * w` implicitly for `varying`s. By instead sending `uv*w` as the varying, the hardware's built-in perspective-correct interpolation of *that* value produces a **linearly-interpolated-in-screen-space** result once you divide by the interpolated `w` yourself — i.e., you're using the perspective machinery against itself to cancel it out, landing on plain affine (screen-space-linear) interpolation. Confirmed in the three.js forum thread (multiple working variants, including an even simpler `gl_Position /= gl_Position.w` variant that also works for the position itself). [three.js forum — "Affine Texture Mapping in shader (PS1-style graphics)"](https://discourse.threejs.org/t/affine-texture-mapping-in-shader-ps1-style-graphics/5945)

**Recipe B — `noperspective` qualifier (WebGL2 / GLSL ES 3.00 only)**: GLSL ES 3.00 (WebGL2) *does* support the `noperspective` interpolation qualifier on varyings, which tells the GPU to skip perspective correction natively — cleaner than Recipe A but requires WebGL2 and `#version 300 es` shaders (three.js `RawShaderMaterial`/`ShaderMaterial` with `glslVersion: THREE.GLSL3`):

```glsl
noperspective out vec2 vUv; // vertex shader, GLSL ES 3.00
noperspective in  vec2 vUv; // fragment shader
```
This is the technique named in Daniel Ilett's writeup (HLSL context, Unity, but the qualifier exists in GLSL ES 3.00 too) — "instructs the underlying graphics API to skip the perspective correction step." [danielilett.com](https://danielilett.com/2021-11-06-tut5-21-ps1-affine-textures/)

**Recommendation for this project:** use Recipe A (UV×w). It's WebGL1-safe, works with `onBeforeCompile` patches against any three.js material (no need to force GLSL3/`RawShaderMaterial` scene-wide), and is the version most examples converge on.

**Mitigate over-warping:** subdivide large/close-up planes (floors especially) into a grid of smaller triangles — this was the actual PS1-developer mitigation and directly reduces perceived warp per-triangle without touching the shader. [danielilett.com](https://danielilett.com/2021-11-06-tut5-21-ps1-affine-textures/)

### 2.3 Low internal resolution — render-to-target + NearestFilter upscale

Standard three.js/r3f pattern: render the scene into a `WebGLRenderTarget` sized at PS1-ish resolution (e.g. 320×240, or a wider modern-aspect equivalent like 426×240 / 480×270 to avoid pillarboxing on wide viewports), then blit that target's texture to the screen-size canvas through a full-screen pass using `NearestFilter` (point sampling) so the upscale is blocky, not blurred.

```js
const renderTarget = new THREE.WebGLRenderTarget(320, 240, {
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  // depthBuffer/stencilBuffer true if needed
});

// render loop:
renderer.setRenderTarget(renderTarget);
renderer.render(scene, camera);
renderer.setRenderTarget(null);
// then draw renderTarget.texture to a full-screen quad/plane with NearestFilter,
// or run it through an EffectComposer pass chain (dither, etc.) before the final blit.
```

This matches the officially documented approach for pixelation-style postprocessing in three.js: reduced-resolution `WebGLRenderTarget` + `NearestFilter` for magnification, chained through `EffectComposer`. Three.js ships a first-party example doing exactly this (`webgl_postprocessing_pixel`, by Kody King) that's worth using as a structural reference even though it's framed as "pixelation" rather than "PSX," since the render-small/blit-nearest mechanism is identical. [three.js example](https://threejs.org/examples/webgl_postprocessing_pixel.html), [discourse thread confirming the RT+NearestFilter pattern](https://discourse.threejs.org/t/postprocessing-adds-a-lot-of-pixelation/55813)

**Why this matters more than it sounds:** vertex snapping (§2.1) and dithering (§2.4) are both *far* more visible and "authentic" at low resolution — the same jitter amount that looks subtle/pointless at 1920×1080 looks correct at 320×240 upscaled. Do this before tuning jitter/dither magnitudes.

**r3f-specific integration:** Use `@react-three/fiber`'s manual render control (`frameloop="never"` + custom `useFrame` render calls) or drei's `RenderTexture`/postprocessing helpers, or hand-roll with `useThree(({gl, scene, camera}) => ...)` inside `useFrame` to control the render-target/composer pipeline directly — needed because r3f's default render loop renders straight to the canvas at full res.

### 2.4 Dithering + color quantization — ordered Bayer post pass

Full-screen fragment shader pass (after the low-res render, before or as part of the final upscale blit). Canonical 4×4 Bayer matrix and combined quantize+dither, confirmed via Maxime Heckel's dithering writeup (this pattern — bias-then-quantize — matches the general ordered-dithering algorithm and other independent GLSL Bayer implementations like `hughsk/glsl-dither`):

```glsl
const mat4 bayerMatrix4x4 = mat4(
   0.0,  8.0,  2.0, 10.0,
  12.0,  4.0, 14.0,  6.0,
   3.0, 11.0,  1.0,  9.0,
  15.0,  7.0, 13.0,  5.0
) / 16.0;

uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float colorLevels; // e.g. 5.0-8.0 per channel to emulate 5-bit-ish color

varying vec2 vUv;

void main() {
  vec3 color = texture2D(tDiffuse, vUv).rgb;

  int x = int(mod(gl_FragCoord.x, 4.0));
  int y = int(mod(gl_FragCoord.y, 4.0));
  float threshold = bayerMatrix4x4[y][x] - 0.5; // center around 0

  color += threshold / colorLevels; // bias by dither pattern before quantizing
  color = floor(color * colorLevels + 0.5) / colorLevels; // quantize (PS1 ~15-bit: ~5 bits/channel)

  gl_FragColor = vec4(color, 1.0);
}
```
Source pattern: [Maxime Heckel — "The Art of Dithering and Retro Shading for the Web"](https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/) (gives both the luminance-threshold binary-dither variant and the multi-level quantize+dither variant — use the quantize variant for PS1, the pure luminance one is more for 1-bit/monochrome looks). Also cross-referenced: [hughsk/glsl-dither (npm/GitHub)](https://github.com/hughsk/glsl-dither), [devlog-martinsh GLSL dithering writeup](http://devlog-martinsh.blogspot.com/2011/03/glsl-dithering.html), [Landon Ferguson — Bayer dithering for a horror game](https://www.landonferguson.com/posts/post03/).

**Important gotcha — run dithering in the correct color space.** Three.js's `ColorManagement`/linear workflow means textures/lighting are computed in linear space internally and converted to sRGB only at output; if you quantize/dither in linear space the banding steps will be perceptually uneven (linear math ≠ how the eye perceives brightness steps). Do the dither/quantize pass **after** tone-mapping/sRGB conversion, i.e. as the very last full-screen pass operating on already-sRGB-encoded color, or explicitly convert with the sRGB transfer function before quantizing. This mirrors a known three.js community discussion point that "material dither... helps with color banding" specifically because of this ordering. [three.js forum — sRGB texture encoding / banding discussion](https://discourse.threejs.org/t/srgb-texture-encoding-gives-color-banding-issue/13855)

### 2.5 Per-vertex (Gouraud) lighting in three.js

Three built-in materials are all effectively per-pixel (Phong/Standard/Physical interpolate normals and compute lighting in the fragment shader). To get true per-vertex lighting cheaply:

- **Easiest:** `MeshLambertMaterial` — three.js documents this as computing lighting **only at vertices, then interpolating** (unlike Phong/Standard which light per-fragment) — i.e., it's already the closest built-in match to PS1 Gouraud shading. Cross-check this against current three.js docs before relying on it, but this has been Lambert's documented behavior historically and is the natural zero-shader-code starting point.
- **Full control:** custom `ShaderMaterial`/`onBeforeCompile` that computes lighting in the **vertex shader** and passes a single interpolated `vColor` varying straight to `gl_FragColor` in the fragment shader (no normal-map/specular sampling in the fragment stage at all). This is the "baked vertex colors" approach and is the most authentic since it matches how PS1 assets actually stored lighting.
- Either way: strip specular entirely, keep roughness/metalness workflows out of the pipeline for this material, and consider baking a slight ambient/rim term into the vertex color rather than relying on real-time multi-light PBR sums.

### 2.6 Fog — Silent-Hill-style hard falloff vs three.js default

Three.js ships `THREE.Fog` (linear, near/far) and `THREE.FogExp2` (exponential) as **scene-level, per-pixel-computed** fog — both are already reasonably close to "PS1 fog" in mechanism (a distance-based blend to a flat fog color, computed cheaply), which is good news: you likely don't need a custom shader here, just aggressive tuning:
- Use `THREE.Fog` (linear) with a **tight near/far range** so the falloff reads as a fairly hard cutoff rather than a soft atmospheric gradient — real PS1 fog was tuned to fully hide the draw-distance cliff, not to look photorealistically hazy.
- Pick a **flat, mood-driven fog color** (not realistic sky-haze blue/grey) — Silent Hill's grey-white, or something bespoke to the lab's palette.
- Combine with **object-level far-plane culling/pop** slightly *inside* the fog's fully-opaque distance so nothing is ever seen popping in — this is the actual mechanism the original games relied on. [SUPERJUMP — Silent Hill fog](https://www.superjumpmagazine.com/drafting-through-the-mists/)
- If per-object vertex-fog (rather than smooth per-pixel) is wanted for extra authenticity (fog computed at vertices like lighting, producing slightly faceted fog gradients on low-poly geometry), that requires a custom vertex-shader fog factor passed as a varying — straightforward to bolt onto the same `onBeforeCompile` patch used for jitter/affine mapping.

### 2.7 Known existing shader packs (for technique reference, not as a dependency)
None of these should be installed (zero new deps), but they're useful references for technique validation:
- **`dsoft20/psx_retroshader`** (Unity, MIT, GLSL-based) — unlit/vertex-lit/transparent/reflective PSX shader variants plus a posterize image-effect script; explicitly documents needing subdivided meshes to control affine warp, and drives fog/distortion from engine fog settings and vertex alpha. Good cross-check for the "vertex-lit + affine + posterize" combo. [GitHub](https://github.com/dsoft20/psx_retroshader)
- **Daniel Ilett's "Retro Shaders Pro"** (commercial Unity asset) — comprehensive reference for the *full* feature set a "serious" PSX/retro shader pack covers: vertex snapping (configurable snap density, view/world/object space), `noperspective`-based affine mapping, bit-depth color reduction with Bayer dithering (texel- or screen-space), texel-aligned shadows via `ddx`/`ddy`, Gouraud vs flat shading toggle, and a separate CRT postprocess stack (resolution scaling, interlacing, scanlines, palette approximation, VHS distortion). Useful as a checklist of "what a AAA-quality PSX shader pack considers in scope" even though this project will hand-roll a subset. [danielilett.com breakdown](https://danielilett.com/2026-01-27-article-retro-1-5-1-update/)
- No maintained "three-psx" or equivalent turnkey npm package was found — confirms hand-rolling via `onBeforeCompile` is the standard/expected approach in the three.js ecosystem (every first-party writeup found, including the Codrops r3f tutorial and the three.js forum thread, hand-rolls it the same way).

---

## 3. Performance + react-three-fiber integration notes

- **Render-to-low-res-target-then-blit** (§2.3) is itself a significant perf win, not just a look — fewer fragment-shader invocations for the main scene pass. Do the dither/quantize pass at the *low* internal resolution too (before the final nearest-neighbor upscale blit) — running it at full screen resolution wastes work and produces a finer, less authentic dither grain.
- **`onBeforeCompile` vs `ShaderMaterial`:** For patching jitter+affine mapping onto otherwise-standard materials (so lighting/shadows/skinning "just work"), `onBeforeCompile` on `MeshLambertMaterial`/`MeshStandardMaterial` is the pragmatic choice — confirmed pattern in the Codrops r3f tutorial. Watch two documented gotchas:
  - **Shader cache collisions:** three.js caches compiled programs by a hash that includes the `onBeforeCompile` function's *source text* — if multiple materials use structurally-identical `onBeforeCompile` closures but are meant to differ only by uniform value (e.g. different `uJitterLevel` per mesh), they can collide and only one program gets compiled/used. Fix: set a distinct `material.customProgramCacheKey = () => 'ps1-' + jitterLevel` (or similar) per variant, or route the varying value through a `uniform` (uniforms don't need separate programs) rather than a compiled-in constant — the Codrops recipe already does this correctly by using a `uJitterLevel` **uniform**, not a baked constant, which is the right pattern to copy. [three.js forum — onBeforeCompile cache conflicts](https://github.com/mrdoob/three.js/issues/19377), [Material.customProgramCacheKey docs](https://threejs.org/docs/#api/en/materials/Material.customProgramCacheKey)
  - **Chaining multiple `onBeforeCompile` patches** (e.g. jitter + affine mapping + vertex fog on the same material) is possible as long as each patch touches a distinct shader chunk (`project_vertex`, the UV chunk, fog chunk) — if two patches both try to rewrite the same `#include`, later ones can clobber earlier ones; write patches as ordered, chunk-scoped string replacements and test combinations explicitly.
- **For simpler/self-contained materials** (e.g. a floor material that needs full custom vertex/fragment logic and doesn't need PBR lighting at all) a plain `ShaderMaterial`/`RawShaderMaterial` is more maintainable than fighting `onBeforeCompile` — "if you find yourself lost in a patchMap, just make a ShaderMaterial."
- **sRGB pipeline order-of-operations** (repeated from §2.4 because it's easy to get backwards): quantize/dither *after* tone-mapping and color-space conversion, not on linear HDR values, or the banding steps will be perceptually wrong. Also make sure `renderer.outputColorSpace = THREE.SRGBColorSpace` (current three.js API) is set as expected and that the low-res render target's texture is read with the correct color space when blitted, since render targets default to `NoColorSpace`/linear unless configured.
- **Text at low internal resolution:** Rendering DOM/HTML-quality vector text into a 320×240-ish internal target will look wrong (either invisible-thin or blurry-oversized) — use a **bitmap-font texture atlas** (pre-rasterized pixel font, nearest-sampled, one quad per glyph) rather than a `canvas`-texture of a scalable font or 3D `TextGeometry`. This also matches how PS1 games actually rendered UI text (fixed low-res glyph sheets). If dynamic text is unavoidable, pre-render the `canvas` text at a *fixed small pixel size matching the internal resolution* (not devicePixelRatio-scaled) so it snaps to the same texel grid as everything else, then sample with `NearestFilter`. [CSS-Tricks — Techniques for Rendering Text with WebGL](https://css-tricks.com/techniques-for-rendering-text-with-webgl/), [songho.ca WebGL bitmap font](https://songho.ca/webgl/webgl_font.html)
- **`frameloop`/render control in r3f:** default r3f auto-render goes straight to the canvas; to insert the low-res-target → dither → upscale pipeline you need either drei's postprocessing helpers driving an `EffectComposer`, or manual control via `gl.setRenderTarget()` inside a `useFrame` callback with `frameloop="never"` and your own `invalidate()`/render-loop driving, or `<Canvas frameloop="always">` with a custom render function passed to `gl` — pick based on whether other parts of the lab need r3f's default declarative render loop.

---

## 4. Common failure modes (why many "PSX-style" attempts read as generic-retro, not PS1)

1. **Skipping affine mapping entirely** and relying only on low-poly + pixelation. Reads as "low-poly indie," not PS1 — the texture-warp fingerprint is what's actually diagnostic. (Confirmed as the single most-cited omission across sources.)
2. **Modern lighting left in** — PBR specular highlights, soft shadows, SSAO, or even just per-pixel Phong specular on a "PS1-style" mesh instantly signals modern rendering underneath a coat of paint. Must commit to flat/Gouraud-only lighting, including on the fragment stage doing *nothing* but sampling the interpolated vertex color/texture.
3. **Bloom / modern post left on.** Any HDR bloom, chromatic aberration tuned for "cinematic" rather than CRT-artifact reasons, or physically-based tonemapping (ACES filmic etc.) reads as contemporary. If any bloom is used at all, it should be crude/blocky, not the smooth modern kind.
4. **Jitter/dither tuned for full HD instead of low internal resolution** — as noted in §2.3, these artifacts need to be visible at the *actual* render resolution; applying a subtle jitter to a crisp 1080p render looks like a bug, not a style, because it's imperceptible relative to pixel density. Fix ordering: nail internal resolution first, then tune jitter/dither amounts against it.
5. **Overly clean/dense textures.** High-res, tiled, PBR-authored (albedo+normal+roughness) textures — even if nearest-sampled — don't match PS1 texture density. Keep textures genuinely low-res (64–256px) and hand-authored/flat-shaded looking; avoid normal maps entirely (PS1 had none).
6. **Smooth/cinematic camera work.** PS1-era games (fixed camera angles, tank controls, or simple/abrupt cuts) had camera behavior as much a part of the aesthetic as the rendering. A smooth modern orbit-controls camera undercuts the illusion; consider deliberately limited/fixed camera framing per "room" if the lab format allows it (matches the museum/labs framing already used elsewhere in this project).
7. **Over-implementing z-fighting/pop-through** (§1.3) as a "feature" — this usually just reads as broken rendering to a modern viewer who has no nostalgic context for OT-sorting quirks, unlike jitter/affine-warp which read as charmingly retro. Skip unless very deliberately staged.
8. **Anti-aliasing left on** (MSAA/FXAA/TAA) — smooths exactly the jagged edges that are part of the identity. Render the low-res target without AA and let the nearest-neighbor upscale provide the "look," don't fight it with a smoothing pass.

---

## Summary of sources
- [Pikuma — How PlayStation Graphics & Visual Artefacts Work](https://pikuma.com/blog/how-to-make-ps1-graphics)
- [How-To Geek — Why Did the PlayStation 1 Have Wobbly Graphics?](https://www.howtogeek.com/why-did-the-playstation-1-have-wobbly-graphics/)
- [cosmicosmo.co — Fixed-Point Math and Why Your Childhood Looked Unstable](https://cosmicosmo.co/blog/ps1-graphics)
- [Daniel Ilett — PlayStation 1 Affine Texture Mapping in Shader Code](https://danielilett.com/2021-11-06-tut5-21-ps1-affine-textures/)
- [Daniel Ilett — Retro Shaders Pro technical breakdown](https://danielilett.com/2026-01-27-article-retro-1-5-1-update/)
- [three.js forum — Affine Texture Mapping in shader (PS1-style graphics)](https://discourse.threejs.org/t/affine-texture-mapping-in-shader-ps1-style-graphics/5945)
- [Codrops/Tympanus — How to Create a PS1-Inspired Jitter Shader with React-Three-Fiber](https://tympanus.net/codrops/2024/09/03/how-to-create-a-ps1-inspired-jitter-shader-with-react-three-fiber/)
- [Roman Liutikov — PS1 style graphics in Three.js](https://romanliutikov.com/blog/ps1-style-graphics-in-threejs) (fetch blocked by host; referenced via search snippet only)
- [James Hawk — Rendering in Playstation 1 style in OpenGL](https://www.hawkjames.com/indiedev/update/2022/06/02/rendering-ps1.html) (fetch blocked by host; referenced via search snippet only)
- [80.lv — PS1's Iconic Vertex Jittering Recreated In Unreal Engine 5](https://80.lv/articles/ps1-s-iconic-vertex-jittering-recreated-in-unreal-engine-5)
- [orbispatches.com — Did PS1 have a Z buffer?](https://orbispatches.com/gaming-faq/did-ps1-have-a-z-buffer)
- [PSXSPX Specifications](https://problemkaputt.de/psx-spx.htm)
- [vintageisthenewold — What is the texture limit on PS1? / How big were PS1 textures?](https://www.vintageisthenewold.com/what-is-the-texture-limit-on-ps1/)
- [Patreon — An Overview of PlayStation Aesthetics](https://www.patreon.com/jaybeemadethis/posts/overview-of-49375996)
- [Polycount — Vertex colour = Gouraud shading?](https://polycount.com/discussion/74597/vertex-colour-gouraud-shading)
- [SUPERJUMP — Through Mist, Light, and Darkness (Silent Hill fog)](https://www.superjumpmagazine.com/drafting-through-the-mists/)
- [ConsoleMods wiki — PS1 Video Output Notes](https://consolemods.org/wiki/PS1:Video_Output_Notes)
- [Maxime Heckel — The Art of Dithering and Retro Shading for the Web](https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/)
- [hughsk/glsl-dither (GitHub)](https://github.com/hughsk/glsl-dither)
- [devlog-martinsh — GLSL dithering](http://devlog-martinsh.blogspot.com/2011/03/glsl-dithering.html)
- [Landon Ferguson — Bayer Matrix Dithering in GLSL for a Horror Game](https://www.landonferguson.com/posts/post03/)
- [three.js example — webgl_postprocessing_pixel](https://threejs.org/examples/webgl_postprocessing_pixel.html)
- [three.js forum — Postprocessing adds a lot of pixelation](https://discourse.threejs.org/t/postprocessing-adds-a-lot-of-pixelation/55813)
- [three.js docs — Material.customProgramCacheKey](https://threejs.org/docs/#api/en/materials/Material.customProgramCacheKey)
- [GitHub issue — Using Material.onBeforeCompile on multiple materials causes cache conflicts](https://github.com/mrdoob/three.js/issues/19377)
- [Medium — Extending three.js materials with GLSL](https://medium.com/@pailhead011/extending-three-js-materials-with-glsl-78ea7bbb9270)
- [three.js manual — Color Management](https://threejs.org/manual/en/color-management.html)
- [three.js forum — sRGB texture encoding gives color banding issue](https://discourse.threejs.org/t/srgb-texture-encoding-gives-color-banding-issue/13855)
- [GitHub — dsoft20/psx_retroshader](https://github.com/dsoft20/psx_retroshader)
- [CSS-Tricks — Techniques for Rendering Text with WebGL](https://css-tricks.com/techniques-for-rendering-text-with-webgl/)
- [songho.ca — WebGL Drawing Bitmap Font](https://songho.ca/webgl/webgl_font.html)
