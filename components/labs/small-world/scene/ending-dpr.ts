import { STUDIO_LIGHTS_FULL } from './desk-studio'

/**
 * A FLOOR UNDER THE PIXEL RATIO, FOR THE ENDING ONLY (Task 81).
 *
 * ============================================================================
 * WHAT WAS WRONG
 * ============================================================================
 * `scene.tsx` mounts the Canvas at `dpr={[1, 2]}`, which is a CEILING WITH NO FLOOR: r3f clamps
 * `window.devicePixelRatio` into that range, so a visitor on an ordinary 1080p monitor renders the
 * whole lab at 1440×900 with 4× MSAA and nothing more. T79 measured what that costs at the ending —
 * every object's stair tread HALVES in CSS pixels when the render goes 1×→2×, which is to say the
 * treads are set by the sampling grid rather than by any polygon. The cup's printed line-art is the
 * loudest case: its interior detail energy RISES ×1.63 from 1× to 2×, because the 2× render resolves
 * line-work that the 1× render fragments.
 *
 * That is a quarter of what Aram is looking at when he says the web lost the Blender quality, and
 * unlike the atlas and the vertex bake it costs no bytes at all. It costs fragments.
 *
 * ============================================================================
 * WHY IT IS SCOPED, AND SCOPED HERE
 * ============================================================================
 * Four times the fragments is not free, and the journey does not need it: the journey is a clay
 * planet of large flat-shaded facets turning against a gradient, which is the case a higher
 * sampling rate helps least, and it is also the case the frame budget is tightest — six chapters of
 * scroll-driven motion with the whole dressing set live. The ENDING is the opposite on both counts:
 * it is dense printed line-art and hard contact edges, and the camera has stopped.
 *
 * T130 REOPENED THE FIRST HALF OF THAT AND KEPT THE SECOND. Aram asked for the density across the
 * whole journey, and T127 re-measured the picture argument: the journey the lab ships now carries a
 * great deal of small high-frequency dressing — conifer needles, striped umbrellas, the corner
 * peekers, the girl's silhouette — which is not the flat-facet subject the paragraph above was
 * written about, and which visibly recovers at dpr 2. The PERF half still stands, so the journey's
 * floor is a look-table row (`LOOK.journeyDpr`) rather than a second constant: default 2, and 1
 * restores this file's original behaviour exactly. See `endingDprFor` below.
 *
 * So the ending's floor engages at `STUDIO_LIGHTS_FULL` — the same beat `camera-parallax.ts` opens its
 * envelope on, and for the same reason. It is where the ending stops CHANGING: the studio has
 * reached full and the closing fifth of the pull-back is deliberately settled on the approved
 * picture. Taken as a relation rather than restated as a number, so retuning the studio's ramp
 * carries this with it.
 *
 * ============================================================================
 * WHY IT LATCHES
 * ============================================================================
 * Raising the device pixel ratio REALLOCATES THE DRAWING BUFFER — at 1440×900 that is a 2880×1800
 * colour buffer plus its 4× multisample attachments, which is not something to do on a frame where
 * the answer has not changed. `endingDprFor` is therefore a pure function of zoom returning one of
 * two values, and its caller writes only on a change. At the default (both floors 2) that is ONE
 * write, at the mount; with the journey at 1 it is two, one on the way in and one on the way back
 * out if the visitor scrubs upward.
 *
 * WHAT IT COMPARES AGAINST IS LOAD-BEARING, and T130 paid for learning it. The caller passes the
 * renderer's LIVE ratio as `current`, never a copy of what it last asked for. r3f re-applies the
 * Canvas's own `dpr` range whenever it reconfigures, which discards a `setDpr` written just before
 * — and a caller holding its own copy then latches on a value the renderer no longer has and never
 * writes again for the rest of the visit, taking THIS floor down with it. Measured on an
 * instrumented build: applied at t = 1.72 s, reverted at t = 1.98 s, silent for the remaining
 * 7.6 s. T81 never met it because its only write happened at the money shot, long after the mount
 * had settled; a floor that engages on the first frame meets it immediately.
 *
 * The HYSTERESIS is what makes "two" true rather than "usually two". A visitor resting the scroll
 * exactly on the threshold, or a damped scroll settling onto it, would otherwise flip the buffer
 * every frame — the worst possible frame time, produced by the feature meant to improve the
 * picture. The band is deliberately wide enough that no damped approach can sit inside it.
 */

/** Below this zoom the render takes the JOURNEY's floor; at or above it, the ending's. */
export const ENDING_DPR_AT = STUDIO_LIGHTS_FULL

/** How far back down the zoom must come before the floor is released. See the header. */
export const ENDING_DPR_HYSTERESIS = 0.06

/** The floor itself. Not 3: T79 established that beyond 2 this lab renders no extra pixels at all
 *  (the Canvas ceiling is 2), and a floor above the ceiling is a contradiction rather than a knob. */
export const ENDING_DPR_FLOOR = 2

/**
 * THE JOURNEY GETS A FLOOR TOO, AND IT IS A ROW RATHER THAN A CONSTANT (Task 130).
 *
 * Aram: *"can we double the pixels during the whole journey?"*. T127 §3 L5 is the measurement
 * behind the ask — the ending is the only part of the lab rendered at full density, and on a 1×
 * display that difference is a large part of "the desk looks great". The argument in the header
 * above is not wrong, it is a TRADE, and the two halves of it now sit on either side of a dial:
 * `LOOK.journeyDpr` at 1 is this file exactly as T81 shipped it, and at 2 — the default — the
 * whole lab renders at the ending's density.
 *
 * The floor is passed IN rather than read here for the same reason `current` is: this stays a pure
 * function of its inputs, so the tests can hold both settings to the same laws and neither is a
 * special case.
 *
 * THE HYSTERESIS SURVIVES THE GENERALISATION AND MOSTLY STOPS MATTERING. With both floors at 2 the
 * two branches want the same number, so the threshold has nothing to flip between and the buffer
 * is allocated once for the visit; with the journey at 1 the band does exactly what T81 built it
 * for. Both are gated.
 */
export function endingDprFor(
  zoom: number,
  device: number,
  current: number,
  journeyFloor: number
): number | null {
  const want =
    zoom >= ENDING_DPR_AT
      ? Math.max(device, ENDING_DPR_FLOOR)
      : zoom <= ENDING_DPR_AT - ENDING_DPR_HYSTERESIS
        ? Math.max(device, journeyFloor)
        : current
  return want === current ? null : want
}
