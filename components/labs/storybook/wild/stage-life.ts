/**
 * WILD lane — STAGE LIFE: every idle motion on the stage, in one table.
 *
 * WHY ONE FILE. The life set was authored blind (no browser in the fuse phase) and it WILL be
 * revised off captures. Revision has to be turning numbers, not surgery — so every amplitude,
 * period, count and threshold that makes something move lives in `STAGE_LIFE` below, and the
 * components hold nothing but the plumbing. If a piece needs a change after the eye test, the
 * change is one number in this file.
 *
 * THE TWO LAWS THE SET IS BUILT TO
 *
 *  1. CURATED LIFE, NOT CLUTTER. Each piece has a job in the inn-at-night story and none of them
 *     may pull the eye off the key cascade. So: nothing new stands in the empty low-right third
 *     of the courtyard (the shadow and the moon land there), nothing new is brighter than a lit
 *     window, and nothing moves fast. The set is meant to reward staring, not to be noticed.
 *
 *  2. LIFE DENSITY RIDES THE WAKE. Asleep, the stage is almost still: the wind (sign, smoke
 *     thread, mist), the moon breathing behind its veil, and two or three moths at the lantern —
 *     which is one of the sleeping frame's only two warm notes, and the one place a moth would
 *     actually be. Everything else — the cat on the taproom sill, the fireflies at the well —
 *     wakes as the reader turns the key. That is what keeps the cold/warm value story legible:
 *     a still frame and a busy frame, not two busy frames at different colour temperatures.
 *
 * DETERMINISM. Every motion here is a pure function of the diorama's shared clock and of `wake`.
 * Nothing integrates a delta, nothing calls Math.random, and nothing allocates per frame — so two
 * loads frozen at the same pose are the same picture, which is what the capture harness needs.
 */

import { LANTERN, WELL } from './inn-model'

// ---------------------------------------------------------------------------------------------
// THE WIND — one signal, so the whole stage agrees about the weather
// ---------------------------------------------------------------------------------------------

/**
 * The sign used to swing on its own private sine and the smoke used to wander on two more, which
 * meant the spread had three different winds blowing at once. It now has one: a three-harmonic
 * breeze under a slow gust envelope, evaluated from the shared clock by everything that answers
 * the weather (the sign, the chimney plume, the mist, the tower pennant).
 *
 * Positive wind blows toward +x — the direction the hanging sign's foot swings and the direction
 * the plume leans, so the two always agree.
 *
 * The middle harmonic is deliberately SIGN.sway.period: the sign's authored swing is still the
 * loudest voice in the signal, it now simply has weather around it.
 */
const BREEZE = [
  { amp: 0.55, period: 11.3, phase: 0.0 },
  { amp: 0.3, period: 4.7, phase: 1.2 },
  { amp: 0.15, period: 2.29, phase: 2.7 },
] as const

const TAU = Math.PI * 2

/** Bare breeze, about -1 .. 1. */
function breezeAt(t: number): number {
  let v = 0
  for (const h of BREEZE) v += h.amp * Math.sin((TAU * t) / h.period + h.phase)
  return v
}

/**
 * Signed wind, about -1.3 .. 1.3. The gust envelope swells the whole breeze every ~18 s rather
 * than adding a fourth sine, so a gust reads as the SAME wind blowing harder — which is what a
 * gust is — instead of as a new motion appearing on top.
 */
export function windAt(t: number): number {
  const gust = 0.5 + 0.5 * Math.sin((TAU * t) / 17.9 + 0.7)
  return breezeAt(t) * (STAGE_LIFE.wind.calm + STAGE_LIFE.wind.gust * gust)
}

/**
 * The breeze's running displacement, bounded, for anything that has to be CARRIED by the wind
 * rather than merely lean into it (the mist). It is the analytic integral of `breezeAt`, so it
 * never accumulates and never drifts between two loads.
 *
 * It ignores the gust envelope — the integral of a product is not the product of integrals — and
 * that is a lie no eye can catch on a mist card moving a few millimetres a second.
 */
export function windDriftAt(t: number): number {
  let v = 0
  for (const h of BREEZE) {
    v -= ((h.amp * h.period) / TAU) * Math.cos((TAU * t) / h.period + h.phase)
  }
  return v
}

// ---------------------------------------------------------------------------------------------
// THE CAT — one silhouette crossing one pane, on a schedule
// ---------------------------------------------------------------------------------------------

export type CatCrossing = {
  /** How far the silhouette has slid across the pane, in pane widths. Outside -1..1 it is gone. */
  readonly shift: number
  /** 0 while nothing is crossing, 1 while a crossing is in progress. */
  readonly gate: number
  /** -1 or 1: which way it is walking. The walk cell is mirrored on the return leg. */
  readonly dir: number
}

const CAT_IDLE: CatCrossing = { shift: -9, gate: 0, dir: 1 }

/**
 * Where the cat is at time `t`. Crossings are rare on purpose — one every ~24 s, taking ~5 s — so
 * finding one is a reward for looking, and a reader who never looks twice never sees it. The
 * first crossing is held back past the arrival stall so no capture of a freshly-loaded spread
 * catches a cat halfway across.
 */
export function catCrossingAt(t: number): CatCrossing {
  const c = STAGE_LIFE.cat
  const since = t - c.firstAt
  if (since < 0) return CAT_IDLE
  const n = Math.floor(since / c.period)
  const phase = (since - n * c.period) / c.walk
  if (phase >= 1) return CAT_IDLE
  const dir = n % 2 === 0 ? 1 : -1
  return { shift: dir * (c.reach * (2 * phase - 1)), gate: 1, dir }
}

// ---------------------------------------------------------------------------------------------
// THE TABLE
// ---------------------------------------------------------------------------------------------

export const STAGE_LIFE = {
  /** The one weather signal. `calm` is the still-air scale, `gust` how much a swell adds. */
  wind: { calm: 0.55, gust: 0.75 },

  /**
   * THE SIGN. It already swung; it now swings on the wind instead of on its own clock, and it
   * carries a second, faster whip so a gust makes the board snatch rather than merely lean —
   * which is the whole difference between a swinging sign and a metronome. `gain` multiplies
   * SIGN.sway.amp, so the authored amplitude stays the model's number.
   */
  sign: { gain: 0.85, whip: 0.22, whipPeriod: 1.6 },

  /** THE PLUME leans downwind. `lean` is in plume-widths at the top of the column. */
  smoke: { lean: 0.55 },

  /** THE MIST is carried by the gusts as well as by its own authored drift. */
  mist: { carry: 0.045 },

  /**
   * THE MOON. The halo already breathed in opacity; it now also breathes in size, and a thin
   * VEIL of cloud crosses in front of the disc — slow enough that it reads as weather rather than
   * as an animation, and the only thing on the stage allowed to dim the brightest object in the
   * frame. `veilOpacity` is the peak; `veilBreath` is how much of it the slow swell takes away.
   */
  moon: {
    haloBreath: 0.035,
    haloPeriod: 23.0,
    veilOpacity: 0.3,
    veilBreath: 0.45,
    veilPeriod: 41.0,
    /** Texture units per second. The card is 2.4 wide in uv, so this is a very slow crawl. */
    veilDrift: 0.0042,
    /** In front of the disc (z -2.1), behind the horizon haze (z -1.34). */
    veilZ: -2.02,
    veilHalfW: 2.4,
    veilTop: 1.55,
    veilBottom: 0.42,
  },

  /**
   * THE TOWER PENNANT. The stair tower is the tallest thing in the frame and its apex was dead
   * still; a small banner up there gives the sleeping inn one moving silhouette against the sky,
   * blowing in the same wind as the sign three metres below it. Kept SHORT — it stands above
   * MASS_APEX_Y, which is the top of the composition, so length here is frame headroom spent.
   */
  pennant: {
    /** Staff height above the tower cap's apex, and the staff's square section. */
    staff: 0.055,
    staffT: 0.0035,
    /** Banner length along the wind and its height at the hoist. */
    length: 0.075,
    height: 0.026,
    /** Wave amplitude at the fly end, in world units, and the travelling wave's period. */
    wave: 0.011,
    wavePeriod: 0.9,
    /** How far the whole banner is pushed downwind, in world units. */
    push: 0.014,
  },

  /**
   * THE MOTES. One `THREE.Points` draw, two colonies with different jobs.
   *
   *  lamp  — two or three moths at the lantern. The inn's second warm note while it sleeps is a
   *          lamp burning in an empty courtyard; the moths are the cheapest possible proof that
   *          something in this world is alive before the reader touches anything. They thin out
   *          as the whole facade lights, because by then the lamp is not the only light in town.
   *  well  — fireflies over the well, waking with the inn. They are the only life allowed near
   *          the empty low-right third, and they are allowed because they are two pixels each.
   *
   * Neither colony is warmer than a lit window: the moths are lamp-lit dust, the fireflies a
   * pale green-gold that reads as the one non-lamp colour on the stage.
   */
  motes: {
    lamp: {
      count: 3,
      center: [LANTERN.pos[0] + 0.01, LANTERN.pos[1] + 0.012, LANTERN.pos[2] + 0.03] as const,
      /** Orbit radii (x, y, z) — a flat-ish ellipse, because a moth circles a lamp side-on. */
      radius: [0.055, 0.028, 0.03] as const,
      /** Seconds per orbit, and the jitter that keeps it from being an orbit. */
      period: 3.1,
      jitter: 0.011,
      size: 0.0085,
      color: '#ffd39a',
      /** Level while the inn sleeps, and what is left of it at full wake. */
      rest: 1,
      woken: 0.35,
    },
    well: {
      count: 16,
      center: [WELL.center[0] - 0.02, WELL.wallY + 0.02, WELL.center[2] + 0.03] as const,
      spread: [0.17, 0.13, 0.11] as const,
      /** Seconds per drift loop. Each mote gets its own multiple of this. */
      period: 9.4,
      /** Blink: seconds per cycle, and the fraction of it the mote is actually alight. */
      blink: 2.6,
      duty: 0.34,
      size: 0.0075,
      color: '#d6f0a0',
      /** Wake band over which the colony arrives. */
      wake: [0.22, 0.55] as const,
    },
  },

  /**
   * THE CAT. Animated in the windows shader's occupant atlas — no geometry, no draw call: one
   * pane's silhouette cell is swapped for a walking cat and slid across the glass.
   *
   * `pane` is a WINDOWS id. It has to be a front-facing pane with no standing occupant and enough
   * glass to read a cat against: the taproom's right-hand light is the biggest one that qualifies,
   * and it lights early in the cascade so the cat is available for most of the turn.
   */
  cat: {
    pane: 'taproom-2',
    /** Seconds between crossings, when the first one happens, and how long one takes. */
    period: 23.7,
    firstAt: 9.0,
    walk: 5.2,
    /** How far off-pane the walk starts and ends, in pane widths. */
    reach: 1.15,
    /** The pane's room must be at least this lit — a cat in a dark window is not a cat. */
    litFloor: 0.25,
    /** Height of the sill walk in pane space, and the bob of the shoulders as it steps. */
    sill: 0.1,
    bob: 0.014,
    bobPeriod: 0.62,
  },

  /**
   * THE CLICK KICK. The key's detents already thump the sound, the wobble, the dip, the emissive
   * and the halo; this is the last channel — the frame itself twitching a fifth of a degree when
   * the rotor seats. Amplitude and decay are NOT authored here: they are `KEY_FEEL.camRoll` and
   * `KEY_FEEL.camHalflife`, the toy's own numbers, so the kick can never drift out of step with
   * the click that caused it. What lives here is only how much of that roll the camera takes and
   * the sag that rides with it (`drop` is world units of camera sag at a full-strength click —
   * about two pixels, which is a twitch and not a jolt).
   */
  kick: { roll: 1, drop: 0.0035 },
} as const
