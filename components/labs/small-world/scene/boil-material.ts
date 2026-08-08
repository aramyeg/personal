/**
 * Task 29 lever 5 — the BOIL dial. Claymation "boil" is the stepped (~8–12 fps,
 * NOT smooth) micro-shimmer of the surface as fingerprints shift between held
 * frames. We reproduce it as a tiny per-vertex NORMAL tilt driven by a single
 * stepped phase UNIFORM — never a position change, so ground truth, the girl's
 * samples and every contact/ceiling bound are untouched by construction.
 *
 * Cost is a "cheap uniform phase": the CPU writes two floats when the ~10 fps step
 * advances; the GPU does the per-vertex perturbation. So it adds ~0 to the per-frame
 * morph budget (renewal-cost.mjs). The tilt only re-bands facets that already sit
 * near a ramp threshold (the terminator) — elsewhere a flat facet stays in its band,
 * so a subtle amplitude reads as grazing-light speckle, not a pulsing surface.
 *
 * BOIL_AMPLITUDE = 0 makes the injected term multiply to exactly zero → the material
 * is numerically identical to a stock MeshToonMaterial (the dial's off state).
 */
import * as THREE from 'three'
import { DIALS } from './tunables'
import { PLANET_ATLAS_K, PLANET_ATLAS_URL } from './planet-atlas-contract'

/** Default normal-tilt amplitude (unit-normal units ≈ radians of tilt). Subtle by
 *  design — Aram feel-tests on preview; 0 = off. The live value is DIALS.boilAmp
 *  (Round 9 tuning panel); this constant is the pinned default that seeds it. */
// Aram's verdict 2026-07-19: the boil reads as flickering/moving shadows — OFF
// by default. The mechanism stays (dial via the tuning panel / window override).
export const BOIL_AMPLITUDE = 0
/** Held-frame rate — the step counter is floor(elapsed·BOIL_FPS), so the phase
 *  holds for ~1/10 s then jumps (stepped, never smoothly interpolated). This is the
 *  pinned default that seeds DIALS.boilFps (the live value the frame loop reads). */
export const BOIL_FPS = 10

export type BoilUniforms = {
  uBoilAmp: { value: number }
  uBoilPhase: { value: number }
  /** T90 — the baked lighting atlas. Null until the image lands; never sampled at mix 0. */
  uBakeAtlas: { value: THREE.Texture | null }
  /** The highlight-normalised multiplier on the baked term (PLANET_ATLAS_K). */
  uBakeK: { value: number }
  /** The crossfade: 0 = today's toon lighting exactly, 1 = the bake. Driven by the ending's
   *  lights-up, so it is 0 for the whole journey. */
  uBakeMix: { value: number }
}

/**
 * A MeshToonMaterial (vertexColors + the shared clay ramp) with two injections:
 *
 *  1. the BOIL term in the vertex normal (Task 29 lever 5, above), and
 *  2. the T90 BAKED-LIGHTING crossfade in the fragment stage.
 *
 * Returns the material plus its live uniforms so the frame loop can advance the stepped phase and
 * drive the crossfade.
 *
 * ── THE BAKED-LIGHTING MOUNT (T90) ────────────────────────────────────────────────────────────
 *
 * Verified against the INSTALLED three (0.185.1), not assumed:
 *
 *  - The injection point is `#include <opaque_fragment>`. That is the chunk's name in this
 *    revision (older ones call it `<output_fragment>`); it is the last thing `meshtoon.glsl.js`
 *    runs before tone mapping and the output colour-space encode, so we are still in LINEAR
 *    working space here — which is the space the atlas's texels live in.
 *  - At that point `outgoingLight` (meshtoon frag :108) is
 *    `reflectedLight.directDiffuse + indirectDiffuse + totalEmissiveRadiance`, and every one of
 *    those terms is proportional to `diffuseColor` for a toon material with no emissive. So
 *    `outgoingLight / diffuseColor.rgb` recovers the pure LIGHTING term, which is exactly what
 *    the atlas stores and therefore what the crossfade must interpolate.
 *  - `diffuseColor` (meshtoon frag :83, then `<color_fragment>`) is `material.color * vColor`, and
 *    the land's colour is white × vertex colour — i.e. the albedo.
 *  - `vMapUv` does NOT exist here. `<uv_pars_vertex>` only emits it under `USE_MAP`, and this
 *    material has no map; `vUv` likewise needs `USE_UV`. So we declare and write our own varying
 *    rather than borrowing three's. The `uv` attribute itself IS always declared — WebGLProgram
 *    emits `attribute vec2 uv;` unconditionally in the vertex prefix (:625).
 *
 * BIT-IDENTITY AT MIX 0 is structural, not numerical. The entire baked block sits inside
 * `if (uBakeMix > 0.0)`, so on the whole journey not one arithmetic operation runs on the existing
 * path — no divide, no reconstruct, no re-multiply. Writing it as an unconditional `mix()` would
 * have round-tripped `outgoingLight` through a division and a multiplication and quietly changed
 * the shipped frame's last bits.
 */
export function makeBoilMaterial(ramp: THREE.DataTexture): {
  material: THREE.MeshToonMaterial
  uniforms: BoilUniforms
} {
  const material = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp })
  const uniforms: BoilUniforms = {
    uBoilAmp: { value: 0 },
    uBoilPhase: { value: 0 },
    uBakeAtlas: { value: null },
    uBakeK: { value: PLANET_ATLAS_K },
    uBakeMix: { value: 0 },
  }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBoilAmp = uniforms.uBoilAmp
    shader.uniforms.uBoilPhase = uniforms.uBoilPhase
    shader.uniforms.uBakeAtlas = uniforms.uBakeAtlas
    shader.uniforms.uBakeK = uniforms.uBakeK
    shader.uniforms.uBakeMix = uniforms.uBakeMix
    shader.vertexShader =
      'uniform float uBoilAmp;\nuniform float uBoilPhase;\nvarying vec2 vBakeUv;\n' +
      shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
      vBakeUv = uv;`
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>
      if (uBoilAmp > 0.0) {
        vec3 bp = position.xyz;
        float bh1 = fract(sin(dot(bp, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float bh2 = fract(sin(dot(bp, vec3(93.989, 67.345, 54.121))) * 24634.6345);
        float bh3 = fract(sin(dot(bp, vec3(43.332, 94.789, 28.918))) * 39428.2394);
        vec3 bdir = normalize(vec3(bh1, bh2, bh3) * 2.0 - 1.0);
        objectNormal = normalize(objectNormal + uBoilAmp * sin(uBoilPhase + bh1 * 6.2831853) * bdir);
      }`
    )
    shader.fragmentShader =
      'uniform sampler2D uBakeAtlas;\nuniform float uBakeK;\nuniform float uBakeMix;\nvarying vec2 vBakeUv;\n' +
      shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `if (uBakeMix > 0.0) {
        vec3 albedo = max(diffuseColor.rgb, vec3(1e-4));
        vec3 toonTerm = outgoingLight / albedo;
        vec3 bakedTerm = texture2D(uBakeAtlas, vBakeUv).rgb * uBakeK;
        outgoingLight = diffuseColor.rgb * mix(toonTerm, bakedTerm, uBakeMix);
      }
      #include <opaque_fragment>`
    )
  }
  return { material, uniforms }
}

/**
 * Loads the baked lighting atlas and applies the sampler settings the bake requires.
 *
 * This is the lab's first standalone texture — everything else arrives inside a GLTF — so every
 * one of these settings is a decision, not a default:
 *
 *  - **`NoColorSpace`, not `SRGBColorSpace`.** The atlas is DATA (a lighting multiplier with the
 *    albedo divided out), and it was written as Non-Color on the Blender side. Tagging it sRGB
 *    would apply a decode transfer function to numbers that never had an encode, and the planet
 *    over-brightens — the exact trap the spike paid for once (§5b: 82.9% of the planet clipped).
 *  - **`RepeatWrapping` in u, `ClampToEdgeWrapping` in v.** The per-face seam repair pushes a
 *    straddling face's trailing corners past u = 1 on purpose, so u must wrap. v never leaves
 *    [0,1] and clamping it keeps the poles from sampling the opposite hemisphere.
 *  - **Mipmaps ON, trilinear minification.** At the money shot the planet is ~320 px wide against
 *    a 512-wide sheet, so this is a MINIFICATION, and the atlas's known artifact is per-face
 *    blockiness — precisely the high-frequency content that aliases and crawls when a minified
 *    texture is sampled without a mip chain. The cost is a third again of a 512² texture.
 *
 * `onReady` fires once the image has actually decoded. Until then the caller must hold the
 * crossfade at 0: the texture object exists from the first frame but has no image behind it, and
 * a sampler with no image reads black. At mix 0 nothing samples it at all, which is why the whole
 * journey is available as loading time.
 */
export function loadPlanetAtlas(onReady?: () => void): THREE.Texture {
  const tex = new THREE.TextureLoader().load(PLANET_ATLAS_URL, () => onReady?.())
  tex.colorSpace = THREE.NoColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  return tex
}

/** The current boil amplitude. The window.SMALL_WORLD_BOIL override (the capture A/B/off
 *  proof) still wins when set; otherwise the tuning-panel dial DIALS.boilAmp drives it —
 *  panel and global both feed this one uniform. Default DIALS.boilAmp.value = 0. */
export function boilAmplitude(): number {
  if (typeof window !== 'undefined') {
    const o = (window as unknown as { SMALL_WORLD_BOIL?: number }).SMALL_WORLD_BOIL
    if (o != null && !Number.isNaN(Number(o))) return Number(o)
  }
  return DIALS.boilAmp.value
}
