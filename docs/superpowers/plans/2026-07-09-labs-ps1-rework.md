# PS1 Dev-Room Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the synthwave PS1 lab with a genuine PS1-era experience: a dense 1999 dev room rendered through a real PSX pipeline, explored via fixed-camera cuts, with portfolio content behind era-styled hotspot panels.

**Architecture:** A react-three-fiber scene renders into a 384×216 target through PSX-patched materials (vertex snap, affine UVs, Gouraud-only) and a Bayer dither/quantize blit. Pure modules own the camera cut state machine, hotspot registry, seeded texture generators, and audio node factory; DOM overlays own all content panels. The v1 files die in integration.

**Tech Stack:** Next.js 15, React 19, react-three-fiber + three (already bundled), WebAudio, Vitest unit project, Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-07-09-labs-ps1-rework-design.md` — its Tone law, pipeline non-negotiables, and bans are part of every task below.
**Research:** `docs/superpowers/research/research-psx-pipeline.md` (shader recipes), `docs/superpowers/research/research-psx-art-direction.md` (palette/composition). Implementers of Tasks 2, 3, 6, 7, 8 should read the relevant research sections named in their task.

## Global Constraints

- Zero new dependencies. No Math.random anywhere — seeded `mulberry32` only.
- Tone law (spec, binding): crude THPS grit. Surfaces = concrete greys / plywood browns / carpet, overcast neutral daylight key. Saturation ONLY in accents (deck graphic, stickers, posters, box spines, LEDs, CRT teal `#7de8e0` family). Shadows teal-leaning, never grey-black. Banned: synthwave neon-on-void, horror melancholy, golden-hour grading.
- Pipeline bans (spec, binding): no bloom, no AA, no SSAO, no soft shadows, no smooth camera motion (hard cuts only), no mipmaps, no specular/PBR/normal maps.
- Internal render resolution exactly 384×216; NearestFilter everywhere; 30 fps lock.
- All textures 64–256 px, quantized to 5-bit/channel at generation.
- PSX tuning constants live in ONE place: `components/labs/ps1/scene/psx-constants.ts` (the lab's PHYS-block equivalent). Gates tune only there.
- Esc law (unchanged, load-bearing): the experience's keydown listener registers capture-phase on window and only `preventDefault`s Escape when it consumes it (panel open). GalleryChrome's `defaultPrevented` guard is already in place — do not touch GalleryChrome.
- Copy law: overlay/DOM copy is dry lowercase (`skip to the content`, `sound: off`); in-world era text may be stylized caps. No emoji, no hype, no Sony assets/logos/fonts — evoke, never copy.
- Immutability: React state via reducers returning new objects; render-layer internal mutation allowed only inside the r3f scene (documented exception, as snowpark's render layer).
- Real content only from `data/` files (skills, projects, experience, contact) — no invented facts. Respect no-lead-title-claims: Senior Frontend Engineer, never lead.
- Dev server for visual checks: `pnpm dev -p 3010` in THIS worktree (port 3000 belongs to the primary checkout). Never run `pnpm build` while it's up.

## File Structure

```
components/labs/ps1/
  scene/psx-constants.ts      — every tunable (resolutions, snap grid, palette anchors, camera defs consumed by cameras.ts)
  scene/textures.ts           — mulberry32, quantize/dither helpers, ALL texture generators
  scene/psx-materials.ts      — patchPSX() material patcher (snap/affine/vertex-lit)
  scene/psx-pipeline.tsx      — <PSXCanvas> low-res pipeline wrapper + dither blit + 30fps
  scene/bitmap-font.ts        — 5x7 glyph atlas renderer for in-world text
  scene/cameras.ts            — angle definitions + experience reducer (pure)
  scene/hotspots.ts           — hotspot registry (pure)
  scene/props.ts              — prop mesh builders (pure geometry+material assembly)
  scene/room.tsx              — the room: props placed, lights, hotspot meshes
  panels/panel-shell.tsx      — era chrome frame (BIOS/GT structure + THPS grunge)
  panels/{menu,about,projects,skills,contact,labs}-panel.tsx
  audio.ts                    — createPS1Audio(): synth blips + room tone + toggle
  boot.tsx                    — boot flash overlay
  ps1-experience.tsx          — shell: reducer wiring, input, panels, a11y
app/labs/ps1/page.tsx         — rewritten: crawlable server content + mount
e2e/labs-ps1.spec.ts          — new e2e (replaces any v1 coverage)
__tests__/labs/ps1/           — unit suites (textures, materials, cameras, hotspots, audio, bitmap-font)
scripts/posters/ps1-poster.html + capture — regenerated museum poster (Task 14)
DELETED in Task 12: components/labs/ps1/ps1-scene.tsx, memory-card.tsx, ps1.module.css
```

Execution note: Tasks 1→2→3 are the pipeline spine and strictly ordered (GATE A follows 3). Tasks 4, 5 are pure modules, orderable anytime before 8/9. Tasks 6, 7 (texture packs) before 8. GATE B after 8. Tasks 9→10→11→12 complete the experience (GATE C after 12). Task 13 (museum footsteps) LAST-but-one with a sequencing check; Task 14 closes (GATE D).

---

### Task 1: Texture foundations — seeded helpers + base surfaces

**Files:**
- Create: `components/labs/ps1/scene/psx-constants.ts`
- Create: `components/labs/ps1/scene/textures.ts`
- Test: `__tests__/labs/ps1/textures.test.ts`

**Interfaces (Produces):**
- `psx-constants.ts`: `export const PSX = { LOW_W: 384, LOW_H: 216, SNAP_W: 320, SNAP_H: 180, FPS: 30, TEX: { wall: '#8a8578', wallShade: '#6f6a5f', plywood: '#8f7350', plywoodDark: '#6b5238', carpet: '#5f6258', carpetDark: '#4a4d45', concrete: '#7d7f7a', shadowTeal: '#3d5450', crtTeal: '#7de8e0', crtTealDark: '#2e6b66', accentOrange: '#d96b2f', accentYellow: '#d9b23a', accentRed: '#b8402e', accentBlue: '#3e6fb8' } } as const` — the single tuning surface. Gates may retune values; names are stable.
- `textures.ts`: `mulberry32(seed): () => number`; `quantize15(v: number): number` (0-255 → nearest of 32 levels); `ditherQuantizeCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement` (4×4 Bayer + 5-bit quantize of the canvas in place, returns it); `makeTexture(canvas): THREE.CanvasTexture` (NearestFilter both, `generateMipmaps=false`, SRGB); generators `makeWallTexture()`, `makePlywoodTexture()`, `makeCarpetTexture()`, `makeConcreteTexture()` — each `(): THREE.CanvasTexture`, 128×128, seeded, quantized before wrapping.

- [ ] **Step 1: Failing tests**

```ts
// __tests__/labs/ps1/textures.test.ts
import { describe, expect, it } from 'vitest'
import { mulberry32, quantize15, ditherQuantizeCanvas } from '@/components/labs/ps1/scene/textures'

describe('quantize15', () => {
  it('maps 0..255 onto exactly 32 levels', () => {
    const levels = new Set<number>()
    for (let v = 0; v <= 255; v++) levels.add(quantize15(v))
    expect(levels.size).toBe(32)
    expect(quantize15(0)).toBe(0)
    expect(quantize15(255)).toBe(255)
  })
  it('is idempotent', () => {
    for (const v of [0, 37, 128, 200, 255]) expect(quantize15(quantize15(v))).toBe(quantize15(v))
  })
})

describe('mulberry32', () => {
  it('is deterministic per seed and uniform-ish in [0,1)', () => {
    const a = mulberry32(7)
    const b = mulberry32(7)
    const seq = Array.from({ length: 8 }, () => a())
    expect(Array.from({ length: 8 }, () => b())).toEqual(seq)
    expect(seq.every((x) => x >= 0 && x < 1)).toBe(true)
  })
})

describe('ditherQuantizeCanvas', () => {
  it('leaves every channel on a 5-bit level', () => {
    const c = document.createElement('canvas')
    c.width = c.height = 8
    const g = c.getContext('2d')!
    g.fillStyle = '#8a8578'
    g.fillRect(0, 0, 8, 8)
    const data = ditherQuantizeCanvas(c).getContext('2d')!.getImageData(0, 0, 8, 8).data
    for (let i = 0; i < data.length; i += 4) {
      expect(quantize15(data[i])).toBe(data[i])
      expect(quantize15(data[i + 1])).toBe(data[i + 1])
      expect(quantize15(data[i + 2])).toBe(data[i + 2])
    }
  })
  it('dithers a gradient into more than one level per row', () => {
    const c = document.createElement('canvas')
    c.width = 32; c.height = 4
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, 32, 0)
    grad.addColorStop(0, '#404040'); grad.addColorStop(1, '#484848')
    g.fillStyle = grad
    g.fillRect(0, 0, 32, 4)
    const data = ditherQuantizeCanvas(c).getContext('2d')!.getImageData(0, 0, 32, 1).data
    const reds = new Set<number>()
    for (let i = 0; i < data.length; i += 4) reds.add(data[i])
    expect(reds.size).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Run** `pnpm vitest --project unit __tests__/labs/ps1/textures.test.ts --run` — FAIL (module missing).

- [ ] **Step 3: Implement**

`psx-constants.ts` exactly as the Interfaces block above (with a doc comment: "The lab's single tuning surface — gates tune here, nowhere else").

`textures.ts` core:

```ts
'use client'
import * as THREE from 'three'
import { PSX } from './psx-constants'

/** Deterministic PRNG — the repo's convention; never Math.random. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Snap a 0-255 channel to the nearest of 32 levels (15-bit color). */
export function quantize15(v: number): number {
  return Math.round(Math.round((v / 255) * 31) * (255 / 31))
}

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

/** 4x4 ordered dither + 5-bit quantize, in place. The era's color pipeline. */
export function ditherQuantizeCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const g = canvas.getContext('2d')!
  const img = g.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  const step = 255 / 31
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4
      const t = (BAYER4[y & 3][x & 3] / 16 - 0.5) * step
      for (let c = 0; c < 3; c++) {
        d[i + c] = quantize15(Math.max(0, Math.min(255, d[i + c] + t)))
      }
    }
  }
  g.putImageData(img, 0, 0)
  return canvas
}

export function makeTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(ditherQuantizeCanvas(canvas))
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function canvas128(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  return [c, c.getContext('2d')!]
}
```

Base surface generators (each seeded, era-crude; exact drawing below):

```ts
/** Plaster wall: flat base + sparse tonal blotches + a horizontal scuff band. */
export function makeWallTexture(): THREE.CanvasTexture {
  const [c, g] = canvas128()
  const rnd = mulberry32(101)
  g.fillStyle = PSX.TEX.wall
  g.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 260; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)'
    g.fillRect(Math.floor(rnd() * 128), Math.floor(rnd() * 128), 2 + Math.floor(rnd() * 3), 2)
  }
  g.fillStyle = 'rgba(0,0,0,0.07)'
  g.fillRect(0, 96, 128, 6)
  return makeTexture(c)
}

/** Plywood: warm base, long grain streaks, two darker knots. */
export function makePlywoodTexture(): THREE.CanvasTexture {
  const [c, g] = canvas128()
  const rnd = mulberry32(102)
  g.fillStyle = PSX.TEX.plywood
  g.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 90; i++) {
    const y = Math.floor(rnd() * 128)
    g.fillStyle = rnd() > 0.5 ? 'rgba(60,40,20,0.10)' : 'rgba(255,230,200,0.06)'
    g.fillRect(0, y, 128, 1)
  }
  for (const [kx, ky] of [[34, 40], [92, 88]]) {
    g.fillStyle = PSX.TEX.plywoodDark
    g.beginPath(); g.ellipse(kx, ky, 5, 3, 0, 0, Math.PI * 2); g.fill()
  }
  return makeTexture(c)
}

/** Carpet: two-tone speckle, low contrast. */
export function makeCarpetTexture(): THREE.CanvasTexture {
  const [c, g] = canvas128()
  const rnd = mulberry32(103)
  g.fillStyle = PSX.TEX.carpet
  g.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 2400; i++) {
    g.fillStyle = rnd() > 0.5 ? PSX.TEX.carpetDark : 'rgba(255,255,255,0.05)'
    g.fillRect(Math.floor(rnd() * 128), Math.floor(rnd() * 128), 1, 1)
  }
  return makeTexture(c)
}

/** Concrete (window sill / street below): grey base + cracks + stains. */
export function makeConcreteTexture(): THREE.CanvasTexture {
  const [c, g] = canvas128()
  const rnd = mulberry32(104)
  g.fillStyle = PSX.TEX.concrete
  g.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 6; i++) {
    let x = rnd() * 128, y = rnd() * 128
    g.strokeStyle = 'rgba(0,0,0,0.12)'
    g.beginPath(); g.moveTo(x, y)
    for (let s = 0; s < 6; s++) { x += (rnd() - 0.5) * 24; y += rnd() * 14; g.lineTo(x, y) }
    g.stroke()
  }
  for (let i = 0; i < 5; i++) {
    g.fillStyle = 'rgba(0,0,0,0.05)'
    const x = rnd() * 128, y = rnd() * 128
    g.beginPath(); g.ellipse(x, y, 8 + rnd() * 12, 5 + rnd() * 8, 0, 0, Math.PI * 2); g.fill()
  }
  return makeTexture(c)
}
```

- [ ] **Step 4: Run tests** — all PASS. Then `npx tsc --noEmit`, `pnpm lint`.
- [ ] **Step 5: Commit** `git commit -m "feat(ps1): psx constants + seeded era texture foundations"`

---

### Task 2: PSX material patcher — vertex snap, affine UVs, vertex-lit

**Files:**
- Create: `components/labs/ps1/scene/psx-materials.ts`
- Test: `__tests__/labs/ps1/psx-materials.test.ts`

**Interfaces (Produces):**
- `patchPSX(mat: THREE.Material, opts?: { affine?: boolean; snap?: boolean }): THREE.Material` — mutates+returns the material with `onBeforeCompile` installed and a `customProgramCacheKey` distinguishing option combos. Defaults: both on.
- `makePSXMaterial(opts: { map?: THREE.Texture; color?: string; vertexColors?: boolean; affine?: boolean; snap?: boolean }): THREE.MeshLambertMaterial` — Lambert (Gouraud) with `flatShading: false`, patched. NEVER Standard/Physical.
- Read `research-psx-pipeline.md` §vertex-snap and §affine before implementing.

**Binding shader recipe** (verify the varying name against the installed three version — `vMapUv` on r152+, `vUv` earlier; adjust mechanically if needed):

```ts
import * as THREE from 'three'
import { PSX } from './psx-constants'

type PSXOpts = { affine?: boolean; snap?: boolean }

export function patchPSX<M extends THREE.Material>(mat: M, opts: PSXOpts = {}): M {
  const affine = opts.affine !== false
  const snap = opts.snap !== false
  mat.onBeforeCompile = (shader) => {
    if (snap) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        // PSX fixed-point rasterizer: snap NDC xy to a coarse grid
        {
          vec2 grid = vec2(${PSX.SNAP_W}.0, ${PSX.SNAP_H}.0);
          vec2 ndc = gl_Position.xy / gl_Position.w;
          gl_Position.xy = (floor(ndc * grid + 0.5) / grid) * gl_Position.w;
        }`
      )
    }
    if (affine) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vAffineW;')
        .replace(
          '#include <fog_vertex>',
          `#include <fog_vertex>
          vAffineW = gl_Position.w;
          #ifdef USE_MAP
            vMapUv *= gl_Position.w;
          #endif`
        )
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vAffineW;')
        .replace(
          '#include <map_fragment>',
          `#ifdef USE_MAP
            vec4 sampledDiffuseColor = texture2D( map, vMapUv / vAffineW );
            diffuseColor *= sampledDiffuseColor;
          #endif`
        )
    }
  }
  mat.customProgramCacheKey = () => `psx-${affine ? 'a' : ''}${snap ? 's' : ''}`
  return mat
}

export function makePSXMaterial(opts: {
  map?: THREE.Texture
  color?: string
  vertexColors?: boolean
  affine?: boolean
  snap?: boolean
}): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({
    map: opts.map ?? null,
    color: opts.color ?? '#ffffff',
    vertexColors: opts.vertexColors ?? false,
  })
  return patchPSX(mat, opts)
}
```

- [ ] **Step 1: Failing tests** — string-level assertions that the patch injects what it claims:

```ts
// __tests__/labs/ps1/psx-materials.test.ts
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { makePSXMaterial, patchPSX } from '@/components/labs/ps1/scene/psx-materials'

function compileStrings(mat: THREE.Material) {
  // Feed onBeforeCompile a real Lambert shader source pair
  const shader = {
    vertexShader: THREE.ShaderLib.lambert.vertexShader,
    fragmentShader: THREE.ShaderLib.lambert.fragmentShader,
    uniforms: {},
  }
  // @ts-expect-error test invokes the hook directly
  mat.onBeforeCompile(shader, null)
  return shader
}

describe('patchPSX', () => {
  it('injects the NDC snap after project_vertex', () => {
    const s = compileStrings(makePSXMaterial({}))
    expect(s.vertexShader).toContain('floor(ndc * grid + 0.5)')
  })
  it('injects the affine UV multiply/divide pair', () => {
    const s = compileStrings(makePSXMaterial({}))
    expect(s.vertexShader).toContain('vAffineW = gl_Position.w')
    expect(s.fragmentShader).toContain('vMapUv / vAffineW')
  })
  it('omits patches when disabled and cache keys differ per combo', () => {
    const off = makePSXMaterial({ affine: false, snap: false })
    const s = compileStrings(off)
    expect(s.vertexShader).not.toContain('floor(ndc')
    const combos = [
      makePSXMaterial({}), makePSXMaterial({ affine: false }),
      makePSXMaterial({ snap: false }), off,
    ].map((m) => m.customProgramCacheKey())
    expect(new Set(combos).size).toBe(4)
  })
  it('returns a Lambert (Gouraud) material — never Standard/Physical', () => {
    expect(makePSXMaterial({}).type).toBe('MeshLambertMaterial')
  })
  it('patchPSX preserves the material instance', () => {
    const m = new THREE.MeshLambertMaterial()
    expect(patchPSX(m)).toBe(m)
  })
})
```

- [ ] **Step 2: Run** — FAIL. **Step 3:** implement per recipe. **Step 4:** tests PASS; if `vMapUv` doesn't exist in the installed three's Lambert source, switch to `vUv` in BOTH patch and test (check `THREE.ShaderLib.lambert.vertexShader.includes('vMapUv')`). tsc + lint.
- [ ] **Step 5: Commit** `git commit -m "feat(ps1): psx material patcher - vertex snap, affine uv, gouraud-only"`

---

### Task 3: The low-res pipeline — render target, dither blit, 30 fps → GATE A proof

**Files:**
- Create: `components/labs/ps1/scene/psx-pipeline.tsx`
- Create (temporary, deleted in Task 8): `components/labs/ps1/scene/proof-scene.tsx`
- Create (temporary page for the gate, deleted in Task 12): `app/labs/ps1/proof/page.tsx`

**Interfaces (Produces):**
- `<PSXCanvas onFrame?: (t: number) => void>{children}</PSXCanvas>` — an r3f `<Canvas frameloop="never" gl={{ antialias: false }}>` that: renders `children` (the 3D scene) into a `WebGLRenderTarget(PSX.LOW_W, PSX.LOW_H)` with NearestFilter + depth, then draws a fullscreen quad through the dither/quantize shader to the real canvas, locked to `PSX.FPS` via its own rAF accumulator. Resizes by CSS only (canvas stays 384×216 internally; CSS `image-rendering: pixelated` upscales).
- Blit fragment shader (binding): sample the low-res target with Nearest; Bayer index from the LOW-RES pixel coordinate so dither granularity matches internal pixels:

```glsl
uniform sampler2D tScene;
varying vec2 vUv;
const float LOW_W = 384.0; const float LOW_H = 216.0;
float bayer(vec2 p) {
  int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0));
  int m[16]; m[0]=0;m[1]=8;m[2]=2;m[3]=10;m[4]=12;m[5]=4;m[6]=14;m[7]=6;
  m[8]=3;m[9]=11;m[10]=1;m[11]=9;m[12]=15;m[13]=7;m[14]=13;m[15]=5;
  return float(m[y * 4 + x]) / 16.0;
}
void main() {
  vec2 lowPx = floor(vUv * vec2(LOW_W, LOW_H));
  vec3 c = texture2D(tScene, vUv).rgb;
  float t = (bayer(lowPx) - 0.5) / 31.0;
  c = clamp(c + t, 0.0, 1.0);
  c = floor(c * 31.0 + 0.5) / 31.0;
  gl_FragColor = vec4(c, 1.0);
}
```

(Implementation notes: build the quad scene with `THREE.OrthographicCamera(-1,1,1,-1,0,1)` + `PlaneGeometry(2,2)` + `ShaderMaterial`; in the frame loop `gl.setRenderTarget(target); gl.render(scene, camera); gl.setRenderTarget(null); gl.render(quadScene, quadCam)`. Use r3f `useFrame` with `frameloop="never"` and an external rAF that calls `advance()` at 30fps — or gate inside `useFrame` on an accumulator like snowpark's `use-game-loop`; either is fine, document the choice. `renderer.outputColorSpace` stays default sRGB — quantize happens on the already-encoded value, which is the era-correct place.)

- `proof-scene.tsx` (GATE A subject): a placeholder box room — floor (carpet texture), three walls (wall texture), a plywood desk slab, one big rotating textured cube on the desk, one `DirectionalLight` (neutral `#e8e6e0`, intensity ~1.1) + `AmbientLight('#3d5450', ~0.55)` (teal shadow law), all through `makePSXMaterial`. Slow cube rotation via `onFrame`.
- `app/labs/ps1/proof/page.tsx`: bare page mounting `<PSXCanvas><ProofScene/></PSXCanvas>` full-viewport (no GalleryChrome — it's scaffolding).

- [ ] **Step 1:** Implement `psx-pipeline.tsx` + `proof-scene.tsx` + the proof page per the interfaces.
- [ ] **Step 2:** tsc + lint + full unit suite still green (no unit tests for r3f components; existing suites must not break).
- [ ] **Step 3:** Self-check headlessly: with the worktree dev server on 3010, screenshot `http://localhost:3010/labs/ps1/proof` via Playwright; confirm: hard pixels (no smoothing), visible dither patterning in gradients, texture warp/wobble on the rotating cube (affine + snap visible), Lambert shading only. Include the screenshot description in your report.
- [ ] **Step 4: Commit** `git commit -m "feat(ps1): psx pipeline - 384x216 target, bayer quantize blit, 30fps lock"`
- [ ] **GATE A (ORCHESTRATOR):** screenshot the proof page — the cube room must read PS1 (jitter, warp, dither, hard pixels) BEFORE any real content is built on the pipeline. Tune `PSX.SNAP_*`/dither only in `psx-constants.ts`; commit as `chore(ps1): tune at gate A - ...`.

---

### Task 4: Bitmap font — era glyphs for in-world text

**Files:**
- Create: `components/labs/ps1/scene/bitmap-font.ts`
- Test: `__tests__/labs/ps1/bitmap-font.test.ts`

**Interfaces (Produces):**
- `drawBitmapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, opts?: { scale?: number; color?: string }): number` — draws 5×7 pixel glyphs (uppercase A–Z, 0–9, `.,:/-·%+()!?` and space), returns the width drawn. Unknown chars render as the `?` box. Glyphs are a `Record<string, number[]>` of 7 row-bitmasks (5 bits per row) defined in-file — complete alphabet required, no placeholder rows (the implementer writes all ~46 glyph masks; verify visually via the test canvas dump described below).
- `measureBitmapText(text: string, scale?: number): number`.

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { drawBitmapText, measureBitmapText } from '@/components/labs/ps1/scene/bitmap-font'

describe('bitmap font', () => {
  it('draws every supported glyph with nonzero ink', () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:/-·%+()!?'
    for (const ch of chars) {
      const c = document.createElement('canvas')
      c.width = 8; c.height = 8
      const g = c.getContext('2d')!
      drawBitmapText(g, ch, 0, 0, { color: '#ffffff' })
      const d = g.getImageData(0, 0, 8, 8).data
      let ink = 0
      for (let i = 3; i < d.length; i += 4) ink += d[i]
      expect(ink, `glyph ${ch}`).toBeGreaterThan(0)
    }
  })
  it('measures width as glyphs*(5+1)*scale - kerning gap', () => {
    expect(measureBitmapText('AB', 2)).toBe((6 + 6 - 1) * 2)
  })
  it('advances the pen and returns drawn width', () => {
    const c = document.createElement('canvas')
    c.width = 64; c.height = 8
    const w = drawBitmapText(c.getContext('2d')!, 'HI', 0, 0)
    expect(w).toBe(measureBitmapText('HI'))
  })
})
```

- [ ] **Step 2:** FAIL → implement → PASS. tsc + lint.
- [ ] **Step 3: Commit** `git commit -m "feat(ps1): 5x7 bitmap font for in-world era text"`

---

### Task 5: Cameras + hotspots — the pure experience core

**Files:**
- Create: `components/labs/ps1/scene/cameras.ts`
- Create: `components/labs/ps1/scene/hotspots.ts`
- Test: `__tests__/labs/ps1/cameras.test.ts`, `__tests__/labs/ps1/hotspots.test.ts`

**Interfaces (Produces):**

`cameras.ts`:
```ts
export type AngleId = 'room' | 'desk' | 'shelf' | 'tv'
export type CameraAngle = {
  id: AngleId
  position: [number, number, number]
  lookAt: [number, number, number]
  fov: number
  label: string // lowercase, e.g. 'the room'
}
export const ANGLES: Record<AngleId, CameraAngle>
export const ANGLE_ORDER: AngleId[] // ['room','desk','shelf','tv']
export type PanelId = 'menu' | 'about' | 'projects' | 'skills' | 'contact' | 'labs' | null
export type ExperienceState = { booted: boolean; angle: AngleId; panel: PanelId; soundOn: boolean }
export type ExperienceAction =
  | { type: 'BOOT_DONE' } | { type: 'CUT'; dir: 1 | -1 } | { type: 'CUT_TO'; angle: AngleId }
  | { type: 'OPEN_PANEL'; panel: Exclude<PanelId, null> } | { type: 'CLOSE_PANEL' }
  | { type: 'ESCAPE' } | { type: 'TOGGLE_SOUND' }
export const initialState: ExperienceState // { booted:false, angle:'room', panel:null, soundOn:false }
export function experienceReducer(s: ExperienceState, a: ExperienceAction): ExperienceState
// Semantics (binding): CUT cycles ANGLE_ORDER wrapping; CUT/CUT_TO ignored while a panel is open
// or before booted; OPEN_PANEL ignored before booted; ESCAPE closes an open panel and is otherwise
// a no-op (the shell only preventDefaults Escape when panel !== null — the GalleryChrome contract);
// every transition returns a NEW object; identical no-op transitions return the same reference.
```
Room coordinate frame for the angle constants (binding for Task 8 too): room interior spans x ∈ [−2.2, 2.2], z ∈ [−2.6, 2.6], floor y=0, ceiling y=2.6. Desk against the −z wall centered x≈−0.6; window on the −z wall right of the desk (x≈1.2); shelf on the +x wall; TV corner at (+1.4, 0, +1.6); door implied on +z. Angles: `room` from (1.9, 1.5, 2.3) looking at (−0.4, 0.9, −1.2), fov 60; `desk` from (−0.6, 1.25, −0.7) looking at (−0.6, 1.05, −2.2), fov 50; `shelf` from (0.4, 1.35, 0.2) looking at (2.0, 1.3, −0.4), fov 52; `tv` from (−0.2, 1.0, 0.2) looking at (1.5, 0.5, 1.8), fov 55.

`hotspots.ts`:
```ts
export type Hotspot = {
  id: string            // mesh name in the scene, e.g. 'crt'
  panel: Exclude<PanelId, null>
  label: string         // lowercase hint copy, e.g. 'the monitor — menu'
  angles: AngleId[]     // angles from which it's clickable
}
export const HOTSPOTS: Hotspot[]
// crt→menu (desk,room) · memcards→projects (shelf,room) · posters→skills (room,desk)
// pager→contact (desk) · gameboxes→labs (shelf) · tv→about (tv,room)
export function hotspotById(id: string): Hotspot | undefined
export function hotspotsForAngle(angle: AngleId): Hotspot[]
```

- [ ] **Step 1: Failing tests** — reducer semantics table-tested (cut cycling + wrap both directions; panel blocks cuts; escape-with-panel closes and escape-without is identity; boot gating; toggle sound; no mutation via `Object.freeze(initialState)`); hotspot integrity (every hotspot's panel is a real PanelId; ids unique; every PanelId except `menu` reachable from at least one hotspot — menu is also the CRT so it IS reachable; every hotspot lists ≥1 angle; hotspotsForAngle('desk') contains crt and pager).

```ts
// cameras.test.ts (core assertions; write the full table)
import { describe, expect, it } from 'vitest'
import { ANGLES, ANGLE_ORDER, experienceReducer, initialState } from '@/components/labs/ps1/scene/cameras'

const booted = { ...initialState, booted: true }
describe('experienceReducer', () => {
  it('gates everything behind boot', () => {
    expect(experienceReducer(initialState, { type: 'CUT', dir: 1 })).toBe(initialState)
    expect(experienceReducer(initialState, { type: 'OPEN_PANEL', panel: 'menu' })).toBe(initialState)
  })
  it('cycles angles with wrap in both directions', () => {
    let s = booted
    for (const a of [...ANGLE_ORDER.slice(1), ANGLE_ORDER[0]]) {
      s = experienceReducer(s, { type: 'CUT', dir: 1 })
      expect(s.angle).toBe(a)
    }
    expect(experienceReducer(booted, { type: 'CUT', dir: -1 }).angle).toBe(ANGLE_ORDER[3])
  })
  it('a panel blocks cuts and ESCAPE closes it', () => {
    const open = experienceReducer(booted, { type: 'OPEN_PANEL', panel: 'skills' })
    expect(experienceReducer(open, { type: 'CUT', dir: 1 })).toBe(open)
    expect(experienceReducer(open, { type: 'ESCAPE' }).panel).toBeNull()
    expect(experienceReducer(booted, { type: 'ESCAPE' })).toBe(booted)
  })
  it('never mutates', () => {
    const frozen = Object.freeze({ ...booted })
    expect(() => experienceReducer(frozen, { type: 'CUT', dir: 1 })).not.toThrow()
  })
  it('all four angles have sane fov and distinct positions', () => {
    const pos = new Set(Object.values(ANGLES).map((a) => a.position.join(',')))
    expect(pos.size).toBe(4)
    for (const a of Object.values(ANGLES)) expect(a.fov).toBeGreaterThanOrEqual(45)
  })
})
```

- [ ] **Step 2:** FAIL → implement → PASS. tsc + lint.
- [ ] **Step 3: Commit** `git commit -m "feat(ps1): camera angles + experience reducer + hotspot registry"`

---

### Task 6: Graphic textures I — posters, sticker sheet, deck graphic

**Files:**
- Modify: `components/labs/ps1/scene/textures.ts` (append generators)
- Test: extend `__tests__/labs/ps1/textures.test.ts`

**Interfaces (Produces):** `makePosterTexture(category: SkillCategory): THREE.CanvasTexture` (128×192 portrait; one per skill category, seeded by category index); `makeStickerSheetTexture(): THREE.CanvasTexture` (128×128, transparent-background sticker cluster for the tower case); `makeDeckTexture(): THREE.CanvasTexture` (64×256, skate deck bottom graphic).

**Art specs (binding — this is where the accent saturation budget is spent; read research-psx-art-direction §THPS UI):**
- Posters: each = torn-edge rectangle of one saturated accent (`accentOrange`/`accentRed`/`accentBlue`/`accentYellow` by category index) over a near-black field, big diagonal stencil-style category word (bitmap font scaled ×3, clipped off-edge THPS-style), 2–3 supporting shapes (halftone dot patch via 2px dot grid, a star, a tape strip in `#c9c2ae` at a corner), small caps footer with the category's top 3 skill names (real data from `data/skills.ts`).
- Sticker sheet: 6–8 small shapes (circle/star/lightning/arrow) in mixed accents + white outlines on transparent; 1–2 tiny text stickers (`RAD`, `NO FEAR` era-generic words — never brands).
- Deck: vertical gradient between two accents + center lightning bolt + repeated small stars; wood tone visible at edges (4px margin of `plywood`).
- All pass through `makeTexture` (quantize+dither). Unit tests: each generator returns a texture whose canvas has >1 distinct color and correct dimensions; poster footer contains ink (nonzero alpha in footer band); deterministic (two calls → identical dataURL).

- [ ] **Step 1:** failing tests (dimensions, determinism via `canvas.toDataURL()` equality, ink-in-footer). **Step 2:** implement per art spec. **Step 3:** PASS + tsc + lint. Include PNG dumps of each texture in the report (write to your scratchpad via `canvas.toDataURL()` → file) so the orchestrator can eyeball art quality before Gate B.
- [ ] **Step 4: Commit** `git commit -m "feat(ps1): poster, sticker, deck graphic generators - accent saturation lives here"`

---

### Task 7: Graphic textures II — screens, spines, window view, small props

**Files:**
- Modify: `components/labs/ps1/scene/textures.ts` (append)
- Test: extend `__tests__/labs/ps1/textures.test.ts`

**Interfaces (Produces):**
- `makeCRTScreenTexture(): THREE.CanvasTexture` — 128×96: teal-on-dark menu mock (BIOS-flavored): title bar `AY-01 · MENU`, 5 menu rows (about/projects/skills/contact/labs) in bitmap font, row highlight bar, scanline stripes every 2px at 12% black. THE teal accent moment (`crtTeal` on `#0c1a18`).
- `makeTVScreenTexture(): THREE.CanvasTexture` — 96×72: static-noise field (seeded) with a bright caps word `ABOUT` centered, vignette corners.
- `makeBoxSpineTexture(i: number): THREE.CanvasTexture` — 24×96 each: saturated accent field (cycle accents by i), vertical caps title from the labs manifest slugs (`TERRACOTTA`, `POWDER LINES`, …), thin white top band (era publisher strip).
- `makeWindowViewTexture(): THREE.CanvasTexture` — 192×144: THE overcast view (crude-tone law): flat grey-white sky (`#c9cbc4` → slight vertical darkening), a row of flat rooftop silhouettes (`#6f7270`), one water tower, distant crane, three windows lit dull yellow, wet-street grey foreground band. No sunset. No neon.
- `makeCorkboardTexture(): THREE.CanvasTexture` — 128×96 cork speckle + 3 pinned polaroid rectangles (white borders, grey photos, red pin dots).
- `makeMemcardTexture(): THREE.CanvasTexture` — 64×64: grey shell tone + dark connector slots band + tiny label.

Unit tests mirror Task 6's pattern (dimensions, determinism, distinct-color count; CRT texture contains teal pixels — assert some pixel's g&b channels exceed r by >40).

- [ ] Steps: failing tests → implement → PASS → tsc/lint → PNG dumps in report → commit `feat(ps1): screen, spine, window, corkboard, memcard textures`.

---

### Task 8: Props + the room → GATE B

**Files:**
- Create: `components/labs/ps1/scene/props.ts`
- Create: `components/labs/ps1/scene/room.tsx`
- Delete: `components/labs/ps1/scene/proof-scene.tsx` (the proof page now mounts `<Room staticFrame/>` — page itself dies in Task 12)
- Modify: `app/labs/ps1/proof/page.tsx` (mount the real room for the gate)

**Interfaces:**
- Consumes: every generator from Tasks 1/6/7, `makePSXMaterial` (Task 2), `PSX` constants, `HOTSPOTS` ids (Task 5 — hotspot meshes must carry `mesh.name = hotspot.id`).
- Produces: `props.ts` — pure builders, each returning `THREE.Group`: `buildDesk()`, `buildCRT()` (screen face uses `makeCRTScreenTexture`), `buildTower()` (sticker sheet decal plane on the side), `buildKeyboard()`, `buildPager()`, `buildShelf()` (3 memory cards via `makeMemcardTexture` + 5 game boxes via `makeBoxSpineTexture(i)`), `buildTV()` (screen = `makeTVScreenTexture`), `buildDeck()` (leaning, `makeDeckTexture`), `buildWindow()` (frame + `makeWindowViewTexture` pane), `buildPosters()` (4 posters via `makePosterTexture` per category), `buildCorkboard()`, `buildClutter()` (CD spindle = squashed cylinder stack, mug, cable crate, 3 scattered CD cases). Every builder: primitives only, Lambert PSX materials, vertex-color darkening on downward/inner faces where cheap (Crash trick: hotspot props get slightly brighter base vertex colors).
- `room.tsx` — `<Room staticFrame?: boolean>`: shell (floor carpet / walls wall-tex / ceiling), all props placed per the Task 5 coordinate frame, window on −z wall at x≈1.2, lights: ONE `DirectionalLight('#e8e6e0', 1.15)` angled from the window direction + `AmbientLight(PSX.TEX.shadowTeal, 0.55)` + a faint teal `PointLight` at the CRT face (`crtTeal`, intensity 0.6, distance 1.2) — three lights total, no shadows (`castShadow` never enabled; the era baked shadows — where a ground shadow matters put a dark quantized ellipse decal under the prop: desk, tv, deck).
- Hotspot meshes: the CRT screen face, memcards group, posters group, pager, game-boxes group, TV screen carry `name` = hotspot ids (`crt`, `memcards`, `posters`, `pager`, `gameboxes`, `tv`).

- [ ] **Step 1:** build props.ts (each builder ~10–25 lines; keep a `BUILD` const of shared dims at top). **Step 2:** room.tsx assembly per coordinate frame. **Step 3:** proof page mounts the room; tsc + lint + suites green. **Step 4:** self-check screenshots of ALL FOUR angles (use `ANGLES` constants for camera placement in the proof page via a `?angle=` query param — implement that param in the proof page) at 3010; confirm density (no empty walls), tone law (grey/brown surfaces, saturated accents only), readable silhouettes at 384×216. Report with screenshots.
- [ ] **Step 5: Commit** `git commit -m "feat(ps1): the dev room - props, placement, lights, hotspot meshes"`
- [ ] **GATE B (ORCHESTRATOR):** screenshot all four angles; the room must read as a dense real place in crude THPS tones; tune placement/light/palette constants; commit `chore(ps1): tune at gate B - ...`.

---

### Task 9: Experience shell — boot, cuts, picking, Esc, a11y skeleton

**Files:**
- Create: `components/labs/ps1/boot.tsx`, `components/labs/ps1/ps1-experience.tsx`
- Modify: `app/labs/ps1/page.tsx` (mount experience; keep v1 imports out but do NOT delete v1 files yet — Task 12)

**Interfaces:**
- Consumes: `experienceReducer`/`ANGLES`/`ANGLE_ORDER` (Task 5), `HOTSPOTS`/`hotspotById` (Task 5), `<PSXCanvas>` (Task 3), `<Room>` (Task 8). Panels arrive in Task 10 — this task renders a plain placeholder `<div role="dialog">` per open panel id with a close button (replaced next task, so keep it one line).
- Produces for Task 10/11: `ps1-experience.tsx` owns `const [state, dispatch] = useReducer(experienceReducer, initialState)` and renders `{state.panel && <PanelHost panel={state.panel} onClose={() => dispatch({type:'CLOSE_PANEL'})} />}` — Task 10 swaps PanelHost's internals; `dispatch` and `state.soundOn` are the wiring points Task 11 hooks (audio calls sit beside dispatch call sites).
- Behavior (binding): boot overlay (black → dithered flash → `AY-01` title card in bitmap-font style DOM text) ≤1.5s, any input skips, `prefers-reduced-motion` skips entirely and renders the room's `room` angle as a static frame (PSXCanvas renders exactly one frame when `staticFrame`). ArrowLeft/ArrowRight (and on-screen `‹ ›` buttons, 44px hit area) dispatch CUT. Raycast picking on pointer move sets a `hover` local state (cursor pointer + a DOM hint chip bottom-center: hotspot.label); click dispatches OPEN_PANEL. Keyboard: hotspots reachable via Tab (DOM buttons in a visually-hidden list mirroring `hotspotsForAngle(state.angle)` — they focus/click the same panels); Enter opens. Escape: window keydown capture-phase — if `state.panel !== null`, `preventDefault()` + dispatch ESCAPE; otherwise do NOT preventDefault (GalleryChrome navigates). The angle label + hotspot hint use dry lowercase copy. `skip to the content` link (visible on focus, also visible bottom-left like snowpark's) scrolls to the server-rendered content section (Task 12).
- Hotspot pulse: hovered hotspot mesh gets its material `color` lerped toward white by ±8% on a 1.2s sine — implemented in the r3f layer via the mesh name lookup; never an outline/glow pass.

- [ ] **Step 1:** implement boot.tsx (pure DOM/CSS overlay, timer + input skip). **Step 2:** ps1-experience.tsx per behavior spec. **Step 3:** wire into page.tsx replacing `<PS1Scene/>` + `<MemoryCard/>` usage (imports removed; files remain until Task 12). **Step 4:** tsc/lint/unit; manual smoke at 3010: boot plays and skips, cuts work, hover hint shows, click opens placeholder dialog, Esc closes it, second Esc leaves to /labs, reduced-motion (emulate via Playwright) renders static + no boot. Report with evidence.
- [ ] **Step 5: Commit** `git commit -m "feat(ps1): experience shell - boot, fixed-camera cuts, hotspot picking, esc chain"`

---

### Task 10: Era panels — the content layer

**Files:**
- Create: `components/labs/ps1/panels/panel-shell.tsx` and `panels/{menu,about,projects,skills,contact,labs}-panel.tsx`
- Modify: `components/labs/ps1/ps1-experience.tsx` (PanelHost swaps to real panels)
- Test: `__tests__/labs/ps1/panels.test.tsx` (jsdom render)

**Interfaces:**
- `panel-shell.tsx`: `<PanelShell title onClose sound?>{children}</PanelShell>` — the era chrome: `role="dialog" aria-modal="true"`, focus-trapped (focus the close button on mount, return focus on close), boxy caps title bar with dithered-gradient background (CSS repeating-linear-gradient 2px stops — greys), 2px hard borders, THPS grunge accents (a rotated sticker chip `<span>` top-right using an accent color, tape-edge corners via clip-path), max-w 720px, backdrop `rgba(10,12,11,0.72)`. Dry lowercase close copy: `close (esc)`.
- Panels (ALL content from `data/` — import directly; no invented facts):
  - `menu-panel`: mirror of the CRT — list of the other five as buttons (dispatch pattern: PanelHost passes `onNavigate(panel)`) + one-line intro from `data/about` (whatever the about/site data module exposes — check `data/` exports; snowpark/main site read the same source).
  - `about-panel`: bio paragraphs + the `8 yrs · fintech systems · Yerevan → worldwide` line (exists in v1 hero copy; keep claims law).
  - `projects-panel`: the v1 memory-card manager REBORN: same save-slot grid concept (slot icon, title caps, company + 2 metrics, `Saved`/`In progress` by year), styled to the new chrome. Port the SLOT_ICONS pixel-svg idea from v1's `memory-card.tsx` before it's deleted.
  - `skills-panel`: grouped by category like the posters; each skill row: name, years, level bar drawn as a segmented block bar (era HP-bar look).
  - `contact-panel`: pager-styled: email/linkedin/github as big monospace rows with copy buttons (`copied` feedback inline, no toast libs).
  - `labs-panel`: game-box shelf as links — every `labs` manifest entry (incl. `← gallery` link to /labs), status chip for attic entries (`retired to the attic`).
- Unit tests (jsdom): PanelShell traps focus + calls onClose on close click; projects-panel renders every project from `data/projects`; skills-panel renders every skill name from `data/skills`; labs-panel lists every manifest entry; menu-panel navigation calls onNavigate.

- [ ] Steps: failing tests → implement shell → implement six panels → PASS + tsc/lint → smoke at 3010 (every hotspot opens its real panel; content reads; focus trapped; esc chain intact) → commit `feat(ps1): era panels - bios chrome, thps grunge, real content`.

---

### Task 11: Audio — synth blips + room tone + toggle

**Files:**
- Create: `components/labs/ps1/audio.ts`
- Test: `__tests__/labs/ps1/audio.test.ts`
- Modify: `components/labs/ps1/ps1-experience.tsx` (wire calls + `sound: on/off` toggle in the HUD chrome)

**Interfaces (Produces):**
```ts
export type PS1Audio = {
  resume(): void            // call on first user gesture
  blip(): void              // menu move: square 880Hz, 40ms, -18dB
  select(): void            // open: two-tone square 440→660Hz, 90ms
  back(): void              // close: square 330Hz, 60ms
  boot(): void              // soft fifth: triangle 220+330Hz, 700ms fade
  setRoomTone(on: boolean): void // filtered brown noise loop at -40dB, 400Hz lowpass
  setEnabled(on: boolean): void  // master gate (also persists 'ps1-sound' in localStorage)
  enabled(): boolean
  dispose(): void
}
export function createPS1Audio(ctxFactory?: () => AudioContext): PS1Audio
```
- Pure factory: all nodes built lazily on `resume()`; `ctxFactory` injectable for tests (mock AudioContext). Defaults muted; reads localStorage `ps1-sound` (only 'on' enables). Reduced-motion: the SHELL never enables by default (it passes nothing; user must toggle).
- Wiring (experience): `blip()` on CUT and hover-enter of a hotspot; `select()` on OPEN_PANEL; `back()` on CLOSE_PANEL/ESCAPE-close; `boot()` when boot overlay starts (only if enabled); room tone on while `booted && enabled`. Toggle button copy exactly `sound: on` / `sound: off` (lowercase, in the HUD corner).
- Unit tests with a mock AudioContext (vi.fn node graph): `createPS1Audio` doesn't construct a context until `resume()`; `setEnabled(false)` silences (`blip()` creates no oscillator when disabled); localStorage persistence round-trips; `dispose()` closes the context.

- [ ] Steps: failing tests → implement → PASS + tsc/lint → smoke at 3010 with sound toggled on (audible blips; era-quiet) → commit `feat(ps1): synth ui audio - blips, boot chime, room tone, persistent toggle`.

---

### Task 12: Integration — crawlable page, v1 deletion, manifest, e2e → GATE C

**Files:**
- Modify: `app/labs/ps1/page.tsx` (final form: server-rendered crawlable content + experience mount + metadata refresh)
- Delete: `components/labs/ps1/ps1-scene.tsx`, `components/labs/ps1/memory-card.tsx`, `components/labs/ps1/ps1.module.css`, `app/labs/ps1/proof/page.tsx`
- Modify: `lib/labs-manifest.ts` (ps1 thesis only — see exact copy below)
- Create: `e2e/labs-ps1.spec.ts`
- Test: existing suites all green

**Binding details:**
- page.tsx: keeps GalleryChrome; server-renders (crawlable, snowpark's pattern — sr-accessible section that is also the `skip to the content` target): name/title line, about summary, ALL skills grouped by category, ALL projects with company+metrics, contact links. The experience mounts above it client-side.
- Manifest thesis (exact): `A 1999 dev room rendered through a real PSX pipeline — vertex snap, affine warp, dithered 15-bit color. Fixed-camera cuts; the portfolio lives in the machines on the desk.` (status stays `live`, date stays `2026-07-08`).
- e2e (5 tests): canvas mounts + boot skippable (press any key → title card gone); ArrowRight cuts (angle label changes); a panel opens with real content (click the visually-hidden hotspot button for projects → dialog contains a real project title from data) and Esc closes it while a second Esc returns to /labs (settle-wait law from the snowpark spec — assert URL only after a 500ms settle); reduced-motion renders static (no boot overlay, canvas present); crawlable: `request.get('/labs/ps1')` body contains a known skill name and project title without JS.
- Delete v1 files; grep the repo for `ps1-scene|memory-card|ps1.module` — zero references must remain.

- [ ] Steps: e2e first (failing against current page) → final page.tsx → deletions + manifest → all suites: full unit, tsc, lint, `npx playwright test e2e/labs-ps1.spec.ts` → commit `feat(ps1): integration - crawlable page, v1 retired, manifest, e2e`.
- [ ] **GATE C (ORCHESTRATOR):** full experience walkthrough at 3010 (boot, 4 angles, all 6 panels, sound on, esc chain, reduced-motion, mobile viewport tap targets); full battery incl. `pnpm build` (stop dev server) + full e2e file; tune commit; ledger.

---

### Task 13: Museum footsteps (rider — SEQUENCING CHECK FIRST)

**Files:**
- Create: `components/labs/museum/footsteps.ts`
- Modify: `components/labs/museum/player-controls.tsx` (wiring only), `components/labs/museum/museum-gallery.tsx` (toggle UI)
- Test: `__tests__/labs/museum/footsteps.test.ts`

**BEFORE DISPATCH (orchestrator):** `git fetch origin && git log origin/main --oneline -5 -- components/labs/museum/` — if the user's parallel agent has touched museum files since this branch's base, rebase/merge first or hold this task and ship it separately.

**Interfaces:**
- `footsteps.ts`: `createFootsteps(ctxFactory?: () => AudioContext)` → `{ resume(): void; step(surface: 'marble' | 'wood'): void; setEnabled(on: boolean): void; enabled(): boolean; dispose(): void }`. Marble: short filtered click (highpass 1.2kHz noise burst, 30ms, −22dB). Wood: lower knock (200Hz triangle + noise, 45ms, −20dB). Persisted key `museum-sound` (default off). Pure factory, mock-testable — same pattern as Task 11 (write the same lazy-context + enabled-gate tests).
- player-controls wiring: track accumulated horizontal distance in the existing `useFrame`; every `STRIDE = 1.9` units while moving, call `step(floorY(camera.position.z, length) > 0.1 ? 'wood' : 'marble')` — attic/stairs knock, hall taps. No timing changes to movement itself; the footsteps object arrives via prop from museum-gallery.
- museum-gallery: instantiate once (`useMemo`), `resume()` on first pointerdown, `sound: on/off` pill next to the List view link (same styling family), persisted.

- [ ] Steps: failing tests (factory laziness, enable gate, stride math helper if extracted — extract `strideCrossed(prevDist, newDist, stride): number` pure and test it) → implement → PASS + tsc/lint → manual walk at 3010 with sound on (steps audible, surface switches on the stairs) → commit `feat(museum): footstep audio - marble taps, wood knocks, persistent toggle`.

---

### Task 14: Poster, OG, final review → GATE D

**Files:**
- Create: `scripts/posters/ps1-poster.html` (+ reuse `scripts/posters/capture-snowpark.mjs` pattern as `capture-ps1.mjs`)
- Replace: `public/labs/ps1/poster.jpg` (portrait 3:4, ≤200 KB)
- Modify: `app/labs/ps1/page.tsx` metadata (OG image points at the poster; description matches the new thesis)

**Poster art (binding):** the desk angle of the room — CRT glowing teal in a grey room, poster corner visible, deck against the wall; title `PS1` + `STYLE LAB — № 1` in bitmap-style caps; same crude palette; dithered. Render the poster in the poster HTML via the same canvas texture generators where practical (import nothing — copy the handful of drawing functions inline; posters are standalone files by convention).

- [ ] Steps: poster html → capture → verify ≤200KB + 3:4 → metadata → full battery (unit, tsc, lint, build, ALL e2e incl. labs-attic + labs-snowpark + navigation) → commit `feat(ps1): poster + og refresh` → **GATE D (ORCHESTRATOR):** final whole-branch review dispatch (most capable model, review package from merge-base), fix wave if needed, push branch, open PR with before/after screenshots, hand to user preview.

---

## Verification summary (every task)
`pnpm vitest --project unit __tests__/labs/ps1 --run` (or the task's file), then full unit; `npx tsc --noEmit`; `pnpm lint`; visual tasks: screenshots at `http://localhost:3010` (worktree dev server; NEVER port 3000; never `pnpm build` while it runs). Gates: orchestrator screenshots + tune commits (`chore(ps1): tune at gate X - ...`).
