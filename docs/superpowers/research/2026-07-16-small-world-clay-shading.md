# Clay / Claymation Shading for three.js — Research Notes

## TL;DR recipe

For a "small world" chunky-clay scene, stack these (all r3f-friendly, all cheap):

1. **Base material**: `MeshToonMaterial` with a hand-authored 3-step `gradientMap` (DataTexture, `NearestFilter`) for characters/props that need to react to your scene lights. Use `MeshMatcapMaterial` with a clay LitSphere (from the nidorx matcap library) for hero/static objects where you want zero-lighting-cost, guaranteed-good clay shading and don't need dynamic relighting.
3. **Surface imperfection**: a subtle, tiled fingerprint/smudge grayscale texture wired into `roughnessMap` (and optionally a very low-strength `normalMap`) at low UV scale — this is what actually sells "sculpted by hand" over "cel-shaded plastic."
4. **Outlines**: `<Outlines>` from `@react-three/drei` (inverted-hull) on every toon-shaded mesh — cheapest and most robust for a small number of hero objects; reach for a postprocess outline pass only if you need outlines across dozens of independently-animated meshes and don't want per-mesh geometry overhead.
5. **Grounding**: `<ContactShadows>` from drei under each character/prop cluster, `frames={1}` if the group is static, low `resolution` (256–512) and `blur` 1.5–2 for a soft clay-table shadow.
6. **AO**: bake AO into vertex colors or a lightmap-style second UV channel at build time (Blender bake) and multiply it into the toon ramp lookup — this reads as chunky/sculpted AO without a per-frame SSAO cost. Only add `N8AO`/SSAO postprocessing if you need dynamic AO between moving props.
7. **Terrain**: displace a low-poly icosphere/UV-sphere with **domain-warped, low-octave (2–3 octave) simplex FBM**, `pow()`-shaped to flatten valleys and round peaks, then recompute normals via the **neighbor-sample finite-difference method** in the vertex shader (or `computeVertexNormals()` if you displace on the CPU). Keep frequency low (world-scale features, not per-vertex noise) — that's what keeps it "chunky and sculpted" instead of "noisy."

The common thread: everything here trades dynamic accuracy for a hand-made, low-frequency, high-intentionality look. Every technique below has a knob that controls "how noisy/busy" it reads, and for clay you always turn that knob down.

---

## 1. Toon gradient ramps (`MeshToonMaterial` + `gradientMap`)

`MeshToonMaterial` looks up lighting intensity (N·L, roughly) into a 1D texture (`gradientMap`) instead of shading it smoothly. The texture **must** have `minFilter`/`magFilter` set to `THREE.NearestFilter` or you lose the hard steps and get a smooth gradient back (defeating the point). `gradientMap` is non-color data, so keep `texture.colorSpace = THREE.NoColorSpace` (the default) — don't run it through sRGB.

### 3-step DataTexture (hard toon, classic cel look)

```js
import * as THREE from 'three'

function makeToonRamp(stops: number[]) {
  const data = Uint8Array.from(stops)
  const texture = new THREE.DataTexture(data, stops.length, 1, THREE.RedFormat)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.needsUpdate = true
  return texture
}

// classic hard 3-band toon: shadow / mid / highlight
const threeStepRamp = makeToonRamp([0, 128, 255])

const clayMaterial = new THREE.MeshToonMaterial({
  color: '#e8c9a0',
  gradientMap: threeStepRamp,
})
```

### 4-step ramp with deliberate stop placement (soft vs hard)

Where you place the stops (not just how many) controls softness:

- **Hard toon**: stops bunched near the extremes, e.g. `[0, 0, 255, 255]` — almost no midtone, a crisp light/shadow line. Good for graphic, high-contrast clay characters.
- **Soft toon**: stops spread evenly, e.g. `[0, 85, 170, 255]` — reads closer to a stepped-but-gentle clay fillet, less "plastic toy."

```js
const softClayRamp = makeToonRamp([0, 85, 170, 255])   // even spread, gentle bands
const hardClayRamp = makeToonRamp([0, 0, 255, 255])     // bunched at extremes, crisp cel line
```

react-three-fiber usage:

```jsx
function ClayCharacter() {
  const gradientMap = useMemo(() => {
    const data = Uint8Array.from([0, 85, 170, 255])
    const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat)
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.needsUpdate = true
    return tex
  }, [])

  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshToonMaterial color="#d98c5f" gradientMap={gradientMap} />
    </mesh>
  )
}
```

Practical tip from the three.js community: a single hard step (`smoothstep(0.0, 0.01, NdotL)`) in a **custom** shader gives you the crispest, most "single graphic cel line" look if `MeshToonMaterial`'s texture-lookup granularity feels too soft even at 2 stops — see the custom-shader section below.

## 2. Matcap approach for clay

A matcap ("material capture"/LitSphere) bakes lighting + material response into a single sphere-shaped image, sampled by view-space normal. Zero real lighting cost, guaranteed consistent result, but **the material is baked** — it doesn't relight, cast/receive normal-driven contact shadow detail correctly under moving lights, or respond to scene light color.

**Use matcap when**: hero props are largely static relative to camera/lighting, you want maximum visual polish for near-zero cost, or you're prototyping "does this read as clay" before wiring up real lighting.

**Use MeshToonMaterial (or a custom step-lit shader) when**: objects rotate/move under dynamic lights, need to receive shadows from other objects convincingly, or must match a shared toon look across a whole scene with day/night or colored lighting.

### Where to get clay matcaps

- [nidorx/matcaps](https://github.com/nidorx/matcaps) — huge (641-texture) categorized library, MIT-style, downloadable as `512.zip`/`1024.zip`/etc; browse by category, several are literally labeled "clay"/matte-skin tones. Also mirrored as a searchable tool at [threejsresources.com/tool/matcaps-nidorx](https://threejsresources.com/tool/matcaps-nidorx) and browsable gallery at [observablehq.com/@makio135/matcaps](https://observablehq.com/@makio135/matcaps).
- Nomad Sculpt's community matcap thread ([forum.nomadsculpt.com](https://forum.nomadsculpt.com/t/matcaps-collection/2802)) has sculptor-made clay/wax matcaps that read more "hand-formed" than generic PBR-derived ones — worth cherry-picking a few and re-exporting as compact 256×256 PNGs.

### react-three-fiber usage (drei's `useMatcapTexture`)

```jsx
import { useMatcapTexture } from '@react-three/drei'

function ClayProp() {
  // id from the nidorx catalog, e.g. a warm clay/skin-tone matcap; 256 = enough res for a matcap
  const [matcap] = useMatcapTexture('3A2412_A78B5F_704B29_A69673', 256)

  return (
    <mesh geometry={geo}>
      <meshMatcapMaterial matcap={matcap} color="#e0b98f" />
    </mesh>
  )
}
```

Note `meshMatcapMaterial` still respects vertex colors and a `color` tint multiply, so you can reuse one clay matcap across many prop colors — tint per-instance rather than baking a matcap per color.

## 3. Roughness / fingerprint normal maps for clay imperfection

This is the detail that separates "cel-shaded plastic" from "hand-sculpted clay": real clay/wax has micro-fingerprint ridges and tool marks that scatter specular highlights unevenly. Since toon/matcap materials mostly ignore `roughness` for their core shading, the win here is subtler — either:

- Add a very low-amplitude `normalMap` (fingerprint/smudge texture, tiled, low UV scale) so silhouette edges and any specular/rim term pick up tiny irregularities, or
- If using `MeshStandardMaterial`/`MeshPhysicalMaterial` as a base for some props (not toon-shaded), wire the same texture into `roughnessMap` so highlights aren't perfectly uniform.

Sources for ready-made fingerprint/smudge grayscale maps (roughness-channel-oriented, tileable):

- [TextureCan — Fingerprint Imperfection Texture](https://www.texturecan.com/details/212/) (free PBR set, includes normal + roughness)
- [3dtextures.me — fingerprints tag](https://3dtextures.me/tag/fingerprints/) (free, seamless, several variants)
- Superhive/Blender Market and Gumroad "Hand & Fingerprint Roughness Maps" packs if you want higher-res, curated sets — paid but small and reusable across a whole project.

```jsx
const [fingerprintNormal] = useTexture(['/textures/fingerprint_normal.jpg'])
fingerprintNormal.wrapS = fingerprintNormal.wrapT = THREE.RepeatWrapping
fingerprintNormal.repeat.set(6, 6) // tile small relative to the object — this must read as micro-detail, not a pattern

<meshToonMaterial
  color="#d98c5f"
  gradientMap={softClayRamp}
  normalMap={fingerprintNormal}
  normalScale={new THREE.Vector2(0.15, 0.15)} // keep this LOW — it's a hint, not a bump
/>
```

Keep `normalScale` around 0.1–0.2; anything higher and the fingerprints read as an intentional pattern (basketball-texture) rather than organic noise. This is the one place in the whole recipe where "less" is unambiguously "more."

## 4. Outline techniques

### Inverted hull (drei `<Outlines>`)

`@react-three/drei`'s `<Outlines>` extracts the parent mesh's geometry, extrudes a duplicate slightly along vertex normals, flips it to render only back faces (`THREE.BackSide`), and draws it behind the real mesh — the classic anime/toon "inverted hull" trick. It supports `<mesh>`, `<skinnedMesh>`, and `<instancedMesh>` parents.

Full prop list (from `src/core/Outlines.tsx`):

| Prop | Default | Notes |
|---|---|---|
| `color` | `black` | outline color |
| `thickness` | `0.05` | extrusion distance |
| `screenspace` | `false` | `true` = outline thickness constant in pixels regardless of camera distance; `false` = thickness scales with world units (extrudes along the normal in object space) |
| `opacity` | `1` | |
| `transparent` | `false` | |
| `angle` | `Math.PI` | crease angle for normals; `0` disables creasing (smooth shells only) |
| `polygonOffset` / `polygonOffsetFactor` | `false` / `0` | fights z-fighting on thin outlines |
| `renderOrder` | `0` | |
| `clippingPlanes` | `undefined` | |

```jsx
import { Outlines } from '@react-three/drei'

function ClayCharacterWithOutline() {
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshToonMaterial color="#d98c5f" gradientMap={softClayRamp} />
      <Outlines thickness={0.04} color="#2b1a10" screenspace angle={Math.PI * 0.35} />
    </mesh>
  )
}
```

Set `angle` below `Math.PI` (e.g. ~60–100°, i.e. `Math.PI * 0.35`–`Math.PI * 0.55`) if your geometry has hard creases (like blocky clay-cube terrain) — this prevents the outline shell from smoothing across intentional edges.

**Performance**: cost is one extra draw call + duplicated vertex buffer per outlined mesh — trivial for tens of hero objects, gets expensive if you outline hundreds of small independent meshes (draw call count dominates, not fill rate).

### Postprocess outline (edge/normal/depth-based)

The alternative is a full-screen postprocess pass that finds silhouette edges from the depth+normal buffers (three.js's own [`OutlinePass` example](https://threejs.org/examples/webgl_postprocessing_outline.html), or a custom Sobel-on-depth/normal pass as described in the three.js forum's ["render full outlines as a post process"](https://discourse.threejs.org/t/how-to-render-full-outlines-as-a-post-process-tutorial/22674) tutorial).

**Trade-off**: one full-screen pass regardless of object count (scales with pixels, not meshes) — better when you have many small objects, worse when you need per-object outline color/thickness or crisp outlines at all resolutions (depth/normal-edge detection can double-line or miss thin silhouettes, and needs careful tuning against MSAA/TAA). Inverted-hull outlines are geometrically exact and per-object controllable; postprocess outlines are resolution-dependent and global.

**Recommendation for a "small world" scene**: use inverted-hull (`<Outlines>`) — you likely have a bounded number of hero clay objects (characters, key props, terrain chunks), and per-object color/thickness control plus zero screen-space edge-detection artifacts matters more than the marginal draw-call cost.

## 5. Soft contact shadows under characters

drei's `<ContactShadows>` renders an orthographic top-down shadow catcher into a render target, then blurs it in two passes (horizontal then vertical, optionally twice at reduced intensity when `smooth` is true) — cheap, soft, art-directable shadow that doesn't need real shadow maps.

Full props (from `src/core/ContactShadows.tsx`):

```
opacity = 1
width = 1
height = 1
blur = 1
near = 0
far = 10
resolution = 512
smooth = true
scale = 10
color = '#000000'
depthWrite = false
frames = Infinity
```

```jsx
import { ContactShadows } from '@react-three/drei'

<ContactShadows
  position={[0, -0.01, 0]}
  scale={8}
  resolution={256}
  blur={2}
  far={3}
  opacity={0.6}
  color="#3a2415"       // warm brown, not pure black — reads as clay-table shadow, not a hard cast shadow
  frames={1}            // set to 1 for static clusters; leave Infinity only where objects actually move
/>
```

Use `resolution={256}` and `blur` 1.5–2.5 for the soft, chunky look (higher blur than you'd use for a "realistic" scene — clay wants a soft diffuse shadow, not a sharp contact line). Set `frames={1}` per-cluster wherever that cluster's contents are static; it's explicitly called out as "a rather expensive effect" otherwise since it's a full extra render pass per frame.

## 6. Ambient occlusion for chunky toon scenes

Three options, in order of cost:

1. **Baked AO (cheapest, best fit for toon/clay)**: bake AO in Blender per the [Blender→Three.js baking guide](https://wawasensei.dev/tuto/baking-guide) into either a second-UV-channel `aoMap` (works directly with `MeshToonMaterial.aoMap`, which reads the **red channel** and needs `uv2`) or straight into vertex colors for very low-poly geometry. This is a one-time cost with zero runtime overhead and reads as intentional, chunky shadowing rather than a screen-space halo — matches the "sculpted by hand" aesthetic much better than SSAO's soft photographic gradient.
   ```jsx
   <mesh geometry={geoWithUV2}>
     <meshToonMaterial color="#d98c5f" gradientMap={softClayRamp} aoMap={bakedAO} aoMapIntensity={1} />
   </mesh>
   ```
2. **Vertex-color AO**: for low-poly blocky terrain, bake AO straight into `geometry.attributes.color` (Blender's "bake to vertex colors" or a simple per-vertex raycast at build time) and enable `vertexColors` on the material — no second UV set needed, and it "chunks" naturally with your low-poly silhouette instead of fighting it.
3. **Screen-space (N8AO / SSAO)**: only reach for this if props move independently and baked AO can't track their contact points. [`n8ao`](https://github.com/N8python/n8ao) (`N8AOPostPass`) is the modern recommended SSAO for r3f — plug into `pmndrs/postprocessing`'s pass chain, tune via `aoRadius`, `distanceFalloff`, `intensity`. Pair with an SMAA pass since hardware MSAA doesn't composite correctly with SSAO. This is the most expensive option and, being a soft photographic gradient, is also the one most likely to fight the "hand-sculpted" look unless you crank `intensity` down and lean on it only for contact points, not broad shading.

```jsx
import { EffectComposer } from '@react-three/postprocessing'
import { N8AO } from '@react-three/postprocessing' // if using the pmndrs wrapper, or wire N8AOPostPass manually

<EffectComposer>
  <N8AO aoRadius={0.5} intensity={2} distanceFalloff={1} />
</EffectComposer>
```

## 7. Vertex displacement for chunky cartoon terrain on a sphere

Goal: rolling valleys/canyons that read as **sculpted**, not noisy — i.e., low-frequency, few octaves, rounded rather than jagged.

### Noise choice

- **Simplex noise** (Ken Perlin's 2001 successor to classic Perlin) over classic Perlin: fewer directional grid artifacts, cheaper in 3D (good for sphere-surface sampling in `(x,y,z)` without needing a UV unwrap).
- **FBM (fractal Brownian motion)** — sum a few octaves of simplex noise at increasing frequency/decreasing amplitude — but **keep it to 2–3 octaves**, not the 6–8 typical in realistic terrain. More octaves = more high-frequency detail = "noisy," which is exactly what you don't want. The first octave alone already gives smooth, sculpted blobs; each additional octave should be treated as a small "chisel detail" pass, added sparingly and at low weight.
- **Domain warping** (Inigo Quilez's technique, [iquilezles.org/articles/warp](https://iquilezles.org/articles/warp/)): instead of `fbm(p)`, compute `fbm(p + fbm(p))` (or nest one level deeper: `fbm(p + fbm(p + fbm(p)))`). This warps the coordinate space feeding the noise, producing organic, flowing, "kneaded" shapes rather than the regular bumpiness of raw FBM — much closer to hand-sculpted clay terrain than to a heightmap.
- Shape the result with `pow(fbm, k)` (k around 1.3–2) to flatten low areas into smooth valley floors and round off peaks — this is what keeps ridgelines soft rather than spiky.

### Vertex shader sketch (r3f / `shaderMaterial`)

```glsl
// vertex shader — displaces a low-poly icosphere along its normal
uniform float uTime;
varying vec3 vNormal;

#pragma glslify: snoise = require(glsl-noise/simplex/3d)

float terrainHeight(vec3 p) {
  // low-octave, warped FBM: 2-3 octaves only, kept low-frequency
  vec3 warp = vec3(
    snoise(p * 0.6),
    snoise(p * 0.6 + 19.1),
    snoise(p * 0.6 + 7.3)
  );
  float base = snoise(p * 0.8 + warp * 0.9);       // domain-warped low-frequency shape
  float detail = 0.25 * snoise(p * 2.2 + warp);     // small secondary octave, low weight
  float h = base + detail;
  return sign(h) * pow(abs(h), 1.5);                // round peaks, flatten valleys
}

void main() {
  float eps = 0.01;
  vec3 p = normalize(position);

  // sample 3 nearby points on the sphere to rebuild the normal after displacement
  vec3 tangent = normalize(cross(p, vec3(0.0, 1.0, 0.0) + vec3(0.0001))); // avoid parallel degenerate
  vec3 bitangent = normalize(cross(p, tangent));

  vec3 pT = normalize(p + tangent * eps);
  vec3 pB = normalize(p + bitangent * eps);

  float h0 = terrainHeight(p);
  float hT = terrainHeight(pT);
  float hB = terrainHeight(pB);

  vec3 displaced   = p * (1.0 + 0.15 * h0);
  vec3 displacedT  = pT * (1.0 + 0.15 * hT);
  vec3 displacedB  = pB * (1.0 + 0.15 * hB);

  vNormal = normalize(cross(displacedT - displaced, displacedB - displaced));

  vec3 transformed = displaced;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
```

This is the **finite-difference / neighbor-sample** technique for GPU-side normal recomputation (discussed on the [three.js forum](https://discourse.threejs.org/t/calculating-vertex-normals-after-displacement-in-the-vertex-shader/16989)): displace the vertex and two nearby tangent-plane samples the same way, then take the cross product of the displaced tangent vectors to get a normal consistent with the new surface. This is necessary because just displacing along the original (undisplaced) normal and reusing the original normal for lighting makes bumps look flat/wrong under toon shading, where a wrong N·L reads as a very visible wrong shading band.

### CPU-side alternative (simpler, static terrain)

If the terrain doesn't animate per-frame, it's simpler to displace on the CPU once and call `geometry.computeVertexNormals()`:

```js
import { createNoise3D } from 'simplex-noise'

const noise3D = createNoise3D()
const geo = new THREE.IcosahedronGeometry(1, 24) // enough subdivisions for chunky-but-not-blocky detail
const pos = geo.attributes.position

for (let i = 0; i < pos.count; i++) {
  const p = new THREE.Vector3().fromBufferAttribute(pos, i).normalize()
  const warp = noise3D(p.x * 0.6, p.y * 0.6, p.z * 0.6)
  const h = noise3D(p.x * 0.8 + warp, p.y * 0.8 + warp, p.z * 0.8 + warp)
  const shaped = Math.sign(h) * Math.pow(Math.abs(h), 1.5)
  p.multiplyScalar(1 + 0.15 * shaped)
  pos.setXYZ(i, p.x, p.y, p.z)
}
pos.needsUpdate = true
geo.computeVertexNormals() // MUST be called after any position edit, or lighting uses stale normals
```

`computeVertexNormals()` averages face normals per shared vertex for indexed geometry — exactly what you want for a smooth, sculpted (not faceted) clay-terrain look. If you want visible facets instead (chunkier, more "carved," works well with a hard toon ramp), skip `computeVertexNormals()` and instead call `geo.toNonIndexed()` before displacing so each triangle gets its own vertices and a true flat per-face normal.

### Reference implementations

- [terrain-sphere-three-js-shader](https://github.com/sebastianvasquezechavarria1234/terrain-sphere-three-js-shader) — a working, dependency-free three.js + GLSL project doing exactly this: simplex-noise FBM (3 octaves) vertex displacement on a sphere, `pow(mountains, 1.5)` shaping, plus breathing/ripple/pulse layered effects. Good starting skeleton to fork.
- [Twisted Colorful Spheres with Three.js — Codrops](https://tympanus.net/codrops/2021/01/26/twisted-colorful-spheres-with-three-js/) — noise-driven sphere distortion with a polished, stylized (non-realistic) art direction; useful for seeing how a "toy-like" distorted sphere reads visually compared to a photorealistic terrain.
- [Vertex displacement with a noise function — Clicktorelease](https://www.clicktorelease.com/blog/vertex-displacement-noise-3d-webgl-glsl-three-js/) — the classic tutorial on turbulence-based FBM displacement; explicitly flags the "normals aren't recalculated" gap this doc's finite-difference section fixes.
- [Domain warping — Inigo Quilez](https://iquilezles.org/articles/warp/) — the canonical writeup/derivation of the `fbm(p + fbm(p))` technique used above.

---

## Sources

- [MeshToonMaterial – three.js docs](https://threejs.org/docs/pages/MeshToonMaterial.html)
- [MeshToonMaterial - Three.js Tutorials (sbcode.net)](https://sbcode.net/threejs/meshtoonmaterial/)
- [three.js Gradient texture gist](https://gist.github.com/caseyyee/116c44c100a9ac7844037cfd83dd9bae)
- [MeshToonMaterial shading contrast — three.js forum](https://discourse.threejs.org/t/meshtoonmaterial-shading-contrast/21260/3)
- [nidorx/matcaps — GitHub](https://github.com/nidorx/matcaps)
- [Matcaps nidorx — Three.js Resources](https://threejsresources.com/tool/matcaps-nidorx)
- [Observable matcap gallery](https://observablehq.com/@makio135/matcaps)
- [Nomad Sculpt matcap collection thread](https://forum.nomadsculpt.com/t/matcaps-collection/2802)
- [MatcapTexture / useMatcapTexture — Drei docs](https://drei.docs.pmnd.rs/staging/matcap-texture-use-matcap-texture)
- [TextureCan — Fingerprint Imperfection Texture](https://www.texturecan.com/details/212/)
- [3dtextures.me — fingerprints tag](https://3dtextures.me/tag/fingerprints/)
- [Outlines — Drei docs](http://drei.docs.pmnd.rs/abstractions/outlines)
- [drei Outlines.tsx source](https://github.com/pmndrs/drei/blob/master/src/core/Outlines.tsx)
- [three.js webgl postprocessing OutlinePass example](https://threejs.org/examples/webgl_postprocessing_outline.html)
- [How to render full outlines as a post process — three.js forum tutorial](https://discourse.threejs.org/t/how-to-render-full-outlines-as-a-post-process-tutorial/22674)
- [ContactShadows — Drei docs](https://drei.docs.pmnd.rs/staging/contact-shadows)
- [drei ContactShadows.tsx source](https://github.com/pmndrs/drei/blob/master/src/core/ContactShadows.tsx)
- [From Blender to Three.js: The Complete Baking Guide (AO, PBR) — Wawa Sensei](https://wawasensei.dev/tuto/baking-guide)
- [How would I begin to bake lighting/AO into vertex color data? — three.js forum](https://discourse.threejs.org/t/how-would-i-begin-to-bake-lighting-ao-into-vertex-color-data/48689)
- [N8python/n8ao — GitHub](https://github.com/N8python/n8ao)
- [N8AO project page](http://n8programs.com/n8ao/)
- [SSAO — React Postprocessing docs](https://react-postprocessing.docs.pmnd.rs/effects/ssao)
- [Custom Toon Shader in Three.js tutorial — maya-ndljk](https://www.maya-ndljk.com/blog/threejs-basic-toon-shader)
- [mayacoda/toon-shader — GitHub](https://github.com/mayacoda/toon-shader)
- [Vertex displacement with a noise function using GLSL and three.js — Clicktorelease](https://www.clicktorelease.com/blog/vertex-displacement-noise-3d-webgl-glsl-three-js/)
- [terrain-sphere-three-js-shader — GitHub](https://github.com/sebastianvasquezechavarria1234/terrain-sphere-three-js-shader)
- [Twisted Colorful Spheres with Three.js — Codrops](https://tympanus.net/codrops/2021/01/26/twisted-colorful-spheres-with-three-js/)
- [Domain warping — Inigo Quilez](https://iquilezles.org/articles/warp/)
- [The Book of Shaders: Fractal Brownian Motion](https://thebookofshaders.com/13/)
- [Calculating vertex normals after displacement in the vertex shader — three.js forum](https://discourse.threejs.org/t/calculating-vertex-normals-after-displacement-in-the-vertex-shader/16989)
- [BufferGeometry.computeVertexNormals — three.js docs](https://threejs.org/docs/#api/en/core/BufferGeometry.computeVertexNormals)
