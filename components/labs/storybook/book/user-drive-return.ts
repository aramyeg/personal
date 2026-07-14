/**
 * The release-return law for user-driven handles (hand-interaction-laws.md
 * law H2; derived + proven in .superpowers/sdd/bench/derive-userdrive.mjs,
 * gates U2 and UT). When the reader lets go of a tab or flap it eases back to
 * the page cam in the LIFT-ANGLE domain — a capped exponential — so it never
 * snaps and never moves a ship vertex faster than an autonomous piece is
 * allowed to. The knob has no return (law H4: the book remembers the twist).
 *
 * Pure math: no three, no react. The layer measures the worst ship-vertex
 * world step pose-to-pose (the way the bench does) and feeds it in, so this
 * module owns only the timing law and the output clamp. Importable from both
 * the r3f layer and jsdom tests.
 */

/** The autonomous per-vertex world-step ceiling (motion-character Gate 2's
 *  GLOBAL_CAP — today's worst measured + 25%, a calibrated literal). A reader
 *  sets their own pace while grabbing (exempt); only the autonomous return
 *  obeys this. */
export const GLOBAL_CAP = 0.0497
/** Release-return output clamp: 20% under the autonomous cap. The margin is
 *  what a turn that force-releases a grab mid-flight spends on the page, so
 *  the COMPOSED page+return step stays under GLOBAL_CAP by construction (the
 *  budget yield below; gate UT). */
export const STEP_CAP = 0.8 * GLOBAL_CAP
/** Exponential time constant, in turn-clock frames (1 frame = TURN_MS / 240 —
 *  the 240-station easeTurnWeighted clock the return is calibrated on). */
export const RETURN_TAU = 10
/** Stations per turn on the return's clock (matches the motion-character turn
 *  clock). */
export const RETURN_STATIONS = 240

/** Real elapsed seconds expressed in turn-clock frames (240 stations over one
 *  TURN_MS page turn). The layer reads TURN_MS from use-turn-driver. */
export const turnFrames = (deltaSeconds: number, turnMs: number): number =>
  (deltaSeconds * 1000 * RETURN_STATIONS) / turnMs

export type ReturnStep = {
  /** The next effective lift after this frame. */
  next: number
  /** True once within `eps` of the target — the caller clears the drive
   *  channel so the piece follows the pure page cam again. */
  settled: boolean
}

/**
 * One frame of the capped return of `current` toward `target` (both lift
 * angles, radians). `dtFrames` is the elapsed turn-clock frames this render
 * frame; `worstStep(a0, a1)` is the worst ship-vertex world displacement
 * between two lifts, measured pose-to-pose by the caller. `budget` is the
 * per-frame world-step allowance: STEP_CAP at rest, or max(0, STEP_CAP -
 * pageStep) when a page turn is also moving the piece, so the composed step
 * stays under GLOBAL_CAP (law H2's yield).
 *
 * Monotone toward target with no overshoot: the exponential keeps `raw`
 * strictly between current and target, and the output clamp only ever
 * SHORTENS the step (scales it toward `current`), so `next` can never pass
 * the target or reverse direction.
 */
export function stepUserDriveReturn(
  current: number,
  target: number,
  dtFrames: number,
  worstStep: (a0: number, a1: number) => number,
  budget: number = STEP_CAP,
  eps: number = 1e-4
): ReturnStep {
  const raw = current + (target - current) * (1 - Math.exp(-dtFrames / RETURN_TAU))
  const full = worstStep(current, raw)
  const next = full > budget && full > 0 ? current + (raw - current) * (budget / full) : raw
  return { next, settled: Math.abs(next - target) <= eps }
}
