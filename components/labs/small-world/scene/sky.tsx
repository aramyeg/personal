import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BIOME_MOODS, GRADE_BASE, moodBlendAt } from '../overlay/grade-mood'
import type { MoodBlend } from '../overlay/grade-mood'
import { cameraZoomScale } from './camera'
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
 * Task 55 — the two gradient stops are now uniforms, pulled toward the mood of the wedge the girl
 * is walking on (grade-mood.ts). This is the "whole background changes colour" half of the
 * cinematic grade: it repaints the air behind the little world and cannot touch anything drawn in
 * front of it. Without a `journeyRef` — and whenever the grade is switched off — the uniforms hold
 * the base palette exactly, so the backdrop is identical to its old self.
 *
 * The uniforms carry RAW sRGB components rather than THREE.Color: this is a bare ShaderMaterial
 * writing gl_FragColor directly, with no output-encoding chunk, so the palette hex has to reach
 * the framebuffer unconverted — which is exactly what the old inlined constants did.
 *
 * TASK 63 — THE SKY SURVIVES THE PULL-BACK BY BEING SCALED, NOT RESIZED.
 * The "generous margin" above was measured for ONE camera distance, and the ending's zoom-out
 * moves the camera to 3× that. Two things go wrong if the plane just sits there: the frustum
 * eventually walks off its edges, and — long before that — it sweeps a much bigger slice of the
 * gradient, so the horizon band shrinks into the middle of the frame and the composition the
 * stops were tuned for comes apart (measured: the framed vUv.y band widens from [0.374, 0.651] to
 * [0.262, 0.738], while the ramp stays at [0.42, 0.66]).
 *
 * Both are fixed by one multiply. The camera travels ALONG the view ray, i.e. its position is
 * `k · P0` for the same k this scales by, and it keeps aiming at the origin — so scaling the sky
 * about the origin by k is a uniform scale of a camera-plus-subject pair, and a uniform scale
 * about the projection's own centre leaves the projection EXACTLY unchanged. The sky therefore
 * renders identically at every zoom, which is also what an infinitely-far backdrop should do,
 * and the no-edges property is inherited rather than re-tuned. The planet does NOT scale — it
 * shrinking in frame is the whole reveal.
 */

/** Rest pose of the backdrop plane. Everything is a multiple of these, so one number moves it. */
const SKY_POSITION: readonly [number, number, number] = [0, -10, -20]
const SKY_SCALE: readonly [number, number] = [140, 90]

export function Sky({ journeyRef }: { journeyRef?: JourneyRef }) {
  const uniforms = useMemo(
    () => ({ uSky: { value: srgb(GRADE_BASE.sky) }, uGlow: { value: srgb(GRADE_BASE.glow) } }),
    []
  )
  const mesh = useRef<THREE.Mesh>(null)
  // NaN so the mount frame always applies once (NaN !== NaN) — a write of the same values the
  // JSX props carry — and every frame after it costs one float compare until the pull-back starts.
  const lastScale = useRef(Number.NaN)

  useFrame(() => {
    if (!journeyRef) return
    const j = journeyRef.current
    const b = moodBlendAt(j.progress)
    uniforms.uSky.value.copy(BASE_SKY).lerp(target(MOOD_SKY, b), b.skyMix)
    // The glow trails the sky a little: keeping more of the original light low in the frame stops
    // the horizon flattening out once a mood is fully in.
    uniforms.uGlow.value.copy(BASE_GLOW).lerp(target(MOOD_GLOW, b), b.skyMix * GLOW_LAG)

    const k = cameraZoomScale(j.ending)
    if (k !== lastScale.current && mesh.current) {
      lastScale.current = k
      mesh.current.position.set(SKY_POSITION[0] * k, SKY_POSITION[1] * k, SKY_POSITION[2] * k)
      mesh.current.scale.set(SKY_SCALE[0] * k, SKY_SCALE[1] * k, 1)
    }
  })

  return (
    <mesh ref={mesh} position={[...SKY_POSITION]} scale={[SKY_SCALE[0], SKY_SCALE[1], 1]}>
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

// Every colour the backdrop can reach, parsed once. The frame loop only lerps. The two ungraded
// stops come from GRADE_BASE rather than straight out of the palette, so the grade's distinctness
// gate resolves the same colours this shader will actually show.
const BASE_SKY = srgb(GRADE_BASE.sky)
const BASE_GLOW = srgb(GRADE_BASE.glow)
const MOOD_SKY = BIOME_MOODS.map((m) => srgb(m.sky))
const MOOD_GLOW = BIOME_MOODS.map((m) => srgb(m.glow))
const SCRATCH = new THREE.Vector3()

/**
 * The colour the backdrop is heading for: the crossfade between the wedge she has left and the one
 * under her feet (grade-mood.ts owns where that boundary is). Indexes with the blend's OWN
 * `fromIndex`/`toIndex` rather than re-deriving the pairing, so this table can never crossfade a
 * different pair than the overlay does. Writes into one module scratch — the frame loop allocates
 * nothing.
 */
function target(table: THREE.Vector3[], b: MoodBlend): THREE.Vector3 {
  return SCRATCH.copy(table[b.fromIndex]).lerp(table[b.toIndex], b.mix)
}
