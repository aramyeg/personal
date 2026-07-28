import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../palette'
import { BIOME_MOODS, moodBlendAt } from '../overlay/grade-mood'
import type { MoodBlend } from '../overlay/grade-mood'
import type { JourneyRef } from './use-journey'

/**
 * Butter-cream to pink-horizon gradient backdrop.
 *
 * Sized with generous margin so the pitched camera's frustum can never see
 * past its edges (the visible band at z=-20 spans roughly y in [-19, 4],
 * x in [-20, 20] at wide aspects — the plane spans [-55, 35] x [-70, 70]).
 * The gradient band is mapped to the slice of the plane the camera actually
 * frames, so the horizon glow sits low in the composition.
 *
 * Task 55 — the two gradient stops are now uniforms, pulled toward the current chapter's mood as
 * the traveller arrives at its checkpoint (grade-mood.ts). This is the "whole background changes
 * colour" half of the cinematic grade: it repaints the air behind the little world and cannot
 * touch anything drawn in front of it. Without a `journeyRef` — and whenever the grade is switched
 * off — the uniforms hold the base palette exactly, so the backdrop is identical to its old self.
 *
 * The uniforms carry RAW sRGB components rather than THREE.Color: this is a bare ShaderMaterial
 * writing gl_FragColor directly, with no output-encoding chunk, so the palette hex has to reach
 * the framebuffer unconverted — which is exactly what the old inlined constants did.
 */
export function Sky({ journeyRef }: { journeyRef?: JourneyRef }) {
  const uniforms = useMemo(
    () => ({ uSky: { value: srgb(PALETTE.sky) }, uGlow: { value: srgb(PALETTE.horizon) } }),
    []
  )

  useFrame(() => {
    if (!journeyRef) return
    const j = journeyRef.current
    const b = moodBlendAt(j.progress, j.reveal)
    uniforms.uSky.value.copy(BASE_SKY).lerp(target(MOOD_SKY, b), b.skyMix)
    // The glow trails the sky a little: keeping more of the original light low in the frame stops
    // the horizon flattening out once a mood is fully in.
    uniforms.uGlow.value.copy(BASE_GLOW).lerp(target(MOOD_GLOW, b), b.skyMix * GLOW_LAG)
  })

  return (
    <mesh position={[0, -10, -20]} scale={[140, 90, 1]}>
      <planeGeometry />
      <shaderMaterial
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`}
        fragmentShader={`
          uniform vec3 uSky;
          uniform vec3 uGlow;
          varying vec2 vUv;
          void main(){
            vec3 col = mix(uGlow, uSky, smoothstep(0.42, 0.66, vUv.y));
            float vig = smoothstep(0.55, 0.28, distance(vUv, vec2(0.5, 0.55)));
            gl_FragColor = vec4(col * (0.94 + 0.06 * vig), 1.0);
          }`}
      />
    </mesh>
  )
}

/** How far the horizon glow travels relative to the high sky. */
const GLOW_LAG = 0.9

/** `#RRGGBB` → raw sRGB components (no colour-space conversion). */
function srgb(hex: string): THREE.Vector3 {
  const n = parseInt(hex.slice(1), 16)
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

// Every colour the backdrop can reach, parsed once. The frame loop only lerps.
const BASE_SKY = srgb(PALETTE.sky)
const BASE_GLOW = srgb(PALETTE.horizon)
const MOOD_SKY = BIOME_MOODS.map((m) => srgb(m.sky))
const MOOD_GLOW = BIOME_MOODS.map((m) => srgb(m.glow))
const SCRATCH = new THREE.Vector3()

/**
 * The colour the backdrop is heading for: the scroll crossfade between two neighbouring moods,
 * then pulled onto the arriving chapter's mood (grade-mood.ts owns why it is a pull and not a
 * gate). Indexes with the blend's OWN `fromIndex`/`toIndex` rather than re-deriving the pairing,
 * so this table can never crossfade a different pair than the overlay does. Writes into one module
 * scratch — the frame loop allocates nothing.
 */
function target(table: THREE.Vector3[], b: MoodBlend): THREE.Vector3 {
  SCRATCH.copy(table[b.fromIndex]).lerp(table[b.toIndex], b.mix)
  return b.revealChapter === null
    ? SCRATCH
    : SCRATCH.lerp(table[b.revealChapter], b.revealPull)
}
