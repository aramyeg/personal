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
 * So the floor engages at `STUDIO_LIGHTS_FULL` — the same beat `camera-parallax.ts` opens its
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
 * two values, and its caller compares against what it last set and writes only on a change. Two
 * writes per visit: one on the way in, one on the way back out if the visitor scrubs upward.
 *
 * The HYSTERESIS is what makes "two" true rather than "usually two". A visitor resting the scroll
 * exactly on the threshold, or a damped scroll settling onto it, would otherwise flip the buffer
 * every frame — the worst possible frame time, produced by the feature meant to improve the
 * picture. The band is deliberately wide enough that no damped approach can sit inside it.
 */

/** Below this zoom the ending renders at whatever the device asks for; at or above it, at least 2. */
export const ENDING_DPR_AT = STUDIO_LIGHTS_FULL

/** How far back down the zoom must come before the floor is released. See the header. */
export const ENDING_DPR_HYSTERESIS = 0.06

/** The floor itself. Not 3: T79 established that beyond 2 this lab renders no extra pixels at all
 *  (the Canvas ceiling is 2), and a floor above the ceiling is a contradiction rather than a knob. */
export const ENDING_DPR_FLOOR = 2

/**
 * The dpr this frame wants, given the ending's zoom and what is currently set.
 *
 * `current` is passed in rather than held in a module variable because this must be a PURE function
 * of its inputs — the lab's standing rule is that scroll determines the frame, and a hidden
 * accumulator would make two visitors at the same scroll position see different buffers.
 *
 * Returns `null` when nothing should change, so the caller's fast path is a null check rather than
 * a float compare against a value it has to remember how to compute.
 */
export function endingDprFor(zoom: number, device: number, current: number): number | null {
  const want =
    zoom >= ENDING_DPR_AT
      ? Math.max(device, ENDING_DPR_FLOOR)
      : zoom <= ENDING_DPR_AT - ENDING_DPR_HYSTERESIS
        ? device
        : current
  return want === current ? null : want
}
