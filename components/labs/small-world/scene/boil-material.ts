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

/** Default normal-tilt amplitude (unit-normal units ≈ radians of tilt). Subtle by
 *  design — Aram feel-tests on preview; 0 = off. Overridable at runtime via
 *  window.SMALL_WORLD_BOIL for the capture A/B/off proof. */
// Aram's verdict 2026-07-19: the boil reads as flickering/moving shadows — OFF
// by default. The mechanism stays (dial via the tuning panel / window override).
export const BOIL_AMPLITUDE = 0
/** Held-frame rate — the step counter is floor(elapsed·BOIL_FPS), so the phase
 *  holds for ~1/10 s then jumps (stepped, never smoothly interpolated). */
export const BOIL_FPS = 10

export type BoilUniforms = {
  uBoilAmp: { value: number }
  uBoilPhase: { value: number }
}

/**
 * A MeshToonMaterial (vertexColors + the shared clay ramp) with the boil term
 * injected into the vertex normal. Returns the material plus its live uniforms so
 * the frame loop can advance the stepped phase.
 */
export function makeBoilMaterial(ramp: THREE.DataTexture): {
  material: THREE.MeshToonMaterial
  uniforms: BoilUniforms
} {
  const material = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp })
  const uniforms: BoilUniforms = { uBoilAmp: { value: 0 }, uBoilPhase: { value: 0 } }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBoilAmp = uniforms.uBoilAmp
    shader.uniforms.uBoilPhase = uniforms.uBoilPhase
    shader.vertexShader =
      'uniform float uBoilAmp;\nuniform float uBoilPhase;\n' + shader.vertexShader
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
  }
  return { material, uniforms }
}

/** The current boil amplitude, honouring the runtime override used by captures. */
export function boilAmplitude(): number {
  if (typeof window !== 'undefined') {
    const o = (window as unknown as { SMALL_WORLD_BOIL?: number }).SMALL_WORLD_BOIL
    if (o != null && !Number.isNaN(Number(o))) return Number(o)
  }
  return BOIL_AMPLITUDE
}
