/**
 * Every tunable for /labs/cloth-pull in one object.
 *
 * Staging (Aram's restage, 2026-08-08): the chibi walks FORWARD (screen
 * right) with her hands behind her back, towing the cloth banner behind her
 * on two strings. One verlet chain — pinned only at her fists, free at the
 * far end — carries a short string run and then the cloth's top hem; the
 * banner poses analytically off that chain. The stage is a treadmill: she
 * walks in place, floor marks scroll, a travel-drag force streams the cloth.
 *
 * World convention: SIM runs in y-DOWN pixel space; the render layer flips
 * to three's y-up at write time.
 */

export const CFG = {
  chain: {
    /** verlet points along string + top hem */
    n: 44,
    /** spring stiffness toward the art-directed trailing baseline */
    baselineStiffness: 90,
    gravity: 210,
    damping: 0.975,
    /** Jacobi distance-constraint iterations per step */
    iterations: 8,
    /** Laplacian smoothing factor applied after constraints */
    smooth: 0.14,
    /** slack multiplier on the segment rest length */
    slack: 1.005,
    /** designed droop of the trailing baseline at zero speed, frac of vh */
    droop: 0.06,
    /** droop shrinks toward this fraction at full cruise */
    droopMovingFrac: 0.45,
    /** travel drag: leftward force per px/s of speed, per point */
    travelDrag: 0.9,
    /** ambient wind force amplitudes */
    windX: 90,
    windY: 70,
    /** string run between fists and the cloth's leading corner, frac of vw */
    stringFrac: 0.055,
    stringMin: 44,
  },

  banner: {
    /** cloth grid resolution (desktop / low-power) */
    segX: 24,
    segY: 10,
    segXLow: 16,
    segYLow: 8,
    /** banner width cap, px */
    widthMax: 860,
    /** sewn channel between the chain and the painted cloth top, px */
    hemChannel: 6,
    /** hem pushed back in z: rake * v^rakePow */
    rake: -70,
    rakePow: 0.85,
    /** wave amplitude clamps: min(height * ampH, width * ampW) */
    ampH: 0.21,
    ampW: 0.085,
    waveLenU: 11.5,
    waveLenV: 2.6,
    waveSpeed: 4.0,
    curl: 0.5,
    /** swing spring on the rigid-body angle DOF */
    swingK: 30,
    swingDamp: 4.2,
    swingAccGain: 0.0009,
    swingWindGain: 1.4,
    swingMax: 0.12,
    /** hem trails backward with speed: radians per px/s */
    speedTilt: 0.0011,
    speedTiltMax: 0.38,
    /** cloth weight fed back into the chain along the hem span */
    weight: 760,
    /** legibility: wave-amp dip over the type region */
    textCalm: 0.55,
    textU0: 0.16,
    textU1: 0.84,
    textV0: 0.14,
    textV1: 0.78,
    /** ambient energy floor so the cloth never goes static */
    idleEnergy: 0.34,
  },

  paint: {
    oversample: 1.35,
    dprCap: 2,
    maxTexWidth: 4096,
    maxLines: 3,
    fontFamily:
      '"Bricolage Grotesque Variable", "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif',
    maxFontFrac: 0.34,
    minFontPx: 18,
    lineHeight: 1.16,
    padX: 0.1,
  },

  motion: {
    /** cruise walking speed, px/s of ground scroll */
    cruise: 110,
    /** spring pulling speed toward its target */
    speedK: 3.2,
    /** stretch the chain always carries (weight + drag) — braking ignores it */
    stretchIdle: 0.022,
    /** braking beyond the idle stretch, px/s per unit stretch */
    brakePerStretch: 1700,
    /** flick boost decay, 1/s */
    boostDecay: 1.8,
    /** keyboard nudge boost, px/s */
    keyBoost: 160,
    /** intro walk-in speed, frac of vw per second */
    introSpeedFrac: 0.3,
    /** effort springs (jerry's posture feel) */
    effortRise: 6,
    effortFall: 2.2,
    /** effort from chain stretch: stretch fraction at which effort = 1 */
    stretchRef: 0.06,
    /** effort from speed deficit under cruise */
    deficitGain: 0.6,
    /** how close to the drawn cloth a pointerdown must land to grab it, px.
     * Was `grabRange`, declared and never wired: every pointerdown grabbed,
     * anywhere on the stage, including on the chibi herself. */
    grabPick: 36,
  },

  chibi: {
    /** spring on the forward-lean overlay */
    leanK: 150,
    leanDamp: 16,
    /** max forward lean overlay, radians, spread over the spine chain */
    leanMax: 0.32,
    leanSpread: [1.0, 0.85, 0.6] as const,
    /** walk clip playback rate range mapped from speed/cruise */
    rateMin: 0.5,
    rateMax: 1.9,
    fade: 0.25,
  },

  scene: {
    fixedDt: 1 / 60,
    maxDt: 1 / 20,
    dprCap: 2,
    /** string tube radius px */
    stringRadius: 1.7,
    stringSides: 5,
    stringSamples: 28,
    /** floor scroll marks */
    markSpacing: 170,
  },
} as const

export type ClothPullConfig = typeof CFG

/** Per-viewport composition. She stands right-of-center; cloth trails left. */
export interface StageLayout {
  chibiHeightFrac: number
  /** her standing x, fraction of viewport width */
  chibiXFrac: number
  bannerWidthFrac: number
  bannerAspect: number
  /** chibi feet line, fraction of viewport height */
  floorFrac: number
}

export function layoutFor(w: number): StageLayout {
  if (w < 760) {
    return {
      chibiHeightFrac: 0.3,
      chibiXFrac: 0.78,
      bannerWidthFrac: 0.6,
      bannerAspect: 0.52,
      floorFrac: 0.72,
    }
  }
  return {
    chibiHeightFrac: 0.52,
    chibiXFrac: 0.76,
    bannerWidthFrac: 0.48,
    bannerAspect: 0.36,
    floorFrac: 0.79,
  }
}

/** The default message painted on the cloth; overridable via ?m= */
export const DEFAULT_MESSAGE = "Hi! I'm Aram."
