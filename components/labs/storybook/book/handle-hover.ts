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
import { useStorybookStore } from '../store'

/**
 * HOVER TRUTH ON EVERY MOVE (E3 R-2, the re-review: "Move onto a grabbable and
 * stop: cursor stays empty. Jiggle the pointer 1px: cursor becomes grab. The
 * cursor lies whenever the reader pauses.")
 *
 * Every layer used to write `hover` from `onPointerOver` ALONE, and r3f fires
 * that exactly once, on the frame the object enters its hovered set — after
 * which the object stays hovered as far as r3f is concerned, so the enter never
 * fires again. But the write is CONDITIONAL: a book that is still booting, is
 * mid page-turn, or is holding another grab refuses it. Refuse once and there is
 * no second chance: the reader's pointer is already sitting on the piece, r3f
 * will not re-announce it, and the cursor says "dead" until the hand moves off
 * the piece and back on. Measured on the lane server — a pointer parked on the
 * s6 tab through the boot raced the `booted` flag and read `hover: null` for a
 * full six seconds, while the same pointer arriving a second later read true.
 *
 * So the same write also runs on every pointer MOVE over the handle, including
 * the moves ParallaxRig replays while the book is busy (book-scene.tsx). The
 * guard is unchanged — this is not a new permission, it is the same permission
 * asked again once the answer can change.
 */
export function markHandleHovered(id: string, spreadIndex: number): void {
  const st = useStorybookStore.getState()
  if (st.grab === null && st.booted && st.turning === null && st.spread === spreadIndex) {
    // ONE cursor identity (s4 reader: the native hand and the gold quill both
    // appeared over a handle). The store's `hover` is the single source; the
    // canvas cursor is owned entirely by book-scene.tsx's CanvasCursor, which
    // shows a native hand ONLY where the quill sprite is not drawn.
    st.setHover(id)
  }
}

/** Eased approach rate (1/s). ~120ms to settle — quick enough to feel like the
 *  paper answering the hand, slow enough not to flicker on a grazing pass. */
const GLOW_RATE = 9
/**
 * Warm gain added to the print at full hover: a few per cent, gold-biased.
 *
 * Raised (0.10/0.075/0.03 -> 0.16/0.12/0.05) after the s6 re-review reported no
 * hover response at all. The MAIN cause of that report was hover truth, not the
 * gain — the store's `hover` was never set for the reviewer's parked pointer, so
 * their A/B crops compared two unhovered frames (see markHandleHovered above).
 * With the hover state forced on, the glow measured a mean |dRGB| of 0.7-1.1
 * over each s6 piece's own box against a 0.03-0.13 same-frame control, so it was
 * real but quiet. This buys ~60% more signal and still sits inside the family's
 * own bound (affordance.test.ts: under 0.2 — light on paper, not a UI highlight;
 * the prints are unlit MeshBasicMaterial, so anything near white clips anyway
 * and the gain reads only in the midtones).
 */
const GLOW_GAIN = { r: 0.16, g: 0.12, b: 0.05 } as const
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
