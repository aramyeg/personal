/**
 * HOVER RESPONSE ON GRABBABLES (E3 BW-1) — the #1 gate failure of the blind
 * sweep, in the readers' own words:
 *   "Zero hover affordance in the entire 3D scene. Verified with a 15px scan
 *    across the one live mechanism and 28px scans along three lines through the
 *    rest. Combined with the suppressed native cursor, there is literally no
 *    signal that distinguishes a live object from a dead one."
 *   "No glow, outline, lift, tint or scale change on hover — anywhere, on
 *    anything, including the two tabs that DO work."
 * Every one of the five found the working mechanism by brute-forcing a grid.
 *
 * WHAT THIS DOES, AND WHY IT IS LIGHT RATHER THAN GEOMETRIC. The piece under
 * the reader's hand CATCHES THE CANDLELIGHT: its own print brightens by a few
 * per cent, warm, over ~120ms, and eases back when the hand leaves. Light is
 * the one thing a paper book can do that costs it no truth — a geometric lift
 * would be a second, smaller version of the mechanism's own motion, which is
 * exactly the confusion the nudge pulse (handle-nudge.ts) exists to avoid: a
 * hover must say "I am touchable", never "I am already moving".
 *
 * The materials are MeshBasicMaterial and their maps carry their own light, so
 * `color` is a straight multiplier on the print — pushing it a little past 1
 * reads as the paper turning toward the candle, not as a UI highlight.
 *
 * No react, no per-frame allocation: a module-scope weight per handle id (the
 * user-drive.ts idiom) and an in-place colour write.
 */

import * as THREE from 'three'

/** Eased approach rate (1/s). ~120ms to settle — quick enough to feel like the
 *  paper answering the hand, slow enough not to flicker on a grazing pass. */
const GLOW_RATE = 9
/** Warm gain added to the print at full hover: a few per cent, gold-biased. */
const GLOW_GAIN = { r: 0.1, g: 0.075, b: 0.03 } as const
/** Below this the weight is snapped to 0 so a handle returns to EXACTLY its own
 *  colour rather than asymptotically near it. */
const GLOW_EPS = 0.004

const weights = new Map<string, number>()

/**
 * Advances (and returns) the eased hover weight in [0, 1] for `id`. Call once
 * per frame from the layer's own frame loop with its own delta.
 */
export function stepHoverGlow(id: string, delta: number, hovered: boolean): number {
  const target = hovered ? 1 : 0
  const current = weights.get(id) ?? 0
  let next = current + (target - current) * Math.min(1, delta * GLOW_RATE)
  if (!hovered && next < GLOW_EPS) next = 0
  if (next === 0) weights.delete(id)
  else weights.set(id, next)
  return next
}

export function clearHoverGlow(id: string): void {
  weights.delete(id)
}

/**
 * Applies weight `w` to a material's colour in place.
 *
 * The material's own colour is captured on the 0 -> non-zero transition and
 * restored exactly on the way back down, rather than cached forever: the layers
 * re-tint these materials when their art resolves (kraft placeholder -> painted
 * white), and a permanently cached base would have pinned a hovered piece to
 * its pre-art tint.
 */
export function applyHandleGlow(material: THREE.MeshBasicMaterial, w: number): void {
  const store = material.userData as { sbGlowBase?: THREE.Color; sbGlowW?: number }
  if (w <= 0) {
    if (store.sbGlowBase) {
      material.color.copy(store.sbGlowBase)
      store.sbGlowBase = undefined
      store.sbGlowW = 0
    }
    return
  }
  if (!store.sbGlowBase) store.sbGlowBase = material.color.clone()
  if (store.sbGlowW === w) return
  store.sbGlowW = w
  const base = store.sbGlowBase
  material.color.setRGB(base.r + GLOW_GAIN.r * w, base.g + GLOW_GAIN.g * w, base.b + GLOW_GAIN.b * w)
}
