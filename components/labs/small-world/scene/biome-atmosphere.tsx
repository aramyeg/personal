import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../palette'
import { BIOME_MOODS, moodBlendAt } from '../overlay/grade-mood'
import type { MoodBlend } from '../overlay/grade-mood'
import { Sky } from './sky'
import type { JourneyRef } from './use-journey'

/**
 * Task 55 — the scene half of the CINEMATIC BIOME GRADE: the backdrop and the light the little
 * world is lit by, both keyed to the chapter the traveller is arriving at (grade-mood.ts owns the
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

const BASE_KEY = new THREE.Color(PALETTE.keyWarm)
const BASE_AMBIENT = new THREE.Color('#FFFFFF')
const MOOD_CAST = BIOME_MOODS.map((m) => new THREE.Color(m.cast))
const SCRATCH = new THREE.Color()

/**
 * The light colour the mood is heading for: the scroll crossfade between two neighbouring moods,
 * then pulled onto the arriving chapter's mood (grade-mood.ts owns why it is a pull and not a
 * gate). One module scratch — the frame loop allocates nothing.
 */
function target(b: MoodBlend): THREE.Color {
  SCRATCH.copy(MOOD_CAST[Math.max(0, b.chapter - 1)]).lerp(MOOD_CAST[b.chapter], b.mix)
  return b.revealChapter === null
    ? SCRATCH
    : SCRATCH.lerp(MOOD_CAST[b.revealChapter], b.revealPull)
}

export function BiomeAtmosphere({ journeyRef }: { journeyRef: JourneyRef }) {
  const key = useRef<THREE.DirectionalLight>(null)
  const ambient = useRef<THREE.AmbientLight>(null)

  useFrame(() => {
    const j = journeyRef.current
    const b = moodBlendAt(j.progress, j.reveal)
    if (key.current) key.current.color.copy(BASE_KEY).lerp(target(b), b.lightMix)
    if (ambient.current) {
      ambient.current.color.copy(BASE_AMBIENT).lerp(target(b), b.lightMix * AMBIENT_FOLLOW)
    }
  })

  return (
    <>
      <Sky journeyRef={journeyRef} />
      {/* Lower ambient so the 4-step ramp actually bands across the form — high
          fill washed the clay creases into a soft haze. */}
      <ambientLight ref={ambient} intensity={0.42} />
      {/* Warm key raking from the upper-left, low enough that the terminator
          crosses the visible face — shadow pools in the clay dents and reads the
          toon bands as pinched facets. */}
      <directionalLight ref={key} position={[-6, 2, 3.2]} intensity={1.55} color={PALETTE.keyWarm} />
    </>
  )
}
