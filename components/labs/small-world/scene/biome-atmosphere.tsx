import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BIOME_MOODS, GRADE_BASE, moodBlendAt } from '../overlay/grade-mood'
import type { MoodBlend } from '../overlay/grade-mood'
import { gradeHoldFor, studioLightsFor } from './desk-studio'
import { Sky } from './sky'
import type { JourneyRef } from './use-journey'

/**
 * Task 55 — the scene half of the CINEMATIC BIOME GRADE: the backdrop and the light the little
 * world is lit by, both keyed to the wedge under the traveller's feet (grade-mood.ts owns the
 * moods and the timing).
 *
 * The light is the part that makes it read as a grade rather than a filter. Tinting the key and
 * the ambient means every clay figure — the planet's biome palettes, the girl, the corner mascots
 * — keeps its own hue and simply stands in the biome's light; a flat tint laid over the frame
 * instead flattens them all toward one colour (the first cut did exactly that, and turned a
 * scarlet macaw brown-green). It also unifies the frame when the visible face of the planet is
 * not the chapter's own wedge, which at a parked checkpoint it usually is not.
 *
 * The mixes are toward PALE colours and capped (LIGHT_MIX_MAX), so illumination shifts while
 * material identity does not. Intensities are never touched: nothing here can make the scene
 * dark, and the toon ramp keeps banding at the same thresholds.
 */

/** How far the ambient fill follows the key light's tint — kept lower so shadows stay neutral. */
const AMBIENT_FOLLOW = 0.7

/**
 * Where the one key light stands. Exported because the desk's big flat surfaces author their own
 * normals against it (Task 65) — a horizontal plane takes only dot(N,L) = 0.28 from here and lands
 * two bands down the clay ramp, which is a fifth of the albedo lost on the largest surface in the
 * ending. Importing the position rather than restating it means a lighting retune cannot silently
 * leave the desk shading toward a light that has moved.
 */
export const KEY_LIGHT_POSITION: readonly [number, number, number] = [-6, 2, 3.2]

const BASE_KEY = new THREE.Color(GRADE_BASE.key)
const BASE_AMBIENT = new THREE.Color(GRADE_BASE.ambient)
const MOOD_CAST = BIOME_MOODS.map((m) => new THREE.Color(m.cast))
const SCRATCH = new THREE.Color()

/**
 * The light colour the mood is heading for: the crossfade between the wedge she has left and the
 * one under her feet (grade-mood.ts owns where that boundary is). Indexes with the blend's OWN
 * `fromIndex`/`toIndex` rather than re-deriving the pairing, so the lights can never crossfade a
 * different pair than the sky or the overlay. One module scratch — the frame loop allocates
 * nothing.
 */
function target(b: MoodBlend): THREE.Color {
  return SCRATCH.copy(MOOD_CAST[b.fromIndex]).lerp(MOOD_CAST[b.toIndex], b.mix)
}

/**
 * THE GRADE LETS GO OF THE LIGHT AS THE STUDIO ARRIVES (Task 71).
 *
 * `moodBlendAt` clamps at progress 1, so through the whole ending it holds WINTER's cold pale cast —
 * correct for a girl walking a snow wedge, wrong for a clay figurine standing on a desk in a lit
 * studio, and measured at 39-53% under the approved render on the note, the bluebird and the planet.
 * Aram's decision was BRIGHTEN, so the tint is scaled by how much of the journey is still on the
 * frame: exactly 1 through the journey and the still beat, exactly 0 at the money shot.
 *
 * A MIX, NOT AN INTENSITY. What relaxes is how far the lights travel toward the mood's pale cast;
 * the two intensities are untouched, exactly as the grade's own rail requires. So the ending's light
 * returns to `GRADE_BASE` — the ungraded key and ambient the lab opens on — rather than to some new
 * studio-specific light nobody has judged. Nothing here can make the scene darker, and the toon ramp
 * keeps banding at the same thresholds.
 *
 * Exported as a pure function of the two inputs so `biome-grade.test.tsx` can hold the release to
 * the same ends the grade itself is held to, without a canvas.
 */
export const releasedLightMix = (lightMix: number, hold: number): number => lightMix * hold

/**
 * ============================================================================
 * THE STUDIO REACHES THE CLAY (Task 76)
 * ============================================================================
 * Task 68 wrote the law that the studio may never touch clay, and it was the right
 * law while the studio was a thing that arrived unannounced. Task 76 revises it
 * deliberately, and narrows it in the same breath:
 *
 *   the studio reaches the clay ONLY through the scroll-gated ending grade.
 *
 * The journey is untouched — not approximately, bit-for-bit. `studioLightsFor` is
 * exactly 0 for every progress at or below `ZOOM_FIRST_MOVE` (`smootherstep(0)` is
 * exactly 0), and `base + (studio − base) · 0` is exactly `base` in IEEE-754, so
 * every one of the six chapters renders through the same two numbers it always did.
 * `biome-grade.test.tsx` pins the identity and a capture-diff against tip 74a3f50
 * pins the frame.
 *
 * WHAT THE CLAY WAS ACTUALLY DOING WRONG, measured against the approved reference
 * render through the globe's own solved silhouette rather than a drawn box
 * (`bench/globe.mjs`, disc from `globeEdgesAt`):
 *
 *   axis           reference   before   after    reading
 *   mean luminance 0.6007      0.3928   0.5686   34.6% dark → 5.3% dark
 *   median         0.6323      0.4414   0.6391   lands within 1.1%
 *   95th           0.7504      0.5554   0.7157   the lights get up
 *   railed low     0.0000      0.0191   0.0001   the black is gone from a room that contains none
 *   mean chroma    0.2535      0.3051   0.2222   1.20x over → 0.88x under; nearer either way
 *
 * The cause is the LIGHT RIG rather than the materials: one raking key at 1.55
 * against a 0.42 fill is a dramatic outdoor rig, and a photographic studio is the
 * opposite — a large soft source and a fill big enough that nothing in the frame is
 * ever properly dark. So the FILL is what walks, and it walks a long way.
 *
 * It works because ambient light in three's toon shading is INDIRECT irradiance: it
 * bypasses the gradient map entirely and lands as a flat term, so raising it lifts
 * the shadow band without adding a band.
 *
 * THE KEY WAS SWEPT AND LEFT WHERE IT WAS. Dropping it to 1.18 was the obvious
 * companion move and it bought nothing measurable: `|grad|/sd` did not shift at all
 * (1.76x of the reference either way), because that ratio is normalised and the
 * cliff and the spread scale together — and the mean fell another 5 points for it.
 * Four settings were captured and measured; 1.55/1.62 is the one that minimises the
 * WORST axis (12% on chroma) rather than the one that best flatters any single one
 * (1.55/1.85 lands the mean at −1.5% and costs 16% of chroma).
 *
 * TWO AXES DO NOT TRANSFER, and saying so is part of the measurement. The 5th
 * percentile stays 0.175 against the reference's 0.348, and the mean absolute
 * gradient stays ~2.7x — both because the two globes are not the same OBJECT. The
 * lab's darkest 5% measures sRGB (48,87,87) and is 44.8% blue-dominant: it is the
 * deep ocean and the fir trees, dark by ALBEDO. The reference's darkest 5% measures
 * (158,153,122) and is 3.3% blue-dominant — a pastel stand-in globe that contains no
 * dark material and no props at all. No light rig closes a gap made of paint. The
 * same applies to the gradient: a globe carrying firs, snowmen and umbrellas has
 * edges a smooth Blender sphere does not.
 *
 * That is also why there is NO added contact occlusion toward the cradle, which the
 * brief offered: the axis it would move is the globe's lower cap, and the lab's
 * lower cap is already darker than the reference's, not lighter. Adding shadow
 * where the measurement says there is too much of it would be decoration.
 *
 * Nothing else in the frame moves. The desk asset is `MeshBasicMaterial` (it
 * carries its own two bakes), the backdrop is a bare `ShaderMaterial`, and neither
 * has a light input at all — so these two numbers reach the clay and only the clay,
 * which is exactly the scoping the revised law asks for.
 */

/** The journey's rig: a raking key and a fill low enough that the 4-step ramp bands. */
export const KEY_INTENSITY = 1.55
export const AMBIENT_INTENSITY = 0.42

/**
 * ...and the studio's, chosen by sweep against the reference (see above). The key is
 * deliberately the SAME NUMBER: it was swept and left, and naming it here rather
 * than dropping the term records that the choice was made instead of skipped.
 */
export const STUDIO_KEY_INTENSITY = 1.55
export const STUDIO_AMBIENT_INTENSITY = 1.62

/**
 * A light's intensity at a given lights-up. Exactly `base` at 0 and exactly
 * `studio` at 1 — the whole determinism argument, in one line of arithmetic.
 */
export const studioLitIntensity = (base: number, studio: number, lights: number): number =>
  base + (studio - base) * lights

export function BiomeAtmosphere({ journeyRef }: { journeyRef: JourneyRef }) {
  const key = useRef<THREE.DirectionalLight>(null)
  const ambient = useRef<THREE.AmbientLight>(null)

  useFrame(() => {
    const j = journeyRef.current
    const b = moodBlendAt(j.progress)
    const mix = releasedLightMix(b.lightMix, gradeHoldFor(j.ending))
    const lights = studioLightsFor(j.ending)
    if (key.current) {
      key.current.color.copy(BASE_KEY).lerp(target(b), mix)
      key.current.intensity = studioLitIntensity(KEY_INTENSITY, STUDIO_KEY_INTENSITY, lights)
    }
    if (ambient.current) {
      ambient.current.color.copy(BASE_AMBIENT).lerp(target(b), mix * AMBIENT_FOLLOW)
      ambient.current.intensity = studioLitIntensity(
        AMBIENT_INTENSITY,
        STUDIO_AMBIENT_INTENSITY,
        lights
      )
    }
  })

  return (
    <>
      <Sky journeyRef={journeyRef} />
      {/* Lower ambient so the 4-step ramp actually bands across the form — high
          fill washed the clay creases into a soft haze. */}
      <ambientLight ref={ambient} intensity={AMBIENT_INTENSITY} />
      {/* Warm key raking from the upper-left, low enough that the terminator
          crosses the visible face — shadow pools in the clay dents and reads the
          toon bands as pinched facets. Both intensities are re-written every frame
          (see the studio block above); the props are the journey's values so the
          very first paint is already correct. */}
      <directionalLight
        ref={key}
        position={KEY_LIGHT_POSITION}
        intensity={KEY_INTENSITY}
        color={GRADE_BASE.key}
      />
    </>
  )
}
