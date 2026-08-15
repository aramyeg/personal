/**
 * THE TUNNEL SOLVER (E4 candidate, chapter I "The Inn of a Hundred Keys").
 *
 * The chapter is a LIT THEATRE BOX: a raked stage deck carrying six receding
 * cut-paper planes, entered through one carriage arch, with a glowing trap door
 * in the deck. This module is the whole kinematic story in numbers — no three,
 * no react, no scene objects — so the choreography can be reasoned about, unit
 * tested and re-tuned without touching the renderer.
 *
 * WHAT E3 GOT WRONG AND WHAT THIS FIXES. E3's depth stack was near-parallel
 * unlit alpha quads, and at the reading camera's shallow depression they
 * composited into ONE stripe: six planes, one read. Three things separate them
 * here, and the first two are pure solver:
 *
 *  1. THE RAKE. `STAGE.deck.rake` (0.38, i.e. 20.8 deg) tips the stage floor up
 *     toward the back, which lifts the effective view onto the deck from 26.1
 *     deg to 46.9 deg. Every plane's base then clears the deck in front of it
 *     instead of hiding behind it — the single biggest depth win available
 *     without moving the pinned camera.
 *  2. THE STAGGER. The planes do NOT rise together. The arch opens first and
 *     the world behind it gets deeper and deeper, one plane at a time, which is
 *     the actual show: a reader watches depth being BUILT rather than switched
 *     on. `pk` below is a per-plane window, and the last plane completes at
 *     deploy 0.91 so there is a settle tail before the page lands flat.
 *  3. (renderer) real extruded side walls and real light — see the layer.
 *
 * FOLD-FLAT. At deploy 0 the deck rake is 0 and `groupScaleY` is 0.02: the
 * whole diorama is a plane of paper in the closing wedge. The planes are laid
 * back onto the deck AWAY from the reader (hinge -1.36 rad, ~78 deg), which is
 * the direction a tunnel book's flats actually collapse — toward the back of
 * the box, never toward the reader's face.
 */

import { STAGE, type PlaneKey } from './tunnel-cuts'

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------

export type TunnelGeom = {
  mech: 'tunnel'
  /** Sideways travel of EACH yard gate leaf at full open, world units. */
  gateSlide?: number
  /** The coach's z band: deep in the tunnel -> downstage at the arch mouth. */
  coachZ?: readonly [number, number]
  /** The coach's scale at each end of that band (it grows as it comes on). */
  coachScale?: readonly [number, number]
  /** Reader stroke: world units of pull toward the reader for a full drive. */
  pullStroke?: number
}

export const TUNNEL_DEFAULTS = {
  gateSlide: 0.17,
  // The coach stops short of the arch mouth at a restrained scale: at the old
  // [-0.02, 1.9] it covered the whole aperture at full pull, eclipsing the
  // doorway glow and the innkeeper it was arriving toward.
  coachZ: [-0.46, -0.1] as const,
  coachScale: [1.0, 1.55] as const,
  pullStroke: 0.22,
} as const

/** Deploy order — the staging IS the show, so it lives in one exported list.
 *  Index k feeds the per-plane window below. */
export const TUNNEL_PLANE_ORDER: readonly PlaneKey[] = [
  'proscenium',
  'jamb',
  'yard',
  'gallery',
  'backwall',
  'sky',
]

/** Full deploy is reached a little before the page is flat, leaving a settle
 *  tail so the last plane is not still moving when the sheet lands. */
export const DEPLOY_BETA_SPAN = Math.PI * 0.92
/** Fraction of the deploy the deck spends raking up, before any plane rises. */
export const DECK_WINDOW = 0.3
/** Where plane k's rise window opens, and how long each window is. */
export const PLANE_DELAY0 = 0.12
export const PLANE_STEP = 0.09
export const PLANE_SPAN = 0.34
/** Laid-back angle of a plane at rise 0: ~78 deg back onto the deck. */
export const PLANE_LAID_BACK = -1.36
/** The deck's rake as an angle. `deckRake` runs 0 -> this. */
export const RAKE_ANGLE = Math.atan(STAGE.deck.rake)
/** Flat-pose scale of the whole diorama (never exactly 0: a zero scale
 *  produces a singular matrix and three's normal matrix goes NaN). */
export const FLAT_SCALE_Y = 0.02

/** Reader pull: the gates part over the first 55% of the stroke... */
export const GATE_WINDOW = 0.55
/** ...and the coach only starts at 40%, so ONE pull produces TWO separated
 *  events instead of one mushy simultaneous one. */
export const COACH_DELAY = 0.4
export const COACH_SPAN = 0.6

// ---------------------------------------------------------------------------
// math
// ---------------------------------------------------------------------------

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)

/** The one ease this family uses, exported so the layer never invents a
 *  second one (smoothstep: zero slope at both ends, so nothing starts or
 *  stops with a visible jerk). */
export const easeTunnel = (t: number): number => {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

// ---------------------------------------------------------------------------
// the pose
// ---------------------------------------------------------------------------

export type TunnelPlanePose = {
  /** 0 laid flat back onto the deck, 1 standing. */
  rise: number
  /** Hinge angle about the plane's own base line, radians. */
  hinge: number
}

export type TunnelPose = {
  /** Overall deploy, 0..1, from the spread's dihedral. */
  deployed: number
  /** Deck rake, radians: 0 (flat paper) -> RAKE_ANGLE. */
  deckRake: number
  /** Whole-diorama vertical squash, FLAT_SCALE_Y -> 1. */
  groupScaleY: number
  planes: Record<PlaneKey, TunnelPlanePose>
  /** Reader-driven: the yard gate leaves part by +-gateSlide * this. */
  gateOpen: number
  /** Reader-driven: the coach's position along its z band, 0..1. */
  coachT: number
}

/** Where plane `k` sits in its own rise window at a given deploy. */
export function tunnelPlaneRise(k: number, deploy: number): number {
  return easeTunnel(clamp01((deploy - (PLANE_DELAY0 + k * PLANE_STEP)) / PLANE_SPAN))
}

/**
 * The whole diorama's pose from the spread's dihedral `beta` (radians, 0 shut
 * to PI open) and the reader's `pull` (0..1 off the drive channel).
 *
 * Deploy and pull are deliberately INDEPENDENT: the page turn builds the box,
 * the reader's ring works what is inside it. A pull held through a page turn
 * therefore folds away with the paper and comes back, which is what a real
 * pull-tab in a closing book does.
 */
export function solveTunnelPose(input: { beta: number; pull: number }): TunnelPose {
  const deploy = clamp01(input.beta / DEPLOY_BETA_SPAN)
  const pull = clamp01(input.pull)

  const deckProg = easeTunnel(clamp01(deploy / DECK_WINDOW))

  const planes = {} as Record<PlaneKey, TunnelPlanePose>
  TUNNEL_PLANE_ORDER.forEach((key, k) => {
    const rise = tunnelPlaneRise(k, deploy)
    planes[key] = { rise, hinge: (1 - rise) * PLANE_LAID_BACK }
  })

  return {
    deployed: deploy,
    deckRake: RAKE_ANGLE * deckProg,
    groupScaleY: FLAT_SCALE_Y + (1 - FLAT_SCALE_Y) * deckProg,
    planes,
    gateOpen: easeTunnel(clamp01(pull / GATE_WINDOW)),
    coachT: easeTunnel(clamp01((pull - COACH_DELAY) / COACH_SPAN)),
  }
}

/** Resolved config for a layer entry, defaults applied. */
export function tunnelConfig(geom: TunnelGeom) {
  return {
    gateSlide: geom.gateSlide ?? TUNNEL_DEFAULTS.gateSlide,
    coachZ: geom.coachZ ?? TUNNEL_DEFAULTS.coachZ,
    coachScale: geom.coachScale ?? TUNNEL_DEFAULTS.coachScale,
    pullStroke: geom.pullStroke ?? TUNNEL_DEFAULTS.pullStroke,
  }
}

/**
 * Worst world displacement of any moving vertex between two pull values —
 * what the release-return stepper needs to hold itself under the book's
 * per-frame motion cap. The coach is the fastest thing on the drive: it
 * crosses its whole z band over 60% of the stroke, and grows while it does.
 */
export function tunnelWorstPullStep(geom: TunnelGeom, p0: number, p1: number): number {
  const cfg = tunnelConfig(geom)
  const span = Math.abs(cfg.coachZ[1] - cfg.coachZ[0])
  const rate = span / COACH_SPAN + cfg.gateSlide / GATE_WINDOW
  return Math.abs(p1 - p0) * rate
}
