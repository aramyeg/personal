/**
 * Every tunable for /labs/cloth-pull in one object, jerry-style.
 * Numbers seeded from the task-01 proof; tuned by capture afterwards.
 *
 * World convention: SIM runs in y-DOWN pixel space (like the proof);
 * the render layer flips to three's y-up at write time.
 */

export const CFG = {
  rope: {
    /** verlet points along the line */
    n: 52,
    /** designed sag as a fraction of viewport height */
    sag: 0.045,
    /** spring stiffness pulling each point toward the art-directed baseline */
    baselineStiffness: 110,
    gravity: 180,
    damping: 0.978,
    /** Jacobi distance-constraint iterations per step */
    iterations: 6,
    /** Laplacian smoothing factor applied after constraints */
    smooth: 0.16,
    /** rest-length shortening per unit of tension (pull tautens the line) */
    tensionShorten: 0.022,
    /** slack multiplier on the initial segment length */
    slack: 1.01,
    /** ambient wind force amplitudes (x, y) */
    windX: 120,
    windY: 60,
  },

  banner: {
    /** cloth grid resolution (desktop) */
    segX: 24,
    segY: 10,
    /** cloth grid resolution (low-power / mobile) */
    segXLow: 16,
    segYLow: 8,
    /** hanging loops sampling the rope curve */
    loops: 5,
    /** banner width cap, px */
    widthMax: 860,
    /** loop thread length, px */
    threadLen: 26,
    /** hem pushed back in z: rake * v^rakePow */
    rake: -70,
    rakePow: 0.85,
    /** wave amplitude clamps: min(height * ampH, width * ampW) */
    ampH: 0.21,
    ampW: 0.085,
    /** wave phase field */
    waveLenU: 11.5,
    waveLenV: 2.6,
    waveSpeed: 4.0,
    /** corner furl strength */
    curl: 0.5,
    /** swing spring on the rigid-body angle DOF */
    swingK: 30,
    swingDamp: 4.2,
    swingAccGain: 0.0009,
    swingWindGain: 1.4,
    swingMax: 0.12,
    /** weight fed back into the rope, split across loops (px/s^2 kernel force) */
    weight: 900,
    /** legibility: wave-amp dip over the type region (0..1 = full calm) */
    textCalm: 0.55,
    /** type region in uv space, softened by smoothstep margins */
    textU0: 0.16,
    textU1: 0.84,
    textV0: 0.14,
    textV1: 0.78,
    /** ambient energy floor so the cloth never goes static */
    idleEnergy: 0.34,
  },

  paint: {
    /** oversample multiplier on top of min(dpr, dprCap) */
    oversample: 1.35,
    dprCap: 2,
    /** hard guard on texture width, px */
    maxTexWidth: 4096,
    maxLines: 3,
    fontFamily:
      '"Bricolage Grotesque Variable", "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif',
    /** fraction of banner height the biggest line may take */
    maxFontFrac: 0.34,
    minFontPx: 18,
    lineHeight: 1.16,
    /** horizontal padding fraction kept clear of type */
    padX: 0.1,
  },

  drive: {
    /** release spring toward the rest haul distance */
    springK: 120,
    springDamp: 19,
    /** flick: velocity (px/s) beyond which release keeps momentum */
    flickVel: 520,
    /** effort smoothing: effort tracks |velocity| / effortVelRef */
    effortVelRef: 900,
    effortRise: 7,
    effortFall: 2.4,
    /** haul distance the intro travels (fraction of viewport width) */
    introFrac: 0.62,
    introDuration: 2.5,
    /** soft clamp range around rest, fractions of viewport width */
    overhaulFrac: 0.1,
    underhaulFrac: 0.85,
    /** keyboard nudge, px */
    keyStep: 140,
    /** idle inviting tug: period (s) and impulse (px/s) */
    tugPeriod: 4.6,
    tugImpulse: 260,
  },

  chibi: {
    /** effort spring on the lean overlay (jerry's posture numbers) */
    leanK: 150,
    leanDamp: 16,
    /** max lean overlay, radians, spread over the spine chain */
    leanMax: 0.42,
    /** extra effort fed to the pose while the user holds the line */
    gripEffort: 0.3,
    leanSpread: [1.0, 0.85, 0.6] as const,
    /** haul clip playback rate range mapped from effort */
    rateMin: 0.55,
    rateMax: 1.75,
    /** crossfade time between hold and haul clips, s */
    fade: 0.25,
  },

  scene: {
    /** rope endpoints, fractions of viewport (anchor far enough right that
     * the banner can start fully off-screen while still riding the rope) */
    anchorXFrac: 1.65,
    handXFrac: 0.2,
    /** fixed sim timestep and clamp */
    fixedDt: 1 / 60,
    maxDt: 1 / 20,
    dprCap: 2,
    /** rope tube radius px and radial segments */
    ropeRadius: 3.2,
    ropeSides: 6,
    ropeSamples: 96,
    /** braid stripe lay length, px per twist (texture scroll ties to haul) */
    ropeLay: 26,
  },
} as const

export type ClothPullConfig = typeof CFG

/** Per-viewport composition: how the stage is divided between chibi and cloth. */
export interface StageLayout {
  chibiHeightFrac: number
  chibiXFrac: number
  bannerWidthFrac: number
  bannerAspect: number
  /** where the banner center rests on the rope once hauled in */
  restCenterFrac: number
  /** chibi feet line, fraction of viewport height */
  floorFrac: number
}

export function layoutFor(w: number): StageLayout {
  if (w < 760) {
    // phone: smaller chibi tucked left, taller banner owning the width,
    // whole stage lifted so it doesn't sit in the bottom third
    return {
      chibiHeightFrac: 0.3,
      chibiXFrac: 0.12,
      bannerWidthFrac: 0.62,
      bannerAspect: 0.52,
      restCenterFrac: 0.65,
      floorFrac: 0.72,
    }
  }
  return {
    chibiHeightFrac: 0.52,
    chibiXFrac: 0.17,
    bannerWidthFrac: 0.5,
    bannerAspect: 0.36,
    restCenterFrac: 0.63,
    floorFrac: 0.79,
  }
}

/** The default message painted on the cloth; overridable via ?m= */
export const DEFAULT_MESSAGE = "Hi! I'm Aram."
