/**
 * ONE READER INPUT, SEVERAL STAGGERED OUTPUTS (E4 §2d — Birmingham mech 101,
 * the delayed double-action).
 *
 * A single pull ought to be able to pay off twice: the innkeeper's family rises
 * inside the arch over the first half of the stroke, and the courtyard flips
 * from cold cobbles to lamplight over the second. Mechanically the book already
 * allows it — the drive store (user-drive.ts) is a bare `Map<string, number>`
 * keyed by layer id, and nothing stops two pieces reading the same key.
 *
 * WHAT STOPS IT IS UNITS. That map stores each family's OWN domain, not a
 * normalised progress: the dissolve keeps tau in radians over [0, PI], a strip
 * flap keeps a hinge angle in radians over its own travel window, a tab piece
 * keeps a strip draw in world units. A follower that assumed 0..1 would read a
 * half-flipped dissolve as "157% pulled" and sit pinned at its stop for the
 * whole stroke. So a follower must normalise through the SOURCE family's
 * domain, which is what this module is: the one place that knows what a
 * channel's number means.
 *
 * The remap itself is deliberately the SAME function the page-turn staging uses
 * (`stageTurnT`): "run a piece's whole travel across a sub-window of a 0..1
 * driver, hold flat before it and full after it" is one idea, and the book
 * should not own two of it. Its endpoint law carries over unchanged — a phase
 * window changes WHEN the follower moves, never WHERE it ends up.
 */

import { readDriveOverride, readUserDrive } from '../user-drive'
import { DISSOLVE_ENDS } from './popup-dissolve'
import { stageTurnT, stripFlapTravel, type LayerGeom } from './popup-mechanics'

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const rad = (d: number): number => (d * Math.PI) / 180

/** Declared on a follower layer (content.ts `SceneLayer.driveFrom`). */
export type DriveFrom = { channel: string; phase: readonly [number, number] }

/**
 * The domain a family stores in its drive channel — [lo, hi] in that family's
 * own units. Re-derived from each family's own constants rather than copied,
 * so a family that moves its stops moves this with it.
 *
 * The default is [0, 1]: a family with no entry here is one whose channel this
 * module has not been taught to read, and reading it as an already-normalised
 * progress is the least surprising guess. Add a case rather than relying on it.
 */
export function driveChannelDomain(source: LayerGeom): readonly [number, number] {
  switch (source.mech) {
    // tau, radians, dunes -> gold (popup-dissolve.ts DISSOLVE_ENDS)
    case 'dissolve':
      return DISSOLVE_ENDS
    // hinge angle, radians, inside the piece's own travel window
    case 'stripflap':
      return stripFlapTravel(source)
    default:
      return [0, 1]
  }
}

/**
 * The dev capture override (`?sbdrive=<id>:<v>`) in the CHANNEL's units. The
 * override is documented as "the piece's OWN domain (strip draw s for tabs,
 * degrees for flaps)", and the two angular families above both read it as
 * degrees — so a follower has to convert exactly as its source would, or the
 * capture deck would show one piece flipped and the other still asleep.
 */
function overrideInChannelUnits(source: LayerGeom, raw: number): number {
  switch (source.mech) {
    case 'dissolve':
    case 'stripflap':
      return rad(raw)
    default:
      return raw
  }
}

/** The source channel's raw value, or undefined when the reader has not touched
 *  it yet (a fresh page: the followers sit at the start of their travel). */
function rawChannelValue(source: LayerGeom | null, channel: string): number | undefined {
  if (source) {
    const override = readDriveOverride(channel)
    if (override !== null) return overrideInChannelUnits(source, override)
  }
  return readUserDrive(channel)
}

/** A source channel read as 0..1 of ITS OWN stroke. 0 when untouched, unknown,
 *  or degenerate — a follower with no signal sits at the start of its travel. */
export function readChannelUnit(source: LayerGeom | null, channel: string): number {
  const raw = rawChannelValue(source, channel)
  if (raw === undefined || !Number.isFinite(raw)) return 0
  const [lo, hi] = source ? driveChannelDomain(source) : ([0, 1] as const)
  const span = hi - lo
  if (span <= 1e-9) return 0
  return clamp((raw - lo) / span, 0, 1)
}

/**
 * The follower's own 0..1 progress: the source channel normalised, then run
 * through the declared phase window. `stageTurnT` is the remap (see the module
 * note), so phase [0, 1] is the identity, the follower is at 0 before its
 * window and 1 after it, and both ends of the source's stroke pin the follower
 * at both ends of its own.
 */
export function readDrivePhase(driveFrom: DriveFrom, source: LayerGeom | null): number {
  const u = readChannelUnit(source, driveFrom.channel)
  return stageTurnT(u, { t0: driveFrom.phase[0], t1: driveFrom.phase[1] })
}
